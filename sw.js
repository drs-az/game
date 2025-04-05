self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('sgm-store').then(cache => {
      return cache.addAll([
        './index.html',
        './main.js',
        './manifest.json'
        // Add additional assets like CSS or icons as needed.
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
