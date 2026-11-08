# PROMPT 1: update the Ennvo React app for the native Android app

Copy everything below the line into your AI coding tool, together with the full source of the app.

---

You are a senior React, TypeScript and Firebase engineer. The Ennvo web app (React 19, Vite, Tailwind, Zustand, Firebase, Capacitor plugins app, status-bar and splash-screen) is wrapped into an Android app by a custom Capacitor 6 build. The Android shell exposes a JavaScript bridge. Your job is to change the web code so it uses the bridge correctly, behaves like a real native app, and is fast on cheap phones with 2 GB RAM. The web version in a normal browser must keep working, so every native call must be feature-detected and must never throw.

Work in small, reviewable steps. After each step list the files you changed and why. Do not rewrite unrelated screens. Do not add new heavy dependencies unless a step asks for it. Keep the TypeScript strict and the app building with `npm run build`.

## The native bridge contract (already implemented in the Android app)

Two global objects with identical methods: `window.AndroidInterface` and `window.Android`. Use `AndroidInterface`. All methods are synchronous and return quickly. Strings only, except where noted.

| Method | Meaning |
|---|---|
| `showNotification(title, body, icon, type)` | Show a message notification. Native ignores it while the app is on screen and removes duplicates. |
| `sendNotification(title, body)` | Same, fewer fields. |
| `showIncomingCall(name, avatarUrl, callType, callId)` | Full-screen incoming call notification. `callType` is `voice` or `video`. |
| `dismissIncomingCall()` | Remove it. |
| `startCall(name, isVideo: boolean)` | Call the moment a call is connected. Starts the ongoing-call foreground service (keeps the microphone alive when minimized), sets communication audio mode, uses the earpiece for voice and the speaker for video, and turns the screen off near the ear. |
| `endCall()` | Call when the call ends for any reason. |
| `setSpeaker(on: boolean)` | Toggle loudspeaker. |
| `setPip(enabled: boolean, width: number, height: number)` | Enable picture-in-picture with an aspect ratio. When enabled, pressing Home enters PiP automatically. |
| `setStatusBarColor(hex, isDark: boolean)` | Colors the status bar and the navigation bar. `isDark` true means the page background is dark, so icons become light. |
| `downloadMedia(url, filename, mime)` | Save an https file to the Downloads folder. |
| `getFcmToken(): string` | Current push token or empty string. |
| `getPendingReplies(): string` | JSON array of replies typed in a notification while the app was closed, `[{c: conversationId, t: text, n: name}]`. Clears the queue. |
| `getPendingShare(): string` | JSON of content shared from another app, `{text?: string, files?: [{url, mime, name}]}`, or empty string. `url` is a same-origin path like `/_capacitor_file_/data/...`; `fetch(url)` it to get a Blob. |
| `getAppInfo(): string` | JSON `{versionName, versionCode, sdk, model}`. |
| `openUrl(url)` / `openStore()` | Open an https link / the Play Store page of this app. |
| `reportError(message, stack)` / `setUserId(uid)` | Send an error to Firebase Crashlytics / tag crashes with the user. |
| `exitApp()` | Close the app. |

Callbacks the native side calls on `window` (define them yourself):

- `onFcmToken(token)` called when a new push token is issued.
- `__flushReplies()` and the array `__replyQ`: native pushes `{c, t, n}` objects into `window.__replyQ` and then calls `window.__flushReplies()`.
- `onNativeHangup()` user pressed Hang up in the ongoing-call notification.
- `onPipChanged(isInPip: boolean)`.
- `onShareReceived()` call `getPendingShare()` inside it.

Capacitor plugins available: `@capacitor/app` (events `appUrlOpen`, `backButton`, `appStateChange`), `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capgo/capacitor-updater` (install it, version 6).

## Tasks

### 1. Typed wrapper
Create `src/native/bridge.ts` that exposes every method above as a typed function. Each function checks that the bridge and the method exist and wraps the call in try/catch. Export `isNative` and a `parseJson` helper. Use it everywhere instead of touching `window.AndroidInterface` directly.

