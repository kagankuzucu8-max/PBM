-- PBM admin transfer
-- Run in Supabase SQL Editor after schema.sql.
-- This does not delete or edit auth.users; it only changes PBM app access.

insert into public.beta_access (
  email,
  role,
  status,
  weekly_ai_limit,
  daily_ai_limit,
  can_post_social,
  can_add_education,
  notes
)
values (
  'kagankuzucu8@gmail.com',
  'admin',
  'active',
  9999,
  9999,
  true,
  true,
  'PBM admin'
)
on conflict (email) do update
set role = 'admin',
    status = 'active',
    weekly_ai_limit = 9999,
    daily_ai_limit = 9999,
    can_post_social = true,
    can_add_education = true,
    notes = 'PBM admin',
    updated_at = now();

insert into public.beta_access (
  email,
  role,
  status,
  weekly_ai_limit,
  daily_ai_limit,
  can_post_social,
  can_add_education,
  notes
)
values (
  'kaankuzucub@gmail.com',
  'user',
  'revoked',
  0,
  0,
  false,
  false,
  'Old admin access revoked'
)
on conflict (email) do update
set role = 'user',
    status = 'revoked',
    weekly_ai_limit = 0,
    daily_ai_limit = 0,
    can_post_social = false,
    can_add_education = false,
    notes = 'Old admin access revoked',
    updated_at = now();

notify pgrst, 'reload schema';
