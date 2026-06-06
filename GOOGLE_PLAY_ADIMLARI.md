# PBM Google Play Adimlari

Bu proje Android uygulamasini `frontend/android` klasorunde tasir. Uygulama mevcut Cloudflare PBM adresini acar; web ve mobil ayni Supabase kullanicilarini ve datalarini kullanir.

## 1. Supabase admin ve mobil bildirim SQL

Supabase Dashboard > SQL Editor alaninda sirayla calistir:

```text
supabase/admin_transfer_kagankuzucu8.sql
supabase/mobile_push_notifications_20260606.sql
```

Yalnizca `kagankuzucu8@gmail.com` Social postu ve Education videosu ekleyebilir.

## 2. Firebase Android uygulamasi

1. Firebase Console'da bir proje olustur.
2. Android uygulamasi ekle.
3. Android package name alanina `com.pbm.trading` yaz.
4. Firebase'in verdigi `google-services.json` dosyasini indir.
5. Dosyayi `frontend/android/app/google-services.json` yoluna koy.
6. Firebase Project Settings > Service accounts > Generate new private key ile service account JSON indir.
7. Cloudflare Worker secrets alanina ekle:

```text
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
```

`FIREBASE_SERVICE_ACCOUNT_JSON`, indirilen service account JSON dosyasinin tam icerigidir. Bu iki gizli degeri GitHub'a koyma.

## 3. Android Studio kurulumu

1. Guncel Android Studio stable surumunu kur.
2. Android Studio > SDK Manager icinden Android SDK 36 kur.
3. Android Studio'nun kendi JDK 17 veya daha yeni JDK'sini kullan.
4. Projeyi Android Studio ile ac:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run mobile:sync
npm run mobile:open
```

## 4. Telefonda test

1. Android telefonda Developer options ve USB debugging ac.
2. Telefonu bilgisayara bagla.
3. Android Studio ust cubugundan telefonu sec.
4. Run tusuna bas.
5. Giris, Social, chart, AI analysis ve mobil bildirim iznini test et.

## 5. Signed AAB olusturma

Android Studio:

```text
Build > Generate Signed App Bundle or APK
Android App Bundle
Create new...
Key store path: C:\Users\Excalibur\Documents\PBM_RELEASE_KEY\pbm-upload-key.jks
Alias: pbm-upload
Validity: en az 25 yil
Build variant: release
Finish
```

Keystore dosyasini ve sifresini en az iki guvenli yerde sakla. GitHub'a, Cloudflare'a veya Supabase'e yukleme.

Olusan dosya genellikle:

```text
frontend/android/app/release/app-release.aab
```

## 6. Google Play Console

1. Google Play Console gelistirici hesabi ac.
2. Create app ile `PBM` uygulamasini olustur.
3. Package ID otomatik olarak `com.pbm.trading` olmalidir.
4. Store listing, privacy policy, data safety, content rating ve financial features formlarini doldur.
5. Internal testing veya Closed testing kanalini ac.
6. `app-release.aab` dosyasini yukle.
7. App access alaninda Google inceleme ekibi icin normal bir beta kullanicisi girisi ver. Admin hesabini verme.
8. Test kullanicilarini ekle ve review'e gonder.

Yeni bir kisisel Google Play gelistirici hesabi 13 Kasim 2023 sonrasinda acildiysa, Production erisimi icin Closed testing kanalinda en az 12 test kullanicisinin 14 gun boyunca kesintisiz opt-in kalmasi gerekir. Closed beta yayinini hemen baslatabilirsin; Production daha sonra acilir.

Google Play formlarinda kullanilacak URL'ler:

```text
Privacy policy:
https://pbmdesk.pbmsolutions.workers.dev/privacy.html

Account deletion:
https://pbmdesk.pbmsolutions.workers.dev/account-deletion.html
```

Bu iki URL'nin gercek politika sayfalarini gosterdigini kontrol etmeden review'e gonderme.

## GitHub ve mobil guncelleme mantigi

- GitHub'a bu projenin tamamini yuklediginde `frontend/android` da gider.
- ZIP dosyasini GitHub web ekranina tek dosya olarak yuklemek projeyi acmaz. GitHub Desktop ile klasoru repository olarak yukle.
- Cloudflare web tarafinda yaptigin arayuz/data guncellemeleri Android uygulamasinda otomatik gorunur.
- Capacitor plugin, package ID, ikon, Firebase veya native Android kodu degisirse yeni AAB olusturup Google Play'e yeni surum yuklemelisin.
- Uygulama su anda `frontend/capacitor.config.ts` icindeki Cloudflare URL'sini acar. Kalici custom domain kullanmak daha sagliklidir.
