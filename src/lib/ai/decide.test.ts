import { describe, it, expect } from 'vitest'
import { decideNextAction, isQualificationComplete } from './decide'
import type { ClientConfig, Lead, QualificationAnswer, ScoreResult } from '@/types'

const lead = { id: 'lead-1', status: 'scoring' } as Lead

// Config avec deux questions requises — pour tester la complétude déterministe.
const config = {
  qualification_questions: [
    { key: 'surface', label: 'Surface ?' },
    { key: 'delai', label: 'Délai ?' },
  ],
} as ClientConfig

function answers(...keys: string[]): QualificationAnswer[] {
  return keys.map((k) => ({ id: k, lead_id: 'lead-1', question_key: k, answer: 'x', created_at: '' }))
}

function score(overrides: Partial<ScoreResult>): ScoreResult {
  return {
    score: 80,
    category: 'A',
    details: {},
    summary: '',
    missing_fields: [],
    disqualified_reason: null,
    ...overrides,
  }
}

describe('isQualificationComplete', () => {
  it('vrai quand toutes les questions ont une réponse', () => {
    expect(isQualificationComplete(answers('surface', 'delai'), config)).toBe(true)
  })
  it('faux s il manque une réponse', () => {
    expect(isQualificationComplete(answers('surface'), config)).toBe(false)
  })
  it('vrai si la config ne définit aucune question', () => {
    expect(isQualificationComplete([], {} as ClientConfig)).toBe(true)
  })
  it('ignore le missing_fields de Claude (déterministe sur la config)', () => {
    // Toutes les questions répondues → complet, même si Claude prétendait le contraire.
    expect(isQualificationComplete(answers('surface', 'delai'), config)).toBe(true)
  })
})

describe('decideNextAction', () => {
  const complete = answers('surface', 'delai')

  it('demande la question suivante tant que des réponses manquent', () => {
    const result = decideNextAction(lead, score({ category: 'A' }), answers('surface'), config)
    expect(result.action).toBe('ask_next_question')
    expect(result.reason).toContain('delai')
  })

  it('disqualifie d office sur un disqualifiant dur, même incomplet', () => {
    const result = decideNextAction(
      lead,
      score({ category: 'D', disqualified_reason: 'hors zone couverte' }),
      answers('surface'), // incomplet
      config
    )
    expect(result.action).toBe('disqualify')
    expect(result.reason).toContain('hors zone')
  })

  it('envoie le lien de booking pour une catégorie A', () => {
    expect(decideNextAction(lead, score({ category: 'A' }), complete, config).action).toBe(
      'send_booking_link'
    )
  })

  it('envoie le lien de booking pour une catégorie B', () => {
    expect(
      decideNextAction(lead, score({ category: 'B', score: 60 }), complete, config).action
    ).toBe('send_booking_link')
  })

  it('envoie un suivi doux pour une catégorie C', () => {
    expect(
      decideNextAction(lead, score({ category: 'C', score: 35 }), complete, config).action
    ).toBe('send_gentle_followup')
  })

  it('disqualifie une catégorie D', () => {
    expect(
      decideNextAction(lead, score({ category: 'D', score: 10 }), complete, config).action
    ).toBe('disqualify')
  })
})
