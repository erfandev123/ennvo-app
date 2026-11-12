/**
 * Publishes the freshly built web bundle so the installed Android app can
 * update itself.
 *
 * - the bundle (a zip of the web build) is uploaded to the media storage
 * - the app config in Firestore points to it, the app downloads the bundle and
 *   applies it right away
 *
 * Needs the FIREBASE_SERVICE_ACCOUNT secret (for the Firestore config) and a
 * reachable backend (for the upload URL).
 */
import fs from 'node:fs';
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('::notice::No FIREBASE_SERVICE_ACCOUNT secret, the OTA bundle is not published.');
  process.exit(0);
}

const bundlePath = process.argv[2];
const version = process.argv[3] || '1.0.0';
const minNativeVersionCode = Number(process.argv[4] || 1);
const backends = (process.env.OTA_BACKEND_URL || 'https://ennvo.vercel.app,https://ais-dev-ququzv7htl2qshqf3skacy-736538280490.asia-northeast1.run.app')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!bundlePath || !fs.existsSync(bundlePath)) {
  console.log('::notice::No bundle file, the OTA bundle is not published.');
  process.exit(0);
}

const buffer = fs.readFileSync(bundlePath);
const key = `app-updates/ennvo-web-${version.replace(/[^A-Za-z0-9._-]/g, '-')}.zip`;

async function upload() {
  let lastError = null;
  for (const backend of backends) {
    try {
      const presign = await fetch(`${backend}/api/r2-presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: 'application/zip' }),
      });
      if (!presign.ok) throw new Error(`${backend} answered ${presign.status}`);
      const { uploadUrl, publicUrl } = await presign.json();
      if (!uploadUrl || !publicUrl) throw new Error(`${backend} did not return an upload url`);

      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/zip' },
        body: buffer,
      });
      if (!put.ok) throw new Error(`upload failed with ${put.status}`);
      console.log(`::notice::Bundle uploaded to ${publicUrl}`);
      return publicUrl;
    } catch (e) {
      lastError = e;
      console.log(`::notice::${backend} could not be used: ${e.message}`);
    }
  }
  throw lastError || new Error('no backend accepted the upload');
}

let bundleUrl = '';
try {
  bundleUrl = await upload();
} catch (e) {
  console.log(`::warning::The OTA bundle could not be uploaded: ${e.message}`);
  console.log('::warning::The APK is still published, the app just keeps its current web bundle.');
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

console.log(`::notice::OTA bundle published: ${version} -> ${bundleUrl}`);
console.log(`::notice::Bundle size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
