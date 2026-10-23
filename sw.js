const CACHE='quolingo-static-20261023-1';
const SCOPE=new URL('./',self.location.href);
const FILES=[
  'index.html','style.css','app.js','pwa.js','manifest.webmanifest',
  'old-testament.js','new-testament.js','chapters.js','progress.js','sharing.js',
  'bible-editions.js','bible-data/nkrv.json','bible-data/rnksv.json','cloud.js','bible-reading.js','customization.js','supabase-config.js','vendor/supabase-2.118.0.js',
  'assets/character-parts.png','assets/friends.png','assets/app-icon-192.png',
  'assets/app-icon-512.png','assets/app-icon-maskable-512.png','assets/apple-touch-icon.png','assets/favicon-32.png'
];
const PUBLIC=new Set(FILES.map(path=>new URL(path,SCOPE).pathname));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new URL(path,SCOPE).href))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('quolingo-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Cache only public app files. Auth, database and other origins use the network normally.
  if(request.method!=='GET'||url.origin!==SCOPE.origin)return;
  const navigation=request.mode==='navigate'&&(url.pathname===SCOPE.pathname||url.pathname===new URL('index.html',SCOPE).pathname);
  if(!navigation&&!PUBLIC.has(url.pathname))return;
  const key=navigation?new URL('index.html',SCOPE).href:new URL(url.pathname,SCOPE.origin).href;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(request);
      // Never store OAuth callback URLs or their authorization parameters.
      if(response.ok&&(!navigation||!url.search)){
        await cache.put(key,response.clone()).catch(()=>{});
      }
      return response;
    }catch(error){const saved=await cache.match(key);if(saved)return saved;throw error;}
  })());
});
