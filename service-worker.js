const VERSION = 'smallbatch-1.3.0';
const CACHE = VERSION;
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/ui.js',
  './assets/js/utils.js',
  './assets/js/storage.js',
  './assets/js/models.js',
  './assets/js/analytics.js',
  './assets/js/charts.js',
  './assets/js/export.js',
  './assets/js/pwa.js',
  './assets/js/crypto.js',
  './assets/js/gist-backup.js',
  './assets/js/auth.js',
  './assets/js/theme.js',
  './assets/js/user-settings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k.startsWith('smallbatch-') && k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html')){
    e.respondWith((async ()=>{
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || await caches.match('./offline.html');
      }
    })());
    return;
  }
  if (new URL(req.url).origin === location.origin){
    e.respondWith((async ()=>{
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('Offline', { status:503 });
      }
    })());
  }
});