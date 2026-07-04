const CACHE = 'briefuk-v2';

// Pre-cache static assets known ahead of time.
// index.html is intentionally NOT pre-cached — navigation uses network-first
// so the browser always loads the latest HTML (and therefore the latest
// Vite-hashed JS bundle) when online. Stale HTML was the root cause of
// code changes not reaching users after deploys.
const PRECACHE = [
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

  // SPA navigation — network first so the app always loads the latest
  // index.html (and its hashed JS bundle) when online. Falls back to the
  // cached shell only when offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put('/', clone));
          }
          return res;
        })
        .catch(() => caches.match('/'))
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

  // Static assets (JS bundle, CSS, fonts, images) — cache first, update in background.
  // Vite content-hashes these filenames so a new deploy = new URL = cache miss = fresh fetch.
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
