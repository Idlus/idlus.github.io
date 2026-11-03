/* Saison 1, lot 8 (js/tournoi.js) : Tournoi des guildes, tableau automatique, 5 combats par rencontre, finale le dimanche
   à 20 h, joué par morceaux, même résultat pour tous, récompenses une fois. Lancer : node tests/tournoi.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "koli", "quetes", "tournoi"]) require("../js/" + f + ".js");
const E = window.ENGINE;
// calendrier (heure de Paris, hiver : UTC+1) : lundi 7 janvier 2030
const P = (d, h) => Date.UTC(2030, 0, 7 + d, h - 1, 5);
assert.strictEqual(E.tourPhase(P(0, 10)), "inscr"); assert.strictEqual(E.tourPhase(P(5, 11)), "inscr");
assert.strictEqual(E.tourPhase(P(5, 12)), "tours"); assert.strictEqual(E.tourPhase(P(6, 19)), "tours"); assert.strictEqual(E.tourPhase(P(6, 20)), "finale");
assert.strictEqual(E.tourWeek(P(0, 1)), E.tourWeek(P(6, 23)), "lundi-dimanche");
console.log("ok - calendrier : inscriptions jusqu'au samedi midi, tours, finale le dimanche à 20 h");
// tableau : 6 guildes, faux combats (l'équipe la plus haute gagne)
const team = (lvl) => ({ u: "u" + Math.random(), n: "x", lvl, team: [{ lvl }], heads: [] });
const G = (i, lv, n = 5) => ({ g: i, name: "G" + i, teams: Array.from({ length: n }, () => team(lv)) });
const sim = (a, b, seed) => ({ win: a[0].lvl > b[0].lvl || (a[0].lvl === b[0].lvl && seed % 2 === 0), rounds: 5, hpA: 50, hpB: 0 });
{ const st = E.tourInit(12, [G(1, 100), G(2, 200), G(3, 150), G(4, 50, 3), G(5, 120), G(6, 180)]);
  assert.strictEqual(st.rounds[0].length, 4, "tableau de 8"); assert.strictEqual(st.seeds[0].name, "G2", "rangées par force");
  assert.strictEqual(st.rounds[0].filter((m) => m.a < 0 || m.b < 0).length, 2, "2 exemptés");
  assert.ok(st.rounds[0].some((m) => m.a === 0 && m.b < 0), "la plus forte passe le premier tour");
  let n = 0; while (E.tourStep(st, 3, P(5, 13), sim)) n++; assert.ok(n > 1, "joué par morceaux");
  assert.strictEqual(st.champ, null, "la finale attend dimanche"); assert.strictEqual(st.rounds[st.rounds.length - 1].length, 1);
  E.tourStep(st, 99, P(6, 20), sim); assert.strictEqual(st.seeds[st.champ].name, "G2", "la plus forte gagne");
  assert.strictEqual(E.tourPlace(st, 0), 3); assert.strictEqual(E.tourPlace(st, 1), 2); assert.strictEqual(E.tourPlace(st, st.seeds.length - 1), 0);
  // récompenses
  const S = E.newState("x", "iop"); const uid = st.seeds[0].teams[0].u;
  const r = E.tourClaim(S, st, uid); assert.strictEqual(r.place, 3); assert.strictEqual((S.cons || {}).coffre_douze, 1);
  assert.strictEqual(typeof E.tourClaim(S, st, uid), "string", "une fois"); assert.ok(E.titles(S).includes("Champion du Tournoi"));
  assert.strictEqual(typeof E.tourClaim(E.newState("y", "iop"), st, "nobody"), "string", "seulement les inscrits"); }
console.log("ok - tableau de 6 guildes : têtes de série, exemptés, morceaux, finale le dimanche, récompense une fois");
assert.ok(E.tourInit(1, [G(1, 100)]).void, "au moins 2 guildes");
// vrais combats : même résultat pour tous
{ const S = E.newState("A", "iop"); S.chars[0].lvl = 100; E.refreshSpells && E.refreshSpells(S.chars[0], E.charStats(S, S.chars[0]));
  const snap = E.koliSnap(S, [S.chars[0].id]); const L = [{ g: 1, name: "A", teams: [{ u: "a", lvl: 100, team: snap }] }, { g: 2, name: "B", teams: [{ u: "b", lvl: 100, team: snap }, { u: "c", lvl: 100, team: snap }] }];
  const a = E.tourInit(3, L), b = E.tourInit(3, JSON.parse(JSON.stringify(L))); E.tourStep(a, 99, P(6, 21)); E.tourStep(b, 99, P(6, 21));
  assert.deepStrictEqual(a.rounds, b.rounds, "même tableau, mêmes combats"); assert.ok(a.champ !== null);
  assert.strictEqual(a.rounds[0][0].d.filter((d) => d.f).length, 1, "une équipe absente perd son combat");
  console.log("ok - vrais combats du Kolizéum : même résultat, " + a.n + " combat(s), gagnante " + a.seeds[a.champ].name); }
