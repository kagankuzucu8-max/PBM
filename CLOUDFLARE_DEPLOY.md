# PBM Cloudflare Workers Deploy

PBM, Cloudflare Workers + Static Assets uzerinde calisir. Supabase ayni kalir; kullanici hesaplari ve kullanici datalari korunur.

## Build settings

- Root directory: repo root (`/`)
- Build command: bos birak
- Deploy command:

```bash
npx wrangler deploy
```

`wrangler.toml`, repoda hazir bulunan `frontend/build` klasorunu yayinlar ve Worker API'sini `/api` altinda calistirir.

## Worker variables

Cloudflare Dashboard > Workers & Pages > `pbm-marketdesk` > Settings > Variables:

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

Social email bildirimleri icin:

```text
RESEND_API_KEY
PBM_EMAIL_FROM
```

Android uygulama push bildirimleri icin:

```text
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
```

`FIREBASE_SERVICE_ACCOUNT_JSON`, Firebase service-account JSON dosyasinin tamamini Cloudflare secret olarak saklamalidir. Frontend'e veya GitHub'a koyma.

`PBM_SITE_URL`, canli uygulamanin tam adresi olmali:

```text
https://app.senindomainin.com
```

`PBM_EMAIL_FROM`, Resend'de dogrulanmis bir domain adresi olmali:

```text
PBM <notifications@senindomainin.com>
```

## URL'deki kagankuzucu8-max adini kaldirma

`kagankuzucu8-max`, Cloudflare hesabinin `workers.dev` alt alan adidir. Bunu Cloudflare Dashboard > Workers & Pages ekraninda `Your subdomain` yanindaki `Change` ile degistirebilirsin. Bu hesap seviyesinde oldugu icin hesaptaki tum Worker URL'lerini etkiler.

Production icin onerilen cozum temiz bir Custom Domain baglamaktir:

1. Cloudflare Dashboard > Workers & Pages > `pbm-marketdesk`
2. Settings > Domains & Routes
3. Add > Custom Domain
4. Ornek olarak `app.senindomainin.com` yaz ve onayla
5. Worker Variables icindeki `PBM_SITE_URL` degerini ayni URL yap

Cloudflare DNS kaydini ve SSL sertifikasini otomatik yonetir. Domain'in Cloudflare hesabinda aktif bir zone olmasi gerekir.

## Supabase SQL

Yeni Social web bildirim merkezi icin Supabase SQL Editor'de bir kere calistir:

```text
supabase/social_notifications_20260606.sql
```

Android push tokenlari icin:

```text
supabase/mobile_push_notifications_20260606.sql
```

Tum sifir kurulum semasi:

```text
supabase/schema.sql
```

Admin yetkisini sadece `kagankuzucu8@gmail.com` hesabina sabitlemek icin:

```text
supabase/admin_transfer_kagankuzucu8.sql
```

## Deploy kontrolu

Deploy sonrasi:

```text
https://SENIN-CLOUDFLARE-LINKIN/api/health
```

Beklenen cevap:

```json
{"status":"ok","service":"pbm-ai","runtime":"cloudflare-workers"}
```

Dashboard, chart, AI analiz ve mevcut PBM tasarim motoru bu kurulumda degismez.
