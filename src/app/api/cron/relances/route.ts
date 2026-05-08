import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { generateRelanceEmail } from '@/lib/ai/generate'
import type { Client, Lead, ScheduledRelance } from '@/types'

// GET /api/cron/relances
// Déclenché par Vercel Cron toutes les heures
// vercel.json: { "crons": [{ "path": "/api/cron/relances", "schedule": "0 * * * *" }] }
export async function GET(req: NextRequest) {
  // Sécurité basique — Vercel envoie ce header en production
  const authHeader = req.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 }

  // 1. Récupérer toutes les relances en attente dont l'heure est passée
  const { data: relances, error } = await supabase
    .from('scheduled_relances')
    .select(`
      *,
      leads (*)
    `)
    .eq('status', 'pending')
    .lte('scheduled_at', now.toISOString())
    .limit(50) // traitement par batch pour éviter les timeouts Vercel

  if (error) {
    console.error('Cron relances fetch error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  for (const relance of relances ?? []) {
    results.processed++

    const lead = relance.leads as Lead
    const typedRelance = relance as ScheduledRelance

    // Skip si le lead a déjà répondu, booké ou est disqualifié
    if (['booked', 'disqualified', 'cold', 'qualifying'].includes(lead.status)) {
      await supabase
        .from('scheduled_relances')
        .update({ status: 'cancelled', cancelled_at: now.toISOString() })
        .eq('id', typedRelance.id)
      results.skipped++
      continue
    }

    // Skip si pas d'email
    if (!lead.email) {
      await supabase
        .from('scheduled_relances')
        .update({ status: 'cancelled', cancelled_at: now.toISOString() })
        .eq('id', typedRelance.id)
      results.skipped++
      continue
    }

    // 2. Charger la config client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', lead.client_id)
      .single()

    if (!client) {
      results.errors++
      continue
    }

    const typedClient = client as Client

    // 3. Vérifier les horaires autorisés
    const currentHour = now.getUTCHours() + 1 // UTC+1 approximatif (France)
    const { start, end } = typedClient.config.relance_hours
    if (currentHour < start || currentHour >= end) {
      // Pas dans la plage horaire — on repousse à la prochaine heure autorisée
      results.skipped++
      continue
    }

    // 4. Générer et envoyer la relance
    try {
      const { subject, body } = await generateRelanceEmail(
        lead,
        typedRelance.step,
        typedClient.config
      )

      const { id: resendId } = await sendEmail({
        to: lead.email,
        from: typedClient.config.from_email,
        subject,
        text: body,
        replyTo: process.env.RESEND_INBOUND_EMAIL ?? typedClient.config.from_email,
      })

      // Log le message
      await supabase.from('messages').insert({
        lead_id: lead.id,
        direction: 'out',
        channel: 'email',
        subject,
        body,
        resend_email_id: resendId,
      })

      // Marquer la relance comme envoyée
      await supabase
        .from('scheduled_relances')
        .update({ status: 'sent', sent_at: now.toISOString() })
        .eq('id', typedRelance.id)

      // Si c'était la dernière relance (step 3), passer en cold
      if (typedRelance.step >= 3) {
        await supabase
          .from('leads')
          .update({ status: 'cold' })
          .eq('id', lead.id)
      }

      results.sent++
    } catch (err) {
      console.error(`Relance error for lead ${lead.id}:`, err)
      results.errors++
    }
  }

  console.log('Cron relances result:', results)
  return NextResponse.json({ ok: true, ...results })
}
