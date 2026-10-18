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

/* 2.1.27 « Maîtrise du temps » (1A 2C 3A 4A 5A) : 50 niveaux, 1 XP par minute de réserve utilisée, paliers, ×4 au niveau 50 */
{
  const t0 = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t0); // mardi
  const S = E.newState("T", "iop"); S.quest.step = 7; const B = E.sab(S);
  assert.strictEqual(E.sabMtLvl(S), 1, "tout le monde commence au niveau 1");
  assert.strictEqual(E.sabMtXpAt(2), 30); assert.strictEqual(E.sabMtXpAt(50), 36750, "environ 612 h de Sablier pour le niveau 50");
  for (const l of [1, 2, 7, 25, 49, 50]) { S.sabMt = { xp: E.sabMtXpAt(l) }; assert.strictEqual(E.sabMtLvl(S), l); S.sabMt.xp -= 0.01; if (l > 1) assert.strictEqual(E.sabMtLvl(S), l - 1); }
  S.sabMt = { xp: 0 };
  // XP : réserve utilisée (×3 = 2 minutes par minute)
  E.sabSet(S, 3); S.hunting = true; S.sub = Object.keys(E.SUBS)[0]; assert.ok(E.sabBusy(S));
  assert.strictEqual(E.sabSpend(S, 60000), 3); assert.ok(Math.abs(S.sabMt.xp - 2) < 1e-9, "1 minute en ×3 = 2 XP");
  assert.strictEqual(E.sabSet(S, 4) !== null, true, "×4 fermé avant le niveau 50");
  // paliers
  const at = (l) => { S.sabMt = { xp: E.sabMtXpAt(l) }; };
  at(1); assert.strictEqual(E.sabMaxOf(S), 36 * 3600); assert.strictEqual(E.sabGiftMaxOf(S), 48 * 3600);
  at(50); assert.strictEqual(E.sabMaxOf(S), 61 * 3600, "+25 h au niveau 50"); assert.strictEqual(E.sabGiftMaxOf(S), 73 * 3600);
  at(14); assert.ok(Math.abs(E.sabRate(S) * 86400 - 3 * 3600) < 1e-6); at(15); assert.ok(Math.abs(E.sabRate(S) * 86400 - 3.5 * 3600) < 1e-6, "+30 min au 15");
  at(35); assert.ok(Math.abs(E.sabRate(S) * 86400 - 4 * 3600) < 1e-6, "+1 h au 35");
  const mal = (l, v) => Math.round((1 - E.sabLootAt(v, l)) * 1000) / 10;
  assert.deepStrictEqual([1, 9, 10, 20, 30, 40, 50].map((l) => [mal(l, 2), mal(l, 3)]), [[10, 20], [10, 20], [9, 18], [8, 16], [7, 14], [6, 12], [6, 12]]);
  assert.strictEqual(mal(50, 4), 25); assert.strictEqual(mal(50, 3.5), 18.5, "pas où la réserve se vide en ×4 : entre ×3 et ×4");
  E.sabLvlNow = 40; E.sabNow = 3; assert.ok(Math.abs(E.sabLoot() - 0.88) < 1e-9); E.sabNow = 1; assert.strictEqual(E.sabLoot(), 1); E.sabLvlNow = 1;
  // Grain de Xélor à chaque niveau impair
  { const T = E.newState("T", "iop"); T.quest.step = 7; const TB = E.sab(T); T.sabMt = { xp: 0 }; TB.spd = 2; TB.r = 30 * 3600; T.hunting = true; T.sub = S.sub;
    E.sabSpend(T, 3600e3 * 12); assert.strictEqual(E.sabMtLvl(T), 7); assert.strictEqual(T.cons.grain_xelor, 3, "niveaux 3, 5 et 7"); }
  // Fioles offertes chaque semaine (1 dès le 25, 2 dès le 45), une fois par semaine
  S.cons.fiole_temps = 0; at(24); E.sab(S); assert.strictEqual(S.cons.fiole_temps || 0, 0);
  S.sabMt.xp = E.sabMtXpAt(25) - 1; B.spd = 3; E.sabSpend(S, 120000); assert.strictEqual(E.sabMtLvl(S), 25); assert.strictEqual(S.cons.fiole_temps, 1, "Fiole offerte en passant le niveau 25");
  E.sab(S); E.sab(S); assert.strictEqual(S.cons.fiole_temps, 1, "une seule par semaine");
  S.sabMt.xp = E.sabMtXpAt(45) - 1; B.r = 3600; B.spd = 3; E.sabSpend(S, 120000); assert.strictEqual(E.sabMtLvl(S), 45); assert.strictEqual(S.cons.fiole_temps, 2, "la deuxième de la semaine en passant le 45");
  E.setClock(() => t0 + 7 * 86400000); E.sab(S); assert.strictEqual(S.cons.fiole_temps, 4, "semaine suivante : 2 Fioles");
  E.setClock(() => t0); E.sab(S); E.setClock(() => t0 + 7 * 86400000); E.sab(S); assert.strictEqual(S.cons.fiole_temps, 4, "horloge reculée puis remise : rien de plus");
  // niveau 15 : ×2 illimité (ni réserve ni XP), ×3 qui se vide retombe en ×2
  { at(15); B.spd = 2; B.r = 0; assert.strictEqual(E.sabSet(S, 2), null, "×2 même réserve vide"); const x0 = S.sabMt.xp;
    assert.strictEqual(E.sabSpend(S, 3600e3), 2); assert.strictEqual(B.r, 0); assert.strictEqual(S.sabMt.xp, x0, "pas d'XP en ×2 illimité");
    B.r = 60; B.spd = 3; const m = E.sabSpend(S, 60000); assert.strictEqual(B.spd, 2, "retour au ×2"); assert.ok(Math.abs(m - 2.5) < 1e-9); at(14); assert.ok(E.sabSet(S, 2), "×2 sans réserve fermé avant le 25"); }
  // niveau 50 : ×4 (3 minutes de réserve par minute) et titre
  S.sabMt.xp = E.sabMtXpAt(50) - 1; B.r = 3600; B.spd = 3; E.sabSpend(S, 60000);
  assert.strictEqual(E.sabMtLvl(S), 50); assert.ok((S.titlesExtra || []).includes("Maître du temps"), "titre au 50");
  assert.strictEqual(E.sabSet(S, 4), null); const r0 = B.r; assert.strictEqual(E.sabSpend(S, 60000), 4); assert.ok(Math.abs(r0 - B.r - 180) < 1e-6, "×4 : 3 minutes de réserve par minute");
  assert.strictEqual(S.sabMt.xp, E.sabMtXpAt(50), "l'XP s'arrête au niveau 50");
  // Bouclier : XP de Maîtrise du temps impossible
  const V = require("../js/verify.js"); V.now = () => V.SAB_T0 + 86400000;
  assert.ok(/Maîtrise du temps/.test(V.impossible(E, { chars: [], items: {}, kamas: 0, sabMt: { xp: 36750 } }) || ""), "niveau 50 un jour après la sortie : refusé");
  assert.strictEqual(V.impossible(E, { chars: [], items: {}, kamas: 0, sabMt: { xp: 6000 } }), null, "100 h en un jour (réserve pleine + recharge) : accepté");
  console.log("sablier.test : Maîtrise du temps OK");
  E.setClock(null);
}
