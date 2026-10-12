/* Boss de guilde et Percepteurs (0.1.22), sans navigateur.
   Lancer : node tests/gboss.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js"); require("../js/gboss.js");
const D = require("../js/data.js");

// 1. La semaine change le lundi à minuit (heure de Paris) ; le boss est le même pour tous.
let t = Date.UTC(2030, 0, 6, 22, 59); E.setClock(() => t); // dimanche 23 h 59 à Paris
const w0 = E.gbossWeek(); t += 2 * 60000; assert.strictEqual(E.gbossWeek(), w0 + 1, "lundi minuit à Paris");
assert.ok(E.gbossLeft() > 6.9 * 86400000 && E.gbossLeft() <= 7 * 86400000, "temps restant : une semaine");
assert.deepStrictEqual(E.gboss(w0), E.gboss(w0));
assert.ok(Object.keys(E.GBOSS_POW).length >= 30, "assez de boss calibrés");
for (const did in E.GBOSS_POW) assert.ok(D.DUNGEONS[did] && D.DUNGEONS[did].boss, "boss calibré inconnu : " + did);
console.log("ok - boss : semaine de Paris, même boss pour tous");

// 2. Un essai : même équipe + même numéro = mêmes points ; la partie n'est pas touchée.
const G = E.newState("Équipe", "iop"); G.chars[0].lvl = 80; ["eni", "feca", "cra"].forEach((k, i) => { const x = E.addChar(G, k, "H" + i, 80); x.inTeam = true; });
G.chars.forEach((c) => E.refreshSpells(c, E.charStats(G, c)));
const before = E.serialize(G); const def = E.gboss(w0);
const r1 = E.gbossSim(G, def, 0, t), r2 = E.gbossSim(G, def, 0, t);
assert.deepStrictEqual(r1, r2, "même essai, même résultat");
assert.strictEqual(E.serialize(G), before, "la partie n'est pas touchée");
assert.ok(r1.points >= 0 && r1.rounds <= E.GBOSS_ROUNDS);
assert.strictEqual(E.gbossGoal(3), 5 * E.GBOSS_PER_MEMBER); assert.strictEqual(E.gbossGoal(12), 12 * E.GBOSS_PER_MEMBER);
assert.deepStrictEqual(E.gbossChest(50, 100), { k: 52000, dust: 30 }, "même coffre que gb_chest (supabase/gboss.sql)");
console.log("ok - boss : essai rejouable, coffres");

// 3. Percepteurs : places, poche, défense rejouable.
assert.deepStrictEqual([1, 4, 5, 9, 10, 25, 60].map(E.percoSlots), [0, 0, 1, 1, 2, 5, 5]);
const cap = E.percoCap("ast_champs"); assert.ok(cap.k > 0 && Object.keys(cap.res).length > 0);
G.trophies = { ast_champs: 1 }; assert.deepStrictEqual(E.percoZones(G), ["ast_champs"]);
const seed = E.percoSeed(123, "u"); const p1 = E.percoSim(G, "ast_champs", 0, seed, t), p2 = E.percoSim(G, "ast_champs", 0, seed, t);
assert.deepStrictEqual(p1, p2, "même défense, même résultat"); assert.strictEqual(typeof p1.win, "boolean");
const p3 = E.percoSim(G, "ast_champs", 3, seed, t); assert.ok(p3.foes > p1.foes, "un monstre de plus par défenseur battu");
console.log("ok - Percepteurs : places, poche, défense rejouable");
