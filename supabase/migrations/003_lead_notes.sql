-- ============================================================
-- Migration 003 — Notes internes sur les leads
-- (Déjà appliquée en prod le 2026-07-05 via Management API.)
-- ============================================================

alter table leads add column if not exists notes text;
