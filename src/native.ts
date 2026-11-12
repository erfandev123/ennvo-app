/**
 * Ennvo Native Android Bridge Wrapper
 * Exposes typed, safe wrappers around window.Android and window.AndroidInterface.
 * Feature-detects native methods with safe try/catch fallbacks so web always works.
 */

export type NotifMode = 'on' | 'off' | 'secret';

export interface NativeConfigPayload {
  token: string;
  replyUrl: string;
  declineUrl: string;
}

/**
 * Normalised shape of the payload the Android shell leaves behind when a
 * notification (or deep link) is tapped while the app was not running.
 * The Java side uses short keys (`c`, `n`, `a`, `id`) to keep intents small;
 * every JS consumer only ever sees this shape.
 */
export interface PendingOpenPayload {
  type: 'chat' | 'activity' | 'link';
  convId?: string;
  name?: string;
  url?: string;
  page?: string;
}

export interface PendingCallActionPayload {
  action: 'accept' | 'decline' | 'open';
  callId: string;
  name?: string;
  type?: 'voice' | 'video' | 'audio';
  avatar?: string;
}

export interface PendingReplyItem {
  c: string; // conversationId
  t: string; // text
  n?: string; // sender name
}

export interface PendingSharePayload {
  text?: string;
  files?: Array<{
    url: string;
    mime: string;
    name: string;
  }>;
}

export interface AppInfoPayload {
  versionName: string;
  versionCode: number;
  sdk?: number;
  model?: string;
}

const getA = (): any => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.Android || w.AndroidInterface || null;
};

export const safeJsonParse = <T = any>(raw: any, fallback: T): T => {
  if (!raw) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

const normalizePendingOpen = (raw: any): PendingOpenPayload | null => {
  if (!raw || typeof raw !== 'object') return null;

  const convId = String(
    raw.convId || raw.conversationId || raw.c || ''
  ).trim();
  const url = String(raw.url || raw.link || raw.uri || '').trim();
  const name = String(raw.name || raw.n || '').trim();
  const page = raw.page || raw.screen;

  let type: PendingOpenPayload['type'] = 'activity';
  if (raw.type === 'chat' || raw.type === 'activity' || raw.type === 'link') {
    type = raw.type;
  } else if (url) {
    type = 'link';
  } else if (page === 'activity') {
    type = 'activity';
  } else if (convId) {
    type = 'chat';
  }

  // An activity notification with a direct link arrives as type=link, but it is
  // still allowed to fall through to the activity page when the URL is empty.
  if (!convId && !url && type === 'chat') type = 'activity';

  return {
    type,
    convId: convId || undefined,
    name: name || undefined,
    url: url || undefined,
    page: typeof page === 'string' ? page : undefined,
  };
};

const readPendingOpenFromNative = (): PendingOpenPayload | null => {
  try {
    const A = getA();
    if (!A || typeof A.getPendingOpen !== 'function') return null;
    const raw = A.getPendingOpen();
    if (!raw) return null;
    return normalizePendingOpen(safeJsonParse<any>(raw, null));
  } catch (e) {
    console.warn('[Native] getPendingOpen error:', e);
    return null;
  }
};

/**
 * Android consumes its pending intent the first time it is read. Cache that
 * first payload so both the store (initial page/chat) and the React effect
 * (deep-link router) can use it without losing the notification target.
 */
let cachedPendingOpen: PendingOpenPayload | null = null;
let pendingOpenPrimed = false;

export const primePendingOpen = (): PendingOpenPayload | null => {
  if (!pendingOpenPrimed) {
    pendingOpenPrimed = true;
    cachedPendingOpen = readPendingOpenFromNative();
  }
  return cachedPendingOpen;
};

export const peekPendingOpen = (): PendingOpenPayload | null => {
  return cachedPendingOpen || readPendingOpenFromNative();
};

export const takePendingOpen = (): PendingOpenPayload | null => {
  const value = cachedPendingOpen || readPendingOpenFromNative();
  cachedPendingOpen = null;
  pendingOpenPrimed = true;
  return value;
};

const normalizeCallAction = (raw: any): PendingCallActionPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const rawAction = String(raw.action || raw.a || '').toLowerCase();
  const action: PendingCallActionPayload['action'] =
    rawAction === 'accept' || rawAction === 'answer'
      ? 'accept'
      : rawAction === 'decline' || rawAction === 'reject'
        ? 'decline'
        : 'open';
  const callId = String(raw.callId || raw.id || '').trim();
  if (!callId && action !== 'open') return null;
  const type = String(raw.type || raw.callType || '').toLowerCase();
  return {
    action,
    callId,
    name: String(raw.name || raw.callName || '').trim() || undefined,
    type: type === 'video' ? 'video' : type ? 'voice' : undefined,
    avatar: String(raw.avatar || raw.callAvatar || '').trim() || undefined,
  };
};

