-- PBM Social web notifications
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

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

create index if not exists notifications_recipient_created_idx
  on public.notifications (lower(recipient_email), created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (lower(recipient_email), read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "own notifications read" on public.notifications;
drop policy if exists "own notifications update" on public.notifications;

create policy "own notifications read"
  on public.notifications for select
  to authenticated
  using (lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

create policy "own notifications update"
  on public.notifications for update
  to authenticated
  using (lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')))
  with check (lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

grant usage on schema public to authenticated, service_role;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

notify pgrst, 'reload schema';
