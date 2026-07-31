import { describe, it, expect } from 'vitest'
import { scoreLead } from '@/lib/ai/score'
import { decideNextAction } from '@/lib/ai/decide'
import { scoringCases, evalConfig, evalSector } from './dataset'

// ============================================================
// Eval — scoring + décision.
//
// Fait passer chaque lead labellisé dans le VRAI pipeline
// (scoreLead → decideNextAction) et compare à l'ACTION attendue.
//
// On juge sur l'ACTION (le comportement du produit : booker /
// disqualifier / relancer / re-questionner), pas sur la catégorie :
// la frontière A/B est floue et sans effet comportemental (A comme B
// déclenchent un booking). La catégorie reste affichée pour l'œil.
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
      const pass = decision.action === c.expectAction
      results.push({ c, score, decision, pass })
    }

    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        cas: r.c.name,
        'cat. (indic.)': r.score.category,
        score: r.score.score,
        action: r.decision.action,
        'action attendue': r.c.expectAction,
        statut: r.pass ? '✅' : '❌',
      }))
    )

    const passed = results.filter((r) => r.pass).length
    const accuracy = passed / results.length

    // eslint-disable-next-line no-console
    console.log(
      `\nScoring — action correcte : ${passed}/${results.length} (${Math.round(accuracy * 100)} %)`
    )

    for (const r of results.filter((r) => !r.pass)) {
      // eslint-disable-next-line no-console
      console.log(
        `❌ « ${r.c.name} » → attendu ${r.c.expectAction}, ` +
          `obtenu ${r.decision.action} (cat ${r.score.category}, score ${r.score.score})`
      )
    }

    // Garde-fou souple : on tolère un peu de bruit LLM.
    expect(accuracy).toBeGreaterThanOrEqual(0.85)
  })
})
