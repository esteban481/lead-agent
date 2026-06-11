import { createHmac, timingSafeEqual } from 'crypto'

// ============================================================
// Vérification des signatures de webhooks entrants.
// Si le secret n'est pas configuré (env manquante), on accepte
// la requête avec un warning — permet un déploiement progressif
// sans casser la prod. Une fois le secret en place sur Vercel,
// toute requête non signée est rejetée.
// ============================================================

const SVIX_TOLERANCE_SECONDS = 5 * 60 // fenêtre anti-replay

// Resend signe ses webhooks via Svix.
// Doc : https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
// signature attendue = base64(HMAC-SHA256(base64decode(secret), "{id}.{timestamp}.{body}"))
export function verifyResendWebhook(
  rawBody: string,
  headers: Headers
): { valid: boolean; reason?: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[webhook-security] RESEND_WEBHOOK_SECRET non configuré — vérification ignorée')
    return { valid: true }
  }

  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: 'Headers svix manquants' }
  }

  // Anti-replay : timestamp trop ancien ou trop futur
  const timestamp = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (isNaN(timestamp) || Math.abs(now - timestamp) > SVIX_TOLERANCE_SECONDS) {
    return { valid: false, reason: 'Timestamp svix hors tolérance' }
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64')

  // Le header peut contenir plusieurs signatures : "v1,xxx v1,yyy"
  const candidates = svixSignature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean)

  const isValid = candidates.some((candidate) => safeCompare(candidate, expected))
  return isValid ? { valid: true } : { valid: false, reason: 'Signature svix invalide' }
}

// Cal.com signe le payload en HMAC-SHA256 hex dans le header x-cal-signature-256.
// Doc : https://cal.com/docs/developing/guides/automation/webhooks
export function verifyCalWebhook(
  rawBody: string,
  headers: Headers
): { valid: boolean; reason?: string } {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[webhook-security] CAL_WEBHOOK_SECRET non configuré — vérification ignorée')
    return { valid: true }
  }

  const signature = headers.get('x-cal-signature-256')
  if (!signature) {
    return { valid: false, reason: 'Header x-cal-signature-256 manquant' }
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeCompare(signature, expected)
    ? { valid: true }
    : { valid: false, reason: 'Signature Cal.com invalide' }
}

// Comparaison à temps constant pour éviter les timing attacks
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
