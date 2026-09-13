// Service Worker — Inventaire Surgelé
// Rôle : rendre l'appli installable et utilisable SANS RÉSEAU une fois
// que la page a été ouverte au moins une fois avec du réseau (ce qui
// précharge automatiquement le moteur de scan zxing-wasm et son .wasm
// en cache, en plus du shell de l'application).

const CACHE_NAME = 'inv-surgele-cache-v4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Ne bloque pas l'installation si un des fichiers du shell manque
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Ne jamais intercepter les appels vers le Google Sheet : la synchronisation
// de la base articles doit toujours passer par le réseau (elle a besoin
// d'être à jour), jamais servie depuis un cache figé.
function isSyncDataRequest(url) {
  return url.includes('docs.google.com');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (isSyncDataRequest(url)) {
    // Réseau direct, sans passer par le cache
    return;
  }

  // Stratégie cache-first avec mise en cache à la volée (runtime caching).
  // C'est ce qui permet, une fois le moteur de scan zxing-wasm chargé une
  // première fois en ligne, de le resservir depuis le cache sans réseau.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
