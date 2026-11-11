# Deploying Ennvo push notifications (one time)

The app already contains the native FCM service, the device-token sync and the
reply/decline receivers. The last piece is the server side that *sends* the
push. That is the `functions/` folder in this repository.

## 1. Run the workflow

GitHub → **Actions** → **Deploy Firebase (push + rules)** → **Run workflow**

It needs one repository secret:

* `FIREBASE_SERVICE_ACCOUNT`
  Firebase console → Project settings → **Service accounts** →
  **Generate new private key** → paste the whole JSON file as the secret value.

## 2. If it stops with HTTP 403

```
Permission denied to get service [cloudfunctions.googleapis.com]
```

The service account is not allowed to read/enable Google Cloud APIs yet.
This is an **IAM** issue, not a code issue. Fix it once:

1. Open <https://console.cloud.google.com/iam-admin/iam?project=ennvo-6c01c>
2. Find the service account printed in the workflow log
   (`firebase-adminsdk-...@ennvo-6c01c.iam.gserviceaccount.com`)
3. **Edit principal → Add role → Editor → Save**

   Narrower alternative (same effect, less power):

   | Role | Why |
   | --- | --- |
   | Service Usage Consumer | read which APIs are enabled |
   | Cloud Functions Admin | create/update the functions |
   | Service Account User | let the function run as the runtime account |
   | Cloud Build Editor | functions are built by Cloud Build |
   | Artifact Registry Admin | container image storage |
   | Cloud Run Admin | only for 2nd generation functions |
   | Storage Admin | source upload bucket |

4. Run the workflow again.

## 3. What gets deployed

| Function | Trigger | Result |
| --- | --- | --- |
| `pushOnNewMessage` | new document in `conversations/{id}/messages` | WhatsApp style chat notification, works with the app closed, honours On / Off / Secret |
| `pushOnIncomingCall` | new document in `calls/{id}` | full screen ringing notification |

The same run also publishes `firestore.rules` and the Realtime Database rules.

## 4. Verify

Send a message from a second phone/account while the first app is **closed**.
The phone should ring/vibrate with the sender's name and avatar, and the
notification supports quick reply.

## Without Cloud Functions

If you prefer your own server, `server.ts` already exposes
`POST /api/native/send-push`. Run it somewhere always-on, and point the client
at it. Firebase Cloud Functions is simply the version that needs no server.
