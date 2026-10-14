/* Caractéristiques en mode automatique (1.0.30) : le plan s'applique à tous les points, se recalcule à chaque niveau et à chaque changement. Lancer : node tests/carac.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const S = E.newState("Test", "iop");
const c = S.chars[0];
const spent = (x) => { let n = 0; ["vit", "sa", "fo", "ine", "cha", "age"].forEach((k) => { for (let i = 0; i < x.alloc[k]; i++) n += E.pointCost(k, i); }); return n + x.pts; };

// ancienne sauvegarde sans plan : Force jusqu'à 200 puis Vitalité, comme avant
c.lvl = 134; E.resetPoints(S, c.id);
assert.strictEqual(c.alloc.fo, 200); assert.strictEqual(c.alloc.vit, 365); assert.strictEqual(c.pts, 0);
assert.strictEqual(spent(c), 133 * 5, "tous les points sont comptés");

// changer de plan déplace vraiment les points (avant : rien ne bougeait, les points étaient déjà placés)
E.setPlan(S, c, [{ k: "age", to: 9999 }], "vit");
assert.strictEqual(c.alloc.fo, 0); assert.ok(c.alloc.age > 200); assert.strictEqual(c.autoStat, "age");
assert.strictEqual(spent(c), 133 * 5);

// multi-élément : les deux montent ensemble
E.setPlan(S, c, [{ k: "fo+age", to: 200 }], "vit");
assert.ok(Math.abs(c.alloc.fo - c.alloc.age) <= 1, "Force et Agilité équilibrées"); assert.strictEqual(c.alloc.fo, 200); assert.ok(c.alloc.vit > 0);

// plan en plusieurs étapes avec la Sagesse (3 points pour 1)
E.setPlan(S, c, [{ k: "fo", to: 100 }, { k: "sa", to: 100 }, { k: "fo", to: 200 }], "vit");
assert.strictEqual(c.alloc.sa, 100); assert.strictEqual(c.alloc.fo, 200); assert.strictEqual(spent(c), 133 * 5);

// niveau suivant : recalcul complet, toujours cohérent
E.giveXp(S, c, E.xpNeed(c.lvl));
assert.strictEqual(c.lvl, 135); assert.strictEqual(spent(c), 134 * 5); assert.strictEqual(c.alloc.sa, 100);

// passer en manuel garde les points, revenir en auto réapplique le plan
E.setAllocMode(S, c, false); E.deallocate(S, c.id, "fo", 50); assert.ok(c.pts > 0);
E.setAllocMode(S, c, true); assert.strictEqual(c.alloc.fo, 200); assert.strictEqual(c.alloc.sa, 100);

// code de build : le plan voyage avec
const b = E.parseBuild(E.buildCode(S, c));
assert.deepStrictEqual(b.ap, c.autoPlan); assert.strictEqual(b.ar, "vit");
const S2 = E.newState("B", "iop"); const c2 = S2.chars[0]; c2.lvl = 80;
E.applyBuild(S2, c2.id, b); assert.deepStrictEqual(c2.autoPlan, c.autoPlan); assert.strictEqual(spent(c2), 79 * 5);
// plan invalide refusé
assert.strictEqual(E.planAlloc(50, [{ k: "xx", to: 100 }], "vit").alloc.vit, 50);
console.log("carac : OK");
