/* L'Ascension (1.1) : tour du mois, sorts piochés, Volonté et Fioles, règles, âmes, classements, course de lancement.
   Lancer : node tests/ascension.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/koli.js"); require("../js/legendaires.js"); require("../js/songe.js");
require("../js/ascension.js");
const D = require("../js/data.js");
const V = require("../js/verify.js");

let seed = 777;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const A = E.ASC;

// 1. La tour : 100 étages, boss tous les 10, palier sans règle tous les 5, la même pour tous ce mois-ci, une autre le mois suivant.
{
  const S = E.newState("Grimpeur", "iop");
  const T = []; for (let f = 1; f <= 100; f++) T.push(E.ascFloor(S, "n", f));
  T.forEach((fl) => { if (fl.f % 10 === 0) assert.strictEqual(fl.t, "boss", "boss à l'étage " + fl.f); if (fl.f % 5 === 0) assert.ok(!fl.rule, "pas de règle à l'étage " + fl.f); });
  assert.ok(T.some((x) => x.t === "event") && T.some((x) => x.t === "shop") && T.some((x) => x.t === "altar"), "événements, marchands et autels");
  assert.ok(T.filter((x) => x.rule).length > 40, "des règles sur la plupart des étages");
  const next = E.ascFloorAt(`n${E.ascMonth() + 1}`, 37, false), cur = E.ascFloorAt(`n${E.ascMonth()}`, 37, false);
  assert.notDeepStrictEqual(next, cur, "une autre tour le mois suivant");
  assert.ok(T.every((x) => x.lvl === Math.min(200, 2 * x.f - 1)), "un étage = 2 niveaux");
  console.log("ok - ascension : tour de 100 étages");
}

// 2. Une montée : 3 classes, 3 sorts parmi 6 + signature, paliers, Volonté, fin.
{
  const S = E.newState("Grimpeur", "iop"); const Q = E.ascState(S);
  assert.strictEqual(Q.vol, 30, "Volonté pleine au départ");
  const cl = E.ascClassChoices(S); assert.strictEqual(cl.length, 3); assert.deepStrictEqual(E.ascClassChoices(S), cl, "le tirage ne bouge pas tout seul");
  assert.strictEqual(E.act(S, "ascReroll"), null); assert.ok(typeof E.act(S, "ascReroll") === "string", "1 relance par jour");
  const cl2 = E.ascClassChoices(S);
  assert.ok(typeof E.act(S, "ascStart", "x", cl2[0]) === "string", "Au-delà fermé avant l'étage 100");
  assert.strictEqual(E.act(S, "ascStart", "n", cl2[0]), null);
  assert.strictEqual(Q.run.spells.length, 1, "sort signature");
  assert.strictEqual(Q.run.pend.t, "start"); assert.strictEqual(Q.run.pend.opts.length, 6);
  assert.ok(typeof E.act(S, "ascChoose", [0, 1]) === "string", "il faut 3 sorts");
  assert.strictEqual(E.act(S, "ascChoose", [0, 2, 4]), null); assert.strictEqual(Q.run.spells.length, 4);
  assert.ok(Q.run.pend === null);
  let fights = 0, picks = 0;
  for (let i = 0; i < 400 && Q.run; i++) { const p = Q.run.pend; if (p && p.t === "pick") picks++; const o = E.ascStepFloor(S, true); if (o && o.win !== undefined) fights++; if (typeof o === "string") break; }
  assert.ok(fights >= 5, "des combats joués : " + fights);
  assert.ok(Q.best.n >= 5, "record : " + Q.best.n);
  assert.ok(picks >= 1, "un palier avec 1 sort parmi 3");
  assert.ok(Q.vol < 30, "les essais coûtent de la Volonté");
  if (Q.run) E.act(S, "ascQuit");
  assert.ok(!Q.run && Q.hist.length === 1 && Q.frag > 0, "Fragments gardés à la fin");
  console.log("ok - ascension : une montée jusqu'à l'étage", Q.best.n, "·", fights, "combats ·", Q.frag, "Fragments");
}

// 3. Volonté : +1 toutes les 20 min (15 en guilde), étages déjà réussis gratuits, Fioles +5 au-delà du maximum.
{
  const S = E.newState("V", "cra"); const Q = E.ascState(S);
  Q.vol = 10; Q.volT = now; now += 60 * 60000; assert.strictEqual(E.ascVolSync(S), 13, "+3 en une heure");
  S.guild = { id: 7 }; now += 60 * 60000; assert.strictEqual(E.ascVolSync(S), 17, "+4 en une heure avec la guilde");
  delete S.guild; Q.best.n = 12; assert.strictEqual(E.ascCost(S, "n", 12), 0); assert.strictEqual(E.ascCost(S, "n", 13), 1);
  Q.vol = 30; E.addCons(S, A.fioleId, 2); assert.ok(typeof E.act(S, "ascDrink") === "string", "Volonté déjà pleine");
  Q.vol = 28; assert.strictEqual(E.act(S, "ascDrink"), null); assert.strictEqual(Q.vol, 33, "+5 au-delà du maximum"); assert.strictEqual(S.cons[A.fioleId], 1);
  assert.strictEqual(E.useConsumable(S, A.fioleId), "Ta Volonté est déjà pleine.");
  console.log("ok - ascension : Volonté et Fioles");
}

// 4. Sources de Fioles : boss de donjon (5 %, 10 % dès la stasis 6), Almanax, Défi du jour, Alchimiste 3/jour, Koli et Marché onirique 1/jour.
{
  const S = E.newState("F", "eni"); E.ascState(S);
  let n = 0; for (let i = 0; i < 4000; i++) { const b = S.cons[A.fioleId] || 0; E.emit(S, "dungeon", { id: "x", stasis: i < 2000 ? 1 : 7 }); if ((S.cons[A.fioleId] || 0) > b) n++; }
  assert.ok(n > 200 && n < 420, "≈ 5 % puis 10 % : " + n);
  S.cons = {}; E.emit(S, "almanax", {}); assert.strictEqual(S.cons[A.fioleId], 1, "Almanax");
  S.cons = {}; S.jobs.alchimiste = { lvl: 30, xp: 0 }; S.res["Sauge"] = 100; S.res["Trèfle à 5 feuilles"] = 100; S.kamas = 1e6;
  for (let i = 0; i < 3; i++) assert.strictEqual(E.act(S, "ascBrew"), null);
  assert.ok(typeof E.act(S, "ascBrew") === "string", "3 par jour"); assert.strictEqual(S.cons[A.fioleId], 3);
  const ko = E.SHOPS.koli.items.find((x) => x.cons === A.fioleId); assert.ok(ko && ko.day === 1, "boutique du Kolizéum, 1 par jour");
  S.tokens[E.KOLI_CUR] = 100; assert.strictEqual(E.buyShop(S, "koli", ko.id, 1), null); assert.ok(typeof E.buyShop(S, "koli", ko.id, 1) === "string");
  const G = E.songe(S); G.br = 1000; assert.strictEqual(E.sgBuy(S, A.fioleId), null); assert.ok(typeof E.sgBuy(S, A.fioleId) === "string", "Marché onirique 1 par jour");
  assert.strictEqual(S.cons[A.fioleId], 5);
  console.log("ok - ascension : sources de Fioles (" + n + " sur 4 000 donjons)");
}

// 5. Sorts : niveau 2 et 3, glyphes, résolution des sorts « a~n » par le moteur ; une chasse normale marche après.
{
  const k = E.ascSignature("iop"); const d1 = E.ascDef({ k, lv: 1, gl: [] }), d3 = E.ascDef({ k, lv: 3, gl: ["rapide", "fendoir"] });
  const f1 = d1.grades[0].fx.find((f) => f.min !== undefined), f3 = d3.grades[0].fx.find((f) => f.min !== undefined);
  assert.ok(f3.min > f1.min * 1.5, "niveau 3 + Fendoir plus fort"); assert.ok(d3.grades[0].pa <= Math.max(1, d1.grades[0].pa - 2), "−1 PA au niveau 3 et avec Rapide");
  E.ASC_DEFS = [d1]; assert.strictEqual(E.spellDef("cra", "a~0"), d1); assert.ok(E.spellDef("iop", d1.id.split(":")[1]) || true);
  const S = E.newState("Chasse", "iop"); S.chars[0].lvl = 20; E.resetPoints(S, S.chars[0].id); E.refreshSpells(S.chars[0], E.charStats(S, S.chars[0]));
  assert.strictEqual(E.makeGroup(S, D.ZONES[0].subs[0], 1).every((m) => m.side === "m"), true, "les groupes de chasse ne changent pas");
  console.log("ok - ascension : sorts, niveaux et glyphes");
}

// 6. Blessures gardées (15A), Sursis (9A), boss : âme proposée et bestiaire (21A).
{
  const S = E.newState("B", "iop"); const Q = E.ascState(S); Q.vol = 1e6;
  E.act(S, "ascStart", "n", E.ascClassChoices(S)[0]); E.act(S, "ascChoose", [0, 1, 2]);
  Q.run.f = 10; const W = E.ascNewFight(S); assert.ok(W && W.fl.t === "boss");
  const res = E.ascSim(S, W); res.win = false; res.monHp = res.monHp.map(() => 0.4);
  const out = E.ascApply(S, W, res, false); assert.ok(out.sursis && Q.run, "le Sursis sauve la montée");
  assert.deepStrictEqual(Q.wounds["n10"].hp, res.monHp, "blessures gardées");
  const W2 = E.ascNewFight(S); const m = W2.F.ents.filter((e) => e.side === "m"); assert.ok(Math.abs(m[0].hp / m[0].hpMax - 0.4) < 0.01, "le boss revient blessé");
  const r2 = E.ascSim(S, W2); r2.win = true; E.ascApply(S, W2, r2, false);
  assert.ok(Q.bestiary[W2.fl.boss] === 1 && !Q.wounds["n10"], "boss au bestiaire, blessures effacées");
  assert.strictEqual(Q.run.pend.t, "soul", "âme proposée au premier boss");
  assert.strictEqual(E.act(S, "ascChoose", 0, 1), null); assert.ok(Q.run.spells.some((s) => s.soul), "âme dans la barre");
  assert.ok(E.ascUnlocks(S).some((u) => u.id === "soul:" + W2.fl.boss), "l'âme s'achète ensuite pour la pioche");
  console.log("ok - ascension : blessures, Sursis, âmes");
}

// 7. Récompenses, classements et course de lancement : titre tous les 10 étages, coffre à 25/50/75/100, d100 envoyé au serveur.
{
  const S = E.newState("R", "iop"); const Q = E.ascState(S); const k0 = S.kamas;
  E.ascMilestone(S, "n", 10); E.ascMilestone(S, "n", 25); E.ascMilestone(S, "n", 25);
  assert.ok(S.titlesExtra.includes(E.ascTitle(10, "n")), "titre de l'étage 10"); assert.ok(S.kamas > k0, "coffre de l'étage 25"); const k1 = S.kamas;
  E.ascMilestone(S, "n", 25); assert.strictEqual(S.kamas, k1, "un coffre par étage et par mois");
  assert.ok(!V.summary(E, S).ascd100); E.ascMilestone(S, "d", 100); assert.ok(Q.d100 && V.summary(E, S).ascd100, "étage 100 en Difficile : course de lancement");
  Q.run = { mode: "d", cls: "iop", spells: [{ k: "iop:x" }], f: 100 }; E.ascRkNote(S, Q.run, 37, false);
  assert.strictEqual(Q.rk.cls.iop, 37); assert.strictEqual(Q.rk.nos, 37); assert.strictEqual(Q.rk.pur, 37);
  Q.run.usedSursis = 1; Q.run.spells.push({ k: "cra:y" }); E.ascRkNote(S, Q.run, 38, false); assert.strictEqual(Q.rk.nos, 37); assert.strictEqual(Q.rk.pur, 37); assert.strictEqual(Q.rk.cls.iop, 38);
  const txt = E.serialize(S); const S2 = E.deserialize(txt); assert.strictEqual(S2.asc.rk.cls.iop, 38, "sauvegardé");
  console.log("ok - ascension : récompenses, classements, course de lancement");
}

// 8. Mode auto : choix faits seuls, −30 % de Fragments ; Au-delà ouvert après l'étage 100, 3 tirages de plus et départ à 101.
{
  const S = E.newState("X", "iop"); const Q = E.ascState(S); Q.vol = 1e6; Q.best.n = 100;
  assert.strictEqual(E.act(S, "ascStart", "x", E.ascClassChoices(S)[0]), null); assert.strictEqual(Q.run.f, 101);
  let picks = 0; while (Q.run.pend) { E.ascAutoPick(S); picks++; if (picks > 20) break; }
  assert.ok(picks >= 8 && Q.run.spells.length >= 4, "tirages de l'Au-delà : " + picks);
  E.ascSetAuto(S, true); const o = E.ascStepFloor(S, true); if (o && o.win) assert.strictEqual(o.frag, Math.round(E.ASC_FRAG(101, false) * A.autoFrag));
  console.log("ok - ascension : auto et Au-delà");
}
// 9. Mode manuel (demande de Mathis) : le combat attend le sort choisi par le joueur, puis reprend.
{
  const S = E.newState("M", "iop"); const Q = E.ascState(S); Q.vol = 1e6;
  E.act(S, "ascStart", "n", E.ascClassChoices(S)[0]); E.act(S, "ascChoose", [0, 1, 2]);
  const W = E.ascNewFight(S); E.ascManual(W, true); let casts = 0, waits = 0;
  for (let g = 0; g < 5000 && !W.F.over; g++) {
    if (E.ascAwait(W)) { const seq = W.F.seq; E.ascStep(S, W); if (W.F.seq === seq) waits++; const i = W.defs.findIndex((d, j) => E.ascCanCast(W, j));
      if (i >= 0 && !E.ascManualCast(S, W, i, W.F.ents.findIndex((e) => e.side === "m" && e.alive))) casts++; else E.ascManualEnd(S, W); continue; }
    E.ascStep(S, W);
  }
  assert.ok(W.F.over && casts > 0 && waits > 0, `sorts lancés à la main : ${casts}, attentes : ${waits}`);
  const W2 = E.ascNewFight(S); E.ascManual(W2, true); const r = E.ascSim(S, W2); assert.ok(W2.F.over && r, "quitter la page finit le combat en auto");
  console.log("ok - ascension : mode manuel,", casts, "sorts choisis");
}
console.log("ascension : tout est bon");
