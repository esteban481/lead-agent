import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock Supabase chaînable ──
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
    calls, responses,
    supabase: { from: (t: string) => makeBuilder(t) },
    reset() { calls.length = 0; for (const k of Object.keys(responses)) delete responses[k] },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: h.supabase }))
vi.mock('@/lib/webhook-security', () => ({ verifyResendWebhook: () => ({ valid: true }) }))
vi.mock('@/lib/idempotency', () => ({
  claimWebhook: vi.fn(async () => 'new'),
  releaseWebhook: vi.fn(async () => {}),
}))
vi.mock('@/lib/notify', () => ({ notifyCommercial: vi.fn(async () => {}) }))
vi.mock('@/lib/resend', () => ({ sendEmail: vi.fn(async () => ({ id: 'resend-1' })) }))
vi.mock('@/lib/ai/parse', () => ({ parseLeadMessage: vi.fn(async () => ({})) }))
vi.mock('@/lib/ai/score', () => ({ scoreLead: vi.fn() }))
vi.mock('@/lib/ai/generate', () => ({
  generateQualificationEmail: vi.fn(async () => ({ subject: 'Q', body: 'q' })),
  generateBookingEmail: vi.fn(async () => ({ subject: 'B', body: 'b' })),
  generateDisqualificationEmail: vi.fn(async () => ({ subject: 'D', body: 'd' })),
}))

import { POST } from './route'
import { claimWebhook } from '@/lib/idempotency'
import { notifyCommercial } from '@/lib/notify'
import { scoreLead } from '@/lib/ai/score'

// fetch (récupération du corps Resend) → on force l'échec, parse est mocké de toute façon
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' })))

const LEAD = { id: 'lead-1', client_id: 'client-1', email: 'jean@test.fr', name: 'Jean', status: 'awaiting_reply' }
const CONFIG = {
  from_email: 'leads@test.fr',
  qualification_questions: [{ key: 'surface', label: 'Surface' }, { key: 'budget', label: 'Budget' }],
}
const TO = ['leads+aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa@flenaavios.resend.app']

function inboundReq(over: Record<string, unknown> = {}) {
  const body = {
    type: 'email.received',
    data: {
      email_id: 'evt-1',
      from: 'Jean <jean@test.fr>',
      to: TO,
      subject: 'Re: devis',
      text: 'ma réponse',
      message_id: 'msg-1',
      ...over,
    },
  }
  return new Request('http://x/api/webhook/email-inbound', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<typeof POST>[0]
}

// Lead trouvé par to-address (filtre id), client chargé
function matchedDb(existingAnswers: Array<{ question_key: string; answer: string }>) {
  h.responses.leads = (s) => {
    if (s.op === 'select' && s.filters.some((f) => f.col === 'id')) return { data: LEAD, error: null }
    if (s.op === 'select') return { data: null, error: null }
    return { data: null, error: null } // updates
  }
  h.responses.clients = () => ({ data: { id: 'client-1', config: CONFIG }, error: null })
  h.responses.qualification_answers = (s) =>
    s.op === 'select' ? { data: existingAnswers, error: null } : { data: null, error: null }
  h.responses.scheduled_relances = () => ({ data: null, error: null })
  h.responses.messages = () => ({ data: null, error: null })
}

const outMessage = () =>
  h.calls.find((c) => c.table === 'messages' && c.op === 'insert' && (c.payload as { direction?: string }).direction === 'out')
const leadUpdates = () => h.calls.filter((c) => c.table === 'leads' && c.op === 'update')

beforeEach(() => {
  h.reset()
  vi.clearAllMocks()
})

describe('webhook inbound — garde', () => {
  it('ignore un événement non email.received', async () => {
    const req = new Request('http://x/api/webhook/email-inbound', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.delivered' }),
      headers: { 'content-type': 'application/json' },
    }) as unknown as Parameters<typeof POST>[0]
    const res = await POST(req)
    expect((await res.json()).skipped).toBe(true)
    expect(h.calls.length).toBe(0)
  })

  it('ignore un doublon (idempotence)', async () => {
    ;(claimWebhook as ReturnType<typeof vi.fn>).mockResolvedValueOnce('duplicate')
    const res = await POST(inboundReq())
    expect((await res.json()).duplicate).toBe(true)
    expect(h.calls.length).toBe(0)
  })

  it('matched:false si aucun lead', async () => {
    h.responses.leads = () => ({ data: null, error: null })
    const res = await POST(inboundReq({ to: ['leads@x.fr'], from: 'inconnu@x.fr' }))
    expect((await res.json()).matched).toBe(false)
  })
})

describe('webhook inbound — qualification incomplète', () => {
  it('repose une question et planifie une relance step 1', async () => {
    matchedDb([{ question_key: 'surface', answer: '120m2' }]) // budget manquant
    const res = await POST(inboundReq())
    expect((await res.json()).lead_id).toBe('lead-1')

    expect(outMessage()).toBeDefined() // email de question envoyé + loggé
    const rel = h.calls.find((c) => c.table === 'scheduled_relances' && c.op === 'insert')
    expect((rel?.payload as { step: number }).step).toBe(1)
    expect(scoreLead).not.toHaveBeenCalled() // pas de scoring tant qu'incomplet
  })
})

describe('webhook inbound — qualification complète', () => {
  const fullAnswers = [
    { question_key: 'surface', answer: '120m2' },
    { question_key: 'budget', answer: '20k' },
  ]

  it('lead chaud (A) → score, booking, alerte commercial', async () => {
    matchedDb(fullAnswers)
    ;(scoreLead as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      score: 82, category: 'A', details: {}, summary: 'Bon projet', missing_fields: [],
    })
    const res = await POST(inboundReq())
    expect((await res.json()).lead_id).toBe('lead-1')

    // un update applique le score + statut awaiting_reply
    const scored = leadUpdates().find((c) => (c.payload as { score?: number }).score === 82)
    expect(scored).toBeDefined()
    expect((scored?.payload as { status: string }).status).toBe('awaiting_reply')

    expect(outMessage()).toBeDefined() // email de booking
    expect(notifyCommercial).toHaveBeenCalledOnce() // alerte lead chaud
  })

  it('lead hors cible (D) → disqualification, pas d alerte', async () => {
    matchedDb(fullAnswers)
    ;(scoreLead as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      score: 10, category: 'D', details: {}, summary: 'Hors zone', missing_fields: [],
    })
    await POST(inboundReq())

    const disq = leadUpdates().find((c) => (c.payload as { status?: string }).status === 'disqualified')
    expect(disq).toBeDefined()
    expect(notifyCommercial).not.toHaveBeenCalled()
  })
})
