import { describe, it, expect } from 'vitest'
import { webhookEndpoint, integrationSnippet } from './integration'

describe('webhookEndpoint', () => {
  it('construit l endpoint avec le client_id', () => {
    expect(webhookEndpoint('https://app.exemple.fr', 'abc-123')).toBe(
      'https://app.exemple.fr/api/webhook/form?client_id=abc-123'
    )
  })
  it('supprime un slash final en trop', () => {
    expect(webhookEndpoint('https://app.exemple.fr/', 'x')).toBe(
      'https://app.exemple.fr/api/webhook/form?client_id=x'
    )
  })
})

describe('integrationSnippet', () => {
  const snippet = integrationSnippet('https://app.exemple.fr', 'cli-9')

  it('cible l endpoint du client', () => {
    expect(snippet).toContain('https://app.exemple.fr/api/webhook/form?client_id=cli-9')
  })
  it('poste en JSON via fetch (le webhook attend du JSON)', () => {
    expect(snippet).toContain("'Content-Type': 'application/json'")
    expect(snippet).toContain('JSON.stringify')
  })
  it('inclut le champ honeypot caché', () => {
    expect(snippet).toContain('name="website"')
    expect(snippet).toContain('display:none')
  })
  it('inclut les champs standard', () => {
    for (const f of ['name', 'email', 'phone', 'message']) {
      expect(snippet).toContain(`name="${f}"`)
    }
  })
})
