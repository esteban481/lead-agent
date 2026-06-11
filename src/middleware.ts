import { NextRequest, NextResponse } from 'next/server'

// ============================================================
// Basic Auth sur le dashboard et les APIs de lecture.
// Les webhooks et le cron ont leur propre mécanisme (signature,
// CRON_SECRET) et ne passent pas par ici (voir matcher).
//
// Si DASHBOARD_PASSWORD n'est pas configuré, l'accès reste
// ouvert (avec warning) pour ne pas casser un déploiement
// existant — à configurer dans Vercel dès que possible.
// ============================================================

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    console.warn('[middleware] DASHBOARD_PASSWORD non configuré — dashboard ouvert')
    return NextResponse.next()
  }

  const expectedUser = process.env.DASHBOARD_USER ?? 'admin'
  const authHeader = req.headers.get('authorization')

  if (authHeader?.startsWith('Basic ')) {
    try {
      const [user, pass] = atob(authHeader.slice(6)).split(':')
      if (user === expectedUser && pass === password) {
        return NextResponse.next()
      }
    } catch {
      // header malformé → 401 ci-dessous
    }
  }

  return new NextResponse('Authentification requise', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Lead Agent Dashboard"' },
  })
}

export const config = {
  matcher: ['/', '/leads/:path*', '/api/leads/:path*', '/api/stats'],
}
