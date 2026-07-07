// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import DemoForm from './DemoForm'

function mockFetch(status: number) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => ({}) })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

function fill() {
  fireEvent.change(screen.getByPlaceholderText('Votre nom'), { target: { value: 'Jean' } })
  fireEvent.change(screen.getByPlaceholderText(/votre email/i), { target: { value: 'jean@test.fr' } })
  fireEvent.change(screen.getByPlaceholderText(/décrivez votre projet/i), { target: { value: 'PAC pour maison 120m2' } })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DemoForm', () => {
  it('envoie le lead au webhook du client démo et affiche le succès', async () => {
    const fetchFn = mockFetch(200)
    render(<DemoForm clientId="demo-123" />)
    fill()
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, opts] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/webhook/form?client_id=demo-123')
    const body = JSON.parse((opts as RequestInit).body as string)
    expect(body).toMatchObject({ name: 'Jean', email: 'jean@test.fr', source: 'demo_page' })
    expect(body.website).toBe('') // honeypot vide pour un humain

    await waitFor(() => expect(screen.getByText(/c.est parti/i)).toBeTruthy())
  })

  it('le honeypot est présent mais caché', () => {
    render(<DemoForm clientId="demo-123" />)
    const hp = document.querySelector('input[name="website"]') as HTMLInputElement
    expect(hp).toBeTruthy()
    expect(hp.className).toContain('hidden')
    expect(hp.tabIndex).toBe(-1)
  })

  it('affiche le message rate-limit sur 429', async () => {
    mockFetch(429)
    render(<DemoForm clientId="demo-123" />)
    fill()
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText(/trop de demandes/i)).toBeTruthy())
  })
})
