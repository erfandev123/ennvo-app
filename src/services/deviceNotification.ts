/**
 * Device & Browser Notification Service
 * Supports Web Notification API + Android WebView Bridges
 */

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
          data: options.data,
        };
        const notif = new Notification(title, notifOptions);

        notif.onclick = () => {
          try {
            window.focus();
            notif.close();
          } catch (e) {}
        };
      } catch (e) {
        // Fallback for Service Worker push if standalone new Notification() throws
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon,
              badge: '/Ennvo.png',
              tag,
              data: options.data,
            });
          });
        }
      }
    }
  }
}

export const deviceNotification = new DeviceNotificationService();
