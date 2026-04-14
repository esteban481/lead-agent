# Contributing — Lead Agent

## Règles de travail en équipe

### Git — les réflexes obligatoires

**Chaque matin avant de coder :**
```bash
git checkout main
git pull
```

**Avant chaque nouvelle feature :**
```bash
git checkout -b feat/nom-de-la-feature
# ou
git checkout -b fix/nom-du-bug
```

**Pendant que tu codes — commite régulièrement :**
```bash
git add src/le-fichier-modifie.ts
git commit -m "feat: description courte de ce que tu as fait"
```

**Quand la feature est terminée :**
```bash
git push origin feat/nom-de-la-feature
# puis sur GitHub → ouvrir une Pull Request
```

**Après un merge :**
```bash
git checkout main
git pull
git branch -d feat/nom-de-la-feature
```

---

### Convention de nommage des branches

```
feat/webhook-cal        ← nouvelle feature
fix/bug-scoring         ← correction de bug
chore/update-deps       ← maintenance
```

### Convention de nommage des commits

```
feat: ajouter webhook Cal.com
fix: corriger extraction code postal
chore: mettre à jour dépendances
docs: mettre à jour ARCHITECTURE.md
```

---

### Règles de Pull Request

- On ne merge jamais sans que l'autre ait relu
- Chaque PR doit être petite et ciblée (une chose à la fois)
- On ne push jamais directement sur `main`

---

### Mise à jour de ARCHITECTURE.md

**Obligatoire** : si ta PR modifie l'architecture du projet (nouvelle table, nouveau webhook, nouvelle lib, nouveau flux), tu mets à jour `ARCHITECTURE.md` dans le même commit.

Si tu ne le fais pas, la PR ne sera pas mergée.

---

### Ce qui ne va jamais sur GitHub

- `.env` — jamais, sous aucun prétexte
- `node_modules/` — déjà dans `.gitignore`

---

## Onboarding — démarrer sur le projet

```bash
# 1. Cloner le repo
git clone https://github.com/esteban481/lead-agent.git
cd lead-agent

# 2. Installer les dépendances
npm install

# 3. Créer son .env local
cp .env.example .env
# Remplir les valeurs avec ses propres clés

# 4. Lancer en local
npm run dev
# → http://localhost:3000
```

---

## Utiliser Claude comme assistant de dev

Chaque dev utilise **son propre compte Claude**.

Au début de chaque session, coller dans Claude :
1. Le contenu de `ARCHITECTURE.md`
2. Le contenu de `CONTRIBUTING.md`
3. Ce sur quoi tu travailles

Exemple :
> "Voici l'architecture du projet : [colle ARCHITECTURE.md]. Voici les règles de contribution : [colle CONTRIBUTING.md]. Je veux implémenter le webhook Cal.com."

Claude sera immédiatement opérationnel sur le projet.

---

## Variables d'environnement

Chaque dev a son propre `.env` local avec ses propres clés :

```
ANTHROPIC_API_KEY       → console.anthropic.com (clé personnelle)
NEXT_PUBLIC_SUPABASE_URL      → supabase.com (partagé avec l'équipe)
NEXT_PUBLIC_SUPABASE_ANON_KEY → supabase.com (partagé avec l'équipe)
SUPABASE_SERVICE_ROLE_KEY     → supabase.com (partagé avec l'équipe)
RESEND_API_KEY          → resend.com (partagé avec l'équipe)
RESEND_FROM_EMAIL       → leads@tondomaine.com
NEXT_PUBLIC_APP_URL     → http://localhost:3000 en dev
CRON_SECRET             → chaîne aléatoire (partagée avec l'équipe)
```
