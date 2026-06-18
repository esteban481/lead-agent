import { supabase } from '@/lib/supabase'

// ============================================================
// Idempotence des webhooks.
//
// Resend et Cal.com peuvent livrer le même event plusieurs fois
// (retry réseau, double-delivery). Sans garde, le webhook inbound
// re-parserait, re-scorerait et RENVERRAIT un email au prospect.
//
// Principe : on insère une clé unique (source:event_id) AVANT de
// traiter. L'insert sert de verrou atomique :
//   - succès        → 'new', on traite
//   - conflit (PK)  → 'duplicate', on s'arrête
//   - autre erreur  → 'unavailable' (ex: table absente), on traite
//     quand même sans idempotence plutôt que de bloquer le flux.
//
// Si le traitement échoue ensuite, on appelle releaseWebhook pour
// retirer la clé : un retry légitime du provider pourra rejouer.
// ============================================================

export type WebhookSource = 'resend_inbound' | 'cal'
export type ClaimResult = 'new' | 'duplicate' | 'unavailable'

function key(source: WebhookSource, eventId: string): string {
  return `${source}:${eventId}`
}

// Tente de réserver le traitement d'un event. Voir tableau ci-dessus.
export async function claimWebhook(
  source: WebhookSource,
  eventId: string
): Promise<ClaimResult> {
  if (!eventId) return 'unavailable' // pas d'id exploitable → on ne peut pas dédupliquer

  const { error } = await supabase
    .from('processed_webhooks')
    .insert({ id: key(source, eventId), source })

  if (!error) return 'new'

  // 23505 = unique_violation → déjà traité
  if (error.code === '23505') return 'duplicate'

  // 42P01 = table absente (migration pas encore appliquée) → dégradation gracieuse
  console.warn('[idempotency] garde indisponible, traitement sans dédup:', error.code, error.message)
  return 'unavailable'
}

// Retire la clé pour permettre un rejeu après un échec de traitement.
export async function releaseWebhook(
  source: WebhookSource,
  eventId: string
): Promise<void> {
  if (!eventId) return
  const { error } = await supabase
    .from('processed_webhooks')
    .delete()
    .eq('id', key(source, eventId))
  if (error) {
    console.warn('[idempotency] échec libération clé:', error.code, error.message)
  }
}
