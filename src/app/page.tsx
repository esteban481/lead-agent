import Link from 'next/link'
import type { DashboardStats, Lead } from '@/types'

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

async function getLeads(): Promise<Lead[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/leads?limit=100`, {
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.leads ?? []
}

async function getStats(): Promise<DashboardStats | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/stats`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export default async function DashboardPage() {
  const [leads, stats] = await Promise.all([getLeads(), getStats()])

  return (
    <div className="space-y-8">
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Leads reçus" value={stats.total_leads} />
          <StatCard label="Contactés" value={stats.leads_contacted} />
          <StatCard label="Qualifiés" value={stats.leads_qualified} />
          <StatCard label="RDV pris" value={stats.leads_booked} highlight />
        </div>
      )}

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
        <h2 className="text-base font-semibold mb-4">
          Tous les leads ({leads.length})
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {leads.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Aucun lead pour le moment.
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
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
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
