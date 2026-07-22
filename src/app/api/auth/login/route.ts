import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPassword, timingSafeEqualHex } from '@/lib/password'
import { createSession, SESSION_COOKIE } from '@/lib/session'
import { logger } from '@/lib/logger'

// POST /api/auth/login  { email, password }
// Authentifie un admin (identifiants env) ou un client (table clients)
// et pose un cookie de session signé.
export async function POST(req: NextRequest) {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    logger.error('SESSION_SECRET non configuré', { route: 'auth-login' })
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 })
  }

  const { email, password } = await req.json().catch(() => ({ email: '', password: '' }))
  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  let session: { role: 'admin' | 'client'; client_id: string | null } | null = null

  // 1. Admin (identifiants d'environnement)
  const adminUser = (process.env.DASHBOARD_USER ?? 'admin').toLowerCase()
  const adminPass = process.env.DASHBOARD_PASSWORD
  if (adminPass && normalizedEmail === adminUser && timingSafeEqualHex(password, adminPass)) {
    session = { role: 'admin', client_id: null }
  } else {
    // 2. Client (table clients)
    const { data: client } = await supabase
      .from('clients')
      .select('id, login_password_hash, login_password_salt')
      .eq('login_email', normalizedEmail)
      .single()

    if (client?.login_password_hash && client?.login_password_salt) {
      const ok = await verifyPassword(password, client.login_password_salt, client.login_password_hash)
      if (ok) session = { role: 'client', client_id: client.id }
    }
  }

  if (!session) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
  }

  const token = await createSession(session, secret)
  const res = NextResponse.json({ ok: true, role: session.role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })
  return res
}
