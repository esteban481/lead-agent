import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildReplyTo } from './email-utils'

const LEAD_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('buildReplyTo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encode le lead ID en plus-addressing sur RESEND_INBOUND_EMAIL', () => {
    vi.stubEnv('RESEND_INBOUND_EMAIL', 'leads@flenaavios.resend.app')
    expect(buildReplyTo(LEAD_ID)).toBe(`leads+${LEAD_ID}@flenaavios.resend.app`)
  })

  it('retombe sur leads@leadqualifie.fr si la variable est absente', () => {
    vi.stubEnv('RESEND_INBOUND_EMAIL', '')
    // stubEnv('', ...) laisse une chaîne vide → on force undefined
    delete process.env.RESEND_INBOUND_EMAIL
    expect(buildReplyTo(LEAD_ID)).toBe(`leads+${LEAD_ID}@leadqualifie.fr`)
  })

  it('produit une adresse que la regex du webhook inbound sait re-parser', () => {
    vi.stubEnv('RESEND_INBOUND_EMAIL', 'leads@flenaavios.resend.app')
    const address = buildReplyTo(LEAD_ID)
    // même regex que dans /api/webhook/email-inbound
    const extracted = address.match(/\+([0-9a-f-]{36})@/i)?.[1]
    expect(extracted).toBe(LEAD_ID)
  })
})
