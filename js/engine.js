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

  const E = {};
  E.VERSION = 9;
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

  /* ---------------- Aléatoire & utilitaires ---------------- */
  let rnd = Math.random;
  E.setRng = (f) => { rnd = f; };
  E.rnd = () => rnd();
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
  Object.values(GATHER_JOBS).forEach((j) => j.items.forEach(([r, l]) => (RES_LVL[r] = Math.max(1, Math.round(l / 2)))));
  E.resPrice = (name) => {
    if (SPECIAL_CRAFTS[name]) return 0;
    const l = RES_LVL[name] || (RES[name] && RES[name].lvl) || 5;
    return Math.max(1, Math.round(2 + l * 0.7));
  };
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
  E.REN_MAX = 10; E.REN_XP = 0.3;
  E.renXpMult = (c) => 1 + E.REN_XP * (c.ren || 0);
  E.eveil = (c, id) => (c && c.eveils && c.eveils[id]) || 0;
  E.recruitCost = (n) => (n <= 1 ? 0 : Math.round(300 * Math.pow(2.2, n - 2))); // n = numéro du personnage

  /* ---------------- État initial ---------------- */
  E.newState = (name, cls) => {
    const S = {
      v: E.VERSION, created: Date.now(), savedAt: 0, lastTick: Date.now(),
      kamas: 0, nextUid: 1, nextCid: 1,
      chars: [], items: {}, res: {}, runes: {},
      sub: null, hunting: false, zstars: {},
      progress: { wins: {}, bossKills: {} },
      history: [], zoneStats: {}, seenDrops: {}, radiants: 0,
      cons: {}, boosts: {}, trophies: {}, families: {}, huntSeen: {},
      jobs: {}, crafts: {}, coef: {}, tools: {}, finds: 0,
      fmJob: { lvl: 1, xp: 0 }, // 0.1.8.2 : métier de Forgemage
      fmPlans: [], // 0.1.9.1 : forgemagie automatique
      bestiary: {}, archis: {},
      stats: { fights: 0, wins: 0, recent: [], playtime: 0 },
      settings: { theme: "dark", chalAI: false, autoZone: false, auto: { action: "sell", q: 50, keepSets: true, recycle: "sell" } },
      journal: [],
      dungeon: null,
      pets: {}, petUid: 1, petKeep: {}, petLuck: {},
      mounts: {}, mountUid: 1, mountSeen: {}, enclos: { built: false, pairs: [], births: 0 },
      idols: { own: {}, active: [], presets: [] },
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
    if (E.team(S).length > 8) c.inTeam = false;
    return c;
  };

  E.team = (S) => S.chars.filter((c) => c.inTeam && !c.job).slice(0, 8);
  E.freeSpirit = (S) => FREE_SPIRIT[Math.max(1, E.team(S).length)] || 0;
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
  E.boostPct = (S, kind, at = Date.now()) => { const b = S.boosts && S.boosts[kind]; return b && b.until > at ? b.pct : 0; };
  E.boostLeft = (S, kind) => { const b = S.boosts && S.boosts[kind]; return b ? Math.max(0, (b.until - Date.now()) / 1000) : 0; };
  E.addCons = (S, id, n = 1) => { S.cons[id] = (S.cons[id] || 0) + n; };
  E.useConsumable = (S, id, arg) => {
    const C = CONSUMABLES[id]; if (!C) return "Objet inconnu.";
    if (!(S.cons[id] > 0)) return "Vous n'en avez plus.";
    if (C.kind !== "boost") return E.useSpecial ? E.useSpecial(S, id, arg) : "Inutilisable.";
    const now = Date.now(); const b = S.boosts[C.boost];
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
        S.trophies[sub.id] = 1;
        if (E.itemCount(S) < E.itemCap(S)) { E.rollItem(S, "trophee_" + sub.id, { radiant: false }); note(S, `Trophée obtenu : ${sub.name} !`, "rare"); }
      }
    });
  };
  E.checkHunt = checkHunt;

  /* ---------------- Sorts (v3 : vrais kits DOFUS 3, grades et variantes) ---------------- */
  E.DMG_SCALE = 0.62; // calibrage des valeurs DOFUS pour le combat automatique
  E.spellSlots = (c) => 6 + (c.lvl >= 50 ? 1 : 0) + (c.lvl >= 100 ? 1 : 0);
  E.spellDef = (cls, id) => CLASSES[cls] && CLASSES[cls].spells.find((s) => s.id === id);
  E.spellGrade = (sp, lvl) => { let g = sp.grades[0]; for (const x of sp.grades) if (x.lvl <= lvl) g = x; return g; };
  E.knownSpells = (c) => CLASSES[c.cls].spells.filter((s) => s.lvl <= c.lvl);
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
    c.spells = (c.spells || []).filter((x) => { const d = E.spellDef(c.cls, x.id); return d && d.lvl <= c.lvl; });
    if (!c.spellsManual) { c.spells = E.autoLoadout(c, st); c.knownSeen = known.map((s) => s.id); return; }
    const usedPairs = new Set(c.spells.map((x) => E.spellDef(c.cls, x.id).pair));
    const fresh = known.filter((sp) => !(c.knownSeen || []).includes(sp.id) && !usedPairs.has(sp.pair)).sort((a, b) => spellScore(c, b, st) - spellScore(c, a, st));
    for (const sp of fresh) { if (c.spells.length >= slots) break; if (usedPairs.has(sp.pair)) continue; c.spells.push({ id: sp.id, cond: defaultCond(sp, c), tgt: "low" }); usedPairs.add(sp.pair); }
    c.knownSeen = known.map((s) => s.id);
  };
  /* équiper un sort : remplace la variante de la même paire si elle est équipée */
  E.equipSpell = (S, c, id) => {
    const sp = E.spellDef(c.cls, id); if (!sp || sp.lvl > c.lvl) return "Sort non disponible."; c.spellsManual = true;
    const i = c.spells.findIndex((x) => E.spellDef(c.cls, x.id).pair === sp.pair);
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
    const counts = E.setCounts(S, c);
    for (const s in counts) { const b = E.setBonus(s, counts[s]); if (b) addStats(st, b); }
    st.hpMax = Math.round((50 + 5 * c.lvl + st.vit + E.familyBonusVit(S)) * (1 + 0.05 * E.eveil(c, "robu")));
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
  /* répartition automatique : élément principal jusqu'au palier choisi, puis Vitalité */
  E.AUTO_CAPS = [100, 200, 300, 9999];
  E.autoAllocate = (S, c) => {
    if (!c.autoStat || c.pts <= 0) return;
    const cap = c.autoStat === "vit" || c.autoStat === "sa" ? 9999 : c.autoCap || 200;
    while (c.pts > 0 && c.alloc[c.autoStat] < cap) { if (!E.allocate(S, c.id, c.autoStat, 1)) break; }
    if (c.pts > 0 && c.alloc[c.autoStat] >= cap) E.allocate(S, c.id, c.autoThen || "vit", c.pts);
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
    S.journal.unshift({ t: Date.now(), txt, kind });
    if (S.journal.length > 60) S.journal.length = 60;
    E.events.push({ txt, kind });
  };
  E.note = note;
  /* moments de récompense (3.1.3) : grands écrans côté interface, sans entrée de journal */
  E.celebrate = (data) => { E.events.push(Object.assign({ kind: "cele", txt: "" }, data)); };

  /* ---------------- Objets ---------------- */
  /* Objets Rayonnants : très rares, +10 à +50 % sur les statistiques positives de l'objet */
  E.RADIANT_CHANCE = 1 / 400;
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
      for (const k in MONSTERS) (MONSTERS[k].items || []).forEach(([id]) => { drop[id] = MONSTERS[k].boss ? "epique" : drop[id] === "epique" ? "epique" : "rare"; });
      for (const id in ITEMS) {
        const T = ITEMS[id];
        rarityCache[id] = E.RARITY[T.rarity] ? T.rarity : T.slot === "dofus" ? "legendaire" : drop[id] || (T.set ? "peu" : "commun");
      }
    }
    return rarityCache[tpl] || "commun";
  };
  E.rollItem = (S, tpl, opts = {}) => {
    const T = ITEMS[tpl]; const roll = {};
    for (const k in T.stats) { const [a, b] = T.stats[k]; roll[k] = ri(a, b); }
    const it = { uid: S.nextUid++, tpl, stats: Object.assign({}, roll) };
    const chance = opts.radiant === true ? 1 : E.RADIANT_CHANCE * (opts.archi ? 5 : 1) * (opts.champ ? 2 : 1) * E.radiantMult(S);
    if (opts.radiant !== false && rnd() < chance) {
      it.radiant = E.radiantBonus(); it.roll = roll;
      for (const k in it.stats) if (it.stats[k] > 0) it.stats[k] = Math.ceil(it.stats[k] * (1 + it.radiant / 100));
      S.radiants = (S.radiants || 0) + 1;
      note(S, `✦ Objet Rayonnant : ${T.name} (+${it.radiant} %) !`, "radiant");
      E.celebrate({ t: "radiant", tpl, pct: it.radiant });
    }
    S.items[it.uid] = it; return it;
  };
  E.itemQuality = (it) => {
    const T = ITEMS[it.tpl]; const base = it.roll || it.stats; let s = 0, n = 0;
    for (const k in T.stats) { const [a, b] = T.stats[k]; s += b === a ? 1 : (base[k] - a) / (b - a); n++; }
    return n ? s / n : 1;
  };
  E.qualityTier = (q) => (q >= 0.999 ? "parfait" : q >= 0.8 ? "excellent" : q >= 0.5 ? "bon" : "commun");
  E.itemCount = (S) => Object.keys(S.items).length;
  E.ITEM_CAP = 300;
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
    if (T.lvl > c.lvl) return `Niveau ${T.lvl} requis.`;
    if (it.exo === "pa" && Object.values(c.equip).some((u) => u !== uid && S.items[u] && S.items[u].exo === "pa")) return "Ce héros porte déjà un objet exo PA (un seul par héros).";
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

  E.sellItem = (S, uid) => {
    const it = S.items[uid]; if (!it || E.equippedBy(S, uid) || it.locked || E.inGear(S, uid)) return 0;
    const T = ITEMS[it.tpl]; const p = Math.round(T.lvl * 6 * (0.6 + E.itemQuality(it) * 0.6) * (it.radiant ? 5 : 1));
    delete S.items[uid]; S.kamas += p; return p;
  };
  E.sellRes = (S, name, qty) => {
    const have = S.res[name] || 0; const n = Math.min(have, qty); if (n <= 0) return 0;
    const p = E.resPrice(name) * n; S.res[name] -= n; if (!S.res[name]) delete S.res[name]; S.kamas += p; return p;
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
  E.subUnlocked = (S, sid) => {
    const s = SUBS[sid]; if (!s || !E.zoneUnlocked(S, s.zone)) return false;
    if (s.requiresItem) return (S.res[s.requiresItem] || 0) > 0;
    return true;
  };
  E.dungeonUnlocked = (S, did) => E.subUnlocked(S, DUNGEON_SUB[did]);
  E.setSub = (S, sid) => {
    if (!E.subUnlocked(S, sid)) return false;
    S.sub = sid; if (!S.dungeon) S.fight = null; return true;
  };
  /* Chasse : on choisit une sous-zone et l'équipe y combat en boucle */
  E.startHunt = (S, sid) => {
    if (S.dungeon) return "Vous êtes en donjon.";
    if (!E.setSub(S, sid)) return "Sous-zone verrouillée.";
    pinStars(S, sid); // les étoiles cessent de monter et fondent à partir de maintenant
    S.hunting = true; S.fight = null; S.pause = E.PAUSE_MS;
    E.applyZonePresets(S, sid);
    note(S, `Chasse : ${SUBS[sid].name}`, "info");
    return null;
  };
  E.stopHunt = (S) => { if (S.dungeon) return "Quittez d'abord le donjon."; S.hunting = false; S.fight = null; return null; };

  /* ---------------- Étoiles de zone (0.1.8.1) ----------------
     Une zone où personne ne chasse gagne une étoile toutes les 2 h (5 au plus) ; chacune donne +10 % d'XP et de butin.
     Elles fondent pendant qu'on y chasse (une toutes les 30 min, en ligne comme hors ligne).
     S.zstars[sid] = { s: étoiles au moment at, at } ; sans fiche, la zone accumule depuis la création de la partie. */
  E.STAR_MAX = 5; E.STAR_GROW_S = 7200; E.STAR_MELT_S = 1800; E.STAR_PCT = 10;
  const huntingHere = (S, sid) => S.hunting && S.sub === sid && !S.dungeon;
  E.zoneStars = (S, sid, now = Date.now()) => {
    const rec = S.zstars && S.zstars[sid];
    if (!rec) return clamp((now - (S.created || now)) / 1000 / E.STAR_GROW_S, 0, E.STAR_MAX);
    if (huntingHere(S, sid)) return rec.s;
    return clamp(rec.s + Math.max(0, now - rec.at) / 1000 / E.STAR_GROW_S, 0, E.STAR_MAX);
  };
  /* fige la valeur courante (à l'arrivée dans la zone : la fonte part de là) */
  const pinStars = (S, sid, now = Date.now()) => { if (!S.zstars) S.zstars = {}; const rec = S.zstars[sid]; /* 0.1.10.2 : la pousse est comptée même si S.sub vient de passer sur cette zone */
    S.zstars[sid] = { s: rec ? clamp(rec.s + Math.max(0, now - rec.at) / 1000 / E.STAR_GROW_S, 0, E.STAR_MAX) : E.zoneStars(S, sid, now), at: now }; };
  /* fonte pendant la chasse : dtS secondes de chasse dans la zone courante */
  E.starsTick = (S, dtS, now = Date.now()) => {
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
  E.roam = (S, t = Date.now(), offline = false) => {
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
    c.activePreset = idx;
  };
  E.applyPreset = (S, cid, idx) => {
    const c = S.chars.find((x) => x.id === cid); const p = c && c.presets[idx]; if (!p) return false;
    c.spells = p.spells.filter((x) => { const d = E.spellDef(c.cls, x.id); return d && d.lvl <= c.lvl; }).slice(0, E.spellSlots(c)).map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt || "low" })); c.spellsManual = true;
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
  E.deleteGear = (S, cid, idx) => { const c = S.chars.find((x) => x.id === cid); if (c && c.gear) c.gear[idx] = null; };
  E.gearMissing = (S, c, g) => Object.values(g.eq).filter((uid) => !S.items[uid]).length;
  /* un objet rangé dans une tenue est protégé comme un objet porté (ni vendu, ni brisé) */
  E.inGear = (S, uid) => S.chars.find((c) => (c.gear || []).some((g) => g && Object.values(g.eq).includes(uid))) || null;

  /* ---------------- Codes de build (3.1.3) : partager sorts, caractéristiques et équipement ---------------- */
  E.BUILD_PREFIX = "IDLUS1-";
  const b64e = (str) => (typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, "utf8").toString("base64"));
  const b64d = (str) => (typeof atob !== "undefined" ? decodeURIComponent(escape(atob(str))) : Buffer.from(str, "base64").toString("utf8"));
  E.buildCode = (S, c) => {
    const eq = {}; for (const sl in c.equip) { const it = S.items[c.equip[sl]]; if (it) eq[sl] = it.tpl; }
    const o = { v: 1, cls: c.cls, lvl: c.lvl, n: c.name, st: Object.assign({}, c.alloc), as: c.autoStat || "", ac: c.autoCap || 200, at: c.autoThen || "vit",
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
      at: BASE_STATS.includes(o.at) ? o.at : "vit", sp, eq };
  };
  E.applyBuild = (S, cid, b) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || !b) return "Héros introuvable.";
    if (c.cls !== b.cls) return `Ce build est pour un ${CLASSES[b.cls].name}.`;
    c.spells = b.sp.filter((x) => E.spellDef(c.cls, x.id).lvl <= c.lvl).slice(0, E.spellSlots(c)).map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt }));
    c.spellsManual = true; c.activePreset = null;
    c.autoStat = b.as || null; c.autoCap = b.ac; c.autoThen = b.at;
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
  E.MON_POW = {
    hunt: [[15, 1, 1], [30, 4.5, 4]],
    dg: [[20, 1, 1], [90, 1.3, 2.2], [130, 1.3, 2.2], [180, 1.1, 1.6]],
    minGroup: (sub) => (sub && sub.lvl && sub.lvl[1] >= 25 ? 4 : 1), rew: 0.57,
  };
  E.monPow = (l, k, where) => {
    const P = E.MON_POW[where], j = k === "hp" ? 1 : 2;
    if (l <= P[0][0]) return P[0][j];
    for (let i = 1; i < P.length; i++) if (l < P[i][0]) { const a = P[i - 1], b = P[i]; return a[j] + (b[j] - a[j]) * (l - a[0]) / (b[0] - a[0]); }
    return P[P.length - 1][j];
  };
  E.powRew = (mons, where) => { const pw = mons.reduce((a, m) => a + E.monPow(m.lvl, "hp", where), 0) / Math.max(1, mons.length); return Math.max(1, 1 + (pw - 1) * E.MON_POW.rew); };
  const powMons = (mons, where) => mons.forEach((m) => { m.hpMax = m.hp = Math.round(m.hpMax * E.monPow(m.lvl, "hp", where)); m.dmg *= E.monPow(m.lvl, "dmg", where); });
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
  const charEntity = (S, c) => {
    const st = E.charStats(S, c);
    const fs = E.freeSpirit(S);
    const hpMax = Math.round(st.hpMax * (1 + fs / 200) * (E.teamHas(S, "osa") ? 1.05 : 1) * (1 + E.bonus(S, "hp") / 100));
    return {
      side: "c", cid: c.id, name: c.name, cls: c.cls, lvl: c.lvl, st, hpMax, hp: hpMax,
      ini: st.ini, buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, weaken: 0, paLoss: 0, stack: 0, suffer: 0, nCast: 0, els: [],
      evc: E.eveil(c, "classe"), ev: c.eveils || {}, // 0.1.12 : Éveils (Renaissance)
    };
  };
  /* Bonus « petit groupe » en donjon : PV en plus et dégâts subis en moins pour les équipes de 1 ou 2 héros. */
  E.SMALL_TEAM = { 1: { hp: 30, dr: 15, name: "Solo" }, 2: { hp: 15, dr: 7.5, name: "Duo" } };
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
  /* Champions de chasse : 1 combat sur 100, un monstre du groupe devient Champion (PV ×2, dégâts +20 %, un pouvoir) */
  E.CHAMP_CHANCE = 1 / 100;
  E.CHAMP_POWERS = {
    enrage:   { name: "Enragé",     desc: "+25 % de dégâts sous 50 % de PV." },
    blinde:   { name: "Blindé",     desc: "Bouclier de 15 % de ses PV au début du combat." },
    vampire:  { name: "Vampirique", desc: "Vole 15 % des dégâts qu'il inflige." },
    veloce:   { name: "Véloce",     desc: "Joue avant les héros." },
    meneur:   { name: "Meneur",     desc: "Ses alliés font +10 % de dégâts tant qu'il est debout." },
    traqueur: { name: "Traqueur",   desc: "Vise le héros qui a le moins de PV." },
  };
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
      g.push(monsterEntity(id, Math.max(1, lvl), { archi: rnd() < E.ARCHI_CHANCE * E.archiMult(S) * fl }));
    }
    if (rnd() < E.CHAMP_CHANCE) { const cand = g.filter((m) => !m.archi); if (cand.length) E.makeChampion(pick(cand)); }
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
    for (let i = 0; out.length < n && i < 40; i++) { const k = pool[x % pool.length]; if (!out.includes(k)) out.push(k); x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; }
    if (sig) out.push(sig);
    return out;
  };

  /* ---------------- Challenges ---------------- */
  E.CHALLENGES = {
    survivant:  { name: "Survivant",          diff: 5,  desc: "Aucun héros ne doit tomber." },
    versatile:  { name: "Versatile",          diff: 5,  desc: "Chaque sort au plus une fois par tour." },
    econome:    { name: "Économe",            diff: 8,  desc: "Ne jamais lancer le même sort deux fois de suite." },
    focus:      { name: "Focus",              diff: 8,  desc: "Une fois un monstre attaqué, le tuer avant d'en attaquer un autre." },
    elitiste:   { name: "Élitiste",           diff: 8,  desc: "Tuer d'abord le monstre désigné." },
    ordonne:    { name: "Ordonné",            diff: 8,  desc: "Tuer les monstres du plus haut au plus bas niveau." },
    incurable:  { name: "Incurable",          diff: 12, desc: "Aucun soin (ni sort de soin, ni vol de vie)." },
    elementaire:{ name: "Élémentaire",        diff: 12, desc: "N'utiliser qu'un seul élément pendant tout le combat." },
    barbare:    { name: "Barbare",            diff: 8,  desc: "Aucun sort de protection : ni bouclier, ni bonus de caractéristiques." },
    rapide:     { name: "Rapide",             diff: 0,  desc: "Terminer le combat en peu de tours." },
    chacun:     { name: "Chacun son monstre", diff: 12, desc: "Chaque héros n'attaque qu'un seul monstre." },
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
    while (out.length < n && pool.length) { const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; const ch = { id, ok: true };
      if (id === "rapide") { ch.turns = 2 + Math.ceil(mons.length / Math.max(1, heroes.length)) + (F.dungeon ? 1 : 0); ch.bonus = Math.max(5, 14 - ch.turns * 2); } else ch.bonus = E.CHALLENGES[id].diff;
      if (id === "elitiste") { const t = mons.slice().sort((a, b) => (b.boss ? 1e6 : 0) + b.lvl - ((a.boss ? 1e6 : 0) + a.lvl))[0]; ch.target = F.ents.indexOf(t); }
      out.push(ch); }
    return out;
  };
  const chal = (F, id) => (F.chals || []).find((c) => c.id === id && c.ok);
  const failChal = (F, id, why) => { const c = chal(F, id); if (!c) return; c.ok = false; c.why = why; flog(F, `Challenge ${E.CHALLENGES[id].name} échoué${why ? " : " + why : ""}.`, "lose"); };
  E.chalRespect = (S, c) => !!(S.settings && S.settings.chalAI) && !(c && c.chalOff);

  /* ---------------- Stasis (3.1) ---------------- */
  E.STASIS_MAX = 10;
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
  ];
  E.stasisInfo = (S, did) => { S.stasis = S.stasis || {}; return (S.stasis[did] = S.stasis[did] || { max: 0, sel: 1, firsts: {}, best: {} }); };
  E.stasisMult = (k) => ({ hp: 1 + 0.12 * (k - 1), dmg: Math.pow(1.2, k - 1), rew: 1 + 0.15 * (k - 1) });
  /* caractéristique des parchemins de chaque donjon (élément du boss) */
  E.dungeonScrollStat = (did) => { const dg = DUNGEONS[did]; const el = (MONSTERS[dg.boss] || {}).el; const ids = Object.keys(DUNGEONS).sort(); if (ids.indexOf(did) % 5 === 4) return "sa"; return { t: "fo", f: "ine", e: "cha", a: "age" }[el] || "vit"; };
  const pickMods = (n, first) => { const ks = Object.keys(E.STASIS_MODS).filter((x) => !E.STASIS_MODS[x].flash); const out = first ? [first] : []; while (out.length < n) { const k = pick(ks); if (!out.includes(k)) out.push(k); } return out; };
  /* Mutateur de la semaine (3.1.3) : chaque semaine, un donjon reçoit un modificateur imposé (à toutes les stasis)
     et donne +25 % d'XP et de butin, +50 % de poussière. Dès la stasis 6, il remplace un des modificateurs tirés au sort. */
  E.WEEKLY_REW = 1.25; E.WEEKLY_DUST = 1.5;
  E.WEEKLY_MODS = ["enrages", "blindes", "vampires", "nombreux"]; // « Véloces » exclu : trop punitif sans équipement (simulation)
  E.weekIdx = (t = Date.now()) => Math.floor((t / 86400000 + 3) / 7); // semaines commençant le lundi (UTC)
  E.weekEnd = (t = Date.now()) => ((E.weekIdx(t) + 1) * 7 - 3) * 86400000;
  E.weekly = (S, t = Date.now()) => {
    const w = E.weekIdx(t);
    if (S.weekly && S.weekly.w === w && DUNGEONS[S.weekly.did]) return S.weekly;
    const ids = Object.keys(DUNGEONS).sort().filter((d) => E.dungeonUnlocked(S, d)); if (!ids.length) return null;
    const top = Math.max(...S.chars.map((c) => c.lvl));
    const near = ids.filter((d) => DUNGEONS[d].lvl <= top + 5 && DUNGEONS[d].lvl >= top - 40);
    const pool = near.length ? near : ids.filter((d) => DUNGEONS[d].lvl <= Math.max(top + 5, Math.min(...ids.map((x) => DUNGEONS[x].lvl))));
    let x = Math.imul(w ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    const mods = E.WEEKLY_MODS;
    S.weekly = { w, did: pool[x % pool.length], mod: mods[(x >>> 8) % mods.length] };
    return S.weekly;
  };
  /* Mutateur éclair (0.1) : toutes les 20 minutes, 3 donjons (niveaux 1-79, 80-149, 150-200) reçoivent un modificateur
     et donnent un petit bonus. Une course commencée garde son bonus jusqu'au bout. Les donjons ne tournent pas hors ligne. */
  E.FLASH_MS = 20 * 60000; E.FLASH_REW = 1.12; E.FLASH_DUST = 1.25;
  E.FLASH_MODS = ["enrages", "blindes", "vampires", "nombreux", "champions", "ruse", "renforts"];
  E.flashIdx = (t = Date.now()) => Math.floor(t / E.FLASH_MS);
  E.flashEnd = (t = Date.now()) => (E.flashIdx(t) + 1) * E.FLASH_MS;
  /* Tranches fixes, identiques pour tous les joueurs (Mathis, 0.1) */
  E.FLASH_TIERS = [["bas", 1, 79], ["milieu", 80, 149], ["haut", 150, 200]];
  const flashCache = {};
  E.flash = (S, t = Date.now()) => {
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
  const applyStasis = (S, F, mons, room, isBoss) => {
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
      if (k >= 10) { b.legend = true; b.name = b.name + " Légendaire"; b.hpMax = b.hp = Math.round(b.hpMax * 1.5); const keys = pool.filter((x) => !b.mech.includes(x)); while (b.mech.length < 3 && keys.length) b.mech.push(keys.splice(Math.floor(rnd() * keys.length), 1)[0]); }
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
    if (X.champion && !opts.late && !mons.some((m) => m.champ)) { const c = mons.filter((m) => !m.archi && !m.boss); if (c.length) E.makeChampion(c[c.length - 1]); }
    mons.forEach((m) => { if (X.shield0) m.shield = Math.max(m.shield || 0, Math.round(m.hpMax * X.shield0 / 100)); });
    return mons;
  };
  E.startFight = (S) => {
    const team = E.team(S); if (!team.length) return null;
    const IX = E.idolFx(S, S.dungeon);
    let mons, label, bossIdx = -1;
    if (S.dungeon) {
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
        const k = S.dungeon.stasis || 1; const blv = k >= 4 ? Math.max(bm.lvl[0], (S.dungeon.syncLvl || 0) + 2) : bm.lvl[0];
        const boss = monsterEntity(dg.boss, blv);
        const hk = (1 + team.length * 1.1) / 5; boss.hpMax = boss.hp = Math.round(boss.hpMax * hk);
        boss.mech = E.bossMechs(S.dungeon.id); boss.mturn = 0; (S.bossSeen = S.bossSeen || {})[S.dungeon.id] = 1;
        mons = [boss];
        const extra = clamp(team.length - 1 + ((S.dungeon.mods || []).includes("renforts") ? 2 : 0) + (IX ? IX.extra : 0), 0, 7);
        const mlv = k >= 4 ? Math.max(dg.lvl, S.dungeon.syncLvl || 0) : dg.lvl;
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
    powMons(mons, S.dungeon ? "dg" : "hunt");
    if (IX) applyIdols(IX, mons);
    const front = E.frontSet(S);
    const ents = team.map((c) => Object.assign(charEntity(S, c), { row: front.has(c.id) ? "f" : "b" })).concat(mons);
    if (IX && IX.heroPa) ents.forEach((e) => { if (e.side === "c") e.st = Object.assign({}, e.st, { pa: Math.max(1, e.st.pa - IX.heroPa) }); });
    if (IX && IX.resMain) { const cnt = {}; ents.forEach((e) => { if (e.side === "c") { const k = bestEl(e.st); cnt[k] = (cnt[k] || 0) + 1; } }); IX.resEl = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null; }
    /* 0.1 : bonus « petit groupe » en donjon (solo et duo) */
    const sm = S.dungeon ? E.SMALL_TEAM[team.length] : null;
    if (sm) ents.forEach((e) => { if (e.side === "c") { e.hpMax = e.hp = Math.round(e.hpMax * (1 + sm.hp / 100)); e.smallDr = sm.dr; } });
    const ch = mons.find((m) => m.champ); if (ch) note(S, `Un Champion apparaît : ${ch.name} (${E.CHAMP_POWERS[ch.champ].name}) !`, "rare");
    var fsub = S.dungeon ? null : S.sub, fdg = S.dungeon ? S.dungeon.id : null;
    const F = S.fight = { id: (S.fightSeq = (S.fightSeq || 0) + 1), label, ents, round: 1, order: [], oi: 0, log: [], over: false, result: null, dur: 0, dungeon: !!S.dungeon, seq: 0, fx: [], sub: fsub, dungeonId: fdg, deaths: [] };
    if (!S.dungeon && S.protector && S.protector.fighting) F.prot = true;
    F.stasis = S.dungeon ? S.dungeon.stasis || 1 : 0; F.weekly = S.dungeon && S.dungeon.weekly || null; F.flash = S.dungeon && S.dungeon.flash || null;
    F.chals = pickChallenges(S, F, S.dungeon ? 2 : 1);
    F.idol = IX; if (IX) { F.idolScore = IX.score; F.idolBonus = IX.bonus; }
    F.powRew = E.powRew(mons, S.dungeon ? "dg" : "hunt"); // 0.1.12.3 : monstres renforcés, gains par monstre en proportion
    F.cs = { focus: {}, first: {}, last: {}, turnCasts: {}, el: null, hitTurn: {} };
    const b = ents.find((e) => e.mech); if (b) { F.bossIdx = ents.indexOf(b); if (b.mech.includes("shield")) { b.shield = Math.round(b.hpMax * 0.2); b.shieldPhase = 1; } }
    newRound(F);
    return F;
  };

  const newRound = (F) => {
    const ini = (e) => e.ini + (F.round === 1 && e.cls === "cra" ? 1e7 : 0);
    F.order = F.ents.filter((e) => e.alive).sort((a, b) => (a.slowR === F.round) - (b.slowR === F.round) || ini(b) - ini(a)).map((e) => F.ents.indexOf(e));
    F.oi = 0;
    if (F.round === 1 && F.idol && F.idol.major) F.order = F.order.concat(F.order.filter((i) => F.ents[i].side === "m")); // idole Major
    const r = chal(F, "rapide"); if (r && F.round > r.turns) failChal(F, "rapide", `plus de ${r.turns} tours`);
  };
  const flog = (F, txt, cls = "") => { F.log.push({ txt, cls }); if (F.log.length > 40) F.log.shift(); };
  const alive = (F, side) => F.ents.filter((e) => e.alive && e.side === side);

  /* ---------------- Résolution des actions ---------------- */
  const buffSum = (e, k) => e.buffs.reduce((s, b) => s + (b[k] || 0), 0);
  const debSum = (e, k) => (e.debuffs || []).reduce((s, b) => s + (b[k] || 0), 0);

  const killed = (F, tgt) => {
    if (tgt.alive) return; const idx = F.ents.indexOf(tgt); if (F.deaths.includes(idx)) return; F.deaths.push(idx);
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
    const ti = F.ents.indexOf(tgt); const si = src ? F.ents.indexOf(src) : -1; const k = el || "n";
    if (tgt.side === "c" && !tgt.summon) { F.taken = F.taken || {}; F.taken[k] = (F.taken[k] || 0) + v; tgt.taken = tgt.taken || {}; tgt.taken[k] = (tgt.taken[k] || 0) + v; F.lastHit = { t: ti, s: si, el: k }; }
    else if (tgt.side === "m" && src && src.side === "c") { F.dealt = F.dealt || {}; F.dealt[ti] = (F.dealt[ti] || 0) + v; const o = src.summon ? F.ents[src.owner] : src; if (o) o.dealt = (o.dealt || 0) + v; }
  };
  const dealDamage = (F, src, tgt, raw, el) => {
    let v = raw;
    let res = 0;
    if (tgt.side === "m") { res = (tgt.res || {})[el] || 0; if (tgt.boss && src && src.cls === "forge" && src.posture !== "rempart" && res > 0) res *= 0.5; if (F && F.idol) { res += F.idol.resAll; if (F.idol.resMain && el && el === F.idol.resEl) res += F.idol.resMain; } }
    else if (tgt.st) { const rk = ELEMENTS[el] && ELEMENTS[el].res; res = rk ? tgt.st[rk] || 0 : 0; res += tgt.resBonus || 0; }
    res = Math.min(50, res);
    v = v * (1 - res / 100);
    v *= 1 + (debSum(tgt, "vuln") + (tgt.mark > 0 ? 10 : 0)) / 100;
    if (src) v *= 1 - Math.min(60, debSum(src, "weak")) / 100;
    if (tgt.side === "c") { v *= (F && F.glyph === "prot" ? 0.9 : 1) * (tgt.mask === "def" ? 0.8 : 1) * (tgt.posture === "rempart" ? 0.75 : 1) * (1 - (tgt.smallDr || 0) / 100); if (tgt.st && el) v -= tgt.st[(ELEMENTS[el] || {}).fix] || 0; }
    /* 0.1 : rôles de monstres et mécaniques de boss qui changent les dégâts reçus */
    if (F && tgt.side === "c" && tgt.gold > 0) return 0;
    if (F && tgt.side === "m") {
      if (tgt.role === "esquive" && src && src.side === "c" && rnd() < 0.2) { F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(tgt), txt: "Esquive" }); return 0; }
      if (tgt.mech && tgt.mech.includes("totems") && alive(F, "m").some((m) => m.totem)) { F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(tgt), txt: "Invulnérable" }); return 0; }
      if (tgt.role === "coriace" && tgt.hp > tgt.hpMax * 0.5) v *= 0.7;
      if (tgt.weakOpen) v *= 1.5;
      if (tgt.mech) {
        if (tgt.mech.includes("glyphes")) v *= F.round % 2 === 0 ? 1.4 : 0.7;
        if (tgt.skinEl && el === tgt.skinEl) v *= tgt.mech.includes("humeurs") ? 0.25 : 0.5;
        if (tgt.openEl && el !== tgt.openEl) v *= 0.5;
      }
    }
    v = Math.max(1, Math.round(v));
    if (F && tgt.side === "m" && tgt.mech) { // une partie des dégâts part sur un serviteur
      const share = (m) => { const p = Math.min(m.hp, Math.round(v * 0.5)); if (p <= 0) return; v -= p; m.hp -= p; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(m), s: -1, v: p, el: el || "n" }); if (m.hp <= 0) { m.hp = 0; m.alive = false; killed(F, m); } };
      const link = tgt.mech.includes("liens") ? alive(F, "m").find((m) => m.linked) : null; if (link) share(link);
      else if (tgt.mech.includes("sacrifice")) { const ms = alive(F, "m").filter((m) => m.minion); if (ms.length) share(pick(ms)); }
    }
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, v); tgt.shield -= a; v -= a; }
    tgt.hp -= v;
    if (F) trackHit(F, src, tgt, v, el);
    if (tgt.side === "c" && src && src.side === "m" && F && F.glyph === "renvoi" && v > 0 && src.alive) { const rv = Math.max(1, Math.round(v * 0.15)); src.hp -= rv; if (src.hp <= 0) { src.hp = 0; src.alive = false; killed(F, src); } }
    if (tgt.side === "m" && tgt.hp <= 0 && src && src.cls === "enu" && !src.summon && rnd() < 0.15) { F.treasure = (F.treasure || 0) + 1; flog(F, `${src.name} déterre un trésor !`, "buff"); }
    if (tgt.side === "c" && tgt.cls === "sacri") tgt.suffer = Math.min(15, (tgt.suffer || 0) + 1);
    if (tgt.hp <= 0 && F && tgt.mech && tgt.mech.includes("immortel") && !tgt.revived) { tgt.revived = true; tgt.hp = Math.round(tgt.hpMax * 0.25); flog(F, `${tgt.name} refuse de mourir et se relève !`, "m"); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); }
    if (tgt.hp <= 0 && F && tgt.side === "m" && F.idol && F.idol.revive && !tgt.revived && !tgt.summon) { tgt.revived = true; tgt.hp = Math.round(tgt.hpMax * F.idol.revive / 100); flog(F, `${tgt.name} revient à la vie (idole Sakai) !`, "m"); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); }
    if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; killed(F, tgt); }
    if (F && src && v > 0) {
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
    return v;
  };
  const bestEl = (st) => [["t", st.fo], ["f", st.ine], ["e", st.cha], ["a", st.age]].sort((a, b) => b[1] - a[1])[0][0];
  /* équilibrage v3 par classe et par tranche de niveau (calibré par simulation des 19 classes) */
  E.POW_LVLS = [20, 36, 48, 56, 64, 76, 88, 100];
  E.CLASS_POW = {"iop":[0.8,0.8,0.8,0.89,1.2,1.2,1.2,0.98],"cra":[1.2,1.2,1.2,1.2,1.16,0.82,0.8,0.8],"eni":[1.2,1.19,1.07,1.02,0.98,1,1.1,1.17],"feca":[1.02,0.98,0.93,0.95,0.99,1,1,1.02],"osa":[0.94,0.92,0.92,0.91,0.91,0.93,0.97,0.97],"enu":[1.02,1.06,1.06,1.07,1.1,1.11,1.13,1.16],"sram":[1.04,1.03,1.02,1.01,1.01,1.04,1.07,1.04],"xelor":[0.98,1.02,1.03,1.03,1.02,0.99,0.96,1],"eca":[1.2,1.2,1.2,1.03,0.8,0.8,0.8,0.86],"sadi":[0.8,0.81,0.81,0.82,0.86,0.91,0.95,0.98],"sacri":[1.01,0.98,0.98,1.03,1.08,1.11,1.1,1.06],"panda":[0.91,0.87,0.84,0.86,0.88,0.85,0.84,0.86],"roub":[1.01,0.98,0.99,0.95,0.89,0.87,0.9,0.93],"zobal":[1.11,1.06,1.07,1.15,1.2,1.2,1.11,0.96],"steam":[0.81,0.81,0.83,0.84,0.88,0.92,0.94,0.98],"elio":[0.95,1.06,1.18,1.2,1.2,1.2,1.2,1.2],"hupper":[0.82,0.85,0.84,0.84,0.93,1.02,1.06,1.14],"ougi":[1.05,1.03,1.01,1.02,1.05,1.08,1.09,1.09],"forge":[0.97,1,0.99,1,1.02,1.03,1.04,1]};
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
    const crit = !(F && F.idol && F.idol.noCrit) && rnd() * 100 < Math.min(60, 5 + e.st.cri + buffSum(e, "cri"));
    if (crit) v = v * 1.25 + 3 + (e.st.dcri || 0) + buffSum(e, "dcri");
    v *= 1 + (e.dmgBonus || 0) / 100;
    v *= 1 + (e.st.dsort || 0) / 100;
    v *= mult;
    // 0.1.12 : Éveils de la Renaissance (Fureur, Premier sang)
    if (e.ev) { v *= 1 + 0.04 * (e.ev.fureur || 0); if (F && F.round === 1) v *= 1 + 0.08 * (e.ev.premier || 0); }
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
    if (tgt && tgt.race !== undefined && F.expertRaces && F.expertRaces.has(tgt.race)) v *= 1.1;
    e.lastEl = el;
    return { v, crit, el };
  };
  const healAmount = (e, f) => {
    const pui = e.st.pui + buffSum(e, "pui");
    return (rf(f.min, f.max) * E.DMG_SCALE * (1 + (e.st.ine + buffSum(e, "ine") + pui) / 100) + e.st.so) * (e.cls === "eni" ? 1.1 + 0.05 * (e.evc || 0) : 1) * (e.mask === "soin" ? 1.25 : 1) * (1 + 0.06 * ((e.ev || {}).main || 0));
  };
  E.doHeal = (t, v, F) => doHeal(t, v, F); // 0.1.10 : exposé pour les tests (idole Ougah)
  const doHeal = (t, v, F) => {
    if (t.side === "c" && F && F.idol && F.idol.heals) { if (F.idol.heals === "none") return 0; v *= 0.5; } // idoles Ougah et Bihilete
    if (t.side === "c") { const cut = debSum(t, "healcut") + (F && F.rot >= F.round ? 50 : 0); if (cut) v *= 1 - Math.min(80, cut) / 100; }
    const before = t.hp; t.hp = Math.min(t.hpMax, t.hp + Math.round(v)); const g = t.hp - before;
    if (F && t.side === "c" && !t.summon && g > 0) F.healed = (F.healed || 0) + g;
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
      case "no_summon": return !allies.some((a) => a.summon && a.owner === F.ents.indexOf(e));
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
      const el = chal(F, "elitiste"); if (el && F.ents[el.target].alive) prim = F.ents[el.target];
      const od = chal(F, "ordonne"); if (!prim && od) prim = foes.slice().sort((a, b) => b.lvl - a.lvl)[0];
      const fo = (chal(F, "focus") || chal(F, "chacun")) && F.cs.focus[e.cid] !== undefined ? F.ents[F.cs.focus[e.cid]] : null; if (!prim && fo && fo.alive) prim = fo;
    }
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
  const makeSummon = (S, F, e, f) => {
    const own = F.ents.indexOf(e);
    if (alive(F, "c").filter((a) => a.summon && a.owner === own).length >= SUM_LIMIT(e)) return null;
    const info = (D.SUMMONS || {})[String(f.mid)] || {}; const boost = e.cls === "osa" ? 1.3 + 0.15 * (e.evc || 0) : 1;
    const hp = Math.round(e.hpMax * 0.35 * boost);
    const s = { side: "c", summon: true, owner: own, name: info.name || "Invocation", img: info.img || null, cls: e.cls, lvl: e.lvl, hpMax: hp, hp, ini: e.ini - 1,
      dmg: (4 + e.lvl * 1.1) * (1 + (e.st[ELEMENTS[mainElE(e)].stat] || 0) / 250) * (e.cls === "steam" ? 1.4 + 0.1 * (e.evc || 0) : 1) * (e.cls === "osa" ? 1 + (e.st.pui || 0) / 200 : 1) * (e.cls === "cra" ? 0.35 : 1) + (e.cls === "osa" ? (e.st.do || 0) / 2 : 0), el: mainElE(e), // 0.1.12.4 : les balises du Crâ sont des outils, pas des combattants
      turret: e.cls === "steam", tree: e.cls === "sadi", buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, paLoss: 0 };
    F.ents.push(s); F.order.push(F.ents.indexOf(s));
    F.fx.push({ seq: F.seq, k: "summon", t: F.ents.indexOf(s) });
    return s;
  };
  const mainElE = (e) => { const c = CLASSES[e.cls]; return (c && STATS[c.main] && STATS[c.main].el) || "t"; };

  /* lance un sort de héros : applique tous ses effets */
  const castSpell = (S, F, e, sp, forced, slot) => {
    const g = E.spellGrade(sp, e.lvl); const allies = alive(F, "c").filter((a) => !a.summon); const parts = []; let ok = false; let extraPa = 0;
    const kind = E.spellKind(g);
    // sorts inutiles : ne pas les gaspiller
    if (kind === "heal" && !alive(F, "c").some((a) => a.hp < a.hpMax)) return { ok: false };
    if (kind === "summon" && alive(F, "c").filter((a) => a.summon && a.owner === F.ents.indexOf(e)).length >= SUM_LIMIT(e)) return { ok: false };
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
    if (e.cls === "eni" && e.eniDmg && kind !== "heal") { classMult *= 1.15 + 0.05 * (e.evc || 0); e.eniDmg = false; }
    let leech = 0; let dealt = 0; const hitIdx = [];
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
          const r = charDamage(S, F, e, f, m * classMult, t);
          if (f.k === "dot" && t.noDot) vals.push("immunisé"); else if (f.k === "dot") { if (e.cls === "sadi") { const mine = t.dots.filter((x) => x.src === e.name); if (mine.length >= 3 + (e.evc || 0)) t.dots.splice(t.dots.indexOf(mine[0]), 1); } t.dots.push({ v: r.v, turns: f.t || 2, el: r.el, src: e.name }); vals.push(`poison ${Math.round(r.v)}×${f.t || 2}`); }
          else { const d = dealDamage(F, e, t, r.v, r.el); dealt += d;
            if (r.crit) { const lf = F.fx[F.fx.length - 1]; if (lf && lf.k === "hit" && lf.t === F.ents.indexOf(t)) lf.crit = true; }
            if (e.cls === "enu" && f.n === 1 && t.alive && t.pelle !== F.round && rnd() < 0.1 + 0.05 * (e.evc || 0)) { t.pelle = F.round; t.paLoss = Math.min(3, (t.paLoss || 0) + 1); vals.push("Pelle ! −1 PA"); } vals.push(`−${d}${r.crit ? "!" : ""}`); if (f.k === "drain") doHeal(e, d / 2, F); if (e.cls === "cra" && f.n === 1 && t.alive) t.mark = 2; }
          hitIdx.push(F.ents.indexOf(t));
          if (!e.els.includes(r.el)) e.els.push(r.el);
          const ce = chal(F, "elementaire"); if (ce && r.el) { if (F.cs.el === null) F.cs.el = r.el; else if (F.cs.el !== r.el) failChal(F, "elementaire", "deux éléments utilisés"); }
        });
        parts.push(`${ts.length > 1 ? ts.length + " cibles" : ts[0].name} : ${vals.join(" / ")}`); ok = true;
        if (f.k === "drain") { const ci = chal(F, "incurable"); if (ci) failChal(F, "incurable", "vol de vie"); }
        if (e.cls === "eni") e.eniHeal = true;
      } else if (f.k === "heal" || f.k === "healpct") {
        const ts = f.self ? [e] : f.n > 1 ? alive(F, "c") : [ (forced && forced.alive && forced.side === "c") ? forced : alive(F, "c").slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] ];
        let tot = 0; const bonus = e.cls === "eni" && e.eniHeal ? 1.15 : 1; if (e.cls === "eni") { e.eniHeal = false; e.eniDmg = true; }
        ts.forEach((t) => { if (t) tot += doHeal(t, (f.k === "healpct" ? t.hpMax * f.v / 100 * (1 + e.st.so / 200) : healAmount(e, f) * bonus) * (F.roulette === "face" ? 1.15 : 1), F); });
        if (tot) { parts.push(`+${tot} PV`); ok = true; failChal(F, "incurable", "soin lancé"); }
      } else if (f.k === "shield") {
        const ts = f.all ? alive(F, "c") : [e]; const k = (e.cls === "feca" ? 1.25 : 1) * (1 + 0.06 * ((e.ev || {}).main || 0));
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
    if (!ok) return { ok: false };
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
        if (f0 !== undefined && (F.ents[f0].alive || chal(F, "chacun")) && foeHits.some((i) => i !== f0)) failChal(F, chal(F, "chacun") ? "chacun" : "focus", "une autre cible a été attaquée");
        if (f0 === undefined || (!F.ents[f0].alive && !chal(F, "chacun"))) cs.focus[key] = foeHits[0];
        if (chal(F, "chacun") && Object.entries(cs.focus).some(([k2, v]) => +k2 !== key && v === cs.focus[key])) failChal(F, "chacun", "deux héros sur le même monstre");
      }
    }
    flog(F, `${e.name} · ${sp.name}${parts.length ? " → " + parts.join(", ") : ""}`, "c");
    foeHits.forEach((i) => { if (!F.ents[i].alive) flog(F, `${F.ents[i].name} est vaincu.`, "ko"); });
    return { ok: true, extraPa };
  };
  /* l'IA saute les sorts qui feraient échouer un challenge (si l'option est activée) */
  const chalSkip = (S, F, e, c, sp, g) => {
    if (!E.chalRespect(S, c)) return false;
    const k = E.spellKind(g); const key = e.cid;
    if (chal(F, "versatile") && (F.cs.turnCasts[key] || {})[sp.id]) return true;
    if (chal(F, "econome") && F.cs.last[key] === sp.id) return true;
    if (chal(F, "incurable") && (k === "heal" || k === "drain" || g.fx.some((f) => f.k === "leech"))) return true;
    const multi = g.fx.some((f) => ["dmg", "drain", "dot"].includes(f.k) && f.n > 1) && alive(F, "m").length > 1;
    if ((chal(F, "focus") || chal(F, "chacun") || chal(F, "elitiste") || chal(F, "ordonne")) && multi) return true;
    if (chal(F, "barbare") && (k === "shield" || k === "buff")) return true;
    if (chal(F, "elementaire") && sp.el && sp.el !== "best" && sp.el !== (F.cs.el || E.mainEl(c)) && ["dmg", "aoe", "drain", "dot"].includes(k)) return true;
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
  const castLimit = (g) => (g.casts > 0 ? Math.min(g.casts, 3) : 1);
  const charTurn = (S, F, e, paStart) => {
    const c = S.chars.find((x) => x.id === e.cid); if (!c) return;
    if (paStart === undefined) {
      F.cs.turnCasts[e.cid] = {}; F.cs.hitTurn[e.cid] = new Set(); e.portal = false;
      if (e.stun > 0) { e.stun--; flog(F, `${e.name} ne peut pas bouger et passe son tour.`, "dim"); return endHeroTurn(S, F, e); }
      if (e.gold > 0) { e.gold--; flog(F, `${e.name} est une statue d'or et passe son tour.`, "dim"); return endHeroTurn(S, F, e); }
      if (e.cuve) { e.cuve = false; e.ivresse = 0; flog(F, `${e.name} cuve son ivresse et passe son tour.`, "dim"); return endHeroTurn(S, F, e); }
      if (e.cls === "feca") { e.glyphI = ((e.glyphI ?? -1) + 1) % 3; const gk = ["prot", "renvoi", "soin"][e.glyphI]; F.glyph = gk;
        flog(F, `${e.name} pose un Glyphe ${gk === "prot" ? "de Protection (−10 % de dégâts subis)" : gk === "renvoi" ? "de Renvoi (15 % des dégâts renvoyés)" : "de Soin (+3 % des PV)"}.`, "buff");
        if (gk === "soin") alive(F, "c").forEach((a) => doHeal(a, a.hpMax * (0.03 + 0.01 * (e.evc || 0)), F)); }
      if (e.cls === "forge") { const np = e.hp > e.hpMax * 0.5 ? "lance" : "rempart"; if (np !== e.posture) { e.posture = np; flog(F, `${e.name} passe en posture ${np === "lance" ? "Lance (+20 % de dégâts)" : "Rempart (−25 % de dégâts subis)"}.`, "buff"); } }
      if (e.cls === "zobal") { // masque adapté à la situation
        const hurt = alive(F, "c").filter((a) => !a.summon && a !== e && a.hp < a.hpMax * 0.5).length;
        const nm = e.hp < e.hpMax * 0.45 ? "def" : hurt ? "soin" : "atk";
        if (nm !== e.mask) { e.mask = nm; flog(F, `${e.name} enfile le Masque ${nm === "def" ? "du Pleutre (défense)" : nm === "soin" ? "de l'Hystérique (soutien)" : "du Psychopathe (attaque)"}.`, "buff"); }
        if (e.mask === "soin") alive(F, "c").forEach((a) => { if (a.hp < a.hpMax) doHeal(a, a.hpMax * 0.04, F); });
      }
    }
    if (paStart === undefined && E.manualOn(S)) { F.await = { ei: F.ents.indexOf(e), pa: Math.max(1, e.st.pa - (e.paLoss || 0)), t: F.dur, n: 0, casts: {} }; e.paLoss = 0; return; }
    let pa = paStart !== undefined ? paStart : Math.max(1, e.st.pa - (e.paLoss || 0) + (e.paBonus || 0)); e.paLoss = 0; e.paBonus = 0; let cast = 0;
    /* IA v3 : sorts utilitaires dans l'ordre de la barre, puis l'attaque qui rapporte le plus de dégâts par PA */
    const nCast = {}; const blocked = new Set();
    for (let guard = 0; guard < 30; guard++) {
      if (!alive(F, "m").length) return endHeroTurn(S, F, e);
      let best = null, bestV = -1;
      c.spells.forEach((slot, idx) => {
        if (blocked.has(idx)) return;
        const sp = E.spellDef(c.cls, slot.id); if (!sp || sp.lvl > c.lvl) return;
        const g = E.spellGrade(sp, c.lvl);
        if ((nCast[idx] || 0) >= castLimit(g) || (e.cd[sp.id] || 0) > 0 || g.pa > pa) return;
        if ((e.silence > 0 && g.cd) || (e.rooted > 0 && E.spellKind(g) === "heal")) return;
        if (!condOk(F, e, slot.cond) || chalSkip(S, F, e, c, sp, g) || (F.idol && F.idol.heals === "none" && E.spellKind(g) === "heal")) return;
        const k = E.spellKind(g);
        const v = ["dmg", "aoe", "drain", "dot"].includes(k) ? spellValue(F, e, g) / Math.max(1, g.pa) : 1e6 - idx;
        if (v > bestV) { bestV = v; best = { slot, idx, sp, g }; }
      });
      if (!best) break;
      F.seq++;
      const r = castSpell(S, F, e, best.sp, null, best.slot);
      if (!r.ok) { blocked.add(best.idx); continue; }
      nCast[best.idx] = (nCast[best.idx] || 0) + 1;
      pa -= best.g.pa; pa += r.extraPa || 0; cast++; if (best.g.cd) e.cd[best.sp.id] = best.g.cd + 1;
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
    const t = alive(F, "m").sort((a, b) => a.hp - b.hp)[0]; if (!t) return;
    F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e) });
    const d = dealDamage(F, e, t, e.dmg * rf(0.85, 1.15), e.el);
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
    const tree = targets.find((t) => t.tree && t.summon); if (tree && rnd() < 0.5) return tree;
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
    if (p > 0 && rnd() * 100 < p) { tlog(rowOf(t) === "b" ? "fui" : "pm"); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: "Esquive" }); return true; } return false; };
  const resists = (h, k) => { const p = E.tact(h.st, k); if (p > 0 && rnd() * 100 < p) { tlog(k); return true; } return false; };
  const monCrit = (e, v) => (e.crit && rnd() * 100 < e.crit ? v * 1.25 + (e.dcri || 0) : v); // idoles Hadibel et Tigel
  const monsterTurn = (S, F, e) => {
    const skip = e.mech ? bossMech(S, F, e) : false;
    if (e.role) roleTurn(S, F, e);
    if (skip || !e.alive || !alive(F, "c").length) return;
    let attacks = e.attacks + (e.extraAtk || 0); if (e.extraAtk) flog(F, `${e.name} est pris de frénésie et frappe deux fois !`, "m"); e.extraAtk = 0;
    if (e.paLoss >= 2) { attacks = Math.max(0, attacks - 1); flog(F, `${e.name} manque de PA et frappe moins.`, "dim"); }
    const lowPa = (e.paLoss === 1 ? 0.85 : 1) * (1 - (e.weakNext || 0) / 100); e.paLoss = 0; e.weakNext = 0;
    if (e.charging === "fire") { e.charging = false; const heroes = alive(F, "c"); flog(F, `${e.name} déclenche son attaque dévastatrice !`, "m");
      F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e) }); heroes.forEach((t) => { const d = dealDamage(F, e, t, e.dmg * 2.2 * rf(0.9, 1.1), e.el === "n" ? null : e.el); if (!t.alive) flog(F, `${t.name} est à terre (−${d}).`, "ko"); }); return; }
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
      F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e) });
      if (!sp) { const t = pickHero(F, targets, e); if (dodged(F, t, e)) { flog(F, `${t.name} esquive l'attaque de ${e.name}.`, "dim"); continue; } const d = dealDamage(F, e, t, monCrit(e, e.dmg * mdmg * lowPa * rf(0.85, 1.15)), e.el === "n" ? null : e.el); if (e.vamp) doHeal(e, d * e.vamp, F); flog(F, `${e.name} · ${e.atk} → ${t.name} : −${d}`, "m"); if (!t.alive) flog(F, `${t.name} est à terre.`, "ko"); continue; }
      if (sp.cd) e.cds[sp.n] = sp.cd + 1;
      const parts = []; let didDmg = false;
      for (const f of sp.fx) {
        if (f.k === "dmg" || f.k === "drain" || f.k === "dot") {
          if (didDmg) continue; didDmg = true; // une seule ligne de dégâts par sort (les autres sont des variantes)
          const ratio = refAvg ? clamp(avgDmg({ fx: [f] }) / refAvg, 0.5, 1.8) : 1;
          const ts = (f.n > 1 ? targets.slice().sort(() => rnd() - 0.5).slice(0, Math.min(f.n, targets.length)) : [pickHero(F, targets, e)]).filter((t) => !dodged(F, t, e));
          const base = monCrit(e, e.dmg * mdmg * lowPa * ratio * (f.n > 1 ? 0.7 : 1) * rf(0.85, 1.15));
          const el = f.el && f.el !== "best" ? f.el : e.el === "n" ? null : e.el;
          const hits = [];
          ts.forEach((t) => { if (f.k === "dot") t.dots.push({ v: base * 0.5, turns: f.t || 2, el, src: e.name }); else { const d = dealDamage(F, e, t, base, el); hits.push(`${t.name} : −${d}`); if (f.k === "drain") doHeal(e, d / 2, F); if (e.vamp) doHeal(e, d * e.vamp, F); } });
          parts.push(f.k === "dot" ? `poison sur ${ts.map((t) => t.name).join(", ")}` : hits.join(", "));
        } else if (f.k === "heal" || f.k === "healpct") {
          const t = alive(F, "m").sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (!t) continue; const h = doHeal(t, f.k === "healpct" ? t.hpMax * Math.min(25, f.v) / 100 : e.dmg * 1.4, F); if (h) parts.push(`soigne ${t.name} (+${h})`);
        } else if (f.k === "shield") { e.shield = Math.max(e.shield, Math.round(e.hpMax * Math.min(20, f.pct) / 100)); parts.push("bouclier");
        } else if (f.k === "buff") { e.buffs.push({ mdmg: 20, turns: 2 }); parts.push("se renforce");
        } else if (f.k === "apdrain") { const t = pick(targets); if (resists(t, "epa")) continue; t.paLoss = Math.min(2, (t.paLoss || 0) + 1); parts.push(`−1 PA à ${t.name}`);
        } else if (f.k === "weaken") { const t = pick(targets); t.debuffs.push({ weak: 15, turns: 1 }); parts.push(`affaiblit ${t.name}`);
        } else if (f.k === "vuln") { const t = pick(targets); t.debuffs.push({ vuln: 10, turns: 2 }); parts.push(`rend ${t.name} vulnérable`); }
      }
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
    if (e.role === "soigneur" && e.rt % 2 === 0) { const t = alive(F, "m").filter((m) => m.hp < m.hpMax * 0.9 && !m.fake).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (t) { const h = doHeal(t, t.hpMax * 0.1, F); if (h) flog(F, `${e.name} soigne ${t.name} (+${h}).`, "m"); } }
    if (e.role === "protect" && e.rt % 3 === 1) { alive(F, "m").forEach((m) => { m.shield = Math.max(m.shield || 0, Math.round(m.hpMax * 0.1)); }); flog(F, `${e.name} protège ses alliés d'un bouclier.`, "m"); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(e), txt: "Protection" }); }
    if (e.role === "invoc" && e.rt % 3 === 0 && (e.invN || 0) < 3 && alive(F, "m").length < 10) { e.invN = (e.invN || 0) + 1; const m = spawnMon(F, e.base || e.key, e.lvl - 5, { fake: true, name: `${e.name} (invoqué)` }); m.hpMax = m.hp = Math.round(m.hpMax * 0.35); m.dmg *= 0.5; flog(F, `${e.name} invoque un allié !`, "m"); }
  };
  const ELS4 = ["t", "f", "e", "a"];
  const bossMech = (S, F, e) => {
    e.mturn = (e.mturn || 0) + 1; const M = e.mech; const t = e.mturn; const has = (k) => M.includes(k); const ei = F.ents.indexOf(e); let skip = false;
    const say = (txt, tag) => { flog(F, txt, "m"); if (tag) F.fx.push({ seq: F.seq, k: "buff", t: ei, txt: tag }); };
    const hitAll = (list, mult) => list.forEach((h) => { const d = dealDamage(F, e, h, e.dmg * mult * rf(0.9, 1.1), e.el === "n" ? null : e.el); if (!h.alive) flog(F, `${h.name} est à terre (−${d}).`, "ko"); });
    const victim = (list) => (list.length ? pick(list) : null);
    if (e.phase2 && !e.p2done && e.hp < e.hpMax * 0.3) { e.p2done = true; doHeal(e, e.hpMax * 0.2, F); flog(F, `${e.name} entre dans sa seconde phase : il se régénère et appelle des renforts !`, "m"); F.fx.push({ seq: F.seq, k: "phase", t: ei });
      if (F.dungeonId) for (let i = 0; i < 2; i++) spawnMon(F, mobKey(F, e), e.lvl - 3); }
    if (has("enrage") && !e.enraged && e.hp < e.hpMax * 0.5) { e.enraged = true; e.dmg *= 1.4; e.debuffs.push({ vuln: 15, turns: 999 }); say(`${e.name} entre dans une rage folle !`, "Rage !"); }
    if (has("shield") && e.shieldPhase === 1 && e.hp < e.hpMax * 0.5) { e.shieldPhase = 2; e.shield += Math.round(e.hpMax * 0.2); say(`${e.name} se couvre d'une carapace !`, "Carapace"); }
    if (has("summon")) {
      const minions = alive(F, "m").filter((m) => m.minion && !m.fake);
      if (minions.length) { const h = doHeal(e, e.hpMax * 0.04, F); if (h) flog(F, `${e.name} est soigné par ses serviteurs (+${h}).`, "m"); }
      if (t % 3 === 0 && minions.length < 3 && F.dungeonId) { const m = spawnMon(F, mobKey(F, e), e.lvl - 3); flog(F, `${e.name} appelle ${m.name} en renfort !`, "m"); }
    }
    if (has("abordage") && t % 4 === 0 && alive(F, "m").length < 9) { for (let i = 0; i < 2; i++) spawnMon(F, mobKey(F, e), e.lvl - 3); say(`${e.name} crie « À l'abordage ! » : deux pirates arrivent.`, "Abordage"); }
    if (has("weakspot")) { e.weakOpen = t % 3 === 0; if (e.weakOpen) say(`${e.name} expose son point faible !`, "Point faible"); }
    if (has("festin")) e.vamp = Math.max(e.vamp || 0, 0.3);
    if (has("reflet")) { e.reflect = t % 4 === 0; if (e.reflect) say(`${e.name} se couvre d'un reflet : il renvoie une partie des dégâts.`, "Reflet"); }
    if (has("miasmes")) { const p = Math.min(0.05, 0.01 + 0.005 * t); heroesOf(F).forEach((h) => dealDamage(F, null, h, h.hpMax * p, null)); flog(F, `Les miasmes de ${e.name} rongent l'équipe (−${Math.round(p * 100)} % des PV).`, "m"); }
    if ((has("devoreur") || has("appetit") || has("banquet")) && t % 3 === 0 && (has("banquet") || e.hp < e.hpMax * 0.9)) {
      const m = alive(F, "m").find((x) => x.minion && !x.totem && !x.bomb && !x.linked);
      if (m) { m.hp = 0; m.alive = false; const h = doHeal(e, e.hpMax * 0.15, F); if (has("banquet")) e.dmg *= 1.1; say(`${e.name} dévore ${m.name} (+${h} PV${has("banquet") ? ", +10 % de dégâts" : ""}) !`, "Festin"); }
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
    if (has("totems") && (t === 1 || (t % 6 === 0 && !alive(F, "m").some((m) => m.totem)))) { for (let i = 0; i < 2; i++) spawnMon(F, mobKey(F, e), e.lvl, { fake: true, totem: true, name: "Totem", hp: e.hpMax * 0.06, attacks: 0, dmg: 0 }); say(`${e.name} dresse deux totems : il est invulnérable tant qu'ils tiennent debout !`, "Totems"); }
    if (has("liens") && !e.linkDone) { e.linkDone = true; spawnMon(F, mobKey(F, e), e.lvl, { fake: true, linked: true, name: "Âme liée", hp: e.hpMax * 0.3 }); say(`${e.name} lie son âme à un serviteur : les dégâts sont partagés.`, "Âmes liées"); }
    if (has("inventions")) {
      alive(F, "m").filter((m) => m.bomb).forEach((b) => { b.fuse--; if (b.fuse <= 0) { b.hp = 0; b.alive = false; flog(F, `La bombe de ${e.name} explose !`, "m"); hitAll(heroesOf(F), 2.5); } else flog(F, `Une bombe va exploser dans ${b.fuse} tour${b.fuse > 1 ? "s" : ""}.`, "m"); });
      if (t % 4 === 1) { spawnMon(F, mobKey(F, e), e.lvl, { fake: true, bomb: true, fuse: 3, name: "Bombe", hp: e.hpMax * 0.06, attacks: 0, dmg: 0 }); say(`${e.name} pose une bombe : détruisez-la avant 3 tours !`, "Bombe"); }
    }
    if (has("double") && !e.isDouble && !e.doubled && e.hp < e.hpMax * 0.5) { e.doubled = true; const m = spawnMon(F, e.key, e.lvl, { fake: true, isDouble: true, name: `Double de ${e.name}`, hp: e.hpMax * 0.4, dmg: e.dmg * 0.7, mech: M.filter((x) => x !== "double"), mturn: 0 }); m.attacks = e.attacks; say(`${e.name} se dédouble !`, "Dédoublement"); }
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
    e.dots = e.dots.filter((d) => {
      const v = dealDamage(F, null, e, d.v, d.el);
      flog(F, `${e.name} subit −${v} (poison)`, "dim");
      d.turns--; return d.turns > 0 && e.alive;
    });
    if (!e.alive) { flog(F, `${e.name} est vaincu.`, "ko"); return false; }
    if (E.dofusTurn) E.dofusTurn(S, F, e); // 0.1.13 : Dokoko
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
  };

  /* Un pas de combat = le tour d'une entité */
  E.step = (S) => {
    let F = S.fight;
    if (!F || F.over) return;
    if (F.dmgInit !== true) { applyFightBonuses(S, F); F.dmgInit = true; }
    if (F.await) {
      if (E.manualOn(S) && F.dur - F.await.t <= E.MANUAL_TIMEOUT) return;
      const A = F.await; F.await = null; const e = F.ents[A.ei];
      if (e && e.alive) { F.seq++; if (!A.n) flog(F, `${e.name} joue en automatique.`, "dim"); charTurn(S, F, e, A.pa); }
      return checkEnd(S);
    }
    F.seq++; if (F.fx.length > 80) F.fx.splice(0, F.fx.length - 80);
    if (F.oi >= F.order.length) { F.round++; newRound(F); if (F.round > 60) return endFight(S, false, "Le combat s'éternise : retraite.");
      const lim = F.bossIdx !== undefined ? E.STASIS_TL.boss : E.STASIS_TL.room; if (F.stasis >= 9 && F.round > lim) return endFight(S, false, `Stasis 9 : le temps est écoulé (${lim} tours maximum dans cette salle).`); }
    const e = F.ents[F.order[F.oi++]];
    if (!e || !e.alive) return E.step(S);
    if (!startOfTurn(S, F, e)) return checkEnd(S);
    if (e.side === "c") { if (e.summon) summonTurn(S, F, e); else charTurn(S, F, e); } else monsterTurn(S, F, e);
    checkEnd(S);
  };
  const checkEnd = (S) => {
    const F = S.fight;
    if (!alive(F, "m").length) endFight(S, true);
    else if (!alive(F, "c").filter((x) => !x.summon).length) endFight(S, false);
  };

  /* 0.1.11.2 : aperçu des 3 premiers tours d'un héros, joué par le vrai moteur de combat sur une copie de la partie
     mode "hunt" : un groupe de sa zone de chasse (ou d'une zone de son niveau) · mode "boss" : la salle du boss d'un donjon de son niveau
     spells : barre à tester (sinon celle du héros) · seeds : nombre de combats (dégâts moyens ; les lancers affichés sont ceux du 1er) */
  E.spellPreview = (S, cid, mode, spells, seeds = 3) => {
    const c0 = S.chars.find((x) => x.id === cid); if (!c0) return null;
    const evLen = E.events.length; const rng0 = rnd; const base = JSON.stringify(S); let out = null;
    try {
      for (let k = 0; k < seeds; k++) {
        let seed = 7919 * (k + 1);
        rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const S2 = JSON.parse(base); const c = S2.chars.find((x) => x.id === cid);
        if (spells) c.spells = spells.map((x) => ({ id: x.id, cond: x.cond, tgt: x.tgt }));
        S2.fight = null; S2.dungeon = null; S2.pause = 0; S2.settings = Object.assign({}, S2.settings, { manual: false }); S2.manualLive = false; S2.protector = null;
        if (!(c.inTeam && !c.job)) S2.chars.forEach((x) => (x.inTeam = x.id === cid));
        c.job = null;
        let label;
        if (mode === "boss") {
          const ids = Object.keys(DUNGEONS).filter((id) => DUNGEONS[id].lvl <= c.lvl + 5).sort((a, b) => DUNGEONS[b].lvl - DUNGEONS[a].lvl);
          const did = ids[0] || Object.keys(DUNGEONS)[0]; const dg = DUNGEONS[did];
          S2.dungeon = { id: did, room: dg.rooms.length, stasis: 1, chain: 1, t: 0, syncLvl: c.lvl, mods: [], eliteRoom: -1 };
          label = `${MONSTERS[dg.boss].name} (${dg.name})`;
        } else {
          let sid = S.hunting && S.sub && SUBS[S.sub] && SUBS[S.sub].lvl && Math.abs(SUBS[S.sub].lvl[1] - c.lvl) <= 30 ? S.sub : null;
          if (!sid) sid = Object.keys(SUBS).filter((s) => SUBS[s].lvl && SUBS[s].monsters && SUBS[s].monsters.length).sort((a, b) => Math.abs((SUBS[a].lvl[0] + SUBS[a].lvl[1]) / 2 - c.lvl) - Math.abs((SUBS[b].lvl[0] + SUBS[b].lvl[1]) / 2 - c.lvl))[0];
          S2.hunting = true; S2.sub = sid; label = SUBS[sid].name;
        }
        const F = E.startFight(S2); if (!F) return null;
        const hi = F.ents.findIndex((e) => e.side === "c" && e.cid === cid && !e.summon); const he = F.ents[hi]; if (hi < 0) return null;
        const rounds = [1, 2, 3].map((r) => ({ r, casts: [], pa: 0, dmg: 0 }));
        let lastSeq = -1, dealt = 0;
        const grab = () => {
          F.fx.forEach((f) => { if (f.seq <= lastSeq) return; if (f.k === "cast" && f.s === hi && f.sp && F.round <= 3) { const d = E.spellDef(c.cls, f.sp); const g = d && E.spellGrade(d, c.lvl); rounds[F.round - 1].casts.push(f.sp); rounds[F.round - 1].pa += g ? g.pa : 0; } });
          lastSeq = F.seq; if (F.round <= 3) { rounds[F.round - 1].dmg += (he.dealt || 0) - dealt; } dealt = he.dealt || 0;
        };
        for (let g = 0; g < 600 && !F.over && F.round <= 3; g++) { E.step(S2); grab(); }
        const res = { mode, label, mons: F.ents.filter((e) => e.side === "m").length, paMax: he.st.pa, rounds, end: F.over ? F.result : null, endRound: Math.min(3, F.round), total: rounds.reduce((a, r) => a + r.dmg, 0) };
        if (!out) out = res; else { out.rounds.forEach((r, i) => (r.dmgSum = (r.dmgSum || r.dmg) + res.rounds[i].dmg)); out.totalSum = (out.totalSum || out.total) + res.total; out.casted = out.casted || new Set(out.rounds.flatMap((r) => r.casts)); res.rounds.forEach((r) => r.casts.forEach((id) => out.casted.add(id))); }
      }
      if (out) { out.casted = out.casted || new Set(out.rounds.flatMap((r) => r.casts)); out.rounds.forEach((r) => (r.dmg = Math.round((r.dmgSum || r.dmg) / seeds))); out.total = Math.round((out.totalSum || out.total) / seeds); }
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
    if (!c || !c.spells.find((x) => x.id === spellId)) return "Sort non équipé.";
    const sp = E.spellDef(c.cls, spellId); if (!sp) return "Sort inconnu.";
    if (!E.manualCanCast(S, sp)) return E.spellGrade(sp, e.lvl).pa > A.pa ? "Pas assez de PA." : "Sort en recharge.";
    const tgt = targetIdx !== undefined && targetIdx !== null ? F.ents[targetIdx] : null;
    F.seq++;
    const g = E.spellGrade(sp, e.lvl);
    const r = castSpell(S, F, e, sp, tgt, c.spells.find((x) => x.id === spellId));
    if (!r.ok) return "Aucune cible valable.";
    A.pa -= g.pa; A.pa += r.extraPa || 0; A.n++; A.casts[sp.id] = (A.casts[sp.id] || 0) + 1; A.t = F.dur;
    if (g.cd) e.cd[sp.id] = g.cd + 1;
    F.fx.push({ seq: F.seq, k: "cast", s: A.ei, sp: sp.id });
    checkEnd(S);
    if (F.over) { F.await = null; return null; }
    const any = c.spells.some((x) => { const d = E.spellDef(c.cls, x.id); return d && d.lvl <= c.lvl && E.manualCanCast(S, d); });
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
  E.dropMult = (S) => {
    return (1 + E.teamProspection(S) / 100) * (1 + E.freeSpirit(S) / 100) * (1 + E.bonus(S, "drop") / 100);
  };

  const giveRewards = (S, mons, opts = {}) => {
    const team = E.team(S); const fs = E.freeSpirit(S);
    const out = { xp: {}, kamas: 0, res: {}, items: [], ups: [] };
    let xp = 0; const maxLvl = Math.max(...mons.map((m) => m.lvl));
    mons.forEach((m) => {
      let x = E.monsterXp(m.lvl) * (m.boss ? 6 : 1) * (m.archi ? 5 : 1) * (m.champ ? 3 : 1);
      xp += x;
      out.kamas += Math.round((m.lvl * 1.5 + ri(0, m.lvl)) * (m.boss ? 8 : 1) * (E.teamHas(S, "enu") ? 1.15 : 1) * (1 + E.bonus(S, "kamas") / 100) * (opts.kamasMult || 1));
      S.bestiary[m.key] = (S.bestiary[m.key] || 0) + 1;
      if (m.archi) { S.archis[m.key] = (S.archis[m.key] || 0) + 1; note(S, `Archimonstre vaincu : ${m.name} !`, "rare"); E.exoArchi(S, m); if (E.captureSoul && E.captureSoul(S, m, opts) === "new") (out.souls = out.souls || []).push(m.key); } // 0.1.13 : âme pour l'album
      if (m.champ) { S.champs = (S.champs || 0) + 1; out.champ = { name: m.name, power: m.champ, key: m.base || m.key }; if (!opts.offline) note(S, `Champion vaincu : ${m.name} !`, "rare"); }
    });
    xp *= 1 + (mons.length - 1) * 0.1; // bonus de groupe
    const share = 2 / (team.length + 1);
    team.forEach((c) => {
      const st = E.charStats(S, c);
      const diff = c.lvl - maxLvl;
      const pen = E.xpPenalty(diff);
      const boost = 1 + (opts.xpBoost !== undefined ? opts.xpBoost : E.boostPct(S, "xp")) / 100;
      let g = Math.round(xp * share * (1 + st.sa / 100) * (1 + fs / 100) * pen * boost * (opts.xpMult || 1) * E.roamMult(S) * (1 + (E.bonus(S, "xp") + E.synergy(S)) / 100) * E.renXpMult(c));
      out.xp[c.id] = g;
      g -= E.mountXpShare(S, c, g); // 0.1.9 : part donnée à la monture
      const ups = E.giveXp(S, c, g); if (ups) out.ups.push([c.name, c.lvl]);
    });
    E.stableXp(S, team.length ? team.reduce((s, c) => s + (out.xp[c.id] || 0), 0) / team.length : 0); // Mangeoire de l'enclos
    // Salle d'entraînement du Havre-Sac : une part de l'XP moyenne de l'équipe
    const tr = E.trainee(S);
    if (tr && team.length) {
      const g = Math.round(team.reduce((s, c) => s + (out.xp[c.id] || 0), 0) / team.length * E.trainShare(S, tr));
      if (g > 0) { out.xp[tr.id] = g; if (E.giveXp(S, tr, Math.round(g * E.renXpMult(tr)) - E.mountXpShare(S, tr, g))) out.ups.push([tr.name, tr.lvl]); }
    }
    S.kamas += out.kamas;
    // Butin
    const dm = E.dropMult(S) * (opts.dropMult || 1) * E.roamMult(S) * (E.teamHas(S, "enu") ? 1.15 : 1);
    const topL = Math.max(...S.chars.map((c) => c.lvl));
    const ougi = E.teamHas(S, "ougi");
    const sub = SUBS[S.sub];
    const seen = (k, what) => { (S.seenDrops[k] = S.seenDrops[k] || {})[what] = 1; };
    mons.forEach((m) => {
      const T = MONSTERS[m.base || m.key]; const q = (m.archi ? 3 : 1) * (m.champ ? 2 : 1);
      const lp = E.lootPenalty(topL - m.lvl); const dm0 = dm; { const dm = dm0 * lp * (m.champ ? 2 : 1);
      const tq = E.huntTier(S, m.base || m.key) >= 1 ? 1.05 : 1;
      const rolls = 1 + (E.teamHas(S, "sram") && rnd() < 0.1 ? 1 : 0);
      const gotR = new Set();
      for (let rr = 0; rr < rolls; rr++)
      T.drops.forEach(([r, rate]) => { if (gotR.has(r)) return; const mm = dm * tq * (ougi && /^Viande/.test(r) ? 1.2 : 1); const base = E.resRate(rate); if (rnd() * 100 < Math.min(100, base * mm)) { gotR.add(r); addRes(S, r, q); out.res[r] = (out.res[r] || 0) + q; seen(m.key, r); } });
      if (m.champ) { const ok = T.drops.filter(([r, p]) => !E.isKey(r) && p < 100); const best = ok.filter(([, p]) => p >= 5).sort((a, b) => a[1] - b[1])[0] || ok.sort((a, b) => b[1] - a[1])[0] || T.drops[0]; /* la ressource typique la plus rare du monstre */ if (best) { addRes(S, best[0], 3); out.res[best[0]] = (out.res[best[0]] || 0) + 3; out.champ.res = [best[0], 3]; } }
      if (m.boss && rnd() < E.BONBON_RATE) { S.cons.bonbon_sagesse = (S.cons.bonbon_sagesse || 0) + 1; out.cons = (out.cons || 0) + 1; note(S, "Butin rare : Bonbon Sagesse !", "rare"); }
      T.items.forEach(([tpl, rate]) => {
        if (!ITEMS[tpl]) return;
        if (rnd() * 100 < Math.min(100, rate * E.ITEM_DROP_SCALE * dm)) {
          seen(m.key, tpl);
          const T2 = ITEMS[tpl];
          if (T2.lvl < topL - E.LOW_ITEM_GAP) { const k = Math.round(T2.lvl * 4 + 10); S.kamas += k; out.kamas += k; out.conv = (out.conv || 0) + 1; return; }
          if (E.itemCount(S) >= E.itemCap(S)) { note(S, `Sac plein : ${T2.name} perdu.`, "warn"); return; }
          const it = E.rollItem(S, tpl, { archi: m.archi, champ: m.champ });
          const auto = E.applyAuto(S, it);
          if (auto) out.auto = (out.auto || 0) + 1; else out.items.push(it.uid);
        }
      });
      // clés de donjon
      if (!opts.dungeon && sub && sub.dungeon && sub.monsters.includes(m.base || m.key)) (sub.dungeons || [sub.dungeon]).forEach((did) => {
        const dg = DUNGEONS[did]; if (!dg) return;
        if (rnd() * 100 < dg.keyDrop * dm) { addRes(S, dg.key, 1); out.res[dg.key] = (out.res[dg.key] || 0) + 1; note(S, `Butin : ${dg.key}`, "loot"); }
      });
      if (lp < 1) out.lootPen = Math.min(out.lootPen || 1, lp); }
    });
    if (!opts.dungeon && sub && E.petHunt(S, S.sub)) out.pet = true; // familier de la sous-zone
    if (!opts.dungeon && sub && E.mountHunt(S, S.sub)) out.mount = true; // capture d'une monture sauvage
    // Trésors de l'Enutrof : une ressource bonus des monstres du combat
    for (let i = 0; i < (opts.treasure || 0); i++) { const pool = mons.flatMap((m) => (MONSTERS[m.base || m.key].drops || []).map(([r]) => r)); if (!pool.length) break; const r = pick(pool); addRes(S, r, 1); out.res[r] = (out.res[r] || 0) + 1; }
    return out;
  };
  E.giveRewards = giveRewards;
  /* v3 : butin réduit sur les monstres bien plus faibles que le meilleur héros (dès 10 niveaux d'écart, plancher 10 %) */
  E.lootPenalty = (gap) => (gap > 10 ? Math.max(0.1, 1 - (gap - 10) * 0.06) : 1);
  /* Taux de ressources v2.7 : divisés par 2 (×0,4 ; les ressources « garanties » à 100 % tombent à 35 %) */
  E.RES_RATE_SCALE = 0.4;
  E.resRate = (rate) => (rate >= 100 ? 35 : rate * E.RES_RATE_SCALE);
  E.BONBON_RATE = 0.02;
  /* Pénalité d'XP quand les monstres sont trop faibles pour le héros */
  E.xpPenalty = (diff) => (diff > 4 ? Math.max(0.05, 1 - (diff - 4) * 0.1) : 1);
  /* Règles automatiques de vente / brisage des objets lâchés */
  E.applyAuto = (S, it) => {
    const A = S.settings.auto; if (!A || it.radiant || it.locked || E.inGear(S, it.uid)) return null;
    if (A.recycle) {
      const q = E.itemQuality(it);
      const better = Object.values(S.items).some((x) => x !== it && x.tpl === it.tpl && (x.radiant || E.itemQuality(x) >= q));
      if (better) { if (A.recycle === "break") E.breakItem(S, it.uid, null); else E.sellItem(S, it.uid); return "recycle"; }
    }
    if (A.action === "none") return null;
    const T = ITEMS[it.tpl]; if (A.keepSets && T.set) return null;
    if (E.itemQuality(it) * 100 >= A.q) return null;
    if (A.action === "sell") { E.sellItem(S, it.uid); return "sell"; }
    if (A.action === "break") { E.breakItem(S, it.uid, null); return "break"; }
    return null;
  };
  E.ITEM_DROP_SCALE = 0.04; // v2.7 : les objets sont bien plus rares (×1/3)
  E.LOW_ITEM_GAP = 20;       // objet 20 niveaux sous le meilleur héros : converti en kamas

  E.giveXp = (S, c, g) => {
    if (c.lvl >= E.MAX_LVL) return false;
    c.xp += g; let up = false; const from = c.lvl;
    while (c.lvl < E.MAX_LVL && c.xp >= E.xpNeed(c.lvl)) {
      c.xp -= E.xpNeed(c.lvl); c.lvl++; c.pts += 5; up = true;
    }
    if (up) {
      E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
      note(S, `${c.name} passe niveau ${c.lvl} !`, "up");
      E.emit(S, "level", { cid: c.id, lvl: c.lvl });
      if (Math.floor(c.lvl / 10) > Math.floor(from / 10)) E.celebrate({ t: "lvl", cid: c.id, lvl: Math.floor(c.lvl / 10) * 10, frame: Math.floor(c.lvl / 20) > Math.floor(from / 20) });
      const nw = CLASSES[c.cls].spells.filter((s) => s.lvl === c.lvl);
      nw.forEach((s) => note(S, `${c.name} apprend ${s.name}.`, "up"));
    }
    return up;
  };

  const endFight = (S, win, why) => {
    const F = S.fight; F.over = true; F.result = win ? "win" : "lose";
    S.stats.fights++;
    if (F.prot) E.protEnd(S, win);
    if (win) {
      S.stats.wins++;
      const mons = F.ents.filter((e) => e.side === "m" && !e.fake);
      const cb = E.chalResolve(S, F);
      const sr = (F.stasis > 1 ? E.stasisMult(F.stasis).rew : 1) * (F.weekly ? E.WEEKLY_REW : 1) * (F.flash ? E.FLASH_REW : 1) * (1 + (F.idolBonus || 0) / 100);
      F.rewards = giveRewards(S, mons, { dungeon: !!S.dungeon, xpMult: (1 + cb / 100) * sr * E.PACE_REW * (F.powRew || 1), dropMult: (1 + cb / 100) * sr * E.PACE_REW * (F.powRew || 1) * (F.roulette === "jackpot" ? 2 : 1), kamasMult: E.PACE_REW * (F.powRew || 1), treasure: F.treasure || 0 });
      if (cb) F.rewards.chal = cb;
      if (F.idolBonus) { F.rewards.idol = { score: F.idolScore, pct: F.idolBonus, ids: F.idol.ids }; S.cnt = S.cnt || {}; S.cnt.idolWins = (S.cnt.idolWins || 0) + 1; if (F.idolScore > (S.cnt.idolBest || 0)) S.cnt.idolBest = F.idolScore; if (F.idol.ids.length >= E.IDOL_MAX) S.cnt.idolSix = (S.cnt.idolSix || 0) + 1; }
      checkHunt(S, [...new Set(mons.map((m) => m.key))]);
      E.emit(S, "win", { mons: mons.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, champ: m.champ, lvl: m.lvl })), sub: S.dungeon ? null : S.sub, dungeon: S.dungeon ? S.dungeon.id : null, stasis: F.stasis || 0, chals: (F.chals || []).filter((c) => c.ok).map((c) => c.id), down: (F.deathInfo || []).length });
      if (!S.dungeon) S.progress.wins[S.sub] = (S.progress.wins[S.sub] || 0) + 1;
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
          const chainD = S.dungeon; S.dungeon = null;
          if (chainD.chain > 1) { const r2 = E.enterDungeon(S, chainD.id, chainD.stasis, chainD.chain - 1); if (r2) note(S, `Enchaînement arrêté : ${r2}`, "warn"); }
          if (!S.dungeon && S.hunting && S.sub) E.applyZonePresets(S, S.sub);
        } else S.dungeon.room++;
      }
      Object.keys(SUBS).forEach((s) => { if (!prevUnlocked.has(s) && E.subUnlocked(S, s)) note(S, `Nouvelle sous-zone : ${SUBS[s].name}`, "up"); });
      E.autoZone(S, true);
      E.roam(S); // 0.1.10.2 : chasse itinérante
    } else {
      E.chalResolve(S, F, true);
      flog(F, why || "Défaite… l'équipe se repose.", "lose");
      try { F.loss = E.lossReport(S, F); } catch (e) { F.loss = null; }
      if (F.loss) { S.losses = (S.losses || []).filter((x) => x && x.t); S.losses.unshift(F.loss); if (S.losses.length > 6) S.losses.length = 6; E.events.push({ kind: "loss", txt: F.loss.txt, rep: F.loss }); }
      E.autoZone(S, false);
      if (S.dungeon) {
        if ((S.cons.fiole_resu || 0) > 0 && !S.dungeon.revived) { S.cons.fiole_resu--; if (!S.cons.fiole_resu) delete S.cons.fiole_resu; S.dungeon.revived = true; note(S, `Fiole de Résurrection : l'équipe se relève et recommence la salle (${DUNGEONS[S.dungeon.id].name}).`, "rare"); }
        else { note(S, `Échec dans ${DUNGEONS[S.dungeon.id].name}. La clé est perdue.`, "warn"); S.dungeon = null; }
      }
    }
    if (F.dungeonId && S.dungeon) S.dungeon.t = (S.dungeon.t || 0) + F.dur;
    S.stats.recent.push({ d: Math.round(F.dur * 10) / 10, w: win ? 1 : 0 });
    if (S.stats.recent.length > 20) S.stats.recent.shift();
    // historique et rendement par zone
    const zkey = F.dungeonId ? "dg:" + F.dungeonId : F.sub;
    const r = F.rewards || { xp: {}, kamas: 0, res: {}, items: [] };
    const xpTot = Object.values(r.xp).reduce((a, b) => a + b, 0);
    const nres = Object.values(r.res).reduce((a, b) => a + b, 0);
    S.history.unshift({ t: Date.now(), z: zkey, label: F.label, w: win ? 1 : 0, d: Math.round(F.dur), xp: xpTot, k: r.kamas, r: nres, i: r.items.length });
    if (F.loss) F.loss.t = S.history[0].t; // même horodatage : le rapport s'ouvre depuis « Derniers combats »
    if (S.history.length > 30) S.history.length = 30;
    if (zkey) {
      const z = S.zoneStats[zkey] = S.zoneStats[zkey] || { f: 0, w: 0, s: 0, xp: 0, k: 0, r: 0, i: 0 };
      z.f++; z.w += win ? 1 : 0; z.s += F.dur + E.PAUSE_MS / 1000; z.xp += xpTot; z.k += r.kamas; z.r += nres; z.i += r.items.length;
    }
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
    S.chars.forEach((c) => { if (c.job && c.job.res === name) { const per = E.gatherPeriod(S, c); if (per > 0) { h += (3600 / per) * (1 + S.jobs[c.job.job].lvl / 200); src.push("récolte"); } } });
    const sub = S.hunting && !S.dungeon && S.sub ? SUBS[S.sub] : null;
    if (sub) {
      const cyc = E.fightCycle(S);
      if (cyc) {
        const team = E.team(S).length; const grp = (1 + Math.min(8, team + 1)) / 2;
        const dm = E.dropMult(S) * E.PACE_REW * (E.teamHas(S, "enu") ? 1.15 : 1);
        let per = 0;
        sub.monsters.forEach((k) => { const m = MONSTERS[k]; if (!m) return; const d = m.drops.find(([r]) => r === name); const tq = E.huntTier(S, k) >= 1 ? 1.05 : 1;
          if (d) per += Math.min(1, E.resRate(d[1]) * dm * tq / 100) / sub.monsters.length;
          (sub.dungeons || (sub.dungeon ? [sub.dungeon] : [])).forEach((did) => { if (DUNGEONS[did] && DUNGEONS[did].key === name) per += Math.min(1, DUNGEONS[did].keyDrop * dm / 100) / sub.monsters.length; }); });
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
    let need = -c.xp; for (let l = c.lvl; l < t; l++) need += E.xpNeed(l);
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
    if (p.k === "lvl") { const c = S.chars.find((x) => x.id === p.cid); if (!c) return "Héros introuvable."; p = Object.assign({ from: c.lvl + c.xp / E.xpNeed(c.lvl) }, p); }
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
      case "lvl": { const c = S.chars.find((x) => x.id === p.cid); if (!c || !p.n) return null; const cur = c.lvl + (c.lvl < E.MAX_LVL ? c.xp / E.xpNeed(c.lvl) : 0); const from = p.from !== undefined ? p.from : c.lvl; const eta = E.lvlEta(S, c, p.n);
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
    const R = { t: Date.now(), label: F.label, round: F.round, cause: "close", txt: "", facts: [], gear: [], cid: null, stat: null, did: F.dungeonId || null, sub: F.sub || null };
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

  /* Challenges : bonus des challenges réussis + série (+0,5 % par succès consécutif, max +5 %) */
  E.CHAL_STREAK_STEP = 0.5; E.CHAL_STREAK_MAX = 5;
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
    const tot = sum + streak;
    flog(F, `Challenge${L.filter((c) => c.ok).length > 1 ? "s" : ""} réussi${L.filter((c) => c.ok).length > 1 ? "s" : ""} : +${tot} % XP et butin${streak ? ` (série ${S.chalStreak})` : ""}`, "win");
    return tot;
  };
  /* Progression auto : suit le niveau de l'équipe (option « Suivre mon niveau ») */
  E.autoZoneTarget = (S) => {
    const team = E.team(S); if (!team.length) return null;
    const avg = team.reduce((s, c) => s + c.lvl, 0) / team.length;
    const cand = Object.values(SUBS).filter((s) => !s.hidden && E.subUnlocked(S, s.id) && s.lvl[0] <= avg + 1);
    if (!cand.length) return null;
    cand.sort((a, b) => (b.lvl[0] + b.lvl[1]) - (a.lvl[0] + a.lvl[1]));
    return cand;
  };
  E.autoZone = (S, win) => {
    if (!S.settings || !(S.settings.autoZone || S.settings.roam) || S.dungeon || !S.hunting || !S.sub) return; // l'itinérante redescend aussi après 3 défaites sur 6
    S._az = (S._az || 0) + 1;
    const rec = S.stats.recent.slice(-6); const losses = rec.filter((r) => !r.w).length;
    const cand = E.autoZoneTarget(S); if (!cand) return;
    const cur = SUBS[S.sub]; let target = null;
    if (!win && losses >= 3) { // trop dur : on redescend
      target = cand.find((s) => (s.lvl[0] + s.lvl[1]) < (cur.lvl[0] + cur.lvl[1]));
    } else if (S.settings.autoZone && win && S._az >= 12 && losses === 0) { // tout va bien : on monte si possible
      const best = cand[0];
      if (best && (best.lvl[0] + best.lvl[1]) > (cur.lvl[0] + cur.lvl[1])) target = best;
    }
    if (!target || target.id === S.sub) return;
    S._az = 0; S.stats.recent.length = 0;
    E.startHunt(S, target.id);
    note(S, `Progression auto : ${target.name} (niv. ${target.lvl[0]}-${target.lvl[1]})`, "up");
  };

  /* Coffre de boss : un objet garanti des monstres du donjon (niveau proche du boss) */
  E.bossChest = (S, did, rew) => {
    const dg = DUNGEONS[did]; const pool = new Set();
    [dg.boss, ...dg.rooms.flatMap((r) => r.mobs)].forEach((k) => (MONSTERS[k].items || []).forEach(([t]) => { if (ITEMS[t] && ITEMS[t].lvl <= dg.lvl + 5 && ITEMS[t].lvl >= dg.lvl - 25) pool.add(t); }));
    const arr = [...pool]; if (!arr.length || E.itemCount(S) >= E.itemCap(S)) return;
    const tpl = pick(arr); const it = E.rollItem(S, tpl, {});
    note(S, `Coffre du boss : ${ITEMS[tpl].name} !`, "rare");
    if (rew) rew.items.push(it.uid);
  };

  /* ---------------- Donjons ---------------- */
  E.POUSSIERE = "Poussière de stasis";
  E.stasisClear = (S, D2, rew) => {
    const did = D2.id; const k = D2.stasis || 1; const SI = E.stasisInfo(S, did); const stat = E.dungeonScrollStat(did);
    const out = [];
    const dust = Math.round((k * 2 + (k >= 4 ? 4 : 0)) * (D2.weekly ? E.WEEKLY_DUST : 1) * (D2.flash ? E.FLASH_DUST : 1)); addRes(S, E.POUSSIERE, dust); out.push(`${dust} ${E.POUSSIERE}`);
    if (!SI.firsts[k]) { SI.firsts[k] = Date.now();
      const chest = k >= 8 ? "coffre_or" : k >= 4 ? "coffre_argent" : "coffre_bois"; E.addCons(S, chest, 1); out.push(`premier passage : ${CONSUMABLES[chest].name}`);
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
    const t = Math.round(D2.t || 0); if (!SI.best[k] || t < SI.best[k]) SI.best[k] = t;
    if (k === 10) S.unlocks.stasis10 = true;
    note(S, `Stasis ${k} terminée : ${out.join(", ")}.`, "rare");
    if (rew) rew.stasis = { k, out };
  };
  E.enterDungeon = (S, did, stasis, chain) => {
    const dg = DUNGEONS[did]; if (!dg) return "Donjon inconnu.";
    const SI = E.stasisInfo(S, did); const k = clamp(stasis || SI.sel || 1, 1, E.STASIS_MAX);
    if (k > SI.max + 1) return `Stasis ${k} verrouillée : terminez d'abord la stasis ${SI.max + 1}.`;
    if (!E.dungeonUnlocked(S, did)) return "Donjon verrouillé.";
    if (S.dungeon) return "Vous êtes déjà en donjon.";
    if ((S.res[dg.key] || 0) < 1) return `Il vous faut : ${dg.key}.`;
    S.res[dg.key]--; if (!S.res[dg.key]) delete S.res[dg.key];
    const W = E.weekly(S); const FL = W && W.did === did ? null : E.flashOf(S, did); const wk = W && W.did === did ? W.mod : FL ? FL.mod : null;
    S.dungeon = { id: did, room: 0, stasis: k, chain: chain || 1, t: 0, syncLvl: Math.round(E.team(S).reduce((a, c) => a + c.lvl, 0) / Math.max(1, E.team(S).length)),
      mods: k >= 7 ? pickMods(2, wk) : k >= 6 ? pickMods(1, wk) : wk ? [wk] : [], weekly: W && W.did === did ? wk : undefined, flash: FL ? FL.mod : undefined, eliteRoom: k >= 5 ? Math.floor(dg.rooms.length / 2) : -1 };
    SI.sel = k;
    S.fight = null; S.pause = 0;
    E.applyZonePresets(S, "dg:" + did);
    note(S, `Entrée dans ${dg.name}.`, "info");
    return null;
  };
  E.leaveDungeon = (S) => { if (S.dungeon) { note(S, "Vous quittez le donjon (clé perdue).", "warn"); S.dungeon = null; S.fight = null; if (S.hunting && S.sub) E.applyZonePresets(S, S.sub); } };

  /* ---------------- Boucle principale ---------------- */
  E.STEP_MS = 780; // 0.1.3-0.1.4 : combats plus posés (520 ms avant)
  E.PACE_REW = 780 / 520; // compense : les gains par heure restent les mêmes qu'avec 520 ms
  E.PAUSE_MS = 1400;
  E.tick = (S, dtMs) => {
    S.stats.playtime += dtMs / 1000;
    const sp = 1;
    // combat
    S.acc = (S.acc || 0) + dtMs * sp;
    let guard = 0;
    while (S.acc >= E.STEP_MS && guard++ < 200) {
      S.acc -= E.STEP_MS;
      if (!S.fight || S.fight.over) {
        if (!S.dungeon && !S.hunting) { S.acc = 0; break; }
        S.pause = (S.pause || 0) + E.STEP_MS;
        if (S.pause >= E.PAUSE_MS) { S.pause = 0; E.startFight(S); }
        continue;
      }
      S.fight.dur += E.STEP_MS / 1000;
      E.step(S);
    }
    E.starsTick(S, dtMs / 1000);
    // récolte
    gatherTick(S, dtMs / 1000);
    E.protExpire(S);
    E.atelierTick(S, dtMs / 1000);
    E.fmPlanTick(S, dtMs / 1000);
    E.petTick(S, dtMs);
    E.enclosTick(S, dtMs);
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
  E.gatherPeriod = (S, c) => { const j = c.job; return j ? E.gatherTime(S.jobs[j.job].lvl) / E.gatherSpeed(S, j.job, c) : 0; };
  E.FIND_CHANCE = 0.01;
  E.jobRes = (job) => GATHER_JOBS[job].items; // [[ressource, niveau]]
  E.setJob = (S, cid, job, res) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (S.dungeon && c.inTeam && !c.job) return "Impossible pendant un donjon.";
    if (!job) { if (c.job) { c.job = null; S.fight = S.dungeon ? S.fight : null; note(S, `${c.name} revient chasser.`, "info"); } return null; }
    const list = E.jobRes(job); const lvl = S.jobs[job].lvl;
    const pickRes = res && list.find((x) => x[0] === res && x[1] <= lvl) ? res : (list.filter((x) => x[1] <= lvl).pop() || [])[0];
    if (!pickRes) return "Ressource verrouillée.";
    const was = !!c.job; c.job = { job, res: pickRes, prog: 0 };
    if (!was) S.fight = S.dungeon ? S.fight : null;
    note(S, `${c.name} récolte : ${pickRes}.`, "info");
    return null;
  };
  /* Filons rares : en moyenne un toutes les 2 h de récolte, 10 min, rendement ×2 sur une ressource */
  E.FILON_EVERY_S = 7200; E.FILON_DUR_S = 600;
  E.filonOn = (S, res, at = Date.now()) => !!(S.filon && S.filon.res === res && S.filon.until > at);
  const gatherTick = (S, dt, opts = {}) => {
    let total = 0;
    S.chars.forEach((c) => {
      const W = c.job; if (!W) return; const J = S.jobs[W.job]; if (!J) { c.job = null; return; }
      const def = E.jobRes(W.job).find((x) => x[0] === W.res); if (!def || def[1] > J.lvl) return;
      W.prog += dt; const t = E.gatherPeriod(S, c);
      let n = 0;
      while (W.prog >= t && n < 200000) {
        W.prog -= t; n++;
        let q = 1; if (rnd() < J.lvl / 200) q++;
        if (!opts.quiet && !(S.filon && S.filon.until > Date.now()) && rnd() < t / E.FILON_EVERY_S) { S.filon = { res: W.res, until: Date.now() + E.FILON_DUR_S * 1000 }; note(S, `Un filon de ${W.res} est apparu ! Rendement ×2 pendant 10 minutes.`, "rare"); }
        if (E.filonOn(S, W.res)) q *= 2;
        q *= E.protMult(S, W.res); // 0.1.10.1 : protecteur vaincu, récolte ×2
        if (!opts.quiet) E.protSpawn(S, c, W);
        if (rnd() < E.FIND_CHANCE) { q *= 5; S.finds = (S.finds || 0) + 1; if (rnd() < 0.6) addRes(S, E.RARE_COMPONENT, 1); if (!opts.quiet) note(S, `Trouvaille ! ${c.name} déniche ${q} × ${W.res}.`, "rare"); }
        addRes(S, W.res, q); total += q;
        J.xp += 10 + def[1] * 1.0;
        while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; if (J.lvl % 5 === 0 || GATHER_JOBS[W.job].items.some((x) => x[1] === J.lvl)) note(S, `${GATHER_JOBS[W.job].name} niveau ${J.lvl}`, "up"); E.emit(S, "joblvl", { job: W.job, lvl: J.lvl }); }
      }
      if (n) E.emit(S, "harvest", { res: W.res, n });
    });
    return total;
  };
  E.gatherTick = gatherTick;

  /* ---------------- Artisanat ---------------- */
  E.craftReq = (tpl) => Math.max(1, Math.floor(ITEMS[tpl].lvl / 2));
  E.canCraft = (S, recipe, n = 1) => recipe.ing.every(([r, q]) => (S.res[r] || 0) >= q * n);
  E.craftItem = (S, tpl) => {
    const T = ITEMS[tpl]; if (!T || !T.craft) return "Recette inconnue.";
    const J = S.crafts[T.craft.job];
    if (J.lvl < E.craftReq(tpl)) return `${CRAFT_JOBS[T.craft.job].name} niveau ${E.craftReq(tpl)} requis.`;
    if (!E.canCraft(S, T.craft)) return "Ressources insuffisantes.";
    if (E.itemCount(S) >= E.itemCap(S)) return "Sac plein.";
    T.craft.ing.forEach(([r, q]) => { S.res[r] -= q; if (!S.res[r]) delete S.res[r]; });
    const it = E.rollItem(S, tpl);
    craftXp(S, T.craft.job, 12 + T.lvl * 3);
    E.emit(S, "craft", { tpl });
    return it;
  };
  E.craftSpecial = (S, name) => {
    const R = SPECIAL_CRAFTS[name]; if (!R) return "Recette inconnue.";
    const J = S.crafts[R.job];
    if (J.lvl < R.lvl) return `${CRAFT_JOBS[R.job].name} niveau ${R.lvl} requis.`;
    if (R.unique && ((S.res[name] || 0) > 0 || (R.furn && S.furniture.includes(name)) || (R.idol && E.idolOwned(S, R.idol)))) return "Vous possédez déjà cet objet.";
    if (R.dofus && !(E.dofusOwned && E.dofusOwned(S, R.dofus))) return "Obtenez d'abord ce Dofus par sa quête (Quêtes › Dofus).";
    if (!E.canCraft(S, R)) return "Ressources insuffisantes.";
    R.ing.forEach(([r, q]) => { S.res[r] -= q; if (!S.res[r]) delete S.res[r]; });
    if (R.idol) E.giveIdol(S, R.idol, "fabriquée"); else if (R.dofus) E.giveDofus(S, R.dofus, "copie du Bricoleur"); else if (R.furn && E.giveFurn) E.giveFurn(S, name, "fabriqué"); else if (R.cons) E.addCons(S, R.cons, R.n || 1); else addRes(S, name, 1);
    craftXp(S, R.job, 20 + R.lvl * 3);
    E.emit(S, "craft", { special: name });
    if (name === "Baguette Rikiki") note(S, "La Planque des Vilinsekts est accessible !", "rare");
    return null;
  };
  const craftXp = (S, job, x) => {
    const J = S.crafts[job]; J.xp += x;
    while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; note(S, `${CRAFT_JOBS[job].name} niveau ${J.lvl}`, "up"); }
  };

  /* ---------------- Brisage & runes ---------------- */
  E.runeKey = (tier, stat) => `${tier}:${stat}`;
  E.runeName = (key) => {
    const [tier, stat] = key.split(":"); const s = STATS[stat];
    return tier === "pa" ? `Rune Pa ${s.short}` : tier === "ra" ? `Rune Ra ${s.short}` : tier === "ga" ? `Rune Ga ${s.short}` : `Rune ${s.short}`;
  };
  E.runeInfo = (key) => {
    const [tier, stat] = key.split(":"); const mult = tier === "pa" ? 3 : tier === "ra" ? 10 : 1;
    const s = STATS[stat]; return { stat, tier, pts: tier === "ga" ? 1 : s.pts * mult, weight: tier === "ga" ? s.w : s.w * s.pts * mult, exo: tier === "ga" };
  };
  E.COEF_REGEN_MIN = 6; // +1 % toutes les 6 minutes
  E.getCoef = (S, tpl, now = Date.now()) => {
    const c = S.coef[tpl]; if (!c) return 100;
    const gained = Math.floor((now - c.t) / (E.COEF_REGEN_MIN * 60000));
    return Math.min(100, c.v + gained);
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
  // Convertit un poids en runes (Ra puis Pa puis simple ; le reste a une chance de donner une rune)
  const weightToRunes = (stat, w) => {
    const s = STATS[stat]; const base = s.w * s.pts; const out = {};
    const tiers = RUNE_SIMPLE_ONLY.includes(stat) ? [["", 1]] : [["ra", 10], ["pa", 3], ["", 1]];
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
    const p = E.breakPreview(S, uid, focus);
    const got = {}; const exoMult = it.exo ? E.EXO_BREAK_MULT : 1; // 0.1.9.1 : un objet exo rend ses runes ×2 (l'exo est perdu)
    for (const k in p.weights) {
      const r = weightToRunes(k, p.weights[k] * rf(0.85, 1.05) * exoMult);
      for (const rk in r) { S.runes[rk] = (S.runes[rk] || 0) + r[rk]; got[rk] = (got[rk] || 0) + r[rk]; }
    }
    S.coef[it.tpl] = { v: Math.max(10, p.coef - 3), t: Date.now() };
    delete S.items[uid];
    return got;
  };

  /* ---------------- Objets parfaits (0.1.8.2) : toutes les caractéristiques positives au jet maximum ---------------- */
  E.PERFECT_PCT = 2;
  E.isPerfect = (it) => {
    const T = ITEMS[it.tpl]; if (!T || T.trophy) return false; let n = 0;
    for (const k in T.stats) { const [, mx] = T.stats[k]; if (mx <= 0) continue; n++; if ((it.stats[k] || 0) < mx) return false; }
    return n > 0;
  };
  /* +2 % sur chaque caractéristique positive (au moins +1) */
  E.perfectStats = (it) => { const o = {}; for (const k in it.stats) { const v = it.stats[k]; o[k] = v > 0 ? v + Math.max(1, Math.round(v * E.PERFECT_PCT / 100)) : v; } return o; };
  E.perfectCount = (S) => Object.values(S.items).filter(E.isPerfect).length;

  /* ---------------- Recrutement & équipe ---------------- */
  E.recruit = (S, cls, name) => {
    const n = S.chars.length + 1; const cost = E.recruitCost(n);
    if (S.chars.length >= 8) return "Équipe complète (8 personnages).";
    if (S.kamas < cost) return `Il faut ${cost} kamas.`;
    S.kamas -= cost;
    const top = Math.max(...S.chars.map((c) => c.lvl));
    const c = E.addChar(S, cls, name || pick(NAMES), Math.max(1, Math.floor(top / 2)));
    note(S, `${c.name} (${CLASSES[cls].name}) rejoint l'aventure !`, "up");
    S.fight = S.dungeon ? S.fight : null;
    return null;
  };
  E.toggleTeam = (S, cid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return;
    if (c.inTeam && E.team(S).length <= 1) return "Il faut au moins un personnage dans l'équipe.";
    if (!c.inTeam && E.team(S).length >= 8) return "8 personnages maximum.";
    if (S.dungeon) return "Impossible de changer l'équipe en donjon.";
    c.inTeam = !c.inTeam; S.fight = null; return null;
  };

  /* ---------------- Hors-ligne ---------------- */
  E.OFFLINE_RATE = 0.25;
  E.OFFLINE_MAX_S = 8 * 3600;
  E.catchUp = (S, seconds) => {
    seconds = Math.min(seconds, E.OFFLINE_MAX_S + E.bonus(S, "offtime") * 3600);
    if (seconds < 60) return null;
    const eff = seconds * (E.OFFLINE_RATE + E.bonus(S, "offrate") / 100);
    const rec = S.stats.recent;
    const avg = rec.length ? rec.reduce((s, r) => s + r.d, 0) / rec.length : 15;
    const winRate = rec.length ? rec.reduce((s, r) => s + r.w, 0) / rec.length : 0.5;
    const cycle = avg + E.PAUSE_MS / 1000;
    const fights = Math.min(5000, Math.floor(eff / cycle));
    const before = { kamas: S.kamas, res: Object.assign({}, S.res), lvls: S.chars.map((c) => c.lvl), items: E.itemCount(S), uids: new Set(Object.keys(S.items)), archis: Object.assign({}, S.archis), souls: Object.assign({}, S.souls || {}), xp: S.chars.map((c) => c.xp) };
    const hunting = S.hunting && S.sub && SUBS[S.sub] && E.team(S).length;
    const evLen = E.events.length;
    let wins = 0;
    const wasDungeon = S.dungeon; S.dungeon = null;
    let sub = SUBS[S.sub]; const teamSize = E.team(S).length; const roamed = [];
    // part de l'absence couverte par le bonus d'XP
    const b = S.boosts && S.boosts.xp; const now = Date.now(); const startT = now - seconds * 1000;
    const covered = b ? clamp((b.until - startT) / (seconds * 1000), 0, 1) : 0;
    const xpBoost = b ? b.pct * covered : 0;
    for (let i = 0; hunting && i < fights; i++) {
      if (rnd() >= winRate) continue;
      wins++;
      const g = E.makeGroup(S, sub, teamSize);
      const pr = E.powRew(g, "hunt"); giveRewards(S, g, { xpBoost, offline: true, xpMult: E.PACE_REW * pr, dropMult: E.PACE_REW * (1 + E.podBonus(S)) * pr, kamasMult: E.PACE_REW * pr });
      E.emit(S, "win", { mons: g.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, champ: m.champ, lvl: m.lvl })), sub: S.sub, offline: true });
      S.progress.wins[S.sub] = (S.progress.wins[S.sub] || 0) + 1;
      E.starsTick(S, cycle, now); // les étoiles de la zone fondent aussi hors ligne
      if (S.settings.roam) { const tz = startT + (i + 1) * seconds * 1000 / fights; if (E.roam(S, tz, true)) { roamed.push(SUBS[S.sub].name); sub = SUBS[S.sub]; } }
    }
    S.dungeon = wasDungeon;
    if (hunting) checkHunt(S, sub.monsters);
    gatherTick(S, eff, { quiet: true });
    E.atelierTick(S, eff, { quiet: true });
    const fmPlans = E.fmPlanTick(S, eff, { quiet: true }); // 0.1.9.1 : la forgemagie automatique continue
    E.petTick(S, seconds * 1000); // les familiers mangent en temps réel
    E.enclosTick(S, seconds * 1000); // les naissances continuent
    E.events.length = evLen; // pas de pluie de notifications
    const res = {};
    for (const k in S.res) { const d = S.res[k] - (before.res[k] || 0); if (d > 0) res[k] = d; }
    return {
      seconds, fights: hunting ? fights : 0, wins, kamas: S.kamas - before.kamas, res,
      items: E.itemCount(S) - before.items,
      newItems: Object.keys(S.items).filter((u) => !before.uids.has(u)).sort((a, b) => ITEMS[S.items[b].tpl].lvl - ITEMS[S.items[a].tpl].lvl).slice(0, 30),
      archis: Object.keys(S.archis).filter((k) => (S.archis[k] || 0) > (before.archis[k] || 0)),
      souls: Object.keys(S.souls || {}).filter((k) => !before.souls[k]), stones: (S.cons && S.cons.pierre_ame) || 0,
      winRate: winRate, fightLen: Math.round(cycle), fmPlans, roamed,
      lvls: S.chars.map((c, i) => [c.name, before.lvls[i] || c.lvl, c.lvl]).filter((x) => x[2] > x[1]),
    };
  };

  /* ---------------- Sauvegarde ---------------- */
  const TRANSIENT = ["fight", "acc", "pause", "manualLive"];
  E.serialize = (S) => {
    const o = {}; for (const k in S) if (!TRANSIENT.includes(k)) o[k] = S[k];
    return JSON.stringify(o);
  };
  E.deserialize = (txt) => {
    const S = JSON.parse(txt);
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
      const ev = E.events.length; S.chars.forEach((c) => { c.ren = c.ren || 0; c.eveils = c.eveils || {}; if (c.lvl < E.MAX_LVL && c.xp >= E.xpNeed(c.lvl)) E.giveXp(S, c, 0); }); E.events.length = ev;
      report.push("0.1.12 : la montée au-delà du niveau 100 est deux fois plus rapide (l'XP demandée par niveau baisse de moitié entre les niveaux 100 et 120). Les héros qui avaient déjà l'XP nécessaire ont gagné leurs niveaux. Au niveau 200, un héros peut renaître (Équipe › Renaissance).");
    }
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
    S.migration = report.length ? report : null;
    if (S.v < 3) { const ev = E.events.length; checkHunt(S, Object.keys(S.bestiary).filter((k) => MONSTERS[k])); E.events.length = ev; S.journal = S.journal.filter((j) => !/^Palier /.test(j.txt)); }
    for (const uid in S.items) if (!ITEMS[S.items[uid].tpl]) delete S.items[uid];
    S.v = E.VERSION;
    return S;
  };

  root.ENGINE = E;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
