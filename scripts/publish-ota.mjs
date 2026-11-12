/**
 * Publishes the freshly built web bundle so the installed Android app can
 * update itself.
 *
 * - the bundle (a zip of the web build) is uploaded to Firebase Storage
 * - the app config in Firestore points to it, the app downloads the bundle and
 *   applies it right away
 *
 * Needs the FIREBASE_SERVICE_ACCOUNT secret.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('::notice::No FIREBASE_SERVICE_ACCOUNT secret, the OTA bundle is not published.');
  process.exit(0);
}

const bundlePath = process.argv[2];
const version = process.argv[3] || '1.0.0';
const minNativeVersionCode = Number(process.argv[4] || 1);

if (!bundlePath || !fs.existsSync(bundlePath)) {
  console.log('::notice::No bundle file, the OTA bundle is not published.');
  process.exit(0);
}

const serviceAccount = JSON.parse(raw);
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
}

const bucket = getStorage().bucket(serviceAccount.project_id + '.firebasestorage.app');
const objectName = `app-updates/ennvo-web-${version}.zip`;

const buffer = fs.readFileSync(bundlePath);
const file = bucket.file(objectName);
await file.save(buffer, {
  resumable: false,
  metadata: { contentType: 'application/zip', cacheControl: 'public, max-age=31536000' },
});
try {
  await file.makePublic();
} catch (e) {
  console.log('::notice::The bundle object could not be made public, it stays private.');
}

const downloadToken = (await file.getMetadata())[0]?.metadata?.downloadTokens?.[0];
const publicUrl = downloadToken
  ? `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`
  : `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectName)}?alt=media`;

const db = getFirestore();
await db.doc('appConfig/android').set(
  {
    ota: {
      enabled: true,
      version,
      bundleUrl: publicUrl,
      rolloutPercent: 100,
      minNativeVersionCode,
    },
  },
  { merge: true }
);

console.log(`::notice::OTA bundle published: ${version} -> ${publicUrl}`);
console.log(`::notice::Bundle size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