export const native = {
  isAvailable(): boolean {
    return !!getA();
  },

  /**
   * Notification mode: "on" | "off" | "secret"
   * On: normal notifications
   * Off: no message notifications
   * Secret: shows only app name and "New notification" (no sender, no text, no avatar)
   */
  setNotifMode(mode: NotifMode): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.setNotifMode === 'function') {
        A.setNotifMode(mode);
      }
    } catch (e) {
      console.warn('[Native] setNotifMode error:', e);
    }
  },

  getNotifMode(): NotifMode {
    try {
      const A = getA();
      if (!A) return 'on';
      if (typeof A.getNotifMode === 'function') {
        const m = A.getNotifMode();
        if (m === 'off' || m === 'secret' || m === 'on') return m;
      }
    } catch (e) {}
    return 'on';
  },

  /**
   * Set long-lived device token and backend endpoints for closed-app replies/declines
   */
  setNativeConfig(config: NativeConfigPayload): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.setNativeConfig === 'function') {
        A.setNativeConfig(JSON.stringify(config));
      }
    } catch (e) {
      console.warn('[Native] setNativeConfig error:', e);
    }
  },

  clearNativeConfig(): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.clearNativeConfig === 'function') {
        A.clearNativeConfig();
      }
    } catch (e) {
      console.warn('[Native] clearNativeConfig error:', e);
    }
  },

  /**
   * Retrieve device FCM Push Token
   */
  getFcmToken(): string {
    try {
      const A = getA();
      if (!A) return '';
      if (typeof A.getFcmToken === 'function') {
        return A.getFcmToken() || '';
      }
    } catch (e) {
      console.warn('[Native] getFcmToken error:', e);
    }
    return '';
  },

  /**
   * Returns pending open action (e.g. chat to navigate to after notification tap).
   * The value is cached, so a second read does not lose the target.
   */
  getPendingOpen(): PendingOpenPayload | null {
    return peekPendingOpen();
  },

  /** Returns the pending open action once and clears it. */
  consumePendingOpen(): PendingOpenPayload | null {
    return takePendingOpen();
  },

  /**
   * Returns pending call action (accept/decline from notification button when app was closed)
   */
  getPendingCallAction(): PendingCallActionPayload | null {
    try {
      const A = getA();
      if (!A) return null;
      if (typeof A.getPendingCallAction === 'function') {
        const raw = A.getPendingCallAction();
        if (!raw) return null;
        return normalizeCallAction(safeJsonParse<any>(raw, null));
      }
    } catch (e) {
      console.warn('[Native] getPendingCallAction error:', e);
    }
    return null;
  },

  /**
   * Returns replies typed into notifications when server could not receive them directly
   */
  getPendingReplies(): PendingReplyItem[] {
    try {
      const A = getA();
      if (!A) return [];
      if (typeof A.getPendingReplies === 'function') {
        const raw = A.getPendingReplies();
        if (!raw) return [];
        return safeJsonParse<PendingReplyItem[]>(raw, []);
      }
    } catch (e) {
      console.warn('[Native] getPendingReplies error:', e);
    }
    return [];
  },

  /**
   * Keeps a fresh Firebase ID token on the native side. Notification declines
   * and quick actions can then update Firestore before the WebView has booted.
   */
  setAuthToken(uid: string, token: string): void {
    try {
      const A = getA();
      if (!A || !uid || !token) return;
      if (typeof A.setAuthToken === 'function') {
        A.setAuthToken(uid, token);
      }
    } catch (e) {
      console.warn('[Native] setAuthToken error:', e);
    }
  },

  /**
   * Show local message notification (ignored by native while app is in foreground)
   */
  showMessageNotification(title: string, body: string, avatar?: string, convId?: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.showMessageNotification === 'function') {
        A.showMessageNotification(title, body, avatar || '', convId || '');
      } else if (typeof A.showNotification === 'function') {
        A.showNotification(title, body, avatar || '', 'message');
      }
    } catch (e) {
      console.warn('[Native] showMessageNotification error:', e);
    }
  },

  /**
   * Activity notification with the actor avatar and the exact in-app target.
   * Uses a dedicated native method so the tap opens the relevant post/profile
   * instead of a generic activity list.
   */
  showActivityNotification(title: string, body: string, avatar?: string, url?: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.showActivityNotification === 'function') {
        A.showActivityNotification(title, body, avatar || '', url || '');
      } else if (typeof A.showNotification === 'function') {
        A.showNotification(title, body, avatar || '', 'activity');
      }
    } catch (e) {
      console.warn('[Native] showActivityNotification error:', e);
    }
  },

  /**
   * Color status bar and navigation bar
   */
  setStatusBarColor(hex: string, isDark: boolean): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.setStatusBarColor === 'function') {
        A.setStatusBarColor(hex, !!isDark);
      }
    } catch (e) {
      console.warn('[Native] setStatusBarColor error:', e);
    }
  },

  /**
   * Call audio & foreground service controls
   */
  startCall(name: string, isVideo: boolean, callId?: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.startCall === 'function') {
        try {
          A.startCall(name || 'Ennvo Call', !!isVideo, callId || '');
        } catch (e) {
          A.startCall(name || 'Ennvo Call', !!isVideo);
        }
      }
    } catch (e) {
      console.warn('[Native] startCall error:', e);
    }
  },

  endCall(): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.endCall === 'function') {
        A.endCall();
      }
    } catch (e) {
      console.warn('[Native] endCall error:', e);
    }
  },

  setSpeaker(on: boolean): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.setSpeaker === 'function') {
        A.setSpeaker(!!on);
      }
    } catch (e) {
      console.warn('[Native] setSpeaker error:', e);
    }
  },

  dismissIncomingCall(): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.dismissIncomingCall === 'function') {
        A.dismissIncomingCall();
      }
    } catch (e) {
      console.warn('[Native] dismissIncomingCall error:', e);
    }
  },

  showIncomingCall(name: string, avatarUrl: string, callType: 'voice' | 'video', callId: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.showIncomingCall === 'function') {
        A.showIncomingCall(name || 'Caller', avatarUrl || '', callType, callId);
      }
    } catch (e) {
      console.warn('[Native] showIncomingCall error:', e);
    }
  },

  /**
   * Request battery exemption for reliable background push on Xiaomi/Samsung/Oppo/Vivo
   */
  requestBatteryExemption(): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.requestBatteryExemption === 'function') {
        A.requestBatteryExemption();
      }
    } catch (e) {
      console.warn('[Native] requestBatteryExemption error:', e);
    }
  },

  openNotificationSettings(): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.openNotificationSettings === 'function') {
        A.openNotificationSettings();
      }
    } catch (e) {
      console.warn('[Native] openNotificationSettings error:', e);
    }
  },

  getPendingShare(): PendingSharePayload | null {
    try {
      const A = getA();
      if (!A) return null;
      if (typeof A.getPendingShare === 'function') {
        const raw = A.getPendingShare();
        return safeJsonParse<PendingSharePayload>(raw, null as any);
      }
    } catch (e) {}
    return null;
  },

  getAppInfo(): AppInfoPayload {
    try {
      const A = getA();
      if (!A) return { versionName: '1.0.0', versionCode: 1 };
      if (typeof A.getAppInfo === 'function') {
        const raw = A.getAppInfo();
        const parsed = safeJsonParse<AppInfoPayload>(raw, { versionName: '1.0.0', versionCode: 1 });
        return {
          versionName: parsed?.versionName || '1.0.0',
          versionCode: Number(parsed?.versionCode || 1),
          sdk: parsed?.sdk,
          model: parsed?.model
        };
      }
    } catch (e) {}
    return { versionName: '1.0.0', versionCode: 1 };
  },

  setUserId(uid: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.setUserId === 'function') {
        A.setUserId(uid || '');
      }
    } catch (e) {}
  },

  setPip(enabled: boolean, width: number = 9, height: number = 16): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.setPip === 'function') {
        A.setPip(!!enabled, width, height);
      }
    } catch (e) {}
  },

  /**
   * Open any URL / scheme (tel:, mailto:, sms:, whatsapp:, market:, intent:, https:)
   * with the Android system so taps never die inside the WebView.
   */
  openUrl(url: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.openUrl === 'function') {
        A.openUrl(url || '');
      }
    } catch (e) {
      console.warn('[Native] openUrl error:', e);
    }
  },

  /**
   * Share text/link through the native Android share sheet (WhatsApp, Telegram,
   * Gmail ...). The Web Share API does not exist inside a WebView.
   */
  shareText(title: string, text: string): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.shareText === 'function') {
        A.shareText(title || 'Ennvo', text || '');
      }
    } catch (e) {
      console.warn('[Native] shareText error:', e);
    }
  },

  exitApp(): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.exitApp === 'function') {
        A.exitApp();
      }
    } catch (e) {}
  }
};

// Default export matching standard bridge references
export default native;
