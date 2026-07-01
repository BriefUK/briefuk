const CACHE = 'briefuk-v1';

// Pre-cache the app shell assets we know ahead of time.
// Vite hashes the JS/CSS bundle names, so those are handled by runtime caching.
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Ignore non-GET, cross-origin, and Vite dev-server internal requests.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/__')) return;

  // SPA navigation — always serve the cached index.html so the app works offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match('/').then((cached) => cached || fetch(request))
    );
    return;
  }

  // API routes — network first, fall back to cached response if offline.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ items: [] }), {
                headers: { 'Content-Type': 'application/json' },
              })
          )
        )
    );
    return;
  }

  // Everything else (JS bundle, CSS, fonts, images) — cache first, fetch & update in background.
  e.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
      return cached || networkFetch;
    })
  );
});
