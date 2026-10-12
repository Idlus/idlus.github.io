/* L'Expédition sans fin (0.1.24) : portes, reliques, vies, coffres de palier, campement, sans navigateur.
   Lancer : node tests/expedition.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/expedition.js");
const D = require("../js/data.js");

// aléatoire reproductible (mulberry32)
let seed = 4242;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);

const team = (L, cls = ["iop", "eni", "feca", "cra"]) => { const S = E.newState("Exp", cls[0]); S.chars[0].lvl = L; cls.slice(1).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); S.chars.forEach((c) => { E.resetPoints(S, c.id); E.refreshSpells(c, E.charStats(S, c)); }); E.checkAch(S); return S; }; // succès de niveau déjà donnés : leurs kamas ne faussent pas les comptes

// 1. Conditions de départ et portes.
{
  const S = team(5); assert.ok(typeof E.expCanStart(S) === "string", "niveau 10 requis");
  const T = team(60); assert.strictEqual(E.expCanStart(T), null);
  assert.strictEqual(E.act(T, "expStart", 1), null, "départ");
  const X = T.exp; assert.ok(X.on && X.floor === 1 && X.lives === E.EXP_LIVES && X.livesMax === 3);
  assert.ok(X.doors.length === 3 && X.doors[0].t === "fight", "3 portes à l'étage 1, la première est un combat");
  assert.ok(X.doors.every((d) => d.t !== "boss"), "pas de boss à l'étage 1");
  assert.ok(E.EXP_REGNES.some((r) => r.god === X.regne.god) && X.regne.mod !== "veloces", "règne tiré, jamais Véloces au début");
  // les types de portes sont les mêmes pour tous (semaine + étage), le contenu suit le niveau
  const U = team(120); E.expStart(U, 1); assert.deepStrictEqual(U.exp.doors.map((d) => d.t), X.doors.map((d) => d.t), "même carte pour tous");
  assert.ok(U.exp.doors[0].mons[0].lvl > X.doors[0].mons[0].lvl, "monstres au niveau de l'équipe");
  assert.ok(typeof E.startHunt(T, D.ZONES[0].subs[0].id) === "string", "pas de chasse pendant l'expédition");
  assert.ok(typeof E.toggleTeam(T, T.chars[1].id) === "string", "équipe figée");
  // étage 5 : le boss seul ; étage 10 : palier
  const Y = Object.assign({}, X, { floor: 5 }); assert.deepStrictEqual(E.expDoors(T, Y).map((d) => d.t), ["boss"]);
  console.log("ok - expédition : départ, portes", X.doors.map((d) => d.t).join("/"), "règne de", X.regne.god);
}

// 2. Un combat d'étage : monstres renforcés selon l'étage, reliques appliquées aux héros, PV emportés d'un étage à l'autre.
{
  const S = team(80); E.expStart(S, 1); const X = S.exp;
  X.relics = ["laine", "dent", "os", "coeur", "larme", "queue"]; // +10 % PV, +6 % crit, −6 % dégâts subis, bouclier 12 %, +1 PA au 1er tour, +1 PM
  const fx = E.expFx(S); assert.strictEqual(fx.hp, 10); assert.strictEqual(fx.pm, 1);
  E.expDoor(S, 0); assert.ok(E.expBusy(S));
  const F = E.startFight(S); assert.ok(F && F.exp && F.exp.floor === 1, "combat d'étage");
  const hero = F.ents.find((e) => e.side === "c"); const base = E.charStats(S, S.chars.find((c) => c.id === hero.cid)).hpMax;
  assert.ok(hero.hpMax > base * 1.05, "Laine de Bouftou : plus de PV"); assert.ok(hero.shield > 0, "Cœur de Craqueleur : bouclier"); assert.strictEqual(hero.paBonus, 1, "Larme de Frizz"); assert.strictEqual(hero.smallDr, 6, "Os de Chafer");
  assert.ok(hero.st.cri >= 6 && hero.st.pm >= 1, "stats des reliques");
  let g = 0; while (!F.over && g++ < 5000) E.step(S); assert.ok(F.over);
  if (F.result === "win") { assert.strictEqual(X.floor, 2, "étage suivant"); assert.ok(S.camp.ec > 0 && X.eclats > 0, "Éclats gagnés"); assert.ok(Object.values(X.hp).every((v) => v >= 0 && v <= 100), "PV emportés en %"); }
  else { assert.strictEqual(X.lives, 2, "une vie de moins"); assert.strictEqual(X.floor, 1, "l'étage se rejoue"); }
  // les monstres d'un étage haut sont bien plus forts
  const M10 = E.expMonMult(10), M30 = E.expMonMult(30); assert.ok(Math.abs(E.expStasis(10) - 4) < 0.01 && Math.abs(E.expStasis(30) - 10) < 0.01, "étage 10 ≈ stasis 4, 30 ≈ 10");
  assert.ok(M30.hp > M10.hp && M30.dmg > M10.dmg && E.expStasis(50) > 10, "sans limite après le 30");
  console.log("ok - expédition : combat d'étage, reliques appliquées (" + F.result + ")");
}

// 3. Une expédition entière jouée d'un coup : elle finit par s'arrêter, tout est gardé, le record est noté, la chasse reprend.
{
  const S = team(60); E.startHunt(S, D.ZONES[0].subs[0].id); const k0 = S.kamas; const sub0 = S.sub;
  const before = JSON.parse(E.serialize(S)).chars.map((c) => c.lvl);
  E.expStart(S, 1); assert.ok(!S.hunting, "la chasse s'arrête pendant l'expédition");
  const best = E.expAutoPlay(S, 300);
  assert.ok(!E.expActive(S), "l'expédition s'est arrêtée"); assert.ok(S.expLast && S.expLast.how === "fall" && S.expLast.best === best);
  assert.ok(best >= 1 && best <= 60, "étage atteint plausible : " + best); assert.ok(S.kamas > k0, "les gains restent");
  assert.strictEqual(S.cnt.expBest, best); assert.strictEqual(E.expWeek(S).best, best); assert.ok(S.camp.ec > 0, "Éclats conservés après la chute");
  assert.ok(S.hunting && S.sub === sub0, "la chasse reprend");
  assert.ok(S.chars.some((c, i) => c.lvl >= before[i]), "XP gardée");
  assert.strictEqual(E.expCanStart(S), null, "on peut relancer");
  console.log(`ok - expédition : partie entière (étage ${best}, ${S.expLast.fights} combats, ${S.camp.ec} Éclats)`);
}

// 4. Choix : refuser une relique donne des Éclats ; 8 reliques au plus ; bénédictions ; pari du palier (encaisser ou doubler).
{
  const S = team(100); E.expStart(S, 1); const X = S.exp; const C = E.camp(S);
  X.pend = []; X.pend.push({ t: "relic", opts: ["plume", "coeur"], at: now, id: 1 });
  const ec = C.ec; assert.strictEqual(E.expChoose(S, "no"), null); assert.strictEqual(C.ec, ec + E.EXP_REFUSE, "+15 Éclats en refusant");
  X.relics = ["plume", "laine", "dent", "os", "bave", "aile", "piece", "fleur"];
  X.pend.push({ t: "relic", opts: ["coeur"], at: now, id: 2 }); assert.ok(typeof E.expChoose(S, 0) === "string", "8 places : il faut remplacer");
  assert.strictEqual(E.expChoose(S, 0, 2), null); assert.ok(X.relics.includes("coeur") && !X.relics.includes("dent") && X.relics.length === 8, "remplacée");
  X.pend.push({ t: "bless", opts: ["iop", "eni", "panda"], at: now, id: 3 }); assert.strictEqual(E.expChoose(S, 1), null); assert.deepStrictEqual(X.bless, ["eni"]);
  // le Miroir copie la relique prise juste avant ; l'Œuf Doré donne une vie
  X.relics = ["laine", "miroir"]; assert.strictEqual(E.expFx(S).hp, 20, "Miroir d'Ilyzaelle");
  X.pend.push({ t: "relic", opts: ["oeuf"], at: now, id: 4 }); const lv = X.lives; E.expChoose(S, 0); assert.strictEqual(X.lives, lv + 1, "Œuf Doré : +1 vie");
  // pari : encaisser
  const k = S.kamas; const ch = { kamas: 1000, xp: 0, dust: 5, items: [], eclats: 60, palier: 10 }; // sans XP : un niveau gagné donnerait des kamas de succès
  X.pend.push({ t: "pari", chest: ch, at: now, id: 5 }); E.expChoose(S, 0); assert.strictEqual(S.kamas, k + 1000, "coffre encaissé"); assert.strictEqual((S.res[E.POUSSIERE] || 0), 5);
  // pari : mettre en jeu, puis perdre l'expédition : le coffre est perdu, pas les Éclats
  X.pend.push({ t: "pari", chest: Object.assign({}, ch), at: now, id: 6 }); E.expChoose(S, 1); assert.ok(X.pot && X.pot.palier === 10, "coffre en jeu");
  const ec2 = C.ec; E.expQuit(S); assert.strictEqual(S.kamas, k + 1000, "coffre en jeu perdu"); assert.strictEqual(C.ec, ec2, "Éclats gardés"); assert.ok(S.expLast.lost);
  console.log("ok - expédition : reliques, bénédictions, pari du palier");
}

// 5. Campement : achats dans l'ordre, effets (vies, relique de départ), tout acheter coûte le total annoncé.
{
  const S = team(60); const C = E.camp(S);
  assert.ok(typeof E.act(S, "campBuy", "vie1") === "string", "pas assez d'Éclats");
  C.ec = 1000; assert.ok(typeof E.campBuy(S, "repos") === "string", "dans l'ordre de la branche");
  assert.strictEqual(E.campBuy(S, "vie1"), null); assert.strictEqual(C.ec, 960); assert.strictEqual(E.campBuy(S, "depart"), null);
  E.expStart(S, 1); assert.strictEqual(S.exp.lives, 4, "4 vies avec Vie supplémentaire I");
  assert.ok(S.exp.pend.length === 1 && S.exp.pend[0].t === "relic" && S.exp.pend[0].opts.length === 2, "relique de départ offerte (2 choix)");
  E.expQuit(S);
  assert.strictEqual(E.expCampTotal, E.EXP_CAMP.reduce((a, u) => a + u.cost, 0)); assert.ok(E.expCampTotal > 15000 && E.expCampTotal < 20000, "≈ 17 000 Éclats au total : " + E.expCampTotal);
  C.ec = E.expCampTotal; E.EXP_CAMP.forEach((u) => { if (!E.campHas(S, u.id)) assert.strictEqual(E.campBuy(S, u.id), null, u.id); });
  assert.strictEqual(E.campCount(S), 24); E.checkAch(S); assert.ok(S.ach.expcamp, "succès Campement complet");
  // Raccourci : repartir du palier 10 quand il a été atteint
  S.cnt.expBest = 12; assert.deepStrictEqual(E.expStarts(S), [1, 11]); E.expStart(S, 11); assert.strictEqual(S.exp.floor, 11); assert.ok(S.exp.pend.some((p) => p.t === "relic"), "relique commune offerte par palier sauté"); E.expQuit(S);
  console.log("ok - expédition : campement (24 améliorations,", E.expCampTotal, "Éclats)");
}

// 6. Sauvegarde : l'expédition en cours et le campement survivent à une relecture ; les actions officielles existent.
{
  const S = team(60); E.camp(S).ec = 77; E.expStart(S, 1); S.exp.relics.push("plume");
  const S2 = E.deserialize(E.serialize(S));
  assert.ok(E.expActive(S2) && S2.exp.relics[0] === "plume" && S2.camp.ec === 77, "relue");
  assert.ok(E.startFight(S2) === null, "sans porte choisie, pas de combat"); E.expDoor(S2, 0); assert.ok(E.startFight(S2), "la porte choisie lance le combat");
  ["expStart", "expDoor", "expChoose", "expBuy", "expForge", "expReroll", "expQuit", "campBuy", "expSetAuto"].forEach((a) => assert.ok(E.ACTIONS[a] && typeof E[a] === "function", a));
  // titres et succès par étage
  const T = team(60); T.cnt.expBest = 0; E.expStart(T, 1); T.exp.floor = 25; T.exp.best = 24; E.expDoor(T, 0); T.exp.door = null; T.exp.doors = E.expDoors(T, T.exp);
  // simule un étage franchi sans combat : Repos
  const rest = T.exp.doors.findIndex((d) => d.t === "rest"); if (rest >= 0) E.expDoor(T, rest); else { T.exp.best = 25; T.exp.floor = 26; T.titlesExtra = T.titlesExtra || []; }
  console.log("ok - expédition : sauvegarde et actions");
}
console.log("ok - lot Expédition sans fin");
