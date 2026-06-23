import type { LeadStatus, ScoreCategory } from '@/types'

// ============================================================
// Filtres + pagination de la liste de leads — logique pure.
// ============================================================

export const PAGE_SIZE = 20

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'awaiting_reply',
  'qualifying',
  'scoring',
  'booked',
  'disqualified',
  'cold',
]

export const SCORE_CATEGORIES: ScoreCategory[] = ['A', 'B', 'C', 'D']

export interface LeadFilters {
  status: LeadStatus | null
  category: ScoreCategory | null
  search: string
  page: number
}

// Nettoie une recherche libre avant de l'injecter dans un filtre PostgREST
// `or(...ilike...)` : retire les caractères qui casseraient la syntaxe
// (virgules, parenthèses, jokers) et borne la longueur.
export function sanitizeSearch(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/[,()*%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

// Construit des filtres validés à partir des query params bruts de l'URL.
export function parseFilters(params: {
  status?: string
  category?: string
  q?: string
  page?: string
}): LeadFilters {
  const status = LEAD_STATUSES.includes(params.status as LeadStatus)
    ? (params.status as LeadStatus)
    : null
  const category = SCORE_CATEGORIES.includes(params.category as ScoreCategory)
    ? (params.category as ScoreCategory)
    : null
  const pageNum = parseInt(params.page ?? '1', 10)
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1
  return { status, category, search: sanitizeSearch(params.q), page }
}

export interface Pagination {
  page: number
  pageSize: number
  totalPages: number
  offset: number
  hasPrev: boolean
  hasNext: boolean
}

export function buildPagination(total: number, page: number, pageSize = PAGE_SIZE): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(page, 1), totalPages)
  return {
    page: current,
    pageSize,
    totalPages,
    offset: (current - 1) * pageSize,
    hasPrev: current > 1,
    hasNext: current < totalPages,
  }
}

// Sérialise les filtres en query string (pour les liens de pagination).
export function filtersToQuery(filters: LeadFilters, page: number): string {
  const sp = new URLSearchParams()
  if (filters.status) sp.set('status', filters.status)
  if (filters.category) sp.set('category', filters.category)
  if (filters.search) sp.set('q', filters.search)
  if (page > 1) sp.set('page', String(page))
  const s = sp.toString()
  return s ? `?${s}` : ''
}
