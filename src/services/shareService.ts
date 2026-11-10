/**
 * Ennvo Native Share
 * navigator.share does not exist inside the Android WebView, so "share to
 * WhatsApp / Telegram / Gmail" silently did nothing. This module always picks
 * a working path: native Android chooser -> Web Share API -> clipboard.
 */

const getNative = (): any => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.Android || w.AndroidInterface || null;
};

export type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

export type ShareResult = 'native' | 'web' | 'copied' | false;

/**
 * Share a link / text through the best available channel.
 */
export const shareContent = async (payload: SharePayload): Promise<ShareResult> => {
  const title = payload.title || 'Ennvo';
  const text = payload.text || '';
  const url = payload.url || '';
  const combined = [text, url].filter(Boolean).join(' ').trim();

  const A = getNative();
  if (A && typeof A.shareText === 'function') {
    try {
      A.shareText(title, combined);
      return 'native';
    } catch (e) {
      /* fall through */
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'web';
    } catch (e: any) {
      if (e && e.name === 'AbortError') return 'web';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && combined) {
    try {
      await navigator.clipboard.writeText(combined);
      return 'copied';
    } catch (e) {}
  }

  return false;
};
