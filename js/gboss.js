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

  E.GBOSS_EVERY = 120;        // 1.0.33 (choix 1A de Mathis) : minutes pour un essai (1.0.30 : 25)
  E.GBOSS_EVERY_COR = 100;    // avec le Cor de ralliement (1 h 40)
  E.GBOSS_RESERVE = 12;       // essais gardés en réserve au plus (24 h : une visite par jour suffit)
  E.GBOSS_ROUNDS = 15;        // tours par essai
  E.GBOSS_HP_MULT = 1000;     // le boss ne tombe pas pendant un essai : on compte les dégâts
  E.GBOSS_PER_MEMBER = 15000; // 1.0.33 (2A) : vie totale du boss par membre actif (au moins 3 comptés)
  E.GBOSS_MIN_MEMBERS = 3;
  E.GBOSS_ACTIVE_DAYS = 14;   // membre actif : partie en ligne envoyée (ou arrivée dans la guilde) depuis moins de 14 jours
  E.GBOSS_PHASES = [8, 14, 20, 26, 32];                         // part de la vie totale de chaque phase (%)
  E.GBOSS_PHASE_K = [300000, 600000, 900000, 1200000, 1500000]; // kamas versés au coffre de guilde quand la phase tombe
  E.GBOSS_PHASE_NAMES = ["Éveillé", "Furieux", "Enragé", "Déchaîné", "Ultime"];
  E.GBOSS_PHASE_DMG = 8;      // +8 % de résistance du boss à chaque phase après la première : points ÷ (1 + 8 % par phase), soit ÷ 1,32 en phase 5 (≈ 300 points en phase 1, ≈ 230 en phase 5). Plus de dommages des monstres donnait plus de points à certaines équipes (renvoi, riposte).
  E.GBOSS_ULT = 10;           // 1.0.33 (3A) : après la phase 5, phases Ultimes sans fin de 10 % de la vie chacune (+8 % de résistance de plus à chaque fois)
  E.GBOSS_ULT_DUST = 30;      // Poussières de stasis par phase Ultime tombée, pour chaque membre qui a frappé
  E.GBOSS_STEPS = [25, 50, 75, 100]; // coffres des membres : phase p tombée = palier 25 × p (phases 1 à 4)
  E.GBOSS_CHEST_K = 4;        // 1.0.33 (4A) : kamas des coffres ×4
  E.GBOSS_CHEST_RES = 5;      // ressources du boss par coffre : 5 × numéro de la phase
  E.GBOSS_MIN_TRIES = 3;      // 1.0.33 (5A) : essais dans la semaine pour recevoir les coffres
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
  E.GBOSS_POW = /*GBOSS_POW*/{"akademie_gobs":0.53,"antichambre_gloursons":0.8,"antre_blop_multicolore":0.71,"antre_crocabulia":0.62,"antre_dragon_cochon":0.69,"antre_korriandre":0.57,"antre_reine_nyee":0.63,"aquadome_merkator":0.67,"arbre_moon":1.04,"arbre_mort":0.91,"atelier_tanukoui":0.56,"aurore_pourpre":1.34,"autel_dechireuse":0.63,"bambusaie_damadrya":0.62,"bastion_marteaux":0.59,"bateau_chouque":0.55,"belvedere_ilyzaelle":0.74,"biblio_corbac":0.72,"boyau_pere_ver":0.69,"brasserie_dazak":1.05,"breuil_venerable":0.78,"cache_kankreblath":0.61,"cale_arche_otomai":1.09,"camp_razof":1.08,"canopee_kimbo":1,"cave_toxoliath":0.66,"caverne_el_piko":0.69,"caverne_koulosse":0.63,"cavernes_kolosso":0.71,"chambre_malefices":0.71,"chambre_tal_kasha":0.71,"chapiteau_riktus":0.65,"chateau_ensable":0.64,"chateau_wa_wabbit":0.59,"cimetiere_mastodontes":0.7,"clairiere_chene_mou":0.73,"clos_blops":0.25,"cour_bouftou_royal":0.62,"croquanterie":0.54,"defi_chaloeil":0.67,"demeure_esprits":0.52,"dojo_vent":0.6,"domaine_ancestral":0.74,"donjon_bworks":0.75,"donjon_forgerons":0.5,"donjon_harebourg":0.57,"donjon_larves":0.55,"donjon_scarafeuilles":0.67,"donjon_squelettes":0.47,"donjon_tofus":0.56,"epave_grolandais":0.81,"epreuve_draegnerys":0.68,"excavation_mansot":0.79,"fabrique_foux":0.72,"fabrique_mallefisk":0.58,"fers_tyrannie":1.08,"fonderie_waddicts":0.67,"forgefroide_frizz":1.18,"galerie_phossile":0.68,"garde_manger_rat_blanc":0.53,"gelaxieme_dimension":0.41,"goulet_rasboul":1.1,"grange_tournesol":0.57,"grotte_bworker":0.71,"grotte_hesque":0.51,"grotte_kanigroula":0.62,"horologium_xlii":0.61,"hypogee_obsidiantre":0.61,"labo_brumen":0.64,"labo_nileza":0.68,"labo_tynril":0.45,"labyrinthe_minotoror":0.59,"maison_fantome":0.55,"manoir_katrepat":0.81,"megalithe_fraktale":0.64,"memoire_orukam":0.9,"miausolee_pounicheur":0.64,"mine_sakai":0.67,"nid_kwakwa":0.97,"oeil_vortex":0.97,"palais_dantinea":0.83,"palais_nidas":0.71,"pitons_craqueleur":0.51,"plateau_ush":0.66,"poste_supervizoeuf":0.66,"pyramide_ombre":0.53,"refuge_sylvestre":0.57,"repaire_kharnozor":0.57,"repaire_skeunk":0.76,"repaire_sphincter":1.04,"ring_ekarlatte":0.66,"rituel_kabahal":1.38,"salle_minotot":0.61,"salons_klime":0.8,"sanctuaire_torkelonia":0.71,"sentence_balance":0.89,"serre_royalmouth":0.78,"sousouriciere_rat_noir":0.64,"souvenir_imagiro":0.88,"taniere_givrefoux":0.63,"taniere_meulou":0.74,"tempete_eliocalypse":0.92,"temple_kao":0.69,"temple_koutoulou":1.12,"temple_ougah":0.62,"terrier_wa_wabbit":0.64,"tertre_long_sommeil":0.57,"theatre_dramak":0.52,"tofulailler_royal":0.72,"tombe_tofugawa":0.55,"tour_bethel":0.78,"tour_solar":0.72,"transporteur_sylargh":0.76,"trone_cour_sombre":0.73,"vaisseau_meno":0.9,"vallee_dame_eaux":0.56,"ventre_baleine":0.87,"village_kanniboul":0.54,"voliere_haute_truche":0.63}/*/GBOSS_POW*/;
  /* 1.0.33 : avec les mécaniques corrigées, 119 boss passent le réglage au lieu de 63. Les semaines d'avant E.GBOSS_POOL2_W gardent
     l'ancienne liste, pour que le boss de la semaine en cours ne change pas à la mise à jour (à régler sur la semaine qui suit la publication). */
  E.GBOSS_POOL2_W = 2964;
  E.GBOSS_POOL_OLD = ["antichambre_gloursons", "antre_blop_multicolore", "antre_crocabulia", "antre_dragon_cochon", "antre_korriandre", "arbre_moon", "atelier_tanukoui", "bateau_chouque", "belvedere_ilyzaelle", "biblio_corbac", "boyau_pere_ver", "cache_kankreblath", "camp_razof", "caverne_el_piko", "caverne_koulosse", "cavernes_kolosso", "chapiteau_riktus", "chateau_ensable", "clairiere_chene_mou", "clos_blops", "cour_bouftou_royal", "croquanterie", "domaine_ancestral", "donjon_bworks", "donjon_harebourg", "donjon_scarafeuilles", "donjon_squelettes", "donjon_tofus", "epave_grolandais", "fabrique_foux", "forgefroide_frizz", "galerie_phossile", "grange_tournesol", "grotte_bworker", "grotte_kanigroula", "horologium_xlii", "hypogee_obsidiantre", "labo_brumen", "labo_nileza", "labo_tynril", "labyrinthe_minotoror", "megalithe_fraktale", "mine_sakai", "nid_kwakwa", "oeil_vortex", "palais_nidas", "pitons_craqueleur", "pyramide_ombre", "repaire_kharnozor", "repaire_skeunk", "repaire_sphincter", "salle_minotot", "serre_royalmouth", "taniere_givrefoux", "taniere_meulou", "temple_ougah", "terrier_wa_wabbit", "tertre_long_sommeil", "tofulailler_royal", "tombe_tofugawa", "transporteur_sylargh", "vallee_dame_eaux", "voliere_haute_truche"];
  const pool = (w) => (w < E.GBOSS_POOL2_W ? E.GBOSS_POOL_OLD : Object.keys(E.GBOSS_POW)).filter((id) => DUNGEONS[id]).sort();
  E.gboss = (w = E.gbossWeek()) => {
    const P = pool(w); const did = P[hash(`idlus|gboss|${w}`) % P.length]; const dg = DUNGEONS[did];
    return { w, did, boss: dg.boss, name: MONSTERS[dg.boss].name, dname: dg.name, pow: E.GBOSS_POW[did] || 1, res: E.gbossRes ? E.gbossRes({ boss: dg.boss }) : null };
  };
  E.gbossGoal = (members) => E.GBOSS_PER_MEMBER * Math.max(E.GBOSS_MIN_MEMBERS, members || 0);
  /* 1.0.30 : seuils cumulés des 5 phases (8, 22, 42, 68 et 100 % de la vie totale), même calcul que gb_thr (supabase/gboss.sql) */
  E.gbossThr = (goal) => { let c = 0; return E.GBOSS_PHASES.map((p) => { c += p; return Math.floor((goal * c) / 100); }); };
  /* où en est le boss : p = phase en cours (1 à 5, 6 s'il est vaincu), done = phases tombées, cur / need = points dans la phase en cours */
  E.gbossPhase = (pts, goal) => {
    const T = E.gbossThr(goal); let i = 0; while (i < T.length && pts >= T[i]) i++;
    if (i >= T.length) { // 1.0.33 : phases Ultimes (6, 7, 8…) de 10 % de la vie chacune, même calcul que gb_nph
      const need = Math.max(1, Math.floor((goal * E.GBOSS_ULT) / 100)); const over = Math.max(0, pts - T[T.length - 1]); const u = Math.floor(over / need);
      return { p: T.length + 1 + u, done: T.length + u, ult: u + 1, cur: over - u * need, need, T };
    }
    const lo = i ? T[i - 1] : 0; return { p: i + 1, done: i, cur: Math.max(0, pts - lo), need: T[i] - lo, T };
  };
  /* résistance du boss à la phase p (×1, ×1,08, ×1,16… ×1,32 en phase 5, puis +8 % par phase Ultime) : les points de l'essai sont divisés par ce nombre */
  E.gbossDmg = (p) => 1 + (E.GBOSS_PHASE_DMG * Math.max(0, (p || 1) - 1)) / 100;
  /* nom d'une phase : « Éveillé »… « Ultime », puis « Ultime 1 », « Ultime 2 »… */
  E.gbossPhaseName = (p) => (p <= 5 ? E.GBOSS_PHASE_NAMES[Math.max(0, p - 1)] : `Ultime ${p - 5}`);
  /* essais en réserve : t essais au moment at, +1 toutes les « every » minutes, E.GBOSS_RESERVE au plus (même calcul que gb_tok) */
  E.gbossTok = (t, at, now, every) => Math.min(E.GBOSS_RESERVE, (+t || 0) + Math.max(0, now - at) / ((every || E.GBOSS_EVERY) * 60000));
  /* temps avant le prochain essai (0 si la réserve est pleine) */
  E.gbossNextIn = (tok, every) => (tok >= E.GBOSS_RESERVE ? 0 : Math.ceil((1 - (tok % 1)) * (every || E.GBOSS_EVERY) * 60000));

  /* Un essai. n = numéro de l'essai de la semaine (0, 1, 2…) : il fixe le hasard. phase (1.0.30) : phase du boss, de plus en plus dure (E.gbossDmg).
     1.0.33 (choix 6B de Mathis) : découpé en E.gbossWatch (préparer), E.gbossWatchStep (un pas) et E.gbossResult, pour « Revoir le combat » :
     le même essai est rejoué pas à pas avec le même hasard. Les mécaniques du boss (totems, âme liée, bombes, soins en %) se calculent
     sur ses PV normaux (hpRef, js/engine.js) : avant, ses PV ×1 000 rendaient certains essais nuls. */
  E.gbossWatch = (S, def, n, now = E.now(), phase = 1) => {
    const S2 = JSON.parse(E.serialize(S));
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.hunting = false; S2.protector = null; S2.manualLive = false;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu;
    S2.idols = Object.assign({}, S2.idols, { active: [] }); // pas d'idoles : le même boss pour tous
    const dg = DUNGEONS[def.did]; const team = E.team(S2);
    if (!team.length || !dg) return { err: "Il faut au moins un héros dans l'équipe." };
    const W = { def, n, phase, now, S2, rng: mulberry(hash(`idlus|gboss|${def.w}|${n}`)), done: false, dm: E.gbossDmg(phase) };
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    try {
      E.setRng(W.rng); E.setClock(() => now);
      S2.dungeon = { id: def.did, room: dg.rooms.length, stasis: 4, chain: 1, t: 0, syncLvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length), mods: [], eliteRoom: -1, gboss: true };
      const F = E.startFight(S2); if (!F) return { err: "Combat impossible." };
      const B = F.ents[F.bossIdx]; if (!B) return { err: "Boss introuvable." };
      W.base = B.hpMax; B.hpRef = W.base; B.hpMax = B.hp = W.base * E.GBOSS_HP_MULT; if (B.shield) B.shield = 0;
      F.label = `Boss de guilde · ${MONSTERS[def.boss] ? MONSTERS[def.boss].name : def.name}`; F.gboss = true;
      W.F = F; W.B = B;
      return W;
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  E.gbossWatchStep = (W) => {
    if (W.done) return "end";
    const F = W.F; const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    try {
      E.setRng(W.rng); E.setClock(() => W.now);
      E.step(W.S2);
      if (F.over || F.round > E.GBOSS_ROUNDS) { W.done = true; return "end"; }
      return "step";
    } finally { E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  /* points de l'essai (aussi pendant qu'on le regarde), dégâts de chaque héros et mécaniques du boss (rapport d'essai, 6A) */
  E.gbossPts = (W) => { const B = W.B; const dmg = Math.max(0, B.hpMax - Math.max(0, B.hp)); return Math.round(((dmg / W.base) * 100 * (W.def.pow || 1)) / W.dm); };
  E.gbossResult = (W) => {
    const F = W.F, B = W.B; const dmg = Math.max(0, B.hpMax - Math.max(0, B.hp));
    const alive = F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length;
    const heroes = E.fightStats(F).map((x) => ({ n: x.n, d: x.d }));
    const mech = (B.mech || []).map((k) => (E.BOSS_MECHS && E.BOSS_MECHS[k] ? E.BOSS_MECHS[k].name : k));
    return { points: E.gbossPts(W), raw: Math.round((dmg / W.base) * 100), dmg: Math.round(dmg), rounds: Math.min(F.round, E.GBOSS_ROUNDS), alive, heroes, mech };
  };
  /* Un essai joué d'un coup (le serveur le rejoue avec la partie en ligne). Renvoie { points, raw, dmg, rounds, alive, heroes, mech } ou { err }. */
  E.gbossSim = (S, def, n, now = E.now(), phase = 1) => {
    const W = E.gbossWatch(S, def, n, now, phase); if (W.err) return W;
    for (let g = 0; g < 200000 && !W.done; g++) E.gbossWatchStep(W);
    return E.gbossResult(W);
  };

  /* Coffre d'un palier : kamas et poussière de stasis, selon le niveau du meilleur héros (même calcul dans supabase/gboss.sql). */
  E.GBOSS_CHEST_NAMES = { 25: "Coffre de l'assaut", 50: "Coffre de la brèche", 75: "Coffre du siège", 100: "Coffre de la victoire" }; // 0.1.30
  /* 1.0.33 (4A) : kamas ×4, et 5 × la phase en ressources du boss (E.gbossRes) ; même calcul dans supabase/gboss.sql (gb_chest) */
  E.gbossChest = (step, lvl) => { const i = E.GBOSS_STEPS.indexOf(step) + 1; return { k: Math.round((1000 + lvl * 250) * i * E.GBOSS_CHEST_K), dust: 15 * i, res: E.GBOSS_CHEST_RES * i }; };
  E.GBOSS_EQ_CHEST = "Coffre du trophée"; // phase 5 : un équipement du donjon du boss
  /* ressource du boss pour les coffres : sa ressource propre la plus rare (entre 5 et 50 % de chances), sinon la plus rare qu'il donne */
  E.gbossRes = (def) => {
    const M = MONSTERS[def.boss] || {}; const items = new Set(Object.values(D.ITEMS || {}).map((t) => t.name));
    const ok = (M.drops || []).filter(([nm, c]) => c > 0 && !items.has(nm) && !/dofus|bo[iî]te|barre|bouloute|sachet|bidoche|minowang|lagon|muldo|oueille|pollenectar|cœur|clef|image|défaite|âmes|zinuzide|écho|koinkoin|fiole/i.test(nm));
    const word = (M.name || "").split(" ").pop().toLowerCase(); const own = ok.filter(([nm]) => word.length > 2 && nm.toLowerCase().includes(word));
    const by = (L) => L.filter(([, c]) => c >= 5 && c <= 50).sort((a, b) => a[1] - b[1])[0] || L.slice().sort((a, b) => a[1] - b[1])[0];
    const pick = by(own) || by(ok);
    return pick ? pick[0] : "Poussière de stasis";
  };

  /* équipements du donjon du boss pour le Coffre du trophée (phase 5) : ses objets et ceux de ses monstres, avec les fourchettes de jets (le serveur tire le jet) */
  E.gbossEq = (def) => {
    const dg = DUNGEONS[def.did]; if (!dg) return [];
    const mobs = new Set([def.boss]); (dg.rooms || []).forEach((r) => (r.mobs || []).forEach((m) => mobs.add(m)));
    const seen = {}; mobs.forEach((id) => ((MONSTERS[id] && MONSTERS[id].items) || []).forEach(([tpl]) => { const T = D.ITEMS && D.ITEMS[tpl]; if (T && T.slot !== "dofus" && !T.noDrop && T.stats) seen[tpl] = 1; }));
    return Object.keys(seen).sort().slice(0, 12).map((tpl) => ({ tpl, s: D.ITEMS[tpl].stats }));
  };

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
    E.team(S).forEach((c) => { if (c.lvl >= E.MAX_LVL) return; const g = Math.round(E.heroXpNeed(c, Math.min(c.lvl, (zl || c.lvl) + 10)) * Math.min(0.2, txp)); if (g > 0) { E.giveXp(S, c, g); tot += g; } });
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
    { k: "cor", name: "Cor de ralliement", ic: "trophee", lvl: 20, cost: 20000000, d: "Boss de guilde : un essai toutes les 1 h 40 au lieu de 2 h." },
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
  /* « Chasse aux Percepteurs » (choix 1C, 2C et 6A à 10A de Mathis), serveur dans supabase/gboss.sql :
     - Vétérans (8A) : un Percepteur gagne une étoile par attaque de guilde repoussée (5 au plus) ; chacune donne
       +2 % de PV et de dommages à lui et à ses gardes ; il les perd s'il est pillé. Il porte un nom (E.percoNick).
     - Revanche (6A) : une guilde pillée a 6 h pour attaquer un Percepteur de la guilde pilleuse, une fois par membre,
       sans utiliser ses attaques du jour, avec +25 % de butin.
     - Primes (7A) : le Meneur ou un Bras droit met une prime sur un Percepteur ennemi (50 000 à 2 000 000 kamas, payés
       par le coffre) ; celui qui le pille la touche, sinon elle revient au coffre au bout de 3 jours.
     - Domination (9A) : la guilde qui a le plus de Percepteurs dans une région (zone de la carte, donjons compris) la
       domine ; ses membres y gagnent +5 % de kamas et de butin (sous les plafonds du jeu).
     - Nuit des Percepteurs (10A) : chaque samedi de 20 h à 23 h (Paris), butin ×1,5, boucliers des Percepteurs réduits
       de moitié, une attaque de plus pour chacun ; titre « Ombre de la nuit » pour la guilde qui pille le plus. */
  E.HUNT = { star: 0.02, stars: 5, revenge: 6, revengeLoot: 25, bountyMin: 50000, bountyMax: 2000000, bountyDays: 3, dom: 5, nightDay: 6, nightFrom: 20, nightTo: 23, nightLoot: 1.5, nightTitle: "Ombre de la nuit" };
  const NICK_A = ["Ush", "Krou", "Gwen", "Ebe", "Dark", "Lou", "Ot", "Rol", "Mak", "Bwak", "Kal", "Sim", "Ar", "Ny", "Mo", "Ga", "Tor", "Fen", "Zil", "Pou"];
  const NICK_B = ["Galesh", "Tinto", "Mazzo", "Ruby", "Drak", "Plof", "Zinzin", "Boufo", "Kawa", "Tork", "Lifa", "Pandor", "Krokro", "Grillos", "Waba", "Zoth", "Mulou", "Picor", "Blop", "Sadoul"];
  /* nom d'un Percepteur (le même pour tous : tiré de son numéro) */
  E.percoNick = (id) => { const n = hash(`idlus|perco|${Math.floor(+id || 0)}`) >>> 0; return `${NICK_A[n % NICK_A.length]} ${NICK_B[Math.floor(n / NICK_A.length) % NICK_B.length]}`; };
  /* Nuit des Percepteurs : en cours à l'instant t (heure de Paris) ; next = début de la prochaine (ms) */
  const parisParts = (t) => { const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t)); const o = {}; f.forEach((p) => { o[p.type] = p.value; }); return { wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(o.weekday) + 1, h: +o.hour, m: +o.minute }; };
  E.huntNight = (t) => { const p = parisParts(t == null ? E.now() : t); return p.wd === E.HUNT.nightDay && p.h >= E.HUNT.nightFrom && p.h < E.HUNT.nightTo; };
  /* temps avant le début (ou la fin, si elle est en cours) de la Nuit des Percepteurs, en ms, à la minute près */
  E.huntNightLeft = (t) => { t = t == null ? E.now() : t; const p = parisParts(t); const cur = ((p.wd - 1) * 24 + p.h) * 60 + p.m;
    const st = ((E.HUNT.nightDay - 1) * 24 + E.HUNT.nightFrom) * 60, en = ((E.HUNT.nightDay - 1) * 24 + E.HUNT.nightTo) * 60;
    if (cur >= st && cur < en) return { on: true, ms: (en - cur) * 60000 };
    return { on: false, ms: (((st - cur) % 10080 + 10080) % 10080) * 60000 }; };
  /* Domination (9A) : pour une liste de Percepteurs [{ sid, gid }], la guilde qui domine chaque région (zone de la carte) ;
     égalité en tête : « disputé » (gid null). Renvoie { zoneId: { gid, n, tot, tie } }. */
  E.huntRegion = (sid) => { const sub = E.SUBS && E.SUBS[sid]; if (sub) return sub.zone; const acc = E.DUNGEON_SUB && E.DUNGEON_SUB[sid]; return acc && E.SUBS[acc] ? E.SUBS[acc].zone : null; };
  E.huntDomination = (L) => { const by = {}; (L || []).forEach((p) => { const z = E.huntRegion(p.sid); if (!z) return; const c = (by[z] = by[z] || {}); c[p.gid] = (c[p.gid] || 0) + 1; });
    const out = {}; for (const z in by) { const e = Object.entries(by[z]).sort((a, b) => b[1] - a[1]); const tot = e.reduce((a, x) => a + x[1], 0);
      out[z] = { gid: e[1] && e[1][1] === e[0][1] ? null : +e[0][0], n: e[0][1], tot, tie: !!(e[1] && e[1][1] === e[0][1]) }; }
    return out; };
  E.WAR_TITLE = "Conquérant";
  /* part de la poche pillée (0,5 ; 0,25 ; divisée par 2 si la guilde visée a 10 niveaux de moins) */
  E.raidPart = (attLvl, defLvl, coffreFort) => ((coffreFort ? E.RAID.lootFort : E.RAID.loot) / 100) * ((defLvl || 1) <= (attLvl || 1) - E.RAID.gap ? 0.5 : 1);
  E.raidLoot = (gain, part) => { const res = {}; for (const k in (gain && gain.res) || {}) { const q = Math.floor(gain.res[k] * part); if (q >= 1) res[k] = q; } return { k: Math.floor(((gain && gain.k) || 0) * part), res }; };
  E.raidSeed = (rid, who) => hash(`idlus|raid|${rid}|${who}`);
  /* Le Percepteur et ses gardes : une équipe de Fantômes d'arène (js/koli.js) au niveau de la zone ou de l'attaquant
     (le plus haut), +20 % de PV et de dommages, et +3 % par rang de Robustesse. Calibré par simulation : une bonne
     équipe d'arène gagne environ 8 fois sur 10 sans Robustesse, environ 1 fois sur 2 contre la Robustesse 10. */
  E.percoGuards = (seed, lvl, rob, stars) => {
    const T = E.koliGhost(seed >>> 0, Math.max(1, Math.min(200, Math.round(lvl || 1))));
    const m = E.RAID.base + E.RAID.rob * Math.max(0, Math.min(10, rob || 0)) + E.HUNT.star * Math.max(0, Math.min(E.HUNT.stars, stars || 0));
    return T.map((h, i) => { const st = Object.assign({}, h.st); st.hpMax = Math.round(st.hpMax * (1 + m)); st.dsort = (st.dsort || 0) + m * 100;
      return Object.assign({}, h, { n: i ? "Garde du Percepteur" : "Percepteur", st }); });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
