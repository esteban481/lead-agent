import { supabase } from '@/lib/supabase'
import { computeAnalytics } from '@/lib/analytics'
import type {
  ConversionAnalytics,
  DashboardStats,
  Lead,
  Message,
  QualificationAnswer,
  ScheduledRelance,
} from '@/types'

// ============================================================
// Requêtes partagées dashboard — appelées directement par les
// server components (pas de fetch HTTP vers notre propre API).
// ============================================================

export async function getLeads(limit = 100): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getLeads error:', error)
    return []
  }
  return (data ?? []) as Lead[]
}

export async function getStats(): Promise<DashboardStats | null> {
  const { data: leads, error } = await supabase
    .from('leads')
    .select('status, score_category, created_at')

  if (error) {
    console.error('getStats error:', error)
    return null
  }

  const all = leads ?? []
  const byCategory = { A: 0, B: 0, C: 0, D: 0 }
  for (const lead of all) {
    if (lead.score_category && lead.score_category in byCategory) {
      byCategory[lead.score_category as keyof typeof byCategory]++
    }
  }

  return {
    total_leads: all.length,
    leads_contacted: all.filter((l) => l.status !== 'new').length,
    leads_qualified: all.filter((l) => ['scoring', 'booked'].includes(l.status)).length,
    leads_booked: all.filter((l) => l.status === 'booked').length,
    leads_disqualified: all.filter((l) => l.status === 'disqualified').length,
    avg_response_time_minutes: null,
    by_category: byCategory,
  }
}

export async function getAnalytics(): Promise<ConversionAnalytics | null> {
  // Leads + premiers messages sortants (pour le temps de 1er contact)
  const [{ data: leads, error: leadsError }, { data: outMessages, error: msgError }] =
    await Promise.all([
      supabase
        .from('leads')
        .select('id, status, score_category, created_at, meeting_booked_at'),
      supabase
        .from('messages')
        .select('lead_id, sent_at')
        .eq('direction', 'out')
        .order('sent_at', { ascending: true }),
    ])

  if (leadsError || msgError) {
    console.error('getAnalytics error:', leadsError ?? msgError)
    return null
  }

  // 1er message sortant par lead (messages déjà triés par sent_at asc)
  const firstOutboundByLead: Record<string, string> = {}
  for (const m of outMessages ?? []) {
    if (m.lead_id && !firstOutboundByLead[m.lead_id]) {
      firstOutboundByLead[m.lead_id] = m.sent_at
    }
  }

  return computeAnalytics(
    (leads ?? []) as Parameters<typeof computeAnalytics>[0],
    firstOutboundByLead
  )
}

export async function getLeadDetail(id: string): Promise<{
  lead: Lead
  messages: Message[]
  qualification_answers: QualificationAnswer[]
  scheduled_relances: ScheduledRelance[]
} | null> {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !lead) return null

  const [{ data: messages }, { data: answers }, { data: relances }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .eq('lead_id', id)
        .order('sent_at', { ascending: true }),
      supabase
        .from('qualification_answers')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('scheduled_relances')
        .select('*')
        .eq('lead_id', id)
        .order('scheduled_at', { ascending: true }),
    ])

  return {
    lead: lead as Lead,
    messages: (messages ?? []) as Message[],
    qualification_answers: (answers ?? []) as QualificationAnswer[],
    scheduled_relances: (relances ?? []) as ScheduledRelance[],
  }
}
