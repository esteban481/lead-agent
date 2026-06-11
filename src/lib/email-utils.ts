// ============================================================
// Helpers email partagés entre les routes.
// ============================================================

// Construit l'adresse reply-to avec le lead ID encodé en plus-addressing :
// leads+{lead_id}@domaine → permet de rattacher la réponse au bon lead
// dans le webhook inbound (priorité 1 du rattachement).
export function buildReplyTo(leadId: string): string {
  const base = process.env.RESEND_INBOUND_EMAIL ?? 'leads@leadqualifie.fr'
  const at = base.lastIndexOf('@')
  return `${base.slice(0, at)}+${leadId}@${base.slice(at + 1)}`
}
