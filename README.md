# Ennvo

Ennvo is a fast social app for **reels, stories, chat and HD video calls**, built
as one codebase for the **web** and for **Android** (Capacitor + a native shell).

The engineering goal is simple: open instantly, scroll smoothly and deliver a
message in real time, even on a low-end phone with a weak connection.

---

## Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Motion |
| State | Zustand (sliced selectors, no whole-app re-renders) |
| Data | Firebase Auth, Firestore (persistent cache), Realtime Database (presence/typing) |
| Media | Cloudflare R2 (presigned uploads), Firebase Storage fallback |
| Push | Data-only FCM through the Vercel gateway (`api/push.js`) |
| Calls | WebRTC + a separate lightweight call bundle (`call/`) |
| Android | Capacitor 8, native FCM service, notification replies, call activity |
| Web server | Express (`server.ts`) for local dev, media and AI helpers |

---

## Project layout

```
src/
  App.tsx                 app shell, routing, overlays
  store.ts                Zustand store (pages, caches, UI state)
  firebase.ts             Firebase init (lazy RTDB + Storage)
  pages/                  one file per screen (lazy loaded)
  components/             reusable UI (chat, reels, settings, modals)
  services/               all data access (chat, posts, push, calls, auth)
  native/                 bridge to the Android shell
  utils/                  formatting, persistence, helpers
call/                     standalone call screen (own tiny bundle)
admin-console/            admin panel, lazy loaded, never shipped to users
api/                      Vercel serverless functions (push, R2 presign)
functions/                optional Firebase Cloud Functions (admin only)
android/                  committed Capacitor Android project
public/                   static pages, icons, sounds, service worker
docs/                     deployment and data-model notes
```

---

## Scripts

```bash
npm install

npm run dev        # local dev server (Express + Vite middleware)
npm run typecheck  # TypeScript, no emit
npm run build      # web app + call bundle + server bundle
npm start          # run the built server
npm run clean      # remove dist/ and server-build/

npm run cap:build  # build web assets and copy them into android/
npm run cap:open   # open the Android project in Android Studio
```

---

## Environment

Copy `.env.example` to `.env` and fill in the values. The file is gitignored.

| Variable | Used by |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | R2 presigning |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 presigning |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 presigning |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 presigning |
| `CLOUDFLARE_R2_PUBLIC_DOMAIN` | public media URLs |
| `PORT` | local server |

On Vercel, `FIREBASE_SERVICE_ACCOUNT` (the service account JSON) is required by
`api/push.js`. See `docs/firebase-deploy.md`.

---

## Push notifications

There is exactly **one** push sender: `api/push.js` on Vercel.

1. The client calls it with the signed-in user's Firebase ID token
   (`src/services/pushGateway.ts`).
2. The gateway verifies the token, reads `users/{uid}.fcmTokens`, honours
   `notifMode` (on / off / secret) and the per-chat `mutedBy` flag, then sends a
   data-only FCM message.
3. `AppFcmService` renders it through `Notifier`, which also handles the
   in-app bridge notifications, so a message is shown once with the sender's
   photo, a working Reply action and the right tap target.

> Do not deploy `pushOnNewMessage` / `pushOnIncomingCall` Cloud Functions next to
> the gateway: both would send the same push. They were removed from
> `functions/src/index.ts` for that reason. If an older deployment still has
> them, delete them once:
> `npx firebase-tools functions:delete pushOnNewMessage pushOnIncomingCall --project ennvo-6c01c`

---

## Android

The `android/` folder is committed and is the real app (it is never
regenerated). The CI workflow `.github/workflows/build-android-apk.yml` builds
the web assets, runs `cap sync`, signs the APK and publishes it.

* `MainActivity` owns the WebView, insets, splash hand-off, back button and the
  JS bridge.
* `AppFcmService` + `Notifier` own notifications (messages, calls, activity).
* `CallActivity` + `CallService` own the call screen and the foreground service.
* `ReplyReceiver` handles reply / decline directly from a notification.

---

## Docs

* `docs/firebase-deploy.md` - push gateway, rules and optional functions
* `docs/data-model.md` - Firestore collections and fields
* `TODO.md` - the Android fix list and its state
* `ANDROID_GUIDE.md` - building and signing the APK
