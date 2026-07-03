import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('createRateLimiter', () => {
  it('autorise jusqu à la limite puis bloque', () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 })
    expect(rl.check('k', 0).allowed).toBe(true)
    expect(rl.check('k', 0).allowed).toBe(true)
    expect(rl.check('k', 0).allowed).toBe(true)
    const blocked = rl.check('k', 0)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('libère après la fenêtre glissante', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 })
    expect(rl.check('k', 0).allowed).toBe(true)
    expect(rl.check('k', 500).allowed).toBe(false) // même fenêtre
    expect(rl.check('k', 1001).allowed).toBe(true) // fenêtre passée
  })

  it('isole les clés', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 })
    expect(rl.check('a', 0).allowed).toBe(true)
    expect(rl.check('b', 0).allowed).toBe(true) // clé différente
    expect(rl.check('a', 0).allowed).toBe(false)
  })

  it('remaining décroît', () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000 })
    expect(rl.check('k', 0).remaining).toBe(1)
    expect(rl.check('k', 0).remaining).toBe(0)
  })
})
