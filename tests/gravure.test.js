/* Gravure runique (choix de Mathis 1A 2A 3A 4C, 21/10/2026) : coûts ×2 par rang jusqu'au rang 10, +1 % aux caractéristiques
   de l'objet porté sur l'emplacement gravé, paiement en runes cochées ou « Auto ». Lancer : node tests/gravure.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const V = require("../js/verify.js");
const D = require("../js/data.js");

// 1. coûts : rang 1 = 50 000 de poids et 2 M de kamas, ×2 par rang ; un emplacement au rang 10 = 51 M de poids et 2 milliards
assert.deepStrictEqual(E.gravCost(1), { w: 50000, k: 2000000 });
assert.deepStrictEqual(E.gravCost(10), { w: 25600000, k: 1024000000 });
let W = 0, K = 0; for (let r = 1; r <= 10; r++) { W += E.gravCost(r).w; K += E.gravCost(r).k; }
assert.strictEqual(W, 51150000); assert.strictEqual(K, 2046000000);
assert.ok(8 * 9 * K > 147e9 && 8 * 9 * K < 148e9, "toute une équipe : ≈ 147 milliards de kamas");
console.log("ok - coûts");

// 2. effet : +1 % par rang, arrondi, jamais PA, PM, Portée, Invocation ; la gravure reste sur l'emplacement
const S = E.newState("Grav", "iop"); const c = S.chars[0]; c.lvl = 200; c.inTeam = true;
const tpl = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].slot === "coiffe" && D.ITEMS[t].lvl >= 190 && D.ITEMS[t].stats.vit && D.ITEMS[t].stats.vit[0] >= 200);
const it = E.rollItem(S, tpl, { radiant: false }); E.equip(S, c.id, it.uid);
assert.deepStrictEqual(E.gravStats({ vit: 300, pa: 1, pm: 1, po: 1, inv: 1, fo: -20, sa: 40 }, 10), { vit: 30, sa: 4 });
const a = E.charStats(S, c); c.grav = { coiffe: 10 }; const b = E.charStats(S, c);
assert.strictEqual(b.vit - a.vit, Math.round(it.stats.vit * 0.1), "+10 % de Vitalité au rang 10");
E.unequip(S, c.id, "coiffe"); assert.strictEqual(E.charStats(S, c).vit, E.charStats(S, c).vit); assert.strictEqual(c.grav.coiffe, 10, "reste sur l'emplacement");
E.equip(S, c.id, it.uid); c.grav = {};
console.log("ok - effet sur l'emplacement");

// 3. paiement : Auto (gros stocks d'abord, jamais Ga, transcendance, PA/PM/Po/Invo), runes cochées, kamas
S.runes = { ":vit": 200000, ":fo": 10000, "ga:vit": 100, "pa:pa": 50, "ta:fo": 5 }; S.kamas = 10e6;
const vitW = E.runeInfo(":vit").weight;
const auto = E.gravAuto(S); assert.ok(!auto.includes("ga:vit") && !auto.includes("pa:pa") && !auto.includes("ta:fo"), "runes protégées en Auto");
assert.strictEqual(auto[0], ":vit");
let r = E.gravUp(S, c.id, "coiffe", null); assert.strictEqual(typeof r, "object", String(r)); assert.strictEqual(r.r, 1);
assert.strictEqual(S.kamas, 8e6); assert.strictEqual(S.runes[":vit"], 200000 - Math.ceil(50000 / vitW)); assert.strictEqual(S.runes["ga:vit"], 100);
assert.strictEqual(c.grav.coiffe, 1);
const fo0 = S.runes[":fo"]; r = E.gravUp(S, c.id, "coiffe", [":fo"]);
assert.strictEqual(r, "Les runes cochées ne suffisent pas."); assert.strictEqual(S.runes[":fo"], fo0, "rien n'est pris si ça ne suffit pas"); assert.strictEqual(c.grav.coiffe, 1);
S.kamas = 1e6; assert.strictEqual(E.gravUp(S, c.id, "coiffe", null), "Pas assez de kamas.");
S.kamas = 1e12; S.runes[":vit"] = 1e9; for (let i = 0; i < 9; i++) assert.strictEqual(typeof E.gravUp(S, c.id, "coiffe", null), "object");
assert.strictEqual(c.grav.coiffe, 10); assert.strictEqual(E.gravUp(S, c.id, "coiffe", null), "Rang maximum atteint.");
assert.strictEqual(E.gravUp(S, c.id, "dofus1", null), "Emplacement inconnu.");
console.log("ok - paiement");

// 4. sauvegarde et Bouclier
const N = E.deserialize(E.serialize(S)); assert.strictEqual(N.chars[0].grav.coiffe, 10);
assert.strictEqual(V.impossible(E, N, 0), null, "rang 10 accepté par le Bouclier");
N.chars[0].grav.coiffe = 11; assert.ok(/gravure/.test(String(V.impossible(E, N, 0))), "rang 11 refusé par le Bouclier");
N.chars[0].grav = { dofus1: 2 }; assert.ok(/gravure/.test(String(V.impossible(E, N, 0))), "emplacement inconnu refusé");
console.log("ok - sauvegarde");
