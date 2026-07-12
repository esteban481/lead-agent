import type { Metadata } from 'next'
import Link from 'next/link'
import { Inter } from 'next/font/google'
import { getPrincipal } from '@/lib/auth'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Lead Agent — Dashboard',
  description: 'Gestion des leads entrants',
}

function LogoMark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
        L
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">
        Lead Agent
      </span>
    </span>
  )
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const principal = await getPrincipal()

  return (
    <html lang="fr">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
              <Link href={principal ? '/' : '/demo'} aria-label="Accueil">
                <LogoMark />
              </Link>
              {principal ? (
                <nav className="flex items-center gap-1 text-sm">
                  <Link
                    href="/"
                    className="rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Dashboard
                  </Link>
                  {principal.role === 'admin' && (
                    <Link
                      href="/clients"
                      className="rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Clients
                    </Link>
                  )}
                  <span
                    className={`ml-2 rounded-full px-2.5 py-1 text-xs font-medium ${
                      principal.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
                    }`}
                  >
                    {principal.role === 'admin' ? 'Admin' : 'Client'}
                  </span>
                  <form action="/api/auth/logout" method="post" className="ml-1">
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Déconnexion
                    </button>
                  </form>
                </nav>
              ) : (
                <nav className="flex items-center gap-2 text-sm">
                  <Link
                    href="/login"
                    className="rounded-lg px-3.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Se connecter
                  </Link>
                </nav>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
