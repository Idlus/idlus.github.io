/* 2.2.12.2 (#183, Nerisia) : en Monocompte, Sceaux ultimes dès la stasis 7 (solo et groupe). Lancer : node tests/ultime_mono.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "armes", "drops", "data", "engine", "systems", "archis", "koli", "verify", "legendaires", "mono"]) require("../js/" + f + ".js");
const E = window.ENGINE; const { DUNGEONS } = window.DATA;
E.EVENT = null; E.celebrate = () => {};
const mk = (mono) => { const S = E.newState("T", "iop"); S.chars = []; ["iop", "cra", "eni", "sacri"].forEach((c, i) => { E.addChar(S, c, "H" + i, 200).inTeam = true; }); if (mono) S.mono = { grp: 0 }; return S; };
const wk = E.ultWeek(E.now()); const did = Object.keys(DUNGEONS).find((d) => d !== wk && DUNGEONS[d].lvl >= 161);
const gain = (mono, k) => { const S = mk(mono); E.stasisClear(S, { id: did, stasis: k, t: 100 }, {}); return E.ultSt(S).tr; };
// Classique inchangé
assert.deepStrictEqual([6, 7, 10, 11, 12, 13, 15].map((k) => gain(false, k)), [0, 0, 0, 1, 1, 2, 3]);
// Monocompte : 1 en 7-8, 2 en 9-10, 3 dès 11
assert.deepStrictEqual([6, 7, 8, 9, 10, 11, 15].map((k) => gain(true, k)), [0, 1, 1, 2, 2, 3, 3]);
assert.strictEqual(E.ultGain({ mono: {} }, wk, 7), 2, "boss de la semaine ×2");
console.log("ok - Sceaux ultimes dès la stasis 7 en Monocompte");
// groupe du Bureau : victoire en stasis 9 → 2 Sceaux, défaite → rien
{ const S = mk(true); E.isMono = () => true; S.progress.bossKills = S.progress.bossKills || {};
  const tot = E.monoGroupLoot(S, { did, stasis: 9, rooms: [], done: true }); assert.strictEqual(tot.ult, 2); assert.strictEqual(E.ultSt(S).tr, 2);
  const t2 = E.monoGroupLoot(S, { did, stasis: 9, rooms: [], done: false }); assert.ok(!t2.ult); assert.strictEqual(E.ultSt(S).tr, 2); }
console.log("ok - Sceaux ultimes en groupe");
// échange : copie d'Éveil puis fusion
{ const S = mk(true); const k = E.LEG_LIST.find((x) => x.lvl <= 200).k; E.ultSt(S).tr = 3000 + 1200;
  assert.strictEqual(E.ultBuy(S, k), null); assert.strictEqual(E.ultCost(S, k), 1200); assert.strictEqual(E.ultBuy(S, k), null);
  const [a, b] = Object.values(S.items).filter((i) => i.tpl === E.LEG[k].tpl); assert.strictEqual(E.legFuse(S, a.uid, b.uid), null); assert.strictEqual(E.legCopies(a), 2); }
console.log("ok - copie d'Éveil achetée et fondue");
console.log("ultime_mono.test.js : tout est bon");
