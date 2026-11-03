/* Saison 1, lot 7 (5A et 9A) : ordres d'équipe « les sbires d'abord » et « qui prépare un coup », compteur du dernier combat.
   Lancer : node tests/ordres_equipe.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const D = require("../js/data.js");
let seed = 99; E.setRng(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
const S = E.newState("Test", "iop");
const sub = D.ZONES.flatMap((z) => z.subs).find((s) => true);
E.startHunt(S, sub.id); E.startFight(S);
const F = S.fight; let mons = F.ents.filter((e) => e.side === "m");
while (mons.length < 3) { const m = Object.assign({}, mons[0]); m.name += " bis"; F.ents.push(m); mons = F.ents.filter((e) => e.side === "m"); }
const hero = F.ents.find((e) => e.side === "c"), boss = mons[0];
boss.boss = true; boss.hp = boss.hpMax = 999999; mons.slice(1).forEach((m, i) => { m.boss = false; m.role = null; m.hp = 500 + i; });
const first = () => E._pickFoes(S, F, hero, { tgt: "low" }, 1)[0];
S.settings.focus = "boss"; assert.strictEqual(first(), boss, "ordre « le boss »");
S.settings.focus = "adds"; assert.notStrictEqual(first(), boss, "ordre « les sbires d'abord »");
mons.slice(1).forEach((m) => (m.alive = false, m.hp = 0)); assert.strictEqual(first(), boss, "plus de sbires : le boss");
mons.slice(1).forEach((m, i) => (m.alive = true, m.hp = 500 + i));
const adder = mons[2]; adder.mech = ["seisme"]; adder.mturn = 3; boss.mech = [];
S.settings.focus = "prep"; assert.ok(E.bossForecast(F).some((x) => x.mi === F.ents.indexOf(adder) && x.in <= 2), "il prépare un coup");
assert.strictEqual(first(), adder, "ordre « qui prépare un coup »");
console.log("ok - ordres d'équipe : les sbires d'abord, qui prépare un coup");
const st = E.fightStats(F); assert.ok(Array.isArray(st) && st.every((x) => "d" in x && "h" in x), "stats du combat pour le compteur");
console.log("ok - compteur du dernier combat : dégâts et soins de chaque héros");
