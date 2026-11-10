/**
 * Ennvo App Link Router + Native Share
 * -------------------------------------------------------------
 * One place that decides where every tap goes, so the app behaves like a
 * real native app instead of a browser page:
 *
 *  - tel:, mailto:, sms:, whatsapp:, geo:, market:, intent:, fb:, tg: ...
 *    -> handed to Android through the native bridge (no dead taps)
 *  - https://ennvo.vercel.app/... and /user/x, /messages/y ...
 *    -> stay INSIDE the app (deep link router), never open Chrome
 *  - any other https link -> opened in the real browser
 *  - navigator.share is missing inside Android WebView, so sharing to
 *    WhatsApp / Telegram / Gmail goes through the native Android chooser.
 */

import { openFromLink } from './deepLinkService';

/** Hosts that belong to Ennvo and must always stay inside the app. */
const APP_HOSTS = new Set<string>([
  'ennvo.vercel.app',
  'www.ennvo.vercel.app',
  'ennvo.app',
  'www.ennvo.app',
  'ennvo-6c01c.web.app',
  'ennvo-6c01c.firebaseapp.com',
]);

/**
 * Real static pages that live next to the app (public/*.html). These must be
 * opened as real pages, not routed into the React app - otherwise /about,
 * /landing, /help ... all silently land on the home screen.
 */
const STATIC_PAGES = new Set<string>([
  '/about',
  '/help',
  '/support',
  '/contact',
  '/privacy',
  '/terms',
  '/trust',
  '/press',
  '/landing',
]);

const STATIC_PREFIXES = ['/blog'];

const isStaticPagePath = (pathname: string): boolean => {
  const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (STATIC_PAGES.has(clean)) return true;
  if (clean.endsWith('.html') && clean !== '/index.html') return true;
  return STATIC_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(prefix + '/'));
};

/** Schemes that only an Android app can answer. */
const APP_SCHEMES =
  /^(tel|telprompt|mailto|sms|smsto|mms|whatsapp|geo|market|maps|intent|fb|fb-messenger|twitter|instagram|tg|viber|skype|zoommtg|youtube|vnd\.youtube|upi|line|weixin|alipay|snssdk1128|content|file):/i;

const getNative = (): any => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.Android || w.AndroidInterface || null;
};

export const isNativeApp = (): boolean => !!getNative();

const currentOrigin = (): string => {
  try {
    return window.location.origin;
  } catch (e) {
    return '';
  }
};

/**
 * True when the URL points at Ennvo itself, so it must be handled by the
 * in-app router instead of being handed to the system browser.
 */
export const isAppUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl, window.location.href);
    if (url.protocol === 'ennvo:') return true;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (APP_HOSTS.has(url.hostname.toLowerCase())) return true;
    // Capacitor serves the bundled app from https://localhost
    if (isNativeApp() && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
    if (currentOrigin() && url.origin === currentOrigin()) return true;
    return false;
  } catch (e) {
    return false;
  }
};

const toAppRoute = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (/^ennvo:\/\//i.test(trimmed)) {
    const rest = trimmed.replace(/^ennvo:\/\//i, '');
    return '/' + rest.replace(/^\/+/, '');
  }
  try {
    const url = new URL(trimmed, window.location.href);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (e) {
    return trimmed;
  }
};

/**
 * Hand a URL to Android (or the browser) the right way.
 */
export const openExternalUrl = (rawUrl: string): void => {
  if (!rawUrl) return;
  const url = rawUrl.trim();
  if (!url) return;

  const A = getNative();
  if (A && typeof A.openUrl === 'function') {
    try {
      A.openUrl(url);
      return;
    } catch (e) {
      /* fall through to the web implementation */
    }
  }

  try {
    if (/^https?:/i.test(url)) {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) window.location.href = url;
    } else {
      // tel:, mailto:, sms:, geo:, market: ... the OS handles these.
      window.location.href = url;
    }
  } catch (e) {
    try {
      window.location.href = url;
    } catch (err) {}
  }
};

/**
 * Open an Ennvo link (https or ennvo://) inside the app.
 */
