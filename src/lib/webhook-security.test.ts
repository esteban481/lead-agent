import { describe, it, expect, afterEach, vi } from 'vitest'
import { createHmac, randomBytes } from 'crypto'
import { verifyResendWebhook, verifyCalWebhook } from './webhook-security'

afterEach(() => {
  vi.unstubAllEnvs()
})

// ============================================================
// Resend (Svix)
// ============================================================
describe('verifyResendWebhook', () => {
  const secretBytes = randomBytes(24)
  const secret = `whsec_${secretBytes.toString('base64')}`
  const body = '{"type":"email.received","data":{}}'

  function signedHeaders(overrides: Record<string, string> = {}): Headers {
    const id = 'msg_test123'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac('sha256', secretBytes)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64')
    return new Headers({
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
      ...overrides,
    })
  }

  it('accepte une signature valide', () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
    expect(verifyResendWebhook(body, signedHeaders()).valid).toBe(true)
  })

  it('rejette un body altéré', () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
    const result = verifyResendWebhook('{"type":"forged"}', signedHeaders())
    expect(result.valid).toBe(false)
  })

  it('rejette une signature invalide', () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
    const headers = signedHeaders({ 'svix-signature': 'v1,AAAAinvalideAAAA=' })
    expect(verifyResendWebhook(body, headers).valid).toBe(false)
  })

  it('rejette un timestamp trop ancien (anti-replay)', () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
    const old = (Math.floor(Date.now() / 1000) - 3600).toString()
    const headers = signedHeaders({ 'svix-timestamp': old })
    expect(verifyResendWebhook(body, headers).valid).toBe(false)
  })

  it('rejette si les headers svix sont absents', () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret)
    expect(verifyResendWebhook(body, new Headers()).valid).toBe(false)
  })

  it('accepte tout si le secret n est pas configuré (déploiement progressif)', () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    expect(verifyResendWebhook(body, new Headers()).valid).toBe(true)
  })
})

// ============================================================
// Cal.com
// ============================================================
describe('verifyCalWebhook', () => {
  const secret = 'cal-secret-test'
  const body = '{"triggerEvent":"BOOKING_CREATED","payload":{}}'

  function sign(payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex')
  }

  it('accepte une signature valide', () => {
    vi.stubEnv('CAL_WEBHOOK_SECRET', secret)
    const headers = new Headers({ 'x-cal-signature-256': sign(body) })
    expect(verifyCalWebhook(body, headers).valid).toBe(true)
  })

  it('rejette un body altéré', () => {
    vi.stubEnv('CAL_WEBHOOK_SECRET', secret)
    const headers = new Headers({ 'x-cal-signature-256': sign(body) })
    expect(verifyCalWebhook('{"triggerEvent":"forged"}', headers).valid).toBe(false)
  })

  it('rejette si le header est absent', () => {
    vi.stubEnv('CAL_WEBHOOK_SECRET', secret)
    expect(verifyCalWebhook(body, new Headers()).valid).toBe(false)
  })

  it('accepte tout si le secret n est pas configuré (déploiement progressif)', () => {
    delete process.env.CAL_WEBHOOK_SECRET
    expect(verifyCalWebhook(body, new Headers()).valid).toBe(true)
  })
})
