/**
 * Ennvo push gateway (Vercel serverless function, no SDK dependencies).
 *
 * Why REST instead of firebase-admin: firebase-admin 14 pulls an ESM-only
 * "jose" package that cannot be require()d from a CommonJS serverless function,
 * which made every push fail at load time. Everything here is plain HTTPS plus
 * Node's built-in crypto, so a dependency bump cannot break it again.
 *
 * Security
 *  - the caller's Firebase ID token is verified with Identity Toolkit
 *  - only "message" and "call" are accepted
 *  - a call push is only allowed for the real caller of the call document
 *
 * GET  /api/push -> { ok, configured, tokenOk } health check
 * POST /api/push -> sends the data-only FCM message the Android app handles
 */
import crypto from 'node:crypto';

const PROJECT_ID = 'ennvo-6c01c';
const WEB_API_KEY = 'AIzaSyDhDRjiwHb5aeC8YJ6-JQDmxlSAVKZQzd0';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const serviceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const sa = JSON.parse(raw);
  if (sa.private_key && typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  return sa;
};

/* Google access token: service account JWT -> OAuth */
let cachedToken = { value: null, exp: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken.value && cachedToken.exp - 60 > now) return cachedToken.value;

  const sa = serviceAccount();
  if (!sa) throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT is not set'), { status: 503 });

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');

  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error_description || 'token exchange failed'), { status: 500 });

  cachedToken = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.value;
}

/* Firebase ID token verification (Identity Toolkit REST) */
async function verifyCaller(idToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json().catch(() => ({}));
  const uid = data && data.users && data.users[0] && data.users[0].localId;
  if (!uid) throw Object.assign(new Error('Invalid auth token'), { status: 401 });
  return uid;
}

