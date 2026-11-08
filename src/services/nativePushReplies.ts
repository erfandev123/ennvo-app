/**
 * Native FCM Push Token Sync, Silent Quick Reply & Device Token Registration Handler
 */

import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { native, PendingReplyItem } from '../native';
import { sendMessage } from './chatService';
import { useAppStore } from '../store';

let activeUid: string | null = null;
let currentFcmToken: string | null = null;
let currentDeviceToken: string | null = null;

export const registerDeviceWithBackend = async (uid: string, fcmToken: string, notifMode: 'on' | 'off' | 'secret' = 'on') => {
  if (!uid || !fcmToken) return null;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch('/api/native/register-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: uid,
        fcmToken: fcmToken.trim(),
        notifMode
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.deviceToken) {
        currentDeviceToken = data.deviceToken;
        // Tell native bridge the device token and backend endpoints for reply / call decline
        native.setNativeConfig({
          token: data.deviceToken,
          replyUrl: `${origin}/api/native/reply`,
          declineUrl: `${origin}/api/native/call-decline`,
        });
        return data.deviceToken;
      }
    }
  } catch (err) {
    console.warn('[NativePush] Failed registering device with backend:', err);
  }
  return null;
};

export const registerNativePushAndReplies = (uid: string) => {
  if (!uid) return;
  activeUid = uid;

  const w = window as any;

  // Initialize notification mode from user profile
  const syncNotifMode = async () => {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const mode = userSnap.data()?.notifMode || 'on';
        native.setNotifMode(mode);
      }
    } catch (e) {}
  };
  syncNotifMode();

  // 1. Save token helper
  const handleSaveToken = async (token?: string | null) => {
    if (!token || typeof token !== 'string' || token.trim().length === 0) return;
    const cleanToken = token.trim();
    currentFcmToken = cleanToken;

    // Save FCM token to Firestore user document
    try {
      await updateDoc(doc(db, 'users', uid), {
        fcmTokens: arrayUnion(cleanToken)
      });
    } catch (e) {
      console.warn('[NativePush] Failed to register FCM token in Firestore:', e);
    }

    // Register with Express backend for deviceToken and notification callbacks
    const currentMode = native.getNotifMode();
    await registerDeviceWithBackend(uid, cleanToken, currentMode);
  };

  // Wire up window.onFcmToken callback (called by Android when token is generated or refreshed)
  w.onFcmToken = (token: string) => {
    handleSaveToken(token);
  };

  // Read current token if already available from native
  const initialToken = native.getFcmToken();
  if (initialToken) {
    handleSaveToken(initialToken);
  }

  // 2. Wire up window.onNotificationOpen callback (opens right chat from notification)
  w.onNotificationOpen = () => {
    try {
      const p = native.getPendingOpen();
      if (p && p.convId) {
        const store = useAppStore.getState();
        store.setActiveChat(p.convId);
        store.pushPage('messages');
      }
    } catch (e) {
      console.warn('[NativePush] onNotificationOpen error:', e);
    }
  };

  // Run on startup cold-start too
  setTimeout(() => {
    if (w.onNotificationOpen) {
      w.onNotificationOpen();
    }
  }, 500);

  // 3. Wire up silent quick replies from native notification
  w.__replyQ = w.__replyQ || [];

  w.__flushReplies = async () => {
    try {
      const pendingFromBridge = native.getPendingReplies();
      if (Array.isArray(pendingFromBridge) && pendingFromBridge.length > 0) {
        pendingFromBridge.forEach((item) => {
          if (item && item.c && item.t) {
            w.__replyQ.push(item);
          }
        });
      }

      const rawQ = [...w.__replyQ];
      w.__replyQ = [];

      for (const item of rawQ) {
        if (item && item.c && item.t && activeUid) {
          try {
            await sendMessage(item.c, activeUid, 'text', item.t);
          } catch (sendErr) {
            console.warn('[NativePush] Failed to send silent quick reply:', sendErr);
          }
        }
      }
    } catch (err) {
      console.warn('[NativePush] Error in __flushReplies:', err);
    }
  };

  // Flush once immediately after login in case replies were queued while app was closed
  w.__flushReplies();
};

export const unregisterNativePush = async (uid: string) => {
  native.clearNativeConfig();
  if (currentFcmToken && uid) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        fcmTokens: arrayRemove(currentFcmToken)
      });
    } catch (e) {
      console.warn('[NativePush] Failed to remove FCM token on logout:', e);
    }
  }
  activeUid = null;
  currentFcmToken = null;
  currentDeviceToken = null;
};
