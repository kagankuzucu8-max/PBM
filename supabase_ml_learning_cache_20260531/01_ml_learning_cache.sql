-- PBM ML learning + analysis cache update
-- Run in Supabase SQL Editor before deploying the frontend/functions update.

create extension if not exists pgcrypto;

create table if not exists public.analysis_cache (
  cache_key text primary key,
  symbol text not null,
  market text not null default 'crypto',
  timeframe text not null default '1h',
  language text not null default 'en',
  analysis jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_cache add column if not exists symbol text;
alter table public.analysis_cache add column if not exists market text not null default 'crypto';
alter table public.analysis_cache add column if not exists timeframe text not null default '1h';
alter table public.analysis_cache add column if not exists language text not null default 'en';
alter table public.analysis_cache add column if not exists analysis jsonb not null default '{}'::jsonb;
alter table public.analysis_cache add column if not exists expires_at timestamptz;
alter table public.analysis_cache add column if not exists updated_at timestamptz not null default now();

create index if not exists analysis_cache_symbol_tf_idx
  on public.analysis_cache (symbol, market, timeframe, language, expires_at desc);

alter table public.analysis_cache enable row level security;

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists analysis_cache_updated_at on public.analysis_cache;
create trigger analysis_cache_updated_at
  before update on public.analysis_cache
  for each row execute function public.tg_set_updated_at();

-- No public RLS policy is created for analysis_cache.
-- The Cloudflare/Netlify function reads and writes this table with the service role key.
-- ML model outputs are imported into public.pbm_brain_memories with memory_type = 'ml_model'.
