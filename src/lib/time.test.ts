import { describe, it, expect } from 'vitest'
import { getHourInTimeZone } from './time'

describe('getHourInTimeZone (Europe/Paris)', () => {
  it('applique UTC+2 en été (heure d été)', () => {
    // 15 juillet 12:00 UTC → 14h à Paris (UTC+2)
    const summer = new Date('2026-07-15T12:00:00Z')
    expect(getHourInTimeZone(summer, 'Europe/Paris')).toBe(14)
  })

  it('applique UTC+1 en hiver (heure d hiver)', () => {
    // 15 janvier 12:00 UTC → 13h à Paris (UTC+1)
    const winter = new Date('2026-01-15T12:00:00Z')
    expect(getHourInTimeZone(winter, 'Europe/Paris')).toBe(13)
  })

  it('corrige le bug historique : 23h UTC en été = 1h à Paris (pas 0h)', () => {
    // L ancien code (getUTCHours()+1) donnait 0h ; en réalité il est 1h du matin à Paris
    const lateSummer = new Date('2026-07-15T23:00:00Z')
    expect(getHourInTimeZone(lateSummer, 'Europe/Paris')).toBe(1)
  })

  it('gère le passage de minuit (wrap 0-23)', () => {
    // 23:30 UTC en hiver → 0h30 à Paris
    const midnight = new Date('2026-01-15T23:30:00Z')
    expect(getHourInTimeZone(midnight, 'Europe/Paris')).toBe(0)
  })
})
