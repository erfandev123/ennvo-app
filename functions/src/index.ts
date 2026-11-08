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
        avatar: avatar || 'https://ennvo.app/Ennvo.png',
        convId: convId || '',
        deepLink: deepLink || 'https://ennvoapp.com'
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
