import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/leads/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const [{ data: messages }, { data: answers }, { data: relances }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .eq('lead_id', id)
        .order('sent_at', { ascending: true }),
      supabase
        .from('qualification_answers')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('scheduled_relances')
        .select('*')
        .eq('lead_id', id)
        .order('scheduled_at', { ascending: true }),
    ])

  return NextResponse.json({
    lead,
    messages: messages ?? [],
    qualification_answers: answers ?? [],
    scheduled_relances: relances ?? [],
  })
}
