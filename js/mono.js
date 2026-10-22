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
  /* Saisons : 2 mois = 4 manches de 2 semaines, puis le héros part dans l'Éternel (avec ses kamas et ses objets, sans contenu
     de saison) et une nouvelle saison repart du niveau 1. « debut » est la date d'ouverture, la même pour tous ; tant qu'elle
     n'est pas fixée (avant l'ouverture), chaque partie compte sa saison depuis son propre départ. */
  M.saisons = { 1: { nom: "Saison 1", theme: "Les Fragments du Temps", debut: null } }; // avec les alignements, le Boss de saison et les classements (Mathis, 20/10)
  M.len = 56 * 86400000;
  E.monoSeasonDef = (s) => M.saisons[s] || { nom: `Saison ${s}`, debut: null };
  // la saison ouverte maintenant (null entre deux saisons)
  E.monoCurrent = () => { const now = E.now(); const L = Object.keys(M.saisons).map(Number).sort((a, b) => b - a);
    for (const s of L) { const d = M.saisons[s].debut; if (d == null || (now >= d && now < d + M.len)) return s; } return null; };
  E.monoT0 = (S) => { const d = S && S.mono && E.monoSeasonDef(S.mono.s).debut; return d != null ? d : (S && S.mono && S.mono.t0) || E.now(); };
  E.monoEnd = (S) => E.monoT0(S) + M.len;
  E.monoEternal = (S) => !!(S && S.mono && S.mono.eternel);
  E.monoOver = (S) => !!(S && S.mono && !S.mono.eternel && E.now() >= E.monoEnd(S));
  /* Petites règles de saison : la Maîtrise du temps et le Dofus de quête vont avec la partie, donc repartent à chaque saison
     (et restent dans l'Éternel) ; la réserve du Sablier commence à 3 h au lieu d'être pleine. */
  M.sabStart = 3 * 3600;
  E.monoStart = (S) => { const s = E.monoCurrent() || M.saison; S.mono = { s, t0: E.now() }; S.sablier = { r: M.sabStart, at: E.now(), spd: 1, open: false }; return S; };
  /* Fin de saison : les récompenses de pass et les coffres du Défi de la manche pas encore pris sont donnés, puis la partie
     passe dans l'Éternel. Renvoie ce qui a été donné (pour le message). */
  E.monoToEternal = (S) => {
    if (!S || !S.mono || S.mono.eternel) return null;
    const got = { pass: 0, chests: [] };
    try { if (E.bpClaimAll) got.pass = E.bpClaimAll(S); } catch (e) {}
    try { const B = E.bpState && E.bpState(S);
      if (B && B.md) Object.keys(B.md).forEach((m) => { const R = B.md[m]; const c = !R.got && E.mdChest && E.mdChest(R.best); if (c) { R.got = E.now(); E.addCons(S, c, 1); got.chests.push(c); } });
    } catch (e) {}
    if (S.dungeon && S.mono.merc && E.monoMercClear) try { E.monoMercClear(S); } catch (e) {}
    S.mono.eternel = { s: S.mono.s, at: E.now(), lvl: (S.chars[0] || {}).lvl || 1 };
    E.note(S, `La ${E.monoSeasonDef(S.mono.s).nom} est finie : ton héros rejoint l'Éternel.`, "rare");
    return got;
  };
  /* Ce que la nouvelle saison garde du compte : titres et apparences (ornements, cadres, ailes, palettes, aura). */
  /* 2.1.37.x : ornements et cadres (gift_o_, gift_f_) du Monocompte seulement (pass, saison : mono_, tf_) ; ceux des codes cadeaux
     du Classique ne passent pas d'une saison à l'autre */
  E.monoLegacyKey = (k) => /^(gift_[of]_(mono_|tf_)|wing_|teint_|tf_)/.test(k);
  E.monoLegacy = (S) => ({ t: (S.titlesExtra || []).slice(), u: Object.keys(S.unlocks || {}).filter((k) => E.monoLegacyKey(k)),
    aura: !!(S.chroma && S.chroma.shop && S.chroma.shop.aura) });
  E.monoLegacyMerge = (a, b) => ({ t: [...new Set([...(a && a.t) || [], ...(b && b.t) || []])], u: [...new Set([...(a && a.u) || [], ...(b && b.u) || []])], aura: !!((a && a.aura) || (b && b.aura)) });
  E.monoApplyLegacy = (S, L) => {
    if (!L) return 0; let n = 0; S.titlesExtra = S.titlesExtra || []; S.unlocks = S.unlocks || {};
    (L.t || []).forEach((t) => { if (!S.titlesExtra.includes(t)) { S.titlesExtra.push(t); n++; } });
    (L.u || []).forEach((k) => { if (/^gift_/.test(k) && !E.monoLegacyKey(k)) return; /* 2.1.37.x : codes cadeaux du Classique, même dans un ancien relevé */ if (!S.unlocks[k]) { S.unlocks[k] = 1; n++; } });
    if (L.aura && E.GIFT_X && E.GIFT_X.aura) { E.GIFT_X.aura.give(S); n++; }
    return n;
  };
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

  /* Séparation du Classique (Mathis, 22/10 : « 1A », rien du Classique, même en lecture) : LISTES BLANCHES. Ce qui n'est pas listé
     n'existe pas dans une partie Monocompte (ni l'Éternel) : page du menu, fonction du serveur, module Classique.
     tests/mono_separation.test.js échoue si un nouvel appel au serveur n'est rangé ni ici ni dans M.CLASSIC_RPC. */
  M.PAGES = new Set(["home", "havre", "combat", "world", "dungeons", "enc", "team", "heroes", "maitrise", "ren", "grav", "inv", "dofus", "pets",
    "chasse", "metiers", "forge", "hdv", "koli", "align", "quests", "succes", "carnet", "guide", "amis", "ladder", "sugg", "bug", "archis", "admin",
    "fragments", "boutique", "pass", "manche", "guerre", "eternel", "archives", "saisonlb", "mutation", "serment", "bilan", "bureau"]);
  E.monoPageOk = (k) => M.PAGES.has(k);
  /* fonctions du serveur permises dans une partie Monocompte ; hdv_* et trade_* passent renommées en mono_* (HdV de saison) */
  M.RPC = /^(mono_|amis_|couronne_temps$|chat_(send|report|me|mono_profil)$|cosm_mine$|bug_(send|mine)$|idea_send$|my_role$|staff_list$|ann_tick$|carnet_(send|admin)$|pseudo_(info|change)$|delete_my_account$|adm_(?!rain|hdv))/;
  M.FN = new Set(["mono"]); // fonctions du serveur (functions.invoke) : « record » est celle du Classique
  E.monoRpcOk = (name) => M.RPC.test(String(name || ""));
  /* modules du Classique éteints dans une partie Monocompte (window.X = null : leurs encarts, minuteurs et appels ne partent pas) */
  M.CLASSIC_MODS = ["GUILD", "CHASSE", "ALLY", "PLUIE", "WBUI", "SGUI", "ASCUI", "FOIREUI", "VENTEUI", "BUILDS", "GIGA", "CPTUI", "ELEVUI", "DGRANK"];

  /* dans le jeu (une partie par page) : la partie Monocompte limite l'équipe à 1 héros et les emplacements de Dofus à 3 */
  E.monoBoot = (S) => { if (!E.isMono(S)) return; E.HERO_MAX = 1; E.TEAM_MAX = 1; if (E.KOLI) E.KOLI.size = 1; /* Kolizéum en 1 contre 1 */ if (DOFUS_SLOTS.length > M.dofus) DOFUS_SLOTS.splice(M.dofus); };
  /* le héros unique : pas de recrutement */
  const recruit0 = E.recruit;
  E.recruit = function (S) { if (E.isMono(S)) return "Monocompte : un seul héros par saison."; return recruit0.apply(this, arguments); };
  /* 3 Dofus portés au plus */
  E.monoDofusSlots = (S) => (E.isMono(S) ? DOFUS_SLOTS.slice(0, M.dofus) : DOFUS_SLOTS);
  const equip0 = E.equip;
  E.equip = function (S, cid, uid, slot) {
    const it = E.isMono(S) && S.items[uid];
    if (it && it.merc && !quiet) { const c = S.chars.find((x) => x.id === cid); if (c && !c.merc) return "Cet objet appartient au mercenaire."; }
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
    Object.keys(S.items || {}).forEach((u) => { if (S.items[u].merc) delete S.items[u]; }); // même un objet du mercenaire déséquipé en route
    S.chars.forEach((c) => { if (!c.merc) Object.keys(c.equip || {}).forEach((sl) => { if (!S.items[c.equip[sl]]) delete c.equip[sl]; }); });
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
  /* onTick (facultatif, Bureau des Aventuriers : écran du combat regardé ensemble) : appelé après chaque seconde de combat, sans tirer au hasard.
     R.t : durée du combat en millisecondes de jeu. */
  E.monoGroupRun = (snaps, did, stasis, seed, onTick) => {
    const rng0 = E.getRng(); const evLen = E.events.length; E.setRng(mulberry(seed >>> 0));
    const tm = E.TEAM_MAX; E.TEAM_MAX = Math.max(tm, snaps.length); let S2, t = 0;
    try { const G = E.monoGroupSetup(snaps, did, stasis); if (G.err) return G; S2 = G.S2;
      while (S2.dungeon && t < 3 * 3600 * 1000) { E.tick(S2, 1000); t += 1000; if (onTick) onTick(S2, t); if (S2.fight && S2.fight.over && S2.fight.result === "lose") break; } }
    finally { E.setRng(rng0); E.events.length = evLen; E.TEAM_MAX = tm; }
    const R = S2.monoRun; R.win = R.done; R.players = snaps.filter((h) => !h.merc).length; R.t = t; return R;
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
      S.mono.grp = (S.mono.grp || 0) + 1; E.emit(S, "dungeon", { id: R.did, stasis: k, chals: [], down: 0, group: true, players: R.players || 1, ids: Array.isArray(R.ids) ? R.ids : undefined }); } // ids : les autres joueurs (défi 12, Bureau des Aventuriers)
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
  E.monoManche = (S) => Math.max(1, Math.floor((E.now() - E.monoT0(S)) / M.jobs.manche) + 1);
  E.monoSpecs = (S) => (S.mono && S.mono.spec) || [];
  const cap0 = E.jobCap;
  E.jobCap = (S, kind, job) => {
    if (!E.isMono(S)) return cap0(S, kind, job);
    if (kind === "f") return 200; // forgemagie : les 6 métiers jusqu'au niveau 200, hors spécialités (Mathis, 18/10)
    return E.monoSpecs(S).includes(job) ? 200 : M.jobs.cap;
  };
  E.monoCanSwap = (S) => !S.mono || !!S.mono.eternel || S.mono.specM !== E.monoManche(S); // Éternel : changement libre
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
  /* Kolizéum en 1 contre 1 (E.KOLI.size = 1 au démarrage d'une partie Monocompte) : réglage par classe, en % de PV et de dégâts,
     pour que chaque classe gagne à peu près un combat sur deux (tools/sweep_koli_mono.js). */
  /* tools/sweep_koli_mono.js du 19/10 (niveau 200, 19 classes, 20 fantômes par classe) : 46 à 53 % de victoires selon la classe, 34 à 61 %
     sur d'autres fantômes (l'équipement tiré compte beaucoup), contre 6 à 93 % sans réglage. À revoir avec les vrais combats du serveur. */
  M.koli = { cls: { iop: -29, cra: -17, eni: 10, feca: -26, osa: -21, enu: -1, sram: 53, xelor: 63, eca: -3, sadi: 4, sacri: -32, panda: -28, roub: 97, zobal: -37, steam: -6, elio: -15, hupper: 50, ougi: -30, forge: -19 } };
  const ks0 = E.koliSetup;
  E.koliSetup = function (A, B) {
    const S2 = ks0.apply(this, arguments);
    if (E.KOLI && E.KOLI.size === 1 && A && B && A.length === 1 && B.length === 1 && S2 && S2.fight) S2.fight.ents.forEach((e) => { if (e.summon) return;
      const k = M.koli.cls[e.cls] || 0; if (!k) return; e.hpMax = e.hp = e.hpBase = Math.round(e.hpBase * (1 + k / 100)); e.dmgBonus = (e.dmgBonus || 0) + k; });
    return S2;
  };
  // Sablier coupé en groupe en direct (S.mono.live, posé par le serveur Monocompte) : tout le groupe joue à la même vitesse
  const spend0 = E.sabSpend;
  E.sabSpend = function (S) { if (S && S.mono && S.mono.live) return 1; return spend0.apply(this, arguments); };
  E.gatherSpeed = function (S) { return gs0.apply(this, arguments) * (E.isMono(S) ? M.jobs.gather : 1); };
})(typeof window !== "undefined" ? window : globalThis);
