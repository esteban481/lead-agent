// ============================================================
// Types centraux — Lead Agent MVP
// ============================================================

export type LeadStatus =
  | 'new'
  | 'awaiting_reply'
  | 'qualifying'
  | 'scoring'
  | 'booked'
  | 'disqualified'
  | 'cold'

export type ScoreCategory = 'A' | 'B' | 'C' | 'D'

export type MessageDirection = 'out' | 'in'

export type RelanceStatus = 'pending' | 'sent' | 'cancelled'

// ============================================================
// Config client (stockée en JSONB dans la table clients)
// ============================================================
export interface QualificationQuestion {
  key: string
  label: string
}

export interface ScoringWeights {
  zone_covered: number
  project_type_accepted: number
  surface_ok: number
  urgency_high: number
  budget_coherent: number
  message_quality: number
  contact_reachable: number
}

export interface ClientConfig {
  zone: string[]
  accepted_project_types: string[]
  rejected_project_types: string[]
  qualification_questions: QualificationQuestion[]
  scoring_weights: ScoringWeights
  score_threshold_hot: number
  relance_hours: { start: number; end: number }
  cal_booking_url: string
  from_email: string
}

// ============================================================
// Entités DB
// ============================================================
export interface Client {
  id: string
  name: string
  sector: string
  config: ClientConfig
  created_at: string
}

export interface Lead {
  id: string
  client_id: string
  name: string | null
  email: string | null
  phone: string | null
  source: string
  raw_data: Record<string, unknown>
  status: LeadStatus
  score: number | null
  score_category: ScoreCategory | null
  score_details: Record<string, number> | null
  ai_summary: string | null
  disqualified_reason: string | null
  meeting_booked_at: string | null
  cal_booking_id: string | null
  email_thread_id: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  lead_id: string
  direction: MessageDirection
  channel: string
  subject: string | null
  body: string
  message_id: string | null
  in_reply_to: string | null
  resend_email_id: string | null
  sent_at: string
}

export interface QualificationAnswer {
  id: string
  lead_id: string
  question_key: string
  answer: string
  created_at: string
}

export interface ScheduledRelance {
  id: string
  lead_id: string
  step: number
  scheduled_at: string
  status: RelanceStatus
  sent_at: string | null
  cancelled_at: string | null
  created_at: string
}

// ============================================================
// Types pour le webhook formulaire entrant
// ============================================================
export interface FormWebhookPayload {
  name?: string
  email?: string
  phone?: string
  message?: string
  source?: string
  // champs custom selon le formulaire client
  [key: string]: unknown
}

// ============================================================
// Types pour le webhook email inbound (Resend)
// ============================================================
export interface ResendInboundPayload {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    created_at: string
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    message_id: string
    headers?: Record<string, string>
    in_reply_to?: string
  }
}

// ============================================================
// Types pour les fonctions IA
// ============================================================
export interface ParsedLeadData {
  type_logement?: string
  surface?: string
  chauffage_actuel?: string
  delai_projet?: string
  code_postal?: string
  [key: string]: string | undefined
}

export interface ScoreResult {
  score: number
  category: ScoreCategory
  details: Record<string, number>
  summary: string
  missing_fields: string[]
}

export type NextAction =
  | 'send_booking_link'
  | 'ask_next_question'
  | 'send_gentle_followup'
  | 'disqualify'
  | 'wait'

export interface DecisionResult {
  action: NextAction
  reason: string
}

// ============================================================
// Types pour le dashboard
// ============================================================
export interface LeadWithMessages extends Lead {
  messages: Message[]
  qualification_answers: QualificationAnswer[]
}

export interface DashboardStats {
  total_leads: number
  leads_contacted: number
  leads_qualified: number
  leads_booked: number
  leads_disqualified: number
  avg_response_time_minutes: number | null
  by_category: { A: number; B: number; C: number; D: number }
}
