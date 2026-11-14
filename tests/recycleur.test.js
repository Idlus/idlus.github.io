/* Recycleur (choix de Mathis 1C 2A 3A, 21/10/2026) : sac de 4 000 places, recyclage du sac selon des règles, recyclage automatique
   quand le sac déborde et « Recycler aussitôt » à la fabrication. Lancer : node tests/recycleur.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
const tpls = Object.keys(D.ITEMS).filter((t) => D.ITEMS[t].slot !== "dofus" && !D.ITEMS[t].trophy && !D.ITEMS[t].leg);
const ranged = (t) => Object.values(D.ITEMS[t].stats).some(([x, y]) => y > 0 && y > x) && Object.values(D.ITEMS[t].stats).every(([x, y]) => y > x);
const team = (lvl) => { const S = E.newState("Recy", "iop"); S.chars[0].lvl = lvl; S.chars[0].inTeam = true; S.settings.auto = { action: "none", q: 0, keepSets: true, recycle: false }; return S; };
const mk = (S, tpl, f = 0) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = Math.round(a + (b - a) * f); } return it; };
const low = tpls.find((t) => D.ITEMS[t].lvl < 60 && !D.ITEMS[t].set && ranged(t));
const lowSet = tpls.find((t) => D.ITEMS[t].lvl < 60 && D.ITEMS[t].set && ranged(t));
const high = tpls.find((t) => D.ITEMS[t].lvl >= 190 && !D.ITEMS[t].set && ranged(t) && D.ITEMS[t].craft);

assert.strictEqual(E.ITEM_CAP, 4000, "sac de base : 4 000 places (1C)");
console.log("ok - sac de 4 000 places");

// 1. règles : niveau (vide = 30 sous le héros le plus faible), doublons, panoplies gardées en un exemplaire, protections
{
  const S = team(150); const R = E.recyCfg(S);
  assert.deepStrictEqual(Object.keys(R).sort(), Object.keys(E.RECY_DEF).sort(), "réglages par défaut");
  assert.strictEqual(E.recyLvl(S, R), 120);
  const a = mk(S, low), a2 = mk(S, low, 0.5);
  const s1 = mk(S, lowSet, 0.2), s2 = mk(S, lowSet, 0.8);
  const h1 = mk(S, high, 0.3), h2 = mk(S, high, 0.6);
  const lk = mk(S, low); lk.locked = true;
  const rad = mk(S, low); rad.radiant = 10;
  const fm = mk(S, low); fm.fm = 2;
  const pf = mk(S, low, 1); assert.ok(E.isPerfect(pf));
  const L = E.recyList(S);
  assert.ok(L.includes(a.uid) && L.includes(a2.uid), "bas niveau recyclé, même le meilleur exemplaire");
  assert.ok(L.includes(s1.uid) && !L.includes(s2.uid), "panoplie : le meilleur exemplaire est gardé");
  assert.ok(L.includes(h1.uid) && !L.includes(h2.uid), "doublon haut niveau : seul le meilleur reste");
  [lk, rad, fm, pf].forEach((x) => assert.ok(!L.includes(x.uid), "cadenas, Rayonnant, forgemagé et Parfait jamais recyclés"));
  S.chars[0].equip.coiffe = a.uid; assert.ok(!E.recyList(S).includes(a.uid), "porté : gardé"); delete S.chars[0].equip.coiffe;
  // 3.1.7 (1A) : Rayonnants protégés tant que leur cadre n'est pas coché ; Parfaits avec leur propre case
  assert.strictEqual(R.rad, false, "Rayonnants protégés par défaut"); assert.strictEqual(R.perf, false, "Parfaits protégés par défaut");
  R.rad = true; R.perf = true; R.rKeep = false; { const LR = E.recyList(S); assert.ok(LR.includes(rad.uid) && LR.includes(pf.uid), "cases cochées : Rayonnant et Parfait bas niveau recyclés");
    assert.ok(!LR.includes(lk.uid) && !LR.includes(fm.uid), "cadenas et forgemagé toujours gardés");
    const pr = mk(S, low, 1); pr.radiant = 10; S.chars[0].equip.coiffe = pr.uid; assert.ok(!E.recyList(S).includes(pr.uid), "Rayonnant porté : gardé");
    delete S.chars[0].equip.coiffe; delete S.items[pr.uid]; }
  R.rad = false; R.perf = false; R.rKeep = true;
  R.keepSets = false; assert.ok(E.recyList(S).includes(s2.uid), "sans la case panoplie : recyclé");
  R.lvlOn = false; R.dup = false; assert.strictEqual(E.recyList(S).length, 0, "aucune règle : rien");
  R.qOn = true; R.q = 50; const LQ = E.recyList(S); assert.ok(LQ.includes(h1.uid) && !LQ.includes(h2.uid), "jet sous 50 %");
  R.qOn = false; R.lvlOn = true; R.dup = true; R.keepSets = true; R.lvl = 200; assert.ok(E.recyList(S).includes(h2.uid), "niveau choisi : 200");
  R.lvl = 0;
  // recyclage : runes comme le brisage, aperçu sans hasard proche du résultat
  const uids = E.recyList(S); const est = E.recyEstimate(S, uids); const coef0 = E.getCoef(S, low);
  const r0 = JSON.stringify(S.runes); assert.ok(est.weight > 0); assert.strictEqual(JSON.stringify(S.runes), r0, "l'aperçu ne touche à rien");
  assert.strictEqual(E.getCoef(S, low), coef0, "l'aperçu ne touche pas au coefficient");
  const r = E.recycle(S, uids); assert.strictEqual(r.n, uids.length); uids.forEach((u) => assert.ok(!S.items[u]));
  assert.ok(Object.keys(r.got).length > 0, "des runes"); assert.ok(E.getCoef(S, low) < coef0, "le coefficient baisse comme au brisage");
  [s2, h2, lk, rad, fm, pf].forEach((x) => assert.ok(S.items[x.uid], "gardé"));
}
console.log("ok - règles et recyclage du sac");

// 1 bis. 3.1.7 (idée de SegFault, 1A 2A 3B) : règles propres aux Rayonnants, meilleur Rayonnant gardé, ancienne case reprise, Parfaits corrigés
{
  const S = team(200); const R = E.recyCfg(S); Object.assign(R, { lvlOn: false, qOn: false, dup: false, keepSets: false });
  const rmk = (tpl, f, bon) => { const it = mk(S, tpl, f); it.roll = Object.assign({}, it.stats); it.radiant = bon; for (const k in it.stats) if (it.stats[k] > 0 && !E.RADIANT_SKIP[k]) it.stats[k] = Math.ceil(it.stats[k] * (1 + bon / 100)); return it; };
  const n1 = mk(S, high, 0.5); const r1 = rmk(high, 0.5, 15), r2 = rmk(high, 0.95, 45), r3 = rmk(low, 0.5, 40);
  assert.strictEqual(E.recyList(S).length, 0, "aucune règle");
  R.rad = true; R.rLvlOn = false; R.rQOn = false; R.rBonOn = true; R.rBon = 30; R.rKeep = true;
  let L = E.recyList(S); assert.ok(L.includes(r1.uid) && !L.includes(r2.uid) && !L.includes(r3.uid) && !L.includes(n1.uid), "bonus sous +30 % : seul le petit Rayonnant part");
  R.rKeep = false; R.rBon = 50; L = E.recyList(S); assert.ok(L.includes(r1.uid) && L.includes(r2.uid) && L.includes(r3.uid), "sans garder le meilleur : tous sous +50 %");
  R.rKeep = true; L = E.recyList(S); assert.ok(!L.includes(r2.uid) && !L.includes(r3.uid) && L.includes(r1.uid), "meilleur Rayonnant de chaque objet gardé");
  R.rBonOn = false; R.rLvlOn = true; R.rLvl = 100; R.rKeep = false; L = E.recyList(S); assert.ok(L.includes(r3.uid) && !L.includes(r1.uid), "niveau des Rayonnants à part");
  R.rLvlOn = false; R.rQOn = true; R.rQ = 90; L = E.recyList(S); assert.ok(L.includes(r1.uid) && !L.includes(r2.uid), "jet de base (avant bonus) des Rayonnants");
  R.lvlOn = true; R.lvl = 200; R.rad = false; L = E.recyList(S); assert.ok(L.includes(n1.uid) && !L.includes(r1.uid), "règles normales : les Rayonnants n'en font pas partie");
  // Parfaits : un Rayonnant au jet de base 100 % est Parfait, un Rayonnant moyen ne l'est plus (bug : le bonus poussait les lignes au max)
  const rp = rmk(high, 1, 30); assert.ok(E.isPerfect(rp), "Rayonnant au jet parfait : Parfait"); assert.ok(!E.isPerfect(r2), "Rayonnant à 95 % + bonus : pas Parfait");
  R.rad = true; R.rLvlOn = true; R.rLvl = 200; R.rQOn = false; assert.ok(!E.recyList(S).includes(rp.uid), "Rayonnant parfait protégé sans la case Parfaits");
  R.perf = true; assert.ok(E.recyList(S).includes(rp.uid), "case Parfaits : recyclé");
  // ancienne case « rare » reprise
  const T = team(150); T.settings.recy = { lvlOn: true, lvl: 120, qOn: true, q: 40, dup: true, keepSets: true, rare: true };
  const C = E.recyCfg(T); assert.ok(C.rare === undefined && C.rad && C.perf && C.rLvlOn && C.rLvl === 120 && C.rQOn && C.rQ === 40 && !C.rBonOn && !C.rKeep, "ancienne case reprise");
  const U = team(150); U.settings.recy = { rare: false }; const C2 = E.recyCfg(U); assert.ok(C2.rare === undefined && !C2.rad && !C2.perf, "ancienne case décochée : protégés");
  // 3B : le recyclage automatique suit aussi les règles des Rayonnants
  const A = team(150); for (let i = E.itemCount(A); i < E.itemCap(A); i++) mk(A, high, 0.9);
  Object.assign(E.recyCfg(A), { auto: true, dup: false, rad: true, rLvlOn: false, rBonOn: true, rBon: 30, rKeep: false });
  const ra = mk(A, high, 0.5); ra.radiant = 12; const rb = mk(A, high, 0.5); rb.radiant = 44; E.bagFlush(A);
  assert.ok(!A.items[ra.uid] && !(A.over || []).some((o) => o.uid === ra.uid), "Rayonnant faible recyclé automatiquement");
  assert.ok((A.over || []).some((o) => o.uid === rb.uid), "beau Rayonnant : trop-plein");
}
console.log("ok - règles des Rayonnants (1A 2A 3B) et Parfaits");

// 2. recyclage automatique : sac plein, ce qui correspond est recyclé au lieu d'aller au trop-plein
{
  const S = team(150); const cap = E.itemCap(S); for (let i = E.itemCount(S); i < cap; i++) mk(S, high, 0.9);
  const keep = mk(S, high, 0.95); const x = mk(S, low); E.bagFlush(S);
  assert.strictEqual(S.over.length, 2, "sans le réglage : trop-plein");
  const T = team(150); for (let i = E.itemCount(T); i < E.itemCap(T); i++) mk(T, high, 0.9);
  E.recyCfg(T).auto = true; E.recyCfg(T).dup = false; const y = mk(T, low); const z = mk(T, high, 0.95); E.bagFlush(T);
  assert.ok(!T.items[y.uid] && !(T.over || []).some((o) => o.uid === y.uid), "bas niveau recyclé");
  assert.ok((T.over || []).some((o) => o.uid === z.uid), "le reste va au trop-plein");
  assert.ok(keep && x);
}
console.log("ok - recyclage automatique");

// 3. « Recycler aussitôt » à la fabrication : garder les N meilleurs, la fabrication continue sac plein
{
  const S = team(200); const T = D.ITEMS[high]; const job = T.craft.job; S.crafts[job].lvl = 200;
  T.craft.ing.forEach(([r, q]) => (S.res[r] = q * 300));
  for (let i = E.itemCount(S); i < E.itemCap(S); i++) mk(S, low); S.over = []; for (let i = 0; i < E.overCap(S); i++) S.over.push({ uid: 800000 + i, tpl: low, stats: {}, at: 1 });
  assert.strictEqual(E.craftRoom(S), 0); assert.strictEqual(typeof E.craftMany(S, "tpl", high, 5), "string", "sans l'option : bloqué");
  const R = E.recyCfg(S); R.craft = true; R.keep = 2;
  assert.ok(E.craftCount(S, "tpl", high) >= 200, "le maximum ne dépend plus de la place");
  const r = E.craftMany(S, "tpl", high, 200);
  assert.strictEqual(r.n, 200, "200 fabrications"); assert.ok(r.recy >= 190, "les autres recyclés");
  const L = Object.values(S.items).concat(S.over).filter((x) => x.tpl === high);
  assert.strictEqual(L.filter((x) => !x.radiant && !E.isPerfect(x)).length <= 2 && L.length >= 2, true, "2 meilleurs gardés (+ Rayonnants et Parfaits)");
  assert.ok(Object.keys(r.got).length > 0, "runes du recyclage comptées");
  assert.ok(S.over.length <= E.overCap(S), "le trop-plein ne déborde pas");
}
console.log("ok - recycler aussitôt à la fabrication");

// 4. réglages gardés par la sauvegarde
{
  const S = team(100); const R = E.recyCfg(S); R.auto = true; R.keep = 3; R.lvl = 90;
  const N = E.deserialize(E.serialize(S)); const R2 = E.recyCfg(N);
  assert.strictEqual(R2.auto, true); assert.strictEqual(R2.keep, 3); assert.strictEqual(R2.lvl, 90);
}
console.log("ok - réglages sauvegardés");
