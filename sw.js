self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open('fqs-v9-10-1-pp').then(c=>c.addAll(['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'])))});
self.addEventListener('activate',e=>{clients.claim()});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})