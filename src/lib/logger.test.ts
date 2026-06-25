import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, errContext } from './logger'

let logSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let errSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function lastJson(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(spy.mock.calls.at(-1)![0] as string)
}

describe('logger', () => {
  it('émet une ligne JSON avec ts, level, msg et contexte', () => {
    logger.info('lead créé', { webhook: 'form', lead_id: 'lead-1' })
    const entry = lastJson(logSpy)
    expect(entry).toMatchObject({ level: 'info', msg: 'lead créé', webhook: 'form', lead_id: 'lead-1' })
    expect(typeof entry.ts).toBe('string')
  })

  it('route error vers console.error et warn vers console.warn', () => {
    logger.error('boom')
    logger.warn('attention')
    expect(lastJson(errSpy).level).toBe('error')
    expect(lastJson(warnSpy).level).toBe('warn')
  })

  it('respecte LOG_LEVEL : info/debug filtrés si level=warn', () => {
    vi.stubEnv('LOG_LEVEL', 'warn')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    expect(logSpy).not.toHaveBeenCalled() // debug + info supprimés
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('with() fusionne le contexte hérité', () => {
    const child = logger.with({ webhook: 'cal', uid: 'b1' })
    child.info('ok', { lead_id: 'lead-9' })
    expect(lastJson(logSpy)).toMatchObject({ webhook: 'cal', uid: 'b1', lead_id: 'lead-9' })
  })

  it('errContext sérialise une Error (message + stack)', () => {
    const ctx = errContext(new Error('cassé'))
    expect(ctx.error).toBe('cassé')
    expect(typeof ctx.stack).toBe('string')
    expect(errContext('texte')).toEqual({ error: 'texte' })
  })
})
