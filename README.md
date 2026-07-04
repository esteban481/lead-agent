# Lead Agent

![CI](https://github.com/esteban481/lead-agent/actions/workflows/ci.yml/badge.svg)

Agent IA B2B qui transforme automatiquement les leads entrants en **rendez-vous qualifiés**.

**Ce qu'on vend :** plus de RDV qualifiés sans effort pour l'entreprise cliente.
**Ce qu'on ne vend pas :** de l'IA, un chatbot, un CRM.

```
Formulaire web → webhook → email de qualification → conversation par email
   → scoring Claude → lien Cal.com → relances automatiques → dashboard
```

## Fonctionnalités

- **Qualification conversationnelle** : l'agent pose les questions du client par email, comprend les réponses (et sait détecter « pas intéressé » / opt-out)
- **Scoring déterministe** : Claude évalue chaque critère, le code calcule le score et la catégorie A/B/C/D
- **Prise de RDV** : lien Cal.com envoyé aux leads chauds ; création, annulation et report gérés par webhook
- **Relances automatiques** : J+1 / J+3 / J+7, dans la plage horaire du client (fuseau Europe/Paris)
- **Multi-tenant** : chaque client a sa config (questions, zone, scoring, branding email), son login dashboard scopé à ses leads, et une UI admin d'onboarding (`/clients`)
- **Dashboard** : funnel de conversion, temps de premier contact, liste filtrable, fiche lead avec actions manuelles
- **Alertes commercial** : email au commercial sur lead chaud et RDV confirmé

## Stack

Next.js 15 (App Router) · Supabase (Postgres) · Anthropic Claude · Resend (envoi + inbound) · Cal.com · Vercel

## Démarrer

```bash
git clone https://github.com/esteban481/lead-agent.git
cd lead-agent
npm install
cp .env.example .env   # puis remplir les clés (voir ARCHITECTURE.md)
npm run dev            # → http://localhost:3000
```

```bash
npm test        # 169 tests (logique pure, webhooks, routes, composants React)
npm run lint
npm run build
```

## Documentation

| Fichier | Contenu |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture, flux, base de données, sécurité, variables d'environnement |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow git, conventions, onboarding développeur |
| [CLAUDE.md](CLAUDE.md) | Contexte pour Claude Code (assistant de dev) |
| [supabase/schema.sql](supabase/schema.sql) | Schéma complet + structure de la config client |

## Qualité

- CI GitHub Actions (lint + tests + build) requise avant tout merge sur `main`
- Webhooks signés (Resend/Svix, Cal.com), idempotents, endpoint public rate-limité
- Sessions signées HMAC, mots de passe hachés PBKDF2, scoping strict par client
