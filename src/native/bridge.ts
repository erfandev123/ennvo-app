/**
 * Ennvo Native Android Bridge Wrapper
 * Safely wraps window.AndroidInterface and window.Android methods.
 * Exports bridge and re-exports from src/native.ts
 */

import { native, NotifMode, NativeConfigPayload, PendingCallActionPayload, PendingOpenPayload, PendingReplyItem, PendingSharePayload, AppInfoPayload } from '../native';

export { native };
export type { NotifMode, NativeConfigPayload, PendingCallActionPayload, PendingOpenPayload, PendingReplyItem, PendingSharePayload, AppInfoPayload };

export const isNative = (): boolean => {
  return native.isAvailable();
};

export const parseJson = <T = any>(str?: string | null, fallback: T = null as any): T => {
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
};

export const bridge = {
  isAvailable(): boolean {
    return native.isAvailable();
  },

  showNotification(title: string, body: string, icon?: string, type: string = 'message'): void {
    if (type === 'activity' || type === 'like' || type === 'comment' || type === 'follow') {
      native.showActivityNotification(title, body, icon);
    } else {
      native.showMessageNotification(title, body, icon);
    }
  },

  sendNotification(title: string, body: string): void {
    native.showMessageNotification(title, body);
  },

  showMessageNotification(title: string, body: string, avatar?: string, convId?: string): void {
    native.showMessageNotification(title, body, avatar, convId);
  },

  showActivityNotification(title: string, body: string, avatar?: string, url?: string): void {
    native.showActivityNotification(title, body, avatar, url);
  },

  setAuthToken(uid: string, token: string): void {
    native.setAuthToken(uid, token);
  },

  showIncomingCall(name: string, avatarUrl: string, callType: 'voice' | 'video', callId: string): void {
    native.showIncomingCall(name, avatarUrl, callType, callId);
  },

  dismissIncomingCall(): void {
    native.dismissIncomingCall();
  },

  startCall(name: string, isVideo: boolean, callId?: string): void {
    native.startCall(name, isVideo, callId);
  },

  endCall(): void {
    native.endCall();
  },

  setSpeaker(on: boolean): void {
    native.setSpeaker(on);
  },

  setPip(enabled: boolean, width: number = 9, height: number = 16): void {
    native.setPip(enabled, width, height);
  },

  setStatusBarColor(hex: string, isDark: boolean): void {
    native.setStatusBarColor(hex, isDark);
  },

  getFcmToken(): string {
    return native.getFcmToken();
  },

  getPendingReplies(): PendingReplyItem[] {
    return native.getPendingReplies();
  },

  getPendingOpen(): PendingOpenPayload | null {
    return native.getPendingOpen();
  },

  consumePendingOpen(): PendingOpenPayload | null {
    return native.consumePendingOpen();
  },

  getPendingCallAction(): PendingCallActionPayload | null {
    return native.getPendingCallAction();
  },

  setNotifMode(mode: NotifMode): void {
    native.setNotifMode(mode);
  },

  getNotifMode(): NotifMode {
    return native.getNotifMode();
  },

  setNativeConfig(config: NativeConfigPayload): void {
    native.setNativeConfig(config);
  },

  clearNativeConfig(): void {
    native.clearNativeConfig();
  },

  requestBatteryExemption(): void {
    native.requestBatteryExemption();
  },

  openNotificationSettings(): void {
    native.openNotificationSettings();
  },

  getPendingShare(): PendingSharePayload | null {
    return native.getPendingShare();
  },

  getAppInfo(): AppInfoPayload {
    return native.getAppInfo();
  },

  downloadMedia(url: string, filename: string, mime: string): boolean {
    const A = (window as any).Android || (window as any).AndroidInterface;
    if (A && typeof A.downloadMedia === 'function') {
      try {
        A.downloadMedia(url, filename, mime);
        return true;
      } catch (e) {}
    }
    return false;
  },

  openUrl(url: string): void {
    if (native.isAvailable()) {
      native.openUrl(url);
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        window.open(url, '_blank', 'noopener');
      } catch (e) {
        window.location.href = url;
      }
    }
  },

  shareText(title: string, text: string): void {
    native.shareText(title, text);
  },

  openStore(): void {
    this.openUrl('https://play.google.com/store/apps/details?id=com.ennvo.app');
  },

  reportError(message: string, stack?: string): void {
    const A = (window as any).Android || (window as any).AndroidInterface;
    if (A && typeof A.reportError === 'function') {
      try {
        A.reportError(message, stack || '');
      } catch (e) {}
    }
  },

  setUserId(uid: string): void {
    native.setUserId(uid);
  },

  exitApp(): void {
    native.exitApp();
  }
};
