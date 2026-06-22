import { describe, it, expect } from 'vitest'
import { createSession, verifySession } from './session'
import { hashPassword, verifyPassword, generateSalt, timingSafeEqualHex } from './password'

const SECRET = 'secret-de-test-suffisamment-long-1234567890'

describe('session', () => {
  it('round-trip : un token valide se vérifie et rend le payload', async () => {
    const token = await createSession({ role: 'client', client_id: 'abc' }, SECRET)
    const payload = await verifySession(token, SECRET)
    expect(payload?.role).toBe('client')
    expect(payload?.client_id).toBe('abc')
  })

  it('rejette un token signé avec un autre secret', async () => {
    const token = await createSession({ role: 'admin', client_id: null }, SECRET)
    expect(await verifySession(token, 'mauvais-secret')).toBeNull()
  })

  it('rejette un payload altéré (signature invalide)', async () => {
    const token = await createSession({ role: 'client', client_id: 'abc' }, SECRET)
    const [body, sig] = token.split('.')
    // On remplace le body par un autre client_id sans re-signer
    const forgedBody = btoa(JSON.stringify({ role: 'admin', client_id: null, exp: 9999999999 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await verifySession(`${forgedBody}.${sig}`, SECRET)).toBeNull()
    expect(body).toBeTruthy()
  })

  it('rejette un token expiré', async () => {
    const token = await createSession({ role: 'client', client_id: 'abc' }, SECRET, -10)
    expect(await verifySession(token, SECRET)).toBeNull()
  })

  it('rejette un token vide ou malformé', async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull()
    expect(await verifySession('pasdepoint', SECRET)).toBeNull()
  })
})

describe('password', () => {
  it('hash déterministe pour un même (mot de passe, salt)', async () => {
    const salt = generateSalt()
    const h1 = await hashPassword('motdepasse', salt)
    const h2 = await hashPassword('motdepasse', salt)
    expect(h1).toBe(h2)
  })

  it('salts différents → hash différents', async () => {
    const h1 = await hashPassword('motdepasse', generateSalt())
    const h2 = await hashPassword('motdepasse', generateSalt())
    expect(h1).not.toBe(h2)
  })

  it('verifyPassword accepte le bon mot de passe et rejette le mauvais', async () => {
    const salt = generateSalt()
    const hash = await hashPassword('bon', salt)
    expect(await verifyPassword('bon', salt, hash)).toBe(true)
    expect(await verifyPassword('mauvais', salt, hash)).toBe(false)
  })

  it('timingSafeEqualHex : true si égal, false sinon', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true)
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false)
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false)
  })
})
