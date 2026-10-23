const CACHE_NAME = 'iran-birds-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './birds_clean.json',
  './manifest.json',
  // CDN های Cropper.js
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js',
  // CDN های localForage
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // برای فایل JSON استراتژی Network-first
  if (event.request.url.endsWith('birds_clean.json') || event.request.url.endsWith('birds.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
