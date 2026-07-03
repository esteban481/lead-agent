// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LeadActions from './LeadActions'

const { refreshMock, pushMock } = vi.hoisted(() => ({ refreshMock: vi.fn(), pushMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}))

function mockFetch(ok: boolean, body: unknown = { ok: true }) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LeadActions — affichage selon le statut', () => {
  it('awaiting_reply : RDV pris + Disqualifier, pas de Rouvrir', () => {
    render(<LeadActions leadId="l1" status="awaiting_reply" />)
    expect(screen.getByText('Marquer RDV pris')).toBeTruthy()
    expect(screen.getByText('Disqualifier')).toBeTruthy()
    expect(screen.queryByText('Rouvrir')).toBeNull()
  })

  it('booked : pas de RDV pris, mais Rouvrir présent', () => {
    render(<LeadActions leadId="l1" status="booked" />)
    expect(screen.queryByText('Marquer RDV pris')).toBeNull()
    expect(screen.getByText('Rouvrir')).toBeTruthy()
  })
})

describe('LeadActions — actions', () => {
  it('book : POST la bonne action et rafraîchit', async () => {
    const fetchFn = mockFetch(true)
    render(<LeadActions leadId="lead-9" status="awaiting_reply" />)
    fireEvent.click(screen.getByText('Marquer RDV pris'))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, opts] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/leads/lead-9/action')
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({ action: 'book' })
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('disqualify : envoie la raison saisie via prompt', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Hors zone')
    const fetchFn = mockFetch(true)
    render(<LeadActions leadId="l1" status="awaiting_reply" />)
    fireEvent.click(screen.getByText('Disqualifier'))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    expect(JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      action: 'disqualify',
      reason: 'Hors zone',
    })
  })

  it('disqualify : annulé (prompt null) → aucune requête', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    const fetchFn = mockFetch(true)
    render(<LeadActions leadId="l1" status="awaiting_reply" />)
    fireEvent.click(screen.getByText('Disqualifier'))
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('affiche une erreur si l API échoue', async () => {
    mockFetch(false, { error: 'Interdit' })
    render(<LeadActions leadId="l1" status="awaiting_reply" />)
    fireEvent.click(screen.getByText('Marquer RDV pris'))
    await waitFor(() => expect(screen.getByText('Interdit')).toBeTruthy())
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
