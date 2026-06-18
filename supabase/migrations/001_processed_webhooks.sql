-- ============================================================
-- Migration 001 — Idempotence des webhooks
-- À coller dans l'éditeur SQL Supabase (une seule fois).
-- Sans cette table, le code fonctionne mais SANS déduplication
-- (dégradation gracieuse, warning dans les logs).
-- ============================================================

create table if not exists processed_webhooks (
  id          text primary key,        -- "{source}:{event_id}"
  source      text not null,           -- 'resend_inbound' | 'cal'
  created_at  timestamptz not null default now()
);

-- Purge optionnelle : ces clés ne servent qu'à dédupliquer les
-- livraisons rapprochées. On peut nettoyer les vieilles entrées.
-- (À planifier plus tard si la table grossit — non critique en V1.)
