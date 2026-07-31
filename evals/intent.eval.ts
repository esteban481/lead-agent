import { describe, it, expect } from 'vitest'
import { detectIntent } from '@/lib/ai/intent'
import { intentCases } from './dataset'

// ============================================================
// Eval — détection d'intention des réponses entrantes.
//
// Enjeu produit ET légal : un « désinscrivez-moi » mal classé =
// on continue à écrire à quelqu'un qui a demandé l'arrêt.
// On vise donc une précision élevée sur ce jeu.
//
// Skip automatique si ANTHROPIC_API_KEY est absente (aucun coût).
// ============================================================

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY

describe.skipIf(!HAS_KEY)('eval — détection d’intention', () => {
  it('classe correctement les réponses entrantes', async () => {
    const results = []
    for (const c of intentCases) {
      const got = await detectIntent(c.message)
      results.push({
        cas: c.name,
        message: c.message.length > 55 ? c.message.slice(0, 52) + '…' : c.message,
        attendu: c.expect,
        obtenu: got,
        ok: got === c.expect ? '✅' : '❌',
      })
    }

    // eslint-disable-next-line no-console
    console.table(results)

    const passed = results.filter((r) => r.ok === '✅').length
    const accuracy = passed / results.length
    // eslint-disable-next-line no-console
    console.log(`\nIntention : ${passed}/${results.length} corrects (${Math.round(accuracy * 100)} %)`)

    expect(accuracy).toBeGreaterThanOrEqual(0.85)
  })
})
