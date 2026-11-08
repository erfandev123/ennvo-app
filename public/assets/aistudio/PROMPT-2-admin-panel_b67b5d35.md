# PROMPT 2: Ennvo company-level admin panel

Copy everything below the line into your AI coding tool. Give it the Ennvo app source too, so it can read the real Firestore structure.

---

You are a senior full-stack engineer. Build a production-grade admin panel for the Ennvo social app (feed, reels, chat, calls, notifications, profiles). It is a separate web app used by company staff. It must be secure, fast, auditable and pleasant to use on a laptop and on a phone.

## Stack
React 19, Vite, TypeScript (strict), Tailwind, React Router, TanStack Query and TanStack Table, Recharts, Zustand only where needed. Firebase Authentication, Firestore, Cloud Storage and Cloud Functions (2nd gen, Node 20, TypeScript). Hosting on Firebase Hosting under `admin.ennvoapp.com`. The panel uses the same Firebase project and the same named Firestore database as the Ennvo app (read the database id from the app's `firebase-applet-config.json`). Light and dark theme, English and Bangla interface strings (a small i18n file), responsive tables.

## First step: learn the real data
Before writing code, read the Ennvo source (`src/services/*`, `firestore.rules`, `firebase-blueprint.json`, `realtime-database.rules.json`) and write `docs/data-model.md` listing every collection, document shape and field the app already uses (at least: `users`, posts and reels collections, comments, `conversations` with the `messages` subcollection, `calls`, notifications, follows and blocks). Build the panel on top of those real names. Do not invent a second schema for data that already exists. List every place where you had to guess.

## Roles and security (most important)
- Roles through Firebase custom claims: `superadmin`, `admin`, `moderator`, `support`, `analyst`. A role matrix in the README defines what each can see and do (analyst: read-only analytics; support: users and tickets; moderator: content, reports, bans; admin: all except roles and billing; superadmin: everything).
- The panel never uses the Admin SDK in the browser. Every write that matters (ban, delete, change role, send push, change app config, bulk action) goes through an authenticated callable Cloud Function that checks the caller's claim, validates input with a schema, performs the action and writes an audit log entry.
- Firestore rules: only users with an admin claim may read admin collections; regular users can never write `status`, `bannedUntil`, `isAdmin`, roles or counters. Provide the full updated rules file and tests with the emulator.
- Sign-in with email and password plus mandatory second factor (TOTP via Firebase multi-factor auth). Session timeout after 30 minutes idle. Optional IP allowlist setting. Rate limit sensitive functions. Re-authentication before dangerous actions (delete user, change role, mass push).
- Audit log in `adminLogs`: who, when, action, target, before and after values, reason, IP and user agent. Immutable (no update or delete in rules). A page to search and export it.
- A script `scripts/create-superadmin.ts` to create the first superadmin from the command line using a service account.

## Pages and features (build all of them)
1. **Dashboard**: live counters (total users, new today, active now, DAU, WAU, MAU, posts, reels, comments, messages today, calls today, open reports, banned users, storage used). Charts for 7, 30 and 90 days: signups, active users, content created, messages, call minutes, retention. Counters come from a `stats/daily/{yyyy-mm-dd}` collection and a `stats/live` document maintained by Cloud Functions triggers, not by counting collections in the browser.
2. **Users**: server-side search (username, name, email, phone, uid), filters (status, verified, country, created date, last active, reports count), sort, pagination. User detail page: profile, devices and FCM tokens, login history, followers and following, posts, reels, reports against and by the user, blocks, sessions. Actions: edit profile fields, verify or unverify, warn, suspend for a duration, ban, unban, force logout (revoke refresh tokens), disable or enable the auth account, reset password email, delete account with all data (queued Cloud Function with a confirmation step), add internal notes, impersonation is not allowed. Bulk actions on selected rows with a preview.
3. **Content (feed and reels)**: tabs for posts, reels, stories if present, comments. Filter by author, date, status, reports, media type. Preview media inline. Actions: hide, restore, delete, pin, feature on the feed or reels, mark sensitive, remove a single comment, bulk moderation. A "trending and ranking" settings page for the feed and reels (weights for recency, likes, comments, shares, and a boost list) stored in `appConfig/ranking`.
4. **Reports and moderation queue**: reports from the app (`reports` collection: reporter, target type and id, reason, details, status). Queue with priority, assignment to a moderator, SLA timers, decision buttons (dismiss, warn, hide content, suspend, ban), reason templates, appeal handling, and a history per target. Auto-flag by rules (many reports in a short time).
5. **Blocks and safety**: view user-to-user blocks, search by user, global blocked usernames and words (`appConfig/moderation`), banned devices and IPs, spam detection settings, rate limits.
6. **Messages and calls (support and legal)**: no browsing of private chats. A conversation can be opened only from a report or a legal request, with a mandatory reason, a time limit, and an audit entry. Show a call log with duration and status for diagnostics (no content).
7. **App versions and updates**: edit `appConfig/android` exactly in the shape below, with validation and a preview of what users will see. Buttons: publish new version, force update, set minimum version, maintenance mode on or off with a message, staged rollout percentage for over-the-air web updates, rollback to the previous version, history of all changes with who changed what. Upload of an APK or web bundle to Cloud Storage with a signed public URL and a checksum.
   ```
   appConfig/android = {
     latestVersionCode: number, latestVersionName: string, minVersionCode: number, forceUpdate: boolean,
     apkUrl: string, storeUrl: string, releaseNotes: { en: string, bn: string },
     maintenance: { enabled: boolean, message: string },
     ota: { enabled: boolean, version: string, bundleUrl: string, minNativeVersionCode: number, rolloutPercent: number },
     rtc: { iceServers: RTCIceServer[] }
   }
   ```
8. **Push notifications and announcements**: send a push to everyone, a segment (country, language, app version, last active, verified) or a single user, using FCM from a Cloud Function in batches of 500 tokens, with title, body, image, deep link (`https://ennvoapp.com/...`), scheduling, a preview on a phone mock, delivery stats and a history. In-app banners and announcements with start and end dates and targeting. Pushes are data messages with the fields `type`, `title`, `body`, `avatar`, `convId` that the Android app already understands.
9. **Feature flags and remote settings**: `appConfig/flags` with on and off switches and percentages (calls, reels upload, AI chat, stories, ads), each with an owner and a change history.
10. **Verification and support**: queue of verification requests with documents; support tickets from the app with replies, status, tags and canned answers.
11. **Media and storage**: browse uploaded media (the app stores files in Cloudflare R2 behind a server; use the server's list or delete endpoint or a Cloud Function proxy, never put storage keys in the browser), find large or orphaned files, delete, and see storage per user.
12. **Analytics and exports**: funnels (install, signup, first post, first message), cohorts, top creators, top content, countries and device models, crash-free rate (link to Firebase Crashlytics), CSV and JSON export with a background job for large exports.
13. **Staff management and settings**: invite staff by email, assign roles, remove access, list active sessions, security log, panel settings, data retention settings.
14. **System health**: Cloud Function errors, failed pushes, queue sizes, last backup time, and a button to trigger a Firestore export.

## Backend (Cloud Functions)
Write all functions in TypeScript with shared validation (zod), structured logs and unit tests.
- Callables for every admin action above, each checking the role and writing to `adminLogs`.
- Firestore triggers that maintain counters and daily stats on create and delete of users, posts, reels, comments, messages and calls; idempotent and safe to retry.
- `onReportCreated` (auto-flagging), `onUserBanned` (revoke tokens, disable auth, hide content), `onUserDeleted` (cleanup with a queue), a scheduled function that expires temporary suspensions by clearing `bannedUntil`, a scheduled daily aggregation, and a scheduled backup export.
- Push sender with token cleanup for invalid tokens.
- Everything handles the named Firestore database id.

## Integration contract with the mobile app
The Android app already reads these and the admin panel must write them:
- `appConfig/android` (shape above) for updates, maintenance and call servers.
- `users/{uid}.status` is `active`, `suspended` or `banned`; optional `bannedUntil` (timestamp) and `banReason`. The app signs the user out when the status is not active.
- `users/{uid}.fcmTokens` is an array of device tokens (read-only for admins except cleanup).
- `reports` documents created by the app: `{reporterId, targetType: 'user'|'post'|'reel'|'comment'|'message', targetId, reason, details, createdAt, status: 'open'}`.
Tell me exactly which fields the Ennvo app must add or change to match, so I can pass that list to the app developer.

## Quality bar
- Fast: server-side pagination everywhere, indexes defined in `firestore.indexes.json`, no unbounded reads, virtualized long tables, skeleton loaders, optimistic updates where safe.
- Safe: confirmation dialogs with a typed reason for destructive actions, undo where possible (soft delete first, hard delete after a retention period).
- Accessible and responsive: keyboard navigation, readable on a 360 px wide phone.
- Documentation: README with architecture, role matrix, environment setup, emulator instructions, deployment steps (`firebase deploy`), and a runbook for common tasks (ban a user, force an update, roll back a bad web bundle).
- Tests: unit tests for functions, emulator tests for rules, and a few end-to-end tests for login, ban and publish-update flows.

Deliver in milestones and stop after each one so I can review: (1) data model doc, auth, roles, rules, audit log, shell and dashboard; (2) users and content moderation; (3) reports, blocks, push, app versions and flags; (4) analytics, media, support, staff, health; (5) hardening, tests and docs. Ask me before making any choice that cannot be undone.
