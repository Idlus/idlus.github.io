/* ============================================================================
   Saison 1, lot 4 : la vitrine de saison (Mathis 8A, maquette « Refonte des cosmétiques ») et la caisse gratuite du jour
   (36A, refonte de la Foire : « caisses refaites », garde-fous 38A : kamas seulement, limites).
   - Vitrine : 6 cosmétiques par semaine contre des Fragments du Temps, les mêmes pour tout le monde (tirés sur le numéro de
     la semaine) ; ce qui part revient plus tard dans la saison. Rien ne s'achète avec de l'argent, rien ne change la puissance.
   - Ce qui vient de la vitrine est lié au compte (décision du 21/10) : la partie Éternel le relit dans la partie de saison
     (S.xshop, posé au lancement par js/ui.js), comme la saison relit les exclusifs de l'Éternel (js/garderobe.js).
   - Caisse gratuite du jour : une par jour dans la partie de saison, un coffre selon le niveau de l'équipe, jamais de kamas
     à miser (pas de roulette, pas d'amélioreur : 34B et 37B).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));
  const PRIX = { r: 60, e: 120, l: 200, s: 160 };
  // k : famille de la Garde-robe ; t : titre donné ; u : déblocage (cadre)
  const V = (E.VIT = [
    { id: "v_aiguilles", k: "aura", n: "Aiguilles du Temps", rar: "r" },
    { id: "v_rouages", k: "aura", n: "Rouages", rar: "e" },
    { id: "v_horloge", k: "aura", n: "Grande Horloge", rar: "l" },
    { id: "v_tictac", k: "vic", n: "Tic-tac", rar: "r" },
    { id: "v_coucou", k: "vic", n: "Coucou de l'Horloge", rar: "e" },
    { id: "v_cadran", k: "pcol", n: "Cadran", rar: "e" },
    { id: "v_sablier", k: "pcol", n: "Sable doré", rar: "l" },
    { id: "v_gardien", k: "titre", n: "Gardien du Sablier", t: "Gardien du Sablier", rar: "r" },
    { id: "v_voyageur", k: "titre", n: "Voyageur du Temps", t: "Voyageur du Temps", rar: "e" },
    { id: "v_rouagier", k: "titre", n: "Maître des Rouages", t: "Maître des Rouages", rar: "l" },
    { id: "v_village", k: "bg", n: "Village de l'Horloge", url: "assets/s1/hub-1.webp", rar: "e" },
    { id: "v_fissure", k: "bg", n: "La Fissure", url: "assets/s1/srv-2.webp", rar: "s" },
    { id: "v_cadre", k: "cadre", n: "Cadre de l'Horloge", rar: "l" },
  ]);
  V.forEach((v) => (v.prix = PRIX[v.rar]));
  E.VIT_N = 6;
  /* ---------------- ce que possède le compte ---------------- */
  const own = (S) => Object.assign({}, (S.s1c && S.s1c.shop) || {}, S.xshop || {});
  E.vitOwned = (S, id) => !!own(S)[id];
  E.vitOf = (St) => (St && St.s1c && St.s1c.shop ? Object.assign({}, St.s1c.shop) : null); // pour la partie Éternel (js/ui.js)
  E.vitImport = (S, St) => { if (s1(S) || S.mono) return; const o = E.vitOf(St); if (o) S.xshop = o; };
  /* ---------------- la vitrine de la semaine : mêmes 6 objets pour tous ---------------- */
  const rnd = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  E.vitWeek = (S, w) => { const week = w || E.s1cWeek(S); const r = rnd(week * 7919 + 17), L = V.slice();
    for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    return L.slice(0, E.VIT_N); };
  E.vitBuy = (S, id) => {
    if (!s1(S)) return "La vitrine est dans la partie de saison.";
    const v = V.find((x) => x.id === id); if (!v) return "Objet inconnu.";
    if (!E.vitWeek(S).some((x) => x.id === id)) return "Pas dans la vitrine cette semaine.";
    if (E.vitOwned(S, id)) return "Déjà à toi.";
    const err = E.s1cSpend(S, v.prix, "vit:" + id, v.n); if (err) return err;
    (S.s1c.shop = S.s1c.shop || {})[id] = E.now();
    return null;
  };
  /* ---------------- dans la Garde-robe ---------------- */
  const req = "Vitrine de la Saison 1";
  V.forEach((v) => {
    const ok = (S) => E.vitOwned(S, v.id);
    if (v.k === "aura" && E.GR_AURAS) E.GR_AURAS[v.id] = { n: v.n, rar: v.rar, req, ok };
    if (v.k === "vic" && E.GR_VIC) E.GR_VIC[v.id] = { n: v.n, rar: v.rar, req, ok };
    if (v.k === "pcol" && E.GR_PCOL) E.GR_PCOL[v.id] = { n: v.n, rar: v.rar, req, ok };
  });
  { const t0 = E.titles; if (t0) E.titles = (S) => { const t = t0(S); V.forEach((v) => { if (v.t && E.vitOwned(S, v.id) && !t.includes(v.t)) t.push(v.t); }); return t; }; }
  { const d0 = E.grDecors; if (d0) E.grDecors = (S) => d0(S).concat(V.filter((v) => v.k === "bg").map((v) => ({ id: "v:" + v.id, n: v.n, url: v.url, rar: v.rar, req, ok: E.vitOwned(S, v.id) }))); }
  if (E.SFRAMES) E.SFRAMES.horloge = { name: () => "Cadre de l'Horloge", req, ok: (S) => E.vitOwned(S, "v_cadre") };
  if (E.titleRar) { const r0 = E.titleRar; E.titleRar = (t) => { const v = V.find((x) => x.t === t); return v ? v.rar : r0(t); }; }

  /* ---------------- caisse gratuite du jour (36A) ---------------- */
  const DAY = 86400000;
  const topLvl = (S) => Math.max(1, ...S.chars.map((c) => c.lvl || 1));
  E.freeCaseTier = (S) => { const l = topLvl(S); return l >= 180 ? "coffre_obsidienne" : l >= 120 ? "coffre_or" : l >= 50 ? "coffre_argent" : "coffre_bois"; };
  E.freeCaseLeft = (S) => { if (!s1(S)) return 0; const last = S.s1c.free || 0; return Math.floor(last / DAY) === Math.floor(E.now() / DAY) ? 0 : 1; };
  E.freeCaseOpen = (S) => {
    if (!s1(S)) return "La caisse du jour est dans la partie de saison.";
    if (!E.freeCaseLeft(S)) return "Déjà ouverte aujourd'hui : reviens demain.";
    const c = E.freeCaseTier(S); S.s1c.free = E.now(); E.addCons(S, c); return null;
  };
  E.freeCaseNext = (S) => (Math.floor(E.now() / DAY) + 1) * DAY - E.now();
  /* ---------------- contrat (35A) : des coffres d'un palier contre un coffre du palier au-dessus ----------------
     Sans hasard et toujours un peu perdant (4 en bois = 20 min de chasse contre 15 pour un en argent ; 3 pour 1 ensuite, chaque
     palier vaut le double) : c'est une façon de ranger son sac, pas de gagner. 10 contrats par jour au plus (38A). */
  E.CONTRAT = [["coffre_bois", 4, "coffre_argent"], ["coffre_argent", 3, "coffre_or"], ["coffre_or", 3, "coffre_obsidienne"], ["coffre_obsidienne", 3, "coffre_douze"]];
  E.CONTRAT_JOUR = 10;
  E.contratLeft = (S) => { if (!s1(S)) return 0; const c = S.s1c.ctr || {}; return Math.floor((c.d || 0) / DAY) === Math.floor(E.now() / DAY) ? Math.max(0, E.CONTRAT_JOUR - (c.n || 0)) : E.CONTRAT_JOUR; };
  E.contrat = (S, from) => {
    if (!s1(S)) return "Les contrats sont dans la partie de saison.";
    const r = E.CONTRAT.find((x) => x[0] === from); if (!r) return "Contrat inconnu.";
    if (!E.contratLeft(S)) return "Plus de contrat aujourd'hui : reviens demain.";
    if ((S.cons[from] || 0) < r[1]) return `Il faut ${r[1]} ${D.CONSUMABLES[from].name.toLowerCase()}s.`;
    S.cons[from] -= r[1]; E.addCons(S, r[2]);
    const c = S.s1c.ctr && Math.floor((S.s1c.ctr.d || 0) / DAY) === Math.floor(E.now() / DAY) ? S.s1c.ctr : { n: 0 };
    S.s1c.ctr = { d: E.now(), n: c.n + 1 }; return null;
  };
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
