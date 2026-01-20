-- Supabase schema for church-management-js
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. app_logs: centralised logging
create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  level text not null,
  message text not null,
  data jsonb,
  user_id bigint,
  command text,
  source text,
  request_id text
);

create index if not exists idx_app_logs_ts on app_logs(ts);
create index if not exists idx_app_logs_level on app_logs(level);
create index if not exists idx_app_logs_user_id on app_logs(user_id) where user_id is not null;
create index if not exists idx_app_logs_command on app_logs(command) where command is not null;

-- 2. user_form_state: multi-step form state (survives cold start)
create table if not exists user_form_state (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  state_type text not null,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, state_type)
);

create index if not exists idx_user_form_state_user_type on user_form_state(user_id, state_type);
create index if not exists idx_user_form_state_updated on user_form_state(updated_at);

-- 3. app_config (optional: key-value config, fallback to .env)
create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Example: insert into app_config (key, value) values
--   ('LOG_LEVEL', 'info'),
--   ('DEBUG', 'false'),
--   ('SUPABASE_LOGS_ENABLED', 'true'),
--   ('TELEGRAM_YOUTH_GROUP_ID', ''),
--   ('TELEGRAM_CHAT_ID_DEBUG', ''),
--   ('TELEGRAM_TOPIC_ID_DEBUG', '');

-- 4. youth_leaders (optional: telegram_id -> name, replaces YOUTH_LEADER_MAPPING / Notion)
create table if not exists youth_leaders (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  name text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 5. allowed_users (optional: replaces ALLOWED_USERS env)
create table if not exists allowed_users (
  telegram_id bigint primary key,
  role text,
  added_at timestamptz not null default now()
);

