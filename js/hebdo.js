/* ============================================================================
   OBJECTIFS DE LA SEMAINE — Idlus 3.0 (Mathis 12/11/2026, « I3 ») : 5 objectifs par semaine (lundi, heure de Paris),
   tirés parmi 9 sortes à partir du numéro de la semaine (les mêmes pour tout le monde), et un coffre quand les 5 sont faits.
   Comptés par les événements du jeu (E.emit), seulement quand la 3.0 est cochée. Pas de DOM ici (chargé aussi par les tests).
   Page : Journal › Semaine (js/v3.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; if (!E || E.HEBDO) return;
  E.HEBDO = {
    N: 5,
    KINDS: [
      { id: "win", n: "Gagner des combats", goal: 600 },
      { id: "boss", n: "Vaincre des boss", goal: 40 },
      { id: "dungeon", n: "Finir des donjons", goal: 20 },
      { id: "archi", n: "Vaincre des archimonstres", goal: 3 },
      { id: "craft", n: "Fabriquer des objets", goal: 25 },
      { id: "fm", n: "Essais de forgemagie", goal: 40 },
      { id: "harvest", n: "Récolter des ressources", goal: 400 },
      { id: "chest", n: "Ouvrir des coffres", goal: 15 },
      { id: "level", n: "Gagner des niveaux", goal: 8 },
    ],
  };
  const H = E.HEBDO;
  /* semaine : 0 = celle du lundi 5 janvier 1970 ; E.defiDay compte les jours à l'heure de Paris */
  E.hebdoWk = (t) => Math.floor(((E.defiDay ? E.defiDay(t) : Math.floor((t || E.now()) / 86400000)) - 4) / 7);
  const pick = (wk) => {
    const L = H.KINDS.map((k) => k.id); let x = (wk * 2654435761) >>> 0; const out = [];
    while (out.length < H.N && L.length) { x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x9e3779b9) >>> 0; out.push(L.splice(x % L.length, 1)[0]); }
    return out;
  };
  E.hebdoOn = (S) => !!(S && S.settings && S.settings.v3);
  E.hebdo = (S) => {
    const wk = E.hebdoWk();
    if (!S.hebdo || typeof S.hebdo !== "object" || S.hebdo.wk !== wk) S.hebdo = { wk, ids: pick(wk), n: {}, got: false };
    if (!S.hebdo.n || typeof S.hebdo.n !== "object") S.hebdo.n = {};
    return S.hebdo;
  };
  E.hebdoList = (S) => { const W = E.hebdo(S); return W.ids.map((id) => { const K = H.KINDS.find((k) => k.id === id) || { id, n: id, goal: 1 }; const v = Math.min(K.goal, W.n[id] || 0); return { id, name: K.n, goal: K.goal, v, done: v >= K.goal }; }); };
  E.hebdoDone = (S) => E.hebdoList(S).every((o) => o.done);
  E.hebdoChest = (S) => { const top = S.chars.reduce((a, c) => Math.max(a, c.lvl || 1), 1); return top >= 170 ? "coffre_obsidienne" : top >= 90 ? "coffre_or" : "coffre_argent"; };
  E.hebdoClaim = (S) => {
    const W = E.hebdo(S); if (W.got) return { err: "Le coffre de la semaine est déjà pris." };
    if (!E.hebdoDone(S)) return { err: "Finis d'abord les 5 objectifs de la semaine." };
    const id = E.hebdoChest(S); W.got = true; E.addCons(S, id, 1);
    return { ok: true, id };
  };
  const add = (S, id, n) => { if (!E.hebdoOn(S) || !(n > 0)) return; const W = E.hebdo(S); if (!W.ids.includes(id)) return; W.n[id] = Math.min(1e9, (W.n[id] || 0) + n); };
  const emit0 = E.emit;
  E.emit = function (S, type, data) {
    const r = emit0.apply(this, arguments);
    try {
      if (S && E.hebdoOn(S)) {
        const d = data || {};
        if (type === "win") { add(S, "win", 1); const M = d.mons || []; add(S, "boss", M.filter((m) => m && m.boss).length); add(S, "archi", M.filter((m) => m && m.archi).length); }
        else if (type === "dungeon") add(S, "dungeon", 1);
        else if (type === "craft") add(S, "craft", 1);
        else if (type === "fm") add(S, "fm", 1);
        else if (type === "harvest") add(S, "harvest", Math.max(0, Math.floor(+d.n || 0)));
        else if (type === "chest") add(S, "chest", 1);
        else if (type === "level") add(S, "level", 1);
      }
    } catch (e) { /* jamais bloquer le jeu */ }
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
