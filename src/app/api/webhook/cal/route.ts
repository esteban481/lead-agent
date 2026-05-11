import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/webhook/cal
// Reçoit les confirmations de RDV depuis Cal.com
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.triggerEvent !== 'BOOKING_CREATED') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { payload } = body
    const attendeeEmail = payload?.attendees?.[0]?.email?.toLowerCase()
    const startTime = payload?.startTime

    if (!attendeeEmail) {
      return NextResponse.json({ error: 'Missing attendee email' }, { status: 400 })
    }

    // Trouver le lead par email
    const { data: lead, error } = await supabase
      .from('leads')
      .select('id')
      .eq('email', attendeeEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !lead) {
      console.warn('Cal webhook: no lead found for email', attendeeEmail)
      return NextResponse.json({ ok: true, matched: false })
    }

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

    console.log('Cal webhook: lead booked', lead.id, startTime)
    return NextResponse.json({ ok: true, lead_id: lead.id })
  } catch (err) {
    console.error('Cal webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
