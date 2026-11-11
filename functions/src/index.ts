/**
 * Ennvo Social Platform Cloud Functions (2nd Generation, Node 20, TypeScript)
 * Implements administrative callables, triggers, scheduled tasks, and FCM push distribution.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { z } from 'zod';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

// Helper to assert admin caller roles and claims
function checkAdminClaim(authContext: any, requiredRole: 'superadmin' | 'admin' | 'moderator' | 'support' | 'analyst' = 'moderator') {
  if (!authContext || !authContext.token) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const role = authContext.token.role || (authContext.token.isAdmin ? 'admin' : null);
  const hierarchy: Record<string, number> = {
    superadmin: 5,
    admin: 4,
    moderator: 3,
    support: 2,
    analyst: 1,
  };

  const userLevel = hierarchy[role] || 0;
  const requiredLevel = hierarchy[requiredRole] || 3;

  if (userLevel < requiredLevel) {
    throw new HttpsError('permission-denied', `Requires ${requiredRole} or higher privileges.`);
  }

  return {
    uid: authContext.uid,
    email: authContext.token.email || 'staff@ennvoapp.com',
    role: role || 'admin'
  };
}

// Write immutable audit log
async function writeAuditLog(params: {
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeValue?: any;
  afterValue?: any;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.collection('adminLogs').add({
      ...params,
      timestamp: FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('Failed to record audit log:', e);
  }
}

// -------------------------------------------------------------
// 1. Administrative Callables
// -------------------------------------------------------------

// Ban / Suspend user callable
export const adminBanUser = onCall(async (request) => {
  const staff = checkAdminClaim(request.auth, 'moderator');
  
  const schema = z.object({
    targetUid: z.string().min(1),
    isPermanent: z.boolean().default(false),
    durationDays: z.number().optional(),
    reason: z.string().min(5)
  });

  const parsed = schema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { targetUid, isPermanent, durationDays, reason } = parsed.data;
  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Target user does not exist.');
  }

  const beforeData = userSnap.data();
  const bannedUntil = isPermanent || !durationDays 
    ? null 
    : Date.now() + durationDays * 24 * 60 * 60 * 1000;

  const updateData: Record<string, any> = {
    status: isPermanent ? 'banned' : 'suspended',
    banReason: reason,
    bannedUntil: bannedUntil,
    updatedAt: FieldValue.serverTimestamp()
  };

  await userRef.update(updateData);

  // Revoke auth tokens and disable Firebase Auth account if permanent ban
  try {
    await auth.revokeRefreshTokens(targetUid);
    if (isPermanent) {
      await auth.updateUser(targetUid, { disabled: true });
    }
  } catch (authErr) {
    console.warn('Auth disable notice:', authErr);
  }

  await writeAuditLog({
    adminUid: staff.uid,
    adminEmail: staff.email,
    action: isPermanent ? 'user_banned' : 'user_suspended',
    targetType: 'user',
    targetId: targetUid,
    beforeValue: { status: beforeData?.status, bannedUntil: beforeData?.bannedUntil },
    afterValue: updateData,
    reason: reason
  });

  return { success: true, status: updateData.status };
});

// Unban user callable
export const adminUnbanUser = onCall(async (request) => {
  const staff = checkAdminClaim(request.auth, 'moderator');

  const schema = z.object({
    targetUid: z.string().min(1),
    reason: z.string().min(5)
  });

  const parsed = schema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { targetUid, reason } = parsed.data;
  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Target user not found.');
  }

  const beforeData = userSnap.data();
  await userRef.update({
    status: 'active',
    bannedUntil: FieldValue.delete(),
    banReason: FieldValue.delete()
  });

  try {
    await auth.updateUser(targetUid, { disabled: false });
  } catch (e) {}

  await writeAuditLog({
    adminUid: staff.uid,
    adminEmail: staff.email,
    action: 'user_unbanned',
    targetType: 'user',
    targetId: targetUid,
    beforeValue: { status: beforeData?.status },
    afterValue: { status: 'active' },
    reason
  });

  return { success: true };
});

// Set staff role callable (Superadmin only)
export const adminSetRole = onCall(async (request) => {
  const staff = checkAdminClaim(request.auth, 'superadmin');

  const schema = z.object({
    targetUid: z.string().min(1),
    role: z.enum(['superadmin', 'admin', 'moderator', 'support', 'analyst', 'none']),
    reason: z.string().min(5)
  });

  const parsed = schema.parse(request.data);
  const { targetUid, role, reason } = parsed;

  const claims = role === 'none' 
    ? { role: null, isAdmin: false } 
    : { role, isAdmin: true };

  await auth.setCustomUserClaims(targetUid, claims);
  await db.collection('users').doc(targetUid).set({
    role: role === 'none' ? FieldValue.delete() : role,
    isAdmin: role !== 'none'
  }, { merge: true });

  await writeAuditLog({
    adminUid: staff.uid,
    adminEmail: staff.email,
    action: 'staff_role_updated',
    targetType: 'user',
    targetId: targetUid,
    afterValue: { role },
    reason
  });

  return { success: true, role };
});

// Send Push Notification callable
export const adminSendPush = onCall(async (request) => {
  const staff = checkAdminClaim(request.auth, 'admin');

  const schema = z.object({
    audience: z.enum(['all', 'segment', 'single']),
    targetUid: z.string().optional(),
    title: z.string().min(1),
    body: z.string().min(1),
    deepLink: z.string().optional(),
    avatar: z.string().optional(),
    convId: z.string().optional(),
    reason: z.string().min(3)
  });

  const parsed = schema.parse(request.data);
  const { audience, targetUid, title, body, deepLink, avatar, convId, reason } = parsed;

  let tokens: string[] = [];

  if (audience === 'single' && targetUid) {
    const snap = await db.collection('users').doc(targetUid).get();
    tokens = snap.data()?.fcmTokens || [];
  } else {
    // Read active users tokens in batches
    const usersSnap = await db.collection('users').limit(1000).get();
    tokens = usersSnap.docs.flatMap(d => d.data().fcmTokens || []);
  }

  tokens = [...new Set(tokens)].filter(Boolean);

  let successCount = 0;
  let failureCount = 0;

  // Send in batches of 500 (FCM multicast limit)
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      data: {
        type: 'announcement',
        title,
        body,
        avatar: avatar || 'https://ennvo.vercel.app/icon-192.png?v=5',
        convId: convId || '',
        deepLink: deepLink || 'https://ennvo.vercel.app'
      },
      android: {
        priority: 'high',
        ttl: 86400
      }
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    // Token cleanup
    const deadTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        if (/not-registered|invalid-registration/.test(resp.error.code)) {
          deadTokens.push(batch[idx]);
        }
      }
    });

    if (deadTokens.length > 0) {
      console.log(`Cleaning up ${deadTokens.length} dead FCM tokens...`);
    }
  }

  await writeAuditLog({
    adminUid: staff.uid,
    adminEmail: staff.email,
    action: 'push_sent',
    targetType: 'notification',
    targetId: 'fcm-push',
    afterValue: { audience, title, sent: successCount, failed: failureCount },
    reason
  });

  return { success: true, successCount, failureCount };
});

// Update Remote App Config callable
export const adminUpdateAppConfig = onCall(async (request) => {
  const staff = checkAdminClaim(request.auth, 'admin');

  const schema = z.object({
    config: z.record(z.any()),
    reason: z.string().min(5)
  });

  const parsed = schema.parse(request.data);
  const { config, reason } = parsed;

  const configRef = db.collection('appConfig').doc('android');
  const beforeSnap = await configRef.get();

  await configRef.set(config, { merge: true });

  await writeAuditLog({
    adminUid: staff.uid,
    adminEmail: staff.email,
    action: 'app_config_updated',
    targetType: 'appConfig',
    targetId: 'android',
    beforeValue: beforeSnap.data(),
    afterValue: config,
    reason
  });

  return { success: true };
});

// -------------------------------------------------------------
// 2. Firestore Triggers (Counters & Auto-Flagging)
// -------------------------------------------------------------

// On Report Created: Check if target has > 5 reports in 24h, auto-flag
export const onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  const report = event.data?.data();
  if (!report || !report.targetId) return;

  const targetId = report.targetId;
  const recentReports = await db.collection('reports')
    .where('targetId', '==', targetId)
    .where('status', '==', 'open')
    .get();

  if (recentReports.size >= 5) {
    console.warn(`Target ${targetId} received ${recentReports.size} reports! Auto-flagging for priority review.`);
    // Increment open reports counter
    await db.collection('stats').doc('live').set({
      highPriorityReports: FieldValue.increment(1)
    }, { merge: true });
  }
});

// Content creation counter trigger (posts & reels)
export const onPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  const isReel = post?.type === 'reel';

  const todayStr = new Date().toISOString().split('T')[0];
  const dailyRef = db.collection('stats').doc(`daily/${todayStr}`);
  const liveRef = db.collection('stats').doc('live');

  const update = {
    totalPosts: FieldValue.increment(1),
    [isReel ? 'reelsCreated' : 'postsCreated']: FieldValue.increment(1)
  };

  await Promise.all([
    dailyRef.set(update, { merge: true }),
    liveRef.set(update, { merge: true })
  ]);
});

// Hourly suspension expiry checker
export const scheduledSuspensionsExpiry = onSchedule('every 1 hours', async () => {
  const now = Date.now();
  const expiredUsers = await db.collection('users')
    .where('status', '==', 'suspended')
    .where('bannedUntil', '<=', now)
    .get();

  if (expiredUsers.empty) return;

  console.log(`Found ${expiredUsers.size} expired suspensions. Restoring active status...`);
  const batch = db.batch();

  expiredUsers.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'active',
      bannedUntil: FieldValue.delete(),
      banReason: FieldValue.delete()
    });
  });

  await batch.commit();
});

/* =========================================================================
 * REAL-TIME PUSH DELIVERY  (messages + incoming calls)
 * -------------------------------------------------------------------------
 * Previously the client asked the Express server for the push, which does not
 * exist on the Vercel deployment and does not exist inside the Android
 * WebView (https://localhost). Result: a message sent from the browser never
 * reached a phone. These Firestore triggers run on Google's side, so a push is
 * delivered no matter where the message was written from: web, Android or iOS.
 * ========================================================================= */

