import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = []
  const responses: Record<string, (s: { op: string }) => unknown> = {}
  function makeBuilder(table: string) {
    const state = { table, op: 'select', payload: undefined as unknown, single: false }
    const api: Record<string, (...args: unknown[]) => unknown> = {}
    api.select = () => api
    api.insert = (p: unknown) => { state.op = 'insert'; state.payload = p; return api }
    api.update = (p: unknown) => { state.op = 'update'; state.payload = p; return api }
    api.eq = () => api
    for (const m of ['order', 'limit']) api[m] = () => api
    api.single = () => { state.single = true; return api }
    api.maybeSingle = () => { state.single = true; return api }
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

import { POST } from './route'
import { PATCH } from './[id]/route'
import { POST as LOGIN } from './[id]/login/route'
import { DEFAULT_CLIENT_CONFIG } from '@/lib/client-config'

function req(body: unknown) {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never
}
const ctx = { params: Promise.resolve({ id: 'client-1' }) }

beforeEach(() => {
  h.reset()
  vi.clearAllMocks()
})

describe('POST /api/clients — création', () => {
  it('400 sans nom/secteur', async () => {
    const res = await POST(req({ config: DEFAULT_CLIENT_CONFIG }))
    expect(res.status).toBe(400)
  })

  it('400 config invalide (avec détails)', async () => {
    const res = await POST(req({ name: 'Acme', sector: 'pac', config: { zone: 'pas un tableau' } }))
    expect(res.status).toBe(400)
    expect((await res.json()).details.length).toBeGreaterThan(0)
  })

  it('crée le client si tout est valide', async () => {
    h.responses.clients = () => ({ data: { id: 'new-1' }, error: null })
    const res = await POST(req({ name: 'Acme', sector: 'pac', config: DEFAULT_CLIENT_CONFIG }))
    expect((await res.json()).id).toBe('new-1')
    expect(h.calls.find((c) => c.table === 'clients' && c.op === 'insert')).toBeDefined()
  })
})

describe('PATCH /api/clients/[id] — édition', () => {
  it('400 si rien à mettre à jour', async () => {
    const res = await PATCH(req({}), ctx)
    expect(res.status).toBe(400)
  })

  it('400 config invalide', async () => {
    const res = await PATCH(req({ config: { zone: 123 } }), ctx)
    expect(res.status).toBe(400)
  })

  it('met à jour la config valide', async () => {
    h.responses.clients = () => ({ error: null })
    const res = await PATCH(req({ config: DEFAULT_CLIENT_CONFIG }), ctx)
    expect(res.status).toBe(200)
    const upd = h.calls.find((c) => c.table === 'clients' && c.op === 'update')
    expect(upd?.payload).toHaveProperty('config')
  })
})

describe('POST /api/clients/[id]/login — provisioning', () => {
  it('400 mot de passe trop court', async () => {
    const res = await LOGIN(req({ email: 'a@b.fr', password: 'court' }), ctx)
    expect(res.status).toBe(400)
  })

  it('409 si colonnes de login absentes (migration manquante)', async () => {
    h.responses.clients = () => ({ error: { code: '42703', message: 'column does not exist' } })
    const res = await LOGIN(req({ email: 'a@b.fr', password: 'motdepasse123' }), ctx)
    expect(res.status).toBe(409)
  })

  it('enregistre le login (hash) si tout est ok', async () => {
    h.responses.clients = () => ({ error: null })
    const res = await LOGIN(req({ email: 'Client@Acme.FR', password: 'motdepasse123' }), ctx)
    expect(res.status).toBe(200)
    const upd = h.calls.find((c) => c.table === 'clients' && c.op === 'update')
    const payload = upd?.payload as { login_email: string; login_password_hash: string; login_password_salt: string }
    expect(payload.login_email).toBe('client@acme.fr') // normalisé
    expect(payload.login_password_hash).toMatch(/^[0-9a-f]{64}$/) // hash PBKDF2 hex
    expect(payload.login_password_salt).toBeTruthy()
  })
})
