import { callClaude } from '@/lib/anthropic'

// ============================================================
// Détection d'intention d'une réponse email entrante.
//
// Historiquement, toute réponse était traitée comme des données de
// qualification : un prospect écrivant « pas intéressé, arrêtez de
// m'écrire » recevait... l'email de questions suivant + une relance.
// Mauvais produit, et risqué légalement (opt-out non respecté).
//
//  - opt_out        → ne plus JAMAIS recontacter (aucun email)
//  - not_interested → pas intéressé (clôture polie)
//  - answer         → réponse normale, pipeline de qualification
//
// Fast-path regex pour les opt-out non ambigus (zéro appel Claude),
// classification Claude (température 0) sinon. En cas d'erreur ou
// de réponse inattendue : fallback 'answer' = comportement actuel.
// ============================================================

export type LeadIntent = 'opt_out' | 'not_interested' | 'answer'

// Motifs d'opt-out explicites — volontairement stricts pour éviter
// tout faux positif (un opt-out à tort = lead perdu).
const OPT_OUT_PATTERNS: RegExp[] = [
  /^\s*stop\s*[.!]*\s*$/i, // message réduit à "STOP"
  /d[ée]sinscri/i,
  /unsubscribe/i,
  /ne\s+(?:me\s+)?(?:re)?contactez\s+plus/i,
  /ne\s+(?:souhaite|veux)\s+plus\s+(?:être|etre)\s+contact/i,
  /arr[êe]tez\s+de\s+m[' ]?[ée]crire/i,
  /supprimez\s+(?:moi|mes\s+donn[ée]es)/i,
]

export function matchExplicitOptOut(message: string): boolean {
  return OPT_OUT_PATTERNS.some((re) => re.test(message))
}

export async function detectIntent(message: string): Promise<LeadIntent> {
  const trimmed = (message ?? '').trim()
  if (!trimmed) return 'answer'

  // 1. Fast-path : opt-out explicite, sans appel Claude
  if (matchExplicitOptOut(trimmed)) return 'opt_out'

  // 2. Classification Claude (température 0)
  const prompt = `Tu classifies l'intention d'une réponse email d'un prospect à un email commercial de qualification.

Réponse du prospect :
"${trimmed.slice(0, 1500)}"

Catégories possibles :
- "opt_out" : le prospect demande explicitement à ne plus être contacté / se désinscrire
- "not_interested" : le prospect indique ne pas ou ne plus être intéressé (sans demander la désinscription)
- "answer" : toute autre réponse (informations, questions, hésitation, demande de précision...)

Au moindre doute, choisis "answer".

Réponds UNIQUEMENT avec ce JSON : {"intent": "<opt_out|not_interested|answer>"}

JSON:`

  try {
    const raw = await callClaude(prompt, { temperature: 0 })
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return 'answer'
    const parsed = JSON.parse(match[0]) as { intent?: string }
    if (parsed.intent === 'opt_out' || parsed.intent === 'not_interested') {
      return parsed.intent
    }
    return 'answer'
  } catch {
    // Erreur d'appel → on ne bloque pas le pipeline
    return 'answer'
  }
}
