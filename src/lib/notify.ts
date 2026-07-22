import { sendEmail } from '@/lib/resend'
import { logger } from '@/lib/logger'
import type { ClientConfig, Lead } from '@/types'

// ============================================================
// Alerte email au commercial du client (config.notify_email).
// No-op si notify_email n'est pas configuré.
// Une alerte qui échoue ne doit jamais bloquer le flux principal
// (qualification, booking) — on log et on continue.
// ============================================================

export async function notifyCommercial(
  config: ClientConfig,
  lead: Lead,
  subject: string,
  lines: string[]
): Promise<void> {
  if (!config.notify_email) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const contact = [
    `Nom : ${lead.name ?? 'inconnu'}`,
    `Email : ${lead.email ?? 'inconnu'}`,
    `Téléphone : ${lead.phone ?? 'inconnu'}`,
  ]

  const body = [
    ...lines,
    '',
    ...contact,
    ...(appUrl ? ['', `Fiche lead : ${appUrl}/leads/${lead.id}`] : []),
  ].join('\n')

  try {
    await sendEmail({
      to: config.notify_email,
      from: config.from_email,
      subject,
      text: body,
    })
  } catch (err) {
    logger.warn('échec alerte commercial', { lead_id: lead.id, error: (err as Error).message })
  }
}
