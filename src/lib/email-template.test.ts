import { describe, it, expect } from 'vitest'
import { renderEmailHtml, brandingFromConfig, appendOptOutNotice } from './email-template'
import type { ClientConfig } from '@/types'

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

  it('sans branding : pas d en-tête ni de pied, couleur par défaut (rétrocompatible)', () => {
    const html = renderEmailHtml('voir https://x.fr')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('border-top') // pas de pied de page
    expect(html).toContain('color:#2563eb') // lien en couleur par défaut
  })
})

describe('renderEmailHtml — branding', () => {
  it('affiche le nom de société en en-tête et en pied', () => {
    const html = renderEmailHtml('Bonjour', { companyName: 'Acme PAC' })
    expect(html).toContain('Acme PAC')
    expect(html).toContain('border-top') // pied de page
  })

  it('applique la couleur d accent valide aux liens', () => {
    const html = renderEmailHtml('voir https://x.fr', { color: '#ff6600' })
    expect(html).toContain('color:#ff6600')
  })

  it('ignore une couleur invalide (anti-injection CSS) → défaut', () => {
    const html = renderEmailHtml('voir https://x.fr', { color: 'red;}body{display:none' })
    expect(html).toContain('color:#2563eb')
    expect(html).not.toContain('display:none')
  })

  it('affiche un logo https en <img>', () => {
    const html = renderEmailHtml('Bonjour', { logoUrl: 'https://cdn.test/logo.png', companyName: 'Acme' })
    expect(html).toContain('<img src="https://cdn.test/logo.png"')
  })

  it('ignore un logo non-https (sécurité) et retombe sur le nom', () => {
    const html = renderEmailHtml('Bonjour', { logoUrl: 'http://insecure/logo.png', companyName: 'Acme' })
    expect(html).not.toContain('<img')
    expect(html).toContain('Acme')
  })
})

describe('appendOptOutNotice', () => {
  it('ajoute la mention STOP en pied de texte', () => {
    const out = appendOptOutNotice('Bonjour Jean,\n\nVoici le lien.')
    expect(out).toContain('Répondez simplement STOP')
    expect(out.startsWith('Bonjour Jean,')).toBe(true)
  })

  it('ne double jamais la mention', () => {
    const once = appendOptOutNotice('corps')
    const twice = appendOptOutNotice(once)
    expect(twice.match(/STOP/g)?.length).toBe(1)
  })

  it('la mention est rendue dans le HTML', () => {
    const html = renderEmailHtml(appendOptOutNotice('Bonjour'))
    expect(html).toContain('Répondez simplement STOP')
  })
})

describe('brandingFromConfig', () => {
  it('extrait les champs de branding de la config', () => {
    const config = { branding: { company_name: 'Acme', color: '#123456', logo_url: 'https://x/l.png' } } as unknown as ClientConfig
    expect(brandingFromConfig(config)).toEqual({ companyName: 'Acme', color: '#123456', logoUrl: 'https://x/l.png' })
  })
  it('retourne des champs vides si pas de branding', () => {
    expect(brandingFromConfig({} as ClientConfig)).toEqual({ companyName: undefined, color: undefined, logoUrl: undefined })
  })
})
