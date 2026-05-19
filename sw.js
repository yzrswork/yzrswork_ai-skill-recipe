const CACHE_NAME = 'memo-v1';
const ASSETS = [
  './',
  './memo.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

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
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 外部CDN（JSZip等）はキャッシュせず素通り
  if (url.origin !== self.location.origin) {
    return;
  }

  // GET以外は素通り
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // 成功レスポンスのみキャッシュに追加
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // ネットワーク失敗時：HTMLリクエストならmemo.htmlを返す
          if (event.request.destination === 'document') {
            return caches.match('./memo.html');
          }
        });
    })
  );
});

// === キャッシュ更新ルール ===
// memo.html や manifest.json を更新したら CACHE_NAME を bump すること
// 例: 'memo-v1' → 'memo-v2'
