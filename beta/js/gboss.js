/* ============================================================================
   BOSS DE GUILDE ET PERCEPTEURS — Idlus (multijoueur, étape 5)
   Chaque semaine (lundi, heure de Paris), un boss de donjon différent pour toutes les guildes.
   Chaque membre a 3 essais par jour : son équipe affronte le boss (niveau calé sur l'équipe,
   PV démultipliés) pendant 15 tours, et les dégâts infligés comptent en « points » (100 points =
   les PV normaux du boss). Les points de la guilde remplissent une jauge commune ; des coffres
   s'ouvrent à 25, 50, 75 et 100 %. Le combat est joué d'un coup par le vrai moteur sur une copie
   de la partie, avec un hasard tiré de la semaine et du numéro d'essai : le serveur le rejoue.
   Pas de DOM ici : l'interface est dans js/guilds.js. Chargé aussi par le serveur (tools/build_server.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { DUNGEONS, MONSTERS } = D;

  E.GBOSS_TRIES = 3;          // essais par jour et par membre
  E.GBOSS_ROUNDS = 15;        // tours par essai
  E.GBOSS_HP_MULT = 1000;     // le boss ne tombe pas : on compte les dégâts
  E.GBOSS_PER_MEMBER = 2500;  // points à réunir par membre (au moins 5 membres comptés) pour 100 %
  E.GBOSS_STEPS = [25, 50, 75, 100];
  E.GBOSS_TITLE = "Pourfendeur de boss"; // titre gardé par les membres des 3 meilleures guildes de la semaine

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
  E.gbossGoal = (members) => E.GBOSS_PER_MEMBER * Math.max(5, members || 0);

  /* Un essai, joué d'un coup. n = numéro de l'essai de la semaine (0, 1, 2…) : il fixe le hasard.
     Renvoie { points, dmg, rounds, alive } ou { err }. */
  E.gbossSim = (S, def, n, now = E.now()) => {
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
      for (let g = 0; g < 200000 && !F.over && F.round <= E.GBOSS_ROUNDS; g++) E.step(S2);
      const dmg = Math.max(0, B.hpMax - Math.max(0, B.hp));
      const alive = F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length;
      const raw = (dmg / base) * 100;
      return { points: Math.round(raw * (def.pow || 1)), raw: Math.round(raw), dmg: Math.round(dmg), rounds: Math.min(F.round, E.GBOSS_ROUNDS), alive };
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };

  /* Coffre d'un palier : kamas et poussière de stasis, selon le niveau du meilleur héros (même calcul dans supabase/gboss.sql). */
  E.gbossChest = (step, lvl) => { const i = E.GBOSS_STEPS.indexOf(step) + 1; return { k: Math.round((1000 + lvl * 250) * i), dust: 15 * i }; };

  /* ============================================================================
     PERCEPTEURS (version 2 « La guilde défend ensemble »)
     Posé dans une zone finie (tous ses monstres au palier Traqueur) par le Meneur ou un Bras droit,
     qui paie 20 000 kamas. Il ramasse 5 % des kamas et ressources qu'une équipe y gagnerait : sa poche
     est pleine en 12 h. Environ une fois par jour, des monstres l'attaquent : pendant 2 h, chaque membre
     peut tenter une défense avec son équipe (une par attaque), rejouée par le serveur.
     Victoire : poche +25 %, XP de guilde, petit coffre pour le défenseur. Sans victoire : la moitié de la poche est perdue.
     ========================================================================== */
  E.PERCO_PRICE = 20000;
  E.PERCO_FILL_H = 12;
  E.PERCO_RATE = 5; // 0.1.24.2 : 5 % (3 % au départ)
  E.PERCO_ATK_H = 2;
  E.percoSlots = (glvl) => Math.min(5, Math.floor((glvl || 1) / 5));
  E.percoNextSlot = (glvl) => (E.percoSlots(glvl) >= 5 ? null : (E.percoSlots(glvl) + 1) * 5);
  const SUBS = () => E.SUBS || D.SUBS;
  const subLvl = (sub) => Math.round((sub.lvl[0] + sub.lvl[1]) / 2);
  /* contenu d'une poche pleine : E.PERCO_RATE % de 12 h de chasse (≈ 2 900 kamas par niveau de zone et par heure, ≈ 250 monstres par heure pour les ressources) */
  E.percoCap = (sid) => {
    const sub = SUBS()[sid]; if (!sub) return null;
    const L = subLvl(sub), res = {};
    sub.monsters.forEach((id) => { const m = MONSTERS[id]; (m && m.drops || []).forEach(([name, ch]) => { res[name] = (res[name] || 0) + (30 * E.PERCO_RATE / sub.monsters.length) * Math.min(100, ch) / 100 * 2; }); });
    const top = Object.keys(res).map((k) => [k, Math.round(res[k])]).filter((x) => x[1] >= 1).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { k: Math.round(1000 * L * E.PERCO_RATE / 3), res: Object.fromEntries(top) };
  };
  /* zones où un Percepteur peut se poser pour cette partie (trophée de sous-zone = zone finie) */
  E.percoZones = (S) => Object.keys(SUBS()).filter((sid) => S.trophies && S.trophies[sid] && SUBS()[sid].monsters && SUBS()[sid].monsters.length);
  E.percoAttackers = (sid) => { const sub = SUBS()[sid]; return sub ? sub.monsters.filter((id) => MONSTERS[id]) : []; };

  /* Une défense, jouée d'un coup. n = défenseurs déjà battus pendant cette attaque (+1 monstre chacun),
     seed = hasard choisi par le serveur (le même pour un joueur et une attaque). Renvoie { win, rounds, alive } ou { err }. */
  const mg = E.makeGroup;
  E.makeGroup = (S, sub, size) => {
    if (!S.percoAtk) return mg(S, sub, size);
    const A = S.percoAtk, ids = E.percoAttackers(sub.id), lvl = Math.max(sub.lvl[1], A.lvl) + 5, g = [];
    const n = Math.min(8, size + 2 + A.n);
    for (let i = 0; i < n; i++) g.push(E.monsterEntity(ids[Math.floor(E.rnd() * ids.length)], lvl));
    return g;
  };
  E.percoSim = (S, sid, n, seed, now = E.now()) => {
    const S2 = JSON.parse(E.serialize(S)); const sub = SUBS()[sid];
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.dungeon = null; S2.protector = null; S2.manualLive = false;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu;
    S2.idols = Object.assign({}, S2.idols, { active: [] });
    const team = E.team(S2);
    if (!team.length || !sub) return { err: "Il faut au moins un héros dans l'équipe." };
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    try {
      E.setRng(mulberry(seed >>> 0)); E.setClock(() => now);
      S2.sub = sid; S2.hunting = true; S2.percoAtk = { n: n || 0, lvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length) };
      const F = E.startFight(S2); if (!F) return { err: "Combat impossible." };
      for (let g = 0; g < 200000 && !F.over && F.round <= 60; g++) E.step(S2);
      const alive = F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length;
      return { win: F.over && F.result === "win", rounds: F.round, alive, foes: F.ents.filter((e) => e.side === "m" && !e.summon).length };
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  E.percoSeed = (aid, uid) => hash(`idlus|perco|${aid}|${uid}`);
  /* coffre du défenseur victorieux */
  E.percoChest = (lvl) => ({ k: 300 * lvl, dust: 10 });

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
