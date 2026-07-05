import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger, errContext } from '@/lib/logger'
import type { Lead } from '@/types'

const MAX_NOTE_CHARS = 5_000

// PATCH /api/leads/[id]/note  { notes }
// Note interne du commercial sur la fiche lead.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const log = logger.with({ route: 'lead-note', lead_id: id })

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'notes (string) requis' }, { status: 400 })
    }
    const notes = body.notes.slice(0, MAX_NOTE_CHARS)

    const { data: lead } = await supabase.from('leads').select('id, client_id').eq('id', id).maybeSingle()
    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    // Garde anti-IDOR : un client n'écrit que sur ses propres leads
    const sessionClientId = req.headers.get('x-client-id')
    if (sessionClientId && (lead as Pick<Lead, 'id' | 'client_id'>).client_id !== sessionClientId) {
      return NextResponse.json({ error: 'Interdit' }, { status: 403 })
    }

    const { error } = await supabase.from('leads').update({ notes }).eq('id', id)
    if (error) {
      log.error('échec enregistrement note', { error: error.message })
      return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('erreur note lead', errContext(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
