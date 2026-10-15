/* Test du moteur sans navigateur : une partie neuve par classe, un combat complet,
   puis quelques minutes de chasse simulées. Lancer : node tests/fight.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
require("../js/pets.js");
require("../js/mounts.js"); require("../js/elevage.js");
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
    S5.weekly = { h: E.hourIdx(E.now()), did: "crypte_kardorim", mod: "vampires" }; // le mutateur de l'heure ne doit pas tomber sur ce donjon
    ["iop", "eni", "feca", "cra"].forEach((c, i) => { const x = E.addChar(S5, c, "H" + i, 200); x.inTeam = true; E.refreshSpells(x, E.charStats(S5, x)); });
    S5.res[D.DUNGEONS.labo_nileza.key] = 1; assert.strictEqual(E.enterDungeon(S5, "labo_nileza", 1), null);
    assert.ok(S5.dungeon.flash === mod && S5.dungeon.mods.includes(mod), `${mod} : modificateur absent`);
    for (let t = 0; S5.dungeon && t < 3 * 3600 * 1000; t += 1000) E.tick(S5, 1000);
    assert.ok(!S5.dungeon, `${mod} : la course ne se termine pas`);
  }
  E.flash = realFlash; E.dungeonUnlocked = realUnl;
  console.log(`ok - mutateur éclair : ${L.map((x) => x.mod).join(", ")} ; ${E.FLASH_MODS.length} modificateurs joués jusqu'au bout`);
}
// 0.1.8 : familiers et montiliers ; 1.1 : âmes, friandises, montilier à l'XP, Éveil, traces, aptitudes, album
{
  const S6 = E.newState("Test", "iop"); const c = S6.chars[0]; c.lvl = 70;
  const ids = Object.keys(E.PETS); assert.ok(ids.length >= 140, "familiers manquants");
  ids.forEach((id) => { const p = E.PETS[id]; assert.ok(p.icon && Object.keys(p.stats).length, id + " sans icône ou bonus"); for (const k in p.stats) assert.ok(D.STATS[k], `${id} : stat inconnue ${k}`); assert.ok(p.kind === "unique" || (p.kind === "zone" ? E.SUBS[p.sub] : D.DUNGEONS[p.dg]), id + " sans lieu"); assert.ok(E.petApts(id).length && E.petApts(id).every((a) => E.PET_APT[a]), id + " sans aptitude"); });
  const before = E.charStats(S6, c).age;
  const P = E.givePet(S6, "siroko"); assert.strictEqual(c.pet, P.uid, "le montilier doit être porté d'office");
  assert.ok(E.charStats(S6, c).age > before, "le montilier doit donner de l'Agilité");
  assert.ok(E.charStats(S6, c).vit > 0 && E.petStatsAt("siroko", 100).vit === E.MONTI_BONUS.vit, "bonus du montilier (Vitalité)");
  S6.res["Blé"] = 1000; E.petTick(S6, 10 * 3600e3); assert.strictEqual(S6.res["Blé"], 1000, "plus de repas automatiques");
  // le montilier grandit avec l'XP du héros (40 %)
  const g0 = P.g; const kept = 1e9 - E.montiXpShare(S6, c, 1e9); assert.strictEqual(kept, 6e8, "40 % de l'XP au montilier"); assert.ok(P.g > g0, "le montilier grandit avec l'XP");
  // un familier grandit avec les âmes ; ses proies comptent triple
  const c2 = E.addChar ? null : null; void c2;
  E.equipPet(S6, c.id, null); const Q = E.givePet(S6, "gelutin"); E.equipPet(S6, c.id, Q.uid); assert.strictEqual(Q.g, 1, "un nouveau familier commence niveau 1");
  c.inTeam = true; const prey = [...E.petPrey("gelutin")][0]; assert.ok(prey, "le Gelutin a des proies");
  E.petSouls(S6, Array.from({ length: 84 }, () => ({ key: prey, lvl: 1 }))); assert.strictEqual(Q.g, 2, "252 âmes = 1 niveau (proies ×3)");
  E.petSouls(S6, [{ key: "zzz", lvl: 1 }]); assert.strictEqual(Q.s, 3, "un autre monstre donne 1 âme");
  // friandises : 20 Blé = +1 niveau, 5 par jour
  for (let i = 0; i < 6; i++) E.petTreat(S6, Q.uid); assert.strictEqual(Q.g, 7, "5 friandises par jour"); assert.strictEqual(S6.res["Blé"], 900, "20 Blé par friandise");
  // Éveil : niveau 100, Essence et kamas ; un double donne de l'Essence
  assert.ok(E.petAwaken(S6, Q.uid), "pas d'Éveil avant le niveau 100");
  Q.g = 100; E.givePet(S6, "gelutin"); assert.strictEqual(E.petEss(S6), E.PET_DUP_ESS, "un double donne de l'Essence");
  E.addEss(S6, 100); S6.kamas = 60000; assert.strictEqual(E.petAwaken(S6, Q.uid), null, "Éveil ★1"); assert.strictEqual(Q.st, 1); assert.strictEqual(E.petEss(S6), 50);
  assert.strictEqual(E.petStats(S6, c).vit, Math.round(60 * 1.1), "+10 % par étoile");
  // traces : 600 victoires → 1 sur 1 500 pour toujours
  delete S6.pets[Q.uid]; c.pet = null; assert.strictEqual(E.petHuntRate(S6, "inc_champs"), E.PET_ZONE_RATE);
  const rr = E.rnd; E.rnd = () => 0.9; for (let i = 0; i < 700; i++) E.petHunt(S6, "inc_champs"); E.rnd = rr;
  assert.strictEqual(E.petTraces(S6, "inc_champs"), 600, "600 traces au plus"); assert.strictEqual(E.petHuntRate(S6, "inc_champs"), 1 / 1500, "1 sur 1 500 après 600 traces");
  const S7 = E.deserialize(E.serialize ? E.serialize(S6) : JSON.stringify(S6)); assert.ok(S7.pets[P.uid], "familier perdu à la sauvegarde");
  const old = JSON.parse(JSON.stringify(S6)); delete old.pets; delete old.petKeep; delete old.petLuck; delete old.petUid; delete old.chars[0].pet; const S8 = E.deserialize(JSON.stringify(old)); assert.ok(S8.pets && S8.petKeep && S8.petUid === 1, "ancienne sauvegarde sans familiers");
  let n = 0; for (let i = 0; i < 60; i++) { const o = []; E.petBoss(S6, "plateau_ush", 6, o); n += o.length; } assert.ok(n >= 1, "garantie du montilier à la 60e victoire");
  // album : paliers, Chacha Doré et titre à 140
  const S9 = E.newState("Album", "iop"); ids.filter((id) => E.PETS[id].kind !== "unique").slice(0, 140).forEach((id) => E.givePet(S9, id));
  assert.ok(E.petOwned(S9, "chacha_dore") && (S9.titlesExtra || []).includes(E.PET_TITLE), "Chacha Doré et titre au palier 140");
  assert.strictEqual(E.petAlbum(S9), 140, "le Chacha Doré ne compte pas dans l'album");
  console.log(`ok - familiers : ${ids.length} familiers et montiliers, âmes, friandises, Éveil, traces, album`);
}
// 1.1 : aptitudes des familiers en combat (pastille, souffle, écaille, esquive, dernier compagnon)
{
  const S = E.newState("Apt", "iop"); const c = S.chars[0]; c.lvl = 100; c.inTeam = true;
  const P = E.givePet(S, "bwak_de_feu"); P.g = 100; P.st = 5; c.pet = P.uid;
  const ent = E.petEnt(S, c); assert.ok(ent && ent.apts[0] === "souffle" && ent.aura, "aptitude et aura du Bwak ★5");
  let procs = 0, fights = 0; E.startHunt(S, "inc_champs");
  for (let i = 0; i < 40 && procs === 0; i++) { S.fight = null; E.startFight(S); const F = S.fight; if (!F) break; fights++;
    assert.ok(F.ents.some((e) => e.pet && e.pet.id === "bwak_de_feu"), "le héros garde son familier en combat"); let n = 0; while (!F.over && n++ < 5000) E.step(S); procs += (F.petN || {})["Flammèche"] || 0; }
  assert.ok(fights && procs > 0, "la Flammèche se déclenche en combat");
  console.log(`ok - aptitudes des familiers : ${fights} combats, ${procs} Flammèches`);
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
  // 1.0.32 : relâcher une monture (refusé à l'enclos, fait descendre son cavalier, libère une place)
  { const n0 = E.stableN(S9); assert.strictEqual(E.startBreed(S9, A.uid, B.uid), null, "couple relancé"); assert.ok(E.act(S9, "releaseMount", A.uid), "pas de relâche à l'enclos");
    E.stopBreed(S9, 0); assert.strictEqual(E.act(S9, "releaseMount", M.uid), null, "relâcher la monture montée"); assert.ok(!c.mount && !S9.mounts[M.uid], "le héros descend, la monture disparaît"); assert.strictEqual(E.stableN(S9), n0 - 1, "une place libérée"); }
  console.log(`ok - montures : ${n} couleurs, capture, part d'XP, enclos, sauvegarde, relâcher`);
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
  E.saveIdolPreset(S, 0, "Test"); E.clearIdols(S); assert.strictEqual(S.idols.active.length, 0, "tout retiré"); assert.strictEqual(E.loadIdolPreset(S, 0), null, "jeu rechargé"); assert.strictEqual(S.idols.active.length, 6, "6 idoles rechargées"); assert.ok(E.loadIdolPreset(S, 2), "jeu vide");
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
  assert.strictEqual(E.ARCHI_TOTAL, 304, "304 archimonstres"); assert.strictEqual(E.ARCHI_ZONES.length, 15, "15 zones"); assert.strictEqual(E.DOFUS_ORDER.length, 35, "35 Dofus (1.1 : Alliances, Trool, Onirique, Idlus)");
  assert.strictEqual(E.OCRE_TIERS.reduce((a, T, i) => a + E.ocreProgress(S, i)[1], 0), 304, "les six paliers couvrent tous les archimonstres");
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
  // Dofus : obtention, un exemplaire par héros, pas de copie au Bricoleur (1.0)
  const it = E.giveDofus(S, "cacao", "test"); assert.ok(it && it.stats.tac === 10 && E.dofusOwned(S, "cacao") && S.cnt.dofus === 1, "Dofus Cacao donné");
  assert.strictEqual(E.equip(S, c.id, it.uid), null, "Dofus équipé"); const it2 = E.giveDofus(S, "cacao", "copie"); assert.ok(/déjà ce Dofus/.test(E.equip(S, c.id, it2.uid)), "pas deux fois le même Dofus");
  assert.ok(!Object.keys(D.SPECIAL_CRAFTS).some((n) => /^Copie : /.test(n)), "1.0 : plus de copie de Dofus au Bricoleur (quête et butin seulement)");
  // quête : étape donjon validée par la meilleure stasis, étape chasse par les victoires dans la zone, Dofus donné à la fin
  E.stasisInfo(S, "cour_bouftou_royal").max = 3; E.emit(S, "dungeon", { id: "cour_bouftou_royal", stasis: 3, chals: [], down: 0 });
  assert.strictEqual(E.dofusQuest(S, "cacao").step, 1, "étape 1 du Cacao validée");
  const sub = Object.values(E.SUBS).find((s) => s.zone === "astrub"); for (let i = 0; i < 50; i++) E.emit(S, "win", { mons: [{ key: "m52" }, { key: "m52" }, { key: "m52" }], sub: sub.id, chals: [], down: 0 });
  assert.strictEqual(E.dofusQuest(S, "cacao").step, 2, "150 monstres d'Astrub"); const nb = Object.values(S.items).filter((x) => x.tpl === "dofus_cacao").length;
  E.stasisInfo(S, "cour_bouftou_royal").max = 5; E.refreshArchis(S); assert.ok(!E.dofusQuest(S, "cacao").done, "1.0.29.5 : une stasis faite avant ne suffit plus pour la dernière étape");
  E.emit(S, "dungeon", { id: "cour_bouftou_royal", stasis: 5, chals: [], down: 0 }); assert.ok(E.dofusQuest(S, "cacao").done, "quête du Cacao terminée en battant le boss");
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
  console.log("ok - archimonstres : 304 âmes en 15 zones, pierres et parfum, Éternelle moisson, 18 Dofus et leurs quêtes, Dokoko, sauvegarde");
}

// 1.0.4 : statistiques de combat (dégâts, soins, dégâts subis, ennemis vaincus par héros)
{
  const S = E.newState("Stat", "eni"); E.startHunt(S, firstSub);
  for (let t = 0; t < 5 * 60 * 1000; t += 250) E.tick(S, 250);
  const win = S.history.find((r) => r.w); assert.ok(win && Array.isArray(win.s) && win.s.length, "statistiques dans l'historique");
  const x = win.s[0]; assert.ok(x.id === S.chars[0].id && x.d > 0, "dégâts du héros comptés");
  assert.ok(["d", "h", "t", "k"].every((k) => Number.isFinite(x[k]) && x[k] >= 0), "valeurs valides");
  assert.ok(S.history.filter((r) => r.w).every((r) => r.s.reduce((a, y) => a + y.k, 0) >= 1), "au moins un ennemi vaincu par victoire");
  assert.ok(S.fstat && S.fstat.n >= S.history.length && S.fstat.h[S.chars[0].id].d >= x.d, "cumul des statistiques");
  const S2 = E.deserialize(E.serialize(S)); assert.ok(S2.fstat.n === S.fstat.n && S2.history[0].s, "statistiques sauvegardées");
  E.resetFightStats(S); assert.strictEqual(S.fstat.n, 0, "remise à zéro");
  console.log("ok - statistiques de combat par héros, cumul et sauvegarde");
}

// 1.0.30 « Nouvelles caractéristiques » (41A) : PM, Tacle, Fuite et Dommages de poussée sur les objets, poussée en combat,
// runes, migration des objets déjà dans les parties.
{
  const { ITEMS, SETS, STATS, STAT_ORDER } = D;
  // données : lignes de DOFUS (Bottes de Grozilla : 1 PM et 4 à 5 Fuite ; Cape Ulais : 2 à 3 Tacle et 4 Dommages de poussée)
  ["pm", "tac", "fui", "pou"].forEach((k) => assert.ok(STATS[k] && STAT_ORDER.includes(k), "caractéristique " + k));
  for (const t in ITEMS) for (const k in ITEMS[t].stats) assert.ok(STATS[k], `${ITEMS[t].name} : caractéristique inconnue ${k}`);
  assert.deepStrictEqual(ITEMS.i12412.stats.pm, [1, 1]); assert.deepStrictEqual(ITEMS.i12412.stats.fui, [4, 5]);
  assert.deepStrictEqual(ITEMS.i774.stats.tac, [2, 3]); assert.deepStrictEqual(ITEMS.i774.stats.pou, [4, 4]);
  assert.ok(ITEMS.i12416.stats.tac[1] < 0, "malus de Tacle (Ceinture de Grozilla)");
  assert.strictEqual(SETS.s58.bonus[7].pm, 1, "Panoplie du Dragon Cochon : +1 PM à 7 objets"); assert.strictEqual(SETS.s58.bonus[7].pou, 30);
  const push = []; D.CLASS_ORDER.forEach((cls) => (D.CLASSES[cls].spells || []).forEach((sp) => { if (sp.grades.some((g) => g.fx.some((f) => f.k === "push"))) push.push(sp.name); }));
  assert.ok(push.length >= 40 && push.includes("Flèche de Recul"), push.length + " sorts qui repoussent");
  // les lignes passent dans les caractéristiques du héros ; PM jamais augmenté par Rayonnant ni Parfait ; pas d'over PM
  const S = E.newState("Car", "cra"); const c = S.chars[0]; c.lvl = 200; const st0 = E.charStats(S, c);
  const b = E.rollItem(S, "i12412", { radiant: false }), u = E.rollItem(S, "i774", { radiant: false });
  assert.strictEqual(E.equip(S, c.id, b.uid), null); assert.strictEqual(E.equip(S, c.id, u.uid), null);
  const st1 = E.charStats(S, c);
  assert.strictEqual((st1.pm || 0) - (st0.pm || 0), 1, "+1 PM"); assert.strictEqual((st1.fui || 0) - (st0.fui || 0), b.stats.fui, "Fuite");
  assert.strictEqual((st1.tac || 0) - (st0.tac || 0), u.stats.tac, "Tacle"); assert.strictEqual((st1.pou || 0) - (st0.pou || 0), 4, "Dommages de poussée");
  const r = E.rollItem(S, "i12412", { radiant: true }); assert.strictEqual(r.stats.pm, 1, "Rayonnant : toujours 1 PM"); assert.ok(r.stats.fui > r.roll.fui, "Rayonnant : la Fuite monte");
  const p = { tpl: "i12412", stats: {} }; for (const k in ITEMS.i12412.stats) p.stats[k] = ITEMS.i12412.stats[k][1];
  assert.ok(E.isPerfect(p) && E.perfectStats(p).pm === 1 && E.perfectStats(p).fui > 5, "Parfait : pas de PM en plus");
  assert.strictEqual(E.fmCap(ITEMS.i12412, "pm"), 1, "pas d'over PM");
  // runes : Tacle et Fuite sans rune Ra, PM en rune simple et sans transmutation, Dommages de poussée en trois tailles
  assert.deepStrictEqual(E.runeTiers("tac"), ["pa", ""]); assert.deepStrictEqual(E.runeTiers("fui"), ["pa", ""]);
  assert.deepStrictEqual(E.runeTiers("pm"), [""]); assert.deepStrictEqual(E.runeTiers("pou"), ["ra", "pa", ""]);
  assert.strictEqual(E.runeName("pa:pou"), "Rune Pa Do Pou");
  S.runes[":tac"] = 3; S.runes["pa:tac"] = 3; assert.strictEqual(E.fuseRunes(S, ":tac", "up"), null); assert.strictEqual(S.runes["pa:tac"], 4);
  assert.ok(/Pas de rune Ra/.test(E.fuseRunes(S, "pa:tac", "up")), "pas de Ra Tacle");
  assert.ok(E.transmuteTargets().includes("fui") && E.transmuteTargets().includes("pou") && !E.transmuteTargets().includes("pm"), "cibles de transmutation");
  S.runes["ra:vit"] = 10; S.kamas = 1e6; assert.ok(/Pas de rune Ra/.test(E.transmute(S, "ra:vit", "fui"))); assert.strictEqual(E.transmute(S, "ra:vit", "pou"), null);
  const big = Object.keys(ITEMS).filter((t) => ITEMS[t].stats.tac && ITEMS[t].stats.tac[0] > 0 && ITEMS[t].slot !== "dofus" && !ITEMS[t].trophy).sort((x, y) => ITEMS[y].lvl - ITEMS[x].lvl)[0];
  let ra = 0, pa = 0; for (let i = 0; i < 20; i++) { const x = E.rollItem(S, big, { radiant: false }); const got = E.breakItem(S, x.uid, "tac"); ra += got["ra:tac"] || 0; pa += got["pa:tac"] || 0; }
  assert.ok(!ra && pa > 0, `brisage focus Tacle (${ITEMS[big].name}) : ${pa} Pa, ${ra} Ra`);
  console.log("ok - nouvelles caractéristiques : lignes des objets, héros, Rayonnant, Parfait, runes");
}
{
  // poussée : formule, chance selon le nombre de monstres, cases en plus avec les PM
  assert.strictEqual(E.pushChance(1), 0, "seul : pas de poussée"); assert.strictEqual(E.pushChance(2), 0.25); assert.strictEqual(E.pushChance(8), 0.75);
  assert.strictEqual(E.pushDmg(200, 0, 3), (100 + 32) * 3 / 6); assert.ok(E.pushDmg(200, 50, 3) > E.pushDmg(200, 0, 3), "Dommages de poussée");
  assert.strictEqual(E.pushCells({ pm: 0 }, 2), 2); assert.strictEqual(E.pushCells({ pm: 1 }, 2), 3); assert.strictEqual(E.pushCells({ pm: 6 }, 2), 4, "2 cases en plus au plus");
  // en chasse : des coups de poussée dans le journal ; au Kolizéum : aucun
  const S = E.newState("Pou", "cra"); S.chars[0].lvl = 120; for (let i = 0; i < 3; i++) E.addChar(S, "cra", "P" + i, 120).inTeam = true;
  S.chars.forEach((c) => { c.inTeam = true; E.refreshSpells(c, E.charStats(S, c)); });
  const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] <= 110).sort((a, b) => b.lvl[0] - a.lvl[0])[0];
  assert.strictEqual(E.startHunt(S, sub.id), null); E.tactLog = {}; let seen = null;
  for (let t = 0; t < 4 * 60 * 1000 && !seen; t += 250) { E.tick(S, 250); const F = S.fight; if (F) seen = F.log.find((l) => /^Poussée : .+ percute .+ : −\d+ \/ −\d+$/.test(l.txt) && /pou/.test(l.cls)); }
  assert.ok(seen && E.tactLog.pou > 0, "un coup de poussée en chasse"); S.hunting = false; S.fight = null;
  const A = E.koliSnap(S, S.chars.map((c) => c.id)); const n0 = E.tactLog.pou; const W = E.koliSetup(A, A.map((h) => Object.assign({}, h)));
  for (let i = 0; i < 20000 && !W.fight.over; i++) E.step(W);
  assert.ok(W.fight.over && E.tactLog.pou === n0 && !W.fight.log.some((l) => /^Poussée/.test(l.txt)), "pas de poussée au Kolizéum"); E.tactLog = null;
  console.log("ok - poussée : " + seen.txt);
}
{
  // migration (idempotente) : les objets déjà dans les parties reçoivent les nouvelles lignes selon la qualité de leur jet
  const { ITEMS } = D; const T = ITEMS.i12412;
  const S = E.newState("Mig", "iop"); S.runes = S.runes || {};
  const old = (q) => { const it = E.rollItem(S, "i12412", { radiant: false }); for (const k in T.stats) it.stats[k] = T.stats[k][q]; delete it.stats.pm; delete it.stats.fui; return it; };
  const a = old(1), m = old(0); m.exo = "pm"; const ga0 = S.runes["ga:pm"] || 0;
  const r = E.rollItem(S, "i12412", { radiant: true }); delete r.stats.pm; delete r.stats.fui; delete r.roll.pm; delete r.roll.fui;
  const ov = old(1); S.over = [Object.assign({}, ov)]; delete S.items[ov.uid];
  const S2 = E.deserialize(E.serialize(S)); const A = S2.items[a.uid], M = S2.items[m.uid], R = S2.items[r.uid];
  assert.ok(A.stats.pm === 1 && A.stats.fui === 5 && E.isPerfect(A), "un objet parfait reste parfait");
  assert.ok(M.stats.pm === 1 && M.stats.fui === 4 && !M.exo && S2.runes["ga:pm"] === ga0 + 1, "exo PM devenu ligne normale, rune Ga rendue");
  assert.ok(R.stats.pm === 1 && R.roll.fui >= 4 && R.stats.fui === Math.ceil(R.roll.fui * (1 + R.radiant / 100)), "Rayonnant");
  assert.ok(S2.over[0].stats.pm === 1, "coffre de trop-plein"); assert.ok(S2.journal.some((j) => /Nouvelles caractéristiques : 4 objets/.test(j.txt)), "message au joueur");
  const snap = JSON.stringify(S2.items); assert.strictEqual(E.caracsMigrate(S2), 0, "rien à refaire"); assert.strictEqual(JSON.stringify(S2.items), snap, "idempotent");
  const S3 = E.deserialize(E.serialize(S2)); assert.strictEqual(JSON.stringify(S3.items), snap, "deuxième chargement : rien ne bouge");
  // objet arrivé plus tard sans les lignes (HdV) : complété au tick suivant
  const uid = S3.nextUid++; S3.items[uid] = { uid, tpl: "i12412", stats: { vit: 200, cha: 50, age: 50, sa: 30, cri: 3, de: 10, da: 10, pp: 15, re: 6, ra: 6 } }; E.tick(S3, 250);
  assert.ok(S3.items[uid].stats.pm === 1 && S3.items[uid].stats.fui === 5, "objet de l'HdV complété");
  console.log("ok - nouvelles caractéristiques : migration des objets (parfait, exo, Rayonnant, trop-plein, HdV), idempotente");
}

// 1.2.6.3 : chaque mécanique d'identité a ses réglages (Cumul sans valeur donnait des PV NaN aux monstres : Gousset du Xélor)
{
  require("../js/identite.js");
  for (const id in E.ID) for (const t of E.ID[id].tr) {
    if (t.k === "cumul") assert.ok(t.a > 0 && t.max > 0, `sort ${id} : Cumul sans réglage`);
    if (["etat", "contagion", "vol", "sape"].includes(t.k)) assert.ok(t.st, `sort ${id} : ${t.k} sans nom`);
  }
  const S = E.newState("Test", "xelor"); E.addChar(S, "eca", "H1", 180).inTeam = true; S.chars[0].lvl = 180;
  S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c)));
  E.startHunt(S, D.ZONES[0].subs[0].id);
  for (let t = 0; t < 5 * 60 * 1000; t += 250) { E.tick(S, 250); if (S.fight) for (const e of S.fight.ents) assert.ok(Number.isFinite(e.hp), `PV invalides pour ${e.name}`); }
  console.log("ok - identité des sorts : aucune mécanique sans réglage, aucun PV NaN");
}