### 2. Fix the status bar logic bug
In `src/App.tsx` the status bar effect compares `currentPage === 'reels'`, but the reels (black) page is `currentPage === 'home'` and the feed (white) page is `'reels'`. Fix so reels and full-screen media are black with light icons, and the feed and every other page are white with dark icons. Call the bridge through the wrapper on every page change and when the dark theme changes. Keep Capacitor StatusBar calls consistent with it.

### 3. Notifications, one source of truth
There are two `onSnapshot` listeners on `conversations` (around `App.tsx` lines 98 and 669) that both show device notifications. Merge them into one `src/services/notificationCenter.ts` that listens once, decides what is new, and calls `showNotification` once per message. Pass the sender name as the title (no emoji suffix), the message text (or "Photo", "Video", "Voice message") as body, and the sender avatar https URL as the icon. Skip messages sent by the current user, messages in a muted or currently open conversation, and anything older than the app start time. Unsubscribe on logout.

### 4. Push token and silent replies
After login, read `getFcmToken()` and also set `window.onFcmToken`. Save each token with `updateDoc(users/{uid}, {fcmTokens: arrayUnion(token)})`. On logout remove this device token with `arrayRemove`. Implement `window.__flushReplies` so it drains `getPendingReplies()` and `window.__replyQ`, and for each `{c, t}` calls the existing `sendMessage(c, currentUser.uid, 'text', t)`. Run it once after login.

### 5. Calls: native integration
In the call screens and `callService.ts`: call `startCall(name, isVideo)` when the call becomes connected, `endCall()` in every exit path (hang up, remote hang up, failure, timeout, component unmount), `setSpeaker` from the speaker button, `setPip(true, 9, 16)` while a call or a full-screen video is on screen and `setPip(false, 0, 0)` after. Implement `window.onNativeHangup` to end the call. Implement `window.onPipChanged` to hide buttons and overlays in PiP and show only the remote video. For an incoming call that arrives while the app is open use the existing in-app overlay and ringtone; only call `showIncomingCall` when `document.visibilityState` is hidden. Call `dismissIncomingCall()` on answer, reject, cancel and timeout.

### 6. Calls: speed and reliability (WebRTC)
Audit the current WebRTC code and fix these, explaining each change:
- Signaling latency: move offer, answer and ICE candidates from Firestore to the Realtime Database (rules file already exists in the repo) or keep Firestore but write candidates in batches; remove any polling.
- Use trickle ICE and `iceCandidatePoolSize: 4`. Create the `RTCPeerConnection` and call `getUserMedia` as soon as the call UI opens (pre-warm), not after the answer.
- ICE servers: a configurable list read from `appConfig/android.rtc` in Firestore with a TURN server over UDP, TCP and TLS 443, so calls work on mobile networks and behind strict NAT. Do not hard-code credentials in the bundle.
- Audio constraints: `echoCancellation`, `noiseSuppression`, `autoGainControl` true, mono, 48 kHz. Opus with `useinbandfec=1`, `usedtx=1`, and a 24 to 32 kbps cap for voice.
- Video constraints for low-end phones: 640x480 at 24 fps by default, front camera, `degradationPreference: 'maintain-framerate'`, a `maxBitrate` of about 600 kbps, and automatic quality step-down using `getStats()` (packet loss, RTT) and step-up when stable.
- Reconnect: on `iceconnectionstatechange` to `disconnected` or `failed` or on `online` events, do an ICE restart (new offer with `iceRestart: true`) up to 3 times before ending the call, and show a small "Reconnecting" state.
- Cleanup: stop every track, close the peer connection and remove every listener when the call ends. No leaks across calls.
- Never block the UI thread: no synchronous loops, no heavy renders while a call is active; wrap the call screen in `React.memo` and keep timers in refs.

### 7. Picture-in-picture for video
For the reels viewer and any full-screen video, call `setPip(true, videoWidth, videoHeight)` when playback starts and `setPip(false, 0, 0)` when it stops or the user leaves the screen. In PiP, pause nothing; hide controls via `onPipChanged`.

