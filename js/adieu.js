/* ============================================================================
   DÉFI D'ADIEU — passage de relais vers Diablofus (Mathis 25/11/2026, maquette « Relais vers Diablofus », choix 5C) :
   7 jours, 5 objectifs personnels comptés par les événements du jeu (E.emit), pour tout le monde et sur les trois serveurs.
   Les 5 faits : titre « Témoin du Dernier Portail » dans Diablofus (le serveur lit S.adieu.done dans la partie validée,
   supabase/functions/record, mode « veteran »). Pas de DOM ici (chargé aussi par les tests). Page : js/relais.js.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; if (!E || E.ADIEU) return;
  E.ADIEU = {
    // Fenêtre de l'événement (heure de Paris) : du mercredi 25/11 à 11 h (dès la publication, choix de Mathis) au mercredi 2/12 à 12 h.
    from: Date.UTC(2026, 10, 25, 10, 0), to: Date.UTC(2026, 11, 2, 11, 0),
    GOALS: [
      { id: "win", n: "Gagner 300 combats", goal: 300 },
      { id: "dungeon", n: "Finir 5 donjons", goal: 5 },
      { id: "boss", n: "Vaincre 20 boss", goal: 20 },
      { id: "chest", n: "Ouvrir 3 coffres", goal: 3 },
      { id: "visit", n: "Visiter la page Diablofus", goal: 1 },
    ],
    TITLE: "Témoin du Dernier Portail",
  };
  const A = E.ADIEU;
  /* "avant" / "en cours" / "fini" */
  E.adieuPhase = (t = E.now()) => (t < A.from ? "avant" : t < A.to ? "en cours" : "fini");
  E.adieu = (S) => {
    if (!S.adieu || typeof S.adieu !== "object") S.adieu = { n: {}, done: 0 };
    if (!S.adieu.n || typeof S.adieu.n !== "object") S.adieu.n = {};
    return S.adieu;
  };
  E.adieuList = (S) => { const D = E.adieu(S); return A.GOALS.map((g) => { const v = Math.min(g.goal, Math.max(0, Math.floor(+D.n[g.id] || 0))); return { id: g.id, name: g.n, goal: g.goal, v, done: v >= g.goal }; }); };
  E.adieuDone = (S) => !!(S && S.adieu && S.adieu.done);
  const add = (S, id, n) => {
    if (!S || !(n > 0) || E.adieuPhase() !== "en cours") return;
    const D = E.adieu(S); if (D.done) return;
    const g = A.GOALS.find((x) => x.id === id); if (!g) return;
    D.n[id] = Math.min(g.goal, (D.n[id] || 0) + n);
    if (E.adieuList(S).every((o) => o.done)) D.done = E.now();
  };
  /* La page Diablofus (js/relais.js) compte l'objectif « visiter » */
  E.adieuVisit = (S) => add(S, "visit", 1);
  const emit0 = E.emit;
  E.emit = function (S, type, data) {
    const r = emit0.apply(this, arguments);
    try {
      if (S && S.chars && E.adieuPhase() === "en cours") {
        const d = data || {};
        if (type === "win") { add(S, "win", 1); add(S, "boss", (d.mons || []).filter((m) => m && m.boss).length); }
        else if (type === "dungeon") add(S, "dungeon", 1);
        else if (type === "chest") add(S, "chest", 1);
      }
    } catch (e) { /* jamais bloquer le jeu */ }
    return r;
  };
  /* Palier de Vétéran d'une partie (choix 2A) : 3 = Or (stasis 6 réussie ou 6 Dofus), 2 = Argent (un héros niveau 200),
     1 = Bronze (un héros niveau 50), 0 = rien. Le serveur prend la meilleure des parties validées du compte. */
  E.veteranOf = (S) => {
    const lvl = Math.max(1, ...(S.chars || []).map((c) => (c.ren > 0 ? 200 : c.lvl || 1)));
    let dof = 0; try { dof = E.DOFUS_ORDER && E.dofusOwned ? E.DOFUS_ORDER.filter((id) => E.dofusOwned(S, id)).length : 0; } catch (e) { dof = 0; }
    const stz = Math.max(0, ...Object.values(S.stasis || {}).map((x) => (x && +x.max) || 0));
    const palier = stz >= 6 || dof >= 6 ? 3 : lvl >= 200 ? 2 : lvl >= 50 ? 1 : 0;
    return { palier, lvl, dof, stz, adieu: E.adieuDone(S) };
  };
})(typeof window !== "undefined" ? window : globalThis);
