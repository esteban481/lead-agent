import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger, errContext } from '@/lib/logger'
import type { Lead } from '@/types'

// POST /api/leads/[id]/action  { action: 'book'|'disqualify'|'reopen', reason? }
// Actions manuelles depuis la fiche lead (reprise en main humaine).
const ACTIONS = ['book', 'disqualify', 'reopen'] as const
type Action = (typeof ACTIONS)[number]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const log = logger.with({ route: 'lead-action', lead_id: id })

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action as Action
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
    }

    // Charger le lead pour la garde de périmètre
    const { data: lead } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    // Garde anti-IDOR : un client ne peut agir que sur ses propres leads
    // (x-client-id posé par le middleware ; absent = admin).
    const sessionClientId = req.headers.get('x-client-id')
    if (sessionClientId && (lead as Lead).client_id !== sessionClientId) {
      return NextResponse.json({ error: 'Interdit' }, { status: 403 })
    }

    const now = new Date().toISOString()

    if (action === 'book') {
      await supabase.from('leads').update({ status: 'booked', meeting_booked_at: now }).eq('id', id)
      await cancelPendingRelances(id, now)
    } else if (action === 'disqualify') {
      const reason = typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : 'Disqualifié manuellement'
      await supabase.from('leads').update({ status: 'disqualified', disqualified_reason: reason }).eq('id', id)
      await cancelPendingRelances(id, now)
    } else {
      // reopen : on rouvre le lead (efface RDV / raison de disqualification / erreur)
      await supabase
        .from('leads')
        .update({ status: 'awaiting_reply', meeting_booked_at: null, disqualified_reason: null, last_error: null })
        .eq('id', id)
    }

    log.info('action manuelle appliquée', { action })
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('erreur action lead', errContext(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function cancelPendingRelances(leadId: string, now: string) {
  await supabase
    .from('scheduled_relances')
    .update({ status: 'cancelled', cancelled_at: now })
    .eq('lead_id', leadId)
    .eq('status', 'pending')
}
