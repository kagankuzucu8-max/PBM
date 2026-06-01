# PBM Netlify + Supabase Deploy

This project is prepared for Netlify without changing the React design, chart
components, technical engine UI, or page layout.

## Supabase

Run `supabase/schema.sql` once in Supabase SQL Editor. Re-run it after this
update so Social, Journal, Payout Tracker, Education, the test user, and the
`social-images` storage bucket/policies are created.

Set these values in Netlify under Site settings -> Environment variables:

| Key | Scope | Notes |
| --- | --- | --- |
| `REACT_APP_SUPABASE_URL` | Builds | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Builds | Public anon key used by React |
| `TWELVE_DATA_API_KEY` | Functions | Server-only key for Forex, indices, and market-data fallback |

The service role key is not required for this Netlify Functions version because
the app uses Supabase RLS from the browser with the anon key.

## Netlify

Use the repository root as the Netlify base directory.

Netlify reads `netlify.toml`:

| Setting | Value |
| --- | --- |
| Build command | `cd frontend && npm install --legacy-peer-deps --no-audit --no-fund && CI=false npm run build` |
| Publish directory | `frontend/build` |
| Functions directory | `netlify/functions` |

`frontend/public/_redirects` is also included so SPA routing and `/api/*`
function routing survive manual/static deploy flows.

Leave `REACT_APP_BACKEND_URL` empty in production. The frontend will call
same-origin `/api/*`, and Netlify will run `netlify/functions/api.mjs`.

Market data now uses OKX/Binance for crypto and Yahoo chart data for forex and
indices, with Twelve Data as a server-side fallback.

## AI Analysis Key

The Netlify function now contains the market-data endpoints and the analysis
endpoint. You do not need `BACKEND_PROXY_URL`.

Set one of these server-side function environment variables:

| Key | Scope | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Functions | Recommended for Claude Sonnet |
| `EMERGENT_LLM_KEY` | Functions | Optional fallback if compatible with Anthropic messages API |

Optional:

| Key | Scope | Notes |
| --- | --- | --- |
| `CLAUDE_MODEL` | Functions | Defaults to `claude-sonnet-4-5-20250929` |
| `ANTHROPIC_BASE_URL` | Functions | Defaults to `https://api.anthropic.com` |

## Supabase Auth URL

After the first Netlify deploy, add the Netlify production URL in Supabase:

```text
Authentication -> URL Configuration -> Site URL
```

Also add preview/custom domains under Redirect URLs if you use them.

## Security Notes

- `REACT_APP_SUPABASE_ANON_KEY` is public by design.
- `SUPABASE_SERVICE_ROLE_KEY` is not needed for this build.
- `TWELVE_DATA_API_KEY` must stay server-side only.
- `ANTHROPIC_API_KEY` or `EMERGENT_LLM_KEY` belongs only in Netlify function env.
- Do not commit `.env`, `.env.local`, or Netlify `.netlify/` folders.
