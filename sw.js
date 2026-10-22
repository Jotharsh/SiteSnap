// Offline support. Change VERSION whenever any file changes, so phones fetch the new files and drop the old cache.
const VERSION = 'v2';
const CACHE = `sitesnap-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/config.js',
  'js/db.js',
  'js/ui.js',
  'js/install.js',
  'js/image.js',
  'js/speech.js',
  'js/capture.js',
  'js/theme.js',
  'js/backup.js',
  'js/files.js',
  'js/views/home.js',
  'js/views/more.js',
  'js/views/visitForm.js',
  'js/views/visit.js',
  'js/views/entry.js',
  'js/views/pdf.js',
  'js/views/settings.js',
  'js/pdf/text.js',
  'js/pdf/fonts.js',
  'js/pdf/layout.js',
  'js/pdf/render-pdf.js',
  'js/pdf/render-canvas.js',
  'js/pdf/report.js',
  'vendor/jspdf.umd.min.js',
  'fonts/Inter-Regular.ttf',
  'fonts/Inter-SemiBold.ttf',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sitesnap-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Cache first: files are served from the device, so the app opens instantly and works with no signal.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch {
      // Offline and not cached: a page navigation falls back to the app itself.
      if (request.mode === 'navigate') return (await caches.match('index.html')) ?? Response.error();
      return Response.error();
    }
  })());
});
