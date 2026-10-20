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
  assert.ok(E.honFullSet(S), "panoplie complète"); assert.strictEqual(E.honGearWar(S, "agr"), 4); assert.strictEqual(E.honGearWar(S, "def"), 4); assert.strictEqual(E.honGearWar(S, "hon"), 3);
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
  S.align.ag.n = E.ALIGN_HON.agrDay; assert.strictEqual(E.ALIGN_HON.agrDay, 5); assert.ok(E.agrFight(S, 3).err, "5 par jour");
  now += 86400000; assert.ok(!E.agrFight(S, 3).err, "le lendemain, on recommence");
  // défenses : perdre ne coûte rien
  const T = team(200); E.chooseAlign(T, "brakmar", "coeur"); E.honInit(T); E.honDefTick(T); const hh = T.align.hon;
  now += E.ALIGN_HON.defEvery + 1; const d = E.honDefTick(T); assert.ok(d && (d.won ? T.align.hon > hh : T.align.hon === hh), "défense : gain ou rien");
  console.log("ok - agressions et défenses");
}

// 8. Étude PvP n° 2 (1A 2A 3A 4A 5A) : fantômes modérés, panoplies V5, lignes de guerre à 2 %, 5 agressions, Serment sur place.
{
  const S = team(200); E.chooseAlign(S, "bonta", "coeur");
  assert.deepStrictEqual(E.agrTargets(S).map((t) => t.m), [-0.3, -0.2, -0.1, 0, 0.15], "niveau 200 : renfort −30 % à +15 %");
  for (const L of [50, 100, 150, 199]) { const T = team(L); E.chooseAlign(T, "bonta", "coeur"); assert.deepStrictEqual(E.agrTargets(T).map((t) => t.m), [-0.3, -0.2, -0.1, -0.1, 0], `niveau ${L} : Serrée allégée, pas de renfort positif`); }
  const T4 = E.agrTargets(S)[4], g0 = E.koliGhost(T4.seed, T4.lvl, T4.n), g1 = E.agrGhost(T4);
  g0.forEach((h, k) => { assert.strictEqual(g1[k].st.hpMax, Math.round(h.st.hpMax * 1.15)); assert.ok(Math.abs(g1[k].st.dsort - ((h.st.dsort || 0) + 15)) < 1e-9); });
  const T0 = E.agrTargets(S)[0]; assert.strictEqual(E.agrGhost(T0)[0].st.hpMax, Math.round(E.koliGhost(T0.seed, T0.lvl, T0.n)[0].st.hpMax * 0.7));
  assert.deepStrictEqual(D.SETS.milice_b.bonus[5], { vit: 400, pui: 40, do: 5, rn: 7, rt: 7, rf: 7, re: 7, ra: 7 });
  assert.deepStrictEqual(D.SETS.milice_k.bonus[5], { pui: 50, do: 8, cri: 3 }); assert.deepStrictEqual(D.SETS.milice_k.bonus[3], { pui: 30, cri: 3 });
  E.HON_GEAR.bonta.forEach((id) => { assert.deepStrictEqual(D.ITEMS[id].stats.pui, [12, 18]); assert.deepStrictEqual(D.ITEMS[id].stats.do, [3, 5]); });
  assert.deepStrictEqual(D.ITEMS.hon_brakmar_anneau.stats.do, [7, 11], "Brâkmar : dommages ×1,5 puis ×0,75");
  E.HON_GEAR_SLOTS.forEach((sl, i) => { const w = D.ITEMS[E.HON_GEAR.bonta[i]].war; assert.strictEqual(w.v, w.k === "hon" ? 3 : 2); });
  // Serment : seulement l'honneur gagné dans une région tenue (région défendue, donjons), pas les agressions
  const B = team(200); E.chooseAlign(B, "bonta", "coeur"); E.honGive(B, E.honCum(5), "", true);
  E.alignRegSet({ held: { amakna: "bonta" }, side: "bonta" }); B.sub = "ama_bworks";
  let h = B.align.hon; E.honGive(B, 100, "agression"); assert.strictEqual(B.align.hon - h, 105, "agression : talent +5 % seulement");
  assert.strictEqual(E.HON_XP_DIV, 100, "XP d'alignement → honneur : 1 pour 100 (A2)");
  h = B.align.hon; E.giveAlignXp(B, 10000, 1); assert.strictEqual(B.align.hon - h, 115, "activité faite en région tenue : Serment");
  h = B.align.hon; E.giveAlignXp(B, 10000); assert.strictEqual(B.align.hon - h, 105, "sans lieu (remise, rang) : pas de Serment, même en chassant en région tenue");
  // le lieu de l'activité compte, pas celui où l'on reçoit la récompense (repro : scratchpad serment/repro.js)
  const sub = (r) => Object.keys(E.SUBS).find((k) => E.regOfSub(k) === r), dgAt = (inR) => Object.keys(D.DUNGEONS).find((d) => (E.regOfSub(E.DUNGEON_SUB[d]) === "amakna") === inR && E.regOfSub(E.DUNGEON_SUB[d]));
  const terrOf = (f) => { const g0 = E.honGive, L = []; E.honGive = (S2, n, why, raw, terr) => { if (/alignement|donjon/.test(why) && n > 0 && !raw) L.push(+terr || 0); return g0(S2, n, why, raw, terr); }; try { f(); } finally { E.honGive = g0; } return L; };
  B.sub = sub("amakna"); assert.deepStrictEqual(terrOf(() => E.emit(B, "dungeon", { id: dgAt(false), stasis: 1, chals: [], down: 0 })), [0, 0], "donjon hors région, chasse en région tenue : pas de Serment");
  B.sub = sub("astrub"); assert.deepStrictEqual(terrOf(() => E.emit(B, "dungeon", { id: dgAt(true), stasis: 1, chals: [], down: 0 })).sort(), [1, 1], "donjon en région tenue : Serment");
  const key = Object.keys(D.MONSTERS)[0]; B.bounties = [{ id: "bx", key, n: 10, prog: 0, xp: 0, kamas: 0, axp: 1000 }];
  for (let k = 0; k < 9; k++) E.emit(B, "win", { sub: sub("astrub"), mons: [{ key }] });
  B.sub = sub("amakna"); assert.deepStrictEqual(terrOf(() => E.emit(B, "win", { sub: sub("amakna"), mons: [{ key }] })), [0.1], "avis : au prorata des monstres vaincus en région tenue");
  { const Q = B.align.q; const ci = E.ALIGN_CH.bonta.findIndex((C) => C.steps.some((st) => st.t === "res")); Q.c = ci; Q.i = E.ALIGN_CH.bonta[ci].steps.findIndex((st) => st.t === "res"); const st = E.alStep(B); B.res[st.res] = st.n;
    assert.deepStrictEqual(terrOf(() => E.act(B, "alGive")), [0], "remise de ressources : pas de Serment, où que l'on soit"); }
  B.align.ag.reg = -1; h = B.align.hon; E.alWarAdd(B, 10); assert.strictEqual(B.align.hon - h, Math.round(E.ALIGN_HON.regDay * 1.15), "région défendue : Serment");
  E.alignRegSet({ held: {}, side: null });
  console.log("ok - étude PvP n° 2");
}

