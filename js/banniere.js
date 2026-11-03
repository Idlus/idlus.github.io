/* ============================================================================
   Saison 1 : la bannière de profil (images de Mathis, ChatGPT). Une bannière par compte (S.pban), en haut du profil que
   les autres joueurs ouvrent depuis les Classements et le chat. Purement visuelle : aucune caractéristique.
   Le résumé public (js/verify.js, calculé par le serveur) la porte sur le héros principal, comme la Maîtrise du temps :
   le serveur ne montre que ce que la partie a vraiment débloqué. Fichier chargé aussi par la fonction record.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));
  const top = (S) => Math.max(0, ...((S && S.chars) || []).map((c) => c.lvl || 1));
  const B = (E.BANNERS = {
    glace: { n: "Château de glace", img: 1, rar: "c", req: "Offerte", ok: () => true },
    horloge: { n: "Village de l'Horloge", img: 2, rar: "c", req: "Offerte", ok: () => true },
    fissure: { n: "La Fissure", img: 3, rar: "r", req: "Saison 1 : un héros niveau 100", ok: (S) => s1(S) && top(S) >= 100 },
    prairie: { n: "Prairies du matin", img: 4, rar: "r", req: "Saison 1 : 30 cartes dans l'album", ok: (S) => s1(S) && !!E.cardCount && E.cardCount(S) >= 30 },
    dragon: { n: "Ciel du dragon", img: 5, rar: "e", req: "Saison 1 : un héros niveau 200", ok: (S) => s1(S) && top(S) >= 200 },
    guerre: { n: "Guerre des guildes", img: 6, rar: "l", req: "Saison 1 : jouer un Tournoi des guildes", ok: (S) => s1(S) && !!(S.tour && S.tour.best >= 0) },
  });
  E.banUrl = (id) => (B[id] ? `assets/s1/ban/${B[id].img}.webp` : "");
  E.banOk = (S, id) => !!(B[id] && B[id].ok(S));
  E.banWorn = (S) => (S && S.pban && E.banOk(S, S.pban) ? S.pban : null);
  E.banSet = (S, id) => { if (id && !E.banOk(S, id)) return "Bannière pas encore débloquée."; S.pban = id || null; return null; };
  E.banCount = (S) => [Object.keys(B).filter((id) => E.banOk(S, id)).length, Object.keys(B).length];
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