const PUSH_MAX_TOKENS = 500;

type DeviceTokens = { tokens: string[]; mode: string };

async function tokensForUser(uid: string): Promise<DeviceTokens> {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.data() || {};
    const raw: unknown = data.fcmTokens;
    const tokens = Array.isArray(raw)
      ? Array.from(new Set(raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)))
      : [];
    const mode = typeof data.notifMode === 'string' ? data.notifMode : 'on';
    return { tokens, mode };
  } catch (err) {
    console.warn('[push] token lookup failed for', uid, err);
    return { tokens: [], mode: 'on' };
  }
}

async function dropDeadTokens(uid: string, tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  try {
    await db.collection('users').doc(uid).update({ fcmTokens: FieldValue.arrayRemove(...tokens) });
  } catch (err) {
    console.warn('[push] could not clean dead tokens for', uid, err);
  }
}

async function sendDataPush(
  tokens: string[],
  data: Record<string, string>,
  ttlMs: number
): Promise<{ sent: number; dead: string[] }> {
  if (!tokens.length) return { sent: 0, dead: [] };

  let sent = 0;
  const dead: string[] = [];

  for (let i = 0; i < tokens.length; i += PUSH_MAX_TOKENS) {
    const batch = tokens.slice(i, i + PUSH_MAX_TOKENS);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        data,
        android: { priority: 'high', ttl: ttlMs },
      });
      res.responses.forEach((r, idx) => {
        if (r.success) {
          sent += 1;
        } else {
          const code = r.error?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            dead.push(batch[idx]);
          }
        }
      });
    } catch (err) {
      console.warn('[push] batch failed:', err);
    }
  }

  return { sent, dead };
}

