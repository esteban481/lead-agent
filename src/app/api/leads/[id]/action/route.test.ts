import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: Array<{ table: string; op: string; payload?: unknown; filters: Array<{ col: string; val: unknown }> }> = []
  const responses: Record<string, (s: { op: string; filters: Array<{ col: string; val: unknown }> }) => unknown> = {}
  function makeBuilder(table: string) {
    const state = { table, op: 'select', filters: [] as Array<{ col: string; val: unknown }>, payload: undefined as unknown, single: false }
    const api: Record<string, (...args: unknown[]) => unknown> = {}
    api.select = () => api
    api.insert = (p: unknown) => { state.op = 'insert'; state.payload = p; return api }
    api.update = (p: unknown) => { state.op = 'update'; state.payload = p; return api }
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

import { POST } from './route'

const LEAD = { id: 'lead-1', client_id: 'client-1', status: 'awaiting_reply' }

function actionReq(body: unknown, clientHeader?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (clientHeader) headers['x-client-id'] = clientHeader
  return new Request('http://x/api/leads/lead-1/action', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  }) as unknown as Parameters<typeof POST>[0]
}
const ctx = { params: Promise.resolve({ id: 'lead-1' }) }
const leadUpdate = () => h.calls.find((c) => c.table === 'leads' && c.op === 'update')

function leadFound() {
  h.responses.leads = (s) => (s.op === 'select' ? { data: LEAD, error: null } : { data: null, error: null })
  h.responses.scheduled_relances = () => ({ data: null, error: null })
}

beforeEach(() => {
  h.reset()
  vi.clearAllMocks()
})

describe('action lead — gardes', () => {
  it('400 action inconnue', async () => {
    const res = await POST(actionReq({ action: 'explode' }), ctx)
    expect(res.status).toBe(400)
  })

  it('404 si lead introuvable', async () => {
    h.responses.leads = () => ({ data: null, error: null })
    const res = await POST(actionReq({ action: 'book' }), ctx)
    expect(res.status).toBe(404)
  })

  it('403 si le client agit sur un lead d un autre (anti-IDOR)', async () => {
    leadFound()
    const res = await POST(actionReq({ action: 'book' }, 'autre-client'), ctx)
    expect(res.status).toBe(403)
    expect(leadUpdate()).toBeUndefined() // aucune mutation
  })

  it('admin (sans x-client-id) peut agir sur n importe quel lead', async () => {
    leadFound()
    const res = await POST(actionReq({ action: 'book' }), ctx)
    expect(res.status).toBe(200)
  })
})

describe('action lead — mutations', () => {
  it('book : passe en booked, fixe le RDV et annule les relances', async () => {
    leadFound()
    await POST(actionReq({ action: 'book' }, 'client-1'), ctx)
    const upd = leadUpdate()
    expect((upd?.payload as { status: string }).status).toBe('booked')
    expect((upd?.payload as { meeting_booked_at: string }).meeting_booked_at).toBeTruthy()
    const rel = h.calls.find((c) => c.table === 'scheduled_relances' && c.op === 'update')
    expect((rel?.payload as { status: string }).status).toBe('cancelled')
  })

  it('disqualify : enregistre la raison fournie', async () => {
    leadFound()
    await POST(actionReq({ action: 'disqualify', reason: 'Hors zone' }, 'client-1'), ctx)
    const upd = leadUpdate()
    expect(upd?.payload).toMatchObject({ status: 'disqualified', disqualified_reason: 'Hors zone' })
  })

  it('disqualify : raison par défaut si non fournie', async () => {
    leadFound()
    await POST(actionReq({ action: 'disqualify' }, 'client-1'), ctx)
    expect((leadUpdate()?.payload as { disqualified_reason: string }).disqualified_reason).toBe('Disqualifié manuellement')
  })

  it('reopen : rouvre et efface RDV + raison', async () => {
    leadFound()
    await POST(actionReq({ action: 'reopen' }, 'client-1'), ctx)
    expect(leadUpdate()?.payload).toMatchObject({
      status: 'awaiting_reply',
      meeting_booked_at: null,
      disqualified_reason: null,
    })
  })
})
