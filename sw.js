/* idlus — service worker : jeu jouable hors ligne.
   Fichiers du jeu (html/js/css/json) : réseau d'abord (les mises à jour arrivent tout de suite), cache en secours.
   Images et polices : cache d'abord (elles ne changent pas), mises en cache au fil de la partie. */
const VERSION = "2.1.34.2";
/* La version de test (/beta/) a ses propres caches : chaque service worker ne nettoie que les siens. */
const P = /\/beta\/$/.test(self.registration.scope) ? "idlus-beta-" : "idlus-";
const CORE = P + "core-" + VERSION, MEDIA = P + "media-v11";
const PRECACHE = ["./", "index.html", "css/style.css", "js/gamedata.js", "js/looks.js", "js/armes.js", "js/drops.js", "js/pieces.js", "js/data.js", "js/engine.js", "js/systems.js", "js/pets.js", "js/mounts.js", "js/idols.js", "js/renaissance.js", "js/identite.js", "js/identmon.js", "js/identboss.js", "js/archis.js", "js/chroma.js", "js/welcome.js", "js/defi.js", "js/suivi.js", "js/vie.js", "js/quetes.js", "js/verify.js", "js/save.js", "js/vendor/supabase.js", "js/online.js", "js/chat.js", "js/market.js", "js/pluie.js", "js/guilds.js", "js/codes.js", "js/fiches.js", "js/musique.js", "js/sons.js", "js/ambiance.js", "js/ui.js", "js/admin.js", "js/questui.js", "js/idees.js", "js/bugs.js", "js/builds.js", "css/quetes.css", "js/formation.js", "js/dgrank.js", "js/giga.js", "js/expeditions.js", "js/expeditionsui.js", "js/forge.js", "js/forgeui.js", "js/collections.js", "js/collui.js", "js/chromaui.js", "js/dofusui.js", "css/dofus.css", "js/alignement.js", "js/honneur.js", "js/alignui.js", "js/panel.js", "js/vente.js", "js/venteui.js", "js/foire.js", "js/foireui.js", "js/comptoirs.js", "js/comptoirsui.js", "css/expeditions.css", "css/collections.css", "css/chroma.css", "css/guildes.css", "css/communaute.css", "css/economie.css", "js/champions.js", "js/champui.js", "js/maitrise_moteur.js", "js/maitrise.js", "css/maitrise.css", "js/chasse.js", "js/alliance.js", "js/allianceui.js", "css/alliances.css", "css/ascension.css", "js/ascension.js", "js/reliques.js", "js/ascensionui.js", "js/elevage.js", "js/elevageui.js", "css/elevage.css", "js/animsorts.js", "js/animid.js", "js/decors.js", "js/carte.js", "js/guide.js", "css/guide.css", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.svg", "assets/ui/logo-nom.svg", "assets/ui/logo-embleme.svg", "js/gboss.js", "js/koli.js", "js/legendaires.js", "js/dofusp.js", "js/sram.js", "js/songe.js", "js/wboss.js", "js/songeui.js", "js/koliui.js", "js/wbossui.js"];
/* cache: "reload" : les fichiers mis de côté viennent du serveur, pas du cache HTTP du navigateur (sinon une version vieille de moins
   de 10 minutes peut être gardée pour le hors-ligne) */
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CORE).then((c) => c.addAll(PRECACHE.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
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
    /* hors ligne : la copie de CETTE version (CORE seulement, ?v= ignoré) ; la page du jeu seulement pour une navigation,
       jamais à la place d'un script ou d'un fichier de données (sinon « Unexpected token '<' ») */
    .catch(() => caches.open(CORE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
/* 3.2.2 : un clic sur une notification ramène sur le jeu */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { const c = cs.find((x) => "focus" in x); return c ? c.focus() : self.clients.openWindow("./"); }));
});
