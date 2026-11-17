/* Caché para uso offline dentro del alcance de esta PWA.
   Al estar online se prefieren los recursos actuales: evita mantener JS obsoleto
   tras publicar una actualización en GitHub Pages. */
const CACHE='priceradar-static-v2';
const FILES=['./','./index.html','./styles.css','./manifest.webmanifest','./src/app.js','./src/core.js','./src/storage.js','./assets/logo.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('priceradar-static-') && key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    if(req.mode==='navigate')return caches.match('./index.html');
    return Response.error();
  }));
});
