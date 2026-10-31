// Hors ligne : on prend toujours la version du réseau si possible, sinon celle en cache.
// Le nom du cache dépend de l'adresse de l'appli : plusieurs applis peuvent partager le domaine.
const PREFIX = `cache:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}v1`;
const CORE = [
  './', 'index.html', 'css/style.css', 'css/theme.css', 'js/app.js', 'js/state.js', 'js/sync.js', 'js/text.js',
  'js/config.js', 'data/manifest.json', 'manifest.webmanifest', 'icons/icon-192.png',
];
// Anciens noms de cache des premières versions des applis (grammaire, vocabulaire) : plus utilisés nulle part.
const LEGACY = ['ng-v1', 'nv-v1'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Ne supprime que nos anciens caches : d'autres applis peuvent partager le même domaine.
      .then(keys => Promise.all(keys.filter(k => (k.startsWith(PREFIX) && k !== CACHE) || LEGACY.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      // Hors ligne : uniquement dans notre cache (pas dans ceux d'autres applis ou d'anciennes versions).
      .catch(() => caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }))),
  );
});
