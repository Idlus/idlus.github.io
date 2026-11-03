/* Quête principale en scènes (js/histoire.js, Classique · Saison 1) : les scènes couvrent les 93 étapes, chaque chapitre
   garde ses bornes, les objectifs d'une scène avancent ensemble, chaque objectif paie la même récompense que l'étape de
   l'Éternel, boosters par scène et par chapitre, S.quest.step suit (Sablier, Héros d'Amakna), l'Éternel ne change pas.
   Lancer : node tests/histoire.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/quetes.js"); require("../js/saisonc.js"); require("../js/cartes.js"); require("../js/histoire.js");
const Q = E.MAIN_QUEST, SC = E.HIST_SC, CH = E.QUEST_CHAPTERS;
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const s1 = () => { const S = E.newState("Héros", "iop"); E.s1cStart(S, now); E.refreshSystems(S); return S; };

// les scènes couvrent chaque étape une fois, sans déborder d'un chapitre ; textes de 200 caractères au plus
{ const all = SC.flatMap((x) => x.g).sort((a, b) => a - b); assert.deepStrictEqual(all, Q.map((_, i) => i));
  SC.forEach((x) => { const C = CH[x.ch]; x.g.forEach((i) => assert(i >= C.start && i < C.end, `${x.t} : étape ${i} hors du chapitre`));
    assert(x.g.length >= 1 && x.g.length <= 4, `${x.t} : 1 à 4 objectifs`);
    [...x.in, x.out].forEach((t) => assert(t.length <= 200, `${x.t} : réplique trop longue (${t.length})`));
    if (x.npc) assert(E.HIST_NPC[x.npc], `${x.t} : personnage ${x.npc}`); });
  assert(SC.filter((x) => x.ch === 0).every((x) => x.in.length && x.out), "chapitre 1 écrit"); }
console.log(`ok - ${SC.length} scènes couvrent les ${Q.length} étapes, chapitres respectés, répliques courtes`);

// objectifs en parallèle et mêmes récompenses
{ const S = s1(); const sc = E.histScene(S); assert.strictEqual(sc.n, 0); assert.deepStrictEqual(sc.g, [0, 1, 2]);
  assert.strictEqual(E.questStep(S), Q[0], "l'objectif mis en avant est le premier de la scène");
  const k0 = S.kamas; S.chars[0].lvl = 5; E.histCheck(S);
  assert(E.hist(S).d.includes(1), "niveau 5 fini avant la chasse"); assert.strictEqual(S.kamas - k0, E.questReward(1).kamas, "même récompense que l'étape");
  assert.strictEqual(S.quest.step, 1); assert.strictEqual(E.questStep(S), Q[0]);
  E.emit(S, "win", { sub: "inc_route", mons: new Array(10).fill({ key: "x" }) });
  assert(E.hist(S).d.includes(0), "chasse comptée"); assert.strictEqual(S.quest.step, 2);
  E.emit(S, "win", { sub: "inc_foret", mons: new Array(30).fill({ key: "x" }) });
  assert.strictEqual(E.hist(S).p[3], undefined, "une scène à venir ne compte pas encore"); }
console.log("ok - objectifs d'une scène en parallèle, récompense de l'étape, scène suivante pas encore comptée");

// fin de scène, boosters, fin du chapitre 1 et seuils gardés
{ const S = s1(); 
  const done = (i) => { const q = Q[i]; if (q.t === "boss") S.progress.bossKills[q.dg] = 1; };
  let b0 = E.boosterLeft(S);
  for (let n = 0; n < 10; n++) {
    const sc = E.histScene(S); assert.strictEqual(sc.ch, 0);
    S.chars[0].lvl = 50; S.align = S.align || { side: "bonta" };
    sc.g.forEach((i) => { done(i); const q = Q[i]; const T = E.hist(S); if (["kill", "harvest", "craft", "brk", "bounty", "fm", "almanax", "havre", "equip"].includes(q.t)) T.p[i] = q.n || 1; });
    // équipement et Havre-Sac : état du jeu, on le force pour le test
    if (sc.g.some((i) => Q[i].t === "equip")) E.histGoalProg = ((f) => (S2, i) => (Q[i].t === "equip" || Q[i].t === "havre" ? [1, 1] : f(S2, i)))(E.histGoalProg);
    if (sc.g.some((i) => Q[i].t === "havre")) E.histGoalProg = ((f) => (S2, i) => (Q[i].t === "havre" ? [1, 1] : f(S2, i)))(E.histGoalProg);
    E.histCheck(S);
    assert.strictEqual(E.hist(S).sc, n + 1, `scène ${n + 1} finie`);
    if (n === 2) assert(E.sabUnlocked(S), "Sablier ouvert après la crypte de Kardorim (étape 6)");
  }
  assert.strictEqual(S.quest.step, E.MAIN_CH1, "chapitre 1 : 22 étapes");
  assert(E.questChapterDone(S, 0)); assert.strictEqual(E.histScene(S).ch, 1);
  const got = E.boosterLeft(S) - b0; assert.strictEqual(got, Math.min(E.BOOSTER_MAX, 10 * E.HIST_BOOST + E.HIST_BOOST_CH), "2 boosters par scène + 3 en fin de chapitre"); }
console.log("ok - 10 scènes du chapitre 1 : boosters, Sablier à l'étape 6, chapitre 1 = 22 étapes");

// Éternel : rien ne change
{ const S = E.newState("Héros", "iop"); E.refreshSystems(S); assert.strictEqual(E.histOn(S), false);
  S.chars[0].lvl = 5; E.emit(S, "win", { sub: "inc_route", mons: new Array(10).fill({ key: "x" }) });
  assert.strictEqual(S.hist, undefined); assert(S.quest.step >= 1, "l'Éternel garde ses étapes à la suite"); }
console.log("ok - Éternel : quête principale inchangée");

// quêtes de région (Saison 1, 5A) : un choix à la fin, son titre, 2 boosters ; l'Éternel finit comme avant
{ const S = s1(); const R = E.REGION.incarnam; const T = E.rqState(S, "incarnam"); T.i = R.steps.length - 1;
  assert.strictEqual(E.rqClaim(S, "incarnam"), "Fais ton choix pour finir la quête.");
  const b0 = E.boosterLeft(S), k0 = S.kamas;
  assert.strictEqual(E.act(S, "rqClaim", "incarnam", "b"), null);
  assert.strictEqual(T.ch, "b"); assert(S.titlesExtra.includes(E.RQ_S1.incarnam.b[1])); assert(!S.titlesExtra.includes(E.regionTitle(R)), "le titre du choix remplace « l'Ami de … »");
  assert.strictEqual(S.kamas - k0 >= E.rqFinalRew(R), true, "mêmes kamas"); assert.strictEqual(E.boosterLeft(S) - b0, E.RQ_BOOST);
  Object.values(E.RQ_S1).forEach((x) => { [...x.in, x.q, x.a[2], x.b[2]].forEach((t) => assert(t.length <= 200)); [x.a[1], x.b[1]].forEach((t) => assert(t.length <= 40)); });
  assert.deepStrictEqual(Object.keys(E.RQ_S1).sort(), E.REGIONS.map((x) => x.id).sort(), "un texte par région");
  const S2 = E.newState("Héros", "iop"); E.refreshSystems(S2); const T2 = E.rqState(S2, "incarnam"); T2.i = R.steps.length - 1;
  assert.strictEqual(E.rqClaim(S2, "incarnam"), null); assert(S2.titlesExtra.includes(E.regionTitle(R)), "Éternel : titre d'avant"); }
console.log("ok - quêtes de région de la Saison 1 : choix obligatoire, titre du choix, 2 boosters ; Éternel inchangé");

// campagne de saison : un chapitre par semaine, rattrapable dans l'ordre, objectifs comptés, bonus du serveur
{ const DAY = 86400000; const t0 = now; const S = s1();
  assert.strictEqual(E.campCur(S), 0); assert.strictEqual(E.campOpen(S, 1), false, "le chapitre 2 attend la semaine 2");
  const b0 = E.boosterLeft(S); const C = E.CAMP[0];
  for (let i = 0; i < C.g.dj; i++) E.emit(S, "dungeon", { id: "crypte_kardorim" });
  E.emit(S, "harvest", { n: C.g.harvest }); assert.strictEqual(E.camp(S).c, 0, "pas encore les avis");
  const b1 = E.boosterLeft(S); void b0; // (les donjons donnent aussi leurs boosters : on compte à partir d'ici)
  for (let i = 0; i < C.g.bounty; i++) E.emit(S, "bounty", {});
  assert.strictEqual(E.camp(S).c, 1, "chapitre 1 fini"); assert.strictEqual(E.boosterLeft(S) - b1, E.CAMP_BOOST);
  assert.strictEqual(E.campCur(S), -1, "chapitre 2 pas encore ouvert");
  assert.strictEqual(E.campBonus(S, 0, E.CAMP_GOAL - 1), false); assert.strictEqual(E.campBonus(S, 0, E.CAMP_GOAL), true); assert.strictEqual(E.campBonus(S, 0, 99), false, "une seule fois");
  now = t0 + 7 * DAY; assert.strictEqual(E.campCur(S), 1, "semaine 2 : chapitre 2");
  now = t0 + 30 * DAY; assert.strictEqual(E.campCur(S), 1, "en retard : on reprend où on en était");
  E.CAMP.forEach((c) => [...c.in, c.out].forEach((t) => assert(t.length <= 200)));
  now = t0; }
console.log("ok - campagne de saison : un chapitre par semaine, objectifs, 3 boosters, rattrapage, bonus du serveur une fois");

// coffre du jour (4A) : 5 tâches au choix, un Coffre en argent par jour, Saison 1 seulement
{ const S = s1(); assert.strictEqual(E.dchDone(S), 0);
  assert(E.act(S, "dchClaim"), "pas encore 5 tâches");
  for (let i = 0; i < 3; i++) E.emit(S, "bounty", {});
  for (let i = 0; i < 5; i++) E.emit(S, "dungeon", { id: "crypte_kardorim" });
  E.emit(S, "harvest", { n: 300 }); E.emit(S, "mission", { ok: true });
  assert.strictEqual(E.dchDone(S), 4); assert(E.act(S, "dchClaim"));
  E.dch(S).t0 -= 1; // un trésor trouvé aujourd'hui
  assert.strictEqual(E.dchDone(S), 5); const c0 = S.cons[E.DCH_CHEST] || 0;
  assert.strictEqual(E.act(S, "dchClaim"), null); assert.strictEqual((S.cons[E.DCH_CHEST] || 0) - c0, 1);
  assert(E.act(S, "dchClaim"), "une fois par jour");
  const DAY = 86400000; now += DAY; assert.strictEqual(E.dchDone(S), 0, "tout repart à minuit"); now -= DAY;
  const S2 = E.newState("Héros", "iop"); E.refreshSystems(S2); assert(E.act(S2, "dchClaim"), "Éternel : pas de coffre du jour"); }
console.log("ok - coffre du jour : 5 tâches au choix, un coffre par jour, rien dans l'Éternel");
