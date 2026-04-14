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
| Envoi email | Resend | Envoi + réception emails inbound |
| IA | Anthropic Claude | Parsing, génération, scoring |
| Booking | Cal.com | Prise de RDV (lien simple) |
| Hébergement | Vercel | App + cron jobs automatiques |

---

## Structure des dossiers

```
src/
├── types/index.ts              ← Tous les types TypeScript centralisés
├── lib/
│   ├── supabase.ts             ← Client Supabase (service role, server-side uniquement)
│   ├── resend.ts               ← Client Resend + fonction sendEmail()
│   ├── anthropic.ts            ← Client Anthropic + fonction callClaude()
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
        ├── webhook/email-inbound/ ← Reçoit les réponses email (Resend Inbound)
        ├── webhook/cal/        ← Confirmation RDV Cal.com (à implémenter)
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

---

## Les 4 fonctions IA

### `parseLeadMessage(message, config, existingAnswers)`
Envoie le message brut à Claude → retourne un objet JSON avec les infos extraites.
Ex : `{ type_logement: "maison", surface: "120m2" }`

### `scoreLead(lead, answers, config)`
Calcule un score sur 100 selon les critères du client.
Retourne : `{ score, category, details, summary, missing_fields }`

### `generateQualificationEmail / generateRelanceEmail / generateBookingEmail / generateDisqualificationEmail`
Génère le bon email selon le contexte. Toujours en JSON `{ subject, body }`.

### `decideNextAction(lead, score, answers, config)`
**Logique déterministe — pas de Claude ici.**
- missing_fields > 0 → `ask_next_question`
- category D → `disqualify`
- category A ou B → `send_booking_link`
- category C → `send_gentle_followup`

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
  1. Extrait In-Reply-To du header email
  2. Retrouve le lead via email_thread_id (fallback: email du lead)
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

Vercel déclenche `GET /api/cron/relances` toutes les heures.

```
1. Récupère les relances pending dont scheduled_at est passé
2. Pour chaque relance :
   - Skip si lead déjà booked/disqualified/cold/qualifying
   - Skip si heure hors plage config (ex: 8h-20h)
   - generateRelanceEmail (step 1, 2 ou 3)
   - Envoie + log en DB
   - Marque relance: sent
   - Si step 3 : lead → cold
```

---

## Variables d'environnement nécessaires

Copie `.env.example` → `.env` et remplis :

```
ANTHROPIC_API_KEY       → console.anthropic.com
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  → supabase.com > Settings > API
RESEND_API_KEY          → resend.com > API Keys
RESEND_FROM_EMAIL       → ex: leads@tondomaine.com
NEXT_PUBLIC_APP_URL     → http://localhost:3000 en dev
CRON_SECRET             → chaîne aléatoire longue
```

---

## Convention Git

- Ne jamais pousser sur `main` directement
- Toujours travailler sur une branche : `feat/nom`, `fix/nom`
- Pull Request pour merger

---

## Ce qui reste à faire (V1)

- [ ] Webhook Cal.com (`/api/webhook/cal`) — confirmation RDV
- [ ] Configurer Resend Inbound (MX records sur le domaine)
- [ ] Insérer le premier client en base et tester le flow end-to-end
- [ ] Déployer sur Vercel

## V2+ (hors scope MVP)

- SMS (Twilio)
- Multi-source leads (Meta Ads, Google)
- UI d'onboarding client self-serve
- Multi-calendar (Outlook)
- Alertes Slack/email au commercial
