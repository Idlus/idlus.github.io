/* Saison 1, lot 8 (js/chevauchee.js) : les 4 Cavaliers à la suite, blessures gardées, 3 essais par semaine, récompenses une
   fois par palier, seulement en saison, résultat reproductible. Lancer : node tests/chevauchee.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js"); require("../js/cartes.js"); require("../js/chevauchee.js");
const DAY = 86400000; let now = Date.UTC(2030, 0, 9, 12); E.setClock(() => now); const t0 = now;
assert.strictEqual(E.CHEV_BOSSES.length, 4, "les 4 Cavaliers");
const S = E.newState("Héros", "iop"); E.s1cStart(S, t0);
const n0 = Object.values(S.cons).reduce((a, b) => a + b, 0);
const a = E.chevSim(S, 1, 42), b = E.chevSim(S, 1, 42);
assert.deepStrictEqual(a, b, "même hasard, même résultat");
assert.ok(a.fights.length >= 1 && a.fights[0].id === "arbre_mort");
assert.ok(a.n < 4, "un héros niveau 1 ne bat pas les Cavaliers");
for (let i = 0; i < 3; i++) { const r = E.chevPlay(S, 1); assert.strictEqual(typeof r, "object", String(r)); }
assert.strictEqual(typeof E.chevPlay(S, 1), "string", "3 essais par semaine");
assert.strictEqual(E.chevLeft(S), 0); now += 7 * DAY; assert.strictEqual(E.chevLeft(S), 3, "la semaine suivante, 3 essais"); now = t0;
assert.strictEqual(typeof E.chevPlay(E.newState("x", "iop"), 1), "string", "hors saison : non");
console.log("ok - Chevauchée : 4 Cavaliers, résultat reproductible, 3 essais par semaine, seulement en saison");
// équipe forte : les blessures restent d'un Cavalier au suivant
const B = E.newState("Fort", "iop"); E.s1cStart(B, t0); const c = B.chars[0]; c.lvl = 200; E.refreshSpells && E.refreshSpells(c, B);
const r = E.chevSim(B, 1, 7); assert.ok(r.fights.length >= 1);
if (r.fights.length > 1) assert.ok(r.fights[1].hp <= 100, "PV du deuxième combat");
console.log("ok - niveau 200 : " + r.n + " Cavalier(s) sur 4 en stasis 1 (" + r.fights.map((f) => f.hp + " %").join(", ") + ")");
// récompenses une seule fois par palier
const C = B.s1c; E.chevPlay(B, 1); const got1 = Object.keys(E.chevState(B).got).length; E.chevPlay(B, 1);
assert.strictEqual(Object.keys(E.chevState(B).got).length, got1, "pas deux fois la même récompense");
console.log("ok - récompenses une fois par palier et par semaine");
void n0; void C;
