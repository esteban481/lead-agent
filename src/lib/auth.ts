import { headers } from 'next/headers'

// ============================================================
// Identité de la requête côté serveur.
// Les en-têtes x-role / x-client-id sont posés par le middleware
// APRÈS vérification de la session signée — ils sont donc dignes
// de confiance (le middleware supprime toute valeur entrante avant
// de poser la sienne). Voir src/middleware.ts.
// ============================================================

export interface Principal {
  role: 'admin' | 'client'
  clientId: string | null // null = admin (voit tous les clients)
}

export async function getPrincipal(): Promise<Principal | null> {
  const h = await headers()
  const role = h.get('x-role')
  if (role !== 'admin' && role !== 'client') return null
  return { role, clientId: h.get('x-client-id') || null }
}

// Scope client à appliquer aux requêtes : null pour l'admin (tout),
// l'id du client sinon.
export function scopeOf(principal: Principal | null): string | null {
  return principal?.role === 'client' ? principal.clientId : null
}
