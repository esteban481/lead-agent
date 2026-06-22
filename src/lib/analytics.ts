import type { ConversionAnalytics, Lead } from '@/types'

// ============================================================
// Calcul des analytics de conversion — LOGIQUE PURE (pas de DB).
// Séparé de queries.ts pour être testable sans réseau.
//
// Funnel monotone garanti : received ≥ contacted ≥ qualified ≥ booked.
//  - contacted : le lead n'est plus 'new' (1er email parti)
//  - qualified : le lead a été scoré (score_category) OU booké
//  - booked    : RDV confirmé
// ============================================================

type LeadForAnalytics = Pick<
  Lead,
  'id' | 'status' | 'score_category' | 'created_at' | 'meeting_booked_at'
>

// Moyenne en minutes entre deux dates ISO, sur les paires valides uniquement.
function avgMinutes(pairs: Array<[string, string | null]>): number | null {
  const deltas: number[] = []
  for (const [start, end] of pairs) {
    if (!end) continue
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (Number.isFinite(ms) && ms >= 0) deltas.push(ms / 60000)
  }
  if (deltas.length === 0) return null
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 100) / 100
}

export function computeAnalytics(
  leads: LeadForAnalytics[],
  // lead_id → date ISO du 1er message sortant (notre 1er email)
  firstOutboundByLead: Record<string, string>
): ConversionAnalytics {
  const received = leads.length
  const contacted = leads.filter((l) => l.status !== 'new').length
  // qualified : scoré ou booké (garantit booked ⊆ qualified pour la monotonie)
  const qualified = leads.filter(
    (l) => l.score_category !== null || l.status === 'booked'
  ).length
  const booked = leads.filter((l) => l.status === 'booked').length

  const timeToContactPairs: Array<[string, string | null]> = leads.map((l) => [
    l.created_at,
    firstOutboundByLead[l.id] ?? null,
  ])

  const timeToBookingPairs: Array<[string, string | null]> = leads
    .filter((l) => l.status === 'booked')
    .map((l) => [l.created_at, l.meeting_booked_at])

  const avgToBookingMin = avgMinutes(timeToBookingPairs)

  return {
    funnel: { received, contacted, qualified, booked },
    rates: {
      contact_rate: rate(contacted, received),
      qualification_rate: rate(qualified, contacted),
      booking_rate: rate(booked, qualified),
      overall_conversion: rate(booked, received),
    },
    avg_minutes_to_first_contact: avgMinutes(timeToContactPairs),
    avg_hours_to_booking: avgToBookingMin === null ? null : Math.round(avgToBookingMin / 60),
    cold: leads.filter((l) => l.status === 'cold').length,
    disqualified: leads.filter((l) => l.status === 'disqualified').length,
  }
}
