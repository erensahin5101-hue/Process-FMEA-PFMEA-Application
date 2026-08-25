const CACHE = 'tyana-qflow-shell-v20-operator-instruction';
const SHELL = ['/', '/styles.css', '/product-universe.css', '/operator-instruction.css', '/bom-domain.js', '/master-template-domain.js', '/master-template-ui.js', '/product-definition-workspace.js', '/apqp-traceability.js', '/fmea-governance.js', '/guided-experience.js', '/app.js', '/platform-adapter.js', '/seed-processes.json', '/data/product-engineering-library.json', '/data/pfmea-engineering-library.json', '/data/bom-engineering-library.json', '/data/quality-document-library.json', '/data/operation-code-library.tr-en.v1.0.0.json', '/data/machines-master-seed.json', '/manifest.json', '/qflow-icon.svg', '/vendor/pdfmake.min.js', '/vendor/vfs_fonts.js', '/vendor/exceljs.min.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); return response; }).catch(() => caches.match('/')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; })));
});
