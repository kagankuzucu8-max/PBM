# MarketDesk AI — Product Requirements Document

_Last updated: 2026-05-25 (initial rebuild)_

## Original problem statement
> "bu trading terminal analiz platformunu sıfırdan bir tasarım ile yeniden tasarlayıp analiz motoru kısmına iyileştirmeler yap ve netfliy supabase olduğu gibi ona uygun yap"

Translation: redesign the trading-terminal analysis platform from scratch with a fresh design, improve the analysis engine, and make it Netlify + Supabase ready.

## Architecture
| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 19 (CRA + Craco), Tailwind, shadcn primitives, lucide-react, recharts, lightweight-charts, technicalindicators | Pure SPA, Netlify-ready (`netlify.toml` + `_redirects` shipped) |
| Auth + DB | Supabase (Postgres + Auth) | Email/password. RLS-protected tables (watchlists, alerts, analysis_history, user_settings, watchlist_items). Schema in `/app/supabase/schema.sql` — **user must apply once via Supabase SQL Editor**. |
| AI engine | FastAPI + emergentintegrations + Claude Sonnet 4.5 (Emergent Universal LLM Key) | Endpoints `/api/analyze`, `/api/chat` |
| Market data | OKX + CoinPaprika (proxied via FastAPI to avoid browser CORS and IP region locks) | Binance is unreachable from the preview server's region. External symbol format remains Binance-style (`BTCUSDT`). |
| Tech indicators | Computed in-browser with `technicalindicators` (RSI, MACD, Bollinger, EMA20/50/200, SMA, ATR, ADX, Stochastic) | Sent to backend as `IndicatorSnapshot` for the AI prompt. |

## Implemented (2026-05-25)
- Sign-in / sign-up flow (Supabase email/password) with branded auth split-screen.
- Persistent sidebar layout, 6 navigable sections.
- **Dashboard**: global market cap, BTC dominance, 24h volume, top gainers/losers, popular asset tiles, user watchlist preview, symbol search.
- **Markets screener**: 1257+ SPOT pairs from OKX, sortable by volume/gain/loss/price, click-through to detail.
- **AssetDetail**: lightweight-charts candlestick/area, timeframe switcher (5m/15m/1h/4h/1d/1w), live ticker refresh every 10s.
- **Indicator Snapshot** panel: RSI/Stoch/ADX/MACD-hist gauges + EMA/SMA/BB/ATR/MACD readout + composite quick-verdict score.
- **AI Engine** panel (Claude Sonnet 4.5): verdict (strong_buy → strong_sell), confidence, executive summary, short-term & medium-term outlook, detected patterns with confidence, support/resistance levels, risk notes, combined score.
- **Watchlists**: multi-list management with add/remove items, live price column.
- **Alerts**: create/pause/delete alerts on price/RSI/24h-change conditions (storage only — evaluation worker is backlog).
- **AI History**: list of past Claude analyses, expandable detail view.
- **Settings**: default timeframe/market, optional Alpha Vantage key (browser-local), DB setup helper.
- Netlify deploy artifacts (`netlify.toml`, `frontend/public/_redirects`).

## Key requirements (static)
- All persistence happens in Supabase from the browser (RLS-secured).
- Backend is stateless and AI-only; portable to Supabase Edge Functions later.
- All UI text in user's preferred language (EN), all interactive elements have `data-testid`.
- Modern fintech aesthetic (Manrope headings + Inter body + tabular-nums for figures).

## Backlog
- **P1 — Server-side alert evaluator** (cron + push/email notifications).
- **P1 — Stock + Forex via Alpha Vantage** (UI scaffold exists; needs full AssetDetail integration).
- **P2 — Multi-asset comparison view** (overlay 2-4 charts).
- **P2 — Strategy backtesting** (run a rule on historical klines).
- **P2 — Realtime websocket prices** (OKX WS).
- **P2 — Public Edge-Function port** for the analyze/chat endpoints (so the Netlify deploy can drop the FastAPI service entirely).
- **P3 — Localization** (TR/EN switch).
- **P3 — Mobile responsive sidebar → bottom-tab nav**.

## Open user actions required
1. Run `/app/supabase/schema.sql` once in Supabase Dashboard → SQL Editor. Until then, watchlists/alerts/history/settings won't persist — the UI shows an in-app banner explaining this.
2. On Netlify deploy: set env vars `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, and `REACT_APP_BACKEND_URL` (FastAPI host).

## Test credentials
See `/app/memory/test_credentials.md`.