// 9. Le serveur (fonction « record ») charge js/honneur.js : honneur, rang et pièces de rang ; supabase/alignement2.sql tolère les anciens envois
{
  const fs = require("fs"), path = require("path"); const R = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.ok(/"alignement", "honneur"\]/.test(R("tools/build_server.js")), "honneur.js dans le code du serveur, après alignement.js");
  const q = R("supabase/alignement2.sql");
  assert.ok(/jsonb_typeof\(a->'h'\) = 'number'/.test(q), "SQL : honneur seulement s'il est envoyé et numérique");
  assert.ok(/h := least\(h, o\.hon \+ 100\)/.test(q), "SQL : honneur plafonné après un changement de camp");
  assert.ok(/align_regions_cache/.test(q) && /align_regions_ttl\(\) returns interval language sql immutable as \$\$ select interval '3 minutes'/.test(q), "SQL : état des régions gardé 3 minutes");
  console.log("ok - serveur et SQL de la refonte");
}

console.log("alignement2.test.js : tout est bon");

// 10. Rendu de l'équipement de rang supprimé par un vieil onglet v13
{
  const S10 = team(200);
  if (S10) {
    E.chooseAlign(S10, "bonta", "coeur"); S10.honGear = { hon_bonta_coiffe: 1 };
    const S2 = E.deserialize(E.serialize(S10));
    const n = Object.values(S2.items).filter((it) => it.tpl === "hon_bonta_coiffe");
    if (n.length !== 1 || !n[0].locked) throw new Error("équipement de rang non rendu");
    const S3 = E.deserialize(E.serialize(S2));
    if (Object.values(S3.items).filter((it) => it.tpl === "hon_bonta_coiffe").length !== 1) throw new Error("équipement de rang dupliqué");
    console.log("ok 10 équipement de rang rendu après vieil onglet");
  }
}
