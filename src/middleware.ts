import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

// ============================================================
// Garde d'accès au dashboard + APIs de lecture (multi-tenant).
//
// Vérifie le cookie de session signé (posé au login). Si absent
// ou invalide :
//   - page  → redirige vers /login?next=...
//   - API   → 401 JSON
//
// Si valide, injecte x-role / x-client-id sur la requête transmise
// (après avoir supprimé toute valeur entrante, pour qu'un client
// ne puisse pas usurper le scope d'un autre). Les server components
// et les API lisent ces en-têtes via getPrincipal() / req.headers.
//
// Les webhooks et le cron ne passent pas par ici (voir matcher) :
// ils ont leur propre vérification (signature, CRON_SECRET).
// /login et /api/auth/* sont hors matcher → publics.
// ============================================================

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const secret = process.env.SESSION_SECRET

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = secret ? await verifySession(token, secret) : null

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Espaces réservés à l'admin (gestion des clients)
  const isAdminPath = pathname === '/clients' ||
    pathname.startsWith('/clients/') ||
    pathname.startsWith('/api/clients')
  if (isAdminPath && session.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/', req.url))
  }

  // En-têtes de confiance : on efface toute valeur entrante avant de poser la nôtre
  const headers = new Headers(req.headers)
  headers.delete('x-role')
  headers.delete('x-client-id')
  headers.set('x-role', session.role)
  if (session.client_id) headers.set('x-client-id', session.client_id)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    '/',
    '/leads/:path*',
    '/clients',
    '/clients/:path*',
    '/api/leads/:path*',
    '/api/stats',
    '/api/clients/:path*',
  ],
}
