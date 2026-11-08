# Setup guide: permanent key, deep links, auto-updates, Play Store

## 1. Permanent signing key (do this first)
Without it every build gets a new key, so users must uninstall before updating, and deep links and the Play Store cannot work.

1. Put `create-keystore.yml` in `.github/workflows/` of your repo.
2. GitHub, Actions tab, **Create keystore (run once)**, Run workflow.
3. Open the finished run, download the artifact `keystore-keep-private`, unzip it.
4. Repo, Settings, Secrets and variables, Actions, New repository secret. Create four secrets:
   - `KEYSTORE_BASE64`: the whole text inside `KEYSTORE_BASE64.txt`
   - `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`: the values in `secret-values.txt`
5. **Back up `release.jks` and `secret-values.txt` somewhere private** (password manager, offline drive). If you lose them you can never update the app for existing users (Play App Signing reduces this risk).
6. Delete the artifact and the workflow run afterwards.

From now on `custom-builder.yml` signs with this key. The build log prints the certificate **SHA-256** line; you need it below.

## 2. Deep links: `https://ennvoapp.com/account/username` opens the app
1. In the builder page, fill **Deep link domain** with `ennvoapp.com` (no https, no slash).
2. On your website host, serve this file at `https://ennvoapp.com/.well-known/assetlinks.json` (content type `application/json`, no redirect):
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.ennvo.app",
    "sha256_cert_fingerprints": ["PASTE:THE:SHA-256:FROM:THE:BUILD:LOG"]
  }
}]
```
3. If you publish on Play with Play App Signing, add the SHA-256 of the **app signing key** (Play Console, Setup, App integrity) as a second item in the list.
4. The website must also answer `/account/username` (a single-page app rewrite to `index.html`).
5. Test: `adb shell pm get-app-links com.ennvo.app`, or just tap a link in Messages or Notes. Android verifies on install; reinstall after changing `assetlinks.json`.

The React app side (opening the right screen) is task 8 in `PROMPT-1-react-app.md`.

## 3. Updates without reinstalling
There are two kinds of update.

**A. Web/code updates (most changes): instant, no reinstall.** The builder always produces `web-bundle.zip` in the `extras-*` artifact. Upload it to Firebase Storage (public URL), then in the admin panel set `appConfig/android.ota` (version, bundleUrl, rollout %). Phones download it in the background and switch on the next start; a broken bundle rolls back by itself. Needs the `@capgo/capacitor-updater` package in the React app (task 10 of PROMPT-1). The builder installs the native part automatically when the package is in `package.json`.

**B. Native updates** (new permissions, new Java code, new Android features): a new APK or Play Store release is required. The app shows an "Update available" screen (also from `appConfig/android`). Before the Play Store: the button opens your APK link, the user taps install; Android always asks for confirmation, no app can silently install an update. On the Play Store: Play updates automatically when the user has auto-update on, and your forced-update screen covers the rest.

Rule: web bundle `ota.minNativeVersionCode` must be set to the first APK that has every native method the new web code calls.

## 4. Crash reports
Add `google-services.json` in the builder (see `ennvo-push-setup.md`). Crashlytics, analytics and push then switch on automatically. Native crashes appear in the Firebase console; web errors are sent by the React error handlers (PROMPT-1 task 12).

## 5. Play Store: honest checklist
- The current build uses Capacitor 6, which targets Android 14 (API 34). Google keeps raising the minimum target level for new apps and updates. Check the minimum in Play Console. If it is higher, tell me and I will move the builder to Capacitor 8, Java 21 and the new edge-to-edge rules; that is a separate, risky change, so keep your current builds for testing until then.
- Tick **Also build Play Store bundle (.aab)** in the builder. Download `app.aab` from the `extras-*` artifact.
- Play needs: a developer account, privacy policy URL, data safety form (camera, microphone, photos, location if enabled, account data), content rating, app icon 512 px, feature graphic, screenshots, and a moderation and report feature for social apps (you have reports in the admin panel plan).
- Use closed testing first (Play requires testers for new personal accounts).

## 6. What each builder option does now
| Option | Effect |
|---|---|
| Low-end speed mode | Removes blur effects from the source before the build |
| Deep link domain | Adds the verified link filter to the app |
| Permissions | Camera, microphone and calls (adds the call service), notifications, photos and video, location, vibration |
| google-services.json | Push when closed, Crashlytics |
| Keep-alive minutes | Optional background service with a notification, not needed for calls or push |