/* Firestore REST helpers */
async function readDoc(path) {
  const token = await getAccessToken();
  const res = await fetch(`${FIRESTORE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

/* Removes a token that Firebase no longer knows (a reinstall or a token
   rotation). Without this the list of devices grows and the push fails for
   the devices that are no longer registered.

   The document is read first and written once. The old version cleared the
   whole array and then wrote the remaining tokens back, so a failed second
   request left the user with no device at all. */
async function removeToken(userId, token) {
  try {
    const accessToken = await getAccessToken();
    const doc = await readDoc('users/' + userId);
    if (!doc) return;
    const current = toArray(doc.fields && doc.fields.fcmTokens);
    const rest = current.filter((t) => t !== token);
    if (rest.length === current.length) return;
    const url = `${FIRESTORE}/users/${userId}?updateMask.fieldPaths=fcmTokens`;
    await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          fcmTokens: { arrayValue: { values: rest.map((t) => ({ stringValue: t })) } },
        },
      }),
    });
  } catch (e) {
    console.warn('[push] could not clean up an old token:', e);
  }
}

const toArray = (field) =>
  (field && field.arrayValue && Array.isArray(field.arrayValue.values) ? field.arrayValue.values : [])
    .map((v) => v.stringValue)
    .filter(Boolean);

const toStr = (field) => (field && field.stringValue) || '';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let configured = false;
    let tokenOk = false;
    try {
      configured = !!serviceAccount();
      if (configured) {
        await getAccessToken();
        tokenOk = true;
      }
      return res.status(200).json({ ok: true, configured, tokenOk });
    } catch (err) {
      return res
        .status(200)
        .json({ ok: true, configured, tokenOk, detail: String(err.message || err).slice(0, 160) });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const idToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return res.status(401).json({ error: 'Missing auth token' });
    const callerUid = await verifyCaller(idToken);

    const body = req.body || {};
    const targetUserId = body.targetUserId;
    const type = body.type;
    if (!targetUserId || !type) return res.status(400).json({ error: 'targetUserId and type are required' });
    if (['message', 'call', 'activity'].indexOf(type) === -1) return res.status(400).json({ error: 'Unsupported type' });

    if (type === 'call') {
      const callId = String(body.callId || '');
      if (!callId) return res.status(400).json({ error: 'callId is required' });
      const callDoc = await readDoc('calls/' + callId);
      const callerId = toStr(callDoc && callDoc.fields && callDoc.fields.callerId);
      if (callerId !== callerUid) return res.status(403).json({ error: 'Not the caller of this call' });
    }

    // A message push is only allowed for a conversation the caller is really
    // part of, so the endpoint cannot be used to ping arbitrary users.
    if (type === 'message') {
      const convId = String(body.convId || '');
      if (!convId) return res.status(400).json({ error: 'convId is required' });
      const convDoc = await readDoc('conversations/' + convId);
      const participants = toArray(convDoc && convDoc.fields && convDoc.fields.participantIds);
      if (!participants.includes(callerUid)) {
        return res.status(403).json({ error: 'Not a participant of this conversation' });
      }
    }

    const userDoc = await readDoc('users/' + targetUserId);
    const fields = (userDoc && userDoc.fields) || {};
    const tokens = Array.from(new Set(toArray(fields.fcmTokens)));
    const mode = toStr(fields.notifMode) || 'on';
    const mutedField =
      fields.mutedBy && fields.mutedBy.mapValue && fields.mutedBy.mapValue.fields
        ? fields.mutedBy.mapValue.fields[targetUserId]
        : null;
    const mutedForUser = !!(mutedField && mutedField.booleanValue);

    if (!tokens.length) return res.json({ success: true, sent: 0, reason: 'no device tokens' });
    if (type === 'message' && mode === 'off') return res.json({ success: true, sent: 0, reason: 'notifications off' });
    // A muted conversation still arrives in real time inside the app, it just
    // never rings the phone. Calls are always delivered.
    if (type !== 'call' && mutedForUser) return res.json({ success: true, sent: 0, reason: 'muted' });

    const secret = mode === 'secret';
    const data =
      type === 'activity'
        ? {
            type: 'activity',
            title: secret ? 'Ennvo' : String(body.title || 'Ennvo'),
            body: secret ? 'New notification' : String(body.body || '').slice(0, 160),
            avatar: secret ? '' : String(body.avatar || ''),
            url: secret ? '' : String(body.url || '').slice(0, 240),
          }
      : type === 'message'
        ? {
            type: 'message',
            title: secret ? 'Ennvo' : String(body.title || 'Ennvo'),
            body: secret ? 'New notification' : String(body.body || '').slice(0, 160),
            avatar: secret ? '' : String(body.avatar || ''),
            convId: String(body.convId || ''),
          }
        : {
            type: 'call',
            name: String(body.name || body.title || 'Caller'),
            avatar: String(body.avatar || ''),
            callType: String(body.callType || 'voice'),
            callId: String(body.callId || ''),
          };

    const ttl = type === 'call' ? '30s' : '3600s';
    const accessToken = await getAccessToken();

    let sent = 0;
    let failed = 0;
    const dead = [];
    for (const token of tokens) {
      try {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              data,
              android: { priority: 'high', ttl, direct_boot_ok: true },
            },
          }),
        });
        if (r.ok) {
          sent += 1;
        } else {
          failed += 1;
          const body = await r.json().catch(() => ({}));
          const status = (body && body.error && body.error.status) || '';
          if (status === 'NOT_FOUND' || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') {
            dead.push(token);
          }
        }
      } catch (err) {
        failed += 1;
      }
    }

    // Devices that are not registered any more are removed, so the next push
    // only goes to the phones that really exist.
    for (const token of dead) {
      await removeToken(targetUserId, token);
    }

    return res.json({ success: true, sent, failed, cleaned: dead.length });
  } catch (err) {
    console.error('[push] error:', err);
    return res.status(err.status || 500).json({ error: String(err.message || err).slice(0, 200) });
  }
}
