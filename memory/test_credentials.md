# MarketDesk Test Credentials

## Supabase Auth (test user)
- Email: `trader@marketdesk.test`
- Password: `TestPass123!`
- User ID: `628b43e5-3508-406c-aadf-bae2507a49f7`

## Supabase project
- URL: https://ppavbeuigfvpvufnpede.supabase.co
- Anon key + service_role key set in `/app/backend/.env` and `/app/frontend/.env`
- Project owner must run `/app/supabase/schema.sql` once in the Supabase SQL Editor for watchlists/alerts/history tables.
- Email confirmation is DISABLED on this project — signups return access_token immediately.

## Backend
- AI engine uses Emergent Universal LLM Key (Claude Sonnet 4.5).
- Endpoints under `/api/`: health, market/klines, market/ticker24h, market/global, market/search, analyze, chat.

