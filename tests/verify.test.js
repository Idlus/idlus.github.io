/* Classements (0.1.16) : le serveur rejoue un donjon avec l'équipe d'une sauvegarde, à l'identique pour un même tirage.
   Lancer : node tests/verify.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const D = require("../js/data.js");
const V = require("../js/verify.js");

const did = "crypte_kardorim";
const S = E.newState("Rejeu", "iop"); S.chars[0].lvl = 30; E.stasisInfo(S, did).max = 2;
const txt = E.serialize(S);
const a = V.replay(E, txt, did, 2, 99), b = V.replay(E, txt, did, 2, 99);
assert.ok(a.ok, "l'équipe doit terminer la stasis : " + a.err);
assert.deepStrictEqual(a, b, "même tirage, même résultat");
assert.ok(!V.replay(E, txt, did, 3, 99).ok, "une stasis jamais terminée est refusée");
const weak = E.newState("Faible", "iop"); E.stasisInfo(weak, "chambre_tal_kasha").max = 1;
assert.ok(!V.replay(E, E.serialize(weak), "chambre_tal_kasha", 1, 1).ok, "une équipe trop faible ne passe pas");
assert.strictEqual(E.serialize(S), txt, "la partie d'origine n'est pas modifiée");
console.log("ok - rejeu d'un donjon par le serveur");

const w = V.weekIdx(Date.UTC(2030, 0, 7, 12));
const wl = V.weeklyDungeons(D.DUNGEONS, w);
assert.strictEqual(wl.length, 5); assert.deepStrictEqual(wl, V.weeklyDungeons(D.DUNGEONS, w));
wl.forEach((x) => { const l = D.DUNGEONS[x.did].lvl; assert.ok(l >= x.from && l <= x.to); });
assert.strictEqual(w, E.weekIdx(Date.UTC(2030, 0, 7, 12)), "même semaine que le mutateur");
console.log("ok - donjons de la semaine (un par tranche, les mêmes pour tous)");

const sum = V.summary(E, S);
assert.strictEqual(sum.level, 30); assert.strictEqual(sum.main, "iop"); assert.strictEqual(sum.panel, false);
console.log("ok - résumé pour les classements");

// 2.1.12 : chaque point de Maîtrise compte un niveau dans le classement (et mtl dit combien)
const M = E.newState("Maitre", "iop"); M.chars[0].lvl = 200; M.chars[0].mt = { lvl: 140, bn: 10 };
const sm = V.summary(E, M);
assert.strictEqual(sm.level, 350); assert.strictEqual(sm.mtl, 150); assert.strictEqual(sm.heroes[0].mt, 150);
console.log("ok - la Maîtrise compte dans le niveau du classement");
