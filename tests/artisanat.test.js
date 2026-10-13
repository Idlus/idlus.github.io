/* 1.0.4.3 « Fabriquer sac plein » : quand le sac est plein, l'objet fabriqué part dans le trop-plein.
   Lancer : node tests/artisanat.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const { ITEMS } = require("../js/data.js");
const S = E.newState("Art", "iop");
const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].craft && ITEMS[k].lvl < 3);
const give = (n) => ITEMS[tpl].craft.ing.forEach(([r, q]) => (S.res[r] = q * n));
give(5); assert.strictEqual(E.craftCount(S, "tpl", tpl), 5, "sac vide : 5 fabrications");
while (E.itemCount(S) < E.itemCap(S)) E.rollItem(S, tpl, { radiant: false });
assert.ok(E.craftCount(S, "tpl", tpl) > 0, "sac plein : la fabrication reste possible");
const r = E.craftMany(S, "tpl", tpl, 3);
assert.strictEqual(r.n, 3, "3 objets fabriqués"); assert.strictEqual(r.over, 3, "rangés dans le trop-plein");
assert.strictEqual(E.itemCount(S), E.itemCap(S), "le sac ne déborde pas");
S.over = Array.from({ length: E.overCap(S) }, (_, i) => ({ uid: 900000 + i, tpl, stats: {} })); give(5);
assert.strictEqual(E.craftCount(S, "tpl", tpl), 0, "sac et trop-plein pleins : rien");
assert.ok(typeof E.craftItem(S, tpl) === "string", "message d'erreur clair");
console.log("artisanat : OK");
