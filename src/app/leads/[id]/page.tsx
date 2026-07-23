import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLeadDetail } from '@/lib/queries'
import { getPrincipal, scopeOf } from '@/lib/auth'
import LeadActions from './LeadActions'
import LeadNotes from './LeadNotes'

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

const RELANCE_STATUS: Record<string, { label: string; dot: string; text: string }> = {
  sent: { label: 'envoyée', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  cancelled: { label: 'annulée', dot: 'bg-slate-300', text: 'text-slate-400' },
  pending: { label: 'planifiée', dot: 'bg-orange-400', text: 'text-orange-600' },
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const scope = scopeOf(await getPrincipal())
  const data = await getLeadDetail(id, scope)
  if (!data) notFound()

  const { lead, messages, qualification_answers, scheduled_relances } = data

  return (
    <div className="space-y-6">
      {/* Retour */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>

      {/* En-tête lead */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
              {initials(lead.name)}
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{lead.name ?? 'Prospect sans nom'}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                {lead.email && <span>{lead.email}</span>}
                {lead.phone && <span>{lead.phone}</span>}
                <span>Source : {lead.source}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {STATUS_LABELS[lead.status] ?? lead.status}
            </span>
            {lead.score_category && (
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${CATEGORY_COLORS[lead.score_category]}`}>
                {lead.score_category} · {lead.score}/100
              </span>
            )}
          </div>
        </div>

        {/* Résumé IA */}
        {lead.ai_summary && (
          <div className="mt-4 rounded-xl bg-indigo-50/70 p-4 text-sm text-indigo-900 ring-1 ring-inset ring-indigo-100">
            <span className="font-medium">Résumé IA : </span>
            {lead.ai_summary}
          </div>
        )}

        {/* Erreur technique de traitement */}
        {lead.last_error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
            <span className="font-medium">Erreur technique : </span>
            {lead.last_error}
            <span className="mt-1 block text-xs text-rose-600">
              Le dernier traitement automatique a échoué — vérifier le lead, puis « Rouvrir » pour effacer.
            </span>
          </div>
        )}

        {/* Disqualification */}
        {lead.disqualified_reason && (
          <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
            <span className="font-medium">Raison de disqualification : </span>
            {lead.disqualified_reason}
          </div>
        )}

        {/* RDV */}
        {lead.meeting_booked_at && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
            RDV confirmé le {new Date(lead.meeting_booked_at).toLocaleString('fr-FR')}
          </div>
        )}

        {/* Actions manuelles */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <LeadActions leadId={lead.id} status={lead.status} />
        </div>
      </div>

      {/* Notes internes */}
      <LeadNotes leadId={lead.id} initialNotes={lead.notes} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Qualification */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold tracking-tight">Données de qualification</h2>
          {qualification_answers.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune réponse collectée.</p>
          ) : (
            <dl className="space-y-2.5">
              {qualification_answers.map((a) => (
                <div key={a.id} className="flex gap-2 text-sm">
                  <dt className="shrink-0 text-slate-500">{a.question_key} :</dt>
                  <dd className="font-medium text-slate-900">{a.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Relances planifiées */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold tracking-tight">Relances</h2>
          {scheduled_relances.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune relance planifiée.</p>
          ) : (
            <ul className="space-y-2.5">
              {scheduled_relances.map((r) => {
                const s = RELANCE_STATUS[r.status] ?? RELANCE_STATUS.pending
                return (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      Relance #{r.step}
                    </span>
                    <span className="text-slate-400">
                      {new Date(r.scheduled_at).toLocaleString('fr-FR')} —{' '}
                      <span className={s.text}>{s.label}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Historique des messages */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold tracking-tight">Historique des échanges</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun message.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 text-sm ring-1 ring-inset ${
                  msg.direction === 'out'
                    ? 'bg-indigo-50/60 ring-indigo-100'
                    : 'bg-slate-50 ring-slate-200'
                }`}
              >
                <div className="mb-2 flex justify-between text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      msg.direction === 'out'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {msg.direction === 'out' ? 'Envoyé' : 'Reçu'}
                  </span>
                  <span className="text-slate-400">
                    {new Date(msg.sent_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                {msg.subject && <div className="mb-1 font-medium text-slate-900">{msg.subject}</div>}
                <pre className="whitespace-pre-wrap font-sans text-slate-700">{msg.body}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
