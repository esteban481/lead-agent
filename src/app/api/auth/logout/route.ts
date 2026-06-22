import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

// POST /api/auth/logout — efface le cookie de session et renvoie au login.
export async function POST(req: Request) {
  const url = new URL('/login', req.url)
  const res = NextResponse.redirect(url, { status: 303 })
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
