// Ennvo Background Service Worker for Real-Time Push & Desktop Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
      icon: data.icon || '/Ennvo.png',
      badge: '/Ennvo.png',
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
        icon: '/Ennvo.png',
        badge: '/Ennvo.png'
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
