import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client Supabase : on contrôle ce que renvoie .insert()
const insertMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: insertMock,
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}))

import { claimWebhook } from './idempotency'

describe('claimWebhook', () => {
  beforeEach(() => insertMock.mockReset())

  it('retourne "new" quand l insert réussit', async () => {
    insertMock.mockResolvedValue({ error: null })
    expect(await claimWebhook('resend_inbound', 'evt_1')).toBe('new')
  })

  it('retourne "duplicate" sur violation de contrainte unique (23505)', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
    expect(await claimWebhook('cal', 'booking_1')).toBe('duplicate')
  })

  it('retourne "unavailable" si la table est absente (42P01) — dégradation gracieuse', async () => {
    insertMock.mockResolvedValue({ error: { code: '42P01', message: 'relation does not exist' } })
    expect(await claimWebhook('resend_inbound', 'evt_2')).toBe('unavailable')
  })

  it('retourne "unavailable" sans event_id (rien à dédupliquer)', async () => {
    expect(await claimWebhook('cal', '')).toBe('unavailable')
    expect(insertMock).not.toHaveBeenCalled()
  })
})
