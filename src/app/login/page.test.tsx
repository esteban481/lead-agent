// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LoginPage from './page'

const { pushMock, refreshMock } = vi.hoisted(() => ({ pushMock: vi.fn(), refreshMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => ({ get: (k: string) => (k === 'next' ? '/cible' : null) }),
}))

function mockFetch(ok: boolean, body: unknown = { ok: true }) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

function fill() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin' } })
  fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'secret123' } })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('connexion réussie → POST identifiants puis redirige vers next', async () => {
    const fetchFn = mockFetch(true)
    render(<LoginPage />)
    fill()
    fireEvent.click(screen.getByText('Se connecter'))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, opts] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({ email: 'admin', password: 'secret123' })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cible'))
  })

  it('échec → affiche le message d erreur, pas de redirection', async () => {
    mockFetch(false, { error: 'Identifiants invalides' })
    render(<LoginPage />)
    fill()
    fireEvent.click(screen.getByText('Se connecter'))

    await waitFor(() => expect(screen.getByText('Identifiants invalides')).toBeTruthy())
    expect(pushMock).not.toHaveBeenCalled()
  })
})
