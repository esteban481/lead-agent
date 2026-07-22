// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ClientManager from './ClientManager'

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }))

function mockFetch(ok: boolean, body: unknown = { ok: true, id: 'new-1' }) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

const CLIENT = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  name: 'Acme PAC',
  sector: 'pac',
  config: { from_email: 'x@y.fr', qualification_questions: [] },
  created_at: '2026-07-01T10:00:00Z',
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ClientManager — création', () => {
  it('poste un nouveau client avec la config parsée', async () => {
    const fetchFn = mockFetch(true)
    render(<ClientManager clients={[]} />)

    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Nouveau' } })
    fireEvent.click(screen.getByText('Créer le client'))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, opts] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/clients')
    const payload = JSON.parse((opts as RequestInit).body as string)
    expect(payload.name).toBe('Nouveau')
    expect(typeof payload.config).toBe('object') // config JSON parsée, pas une string
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('config JSON invalide → erreur affichée, aucune requête', async () => {
    const fetchFn = mockFetch(true)
    render(<ClientManager clients={[]} />)

    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'X' } })
    // le formulaire de création n'a qu'un textarea (la config)
    fireEvent.change(document.querySelector('textarea')!, { target: { value: '{pas du json' } })
    fireEvent.click(screen.getByText('Créer le client'))

    await waitFor(() => expect(screen.getByText(/JSON invalide/i)).toBeTruthy())
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('liste vide affiche « Aucun client »', () => {
    render(<ClientManager clients={[]} />)
    expect(screen.getByText('Aucun client.')).toBeTruthy()
  })
})

describe('ClientManager — carte client & intégration', () => {
  it('affiche le panneau d intégration avec l endpoint du client et les boutons copier', () => {
    render(<ClientManager clients={[CLIENT]} />)

    expect(screen.getByText('Acme PAC')).toBeTruthy()
    expect(screen.getByText('Intégration du formulaire')).toBeTruthy()

    // endpoint ciblant ce client
    const code = [...document.querySelectorAll('code')].map((c) => c.textContent).join(' ')
    expect(code).toContain(`/api/webhook/form?client_id=${CLIENT.id}`)

    // snippet avec honeypot
    const pre = document.querySelector('pre')?.textContent ?? ''
    expect(pre).toContain('name="website"')
    expect(pre).toContain('fetch(')

    expect(screen.getByText('Copier')).toBeTruthy()
    expect(screen.getByText('Copier le snippet')).toBeTruthy()
  })
})
