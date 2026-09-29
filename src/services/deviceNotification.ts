/**
 * Device & Browser Notification Service
 * Supports Web Notification API + Android WebView Bridges
 */

import { playNotificationSound, playIncomingRingtone } from './soundService';

export interface DeviceNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  type?: 'message' | 'like' | 'comment' | 'follow' | 'activity';
}

class DeviceNotificationService {
  private hasPrompted = false;

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Check if Android Native bridge handles notifications
    if (typeof (window as any).Android?.requestNotificationPermission === 'function') {
      try {
        (window as any).Android.requestNotificationPermission();
      } catch (e) {}
    }

    if (!('Notification' in window)) return false;

    if ((Notification.permission as string) === 'granted') return true;

    if ((Notification.permission as string) !== 'denied' && !this.hasPrompted) {
      this.hasPrompted = true;
      try {
        const result = await Notification.requestPermission();
        return result === 'granted';
      } catch (err) {
        console.warn('Failed to request notification permission:', err);
      }
    }

    return (Notification.permission as string) === 'granted';
  }

  public show(options: DeviceNotificationOptions): void {
    if (typeof window === 'undefined') return;

    const title = options.title || 'Ennvo';
    const body = options.body || '';
    const icon = options.icon || '/Ennvo.png';
    const tag = options.tag || `ennvo-${Date.now()}`;
    const type = options.type || 'activity';

    const isCall = tag.startsWith('call-') || type === ('call' as any);

    // Play sound on notification / call
    try {
      if (isCall) {
        playIncomingRingtone();
      } else {
        playNotificationSound();
      }
    } catch (e) {}

    // 1. Comprehensive Android WebView Native Java Bridge Support
    try {
      const win = window as any;
      if (typeof win.AndroidInterface?.showNotification === 'function') {
        win.AndroidInterface.showNotification(title, body, icon, type);
        return;
      }
      if (typeof win.AndroidInterface?.sendNotification === 'function') {
        win.AndroidInterface.sendNotification(title, body);
        return;
      }
      if (typeof win.Android?.showNotification === 'function') {
        win.Android.showNotification(title, body, type);
        return;
      }
      if (typeof win.AndroidNotification?.push === 'function') {
        win.AndroidNotification.push(title, body);
        return;
      }
      if (typeof win.NativeApp?.showNotification === 'function') {
        win.NativeApp.showNotification(title, body);
        return;
      }
      if (typeof win.JSBridge?.postMessage === 'function') {
        win.JSBridge.postMessage(JSON.stringify({ type: 'notification', title, body, notificationType: type }));
        return;
      }
      if (typeof win.AndroidBridge?.postMessage === 'function') {
        win.AndroidBridge.postMessage(
          JSON.stringify({ type: 'notification', title, body, notificationType: type })
        );
        return;
      }
      if (typeof win.webkit?.messageHandlers?.notification?.postMessage === 'function') {
        win.webkit.messageHandlers.notification.postMessage({ title, body, type });
        return;
      }
    } catch (e) {
      console.warn('Android bridge notification dispatch warning:', e);
    }

    // Trigger device vibration if available
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'activity' || type === 'message') {
          navigator.vibrate([120, 80, 120]);
        }
      }
    } catch (e) {}

    // 2. Standard Web Notification API
    if ('Notification' in window && (Notification.permission as string) === 'granted') {
      try {
        const notifOptions: any = {
          body,
          icon,
          badge: '/Ennvo.png',
          tag,
          renotify: true,
          silent: false,
          requireInteraction: isCall,
          vibrate: isCall ? [300, 150, 300, 150, 450] : [100, 50, 100],
          data: options.data,
        };
        const notif = new Notification(title, notifOptions);

        notif.onclick = () => {
          try {
            window.focus();
            if (options.data?.url) {
              window.location.href = options.data.url;
            }
            notif.close();
          } catch (e) {}
        };
      } catch (e) {
        // Fallback for Service Worker push if standalone new Notification() throws
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            const isCall = tag.startsWith('call-') || type === ('call' as any);
            const swOptions: any = {
              body,
              icon,
              badge: '/Ennvo.png',
              tag,
              requireInteraction: isCall,
              vibrate: isCall ? [300, 150, 300, 150, 450] : [100, 50, 100],
              data: options.data,
            };
            reg.showNotification(title, swOptions);
          });
        }
      }
    } else if ('Notification' in window && (Notification.permission as string) === 'default') {
      // Prompt user politely for future notifications
      this.requestPermission();
    }
  }
}

export const deviceNotification = new DeviceNotificationService();
