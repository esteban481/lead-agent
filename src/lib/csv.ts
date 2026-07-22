import type { Lead } from '@/types'

// ============================================================
// Génération de CSV — logique pure et testable.
//
// Séparateur ';' (défaut Excel en France) + BOM UTF-8 pour que les
// accents s'affichent correctement à l'ouverture dans Excel.
// Échappement : un champ contenant ';', '"' ou un saut de ligne est
// entouré de guillemets, les guillemets internes étant doublés.
// ============================================================

const SEP = ';'
const BOM = '﻿'

function escapeField(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// headers : ligne d'en-tête ; rows : valeurs déjà en chaînes.
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cols) => cols.map(escapeField).join(SEP))
  return BOM + lines.join('\r\n')
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  awaiting_reply: 'En attente',
  qualifying: 'Qualification',
  scoring: 'Scoring',
  booked: 'RDV pris',
  disqualified: 'Disqualifié',
  cold: 'Froid',
}

// Colonnes exportées pour les leads (ordre stable).
const LEAD_HEADERS = [
  'Nom',
  'Email',
  'Téléphone',
  'Statut',
  'Score',
  'Catégorie',
  'Résumé IA',
  'Créé le',
  'RDV le',
]

export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.map((l) => [
    l.name ?? '',
    l.email ?? '',
    l.phone ?? '',
    STATUS_LABELS[l.status] ?? l.status,
    l.score != null ? String(l.score) : '',
    l.score_category ?? '',
    l.ai_summary ?? '',
    new Date(l.created_at).toLocaleString('fr-FR'),
    l.meeting_booked_at ? new Date(l.meeting_booked_at).toLocaleString('fr-FR') : '',
  ])
  return toCsv(LEAD_HEADERS, rows)
}
