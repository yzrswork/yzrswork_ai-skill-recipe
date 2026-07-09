const CACHE_NAME = 'jitsumu450-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  '../icons/icon-192.png',
  '../icons/icon-512.png',
  '../icons/icon-512-maskable.png'
];

const ASSET_URLS = new Set(
  ASSETS.map(path => new URL(path, self.location.href).href)
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (!ASSET_URLS.has(url.href) && url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(
      (cached) => cached ||
        fetch(event.request).then((res) => {
          if (res.ok && ASSET_URLS.has(url.href)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
    )
  );
});
