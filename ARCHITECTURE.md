# Lead Agent — Architecture & Contexte projet

## C'est quoi ce projet ?

Un agent IA qui transforme automatiquement les leads entrants en rendez-vous qualifiés.

**Flux complet :**
Formulaire web → lead reçu → email de qualification → conversation → scoring → lien Cal.com → relances automatiques → dashboard interne

**Ce qu'on vend :** plus de RDV qualifiés sans effort pour l'entreprise cliente.
**Ce qu'on ne vend pas :** de l'IA, un chatbot, un CRM.

---

## Stack technique

| Brique | Outil | Rôle |
|---|---|---|
| Framework | Next.js 15 (App Router) | Backend API routes + frontend dashboard |
| Base de données | Supabase (Postgres) | Stockage leads, messages, relances |
| Envoi + réception email | Resend | Envoi via API + inbound via webhook (event: email.received) |
| IA | Anthropic Claude (claude-sonnet-4-6) | Parsing, génération, scoring |
| Booking | Cal.com | Prise de RDV (lien simple) |
| Hébergement | Vercel | App + cron jobs automatiques |
| Domaine email | leadqualifie.fr | Adresse d'envoi : leads@leadqualifie.fr |

---

## Structure des dossiers

```
src/
├── types/index.ts              ← Tous les types TypeScript centralisés
├── middleware.ts               ← Garde de session (multi-tenant) sur dashboard + APIs de lecture
├── lib/
│   ├── supabase.ts             ← Client Supabase (service role, server-side uniquement)
│   ├── resend.ts               ← Client Resend + fonction sendEmail()
│   ├── anthropic.ts            ← Client Anthropic + callClaude() (retries auto sur erreurs transitoires)
│   ├── auth.ts                 ← getPrincipal/scopeOf : identité de requête (rôle + client_id)
│   ├── session.ts              ← Session signée HMAC (Web Crypto, Edge+Node)
│   ├── password.ts             ← Hachage mots de passe PBKDF2 (Web Crypto)
│   ├── queries.ts              ← Requêtes dashboard partagées, scopées par client_id
│   ├── analytics.ts            ← computeAnalytics : funnel + taux + temps (logique pure)
│   ├── webhook-security.ts     ← Vérification signatures webhooks (Resend/Svix, Cal.com)
│   ├── idempotency.ts          ← Garde anti-doublons des webhooks (table processed_webhooks)
│   ├── notify.ts               ← Alertes email au commercial (lead chaud, RDV confirmé)
│   ├── email-utils.ts          ← buildReplyTo (lead ID encodé en plus-addressing)
│   ├── time.ts                 ← Heure locale par fuseau (DST) pour la plage de relances
│   └── ai/
│       ├── parse.ts            ← Extrait les données structurées d'un message brut
│       ├── score.ts            ← Calcule le score du lead (0-100)
│       ├── generate.ts         ← Génère les emails (qualification, relance, booking, disqualif)
│       └── decide.ts           ← Décide de l'action suivante (logique déterministe)
└── app/
    ├── page.tsx                ← Dashboard : liste leads + KPIs
    ├── leads/[id]/page.tsx     ← Fiche lead complète
    └── api/
        ├── webhook/form/       ← Reçoit les leads depuis formulaire web
        ├── webhook/email-inbound/ ← Reçoit les réponses email (Resend Inbound, event: email.received)
        ├── webhook/cal/        ← Événements RDV Cal.com (création / annulation / report)
        ├── cron/relances/      ← Vercel Cron toutes les heures
        ├── leads/              ← GET liste leads
        ├── leads/[id]/         ← GET fiche lead
        └── stats/              ← GET KPIs dashboard
```

---

## Base de données — 5 tables

### `clients`
Une ligne = une entreprise cliente.
La config est en JSONB et contient tout : questions de qualification, zone, seuils de score, lien Cal.com, horaires de relance.

### `leads`
Une ligne = une demande entrante.
Champs clés : `status`, `score`, `score_category` (A/B/C/D), `ai_summary`, `email_thread_id`.

