#!/usr/bin/env node
// ============================================================
// Peuple le client démo avec des leads FR réalistes pour rendre
// le dashboard montrable en démo commerciale.
//
// - Lit les identifiants Supabase depuis .env (aucun secret commité)
// - Marque chaque lead source='demo_seed' → nettoyage ciblé possible
// - Crée un 1er message sortant par lead contacté (temps de réponse)
//
// Usage :
//   node scripts/seed-demo-leads.mjs [client_id]
//   node scripts/seed-demo-leads.mjs --purge [client_id]   (supprime les demo_seed)
// ============================================================

import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    })
)

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env')
  process.exit(1)
}

const args = process.argv.slice(2)
const purge = args.includes('--purge')
const clientId = args.find((a) => !a.startsWith('--')) ?? '9d13bbc5-70be-4cf3-9a55-a84316b1e836'

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

const daysAgo = (d) => new Date(Date.now() - d * 86400_000).toISOString()
const minsAfter = (iso, m) => new Date(new Date(iso).getTime() + m * 60_000).toISOString()

// Jeu de données réaliste (secteur PAC / rénovation énergétique).
const LEADS = [
  { name: 'Camille Moreau', email: 'camille.moreau@example.fr', phone: '0612345678', d: 2, status: 'booked', score: 88, cat: 'A', summary: 'Maison 130m² au fioul en Essonne, projet urgent. Excellent profil, éligible MaPrimeRénov.', booked: 1 },
  { name: 'Julien Lefèvre', email: 'j.lefevre@example.fr', phone: '0623456789', d: 4, status: 'booked', score: 79, cat: 'A', summary: 'Pavillon 95m², remplacement chaudière gaz. Zone couverte, budget cohérent.', booked: 3 },
  { name: 'Sophie Garnier', email: 'sophie.garnier@example.fr', phone: '0634567890', d: 1, status: 'awaiting_reply', score: 66, cat: 'B', summary: 'Appartement avec projet PAC air/air, en attente de précisions sur la surface.' },
  { name: 'Thomas Rousseau', email: 'thomas.rousseau@example.fr', phone: '0645678901', d: 3, status: 'awaiting_reply', score: 58, cat: 'B', summary: 'Maison 110m², chauffage électrique. Délai 6 mois, à recontacter.' },
  { name: 'Léa Fontaine', email: 'lea.fontaine@example.fr', phone: '', d: 5, status: 'awaiting_reply', score: 41, cat: 'C', summary: 'Projet flou, budget non précisé. Approche douce recommandée.' },
  { name: 'Nicolas Bernard', email: 'n.bernard@example.fr', phone: '0656789012', d: 8, status: 'qualifying', score: null, cat: null, summary: null },
  { name: 'Émilie Petit', email: 'emilie.petit@example.fr', phone: '0667890123', d: 6, status: 'cold', score: 52, cat: 'B', summary: 'Bon profil mais sans réponse après 3 relances.' },
  { name: 'Hugo Laurent', email: 'hugo.laurent@example.fr', phone: '', d: 11, status: 'cold', score: 44, cat: 'C', summary: 'Relancé sans succès, à réactiver plus tard.' },
  { name: 'Chloé Girard', email: 'chloe.girard@example.fr', phone: '0678901234', d: 9, status: 'disqualified', score: 14, cat: 'D', summary: 'Hors zone géographique. Poliment écarté.' },
  { name: 'Maxime Dubois', email: 'maxime.dubois@example.fr', phone: '0689012345', d: 14, status: 'disqualified', score: 9, cat: 'D', summary: 'Simple dépannage, hors périmètre installation.' },
  { name: 'Inès Robert', email: 'ines.robert@example.fr', phone: '0690123456', d: 0, status: 'new', score: null, cat: null, summary: null },
  { name: 'Antoine Mercier', email: 'antoine.mercier@example.fr', phone: '0601234567', d: 0, status: 'awaiting_reply', score: 72, cat: 'B', summary: 'Maison récente 140m², souhaite un devis rapide.' },
]

async function rq(method, path, body) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: { ...H, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

if (purge) {
  const del = await fetch(`${SUPA}/rest/v1/leads?source=eq.demo_seed&client_id=eq.${clientId}`, {
    method: 'DELETE',
    headers: { ...H, Prefer: 'return=representation' },
  })
  const rows = await del.json()
  console.log(`Purge : ${rows.length} lead(s) demo_seed supprimé(s).`)
  process.exit(0)
}

let created = 0
for (const l of LEADS) {
  const createdAt = daysAgo(l.d)
  const [lead] = await rq('POST', 'leads', {
    client_id: clientId,
    name: l.name,
    email: l.email || null,
    phone: l.phone || null,
    source: 'demo_seed',
    raw_data: { message: 'Demande de devis pour une pompe à chaleur.' },
    status: l.status,
    score: l.score,
    score_category: l.cat,
    ai_summary: l.summary,
    meeting_booked_at: l.booked ? daysAgo(l.booked) : null,
    created_at: createdAt,
  })

  // 1er email sortant (sauf 'new' = pas encore contacté), pour le temps de réponse
  if (l.status !== 'new') {
    await rq('POST', 'messages', {
      lead_id: lead.id,
      direction: 'out',
      channel: 'email',
      subject: 'Votre projet de pompe à chaleur',
      body: 'Bonjour, merci pour votre demande…',
      sent_at: minsAfter(createdAt, 1 + Math.floor(Math.random() * 3)),
    })
  }
  created++
}

console.log(`Seed terminé : ${created} leads démo créés pour le client ${clientId}.`)
console.log('Pour nettoyer : node scripts/seed-demo-leads.mjs --purge')
