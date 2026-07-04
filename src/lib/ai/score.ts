import { callClaude } from '@/lib/anthropic'
import { scoringPersonaLine } from '@/lib/ai/persona'
import type { ClientConfig, Lead, QualificationAnswer, ScoreCategory, ScoreResult, ScoringWeights } from '@/types'

// ============================================================
// Scoring lead.
//
// Répartition des rôles :
//  - Claude juge CHAQUE critère qualitatif et attribue des points
//    dans la limite du poids configuré (ce qu'un LLM fait bien).
//  - Le CODE somme, clampe et décide la catégorie via les seuils
//    (ce qu'un LLM fait mal et de façon non déterministe).
//
// Garantit : score = somme(details), chaque détail ≤ son poids,
// catégorie cohérente avec score+seuils, peu de variance (temp 0).
// ============================================================

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

// Catégorie déterministe à partir du score et du seuil "chaud" du client.
export function categoryFromScore(score: number, thresholdHot: number): ScoreCategory {
  if (score >= thresholdHot) return 'A'
  if (score >= 50) return 'B'
  if (score >= 25) return 'C'
  return 'D'
}

// Somme contrôlée : chaque critère est clampé à [0, poids], total clampé à [0, 100].
export function computeScore(
  rawDetails: Record<string, number>,
  weights: ScoringWeights
): { score: number; details: Record<string, number> } {
  const details: Record<string, number> = {}
  let score = 0
  for (const [criterion, maxWeight] of Object.entries(weights)) {
    const points = Math.round(clamp(Number(rawDetails[criterion] ?? 0), 0, maxWeight))
    details[criterion] = points
    score += points
  }
  return { score: clamp(score, 0, 100), details }
}

export async function scoreLead(
  lead: Lead,
  answers: QualificationAnswer[],
  config: ClientConfig,
  sector?: string
): Promise<ScoreResult> {
  const answersText = answers
    .map((a) => `- ${a.question_key}: ${a.answer}`)
    .join('\n')

  const weightsText = Object.entries(config.scoring_weights)
    .map(([k, v]) => `- ${k}: 0 à ${v} points`)
    .join('\n')

  const prompt = `${scoringPersonaLine(config, sector)}

Informations sur le prospect :
Nom : ${lead.name ?? 'inconnu'}
Email : ${lead.email ?? 'inconnu'}
Téléphone : ${lead.phone ?? 'inconnu'}
Message initial : ${JSON.stringify(lead.raw_data)}

Réponses de qualification :
${answersText || 'Aucune réponse collectée'}

Zone couverte par l'entreprise : ${config.zone.join(', ')}
Types de projets acceptés : ${config.accepted_project_types.join(', ')}
Types de projets refusés : ${config.rejected_project_types.join(', ')}

Attribue à chaque critère un nombre de points ENTIER dans sa limite (ne dépasse jamais le maximum) :
${weightsText}

Ne calcule NI le total NI la catégorie : on s'en charge. Donne aussi un court résumé
(2-3 phrases) pour le commercial et la liste des champs encore manquants.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "details": {
    "zone_covered": <points>,
    "project_type_accepted": <points>,
    "surface_ok": <points>,
    "urgency_high": <points>,
    "budget_coherent": <points>,
    "message_quality": <points>,
    "contact_reachable": <points>
  },
  "summary": "<résumé pour le commercial>",
  "missing_fields": [<liste des champs encore manquants>]
}

JSON:`

  const raw = await callClaude(prompt, { temperature: 0 })

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    const parsed = JSON.parse(match[0]) as {
      details?: Record<string, number>
      summary?: string
      missing_fields?: string[]
    }

    // Le code reprend la main sur l'arithmétique et la catégorie
    const { score, details } = computeScore(parsed.details ?? {}, config.scoring_weights)
    const category = categoryFromScore(score, config.score_threshold_hot)

    return {
      score,
      category,
      details,
      summary: parsed.summary ?? '',
      missing_fields: parsed.missing_fields ?? [],
    }
  } catch {
    // Fallback si Claude retourne quelque chose d'inattendu
    return {
      score: 0,
      category: 'D',
      details: {},
      summary: 'Erreur lors du scoring — vérification manuelle requise.',
      missing_fields: [],
    }
  }
}
