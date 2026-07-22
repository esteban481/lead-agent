import { supabase } from '@/lib/supabase'
import { computeAnalytics } from '@/lib/analytics'
import { buildPagination, PAGE_SIZE, type LeadFilters } from '@/lib/leads-filter'
import { logger } from '@/lib/logger'
import type {
  Client,
  ConversionAnalytics,
  DashboardStats,
  Lead,
  Message,
  QualificationAnswer,
  ScheduledRelance,
} from '@/types'

// Liste des clients pour l'admin (config incluse, sans secrets de login).
export async function getClientsAdmin(): Promise<Pick<Client, 'id' | 'name' | 'sector' | 'config' | 'created_at'>[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, sector, config, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    logger.error('getClientsAdmin', { query: 'clients', error: error.message })
    return []
  }
  return (data ?? []) as Pick<Client, 'id' | 'name' | 'sector' | 'config' | 'created_at'>[]
}

// ============================================================
// Requêtes partagées dashboard — appelées directement par les
// server components (pas de fetch HTTP vers notre propre API).
// ============================================================

// clientId : null = admin (tous les leads), sinon scope sur ce client
export async function getLeads(clientId: string | null = null, limit = 100): Promise<Lead[]> {
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) {
    logger.error('getLeads', { query: 'leads', error: error.message })
    return []
  }
  return (data ?? []) as Lead[]
}

// Liste paginée + filtrée (statut, catégorie, recherche nom/email).
export async function getLeadsList(
  clientId: string | null,
  filters: LeadFilters
): Promise<{ leads: Lead[]; total: number }> {
  const { offset } = buildPagination(0, filters.page) // offset basé sur la page demandée
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (clientId) query = query.eq('client_id', clientId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.category) query = query.eq('score_category', filters.category)
  if (filters.search) {
    // search déjà nettoyé (parseFilters/sanitizeSearch)
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query
  if (error) {
    logger.error('getLeadsList', { query: 'leads', error: error.message })
    return { leads: [], total: 0 }
  }
  return { leads: (data ?? []) as Lead[], total: count ?? 0 }
}

// Leads filtrés pour l'export CSV : mêmes filtres que la liste, sans
// pagination (plafonné pour éviter un export démesuré).
export async function getLeadsForExport(
  clientId: string | null,
  filters: LeadFilters,
  cap = 5000
): Promise<Lead[]> {
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(cap)

  if (clientId) query = query.eq('client_id', clientId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.category) query = query.eq('score_category', filters.category)
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) {
    logger.error('getLeadsForExport', { query: 'leads', error: error.message })
    return []
  }
  return (data ?? []) as Lead[]
}

export async function getStats(clientId: string | null = null): Promise<DashboardStats | null> {
  let query = supabase.from('leads').select('status, score_category, created_at')
  if (clientId) query = query.eq('client_id', clientId)
  const { data: leads, error } = await query

  if (error) {
    logger.error('getStats', { query: 'leads', error: error.message })
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

export async function getAnalytics(clientId: string | null = null): Promise<ConversionAnalytics | null> {
  let leadsQuery = supabase
    .from('leads')
    .select('id, status, score_category, created_at, meeting_booked_at')
  if (clientId) leadsQuery = leadsQuery.eq('client_id', clientId)

  // Messages sortants des leads de ce scope uniquement (jointure implicite via lead_id)
  let msgQuery = supabase
    .from('messages')
    .select('lead_id, sent_at, leads!inner(client_id)')
    .eq('direction', 'out')
    .order('sent_at', { ascending: true })
  if (clientId) msgQuery = msgQuery.eq('leads.client_id', clientId)

  const [{ data: leads, error: leadsError }, { data: outMessages, error: msgError }] =
    await Promise.all([leadsQuery, msgQuery])

  if (leadsError || msgError) {
    logger.error('getAnalytics', { query: 'analytics', error: (leadsError ?? msgError)?.message })
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

export async function getLeadDetail(
  id: string,
  clientId: string | null = null
): Promise<{
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

  // Garde anti-IDOR : un client ne peut pas ouvrir le lead d'un autre
  // en devinant l'UUID. L'admin (clientId null) n'est pas restreint.
  if (clientId && (lead as Lead).client_id !== clientId) return null

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
