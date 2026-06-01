-- PBM admin auth identity UUID hotfix
-- Run this only if schema.sql failed on auth.identities.id uuid/text mismatch.

create extension if not exists pgcrypto;

insert into public.beta_access (email, role, status, weekly_ai_limit, daily_ai_limit, can_post_social, can_add_education, notes)
values ('kaankuzucub@gmail.com', 'admin', 'active', 9999, 9999, true, true, 'PBM admin')
on conflict (email) do update
set role = excluded.role,
    status = excluded.status,
    weekly_ai_limit = excluded.weekly_ai_limit,
    daily_ai_limit = excluded.daily_ai_limit,
    can_post_social = excluded.can_post_social,
    can_add_education = excluded.can_add_education,
    notes = excluded.notes,
    updated_at = now();

do $$
declare
  test_user_id uuid;
begin
  select id into test_user_id
  from auth.users
  where email = 'kaankuzucub@gmail.com'
  limit 1;

  if test_user_id is null then
    test_user_id := gen_random_uuid();
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at
    )
    values (
      test_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'kaankuzucub@gmail.com',
      crypt('Kursad123.', gen_salt('bf')),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = crypt('Kursad123.', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = test_user_id;
  end if;

  insert into public.user_settings (user_id)
  values (test_user_id)
  on conflict do nothing;

  insert into public.watchlists (user_id, name)
  select test_user_id, 'My Watchlist'
  where not exists (
    select 1 from public.watchlists where user_id = test_user_id
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  select
    test_user_id,
    test_user_id,
    test_user_id::text,
    jsonb_build_object('sub', test_user_id::text, 'email', 'kaankuzucub@gmail.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  where not exists (
    select 1
    from auth.identities
    where provider = 'email'
      and provider_id = test_user_id::text
  );
end $$;
