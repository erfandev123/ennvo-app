/**
 * Ennvo push gateway (Vercel serverless function).
 *
 * Sends the real FCM push that wakes a closed Android app: chat messages and
 * incoming calls. It runs on Vercel, so no Cloud Functions / Blaze plan is
 * needed. Device tokens are read from the user document that the app already
 * writes (`users/{uid}.fcmTokens`), so there is no extra database.
 *
 * Security: only a signed-in Ennvo user can call it, and only the "message" and
 * "call" types are accepted, so it cannot be used as an open relay.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

const getServices = () => {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    initializeApp({ credential: cert(JSON.parse(raw)), projectId: 'ennvo-6c01c' });
  }
  return { db: getFirestore(), messaging: getMessaging(), auth: getAuth() };
};

const preview = (type, body) => (type === 'text' || !type ? String(body || '').slice(0, 160) : String(body || ''));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let services;
  try {
    services = getServices();
  } catch (err) {
    return res.status(500).json({ error: 'Push is not configured', detail: String(err.message || err) });
  }
  const { db, messaging, auth } = services;

  // ---- 1. the caller must be a signed in Ennvo user ----
  const header = req.headers.authorization || '';
  const idToken = header.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) return res.status(401).json({ error: 'Missing auth token' });

  let callerUid;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    callerUid = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  // ---- 2. validate the payload ----
  const { targetUserId, type } = req.body || {};
  if (!targetUserId || !type) return res.status(400).json({ error: 'targetUserId and type are required' });
  if (!['message', 'call'].includes(type)) return res.status(400).json({ error: 'Unsupported type' });
  if (type === 'call') {
    // the caller must be the person who created the call document
    const callId = String(req.body.callId || '');
    if (!callId) return res.status(400).json({ error: 'callId is required' });
    try {
      const callSnap = await db.collection('calls').doc(callId).get();
      const call = callSnap.data();
      if (!call || String(call.callerId) !== callerUid) {
        return res.status(403).json({ error: 'Not the caller of this call' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Could not verify the call' });
    }
  }

  // ---- 3. device tokens + notification mode ----
  let tokens = [];
  let mode = 'on';
  try {
    const snap = await db.collection('users').doc(String(targetUserId)).get();
    const data = snap.data() || {};
    tokens = Array.isArray(data.fcmTokens) ? [...new Set(data.fcmTokens.filter(Boolean))] : [];
    mode = typeof data.notifMode === 'string' ? data.notifMode : 'on';
  } catch (err) {
    return res.status(500).json({ error: 'Could not read the target user' });
  }
  if (!tokens.length) return res.json({ success: true, sent: 0, reason: 'no device tokens' });
  if (type === 'message' && mode === 'off') return res.json({ success: true, sent: 0, reason: 'notifications off' });

  // ---- 4. build the data-only message the native service expects ----
  const body = req.body || {};
  let data;
  let ttl;
  if (type === 'message') {
    const secret = mode === 'secret';
    data = {
      type: 'message',
      title: secret ? 'Ennvo' : String(body.title || 'Ennvo'),
      body: secret ? 'New notification' : preview(body.messageType, body.body),
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

  // ---- 5. send ----
  let sent = 0;
  const dead = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const result = await messaging.sendEachForMulticast({ tokens: batch, data, android: { priority: 'high', ttl } });
      sent += result.successCount;
      result.responses.forEach((r, idx) => {
        const code = r.error?.code || '';
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') {
          dead.push(batch[idx]);
        }
      });
    } catch (err) {
      console.warn('[push] batch failed', err?.message);
    }
  }

  if (dead.length) {
    try {
      const { FieldValue } = await import('firebase-admin/firestore');
      await db.collection('users').doc(String(targetUserId)).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
    } catch (err) {}
  }

  return res.json({ success: true, sent, failed: dead.length });
}
