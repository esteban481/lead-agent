import { callClaude } from '@/lib/anthropic'
import type { ClientConfig, Lead, QualificationAnswer, ScoreResult } from '@/types'

export async function scoreLead(
  lead: Lead,
  answers: QualificationAnswer[],
  config: ClientConfig
): Promise<ScoreResult> {
  const answersText = answers
    .map((a) => `- ${a.question_key}: ${a.answer}`)
    .join('\n')

  const weightsText = Object.entries(config.scoring_weights)
    .map(([k, v]) => `- ${k}: ${v} points`)
    .join('\n')

  const prompt = `Tu es un expert en qualification de leads pour une entreprise du secteur de la rénovation énergétique.

Informations sur le prospect :
Nom : ${lead.name ?? 'inconnu'}
Email : ${lead.email ?? 'inconnu'}
Téléphone : ${lead.phone ?? 'inconnu'}
Message initial : ${JSON.stringify(lead.raw_data)}

Réponses de qualification :
${answersText || 'Aucune réponse collectée'}

Critères de scoring (total = 100 points) :
${weightsText}

Zone couverte par l'entreprise : ${config.zone.join(', ')}
Types de projets acceptés : ${config.accepted_project_types.join(', ')}
Types de projets refusés : ${config.rejected_project_types.join(', ')}

Calcule un score de 0 à 100, puis génère un court résumé lisible (2-3 phrases max) pour le commercial.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "score": <nombre entre 0 et 100>,
  "category": <"A" si >= ${config.score_threshold_hot}, "B" si >= 50, "C" si >= 25, "D" sinon>,
  "details": {
    "zone_covered": <points attribués>,
    "project_type_accepted": <points attribués>,
    "surface_ok": <points attribués>,
    "urgency_high": <points attribués>,
    "budget_coherent": <points attribués>,
    "message_quality": <points attribués>,
    "contact_reachable": <points attribués>
  },
  "summary": "<résumé pour le commercial>",
  "missing_fields": [<liste des champs encore manquants>]
}

JSON:`

  const raw = await callClaude(prompt)

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    return JSON.parse(match[0]) as ScoreResult
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
