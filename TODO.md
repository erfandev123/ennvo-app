# Ennvo Android - To-do list

Everything that was reported for the Android app, with the state of each point.
`done` means it is fixed and shipped in the release, `open` means it still
needs work.

## 1. System and window

| # | Point | State |
|---|-------|-------|
| 1.1 | The app fills the whole screen, the phone's own status bar and back / home / recents buttons stay visible on top of it | done |
| 1.2 | The keyboard is applied exactly once, no black bar on top and no page jump | done |
| 1.3 | The chat composer sits on the keyboard, the wallpaper is never cut | done |
| 1.4 | The notch inset is published to the web app, no header under the notch | done |
| 1.5 | The hardware back button behaves like a native app, the predictive back is disabled | done |
| 1.6 | The app starts fast, the native splash is the only splash | done |
| 1.7 | Page changes feel instant, the page bundles are preloaded | done |
| 1.8 | Scrolling is smooth on low end phones (no permanent GPU layers, memoised lists) | done |

## 2. Icons and splash

| # | Point | State |
|---|-------|-------|
| 2.1 | The launcher icon is a flat blue gradient with the white Ennvo mark, no circle inside a circle | done |
| 2.2 | The icon is not zoomed on the home screen, the artwork keeps its margin | done |
| 2.3 | The splash symbol is sharp on every screen density | done |
| 2.4 | The launch screen is black with the logo and the "Ennvo" wordmark, it fades out with the first frame | done |
| 2.5 | No React / web splash, the splash is pure Java | done |
| 2.6 | Exactly one splash: the system splash only paints the black background, the logo and the wordmark are drawn by the app itself | done |

## 3. Notifications

| # | Point | State |
|---|-------|-------|
| 3.1 | A message push arrives on the phone, also while the app is open | done |
| 3.2 | The activity notification shows the actor photo, the Ennvo symbol, the name and the action text | done |
| 3.3 | The activity notification plays a sound but never covers the app | done |
| 3.4 | Tapping a notification opens the app directly in the chat / activity, without showing the reels first | done |
| 3.5 | The in-app notification (toast) shows again | done |
| 3.6 | The notification of the chat that is open right now is skipped | done |
| 3.7 | The reply and the decline action on a notification work without the app | done |
| 3.8 | The device token is written again every time the app comes to the front, so a rotated token never blocks a push | done |
| 3.9 | The gateway removes device tokens that Firebase does not know any more | done |
| 3.10 | A push that no device took is sent once more a moment later | done |

## 4. Chat

| # | Point | State |
|---|-------|-------|
| 4.1 | Messages arrive in real time, the streaming transport is used again | done |
| 4.2 | A chat that is opened from a notification shows its history right away | done |
| 4.3 | Sending does not wait for a conversation read, the push goes out in parallel | done |
| 4.4 | "Seen" is marked in one batch instead of 25 documents per message | done |
| 4.5 | The whole app does not re-render on every store change | done |
| 4.6 | The cache is written debounced and trimmed, the main thread stays free | done |
| 4.7 | A new message scrolls the chat to the bottom instantly, one scroll handler | done |
| 4.8 | Images, stickers and albums load with the real url and keep their ratio | done |
| 4.9 | The chat opens from the right and closes to the left, like WhatsApp | done |
| 4.10 | The header has no own bar, the background stays visible | done |
| 4.11 | Deleting a message removes it everywhere in real time | done |
| 4.12 | The older messages are loaded with a cursor instead of a full reload | done |
| 4.13 | The chat does not jump to the top when a message comes in (the guessed row heights are gone) | done |
| 4.14 | The chat always opens at the newest message, also after Back | done |

## 5. Calls

| # | Point | State |
|---|-------|-------|
| 5.1 | The call screen is a light, fast page that looks like the React call page | done |
| 5.2 | The profile picture has no ring around it | done |
| 5.3 | The mute, speaker, camera and end buttons really work | done |
| 5.4 | The buttons sit in one clean rounded panel | done |
| 5.5 | Back returns to the app and keeps the call running | done |
| 5.6 | The status shows Ringing / Calling in real time | done |
| 5.7 | An incoming call shows as a banner in the app, it can be closed and a tap opens the call screen | done |
| 5.8 | The shared video fills the whole call screen | done |
| 5.9 | The call survives a weak network (ICE restart, TURN, Opus FEC) | done |

## 6. Reels and feed

| # | Point | State |
|---|-------|-------|
| 6.1 | The next reel is downloaded while the current one plays | done |
| 6.2 | Playback starts earlier and a spinner shows while it buffers | done |
| 6.3 | The reels scroll without stutter | done |
| 6.4 | The reels stop their sound when another page is opened | done |

