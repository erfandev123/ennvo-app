# Ennvo: notifications when the app is closed, plus reply from the notification

The APK is ready for this, but three small pieces live outside the APK. Do them once.

## 1. Firebase: get google-services.json
1. Firebase Console, open project `gen-lang-client-0296536190`, Project settings.
2. Add an Android app with package ID exactly `com.ennvo.app` (same as the Package ID in the builder).
3. Download `google-services.json`.
4. In the builder page, pick that file in the **google-services.json** field and build. After the first upload the builder reuses the copy in your repo.

## 2. Web app: save the device token and handle replies
Create `src/services/nativeBridge.ts`:

```ts
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';

export function initNativeBridge(
  uid: string,
  db: any,
  sendMessage: (cid: string, uid: string, type: any, text: string) => Promise<any>
) {
  const w = window as any;
  const A = w.AndroidInterface;
  if (!A) return;

  const saveToken = (t?: string) => {
    if (t) updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(t) }).catch(() => {});
  };
  w.onFcmToken = saveToken;
  saveToken(A.getFcmToken?.());

  // Replies typed in the notification arrive here, even if they were queued while the app was closed.
  w.__flushReplies = () => {
    try { JSON.parse(A.getPendingReplies?.() || '[]').forEach((r: any) => (w.__replyQ ||= []).push(r)); } catch {}
    const q = w.__replyQ || [];
    w.__replyQ = [];
    q.forEach((r: any) => r.c && sendMessage(r.c, uid, 'text', r.t).catch(() => {}));
  };
  w.__flushReplies();
}
```

Call it once after login, for example in `App.tsx` where `currentUser` becomes available:

```ts
import { initNativeBridge } from './services/nativeBridge';
import { sendMessage } from './services/chatService';
import { db } from './firebase'; // your existing db export

useEffect(() => {
  if (currentUser?.uid) initNativeBridge(currentUser.uid, db, sendMessage);
}, [currentUser?.uid]);
```

## 3. Server: send the push (Cloud Function)
This needs the Firebase **Blaze** plan (pay as you go, a chat app this size stays within the free quota).
Open Google Cloud Console, click the Cloud Shell icon (browser terminal, nothing to install on your PC), then:

```bash
mkdir -p ennvo-push/functions && cd ennvo-push
echo '{"functions":{"source":"functions"}}' > firebase.json
```

`functions/package.json`:

```json
{
  "name": "functions",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": { "firebase-admin": "^12.0.0", "firebase-functions": "^6.0.0" }
}
```

`functions/index.js`:

```js
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const DB = 'ai-studio-remixremixremixr-880b18d5-3212-4b57-8c6c-229bf879d001';
const db = () => getFirestore(getApp(), DB);

async function push(uids, data) {
  const snaps = await Promise.all(uids.map(u => db().doc(`users/${u}`).get()));
  const tokens = [...new Set(snaps.flatMap(s => (s.data() && s.data().fcmTokens) || []))];
  if (!tokens.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens, data, android: { priority: 'high', ttl: 60000 }
  });
  const dead = tokens.filter((t, i) => !res.responses[i].success &&
    /not-registered|invalid-registration/.test((res.responses[i].error || {}).code || ''));
  if (dead.length) await Promise.all(snaps.map(s => s.ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) })));
}

exports.onMessage = onDocumentCreated(
  { document: 'conversations/{cid}/messages/{mid}', database: DB },
  async ev => {
    const m = ev.data.data();
    const cid = ev.params.cid;
    const c = (await db().doc(`conversations/${cid}`).get()).data();
    if (!c) return;
    const to = (c.participantIds || []).filter(u => u !== m.senderId);
    if (!to.length) return;
    const sender = (c.participantNames || {})[m.senderId] || 'Ennvo';
    const text = m.type === 'text' ? (m.content || 'New message')
      : ({ image: 'Photo', video: 'Video', audio: 'Voice message' }[m.type] || 'Attachment');
    await push(to, {
      type: 'message',
      title: c.isGroup ? (c.groupName || 'Group') : sender,
      body: c.isGroup ? `${sender}: ${text}` : text,
      avatar: (c.isGroup ? c.groupAvatar : (c.participantAvatars || {})[m.senderId]) || '',
      convId: cid
    });
  }
);

exports.onCall = onDocumentCreated({ document: 'calls/{id}', database: DB }, async ev => {
  const c = ev.data.data();
  if (c.status !== 'ringing') return;
  await push([c.receiverId], {
    type: 'call', name: c.callerName || 'Ennvo', avatar: c.callerAvatar || '',
    callType: c.type || 'voice', callId: ev.params.id
  });
});

exports.onCallEnd = onDocumentUpdated({ document: 'calls/{id}', database: DB }, async ev => {
  const a = ev.data.after.data();
  if (ev.data.before.data().status === 'ringing' && a.status !== 'ringing') {
    await push([a.receiverId], { type: 'call_cancel' });
  }
});
```

Deploy:

```bash
npx firebase-tools login --no-localhost
npx firebase-tools deploy --only functions --project gen-lang-client-0296536190
```

## What you get
- App closed or minimized: a push arrives, the notification shows the sender's avatar, groups messages per chat, and has a **Reply** box.
- App open on screen: no notification (the app already shows the message).
- A reply sent from the notification goes out silently while the app process is alive. If Android has fully stopped the app, the reply is queued and sent the next time you open it.
- Incoming calls ring as a full-screen notification and stop when the caller hangs up.

## Security
The zip you uploaded contains real Cloudflare R2 keys in `.env.example`. Rotate those keys in Cloudflare, and never put real secrets in files that get zipped.
