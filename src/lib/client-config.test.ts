import { describe, it, expect } from 'vitest'
import { validateClientConfig, DEFAULT_CLIENT_CONFIG } from './client-config'

describe('validateClientConfig', () => {
  it('accepte la config par défaut', () => {
    expect(validateClientConfig(DEFAULT_CLIENT_CONFIG)).toEqual({ ok: true, errors: [] })
  })

  it('rejette une non-objet', () => {
    expect(validateClientConfig('nope').ok).toBe(false)
    expect(validateClientConfig([]).ok).toBe(false)
    expect(validateClientConfig(null).ok).toBe(false)
  })

  it('liste les champs requis manquants', () => {
    const res = validateClientConfig({})
    expect(res.ok).toBe(false)
    expect(res.errors.length).toBeGreaterThan(5)
    expect(res.errors.some((e) => e.includes('zone'))).toBe(true)
    expect(res.errors.some((e) => e.includes('from_email'))).toBe(true)
  })

  it('valide la forme des qualification_questions', () => {
    const res = validateClientConfig({ ...DEFAULT_CLIENT_CONFIG, qualification_questions: [{ key: 'x' }] })
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('qualification_questions[0]'))).toBe(true)
  })

  it('exige des poids numériques', () => {
    const res = validateClientConfig({ ...DEFAULT_CLIENT_CONFIG, scoring_weights: { zone_covered: 'vingt' } })
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('scoring_weights.zone_covered'))).toBe(true)
  })

  it('exige relance_hours { start, end } numériques', () => {
    const res = validateClientConfig({ ...DEFAULT_CLIENT_CONFIG, relance_hours: { start: 8 } })
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('relance_hours'))).toBe(true)
  })
})
