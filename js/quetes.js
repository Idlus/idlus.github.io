/* ============================================================================
   QUÊTES, SUCCÈS ET CHASSES — Idlus 0.1.50
   - Quête principale : 4 chapitres de plus jusqu'au niveau 200 (le chapitre 1 « L'éveil » ne change pas).
   - Quêtes de région : une histoire de 5 à 7 étapes dans chacune des régions, donnée par un personnage de DOFUS.
     Au bout : kamas, Coffre en argent, titre « l'Ami de … » et l'emblème de la région (ornement).
   - Quêtes de la semaine : 3 quêtes à ton niveau chaque lundi, un Coffre en or et 3 parchemins de chasse.
   - Avis : rang de chasseur (+10 % aux primes par rang), avis de boss, avis d'élite de la semaine.
   - Succès : ~310 de plus (régions, classes, stasis 10, Kolizéum, économie, chasses, collection, secrets),
     points de succès et 6 paliers de récompenses.
   Pas de DOM ici : l'interface est dans questui.js.
   État dans la sauvegarde : S.rq (régions), S.wk (semaine), S.belite (avis d'élite), S.achPal, S.qsx (secrets).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { MONSTERS, DUNGEONS, CLASSES, ZONES, ITEMS, SETS } = D;
  const SUBS = E.SUBS;
  const rnd = () => E.rnd();
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const topLvl = (S) => Math.max(1, ...S.chars.map((c) => c.lvl));
  const fmtK = (n) => Math.round(n).toLocaleString("fr-FR");
  const dayOf = (t = E.now()) => (E.defiDay ? E.defiDay(t) : Math.floor(t / 86400000));
  E.weekOf = (t = E.now()) => Math.floor((dayOf(t) + 3) / 7); // semaines du lundi au dimanche
  E.weekLeft = (t = E.now()) => { const d = dayOf(t); const end = (E.weekOf(t) + 1) * 7 - 3; return Math.max(0, (end - d - 1) * 86400000 + (E.defiLeft ? E.defiLeft(t) : 0)); };
  const giveXp = (S, pctOfLevel) => { const list = E.team(S).length ? E.team(S) : S.chars; list.forEach((c) => E.giveXp(S, c, Math.round(E.xpNeed(c.lvl) * pctOfLevel))); };
  const addTitle = (S, t) => { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); };
  const stasisMax = (S, did) => ((S.stasis || {})[did] || {}).max || 0;
  const zoneOfSub = {}; ZONES.forEach((z) => z.subs.forEach((s) => (zoneOfSub[s.id] = z.id)));

  /* ======================= QUÊTE PRINCIPALE : CHAPITRES ======================= */
  E.MAIN_CH1 = 22; // étapes du chapitre 1 (la fin du chapitre 1 garde le titre et l'ornement « Héros d'Amakna »)
  const K = (sub, n, title, txt) => ({ title, txt: txt || `Chassez dans ${SUBS[sub] ? SUBS[sub].name : sub}.`, t: "kill", sub, n });
  const B = (dg, title, txt) => ({ title, txt: txt || `Vainquez ${MONSTERS[DUNGEONS[dg].boss].name} (${DUNGEONS[dg].name}).`, t: "boss", dg });
  const L = (n, title) => ({ title: title || `Niveau ${n}`, txt: `Atteignez le niveau ${n}.`, t: "lvl", n });
  const CH = [
    { name: "Les terres sauvages", where: "Wabbits, Moon, Koalaks, Otomaï", lvl: [50, 100], title: "Aventurier des terres sauvages", steps: [
      K("wab_cawotte", 40, "L'île des Wabbits", "Chassez dans les champs de Cawottes de l'île des Wabbits."), B("chateau_wa_wabbit", "Le Wa Wabbit"),
      K("moon_masques", 40, "Les masques de Moon"), B("village_kanniboul", "Les Kanniboul"), L(60),
      K("koa_kaliptus", 50, "Les forêts de Kaliptus"), K("sid_desolation", 50, "Les landes désolées"), B("labo_brumen", "Le laboratoire de Brumen"),
      K("oto_arche", 50, "L'arche d'Otomaï"), B("cale_arche_otomai", "Gourlo le Terrible"), L(75),
      K("abr_sombre", 60, "La sombre forêt"), B("antre_reine_nyee", "La Reine Nyée"), K("fri_port", 60, "Le port de Frigost"),
      B("chapiteau_riktus", "Le chapiteau des Riktus"), B("domaine_ancestral", "L'Abraknyde Ancestral"), B("arbre_moon", "L'arbre de Moon"), L(100, "Niveau 100") ] },
    { name: "Les îles lointaines", where: "Pandala, Minotoror, Frigost", lvl: [100, 150], title: "Voyageur des îles", steps: [
      K("pan_plantala", 60, "L'île de Pandala"), B("bambusaie_damadrya", "Damadrya"), K("mino_ile", 60, "L'île du Minotoror"), B("labyrinthe_minotoror", "Le labyrinthe"),
      K("fri_champs", 60, "Les champs de glace"), B("serre_royalmouth", "Le Royalmouth"), L(120), K("oto_zoths", 70, "Le village des Zoths"), B("goulet_rasboul", "Le Rasboul"),
      K("pan_feudala", 70, "Feudala"), B("atelier_tanukoui", "Tanukouï San"), B("vallee_dame_eaux", "La Dame des eaux"), K("fri_pins", 70, "La forêt des pins perdus"),
      B("excavation_mansot", "Le Mansot Royal"), B("labo_tynril", "Le laboratoire du Tynril"), L(140), K("fri_berceau", 80, "Le berceau d'Alma"), B("epave_grolandais", "Le Grolandais violent"), L(150) ] },
    { name: "Le grand froid", where: "Frigost, Grobe, Saharach, Sakaï", lvl: [150, 190], title: "Cœur de givre", steps: [
      K("fri_larmes", 80, "Les larmes d'Ouronigride"), B("hypogee_obsidiantre", "L'Obsidiantre"), K("grobe_cimetiere", 80, "L'île de Grobe"), B("tombe_tofugawa", "Le Shogun Tofugawa"), L(160),
      K("fri_village", 80, "Le village enseveli"), B("taniere_givrefoux", "Les Givrefoux"), K("sah_gorge", 80, "Les gorges de Saharach"), B("boyau_pere_ver", "Le Père Ver"),
      K("xel_present", 80, "Le Xélorium"), B("horologium_xlii", "XLII"), L(175), K("fri_petrifiee", 90, "La forêt pétrifiée"), B("antre_korriandre", "Le Korriandre"),
      K("sak_plaine", 90, "L'île de Sakaï"), B("mine_sakai", "La mine de Sakaï"), B("cavernes_kolosso", "Le Kolosso"), L(190) ] },
    { name: "Les Dimensions divines", where: "Harebourg, Sufokia, Dimensions", lvl: [190, 200], title: "Héros du Krosmoz", steps: [
      K("obs_dimension", 90, "La Dimension Obscure"), B("pyramide_ombre", "La Pyramide d'Ombre"), L(200, "Niveau 200"), K("har_jardins", 100, "Le domaine d'Harebourg"),
      B("labo_nileza", "Nileza"), B("donjon_harebourg", "Le Comte Harebourg"), K("suf_embruns", 100, "La baie de Sufokia"), B("aquadome_merkator", "Merkator"),
      K("enu_retraite", 100, "Enutrosor"), B("palais_nidas", "Le roi Nidas"), K("eca_temple", 100, "Écaflipus"), B("defi_chaloeil", "Le Chalœil"),
      K("cav_corrompu", 100, "Les Cavaliers"), B("arbre_mort", "Corruption"), B("trone_sang", "Guerre"), B("tempete_eliocalypse", "La Tempête de l'Eliocalypse", "Vainquez aussi Servitude (Fers de la Tyrannie) et Misère (Sentence de la Balance), puis la Tempête de l'Eliocalypse.") ] },
  ];
  const Q = E.MAIN_QUEST; const QX = E.QUEST_EXTRA || {};
  E.QUEST_CHAPTERS = [{ name: "L'éveil", where: "Incarnam, Astrub, Amakna, Cania", lvl: [1, 50], start: 0, end: E.MAIN_CH1, title: "Héros d'Amakna" }];
  if (Q && Q.length === E.MAIN_CH1) {
    CH.forEach((ch) => {
      const steps = ch.steps.filter((q) => (q.t !== "kill" || SUBS[q.sub]) && (q.t !== "boss" || DUNGEONS[q.dg]));
      const start = Q.length;
      steps.forEach((q, j) => {
        const i = Q.length; Q.push(q);
        // récompenses à thème : ressources de la zone, clé du prochain boss, bonbons, coffres
        const nextBoss = steps.slice(j + 1).find((x) => x.t === "boss");
        const x = {};
        if (q.t === "kill") x.lot = q.sub;
        if (q.t === "lvl") { x.cons = j % 2 ? "potion_savoir" : "bonbon_sagesse"; x.n = 2; }
        if (q.t === "boss" && nextBoss && DUNGEONS[nextBoss.dg].key) x.key = nextBoss.dg;
        if (q.t === "boss" && !x.key) x.cons = "coffre_argent";
        if (j === steps.length - 1) { x.cons = "coffre_or"; x.n = 2; }
        QX[i] = x;
      });
      E.QUEST_CHAPTERS.push({ name: ch.name, where: ch.where, lvl: ch.lvl, start, end: Q.length, title: ch.title });
    });
  }
  E.questChapter = (i) => Math.max(0, E.QUEST_CHAPTERS.findIndex((c) => i >= c.start && i < c.end));
  E.questChapterDone = (S, k) => !!(S.quest && S.quest.step >= E.QUEST_CHAPTERS[k].end);
  // récompense en kamas : celle du chapitre 1 reste la même, ensuite elle suit le niveau du chapitre
  E.questKamas = (i) => { if (i < E.MAIN_CH1) return 80 + i * 60; const c = E.QUEST_CHAPTERS[E.questChapter(i)]; const t = (i - c.start) / Math.max(1, c.end - c.start - 1); const l = c.lvl[0] + (c.lvl[1] - c.lvl[0]) * t; return Math.round(l * l * 0.45 + l * 20); };
  if (E.setQuestReward) E.setQuestReward((i) => ({ kamas: E.questKamas(i), xp: i < E.MAIN_CH1 ? 0.35 : 0.25 }));

  /* ======================= QUÊTES DE RÉGION ======================= */
  const NPC = {
    incarnam: ["Ganymède", "Les âmes d'Incarnam", "Les âmes perdues errent sur la route. Aide-moi à les guider avant qu'elles ne se dispersent."],
    astrub: ["Ataman l'Archiviste", "Les secrets d'Astrub", "Les archives de la cité ont été pillées. Les voleurs se cachent dans les souterrains."],
    amakna: ["Maître Bolet", "Le cœur d'Amakna", "Les champs du Roi Allister sont envahis. Il me faut un aventurier qui n'a pas peur des Bouftous."],
    cania: ["Capitaine Cawotte", "Les plaines de Cania", "Les Porkass piétinent tout et les Blops débordent du lac. Les plaines ont besoin de toi."],
    wabbit: ["Wabbit Repenti", "L'île des Wabbits", "Le Wa Wabbit a perdu la tête et ses Wabbits avec lui. Aide-moi à ramener le calme sur l'île."],
    sidimote: ["Le Veilleur", "Les landes de Sidimote", "Quelque chose hurle la nuit dans les landes. Je veux savoir quoi, et le faire taire."],
    koalaks: ["Grand Koalak", "La montagne des Koalaks", "Les Kaliptus dépérissent et le canyon gronde. La montagne compte sur toi."],
    albuera: ["Rebelle d'Albuera", "Les futaies d'Albuera", "Le Rakoopeur tient les futaies enneigées. Rejoins la rébellion !"],
    abrak: ["Ancienne Abraknyde", "La forêt des Abraknydes", "Les arbres vivants ont la mémoire longue. Montre-leur que tu respectes la forêt."],
    moon: ["Moon", "L'île de Moon", "Les pirates ont pillé ma jungle. Si tu me rapportes mon trésor, je saurai être généreux."],
    dragoeufs: ["Dragoss", "Les terres des Dragoeufs", "Les œufs du sanctuaire sont menacés. Un Dragoeuf ne pardonne jamais à qui touche à sa couvée."],
    otomai: ["Otomaï", "L'archipel d'Otomaï", "Mes recherches sur l'île avancent, mais les Zoths et les Kanigs me compliquent la tâche."],
    minotoror: ["Gardien du Labyrinthe", "L'île du Minotoror", "Le Minotoror rôde au cœur du labyrinthe. Peu en reviennent : prouve que tu es de ceux-là."],
    pandala: ["Maître Pandawa", "L'île de Pandala", "Les quatre éléments de l'île se querellent. Un sage doit rétablir l'équilibre."],
    frigost: ["Fecaline la Sage", "Le grand froid de Frigost", "La glace avance chaque nuit sur la bourgade. Il faut briser l'emprise d'Harebourg."],
    saharach: ["Le Nomade", "Les sables de Saharach", "Le désert garde ses secrets sous le sable brûlant. Avec toi, nous irons jusqu'à la Pyramide."],
    pwak: ["Chef Croquant", "L'île de Pwâk", "Les Chocomanciens ont volé la recette sacrée. Rends-nous la gourmandise !"],
    divines: ["Le Gardien des Dimensions", "Les Dimensions divines", "Les mondes des dieux s'ouvrent à ceux qui ont fait leurs preuves. Les as-tu faites ?"],
    asse: ["Dramak", "Les îlots de la mer d'Asse", "Mon théâtre a besoin d'un héros pour sa prochaine pièce. Le rôle est dangereux, évidemment."],
    bontabrak: ["Milicien des égouts", "Bonta et Brâkmar", "Le Rat Blanc et le Rat Noir se disputent les égouts des deux cités. Il est temps d'y mettre fin."],
    grobe: ["Moine de Grobe", "L'île de Grobe", "L'Armée de brume s'éveille dans les tombeaux. Les Yokai ne doivent pas quitter l'île."],
    sakai: ["Mineur de Sakaï", "L'île de Sakaï", "Les Gobelins ont repris la mine abandonnée. Il nous faut la récupérer avant l'hiver."],
    valonia: ["Barbéryl", "L'archipel de Valonia", "Les galeries d'Ereboria ne sont plus sûres depuis que les Marteaux-Aigris s'y sont retranchés."],
    nimotopia: ["Chassouilleur repenti", "Nimotopia", "Le Comte Razof chasse tout ce qui bouge. À notre tour de le chasser."],
    obscure: ["Obscuranti déchu", "La Dimension Obscure", "L'Ombre grandit dans sa pyramide. Il faut l'affronter avant qu'elle n'avale la lumière."],
    harebourg: ["Ilyzaelle", "Le domaine d'Harebourg", "Mon père, le Comte, a sombré dans la folie du temps. Aide-moi à libérer Frigost."],
    sufokia: ["Amiral de Sufokia", "La baie de Sufokia", "Merkator a englouti la baie. Les trithons attendent un héros capable de respirer sous l'eau."],
    cavaliers: ["Messager de l'Eliocalypse", "Les Dimensions des Cavaliers", "Les quatre Cavaliers chevauchent vers le Monde des Douze. Il faut les arrêter un à un."],
    wukin: ["Scribe de Wukin", "Wukin et Wukang", "L'encre et le papier se font la guerre. Un royaume entier risque de s'effacer."],
    possedes: ["Survivant de l'Aurore", "L'atoll des Possédés", "Kabahal prépare un rituel sur l'atoll. Le cauchemar de l'Aurore Pourpre ne doit pas recommencer."],
    ecailles: ["Éclaireur de Torkélonia", "L'archipel des Écailles", "Les Crocodailles ont pris Crocuzko. Torkélonia attend son champion."],
  };
  const killN = (lv) => (lv < 30 ? [15, 25, 30] : lv < 100 ? [25, 40, 60] : [30, 50, 80]);
  E.REGIONS = ZONES.map((z) => {
    const subs = z.subs.filter((s) => SUBS[s.id] && (SUBS[s.id].monsters || []).length); if (!subs.length) return null;
    const lv = Math.min(...subs.map((s) => s.lvl[0])); const lvM = Math.max(...subs.map((s) => s.lvl[1]));
    const dg = Object.keys(DUNGEONS).filter((d) => subs.some((s) => s.id === E.DUNGEON_SUB[d])).sort((a, b) => DUNGEONS[a].lvl - DUNGEONS[b].lvl || (a < b ? -1 : 1));
    const [npc, title, story] = NPC[z.id] || [`Gardien de ${z.name}`, z.name, z.desc];
    const sorted = subs.slice().sort((a, b) => a.lvl[0] - b.lvl[0]); const n = killN(lv);
    const A = sorted[0], Bs = sorted[Math.min(1, sorted.length - 1)], C = sorted[Math.min(2, sorted.length - 1)];
    const res = ((MONSTERS[A.monsters[0]] || {}).drops || []).map((d) => d[0]).find((r) => !E.isKey(r));
    const steps = [{ t: "kill", sub: A.id, n: n[0], txt: `Chasser ${n[0]} monstres dans ${A.name}` }];
    if (res) steps.push({ t: "res", res, n: 10, txt: `Remettre 10 × ${res} à ${npc}` });
    steps.push({ t: "kill", sub: Bs.id, n: n[1], txt: `Chasser ${n[1]} monstres dans ${Bs.name}` });
    if (dg[0]) steps.push({ t: "boss", dg: dg[0], s: 1, txt: `Vaincre ${MONSTERS[DUNGEONS[dg[0]].boss].name} (${DUNGEONS[dg[0]].name})` });
    const d2 = dg.filter((d) => DUNGEONS[d].lvl <= lv + 35).pop(); // le dernier boss reste à la portée de la région, pas au bout du monde
    if (d2) steps.push({ t: "boss", dg: d2, s: 3, txt: `Vaincre ${MONSTERS[DUNGEONS[d2].boss].name} en stasis 3 ou plus (${DUNGEONS[d2].name})` });
    else steps.push({ t: "kill", sub: C.id, n: n[2], txt: `Chasser ${n[2]} monstres dans ${C.name}` });
    steps.push({ t: "talk", n: 1, txt: `Revenir voir ${npc}` });
    return { id: z.id, name: z.name, desc: z.desc, lv, lvM, npc, title, story, steps, img: A.monsters[0], subs: subs.map((s) => s.id) };
  }).filter(Boolean).sort((a, b) => a.lv - b.lv || (a.name < b.name ? -1 : 1));
  E.REGION = Object.fromEntries(E.REGIONS.map((R) => [R.id, R]));
  E.regionTitle = (R) => {
    const n = R.name.replace(/^Frigost : /, ""); const w = n.split(/[ ']/)[0]; const lo = n[0].toLowerCase() + n.slice(1);
    if (/^(Plaines|Landes|Terres|Dimensions|Îlots)$/.test(w)) return `l'Ami des ${lo}`;
    if (/^(Île|Archipel|Atoll)$/.test(w)) return `l'Ami de l'${lo}`;
    if (/^(Montagne|Forêt|Baie|Dimension)$/.test(w)) return `l'Ami de la ${lo}`;
    return `l'Ami ${/^[AEIOUÉÎÏH]/.test(n) ? "d'" : "de "}${n}`;
  };
  E.rqState = (S, id) => { S.rq = S.rq || {}; return (S.rq[id] = S.rq[id] || { i: 0, p: 0, done: 0 }); };
  E.rqOpen = (S, R) => { if (typeof R === "string") R = E.REGION[R]; return !!R && R.lv <= topLvl(S) + 5 && R.subs.some((s) => E.subUnlocked(S, s)); };
  E.rqStepRew = (R, i) => Math.round(Math.max(150, R.lv * R.lv * 0.25 + R.lv * 12) * (i + 1) / 2);
  E.rqFinalRew = (R) => Math.round(Math.max(2000, R.lv * 900));
  /* progression de l'étape en cours : [a, b] */
  E.rqProgress = (S, R) => {
    const T = E.rqState(S, R.id); const st = R.steps[T.i]; if (!st || T.done) return [1, 1];
    if (st.t === "kill") return [Math.min(T.p, st.n), st.n];
    if (st.t === "res") return [Math.min(S.res[st.res] || 0, st.n), st.n];
    if (st.t === "boss") return [(S.progress.bossKills[st.dg] && (st.s <= 1 || stasisMax(S, st.dg) >= st.s)) ? 1 : 0, 1];
    if (st.t === "talk") return [1, 1];
    return [0, 1];
  };
  E.rqReady = (S, R) => { const T = E.rqState(S, R.id); const st = R.steps[T.i]; return !T.done && E.rqOpen(S, R) && st && (st.t === "res" || st.t === "talk") && E.rqProgress(S, R)[0] >= E.rqProgress(S, R)[1]; };
  const rqAdvance = (S, R, quiet) => {
    const T = E.rqState(S, R.id); const k = E.rqStepRew(R, T.i);
    T.i++; T.p = 0; S.kamas += k; giveXp(S, R.lv < 100 ? 0.12 : 0.08); // l'étape avance avant l'XP (une montée de niveau relance rqCheck)
    if (!quiet) E.note(S, `Quête de région · ${R.title} : étape terminée (+${fmtK(k)} kamas).`, "up");
  };
  /* étapes qui se valident toutes seules (chasse, boss) ; les remises et la fin se font avec un bouton */
  let rqBusy = false;
  const rqCheck = (S) => {
    if (rqBusy) return; rqBusy = true;
    try { rqCheck1(S); } finally { rqBusy = false; }
  };
  const rqCheck1 = (S) => {
    E.REGIONS.forEach((R) => {
      const T = E.rqState(S, R.id); let guard = 0;
      while (!T.done && guard++ < 8 && E.rqOpen(S, R)) {
        const st = R.steps[T.i]; if (!st || st.t === "res" || st.t === "talk") break;
        const [a, b] = E.rqProgress(S, R); if (a < b) break;
        rqAdvance(S, R);
      }
    });
  };
  E.rqCheck = rqCheck;
  E.rqGive = (S, id) => {
    const R = E.REGION[id]; if (!R) return "Quête introuvable."; const T = E.rqState(S, id); const st = R.steps[T.i];
    if (T.done || !st || st.t !== "res") return "Rien à remettre pour l'instant.";
    if ((S.res[st.res] || 0) < st.n) return `Il faut ${st.n} × ${st.res}.`;
    S.res[st.res] -= st.n; if (!S.res[st.res]) delete S.res[st.res];
    rqAdvance(S, R); rqCheck(S); return null;
  };
  E.rqClaim = (S, id) => {
    const R = E.REGION[id]; if (!R) return "Quête introuvable."; const T = E.rqState(S, id); const st = R.steps[T.i];
    if (T.done || !st || st.t !== "talk") return "La quête n'est pas encore terminée.";
    T.done = E.now(); T.i = R.steps.length; S.cnt.rq = (S.cnt.rq || 0) + 1;
    const k = E.rqFinalRew(R); S.kamas += k; giveXp(S, R.lv < 100 ? 0.3 : 0.2); E.addCons(S, "coffre_argent");
    const t = E.regionTitle(R); addTitle(S, t); S.unlocks = S.unlocks || {}; S.unlocks["reg_" + R.id] = 1;
    E.note(S, `Quête de région terminée : ${R.title} (+${fmtK(k)} kamas, Coffre en argent, titre « ${t} », ornement « Emblème de ${R.name} »).`, "rare");
    if (E.celebrate) E.celebrate({ t: "rq", id: R.id, name: R.name, title: t });
    if (E.checkAch) E.checkAch(S); return null;
  };
  E.rqDoneCount = (S) => E.REGIONS.filter((R) => S.rq && S.rq[R.id] && S.rq[R.id].done).length;

  /* ======================= QUÊTES DE LA SEMAINE ======================= */
  const WK = [
    { t: "kill", n: (l) => 300 + Math.round(l), name: "Grand nettoyage", txt: (n) => `Vaincre ${fmtK(n)} monstres en chasse.` },
    { t: "dg", n: () => 6, name: "Collection de clés", txt: (n, l) => `Terminer ${n} donjons de niveau ${Math.max(1, l - 30)} ou plus.` },
    { t: "cmd", n: () => 8, name: "Ami des artisans", txt: (n) => `Livrer ${n} commandes d'artisans.` },
    { t: "bounty", n: () => 8, name: "Chasseur de primes", txt: (n) => `Remplir ${n} avis de recherche.` },
    { t: "harvest", n: (l) => 400 + l * 2, name: "Bonne récolte", txt: (n) => `Récolter ${fmtK(n)} ressources.` },
    { t: "craft", n: () => 25, name: "À l'établi", txt: (n) => `Fabriquer ${n} objets.` },
    { t: "almanax", n: () => 4, name: "Dévotion", txt: (n) => `Faire ${n} offrandes à l'Almanax.` },
    { t: "tresor", n: () => 2, name: "Carte au trésor", txt: (n) => `Trouver ${n} trésors.` },
    { t: "champ", n: (l) => (l < 60 ? 15 : 30), name: "Tueur de Champions", txt: (n) => `Vaincre ${n} monstres Champions.` },
  ];
  E.WEEK_TPL = WK;
  E.wkState = (S, now = E.now()) => {
    const w = E.weekOf(now);
    if (!S.wk || S.wk.w !== w) {
      const l = topLvl(S); const pool = WK.slice(); const list = [];
      // une quête de chasse, une de donjon (ou de primes) et une d'artisan ou d'Almanax : toujours un peu de tout
      const by = (ts) => { const c = pool.filter((x) => ts.includes(x.t)); const p = pick(c); pool.splice(pool.indexOf(p), 1); return p; };
      [by(["kill", "champ"]), by(["dg", "bounty", "tresor"]), by(["cmd", "harvest", "craft", "almanax"])].forEach((x) => list.push({ t: x.t, n: x.n(l), p: 0, l, done: 0 }));
      S.wk = { w, list, claimed: 0, l };
    }
    return S.wk;
  };
  E.wkName = (q) => (WK.find((x) => x.t === q.t) || {}).name || "Quête";
  E.wkTxt = (q) => { const x = WK.find((y) => y.t === q.t); return x ? x.txt(q.n, q.l) : ""; };
  E.wkRew = (q) => Math.round(q.l * q.l * 1.2 + q.l * 150 + 1500);
  const wkBump = (S, t, k = 1, extra) => {
    if (!S.wk) return; const W = S.wk; if (W.w !== E.weekOf()) return;
    W.list.forEach((q) => {
      if (q.done || q.t !== t) return; if (t === "dg" && extra && extra.lvl < q.l - 30) return;
      q.p = Math.min(q.n, q.p + k);
      if (q.p >= q.n) { q.done = E.now(); const r = E.wkRew(q); S.kamas += r; giveXp(S, 0.2); E.note(S, `Quête de la semaine terminée : ${E.wkName(q)} (+${fmtK(r)} kamas).`, "rare"); }
    });
    if (!W.claimed && W.list.every((q) => q.done)) {
      W.claimed = E.now(); E.addCons(S, "coffre_or"); S.cnt.wk = (S.cnt.wk || 0) + 1;
      const T = E.tresorState ? E.tresorState(S) : null; if (T) for (let i = 0; i < 3; i++) T.stock.push(clamp(topLvl(S), 1, 200));
      E.note(S, "Coffre de la semaine : les 3 quêtes sont faites ! +1 Coffre en or et 3 parchemins de chasse.", "rare");
      if (E.celebrate) E.celebrate({ t: "wk" });
    }
  };
  E.wkBump = wkBump;

  /* ======================= AVIS : RANG, BOSS, ÉLITE ======================= */
  E.HUNT_RANKS = [["Apprenti chasseur", 0], ["Chasseur", 25], ["Chasseur confirmé", 100], ["Fine gâchette", 250], ["Maître chasseur", 500]];
  E.hunterRank = (S) => { const n = (S.cnt && S.cnt.bounty) || 0; let r = 0; E.HUNT_RANKS.forEach(([, m], i) => { if (n >= m) r = i; }); return r; };
  E.huntBonus = (S) => 1 + 0.1 * E.hunterRank(S);
  /* avis d'élite : un boss de ton niveau en stasis 6 ou plus, change chaque lundi */
  E.ELITE_STASIS = 6;
  E.eliteState = (S, now = E.now()) => {
    const w = E.weekOf(now);
    if (!S.belite || S.belite.w !== w) {
      const top = topLvl(S);
      let dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= top && DUNGEONS[d].lvl >= top - 25);
      if (!dgs.length) dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= top + 5);
      const d = dgs.length ? dgs.sort()[(w * 7 + dgs.length) % dgs.length] : null;
      S.belite = { w, dg: d, key: d ? DUNGEONS[d].boss : null, s: E.ELITE_STASIS, prog: 0, n: 1, done: 0, kamas: d ? Math.round(DUNGEONS[d].lvl * DUNGEONS[d].lvl * 3 + 5000) : 0 };
    }
    return S.belite;
  };
  const eliteDone = (S) => {
    const B0 = S.belite; B0.prog = 1; B0.done = E.now(); const k = Math.round(B0.kamas * E.huntBonus(S));
    S.kamas += k; S.tokens.jetons = (S.tokens.jetons || 0) + 5; E.addCons(S, "coffre_or"); S.cnt.belite = (S.cnt.belite || 0) + 1; giveXp(S, 0.3);
    E.note(S, `Avis d'élite rempli : ${MONSTERS[B0.key].name} (+${fmtK(k)} kamas, +5 jetons, Coffre en or).`, "rare");
  };

  /* ======================= SECRETS : drapeaux ======================= */
  const qsx = (S) => (S.qsx = S.qsx || {});
  const hourNow = () => new Date(E.now()).getHours();

  /* ======================= ÉVÉNEMENTS ======================= */
  const emit0 = E.emit;
  E.emit = (S, type, data) => {
    if (emit0) emit0(S, type, data);
    if (!S || !S.chars || !S.cnt || !data) return;
    try { onEvent(S, type, data); } catch (e) { /* une quête ne doit jamais casser une partie */ }
  };
  function onEvent(S, type, data) {
    if (type === "win") {
      const mons = data.mons || [];
      if (data.sub && !data.dungeon) {
        const z = zoneOfSub[data.sub];
        E.REGIONS.forEach((R) => { if (R.id !== z) return; const T = E.rqState(S, R.id); const st = R.steps[T.i]; if (!T.done && st && st.t === "kill" && st.sub === data.sub && E.rqOpen(S, R)) T.p += mons.length; });
        if (S.wk) { wkBump(S, "kill", mons.length); const ch = mons.filter((m) => m.champ).length; if (ch) wkBump(S, "champ", ch); }
        if (/^inc_/.test(data.sub) && topLvl(S) >= 200) qsx(S).retour = 1;
      }
      const h = hourNow(); if (h === 3) qsx(S).nuit = 1;
    }
    if (type === "dungeon" && DUNGEONS[data.id]) {
      const dg = DUNGEONS[data.id];
      wkBump(S, "dg", 1, { lvl: dg.lvl });
      const B0 = S.belite; if (B0 && !B0.done && B0.dg === data.id && (data.stasis || 1) >= B0.s && B0.w === E.weekOf()) eliteDone(S);
      if ((data.stasis || 1) >= 10 && !data.down) qsx(S).parfait = 1;
      if (dg.lvl >= 100 && E.team(S).length === 1) qsx(S).solo = 1;
    }
    if (type === "commande") { S.cnt.cmd = (S.cnt.cmd || 0) + 1; wkBump(S, "cmd"); }
    if (type === "bounty") { wkBump(S, "bounty"); const d = dayOf(); const X = qsx(S); if (X.bd !== d) { X.bd = d; X.bn = 0; } if (++X.bn >= 5) X.bounty5 = 1; }
    if (type === "harvest") wkBump(S, "harvest", data.n || 1);
    if (type === "craft") wkBump(S, "craft");
    if (type === "almanax") { wkBump(S, "almanax"); if (hourNow() >= 23) qsx(S).minuit = 1; }
    if (S.kamas >= 1e6) qsx(S).riche = 1;
    if (qsx(S).riche && S.kamas < 100) qsx(S).ruine = 1;
    rqCheck(S);
  }
  // les trésors trouvés comptent pour la semaine (le compteur est dans suivi.js)
  E.wkTresor = (S) => wkBump(S, "tresor");

  /* ======================= SUCCÈS ======================= */
  const ACH = E.ACH; const has = (id) => ACH.some((a) => a.id === id);
  const addA = (o) => { if (!has(o.id)) ACH.push(o); };
  const ser = (id, cat, list, f) => list.forEach((x) => addA(f(x, id, cat)));
  // Quêtes : chapitres, régions, semaines
  E.QUEST_CHAPTERS.slice(1).forEach((c, k) => addA({ id: "mainch" + (k + 2), cat: "Quêtes", name: c.title, desc: `Terminer le chapitre ${k + 2} de la quête principale : ${c.name}.`, test: (S) => E.questChapterDone(S, k + 1), prog: (S) => [clamp((S.quest.step || 0) - c.start, 0, c.end - c.start), c.end - c.start], kamas: [15000, 40000, 80000, 150000][k], title: c.title }));
  [[1, "Bon voisin"], [5, "Ami des régions"], [10, "Voyageur"], [20, "Grand voyageur"], [E.REGIONS.length, "Ami du Monde des Douze"]].forEach(([n, nm]) => addA({ id: "rq" + n, cat: "Quêtes", name: nm, desc: `Terminer ${n} quête${n > 1 ? "s" : ""} de région.`, test: (S) => E.rqDoneCount(S) >= n, prog: (S) => [E.rqDoneCount(S), n], kamas: n * 1500, title: n === E.REGIONS.length ? "Ami du Monde des Douze" : undefined }));
  [[1, "Première semaine"], [4, "Un mois bien rempli"], [12, "Trois mois d'aventures"], [52, "Une année de quêtes"]].forEach(([n, nm]) => addA({ id: "wk" + n, cat: "Quêtes", name: nm, desc: `Ouvrir ${n} Coffre${n > 1 ? "s" : ""} de la semaine.`, test: (S) => (S.cnt.wk || 0) >= n, prog: (S) => [S.cnt.wk || 0, n], kamas: n * 4000, title: n === 52 ? "l'Infatigable" : undefined }));
  // Régions : explorer (trophées de toutes les sous-zones) et ami (quête finie)
  E.REGIONS.forEach((R) => {
    addA({ id: "regx_" + R.id, cat: "Régions", grp: "Explorer", name: `Explorateur : ${R.name}`, desc: `Obtenir le trophée de chaque sous-zone de ${R.name}.`, test: (S) => R.subs.every((s) => S.trophies[s]), prog: (S) => [R.subs.filter((s) => S.trophies[s]).length, R.subs.length], kamas: Math.round(Math.max(1000, R.lv * 120)) });
    addA({ id: "rega_" + R.id, cat: "Régions", grp: "Quêtes de région", name: `Ami : ${R.name}`, desc: `Terminer la quête de région « ${R.title} ».`, test: (S) => !!(S.rq && S.rq[R.id] && S.rq[R.id].done), kamas: Math.round(Math.max(800, R.lv * 60)) });
  });
  // Classes : niveau 100 et 200 avec chaque classe
  (D.CLASS_ORDER || Object.keys(CLASSES)).forEach((k) => { const C = CLASSES[k]; if (!C) return;
    [100, 200].forEach((l) => addA({ id: `cls${l}_${k}`, cat: "Classes", grp: `Niveau ${l}`, name: `${C.name} ${l === 200 ? "accompli" : "aguerri"}`, desc: `Un héros ${C.name} atteint le niveau ${l}.`, test: (S) => S.chars.some((c) => c.cls === k && (c.lvl >= l || (c.ren || 0) > 0)), prog: (S) => [Math.max(0, ...S.chars.filter((c) => c.cls === k).map((c) => (c.ren ? 200 : c.lvl))), l], kamas: l === 200 ? 25000 : 5000 }));
  });
  // Donjons : stasis 10 dans chaque donjon
  ACH.forEach((a) => { if (/^dg_/.test(a.id) && a.id !== "dg_all") a.grp = a.grp || "Boss vaincus"; if (/^sig_/.test(a.id)) a.grp = a.grp || "Mécaniques"; });
  Object.entries(DUNGEONS).sort((a, b) => a[1].lvl - b[1].lvl).forEach(([id, d]) => addA({ id: "s10_" + id, cat: "Donjons", grp: "Stasis 10", name: `${d.name} · stasis 10`, desc: `Terminer ${d.name} en stasis 10.`, test: (S) => stasisMax(S, id) >= 10, prog: (S) => [stasisMax(S, id), 10], kamas: Math.round(d.lvl * 80 + 2000) }));
  // Kolizéum
  const koli = (S) => S.koli || {};
  [1, 10, 50, 200].forEach((n) => addA({ id: "koliF" + n, cat: "Kolizéum", name: n === 1 ? "Premier combat d'arène" : `${n} combats d'arène`, desc: `Combattre ${n} fois au Kolizéum.`, test: (S) => (S.cnt.koliFights || 0) >= n, prog: (S) => [S.cnt.koliFights || 0, n], kamas: 500 + n * 120 }));
  [1, 10, 50, 100, 250].forEach((n) => addA({ id: "koliW" + n, cat: "Kolizéum", name: n === 1 ? "Première victoire d'arène" : `${n} victoires d'arène`, desc: `Gagner ${n} combat${n > 1 ? "s" : ""} au Kolizéum.`, test: (S) => (S.cnt.koliWins || 0) >= n, prog: (S) => [S.cnt.koliWins || 0, n], kamas: 800 + n * 200, title: n === 250 ? "Gladiateur" : undefined }));
  (E.KOLI_GRADES || []).slice(1, 4).forEach((g) => addA({ id: "koliG_" + g.id, cat: "Kolizéum", name: `Grade ${g.name}`, desc: `Atteindre le grade ${g.name} au Kolizéum (cote ${fmtK(g.min)}).`, test: (S) => (koli(S).best || 0) >= g.min, prog: (S) => [koli(S).best || 0, g.min], kamas: 5000 + g.min * 4 }));
  // Économie
  [[10, "Curieux"], [100, "Ouvreur de coffres"], [500, "Pilleur de coffres"], [1000, "Maître des coffres"]].forEach(([n, nm]) => addA({ id: "chest" + n, cat: "Économie", name: nm, desc: `Ouvrir ${n} coffres.`, test: (S) => (S.cnt.chests || 0) >= n, prog: (S) => [S.cnt.chests || 0, n], kamas: n * 30 }));
  [[10, "Commis"], [50, "Grossiste"], [200, "Négociant"], [500, "Marchand du Krosmoz"]].forEach(([n, nm]) => addA({ id: "cmdx" + n, cat: "Économie", name: nm, desc: `Livrer ${n} commandes d'artisans.`, test: (S) => ((S.cmd && S.cmd.n) || 0) >= n, prog: (S) => [(S.cmd && S.cmd.n) || 0, n], kamas: n * 150 }));
  [[1e5, "Petite fortune"], [1e6, "Millionnaire"], [5e6, "Grand argentier"]].forEach(([n, nm]) => addA({ id: "kam" + n, cat: "Économie", name: nm, desc: `Avoir ${fmtK(n)} kamas en poche.`, test: (S) => S.kamas >= n, prog: (S) => [Math.floor(S.kamas), n], kamas: Math.round(n / 100) }));
  [[10, "Premier échange"], [100, "Habitué de l'Hôtel de vente"], [500, "Pilier de l'Hôtel de vente"]].forEach(([n, nm]) => addA({ id: "hdv" + n, cat: "Économie", name: nm, desc: `Faire ${n} opérations à l'Hôtel de vente (ventes, achats, ordres).`, test: (S) => ((S.hdv && S.hdv.op) || 0) >= n, prog: (S) => [(S.hdv && S.hdv.op) || 0, n], kamas: n * 60 }));
  // Chasses
  E.HUNT_RANKS.slice(1).forEach(([nm, n], i) => addA({ id: "hrank" + (i + 1), cat: "Chasses", grp: "Avis de recherche", name: nm, desc: `Atteindre le rang de chasseur « ${nm} » (${n} avis remplis).`, test: (S) => E.hunterRank(S) >= i + 1, prog: (S) => [(S.cnt.bounty || 0), n], kamas: n * 100, title: i === 3 ? "Maître chasseur" : undefined }));
  [[1, "Cible d'élite"], [10, "Traqueur d'élite"], [25, "Légende des primes"]].forEach(([n, nm]) => addA({ id: "belite" + n, cat: "Chasses", grp: "Avis de recherche", name: nm, desc: `Remplir ${n} avis d'élite.`, test: (S) => (S.cnt.belite || 0) >= n, prog: (S) => [S.cnt.belite || 0, n], kamas: n * 3000 }));
  [[5, "Chasseur de boss"], [25, "Fléau des boss"], [100, "Le boss, c'est moi"]].forEach(([n, nm]) => addA({ id: "bboss" + n, cat: "Chasses", grp: "Avis de recherche", name: nm, desc: `Remplir ${n} avis de boss.`, test: (S) => (S.cnt.bboss || 0) >= n, prog: (S) => [S.cnt.bboss || 0, n], kamas: n * 500 }));
  [[1, "Trésor légendaire"], [5, "Pilleur de légendes"], [20, "Archéologue du Krosmoz"]].forEach(([n, nm]) => addA({ id: "tleg" + n, cat: "Chasses", grp: "Chasse au trésor", name: nm, desc: `Trouver ${n} trésor${n > 1 ? "s" : ""} légendaire${n > 1 ? "s" : ""}.`, test: (S) => ((S.tresor && S.tresor.leg) || 0) >= n, prog: (S) => [(S.tresor && S.tresor.leg) || 0, n], kamas: n * 8000, title: n === 20 ? "Archéologue" : undefined }));
  [[25, "Pelle d'or"], [100, "Cartographe"]].forEach(([n, nm]) => addA({ id: "tres" + n, cat: "Chasses", grp: "Chasse au trésor", name: nm, desc: `Trouver ${n} trésors.`, test: (S) => ((S.tresor && S.tresor.n) || 0) >= n, prog: (S) => [(S.tresor && S.tresor.n) || 0, n], kamas: n * 800 }));
  [[200, "Chasseur acharné"], [1000, "Bureau des primes à soi tout seul"]].forEach(([n, nm]) => addA({ id: "btyx" + n, cat: "Chasses", grp: "Avis de recherche", name: nm, desc: `Remplir ${n} avis de recherche.`, test: (S) => (S.cnt.bounty || 0) >= n, prog: (S) => [S.cnt.bounty || 0, n], kamas: n * 90 }));
  // Collection : panoplies complètes, objets différents, ressources découvertes, ornements, titres
  const ownedTpl = (S) => { const o = new Set(); for (const u in S.items || {}) { const it = S.items[u]; if (it && it.tpl) o.add(it.tpl); } return o; };
  let setCache = { t: 0, v: 0, u: 0, S: null };
  const collect = (S) => { const now = E.now(); if (setCache.S === S && now - setCache.t < 5000) return setCache;
    const o = ownedTpl(S); let v = 0; for (const k in SETS || {}) { const its = (SETS[k].items || []); if (its.length && its.every((t) => o.has(t))) v++; }
    setCache = { t: now, v, u: o.size, S }; return setCache; };
  [1, 5, 10, 25, 50, 100].forEach((n) => addA({ id: "setc" + n, cat: "Collection", grp: "Panoplies", name: n === 1 ? "Première panoplie" : `${n} panoplies`, desc: `Posséder toutes les pièces de ${n} panoplie${n > 1 ? "s" : ""}.`, test: (S) => collect(S).v >= n, prog: (S) => [collect(S).v, n], kamas: n * 1500, title: n === 100 ? "le Collectionneur de panoplies" : undefined }));
  [100, 250, 500, 1000, 1500].forEach((n) => addA({ id: "itemu" + n, cat: "Collection", grp: "Objets", name: `${n} objets différents`, desc: `Posséder ${n} objets différents.`, test: (S) => collect(S).u >= n, prog: (S) => [collect(S).u, n], kamas: n * 20 }));
  [100, 250, 500, 1000].forEach((n) => addA({ id: "ress" + n, cat: "Collection", grp: "Ressources", name: `${n} ressources découvertes`, desc: `Découvrir ${n} ressources différentes.`, test: (S) => Object.keys(S.resSeen || {}).length >= n, prog: (S) => [Object.keys(S.resSeen || {}).length, n], kamas: n * 15 }));
  const ornN = (S) => Object.keys(E.ORN || {}).filter((id) => E.ornUnlocked && E.ornUnlocked(S, id)).length;
  [5, 10, 20, 40].forEach((n) => addA({ id: "ornc" + n, cat: "Collection", grp: "Ornements et titres", name: `${n} ornements`, desc: `Débloquer ${n} ornements.`, test: (S) => ornN(S) >= n, prog: (S) => [ornN(S), n], kamas: n * 600 }));
  [5, 10, 25, 50].forEach((n) => addA({ id: "titc" + n, cat: "Collection", grp: "Ornements et titres", name: `${n} titres`, desc: `Débloquer ${n} titres.`, test: (S) => (E.titles ? E.titles(S).length : 0) >= n, prog: (S) => [E.titles ? E.titles(S).length : 0, n], kamas: n * 500 }));
  // Secrets : cachés jusqu'à ce qu'on les trouve, avec un petit indice
  const SEC = [
    ["bourse", "Bourse pleine", "Une bourse vraiment très lourde.", "Avoir 10 000 000 kamas.", (S) => S.kamas >= 1e7, 50000],
    ["fidele", "Fidèle au poste", "Le temps file quand on s'amuse.", "Jouer 100 heures.", (S) => ((S.stats && S.stats.playtime) || 0) >= 360000, 30000],
    ["nuit", "Insomniaque", "Quand tout le monde dort…", "Gagner un combat entre 3 h et 4 h du matin.", (S) => !!qsx(S).nuit, 5000],
    ["famille", "Famille nombreuse", "Plus on est de fous…", "Avoir 12 héros.", (S) => S.chars.length >= 12, 15000],
    ["clones", "Tous pareils", "Une équipe de jumeaux.", "Avoir 4 héros de la même classe.", (S) => Object.values(S.chars.reduce((o, c) => ((o[c.cls] = (o[c.cls] || 0) + 1), o), {})).some((n) => n >= 4), 8000],
    ["arcenciel", "Arc-en-ciel", "Toutes les couleurs dans l'équipe.", "Avoir 8 classes différentes dans l'équipe.", (S) => new Set(E.team(S).map((c) => c.cls)).size >= 8, 10000],
    ["tenace", "Tenace", "Tomber, se relever, recommencer.", "Perdre 500 combats.", (S) => ((S.stats && S.stats.fights) || 0) - ((S.stats && S.stats.wins) || 0) >= 500, 10000],
    ["poussiere", "Tas de poussière", "Ça s'accumule dans un coin…", "Avoir 10 000 Poussières de stasis.", (S) => (S.res["Poussière de stasis"] || 0) >= 10000, 20000],
    ["ruine", "Tout dépensé", "Du million à presque rien.", "Descendre sous 100 kamas après avoir eu un million.", (S) => !!qsx(S).ruine, 10000],
    ["gourmand", "Gourmand", "Une belle réserve de gourmandises.", "Garder 100 consommables en réserve.", (S) => Object.values(S.cons || {}).reduce((a, b) => a + b, 0) >= 100, 8000],
    ["retour", "Retour aux sources", "Revenir là où tout a commencé.", "Gagner un combat à Incarnam avec un héros niveau 200.", (S) => !!qsx(S).retour, 8000],
    ["parfait", "Pas une égratignure", "Le plus dur, sans un bleu.", "Terminer un donjon en stasis 10 sans qu'aucun héros ne tombe.", (S) => !!qsx(S).parfait, 40000],
    ["solo", "Seul contre tous", "Qui a besoin d'une équipe ?", "Terminer un donjon de niveau 100 ou plus avec un seul héros en équipe.", (S) => !!qsx(S).solo, 25000],
    ["minuit", "Juste à temps", "Juste avant minuit.", "Faire l'offrande de l'Almanax après 23 h.", (S) => !!qsx(S).minuit, 5000],
    ["primes5", "Le bureau ne désemplit pas", "Une journée de primes bien remplie.", "Remplir 5 avis de recherche le même jour.", (S) => !!qsx(S).bounty5, 6000],
  ];
  SEC.forEach(([id, name, hint, desc, test, kamas]) => addA({ id: "sec_" + id, cat: "Secrets", name, hint, desc, test, kamas, secret: true }));

  /* points de succès et paliers */
  E.achPts = (a) => (a.pts ? a.pts : a.kamas < 1000 ? 5 : a.kamas < 5000 ? 10 : a.kamas < 20000 ? 20 : 40);
  E.achPoints = (S) => ACH.reduce((s, a) => s + (S.ach && S.ach[a.id] ? E.achPts(a) : 0), 0);
  E.ACH_PALIERS = [
    { n: 250, txt: "Coffre en argent", give: (S) => E.addCons(S, "coffre_argent") },
    { n: 500, txt: "Ornement « Médaillon du Mérite »", give: (S) => { S.unlocks.pal1 = 1; } },
    { n: 1000, txt: "Titre « l'Accompli »", give: (S) => addTitle(S, "l'Accompli") },
    { n: 2000, txt: "2 Coffres en or", give: (S) => E.addCons(S, "coffre_or", 2) },
    { n: 3500, txt: "Ornement « Couronne d'étoiles »", give: (S) => { S.unlocks.pal2 = 1; } },
    { n: 5000, txt: "Titre « Légende du Krosmoz »", give: (S) => addTitle(S, "Légende du Krosmoz") },
  ];
  const palCheck = (S) => {
    const p = E.achPoints(S); S.unlocks = S.unlocks || {}; let k = S.achPal || 0;
    while (k < E.ACH_PALIERS.length && p >= E.ACH_PALIERS[k].n) { const P = E.ACH_PALIERS[k]; P.give(S); k++; E.note(S, `Palier de succès : ${fmtK(P.n)} points ! ${P.txt}.`, "rare"); }
    S.achPal = k;
  };
  E.palCheck = palCheck;
  const check0 = E.checkAch;
  if (check0) E.checkAch = (S) => { check0(S); try { palCheck(S); } catch (e) {} };
  /* progression : les succès qui la donnent eux-mêmes */
  const prog0 = E.achProgress;
  E.achProgress = (S, id) => { const a = ACH.find((x) => x.id === id); if (a && a.prog) { try { return a.prog(S); } catch (e) { return null; } } return prog0(S, id); };

  /* ======================= ORNEMENTS ET TITRES ======================= */
  if (E.ORN) {
    E.REGIONS.forEach((R) => { E.ORN["reg_" + R.id] = { name: () => `Emblème de ${R.name}`, req: `Terminer la quête de région « ${R.title} »`, ok: (S) => !!(S.unlocks && S.unlocks["reg_" + R.id]), reg: R.id }; });
    E.ORN.pal1 = { name: () => "Médaillon du Mérite", req: "500 points de succès", ok: (S) => !!(S.unlocks && S.unlocks.pal1) };
    E.ORN.pal2 = { name: () => "Couronne d'étoiles", req: "3 500 points de succès", ok: (S) => !!(S.unlocks && S.unlocks.pal2) };
  }
  const titles0 = E.titles;
  if (titles0) E.titles = (S) => { const t = titles0(S); E.QUEST_CHAPTERS.slice(1).forEach((c, k) => { if (E.questChapterDone(S, k + 1) && !t.includes(c.title)) t.push(c.title); }); return t; };

  /* ======================= OBJECTIFS ÉPINGLÉS ======================= */
  const pin0 = E.pinInfo;
  E.pinInfo = (S, p) => {
    if (p.k === "rq") { const R = E.REGION[p.id]; if (!R) return null; const T = E.rqState(S, R.id); if (T.done) return null; const [a, b] = E.rqProgress(S, R); return { k: "rq", label: R.title, a, b, txt: `${T.i + 1}/${R.steps.length}`, done: false, go: { tab: "quests", qt: "region" } }; }
    if (p.k === "wk") { const W = S.wk; if (!W || W.w !== E.weekOf()) return null; const q = W.list[p.id]; if (!q) return null; return { k: "wk", label: E.wkName(q), a: q.p, b: q.n, txt: `${fmtK(q.p)}/${fmtK(q.n)}`, done: !!q.done, go: { tab: "quests", qt: "hebdo" } }; }
    if (p.k === "belite") { const B0 = S.belite; if (!B0 || !B0.key) return null; return { k: "belite", label: `Élite : ${MONSTERS[B0.key].name}`, a: B0.prog, b: 1, txt: B0.done ? "✓" : `stasis ${B0.s}`, done: !!B0.done, go: { tab: "quests", qt: "bounty" } }; }
    return pin0(S, p);
  };

  /* ======================= ACTIONS, ÉTAT, RECHERCHE ======================= */
  Object.assign(E.ACTIONS, { rqGive: "remettre des ressources pour une quête de région", rqClaim: "terminer une quête de région" });
  if (E.carnetCat) E.carnetCat({ rqGive: "quete", rqClaim: "quete" });
  if (E.carnetWrap) E.carnetWrap();
  const refresh0 = E.refreshSystems;
  E.refreshSystems = (S) => { refresh0(S); try { E.wkState(S); E.eliteState(S); rqCheck(S); palCheck(S); } catch (e) {} };
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "region")) E.SEARCH_PAGES.push(["region", "Quêtes de région", "Suivi › Quêtes › Aventures : une histoire par région"], ["hebdo", "Quêtes de la semaine", "Suivi › Quêtes › Aujourd'hui › Semaine : 3 quêtes chaque lundi"]);

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
