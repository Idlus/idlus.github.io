/* Test du moteur sans navigateur : une partie neuve par classe, un combat complet,
   puis quelques minutes de chasse simulées. Lancer : node tests/fight.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
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
