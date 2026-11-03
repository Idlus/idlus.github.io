/* Saison 1 : bannière de profil (js/banniere.js) : 2 offertes, 4 de saison, portée sur le profil public par le résumé du serveur.
   Lancer : node tests/banniere.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/quetes.js"); require("../js/saisonc.js"); require("../js/cartes.js"); require("../js/tournoi.js"); require("../js/banniere.js");
const V = require("../js/verify.js");
assert.strictEqual(Object.keys(E.BANNERS).length, 6);
Object.keys(E.BANNERS).forEach((id) => assert(fs.existsSync(path.join(__dirname, "..", E.banUrl(id))), "image " + id));
const S = E.newState("Héros", "iop");
assert.deepStrictEqual(E.banCount(S), [2, 6], "2 offertes");
assert.strictEqual(E.banSet(S, "dragon"), "Bannière pas encore débloquée.");
assert.strictEqual(E.banSet(S, "glace"), null); assert.strictEqual(E.banWorn(S), "glace");
const sum = (V.summary || (V.VERIFY && V.VERIFY.summary))(E, S); assert.strictEqual(sum.heroes[0].ban, "glace", "sur le héros principal du résumé public");
S.pban = "dragon"; assert.strictEqual(E.banWorn(S), null, "une bannière verrouillée ne se montre pas");
assert(!(V.summary || V.VERIFY.summary)(E, S).heroes[0].ban);
const T = E.newState("Saison", "cra"); E.s1cStart(T, E.now()); T.chars[0].lvl = 200;
assert(E.banOk(T, "fissure") && E.banOk(T, "dragon") && !E.banOk(T, "guerre"));
assert.strictEqual(E.banSet(T, null), null); assert.strictEqual(E.banWorn(T), null);
console.log("ok - bannière de profil : 2 offertes, 4 de saison, portée par le résumé public, verrouillée = cachée");
