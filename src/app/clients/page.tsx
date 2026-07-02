import Link from 'next/link'
import { getClientsAdmin } from '@/lib/queries'
import ClientManager from './ClientManager'

export const dynamic = 'force-dynamic'

// Réservé admin (garanti par le middleware).
export default async function ClientsPage() {
  const clients = await getClientsAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clients ({clients.length})</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← Dashboard
        </Link>
      </div>
      <ClientManager clients={clients} />
    </div>
  )
}
