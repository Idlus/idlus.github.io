/* Saison 1, lot 3 : Garde-robe (js/garderobe.js), sans navigateur.
   - boucliers : 129, chacun avec un moyen de l'obtenir, le bouclier d'entraînement offert, celui d'un donjon à sa stasis 5 ;
   - auras, effets de victoire et couleurs du pseudo : verrouillés tant que la condition manque, refusés par grSet ;
   - titres colorés : rareté lue sur le texte (exclusifs en Légendaire) ;
   - 9A : les exclusifs de l'Éternel (titres, cadres offerts, Pionnier) se portent dans la partie de saison, jamais ailleurs ;
   - cosmétique des 10 meilleurs votants : aura et couleur « Voix d'Idlus » avec le titre du même nom ;
   - aucune caractéristique ne bouge.
   Lancer : node tests/garderobe.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js");
global.window = {}; require("../js/boucliers.js"); global.BOUCLIERS = window.BOUCLIERS; delete global.window;
require("../js/garderobe.js");
const D = require("../js/data.js");

// boucliers
assert.strictEqual(E.GR_SHIELDS.length, 129, "129 boucliers DOFUS");
const base = E.GR_SHIELDS.find((b) => b.w.k === "base");
const S = E.newState("Héros", "iop"); const c = S.chars[0];
assert(E.grShieldOk(S, base), "bouclier d'entraînement offert");
const sd = E.GR_SHIELDS.find((b) => b.w.k === "dg"); assert(D.DUNGEONS[sd.w.v], "donjon connu");
assert(!E.grShieldOk(S, sd)); assert(E.grSet(S, c.id, "shield", sd.id), "bouclier verrouillé refusé");
S.stasis = { [sd.w.v]: { max: 5 } }; assert(E.grShieldOk(S, sd)); assert.strictEqual(E.grSet(S, c.id, "shield", sd.id), null); assert.strictEqual(E.grWorn(S, c).shield, sd.id);
E.GR_SHIELDS.forEach((b) => assert(E.grShieldReq(b) && E.GR_RAR[b.rar], "moyen d'obtenir et rareté : " + b.n));
console.log("ok - boucliers : 129, offert, stasis 5 du donjon, verrouillés refusés");

// auras, victoire, pseudo
const st0 = JSON.stringify(E.charStats(S, c));
assert(E.grSet(S, c.id, "aura", "braise")); S.stats.wins = 100; assert.strictEqual(E.grSet(S, c.id, "aura", "braise"), null);
assert.strictEqual(E.grWorn(S, c).vic, "confettis", "confettis par défaut");
assert(E.grSet(S, c.id, "vic", "etoiles")); assert(E.grSet(S, null, "pcol", "or"));
assert.strictEqual(JSON.stringify(E.charStats(S, c)), st0, "aucune caractéristique ne bouge");
console.log("ok - auras, effets de victoire, couleurs : verrouillés sans la condition, aucune caractéristique");

// titres colorés
assert.strictEqual(E.titleRar("Légende de la 1.0"), "l"); assert.strictEqual(E.titleRar("Voix d'Idlus"), "l");
const at = E.ACH.find((a) => a.title && !a.s1); assert(["c", "r", "e", "l"].includes(E.titleRar(at.title)));
console.log("ok - titres colorés par rareté");

// exclusifs de l'Éternel (9A) et cosmétique des meilleurs votants
const Et = E.newState("Ancien", "iop"); Et.titlesExtra = ["Légende de la 1.0", "Voix d'Idlus"]; Et.unlocks.pionnier = 1; Et.unlocks.gift_f_koli = 1;
const S1 = E.newState("Saison", "iop"); E.s1cStart(S1); E.grExcl(S1, Et);
assert(E.titles(S1).includes("Légende de la 1.0"), "titre exclusif porté en saison");
assert(E.sframeOk(S1, "pionnier") && E.sframeOk(S1, "koli"), "cadres exclusifs portés en saison");
assert(E.GR_AURAS.voix.ok(S1) && E.GR_PCOL.voix.ok(S1), "aura et couleur des meilleurs votants");
const S2 = E.newState("Autre", "iop"); E.grExcl(S2, Et); assert(!E.titles(S2).includes("Légende de la 1.0"), "hors saison : rien d'importé");
assert(!E.GR_AURAS.voix.ok(S2));
const S3 = E.deserialize(E.serialize(S1)); assert(E.titles(S3).includes("Voix d'Idlus"), "relu après sauvegarde");
console.log("ok - exclusifs de l'Éternel en saison seulement, Voix d'Idlus pour les 10 meilleurs votants");
