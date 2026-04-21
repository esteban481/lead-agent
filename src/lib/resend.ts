import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendEmail({
  to,
  from,
  subject,
  text,
  replyTo,
  headers,
}: {
  to: string
  from: string
  subject: string
  text: string
  replyTo?: string
  headers?: Record<string, string>
}): Promise<{ id: string }> {
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
    replyTo: replyTo,
    headers,
  })

  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`)
  }

  return { id: data.id }
}
