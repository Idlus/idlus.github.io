/* 2.1.22 « Le Sablier » : malus de butin du Sablier de Xélor (×2 −10 %, ×3 −20 %) et réserve de 36 h.
   Lancer : node tests/sablier.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems"]) require("../js/" + f + ".js");
const E = window.ENGINE;
let seed = 3; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });

assert.strictEqual(E.sabLootAt(1), 1);
assert.ok(Math.abs(E.sabLootAt(2) - 0.9) < 1e-9 && Math.abs(E.sabLootAt(3) - 0.8) < 1e-9, "×2 −10 %, ×3 −20 %");
assert.ok(Math.abs(E.sabLootAt(1.5) - 0.95) < 1e-9, "pas où la réserve se vide : malus au prorata");
assert.strictEqual(E.sabNow, 1, "hors de la boucle du jeu (hors ligne, serveur) : aucun malus");
assert.strictEqual(E.SAB_MAX, 36 * 3600); assert.strictEqual(E.SAB_GIFT_MAX, 48 * 3600);

// même combat, même tirage : kamas, ressources et objets baissent avec le malus, l'XP ne bouge pas
const fight = (spd) => {
  seed = 3; const S = E.newState("T", "iop"); S.chars[0].lvl = 120;
  const sid = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && !E.SUBS[k].hidden && Math.abs(E.subMid(E.SUBS[k]) - 120) <= 6); S.sub = sid;
  const mons = []; for (let i = 0; i < 400; i++) E.SUBS[sid].monsters.forEach((k) => mons.push({ key: k, lvl: 120 }));
  E.sabNow = spd; let out; try { out = E.giveRewards(S, mons, {}); } finally { E.sabNow = 1; }
  let n = 0; for (const r in out.res) if (!E.isKey(r)) n += out.res[r];
  return { k: out.kamas, n, xp: out.xp[S.chars[0].id] };
};
const a = fight(1), b = fight(2), c = fight(3);
assert.strictEqual(a.xp, b.xp, "l'XP ne change pas"); assert.strictEqual(a.xp, c.xp);
assert.ok(Math.abs(b.k / a.k - 0.9) < 0.03 && Math.abs(c.k / a.k - 0.8) < 0.03, `kamas ${a.k} / ${b.k} / ${c.k}`);
assert.ok(b.n < a.n && c.n < b.n && c.n > a.n * 0.65, `ressources ${a.n} / ${b.n} / ${c.n}`);
console.log("sablier.test : OK", a, b, c);

/* « Plus de Sablier » : Horloge, heures d'activités, Horloger, Fioles et Grains */
{
  const t0 = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t0);
  const S = E.newState("T", "iop"); S.quest.step = 7; const B = E.sab(S); assert.ok(B.open);
  assert.ok(Math.abs(E.sabRate(S) * 86400 - 3 * 3600) < 1e-6, "3 h par jour de base");
  S.havre.sablier = 3; assert.ok(Math.abs(E.sabRate(S) * 86400 - 4.5 * 3600) < 1e-6, "Horloge niveau 3 : 4 h 30 par jour");
  assert.deepStrictEqual([0, 1, 2].map((l) => { S.havre.sablier = l; return E.havreCost(S, "sablier"); }), [25e6, 100e6, 400e6]);
  B.r = 0;
  assert.strictEqual(E.sabEarn(S, "defi"), 1); assert.strictEqual(E.sabEarn(S, "defi"), 0, "une fois par jour");
  assert.strictEqual(E.sabEarn(S, "wb"), 0.5); E.sabEarn(S, "wb"); E.sabEarn(S, "wb"); assert.strictEqual(E.sabEarn(S, "wb"), 0, "3 essais par jour");
  assert.strictEqual(E.sabEarn(S, "gb"), 0.5); E.sabEarn(S, "gb"); assert.strictEqual(E.sabEarnLeft(S, "gb"), 0);
  assert.ok(Math.abs(B.r - 3.5 * 3600) < 1e-6, "1 + 1,5 + 1 h");
  S.kamas = 4e6; assert.ok(E.horlogerBuy(S), "trop cher");
  S.kamas = 40e6; assert.strictEqual(E.horlogerBuy(S), null); assert.strictEqual(E.horlogerCost(S), 10e6);
  E.horlogerBuy(S); E.horlogerBuy(S); assert.ok(E.horlogerBuy(S), "3 par jour"); assert.strictEqual(S.kamas, 40e6 - 35e6); assert.strictEqual(S.cons.fiole_temps, 3);
  const r0 = B.r; assert.strictEqual(E.useConsumable(S, "fiole_temps"), null); assert.ok(Math.abs(B.r - r0 - 3600) < 1); assert.strictEqual(S.cons.fiole_temps, 2);
  B.r = E.SAB_GIFT_MAX - 600; assert.ok(E.useConsumable(S, "fiole_temps"), "réserve presque pleine"); assert.strictEqual(S.cons.fiole_temps, 2);
  assert.strictEqual(E.grainRate(5), 0); assert.ok(Math.abs(E.grainRate(6) - 0.001) < 1e-12 && Math.abs(E.grainRate(15) - 0.0025) < 1e-12);
  console.log("sablier.test : Plus de Sablier OK");
}
