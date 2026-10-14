/* Récolte : 1.0.7.9 « Récolte rééquilibrée » (rendement 35 % → 10 %) et 1.0.8.6 « Coups de récolte longs »
   (un coup dure E.HIT_S secondes, même production par heure, part du coup gardée si on rappelle le héros).
   Lancer : node tests/recolte.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
let seed = 3; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
let now = 1.8e12; E.now = () => now; E.protSpawn = () => {}; E.almMult = () => 1;
assert.ok(Math.abs(E.gatherYield(1) - 0.35) < 0.002 && Math.abs(E.gatherYield(150) - 0.1625) < 1e-9, "rendement 35 % au niveau 1, inchangé jusqu'au niveau 150");
// la quantité par coup monte toujours avec le niveau du métier (avant : baisse de 150 à 200)
{ let prev = 0; for (let L = 1; L <= 200; L++) { const S = E.newState("Q", "iop"); S.jobs.paysan.lvl = L; const c = S.chars[0]; c.job = { job: "paysan", res: "Blé", prog: 0 }; const q = E.hitQty(S, c); assert.ok(q >= prev - 1e-9, `quantité par coup croissante (niveau ${L})`); prev = q; }
  assert.ok(prev > 5.8 && prev < 6.2, `≈ 6 par coup au niveau 200 sans outil (${prev.toFixed(2)})`); }
const make = (lvl, res) => { const S = E.newState("Rec", "iop"); S.jobs.paysan.lvl = lvl; const c = S.chars[0]; c.job = { job: "paysan", res, prog: 0 }; return { S, c }; };
// la durée d'un coup suit E.HIT_S, quel que soit l'outil
{ const { S, c } = make(200, "Quisnoa"); const t0 = E.gatherPeriod(S, c); S.tools.paysan = 10; assert.strictEqual(E.gatherPeriod(S, c), t0, "l'outil ne raccourcit pas le coup");
  assert.ok(t0 >= Math.min(E.HIT_S.lo, E.HIT_S.hi) && t0 <= Math.max(E.HIT_S.lo, E.HIT_S.hi), "durée du coup dans E.HIT_S"); }
// production par heure : la même qu'avant les coups longs (ancien rythme × quantité × rendement)
for (const lvl of [1, 100, 200]) {
  const res = E.jobRes("paysan").filter((x) => x[1] <= lvl).pop()[0]; const { S, c } = make(lvl, res); S.tools.paysan = 5;
  const H = 6; let n = 0; for (let t = 0; t < H * 3600; t += 60) { n += E.gatherTick(S, 60, { quiet: true }); S.jobs.paysan.lvl = lvl; now += 60000; }
  const want = H * 3600 / E.basePeriod(S, c) * (1 + lvl / 200) * 1.04 * E.gatherYield(lvl);
  assert.ok(n > want * 0.85 && n < want * 1.15, `niveau ${lvl} : ${n} ressources en ${H} h pour ~${Math.round(want)} attendues`);
  assert.strictEqual(S.res[res], n, "les ressources arrivent bien dans l'inventaire");
}
// rien avant la fin du coup, tout d'un bloc à la fin
{ const { S, c } = make(200, "Quisnoa"); const t = E.gatherPeriod(S, c);
  E.gatherTick(S, t * 0.9, { quiet: true }); assert.ok(!S.res.Quisnoa, "rien avant la fin du coup");
  E.gatherTick(S, t * 0.11, { quiet: true }); assert.ok(S.res.Quisnoa > 3, `un bloc à la fin du coup (${S.res.Quisnoa})`); }
// 6A : héros rappelé à mi-coup : il rapporte environ la moitié d'un coup
{ let tot = 0, exp = 0; for (let i = 0; i < 200; i++) { const { S, c } = make(200, "Quisnoa"); E.gatherTick(S, E.gatherPeriod(S, c) / 2, { quiet: true }); exp += E.hitQty(S, c) / 2; assert.strictEqual(E.setJob(S, c.id, null), null); assert.strictEqual(c.job, null); tot += S.res.Quisnoa || 0; }
  assert.ok(tot > exp * 0.85 && tot < exp * 1.15, `part du coup gardée au rappel (${tot} pour ~${Math.round(exp)})`); }
// XP par heure : la même qu'en 1.0.7.9
{ const { S, c } = make(1, "Blé"); const H = 1; const t = E.gatherPeriod(S, c); E.gatherTick(S, t, { quiet: true });
  const want = (10 + 1) * E.gatherYield(1) * t / E.basePeriod(S, c); assert.ok(Math.abs(S.jobs.paysan.xp - want) < 1e-6, "XP d'un coup = XP des récoltes de l'ancien rythme"); }
console.log("recolte : OK");
