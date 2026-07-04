import type { ClientConfig } from '@/types'

// ============================================================
// Persona de l'assistant dans les prompts IA.
//
// Historiquement, les 5 prompts disaient en dur « entreprise de
// rénovation énergétique » : tout client d'un autre secteur
// recevait des emails hors sujet. La persona est désormais
// construite depuis les données du client :
//  - config.branding.company_name (si renseigné)
//  - clients.sector (colonne de la table)
// ============================================================

export function personaLine(config?: ClientConfig, sector?: string): string {
  const company = config?.branding?.company_name?.trim()
  const activity = sector?.trim()

  if (company && activity) {
    return `Tu es l'assistant commercial de ${company}, une entreprise du secteur : ${activity}.`
  }
  if (company) {
    return `Tu es l'assistant commercial de ${company}.`
  }
  if (activity) {
    return `Tu es l'assistant commercial d'une entreprise du secteur : ${activity}.`
  }
  return `Tu es l'assistant commercial d'une entreprise de services.`
}

// Variante « expert qualification » pour le scoring.
export function scoringPersonaLine(config?: ClientConfig, sector?: string): string {
  const company = config?.branding?.company_name?.trim()
  const activity = sector?.trim()

  if (activity) {
    return `Tu es un expert en qualification de leads pour ${company ?? 'une entreprise'} (secteur : ${activity}).`
  }
  return `Tu es un expert en qualification de leads pour ${company ?? 'une entreprise de services'}.`
}
