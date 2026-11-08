# Prompts for the React app and the Express server

Paste each prompt into your AI coding tool together with your project files.
The Android side (custom-builder.yml) already provides everything listed under "Native bridge".

## Native bridge (already built into the APK)

Web calls `window.Android.*` (same as `window.AndroidInterface.*`):

| Method | Use |
|---|---|
| `setNotifMode("on"\|"off"\|"secret")` / `getNotifMode()` | Message notification mode. Calls are never affected. |
| `setNativeConfig(jsonString)` | `{"token":"<device token>","replyUrl":"https://.../api/native/reply","declineUrl":"https://.../api/native/call-decline"}` so Reply and Decline work when the app is closed. |
| `clearNativeConfig()` | Call on logout. |
| `getFcmToken()` and `window.onFcmToken(token)` | Device push token. |
| `getPendingOpen()` | JSON `{"convId":"..."}` or `""`. Also fired by `window.onNotificationOpen()`. |
| `getPendingCallAction()` | JSON `{"action":"accept"\|"decline","callId","name","type":"voice"\|"video","avatar"}` or `""`. Also fired by `window.onNativeCallAction()`. |
| `getPendingReplies()` and `window.__flushReplies()` | Replies typed in a notification that the server could not receive. `window.__replyQ = [{c: convId, t: text, n: title}]`. |
| `showMessageNotification(title, body, avatar, convId)` | Local message notification (only shown when the app is not visible). |
| `setStatusBarColor(hex, isDark)` | Status and navigation bar color. |
| `startCall(name, isVideo)`, `endCall()`, `setSpeaker(bool)`, `dismissIncomingCall()` | Call audio and foreground service. |
| `requestBatteryExemption()`, `openNotificationSettings()` | Help notifications arrive on strict phones (Xiaomi, Oppo, Vivo, Samsung). |

---

## Prompt 1: React app, notifications, chat open, calls

```
This React app runs inside an Android WebView that exposes window.Android (see the bridge list below).
Add the following. Feature-detect everything with `const A = (window as any).Android; if (!A) return;`
so the web version keeps working.

1. Create src/native.ts that wraps every bridge method with safe try/catch and typed helpers.

2. Notification mode setting (Settings page): a 3-way option "On / Off / Secret".
   - On: normal notifications.
   - Off: no message notifications.
   - Secret: the phone shows only the app name and "New notification" (no sender name, no text, no profile picture).
   Save the choice in the user's profile on the server AND call A.setNotifMode(mode) on app start, on login and whenever it changes.
   Calls must keep ringing in every mode.

3. After login (and whenever the FCM token changes via window.onFcmToken): send A.getFcmToken() to the server.
   Then call A.setNativeConfig(JSON.stringify({ token, replyUrl, declineUrl })) where token is the long-lived device token
   returned by the server's register-device endpoint (see the server prompt). On logout call A.clearNativeConfig().

4. Open the right chat from a notification:
   - Define window.onNotificationOpen = () => { const p = A.getPendingOpen(); if (p) navigate to the chat with id JSON.parse(p).convId; }
   - Also run the same function once when the app finishes loading and the user is logged in (cold start).

5. Replies typed in a notification (when the app process is alive):
   - Define window.__flushReplies = () => { drain window.__replyQ, and for each {c,t} call the existing "send message" function for conversation c with text t }.
   - On startup also read A.getPendingReplies() (JSON array of {c,t,n}) and send each once.

6. Calls:
   - Define window.onNativeCallAction = () => { const raw = A.getPendingCallAction(); if (!raw) return; const a = JSON.parse(raw); ... }.
     Run it on startup too (after login). If action === "accept": open the full-screen call page for a.callId immediately and
     connect the call (answer the WebRTC offer for that callId). If the call has already ended, show a short "Call ended" message and go back.
     If action === "decline": reject the call with the existing reject logic and make sure no call UI is shown.
   - Full-screen call page, WhatsApp style: dark background, large profile picture, name, status text (Ringing / Connecting / 00:12),
     buttons: mute, speaker, camera (video calls), end call (red). Incoming call inside the app: same screen with green Accept and red Decline.
   - When a call is connected call A.startCall(name, isVideo). When it ends (either side, or error) call A.endCall().
     When the call is answered or declined anywhere call A.dismissIncomingCall().
   - window.onNativeHangup = () => end the current call (the "Hang up" button in the ongoing-call notification).

7. Call A.requestBatteryExemption() once, after the first login, behind a small explanation dialog ("Allow background messages and calls").

Do not change anything else. Show me every changed file.
```

