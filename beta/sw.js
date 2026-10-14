/* 14/10/2026 : la version de test (/beta/) est fermée. Ce service worker remplace l'ancien chez ceux qui l'avaient installé :
   il efface les caches de la bêta, se désinstalle et recharge la page, qui renvoie vers le jeu. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(caches.keys()
  .then((ks) => Promise.all(ks.filter((k) => k.startsWith("idlus-beta-")).map((k) => caches.delete(k))))
  .then(() => self.registration.unregister())
  .then(() => self.clients.matchAll({ type: "window" }))
  .then((cs) => cs.forEach((c) => c.navigate(c.url)))));
