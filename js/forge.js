/* ============================================================================
   LA FORGE — Idlus (1.0.30), moteur sans DOM. Chargé après systems.js (jeu et tests).
   - Soft reset des jets (choix 40A de Mathis, « plus punitif »), construit DÉSACTIVÉ : E.SOFT_RESET_ON = false.
   - Calculs de l'atelier de brisage (choix 43A) : runes attendues (Ra, Pa, simples) et leur valeur aux prix de l'HdV.
   La forgemagie plus dure près du maximum (choix 36A) est dans systems.js (E.FM_HARD), le coefficient de brisage
   de 10 % à 200 % dans engine.js (E.getCoef). L'affichage est dans js/forgeui.js.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { ITEMS, STATS, RUNE_SIMPLE_ONLY } = D;

  /* ---------------- Soft reset des jets (40A) ----------------
     Tout ce que la forgemagie a ajouté au-dessus de 80 % de la fourchette d'une caractéristique (du jet min au jet max, le « jet »
     affiché partout) est retiré : ces caractéristiques redescendent à 80 %. Le jet d'origine et les exos ne bougent pas.
     Par objet touché : les runes qui avaient fait les points retirés rendues ×1,5, un Cristal de forgemagie et 100 000 k ; une fois,
     le titre « Forgemage d'antan ». Fenêtre au prochain lancement (forgeui.js).
     Le jeu ne gardait pas le jet d'origine des objets. Règle retenue : seule la forgemagie faite avec les anciennes règles (avant la
     1.0.30) est visée. Depuis la 1.0.30, la première forgemagie d'un objet le marque (E.fmMark, systems.js) : it.fmNew pour un objet neuf (jamais
     touché par le soft reset), it.fmSnap = ses caractéristiques à ce moment pour un objet déjà forgemagé avant (on retire seulement ce
     qui dépassait 80 % à ce moment-là). Pour un objet forgemagé avant et plus touché depuis, tout ce qui dépasse 80 % compte comme
     ajouté par la forgemagie (rendu en runes ×1,5). Jamais touchés : objets jamais forgemagés (jets parfaits de la Renaissance X
     compris), objets dont l'historique ne montre que des exos, objets transcendés (ils ne se forgemagent plus), Dofus, trophées,
     légendaires, malus, caractéristiques ajoutées en exo et exos PA/PM/Po/Invocation.
     C'EST UNE MODIFICATION DES PARTIES : n'activer qu'avec les mots de Mathis. */
  E.SOFT_RESET_ON = false;
  E.SOFT_AT = 0.8; E.SOFT_RUNES = 1.5; E.SOFT_KAMAS = 100000; E.SOFT_TITLE = "Forgemage d'antan";
  const EXO_LOG = /^(Succès critique : exo \+1 |Échec critique : Rune Ga )/;
  /* objet forgemagé avec les anciennes règles ? */
  const oldFm = (it) => {
    if (it.fmNew) return false; if (it.fmSnap) return true; if (!it.fm) return false;
    const L = it.fmLog || []; if (it.fm <= L.length && L.every((l) => EXO_LOG.test(l.txt || ""))) return false; // que des exos
    return true;
  };
  /* valeur à laquelle une caractéristique redescend : l'entier le plus proche de 80 % de la fourchette (201 à 300 → 280, 8 à 12 → 11,
     3 à 4 → 4 : arrondir en dessous ferait tomber les petites fourchettes au jet minimum) ; Rayonnant : même bonus */
  E.softTarget = (it, k) => { const T = ITEMS[it.tpl]; const [mn, mx] = T.stats[k]; const lo = Math.min(mn, mx); const t = Math.round(lo + (mx - lo) * E.SOFT_AT);
    return it.radiant ? Math.ceil(t * (1 + it.radiant / 100)) : t; };
  /* runes rendues pour d points d'une caractéristique (×1,5, Ra puis Pa puis simples, arrondi au-dessus) */
  E.softRunes = (k, d, out) => {
    const s = STATS[k]; if (!s || !(d > 0)) return out; let n = Math.ceil(d * E.SOFT_RUNES / Math.max(1, s.pts) - 1e-9);
    const add = (t, q) => { if (q > 0) { const key = E.runeKey(t, k); out[key] = (out[key] || 0) + q; } };
    if (!RUNE_SIMPLE_ONLY.includes(k)) { const ra = Math.floor(n / 10); add("ra", ra); n -= ra * 10; const pa = Math.floor(n / 3); add("pa", pa); n -= pa * 3; }
    add("", n); return out;
  };
  /* caractéristiques (et jet d'un Rayonnant) après les retraits, sans toucher l'objet */
  const cutStats = (it, cut) => { const rad = it.radiant ? 1 + it.radiant / 100 : 1; const stats = Object.assign({}, it.stats), roll = it.roll ? Object.assign({}, it.roll) : null;
    for (const k in cut) { stats[k] -= cut[k]; if (roll && roll[k] !== undefined) roll[k] = Math.min(roll[k], Math.floor(stats[k] / rad)); }
    return roll ? { stats, roll } : { stats }; };
  /* ce que le soft reset ferait à un objet : null s'il n'est pas touché */
  E.softItem = (it) => {
    const T = it && ITEMS[it.tpl]; if (!T || T.trophy || T.slot === "dofus" || T.leg || it.trans || !oldFm(it)) return null;
    const cut = {}; let any = false;
    for (const k in T.stats) {
      const mx = T.stats[k][1]; if (!(mx > 0) || !STATS[k]) continue;
      const cur = it.stats[k] || 0; const ref = it.fmSnap ? Math.min(cur, it.fmSnap[k] || 0) : cur; // forgemagie faite depuis la 1.0.30 : gardée
      const d = ref - E.softTarget(it, k); if (d > 0) { cut[k] = d; any = true; }
    }
    if (!any) return null;
    const runes = {}; for (const k in cut) E.softRunes(k, cut[k], runes);
    const after = cutStats(it, cut);
    return { uid: it.uid, tpl: it.tpl, cut, runes, perfect: E.isPerfect(it), q0: E.itemQuality(it), q1: E.itemQuality(Object.assign({}, it, after)) };
  };
  const allItems = (S) => Object.values(S.items || {}).concat(Array.isArray(S.over) ? S.over : []);
  /* aperçu, sans rien changer */
  E.softResetPlan = (S) => {
    const items = allItems(S).map(E.softItem).filter(Boolean); const runes = {};
    items.forEach((x) => { for (const k in x.runes) runes[k] = (runes[k] || 0) + x.runes[k]; });
    const n = items.length;
    return { n, items, runes, runesN: Object.values(runes).reduce((a, b) => a + b, 0), cristaux: n, kamas: n * E.SOFT_KAMAS, title: n ? E.SOFT_TITLE : null };
  };
  /* applique le soft reset (une seule fois par partie, S.softReset) et renvoie le compte rendu de la fenêtre */
  E.softResetApply = (S, opts = {}) => {
    if (S.softReset && !opts.force) return null;
    const P = E.softResetPlan(S); const byUid = new Map(allItems(S).map((it) => [it.uid, it]));
    P.items.forEach((x) => {
      const it = byUid.get(x.uid); const after = cutStats(it, x.cut); it.stats = after.stats; if (after.roll) it.roll = after.roll;
      const parts = Object.keys(x.cut).map((k) => `−${x.cut[k]} ${STATS[k].name}`);
      delete it.fmSnap; it.fmNew = 1; // ce qui suit se fait avec les nouvelles règles
      x.q1 = E.itemQuality(it);
      (it.fmLog = it.fmLog || []).unshift({ t: E.now(), txt: `Remise à niveau des jets : ${parts.join(" · ")}`, ok: false, k: "sn" }); if (it.fmLog.length > 8) it.fmLog.length = 8;
      if (E.fmPlanOf && E.fmPlanOf(S, it.uid)) { const p = E.fmPlanOf(S, it.uid); p.done = "Remise à niveau des jets"; p.at = E.now(); }
    });
    for (const k in P.runes) S.runes[k] = (S.runes[k] || 0) + P.runes[k];
    if (P.n) {
      E.addCons(S, "cristal_fm", P.n); S.kamas = (S.kamas || 0) + P.kamas;
      S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(E.SOFT_TITLE)) S.titlesExtra.push(E.SOFT_TITLE);
      E.note(S, `Remise à niveau des jets : ${P.n} objet${P.n > 1 ? "s" : ""}, ${P.runesN} runes rendues, ${P.n} Cristal${P.n > 1 ? "aux" : ""} de forgemagie, ${P.kamas.toLocaleString("fr-FR")} kamas et le titre « ${E.SOFT_TITLE} ».`, "rare");
    }
    S.softReset = { at: E.now(), n: P.n, runes: P.runesN, kamas: P.kamas };
    return P;
  };
  /* au lancement (forgeui.js) : seulement si l'interrupteur est mis et pas encore fait sur cette partie */
  E.softResetCheck = (S) => { if (!E.SOFT_RESET_ON || !S || S.softReset) return null; const P = E.softResetApply(S); return P && P.n ? P : null; };

  /* ---------------- Atelier de brisage (43A) ----------------
     Le calcul des runes ne change pas (E.breakPreview, weightToRunes dans engine.js) : ici, ce qu'un brisage rend en moyenne
     (jets ×0,95 en moyenne, exo ×2), découpé en Ra, Pa et simples, et sa valeur aux prix moyens de l'HdV sur 7 jours. */
  E.BREAK_MEAN = 0.95; // moyenne du tirage 85 % à 105 % de E.breakItem
  E.breakEst = (S, uids, focus) => {
    const eq = {}, nth = {};
    (uids || []).forEach((u) => { const it = S.items[u]; if (!it) return; const p = E.breakPreview(S, u, focus || null); if (!p) return;
      const j = nth[it.tpl] = (nth[it.tpl] || 0) + 1; const drop = p.coef > 0 ? Math.max(E.COEF_MIN, p.coef - 3 * (j - 1)) / p.coef : 1; // chaque exemplaire du même objet brisé à la suite : −3 %
      const m = E.BREAK_MEAN * (it.exo ? E.EXO_BREAK_MULT : 1) * drop;
      for (const k in p.weights) { const s = STATS[k]; eq[k] = (eq[k] || 0) + p.weights[k] * m / (s.w * s.pts); } });
    return Object.keys(eq).map((k) => { let n = eq[k]; const r = { k, eq: n, ra: 0, pa: 0, s: 0 };
      if (!RUNE_SIMPLE_ONLY.includes(k)) { r.ra = Math.floor(n / 10 + 1e-9); n -= r.ra * 10; r.pa = Math.floor(n / 3 + 1e-9); n -= r.pa * 3; }
      r.s = Math.round(n); return r; }).filter((r) => r.eq >= 0.5);
  };
  const TIER_PTS = { ra: 10, pa: 3, "": 1 };
  /* prix d'une rune : prix moyen HdV de la rune, sinon celui d'une autre taille de la même caractéristique ramené aux points */
  E.runePriceOf = (prices, key) => {
    if (!prices) return null; if (prices[key] > 0) return { p: prices[key], d: false };
    const [t, k] = key.split(":"); for (const o of ["", "pa", "ra"]) { const v = prices[E.runeKey(o, k)]; if (o !== t && v > 0) return { p: v * TIER_PTS[t] / TIER_PTS[o], d: true }; }
    return null;
  };
  /* valeur d'une ligne de E.breakEst : null si aucune rune de cette caractéristique n'a de prix connu */
  E.breakRowValue = (prices, r) => { let v = 0, d = false;
    for (const t of ["ra", "pa", ""]) { const n = t === "ra" ? r.ra : t === "pa" ? r.pa : r.s; if (!n) continue; const p = E.runePriceOf(prices, E.runeKey(t, r.k)); if (!p) return null; v += n * p.p; d = d || p.d; }
    return { v, d };
  };
  /* valeur de toutes les lignes : v (lignes au prix connu), part du poids couverte (cov, 0 à 1) */
  E.breakValue = (prices, rows) => { let v = 0, w = 0, wk = 0, d = false;
    rows.forEach((r) => { const s = STATS[r.k]; const ww = r.eq * s.w * s.pts; w += ww; const x = E.breakRowValue(prices, r); if (x) { v += x.v; wk += ww; d = d || x.d; } });
    return { v, cov: w ? wk / w : 0, d };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
