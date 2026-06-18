import { describe, it, expect } from 'vitest'
import { categoryFromScore, computeScore } from './score'
import type { ScoringWeights } from '@/types'

const weights: ScoringWeights = {
  zone_covered: 20,
  project_type_accepted: 20,
  surface_ok: 15,
  urgency_high: 15,
  budget_coherent: 10,
  message_quality: 10,
  contact_reachable: 10,
}

describe('categoryFromScore', () => {
  const hot = 75
  it('A au-dessus du seuil chaud', () => {
    expect(categoryFromScore(80, hot)).toBe('A')
    expect(categoryFromScore(75, hot)).toBe('A')
  })
  it('B entre 50 et le seuil chaud', () => {
    expect(categoryFromScore(74, hot)).toBe('B')
    expect(categoryFromScore(50, hot)).toBe('B')
  })
  it('C entre 25 et 50', () => {
    expect(categoryFromScore(49, hot)).toBe('C')
    expect(categoryFromScore(25, hot)).toBe('C')
  })
  it('D en dessous de 25', () => {
    expect(categoryFromScore(24, hot)).toBe('D')
    expect(categoryFromScore(0, hot)).toBe('D')
  })
})

describe('computeScore', () => {
  it('somme les points et garantit score = somme(details)', () => {
    const raw = { zone_covered: 20, project_type_accepted: 20, surface_ok: 15, urgency_high: 10, budget_coherent: 5, message_quality: 8, contact_reachable: 7 }
    const { score, details } = computeScore(raw, weights)
    const sum = Object.values(details).reduce((a, b) => a + b, 0)
    expect(score).toBe(sum)
    expect(score).toBe(85)
  })

  it('clampe chaque critère à son poids max (anti hallucination du LLM)', () => {
    const raw = { zone_covered: 999, project_type_accepted: 20 }
    const { details } = computeScore(raw, weights)
    expect(details.zone_covered).toBe(20) // pas 999
  })

  it('traite les critères manquants comme 0', () => {
    const { score, details } = computeScore({ zone_covered: 20 }, weights)
    expect(details.surface_ok).toBe(0)
    expect(score).toBe(20)
  })

  it('ignore les valeurs négatives ou NaN', () => {
    const raw = { zone_covered: -5, project_type_accepted: NaN as unknown as number }
    const { details } = computeScore(raw, weights)
    expect(details.zone_covered).toBe(0)
    expect(details.project_type_accepted).toBe(0)
  })

  it('plafonne le total à 100', () => {
    const big: ScoringWeights = { ...weights, zone_covered: 200 }
    const { score } = computeScore({ zone_covered: 200, project_type_accepted: 20 }, big)
    expect(score).toBe(100)
  })
})
