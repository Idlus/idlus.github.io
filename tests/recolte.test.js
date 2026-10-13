/* 1.0.7.9 « Récolte rééquilibrée » : rendement 35 % au niveau 1 → 10 % au niveau 200, XP de métier dans la même proportion.
   Lancer : node tests/recolte.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
let seed = 3; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
let now = 1.8e12; E.now = () => now; E.protSpawn = () => {}; E.almMult = () => 1;
assert.ok(Math.abs(E.gatherYield(1) - 0.35) < 0.002 && Math.abs(E.gatherYield(200) - 0.1) < 1e-9, "rendement 35 % → 10 %");
const run = (lvl, sec) => {
  const S = E.newState("Rec", "iop"); S.jobs.paysan.lvl = lvl; const c = S.chars[0];
  const res = E.jobRes("paysan").filter((x) => x[1] <= lvl).pop()[0]; c.job = { job: "paysan", res, prog: 0 };
  let n = 0; for (let t = 0; t < sec; t += 60) { n += E.gatherTick(S, 60, { quiet: true }); S.jobs.paysan.lvl = lvl; now += 60000; }
  return { S, res, n, per: 3600 / E.gatherPeriod(S, c) * sec / 3600 };
};
const a = run(200, 3600 * 4); // coups en 4 h : per ; ressources attendues ≈ per × 2 × 1,04 × 0,1
const want = a.per * 2 * 1.04 * 0.1;
assert.ok(a.n > want * 0.85 && a.n < want * 1.15, `niveau 200 : ${a.n} ressources pour ~${Math.round(want)} attendues`);
assert.strictEqual(a.S.res[a.res], a.n, "les ressources arrivent bien dans l'inventaire");
const b = run(1, 3600); assert.ok(b.n > 0 && b.n < b.per * 0.5, "niveau 1 : environ un tiers des coups");
// XP : un coup au niveau 1 donne (10 + niveau de la ressource) × rendement
const S = E.newState("Xp", "iop"); S.chars[0].job = { job: "paysan", res: "Blé", prog: 0 };
E.gatherTick(S, E.gatherPeriod(S, S.chars[0]) + 0.001, { quiet: true });
assert.ok(Math.abs(S.jobs.paysan.xp - 11 * E.gatherYield(1)) < 1e-9, "XP d'un coup réduite dans la même proportion");
console.log("recolte : OK");
