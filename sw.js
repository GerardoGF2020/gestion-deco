// Service worker: la app abre sin internet. Red primero (para recibir actualizaciones), caché como respaldo.
const CACHE = 'gestion-deco-v1';
const ASSETS = [
  './', 'index.html', 'css/styles.css', 'icon.svg', 'manifest.webmanifest',
  'js/app.js', 'js/core/store.js', 'js/core/drive.js', 'js/core/auth.js', 'js/core/ui.js',
  'js/data/seed-catalogo.js', 'js/modules/catalogo.js', 'js/modules/ajustes.js', 'js/modules/pendientes.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
