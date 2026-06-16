// BeyondChess Arena service worker.
// Goal: make the app installable + fast on repeat loads, WITHOUT serving stale
// game data.
//
// IMPORTANT: bump CACHE_VERSION whenever icons/manifest/offline page change so
// installed clients drop the old cache on activate. (Hashed /_next/static assets
// don't need a bump — their filenames change on every build.)
const CACHE_VERSION = 'v3';
const CACHE = `bca-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(OFFLINE_URL);
      await self.skipWaiting();
    })()
  );
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
  if (url.pathname.startsWith('/_next/static/')) {
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

  // Non-hashed static assets (icons, manifest) → stale-while-revalidate so a new
  // icon/manifest propagates on the NEXT load without a manual cache bump.
  if (/\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fetching = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fetching;
      })
    );
    return;
  }

  // Page navigations → network-first, falling back to the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
    );
    return;
  }

  // Everything else (/api, lobby polling, game state) → network-first so moves
  // and clocks are never stale; return a synthesized 503 when offline so callers'
  // error paths behave instead of receiving `undefined`.
  event.respondWith(
    fetch(req).catch(
      () =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
    )
  );
});
