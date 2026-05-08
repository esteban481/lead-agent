import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { parseLeadMessage } from '@/lib/ai/parse'
import { generateQualificationEmail } from '@/lib/ai/generate'
import type { Client, FormWebhookPayload, Lead } from '@/types'

// POST /api/webhook/form?client_id=xxx
// Reçoit un lead depuis un formulaire web
export async function POST(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('client_id')
    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
    }

    const payload: FormWebhookPayload = await req.json()

    // 1. Charger la config client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const typedClient = client as Client

    // 2. Normalisation des données basiques
    const email = normalizeEmail(payload.email)
    const phone = normalizePhone(payload.phone)
    const name = normalizeName(payload.name)

    // 3. Déduplication — cherche un lead récent avec le même email
    if (email) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id, status')
        .eq('client_id', clientId)
        .eq('email', email)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .single()

      if (existing) {
        // Doublon récent : on met à jour et on sort
        await supabase
          .from('leads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', existing.id)

        return NextResponse.json({
          ok: true,
          lead_id: existing.id,
          duplicate: true,
        })
      }
    }

    // 4. Création du lead
    const rawMessage = payload.message ?? ''
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        client_id: clientId,
        name,
        email,
        phone,
        source: payload.source ?? 'website_form',
        raw_data: payload,
        status: 'new',
      })
      .select()
      .single()

    if (leadError || !lead) {
      console.error('Lead insert error:', leadError)
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
    }

    const typedLead = lead as Lead

    // 5. Parse le message pour extraire les premières infos
    const parsed = await parseLeadMessage(rawMessage, typedClient.config)

    // Sauvegarde les réponses extraites
    if (Object.keys(parsed).length > 0) {
      const answersToInsert = Object.entries(parsed)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => ({
          lead_id: typedLead.id,
          question_key: key,
          answer: value as string,
        }))

      if (answersToInsert.length > 0) {
        await supabase.from('qualification_answers').insert(answersToInsert)
      }
    }

    // 6. Génère et envoie l'email de qualification (si email dispo)
    if (email) {
      const existingAnswers = Object.entries(parsed)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => ({
          id: '',
          lead_id: typedLead.id,
          question_key: key,
          answer: value as string,
          created_at: new Date().toISOString(),
        }))

      const { subject, body } = await generateQualificationEmail(
        typedLead,
        existingAnswers,
        typedClient.config
      )

      // Génère un Message-ID unique pour tracker les réponses
      const messageId = `lead-${typedLead.id}@${getDomain(typedClient.config.from_email)}`

      const { id: resendId } = await sendEmail({
        to: email,
        from: typedClient.config.from_email,
        subject,
        text: body,
        replyTo: process.env.RESEND_INBOUND_EMAIL ?? typedClient.config.from_email,
        headers: { 'Message-ID': `<${messageId}>` },
      })

      // Log le message envoyé
      await supabase.from('messages').insert({
        lead_id: typedLead.id,
        direction: 'out',
        channel: 'email',
        subject,
        body,
        message_id: messageId,
        resend_email_id: resendId,
      })

      // Met à jour le lead avec le thread ID et le statut
      await supabase
        .from('leads')
        .update({
          status: 'awaiting_reply',
          email_thread_id: messageId,
        })
        .eq('id', typedLead.id)

      // 7. Planifie les relances
      await scheduleRelances(typedLead.id)
    }

    return NextResponse.json({ ok: true, lead_id: typedLead.id })
  } catch (err) {
    console.error('Webhook form error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// Helpers
// ============================================================

function normalizeEmail(email?: string): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  return digits.startsWith('33') ? `+${digits}` : digits
}

function normalizeName(name?: string): string | null {
  if (!name) return null
  return name.trim().replace(/\s+/g, ' ')
}

function getDomain(email: string): string {
  return email.split('@')[1] ?? 'leadagent.io'
}

async function scheduleRelances(leadId: string) {
  const now = new Date()
  const relances = [
    { step: 1, delay: 24 },    // J+1
    { step: 2, delay: 72 },    // J+3
    { step: 3, delay: 168 },   // J+7
  ]

  const toInsert = relances.map(({ step, delay }) => ({
    lead_id: leadId,
    step,
    scheduled_at: new Date(now.getTime() + delay * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  }))

  await supabase.from('scheduled_relances').insert(toInsert)
}
