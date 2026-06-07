-- PBM TradingView Indicators library
-- Run once in Supabase Dashboard -> SQL Editor.

create table if not exists public.tradingview_indicators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_email text,
  title text not null,
  description text,
  tradingview_url text not null,
  banner_url text,
  created_at timestamptz not null default now()
);

create index if not exists tradingview_indicators_created_idx
  on public.tradingview_indicators (created_at desc);

alter table public.tradingview_indicators enable row level security;

drop policy if exists "public read tradingview_indicators" on public.tradingview_indicators;
drop policy if exists "admin insert tradingview_indicators" on public.tradingview_indicators;
drop policy if exists "admin update tradingview_indicators" on public.tradingview_indicators;
drop policy if exists "admin delete tradingview_indicators" on public.tradingview_indicators;

create policy "public read tradingview_indicators"
  on public.tradingview_indicators for select
  to anon, authenticated
  using (true);

create policy "admin insert tradingview_indicators"
  on public.tradingview_indicators for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

create policy "admin update tradingview_indicators"
  on public.tradingview_indicators for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  )
  with check (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

create policy "admin delete tradingview_indicators"
  on public.tradingview_indicators for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kagankuzucu8@gmail.com'
  );

grant select on public.tradingview_indicators to anon;
grant all on public.tradingview_indicators to authenticated, service_role;
notify pgrst, 'reload schema';
