/* 2.1.37.1 : une invocation morte est remplacée par la suivante au lieu de s'empiler dans le combat.
   Lancer : node tests/invocations.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");

let seed = 4242;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });

const S = E.newState("Test", "osa");
const c = S.chars[0]; const sp = E.knownSpells(Object.assign({}, c, { lvl: 200 })).find((x) => x.grades.some((g) => g.fx.some((f) => f.k === "summon")));
assert.ok(sp, "aucun sort d'invocation chez l'Osamodas"); c.lvl = Math.max(c.lvl, sp.lvl); c.spells = [{ id: sp.id, cond: "always", tgt: "low" }];
assert.strictEqual(E.startHunt(S, D.ZONES[0].subs[0].id), null);
E.startFight(S);
const F = S.fight;
F.ents.forEach((e) => { if (e.side === "m") { e.hpMax = e.hp = 1e9; e.dmg = 0; } }); // monstres increvables et inoffensifs
const n0 = F.ents.length; let made = 0, seen = new Set();
for (let i = 0; i < 4000 && !F.over && F.round < 50; i++) {
  E.step(S);
  F.ents.forEach((e) => { if (e.summon && e.alive) { if (!seen.has(e)) { seen.add(e); made++; } if (F.round % 2) { e.hp = 0; e.alive = false; } } }); // on tue les invocations un tour sur deux
}
assert.ok(made >= 5, `trop peu d'invocations lancées : ${made}`);
const sums = F.ents.filter((e) => e.summon).length;
assert.ok(sums <= 2, `les invocations s'empilent : ${sums} places pour ${made} invocations`);
assert.ok(F.ents.length <= n0 + 2, `le combat grossit : ${F.ents.length} entités`);
assert.ok(F.order.every((x, k) => F.order.indexOf(x) === k || !F.ents[x].alive || k < F.oi), "une invocation joue deux fois dans le même tour");
console.log(`ok - invocations remplacées (${made} invocations, ${sums} places)`);
