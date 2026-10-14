/* 1.0.15 « Tout se drope » : tables de js/drops.js, un tirage par héros, boss selon la stasis, annonce des nouveaux équipements.
   Lancer : node tests/drops.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "armes", "drops", "data", "engine", "systems"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA; const { ITEMS, MONSTERS, DUNGEONS } = D;

// 1. Presque tous les équipements fabricables tombent quelque part ; jamais de Dofus, de légendaire ni de trophée.
const src = {}; for (const k in MONSTERS) (MONSTERS[k].items || []).forEach(([t, p]) => { assert.ok(p > 0 && p <= 100, k + " " + t); (src[t] = src[t] || []).push(k); });
const craft = Object.keys(ITEMS).filter((t) => ITEMS[t].craft && ITEMS[t].slot !== "dofus" && !ITEMS[t].leg && !ITEMS[t].trophy);
assert.ok(craft.filter((t) => src[t]).length / craft.length > 0.99, "presque tous les équipements se dropent");
Object.keys(src).forEach((t) => { const T = ITEMS[t]; assert.ok(T && T.slot !== "dofus" && !T.leg && !T.trophy, t); });
Object.keys(ITEMS).filter((t) => !ITEMS[t].craft && ITEMS[t].slot !== "dofus" && !ITEMS[t].leg && !ITEMS[t].trophy).forEach((t) => assert.ok(src[t], "objet sans recette encore droppable : " + t));
assert.ok(MONSTERS.m970.dbItems, "les drops DofusDB restent connus (rareté de l'HdV)");
console.log("ok - tables de drop");

// 2. Le boss gagne des chances avec la stasis.
assert.strictEqual(E.bossDropMult(1), 1); assert.strictEqual(E.bossDropMult(5), 2); assert.strictEqual(E.bossDropMult(10), 3.25);
console.log("ok - boss et stasis");

// 3. Un tirage par héros : 8 héros font tomber environ 2 fois plus d'objets que 4.
let seed = 5; E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.EVENT = null; E.dropMult = () => 1; // même Prospection pour les deux équipes
const mk = (n) => { const S = E.newState("T", "iop"); S.chars = []; ["iop", "cra", "eni", "sacri", "feca", "osa", "xelor", "panda"].slice(0, n).forEach((c, i) => { E.addChar(S, c, "H" + i, 60).inTeam = true; }); return S; };
const mon = Object.keys(MONSTERS).find((k) => !MONSTERS[k].boss && (MONSTERS[k].items || []).length >= 3);
const drops = (n) => { const S = mk(n); E.ITEM_DROP_SCALE = 20; let got = 0; assert.strictEqual(E.team(S).length, n); for (let i = 0; i < 400; i++) { const r = E.giveRewards(S, [{ key: mon, lvl: 50, name: "x" }], { offline: true }); got += r.items.length + (r.auto || 0); } E.ITEM_DROP_SCALE = 1; return got; };
const d4 = drops(4), d8 = drops(8);
assert.ok(d8 / d4 > 1.6 && d8 / d4 < 2.4, `8 héros ≈ 2 × 4 héros (${d4} → ${d8})`);
console.log("ok - un tirage par héros");

// 4. Annonce seulement pour un équipement jamais obtenu.
{ const S = mk(4); E.events.length = 0; E.ITEM_DROP_SCALE = 5000;
  E.giveRewards(S, [{ key: mon, lvl: 50, name: "x" }], {}); const first = E.events.filter((e) => e.t === "dropit").length;
  E.events.length = 0; E.giveRewards(S, [{ key: mon, lvl: 50, name: "x" }], {}); const again = E.events.filter((e) => e.t === "dropit").length;
  E.ITEM_DROP_SCALE = 1; E.events.length = 0;
  assert.ok(first >= 1, "nouvel équipement annoncé"); assert.strictEqual(again, 0, "pas d'annonce pour un équipement déjà obtenu"); }
console.log("ok - annonce des nouveaux équipements");
