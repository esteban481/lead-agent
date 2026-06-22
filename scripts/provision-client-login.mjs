#!/usr/bin/env node
// ============================================================
// Génère le SQL pour donner un login dashboard à un client.
//
// Calcule le couple { salt, hash } PBKDF2 EXACTEMENT comme
// src/lib/password.ts (PBKDF2-SHA256, 100 000 itérations, 256 bits),
// pour éviter de bricoler du crypto à la main lors de l'onboarding.
//
// Usage :
//   node scripts/provision-client-login.mjs <email> <motdepasse> <client_id>
//
// Sort un bloc SQL à coller dans l'éditeur SQL Supabase. Inclut
// la migration 002 (idempotente) au cas où elle n'est pas appliquée.
//
// Le mot de passe n'est PAS stocké : seul le hash l'est. Le mot de
// passe en clair n'apparaît que dans ta console — ne le commite pas.
// ============================================================

import { pbkdf2Sync, randomBytes } from 'node:crypto'

const ITERATIONS = 100_000
const KEYLEN = 32 // 256 bits
const DIGEST = 'sha256'

const [email, password, clientId] = process.argv.slice(2)

if (!email || !password || !clientId) {
  console.error('Usage : node scripts/provision-client-login.mjs <email> <motdepasse> <client_id>')
  process.exit(1)
}

const salt = randomBytes(16).toString('hex')
const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), ITERATIONS, KEYLEN, DIGEST).toString('hex')
const normalizedEmail = email.trim().toLowerCase()

const sql = `-- ============================================================
-- Onboarding login client — à coller dans Supabase SQL Editor
-- ============================================================

-- 1. Migration 002 (idempotente : sans effet si déjà appliquée)
alter table clients
  add column if not exists login_email         text,
  add column if not exists login_password_hash text,
  add column if not exists login_password_salt text;
create unique index if not exists clients_login_email_idx
  on clients (login_email) where login_email is not null;

-- 2. Login pour le client ${clientId}
update clients set
  login_email         = '${normalizedEmail}',
  login_password_salt = '${salt}',
  login_password_hash = '${hash}'
where id = '${clientId}';
`

console.log(sql)
console.error(`\n[ok] Login généré pour ${normalizedEmail} (client ${clientId}).`)
console.error('[!] Le mot de passe en clair est uniquement ci-dessus dans ta commande — ne le commite pas.')
