import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/leads?client_id=xxx&status=xxx&limit=50&offset=0
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leads: data, total: count })
}
