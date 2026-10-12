/* Test du moteur sans navigateur : une partie neuve par classe, un combat complet,
   puis quelques minutes de chasse simulées. Lancer : node tests/fight.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
require("../js/pets.js");
require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const D = require("../js/data.js");

// aléatoire reproductible (mulberry32)
let seed = 12345;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });

const firstSub = D.ZONES[0].subs[0].id;

for (const cls of D.CLASS_ORDER) {
  const S = E.newState("Test", cls);
  assert.strictEqual(E.startHunt(S, firstSub), null, `${cls} : chasse impossible`);
  E.startFight(S);
  const F = S.fight;
  assert.ok(F && F.ents.some((e) => e.side === "m"), `${cls} : aucun monstre`);
  let steps = 0;
  while (!F.over && steps++ < 5000) E.step(S);
  assert.ok(F.over, `${cls} : le combat ne se termine pas`);
  assert.strictEqual(S.stats.fights, 1, `${cls} : combat non compté`);
  assert.ok(["win", "lose"].includes(F.result), `${cls} : résultat inconnu`);
  for (const e of F.ents) assert.ok(Number.isFinite(e.hp), `${cls} : PV invalides pour ${e.name}`);
}
console.log(`ok - un combat par classe (${D.CLASS_ORDER.length} classes)`);

// 10 minutes de chasse en boucle avec E.tick, puis sauvegarde / chargement
const S = E.newState("Test", "iop");
E.startHunt(S, firstSub);
for (let t = 0; t < 10 * 60 * 1000; t += 250) E.tick(S, 250);
assert.ok(S.stats.fights > 5, `trop peu de combats : ${S.stats.fights}`);
assert.ok(S.stats.wins > 0, "aucune victoire en 10 minutes à Incarnam");
assert.ok(S.chars[0].xp > 0 || S.chars[0].lvl > 1, "aucune expérience gagnée");
const back = E.deserialize(E.serialize(S));
assert.strictEqual(back.stats.fights, S.stats.fights, "sauvegarde / chargement incohérents");
console.log(`ok - 10 min de chasse simulée : ${S.stats.wins}/${S.stats.fights} victoires, niveau ${S.chars[0].lvl}`);

// 3.2.3 : répartition manuelle, retrait de points et retour en automatique sans perte
{
  const R = E.newState("Test", "iop"); const c = R.chars[0]; c.lvl = 40; E.resetPoints(R, c.id);
  const total = (x) => x.pts + ["vit", "sa", "fo", "ine", "cha", "age"].reduce((a, k) => { let s = 0; for (let i = 0; i < x.alloc[k]; i++) s += E.pointCost(k, i); return a + s; }, 0);
  assert.strictEqual(total(c), 195, "points de départ incohérents");
  const main = c.autoStat; E.setAllocMode(R, c, false);
  assert.strictEqual(c.autoStat, null, "le mode manuel n'est pas activé");
  E.deallocate(R, c.id, main, 30); E.allocate(R, c.id, "vit", 5);
  assert.strictEqual(total(c), 195, "retirer des points en perd ou en crée");
  E.setAllocMode(R, c, true);
  assert.strictEqual(c.autoStat, main, "le retour en automatique ne retrouve pas la caractéristique");
  assert.ok(c.pts < E.pointCost(main, c.alloc[main]) && total(c) === 195, "le retour en automatique ne dépense pas les points");
  console.log("ok - répartition manuelle et retour en automatique");
}

// 0.1 : chaque mécanique de boss tourne jusqu'au bout sans erreur
{
  const realMechs = E.bossMechs, realUnl = E.dungeonUnlocked;
  E.dungeonUnlocked = () => true;
  const did = "labo_nileza"; const dg = D.DUNGEONS[did];
  for (const k of Object.keys(E.BOSS_MECHS)) {
    E.bossMechs = () => [k];
    const S2 = E.newState("Test", "iop"); S2.chars = [];
    ["iop", "eni", "feca", "cra"].forEach((c, i) => { const x = E.addChar(S2, c, "H" + i, 190); x.inTeam = true; E.refreshSpells(x, E.charStats(S2, x)); });
    S2.res[dg.key] = 1; assert.strictEqual(E.enterDungeon(S2, did, 1), null, `${k} : entrée impossible`);
    S2.dungeon.room = dg.rooms.length; E.startFight(S2); const F = S2.fight;
    assert.ok(F.ents.some((e) => e.mech && e.mech.includes(k)), `${k} : mécanique absente`);
    let n = 0; while (!F.over && n++ < 20000) E.step(S2);
    assert.ok(F.over, `${k} : le combat ne se termine pas`);
    for (const e of F.ents) assert.ok(Number.isFinite(e.hp), `${k} : PV invalides pour ${e.name}`);
  }
  E.bossMechs = realMechs; E.dungeonUnlocked = realUnl;
  console.log(`ok - ${Object.keys(E.BOSS_MECHS).length} mécaniques de boss jouées jusqu'au bout`);
}
// 0.1 : rôles des monstres en chasse de haut niveau
{
  const sub = Object.values(E.SUBS).find((s) => s.lvl[0] >= 150 && s.monsters.some((m) => E.monRole(m, 200)));
  const S3 = E.newState("Test", "iop"); S3.chars = [];
  ["iop", "eni", "feca", "cra"].forEach((c, i) => { const x = E.addChar(S3, c, "H" + i, 190); x.inTeam = true; E.refreshSpells(x, E.charStats(S3, x)); });
  E.subUnlocked = () => true; E.startHunt(S3, sub.id);
  for (let t = 0; t < 5 * 60 * 1000; t += 250) E.tick(S3, 250);
  assert.ok(S3.stats.fights > 0, "aucun combat de haut niveau");
  console.log(`ok - chasse de haut niveau (${sub.name}) : ${S3.stats.wins}/${S3.stats.fights} victoires`);
}
// 0.1 : mutateur éclair, 3 donjons par créneau, et chaque modificateur joue une course complète
{
  const realUnl = E.dungeonUnlocked; E.dungeonUnlocked = () => true;
  const S4 = E.newState("Test", "iop"); S4.chars = [];
  const L = E.flash(S4); assert.strictEqual(L.length, 3, "le mutateur éclair doit proposer 3 donjons");
  E.FLASH_TIERS.forEach(([, lo, hi], i) => assert.ok(D.DUNGEONS[L[i].did].lvl >= lo && D.DUNGEONS[L[i].did].lvl <= hi, "donjon hors de sa tranche"));
  assert.ok(new Set(L.map((x) => x.mod)).size === 3, "3 modificateurs différents");
  const realFlash = E.flash;
  for (const mod of E.FLASH_MODS) {
    E.flash = () => [{ did: "labo_nileza", mod }];
    const S5 = E.newState("Test", "iop"); S5.chars = [];
    ["iop", "eni", "feca", "cra"].forEach((c, i) => { const x = E.addChar(S5, c, "H" + i, 200); x.inTeam = true; E.refreshSpells(x, E.charStats(S5, x)); });
    S5.res[D.DUNGEONS.labo_nileza.key] = 1; assert.strictEqual(E.enterDungeon(S5, "labo_nileza", 1), null);
    assert.ok(S5.dungeon.flash === mod && S5.dungeon.mods.includes(mod), `${mod} : modificateur absent`);
    for (let t = 0; S5.dungeon && t < 3 * 3600 * 1000; t += 1000) E.tick(S5, 1000);
    assert.ok(!S5.dungeon, `${mod} : la course ne se termine pas`);
  }
  E.flash = realFlash; E.dungeonUnlocked = realUnl;
  console.log(`ok - mutateur éclair : ${L.map((x) => x.mod).join(", ")} ; ${E.FLASH_MODS.length} modificateurs joués jusqu'au bout`);
}
// 0.1.8 : familiers et montiliers (repas, croissance, stats, obtention, sauvegarde)
{
  const S6 = E.newState("Test", "iop"); const c = S6.chars[0]; c.lvl = 70;
  const ids = Object.keys(E.PETS); assert.ok(ids.length >= 140, "familiers manquants");
  ids.forEach((id) => { const p = E.PETS[id]; assert.ok(p.icon && Object.keys(p.stats).length, id + " sans icône ou bonus"); for (const k in p.stats) assert.ok(D.STATS[k], `${id} : stat inconnue ${k}`); assert.ok(p.kind === "zone" ? E.SUBS[p.sub] : D.DUNGEONS[p.dg], id + " sans lieu"); });
  const before = E.charStats(S6, c).age;
  const P = E.givePet(S6, "siroko"); assert.strictEqual(c.pet, P.uid, "le montilier doit être porté d'office");
  assert.ok(E.charStats(S6, c).age > before, "le montilier doit donner de l'Agilité");
  S6.res["Blé"] = 1000; S6.petKeep["Blé"] = true; E.petTick(S6, 3 * 3600e3); assert.strictEqual(P.g, 0, "une ressource protégée ne se mange pas");
  delete S6.petKeep["Blé"]; E.petTick(S6, 10 * 3600e3); assert.strictEqual(P.g, 20, "20 repas en 10 h");
  const S7 = E.deserialize(E.serialize ? E.serialize(S6) : JSON.stringify(S6)); assert.ok(S7.pets[P.uid] && S7.chars[0].pet === P.uid, "familier perdu à la sauvegarde");
  const old = JSON.parse(JSON.stringify(S6)); delete old.pets; delete old.petKeep; delete old.petLuck; delete old.petUid; delete old.chars[0].pet; const S8 = E.deserialize(JSON.stringify(old)); assert.ok(S8.pets && S8.petKeep && S8.petUid === 1, "ancienne sauvegarde sans familiers");
  let n = 0; for (let i = 0; i < 60; i++) { const o = []; E.petBoss(S6, "plateau_ush", 6, o); n += o.length; } assert.ok(n >= 1, "garantie du montilier à la 60e victoire");
  console.log(`ok - familiers : ${ids.length} familiers et montiliers, repas, croissance, garantie`);
}
// 0.1.9 : montures (données, capture, part d'XP, enclos, sauvegarde)
{
  const S9 = E.newState("Test", "iop"); const c = S9.chars[0]; c.lvl = 70; c.inTeam = true;
  let n = 0; for (const sp in E.MOUNTS) for (const col in E.MOUNTS[sp].cols) { n++; const st = E.mountStatsMax(sp, col); for (const k in st) assert.ok(D.STATS[k], `${sp} ${col} : stat inconnue ${k}`); assert.ok(E.MOUNTS[sp].cols[col].icon, `${sp} ${col} sans icône`); }
  assert.strictEqual(n, 41, "41 couleurs"); assert.strictEqual(Object.keys(E.MOUNTS.dd.bico).length, 55, "55 bicolores de dragodinde");
  for (const sp in E.MOUNTS) assert.ok(E.SUBS[E.MOUNT_SP[sp].sub], sp + " : zone sauvage inconnue");
  // capture : jamais sans filet, le filet ne part qu'à la capture
  const realRnd = E.rnd; E.rnd = () => 0;
  assert.strictEqual(E.mountHunt(S9, "can_plaines"), null, "pas de capture sans filet");
  E.addCons(S9, "filet", 2); const M = E.mountHunt(S9, "can_plaines"); assert.ok(M && M.sp === "dd" && M.lvl === 1, "capture d'une dragodinde"); assert.strictEqual(S9.cons.filet, 1, "un filet utilisé");
  assert.strictEqual(E.mountHunt(S9, "ama_campagne"), null, "pas de capture hors zone sauvage");
  E.rnd = realRnd;
  // monter, bonus, part d'XP
  assert.strictEqual(E.equipMount(S9, c.id, M.uid), null, "monter la dragodinde"); const v0 = E.charStats(S9, c).vit;
  M.lvl = 50; assert.strictEqual(E.charStats(S9, c).vit - v0 + E.mountStatsAt(Object.assign({}, M, { lvl: 1 })).vit, 150, "+150 Vitalité au niveau 50");
  M.lvl = 1; M.xp = 0; const kept = 10000 - E.mountXpShare(S9, c, 10000); assert.strictEqual(kept, 6000, "part de 40 % par défaut"); assert.ok(M.xp === 4000 || M.lvl > 1, "la monture reçoit l'XP");
  c.lvl = E.MAX_LVL; assert.strictEqual(E.mountShare(S9, c), 100, "héros 200 : toute l'XP"); c.lvl = 70;
  E.giveMountXp(S9, M, 1e9); assert.strictEqual(M.lvl, 100, "niveau 100"); assert.strictEqual(c.mountShare, 0, "part remise à 0 au niveau 100"); assert.strictEqual(E.charStats(S9, c).vit - v0 + E.mountStatsAt(Object.assign({}, M, { lvl: 1 })).vit, 300, "+300 Vitalité au niveau 100");
  // montilier : la place de la monture est prise
  E.givePet(S9, "siroko"); assert.strictEqual(E.mountStats(S9, c), null, "le montilier bloque la monture"); E.equipPet(S9, c.id, null);
  // enclos : recette Rousse + Dorée = Indigo ; naissance après 8 h, même hors ligne
  S9.kamas = 100000; assert.strictEqual(E.buildEnclos(S9), null, "enclos construit"); assert.strictEqual(E.stableCap(S9), 20, "20 places avec l'enclos");
  const A = E.giveMount(S9, "dd", "Rousse", ""), B = E.giveMount(S9, "dd", "Dorée", ""); A.lvl = B.lvl = 60;
  assert.strictEqual(E.childOf("dd", "Rousse", "Dorée"), "Indigo", "recette Indigo"); assert.ok(E.nextCrosses(S9, "dd").some((x) => x.c === "Indigo" && x.ok), "le carnet propose Indigo");
  assert.strictEqual(E.startBreed(S9, A.uid, B.uid), null, "couple à l'enclos"); assert.ok(E.startBreed(S9, A.uid, B.uid), "déjà à l'enclos");
  const before = E.stableN(S9); E.enclosTick(S9, 7 * 3600e3); assert.strictEqual(E.stableN(S9), before, "pas encore né"); E.catchUp(S9, 2 * 3600); assert.strictEqual(E.stableN(S9), before + 1, "naissance hors ligne"); assert.strictEqual(A.kids, 1, "un petit compté");
  const odds = E.breedOdds(S9, A, B); assert.strictEqual(odds.reduce((s, x) => s + x[1], 0), 100, "les chances font 100 %");
  assert.deepStrictEqual(Object.keys(E.mountStatsMax("dd", E.bicoKey("dd", "Rousse", "Amande"))).sort(), ["ini", "so", "vit"], "bicolore : les deux stats");
  const S10 = E.deserialize(E.serialize ? E.serialize(S9) : JSON.stringify(S9)); assert.ok(S10.mounts[M.uid] && S10.chars[0].mount === M.uid && S10.enclos.built, "montures perdues à la sauvegarde");
  const old = JSON.parse(JSON.stringify(S9)); delete old.mounts; delete old.mountUid; delete old.mountSeen; delete old.enclos; delete old.chars[0].mount; const S11 = E.deserialize(JSON.stringify(old)); assert.ok(S11.mounts && S11.enclos && !S11.enclos.built, "ancienne sauvegarde sans montures");
  assert.ok(D.SPECIAL_CRAFTS["Filet de capture"] && D.SPECIAL_CRAFTS["Filet de capture"].cons === "filet", "recette du filet");
  console.log(`ok - montures : ${n} couleurs, capture, part d'XP, enclos, sauvegarde`);
}

/* 0.1.10 : idoles */
{
  const S = E.newState("Idoles", "iop"); const c = S.chars[0]; c.lvl = 50; E.refreshSpells(c, E.charStats(S, c));
  assert.strictEqual(E.IDOL_ORDER.length, 36, "36 idoles"); assert.strictEqual(Object.keys(E.IDOL_FAMS).length, 9, "9 familles");
  for (const f in E.IDOL_FAMS) assert.strictEqual(E.idolsOf(f).length, 4, f + " : 4 idoles");
  for (const id of E.IDOL_ORDER) { const I = E.IDOLS[id]; const R = D.SPECIAL_CRAFTS[E.idolCraftName(id)]; assert.ok(R && R.idol === id && R.job === "bricoleur" && R.lvl === I.lvl && R.unique, id + " : recette du Bricoleur"); for (const [r] of R.ing) assert.ok(D.RES[r], `${id} : ressource inconnue ${r}`); assert.ok(I.score > 0 && I.desc, id + " : score et description"); }
  assert.strictEqual(E.IDOL_MAXSCORE, 205, "score maximal 205");
  // activation : à fabriquer d'abord, une par famille, 6 au plus
  assert.ok(E.toggleIdol(S, "hebdo"), "pas d'activation sans l'idole");
  E.giveIdol(S, "hebdo", ""); E.giveIdol(S, "walet", ""); E.giveIdol(S, "dynamo", ""); E.giveIdol(S, "farle", ""); E.giveIdol(S, "nocturne", ""); E.giveIdol(S, "dokoko", ""); E.giveIdol(S, "croum", ""); E.giveIdol(S, "hadibel", "");
  assert.ok(!E.giveIdol(S, "hebdo", ""), "jamais deux fois la même idole"); assert.strictEqual(S.cnt.idols, 8, "8 idoles possédées");
  assert.strictEqual(E.toggleIdol(S, "hebdo"), null, "Hebdo active"); assert.strictEqual(E.toggleIdol(S, "walet"), null, "Walet remplace Hebdo"); assert.deepStrictEqual(S.idols.active, ["walet"], "une seule idole de Vie");
  ["dynamo", "farle", "nocturne", "dokoko", "croum"].forEach((id) => assert.strictEqual(E.toggleIdol(S, id), null, id));
  assert.ok(E.toggleIdol(S, "hadibel"), "7e idole refusée"); assert.strictEqual(S.idols.active.length, 6, "6 actives");
  assert.strictEqual(E.idolScore(S, null), 40 + 10 + 15 + 15 + 15 + 15, "score 110"); assert.strictEqual(E.idolBonus(S, null), 55, "+55 % en chasse"); assert.strictEqual(E.idolBonus(S, { mods: [] }), 30, "+30 % au plafond du donjon");
  assert.strictEqual(E.idolScore(S, { mods: ["nombreux"] }), 95, "Farle ne compte pas avec le modificateur Nombreux");
  E.savePreset(S, 0, "Test"); E.clearIdols(S); assert.strictEqual(S.idols.active.length, 0, "tout retiré"); assert.strictEqual(E.loadPreset(S, 0), null, "jeu rechargé"); assert.strictEqual(S.idols.active.length, 6, "6 idoles rechargées"); assert.ok(E.loadPreset(S, 2), "jeu vide");
  // en combat : Walet double les PV des monstres, Farle ajoute un monstre, Ougah annule les soins
  const seed0 = seed; E.clearIdols(S); E.startHunt(S, firstSub); E.startFight(S); const F0 = S.fight; const hp0 = F0.ents.filter((e) => e.side === "m").map((e) => e.hpMax); S.fight = null; S.hunting = false;
  seed = seed0; E.toggleIdol(S, "walet"); E.toggleIdol(S, "farle"); E.startHunt(S, firstSub); E.startFight(S); const F1 = S.fight; const hp1 = F1.ents.filter((e) => e.side === "m").map((e) => e.hpMax);
  assert.ok(F1.idol && F1.idolScore === 55 && F1.idolBonus === 27.5, "idoles lues par le combat"); assert.ok(hp1.length >= hp0.length + 1 || hp1.length === 8, "un monstre de plus avec Farle");
  assert.ok(hp1[0] >= hp0[0] * 1.9, `Walet double les PV (${hp0[0]} → ${hp1[0]})`);
  let steps = 0; while (!F1.over && steps++ < 5000) E.step(S); assert.ok(F1.over, "le combat avec idoles se termine");
  if (F1.result === "win") { assert.ok(F1.rewards.idol && F1.rewards.idol.pct === 27.5, "bonus d'idoles dans les récompenses"); assert.strictEqual(S.cnt.idolBest, 55, "meilleur score enregistré"); }
  S.fight = null; S.hunting = false; E.clearIdols(S); E.giveIdol(S, "ougah", ""); E.toggleIdol(S, "ougah"); E.startHunt(S, firstSub); E.startFight(S); const F2 = S.fight; const hero = F2.ents.find((e) => e.side === "c"); hero.hp = 1;
  assert.strictEqual(E.doHeal(hero, 100, F2), 0, "Ougah : aucun soin"); assert.strictEqual(hero.hp, 1, "PV inchangés");
  S.fight = null; S.hunting = false; E.clearIdols(S);
  // risque et fabrication
  assert.ok(["easy", "mid", "risk"].includes(E.idolRisk(S, null, null).k), "risque calculé");
  S.crafts.bricoleur.lvl = 20; const R = D.SPECIAL_CRAFTS["Idole Dynamo"]; assert.ok(E.craftSpecial(S, "Idole Dynamo"), "Bricoleur 25 requis"); S.crafts.bricoleur.lvl = 25; R.ing.forEach(([r, q]) => E.addRes(S, r, q));
  assert.ok(E.craftSpecial(S, "Idole Dynamo"), "déjà possédée"); E.giveIdol(S, "tynril", ""); const T = D.SPECIAL_CRAFTS["Idole Tynril"]; T.ing.forEach(([r, q]) => E.addRes(S, r, q)); S.crafts.bricoleur.lvl = 30; assert.ok(E.craftSpecial(S, "Idole Tynril"), "fabrication refusée si déjà possédée");
  const K = D.SPECIAL_CRAFTS["Idole Kori"]; S.crafts.bricoleur.lvl = 85; K.ing.forEach(([r, q]) => E.addRes(S, r, q)); assert.strictEqual(E.craftSpecial(S, "Idole Kori"), null, "Kori fabriquée"); assert.ok(E.idolOwned(S, "kori"), "Kori dans la collection"); assert.ok(E.craftSpecial(S, "Idole Kori"), "Kori une seule fois");
  // sauvegarde et ancienne partie
  const S2 = E.deserialize(JSON.stringify(S)); assert.ok(S2.idols && S2.idols.own.kori && S2.idols.presets[0], "idoles perdues à la sauvegarde");
  const old = JSON.parse(JSON.stringify(S)); delete old.idols; const S3 = E.deserialize(JSON.stringify(old)); assert.ok(S3.idols && Array.isArray(S3.idols.active), "ancienne partie sans idoles");
  assert.ok(E.ACH.some((a) => a.id === "idol36" && a.title), "succès des idoles");
  console.log("ok - idoles : 36 idoles en 9 familles, activation, score et bonus, effets en combat, Bricoleur, sauvegarde");
}
/* 0.1.13 : archimonstres et Dofus */
{
  const S = E.newState("Archis", "iop"); const c = S.chars[0]; c.lvl = 100; E.refreshSpells(c, E.charStats(S, c)); E.refreshSystems(S);
  assert.strictEqual(E.ARCHI_TOTAL, 213, "213 archimonstres"); assert.strictEqual(E.ARCHI_ZONES.length, 13, "13 zones"); assert.strictEqual(E.DOFUS_ORDER.length, 18, "18 Dofus");
  assert.strictEqual(E.OCRE_TIERS.reduce((a, T, i) => a + E.ocreProgress(S, i)[1], 0), 213, "les six paliers couvrent tous les archimonstres");
  assert.ok(D.SPECIAL_CRAFTS["Pierre d'âme"].cons === "pierre_ame" && D.CONSUMABLES.pierre_ame.auto && D.CONSUMABLES.parfum_piste.boost === "piste", "recettes et consommables");
  for (const [n, R] of Object.entries(D.SPECIAL_CRAFTS)) if (/^Copie : /.test(n) || n === "Pierre d'âme" || n === "Parfum de pistage") for (const [r] of R.ing) assert.ok(D.RES[r], `${n} : ressource inconnue ${r}`);
  for (const id of E.DOFUS_ORDER) { const Df = E.DOFUS[id]; assert.ok(D.ITEMS[Df.tpl] && D.ITEMS[Df.tpl].slot === "dofus" && D.ITEMS[Df.tpl].icon, id + " : objet Dofus"); assert.ok(!Df.dg || D.DUNGEONS[Df.dg], id + " : donjon");
    for (const k in Df.stats) assert.ok(D.STATS[k], id + " : stat " + k); assert.ok(E.dofusBonusTxt(id), id + " : bonus");
    for (const st of Df.steps) { if (st.t === "dg") assert.ok(D.DUNGEONS[st.dg], id + " : donjon " + st.dg); if (st.t === "dgs") st.dgs.forEach((d) => assert.ok(D.DUNGEONS[d], id + " : donjon " + d));
      if (st.zone) assert.ok(E.ARCHI_ZONES.includes(st.zone), id + " : zone " + st.zone); if (st.chal) assert.ok(E.CHALLENGES[st.chal], id + " : challenge"); if (st.res) assert.ok(D.RES[st.res], id + " : ressource"); assert.ok(E.dofusStepTxt(st), id + " : texte d'étape"); } }
  // capture : sans pierre l'âme s'échappe, avec une pierre elle entre dans l'album, jamais deux fois
  const k0 = Object.keys(E.ARCHIS)[0]; const m = { key: k0, name: E.ARCHIS[k0].name };
  assert.strictEqual(E.captureSoul(S, m), "nostone", "pas de pierre"); E.addCons(S, "pierre_ame", 2);
  assert.strictEqual(E.captureSoul(S, m), "new", "âme capturée"); assert.strictEqual(E.stones(S), 1, "pierre consommée"); assert.strictEqual(E.captureSoul(S, m), "dup", "déjà capturée"); assert.strictEqual(S.cnt.souls, 1, "compteur d'âmes");
  // parfum ×2 et meuble ×1,4 sur les chances d'archimonstre
  const base = E.archiMult(S); S.boosts.piste = { pct: 100, until: Date.now() + 1e6 }; assert.ok(Math.abs(E.archiMult(S) / base - 2) < 1e-9, "parfum ×2"); delete S.boosts.piste;
  S.placed = S.placed || {}; S.placed.trophees = [E.ARCHI_FURN]; assert.ok(Math.abs(E.archiMult(S) / base - 1.4) < 1e-9, "autel ×1,4"); S.placed.trophees = [];
  // Éternelle moisson : tout Astrub capturé donne le palier 1
  E.addCons(S, "pierre_ame", 60); const kam = S.kamas; E.archisOf("astrub").forEach((a) => E.captureSoul(S, { key: a.k, name: a.name }));
  assert.strictEqual(E.ocreTier(S), 1, "palier 1 accompli"); assert.ok(S.kamas >= kam + 20000, "20 000 kamas du palier 1"); assert.strictEqual(E.stones(S), 1 + 60 - E.archisOf("astrub").filter((a) => a.k !== k0).length + 10, "10 pierres du palier 1");
  // Dofus : obtention, un exemplaire par héros, copie du Bricoleur seulement après l'original
  const it = E.giveDofus(S, "cacao", "test"); assert.ok(it && it.stats.tac === 10 && E.dofusOwned(S, "cacao") && S.cnt.dofus === 1, "Dofus Cacao donné");
  assert.strictEqual(E.equip(S, c.id, it.uid), null, "Dofus équipé"); const it2 = E.giveDofus(S, "cacao", "copie"); assert.ok(/déjà ce Dofus/.test(E.equip(S, c.id, it2.uid)), "pas deux fois le même Dofus");
  S.crafts.bricoleur = { lvl: 200, xp: 0 }; S.res[E.POUSSIERE] = 1000; assert.ok(/d'abord/.test(E.craftSpecial(S, "Copie : Dofus Vulbis")), "copie sans l'original refusée"); assert.strictEqual(E.craftSpecial(S, "Copie : Dofus Cacao"), null, "copie fabriquée"); assert.strictEqual(S.res[E.POUSSIERE], 925, "75 poussières");
  // quête : étape donjon validée par la meilleure stasis, étape chasse par les victoires dans la zone, Dofus donné à la fin
  E.stasisInfo(S, "cour_bouftou_royal").max = 3; E.emit(S, "dungeon", { id: "cour_bouftou_royal", stasis: 3, chals: [], down: 0 });
  assert.strictEqual(E.dofusQuest(S, "cacao").step, 1, "étape 1 du Cacao validée");
  const sub = Object.values(E.SUBS).find((s) => s.zone === "astrub"); for (let i = 0; i < 50; i++) E.emit(S, "win", { mons: [{ key: "m52" }, { key: "m52" }, { key: "m52" }], sub: sub.id, chals: [], down: 0 });
  assert.strictEqual(E.dofusQuest(S, "cacao").step, 2, "150 monstres d'Astrub"); const nb = Object.values(S.items).filter((x) => x.tpl === "dofus_cacao").length;
  E.stasisInfo(S, "cour_bouftou_royal").max = 5; E.refreshArchis(S); assert.ok(E.dofusQuest(S, "cacao").done, "quête du Cacao terminée");
  assert.strictEqual(Object.values(S.items).filter((x) => x.tpl === "dofus_cacao").length, nb + 1, "Dofus donné par la quête");
  // étape avec challenge : seulement si le challenge est réussi
  E.stasisInfo(S, "arbre_moon").max = 3; E.refreshArchis(S); assert.strictEqual(E.dofusQuest(S, "dokoko").step, 1, "Dokoko étape 1");
  for (let i = 0; i < 50; i++) E.emit(S, "win", { mons: [{ key: "m52" }], sub: sub.id, chals: ["survivant"], down: 0 }); assert.strictEqual(E.dofusQuest(S, "dokoko").step, 2, "50 Survivant");
  E.addCons(S, "pierre_ame", 6); E.archisOf("moon").slice(0, 3).forEach((a) => E.captureSoul(S, { key: a.k, name: a.name })); assert.strictEqual(E.dofusQuest(S, "dokoko").step, 3, "3 âmes de Moon");
  E.emit(S, "dungeon", { id: "arbre_moon", stasis: 6, chals: [], down: 1 }); assert.strictEqual(E.dofusQuest(S, "dokoko").step, 3, "héros à terre : pas validé");
  E.emit(S, "dungeon", { id: "arbre_moon", stasis: 6, chals: [], down: 0 }); assert.ok(E.dofusQuest(S, "dokoko").done && E.dofusOwned(S, "dokoko"), "Dokoko obtenu");
  // Dokoko en combat : le porteur récupère 3 % de ses PV au début de son tour
  const dk = Object.values(S.items).find((x) => x.tpl === "dofus_dokoko"); assert.strictEqual(E.equip(S, c.id, dk.uid), null, "Dokoko équipé");
  E.startHunt(S, firstSub); E.startFight(S); const F = S.fight; const e = F.ents.find((x) => x.side === "c" && x.cid === c.id); e.hp = Math.round(e.hpMax / 2); const hp = e.hp; E.dofusTurn(S, F, e);
  assert.strictEqual(e.hp, hp + Math.round(e.hpMax * 3 / 100), "Dokoko soigne 3 %"); S.fight = null; S.hunting = false;
  // sauvegarde
  const S2 = E.deserialize(JSON.stringify(S)); assert.ok(S2.souls && S2.souls[k0] && S2.dofusQ.cacao.done && S2.ocre.tier === 1, "album et quêtes sauvegardés");
  assert.ok(E.ACH.some((a) => a.id === "dofus18" && a.title) && E.ORN.ame, "succès et ornement");
  console.log("ok - archimonstres : 213 âmes en 13 zones, pierres et parfum, Éternelle moisson, 18 Dofus et leurs quêtes, Dokoko, sauvegarde");
}