**Cycle de vie d'un lead :**
```
new → awaiting_reply → qualifying → scoring → booked
                                           → disqualified
                                  → cold (si pas de réponse après 3 relances)
```

### `messages`
Tous les emails envoyés (`direction: out`) et reçus (`direction: in`).
Le `message_id` est utilisé pour rattacher les réponses au bon lead.

### `qualification_answers`
Réponses collectées pendant la conversation. Une ligne par question/réponse.
Ex : `{ question_key: "surface", answer: "120m2" }`

### `scheduled_relances`
File de relances planifiées. Steps : 1 (J+1), 2 (J+3), 3 (J+7).
Statuts : `pending` → `sent` | `cancelled`.

### `processed_webhooks`
Clés d'idempotence (`{source}:{event_id}`) pour ne pas traiter 2× le même event Resend/Cal.com. Voir `supabase/migrations/001_processed_webhooks.sql`. Le code dégrade gracieusement si la table n'existe pas (warning, pas de dédup).

---

## Les 4 fonctions IA

### `parseLeadMessage(message, config, existingAnswers)`
Envoie le message brut à Claude → retourne un objet JSON avec les infos extraites.
Ex : `{ type_logement: "maison", surface: "120m2" }`

### `scoreLead(lead, answers, config)`
Calcule un score sur 100 selon les critères du client.
Retourne : `{ score, category, details, summary, missing_fields }`
**Répartition des rôles** : Claude attribue des points par critère (température 0), le **code** somme, clampe chaque critère à son poids et dérive la catégorie via les seuils. Garantit `score = somme(details)` et une catégorie cohérente, indépendamment de l'arithmétique du LLM. Helpers purs testés : `computeScore`, `categoryFromScore`.

### `generateQualificationEmail / generateRelanceEmail / generateBookingEmail / generateDisqualificationEmail`
Génère le bon email selon le contexte. Toujours en JSON `{ subject, body }`.

### `decideNextAction(lead, score, answers, config)`
**Logique déterministe — pas de Claude ici.**
- missing_fields > 0 → `ask_next_question`
- category D → `disqualify`
- category A ou B → `send_booking_link`
- category C → `send_gentle_followup`

### Robustesse des appels Claude
`callClaude` (`src/lib/anthropic.ts`) s'appuie sur les retries natifs du SDK (4 tentatives, backoff exponentiel, respect du `retry-after`) pour absorber les erreurs transitoires (429, 529 overloaded, 5xx). En cas d'échec définitif, l'erreur est loggée et propagée → le webhook renvoie 500, le provider rejoue, et l'idempotence (`processed_webhooks`) rend ce rejeu sûr.

---

## Flux webhook form (entrée principale)

```
POST /api/webhook/form?client_id=xxx
  1. Charge config client
  2. Normalise email/téléphone/nom
  3. Vérifie doublon (même email < 7 jours)
  4. Crée lead en DB (status: new)
  5. parseLeadMessage → sauvegarde les réponses trouvées
  6. generateQualificationEmail → sendEmail via Resend
  7. Log message en DB
  8. Update lead: status = awaiting_reply, email_thread_id = Message-ID
  9. Planifie 3 relances (J+1, J+3, J+7)
```

---

## Flux webhook email-inbound (réponses du lead)

```
POST /api/webhook/email-inbound
Payload Resend : { type: "email.received", data: { from, subject, text, message_id, in_reply_to } }

  1. Vérifie type === "email.received"
  2. Extrait in_reply_to pour retrouver le lead (fallback: email du lead)
  3. Log le message reçu
  4. Annule les relances pending
  5. parseLeadMessage → sauvegarde les nouvelles réponses
  6. Si infos manquantes → generateQualificationEmail → renvoie email
  7. Si tout collecté → scoreLead → decideNextAction
     → A/B : generateBookingEmail + envoie lien Cal.com
     → D   : generateDisqualificationEmail
     → C   : booking + replanifie relance douce
```

---

## Cron relances

Vercel déclenche `GET /api/cron/relances` toutes les heures (configuré dans `vercel.json`).

