import { defineConfig } from 'vitest/config'
import path from 'path'

// ============================================================
// Config vitest DÉDIÉE aux evals.
//
// Volontairement séparée de la racine : `npm test` (et donc la CI)
// n'inclut que src/**/*.test.ts et n'exécutera JAMAIS ces evals —
// qui appellent la vraie API Claude (coût + non-déterminisme).
// Lancer manuellement avec :  npm run eval
// ============================================================
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '../src') },
  },
  test: {
    include: ['evals/**/*.eval.ts'],
    setupFiles: ['evals/setup.ts'],
    testTimeout: 60_000, // appels réseau réels vers Claude
    hookTimeout: 60_000,
    fileParallelism: false, // limite le nombre d'appels API simultanés
  },
})
