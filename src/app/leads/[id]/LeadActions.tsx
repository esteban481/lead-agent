'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Boutons d'action manuelle sur la fiche lead.
// Affichés selon le statut courant ; POST puis rafraîchissement serveur.
export default function LeadActions({
  leadId,
  status,
}: {
  leadId: string
  status: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: 'book' | 'disqualify' | 'reopen') {
    let reason: string | undefined
    if (action === 'disqualify') {
      const input = window.prompt('Raison de la disqualification (optionnel) :') ?? undefined
      if (input === undefined) return // annulé
      reason = input
    }
    setError(null)
    setLoading(action)
    try {
      const res = await fetch(`/api/leads/${leadId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Action impossible')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(null)
    }
  }

  const btn =
    'rounded-xl border px-3.5 py-1.5 text-sm font-medium shadow-sm transition disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'booked' && (
        <button
          onClick={() => run('book')}
          disabled={loading !== null}
          className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
        >
          {loading === 'book' ? '…' : 'Marquer RDV pris'}
        </button>
      )}
      {status !== 'disqualified' && (
        <button
          onClick={() => run('disqualify')}
          disabled={loading !== null}
          className={`${btn} border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100`}
        >
          {loading === 'disqualify' ? '…' : 'Disqualifier'}
        </button>
      )}
      {['booked', 'disqualified', 'cold'].includes(status) && (
        <button
          onClick={() => run('reopen')}
          disabled={loading !== null}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          {loading === 'reopen' ? '…' : 'Rouvrir'}
        </button>
      )}
      {error && <span className="text-sm text-rose-600">{error}</span>}
    </div>
  )
}
