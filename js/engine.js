/* ============================================================================
   MOTEUR DU JEU — DofousXen (v2)
   Logique pure : état, combats automatiques, progression, objets, métiers,
   brisage, Emblème du Solitaire, donjons, progression hors-ligne.
   Aucune dépendance au DOM : testable dans Node.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, RUNE_TIERS, RUNE_SIMPLE_ONLY, CLASSES, GATHER_JOBS, CRAFT_JOBS, DOFUS_SLOTS,
          MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, EMBLEM, FREE_SPIRIT, NAMES, HUNT_TIERS, CONSUMABLES } = D;

  const E = {};
  E.VERSION = 4;
  /* Points d'extension (systèmes v2.6 : Havre-Sac, Almanax, alignement, quêtes…) */
  E.bonus = () => 0;          // E.bonus(S, kind) -> % (xp, drop, kamas, gather, dmg, hp, offtime, offrate, bag)
  E.emit = () => {};          // E.emit(S, type, data)

  /* ---------------- Aléatoire & utilitaires ---------------- */
  let rnd = Math.random;
  E.setRng = (f) => { rnd = f; };
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
  Object.values(SUBS).forEach((s) => { if (s.dungeon) DUNGEON_SUB[s.dungeon] = s.id; });
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
  E.xpNeed = (l) => Math.floor(36 * Math.pow(l, 2.7));                // XP pour passer du niveau l à l+1
  E.jobXpNeed = (l) => Math.floor(30 * Math.pow(l, 1.55));
  E.emblemXpNeed = (l) => Math.floor(5 + 0.5 * Math.pow(l, 1.25));     // poids de runes pour passer au niveau suivant
  E.monsterXp = (lvl) => Math.round((10 + Math.pow(lvl, 1.5) * 4.2) * 0.55);
  E.recruitCost = (n) => (n <= 1 ? 0 : Math.round(300 * Math.pow(2.2, n - 2))); // n = numéro du personnage

  /* ---------------- État initial ---------------- */
  E.newState = (name, cls) => {
    const S = {
      v: E.VERSION, created: Date.now(), savedAt: 0, lastTick: Date.now(),
      kamas: 0, nextUid: 1, nextCid: 1,
      chars: [], items: {}, res: {}, runes: {},
      sub: null, hunting: false,
      progress: { wins: {}, bossKills: {} },
      history: [], zoneStats: {}, seenDrops: {}, radiants: 0,
      cons: {}, boosts: {}, trophies: {}, families: {}, huntSeen: {},
      jobs: {}, crafts: {}, coef: {}, tools: {}, finds: 0,
      emblem: { lvl: 1, xp: 0, stats: {}, perks: {} },
      bestiary: {}, archis: {},
      stats: { fights: 0, wins: 0, recent: [], playtime: 0 },
      settings: { theme: "dark", auto: { action: "none", q: 40, keepSets: true } },
      journal: [],
      dungeon: null,
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
      equip: {}, spells: [], inTeam: true, autoStat: CLASSES[cls].main,
    };
    S.chars.push(c);
    E.refreshSpells(c);
    if (c.pts) E.autoAllocate(S, c);
    if (E.team(S).length > 8) c.inTeam = false;
    return c;
  };

  E.team = (S) => S.chars.filter((c) => c.inTeam && !c.job).slice(0, 8);
  E.freeSpirit = (S) => FREE_SPIRIT[Math.max(1, E.team(S).length)] || 0;
  E.isSolo = (S) => E.team(S).length === 1;
  /* Passifs de classe */
  E.teamHas = (S, cls) => E.team(S).some((c) => c.cls === cls);
  E.rosterHas = (S, cls) => S.chars.some((c) => c.cls === cls);
  E.archiMult = (S) => (E.teamHas(S, "eca") ? 1.5 : 1);
  E.radiantMult = (S) => (E.teamHas(S, "eca") ? 1.5 : 1);

  /* Consommables & bonus temporaires (durée en temps réel, cumulable jusqu'à 8 h) */
  E.BOOST_MAX_S = 8 * 3600;
  E.boostPct = (S, kind, at = Date.now()) => { const b = S.boosts && S.boosts[kind]; return b && b.until > at ? b.pct : 0; };
  E.boostLeft = (S, kind) => { const b = S.boosts && S.boosts[kind]; return b ? Math.max(0, (b.until - Date.now()) / 1000) : 0; };
  E.useConsumable = (S, id) => {
    const C = CONSUMABLES[id]; if (!C) return "Objet inconnu.";
    if (!(S.cons[id] > 0)) return "Vous n'en avez plus.";
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

  /* ---------------- Sorts ---------------- */
  const defaultCond = (sp, c) => {
    if (sp.type === "heal" || sp.type === "healall") return "ally_low";
    if (sp.type === "aoe") { const single = c ? E.knownSpells(c).filter((x) => x.type === "dmg" || x.type === "drain").length : 2; return single >= 2 ? "enemy_many" : "always"; }
    return "always";
  };
  E.spellDef = (cls, id) => CLASSES[cls].spells.find((s) => s.id === id);
  E.knownSpells = (c) => CLASSES[c.cls].spells.filter((s) => s.lvl <= c.lvl);
  // Ajoute automatiquement les sorts débloqués tant qu'il reste de la place (6 max)
  E.refreshSpells = (c) => {
    E.knownSpells(c).forEach((sp) => {
      if (c.spells.length < 6 && !c.spells.find((x) => x.id === sp.id) && !(c.knownSeen || []).includes(sp.id)) {
        c.spells.push({ id: sp.id, cond: defaultCond(sp, c) });
      }
    });
    c.knownSeen = E.knownSpells(c).map((s) => s.id);
    // tri initial : buffs/boucliers d'abord, puis soins, puis gros sorts
    if (!c.sortedOnce) {
      const mainEl = D.STATS[CLASSES[c.cls].main].el;
      const rank = (s) => { const d = E.spellDef(c.cls, s.id); return d.type === "buff" || d.type === "shield" ? 0 : d.type.startsWith("heal") ? 1 : (d.el === mainEl ? 2 : 4) - (d.min + d.max) / 2 / d.pa / 10; };
      c.spells.sort((a, b) => rank(a) - rank(b));
      c.sortedOnce = c.lvl >= 13;
    }
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
    BASE_STATS.forEach((k) => (st[k] += c.alloc[k] || 0));
    Object.values(c.equip).forEach((uid) => { const it = S.items[uid]; if (it) addStats(st, it.stats); });
    const counts = E.setCounts(S, c);
    for (const s in counts) { const b = E.setBonus(s, counts[s]); if (b) addStats(st, b); }
    const solo = opts.solo !== undefined ? opts.solo : (E.isSolo(S) && c.inTeam);
    if (solo) {
      addStats(st, S.emblem.stats);
      if (S.emblem.lvl >= 1000) st.pa += 1;
    }
    st.hpMax = Math.round(50 + 5 * c.lvl + st.vit + E.familyBonusVit(S));
    st.pa = Math.min(12, 6 + (c.lvl >= 100 ? 1 : 0) + st.pa);
    st.ini += 100 + c.lvl * 5 + st.fo + st.ine + st.cha + st.age;
    return st;
  };

  /* ---------------- Points de caractéristiques ---------------- */
  E.pointCost = (stat) => (stat === "sa" ? 3 : 1);
  E.allocate = (S, cid, stat, n) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || !BASE_STATS.includes(stat)) return false;
    const cost = E.pointCost(stat);
    const k = Math.min(n, Math.floor(c.pts / cost)); if (k <= 0) return false;
    c.alloc[stat] += k; c.pts -= k * cost; return true;
  };
  E.autoAllocate = (S, c) => { if (c.autoStat && c.pts > 0) E.allocate(S, c.id, c.autoStat, c.pts); };
  E.resetPoints = (S, cid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return;
    c.pts = (c.lvl - 1) * 5; BASE_STATS.forEach((k) => (c.alloc[k] = 0));
  };

  /* ---------------- Journal & événements ---------------- */
  E.events = [];
  const note = (S, txt, kind = "info") => {
    S.journal.unshift({ t: Date.now(), txt, kind });
    if (S.journal.length > 60) S.journal.length = 60;
    E.events.push({ txt, kind });
  };
  E.note = note;

  /* ---------------- Objets ---------------- */
  /* Objets Rayonnants : très rares, +10 à +50 % sur les statistiques positives de l'objet */
  E.RADIANT_CHANCE = 1 / 400;
  E.radiantBonus = () => Math.round(10 + 40 * Math.pow(rnd(), 2.2));
  E.rollItem = (S, tpl, opts = {}) => {
    const T = ITEMS[tpl]; const roll = {};
    for (const k in T.stats) { const [a, b] = T.stats[k]; roll[k] = ri(a, b); }
    const it = { uid: S.nextUid++, tpl, stats: Object.assign({}, roll) };
    const chance = opts.radiant === true ? 1 : E.RADIANT_CHANCE * (opts.archi ? 5 : 1) * E.radiantMult(S);
    if (opts.radiant !== false && rnd() < chance) {
      it.radiant = E.radiantBonus(); it.roll = roll;
      for (const k in it.stats) if (it.stats[k] > 0) it.stats[k] = Math.ceil(it.stats[k] * (1 + it.radiant / 100));
      S.radiants = (S.radiants || 0) + 1;
      note(S, `✦ Objet Rayonnant : ${T.name} (+${it.radiant} %) !`, "radiant");
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
      if (DOFUS_SLOTS.some((s) => s !== o && c.equip[s] && S.items[c.equip[s]] && S.items[c.equip[s]].tpl === it.tpl)) return "Vous portez déjà ce trophée.";
      c.equip[o] = uid; return null;
    }
    c.equip[slotOverride || T.slot] = uid; E.emit(S, "equip", {}); return null;
  };
  E.unequip = (S, cid, slot) => { const c = S.chars.find((x) => x.id === cid); if (c) delete c.equip[slot]; };

  E.sellItem = (S, uid) => {
    const it = S.items[uid]; if (!it || E.equippedBy(S, uid) || it.locked) return 0;
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
    S.hunting = true; S.fight = null; S.pause = E.PAUSE_MS;
    E.applyZonePresets(S, sid);
    note(S, `Chasse : ${SUBS[sid].name}`, "info");
    return null;
  };
  E.stopHunt = (S) => { if (S.dungeon) return "Quittez d'abord le donjon."; S.hunting = false; S.fight = null; return null; };

  /* ---------------- Stratégies (préréglages de sorts) ---------------- */
  E.MAX_PRESETS = 4;
  E.savePreset = (S, cid, idx, name) => {
    const c = S.chars.find((x) => x.id === cid); if (!c || idx < 0 || idx >= E.MAX_PRESETS) return;
    c.presets[idx] = { name: (name || `Stratégie ${idx + 1}`).slice(0, 24), spells: c.spells.map((x) => ({ id: x.id, cond: x.cond })) };
    c.activePreset = idx;
  };
  E.applyPreset = (S, cid, idx) => {
    const c = S.chars.find((x) => x.id === cid); const p = c && c.presets[idx]; if (!p) return false;
    c.spells = p.spells.filter((x) => { const d = E.spellDef(c.cls, x.id); return d && d.lvl <= c.lvl; }).map((x) => ({ id: x.id, cond: x.cond }));
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

  /* ---------------- Création des entités de combat ---------------- */
  const monsterEntity = (id, lvl, opts = {}) => {
    const base = MONSTERS[id];
    const archi = !!opts.archi && !!base.archi;
    const key = archi ? base.archi : id;
    const m = MONSTERS[key];
    const hp = Math.round((15 + lvl * 8.5) * base.hp * (archi ? 2.2 : 1));
    return {
      side: "m", key, base: id, race: base.race, name: m.name, img: m.img, lvl, archi, boss: !!m.boss,
      hpMax: hp, hp, el: m.el, atk: m.atk || "Attaque", res: m.res,
      dmg: (3 + lvl * 0.95) * (base.dmg || 1) * (archi ? 1.4 : 1),
      ini: 50 + lvl * 4 + (m.boss ? 100 : 0), attacks: m.boss ? 2 : 1,
      buffs: [], dots: [], shield: 0, alive: true, weaken: 0,
    };
  };
  const charEntity = (S, c) => {
    const st = E.charStats(S, c);
    const fs = E.freeSpirit(S);
    const hpMax = Math.round(st.hpMax * (1 + fs / 200) * (E.teamHas(S, "osa") ? 1.05 : 1) * (1 + E.bonus(S, "hp") / 100));
    return {
      side: "c", cid: c.id, name: c.name, cls: c.cls, lvl: c.lvl, st, hpMax, hp: hpMax,
      ini: st.ini, buffs: [], dots: [], shield: 0, alive: true, cd: {}, weaken: 0,
    };
  };
  E.ARCHI_CHANCE = 1 / 400;

  E.makeGroup = (S, sub, teamSize) => {
    const size = ri(1, Math.min(8, teamSize + 1));
    const g = [];
    for (let i = 0; i < size; i++) {
      const id = pick(sub.monsters); const m = MONSTERS[id];
      const lvl = ri(Math.max(m.lvl[0], sub.lvl[0]), Math.min(m.lvl[1], sub.lvl[1]) || m.lvl[1]);
      const fl = E.huntTier(S, id) >= 3 ? 2 : 1;
      g.push(monsterEntity(id, Math.max(1, lvl), { archi: rnd() < E.ARCHI_CHANCE * E.archiMult(S) * fl }));
    }
    return g;
  };

  E.startFight = (S) => {
    const team = E.team(S); if (!team.length) return null;
    let mons, label;
    if (S.dungeon) {
      const dg = DUNGEONS[S.dungeon.id]; const r = S.dungeon.room;
      if (r < dg.rooms.length) {
        const room = dg.rooms[r]; const n = clamp(Math.round(ri(room.size[0], room.size[1]) * (0.45 + team.length * 0.12)), 1, 8);
        mons = []; for (let i = 0; i < n; i++) mons.push(monsterEntity(pick(room.mobs), room.lvl + ri(0, 1)));
        label = `${dg.name} — salle ${r + 1}/${dg.rooms.length + 1}`;
      } else {
        const bm = MONSTERS[dg.boss];
        const boss = monsterEntity(dg.boss, bm.lvl[0]);
        const k = (1.5 + team.length * 0.55) / 5; boss.hpMax = boss.hp = Math.round(boss.hpMax * k);
        mons = [boss];
        const extra = clamp(team.length - 1, 0, 7);
        for (let i = 0; i < extra; i++) mons.push(monsterEntity(pick(dg.bossMobs), dg.lvl - ri(1, 3)));
        label = `${dg.name} — salle du boss`;
      }
    } else {
      const sub = SUBS[S.sub];
      if (!sub || !S.hunting) return null;
      mons = E.makeGroup(S, sub, team.length);
      label = sub.name;
      if (mons.some((m) => m.archi)) note(S, `Un archimonstre apparaît : ${mons.find((m) => m.archi).name} !`, "rare");
    }
    const ents = team.map((c) => charEntity(S, c)).concat(mons);
    var fsub = S.dungeon ? null : S.sub, fdg = S.dungeon ? S.dungeon.id : null;
    S.fight = { id: (S.fightSeq = (S.fightSeq || 0) + 1), label, ents, round: 1, order: [], oi: 0, log: [], over: false, result: null, dur: 0, dungeon: !!S.dungeon, seq: 0, fx: [], sub: fsub, dungeonId: fdg };
    newRound(S.fight);
    return S.fight;
  };

  const newRound = (F) => {
    const ini = (e) => e.ini + (F.round === 1 && e.cls === "cra" ? 1e7 : 0);
    F.order = F.ents.filter((e) => e.alive).sort((a, b) => ini(b) - ini(a)).map((e) => F.ents.indexOf(e));
    F.oi = 0;
  };
  const flog = (F, txt, cls = "") => { F.log.push({ txt, cls }); if (F.log.length > 40) F.log.shift(); };
  const alive = (F, side) => F.ents.filter((e) => e.alive && e.side === side);

  /* ---------------- Résolution des actions ---------------- */
  const buffSum = (e, k) => e.buffs.reduce((s, b) => s + (b[k] || 0), 0);

  const dealDamage = (F, src, tgt, raw, el) => {
    let v = raw;
    // résistances
    let res = 0;
    if (tgt.side === "m") { res = tgt.res[el] || 0; if (tgt.boss && src && src.cls === "forge" && res > 0) res *= 0.5; }
    else {
      const rk = ELEMENTS[el] && ELEMENTS[el].res; res = rk ? tgt.st[rk] || 0 : 0;
      res += tgt.resBonus || 0;
    }
    res = Math.min(50, res);
    v = v * (1 - res / 100);
    if (tgt.side === "c") v *= (F && F.feca ? 0.95 : 1) * (tgt.mask === "def" ? 0.9 : 1);
    v = Math.max(1, Math.round(v));
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, v); tgt.shield -= a; v -= a; }
    tgt.hp -= v;
    if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; }
    if (F && F.fx) F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(tgt), s: src ? F.ents.indexOf(src) : -1, v, el: el || "n" });
    return v;
  };

  const charDamage = (S, F, e, sp, mult = 1, tgt = null) => {
    const el = sp.el || "n";
    const stat = e.st[ELEMENTS[el].stat] || 0;
    const pui = e.st.pui + buffSum(e, "pui");
    let v = rf(sp.min, sp.max) * (1 + Math.max(-50, stat + pui) / 100) + e.st.do;
    const crit = rnd() * 100 < Math.min(60, 5 + e.st.cri + buffSum(e, "cri"));
    if (crit) v = v * 1.3 + 3;
    v *= 1 + e.dmgBonus / 100;
    v *= mult;
    // passifs de classe
    if (tgt && tgt.boss && e.cls === "iop") v *= 1.1;
    if (e.cls === "sacri") v *= 1 + 0.3 * (1 - e.hp / e.hpMax);
    if (e.cls === "roub" && alive(F, "m").length >= 4) v *= 1.15;
    if (e.cls === "elio" && sp.type === "aoe") v *= 1.15;
    if (e.cls === "hupper" && e.lastEl && e.lastEl !== el) v *= 1.1;
    if (e.cls === "ougi" && tgt) { e.stack = e.lastTgt === tgt ? Math.min(5, (e.stack || 0) + 1) : 0; e.lastTgt = tgt; v *= 1 + 0.05 * e.stack; }
    if (e.mask === "atk") v *= 1.15;
    v *= (CLASSES[e.cls] && CLASSES[e.cls].pow) || 1;
    // palier Expert : +10 % contre la famille
    if (tgt && tgt.race !== undefined && F.expertRaces && F.expertRaces.has(tgt.race)) v *= 1.1;
    e.lastEl = el;
    return { v, crit };
  };
  const healAmount = (e, sp) => {
    const pui = e.st.pui + buffSum(e, "pui");
    return (rf(sp.min, sp.max) * (1 + (e.st.ine + pui) / 100) + e.st.so) * (e.cls === "eni" ? 1.1 : 1) * (e.mask === "soin" ? 1.15 : 1);
  };
  const doHeal = (t, v, F) => {
    const before = t.hp; t.hp = Math.min(t.hpMax, t.hp + Math.round(v)); const g = t.hp - before;
    if (F && F.fx && g > 0) F.fx.push({ seq: F.seq, k: "heal", t: F.ents.indexOf(t), v: g });
    return g;
  };

  const condOk = (F, e, cond, sp) => {
    const allies = alive(F, "c"); const foes = alive(F, "m");
    switch (cond) {
      case "first_turn": return F.round === 1;
      case "ally_low": return allies.some((a) => a.hp / a.hpMax < 0.6);
      case "self_low": return e.hp / e.hpMax < 0.5;
      case "enemy_many": return foes.length >= 3;
      case "enemy_one": return foes.length === 1;
      case "boss": return foes.some((f) => f.boss);
      default: return true;
    }
  };

  const castSpell = (S, F, e, sp, forced) => {
    const foes = alive(F, "m"); const allies = alive(F, "c");
    const fFoe = forced && forced.alive && forced.side === "m" ? forced : null;
    const fAlly = forced && forced.alive && forced.side === "c" ? forced : null;
    const lowest = (arr) => arr.slice().sort((a, b) => a.hp - b.hp)[0];
    const lowestPct = (arr) => arr.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
    switch (sp.type) {
      case "dmg": case "drain": case "poison": {
        const t = fFoe || lowest(foes); if (!t) return false;
        const { v, crit } = charDamage(S, F, e, sp, 1, t);
        if (sp.type === "poison") {
          t.dots.push({ v: v, turns: sp.turns, el: sp.el, src: e.name });
          flog(F, `${e.name} lance ${sp.name} sur ${t.name} (poison ${sp.turns} tours)`, "c");
          return true;
        }
        const d = dealDamage(F, e, t, v, sp.el);
        let extra = "";
        if (sp.type === "drain") { const h = doHeal(e, d / 2, F); if (h) extra = `, +${h} PV`; }
        if (sp.weaken) { t.weaken = sp.weaken; }
        flog(F, `${e.name} · ${sp.name} → ${t.name} : −${d}${crit ? " (critique)" : ""}${extra}`, "c" + (crit ? " crit" : ""));
        if (!t.alive) flog(F, `${t.name} est vaincu.`, "ko");
        return true;
      }
      case "aoe": {
        if (!foes.length) return false;
        const parts = [];
        foes.forEach((t) => { const { v } = charDamage(S, F, e, sp, 0.85, t); const d = dealDamage(F, e, t, v, sp.el); parts.push(d); });
        flog(F, `${e.name} · ${sp.name} : −${parts.join(" / −")}`, "c");
        foes.forEach((t) => { if (!t.alive) flog(F, `${t.name} est vaincu.`, "ko"); });
        return true;
      }
      case "heal": {
        const t = fAlly || lowestPct(allies); if (!t || t.hp >= t.hpMax) return false;
        const h = doHeal(t, healAmount(e, sp), F);
        flog(F, `${e.name} · ${sp.name} → ${t.name} : +${h} PV`, "heal"); return true;
      }
      case "healall": {
        if (!allies.some((a) => a.hp < a.hpMax)) return false;
        let tot = 0; allies.forEach((t) => (tot += doHeal(t, healAmount(e, sp), F)));
        flog(F, `${e.name} · ${sp.name} : +${tot} PV à l'équipe`, "heal"); return true;
      }
      case "buff": {
        const tg = sp.target === "allies" ? allies : [e];
        tg.forEach((t) => { t.buffs.push({ pui: sp.pui || 0, cri: sp.cri || 0, turns: sp.turns, name: sp.name }); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: sp.pui ? `+${sp.pui} Pui` : `+${sp.cri} % Cri` }); });
        flog(F, `${e.name} lance ${sp.name}`, "buff"); return true;
      }
      case "shield": {
        const tg = sp.target === "allies" ? allies : [e];
        tg.forEach((t) => { t.shield = Math.max(t.shield, Math.round(t.hpMax * sp.pct / 100)); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: `Bouclier ${t.shield}` }); });
        flog(F, `${e.name} lance ${sp.name} (bouclier)`, "buff"); return true;
      }
    }
    return false;
  };

  /* Mode manuel : le joueur choisit sorts et cibles ; retour en automatique après 10 s sans action */
  E.MANUAL_TIMEOUT = 10;
  E.manualOn = (S) => !!(S.settings && S.settings.manual && S.manualLive);
  const charTurn = (S, F, e, paStart) => {
    const c = S.chars.find((x) => x.id === e.cid); if (!c) return;
    if (paStart === undefined && E.manualOn(S)) { F.await = { ei: F.ents.indexOf(e), pa: e.st.pa, t: F.dur, n: 0, casts: {} }; return; }
    let pa = paStart !== undefined ? paStart : e.st.pa; let cast = 0;
    for (const slot of c.spells) {
      const sp = E.spellDef(c.cls, slot.id); if (!sp || sp.lvl > c.lvl) continue;
      const casts = sp.casts || 1;
      for (let k = 0; k < casts; k++) {
        if (!alive(F, "m").length) return;
        if ((e.cd[sp.id] || 0) > 0 || sp.pa > pa) break;
        if (!condOk(F, e, slot.cond, sp)) break;
        if (castSpell(S, F, e, sp)) { pa -= sp.pa; cast++; if (sp.cd) e.cd[sp.id] = sp.cd + 1; F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e), sp: sp.id }); } else break;
      }
    }
    if (!cast && paStart === undefined) flog(F, `${e.name} passe son tour.`, "dim");
    e.lastCast = F.seq;
    if (c.cls === "xelor" && !e.replayed && cast && rnd() < 0.1 && alive(F, "m").length) {
      e.replayed = true; flog(F, `${e.name} distord le temps et rejoue !`, "buff");
      for (const k in e.cd) if (e.cd[k] > 0) e.cd[k]--;
      charTurn(S, F, e);
    }
    e.replayed = false;
  };

  const monsterTurn = (S, F, e) => {
    for (let k = 0; k < e.attacks; k++) {
      const targets = alive(F, "c"); if (!targets.length) return;
      const t = pick(targets);
      F.fx.push({ seq: F.seq, k: "cast", s: F.ents.indexOf(e) });
      let v = e.dmg * rf(0.85, 1.15) * (1 - e.weaken / 100);
      const d = dealDamage(F, e, t, v, e.el === "n" ? null : e.el);
      flog(F, `${e.name} · ${e.atk} → ${t.name} : −${d}`, "m");
      if (!t.alive) flog(F, `${t.name} est à terre.`, "ko");
    }
    e.weaken = 0;
  };

  const startOfTurn = (S, F, e) => {
    // poisons
    e.dots = e.dots.filter((d) => {
      const v = dealDamage(F, null, e, d.v, d.el);
      flog(F, `${e.name} subit −${v} (poison)`, "dim");
      d.turns--; return d.turns > 0 && e.alive;
    });
    if (!e.alive) { flog(F, `${e.name} est vaincu.`, "ko"); return false; }
    e.buffs = e.buffs.filter((b) => --b.turns >= 0);
    if (e.cd) for (const k in e.cd) if (e.cd[k] > 0) e.cd[k]--;
    if (e.side === "c" && e.regen) doHeal(e, e.hpMax * e.regen / 100, F);
    return true;
  };

  /* Bonus de combat liés à l'Esprit Libre et à l'Emblème */
  const applyFightBonuses = (S, F) => {
    const fs = E.freeSpirit(S); const solo = E.isSolo(S); const pk = S.emblem.perks;
    F.feca = E.teamHas(S, "feca");
    F.expertRaces = new Set();
    for (const r in RACE_MONS) if (RACE_MONS[r].some((k) => E.huntTier(S, k) >= 2)) F.expertRaces.add(+r);
    F.ents.filter((e) => e.side === "c").forEach((e) => {
      if (e.cls === "zobal") e.mask = pick(["atk", "def", "soin"]);
      e.dmgBonus = fs / 2 + (solo && pk[500] === "dmg" ? 15 : 0) + E.bonus(S, "dmg");
      e.resBonus = solo && pk[500] === "res" ? 8 : 0;
      e.regen = solo && pk[500] === "heal" ? 5 : 0;
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
    F.seq++; if (F.fx.length > 60) F.fx.splice(0, F.fx.length - 60);
    if (F.oi >= F.order.length) { F.round++; newRound(F); if (F.round > 60) return endFight(S, false, "Le combat s'éternise : retraite."); }
    const e = F.ents[F.order[F.oi++]];
    if (!e || !e.alive) return E.step(S);
    if (!startOfTurn(S, F, e)) return checkEnd(S);
    if (e.side === "c") charTurn(S, F, e); else monsterTurn(S, F, e);
    checkEnd(S);
  };
  const checkEnd = (S) => {
    const F = S.fight;
    if (!alive(F, "m").length) endFight(S, true);
    else if (!alive(F, "c").length) endFight(S, false);
  };

  E.manualCanCast = (S, sp) => {
    const F = S.fight; const A = F && F.await; if (!A) return false; const e = F.ents[A.ei];
    return sp.pa <= A.pa && !((e.cd[sp.id] || 0) > 0) && (A.casts[sp.id] || 0) < (sp.casts || 1);
  };
  E.manualCast = (S, spellId, targetIdx) => {
    const F = S.fight; const A = F && F.await; if (!A || F.over) return "Ce n'est pas votre tour.";
    const e = F.ents[A.ei]; const c = S.chars.find((x) => x.id === e.cid);
    if (!c || !c.spells.find((x) => x.id === spellId)) return "Sort non équipé.";
    const sp = E.spellDef(c.cls, spellId); if (!sp) return "Sort inconnu.";
    if (!E.manualCanCast(S, sp)) return sp.pa > A.pa ? "Pas assez de PA." : "Sort en recharge.";
    const tgt = targetIdx !== undefined && targetIdx !== null ? F.ents[targetIdx] : null;
    F.seq++;
    if (!castSpell(S, F, e, sp, tgt)) return "Aucune cible valable.";
    A.pa -= sp.pa; A.n++; A.casts[sp.id] = (A.casts[sp.id] || 0) + 1; A.t = F.dur;
    if (sp.cd) e.cd[sp.id] = sp.cd + 1;
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
    F.await = null; e.lastCast = F.seq;
  };

  /* ---------------- Récompenses ---------------- */
  E.teamProspection = (S) => E.team(S).reduce((s, c) => s + E.charStats(S, c).pp, 0);
  E.dropMult = (S) => {
    const solo = E.isSolo(S);
    return (1 + E.teamProspection(S) / 100) * (1 + E.freeSpirit(S) / 100) * (solo && S.emblem.perks[250] === "drop" ? 1.15 : 1) * (1 + E.bonus(S, "drop") / 100);
  };

  const giveRewards = (S, mons, opts = {}) => {
    const team = E.team(S); const solo = E.isSolo(S); const fs = E.freeSpirit(S);
    const out = { xp: {}, kamas: 0, res: {}, items: [], ups: [] };
    let xp = 0; const maxLvl = Math.max(...mons.map((m) => m.lvl));
    mons.forEach((m) => {
      let x = E.monsterXp(m.lvl) * (m.boss ? 6 : 1) * (m.archi ? 5 : 1);
      xp += x;
      out.kamas += Math.round((m.lvl * 1.5 + ri(0, m.lvl)) * (m.boss ? 8 : 1) * (E.teamHas(S, "enu") ? 1.2 : 1) * (1 + E.bonus(S, "kamas") / 100));
      S.bestiary[m.key] = (S.bestiary[m.key] || 0) + 1;
      if (m.archi) { S.archis[m.key] = (S.archis[m.key] || 0) + 1; note(S, `Archimonstre vaincu : ${m.name} !`, "rare"); }
    });
    xp *= 1 + (mons.length - 1) * 0.1; // bonus de groupe
    const share = 2 / (team.length + 1);
    team.forEach((c) => {
      const st = E.charStats(S, c);
      const diff = c.lvl - maxLvl;
      const pen = E.xpPenalty(diff);
      const boost = 1 + (opts.xpBoost !== undefined ? opts.xpBoost : E.boostPct(S, "xp")) / 100;
      const g = Math.round(xp * share * (1 + st.sa / 100) * (1 + fs / 100) * (solo && S.emblem.perks[250] === "xp" ? 1.15 : 1) * pen * boost * (opts.xpMult || 1) * (1 + E.bonus(S, "xp") / 100));
      out.xp[c.id] = g;
      const ups = E.giveXp(S, c, g); if (ups) out.ups.push([c.name, c.lvl]);
    });
    S.kamas += out.kamas;
    // Butin
    const dm = E.dropMult(S) * (opts.dropMult || 1) * (E.teamHas(S, "enu") ? 1.2 : 1);
    const ougi = E.teamHas(S, "ougi");
    const sub = SUBS[S.sub];
    const seen = (k, what) => { (S.seenDrops[k] = S.seenDrops[k] || {})[what] = 1; };
    mons.forEach((m) => {
      const T = MONSTERS[m.base || m.key]; const q = m.archi ? 3 : 1;
      const tq = E.huntTier(S, m.base || m.key) >= 1 ? 1.05 : 1;
      const rolls = 1 + (E.teamHas(S, "sram") && rnd() < 0.1 ? 1 : 0);
      for (let rr = 0; rr < rolls; rr++)
      T.drops.forEach(([r, rate]) => { const mm = dm * tq * (ougi && /^Viande/.test(r) ? 1.2 : 1); if (rnd() * 100 < Math.min(100, rate * (rate >= 100 ? 1 : mm))) { addRes(S, r, q); out.res[r] = (out.res[r] || 0) + q; seen(m.key, r); } });
      if (m.boss && rnd() < E.BONBON_RATE) { S.cons.bonbon_sagesse = (S.cons.bonbon_sagesse || 0) + 1; out.cons = (out.cons || 0) + 1; note(S, "Butin rare : Bonbon Sagesse !", "rare"); }
      T.items.forEach(([tpl, rate]) => {
        if (!ITEMS[tpl]) return;
        if (rnd() * 100 < Math.min(100, rate * E.ITEM_DROP_SCALE * dm)) {
          seen(m.key, tpl);
          if (E.itemCount(S) >= E.itemCap(S)) { note(S, `Sac plein : ${ITEMS[tpl].name} perdu.`, "warn"); return; }
          const it = E.rollItem(S, tpl, { archi: m.archi });
          const auto = E.applyAuto(S, it);
          if (auto) out.auto = (out.auto || 0) + 1; else out.items.push(it.uid);
        }
      });
      // clés de donjon
      if (!opts.dungeon && sub && sub.dungeon && sub.monsters.includes(m.base || m.key)) {
        const dg = DUNGEONS[sub.dungeon];
        if (rnd() * 100 < dg.keyDrop * dm) { addRes(S, dg.key, 1); out.res[dg.key] = (out.res[dg.key] || 0) + 1; note(S, `Butin : ${dg.key}`, "loot"); }
      }
    });
    return out;
  };
  E.giveRewards = giveRewards;
  E.BONBON_RATE = 0.02;
  /* Pénalité d'XP quand les monstres sont trop faibles pour le héros */
  E.xpPenalty = (diff) => (diff > 4 ? Math.max(0.05, 1 - (diff - 4) * 0.1) : 1);
  /* Règles automatiques de vente / brisage des objets lâchés */
  E.applyAuto = (S, it) => {
    const A = S.settings.auto; if (!A || A.action === "none" || it.radiant || it.locked) return null;
    const T = ITEMS[it.tpl]; if (A.keepSets && T.set) return null;
    if (E.itemQuality(it) * 100 >= A.q) return null;
    if (A.action === "sell") { E.sellItem(S, it.uid); return "sell"; }
    if (A.action === "break") { E.breakItem(S, it.uid, null); return "break"; }
    return null;
  };
  E.ITEM_DROP_SCALE = 0.12; // les taux réels de DOFUS sont pensés pour des combats de plusieurs minutes

  E.giveXp = (S, c, g) => {
    if (c.lvl >= E.MAX_LVL) return false;
    c.xp += g; let up = false;
    while (c.lvl < E.MAX_LVL && c.xp >= E.xpNeed(c.lvl)) {
      c.xp -= E.xpNeed(c.lvl); c.lvl++; c.pts += 5; up = true;
    }
    if (up) {
      E.refreshSpells(c); E.autoAllocate(S, c);
      note(S, `${c.name} passe niveau ${c.lvl} !`, "up");
      E.emit(S, "level", { cid: c.id, lvl: c.lvl });
      const nw = CLASSES[c.cls].spells.filter((s) => s.lvl === c.lvl);
      nw.forEach((s) => note(S, `${c.name} apprend ${s.name}.`, "up"));
    }
    return up;
  };

  const endFight = (S, win, why) => {
    const F = S.fight; F.over = true; F.result = win ? "win" : "lose";
    S.stats.fights++;
    if (win) {
      S.stats.wins++;
      const mons = F.ents.filter((e) => e.side === "m");
      F.rewards = giveRewards(S, mons, { dungeon: !!S.dungeon });
      checkHunt(S, [...new Set(mons.map((m) => m.key))]);
      E.emit(S, "win", { mons: mons.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, lvl: m.lvl })), sub: S.dungeon ? null : S.sub, dungeon: S.dungeon ? S.dungeon.id : null });
      if (!S.dungeon) S.progress.wins[S.sub] = (S.progress.wins[S.sub] || 0) + 1;
      const xpTot = Object.values(F.rewards.xp).reduce((a, b) => a + b, 0);
      flog(F, `Victoire ! +${xpTot} XP, +${F.rewards.kamas} kamas`, "win");
      const prevUnlocked = new Set(Object.keys(SUBS).filter((s) => E.subUnlocked(S, s)));
      if (S.dungeon) {
        const dg = DUNGEONS[S.dungeon.id];
        if (S.dungeon.room >= dg.rooms.length) {
          S.progress.bossKills[S.dungeon.id] = (S.progress.bossKills[S.dungeon.id] || 0) + 1;
          E.emit(S, "dungeon", { id: S.dungeon.id });
          note(S, `${MONSTERS[dg.boss].name} est vaincu ! Donjon terminé.`, "rare");
          S.dungeon = null;
          if (S.hunting && S.sub) E.applyZonePresets(S, S.sub);
        } else S.dungeon.room++;
      }
      Object.keys(SUBS).forEach((s) => { if (!prevUnlocked.has(s) && E.subUnlocked(S, s)) note(S, `Nouvelle sous-zone : ${SUBS[s].name}`, "up"); });
    } else {
      flog(F, why || "Défaite… l'équipe se repose.", "lose");
      if (S.dungeon) { note(S, `Échec dans ${DUNGEONS[S.dungeon.id].name}. La clé est perdue.`, "warn"); S.dungeon = null; }
    }
    S.stats.recent.push({ d: Math.round(F.dur * 10) / 10, w: win ? 1 : 0 });
    if (S.stats.recent.length > 20) S.stats.recent.shift();
    // historique et rendement par zone
    const zkey = F.dungeonId ? "dg:" + F.dungeonId : F.sub;
    const r = F.rewards || { xp: {}, kamas: 0, res: {}, items: [] };
    const xpTot = Object.values(r.xp).reduce((a, b) => a + b, 0);
    const nres = Object.values(r.res).reduce((a, b) => a + b, 0);
    S.history.unshift({ t: Date.now(), z: zkey, label: F.label, w: win ? 1 : 0, d: Math.round(F.dur), xp: xpTot, k: r.kamas, r: nres, i: r.items.length });
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

  /* ---------------- Donjons ---------------- */
  E.enterDungeon = (S, did) => {
    const dg = DUNGEONS[did]; if (!dg) return "Donjon inconnu.";
    if (!E.dungeonUnlocked(S, did)) return "Donjon verrouillé.";
    if (S.dungeon) return "Vous êtes déjà en donjon.";
    if ((S.res[dg.key] || 0) < 1) return `Il vous faut : ${dg.key}.`;
    S.res[dg.key]--; if (!S.res[dg.key]) delete S.res[dg.key];
    S.dungeon = { id: did, room: 0 };
    S.fight = null; S.pause = 0;
    E.applyZonePresets(S, "dg:" + did);
    note(S, `Entrée dans ${dg.name}.`, "info");
    return null;
  };
  E.leaveDungeon = (S) => { if (S.dungeon) { note(S, "Vous quittez le donjon (clé perdue).", "warn"); S.dungeon = null; S.fight = null; if (S.hunting && S.sub) E.applyZonePresets(S, S.sub); } };

  /* ---------------- Boucle principale ---------------- */
  E.STEP_MS = 520;
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
    // récolte
    gatherTick(S, dtMs / 1000);
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
  E.gatherMult = (S, job) => ((job === "bucheron" || job === "alchimiste") && E.rosterHas(S, "sadi") ? 0.8 : 1) * (job === "pecheur" && E.rosterHas(S, "steam") ? 0.75 : 1);
  E.TOOL_MAX = 10;
  E.toolLvl = (S, job) => (S.tools && S.tools[job]) || 0;
  E.toolCost = (S, job) => {
    const l = E.toolLvl(S, job); const items = GATHER_JOBS[job].items; const r = items[Math.min(items.length - 1, Math.floor(l / 2))][0];
    return { kamas: Math.round(250 * Math.pow(2, l)), res: r, qty: 15 + l * 10 };
  };
  E.upgradeTool = (S, job) => {
    const l = E.toolLvl(S, job); if (l >= E.TOOL_MAX) return "Outil au niveau maximum.";
    const c = E.toolCost(S, job);
    if (S.kamas < c.kamas) return `Il faut ${c.kamas} kamas.`;
    if ((S.res[c.res] || 0) < c.qty) return `Il faut ${c.qty} × ${c.res}.`;
    S.kamas -= c.kamas; S.res[c.res] -= c.qty; if (!S.res[c.res]) delete S.res[c.res];
    S.tools[job] = l + 1; note(S, `Outil de ${GATHER_JOBS[job].name} amélioré (niveau ${l + 1}).`, "up"); return null;
  };
  E.gatherSpeed = (S, job) => (1 + E.toolLvl(S, job) * 0.08) * (1 + E.bonus(S, "gather") / 100) / E.gatherMult(S, job);
  E.gatherPeriod = (S, c) => { const j = c.job; return j ? E.gatherTime(S.jobs[j.job].lvl) / E.gatherSpeed(S, j.job) : 0; };
  E.FIND_CHANCE = 0.01;
  E.setJob = (S, cid, job, sid, res) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (S.dungeon && c.inTeam && !c.job) return "Impossible pendant un donjon.";
    if (!job) { if (c.job) { c.job = null; S.fight = S.dungeon ? S.fight : null; note(S, `${c.name} revient chasser.`, "info"); } return null; }
    if (!E.subUnlocked(S, sid)) return "Sous-zone verrouillée.";
    const list = E.harvestList(sid, job); if (!list.length) return "Rien à récolter ici pour ce métier.";
    const lvl = S.jobs[job].lvl;
    const pickRes = res && list.find((x) => x[0] === res && x[2] <= lvl) ? res : (list.filter((x) => x[2] <= lvl).pop() || [])[0];
    if (!pickRes) return `${GATHER_JOBS[job].name} niveau ${list[0][2]} requis ici.`;
    const was = !!c.job; c.job = { job, sub: sid, res: pickRes, prog: 0 };
    if (!was) S.fight = S.dungeon ? S.fight : null;
    note(S, `${c.name} récolte : ${pickRes} (${SUBS[sid].name}).`, "info");
    return null;
  };
  const gatherTick = (S, dt, opts = {}) => {
    let total = 0;
    S.chars.forEach((c) => {
      const W = c.job; if (!W) return; const J = S.jobs[W.job]; if (!J) { c.job = null; return; }
      const def = E.harvestList(W.sub, W.job).find((x) => x[0] === W.res); if (!def || def[2] > J.lvl) return;
      W.prog += dt; const t = E.gatherPeriod(S, c);
      let n = 0;
      while (W.prog >= t && n < 200000) {
        W.prog -= t; n++;
        let q = 1; if (rnd() < J.lvl / 200) q++;
        if (rnd() < E.FIND_CHANCE) { q *= 5; S.finds = (S.finds || 0) + 1; if (!opts.quiet) note(S, `Trouvaille ! ${c.name} déniche ${q} × ${W.res}.`, "rare"); }
        addRes(S, W.res, q); total += q;
        J.xp += 10 + def[2] * 1.0;
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
    if (R.unique && (S.res[name] || 0) > 0) return "Vous possédez déjà cet objet.";
    if (!E.canCraft(S, R)) return "Ressources insuffisantes.";
    R.ing.forEach(([r, q]) => { S.res[r] -= q; if (!S.res[r]) delete S.res[r]; });
    addRes(S, name, 1);
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
    return tier === "pa" ? `Rune Pa ${s.short}` : tier === "ra" ? `Rune Ra ${s.short}` : `Rune ${s.short}`;
  };
  E.runeInfo = (key) => {
    const [tier, stat] = key.split(":"); const mult = tier === "pa" ? 3 : tier === "ra" ? 10 : 1;
    const s = STATS[stat]; return { stat, tier, pts: s.pts * mult, weight: s.w * s.pts * mult };
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
    const perk = S.emblem.perks[250] === "brisage" ? 1.15 : 1;
    const w = {};
    const rad = it.radiant ? 1.5 : 1;
    for (const k in it.stats) { const v = it.stats[k]; if (v > 0) w[k] = v * STATS[k].w * lvlMult * coef / 100 * perk * rad; }
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
  E.breakItem = (S, uid, focus) => {
    const it = S.items[uid]; if (!it) return "Objet introuvable.";
    if (E.equippedBy(S, uid)) return "Retirez d'abord cet objet.";
    if (it.locked) return "Objet protégé par le cadenas.";
    const p = E.breakPreview(S, uid, focus);
    const got = {};
    for (const k in p.weights) {
      const r = weightToRunes(k, p.weights[k] * rf(0.85, 1.05));
      for (const rk in r) { S.runes[rk] = (S.runes[rk] || 0) + r[rk]; got[rk] = (got[rk] || 0) + r[rk]; }
    }
    S.coef[it.tpl] = { v: Math.max(10, p.coef - 3), t: Date.now() };
    delete S.items[uid];
    return got;
  };

  /* ---------------- Emblème du Solitaire ---------------- */
  E.emblemLines = (lvl) => EMBLEM.lines.filter(([l]) => lvl >= l).pop()[1];
  E.emblemRank = (lvl) => EMBLEM.ranks.filter(([l]) => lvl >= l).pop()[1];
  E.emblemCap = (stat, lvl) => {
    if (stat === "pa") return 0;
    const f = EMBLEM.cap[stat] || 0; return Math.floor(f * (lvl + 10) * (lvl >= 850 ? 1.5 : 1));
  };
  E.feedRune = (S, key, qty) => {
    const have = S.runes[key] || 0; const n = Math.min(have, qty); if (n <= 0) return null;
    const em = S.emblem; const info = E.runeInfo(key);
    let gained = 0, xp = 0;
    for (let i = 0; i < n; i++) {
      const lines = Object.keys(em.stats);
      const canAdd = lines.includes(info.stat) || lines.length < E.emblemLines(em.lvl);
      if (canAdd) {
        const cap = E.emblemCap(info.stat, em.lvl); const cur = em.stats[info.stat] || 0;
        const add = Math.max(0, Math.min(info.pts, cap - cur));
        if (add > 0 || cur > 0) { em.stats[info.stat] = cur + add; gained += add; }
      }
      xp += info.weight; em.xp += info.weight;
      while (em.lvl < EMBLEM.maxLvl && em.xp >= E.emblemXpNeed(em.lvl)) {
        em.xp -= E.emblemXpNeed(em.lvl); em.lvl++;
        if (em.lvl % 50 === 0 || EMBLEM.ranks.some(([l]) => l === em.lvl)) note(S, `Emblème du Solitaire niveau ${em.lvl} (${E.emblemRank(em.lvl)})`, "up");
      }
    }
    S.runes[key] -= n; if (!S.runes[key]) delete S.runes[key];
    return { gained, xp, n };
  };
  E.removeEmblemLine = (S, stat) => { delete S.emblem.stats[stat]; };
  E.choosePerk = (S, tier, id) => {
    if (S.emblem.lvl < tier || S.emblem.perks[tier]) return false;
    S.emblem.perks[tier] = id; return true;
  };

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
    const before = { kamas: S.kamas, res: Object.assign({}, S.res), lvls: S.chars.map((c) => c.lvl), items: E.itemCount(S) };
    const hunting = S.hunting && S.sub && SUBS[S.sub] && E.team(S).length;
    const evLen = E.events.length;
    let wins = 0;
    const wasDungeon = S.dungeon; S.dungeon = null;
    const sub = SUBS[S.sub]; const teamSize = E.team(S).length;
    // part de l'absence couverte par le bonus d'XP
    const b = S.boosts && S.boosts.xp; const now = Date.now(); const startT = now - seconds * 1000;
    const covered = b ? clamp((b.until - startT) / (seconds * 1000), 0, 1) : 0;
    const xpBoost = b ? b.pct * covered : 0;
    for (let i = 0; hunting && i < fights; i++) {
      if (rnd() >= winRate) continue;
      wins++;
      const g = E.makeGroup(S, sub, teamSize);
      giveRewards(S, g, { xpBoost });
      E.emit(S, "win", { mons: g.map((m) => ({ key: m.base || m.key, boss: m.boss, archi: m.archi, lvl: m.lvl })), sub: S.sub, offline: true });
      S.progress.wins[S.sub] = (S.progress.wins[S.sub] || 0) + 1;
    }
    S.dungeon = wasDungeon;
    if (hunting) checkHunt(S, sub.monsters);
    gatherTick(S, eff, { quiet: true });
    E.events.length = evLen; // pas de pluie de notifications
    const res = {};
    for (const k in S.res) { const d = S.res[k] - (before.res[k] || 0); if (d > 0) res[k] = d; }
    return {
      seconds, fights: hunting ? fights : 0, wins, kamas: S.kamas - before.kamas, res,
      items: E.itemCount(S) - before.items,
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
