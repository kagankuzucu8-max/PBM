-- PBM Android push notification tokens
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

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

create index if not exists push_tokens_recipient_active_idx
  on public.push_tokens (lower(recipient_email), active, updated_at desc);

alter table public.push_tokens enable row level security;

drop policy if exists "own push_tokens" on public.push_tokens;
create policy "own push_tokens"
  on public.push_tokens for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists push_tokens_updated_at on public.push_tokens;
create trigger push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.tg_set_updated_at();

grant usage on schema public to authenticated, service_role;
grant all on public.push_tokens to authenticated, service_role;

notify pgrst, 'reload schema';
