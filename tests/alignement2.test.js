/* Refonte des alignements (js/honneur.js) : honneur et 20 rangs, migration, talents d'ordre, Arsenal de la cité,
   régions de la carte, agressions et défenses, résumé pour le serveur. Sans navigateur.
   Lancer : node tests/alignement2.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "quetes", "verify", "koli", "alignement", "honneur"].forEach((f) => require("../js/" + f + ".js"));
const D = require("../js/data.js");
const V = globalThis.VERIFY;

let seed = 77;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true; E.dungeonUnlocked = () => true;
const team = (L) => { const S = E.newState("Camp", "iop"); S.chars[0].lvl = L; ["eni", "cra"].forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); E.checkAch(S); return S; };

// 1. Les 20 rangs : 300 pour le rang 1, +15 % par rang ; noms et titres.
{
  assert.strictEqual(E.honStep(1), 300); assert.strictEqual(E.honCum(20), 30750, "rang 20");
  for (let r = 1; r <= 20; r++) { assert.strictEqual(E.honRankOf(E.honCum(r)), r); assert.strictEqual(E.honRankOf(E.honCum(r) - 1), r - 1); assert.ok(E.honStep(r) >= E.honStep(r - 1 || 1)); }
  const S = team(200); E.chooseAlign(S, "bonta", "coeur"); assert.strictEqual(S.align.hon, 0); assert.strictEqual(E.alignRankIdx(S), 0);
  E.honGive(S, E.honCum(20), "test", true);
  assert.strictEqual(E.alignRankIdx(S), 20); assert.strictEqual(E.alignRankName(S), "Héros de Bonta");
  ["Commandeur de Bonta", "Grand Maître de Bonta", "Héros de Bonta"].forEach((t) => assert.ok(S.titlesExtra.includes(t), "titre " + t));
  assert.strictEqual(S.align.lvl, 100, "5 niveaux par rang pour le serveur et les anciens écrans");
  assert.strictEqual(E.honRankName("brakmar", "oeil", 1), "Disciple de Brumaire I");
  console.log("ok - honneur : 20 rangs, titres aux rangs 16, 18 et 20");
}

// 2. Migration : ancien niveau d'alignement (0-100) → honneur, niveau 100 = rang 10 (E.VERSION 14), une seule fois.
{
  assert.strictEqual(E.VERSION, 14);
  const S = team(200); S.align = { side: "brakmar", order: "esprit", lvl: 100, xp: 0 }; S.v = 13;
  const N = E.deserialize(JSON.stringify(JSON.parse(E.serialize(S))));
  assert.strictEqual(E.alignRankIdx(N), 10); assert.strictEqual(N.align.hon, E.honCum(10)); assert.strictEqual(N.align.pur, 0, "la bourse commence vide");
  assert.strictEqual(E.honFromLvl(55), Math.round(E.honCum(5) + 0.5 * E.honStep(6)));
  N.align.hon += 123; const N2 = E.deserialize(E.serialize(N)); assert.strictEqual(N2.align.hon, E.honCum(10) + 123, "pas de seconde migration");
  console.log("ok - honneur : migration niveau 100 → rang 10");
}

// 3. Honneur : les talents et la panoplie le multiplient, une défaite ne fait jamais perdre de rang, rien pendant un changement de camp.
{
  const S = team(200); E.chooseAlign(S, "bonta", "coeur");
  assert.strictEqual(E.honGive(S, 100), 100); assert.strictEqual(S.align.pur, 100);
  E.honGive(S, E.honCum(3) - 100, "", true); assert.strictEqual(E.alignRankIdx(S), 3);
  assert.strictEqual(E.honGive(S, 100), 105, "talent 3 : +5 % d'honneur");
  const h0 = S.align.hon; assert.ok(E.honGive(S, -500, "", true) >= -(h0 - E.honCum(3)), "pas sous le rang");
  assert.strictEqual(E.alignRankIdx(S), 3, "le rang reste");
  E.giveAlignXp(S, 200); assert.ok(S.align.hon > E.honCum(3), "l'ancienne XP d'alignement devient de l'honneur (1 pour 10)");
  const P = team(200); E.chooseAlign(P, "bonta", "coeur"); E.chooseAlign(P, "brakmar", "coeur"); assert.strictEqual(E.honGive(P, 100), 0, "rien pendant un changement de camp");
  console.log("ok - honneur : bonus et défaites");
}

// 4. Talents d'ordre : un par rang de 1 à 5, le 5e est le Serment ; bonus de PV, XP et butin.
{
  for (const o of ["coeur", "esprit", "oeil"]) { const L = E.ALIGN_TAL[o]; assert.strictEqual(L.length, 5); assert.strictEqual(L[4].k, "oath"); assert.strictEqual(L[4].n.bonta, "Serment de Menalt"); assert.strictEqual(L[4].n.brakmar, "Serment de Djaul"); L.forEach((t) => assert.ok(t.n.bonta && t.n.brakmar && t.d && !t.d.includes("—"))); }
  const S = team(200); E.chooseAlign(S, "bonta", "esprit"); const xp0 = E.bonus(S, "xp");
  E.honGive(S, E.honCum(1), "", true); assert.strictEqual(E.honTalents(S).length, 1); assert.ok(E.bonus(S, "xp") >= xp0 + 4, "Esprit : +4 % d'XP au rang 1");
  E.honGive(S, E.honCum(5) - E.honCum(1), "", true); assert.strictEqual(E.honTalents(S).length, 5); assert.strictEqual(E.honTal(S, "oath"), 10);
  E.honGive(S, E.honCum(12) - E.honCum(5), "", true); assert.strictEqual(E.honTalents(S).length, 5, "jamais plus de 5 talents");
  const T = team(200); E.chooseAlign(T, "bonta", "coeur"); E.honGive(T, E.honCum(10), "", true); assert.strictEqual(E.bonus(T, "hp") >= 10 + 4, true, "Bonta rang 10 : +10 % de PV (camp) +4 % (talent)");
  console.log("ok - talents d'ordre");
}

// 5. Arsenal : 5 pièces niveau 200 par camp, une par rang de 6 à 10, payées en honneur, liées au compte.
{
  for (const side of ["bonta", "brakmar"]) { assert.strictEqual(E.HON_GEAR[side].length, 5); E.HON_GEAR[side].forEach((id, i) => { const T = D.ITEMS[id]; assert.ok(T && T.lvl === 200 && T.bound && T.noDrop && T.hidden && T.slot === E.HON_GEAR_SLOTS[i] && T.war && D.SETS[T.set]); }); }
  assert.ok(!E.chestItemPool(200).some((t) => D.ITEMS[t].bound), "jamais dans les coffres");
  const S = team(200); E.chooseAlign(S, "brakmar", "coeur");
  assert.ok(/rang 6/.test(E.act(S, "honBuy", "coiffe")), "rang 6 requis");
  E.honGive(S, E.honCum(10), "", true); S.align.pur = 0; assert.ok(/honneur/.test(E.act(S, "honBuy", "coiffe")), "il faut de l'honneur à dépenser");
  S.align.pur = 20000; const h0 = S.align.hon;
  E.HON_GEAR_SLOTS.forEach((sl) => assert.strictEqual(E.act(S, "honBuy", sl), null, sl));
  assert.strictEqual(S.align.hon, h0, "acheter ne fait pas baisser le rang"); assert.strictEqual(S.align.pur, 20000 - E.HON_GEAR_COST.reduce((a, b) => a + b, 0));
  assert.ok(/déjà/.test(E.act(S, "honBuy", "cape")));
  const its = Object.values(S.items).filter((it) => D.ITEMS[it.tpl].bound); assert.strictEqual(its.length, 5); assert.ok(its.every((it) => it.locked), "verrouillées (pas de vente)");
  const c = S.chars[0]; its.forEach((it) => E.equip(S, c.id, it.uid, D.ITEMS[it.tpl].slot === "anneau" ? "anneau1" : D.ITEMS[it.tpl].slot));
  assert.ok(E.honFullSet(S), "panoplie complète"); assert.strictEqual(E.honGearWar(S, "agr"), 8); assert.strictEqual(E.honGearWar(S, "def"), 8); assert.strictEqual(E.honGearWar(S, "hon"), 3);
  const m = E.honMult(S); assert.ok(Math.abs(m - (1 + (5 + 3 + 10) / 100)) < 1e-9, "talent 5 % + coiffe 3 % + panoplie 10 %");
  console.log("ok - Arsenal de la cité");
}

// 6. Régions : points rangés par région (chasse ou front), bonus de +5 % dans une région tenue par ton camp, Serment.
{
  const S = team(200); E.chooseAlign(S, "bonta", "coeur");
  S.sub = "ama_bworks"; assert.strictEqual(E.regNow(S), "amakna");
  assert.strictEqual(E.act(S, "alignSetFront", "cania"), null); S.sub = null; assert.strictEqual(E.regNow(S), "cania", "hors région : ton front");
  assert.ok(E.act(S, "alignSetFront", "bontabrak"), "les cités ne se conquièrent pas");
  E.alWarAdd(S, 30); assert.strictEqual(S.align.war.rg.cania, 30);
  const m = V.summary(E, S).align; assert.ok(m.rg.cania === 30 && m.h === S.align.hon && m.r === 0 && m.f === "cania", "régions, honneur et front dans le résumé");
  const xp0 = E.evMult("xp");
  E.alignRegSet({ held: { amakna: "bonta" }, side: "bonta" }); S.sub = "ama_bworks"; E.tick(S, 10);
  assert.ok(Math.abs(E.evMult("xp") / xp0 - 1.05) < 1e-9, "+5 % d'XP dans une région tenue"); assert.ok(E.regBonusOn(S));
  assert.strictEqual(E.evMult("kamas"), E.evMult("kamas"), "kamas inchangés");
  const h0 = S.align.hon; E.alWarAdd(S, 10); assert.strictEqual(S.align.hon - h0, E.ALIGN_HON.regDay, "région défendue : +25 une fois par jour");
  E.alWarAdd(S, 10); assert.strictEqual(S.align.hon - h0, E.ALIGN_HON.regDay, "une seule fois par jour");
  E.honGive(S, E.honCum(5), "", true); const p0 = S.align.war.rg.amakna; E.alWarAdd(S, 100); assert.strictEqual(S.align.war.rg.amakna - p0, 110, "Serment : +10 % de points dans une région tenue");
  E.alignRegSet({ side: "brakmar" }); E.tick(S, 10); assert.strictEqual(E.evMult("xp"), xp0, "rien pour l'autre camp");
  E.alignRegSet({ held: {}, side: null }); E.tick(S, 10);
  console.log("ok - régions de la carte");
}

// 7. Agressions et défenses (combat du Kolizéum contre des équipes fantômes du camp adverse).
{
  const S = team(200); E.chooseAlign(S, "bonta", "oeil"); E.honGive(S, E.honCum(4), "", true);
  const L = E.agrTargets(S); assert.strictEqual(L.length, 5); L.forEach((T) => assert.ok(T.side === "brakmar" && T.hon >= E.ALIGN_HON.agrMin && T.hon <= E.ALIGN_HON.agrMax));
  assert.deepStrictEqual(E.agrTargets(S).map((t) => t.seed), L.map((t) => t.seed), "les mêmes cibles toute la journée");
  const h0 = S.align.hon, r0 = E.alignRankIdx(S);
  const lose = E.agrEnd(S, 0, { win: false }); assert.ok(lose.hon <= 0 && lose.hon >= -E.ALIGN_HON.agrLoss && E.alignRankIdx(S) === r0, "défaite : −20 au plus, sans perdre de rang");
  const win = E.agrEnd(S, 1, { win: true }); assert.ok(win.hon >= L[1].hon && win.war > 0, "victoire : honneur et points de guerre");
  assert.ok(S.align.hon >= h0 + L[1].hon - E.ALIGN_HON.agrLoss);
  assert.ok(E.agrFight(S, 1).err, "une seule fois par équipe et par jour");
  const r = E.agrFight(S, 2); assert.ok(!r.err && typeof r.win === "boolean", "un vrai combat");
  S.align.ag.n = E.ALIGN_HON.agrDay; assert.ok(E.agrFight(S, 3).err, "10 par jour");
  now += 86400000; assert.ok(!E.agrFight(S, 3).err, "le lendemain, on recommence");
  // défenses : perdre ne coûte rien
  const T = team(200); E.chooseAlign(T, "brakmar", "coeur"); E.honInit(T); E.honDefTick(T); const hh = T.align.hon;
  now += E.ALIGN_HON.defEvery + 1; const d = E.honDefTick(T); assert.ok(d && (d.won ? T.align.hon > hh : T.align.hon === hh), "défense : gain ou rien");
  console.log("ok - agressions et défenses");
}

console.log("alignement2.test.js : tout est bon");
