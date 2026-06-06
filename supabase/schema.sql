-- PBM AI — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → paste & RUN
-- Safe to re-run (idempotent).

create extension if not exists pgcrypto;

-- =========== Tables ===========

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_timeframe text not null default '1h',
  default_market text not null default 'crypto',
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beta_access (
  email text primary key,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','paused','revoked')),
  weekly_ai_limit integer not null default 10,
  daily_ai_limit integer not null default 10,
  can_post_social boolean not null default false,
  can_add_education boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  action text not null,
  period_start date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  market text not null default 'crypto',
  note text,
  created_at timestamptz not null default now(),
  unique (watchlist_id, symbol, market)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  market text not null default 'crypto',
  condition text not null check (condition in ('price_above','price_below','rsi_above','rsi_below','pct_change_24h_above','pct_change_24h_below')),
  threshold numeric not null,
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  market text not null,
  timeframe text not null,
  verdict text not null,
  combined_score numeric not null,
  summary text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

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

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_email text,
  author_nickname text,
  symbol text not null,
  market text not null default 'crypto',
  timeframe text not null default '1h',
  bias text not null default 'neutral',
  confidence numeric,
  summary text,
  image_url text not null,
  image_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  sender_email text,
  type text not null default 'social_post',
  title text not null,
  body text,
  href text not null default '/social',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  token text not null unique,
  platform text not null default 'android',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_date timestamptz not null default now(),
  symbol text not null,
  market text not null default 'crypto',
  side text not null default 'long',
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  fees numeric default 0,
  pnl numeric,
  strategy text,
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm text not null,
  account_name text,
  account_size numeric,
  challenge_phase text,
  profit_target numeric,
  max_daily_loss numeric,
  max_loss numeric,
  current_balance numeric,
  next_payout_date date,
  payout_amount numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payout_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payout_account_id uuid references public.payout_accounts(id) on delete cascade,
  record_date timestamptz not null default now(),
  amount numeric not null default 0,
  status text not null default 'requested',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.education_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_email text,
  title text not null,
  video_url text not null,
  youtube_id text not null,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.pbm_brain_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text,
  router_topic text not null default 'general',
  expert text not null default 'PBM Router',
  setup_score numeric,
  confidence numeric,
  summary text,
  recommendations jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pbm_brain_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null default 'note',
  title text not null,
  content text,
  weight numeric not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pbm_brain_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  period_start timestamptz,
  period_end timestamptz,
  record_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_teaching_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_history_id uuid references public.analysis_history(id) on delete set null,
  symbol text not null,
  market text not null default 'crypto',
  timeframe text not null default '1h',
  outcome text not null default 'pending' check (outcome in ('correct','wrong','pending')),
  feedback text,
  lesson text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Existing beta databases may already have older versions of these tables.
-- Keep these additive changes idempotent so re-running the schema repairs missing fields.
alter table public.beta_access add column if not exists daily_ai_limit integer not null default 10;
alter table public.social_posts add column if not exists author_email text;
alter table public.social_posts add column if not exists author_nickname text;
alter table public.social_posts add column if not exists market text not null default 'crypto';
alter table public.social_posts add column if not exists timeframe text not null default '1h';
alter table public.social_posts add column if not exists bias text not null default 'neutral';
alter table public.social_posts add column if not exists confidence numeric;
alter table public.social_posts add column if not exists summary text;
alter table public.social_posts add column if not exists image_url text;
alter table public.social_posts add column if not exists image_path text;

alter table public.education_videos add column if not exists author_email text;
alter table public.education_videos add column if not exists video_url text;
alter table public.education_videos add column if not exists youtube_id text;
alter table public.education_videos add column if not exists thumbnail_url text;

alter table public.analysis_cache add column if not exists symbol text;
alter table public.analysis_cache add column if not exists market text not null default 'crypto';
alter table public.analysis_cache add column if not exists timeframe text not null default '1h';
alter table public.analysis_cache add column if not exists language text not null default 'en';
alter table public.analysis_cache add column if not exists analysis jsonb not null default '{}'::jsonb;
alter table public.analysis_cache add column if not exists expires_at timestamptz;
alter table public.analysis_cache add column if not exists updated_at timestamptz not null default now();

alter table public.beta_access alter column can_post_social set default false;
alter table public.beta_access alter column daily_ai_limit set default 10;
alter table public.beta_access alter column can_add_education set default false;

create index if not exists analysis_history_user_created_idx
  on public.analysis_history (user_id, created_at desc);
create index if not exists analysis_cache_symbol_tf_idx
  on public.analysis_cache (symbol, market, timeframe, language, expires_at desc);
create index if not exists beta_access_status_idx
  on public.beta_access (status, role);
create index if not exists usage_events_user_period_idx
  on public.usage_events (user_id, period_start, action, created_at desc);
create index if not exists alerts_user_active_idx
  on public.alerts (user_id, active);
create index if not exists social_posts_created_idx
  on public.social_posts (created_at desc);
create index if not exists notifications_recipient_created_idx
  on public.notifications (lower(recipient_email), created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (lower(recipient_email), read_at, created_at desc);
create index if not exists push_tokens_recipient_active_idx
  on public.push_tokens (lower(recipient_email), active, updated_at desc);
create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, trade_date desc);
create index if not exists payout_accounts_user_created_idx
  on public.payout_accounts (user_id, created_at desc);
create index if not exists payout_records_user_created_idx
  on public.payout_records (user_id, created_at desc);
create index if not exists education_videos_created_idx
  on public.education_videos (created_at desc);
create index if not exists pbm_brain_runs_user_created_idx
  on public.pbm_brain_runs (user_id, created_at desc);
create index if not exists pbm_brain_memories_user_created_idx
  on public.pbm_brain_memories (user_id, created_at desc);
create index if not exists pbm_brain_exports_user_created_idx
  on public.pbm_brain_exports (user_id, created_at desc);
create index if not exists ai_teaching_feedback_symbol_created_idx
  on public.ai_teaching_feedback (symbol, created_at desc);
create index if not exists ai_teaching_feedback_user_created_idx
  on public.ai_teaching_feedback (user_id, created_at desc);

-- =========== RLS ===========

alter table public.user_settings enable row level security;
alter table public.beta_access enable row level security;
alter table public.usage_events enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.alerts enable row level security;
alter table public.analysis_history enable row level security;
alter table public.analysis_cache enable row level security;
alter table public.social_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.journal_entries enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payout_records enable row level security;
alter table public.education_videos enable row level security;
alter table public.pbm_brain_runs enable row level security;
alter table public.pbm_brain_memories enable row level security;
alter table public.pbm_brain_exports enable row level security;
alter table public.ai_teaching_feedback enable row level security;

-- helper: drop then create policies (idempotent)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('user_settings','beta_access','usage_events','watchlists','watchlist_items','alerts','analysis_history','analysis_cache','social_posts','notifications','push_tokens','journal_entries','payout_accounts','payout_records','education_videos','pbm_brain_runs','pbm_brain_memories','pbm_brain_exports','ai_teaching_feedback')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "own user_settings"
  on public.user_settings for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own beta_access read"
  on public.beta_access for select
  to authenticated
  using (lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

create policy "own usage_events read"
  on public.usage_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "own usage_events insert"
  on public.usage_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own watchlists"
  on public.watchlists for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own watchlist_items"
  on public.watchlist_items for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own alerts"
  on public.alerts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own analysis_history"
  on public.analysis_history for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "public read social_posts"
  on public.social_posts for select
  to anon, authenticated
  using (true);

create policy "own insert social_posts"
  on public.social_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and access.status = 'active'
        and access.role = 'admin'
        and lower(access.email) = 'kagankuzucu8@gmail.com'
    )
  );

