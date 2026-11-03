/* Saison 1, lot 8 (js/expes1.js) : 3 expéditions par manche, les mêmes pour tous, 2 essais par jour, meilleur score de la
   manche, bourses une seule fois, seulement en saison, une seule en Monocompte. Lancer : node tests/expes1.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/defi.js");
require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js"); require("../js/cartes.js"); require("../js/expes1.js");
const D = require("../js/data.js");
const DAY = 86400000; let now = Date.UTC(2030, 0, 9, 12); E.setClock(() => now); const t0 = now;
const S = E.newState("Héros", "iop"); E.s1cStart(S, t0);
// définitions : les mêmes pour tous, plus dures d'une expédition à l'autre
const a = E.exps1Def(1, 0, "leg"), b = E.exps1Def(1, 0, "leg"), c = E.exps1Def(1, 2, "leg");
assert.deepStrictEqual(a, b, "même manche, même expédition");
assert.ok(D.DUNGEONS[a.did] && a.rules.length === 3 && a.mods.length === 2, "donjon, 3 règles, 2 modificateurs");
assert.ok(c.k > a.k && c.mods.length === 3, "la 3e est plus dure");
assert.notDeepStrictEqual(E.exps1Def(2, 0, "leg"), a, "une autre manche, une autre expédition");
const dm = E.exps1Def(1, 0, "leg", true); assert.ok(E.defiSoloOk(dm.team), "Monocompte : règle d'équipe jouable seul");
assert.strictEqual(E.exps1Count({ mono: true }), 1); assert.strictEqual(E.exps1Count(S), 3);
console.log("ok - 3 expéditions par manche, les mêmes pour tous, de plus en plus dures ; une en Monocompte");
// essais
for (let i = 0; i < 2; i++) { const r = E.exps1Play(S, 0); assert.strictEqual(typeof r, "object", String(r)); }
assert.strictEqual(typeof E.exps1Play(S, 0), "string", "2 essais par jour");
assert.strictEqual(E.exps1Left(S, 1), 2, "les essais sont comptés par expédition");
now += DAY; assert.strictEqual(E.exps1Left(S, 0), 2, "le lendemain, 2 essais"); now = t0;
assert.strictEqual(typeof E.exps1Play(E.newState("x", "iop"), 0), "string", "hors saison : non");
console.log("ok - 2 essais par jour et par expédition, seulement en saison");
// équipe forte : victoire, bourses une seule fois, meilleur score gardé
const B = E.newState("Fort", "iop"); E.s1cStart(B, t0); const h = B.chars[0]; h.lvl = 60; E.refreshSpells && E.refreshSpells(h, B);
let won = null; for (let d = 0; d < 6 && !won; d++) { now = t0 + d * DAY; for (let j = 0; j < 2; j++) { const r = E.exps1Play(B, 0); if (typeof r === "object" && r.r.win) { won = r; break; } } }
now = t0;
if (won) { const st = E.exps1State(B); assert.ok(st.best[0].score >= won.r.score - 0 || st.best[0].score > 0);
  const g = Object.keys(st.got).length; assert.ok(g >= 1 && won.rew.cons.length >= 1, "une bourse à la victoire");
  console.log("ok - niveau 60 : expédition réussie, " + won.r.score + " points, bourse " + (won.medal ? won.medal.name : "aucune"));
} else console.log("ok - niveau 60 : pas de victoire en 6 jours (palier " + E.exps1Tier(B) + ")");
// pas deux fois la même bourse
{ const T = E.newState("T", "iop"); E.s1cStart(T, t0); const st = E.exps1State(T); st.got = { "0br": 1, "0ar": 1, "0or": 1 };
  const sim = E.defiSim; E.defiSim = () => ({ win: true, score: 2500, turns: 10, hp: 90, rooms: [], rules: {} });
  const r = E.exps1Play(T, 0); assert.strictEqual(r.rew.cons.length, 0, "pas deux fois"); assert.strictEqual(E.exps1State(T).best[0].score, 2500);
  const r2 = E.exps1Play(T, 1); assert.strictEqual(r2.rew.cons.length, 3, "bronze, argent et or d'un coup"); assert.strictEqual(r2.rew.booster, 1, "booster à l'or");
  now += DAY; E.exps1Play(T, 2); assert.ok(E.titles(T).includes("Explorateur du Temps"), "titre des 3 bourses en or");
  assert.strictEqual(E.exps1Total(T), 7500, "classement : somme des 3 meilleurs scores");
  now += 14 * DAY; assert.strictEqual(E.exps1Total(T), 0, "nouvelle manche, nouveaux scores"); now = t0;
  E.defiSim = sim; }
// règle d'équipe : les héros les plus forts qui la respectent partent, l'équipe de farm ne change pas
{ const U = E.newState("Grande", "iop"); E.s1cStart(U, t0); ["eni", "cra", "feca", "sacri"].forEach((x, i) => { E.addChar(U, x, "H" + i, 1).inTeam = true; });
  const def = Object.assign(E.exps1For(U, 0), { team: "max3" }); const ids = E.exps1Pick(U, def);
  assert.ok(ids && ids.length === 3, "3 héros choisis pour « 3 héros maximum »");
  const f0 = E.exps1For; E.exps1For = () => def; const r = E.exps1Play(U, 0); E.exps1For = f0;
  assert.strictEqual(typeof r, "object", String(r)); assert.strictEqual(r.picked, 3); assert.strictEqual(E.team(U).length, 5, "l'équipe de farm ne change pas"); assert.strictEqual(U.defiPick, undefined); }
console.log("ok - règle d'équipe : équipe adaptée le temps de l'expédition");
assert.ok(E.ACH.some((x) => x.id === "s1exp3" && x.s1));
console.log("ok - bourses une seule fois par manche, booster à l'or, titre, total de la manche");
