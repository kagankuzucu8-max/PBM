# PBM Production Security Checklist

Bu liste PBM tasarimini veya kullanici arayuzunu degistirmeden sistemin guvenli
sekilde canliya alinmasi icindir. Adimlari sirayla tamamla.

## 1. Zorunlu: Tum Gizli Anahtarlari Yenile

Daha once mesajlarda, ekran goruntulerinde veya dosyalarda paylasilmis tum
anahtarlar ele gecirilmis kabul edilmelidir. Eski anahtarlari sadece silmek
yeterli degildir; ilgili saglayicidan yenisini uret ve eskisini iptal et.

- Supabase service role/secret key
- Anthropic API key
- Cloudflare API token
- Telegram BotFather tokeni (`/revoke` ile)
- Resend API key
- Firebase service-account JSON anahtari
- Admin hesabi sifresi

Yeni gizli anahtarlari GitHub'a, frontend `.env` dosyalarina veya ekran
goruntulerine koyma.

## 2. Kodu Deploy Et

1. Bu klasordeki son kodu GitHub'a gonder.
2. Cloudflare Worker build/deploy islemini calistir.
3. Deploy sonrasinda `/health` endpoint'inin `status: ok` dondurdugunu kontrol et.
4. Giris, kayit, analiz, Social, Education ve Indicators akisini test et.

## 3. Supabase Guvenlik SQL'ini Calistir

Supabase Dashboard > SQL Editor > New query:

1. `supabase/security_hardening_20260608.sql` dosyasini calistir.
2. Hata almadan tamamlandigini kontrol et.
3. Storage > `social-images` bucket'inin private oldugunu kontrol et.
4. Database > Security Advisor sonuclarini incele.
5. Normal kullanici hesabiyla baska kullanicinin verisine erisilemedigini test et.

Kod ve SQL beraber deploy edilmelidir. SQL, Social gorsellerini private yapar;
uygulama bunlari sureli imzali URL ile acar.

## 4. Cloudflare Variables and Secrets

Cloudflare > Workers & Pages > PBM Worker > Settings > Variables and Secrets.

`Secret` olarak kaydet:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `TURNSTILE_SECRET_KEY` (kullaniliyorsa)

Normal variable olarak kaydet:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_TURNSTILE_SITE_KEY`
- Firebase public web config degerleri
- `PBM_ALLOWED_ORIGINS=https://pbmdesk.pbmsolutions.workers.dev,https://pbmsolutions.com,https://www.pbmsolutions.com`

Production ortaminda `PBM_ALLOW_LOCALHOST` tanimlama. Service role anahtarini
asla `REACT_APP_` ile baslayan bir degiskene koyma.

## 5. Cloudflare Hesap ve WAF

1. Cloudflare hesabi icin MFA ac.
2. WAF Managed Rules'i etkinlestir.
3. Rate Limiting kurallarini baslangic olarak su sekilde ayarla:
   - `/api/analyze`, `/api/chat`, `/api/brain/analyze`: IP basina dakikada 20
   - `/api/*`: IP basina dakikada 120
4. Ilk hafta loglari izle ve gercek kullanima gore limitleri ayarla.
5. Turnstile widget hostname listesini yalnizca PBM production alan adlariyla
   sinirla.

Turnstile tokeni server tarafinda dogrulanmadan guvenlik saglamaz. Supabase Auth
CAPTCHA ayari aciksa Supabase bu dogrulamayi gerceklestirir.

## 6. Supabase Auth Ayarlari

Supabase > Authentication:

1. Minimum sifre uzunlugunu 12 yap.
2. Buyuk harf, kucuk harf, rakam ve sembol gereksinimini ac.
3. Email confirmation'i ac.
4. CAPTCHA/Turnstile korumasini ac.
5. Auth rate limitlerini dusuk ve makul seviyede tut.
6. Varsa leaked-password protection'i ac.
7. Supabase yonetici hesabinda MFA kullan.
8. Redirect URL listesinden localhost ve kullanilmayan alan adlarini kaldir.
9. Network Restrictions plan dahilindeyse yonetim erisimini sinirla.

## 7. GitHub Guvenligi

1. Repository'yi private yap.
2. Security ayarlarinda Dependency Graph ve Dependabot Alerts'i ac.
3. Dependabot Security Updates'i ac. Repoda `.github/dependabot.yml` hazirdir.
4. Secret scanning ve push protection'i plan destekliyorsa ac.
5. `main` branch icin branch protection ve pull request zorunlulugu ekle.
6. Eski commitlerde anahtar bulunuyorsa anahtari once iptal et; history temizligi
   ikincil islemdir.

## 8. Android ve Google Play

1. Google Play App Signing kullan.
2. Upload `.jks` dosyasini GitHub'a koyma; iki sifreli offline yedek tut.
3. Firebase/Google API anahtarlarini Android package `com.pbm.trading` ve
   release SHA-256 fingerprint ile sinirla.
4. Firebase App Check etkinlestirmeyi planla.
5. Release build'de cleartext HTTP ve Android backup kapali kalmalidir.

## 9. Haftalik Operasyon Rutini

Her hafta:

- Supabase `security_audit_log` kayitlarini incele.
- Cloudflare hata, WAF ve rate-limit loglarini incele.
- Dependabot uyarilarini incele.
- Sifreli veritabani yedegi al.
- Admin ve servis anahtari kullanimi icin beklenmeyen hareketleri kontrol et.

Her ay:

- Yedekten geri yukleme testi yap.
- Kullanilmayan hesap, token ve API key'leri iptal et.
- Admin yetkili hesaplari kontrol et.

## 10. Olay Mudahale Sirasi

Supheli erisim gorursen:

1. Etkilenen kullanici oturumlarini iptal et.
2. Ilgili API key/token/sifreyi hemen yenile.
3. Cloudflare ve Supabase loglarini sakla.
4. `security_audit_log` kayitlarini incele.
5. Acigi kapatmadan sistemi tekrar acma.
6. Etkilenen kullanicilara gerekli bildirimi yap.

## Bilinen Kalan Riskler

- SPA mimarisi nedeniyle Supabase kullanici oturumu tarayici depolamasinda
  tutulur. CSP ve XSS sertlestirmesi riski azaltir; ileride HttpOnly cookie/BFF
  mimarisine gecmek daha gucludur.
- Uygulama kullanicilari icin TOTP MFA ayri bir sonraki fazdir. Altyapi ve admin
  hesaplarinda MFA simdi acilmalidir.
- Eski Create React App arac zincirinde build/test bagimlilik uyarilari vardir.
  `npm audit fix --force` kullanma; kontrollu bir Vite gecisi planla.
