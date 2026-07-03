import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock Supabase chaînable (enregistre les opérations) ──
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
vi.mock('@/lib/resend', () => ({ sendEmail: vi.fn(async () => ({ id: 'resend-1' })) }))
vi.mock('@/lib/ai/parse', () => ({ parseLeadMessage: vi.fn(async () => ({})) }))
vi.mock('@/lib/ai/generate', () => ({
  generateQualificationEmail: vi.fn(async () => ({ subject: 'Sujet', body: 'Corps' })),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'
import { sendEmail } from '@/lib/resend'
import { parseLeadMessage } from '@/lib/ai/parse'

const CLIENT = { id: 'client-1', config: { from_email: 'leads@test.fr' } }

function formReq(payload: unknown, clientId = 'client-1') {
  const url = clientId
    ? `http://x/api/webhook/form?client_id=${clientId}`
    : 'http://x/api/webhook/form'
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  })
}

// Réponses : client trouvé, pas de doublon, insert renvoie un lead
function happyDb() {
  h.responses.clients = () => ({ data: CLIENT, error: null })
  h.responses.leads = (s) => {
    if (s.op === 'insert') return { data: { id: 'lead-1', client_id: 'client-1', config: CLIENT.config }, error: null }
    if (s.op === 'select') return { data: null, error: null } // pas de doublon
    return { data: null, error: null } // update
  }
}

const find = (table: string, op: string) => h.calls.find((c) => c.table === table && c.op === op)

beforeEach(() => {
  h.reset()
  vi.clearAllMocks()
})

describe('webhook form — garde', () => {
  it('400 sans client_id', async () => {
    const res = await POST(formReq({ email: 'a@b.fr' }, ''))
    expect(res.status).toBe(400)
  })

  it('404 si client introuvable', async () => {
    h.responses.clients = () => ({ data: null, error: { message: 'not found' } })
    const res = await POST(formReq({ email: 'a@b.fr' }))
    expect(res.status).toBe(404)
  })
})

describe('webhook form — déduplication', () => {
  it('met à jour et sort sans créer de lead si doublon récent', async () => {
    h.responses.clients = () => ({ data: CLIENT, error: null })
    h.responses.leads = (s) => {
      if (s.op === 'select') return { data: { id: 'existing-1', status: 'awaiting_reply' }, error: null }
      return { data: null, error: null }
    }
    const res = await POST(formReq({ email: 'jean@test.fr' }))
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(json.lead_id).toBe('existing-1')
    expect(find('leads', 'insert')).toBeUndefined() // aucun lead créé
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('webhook form — création', () => {
  it('crée le lead, envoie l email, log, planifie 3 relances', async () => {
    happyDb()
    const res = await POST(formReq({ email: 'jean@test.fr', name: 'Jean', message: 'Bonjour' }))
    const json = await res.json()
    expect(json.lead_id).toBe('lead-1')

    expect(find('leads', 'insert')).toBeDefined()
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(find('messages', 'insert')).toBeDefined()

    // statut → awaiting_reply
    const leadUpd = h.calls.find((c) => c.table === 'leads' && c.op === 'update')
    expect((leadUpd?.payload as { status: string }).status).toBe('awaiting_reply')

    // 3 relances planifiées
    const rel = find('scheduled_relances', 'insert')
    expect((rel?.payload as unknown[]).length).toBe(3)
  })

  it('sauvegarde les réponses extraites par le parsing', async () => {
    happyDb()
    ;(parseLeadMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ surface: '120m2' })
    await POST(formReq({ email: 'jean@test.fr', message: '120m2' }))
    expect(find('qualification_answers', 'insert')).toBeDefined()
  })

  it('sans email : crée le lead mais n envoie rien et ne planifie pas de relance', async () => {
    happyDb()
    const res = await POST(formReq({ name: 'Anonyme', message: 'coucou' }))
    expect((await res.json()).lead_id).toBe('lead-1')
    expect(find('leads', 'insert')).toBeDefined()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(find('scheduled_relances', 'insert')).toBeUndefined()
  })
})

describe('webhook form — durcissement', () => {
  it('400 sur JSON invalide', async () => {
    const req = new NextRequest('http://x/api/webhook/form?client_id=client-json', {
      method: 'POST',
      body: '{pas du json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('413 si le corps est trop volumineux', async () => {
    const res = await POST(formReq({ email: 'a@b.fr', message: 'x'.repeat(60_000) }, 'client-big'))
    expect(res.status).toBe(413)
  })

  it('honeypot rempli → lead ignoré silencieusement (200, pas d insert)', async () => {
    h.responses.clients = () => ({ data: { id: 'client-1', config: { from_email: 'x@y.fr', honeypot_field: 'website' } }, error: null })
    h.responses.leads = () => ({ data: null, error: null })
    const res = await POST(formReq({ email: 'jean@test.fr', website: 'http://spam' }, 'client-hp'))
    expect((await res.json()).ignored).toBe(true)
    expect(find('leads', 'insert')).toBeUndefined()
  })

  it('429 au-delà de la limite (même client/IP)', async () => {
    happyDb()
    let last = 200
    for (let i = 0; i < 11; i++) {
      const res = await POST(formReq({ email: `x${i}@t.fr`, message: 'hi' }, 'client-rate'))
      last = res.status
    }
    expect(last).toBe(429)
  })
})
