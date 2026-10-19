/* ============================================================================
   1.0.30 « Place à l'optimisation » : l'idle (règles ; l'écran est dans js/expeditionsui.js)
   - Heures de donjon (choix 31A de Mathis) : +2 h par jour à minuit (heure de Paris), gardées jusqu'à 8 h.
     Quand le jeu est fermé, l'équipe continue le donjon choisi au rendement hors ligne tant qu'il reste des heures
     et des clés, puis elle repart chasser. Une course hors ligne rapporte comme une course jouée (stasis comprise),
     sans challenges, mutateurs ni idoles ; la chance de Dofus par course est exactement celle du jeu (E.dofusDrop).
     Seules les stasis déjà réussies continuent ; réussite et durée d'une course viennent des vraies courses jouées.
   - Expéditions (choix 26B) : les héros hors de l'équipe partent en mission de 4 à 12 h, en jeu comme hors ligne.
     Réussite selon le niveau, l'équipement (caractéristiques), l'élément et la classe ; une mission ratée rapporte un quart.
     Récompenses : kamas, ressources de la zone, XP, clés, parfois un objet ; jamais de Dofus. La chasse n'est pas touchée.
     Équilibrage par simulation (tools/idle_sim.js) : une expédition rapporte nettement moins qu'un héros qui chasse.
   État : S.dgh (heures de donjon) et S.mis (expéditions), créés au premier usage et vérifiés au chargement.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  if (!E || !D) return;
  const { DUNGEONS, MONSTERS, ITEMS, CLASSES } = D;
  const SUBS = E.SUBS;
  const rnd = () => E.rnd();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const fmt = (n) => Math.round(n || 0).toLocaleString("fr-FR");
  const dayOf = (t) => (E.defiDay ? E.defiDay(t) : Math.floor(t / 86400000));
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const seeded = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hrsTxt = (s) => { s = Math.max(0, Math.round(s)); if (s < 30) return "0 min"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h${m ? " " + String(m).padStart(2, "0") : ""}` : `${Math.max(1, m)} min`; };
  E.hrsTxt = hrsTxt;

  /* rendement hors ligne : 25 % de base + Majordome et meubles de la Chambre (plafond : 80 % au total) */
  if (!E.offRate) E.offRate = (S) => E.OFFLINE_RATE + E.bonus(S, "offrate") / 100;

  /* =========================== Heures de donjon =========================== */
  E.DGH = { gain: 2 * 3600, max: 8 * 3600, min: 15 * 60, ema: 0.15, keep: 40, cap: 500, pace: 0.95 }; // pace : marge de sécurité, une course hors ligne compte 5 % de temps en plus
  E.dgh = (S) => {
    const d = dayOf(E.now());
    let H = S.dgh;
    if (!H || typeof H !== "object") H = S.dgh = { b: E.DGH.gain, d, on: true, did: null, k: 0, st: {}, last: null };
    if (!(H.st && typeof H.st === "object")) H.st = {};
    if (!isFinite(H.b)) H.b = 0;
    if (!isFinite(H.d)) H.d = d;
    if (d > H.d) { H.b = Math.min(E.DGH.max, H.b + (d - H.d) * E.DGH.gain); H.d = d; } // jamais de crédit si l'horloge recule
    H.b = clamp(H.b, 0, E.DGH.max);
    return H;
  };
  /* donjon visé : le choix du joueur, sinon le donjon en cours au moment de partir ; seulement une stasis déjà réussie */
  E.dghTarget = (S, cur) => {
    const H = E.dgh(S);
    if (!H.on) return { why: "off" };
    let did = H.did, k = H.k || 0, auto = false;
    if (!did || !DUNGEONS[did]) {
      if (cur && DUNGEONS[cur.id] && !cur.defi && !cur.gboss) { did = cur.id; k = cur.stasis || 1; auto = true; } else return { why: "none" };
    }
    const SI = E.stasisInfo(S, did);
    if (!k) k = SI.sel || SI.max;
    k = Math.min(k, SI.max);
    if (k < 1) return { did, k: 0, auto, why: "stasis" };
    if (!E.dungeonUnlocked(S, did)) return { did, k, auto, why: "lock" };
    return { did, k, auto };
  };
  /* mesure des vraies courses (appelé par endFight) : durée d'une tentative et réussite, en moyenne glissante, par donjon et stasis */
  E.dghRecord = (S, D0, F, win, done) => {
    if (!D0 || D0.defi || D0.gboss || D0.run == null || !DUNGEONS[D0.id]) return;
    D0.ht = (D0.ht || 0) + (F.dur || 0) + E.PAUSE_MS / 1000;
    const end = win ? !!done : S.dungeon !== D0; // victoire sur le boss, ou défaite qui coûte la clé (la Fiole de Résurrection ne coupe pas la course)
    if (!end) return;
    const H = E.dgh(S); const key = D0.id + ":" + (D0.stasis || 1); const a = E.DGH.ema; const s = D0.ht; D0.ht = 0;
    const r = H.st[key]; const m = E.team(S).length;
    if (!r) H.st[key] = { n: 1, w: win ? 1 : 0, s: Math.round(s), m, t: E.now() };
    else { r.n++; r.w = Math.round((r.w * (1 - a) + (win ? a : 0)) * 1000) / 1000; r.s = Math.round(r.s * (1 - a) + s * a); r.m = Math.max(r.m || 0, m); r.t = E.now(); }
    const ks = Object.keys(H.st); if (ks.length > E.DGH.keep) ks.sort((x, y) => (H.st[x].t || 0) - (H.st[y].t || 0)).slice(0, ks.length - E.DGH.keep).forEach((x) => delete H.st[x]);
  };
  /* estimation d'une course : mesurée sur les vraies courses de cette stasis, sinon d'après les combats du donjon, sinon prudente */
  E.dghEst = (S, did, k) => {
    const dg = DUNGEONS[did]; if (!dg) return null; const nf = dg.rooms.length + 1; const H = E.dgh(S);
    const r = H.st[did + ":" + k]; const m = E.team(S).length;
    if (r && r.n >= 1) return { s: Math.max(nf * 8, r.s), w: clamp(r.w * (r.m && m < r.m ? m / r.m : 1), 0, 1), n: r.n, src: "mesure" };
    const z = S.zoneStats && S.zoneStats["dg:" + did];
    if (z && z.f >= 5) { const ew = z.ew !== undefined ? z.ew : z.w / z.f; return { s: Math.max(nf * 8, z.s / z.f * nf), w: clamp(Math.pow(ew, nf), 0, 1), n: 0, src: "estime" }; }
    return { s: nf * 45, w: 0.5, n: 0, src: "defaut" };
  };
  /* groupe de monstres d'une salle (r < nombre de salles) ou de la salle du boss, comme en jeu (E.startFight) */
  const roomMons = (dg, r, k, sync, n) => {
    if (r < dg.rooms.length) {
      const room = dg.rooms[r];
      const cnt = clamp(Math.round(ri(room.size[0], room.size[1]) * (0.3 + n * 0.25)), 1, 8);
      const lv = k >= 4 ? Math.max(room.lvl, sync) : room.lvl;
      const out = []; for (let i = 0; i < cnt; i++) out.push(E.monsterEntity(pick(room.mobs), lv + ri(0, 1)));
      return out;
    }
    const bm = MONSTERS[dg.boss]; const blv = k >= 4 ? Math.max(bm.lvl[0], sync + 2) : bm.lvl[0];
    const mons = [E.monsterEntity(dg.boss, blv)];
    (dg.coBoss || []).forEach((cb) => { if (MONSTERS[cb]) mons.push(E.monsterEntity(cb, blv)); });
    const extra = dg.bossMobs && dg.bossMobs.length ? clamp(n - 1 - (mons.length - 1), 0, 7) : 0;
    const mlv = k >= 4 ? Math.max(dg.lvl, sync) : dg.lvl;
    for (let i = 0; i < extra; i++) mons.push(E.monsterEntity(pick(dg.bossMobs), mlv - ri(1, 3)));
    return mons;
  };
  E.DGH_WHY = {
    off: "désactivé", none: "aucun donjon choisi", stasis: "aucune stasis réussie dans ce donjon", lock: "donjon verrouillé",
    songe: "l'équipe dormait dans le Songe infini", team: "personne dans l'équipe", short: "absence trop courte (15 min au moins)",
    hours: "plus d'heures de donjon", keys: "aucune clé", keysout: "plus de clés", hoursout: "plus d'heures de donjon",
  };
  /* le donjon pendant l'absence (appelé par E.catchUp) : renvoie le compte rendu, ou null si rien n'était prévu */
  E.dghRun = (S, seconds, rate, opts = {}) => {
    const H = E.dgh(S); const T = E.dghTarget(S, opts.cur);
    if (T.why === "off" || T.why === "none") return null;
    const out = { did: T.did, k: T.k || 0, auto: !!T.auto, runs: 0, wins: 0, keys: 0, used: 0, kamas: 0, xp: 0, items: 0, dust: 0, dofus: [], why: T.why || null, rate, sec: seconds, bank: H.b };
    const stop = (why) => { out.why = why; H.last = { t: E.now(), sec: seconds, did: out.did, k: out.k, runs: 0, wins: 0, keys: 0, items: 0, dofus: 0, why }; return out; };
    if (seconds < E.DGH.min) { out.why = "short"; return out; } // une courte absence ne touche ni aux heures ni au compte rendu
    if (T.why) return stop(T.why);
    if (E.expActive && E.expActive(S)) return stop("songe");
    const team = E.team(S); if (!team.length) return stop("team");
    if (H.b < 60) return stop("hours");
    const dg = DUNGEONS[T.did]; const have = S.res[dg.key] || 0; if (!have) return stop("keys");
    const est = E.dghEst(S, T.did, T.k); out.est = est;
    const avail = Math.min(seconds, H.b);
    const per = est.s / E.DGH.pace; // durée d'une course hors ligne, en temps de jeu
    const ex = avail * rate / per; let n = Math.floor(ex); if (rnd() < ex - n) n++;
    n = Math.min(n, have, E.DGH.cap);
    const used = n ? Math.min(avail, n * per / rate) : 0;
    out.why = n >= have && ex > have ? "keysout" : avail < seconds && H.b <= seconds ? "hoursout" : null;
    out.used = Math.round(used); H.b = Math.max(0, Math.round(H.b - used));
    const k = T.k; const sr = E.stasisMult(k).rew; const nf = dg.rooms.length + 1; const sync = Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length);
    const SI = E.stasisInfo(S, T.did); const best0 = SI.best[k]; const k0 = S.kamas; const j0 = S.journal.slice(0); const seen = new Set();
    const gd = E.giveDofus; // le Dofus tombe exactement comme en jeu (E.dofusDrop) : on note seulement lesquels
    if (gd) E.giveDofus = function (S2, id) { const it = gd.apply(this, arguments); if (S2 === S && it) out.dofus.push(id); return it; };
    const fight = (r) => {
      const mons = roomMons(dg, r, k, sync, team.length); mons.forEach((m) => seen.add(m.base || m.key));
      const pr = E.powRew(mons, "dg", 1);
      const rw = E.giveRewards(S, mons, { dungeon: true, stasis: k, offline: true, xpBoost: opts.xpBoost, xpMult: sr * E.PACE_REW * pr, dropMult: sr * E.PACE_REW * pr, kamasMult: E.PACE_REW * pr });
      E.emit(S, "win", { mons: mons.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, champ: m.champ, lvl: m.lvl })), sub: null, dungeon: T.did, stasis: k, chals: [], down: 1, offline: true });
      out.xp += team.reduce((a, c) => a + (rw.xp[c.id] || 0), 0) / team.length; out.items += rw.items.length;
      return rw;
    };
    try {
      for (let i = 0; i < n; i++) {
        S.res[dg.key]--; if (!S.res[dg.key]) delete S.res[dg.key]; out.keys++; out.runs++;
        const win = rnd() < est.w; const rooms = win ? nf : Math.floor(rnd() * nf); // défaite : les salles gagnées avant rapportent
        for (let r = 0; r < Math.min(rooms, dg.rooms.length); r++) fight(r);
        if (!win) continue;
        const rw = fight(dg.rooms.length); out.wins++;
        S.progress.bossKills[T.did] = (S.progress.bossKills[T.did] || 0) + 1;
        const it0 = rw.items.length; E.bossChest(S, T.did, rw); E.stasisClear(S, { id: T.did, stasis: k, t: 0 }, rw); out.items += rw.items.length - it0;
        out.dust += (rw.stasis && rw.stasis.dust) || 0;
        E.emit(S, "dungeon", { id: T.did, stasis: k, chals: [], down: 1, offline: true });
      }
    } finally {
      if (gd) E.giveDofus = gd;
      if (best0 === undefined) delete SI.best[k]; else SI.best[k] = best0; // le record de temps reste celui des courses jouées
    }
    if (seen.size) E.checkHunt(S, [...seen]);
    out.kamas = S.kamas - k0; out.xp = Math.round(out.xp);
    // journal : un résumé au lieu de dizaines de lignes de butin (niveaux et quêtes gardés, les Dofus réécrits)
    const j0s = new Set(j0); S.journal = S.journal.filter((x) => !j0s.has(x) && x.kind === "up").slice(0, 10).concat(j0).slice(0, 60);
    if (n) E.note(S, `Donjon pendant l'absence : ${dg.name} stasis ${k}, ${out.runs} course${out.runs > 1 ? "s" : ""}, ${out.wins} victoire${out.wins > 1 ? "s" : ""}.`, "rare");
    out.dofus.forEach((id) => E.note(S, `Dofus pendant l'absence : ${(E.DOFUS && E.DOFUS[id] && E.DOFUS[id].name) || id} (butin du boss) !`, "rare"));
    H.last = { t: E.now(), sec: seconds, did: T.did, k, runs: out.runs, wins: out.wins, keys: out.keys, items: out.items, dofus: out.dofus.length, why: out.why };
    return out;
  };
  /* estimation affichée : courses pour les heures en banque, clés nécessaires */
  E.dghPlan = (S, did, k, rate) => {
    const H = E.dgh(S); const est = E.dghEst(S, did, k); if (!est) return null;
    const runs = Math.floor(H.b * rate * E.DGH.pace / est.s);
    return { est, runs, keys: (S.res[DUNGEONS[did].key] || 0), perRun: est.s, rate };
  };
  E.dghSet = (S, o) => {
    const H = E.dgh(S); o = o || {};
    if (o.on !== undefined) H.on = !!o.on;
    if (o.did !== undefined) {
      if (!o.did) { H.did = null; H.k = 0; }
      else { if (!DUNGEONS[o.did]) return "Donjon inconnu."; if (E.stasisInfo(S, o.did).max < 1) return "Réussis d'abord ce donjon une fois en jeu."; if (H.did !== o.did) H.k = 0; H.did = o.did; }
    }
    if (o.k !== undefined) { const k = Math.max(0, Math.round(+o.k || 0)); if (k && H.did && k > E.stasisInfo(S, H.did).max) return `Stasis ${k} pas encore réussie.`; H.k = k; }
    return null;
  };

  /* =============================== Expéditions =============================== */
  E.MIS = {
    slots: 3, roomCost: 3000000, board: 8, fail: 0.25,
    kamas: 110, kexp: 1.15, // kamas par heure (succès) : 110 × niveau de la mission ^ 1,15
    res: [90, 1.2],      // ressources par heure : 90 + 1,2 × niveau
    xp: 300,             // XP par heure : × XP d'un monstre du niveau de la mission (sagesse, malus d'écart et bonus d'XP du héros)
  };
  E.misGap = (L) => 5 + Math.floor(L / 20); // un héros peut viser une mission jusqu'à 6 niveaux au-dessus du sien (niveau 20), 15 au niveau 200
  E.MIS_TYPES = {
    patrouille: { name: "Patrouille", h: 4, k: 1.2, r: 0.8, x: 1, item: 0.1, keys: 1, st: ["ini", "cri"], cls: ["iop", "cra", "sram", "ougi", "eca", "roub", "elio"], ic: "combat" },
    ravitaillement: { name: "Ravitaillement", h: 6, k: 0.7, r: 1.3, x: 0.9, item: 0.06, keys: 0, st: ["pp", "sa"], cls: ["enu", "panda", "sadi", "osa", "steam", "xelor", "eni"], ic: "sac" },
    escorte: { name: "Escorte", h: 8, k: 1, r: 0.8, x: 1.3, item: 0.12, keys: 1, st: ["hp", "ini"], cls: ["feca", "sacri", "panda", "forge", "zobal", "osa", "iop"], ic: "havre" },
    fouille: { name: "Fouille", h: 12, k: 0.8, r: 1, x: 0.9, item: 1, keys: 2, st: ["pp", "hp", "sa"], cls: ["enu", "sram", "roub", "xelor", "hupper", "cra", "eni"], ic: "carte", n: 2 },
  };
  E.MIS_STATS = {
    hp: { name: "Points de vie", key: "hpMax", thr: (L) => Math.round(Math.max(150, 0.8 * (21 * L - 400)) / 10) * 10 },
    ini: { name: "Initiative", key: "ini", thr: (L) => Math.round(11 * L / 10) * 10 },
    sa: { name: "Sagesse", key: "sa", thr: (L) => Math.max(8, Math.round(1.3 * L - 20)) },
    pp: { name: "Prospection", key: "pp", thr: (L) => Math.max(5, Math.round(0.25 * L - 10)), min: 100 },
    cri: { name: "Critique", unit: " %", key: "cri", thr: (L) => Math.round(5 + L / 20) },
  };
  E.MIS_EL = { t: "Terre", f: "Feu", e: "Eau", a: "Air" };
  const EL_OF = { fo: "t", ine: "f", cha: "e", age: "a" };
  E.heroEl = (S, c, st) => {
    st = st || E.charStats(S, c); const main = CLASSES[c.cls] ? CLASSES[c.cls].main : "fo";
    let best = main; ["fo", "ine", "cha", "age"].forEach((k) => { if ((st[k] || 0) > (st[best] || 0)) best = k; });
    return EL_OF[best] || "t";
  };
  E.mis = (S) => {
    let M = S.mis;
    if (!M || typeof M !== "object") M = S.mis = { day: -1, board: [], runs: [], log: [], room: false, n: 0 };
    if (!Array.isArray(M.board)) M.board = [];
    if (!Array.isArray(M.runs)) M.runs = [];
    if (!Array.isArray(M.log)) M.log = [];
    return M;
  };
  E.misSlots = (S) => E.MIS.slots + (S.mis && S.mis.room ? 1 : 0);
  E.misRun = (S, cid) => (S.mis && S.mis.runs ? S.mis.runs.find((r) => r.cid === cid) || null : null);
  E.misTitle = (m) => `${(E.MIS_TYPES[m.t] || { name: "Mission" }).name} · ${SUBS[m.sub] ? SUBS[m.sub].name : m.sub}`;
  const keyOf = (sid) => { const s = SUBS[sid]; const did = s && (s.dungeons || [s.dungeon]).filter((d) => d && DUNGEONS[d])[0]; return did ? DUNGEONS[did].key : null; };
  /* tableau du jour : 8 missions autour du niveau des héros hors de l'équipe, tirées une fois par jour (toujours les mêmes ce jour-là) */
  const genBoard = (S, d) => {
    const R = seeded(hash(`mis:${d}:${S.created || 0}`)); const rp = (a) => a[Math.floor(R() * a.length)];
    const team = E.team(S); let lv = S.chars.filter((c) => !team.includes(c)).map((c) => c.lvl);
    if (!lv.length) lv = S.chars.map((c) => c.lvl);
    lv.sort((a, b) => b - a);
    const subs = Object.values(SUBS).filter((s) => s.lvl && !s.hidden && s.monsters && s.monsters.length && E.subUnlocked(S, s.id));
    if (!subs.length) return [];
    const types = Object.keys(E.MIS_TYPES); for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
    const used = new Set(); const out = [];
    for (let i = 0; i < E.MIS.board; i++) {
      const target = clamp(lv[i % lv.length] + rp([-12, -8, -5, -3, 0, 0, 2, 4]), 1, 200);
      const cand = subs.filter((s) => !used.has(s.id)).sort((a, b) => Math.abs(E.subMid(a) - target) - Math.abs(E.subMid(b) - target)).slice(0, 3);
      const s = cand.length ? rp(cand) : rp(subs); used.add(s.id);
      const L = Math.round(clamp(target, s.lvl[0], Math.min(200, s.lvl[1])));
      const t = types[i % types.length]; const T = E.MIS_TYPES[t];
      let sts = T.st.filter((k) => !(E.MIS_STATS[k].min > L)); if (!sts.length) sts = ["ini"];
      const req = []; const nst = Math.min(T.n || 1, sts.length);
      for (let j = 0; j < nst; j++) { const k = sts.splice(Math.floor(R() * sts.length), 1)[0]; req.push({ k: "st", s: k, v: E.MIS_STATS[k].thr(L) }); }
      if (R() < 0.5) req.push({ k: "el", e: rp(["t", "f", "e", "a"]) });
      else { const pool = T.cls.filter((c) => CLASSES[c]); const cs = []; while (cs.length < 3 && pool.length) cs.push(pool.splice(Math.floor(R() * pool.length), 1)[0]); req.push({ k: "cls", c: cs }); }
      out.push({ id: `${d}-${i}`, t, sub: s.id, lvl: L, req, key: T.keys ? keyOf(s.id) : null, taken: null });
    }
    return out.sort((a, b) => a.lvl - b.lvl || (a.id < b.id ? -1 : 1));
  };
  E.misBoard = (S) => {
    const M = E.mis(S); const d = dayOf(E.now());
    if (M.day !== d) { M.day = d; M.board = genBoard(S, d); }
    return M.board;
  };
  const reqScore = (S, c, st, q) => {
    if (q.k === "el") return E.heroEl(S, c, st) === q.e ? 1 : 0;
    if (q.k === "cls") return q.c.includes(c.cls) ? 1 : 0;
    const X = E.MIS_STATS[q.s]; const v = X ? st[X.key] || 0 : 0;
    return Math.pow(clamp(v / Math.max(1, q.v), 0, 1), 2);
  };
  E.misReqTxt = (q) => (q.k === "el" ? `élément ${E.MIS_EL[q.e]}` : q.k === "cls" ? q.c.map((c) => CLASSES[c].name).join(", ").replace(/, ([^,]*)$/, " ou $1") : `${E.MIS_STATS[q.s].name} ${fmt(q.v)}${E.MIS_STATS[q.s].unit || ""}`);
  /* chance de réussite : 15 % + 35 % selon le niveau (à niveau égal : la moitié, +10 niveaux : tout) + 50 % selon les exigences */
  E.misInfo = (S, c, m, st) => {
    st = st || E.charStats(S, c);
    const lv = clamp(0.5 + (c.lvl - m.lvl) / 20, 0, 1);
    const req = m.req.map((q) => { const sc = reqScore(S, c, st, q); const X = q.k === "st" ? E.MIS_STATS[q.s] : null; return { q, sc, txt: E.misReqTxt(q), have: X ? Math.round(st[X.key] || 0) : null }; });
    const avg = req.length ? req.reduce((a, r) => a + r.sc, 0) / req.length : 1;
    return { p: clamp(0.15 + 0.35 * lv + 0.5 * avg, 0.05, 0.95), lv, req, ok: c.lvl >= m.lvl - E.misGap(m.lvl) };
  };
  E.misChance = (S, c, m, st) => (c && m ? E.misInfo(S, c, m, st).p : 0);
  /* récompenses en cas de réussite (une mission ratée en donne un quart, sans clé ni objet) */
  E.misReward = (S, c, m, st) => {
    const T = E.MIS_TYPES[m.t]; const L = m.lvl; const hrs = T.h;
    const kamas = Math.round(E.MIS.kamas * Math.pow(L, E.MIS.kexp) * hrs * T.k * (1 + E.bonus(S, "kamas") / 100));
    const res = Math.round((E.MIS.res[0] + E.MIS.res[1] * L) * hrs * T.r * (1 + E.bonus(S, "drop") / 100));
    let xp = 0;
    if (c) { st = st || E.charStats(S, c); xp = Math.round(E.MIS.xp * E.monsterXp(L) * hrs * T.x * (1 + (st.sa || 0) / 100) * E.xpPenalty(c.lvl - L) * (1 + E.bonus(S, "xp") / 100) * E.renXpMult(c)); }
    return { kamas, res, xp, keys: m.key ? T.keys : 0, item: T.item, h: hrs };
  };
  E.misEV = (S, c, m, st) => { const p = E.misChance(S, c, m, st); return p + (1 - p) * E.MIS.fail; };
  /* héros qui peuvent partir : hors de l'équipe (au repos, en récolte, à l'entraînement ou à l'atelier) et pas déjà en mission */
  E.misHeroes = (S) => { const team = E.team(S); return S.chars.filter((c) => !team.includes(c) && !E.misRun(S, c.id)); };
  const zoneRes = (sid) => {
    const w = {}; const s = SUBS[sid]; if (!s) return [];
    s.monsters.forEach((k) => (MONSTERS[k] ? MONSTERS[k].drops || [] : []).forEach(([r, rate]) => { if (E.isKey(r)) return; w[r] = (w[r] || 0) + E.resRate(rate); }));
    return Object.entries(w).filter(([, x]) => x > 0);
  };
  const itemPool = (m) => {
    const s = SUBS[m.sub]; const pool = new Set();
    if (s) s.monsters.forEach((k) => ((MONSTERS[k] && MONSTERS[k].items) || []).forEach(([t]) => { const T = ITEMS[t]; if (T && T.slot && T.slot !== "dofus" && !T.dofus && !T.hidden && !T.leg && !T.wboss && !T.trophy && T.lvl <= m.lvl + 5 && T.lvl >= m.lvl - 25) pool.add(t); }));
    const arr = [...pool]; return arr.length ? arr : E.chestItemPool ? E.chestItemPool(m.lvl).filter((t) => !ITEMS[t].dofus && !ITEMS[t].trophy) : [];
  };
  E.misItemPool = itemPool;
  const complete = (S, run, c) => {
    const m = run.m; const st = E.charStats(S, c);
    const p = Math.min(run.p0, E.misChance(S, c, m, st)); const ok = rnd() < p; const f = ok ? 1 : E.MIS.fail;
    const R = E.misReward(S, c, m, st);
    const out = { id: m.id, t: m.t, sub: m.sub, lvl: m.lvl, cid: c.id, name: c.name, cls: c.cls, ok, p: Math.round(p * 100) / 100, at: E.now(), kamas: Math.round(R.kamas * f * E.sabLoot()), res: {}, nres: 0, xp: Math.round(R.xp * f), keys: 0, key: m.key, item: null, tpl: null, up: 0 };
    S.kamas += out.kamas; if (E.carnetGain) E.carnetGain(S, out.kamas, "mission");
    const pool = zoneRes(m.sub); const nres = Math.round(R.res * f * E.sabLoot()); // 2.1.22 : Sablier ×2 / ×3
    if (pool.length && nres > 0) {
      const tot = pool.reduce((a, [, x]) => a + x, 0); const draws = Math.min(nres, 24); let left = nres;
      for (let i = 0; i < draws; i++) {
        const q = i === draws - 1 ? left : Math.floor(nres / draws); left -= q; if (q <= 0) continue;
        let x = rnd() * tot; let r = pool[0][0]; for (const [n2, w] of pool) { x -= w; if (x <= 0) { r = n2; break; } }
        E.addRes(S, r, q); out.res[r] = (out.res[r] || 0) + q;
      }
      out.nres = nres;
    }
    const l0 = c.lvl; if (out.xp > 0) E.giveXp(S, c, out.xp); out.up = c.lvl - l0;
    if (ok && R.keys && m.key) { E.addRes(S, m.key, R.keys); out.keys = R.keys; }
    if (ok && (R.item >= 1 || rnd() < R.item)) { const arr = itemPool(m); if (arr.length) { const tpl = pick(arr); const it = E.rollItem(S, tpl, {}); out.item = it.uid; out.tpl = tpl; } }
    const M = E.mis(S); M.n = (M.n || 0) + 1; M.log.unshift(out); if (M.log.length > 12) M.log.length = 12;
    E.note(S, `${c.name} revient de mission (${E.misTitle(m)}) : ${ok ? "réussie" : "ratée, un quart des gains"} · +${fmt(out.kamas)} kamas${out.nres ? `, ${fmt(out.nres)} ressources` : ""}${out.keys ? `, ${out.keys} clé${out.keys > 1 ? "s" : ""}` : ""}${out.tpl ? `, ${ITEMS[out.tpl].name}` : ""}.`, ok ? "up" : "info");
    E.emit(S, "mission", { t: m.t, ok, cid: c.id });
    return out;
  };
  /* missions terminées (en jeu à chaque tick, hors ligne dans E.catchUp) ; renvoie les retours, ou null */
  E.misTick = (S) => {
    const M = S.mis; if (!M || !Array.isArray(M.runs) || !M.runs.length) return null;
    const now = E.now(); const done = [];
    M.runs = M.runs.filter((r) => {
      const c = S.chars.find((x) => x.id === r.cid);
      if (!c) return false;
      if (now < r.t1) return true;
      done.push(complete(S, r, c)); return false;
    });
    return done.length ? done : null;
  };
  E.misSend = (S, cid, mid) => {
    const M = E.mis(S); const board = E.misBoard(S);
    const m = board.find((x) => x.id === mid); if (!m) return "Mission introuvable (le tableau change à minuit).";
    if (m.taken != null) return "Un héros est déjà parti sur cette mission.";
    const c = S.chars.find((x) => x.id === +cid); if (!c) return "Héros introuvable.";
    if (E.misRun(S, c.id)) return `${c.name} est déjà en expédition.`;
    if (M.runs.length >= E.misSlots(S)) return `Toutes les places d'expédition sont prises (${E.misSlots(S)}).`;
    if (c.inTeam && !c.job) return `${c.name} est dans l'équipe : seuls les héros hors de l'équipe partent en expédition.`;
    if (E.koliState && E.koliState(S).team.includes(c.id)) return `${c.name} est dans l'équipe d'arène : retire-le d'abord (Défis › Kolizéum).`;
    if (c.lvl < m.lvl - E.misGap(m.lvl)) return `Niveau ${m.lvl - E.misGap(m.lvl)} au moins pour cette mission.`;
    if (c.job) { E.gatherPartial(S, c); c.job = null; }
    c.inTeam = false;
    if (S.training === c.id) S.training = null;
    if (E.atelierHero && E.atelierHero(S) === c && S.atelier) { S.atelier.cid = null; S.atelier.prog = 0; S.atelier.stall = null; }
    const T = E.MIS_TYPES[m.t]; const now = E.now(); const p0 = E.misChance(S, c, m);
    m.taken = c.id;
    M.runs.push({ m: JSON.parse(JSON.stringify(Object.assign({}, m, { taken: null }))), cid: c.id, t0: now, t1: now + T.h * 3600 * 1000, p0: Math.round(p0 * 1000) / 1000, day: M.day });
    E.note(S, `${c.name} part en mission : ${E.misTitle(m)} (${T.h} h, ${Math.round(p0 * 100)} % de réussite).`, "info");
    return null;
  };
  E.misRecall = (S, cid) => {
    const M = E.mis(S); const r = M.runs.find((x) => x.cid === +cid); if (!r) return "Ce héros n'est pas en expédition.";
    M.runs = M.runs.filter((x) => x !== r);
    if (r.day === M.day) { const m = M.board.find((x) => x.id === r.m.id); if (m) m.taken = null; }
    const c = S.chars.find((x) => x.id === r.cid);
    if (c) E.note(S, `${c.name} rentre de mission avant la fin : rien n'est rapporté.`, "info");
    return null;
  };
  E.misBuildRoom = (S) => {
    const M = E.mis(S); if (M.room) return "La Salle des cartes est déjà construite.";
    if (S.kamas < E.MIS.roomCost) return `Il faut ${fmt(E.MIS.roomCost)} kamas.`;
    S.kamas -= E.MIS.roomCost; M.room = true; E.note(S, "Salle des cartes construite : une 4e place d'expédition !", "up");
    return null;
  };
  /* un héros en mission ne peut pas rejoindre l'équipe, récolter, s'entraîner, aller à l'atelier, renaître ni partir */
  E.misAwayTxt = (S, c) => { const r = E.misRun(S, c.id); return r ? `${c.name} est en expédition (retour dans ${hrsTxt((r.t1 - E.now()) / 1000)}). Rappelle-le depuis Havre-Sac › Expéditions.` : null; };
  const away = (S, cid) => { if (!S || !S.mis || !S.mis.runs || !S.mis.runs.length || cid == null) return null; const c = S.chars.find((x) => x.id === +cid); return c && E.misRun(S, c.id) ? E.misAwayTxt(S, c) : null; };
  const guard = (name, cidOf) => {
    const f = E[name]; if (typeof f !== "function" || f.__mis) return;
    const w = function (S, ...a) { const msg = away(S, cidOf(...a)); return msg || f.call(this, S, ...a); };
    w.__mis = true; Object.keys(f).forEach((k) => { if (!(k in w)) w[k] = f[k]; }); E[name] = w;
  };
  guard("toggleTeam", (cid) => cid);
  guard("setJob", (cid, job) => (job ? cid : null));
  guard("setTraining", (cid) => cid);
  guard("setAtelier", (cid) => cid);
  guard("dismiss", (cid) => cid);
  guard("renaissance", (cid) => cid);
  if (typeof E.koliToggle === "function") { // équipe d'arène (Kolizéum, attaques et défenses de Percepteurs) : pas de héros en expédition
    const f0 = E.koliToggle;
    E.koliToggle = (S, id) => (!E.koliState(S).team.includes(id) && away(S, id)) || f0(S, id);
  }
  if (typeof E.canRenaissance === "function") { const f0 = E.canRenaissance; E.canRenaissance = (S, c) => (c && away(S, c.id)) || f0(S, c); }
  if (typeof E.applyComp === "function") {
    const f0 = E.applyComp;
    E.applyComp = (S, i) => { const K = (S.comps || [])[i]; const c = K && K.ids && S.chars.find((x) => K.ids.includes(x.id) && E.misRun(S, x.id)); return c ? { err: E.misAwayTxt(S, c) } : f0(S, i); };
  }
  /* missions terminées pendant le jeu ; sécurité : un héros revenu dans l'équipe ou au travail par un autre chemin annule sa mission */
  if (typeof E.tick === "function" && !E.tick.__mis) {
    const t0 = E.tick;
    E.tick = function (S) {
      const r = t0.apply(this, arguments);
      const M = S && S.mis;
      if (M && M.runs && M.runs.length) {
        const now = E.now();
        M.runs.forEach((x) => { const c = S.chars.find((y) => y.id === x.cid); if (c && ((c.inTeam && !c.job) || c.job || S.training === c.id || (S.atelier && S.atelier.cid === c.id))) x.t1 = -1; });
        if (M.runs.some((x) => x.t1 === -1)) { M.runs.filter((x) => x.t1 === -1).forEach((x) => { const c = S.chars.find((y) => y.id === x.cid); if (c) E.note(S, `${c.name} a quitté sa mission : elle est annulée.`, "warn"); }); M.runs = M.runs.filter((x) => x.t1 !== -1); }
        if (M.runs.some((x) => now >= x.t1)) E.misTick(S);
      }
      return r;
    };
    E.tick.__mis = true;
  }

  /* ========== chargement : champs vérifiés (partie d'avant la 1.0.30 : créés vides, rien d'autre ne change) ========== */
  E.idleFix = (S) => {
    if (!S || !Array.isArray(S.chars)) return S;
    E.dgh(S); const M = E.mis(S);
    M.runs = M.runs.filter((r) => r && r.m && E.MIS_TYPES[r.m.t] && S.chars.some((c) => c.id === r.cid) && isFinite(r.t1));
    M.board = M.board.filter((m) => m && E.MIS_TYPES[m.t] && SUBS[m.sub]);
    if (M.runs.length > E.misSlots(S)) M.runs.length = E.misSlots(S);
    return S;
  };
  if (typeof E.deserialize === "function" && !E.deserialize.__idle) {
    const d0 = E.deserialize; E.deserialize = function (txt) { return E.idleFix(d0.apply(this, arguments)); };
    Object.keys(d0).forEach((k) => { if (!(k in E.deserialize)) E.deserialize[k] = d0[k]; }); E.deserialize.__idle = true;
  }

  if (E.ACTIONS) Object.assign(E.ACTIONS, { misSend: "envoyer un héros en expédition", misRecall: "rappeler un héros d'expédition", misBuildRoom: "construire la Salle des cartes", dghSet: "régler le donjon pendant l'absence" });

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
