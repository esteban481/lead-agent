import type {
  ClientConfig,
  Lead,
  NextAction,
  QualificationAnswer,
  ScoreCategory,
} from '@/types'
import type { LeadIntent } from '@/lib/ai/intent'

// ============================================================
// Dataset labellisé pour les evals — c'est l'ACTIF durable.
//
// Chaque cas décrit une entrée réaliste + le résultat ATTENDU
// (écrit à la main). On mesure ainsi si le jugement de Claude est
// bon, et on détecte toute régression le jour où l'on touche un
// prompt ou le barème.
//
// Client de référence : installateur de pompes à chaleur air/eau
// en Essonne (91). Secteur volontairement concret pour des cas
// crédibles.
// ============================================================

export const evalConfig: ClientConfig = {
  zone: ['Essonne', '91'],
  accepted_project_types: ['installation pompe à chaleur air/eau'],
  rejected_project_types: ['dépannage', 'réparation', 'entretien seul'],
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
  cal_booking_url: 'https://cal.com/demo/15min',
  from_email: 'leads@leadqualifie.fr',
  branding: { company_name: 'ChaleurPro' },
}

export const evalSector = 'installation de pompes à chaleur (rénovation énergétique)'

// ------------------------------------------------------------
// Types de cas
// ------------------------------------------------------------

export interface ScoringCase {
  name: string
  lead: Lead
  answers: QualificationAnswer[]
  expectCategory: ScoreCategory
  expectAction: NextAction
  // Fourchette de score indicative (affichée dans le rapport, non bloquante).
  scoreRange: [number, number]
  // Si présent : cas connu pour NE PAS passer avec le barème actuel.
  // Documente une limite du produit plutôt qu'un bug de l'eval.
  knownGap?: string
}

export interface IntentCase {
  name: string
  message: string
  expect: LeadIntent
}

// ------------------------------------------------------------
// Fabriques (les evals n'ont besoin que d'un sous-ensemble des champs)
// ------------------------------------------------------------

let seq = 0

function makeLead(
  raw_data: Record<string, unknown>,
  contact: Partial<Pick<Lead, 'name' | 'email' | 'phone'>> = {}
): Lead {
  const now = new Date().toISOString()
  return {
    id: `eval-${++seq}`,
    client_id: 'eval',
    name: contact.name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    source: 'form',
    raw_data,
    status: 'scoring',
    score: null,
    score_category: null,
    score_details: null,
    ai_summary: null,
    disqualified_reason: null,
    meeting_booked_at: null,
    cal_booking_id: null,
    email_thread_id: null,
    notes: null,
    last_error: null,
    created_at: now,
    updated_at: now,
  }
}

function makeAnswers(leadId: string, map: Record<string, string>): QualificationAnswer[] {
  return Object.entries(map).map(([question_key, answer], i) => ({
    id: `${leadId}-a${i}`,
    lead_id: leadId,
    question_key,
    answer,
    created_at: new Date().toISOString(),
  }))
}

function scoringCase(input: {
  name: string
  message: string
  contact?: Partial<Pick<Lead, 'name' | 'email' | 'phone'>>
  answers: Record<string, string>
  expectCategory: ScoreCategory
  expectAction: NextAction
  scoreRange: [number, number]
  knownGap?: string
}): ScoringCase {
  const lead = makeLead({ message: input.message }, input.contact)
  return {
    name: input.name,
    lead,
    answers: makeAnswers(lead.id, input.answers),
    expectCategory: input.expectCategory,
    expectAction: input.expectAction,
    scoreRange: input.scoreRange,
    knownGap: input.knownGap,
  }
}

// ------------------------------------------------------------
// Cas de scoring
// ------------------------------------------------------------

