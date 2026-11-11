# Ennvo Company-Level Admin Panel (`admin.ennvoapp.com`)

Production-grade administration web application for Ennvo staff and operations.

---

## 1. Role Matrix & Access Control

Roles are enforced via Firebase Authentication custom claims (`request.auth.token.role`):

| Role | Dashboard & Analytics | Users & Accounts | Content Moderation | Reports Queue | App Config & OTA | Push Notifications | Legal/Chat Audit | Staff & Billing |
|---|---|---|---|---|---|---|---|---|
| **superadmin** | Full | Full (incl. Delete) | Full | Full | Full | Full | Full | Full |
| **admin** | Full | Full (no role change) | Full | Full | Full | Full | With Reason | Read-only |
| **moderator** | Summary | Warn / Suspend / Ban | Hide / Pin / Flag | Full | Read-only | None | None | None |
| **support** | Summary | View & Reset PW & Notes | View only | View only | Read-only | User specific | None | None |
| **analyst** | Full (Read-only) | View only | View only | View only | Read-only | Read-only stats | None | None |

---

## 2. Architecture & Security Principles
- **No Browser Admin SDK**: Dangerous writes (ban, delete, change role, push, config changes) execute via authenticated callable Cloud Functions with role validation and parameter schemas.
- **Immutable Audit Trail (`adminLogs`)**: Every administrative write records `adminUid`, `action`, `targetType`, `targetId`, `beforeValue`, `afterValue`, `reason`, `ipAddress`, and `timestamp`. Firestore security rules strictly deny updates and deletions on `adminLogs`.
- **Session Security**: 30-minute idle session timeout with re-authentication required for destructive actions (e.g. deleting users, mass push notifications).
- **Dual Language**: Complete bilingual support for English and Bengali (বাংলা).

---

## 3. Runbooks for Common Tasks

### 3.1 Banning a Malicious User
1. Open **Users** in the sidebar.
2. Search by UID, username, or email.
3. Tap **View Details** -> Select **Ban User** or **Suspend**.
4. If suspending, select duration (1 day, 7 days, 30 days).
5. Enter a mandatory audit reason (e.g. "Spamming offensive comments").
6. Click **Confirm**. The user is immediately logged out on their Android app and blocked from posting or chatting.

### 3.2 Forcing an App Update
1. Open **App Versions & Updates** (`appConfig/android`).
2. Update `latestVersionCode` and `latestVersionName`.
3. Set `minVersionCode` to the new version code.
4. Toggle **Force Update** to `ON`.
5. Enter release notes in English and Bangla.
6. Provide Play Store URL or direct APK download URL.
7. Click **Publish Configuration**. Users on older builds will see a full-screen blocking modal instructing them to update.

### 3.3 Deploying or Rolling Back an Over-The-Air (OTA) Web Update
1. Build the web bundle: `npm run build` and zip the contents of `dist`.
2. Upload the zip to Firebase Storage or Cloudflare R2 and copy the public HTTPS URL.
3. Open **App Versions & Updates** -> **OTA Web Updates**.
4. Set `bundleUrl`, new `version` string, and set `rolloutPercent` (e.g. 10% for canary testing).
5. To instantly roll back a broken bundle, decrease `rolloutPercent` to 0% or revert `bundleUrl` to the previous stable release.

---

## 4. Setup & Deployment

### 4.1 Create the First Superadmin
```bash
npx tsx scripts/create-superadmin.ts admin@ennvoapp.com
```

### 4.2 Local Development
```bash
cd admin
npm install
npm run dev
```

### 4.3 Firebase Hosting Deployment
```bash
firebase deploy --only hosting:admin,functions,firestore:rules
```
