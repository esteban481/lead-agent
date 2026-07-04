import { describe, it, expect, vi, beforeEach } from 'vitest'

const { callClaudeMock } = vi.hoisted(() => ({ callClaudeMock: vi.fn() }))
vi.mock('@/lib/anthropic', () => ({ callClaude: callClaudeMock }))

import { detectIntent, matchExplicitOptOut } from './intent'

beforeEach(() => callClaudeMock.mockReset())

describe('matchExplicitOptOut (fast-path regex)', () => {
  it.each([
    'STOP',
    ' stop. ',
    'Merci de me désinscrire de votre liste',
    'unsubscribe',
    'Ne me contactez plus svp',
    'Je ne souhaite plus être contacté',
    "Arrêtez de m'écrire",
    'Supprimez mes données',
  ])('détecte « %s »', (msg) => {
    expect(matchExplicitOptOut(msg)).toBe(true)
  })

  it.each([
    'Je veux stopper mon chauffage au fioul, quelle surface indiquer ?',
    'On peut se contacter la semaine prochaine ?',
    'La maison fait 120m2',
  ])('ne matche pas un message normal : « %s »', (msg) => {
    expect(matchExplicitOptOut(msg)).toBe(false)
  })
})

describe('detectIntent', () => {
  it('opt-out explicite → pas d appel Claude', async () => {
    expect(await detectIntent('STOP')).toBe('opt_out')
    expect(callClaudeMock).not.toHaveBeenCalled()
  })

  it('message vide → answer sans appel', async () => {
    expect(await detectIntent('')).toBe('answer')
    expect(callClaudeMock).not.toHaveBeenCalled()
  })

  it('classification Claude : not_interested', async () => {
    callClaudeMock.mockResolvedValueOnce('{"intent":"not_interested"}')
    expect(await detectIntent('Finalement on a choisi un autre prestataire, merci.')).toBe('not_interested')
  })

  it('classification Claude : answer', async () => {
    callClaudeMock.mockResolvedValueOnce('{"intent":"answer"}')
    expect(await detectIntent('La maison fait 120m2, chauffage gaz.')).toBe('answer')
  })

  it('réponse Claude invalide → fallback answer', async () => {
    callClaudeMock.mockResolvedValueOnce('je ne sais pas')
    expect(await detectIntent('hmm')).toBe('answer')
  })

  it('intent inconnu renvoyé par Claude → fallback answer', async () => {
    callClaudeMock.mockResolvedValueOnce('{"intent":"banana"}')
    expect(await detectIntent('hmm')).toBe('answer')
  })

  it('erreur d appel → fallback answer (pipeline non bloqué)', async () => {
    callClaudeMock.mockRejectedValueOnce(new Error('529'))
    expect(await detectIntent('hmm')).toBe('answer')
  })
})