export const scoringCases: ScoringCase[] = [
  // --- Cœur : leads en cible que le produit doit bien traiter ---
  scoringCase({
    name: 'A — parfait, urgent, budgété',
    message:
      "Bonjour, je souhaite installer une pompe à chaleur air/eau pour remplacer ma vieille chaudière fioul. C'est urgent, on aimerait lancer les travaux le mois prochain. Budget prévu autour de 15 000 €.",
    contact: { name: 'Julien Marchand', email: 'julien.marchand@gmail.com', phone: '0612345678' },
    answers: {
      type_logement: 'Maison individuelle',
      surface: '140 m²',
      chauffage_actuel: 'Chaudière fioul de 25 ans',
      delai_projet: "Le mois prochain, c'est urgent",
      code_postal: '91120 (Palaiseau)',
    },
    expectCategory: 'A',
    expectAction: 'send_booking_link',
    scoreRange: [80, 100],
  }),
  scoringCase({
    name: 'A — très bon, chaudière en fin de vie',
    message:
      "Nous voulons passer à une PAC air/eau, notre chaudière gaz est en fin de vie. On voudrait faire ça d'ici deux mois.",
    contact: { name: 'Sophie Ferrand', email: 'sophie.ferrand@outlook.fr', phone: '0698765432' },
    answers: {
      type_logement: 'Maison',
      surface: '160 m²',
      chauffage_actuel: 'Chaudière gaz ancienne',
      delai_projet: "D'ici 2 mois",
      code_postal: '91300 (Massy)',
    },
    expectCategory: 'A',
    expectAction: 'send_booking_link',
    scoreRange: [78, 100],
  }),
  scoringCase({
    name: 'B — bon mais pas pressé',
    message:
      "Je réfléchis à installer une pompe à chaleur, sans urgence, plutôt pour la fin d'année.",
    contact: { name: 'Marc Petit', email: 'marc.petit@gmail.com' },
    answers: {
      type_logement: 'Maison',
      surface: '110 m²',
      chauffage_actuel: 'Radiateurs électriques',
      delai_projet: "Fin d'année, pas pressé",
      code_postal: '91400 (Orsay)',
    },
    expectCategory: 'B',
    expectAction: 'send_booking_link',
    scoreRange: [50, 74],
  }),
  scoringCase({
    name: 'B — correct, sans budget annoncé',
    message:
      "Bonjour, projet d'installation de PAC air/eau cette année. Pouvez-vous m'en dire plus ?",
    contact: { name: 'Nadia Lopez', email: 'nadia.lopez@free.fr', phone: '0655443322' },
    answers: {
      type_logement: 'Maison',
      surface: '95 m²',
      chauffage_actuel: 'Chaudière gaz',
      delai_projet: 'Cette année',
      code_postal: '91600 (Savigny-sur-Orge)',
    },
    expectCategory: 'B',
    expectAction: 'send_booking_link',
    scoreRange: [55, 74],
  }),

  // --- Gaps connus : ce que le barème actuel NE sait pas encore faire.
  //     Ces cas révèlent les prochaines améliorations produit. ---
  scoringCase({
    name: 'GAP — hors zone (Marseille) mais lead parfait',
    message:
      "Installation PAC air/eau pour remplacer ma chaudière fioul, projet urgent le mois prochain, budget 15 000 €.",
    contact: { name: 'Paul Girard', email: 'paul.girard@gmail.com', phone: '0611223344' },
    answers: {
      type_logement: 'Maison',
      surface: '150 m²',
      chauffage_actuel: 'Fioul',
      delai_projet: 'Le mois prochain',
      code_postal: '13008 (Marseille)',
    },
    expectCategory: 'D',
    expectAction: 'disqualify',
    scoreRange: [0, 24],
    knownGap:
      "Hors zone mais tous les autres critères au max → scoré comme un lead chaud. Le barème n'a pas de disqualifiant géographique dur.",
  }),
  scoringCase({
    name: 'GAP — dépannage (type refusé) en zone',
    message:
      "Ma chaudière est tombée en panne, j'ai besoin d'un dépannage rapide, pouvez-vous intervenir vite ?",
    contact: { name: 'Claire Dubois', email: 'claire.dubois@gmail.com', phone: '0677889900' },
    answers: {
      type_logement: 'Maison',
      surface: '90 m²',
      chauffage_actuel: 'Chaudière gaz en panne',
      delai_projet: 'Immédiat (panne)',
      code_postal: '91000 (Évry)',
    },
    expectCategory: 'D',
    expectAction: 'disqualify',
    scoreRange: [0, 24],
    knownGap:
      "Demande de dépannage (type de projet refusé) mais les points de zone/surface/contact suffisent à éviter la disqualification.",
  }),
]

// ------------------------------------------------------------
// Cas de détection d'intention (réponses email entrantes)
// ------------------------------------------------------------

export const intentCases: IntentCase[] = [
  { name: 'STOP (fast-path regex)', message: 'STOP', expect: 'opt_out' },
  {
    name: 'Désinscription implicite',
    message: "Merci mais je vous prie de ne plus jamais m'envoyer d'e-mails.",
    expect: 'opt_out',
  },
  {
    name: 'Retrait de la liste',
    message: 'Pouvez-vous me retirer de votre liste de diffusion ? Merci.',
    expect: 'opt_out',
  },
  {
    name: 'Pas intéressé (poli)',
    message: "Non merci, ce n'est pas d'actualité pour nous cette année.",
    expect: 'not_interested',
  },
  {
    name: 'Renonce au projet',
    message: 'Finalement on va garder notre chaudière, on ne donne pas suite. Bonne journée.',
    expect: 'not_interested',
  },
  {
    name: 'Vraie réponse (donne des infos)',
    message:
      "Oui c'est une maison de 130 m², chauffage au fioul, on aimerait changer avant l'hiver.",
    expect: 'answer',
  },
  {
    name: 'Question du prospect',
    message: "Combien de temps prend l'installation environ ?",
    expect: 'answer',
  },
  {
    name: 'Hésitation (piège → answer, pas not_interested)',
    message: 'Je ne sais pas encore, ça va dépendre du prix que vous proposez.',
    expect: 'answer',
  },
]
