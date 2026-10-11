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
