import { describe, it, expect } from 'vitest'
import {
  sanitizeSearch,
  parseFilters,
  buildPagination,
  filtersToQuery,
  PAGE_SIZE,
} from './leads-filter'

describe('sanitizeSearch', () => {
  it('retire les caractères qui casseraient le filtre PostgREST', () => {
    expect(sanitizeSearch('jean, (dupont) *%')).toBe('jean dupont')
  })
  it('réduit les espaces multiples et trim', () => {
    expect(sanitizeSearch('  a   b  ')).toBe('a b')
  })
  it('borne la longueur à 80', () => {
    expect(sanitizeSearch('x'.repeat(200)).length).toBe(80)
  })
  it('gère null/undefined', () => {
    expect(sanitizeSearch(null)).toBe('')
    expect(sanitizeSearch(undefined)).toBe('')
  })
})

describe('parseFilters', () => {
  it('valide statut et catégorie, ignore les valeurs inconnues', () => {
    expect(parseFilters({ status: 'booked', category: 'A' })).toMatchObject({
      status: 'booked',
      category: 'A',
    })
    expect(parseFilters({ status: 'pirate', category: 'Z' })).toMatchObject({
      status: null,
      category: null,
    })
  })
  it('page par défaut = 1, refuse les pages invalides', () => {
    expect(parseFilters({}).page).toBe(1)
    expect(parseFilters({ page: '0' }).page).toBe(1)
    expect(parseFilters({ page: '-3' }).page).toBe(1)
    expect(parseFilters({ page: '4' }).page).toBe(4)
  })
})

describe('buildPagination', () => {
  it('calcule pages, offset et bornes', () => {
    const p = buildPagination(45, 2)
    expect(p.totalPages).toBe(Math.ceil(45 / PAGE_SIZE))
    expect(p.offset).toBe(PAGE_SIZE)
    expect(p.hasPrev).toBe(true)
    expect(p.hasNext).toBe(true)
  })
  it('clamp une page hors bornes', () => {
    const p = buildPagination(10, 99)
    expect(p.page).toBe(1) // 10 leads → 1 page
    expect(p.hasNext).toBe(false)
  })
  it('total 0 → 1 page, pas de suivant', () => {
    const p = buildPagination(0, 1)
    expect(p.totalPages).toBe(1)
    expect(p.hasPrev).toBe(false)
    expect(p.hasNext).toBe(false)
  })
})

describe('filtersToQuery', () => {
  it('sérialise les filtres actifs et la page', () => {
    const q = filtersToQuery({ status: 'booked', category: 'A', search: 'jean', page: 1 }, 3)
    expect(q).toContain('status=booked')
    expect(q).toContain('category=A')
    expect(q).toContain('q=jean')
    expect(q).toContain('page=3')
  })
  it('omet la page 1 et les filtres vides', () => {
    expect(filtersToQuery({ status: null, category: null, search: '', page: 1 }, 1)).toBe('')
  })
})
