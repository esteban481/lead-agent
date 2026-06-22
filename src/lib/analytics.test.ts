import { describe, it, expect } from 'vitest'
import { computeAnalytics } from './analytics'
import type { Lead } from '@/types'

// Fabrique un lead minimal pour les tests
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
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...over,
  }
}

describe('computeAnalytics — funnel', () => {
  it('compte chaque étape et garantit la monotonie reçus≥contactés≥qualifiés≥bookés', () => {
    const leads = [
      lead({ id: '1', status: 'new' }),
      lead({ id: '2', status: 'awaiting_reply' }),
      lead({ id: '3', status: 'awaiting_reply', score_category: 'B' }),
      lead({ id: '4', status: 'booked', score_category: 'A' }),
    ]
    const a = computeAnalytics(leads, {})
    expect(a.funnel).toEqual({ received: 4, contacted: 3, qualified: 2, booked: 1 })
    const f = a.funnel
    expect(f.received).toBeGreaterThanOrEqual(f.contacted)
    expect(f.contacted).toBeGreaterThanOrEqual(f.qualified)
    expect(f.qualified).toBeGreaterThanOrEqual(f.booked)
  })

  it('inclut un lead booké sans catégorie dans qualified (monotonie défensive)', () => {
    const leads = [lead({ id: '1', status: 'booked', score_category: null })]
    const a = computeAnalytics(leads, {})
    expect(a.funnel.qualified).toBe(1)
    expect(a.funnel.booked).toBe(1)
  })
})

describe('computeAnalytics — taux', () => {
  it('calcule les taux de conversion', () => {
    const leads = [
      lead({ id: '1', status: 'booked', score_category: 'A' }),
      lead({ id: '2', status: 'awaiting_reply', score_category: 'C' }),
      lead({ id: '3', status: 'awaiting_reply' }),
      lead({ id: '4', status: 'new' }),
    ]
    const a = computeAnalytics(leads, {})
    // contacted=3, qualified=2, booked=1, received=4
    expect(a.rates.contact_rate).toBe(0.75)
    expect(a.rates.qualification_rate).toBeCloseTo(0.67, 2)
    expect(a.rates.booking_rate).toBe(0.5)
    expect(a.rates.overall_conversion).toBe(0.25)
  })

  it('renvoie null sur dénominateur nul (aucune division par zéro)', () => {
    const a = computeAnalytics([], {})
    expect(a.rates.contact_rate).toBeNull()
    expect(a.rates.overall_conversion).toBeNull()
  })
})

describe('computeAnalytics — temps', () => {
  it('moyenne le temps de 1er contact en minutes', () => {
    const leads = [
      lead({ id: '1', created_at: '2026-01-01T10:00:00Z' }),
      lead({ id: '2', created_at: '2026-01-01T10:00:00Z' }),
    ]
    const firstOut = {
      '1': '2026-01-01T10:02:00Z', // +2 min
      '2': '2026-01-01T10:08:00Z', // +8 min
    }
    expect(computeAnalytics(leads, firstOut).avg_minutes_to_first_contact).toBe(5)
  })

  it('ignore les leads sans 1er message sortant', () => {
    const leads = [
      lead({ id: '1', created_at: '2026-01-01T10:00:00Z' }),
      lead({ id: '2', created_at: '2026-01-01T10:00:00Z' }),
    ]
    const firstOut = { '1': '2026-01-01T10:10:00Z' }
    expect(computeAnalytics(leads, firstOut).avg_minutes_to_first_contact).toBe(10)
  })

  it('temps to booking en heures', () => {
    const leads = [
      lead({
        id: '1',
        status: 'booked',
        score_category: 'A',
        created_at: '2026-01-01T10:00:00Z',
        meeting_booked_at: '2026-01-02T10:00:00Z', // +24h
      }),
    ]
    expect(computeAnalytics(leads, {}).avg_hours_to_booking).toBe(24)
  })

  it('renvoie null quand aucune donnée temporelle', () => {
    const a = computeAnalytics([lead({ id: '1', status: 'new' })], {})
    expect(a.avg_minutes_to_first_contact).toBeNull()
    expect(a.avg_hours_to_booking).toBeNull()
  })
})
