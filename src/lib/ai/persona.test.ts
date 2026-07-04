import { describe, it, expect, vi, beforeEach } from 'vitest'
import { personaLine, scoringPersonaLine } from './persona'
import type { ClientConfig } from '@/types'

const withBranding = (name: string) =>
  ({ branding: { company_name: name } }) as unknown as ClientConfig

describe('personaLine', () => {
  it('nom + secteur', () => {
    expect(personaLine(withBranding('Acme PAC'), 'pompes à chaleur')).toBe(
      "Tu es l'assistant commercial de Acme PAC, une entreprise du secteur : pompes à chaleur."
    )
  })
  it('secteur seul', () => {
    expect(personaLine(undefined, 'plomberie')).toContain('secteur : plomberie')
  })
  it('nom seul', () => {
    expect(personaLine(withBranding('Acme'))).toBe("Tu es l'assistant commercial de Acme.")
  })
  it('fallback neutre sans rien', () => {
    const line = personaLine()
    expect(line).toContain('entreprise de services')
    expect(line).not.toContain('rénovation énergétique')
  })
})

describe('scoringPersonaLine', () => {
  it('inclut secteur et nom', () => {
    expect(scoringPersonaLine(withBranding('Acme'), 'plomberie')).toContain('Acme')
    expect(scoringPersonaLine(withBranding('Acme'), 'plomberie')).toContain('plomberie')
  })
  it('fallback neutre', () => {
    expect(scoringPersonaLine()).not.toContain('rénovation')
  })
})

// ============================================================
// Vérifie que les prompts réellement envoyés à Claude utilisent
// la persona du client — et plus le secteur hardcodé.
// ============================================================
const { callClaudeMock } = vi.hoisted(() => ({
  callClaudeMock: vi.fn(async () => '{"subject":"s","body":"b"}'),
}))
vi.mock('@/lib/anthropic', () => ({ callClaude: callClaudeMock }))

import { generateQualificationEmail, generateRelanceEmail, generateBookingEmail, generateDisqualificationEmail } from './generate'
import { scoreLead } from './score'
import type { Lead } from '@/types'

const lead = { id: 'l1', name: 'Jean', raw_data: {} } as unknown as Lead
const config = {
  qualification_questions: [{ key: 'surface', label: 'Surface ?' }],
  scoring_weights: { zone_covered: 100 },
  score_threshold_hot: 75,
  zone: ['91'],
  accepted_project_types: ['x'],
  rejected_project_types: ['y'],
  cal_booking_url: 'https://cal.com/x',
  from_email: 'a@b.fr',
  branding: { company_name: 'Plomberie Duval' },
} as unknown as ClientConfig

beforeEach(() => callClaudeMock.mockClear())

describe('prompts multi-secteur', () => {
  it('les 4 emails générés utilisent la persona du client', async () => {
    await generateQualificationEmail(lead, [], config, 'plomberie')
    await generateRelanceEmail(lead, 1, config, 'plomberie')
    await generateBookingEmail(lead, config, 'résumé', 'plomberie')
    await generateDisqualificationEmail(lead, 'raison', config, 'plomberie')

    for (const call of callClaudeMock.mock.calls) {
      const prompt = call[0] as string
      expect(prompt).toContain('Plomberie Duval')
      expect(prompt).toContain('plomberie')
      expect(prompt).not.toContain('rénovation énergétique')
    }
  })

  it('le scoring utilise la persona du client', async () => {
    callClaudeMock.mockResolvedValueOnce('{"details":{},"summary":"","missing_fields":[]}')
    await scoreLead(lead, [], config, 'plomberie')
    const prompt = callClaudeMock.mock.calls[0][0] as string
    expect(prompt).toContain('plomberie')
    expect(prompt).not.toContain('rénovation énergétique')
  })
})
