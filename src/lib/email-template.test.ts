import { describe, it, expect } from 'vitest'
import { renderEmailHtml } from './email-template'

describe('renderEmailHtml', () => {
  it('échappe le HTML du corps (anti-injection)', () => {
    const html = renderEmailHtml('Bonjour <script>alert(1)</script> & cie')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp; cie')
  })

  it('transforme une URL en lien cliquable', () => {
    const html = renderEmailHtml('Réservez ici : https://cal.com/jean/15min')
    expect(html).toContain('<a href="https://cal.com/jean/15min"')
    expect(html).toContain('>https://cal.com/jean/15min</a>')
  })

  it('échappe correctement une URL avec paramètres (& → &amp;)', () => {
    const html = renderEmailHtml('https://cal.com/x?a=1&b=2')
    expect(html).toContain('href="https://cal.com/x?a=1&amp;b=2"')
  })

  it('sépare les paragraphes (\\n\\n) et garde les retours simples (<br>)', () => {
    const html = renderEmailHtml('Ligne 1\nLigne 2\n\nParagraphe 2')
    expect((html.match(/<p /g) ?? []).length).toBe(2)
    expect(html).toContain('Ligne 1<br>Ligne 2')
  })

  it('produit un conteneur HTML', () => {
    expect(renderEmailHtml('coucou')).toMatch(/^<div style=.*<\/div>$/s)
  })

  it('gère un corps vide sans planter', () => {
    expect(() => renderEmailHtml('')).not.toThrow()
  })
})
