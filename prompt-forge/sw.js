const CACHE = 'yapps-prompt-forge-v3';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('yapps-prompt-forge-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(e.request);
    if (hit) return hit;
    try {
      const resp = await fetch(e.request);
      if (resp && resp.ok && new URL(e.request.url).origin === location.origin) c.put(e.request, resp.clone());
      return resp;
    } catch (err) {
      if (e.request.mode === 'navigate') {
        const shell = await c.match('./index.html') || await c.match('./');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
