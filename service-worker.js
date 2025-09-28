/* Only show if you haven’t already applied 1.3.5; else keep your latest.
   Bump to 1.3.6 to force cache refresh for ui.js */

const VERSION='smallbatch-prod-1.3.6';
const CACHE=VERSION;
const ASSETS=[ /* (same list you already had, include ui.js?v=6 or current) */ ];
self.addEventListener('install', e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    for(const u of ASSETS){
      try{ await c.add(u);}catch(err){ console.warn('[SW] fail',u,err);}
    }
  })());
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k.startsWith('smallbatch-') && k!==CACHE).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  if(r.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(r);
        const cache=await caches.open(CACHE);
        cache.put(r,fresh.clone());
        return fresh;
      }catch{
        const cached=await caches.match(r);
        return cached || await caches.match('./offline.html');
      }
    })());
    return;
  }
  if(new URL(r.url).origin===location.origin){
    e.respondWith((async()=>{
      const cached=await caches.match(r);
      if(cached) return cached;
      try{
        const res=await fetch(r);
        (await caches.open(CACHE)).put(r,res.clone());
        return res;
      }catch{
        return cached || new Response('Offline',{status:503});
      }
    })());
  }
});