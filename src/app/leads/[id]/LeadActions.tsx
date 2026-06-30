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

  const btn = 'px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-50 transition-colors'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'booked' && (
        <button
          onClick={() => run('book')}
          disabled={loading !== null}
          className={`${btn} border-green-200 bg-green-50 text-green-800 hover:bg-green-100`}
        >
          {loading === 'book' ? '…' : 'Marquer RDV pris'}
        </button>
      )}
      {status !== 'disqualified' && (
        <button
          onClick={() => run('disqualify')}
          disabled={loading !== null}
          className={`${btn} border-red-200 bg-red-50 text-red-800 hover:bg-red-100`}
        >
          {loading === 'disqualify' ? '…' : 'Disqualifier'}
        </button>
      )}
      {['booked', 'disqualified', 'cold'].includes(status) && (
        <button
          onClick={() => run('reopen')}
          disabled={loading !== null}
          className={`${btn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
        >
          {loading === 'reopen' ? '…' : 'Rouvrir'}
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
