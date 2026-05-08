import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { parseLeadMessage } from '@/lib/ai/parse'
import { scoreLead } from '@/lib/ai/score'
import { decideNextAction } from '@/lib/ai/decide'
import {
  generateQualificationEmail,
  generateBookingEmail,
  generateDisqualificationEmail,
} from '@/lib/ai/generate'
import type {
  Client,
  Lead,
  QualificationAnswer,
  ResendInboundPayload,
} from '@/types'

// POST /api/webhook/email-inbound
// Reçoit les réponses email du lead via Resend Inbound (event: email.received)
export async function POST(req: NextRequest) {
  try {
    const payload: ResendInboundPayload = await req.json()

    // Vérifie que c'est bien un email reçu
    if (payload.type !== 'email.received') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { data } = payload
    const fromEmail = extractEmail(data.from)
    let inReplyTo = cleanMessageId(data.in_reply_to ?? '')

    // Le webhook Resend n'inclut pas le body — il faut le fetcher séparément
    let messageText = data.text ?? ''
    console.log('[inbound] email_id:', data.email_id, 'text preview:', messageText.slice(0, 100))

    if (data.email_id) {
      try {
        const res = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        })
        console.log('[inbound] Resend API status:', res.status)
        if (res.ok) {
          const full = await res.json()
          console.log('[inbound] fetched text:', (full.text ?? '').slice(0, 200))
          messageText = full.text ?? full.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
          // Extraire in_reply_to depuis les headers si absent du payload
          if (!inReplyTo && full.headers) {
            const raw = full.headers['In-Reply-To'] ?? full.headers['in-reply-to'] ?? ''
            if (raw) inReplyTo = cleanMessageId(raw)
            console.log('[inbound] in_reply_to from headers:', inReplyTo)
          }
        } else {
          const err = await res.text()
          console.warn('[inbound] Resend API error:', res.status, err)
        }
      } catch (err) {
        console.warn('[inbound] Failed to fetch email content:', err)
      }
    }

    console.log('[inbound] final messageText:', messageText.slice(0, 200))

    // 1. Retrouver le lead — priorité au In-Reply-To, fallback sur l'email
    let lead: Lead | null = null

    if (inReplyTo) {
      const { data: found } = await supabase
        .from('leads')
        .select('*')
        .eq('email_thread_id', inReplyTo)
        .single()
      lead = found as Lead | null
    }

    if (!lead && fromEmail) {
      const { data: found } = await supabase
        .from('leads')
        .select('*')
        .eq('email', fromEmail)
        .in('status', ['awaiting_reply', 'qualifying'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      lead = found as Lead | null
    }

    if (!lead) {
      console.warn('Inbound email: no matching lead found', { inReplyTo, fromEmail })
      return NextResponse.json({ ok: true, matched: false })
    }

    // 2. Charger le client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', lead.client_id)
      .single()

    if (!client) {
      console.error('Client not found for lead', lead.id)
      return NextResponse.json({ error: 'Client not found' }, { status: 500 })
    }

    const typedClient = client as Client

    // 3. Log le message reçu
    await supabase.from('messages').insert({
      lead_id: lead.id,
      direction: 'in',
      channel: 'email',
      subject: data.subject,
      body: messageText,
      in_reply_to: inReplyTo,
      message_id: data.message_id,
    })

    // 4. Annuler les relances en attente
    await supabase
      .from('scheduled_relances')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('lead_id', lead.id)
      .eq('status', 'pending')

    // 5. Charger les réponses existantes
    const { data: existingAnswers } = await supabase
      .from('qualification_answers')
      .select('*')
      .eq('lead_id', lead.id)

    const answers = (existingAnswers ?? []) as QualificationAnswer[]

    // 6. Parser le message pour extraire les nouvelles infos
    const parsed = await parseLeadMessage(messageText, typedClient.config, answers)

    // Sauvegarder les nouvelles réponses (sans écraser les existantes)
    const existingKeys = new Set(answers.map((a) => a.question_key))
    const newAnswers = Object.entries(parsed)
      .filter(([key, value]) => value !== undefined && !existingKeys.has(key))
      .map(([key, value]) => ({
        lead_id: lead!.id,
        question_key: key,
        answer: value as string,
      }))

    if (newAnswers.length > 0) {
      await supabase.from('qualification_answers').insert(newAnswers)
    }

    const allAnswers = [
      ...answers,
      ...newAnswers.map((a) => ({
        ...a,
        id: '',
        created_at: new Date().toISOString(),
      })),
    ]

    // 7. Mettre à jour le statut
    await supabase
      .from('leads')
      .update({ status: 'qualifying' })
      .eq('id', lead.id)

    // 8. Vérifier si toutes les questions sont répondues
    const requiredKeys = new Set(
      typedClient.config.qualification_questions.map((q) => q.key)
    )
    const answeredKeys = new Set(allAnswers.map((a) => a.question_key))
    const allAnswered = [...requiredKeys].every((k) => answeredKeys.has(k))

    if (allAnswered) {
      // 9a. Toutes les infos collectées → score + décision
      await supabase.from('leads').update({ status: 'scoring' }).eq('id', lead.id)

      const scoreResult = await scoreLead(lead, allAnswers, typedClient.config)
      // On force missing_fields à [] car on sait que toutes les questions sont répondues
      const decision = decideNextAction(lead, { ...scoreResult, missing_fields: [] }, allAnswers, typedClient.config)

      await supabase
        .from('leads')
        .update({
          score: scoreResult.score,
          score_category: scoreResult.category,
          score_details: scoreResult.details,
          ai_summary: scoreResult.summary,
          status: decision.action === 'disqualify' ? 'disqualified' : 'awaiting_reply',
          disqualified_reason: decision.action === 'disqualify' ? decision.reason : null,
        })
        .eq('id', lead.id)

      if (decision.action === 'send_booking_link' || decision.action === 'send_gentle_followup') {
        const { subject, body } = await generateBookingEmail(
          lead,
          typedClient.config,
          scoreResult.summary
        )
        await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)

        if (decision.action === 'send_gentle_followup') {
          await supabase.from('scheduled_relances').insert({
            lead_id: lead.id,
            step: 2,
            scheduled_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
          })
        }
      } else if (decision.action === 'disqualify') {
        const { subject, body } = await generateDisqualificationEmail(lead, decision.reason)
        await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)
      }
    } else {
      // 9b. Il manque encore des infos → question suivante
      const { subject, body } = await generateQualificationEmail(
        lead,
        allAnswers,
        typedClient.config
      )
      await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)

      await supabase.from('scheduled_relances').insert({
        lead_id: lead.id,
        step: 1,
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      })
    }

    return NextResponse.json({ ok: true, lead_id: lead.id })
  } catch (err) {
    console.error('Webhook email-inbound error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// Helpers
// ============================================================

function cleanMessageId(raw: string): string {
  return raw.replace(/[<>]/g, '').trim()
}

function extractEmail(from: string): string | null {
  const match = from.match(/<([^>]+)>/) ?? from.match(/([^\s]+@[^\s]+)/)
  return match ? match[1].toLowerCase() : null
}

async function sendAndLogEmail(
  leadId: string,
  to: string,
  from: string,
  subject: string,
  body: string
) {
  const replyTo = process.env.RESEND_INBOUND_EMAIL ?? from
  const { id: resendId } = await sendEmail({ to, from, subject, text: body, replyTo })
  await supabase.from('messages').insert({
    lead_id: leadId,
    direction: 'out',
    channel: 'email',
    subject,
    body,
    resend_email_id: resendId,
  })
}
