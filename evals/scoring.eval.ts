import { describe, it, expect } from 'vitest'
import { scoreLead } from '@/lib/ai/score'
import { decideNextAction } from '@/lib/ai/decide'
import { scoringCases, evalConfig, evalSector } from './dataset'

// ============================================================
// Eval — scoring + décision.
//
// Fait passer chaque lead labellisé dans le VRAI pipeline
// (scoreLead → decideNextAction) et compare à l'attendu.
// Métrique de garde : les cas "cœur" (leads en cible) doivent
// majoritairement aboutir à la bonne action. Les cas "gap" sont
// affichés mais ne bloquent pas — ils documentent les limites.
//
// Skip automatique si ANTHROPIC_API_KEY est absente (aucun coût).
// ============================================================

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY

describe.skipIf(!HAS_KEY)('eval — scoring & décision', () => {
  it('score les leads et choisit la bonne action', async () => {
    const results = []
    for (const c of scoringCases) {
      const score = await scoreLead(c.lead, c.answers, evalConfig, evalSector)
      const decision = decideNextAction(c.lead, score, c.answers, evalConfig)
      const pass = decision.action === c.expectAction && score.category === c.expectCategory
      results.push({ c, score, decision, pass })
    }

    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        cas: r.c.name,
        'cat.': r.score.category,
        att: r.c.expectCategory,
        score: r.score.score,
        action: r.decision.action,
        'action att.': r.c.expectAction,
        statut: r.c.knownGap ? (r.pass ? '✅ résolu' : '⚠️ gap') : r.pass ? '✅' : '❌',
      }))
    )

    const core = results.filter((r) => !r.c.knownGap)
    const corePassed = core.filter((r) => r.pass).length
    const accuracy = corePassed / core.length

    // eslint-disable-next-line no-console
    console.log(
      `\nScoring — cas cœur : ${corePassed}/${core.length} corrects (${Math.round(accuracy * 100)} %)`
    )

    for (const r of results.filter((r) => r.c.knownGap && !r.pass)) {
      // eslint-disable-next-line no-console
      console.log(
        `⚠️  Gap : « ${r.c.name} » → attendu ${r.c.expectAction}/${r.c.expectCategory}, ` +
          `obtenu ${r.decision.action}/${r.score.category} (score ${r.score.score}). ${r.c.knownGap}`
      )
    }

    // Garde-fou souple : on tolère un peu de bruit LLM sur les cas cœur.
    expect(accuracy).toBeGreaterThanOrEqual(0.75)
  })
})
