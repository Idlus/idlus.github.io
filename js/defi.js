/* ============================================================================
   SE MONTRER — Idlus (0.1.19)
   - Défi du jour : chaque jour (minuit, heure de Paris), un donjon, une stasis, deux modificateurs et un hasard
     tirés de la date, les mêmes pour tous, dans trois paliers. Le combat est joué d'un coup par le vrai moteur
     sur une copie de la partie : même équipe + même jour = même résultat, et le serveur peut le rejouer.
   - Garde-robe : chaque coiffe et cape obtenue une fois reste dans la collection ; chaque héros peut montrer
     une autre apparence que celle qu'il porte (sans effet sur ses caractéristiques).
   - Résumé de l'équipe pour la carte à partager.
   Pas de DOM ici : l'interface est dans ui.js. Chargé aussi par le serveur (tools/build_server.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { DUNGEONS, ITEMS, MONSTERS } = D;

  /* ---------- l'heure de Paris (le défi change à minuit, comme l'Almanax) ---------- */
  let FMT = null;
  const parisOff = (t) => {
    try {
      FMT = FMT || new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      const p = FMT.formatToParts(new Date(t)); const g = (k) => +p.find((x) => x.type === k).value;
      return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - Math.floor(t / 60000) * 60000;
    } catch (e) { return 3600000; }
  };
  E.defiDay = (t = E.now()) => Math.floor((t + parisOff(t)) / 86400000);
  /* temps restant avant le prochain défi (ms) */
  E.defiLeft = (t = E.now()) => Math.max(0, (E.defiDay(t) + 1) * 86400000 - (t + parisOff(t)));
  E.defiDate = (day) => new Date(day * 86400000 + 43200000).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  /* ---------- le défi d'un jour ---------- */
  E.DEFI_TIERS = [
    { id: "dec", name: "Découverte", lo: 1, hi: 60, k: [1, 3] },
    { id: "ave", name: "Aventure", lo: 61, hi: 140, k: [3, 6] },
    { id: "leg", name: "Légende", lo: 141, hi: 200, k: [6, 8] },
  ];
  E.DEFI_MODS = ["enrages", "blindes", "vampires", "nombreux", "champions", "renforts", "ruse"];
  E.DEFI_TITLE = "Habitué du défi";
  E.DEFI_PURSE_K = 500;
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  E.defiTier = (id) => E.DEFI_TIERS.find((x) => x.id === id) || null;
  E.defi = (tid, day = E.defiDay()) => {
    const T = E.defiTier(tid); if (!T) return null;
    const ids = Object.keys(DUNGEONS).sort().filter((d) => DUNGEONS[d].lvl >= T.lo && DUNGEONS[d].lvl <= T.hi && DUNGEONS[d].rooms && DUNGEONS[d].rooms.length);
    if (!ids.length) return null;
    const h = (s) => hash(`idlus|defi|${day}|${T.id}|${s}`);
    const did = ids[h("donjon") % ids.length];
    const k = T.k[0] + (h("stasis") % (T.k[1] - T.k[0] + 1));
    const pool = E.DEFI_MODS.slice(); const a = pool.splice(h("mod1") % pool.length, 1)[0]; const b = pool[h("mod2") % pool.length];
    return { day, tier: T.id, did, k, mods: [a, b], seed: h("hasard") };
  };
  const topTeam = (S) => Math.max(0, ...E.team(S).map((c) => c.lvl));
  /* on peut viser plus haut que son niveau, jamais plus bas que son héros le plus fort */
  E.defiTierOk = (S, tid) => { const T = E.defiTier(tid); return !!T && E.team(S).length > 0 && topTeam(S) <= T.hi; };
  E.defiTierDefault = (S) => (E.DEFI_TIERS.find((T) => topTeam(S) <= T.hi && topTeam(S) >= T.lo) || E.DEFI_TIERS.find((T) => E.defiTierOk(S, T.id)) || E.DEFI_TIERS[2]).id;

  /* ---------- le combat, joué d'un coup sur une copie de la partie ----------
     Renvoie { win, turns, hp (% de PV de l'équipe à la fin), rooms: [{ turns, win }], kamas, dust }. */
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* Le défi pas à pas : une copie de la partie, son propre hasard (graine du jour) et une heure fixe.
     E.defiSim le joue d'un coup ; « Regarder le combat » appelle E.defiWatchStep au rythme de l'écran :
     le même hasard est tiré dans le même ordre, donc c'est exactement le même combat. */
  E.defiWatch = (S, def, now = E.now()) => {
    const S2 = JSON.parse(E.serialize(S));
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.hunting = false; S2.protector = null; S2.manualLive = false;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu; // pas de seconde chance : le même défi pour tous
    const dg = DUNGEONS[def.did]; const team = E.team(S2);
    const W = { def, now, S2, rng: mulberry(def.seed), rooms: [], hp: 0, kam: 0, done: false, win: false };
    if (!team.length || !dg) { W.done = true; W.err = "Il faut au moins un héros dans l'équipe."; return W; }
    S2.dungeon = { id: def.did, room: 0, stasis: def.k, chain: 1, t: 0, syncLvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length), mods: def.mods.slice(), eliteRoom: def.k >= 5 ? Math.floor(dg.rooms.length / 2) : -1, defi: def.tier };
    W.nRooms = dg.rooms.length + 1;
    return W;
  };
  /* Un pas : "start" (nouvelle salle), "step" (une action), "over" (fin de la salle), "end" (défi terminé). */
  E.defiWatchStep = (W) => {
    if (W.done) return "end";
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length; const S2 = W.S2;
    try {
      E.setRng(W.rng); E.setClock(() => W.now);
      let F = S2.fight;
      if (F && F.over) { S2.fight = null; F = null; }
      if (!F) {
        if (!S2.dungeon || W.rooms.length >= 20) return finish(W);
        F = E.startFight(S2); return F ? "start" : finish(W);
      }
      E.step(S2);
      if (!F.over && F.round <= 200) return "step";
      const heroes = F.ents.filter((e) => e.side === "c" && !e.summon);
      W.hp = Math.round(100 * heroes.reduce((a, e) => a + Math.max(0, e.alive ? e.hp : 0), 0) / Math.max(1, heroes.reduce((a, e) => a + e.hpMax, 0)));
      W.rooms.push({ turns: F.round, win: F.result === "win", boss: F.bossIdx !== undefined });
      if (F.rewards) W.kam += F.rewards.kamas || 0; // seulement les kamas du combat (pas les succès de la copie)
      if (F.result !== "win" || !S2.dungeon) finish(W);
      return "over";
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  const finish = (W) => { W.done = true; W.win = W.rooms.length === W.nRooms && W.rooms.every((r) => r.win); return "end"; };
  E.defiResult = (W) => ({ win: W.win, turns: W.rooms.reduce((a, r) => a + r.turns, 0), hp: W.win ? W.hp : 0, rooms: W.rooms, kamas: Math.round(W.kam), dust: W.def.k * 2 + (W.def.k >= 4 ? 4 : 0) });
  E.defiSim = (S, def, now = E.now()) => {
    const W = E.defiWatch(S, def, now);
    if (W.err) return { win: false, turns: 0, hp: 0, rooms: [], err: W.err };
    for (let g = 0; g < 500000 && !W.done; g++) E.defiWatchStep(W);
    return E.defiResult(W);
  };
  /* meilleur score : moins de tours, puis plus de PV */
  E.defiBetter = (a, b) => !!a && a.win && (!b || !b.win || a.turns < b.turns || (a.turns === b.turns && a.hp > b.hp));

  /* ---------- l'état du défi dans la partie ---------- */
  E.defiState = (S, day = E.defiDay()) => {
    if (!S.defi || S.defi.day !== day) S.defi = { day, best: {}, tries: [], chest: false };
    S.defiStreak = S.defiStreak || { n: 0, last: -1, best: 0, days: [] };
    return S.defi;
  };
  /* série en cours : elle tient si le dernier défi gagné date d'aujourd'hui ou d'hier */
  E.defiStreakNow = (S, day = E.defiDay()) => { const st = S.defiStreak; return st && st.last >= day - 1 ? st.n : 0; };

  /* Action : jouer le défi du jour dans un palier. Renvoie un message d'erreur ou le résultat (objet). */
  E.defiPlay = (S, tid) => {
    const T = E.defiTier(tid); if (!T) return "Palier inconnu.";
    if (!E.team(S).length) return "Il faut au moins un héros dans l'équipe.";
    if (!E.defiTierOk(S, tid)) return `Ton héros le plus fort dépasse le niveau ${T.hi} : le palier ${T.name} n'est plus pour lui.`;
    const now = E.now(); const day = E.defiDay(now); const def = E.defi(tid, day);
    const st = E.defiState(S, day);
    const r = E.defiSim(S, def, now);
    if (r.err) return r.err;
    const team = E.team(S).map((c) => ({ id: c.id, name: c.name, cls: c.cls, lvl: c.lvl }));
    const prev = st.best[tid] || null;
    const out = Object.assign({ tier: tid, did: def.did, k: def.k, mods: def.mods, day, team, n: st.tries.filter((x) => x.tier === tid).length + 1 }, r);
    out.improved = E.defiBetter(r, prev); out.prev = prev;
    if (out.improved) st.best[tid] = { win: true, turns: r.turns, hp: r.hp, team: team.map((x) => x.cls), t: now };
    st.tries.unshift({ tier: tid, win: r.win, turns: r.turns, hp: r.hp, team: team.map((x) => x.name), n: out.n, t: now }); if (st.tries.length > 12) st.tries.length = 12;
    S.cnt = S.cnt || {}; S.cnt.defiTries = (S.cnt.defiTries || 0) + 1;
    if (r.win && !st.chest) {
      const kam = Math.max(r.kamas, E.DEFI_PURSE_K * topTeam(S)); // 0.1.30 : Bourse du défi, au moins 500 kamas par niveau
      st.chest = true; S.kamas += kam; E.addRes(S, E.POUSSIERE, r.dust);
      out.chest = { kamas: kam, dust: r.dust };
      const ss = S.defiStreak; ss.n = ss.last === day - 1 ? ss.n + 1 : 1; ss.last = day; ss.best = Math.max(ss.best || 0, ss.n);
      ss.days = (ss.days || []).concat([day]).slice(-30);
      out.streak = ss.n;
      if (ss.n === 7) { E.addCons(S, "coffre_or"); out.bonus = "coffre_or"; } // 0.1.30 : série de 7 jours
      if (ss.n >= 30 && !S.unlocks.sablier) { S.unlocks.sablier = 1; out.orn = true; E.addCons(S, "coffre_douze"); out.bonus = "coffre_douze"; }
      E.note(S, `Défi du jour réussi en ${r.turns} tours. Bourse du défi : ${kam.toLocaleString("fr-FR")} kamas et ${r.dust} ${E.POUSSIERE} (série : ${ss.n} jour${ss.n > 1 ? "s" : ""})${out.bonus ? `. Série récompensée : ${D.CONSUMABLES[out.bonus].name} !` : ""}.`, "rare");
      if (E.checkAch) E.checkAch(S);
    }
    return out;
  };

  /* ---------- garde-robe ---------- */
  const SKIN_SLOTS = ["coiffe", "cape"];
  E.WARDROBE_SLOTS = SKIN_SLOTS;
  E.WARDROBE_ALL = {};
  SKIN_SLOTS.forEach((sl) => { E.WARDROBE_ALL[sl] = Object.keys(ITEMS).filter((t) => ITEMS[t].slot === sl).sort((a, b) => ITEMS[a].lvl - ITEMS[b].lvl || ITEMS[a].name.localeCompare(ITEMS[b].name)); });
  E.wardrobeAdd = (S, tpl) => { const T = ITEMS[tpl]; if (!T || !SKIN_SLOTS.includes(T.slot)) return; (S.wardrobe = S.wardrobe || {})[tpl] = 1; };
  /* à la mise à jour : tout ce que la partie possède déjà rejoint la collection */
  E.wardrobe = (S) => {
    if (!S.wardrobe || !S.wardrobeInit) { S.wardrobe = S.wardrobe || {}; for (const u in S.items || {}) E.wardrobeAdd(S, S.items[u].tpl); S.wardrobeInit = 1; }
    return S.wardrobe;
  };
  E.wardrobeCount = (S, sl) => { const W = E.wardrobe(S); return Object.keys(W).filter((t) => ITEMS[t] && (!sl || ITEMS[t].slot === sl)).length; };
  /* ce que le héros montre : undefined = ce qu'il porte, "none" = rien, sinon le modèle d'objet */
  E.shownTpl = (S, c, sl) => {
    const v = c.show && c.show[sl];
    if (v === "none") return null;
    if (v && ITEMS[v] && E.wardrobe(S)[v]) return v;
    const it = c.equip && c.equip[sl] && S.items[c.equip[sl]]; return it ? it.tpl : null;
  };
  /* Action : choisir l'apparence montrée (gratuit, sans limite) */
  E.setShow = (S, cid, sl, v) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || !SKIN_SLOTS.includes(sl)) return "Emplacement inconnu.";
    if (v && v !== "none") { if (!ITEMS[v] || ITEMS[v].slot !== sl) return "Apparence inconnue."; if (!E.wardrobe(S)[v]) return "Apparence pas encore obtenue."; }
    c.show = Object.assign({}, c.show); if (v) c.show[sl] = v; else delete c.show[sl];
    return null;
  };
  E.ACTIONS.setShow = "choisir l'apparence montrée (garde-robe)";
  E.ACTIONS.defiPlay = "jouer le défi du jour";

  /* ---------- résumé de l'équipe (carte à partager) ---------- */
  E.teamCardData = (S) => {
    let best = null;
    for (const did in S.stasis || {}) { const k = S.stasis[did].max || 0; if (k && DUNGEONS[did] && (!best || k > best.k || (k === best.k && DUNGEONS[did].lvl > DUNGEONS[best.did].lvl))) best = { k, did, name: DUNGEONS[did].name }; }
    const idols = ((S.idols && S.idols.active) || []).reduce((a, id) => a + ((E.IDOLS && E.IDOLS[id] && E.IDOLS[id].score) || 0), 0);
    return { best, dofus: E.dofusCount ? E.dofusCount(S) : 0, souls: E.soulCount ? E.soulCount(S) : 0, soulsAll: E.ARCHI_TOTAL || 213, idols, heroes: E.team(S) };
  };

  /* ---------- succès et ornement ---------- */
  if (E.ACH) {
    const has = (id) => E.ACH.some((a) => a.id === id);
    const add = (o) => { if (!has(o.id)) E.ACH.push(o); };
    add({ id: "defi1", cat: "Combat", name: "Défi relevé", desc: "Réussir un défi du jour.", test: (S) => !!(S.defiStreak && S.defiStreak.best >= 1), kamas: 2000 });
    add({ id: "defi7", cat: "Combat", name: "Une semaine de défis", desc: "Réussir le défi du jour 7 jours de suite.", test: (S) => !!(S.defiStreak && S.defiStreak.best >= 7), kamas: 15000, title: E.DEFI_TITLE });
    add({ id: "defi30", cat: "Combat", name: "Un mois de défis", desc: "Réussir le défi du jour 30 jours de suite (ornement « Sablier du défi »).", test: (S) => !!(S.defiStreak && S.defiStreak.best >= 30), kamas: 60000 });
    add({ id: "garde25", cat: "Progression", name: "Garde-robe garnie", desc: "Réunir 25 coiffes et capes dans la garde-robe.", test: (S) => E.wardrobeCount(S) >= 25, kamas: 5000 });
    add({ id: "garde50", cat: "Progression", name: "Collectionneur", desc: "Réunir 50 coiffes et capes dans la garde-robe.", test: (S) => E.wardrobeCount(S) >= 50, kamas: 15000, title: "le Collectionneur" });
  }
  if (E.ORN && !E.ORN.sablier) E.ORN.sablier = { name: () => "Sablier du défi", req: "Réussir le défi du jour 30 jours de suite", ok: (S) => !!(S.unlocks && S.unlocks.sablier) };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
