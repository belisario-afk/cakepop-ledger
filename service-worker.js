/* Resilient SW – Quick Wins version bump */
const VERSION='smallbatch-prod-1.3.4';
const CACHE=VERSION;

const ASSETS=[
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest?v=5',
  './assets/css/styles.css?v=5',
  './assets/js/app.js?v=5',
  './assets/js/ui.js',
  './assets/js/utils.js',
  './assets/js/auth.js',
  './assets/js/storage.js',
  './assets/js/models.js',
  './assets/js/analytics.js',
  './assets/js/charts.js',
  './assets/js/export.js',
  './assets/js/crypto.js',
  './assets/js/gist-backup.js',
  './assets/js/user-settings.js',
  './assets/js/theme.js',
  './assets/js/parallax.js',
  './assets/js/pwa.js'
];

self.addEventListener('install', e=>{
  e.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for (const url of ASSETS){
      try { await cache.add(url); }
      catch(err){ console.warn('[SW] Cache fail', url, err); }
    }
  })());
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
  const req=e.request;
  if(req.method!=='GET') return;
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(CACHE);
        cache.put(req,fresh.clone());
        return fresh;
      }catch{
        const cached=await caches.match(req);
        return cached || await caches.match('./offline.html');
      }
    })());
    return;
  }
  if(new URL(req.url).origin===location.origin){
    e.respondWith((async()=>{
      const cached=await caches.match(req);
      if(cached) return cached;
      try{
        const res=await fetch(req);
        const cache=await caches.open(CACHE);
        cache.put(req,res.clone());
        return res;
      }catch{
        return cached || new Response('Offline',{status:503});
      }
    })());
  }
});