## 7. Updates

| # | Point | State |
|---|-------|-------|
| 7.1 | The CI publishes the web bundle and announces it in the app config | done |
| 7.2 | The installed app downloads the bundle and switches to it right away | done |
| 7.3 | The release APK is signed with one permanent key, so updates install over the installed app | done |

## 8. Still open

| # | Point | State |
|---|-------|-------|
| 8.1 | The reel videos are uploaded without a transcode, so a big clip still needs a lot of data. A server side transcode to 720p with faststart would make the feed much lighter | open |
| 8.2 | The base64 thumbnails inside the post documents make the first feed load heavy. Moving them to the storage would shrink the download a lot | open |
| 8.3 | The Firestore security rules could not be published from the workflow: the service account needs the role "Firebase Rules Admin" on the project. The rules in the repository are newer than the published ones | open |
| 8.4 | Google / Facebook sign-in inside the Android WebView cannot use the browser popup. It needs a native credential plugin (or a Custom Tab + deep link flow) to be as smooth as the email login | open |

## 9. Fix pass (this release)

| # | Point | State |
|---|-------|-------|
| 9.1 | Media upload and R2 presigning now reach the real deployment from inside the APK (the old AI Studio backend URL was dead) | done |
| 9.2 | The sender writes `lastMessageType`, so a photo shows as "Photo" in the list, the toast and the push | done |
| 9.3 | Muting a chat is written to Firestore (`mutedBy`) and honoured by the push gateway and the native notification | done |
| 9.4 | One push sender only: the duplicate `pushOnNewMessage` / `pushOnIncomingCall` triggers are gone | done |
| 9.5 | Dead device tokens are removed without wiping the whole token list | done |
| 9.6 | The push gateway only accepts a message push for a conversation the caller is part of | done |
| 9.7 | Sending a message retries on a flaky network (idempotent, no duplicates) | done |
| 9.8 | Lite mode for 1-2 GB / 4-core phones skips backdrop blur and permanent GPU layers | done |
| 9.9 | The startup prefetch loads the chunk of the real first screen instead of always downloading Reels | done |
| 9.10 | Unused files, the broken web FCM path and 1.4 MB of unused images are removed | done |

## 10. Chat deep fix pass

| # | Point | State |
|---|-------|-------|
| 10.1 | A sent message no longer jumps to the top when Firestore writes the server timestamp (`serverTimestamps: 'estimate'` + one chronological sort) | done |
| 10.2 | The message listener no longer restarts on every profile update (deps on `uid`, not the whole user object) | done |
| 10.3 | Deleting a message disappears on both phones in real time, also for the oldest message of the live window | done |
| 10.4 | Deleted messages never come back from the offline cache (per-account tombstones) | done |
| 10.5 | "Delete for me" only hides locally; "Unsend" removes it for both sides | done |
| 10.6 | Scrolling up no longer fights the visual-viewport listener, no extra GPU layer, no backdrop blur over the scroll area | done |
| 10.7 | Older history is prefetched before the top, anchored with a ResizeObserver (images above no longer move the text) | done |
| 10.8 | A chat that is opened from a notification no longer slides in on top of itself, and closing slides back to the right | done |
| 10.9 | Chat images load lazily, so scrolling a long history does not download everything | done |
| 10.10 | A message that fails to send shows "Not sent · Tap to retry" and resends with the same id (no duplicate) | done |
| 10.11 | "Seen" was shown before the other person opened a brand new chat; fixed | done |
| 10.12 | Clearing a chat also clears its local cache and works past the 500-write batch limit | done |

## 11. WhatsApp-speed pass

| # | Point | State |
|---|-------|-------|
| 11.1 | A message request has no 2-message cap any more; the chat behaves like a normal chat until the recipient decides | done |
| 11.2 | The live window is 60 messages and "load older" pages 50 at a time, so the history has no practical limit | done |
| 11.3 | The composer is a flat 2D field (no blur, no black border, no glow), 52px tall, 16px text, grows to 140px | done |
| 11.4 | Bubbles stop at 72-78% of the width and never reach the other side; Enter sends, Shift+Enter adds a line | done |
| 11.5 | The input stays above the sticker sheet and is clickable while the sheet is open (z-index + backdrop) | done |
| 11.6 | Tab chunks are prefetched on touch-down / hover, so page changes are instant | done |
| 11.7 | The PC left dock uses the same translucent glass language as the Android bottom bar | done |
| 11.8 | Browser notifications are now actually shown, and a click opens the chat / post inside the app without a reload | done |
| 11.9 | A message written from another device of the same account no longer notifies the sender | done |
| 11.10 | Own-activity notifications (self-like, self-comment) are skipped, and the seen-set stays bounded | done |
