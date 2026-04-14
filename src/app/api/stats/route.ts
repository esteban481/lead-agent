import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { DashboardStats } from '@/types'

// GET /api/stats?client_id=xxx
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id')

  let query = supabase.from('leads').select('status, score_category, created_at')
  if (clientId) query = query.eq('client_id', clientId)

  const { data: leads, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = leads?.length ?? 0
  const contacted = leads?.filter((l) => l.status !== 'new').length ?? 0
  const qualified = leads?.filter((l) =>
    ['scoring', 'booked'].includes(l.status)
  ).length ?? 0
  const booked = leads?.filter((l) => l.status === 'booked').length ?? 0
  const disqualified = leads?.filter((l) => l.status === 'disqualified').length ?? 0

  const byCategory = { A: 0, B: 0, C: 0, D: 0 }
  for (const lead of leads ?? []) {
    if (lead.score_category && lead.score_category in byCategory) {
      byCategory[lead.score_category as keyof typeof byCategory]++
    }
  }

  const stats: DashboardStats = {
    total_leads: total,
    leads_contacted: contacted,
    leads_qualified: qualified,
    leads_booked: booked,
    leads_disqualified: disqualified,
    avg_response_time_minutes: null, // calculé côté client si besoin
    by_category: byCategory,
  }

  return NextResponse.json(stats)
}
