/* 3.2 « Passage de relais vers Diablofus » (js/adieu.js) : Défi d'adieu (5 objectifs comptés seulement pendant les 14 jours)
   et palier de Vétéran d'une partie (2A). Lancer : node tests/adieu.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "defi", "hebdo", "adieu"]) require("../js/" + f + ".js");
const E = window.ENGINE; const A = E.ADIEU;
let t = A.from - 3600000; E.setClock(() => t);
const S = E.newState("Adieu", "iop");
assert.strictEqual(E.adieuPhase(), "avant");
E.emit(S, "win", { mons: [{ boss: true }] }); assert.strictEqual(E.adieuList(S)[0].v, 0, "rien avant le début");
t = A.from + 60000; assert.strictEqual(E.adieuPhase(), "en cours");
for (let i = 0; i < 310; i++) E.emit(S, "win", { mons: [{ boss: i < 25 }] });
for (let i = 0; i < 5; i++) E.emit(S, "dungeon", {});
for (let i = 0; i < 3; i++) E.emit(S, "chest", {});
assert.ok(!E.adieuDone(S), "il manque la visite");
E.adieuVisit(S); assert.ok(E.adieuDone(S), "les 5 faits");
assert.strictEqual(E.adieuList(S)[0].v, 300, "plafonné à l'objectif");
const S2 = E.newState("Tard", "cra"); t = A.to + 1000; assert.strictEqual(E.adieuPhase(), "fini");
E.emit(S2, "win", { mons: [] }); assert.strictEqual(E.adieuList(S2)[0].v, 0, "rien après la fin");
// paliers
const S3 = E.newState("Palier", "eni"); assert.strictEqual(E.veteranOf(S3).palier, 0);
S3.chars[0].lvl = 50; assert.strictEqual(E.veteranOf(S3).palier, 1);
S3.chars[0].lvl = 200; assert.strictEqual(E.veteranOf(S3).palier, 2);
S3.stasis = { x: { max: 6 } }; assert.strictEqual(E.veteranOf(S3).palier, 3);
// la partie garde le défi (sérialisation)
const back = E.deserialize(E.serialize ? E.serialize(S) : JSON.stringify(S)); assert.ok(E.adieuDone(back), "S.adieu survit à la sauvegarde");
console.log("ok - Défi d'adieu (fenêtre de 14 jours, 5 objectifs) et paliers de Vétéran");