create policy "own update social_posts"
  on public.social_posts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own delete social_posts"
  on public.social_posts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "own notifications read"
  on public.notifications for select
  to authenticated
  using (lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

create policy "own notifications update"
  on public.notifications for update
  to authenticated
  using (lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')))
  with check (lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

create policy "own push_tokens"
  on public.push_tokens for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create policy "own journal_entries"
  on public.journal_entries for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own payout_accounts"
  on public.payout_accounts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own payout_records"
  on public.payout_records for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "public read education_videos"
  on public.education_videos for select
  to anon, authenticated
  using (true);

create policy "own insert education_videos"
  on public.education_videos for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

create policy "own update education_videos"
  on public.education_videos for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  )
  with check (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

create policy "own delete education_videos"
  on public.education_videos for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

create policy "own pbm_brain_runs"
  on public.pbm_brain_runs for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own pbm_brain_memories"
  on public.pbm_brain_memories for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own pbm_brain_exports"
  on public.pbm_brain_exports for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own ai_teaching_feedback"
  on public.ai_teaching_feedback for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and access.status = 'active'
        and access.role = 'admin'
        and lower(access.email) = 'kagankuzucu8@gmail.com'
    )
  );

-- =========== Triggers ===========

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.tg_set_updated_at();

drop trigger if exists beta_access_updated_at on public.beta_access;
create trigger beta_access_updated_at
  before update on public.beta_access
  for each row execute function public.tg_set_updated_at();

drop trigger if exists analysis_cache_updated_at on public.analysis_cache;
create trigger analysis_cache_updated_at
  before update on public.analysis_cache
  for each row execute function public.tg_set_updated_at();

drop trigger if exists push_tokens_updated_at on public.push_tokens;
create trigger push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.tg_set_updated_at();

drop trigger if exists payout_accounts_updated_at on public.payout_accounts;
create trigger payout_accounts_updated_at
  before update on public.payout_accounts
  for each row execute function public.tg_set_updated_at();

-- =========== Storage ===========

insert into storage.buckets (id, name, public)
values ('social-images', 'social-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read social images" on storage.objects;
drop policy if exists "authenticated upload social images" on storage.objects;
drop policy if exists "own update social images" on storage.objects;
drop policy if exists "own delete social images" on storage.objects;

create policy "public read social images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'social-images');

create policy "authenticated upload social images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'social-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and access.status = 'active'
        and access.role = 'admin'
        and lower(access.email) = 'kagankuzucu8@gmail.com'
    )
  );

