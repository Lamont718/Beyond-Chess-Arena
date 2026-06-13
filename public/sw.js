// BeyondChess Arena service worker.
// Goal: make the app installable + fast on repeat loads, WITHOUT serving stale
// game data. Strategy: cache-first for hashed static assets only; everything
// else (pages, API/polling) is always fetched fresh from the network.

const CACHE = 'bca-static-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop old caches on version bump.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable, hashed Next build assets → cache-first (fast offline shell).
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Everything else (pages, /api, lobby polling, game state) → network-first so
  // moves and clocks are never stale; fall back to cache only when offline.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
