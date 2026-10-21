/* Outils de récolte 2.1.36 : outils 30 niveaux, gravures (pierres rares des combats), Maîtrise des ressources,
   Potion de récolte et apprenti récolteur du Monocompte.
   Lancer : node tests/outils.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/maitrise_moteur.js"); require("../js/mono.js"); require("../js/outils.js");
const { CONSUMABLES, RES } = require("../js/data.js");
let seed = 7; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
let now = 1.8e12; E.now = () => now; E.protSpawn = () => {}; E.almMult = () => 1;
const run = (S, sec) => { let n = 0; for (let t = 0; t < sec; t += 10) { now += 10000; n += E.gatherTick(S, 10, { quiet: true }); } return n; };

// outils : 30 niveaux, +8 % jusqu'au 10 puis +3 %, nom et icône par palier, recettes valides
assert.strictEqual(E.TOOL_MAX, 30);
assert.strictEqual(E.toolPct(10), 80); assert.strictEqual(E.toolPct(30), 140);
for (const j of Object.keys(E.TOOL_TIERS)) {
  let prevKamas = 0;
  for (let L = 1; L <= E.TOOL_MAX; L++) {
    const [n, ic, from] = E.toolTier(j, L); assert.ok(n && ic && from <= L, `${j} ${L} : palier`);
    const R = E.toolRecipe(j, L); assert.ok(R.kamas > prevKamas, `${j} ${L} : prix croissant`); prevKamas = R.kamas;
    assert.ok(R.lvl <= 200, `${j} ${L} : niveau requis ≤ 200`);
    R.ing.forEach(([r, q]) => { assert.ok(RES[r], `${j} ${L} : ressource connue ${r}`); assert.ok(q > 0); assert.ok(!/Parchemin|Potion/.test(r), `${j} ${L} : pas de parchemin ni potion (${r})`); });
  }
  assert.strictEqual(E.toolTier(j, 1)[2], 1);
}
{ const S = E.newState("T", "iop"); S.jobs.paysan.lvl = 200; S.chars[0].job = { job: "paysan", res: "Blé", prog: 0 };
  const q0 = E.hitQty(S, S.chars[0]); S.tools.paysan = 30; const q30 = E.hitQty(S, S.chars[0]);
  assert.ok(Math.abs(q30 / q0 - 2.4) < 0.01, `outil 30 = ×2,4 (${(q30 / q0).toFixed(3)})`); }

// gravures : niveau d'outil requis, pierre consommée, effets cumulables
{ const S = E.newState("G", "iop"); S.tools.paysan = 12;
  assert.ok(E.engrave(S, "paysan", 0, "pro"), "pas de pierre : refus");
  S.res["Gravure de Secousse"] = 2; S.res["Gravure de Séisme"] = 1;
  assert.strictEqual(E.engrave(S, "paysan", 0, "pro"), null); assert.strictEqual(S.res["Gravure de Secousse"], 1);
  assert.ok(E.engrave(S, "paysan", 0, "pro"), "même gravure déjà en place");
  assert.strictEqual(E.engrave(S, "paysan", 1, "pro"), null); assert.ok(!S.res["Gravure de Secousse"], "pierre consommée");
  assert.ok(E.engrave(S, "paysan", 2, "sav"), "emplacement niveau 15 verrouillé avec l'outil 12");
  assert.deepStrictEqual(E.gravFx(S, "paysan"), { find: 2, filon: 0, xp: 0 });
  assert.ok(Math.abs(E.findChance(S, "paysan") - 3 * E.FIND_CHANCE) < 1e-12, "trouvailles ×3 avec deux Prospecteur");
  S.tools.paysan = 20; assert.ok(E.engrave(S, "paysan", 3, "sav"), "emplacement 20 : grande pierre de la bonne gravure");
  S.res["Gravure d'Incendie"] = 1; assert.strictEqual(E.engrave(S, "paysan", 3, "sav"), null);
  assert.ok(Math.abs(E.gravFx(S, "paysan").xp - 0.15) < 1e-12);
  const back = E.deserialize ? E.deserialize(E.serialize(S)) : JSON.parse(E.serialize(S));
  assert.deepStrictEqual((back.grav || {}).paysan, S.grav.paysan, "gravures sauvegardées"); }

// pierres de gravure : butin rare, seulement au-delà du niveau 20 / 80
{ const S = E.newState("D", "iop"); let small = 0, big = 0;
  for (let i = 0; i < 300000; i++) { const o = { res: {} }; E.gravDrop(S, [{ lvl: 100 }], { offline: true }, o); for (const r in o.res) (RES[r].lvl >= 80 ? big++ : small++); }
  assert.ok(small > 120 && small < 280, `petites pierres ≈ 200 (${small})`); assert.ok(big > 70 && big < 180, `grandes pierres ≈ 120 (${big})`);
  let low = 0; for (let i = 0; i < 100000; i++) { const o = { res: {} }; E.gravDrop(S, [{ lvl: 10 }], { offline: true }, o); low += Object.keys(o.res).length; }
  assert.strictEqual(low, 0, "rien sous le niveau 20");
  let mid = 0; for (let i = 0; i < 300000; i++) { const o = { res: {} }; E.gravDrop(S, [{ lvl: 50 }], { offline: true }, o); for (const r in o.res) { mid++; assert.ok(RES[r].lvl < 80, "pas de grande pierre sous le niveau 80"); } }
  assert.ok(mid > 120, `petites pierres au niveau 50 (${mid})`); }

// Maîtrise des ressources : étoiles et bonus
{ const S = E.newState("M", "iop"); S.jobs.paysan.lvl = 50; const c = S.chars[0]; c.job = { job: "paysan", res: "Blé", prog: 0 };
  const q0 = E.hitQty(S, c); S.resMast = { "Blé": 999 }; assert.strictEqual(E.resMastStar(S, "Blé"), 0);
  E.resMastAdd(S, "Blé", 1); assert.strictEqual(E.resMastStar(S, "Blé"), 1); assert.ok(Math.abs(E.hitQty(S, c) / q0 - 1.05) < 1e-9, "bronze +5 %");
  S.resMast["Blé"] = 1e5; assert.ok(Math.abs(E.hitQty(S, c) / q0 - 1.15) < 1e-9, "or +15 %");
  const r0 = S.resMast["Blé"]; const got = run(S, 3600); assert.strictEqual(S.resMast["Blé"] - r0, got, "chaque récolte compte"); }

// Potion de récolte : Alchimiste 40, +20 % 1 h, pas de cumul avec le Bonbon
{ const S = E.newState("P", "iop"); S.kamas = 1e5;
  assert.ok(E.brewPotion(S), "Alchimiste trop bas"); S.jobs.alchimiste.lvl = 40;
  assert.ok(E.brewPotion(S), "ingrédients manquants");
  S.res.Ortie = 30; S.res.Sauge = 15; S.res["Trèfle à 5 feuilles"] = 8;
  assert.strictEqual(E.brewPotion(S), null); assert.strictEqual(S.cons.potion_recolte, 1); assert.ok(!S.res.Ortie);
  assert.ok(CONSUMABLES.potion_recolte.pct === 20);
  const b0 = E.bonus(S, "gather"); E.useConsumable(S, "potion_recolte"); assert.strictEqual(E.bonus(S, "gather") - b0, 20, "+20 %"); }

// apprenti : Monocompte seulement, 50 % du héros, contrat de 24 h, 3 jours au plus, s'arrête seul
{ const C = E.newState("C", "iop"); C.kamas = 1e9; assert.ok(E.appHire(C, "paysan"), "pas d'apprenti en Classique"); assert.strictEqual(E.appTick(C, 60), 0); }
{ const S = E.monoStart(E.newState("A", "iop")); const h = S.chars[0]; h.lvl = 100; S.kamas = 1e7; S.jobs.bucheron.lvl = 60; S.jobs.paysan.lvl = 60;
  assert.strictEqual(E.appCost(S), 400000);
  assert.strictEqual(E.appHire(S, "bucheron"), null); assert.strictEqual(S.kamas, 1e7 - 4e5); const A = S.mono.app; const r = A.res;
  assert.ok(Math.abs(A.until - now - E.APP.dur) < 1, "24 h");
  const app = run(S, 6 * 3600);
  // héros sur la même ressource pendant 6 h, pour comparer
  const H = E.monoStart(E.newState("H", "iop")); H.chars[0].lvl = 100; H.jobs.bucheron.lvl = 60; H.chars[0].job = { job: "bucheron", res: r, prog: 0 };
  const hc = H.chars[0]; const hero = 6 * 3600 / E.gatherPeriod(H, hc) * E.hitQty(H, hc);
  assert.ok(app / hero > 0.4 && app / hero < 0.6, `apprenti ≈ 50 % du héros (${app} pour ${Math.round(hero)})`);
  // le héros reste en chasse (pas de c.job) pendant que l'apprenti récolte
  assert.ok(!h.job, "le héros n'est pas retiré de la chasse");
  // changement de ressource gratuit
  const k0 = S.kamas; assert.strictEqual(E.appSet(S, "paysan"), null); assert.strictEqual(S.kamas, k0); assert.strictEqual(A.job, "paysan");
  // prolongation : jusqu'à 3 jours de contrat
  assert.strictEqual(E.appHire(S), null); assert.strictEqual(E.appHire(S), null); assert.ok(E.appHire(S), "plus de 3 jours : refus");
  // hors-ligne : un long tic s'arrête à la fin du contrat
  const left = (A.until - now) / 1000; now += (left + 10 * 3600) * 1000; const p0 = S.res[A.res] || 0;
  const got = E.gatherTick(S, left + 10 * 3600, { quiet: true }); const per = 3600 / E.gatherPeriod(S, { id: -9, cls: null, job: A }) * E.appQty(S);
  assert.ok(got > per * left / 3600 * 0.85 && got < per * left / 3600 * 1.15, `hors-ligne : récolte jusqu'à la fin du contrat seulement (${got} pour ~${Math.round(per * left / 3600)})`);
  assert.strictEqual((S.res[A.res] || 0) - p0, got);
  assert.ok(!E.appActive(S)); assert.strictEqual(run(S, 3600), 0, "plus rien après le contrat");
  const back = E.deserialize ? E.deserialize(E.serialize(S)) : JSON.parse(E.serialize(S));
  assert.strictEqual(back.mono.app.job, "paysan", "apprenti sauvegardé"); }
console.log("outils : OK");
