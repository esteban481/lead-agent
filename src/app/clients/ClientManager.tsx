'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_CLIENT_CONFIG } from '@/lib/client-config'
import { webhookEndpoint, integrationSnippet } from '@/lib/integration'

type ClientRow = {
  id: string
  name: string
  sector: string
  config: unknown
  created_at: string
}

export default function ClientManager({ clients }: { clients: ClientRow[] }) {
  return (
    <div className="space-y-6">
      <CreateClient />
      <div className="space-y-3">
        {clients.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun client.</p>
        ) : (
          clients.map((c) => <ClientCard key={c.id} client={c} />)
        )}
      </div>
    </div>
  )
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const btnCls = 'bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50'

function Feedback({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <p className={`text-sm ${msg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
  )
}

function CreateClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [sector, setSector] = useState('pac')
  const [config, setConfig] = useState(JSON.stringify(DEFAULT_CLIENT_CONFIG, null, 2))
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function submit() {
    setMsg(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(config)
    } catch {
      setMsg({ type: 'err', text: 'Config : JSON invalide.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sector, config: parsed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: 'ok', text: 'Client créé.' })
        setName('')
        router.refresh()
      } else {
        setMsg({ type: 'err', text: data.details ? data.details.join(' ') : data.error ?? 'Échec' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
      <h2 className="font-semibold">Nouveau client</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Secteur (ex: pac)" value={sector} onChange={(e) => setSector(e.target.value)} />
      </div>
      <textarea
        className={`${inputCls} font-mono text-xs`}
        rows={12}
        value={config}
        onChange={(e) => setConfig(e.target.value)}
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <button className={btnCls} disabled={loading} onClick={submit}>
          {loading ? 'Création…' : 'Créer le client'}
        </button>
        <Feedback msg={msg} />
      </div>
    </div>
  )
}

function ClientCard({ client }: { client: ClientRow }) {
  return (
    <details className="bg-white rounded-xl border border-gray-200 group">
      <summary className="px-6 py-4 cursor-pointer flex items-center justify-between list-none">
        <div>
          <span className="font-medium">{client.name}</span>
          <span className="text-sm text-gray-400 ml-2">{client.sector}</span>
        </div>
        <span className="text-xs text-gray-400 font-mono">{client.id.slice(0, 8)}…</span>
      </summary>
      <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-4">
        <ClientIntegration clientId={client.id} />
        <EditConfig client={client} />
        <SetLogin clientId={client.id} />
      </div>
    </details>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponible : l'utilisateur peut copier à la main */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {copied ? 'Copié ✓' : label}
    </button>
  )
}

function ClientIntegration({ clientId }: { clientId: string }) {
  // window.location.origin = l'origine déployée, sans variable d'env.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const endpoint = webhookEndpoint(origin, clientId)
  const snippet = integrationSnippet(origin, clientId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Intégration du formulaire</h3>
      </div>
      <p className="text-xs text-slate-500">
        Endpoint qui reçoit les leads de ce client :
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
          {endpoint}
        </code>
        <CopyButton text={endpoint} label="Copier" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Snippet HTML à coller sur le site du client (formulaire + envoi) :
      </p>
      <div className="relative">
        <pre className="max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          {snippet}
        </pre>
        <div className="mt-2">
          <CopyButton text={snippet} label="Copier le snippet" />
        </div>
      </div>
    </div>
  )
}

function EditConfig({ client }: { client: ClientRow }) {
  const router = useRouter()
  const [config, setConfig] = useState(JSON.stringify(client.config, null, 2))
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setMsg(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(config)
    } catch {
      setMsg({ type: 'err', text: 'JSON invalide.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: 'ok', text: 'Config enregistrée.' })
        router.refresh()
      } else {
        setMsg({ type: 'err', text: data.details ? data.details.join(' ') : data.error ?? 'Échec' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Config</h3>
      <textarea
        className={`${inputCls} font-mono text-xs`}
        rows={14}
        value={config}
        onChange={(e) => setConfig(e.target.value)}
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <button className={btnCls} disabled={loading} onClick={save}>
          {loading ? 'Enregistrement…' : 'Enregistrer la config'}
        </button>
        <Feedback msg={msg} />
      </div>
    </div>
  )
}

function SetLogin({ clientId }: { clientId: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: 'ok', text: 'Login défini.' })
        setPassword('')
      } else {
        setMsg({ type: 'err', text: data.error ?? 'Échec' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Accès dashboard du client</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Email de connexion" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Mot de passe (≥ 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button className={btnCls} disabled={loading} onClick={save}>
          {loading ? '…' : 'Définir le login'}
        </button>
        <Feedback msg={msg} />
      </div>
    </div>
  )
}
