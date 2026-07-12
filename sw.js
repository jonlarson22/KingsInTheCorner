const CACHE_NAME = 'kings-corner-v3.2'; 

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',

    './sounds/draw.mp3',
    './sounds/drop-valid.mp3',
    './sounds/drop-invalid.mp3',
    './sounds/turn-notify.mp3',
    './sounds/win-round.mp3',
    './sounds/win-tournament.mp3',

    './images/icon-192.png',
    './images/icon-512.png',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching all app assets...');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(res => {
            return res || fetch(e.request);
        }).catch(err => {
            console.warn('Fetch failed and not in cache:', e.request.url);
            throw err; 
        })
    );
});
