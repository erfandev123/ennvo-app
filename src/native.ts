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

export interface PendingOpenPayload {
  convId: string;
}

export interface PendingCallActionPayload {
  action: 'accept' | 'decline';
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
   * Returns pending open action (e.g. chat to navigate to after notification tap)
   */
  getPendingOpen(): PendingOpenPayload | null {
    try {
      const A = getA();
      if (!A) return null;
      if (typeof A.getPendingOpen === 'function') {
        const raw = A.getPendingOpen();
        if (!raw) return null;
        return safeJsonParse<PendingOpenPayload>(raw, null as any);
      }
    } catch (e) {
      console.warn('[Native] getPendingOpen error:', e);
    }
    return null;
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
        return safeJsonParse<PendingCallActionPayload>(raw, null as any);
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
   * Show local message notification (only shown when app is not in foreground)
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
  startCall(name: string, isVideo: boolean): void {
    try {
      const A = getA();
      if (!A) return;
      if (typeof A.startCall === 'function') {
        A.startCall(name || 'Ennvo Call', !!isVideo);
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
