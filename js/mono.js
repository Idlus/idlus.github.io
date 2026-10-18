/* ============================================================================
   Monocompte — Idlus (deuxième serveur ; maquette finale validée par Mathis le 18/10/2026 : « 1A »)
   Un seul héros par saison, qui part du niveau 1 sans rien. Étape 1 :
   - une partie à part (sauvegarde « dofousxen-save-mono », choisie à l'écran des parties ou à la création du héros) ;
   - le héros unique : pas de recrutement, 3 Dofus portés au plus en Saison 1 ;
   - le bonus « Héros unique » (PV, dégâts subis, dégâts) réglé par simulation, classe par classe (tools/sim_mono.js) :
     optimisé seul vers la stasis 7, sans équipement vers la stasis 1 ;
   - le butin d'équipement ×4 jusqu'au niveau 100, ×1,5 au-delà (les ressources ne changent pas : un héros seul
     a déjà la même moyenne qu'une équipe) ; les gains hors ligne à 80 %.
   Étape 2 : mercenaire (solo) et combats de groupe ; étape 3 : métiers et spécialités. Le serveur à part, les saisons et le pass viennent ensuite.
   Crochets dans engine.js : E.monoSmall (PV et dégâts subis), E.monoDmg (dégâts), E.monoItem (butin d'équipement), E.MONO.off (hors ligne).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { ITEMS, DOFUS_SLOTS } = D;
  const M = (E.MONO = {
    saison: 1, nom: "Saison 1",
    /* donjon : % de PV, % de dégâts subis en moins, % de dégâts. Simulation du 18/10 (tools/sweep_mono.js, 8 donjons du niveau 30 au 200,
       4 essais ; comme tools/simulate.js, sans Dofus ni Maîtrise) : optimisé, stasis 7,07 en moyenne (6,75 à 7,38 selon la classe) ; bon équipement 6,1 ; sans équipement 1,2 */
    hp: 200, dr: 48, dmg: 60,
    huntHp: 120, huntDr: 50,        // chasse : comme un héros seul du serveur Classique
    /* retouche par classe (EQ1 : toutes les classes seules vers la stasis 7, à ± 0,5), en points de dégâts subis en moins */
    cls: { feca: { dr: 9 }, osa: { dr: -3 }, enu: { dr: 18 }, sram: { dr: -9 }, eni: { dr: 5 }, iop: { dr: 5 }, cra: { dr: 12 }, sadi: { dr: 15 }, sacri: { dr: -13 },
      panda: { dr: 22 }, roub: { dr: -40 }, zobal: { dr: -4 }, steam: { dr: -13 }, elio: { dr: -3 }, hupper: { dr: 7 }, ougi: { dr: 6 }, forge: { dr: -14 } },
    dofus: 3,                       // Dofus portés au plus (Saison 1)
    lootLow: 4, lootHigh: 1.5, lootLvl: 100,
    off: 0.8,
  });
  E.isMono = (S) => !!(S && S.mono);
  E.monoStart = (S) => { S.mono = { s: M.saison, t0: E.now() }; return S; };
  const adj = (cls) => M.cls[cls] || {};
  /* Groupes (étape 2) : le bonus Héros unique baisse à chaque joueur ajouté. Le mercenaire (c.merc, solo seulement) compte pour un demi-joueur.
     M.group[n] : part du bonus gardée pour n joueurs (entre deux tailles, on prend la moyenne). */
  M.group = { 1: 1, 2: 0.72, 3: 0.61, 4: 0.58 }; // simulation du 18/10 (6 classes) : optimisés à 2 → 8,1, à 3 → 8,8, à 4 → 9,9
  E.monoPlayers = (S, heroes) => heroes.reduce((a, h) => { const c = S.chars.find((x) => x.id === (h.cid != null ? h.cid : h.id)); return a + (c && c.merc ? 0.5 : 1); }, 0);
  E.monoFade = (p) => { p = Math.max(1, Math.min(4, p)); const lo = Math.floor(p), hi = Math.ceil(p); return M.group[lo] + (M.group[hi] - M.group[lo]) * (p - lo); };
  E.monoEnts = (S, ents, dungeon) => {
    const hs = ents.filter((e) => e.side === "c" && !e.summon); const f = E.monoFade(E.monoPlayers(S, hs));
    hs.forEach((e) => { const k = adj(e.cls);
      const hp = dungeon ? (M.hp + (k.hp || 0)) * f : M.huntHp * f, dr = dungeon ? Math.min(80, Math.max(0, (M.dr + (k.dr || 0)) * f)) : M.huntDr * f;
      e.hpMax = e.hp = Math.round(e.hpMax * (1 + hp / 100)); e.smallDr = dr; });
  };
  E.monoSmall = (S, team, dungeon) => { const f = E.monoFade(E.monoPlayers(S, team)); const k = adj(team[0] && team[0].cls); // pour l'affichage (héros seul)
    return dungeon ? { hp: (M.hp + (k.hp || 0)) * f, dr: Math.min(80, (M.dr + (k.dr || 0)) * f), name: "Héros unique" } : { hp: M.huntHp * f, dr: M.huntDr * f, name: "Héros unique" }; };
  E.monoDmg = (S, e, heroes) => (M.dmg + (adj(e.cls).dmg || 0)) * (heroes ? E.monoFade(E.monoPlayers(S, heroes)) : 1);
  E.monoItem = (S, T) => (T && T.lvl > M.lootLvl ? M.lootHigh : M.lootLow);

  /* dans le jeu (une partie par page) : la partie Monocompte limite l'équipe à 1 héros et les emplacements de Dofus à 3 */
  E.monoBoot = (S) => { if (!E.isMono(S)) return; E.HERO_MAX = 1; E.TEAM_MAX = 1; if (DOFUS_SLOTS.length > M.dofus) DOFUS_SLOTS.splice(M.dofus); };
  /* le héros unique : pas de recrutement */
  const recruit0 = E.recruit;
  E.recruit = function (S) { if (E.isMono(S)) return "Monocompte : un seul héros par saison."; return recruit0.apply(this, arguments); };
  /* 3 Dofus portés au plus */
  E.monoDofusSlots = (S) => (E.isMono(S) ? DOFUS_SLOTS.slice(0, M.dofus) : DOFUS_SLOTS);
  const equip0 = E.equip;
  E.equip = function (S, cid, uid, slot) {
    const it = E.isMono(S) && S.items[uid];
    if (it && ITEMS[it.tpl] && ITEMS[it.tpl].slot === "dofus") {
      const c = S.chars.find((x) => x.id === cid);
      const ok = E.monoDofusSlots(S);
      let o = slot && slot.startsWith("dofus") ? slot : c && E.slotFor(c, it);
      if (!ok.includes(o)) o = c && ok.find((s) => !c.equip[s]);
      if (!o) return `Monocompte, ${M.nom} : ${M.dofus} Dofus portés au plus. Retire-en un pour faire de la place.`;
      return equip0.call(this, S, cid, uid, o);
    }
    return equip0.apply(this, arguments);
  };

  /* ---------------- Étape 2 : groupes en direct et mercenaire ----------------
     Un combat de groupe est joué d'un coup par le vrai moteur, comme le boss de guilde : une petite partie de travail avec
     la photo de chaque héros (E.monoSnap), une graine commune, donc le même combat chez chacun (et sur le serveur, plus tard).
     Le joueur qui se déconnecte reste dans le combat, joué en automatique comme tous les héros. Butin individuel :
     chacun reçoit ses récompenses dans sa propre partie (E.monoGroupLoot), comme s'il avait fait le donjon seul.
     Pas de mercenaire dans un groupe de joueurs (Mathis, 18/10) : il reste un appoint du joueur seul. */
  M.groupMax = 4;
  M.merc = { cost: 25000, max: 1 };
  const kam = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* photo d'un héros : ses caractéristiques finales et ses passifs, sans les objets */
  E.monoSnap = (S, c) => {
    const k = E.koliSnap(S, [c.id])[0];
    return Object.assign(k, { id: c.id, merc: c.merc ? 1 : 0, seal: E.sealOf ? E.sealOf(S, c) : null, pet: E.petEnt ? E.petEnt(S, c) : null, hpB: E.bonus(S, "hp") || 0 });
  };
  E.monoSnapEnt = (S, c) => {
    const h = c.snap; const st = JSON.parse(JSON.stringify(h.st));
    const hpMax = Math.round(st.hpMax * (E.teamHas(S, "osa") ? 1.05 : 1) * (1 + (h.hpB || 0) / 100));
    return { side: "c", cid: c.id, name: c.name, cls: c.cls, lvl: c.lvl, st, hpMax, hp: hpMax, ini: st.ini, buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, weaken: 0, paLoss: 0, stack: 0, suffer: 0, nCast: 0, els: [],
      evc: h.evc || 0, ev: {}, mt: h.mt || null, bt: h.bt || null, lg: h.lg || null, dp: h.dp || null, dpBoost: !!h.dpB,
      wsp: h.wp && ITEMS[h.wp.t] ? E.weaponSpellOf(h.cls, h.wp.t, h.wp.e, h.wp.h) : null, seal: h.seal || null, pet: h.pet || null };
  };
  /* le mercenaire : un héros de la classe choisie, au niveau du groupe, avec un équipement correct de son niveau (jets moyens) */
  const GEAR = ["coiffe", "cape", "amulette", "anneau1", "anneau2", "ceinture", "bottes", "arme", "bouclier"];
  const byLvl = {};
  const gearFor = (slot, lvl) => { const s0 = slot.startsWith("anneau") ? "anneau" : slot; const k = s0 + ":" + lvl;
    if (!byLvl[k]) byLvl[k] = Object.keys(ITEMS).filter((id) => ITEMS[id].slot === s0 && ITEMS[id].lvl <= lvl && !ITEMS[id].noDrop && !ITEMS[id].trophy).sort((a, b) => ITEMS[b].lvl - ITEMS[a].lvl).slice(0, 4);
    return byLvl[k]; };
  let quiet = 0; // l'équipement du mercenaire ne compte pas pour les quêtes et les succès
  const mercGear = (S, c, rng) => { quiet++; try { GEAR.forEach((sl) => { const L = gearFor(sl, c.lvl); if (!L.length) return; const tpl = L[Math.floor(rng() * L.length)]; const it = E.rollItem(S, tpl, { radiant: false });
    for (const k in it.stats) { const [a, b] = ITEMS[tpl].stats[k]; it.stats[k] = Math.round((a + b) / 2); } it.merc = 1; E.equip(S, c.id, it.uid, sl); }); } finally { quiet--; } };
  E.monoMercName = (cls) => `Mercenaire ${(D.CLASSES[cls] || {}).name || ""}`.trim();
  /* photo d'un mercenaire (groupe) : même graine, même mercenaire */
  E.monoMercSnap = (cls, lvl, seed = 1) => {
    const rng0 = E.getRng(); const rng = mulberry(seed); E.setRng(rng);
    try { const T = E.monoStart(E.newState("Merc", cls)); T.chars = []; const c = E.addChar(T, cls, E.monoMercName(cls), Math.max(1, Math.min(200, lvl))); c.merc = 1; mercGear(T, c, rng);
      E.autoAllocate(T, c); c.spellsManual = false; E.refreshSpells(c, E.charStats(T, c)); return E.monoSnap(T, c); }
    finally { E.setRng(rng0); }
  };
  E.monoMercOf = (S) => S.chars.find((c) => c.merc);
  /* solo : engager un mercenaire pour un donjon (payé à l'entrée, il repart à la fin) */
  E.monoEnter = (S, did, stasis, mercCls) => {
    if (!E.isMono(S)) return E.enterDungeon(S, did, stasis);
    if (mercCls) {
      if (!D.CLASSES[mercCls]) return "Classe inconnue.";
      if (S.kamas < M.merc.cost) return `Il faut ${kam(M.merc.cost)} kamas pour le mercenaire.`;
      const me = S.chars.find((c) => !c.merc); if (!me) return "Héros introuvable.";
      E.monoMercClear(S);
      const c = E.addChar(S, mercCls, E.monoMercName(mercCls), me.lvl); c.merc = 1; c.inTeam = true; mercGear(S, c, () => E.rnd());
      E.autoAllocate(S, c); c.spellsManual = false; E.refreshSpells(c, E.charStats(S, c)); E.TEAM_MAX = Math.max(E.TEAM_MAX, 2);
      const err = E.enterDungeon(S, did, stasis);
      if (err) { E.monoMercClear(S); return err; }
      S.kamas -= M.merc.cost; S.mono.merc = c.id; E.note(S, `${c.name} rejoint ${me.name} pour ce donjon (${kam(M.merc.cost)} kamas).`, "info");
      return null;
    }
    return E.enterDungeon(S, did, stasis);
  };
  E.monoMercClear = (S) => {
    S.chars.filter((c) => c.merc).forEach((c) => { Object.values(c.equip || {}).forEach((u) => { if (S.items[u] && S.items[u].merc) delete S.items[u]; }); });
    S.chars = S.chars.filter((c) => !c.merc); if (S.mono) delete S.mono.merc;
  };
  /* le mercenaire repart dès que le donjon est fini (ou quitté) */
  const tick0 = E.tick;
  E.tick = function (S) { const r = tick0.apply(this, arguments); if (S && S.mono && S.mono.merc && !S.dungeon) E.monoMercClear(S); return r; };

  /* ---------------- combat de groupe ---------------- */
  /* snaps : photos des héros du groupe (1 à 4 joueurs ; un mercenaire seulement avec un joueur seul). Renvoie la partie de travail prête à jouer. */
  E.monoGroupSetup = (snaps, did, stasis) => {
    const players = snaps.filter((h) => !h.merc).length, mercs = snaps.length - players;
    if (!players) return { err: "Il faut au moins un joueur." };
    if (players > M.groupMax) return { err: `${M.groupMax} joueurs au plus par groupe.` };
    if (mercs && players > 1) return { err: "Pas de mercenaire dans un groupe de joueurs." };
    if (mercs > M.merc.max) return { err: "Un seul mercenaire." };
    const S2 = E.monoStart(E.newState("Groupe", snaps[0].cls)); S2.chars = []; S2.journal = [];
    snaps.forEach((h, i) => S2.chars.push({ id: i + 1, name: h.n, cls: h.cls, sex: h.sex, head: h.head, lvl: h.lvl, ren: h.ren || 0, spells: h.sp.map((x) => Object.assign({}, x)), atkMode: h.am ? "ordre" : undefined,
      alloc: {}, equip: {}, eveils: {}, inTeam: true, row: i === 0 ? "f" : "b", snap: JSON.parse(JSON.stringify(h)), merc: h.merc ? 1 : 0, xp: 0, pts: 0 }));
    S2.nextCid = snaps.length + 1;
    const dg = D.DUNGEONS[did]; if (!dg) return { err: "Donjon inconnu." };
    S2.res[dg.key] = 1; const SI = E.stasisInfo(S2, did); SI.max = Math.max(0, stasis - 1);
    const du = E.dungeonUnlocked; E.dungeonUnlocked = () => true; const tm = E.TEAM_MAX; E.TEAM_MAX = Math.max(tm, snaps.length);
    let err; try { err = E.enterDungeon(S2, did, stasis); } finally { E.dungeonUnlocked = du; E.TEAM_MAX = tm; }
    if (err) return { err };
    S2.monoRun = { did, stasis, rooms: [], done: false, win: null };
    return { S2 };
  };
  const emit0 = E.emit;
  E.emit = function (S, t, d) { if (quiet) return; if (S && S.monoRun) { if (t === "win" && d && d.dungeon) S.monoRun.rooms.push(d.mons); if (t === "dungeon") S.monoRun.done = true; return; } return emit0.apply(this, arguments); };
  /* joue tout le combat (graine commune) : { win, rooms, done, stasis } */
  E.monoGroupRun = (snaps, did, stasis, seed) => {
    const rng0 = E.getRng(); const evLen = E.events.length; E.setRng(mulberry(seed >>> 0));
    const tm = E.TEAM_MAX; E.TEAM_MAX = Math.max(tm, snaps.length); let S2;
    try { const G = E.monoGroupSetup(snaps, did, stasis); if (G.err) return G; S2 = G.S2;
      for (let t = 0; S2.dungeon && t < 3 * 3600 * 1000; t += 1000) { E.tick(S2, 1000); if (S2.fight && S2.fight.over && S2.fight.result === "lose") break; } }
    finally { E.setRng(rng0); E.events.length = evLen; E.TEAM_MAX = tm; }
    const R = S2.monoRun; R.win = R.done; return R;
  };
  /* butin individuel : chaque joueur reçoit dans sa partie l'XP, les kamas et le butin des salles gagnées */
  E.monoGroupLoot = (S, R) => {
    if (!E.isMono(S) || !R || !R.rooms) return null;
    const k = R.stasis || 1, sr = k > 1 ? E.stasisMult(k).rew : 1; const tot = { xp: 0, kamas: 0, items: [], res: {} };
    const sd = S.dungeon; S.dungeon = null;
    try {
      R.rooms.forEach((ms) => {
        const mons = ms.map((m) => Object.assign({ name: (D.MONSTERS[m.key] || {}).name || m.key, side: "m" }, m));
        const r = E.giveRewards(S, mons, { dungeon: true, stasis: k, xpMult: sr * E.PACE_REW, dropMult: sr * E.PACE_REW, kamasMult: E.PACE_REW });
        tot.xp += Object.values(r.xp).reduce((a, b) => a + b, 0); tot.kamas += r.kamas; tot.items.push(...r.items); for (const n in r.res) tot.res[n] = (tot.res[n] || 0) + r.res[n];
      });
    } finally { S.dungeon = sd; }
    if (R.done) { const SI = E.stasisInfo(S, R.did); SI.max = Math.max(SI.max || 0, k); S.progress.bossKills[R.did] = (S.progress.bossKills[R.did] || 0) + 1;
      S.mono.grp = (S.mono.grp || 0) + 1; E.emit(S, "dungeon", { id: R.did, stasis: k, chals: [], down: 0, group: true }); }
    return tot;
  };

  /* ---------------- Étape 3 : métiers (choix M1 de Mathis) ----------------
     Les métiers de récolte et d'artisanat montent jusqu'au niveau 100 ; 3 spécialités montent jusqu'à 200.
     Les 6 métiers de forgemagie montent tous jusqu'au niveau 200, hors spécialités (Mathis, 18/10). Les cases vides se remplissent quand on veut ;
     remplacer une spécialité : une fois par manche (2 semaines). Le métier quitté redescend au niveau 100 et retrouve
     son niveau s'il redevient spécialité. Le héros combat ou récolte, comme dans DOFUS : la récolte va 2 fois plus vite. */
  M.jobs = { cap: 100, spec: 3, manche: 14 * 86400000, gather: 2 };
  const isJob = (j) => !!(D.GATHER_JOBS[j] || D.CRAFT_JOBS[j]);
  const jobObj = (S, j) => (D.GATHER_JOBS[j] ? S.jobs[j] : (S.crafts = S.crafts || {})[j] || (S.crafts[j] = { lvl: 1, xp: 0 }));
  E.monoManche = (S) => Math.max(1, Math.floor((E.now() - ((S.mono && S.mono.t0) || E.now())) / M.jobs.manche) + 1);
  E.monoSpecs = (S) => (S.mono && S.mono.spec) || [];
  const cap0 = E.jobCap;
  E.jobCap = (S, kind, job) => {
    if (!E.isMono(S)) return cap0(S, kind, job);
    if (kind === "f") return 200; // forgemagie : les 6 métiers jusqu'au niveau 200, hors spécialités (Mathis, 18/10)
    return E.monoSpecs(S).includes(job) ? 200 : M.jobs.cap;
  };
  E.monoCanSwap = (S) => !S.mono || S.mono.specM !== E.monoManche(S);
  /* i : case 0 à 2 ; job : métier de récolte ou d'artisanat (null pour vider une case, compte comme un changement) */
  E.monoSetSpec = (S, i, job) => {
    if (!E.isMono(S)) return "Réservé au Monocompte.";
    if (!(i >= 0 && i < M.jobs.spec)) return "Case inconnue.";
    if (job && !isJob(job)) return "Métier inconnu.";
    const sp = (S.mono.spec = (S.mono.spec || []).slice()); while (sp.length < M.jobs.spec) sp.push(null); S.mono.spec = sp;
    if (job && sp.includes(job)) return "Ce métier est déjà une spécialité.";
    const old = sp[i];
    if (old && !E.monoCanSwap(S)) return `Une spécialité se change une fois par manche : prochain changement à la manche ${E.monoManche(S) + 1}.`;
    if (!old && !job) return null;
    if (old) {
      [jobObj(S, old)].forEach((J) => {
        if (!J || J.lvl <= M.jobs.cap) return; J.keep = { lvl: J.lvl, xp: J.xp }; J.lvl = M.jobs.cap; J.xp = 0; });
      S.mono.specM = E.monoManche(S);
    }
    sp[i] = job || null;
    if (job) [jobObj(S, job)].forEach((J) => { if (J && J.keep) { if (J.keep.lvl > J.lvl) { J.lvl = J.keep.lvl; J.xp = J.keep.xp; } delete J.keep; } });
    E.note(S, job ? `Spécialité : ${(D.GATHER_JOBS[job] || D.CRAFT_JOBS[job]).name} peut monter jusqu'au niveau 200.` : "Spécialité retirée.", "info");
    return null;
  };
  const gs0 = E.gatherSpeed;
  E.gatherSpeed = function (S) { return gs0.apply(this, arguments) * (E.isMono(S) ? M.jobs.gather : 1); };
})(typeof window !== "undefined" ? window : globalThis);
