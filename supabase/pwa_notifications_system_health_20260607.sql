-- PBM PWA notifications update
-- Run once in Supabase Dashboard -> SQL Editor.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recipient_email text not null,
  email_enabled boolean not null default true,
  web_push_enabled boolean not null default false,
  native_push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_preferences_recipient_idx
  on public.notification_preferences (lower(recipient_email));

alter table public.notification_preferences enable row level security;

drop policy if exists "own notification_preferences" on public.notification_preferences;
create policy "own notification_preferences"
  on public.notification_preferences for all
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

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.tg_set_updated_at();

insert into public.notification_preferences (user_id, recipient_email)
select id, lower(email)
from auth.users
where email is not null
on conflict (user_id) do nothing;

grant all on public.notification_preferences to authenticated, service_role;

drop policy if exists "own pbm_brain_exports" on public.pbm_brain_exports;
create policy "own pbm_brain_exports"
  on public.pbm_brain_exports for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  )
  with check (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.beta_access (email, role, status, weekly_ai_limit, daily_ai_limit, can_post_social, can_add_education, notes)
    values (lower(coalesce(new.email, '')), 'user', 'active', 10, 10, false, false, 'Self-registered PBM account')
    on conflict (email) do nothing;
  insert into public.user_settings (user_id) values (new.id)
    on conflict do nothing;
  insert into public.watchlists (user_id, name) values (new.id, 'My Watchlist')
    on conflict do nothing;
  insert into public.notification_preferences (user_id, recipient_email)
    values (new.id, lower(coalesce(new.email, '')))
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';