```
1. Récupère les relances pending dont scheduled_at est passé
2. Pour chaque relance :
   - Skip si lead déjà booked/disqualified/cold/qualifying
   - Skip si heure hors plage config (ex: 8h-20h) — heure locale `Europe/Paris`, DST géré via `src/lib/time.ts`
   - generateRelanceEmail (step 1, 2 ou 3)
   - Envoie + log en DB
   - Marque relance: sent
   - Si step 3 : lead → cold
```

---

## Sécurité

| Surface | Protection |
|---|---|
| `POST /api/webhook/email-inbound` | Signature Svix (`RESEND_WEBHOOK_SECRET`) — anti-replay 5 min |
| `POST /api/webhook/cal` | Signature HMAC-SHA256 (`CAL_WEBHOOK_SECRET`, header `x-cal-signature-256`) |
| `GET /api/cron/relances` | `Authorization: Bearer CRON_SECRET` |
| Dashboard (`/`, `/leads/*`) + `GET /api/leads*`, `/api/stats` | Session signée via `src/middleware.ts` (cookie HMAC, `SESSION_SECRET`) — page `/login` |
| `POST /api/webhook/form` | Public par design (reçoit les formulaires web) — déduplication 7 jours |

### Multi-tenant — login par client

Deux rôles, résolus à la connexion (`POST /api/auth/login`) :
- **admin** — identifiants d'environnement (`DASHBOARD_USER`/`DASHBOARD_PASSWORD`) → voit **tous** les clients.
- **client** — identifiants stockés sur la ligne `clients` (`login_email` + mot de passe haché PBKDF2) → voit **uniquement ses leads**.

