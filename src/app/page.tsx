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
  A: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  B: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  C: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  D: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
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
  new: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  awaiting_reply: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  qualifying: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  scoring: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  booked: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  disqualified: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
  cold: 'bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200',
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
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
        <div className="flex flex-wrap gap-2">
          {(['A', 'B', 'C', 'D'] as const).map((cat) => (
            <div
              key={cat}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${CATEGORY_COLORS[cat]}`}
            >
              {cat} · {stats.by_category[cat]}
            </div>
          ))}
        </div>
      )}

      {/* Liste des leads */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            Leads ({list.total})
          </h2>
          <div className="flex items-center gap-3">
            {list.total > 0 && (
              <a
                href={`/api/leads/export${filtersToQuery(filters, 1)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M7.5 1.5v8m0 0L4.5 6.5m3 3l3-3M2.5 12.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exporter CSV
              </a>
            )}
            <span className="text-sm text-slate-400">
              Page {pagination.page} / {pagination.totalPages}
            </span>
          </div>
        </div>

        <FilterBar filters={filters} />

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {leads.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">
              Aucun lead ne correspond à ces critères.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="group flex items-center gap-3"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                          {initials(lead.name)}
                        </span>
                        <span className="font-medium text-slate-900 group-hover:text-indigo-700 group-hover:underline">
                          {lead.name ?? '—'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{lead.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[lead.status] ?? ''}`}
                      >
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                      {lead.last_error && (
                        <span
                          className="ml-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
                          title={lead.last_error}
                        >
                          ⚠ erreur
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.score_category ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${CATEGORY_COLORS[lead.score_category]}`}
                        >
                          {lead.score_category} · {lead.score}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {pagination.hasPrev ? (
              <Link
                href={`/${filtersToQuery(filters, pagination.page - 1)}`}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                ← Précédent
              </Link>
            ) : (
              <span className="px-3.5 py-2 text-slate-300">← Précédent</span>
            )}
            <span className="text-slate-400">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            {pagination.hasNext ? (
              <Link
                href={`/${filtersToQuery(filters, pagination.page + 1)}`}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Suivant →
              </Link>
            ) : (
              <span className="px-3.5 py-2 text-slate-300">Suivant →</span>
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
  const inputCls =
    'rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="q">
          Recherche
        </label>
        <input
          id="q"
          name="q"
          type="text"
          defaultValue={filters.search}
          placeholder="Nom ou email…"
          className={`${inputCls} w-full`}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="status">
          Statut
        </label>
        <select id="status" name="status" defaultValue={filters.status ?? ''} className={inputCls}>
          <option value="">Tous</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS_FORM[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="category">
          Catégorie
        </label>
        <select id="category" name="category" defaultValue={filters.category ?? ''} className={inputCls}>
          <option value="">Toutes</option>
          {SCORE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
      >
        Filtrer
      </button>
      {hasFilter && (
        <Link href="/" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-900">
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
      className={`rounded-2xl border p-4 shadow-sm ${
        highlight
          ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div
        className={`text-2xl font-bold tracking-tight ${
          highlight ? 'text-indigo-700' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Conversion</h2>
        <p className="mb-5 mt-0.5 text-xs text-slate-400">
          Du lead reçu au rendez-vous confirmé
        </p>
        <div className="space-y-2.5">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-sm text-slate-600">{step.label}</div>
              <div className="h-8 flex-1 overflow-hidden rounded-lg bg-slate-100">
                <div
                  className={`flex h-full items-center rounded-lg px-3 text-sm font-semibold text-white ${
                    i === steps.length - 1 ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.max((step.value / max) * 100, 8)}%` }}
                >
                  {step.value}
                </div>
              </div>
              <div className="w-20 shrink-0 text-right text-sm text-slate-400">
                {step.rate === null ? '' : `${formatRate(step.rate)} →`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Métriques clés */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
