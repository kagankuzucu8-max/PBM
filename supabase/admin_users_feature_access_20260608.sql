-- PBM admin user feature controls
-- Run once in Supabase SQL Editor, then deploy the updated Cloudflare Worker.

alter table public.beta_access
  add column if not exists can_use_ai_analysis boolean not null default true;

alter table public.beta_access
  add column if not exists can_use_pbm_brain boolean not null default false;

update public.beta_access
set can_use_ai_analysis = true,
    can_use_pbm_brain = case
      when lower(email) = 'kagankuzucu8@gmail.com' then true
      else false
    end,
    status = 'active',
    updated_at = now();

update public.beta_access
set role = 'admin',
    can_use_ai_analysis = true,
    can_use_pbm_brain = true,
    updated_at = now()
where lower(email) = 'kagankuzucu8@gmail.com';

drop policy if exists "own pbm_brain_runs" on public.pbm_brain_runs;
create policy "own pbm_brain_runs"
  on public.pbm_brain_runs for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and (access.can_use_pbm_brain is true or access.role = 'admin')
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and (access.can_use_pbm_brain is true or access.role = 'admin')
    )
  );

drop policy if exists "own pbm_brain_memories" on public.pbm_brain_memories;
create policy "own pbm_brain_memories"
  on public.pbm_brain_memories for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and (access.can_use_pbm_brain is true or access.role = 'admin')
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.beta_access access
      where lower(access.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and (access.can_use_pbm_brain is true or access.role = 'admin')
    )
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.beta_access (
    email, role, status, weekly_ai_limit, daily_ai_limit,
    can_post_social, can_add_education, can_use_ai_analysis, can_use_pbm_brain, notes
  )
  values (
    lower(coalesce(new.email, '')), 'user', 'active', 10, 10,
    false, false, true, false, 'PBM account'
  )
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

notify pgrst, 'reload schema';
