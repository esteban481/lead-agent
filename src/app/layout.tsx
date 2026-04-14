import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lead Agent — Dashboard',
  description: 'Gestion des leads entrants',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <span className="font-semibold text-lg">Lead Agent</span>
              <a href="/" className="text-sm text-gray-500 hover:text-gray-900">
                Dashboard
              </a>
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
