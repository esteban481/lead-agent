-- ============================================================
-- Migration 002 — Identifiants de connexion par client (multi-tenant)
-- À coller dans l'éditeur SQL Supabase (une seule fois).
--
-- Permet à un client de se connecter au dashboard et de ne voir
-- que ses propres leads. L'admin (identifiants d'environnement)
-- continue de tout voir.
--
-- Les mots de passe sont stockés hachés (PBKDF2) : on conserve
-- un salt + un hash, jamais le mot de passe en clair.
-- ============================================================

alter table clients
  add column if not exists login_email         text,
  add column if not exists login_password_hash text,
  add column if not exists login_password_salt text;

-- Un email de connexion identifie un seul client
create unique index if not exists clients_login_email_idx
  on clients (login_email)
  where login_email is not null;
