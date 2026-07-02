// ============================================================
// Validation de la config client (JSONB) avant création/édition.
// Évite d'enregistrer un client cassé qui ferait planter le
// pipeline (webhooks, scoring, relances).
//
// Logique pure et testable — pas de dépendance.
// ============================================================

export interface ConfigValidation {
  ok: boolean
  errors: string[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function validateClientConfig(input: unknown): ConfigValidation {
  const errors: string[] = []
  if (!isObject(input)) {
    return { ok: false, errors: ['La config doit être un objet JSON.'] }
  }

  const requireArray = (key: string) => {
    if (!Array.isArray(input[key])) errors.push(`"${key}" doit être un tableau.`)
  }
  const requireString = (key: string) => {
    if (typeof input[key] !== 'string' || !(input[key] as string).trim()) {
      errors.push(`"${key}" doit être une chaîne non vide.`)
    }
  }

  requireArray('zone')
  requireArray('accepted_project_types')
  requireArray('rejected_project_types')

  if (!Array.isArray(input.qualification_questions)) {
    errors.push('"qualification_questions" doit être un tableau.')
  } else {
    input.qualification_questions.forEach((q, i) => {
      if (!isObject(q) || typeof q.key !== 'string' || typeof q.label !== 'string') {
        errors.push(`qualification_questions[${i}] doit avoir { key, label } (chaînes).`)
      }
    })
  }

  if (!isObject(input.scoring_weights)) {
    errors.push('"scoring_weights" doit être un objet.')
  } else {
    for (const [k, v] of Object.entries(input.scoring_weights)) {
      if (typeof v !== 'number') errors.push(`scoring_weights.${k} doit être un nombre.`)
    }
  }

  if (typeof input.score_threshold_hot !== 'number') {
    errors.push('"score_threshold_hot" doit être un nombre.')
  }

  if (!isObject(input.relance_hours) ||
      typeof input.relance_hours.start !== 'number' ||
      typeof input.relance_hours.end !== 'number') {
    errors.push('"relance_hours" doit être { start: number, end: number }.')
  }

  requireString('cal_booking_url')
  requireString('from_email')

  return { ok: errors.length === 0, errors }
}

// Config de départ pré-remplie pour le formulaire "nouveau client".
export const DEFAULT_CLIENT_CONFIG = {
  zone: ['Essonne'],
  accepted_project_types: ['installation_pac_air_eau'],
  rejected_project_types: ['depannage'],
  qualification_questions: [
    { key: 'type_logement', label: 'Maison ou appartement ?' },
    { key: 'surface', label: 'Surface approximative ?' },
    { key: 'chauffage_actuel', label: 'Chauffage actuel ?' },
    { key: 'delai_projet', label: 'Projet prévu sous combien de temps ?' },
    { key: 'code_postal', label: 'Code postal ?' },
  ],
  scoring_weights: {
    zone_covered: 20,
    project_type_accepted: 20,
    surface_ok: 15,
    urgency_high: 15,
    budget_coherent: 10,
    message_quality: 10,
    contact_reachable: 10,
  },
  score_threshold_hot: 75,
  relance_hours: { start: 8, end: 20 },
  cal_booking_url: 'https://cal.com/xxx/15min',
  from_email: 'leads@leadqualifie.fr',
}
