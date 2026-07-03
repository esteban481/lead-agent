// ============================================================
// Rate limiting en mémoire (fenêtre glissante).
//
// Best-effort : la mémoire est PAR INSTANCE serverless (Vercel),
// donc ça borne les rafales sur une instance chaude mais ne
// partage pas l'état entre instances / cold starts. Suffisant
// contre le flood basique du webhook form public ; pour un vrai
// quota distribué, brancher un store partagé (ex: Upstash Redis).
// ============================================================

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>()

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)

      if (recent.length >= limit) {
        hits.set(key, recent)
        const retryAfterMs = windowMs - (now - recent[0])
        return { allowed: false, remaining: 0, retryAfterMs }
      }

      recent.push(now)
      hits.set(key, recent)
      return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 }
    },
  }
}
