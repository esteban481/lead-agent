import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyCalWebhook } from '@/lib/webhook-security'
import { claimWebhook, releaseWebhook } from '@/lib/idempotency'
import { notifyCommercial } from '@/lib/notify'
import type { Client, Lead } from '@/types'

// POST /api/webhook/cal
// Reçoit les confirmations de RDV depuis Cal.com
export async function POST(req: NextRequest) {
  // Id de la réservation réservé pour l'idempotence — libéré si échec
  let claimedBookingUid: string | null = null

  try {
    // La signature est calculée sur le body brut — le lire avant de parser
    const rawBody = await req.text()

    const verification = verifyCalWebhook(rawBody, req.headers)
    if (!verification.valid) {
      console.warn('[cal] webhook rejeté:', verification.reason)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    if (body.triggerEvent !== 'BOOKING_CREATED') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { payload } = body
    const attendeeEmail = payload?.attendees?.[0]?.email?.toLowerCase()
    const startTime = payload?.startTime
    const bookingUid = payload?.uid

    if (!attendeeEmail) {
      return NextResponse.json({ error: 'Missing attendee email' }, { status: 400 })
    }

    // Idempotence : ne pas traiter 2× la même réservation
    const claim = await claimWebhook('cal', bookingUid)
    if (claim === 'duplicate') {
      console.log('[cal] réservation déjà traitée, ignorée:', bookingUid)
      return NextResponse.json({ ok: true, duplicate: true })
    }
    if (claim === 'new') claimedBookingUid = bookingUid

    // Trouver le lead par email
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('email', attendeeEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !lead) {
      console.warn('Cal webhook: no lead found for email', attendeeEmail)
      return NextResponse.json({ ok: true, matched: false })
    }

    const typedLead = lead as Lead

    // Mettre à jour le lead
    await supabase
      .from('leads')
      .update({
        status: 'booked',
        meeting_booked_at: startTime ?? new Date().toISOString(),
      })
      .eq('id', lead.id)

    // Annuler les relances en attente
    await supabase
      .from('scheduled_relances')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('lead_id', lead.id)
      .eq('status', 'pending')

    // Alerter le commercial que le RDV est confirmé
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', typedLead.client_id)
      .single()

    if (client) {
      const rdvDate = startTime
        ? new Date(startTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
        : 'date inconnue'
      await notifyCommercial(
        (client as Client).config,
        typedLead,
        `RDV confirmé — ${typedLead.name ?? typedLead.email}`,
        [`Le prospect vient de réserver un rendez-vous le ${rdvDate}.`]
      )
    }

    console.log('Cal webhook: lead booked', lead.id, startTime)
    return NextResponse.json({ ok: true, lead_id: lead.id })
  } catch (err) {
    console.error('Cal webhook error:', err)
    // Libère la clé d'idempotence pour qu'un retry de Cal.com puisse rejouer
    if (claimedBookingUid) await releaseWebhook('cal', claimedBookingUid)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
