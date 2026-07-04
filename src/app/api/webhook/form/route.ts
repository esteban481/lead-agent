import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { brandingFromConfig } from '@/lib/email-template'
import { buildReplyTo } from '@/lib/email-utils'
import { parseLeadMessage } from '@/lib/ai/parse'
import { generateQualificationEmail } from '@/lib/ai/generate'
import { logger, errContext } from '@/lib/logger'
import { createRateLimiter } from '@/lib/rate-limit'
import type { Client, FormWebhookPayload, Lead } from '@/types'

// Endpoint public → durcissement basique
const MAX_BODY_BYTES = 50_000
const MAX_MESSAGE_CHARS = 4_000
// Best-effort (mémoire par instance) — voir src/lib/rate-limit.ts
const formLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

// POST /api/webhook/form?client_id=xxx
// Reçoit un lead depuis un formulaire web
export async function POST(req: NextRequest) {
  const log = logger.with({ webhook: 'form' })
  try {
    const clientId = req.nextUrl.searchParams.get('client_id')
    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
    }

    // Rate limit best-effort par client + IP (borne les rafales)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = formLimiter.check(`${clientId}:${ip}`)
    if (!rl.allowed) {
      log.warn('rate limit dépassé', { client_id: clientId, ip })
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    // Rejette un corps trop volumineux (anti-abus)
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    let payload: FormWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

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

    // Honeypot : si le champ leurre configuré est rempli → bot, on ignore
    // silencieusement (200 pour ne pas signaler la détection).
    const hpField = typedClient.config.honeypot_field
    if (hpField && typeof payload[hpField] === 'string' && (payload[hpField] as string).trim()) {
      log.info('honeypot déclenché, lead ignoré', { client_id: clientId })
      return NextResponse.json({ ok: true, ignored: true })
    }

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
    // Plafonne la longueur envoyée à Claude (coût + anti-abus)
    const rawMessage = (payload.message ?? '').slice(0, MAX_MESSAGE_CHARS)
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
      log.error('échec création lead', { client_id: clientId, error: leadError?.message })
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
        typedClient.config,
        typedClient.sector
      )

      // Génère un Message-ID unique pour tracker les réponses
      const messageId = `lead-${typedLead.id}@${getDomain(typedClient.config.from_email)}`

      const { id: resendId } = await sendEmail({
        to: email,
        from: typedClient.config.from_email,
        subject,
        text: body,
        branding: brandingFromConfig(typedClient.config),
        replyTo: buildReplyTo(typedLead.id),
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

    log.info('lead créé', { lead_id: typedLead.id, client_id: clientId, contacted: !!email })
    return NextResponse.json({ ok: true, lead_id: typedLead.id })
  } catch (err) {
    log.error('erreur webhook', errContext(err))
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
