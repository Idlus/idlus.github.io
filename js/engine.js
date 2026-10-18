/* ============================================================================
   MOTEUR DU JEU — Idlus (v2)
   Logique pure : état, combats automatiques, progression, objets, métiers,
   brisage, Emblème du Solitaire, donjons, progression hors-ligne.
   Aucune dépendance au DOM : testable dans Node.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, RUNE_TIERS, RUNE_SIMPLE_ONLY, CLASSES, GATHER_JOBS, CRAFT_JOBS, DOFUS_SLOTS,
          MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, FREE_SPIRIT, NAMES, HUNT_TIERS, CONSUMABLES } = D;

  const ARMES = root.ARMES || (typeof require !== "undefined" ? require("./armes.js") : {}); // 0.1.53 : dégâts propres des armes (tools/build_armes.js)
  /* 1.0.15 : tous les équipements se dropent (tools/build_drops.js). Les drops DofusDB restent dans m.dbItems (rareté de l'HdV) */
  const DROPS = root.DROPS || (typeof require !== "undefined" ? require("./drops.js") : {});
  if (Object.keys(DROPS).length) for (const k in MONSTERS) { const m = MONSTERS[k]; if (!m.dbItems) m.dbItems = m.items || []; m.items = DROPS[k] || []; }

  const E = {};
  E.VERSION = 13; // 13 : reset des Maîtrises (Maîtrise lente, choix de Mathis 16/10) ; 11 : 2.0 « La Maîtrise » (la Renaissance devient de la Maîtrise) ; 12 : 2.0.4, titres de la Renaissance retirés aussi quand le héros rené a été congédié
  /* Points d'extension (systèmes v2.6 : Havre-Sac, Almanax, alignement, quêtes…) */
  E.bonus = () => 0;          // E.bonus(S, kind) -> % (xp, drop, kamas, gather, dmg, hp, offtime, offrate, bag)
  E.emit = () => {};          // E.emit(S, type, data)
  E.trainee = () => null;     // héros à la Salle d'entraînement (systems.js)
  E.atelierTick = () => 0;    // atelier du Havre-Sac (systems.js)
  E.fmPlanTick = () => [];    // forgemagie automatique (systems.js, 0.1.9.1)
  E.protSpawn = () => {};     // protecteurs de ressources (systems.js, 0.1.10.1)
  E.protMult = () => 1;
  E.protGroup = () => null;
  E.protEnd = () => {};
  E.protExpire = () => {};
  E.compWin = () => {};       // compositions d'équipe (systems.js, 0.1.10.1)
  E.exoDrop = () => {};       // runes exotiques des coffres de boss (systems.js)
  E.exoArchi = () => {};      // runes exotiques des archimonstres (systems.js)
  E.petTick = () => 0; E.petStats = () => null; E.petHunt = () => null; E.petBoss = () => {}; E.podBonus = () => 0; // familiers (pets.js)
  E.idolFx = () => null; E.idolOwned = () => false; E.giveIdol = () => false; // 0.1.10 : idoles (js/idols.js)
  E.mountStats = () => null; E.mountHunt = () => null; E.mountXpShare = () => 0; E.stableXp = () => {}; E.enclosTick = () => {}; // montures (mounts.js)
  E.almMult = (S, w) => (w === "chal1" || w === "eco" || w === "craft2" || w === "fm" || w === "brise" ? 0 : 1); E.almChance = () => false; E.almQty = (q) => q; E.almCandy = () => null; // Almanax (systems.js)
  E.guildXpShare = () => 0; E.guildBonus = () => 0; // 0.1.21 : guildes (js/guilds.js, seulement en ligne)

  /* ---------------- Aléatoire & utilitaires ---------------- */
  let rnd = Math.random;
  E.setRng = (f) => { rnd = f; };
  E.rnd = () => rnd();
  E.getRng = () => rnd; // 0.1.19 : le défi du jour rend le hasard tel qu'il l'a trouvé
  /* Horloge du jeu : toute la logique lit l'heure ici (jamais Date.now() directement).
     Aujourd'hui c'est l'heure de l'appareil ; demain le serveur pourra imposer la sienne (anti-triche). */
  let clock = () => Date.now();
  E.setClock = (f) => { clock = f || (() => Date.now()); };
  E.now = () => clock();
  E.getClock = () => clock;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rf = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const zeroStats = () => { const o = {}; STAT_ORDER.forEach((k) => (o[k] = 0)); return o; };
  const addStats = (a, b, m = 1) => { for (const k in b) a[k] = (a[k] || 0) + b[k] * m; return a; };
  E.util = { ri, rf, pick, clamp };

  /* ---------------- Index des sous-zones ---------------- */
  const SUBS = {};
  ZONES.forEach((z) => z.subs.forEach((s, i) => (SUBS[s.id] = Object.assign({}, s, { zone: z.id, idx: i }))));
  E.SUBS = SUBS;
  const DUNGEON_SUB = {};
  Object.values(SUBS).forEach((s) => (s.dungeons || (s.dungeon ? [s.dungeon] : [])).forEach((d) => { DUNGEON_SUB[d] = s.id; }));
  E.DUNGEON_SUB = DUNGEON_SUB;

  /* Niveau de référence d'une ressource (pour son prix) */
  const RES_LVL = {};
  for (const id in MONSTERS) {
    const m = MONSTERS[id];
    m.drops.forEach(([r]) => { RES_LVL[r] = Math.max(RES_LVL[r] || 0, m.lvl[1]); });
  }
  /* « Cours rééquilibré » : le prix suit le monstre le plus faible qui donne la ressource (là où elle se farme),
     plus le plus fort : Pollenectar et Oueille (Pious niveau 11-15… jusqu'au niveau 200) valaient le prix du niveau 200.
     E.PRICE_LVL : "min" (choix 1A de Mathis, 15/10), "med" (niveau médian), "max" (avant). Le niveau affiché (E.resLvl) ne change pas. */
  const PRICE_LVLS = {};
  for (const id in MONSTERS) MONSTERS[id].drops.forEach(([r]) => (PRICE_LVLS[r] = PRICE_LVLS[r] || []).push(MONSTERS[id].lvl[1]));
  Object.values(PRICE_LVLS).forEach((a) => a.sort((x, y) => x - y));
  Object.values(GATHER_JOBS).forEach((j) => j.items.forEach(([r, l]) => { RES_LVL[r] = Math.max(1, Math.round(l / 2)); delete PRICE_LVLS[r]; }));
  E.PRICE_LVL = "min";
  E.resPriceLvl = (name) => {
    const a = PRICE_LVLS[name];
    if (a && E.PRICE_LVL === "min") return a[0];
    if (a && E.PRICE_LVL === "med") return a[Math.floor(a.length / 2)];
    return RES_LVL[name] || (RES[name] && RES[name].lvl) || 5;
  };
  E.resPrice = (name) => {
    if (SPECIAL_CRAFTS[name]) return 0;
    return Math.max(1, Math.round(2 + E.resPriceLvl(name) * 0.7));
  };
  E.resLvl = (name) => RES_LVL[name] || (RES[name] && RES[name].lvl) || 5;
  E.isKey = (name) => /^Clef /.test(name);

  /* ---------------- Courbes ---------------- */
  E.MAX_LVL = 200;
  /* v3 : plus rapide de 40 à 62, rampe jusqu'à 80 ; 0.1.12 : au-delà de 100, l'XP demandée baisse progressivement (moitié vers 160, un tiers à 200) :
     la pente ajoutée en 0.1.0 est retirée, 100 → 200 prenait 1 100 h de plus que 1 → 100 (simulation, équipe équipée) */
  E.xpCurveMult = (l) => (l <= 38 ? 0.13 : l <= 62 ? 0.11 : l < 80 ? 0.11 + (0.89 * (l - 62)) / 18 : l <= 100 ? 1 : Math.pow(100 / l, 1.5));
  E.xpNeed = (l) => Math.floor(36 * Math.pow(l, 2.7) * E.xpCurveMult(l)); // XP pour passer du niveau l à l+1
  E.jobXpNeed = (l) => Math.floor(30 * Math.pow(l, 1.55));
  E.monsterXp = (lvl) => Math.round((10 + Math.pow(lvl, 1.5) * 4.2) * 0.55);
  /* 0.1.12 Renaissance : bonus d'XP propre au héros (hors plafond commun) et rang d'un Éveil */
  E.REN_MAX = 10; E.REN_XP = 0; // 1.0.35 « Vies plus longues » : plus de bonus d'XP (avant : +30 % par renaissance)
  E.renXpMult = (c) => 1 + E.REN_XP * (c.ren || 0);
  /* 1.0.35 : chaque renaissance demande +50 % d'XP pour remonter (×6 à la X) : renaître devient un objectif de fin de jeu */
  E.REN_TITLE = "Le Phénix renaît de ses cendres"; // 2.0 : seul souvenir de la Renaissance, pour les comptes qui avaient renu
  E.REN_TO_MT = 0.02; // 2.0 : part de l'XP des vies passées qui devient de la Maîtrise (choix de Mathis)
  E.REN_NEED = 0; // 2.0 « La Maîtrise » : plus de renaissance, plus d'XP en plus par vie (avant : +50 % par renaissance)
  E.renNeedMult = (c) => 1 + E.REN_NEED * Math.min(E.REN_MAX, (c && c.ren) || 0);
  E.heroXpNeed = (c, l) => Math.floor(E.xpNeed(l === undefined ? c.lvl : l) * E.renNeedMult(c));
  E.eveil = (c, id) => (c && c.eveils && c.eveils[id]) || 0;
  /* 1.0.34 « Les 19 classes » : les places 14 à 19 ont un prix adouci (la courbe aurait mené le 19e à 199 M). Choix de Mathis 1B 2B */
  E.RECRUIT_HIGH = { 14: 2500000, 15: 3500000, 16: 5000000, 17: 7000000, 18: 10000000, 19: 15000000 };
  E.recruitCost = (n) => (n <= 1 ? 0 : E.RECRUIT_HIGH[n] || Math.round(300 * Math.pow(2.2, n - 2))); // n = numéro du personnage
  /* 0.1.35 (13 depuis 0.1.53.2, 19 depuis 1.0.34) : jusqu'à 19 héros, de n'importe quelle classe, 8 au plus dans l'équipe qui combat (les autres récoltent, s'entraînent ou se reposent) */
  E.HERO_MAX = 19; E.TEAM_MAX = 8;
  /* 1.0.34 : collection « Les 19 classes ». Une classe compte pour toujours dès qu'un de ses héros a atteint le niveau 200
     (une Renaissance ou un Congédier ne la retire pas). +1 % d'XP et de kamas par classe pour tout le compte, hors plafond (choix 4A). */
  E.CLASS_BONUS = 1;
  E.classesDone = (S) => { const d = S.cls200 || (S.cls200 = {}); S.chars.forEach((c) => { if ((c.lvl >= E.MAX_LVL || c.ren) && CLASSES[c.cls]) d[c.cls] = 1; }); return d; };
  E.classesN = (S) => Object.keys(E.classesDone(S)).filter((k) => CLASSES[k]).length;
  E.classesMult = (S) => 1 + (E.classesN(S) * E.CLASS_BONUS) / 100;
  E.activeCount = (S, but) => S.chars.filter((c) => c.inTeam && !c.job && c !== but).length;

  /* ---------------- État initial ---------------- */
  E.newState = (name, cls) => {
    const S = {
      v: E.VERSION, created: E.now(), savedAt: 0, lastTick: E.now(),
      kamas: 0, nextUid: 1, nextCid: 1,
      chars: [], items: {}, res: {}, runes: {},
      sub: null, hunting: false, zstars: {},
      progress: { wins: {}, bossKills: {} },
      history: [], zoneStats: {}, seenDrops: {}, radiants: 0,
      cons: {}, boosts: {}, trophies: {}, families: {}, huntSeen: {},
      jobs: {}, crafts: {}, coef: {}, tools: {}, finds: 0,
      fmJob: { lvl: 1, xp: 0 }, // 0.1.8.2 : métier de Forgemage
      fmPlans: [], // 0.1.9.1 : forgemagie automatique
      coefT0: E.now(), // 1.0.30 : départ des coefficients de brisage au-dessus de 100 % (E.coefBase)
      bestiary: {}, archis: {},
      stats: { fights: 0, wins: 0, recent: [], playtime: 0 },
      settings: { theme: "dark", chalAI: false, autoZone: false, auto: { action: "break", q: 50, keepSets: true, recycle: "break" } },
      journal: [],
      dungeon: null,
      pets: {}, petUid: 1, petKeep: {}, petLuck: {},
      mounts: {}, mountUid: 1, mountSeen: {}, enclos: { built: false, pairs: [], births: 0 },
      idols: { own: {}, active: [], presets: [] },
      craftObj: 1, // 1.0.19 : niveaux de métier d'artisanat déjà au niveau des objets
    };
    Object.keys(GATHER_JOBS).forEach((j) => (S.jobs[j] = { lvl: 1, xp: 0 }));
    Object.keys(CRAFT_JOBS).forEach((j) => (S.crafts[j] = { lvl: 1, xp: 0 }));
    E.addChar(S, cls || "iop", name || "Aventurier", 1);
    note(S, `${S.chars[0].name} arrive sur Incarnam.`, "info");
    return S;
  };

  E.addChar = (S, cls, name, lvl, sex) => {
    const c = {
      id: S.nextCid++, name, cls, sex: sex || CLASSES[cls].sex || "m", lvl: lvl || 1, xp: 0, presets: [], zonePreset: {},
      alloc: { vit: 0, sa: 0, fo: 0, ine: 0, cha: 0, age: 0 }, pts: ((lvl || 1) - 1) * 5,
      equip: {}, spells: [], inTeam: true, autoStat: CLASSES[cls].main, autoCap: 200, scrolls: {}, head: Math.floor(rnd() * 8), palette: "classique",
    };
    S.chars.push(c);
    if (c.pts) E.autoAllocate(S, c);
    E.refreshSpells(c, E.charStats(S, c));
    if (E.activeCount(S) > E.TEAM_MAX) c.inTeam = false;
    return c;
  };

  E.team = (S) => S.chars.filter((c) => c.inTeam && !c.job).slice(0, 8);
  E.freeSpirit = () => 0; // 1.0.5.1 (Mathis) : l'Esprit Libre est supprimé (plus de bonus d'XP, de butin, de PV ni de dégâts pour les petites équipes)
  E.isSolo = (S) => E.team(S).length === 1;
  /* Synergie : +2 % de dégâts et d'XP par classe différente (équipe de 2 héros ou plus) */
  E.synergy = (S) => { const t = E.team(S); if (t.length < 2) return 0; return new Set(t.map((c) => c.cls)).size * 2; };
  /* Passifs de classe */
  E.teamHas = (S, cls) => E.team(S).some((c) => c.cls === cls);
  E.rosterHas = (S, cls) => S.chars.some((c) => c.cls === cls);
  E.archiMult = (S) => (E.teamHas(S, "eca") ? 1.5 : 1) * (1 + E.boostPct(S, "archi") / 100);
  E.radiantMult = (S) => (E.teamHas(S, "eca") ? 1.5 : 1);

  /* Consommables & bonus temporaires (durée en temps réel, cumulable jusqu'à 8 h) */
  E.BOOST_MAX_S = 8 * 3600;
  E.boostPct = (S, kind, at = E.now()) => { const b = S.boosts && S.boosts[kind]; return b && b.until > at ? b.pct : 0; };
  E.boostLeft = (S, kind) => { const b = S.boosts && S.boosts[kind]; return b ? Math.max(0, (b.until - E.now()) / 1000) : 0; };
  E.addCons = (S, id, n = 1) => { S.cons[id] = (S.cons[id] || 0) + n; };
  E.useConsumable = (S, id, arg) => {
    const C = CONSUMABLES[id]; if (!C) return "Objet inconnu.";
    if (!(S.cons[id] > 0)) return "Vous n'en avez plus.";
    if (C.kind !== "boost") return E.useSpecial ? E.useSpecial(S, id, arg) : "Inutilisable.";
    const now = E.now(); const b = S.boosts[C.boost];
    if (b && b.until > now && b.pct !== C.pct) return "Un autre bonus de ce type est déjà actif.";
    const dur = C.dur * (E.teamHas(S, "panda") ? 1.25 : 1) * 1000;
    const start = b && b.until > now ? b.until : now;
    const until = Math.min(now + E.BOOST_MAX_S * 1000, start + dur);
    if (until <= start) return "Durée maximale atteinte (8 h).";
    S.boosts[C.boost] = { pct: C.pct, until };
    S.cons[id]--; if (!S.cons[id]) delete S.cons[id];
    return null;
  };

  /* Paliers de chasse */
  E.huntTier = (S, key) => { const n = S.bestiary[key] || 0; let t = -1; HUNT_TIERS.forEach((h, i) => { if (n >= h.n) t = i; }); return t; };
  const RACE_MONS = {};
  for (const k in MONSTERS) { const m = MONSTERS[k]; if (!m.archiOf && !m.boss && m.race !== undefined) (RACE_MONS[m.race] = RACE_MONS[m.race] || []).push(k); }
  E.RACE_MONS = RACE_MONS;
  E.familyBonusVit = (S) => Object.keys(S.families || {}).length * 5;
  const checkHunt = (S, keys) => {
    keys.forEach((k) => {
      const t = E.huntTier(S, k); const prev = S.huntSeen[k] ?? -1;
      if (t > prev) { S.huntSeen[k] = t; for (let i = prev + 1; i <= t; i++) note(S, `Palier ${HUNT_TIERS[i].name} : ${MONSTERS[k].name}`, i >= 2 ? "up" : "info"); }
    });
    // familles complètes (tous au palier Traqueur)
    for (const r in RACE_MONS) {
      if (S.families[r]) continue;
      if (RACE_MONS[r].every((k) => E.huntTier(S, k) >= 1)) { S.families[r] = 1; note(S, `Famille complète : ${D.RACES[r] || r} ! +5 Vitalité pour tous vos héros.`, "rare"); }
    }
    // trophées de sous-zone
    Object.values(SUBS).forEach((sub) => {
      if (S.trophies[sub.id]) return;
      if (sub.monsters.every((k) => E.huntTier(S, k) >= 1)) {
        S.trophies[sub.id] = 1; // 1.0.20 : le trophée ne s'équipe plus, son bonus agit tout seul (E.trophyZoneMult, E.trophyVitrine)
        note(S, `Trophée obtenu : ${sub.name} ! Bonus actif.`, "rare"); E.emit(S, "trophy", { sub: sub.id });
      }
    });
  };
  E.checkHunt = checkHunt;

  /* ---------------- Sorts (v3 : vrais kits DOFUS 3, grades et variantes) ---------------- */
  E.DMG_SCALE = 0.62; // calibrage des valeurs DOFUS pour le combat automatique
  E.spellSlots = (c) => 6 + (c.lvl >= 50 ? 1 : 0) + (c.lvl >= 100 ? 1 : 0);
  /* 1.0.35 « Mémoire des vies » : un héros rené peut connaître des sorts d'autres classes (c.mem). Les identifiants de sorts sont
     uniques entre les classes : un sort étranger est trouvé dans l'index de toutes les classes, avec sa propre paire (« m: » + id) */
  const SPELL_IDX = {}; const MEM_DEF = {};
  E.spellCls = (id) => { if (!SPELL_IDX.ready) { for (const k in CLASSES) CLASSES[k].spells.forEach((s) => (SPELL_IDX[s.id] = k)); SPELL_IDX.ready = 1; } return SPELL_IDX[id]; };
  E.memDef = (id) => { if (MEM_DEF[id]) return MEM_DEF[id]; const k = E.spellCls(id); const s = k && CLASSES[k].spells.find((x) => x.id === id); return s ? (MEM_DEF[id] = Object.assign({}, s, { pair: "m:" + id, mem: k })) : null; };
  E.spellDef = (cls, id) => (CLASSES[cls] && CLASSES[cls].spells.find((s) => s.id === id)) || (E.spellCls(id) && E.spellCls(id) !== cls ? E.memDef(id) : undefined);
  E.MEM_SLOTS = () => 0; // 2.0 « La Maîtrise » : les sorts des vies passées sont devenus des points de Maîtrise (avant : 1, 2 puis 3 selon la renaissance) // sorts d'autres classes équipables en même temps
  E.memSpells = (c) => (c.mem || []).map(E.memDef).filter((s) => s && s.lvl <= c.lvl);
  E.memCount = (c, list) => (list || c.spells || []).filter((x) => { const d = E.spellDef(c.cls, x.id); return d && d.mem; }).length;
  E.spellGrade = (sp, lvl) => { let g = sp.grades[0]; for (const x of sp.grades) if (x.lvl <= lvl) g = x; return g; };
  E.memFit = (c, list) => { let m = 0; const mc = E.MEM_SLOTS(c); return list.filter((x) => { const d = E.spellDef(c.cls, x.id); if (!d || d.lvl > c.lvl) return false; if (!d.mem) return true; return (c.mem || []).includes(x.id) && ++m <= mc; }); }; // sorts appris et dans la limite de la renaissance
  E.knownSpells = (c) => CLASSES[c.cls].spells.filter((s) => s.lvl <= c.lvl).concat(E.memSpells(c));
  /* résumé d'un sort pour l'IA et l'interface */
  E.spellKind = (g) => {
    const k = g.fx.map((f) => f.k);
    if (k.includes("summon")) return "summon";
    if (k.includes("heal") || k.includes("healpct")) return k.includes("dmg") || k.includes("drain") ? "drain" : "heal";
    const dm = g.fx.find((f) => f.k === "dmg" || f.k === "drain" || f.k === "dot");
    if (dm) return dm.k === "dot" ? "dot" : dm.k === "drain" ? "drain" : dm.n > 1 ? "aoe" : "dmg";
    if (k.includes("shield")) return "shield";
    return "buff";
  };
  E.spellPower = (g) => g.fx.reduce((s, f) => s + (f.min !== undefined ? ((f.min + f.max) / 2) * (f.n > 1 ? 1 + (Math.min(f.n, 3) - 1) * 0.35 : 1) * (f.k === "dot" ? (f.t || 2) * 0.6 : 1) * (f.k === "heal" ? 0.4 : 1) : 0), 0);
  const defaultCond = (sp, c) => {
    const g = E.spellGrade(sp, c.lvl); const k = E.spellKind(g);
    if (k === "heal") return "ally_low";
    if (k === "summon") return "no_summon";
    if (k === "shield") return "ally_shield";
    if (k === "buff") return g.fx.some((f) => f.k === "buff" && f.st === "pui" && (f.t || 1) >= 3) ? "first_turn" : "always";

    return "always";
  };
  E.defaultCond = defaultCond;
  const mainEl = (c) => { const k = c.autoStat && STATS[c.autoStat] && STATS[c.autoStat].el ? c.autoStat : CLASSES[c.cls].main; return (STATS[k] && STATS[k].el) || "t"; };
  E.mainEl = mainEl;
  /* score d'un sort pour ce héros : puissance par PA, pondérée par la caractéristique de l'élément (estimée) */
  const spellScore = (c, sp, st) => {
    const g = E.spellGrade(sp, c.lvl); const k = E.spellKind(g); const el = sp.el;
    let sc = E.spellPower(g) / Math.max(1, g.pa);
    if (k === "heal") return 8; if (k === "summon") return 7; if (k === "shield") return 6; if (k === "buff") return 4;
    const me = mainEl(c);
    const est = (x) => (st ? st[(ELEMENTS[x] || {}).stat] || 0 : x === me ? c.lvl * 4 : 0);
    const bestV = st ? Math.max(st.fo || 0, st.ine || 0, st.cha || 0, st.age || 0) : c.lvl * 4;
    const v = el === "best" ? bestV : el ? est(el) : bestV;
    sc *= (1 + v / 100) / (1 + bestV / 100);
    if (g.cd > 1) sc *= 0.85; // sort à relance : utilisable moins souvent
    return sc;
  };
  E.spellScore = spellScore;
  /* meilleure sélection automatique : attaques de l'élément principal + 1 invocation, 1 soin et 1 protection au maximum */
  E.autoLoadout = (c, st) => {
    const known = E.knownSpells(c); const slots = E.spellSlots(c);
    const byPair = {};
    known.forEach((sp) => { const cur = byPair[sp.pair]; if (!cur || spellScore(c, sp, st) > spellScore(c, cur, st)) byPair[sp.pair] = sp; });
    const kinds = { summon: 0, heal: 0, prot: 0 }; const cap = { summon: 1, heal: 1, prot: 1 };
    const cands = Object.values(byPair).map((sp) => { const k = E.spellKind(E.spellGrade(sp, c.lvl)); const g = E.spellGrade(sp, c.lvl); const weak = g.fx.every((f) => f.fb) || (k === "heal" && !g.fx.some((f) => f.k === "healpct") && E.spellPower(g) < 8 + c.lvl * 0.15);
      return { sp, k, cat: weak ? "fill" : k === "summon" ? "summon" : k === "heal" ? "heal" : k === "shield" || k === "buff" ? "prot" : "atk", sc: spellScore(c, sp, st) }; });
    { let m = 0; const mc = E.MEM_SLOTS(c); cands.filter((x) => x.sp.mem).sort((a, b) => b.sc - a.sc).forEach((x) => { if (++m > mc) cands.splice(cands.indexOf(x), 1); }); } // 1.0.35 : sorts d'autres classes, au plus E.MEM_SLOTS
    const atk = cands.filter((x) => x.cat === "atk").sort((a, b) => b.sc - a.sc);
    const util = cands.filter((x) => x.cat !== "atk" && x.cat !== "fill").sort((a, b) => b.sc - a.sc);
    const pickd = [];
    // au moins 3 attaques (ou toutes si moins), puis 1 invocation/soin/protection, puis le reste en attaques
    atk.slice(0, Math.min(3, slots)).forEach((x) => pickd.push(x));
    util.forEach((x) => { if (pickd.length < slots && kinds[x.cat] < cap[x.cat]) { kinds[x.cat]++; pickd.push(x); } });
    atk.slice(3).forEach((x) => { if (pickd.length < slots) pickd.push(x); });
    cands.filter((x) => x.cat === "fill").forEach((x) => { if (pickd.length < slots) pickd.push(x); });
    const old = {}; (c.spells || []).forEach((x) => (old[x.id] = x));
    const order = { summon: 0, prot: 1, heal: 2, atk: 3, fill: 4 };
    pickd.sort((a, b) => order[a.cat] - order[b.cat] || b.sc - a.sc);
    return pickd.map((x) => old[x.sp.id] || { id: x.sp.id, cond: defaultCond(x.sp, c), tgt: "low" });
  };
  /* sorts : sélection automatique tant que le joueur n'a rien modifié à la main */
  E.refreshSpells = (c, st) => {
    const known = E.knownSpells(c); const slots = E.spellSlots(c);
    c.spells = E.memFit(c, c.spells || []);
    if (!c.spellsManual) { c.spells = E.autoLoadout(c, st); c.knownSeen = known.map((s) => s.id); return; }
    const usedPairs = new Set(c.spells.map((x) => E.spellDef(c.cls, x.id).pair));
    const fresh = known.filter((sp) => !(c.knownSeen || []).includes(sp.id) && !usedPairs.has(sp.pair)).sort((a, b) => spellScore(c, b, st) - spellScore(c, a, st));
    let memN = E.memCount(c);
    for (const sp of fresh) { if (c.spells.length >= slots) break; if (usedPairs.has(sp.pair)) continue; if (sp.mem && memN >= E.MEM_SLOTS(c)) continue; if (sp.mem) memN++; c.spells.push({ id: sp.id, cond: defaultCond(sp, c), tgt: "low" }); usedPairs.add(sp.pair); }
    c.knownSeen = known.map((s) => s.id);
  };
  /* équiper un sort : remplace la variante de la même paire si elle est équipée */
  E.equipSpell = (S, c, id) => {
    const sp = E.spellDef(c.cls, id); if (!sp || sp.lvl > c.lvl || (sp.mem && !(c.mem || []).includes(id))) return "Sort non disponible.";
    const i = c.spells.findIndex((x) => E.spellDef(c.cls, x.id).pair === sp.pair);
    if (sp.mem && i < 0 && E.memCount(c) >= E.MEM_SLOTS(c)) return E.MEM_SLOTS(c) > 1 ? `${E.MEM_SLOTS(c)} sorts d'autres classes au plus à cette renaissance.` : "Un seul sort d'une autre classe à cette renaissance (2 dès la Renaissance V, 3 à la X).";
    c.spellsManual = true;
    if (i >= 0) { c.spells[i] = { id, cond: defaultCond(sp, c), tgt: c.spells[i].tgt || "low" }; return null; }
    if (c.spells.length >= E.spellSlots(c)) return `${E.spellSlots(c)} sorts maximum à ce niveau.`;
    c.spells.push({ id, cond: defaultCond(sp, c), tgt: "low" }); return null;
  };

  /* ---------------- Statistiques d'un personnage ---------------- */
  E.itemStats = (it) => it.stats;
  E.setCounts = (S, c) => {
    const counts = {};
    Object.values(c.equip).forEach((uid) => {
      const it = S.items[uid]; if (!it) return;
      const set = ITEMS[it.tpl].set; if (set) counts[set] = (counts[set] || 0) + 1;
    });
    return counts;
  };
  E.setBonus = (setId, n) => {
    const b = SETS[setId]; if (!b) return null;
    let best = null, bestN = 0;
    for (const k in b.bonus) if (+k <= n && +k > bestN) { best = b.bonus[k]; bestN = +k; }
    return best;
  };
  E.charStats = (S, c, opts = {}) => {
    const st = zeroStats();
    BASE_STATS.forEach((k) => (st[k] += (c.alloc[k] || 0) + ((c.scrolls || {})[k] || 0)));
    Object.values(c.equip).forEach((uid) => { const it = S.items[uid]; if (it) { addStats(st, E.isPerfect(it) ? E.perfectStats(it) : it.stats); if (it.exo) st[it.exo] = (st[it.exo] || 0) + 1; } }); // 0.1.8.2 : objets parfaits ; 0.1.9.1 : exo
    const pet = E.petStats(S, c); if (pet) addStats(st, pet); // 0.1.8 : familier ou montilier
    const mt = E.mountStats(S, c); if (mt) addStats(st, mt); // 0.1.9 : monture
    const vt = E.trophyVitrine(S); st.vit += vt.vit; st.sa += vt.sa; // 1.0.20 : Vitrine des trophées, pour tous les héros
    const dpt = E.dofPotStats ? E.dofPotStats(S, c) : null; if (dpt) addStats(st, dpt); // 1.0.30 : Potentiel des Dofus (dofusp.js)
    const counts = E.setCounts(S, c);
    for (const s in counts) { const b = E.setBonus(s, E.setCountFx ? E.setCountFx(S, s, counts[s]) : counts[s]); if (b) addStats(st, b); } // 1.0.30 : Couture fine (collections.js)
    const mf = E.mtFx ? E.mtFx(S, c) : null; // 2.0 « La Maîtrise » (js/maitrise_moteur.js), active au niveau 200
    if (mf) { addStats(st, mf.st); st.cri += mf.cri; st.pa += mf.pa; st.pm += mf.pm; if (mf.res) ["rt", "rf", "re", "ra", "rn"].forEach((k) => (st[k] = (st[k] || 0) + mf.res)); }
    st.hpMax = Math.round((50 + 5 * c.lvl + st.vit + E.familyBonusVit(S)) * (1 + 0.05 * E.eveil(c, "robu")) * (1 + (mf ? mf.hp : 0) / 100));
    if (c.eveils) { // 0.1.12 : Éveils de la Renaissance
      const ec = E.eveil(c, "ecorce"); if (ec) ["rt", "rf", "re", "ra", "rn"].forEach((k) => (st[k] = (st[k] || 0) + 3 * ec));
      st.cri += 3 * E.eveil(c, "lame"); st.pp += 15 * E.eveil(c, "pros");
    }
    st.pa = Math.min(12, 6 + (c.lvl >= 100 ? 1 : 0) + st.pa);
    st.ini += 100 + c.lvl * 5 + st.fo + st.ine + st.cha + st.age;
    return st;
  };

  /* ---------------- Points de caractéristiques ---------------- */
  /* 3.1 : rendements décroissants (barème officiel DOFUS) : 1 point = 1 jusqu'à 100, puis 2, 3 et 4 points pour 1 */
  E.ELEM_STATS = ["fo", "ine", "cha", "age"];
  E.pointCost = (stat, cur = 0) => (stat === "sa" ? 3 : stat === "vit" ? 1 : cur < 100 ? 1 : cur < 200 ? 2 : cur < 300 ? 3 : 4);
  E.allocate = (S, cid, stat, n) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || !BASE_STATS.includes(stat)) return false;
    let done = 0;
    while (done < n) { const cost = E.pointCost(stat, c.alloc[stat]); if (c.pts < cost) break; c.alloc[stat]++; c.pts -= cost; done++; }
    return done > 0;
  };
  /* 3.2.3 : retirer des points (mode manuel) ; on rend le coût du palier où se trouvait le point */
  E.deallocate = (S, cid, stat, n) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || !BASE_STATS.includes(stat)) return false;
    let done = 0;
    while (done < n && c.alloc[stat] > 0) { c.alloc[stat]--; c.pts += E.pointCost(stat, c.alloc[stat]); done++; }
    return done > 0;
  };
  /* passer d'un mode à l'autre sans rien perdre : le manuel garde les points placés, l'automatique retrouve son dernier réglage */
  E.setAllocMode = (S, c, auto) => {
    if (!auto) { if (c.autoStat) c.autoLast = c.autoStat; c.autoStat = null; return; }
    if (!c.autoStat) c.autoStat = c.autoLast || CLASSES[c.cls].main;
    E.autoAllocate(S, c);
  };
  /* 1.0.30 : vrai mode automatique. Un plan = des étapes dans l'ordre (« Force jusqu'à 200 », « Force + Agilité jusqu'à 300 »…)
     puis le reste dans une caractéristique. Le plan s'applique à TOUS les points, recalculé de zéro à chaque niveau et à chaque
     changement de plan (c'est gratuit, comme la réinitialisation) : changer de profil déplace vraiment les points. */
  E.AUTO_CAPS = [100, 200, 300, 400, 9999];
  E.PLAN_MAX = 4;
  const planStats = (k) => String(k || "").split("+").filter((x) => BASE_STATS.includes(x));
  E.planStats = planStats;
  /* plan du héros ; les anciennes sauvegardes (autoStat, autoCap, autoThen) donnent un plan d'une étape */
  E.planOf = (c) => {
    if (Array.isArray(c.autoPlan) && c.autoPlan.length) return c.autoPlan;
    const k = c.autoStat || c.autoLast || CLASSES[c.cls].main;
    return [{ k, to: k === "vit" || k === "sa" ? 9999 : c.autoCap || 200 }];
  };
  E.planRest = (c) => (BASE_STATS.includes(c.autoRest) ? c.autoRest : BASE_STATS.includes(c.autoThen) ? c.autoThen : "vit");
  /* caractéristique d'élément « principale » du plan, pour les sorts et les flèches d'équipement (c.autoStat) */
  E.planMain = (plan, rest) => { const all = plan.flatMap((s) => planStats(s.k)).concat([rest]); return all.find((k) => E.ELEM_STATS.includes(k)) || all[0] || "vit"; };
  /* calcul pur : répartit pts selon le plan, renvoie { alloc, pts } (pts = reste qui ne paie aucun point, ex. 2 points pour la Sagesse) */
  E.planAlloc = (pts, plan, rest) => {
    const alloc = {}; BASE_STATS.forEach((k) => (alloc[k] = 0));
    const fill = (stats, to) => { // à chaque point, la caractéristique la plus basse de l'étape monte (multi-élément équilibré)
      for (;;) {
        const open = stats.filter((k) => alloc[k] < to); if (!open.length) return true;
        const k = open.sort((a, b) => alloc[a] - alloc[b])[0]; const cost = E.pointCost(k, alloc[k]);
        if (pts < cost) return false; alloc[k]++; pts -= cost;
      }
    };
    /* une étape pas encore finie garde les points restants (ex. 1 point quand la Force en coûte 2) : ils servent au niveau suivant */
    if (plan.slice(0, E.PLAN_MAX).every((st) => fill(planStats(st.k), Math.max(1, +st.to || 9999)))) fill(planStats(rest).length ? planStats(rest) : ["vit"], Infinity);
    return { alloc, pts };
  };
  E.setPlan = (S, c, plan, rest) => {
    c.autoPlan = plan.filter((st) => planStats(st.k).length).slice(0, E.PLAN_MAX).map((st) => ({ k: planStats(st.k).join("+"), to: E.AUTO_CAPS.includes(+st.to) ? +st.to : 9999 }));
    if (!c.autoPlan.length) c.autoPlan = [{ k: rest || "vit", to: 9999 }];
    c.autoRest = BASE_STATS.includes(rest) ? rest : "vit";
    c.autoStat = E.planMain(c.autoPlan, c.autoRest); c.autoLast = c.autoStat;
    E.autoAllocate(S, c);
  };
  E.autoAllocate = (S, c) => {
    if (!c.autoStat) return;
    const r = E.planAlloc(Math.max(0, (c.lvl - 1) * 5), E.planOf(c), E.planRest(c));
    BASE_STATS.forEach((k) => (c.alloc[k] = r.alloc[k])); c.pts = r.pts;
  };
  E.SCROLL_MAX = 100;
  /* fabrication de Petits parchemins avec de la poussière de stasis (de plus en plus cher) */
  E.scrollCraftCost = (S, stat) => { const n = (S.scrollCrafted || {})[stat] || 0; return { dust: Math.round(20 * Math.pow(1 + n / 20, 2)), kamas: Math.round(400 * (1 + n / 10)) }; };
  E.craftScroll = (S, stat) => {
    const c = E.scrollCraftCost(S, stat); const have = S.res["Poussière de stasis"] || 0;
    if (have < c.dust) return `Il faut ${c.dust} Poussières de stasis (vous en avez ${have}).`;
    if (S.kamas < c.kamas) return `Il faut ${c.kamas} kamas.`;
    S.res["Poussière de stasis"] -= c.dust; if (!S.res["Poussière de stasis"]) delete S.res["Poussière de stasis"]; S.kamas -= c.kamas;
    S.scrollCrafted = S.scrollCrafted || {}; S.scrollCrafted[stat] = (S.scrollCrafted[stat] || 0) + 1;
    E.addCons(S, "parch_" + stat + "_p", 1); return null;
  };
  E.scrollRoom = (c, stat) => E.SCROLL_MAX - ((c.scrolls || {})[stat] || 0);
  E.resetPoints = (S, cid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return;
    c.pts = (c.lvl - 1) * 5; BASE_STATS.forEach((k) => (c.alloc[k] = 0));
    if (c.autoStat) E.autoAllocate(S, c);
  };

  /* ---------------- Journal & événements ---------------- */
  E.events = [];
  const note = (S, txt, kind = "info") => {
    S.journal.unshift({ t: E.now(), txt, kind });
    if (S.journal.length > 60) S.journal.length = 60;
    E.events.push({ txt, kind });
  };
  E.note = note;
  /* moments de récompense (3.1.3) : grands écrans côté interface, sans entrée de journal */
  E.celebrate = (data) => { E.events.push(Object.assign({ kind: "cele", txt: "" }, data)); };

  /* ---------------- Objets ---------------- */
  /* Objets Rayonnants : très rares, +10 à +50 % sur les statistiques positives de l'objet */
  E.RADIANT_CHANCE = 1 / 400;
  E.RADIANT_SKIP = { pa: 1, pm: 1, po: 1, inv: 1 }; // 1.0.30 : le bonus Rayonnant ne donne pas de PM en plus (un objet à 1 PM reste à 1 PM) ; 1.2.10.2 : ni PA, ni Portée, ni Invocation (avant, l'arrondi au-dessus faisait 1 PA → 2 PA), comme E.PERFECT_SKIP
  E.radiantBonus = () => Math.round(10 + 40 * Math.pow(rnd(), 2.2));
  /* Raretés (3.2) : déduites de l'origine de l'objet. Pour en ajouter une plus tard (ex. Mythique),
     ajouter une entrée ici (dans l'ordre croissant) et la donner aux objets via ITEMS[x].rarity ou la règle ci-dessous. */
  E.RARITIES = [
    { id: "commun", name: "Commun", color: "#b3aa96" },
    { id: "peu", name: "Peu commun", color: "#6fd06a" },
    { id: "rare", name: "Rare", color: "#5fbfff" },
    { id: "epique", name: "Épique", color: "#c77dff" },
    { id: "legendaire", name: "Légendaire", color: "#ff9d3c" },
  ];
  E.RARITY = Object.fromEntries(E.RARITIES.map((r, i) => [r.id, Object.assign({ rank: i }, r)]));
  let rarityCache = null;
  E.rarityOf = (tpl) => {
    if (!rarityCache) {
      rarityCache = {};
      const drop = {};
      for (const k in MONSTERS) (MONSTERS[k].dbItems || MONSTERS[k].items || []).forEach(([id]) => { drop[id] = MONSTERS[k].boss ? "epique" : drop[id] === "epique" ? "epique" : "rare"; });
      for (const id in ITEMS) {
        const T = ITEMS[id];
        rarityCache[id] = E.RARITY[T.rarity] ? T.rarity : T.slot === "dofus" ? "legendaire" : drop[id] || (T.set ? "peu" : "commun");
      }
    }
    return rarityCache[tpl] || "commun";
  };
  E.rollItem = (S, tpl, opts = {}) => {
    const T = ITEMS[tpl];
    /* 1.0.6 : bonus des Galets (fabrication) : floor = part basse de la fourchette sautée, one = une caractéristique dans sa moitié haute,
       best2 = deux tirages, le meilleur gardé, rad = chance de Rayonnant relevée */
    const draw = () => { const r = {}; for (const k in T.stats) { const [a, b] = T.stats[k]; let lo = a;
      if (b > a && opts.floor) lo = Math.ceil(a + (b - a) * opts.floor); if (b > a && opts.one === k) lo = Math.max(lo, Math.ceil((a + b) / 2)); r[k] = ri(lo, b); } return r; };
    const score = (r) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += b === a ? 1 : (r[k] - a) / (b - a); } return s; };
    let roll = draw(); if (opts.best2) { const r2 = draw(); if (score(r2) > score(roll)) roll = r2; }
    const it = { uid: S.nextUid++, tpl, stats: Object.assign({}, roll) };
    let chance = opts.radiant === true ? 1 : E.RADIANT_CHANCE * (opts.archi ? 5 : 1) * (opts.champ ? 2 : 1) * E.radiantMult(S);
    if (opts.rad && opts.radiant !== true) chance = Math.max(chance, opts.rad * E.radiantMult(S));
    if (opts.radiant !== false && rnd() < chance) {
      it.radiant = E.radiantBonus(); it.roll = roll;
      for (const k in it.stats) if (it.stats[k] > 0 && !E.RADIANT_SKIP[k]) it.stats[k] = Math.ceil(it.stats[k] * (1 + it.radiant / 100));
      S.radiants = (S.radiants || 0) + 1;
      note(S, `✦ Objet Rayonnant : ${T.name} (+${it.radiant} %) !`, "radiant");
      E.celebrate({ t: "radiant", tpl, pct: it.radiant });
    }
    S.items[it.uid] = it; if (E.wardrobeAdd) E.wardrobeAdd(S, tpl); if (E.itemDexAdd) E.itemDexAdd(S, tpl); // 0.1.19 : garde-robe, 1.0.8.3 : Encyclopédie
    bagChk = true;
    return it;
  };
  /* 0.1.37 : Coffre de trop-plein. Quand le sac dépasse sa taille, les objets les plus récents (après les règles
     automatiques) vont dans S.over, une file de 200 places (+10 par niveau de Grenier). Quand le coffre est plein,
     le plus ancien est brisé en runes. Rien n'est plus perdu. */
  let bagChk = false;
  E.OVER_CAP = 200;
  E.overCap = (S) => E.OVER_CAP + 10 * ((S.havre && S.havre.bag) || 0);
  const overBreakOne = (S, o) => { const uid = o.uid; delete o.at; S.items[uid] = Object.assign({}, o, { uid }); delete S.items[uid].locked; return E.breakItem(S, uid, null); };
  E.bagFlush = (S) => {
    bagChk = false; if (!S || !S.items) return 0;
    if (!Array.isArray(S.over)) S.over = [];
    let n = 0; const cap = E.itemCap(S);
    let count = Object.keys(S.items).length; if (count <= cap) return 0;
    const free = Object.keys(S.items).map(Number).sort((a, b) => b - a).filter((u) => { const it = S.items[u]; return !it.locked && !E.equippedBy(S, u) && !E.inGear(S, u) && !(ITEMS[it.tpl] && ITEMS[it.tpl].slot === "dofus"); }); // 1.0.32.11 : un Dofus reste toujours dans le sac (avant : le Dofus d'une quête finie, le plus récent, partait au trop-plein)
    const now = E.now(); const broken = [];
    for (const u of free) { if (count <= cap) break; const it = S.items[u]; delete S.items[u]; S.over.push(Object.assign({}, it, { at: now })); count--; n++; }
    while (S.over.length > E.overCap(S)) { const o = S.over.shift(); if (ITEMS[o.tpl] && ITEMS[o.tpl].slot === "dofus") { delete o.at; S.items[o.uid] = o; continue; } overBreakOne(S, o); broken.push(ITEMS[o.tpl] ? ITEMS[o.tpl].name : o.tpl); }
    if (n) { S.overNew = (S.overNew || 0) + n; S.cnt = S.cnt || {}; note(S, `Sac plein : ${n > 1 ? `${n} objets rangés` : `${ITEMS[S.over[S.over.length - 1].tpl].name} rangé`} dans le trop-plein.`, "warn"); }
    if (broken.length) note(S, `Trop-plein plein : ${broken.length > 1 ? `${broken.length} objets les plus anciens brisés` : `${broken[0]} brisé`} en runes.`, "warn");
    return n;
  };
  const overIdx = (S, uid) => (Array.isArray(S.over) ? S.over.findIndex((o) => o.uid === +uid) : -1);
  E.overTake = (S, uid) => {
    const i = overIdx(S, uid); if (i < 0) return "Objet introuvable.";
    if (E.itemCount(S) >= E.itemCap(S)) return "Sac plein : fais de la place d'abord.";
    const o = S.over.splice(i, 1)[0]; delete o.at; S.items[o.uid] = o; return null;
  };
  /* 1.0.34.2 : « Tout prendre » : remet dans le sac autant d'objets du trop-plein que la place le permet (les plus récents d'abord). */
  E.overTakeAll = (S) => {
    if (!Array.isArray(S.over)) S.over = [];
    let n = 0; let room = E.itemCap(S) - E.itemCount(S);
    while (room > 0 && S.over.length) { const o = S.over.pop(); delete o.at; S.items[o.uid] = o; room--; n++; }
    if (!S.over.length) S.overNew = 0;
    return { n, left: S.over.length };
  };
  E.overBreak = (S, uid) => { const i = overIdx(S, uid); if (i < 0) return "Objet introuvable."; return overBreakOne(S, S.over.splice(i, 1)[0]); };
  E.overBreakAll = (S) => { const got = {}; let n = 0; (S.over || []).splice(0).forEach((o) => { const r = overBreakOne(S, o); if (r && typeof r === "object") { n++; for (const k in r) got[k] = (got[k] || 0) + r[k]; } }); return { n, got }; };
  /* « Briser les doublons » : garde le meilleur jet de chaque objet (Rayonnant d'abord) et brise les autres.
     Jamais : objets portés, verrouillés, rangés dans une tenue, Rayonnants, exo, parfaits, trophées et Dofus. */
  E.dupesList = (S) => {
    const by = {}; Object.values(S.items).forEach((it) => { (by[it.tpl] = by[it.tpl] || []).push(it); });
    const out = [];
    for (const tpl in by) {
      const T = ITEMS[tpl]; if (!T || T.slot === "dofus" || T.trophy || T.leg || by[tpl].length < 2) continue;
      const L = by[tpl].slice().sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || E.itemQuality(b) - E.itemQuality(a));
      L.slice(1).forEach((it) => { if (!it.radiant && !it.exo && !it.locked && !E.equippedBy(S, it.uid) && !E.inGear(S, it.uid) && !(E.isPerfect && E.isPerfect(it))) out.push(it.uid); });
    }
    return out;
  };
  E.breakDupes = (S) => { const got = {}; let n = 0; E.dupesList(S).forEach((u) => { const r = E.breakItem(S, u, null); if (r && typeof r === "object") { n++; for (const k in r) got[k] = (got[k] || 0) + r[k]; } }); return { n, got }; };
  E.itemQuality = (it) => {
    const T = ITEMS[it.tpl]; const base = it.roll || it.stats; let s = 0, n = 0;
    for (const k in T.stats) { const [a, b] = T.stats[k]; s += b === a ? 1 : (base[k] - a) / (b - a); n++; }
    return n ? s / n : 1;
  };
  E.qualityTier = (q) => (q >= 0.999 ? "parfait" : q >= 0.8 ? "excellent" : q >= 0.5 ? "bon" : "commun");
  E.itemCount = (S) => Object.keys(S.items).length;
  E.ITEM_CAP = 3000; // 0.1.37 : 300 → 1 000 places ; 1.0.33.1 : 3 000 places
  E.itemCap = (S) => E.ITEM_CAP + Math.round(E.bonus(S, "bag"));
  E.equippedBy = (S, uid) => S.chars.find((c) => Object.values(c.equip).includes(uid));
  E.slotFor = (c, it) => {
    const slot = ITEMS[it.tpl].slot;
    if (slot === "dofus") return DOFUS_SLOTS.find((s) => !c.equip[s]) || "dofus1";
    if (slot !== "anneau") return slot;
    if (!c.equip.anneau1) return "anneau1";
    if (!c.equip.anneau2) return "anneau2";
    return "anneau1";
  };
  E.equip = (S, cid, uid, slotOverride) => {
    const c = S.chars.find((x) => x.id === cid); const it = S.items[uid];
    if (!c || !it) return "Objet introuvable.";
    const T = ITEMS[it.tpl];
    if (T.trophy) return "Les trophées ne s'équipent plus : leur bonus agit tout seul.";
    if (T.lvl > c.lvl) return `Niveau ${T.lvl} requis.`;
    if (it.exo && (E.EXO_ONE || ["pa"]).includes(it.exo) && Object.entries(c.equip).some(([sl, u]) => u !== uid && sl !== slotOverride && S.items[u] && S.items[u].exo === it.exo)) return `Ce héros porte déjà un objet exo ${STATS[it.exo].short} (un seul par héros).`; // 0.1.41 : PA, PM et Po
    const other = E.equippedBy(S, uid);
    if (other) for (const k in other.equip) if (other.equip[k] === uid) delete other.equip[k];
    // un anneau identique ne peut être porté deux fois (comme dans Dofus)
    if (T.slot === "anneau") {
      const o = slotOverride || E.slotFor(c, it); const otherSlot = o === "anneau1" ? "anneau2" : "anneau1";
      const ou = c.equip[otherSlot];
      if (ou && S.items[ou] && S.items[ou].tpl === it.tpl) return "Vous portez déjà cet anneau.";
      c.equip[o] = uid; E.emit(S, "equip", {}); return null;
    }
    if (T.slot === "dofus") {
      const o = slotOverride && slotOverride.startsWith("dofus") ? slotOverride : E.slotFor(c, it);
      if (DOFUS_SLOTS.some((s) => s !== o && c.equip[s] && S.items[c.equip[s]] && S.items[c.equip[s]].tpl === it.tpl)) return ITEMS[it.tpl].dofus ? "Ce héros porte déjà ce Dofus." : "Vous portez déjà ce trophée.";
      c.equip[o] = uid; return null;
    }
    c.equip[slotOverride || T.slot] = uid; E.emit(S, "equip", {}); return null;
  };
  E.unequip = (S, cid, slot) => { const c = S.chars.find((x) => x.id === cid); if (c) delete c.equip[slot]; };

  /* 0.1.38 : plus de vente au jeu depuis l'inventaire (tout passe par l'hôtel de vente).
     Seul le marchand de secours rachète le surplus automatique (limites de stock et de banque), à 30 % de l'ancien prix. */
  E.MERCHANT = 0.3;
  E.merchantPrice = (name, n = 1) => Math.floor(E.resPrice(name) * n * E.MERCHANT);
  E.merchantRes = (S, name, qty) => {
    const have = S.res[name] || 0; const n = Math.min(have, qty); if (n <= 0) return 0;
    const p = E.merchantPrice(name, n); S.res[name] -= n; if (!S.res[name]) delete S.res[name]; S.kamas += p; return p;
  };
  const addRes = (S, name, n = 1) => { S.res[name] = (S.res[name] || 0) + n; };
  E.addRes = addRes;

  /* ---------------- Déblocages ---------------- */
  E.zoneUnlocked = (S, zid) => {
    const z = ZONES.find((x) => x.id === zid); if (!z) return false;
    if (z.requires && z.requires.boss) return (S.progress.bossKills[z.requires.boss] || 0) > 0;
    return true;
  };
  E.WINS_TO_UNLOCK = 12;
  E.COBOSS_EQ = 0.75; // 1.0.4.2 : boss jumeaux à parts égales, PV totaux un peu réduits (tous frappent jusqu'au bout, réglé par simulation)
  E.COBOSS_HP = 0.4; // 0.1.40 : part des PV d'un boss principal pour chaque boss qui l'accompagne (Gelées Royales)
  E.subUnlocked = (S, sid) => {
    const s = SUBS[sid]; if (!s || !E.zoneUnlocked(S, s.zone)) return false;
    if (s.requiresItem) {
      if ((S.res[s.requiresItem] || 0) > 0 || (S.progress.hiddenOpen || {})[sid]) return true;
      /* 1.0.4 : la Baguette Rikiki existe aussi en arme (Sculpteur, butin) : la posséder dans le sac ou équipée ouvre aussi le lieu, et il reste ouvert ensuite */
      const own = Object.values(S.items || {}).some((it) => ITEMS[it.tpl] && ITEMS[it.tpl].name === s.requiresItem);
      if (own) (S.progress.hiddenOpen = S.progress.hiddenOpen || {})[sid] = 1;
      return own;
    }
    return true;
  };
  E.dungeonUnlocked = (S, did) => E.subUnlocked(S, DUNGEON_SUB[did]) && ((DUNGEONS[did] || {}).needs || []).every((d) => (S.progress.bossKills[d] || 0) > 0);
  E.setSub = (S, sid) => {
    if (!E.subUnlocked(S, sid)) return false;
    S.sub = sid; if (!S.dungeon) S.fight = null; return true;
  };
  /* Chasse : on choisit une sous-zone et l'équipe y combat en boucle */
  E.startHunt = (S, sid) => {
    if (S.dungeon) return "Vous êtes en donjon.";
    if (E.expActive && E.expActive(S)) return "L'équipe est dans le Songe infini : réveille-la d'abord (Aventure › Songe infini).";
    if (!E.setSub(S, sid)) return "Sous-zone verrouillée.";
    pinStars(S, sid); // les étoiles cessent de monter et fondent à partir de maintenant
    S.hunting = true; S.fight = null; S.pause = E.PAUSE_MS;
    E.applyZonePresets(S, sid);
    note(S, `Chasse : ${SUBS[sid].name}`, "info");
    return null;
  };
  E.stopHunt = (S) => { if (S.dungeon) return "Quittez d'abord le donjon."; if (E.expActive && E.expActive(S)) return "Abandonne d'abord l'expédition."; S.hunting = false; S.fight = null; return null; };

  /* ---------------- Étoiles de zone (0.1.8.1) ----------------
     Une zone où personne ne chasse gagne une étoile toutes les 2 h (5 au plus) ; chacune donne +10 % d'XP et de butin.
     Elles fondent pendant qu'on y chasse (une toutes les 30 min, en ligne comme hors ligne).
     S.zstars[sid] = { s: étoiles au moment at, at } ; sans fiche, la zone accumule depuis la création de la partie. */
  E.STAR_MAX = 5; E.STAR_GROW_S = 7200; E.STAR_MELT_S = 1800; E.STAR_PCT = 10;
  const huntingHere = (S, sid) => S.hunting && S.sub === sid && !S.dungeon;
  E.zoneStars = (S, sid, now = E.now()) => {
    const rec = S.zstars && S.zstars[sid];
    if (!rec) return clamp((now - (S.created || now)) / 1000 / E.STAR_GROW_S, 0, E.STAR_MAX);
    if (huntingHere(S, sid)) return rec.s;
    return clamp(rec.s + Math.max(0, now - rec.at) / 1000 / E.STAR_GROW_S, 0, E.STAR_MAX);
  };
  /* fige la valeur courante (à l'arrivée dans la zone : la fonte part de là) */
  const pinStars = (S, sid, now = E.now()) => { if (!S.zstars) S.zstars = {}; const rec = S.zstars[sid]; /* 0.1.10.2 : la pousse est comptée même si S.sub vient de passer sur cette zone */
    S.zstars[sid] = { s: rec ? clamp(rec.s + Math.max(0, now - rec.at) / 1000 / E.STAR_GROW_S, 0, E.STAR_MAX) : E.zoneStars(S, sid, now), at: now }; };
  /* fonte pendant la chasse : dtS secondes de chasse dans la zone courante */
  E.starsTick = (S, dtS, now = E.now()) => {
    if (!S.hunting || !S.sub || S.dungeon) return;
    if (!S.zstars || !S.zstars[S.sub]) pinStars(S, S.sub, now);
    const rec = S.zstars[S.sub]; rec.s = Math.max(0, rec.s - dtS / E.STAR_MELT_S); rec.at = now;
  };
  E.starBonus = (S) => (S.hunting && S.sub && !S.dungeon ? Math.floor(E.zoneStars(S, S.sub)) * E.STAR_PCT : 0); // étoiles entières seulement

  /* ---------------- Chasse itinérante (0.1.10.2) ----------------
     Option : après une victoire, l'équipe part vers la zone de son niveau (sans perte d'XP) qui a le plus d'étoiles,
     si elle en a au moins 2 de plus que la zone actuelle, au plus une fois toutes les 10 min, en ligne comme hors ligne.
     En échange (demande de Mathis) : XP et butin réduits de E.ROAM_MALUS tant que l'option est active. */
  E.ROAM_MALUS = 0.15; E.ROAM_GAP_S = 600; E.ROAM_MIN = 2;
  E.roamOn = (S) => !!(S.settings && S.settings.roam && S.hunting && S.sub && !S.dungeon);
  E.roamMult = (S) => (E.roamOn(S) ? 1 - E.ROAM_MALUS : 1);
  E.roamCands = (S) => {
    const team = E.team(S); if (!team.length) return [];
    const avg = team.reduce((s, c) => s + c.lvl, 0) / team.length;
    return Object.values(SUBS).filter((s) => !s.hidden && E.subUnlocked(S, s.id) && s.lvl[0] <= avg + 1 && s.lvl[1] >= avg - 4);
  };
  E.roam = (S, t = E.now(), offline = false) => {
    if (!E.roamOn(S) || t - (S.roamAt || 0) < E.ROAM_GAP_S * 1000) return null;
    const cur = Math.floor(E.zoneStars(S, S.sub, t)); if (cur >= E.STAR_MAX - 1) return null;
    const best = E.roamCands(S).filter((s) => s.id !== S.sub).map((s) => ({ s, n: Math.floor(E.zoneStars(S, s.id, t)) })).filter((x) => x.n >= Math.max(E.ROAM_MIN, cur + 2))
      .sort((a, b) => b.n - a.n || (b.s.lvl[0] + b.s.lvl[1]) - (a.s.lvl[0] + a.s.lvl[1]))[0];
    if (!best) return null;
    if (!S.zstars) S.zstars = {};
    if (S.zstars[S.sub]) S.zstars[S.sub].at = t; // la zone quittée recommence à gagner des étoiles à partir de maintenant
    S.roamAt = t;
    if (offline) { if (!E.setSub(S, best.s.id)) return null; pinStars(S, best.s.id, t); }
    else { if (E.startHunt(S, best.s.id)) return null; note(S, `Chasse itinérante : l'équipe part pour ${best.s.name} (${"★".repeat(best.n)}).`, "up"); }
    S.roamLog = [best.s.id].concat(S.roamLog || []).slice(0, 10); S._az = 0; S.stats.recent.length = 0;
    return best.s;
  };

  /* ---------------- Stratégies (préréglages de sorts) ---------------- */
  E.MAX_PRESETS = 4;
  E.savePreset = (S, cid, idx, name) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || idx < 0 || idx >= E.MAX_PRESETS) return;
    c.presets[idx] = { name: (name || `Stratégie ${idx + 1}`).slice(0, 24), spells: c.spells.map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt })) };
    if (c.atkMode === "ordre") c.presets[idx].am = "ordre"; // 2.1.21 : « Mon ordre » est gardé dans la stratégie
    c.activePreset = idx;
  };
  E.applyPreset = (S, cid, idx) => {
    const c = S.chars.find((x) => x.id === cid); const p = c && c.presets[idx]; if (!p) return false;
    c.spells = E.memFit(c, p.spells).slice(0, E.spellSlots(c)).map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt || "low" })); c.spellsManual = true;
    if (p.am === "ordre") c.atkMode = "ordre"; else delete c.atkMode;
    c.activePreset = idx; return true;
  };
  E.deletePreset = (S, cid, idx) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return;
    c.presets[idx] = null; if (c.activePreset === idx) c.activePreset = null;
    for (const z in c.zonePreset) if (c.zonePreset[z] === idx) delete c.zonePreset[z];
  };
  E.setZonePreset = (S, cid, zkey, idx) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return;
    if (idx === null || idx === undefined || idx < 0) delete c.zonePreset[zkey]; else c.zonePreset[zkey] = idx;
  };
  E.applyZonePresets = (S, zkey) => { S.chars.forEach((c) => { const i = c.zonePreset && c.zonePreset[zkey]; if (i !== undefined && c.presets[i]) E.applyPreset(S, c.id, i); }); };

  /* ---------------- Tenues (3.1.3) : préréglages d'équipement ---------------- */
  E.MAX_GEAR = 3;
  E.saveGear = (S, cid, idx, name) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || idx < 0 || idx >= E.MAX_GEAR) return;
    c.gear = c.gear || [];
    c.gear[idx] = { name: (name || (c.gear[idx] && c.gear[idx].name) || `Tenue ${idx + 1}`).slice(0, 24), eq: Object.assign({}, c.equip) };
    E.syncGearLocks(S);
  };
  /* remet la tenue : les objets portés par un autre héros changent de main, les objets vendus ou brisés sont ignorés */
  E.applyGear = (S, cid, idx) => {
    const c = S.chars.find((x) => x.id === cid); const g = c && c.gear && c.gear[idx]; if (!g) return null;
    let missing = 0;
    for (const sl of Object.keys(c.equip)) if (!g.eq[sl]) delete c.equip[sl];
    for (const [sl, uid] of Object.entries(g.eq)) {
      if (c.equip[sl] === uid) continue;
      const it = S.items[uid];
      if (!it || ITEMS[it.tpl].lvl > c.lvl) { missing++; continue; }
      const other = E.equippedBy(S, uid); if (other) for (const k in other.equip) if (other.equip[k] === uid) delete other.equip[k];
      c.equip[sl] = uid;
    }
    E.emit(S, "equip", {});
    return { missing };
  };
  E.deleteGear = (S, cid, idx) => { const c = S.chars.find((x) => x.id === cid); if (c && c.gear) c.gear[idx] = null; E.syncGearLocks(S); };
  E.gearMissing = (S, c, g) => Object.values(g.eq).filter((uid) => !S.items[uid]).length;
  /* un objet rangé dans une tenue est protégé comme un objet porté (ni vendu, ni brisé) */
  E.inGear = (S, uid) => S.chars.find((c) => (c.gear || []).some((g) => g && Object.values(g.eq).includes(uid))) || null;
  E.gearOf = (S, uid) => { for (const c of S.chars) for (const g of (c.gear || [])) if (g && Object.values(g.eq).includes(uid)) return { c, g }; return null; };
  /* 1.0.25.11 « Tenues verrouillées » : enregistrer une tenue pose le cadenas sur ses objets (marqués glock) ;
     il s'enlève tout seul quand l'objet ne fait plus partie d'aucune tenue. Un cadenas posé à la main reste. */
  E.syncGearLocks = (S) => {
    const inG = new Set(); S.chars.forEach((c) => (c.gear || []).forEach((g) => { if (g) Object.values(g.eq).forEach((u) => inG.add(+u)); }));
    for (const uid in S.items) {
      const it = S.items[uid];
      if (inG.has(+uid)) { if (!it.locked) { it.locked = true; it.glock = 1; } }
      else if (it.glock) { delete it.locked; delete it.glock; }
    }
  };

  /* ---------------- Codes de build (3.1.3) : partager sorts, caractéristiques et équipement ---------------- */
  E.BUILD_PREFIX = "IDLUS1-";
  const b64e = (str) => (typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, "utf8").toString("base64"));
  const b64d = (str) => (typeof atob !== "undefined" ? decodeURIComponent(escape(atob(str))) : Buffer.from(str, "base64").toString("utf8"));
  E.buildCode = (S, c) => {
    const eq = {}; for (const sl in c.equip) { const it = S.items[c.equip[sl]]; if (it) eq[sl] = it.tpl; }
    const o = { v: 1, cls: c.cls, lvl: c.lvl, n: c.name, st: Object.assign({}, c.alloc), as: c.autoStat || "", ac: c.autoCap || 200, at: c.autoThen || "vit", ap: c.autoStat ? E.planOf(c) : undefined, ar: c.autoStat ? E.planRest(c) : undefined,
      sp: c.spells.map((x) => [x.id, x.cond || "", x.tgt || "low"]), eq };
    return E.BUILD_PREFIX + b64e(JSON.stringify(o));
  };
  /* lecture d'un code collé par un autre joueur : tout est vérifié, rien n'est exécuté */
  E.parseBuild = (txt) => {
    const t = String(txt || "").trim().replace(/\s+/g, "");
    if (!t.startsWith(E.BUILD_PREFIX) || t.length > 4000) return null;
    let o; try { o = JSON.parse(b64d(t.slice(E.BUILD_PREFIX.length))); } catch (e) { return null; }
    if (!o || typeof o !== "object" || !CLASSES[o.cls]) return null;
    const lvl = clamp(Math.round(+o.lvl || 1), 1, E.MAX_LVL || 200);
    const st = {}; BASE_STATS.forEach((k) => (st[k] = clamp(Math.round(+((o.st || {})[k]) || 0), 0, 2000)));
    const sp = (Array.isArray(o.sp) ? o.sp : []).filter((x) => Array.isArray(x) && E.spellDef(o.cls, x[0])).slice(0, 8)
      .map(([id, cond, tgt]) => ({ id, cond: D.CONDITIONS[cond] ? cond : undefined, tgt: D.TARGETS[tgt] ? tgt : "low" }));
    const eq = {}; for (const [sl, tpl] of Object.entries(o.eq || {})) if (D.SLOTS[sl] && ITEMS[tpl]) eq[sl] = tpl;
    return { cls: o.cls, lvl, name: String(o.n || "").slice(0, 20), st, as: BASE_STATS.includes(o.as) ? o.as : "", ac: E.AUTO_CAPS.includes(+o.ac) ? +o.ac : 200,
      at: BASE_STATS.includes(o.at) ? o.at : "vit", sp, eq,
      ap: Array.isArray(o.ap) ? o.ap.slice(0, E.PLAN_MAX).filter((x) => x && E.planStats(x.k).length).map((x) => ({ k: E.planStats(x.k).join("+"), to: E.AUTO_CAPS.includes(+x.to) ? +x.to : 9999 })) : null,
      ar: BASE_STATS.includes(o.ar) ? o.ar : null };
  };
  E.applyBuild = (S, cid, b) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || !b) return "Héros introuvable.";
    if (c.cls !== b.cls) return `Ce build est pour un ${CLASSES[b.cls].name}.`;
    c.spells = E.memFit(c, b.sp).slice(0, E.spellSlots(c)).map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt }));
    c.spellsManual = true; c.activePreset = null;
    c.autoStat = b.as || null; c.autoCap = b.ac; c.autoThen = b.at;
    c.autoPlan = b.as && b.ap && b.ap.length ? b.ap : b.as ? [{ k: b.as, to: b.as === "vit" || b.as === "sa" ? 9999 : b.ac }] : c.autoPlan; c.autoRest = b.ar || b.at;
    c.pts = (c.lvl - 1) * 5; BASE_STATS.forEach((k) => (c.alloc[k] = 0));
    if (c.autoStat) E.autoAllocate(S, c);
    else { // même répartition, ramenée au niveau du héros
      const r = b.lvl > 1 ? Math.min(1, (c.lvl - 1) / (b.lvl - 1)) : 1;
      BASE_STATS.slice().sort((x, y) => b.st[y] - b.st[x]).forEach((k) => { const want = Math.floor(b.st[k] * r); if (want > 0) E.allocate(S, c.id, k, want); });
      if (c.pts > 0) E.allocate(S, c.id, b.at || "vit", c.pts);
    }
    E.refreshSpells(c, E.charStats(S, c));
    return null;
  };

  /* 2.1.8 « Copier le setup » : recopier le réglage d'un héros sur un autre (caractéristiques, sorts et stratégies,
     arbre de Maîtrise, équipement). L'équipement n'est jamais dupliqué : on prend dans le sac une copie libre du même objet
     (ni portée, de préférence hors tenue) ; ce qui manque est listé. Sorts et Maîtrise : même classe seulement. */
  E.setupPower = (it) => { let s = 0; for (const k in it.stats || {}) s += (+it.stats[k] || 0) * ((STATS[k] && STATS[k].w) || 1); return s; };
  E.setupPlan = (S, fromId, toId) => {
    const a = S.chars.find((x) => x.id === fromId), c = S.chars.find((x) => x.id === toId); if (!a || !c || a === c) return null;
    const same = a.cls === c.cls;
    const eq = [], used = new Set();
    for (const sl of Object.keys(a.equip)) {
      const src = S.items[a.equip[sl]]; if (!src || !ITEMS[src.tpl]) continue; const T = ITEMS[src.tpl];
      const mine = S.items[c.equip[sl]]; if (mine && mine.tpl === src.tpl) { eq.push({ sl, tpl: src.tpl, st: "ok" }); continue; }
      if (T.lvl > c.lvl) { eq.push({ sl, tpl: src.tpl, st: "lvl" }); continue; }
      const alt = Object.values(S.items).filter((it) => it.tpl === src.tpl && !used.has(it.uid) && !E.equippedBy(S, it.uid))
        .sort((x, y) => (E.inGear(S, x.uid) ? 1 : 0) - (E.inGear(S, y.uid) ? 1 : 0) || E.setupPower(y) - E.setupPower(x))[0];
      if (alt) { used.add(alt.uid); eq.push({ sl, tpl: src.tpl, st: "take", uid: alt.uid }); } else eq.push({ sl, tpl: src.tpl, st: "miss" });
    }
    let mt = null;
    if (same && E.mtOn && E.mtOn(a) && E.mtOn(c) && a.mt) {
      const want = [...E.mtGot(a)]; const ids = E.mtClean(c, want); const got = E.mtGot(c); const keep = new Set(ids);
      const usedT = got.size - 1; const rm = [...got].filter((x) => !keep.has(x)).length - 1; // l'étoile de départ n'est jamais dans ids
      const nIds = ids.length; const free = E.mtFreeWeek && E.mtFreeWeek();
      const cost = free ? 0 : Math.max(0, Math.min(rm, usedT - E.MT_FREE)) * E.MT_RESPEC;
      mt = { ids, want: want.length - 1, n: nIds, rm, cost };
    }
    return { a, c, same, eq, mt };
  };
  E.copySetup = (S, fromId, toId, what) => {
    const P = E.setupPlan(S, fromId, toId); if (!P) return { err: "Héros introuvable." };
    const { a, c } = P; const out = { st: false, sp: false, mt: 0, eq: 0, miss: [], err: null };
    if (what.mt && P.mt && P.mt.cost > S.kamas) return { err: `Pas assez de kamas : changer l'arbre de Maîtrise coûte ${P.mt.cost.toLocaleString("fr-FR")} kamas.` };
    if (what.st) {
      c.autoStat = a.autoStat || null; c.autoCap = a.autoCap || 200; c.autoThen = a.autoThen || "vit";
      c.autoPlan = a.autoPlan ? JSON.parse(JSON.stringify(a.autoPlan)) : c.autoPlan; c.autoRest = a.autoRest || c.autoRest;
      c.pts = (c.lvl - 1) * 5; BASE_STATS.forEach((k) => (c.alloc[k] = 0));
      if (c.autoStat) E.autoAllocate(S, c);
      else { const r = a.lvl > 1 ? Math.min(1, (c.lvl - 1) / (a.lvl - 1)) : 1;
        BASE_STATS.slice().sort((x, y) => (a.alloc[y] || 0) - (a.alloc[x] || 0)).forEach((k) => { const want = Math.floor((a.alloc[k] || 0) * r); if (want > 0) E.allocate(S, c.id, k, want); }); }
      out.st = true;
    }
    if (what.sp && P.same) {
      const cp = (L) => L.map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt || "low" }));
      c.spells = E.memFit(c, cp(a.spells)).slice(0, E.spellSlots(c)).map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt || "low" }));
      c.presets = (a.presets || []).map((p) => (p ? Object.assign({ name: p.name, spells: cp(p.spells || []) }, p.am === "ordre" ? { am: "ordre" } : {}) : null));
      if (a.atkMode === "ordre") c.atkMode = "ordre"; else delete c.atkMode;
      c.activePreset = a.activePreset != null && c.presets[a.activePreset] ? a.activePreset : null;
      c.zonePreset = Object.assign({}, a.zonePreset || {}); c.spellsManual = true; out.sp = true;
    }
    if (what.mt && P.mt) {
      const M = E.mt(c); S.kamas -= P.mt.cost; M.t[M.lo] = P.mt.ids.slice(); const keep = new Set(P.mt.ids);
      for (const id in M.j) if (!keep.has(+id)) delete M.j[id]; M.obj = null; out.mt = P.mt.n;
    }
    if (what.eq) {
      for (const e of P.eq) {
        if (e.st === "ok") { out.eq++; continue; }
        if (e.st !== "take") { out.miss.push({ tpl: e.tpl, why: e.st }); continue; }
        const r = E.equip(S, c.id, e.uid, e.sl); if (r) out.miss.push({ tpl: e.tpl, why: "ko", msg: r }); else out.eq++;
      }
      if (E.syncGearLocks) E.syncGearLocks(S);
    }
    E.refreshSpells(c, E.charStats(S, c));
    return out;
  };

  /* ---------------- Création des entités de combat ---------------- */
  /* 3.1 : compensation des paliers de caractéristiques (les héros ont moins de stat d'élément à haut niveau) */
  E.MON_HP_CURVE = [[36, 1], [48, 0.8], [64, 0.78], [76, 0.74], [88, 0.66], [100, 0.64], [120, 0.6], [200, 0.5]];
  E.monHpLvl = (l) => { const T = E.MON_HP_CURVE; if (l <= T[0][0]) return 1; for (let i = 1; i < T.length; i++) if (l <= T[i][0]) { const [a, va] = T[i - 1], [b, vb] = T[i]; return va + (vb - va) * (l - a) / (b - a); } return T[T.length - 1][1]; };
  /* 0.1 : au-delà du niveau 100, les objets DofusDB grimpent bien plus vite que les monstres ; PV et dégâts montent jusqu'à ×1,4 et ×1,35 au niveau 200 (simulation) */
  E.MON_HI = { hp: 1.4, dmg: 1.35 };
  const HI = (l, x) => 1 + (x - 1) * Math.max(0, Math.min(1, (l - 100) / 100));
  /* 0.1.12.3 : sans équipement, une équipe doit perdre (sauf aux premiers niveaux) : PV et dégâts des monstres multipliés
     selon leur niveau, par paliers [niveau, ×PV, ×dégâts] reliés en ligne droite, séparément en chasse et en donjon ;
     « rew » rend l'XP et le butin par monstre en proportion des PV en plus */
  /* 0.1.23.1 : en chasse, la montée commence au niveau 20 et finit au niveau 40 (avant : de 15 à 30) ; les zones 22-30
     (Bouftous, Tainéla, Égouts…) restent jouables sans équipement, le mur arrive avec les zones 32-40 ; groupes de 4 dès ces zones-là */
  E.MON_POW = {
    hunt: [[20, 1, 1], [30, 2.6, 2.4], [40, 4.5, 4]],
    dg: [[20, 1, 1], [90, 1.3, 2.2], [130, 1.3, 2.2], [180, 1.1, 1.6]],
    minGroup: (sub) => (sub && sub.lvl && sub.lvl[1] >= 33 ? 4 : 1), rew: 0.57,
  };
  E.monPow = (l, k, where) => {
    const P = E.MON_POW[where], j = k === "hp" ? 1 : 2;
    if (l <= P[0][0]) return P[0][j];
    for (let i = 1; i < P.length; i++) if (l < P[i][0]) { const a = P[i - 1], b = P[i]; return a[j] + (b[j] - a[j]) * (l - a[0]) / (b[0] - a[0]); }
    return P[P.length - 1][j];
  };
  E.powRew = (mons, where, sm = 1) => { const pw = mons.reduce((a, m) => a + 1 + (E.monPow(m.lvl, "hp", where) - 1) * sm, 0) / Math.max(1, mons.length); return Math.max(1, 1 + (pw - 1) * E.MON_POW.rew); };
  E.huntMon = (n) => (E.HUNT_SMALL[n] && E.HUNT_SMALL[n].mon) || 1; // 0.1.24.3 : petite équipe en chasse, part du renfort gardée
  // 0.1.12.5 : donjons bien plus durs que les autres de leur niveau (simulation) : PV et dégâts de leurs monstres ×
  E.DG_EASE = { cache_kankreblath: 0.9, labo_tynril: 0.8,
    /* 0.1.45 : donjons niveau 200 réglés un peu au-dessus des cibles (bon équipement ≈ stasis 6) */
    ventre_baleine: 1.55, tour_bethel: 1.3, brasserie_dazak: 1.15, vaisseau_meno: 1.15, temple_koutoulou: 1.45, palais_dantinea: 1.15, manoir_katrepat: 1.15, tour_solar: 1.15, temple_kao: 1.15, arbre_mort: 1.4, fers_tyrannie: 1.25, sentence_balance: 1.2, trone_sang: 1.4, memoire_orukam: 1.4, souvenir_imagiro: 1.45, rituel_kabahal: 1.3, aurore_pourpre: 1.5, chambre_malefices: 1.15, breuil_venerable: 1.15, autel_dechireuse: 1.1 };
  /* 0.1.34 : sous-zones de chasse bien plus dures que les autres de leur niveau (simulation : équipe de 4 au niveau du milieu de la zone,
     objets 8 niveaux en dessous) : PV et dégâts de leurs monstres × ; les gains ne baissent pas */
  E.HUNT_EASE = { oto_corail: 0.9, ama_craqueleurs: 0.95, wab_cawotte: 0.9, wab_couronne: 0.85, wab_tombeaux: 0.8, ama_cloaque: 0.85, wab_waldo: 0.9, can_massif: 0.85, koa_bordure: 0.85, koa_kaliptus: 0.95, koa_lacs: 0.95, pan_feudala: 0.85, enu_carriere: 0.9, fri_berceau: 0.7, oto_hakam: 0.85, can_dents: 0.8, can_kanigs: 0.8, eca_lande: 0.95, fri_larmes: 0.95, grobe_cimetiere: 0.8, fri_crevasse: 0.9, fri_village: 0.85, grobe_mont: 0.85, osa_toorbz: 0.85, sah_cite: 0.9, sah_gorge: 0.9, fri_petrifiee: 0.75, sid_domaine_fungus: 0.95, sid_gisgoul: 0.7, sram_catacombres: 0.95, fri_ruche: 0.8, fri_torrideau: 0.8, val_ereboria: 0.85, har_bastion: 0.95, har_caserne: 0.85, har_clepsydre: 0.7, har_jardins: 0.85, har_remparts: 0.9, sah_pyramide: 0.8, sram_hauts: 0.85, suf_embruns: 0.7, xel_lendemains: 0.85,
    /* 1.0 « Sous-zones oubliées » : réglées par simulation sur les zones de même niveau */
    can_dopeuls: 0.85, moon_tortue: 0.85, abr_oree_abrak: 0.9, ama_marecages: 0.85, ama_citwouilles: 0.85, bon_cimetiere_heros: 0.95,
    /* 1.0.5 « Monstres oubliés et Vulkania » : le Cratère Nehr (6 Krokilles matures) était le seul plus dur que les zones de son niveau */
    vul_nehr: 0.9 };
  /* 1.0.7.10 (Mathis, vérification zone par zone) : équipe de 4 bien équipée au milieu de la zone, moins de 6 % de défaites */
  Object.assign(E.HUNT_EASE, { can_baie: 0.75, oto_corail: 0.7, can_routes: 0.8, can_massif: 0.7, can_champs: 0.9, ama_gelees: 0.95, pwak_carriere: 0.9, koa_bordure: 0.75, koa_kaliptus: 0.8, koa_lacs: 0.85, koa_cimetiere: 0.9, ama_foret_malefique: 0.9, wab_waldo: 0.85, ama_bandits: 0.95 });
  const powMons = (mons, where, did, sm = 1, sid = null) => { const k = (did && E.DG_EASE[did]) || (sid && E.HUNT_EASE[sid]) || 1; mons.forEach((m) => { m.hpMax = m.hp = Math.round(m.hpMax * (1 + (E.monPow(m.lvl, "hp", where) - 1) * sm) * k); m.dmg *= E.monPow(m.lvl, "dmg", where) * k; }); };
  const monsterEntity = (id, lvl, opts = {}) => {
    const base = MONSTERS[id];
    const archi = !!opts.archi && !!base.archi;
    const key = archi ? base.archi : id;
    const m = MONSTERS[key];
    const hp = Math.round((15 + lvl * 8.5) * base.hp * (archi ? 2.2 : 1) * (lvl > 60 ? 1 + (lvl - 60) * 0.012 : 1) * E.monHpLvl(lvl) * HI(lvl, E.MON_HI.hp));
    return {
      side: "m", key, base: id, race: base.race, name: m.name, img: m.img, lvl, archi, boss: !!m.boss,
      hpMax: hp, hp, el: m.el, atk: m.atk || "Attaque", res: m.res, sp: m.sp || base.sp || null, cds: {},
      dmg: (3 + lvl * 0.95) * (base.dmg || 1) * (archi ? 1.4 : 1) * HI(lvl, E.MON_HI.dmg),
      ini: 50 + lvl * 4 + (m.boss ? 100 : 0), attacks: m.boss ? 2 : 1,
      buffs: [], dots: [], debuffs: [], shield: 0, alive: true, weaken: 0, paLoss: 0, role: E.monRole(id, lvl),
    };
  };
  /* ---------------- 0.1.53 « Armes » : le coup d'arme ----------------
     Chaque arme frappe avec ses dégâts DOFUS (js/armes.js) ×1,5, dans une case en plus de la barre de sorts.
     Maîtrise : deux types d'arme favoris par classe (+20 % de dégâts). Chaque type a son effet.
     Potions de forgemagie élémentaire : it.wel = élément qui remplace le Neutre (it.welh : potion simple, la moitié seulement). */
  E.WEAPON = { mult: 1.5, fav: 0.2 };
  E.WTYPES = {
    2: { name: "Arc", fx: "precis", fxName: "Tir précis", desc: "+10 % de chances de coup critique" },
    3: { name: "Baguette", fx: "bened", fxName: "Bénédiction", desc: "soigne l'allié le plus blessé de 20 % des dégâts" },
    4: { name: "Bâton", fx: "garde", fxName: "Garde", desc: "+10 % de résistances au porteur jusqu'à son prochain tour" },
    5: { name: "Dague", fx: "double", fxName: "Double frappe", desc: "peut frapper 2 fois par tour" },
    6: { name: "Épée", fx: "grace", fxName: "Coup de grâce", desc: "+25 % de dégâts sur un ennemi sous 30 % de PV" },
    7: { name: "Marteau", fx: "onde", fxName: "Onde de choc", desc: "touche aussi 2 autres ennemis à 40 %" },
    8: { name: "Pelle", fx: "deterre", fxName: "Déterrage", desc: "25 % de chances de déterrer une ressource sur l'ennemi achevé" },
    19: { name: "Hache", fx: "entaille", fxName: "Entaille", desc: "l'ennemi saigne 2 tours (15 % des dégâts par tour)" },
    22: { name: "Faux", fx: "entaille", fxName: "Entaille", desc: "l'ennemi saigne 2 tours (15 % des dégâts par tour)" },
    271: { name: "Lance", fx: "perce", fxName: "Perce-armure", desc: "ignore 15 % des résistances de la cible" },
  };
  E.CLASS_WEAPONS = { iop: [6, 7], cra: [2, 5], eni: [3, 4], feca: [4, 3], osa: [7, 4], enu: [8, 7], sram: [5, 2], xelor: [7, 3], eca: [6, 5], sadi: [4, 3],
    sacri: [6, 19], panda: [19, 4], roub: [5, 7], zobal: [8, 19], steam: [7, 8], elio: [6, 5], hupper: [4, 3], ougi: [19, 5], forge: [271, 6] };
  E.WEAPON_POTIONS = { t: "potion_seisme", f: "potion_incendie", e: "potion_tsunami", a: "potion_ouragan" };
  E.WEAPON_POTIONS_S = { t: "potion_secousse", f: "potion_etincelle", e: "potion_crachin", a: "potion_courant" };
  E.weaponData = (tpl) => {
    const a = ARMES[tpl]; if (a) return { type: a[0], pa: a[1], cc: a[2], ccb: a[3], r: [a[4], a[5]], casts: a[6], lines: a[7].map(([el, min, max, k]) => ({ el, min, max, k: k || 0 })), paRm: a[8] || 0 };
    const T = ITEMS[tpl]; if (!T || T.slot !== "arme") return null; // arme sans dégâts connus : une ligne Neutre de son niveau
    return { type: 6, pa: 4, cc: 25, ccb: 5, r: [1, 1], casts: 1, lines: [{ el: "n", min: Math.round(5 + T.lvl * 0.18), max: Math.round(7 + T.lvl * 0.24), k: 0 }], paRm: 0, guess: true };
  };
  E.weaponLines = (W, wel, welh) => {
    if (!wel) return W.lines;
    const out = [];
    W.lines.forEach((l) => {
      if (l.el !== "n" || l.k === 2) return out.push(l);
      if (!welh) return out.push(Object.assign({}, l, { el: wel }));
      out.push(Object.assign({}, l, { min: Math.ceil(l.min / 2), max: Math.ceil(l.max / 2) }), Object.assign({}, l, { el: wel, min: Math.floor(l.min / 2), max: Math.floor(l.max / 2) }));
    });
    return out.filter((l) => l.max > 0);
  };
  E.weaponFav = (cls, type) => (E.CLASS_WEAPONS[cls] || []).includes(type);
  E.weaponSpellOf = (cls, tpl, wel, welh) => {
    const W = E.weaponData(tpl); const T = ITEMS[tpl]; if (!W || !T) return null;
    const fav = E.weaponFav(cls, W.type); const m = E.WEAPON.mult * (fav ? 1 + E.WEAPON.fav : 1); const ty = E.WTYPES[W.type] || {};
    const fx = E.weaponLines(W, wel, welh).map((l) => l.k === 2 ? { k: "heal", min: Math.round(l.min * m), max: Math.round(l.max * m), n: 1 }
      : { k: l.k ? "drain" : "dmg", el: l.el, min: Math.round(l.min * m), max: Math.round(l.max * m), n: 1 });
    if (W.paRm) fx.push({ k: "apdrain", v: W.paRm, n: 1 });
    const el = (fx.find((f) => f.el) || {}).el || "n";
    return { id: "arme", wp: true, name: T.name, tpl, lvl: 1, pair: "arme", el, wtype: W.type, wfx: ty.fx || null, fav, ccb: W.ccb,
      grades: [{ lvl: 1, pa: W.pa, cd: 0, casts: ty.fx === "double" ? Math.max(2, W.casts) : W.casts, fx }] };
  };
  E.weaponSpell = (S, c) => { const uid = c && c.equip && c.equip.arme; const it = uid && S.items[uid]; return it && ITEMS[it.tpl] ? E.weaponSpellOf(c.cls, it.tpl, it.wel, it.welh) : null; };
  E.WSLOT = { id: "arme", cond: "", tgt: "low", w: true };
  /* potion de forgemagie élémentaire : change le Neutre de l'arme (réussite garantie, une potion par changement) */
  E.weaponPotion = (S, uid, cons) => {
    const it = S.items[uid]; const T = it && ITEMS[it.tpl]; if (!T || T.slot !== "arme") return { err: "Seules les armes prennent ces potions." };
    const C = CONSUMABLES[cons]; if (!C || C.kind !== "wpot") return { err: "Potion inconnue." };
    if (!(S.cons[cons] > 0)) return { err: `Il te faut une ${C.name}.` };
    const W = E.weaponData(it.tpl); if (!W.lines.some((l) => l.el === "n" && l.k !== 2)) return { err: "Cette arme n'a pas de dégâts Neutre." };
    if (it.wel === C.el && !!it.welh === !!C.half) return { err: "L'arme a déjà cet élément." };
    S.cons[cons]--; if (!S.cons[cons]) delete S.cons[cons];
    it.wel = C.el; if (C.half) it.welh = true; else delete it.welh;
    E.emit(S, "equip", {});
    return { ok: true, txt: `${C.name} : ${T.name} frappe maintenant en ${ELEMENTS[C.el].name}${C.half ? " (pour moitié)" : ""}.` };
  };
  /* préparer une potion : herbes de l'Alchimiste et kamas (simple : Alchimiste 20, grande : Alchimiste 80) */
  E.WPOT_COST = { s: { lvl: 20, herb: [["Sauge", 10]], kamas: 2000 }, g: { lvl: 80, herb: [["Orchidée Freyesque", 10], ["Trèfle à 5 feuilles", 10]], kamas: 20000 } };
  E.brewPotion = (S, cons) => {
    const C = CONSUMABLES[cons]; if (!C || C.kind !== "wpot") return "Potion inconnue."; const R = E.WPOT_COST[C.half ? "s" : "g"];
    if ((S.jobs.alchimiste || {}).lvl < R.lvl) return `Alchimiste niveau ${R.lvl} requis.`;
    for (const [r, n] of R.herb) if ((S.res[r] || 0) < n) return `Il faut ${n} × ${r}.`;
    if (S.kamas < R.kamas) return `Il faut ${R.kamas.toLocaleString("fr-FR")} kamas.`;
    R.herb.forEach(([r, n]) => { S.res[r] -= n; if (!S.res[r]) delete S.res[r]; }); S.kamas -= R.kamas; E.addCons(S, cons, 1);
    return null;
  };
  const charEntity = (S, c) => {
    const st = E.charStats(S, c);
    const fs = E.freeSpirit(S);
    const hpMax = Math.round(st.hpMax * (1 + fs / 200) * (E.teamHas(S, "osa") ? 1.05 : 1) * (1 + E.bonus(S, "hp") / 100));
    return {
      side: "c", cid: c.id, name: c.name, cls: c.cls, lvl: c.lvl, st, hpMax, hp: hpMax,
      ini: st.ini, buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, weaken: 0, paLoss: 0, stack: 0, suffer: 0, nCast: 0, els: [],
      evc: E.eveil(c, "classe") + E.mtPass(S, c), ev: c.eveils || {}, // 0.1.12 : Éveils (Renaissance) ; 2.0 : le passif renforcé par la Maîtrise
      mt: E.mtFx ? E.mtFx(S, c) : null, bt: E.btFx ? E.btFx(S) : null, // 2.0 : Maîtrise (clés de voûte, % de dégâts) et Maîtrise du Bestiaire
      lg: E.legOf ? E.legOf(S, c) : null, // 0.1.48 : objet légendaire porté (passif)
      dp: E.dofpOf ? E.dofpOf(S, c) : null, dpBoost: E.dofpReso ? E.dofpReso(S, c) : false, // 1.0.16 : passifs des Dofus, Éveil des Dragons
      wsp: E.weaponSpell(S, c), // 0.1.53 : coup d'arme
      seal: E.sealOf ? E.sealOf(S, c) : null, // Refonte du Champion : Sceau porté (js/champions.js)
      pet: E.petEnt ? E.petEnt(S, c) : null, // 1.1 : familier (pastille, aptitude de famille)
    };
  };
  /* Bonus « petit groupe » en donjon : PV en plus et dégâts subis en moins pour les équipes de 1 ou 2 héros. */
  /* 1.0.5.1 : l'Esprit Libre (PV et dégâts en plus pour les petites équipes) est supprimé ; ses PV passent ici, jusqu'à 4 héros */
  E.SMALL_TEAM = { 1: { hp: 95, dr: 25, name: "Solo" }, 2: { hp: 55, dr: 15, name: "Duo" }, 3: { hp: 30, dr: 8, name: "Trio" }, 4: { hp: 20, dr: 5, name: "Quatuor" } };
  /* 0.1.24.3 : en chasse aussi, une petite équipe bien équipée ne doit presque jamais perdre (simulation) : PV en plus et dégâts subis en moins */
  /* mon : part du renfort de chasse (E.MON_POW) gardée par les monstres ; les gains par monstre suivent (E.powRew) */
  E.HUNT_SMALL = { 1: { hp: 120, dr: 50, mon: 0.36, name: "Solo" }, 2: { hp: 60, dr: 30, mon: 0.74, name: "Duo" }, 3: { hp: 35, dr: 18, mon: 1, name: "Trio" }, 4: { hp: 20, dr: 10, mon: 1, name: "Quatuor" } }; // 1.0.5.1 : relevé (fin de l'Esprit Libre)
  E.ARCHI_CHANCE = 1 / 400;

  /* ---------------- 3.3.0 « Combat vivant » : placement, monstres spéciaux, Champions ---------------- */
  /* Placement : chaque héros est en première ligne (« f ») ou à l'arrière (« b »). Les attaques sur une seule cible
     visent la première ligne 3 fois sur 4 tant qu'elle tient debout. Placement automatique par défaut (S.placeAuto). */
  E.FRONT_P = 0.75;
  /* 0.1 (essai) : stats tactiques. [gain en % par point, plafond en %] ; pm : par PM au-delà de 3.
     Les monstres n'en ont pas encore ; seuls les héros les portent (familiers, plus tard équipements). */
  E.TACT = { po: [20, 60], tac: [1, 60], fui: [0.5, 30], pm: [3, 15], rpa: [0.4, 20], rpaV: 20, rpaBoss: 10, rpm: [0.5, 25], epa: [0.5, 50], epm: [0.5, 50], invMax: 3 };
  E.tact = (st, k) => { const t = E.TACT[k]; return st ? Math.min(t[1], (st[k] || 0) * t[0]) : 0; };
  E.tactLog = null;
  /* 1.0.30 « Nouvelles caractéristiques » (41A) : poussée. Un sort qui repousse (effet push de DOFUS, v cases) peut envoyer le monstre
     touché contre un autre monstre : 25 % par autre monstre debout, 75 % au plus. Dégâts comme dans DOFUS, à l'échelle du jeu :
     (niveau / 2 + Dommages de poussée + 32) × cases restantes / 6, sans résistance d'élément ; le monstre percuté en prend la moitié.
     Cases restantes : 1 à la portée du sort ; chaque PM au-delà de 3 ajoute une case (2 au plus). Pas de poussée au Kolizéum.
     Ce sont des dommages de poussée, pas un coup du héros : ni reflet, ni riposte, ni effet « au coup ». L'IA ne les compte pas pour
     choisir ses sorts (simulation : elle écartait des sorts de retrait de PA ou de vol de vie et perdait plus souvent) : c'est un bonus. */
  E.PUSH = { hit: 0.25, hitMax: 0.75, div: 6, base: 32, other: 0.5, pmMax: 2 };
  E.pushCells = (st, v) => v + clamp((st && st.pm) || 0, 0, E.PUSH.pmMax);
  E.pushDmg = (lvl, pou, cells) => Math.max(0, (lvl / 2 + (pou || 0) + E.PUSH.base) * cells / E.PUSH.div);
  E.pushChance = (nFoes) => Math.min(E.PUSH.hitMax, E.PUSH.hit * Math.max(0, nFoes - 1));
  /* Esquive PA/PM des monstres : dès le niveau 100, +0,4 % par niveau (40 % au plus), +10 pour les boss, Coriaces et Chefs */
  E.monDodge = (m) => (m.lvl > 100 ? Math.min(40, (m.lvl - 100) * 0.4) + (m.boss || m.role === "coriace" || m.role === "chef" ? 10 : 0) : 0); // le simulateur compte ici combien de fois chaque effet se déclenche
  E.frontMax = (n) => Math.max(1, Math.ceil(n / 2));
  E.avgRes = (st) => { const ks = Object.values(ELEMENTS).map((x) => x.res).filter(Boolean); return ks.length ? ks.reduce((a, k) => a + Math.min(50, st[k] || 0), 0) / ks.length : 0; };
  /* classes faites pour encaisser : bonus pour le placement automatique (à PV égaux, elles passent devant) */
  E.TANK_CLASSES = ["sacri", "feca", "panda", "zobal", "forge"];
  E.tankScore = (S, c) => { const st = E.charStats(S, c); return st.hpMax * (1 + E.avgRes(st) / 100) * (E.TANK_CLASSES.includes(c.cls) ? 1.25 : 1); };
  E.isAutoPlace = (S) => S.placeAuto !== false;
  /* renvoie l'ensemble des ids de héros en première ligne pour l'équipe actuelle */
  E.frontSet = (S) => {
    const team = E.team(S); const max = E.frontMax(team.length);
    const ranked = team.slice().sort((a, b) => E.tankScore(S, b) - E.tankScore(S, a));
    if (E.isAutoPlace(S)) return new Set(ranked.slice(0, max).map((c) => c.id));
    let f = team.filter((c) => c.row === "f");
    if (f.length > max) f = ranked.filter((c) => c.row === "f").slice(0, max);
    if (!f.length && ranked.length) f = [ranked[0]];
    return new Set(f.map((c) => c.id));
  };
  /* passer un héros d'une rangée à l'autre : le placement devient manuel en gardant la répartition affichée */
  E.setRow = (S, cid, row) => {
    const team = E.team(S); const c = team.find((x) => x.id === cid); if (!c) return "Ce héros n'est pas dans l'équipe.";
    const cur = E.frontSet(S); team.forEach((x) => (x.row = cur.has(x.id) ? "f" : "b"));
    const max = E.frontMax(team.length); const nf = team.filter((x) => x.row === "f").length;
    if (row === "f" && c.row !== "f" && nf >= max) { const out = team.filter((x) => x.row === "f").sort((a, b) => E.tankScore(S, a) - E.tankScore(S, b))[0]; out.row = "b"; } /* échange avec le moins solide de la première ligne */
    if (row === "b" && c.row === "f" && nf <= 1) return "Il faut au moins un héros en première ligne.";
    c.row = row === "f" ? "f" : "b"; S.placeAuto = false; return null;
  };
  E.setPlaceAuto = (S, on) => { S.placeAuto = !!on; if (!on) { const cur = E.frontSet(Object.assign({}, S, { placeAuto: true })); E.team(S).forEach((x) => (x.row = cur.has(x.id) ? "f" : "b")); } };
  /* monstres à mécanique spéciale : le Rôdeur vise l'arrière, le Bondisseur ignore les rangées */
  E.MON_ROLES = {
    rodeur: { name: "Rôdeur", desc: "Vise l'arrière 3 fois sur 4.", re: /Archer|Furtif|Invisible|Corbac|Assassin|Fourbe|Sournois|Ninja|Vigie pirate|Harpirate|Marôdeur|Éperfide|Chevrotine|Sapeur|Tsume-bozu|Harpille|Nocturlabe|Paspartou|Doublure/ }, /* 0.1 : Rôdeurs et Bondisseurs de fin de jeu (niv. 150-200) */
    bond:   { name: "Bondisseur", desc: "Ignore les rangées : frappe n'importe quel héros.", re: /^Tofu|Moskito|Kwak(ere)? de Vent|Pious|Bondi|Lapino|Bitouf Aérien|Glouragan|Vindeux|Kanihilan|Panterreur|Morfrelon|Rykaon|Wolvero|Lévitrof|Fancrôme/ },
    /* 0.1 : dix rôles de plus ; les plus simples dès le niveau 25, les autres dès le niveau 100 */
    kamikaze: { name: "Kamikaze", min: 100, desc: "En mourant, explose sur la première ligne.", re: /Explosif|Boumbardier|Pétartifoux|Kamikabz|Craqueboule|Tofukaz|Boombata|Cramikaz|Mécanofoux|Crachefoux|Déminoboule|Canondorf|Bomb/ },
    soigneur: { name: "Soigneur", min: 100, desc: "Tous les 2 tours, soigne l'allié le plus blessé (10 % de ses PV).", re: /Soignante|Shamansot|Meupette|Prêtre|Toubibz|Médibwork|Kokom|Guérisseur|Docteur|Madura|Soryo|Gélikan|Chaman|Fleuro|Floribonde|Mère Veilleuse|Meliglours/ },
    chef:     { name: "Chef de meute", min: 100, desc: "Ses alliés font +10 % de dégâts tant qu'il est debout.", re: /Chef|Capitaine|Roi |Mama|Maman|Sergent|Commandant|Dame du Hasard|Père |Maître Zoth|Don / },
    invoc:    { name: "Invocateur", min: 100, desc: "Tous les 3 tours, appelle un petit monstre (3 au plus).", re: /Invocat|Mage|Maître|Gob-trotteur|Maho|Kamasterisk|Magouille|Momistik|Drakoalak|Sorcier|Dragminster|Shinibaru/ },
    protect:  { name: "Protecteur", min: 100, desc: "Tous les 3 tours, protège ses alliés d'un bouclier (10 % de leurs PV).", re: /Gard(e|ien)|Guerrite|Blindur|Chevalier|Cavalier|Guerrier|Soldat|Trémorse|Kaskargo|Kabushido|Kwamouraï|Sramouraï/ },
    maudit:   { name: "Maudit", min: 100, desc: "Ses coups réduisent de 30 % les soins reçus pendant 2 tours.", re: /Fant|Spectr|Chafer|Esprit|Esprigné|Feutôme|Momie|Mominotor|\bBoo\b|Sinistro|Ectorche|Kaonashi|Jiangshi|Yomi|Phorr|Phozami/ },
    sangsue:  { name: "Sangsue", min: 100, desc: "Récupère 20 % des dégâts qu'il inflige.", re: /Vampire|Buveur|Chauve|Noctul|Strigide|Minoskito|^Rat |Ratl|Ramane|Milirat|Mâchassin|Viandargh|Sangsue/ },
    poison:   { name: "Empoisonneur", min: 25, desc: "Ses coups empoisonnent pendant 3 tours.", re: /Arak|Scorb|Scorp|Serp|Fung|Champ|Larv|Gelée|Fistul|Puceron|Bubox|Pyrasite|Gastroth|Mofette|Toxo|Lucrane/ },
    coriace:  { name: "Coriace", min: 25, desc: "−30 % de dégâts subis tant qu'il a plus de la moitié de ses PV.", re: /Craq|Golem|Crabe|Tortue|Roch|Élémenterre|Stalak|Cuirboule|Karkanik|Masticroc|Gruche|Brikablak|Scarafeuille|Kwoan|Granduk|Robot|Robionicle|Malle Outillée|Boufmouth de guerre/ },
    esquive:  { name: "Insaisissable", min: 25, desc: "Esquive 20 % des coups.", re: /Wabbit|Chacha|Renar|Lapin|Kanig|Kanib|Kaniblou|Chak|Félyg|Panth|Orfélin|Écurouille|Milimulou|Souris|Kilibriss|Fourbasse|Chasquatch|Ronronchon|Tigrimas/ },
  };
  E.monRole = (key, lvl) => { const m = MONSTERS[key]; if (!m || m.boss) return null; for (const k in E.MON_ROLES) { const R = E.MON_ROLES[k]; if (R.re.test(m.name)) return lvl !== undefined && R.min && lvl < R.min ? null : k; } return null; };
  /* Champions de chasse : 1 combat sur 50 (refonte : js/champions.js), un monstre du groupe devient Champion (PV ×2, dégâts +20 %, un pouvoir) */
  E.CHAMP_CHANCE = 1 / 50; // Refonte du Champion : 1 combat sur 50 (choix 2B)
  E.CHAMP_POWERS = {
    enrage:   { name: "Enragé",     desc: "+25 % de dégâts sous 50 % de PV." },
    blinde:   { name: "Blindé",     desc: "Bouclier de 15 % de ses PV au début du combat." },
    vampire:  { name: "Vampirique", desc: "Vole 15 % des dégâts qu'il inflige." },
    veloce:   { name: "Véloce",     desc: "Joue avant les héros." },
    meneur:   { name: "Meneur",     desc: "Ses alliés font +10 % de dégâts tant qu'il est debout." },
    traqueur: { name: "Traqueur",   desc: "Vise le héros qui a le moins de PV." },
  };
  E.monsterEntity = monsterEntity; // 0.1.22 : groupes d'attaque des Percepteurs (js/gboss.js)
  E.makeChampion = (m, pw) => {
    m.champ = pw || pick(Object.keys(E.CHAMP_POWERS));
    m.hpMax = m.hp = Math.round(m.hpMax * 2); m.dmg *= 1.2;
    if (m.champ === "blinde") m.shield = Math.round(m.hpMax * 0.15);
    if (m.champ === "vampire") m.vamp = 0.15;
    if (m.champ === "veloce") m.ini += 1e6;
    if (m.champ === "enrage") m.enrageMod = true;
    return m;
  };

  E.makeGroup = (S, sub, teamSize) => {
    const IX = E.idolFx(S, null); const size = Math.min(8, ri(Math.max(1, Math.min(teamSize, E.MON_POW.minGroup(sub))), Math.min(8, teamSize + 1)) + (IX ? IX.extra : 0)); // 0.1.10 : idoles Farle et Nahuss
    const g = [];
    for (let i = 0; i < size; i++) {
      const id = pick(sub.monsters); const m = MONSTERS[id];
      const lvl = ri(Math.max(m.lvl[0], sub.lvl[0]), Math.min(m.lvl[1], sub.lvl[1]) || m.lvl[1]);
      const fl = E.huntTier(S, id) >= 3 ? 2 : 1;
      g.push(monsterEntity(id, Math.max(1, lvl), { archi: rnd() < E.ARCHI_CHANCE * E.archiMult(S) * E.almMult(S, "archi") * fl }));
    }
    if (rnd() < E.CHAMP_CHANCE * (E.mtTeam ? E.mtTeam(S, E.team(S), "champ") : 1)) { const cand = g.filter((m) => !m.archi); if (cand.length) E.makeChampion(pick(cand)); } // 2.1 : Traqueur
    return g;
  };

  /* ---------------- Mécaniques de boss ---------------- */
  /* min : niveau de donjon à partir duquel la mécanique peut être tirée ; tip : ce qui aide (conseils avant d'entrer) */
  E.BOSS_MECHS = {
    enrage:   { name: "Rage", min: 1, tip: "dégâts", desc: "Sous 50 % de PV, il frappe 40 % plus fort mais subit 15 % de dégâts en plus." },
    summon:   { name: "Renforts", min: 1, tip: "zone", desc: "Tous les 3 tours, appelle un serviteur ; tant qu'un serviteur vit, le boss se soigne." },
    shield:   { name: "Carapace", min: 1, tip: "dégâts", desc: "Se protège d'un bouclier au début du combat puis à 50 % de PV." },
    charge:   { name: "Attaque dévastatrice", min: 1, tip: "boucliers", desc: "Prépare une attaque sur toute l'équipe, lancée le tour suivant : boucliers et soins conseillés." },
    weakspot: { name: "Point faible", min: 1, tip: "dégâts", desc: "Un tour sur trois, il expose son point faible et subit 50 % de dégâts en plus." },
    festin:   { name: "Festin", min: 25, tip: "dégâts", desc: "Se soigne de 30 % des dégâts qu'il inflige." },
    seisme:   { name: "Séisme", min: 25, tip: "boucliers", desc: "Tous les 4 tours, frappe fort toute la première ligne." },
    riposte:  { name: "Riposte", min: 25, tip: "tank", desc: "Chaque coup reçu a 20 % de chance de déclencher un contre." },
    reflet:   { name: "Reflet", min: 40, tip: "soins", desc: "Un tour sur quatre, renvoie 30 % des dégâts reçus." },
    miasmes:  { name: "Miasmes", min: 40, tip: "soins", desc: "Toute l'équipe perd des PV à chaque tour du boss, de plus en plus." },
    devoreur: { name: "Dévoreur", min: 40, tip: "zone", desc: "Tous les 3 tours, mange un de ses serviteurs pour se soigner de 15 %." },
    brise:    { name: "Brise-garde", min: 60, tip: "soins", desc: "Tous les 3 tours, détruit les boucliers des héros." },
    putrefaction: { name: "Putréfaction", min: 60, tip: "boucliers", desc: "Tous les 4 tours, les soins reçus par l'équipe baissent de 50 % pendant 2 tours." },
    peau:     { name: "Change-peau", min: 60, tip: "éléments", desc: "Change d'élément tous les 3 tours et résiste à 50 % à cet élément." },
    condamne: { name: "Condamnation", min: 80, tip: "boucliers", desc: "Marque un héros ; deux tours plus tard, le frappe très fort sauf s'il a un bouclier (moitié moins fort contre un héros seul)." },
    mutisme:  { name: "Mutisme", min: 80, tip: "équipe", desc: "Tous les 4 tours, un héros ne peut lancer que ses sorts sans recharge pendant 2 tours (jamais contre un héros seul)." },
    terreur:  { name: "Terreur", min: 80, tip: "tank", desc: "Tous les 4 tours, fait reculer un héros de la première ligne pendant 2 tours (jamais le dernier héros devant)." },
    frenesie: { name: "Frénésie", min: 100, tip: "résistance", desc: "Joue deux fois tous les 4 tours." },
    totems:   { name: "Totems", min: 100, tip: "zone", desc: "Invoque 2 totems ; il est invulnérable tant qu'ils vivent." },
    liens:    { name: "Âmes liées", min: 100, tip: "zone", desc: "Partage ses PV avec un serviteur lié : les dégâts sont répartis entre eux." },
    immortel: { name: "Immortel", min: 120, tip: "dégâts", desc: "Revient une fois à la vie avec 25 % de ses PV." },
    rebours:  { name: "Compte à rebours", min: 140, tip: "dégâts", desc: "Au tour 20, anéantit l'équipe : il faut le battre avant." },
    /* signatures : une par grand boss, jamais tirées au hasard */
    distorsion: { sig: true, title: "Gardien du temps", name: "Distorsion du temps", tip: "équipe", desc: "Tous les 4 tours, rallonge d'un tour la recharge des sorts des héros et leur retire 1 PA." },
    fournaise:  { sig: true, title: "Forgeur de givre", name: "Fournaise et givre", tip: "éléments", desc: "Résiste à 50 % à tous les éléments sauf un, qui change tous les 2 tours." },
    tapis:      { sig: true, title: "Équilibriste", name: "Tapis roulant", tip: "tank", desc: "Tous les 3 tours, la première ligne et l'arrière échangent leur place." },
    banquet:    { sig: true, title: "Convive de Klime", name: "Grand banquet", tip: "zone", desc: "Tous les 3 tours, mange un serviteur : +15 % de PV et +10 % de dégâts." },
    inventions: { sig: true, title: "Démineur", name: "Inventions", tip: "zone", desc: "Tous les 4 tours, pose une bombe qui explose sur toute l'équipe 3 tours plus tard si on ne la détruit pas." },
    maree:      { sig: true, title: "Brise-lames", name: "Marée montante", tip: "boucliers", desc: "Tous les 3 tours, une vague frappe tous les héros de l'arrière." },
    sacrifice:  { sig: true, title: "Briseur de liens", name: "Sacrifice", tip: "zone", desc: "Ses serviteurs encaissent la moitié des dégâts qu'elle reçoit." },
    double:     { sig: true, title: "Pourfendeur de doubles", name: "Dédoublement", tip: "dégâts", desc: "À 50 % de PV, crée un double qui a ses mécaniques." },
    petrif:     { sig: true, title: "Regard d'acier", name: "Regard pétrifiant", tip: "équipe", desc: "Tous les 3 tours, pétrifie un héros qui passe son tour." },
    aspiration: { sig: true, title: "Œil du cyclone", name: "Aspiration", tip: "soins", desc: "Tous les 3 tours, absorbe les boucliers des héros et les change en PV pour lui." },
    dore:       { sig: true, title: "Cœur d'or", name: "Toucher doré", tip: "équipe", desc: "Tous les 4 tours, change un héros en or 2 tours : il ne joue plus mais ne prend plus de coups." },
    larcin:     { sig: true, title: "Incorruptible", name: "Larcin", tip: "soins", desc: "Tous les 3 tours, vole le bouclier et les bonus d'un héros et garde le bouclier pour elle." },
    taureau:    { sig: true, title: "Toréador", name: "Charge du taureau", tip: "tank", desc: "Tous les 3 tours, fonce sur le héros le moins résistant, même à l'arrière." },
    humeurs:    { sig: true, title: "Lunatique", name: "Quatre humeurs", tip: "éléments", desc: "Change d'élément tous les 3 tours et résiste à 75 % à cet élément." },
    abordage:   { sig: true, title: "Corsaire", name: "À l'abordage", tip: "zone", desc: "Tous les 4 tours, appelle 2 pirates d'un coup." },
    glyphes:    { sig: true, title: "Maître des glyphes", name: "Glyphes pair et impair", tip: "dégâts", desc: "Aux tours pairs il subit 40 % de dégâts en plus, aux tours impairs 30 % de moins." },
    horloge:    { sig: true, title: "Horloger", name: "Horloge", tip: "dégâts", desc: "Au tour 20, l'équipe est anéantie : il faut le battre avant." },
    racines:    { sig: true, title: "Déracineur", name: "Racines", tip: "équipe", desc: "Tous les 3 tours, enracine un héros de l'arrière : il ne peut plus soigner pendant 2 tours." },
    glace:      { sig: true, title: "Brise-glace", name: "Glace éternelle", tip: "équipe", desc: "Tous les 3 tours, gèle un héros qui passe son tour." },
    appetit:    { sig: true, title: "Indigeste", name: "Appétit d'Ougah", tip: "zone", desc: "Tous les 3 tours, dévore un de ses serviteurs pour se soigner de 15 %." },
  };
  E.BOSS_SIGS = { donjon_harebourg: "distorsion", forgefroide_frizz: "fournaise", transporteur_sylargh: "tapis", salons_klime: "banquet", labo_nileza: "inventions",
    aquadome_merkator: "maree", belvedere_ilyzaelle: "sacrifice", chambre_tal_kasha: "double", defi_chaloeil: "petrif", oeil_vortex: "aspiration", palais_nidas: "dore",
    trone_cour_sombre: "larcin", labyrinthe_minotoror: "taureau", labo_tynril: "humeurs", epave_grolandais: "abordage", canopee_kimbo: "glyphes", horologium_xlii: "horloge",
    antre_korriandre: "racines", cavernes_kolosso: "glace", temple_ougah: "appetit" };
  E.TIP_TXT = { "dégâts": "Beaucoup de dégâts", zone: "Sorts de zone", boucliers: "Boucliers", soins: "Soins", tank: "Une première ligne solide", "éléments": "Plusieurs éléments", "équipe": "Une équipe complète", "résistance": "Résistances" };
  E.bossSeen = (S, did) => !!((S.bossSeen || {})[did] || S.progress.bossKills[did]);
  /* conseils avant d'entrer : ce qui aide contre les mécaniques du boss */
  E.bossTips = (did) => [...new Set(E.bossMechs(did).map((k) => E.BOSS_MECHS[k].tip))].map((t) => E.TIP_TXT[t]).filter(Boolean);
  E.mechPool = (lvl) => Object.keys(E.BOSS_MECHS).filter((k) => !E.BOSS_MECHS[k].sig && E.BOSS_MECHS[k].min <= lvl);
  /* mécaniques fixes par donjon : 1 (niv. < 25), 2 (< 160), 3 (160+), plus la signature du boss ; mêmes mécaniques à chaque visite */
  E.bossMechs = (did) => {
    const dg = DUNGEONS[did]; if (!dg) return [];
    let x = 0; for (const ch of did) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    const n = dg.lvl < 25 ? 1 : dg.lvl < 160 ? 2 : 3;
    const sig = E.BOSS_SIGS[did]; const clash = { humeurs: "peau", horloge: "rebours", appetit: "devoreur", banquet: "devoreur" }[sig];
    const pool = (dg.lvl < 25 ? ["enrage", "summon", "shield", "charge"] : E.mechPool(dg.lvl)).filter((k) => k !== clash); const out = [];
    const HEALS = ["festin", "devoreur", "appetit", "banquet"]; // 0.1.12.5 : un seul mécanisme de soin par boss (Kankreblath cumulait Festin et Dévoreur)
    for (let i = 0; out.length < n && i < 40; i++) { const k = pool[x % pool.length]; if (!out.includes(k) && !(HEALS.includes(k) && out.concat(sig || []).some((o) => HEALS.includes(o)))) out.push(k); x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; }
    if (sig) out.push(sig);
    return out;
  };

  /* ---------------- Challenges ---------------- */
  E.CHALLENGES = {
    survivant:  { name: "Survivant",          diff: 10, desc: "Aucun héros ne doit tomber." },
    versatile:  { name: "Versatile",          diff: 15, desc: "Chaque sort au plus une fois par tour." },
    econome:    { name: "Économe",            diff: 15, desc: "Ne jamais lancer le même sort deux fois de suite." },
    focus:      { name: "Focus",              diff: 10, desc: "Une fois un monstre attaqué, le tuer avant d'en viser un autre (les sorts de zone qui le touchent sont permis)." },
    elitiste:   { name: "Élitiste",           diff: 15, desc: "Tuer d'abord le monstre désigné." },
    ordonne:    { name: "Ordonné",            diff: 30, desc: "Tuer les monstres du plus haut au plus bas niveau." },
    incurable:  { name: "Incurable",          diff: 25, desc: "Aucun soin (ni sort de soin, ni vol de vie)." },
    elementaire:{ name: "Élémentaire",        diff: 15, desc: "Chaque héros n'utilise qu'un seul élément pendant tout le combat." },
    barbare:    { name: "Barbare",            diff: 10, desc: "Aucun sort de protection : ni bouclier, ni bonus de caractéristiques." },
    rapide:     { name: "Rapide",             diff: 20, desc: "Terminer le combat en peu de tours." },
    chacun:     { name: "Chacun son monstre", diff: 20, desc: "Les héros se répartissent les monstres : chacun vise le sien jusqu'à sa mort (les sorts de zone qui le touchent sont permis)." },
  };
  const pickChallenges = (S, F, n) => {
    const heroes = F.ents.filter((e) => e.side === "c"); const mons = F.ents.filter((e) => e.side === "m");
    const healers = heroes.some((e) => { const c = S.chars.find((x) => x.id === e.cid); return c && c.spells.some((x) => { const d = E.spellDef(c.cls, x.id); return d && ["heal", "drain"].includes(E.spellKind(E.spellGrade(d, c.lvl))); }); });
    const protect = heroes.some((e) => { const c = S.chars.find((x) => x.id === e.cid); return c && c.spells.some((x) => { const d = E.spellDef(c.cls, x.id); return d && ["shield", "buff"].includes(E.spellKind(E.spellGrade(d, c.lvl))); }); });
    const pool = Object.keys(E.CHALLENGES).filter((id) => {
      if (["elitiste", "focus", "ordonne"].includes(id) && mons.length < 2) return false;
      if (id === "ordonne" && new Set(mons.map((m) => m.lvl)).size < 2) return false;
      if (id === "incurable" && !healers) return false;
      if (id === "barbare" && !protect) return false;
      if (id === "chacun" && (heroes.length < 2 || mons.length < heroes.length)) return false;
      return true;
    });
    const out = [];
    while (out.length < n && pool.length) out.push(mkChal(F, pool.splice(Math.floor(rnd() * pool.length), 1)[0], heroes, mons));
    return out;
  };
  const mkChal = (F, id, heroes, mons) => { const ch = { id, ok: true };
    if (id === "rapide") { const ml = mons.reduce((t, m) => t + m.lvl, 0) / Math.max(1, mons.length); ch.turns = 3 + Math.ceil(mons.length / Math.max(1, heroes.length)) + Math.floor(ml / 50) + (F.dungeon ? 1 : 0); ch.bonus = E.CHALLENGES.rapide.diff; } /* les combats de haut niveau durent plus longtemps */ else ch.bonus = E.CHALLENGES[id].diff;
    if (id === "elitiste") { const t = mons.slice().sort((a, b) => (b.boss ? 1e6 : 0) + b.lvl - ((a.boss ? 1e6 : 0) + a.lvl))[0]; ch.target = F.ents.indexOf(t); }
    return ch; };
  /* 1.1 : règles du Défi du jour, les mêmes challenges imposés dans chaque salle */
  E.fixedChals = (F, ids) => { const heroes = F.ents.filter((e) => e.side === "c"); const mons = F.ents.filter((e) => e.side === "m"); return ids.filter((id) => E.CHALLENGES[id]).map((id) => mkChal(F, id, heroes, mons)); };
  const chal = (F, id) => (F.chals || []).find((c) => c.id === id && c.ok);
  const failChal = (F, id, why) => { const c = chal(F, id); if (!c) return; c.ok = false; c.why = why; flog(F, `Challenge ${E.CHALLENGES[id].name} échoué${why ? " : " + why : ""}.`, "lose"); };
  E.chalRespect = (S, c) => !!(S.settings && S.settings.chalAI) && !(c && c.chalOff);
  /* 2.1.13 : le joueur choisit les challenges que l'équipe suit (S.settings.chalNo = challenges ignorés par l'IA) */
  E.chalWanted = (S, id) => !((S.settings && S.settings.chalNo) || {})[id];
  /* 2.1.13 : l'IA lâche les challenges quand le combat tourne mal : elle joue alors pour gagner, le challenge peut échouer.
     Élitiste et Ordonné (tuer une cible précise d'abord, souvent le boss) sont lâchés plus tôt : sous 80 % des PV de l'équipe,
     les autres sous 50 % ; tous dès qu'un héros tombe. Pas dans le Défi du jour (les règles y sont le score). Simulé : tools/chal_sim.js */
  E.CHAL_GIVEUP = 0.5; E.CHAL_GIVEUP_TGT = 0.8; E.CHAL_TGT = ["elitiste", "ordonne"];
  const chalDanger = (F, id) => {
    if (F.defiRules || !E.CHAL_GIVEUP) return false;
    const tgt = E.CHAL_TGT.includes(id); if (F.chalGive || (tgt && F.chalGiveT)) return true;
    const hs = F.ents.filter((e) => e.side === "c" && !e.summon && e.recruit === undefined && !e.soul); if (!hs.length) return false;
    const hp = hs.reduce((t, e) => t + (e.alive ? Math.max(0, e.hp) : 0), 0), mx = hs.reduce((t, e) => t + e.hpMax, 0);
    const down = hs.some((e) => !e.alive);
    if (!F.chalGiveT && (down || hp < mx * E.CHAL_GIVEUP_TGT)) { F.chalGiveT = true; if ((F.chals || []).some((c) => c.ok && E.CHAL_TGT.includes(c.id))) flog(F, "Le combat se corse : les héros ne visent plus la cible du challenge.", "lose"); }
    if (!F.chalGive && (down || hp < mx * E.CHAL_GIVEUP)) { F.chalGive = true; if ((F.chals || []).some((c) => c.ok && !E.CHAL_TGT.includes(c.id))) flog(F, "Le combat tourne mal : les héros oublient les challenges pour gagner.", "lose"); }
    return tgt ? !!F.chalGiveT : !!F.chalGive;
  };
  /* challenge que l'IA suit en ce moment (actif, voulu par le joueur, combat pas en danger) */
  const aiChal = (S, F, id) => { const c = chal(F, id); return c && E.chalWanted(S, id) && !chalDanger(F, id) ? c : null; };

  /* ---------------- Stasis (3.1) ---------------- */
  E.STASIS_MAX = 15; // 1.1 : stasis 11 à 15 (Mathis 3A)
  E.STASIS_UP = 1.12; // 1.1 : au-delà de la stasis 10, monstres +12 % de PV et +12 % de dégâts par palier (environ +25 % de difficulté, simulé)
  E.STASIS15_TITLE = "Maître du temps";
  /* Nouveau départ des classements de stasis (demande de Mathis, 15/10/2026, avec les sorts uniques des boss) : la saison 2
     ne compte que les stasis terminées depuis cette mise à jour. SI.sz = saison, SI.sk = stasis la plus haute terminée
     pendant la saison, SI.st = son meilleur temps. Les stasis débloquées (SI.max) ne changent pas : on peut tout de suite
     relancer sa meilleure stasis. La fonction serveur « record » lit E.stasisSaison pour les records et les Premiers. */
  E.STASIS_SAISON = 2;
  E.STASIS_SAISON_NOM = "sorts des boss";
  E.SB_TITLE = "Pionnier des boss"; E.SB_TITLE_K = 10; // titre du premier compte à finir une stasis 10 ou plus d'un donjon depuis les sorts des boss (Mathis 2A + 2B)
  E.stasisSaison = (S, did) => { const SI = ((S && S.stasis) || {})[did]; return SI && SI.sz === E.STASIS_SAISON && SI.sk > 0 ? { k: SI.sk, t: SI.st || 0 } : { k: 0, t: 0 }; };
  E.STASIS_TL = { room: 15, boss: 24 };
  E.STASIS_MODS = {
    enrages:   { name: "Enragés",     desc: "Les monstres infligent +25 % de dégâts sous 50 % de PV." },
    blindes:   { name: "Blindés",     desc: "Les monstres commencent le combat avec un bouclier de 15 % de leurs PV." },
    veloces:   { name: "Véloces",     desc: "Les monstres jouent avant vos héros." },
    vampires:  { name: "Vampiriques", desc: "Les monstres volent 15 % des dégâts qu'ils infligent." },
    nombreux:  { name: "En nombre",   desc: "Un monstre de plus dans chaque salle." },
    /* 0.1 : modificateurs propres au mutateur éclair (jamais tirés au hasard en stasis 6-7) */
    champions: { name: "Champions",   desc: "Un monstre de chaque salle est un Champion (PV ×2, un pouvoir, butin doublé).", flash: true },
    ruse:      { name: "Boss rusé",   desc: "Le boss a une mécanique de plus.", flash: true },
    renforts:  { name: "Renforts",    desc: "Deux serviteurs de plus aux côtés du boss.", flash: true },
  };
  E.STASIS_STEPS = [
    [1, "Le donjon normal."], [2, "Monstres renforcés."], [3, "Le boss gagne une mécanique supplémentaire."],
    [4, "Synchronisation : les monstres prennent le niveau de votre meilleur héros."], [5, "Une salle d'élite (monstre Élite : PV ×2, +15 % de dégâts pour ses alliés)."],
    [6, "Un modificateur de donjon."], [7, "Deux modificateurs de donjon."], [8, "Le boss a une seconde phase sous 30 % de PV."],
    [9, "Temps limité : 15 tours par salle, 24 contre le boss."], [10, "Boss légendaire : 3 mécaniques, butin exclusif."],
    [11, "Monstres +12 % de PV et de dégâts (environ +25 % de difficulté), de même à chaque palier suivant. Poussière de stasis ×2."], [12, "Trois modificateurs de donjon."], [13, "Monstres encore plus forts."],
    [14, "Le boss légendaire a 4 mécaniques."], [15, "Le sommet. Titre « Maître du temps » au premier passage."],
  ];
  E.stasisInfo = (S, did) => { S.stasis = S.stasis || {}; return (S.stasis[did] = S.stasis[did] || { max: 0, sel: 1, firsts: {}, best: {} }); };
  E.stasisMult = (k) => { const up = Math.pow(E.STASIS_UP, Math.max(0, k - 10)); return { hp: (1 + 0.12 * (Math.min(k, 10) - 1)) * up, dmg: Math.pow(1.2, Math.min(k, 10) - 1) * up, rew: 1 + 0.15 * (k - 1) }; };
  /* caractéristique des parchemins de chaque donjon (élément du boss) */
  E.dungeonScrollStat = (did) => { const dg = DUNGEONS[did]; const el = (MONSTERS[dg.boss] || {}).el; const ids = Object.keys(DUNGEONS).sort(); if (ids.indexOf(did) % 5 === 4) return "sa"; return { t: "fo", f: "ine", e: "cha", a: "age" }[el] || "vit"; };
  const pickMods = (n, first) => { const ks = Object.keys(E.STASIS_MODS).filter((x) => !E.STASIS_MODS[x].flash); const out = first ? [first] : []; while (out.length < n) { const k = pick(ks); if (!out.includes(k)) out.push(k); } return out; };
  /* Mutateur de l'heure (3.1.3, à l'heure depuis 0.1.47 ; avant : de la semaine) : à chaque heure pile, un donjon reçoit
     un modificateur imposé (à toutes les stasis) et donne +25 % d'XP et de butin, +50 % de poussière. Dès la stasis 6,
     il remplace un des modificateurs tirés au sort. Le tirage dépend de l'heure (le même pour tous) et du niveau du meilleur héros.
     Le nom « weekly » est gardé dans le code et la sauvegarde. */
  E.WEEKLY_REW = 1.25; E.WEEKLY_DUST = 1.5;
  E.WEEKLY_MODS = ["enrages", "blindes", "vampires", "nombreux"]; // « Véloces » exclu : trop punitif sans équipement (simulation)
  E.weekIdx = (t = E.now()) => Math.floor((t / 86400000 + 3) / 7); // semaines commençant le lundi (UTC) : Expédition, donjons de la semaine
  E.weekEnd = (t = E.now()) => ((E.weekIdx(t) + 1) * 7 - 3) * 86400000;
  E.HOUR_MS = 3600000;
  E.hourIdx = (t = E.now()) => Math.floor(t / E.HOUR_MS);
  E.hourEnd = (t = E.now()) => (E.hourIdx(t) + 1) * E.HOUR_MS;
  const hourHash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return Math.imul(x ^ (x >>> 16), 0x27d4eb2f) >>> 0; };
  /* tirage d'une heure, sans toucher à la sauvegarde ; jamais le même donjon ni le même modificateur que l'heure d'avant */
  E.hourlyAt = (S, n) => {
    const ids = Object.keys(DUNGEONS).sort().filter((d) => E.dungeonUnlocked(S, d)); if (!ids.length) return null;
    const top = Math.max(...S.chars.map((c) => c.lvl));
    const near = ids.filter((d) => DUNGEONS[d].lvl <= top + 5 && DUNGEONS[d].lvl >= top - 40);
    const pool = near.length ? near : ids.filter((d) => DUNGEONS[d].lvl <= Math.max(top + 5, Math.min(...ids.map((x) => DUNGEONS[x].lvl))));
    const mods = E.WEEKLY_MODS; const raw = (k) => { const x = hourHash(k); return [x % pool.length, (x >>> 8) % mods.length]; };
    /* par journées de 24 h : chaque heure évite le donjon et le modificateur de l'heure d'avant (la veille est refaite une fois pour sa dernière heure) */
    const day = (d, prev) => { const out = []; for (let k = d * 24; k < d * 24 + 24; k++) { let [di, mi] = raw(k);
      if (di === prev[0] && pool.length > 1) di = (di + 1) % pool.length; if (mi === prev[1]) mi = (mi + 1) % mods.length; out.push(prev = [di, mi]); } return out; };
    const d = Math.floor(n / 24); const [di, mi] = day(d, day(d - 1, raw(d * 24 - 25))[23])[n - d * 24];
    return { h: n, did: pool[di], mod: mods[mi] };
  };
  E.weekly = (S, t = E.now()) => {
    const n = E.hourIdx(t);
    if (S.weekly && S.weekly.h === n && DUNGEONS[S.weekly.did]) return S.weekly;
    const W = E.hourlyAt(S, n); if (W) S.weekly = W;
    return W;
  };
  E.nextHourly = (S, t = E.now()) => E.hourlyAt(S, E.hourIdx(t) + 1);
  /* Mutateur éclair (0.1) : toutes les 20 minutes, 3 donjons (niveaux 1-79, 80-149, 150-200) reçoivent un modificateur
     et donnent un petit bonus. Une course commencée garde son bonus jusqu'au bout. Les donjons ne tournent pas hors ligne. */
  E.FLASH_MS = 20 * 60000; E.FLASH_REW = 1.12; E.FLASH_DUST = 1.25;
  E.FLASH_MODS = ["enrages", "blindes", "vampires", "nombreux", "champions", "ruse", "renforts"];
  E.flashIdx = (t = E.now()) => Math.floor(t / E.FLASH_MS);
  E.flashEnd = (t = E.now()) => (E.flashIdx(t) + 1) * E.FLASH_MS;
  /* Tranches fixes, identiques pour tous les joueurs (Mathis, 0.1) */
  E.FLASH_TIERS = [["bas", 1, 79], ["milieu", 80, 149], ["haut", 150, 200]];
  const flashCache = {};
  E.flash = (S, t = E.now()) => {
    const f = E.flashIdx(t); if (flashCache.k === f) return flashCache.v;
    const ids = Object.keys(DUNGEONS).sort();
    let x = Math.imul(f ^ 0x7f4a7c15, 0x85ebca6b) >>> 0;
    const mods = E.FLASH_MODS.slice(); const out = [];
    for (const [tier, lo, hi] of E.FLASH_TIERS) {
      const pool = ids.filter((d) => DUNGEONS[d].lvl >= lo && DUNGEONS[d].lvl <= hi); if (!pool.length) continue;
      x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x27d4eb2f) >>> 0;
      out.push({ did: pool[x % pool.length], mod: mods.splice((x >>> 8) % mods.length, 1)[0], tier });
    }
    flashCache.k = f; flashCache.v = out;
    return out;
  };
  E.flashOf = (S, did, t) => E.flash(S, t).find((x) => x.did === did) || null;
  /* Le grand équilibrage (choix 4A de Mathis) : difficulté propre à quelques donjons (PV et dégâts de leurs monstres, × la valeur),
     réglée par simulation (équipe de 8 héros de leur niveau, bon équipement, stasis 7 visée). */
  /* Valeurs des passifs de classe (retouches des sorts) */
  /* Retouches des classes faibles (Mathis : « réequilibrer les sorts et la maîtrise » plutôt qu'un bonus en %), réglées par simulation.
     E.PSV0 = anciennes valeurs, gardées au Kolizéum (équilibré à part par E.KOLI_POW). */
  E.PSV0 = { fecaProt: 0.1, fecaRenvoi: 0.15, fecaSoin: 0.03, sadiAttire: 0.5, enuPelle: 0.1, sacriDrain: 0.5, eniSoin: 0.1, eniLie: 0.15, zobDef: 0.2, zobSoin: 0.04, sacriTransp: 0, enuButin: 0, sadiSeve: 0, eniSurplus: 0, sacriDr: 0 };
  E.PSV = { fecaProt: 0.2, fecaRenvoi: 0.3, fecaSoin: 0.08, sadiAttire: 0.65, enuPelle: 0.1, sacriDrain: 0.5, eniSoin: 0.2, eniLie: 0.25, zobDef: 0.2, zobSoin: 0.06, sacriTransp: 0.3, enuButin: 0.08, sadiSeve: 0.04, eniSurplus: 0.6, sacriDr: 0.015 };
  const psv = (x) => (x && x.tm !== undefined ? E.PSV0 : E.PSV);
  E.DG_DIFF = { tertre_long_sommeil: 1.7, refuge_sylvestre: 1.45, chateau_wa_wabbit: 1.34, caverne_koulosse: 1.3, cour_bouftou_royal: 1.3, theatre_dramak: 1.18, miausolee_pounicheur: 1.17, gelaxieme_dimension: 0.7 };
  /* Mathis : « tous les dj 200 plus difficiles » (bon équipement visé 7, optimisé 9, au moins ×1,05 chacun) */
  Object.assign(E.DG_DIFF, { aquadome_merkator: 1.09, arbre_mort: 1.24, aurore_pourpre: 1.08, autel_dechireuse: 1.05, belvedere_ilyzaelle: 1.5, brasserie_dazak: 1.26, breuil_venerable: 1.23, chambre_malefices: 1.05, chambre_tal_kasha: 1.05, defi_chaloeil: 1.26, donjon_harebourg: 1.1, fers_tyrannie: 1.11, forgefroide_frizz: 1.26, labo_nileza: 1.55, manoir_katrepat: 1.1, memoire_orukam: 1.15, oeil_vortex: 1.22, palais_dantinea: 1.05, palais_nidas: 1.37, rituel_kabahal: 1.11, salons_klime: 1.22, sanctuaire_torkelonia: 1.05, sentence_balance: 1.09, souvenir_imagiro: 1.05, tempete_eliocalypse: 1.05, temple_kao: 1.05, temple_koutoulou: 1.11, tour_bethel: 1.33, tour_solar: 1.05, transporteur_sylargh: 1.31, trone_cour_sombre: 1.42, trone_sang: 1.23, vaisseau_meno: 1.05, ventre_baleine: 1.05 });
  const applyDiff = (S, mons) => { const m = E.DG_DIFF[S.dungeon && S.dungeon.id]; if (!m || m === 1) return; mons.forEach((x) => { x.hpMax = x.hp = Math.round(x.hpMax * m); x.dmg *= m; }); };
  const applyStasis = (S, F, mons, room, isBoss) => {
    applyDiff(S, mons);
    const D2 = S.dungeon; const k = D2.stasis || 1; if (k <= 1 && !(D2.mods || []).length) return mons;
    const M = E.stasisMult(k); const mods = D2.mods || [];
    mons.forEach((m) => {
      m.hpMax = m.hp = Math.round(m.hpMax * M.hp); m.dmg *= M.dmg;
      if (mods.includes("blindes")) m.shield = Math.round(m.hpMax * 0.15);
      if (mods.includes("veloces")) m.ini += 1e6;
      if (mods.includes("vampires")) m.vamp = 0.15;
      if (mods.includes("enrages")) m.enrageMod = true;
    });
    if (mods.includes("champions") && !isBoss && mons.length) E.makeChampion(mons[mons.length - 1]);
    if (mods.includes("ruse") && isBoss && mons[0] && mons[0].mech) { const keys = E.mechPool(DUNGEONS[D2.id] ? DUNGEONS[D2.id].lvl : 1).filter((x) => !mons[0].mech.includes(x)); if (keys.length) mons[0].mech = mons[0].mech.concat([pick(keys)]); }
    if (k >= 5 && !isBoss && room === D2.eliteRoom && mons.length) { const el = mons[0]; el.elite = true; el.hpMax = el.hp = el.hpMax * 2; el.name = el.name + " (Élite)"; }
    if (isBoss) { const b = mons[0];
      const pool = E.mechPool(DUNGEONS[D2.id] ? DUNGEONS[D2.id].lvl : 1);
      if (k >= 3) { const keys = pool.filter((x) => !b.mech.includes(x)); if (keys.length) b.mech = b.mech.concat([pick(keys)]); }
      if (k >= 8) b.phase2 = true;
      if (k >= 10) { b.legend = true; b.name = b.name + " Légendaire"; b.hpMax = b.hp = Math.round(b.hpMax * 1.5); const keys = pool.filter((x) => !b.mech.includes(x)); while (b.mech.length < (k >= 14 ? 4 : 3) && keys.length) b.mech.push(keys.splice(Math.floor(rnd() * keys.length), 1)[0]); }
    }
    return mons;
  };
  /* 0.1.10 : idoles — contraintes posées sur les monstres au début du combat (voir js/idols.js) */
  const applyIdols = (X, mons, opts = {}) => {
    mons.forEach((m) => {
      if (X.hpMul !== 1) m.hpMax = m.hp = Math.round(m.hpMax * X.hpMul);
      if (X.dmgMul !== 1) m.dmg *= X.dmgMul;
      if (X.enrage) m.enrageMod = true;
      if (X.first) m.ini += 1e6;
      if (X.vamp) m.vamp = Math.max(m.vamp || 0, X.vamp);
      if (X.monCrit) { m.crit = (m.crit || 0) + X.monCrit; m.dcri = (m.dcri || 0) + (X.monDcri || 0); }
      if (X.noDot) m.noDot = true;
    });
    if (X.payo && !opts.late) { const t = mons.filter((m) => !m.boss).sort((a, b) => b.hpMax - a.hpMax)[0]; if (t) { t.hpMax = t.hp = t.hpMax * 3; t.payo = true; } }
    if (X.champion && !opts.late && !mons.some((m) => m.champ)) { const c = mons.filter((m) => !m.archi && !m.boss); if (c.length) E.makeChampion(c[c.length - 1]).idolChamp = true; } // 1.2.10.3 : le Champion de Djim ne compte pas pour les Sceaux (js/champions.js)
    mons.forEach((m) => { if (X.shield0) m.shield = Math.max(m.shield || 0, Math.round(m.hpMax * X.shield0 / 100)); });
    return mons;
  };
  E.startFight = (S) => {
    const team = E.team(S); if (!team.length) return null;
    const IX = E.idolFx(S, S.dungeon);
    let mons, label, bossIdx = -1, XP = null;
    if (E.expActive && E.expActive(S)) { // 0.1.24 : étage de l'Expédition sans fin
      XP = E.expFight(S, team); if (!XP) return null;
      mons = XP.mons; label = XP.label;
    } else if (S.dungeon) {
      const dg = DUNGEONS[S.dungeon.id]; const r = S.dungeon.room;
      if (r < dg.rooms.length) {
        const room = dg.rooms[r]; const k = S.dungeon.stasis || 1;
        const n = clamp(Math.round(ri(room.size[0], room.size[1]) * (0.3 + team.length * 0.25)) + ((S.dungeon.mods || []).includes("nombreux") ? 1 : 0) + (IX ? IX.extra : 0), 1, 8);
        const lv = k >= 4 ? Math.max(room.lvl, S.dungeon.syncLvl || 0) : room.lvl;
        mons = []; for (let i = 0; i < n; i++) mons.push(monsterEntity(pick(room.mobs), lv + ri(0, 1)));
        applyStasis(S, null, mons, r, false);
        label = `${dg.name}${k > 1 ? ` · Stasis ${k}` : ""} — salle ${r + 1}/${dg.rooms.length + 1}`;
      } else {
        const bm = MONSTERS[dg.boss];
        const k = S.dungeon.stasis || 1; const blv = S.dungeon.gboss ? (S.dungeon.syncLvl || 1) + 2 : k >= 4 ? Math.max(bm.lvl[0], (S.dungeon.syncLvl || 0) + 2) : bm.lvl[0]; // boss de guilde (0.1.22) : toujours au niveau de l'équipe
        const boss = monsterEntity(dg.boss, blv);
        const hk = (1 + team.length * 1.1) / 5; boss.hpMax = boss.hp = Math.round(boss.hpMax * hk);
        boss.mech = E.bossMechs(S.dungeon.id); boss.mturn = 0; (S.bossSeen = S.bossSeen || {})[S.dungeon.id] = 1;
        mons = [boss];
        /* 0.1.40 : boss qui se battent ensemble (les 4 Gelées Royales de la Gelaxième Dimension) */
        (dg.coBoss || []).forEach((cb) => { if (!MONSTERS[cb]) return; const c = monsterEntity(cb, blv); c.hpMax = c.hp = Math.round(c.hpMax * hk * (dg.coBossHp || E.COBOSS_HP)); mons.push(c); });
        /* 1.0.4.2 : boss jumeaux (4 Gelées Royales, 4 Blops Royaux) : les PV totaux sont partagés à parts égales, aucun n'en a plus que les autres */
        if (dg.coBossEq && mons.length > 1) { const tot = mons.reduce((a, m) => a + m.hpMax, 0); mons.forEach((m) => { m.hpMax = m.hp = Math.round(tot * E.COBOSS_EQ / mons.length); }); }
        const extra = clamp(team.length - 1 + ((S.dungeon.mods || []).includes("renforts") ? 2 : 0) + (IX ? IX.extra : 0) - (mons.length - 1), 0, 7);
        const mlv = S.dungeon.gboss ? S.dungeon.syncLvl || 1 : k >= 4 ? Math.max(dg.lvl, S.dungeon.syncLvl || 0) : dg.lvl;
        for (let i = 0; i < extra; i++) mons.push(monsterEntity(pick(dg.bossMobs), mlv - ri(1, 3)));
        applyStasis(S, null, mons, -1, true);
        label = `${dg.name}${k > 1 ? ` · Stasis ${k}` : ""} — salle du boss`;
      }
    } else {
      const sub = SUBS[S.sub];
      if (!sub || !S.hunting) return null;
      mons = E.makeGroup(S, sub, team.length);
      label = sub.name;
      const pg = E.protGroup(S, sub, team, monsterEntity); // 0.1.10.1 : protecteur de ressources
      if (pg) { mons = pg.mons; label = pg.label; }
      if (mons.some((m) => m.archi)) note(S, `Un archimonstre apparaît : ${mons.find((m) => m.archi).name} !`, "rare");
    }
    const hsm = S.dungeon || XP ? 1 : E.huntMon(team.length);
    powMons(mons, S.dungeon || XP ? "dg" : "hunt", S.dungeon && S.dungeon.id, hsm, !S.dungeon && !XP ? S.sub : null);
    if (IX) applyIdols(IX, mons);
    const front = E.frontSet(S);
    const ents = team.map((c) => Object.assign(charEntity(S, c), { row: front.has(c.id) ? "f" : "b" })).concat(mons);
    if (XP) E.expHeroes(S, ents, XP.fx);
    if (IX && IX.heroPa) ents.forEach((e) => { if (e.side === "c") e.st = Object.assign({}, e.st, { pa: Math.max(1, e.st.pa - IX.heroPa) }); });
    if (IX && IX.resMain) { const cnt = {}; ents.forEach((e) => { if (e.side === "c") { const k = bestEl(e.st); cnt[k] = (cnt[k] || 0) + 1; } }); IX.resEl = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null; }
    /* 0.1 : bonus « petit groupe » en donjon (solo et duo) ; 0.1.24.3 : en chasse aussi (solo, duo, trio) */
    const sm = S.dungeon ? E.SMALL_TEAM[team.length] : XP ? null : E.HUNT_SMALL[team.length];
    if (sm) ents.forEach((e) => { if (e.side === "c") { e.hpMax = e.hp = Math.round(e.hpMax * (1 + sm.hp / 100)); e.smallDr = sm.dr; } });
    const ch = mons.find((m) => m.champ); if (ch) note(S, `Un Champion apparaît : ${ch.name} (${E.CHAMP_POWERS[ch.champ].name}) !`, "rare");
    var fsub = S.dungeon || XP ? null : S.sub, fdg = S.dungeon ? S.dungeon.id : null;
    const F = S.fight = { id: (S.fightSeq = (S.fightSeq || 0) + 1), label, ents, round: 1, order: [], oi: 0, log: [], over: false, result: null, dur: 0, dungeon: !!S.dungeon, seq: 0, fx: [], sub: fsub, dungeonId: fdg, deaths: [] };
    if (!S.dungeon && S.protector && S.protector.fighting) F.prot = true;
    F.stasis = S.dungeon ? S.dungeon.stasis || 1 : 0; F.weekly = S.dungeon && S.dungeon.weekly || null; F.flash = S.dungeon && S.dungeon.flash || null;
    if (S.dungeon && S.dungeon.rules) { F.defiRules = true; F.defiHero = S.dungeon.hero || []; } // 1.1 (série 4) : règles héroïques à +150
    F.chals = S.dungeon && S.dungeon.rules ? E.fixedChals(F, S.dungeon.rules) : pickChallenges(S, F, (S.dungeon ? 2 : 1) + E.almMult(S, "chal1"));
    if (XP) F.exp = XP.exp;
    F.idol = IX; if (IX) { F.idolScore = IX.score; F.idolBonus = IX.bonus; }
    F.powRew = E.powRew(mons, S.dungeon || XP ? "dg" : "hunt", hsm); // 0.1.12.3 : monstres renforcés, gains par monstre en proportion
    F.cs = { focus: {}, first: {}, last: {}, turnCasts: {}, el: {}, hitTurn: {} };
    const b = ents.find((e) => e.mech); if (b) { F.bossIdx = ents.indexOf(b); if (b.mech.includes("shield")) { b.shield = Math.round(b.hpMax * 0.2); b.shieldPhase = 1; } }
    if (E.legFight) E.legFight(S, F); // 0.1.48 : passifs des objets légendaires
    E.mtFight(F); // 2.0 : boucliers de la Maîtrise
    if (E.dofpFight) E.dofpFight(S, F); // 1.0.16 : passifs des Dofus
    if (E.sealFight) E.sealFight(S, F); // Sceaux de champion (js/champions.js)
    if (E.petFight) E.petFight(S, F); // 1.1 : aptitudes des familiers (écaille, aura)
    newRound(F);
    return F;
  };

  const newRound = (F) => {
    const ini = (e) => e.ini + (F.round === 1 && (e.cls === "cra" || e.expFirst) ? 1e7 : 0) + (e.idFirst === F.round ? 1e7 : 0); // identité : Élan
    F.order = F.ents.filter((e) => e.alive).sort((a, b) => (a.slowR === F.round) - (b.slowR === F.round) || ini(b) - ini(a)).map((e) => F.ents.indexOf(e));
    F.oi = 0;
    if (F.round === 1 && F.idol && F.idol.major) F.order = F.order.concat(F.order.filter((i) => F.ents[i].side === "m")); // idole Major
    const r = chal(F, "rapide"); if (r && F.round > r.turns) failChal(F, "rapide", `plus de ${r.turns} tours`);
  };
  const flog = (F, txt, cls = "") => { F.log.push({ txt, cls }); if (F.log.length > 40) F.log.shift(); };
  const alive = (F, side) => F.ents.filter((e) => e.alive && e.side === side);
  /* 1.0.33 : vie de référence des mécaniques (soins en %, totems, bombes, âme liée, boucliers) : le boss de guilde a ses PV multipliés par 1 000 (E.gbossSim pose hpRef = ses PV normaux) */
  const hpR = (e) => e.hpRef || e.hpMax;
  E.hpRef = hpR; // 2.0.6 : aussi pour les coups en % des PV de la cible (Dom de Pin, Lance-Éclair) contre les boss aux PV ×1 000
  /* 0.1.44 : Kolizéum. Un héros est « joueur » côté c, ou n'importe où dans un combat d'équipes (F.pvp) ;
     le glyphe du Féca et l'érosion y sont propres à chaque équipe (tm 0 ou 1). */
  const isHero = (F, t) => t.side === "c" || !!(F && F.pvp && t.st);
  const glyphOf = (F, t) => (F ? (F.pvp ? (F.glyphs || [])[t.tm] : F.glyph) : null);

  /* ---------------- Résolution des actions ---------------- */
  const buffSum = (e, k) => e.buffs.reduce((s, b) => s + (b[k] || 0), 0);
  const debSum = (e, k) => (e.debuffs || []).reduce((s, b) => s + (b[k] || 0), 0);

  const killed = (F, tgt) => {
    if (tgt.alive) return; const idx = F.ents.indexOf(tgt); if (F.deaths.includes(idx)) return; F.deaths.push(idx);
    if (tgt.side === "m" && F.lastBy && F.lastBy[idx] !== undefined) { const kr = F.ents[F.lastBy[idx]]; if (kr) kr.kills = (kr.kills || 0) + 1; } // 1.0.4 : statistiques de combat
    if (E.dofpDeath) E.dofpDeath(F, tgt); // 1.0.16 : Colère du Bworker
    if (E.petDeath && tgt.pet) E.petDeath(F, tgt); // 1.1 : Dernier compagnon (album de la ménagerie)
    if (tgt.side === "c" && !tgt.summon) { failChal(F, "survivant", `${tgt.name} est tombé`); const lh = F.lastHit && F.lastHit.t === idx ? F.lastHit : null; (F.deathInfo = F.deathInfo || []).push({ i: idx, r: F.round, by: lh ? lh.s : -1, el: lh ? lh.el : null }); }
    if (tgt.side === "m" && tgt.role === "kamikaze" && !tgt.boom) { tgt.boom = true; const fr = alive(F, "c").filter((h) => rowOf(h) === "f");
      if (fr.length) { flog(F, `${tgt.name} explose en mourant !`, "m"); fr.forEach((h) => dealDamage(F, null, h, tgt.dmg * 1.5 * rf(0.9, 1.1), tgt.el === "n" ? null : tgt.el)); } }
    if (tgt.side === "m" && F.idol) { // 0.1.10 : idoles Chokwa et Serpi
      if (F.idol.chokwa) alive(F, "m").forEach((m) => { if (m.hp < m.hpMax) doHeal(m, m.hpMax * F.idol.chokwa / 100, F); });
      if (F.idol.reinforce && !F.reinforced && !tgt.summon && !tgt.fake) { F.reinforced = true; const r = applyIdols(F.idol, [monsterEntity(tgt.base || tgt.key, tgt.lvl)], { late: true })[0]; r.reinf = true; F.ents.push(r); flog(F, `Un renfort arrive : ${r.name} (idole Serpi) !`, "m"); }
    }
    if (tgt.side === "m") {
      const el = chal(F, "elitiste"); if (el && idx !== el.target && F.ents[el.target].alive) failChal(F, "elitiste", "mauvais monstre tué en premier");
      const od = chal(F, "ordonne"); if (od) { const higher = alive(F, "m").some((m) => m.lvl > tgt.lvl); if (higher) failChal(F, "ordonne", "ordre non respecté"); }
    }
  };
  /* 3.2.2 : suivi des dégâts pour « Pourquoi j'ai perdu ? » */
  const trackHit = (F, src, tgt, v, el) => {
    if (!src && F.dotSrc && tgt.side === "m") src = F.dotSrc; // 1.0.4 : poisons des héros comptés dans leurs dégâts
    const ti = F.ents.indexOf(tgt); const si = src ? F.ents.indexOf(src) : -1; const k = el || "n";
    if (tgt.side === "c" && !tgt.summon) { F.taken = F.taken || {}; F.taken[k] = (F.taken[k] || 0) + v; tgt.taken = tgt.taken || {}; tgt.taken[k] = (tgt.taken[k] || 0) + v; F.lastHit = { t: ti, s: si, el: k }; }
    else if (tgt.side === "m" && src && src.side === "c") { F.dealt = F.dealt || {}; F.dealt[ti] = (F.dealt[ti] || 0) + v; const o = src.summon ? F.ents[src.owner] : src; if (o) { o.dealt = (o.dealt || 0) + v; (F.lastBy = F.lastBy || {})[ti] = F.ents.indexOf(o); } }
  };
  const dealDamage = (F, src, tgt, raw, el) => {
    let v = raw;
    if (tgt.srInvis > 0 && src && src.side !== tgt.side && E.SR2) v *= 1 - E.SR_HIDE; // Sram : dans l'ombre, les coups ennemis le touchent mal (sram.js)
    let res = 0;
    if (tgt.side === "m" && !isHero(F, tgt)) { res = (tgt.res || {})[el] || 0; if (tgt.boss && src && src.cls === "forge" && src.posture !== "rempart" && res > 0) res *= 0.5; if (F && F.idol) { res += F.idol.resAll; if (F.idol.resMain && el && el === F.idol.resEl) res += F.idol.resMain; } }
    else if (tgt.st) { const rk = ELEMENTS[el] && ELEMENTS[el].res; res = rk ? tgt.st[rk] || 0 : 0; res += tgt.resBonus || 0; }
    if (tgt.wguard > 0) res += 10; // 0.1.53 : Bâton (Garde)
    if (src && src.wcast && src.wcast.wfx === "perce" && res > 0) res *= 0.85; // 0.1.53 : Lance (Perce-armure)
    if (src && E.dofpRes) res = E.dofpRes(src, tgt, res); // 1.0.16 : Dolmanax, Forgelave
    res = Math.min(50, res);
    v = v * (1 - res / 100);
    v *= 1 + (debSum(tgt, "vuln") + (tgt.mark > 0 ? 10 : 0)) / 100;
    if (src) v *= 1 - Math.min(60, debSum(src, "weak")) / 100;
    if (isHero(F, tgt)) { v *= (glyphOf(F, tgt) === "prot" ? 1 - psv(tgt).fecaProt : 1) * (tgt.mask === "def" ? 1 - psv(tgt).zobDef : 1) * (tgt.posture === "rempart" ? 0.75 : 1) * (1 - (tgt.smallDr || 0) / 100) * (tgt.cls === "sacri" && !tgt.summon && psv(tgt).sacriDr ? 1 - Math.min(15, tgt.suffer || 0) * psv(tgt).sacriDr : 1); if (tgt.st && el) v -= tgt.st[(ELEMENTS[el] || {}).fix] || 0; }
    if (F && !F.pvp && E.PSV.sacriTransp && v > 0 && tgt.side === "c" && !tgt.summon && tgt.cls !== "sacri") { const sc = F.ents.find((x) => x.side === "c" && x.cls === "sacri" && !x.summon && x.alive && x.hp > 1); if (sc) { const p = Math.min(v * E.PSV.sacriTransp, sc.hp - 1); sc.hp -= p; v -= p; } } // Sacrieur : Transposition
    /* 0.1 : rôles de monstres et mécaniques de boss qui changent les dégâts reçus */
    if (F && isHero(F, tgt) && tgt.gold > 0) return 0;
    if (F && tgt.side === "m") {
      if (tgt.role === "esquive" && src && src.side === "c" && !src.lgNoDodge && rnd() < 0.2) { F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(tgt), txt: "Esquive" }); return 0; }
      if (tgt.mech && tgt.mech.includes("totems") && alive(F, "m").some((m) => m.totem)) { F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(tgt), txt: "Invulnérable" }); return 0; }
      if (tgt.role === "coriace" && tgt.hp > tgt.hpMax * 0.5) v *= 0.7;
      if (tgt.weakOpen) v *= 1.5;
      if (E.midUDef && tgt.boss && E.MID_U && E.MID_U[tgt.key]) v = E.midUDef(F, src, tgt, v, el); // sorts uniques des boss
      if (tgt.mech) {
        if (tgt.mech.includes("glyphes")) v *= F.round % 2 === 0 ? 1.4 : 0.7;
        if (tgt.skinEl && el === tgt.skinEl) v *= tgt.mech.includes("humeurs") ? 0.25 : 0.5;
        if (tgt.openEl && el !== tgt.openEl) v *= 0.5;
      }
    }
    if (src && src.expVs && tgt.side === "m") v *= 1 + ((tgt.boss ? src.expVs.boss : 0) + (tgt.hp > tgt.hpMax * 0.8 ? src.expVs.fresh : 0)) / 100; // 0.1.24 : reliques d'expédition
    if (F && src && E.legPre) { v = E.legPre(F, src, tgt, v); if (v <= 0) return 0; } // 0.1.48 : légendaires (esquive, garde, miroir)
    if (F && src && E.dofpPre) { v = E.dofpPre(F, src, tgt, v); if (v <= 0) return 0; } // 1.0.16 : passifs des Dofus (marque, défenses)
    if (F && src && E.petPre && (F.petAura || tgt.pet)) { v = E.petPre(F, src, tgt, v); if (v <= 0) return 0; } // 1.1 : familiers (esquive, racines, aura)
    v = Math.max(1, Math.round(v));
    if (F && tgt.side === "m" && tgt.mech) { // une partie des dégâts part sur un serviteur
      const share = (m) => { const p = Math.min(m.hp, Math.round(v * 0.5)); if (p <= 0) return; v -= p; m.hp -= p; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(m), s: -1, v: p, el: el || "n" }); if (m.hp <= 0) { m.hp = 0; m.alive = false; killed(F, m); } };
      const link = tgt.mech.includes("liens") ? alive(F, "m").find((m) => m.linked) : null; if (link) share(link);
      else if (tgt.mech.includes("sacrifice")) { const ms = alive(F, "m").filter((m) => m.minion); if (ms.length) share(pick(ms)); }
    }
    if (F && E.idDef && (tgt.idHalf || tgt.idGuard || (src && src.idn && src.idn.trap))) v = Math.max(1, Math.round(E.idDef(F, src, tgt, v))); // identité : esquive, garde, piège
    if (!Number.isFinite(v)) v = 1; // 1.2.6.3 : filet de sécurité, un coup invalide ne rend plus un monstre immortel (PV NaN)
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, v); tgt.shield -= a; v -= a; }
    tgt.hp -= v;
    if (!Number.isFinite(tgt.hp)) tgt.hp = Number.isFinite(tgt.hpMax) ? Math.max(0, tgt.hpMax - v) : 0;
    if (F) trackHit(F, src, tgt, v, el);
    if (isHero(F, tgt) && src && (F && F.pvp ? src.tm !== tgt.tm : src.side === "m") && glyphOf(F, tgt) === "renvoi" && v > 0 && src.alive) { const rv = Math.max(1, Math.round(v * psv(tgt).fecaRenvoi)); src.hp -= rv; if (src.hp <= 0) { src.hp = 0; src.alive = false; killed(F, src); } }
    if (tgt.mt && tgt.mt.rv > 0 && src && src.alive && src.side !== tgt.side && v > 0 && !F.pvp) { const rv = Math.max(1, Math.round(v * tgt.mt.rv / 100)); src.hp -= rv; if (F) trackHit(F, tgt, src, rv, null); if (src.hp <= 0) { src.hp = 0; src.alive = false; killed(F, src); } } // 2.1 : Miroir (renvoi)
    if (F && !F.pvp && E.PSV.enuButin && tgt.side === "m" && tgt.hp <= 0 && src && src.cls === "enu" && !src.summon) alive(F, "c").forEach((x) => { x.shield = Math.max(x.shield || 0, Math.round(x.hpMax * E.PSV.enuButin * (1 + 0.25 * (src.evc || 0)))); }); // Enutrof : butin de guerre
    if (tgt.side === "m" && tgt.hp <= 0 && src && src.cls === "enu" && !src.summon && rnd() < 0.15) { F.treasure = (F.treasure || 0) + 1; flog(F, `${src.name} déterre un trésor !`, "buff"); }
    if (isHero(F, tgt) && tgt.cls === "sacri") tgt.suffer = Math.min(15, (tgt.suffer || 0) + 1);
    if (src && src.side === "c" && tgt.side === "m" && v > 0 && !(F && F.pushHit)) { // 0.1.24 : reliques d'expédition (vol de vie, poison) ; 1.0.30 : pas sur la poussée
      if (src.vamp && src.alive) doHeal(src, v * src.vamp, F);
      if (src.mt && src.mt.vv > 0 && src.alive) doHeal(src, v * src.mt.vv / 100, F); // 2.1 : Sangsue (vol de vie)
      if (src.expPoison && tgt.alive && !tgt.noDot && !tgt.dots.some((d) => d.exp)) tgt.dots.push({ v: Math.max(1, Math.round(tgt.hpMax * src.expPoison / 100)), el: null, turns: 2, exp: 1 });
    }
    if (tgt.hp <= 0 && F && tgt.lgS && E.legSave) E.legSave(F, src, tgt, v); // 0.1.48 : Trompe-la-Mort, Boucle du Réveil
    if (tgt.hp <= 0 && F && tgt.mt && tgt.mt.rev && !tgt.mtRev) { tgt.mtRev = 1; tgt.hp = Math.max(1, Math.round(tgt.hpMax * tgt.mt.rev / 100)); flog(F, `${tgt.name} se relève (Maîtrise) !`, "buff"); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); } // 2.0
    if (tgt.hp <= 0 && F && tgt.side === "c" && !tgt.summon && F.expRevive > 0) { F.expRevive--; tgt.hp = Math.round(tgt.hpMax * 0.25); flog(F, `${tgt.name} se relève (Sang de Bouftou) !`, "buff"); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); }
    if (tgt.hp <= 0 && F && tgt.mech && tgt.mech.includes("immortel") && !tgt.revived) { tgt.revived = true; tgt.hp = Math.round(tgt.hpMax * 0.25); flog(F, `${tgt.name} refuse de mourir et se relève !`, "m"); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); }
    if (tgt.hp <= 0 && F && tgt.side === "m" && F.idol && F.idol.revive && !tgt.revived && !tgt.summon) { tgt.revived = true; tgt.hp = Math.round(tgt.hpMax * F.idol.revive / 100); flog(F, `${tgt.name} revient à la vie (idole Sakai) !`, "m"); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); }
    if (tgt.hp <= 0 && F && tgt.dp && E.dofpSave) E.dofpSave(F, tgt); // 1.0.16 : Lueur d'Ilyzaelle
    if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; killed(F, tgt); }
    if (F && src && v > 0 && !F.pushHit) { // 1.0.30 : la poussée ne déclenche ni retrait, ni reflet, ni riposte (dommages de poussée, comme dans DOFUS)
      if (src.side === "m" && tgt.side === "c") {
        if (src.role === "sangsue" && src.alive) doHeal(src, v * 0.2, F);
        if (src.role === "poison" && tgt.alive && tgt.dots.filter((d) => d.role).length < 2) tgt.dots.push({ v: Math.max(1, v * 0.25), turns: 3, el, src: src.name, role: true });
        if (src.role === "maudit" && tgt.alive) tgt.debuffs.push({ healcut: 30, turns: 2 });
      }
      if (src.side === "c" && !src.summon && tgt.side === "m" && tgt.alive && src.st) {
        const me = 1 - E.monDodge(tgt) / 100; // les monstres de haut niveau esquivent une partie des retraits
        if (!(tgt.weakNext > 0) && E.tact(src.st, "rpa") > 0 && rnd() * 100 < E.tact(src.st, "rpa") * me) { tgt.weakNext = tgt.boss ? E.TACT.rpaBoss : E.TACT.rpaV; tlog("rpa"); }
        if (tgt.slowR !== F.round + 1 && E.tact(src.st, "rpm") > 0 && rnd() * 100 < E.tact(src.st, "rpm") * me) { tgt.slowR = F.round + 1; tlog("rpm"); }
      }
      if (src.side === "c" && !src.summon && tgt.side === "m" && src.alive) {
        if (tgt.reflect) { const r = Math.max(1, Math.round(v * 0.3)); src.hp -= r; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(src), s: F.ents.indexOf(tgt), v: r, el: "n" }); if (src.hp <= 0) { src.hp = 0; src.alive = false; killed(F, src); } }
        if (tgt.alive && tgt.mech && tgt.mech.includes("riposte") && !F.riposting && rnd() < 0.2 && src.alive) { F.riposting = true; const r = dealDamage(F, tgt, src, tgt.dmg * 0.6 * rf(0.9, 1.1), tgt.el === "n" ? null : tgt.el); F.riposting = false; flog(F, `${tgt.name} riposte sur ${src.name} (−${r}).`, "m"); }
      }
    }
    if (F && F.fx) F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(tgt), s: src ? F.ents.indexOf(src) : -1, v, el: el || "n" });
    if (F && src && v > 0 && !F.pushHit) { if (src.lg && E.legHit) E.legHit(F, src, tgt, v, el); if (tgt.lg && E.legHurt) E.legHurt(F, src, tgt, v); } // 0.1.48 : légendaires (1.0.30 : pas sur la poussée)
    if (F && src && v > 0 && E.dofpHit && !F.pushHit) { if (src.dp) E.dofpHit(F, src, tgt, v, el); if (tgt.dp) E.dofpHurt(F, src, tgt, v); } // 1.0.16 : passifs des Dofus
    if (F && src && src.pet && v > 0 && E.petHit && !F.pushHit) E.petHit(F, src, tgt, v, el); // 1.1 : familiers (souffle, soin, griffe)
    return v;
  };
  E.fightApi = { charDamage: (...a) => charDamage(...a), dealDamage: (...a) => dealDamage(...a), killed: (...a) => killed(...a), doHeal: (...a) => doHeal(...a), flog: (...a) => flog(...a), rowOf: (t) => rowOf(t), resists: (...a) => resists(...a), spawnMon: (...a) => spawnMon(...a), mobKey: (...a) => mobKey(...a) };
  const bestEl = (st) => [["t", st.fo], ["f", st.ine], ["e", st.cha], ["a", st.age]].sort((a, b) => b[1] - a[1])[0][0];
  /* équilibrage v3 par classe et par tranche de niveau (calibré par simulation des 19 classes) */
  E.POW_LVLS = [20, 36, 48, 56, 64, 76, 88, 100, 120, 140, 170, 200];
  /* 2.1.26.1 (Mathis) : Crâ −5 % dès le niveau 88 (0,8 → 0,76) */
  E.CLASS_POW = {"iop":[0.8,0.8,0.8,0.89,1.2,1.2,1.2,0.98,0.98,0.98,0.98,0.98],"cra":[1.2,1.2,1.2,1.2,1.16,0.82,0.76,0.76,0.76,0.76,0.76,0.76],"eni":[1.2,1.19,1.07,1.02,0.98,1,1.1,1.17,1.25,1.5,1.25,1.17],"feca":[1.02,0.98,0.93,0.95,0.99,1,1,1.02,1.02,1.02,1.02,1.02],"osa":[0.94,0.92,0.92,0.91,0.91,0.93,0.97,0.97,0.97,0.97,0.97,0.97],"enu":[1.02,1.06,1.06,1.07,1.1,1.11,1.13,1.16,1.3,1.16,1.05,1.3],"sram":[1.04,1.03,1.02,1.01,1.01,1.04,1.07,1.04,1.04,1.04,1.04,1.04],"xelor":[0.98,1.02,1.03,1.03,1.02,0.99,0.96,1,1,1.15,1.22,1],"eca":[1.2,1.2,0.75,0.75,0.8,0.8,0.8,0.86,0.86,0.86,0.86,0.86],"sadi":[0.8,0.81,0.81,0.82,0.86,0.91,0.95,0.98,0.98,0.98,0.98,0.98],"sacri":[1.01,0.98,0.98,1.03,1.08,1.11,1.1,1.06,1.06,1.06,1.06,1.06],"panda":[0.91,0.87,0.84,0.86,0.88,0.85,0.84,0.86,0.86,0.86,0.86,0.86],"roub":[1.01,0.98,0.85,0.85,1.01,0.99,1.02,1.05,1.05,1.05,1.17,1.05],"zobal":[1.11,1.06,1.07,1.15,1.2,1.2,1.11,0.96,0.96,0.96,0.96,0.96],"steam":[0.81,0.81,0.83,0.84,0.88,0.92,0.94,0.98,0.98,0.98,0.98,0.98],"elio":[0.95,1.06,1.4,1.35,1.2,1.2,1.2,1.2,1.2,1.2,1.2,0.95],"hupper":[0.82,0.85,0.84,0.84,0.93,1.02,1.06,1.14,1.14,1.22,1.3,1.08],"ougi":[1.05,1.03,1.01,1.02,1.05,1.08,1.09,1.09,1.09,0.95,0.92,0.95],"forge":[0.97,1,0.99,1,1.02,1.03,1.04,1,1,1,1,1]}; // 0.1.12.5 : paliers 120, 140, 170 et 200 ajoutés pour régler les hauts niveaux
  E.classPow = (cls, lvl) => {
    const t = E.CLASS_POW[cls]; if (!t) return (CLASSES[cls] && CLASSES[cls].pow) || 1;
    const L = E.POW_LVLS; if (lvl <= L[0]) return t[0]; if (lvl >= L[L.length - 1]) return t[t.length - 1];
    let i = 0; while (lvl > L[i + 1]) i++;
    const k = (lvl - L[i]) / (L[i + 1] - L[i]); return t[i] + (t[i + 1] - t[i]) * k;
  };
  const charDamage = (S, F, e, f, mult = 1, tgt = null) => {
    const el = f.el === "best" ? bestEl(e.st) : f.el || "n";
    const E2 = ELEMENTS[el]; const stat = (e.st[E2.stat] || 0) + buffSum(e, E2.stat);
    const pui = e.st.pui + buffSum(e, "pui");
    let v = rf(f.min, f.max) * E.DMG_SCALE * (1 + Math.max(-50, stat + pui) / 100) + e.st.do + buffSum(e, "do") + (e.st[E2.dmg] || 0);
    const wc = e.wcast; // 0.1.53 : coup d'arme en cours
    let crit = !(F && F.idol && F.idol.noCrit) && rnd() * 100 < Math.min(60, 5 + e.st.cri + buffSum(e, "cri") + (wc && wc.wfx === "precis" ? 10 : 0) + (e.idCrit || 0)); // identité : Critique
    if (crit) v = v * 1.25 + 3 + (e.st.dcri || 0) + buffSum(e, "dcri") + (wc ? (wc.ccb || 0) * E.DMG_SCALE * E.WEAPON.mult : 0);
    if (wc && wc.wfx === "grace" && tgt && tgt.hp < tgt.hpMax * 0.3) v *= 1.25;
    if (e.lg && E.legDmg) { const o = E.legDmg(F, e, tgt, el, crit, v); v = o.v; crit = o.crit; } // 0.1.48 : passifs des légendaires
    if (e.dp && E.dofpDmg) v = E.dofpDmg(F, e, tgt, crit, v); // 1.0.16 : passifs des Dofus
    if (E.sealDmg && (e.seal || (F && (F.sealMen || F.sealReso)))) v = E.sealDmg(F, e, tgt, v); // Sceaux de champion, Meneur et Conclave
    v *= 1 + (e.dmgBonus || 0) / 100;
    if (E.srDmg && e.cls === "sram") v = E.srDmg(F, e, tgt, v); // Sram (sram.js)
    v *= 1 + (e.st.dsort || 0) / 100;
    v *= mult;
    // 0.1.12 : Éveils de la Renaissance (Fureur, Premier sang)
    if (e.ev) { v *= 1 + 0.04 * (e.ev.fureur || 0); if (F && F.round === 1) v *= 1 + 0.08 * (e.ev.premier || 0); }
    if (e.mt) { const M = e.mt; v *= (1 + (M.d + (M[el] || 0)) / 100) * (F && F.round === 1 ? 1 + M.t1 / 100 : 1) * (e.hp < e.hpMax / 2 ? 1 + M.low / 100 : 1) * (crit ? 1 + M.cx / 100 : 1);
      if (M.boss || M.exe || M.cre || M.chd) v *= (tgt && tgt.boss ? 1 + M.boss / 100 : 1) * (tgt && tgt.hp < tgt.hpMax * 0.3 ? 1 + M.exe / 100 : 1) * (1 + M.cre * Math.min(10, Math.max(0, (F ? F.round : 1) - 1)) / 100) * (tgt && tgt.champ ? 1 + M.chd / 100 : 1); } // 2.0 : Maîtrise ; 2.1 : branches lointaines (boss, bourreau, crescendo, Champions)
    if (e.bt && tgt && tgt.race !== undefined && e.bt[tgt.race]) v *= 1 + e.bt[tgt.race] / 100; // 2.0 : Maîtrise du Bestiaire
    // passifs et mécaniques de classe (evc : rang de l'Éveil de classe, 0 à 2, qui renforce le passif)
    const evc = e.evc || 0;
    if (tgt && tgt.boss && e.cls === "iop") v *= 1.1;
    if (e.cls === "sacri") v *= (1 + (0.3 + 0.06 * evc) * (1 - e.hp / e.hpMax)) * (1 + (0.02 + 0.004 * evc) * (e.suffer || 0));
    if (e.cls === "roub" && alive(F, "m").length >= 4) v *= 1.15 + 0.05 * evc;
    if (e.cls === "hupper" && e.lastEl && e.lastEl !== el) v *= 1.1 + 0.05 * evc;
    if (e.cls === "ougi" && tgt) { e.ougi = e.lastTgt === tgt ? Math.min(5, (e.ougi || 0) + 1) : 0; e.lastTgt = tgt; v *= 1 + (0.05 + 0.01 * evc) * e.ougi; }
    if (e.posture === "lance") v *= 1.2 + 0.05 * evc;
    if (e.cls === "cra") v *= 1 + Math.max(0, 0.4 + 0.1 * evc - 0.1 * ((F ? F.round : 1) - 1));
    if (e.cls === "panda") v *= 1 + (0.06 + 0.015 * evc) * (e.ivresse || 0);
    if (e.mask === "atk") v *= 1.3 + 0.1 * evc;
    v *= E.classPow(e.cls, e.lvl);
    if (F && F.pvp) v *= e.kp || 1; // 0.1.44 : équilibrage propre au Kolizéum
    if (tgt && tgt.race !== undefined && F.expertRaces && F.expertRaces.has(tgt.race)) v *= 1.1;
    e.lastEl = el;
    return { v, crit, el };
  };
  const healAmount = (e, f) => {
    const pui = e.st.pui + buffSum(e, "pui");
    return (rf(f.min, f.max) * E.DMG_SCALE * (1 + (e.st.ine + buffSum(e, "ine") + pui) / 100) + e.st.so) * (e.cls === "eni" ? 1 + psv(e).eniSoin + 0.05 * (e.evc || 0) : 1) * (e.mask === "soin" ? 1.25 : 1) * (1 + 0.06 * ((e.ev || {}).main || 0)) * (1 + ((e.mt && e.mt.h) || 0) / 100);
  };
  E.doHeal = (t, v, F) => doHeal(t, v, F); // 0.1.10 : exposé pour les tests (idole Ougah)
  const doHeal = (t, v, F) => {
    if (t.side === "c" && F && F.idol && F.idol.heals) { if (F.idol.heals === "none") return 0; v *= 0.5; } // idoles Ougah et Bihilete
    if (F && F.pvp && F.ero) v *= 1 - F.ero / 100; // érosion du Kolizéum
    if (t.side === "m" && E.idHealIn) v *= E.idHealIn(t, F); // identité : Érosion
    if (t.side === "c") { const cut = debSum(t, "healcut") + (F && F.rot >= F.round ? 50 : 0); if (cut) v *= 1 - Math.min(80, cut) / 100; if (t.healIn) v *= 1 + t.healIn / 100; }
    if (F && E.dofpHealIn && F.actor && F.actor.side === t.side && (t.dp || F.actor.dp)) v *= E.dofpHealIn(F, t) * E.dofpHealOut(F, F.actor); // 1.0.16 : Kaliptus, Dofawa
    const before = t.hp; t.hp = Math.min(t.hpMax, t.hp + Math.round(v)); const g = t.hp - before;
    if (F && t.side === "c" && !t.summon && g > 0) { F.healed = (F.healed || 0) + g; const a = F.actor && F.actor.side === "c" ? (F.actor.summon ? F.ents[F.actor.owner] : F.actor) : null; if (a && !a.summon) a.healDone = (a.healDone || 0) + g; } // 1.0.4 : soins par héros
    if (F && E.dofpHealed && F.actor && F.actor.dp && F.actor.side === t.side) E.dofpHealed(F, F.actor, t, g); // 1.0.16 : Dotruche, Verdoyant, Kaliptus
    if (F && F.fx && g > 0) F.fx.push({ seq: F.seq, k: "heal", t: F.ents.indexOf(t), v: g });
    return g;
  };

  const condOk = (F, e, cond) => {
    const allies = alive(F, "c"); const foes = alive(F, "m");
    switch (cond) {
      case "first_turn": return F.round === 1;
      case "ally_low": return allies.some((a) => a.hp / a.hpMax < 0.6);
      case "self_low": return e.hp / e.hpMax < 0.5;
      case "enemy_many": return foes.length >= 3;
      case "enemy_one": return foes.length === 1;
      case "boss": return foes.some((f) => f.boss);
      case "no_summon": return !ownSums(F, F.ents.indexOf(e)).length;
      case "ally_shield": return allies.some((a) => !a.summon && !(a.shield > 0));
      default: return true;
    }
  };

  /* choix des cibles ennemies selon la stratégie (et les challenges si l'IA les respecte) */
  const pickFoes = (S, F, e, slot, n, forced) => {
    const foes = alive(F, "m"); if (!foes.length) return [];
    const c = S.chars.find((x) => x.id === e.cid);
    let prim = forced && forced.alive && forced.side === "m" ? forced : null;
    if (!prim && e.cid && E.chalRespect(S, c)) {
      const el = aiChal(S, F, "elitiste"); if (el && F.ents[el.target].alive) prim = F.ents[el.target];
      const od = aiChal(S, F, "ordonne"); if (!prim && od) prim = foes.slice().sort((a, b) => b.lvl - a.lvl)[0];
      const fo = (aiChal(S, F, "focus") || aiChal(S, F, "chacun")) && F.cs.focus[e.cid] !== undefined ? F.ents[F.cs.focus[e.cid]] : null; if (!prim && fo && fo.alive) prim = fo;
      if (!prim && aiChal(S, F, "chacun")) { // chacun son monstre : prendre de préférence un monstre qu'aucun autre héros n'a déjà pris
        const taken = new Set(Object.entries(F.cs.focus).filter(([k, v]) => +k !== e.cid && F.ents[v].alive).map(([, v]) => v));
        const free = foes.filter((m) => !taken.has(F.ents.indexOf(m))).sort((a, b) => a.hp - b.hp);
        if (free.length) prim = free[0];
      }
    }
    if (prim && !forced && prim.mech && prim.mech.includes("totems") && foes.some((x) => x.totem)) prim = null; // 2.1.13 : cible du challenge intouchable (totems) : on frappe ailleurs
    const rule = (slot && slot.tgt) || "low";
    if (rule === "low" && !prim) { // 0.1 : cible prioritaire de l'équipe
      const focus = (S.settings && S.settings.focus) || "auto";
      const inv = (m) => m.mech && m.mech.includes("totems") && foes.some((x) => x.totem);
      const prio = (m) => (m.bomb ? 5 : m.totem ? 4 : 0) + (inv(m) ? -9 : 0) + (focus === "auto" && ["soigneur", "chef", "invoc", "protect"].includes(m.role) ? 2 : 0) + (focus === "boss" && m.boss ? 2 : 0);
      const best = foes.slice().sort((a, b) => prio(b) - prio(a) || a.hp - b.hp);
      if (prio(best[0]) > 0 || foes.some(inv)) prim = best[0];
    }
    const sorted = foes.slice().sort(rule === "high" ? (a, b) => b.hp - a.hp : rule === "boss" ? (a, b) => (b.boss ? 1e6 : 0) + b.lvl - ((a.boss ? 1e6 : 0) + a.lvl) : rule === "mark" ? (a, b) => ((b.mark > 0 ? 1e6 : 0) + debSum(b, "vuln") * 1e3 - b.hp) - ((a.mark > 0 ? 1e6 : 0) + debSum(a, "vuln") * 1e3 - a.hp) : (a, b) => a.hp - b.hp);
    if (!prim) prim = sorted[0];
    return [prim, ...sorted.filter((x) => x !== prim)].slice(0, Math.max(1, n));
  };
  const SUM_LIMIT = (e) => Math.min(E.TACT.invMax, (e.cls === "osa" ? 2 : 1) + ((e.st && e.st.inv) || 0));
  /* invocations posées par un héros (les recrues et l'âme de boss de l'Ascension ne comptent pas) */
  const ownSums = (F, own) => alive(F, "c").filter((a) => a.summon && a.owner === own && a.recruit === undefined && !a.soul);
  const makeSummon = (S, F, e, f) => {
    const own = F.ents.indexOf(e);
    if (ownSums(F, own).length >= SUM_LIMIT(e)) return null;
    const info = (D.SUMMONS || {})[String(f.mid)] || {}; const boost = e.cls === "osa" ? 1.3 + 0.15 * (e.evc || 0) : 1;
    const hp = Math.round(e.hpMax * 0.35 * boost);
    const s = { side: "c", tm: e.tm, summon: true, owner: own, name: info.name || "Invocation", img: info.img || null, cls: e.cls, lvl: e.lvl, hpMax: hp, hp, ini: e.ini - 1,
      dmg: (4 + e.lvl * 1.1) * (1 + (e.st[ELEMENTS[mainElE(e)].stat] || 0) / 250) * (e.cls === "steam" ? 1.4 + 0.1 * (e.evc || 0) : 1) * (e.cls === "osa" ? 1 + (e.st.pui || 0) / 200 : 1) * (e.cls === "cra" ? 0.35 : e.cls === "roub" ? 0.6 : 1) + (e.cls === "osa" ? (e.st.do || 0) / 2 : 0), el: mainElE(e), // 0.1.12.4 : les balises du Crâ sont des outils, pas des combattants ; 0.1.14.4 : bombes du Roublard un peu moins fortes
      turret: e.cls === "steam", tree: e.cls === "sadi", buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, paLoss: 0 };
    if (F.pvp) s.dmg *= e.kp || 1;
    F.ents.push(s); F.order.push(F.ents.indexOf(s));
    F.fx.push({ seq: F.seq, k: "summon", t: F.ents.indexOf(s) });
    return s;
  };
  const mainElE = (e) => { const c = CLASSES[e.cls]; return (c && STATS[c.main] && STATS[c.main].el) || "t"; };

  /* lance un sort de héros : applique tous ses effets */
  const castSpell = (S, F, e, sp, forced, slot) => {
    const g = E.spellGrade(sp, e.lvl); const allies = alive(F, "c").filter((a) => !a.summon); const parts = []; let ok = false; let extraPa = 0;
    const kind = E.spellKind(g); e.wcast = sp.wp ? sp : null;
    if (E.srCast && e.cls === "sram") { const r0 = E.srCast(S, F, e, sp, g); if (r0) { e.wcast = null; return r0; } } // Sram (sram.js)
    // sorts inutiles : ne pas les gaspiller
    if (kind === "heal" && !alive(F, "c").some((a) => a.hp < a.hpMax)) return { ok: false };
    if (kind === "summon" && ownSums(F, F.ents.indexOf(e)).length >= SUM_LIMIT(e)) return { ok: false };
    if (kind === "shield" && !g.fx.some((f) => f.k === "shield" && (f.all ? allies.some((a) => !(a.shield > 0)) : !(e.shield > 0)))) return { ok: false };
    if (kind === "buff") { // pas de bonus déjà actif, pas d'affaiblissement déjà posé sur la cible
      const bf = g.fx.filter((f) => f.k === "buff" && f.st !== "pa");
      if (bf.length && !g.fx.some((f) => f.k === "buff" && f.st === "pa") && bf.every((f) => (f.all ? allies : [e]).every((t) => (t.buffs || []).some((b) => b.name === sp.name && b.turns > 0)))) return { ok: false };
      const db = g.fx.filter((f) => ["weaken", "vuln", "apdrain"].includes(f.k));
      if (!bf.length && db.length) { const t0 = pickFoes(S, F, e, slot, 1, forced)[0]; if (!t0) return { ok: false };
        if (db.every((f) => (f.k === "apdrain" ? t0.paLoss > 0 : (t0.debuffs || []).some((d) => d[f.k === "weaken" ? "weak" : "vuln"] && d.turns > 0)))) return { ok: false }; }
    }
    let classMult = 1;
    if (e.cls === "iop" && e.stack >= 6 - (e.evc || 0) && ["dmg", "aoe", "drain", "dot"].includes(kind)) { classMult *= 1.4; e.stack = 0; parts.push("Colère !"); }
    if (e.cls === "panda" && ["dmg", "aoe", "drain", "dot"].includes(kind) && rnd() < 0.03 * (e.ivresse || 0)) { e.ivresse = Math.min(5, (e.ivresse || 0) + 1); flog(F, `${e.name} · ${sp.name} → raté, l'ivresse fait tituber le Pandawa !`, "dim"); return { ok: true, extraPa: 0 }; }
    if (F.idol && F.idol.fail && ["dmg", "aoe", "drain", "dot", "heal"].includes(kind) && rnd() < F.idol.fail) { flog(F, `${e.name} · ${sp.name} → échec (idole Yushe) !`, "dim"); return { ok: true, extraPa: 0 }; }
    if (e.cls === "hupper" && (e.els || []).length >= 4) { classMult *= 1.3 + 0.1 * (e.evc || 0); e.els = []; }
    if (E.srMult && e.cls === "sram" && kind !== "heal") classMult *= E.srMult(F, e, parts); // Sram (sram.js)
    if (e.cls === "eni" && e.eniDmg && kind !== "heal") { classMult *= 1 + psv(e).eniLie + 0.05 * (e.evc || 0); e.eniDmg = false; }
    let leech = 0; let dealt = 0; const hitIdx = [];
    const idc = E.idPre ? E.idPre(F, e, sp, g, parts) : null; if (idc && idc.crit) e.idCrit = idc.crit; // identité des sorts (js/identite.js)
    for (const f of g.fx) {
      if (f.k === "leech") { leech = f.v; continue; }
      if (f.k === "dmg" || f.k === "drain" || f.k === "dot") {
        let nT = f.n; // 0.1.9.1 : Portée (exo) : un sort à une cible touche un ennemi de plus, 20 % par point
        if (nT === 1 && f.k !== "dot" && e.st && e.st.po > 0 && rnd() * 100 < Math.min(E.TACT.po[1], e.st.po * E.TACT.po[0])) { nT = 2; tlog("po"); }
        const ts = pickFoes(S, F, e, slot, nT, forced); if (!ts.length) continue;
        let m = f.n > 1 ? 0.85 * (e.cls === "elio" ? 1.25 + 0.1 * (e.evc || 0) : 1) * (e.cls === "roub" ? 1.15 : 1) : 1;
        if (f.n > 1 && F.idol && F.idol.aoeMul !== 1) m *= F.idol.aoeMul; // idole Gilimin
        if (f.k === "dot") m *= 0.55 * (e.cls === "sram" ? 1.25 + 0.1 * (e.evc || 0) : 1) * (e.cls === "roub" ? 1.15 : 1);
        const vals = [];
        ts.forEach((t) => {
          const r = charDamage(S, F, e, f, m * classMult * (idc ? E.idMul(F, e, idc, t, f) : 1), t);
          if (f.k === "dot" && t.noDot) vals.push("immunisé"); else if (f.k === "dot") { if (e.cls === "sadi") { const mine = t.dots.filter((x) => x.src === e.name); if (mine.length >= 3 + (e.evc || 0)) t.dots.splice(t.dots.indexOf(mine[0]), 1); } t.dots.push({ v: r.v, turns: f.t || 2, el: r.el, src: e.name }); vals.push(`poison ${Math.round(r.v)}×${f.t || 2}`); }
          else { const d = dealDamage(F, e, t, r.v, r.el); dealt += d;
            if (r.crit) { const lf = F.fx[F.fx.length - 1]; if (lf && lf.k === "hit" && lf.t === F.ents.indexOf(t)) lf.crit = true; }
            if (e.cls === "enu" && f.n === 1 && t.alive && t.pelle !== F.round && rnd() < psv(e).enuPelle + 0.05 * (e.evc || 0)) { t.pelle = F.round; t.paLoss = Math.min(3, (t.paLoss || 0) + 1); vals.push("Pelle ! −1 PA"); } vals.push(`−${d}${r.crit ? "!" : ""}`); if (f.k === "drain") doHeal(e, d * (e.cls === "sacri" ? psv(e).sacriDrain : 0.5), F); if (e.cls === "cra" && f.n === 1 && t.alive) t.mark = 2; if (idc) E.idHit(F, e, idc, t, d, f, vals); }
          hitIdx.push(F.ents.indexOf(t));
          if (!e.els.includes(r.el)) e.els.push(r.el);
          const ce = chal(F, "elementaire"); if (ce && r.el && e.cid !== undefined) { const ek = F.cs.el = F.cs.el || {}; if (!ek[e.cid]) ek[e.cid] = r.el; else if (ek[e.cid] !== r.el) failChal(F, "elementaire", `${e.name} a utilisé deux éléments`); }
        });
        parts.push(`${ts.length > 1 ? ts.length + " cibles" : ts[0].name} : ${vals.join(" / ")}`); ok = true;
        if (f.k === "drain") { const ci = chal(F, "incurable"); if (ci) failChal(F, "incurable", "vol de vie"); }
        if (e.cls === "eni") e.eniHeal = true;
      } else if (f.k === "heal" || f.k === "healpct") {
        const ts = f.self ? [e] : f.n > 1 ? alive(F, "c") : [ (forced && forced.alive && forced.side === "c") ? forced : alive(F, "c").slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] ];
        let tot = 0; const bonus = e.cls === "eni" && e.eniHeal ? 1 + psv(e).eniLie : 1; if (e.cls === "eni") { e.eniHeal = false; e.eniDmg = true; }
        ts.forEach((t) => { if (!t) return; const want = (f.k === "healpct" ? t.hpMax * f.v / 100 * (1 + e.st.so / 200) * (1 + ((e.mt && e.mt.h) || 0) / 100) : healAmount(e, f) * bonus) * (F.roulette === "face" ? 1.15 : 1) * (e.lg && E.legHealMult ? E.legHealMult(e) : 1); const got = doHeal(t, want, F); tot += got; if (e.cls === "eni" && E.PSV.eniSurplus && !F.pvp && want > got && t.alive) t.shield = Math.round(Math.min(t.hpMax * 0.25, (t.shield || 0) + (want - got) * E.PSV.eniSurplus)); /* Eniripsa : le soin en trop devient bouclier */ if (e.lg && E.legHealed) E.legHealed(F, e, t, want, got); });
        if (tot) { parts.push(`+${tot} PV`); ok = true; failChal(F, "incurable", "soin lancé"); }
      } else if (f.k === "shield") {
        const ts = f.all ? alive(F, "c") : [e]; const k = (e.cls === "feca" ? 1.25 : 1) * (1 + 0.06 * ((e.ev || {}).main || 0)) * Math.max(0.1, 1 + ((e.mt && e.mt.h) || 0) / 100); // 2.1 : la Maîtrise « soins et boucliers » compte aussi pour les boucliers
        ts.forEach((t) => { t.shield = Math.max(t.shield || 0, Math.round(t.hpMax * f.pct / 100 * k * (F.roulette === "face" ? 1.15 : 1) * (F.idol && F.idol.shieldHalf ? 0.5 : 1))); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: `Bouclier ${t.shield}` }); });
        parts.push("bouclier"); ok = true;
      } else if (f.k === "buff") {
        if (f.st === "pa") { extraPa += f.v; parts.push(`+${f.v} PA`); ok = true; continue; }
        const ts = f.all ? alive(F, "c") : [e];
        ts.forEach((t) => { t.buffs.push({ [f.st]: f.v, turns: f.t, name: sp.name }); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: `+${f.v} ${(STATS[f.st] || {}).short || f.st}` }); });
        parts.push(`+${f.v} ${(STATS[f.st] || {}).short || f.st}${ts.length > 1 ? " (équipe)" : ""}`); ok = true;
      } else if (f.k === "apdrain" || f.k === "weaken" || f.k === "vuln") {
        const ts = pickFoes(S, F, e, slot, f.n, forced); if (!ts.length) continue;
        ts.forEach((t) => { if (f.k === "apdrain") t.paLoss = Math.min(3, (t.paLoss || 0) + f.v); else t.debuffs.push({ [f.k === "weaken" ? "weak" : "vuln"]: f.v, turns: f.t || 1 }); });
        parts.push(f.k === "apdrain" ? `−${f.v} PA` : f.k === "weaken" ? `affaiblit (−${f.v} %)` : `vulnérable (+${f.v} %)`); ok = true;
      } else if (f.k === "summon") {
        const s2 = makeSummon(S, F, e, f); if (s2) { parts.push(`invoque ${s2.name}`); ok = true; }
      }
    }
    if (e.cls === "iop" && dealt) doHeal(e, dealt * 0.08, F); // Vigueur
    if (e.cls === "elio" && dealt) { if (!e.portal && g.fx.some((f) => f.n > 1 && ["dmg", "drain", "dot"].includes(f.k))) { e.portal = true; e.shield = Math.max(e.shield || 0, Math.round(e.hpMax * 0.08)); parts.push("bouclier de portail"); } doHeal(e, dealt * 0.1, F); }
    if (leech && dealt) { const h = doHeal(e, dealt * leech / 100, F); if (h) parts.push(`+${h} PV`); failChal(F, "incurable", "vol de vie"); }
    if (idc && ok) extraPa += E.idPost(F, e, idc, g, dealt, hitIdx, parts); e.idCrit = 0;
    if (sp.wp && ok) weaponFx(S, F, e, sp, dealt, hitIdx, parts);
    e.wcast = null;
    if (!ok) return { ok: false };
    if (E.srPost && e.cls === "sram") extraPa += E.srPost(F, e, hitIdx, parts); // Sram (sram.js)
    if (kind === "shield" || kind === "buff") failChal(F, "barbare", `${sp.name} lancé`);
    if (e.cls === "iop") e.stack = Math.min(6, (e.stack || 0) + 1);
    if (e.cls === "panda") e.ivresse = Math.min(5, (e.ivresse || 0) + 1);
    if (e.posture === "rempart" && dealt) e.shield = Math.max(e.shield || 0, Math.round(e.hpMax * 0.05));
    if (e.cls === "xelor") { e.clock = (e.clock || 0) + 1; if (e.clock >= 12 - (e.evc || 0)) { e.clock = 0; alive(F, "c").filter((a) => !a.summon).forEach((a) => { a.paBonus = 1; for (const k in a.cd) if (a.cd[k] > 0) a.cd[k]--; }); flog(F, `L'horloge de ${e.name} sonne midi : +1 PA pour l'équipe au prochain tour, sorts rechargés plus vite.`, "buff"); } }
    e.nCast = (e.nCast || 0) + 1;
    // challenges liés aux sorts
    const cs = F.cs; const key = e.cid;
    const tc = (cs.turnCasts[key] = cs.turnCasts[key] || {}); tc[sp.id] = (tc[sp.id] || 0) + 1; if (tc[sp.id] > 1) failChal(F, "versatile", `${sp.name} lancé deux fois`);
    if (cs.last[key] === sp.id) failChal(F, "econome", `${sp.name} lancé deux fois de suite`); cs.last[key] = sp.id;
    const foeHits = hitIdx.filter((i) => F.ents[i].side === "m");
    if (foeHits.length) {
      (cs.hitTurn[key] = cs.hitTurn[key] || new Set()); foeHits.forEach((i) => cs.hitTurn[key].add(i));
      if (chal(F, "focus") || chal(F, "chacun")) {
        const f0 = cs.focus[key];
        if (f0 !== undefined && F.ents[f0].alive && !foeHits.includes(f0)) failChal(F, chal(F, "chacun") ? "chacun" : "focus", "une autre cible a été attaquée");
        if (f0 === undefined || !F.ents[f0].alive) cs.focus[key] = foeHits[0];
      }
    }
    const pushed = foeHits.length && !F.pvp ? pushFoes(F, e, g, foeHits) : null; // 1.0.30 : poussée
    flog(F, `${e.name} · ${sp.name}${parts.length ? " → " + parts.join(", ") : ""}`, "c");
    if (pushed) pushed.lines.forEach((x) => flog(F, x, "c pou"));
    foeHits.forEach((i) => { if (!F.ents[i].alive) flog(F, `${F.ents[i].name} est vaincu.`, "ko"); });
    if (pushed) pushed.ko.forEach((t) => { if (!foeHits.includes(F.ents.indexOf(t))) flog(F, `${t.name} est vaincu.`, "ko"); });
    return { ok: true, extraPa };
  };
  /* 1.0.30 : chaque monstre touché par un sort qui repousse peut percuter un autre monstre (E.PUSH) */
  const pushFoes = (F, e, g, idx) => {
    const f = g.fx.find((x) => x.k === "push"); if (!f) return null;
    const out = { lines: [], ko: [] };
    [...new Set(idx)].map((i) => F.ents[i]).forEach((t) => {
      if (!t || !t.alive || t.side !== "m") return;
      const others = alive(F, "m").filter((m) => m !== t);
      if (!others.length || rnd() >= E.pushChance(others.length + 1)) return;
      const o = pick(others); const left = 1 + Math.floor(rnd() * E.pushCells(e.st, f.v));
      const v = E.pushDmg(e.lvl, e.st && e.st.pou, left);
      F.pushHit = 1; const d = dealDamage(F, e, t, v, null); const d2 = dealDamage(F, e, o, v * E.PUSH.other, null); F.pushHit = 0; // pas un coup du héros : ni reflet, ni riposte, ni effet « au coup »
      tlog("pou"); F.pushDmg = (F.pushDmg || 0) + d + d2;
      out.lines.push(`Poussée : ${t.name} percute ${o.name} : −${d} / −${d2}`); // court : la ligne tient au téléphone
      [t, o].forEach((m) => { if (!m.alive && !out.ko.includes(m)) out.ko.push(m); });
    });
    return out;
  };
  /* 0.1.53 : effet du type d'arme, après le coup */
  const weaponFx = (S, F, e, sp, dealt, hitIdx, parts) => {
    const fx = sp.wfx; const foes = hitIdx.map((i) => F.ents[i]).filter((t) => t.side !== e.side || (F.pvp && t.tm !== e.tm));
    const per = foes.length ? dealt / foes.length : 0; const el = sp.el === "best" ? bestEl(e.st) : sp.el;
    if (fx === "garde") { e.wguard = 1; parts.push("garde"); }
    if (!per) return;
    if (fx === "onde") { const others = F.pvp ? F.ents.filter((t) => t.alive && t.tm !== e.tm && !foes.includes(t)) : alive(F, "m").filter((t) => !foes.includes(t));
      const hit = others.slice(0, 2).map((t) => { const d = dealDamage(F, e, t, per * 0.4, el); return `${t.name} −${d}`; }); if (hit.length) parts.push(`onde de choc : ${hit.join(", ")}`); }
    if (fx === "bened") { const al = (F.pvp ? F.ents.filter((a) => a.alive && a.tm === e.tm) : alive(F, "c")).filter((a) => a.hp < a.hpMax).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (al) { const h = doHeal(al, dealt * 0.2, F); if (h) parts.push(`bénédiction +${h} PV`); } }
    if (fx === "entaille") { const t = foes.find((x) => x.alive && !x.noDot); if (t) { t.dots.push({ v: Math.max(1, per * 0.15), turns: 2, el, src: e.name }); parts.push("entaille"); } }
    if (fx === "deterre" && !F.pvp) foes.forEach((t) => { if (!t.alive && rnd() < 0.25) { F.treasure = (F.treasure || 0) + 1; parts.push("déterre une ressource"); } });
  };
  /* l'IA saute les sorts qui feraient échouer un challenge (si l'option est activée) */
  const chalSkip = (S, F, e, c, sp, g) => {
    if (!E.chalRespect(S, c)) return false;
    const k = E.spellKind(g); const key = e.cid;
    if (aiChal(S, F, "versatile") && (F.cs.turnCasts[key] || {})[sp.id]) return true;
    if (aiChal(S, F, "econome") && F.cs.last[key] === sp.id) return true;
    if (aiChal(S, F, "incurable") && (k === "heal" || k === "drain" || g.fx.some((f) => f.k === "leech"))) return true;
    const multi = g.fx.some((f) => ["dmg", "drain", "dot"].includes(f.k) && f.n > 1) && alive(F, "m").length > 1;
    // Focus, Chacun son monstre : les sorts de zone restent permis tant qu'ils touchent la cible du héros
    if (multi && (aiChal(S, F, "elitiste") || aiChal(S, F, "ordonne"))) { // Élitiste, Ordonné : zone permise sauf si elle risque d'achever un autre monstre avant son tour
      const el = aiChal(S, F, "elitiste"), foes = alive(F, "m"), top = Math.max(...foes.map((m) => m.lvl));
      const ok = (m) => (el ? F.ents.indexOf(m) === el.target || !F.ents[el.target].alive : true) && (!aiChal(S, F, "ordonne") || m.lvl >= top);
      if (foes.some((m) => !ok(m) && m.hp < m.hpMax * 0.6)) return true;
    }
    if (aiChal(S, F, "barbare") && (k === "shield" || k === "buff")) return true;
    if (aiChal(S, F, "elementaire") && sp.el && sp.el !== "best" && sp.el !== ((F.cs.el || {})[key] || E.mainEl(c)) && ["dmg", "aoe", "drain", "dot"].includes(k)) return true;
    return false;
  };

  /* Mode manuel : le joueur choisit sorts et cibles ; retour en automatique après 10 s sans action */
  E.MANUAL_TIMEOUT = 10;
  E.manualOn = (S) => !!(S.settings && S.settings.manual && S.manualLive);
  /* estimation des dégâts d'un sort pour l'IA (caractéristique de l'élément, nombre de cibles réel) */
  const spellValue = (F, e, g) => {
    const nf = alive(F, "m").length; const pui = e.st.pui + buffSum(e, "pui");
    return g.fx.reduce((s2, f) => {
      if (!["dmg", "drain", "dot"].includes(f.k)) return s2 + (f.k === "vuln" || f.k === "weaken" ? 2 : 0);
      const el = f.el === "best" ? bestEl(e.st) : f.el || "n"; const E2 = ELEMENTS[el] || ELEMENTS.n;
      const stat = (e.st[E2.stat] || 0) + buffSum(e, E2.stat);
      let v = ((f.min + f.max) / 2) * (1 + Math.max(-50, stat + pui) / 100) * Math.min(f.n || 1, nf) * (f.n > 1 ? 0.85 : 1);
      if (f.k === "dot") v *= (f.t || 2) * 0.5;
      if (f.k === "drain" && e.hp < e.hpMax * 0.7) v *= 1.15;
      return s2 + v;
    }, 0);
  };
  /* 0.1.13.4 « Héros plus malin » : le héros prépare tout son tour. Pour chaque combinaison d'attaques qui tient dans ses PA,
     il estime les dégâts vraiment utiles : résistances de chaque cible (et peau du boss), PV restants (pas de dégâts perdus
     sur un monstre déjà mort), bonus quand un monstre tombe (coup de grâce), zone seulement s'il y a plusieurs ennemis.
     Il lance ensuite le sort le plus utile de la meilleure combinaison, puis recommence avec la situation nouvelle. */
  E.PLAN = { kill: 0.3, depth: 5, passifs: !(typeof process !== "undefined" && process.env && process.env.NO_PASSIFS) }; // 2.1.21 : passifs = l'IA connaît le passif de l'Huppermage et la valeur des mécaniques des sorts
  const atkFx = (F, e, g, sp) => { const pui = e.st.pui + buffSum(e, "pui"); const ip = E.PLAN.passifs && E.idPlan && sp ? E.idPlan(F, e, sp) : null;
    const pw = E.classPow(e.cls, e.lvl) * (ip ? ip.m : 1); // 2.1.21 : valeur de la mécanique du sort (cumul, bombe, écho…) dans la situation du moment
    return g.fx.filter((f) => ["dmg", "drain", "dot"].includes(f.k)).map((f) => {
      const el = f.el === "best" ? bestEl(e.st) : f.el || "n"; const E2 = ELEMENTS[el] || ELEMENTS.n;
      const stat = (e.st[E2.stat] || 0) + buffSum(e, E2.stat);
      let v = (((f.min + f.max) / 2) * E.DMG_SCALE * (1 + Math.max(-50, stat + pui) / 100) + (e.st.do || 0) + (e.st[E2.dmg] || 0)) * pw * (f.n > 1 ? 0.85 : 1);
      if (f.k === "dot") v *= 0.55 * (f.t || 2) * 0.85; // un poison arrive plus tard : un peu moins utile
      if (f.k === "drain" && e.hp < e.hpMax * 0.7) v *= 1.15;
      return { v, el, n: f.n || 1, dot: f.k === "dot", ip };
    }); };
  const planGain = (fx, foes, hp, F) => { // dégâts utiles d'un sort sur l'état estimé (hp modifié en place)
    let gain = 0;
    for (const f of fx) {
      const order = foes.map((m, i) => i).filter((i) => hp[i] > 0).sort((x, y) => hp[x] - hp[y]).slice(0, f.n);
      for (const i of order) { const t = foes[i]; if (f.dot && t.noDot) continue;
        let r = Math.min(50, (t.res || {})[f.el] || 0); let d = f.v * (1 - r / 100) * (f.ip && F ? E.idPlanT(F, f.ip, { ...t, hp: hp[i] }) : 1);
        if (t.skinEl && t.skinEl === f.el) d *= t.mech && t.mech.includes("humeurs") ? 0.25 : 0.5;
        if (t.shield) d = Math.max(d * 0.3, d - t.shield);
        const used = Math.min(d, hp[i]); gain += used; hp[i] -= used;
        if (hp[i] <= 0) gain += E.PLAN.kill * t.hpMax; }
    }
    return gain;
  };
  /* 2.1.21 « Mon ordre » : l'IA connaît le passif de l'Huppermage (élément différent du précédent +10 %, 4 éléments = runes ×1,3) ;
     pour lui l'ordre des attaques compte, toutes les suites sont donc essayées */
  const hupMul = (e, el, lastEl, els) => { const evc = e.evc || 0; return (lastEl && lastEl !== el ? 1.1 + 0.05 * evc : 1) * (els.length >= 4 ? 1.3 + 0.1 * evc : 1); };
  const planTurn = (F, e, cands, pa) => { // cands : [{ idx, g, left }] ; renvoie l'idx à lancer
    const foes = alive(F, "m"); const hp0 = foes.map((m) => m.hp);
    const fxOf = cands.map((c) => atkFx(F, e, c.g, c.sp));
    const hup = e.cls === "hupper" && E.PLAN.passifs;
    // 2.1.21 : bonus posés par une attaque (Puissance, PA, vulnérabilité) : l'Osamodas délaissait Cri de l'Ours (+150 Puissance à l'équipe)
    const bonus = cands.map(() => 0);
    if (E.PLAN.passifs) {
      const perPa = Math.max(0, ...cands.map((c, k) => fxOf[k].reduce((a, f) => a + f.v * Math.min(f.n, Math.max(1, foes.length)), 0) / Math.max(1, c.g.pa)));
      const turn = perPa * Math.max(1, e.st.pa || 6); const team = 1 + 0.6 * Math.max(0, alive(F, "c").filter((a) => !a.summon).length - 1);
      const EL = ELEMENTS[bestEl(e.st)] || ELEMENTS.n; const base = 100 + Math.max(-50, (e.st[EL.stat] || 0) + buffSum(e, EL.stat) + e.st.pui + buffSum(e, "pui"));
      cands.forEach((c, k) => c.g.fx.forEach((f) => {
        if (f.k === "buff" && f.st === "pa") bonus[k] += f.v * perPa;
        else if (f.k === "buff" && (f.st === "pui" || f.st === EL.stat) && !(e.buffs || []).some((b) => b.name === c.sp.name && b.turns > 0)) bonus[k] += turn * (f.v / base) * Math.min(2, f.t || 1) * (f.all ? team : 1) * 0.5;
        else if (f.k === "vuln" && !foes.some((m) => (m.debuffs || []).some((d) => d.vuln && d.turns > 0))) bonus[k] += turn * (f.v / 100) * Math.min(2, f.t || 1) * team * 0.5;
      }));
    }
    let best = { v: -1, first: null };
    const rec = (from, pa, left, hp, total, first, firstGain, depth, lastEl, els) => {
      if (total > best.v || (total === best.v && first !== null && best.first === null)) best = { v: total, first, firstGain };
      if (depth >= E.PLAN.depth) return;
      for (let k = hup ? 0 : from; k < cands.length; k++) { // Huppermage : l'ordre compte, toutes les suites sont essayées
        const c = cands[k]; if (c.g.pa > pa || left[k] <= 0) continue;
        const h2 = hp.slice(); let fx = fxOf[k]; let le = lastEl, es = els;
        if (hup) fx = fx.map((f, i) => { const o = { ...f, v: f.v * (i === 0 ? hupMul(e, f.el, le, es) : le && le !== f.el ? 1.1 : 1) }; if (i === 0 && es.length >= 4) es = []; le = f.el; if (!es.includes(f.el)) es = es.concat(f.el); return o; });
        const gn = planGain(fx, foes, h2, F) + (left[k] === c.left ? bonus[k] : 0);
        if (gn <= 0) continue;
        left[k]--;
        const f2 = hup ? (first === null ? k : first) : first === null || gn > firstGain ? k : first; // dans la combinaison, on commence par le sort le plus utile
        rec(k, pa - c.g.pa, left, h2, total + gn, f2, f2 === k ? gn : firstGain, depth + 1, le, es);
        left[k]++;
      }
    };
    rec(0, pa, cands.map((c) => c.left), hp0, 0, null, 0, 0, e.lastEl || null, (e.els || []).slice());
    return best.first === null ? null : cands[best.first].idx;
  };
  /* 2.1.21 « Mon ordre » (idée de Sky) : chaque attaque une fois, dans l'ordre de la barre, puis on recommence ; s'il manque de PA, la suivante */
  const orderPick = (e, cands) => { const o = cands.slice().sort((a, b) => a.idx - b.idx); const p = e.ordI ?? -1; const x = o.find((y) => y.idx > p) || o[0]; e.ordI = x.idx; return x.idx; };
  const castLimit = (g) => (g.casts > 0 ? Math.min(g.casts, 3) : 1);
  const charTurn = (S, F, e, paStart) => {
    const c = S.chars.find((x) => x.id === e.cid); if (!c) return;
    if (paStart === undefined) {
      F.cs.turnCasts[e.cid] = {}; F.cs.hitTurn[e.cid] = new Set(); e.portal = false;
      if (E.srTurn && e.cls === "sram") E.srTurn(F, e); // Sram (sram.js)
      if (e.stun > 0) { e.stun--; flog(F, `${e.name} ne peut pas bouger et passe son tour.`, "dim"); return endHeroTurn(S, F, e); }
      if (e.gold > 0) { e.gold--; flog(F, `${e.name} est une statue d'or et passe son tour.`, "dim"); return endHeroTurn(S, F, e); }
      if (e.cuve) { e.cuve = false; e.ivresse = 0; flog(F, `${e.name} cuve son ivresse et passe son tour.`, "dim"); return endHeroTurn(S, F, e); }
      if (e.cls === "feca") { e.glyphI = ((e.glyphI ?? -1) + 1) % 3; const gk = ["prot", "renvoi", "soin"][e.glyphI]; F.glyph = gk;
        { const P = psv(e); flog(F, `${e.name} pose un Glyphe ${gk === "prot" ? `de Protection (−${Math.round(P.fecaProt * 100)} % de dégâts subis)` : gk === "renvoi" ? `de Renvoi (${Math.round(P.fecaRenvoi * 100)} % des dégâts renvoyés)` : `de Soin (+${Math.round(P.fecaSoin * 100)} % des PV)`}.`, "buff"); }
        if (gk === "soin") alive(F, "c").forEach((a) => doHeal(a, a.hpMax * (psv(e).fecaSoin + 0.01 * (e.evc || 0)), F)); }
      if (e.cls === "sadi" && !F.pvp && E.PSV.sadiSeve && F.ents.some((t) => t.tree && t.summon && t.alive && t.side === "c")) alive(F, "c").forEach((a) => { if (a.hp < a.hpMax) doHeal(a, a.hpMax * E.PSV.sadiSeve * (1 + 0.25 * (e.evc || 0)), F); }); // Sadida : sève de l'arbre
      if (e.cls === "forge") { const np = e.hp > e.hpMax * 0.5 ? "lance" : "rempart"; if (np !== e.posture) { e.posture = np; flog(F, `${e.name} passe en posture ${np === "lance" ? "Lance (+20 % de dégâts)" : "Rempart (−25 % de dégâts subis)"}.`, "buff"); } }
      if (e.cls === "zobal") { // masque adapté à la situation
        const hurt = alive(F, "c").filter((a) => !a.summon && a !== e && a.hp < a.hpMax * 0.5).length;
        const nm = e.hp < e.hpMax * 0.45 ? "def" : hurt ? "soin" : "atk";
        if (nm !== e.mask) { e.mask = nm; flog(F, `${e.name} enfile le Masque ${nm === "def" ? "du Pleutre (défense)" : nm === "soin" ? "de l'Hystérique (soutien)" : "du Psychopathe (attaque)"}.`, "buff"); }
        if (e.mask === "soin") alive(F, "c").forEach((a) => { if (a.hp < a.hpMax) doHeal(a, a.hpMax * psv(e).zobSoin, F); });
      }
    }
    if (paStart === undefined && E.manualOn(S)) { F.await = { ei: F.ents.indexOf(e), pa: Math.max(1, e.st.pa - (e.paLoss || 0)), t: F.dur, n: 0, casts: {} }; e.paLoss = 0; return; }
    let pa = paStart !== undefined ? paStart : Math.max(1, e.st.pa - (e.paLoss || 0) + (e.paBonus || 0)); e.paLoss = 0; e.paBonus = 0; let cast = 0;
    if (paStart === undefined) e.wguard = 0; // la Garde du bâton dure jusqu'au tour suivant du porteur
    const bar = e.wsp ? [...c.spells, E.WSLOT] : c.spells; const defOf = (slot) => (slot.w ? e.wsp : E.spellDef(c.cls, slot.id)); // 0.1.53 : coup d'arme
    /* IA v4 : sorts utilitaires dans l'ordre de la barre, puis la meilleure combinaison d'attaques du tour (planTurn) */
    const nCast = {}; const blocked = new Set();
    for (let guard = 0; guard < 30; guard++) {
      if (!alive(F, "m").length) return endHeroTurn(S, F, e);
      let best = null, bestV = -1;
      bar.forEach((slot, idx) => {
        if (blocked.has(idx)) return;
        const sp = defOf(slot); if (!sp || sp.lvl > c.lvl) return;
        const g = E.spellGrade(sp, c.lvl);
        if ((nCast[idx] || 0) >= castLimit(g) || (e.cd[sp.id] || 0) > 0 || g.pa > pa) return;
        if ((e.silence > 0 && g.cd) || (e.rooted > 0 && E.spellKind(g) === "heal")) return;
        if (!condOk(F, e, slot.cond) || chalSkip(S, F, e, c, sp, g) || (F.idol && F.idol.heals === "none" && E.spellKind(g) === "heal")) return;
        const k = E.spellKind(g);
        // 0.1.24.3 : pas de sort de soin quand personne n'est blessé (un Crâ seul relançait Flèches Amoureuses en boucle sans jamais attaquer)
        if (k === "heal" && !slot.cond && !alive(F, "c").some((a) => !a.summon && a.hp < a.hpMax * 0.8)) return;
        const v = ["dmg", "aoe", "drain", "dot"].includes(k) ? spellValue(F, e, g) / Math.max(1, g.pa) : 1e6 - idx;
        if (v > bestV) { bestV = v; best = { slot, idx, sp, g }; }
      });
      if (best && ["dmg", "aoe", "drain", "dot"].includes(E.spellKind(best.g))) { // attaque : la meilleure combinaison du tour
        const cands = [];
        bar.forEach((slot, idx) => { if (blocked.has(idx)) return; const sp = defOf(slot); if (!sp || sp.lvl > c.lvl) return; const g = E.spellGrade(sp, c.lvl);
          if (!["dmg", "aoe", "drain", "dot"].includes(E.spellKind(g)) || (nCast[idx] || 0) >= castLimit(g) || (e.cd[sp.id] || 0) > 0 || g.pa > pa || (e.silence > 0 && g.cd)) return;
          if (!condOk(F, e, slot.cond) || chalSkip(S, F, e, c, sp, g)) return;
          cands.push({ idx, g, sp, slot, left: Math.min(castLimit(g) - (nCast[idx] || 0), g.cd ? 1 : 9) }); });
        const pick = c.atkMode === "ordre" && cands.length ? orderPick(e, cands) : cands.length > 1 ? planTurn(F, e, cands, pa) : null;
        const pc = pick !== null && cands.find((x) => x.idx === pick); if (pc) best = { slot: pc.slot, idx: pc.idx, sp: pc.sp, g: pc.g };
      }
      if (!best) break;
      F.seq++;
      const r = castSpell(S, F, e, best.sp, null, best.slot);
      if (!r.ok) { blocked.add(best.idx); continue; }
      nCast[best.idx] = (nCast[best.idx] || 0) + 1;
      pa -= best.g.pa; pa += r.extraPa || 0; cast++; if (best.g.cd) e.cd[best.sp.id] = (e.lg && E.legCd ? E.legCd(e, best.g.cd) : best.g.cd) + 1;
      F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e), sp: best.sp.id });
    }
    if (!cast && paStart === undefined) flog(F, `${e.name} passe son tour.`, "dim");
    e.lastCast = F.seq;
    if (false) {
      e.replayed = true; flog(F, `${e.name} distord le temps et rejoue !`, "buff");
      for (const k in e.cd) if (e.cd[k] > 0) e.cd[k]--;
      charTurn(S, F, e);
    }
    e.replayed = false;
    endHeroTurn(S, F, e);
  };
  const endHeroTurn = (S, F, e) => {
    if (e.cls === "panda" && (e.ivresse || 0) >= 5 && !e.cuve) e.cuve = true;
  };
  const summonTurn = (S, F, e) => {
    const own = F.ents[e.owner], oc = own && S.chars.find((x) => x.id === own.cid);
    const t = (own && own.alive && oc && E.chalRespect(S, oc) && F.chals && F.chals.some((c) => c.ok) ? pickFoes(S, F, own, null, 1)[0] : null) || alive(F, "m").sort((a, b) => a.hp - b.hp)[0]; if (!t) return; // les invocations suivent les challenges de leur maître
    F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e) });
    const d = dealDamage(F, e, t, e.dmg * rf(0.85, 1.15) * (E.dofpSummon && own ? E.dofpSummon(F, own) : 1), e.el); // 1.0.16 : Domakuro
    flog(F, `${e.name} (invocation) → ${t.name} : −${d}`, "c");
    if (!t.alive) flog(F, `${t.name} est vaincu.`, "ko");
  };

  /* tour de monstre : vrais sorts DOFUS simplifiés + mécaniques de boss */
  /* cible d'un monstre : l'Arbre du Sadida attire les coups, les tourelles du Steamer sont délaissées */
  /* 3.3.0 : la première ligne reçoit 3 coups sur 4 (le Rôdeur inverse, le Bondisseur ignore les rangées, le Champion Traqueur vise le plus faible) ;
     les invocations se tiennent en première ligne */
  const rowOf = (t) => (t.summon ? "f" : t.row || "f");
  const pickHero = (F, targets, e) => {
    if (targets.some((t) => t.gold > 0) && targets.some((t) => !(t.gold > 0))) targets = targets.filter((t) => !(t.gold > 0));
    const tree = targets.find((t) => t.tree && t.summon); if (tree && rnd() < E.PSV.sadiAttire) return tree;
    if (e && e.champ === "traqueur") { const hs = targets.filter((t) => !t.summon); if (hs.length) return hs.sort((a, b) => a.hp - b.hp)[0]; }
    let pool = targets;
    const fr = targets.filter((t) => rowOf(t) === "f"), bk = targets.filter((t) => rowOf(t) === "b");
    const tacle = () => { const p = Math.min(E.TACT.tac[1], fr.reduce((a, t) => a + (t.st ? (t.st.tac || 0) * E.TACT.tac[0] : 0), 0)); if (p > 0 && rnd() * 100 < p) { tlog("tac"); return true; } return false; };
    const bond = e && e.role === "bond" && !(e.slowR === F.round);
    if (!bond) {
      if (fr.length && bk.length) { const pf = e && e.role === "rodeur" ? 1 - E.FRONT_P : E.FRONT_P; pool = rnd() < pf ? fr : bk; if (pool === bk && e && e.role === "rodeur" && tacle()) pool = fr; }
    } else if (fr.length && bk.length) { const w0 = targets[Math.floor(rnd() * targets.length)]; if (rowOf(w0) === "b" && tacle()) pool = fr; }
    const w = pool.map((t) => (t.turret ? 0.3 : 1)); let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; } return pool[pool.length - 1];
  };
  const tlog = (k) => { if (E.tactLog) E.tactLog[k] = (E.tactLog[k] || 0) + 1; };
  const dodged = (F, t, e) => { if (!t || t.summon || !t.st || (F.idol && F.idol.noDodge)) return false;
    // le Tacle des monstres de haut niveau (même valeur que leur Esquive) réduit la Fuite et l'esquive des héros
    const p = (rowOf(t) === "b" ? E.tact(t.st, "fui") : Math.min(E.TACT.pm[1], (t.st.pm || 0) * E.TACT.pm[0])) * (1 - (e ? E.monDodge(e) : 0) / 100);
    if (p > 0 && rnd() * 100 < p) { tlog(rowOf(t) === "b" ? "fui" : "pm"); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: "Esquive" }); if (E.legDodged) E.legDodged(F, t); return true; } return false; };
  const resists = (h, k) => { const p = E.tact(h.st, k); if (p > 0 && rnd() * 100 < p) { tlog(k); return true; } return false; };
  const monCrit = (e, v) => (e.crit && rnd() * 100 < e.crit ? v * 1.25 + (e.dcri || 0) : v); // idoles Hadibel et Tigel
  const monsterTurn = (S, F, e) => {
    if (E.midTurn) E.midTurn(F, e); // identité des sorts des monstres : signature de boss
    if (E.srTrig && F.srTraps && F.srTraps.length) { E.srTrig(S, F, e); if (!e.alive) return; } // Sram (sram.js) : un piège posé se déclenche
    const skip = e.mech ? bossMech(S, F, e) : false;
    if (e.role) roleTurn(S, F, e);
    if (skip || !e.alive || !alive(F, "c").length) return;
    let attacks = e.attacks + (e.extraAtk || 0); if (e.extraAtk) flog(F, `${e.name} est pris de frénésie et frappe deux fois !`, "m"); e.extraAtk = 0;
    if (e.paLoss >= 2) { attacks = Math.max(0, attacks - 1); flog(F, `${e.name} manque de PA et frappe moins.`, "dim"); }
    const lowPa = (e.paLoss === 1 ? 0.85 : 1) * (1 - (e.weakNext || 0) / 100); e.paLoss = 0; e.weakNext = 0;
    if (e.charging === "fire") { e.charging = false; const heroes = alive(F, "c"); flog(F, `${e.name} déclenche son attaque dévastatrice !`, "m");
      F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e) }); heroes.forEach((t) => { const d = dealDamage(F, e, t, e.dmg * (F.wboss && E.WB_CHARGE ? E.WB_CHARGE : 2.2) * rf(0.9, 1.1), e.el === "n" ? null : e.el); if (!t.alive) flog(F, `${t.name} est à terre (−${d}).`, "ko"); }); return; }
    const mdmg = (1 + buffSum(e, "mdmg") / 100) * (alive(F, "m").some((m) => m.elite && m !== e) ? 1.15 : 1) * (alive(F, "m").some((m) => (m.champ === "meneur" || m.role === "chef") && m !== e) ? 1.1 : 1) * (e.enrageMod && e.hp < e.hpMax * 0.5 ? 1.25 : 1);
    const dmgSpells = (e.sp || []).filter((s) => s.fx.some((f) => f.k === "dmg" || f.k === "drain" || f.k === "dot"));
    const refAvg = dmgSpells.length ? dmgSpells.reduce((a, s) => a + avgDmg(s), 0) / dmgSpells.length : 1;
    for (let k = 0; k < attacks; k++) {
      const targets = alive(F, "c"); if (!targets.length || !e.alive) return;
      let sp = null;
      if (e.sp && rnd() < 0.85) {
        const allyHurt = alive(F, "m").some((m) => m.hp / m.hpMax < 0.6);
        const ok = e.sp.filter((s) => !(e.cds[s.n] > 0) && (!s.fx.some((f) => f.k === "heal" || f.k === "healpct") || allyHurt));
        if (ok.length) sp = pick(ok);
      }
      if (E.midPick && e.midGo) sp = E.midPick(F, e, sp);
      F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e), ...(sp ? { msp: sp.n } : {}) });
      if (!sp) { const t = pickHero(F, targets, e); if (dodged(F, t, e)) { flog(F, `${t.name} esquive l'attaque de ${e.name}.`, "dim"); continue; } const d = dealDamage(F, e, t, monCrit(e, e.dmg * mdmg * lowPa * rf(0.85, 1.15)), e.el === "n" ? null : e.el); if (e.vamp) doHeal(e, d * e.vamp, F); flog(F, `${e.name} · ${e.atk} → ${t.name} : −${d}`, "m"); if (!t.alive) flog(F, `${t.name} est à terre.`, "ko"); continue; }
      if (sp.cd) e.cds[sp.n] = sp.cd + 1;
      const parts = []; let didDmg = false;
      for (const f of sp.fx) {
        if (f.k === "dmg" || f.k === "drain" || f.k === "dot") {
          if (didDmg) continue; didDmg = true; // une seule ligne de dégâts par sort (les autres sont des variantes)
          const ratio = refAvg ? clamp(avgDmg({ fx: [f] }) / refAvg, 0.5, 1.8) : 1;
          let ts = f.n > 1 ? targets.slice().sort(() => rnd() - 0.5).slice(0, Math.min(f.n, targets.length)) : [pickHero(F, targets, e)];
          if (E.midTargets) ts = E.midTargets(F, e, sp, f, ts, targets);
          ts = ts.filter((t) => !dodged(F, t, e));
          const base = monCrit(e, e.dmg * mdmg * lowPa * ratio * (f.n > 1 ? 0.7 : 1) * rf(0.85, 1.15));
          const el = f.el && f.el !== "best" ? f.el : e.el === "n" ? null : e.el;
          const hits = [];
          ts.forEach((t) => { if (f.k === "dot") { const v = base * 0.5 * (E.midMul ? E.midMul(F, e, sp, t) : 1); t.dots.push({ v, turns: f.t || 2, el, src: e.name }); if (E.midHit) E.midHit(F, e, sp, t, v, el); } else { const d = dealDamage(F, e, t, base * (E.midMul ? E.midMul(F, e, sp, t) : 1), el); if (E.midHit) E.midHit(F, e, sp, t, d, el); hits.push(`${t.name} : −${d}`); if (f.k === "drain") doHeal(e, d * (e.cls === "sacri" ? psv(e).sacriDrain : 0.5), F); if (e.vamp) doHeal(e, d * e.vamp, F); } });
          F.midB = base; F.midEl = el; F.midTs = ts;
          parts.push(f.k === "dot" ? `poison sur ${ts.map((t) => t.name).join(", ")}` : hits.join(", "));
        } else if (f.k === "heal" || f.k === "healpct") {
          const t = alive(F, "m").sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (!t) continue; const h = doHeal(t, f.k === "healpct" ? hpR(t) * Math.min(25, f.v) / 100 : e.dmg * 1.4, F); if (h) parts.push(`soigne ${t.name} (+${h})`);
        } else if (f.k === "shield") { e.shield = Math.max(e.shield, Math.round(hpR(e) * Math.min(20, f.pct) / 100)); parts.push("bouclier");
        } else if (f.k === "buff") { e.buffs.push({ mdmg: 20, turns: 2 }); parts.push("se renforce");
        } else if (f.k === "apdrain") { const t = pick(targets); if (resists(t, "epa")) continue; t.paLoss = Math.min(2, (t.paLoss || 0) + 1); parts.push(`−1 PA à ${t.name}`);
        } else if (f.k === "weaken") { const t = pick(targets); t.debuffs.push({ weak: 15, turns: 1 }); parts.push(`affaiblit ${t.name}`);
        } else if (f.k === "vuln") { const t = pick(targets); t.debuffs.push({ vuln: 10, turns: 2 }); parts.push(`rend ${t.name} vulnérable`); }
      }
      if (E.midPost) { E.midPost(F, e, sp, didDmg ? F.midB : 0, F.midEl, didDmg ? F.midTs : []); F.midB = 0; }
      flog(F, `${e.name} · ${sp.n}${parts.length ? " → " + parts.join(", ") : ""}`, "m");
      alive(F, "c").length; F.ents.filter((t) => t.side === "c" && !t.alive && !t.koLogged).forEach((t) => { t.koLogged = true; flog(F, `${t.name} est à terre.`, "ko"); });
    }
  };
  const avgDmg = (s) => { const f = s.fx.find((x) => x.k === "dmg" || x.k === "drain" || x.k === "dot"); return f ? (f.min + f.max) / 2 * (f.k === "dot" ? 0.8 : 1) : 0; };
  /* monstre appelé par une mécanique : serviteur (donne du butin) ou objet de mécanique (totem, bombe, invocation : sans butin) */
  const spawnMon = (F, key, lvl, o = {}) => {
    const m = monsterEntity(key, Math.max(1, lvl)); m.minion = true; m.role = null;
    if (o.hp) m.hpMax = m.hp = Math.max(1, Math.round(o.hp)); if (o.dmg !== undefined) m.dmg = o.dmg;
    ["name", "fake", "totem", "bomb", "fuse", "linked", "attacks", "isDouble", "mech", "mturn"].forEach((k) => { if (o[k] !== undefined) m[k] = o[k]; });
    if (o.attacks === 0) m.sp = null;
    F.ents.push(m); F.order.push(F.ents.indexOf(m)); F.fx.push({ seq: F.seq, k: "summon", t: F.ents.indexOf(m) });
    return m;
  };
  const mobKey = (F, e) => { const dg = F.dungeonId && DUNGEONS[F.dungeonId]; return dg && dg.bossMobs && dg.bossMobs.length ? pick(dg.bossMobs) : e.base || e.key; };
  const heroesOf = (F) => alive(F, "c").filter((h) => !h.summon);
  /* rôles des monstres : soin, bouclier, invocation */
  const roleTurn = (S, F, e) => {
    e.rt = (e.rt || 0) + 1;
    if (e.role === "soigneur" && e.rt % 2 === 0) { const t = alive(F, "m").filter((m) => m.hp < m.hpMax * 0.9 && !m.fake).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (t) { const h = doHeal(t, hpR(t) * 0.1, F); if (h) flog(F, `${e.name} soigne ${t.name} (+${h}).`, "m"); } }
    if (e.role === "protect" && e.rt % 3 === 1) { alive(F, "m").forEach((m) => { m.shield = Math.max(m.shield || 0, Math.round(hpR(m) * 0.1)); }); flog(F, `${e.name} protège ses alliés d'un bouclier.`, "m"); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(e), txt: "Protection" }); }
    if (e.role === "invoc" && e.rt % 3 === 0 && (e.invN || 0) < 3 && alive(F, "m").length < 10) { e.invN = (e.invN || 0) + 1; const m = spawnMon(F, e.base || e.key, e.lvl - 5, { fake: true, name: `${e.name} (invoqué)` }); m.hpMax = m.hp = Math.round(m.hpMax * 0.35); m.dmg *= 0.5; flog(F, `${e.name} invoque un allié !`, "m"); }
  };
  const ELS4 = ["t", "f", "e", "a"];
  const bossMech = (S, F, e) => {
    e.mturn = (e.mturn || 0) + 1; const M = e.mech; const t = e.mturn; const has = (k) => M.includes(k); const ei = F.ents.indexOf(e); let skip = false;
    const say = (txt, tag) => { flog(F, txt, "m"); if (tag) F.fx.push({ seq: F.seq, k: "buff", t: ei, txt: tag }); };
    const hitAll = (list, mult) => list.forEach((h) => { const d = dealDamage(F, e, h, e.dmg * mult * rf(0.9, 1.1), e.el === "n" ? null : e.el); if (!h.alive) flog(F, `${h.name} est à terre (−${d}).`, "ko"); });
    const victim = (list) => (list.length ? pick(list) : null);
    if (e.phase2 && !e.p2done && e.hp < e.hpMax * 0.3) { e.p2done = true; doHeal(e, hpR(e) * 0.2, F); flog(F, `${e.name} entre dans sa seconde phase : il se régénère et appelle des renforts !`, "m"); F.fx.push({ seq: F.seq, k: "phase", t: ei });
      if (F.dungeonId) for (let i = 0; i < 2; i++) spawnMon(F, mobKey(F, e), e.lvl - 3); }
    if (has("enrage") && !e.enraged && e.hp < e.hpMax * 0.5) { e.enraged = true; e.dmg *= 1.4; e.debuffs.push({ vuln: 15, turns: 999 }); say(`${e.name} entre dans une rage folle !`, "Rage !"); }
    if (has("shield") && e.shieldPhase === 1 && e.hp < e.hpMax * 0.5) { e.shieldPhase = 2; e.shield += Math.round(hpR(e) * 0.2); say(`${e.name} se couvre d'une carapace !`, "Carapace"); }
    if (has("summon")) {
      const minions = alive(F, "m").filter((m) => m.minion && !m.fake);
      if (minions.length) { const h = doHeal(e, hpR(e) * 0.04, F); if (h) flog(F, `${e.name} est soigné par ses serviteurs (+${h}).`, "m"); }
      if (t % 3 === 0 && minions.length < 3 && F.dungeonId) { const m = spawnMon(F, mobKey(F, e), e.lvl - 3); flog(F, `${e.name} appelle ${m.name} en renfort !`, "m"); }
    }
    if (has("abordage") && t % 4 === 0 && alive(F, "m").length < 9) { for (let i = 0; i < 2; i++) spawnMon(F, mobKey(F, e), e.lvl - 3); say(`${e.name} crie « À l'abordage ! » : deux pirates arrivent.`, "Abordage"); }
    if (has("weakspot")) { e.weakOpen = t % 3 === 0; if (e.weakOpen) say(`${e.name} expose son point faible !`, "Point faible"); }
    if (has("festin")) e.vamp = Math.max(e.vamp || 0, 0.3);
    if (has("reflet")) { e.reflect = t % 4 === 0; if (e.reflect) say(`${e.name} se couvre d'un reflet : il renvoie une partie des dégâts.`, "Reflet"); }
    if (has("miasmes")) { const p = Math.min(0.05, 0.01 + 0.005 * t); heroesOf(F).forEach((h) => dealDamage(F, null, h, h.hpMax * p, null)); flog(F, `Les miasmes de ${e.name} rongent l'équipe (−${Math.round(p * 100)} % des PV).`, "m"); }
    if ((has("devoreur") || has("appetit") || has("banquet")) && t % 3 === 0 && (has("banquet") || e.hp < e.hpMax * 0.9)) {
      const m = alive(F, "m").find((x) => x.minion && !x.totem && !x.bomb && !x.linked);
      if (m) { m.hp = 0; m.alive = false; const h = doHeal(e, hpR(e) * 0.15, F); if (has("banquet")) e.dmg *= 1.1; say(`${e.name} dévore ${m.name} (+${h} PV${has("banquet") ? ", +10 % de dégâts" : ""}) !`, "Festin"); }
    }
    if (has("brise") && t % 3 === 0 && alive(F, "c").some((h) => h.shield > 0)) { alive(F, "c").forEach((h) => (h.shield = 0)); say(`${e.name} brise les boucliers de l'équipe !`, "Brise-garde"); }
    if (has("aspiration") && t % 3 === 0) { const sum = alive(F, "c").reduce((a, h) => a + (h.shield || 0), 0); if (sum > 0) { alive(F, "c").forEach((h) => (h.shield = 0)); const h = doHeal(e, sum, F); say(`${e.name} aspire les boucliers de l'équipe (+${h} PV) !`, "Aspiration"); } }
    if (has("larcin") && t % 3 === 0) { const v = heroesOf(F).filter((h) => h.shield > 0 || h.buffs.length).sort((a, b) => (b.shield || 0) - (a.shield || 0))[0];
      if (v) { e.shield = (e.shield || 0) + (v.shield || 0); v.shield = 0; v.buffs = []; say(`${e.name} détrousse ${v.name} : bouclier et bonus volés !`, "Larcin"); } }
    if (has("putrefaction") && t % 4 === 0) { F.rot = F.round + 2; say(`${e.name} répand la putréfaction : soins de l'équipe −50 % pendant 2 tours.`, "Putréfaction"); }
    if ((has("peau") || has("humeurs")) && t % 3 === 1) { e.skinEl = pick(ELS4.filter((x) => x !== e.skinEl)); say(`${e.name} change de peau : il résiste à l'élément ${ELEMENTS[e.skinEl].name}.`, ELEMENTS[e.skinEl].name); }
    if (has("fournaise") && t % 2 === 1) { e.openEl = pick(ELS4.filter((x) => x !== e.openEl)); say(`${e.name} ne craint plus que l'élément ${ELEMENTS[e.openEl].name}.`, ELEMENTS[e.openEl].name); }
    if (has("condamne")) {
      if (e.doom && e.doom.t <= t) { const h = F.ents[e.doom.i]; e.doom = null;
        if (h && h.alive) { if (h.shield > 0) { h.shield = 0; say(`${e.name} frappe ${h.name}, mais son bouclier encaisse la condamnation !`); } else { const d = dealDamage(F, e, h, e.dmg * (heroesOf(F).length > 1 ? 3 : 1.5) * rf(0.9, 1.1), e.el === "n" ? null : e.el); say(`${e.name} exécute la condamnation sur ${h.name} (−${d}) !`); } } }
      else if (!e.doom && t % 4 === 1) { const h = victim(heroesOf(F)); if (h) { e.doom = { i: F.ents.indexOf(h), t: t + 2 }; say(`${e.name} condamne ${h.name} : un bouclier sur lui avant 2 tours !`, "Condamnation"); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(h), txt: "Condamné" }); } }
    }
    if (has("mutisme") && t % 4 === 2 && heroesOf(F).length > 1) { const h = victim(heroesOf(F)); if (h && !resists(h, "epa")) { h.silence = 3; say(`${e.name} rend ${h.name} muet : sorts à recharge interdits pendant 2 tours.`, "Mutisme"); } }
    if (has("racines") && t % 3 === 0) { const back = heroesOf(F).filter((h) => rowOf(h) === "b"); const h = victim(back.length ? back : heroesOf(F)); if (h && !resists(h, "epm")) { h.rooted = 3; say(`${e.name} enracine ${h.name} : il ne peut plus soigner pendant 2 tours.`, "Racines"); } }
    if (has("terreur") && t % 4 === 3) { const fr = heroesOf(F).filter((h) => rowOf(h) === "f"); if (fr.length > 1) { const h = pick(fr); if (resists(h, "epm")) say(`${h.name} résiste à la Terreur.`); else { h.fearRow = "f"; h.row = "b"; h.fearT = 3; say(`${e.name} terrifie ${h.name}, qui recule à l'arrière !`, "Terreur"); } } }
    if (has("tapis") && t % 3 === 0) { heroesOf(F).forEach((h) => { h.row = rowOf(h) === "f" ? "b" : "f"; if (h.fearT) h.fearRow = h.fearRow === "f" ? "b" : "f"; }); say(`Le tapis roulant de ${e.name} échange la première ligne et l'arrière !`, "Tapis roulant"); }
    if ((has("petrif") || has("glace")) && t % 3 === 0 && heroesOf(F).length > 1) { const h = pick(heroesOf(F).filter((x) => !(x.stun > 0))); if (h && !resists(h, "epa")) { h.stun = 1; say(has("glace") ? `${e.name} gèle ${h.name}, qui passera son tour.` : `Le regard de ${e.name} pétrifie ${h.name}, qui passera son tour.`, has("glace") ? "Glace" : "Pétrification"); } }
    if (has("dore") && t % 4 === 2 && heroesOf(F).length > 1) { const h = pick(heroesOf(F)); h.gold = 2; say(`${e.name} change ${h.name} en or pour 2 tours.`, "Toucher doré"); }
    if (has("distorsion") && t % 4 === 0) { heroesOf(F).forEach((h) => { for (const k in h.cd) if (h.cd[k] > 0) h.cd[k]++; if (!resists(h, "epa")) h.paLoss = Math.max(h.paLoss || 0, 1); }); say(`${e.name} distord le temps : recharges rallongées et −1 PA pour l'équipe.`, "Distorsion"); }
    if (has("frenesie") && t % 4 === 0) e.extraAtk = 1;
    if (has("totems") && (t === 1 || (t % 6 === 0 && !alive(F, "m").some((m) => m.totem)))) { for (let i = 0; i < 2; i++) spawnMon(F, mobKey(F, e), e.lvl, { fake: true, totem: true, name: "Totem", hp: hpR(e) * 0.06, attacks: 0, dmg: 0 }); say(`${e.name} dresse deux totems : il est invulnérable tant qu'ils tiennent debout !`, "Totems"); }
    if (has("liens") && !e.linkDone) { e.linkDone = true; spawnMon(F, mobKey(F, e), e.lvl, { fake: true, linked: true, name: "Âme liée", hp: hpR(e) * 0.3 }); say(`${e.name} lie son âme à un serviteur : les dégâts sont partagés.`, "Âmes liées"); }
    if (has("inventions")) {
      alive(F, "m").filter((m) => m.bomb).forEach((b) => { b.fuse--; if (b.fuse <= 0) { b.hp = 0; b.alive = false; flog(F, `La bombe de ${e.name} explose !`, "m"); hitAll(heroesOf(F), 2.5); } else flog(F, `Une bombe va exploser dans ${b.fuse} tour${b.fuse > 1 ? "s" : ""}.`, "m"); });
      if (t % 4 === 1) { spawnMon(F, mobKey(F, e), e.lvl, { fake: true, bomb: true, fuse: 3, name: "Bombe", hp: hpR(e) * 0.06, attacks: 0, dmg: 0 }); say(`${e.name} pose une bombe : détruisez-la avant 3 tours !`, "Bombe"); }
    }
    if (has("double") && !e.isDouble && !e.doubled && e.hp < e.hpMax * 0.5) { e.doubled = true; const m = spawnMon(F, e.key, e.lvl, { fake: true, isDouble: true, name: `Double de ${e.name}`, hp: hpR(e) * 0.4, dmg: e.dmg * 0.7, mech: M.filter((x) => x !== "double"), mturn: 0 }); m.attacks = e.attacks; say(`${e.name} se dédouble !`, "Dédoublement"); }
    if ((has("rebours") || has("horloge")) && !e.isDouble) {
      if (F.round >= 20) { heroesOf(F).concat(alive(F, "c").filter((h) => h.summon)).forEach((h) => { h.hp = 0; h.alive = false; killed(F, h); }); say(`${e.name} : le temps est écoulé, l'équipe est anéantie !`, "Temps écoulé"); return true; }
      if (F.round >= 15) say(`${e.name} : plus que ${20 - F.round} tour${20 - F.round > 1 ? "s" : ""} avant l'anéantissement !`);
    }
    if (has("seisme") && t % 4 === 0) { const fr = alive(F, "c").filter((h) => rowOf(h) === "f"); if (fr.length) { say(`${e.name} fait trembler le sol sous la première ligne !`, "Séisme"); F.fx.push({ seq: F.seq, k: "cast", s: ei }); hitAll(fr, 1.6); skip = true; } }
    if (has("maree") && t % 3 === 0) { const bk = heroesOf(F).filter((h) => rowOf(h) === "b"); if (bk.length) { say(`La marée de ${e.name} submerge l'arrière !`, "Marée"); F.fx.push({ seq: F.seq, k: "cast", s: ei }); hitAll(bk, 1.4); skip = true; } }
    if (has("taureau") && t % 3 === 0 && !skip) { const h = heroesOf(F).sort((a, b) => a.hpMax - b.hpMax)[0]; if (h) { F.fx.push({ seq: F.seq, k: "cast", s: ei }); const d = dealDamage(F, e, h, e.dmg * 2 * rf(0.9, 1.1), e.el === "n" ? null : e.el); say(`${e.name} charge ${h.name} tête baissée (−${d}) !`, "Charge"); skip = true; } }
    if (has("charge") && t % 3 === 2 && !e.charging) { e.charging = "ready"; say(`${e.name} prépare une attaque dévastatrice… (protégez l'équipe !)`, "⚠ Charge"); }
    else if (e.charging === "ready") e.charging = "fire";
    return skip;
  };

  const startOfTurn = (S, F, e) => {
    if (E.idTurn && (e.idn || e.idRegen || F.idGly) && !E.idTurn(F, e)) { flog(F, `${e.name} est vaincu.`, "ko"); return false; } // identité : retardement, bombes, glyphes
    e.dots = e.dots.filter((d) => {
      F.dotSrc = e.side === "m" && d.src ? F.ents.find((x) => x.side === "c" && !x.summon && x.name === d.src) || null : null;
      const v = dealDamage(F, null, e, d.v, d.el); F.dotSrc = null;
      flog(F, `${e.name} subit −${v} (poison)`, "dim");
      d.turns--; return d.turns > 0 && e.alive;
    });
    if (!e.alive) { flog(F, `${e.name} est vaincu.`, "ko"); return false; }
    if (E.dofusTurn) E.dofusTurn(S, F, e); // 0.1.13 : Dokoko
    if (E.legTurn && !E.legTurn(S, F, e)) return false; // 0.1.48 : passifs des légendaires (et ennemis étourdis)
    if (F.idol) { // 0.1.10 : idoles Dokoko, Jiva, Abdinde, Kori
      if (e.side === "c" && !e.summon && F.idol.hpLoss) { const v = dealDamage(F, null, e, e.hpMax * F.idol.hpLoss / 100, null); flog(F, `${e.name} perd ${v} PV (idole).`, "dim"); if (!e.alive) { flog(F, `${e.name} est vaincu.`, "ko"); return false; } }
      if (e.side === "m") { if (F.idol.monRegen && e.hp < e.hpMax) { const g = doHeal(e, e.hpMax * F.idol.monRegen / 100, F); if (g) flog(F, `${e.name} récupère ${g} PV (idole).`, "dim"); } if (F.idol.shieldRegen) e.shield = (e.shield || 0) + Math.round(e.hpMax * F.idol.shieldRegen / 100); }
    }
    e.buffs = e.buffs.filter((b) => --b.turns >= 0);
    e.debuffs = (e.debuffs || []).filter((b) => --b.turns >= 0);
    if (e.mark > 0) e.mark--;
    if (e.cd) for (const k in e.cd) if (e.cd[k] > 0) e.cd[k]--;
    if (e.cds) for (const k in e.cds) if (e.cds[k] > 0) e.cds[k]--;
    if (e.side === "c" && e.regen) doHeal(e, e.hpMax * e.regen / 100, F);
    if (e.side === "c") { if (e.silence > 0) e.silence--; if (e.rooted > 0) e.rooted--; if (e.fearT > 0 && --e.fearT === 0) { e.row = e.fearRow || "f"; flog(F, `${e.name} reprend courage et revient en première ligne.`, "dim"); } }
    return true;
  };

  /* Bonus de combat liés à l'Esprit Libre */
  const applyFightBonuses = (S, F) => {
    const fs = E.freeSpirit(S);
    F.feca = E.teamHas(S, "feca");
    if (E.teamHas(S, "eca")) { const r = rnd(); F.roulette = r < 0.4 ? "pile" : r < 0.8 ? "face" : r < 0.9 ? "jackpot" : "perdu";
      flog(F, `Roulette de l'Ecaflip : ${F.roulette === "pile" ? "Pile ! +20 % de dégâts pour l'équipe" : F.roulette === "face" ? "Face ! +15 % de soins et de boucliers" : F.roulette === "jackpot" ? "JACKPOT ! Butin ×2 sur ce combat" : "Perdu… −5 % de dégâts pour l'équipe"}.`, "buff"); }
    F.expertRaces = new Set();
    for (const r in RACE_MONS) if (RACE_MONS[r].some((k) => E.huntTier(S, k) >= 2)) F.expertRaces.add(+r);
    const heroes0 = F.ents.filter((e) => e.side === "c" && !e.summon);
    const meneur = heroes0.reduce((a, e) => a + ((e.ev || {}).meneur || 0), 0); // 0.1.12 : Éveil Meneur, +1 % pour toute l'équipe par rang
    const ecaEv = Math.max(0, ...heroes0.filter((e) => e.cls === "eca").map((e) => e.evc || 0)); // Éveil de classe Ecaflip : Pile +25/+30 %
    heroes0.forEach((e) => {
      if (e.cls === "zobal") e.mask = "atk";
      e.dmgBonus = fs / 2 + E.bonus(S, "dmg") + E.synergy(S) + meneur + (F.roulette === "pile" ? 20 + 5 * ecaEv : F.roulette === "perdu" ? -5 : 0);
      e.resBonus = 0; e.regen = 0;
    });
    if (F.exp && E.expBonuses) E.expBonuses(S, F); // 0.1.24 : reliques et bénédictions de l'expédition
  };

  /* Un pas de combat = le tour d'une entité ; E.roundHook(F) : début de chaque tour, avant le premier à jouer (L'Ascension, 1.2.9.1) */
  E.roundHook = null;
  E.step = (S) => {
    let F = S.fight;
    if (!F || F.over) return;
    if (F.pvp) return koliStep(S, F);
    if (F.dmgInit !== true) { applyFightBonuses(S, F); F.dmgInit = true; }
    if (F.await) {
      if (E.manualOn(S) && F.dur - F.await.t <= E.MANUAL_TIMEOUT) return;
      const A = F.await; F.await = null; const e = F.ents[A.ei];
      if (e && e.alive) { F.seq++; F.actor = e; if (!A.n) flog(F, `${e.name} joue en automatique.`, "dim"); charTurn(S, F, e, A.pa); }
      return checkEnd(S);
    }
    F.seq++; if (F.fx.length > 80) F.fx.splice(0, F.fx.length - 80);
    if (F.oi >= F.order.length) { F.round++; newRound(F); if (E.roundHook) E.roundHook(F); if (F.round > 60) return endFight(S, false, "Le combat s'éternise : retraite.");
      const lim = F.bossIdx !== undefined ? E.STASIS_TL.boss : E.STASIS_TL.room; if (F.stasis >= 9 && F.round > lim) return endFight(S, false, `Stasis 9 : le temps est écoulé (${lim} tours maximum dans cette salle).`); }
    const e = F.ents[F.order[F.oi++]];
    if (!e || !e.alive) return E.step(S);
    F.actor = e;
    if (!startOfTurn(S, F, e)) return checkEnd(S);
    if (e.side === "c") { if (e.summon) summonTurn(S, F, e); else charTurn(S, F, e); } else monsterTurn(S, F, e);
    checkEnd(S);
  };
  /* ---------------- 0.1.44 : Kolizéum, combat d'équipes ----------------
     Les deux équipes sont des héros. Le moteur joue toujours « du côté c » : avant le tour d'un héros de l'équipe 1,
     on retourne les camps (c ↔ m), puis on les remet. Pas de bonus de compte (Esprit Libre, synergie, consommables) :
     seuls comptent les héros eux-mêmes. Érosion à partir du tour E.KOLI.ero (soins et PV maximum −E.KOLI.eroStep % par tour) ;
     au tour E.KOLI.maxRound, l'équipe qui a gardé la plus grande part de ses PV gagne. */
  E.KOLI = { size: 3, ero: 10, eroStep: 10, eroMax: 90, maxRound: 20 };
  /* puissance par classe au Kolizéum (dégâts et invocations), réglée par simulation (tools/koli_sim.js) aux niveaux E.KOLI_LVLS */
  E.KOLI_LVLS = [20, 50, 100, 150, 200];
  E.KOLI_POW = {"iop":[1.29,1.49,1.25,0.94,1.82],"cra":[1.28,1.87,1.36,1.23,1.62],"eni":[1.71,1.29,1.36,1.23,0.95],"feca":[0.69,1.18,1.81,1.67,2.3],"osa":[0.26,0.37,0.63,0.93,0.99],"enu":[0.89,1.45,1.4,1.26,1.28],"sram":[1.04,1.13,0.83,0.81,1.08],"xelor":[1.07,0.79,0.4,0.72,0.34],"eca":[2.5,1.68,1.54,1.44,1.17],"sadi":[1.17,1.15,0.8,0.88,0.85],"sacri":[1.47,1.65,1.73,1.48,1.67],"panda":[2.02,1.13,1.05,1,1.6],"roub":[0.46,0.52,0.49,0.42,0.25],"zobal":[1.15,1.04,1.65,1.97,1.81],"steam":[0.71,0.73,0.41,0.89,1.1],"elio":[1.35,1.56,1.5,1.2,1.16],"hupper":[1.93,1.35,0.97,1.14,0.48],"ougi":[1.84,1.57,2.05,1.05,1.62],"forge":[0.79,0.41,0.75,0.84,1.14]};
  E.koliPow = (cls, lvl) => { const t = E.KOLI_POW[cls]; if (!t) return 1; const L = E.KOLI_LVLS; if (lvl <= L[0]) return t[0]; if (lvl >= L[L.length - 1]) return t[t.length - 1];
    let i = 0; while (lvl > L[i + 1]) i++; return t[i] + (t[i + 1] - t[i]) * (lvl - L[i]) / (L[i + 1] - L[i]); };
  const koliFlip = (F) => F.ents.forEach((x) => { x.side = x.side === "c" ? "m" : "c"; });
  const koliHp = (F, tm) => { const hs = F.ents.filter((x) => x.tm === tm && !x.summon); return hs.reduce((a, x) => a + (x.alive ? x.hp : 0), 0) / Math.max(1, hs.reduce((a, x) => a + x.hpBase, 0)); };
  const koliEnd = (S, F, tm, why) => { F.over = true; F.winner = tm; F.result = tm === (F.me || 0) ? "win" : "lose"; /* F.me : l'équipe du joueur qui regarde (1 pour une défense) */ if (why) flog(F, why, "dim"); };
  const koliCheck = (S, F) => {
    const up = (tm) => F.ents.some((x) => x.alive && x.tm === tm && !x.summon);
    if (!up(1)) koliEnd(S, F, 0); else if (!up(0)) koliEnd(S, F, 1);
  };
  const koliErode = (F) => {
    const K = E.KOLI; F.ero = Math.min(K.eroMax, Math.max(0, F.round - K.ero + 1) * K.eroStep); if (!F.ero) return;
    F.ents.forEach((x) => { if (!x.alive || x.summon) return; x.hpMax = Math.max(1, Math.round(x.hpBase * (1 - F.ero / 100))); if (x.hp > x.hpMax) x.hp = x.hpMax; });
    flog(F, `Érosion : soins et PV maximum −${F.ero} %.`, "dim");
  };
  const koliStep = (S, F) => {
    F.seq++; if (F.fx.length > 80) F.fx.splice(0, F.fx.length - 80);
    for (let guard = 0; guard < 200; guard++) {
      if (F.oi >= F.order.length) {
        F.round++;
        if (F.round > E.KOLI.maxRound) { const a = koliHp(F, 0), b = koliHp(F, 1); return koliEnd(S, F, a >= b ? 0 : 1, `Fin du temps : ${Math.round(a * 100)} % de PV contre ${Math.round(b * 100)} %.`); }
        newRound(F); koliErode(F);
      }
      const e = F.ents[F.order[F.oi++]];
      if (!e || !e.alive) continue;
      const flip = e.tm === 1; if (flip) koliFlip(F);
      try {
        F.glyph = (F.glyphs || [])[e.tm] || null;
        if (E.srTrig && F.srTraps && F.srTraps.length) E.srTrig(S, F, e); // Sram : un piège adverse explose sous lui (sram.js)
        if (e.alive && startOfTurn(S, F, e)) { if (e.summon) summonTurn(S, F, e); else charTurn(S, F, e); }
        if (e.cls === "feca" && !e.summon) F.glyphs[e.tm] = F.glyph;
      } finally { if (flip) koliFlip(F); }
      return koliCheck(S, F);
    }
  };
  /* Une équipe d'arène (photo envoyée au serveur) : ce qu'il faut pour rejouer le combat, sans les objets.
     st : caractéristiques du héros (équipement, familier, monture, panoplies, parchemins). */
  E.koliSnap = (S, ids) => ids.map((id) => S.chars.find((c) => c.id === id)).filter(Boolean).slice(0, E.KOLI.size).map((c) => ({
    n: String(c.name || "").slice(0, 20), cls: c.cls, sex: c.sex || (CLASSES[c.cls] || {}).sex || "m", head: c.head || 0, lvl: c.lvl || 1, ren: c.ren || 0,
    sp: (c.spells || []).map((x) => ({ id: x.id, cond: x.cond || null, tgt: x.tgt || "low" })), am: c.atkMode === "ordre" ? 1 : 0, st: E.charStats(S, c), ev: c.eveils || {}, evc: E.eveil(c, "classe") + E.mtPass(S, c), lg: E.legOf ? E.legOf(S, c) : null,
    mt: E.mtFx ? E.mtFx(S, c) : null, bt: E.btFx ? E.btFx(S) : null, // 2.0 : Maîtrise
    dp: E.dofpOf ? E.dofpOf(S, c) : null, dpB: E.dofpReso ? E.dofpReso(S, c) : false, // 1.0.16 : passifs des Dofus
    wp: (() => { const it = c.equip && c.equip.arme && S.items[c.equip.arme]; return it ? { t: it.tpl, e: it.wel || null, h: it.welh ? 1 : 0 } : null; })() })); // 0.1.53 : l'arme (coup d'arme)
  /* Prépare le combat : A (équipe 0, l'attaquant) contre B (équipe 1). Renvoie une petite partie de travail S2 dont S2.fight est le combat. */
  E.koliSetup = (A, B, opts = {}) => {
    const chars = [], ents = [];
    [A, B].forEach((T, tm) => T.forEach((h, i) => {
      const id = tm ? 1000000 + i : (opts.ids && opts.ids[i]) || 900000 + i; const st = Object.assign({}, h.st);
      chars.push({ id, name: h.n, cls: h.cls, sex: h.sex, head: h.head, lvl: h.lvl, ren: h.ren, spells: h.sp.map((x) => Object.assign({}, x)), atkMode: h.am ? "ordre" : undefined, alloc: {}, equip: {}, eveils: {} }); /* 2.0.10 : les Éveils n'existent plus, une ancienne équipe de défense ne les garde pas */
      const hp = Math.max(1, Math.round(st.hpMax));
      ents.push({ side: tm ? "m" : "c", tm, cid: id, name: h.n, cls: h.cls, sex: h.sex, head: h.head, lvl: h.lvl, st, hpMax: hp, hp, hpBase: hp, ini: st.ini || 0,
        buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, weaken: 0, paLoss: 0, stack: 0, suffer: 0, nCast: 0, els: [], evc: h.mt ? h.evc || 0 : 0, ev: {}, mt: h.mt || null, bt: h.bt || null,
        row: i === 0 ? "f" : "b", dop: tm ? { cls: h.cls, sex: h.sex, head: h.head } : null, koli: true, kp: E.koliPow(h.cls, h.lvl), lg: h.lg || null, dp: h.dp || null, dpBoost: !!h.dpB,
        wsp: h.wp && ITEMS[h.wp.t] ? E.weaponSpellOf(h.cls, h.wp.t, h.wp.e, h.wp.h) : null });
    }));
    [0, 1].forEach((tm) => { // première ligne : le plus robuste ; Osamodas : +5 % de PV pour son équipe (comme en chasse)
      const T = ents.filter((x) => x.tm === tm); const osa = T.some((x) => x.cls === "osa") ? 1.05 : 1;
      T.forEach((x) => { x.hpMax = x.hp = x.hpBase = Math.round(x.hpBase * osa); x.row = "b"; });
      const f = T.slice().sort((a, b) => b.hpBase * (E.TANK_CLASSES.includes(b.cls) ? 1.25 : 1) - a.hpBase * (E.TANK_CLASSES.includes(a.cls) ? 1.25 : 1))[0]; if (f) f.row = "f";
      T.filter((x) => x.cls === "zobal").forEach((x) => (x.mask = "atk"));
    });
    const S2 = { chars, items: {}, settings: { manual: false, focus: "auto" }, stats: { fights: 0, wins: 0 }, fightSeq: 0 };
    const F = S2.fight = { id: 1, label: opts.label || "Kolizéum", ents, round: 1, order: [], oi: 0, log: [], over: false, result: null, dur: 0, dungeon: false, seq: 0, fx: [], sub: null, dungeonId: null, deaths: [],
      pvp: true, me: opts.me || 0, deco: "dg_sable", glyphs: [null, null], ero: 0, chals: [], cs: { focus: {}, first: {}, last: {}, turnCasts: {}, el: {}, hitTurn: {} }, dmgInit: true };
    if (E.legFight) E.legFight(S2, F); // 0.1.48 : passifs des légendaires au Kolizéum
    E.mtFight(F); // 2.0 : boucliers de la Maîtrise
    newRound(F);
    return S2;
  };
  const checkEnd = (S) => {
    const F = S.fight;
    if (!alive(F, "m").length) endFight(S, true);
    else if (!alive(F, "c").filter((x) => !x.summon).length) endFight(S, false);
  };

  /* 1.2.10 « Le Poutch » : comme dans DOFUS, le héros tape un Poutch de 100 000 PV qui ne riposte pas, pendant 8 tours,
     pour vérifier ses instructions (toute la séquence, recharges comprises). Seul ou avec l'équipe (o.team).
     Joué par le vrai moteur sur une copie de la partie ; renvoie, tour par tour, les sorts lancés, leurs dégâts et les mécaniques déclenchées. */
  E.POUTCH_HP = 100000; E.POUTCH_TOURS = 8;
  const POUTCH_MECH = ["cumul", "retard", "etat", "contagion", "erosion", "attire", "tp", "telefrag", "piege", "glyphe", "boom", "portail", "sacrifice", "pioche", "echo", "relance", "rune"];
  E.poutchPreview = (S, cid, o = {}) => {
    const c0 = S.chars.find((x) => x.id === cid); if (!c0) return null;
    const nT = o.rounds || E.POUTCH_TOURS; const evLen = E.events.length; const rng0 = rnd; let out = null;
    try {
      let seed = 7919; rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const S2 = JSON.parse(JSON.stringify(S)); const c = S2.chars.find((x) => x.id === cid);
      if (o.spells) c.spells = o.spells.map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt }));
      if (o.auto) delete c.atkMode; // 2.1.21 : comparaison de « Mon ordre » avec l'auto
      S2.fight = null; S2.dungeon = null; S2.pause = 0; S2.settings = Object.assign({}, S2.settings, { manual: false }); S2.manualLive = false; S2.protector = null;
      const team = o.team && c.inTeam && !c.job;
      if (!team) S2.chars.forEach((x) => (x.inTeam = x.id === cid));
      c.job = null;
      S2.hunting = true; S2.sub = Object.keys(SUBS).find((s) => SUBS[s].monsters && SUBS[s].monsters.length);
      const F = E.startFight(S2); if (!F) return null;
      const hi = F.ents.findIndex((e) => e.side === "c" && e.cid === cid && !e.summon); const he = F.ents[hi]; if (hi < 0) return null;
      F.ents.filter((e) => e.side === "m").forEach((m, i) => {
        if (i) { m.alive = false; m.hp = 0; return; }
        Object.assign(m, { name: "Poutch", hp: E.POUTCH_HP, hpMax: E.POUTCH_HP, dmg: 0, boss: false, mech: null, shield: 0, sp: null, res: {}, archi: false, attacks: 0, poutch: true });
      });
      F.order = F.order.filter((i) => F.ents[i].alive); F.bossIdx = undefined;
      const R = Array.from({ length: nT }, (_, i) => ({ r: i + 1, casts: [], pa: 0, dmg: 0, late: 0 }));
      let last = F.seq; const seen = new WeakSet(); F.log.forEach((l) => seen.add(l));
      for (let g = 0; g < 4000 && !F.over && F.round <= nT; g++) {
        const rd = F.round; E.step(S2);
        F.ents.forEach((e) => { if (e.side === "c" && e.alive) e.hp = e.hpMax; }); // le Poutch ne fait pas mal (et les PV n'influencent pas les conditions)
        const T = R[Math.min(rd, nT) - 1]; const nf = F.fx.filter((f) => f.seq > last); const bySeq = {};
        nf.forEach((f) => { if (f.k === "cast" && f.s === hi && f.sp) { const d = f.sp === "arme" ? he.wsp : E.spellDef(c.cls, f.sp); const gr = d && E.spellGrade(d, c.lvl); const x = { sp: f.sp, dmg: 0, mech: [] }; bySeq[f.seq] = x; T.casts.push(x); T.pa += gr ? gr.pa : 0; } });
        nf.forEach((f) => {
          if (f.k === "hit" && f.s === hi) { const x = bySeq[f.seq]; T.dmg += f.v || 0; if (x) x.dmg += f.v || 0; else T.late += f.v || 0; }
          else if (f.k === "buff" && f.idx && POUTCH_MECH.includes(f.idx) && bySeq[f.seq] && !bySeq[f.seq].mech.includes(f.idx)) bySeq[f.seq].mech.push(f.idx);
        });
        F.log.forEach((l) => { if (seen.has(l)) return; seen.add(l); if (!l.txt.startsWith(he.name + " ")) return;
          if (/cuve son ivresse/.test(l.txt)) T.why = T.why || "cuve"; else if (/passe son tour/.test(l.txt)) T.why = T.why || "none"; });
        last = F.seq;
      }
      out = { rounds: R, paMax: he.st.pa, total: R.reduce((a, r) => a + r.dmg, 0), team: !!team, hp: E.POUTCH_HP };
    } finally { rnd = rng0; E.events.length = evLen; }
    return out;
  };
  /* Simulateur de dégâts (interface) : estimation par lancer et par tour contre une cible à « res » % de résistance */
  E.spellEstimate = (S, c, sp, res = 0) => {
    const st = E.charStats(S, c); const g = E.spellGrade(sp, c.lvl);
    const best = [["t", st.fo], ["f", st.ine], ["e", st.cha], ["a", st.age]].sort((a, b) => b[1] - a[1])[0][0];
    let mn = 0, mx = 0, heal = 0; const cc = Math.min(60, 5 + st.cri) / 100; let tgts = 1;
    g.fx.forEach((f) => {
      if (["dmg", "drain", "dot"].includes(f.k)) {
        const el = f.el === "best" ? best : f.el || "n"; const E2 = ELEMENTS[el];
        const k = E.DMG_SCALE * (1 + Math.max(-50, (st[E2.stat] || 0) + st.pui) / 100);
        const add = st.do + (st[E2.dmg] || 0);
        const m = (1 + (st.dsort || 0) / 100) * E.classPow(c.cls, c.lvl) * (f.n > 1 ? 0.85 : 1) * (f.k === "dot" ? 0.55 * (f.t || 2) : 1) * (1 - Math.min(50, res) / 100);
        mn += (f.min * k + add) * m; mx += (f.max * k + add) * m; tgts = Math.max(tgts, f.n || 1);
      } else if (f.k === "heal") heal += ((f.min + f.max) / 2) * E.DMG_SCALE * (1 + (st.ine + st.pui) / 100) + st.so;
    });
    const avg = (mn + mx) / 2; const critAvg = avg * (1 - cc) + (avg * 1.25 + 3 + (st.dcri || 0)) * cc;
    const perTurn = Math.min(castLimit(g), Math.floor(st.pa / Math.max(1, g.pa)));
    return { min: Math.round(mn), max: Math.round(mx), avg: Math.round(critAvg), crit: Math.round(cc * 100), turn: Math.round(critAvg * perTurn), casts: perTurn, tgts, heal: Math.round(heal) };
  };
  /* jauge de passif affichée sous le héros en combat */
  E.passiveInfo = (e, F) => {
    switch (e.cls) {
      case "iop": return { n: "Colère", v: e.stack || 0, m: 6 };
      case "xelor": return { n: "Horloge", v: e.clock || 0, m: 12 };
      case "panda": return { n: e.cuve ? "Cuve" : "Ivresse", v: e.ivresse || 0, m: 5 };
      case "ougi": return { n: "Proie", v: e.ougi || 0, m: 5 };
      case "hupper": return { n: "Runes", v: (e.els || []).length, m: 4 };
      case "sacri": return { n: "Souffrance", v: e.suffer || 0, m: 15 };
      case "feca": return F && F.glyph ? { n: F.glyph === "prot" ? "Glyphe Protection" : F.glyph === "renvoi" ? "Glyphe Renvoi" : "Glyphe Soin" } : null;
      case "forge": return e.posture ? { n: e.posture === "lance" ? "Posture Lance" : "Posture Rempart" } : null;
      case "zobal": return e.mask ? { n: e.mask === "atk" ? "Psychopathe" : e.mask === "def" ? "Pleutre" : "Hystérique" } : null;
      case "eca": return F && F.roulette ? { n: F.roulette === "pile" ? "Pile" : F.roulette === "face" ? "Face" : F.roulette === "jackpot" ? "Jackpot" : "Perdu" } : null;
      case "cra": return F ? { n: `Distance +${Math.max(0, 40 - 10 * (F.round - 1))} %` } : null;
    }
    return null;
  };
  E.manualCanCast = (S, sp) => {
    const F = S.fight; const A = F && F.await; if (!A) return false; const e = F.ents[A.ei]; const g = E.spellGrade(sp, e.lvl);
    return g.pa <= A.pa && !((e.cd[sp.id] || 0) > 0) && (A.casts[sp.id] || 0) < castLimit(g) && !(e.silence > 0 && g.cd) && !(e.rooted > 0 && E.spellKind(g) === "heal");
  };
  E.manualCast = (S, spellId, targetIdx) => {
    const F = S.fight; const A = F && F.await; if (!A || F.over) return "Ce n'est pas votre tour.";
    const e = F.ents[A.ei]; const c = S.chars.find((x) => x.id === e.cid);
    const isW = spellId === "arme" && e.wsp; // 0.1.53 : coup d'arme
    if (!c || (!isW && !c.spells.find((x) => x.id === spellId))) return "Sort non équipé.";
    const sp = isW ? e.wsp : E.spellDef(c.cls, spellId); if (!sp) return "Sort inconnu.";
    if (!E.manualCanCast(S, sp)) return E.spellGrade(sp, e.lvl).pa > A.pa ? "Pas assez de PA." : "Sort en recharge.";
    const tgt = targetIdx !== undefined && targetIdx !== null ? F.ents[targetIdx] : null;
    F.seq++;
    const g = E.spellGrade(sp, e.lvl);
    const r = castSpell(S, F, e, sp, tgt, isW ? E.WSLOT : c.spells.find((x) => x.id === spellId));
    if (!r.ok) return "Aucune cible valable.";
    A.pa -= g.pa; A.pa += r.extraPa || 0; A.n++; A.casts[sp.id] = (A.casts[sp.id] || 0) + 1; A.t = F.dur;
    if (g.cd) e.cd[sp.id] = (e.lg && E.legCd ? E.legCd(e, g.cd) : g.cd) + 1;
    F.fx.push({ seq: F.seq, k: "cast", s: A.ei, sp: sp.id });
    checkEnd(S);
    if (F.over) { F.await = null; return null; }
    const any = c.spells.some((x) => { const d = E.spellDef(c.cls, x.id); return d && d.lvl <= c.lvl && E.manualCanCast(S, d); }) || (e.wsp && E.manualCanCast(S, e.wsp));
    if (!any) E.manualEnd(S);
    return null;
  };
  E.manualEnd = (S) => {
    const F = S.fight; const A = F && F.await; if (!A) return;
    const e = F.ents[A.ei]; if (!A.n) flog(F, `${e.name} passe son tour.`, "dim");
    F.await = null; e.lastCast = F.seq; endHeroTurn(S, F, e);
  };

  /* ---------------- Récompenses ---------------- */
  E.teamProspectionRaw = (S) => E.team(S).reduce((s, c) => s + E.charStats(S, c).pp, 0);
  /* Prospection d'équipe dégressive : 100 % jusqu'à 100, 50 % de 100 à 300, 25 % au-delà */
  E.effProspection = (pp) => (pp <= 100 ? pp : pp <= 300 ? 100 + (pp - 100) / 2 : 200 + (pp - 300) / 4);
  E.teamProspection = (S) => E.effProspection(E.teamProspectionRaw(S));
  /* 0.1.28.3 : événement « Double gain », XP et butin x2 pour tout le monde (dates fixes ; 21 h → dimanche 18 octobre 23 h, heure de Paris ; prolongé en 0.1.48.6) */
  E.EVENT = { name: "Semaine de la Maîtrise", from: Date.parse("2026-10-12T19:00:00Z"), to: Date.parse("2026-10-22T21:00:00Z"), xp: 2, drop: 2 };
  E.eventOn = (t = E.now()) => !!E.EVENT && t >= E.EVENT.from && t < E.EVENT.to;
  /* « La classe à l'honneur » (choix 5A de Mathis) : chaque semaine (du lundi au dimanche, heure de Paris), une classe peu jouée
     gagne +10 % d'XP pour ses héros (Maîtrise comprise au niveau 200) et +10 % de butin pour l'équipe qui en a un.
     Ordre : le Sram d'abord, puis les classes du moins au plus joué (héros au classement des classes du serveur, 18/10). */
  E.HONOR_ORDER = ["sram", "hupper", "steam", "roub", "ougi", "osa", "sadi", "elio", "xelor", "zobal", "forge", "panda", "sacri", "eca", "eni", "feca", "iop", "enu", "cra"];
  E.HONOR_START = Date.parse("2026-10-18T23:00:00Z"); // lundi 19/10 (minuit à Paris en heure d'hiver, dès le 25/10)
  E.HONOR_PCT = 10;
  E.HONOR_WEEK = 7 * 864e5;
  E.honorIdx = (t = E.now()) => Math.max(0, Math.floor((t - E.HONOR_START) / E.HONOR_WEEK));
  E.honorCls = (t = E.now()) => E.HONOR_ORDER[E.honorIdx(t) % E.HONOR_ORDER.length];
  E.honorEnd = (t = E.now()) => E.HONOR_START + (E.honorIdx(t) + 1) * E.HONOR_WEEK;
  E.honorXp = (c) => (c && c.cls === E.honorCls() ? 1 + E.HONOR_PCT / 100 : 1); // aussi sur la Maîtrise au niveau 200 (choix 2B de Mathis)
  E.honorDrop = (S) => (E.teamHas(S, E.honorCls()) ? 1 + E.HONOR_PCT / 100 : 1);
  E.evMult = (kind, t) => (E.eventOn(t) ? E.EVENT[kind] || 1 : 1);
  E.dropMult = (S) => {
    return (1 + E.teamProspection(S) / 100) * (1 + E.freeSpirit(S) / 100) * (1 + E.bonus(S, "drop") / 100) * (1 + (E.petFlair ? E.petFlair(S) : 0)) * E.honorDrop(S); // 1.1 : Flair des familiers ; classe à l'honneur
  };

  /* 1.0.5.1 (Mathis) : part de l'XP du combat reçue par chaque héros. Avant : 2/(n+1) plus l'Esprit Libre (+100 % en solo),
     un héros solo montait 3,5 fois plus vite qu'une équipe de 8. Maintenant la part baisse peu avec la taille de l'équipe :
     plus l'équipe est grande, plus chaque héros monte vite (simulation 1 → 200, bon équipement : solo ~180 h, 4 héros ~90 h, 8 héros ~62 h ; avant 52 / 98 / 180 h). */
  /* 1.0.7.10 (Mathis) : montée 1 → 200 visée (simulation, bon équipement, sans bonus) : 240 h solo, 150 h à 4 héros, 120 h à 8 */
  E.XP_SHARE = [0.569, 0.569, 0.477, 0.43, 0.396, 0.37, 0.347, 0.33, 0.315];
  E.xpShare = (n) => E.XP_SHARE[Math.min(8, Math.max(1, n))];
  /* 1.0.7.10 (Mathis, vérification zone par zone) : multiplicateur d'XP et de kamas de certaines sous-zones de chasse,
     pour que chaque zone rapporte à peu près autant que ses voisines de même niveau (le butin ne change pas) */
  E.ZONE_REW = { inc_lac: 1.17, inc_paturages: 1.13, bon_rives: 1.52, vul_pillar: 1.48, vul_etraktopel: 1.46, can_rives_lac: 1.18, oto_naufrages: 0.64, ama_cimetiere: 1.18, ast_cimetiere: 1.24, ama_foret_malefique: 1.15, can_dopeuls: 1.13, ama_bworks: 1.3, ama_cryptes: 1.39, ama_bandits: 1.13, wab_couronne: 1.53, wab_tombeaux: 1.37, vul_espartiate: 1.92, wab_waldo: 1.32, ama_marecages: 1.25, vul_mopyle: 1.43, ama_pitons: 1.5, can_plaines: 1.43, abr_oree: 1.34, abr_sombre: 1.14, fri_bourgade: 1.17, fri_port: 1.2, oto_tourbiere2: 1.14, oto_tourbiere: 1.12, can_bibliotheque: 1.21, bon_canaux: 1.21, bra_entrailles: 1.26, mino_labyrinthe: 1.13, oto_feuillage: 1.13, vul_ponefarr: 1.24, eca_lande: 1.17, fri_larmes: 1.18, vul_monseleya: 1.31, sah_cite: 1.11, oto_tourbiere_fond: 1.17, fri_crocs: 1.07, obs_dimension: 1.13, sak_foret: 1.13, fri_torrideau: 1.09, sak_plaine: 1.14 };
  E.zoneRew = (S, opts = {}) => (opts.dungeon || S.dungeon || !S.sub || (E.expActive && E.expActive(S)) ? 1 : E.ZONE_REW[S.sub] || 1);
  /* 1.0.14.1 (Mathis) : clés de donjon un peu plus rares à la chasse (×0,7 : une clé pour ~1,4 fois le temps de chasse d'avant) */
  E.KEY_DROP_SCALE = 0.7;
  /* 1.0.20 « Trophées passifs » (choix de Mathis) : un trophée de sous-zone ne s'équipe plus.
     - Dans sa région (chasse, pas en donjon ni au Songe) : +3 % d'XP, de butin et de kamas par trophée de la région, hors plafond.
     - Vitrine : la Vitalité et la Sagesse des 6 meilleurs trophées vont à tous les héros (autant qu'en les portant). */
  E.TROPHY_REGION = 0.03; E.VITRINE_N = 6;
  E.trophyRegionN = (S, zoneId) => { const z = ZONES.find((x) => x.id === zoneId); return z && S.trophies ? z.subs.filter((s) => S.trophies[s.id]).length : 0; };
  E.trophyZoneMult = (S, opts = {}) => (opts.dungeon || S.dungeon || !S.sub || !SUBS[S.sub] || (E.expActive && E.expActive(S)) ? 1 : 1 + E.TROPHY_REGION * E.trophyRegionN(S, SUBS[S.sub].zone));
  const vitrineCache = new WeakMap();
  E.trophyVitrine = (S) => {
    const keys = Object.keys(S.trophies || {}); const memo = vitrineCache.get(S);
    if (memo && memo.n === keys.length) return memo.v;
    const list = keys.map((k) => ITEMS["trophee_" + k]).filter(Boolean).sort((a, b) => b.stats.vit[0] - a.stats.vit[0] || b.lvl - a.lvl).slice(0, E.VITRINE_N);
    const v = { vit: list.reduce((t, T) => t + T.stats.vit[0], 0), sa: list.reduce((t, T) => t + T.stats.sa[0], 0), list: list.map((T) => T.trophy) };
    vitrineCache.set(S, { n: keys.length, v }); return v;
  };
  E.lootRolls = (S) => Math.max(1, E.team(S).length); // 1.0.3 : un tirage de ressource par héros
  const giveRewards = (S, mons, opts = {}) => {
    const team = E.team(S);
    const out = { xp: {}, kamas: 0, res: {}, items: [], ups: [] };
    let xp = 0; const maxLvl = Math.max(...mons.map((m) => m.lvl));
    mons.forEach((m) => {
      let x = E.monsterXp(m.lvl) * (m.boss ? 6 : 1) * (m.archi ? 5 : 1) * (m.champ ? 3 : 1) * (m.chroma ? E.CHROMA_MULT || 1 : 1) * E.almMult(S, "xp", m); // 1.0.33 : chromatique (js/chroma.js) // 0.1.39 : Almanax (famille, donjon ou fête)
      xp += x;
      out.kamas += Math.round((m.lvl * 1.5 + ri(0, m.lvl)) * (m.boss ? 8 : 1) * (E.teamHas(S, "enu") ? 1.15 : 1) * (1 + E.bonus(S, "kamas") / 100) * (opts.kamasMult || 1) * E.sabLoot() * E.almMult(S, "kamas", m));
      S.bestiary[m.key] = (S.bestiary[m.key] || 0) + 1; if (E.btKill) E.btKill(S, m); // 2.0 : Maîtrise du Bestiaire
      if (m.archi) { S.archis[m.key] = (S.archis[m.key] || 0) + 1; note(S, `Archimonstre vaincu : ${m.name} !`, "rare"); E.exoArchi(S, m); if (E.captureSoul && E.captureSoul(S, m, opts) === "new") (out.souls = out.souls || []).push(m.key); } // 0.1.13 : âme pour l'album
      if (m.champ) { S.champs = (S.champs || 0) + 1; out.champ = { name: m.name, power: m.champ, key: m.base || m.key }; if (!opts.offline) note(S, `Champion vaincu : ${m.name} !`, "rare"); if (E.champKill) out.champ.ch = E.champKill(S, m, opts); }
    });
    xp *= 1 + (mons.length - 1) * 0.1; // bonus de groupe
    const zr = E.zoneRew(S, opts) * E.trophyZoneMult(S, opts) * E.classesMult(S); xp *= zr; out.kamas = Math.round(out.kamas * zr); // 1.0.34 : + Les 19 classes // 1.0.7.4 : rendement de la sous-zone (XP et kamas), réglé par simulation
    const share = E.xpShare(team.length);
    team.forEach((c) => {
      const st = E.charStats(S, c);
      const diff = c.lvl - maxLvl;
      const pen = E.xpPenalty(diff);
      const boost = 1 + (opts.xpBoost !== undefined ? opts.xpBoost : E.boostPct(S, "xp")) / 100;
      let g = Math.round(xp * share * (1 + st.sa / 100) * pen * boost * (opts.xpMult || 1) * E.roamMult(S) * (1 + ((E.dofpXpBonus ? E.dofpXpBonus(S, c) : E.bonus(S, "xp")) + E.synergy(S)) / 100) * E.renXpMult(c) * E.evMult("xp") / (c.lvl >= E.MAX_LVL && E.eventOn() ? E.EVENT.xp || 1 : 1) * (E.mtAcctMult ? E.mtAcctMult(S) : 1) * (E.mtOwn ? E.mtOwn(S, c, "xp") : 1) * E.honorXp(c)); // classe à l'honneur ; 2.0 : Maîtrise du compte ; 2.1 : Érudit ; Maîtrise lente (2A) : le x2 de l'événement ne compte plus au niveau 200 (bonus d'alliance et de boss des mondes gardés) // 1.0.16 : Jyfus (XP du porteur, dans le plafond)
      out.xp[c.id] = g; if (pen < 1) (out.pen = out.pen || {})[c.id] = [pen, diff, maxLvl]; // 1.0.30.5 : malus de niveau affiché dans le résultat
      if (E.montiXpShare) g -= E.montiXpShare(S, c, g); // 1.1 : le montilier grandit avec l'XP du héros
      g -= E.mountXpShare(S, c, g); // 0.1.9 : part donnée à la monture
      g -= E.guildXpShare(S, c, g); // 0.1.21 : part donnée à la guilde
      const ups = E.giveXp(S, c, g); if (ups) out.ups.push([c.name, c.lvl]);
    });
    E.stableXp(S, (team.length ? team.reduce((s, c) => s + (out.xp[c.id] || 0), 0) / team.length : 0) * E.almMult(S, "enclos")); // Mangeoire de l'enclos
    // Salle d'entraînement du Havre-Sac : une part de l'XP moyenne de l'équipe
    const tr = E.trainee(S);
    if (tr && team.length) {
      const g = Math.round(team.reduce((s, c) => s + (out.xp[c.id] || 0), 0) / team.length * E.trainShare(S, tr));
      if (g > 0) { const gr = Math.round(g * E.renXpMult(tr)); out.xp[tr.id] = gr; if (E.giveXp(S, tr, gr - E.mountXpShare(S, tr, gr))) out.ups.push([tr.name, tr.lvl]); } // 1.0.30.2 : le résultat de combat montre l'XP avec la Renaissance
    }
    if (E.mtTeam) out.kamas = Math.round(out.kamas * E.mtTeam(S, team, "kam")); // 2.1 : Banquier
    S.kamas += out.kamas;
    // Butin
    const dm = E.dropMult(S) * (opts.dropMult || 1) * E.sabLoot() * (E.btLoot ? E.btLoot(S, mons) : 1) * E.evMult("drop") * E.roamMult(S) * (E.teamHas(S, "enu") ? 1.15 : 1) * E.almMult(S, "drop") * E.trophyZoneMult(S, opts) * (E.mtTeam ? E.mtTeam(S, team, "loot") : 1); // 2.1 : Pilleur (jamais les Dofus)
    const topL = Math.max(...S.chars.map((c) => c.lvl));
    const ougi = E.teamHas(S, "ougi");
    const sub = SUBS[S.sub];
    const seen = (k, what) => { (S.seenDrops[k] = S.seenDrops[k] || {})[what] = 1; };
    const nRoll = E.lootRolls(S);
    mons.forEach((m) => {
      const T = MONSTERS[m.base || m.key]; const q = (m.archi ? 3 : 1) * (m.champ ? 2 : 1) * (m.chroma ? E.CHROMA_MULT || 1 : 1);
      const lp = E.lootPenalty(topL - m.lvl); const dm0 = dm; { const dm = dm0 * lp * (m.champ ? 2 : 1);
      const tq = E.huntTier(S, m.base || m.key) >= 1 ? 1.05 : 1;
      // 1.0.3 : un tirage par héros, la chance est partagée entre eux (même moyenne, le bonus au-delà de 100 % n'est plus perdu)
      const rolls = nRoll + (E.teamHas(S, "sram") && rnd() < 0.1 ? 1 : 0);
      T.drops.forEach(([r, rate]) => { const mm = dm * tq * (ougi && /^Viande/.test(r) ? 1.2 : 1); const p = Math.min(100, E.resRate(rate) * mm / nRoll); let n = 0;
        for (let rr = 0; rr < rolls; rr++) if (rnd() * 100 < p) n++;
        if (n) { addRes(S, r, q * n); out.res[r] = (out.res[r] || 0) + q * n; seen(m.key, r); } });
      if (m.champ) { const ok = T.drops.filter(([r, p]) => !E.isKey(r) && p < 100); const best = ok.filter(([, p]) => p >= 5).sort((a, b) => a[1] - b[1])[0] || ok.sort((a, b) => b[1] - a[1])[0] || T.drops[0]; /* la ressource typique la plus rare du monstre */ if (best) { addRes(S, best[0], 3); out.res[best[0]] = (out.res[best[0]] || 0) + 3; out.champ.res = [best[0], 3]; } }
      E.tkLoot(S, m, nRoll, out); // 1.0.7 : Tickets de Koli en combat
      if (m.boss && opts.dungeon && (opts.stasis || 0) >= 10 && E.joyDrop) E.joyDrop(S, opts.stasis, out); // 2.0 : joyaux de Maîtrise
      if (m.boss && opts.dungeon && !opts.offline && Math.random() < E.grainRate(opts.stasis || 0)) { E.addCons(S, "grain_xelor"); out.cons = (out.cons || 0) + 1; note(S, "Butin très rare : Grain de Xélor (+15 min de Sablier) !", "rare"); }
      if (m.boss && rnd() < E.BONBON_RATE) { S.cons.bonbon_sagesse = (S.cons.bonbon_sagesse || 0) + 1; out.cons = (out.cons || 0) + 1; note(S, "Butin rare : Bonbon Sagesse !", "rare"); }
      /* 1.0.15 (Mathis 4A, 5A, 7C) : une chance par héros ; le boss d'un donjon a plus de chances avec la stasis (×1 à la 1, ×3,25 à la 10) ;
         un équipement jamais obtenu est annoncé en grand */
      const sk = m.boss && opts.dungeon ? E.bossDropMult(opts.stasis || 1) : 1;
      T.items.forEach(([tpl, rate]) => {
        if (!ITEMS[tpl]) return;
        const p = Math.min(100, rate * E.ITEM_DROP_SCALE * dm * sk * (m.chroma ? E.CHROMA_MULT || 1 : 1)); let n = 0;
        for (let rr = 0; rr < rolls; rr++) if (rnd() * 100 < p) n++;
        for (let ii = 0; ii < n; ii++) {
          seen(m.key, tpl);
          const neu = !(E.itemDex ? E.itemDex(S) : S.itemDex || {})[tpl];
          const it = E.rollItem(S, tpl, { archi: m.archi, champ: m.champ });
          if (neu && !opts.offline && E.celebrate) E.celebrate({ t: "dropit", tpl, mon: m.base || m.key });
          const auto = E.applyAuto(S, it);
          if (auto) out.auto = (out.auto || 0) + 1; else out.items.push(it.uid);
        }
      });
      // clés de donjon
      if (!opts.dungeon && sub && sub.dungeon && sub.monsters.includes(m.base || m.key)) (sub.dungeons || [sub.dungeon]).forEach((did) => {
        const dg = DUNGEONS[did]; if (!dg) return;
        if (rnd() * 100 < dg.keyDrop * E.KEY_DROP_SCALE * dm) { addRes(S, dg.key, 1); out.res[dg.key] = (out.res[dg.key] || 0) + 1; note(S, `Butin : ${dg.key}`, "loot"); }
      });
      if (lp < 1) out.lootPen = Math.min(out.lootPen || 1, lp); }
    });
    { const cd = E.almCandy(S); if (cd) { out.cons = (out.cons || 0) + 1; note(S, `Nuit d'Halouine : ${CONSUMABLES[cd].name} dans le butin !`, "rare"); } }
    if (!opts.dungeon && sub && E.petHunt(S, S.sub)) out.pet = true; // familier de la sous-zone
    if (E.petSouls) E.petSouls(S, mons); // 1.1 : les familiers grandissent au combat (âmes)
    if (!opts.dungeon && sub && E.mountHunt(S, S.sub)) out.mount = true; // capture d'une monture sauvage
    // Trésors de l'Enutrof : une ressource bonus des monstres du combat
    for (let i = 0; i < (opts.treasure || 0); i++) { const pool = mons.flatMap((m) => (MONSTERS[m.base || m.key].drops || []).map(([r]) => r)); if (!pool.length) break; const r = pick(pool); addRes(S, r, 1); out.res[r] = (out.res[r] || 0) + 1; }
    return out;
  };
  E.giveRewards = giveRewards;
  /* 0.1.34.1 (Mathis) : plus de butin réduit sur les monstres plus faibles que le meilleur héros
     (avant : dès 10 niveaux d'écart, −6 % par niveau, plancher 10 %) ;
     0.1.34.2 : les objets très bas ne sont plus changés en kamas, ils arrivent dans le sac (tri automatique du sac inchangé) */
  E.lootPenalty = () => 1;
  /* Taux de ressources v2.7 : divisés par 2 (×0,4 ; les ressources « garanties » à 100 % tombent à 35 %) */
  E.RES_RATE_SCALE = 0.4;
  E.resRate = (rate) => (rate >= 100 ? 35 : rate * E.RES_RATE_SCALE);
  E.BONBON_RATE = 0.02;
  /* 1.0.5 (Mathis) : chaque monstre peut donner un Ticket de Koli. Une chance par héros (0,25 % chacun, 10 % sur un boss de donjon),
     les bonus de butin comptent à moitié, le Double gain en entier ; un archimonstre en donne toujours un ; 40 trouvés par jour au plus. */
  E.TK_LOOT = { hero: 0.25, boss: 10, day: 40 };
  E.tkFound = (S, now = E.now()) => { const d = E.defiDay ? E.defiDay(now) : Math.floor(now / 86400000); if (!S.tkFound || S.tkFound.d !== d) S.tkFound = { d, n: 0 }; return S.tkFound; };
  E.tkMult = (S) => (1 + (E.dropMult(S) - 1) / 2) * E.evMult("drop");
  E.tkLoot = (S, m, nRoll, out) => {
    if (!E.KOLI_TICKET) return; const T = E.TK_LOOT; const f = E.tkFound(S); if (f.n >= T.day) return;
    let n = m.archi ? 1 : 0; const p = (m.boss ? T.boss : T.hero) * E.tkMult(S) / 100;
    for (let i = 0; i < nRoll; i++) if (rnd() < p) n++;
    n = Math.min(n, T.day - f.n); if (!n) return;
    f.n += n; S.cons[E.KOLI_TICKET] = (S.cons[E.KOLI_TICKET] || 0) + n; out.tk = (out.tk || 0) + n;
  };
  /* Pénalité d'XP quand les monstres sont trop faibles pour le héros */
  /* 0.1.34 : malus adouci (avant : dès 5 niveaux d'écart, −10 % par niveau jusqu'à −95 %) ; une zone plus basse reste un repli correct */
  E.XP_PEN = { free: 6, step: 0.05, min: 0.3 };
  E.xpPenalty = (diff) => (diff > E.XP_PEN.free ? Math.max(E.XP_PEN.min, 1 - (diff - E.XP_PEN.free) * E.XP_PEN.step) : 1);
  /* 1.0.33.1 : règle « Bas niveau » : un objet trop bas pour l'équipe (A.low niveaux sous son héros le plus faible) est
     brisé. Jamais : panoplies, Rayonnants, exo, parfaits, verrouillés, trophées, Dofus et légendaires. */
  E.lowItem = (S, it, gap, abs) => {
    const T = ITEMS[it && it.tpl]; if (!T || !(gap > 0) || T.slot === "dofus" || T.trophy || T.leg || T.set) return false;
    if (it.radiant || it.exo || it.locked || (E.isPerfect && E.isPerfect(it))) return false;
    if (abs) return T.lvl < gap; // 2.1.20 : « sous le niveau N » choisi par le joueur (idée d'Hayabusa)
    const team = E.team(S); if (!team.length) return false;
    return T.lvl < Math.min(...team.map((c) => c.lvl)) - gap;
  };
  /* Règles automatiques de vente / brisage des objets lâchés */
  E.applyAuto = (S, it) => {
    const A = S.settings.auto; if (!A || it.radiant || it.locked || E.inGear(S, it.uid)) return null;
    if (A.recycle) {
      const q = E.itemQuality(it);
      const better = Object.values(S.items).some((x) => x !== it && x.tpl === it.tpl && (x.radiant || E.itemQuality(x) >= q));
      if (better) { E.breakItem(S, it.uid, null); return "recycle"; }
    }
    if (A.low > 0 && E.lowItem(S, it, A.low)) { E.breakItem(S, it.uid, null); return "low"; }
    if (A.lowLvl > 1 && E.lowItem(S, it, A.lowLvl, true)) { E.breakItem(S, it.uid, null); return "low"; }
    if (A.action === "none") return null;
    const T = ITEMS[it.tpl]; if (A.keepSets && T.set) return null;
    if (E.itemQuality(it) * 100 >= A.q) return null;
    if (A.action === "break" || A.action === "sell") { E.breakItem(S, it.uid, null); return "break"; }
    return null;
  };
  E.ITEM_DROP_SCALE = 1; // 1.0.15 : les taux de js/drops.js sont déjà les vraies chances par héros (avant : taux DofusDB × 0,04)
  E.bossDropMult = (k) => 1 + 0.25 * (Math.min(10, Math.max(1, k)) - 1); // 1.1 : plafonné à la stasis 10

  /* 2.0 « La Maîtrise » : au niveau 200, l'XP remplit des niveaux de Maîtrise sans fin, 1 point chacun, au coût du niveau 199 → 200
     (arbres, combat et Bestiaire : js/maitrise_moteur.js ; page Héros › Maîtrise : js/maitrise.js). bn : points venus des vies passées */
  E.mt = (c) => { if (!c.mt) c.mt = { lvl: 0, xp: 0, bn: 0, t: [[], [], []], lo: 0, j: {} }; return c.mt; };
  /* Maîtrise lente (choix de Mathis 1D, 16/10) : le point n coûte (20 + n/5) fois l'XP du niveau 199 → 200 (avant : 1 fois, pour tous).
     Mesuré sur le classement public : ~30 points/h par héros pendant le x2 ; maintenant 100 points ≈ 8 jours, 400 ≈ 2 mois, 1 000 ≈ 11 mois de jeu.
     E.MT_LENT = false rend l'ancien coût (serveur où la règle ne s'applique pas). */
  E.MT_LENT = true; E.MT_PIONNIER = "Pionnier des étoiles"; E.MT_RESET = true; // titre du reset des Maîtrises (6A) ; MT_RESET = false : tests des anciennes conversions
  E.mtBase = () => E.xpNeed(E.MAX_LVL - 1);
  E.mtCost = (n) => (E.MT_LENT ? 20 + n / 5 : 1); // n = numéro du point gagné (1 = le premier)
  E.mtNeed = (x = 0) => { const lvl = x && typeof x === "object" ? (x.mt ? x.mt.lvl || 0 : 0) : x || 0; return Math.round(E.mtBase() * E.mtCost(lvl + 1)); }; // XP pour passer de la Maîtrise lvl à lvl + 1 (un héros ou un niveau)
  E.mtXpTot = (lvl) => { const n = lvl || 0; return Math.round(E.mtBase() * (E.MT_LENT ? 20 * n + n * (n + 1) / 10 : n)); }; // XP de toute la Maîtrise jusqu'au niveau lvl
  E.mtPts = (c) => (c && c.mt ? c.mt.lvl + (c.mt.bn || 0) : 0);
  E.mtPass = (S, c) => { const f = E.mtFx ? E.mtFx(S, c) : null; return f ? f.pass / 50 : 0; }; // le passif de classe : 50 % = un rang de l'ancien Éveil de classe
  E.mtFight = (F) => F.ents.forEach((e) => { if (e.mt && e.mt.sh && !e.summon) e.shield = (e.shield || 0) + Math.round(e.hpMax * e.mt.sh / 100); });
  E.giveXp = (S, c, g) => {
    if (c.lvl >= E.MAX_LVL) {
      if (!(g > 0)) return false; const M = E.mt(c); M.xp += g; let up = 0;
      for (let need = E.mtNeed(M.lvl); M.xp >= need; need = E.mtNeed(M.lvl)) { M.xp -= need; M.lvl++; up++; }
      if (up) { const ob = M.obj != null && E.mtObjStep ? E.mtObjStep(S, c) : 0; note(S, ob ? `${c.name} gagne ${up > 1 ? `${up} niveaux` : "un niveau"} de Maîtrise (${M.lvl}) : ${ob > 1 ? `${ob} points placés` : "un point placé"} vers son objectif.` : `${c.name} gagne ${up > 1 ? `${up} niveaux` : "un niveau"} de Maîtrise (${M.lvl}) : un point de plus à placer dans son arbre.`, "up"); E.emit(S, "mtlvl", { cid: c.id, lvl: M.lvl }); if (E.mtBrSync) E.mtBrSync(S); } // 2.1 : objectif épinglé (12A), titres des branches complètes (9A)
      return false;
    }
    c.xp += g; let up = false; const from = c.lvl;
    while (c.lvl < E.MAX_LVL && c.xp >= E.heroXpNeed(c)) {
      c.xp -= E.heroXpNeed(c); c.lvl++; c.pts += 5; up = true;
    }
    if (up) {
      E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
      note(S, `${c.name} passe niveau ${c.lvl} !`, "up");
      E.emit(S, "level", { cid: c.id, lvl: c.lvl });
      if (Math.floor(c.lvl / 10) > Math.floor(from / 10)) E.celebrate({ t: "lvl", cid: c.id, lvl: Math.floor(c.lvl / 10) * 10, frame: Math.floor(c.lvl / 20) > Math.floor(from / 20) });
      const nw = CLASSES[c.cls].spells.filter((s) => s.lvl === c.lvl);
      nw.forEach((s) => note(S, `${c.name} apprend ${s.name}.`, "up"));
    }
    if (c.lvl >= E.MAX_LVL && c.xp > 0) { const r = c.xp; c.xp = 0; E.giveXp(S, c, r); } // 2.0.3 : l'XP en trop au passage du niveau 200 va dans la Maîtrise
    return up;
  };

  /* 1.0.4 : statistiques de combat. Par héros : dégâts infligés (invocations et poisons compris), soins donnés,
     dégâts subis et ennemis achevés. Gardées dans l'historique (S.history[].s) et cumulées dans S.fstat. */
  E.fightStats = (F) => F.ents.filter((e) => e.side === "c" && !e.summon && e.cid).map((e) => ({ id: e.cid, n: e.name, d: Math.round(e.dealt || 0), h: Math.round(e.healDone || 0), t: Math.round(Object.values(e.taken || {}).reduce((a, b) => a + b, 0)), k: e.kills || 0 }));
  E.addFightStats = (S, fst) => {
    if (!fst || !fst.length) return;
    const T = S.fstat = S.fstat && S.fstat.h ? S.fstat : { t: E.now(), n: 0, h: {} }; T.n++;
    fst.forEach((x) => { const o = T.h[x.id] = T.h[x.id] || { d: 0, h: 0, t: 0, k: 0, f: 0 }; o.d += x.d; o.h += x.h; o.t += x.t; o.k += x.k; o.f++; });
  };
  E.resetFightStats = (S) => { S.fstat = { t: E.now(), n: 0, h: {} }; };
  const endFight = (S, win, why) => {
    const F = S.fight; F.over = true; F.result = win ? "win" : "lose";
    const D0 = S.dungeon; let dgDone = false; // 1.0.25.1 : rendement de l'enchaînement de donjons
    S.stats.fights++;
    if (F.prot) E.protEnd(S, win);
    if (win) {
      S.stats.wins++;
      const mons = F.ents.filter((e) => e.side === "m" && !e.fake);
      const cb = E.chalResolve(S, F);
      const sr = (F.stasis > 1 ? E.stasisMult(F.stasis).rew : 1) * (F.weekly ? E.WEEKLY_REW : 1) * (F.flash ? E.FLASH_REW : 1) * (1 + (F.idolBonus || 0) / 100);
      const xm = F.exp ? F.exp.mult : { xp: 1, drop: 1, kamas: 1 }; // 0.1.24 : +4 % par étage d'expédition, reliques de butin
      F.rewards = giveRewards(S, mons, { dungeon: !!S.dungeon, stasis: F.stasis || 1, xpMult: (1 + cb / 100) * sr * E.PACE_REW * (F.powRew || 1) * xm.xp, dropMult: (1 + cb / 100) * sr * E.PACE_REW * (F.powRew || 1) * (F.roulette === "jackpot" ? 2 : 1) * xm.drop, kamasMult: E.PACE_REW * (F.powRew || 1) * xm.kamas, treasure: F.treasure || 0 });
      if (cb) F.rewards.chal = cb;
      if (F.cr && E.chromaWin) { const ch = E.chromaWin(S, mons, {}); if (ch.length) F.rewards.chroma = ch; } // 1.0.33 : chromatiques (js/chroma.js), seulement les vrais combats
      if (F.idolBonus) { F.rewards.idol = { score: F.idolScore, pct: F.idolBonus, ids: F.idol.ids }; S.cnt = S.cnt || {}; S.cnt.idolWins = (S.cnt.idolWins || 0) + 1; if (F.idolScore > (S.cnt.idolBest || 0)) S.cnt.idolBest = F.idolScore; if (F.idol.ids.length >= E.IDOL_MAX) S.cnt.idolSix = (S.cnt.idolSix || 0) + 1; }
      checkHunt(S, [...new Set(mons.map((m) => m.key))]);
      E.emit(S, "win", { mons: mons.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, champ: m.champ, lvl: m.lvl })), sub: S.dungeon || F.exp ? null : S.sub, dungeon: S.dungeon ? S.dungeon.id : null, stasis: F.stasis || 0, chals: (F.chals || []).filter((c) => c.ok).map((c) => c.id), down: (F.deathInfo || []).length });
      if (!S.dungeon && !F.exp) S.progress.wins[S.sub] = (S.progress.wins[S.sub] || 0) + 1;
      const xpTot = Object.values(F.rewards.xp).reduce((a, b) => a + b, 0);
      flog(F, `Victoire ! +${xpTot} XP, +${F.rewards.kamas} kamas`, "win");
      const prevUnlocked = new Set(Object.keys(SUBS).filter((s) => E.subUnlocked(S, s)));
      if (S.dungeon) {
        const dg = DUNGEONS[S.dungeon.id];
        if (S.dungeon.room >= dg.rooms.length) {
          S.progress.bossKills[S.dungeon.id] = (S.progress.bossKills[S.dungeon.id] || 0) + 1; E.compWin(S, S.dungeon.id); // 0.1.10.1
          if (E.BOSS_SIGS[S.dungeon.id] && (S.dungeon.stasis || 1) >= 5 && !(F.deathInfo || []).length) (S.sigWins = S.sigWins || {})[S.dungeon.id] = 1;
          E.bossChest(S, S.dungeon.id, F.rewards);
          E.stasisClear(S, S.dungeon, F.rewards);
          E.emit(S, "dungeon", { id: S.dungeon.id, stasis: S.dungeon.stasis || 1, chals: (F.chals || []).filter((c) => c.ok).map((c) => c.id), down: (F.deathInfo || []).length });
          note(S, `${MONSTERS[dg.boss].name} est vaincu ! Donjon terminé.`, "rare");
          const chainD = S.dungeon; S.dungeon = null; dgDone = true;
          /* 1.0.32.3 « Montée de stasis » : la course suivante prend la stasis du dessus jusqu'à la stasis visée */
          const nextK = chainD.climb && (chainD.stasis || 1) < chainD.climb ? (chainD.stasis || 1) + 1 : chainD.stasis;
          if (chainD.chain > 1) { const r2 = E.enterDungeon(S, chainD.id, nextK, chainD.chain - 1, chainD.climb); if (r2) { note(S, `Enchaînement arrêté : ${r2}`, "warn"); if (chainD.climb) climbEnd(S, chainD, false); } else { S.dungeon.tot = chainD.tot || chainD.chain; S.dungeon.run = (chainD.run || 1) + 1; S.dungeon.cs = chainD.cs; S.dungeon.k0 = chainD.k0; } }
          else if (chainD.climb) climbEnd(S, chainD, true);
          if (!S.dungeon && S.hunting && S.sub) E.applyZonePresets(S, S.sub);
        } else S.dungeon.room++;
      }
      Object.keys(SUBS).forEach((s) => { if (!prevUnlocked.has(s) && E.subUnlocked(S, s)) note(S, `Nouvelle sous-zone : ${SUBS[s].name}`, "up"); });
      if (F.exp) E.expWin(S, F); // 0.1.24 : étage franchi
      else { E.autoZone(S, true); E.roam(S); } // 0.1.10.2 : chasse itinérante
    } else {
      E.chalResolve(S, F, true);
      flog(F, why || (S.dungeon && S.dungeon.defi ? "Défaite." : "Défaite… l'équipe se repose."), "lose"); // 1.0.12.8 : pas de repos dans la relecture du Défi du jour
      try { F.loss = E.lossReport(S, F); } catch (e) { F.loss = null; }
      if (F.loss) { S.losses = (S.losses || []).filter((x) => x && x.t); S.losses.unshift(F.loss); if (S.losses.length > 6) S.losses.length = 6; E.events.push({ kind: "loss", txt: F.loss.txt, rep: F.loss }); }
      if (F.exp) E.expLose(S, F); // 0.1.24 : une vie de moins
      else E.autoZone(S, false);
      if (S.dungeon) {
        if ((S.cons.fiole_resu || 0) > 0 && !S.dungeon.revived) { S.cons.fiole_resu--; if (!S.cons.fiole_resu) delete S.cons.fiole_resu; S.dungeon.revived = true; note(S, `Fiole de Résurrection : l'équipe se relève et recommence la salle (${DUNGEONS[S.dungeon.id].name}).`, "rare"); }
        else { note(S, `Échec dans ${DUNGEONS[S.dungeon.id].name}. La clé est perdue.`, "warn"); if (S.dungeon.climb) climbEnd(S, S.dungeon, false, true); S.dungeon = null; }
      }
    }
    if (F.dungeonId && S.dungeon) S.dungeon.t = (S.dungeon.t || 0) + F.dur;
    /* 1.0.25.1 « XP/h en donjon » : XP, kamas, ressources, poussières et donjons finis, mesurés sur l'enchaînement en cours (suit la course suivante) */
    if (F.dungeonId && D0 && !D0.defi) {
      const cs = D0.cs = D0.cs || { s: 0, f: 0, w: 0, xp: 0, k: 0, r: 0, i: 0, p: 0, n: 0 }; const rw = F.rewards || { xp: {}, kamas: 0, res: {}, items: [] };
      cs.s += F.dur + E.PAUSE_MS / 1000; cs.f++; cs.w += win ? 1 : 0; cs.xp += Object.values(rw.xp).reduce((a, b) => a + b, 0); cs.k += rw.kamas || 0;
      cs.r += Object.values(rw.res).reduce((a, b) => a + b, 0); cs.i += (rw.items || []).length; cs.p += (rw.stasis && rw.stasis.dust) || 0; if (dgDone) cs.n++;
    }
    if (F.dungeonId && D0 && E.dghRecord) E.dghRecord(S, D0, F, win, dgDone); // 1.0.30 : durée et réussite des vraies courses, pour le donjon pendant l'absence (js/expeditions.js)
    S.stats.recent.push({ d: Math.round(F.dur * 10) / 10, w: win ? 1 : 0 });
    if (S.stats.recent.length > 20) S.stats.recent.shift();
    // historique et rendement par zone
    const zkey = F.dungeonId ? "dg:" + F.dungeonId : F.sub;
    const r = F.rewards || { xp: {}, kamas: 0, res: {}, items: [] };
    const xpTot = Object.values(r.xp).reduce((a, b) => a + b, 0);
    const nres = Object.values(r.res).reduce((a, b) => a + b, 0);
    const fst = E.fightStats(F);
    S.history.unshift({ t: E.now(), z: zkey, label: F.label, w: win ? 1 : 0, d: Math.round(F.dur), xp: xpTot, k: r.kamas, r: nres, i: r.items.length, s: fst });
    E.addFightStats(S, fst);
    if (F.loss) F.loss.t = S.history[0].t; // même horodatage : le rapport s'ouvre depuis « Derniers combats »
    if (S.history.length > 30) S.history.length = 30;
    if (zkey) {
      const z = S.zoneStats[zkey] = S.zoneStats[zkey] || { f: 0, w: 0, s: 0, xp: 0, k: 0, r: 0, i: 0 };
      z.f++; z.w += win ? 1 : 0; z.s += F.dur + E.PAUSE_MS / 1000; z.xp += xpTot; z.k += r.kamas; z.r += nres; z.i += r.items.length;
      // 0.1.34 : réussite récente (moyenne glissante, ≈ 10 derniers combats) et niveau moyen de l'équipe à ce moment-là
      const tm = E.team(S); z.lv = tm.length ? Math.round(tm.reduce((a, c) => a + c.lvl, 0) / tm.length) : 0;
      z.ew = z.ew === undefined ? (z.f > 1 ? (z.w - (win ? 1 : 0)) / (z.f - 1) * 0.9 + (win ? 0.1 : 0) : win ? 1 : 0) : z.ew * 0.9 + (win ? 0.1 : 0);
    }
  };
  /* 0.1.34 : difficulté d'une zone d'après les derniers combats de l'équipe (null : pas assez de combats, ou l'équipe a pris 5 niveaux depuis) */
  E.ZONE_DIFF = { min: 5, easy: 0.97, hard: 0.9, stale: 5 };
  E.zoneDiff = (S, zkey) => {
    const z = S.zoneStats && S.zoneStats[zkey]; if (!z || z.f < E.ZONE_DIFF.min) return null;
    const tm = E.team(S); const avg = tm.length ? tm.reduce((a, c) => a + c.lvl, 0) / tm.length : 0;
    if (z.lv && avg > z.lv + E.ZONE_DIFF.stale) return null;
    const wr = z.ew === undefined ? z.w / z.f : z.ew;
    return { wr, k: wr >= E.ZONE_DIFF.easy ? "easy" : wr >= E.ZONE_DIFF.hard ? "mid" : "hard" };
  };
  /* 1.0.25.1 : rendement de l'enchaînement de donjons en cours (null avant le premier combat) */
  E.dgChainRate = (S) => {
    const D = S.dungeon; const z = D && D.cs; if (!z || z.s < 1) return null;
    const h = 3600 / z.s;
    return { fights: z.f, winRate: z.w / Math.max(1, z.f), xpH: z.xp * h, kH: z.k * h, rH: z.r * h, iH: z.i * h, pH: z.p * h, runs: z.n, runH: z.n * h, perRun: z.n ? z.s / z.n : null };
  };
  E.zoneRate = (S, zkey) => {
    const z = S.zoneStats[zkey]; if (!z || z.s < 1) return null;
    const h = 3600 / z.s;
    return { fights: z.f, winRate: z.w / z.f, xpH: z.xp * h, kH: z.k * h, rH: z.r * h, iH: z.i * h };
  };

  /* ---------------- 3.2.2 « Confort » : temps estimé ---------------- */
  /* arrondis volontairement grossiers : on n'a pas la précision d'une minute */
  E.etaTxt = (sec) => {
    if (sec === null || sec === undefined || !isFinite(sec)) return null;
    if (sec <= 0) return "maintenant";
    if (sec < 300) return "moins de 5 min";
    if (sec < 3600) return `≈ ${Math.max(5, Math.round(sec / 300) * 5)} min`;
    if (sec < 3 * 3600) { const h2 = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 600) * 10; return m >= 60 ? `≈ ${h2 + 1} h` : m ? `≈ ${h2} h ${m} min` : `≈ ${h2} h`; }
    if (sec < 86400) return `≈ ${Math.round(sec / 3600)} h`;
    if (sec < 7 * 86400) return "plus d'une journée";
    return "plus d'une semaine";
  };
  E.ETA_MIN_FIGHTS = 5;
  /* durée moyenne d'un cycle de combat (combat + pause), en secondes, d'après les mesures de la zone en cours */
  E.fightCycle = (S) => {
    const zkey = S.dungeon ? "dg:" + S.dungeon.id : S.hunting ? S.sub : null; if (!zkey) return null;
    const z = S.zoneStats[zkey]; if (z && z.f >= E.ETA_MIN_FIGHTS) return { s: z.s / z.f, win: z.w / z.f, zkey };
    const rec = S.stats.recent; if (rec.length >= 3) return { s: rec.reduce((a, r) => a + r.d, 0) / rec.length + E.PAUSE_MS / 1000, win: rec.reduce((a, r) => a + r.w, 0) / rec.length, zkey };
    return null;
  };
  /* rythme d'obtention d'une ressource, par heure : récolte en cours et/ou chasse dans la zone en cours */
  E.resRateH = (S, name) => {
    let h = 0; const src = [];
    S.chars.forEach((c) => { if (c.job && c.job.res === name) { const per = E.gatherPeriod(S, c); if (per > 0) { h += (3600 / per) * E.hitQty(S, c); src.push("récolte"); } } });
    const sub = S.hunting && !S.dungeon && S.sub ? SUBS[S.sub] : null;
    if (sub) {
      const cyc = E.fightCycle(S);
      if (cyc) {
        const team = E.team(S).length; const grp = (1 + Math.min(8, team + 1)) / 2;
        const dm = E.dropMult(S) * E.evMult("drop") * E.PACE_REW * (E.teamHas(S, "enu") ? 1.15 : 1);
        let per = 0; const nR = E.lootRolls(S);
        sub.monsters.forEach((k) => { const m = MONSTERS[k]; if (!m) return; const d = m.drops.find(([r]) => r === name); const tq = E.huntTier(S, k) >= 1 ? 1.05 : 1;
          if (d) per += nR * Math.min(1, E.resRate(d[1]) * dm * tq / 100 / nR) / sub.monsters.length;
          (sub.dungeons || (sub.dungeon ? [sub.dungeon] : [])).forEach((did) => { if (DUNGEONS[did] && DUNGEONS[did].key === name) per += Math.min(1, DUNGEONS[did].keyDrop * E.KEY_DROP_SCALE * dm / 100) / sub.monsters.length; }); });
        if (per > 0) { h += (3600 / cyc.s) * cyc.win * grp * per; src.push(sub.name); }
      }
    }
    if (h > 0) return { h, src: src.join(" + ") };
    // nulle part dans l'activité en cours : meilleure sous-zone connue
    let best = null;
    Object.values(SUBS).forEach((s) => { if (s.hidden || !E.subUnlocked(S, s.id)) return; s.monsters.forEach((k) => { const m = MONSTERS[k]; const d = m && m.drops.find(([r]) => r === name); if (d && (!best || d[1] > best.p)) best = { p: d[1], where: s.name }; }); });
    if (!best) Object.entries(DUNGEONS).forEach(([id, dg]) => { if (dg.key === name && E.dungeonUnlocked(S, id)) best = { p: dg.keyDrop, where: SUBS[DUNGEON_SUB[id]].name }; });
    return { h: 0, where: best ? best.where : null };
  };
  /* temps avant d'avoir tous les ingrédients d'une recette : le plus lent des ingrédients manquants */
  E.needEta = (S, ing) => {
    let sec = 0, stuck = null;
    for (const [r, q] of ing) {
      const miss = q - (S.res[r] || 0); if (miss <= 0) continue;
      const rate = E.resRateH(S, r);
      if (!rate.h) { stuck = { res: r, where: rate.where }; continue; }
      sec = Math.max(sec, (miss / rate.h) * 3600);
    }
    if (stuck) return { sec: null, stuck };
    return { sec };
  };
  E.shopIng = (S, e) => e.k === "tpl" ? (ITEMS[e.id] && ITEMS[e.id].craft ? ITEMS[e.id].craft.ing : []) : e.k === "special" ? (SPECIAL_CRAFTS[e.id] ? SPECIAL_CRAFTS[e.id].ing : []) : E.toolLvl(S, e.id) < E.TOOL_MAX ? E.toolCost(S, e.id).ing : [];
  E.shopName = (S, e) => e.k === "tpl" ? (ITEMS[e.id] ? ITEMS[e.id].name : String(e.id)) : e.k === "special" ? e.id : `${E.toolCost(S, e.id).name} (${GATHER_JOBS[e.id].name})`;
  E.needEtaTxt = (S, ing) => { const e = E.needEta(S, ing); if (e.stuck) return e.stuck.where ? `${e.stuck.res} : pas dans cette zone (zone : ${e.stuck.where})` : `${e.stuck.res} : pas dans cette zone`; return e.sec === 0 ? "tout est réuni" : E.etaTxt(e.sec); };
  /* XP par heure d'un héros, d'après le rendement mesuré de la zone en cours, réparti selon la sagesse et les niveaux */
  E.heroXpH = (S, c) => {
    if (!c || c.job || !c.inTeam || c.lvl >= E.MAX_LVL) return null;
    const zkey = S.dungeon ? "dg:" + S.dungeon.id : S.hunting ? S.sub : null; if (!zkey) return null;
    const z = S.zoneStats[zkey]; if (!z || z.f < E.ETA_MIN_FIGHTS || z.xp <= 0) return null;
    const rate = E.zoneRate(S, zkey); const team = E.team(S); if (!team.find((x) => x.id === c.id)) return null;
    const ml = S.dungeon ? DUNGEONS[S.dungeon.id].lvl : SUBS[zkey] ? (SUBS[zkey].lvl[0] + SUBS[zkey].lvl[1]) / 2 : c.lvl;
    const f = (x) => (1 + E.charStats(S, x).sa / 100) * E.xpPenalty(x.lvl - ml) * E.renXpMult(x);
    const tot = team.reduce((a, x) => a + f(x), 0); if (!tot) return null;
    return rate.xpH * f(c) / tot;
  };
  E.lvlEta = (S, c, target) => {
    const xpH = E.heroXpH(S, c); if (!xpH) return null;
    const t = Math.min(E.MAX_LVL, target || c.lvl + 1); if (t <= c.lvl) return 0;
    let need = -c.xp; for (let l = c.lvl; l < t; l++) need += E.heroXpNeed(c, l);
    return Math.max(0, need / xpH * 3600);
  };

  /* ---------------- 3.2.2 : objectifs épinglés ---------------- */
  E.MAX_PINS = 3;
  E.pinKey = (p) => `${p.k}:${p.id !== undefined ? p.id : ""}:${p.cid !== undefined ? p.cid : ""}:${p.n !== undefined ? p.n : ""}`;
  /* la quête principale est toujours en tête ; les objectifs disparus (avis expiré, recette retirée) sont retirés sans message */
  E.pins = (S) => {
    S.pins = (S.pins || []).filter((p) => p && E.pinInfo(S, p));
    const out = []; if (E.questStep && E.questStep(S)) out.push({ k: "quest", auto: true });
    return out.concat(S.pins);
  };
  E.pinned = (S, p) => (S.pins || []).some((x) => E.pinKey(x) === E.pinKey(p));
  E.togglePin = (S, p) => {
    S.pins = S.pins || [];
    const i = S.pins.findIndex((x) => E.pinKey(x) === E.pinKey(p));
    if (i >= 0) { S.pins.splice(i, 1); return null; }
    if (E.pins(S).length >= E.MAX_PINS) return `${E.MAX_PINS} objectifs maximum : retirez-en un d'abord.`;
    if (p.k === "lvl") { const c = S.chars.find((x) => x.id === p.cid); if (!c) return "Héros introuvable."; p = Object.assign({ from: c.lvl + c.xp / E.heroXpNeed(c) }, p); }
    S.pins.push(p); return null;
  };
  /* progression numérique des succès qui en ont une */
  E.achProgress = (S, id) => {
    const top = Math.max(...S.chars.map((c) => c.lvl)); const cnt = S.cnt || {}; let m;
    if ((m = /^lvl(\d+)$/.exec(id))) return [top, +m[1]];
    if ((m = /^win(\d+)$/.exec(id))) return [S.stats.wins, +m[1]];
    if ((m = /^archi(\d+)$/.exec(id))) return [Object.values(S.archis).reduce((a, b) => a + b, 0), +m[1]];
    if ((m = /^champ(\d+)$/.exec(id))) return [S.champs || 0, +m[1]];
    if ((m = /^fam(\d+)$/.exec(id))) return [Object.keys(S.families).length, +m[1]];
    if ((m = /^tro(\d+)$/.exec(id))) return [Object.keys(S.trophies).length, +m[1]];
    if ((m = /^rad(\d+)$/.exec(id))) return [S.radiants || 0, +m[1]];
    if ((m = /^craft(\d+)$/.exec(id))) return [cnt.craft || 0, +m[1]];
    if ((m = /^harv(\d+)$/.exec(id))) return [cnt.harvest || 0, +m[1]];
    if ((m = /^fm(\d+)$/.exec(id))) return [cnt.fm || 0, +m[1]];
    if ((m = /^alm(\d+)$/.exec(id))) return [cnt.almanax || 0, +m[1]];
    if ((m = /^bty(\d+)$/.exec(id))) return [cnt.bounty || 0, +m[1]];
    if ((m = /^havre(\d+)$/.exec(id))) return [E.havreTotal ? E.havreTotal(S) : 0, +m[1]];
    if ((m = /^team(\d+)$/.exec(id))) return [S.chars.length, +m[1]];
    if ((m = /^dg_(.+)$/.exec(id)) && DUNGEONS[m[1]]) return [S.progress.bossKills[m[1]] ? 1 : 0, 1];
    return null;
  };
  /* état d'un objectif : libellé, progression a/b, texte, terminé, et où aller */
  E.pinInfo = (S, p) => {
    switch (p.k) {
      case "quest": { const q = E.questStep(S); if (!q) return null; const [a, b] = E.questProgress(S); return { k: "quest", label: q.title, a, b, txt: `${a}/${b}`, done: a >= b, go: { tab: "quests", qt: "main" } }; }
      case "bounty": { const bt = (S.bounties || []).find((x) => x.id === p.id); if (!bt) return null; return { k: "bounty", label: MONSTERS[bt.key].name, a: bt.prog, b: bt.n, txt: `${bt.prog}/${bt.n}`, done: bt.prog >= bt.n, go: { tab: "quests", qt: "bounty" } }; }
      case "align": { const q = S.alignQuest; if (!q) return null; return { k: "align", label: q.title, a: q.prog, b: q.n, txt: `${q.prog}/${q.n}`, done: q.prog >= q.n, go: { tab: "quests", qt: "align" } }; }
      case "shop": { const e = (S.shop || []).find((x) => x.k === p.sk && x.id === p.id); if (!e) return null; const ing = E.shopIng ? E.shopIng(S, e) : []; const ok = ing.filter(([r, q]) => (S.res[r] || 0) >= q).length;
        const eta = ing.length ? E.needEta(S, ing) : { sec: null }; return { k: "shop", label: E.shopName ? E.shopName(S, e) : String(e.id), a: ok, b: ing.length, txt: ok >= ing.length && ing.length ? "prêt" : eta.sec !== null && eta.sec !== undefined ? E.etaTxt(eta.sec) : `${ok}/${ing.length}`, done: !!ing.length && ok >= ing.length, go: { tab: "home" } }; }
      case "lvl": { const c = S.chars.find((x) => x.id === p.cid); if (!c || !p.n) return null; const cur = c.lvl + (c.lvl < E.MAX_LVL ? c.xp / E.heroXpNeed(c) : 0); const from = p.from !== undefined ? p.from : c.lvl; const eta = E.lvlEta(S, c, p.n);
        return { k: "lvl", label: `${c.name} niv. ${p.n}`, a: Math.max(0, cur - from), b: Math.max(0.01, p.n - from), txt: c.lvl >= p.n ? "atteint" : eta !== null && eta !== undefined ? E.etaTxt(eta) : `niv. ${c.lvl}`, done: c.lvl >= p.n, go: { tab: "heroes", cid: c.id } }; }
      case "ach": { const a = (E.ACH || []).find((x) => x.id === p.id); if (!a) return null; const pr = E.achProgress(S, p.id); const done = !!(S.ach || {})[p.id];
        return { k: "ach", label: a.name, a: pr ? Math.min(pr[0], pr[1]) : done ? 1 : 0, b: pr ? pr[1] : 1, txt: pr ? `${Math.min(pr[0], pr[1]).toLocaleString("fr-FR")}/${pr[1].toLocaleString("fr-FR")}` : done ? "obtenu" : "en cours", done, go: { tab: "quests", qt: "ach" } }; }
    }
    return null;
  };

  /* ---------------- 3.2.2 : « Pourquoi j'ai perdu ? » ---------------- */
  /* objets qui améliorent une caractéristique d'un héros : dans le sac, à fabriquer, à looter (jusqu'à un de chaque) */
  let DROP_IDX = null;
  const dropIndex = () => { if (DROP_IDX) return DROP_IDX; DROP_IDX = {}; for (const k in MONSTERS) (MONSTERS[k].items || []).forEach(([t, p]) => { if (!DROP_IDX[t] || DROP_IDX[t].p < p) DROP_IDX[t] = { m: k, p }; }); return DROP_IDX; };
  const slotCur = (S, c, T, stat) => {
    if (T.slot === "dofus") return null;
    if (T.slot === "anneau") { const a = S.items[c.equip.anneau1], b = S.items[c.equip.anneau2]; return Math.min(a ? a.stats[stat] || 0 : 0, b ? b.stats[stat] || 0 : 0); }
    const cur = S.items[c.equip[T.slot]]; return cur ? cur.stats[stat] || 0 : 0;
  };
  E.gearSuggest = (S, c, stat) => {
    const out = []; const used = new Set();
    // 1. déjà dans le sac (ni porté par ce héros, ni par un autre)
    let best = null;
    for (const uid in S.items) { const it = S.items[uid]; const T = ITEMS[it.tpl]; if (!T || T.lvl > c.lvl || !(it.stats[stat] > 0) || E.equippedBy(S, uid)) continue;
      const cur = slotCur(S, c, T, stat); if (cur === null) continue; const gain = it.stats[stat] - cur; if (gain > 0 && (!best || gain > best.gain)) best = { k: "bag", uid: +uid, tpl: it.tpl, gain, v: it.stats[stat] }; }
    if (best) { out.push(best); used.add(best.tpl); }
    // 2. à fabriquer
    best = null;
    for (const t in ITEMS) { const T = ITEMS[t]; if (!T.craft || T.lvl > c.lvl || T.lvl < c.lvl - 40 || used.has(t) || !T.stats[stat] || !(T.stats[stat][1] > 0)) continue;
      const cur = slotCur(S, c, T, stat); if (cur === null) continue; const gain = T.stats[stat][1] - cur; if (gain <= 0) continue;
      const miss = T.craft.ing.filter(([r, q]) => (S.res[r] || 0) < q).map(([r, q]) => [r, q - (S.res[r] || 0)]);
      const sc = gain - miss.length * 2; if (!best || sc > best.sc) best = { k: "craft", tpl: t, gain, v: T.stats[stat][1], miss, sc }; }
    if (best) { out.push(best); used.add(best.tpl); }
    // 3. à looter
    best = null; const DI = dropIndex();
    for (const t in DI) { const T = ITEMS[t]; if (!T || T.lvl > c.lvl || T.lvl < c.lvl - 40 || used.has(t) || !T.stats[stat] || !(T.stats[stat][1] > 0)) continue;
      const cur = slotCur(S, c, T, stat); if (cur === null) continue; const gain = T.stats[stat][1] - cur; if (gain <= 0) continue;
      const sc = gain * (0.5 + DI[t].p / 100); if (!best || sc > best.sc) best = { k: "loot", tpl: t, gain, v: T.stats[stat][1], m: DI[t].m, p: DI[t].p, sc }; }
    if (best) out.push(best);
    return out;
  };
  const healSpellOf = (S, c) => { for (const x of c.spells) { const d = E.spellDef(c.cls, x.id); if (d && ["heal", "drain"].includes(E.spellKind(E.spellGrade(d, c.lvl)))) return { sp: d, slot: x }; } return null; };
  E.lossReport = (S, F) => {
    const heroes = F.ents.filter((e) => e.side === "c" && !e.summon); const mons = F.ents.filter((e) => e.side === "m");
    if (!heroes.length || !mons.length) return null;
    const dinfo = F.deathInfo || []; const first = dinfo[0] || null;
    const taken = F.taken || {}; const totTaken = Object.values(taken).reduce((a, b) => a + b, 0);
    const topEl = Object.entries(taken).sort((a, b) => b[1] - a[1])[0];
    const boss = F.bossIdx !== undefined ? F.ents[F.bossIdx] : null;
    const target = boss || mons.slice().sort((a, b) => b.hpMax - a.hpMax)[0];
    const tgtPct = Math.round(Math.max(0, target.hp) / target.hpMax * 100);
    const healed = F.healed || 0;
    const team = E.team(S); const avgLvl = Math.round(team.reduce((a, c) => a + c.lvl, 0) / Math.max(1, team.length));
    const dg = F.dungeonId ? DUNGEONS[F.dungeonId] : null; const sub = !dg && F.sub ? SUBS[F.sub] : null;
    const placeLvl = dg ? dg.lvl : sub ? sub.lvl[1] : avgLvl; const placeName = dg ? dg.name : sub ? sub.name : "cette zone";
    const k = F.stasis || 0; const SI = dg ? E.stasisInfo(S, F.dungeonId) : null;
    const dealt = F.dealt || {}; const totDealt = Object.values(dealt).reduce((a, b) => a + b, 0);
    const charOf = (e) => S.chars.find((c) => c.id === e.cid);
    const R = { t: E.now(), label: F.label, round: F.round, cause: "close", txt: "", facts: [], gear: [], cid: null, stat: null, did: F.dungeonId || null, sub: F.sub || null };
    const sn = (stat) => STATS[stat].name.replace("% ", "");
    const gearTxt = (c, stat, what) => {
      const g = E.gearSuggest(S, c, stat); R.gear = g; R.cid = c.id; R.stat = stat;
      if (g[0] && g[0].k === "bag") return `équipe-lui ${ITEMS[g[0].tpl].name} de ton sac (+${g[0].gain} ${sn(stat)}).`;
      if (g[0] && g[0].k === "craft") return `fabrique-lui ${ITEMS[g[0].tpl].name} (+${g[0].gain} ${sn(stat)}${g[0].miss.length ? `, il manque ${g[0].miss.map(([r, q]) => `${q} ${r}`).join(", ")}` : ", tout est réuni"}).`;
      if (g[0] && g[0].k === "loot") return `cherche ${ITEMS[g[0].tpl].name} sur ${MONSTERS[g[0].m].name} (+${g[0].gain} ${sn(stat)}).`;
      return what;
    };
    const elDe = (el) => (/^[AEIOUÉ]/.test(ELEMENTS[el].name) ? `d'${ELEMENTS[el].name}` : `de ${ELEMENTS[el].name}`);
    // 0. (3.3.0) un héros fragile tombe tôt en première ligne alors qu'un héros plus solide est à l'arrière
    if (first && first.r <= 3 && F.ents[first.i].row === "f") {
      const c = charOf(F.ents[first.i]); const backs = heroes.filter((h) => h.row === "b").map(charOf).filter(Boolean);
      const tank = c && backs.sort((a, b) => E.tankScore(S, b) - E.tankScore(S, a))[0];
      if (c && tank && E.tankScore(S, tank) > E.tankScore(S, c) * 1.2) {
        R.cause = "row"; R.cid = c.id; R.place = true;
        R.txt = `${c.name} (${CLASSES[c.cls].name}) tombe tour ${first.r} en première ligne : passe ${c.name} à l'arrière et mets ${tank.name} devant.`;
      }
    }
    // 1. un héros tombe tôt
    if (!R.txt && first && first.r <= 3) {
      const e = F.ents[first.i]; const c = charOf(e); const ht = e.taken || {}; const hs = Object.values(ht).reduce((a, b) => a + b, 0);
      const te = Object.entries(ht).sort((a, b) => b[1] - a[1])[0];
      if (c && te && te[0] !== "n" && hs && te[1] / hs > 0.6) {
        const el = te[0]; const rk = ELEMENTS[el].res; const res = e.st[rk] || 0;
        if (res < 15) { R.cause = "res"; R.el = el; R.txt = `${c.name} meurt tour ${first.r} sous ${Math.round(te[1] / hs * 100)} % ${elDe(el)} : ${gearTxt(c, rk, `monte sa résistance ${ELEMENTS[el].name} (cape, ceinture, amulette).`)}`; }
      }
      if (!R.txt && c) { R.cause = "vit"; R.txt = `${c.name} meurt tour ${first.r} avec ${e.hpMax.toLocaleString("fr-FR")} PV : ${gearTxt(c, "vit", "mets ses points en Vitalité ou retire-le de l'équipe pour ce combat.")}`; }
    }
    // 2. soins insuffisants
    if (!R.txt) { const hl = heroes.map(charOf).filter(Boolean).map((c) => ({ c, h: healSpellOf(S, c) })).find((x) => x.h);
      if (hl && totTaken > 0 && healed < totTaken * 0.2) { R.cause = "heal"; const cond = hl.h.slot.cond;
        R.txt = `Tu perds ${totTaken.toLocaleString("fr-FR")} PV et n'en soignes que ${healed.toLocaleString("fr-FR")} : ${cond && cond !== "ally_low" && cond !== "always" ? `règle ${hl.h.sp.name} de ${hl.c.name} sur « un allié est blessé ».` : `mets ${hl.h.sp.name} en premier dans les sorts de ${hl.c.name}.`}`; R.cid = hl.c.id; } }
    // 3. pas assez de dégâts
    if (!R.txt && tgtPct > 50) { R.cause = "dmg";
      const weak = heroes.filter((e) => charOf(e) && !healSpellOf(S, charOf(e))).sort((a, b) => (a.dealt || 0) - (b.dealt || 0))[0] || heroes[0]; const c = charOf(weak);
      if (c) { const main = c.autoStat && STATS[c.autoStat] && STATS[c.autoStat].el ? c.autoStat : CLASSES[c.cls].main; const el = STATS[main] && STATS[main].el ? ELEMENTS[STATS[main].el].name : "";
        const low = (c.alloc[main] || 0) < Math.min(100, c.lvl * 3) && c.pts + (c.alloc.vit || 0) > 20;
        R.txt = `${target.name} garde ${tgtPct} % de PV au tour ${F.round} : ${low ? `${c.name} tape ${el}, mets ses points en ${STATS[main].name} plutôt qu'en Vitalité.` : gearTxt(c, main, `améliore l'arme et l'amulette de ${c.name}.`)}`; R.cid = c.id; } }
    // 4. équipe sous le niveau
    if (!R.txt && avgLvl < placeLvl - 3) { R.cause = "lvl"; const cand = E.autoZoneTarget(S); const best = cand && cand.find((s) => s.id !== F.sub);
      R.txt = `Ton équipe est niveau ${avgLvl}, ${placeName} demande ${placeLvl} : farme encore un peu${best ? ` en ${best.name}` : ""}.`; }
    // 5. stasis trop haute
    if (!R.txt && dg && k > 1 && SI && SI.max >= k - 1) { R.cause = "stasis"; const mods = (S.dungeon && S.dungeon.mods) || F.mods || [];
      R.txt = `Tu réussis en stasis ${k - 1} mais pas en ${k} : redescends d'un cran${mods.length ? ` ou retente sans « ${E.STASIS_MODS[mods[0]].name} »` : ""}.`; }
    // 6. mauvaise cible
    if (!R.txt && boss && totDealt > 0 && (dealt[F.bossIdx] || 0) / totDealt < 0.3) { R.cause = "target"; const c = charOf(heroes.slice().sort((a, b) => (b.dealt || 0) - (a.dealt || 0))[0]);
      R.txt = `Tes sorts visent le plus proche, ${boss.name} reste derrière : règle ${c ? c.name : "tes héros"} sur « Boss / le plus fort d'abord ».`; if (c) R.cid = c.id; }
    if (!R.txt) R.txt = `C'était serré au tour ${F.round} : réessaie, ${target.name} n'avait plus que ${tgtPct} % de PV.`;
    // faits
    if (first) { const by = first.by >= 0 ? F.ents[first.by] : null; R.facts.push({ k: "killer", txt: `${F.ents[first.i].name} tombe tour ${first.r}${by ? ` (${by.name})` : ""}` }); }
    if (topEl && totTaken) R.facts.push({ k: "el", txt: `Élément subi : ${ELEMENTS[topEl[0]].name} ${Math.round(topEl[1] / totTaken * 100)} %` });
    R.facts.push({ k: "hp", txt: `PV perdus : ${totTaken.toLocaleString("fr-FR")}` });
    if (R.cause === "row") R.facts.push({ k: "row", txt: `Première ligne : ${heroes.filter((h) => h.row === "f").map((h) => h.name).join(", ")}` });
    if (totTaken) R.facts.push({ k: "heal", txt: `Soins : ${healed.toLocaleString("fr-FR")}` });
    const zkey = F.dungeonId ? "dg:" + F.dungeonId : F.sub; let streak = 1; for (const hrow of S.history) { if (hrow.z !== zkey) break; if (hrow.w) break; streak++; }
    if (streak >= 2) R.facts.push({ k: "streak", txt: `Défaite ${streak} fois de suite ici` });
    R.tgt = { name: target.name, pct: tgtPct };
    return R;
  };

  /* Challenges : bonus des challenges réussis + série (+1 % par succès consécutif, max +10 %) */
  E.CHAL_STREAK_STEP = 1; E.CHAL_STREAK_MAX = 10;
  E.chalResolve = (S, F, lost) => {
    const L = F.chals || []; if (!L.length) return 0;
    S.chalStats = S.chalStats || {}; let sum = 0, allOk = true;
    L.forEach((c) => {
      if (c.id === "rapide" && F.round > c.turns) { c.ok = false; c.why = c.why || "trop de tours"; }
      if (lost) c.ok = false;
      const st = S.chalStats[c.id] = S.chalStats[c.id] || { n: 0, ok: 0 }; st.n++;
      if (c.ok) { st.ok++; sum += c.bonus; } else allOk = false;
    });
    if (allOk) S.chalStreak = (S.chalStreak || 0) + 1; else S.chalStreak = 0;
    if (!sum) return 0;
    const streak = Math.min(E.CHAL_STREAK_MAX, Math.max(0, (S.chalStreak - 1)) * E.CHAL_STREAK_STEP);
    const tot = Math.round((sum + streak) * E.almMult(S, "chal")); // 0.1.39 : Almanax « Challenges augmentés »
    flog(F, `Challenge${L.filter((c) => c.ok).length > 1 ? "s" : ""} réussi${L.filter((c) => c.ok).length > 1 ? "s" : ""} : +${tot} % XP et butin${streak ? ` (série ${S.chalStreak})` : ""}`, "win");
    return tot;
  };
  /* Progression auto : suit le niveau de l'équipe (option « Suivre mon niveau ») */
  /* 0.1.34 : on vise les zones dont le milieu est au niveau moyen de l'équipe (avant : niveau minimum ≤ niveau moyen + 1, la plus haute,
     soit des monstres jusqu'à 25 niveaux au-dessus), sans celles où l'équipe perd souvent ces derniers temps */
  E.subMid = (s) => (s.lvl[0] + Math.min(200, s.lvl[1])) / 2;
  E.autoZoneTarget = (S) => {
    const team = E.team(S); if (!team.length) return null;
    const avg = team.reduce((s, c) => s + c.lvl, 0) / team.length;
    const open = Object.values(SUBS).filter((s) => !s.hidden && E.subUnlocked(S, s.id) && !((E.zoneDiff(S, s.id) || {}).k === "hard" && s.id !== S.sub));
    let cand = open.filter((s) => E.subMid(s) <= avg);
    if (!cand.length) cand = open.sort((a, b) => E.subMid(a) - E.subMid(b)).slice(0, 1);
    if (!cand.length) return null;
    cand.sort((a, b) => E.subMid(b) - E.subMid(a));
    return cand;
  };
  E.autoZone = (S, win) => {
    if (!S.settings || !(S.settings.autoZone || S.settings.roam) || S.dungeon || !S.hunting || !S.sub) return; // l'itinérante redescend aussi après 3 défaites sur 6
    S._az = (S._az || 0) + 1;
    const rec = S.stats.recent.slice(-6); const losses = rec.filter((r) => !r.w).length;
    const cand = E.autoZoneTarget(S); if (!cand) return;
    const cur = SUBS[S.sub]; let target = null;
    if (!win && losses >= 3) { // trop dur : on redescend
      target = cand.find((s) => E.subMid(s) < E.subMid(cur));
    } else if (S.settings.autoZone && win && S._az >= 12 && losses === 0) { // tout va bien : on monte si possible
      const best = cand[0];
      if (best && E.subMid(best) > E.subMid(cur)) target = best;
    }
    if (!target || target.id === S.sub) return;
    S._az = 0; S.stats.recent.length = 0;
    E.startHunt(S, target.id);
    note(S, `Progression auto : ${target.name} (niv. ${target.lvl[0]}-${target.lvl[1]})`, "up");
  };

  /* Coffre de boss : un objet garanti des monstres du donjon (niveau proche du boss) */
  E.stasisChest = (k) => (k >= 10 ? "coffre_obsidienne" : k >= 7 ? "coffre_or" : k >= 4 ? "coffre_argent" : "coffre_bois"); // 0.1.30
  E.bossChest = (S, did, rew) => {
    const dg = DUNGEONS[did]; const pool = new Set();
    [dg.boss, ...dg.rooms.flatMap((r) => r.mobs)].forEach((k) => (MONSTERS[k].items || []).forEach(([t]) => { if (ITEMS[t] && ITEMS[t].lvl <= dg.lvl + 5 && ITEMS[t].lvl >= dg.lvl - 25) pool.add(t); }));
    const arr = [...pool]; if (!arr.length) return;
    const tpl = pick(arr); const it = E.rollItem(S, tpl, {});
    note(S, `Butin du boss : ${ITEMS[tpl].name} !`, "rare");
    if (rew) rew.items.push(it.uid);
  };

  /* ---------------- Donjons ---------------- */
  E.POUSSIERE = "Poussière de stasis";
  E.stasisClear = (S, D2, rew) => {
    const did = D2.id; const k = D2.stasis || 1; const SI = E.stasisInfo(S, did); const stat = E.dungeonScrollStat(did);
    const out = [];
    const dust = Math.round((k * 2 + (k >= 4 ? 4 : 0)) * (k >= 11 ? 2 : 1) * (D2.weekly ? E.WEEKLY_DUST : 1) * (D2.flash ? E.FLASH_DUST : 1)); addRes(S, E.POUSSIERE, dust); out.push(`${dust} ${E.POUSSIERE}`);
    if (!SI.firsts[k]) { SI.firsts[k] = E.now();
      const chest = E.stasisChest(k); E.addCons(S, chest, 1); out.push(`premier passage : ${CONSUMABLES[chest].name}`);
      if (E.firstPassStones) E.firstPassStones(S, k, out); // 0.1.13 : Pierres d'âme
      E.celebrate({ t: "stasis", did, k, chest });
      if (k === 10) { let n = 0; E.team(S).forEach((c) => { c.stasisScrolls = c.stasisScrolls || {}; if (!c.stasisScrolls[did]) { c.stasisScrolls[did] = 1; n++; } });
        if (n) { E.addCons(S, "parch_" + stat + "_g", n); out.push(`${n} × ${CONSUMABLES["parch_" + stat + "_g"].name}`); } }
    }
    if (k >= 6 && rnd() < 0.01 + (k - 6) * 0.005) { E.addCons(S, "parch_" + stat + "_p", 1); out.push(CONSUMABLES["parch_" + stat + "_p"].name); note(S, `Butin rare : ${CONSUMABLES["parch_" + stat + "_p"].name} !`, "rare"); }
    if (k >= (E.TROPHY_STASIS || 5) && E.trophyOf && E.giveFurn) { const tr = E.trophyOf(did); if (tr && E.giveFurn(S, tr, "trophée de boss")) out.push(tr); }
    E.petBoss(S, did, k, out); // familiers rares et montiliers
    E.exoDrop(S, DUNGEONS[did].lvl, k, out); // 0.1.9.1 : runes exotiques
    if (E.dofusDrop) E.dofusDrop(S, did, k, out); // 0.1.13 : Dofus en butin très rare du boss
    if (k > SI.max) { SI.max = k; if (k < E.STASIS_MAX) note(S, `${DUNGEONS[did].name} : stasis ${k + 1} débloquée !`, "up"); }
    if (E.MT_GATES) E.MT_GATES.forEach((G) => { if (G.did === did && k >= G.s && !(S.mtGates || []).includes(G.b)) { (S.mtGates = S.mtGates || []).push(G.b); E.mtGateSync(S); note(S, `Porte des étoiles ouverte : ${G.b} ! Deux branches lointaines s'ouvrent dans la Maîtrise de tous tes héros.`, "rare"); } }); // 2.1
    const t = Math.round(D2.t || 0); if (!SI.best[k] || t < SI.best[k]) SI.best[k] = t;
    if (SI.sz !== E.STASIS_SAISON) { SI.sz = E.STASIS_SAISON; SI.sk = 0; SI.st = 0; } // saison des sorts des boss
    if (k > (SI.sk || 0)) { SI.sk = k; SI.st = t; } else if (k === SI.sk && t > 0 && (!SI.st || t < SI.st)) SI.st = t;
    if (k >= 10) S.unlocks.stasis10 = true;
    if (k >= 15) { S.unlocks.stasis15 = true; S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(E.STASIS15_TITLE)) { S.titlesExtra.push(E.STASIS15_TITLE); note(S, `Stasis 15 : titre « ${E.STASIS15_TITLE} » !`, "rare"); } }
    note(S, `Stasis ${k} terminée : ${out.join(", ")}.`, "rare");
    if (rew) rew.stasis = { k, out, dust };
  };
  /* 1.0.32.3 : résumé de fin de montée de stasis (stasis de départ, dernière stasis réussie) */
  const climbEnd = (S, D2, full, lost) => {
    const name = DUNGEONS[D2.id] ? DUNGEONS[D2.id].name : "Donjon"; const k0 = D2.k0 || D2.stasis || 1; const last = lost ? (D2.stasis || 1) - 1 : D2.stasis || 1;
    if (full && last >= D2.climb) note(S, `Montée réussie : ${name}, stasis ${k0} à ${last} enchaînées sans t'arrêter !`, "rare");
    else note(S, `Montée de stasis arrêtée : ${name}, ${last >= k0 ? `stasis ${k0} à ${last} réussies` : "aucune stasis réussie"}${lost ? `, défaite en stasis ${D2.stasis || 1}` : ""}.`, "warn");
  };
  E.enterDungeon = (S, did, stasis, chain, climb) => {
    const dg = DUNGEONS[did]; if (!dg) return "Donjon inconnu.";
    const SI = E.stasisInfo(S, did); const k = clamp(stasis || SI.sel || 1, 1, E.STASIS_MAX);
    if (k > SI.max + 1) return `Stasis ${k} verrouillée : terminez d'abord la stasis ${SI.max + 1}.`;
    if (!E.dungeonUnlocked(S, did)) return "Donjon verrouillé.";
    if (S.dungeon) return "Vous êtes déjà en donjon.";
    if (E.expActive && E.expActive(S)) return "L'équipe est dans le Songe infini : réveille-la d'abord (Aventure › Songe infini).";
    if ((S.res[dg.key] || 0) < 1) return `Il vous faut : ${dg.key}.`;
    S.res[dg.key]--; if (!S.res[dg.key]) delete S.res[dg.key];
    const W = E.weekly(S); const FL = W && W.did === did ? null : E.flashOf(S, did); const wk = W && W.did === did ? W.mod : FL ? FL.mod : null;
    S.dungeon = { id: did, room: 0, stasis: k, chain: chain || 1, tot: chain || 1, run: 1, t: 0, syncLvl: Math.round(E.team(S).reduce((a, c) => a + c.lvl, 0) / Math.max(1, E.team(S).length)),
      mods: k >= 12 ? pickMods(3, wk) : k >= 7 ? pickMods(2, wk) : k >= 6 ? pickMods(1, wk) : wk ? [wk] : [], weekly: W && W.did === did ? wk : undefined, flash: FL ? FL.mod : undefined, eliteRoom: k >= 5 ? Math.floor(dg.rooms.length / 2) : -1 };
    if (climb > 0) { S.dungeon.climb = Math.min(E.STASIS_MAX, climb); S.dungeon.k0 = k; } // 1.0.32.3 : montée de stasis
    SI.sel = k;
    S.fight = null; S.pause = 0;
    E.applyZonePresets(S, "dg:" + did);
    note(S, `Entrée dans ${dg.name}.`, "info");
    return null;
  };
  /* 0.1.37.1 : « Arrêter après celui-ci » : le donjon en cours va jusqu'au bout, puis l'enchaînement s'arrête */
  E.stopChain = (S) => {
    if (!S.dungeon || (S.dungeon.chain || 1) <= 1) return "Aucun enchaînement en cours.";
    S.dungeon.chain = 1; note(S, "Enchaînement : ce donjon sera le dernier.", "info");
  };
  E.leaveDungeon = (S) => { if (S.dungeon) { note(S, "Vous quittez le donjon (clé perdue).", "warn"); S.dungeon = null; S.fight = null; if (S.hunting && S.sub) E.applyZonePresets(S, S.sub); } };

  /* ---------------- Boucle principale ---------------- */
  E.STEP_MS = 780; // 0.1.3-0.1.4 : combats plus posés (520 ms avant)
  E.PACE_REW = 780 / 520; // compense : les gains par heure restent les mêmes qu'avec 520 ms
  E.PAUSE_MS = 1400;
  E.tick = (S, dtMs, realMs) => {
    if (bagChk) E.bagFlush(S); // 0.1.37 : objets en trop vers le trop-plein
    if (S.caracsUid !== S.nextUid) E.caracsMigrate(S, S.caracsUid || 0); // 1.0.30 : objets arrivés d'ailleurs (HdV) sans les nouvelles lignes
    S.stats.playtime += (realMs == null ? dtMs : realMs) / 1000; // 0.1.29 : le temps de jeu reste le vrai temps, même en vitesse ×2 / ×3
    const sp = 1;
    // combat
    S.acc = (S.acc || 0) + dtMs * sp;
    let guard = 0;
    while (S.acc >= E.STEP_MS && guard++ < 200) {
      S.acc -= E.STEP_MS;
      if (!S.fight || S.fight.over) {
        if (!S.dungeon && !S.hunting && !(E.expBusy && E.expBusy(S))) { S.acc = 0; break; }
        S.pause = (S.pause || 0) + E.STEP_MS;
        if (S.pause >= E.PAUSE_MS) { S.pause = 0; const F0 = E.startFight(S); if (F0 && !F0.exp && E.chromaRoll) { E.chromaRoll(S, F0.ents); F0.cr = 1; } } // 1.0.33 : chromatiques
        continue;
      }
      S.fight.dur += E.STEP_MS / 1000;
      E.step(S);
    }
    E.starsTick(S, dtMs / 1000);
    if (E.expTick) E.expTick(S); // 0.1.24 : choix automatiques de l'expédition
    // récolte
    gatherTick(S, dtMs / 1000);
    E.protExpire(S);
    E.atelierTick(S, dtMs / 1000);
    E.fmPlanTick(S, dtMs / 1000);
    E.petTick(S, dtMs);
    E.enclosTick(S, dtMs * E.almMult(S, "enclos")); // 0.1.39 : Almanax « Efficacité des enclos »
  };

  /* ---------------- Récolte (v2.6) ----------------
     Un héros fait une seule activité : chasser (dans l'équipe) OU récolter dans une sous-zone.
     Les niveaux de métier sont communs au compte ; plusieurs héros peuvent exercer le même métier. */
  const HARVEST = {};
  for (const sid in D.HARVEST || {}) { const seen = new Set(); HARVEST[sid] = D.HARVEST[sid].filter((x) => { const k = x[0] + "|" + x[1]; if (seen.has(k)) return false; seen.add(k); return true; }); }
  E.HARVEST = HARVEST;
  E.harvestJobs = (sid) => [...new Set((HARVEST[sid] || []).map((x) => x[1]))];
  E.harvestList = (sid, job) => (HARVEST[sid] || []).filter((x) => x[1] === job);
  E.gatherTime = (lvl) => 8 / (1 + lvl * 0.025);
  /* passif de métier : seulement pour le héros qui récolte lui-même */
  E.gatherMult = (S, job, c) => (c && c.cls === "sadi" && (job === "bucheron" || job === "alchimiste") ? 0.8 : 1) * (c && c.cls === "steam" && job === "pecheur" ? 0.75 : 1);
  /* ---- Outils : vraies recettes (ressources de plusieurs métiers + ressources de monstres + composants rares) ---- */
  E.TOOL_MAX = 10;
  E.TOOL_NAMES = { paysan: "Faux", bucheron: "Hache", mineur: "Pioche", alchimiste: "Serpe", pecheur: "Canne" };
  E.RARE_COMPONENT = "Éclat de trouvaille";
  E.toolLvl = (S, job) => (S.tools && S.tools[job]) || 0;
  const MON_RES = (() => { const m = new Map(); for (const k in MONSTERS) { const mo = MONSTERS[k]; if (mo.boss || mo.archiOf) continue; mo.drops.forEach(([r, p]) => { if (p >= 8 && !E.isKey(r)) m.set(r, Math.min(m.get(r) || 999, mo.lvl[0])); }); } return [...m.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])); })();
  const hsh = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; };
  E.toolRecipe = (job, L) => { // recette pour passer l'outil au niveau L (1..10)
    const own = GATHER_JOBS[job].items; const tier = (j) => GATHER_JOBS[j].items[Math.min(GATHER_JOBS[j].items.length - 1, Math.floor((L - 1) / 2))][0];
    const other = job === "bucheron" ? "mineur" : "bucheron";
    const pool = MON_RES.filter(([, l]) => Math.abs(l - L * 6) <= 8); const mr = (pool.length ? pool : MON_RES)[Math.floor(hsh(job + L) * (pool.length || MON_RES.length))][0];
    const ing = [[tier(job), 10 + L * 8], [tier(other), 6 + L * 5], [mr, 4 + L * 3]];
    if (L >= 5) ing.push([E.RARE_COMPONENT, (L - 4) * 2]);
    const matTier = own[Math.min(own.length - 1, Math.floor((L - 1) / 2))][0];
    return { name: `${E.TOOL_NAMES[job]} ${L}`, mat: matTier, lvl: Math.max(1, (L - 1) * 8), kamas: Math.round(200 * Math.pow(1.9, L - 1)), ing };
  };
  E.toolCost = (S, job) => E.toolRecipe(job, E.toolLvl(S, job) + 1);
  E.upgradeTool = (S, job) => {
    const l = E.toolLvl(S, job); if (l >= E.TOOL_MAX) return "Outil au niveau maximum.";
    const R = E.toolRecipe(job, l + 1);
    if (S.jobs[job].lvl < R.lvl) return `${GATHER_JOBS[job].name} niveau ${R.lvl} requis.`;
    if (S.kamas < R.kamas) return `Il faut ${R.kamas} kamas.`;
    const miss = R.ing.filter(([r, q]) => (S.res[r] || 0) < q); if (miss.length) return `Il manque : ${miss.map(([r, q]) => `${q - (S.res[r] || 0)} × ${r}`).join(", ")}.`;
    S.kamas -= R.kamas; R.ing.forEach(([r, q]) => { S.res[r] -= q; if (!S.res[r]) delete S.res[r]; });
    S.tools[job] = l + 1; note(S, `Outil fabriqué : ${R.name} (${GATHER_JOBS[job].name}).`, "up"); E.emit(S, "tool", { job }); return null;
  };
  E.gatherSpeed = (S, job, c) => (1 + E.toolLvl(S, job) * 0.08) * (1 + E.bonus(S, "gather") / 100) / E.gatherMult(S, job, c);
  /* 1.0.8.6 « Coups de récolte longs » (Mathis) : un coup dure E.HIT_S secondes (de lo au niveau 1 à hi au niveau 200).
     La production par heure ne change pas : le niveau, l'outil et les bonus donnent plus de ressources par coup.
     E.basePeriod = l'ancien rythme d'une récolte, qui sert de mesure (un coup vaut hitScale récoltes de l'ancien rythme). */
  E.HIT_S = { lo: 30, hi: 30 };
  E.basePeriod = (S, c) => { const j = c.job; return j ? E.gatherTime(S.jobs[j.job].lvl) / E.gatherSpeed(S, j.job, c) : 0; };
  E.gatherPeriod = (S, c) => { const j = c.job; if (!j) return 0; const L = Math.min(200, Math.max(1, S.jobs[j.job].lvl)); return E.HIT_S.lo + (E.HIT_S.hi - E.HIT_S.lo) * (L - 1) / 199; };
  E.hitScale = (S, c) => { const b = E.basePeriod(S, c); return b > 0 ? E.gatherPeriod(S, c) / b : 0; };
  /* ressources attendues à la fin du coup (affichage) */
  E.hitQty = (S, c) => { if (!c.job) return 0; const L = S.jobs[c.job.job].lvl; return E.hitScale(S, c) * (1 + L / 200) * (1 + 4 * E.FIND_CHANCE) * E.gatherYield(L) * E.almMult(S, "gather", c.job.job) * (E.filonOn(S, c.job.res) ? 2 : 1) * E.protMult(S, c.job.res); };
  E.FIND_CHANCE = 0.01;
  /* 1.0.7.9 : rendement de la récolte, part des ressources gardées à chaque coup selon le niveau du métier
     (35 % au niveau 1, 10 % au niveau 200). L'XP de métier par coup baisse dans la même proportion. */
  E.YIELD = { lo: 0.35, hi: 0.1, from: 150, top: 1.53 };
  /* 1.0.12.x : au-delà du niveau 150 la baisse linéaire du rendement faisait baisser la quantité par coup (5,3 → 4,7 sans outil).
     Du niveau 150 au 200, la quantité par coup (∝ rythme × quantité × rendement) monte maintenant en ligne droite jusqu'à top
     au niveau 200 (≈ 6 par coup de 30 s sans outil). En dessous de 150 : inchangé. */
  const yLin = (L) => E.YIELD.lo + (E.YIELD.hi - E.YIELD.lo) * L / 200;
  const yBase = (L) => (1 + L * 0.025) * (1 + L / 200); // rythme (E.gatherTime) × quantité moyenne par récolte
  E.gatherYield = (lvl) => {
    const L = Math.min(200, Math.max(1, lvl)), F = E.YIELD.from; if (L <= F) return yLin(L);
    const a = yBase(F) * yLin(F); return (a + (E.YIELD.top - a) * (L - F) / (200 - F)) / yBase(L);
  };
  E.jobRes = (job) => GATHER_JOBS[job].items; // [[ressource, niveau]]
  E.setJob = (S, cid, job, res) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (S.dungeon && c.inTeam && !c.job) return "Impossible pendant un donjon.";
    if (E.expActive && E.expActive(S) && c.inTeam && !c.job) return "Impossible pendant une expédition.";
    if (!job) {
      if (c.job) {
        E.gatherPartial(S, c); c.job = null; S.fight = S.dungeon ? S.fight : null;
        if (c.inTeam && E.activeCount(S, c) >= E.TEAM_MAX) { c.inTeam = false; note(S, `${c.name} revient au repos : l'équipe est complète (8 héros).`, "info"); }
        else note(S, `${c.name} revient chasser.`, "info");
      }
      return null;
    }
    const list = E.jobRes(job); const lvl = S.jobs[job].lvl;
    const pickRes = res && list.find((x) => x[0] === res && x[1] <= lvl) ? res : (list.filter((x) => x[1] <= lvl).pop() || [])[0];
    if (!pickRes) return "Ressource verrouillée.";
    const was = !!c.job; if (was) E.gatherPartial(S, c); c.job = { job, res: pickRes, prog: 0 };
    if (!was) S.fight = S.dungeon ? S.fight : null;
    note(S, `${c.name} récolte : ${pickRes}.`, "info");
    return null;
  };
  /* Filons rares : en moyenne un toutes les 2 h de récolte, 10 min, rendement ×2 sur une ressource */
  E.FILON_EVERY_S = 7200; E.FILON_DUR_S = 600;
  E.filonOn = (S, res, at = E.now()) => !!(S.filon && S.filon.res === res && S.filon.until > at);
  /* 1.0.7.8 (Mathis) : plus de bulles pour la récolte (filon, trouvaille, niveau de métier) : tout reste écrit dans le journal */
  /* un coup (ou la part frac d'un coup quand le héros est rappelé) : k récoltes de l'ancien rythme d'un seul bloc */
  const gatherHit = (S, c, frac, opts = {}) => {
    const W = c.job; const J = S.jobs[W.job]; const def = E.jobRes(W.job).find((x) => x[0] === W.res); if (!J || !def || def[1] > J.lvl) return 0;
    const t = E.gatherPeriod(S, c), k = E.hitScale(S, c) * frac, y = E.gatherYield(J.lvl);
    if (k <= 0) return 0;
    if (frac >= 1 && !opts.quiet && !(S.filon && S.filon.until > E.now()) && rnd() < t / E.FILON_EVERY_S * E.almMult(S, "filon")) { S.filon = { res: W.res, until: E.now() + E.FILON_DUR_S * 1000 }; note(S, `Un filon de ${W.res} est apparu ! Rendement ×2 pendant 10 minutes.`, "info"); }
    const fe = k * E.FIND_CHANCE; const finds = Math.floor(fe) + (rnd() < fe - Math.floor(fe) ? 1 : 0); // trouvailles : même fréquence par heure qu'avant
    let v = (k + 4 * finds) * (1 + J.lvl / 200) * y * E.almMult(S, "gather", W.job); // Almanax « Récolte abondante »
    if (E.mtOwn) v *= E.mtOwn(S, c, "rec"); // 2.1 : Artisan (récolte)
    if (E.filonOn(S, W.res)) v *= 2;
    v *= E.protMult(S, W.res); // 0.1.10.1 : protecteur vaincu, récolte ×2
    v *= E.sabLoot(); // 2.1.22 : Sablier ×2 / ×3
    if (frac >= 1 && !opts.quiet) E.protSpawn(S, c, W, k);
    let q = Math.floor(v); if (rnd() < v - q) q++;
    if (finds) { q = Math.max(1, q); S.finds = (S.finds || 0) + finds; for (let i = 0; i < finds; i++) if (rnd() < 0.6) addRes(S, E.RARE_COMPONENT, 1); if (!opts.quiet) note(S, `Trouvaille ! ${c.name} déniche ${q} × ${W.res}.`, "info"); }
    if (q) addRes(S, W.res, q);
    J.xp += (10 + def[1] * 1.0) * y * k * (E.mtOwn ? E.mtOwn(S, c, "xpj") : 1); // 2.1 : Artisan (XP de métier)
    while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; if (J.lvl % 5 === 0 || GATHER_JOBS[W.job].items.some((x) => x[1] === J.lvl)) note(S, `${GATHER_JOBS[W.job].name} niveau ${J.lvl}`, "info"); E.emit(S, "joblvl", { job: W.job, lvl: J.lvl }); }
    if (q) E.emit(S, "harvest", { res: W.res, n: q }); // compte les ressources récoltées (quêtes, succès)
    return q;
  };
  /* 6A : héros rappelé ou changé de ressource en plein coup : il rapporte la part du coup déjà faite */
  E.gatherPartial = (S, c) => { const W = c && c.job; if (!W) return 0; const t = E.gatherPeriod(S, c); const f = t > 0 ? Math.min(1, W.prog / t) : 0; W.prog = 0; return f > 0 ? gatherHit(S, c, f, { quiet: true }) : 0; };
  const gatherTick = (S, dt, opts = {}) => {
    let total = 0;
    S.chars.forEach((c) => {
      const W = c.job; if (!W) return; const J = S.jobs[W.job]; if (!J) { c.job = null; return; }
      const def = E.jobRes(W.job).find((x) => x[0] === W.res); if (!def || def[1] > J.lvl) return;
      W.prog += dt;
      let n = 0;
      while (W.prog >= E.gatherPeriod(S, c) && n < 200000) { W.prog -= E.gatherPeriod(S, c); n++; total += gatherHit(S, c, 1, opts); }
    });
    return total;
  };
  E.gatherTick = gatherTick;

  /* ---------------- Artisanat ---------------- */
  /* 1.0.19 « Métiers comme dans DOFUS » : un objet se fabrique avec le métier à son niveau (0.1.14.4 à 1.0.16 : au tiers de son niveau).
     Même effort qu'avant pour chaque objet : environ 3 fabrications par niveau (E.CRAFT_STEP), et les niveaux déjà gagnés sont convertis (E.deserialize). */
  E.craftReq = (tpl) => Math.max(1, ITEMS[tpl].lvl);
  E.canCraft = (S, recipe, n = 1) => recipe.ing.every(([r, q]) => (S.res[r] || 0) >= q * n);
  /* 0.1.39 : Almanax « Économie d'ingrédients », une part des ingrédients rendue */
  const almSave = (S, q) => { const p = E.almMult(S, "eco"); return p > 0 && p < 1 ? Math.min(q, E.almQty(q, p)) : 0; };
  /* 1.0.4.3 : sac plein → l'objet fabriqué part dans le trop-plein (avant : bouton « Fabriquer » grisé sans explication) */
  const overLen = (S) => (Array.isArray(S.over) ? S.over.length : 0);
  E.craftRoom = (S) => Math.max(0, E.itemCap(S) - E.itemCount(S)) + Math.max(0, E.overCap(S) - overLen(S));
  const craftStow = (S, it) => {
    if (E.itemCount(S) <= E.itemCap(S)) return;
    if (!Array.isArray(S.over)) S.over = [];
    delete S.items[it.uid]; S.over.push(Object.assign({}, it, { at: E.now() })); S.overNew = (S.overNew || 0) + 1;
  };
  /* 1.0.9.2 « Recettes trop faciles » : XP pleine jusqu'à full niveaux sous la recette la plus haute que le métier sait faire,
     puis elle baisse jusqu'à 1 XP à end niveaux d'écart, comme dans DOFUS. Clés et alliages compris.
     1.0.19 : les métiers d'objets comptent en niveaux d'objet (30 et 90, la même règle qu'avant) ; le Bricoleur garde 10 et 30. */
  E.CRAFT_FALL = { full: 30, end: 90 };
  E.CRAFT_FALL_BRICO = { full: 10, end: 30 };
  E.craftFall = (job) => (job === "bricoleur" ? E.CRAFT_FALL_BRICO : E.CRAFT_FALL);
  const CRAFT_TOP = {};
  E.craftTop = (job) => { // niveau de métier de la recette la plus haute du métier (200 pour les métiers d'objets, 100 pour le Bricoleur)
    if (CRAFT_TOP[job]) return CRAFT_TOP[job]; let m = 1;
    for (const id in ITEMS) if (ITEMS[id].craft && ITEMS[id].craft.job === job) m = Math.max(m, E.craftReq(id));
    /* 1.0.12.4 : recettes refaisables seulement (avant : le Coffre en merisier, meuble unique niveau 120, mettait la référence du Bricoleur à 120,
       et passé le niveau 120 les alliages du niveau 100 ne valaient plus que la moitié, tout le reste 1 XP) */
    for (const n in SPECIAL_CRAFTS) { const R = SPECIAL_CRAFTS[n]; if (R.job === job && !R.unique && !R.dofus && !R.idol) m = Math.max(m, R.lvl); }
    return (CRAFT_TOP[job] = m);
  };
  E.craftXpMult = (S, job, req) => {
    const F = E.craftFall(job), J = S.crafts[job]; const gap = Math.min(J ? J.lvl : 1, E.craftTop(job)) - req;
    return gap <= F.full ? 1 : gap >= F.end ? 0 : 1 - (gap - F.full) / (F.end - F.full);
  };
  /* « Artisanat haut niveau » : la fabrication de la recette la plus haute que tu sais faire vaut au moins 1/E.craftStep(job) de niveau
     (avant : l'XP plafonnait à 612 au niveau 66 du métier, soit 33 fabrications d'objets niveau 197 par niveau au 66 et 182 au 199)
     1.0.19 : 3 par niveau pour les métiers d'objets (métier 200 en ~660 fabrications, autant qu'avant pour le métier 66), 10 pour le Bricoleur (inchangé) */
  E.CRAFT_STEP = 3;
  E.CRAFT_STEP_BRICO = 10;
  E.craftStep = (job) => (job === "bricoleur" ? E.CRAFT_STEP_BRICO : E.CRAFT_STEP);
  const CRAFT_TOPXP = {};
  E.craftTopXp = (job, lvl) => { // XP de base de la recette la plus haute faisable à ce niveau de métier (recettes refaisables)
    const c = CRAFT_TOPXP[job] || (CRAFT_TOPXP[job] = []); if (c[lvl]) return c[lvl]; let m = 1;
    for (const id in ITEMS) { const T = ITEMS[id]; if (T.craft && T.craft.job === job && E.craftReq(id) <= lvl) m = Math.max(m, 12 + T.lvl * 3); }
    for (const n in SPECIAL_CRAFTS) { const R = SPECIAL_CRAFTS[n]; if (R.job === job && R.lvl <= lvl && !R.unique && !R.dofus && !R.idol) m = Math.max(m, 20 + R.lvl * 3); }
    return (c[lvl] = m);
  };
  E.craftBoost = (S, job) => { const J = S.crafts[job], L = J ? J.lvl : 1; return L >= 200 ? 1 : Math.max(1, E.jobXpNeed(L) / (E.craftStep(job) * E.craftTopXp(job, L))); };
  /* 1.0.25 « Renaissance des métiers » : un métier d'artisanat au niveau 200 peut renaître (js/systems.js, E.jobRenaissance).
     Chaque renaissance donne +30 % d'XP de fabrication et relève le plancher des jets : aucune caractéristique sous 10 % de sa
     fourchette par renaissance, jets parfaits à la dixième (choix de Mathis 1A 2A). */
  E.JOB_REN_MAX = 10; E.JOB_REN_XP = 0.3;
  E.craftRen = (S, job) => Math.max(0, Math.min(E.JOB_REN_MAX, (S.crafts && S.crafts[job] && S.crafts[job].ren) || 0));
  E.craftRenFloor = (S, job) => Math.min(1, E.craftRen(S, job) / E.JOB_REN_MAX);
  E.craftXpOf = (S, job, req, base) => Math.max(1, Math.round(base * E.craftXpMult(S, job, req) * E.craftBoost(S, job) * (1 + E.JOB_REN_XP * E.craftRen(S, job))));
  /* les options de jet d'un objet fabriqué : le plancher de la renaissance, ou celui du Galet s'il est plus haut */
  const craftRoll = (S, job, roll) => { const f = E.craftRenFloor(S, job); if (!f) return roll || {}; const o = Object.assign({}, roll || {}); o.floor = Math.max(o.floor || 0, f); return o; };
  E.galetFx = () => "Galet inconnu."; // 1.0.6 : bonus d'un Galet ajouté à la fabrication (js/koli.js)
  E.craftItem = (S, tpl, galet) => {
    const T = ITEMS[tpl]; if (!T || !T.craft) return "Recette inconnue.";
    const J = S.crafts[T.craft.job];
    if (J.lvl < E.craftReq(tpl)) return `${CRAFT_JOBS[T.craft.job].name} niveau ${E.craftReq(tpl)} requis.`;
    if (!E.canCraft(S, T.craft)) return "Ressources insuffisantes.";
    if (E.craftRoom(S) <= 0) return "Sac et trop-plein pleins : fais de la place dans l'inventaire.";
    const gx = galet ? E.galetFx(S, tpl, galet) : null; if (typeof gx === "string") return gx;
    T.craft.ing.forEach(([r, q]) => { S.res[r] -= q - almSave(S, q); if (!S.res[r]) delete S.res[r]; });
    if (gx) { S.res[galet]--; if (!S.res[galet]) delete S.res[galet]; }
    const job = T.craft.job; const it = E.rollItem(S, tpl, craftRoll(S, job, gx ? gx.roll : {})); craftStow(S, it);
    if (gx && gx.double && rnd() < gx.double && E.craftRoom(S) > 0) { const it2 = E.rollItem(S, tpl, craftRoll(S, job)); craftStow(S, it2); E.craftTwin = it2; note(S, `${galet} : un 2e ${T.name} !`, "rare"); }
    if (E.almChance(S, "craft2") && E.craftRoom(S) > 0) { craftStow(S, E.rollItem(S, tpl, craftRoll(S, job))); note(S, `Fabrication intensive : un 2e ${T.name} !`, "rare"); } // 0.1.39 : Almanax
    craftXp(S, T.craft.job, E.craftXpOf(S, T.craft.job, E.craftReq(tpl), 12 + T.lvl * 3));
    E.emit(S, "craft", { tpl });
    return it;
  };
  E.craftSpecial = (S, name) => {
    const R = SPECIAL_CRAFTS[name]; if (!R) return "Recette inconnue.";
    const J = S.crafts[R.job];
    if (J.lvl < R.lvl) return `${CRAFT_JOBS[R.job].name} niveau ${R.lvl} requis.`;
    if (R.unique && ((S.res[name] || 0) > 0 || (R.furn && S.furniture.includes(name)) || (R.idol && E.idolOwned(S, R.idol)))) return "Vous possédez déjà cet objet.";
    if (R.dofus && !(E.dofusOwned && E.dofusOwned(S, R.dofus))) return "Obtenez d'abord ce Dofus par sa quête (Héros › Dofus).";
    if (!E.canCraft(S, R)) return "Ressources insuffisantes.";
    R.ing.forEach(([r, q]) => { S.res[r] -= q - almSave(S, q); if (!S.res[r]) delete S.res[r]; });
    if (R.idol) E.giveIdol(S, R.idol, "fabriquée"); else if (R.dofus) E.giveDofus(S, R.dofus, "copie du Bricoleur"); else if (R.furn && E.giveFurn) E.giveFurn(S, name, "fabriqué"); else if (R.cons) E.addCons(S, R.cons, R.n || 1); else addRes(S, name, 1);
    craftXp(S, R.job, E.craftXpOf(S, R.job, R.lvl, 20 + R.lvl * 3));
    E.emit(S, "craft", { special: name });
    if (name === "Baguette Rikiki") note(S, "La Planque des Vilinsekts est accessible !", "rare");
    return null;
  };
  /* 0.1.30.1 : fabrication en série (×10, max). Chaque exemplaire passe par craftItem / craftSpecial : jets, XP de métier et quêtes identiques à une fabrication une par une */
  E.craftMax = (S, ing, n = Infinity) => ing.reduce((m, [r, q]) => Math.min(m, Math.floor((S.res[r] || 0) / q)), n);
  E.craftCount = (S, k, id) => {
    if (k === "tpl") { const T = ITEMS[id]; if (!T || !T.craft || S.crafts[T.craft.job].lvl < E.craftReq(id)) return 0; return E.craftMax(S, T.craft.ing, E.craftRoom(S)); }
    const R = SPECIAL_CRAFTS[id]; if (!R || S.crafts[R.job].lvl < R.lvl) return 0;
    return E.craftMax(S, R.ing, R.unique ? 1 : Infinity);
  };
  E.craftMany = (S, k, id, n, galet) => {
    n = Math.max(1, Math.min(+n || 1, 1000)); const out = { n: 0, items: [], err: null, over: 0 }; const o0 = overLen(S);
    for (let i = 0; i < n; i++) {
      E.craftTwin = null; const r = k === "tpl" ? E.craftItem(S, id, galet) : E.craftSpecial(S, id);
      if (typeof r === "string") { out.err = r; break; }
      out.n++; if (r && r.uid) out.items.push(r);
      if (E.craftTwin) { out.items.push(E.craftTwin); out.twins = (out.twins || 0) + 1; E.craftTwin = null; }
    }
    out.over = Math.max(0, overLen(S) - o0);
    return out.n ? out : (out.err || "Fabrication impossible.");
  };
  const craftXp = (S, job, x) => {
    const J = S.crafts[job]; J.xp += x * (E.mtOwn ? Math.max(1, ...S.chars.map((c) => E.mtOwn(S, c, "xpj"))) : 1); // 2.1 : Artisan (le meilleur héros du compte)
    while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; note(S, `${CRAFT_JOBS[job].name} niveau ${J.lvl}`, "up"); }
  };

  /* ---------------- Brisage & runes ---------------- */
  E.runeKey = (tier, stat) => `${tier}:${stat}`;
  E.runeName = (key) => {
    const [tier, stat] = key.split(":"); const s = STATS[stat];
    return tier === "pa" ? `Rune Pa ${s.short}` : tier === "ra" ? `Rune Ra ${s.short}` : tier === "ga" ? `Rune Ga ${s.short}` : tier === "ta" ? `Rune de transcendance ${s.short}` : `Rune ${s.short}`;
  };
  E.runeInfo = (key) => {
    const [tier, stat] = key.split(":"); const mult = tier === "pa" ? 3 : tier === "ra" ? 10 : 1;
    const s = STATS[stat]; if (tier === "ta") { const v = (E.TRANS && E.TRANS[stat]) || s.pts; return { stat, tier, pts: v, weight: v * s.w, exo: false, trans: true }; } // 0.1.41 : rune de transcendance
    return { stat, tier, pts: tier === "ga" ? 1 : s.pts * mult, weight: tier === "ga" ? s.w : s.w * s.pts * mult, exo: tier === "ga" };
  };
  E.COEF_REGEN_MIN = 6; // +1 % toutes les 6 minutes
  /* 0.1.41 : en ligne, le coefficient est commun à tous les joueurs (comme sur un serveur DOFUS) : online.js remplit E.netCoef
     ({ modèle: { v, t } }, seulement ceux sous 100 %) et envoie au serveur les brisages notés dans E.netCoefHits. */
  E.netCoef = null; E.netCoefHits = [];
  /* 1.0.30 « Forge » (choix 43A de Mathis) : comme dans DOFUS, le coefficient va de 10 % à 200 %. −3 % par brisage, +1 % toutes les
     6 minutes jusqu'à 100 %, puis +1 % par heure jusqu'à 200 % tant que personne ne brise l'objet. Un objet jamais brisé part de 100 %
     à l'heure de départ (S.coefT0 sans compte ; en ligne, E.netCoefT0 vient du serveur, supabase/brisage.sql). Sans heure de départ,
     le coefficient reste plafonné à 100 % comme avant. */
  E.COEF_MIN = 10; E.COEF_MAX = 200; E.COEF_HI_MIN = 60; E.netCoefT0 = null;
  E.coefAt = (v, t, now) => { const m = Math.max(0, (now - t) / 60000);
    if (v < 100) { const up = (100 - v) * E.COEF_REGEN_MIN; if (m < up) return Math.floor(v + m / E.COEF_REGEN_MIN); return Math.min(E.COEF_MAX, 100 + Math.floor((m - up) / E.COEF_HI_MIN)); }
    return Math.min(E.COEF_MAX, Math.floor(v + m / E.COEF_HI_MIN)); };
  E.coefBase = (S, now = E.now()) => { const t0 = E.netCoef ? E.netCoefT0 : S && S.coefT0; return t0 ? E.coefAt(100, t0, now) : 100; }; // objet jamais brisé
  E.getCoef = (S, tpl, now = E.now()) => {
    const c = E.netCoef ? E.netCoef[tpl] : S.coef[tpl]; const base = E.coefBase(S, now); if (!c) return base;
    return Math.min(base, E.coefAt(c.v, c.t, now));
  };
  E.breakPreview = (S, uid, focus) => {
    const it = S.items[uid]; if (!it) return null;
    const T = ITEMS[it.tpl]; const coef = E.getCoef(S, it.tpl);
    const lvlMult = 1 + T.lvl * 3 / 200;
    const w = {};
    const rad = it.radiant ? 1.5 : 1;
    for (const k in it.stats) { const v = it.stats[k]; if (v > 0) w[k] = v * STATS[k].w * lvlMult * coef / 100 * rad; }
    if (focus && w[focus] !== undefined) {
      let tot = 0; for (const k in w) tot += k === focus ? w[k] : w[k] * 0.5;
      for (const k in w) delete w[k]; w[focus] = tot;
    }
    return { coef, weights: w };
  };
  /* 1.0.30 : runes qui existent pour une caractéristique (Tacle et Fuite : simple et Pa, comme dans DOFUS) */
  E.runeTiers = (stat) => (RUNE_SIMPLE_ONLY.includes(stat) ? [""] : (D.RUNE_NO_RA || []).includes(stat) ? ["pa", ""] : ["ra", "pa", ""]);
  // Convertit un poids en runes (Ra puis Pa puis simple ; le reste a une chance de donner une rune)
  const weightToRunes = (stat, w) => {
    const s = STATS[stat]; const base = s.w * s.pts; const out = {};
    const tiers = E.runeTiers(stat).map((t) => [t, t === "ra" ? 10 : t === "pa" ? 3 : 1]);
    let rem = w;
    tiers.forEach(([t, m]) => {
      const unit = base * m; if (unit <= 0) return;
      let n = Math.floor(rem / unit); if (t !== "" && n > 0) n = Math.max(0, n - (rnd() < 0.5 ? 1 : 0));
      if (n > 0) { out[E.runeKey(t, stat)] = n; rem -= n * unit; }
    });
    if (rem > 0 && rnd() < rem / base) { const k = E.runeKey("", stat); out[k] = (out[k] || 0) + 1; }
    return out;
  };
  E.EXO_BREAK_MULT = 2;
  E.breakItem = (S, uid, focus) => {
    const it = S.items[uid]; if (!it) return "Objet introuvable.";
    if (E.equippedBy(S, uid)) return "Retirez d'abord cet objet.";
    if (it.locked) return "Objet protégé par le cadenas.";
    if (E.inGear(S, uid)) return `Objet rangé dans une tenue de ${E.inGear(S, uid).name}.`;
    if (ITEMS[it.tpl] && ITEMS[it.tpl].slot === "dofus") return "Un Dofus ne se brise pas : une copie se fond dans son Potentiel (menu Dofus)."; // 1.0.32.11
    const p = E.breakPreview(S, uid, focus);
    const got = {}; const exoMult = it.exo ? E.EXO_BREAK_MULT : 1; // 0.1.9.1 : un objet exo rend ses runes ×2 (l'exo est perdu)
    for (const k in p.weights) {
      const r = weightToRunes(k, p.weights[k] * rf(0.85, 1.05) * exoMult);
      for (const rk in r) { const n = r[rk] + (r[rk] > 0 && E.almMult(S, "brise") > 0 ? E.almQty(r[rk], E.almMult(S, "brise")) : 0); S.runes[rk] = (S.runes[rk] || 0) + n; got[rk] = (got[rk] || 0) + n; } // 0.1.39 : Almanax « Concassage »
    }
    if (E.netCoef) { E.netCoef[it.tpl] = { v: Math.max(10, p.coef - 3), t: E.now() }; E.netCoefHits.push(it.tpl); }
    else S.coef[it.tpl] = { v: Math.max(10, p.coef - 3), t: E.now() };
    delete S.items[uid];
    E.emit(S, "brk", {});
    return got;
  };

  /* ---------------- Objets parfaits (0.1.8.2) : toutes les caractéristiques positives au jet maximum ---------------- */
  E.PERFECT_PCT = 2;
  E.isPerfect = (it) => {
    const T = ITEMS[it.tpl]; if (!T || T.trophy) return false; let n = 0;
    for (const k in T.stats) { const [, mx] = T.stats[k]; if (mx <= 0) continue; n++; if ((it.stats[k] || 0) < mx) return false; }
    return n > 0;
  };
  /* +2 % sur chaque caractéristique positive (au moins +1), sauf PA, PM, Portée et Invocations (1.0.29.1 : un Gelano parfait comptait 2 PA) */
  E.PERFECT_SKIP = { pa: 1, pm: 1, po: 1, inv: 1 };
  E.perfectStats = (it) => { const o = {}; for (const k in it.stats) { const v = it.stats[k]; o[k] = v > 0 && !E.PERFECT_SKIP[k] ? v + Math.max(1, Math.round(v * E.PERFECT_PCT / 100)) : v; } return o; };
  E.perfectCount = (S) => Object.values(S.items).filter(E.isPerfect).length;

  /* ---------------- 1.0.30 « Nouvelles caractéristiques » (41A) : PM, Tacle, Fuite et Dommages de poussée sur les objets ----------------
     Les objets déjà dans les parties gagnent aussi ces lignes (migration idempotente : seulement une ligne du modèle absente de l'objet).
     La valeur suit la qualité du jet de l'objet (moyenne de ses autres lignes, jet d'origine pour un Rayonnant) : un objet Parfait
     les reçoit au maximum et reste Parfait. Un objet qui avait déjà un exo de la même caractéristique (exo PM sur un objet qui a
     maintenant du PM) garde son PM en ligne normale au maximum et rend sa rune Ga. */
  E.CARACS_NEW = ["pm", "tac", "fui", "pou"];
  E.caracsFix = (S, it) => {
    const T = it && ITEMS[it.tpl]; if (!T || !T.stats || !it.stats) return 0;
    const miss = E.CARACS_NEW.filter((k) => T.stats[k] && it.stats[k] === undefined); if (!miss.length) return 0;
    let q = 0, m = 0, perfect = true, any = false;
    for (const k in T.stats) {
      if (miss.includes(k)) continue; const [a, b] = T.stats[k]; const v = it.roll && it.roll[k] !== undefined ? it.roll[k] : it.stats[k] || 0;
      if (b > 0) { any = true; if ((it.stats[k] || 0) < b) perfect = false; }
      if (b > a) { q += clamp((v - a) / (b - a), 0, 1); m++; }
    }
    q = any && perfect ? 1 : m ? q / m : 0.5;
    miss.forEach((k) => {
      const [a, b] = T.stats[k]; let v = Math.round(a + (b - a) * q);
      if (it.exo === k && b > 0) { v = b; delete it.exo; S.runes = S.runes || {}; const rk = E.runeKey("ga", k); S.runes[rk] = (S.runes[rk] || 0) + 1; }
      if (it.roll) it.roll[k] = v;
      it.stats[k] = it.radiant && v > 0 && !E.RADIANT_SKIP[k] ? Math.ceil(v * (1 + it.radiant / 100)) : v;
    });
    return miss.length;
  };
  /* sac, trop-plein ; from : seulement les objets arrivés depuis (uid ≥ from), comme ceux de l'HdV */
  /* 1.2.10.2 (choix de Mathis) : les Rayonnants obtenus avant la 1.2.10.2 rendent le PA, la Portée et l'Invocation gagnés par l'arrondi
     de leur bonus (1 PA → 2 PA) ; le reste du bonus est gardé. Une seule fois par objet (it.radFix), aussi pour ceux venus de l'HdV. */
  E.radiantSkipFix = (it) => {
    if (!it || !it.radiant || it.radFix || !it.stats) return 0; it.radFix = 1; let n = 0;
    for (const k in E.RADIANT_SKIP) {
      const r = it.roll && it.roll[k] !== undefined ? it.roll[k] : null; if (!(r > 0)) continue;
      const d = Math.ceil(r * (1 + it.radiant / 100)) - r; if (d > 0 && it.stats[k] >= r + d) { it.stats[k] -= d; n++; }
    }
    return n ? 1 : 0;
  };
  E.caracsMigrate = (S, from = 0) => {
    let n = 0; const fix = (it) => { if (it && it.uid >= from && E.caracsFix(S, it)) n++; if (E.radiantSkipFix(it)) S.radFixN = (S.radFixN || 0) + 1; };
    for (const uid in S.items || {}) fix(S.items[uid]);
    if (Array.isArray(S.over)) S.over.forEach(fix);
    S.caracsUid = S.nextUid;
    return n;
  };

  /* ---------------- Recrutement & équipe ---------------- */
  /* 0.1.50.1 : noms de héros. Même filtre que les pseudos du compte (mots interdits, imitation du créateur ou de l'équipe),
     appliqué à la création, au recrutement et au renommage ; les noms déjà donnés ne changent pas.
     Renommer : le premier changement de chaque héros est gratuit, ensuite E.RENAME_COST kamas. */
  E.BAD_WORDS = ["merde", "pute", "putain", "connard", "connasse", "salope", "encule", "nazi", "hitler", "batard", "fdp", "ntm", "pd", "nique", "bite", "couille", "fuck", "shit", "bitch", "nigg", "negr", "admin", "moderat", "idlus", "ankama", "xener", "createur"];
  E.nameBad = (p) => {
    const n = String(p || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[0-9_@$-]/g, (c) => ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", "@": "a", $: "s" }[c] || ""));
    return n.split(/[^a-z]+/).some((w) => w && (E.BAD_WORDS.some((b) => (b.length <= 3 ? w === b : w.includes(b))) || /^(modo|staff)/.test(w)));
  };
  E.NAME_MAX = 20; E.RENAME_COST = 50000;
  E.nameProblem = (name) => {
    const t = String(name || "").trim();
    if (!t) return "Choisis un nom.";
    if (t.length > E.NAME_MAX) return `${E.NAME_MAX} caractères au plus.`;
    if (E.nameBad(t)) return "Ce nom n'est pas autorisé.";
    return null;
  };
  E.renameCost = (c) => (c && c.renamed ? E.RENAME_COST : 0);
  E.renameChar = (S, cid, name) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    const t = String(name || "").trim().replace(/\s+/g, " ");
    if (t === c.name) return null;
    const bad = E.nameProblem(t); if (bad) return bad;
    const cost = E.renameCost(c);
    if (S.kamas < cost) return `Il te manque ${Math.ceil(cost - S.kamas).toLocaleString("fr-FR")} kamas.`;
    S.kamas -= cost; const old = c.name; c.name = t; c.renamed = (c.renamed || 0) + 1;
    note(S, `${old} s'appelle maintenant ${t}.`, "info");
    return null;
  };
  E.recruit = (S, cls, name) => {
    const n = S.chars.length + 1; const cost = E.recruitCost(n);
    if (name && E.nameBad(name)) return "Ce nom n'est pas autorisé.";
    if (S.chars.length >= E.HERO_MAX) return `${E.HERO_MAX} héros au plus : congédiez-en un pour faire de la place.`;
    if (S.kamas < cost) return `Il faut ${cost} kamas.`;
    S.kamas -= cost;
    const lvl = 1; // 1.0.12.7 : toute recrue arrive au niveau 1 (avant : la moitié du niveau du meilleur héros)
    S.recLv = (S.recLv || 0) + lvl; // niveaux donnés par les recrutements : le serveur ne les prend pas pour de la triche
    const c = E.addChar(S, cls, name || pick(NAMES), lvl);
    note(S, `${c.name} (${CLASSES[cls].name}) rejoint l'aventure !${c.inTeam ? "" : " Il attend au repos : l'équipe compte déjà 8 héros."}`, "up");
    S.fight = S.dungeon ? S.fight : null;
    return null;
  };
  /* 0.1.35 : congédier un héros. Équipement, Dofus, familier et monture restent dans le sac ;
     on récupère la moitié du prix du dernier recrutement, et le prochain redevient moins cher. */
  E.dismissRefund = (S) => Math.floor(E.recruitCost(S.chars.length) / 2);
  E.dismiss = (S, cid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (S.chars.length <= 1) return "Il faut garder au moins un héros.";
    const active = c.inTeam && !c.job;
    if (active && S.dungeon) return "Impossible pendant un donjon.";
    if (active && E.expActive && E.expActive(S)) return "Impossible pendant une expédition.";
    if (active && E.activeCount(S) <= 1) return "C'est le seul héros de l'équipe : mettez-en un autre en équipe d'abord.";
    const refund = E.dismissRefund(S);
    c.equip = {}; c.pet = null; c.mount = null; c.job = null;
    if (S.training === cid) S.training = null;
    if (S.atelier && S.atelier.cid === cid) { S.atelier.cid = null; S.atelier.prog = 0; S.atelier.stall = null; }
    (S.comps || []).forEach((K) => { if (K && K.ids) K.ids = K.ids.filter((id) => id !== cid); });
    S.chars = S.chars.filter((x) => x !== c);
    if (S.mainHero === cid) S.mainHero = S.chars.slice().sort((a, b) => (b.ren || 0) - (a.ren || 0) || b.lvl - a.lvl)[0].id;
    if (active) S.fight = S.dungeon ? S.fight : null;
    S.kamas += refund;
    note(S, `${c.name} quitte l'aventure.${refund ? ` ${refund.toLocaleString("fr-FR")} kamas récupérés.` : ""}`, "info");
    return null;
  };
  E.toggleTeam = (S, cid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return;
    if (c.inTeam && E.team(S).length <= 1) return "Il faut au moins un personnage dans l'équipe.";
    if (!c.inTeam && E.activeCount(S) >= E.TEAM_MAX) return "8 héros au plus dans l'équipe.";
    if (S.dungeon) return "Impossible de changer l'équipe en donjon.";
    if (E.expActive && E.expActive(S)) return "Impossible de changer l'équipe en expédition.";
    c.inTeam = !c.inTeam; S.fight = null; return null;
  };

  /* ---------------- 0.1.29 : Sablier de Xélor (vitesse ×2 / ×3) ----------------
     Le sablier se remplit en vrai temps (jeu ouvert ou fermé) de SAB_RATE par seconde, jusqu'à SAB_MAX.
     La vitesse ×2 retire 1 s de réserve par seconde, ×3 en retire 2 : la réserve est du « temps de jeu en plus ».
     Il se débloque à la fin d'Incarnam (quête principale « La Crypte de Kardorim » terminée). Hors ligne, rien n'accélère. */
  E.SAB_RATE = 7.5 / 60;          // +7 min 30 par heure = 3 h par jour
  E.SAB_MAX = 36 * 3600;          // 12 jours de recharge (9 h avant la 1.2.2, 15 h en 1.2.2, 24 h de la 1.2.3 à la 2.1.21)
  /* « Plus de Sablier » (Mathis : 1 un vrai défi, 2A beaucoup plus cher, 3B, 4 beaucoup plus rare, 5B) :
     Horloge de Xélor du Havre-Sac (+30 min de recharge par jour et par niveau, 3 niveaux), heures gagnées par activité
     (une fois par jour au plus chacune), Horloger de Xélor (Fioles de temps très chères), Grain de Xélor très rare en donjon.
     Les Fioles et les Grains se vendent à l'hôtel de vente. */
  E.SAB_CLOCK_MIN = 30;
  E.sabRate = (S) => E.SAB_RATE * (1 + ((E.havreLvl && S ? E.havreLvl(S, "sablier") : 0) * E.SAB_CLOCK_MIN + (S ? E.sabMtRecharge(S) : 0)) / 180);
  /* 2.1.27 « Maîtrise du temps » (Mathis 1A 2C 3A 4A 5A) : chaque minute de réserve utilisée donne 1 XP au Sablier (un par compte).
     50 niveaux : passer du niveau n au niveau n+1 demande 30 × n minutes (environ 612 h de Sablier pour le niveau 50).
     Paliers : +1 h de réserve tous les 2 niveaux, butin moins réduit aux niveaux 10, 20, 30 et 40, +30 min de recharge par jour
     aux niveaux 15 et 35, Fioles de temps offertes chaque semaine (1 dès le 25, 2 dès le 45), vitesse ×4 et titre au 50,
     et un Grain de Xélor (+15 min) à chaque niveau impair (3 à 49, 24 en tout). Mathis 3B puis 5B : dès le niveau 15, le ×2 ne coûte plus
     de réserve (il ne donne alors plus d'XP : la Maîtrise avance avec le ×3 et le ×4).
     Tout le monde commence au niveau 1. */
  E.SAB_MT_MAX = 50; E.SAB_MT_STEP = 30; E.SAB_MT_TITLE = "Maître du temps";
  E.sabMtXpAt = (l) => E.SAB_MT_STEP * (l - 1) * l / 2; // XP totale pour atteindre le niveau l
  E.sabMt = (S) => { if (!S.sabMt || typeof S.sabMt !== "object") S.sabMt = { xp: 0 }; if (!(+S.sabMt.xp >= 0)) S.sabMt.xp = 0; return S.sabMt; };
  E.sabMtLvl = (S) => { const x = S && S.sabMt ? Math.max(0, +S.sabMt.xp || 0) : 0; let l = Math.floor((1 + Math.sqrt(1 + 8 * x / E.SAB_MT_STEP)) / 2); while (l > 1 && E.sabMtXpAt(l) > x) l--; while (l < E.SAB_MT_MAX && E.sabMtXpAt(l + 1) <= x) l++; return Math.max(1, Math.min(E.SAB_MT_MAX, l)); };
  E.sabMtProg = (S) => { const l = E.sabMtLvl(S), x = S && S.sabMt ? Math.max(0, +S.sabMt.xp || 0) : 0; if (l >= E.SAB_MT_MAX) return { l, x, a: 0, b: 0, p: 1 }; const a = x - E.sabMtXpAt(l), b = E.SAB_MT_STEP * l; return { l, x, a, b, p: Math.min(1, a / b) }; };
  E.sabMtRecharge = (S) => { const l = E.sabMtLvl(S); return (l >= 15 ? 30 : 0) + (l >= 35 ? 30 : 0); }; // minutes par jour en plus
  E.SAB_MT_MALUS = [[40, 0.06, 0.12], [30, 0.07, 0.14], [20, 0.08, 0.16], [10, 0.09, 0.18], [1, 0.1, 0.2]]; // [niveau, ×2, ×3]
  E.SAB_X4_LOOT = 0.25;
  E.sabMalus = (l, spd) => { const R = E.SAB_MT_MALUS.find((x) => l >= x[0]); return spd >= 4 ? E.SAB_X4_LOOT : spd >= 3 ? R[2] : spd >= 2 ? R[1] : 0; };
  E.SAB_FREE2_LVL = 15; E.sabFree2 = (S) => E.sabMtLvl(S) >= E.SAB_FREE2_LVL; // ×2 illimité (Mathis 3B)
  E.sabMaxSpd = (S) => (E.sabMtLvl(S) >= E.SAB_MT_MAX ? 4 : 3);
  E.sabMaxOf = (S) => E.SAB_MAX + Math.floor(E.sabMtLvl(S) / 2) * 3600;   // réserve de recharge : 36 h + 1 h tous les 2 niveaux
  E.sabGiftMaxOf = (S) => E.sabMaxOf(S) + (E.SAB_GIFT_MAX - E.SAB_MAX);   // avec des heures achetées ou offertes : 12 h de plus
  E.sabFioleWeek = (l) => (l >= 45 ? 2 : l >= 25 ? 1 : 0);
  E.sabWeekKey = () => { const d = new Date(E.now()); const day = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10); }; // lundi (UTC)
  E.sabMtWeekly = (S) => { // Fioles offertes : une fois par semaine, au premier passage de la semaine
    const n = E.sabFioleWeek(E.sabMtLvl(S)); if (!n) return 0; const M = E.sabMt(S), w = E.sabWeekKey(); if (M.wk && M.wk >= w) return 0; // horloge reculée : pas de nouvelle Fiole
    M.wk = w; for (let i = 0; i < n; i++) E.addCons(S, "fiole_temps");
    note(S, `Maîtrise du temps : ${n > 1 ? n + " Fioles de temps offertes" : "1 Fiole de temps offerte"} cette semaine.`, "info"); return n;
  };
  E.sabMtGain = (S, min) => { // min = minutes de réserve utilisées
    if (!(min > 0)) return; const M = E.sabMt(S), l0 = E.sabMtLvl(S); if (l0 >= E.SAB_MT_MAX) { M.xp = Math.max(M.xp, E.sabMtXpAt(E.SAB_MT_MAX)); return; }
    M.xp = Math.min(E.sabMtXpAt(E.SAB_MT_MAX), M.xp + min); const l = E.sabMtLvl(S); if (l <= l0) return;
    const got = []; for (let k = l0 + 1; k <= l; k++) { if (k % 2 === 0) got.push("+1 h de réserve"); else { E.addCons(S, "grain_xelor"); got.push("Grain de Xélor"); } /* Mathis 2C : un Grain à chaque niveau impair */ if (k % 10 === 0 && k < 50) got.push("butin moins réduit"); if (k === 15 || k === 35) got.push("+30 min de recharge par jour"); if (k === 25 || k === 45) got.push("Fiole offerte chaque semaine"); if (k === E.SAB_FREE2_LVL) got.push("×2 illimité"); }
    if (l >= E.SAB_MT_MAX) { got.push("vitesse ×4"); S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(E.SAB_MT_TITLE)) { S.titlesExtra.push(E.SAB_MT_TITLE); got.push(`titre « ${E.SAB_MT_TITLE} »`); } }
    note(S, `Maîtrise du temps niveau ${l}${got.length ? " : " + [...new Set(got)].join(", ") : ""} !`, l % 5 === 0 ? "rare" : "info");
    if (E.sabFioleWeek(l) > E.sabFioleWeek(l0)) { const M2 = E.sabMt(S); if (M2.wk && M2.wk >= E.sabWeekKey()) { const n = E.sabFioleWeek(l) - E.sabFioleWeek(l0); for (let i = 0; i < n; i++) E.addCons(S, "fiole_temps"); } else E.sabMtWeekly(S); }
  };
  E.SAB_EARN = { defi: [1, 1, "Défi du jour gagné"], alm: [0.5, 1, "Offrande de l'Almanax"], wb: [0.5, 3, "Essai au boss des mondes"], gb: [0.5, 2, "Essai au boss de guilde"] }; // [heures, fois par jour, origine]
  E.sabDay = (S) => { const d = E.dayKey ? E.dayKey() : new Date(E.now()).toISOString().slice(0, 10); if (!S.sabDay || S.sabDay.d !== d) S.sabDay = { d }; return S.sabDay; };
  E.sabEarnLeft = (S, k) => { const R = E.SAB_EARN[k]; return R ? Math.max(0, R[1] - (E.sabDay(S)[k] || 0)) : 0; };
  E.sabEarn = (S, k) => { // heures données (0 si déjà fait aujourd'hui, Sablier fermé ou réserve pleine)
    const R = E.SAB_EARN[k]; if (!R || !E.sabUnlocked(S) || !E.sabEarnLeft(S, k)) return 0;
    const B = E.sab(S); const r0 = B.r; E.sabGift(S, R[0]); const got = (B.r - r0) / 3600; if (got <= 0) return 0;
    const D = E.sabDay(S); D[k] = (D[k] || 0) + 1; note(S, `${R[2]} : +${got >= 1 ? Math.round(got * 10) / 10 + " h" : Math.round(got * 60) + " min"} de Sablier de Xélor.`, "info"); return got;
  };
  /* Horloger de Xélor : une Fiole de temps (1 h, vendable) pour 5 millions de kamas, le prix double à chaque achat du jour, 3 par jour */
  E.HORLOGER = { base: 5000000, max: 3 };
  E.horlogerLeft = (S) => Math.max(0, E.HORLOGER.max - (E.sabDay(S).buy || 0));
  E.horlogerCost = (S) => E.HORLOGER.base * Math.pow(2, E.sabDay(S).buy || 0);
  E.horlogerBuy = (S) => {
    if (!E.sabUnlocked(S)) return "Le Sablier de Xélor se débloque à la fin d'Incarnam.";
    if (!E.horlogerLeft(S)) return "L'Horloger n'a plus de Fiole aujourd'hui. Reviens demain.";
    const k = E.horlogerCost(S); if (S.kamas < k) return `Il faut ${k.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= k; const D = E.sabDay(S); D.buy = (D.buy || 0) + 1; E.addCons(S, "fiole_temps"); return null;
  };
  /* Grain de Xélor : boss de donjon dès la stasis 6, 1 sur 1 000 (1 sur 400 en stasis 15). Tirage à part (Math.random) :
     il ne décale pas le hasard des combats rejoués par le serveur. */
  E.grainRate = (st) => (st >= 6 ? 0.001 * (1 + (Math.min(15, st) - 6) / 6) : 0);
  E.SAB_UNLOCK_STEP = 6;          // étapes de la quête principale à finir (jusqu'à la Crypte de Kardorim)
  E.sabUnlocked = (S) => !!(S.sablier && S.sablier.open) || !!(S.quest && S.quest.step >= E.SAB_UNLOCK_STEP);
  E.sab = (S) => {
    if (!S.sablier) S.sablier = { r: E.SAB_MAX, at: E.now(), spd: 1, open: false }; // plein au départ
    const B = S.sablier, now = E.now(), MX = E.sabMaxOf(S);
    if (!(B.at <= now)) B.at = now; // horloge revenue en arrière : on ne rend rien
    const r0 = Math.max(0, +B.r || 0); B.r = r0 > MX ? r0 : Math.min(MX, r0 + ((now - B.at) / 1000) * E.sabRate(S)); B.at = now; // un code cadeau peut dépasser le maximum
    if (!B.open && E.sabUnlocked(S)) { B.open = true; note(S, "Sablier de Xélor débloqué : le temps peut filer ×2 ou ×3 (barre du haut).", "rare"); }
    if (!(B.spd >= 1 && B.spd <= E.sabMaxSpd(S) && B.spd === Math.floor(B.spd))) B.spd = 1;
    if (B.open && S.sabMt && !(S.sabMt.wk >= E.sabWeekKey())) E.sabMtWeekly(S);
    return B;
  };
  /* vitesse réellement appliquée pour realMs millisecondes de vrai temps ; vide la réserve en conséquence */
  /* 0.1.46.3 : le sablier ne s'use que si quelque chose avance (combat, donjon, expédition, récolte, atelier, forgemagie automatique) */
  E.sabBusy = (S) => !!(S.dungeon || (S.fight && !S.fight.over) || (S.hunting && S.sub && E.team(S).length) || (E.expBusy && E.expBusy(S))
    || S.chars.some((c) => c.job) || (S.atelier && S.atelier.built && S.atelier.cid != null && !S.atelier.stall)
    || (E.fmPlanActive && E.fmPlanActive(S).length));
  E.sabSpend = (S, realMs) => {
    const B = E.sab(S); E.sabLvlNow = E.sabMtLvl(S); if (!B.open || B.spd === 1 || !E.sabBusy(S)) return 1;
    const f = E.sabFree2(S) ? 2 : 1; // 2.1.27 (Mathis 3B) : ×2 illimité dès le niveau 25, sans réserve ni XP
    if (B.spd <= f) return B.spd;
    const need = (realMs / 1000) * (B.spd - 1);
    if (need <= B.r) { B.r -= need; E.sabMtGain(S, need / 60); return B.spd; }
    // la réserve se termine pendant ce pas : on finit ce qui reste puis retour à ×1 (×2 dès le niveau 25)
    const t = B.r / need, m = B.spd * t + f * (1 - t); E.sabMtGain(S, B.r / 60); B.r = 0; B.spd = f;
    note(S, f > 1 ? "Sablier de Xélor vide : retour au ×2 illimité. Il se remplit tout seul." : "Sablier de Xélor vide : retour à la vitesse normale. Il se remplit tout seul (3 h par jour).", "info");
    return m;
  };
  /* 2.1.22 « Le Sablier » (Mathis 1B 2B 3A) : contrepartie du temps rapide, butin −10 % en ×2 et −20 % en ×3
     (ressources, équipements, clés et kamas des combats, de la récolte et des expéditions ; jamais l'XP ni les Dofus).
     E.sabNow = vitesse réellement appliquée au pas de jeu en cours (posée par la boucle du jeu autour de E.tick, 1 ailleurs). */
  E.SAB_LOOT = 0.1;
  E.sabNow = 1; E.sabLvlNow = 1; // niveau de Maîtrise du temps du pas en cours (posé par E.sabSpend)
  E.sabLootAt = (spd, lvl) => { // 2.1.27 : malus selon le niveau de Maîtrise du temps ; vitesse non entière (réserve vide en cours de pas) : entre les deux
    const v = Math.max(1, Math.min(4, +spd || 1)), l = Math.max(1, +lvl || 1), a = Math.floor(v), f = v - a;
    const m = E.sabMalus(l, a) * (1 - f) + (f > 0 ? E.sabMalus(l, a + 1) * f : 0); return Math.max(0, 1 - m);
  };
  E.sabLoot = () => E.sabLootAt(E.sabNow, E.sabLvlNow);
  E.SAB_GIFT_MAX = 48 * 3600;    // réserve maximale avec des heures achetées ou offertes (24 h avant la 1.2.3, 36 h jusqu'à la 2.1.21)
  E.sabGift = (S, hours) => { const B = E.sab(S); B.r = Math.min(E.sabGiftMaxOf(S), B.r + Math.max(0, +hours || 0) * 3600); return B.r; };
  E.sabSet = (S, v) => {
    const B = E.sab(S); v = +v;
    if (!B.open) return "Le Sablier de Xélor se débloque à la fin d'Incarnam : terminez la quête « La Crypte de Kardorim ».";
    if (v === 4 && E.sabMaxSpd(S) < 4) return `La vitesse ×4 se débloque au niveau ${E.SAB_MT_MAX} de la Maîtrise du temps.`;
    if (![1, 2, 3, 4].includes(v)) return "Vitesse inconnue.";
    if (v > (E.sabFree2(S) ? 2 : 1) && B.r < 1) return "Le sablier est vide : il se remplit tout seul (3 h par jour).";
    B.spd = v; return null;
  };

  /* ---------------- Hors-ligne ---------------- */
  E.OFFLINE_RATE = 0.25;
  E.OFFLINE_MAX_S = 8 * 3600;
  E.offRate = (S) => E.OFFLINE_RATE + E.bonus(S, "offrate") / 100; // 1.0.30 : rendement hors ligne (plafond 80 %)
  E.catchUp = (S, seconds) => {
    seconds = Math.min(seconds, E.OFFLINE_MAX_S + E.bonus(S, "offtime") * 3600);
    if (seconds < 60) return null;
    const eff = seconds * E.offRate(S);
    const rec = S.stats.recent;
    const avg = rec.length ? rec.reduce((s, r) => s + r.d, 0) / rec.length : 15;
    const winRate = rec.length ? rec.reduce((s, r) => s + r.w, 0) / rec.length : 0.5;
    const cycle = avg + E.PAUSE_MS / 1000;
    let fights = Math.min(5000, Math.floor(eff / cycle));
    const before = { kamas: S.kamas, res: Object.assign({}, S.res), lvls: S.chars.map((c) => c.lvl), items: E.itemCount(S), uids: new Set(Object.keys(S.items)), archis: Object.assign({}, S.archis), souls: Object.assign({}, S.souls || {}), xp: S.chars.map((c) => c.xp) };
    const hunting = S.hunting && S.sub && SUBS[S.sub] && E.team(S).length;
    const evLen = E.events.length;
    let wins = 0;
    const wasDungeon = S.dungeon; S.dungeon = null; const zone0 = hunting ? SUBS[S.sub].name : null; // le donjon en cours s'arrête là ; 1.0.30 : les heures de donjon le continuent (E.dghRun), puis l'équipe chasse dans sa zone
    let sub = SUBS[S.sub]; const teamSize = E.team(S).length; const roamed = [];
    // part de l'absence couverte par le bonus d'XP
    const b = S.boosts && S.boosts.xp; const now = E.now(); const startT = now - seconds * 1000;
    const covered = b ? clamp((b.until - startT) / (seconds * 1000), 0, 1) : 0;
    const xpBoost = b ? b.pct * covered : 0;
    /* 1.0.30 « Heures de donjon » (js/expeditions.js) : d'abord le donjon choisi, tant qu'il reste des heures et des clés ; la chasse prend le reste de l'absence */
    const dg = E.dghRun ? E.dghRun(S, seconds, eff / seconds, { cur: wasDungeon, xpBoost }) : null;
    const dgUsed = dg && dg.used ? Math.min(seconds, dg.used) : 0;
    if (dgUsed) fights = Math.min(5000, Math.floor((seconds - dgUsed) * eff / seconds / cycle));
    E.catchingUp = true; // 1.1.0.1 : le Champion légendaire appelé attend le retour du joueur (js/champions.js)
    for (let i = 0; hunting && i < fights; i++) {
      if (rnd() >= winRate) continue;
      wins++;
      const g = E.makeGroup(S, sub, teamSize);
      if (E.chromaOffline) E.chromaOffline(S, g); // 1.0.33 : chromatiques pendant l'absence (le butin ×3 suit dans giveRewards)
      const pr = E.powRew(g, "hunt", E.huntMon(teamSize)); giveRewards(S, g, { xpBoost, offline: true, xpMult: E.PACE_REW * pr, dropMult: E.PACE_REW * (1 + E.podBonus(S)) * pr, kamasMult: E.PACE_REW * pr });
      E.emit(S, "win", { mons: g.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, champ: m.champ, lvl: m.lvl })), sub: S.sub, offline: true });
      S.progress.wins[S.sub] = (S.progress.wins[S.sub] || 0) + 1;
      E.starsTick(S, cycle, now); // les étoiles de la zone fondent aussi hors ligne
      if (S.settings.roam) { const tz = startT + (dgUsed + (i + 1) * (seconds - dgUsed) / fights) * 1000; if (E.roam(S, tz, true)) { roamed.push(SUBS[S.sub].name); sub = SUBS[S.sub]; } }
    }
    E.catchingUp = false;
    S.dungeon = wasDungeon;
    if (hunting) checkHunt(S, sub.monsters);
    gatherTick(S, eff, { quiet: true });
    E.atelierTick(S, eff, { quiet: true });
    const fmPlans = E.fmPlanTick(S, eff, { quiet: true }); // 0.1.9.1 : la forgemagie automatique continue
    E.petTick(S, seconds * 1000); // les familiers mangent en temps réel
    E.enclosTick(S, seconds * 1000 * E.almMult(S, "enclos")); // les naissances continuent
    const mis = E.misTick ? E.misTick(S) : null; // 1.0.30 : expéditions terminées pendant l'absence (js/expeditions.js)
    E.events.length = evLen; // pas de pluie de notifications
    const res = {};
    for (const k in S.res) { const d = S.res[k] - (before.res[k] || 0); if (d > 0) res[k] = d; }
    const ev2 = E.events.length; const over = E.bagFlush(S); E.events.length = ev2; // 0.1.37 : trop-plein
    return {
      over,
      seconds, fights: hunting ? fights : 0, wins, kamas: S.kamas - before.kamas, res,
      items: E.itemCount(S) - before.items,
      newItems: Object.keys(S.items).filter((u) => !before.uids.has(u)).sort((a, b) => ITEMS[S.items[b].tpl].lvl - ITEMS[S.items[a].tpl].lvl).slice(0, 30),
      archis: Object.keys(S.archis).filter((k) => (S.archis[k] || 0) > (before.archis[k] || 0)),
      souls: Object.keys(S.souls || {}).filter((k) => !before.souls[k]), stones: (S.cons && S.cons.pierre_ame) || 0,
      winRate: winRate, fightLen: Math.round(cycle), fmPlans, roamed, zone: zone0, dungeon: wasDungeon && DUNGEONS[wasDungeon.id] ? DUNGEONS[wasDungeon.id].name : null,
      dg: dg && (dg.runs || (dg.why && dg.why !== "short")) ? dg : null, mis, // 1.0.30 : donjon pendant l'absence et retours d'expédition
      lvls: S.chars.map((c, i) => [c.name, before.lvls[i] || c.lvl, c.lvl]).filter((x) => x[2] > x[1]),
    };
  };

  /* 1.0.19 « Métiers comme dans DOFUS » : chaque métier d'objets passe au niveau qui donne exactement les mêmes recettes qu'avant
     (au métier L on fabriquait jusqu'aux objets 3 × L + 2), au plus 200, avec la même part de la barre d'XP. Un métier jamais monté reste au niveau 1.
     Le Bricoleur ne change pas (ses recettes étaient déjà au niveau du métier). Le serveur ne compte pas ce saut dans la semaine ni pour les « Premiers ». */
  E.craftObjConvert = (S, report) => {
    const up = [];
    for (const j of Object.keys(CRAFT_JOBS)) {
      const J = S.crafts && S.crafts[j]; if (j === "bricoleur" || !J) continue;
      const L0 = Math.max(1, Math.min(200, J.lvl || 1)), x0 = Math.max(0, J.xp || 0); if (L0 >= 200 || (L0 <= 1 && x0 <= 0)) continue;
      const L = Math.min(200, 3 * L0 + 2), f = Math.min(1, x0 / E.jobXpNeed(L0));
      J.lvl = L; J.xp = L >= 200 ? 0 : Math.floor(f * E.jobXpNeed(L)); up.push(`${CRAFT_JOBS[j].name} ${L0} → ${L}`);
    }
    if (up.length && report) report.push(`1.0.19 « Métiers comme dans DOFUS » : un objet se fabrique maintenant avec le métier à son niveau (avant : le tiers), et chaque niveau se gagne en environ 3 fabrications. Tes métiers sont convertis et gardent exactement les mêmes recettes : ${up.join(", ")}.`);
    S.craftObj = 1; return up;
  };

  /* ---------------- Sauvegarde ---------------- */
  const TRANSIENT = ["fight", "acc", "pause", "manualLive"];
  E.serialize = (S) => {
    const o = {}; for (const k in S) if (!TRANSIENT.includes(k)) o[k] = S[k];
    return JSON.stringify(o);
  };
  /* 1.0.33.1 « Sac de 3 000 places » : rangement compact des objets dans le stockage du navigateur (environ 3 fois plus
     léger). Seule la copie écrite dans le navigateur est compacte : E.serialize, la sauvegarde en ligne, l'export et le
     serveur gardent le format normal. Un objet devient [uid, n° de modèle, valeurs…, {autres champs}] ; la liste des modèles
     avec leurs caractéristiques (zk) est écrite dans la sauvegarde, donc un changement des données du jeu ne la fausse pas. */
  const ZBASE = { uid: 1, tpl: 1, stats: 1 };
  E.packSave = (txt) => {
    if (typeof txt !== "string" || txt.indexOf('"zItems"') >= 0) return txt;
    let o; try { o = JSON.parse(txt); } catch (e) { return txt; }
    if (!o || typeof o !== "object" || !o.items || typeof o.items !== "object") return txt;
    const zk = [], zi = {};
    const one = (it) => {
      if (!it || typeof it !== "object" || Array.isArray(it) || typeof it.tpl !== "string" || typeof it.uid !== "number" || !it.stats || typeof it.stats !== "object") return it;
      const ks = Object.keys(it.stats); if (ks.some((k) => typeof it.stats[k] !== "number")) return it;
      if (it.tpl.indexOf(":") >= 0) return it;
      const sig = it.tpl + ":" + ks.join(","); let n = zi[sig]; if (n === undefined) { n = zi[sig] = zk.length; zk.push(sig); }
      const a = [it.uid, n]; ks.forEach((k) => a.push(it.stats[k]));
      const ex = {}; let m = 0; for (const k in it) if (!ZBASE[k]) { ex[k] = it[k]; m++; } if (m) a.push(ex);
      return a;
    };
    const out = {}; for (const k in o) {
      if (k === "items") { out.zItems = Object.keys(o.items).map((u) => (+u === o.items[u].uid ? one(o.items[u]) : o.items[u])); continue; }
      if (k === "over" && Array.isArray(o.over)) { out.zOver = o.over.map(one); continue; }
      out[k] = o[k];
    }
    out.zk = zk;
    return JSON.stringify(out);
  };
  E.unpackSave = (txt) => {
    if (typeof txt !== "string" || txt.indexOf('"zItems"') < 0) return txt;
    const o = JSON.parse(txt); if (!o || !Array.isArray(o.zItems)) return txt;
    const zk = (Array.isArray(o.zk) ? o.zk : []).map((s) => { const i = String(s).indexOf(":"); const ks = String(s).slice(i + 1); return { tpl: String(s).slice(0, i), ks: ks ? ks.split(",") : [] }; });
    const one = (a) => {
      if (!Array.isArray(a)) return a;
      const z = zk[a[1]] || { tpl: "", ks: [] }; const it = { uid: a[0], tpl: z.tpl, stats: {} };
      z.ks.forEach((k, i) => { it.stats[k] = a[2 + i]; });
      const ex = a[2 + z.ks.length]; if (ex && typeof ex === "object") Object.assign(it, ex);
      return it;
    };
    const out = {}; for (const k in o) {
      if (k === "zItems") { out.items = {}; o.zItems.forEach((a) => { const it = one(a); if (it && it.uid !== undefined) out.items[it.uid] = it; }); continue; }
      if (k === "zOver") { out.over = o.zOver.map(one); continue; }
      if (k === "zk") continue;
      out[k] = o[k];
    }
    return JSON.stringify(out);
  };
  E.deserialize = (txt) => {
    const S = JSON.parse(E.unpackSave(txt));
    if (!S || !Array.isArray(S.chars) || !S.chars.length) throw new Error("Sauvegarde invalide");
    const fresh = E.newState("x", "iop");
    const report = [];
    if (!S.v || S.v < 2) {
      // v1 -> v2 : nouvelles données (vrais objets, monstres et sorts de DOFUS)
      let lost = 0;
      for (const uid in S.items) if (!ITEMS[S.items[uid].tpl]) { lost++; delete S.items[uid]; }
      if (lost) { S.kamas += lost * 120; report.push(`${lost} ancien(s) objet(s) remplacé(s) par ${lost * 120} kamas`); }
      S.chars.forEach((c) => { c.equip = {}; c.spells = []; c.knownSeen = []; c.sortedOnce = false; c.presets = []; c.zonePreset = {}; c.sex = c.sex || CLASSES[c.cls].sex || "m"; });
      S.bestiary = {}; S.archis = {};
      if (S.sub && !SUBS[S.sub]) S.sub = null;
      S.hunting = false;
      for (const k in S.progress.wins) if (!SUBS[k]) delete S.progress.wins[k];
      // garder l'accès aux zones déjà atteintes : sous-zones adaptées au niveau du meilleur héros
      const top = Math.max(...S.chars.map((c) => c.lvl));
      Object.values(SUBS).forEach((s) => { if (!s.hidden && s.lvl[0] <= top - 2 && E.zoneUnlocked(S, s.zone)) S.progress.wins[s.id] = Math.max(S.progress.wins[s.id] || 0, E.WINS_TO_UNLOCK); });
      report.push("Sorts et équipements réinitialisés pour la v2");
    }
    if (S.v < 3) {
      S.settings.speed = 1;
      if (!S.settings.auto) S.settings.auto = { action: "none", q: 40, keepSets: true };
      // paliers déjà atteints : pas de notification en rafale
      S.huntSeen = {}; for (const k in S.bestiary) if (MONSTERS[k]) S.huntSeen[k] = E.huntTier(S, k);
      report.push("Nouveautés v2.5 : 19 classes, paliers de chasse, consommables, inventaire et équipement revus. Toutes les sous-zones sont ouvertes.");
    }
    if (S.v < 6) {
      S.chars.forEach((c) => { c.spells = []; c.presets = []; c.zonePreset = {}; c.knownSeen = []; c.sortedOnce = false; c.spellsManual = false; });
      S.settings.chalAI = false; S.chalStreak = 0; S.chalStats = {};
      report.push("Nouveautés v3 : vrais sorts de Dofus avec variantes, nouvelles caractéristiques, challenges, mécaniques de boss et contenu jusqu'au niveau 120. Les sorts équipés et les préréglages ont été réinitialisés.");
    }
    if (S.v < 7) {
      S.chars.forEach((c) => { c.scrolls = c.scrolls || {}; c.autoCap = c.autoCap || 200; if (c.head === undefined) c.head = c.id % 8; c.palette = c.palette || "classique"; c.pts = (c.lvl - 1) * 5; BASE_STATS.forEach((k) => (c.alloc[k] = 0)); if (!c.autoStat) c.autoStat = CLASSES[c.cls].main; E.autoAllocate(S, c); });
      report.push("Nouveautés 3.1 : les points de caractéristiques suivent maintenant les paliers de DOFUS (au-delà de 100, il faut plus de points pour gagner 1). Vos points ont été redistribués automatiquement : élément principal jusqu'à 200, puis Vitalité. La réinitialisation est gratuite et illimitée.");
    }
    if (S.v < 8 && S.emblem) {
      // 0.1.8.2 : l'Emblème du Solitaire disparaît ; les runes investies sont rendues en runes simples, le titre et l'ornement restent acquis
      const em = S.emblem; let W = em.xp || 0; for (let l = 1; l < (em.lvl || 1); l++) W += Math.floor(5 + 0.5 * Math.pow(l, 1.25));
      const lines = Object.keys(em.stats || {}).filter((k) => STATS[k] && em.stats[k] > 0); const tot = lines.reduce((a, k) => a + em.stats[k] * STATS[k].w, 0) || 1;
      const got = [];
      (lines.length ? lines : ["vit"]).forEach((k) => { const share = lines.length ? em.stats[k] * STATS[k].w / tot : 1; const n = Math.floor(W * share / (STATS[k].w * STATS[k].pts)); if (n > 0) { const key = E.runeKey("", k); S.runes[key] = (S.runes[key] || 0) + n; got.push(`${n} ${E.runeName(key)}`); } });
      if ((em.lvl || 0) >= 100) { S.unlocks = S.unlocks || {}; S.unlocks.solitaire = true; }
      if (S.ach && S.ach.emb100) { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes("le Solitaire")) S.titlesExtra.push("le Solitaire"); }
      delete S.emblem;
      report.push(`0.1.8.2 : l'Emblème du Solitaire disparaît (il ne servait qu'en solo). ${got.length ? "Runes rendues : " + got.join(", ") + "." : "Aucune rune n'y avait été investie."} Les runes nourrissent maintenant le métier de Forgemage (onglet Forgemagie).`);
    }
    if (S.v < 9) { // 0.1.12 : nouvelle courbe d'XP au-delà du niveau 100 ; les héros qui ont déjà l'XP du niveau suivant montent tout de suite
      const ev = E.events.length; S.chars.forEach((c) => { c.ren = c.ren || 0; c.eveils = c.eveils || {}; if (c.lvl < E.MAX_LVL && c.xp >= E.heroXpNeed(c)) E.giveXp(S, c, 0); }); E.events.length = ev;
      report.push("0.1.12 : la montée au-delà du niveau 100 est deux fois plus rapide (l'XP demandée par niveau baisse de moitié entre les niveaux 100 et 120). Les héros qui avaient déjà l'XP nécessaire ont gagné leurs niveaux. Au niveau 200, un héros peut renaître (devenue la Maîtrise en 2.0 : Héros › Maîtrise).");
    }
    if (S.v < 10 && S.chars.some((c) => c.ren > 0)) { // 1.0.35 « Mémoire des vies » : un sort à apprendre par renaissance déjà faite (choix de Mathis 3A)
      S.chars.forEach((c) => { if (c.ren > 0) { c.mem = c.mem || []; c.memPend = Math.max(c.memPend || 0, Math.min(E.REN_MAX, c.ren) - c.mem.length); } });
      report.push("1.0.35 : les renaissances ne donnent plus d'XP en plus, chaque vie demande +50 % d'XP par niveau. En échange, chaque renaissance apprend un sort d'une autre classe : tes héros déjà renés ont un choix à faire par renaissance (devenue la Maîtrise en 2.0 : Héros › Maîtrise).");
    }
    if (S.v < 11 && S.chars.some((c) => c.ren > 0)) { // 2.0 « La Maîtrise » : la Renaissance disparaît (choix de Mathis : 2 % de l'XP des vies passées, 2 points par Éveil et par sort appris, retour au niveau 200)
      const ev = E.events.length; let lines = [];
      S.chars.forEach((c) => {
        const n = Math.min(E.REN_MAX, c.ren || 0); if (!n) return;
        if (c.renMt) { if (c.lvl < E.MAX_LVL) { S.recLv = (S.recLv || 0) + (E.MAX_LVL - c.lvl); while (c.lvl < E.MAX_LVL) { c.lvl++; c.pts += 5; } c.xp = 0; E.autoAllocate(S, c); } c.eveils = {}; c.mem = []; c.memPend = 0; c.memOffer = null; c.ren = 0; E.refreshSpells(c, E.charStats(S, c)); return; } // 2.0.3 : déjà converti (renaissance refaite sur une ancienne version du jeu restée en cache) : retour au niveau 200 sans nouveaux points
        let xp = 0; for (let k = 0; k < n; k++) for (let l = 1; l < E.MAX_LVL; l++) xp += Math.floor(E.xpNeed(l) * (1 + 0.5 * k)); // chaque vie demandait +50 % d'XP par renaissance
        const M = E.mt(c); const lv = Math.floor(xp * E.REN_TO_MT / E.mtBase());
        const evs = Object.values(c.eveils || {}).reduce((a, b) => a + (+b || 0), 0), sp = Math.max((c.mem || []).length, n); const bn = 2 * evs + 2 * sp;
        M.lvl += lv; M.bn = (M.bn || 0) + bn; c.renMt = { n, lv, bn, from: c.lvl };
        if (c.lvl < E.MAX_LVL) { S.recLv = (S.recLv || 0) + (E.MAX_LVL - c.lvl); while (c.lvl < E.MAX_LVL) { c.lvl++; c.pts += 5; } c.xp = 0; E.autoAllocate(S, c); } // en cours de vie : retour au niveau 200 (le serveur ne prend pas ces niveaux pour de la triche)
        c.eveils = {}; c.mem = []; c.memPend = 0; c.memOffer = null; E.refreshSpells(c, E.charStats(S, c));
        lines.push(`${c.name} : ${lv + bn} points (${lv} niveaux venus de ${n} vie${n > 1 ? "s" : ""}, ${bn} des Éveils et des sorts)`);
        c.ren = 0; // Mathis : plus d'affichage des vies (chiffre, aura, cadre de feu)
      });
      /* titres, aura et ornement de la Renaissance retirés ; un seul titre en souvenir (choix de Mathis) */
      const old = ["Né des cendres", "Flamme éternelle", "Phénix d'Idlus"]; S.titlesExtra = (S.titlesExtra || []).filter((t) => !old.includes(t));
      if (!S.titlesExtra.includes(E.REN_TITLE)) S.titlesExtra.push(E.REN_TITLE);
      S.chars.forEach((c) => { if (old.includes(c.title)) c.title = null; if (c.orn === "phenix") c.orn = null; }); if (S.unlocks) delete S.unlocks.phenix;
      E.events.length = ev;
      report.push(`2.0 « La Maîtrise » : la Renaissance laisse place à la Maîtrise. Les vies passées de tes héros deviennent des points de Maîtrise (2 % de leur XP, 2 points par Éveil et par sort appris) : ${lines.join(" ; ")}. Place-les dans Héros › Maîtrise. En souvenir, ton compte reçoit le titre « ${E.REN_TITLE} ».`);
    }
    { const old = ["Né des cendres", "Flamme éternelle", "Phénix d'Idlus"]; // 2.0.4 (choix de Mathis 1A) : un compte qui a renu garde le souvenir même si le héros rené a été congédié
      if (S.v < 12 && ((S.stats && S.stats.ren > 0) || (S.titlesExtra || []).some((t) => old.includes(t)) || (S.unlocks && S.unlocks.phenix) || S.chars.some((c) => c.renMt || old.includes(c.title) || c.orn === "phenix"))) {
        const had = (S.titlesExtra || []).includes(E.REN_TITLE); S.titlesExtra = (S.titlesExtra || []).filter((t) => !old.includes(t)); if (!had) S.titlesExtra.push(E.REN_TITLE);
        S.chars.forEach((c) => { if (old.includes(c.title)) c.title = null; if (c.orn === "phenix") c.orn = null; }); if (S.unlocks) delete S.unlocks.phenix;
        if (!had) report.push(`2.0.4 : les titres et l'ornement de la Renaissance laissent place au titre « ${E.REN_TITLE} », en souvenir des vies de tes héros.`); } }
    if (S.craftObj === undefined) E.craftObjConvert(S, report); // avant de compléter avec la partie neuve (qui a déjà craftObj)
    for (const k in fresh) if (S[k] === undefined) S[k] = fresh[k];
    Object.keys(GATHER_JOBS).forEach((j) => { if (!S.jobs[j]) S.jobs[j] = fresh.jobs[j]; });
    Object.keys(CRAFT_JOBS).forEach((j) => { if (!S.crafts[j]) S.crafts[j] = fresh.crafts[j]; });
    if (S.sub && !SUBS[S.sub]) { S.sub = null; S.hunting = false; }
    S.chars.forEach((c) => {
      c.spells = c.spells.filter((s) => E.spellDef(c.cls, s.id));
      if (!c.presets) c.presets = []; if (!c.zonePreset) c.zonePreset = {}; if (!c.sex) c.sex = CLASSES[c.cls].sex || "m";
      E.refreshSpells(c);
      for (const sl in c.equip) if (!S.items[c.equip[sl]]) delete c.equip[sl];
    });
    for (const k of ["cons", "boosts", "trophies", "families", "huntSeen"]) if (!S[k]) S[k] = {};
    if (!S.settings.auto) S.settings.auto = { action: "none", q: 40, keepSets: true };
    { const A = S.settings.auto; if (A.action === "sell") A.action = "break"; if (A.recycle === "sell") A.recycle = "break"; } // 0.1.38 : on brise au lieu de vendre
    if (E.sgConvert) E.sgConvert(S); // 0.1.48 : l'Expédition devient le Songe infini (Éclats et campement convertis en Bribes de rêve)
    S.migration = report.length ? report : null;
    if (S.v < 3) { const ev = E.events.length; checkHunt(S, Object.keys(S.bestiary).filter((k) => MONSTERS[k])); E.events.length = ev; S.journal = S.journal.filter((j) => !/^Palier /.test(j.txt)); }
    for (const uid in S.items) if (!ITEMS[S.items[uid].tpl]) delete S.items[uid];
    for (const uid in S.items) { const T = ITEMS[S.items[uid].tpl]; if (T.trophy) { S.trophies[T.trophy] = 1; delete S.items[uid]; } } // 1.0.20 : trophées passifs
    S.chars.forEach((c) => { for (const sl in c.equip) if (!S.items[c.equip[sl]]) delete c.equip[sl]; });
    E.syncGearLocks(S); // 1.0.25.11 : objets des tenues déjà enregistrées verrouillés au chargement
    if (!S.wellReset) { for (const uid in S.items) delete S.items[uid].well; S.wellReset = 1; } // 1.0.15.1 : reliquats gonflés par le bug de forgemagie remis à 0 (choix de Mathis), caractéristiques inchangées
    { const n = E.caracsMigrate(S); if (n) note(S, `Nouvelles caractéristiques : ${n} objet${n > 1 ? "s ont" : " a"} reçu ${n > 1 ? "leurs" : "ses"} lignes de PM, Tacle, Fuite ou Dommages de poussée, comme dans DOFUS.`, "info"); } // 1.0.30 (41A)
    if (S.radFixN) { note(S, `Rayonnants : ${S.radFixN > 1 ? `${S.radFixN} objets reviennent à leurs` : "1 objet revient à ses"} PA, Portée et Invocation normaux (le bonus Rayonnant ne les augmente plus) ; le reste du bonus est gardé.`, "info"); S.radFixN = 0; } // 1.2.10.2
    if (!S.coefT0) S.coefT0 = E.now(); // 1.0.30 : départ des coefficients de brisage au-dessus de 100 % (une seule fois)
    { const now = E.now(), base = E.coefAt(100, S.coefT0, now); for (const k in S.coef || {}) { const c = S.coef[k]; if (!c || E.coefAt(c.v, c.t, now) >= base) delete S.coef[k]; } } // 1.0.30 : coefficients revenus au niveau d'un objet jamais brisé
    (S.losses || []).forEach((x) => { if (x && x.tgt && !Number.isFinite(x.tgt.pct)) { x.tgt.pct = 100; x.cause = "bug"; x.gear = []; x.place = 0; x.txt = `${x.tgt.name || "Le monstre"} ne pouvait plus perdre de PV (bug de la 1.2.6, corrigé) : cette défaite n'était pas de ta faute.`; } }); // 1.2.6.3 : rapports de défaite « NaN % de PV »
    if (S.v < 13 && E.MT_RESET && S.chars.some((c) => c.mt)) { /* reset des Maîtrises avec la Maîtrise lente (Mathis 16/10 : 1D 2A 3A 4A 5A 6A) : niveaux, XP, points des vies passées (3A),
         étoiles des 3 arbres, objectif et titres des branches remis à 0 ; joyaux rendus dans le sac (4A) ; titre « Pionnier des étoiles » si un héros avait 100 points (6A) */
      const brT = Object.values(E.MT_BR_TITLE || {}); let best = 0, n = 0;
      S.chars.forEach((c) => { if (!c.mt) return; const p = E.mtPts(c); best = Math.max(best, p); if (p > 0) n++; delete c.mt; if (brT.includes(c.title)) c.title = null; });
      S.titlesExtra = (S.titlesExtra || []).filter((t) => !brT.includes(t));
      if (best >= 100 && !S.titlesExtra.includes(E.MT_PIONNIER)) S.titlesExtra.push(E.MT_PIONNIER);
      if (n) report.push(`Maîtrise lente : les Maîtrises repartent de 0 pour tout le monde${best >= 100 ? ` (titre « ${E.MT_PIONNIER} » en souvenir)` : ""}. Les joyaux sertis sont rendus dans ton sac. Chaque point coûte maintenant un peu plus que le précédent.`); S.migration = report;
    }
    S.v = E.VERSION;
    if (E.mtGateSync) { S.mtGates = E.mtGatesOpen(S); E.mtGateSync(S); } // 2.1 : Portes des étoiles déjà méritées, sans message
    if (E.btOrnSync) E.btOrnSync(S); if (E.btTitleSync) E.btTitleSync(S); if (E.mtBrSync) E.mtBrSync(S); // 2.0 : ornements du Bestiaire déjà gagnés
    return S;
  };

  /* ---------------- Actions du joueur ----------------
     La liste officielle de tout ce qu'un joueur peut faire qui change sa partie.
     En multijoueur, c'est exactement ce que le jeu enverra au serveur : { action, arguments }.
     Le serveur appliquera E.act(S, action, ...arguments) avec ce même moteur, et refusera tout le reste.
     Chaque action prend la partie S en premier argument et renvoie null / undefined si tout va bien,
     sinon un message d'erreur (ou un résultat). Le temps qui passe (E.tick, E.catchUp) n'est pas une action :
     c'est le serveur qui le fera avancer avec son horloge (E.setClock).
     Nouvelle fonction du moteur appelée par un bouton du jeu et qui modifie la partie : l'ajouter ici.
     Encore modifiés directement par l'écran (à transformer en actions avec les comptes en ligne) :
     apparence des héros, favoris et verrous d'objets, liste de courses, objectifs épinglés terminés, réglages. */
  E.ACTIONS = {
    // héros et équipe
    recruit: "recruter un héros", dismiss: "congédier un héros", toggleTeam: "entrer ou sortir de l'équipe", setRow: "placer un héros (ligne)", setPlaceAuto: "placement automatique",
    allocate: "dépenser un point de caractéristique", deallocate: "retirer un point", resetPoints: "réinitialiser les points",
    setAllocMode: "répartition auto ou manuelle", autoAllocate: "relancer la répartition auto", equipSpell: "placer un sort dans la barre",
    setTitle: "choisir un titre", setOrn: "choisir un ornement", setFrame: "choisir un cadre", setWing: "choisir des ailes",
    renaissance: "Renaissance d'un héros", chooseAlign: "choisir un alignement", setTraining: "envoyer en salle d'entraînement",
    // équipement
    equip: "équiper un objet", unequip: "retirer un objet", breakItem: "briser un objet",
    overTake: "reprendre un objet du trop-plein", overBreak: "briser un objet du trop-plein", overBreakAll: "vider le trop-plein", breakDupes: "briser les doublons",
    saveGear: "enregistrer un équipement", applyGear: "porter un équipement enregistré", deleteGear: "supprimer un équipement enregistré",
    applyBuild: "appliquer un build partagé", applyAuto: "réglages du tri automatique",
    savePreset: "enregistrer une stratégie de sorts", saveIdolPreset: "enregistrer un jeu d'idoles", loadIdolPreset: "charger un jeu d'idoles", applyPreset: "appliquer un préréglage", deletePreset: "supprimer un préréglage",
    saveComp: "enregistrer une composition", applyComp: "appliquer une composition", delComp: "supprimer une composition", setZonePreset: "préréglage par zone",
    // chasse, donjons, combat
    startHunt: "partir chasser", stopHunt: "arrêter de chasser", enterDungeon: "entrer en donjon", leaveDungeon: "quitter le donjon", stopChain: "arrêter l'enchaînement de donjons",
    manualCast: "lancer un sort (mode manuel)", manualEnd: "finir son tour (mode manuel)", protFight: "affronter le protecteur",
    toggleIdol: "activer une idole", clearIdols: "retirer les idoles", rerollBounty: "changer d'avis de recherche",
    // métiers, forge, ressources
    setJob: "choisir un métier de récolte", upgradeTool: "améliorer un outil", gameBuySell: "livrer une commande du jour", gameBuyAll: "livrer toutes les commandes du jour",
    craftItem: "fabriquer un objet", craftSpecial: "fabrication spéciale", craftMany: "fabriquer en série", craftScroll: "fabriquer un parchemin",
    forgemage: "forgemager", transForge: "rune de transcendance", signItem: "signer un objet", startFmPlan: "lancer un plan de forgemagie", stopFmPlan: "arrêter un plan de forgemagie",
    fuseRunes: "fusionner des runes", transmute: "transmuter", exoForge: "exomagie", exoCraft: "fabriquer une rune exo",
    useConsumable: "utiliser un consommable", buyShop: "acheter en boutique", buyNets: "acheter des filets",
    // Havre-Sac, familiers, montures
    buyHavre: "agrandir le Havre-Sac", growRoom: "agrandir une pièce du Havre-Sac", buyFurn: "acheter un meuble (boutique de la maison)", placeFurn: "placer un meuble", unplaceFurn: "ranger un meuble",
    buildAtelier: "construire l'atelier", setAtelier: "choisir la recette de l'atelier", buildEnclos: "construire l'enclos",
    equipPet: "équiper un familier", equipMount: "équiper une monture", setMountShare: "part d'XP pour la monture",
    startBreed: "lancer un accouplement", stopBreed: "arrêter l'accouplement", releaseMount: "relâcher une monture",
    // divers
    almanaxOffer: "offrande de l'Almanax", togglePin: "épingler un objectif", redeemGift: "utiliser un code cadeau",
  };
  E.act = (S, name, ...args) => {
    if (!Object.prototype.hasOwnProperty.call(E.ACTIONS, name) || typeof E[name] !== "function") return `Action inconnue : ${name}`;
    return E[name](S, ...args);
  };

  root.ENGINE = E;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
