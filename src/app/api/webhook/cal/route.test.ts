import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock Supabase : builder chaînable qui enregistre les opérations ──
const h = vi.hoisted(() => {
  const calls: Array<{ table: string; op: string; payload?: unknown; filters: Array<{ col: string; val: unknown }> }> = []
  const responses: Record<string, (s: { op: string; filters: Array<{ col: string; val: unknown }> }) => unknown> = {}

  function makeBuilder(table: string) {
    const state = { table, op: 'select', filters: [] as Array<{ col: string; val: unknown }>, payload: undefined as unknown, single: false }
    const api: Record<string, (...args: unknown[]) => unknown> = {}
    api.select = () => api
    api.insert = (p: unknown) => { state.op = 'insert'; state.payload = p; return api }
    api.update = (p: unknown) => { state.op = 'update'; state.payload = p; return api }
    api.delete = () => { state.op = 'delete'; return api }
    api.eq = (col: unknown, val: unknown) => { state.filters.push({ col: col as string, val }); return api }
    for (const m of ['gte', 'lte', 'in', 'or', 'order', 'limit', 'range']) api[m] = () => api
    api.single = () => { state.single = true; return api }
    api.maybeSingle = () => { state.single = true; return api }
    api.then = ((res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const fn = responses[table]
      const out = fn ? fn(state) : { data: state.single ? null : [], error: null }
      calls.push({ table, op: state.op, payload: state.payload, filters: state.filters })
      return Promise.resolve(out).then(res, rej)
    }) as unknown as (...args: unknown[]) => unknown
    return api
  }

  return {
    calls,
    responses,
    supabase: { from: (t: string) => makeBuilder(t) },
    reset() {
      calls.length = 0
      for (const k of Object.keys(responses)) delete responses[k]
    },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: h.supabase }))
vi.mock('@/lib/webhook-security', () => ({ verifyCalWebhook: () => ({ valid: true }) }))
vi.mock('@/lib/idempotency', () => ({
  claimWebhook: vi.fn(async () => 'new'),
  releaseWebhook: vi.fn(async () => {}),
}))
vi.mock('@/lib/notify', () => ({ notifyCommercial: vi.fn(async () => {}) }))

import { POST } from './route'
import { claimWebhook } from '@/lib/idempotency'
import { notifyCommercial } from '@/lib/notify'

const LEAD = {
  id: 'lead-1',
  client_id: 'client-1',
  name: 'Jean',
  email: 'jean@test.fr',
  status: 'awaiting_reply',
}

function calReq(body: unknown) {
  return new Request('http://x/api/webhook/cal', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<typeof POST>[0]
}

// Résolveur leads par défaut : pas de match par uid, match par email
function leadsByEmail() {
  h.responses.leads = (s) => {
    if (s.op === 'select') {
      if (s.filters.some((f) => f.col === 'cal_booking_id')) return { data: null, error: null }
      if (s.filters.some((f) => f.col === 'email')) return { data: LEAD, error: null }
    }
    return { data: null, error: null }
  }
  h.responses.clients = () => ({ data: { config: {} }, error: null })
  h.responses.scheduled_relances = () => ({ data: null, error: null })
}

function leadUpdate() {
  return h.calls.find((c) => c.table === 'leads' && c.op === 'update')
}

beforeEach(() => {
  h.reset()
  vi.clearAllMocks()
})

describe('webhook Cal — routage des événements', () => {
  it('ignore un événement non géré', async () => {
    const res = await POST(calReq({ triggerEvent: 'MEETING_ENDED', payload: {} }))
    expect((await res.json()).skipped).toBe(true)
    expect(h.calls.length).toBe(0)
  })

  it('400 si ni email ni uid', async () => {
    const res = await POST(calReq({ triggerEvent: 'BOOKING_CREATED', payload: { attendees: [] } }))
    expect(res.status).toBe(400)
  })

  it('ignore un doublon (idempotence)', async () => {
    ;(claimWebhook as ReturnType<typeof vi.fn>).mockResolvedValueOnce('duplicate')
    const res = await POST(calReq({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'b1', attendees: [{ email: 'jean@test.fr' }] } }))
    expect((await res.json()).duplicate).toBe(true)
    expect(h.calls.length).toBe(0) // pas de requête DB
  })

  it('matched:false si aucun lead', async () => {
    h.responses.leads = () => ({ data: null, error: null })
    const res = await POST(calReq({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'b1', attendees: [{ email: 'inconnu@test.fr' }] } }))
    expect((await res.json()).matched).toBe(false)
  })
})

