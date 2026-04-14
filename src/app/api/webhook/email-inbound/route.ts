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
// Reçoit les réponses email du lead via Resend Inbound
export async function POST(req: NextRequest) {
  try {
    const payload: ResendInboundPayload = await req.json()

    // 1. Extraire le Message-ID de référence pour retrouver le lead
    const inReplyTo = cleanMessageId(
      payload.headers['in-reply-to'] ?? payload.headers['In-Reply-To'] ?? ''
    )
    const fromEmail = extractEmail(payload.from)

    // 2. Retrouver le lead — priorité au thread ID, fallback sur l'email
    let lead: Lead | null = null

    if (inReplyTo) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('email_thread_id', inReplyTo)
        .single()
      lead = data as Lead | null
    }

    if (!lead && fromEmail) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('email', fromEmail)
        .in('status', ['awaiting_reply', 'qualifying'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      lead = data as Lead | null
    }

    if (!lead) {
      // Pas de lead trouvé — log et on sort proprement
      console.warn('Inbound email: no matching lead found', { inReplyTo, fromEmail })
      return NextResponse.json({ ok: true, matched: false })
    }

    // 3. Charger le client
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

    // 4. Log le message reçu
    await supabase.from('messages').insert({
      lead_id: lead.id,
      direction: 'in',
      channel: 'email',
      subject: payload.subject,
      body: payload.text,
      in_reply_to: inReplyTo,
    })

    // 5. Annuler les relances en attente (le lead a répondu)
    await supabase
      .from('scheduled_relances')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('lead_id', lead.id)
      .eq('status', 'pending')

    // 6. Charger les réponses de qualification existantes
    const { data: existingAnswers } = await supabase
      .from('qualification_answers')
      .select('*')
      .eq('lead_id', lead.id)

    const answers = (existingAnswers ?? []) as QualificationAnswer[]

    // 7. Parser le nouveau message pour extraire des infos
    const parsed = await parseLeadMessage(
      payload.text,
      typedClient.config,
      answers
    )

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

    // 8. Mettre à jour le statut
    await supabase
      .from('leads')
      .update({ status: 'qualifying' })
      .eq('id', lead.id)

    // 9. Vérifier si toutes les questions sont répondues
    const requiredKeys = new Set(
      typedClient.config.qualification_questions.map((q) => q.key)
    )
    const answeredKeys = new Set(allAnswers.map((a) => a.question_key))
    const allAnswered = [...requiredKeys].every((k) => answeredKeys.has(k))

    if (allAnswered) {
      // 10a. Toutes les infos collectées → score + décision
      await supabase
        .from('leads')
        .update({ status: 'scoring' })
        .eq('id', lead.id)

      const scoreResult = await scoreLead(lead, allAnswers, typedClient.config)
      const decision = decideNextAction(lead, scoreResult, allAnswers, typedClient.config)

      // Sauvegarder le score
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

      // Envoyer l'email selon la décision
      if (decision.action === 'send_booking_link') {
        const { subject, body } = await generateBookingEmail(
          lead,
          typedClient.config,
          scoreResult.summary
        )
        await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)
      } else if (decision.action === 'disqualify') {
        const { subject, body } = await generateDisqualificationEmail(lead, decision.reason)
        await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)
      } else if (decision.action === 'send_gentle_followup') {
        // Score C : envoyer quand même le lien mais avec un ton moins pressant
        const { subject, body } = await generateBookingEmail(
          lead,
          typedClient.config,
          scoreResult.summary
        )
        await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)
        // Replanifier une relance pour dans 3 jours
        await supabase.from('scheduled_relances').insert({
          lead_id: lead.id,
          step: 2,
          scheduled_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        })
      }
    } else {
      // 10b. Il manque encore des infos → poser la question suivante
      const { subject, body } = await generateQualificationEmail(
        lead,
        allAnswers,
        typedClient.config
      )
      await sendAndLogEmail(lead.id, lead.email!, typedClient.config.from_email, subject, body)

      // Replanifier une relance si le lead ne répond plus
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
  const { id: resendId } = await sendEmail({ to, from, subject, text: body })
  await supabase.from('messages').insert({
    lead_id: leadId,
    direction: 'out',
    channel: 'email',
    subject,
    body,
    resend_email_id: resendId,
  })
}
