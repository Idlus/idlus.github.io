/* 2.1.4 « Bouclier du serveur » : le serveur calcule le résumé des classements depuis la partie (VERIFY.fullSummary)
   et refuse une partie impossible (VERIFY.impossible) ou des gains trop rapides pour le temps réel (VERIFY.check).
   Lancer : node tests/bouclier.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/maitrise_moteur.js"); require("../js/dofusp.js"); require("../js/collections.js"); require("../js/chroma.js"); require("../js/alignement.js");
const D = require("../js/data.js");
const V = require("../js/verify.js");

let seed = 7;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });

/* une partie honnête : une équipe qui chasse quelques heures */
const S = E.newState("Honnête", "iop");
E.addChar(S, "cra", "Archer", 1); E.addChar(S, "eni", "Soin", 1);
E.subUnlocked = () => true;
const sub = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] <= 5);
E.startHunt(S, sub);
for (let t = 0; t < 1800 * 1000; t += 1000) E.tick(S, 1000);
const txt = E.serialize(S);
const X = E.deserialize(txt);
assert.strictEqual(V.impossible(E, X, 0), null, "une partie honnête est possible");
const sum = V.fullSummary(E, X);
assert.strictEqual(sum.level, V.summary(E, X).level);
assert.ok("align" in sum, "le résumé du serveur porte aussi l'alignement");
console.log("ok - résumé calculé par le serveur, partie honnête acceptée");

/* tous les objets du jeu, au jet maximum, Rayonnants à +50 %, parfaits et forgemagés au plafond : jamais refusés */
let n = 0;
for (const tpl in D.ITEMS) {
  const T = D.ITEMS[tpl]; const P = E.newState("Objets", "iop");
  const it = E.rollItem(P, tpl, { radiant: false });
  for (const k in T.stats) { const [, b] = T.stats[k]; it.stats[k] = b > 0 ? Math.ceil(Math.max(b, E.fmCap(T, k)) * 1.5) : b; }
  const why = V.impossible(E, P, 0); assert.strictEqual(why, null, `${tpl} : ${why}`); n++;
}
console.log(`ok - ${n} objets au maximum possible acceptés`);

/* ce qu'un script pourrait écrire dans la partie */
const bad = (f, msg) => { const Y = E.deserialize(txt); f(Y); const why = V.impossible(E, Y, 0); assert.ok(why, msg); return why; };
const anyTpl = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].stats.vit && D.ITEMS[k].stats.vit[1] > 0);
console.log("  " + bad((Y) => { const it = E.rollItem(Y, anyTpl, { radiant: false }); it.stats.vit = 99999; }, "objet à 99 999 Vitalité"));
console.log("  " + bad((Y) => { Y.items[Y.nextUid] = { uid: Y.nextUid, tpl: "objet_invente", stats: {} }; Y.nextUid++; }, "objet inconnu"));
console.log("  " + bad((Y) => { Y.chars[0].alloc.vit += 5000; }, "points de caractéristiques en trop"));
console.log("  " + bad((Y) => { Y.chars[0].scrolls.fo = 500; }, "parchemins au-delà de 100"));
console.log("  " + bad((Y) => { Y.chars[0].lvl = 999; }, "niveau au-delà de 200"));
console.log("  " + bad((Y) => { Y.kamas = 1e15; }, "kamas illisibles"));
/* 2.1.17 : Maîtrise plafonnée depuis le reset (cas de Sigmar : 21 388 points par héros le lendemain du reset) */
{ const T = Date.UTC(2026, 9, 17, 13, 40); V.now = () => T;
  const mk = (lvls, bn) => { const Y = E.deserialize(txt); Y.chars.forEach((c, i) => { c.lvl = 200; c.mt = { lvl: lvls[i] || 0, xp: 0, bn: bn || 0, t: [[], [], []], lo: 0, j: {} }; }); return Y; };
  assert.strictEqual(V.impossible(E, mk([40, 36, 35]), 0), null, "Maîtrise honnête du lendemain : acceptée");
  console.log("  " + V.impossible(E, mk([21388, 18028, 16521]), 0)); assert.ok(V.impossible(E, mk([21388, 18028, 16521]), 0), "21 388 points le lendemain : refusé");
  assert.ok(V.impossible(E, mk([10, 10, 10], 5), 0), "points des vies passées après le reset : refusé");
  V.now = () => Date.UTC(2027, 9, 17); assert.strictEqual(V.impossible(E, mk([2000, 1500, 1000]), 0), null, "un an plus tard, 2 000 points : acceptés");
  delete V.now; }
/* un objet né avant le bouclier a une marge plus large (anciens jets) */
{ const Y = E.deserialize(txt); const it = E.rollItem(Y, anyTpl, { radiant: false }); it.stats.vit = Math.ceil(Math.max(D.ITEMS[anyTpl].stats.vit[1], E.fmCap(D.ITEMS[anyTpl], "vit")) * 2.2);
  assert.ok(V.impossible(E, Y, 0), "objet récent trop fort : refusé"); assert.strictEqual(V.impossible(E, Y, it.uid + 1), null, "le même objet né avant le bouclier : accepté"); }
console.log("ok - parties impossibles refusées");

/* gains comparés au temps réel */
const b0 = V.bilan(E, X);
const at = (o) => Object.assign({}, b0, o);
assert.ok(V.check(E, b0, at({ k: b0.k + 300000 }), 1, {}, null, 60).ok, "300 000 kamas en 1 h au niveau 60 : normal");
assert.ok(!V.check(E, b0, at({ k: b0.k + 1e9 }), 0.05, {}, null, 60).ok, "un milliard de kamas en 3 min : refusé");
assert.ok(V.check(E, b0, at({ k: b0.k + 1e9 }), 0.05, { k: 1e9 }, null, 60).ok, "sauf s'ils viennent du serveur (vente, code, lot)");
assert.ok(!V.check(E, b0, at({ mt: b0.mt + 3000 }), 1, {}, 2, 200).ok, "3 000 points de Maîtrise en une heure, réserve vide : refusé");
assert.ok(!V.check(E, b0, at({ bn: b0.bn + 10 }), 10, {}, null, 200).ok, "points des vies passées en hausse : refusé");
assert.ok(!V.check(E, b0, at({ dof: b0.dof + 4 }), 1, {}, null, 200).ok, "4 Dofus d'un coup : refusé");
// la réserve : 48 h de jeu d'avance au plus (Sablier), puis le rythme du temps réel
let res = null, ok = 0; const R = V.rates(200);
for (let i = 0; i < 200; i++) { const c = V.check(E, b0, at({ k: b0.k + R.k * 0.5 }), 1 / 120, {}, res, 200); if (!c.ok) break; res = c.res; ok++; }
assert.ok(ok >= 90 && ok < 100, `la réserve de 48 h s'épuise (${ok} envois de 30 h de kamas en 30 s)`);
const c2 = V.check(E, b0, at({ k: b0.k + R.k * 2 }), 2, {}, 0, 200);
assert.ok(c2.ok, "après 2 h réelles, 2 h de gains passent de nouveau");
console.log("ok - gains comparés au temps réel (réserve de 48 h)");
