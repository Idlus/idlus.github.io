/* 2.1.8 « Copier le setup » : caractéristiques, sorts, Maîtrise et équipement d'un héros recopiés sur un autre, sans dupliquer d'objet. Lancer : node tests/setup.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/renaissance.js"); require("../js/maitrise_moteur.js");
const D = require("../js/data.js");
const S = E.newState("Test", "iop");
const a = S.chars[0]; a.lvl = 60; a.pts = 59 * 5; a.autoStat = null; Object.keys(a.alloc).forEach((k) => (a.alloc[k] = 0));
E.allocate(S, a.id, "fo", 200); E.allocate(S, a.id, "vit", 95);
const b = E.addChar(S, "iop", "Bis", 30); const x = E.addChar(S, "cra", "Autre", 60);
// équipement : deux objets portés par a, une copie libre du premier dans le sac, le second porté par x
const tpls = Object.keys(D.ITEMS).filter((t) => D.ITEMS[t].lvl <= 20 && D.ITEMS[t].slot && !D.ITEMS[t].leg && !D.ITEMS[t].trophy && !["dofus", "anneau"].includes(D.ITEMS[t].slot));
const by = {}; tpls.forEach((t) => { if (!by[D.ITEMS[t].slot]) by[D.ITEMS[t].slot] = t; }); const [t1, t2] = Object.values(by);
const i1 = E.rollItem(S, t1), i2 = E.rollItem(S, t2); E.equip(S, a.id, i1.uid); E.equip(S, a.id, i2.uid);
const spare = E.rollItem(S, t1); const xi = E.rollItem(S, t2); E.equip(S, x.id, xi.uid);
a.spells = a.spells.slice(0, 3).map((s, i) => ({ id: s.id, cond: i === 0 ? Object.keys(D.CONDITIONS)[1] : undefined, tgt: "low" }));
E.savePreset(S, a.id, 0, "Donjon");
const nItems = Object.keys(S.items).length;
const P = E.setupPlan(S, a.id, b.id);
assert.deepStrictEqual(P.eq.map((e) => e.st).sort(), ["miss", "take"], "une copie trouvée, l'autre portée par un autre héros = manquante");
const r = E.copySetup(S, a.id, b.id, { st: true, sp: true, mt: true, eq: true });
assert.ok(!r.err, r.err);
assert.strictEqual(Object.keys(S.items).length, nItems, "aucun objet créé");
assert.strictEqual(b.equip[D.ITEMS[t1].slot], spare.uid, "la copie libre est équipée");
assert.strictEqual(a.equip[D.ITEMS[t1].slot], i1.uid, "la source garde son objet");
assert.strictEqual(x.equip[D.ITEMS[t2].slot], xi.uid, "l'objet d'un autre héros n'est pas pris");
assert.strictEqual(r.miss.length, 1);
assert.ok(b.alloc.fo > 0 && b.alloc.fo <= Math.floor(200 * 29 / 59) + 1, "répartition ramenée au niveau");
assert.ok(b.alloc.fo > b.alloc.vit, "même priorité de caractéristiques");
assert.strictEqual(b.presets[0].name, "Donjon"); assert.notStrictEqual(b.presets[0], a.presets[0], "stratégies copiées, pas partagées");
// autre classe : sorts non copiés, caractéristiques oui
const r2 = E.copySetup(S, a.id, x.id, { st: true, sp: true, mt: true, eq: false });
assert.ok(!r2.err && r2.st && !r2.sp, "entre classes différentes : caractéristiques seulement");
assert.ok(!x.spells.some((sp) => a.spells.some((y) => y.id === sp.id)) && !x.presets.length, "pas de sorts d'Iop sur un Cra");
// Maîtrise : deux Iop niveau 200, l'arbre actif de a recopié sur b
a.lvl = 200; b.lvl = 200; const Ma = E.mt(a), Mb = E.mt(b); Ma.lvl = 30; Mb.lvl = 30;
assert.ok(E.mtPts(a) > 5, "points de Maîtrise de test");
Ma.t[Ma.lo] = E.mtClean(a, Array.from({ length: 3000 }, (_, i) => i)).slice(0, 5); Ma.t[Ma.lo] = E.mtClean(a, Ma.t[Ma.lo]);
const n = Ma.t[Ma.lo].length; assert.ok(n > 0);
const P3 = E.setupPlan(S, a.id, b.id); assert.strictEqual(P3.mt.cost, 0, "arbre vide : rien à rendre, gratuit");
const r3 = E.copySetup(S, a.id, b.id, { mt: true });
assert.ok(!r3.err, r3.err); assert.deepStrictEqual(Mb.t[Mb.lo].slice().sort(), Ma.t[Ma.lo].slice().sort(), "arbre recopié");
console.log("ok - copier le setup : caractéristiques, sorts et stratégies, Maîtrise, équipement pris dans le sac sans duplication");
