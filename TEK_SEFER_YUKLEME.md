# GitHub Tek Sefer Yukleme

`PBM_GITHUB_ONE_DRAG_20260606` klasorunun icine gir, `Ctrl+A` yap ve secilen tum dosyalari GitHub repository ana klasorundeki **Add files > Upload files** ekranina tek seferde surukle.

Bu paket 100 dosyanin altindadir. `node_modules`, cache, gizli anahtarlar ve uretilen Android dosyalari dahil degildir.

Android projesi `mobile/android-template.zip` icinde saklanir. Google Play hazirligi icin repository bilgisayara indirildikten sonra ana klasorde calistir:

```powershell
powershell -ExecutionPolicy Bypass -File .\SETUP_ANDROID.ps1
```

Ardindan Firebase'den indirilen `google-services.json` dosyasini:

```text
frontend/android/app/google-services.json
```

yoluna koy ve Android Studio ile `frontend/android` klasorunu ac.
