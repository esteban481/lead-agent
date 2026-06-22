// ============================================================
// Session signée (mini-JWT maison) — HMAC-SHA256 via Web Crypto.
// Fonctionne en runtime Node (API routes) ET Edge (middleware).
//
// Token = base64url(payload) + "." + base64url(HMAC(payload)).
// La signature empêche un client de forger/altérer son rôle ou
// son client_id. Validée à chaque requête par le middleware,
// sans aucun accès DB (le login a déjà fait la vérification).
// ============================================================

import { timingSafeEqualHex } from '@/lib/password'

export const SESSION_COOKIE = 'la_session'
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 jours

export interface SessionPayload {
  role: 'admin' | 'client'
  client_id: string | null // null pour l'admin (voit tout)
  exp: number // timestamp unix (secondes)
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToString(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return atob(b64)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data) as BufferSource)
  return bytesToHex(new Uint8Array(sig))
}

export async function createSession(
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = bytesToBase64url(new TextEncoder().encode(JSON.stringify(full)))
  const sig = await hmacHex(body, secret)
  return `${body}.${bytesToBase64url(hexToBytes(sig))}`
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

// Retourne le payload si la signature est valide ET non expiré, sinon null.
export async function verifySession(
  token: string | undefined,
  secret: string
): Promise<SessionPayload | null> {
  if (!token || !secret) return null
  const dot = token.indexOf('.')
  if (dot === -1) return null

  const body = token.slice(0, dot)
  const providedSigB64 = token.slice(dot + 1)

  const expectedSig = await hmacHex(body, secret)
  // Reconstruit la signature attendue dans le même encodage que le token
  const expectedSigB64 = bytesToBase64url(hexToBytes(expectedSig))
  if (!timingSafeEqualHex(toHex(providedSigB64), toHex(expectedSigB64))) return null

  try {
    const payload = JSON.parse(base64urlToString(body)) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

// Compare deux chaînes base64url à temps constant en les passant en hex
// (timingSafeEqualHex attend des chaînes de longueur égale et caractères stables).
function toHex(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0')
  return out
}
