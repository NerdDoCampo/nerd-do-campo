// Cache versionado: muda a cada release, forçando atualização.
const CACHE_NAME = 'nerd-do-campo-1.35.1';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Só interceptamos GET. Métodos como POST/PATCH/DELETE não podem ir pro Cache
  // ('cache.put' rejeita não-GET) e devem seguir direto pra rede.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API Supabase — sempre rede, nunca cacheia
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML e JS/CSS (navegação e assets do app) — SEMPRE rede primeiro, sem cair em cache velho.
  // Isso garante que um novo deploy apareça imediatamente.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Demais estáticos (imagens, fontes, manifest) — rede com fallback ao cache.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
