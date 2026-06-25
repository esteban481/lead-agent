// ============================================================
// Logger structuré minimal — sans dépendance.
//
// Émet une ligne JSON par log (ts, level, msg + contexte), ce qui
// rend les logs Vercel filtrables (ex: par lead_id). Le niveau est
// piloté par LOG_LEVEL (défaut: info), donc les logs de debug sont
// silencieux en prod mais réactivables sans redéploiement de code.
//
// Usage :
//   logger.info('lead créé', { webhook: 'form', lead_id })
//   const log = logger.with({ webhook: 'cal', uid })
//   log.warn('aucun lead trouvé')
// ============================================================

type Level = 'debug' | 'info' | 'warn' | 'error'
type Context = Record<string, unknown>

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function threshold(): number {
  const lvl = process.env.LOG_LEVEL as Level | undefined
  return (lvl && ORDER[lvl]) || ORDER.info
}

function emit(level: Level, message: string, base: Context, extra?: Context): void {
  if (ORDER[level] < threshold()) return
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...base,
    ...extra,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function make(base: Context = {}) {
  return {
    debug: (msg: string, ctx?: Context) => emit('debug', msg, base, ctx),
    info: (msg: string, ctx?: Context) => emit('info', msg, base, ctx),
    warn: (msg: string, ctx?: Context) => emit('warn', msg, base, ctx),
    error: (msg: string, ctx?: Context) => emit('error', msg, base, ctx),
    // Logger enfant avec contexte hérité (fusionné dans chaque ligne)
    with: (ctx: Context) => make({ ...base, ...ctx }),
  }
}

export type Logger = ReturnType<typeof make>
export const logger = make()

// Sérialise une erreur inconnue en contexte loggable (message + stack).
export function errContext(err: unknown): Context {
  if (err instanceof Error) return { error: err.message, stack: err.stack }
  return { error: String(err) }
}
