$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root "frontend"
$android = Join-Path $frontend "android"
$androidTemplate = Join-Path $root "mobile\android-template.zip"

if (!(Test-Path (Join-Path $frontend "package.json"))) {
  throw "frontend/package.json bulunamadi."
}

Push-Location $frontend
try {
  npm.cmd install --legacy-peer-deps --no-audit --no-fund

  if (!(Test-Path $android) -and (Test-Path $androidTemplate)) {
    New-Item -ItemType Directory -Path $android -Force | Out-Null
    Expand-Archive -LiteralPath $androidTemplate -DestinationPath $android -Force
  } elseif (!(Test-Path $android)) {
    npx.cmd cap add android
  }

  npm.cmd run mobile:assets
  npm.cmd run mobile:sync

  $drawable = Join-Path $android "app\src\main\res\drawable"
  New-Item -ItemType Directory -Path $drawable -Force | Out-Null
  @'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,2l1.55,5.45L19,9l-5.45,1.55L12,16l-1.55,-5.45L5,9l5.45,-1.55L12,2zM19,14l0.85,3.15L23,18l-3.15,0.85L19,22l-0.85,-3.15L15,18l3.15,-0.85L19,14zM5,14l0.7,2.3L8,17l-2.3,0.7L5,20l-0.7,-2.3L2,17l2.3,-0.7L5,14z" />
</vector>
'@ | Set-Content -LiteralPath (Join-Path $drawable "ic_stat_pbm.xml") -Encoding UTF8

  $manifestPath = Join-Path $android "app\src\main\AndroidManifest.xml"
  $manifest = Get-Content -LiteralPath $manifestPath -Raw
  if ($manifest -notmatch 'android:allowBackup=') {
    $manifest = $manifest.Replace("<application", "<application`r`n        android:allowBackup=`"false`"")
  }
  if ($manifest -notmatch 'android:usesCleartextTraffic=') {
    $manifest = $manifest.Replace("<application", "<application`r`n        android:usesCleartextTraffic=`"false`"")
  }
  Set-Content -LiteralPath $manifestPath -Value $manifest -Encoding UTF8

  Write-Host ""
  Write-Host "PBM Android hazirlandi." -ForegroundColor Green
  Write-Host "Firebase google-services.json dosyasini frontend/android/app/ klasorune koy."
  Write-Host "Ardindan Android Studio ile frontend/android klasorunu ac."
} finally {
  Pop-Location
}
