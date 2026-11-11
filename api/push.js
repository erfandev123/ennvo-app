/**
 * Ennvo push gateway (Vercel serverless function).
 *
 * Sends the real FCM push that wakes a closed Android app: chat messages and
 * incoming calls. Runs on Vercel, so no Cloud Functions / Blaze plan is needed.
 * Device tokens are read from the user document the app already writes
 * (`users/{uid}.fcmTokens`), so there is no extra database.
 *
 * Security: only a signed-in Ennvo user can call it, only "message" and "call"
 * are accepted, and a call push is only allowed for the real caller.
 *
 * Everything is imported lazily so a missing dependency or a missing
 * environment variable returns a readable JSON error instead of a blank 500.
 */

const PROJECT_ID = 'ennvo-6c01c';

let cached = null;

async function getServices() {
  if (cached) return cached;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    const err = new Error('FIREBASE_SERVICE_ACCOUNT is not set on this deployment');
    err.status = 503;
    throw err;
  }

  const [{ initializeApp, getApps, cert }, { getFirestore, FieldValue }, { getMessaging }, { getAuth }] =
    await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
      import('firebase-admin/messaging'),
      import('firebase-admin/auth'),
    ]);

  if (!getApps().length) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      const err = new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
      err.status = 503;
      throw err;
    }
    initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  }

  cached = { db: getFirestore(), messaging: getMessaging(), auth: getAuth(), FieldValue };
  return cached;
}

const preview = (body) => String(body || '').slice(0, 160);

export default async function handler(req, res) {
  // simple health check: GET /api/push
  if (req.method === 'GET') {
    let configured = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    let sdk = false;
    try {
      await getServices();
      sdk = true;
    } catch (err) {
      return res.status(200).json({ ok: true, configured, sdk, detail: String(err.message || err) });
    }
    return res.status(200).json({ ok: true, configured, sdk });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db, messaging, auth, FieldValue } = await getServices();

    // ---- the caller must be a signed in Ennvo user ----
    const header = req.headers.authorization || '';
    const idToken = header.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return res.status(401).json({ error: 'Missing auth token' });

    let callerUid;
    try {
      callerUid = (await auth.verifyIdToken(idToken)).uid;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    // ---- validate the payload ----
    const body = req.body || {};
    const targetUserId = body.targetUserId;
    const type = body.type;
    if (!targetUserId || !type) return res.status(400).json({ error: 'targetUserId and type are required' });
    if (!['message', 'call'].includes(type)) return res.status(400).json({ error: 'Unsupported type' });

    if (type === 'call') {
      const callId = String(body.callId || '');
      if (!callId) return res.status(400).json({ error: 'callId is required' });
      const call = (await db.collection('calls').doc(callId).get()).data();
      if (!call || String(call.callerId) !== callerUid) {
        return res.status(403).json({ error: 'Not the caller of this call' });
      }
    }

    // ---- device tokens + notification mode ----
    const userSnap = await db.collection('users').doc(String(targetUserId)).get();
    const userData = userSnap.data() || {};
    const tokens = Array.isArray(userData.fcmTokens) ? [...new Set(userData.fcmTokens.filter(Boolean))] : [];
    const mode = typeof userData.notifMode === 'string' ? userData.notifMode : 'on';

    if (!tokens.length) return res.json({ success: true, sent: 0, reason: 'no device tokens' });
    if (type === 'message' && mode === 'off') return res.json({ success: true, sent: 0, reason: 'notifications off' });

    // ---- the data-only message the native service expects ----
    let data;
    let ttl;
    if (type === 'message') {
      const secret = mode === 'secret';
      data = {
        type: 'message',
        title: secret ? 'Ennvo' : String(body.title || 'Ennvo'),
        body: secret ? 'New notification' : preview(body.body),
        avatar: secret ? '' : String(body.avatar || ''),
        convId: String(body.convId || ''),
      };
      ttl = 60 * 60 * 1000;
    } else {
      data = {
        type: 'call',
        name: String(body.name || body.title || 'Caller'),
        avatar: String(body.avatar || ''),
        callType: String(body.callType || 'voice'),
        callId: String(body.callId || ''),
      };
      ttl = 30 * 1000;
    }

    // ---- send ----
    let sent = 0;
    const dead = [];
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      try {
        const result = await messaging.sendEachForMulticast({ tokens: batch, data, android: { priority: 'high', ttl } });
        sent += result.successCount;
        result.responses.forEach((r, idx) => {
          const code = r.error?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            dead.push(batch[idx]);
          }
        });
      } catch (err) {
        console.warn('[push] batch failed:', err?.message);
      }
    }

    if (dead.length) {
      try {
        await db.collection('users').doc(String(targetUserId)).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
      } catch (e) {}
    }

    return res.json({ success: true, sent, failed: dead.length });
  } catch (err) {
    console.error('[push] failed:', err);
    return res.status(err.status || 500).json({ error: String(err.message || err) });
  }
}
