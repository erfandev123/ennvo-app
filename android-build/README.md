# Android build workflow (Ennvo)

`custom-builder.yml` is the updated GitHub Actions workflow for the
[APK-Bulder](https://github.com/erfandev123/APK-Bulder) repository.

## How to use it

1. Open the APK-Bulder repo → `.github/workflows/`.
2. Replace the existing builder yml with this file (keep the same file name you
   already dispatch, e.g. `custom-builder.yml`).
3. Commit. The next `repository_dispatch` build uses the new native code.

## What changed on the native side

| Fix | Why |
| --- | --- |
| `<queries>` block in `AndroidManifest.xml` | Android 11+ hides other apps unless they are declared. Without it `resolveActivity()` returned `null`, so `tel:`, `mailto:`, `sms:`, `whatsapp:` and `https:` taps did nothing. |
| `openUrl()` accepts every scheme + `intent://` | It used to accept only `https://` and `market://`, so phone/email/WhatsApp links were dropped silently. |
| `openExternal()` helper with dialer / SENDTO fallbacks | Works even when no dialer or mail app is installed. |
| `shareText()` JS bridge | The Web Share API does not exist inside a WebView, so "Share via apps" did nothing. |
| `onCreateWindow` in the WebChromeClient | `target="_blank"` / `window.open` now opens in the system instead of a dead tap. |
| `ennvo://` + `ennvoapp://` intent filters | Links open in the app even when App Links verification is not set up. |
| VIEW intents routed to `window.__ennvoOpenLink` | Notification / browser links open the matching screen inside the app instead of Chrome. |
| `setSupportMultipleWindows`, `setTextZoom(100)`, hardware layer | Faster, predictable rendering on every phone. |
| Splash hold 1500 ms → 900 ms | Faster cold start. |
| `assetlinks.json` generated in the artifact | Upload it to `https://<deep_link_host>/.well-known/assetlinks.json` so `https://` links open the app directly. |
| `project.zip` always wins over URL mode | The APK is a real app with the code bundled inside. It opens instantly and works offline; URL mode is only used when there is no `project.zip`. |

## Real app (bundled, works offline)

Keep `project.zip` (your Ennvo project, the folder with `package.json`,
`index.html` and `src/`) in the repository root. The workflow now builds the
web assets with `npm run build` and packages `dist/` **inside** the APK, so the
app does not load any website and works with no internet.

> Do not use `source: url` — a WebView that only loads a website cannot work
offline and hangs on a blank/loading screen when the network is slow.

## Recommended build options

* `deep_link_host`: your real host (e.g. `ennvo.vercel.app`). Required for
  verified `https://` App Links. `ennvo://` links always work.
* `perf_mode`, `native_feel`: keep both on.
* Use a permanent `KEYSTORE_BASE64` secret. The certificate SHA-256 must stay
  stable, otherwise the generated `assetlinks.json` stops matching.
