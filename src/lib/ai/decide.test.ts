import { describe, it, expect } from 'vitest'
import { decideNextAction } from './decide'
import type { ClientConfig, Lead, ScoreResult } from '@/types'

const lead = { id: 'lead-1', status: 'scoring' } as Lead
const config = {} as ClientConfig

function score(overrides: Partial<ScoreResult>): ScoreResult {
  return {
    score: 80,
    category: 'A',
    details: {},
    summary: '',
    missing_fields: [],
    ...overrides,
  }
}

describe('decideNextAction', () => {
  it('demande la question suivante si des champs manquent, quel que soit le score', () => {
    const result = decideNextAction(
      lead,
      score({ category: 'A', missing_fields: ['surface'] }),
      [],
      config
    )
    expect(result.action).toBe('ask_next_question')
  })

  it('envoie le lien de booking pour une catégorie A', () => {
    const result = decideNextAction(lead, score({ category: 'A' }), [], config)
    expect(result.action).toBe('send_booking_link')
  })

  it('envoie le lien de booking pour une catégorie B', () => {
    const result = decideNextAction(lead, score({ category: 'B', score: 60 }), [], config)
    expect(result.action).toBe('send_booking_link')
  })

  it('envoie un suivi doux pour une catégorie C', () => {
    const result = decideNextAction(lead, score({ category: 'C', score: 35 }), [], config)
    expect(result.action).toBe('send_gentle_followup')
  })

  it('disqualifie une catégorie D', () => {
    const result = decideNextAction(lead, score({ category: 'D', score: 10 }), [], config)
    expect(result.action).toBe('disqualify')
  })
})
