/* ============================================================================
   Saison 1, lot 8 : la Chevauchée des Cavaliers (Mathis 3A, maquette « Modes de jeu et refonte globale » :
   « raid de la semaine : les 4 Cavaliers à la suite, avec les blessures qui restent, 3 essais »).
   - Les 4 Cavaliers de l'Eliocalypse (Corruption, Servitude, Misère, Guerre), dans leur salle de boss, à la stasis choisie.
   - Les PV perdus restent d'un Cavalier au suivant ; un héros à terre ne revient pas avant la fin de la chevauchée.
   - 3 essais par semaine de saison ; le meilleur résultat de la semaine compte (Cavaliers vaincus, puis stasis, puis tours).
   - Le combat se joue d'un coup, sur une copie de la partie, avec un hasard tiré de la semaine et de l'essai (comme le Défi
     du jour, js/defi.js) : rien n'est perdu ni gagné en dehors des récompenses ci-dessous.
   - Récompenses de la semaine, une fois par palier : un coffre par Cavalier vaincu (selon la stasis), un booster de cartes
     pour les 4, et des titres pour les 4 en stasis 5 et 10. Seulement dans la partie de saison.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));

  const CAV = (E.CHEV_BOSSES = ["arbre_mort", "fers_tyrannie", "sentence_balance", "tempete_eliocalypse"].filter((id) => D.DUNGEONS && D.DUNGEONS[id]));
  E.CHEV_TRIES = 3;
  E.CHEV_KMAX = 10;
  E.CHEV_LVL = 190; // niveau d'équipe conseillé
  const T_FULL5 = "Fléau des Cavaliers", T_FULL10 = "Cavalier de l'Apocalypse";
  const chestOf = (k) => (k >= 9 ? "coffre_douze" : k >= 7 ? "coffre_obsidienne" : k >= 4 ? "coffre_or" : k >= 2 ? "coffre_argent" : "coffre_bois");

  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const W = (S) => { const c = S.s1c; const w = E.s1cWeek(S); if (!c.chev || c.chev.w !== w) c.chev = { w, tries: [], best: null, got: {} }; return c.chev; };
  E.chevState = (S) => (s1(S) ? W(S) : null);
  E.chevLeft = (S) => (s1(S) && !E.s1cOver(S) ? Math.max(0, E.CHEV_TRIES - W(S).tries.length) : 0);
  E.chevBetter = (a, b) => !!a && (!b || a.n > b.n || (a.n === b.n && (a.k > b.k || (a.k === b.k && a.turns < b.turns))));
  E.chevScore = (r) => (r ? r.n * 1000 + r.k * 50 + Math.max(0, 200 - r.turns) / 10 : 0);

  /* la chevauchée sur une copie de la partie ; renvoie { n, k, turns, fights: [{ id, win, turns, hp }] } */
  E.chevSim = (S, k, seed) => {
    const S2 = JSON.parse(E.serialize(S));
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.hunting = false; S2.protector = null; S2.manualLive = false; S2.dungeon = null;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu; // pas de seconde chance
    const team = E.team(S2); const out = { n: 0, k, turns: 0, fights: [] };
    if (!team.length) { out.err = "Il faut au moins un héros dans l'équipe."; return out; }
    const sync = Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length);
    const hp = {}; // part des PV de chaque héros, gardée d'un Cavalier au suivant
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length, now = E.now();
    try {
      E.setRng(mulberry(seed)); E.setClock(() => now);
      for (const id of CAV) {
        const dg = D.DUNGEONS[id];
        S2.dungeon = { id, room: dg.rooms.length, stasis: k, chain: 1, t: 0, syncLvl: sync, mods: [], eliteRoom: -1, chev: 1 };
        S2.fight = null; const F = E.startFight(S2); if (!F) break;
        F.ents.forEach((e) => { if (e.side !== "c" || e.summon || !e.cid || hp[e.cid] === undefined) return;
          if (hp[e.cid] <= 0) { e.hp = 0; e.alive = false; } else e.hp = Math.max(1, Math.round(e.hpMax * hp[e.cid])); });
        if (!F.ents.some((e) => e.side === "c" && e.alive)) { out.fights.push({ id, win: false, turns: 0, hp: 0 }); break; }
        for (let g = 0; g < 200000 && !F.over && F.round <= 200; g++) E.step(S2);
        const win = F.over && F.result === "win";
        const hs = F.ents.filter((e) => e.side === "c" && !e.summon && e.cid);
        hs.forEach((e) => { hp[e.cid] = e.alive ? Math.max(0, e.hp) / Math.max(1, e.hpMax) : 0; });
        const hpPct = Math.round((100 * hs.reduce((a, e) => a + (e.alive ? Math.max(0, e.hp) : 0), 0)) / Math.max(1, hs.reduce((a, e) => a + e.hpMax, 0)));
        out.fights.push({ id, win, turns: F.round, hp: hpPct }); out.turns += F.round;
        if (!win) break; out.n++;
      }
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
    return out;
  };

  /* jouer un essai : renvoie un message d'erreur ou { r, best, rew: { cons: [], booster, title } } */
  E.chevPlay = (S, k) => {
    if (!s1(S)) return "La Chevauchée des Cavaliers se joue dans la partie de saison.";
    if (E.s1cOver(S)) return "La saison est finie.";
    k = Math.max(1, Math.min(E.CHEV_KMAX, Math.floor(+k || 1)));
    if (!E.team(S).length) return "Il faut au moins un héros dans l'équipe.";
    const C = W(S); if (C.tries.length >= E.CHEV_TRIES) return "Plus d'essai cette semaine : la prochaine chevauchée ouvre lundi.";
    const seed = (C.w * 7919 + C.tries.length * 104729 + k * 13) | 0;
    const r = E.chevSim(S, k, seed); if (r.err) return r.err;
    C.tries.push({ k, n: r.n, turns: r.turns, t: E.now() });
    const rew = { cons: [], booster: 0, title: null };
    for (let i = 1; i <= r.n; i++) { const key = `c${i}k${k}`; if (!C.got[key]) { C.got[key] = 1; const ch = chestOf(k); E.addCons(S, ch); rew.cons.push(ch); } }
    if (r.n === CAV.length && !C.got["full" + k]) { C.got["full" + k] = 1; if (E.boosterGive) rew.booster = E.boosterGive(S, 1); }
    if (r.n === CAV.length) { S.s1c.chevMax = Math.max(S.s1c.chevMax || 0, k); if (k >= 10) rew.title = T_FULL10; else if (k >= 5) rew.title = T_FULL5; }
    if (E.chevBetter(r, C.best)) C.best = { n: r.n, k, turns: r.turns };
    E.emit(S, "chev", { n: r.n, k });
    return { r, best: C.best, rew };
  };

  /* titres (de collection) et succès de la saison */
  { const t0 = E.titles; if (t0) E.titles = (S) => { const t = t0(S); const m = (S.s1c && S.s1c.chevMax) || 0;
      if (m >= 5 && !t.includes(T_FULL5)) t.push(T_FULL5); if (m >= 10 && !t.includes(T_FULL10)) t.push(T_FULL10); return t; }; }
  { const ACH = E.ACH || []; const add = (o) => { if (!ACH.some((a) => a.id === o.id)) ACH.push(Object.assign({ s1: true, cat: "Saison 1", grp: "Chevauchée des Cavaliers" }, o)); };
    [[1, "Premier galop"], [5, T_FULL5], [10, T_FULL10]].forEach(([k, nm]) => add({ id: "s1chev" + k, name: nm, desc: `Vaincre les 4 Cavaliers à la suite en stasis ${k} ou plus.`, test: (S) => E.isS1c(S) && ((S.s1c && S.s1c.chevMax) || 0) >= k, prog: (S) => [Math.min(k, (S.s1c && S.s1c.chevMax) || 0), k], kamas: k * 20000 })); }
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
