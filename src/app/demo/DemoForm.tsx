'use client'

import { useState } from 'react'

// Formulaire de démo live : envoie un vrai lead au client démo via le
// webhook public. Le visiteur joue le prospect et reçoit le véritable
// email de qualification de l'agent dans sa boîte mail.
//
// Le champ "website" est un honeypot : invisible pour un humain,
// rempli par les bots → lead ignoré silencieusement côté serveur.
export default function DemoForm({ clientId }: { clientId: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setState('loading')
    try {
      const res = await fetch(`/api/webhook/form?client_id=${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, website, source: 'demo_page' }),
      })
      if (res.ok) {
        setState('done')
      } else if (res.status === 429) {
        setState('idle')
        setError('Trop de demandes — réessayez dans une minute.')
      } else {
        setState('idle')
        setError('Envoi impossible, réessayez.')
      }
    } catch {
      setState('idle')
      setError('Erreur réseau, réessayez.')
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-emerald-100">
          <svg width="18" height="18" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6.5L5 9l4.5-6" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="font-semibold text-emerald-800 text-lg">C&apos;est parti !</p>
        <p className="text-sm text-emerald-800 mt-2">
          Ouvrez votre boîte mail : l&apos;agent vous répond d&apos;ici une minute.
          Répondez-lui comme un vrai prospect pour voir la qualification,
          le scoring et la prise de rendez-vous en action.
        </p>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Votre nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={inputCls}
          type="email"
          placeholder="Votre email (vous recevrez la réponse ici)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <input
        className={inputCls}
        placeholder="Téléphone (optionnel)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <textarea
        className={inputCls}
        rows={3}
        placeholder="Décrivez votre projet en une phrase, comme le ferait un prospect…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      {/* Honeypot anti-bot : invisible pour un humain */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {state === 'loading' ? 'Envoi…' : 'Recevoir la réponse de l’agent'}
      </button>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <p className="text-xs text-slate-400 text-center">
        Démo réelle : un email automatique vous sera envoyé. Aucune inscription, aucune donnée revendue.
      </p>
    </form>
  )
}
