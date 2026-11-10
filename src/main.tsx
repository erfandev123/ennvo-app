import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAppLinks } from './services/appLinks';

/* ------------------------------------------------------------------ *
 * 1. Theme first, before anything paints (no white flash in dark mode)
 * ------------------------------------------------------------------ */
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem('ennvo_theme_mode') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
}

/* ------------------------------------------------------------------ *
 * 2. External app links (tel:, mailto:, whatsapp:, browser, deep links)
 *    Installed before React so the very first tap is routed correctly.
 * ------------------------------------------------------------------ */
initAppLinks();

/* ------------------------------------------------------------------ *
 * 3. Catch internal Firestore stream assertion errors gracefully
 * ------------------------------------------------------------------ */
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message && (event.message.includes('INTERNAL ASSERTION FAILED') || event.message.includes('Unexpected state'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Caught non-fatal Firestore internal assertion error:', event.message);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (reason.includes('INTERNAL ASSERTION FAILED') || reason.includes('Unexpected state')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Caught non-fatal Firestore unhandled promise rejection:', reason);
    }
  });
}

/* ------------------------------------------------------------------ *
 * 4. Startup prefetch - the first screen and the next tab begin
 *    downloading in parallel with the first paint instead of after it.
 * ------------------------------------------------------------------ */
const idle = (fn: () => void) => {
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === 'function') ric(fn, { timeout: 1500 });
  else setTimeout(fn, 350);
};

const warmUp = () => {
  const conn = (navigator as any)?.connection;
  const slow = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));

  // The default screen. Kicked off before React renders so the chunk download
  // overlaps the main bundle parse instead of waiting for it.
  import('./pages/Reels').catch(() => {});

  if (slow) return;

  idle(() => {
    import('./pages/Messages').catch(() => {});
    import('./pages/Notifications').catch(() => {});
  });
};

warmUp();

/* ------------------------------------------------------------------ *
 * 5. Mount
 * ------------------------------------------------------------------ */
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}

/* ------------------------------------------------------------------ *
 * 6. Service worker: web only (a Capacitor WebView is already offline
 *    capable and registering there only wastes startup time).
 * ------------------------------------------------------------------ */
const isNative = typeof window !== 'undefined' && !!((window as any).Android || (window as any).AndroidInterface);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isNative) {
  window.addEventListener('load', () => {
    idle(() => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration notice:', err);
      });
    });
  });
}
