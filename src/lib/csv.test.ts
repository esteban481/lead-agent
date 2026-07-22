import { describe, it, expect } from 'vitest'
import { toCsv, leadsToCsv } from './csv'
import type { Lead } from '@/types'

function lead(over: Partial<Lead>): Lead {
  return {
    id: 'x',
    client_id: 'c',
    name: null,
    email: null,
    phone: null,
    source: 'website_form',
    raw_data: {},
    status: 'new',
    score: null,
    score_category: null,
    score_details: null,
    ai_summary: null,
    disqualified_reason: null,
    meeting_booked_at: null,
    cal_booking_id: null,
    email_thread_id: null,
    notes: null,
    last_error: null,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    ...over,
  }
}

describe('toCsv', () => {
  it('commence par un BOM UTF-8 et sépare par ;', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('A;B')
    expect(csv).toContain('1;2')
  })

  it('échappe les champs contenant ; " ou saut de ligne', () => {
    const csv = toCsv(['col'], [['a;b'], ['di"t'], ['deux\nlignes']])
    expect(csv).toContain('"a;b"')
    expect(csv).toContain('"di""t"') // guillemet doublé
    expect(csv).toContain('"deux\nlignes"')
  })

  it('sépare les lignes par CRLF', () => {
    expect(toCsv(['A'], [['1'], ['2']])).toContain('1\r\n2')
  })
})

describe('leadsToCsv', () => {
  it('mappe les colonnes lisibles (statut FR, catégorie, RDV)', () => {
    const csv = leadsToCsv([
      lead({ name: 'Marie Dupont', email: 'marie@test.fr', status: 'booked', score: 86, score_category: 'A', meeting_booked_at: '2026-07-03T09:00:00Z' }),
    ])
    expect(csv).toContain('Nom;Email')
    expect(csv).toContain('Marie Dupont')
    expect(csv).toContain('RDV pris') // statut traduit
    expect(csv).toContain('86')
    expect(csv).toContain('A')
  })

  it('gère les champs vides sans planter', () => {
    const csv = leadsToCsv([lead({})])
    expect(csv.split('\r\n').length).toBe(2) // en-tête + 1 ligne
  })

  it('échappe un résumé IA contenant un point-virgule', () => {
    const csv = leadsToCsv([lead({ ai_summary: 'Bon projet ; à rappeler' })])
    expect(csv).toContain('"Bon projet ; à rappeler"')
  })
})
