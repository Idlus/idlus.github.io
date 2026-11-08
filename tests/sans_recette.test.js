/* 2.2.14.8 « Butin utile » : les ressources sans recette ne tombent plus, les stocks gardent leur prix.
   Lancer : node tests/sans_recette.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
const { MONSTERS, ITEMS, SPECIAL_CRAFTS } = D;
assert.ok(D.SANS_RECETTE.size > 500, "la liste est écrite dans js/data.js (node tools/build_sans_recette.js)");
const used = new Set(); for (const t in ITEMS) if (ITEMS[t].craft) ITEMS[t].craft.ing.forEach(([r]) => used.add(r));
for (const n in SPECIAL_CRAFTS) SPECIAL_CRAFTS[n].ing.forEach(([r]) => used.add(r));
for (const r of D.SANS_RECETTE) assert.ok(!used.has(r) && !E.isKey(r), `${r} sert à une recette : il ne doit pas être retiré`);
for (const k in MONSTERS) { const m = MONSTERS[k]; if (m.oldDrops) assert.ok(m.drops.length > 0, `${m.name} garde du butin`);
  if (m.oldDrops) assert.ok(m.drops.every(([r]) => !D.SANS_RECETTE.has(r)), `${m.name} ne lâche plus de ressource sans recette`); }
assert.strictEqual(E.resPrice("Gland"), 23, "une ressource retirée garde son prix (stocks)");
const S = E.newState("Br", "iop"); S.chars.forEach((c) => (c.lvl = 200));
E.gameBuys(S).list.forEach((o) => assert.ok(!D.SANS_RECETTE.has(o.res), `commande du jour sur ${o.res}`));
assert.ok(E.gameBuys(S).list.length >= 9, "les commandes du jour couvrent toutes les tranches");
console.log("sans_recette : OK");
