import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateClientConfig } from '@/lib/client-config'
import { logger, errContext } from '@/lib/logger'

// PATCH /api/clients/[id] — met à jour name / sector / config
// Réservé admin (garanti par le middleware).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const update: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
    if (typeof body.sector === 'string' && body.sector.trim()) update.sector = body.sector.trim()

    if (body.config !== undefined) {
      const validation = validateClientConfig(body.config)
      if (!validation.ok) {
        return NextResponse.json({ error: 'Config invalide', details: validation.errors }, { status: 400 })
      }
      update.config = body.config
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
    }

    const { error } = await supabase.from('clients').update(update).eq('id', id)
    if (error) {
      logger.error('maj client : erreur DB', { route: 'clients', client_id: id, error: error.message })
      return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }

    logger.info('client mis à jour', { route: 'clients', client_id: id, fields: Object.keys(update) })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('maj client : erreur', { route: 'clients', client_id: id, ...errContext(err) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