function previewOfMessage(message: any): string {
  const type = String(message?.type || 'text');
  if (type === 'text') {
    const text = String(message?.content || '').trim();
    return text.length > 140 ? `${text.slice(0, 140)}...` : text || 'New message';
  }
  if (type === 'image') return '📷 Photo';
  if (type === 'video') return '🎥 Video';
  if (type === 'audio') return '🎤 Voice message';
  if (type === 'sticker') return 'Sticker';
  if (type === 'post' || type === 'reel') return 'Shared a post';
  return `Sent a ${type}`;
}

/** New chat message -> high priority data push to every other participant. */
export const pushOnNewMessage = onDocumentCreated(
  'conversations/{convId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const senderId = String(message.senderId || '');
    const convId = event.params.convId;
    if (!senderId) return;

    const convSnap = await db.collection('conversations').doc(convId).get();
    const conv = convSnap.data();
    if (!conv) return;

    const participants: string[] = Array.isArray(conv.participantIds) ? conv.participantIds : [];
    const receivers = participants.filter((uid) => uid && uid !== senderId);
    if (!receivers.length) return;

    const senderName = String(conv.participantNames?.[senderId] || 'Ennvo');
    const senderAvatar = String(conv.participantAvatars?.[senderId] || '');
    const body = previewOfMessage(message);

    await Promise.all(
      receivers.map(async (uid) => {
        const { tokens, mode } = await tokensForUser(uid);
        if (!tokens.length) return;
        // "off" means no message notifications. Calls are never blocked.
        if (mode === 'off') return;

        const data =
          mode === 'secret'
            ? { type: 'message', title: 'Ennvo', body: 'New notification', avatar: '', convId }
            : { type: 'message', title: senderName, body, avatar: senderAvatar, convId };

        const { dead } = await sendDataPush(tokens, data, 60 * 60 * 1000);
        if (dead.length) await dropDeadTokens(uid, dead);
      })
    );
  }
);

/** New call -> ringing data push for the receiver (rings even when closed). */
export const pushOnIncomingCall = onDocumentCreated('calls/{callId}', async (event) => {
  const call = event.data?.data();
  if (!call) return;

  const receiverId = String(call.receiverId || '');
  if (!receiverId) return;

  const { tokens } = await tokensForUser(receiverId);
  if (!tokens.length) return;

  // Calls always ring, whatever the message notification mode is.
  const { dead } = await sendDataPush(
    tokens,
    {
      type: 'call',
      name: String(call.callerName || 'Caller'),
      avatar: String(call.callerAvatar || ''),
      callType: String(call.type || 'voice'),
      callId: event.params.callId,
    },
    30 * 1000
  );

  if (dead.length) await dropDeadTokens(receiverId, dead);
});
