/* ============================================================================
   KOLIZÉUM — Idlus (0.1.44)
   Arène 3 contre 3 : ton équipe d'arène contre celle d'un autre joueur (ou d'un Fantôme), jouée par l'IA.
   Le combat lui-même est dans le moteur (E.koliSetup, combat d'équipes) ; ici : l'état dans la partie,
   les tickets, la cote, les grades, les saisons d'une semaine, les Fantômes, les Kolizetons et la boutique.
   Pas de DOM : le serveur (fonction « record ») charge ce fichier pour rejouer les combats.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; const D = root.DATA;
  if (!E || !D) return;
  const { CLASSES, ITEMS } = D;

  const K = Object.assign(E.KOLI, {
    daily: 10, tkMax: 30, start: 1000, elo: 32, ghostMul: 0.5, defLoss: 0.5, defWin: 0.25, minWeek: 5,
    purseK: 60, dust: 2, kzWin: 3, kzLoss: 1, kzDef: 1, chance: 20, logMax: 30, freeRefresh: 1,
  });
  E.KOLI_TICKET = "ticket_koli";
  E.KOLI_CUR = "kolizetons";
  D.CONSUMABLES[E.KOLI_TICKET] = { name: "Ticket de Koli", icon: "🎟", img: "ticket_koli", kind: "util", auto: true,
    desc: `Un combat classé au Kolizéum. ${K.daily} tickets offerts chaque jour (jusqu'à ${K.tkMax} en réserve). On en trouve aussi dans les coffres.` };

  /* ---------- grades ---------- */
  E.KOLI_GRADES = [
    { id: "bronze", name: "Bronze", min: 0, kz: 10, cons: "coffre_bois" },
    { id: "argent", name: "Argent", min: 1100, kz: 20, cons: "coffre_argent" },
    { id: "or", name: "Or", min: 1300, kz: 35, cons: "coffre_or", title: "Gladiateur" },
    { id: "cristal", name: "Cristal", min: 1500, kz: 50, cons: "coffre_or", orn: "koli" },
    { id: "diamant", name: "Diamant", min: 1700, kz: 70, cons: "coffre_obsidienne", title: "Champion du Kolizéum" },
    { id: "legende", name: "Légende", min: Infinity, kz: 100, cons: "coffre_douze", title: "Légende du Kolizéum", top: 3 },
  ];
  E.koliGrade = (cote, top) => (top ? E.KOLI_GRADES[5] : E.KOLI_GRADES.slice(0, 5).filter((g) => cote >= g.min).pop());
  E.koliNext = (cote) => E.KOLI_GRADES.slice(0, 5).find((g) => g.min > cote) || null;

  /* ---------- semaines (lundi 00:00, heure de Paris) ---------- */
  E.koliWeek = (t = E.now()) => Math.floor((E.defiDay(t) + 3) / 7);
  E.koliLeft = (t = E.now()) => { const d = E.defiDay(t); const end = (E.koliWeek(t) + 1) * 7 - 3; return (end - d - 1) * 86400000 + E.defiLeft(t); };

  /* ---------- cote (Elo) ---------- */
  E.koliExp = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  /* points gagnés et perdus en attaquant b avec la cote a (Fantôme : moitié) */
  E.koliStakes = (a, b, ghost) => { const p = E.koliExp(a, b); const m = ghost ? K.ghostMul : 1; return { win: Math.max(1, Math.round(K.elo * (1 - p) * m)), lose: Math.max(1, Math.round(K.elo * p * m)) }; };

  /* ---------- état dans la partie ---------- */
  E.koliState = (S, now = E.now()) => {
    const day = E.defiDay(now); const w = E.koliWeek(now);
    if (!S.koli) S.koli = { v: 1, team: [], cote: K.start, best: K.start, win: 0, loss: 0, n: 0, w, day: -1, log: [], rf: 0, paidW: -1, defSeen: 0 };
    const Q = S.koli; S.tokens = S.tokens || {}; S.cons = S.cons || {};
    if (Q.day !== day) { // tickets du jour : +10 par jour écoulé, jusqu'à 30 en réserve
      const days = Q.day < 0 ? 1 : Math.min(K.tkMax, day - Q.day); const have = S.cons[E.KOLI_TICKET] || 0;
      if (have < K.tkMax) S.cons[E.KOLI_TICKET] = Math.min(K.tkMax, have + K.daily * days);
      Q.day = day; Q.rf = 0;
    }
    if (Q.w !== w) E.koliSettle(S, w);
    delete Q.opp;
    Q.team = (Q.team || []).filter((id) => S.chars.some((c) => c.id === id));
    if (!Q.team.length) Q.team = E.team(S).slice().sort((a, b) => b.lvl - a.lvl).slice(0, K.size).map((c) => c.id);
    return Q;
  };
  E.koliTickets = (S) => (S.cons && S.cons[E.KOLI_TICKET]) || 0;
  E.koliKz = (S) => (S.tokens && S.tokens[E.KOLI_CUR]) || 0;
  E.koliArena = (S) => E.koliState(S).team.map((id) => S.chars.find((c) => c.id === id)).filter(Boolean);
  E.koliSetTeam = (S, ids) => {
    const ok = (ids || []).filter((id, i, a) => a.indexOf(id) === i && S.chars.some((c) => c.id === id)).slice(0, K.size);
    if (!ok.length) return "Choisis au moins un héros.";
    E.koliState(S).team = ok; return null;
  };
  E.koliToggle = (S, id) => { const Q = E.koliState(S); const t = Q.team.slice(); const i = t.indexOf(id);
    if (i >= 0) { if (t.length <= 1) return "Il faut au moins un héros dans l'équipe d'arène."; t.splice(i, 1); }
    else { if (t.length >= K.size) return `${K.size} héros au plus dans l'équipe d'arène.`; t.push(id); }
    return E.koliSetTeam(S, t); };
  E.koliLvl = (S) => { const T = E.koliArena(S); return T.length ? Math.round(T.reduce((a, c) => a + c.lvl, 0) / T.length) : 1; };

  /* récompense d'une semaine finie : { w, cote, n, top } (au moins 5 combats classés) ; une seule fois par semaine */
  E.koliReward = (S, R) => {
    const Q = S.koli || E.koliState(S); if (R.w <= (Q.paidW === undefined ? -1 : Q.paidW)) return null;
    Q.paidW = R.w; const g = E.koliGrade(R.cote, R.top);
    Q.last = { w: R.w, grade: g.id, cote: R.cote, n: R.n, rank: R.rank || 0, got: [] };
    if (R.n < K.minWeek) return Q.last;
    S.tokens = S.tokens || {}; S.tokens[E.KOLI_CUR] = (S.tokens[E.KOLI_CUR] || 0) + g.kz;
    if (g.cons) E.addCons(S, g.cons);
    const got = [`${g.kz} Kolizetons`, D.CONSUMABLES[g.cons].name];
    S.titlesExtra = S.titlesExtra || []; S.unlocks = S.unlocks || {};
    E.KOLI_GRADES.slice(0, E.KOLI_GRADES.indexOf(g) + 1).forEach((x) => { // titres et ornement du grade et des grades en dessous
      if (x.title && !S.titlesExtra.includes(x.title)) { S.titlesExtra.push(x.title); got.push(`titre « ${x.title} »`); }
      if (x.orn && !S.unlocks[x.orn]) { S.unlocks[x.orn] = 1; got.push("ornement « Lauriers du Kolizéum »"); }
    });
    Q.last.got = got;
    E.note(S, `Kolizéum : semaine finie en ${g.name} (cote ${R.cote}) : ${got.join(", ")}.`, "rare");
    return Q.last;
  };
  /* fin de semaine sur cet appareil : récompense (hors ligne seulement : en ligne, c'est le serveur qui garde la cote),
     puis la cote revient à mi-chemin de 1 000 */
  E.koliSettle = (S, w) => {
    const Q = S.koli;
    if (!Q.online) E.koliReward(S, { w: Q.w, cote: Q.cote, n: Q.n, top: false });
    Q.cote = E.koliSoft(Q.cote); Q.best = Q.cote; Q.n = 0; Q.w = w; Q.top = false;
  };
  E.koliSoft = (c) => Math.round(K.start + (c - K.start) / 2);

  /* ---------- Fantômes : équipes créées à une cote et un niveau donnés (même graine, même équipe) ---------- */
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  E.koliRng = mulberry;
  const GEAR = ["coiffe", "cape", "amulette", "anneau1", "anneau2", "ceinture", "bottes", "arme"];
  const GHOST_NAMES = ["Ombre", "Spectre", "Écho", "Reflet", "Mirage", "Brume"];
  const byLvl = {};
  const gearFor = (slot, lvl) => { const s = slot.startsWith("anneau") ? "anneau" : slot; const k = s + ":" + lvl;
    if (!byLvl[k]) byLvl[k] = Object.keys(ITEMS).filter((id) => ITEMS[id].slot === s && ITEMS[id].lvl <= lvl && !ITEMS[id].noDrop).sort((a, b) => ITEMS[b].lvl - ITEMS[a].lvl).slice(0, 8);
    return byLvl[k]; };
  /* une équipe Fantôme : 3 classes au hasard, niveau donné, équipement correct de son niveau (comme une équipe bien suivie) */
  E.koliGhost = (seed, lvl, size = K.size) => {
    const rng0 = E.getRng(); const rng = mulberry(seed); E.setRng(rng);
    try {
      lvl = Math.max(1, Math.min(200, Math.round(lvl)));
      const T = E.newState("Fantôme", "iop"); T.chars = []; T.nextCid = 1;
      const cls = Object.keys(CLASSES); const picked = [];
      while (picked.length < size) { const c = cls[Math.floor(rng() * cls.length)]; if (!picked.includes(c)) picked.push(c); }
      picked.forEach((c, i) => {
        let nm = GHOST_NAMES[i]; if (D.NAMES) for (let k = 0; k < 8; k++) { nm = D.NAMES[Math.floor(rng() * D.NAMES.length)]; if (!T.chars.some((x) => x.name === nm)) break; }
        const h = E.addChar(T, c, nm, lvl);
        GEAR.forEach((sl) => { const L = gearFor(sl, lvl); if (!L.length) return; const tpl = L[Math.floor(rng() * Math.min(L.length, 4))]; const it = E.rollItem(T, tpl, { radiant: false }); T.items[it.uid] = it; E.equip(T, h.id, it.uid, sl); });
        E.autoAllocate(T, h); h.spellsManual = false; E.refreshSpells(h, E.charStats(T, h));
      });
      return E.koliSnap(T, T.chars.map((c) => c.id));
    } finally { E.setRng(rng0); }
  };
  E.koliGhostName = (seed) => `${GHOST_NAMES[seed % GHOST_NAMES.length]} d'arène`;

  /* ---------- le combat ---------- */
  /* Joue d'un coup : A (attaquant) contre B, avec la graine seed. Renvoie { win, rounds, hpA, hpB, dead: [indices morts] }. */
  E.koliSim = (A, B, seed) => { const W = E.koliWatch(A, B, seed); for (let g = 0; g < 20000 && !W.done; g++) E.koliWatchStep(W); return E.koliResult(W); };
  E.koliWatch = (A, B, seed, opts = {}) => {
    const rng0 = E.getRng(); const W = { rng: mulberry(seed >>> 0), done: false, A, B };
    E.setRng(W.rng); try { W.S2 = E.koliSetup(A, B, opts); } finally { E.setRng(rng0); }
    return W;
  };
  E.koliWatchStep = (W) => {
    if (W.done) return "end";
    const rng0 = E.getRng(), evLen = E.events.length;
    try { E.setRng(W.rng); E.step(W.S2); if (W.S2.fight.over) { W.done = true; return "end"; } return "step"; }
    finally { E.setRng(rng0); E.events.length = evLen; }
  };
  E.koliResult = (W) => { const F = W.S2.fight; const hp = (tm) => { const hs = F.ents.filter((x) => x.tm === tm && !x.summon); return Math.round(100 * hs.reduce((a, x) => a + (x.alive ? x.hp : 0), 0) / Math.max(1, hs.reduce((a, x) => a + x.hpBase, 0))); };
    return { win: F.winner === 0, rounds: Math.min(F.round, K.maxRound), hpA: hp(0), hpB: hp(1), dead: F.ents.map((x, i) => (!x.alive && !x.summon ? i : -1)).filter((i) => i >= 0) }; };
  /* chance de victoire : K.chance combats d'essai (graines fixes) */
  E.koliChance = (A, B, n = K.chance) => { let w = 0; for (let i = 0; i < n; i++) if (E.koliSim(A, B, 7919 * (i + 1) + 13).win) w++; return Math.round((100 * w) / n); };

  /* ---------- adversaires hors ligne (Fantômes seulement) ---------- */
  /* un Fantôme : d = écart voulu (+60 un peu plus fort, 0 à ta hauteur, -60 un peu plus faible) ; même graine, même Fantôme (le serveur le refait) */
  E.KOLI_GHOST_D = [60, 0, -60];
  E.koliGhostOpp = (seed, d, cote, lvl) => { seed = seed >>> 0; const glv = Math.max(1, Math.min(200, Math.round(lvl) + Math.round(d / 40)));
    return { ghost: true, seed, d, lvl: glv, cote: Math.max(0, Math.round(cote) + d + ((seed % 21) - 10)), name: E.koliGhostName(seed), team: E.koliGhost(seed, glv) }; };
  /* hors ligne : 3 Fantômes autour de ta cote, renouvelés après chaque combat et avec « Autres adversaires » */
  E.koliGhostOpps = (S) => {
    const Q = E.koliState(S); const lvl = E.koliLvl(S); const base = (E.defiDay() * 31 + Q.rf * 7) >>> 0;
    return E.KOLI_GHOST_D.map((d, i) => E.koliGhostOpp((base * 97 + i * 1013 + Q.n * 17 + Q.win * 5) >>> 0, d, Q.cote, lvl));
  };

  /* ---------- un combat classé, résolu sur cet appareil (hors ligne) ou d'après le serveur ---------- */
  /* r : { win, rounds, hpA, hpB } ; o : adversaire ; seed : graine du combat ; srv : { delta, cote } donnés par le serveur */
  E.koliApply = (S, o, r, seed, srv) => {
    const Q = E.koliState(S); const st = E.koliStakes(Q.cote, o.cote, o.ghost);
    const delta = srv ? srv.delta : r.win ? st.win : -st.lose;
    Q.cote = srv && srv.cote !== undefined ? srv.cote : Math.max(0, Q.cote + delta); Q.best = Math.max(Q.best || 0, Q.cote); Q.n++;
    if (r.win) Q.win++; else Q.loss++;
    const lvl = E.koliLvl(S); const kam = r.win ? K.purseK * lvl : 0; const kz = r.win ? K.kzWin : K.kzLoss;
    S.kamas += kam; if (r.win) E.addRes(S, E.POUSSIERE, K.dust); S.tokens[E.KOLI_CUR] = (S.tokens[E.KOLI_CUR] || 0) + kz;
    if (!srv) { Q.log.unshift({ t: E.now(), name: o.name, ghost: !!o.ghost, win: r.win, d: delta, seed, cote: o.cote, gs: o.seed, gl: o.lvl, rounds: r.rounds });
      if (Q.log.length > K.logMax) Q.log.length = K.logMax; }
    S.cnt = S.cnt || {}; S.cnt.koliFights = (S.cnt.koliFights || 0) + 1; if (r.win) S.cnt.koliWins = (S.cnt.koliWins || 0) + 1;
    return { delta, cote: Q.cote, kamas: kam, dust: r.win ? K.dust : 0, kz, grade: E.koliGrade(Q.cote, Q.top) };
  };
  /* hors ligne : un ticket, un combat contre un Fantôme de la liste */
  E.koliFight = (S, i) => {
    const Q = E.koliState(S); if (!E.koliArena(S).length) return "Choisis ton équipe d'arène.";
    if (E.koliTickets(S) < 1) return "Plus de ticket de Koli : il en arrive 10 chaque jour à minuit.";
    const o = E.koliGhostOpps(S)[i]; if (!o) return "Adversaire introuvable.";
    S.cons[E.KOLI_TICKET]--;
    const seed = ((o.seed ^ (Q.n * 2654435761)) >>> 0) || 1;
    const A = E.koliSnap(S, Q.team); const r = E.koliSim(A, o.team, seed);
    const out = Object.assign({ opp: o, seed, A }, r, E.koliApply(S, o, r, seed));
    Q.log[0].A = A; Q.log.forEach((l, k) => { if (k >= 5) delete l.A; }); // de quoi revoir les 5 derniers combats
    return out;
  };
  E.koliRefresh = (S) => { const Q = E.koliState(S); if (Q.rf >= K.freeRefresh) { if (E.koliTickets(S) < 1) return "Il faut un ticket pour changer encore d'adversaires aujourd'hui."; S.cons[E.KOLI_TICKET]--; } Q.rf++; return null; };
  /* en ligne : le serveur a joué le combat ({ win, seed, A, B, rounds, delta, cote, opp }) ; un ticket part, la bourse arrive */
  E.koliOnline = (S, R) => {
    const Q = E.koliState(S); Q.online = true;
    if (E.koliTickets(S) > 0) S.cons[E.KOLI_TICKET]--;
    return Object.assign({}, R, E.koliApply(S, R.opp, R, R.seed, { delta: R.delta, cote: R.cote }));
  };
  /* en ligne : la fiche du serveur ({ cote, n, best, w }) et les semaines finies ; défenses réussies : 1 Kolizeton chacune */
  E.koliSync = (S, me, weeks, fights, myId) => {
    const Q = E.koliState(S); Q.online = true; const out = { weeks: [], def: 0 };
    (weeks || []).slice().sort((a, b) => a.w - b.w).forEach((x) => { const r = E.koliReward(S, { w: x.w, cote: x.cote, n: x.n, top: x.rank > 0 && x.rank <= 3 && x.n >= K.minWeek, rank: x.rank }); if (r) out.weeks.push(r); });
    if (me) { Q.cote = me.cote; Q.best = Math.max(me.best || 0, me.cote); Q.n = me.n; Q.rank = me.rank || 0; Q.top = !!(me.rank && me.rank <= 3 && me.n >= K.minWeek); }
    (fights || []).forEach((f) => { if (f.def === myId && !f.win && f.id > (Q.defSeen || 0)) { out.def++; } });
    const maxId = Math.max(Q.defSeen || 0, ...(fights || []).filter((f) => f.def === myId).map((f) => f.id));
    if (!Q.defInit) { Q.defInit = 1; out.def = 0; } // la première fois, on ne compte pas les anciennes
    else if (out.def) S.tokens[E.KOLI_CUR] = (S.tokens[E.KOLI_CUR] || 0) + out.def * K.kzDef;
    Q.defSeen = maxId; return out;
  };

  /* ---------- boutique des Kolizetons (comptoir, comme le Bureau des primes) ---------- */
  if (E.SHOPS) E.SHOPS.koli = { name: "Boutique du Kolizéum", cur: E.KOLI_CUR, curName: "Kolizetons", icon: "🏟", items: [
    { id: "k1", cons: E.KOLI_TICKET, cost: 5, many: true }, { id: "k2", cons: "coffre_bois", cost: 12, many: true }, { id: "k3", cons: "coffre_argent", cost: 30, many: true },
    { id: "k4", cons: "coffre_or", cost: 80, many: true }, { id: "k5", cons: "bonbon_royal", cost: 15, many: true },
    { id: "k6", title: "Habitué du Kolizéum", cost: 150 }, { id: "k7", orn: "koli_ban", name: "Ornement « Bannière du Kolizéum »", cost: 300 } ] };
  if (E.ORN) {
    E.ORN.koli = { name: () => "Lauriers du Kolizéum", req: "Finir une semaine de Kolizéum en Cristal ou plus", ok: (S) => !!(S.unlocks && S.unlocks.koli) };
    E.ORN.koli_ban = { name: () => "Bannière du Kolizéum", req: "Boutique du Kolizéum (300 Kolizetons)", ok: (S) => !!(S.unlocks && S.unlocks.koli_ban) };
  }

  E.ACTIONS.koliFight = "combattre au Kolizéum"; E.ACTIONS.koliRefresh = "changer d'adversaires au Kolizéum";
  E.ACTIONS.koliToggle = "équipe d'arène"; E.ACTIONS.koliSetTeam = "équipe d'arène";
})(typeof window !== "undefined" ? window : globalThis);
