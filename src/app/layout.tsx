import type { Metadata } from 'next'
import Link from 'next/link'
import { getPrincipal } from '@/lib/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lead Agent — Dashboard',
  description: 'Gestion des leads entrants',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const principal = await getPrincipal()

  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <span className="font-semibold text-lg">Lead Agent</span>
              {principal && (
                <div className="flex items-center gap-4 text-sm">
                  <Link href="/" className="text-gray-500 hover:text-gray-900">
                    Dashboard
                  </Link>
                  {principal.role === 'admin' && (
                    <Link href="/clients" className="text-gray-500 hover:text-gray-900">
                      Clients
                    </Link>
                  )}
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-400">
                    {principal.role === 'admin' ? 'Admin' : 'Client'}
                  </span>
                  <form action="/api/auth/logout" method="post">
                    <button
                      type="submit"
                      className="text-gray-500 hover:text-gray-900"
                    >
                      Déconnexion
                    </button>
                  </form>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
