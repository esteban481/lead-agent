// ============================================================
// Setup des evals — charge .env dans process.env.
//
// Les tests unitaires (npm test) mockent Claude et n'ont besoin
// d'aucune clé. Les evals appellent la VRAIE API Anthropic : il
// leur faut ANTHROPIC_API_KEY. On lit .env à la main (zéro
// dépendance) et on ne surcharge jamais une variable déjà définie.
// ============================================================
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
} catch {
  // Pas de .env → on comptera sur les variables déjà présentes dans l'environnement.
}
