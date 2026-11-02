/* 2.1.42 « Le boss prévient » : prévision des coups du boss, parades, consigne « Quand le boss prépare un coup ». Lancer : node tests/parade.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const D = require("../js/data.js");
let seed = 777;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });

const S = E.newState("Test", "feca");
assert.strictEqual(E.startHunt(S, D.ZONES[0].subs[0].id), null);
E.startFight(S);
const F = S.fight, boss = F.ents.find((e) => e.side === "m");
const hero = F.ents.find((e) => e.side === "c");
// les boucliers d'une partie neuve ont la consigne « Quand le boss prépare un coup » sur « Le héros visé »
const c0 = S.chars[0]; c0.lvl = 60; E.refreshSpells(c0, S); const shields = c0.spells.filter((x) => x.cond === "boss_prep");
assert.ok(shields.length >= 1, "le Féca a au moins un bouclier en « boss_prep »");
assert.ok(shields.every((x) => x.tgt === "threat"), "cible « Le héros visé »");

boss.boss = true; boss.mech = ["seisme"]; boss.mturn = 0; boss.hp = boss.hpMax = boss.hpMax * 40;
// la prévision suit le calendrier : Séisme tous les 4 tours (t % 4 === 0)
for (let t = 0; t < 9; t++) {
  boss.mturn = t; const L = E.bossForecast(F).filter((x) => x.k === "seisme");
  const exp = 4 - (t % 4);
  assert.strictEqual(L.length, 1, `prévision au tour ${t}`); assert.strictEqual(L[0].in, exp, `Séisme dans ${exp} tours (t=${t})`);
  assert.ok(L[0].ts.length && L[0].ts.every((h) => h.side === "c"), "héros visés");
}
boss.mturn = 3; assert.ok(E.bossThreat(F), "menace au prochain tour"); assert.strictEqual(E.threatTarget(F), hero);
boss.mturn = 0;
let n = 0; while (!F.over && n++ < 6000) E.step(S);
assert.ok(F.over, "le combat se termine");
assert.ok((F.parAll || 0) >= 1, "au moins un Séisme compté");
assert.ok((F.par || 0) >= 1, "le Féca a paré au moins un Séisme avec son bouclier");
assert.ok(F.log.some((l) => /Parade/.test(l.txt || l.t || l)), "ligne « Parade » dans le journal");
assert.ok(F.parLast && F.parLast.name === "Séisme");
// migration : une sauvegarde v14 passe ses boucliers « ally_shield » en « boss_prep »
const S2 = E.newState("Test", "feca"); S2.chars[0].lvl = 60; E.refreshSpells(S2.chars[0], S2); S2.chars[0].spells.forEach((x) => { if (x.cond === "boss_prep") { x.cond = "ally_shield"; x.tgt = "low"; } });
const o = JSON.parse(E.serialize(S2)); o.v = 14; const S3 = E.deserialize(JSON.stringify(o)); assert.ok(S3.chars[0].spells.some((x) => x.cond === "boss_prep" && x.tgt === "threat"), "migration v15");
console.log(`parade.test.js OK (parades ${F.par}/${F.parAll})`);
