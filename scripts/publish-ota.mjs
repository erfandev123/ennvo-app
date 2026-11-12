/**
 * Points the app config in Firestore at the newest web bundle.
 *
 * The bundle itself is published as a release asset of the GitHub release, so
 * the installed app can download it without any secret. The app downloads the
 * bundle and switches to it right away, so a new version is live without a
 * new APK from the store.
 *
 * Needs the FIREBASE_SERVICE_ACCOUNT secret.
 */
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('::notice::No FIREBASE_SERVICE_ACCOUNT secret, the OTA bundle is not announced.');
  process.exit(0);
}

const version = process.argv[2] || '1.0.0';
const bundleUrl = process.argv[3] || '';
const minNativeVersionCode = Number(process.argv[4] || 1);

if (!bundleUrl) {
  console.log('::notice::No bundle url, the OTA bundle is not announced.');
  process.exit(0);
}

const serviceAccount = JSON.parse(raw);
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
}

const db = getFirestore();
await db.doc('appConfig/android').set(
  {
    ota: {
      enabled: true,
      version,
      bundleUrl,
      rolloutPercent: 100,
      minNativeVersionCode,
    },
  },
  { merge: true }
);

console.log(`::notice::OTA bundle announced: ${version} -> ${bundleUrl}`);
