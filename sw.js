const CACHE_NAME = 'cheki-deco-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// インストール時に静的ファイルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// オフライン時はキャッシュからリソースを返す
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
