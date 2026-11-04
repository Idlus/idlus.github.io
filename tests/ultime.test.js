/* 2.2.8 late game (Mathis 04/11 : « ok pour les 3 », idées 2 et 3) : paliers de Sceaux ultimes, boss ultime de la semaine. Lancer : node tests/ultime.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "armes", "drops", "data", "engine", "systems", "archis", "koli", "verify"]) require("../js/" + f + ".js");
const E = window.ENGINE, VF = window.VERIFY; const { ITEMS, DUNGEONS } = window.DATA;
E.EVENT = null; E.celebrate = () => {};
const mk = () => { const S = E.newState("T", "iop"); S.chars = []; ["iop", "cra", "eni", "sacri"].forEach((c, i) => { E.addChar(S, c, "H" + i, 200).inTeam = true; }); return S; };
// idée 2 : paliers 100 / 300 / 600
{ const S = mk(); const U = E.ultSt(S); U.tr = 99; assert.ok(E.ultShop(S, "fusion"), "100 Sceaux requis");
  U.tr = 1100; assert.strictEqual(E.act(S, "ultShop", "fusion"), null); assert.strictEqual(S.fuseFree, 3); assert.strictEqual(U.tr, 1000);
  assert.strictEqual(E.ultShop(S, "galets"), null); assert.strictEqual(S.res["Galet brasillant"], 3);
  assert.strictEqual(E.ultShop(S, "doree"), null); assert.strictEqual(S.cons.pierre_ame_doree, 3); assert.strictEqual(U.tr, 600);
  assert.ok(!E.sframeOk(S, "ultime")); assert.strictEqual(E.ultShop(S, "cadre"), null); assert.ok(E.sframeOk(S, "ultime")); assert.strictEqual(U.tr, 0);
  U.tr = 600; assert.ok(E.ultShop(S, "cadre"), "cadre une seule fois"); assert.strictEqual(U.tr, 600);
  // bon de fusion : fusion sans kamas
  S.kamas = 0; const t = Object.keys(ITEMS).find((k) => ITEMS[k].lvl === 200 && ITEMS[k].stats.vit && ITEMS[k].stats.vit[1] > ITEMS[k].stats.vit[0] + 5);
  const a = E.rollItem(S, t, { radiant: false }), b = E.rollItem(S, t, { radiant: false }); a.stats.vit = ITEMS[t].stats.vit[0]; b.stats.vit = ITEMS[t].stats.vit[1];
  assert.strictEqual(E.fuseItem(S, a.uid, b.uid, "vit"), null); assert.strictEqual(S.fuseFree, 2); assert.strictEqual(S.kamas, 0); }
console.log("ok - paliers de Sceaux ultimes");
// idée 3 : boss ultime de la semaine = donjon de la semaine 161-200 (même tirage que le serveur), Sceaux ×2
{ for (let w = 2880; w < 2960; w++) { const t = (w * 7 - 3) * 86400000 + 3600000; assert.strictEqual(E.weekIdx(t), w);
    const v = VF.weeklyDungeons(DUNGEONS, w).find((x) => x.bracket === 4); assert.strictEqual(E.ultWeek(t), v.did, "semaine " + w); assert.ok(DUNGEONS[v.did].lvl >= 161); }
  const t0 = E.now(); const wk = E.ultWeek(t0); const other = Object.keys(DUNGEONS).find((d) => d !== wk && DUNGEONS[d].lvl >= 161);
  const gain = (did, k) => { const S = mk(); E.stasisClear(S, { id: did, stasis: k, t: 100 }, {}); return E.ultSt(S).tr; };
  assert.strictEqual(gain(other, 15), 3); assert.strictEqual(gain(wk, 15), 6); assert.strictEqual(gain(wk, 11), 2); assert.strictEqual(gain(wk, 10), 0); }
console.log("ok - boss ultime de la semaine");
console.log("ultime.test.js : tout est bon");
