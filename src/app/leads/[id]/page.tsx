import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Lead, Message, QualificationAnswer, ScheduledRelance } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800',
}

async function getLeadDetail(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/leads/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json() as Promise<{
    lead: Lead
    messages: Message[]
    qualification_answers: QualificationAnswer[]
    scheduled_relances: ScheduledRelance[]
  }>
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getLeadDetail(id)
  if (!data) notFound()

  const { lead, messages, qualification_answers, scheduled_relances } = data

  return (
    <div className="space-y-6">
      {/* Retour */}
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← Retour au dashboard
      </Link>

      {/* En-tête lead */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold">{lead.name ?? 'Prospect sans nom'}</h1>
            <div className="text-sm text-gray-500 mt-1 space-x-4">
              {lead.email && <span>{lead.email}</span>}
              {lead.phone && <span>{lead.phone}</span>}
              <span>Source : {lead.source}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
              {lead.status}
            </span>
            {lead.score_category && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold ${CATEGORY_COLORS[lead.score_category]}`}
              >
                Score {lead.score_category} — {lead.score}/100
              </span>
            )}
          </div>
        </div>

        {/* Résumé IA */}
        {lead.ai_summary && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-900">
            <span className="font-medium">Résumé IA : </span>
            {lead.ai_summary}
          </div>
        )}

        {/* Disqualification */}
        {lead.disqualified_reason && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg text-sm text-red-800">
            <span className="font-medium">Raison de disqualification : </span>
            {lead.disqualified_reason}
          </div>
        )}

        {/* RDV */}
        {lead.meeting_booked_at && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg text-sm text-green-800">
            RDV confirmé le{' '}
            {new Date(lead.meeting_booked_at).toLocaleString('fr-FR')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Qualification */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Données de qualification</h2>
          {qualification_answers.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune réponse collectée.</p>
          ) : (
            <dl className="space-y-2">
              {qualification_answers.map((a) => (
                <div key={a.id} className="flex gap-2 text-sm">
                  <dt className="text-gray-500 shrink-0">{a.question_key} :</dt>
                  <dd className="font-medium">{a.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Relances planifiées */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Relances</h2>
          {scheduled_relances.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune relance planifiée.</p>
          ) : (
            <ul className="space-y-2">
              {scheduled_relances.map((r) => (
                <li key={r.id} className="text-sm flex justify-between">
                  <span className="text-gray-700">Relance #{r.step}</span>
                  <span className="text-gray-400">
                    {new Date(r.scheduled_at).toLocaleString('fr-FR')} —{' '}
                    <span
                      className={
                        r.status === 'sent'
                          ? 'text-green-600'
                          : r.status === 'cancelled'
                          ? 'text-gray-400'
                          : 'text-orange-600'
                      }
                    >
                      {r.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Historique des messages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold mb-4">Historique des échanges</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun message.</p>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg text-sm ${
                  msg.direction === 'out'
                    ? 'bg-blue-50 border border-blue-100'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex justify-between mb-2 text-xs text-gray-400">
                  <span>{msg.direction === 'out' ? 'Envoyé' : 'Reçu'}</span>
                  <span>
                    {new Date(msg.sent_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                {msg.subject && (
                  <div className="font-medium mb-1">{msg.subject}</div>
                )}
                <pre className="whitespace-pre-wrap font-sans text-gray-700">
                  {msg.body}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
