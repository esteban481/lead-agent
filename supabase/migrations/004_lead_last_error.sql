-- ============================================================
-- Migration 004 — Suivi d'erreur technique sur les leads
-- (Déjà appliquée en prod le 2026-07-05 via Management API.)
--
-- Quand le traitement d'un lead échoue (webhook inbound, relance),
-- l'erreur est enregistrée ici et remonte au dashboard au lieu de
-- rester invisible dans les logs.
-- ============================================================

alter table leads add column if not exists last_error text;
