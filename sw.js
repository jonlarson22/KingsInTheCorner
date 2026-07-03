// sw.js - Service Worker with Offline Caching for Sounds & Images

// BUMP THE VERSION! This forces the browser to re-cache everything.
const CACHE_NAME = 'kings-corner-v2.1'; 

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    
    // Cache the external Confetti script so victory celebrations work in the woods!
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',

    // --- NEW: Sound Effects ---
    './sounds/draw.mp3',
    './sounds/drop-valid.mp3',
    './sounds/drop-invalid.mp3',
    './sounds/turn-notify.mp3',
    './sounds/win-round.mp3',
    './sounds/win-tournament.mp3',

    // --- NEW: App Icons (Adjust filenames to match what you put in the folder) ---
    './images/icon-192.png',
    './images/icon-512.png',
];

// 1. Install Event: Download and cache all assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching all app assets...');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting()) // Force new service worker to take over immediately
    );
});

// 2. Activate Event: Clean up old cache versions (deletes 'kings-corner-v1')
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
        }).then(() => self.clients.claim()) // Take control of open clients
    );
});

// 3. Fetch Event: Serve from cache first, fall back to network
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(res => {
            // Return cached file if found, otherwise fetch from network
            return res || fetch(e.request);
        }).catch(() => {
            // Optional: You could return a custom offline fallback here if needed
            console.warn('Fetch failed and not in cache:', e.request.url);
        })
    );
});
