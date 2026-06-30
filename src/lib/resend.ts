import { Resend } from 'resend'
import { renderEmailHtml } from '@/lib/email-template'

export const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendEmail({
  to,
  from,
  subject,
  text,
  html,
  replyTo,
  headers,
}: {
  to: string
  from: string
  subject: string
  text: string
  html?: string
  replyTo?: string
  headers?: Record<string, string>
}): Promise<{ id: string }> {
  // Envoi multipart : texte (fallback / délivrabilité) + HTML (rendu).
  // Le HTML est dérivé du texte si non fourni explicitement.
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
    html: html ?? renderEmailHtml(text),
    replyTo: replyTo,
    headers,
  })

  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`)
  }

  return { id: data.id }
}
