const CACHE_NAME = 'amorzinho-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // Grug say: API always fresh. Assets can cache.
    if (e.request.method !== 'GET') return;

    // Grug fix: cache API items for offline (but try network first)
    if (e.request.url.includes('/api/items')) {
        e.respondWith(
            fetch(e.request)
                .then(response => {
                    // Grug say: clone response to cache
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(e.request, clone);
                    });
                    return response;
                })
                .catch(() => {
                    // Grug fix: offline fallback - return cached data
                    return caches.match(e.request);
                })
        );
        return;
    }

    // Never cache other API calls - always get fresh data
    if (e.request.url.includes('/api/')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Cache static assets
    e.respondWith(
        caches.match(e.request).then((cached) => {
            return cached || fetch(e.request);
        })
    );
});
