const CACHE_NAME = 'eventlens-static-v1';
const MODEL_CACHE_NAME = 'eventlens-models-v1';

// Static assets to cache immediately during installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/logo192.png',
  '/logo512.png'
];

// Install event: cache initial shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-cache assets loading skipped:', err);
      });
    })
  );
});

// Activate event: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== MODEL_CACHE_NAME) {
            console.log('[Service Worker] Erasing deprecated cache store:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: intercept network loads and serve from cache/fetch accordingly
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // We only intercept standard GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. Bypass dynamic API routes and Cloudinary media uploads entirely
  if (url.pathname.startsWith('/api') || url.hostname.includes('cloudinary.com')) {
    return;
  }

  // 2. Cache-First Strategy for external CDNs (Face-API models & Zip compression libraries)
  const isCDN = url.hostname.includes('cdn.jsdelivr.net') || 
                url.hostname.includes('cdnjs.cloudflare.com') ||
                url.pathname.includes('vladmandic');

  if (isCDN) {
    event.respondWith(
      caches.open(MODEL_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('[Service Worker] CDN load failed offline:', err);
            throw err;
          });
        });
      })
    );
    return;
  }

  // 3. Network-First, Cache-Fallback Strategy for same-origin client assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Store successful GET responses in runtime cache
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network is offline/unavailable, serve from local cache storage
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If offline navigation fails, fallback to root shell
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});
