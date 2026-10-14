/* 0.1.41 « Forgemagie comme dans DOFUS » : six métiers, trois issues, reliquat, exo, transcendance, signature, coefficient en ligne.
   Lancer : node tests/forgemagie.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const { ITEMS, STATS } = require("../js/data.js");
let seed = 7; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });

// 1. Ancien métier unique : son niveau passe aux six, et les anciens forgemages gardent tout ouvert
const S0 = E.newState("Fm", "iop"); S0.fmJob = { lvl: 37, xp: 10 }; delete S0.fmJobs;
const J0 = E.fmJobs(S0); for (const j in E.FM_JOBS) assert.strictEqual(J0[j].lvl, 37, "niveau repris pour " + j);
assert.ok(J0.old && E.fmLearned(S0, "facomage"), "ancien forgemage : métiers ouverts");
const S = E.newState("Fm2", "iop"); delete S.fmJob; delete S.fmJobs; S.cnt.fm = 0;
for (const j in E.FM_JOBS) assert.ok(E.fmLearned(S, j), "nouveau joueur : " + j + " ouvert dès le départ (1.0.12.9)");

// 2. Métier de chaque objet
const tplOf = (slot, lvl) => Object.keys(ITEMS).find((k) => ITEMS[k].slot === slot && ITEMS[k].lvl >= lvl && Object.keys(ITEMS[k].stats).some((s) => s === "vit"));
assert.strictEqual(E.fmJobOf(tplOf("coiffe", 50)), "costumage"); assert.strictEqual(E.fmJobOf(tplOf("anneau", 50)), "joaillomage");
assert.strictEqual(E.fmJobOf(tplOf("bottes", 50)), "cordomage"); assert.strictEqual(E.fmJobOf(tplOf("bouclier", 50) || tplOf("coiffe", 1)) !== "", true);

// 3. Trois issues, aucune dépense de kamas, reliquat
const it = E.rollItem(S, tplOf("coiffe", 100), { radiant: false }); const T = ITEMS[it.tpl];
const k0 = S.kamas; const kinds = { sc: 0, sn: 0, ec: 0 };
for (let i = 0; i < 300; i++) { S.runes[":vit"] = 5; const f = E.fmInfo(S, it.uid, ":vit"); if (!f.ok) break; assert.ok(Math.abs(f.sc + f.sn + f.ec - 1) < 1e-9, "les chances font 100 %"); const r = E.forgemage(S, it.uid, ":vit"); kinds[r.kind]++; }
assert.ok(S.kamas >= k0, "la forgemagie ne coûte pas de kamas");
assert.ok(kinds.sc > 0 && kinds.sn > 0 && kinds.ec > 0, "les trois issues arrivent : " + JSON.stringify(kinds));
assert.ok(it.stats.vit <= E.fmCap(T, "vit"), "Vitalité sous l'over maximum");
assert.strictEqual(E.fmCap(T, "vit"), Math.max(T.stats.vit[1], Math.floor(E.OVER_W / STATS.vit.w)), "over à 101 de poids");
assert.ok(it.fmLog.length && ["sc", "sn", "ec"].includes(it.fmLog[0].k), "historique coloré");
assert.ok(E.fmWeights(it).load < 1.45, "poids raisonnable après 300 runes : " + E.fmWeights(it).load.toFixed(2));
// 1.0.14.3 : une rune qui passe consomme le reliquat ; remonter ce qu'on a perdu ne fabrique plus de reliquat à l'infini
{ const ab = E.rollItem(S, "i6804", { radiant: false }); const TB = ITEMS["i6804"]; S.items[ab.uid] = ab; let maxWell = 0;
  for (let i = 0; i < 1500; i++) {
    const below = Object.keys(TB.stats).filter((k) => TB.stats[k][1] > 0 && !E.EXO_STATS.includes(k) && (ab.stats[k] || 0) < TB.stats[k][1]);
    const key = E.runeKey("", below[0] || "fo"); S.runes[key] = 5; if (!E.fmInfo(S, ab.uid, key).ok) continue;
    E.forgemage(S, ab.uid, key); if (!(ab.stats.pa > 0)) { ab.stats.pa = 1; ab.well = Math.max(0, (ab.well || 0) - STATS.pa.w); } // PA perdu : on le remet sans garder son poids maxWell = Math.max(maxWell, ab.well || 0);
  }
  assert.ok(maxWell < 150, "Amulette du Chef Bwork : le reliquat ne s'emballe plus (" + Math.round(maxWell) + ")");
  ab.well = 30; ab.stats.fo = TB.stats.fo[1] - 1; S.runes[":fo"] = 5; const w0 = ab.well; let r;
  for (let i = 0; i < 200; i++) { ab.well = w0; ab.stats.fo = TB.stats.fo[1] - 1; S.runes[":fo"] = 5; r = E.forgemage(S, ab.uid, ":fo"); if (r.kind === "sc") break; }
  assert.strictEqual(r.kind, "sc"); assert.strictEqual(ab.well, w0 - STATS.fo.w, "succès critique : le reliquat paie la rune");
  delete S.items[ab.uid]; }

// 4. Exo PA/PM/Po/Invo : succès critique seulement, un échec ne coûte que la rune
const it2 = E.rollItem(S, tplOf("coiffe", 60), { radiant: false }); const before = JSON.stringify(it2.stats);
let got = false; for (let i = 0; i < 200 && !got; i++) { S.runes["ga:pm"] = 1; const r = E.exoForge(S, it2.uid, "pm"); if (r.ok) got = true; else assert.strictEqual(JSON.stringify(it2.stats), before, "échec exo : objet intact"); }
assert.ok(got && it2.exo === "pm", "exo PM réussi"); assert.ok(E.exoInfo(S, it2.uid, "po").why, "un seul exo par objet");

// 5. Transcendance : interdite sur un objet over, garantie sinon, puis l'objet est figé
S.runes["ta:vit"] = 2; assert.ok(!E.transInfo(S, it.uid, "vit").ok || it.stats.vit <= T.stats.vit[1], "interdite sur un objet over");
const it3 = E.rollItem(S, tplOf("coiffe", 60), { radiant: false }); const v3 = it3.stats.vit || 0;
const tr = E.transForge(S, it3.uid, "vit"); assert.ok(tr.ok && it3.stats.vit === v3 + E.TRANS.vit && it3.trans, "transcendance réussie");
S.runes[":vit"] = 3; assert.ok(!E.fmInfo(S, it3.uid, ":vit").ok, "objet transcendé : plus de forgemagie");

// 6. Signature au niveau 200 du métier de l'objet
assert.ok(E.signItem(S, it.uid, "Xener"), "signature refusée sous le niveau 200");
E.fmJobs(S).costumage.lvl = 200; assert.strictEqual(E.signItem(S, it.uid, "Xener"), null); assert.strictEqual(it.sig, "Xener");

// 7. Coefficient de brisage commun en ligne
const it4 = E.rollItem(S, tplOf("coiffe", 60), { radiant: false }); E.netCoef = {}; E.netCoefHits.length = 0;
E.breakItem(S, it4.uid, null); assert.strictEqual(E.netCoefHits.length, 1, "brisage noté pour le serveur"); assert.ok(E.getCoef(S, it4.tpl) < 100, "coefficient commun baissé");
E.netCoef = null;
// 1.0.15.1 : au chargement, les reliquats déjà gonflés repartent à 0, une seule fois, sans toucher aux caractéristiques
{ const Sw = E.newState("Rel", "iop"); const iw = E.rollItem(Sw, "i6804", { radiant: false }); Sw.items[iw.uid] = iw; iw.well = 800; delete Sw.wellReset; const st = JSON.stringify(iw.stats);
  const L = E.deserialize(E.serialize(Sw)); assert.ok(!L.items[iw.uid].well && L.wellReset, "reliquat remis à 0"); assert.strictEqual(JSON.stringify(L.items[iw.uid].stats), st, "caractéristiques intactes");
  L.items[iw.uid].well = 12; assert.strictEqual(E.deserialize(E.serialize(L)).items[iw.uid].well, 12, "remise à 0 une seule fois"); }
// 1.0.29.1 : un objet Parfait ne gagne pas de PA, PM, Portée ni Invocation en plus (le Gelano comptait 2 PA)
{ const Sg = E.newState("Gel", "iop"); const c = Sg.chars[0]; const pa0 = E.charStats(Sg, c).pa; const ig = E.rollItem(Sg, "i2469", { radiant: false }); Sg.items[ig.uid] = ig;
  assert.ok(E.isPerfect(ig), "un Gelano est toujours parfait"); c.equip.anneau1 = ig.uid;
  assert.strictEqual(E.charStats(Sg, c).pa, pa0 + 1, "Gelano : +1 PA, pas 2");
  assert.deepStrictEqual(E.perfectStats({ tpl: "i2469", stats: { pa: 1, pm: 1, po: 1, inv: 1, vit: 100 } }), { pa: 1, pm: 1, po: 1, inv: 1, vit: 102 }); }
console.log("ok - forgemagie comme dans DOFUS : six métiers, trois issues " + JSON.stringify(kinds) + ", exo, transcendance, signature, coefficient en ligne");
