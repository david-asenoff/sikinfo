/* Работа без интернет. Правило: първо мрежата, кешът е резерв.
   Така при връзка винаги се вижда последната версия, а без връзка - последно отворената.
   Кешират се само страниците, стиловете и скриптовете на помощника от същия адрес. */
"use strict";

var CACHE = "sik-pomoshtnik-v3";
var CORE = [
  "./", "index.html", "patevoditel.html", "protokol.html", "vaprosi.html", "udostoverenia.html", "poveritelnost.html",
  "assets/style.css",
  "js/site.js", "js/guide.js", "js/protocol.js", "js/faq.js", "js/made-by-david.js",
  "js/data/sources.js", "js/data/guide-data.js", "js/data/protocols-data.js", "js/data/faq-data.js", "js/data/ballot-data.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!/\.(html|css|js)$/.test(url.pathname) && !/\/$/.test(url.pathname)) return;   // файловете за изтегляне не се кешират
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("index.html"); });
    })
  );
});
