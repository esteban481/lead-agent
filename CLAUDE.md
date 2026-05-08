# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev       # démarrer en local → http://localhost:3000
npm run build     # build production (vérifie les types TypeScript)
npm run lint      # linter ESLint
vercel --prod     # déployer en production
```

## C'est quoi ce projet ?

Agent IA B2B qui transforme automatiquement les leads entrants en rendez-vous qualifiés.

**Ce qu'on vend :** plus de RDV qualifiés sans effort. Pas de l'IA, pas un chatbot, pas un CRM.

**Flux complet :**
```
Formulaire web → webhook → email qualification → réponse lead → scoring Claude → lien Cal.com → relances auto → dashboard
```

**Stack :** Next.js 15 App Router, Supabase (Postgres), Resend (email envoi + inbound), Anthropic Claude (claude-sonnet-4-6), Vercel (hébergement + cron), domaine `leadqualifie.fr`.

**URL production :** `https://lead-agent-omega-navy.vercel.app`

---

## Architecture

### Pipeline IA — `src/lib/ai/`

4 fonctions indépendantes appelées séquentiellement :

- `parse.ts` — extrait données structurées d'un message brut → `ParsedLeadData`
- `score.ts` — calcule score 0-100 + catégorie A/B/C/D → `ScoreResult`
- `generate.ts` — génère les emails (qualification / relance / booking / disqualification)
- `decide.ts` — choisit l'action suivante **sans appel Claude** (logique déterministe)

Toutes les fonctions IA retournent du JSON avec fallback en cas d'erreur.

### API Routes — `src/app/api/`

| Route | Rôle |
|---|---|
| `POST /api/webhook/form?client_id=xxx` | Reçoit lead formulaire, normalise, déduplique, envoie email qualification, planifie relances |
| `POST /api/webhook/email-inbound` | Reçoit réponses email (Resend event `email.received`), parse, score si complet |
| `GET /api/cron/relances` | Vercel Cron 9h/jour — envoie relances pending, passe en cold après step 3 |
| `GET /api/leads` | Liste leads dashboard |
| `GET /api/leads/[id]` | Fiche lead complète |
| `GET /api/stats` | KPIs agrégés |
| `POST /api/webhook/cal` | ⚠️ À implémenter — confirmation RDV Cal.com |

### Cycle de vie d'un lead

```
new → awaiting_reply → qualifying → scoring → booked
                                           → disqualified
                                  → cold (3 relances sans réponse)
```

### Rattachement email inbound

Priorité 1 : `in_reply_to` → `leads.email_thread_id`
Priorité 2 : email du lead → `leads.email` (fallback)

### Multi-tenant

Chaque lead est lié à un `client_id`. Config client en JSONB dans `clients.config` (zone, questions, seuils, cal_booking_url, from_email). Pas d'UI self-serve V1 — insertion manuelle via Supabase SQL Editor.

---

## Workflow Git — règles obligatoires

**Chaque matin avant de coder :**
```bash
git checkout main && git pull
```

**Avant chaque feature :**
```bash
git checkout -b feat/nom-de-la-feature
# ou fix/nom-du-bug
```

**Commiter régulièrement pendant le dev :**
```bash
git add src/le-fichier.ts
git commit -m "feat: description courte"
```

**Quand c'est terminé :**
```bash
git push origin feat/nom
# → ouvrir une Pull Request sur GitHub → relecture → merge
```

**Après le merge :**
```bash
git checkout main && git pull
git branch -d feat/nom
```

**Règles :**
- Ne jamais pusher directement sur `main`
- Un commit = une chose
- Toute PR qui change l'architecture → mettre à jour `ARCHITECTURE.md`
- `.env` ne va jamais sur GitHub (protégé par `.gitignore`)

---

## Variables d'environnement

Copier `.env.example` → `.env` et remplir :

```
ANTHROPIC_API_KEY          → console.anthropic.com (clé personnelle à chaque dev)
NEXT_PUBLIC_SUPABASE_URL   → partagé équipe
NEXT_PUBLIC_SUPABASE_ANON_KEY → partagé équipe
SUPABASE_SERVICE_ROLE_KEY  → partagé équipe (server-side uniquement, jamais exposé client)
RESEND_API_KEY             → partagé équipe
RESEND_FROM_EMAIL          → leads@leadqualifie.fr
RESEND_WEBHOOK_SECRET      → partagé équipe
NEXT_PUBLIC_APP_URL        → http://localhost:3000 en dev
CRON_SECRET                → partagé équipe
```

---

## Ce qui reste à faire (V1)

- [ ] `POST /api/webhook/cal` — confirmation RDV Cal.com → mettre à jour `leads.status = booked`, annuler relances
- [ ] Insérer client démo en base (voir `supabase/schema.sql` section INSERT commentée)
- [ ] Tester le flow end-to-end avec un vrai lead

## V2+ (hors scope MVP)

- SMS (Twilio)
- Multi-source leads (Meta Ads, Google Lead Forms)
- UI self-serve onboarding client
- Multi-calendar (Outlook)
- Alertes Slack/email au commercial en temps réel
