/* idlus — service worker : jeu jouable hors ligne.
   Fichiers du jeu (html/js/css/json) : réseau d'abord (les mises à jour arrivent tout de suite), cache en secours.
   Images et polices : cache d'abord (elles ne changent pas), mises en cache au fil de la partie. */
const VERSION = "0.1.12";
/* La version de test (/beta/) a ses propres caches : chaque service worker ne nettoie que les siens. */
const P = /\/beta\/$/.test(self.registration.scope) ? "idlus-beta-" : "idlus-";
const CORE = P + "core-" + VERSION, MEDIA = P + "media-v7";
const PRECACHE = ["./", "index.html", "css/style.css", "js/gamedata.js", "js/looks.js", "js/data.js", "js/engine.js", "js/systems.js", "js/pets.js", "js/mounts.js", "js/idols.js", "js/renaissance.js", "js/ui.js", "js/admin.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CORE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => (k.startsWith(P + "core-") && k !== CORE) || (k.startsWith(P + "media-") && k !== MEDIA)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const isMedia = (u) => /\/(assets|icons)\//.test(u.pathname) || /fonts\.(gstatic|googleapis)\.com$/.test(u.hostname) || (u.hostname === "static.ankama.com" && u.pathname.startsWith("/dofus/renderer/")) || u.hostname === "renderer.dofusdb.fr";
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.pathname.endsWith("version.json")) return; // toujours en ligne (détection des nouvelles versions)
  if (isMedia(u)) {
    e.respondWith(caches.open(MEDIA).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CORE).then((c) => c.put(req, cp)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))));
});
/* 3.2.2 : un clic sur une notification ramène sur le jeu */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { const c = cs.find((x) => "focus" in x); return c ? c.focus() : self.clients.openWindow("./"); }));
});
