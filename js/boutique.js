/* ============================================================================
   BOUTIQUE DE LA SEMAINE — Idlus 3.0 (Mathis 12/11/2026, « 3A ») : 6 apparences par semaine (lundi, heure de Paris),
   payées en kamas, de 200 000 à 2 millions. Des apparences propres à la Boutique (auras et couleurs de pseudo) :
   les apparences gagnées par les succès, la stasis ou l'alignement ne s'achètent jamais. Rien ne touche aux combats.
   Elles rejoignent la Garde-robe (E.GR_AURAS, E.GR_PCOL) et restent à la partie qui les a achetées.
   Page : Marché › Boutique (js/v3.js). Pas de DOM ici (chargé aussi par les tests).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; if (!E || E.BTQ) return;
  const PRIX = { r: 200000, e: 650000, l: 2000000 };
  /* [id, nom, rareté, couleur] : la couleur dessine l'aura (css/v3.css, .gr-a-bt_*) ou le pseudo (.gr-pc-bt_*) */
  const AURAS = [
    ["bt_corail", "Corail", "r", "#ff7a6b"], ["bt_menthe", "Menthe", "r", "#7affc8"], ["bt_lavande", "Lavande", "r", "#b9a2ff"],
    ["bt_ambre", "Ambre", "r", "#ffb347"], ["bt_azur", "Azur", "e", "#4fb6ff"], ["bt_rubis", "Rubis", "e", "#ff3f6b"],
    ["bt_jade", "Jade", "e", "#3fd99a"], ["bt_aurore", "Aurore", "e", "#ff9de2"], ["bt_nuit", "Nuit étoilée", "l", "#7d5cff"],
    ["bt_soleil", "Soleil d'Astrub", "l", "#ffe066"], ["bt_abysse", "Abysse", "l", "#22e0ff"], ["bt_brasier", "Brasier", "l", "#ff5a1f"],
  ];
  const PCOLS = [
    ["bt_peche", "Pêche", "r", "#ffb39a"], ["bt_lagon", "Lagon", "r", "#5fe0d0"], ["bt_prune", "Prune", "e", "#c77dff"],
    ["bt_cerise", "Cerise", "e", "#ff5d8f"], ["bt_aube", "Aube", "l", "linear-gradient(90deg,#ffd6a5,#ff9de2,#b9a2ff)"],
    ["bt_ocean", "Océan", "l", "linear-gradient(90deg,#d9fbff,#4fb6ff,#7d5cff)"],
  ];
  E.BTQ = {
    N: 6, PRIX,
    ITEMS: AURAS.map(([id, n, rar, c]) => ({ id, n, rar, c, k: "aura", prix: PRIX[rar] })).concat(PCOLS.map(([id, n, rar, c]) => ({ id, n, rar, c, k: "pcol", prix: PRIX[rar] }))),
  };
  const B = E.BTQ;
  E.btqOwn = (S) => { if (!S.btq || typeof S.btq !== "object") S.btq = {}; if (!Array.isArray(S.btq.own)) S.btq.own = []; return S.btq.own; };
  E.btqHas = (S, id) => !!(S && S.btq && Array.isArray(S.btq.own) && S.btq.own.includes(id));
  E.btqWk = () => (E.hebdoWk ? E.hebdoWk() : Math.floor((Math.floor(E.now() / 86400000) - 4) / 7));
  /* 6 apparences de la semaine, les mêmes pour tout le monde : au moins 1 Légendaire et 1 couleur de pseudo */
  E.btqWeek = (wk = E.btqWk()) => {
    let x = ((wk + 7919) * 2246822519) >>> 0; const rnd = () => { x = (Math.imul(x ^ (x >>> 13), 3266489917) + 0x6d2b79f5) >>> 0; return x / 4294967296; };
    const L = B.ITEMS.slice(); const out = [];
    const take = (f) => { const P = L.filter(f); if (!P.length) return; const it = P[Math.floor(rnd() * P.length)]; out.push(it); L.splice(L.indexOf(it), 1); };
    take((i) => i.rar === "l"); take((i) => i.k === "pcol");
    while (out.length < B.N && L.length) take(() => true);
    return out.sort((a, b) => a.prix - b.prix || a.n.localeCompare(b.n));
  };
  E.btqBuy = (S, id) => {
    const it = E.btqWeek().find((x) => x.id === id); if (!it) return { err: "Cette apparence n'est pas dans la Boutique cette semaine." };
    if (E.btqHas(S, id)) return { err: "Tu l'as déjà." };
    if ((S.kamas || 0) < it.prix) return { err: `Il te faut ${it.prix.toLocaleString("fr-FR")} kamas.` };
    S.kamas -= it.prix; E.btqOwn(S).push(id);
    if (E.carnetGain) try { E.carnetGain(S, -it.prix, "boutique"); } catch (e) {}
    return { ok: true, it };
  };
  /* dans la Garde-robe : visibles seulement une fois achetées */
  const req = "Boutique de la semaine (Marché)";
  const add = (T, it) => { if (T && !T[it.id]) T[it.id] = { n: it.n, rar: it.rar, req, shop: true, ok: (S) => E.btqHas(S, it.id) }; };
  B.ITEMS.forEach((it) => add(it.k === "aura" ? E.GR_AURAS : E.GR_PCOL, it));
  if (E.CARNET_OUT && E.CARNET_IN) { E.CARNET_IN.boutique = "Boutique de la semaine"; E.CARNET_OUT.boutique = "Boutique de la semaine"; }
})(typeof window !== "undefined" ? window : globalThis);
