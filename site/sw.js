"use strict";
const CACHE_PREFIX="diario-glicemia-";
const CACHE=CACHE_PREFIX+"v4";
const APP=["./","./index.html","./logic.js","./config.js","./supabase.js","./vendor/supabase-js-2.117.2.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  const shell=APP.map(path=>new URL(path,self.registration.scope).href);
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).catch(()=>caches.match("./index.html")));
    return;
  }
  if(!shell.includes(url.href))return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
