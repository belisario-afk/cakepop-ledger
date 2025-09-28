const VERSION = 'smallbatch-fix-1.3.2';
const CACHE = VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest?v=2',
  './offline.html',
  './assets/css/styles.css',
  './assets/js/app.js?v=3',
  './assets/js/ui.js',
  './assets/js/auth.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
  // Add other JS modules you actually use
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
  if (req.mode === 'navigate'){
    e.respondWith((async ()=>{
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || Response.redirect('./offline.html');
      }
    })());
    return;
  }
  if (new URL(req.url).origin === location.origin){
    e.respondWith(
      caches.match(req).then(cached=>cached || fetch(req).then(r=>{
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return r;
      }).catch(()=>cached || new Response('Offline', {status:503})))
    );
  }
});