import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyCalWebhook } from '@/lib/webhook-security'
import { claimWebhook, releaseWebhook } from '@/lib/idempotency'
import { notifyCommercial } from '@/lib/notify'
import type { Client, Lead } from '@/types'

// POST /api/webhook/cal
// Reçoit les événements de RDV Cal.com : création, annulation, report.
const HANDLED_EVENTS = ['BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED']

export async function POST(req: NextRequest) {
  // Clé d'idempotence réservée — libérée si le traitement échoue
  let claimedKey: string | null = null

  try {
    // La signature est calculée sur le body brut — le lire avant de parser
    const rawBody = await req.text()

    const verification = verifyCalWebhook(rawBody, req.headers)
    if (!verification.valid) {
      console.warn('[cal] webhook rejeté:', verification.reason)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const triggerEvent: string = body.triggerEvent

    if (!HANDLED_EVENTS.includes(triggerEvent)) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { payload } = body
    const attendeeEmail: string | null = payload?.attendees?.[0]?.email?.toLowerCase() ?? null
    const startTime: string | null = payload?.startTime ?? null
    const bookingUid: string | null = payload?.uid ?? null

    if (!attendeeEmail && !bookingUid) {
      return NextResponse.json({ error: 'Missing booking identifier' }, { status: 400 })
    }

    // Idempotence : la clé inclut le type d'événement, sinon une annulation
    // serait prise pour un doublon de la création (même uid).
    const idemKey = `${triggerEvent}:${bookingUid ?? attendeeEmail}`
    const claim = await claimWebhook('cal', idemKey)
    if (claim === 'duplicate') {
      console.log('[cal] événement déjà traité, ignoré:', idemKey)
      return NextResponse.json({ ok: true, duplicate: true })
    }
    if (claim === 'new') claimedKey = idemKey

    // Retrouver le lead : par cal_booking_id (uid) puis par email (fallback)
    const lead = await findLead(bookingUid, attendeeEmail)
    if (!lead) {
      console.warn('[cal] aucun lead trouvé', { bookingUid, attendeeEmail })
      return NextResponse.json({ ok: true, matched: false })
    }

    const { subject, lines } = await applyEvent(triggerEvent, lead, { startTime, bookingUid })

    // Alerter le commercial
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', lead.client_id)
      .maybeSingle()
    if (client) {
      await notifyCommercial((client as Client).config, lead, subject, lines)
    }

    console.log('[cal]', triggerEvent, 'lead', lead.id)
    return NextResponse.json({ ok: true, lead_id: lead.id, event: triggerEvent })
  } catch (err) {
    console.error('Cal webhook error:', err)
    if (claimedKey) await releaseWebhook('cal', claimedKey)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// Helpers
// ============================================================

async function findLead(uid: string | null, email: string | null): Promise<Lead | null> {
  if (uid) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('cal_booking_id', uid)
      .limit(1)
      .maybeSingle()
    if (data) return data as Lead
  }
  if (email) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data as Lead
  }
  return null
}

function formatRdv(startTime: string | null): string {
  return startTime
    ? new Date(startTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
    : 'date inconnue'
}

// Applique la mutation selon l'événement et retourne le contenu de l'alerte commercial.
async function applyEvent(
  event: string,
  lead: Lead,
  { startTime, bookingUid }: { startTime: string | null; bookingUid: string | null }
): Promise<{ subject: string; lines: string[] }> {
  const who = lead.name ?? lead.email ?? 'le prospect'
  const rdv = formatRdv(startTime)

  if (event === 'BOOKING_CANCELLED') {
    // Le RDV n'a plus lieu : on rouvre le lead pour qu'un humain le voie.
    await supabase
      .from('leads')
      .update({ status: 'awaiting_reply', meeting_booked_at: null })
      .eq('id', lead.id)
    return {
      subject: `RDV annulé — ${who}`,
      lines: [`Le prospect a annulé son rendez-vous. Le lead est rouvert (à recontacter).`],
    }
  }

  if (event === 'BOOKING_RESCHEDULED') {
    await supabase
      .from('leads')
      .update({
        status: 'booked',
        meeting_booked_at: startTime ?? new Date().toISOString(),
        cal_booking_id: bookingUid,
      })
      .eq('id', lead.id)
    return {
      subject: `RDV déplacé — ${who}`,
      lines: [`Le prospect a déplacé son rendez-vous au ${rdv}.`],
    }
  }

  // BOOKING_CREATED
  await supabase
    .from('leads')
    .update({
      status: 'booked',
      meeting_booked_at: startTime ?? new Date().toISOString(),
      cal_booking_id: bookingUid,
    })
    .eq('id', lead.id)
  // Annuler les relances en attente
  await supabase
    .from('scheduled_relances')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('lead_id', lead.id)
    .eq('status', 'pending')
  return {
    subject: `RDV confirmé — ${who}`,
    lines: [`Le prospect vient de réserver un rendez-vous le ${rdv}.`],
  }
}
