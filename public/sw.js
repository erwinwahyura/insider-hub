/**
 * Insider Hub - Service Worker
 * Provides offline capabilities and background sync for alerts
 */

const CACHE_NAME = 'insider-hub-v1';
const STATIC_ASSETS = [
  '/',
  '/portfolio',
  '/earnings',
  '/top-picks',
  '/daily-summary',
  '/manifest.json',
  '/favicon.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      if (response) {
        // Update cache in background
        fetch(event.request).then((fetchResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
          });
        }).catch(() => {});
        return response;
      }
      
      return fetch(event.request).then((fetchResponse) => {
        // Cache successful responses
        if (fetchResponse.ok && fetchResponse.method === 'GET') {
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchResponse;
      }).catch(() => {
        // Return offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// Background sync for alerts
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-alerts') {
    event.waitUntil(checkAlerts());
  }
});

// Periodic sync for price checks (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'price-check') {
    event.waitUntil(checkAlerts());
  }
});

// Push notifications for alerts
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || [],
        data: data.url ? { url: data.url } : undefined
      })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

async function checkAlerts() {
  // This will be triggered by the main scraper
  // The actual alert checking happens in the Node.js scraper
  // This is just for background sync capability
  console.log('Background sync: check alerts triggered');
}

// Message handler from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
