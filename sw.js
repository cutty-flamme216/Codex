// Codex — service worker : l'appli fonctionne hors ligne, les recherches restent en ligne.
const SHELL = "codex-shell-v5";
const RUNTIME = "codex-runtime-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "seed.json", "vendor/html5-qrcode.min.js",
  "fonts/newsreader-latin-opsz-normal.woff2", "fonts/newsreader-latin-opsz-italic.woff2", "fonts/hanken-grotesk-latin-wght-normal.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Recherches de livres : toujours en direct.
  if (/openlibrary\.org$|googleapis\.com$/.test(url.hostname) && !url.hostname.startsWith("covers.")) return;

  // L'appli elle-même : le réseau d'abord pour recevoir les mises à jour, le cache si hors ligne.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }

  // Polices et couvertures : le cache d'abord.
  if (/fonts\.(googleapis|gstatic)\.com$|covers\.openlibrary\.org$|books\.google\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }
      catch { return hit || Response.error(); }
    }));
  }
});
