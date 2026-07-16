import { computeAnalytics } from '@/lib/analytics'
import type { Lead } from '@/types'

// ============================================================
// Rapport hebdomadaire au client — contenu 100 % déterministe
// (aucun appel Claude : un rapport chiffré doit être exact et
// identique à données identiques). Réutilise computeAnalytics.
//
// Envoyé chaque lundi matin au notify_email du client par le
// cron /api/cron/rapport-hebdo.
// ============================================================

type LeadRow = Pick<Lead, 'id' | 'status' | 'score_category' | 'created_at' | 'meeting_booked_at'>

export interface WeeklyReportInput {
  companyName?: string
  // Leads créés sur la période
  leads: LeadRow[]
  // lead_id → date ISO du 1er email sortant (temps de 1ère réponse)
  firstOutboundByLead: Record<string, string>
  // RDV confirmés sur la période (même si le lead est plus ancien)
  bookedInWindow: number
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n > 1 ? (pluralForm ?? singular + 's') : singular}`
}

function formatFirstResponse(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 1) return "moins d'une minute"
  if (minutes < 60) return `${minutes} min`
  return `${(minutes / 60).toFixed(1)} h`
}

export function buildWeeklyReport(input: WeeklyReportInput): { subject: string; body: string } {
  const a = computeAnalytics(input.leads, input.firstOutboundByLead)
  const { received, contacted, qualified } = a.funnel
  const rdv = input.bookedInWindow
  const name = input.companyName ? ` — ${input.companyName}` : ''

  const subject = `Votre semaine Lead Agent : ${plural(received, 'lead')}, ${plural(rdv, 'RDV pris', 'RDV pris')}`

  const lines: string[] = ['Bonjour,', '']

  if (received === 0 && rdv === 0) {
    lines.push(
      "Semaine calme : aucun lead reçu ces 7 derniers jours.",
      "Votre agent reste en veille, prêt à répondre à la prochaine demande.",
    )
  } else {
    lines.push('Voici le bilan de votre agent sur les 7 derniers jours :', '')
    lines.push(`• Leads reçus : ${received}`)
    lines.push(`• Contactés en votre nom : ${contacted}`)
    lines.push(`• Qualifiés (scorés) : ${qualified}`)
    lines.push(`• Rendez-vous confirmés : ${rdv}`)
    if (a.avg_minutes_to_first_contact !== null) {
      lines.push(`• Temps moyen de première réponse : ${formatFirstResponse(a.avg_minutes_to_first_contact)}`)
    }
    if (a.disqualified > 0 || a.cold > 0) {
      lines.push(`• Hors cible ou sans réponse : ${a.disqualified + a.cold}`)
    }
    lines.push('', 'Le détail lead par lead est dans votre tableau de bord.')
  }

  lines.push('', `Bonne semaine${name} !`, "L'équipe Lead Agent")

  return { subject, body: lines.join('\n') }
}