describe('webhook Cal — BOOKING_CREATED', () => {
  it('passe le lead en booked, stocke le uid, annule les relances et alerte', async () => {
    leadsByEmail()
    const res = await POST(calReq({
      triggerEvent: 'BOOKING_CREATED',
      payload: { uid: 'booking-9', startTime: '2026-07-01T10:00:00Z', attendees: [{ email: 'jean@test.fr' }] },
    }))
    const json = await res.json()
    expect(json.event).toBe('BOOKING_CREATED')

    const upd = leadUpdate()
    expect(upd?.payload).toMatchObject({ status: 'booked', cal_booking_id: 'booking-9' })
    expect((upd?.payload as { meeting_booked_at: string }).meeting_booked_at).toBe('2026-07-01T10:00:00Z')

    // relances annulées
    const relUpd = h.calls.find((c) => c.table === 'scheduled_relances' && c.op === 'update')
    expect((relUpd?.payload as { status: string }).status).toBe('cancelled')

    // alerte commercial "confirmé"
    expect(notifyCommercial).toHaveBeenCalledOnce()
    expect((notifyCommercial as ReturnType<typeof vi.fn>).mock.calls[0][2]).toContain('confirmé')
  })
})

describe('webhook Cal — BOOKING_CANCELLED', () => {
  it('rouvre le lead (awaiting_reply), efface le RDV, sans annuler de relances', async () => {
    leadsByEmail()
    const res = await POST(calReq({
      triggerEvent: 'BOOKING_CANCELLED',
      payload: { uid: 'booking-9', attendees: [{ email: 'jean@test.fr' }] },
    }))
    expect((await res.json()).event).toBe('BOOKING_CANCELLED')

    const upd = leadUpdate()
    expect(upd?.payload).toMatchObject({ status: 'awaiting_reply', meeting_booked_at: null })

    // pas de mutation des relances sur une annulation
    expect(h.calls.some((c) => c.table === 'scheduled_relances')).toBe(false)
    expect((notifyCommercial as ReturnType<typeof vi.fn>).mock.calls[0][2]).toContain('annulé')
  })
})

describe('webhook Cal — BOOKING_RESCHEDULED', () => {
  it('met à jour la date du RDV, garde booked', async () => {
    leadsByEmail()
    const res = await POST(calReq({
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: { uid: 'booking-9', startTime: '2026-08-15T14:00:00Z', attendees: [{ email: 'jean@test.fr' }] },
    }))
    expect((await res.json()).event).toBe('BOOKING_RESCHEDULED')

    const upd = leadUpdate()
    expect(upd?.payload).toMatchObject({ status: 'booked' })
    expect((upd?.payload as { meeting_booked_at: string }).meeting_booked_at).toBe('2026-08-15T14:00:00Z')
    expect((notifyCommercial as ReturnType<typeof vi.fn>).mock.calls[0][2]).toContain('déplacé')
  })
})

describe('webhook Cal — matching par uid', () => {
  it('retrouve le lead par cal_booking_id même sans email', async () => {
    h.responses.leads = (s) => {
      if (s.op === 'select' && s.filters.some((f) => f.col === 'cal_booking_id')) return { data: LEAD, error: null }
      return { data: null, error: null }
    }
    h.responses.clients = () => ({ data: { config: {} }, error: null })
    const res = await POST(calReq({ triggerEvent: 'BOOKING_CANCELLED', payload: { uid: 'booking-9' } }))
    expect((await res.json()).lead_id).toBe('lead-1')
  })
})
