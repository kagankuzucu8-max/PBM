# PBM Android / Google Play

PBM Android uygulamasi Capacitor ile mevcut Cloudflare PBM uygulamasini kullanir. Tasarim, chart, AI analizi, Supabase hesabi ve kullanici datalari web ile aynidir.

## Sabit uygulama bilgileri

```text
App name: PBM
Android package ID: com.pbm.trading
Version code: 1
Version name: 1.0
```

Package ID Play Store'a ilk yuklemeden sonra degistirilemez.

## Bilgisayara kurulacaklar

1. Android Studio'nun guncel stabil surumu
2. Android Studio icindeki Android SDK 36
3. Android Studio ile gelen JDK 17 veya daha yeni JDK

Bu bilgisayarda su anda yalnizca Java 8 var. Bu nedenle Android Studio/JDK kurulmadan `.aab` derlemesi tamamlanmaz.

## Firebase push notification

1. Firebase Console'da bir proje ac.
2. Android app ekle ve package ID olarak `com.pbm.trading` yaz.
3. `google-services.json` dosyasini indirip buraya koy:

```text
frontend/android/app/google-services.json
```

4. Firebase Project Settings > Service accounts > Generate new private key.
5. Cloudflare Worker Variables/Secrets alanina ekle:

```text
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
```

`FIREBASE_SERVICE_ACCOUNT_JSON` degeri indirilen service-account JSON dosyasinin tamamidir. GitHub'a koyma.

6. Supabase SQL Editor'de calistir:

```text
supabase/mobile_push_notifications_20260606.sql
```

7. Cloudflare Worker'i tekrar deploy et.

Admin Social postu attiginda ayni olay web bildirim merkezine, email'e ve mobil push'a gider.

## Cloudflare URL'yi uygulamaya baglama

Varsayilan URL `frontend/capacitor.config.ts` icinde bulunur. Custom domain kullaniyorsan PowerShell'de:

```powershell
$env:PBM_MOBILE_URL="https://app.senindomainin.com"
cd frontend
npm run mobile:sync
```

Bu komut React build'ini hazirlar ve Android projesine senkronlar.

## Android Studio'da acma

```powershell
cd frontend
npm run mobile:open
```

Android Studio ilk acilista Gradle ve Android SDK bagimliliklarini tamamlar.

## Test paketi

Android Studio:

```text
Build > Build APK(s)
```

veya JDK/SDK kurulduktan sonra:

```powershell
cd frontend/android
.\gradlew.bat assembleDebug
```

## Google Play AAB

Android Studio:

```text
Build > Generate Signed App Bundle or APK > Android App Bundle
```

Yeni bir upload keystore olustur. Keystore ve parolasini kaybetme, GitHub'a yukleme.

Play Console'a `app-release.aab` dosyasini yukle. Ilk yayin icin Internal testing veya Closed testing kanalini kullan.

## Play Console gereksinimleri

- Uygulama ikonu ve ekran goruntuleri
- Privacy Policy URL
- Data Safety formu
- Financial features beyanlari
- Content rating
- Closed testing kullanici listesi

## Gelistirme komutlari

```powershell
cd frontend
npm run mobile:assets
npm run mobile:sync
npm run mobile:doctor
npm run mobile:open
```

Google Play surumu tamamlandiktan sonra ayni Capacitor yapisina iOS platformu eklenebilir. iOS build ve App Store yayini icin macOS ve Xcode gerekir.
