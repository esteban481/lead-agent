import { NextRequest, NextResponse } from 'next/server'
import { getLeadsForExport } from '@/lib/queries'
import { parseFilters } from '@/lib/leads-filter'
import { leadsToCsv } from '@/lib/csv'

// GET /api/leads/export — export CSV des leads (scope + filtres courants).
// Le scope client vient de la session (middleware), jamais d'un param.
export async function GET(req: NextRequest) {
  const sessionClientId = req.headers.get('x-client-id') // null = admin
  const sp = req.nextUrl.searchParams
  const filters = parseFilters({
    status: sp.get('status') ?? undefined,
    category: sp.get('category') ?? undefined,
    q: sp.get('q') ?? undefined,
  })

  const leads = await getLeadsForExport(sessionClientId, filters)
  const csv = leadsToCsv(leads)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
    },
  })
}
