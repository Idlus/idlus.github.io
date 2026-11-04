/* 2.2.5 « Changer de classe » (E.changeClass, js/engine.js ; Mathis 04/11 : 1A 2A+2C 3A 4A 5A). Sans navigateur.
   Lancer : node tests/changer_classe.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/maitrise_moteur.js"); require("../js/mono.js");
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);

const S = E.newState("Test", "iop"); const c = S.chars[0];
c.lvl = 200; E.resetPoints(S, c.id); const M = E.mt(c); M.lvl = 40; M.t[0] = [1, 2]; M.j = { 3: 9 }; M.obj = 5;
E.savePreset && E.savePreset(S, c.id, 0, "x");
S.kamas = 10e6;
// 1er changement gratuit, Maîtrise gardée, étoiles rendues, joyaux au sac
assert.strictEqual(E.ccCost(c), 0);
assert.strictEqual(E.changeClass(S, c.id, "sram", { sex: "f", head: 1 }), null);
assert.strictEqual(c.cls, "sram"); assert.strictEqual(c.sex, "f"); assert.strictEqual(c.head, 1);
assert.ok(S.kamas >= 10e6 && S.kamas < 10e6 + 2e4, "gratuit (succès de niveau du héros de test seulement)");
assert.strictEqual(M.lvl, 40); assert.deepStrictEqual(M.t, [[], [], []]); assert.deepStrictEqual(M.j, {}); assert.strictEqual(M.obj, null);
assert.ok(c.spells.length > 0 && c.spells.every((x) => E.spellDef("sram", x.id)), "sorts de la nouvelle classe");
assert.strictEqual(c.autoStat, D().CLASSES.sram.main);
assert.strictEqual(c.pts + Object.values(c.alloc).reduce((a, b) => a + b, 0) > 0, true);
assert.ok(E.classesDone(S).iop && !E.classesDone(S).sram, "succès des classes : l'ancienne compte, pas la nouvelle");
// délai 7 jours
assert.ok(/7 j/.test(E.changeClass(S, c.id, "cra")));
now += 7 * 86400000 + 1000;
// 2e : niveau × 5 000 ; 3e : doublé
assert.strictEqual(E.ccCost(c), 1e6);
{ const k0 = S.kamas; assert.strictEqual(E.changeClass(S, c.id, "cra"), null); assert.ok(k0 - S.kamas >= 1e6 - 1e5 && k0 - S.kamas <= 1e6, "1 M payé"); }
now += 7 * 86400000 + 1000;
assert.strictEqual(E.ccCost(c), 2e6);
S.kamas = 1e6; assert.ok(/Il te manque/.test(E.changeClass(S, c.id, "eni")));
assert.ok(/déjà/.test(E.ccErr(S, c, "cra")));
// combat toujours possible après le changement
assert.ok(E.charStats(S, c).hpMax > 0);
// Monocompte : une seule fois par saison
const T = E.monoStart(E.newState("Mono", "iop")); const h = T.chars[0]; T.kamas = 1e7;
assert.strictEqual(E.changeClass(T, h.id, "feca"), null);
now += 30 * 86400000;
assert.ok(/saison/.test(E.changeClass(T, h.id, "iop")));
console.log("changer_classe : OK");
function D() { return require("../js/data.js"); }
