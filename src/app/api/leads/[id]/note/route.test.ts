import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = []
  const responses: Record<string, (s: { op: string }) => unknown> = {}
  function makeBuilder(table: string) {
    const state = { table, op: 'select', payload: undefined as unknown, single: false }
    const api: Record<string, (...args: unknown[]) => unknown> = {}
    api.select = () => api
    api.update = (p: unknown) => { state.op = 'update'; state.payload = p; return api }
    api.insert = (p: unknown) => { state.op = 'insert'; state.payload = p; return api }
    api.eq = () => api
    api.maybeSingle = () => { state.single = true; return api }
    api.single = () => { state.single = true; return api }
    api.then = ((res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const fn = responses[table]
      const out = fn ? fn(state) : { data: state.single ? null : [], error: null }
      calls.push({ table, op: state.op, payload: state.payload })
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

import { PATCH } from './route'

const LEAD = { id: 'lead-1', client_id: 'client-1' }
const ctx = { params: Promise.resolve({ id: 'lead-1' }) }

function req(body: unknown, clientHeader?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (clientHeader) headers['x-client-id'] = clientHeader
  return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body), headers }) as never
}

function leadFound() {
  h.responses.leads = (s) => (s.op === 'select' ? { data: LEAD, error: null } : { data: null, error: null })
}

beforeEach(() => {
  h.reset()
  vi.clearAllMocks()
})

describe('PATCH /api/leads/[id]/note', () => {
  it('400 sans champ notes', async () => {
    const res = await PATCH(req({}), ctx)
    expect(res.status).toBe(400)
  })

  it('404 lead introuvable', async () => {
    h.responses.leads = () => ({ data: null, error: null })
    const res = await PATCH(req({ notes: 'x' }), ctx)
    expect(res.status).toBe(404)
  })

  it('403 anti-IDOR (client sur le lead d un autre)', async () => {
    leadFound()
    const res = await PATCH(req({ notes: 'x' }, 'autre-client'), ctx)
    expect(res.status).toBe(403)
    expect(h.calls.find((c) => c.op === 'update')).toBeUndefined()
  })

  it('enregistre la note (et le vide est permis = effacer)', async () => {
    leadFound()
    const res = await PATCH(req({ notes: 'Rappelé le 12, très motivé.' }, 'client-1'), ctx)
    expect(res.status).toBe(200)
    const upd = h.calls.find((c) => c.op === 'update')
    expect(upd?.payload).toEqual({ notes: 'Rappelé le 12, très motivé.' })

    const res2 = await PATCH(req({ notes: '' }, 'client-1'), ctx)
    expect(res2.status).toBe(200)
  })

  it('tronque à 5000 caractères', async () => {
    leadFound()
    await PATCH(req({ notes: 'x'.repeat(9000) }, 'client-1'), ctx)
    const upd = h.calls.find((c) => c.op === 'update')
    expect((upd?.payload as { notes: string }).notes.length).toBe(5000)
  })
})
