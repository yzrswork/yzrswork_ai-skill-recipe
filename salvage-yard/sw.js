const CACHE_PREFIX = "yzrs-salvage-yard-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "../icons/icon-192.png",
  "../icons/icon-512.png",
  "../icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cachedShell) => cachedShell || caches.match("./")).then((cachedShell) => cachedShell || fetch(request))
    );
    return;
  }

  // Read the precache when present; do not add unrelated runtime assets.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
