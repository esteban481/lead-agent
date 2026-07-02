import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateSalt, hashPassword } from '@/lib/password'
import { logger, errContext } from '@/lib/logger'

// POST /api/clients/[id]/login — définit / réinitialise le login du client
// { email, password } → hash PBKDF2 stocké. Réservé admin (middleware).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || password.length < 8) {
      return NextResponse.json({ error: 'Email requis et mot de passe ≥ 8 caractères' }, { status: 400 })
    }

    const salt = generateSalt()
    const hash = await hashPassword(password, salt)

    const { error } = await supabase
      .from('clients')
      .update({ login_email: email, login_password_salt: salt, login_password_hash: hash })
      .eq('id', id)

    if (error) {
      // Colonnes absentes → migration 002 pas appliquée
      if (error.code === '42703' || error.code === 'PGRST204') {
        return NextResponse.json(
          { error: 'Colonnes de login absentes — appliquer la migration 002_client_logins.sql' },
          { status: 409 }
        )
      }
      logger.error('login client : erreur DB', { route: 'clients-login', client_id: id, error: error.message })
      return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 })
    }

    logger.info('login client défini', { route: 'clients-login', client_id: id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('login client : erreur', { route: 'clients-login', client_id: id, ...errContext(err) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
