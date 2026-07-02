import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateClientConfig } from '@/lib/client-config'
import { logger, errContext } from '@/lib/logger'

// Réservé admin (garanti par le middleware).

// GET /api/clients — liste des clients (sans secrets de login)
export async function GET() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, sector, config, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('liste clients : erreur DB', { route: 'clients', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ clients: data ?? [] })
}

// POST /api/clients — crée un client { name, sector, config }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const sector = typeof body.sector === 'string' ? body.sector.trim() : ''
    if (!name || !sector) {
      return NextResponse.json({ error: 'Nom et secteur requis' }, { status: 400 })
    }

    const validation = validateClientConfig(body.config)
    if (!validation.ok) {
      return NextResponse.json({ error: 'Config invalide', details: validation.errors }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({ name, sector, config: body.config })
      .select('id')
      .single()

    if (error || !data) {
      logger.error('création client : erreur DB', { route: 'clients', error: error?.message })
      return NextResponse.json({ error: 'Création impossible' }, { status: 500 })
    }

    logger.info('client créé', { route: 'clients', client_id: data.id })
    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    logger.error('création client : erreur', { route: 'clients', ...errContext(err) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