## Prompt 2: Reels and camera problems

```
Fix these problems in the Android WebView build of this React app. Show every changed file.

A. Status bar color on the Reels upload page and all other pages:
   The bar is white on the Reels upload page. On that page the header and status bar must be black (#000000, isDark = true).
   On every route change call (window as any).Android?.setStatusBarColor(hex, isDark) with the color that matches that page.
   Restore the previous color when leaving the page. Use useEffect with a cleanup on the upload page and the create page.

B. Reels create page, the camera preview is blank although the camera turns on:
   - The <video> must have: autoPlay, playsInline, muted (preview only), and srcObject set from getUserMedia.
   - After setting srcObject call video.play() inside a try/catch and again on onloadedmetadata.
   - Make sure the video has real size (width/height 100%, object-fit: cover, no display:none, no opacity:0, and a parent with a height).
   - Do not use a transparent page background behind the video.

C. Camera and microphone stay on after leaving the create page:
   - Keep the MediaStream in a ref. Write one function stopCamera() that calls stream.getTracks().forEach(t => t.stop()),
     sets video.srcObject = null and clears the ref.
   - Call it in the useEffect cleanup, when the user taps back, when the route changes, when the recording is finished,
     on document visibilitychange (hidden) and on window pagehide.
   - Also stop any previous stream before calling getUserMedia again (camera flip, retry).
   - Do the same for every other place that uses getUserMedia (calls, stories, voice notes).

D. Photo or video chosen from the gallery is not shown:
   - After <input type="file"> change, build the preview with URL.createObjectURL(file). If the file type is empty,
     decide image or video from the extension.
   - Image preview: <img src={url}>. Video preview: <video src={url} playsInline muted controls preload="metadata"> and call load().
   - If createObjectURL fails or the element fires onError, fall back to FileReader.readAsDataURL.
   - Revoke object URLs only when the component unmounts or the file is replaced, never right after setting them.
   - Check that the Content-Security-Policy meta tag (if any) allows blob: and data: in img-src and media-src.
   - Add a visible error message if the file cannot be previewed, and log file.name, file.type, file.size to the console.

E. Big play icon on reels videos while loading:
   - Give every reel <video> a transparent poster: poster="data:image/gif;base64,R0lHODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
   - Add playsInline, preload="auto", muted for autoplay, and no controls attribute.
   - Add CSS: video::-webkit-media-controls, video::-webkit-media-controls-start-playback-button, video::-webkit-media-controls-overlay-play-button { display:none !important; -webkit-appearance:none; }
   - Show your own small spinner on top while the video is buffering (onWaiting / onCanPlay).
```

## Prompt 3: Express server (push, replies, call decline)

```
Update the Express server (firebase-admin is already used for FCM). Show every changed file.

1. FCM rules. Every push must be DATA-ONLY and HIGH priority. Never send a "notification" field, otherwise Android shows it
   itself and the app cannot add the profile picture, the Reply button or the Accept/Decline buttons when the app is closed.
   All data values must be strings.

   Message:
   admin.messaging().send({
     token,
     data: { type: "message", title: senderName, body: text, avatar: senderPhotoUrl, convId: conversationId },
     android: { priority: "high", ttl: 60 * 60 * 1000 }
   })

   Incoming call:
   data: { type: "call", name: callerName, avatar: callerPhotoUrl, callType: "voice" | "video", callId },
   android: { priority: "high", ttl: 30 * 1000 }

   Call cancelled by the caller (before it was answered):
   data: { type: "call_cancel", callId, missed: "true" }
   If the callee answered or declined on another device send missed: "false".

   Send the message push to every registered device of the receiver, also when the app is open (the app hides it itself).
   Remove device tokens that return messaging/registration-token-not-registered.

2. POST /api/native/register-device (normal login auth): body { fcmToken }.
   Create a long-lived random deviceToken (at least 32 bytes), store it with the user id and the fcmToken, return { deviceToken }.
   Replace the stored fcmToken when the app sends a new one.

3. POST /api/native/reply with header "Authorization: Bearer <deviceToken>", body { conversationId, text }.
   Find the user from the deviceToken and run exactly the same code as the normal send-message route. Return 200 on success,
   401 for an unknown token, 403 if the user is not in that conversation, 400 for empty text.

4. POST /api/native/call-decline with the same auth, body { callId }. Reject the call exactly like the normal reject route
   and notify the caller.

5. Optional: store the user's notification mode (on / off / secret). If it is "off" skip message pushes for that user.
   Keep sending full data in "secret" mode, the phone hides the content itself.
```