create policy "own update social images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'social-images' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'social-images' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "own delete social images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'social-images' and (select auth.uid())::text = (storage.foldername(name))[1]);

-- =========== Closed beta defaults ===========

insert into public.beta_access (email, role, status, weekly_ai_limit, daily_ai_limit, can_post_social, can_add_education, notes)
values
  ('kagankuzucu8@gmail.com', 'admin', 'active', 9999, 9999, true, true, 'PBM admin'),
  ('trader@marketdesk.test', 'user', 'active', 10, 10, false, false, 'Local test account')
on conflict (email) do update
set role = excluded.role,
    status = excluded.status,
    weekly_ai_limit = excluded.weekly_ai_limit,
    daily_ai_limit = excluded.daily_ai_limit,
    can_post_social = excluded.can_post_social,
    can_add_education = excluded.can_add_education,
    notes = excluded.notes,
    updated_at = now();

update public.beta_access
set role = 'user',
    weekly_ai_limit = least(coalesce(weekly_ai_limit, 10), 10),
    daily_ai_limit = least(coalesce(daily_ai_limit, 10), 10),
    can_post_social = false,
    can_add_education = false,
    updated_at = now()
where lower(email) <> 'kagankuzucu8@gmail.com'
  and (role = 'admin' or can_post_social is true or can_add_education is true);

-- =========== Bootstrap helper for new users ===========

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id) values (new.id)
    on conflict do nothing;
  insert into public.watchlists (user_id, name) values (new.id, 'My Watchlist')
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========== API grants + schema cache reload ===========

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

notify pgrst, 'reload schema';