### 8. Deep links
Links of the form `https://ennvoapp.com/account/<username>` (also `/post/<id>`, `/reel/<id>`, `/chat/<id>`) must open the right screen. Add a small router layer on top of the current `currentPage` store without rewriting the app: a `parseDeepLink(url)` function and one function `openFromLink(url)`. Register `App.addListener('appUrlOpen', e => openFromLink(e.url))` and handle `App.getLaunchUrl()` at startup. In the browser, handle `window.location.pathname` on load and keep the address bar in sync with `history.pushState` for profile pages, so the same URLs work on the website. Add a "Share profile" action that shares `https://ennvoapp.com/account/<username>` with the system share sheet (`navigator.share` with a clipboard fallback). Unknown or deleted users show a friendly not-found screen.

### 9. Share to Ennvo
Implement `window.onShareReceived` and also call it once at startup. It reads `getPendingShare()`, parses it, waits until the user is logged in, then opens a "Share to" sheet: choose chats or "New post". For each file `fetch(file.url)` to a Blob, wrap in a `File`, and feed it into the existing upload and compression code. Text and links go into the message input or the post caption. Handle up to 10 files and show clear errors.

### 10. Update system and maintenance mode
Read the Firestore document `appConfig/android` (live `onSnapshot`) with this shape. The admin panel writes it.

```
{
  latestVersionCode: number, latestVersionName: string,
  minVersionCode: number,            // below this the app is blocked until updated
  forceUpdate: boolean,
  apkUrl: string, storeUrl: string,  // https links
  releaseNotes: { en: string, bn: string },
  maintenance: { enabled: boolean, message: string },
  ota: { enabled: boolean, version: string, bundleUrl: string, minNativeVersionCode: number, rolloutPercent: number },
  rtc: { iceServers: RTCIceServer[] }
}
```
Behavior:
- Compare `getAppInfo().versionCode` with the config. If `versionCode < minVersionCode` or `forceUpdate` is true and a newer version exists, show a blocking full-screen "Update required" screen. If only a newer version exists, show a dismissible dialog once per version with the release notes. The button calls `openStore()` when `storeUrl` is set, otherwise `openUrl(apkUrl)`.
- If `maintenance.enabled`, show a full-screen maintenance screen with the message and block the app (except for users with `isAdmin` true).
- Over-the-air web updates with `@capgo/capacitor-updater`: on app start and on resume, if `ota.enabled`, the user falls inside `rolloutPercent` (use a stable hash of the uid), `ota.version` differs from the current bundle, and `getAppInfo().versionCode >= ota.minNativeVersionCode`, then `CapacitorUpdater.download({url: ota.bundleUrl, version: ota.version})` in the background and `CapacitorUpdater.set(bundle)` on the next cold start or when the app is idle. Call `CapacitorUpdater.notifyAppReady()` after the first successful render so a broken bundle rolls back automatically. Never download on mobile data above 30 MB without Wi-Fi. Wrap everything in try/catch.

### 11. Banned and disabled accounts
After login, listen to `users/{uid}`. If `status` is `banned` or `suspended` (set by the admin panel), sign the user out, clear local caches, and show a screen with the reason and a support contact. Also respect `bannedUntil` timestamps. Do the same check on cold start before showing any content.

### 12. Crash and error reporting
Add a global handler for `window.onerror` and `unhandledrejection`, and a React error boundary around the app and around each big screen (Messages, Reels, Call). Each handler calls `reportError(message, stack)` and shows a friendly fallback with a "Reload" button instead of a white screen. Call `setUserId(uid)` after login and `setUserId('')` after logout. De-duplicate identical errors within 10 seconds.

