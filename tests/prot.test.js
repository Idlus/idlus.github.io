/* 0.1.29.3 : le bouton « Combattre » du protecteur marche même quand toute l'équipe récolte. Lancer : node tests/prot.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
const sub = D.ZONES[0].subs[0].id;
const S = E.newState("Test", "iop");
const c = S.chars[0]; c.inTeam = true;
E.startHunt(S, sub); E.stopHunt(S);
assert.strictEqual(E.setJob(S, c.id, "paysan"), null);
assert.strictEqual(E.team(S).length, 0);
E.setRng(() => 0); S.protCalm = 0; E.protSpawn(S, c, c.job);
assert.ok(S.protector, "protecteur apparu");
assert.strictEqual(E.protWhy(S), null, "bouton actif");
const W = c.job;
assert.strictEqual(E.protFight(S), null);
assert.ok(!c.job && S.hunting && S.protector.go && S.protector.back);
// simuler la fin du combat
S.protector.fighting = true; S.protector.go = false; S.fight = { prot: true, over: true };
E.protEnd(S, true); E.protExpire(S);
assert.ok(c.job && c.job.res === W.res, "récolte reprise"); assert.ok(!S.hunting, "chasse arrêtée");
// départ sans combat
S.protCalm = 0; S.protector = null; E.protSpawn(S, c, c.job);
E.protFight(S); assert.ok(!c.job); S.protector.until = E.now() - 1; E.protExpire(S);
assert.ok(c.job && !S.hunting && !S.protector, "rendu après départ");
console.log("ok - protecteur : « Combattre » rappelle les récolteurs, lance la chasse, puis tout reprend");
