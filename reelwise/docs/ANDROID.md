# Android app

`mobile/` is a Capacitor 7 Android app (package `com.reelwise.app`, name **Reelwise**) that opens your Reelwise server inside a native shell.

- **Identity:** it has its own app icon and splash screen.
- **Connection:** on first launch it asks for your server address, checks `/api/health`, then opens the full mobile-optimised app. Use HTTPS.

## Getting the APK

The APK and AAB are built on GitHub Actions (`.github/workflows/android.yml`). The build runs on every push that changes `reelwise/mobile/**`, or manually from **Actions → Android build → Run workflow**.

Each successful run creates a **GitHub Release** containing:
- `reelwise.apk`: install it directly on a phone;
- `reelwise.aab`: upload it to Google Play.

## Installing on your phone

1. Open the release's `reelwise.apk` link on the phone and download it.
2. Allow your browser to **install unknown apps** when Android asks.
3. Open **Reelwise** and enter your server address (for example `https://app.yourdomain.com`).

## Release signing (so updates install over the previous version)

Without signing secrets, the workflow signs each build with a **temporary key**. That APK installs fine, but the next build won't install over it; you'd have to uninstall first. To use a permanent key:

```bash
keytool -genkeypair -v -keystore reelwise-release.jks -alias reelwise -keyalg RSA -keysize 2048 -validity 10000
```

```bash
base64 -w0 reelwise-release.jks > keystore.b64
```

Then add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `reelwise` |
| `ANDROID_KEY_PASSWORD` | key password |

Keep the `.jks` file and passwords safe. Google Play requires the same key, or Play App Signing, for every update.

## Updating the app

- **Web changes** (screens and features) reach the app immediately once you deploy the server. The app loads the live site, so there's no new APK needed.
- **Native changes** (icon, name, Capacitor plugins): edit `mobile/` and push. A new release with a higher version code is built automatically. Install it over the old one, which works when the same signing key is used.

## Building locally (optional)

Requirements: Android Studio (SDK 35) and JDK 21. Then:
```bash
cd mobile && npm ci && npx cap sync android && cd android && ./gradlew assembleRelease
```
