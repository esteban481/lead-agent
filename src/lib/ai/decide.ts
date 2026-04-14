import type { ClientConfig, DecisionResult, Lead, QualificationAnswer, ScoreResult } from '@/types'

// Décide de l'action suivante après le scoring.
// Logique déterministe — pas besoin de Claude ici.
export function decideNextAction(
  lead: Lead,
  score: ScoreResult,
  answers: QualificationAnswer[],
  config: ClientConfig
): DecisionResult {
  // Des infos manquantes → continuer la qualification
  if (score.missing_fields.length > 0) {
    return {
      action: 'ask_next_question',
      reason: `Champs manquants: ${score.missing_fields.join(', ')}`,
    }
  }

  if (score.category === 'D') {
    return {
      action: 'disqualify',
      reason: 'Score trop faible — lead hors cible',
    }
  }

  if (score.category === 'A' || score.category === 'B') {
    return {
      action: 'send_booking_link',
      reason: `Lead qualifié — score ${score.score} (${score.category})`,
    }
  }

  // Score C : séquence plus douce
  return {
    action: 'send_gentle_followup',
    reason: `Lead C (${score.score}) — approche douce`,
  }
}
