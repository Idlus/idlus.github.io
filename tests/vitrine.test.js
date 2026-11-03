/* Saison 1, lot 4 (js/vitrine.js), sans navigateur :
   - vitrine : 6 objets par semaine, les mêmes pour tous, qui tournent ; achat payé en Fragments, une seule fois, refusé hors
     de la vitrine de la semaine, sans assez de Fragments ou hors de la saison ; l'objet arrive dans la Garde-robe ;
   - lié au compte : la partie Éternel relit les achats de la partie de saison ;
   - caisse gratuite du jour : une par jour, seulement en saison ; contrats : sans hasard, toujours un peu perdants, 10 par jour.
   - les prix du jeu et du serveur (supabase/saison1_vitrine.sql) sont les mêmes.
   Lancer : node tests/vitrine.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js");
global.window = {}; require("../js/boucliers.js"); global.BOUCLIERS = window.BOUCLIERS; delete global.window;
require("../js/garderobe.js"); require("../js/vitrine.js"); require("../js/saisonsoc.js");
const DAY = 86400000; let now = Date.UTC(2030, 0, 9, 12); E.setClock(() => now); const t0 = now;
const s1 = () => { const S = E.newState("Héros", "iop"); E.s1cStart(S, t0); return S; };

// vitrine
const W1 = E.vitWeek(s1()).map((v) => v.id), W1b = E.vitWeek(s1()).map((v) => v.id);
assert.strictEqual(W1.length, 6); assert.deepStrictEqual(W1, W1b, "mêmes objets pour tous");
const all = new Set(); for (let w = 1; w <= 8; w++) E.vitWeek(s1(), w).forEach((v) => all.add(v.id));
assert(all.size >= 11, "les objets tournent sur la saison : " + all.size);
{ const S = s1(); const v = E.vitWeek(S)[0];
  assert(E.vitBuy(S, v.id), "sans Fragments : refusé");
  E.s1cPost(S, 300, "act", "test:1"); const f0 = E.s1cFrag(S);
  assert.strictEqual(E.vitBuy(S, v.id), null); assert.strictEqual(E.s1cFrag(S), f0 - v.prix); assert(E.vitOwned(S, v.id));
  assert(E.vitBuy(S, v.id), "deux fois : refusé"); assert.strictEqual(E.s1cFrag(S), f0 - v.prix);
  const out = E.VIT.find((x) => !E.vitWeek(S).some((y) => y.id === x.id)); assert(E.vitBuy(S, out.id), "hors vitrine : refusé");
  const Et = E.newState("Ancien", "iop"); assert(E.vitBuy(Et, v.id), "hors saison : refusé");
  E.vitImport(Et, E.deserialize(E.serialize(S))); assert(E.vitOwned(Et, v.id), "lié au compte : l'Éternel le relit");
  const any = E.VIT.find((x) => x.k === "titre"); S.s1c.shop[any.id] = 1; assert(E.titles(S).includes(any.t), "titre de vitrine porté");
  const au = E.VIT.find((x) => x.k === "aura"); S.s1c.shop[au.id] = 1; assert.strictEqual(E.grSet(S, S.chars[0].id, "aura", au.id), null, "aura de vitrine dans la Garde-robe"); }
console.log("ok - vitrine : 6 par semaine, mêmes pour tous, achat unique en Fragments, liée au compte, dans la Garde-robe");

// prix identiques au serveur
{ const sql = fs.readFileSync(path.join(__dirname, "../supabase/saison1_vitrine.sql"), "utf8");
  E.VIT.forEach((v) => assert(new RegExp(`'${v.id}' then ${v.prix}\\b`).test(sql), "prix serveur de " + v.id));
  Object.entries(E.S1C.ACT).forEach(([k, a]) => assert(new RegExp(`'${k}' then ${a.max}\\b`).test(sql), "borne serveur de " + k)); }
console.log("ok - prix et bornes du jeu = ceux du serveur");

// caisse du jour et contrats
{ const S = s1(); const n0 = Object.values(S.cons).reduce((a, b) => a + b, 0);
  assert.strictEqual(E.freeCaseOpen(S), null); assert(E.freeCaseOpen(S), "une seule par jour");
  assert.strictEqual(Object.values(S.cons).reduce((a, b) => a + b, 0), n0 + 1);
  now += DAY; assert.strictEqual(E.freeCaseLeft(S), 1, "le lendemain, à nouveau"); now = t0;
  assert(E.freeCaseOpen(E.newState("x", "iop")), "hors saison : pas de caisse");
  S.cons.coffre_bois = 50;
  for (let i = 0; i < 10; i++) assert.strictEqual(E.contrat(S, "coffre_bois"), null);
  assert(E.contrat(S, "coffre_bois"), "10 contrats par jour"); assert.strictEqual(S.cons.coffre_bois, 10);
  const val = { coffre_bois: 5, coffre_argent: 15, coffre_or: 30, coffre_obsidienne: 60, coffre_douze: 120 };
  E.CONTRAT.forEach(([f, n, t]) => assert(val[f] * n >= val[t], "contrat jamais gagnant : " + f)); }
console.log("ok - caisse gratuite du jour en saison, contrats sans hasard et limités");
