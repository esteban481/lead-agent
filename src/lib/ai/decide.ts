import type { ClientConfig, DecisionResult, Lead, QualificationAnswer, ScoreResult } from '@/types'

// Complétude déterministe : toutes les questions de qualification de la config
// ont une réponse. On NE se fie PAS au champ missing_fields renvoyé par Claude
// (peu fiable : il signale parfois des manques sur un lead pourtant complet).
export function isQualificationComplete(
  answers: QualificationAnswer[],
  config: ClientConfig
): boolean {
  const questions = config.qualification_questions ?? []
  if (questions.length === 0) return true
  const answered = new Set(answers.map((a) => a.question_key))
  return questions.every((q) => answered.has(q.key))
}

// Décide de l'action suivante après le scoring.
// Logique déterministe — pas d'appel Claude.
export function decideNextAction(
  lead: Lead,
  score: ScoreResult,
  answers: QualificationAnswer[],
  config: ClientConfig
): DecisionResult {
  // 1. Disqualifiant dur (hors zone, type de projet refusé) → on arrête tout,
  //    même si la qualification n'est pas terminée : inutile de continuer.
  if (score.disqualified_reason) {
    return { action: 'disqualify', reason: `Disqualifié — ${score.disqualified_reason}` }
  }

  // 2. Qualification incomplète → continuer à collecter.
  //    Complétude dérivée de la config (déterministe), pas de missing_fields.
  if (!isQualificationComplete(answers, config)) {
    const answered = new Set(answers.map((a) => a.question_key))
    const missing = (config.qualification_questions ?? [])
      .filter((q) => !answered.has(q.key))
      .map((q) => q.key)
    return {
      action: 'ask_next_question',
      reason: `Champs manquants: ${missing.join(', ')}`,
    }
  }

  // 3. Catégorie de score.
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