Le login pose un **cookie de session signé HMAC** (`src/lib/session.ts`) contenant `{role, client_id}`. Le middleware le vérifie à chaque requête (sans accès DB) et injecte `x-role`/`x-client-id` sur la requête transmise, après avoir **supprimé toute valeur entrante** (un client ne peut pas usurper le scope d'un autre via un header forgé). Les server components lisent ce contexte via `getPrincipal()` (`src/lib/auth.ts`) ; toutes les requêtes (`getLeads`, `getStats`, `getAnalytics`, `getLeadDetail`) sont scopées par `client_id`, avec **garde anti-IDOR** sur la fiche lead. Déconnexion : `POST /api/auth/logout`.

Provisionner un login client (sans calculer le hash à la main) :
```bash
node scripts/provision-client-login.mjs <email> <motdepasse> <client_id>
```
Le script sort un bloc SQL (migration 002 incluse, idempotente) à coller dans Supabase SQL Editor. Le hash PBKDF2 généré est identique à celui calculé par `src/lib/password.ts` (vérifié), donc le login fonctionne directement.

**Comportement dégradé volontaire :** si un secret n'est pas configuré dans l'environnement, la vérification correspondante est ignorée avec un warning dans les logs. Cela permet de déployer sans casser la prod, mais les secrets doivent être configurés dans Vercel au plus vite.

Les pages du dashboard sont des server components qui appellent `src/lib/queries.ts` directement (requêtes Supabase) — pas de fetch HTTP vers notre propre API.

---

## Dashboard de conversion

Le dashboard (`/`) affiche un **funnel** Reçus → Contactés → Qualifiés → RDV pris avec les taux de conversion inter-étapes, plus : conversion globale, temps moyen de 1er contact (rapidité de l'agent), délai moyen jusqu'au RDV, et leads perdus (froids + disqualifiés). Calcul dans `src/lib/analytics.ts` (`computeAnalytics`, logique pure et testée) ; récupération des données dans `getAnalytics` (`src/lib/queries.ts`). Aucun changement de schéma — tout est dérivé des tables `leads` et `messages`.

La **liste de leads** est filtrable (statut, catégorie), cherchable (nom/email) et paginée (20/page). Filtres en query params via un formulaire GET server-rendered (URLs partageables) ; logique pure dans `src/lib/leads-filter.ts` (`parseFilters`, `buildPagination`, `sanitizeSearch` — testés), requête dans `getLeadsList`. Le funnel et les compteurs restent calculés sur le scope complet, pas sur le sous-ensemble filtré.

---

## Variables d'environnement nécessaires

Copie `.env.example` → `.env` et remplis :

```
ANTHROPIC_API_KEY          → console.anthropic.com (clé personnelle à chaque dev)
NEXT_PUBLIC_SUPABASE_URL   → supabase.com > Settings > API (partagé équipe)
NEXT_PUBLIC_SUPABASE_ANON_KEY → supabase.com > Settings > API (partagé équipe)
SUPABASE_SERVICE_ROLE_KEY  → supabase.com > Settings > API (partagé équipe)
RESEND_API_KEY             → resend.com > API Keys (partagé équipe)
RESEND_FROM_EMAIL          → leads@leadqualifie.fr
RESEND_INBOUND_EMAIL       → leads@flenaavios.resend.app (workaround temporaire)
RESEND_WEBHOOK_SECRET      → resend.com > Webhooks > secret (partagé équipe)
CAL_WEBHOOK_SECRET         → cal.com > Settings > Webhooks > secret
DASHBOARD_USER             → identifiant Basic Auth dashboard (défaut: admin)
DASHBOARD_PASSWORD         → mot de passe Basic Auth dashboard
NEXT_PUBLIC_APP_URL        → http://localhost:3000 en dev
CRON_SECRET                → chaîne aléatoire longue (partagé équipe)
```

---

## Configuration services externes

### Resend
- Domaine vérifié : `leadqualifie.fr`
- Adresse d'envoi : `leads@leadqualifie.fr`
- Inbound configuré : webhook `email.received` → `/api/webhook/email-inbound`
- DNS configurés sur OVH : DKIM, SPF, MX, DMARC

### Supabase
- Projet : `fqsfqyihkagiceqbbbnd`
- Schéma : voir `supabase/schema.sql`
- Client démo PAC inséré en base

### Vercel
- URL production : `https://lead-agent-omega-navy.vercel.app`
- Cron : tous les jours à 9h → `/api/cron/relances`
- Variables d'environnement configurées dans le dashboard Vercel

---

## Convention Git

- Ne jamais pousser sur `main` directement
- Toujours travailler sur une branche : `feat/nom`, `fix/nom`
- Pull Request pour merger
- Mettre à jour `ARCHITECTURE.md` dans toute PR qui change l'architecture

---

## Ce qui est fait

- [x] Stack complète déployée sur Vercel, base Supabase + client démo en base
- [x] Resend configuré (envoi + inbound), signatures webhooks vérifiées
- [x] Flow complet (webhook form → parsing → qualification → scoring → décision → relances)
- [x] Webhook Cal.com : création / annulation / report de RDV
- [x] Dashboard : funnel de conversion, liste filtrable/cherchable/paginée, fiche lead
- [x] Multi-tenant : login par client (scoping + anti-IDOR), rôle admin
- [x] Fiabilité : idempotence webhooks, fuseau horaire relances, résilience IA, scoring déterministe

## Ce qui reste à faire

- [ ] Onboarder un vrai client pilote
- [ ] Fixer le custom domain inbound Resend (`leads@leadqualifie.fr`) — problème côté Resend/AWS SES
- [ ] (Optionnel) Observabilité (logs structurés), état d'erreur visible pour leads bloqués

> Tests : logique pure (scoring, analytics, session, filtres…) + les **3 webhooks** (form, inbound, cal) couverts par un mock Supabase chaînable. `npm test`.

## Alertes commercial

Si `config.notify_email` est renseigné pour un client, un email d'alerte est envoyé au commercial :
- **Lead chaud** : quand un lead est scoré A ou B (au moment où le lien de RDV lui est envoyé)
- **RDV confirmé** : quand le webhook Cal.com confirme une réservation

Implémenté dans `src/lib/notify.ts`. No-op si `notify_email` absent. Un échec d'alerte ne bloque jamais le flux principal.

---

## V2+ (hors scope MVP)

- SMS (Twilio)
- Multi-source leads (Meta Ads, Google)
- UI d'onboarding client self-serve
- Multi-calendar (Outlook)
- Alertes Slack au commercial (email : fait)
