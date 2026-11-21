const CACHE_NAME = 'estatistica-v2';
const API_CACHE_NAME = 'estatistica-api-v1';
const API_TIMEOUT_MS = 7000;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './config.js',
  './FotoPerfil.jpg',
  './TipodeVariavel.png',
  './TipodeEscala.png',
  './manifest.json'
];

function fetchComTimeoutSW(request, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Instalação do Service Worker e Cache Inicial
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (e) => {
  const cachesPermitidos = [CACHE_NAME, API_CACHE_NAME];
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!cachesPermitidos.includes(key)) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const request = e.request;
  const url = new URL(request.url);

  // Pedidos que alteram dados (POST, PUT, DELETE, PATCH): sempre rede, sem cachear
  if (request.method !== 'GET') {
    e.respondWith(fetch(request));
    return;
  }

  // Pedidos GET para as APIs na Vercel: Network-First com timeout e fallback para cache
  const eApiVercel = url.hostname.endsWith('.vercel.app') && url.pathname.startsWith('/api/');
  if (eApiVercel) {
    e.respondWith(
      caches.open(API_CACHE_NAME).then(async (apiCache) => {
        try {
          const networkResponse = await fetchComTimeoutSW(request, API_TIMEOUT_MS);
          if (networkResponse && networkResponse.status === 200) {
            apiCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (erro) {
          const cachedApi = await apiCache.match(request);
          if (cachedApi) return cachedApi;
          return new Response(
            JSON.stringify({ error: 'Sem ligação e sem dados em cache disponíveis.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }
      })
    );
    return;
  }

  // Pedidos de navegação SPA (HTML): tenta rede com fallback para index.html em cache
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match('./index.html');
        })
    );
    return;
  }

  // Recursos estáticos da mesma origem: Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});