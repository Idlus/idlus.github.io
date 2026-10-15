/* Boss de guilde et Percepteurs (0.1.22), sans navigateur.
   Lancer : node tests/gboss.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js"); require("../js/gboss.js"); require("../js/koli.js");
const D = require("../js/data.js");

// 1. La semaine change le lundi à minuit (heure de Paris) ; le boss est le même pour tous.
let t = Date.UTC(2030, 0, 6, 22, 59); E.setClock(() => t); // dimanche 23 h 59 à Paris
const w0 = E.gbossWeek(); t += 2 * 60000; assert.strictEqual(E.gbossWeek(), w0 + 1, "lundi minuit à Paris");
assert.ok(E.gbossLeft() > 6.9 * 86400000 && E.gbossLeft() <= 7 * 86400000, "temps restant : une semaine");
assert.deepStrictEqual(E.gboss(w0), E.gboss(w0));
assert.ok(Object.keys(E.GBOSS_POW).length >= 30, "assez de boss calibrés");
for (const did in E.GBOSS_POW) assert.ok(D.DUNGEONS[did] && D.DUNGEONS[did].boss, "boss calibré inconnu : " + did);
console.log("ok - boss : semaine de Paris, même boss pour tous");

// 2. Un essai : même équipe + même numéro = mêmes points ; la partie n'est pas touchée.
const G = E.newState("Équipe", "iop"); G.chars[0].lvl = 80; ["eni", "feca", "cra"].forEach((k, i) => { const x = E.addChar(G, k, "H" + i, 80); x.inTeam = true; });
G.chars.forEach((c) => E.refreshSpells(c, E.charStats(G, c)));
const before = E.serialize(G); const def = E.gboss(w0);
const r1 = E.gbossSim(G, def, 0, t), r2 = E.gbossSim(G, def, 0, t);
assert.deepStrictEqual(r1, r2, "même essai, même résultat");
assert.strictEqual(E.serialize(G), before, "la partie n'est pas touchée");
assert.ok(r1.points >= 0 && r1.rounds <= E.GBOSS_ROUNDS);
assert.strictEqual(E.gbossGoal(2), 3 * E.GBOSS_PER_MEMBER, "au moins 3 membres comptés"); assert.strictEqual(E.gbossGoal(12), 12 * E.GBOSS_PER_MEMBER);
assert.deepStrictEqual(E.gbossChest(50, 100), { k: 52000, dust: 30 }, "même coffre que gb_chest (supabase/gboss.sql)");
console.log("ok - boss : essai rejouable, coffres");

// 3. Percepteurs : places, poche, défense rejouable.
assert.deepStrictEqual([1, 4, 5, 9, 10, 25, 60].map((l) => E.percoSlots(l)), [1, 1, 2, 2, 3, 5, 5], "1.0.30 : un Percepteur dès la fondation");
assert.strictEqual(E.percoSlots(20, true), 6, "Quartier général : 6e Percepteur");
const cap = E.percoCap("ast_champs"); assert.ok(cap.k > 0 && Object.keys(cap.res).length > 0);
G.trophies = { ast_champs: 1 }; assert.deepStrictEqual(E.percoZones(G), ["ast_champs"]);
const seed = E.percoSeed(123, "u"); const p1 = E.percoSim(G, "ast_champs", 0, seed, t), p2 = E.percoSim(G, "ast_champs", 0, seed, t);
assert.deepStrictEqual(p1, p2, "même défense, même résultat"); assert.strictEqual(typeof p1.win, "boolean");
const p3 = E.percoSim(G, "ast_champs", 3, seed, t); assert.ok(p3.foes > p1.foes, "un monstre de plus par défenseur battu");
console.log("ok - Percepteurs : places, poche, défense rejouable");

// 4. 1.0.30 « Refonte des guildes » : boss en 5 phases (choix 12A et 20A).
{
  const goal = E.gbossGoal(5);
  assert.strictEqual(goal, 125000, "25 000 points de vie par membre");
  const T = E.gbossThr(goal);
  assert.deepStrictEqual(T.map((x, i) => x - (i ? T[i - 1] : 0)), [10000, 17500, 25000, 32500, 40000], "phases de la maquette pour 5 membres");
  assert.deepStrictEqual(E.gbossPhase(0, goal), { p: 1, done: 0, cur: 0, need: 10000, T });
  assert.strictEqual(E.gbossPhase(10000, goal).p, 2); assert.strictEqual(E.gbossPhase(14600 + 10000, goal).cur, 14600);
  assert.strictEqual(E.gbossPhase(125000, goal).done, 5, "boss vaincu");
  assert.strictEqual(E.GBOSS_PHASE_K.reduce((a, b) => a + b, 0), 4500000, "4,5 M au coffre pour les 5 phases");
  assert.ok(E.gbossDmg(1) === 1 && E.gbossDmg(3) > E.gbossDmg(2) && E.gbossDmg(5) > E.gbossDmg(4), "chaque phase plus dure");
  // réserve : +1 toutes les 25 min (20 avec le Cor), 6 au plus
  assert.strictEqual(E.gbossTok(0, 0, 25 * 60000), 1); assert.strictEqual(E.gbossTok(0, 0, 40 * 60000, 20), 2);
  assert.strictEqual(E.gbossTok(5, 0, 99 * 3600000), E.GBOSS_RESERVE, "6 en réserve au plus");
  assert.strictEqual(E.gbossNextIn(6), 0); assert.strictEqual(E.gbossNextIn(2.5), 12.5 * 60000);
  // la phase rend le boss plus dur, même graine = même essai
  const a = E.gbossSim(G, def, 1, t, 1), b = E.gbossSim(G, def, 1, t, 5), c = E.gbossSim(G, def, 1, t, 5);
  assert.deepStrictEqual(b, c); assert.strictEqual(b.raw, a.raw, "même essai, même combat"); assert.ok(a.points > 10 && b.points < a.points, "phase 5 : le boss résiste davantage");
  console.log("ok - boss : 5 phases, réserve d'essais");
}

// 5. Percepteurs 1.0.30 : donjons, gains, améliorations, attaques entre guildes.
{
  const dj = E.percoCap("donjon_tofus"), dg = D.DUNGEONS.donjon_tofus;
  assert.ok(dj && dj.dj === 1 && dj.k === Math.round(1000 * dg.lvl * 5 / 3 * 1.5), "donjon : poche +50 %");
  const bossDrops = new Set((D.MONSTERS[dg.boss].drops || []).map((x) => x[0]).filter((n) => !dg.rooms.some((r) => r.mobs.some((m) => m !== dg.boss && (D.MONSTERS[m].drops || []).some((y) => y[0] === n)))));
  assert.ok(Object.keys(dj.res).every((n) => !bossDrops.has(n) && !/dofus/i.test(n)), "jamais d'objet du boss ni de Dofus");
  const G2 = E.newState("P", "iop"); G2.trophies = { ast_champs: 1 }; E.stasisInfo(G2, "donjon_tofus").max = 1; E.stasisInfo(G2, "antre_dragon_cochon").max = 0;
  assert.deepStrictEqual(E.percoZones(G2), ["ast_champs", "donjon_tofus"], "zone finie ou donjon fait en stasis 1");
  assert.strictEqual(E.percoLvl("donjon_tofus"), dg.lvl); assert.ok(E.percoIsDj("donjon_tofus") && !E.percoIsDj("ast_champs"));
  const d1 = E.percoSim(G, "donjon_tofus", 0, 9, t), d2 = E.percoSim(G, "donjon_tofus", 0, 9, t);
  assert.deepStrictEqual(d1, d2, "défense d'un Percepteur de donjon rejouable"); assert.ok(!d1.err && d1.foes >= 3);
  const before = G.chars.map((c) => c.xp); E.percoTeamXp(G, 0.05, 40); assert.ok(G.chars.every((c, i) => c.xp > before[i]), "Sagesse : XP pour l'équipe qui récolte");
  // gains : Poche +10 % par rang, Prospection sur les ressources rares
  const cap = E.percoCap("ast_tainela"), g0 = E.percoGain(cap, 1), g1 = E.percoGain(cap, 1, { poche: 4, prospection: 10 });
  assert.strictEqual(g0.k, cap.k); assert.strictEqual(g1.k, Math.floor(cap.k * 1.4));
  for (const n in cap.res) assert.strictEqual(g1.res[n], Math.floor(cap.res[n] * 1.4 * (cap.res[n] < E.PERCO_RARE ? 2 : 1)), n);
  assert.strictEqual(E.percoGain(cap, 0.5).k, Math.floor(cap.k / 2));
  // chiffres de la maquette : poche pleine en zone 65 / 116 / 144 ≈ 108 k / 193 k / 240 k, et ≈ 1,2 M par jour pour 3 Percepteurs vers le niveau 120
  const zk = (L) => Math.round(1000 * L * E.PERCO_RATE / 3);
  assert.deepStrictEqual([65, 116, 144].map(zk), [108333, 193333, 240000]);
  assert.ok(Math.abs(3 * 2 * zk(120) - 1200000) <= 1, "3 Percepteurs, 2 récoltes par jour vers le niveau 120");
  // places et améliorations
  assert.deepStrictEqual([6, 10, 15].map(E.guildSeatPrice), [250000, 6250000, 25000000]);
  assert.strictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, r) => a + E.guildRankPrice(r), 0), 38500000, "38,5 M pour les 10 rangs");
  assert.strictEqual(E.GUILD_UQ.reduce((a, u) => a + u.cost, 0), 61000000, "61 M pour les 8 améliorations uniques");
  assert.deepStrictEqual(E.GUILD_UQ.map((u) => u.lvl), [3, 5, 8, 10, 12, 15, 18, 20]);
  const S3 = { guild: { ups: { comptoir: 1, poche: 3 } } };
  assert.ok(E.guildHas(S3, "comptoir") && !E.guildHas(S3, "vigie") && E.guildUp(S3, "poche") === 3 && !E.guildHas({}, "comptoir"));
  // attaques : butin, gardes du Percepteur rejouables et plus forts avec la Robustesse
  assert.strictEqual(E.raidPart(30, 25), 0.5); assert.strictEqual(E.raidPart(30, 20), 0.25, "÷ 2 contre 10 niveaux de moins"); assert.strictEqual(E.raidPart(30, 25, true), 0.25, "Coffre-fort");
  assert.deepStrictEqual(E.raidLoot({ k: 1001, res: { a: 3, b: 1 } }, 0.5), { k: 500, res: { a: 1 } });
  const gA = E.percoGuards(77, 120, 0), gB = E.percoGuards(77, 120, 0), gR = E.percoGuards(77, 120, 10);
  assert.deepStrictEqual(gA, gB, "mêmes gardes pour la même graine");
  assert.strictEqual(gA.length, E.KOLI.size); assert.strictEqual(gA[0].n, "Percepteur");
  assert.ok(gR[0].st.hpMax > gA[0].st.hpMax && gR[0].st.dsort > gA[0].st.dsort, "Robustesse : plus de PV et de dommages");
  const T = E.koliGhost(5, 120); const s = E.raidSeed(12, "perco");
  assert.deepStrictEqual(E.koliSim(T, gA, s), E.koliSim(T, gA, s), "combat contre le Percepteur rejouable");
  assert.notStrictEqual(E.raidSeed(12, "u1"), E.raidSeed(12, "u2"));
  console.log("ok - Percepteurs 1.0.30 : donjons, gains, améliorations, attaques");
}

// Chasse aux Percepteurs : vétérans (+2 % par étoile, comme 2/3 de rang de Robustesse), nom fixe, Nuit des Percepteurs, domination
{
  const g0 = E.percoGuards(77, 120, 0, 0), g5 = E.percoGuards(77, 120, 0, 5), g9 = E.percoGuards(77, 120, 0, 9);
  assert.deepStrictEqual(E.percoGuards(77, 120, 0), g0, "sans étoile : mêmes gardes qu'avant");
  assert.ok(Math.abs(g5[0].st.dsort - g0[0].st.dsort - 10) < 1e-9, "5 étoiles : +10 % de dommages");
  assert.deepStrictEqual(g9, g5, "5 étoiles au plus");
  assert.strictEqual(E.percoNick(41), E.percoNick(41)); assert.ok(/^\S+ \S+$/.test(E.percoNick(41)));
  assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(E.percoNick)).size >= 7, "noms variés");
  const sat = (h, m) => Date.UTC(2026, 9, 17, h - 2, m || 0); // samedi 17/10/2026, Paris = UTC+2
  assert.ok(!E.huntNight(sat(19, 59)) && E.huntNight(sat(20)) && E.huntNight(sat(22, 59)) && !E.huntNight(sat(23)), "samedi de 20 h à 23 h, heure de Paris");
  assert.ok(!E.huntNight(Date.UTC(2026, 9, 16, 19)), "pas le vendredi");
  assert.deepStrictEqual(E.huntNightLeft(sat(19)), { on: false, ms: 3600e3 }); assert.deepStrictEqual(E.huntNightLeft(sat(21, 30)), { on: true, ms: 5400e3 });
  assert.strictEqual(E.huntNightLeft(sat(23)).ms, 7 * 864e5 - 3 * 3600e3, "la suivante : samedi prochain");
  const subs = Object.keys(E.SUBS).filter((k) => E.SUBS[k].zone === E.SUBS[Object.keys(E.SUBS)[0]].zone);
  const dj = Object.keys(E.DUNGEON_SUB).find((d) => subs.includes(E.DUNGEON_SUB[d]));
  const z = E.huntRegion(subs[0]); assert.strictEqual(E.huntRegion(dj), z, "un donjon compte dans la région de sa zone");
  assert.deepStrictEqual(E.huntDomination([{ sid: subs[0], gid: 1 }, { sid: dj, gid: 1 }, { sid: subs[1], gid: 2 }])[z], { gid: 1, n: 2, tot: 3, tie: false });
  assert.deepStrictEqual(E.huntDomination([{ sid: subs[0], gid: 1 }, { sid: subs[1], gid: 2 }])[z], { gid: null, n: 1, tot: 2, tie: true }, "égalité : territoire disputé");
  console.log("ok - Chasse aux Percepteurs : vétérans, Nuit des Percepteurs, domination");
}