export const openInApp = (rawUrl: string): void => {
  const route = toAppRoute(rawUrl);
  openFromLink(route).catch(() => {});
};

/**
 * Single entry point used by the global interceptor.
 * Returns true when the tap was handled here.
 */
export const routeUrl = (rawUrl: string): boolean => {
  const url = (rawUrl || '').trim();
  if (!url || url.startsWith('#') || /^javascript:/i.test(url)) return false;

  if (APP_SCHEMES.test(url)) {
    openExternalUrl(url);
    return true;
  }

  // Static content pages (/about, /landing, /help, /blog/...) get a real page load.
  try {
    const parsed = new URL(url, window.location.href);
    if (/^https?:$/i.test(parsed.protocol) && isStaticPagePath(parsed.pathname)) {
      const target = parsed.pathname.endsWith('.html') ? parsed.pathname : `${parsed.pathname.replace(/\/+$/, '')}.html`;
      window.location.assign(`${target}${parsed.search}${parsed.hash}`);
      return true;
    }
  } catch (e) {}

  if (/^ennvo:/i.test(url) || isAppUrl(url)) {
    openInApp(url);
    return true;
  }

  if (/^https?:/i.test(url)) {
    openExternalUrl(url);
    return true;
  }

  return false;
};

export type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

/**
 * Share through the native Android chooser when available (WhatsApp, Telegram,
 * Gmail, Messages ...), then the Web Share API, then the clipboard.
 * Implemented in shareService so this module stays free of import cycles.
 */
export { shareContent } from './shareService';

/**
 * Install the global click / window.open router once, at boot.
 */
let installed = false;

export const initAppLinks = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // 1. Every anchor tap, in the capture phase so it wins over React handlers.
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target && (target.closest ? (target.closest('a[href]') as HTMLAnchorElement | null) : null);
      if (!anchor) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.dataset.native === 'off') return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      // A link explicitly marked for the browser is never routed in-app.
      if (anchor.target === '_blank' || anchor.dataset.external === 'true') {
        if (routeUrl(href)) event.preventDefault();
        return;
      }

      // Static content pages (/about, /landing, /help, /blog/...) -> real page load.
      try {
        const parsed = new URL(href, window.location.href);
        if (/^https?:$/i.test(parsed.protocol) && isStaticPagePath(parsed.pathname)) {
          event.preventDefault();
          routeUrl(href);
          return;
        }
      } catch (e) {}

      // http(s) links that stay inside Ennvo are left to the app router.
      if (!APP_SCHEMES.test(href) && /^https?:/i.test(href) && isAppUrl(href)) {
        // Relative links are already handled by the app; absolute Ennvo links
        // are converted to an internal route so nothing leaves the WebView.
        try {
          const parsed = new URL(href, window.location.href);
          if (parsed.origin !== currentOrigin() || parsed.pathname !== window.location.pathname) {
            event.preventDefault();
            openInApp(href);
            return;
          }
          return;
        } catch (e) {
          return;
        }
      }

      if (routeUrl(href)) {
        event.preventDefault();
      }
    },
    true
  );

  // 2. window.open (share sheets, "open in browser" buttons, print views).
  const nativeOpen = window.open ? window.open.bind(window) : null;
  window.open = function patchedOpen(url?: string | URL, target?: string, features?: string) {
    const raw = typeof url === 'string' ? url : url ? String(url) : '';
    if (raw) {
      const resolved = new URL(raw, window.location.href);
      if (isStaticPagePath(resolved.pathname) && /^https?:$/i.test(resolved.protocol)) {
        routeUrl(raw);
        return null;
      }
      if (/^ennvo:/i.test(raw) || isAppUrl(raw)) {
        openInApp(raw);
        return null;
      }
      if (APP_SCHEMES.test(raw) || /^https?:/i.test(raw)) {
        openExternalUrl(raw);
        return null;
      }
    }
    return nativeOpen ? nativeOpen(url as any, target, features) : null;
  } as typeof window.open;
};

/** Small helper so the UI can send the user to any external app. */
export const openUrl = openExternalUrl;
