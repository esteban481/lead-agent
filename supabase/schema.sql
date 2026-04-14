-- ============================================================
-- LEAD AGENT - Schéma Supabase MVP
-- À coller dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- Extension pour les UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- CLIENTS
-- Un client = une entreprise utilisant l'outil
-- Configuré manuellement par nous en V1
-- ============================================================
create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  sector        text not null,                -- ex: 'pac', 'renovation', 'isolation'
  config        jsonb not null default '{}',  -- voir structure ci-dessous
  created_at    timestamptz not null default now()
);

-- Structure attendue du champ config :
-- {
--   "zone": ["Essonne", "Yvelines", "Hauts-de-Seine"],
--   "accepted_project_types": ["installation_pac_air_eau"],
--   "rejected_project_types": ["depannage", "appartement_petit"],
--   "qualification_questions": [
--     { "key": "type_logement", "label": "Maison ou appartement ?" },
--     { "key": "surface", "label": "Surface approximative ?" },
--     { "key": "chauffage_actuel", "label": "Chauffage actuel ?" },
--     { "key": "delai_projet", "label": "Projet prévu sous combien de temps ?" },
--     { "key": "code_postal", "label": "Code postal ?" }
--   ],
--   "scoring_weights": {
--     "zone_covered": 20,
--     "project_type_accepted": 20,
--     "surface_ok": 15,
--     "urgency_high": 15,
--     "budget_coherent": 10,
--     "message_quality": 10,
--     "contact_reachable": 10
--   },
--   "score_threshold_hot": 75,
--   "relance_hours": { "start": 8, "end": 20 },
--   "cal_booking_url": "https://cal.com/xxx/15min",
--   "from_email": "leads@tondomaine.com"
-- }

-- ============================================================
-- LEADS
-- Un lead = une demande entrante
-- ============================================================
create type lead_status as enum (
  'new',
  'awaiting_reply',
  'qualifying',
  'scoring',
  'booked',
  'disqualified',
  'cold'
);

create type score_category as enum ('A', 'B', 'C', 'D');

create table leads (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id),
  -- Infos contact
  name                  text,
  email                 text,
  phone                 text,
  -- Source
  source                text not null default 'website_form',
  raw_data              jsonb not null default '{}',  -- payload brut reçu
  -- Statut
  status                lead_status not null default 'new',
  -- Scoring
  score                 int,
  score_category        score_category,
  score_details         jsonb,     -- détail des critères
  ai_summary            text,      -- résumé lisible humain généré par Claude
  disqualified_reason   text,
  -- RDV
  meeting_booked_at     timestamptz,
  cal_booking_id        text,
  -- Déduplication
  email_thread_id       text,      -- Message-ID du premier email envoyé
  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Index fréquents
create index leads_client_id_idx on leads(client_id);
create index leads_email_idx on leads(email);
create index leads_status_idx on leads(status);
create index leads_created_at_idx on leads(created_at desc);

-- Mise à jour automatique de updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- ============================================================
-- MESSAGES
-- Tout ce qui est envoyé ou reçu (email uniquement en V1)
-- ============================================================
create type message_direction as enum ('out', 'in');

create table messages (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id),
  direction     message_direction not null,
  channel       text not null default 'email',
  subject       text,
  body          text not null,
  -- Headers email pour rattachement des réponses
  message_id    text,             -- Message-ID de l'email envoyé
  in_reply_to   text,             -- In-Reply-To reçu dans la réponse
  resend_email_id text,           -- ID Resend pour tracking
  sent_at       timestamptz not null default now()
);

create index messages_lead_id_idx on messages(lead_id);
create index messages_message_id_idx on messages(message_id);

-- ============================================================
-- QUALIFICATION ANSWERS
-- Réponses collectées pendant la qualification
-- ============================================================
create table qualification_answers (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id),
  question_key  text not null,    -- ex: 'type_logement', 'surface'
  answer        text not null,
  created_at    timestamptz not null default now()
);

create index qa_lead_id_idx on qualification_answers(lead_id);

-- ============================================================
-- SCHEDULED RELANCES
-- File de relances planifiées
-- ============================================================
create type relance_status as enum ('pending', 'sent', 'cancelled');

create table scheduled_relances (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id),
  step          int not null,           -- 1 = J+1, 2 = J+3, 3 = J+7
  scheduled_at  timestamptz not null,
  status        relance_status not null default 'pending',
  sent_at       timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index relances_lead_id_idx on scheduled_relances(lead_id);
create index relances_pending_idx on scheduled_relances(status, scheduled_at)
  where status = 'pending';

-- ============================================================
-- CLIENT DE DÉMO (à adapter)
-- À insérer après avoir créé ton projet Supabase
-- ============================================================
-- insert into clients (name, sector, config) values (
--   'PAC Essonne Demo',
--   'pac',
--   '{
--     "zone": ["Essonne", "Yvelines", "Hauts-de-Seine"],
--     "accepted_project_types": ["installation_pac_air_eau"],
--     "rejected_project_types": ["depannage"],
--     "qualification_questions": [
--       { "key": "type_logement", "label": "Maison ou appartement ?" },
--       { "key": "surface", "label": "Surface approximative ?" },
--       { "key": "chauffage_actuel", "label": "Chauffage actuel ?" },
--       { "key": "delai_projet", "label": "Projet prévu sous combien de temps ?" },
--       { "key": "code_postal", "label": "Code postal ?" }
--     ],
--     "scoring_weights": {
--       "zone_covered": 20,
--       "project_type_accepted": 20,
--       "surface_ok": 15,
--       "urgency_high": 15,
--       "budget_coherent": 10,
--       "message_quality": 10,
--       "contact_reachable": 10
--     },
--     "score_threshold_hot": 75,
--     "relance_hours": { "start": 8, "end": 20 },
--     "cal_booking_url": "https://cal.com/xxx/15min",
--     "from_email": "leads@tondomaine.com"
--   }'
-- );
