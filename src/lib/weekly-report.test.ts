import { describe, it, expect } from 'vitest'
import { buildWeeklyReport } from './weekly-report'
import type { Lead } from '@/types'

type Row = Pick<Lead, 'id' | 'status' | 'score_category' | 'created_at' | 'meeting_booked_at'>

function lead(over: Partial<Row>): Row {
  return {
    id: 'x',
    status: 'awaiting_reply',
    score_category: null,
    created_at: '2026-07-10T10:00:00Z',
    meeting_booked_at: null,
    ...over,
  }
}

describe('buildWeeklyReport', () => {
  it('semaine active : chiffres du funnel + RDV + temps de réponse', () => {
    const leads = [
      lead({ id: '1', score_category: 'A', status: 'booked', meeting_booked_at: '2026-07-11T10:00:00Z' }),
      lead({ id: '2', score_category: 'C' }),
      lead({ id: '3', status: 'new' }),
    ]
    const { subject, body } = buildWeeklyReport({
      companyName: 'Acme PAC',
      leads,
      firstOutboundByLead: { '1': '2026-07-10T10:02:00Z', '2': '2026-07-10T10:04:00Z' },
      bookedInWindow: 1,
    })

    expect(subject).toContain('3 leads')
    expect(subject).toContain('1 RDV pris')
    expect(body).toContain('Leads reçus : 3')
    expect(body).toContain('Contactés en votre nom : 2')
    expect(body).toContain('Qualifiés (scorés) : 2')
    expect(body).toContain('Rendez-vous confirmés : 1')
    expect(body).toContain('première réponse : 3 min')
    expect(body).toContain('Acme PAC')
  })

  it('semaine calme : message de veille, pas de funnel', () => {
    const { subject, body } = buildWeeklyReport({
      leads: [],
      firstOutboundByLead: {},
      bookedInWindow: 0,
    })
    expect(subject).toContain('0 lead')
    expect(body).toContain('Semaine calme')
    expect(body).not.toContain('Leads reçus :')
  })

  it('compte les RDV de la fenêtre même sans lead créé cette semaine', () => {
    const { subject, body } = buildWeeklyReport({
      leads: [],
      firstOutboundByLead: {},
      bookedInWindow: 2,
    })
    expect(subject).toContain('2 RDV pris')
    expect(body).toContain('Rendez-vous confirmés : 2')
  })

  it('mentionne les hors cible / sans réponse quand il y en a', () => {
    const leads = [lead({ id: '1', status: 'cold' }), lead({ id: '2', status: 'disqualified' })]
    const { body } = buildWeeklyReport({ leads, firstOutboundByLead: {}, bookedInWindow: 0 })
    expect(body).toContain('Hors cible ou sans réponse : 2')
  })
})