### 13. Performance on low-end phones
Measure first (Lighthouse and the Chrome performance panel with 6x CPU throttling), then fix in this order and report before and after numbers:
1. **Blur effects**: the code has about 199 uses of `backdrop-blur`. Replace them with solid or semi-transparent backgrounds except for at most 3 small, important places. Remove `backdrop-filter` in CSS and inline styles.
2. **Firestore cache**: `src/firebase.ts` uses `memoryLocalCache`. Switch to `persistentLocalCache({ tabManager: persistentSingleTabManager() })` so chats, feed and profiles appear instantly from disk on the next start, with a fallback to memory cache if IndexedDB fails.
3. **Listeners**: there are about 60 `onSnapshot` calls. Remove duplicates, scope each listener to the screen that needs it, add `limit()` and pagination (`startAfter`) to feeds, reels and message lists, and unsubscribe on unmount. Do not subscribe to full collections.
4. **Code splitting**: `Messages.tsx` has about 7300 lines and `ReelItem.tsx` about 3900. Split them into smaller components, load each page with `React.lazy` and `Suspense`, add `manualChunks` in `vite.config.ts` (react, firebase, motion, icons), and use dynamic `import()` for rarely used features (image compression, AI chat, settings).
5. **Bundle hygiene**: make sure `@aws-sdk/*`, `express`, `multer`, `dotenv` and `@google/genai` are not imported by any client file. Move server-only packages to `devDependencies` or to a separate `server/package.json`. Check the result with `rollup-plugin-visualizer` and keep the main entry chunk under 250 KB gzipped.
6. **Lists and rendering**: virtualize long lists (messages, feed, comments, search results) with a small windowing helper or `react-window`; use `React.memo`, `useCallback` and Zustand selectors so a new message does not re-render the whole chat list; add `content-visibility: auto` on off-screen cards; animate only `transform` and `opacity`; reduce shadows and large gradients; respect `prefers-reduced-motion`.
7. **Reels video**: only the current reel plays; preload only the next one with `preload="metadata"`; set `playsInline`, `poster` and a low-bitrate source when `navigator.connection.saveData` or a 2g/3g type is detected; pause and remove the `src` of videos that are far from the viewport.
8. **Assets**: convert `chat-background.png`, `Ennvo.png` and `earth-globe.jpg` to WebP at sensible sizes; convert `Ringtone.wav`, `Calling.wav` and `notifecetion.wav` to mono 22.05 kHz Opus or MP3 (under 150 KB each) and update every reference. Lazy load images with `loading="lazy"` and `decoding="async"`. Keep `browser-image-compression` in a Web Worker.
9. **Startup**: render a minimal shell immediately, then load data. Call `SplashScreen.hide()` right after the first paint of the shell, not after all data.
Target: first usable screen under 2 seconds on a 2 GB Android phone, scrolling at a steady 60 fps, and no frame drops when opening a chat with 500 messages.

### 14. Camera, voice and media robustness
- Wrap `getUserMedia` in one helper that handles permission denied, no device, device busy and `NotReadableError`, and shows a message with a button that explains how to enable the permission in Android settings.
- Voice messages: use `MediaRecorder` with `audio/webm;codecs=opus` and fall back to `audio/mp4` when unsupported; show live recording time; cancel on swipe; upload with progress.
- Photos and videos: let `<input type="file" accept="image/*,video/*">` open the system chooser; offer a separate button with `capture` for the camera; compress images before upload (max 1600 px, quality 0.8) in a worker; videos over a size limit show a clear error.
- `downloadMedia` for saving; fall back to an anchor download in the browser.

### 15. Security and hygiene
- `.env.example` contains real-looking secrets. Replace them with placeholders, tell me which keys must be rotated, and make sure no secret is ever imported by client code or ends up in the bundle.
- `/api/jarvis` is a relative URL and fails inside the app. Use an absolute base URL from a single constant, the same way the upload endpoints do.
- Check Firestore rules for the new fields (`fcmTokens` writable only by the owner, `status`, `bannedUntil` and `isAdmin` writable only by admins through the server).

## Deliverables
1. All code changes, grouped by the numbered tasks above.
2. A short list of new or changed Firestore fields and collections.
3. A manual test checklist for a real Android phone: notification while the app is open, minimized and swiped away; reply from the notification; call, minimize during the call, mic still works; PiP; deep link; share from the gallery; force update screen; maintenance screen; banned user; crash report.
4. A before and after table for the performance numbers.

Ask me before deleting any feature. If something in these instructions conflicts with the existing code, explain the conflict and pick the safest option.
