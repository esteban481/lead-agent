# Evals — mesurer la qualité du jugement de l'IA

La suite `npm test` teste la **mécanique déterministe** (sommes, seuils, regex).
Ces evals testent ce qu'elle ne peut pas : **est-ce que Claude _juge_ bien ?**
Un bon lead est-il noté A ? Un « désinscrivez-moi » est-il bien détecté ?

C'est un **filet anti-régression** : le jour où tu modifies un prompt ou le
barème, tu relances et tu vois immédiatement si tu as amélioré ou cassé le
jugement.

## Lancer

```bash
npm run eval
```

- Nécessite `ANTHROPIC_API_KEY` (chargée depuis `.env`). Sans clé → les evals
  sont **skippés** (aucune erreur, aucun coût).
- **Appelle la vraie API Claude** → coûte quelques centimes par run et n'est
  pas 100 % déterministe. C'est pourquoi c'est **hors de `npm test` et de la
  CI** (config vitest séparée : `evals/vitest.config.ts`).

## Contenu

| Fichier | Rôle |
|---|---|
| `dataset.ts` | Cas labellisés (résultat attendu écrit à la main). L'actif durable. |
| `scoring.eval.ts` | `scoreLead` → `decideNextAction` : **action** attendue. |
| `intent.eval.ts` | `detectIntent` : opt-out / pas intéressé / réponse. |

## On juge sur l'action, pas sur la catégorie

Le critère de réussite d'un cas de scoring est l'**action** décidée (booker /
disqualifier / relancer en douceur / re-questionner) — c'est le comportement
réel du produit. La catégorie A/B/C/D est affichée à titre indicatif mais **non
assertée** : la frontière A/B est floue et sans effet (A comme B déclenchent un
booking + une alerte). Juger sur l'action rend l'eval robuste au bruit du LLM.

### Ce que l'eval a déjà fait bouger

Le premier run a révélé deux défauts, corrigés depuis :

1. `decideNextAction` se fiait au `missing_fields` de Claude (peu fiable) →
   rendu **déterministe** via `isQualificationComplete(answers, config)`.
2. Le barème additif laissait passer en A/B des leads **hors zone** ou d'un
   **type de projet refusé** → ajout de **disqualifiants durs** (`out_of_zone`,
   `rejected_project` jugés par Claude, catégorie D forcée par le code).

Le champ `knownGap` (dans `dataset.ts`) reste disponible pour documenter un futur
cas que le produit ne sait pas encore traiter, sans faire échouer le run.

## Étendre le dataset

Ajoute un cas dans `dataset.ts` (`scoringCases` ou `intentCases`) avec son
résultat attendu. Garde les cas **tranchés** pour limiter le bruit LLM.
