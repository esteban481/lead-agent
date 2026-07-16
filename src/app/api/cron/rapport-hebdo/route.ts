import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { brandingFromConfig } from '@/lib/email-template'
import { buildWeeklyReport } from '@/lib/weekly-report'
import { logger, errContext } from '@/lib/logger'
import type { Client, Lead } from '@/types'

// GET /api/cron/rapport-hebdo
// Vercel Cron — chaque lundi matin : envoie à chaque client (ayant
// notify_email) le bilan chiffré de ses 7 derniers jours.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const results = { clients: 0, sent: 0, skipped: 0, errors: 0 }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, config')

  if (error) {
    logger.error('rapport hebdo : échec lecture clients', { job: 'rapport-hebdo', error: error.message })
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  for (const client of (clients ?? []) as Pick<Client, 'id' | 'name' | 'config'>[]) {
    results.clients++
    const notifyEmail = client.config?.notify_email
    if (!notifyEmail) {
      results.skipped++
      continue
    }

    try {
      // Leads créés sur la période + RDV confirmés sur la période
      const [{ data: weekLeads }, { count: bookedCount }] = await Promise.all([
        supabase
          .from('leads')
          .select('id, status, score_category, created_at, meeting_booked_at')
          .eq('client_id', client.id)
          .gte('created_at', since),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .gte('meeting_booked_at', since),
      ])

      const leads = (weekLeads ?? []) as Pick<Lead, 'id' | 'status' | 'score_category' | 'created_at' | 'meeting_booked_at'>[]

      // 1er message sortant par lead (temps de première réponse)
      const firstOutboundByLead: Record<string, string> = {}
      if (leads.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('lead_id, sent_at')
          .eq('direction', 'out')
          .in('lead_id', leads.map((l) => l.id))
          .order('sent_at', { ascending: true })
        for (const m of messages ?? []) {
          if (m.lead_id && !firstOutboundByLead[m.lead_id]) firstOutboundByLead[m.lead_id] = m.sent_at
        }
      }

      const { subject, body } = buildWeeklyReport({
        companyName: client.config?.branding?.company_name ?? client.name,
        leads,
        firstOutboundByLead,
        bookedInWindow: bookedCount ?? 0,
      })

      await sendEmail({
        to: notifyEmail,
        from: client.config.from_email,
        subject,
        text: body,
        branding: brandingFromConfig(client.config),
      })

      logger.info('rapport hebdo envoyé', { job: 'rapport-hebdo', client_id: client.id })
      results.sent++
    } catch (err) {
      logger.error('rapport hebdo : échec client', { job: 'rapport-hebdo', client_id: client.id, ...errContext(err) })
      results.errors++
    }
  }

  logger.info('rapport hebdo terminé', { job: 'rapport-hebdo', ...results })
  return NextResponse.json({ ok: true, ...results })
}
