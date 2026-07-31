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
| `scoring.eval.ts` | `scoreLead` → `decideNextAction` : catégorie + action attendues. |
| `intent.eval.ts` | `detectIntent` : opt-out / pas intéressé / réponse. |

## Cas « cœur » vs « gap »

- **Cœur** : leads en cible que le produit doit bien traiter. Ils gouvernent la
  garde (précision minimale exigée).
- **Gap** (`knownGap`) : cas que le barème actuel ne sait **pas encore** gérer.
  Ils sont affichés dans le rapport pour documenter la prochaine amélioration —
  ils ne font pas échouer le run. Quand un futur changement les fait passer,
  le rapport affiche « ✅ résolu ».

### Gaps connus aujourd'hui

Le barème additionne des points sans **disqualifiant dur**. Conséquence :

- un lead **hors zone** mais parfait par ailleurs est scoré comme un lead chaud ;
- une demande d'un **type de projet refusé** (dépannage) n'est pas disqualifiée.

Prochaine itération naturelle : ajouter des disqualifiants durs (zone / type de
projet) et re-lancer l'eval pour prouver le gain.

## Étendre le dataset

Ajoute un cas dans `dataset.ts` (`scoringCases` ou `intentCases`) avec son
résultat attendu. Garde les cas **tranchés** pour limiter le bruit LLM.
