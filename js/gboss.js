/* ============================================================================
   BOSS DE GUILDE ET PERCEPTEURS — Idlus (multijoueur, étape 5)
   Chaque semaine (lundi, heure de Paris), un boss de donjon différent pour toutes les guildes.
   1.0.30 « Refonte des guildes » (choix 12A et 20A de Mathis) : le boss a une vraie barre de vie en 5 phases
   (25 000 points par membre, au moins 3 comptés ; phases de 8, 14, 20, 26 et 32 % de la vie), chaque phase est
   plus dure que la précédente. Un essai toutes les 25 min (20 avec le Cor de ralliement), 6 en réserve au plus.
   Un essai : l'équipe affronte le boss (niveau calé sur l'équipe, PV démultipliés) pendant 15 tours, et les
   dégâts infligés comptent en « points » (100 points = les PV normaux du boss). Chaque phase tombée verse des
   kamas au coffre de guilde et ouvre un coffre pour chaque membre qui a frappé. Le combat est joué d'un coup par
   le vrai moteur sur une copie de la partie, avec un hasard tiré de la semaine et du numéro d'essai : le serveur le rejoue.
   Aussi ici : Percepteurs (zones et donjons), coffre, places et améliorations de guilde, attaques entre guildes.
   Pas de DOM ici : l'interface est dans js/guilds.js. Chargé aussi par le serveur (tools/build_server.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { DUNGEONS, MONSTERS } = D;

  E.GBOSS_EVERY = 25;         // 1.0.30 : minutes pour un essai (avant : 3 essais par jour)
  E.GBOSS_EVERY_COR = 20;     // avec le Cor de ralliement
  E.GBOSS_RESERVE = 6;        // essais gardés en réserve au plus (2 h 30)
  E.GBOSS_ROUNDS = 15;        // tours par essai
  E.GBOSS_HP_MULT = 1000;     // le boss ne tombe pas pendant un essai : on compte les dégâts
  E.GBOSS_PER_MEMBER = 25000; // vie totale du boss par membre (au moins 3 membres comptés)
  E.GBOSS_MIN_MEMBERS = 3;
  E.GBOSS_PHASES = [8, 14, 20, 26, 32];                         // part de la vie totale de chaque phase (%)
  E.GBOSS_PHASE_K = [300000, 600000, 900000, 1200000, 1500000]; // kamas versés au coffre de guilde quand la phase tombe
  E.GBOSS_PHASE_NAMES = ["Éveillé", "Furieux", "Enragé", "Déchaîné", "Ultime"];
  E.GBOSS_PHASE_DMG = 8;      // +8 % de dommages du boss à chaque phase après la première (simulé : ≈ 300 points en phase 1, ≈ 230 en phase 5)
  E.GBOSS_STEPS = [25, 50, 75, 100]; // coffres des membres : phase p tombée = palier 25 × p (phases 1 à 4)
  E.GBOSS_TITLE = "Pourfendeur de boss"; // titre gardé par les membres des 3 meilleures guildes de la semaine
  E.GBOSS_FIRST_TITLE = "Avant-garde de guilde"; // 1.0.30 : membres de la première guilde du serveur qui finit le boss de la semaine

  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* semaine : jour de Paris (E.defiDay, js/defi.js) ramené au lundi ; le 1er janvier 1970 était un jeudi */
  E.gbossWeek = (t = E.now()) => Math.floor((E.defiDay(t) + 3) / 7);
  E.gbossLeft = (t = E.now()) => { const d = E.defiDay(t); const end = (E.gbossWeek(t) + 1) * 7 - 3; return Math.max(0, (end - d - 1) * 86400000 + E.defiLeft(t)); };
  /* boss candidats : un boss par donjon, des donjons de niveau 20 et plus, sans doublon */
  E.gbossCandidates = () => { const seen = {}; return Object.keys(DUNGEONS).sort().filter((id) => { const dg = DUNGEONS[id]; if (!dg.boss || !MONSTERS[dg.boss] || !dg.rooms || !dg.rooms.length || dg.lvl < 20 || seen[dg.boss]) return false; seen[dg.boss] = 1; return true; }); };
  /* Force de chaque boss retenu : multiplicateur de points pour qu'une équipe bien équipée fasse environ
     300 points par essai quel que soit le boss. Les boss à mécanique bloquante (invulnérables…) sont écartés.
     Table générée par `node tools/gboss_calib.js` (à relancer après un gros rééquilibrage). */
  E.GBOSS_POW = /*GBOSS_POW*/{"antichambre_gloursons":6.52,"antre_blop_multicolore":1.01,"antre_crocabulia":0.84,"antre_dragon_cochon":5.45,"antre_korriandre":0.84,"arbre_moon":1.58,"atelier_tanukoui":0.76,"bateau_chouque":0.71,"belvedere_ilyzaelle":1.08,"biblio_corbac":0.92,"boyau_pere_ver":1.41,"cache_kankreblath":0.85,"camp_razof":1.43,"caverne_el_piko":0.97,"caverne_koulosse":0.84,"cavernes_kolosso":1.05,"chapiteau_riktus":0.79,"chateau_ensable":1.43,"clairiere_chene_mou":1.36,"clos_blops":0.63,"cour_bouftou_royal":0.85,"croquanterie":0.92,"domaine_ancestral":0.89,"donjon_bworks":0.92,"donjon_harebourg":0.88,"donjon_scarafeuilles":0.89,"donjon_squelettes":0.6,"donjon_tofus":0.79,"epave_grolandais":5.45,"fabrique_foux":0.96,"forgefroide_frizz":1.52,"galerie_phossile":0.91,"grange_tournesol":1.02,"grotte_bworker":1.1,"grotte_kanigroula":2.11,"horologium_xlii":0.9,"hypogee_obsidiantre":0.88,"labo_brumen":0.83,"labo_nileza":2.16,"labo_tynril":0.62,"labyrinthe_minotoror":0.76,"megalithe_fraktale":0.96,"mine_sakai":1.86,"nid_kwakwa":1.28,"oeil_vortex":1.24,"palais_nidas":1.03,"pitons_craqueleur":0.96,"pyramide_ombre":0.83,"repaire_kharnozor":0.83,"repaire_skeunk":0.99,"repaire_sphincter":1.49,"salle_minotot":5.41,"serre_royalmouth":1.22,"taniere_givrefoux":0.73,"taniere_meulou":0.89,"temple_ougah":0.85,"terrier_wa_wabbit":0.74,"tertre_long_sommeil":0.8,"tofulailler_royal":0.86,"tombe_tofugawa":0.7,"transporteur_sylargh":1.45,"vallee_dame_eaux":0.74,"voliere_haute_truche":0.81}/*/GBOSS_POW*/;
  const pool = () => Object.keys(E.GBOSS_POW).filter((id) => DUNGEONS[id]).sort();
  E.gboss = (w = E.gbossWeek()) => {
    const P = pool(); const did = P[hash(`idlus|gboss|${w}`) % P.length]; const dg = DUNGEONS[did];
    return { w, did, boss: dg.boss, name: MONSTERS[dg.boss].name, dname: dg.name, pow: E.GBOSS_POW[did] || 1 };
  };
  E.gbossGoal = (members) => E.GBOSS_PER_MEMBER * Math.max(E.GBOSS_MIN_MEMBERS, members || 0);
  /* 1.0.30 : seuils cumulés des 5 phases (8, 22, 42, 68 et 100 % de la vie totale), même calcul que gb_thr (supabase/gboss.sql) */
  E.gbossThr = (goal) => { let c = 0; return E.GBOSS_PHASES.map((p) => { c += p; return Math.floor((goal * c) / 100); }); };
  /* où en est le boss : p = phase en cours (1 à 5, 6 s'il est vaincu), done = phases tombées, cur / need = points dans la phase en cours */
  E.gbossPhase = (pts, goal) => {
    const T = E.gbossThr(goal); let i = 0; while (i < T.length && pts >= T[i]) i++;
    if (i >= T.length) { const need = T[T.length - 1] - T[T.length - 2]; return { p: T.length + 1, done: T.length, cur: need, need, T }; }
    const lo = i ? T[i - 1] : 0; return { p: i + 1, done: i, cur: Math.max(0, pts - lo), need: T[i] - lo, T };
  };
  /* dommages du boss à la phase p (×1, ×1,15, ×1,3…) */
  E.gbossDmg = (p) => 1 + (E.GBOSS_PHASE_DMG * Math.max(0, Math.min(5, p || 1) - 1)) / 100;
  /* essais en réserve : t essais au moment at, +1 toutes les « every » minutes, E.GBOSS_RESERVE au plus (même calcul que gb_tok) */
  E.gbossTok = (t, at, now, every) => Math.min(E.GBOSS_RESERVE, (+t || 0) + Math.max(0, now - at) / ((every || E.GBOSS_EVERY) * 60000));
  /* temps avant le prochain essai (0 si la réserve est pleine) */
  E.gbossNextIn = (tok, every) => (tok >= E.GBOSS_RESERVE ? 0 : Math.ceil((1 - (tok % 1)) * (every || E.GBOSS_EVERY) * 60000));

  /* Un essai, joué d'un coup. n = numéro de l'essai de la semaine (0, 1, 2…) : il fixe le hasard.
     phase (1.0.30) : phase du boss, de plus en plus dure (E.gbossDmg). Renvoie { points, dmg, rounds, alive } ou { err }. */
  E.gbossSim = (S, def, n, now = E.now(), phase = 1) => {
    const S2 = JSON.parse(E.serialize(S));
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.hunting = false; S2.protector = null; S2.manualLive = false;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu;
    S2.idols = Object.assign({}, S2.idols, { active: [] }); // pas d'idoles : le même boss pour tous
    const dg = DUNGEONS[def.did]; const team = E.team(S2);
    if (!team.length || !dg) return { err: "Il faut au moins un héros dans l'équipe." };
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    try {
      E.setRng(mulberry(hash(`idlus|gboss|${def.w}|${n}`))); E.setClock(() => now);
      S2.dungeon = { id: def.did, room: dg.rooms.length, stasis: 4, chain: 1, t: 0, syncLvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length), mods: [], eliteRoom: -1, gboss: true };
      const F = E.startFight(S2); if (!F) return { err: "Combat impossible." };
      const B = F.ents[F.bossIdx]; if (!B) return { err: "Boss introuvable." };
      const base = B.hpMax; B.hpMax = B.hp = base * E.GBOSS_HP_MULT; if (B.shield) B.shield = 0;
      const dm = E.gbossDmg(phase); if (dm !== 1) F.ents.forEach((e) => { if (e.side === "m" && e.dmg) e.dmg *= dm; }); // 1.0.30 : la phase suivante est plus dure
      for (let g = 0; g < 200000 && !F.over && F.round <= E.GBOSS_ROUNDS; g++) E.step(S2);
      const dmg = Math.max(0, B.hpMax - Math.max(0, B.hp));
      const alive = F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length;
      const raw = (dmg / base) * 100;
      return { points: Math.round(raw * (def.pow || 1)), raw: Math.round(raw), dmg: Math.round(dmg), rounds: Math.min(F.round, E.GBOSS_ROUNDS), alive };
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };

  /* Coffre d'un palier : kamas et poussière de stasis, selon le niveau du meilleur héros (même calcul dans supabase/gboss.sql). */
  E.GBOSS_CHEST_NAMES = { 25: "Coffre de l'assaut", 50: "Coffre de la brèche", 75: "Coffre du siège", 100: "Coffre de la victoire" }; // 0.1.30
  E.gbossChest = (step, lvl) => { const i = E.GBOSS_STEPS.indexOf(step) + 1; return { k: Math.round((1000 + lvl * 250) * i), dust: 15 * i }; };

  /* ============================================================================
     PERCEPTEURS (version 3, 1.0.30 « Refonte des guildes », choix 7A et 8A de Mathis)
     Posé par le Meneur ou un Bras droit (20 000 kamas) dans une zone finie (tous ses monstres au palier Traqueur)
     ou dans un donjon fait au moins en stasis 1. Un seul Percepteur par zone (ou donjon) sur tout le serveur :
     pour s'installer dans une zone prise, il faut battre celui qui y est (attaques entre guildes, E.RAID plus bas).
     Sa poche se remplit en 12 h (10 h avec le Percepteur doré) : 5 % des kamas et ressources qu'une équipe y
     gagnerait ; en donjon +50 % (ressources des salles, jamais de Dofus ni d'objet du boss).
     Les kamas vont au coffre de guilde, les ressources à celui qui récolte.
     Des monstres l'attaquent environ une fois par jour (deux fois plus souvent en donjon) : pendant 2 h, chaque
     membre peut tenter une défense avec son équipe (une par attaque), rejouée par le serveur.
     Victoire : poche +25 %, XP de guilde, petit coffre pour le défenseur. Sans victoire : la moitié de la poche
     est perdue (moins avec la Robustesse).
     ========================================================================== */
  E.PERCO_PRICE = 20000;
  E.PERCO_FILL_H = 12;
  E.PERCO_FILL_H_DORE = 10; // 1.0.30 : Percepteur doré
  E.PERCO_RATE = 5; // 0.1.24.2 : 5 % (3 % au départ)
  E.PERCO_ATK_H = 2;
  E.PERCO_DJ = 1.5;         // 1.0.30 : poche d'un donjon
  E.PERCO_RARE = 50;        // 1.0.30 : ressource « rare » pour la Prospection : moins de 50 dans une poche pleine
  E.PERCO_EQ_RANK = 5;      // 1.0.30 : Prospection rang 5 : un équipement de la zone par poche pleine récoltée
  E.PERCO_MAX = 5;          // emplacements (6 avec le Quartier général)
  /* 1.0.30 : un emplacement dès la fondation, un de plus tous les 5 niveaux de guilde (5 au niveau 20), +1 avec le Quartier général */
  E.percoSlots = (glvl, qg) => Math.min(E.PERCO_MAX, 1 + Math.floor((glvl || 1) / 5)) + (qg ? 1 : 0);
  E.percoNextSlot = (glvl) => (E.percoSlots(glvl) >= E.PERCO_MAX ? null : E.percoSlots(glvl) * 5);
  const SUBS = () => E.SUBS || D.SUBS;
  const subLvl = (sub) => Math.round((sub.lvl[0] + sub.lvl[1]) / 2);
  E.percoIsDj = (sid) => !SUBS()[sid] && !!DUNGEONS[sid];
  E.percoLvl = (sid) => (SUBS()[sid] ? subLvl(SUBS()[sid]) : DUNGEONS[sid] ? DUNGEONS[sid].lvl : 1);
  E.percoName = (sid) => (SUBS()[sid] ? SUBS()[sid].name : DUNGEONS[sid] ? DUNGEONS[sid].name : sid);
  /* monstres d'un donjon hors boss (salles seulement) */
  const djMobs = (dg) => { const s = new Set(); (dg.rooms || []).forEach((r) => (r.mobs || []).forEach((m) => { if (m !== dg.boss && MONSTERS[m]) s.add(m); })); return [...s]; };
  let itemNames = null;
  const isItemName = (name) => { if (!itemNames) itemNames = new Set(Object.values(D.ITEMS || {}).map((t) => t.name)); return itemNames.has(name); };
  /* contenu d'une poche pleine : E.PERCO_RATE % de 12 h de chasse (≈ 2 900 kamas par niveau de zone et par heure, ≈ 250 monstres par heure pour les ressources).
     1.0.30 : aussi les donjons (×1,5), et eq = équipements possibles pour la Prospection rang 5 (fourchettes des caractéristiques, le serveur tire le jet) */
  E.percoCap = (sid) => {
    const sub = SUBS()[sid], dg = !sub && DUNGEONS[sid]; if (!sub && !dg) return null;
    const mobs = sub ? sub.monsters : djMobs(dg); if (!mobs.length) return null;
    const L = sub ? subLvl(sub) : dg.lvl, mult = sub ? 1 : E.PERCO_DJ, res = {}, eq = {};
    mobs.forEach((id) => { const m = MONSTERS[id];
      (m && m.drops || []).forEach(([name, ch]) => { if (isItemName(name) || /dofus/i.test(name)) return; res[name] = (res[name] || 0) + (30 * E.PERCO_RATE / mobs.length) * Math.min(100, ch) / 100 * 2; });
      (m && m.items || []).forEach(([tpl, ch]) => { const T = D.ITEMS && D.ITEMS[tpl]; if (!T || T.slot === "dofus" || T.noDrop || !T.stats || T.lvl > L + 10) return; eq[tpl] = Math.max(eq[tpl] || 0, ch); }); });
    const top = Object.keys(res).map((k) => [k, Math.round(res[k] * mult)]).filter((x) => x[1] >= 1).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8);
    const eqs = Object.keys(eq).sort((a, b) => eq[b] - eq[a] || (a < b ? -1 : 1)).slice(0, 4).map((tpl) => ({ tpl, s: D.ITEMS[tpl].stats }));
    const out = { k: Math.round(1000 * L * E.PERCO_RATE / 3 * mult), res: Object.fromEntries(top) };
    if (eqs.length) out.eq = eqs;
    if (!sub) out.dj = 1;
    return out;
  };
  /* zones et donjons où un Percepteur peut se poser pour cette partie (trophée de sous-zone = zone finie ; donjon fait en stasis 1 ou plus) */
  E.percoZones = (S) => Object.keys(SUBS()).filter((sid) => S.trophies && S.trophies[sid] && SUBS()[sid].monsters && SUBS()[sid].monsters.length)
    .concat(Object.keys(DUNGEONS).filter((did) => !SUBS()[did] && S.stasis && S.stasis[did] && (S.stasis[did].max || 0) >= 1 && djMobs(DUNGEONS[did]).length));
  E.percoAttackers = (sid) => { const sub = SUBS()[sid]; if (sub) return sub.monsters.filter((id) => MONSTERS[id]); return DUNGEONS[sid] ? djMobs(DUNGEONS[sid]) : []; };
  /* 1.0.30 : ce que donne une récolte (poche remplie à f, rangs de la guilde) : Poche +10 % par rang, Prospection +10 % par rang sur les ressources rares.
     Même calcul que pc_gain (supabase/gboss.sql). */
  E.percoGain = (cap, f, R = {}) => {
    const p = 1 + 0.1 * (R.poche || 0), pr = 1 + 0.1 * (R.prospection || 0), res = {};
    if (!cap) return { k: 0, res };
    for (const k in cap.res || {}) { const q = Math.floor(cap.res[k] * f * p * (cap.res[k] < E.PERCO_RARE ? pr : 1)); if (q >= 1) res[k] = q; }
    return { k: Math.floor(cap.k * f * p), res };
  };
  /* 1.0.30 : Sagesse : XP pour chaque héros de l'équipe qui récolte (1 % d'un niveau par rang pour une poche pleine,
     niveau compté au plus 10 au-dessus de la zone). txp vient du serveur (rang × poche / 100). */
  E.percoTeamXp = (S, txp, zl) => {
    let tot = 0; if (!(txp > 0)) return 0;
    E.team(S).forEach((c) => { if (c.lvl >= E.MAX_LVL) return; const g = Math.round(E.xpNeed(Math.min(c.lvl, (zl || c.lvl) + 10)) * Math.min(0.2, txp)); if (g > 0) { E.giveXp(S, c, g); tot += g; } });
    return tot;
  };

  /* Une défense contre les monstres, jouée d'un coup. n = défenseurs déjà battus pendant cette attaque (+1 monstre chacun),
     seed = hasard choisi par le serveur (le même pour un joueur et une attaque). Renvoie { win, rounds, alive } ou { err }. */
  const mg = E.makeGroup;
  E.makeGroup = (S, sub, size) => {
    if (!S.percoAtk) return mg(S, sub, size);
    const A = S.percoAtk, sid = A.sid || sub.id, ids = E.percoAttackers(sid), g = [];
    const top = SUBS()[sid] ? SUBS()[sid].lvl[1] : E.percoLvl(sid); // 1.0.30 : donjon : niveau du donjon
    const lvl = Math.max(top, A.lvl) + 5, n = Math.min(8, size + 2 + A.n);
    for (let i = 0; i < n; i++) g.push(E.monsterEntity(ids[Math.floor(E.rnd() * ids.length)], lvl));
    return g;
  };
  E.percoSim = (S, sid, n, seed, now = E.now()) => {
    const S2 = JSON.parse(E.serialize(S)); const dg = E.percoIsDj(sid) ? DUNGEONS[sid] : null;
    const sub = SUBS()[sid] || (dg && SUBS()[dg.access]); // 1.0.30 : un Percepteur de donjon se défend devant l'entrée du donjon
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.dungeon = null; S2.protector = null; S2.manualLive = false;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu;
    S2.idols = Object.assign({}, S2.idols, { active: [] });
    const team = E.team(S2);
    if (!team.length || !sub) return { err: "Il faut au moins un héros dans l'équipe." };
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    try {
      E.setRng(mulberry(seed >>> 0)); E.setClock(() => now);
      S2.sub = sub.id; S2.hunting = true; S2.percoAtk = { n: n || 0, sid, lvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length) };
      const F = E.startFight(S2); if (!F) return { err: "Combat impossible." };
      for (let g = 0; g < 200000 && !F.over && F.round <= 60; g++) E.step(S2);
      const alive = F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length;
      return { win: F.over && F.result === "win", rounds: F.round, alive, foes: F.ents.filter((e) => e.side === "m" && !e.summon).length };
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  E.percoSeed = (aid, uid) => hash(`idlus|perco|${aid}|${uid}`);
  /* coffre du défenseur victorieux */
  E.percoChest = (lvl) => ({ k: 300 * lvl, dust: 10 });

  /* ============================================================================
     GUILDE : fondation, places, coffre et améliorations (1.0.30, choix 1A, 3A, 4A, 5A et 18A de Mathis)
     Mêmes chiffres que supabase/guildes.sql (le serveur décide, ces tables servent à l'affichage).
     ========================================================================== */
  E.GUILD_FOUND_K = 25000;   // Guildalogemme (avant : 100 000)
  E.GUILD_FOUND_LVL = 20;    // héros demandé (avant : 30)
  E.GUILD_SHIELD_H = 2;      // nouvelles guildes protégées 2 h
  E.GUILD_SEATS = 5;         // places au départ
  E.GUILD_SEATS_MAX = 15;
  E.GUILD_SALE_MAX = 20;     // part de ses ventes directes donnée au coffre (0 à 20 %)
  E.guildSeatPrice = (n) => 250000 * Math.pow(Math.max(0, n - E.GUILD_SEATS), 2); // n-ième place : 6e 250 000, 10e 6,25 M, 15e 25 M
  E.GUILD_RANK_MAX = 10;
  E.guildRankPrice = (r) => 100000 * r * r; // prix du rang r (38,5 M pour les 10 rangs)
  E.GUILD_RANKS = [
    { k: "poche", name: "Poche", ic: "bourse", d: "+10 % de kamas et de ressources par rang", now: (r) => `+${10 * r} %` },
    { k: "prospection", name: "Prospection", ic: "pioche", d: "+10 % de ressources rares par rang ; dès le rang 5, un équipement de la zone par poche pleine", now: (r) => `+${10 * r} %${r >= E.PERCO_EQ_RANK ? " et un équipement" : ""}` },
    { k: "sagesse", name: "Sagesse", ic: "parchemin_or", d: "+20 % d'XP de guilde à la récolte par rang, et de l'XP pour l'équipe qui récolte (1 % d'un niveau par rang)", now: (r) => `+${20 * r} % / ${r} %` },
    { k: "robustesse", name: "Robustesse", ic: "combat", d: "+3 % de PV et de dommages par rang pour le Percepteur et ses gardes ; face aux monstres, il perd moins de sa poche", now: (r) => `+${3 * r} %` },
  ];
  E.GUILD_UQ = [
    { k: "espionnage", name: "Espionnage", ic: "carte", lvl: 3, cost: 1000000, d: "Avant d'attaquer, tu vois l'équipe d'arène de chaque défenseur et ce que contient la poche." },
    { k: "coffrefort", name: "Coffre-fort", ic: "coffre", lvl: 5, cost: 2000000, d: "Un pillage ne prend que 25 % de la poche de vos Percepteurs, au lieu de 50 %." },
    { k: "vigie", name: "Vigie", ic: "monde", lvl: 8, cost: 3000000, d: "3 h pour repousser une attaque au lieu de 2 h, et une alerte en jeu pour tous les membres." },
    { k: "banniere", name: "Bannière de guerre", ic: "ailes", lvl: 10, cost: 5000000, d: "Chaque membre a 4 attaques par jour au lieu de 3." },
    { k: "comptoir", name: "Comptoir de guilde", ic: "kamas", lvl: 12, cost: 6000000, d: "Les membres vendent leurs ressources 5 % plus cher en vente directe." },
    { k: "qg", name: "Quartier général", ic: "havre", lvl: 15, cost: 10000000, d: "Un emplacement de Percepteur en plus : 6 au lieu de 5." },
    { k: "percodore", name: "Percepteur doré", ic: "cristal", lvl: 18, cost: 14000000, d: "La poche de vos Percepteurs se remplit en 10 h au lieu de 12." },
    { k: "cor", name: "Cor de ralliement", ic: "trophee", lvl: 20, cost: 20000000, d: "Boss de guilde : un essai toutes les 20 min au lieu de 25." },
  ];
  E.GUILD_UQ_BY = Object.fromEntries(E.GUILD_UQ.map((u) => [u.k, u]));
  /* rang d'une amélioration (0 à 10) ou amélioration unique achetée (1) : S.guild.ups, rempli par js/guilds.js depuis guild_me */
  E.guildUp = (S, k) => (S && S.guild && S.guild.ups && +S.guild.ups[k]) || 0;
  E.guildHas = (S, k) => E.guildUp(S, k) > 0;

  /* ============================================================================
     ATTAQUES ENTRE GUILDES (1.0.30, choix 9B, 10A, 11A et 19A de Mathis) : la « Guerre des Percepteurs »
     Un joueur attaque le Percepteur d'une autre guilde avec son équipe d'arène (3 héros, celle du Kolizéum).
     L'attaque est annoncée : les membres de la guilde visée ont 2 h (3 h avec la Vigie) pour battre son équipe,
     une fois chacun (rejoué par le serveur comme au Kolizéum). Si personne ne gagne, l'équipe de l'attaquant
     affronte à la fin le Percepteur et ses gardes (plus forts avec la Robustesse).
     Victoire : 50 % de la poche (25 % contre un Coffre-fort, ÷ 2 si la guilde visée a 10 niveaux de moins) :
     kamas au coffre de sa guilde, ressources pour lui ; le Percepteur battu rentre chez lui (sa guilde garde le
     reste de la poche) et sa place est assommée 12 h ; la zone est à la guilde gagnante pendant 1 h (6 h de
     bouclier pour le Percepteur qu'elle y pose). Attaque repoussée : bouclier de 6 h sur le Percepteur.
     3 attaques par joueur et par jour (4 avec la Bannière de guerre). Nouvelles guildes protégées 2 h.
     Classement de la semaine : 3 points par attaque gagnée, 1 par attaque repoussée ; titre « Conquérant ».
     ========================================================================== */
  E.RAID = { h: 2, hVigie: 3, day: 3, dayBanniere: 4, shield: 6, ko: 12, hold: 1, loot: 50, lootFort: 25, gap: 10, base: 0.2, rob: 0.03, win: 3, def: 1 };
  E.WAR_TITLE = "Conquérant";
  /* part de la poche pillée (0,5 ; 0,25 ; divisée par 2 si la guilde visée a 10 niveaux de moins) */
  E.raidPart = (attLvl, defLvl, coffreFort) => ((coffreFort ? E.RAID.lootFort : E.RAID.loot) / 100) * ((defLvl || 1) <= (attLvl || 1) - E.RAID.gap ? 0.5 : 1);
  E.raidLoot = (gain, part) => { const res = {}; for (const k in (gain && gain.res) || {}) { const q = Math.floor(gain.res[k] * part); if (q >= 1) res[k] = q; } return { k: Math.floor(((gain && gain.k) || 0) * part), res }; };
  E.raidSeed = (rid, who) => hash(`idlus|raid|${rid}|${who}`);
  /* Le Percepteur et ses gardes : une équipe de Fantômes d'arène (js/koli.js) au niveau de la zone ou de l'attaquant
     (le plus haut), +20 % de PV et de dommages, et +3 % par rang de Robustesse. Calibré par simulation : une bonne
     équipe d'arène gagne environ 8 fois sur 10 sans Robustesse, environ 1 fois sur 2 contre la Robustesse 10. */
  E.percoGuards = (seed, lvl, rob) => {
    const T = E.koliGhost(seed >>> 0, Math.max(1, Math.min(200, Math.round(lvl || 1))));
    const m = E.RAID.base + E.RAID.rob * Math.max(0, Math.min(10, rob || 0));
    return T.map((h, i) => { const st = Object.assign({}, h.st); st.hpMax = Math.round(st.hpMax * (1 + m)); st.dsort = (st.dsort || 0) + m * 100;
      return Object.assign({}, h, { n: i ? "Garde du Percepteur" : "Percepteur", st }); });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
