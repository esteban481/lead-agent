'use client'

import { useState } from 'react'

// Notes internes du commercial sur la fiche lead (non visibles du prospect).
export default function LeadNotes({
  leadId,
  initialNotes,
}: {
  leadId: string
  initialNotes: string | null
}) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function save() {
    setError(null)
    setSaved(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setSaved(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Enregistrement impossible')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold tracking-tight">Notes internes</h2>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
          setSaved(false)
        }}
        rows={4}
        placeholder="Contexte, points d'attention, suivi téléphonique…"
        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={save}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-sm text-emerald-700">Enregistré.</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </div>
  )
}
