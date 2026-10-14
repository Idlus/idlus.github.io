/* 1.0.20 « Trophées passifs » : un trophée de sous-zone ne s'équipe plus ; +3 % par trophée dans sa région et Vitrine des 6 meilleurs. Lancer : node tests/trophees.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
const subs = D.ZONES.flatMap((z) => z.subs);

// 1. Finir une sous-zone donne le trophée sans objet dans le sac, et prévient l'interface
const S = E.newState("Test", "iop"); const c = S.chars[0];
const sub = subs[0]; let ev = null; const emit0 = E.emit; E.emit = (s, t, d) => { if (t === "trophy") ev = d; };
sub.monsters.forEach((k) => (S.bestiary[k] = 250)); E.checkHunt(S, sub.monsters); E.emit = emit0;
assert.ok(S.trophies[sub.id], "trophée acquis");
assert.ok(!Object.values(S.items).some((x) => D.ITEMS[x.tpl].trophy), "plus d'objet trophée");
assert.deepStrictEqual(ev, { sub: sub.id });
console.log("ok - trophée acquis sans objet");

// 2. Vitrine : la Vitalité et la Sagesse des 6 meilleurs trophées pour chaque héros
const vit0 = E.charStats(S, c).vit;
subs.slice(1, 10).forEach((s) => (S.trophies[s.id] = 1));
const best = Object.keys(S.trophies).map((k) => D.ITEMS["trophee_" + k]).sort((a, b) => b.stats.vit[0] - a.stats.vit[0]).slice(0, 6);
const v = E.trophyVitrine(S);
assert.strictEqual(v.vit, best.reduce((t, T) => t + T.stats.vit[0], 0));
assert.strictEqual(v.list.length, 6);
assert.strictEqual(E.charStats(S, c).vit - vit0, v.vit - D.ITEMS["trophee_" + sub.id].stats.vit[0], "la Vitrine compte dans les caractéristiques");
console.log("ok - Vitrine des 6 meilleurs trophées");

// 3. +3 % par trophée de la région, seulement en chassant dans cette région
const reg = D.ZONES[0]; const nReg = reg.subs.filter((x) => S.trophies[x.id]).length;
E.startHunt(S, sub.id); assert.ok(Math.abs(E.trophyZoneMult(S) - (1 + 0.03 * nReg)) < 1e-9, "bonus de région");
assert.strictEqual(E.trophyZoneMult(S, { dungeon: true }), 1);
const far = D.ZONES.find((z) => z.subs.every((x) => !S.trophies[x.id]));
S.sub = far.subs[0].id; assert.strictEqual(E.trophyZoneMult(S), 1);
console.log("ok - bonus de région");

// 4. Un trophée ne s'équipe plus
const it = E.rollItem(S, "trophee_" + sub.id, { radiant: false });
assert.ok(/ne s'équipent plus/.test(E.equip(S, c.id, it.uid, "dofus1")));
console.log("ok - trophée non équipable");

// 5. Ancienne sauvegarde : les trophées portés ou dans le sac disparaissent, restent acquis, et les emplacements se libèrent
const O = E.newState("Ancien", "cra"); const h = O.chars[0]; h.lvl = 200;
const t1 = E.rollItem(O, "trophee_" + subs[40].id, { radiant: false }), t2 = E.rollItem(O, "trophee_" + subs[41].id, { radiant: false });
h.equip.dofus1 = t1.uid; O.trophies = {};
const L = E.deserialize(E.serialize(O));
assert.ok(!Object.values(L.items).some((x) => D.ITEMS[x.tpl].trophy));
assert.ok(L.trophies[subs[40].id] && L.trophies[subs[41].id]);
assert.ok(!L.chars[0].equip.dofus1);
console.log("ok - ancienne sauvegarde convertie");
