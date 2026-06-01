const CACHE_NAME = 'teacher-planner-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json?v=3',
  '/app_icon.png?v=3'
];

// Install Service Worker and cache essential shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch events: Network first, fallback to cached assets when offline
self.addEventListener('fetch', (event) => {
  // Only handle standard GET requests (ignore chrome-extension, APIs, and other methods)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle API and Firebase auth/realtime requests by letting network handle them directly
  if (event.request.url.includes('/api/') || event.request.url.includes('googleapis.com') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the fetch is successful, clone and return it, updating cached asset if matching
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If accessing the root, fallback to index
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('الاتصال بالإنترنت غير متوفر حالياً', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
  );
});
