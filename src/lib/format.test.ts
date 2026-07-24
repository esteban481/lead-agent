import { describe, it, expect } from 'vitest'
import { relativeDay } from './format'

const now = new Date('2026-07-22T12:00:00Z')

describe('relativeDay', () => {
  it('aujourd hui', () => {
    expect(relativeDay('2026-07-22T08:00:00Z', now)).toBe("aujourd'hui")
  })
  it('hier', () => {
    // milieu de journée pour éviter l'ambiguïté de fuseau : le helper
    // raisonne en jours calendaires locaux (voulu pour l'affichage)
    expect(relativeDay('2026-07-21T10:00:00Z', now)).toBe('hier')
  })
  it('il y a N jours (< 7)', () => {
    expect(relativeDay('2026-07-19T10:00:00Z', now)).toBe('il y a 3 j')
    expect(relativeDay('2026-07-16T10:00:00Z', now)).toBe('il y a 6 j')
  })
  it('date courte au-delà d une semaine', () => {
    expect(relativeDay('2026-07-01T10:00:00Z', now)).toMatch(/01\/07\/2026/)
  })
  it('une date future retombe sur aujourd hui (pas de négatif)', () => {
    expect(relativeDay('2026-07-25T10:00:00Z', now)).toBe("aujourd'hui")
  })
  it('date invalide → chaîne vide', () => {
    expect(relativeDay('pas une date', now)).toBe('')
  })
})
