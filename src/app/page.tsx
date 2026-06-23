import Link from 'next/link'
import { getLeadsList, getStats, getAnalytics } from '@/lib/queries'
import { getPrincipal, scopeOf } from '@/lib/auth'
import {
  parseFilters,
  buildPagination,
  filtersToQuery,
  LEAD_STATUSES,
  SCORE_CATEGORIES,
  type LeadFilters,
} from '@/lib/leads-filter'
import type { ConversionAnalytics } from '@/types'

export const dynamic = 'force-dynamic'

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  awaiting_reply: 'En attente',
  qualifying: 'Qualification',
  scoring: 'Scoring',
  booked: 'RDV pris',
  disqualified: 'Disqualifié',
  cold: 'Froid',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  awaiting_reply: 'bg-orange-100 text-orange-700',
  qualifying: 'bg-blue-100 text-blue-700',
  scoring: 'bg-purple-100 text-purple-700',
  booked: 'bg-green-100 text-green-800',
  disqualified: 'bg-red-100 text-red-700',
  cold: 'bg-gray-100 text-gray-500',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string; page?: string }>
}) {
  const filters = parseFilters(await searchParams)
  const scope = scopeOf(await getPrincipal())
  const [list, stats, analytics] = await Promise.all([
    getLeadsList(scope, filters),
    getStats(scope),
    getAnalytics(scope),
  ])
  const leads = list.leads
  const pagination = buildPagination(list.total, filters.page)

  return (
    <div className="space-y-8">
      {/* Conversion : funnel + métriques clés */}
      {analytics && <ConversionSection analytics={analytics} />}

      {/* Répartition par catégorie */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          {(['A', 'B', 'C', 'D'] as const).map((cat) => (
            <div
              key={cat}
              className={`px-4 py-2 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat]}`}
            >
              {cat} — {stats.by_category[cat]}
            </div>
          ))}
        </div>
      )}

      {/* Liste des leads */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-base font-semibold">
            Leads ({list.total})
          </h2>
          <span className="text-sm text-gray-400">
            Page {pagination.page} / {pagination.totalPages}
          </span>
        </div>

        <FilterBar filters={filters} />

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {leads.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Aucun lead ne correspond à ces critères.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nom</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {lead.name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{lead.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[lead.status] ?? ''}`}
                      >
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.score_category ? (
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${CATEGORY_COLORS[lead.score_category]}`}
                        >
                          {lead.score_category} — {lead.score}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            {pagination.hasPrev ? (
              <Link
                href={`/${filtersToQuery(filters, pagination.page - 1)}`}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              >
                ← Précédent
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-gray-300">← Précédent</span>
            )}
            <span className="text-gray-400">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            {pagination.hasNext ? (
              <Link
                href={`/${filtersToQuery(filters, pagination.page + 1)}`}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              >
                Suivant →
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-gray-300">Suivant →</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Barre de filtres — formulaire GET (server-rendered, URL partageable)
function FilterBar({ filters }: { filters: LeadFilters }) {
  const STATUS_LABELS_FORM: Record<string, string> = {
    new: 'Nouveau',
    awaiting_reply: 'En attente',
    qualifying: 'Qualification',
    scoring: 'Scoring',
    booked: 'RDV pris',
    disqualified: 'Disqualifié',
    cold: 'Froid',
  }
  const hasFilter = filters.status || filters.category || filters.search

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-gray-500 mb-1" htmlFor="q">Recherche</label>
        <input
          id="q"
          name="q"
          type="text"
          defaultValue={filters.search}
          placeholder="Nom ou email…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1" htmlFor="status">Statut</label>
        <select
          id="status"
          name="status"
          defaultValue={filters.status ?? ''}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS_FORM[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1" htmlFor="category">Catégorie</label>
        <select
          id="category"
          name="category"
          defaultValue={filters.category ?? ''}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toutes</option>
          {SCORE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
      >
        Filtrer
      </button>
      {hasFilter && (
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 px-2 py-2">
          Réinitialiser
        </Link>
      )}
    </form>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${highlight ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
    >
      <div className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

// ============================================================
// Section conversion : funnel + métriques clés
// ============================================================
function ConversionSection({ analytics }: { analytics: ConversionAnalytics }) {
  const { funnel, rates } = analytics

  const steps = [
    { label: 'Reçus', value: funnel.received, rate: null as number | null },
    { label: 'Contactés', value: funnel.contacted, rate: rates.contact_rate },
    { label: 'Qualifiés', value: funnel.qualified, rate: rates.qualification_rate },
    { label: 'RDV pris', value: funnel.booked, rate: rates.booking_rate },
  ]
  const max = Math.max(funnel.received, 1)

  return (
    <div className="space-y-4">
      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold mb-4">Conversion</h2>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600 shrink-0">{step.label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                <div
                  className={`h-full rounded-full flex items-center px-3 text-sm font-medium text-white ${
                    i === steps.length - 1 ? 'bg-green-600' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.max((step.value / max) * 100, 8)}%` }}
                >
                  {step.value}
                </div>
              </div>
              <div className="w-20 text-right text-sm text-gray-400 shrink-0">
                {step.rate === null ? '' : `${formatRate(step.rate)} →`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Métriques clés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Conversion globale"
          value={formatRate(rates.overall_conversion)}
          highlight
        />
        <StatCard label="Temps de 1er contact" value={formatMinutes(analytics.avg_minutes_to_first_contact)} />
        <StatCard label="Délai moyen jusqu'au RDV" value={formatHours(analytics.avg_hours_to_booking)} />
        <StatCard label="Perdus (froids + disqualifiés)" value={`${analytics.cold + analytics.disqualified}`} />
      </div>
    </div>
  )
}

function formatRate(r: number | null): string {
  return r === null ? '—' : `${Math.round(r * 100)}%`
}

function formatMinutes(m: number | null): string {
  if (m === null) return '—'
  if (m < 1) return '< 1 min'
  if (m < 60) return `${m} min`
  return `${(m / 60).toFixed(1)} h`
}

function formatHours(h: number | null): string {
  if (h === null) return '—'
  if (h < 48) return `${h} h`
  return `${Math.round(h / 24)} j`
}
