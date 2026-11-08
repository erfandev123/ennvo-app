// Ennvo Background Service Worker for Real-Time Push & Desktop Notifications
// Also caches the app shell so repeat opens are instant on slow networks.
const STATIC_CACHE = 'ennvo-static-v8';
const RUNTIME_CACHE = 'ennvo-runtime-v8';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(['/', '/icon-96.png']))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('ennvo-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Never cache API calls or cross-origin traffic (Firebase, R2, fonts).
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  // Static SEO pages must be served by the network, not replaced by the app shell.
  const isStaticSeoPage =
    url.pathname === '/about' ||
    url.pathname === '/about.html' ||
    url.pathname === '/help' ||
    url.pathname === '/help.html' ||
    url.pathname === '/blog' ||
    url.pathname === '/blog/' ||
    url.pathname.startsWith('/blog/');
  if (isStaticSeoPage) return;

  // App navigation: serve the cached shell instantly, refresh it in background.
  if (request.mode === 'navigate') {
    const networkPromise = fetch(request)
      .then(async (response) => {
        if (response && response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put('/', response.clone());
        }
        return response;
      })
      .catch(() => null);

    event.waitUntil(networkPromise);
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match('/');
      if (cached) return cached;
      const fresh = await networkPromise;
      return fresh || new Response('You are offline. Please reconnect.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })());
    return;
  }

  // Hashed assets and small same-origin images: cache-first.
  const isAsset = url.pathname.startsWith('/assets/');
  const isImage = /\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname);
  if (!isAsset && !isImage) return;

  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        await cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});

// Push notification event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Ennvo';
    const isCall = (data.tag && data.tag.startsWith('call-')) || data.type === 'call';

    const options = {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-96.png',
      tag: data.tag || `ennvo-${Date.now()}`,
      data: data.data || {},
      renotify: true,
      requireInteraction: isCall,
      vibrate: isCall ? [300, 150, 300, 150, 450] : [100, 50, 100]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Ennvo', {
        body: text,
        icon: '/icon-192.png',
        badge: '/icon-96.png'
      })
    );
  }
});

// Click listener to focus / open window when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
