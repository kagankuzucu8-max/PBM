# PBM Cloudflare Pages Deploy

Bu dokuman Netlify credit sorununu ortadan kaldirmak icin PBM'i Cloudflare Pages + Pages Functions uzerinde calistirma ayarlaridir. Supabase ayni kalir; kullanici hesaplari ve datalar tasinmaz.

## Cloudflare Pages ayarlari

- Framework preset: `Create React App` veya `None`
- Root directory: bos birak veya repo root
- Build command:

```bash
cd frontend && npm install --legacy-peer-deps --no-audit --no-fund && CI=false npm run build
```

- Build output directory:

```bash
frontend/build
```

Cloudflare Functions klasoru repo root'taki `functions/` klasorudur. API endpoint artik:

```text
/api
```

Frontend varsayilan olarak `REACT_APP_API_BASE` yoksa `/api` kullanir.

## Environment variables

Cloudflare Pages > Settings > Environment variables alanina bunlari gir:

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

Admin yetkisini sadece `kaankuzucub@gmail.com` hesabina sabitlemek icin su dosyayi Supabase SQL Editor'de bir kere calistir:

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
{"status":"ok","service":"pbm-ai","runtime":"cloudflare-pages-functions"}
```

Tasarim/palet/chart/AI ekranlari bu tasima ile degismez.
