# PBM Cloudflare Workers Deploy

Bu dokuman PBM'i Cloudflare Workers + Static Assets uzerinde calistirma ayarlaridir. Supabase ayni kalir; kullanici hesaplari ve datalar tasinmaz.

## Cloudflare Workers ayarlari

- Framework preset: `Create React App` veya `None`
- Root directory: bos birak veya repo root
- Build command:

```bash
bos birak
```

- Deploy command:

```bash
npx wrangler deploy
```

`wrangler.toml` hazir static dosyalari `frontend/build` klasorunden Static Assets olarak yayinlar. Bu pakette `frontend/build` hazir gelir; Cloudflare build komutu calistirmasa bile klasor vardir. API endpoint:

Not: Cloudflare bazen paneldeki build command'i kosmadan direkt deploy command'e gecebilir. Bu pakette `frontend/build` repoda hazir gelir; bu yuzden `frontend/build does not exist` hatasi bitmis olur.

```text
/api
```

Frontend varsayilan olarak `REACT_APP_API_BASE` yoksa `/api` kullanir.

Not: `wrangler.toml` icinde `keep_vars = true` vardir. Bu, Cloudflare Dashboard'da girdigin Supabase/Claude/Twelve Data env keylerini deploy sirasinda silmemesi icindir.

Not: SPA fallback Cloudflare Workers tarafinda `not_found_handling = "single-page-application"` ile yapilir.

## Environment variables

Cloudflare Pages > Settings > Environment variables alanina bunlari gir:
Cloudflare > Workers & Pages > PBM > Settings > Variables alaninda bu keyleri gir:

```text
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TWELVE_DATA_API_KEY
PBM_SITE_URL
```

Opsiyonel mail bildirimi icin:

```text
RESEND_API_KEY
PBM_EMAIL_FROM
```

`PBM_SITE_URL`, Cloudflare site linkin olmalı. Ornek:

```text
https://pbm.pages.dev
```

## Supabase SQL

Admin yetkisini sadece `kagankuzucu8@gmail.com` hesabina sabitlemek icin su dosyayi Supabase SQL Editor'de bir kere calistir:

```text
supabase_cloudflare_admin_fix_20260531/01_admin_only_permissions.sql
```

Bu SQL normal kullanicilari user rolune ceker; social post, social image upload, education video ekleme ve AI Teaching admin kilidini admin hesaba baglar.

## Kontrol

Deploy sonrasi su endpoint acilmali:

```text
https://SENIN-CLOUDFLARE-LINKIN/api/health
```

Beklenen cevap:

```json
{"status":"ok","service":"pbm-ai","runtime":"cloudflare-workers"}
```

Tasarim/palet/chart/AI ekranlari bu tasima ile degismez.
