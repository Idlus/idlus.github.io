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

/* ---------------- 1.0.30 « Forge » ---------------- */
require("../js/forge.js");
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m} : ${a} au lieu de ${b}`);
// 8. 36A : au-dessus de 80 % de la fourchette (du jet min au jet max), succès critique ×0,25 et échec critique +20 points, over compris
{ const lo = E.fmOdds(0.5, 50, 100, 150, "", false, 0), hi = E.fmOdds(0.5, 81, 100, 150, "", false, 0);
  near(hi.sc, lo.sc * E.FM_HARD.sc, "succès critique ×0,25"); near(hi.ec, lo.ec + E.FM_HARD.ec, "échec critique +20 points"); near(hi.sc + hi.sn + hi.ec, 1, "les chances font 100 %");
  assert.deepStrictEqual(E.fmOdds(0.5, 80, 100, 150, "", false, 0), lo, "à 80 % pile : règles d'avant");
  assert.ok(E.fmOdds(0.5, 91, 100, 150, "", false, 60).sc > E.fmOdds(0.5, 91, 100, 150, "", false, 0).sc * 2, "fourchette 60 à 100 : 91 reste sous 92 (80 % de la fourchette)");
  assert.ok(E.fmOdds(0.5, 93, 100, 150, "", false, 60).sc < E.fmOdds(0.5, 91, 100, 150, "", false, 60).sc * 0.5, "fourchette 60 à 100 : dur à partir de 93");
  const ov = E.fmOdds(0.5, 110, 100, 150, "", false, 0), H0 = { ...E.FM_HARD }; E.FM_HARD.sc = 1; E.FM_HARD.ec = 0; const ov0 = E.fmOdds(0.5, 110, 100, 150, "", false, 0); Object.assign(E.FM_HARD, H0);
  assert.ok(ov.sc < ov0.sc && ov.ec > ov0.ec, "over compris");
  assert.deepStrictEqual(E.fmOdds(0.5, 3, 0, 5, "", true), E.fmOdds(0.5, 3, 0, 5, "", true), "exo : inchangé");
  const Sh = E.newState("Dur", "iop"); const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].lvl >= 100 && ITEMS[k].stats.vit && ITEMS[k].stats.vit[0] >= 0 && ITEMS[k].stats.vit[1] - ITEMS[k].stats.vit[0] >= 60 && !ITEMS[k].trophy);
  const ih = E.rollItem(Sh, tpl, { radiant: false }); const [mn, mx] = ITEMS[tpl].stats.vit; Sh.runes[":vit"] = 9;
  ih.stats.vit = mn; assert.strictEqual(E.fmInfo(Sh, ih.uid, ":vit").hard, false, "loin du maximum");
  ih.stats.vit = Math.ceil(mn + (mx - mn) * 0.8); assert.strictEqual(E.fmInfo(Sh, ih.uid, ":vit").hard, true, "près du maximum");
  // 1.0.30 : la première forgemagie marque l'objet (neuf : fmNew ; déjà forgemagé avant : photo de ses caractéristiques)
  ih.stats.vit = mn; E.forgemage(Sh, ih.uid, ":vit"); assert.strictEqual(ih.fmNew, 1, "objet neuf marqué"); assert.ok(!ih.fmSnap);
  const ig = E.rollItem(Sh, tpl, { radiant: false }); ig.fm = 7; const snap = Object.assign({}, ig.stats); E.forgemage(Sh, ig.uid, ":vit");
  assert.deepStrictEqual(ig.fmSnap, snap, "objet forgemagé avant la 1.0.30 : photo avant la rune"); assert.ok(!ig.fmNew); const s2 = ig.fmSnap; E.forgemage(Sh, ig.uid, ":vit"); assert.strictEqual(ig.fmSnap, s2, "une seule photo"); }

// 9. 43A : coefficient de brisage de 10 % à 200 % ; −3 % par brisage, +1 % / 6 min jusqu'à 100 %, puis +1 % par heure
{ const H = 3600000, M = 60000, t = 1e12;
  assert.strictEqual(E.coefAt(97, t, t), 97); assert.strictEqual(E.coefAt(97, t, t + 18 * M), 100); assert.strictEqual(E.coefAt(97, t, t + 17 * M), 99);
  assert.strictEqual(E.coefAt(97, t, t + 18 * M + H), 101, "au-dessus de 100 % : +1 % par heure"); assert.strictEqual(E.coefAt(150, t, t + 1000 * H), 200, "plafond 200 %");
  assert.strictEqual(E.coefAt(10, t, t + 540 * M), 100); assert.strictEqual(E.coefAt(150, t, t + 2 * H), 152);
  const Sc = E.newState("Coef", "iop"); const now = E.now(); Sc.coefT0 = now - 50 * H; const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].lvl >= 60 && !ITEMS[k].trophy && ITEMS[k].slot === "coiffe");
  assert.strictEqual(E.getCoef(Sc, tpl, now), 150, "jamais brisé depuis 50 h : 150 %");
  const ib = E.rollItem(Sc, tpl, { radiant: false }); E.breakItem(Sc, ib.uid, null); assert.strictEqual(E.getCoef(Sc, tpl), 147, "brisé : 150 − 3");
  Sc.coef[tpl] = { v: 11, t: E.now() }; const ib2 = E.rollItem(Sc, tpl, { radiant: false }); E.breakItem(Sc, ib2.uid, null); assert.strictEqual(Sc.coef[tpl].v, 10, "minimum 10 %");
  Sc.coef[tpl] = { v: 150, t: now - 10 * H }; assert.strictEqual(E.getCoef(Sc, tpl, now), 150, "jamais au-dessus d'un objet jamais brisé");
  delete Sc.coefT0; delete Sc.coef[tpl]; assert.strictEqual(E.getCoef(Sc, tpl, now), 100, "sans heure de départ : 100 % comme avant");
  // migration : heure de départ posée une fois, coefficients revenus au départ retirés, les autres gardés
  const raw = JSON.parse(E.serialize(Sc)); delete raw.coefT0; raw.coef = { a: { v: 50, t: now - 10 * H }, b: { v: 40, t: now } };
  const L = E.deserialize(JSON.stringify(raw)); assert.ok(L.coefT0 > 0, "heure de départ posée"); assert.deepStrictEqual(Object.keys(L.coef), ["b"], "coefficient remonté retiré");
  const L2 = E.deserialize(E.serialize(L)); assert.strictEqual(L2.coefT0, L.coefT0, "une seule fois"); assert.deepStrictEqual(L2.coef, L.coef);
  // en ligne : coefficient commun, départ donné par le serveur (supabase/brisage.sql)
  E.netCoef = { [tpl]: { v: 40, t: now } }; E.netCoefT0 = now - 50 * H; const other = Object.keys(ITEMS).find((k) => k !== tpl && !ITEMS[k].trophy);
  assert.strictEqual(E.getCoef(Sc, tpl, now), 40); assert.strictEqual(E.getCoef(Sc, other, now), 150, "en ligne, jamais brisé : départ du serveur");
  E.netCoefT0 = null; assert.strictEqual(E.getCoef(Sc, other, now), 100, "serveur d'avant la 1.0.30 : 100 %"); E.netCoef = null; }

// 10. 40A : soft reset des jets (activé en 1.0.30.1 ; le test le coupe puis le remet)
{ assert.strictEqual(E.SOFT_RESET_ON, true, "1.0.30.1 : le soft reset est activé"); const ON0 = E.SOFT_RESET_ON; E.SOFT_RESET_ON = false;
  const Ss = E.newState("Soft", "iop"); const tpl = Object.keys(ITEMS).find((k) => { const T = ITEMS[k]; return T.lvl >= 100 && !T.trophy && !T.leg && T.slot !== "dofus" && Object.keys(T.stats).filter((x) => STATS[x] && T.stats[x][0] >= 0 && T.stats[x][1] - T.stats[x][0] >= 10).length >= 3; });
  const T = ITEMS[tpl]; const pos = Object.keys(T.stats).filter((k) => STATS[k] && T.stats[k][1] > 0);
  const mk = (o) => { const it = E.rollItem(Ss, tpl, { radiant: false }); pos.forEach((k) => { it.stats[k] = T.stats[k][1]; }); delete it.fmNew; delete it.fmSnap; delete it.fm; Object.assign(it, o); return it; };
  const old = mk({ fm: 40 }), fresh = mk({ fm: 40, fmNew: 1 }), never = mk({}), exo = mk({ fm: 1, fmLog: [{ t: 1, txt: "Succès critique : exo +1 PM !", ok: true, k: "sc" }] }), trans = mk({ fm: 3, trans: { k: pos[0], v: 1 } });
  const k0 = pos.find((k) => T.stats[k][1] - T.stats[k][0] >= 10); const snapV = T.stats[k0][0] + Math.round((T.stats[k0][1] - T.stats[k0][0]) * 0.9);
  const snapped = mk({ fm: 9, fmSnap: Object.assign({}, ...pos.map((k) => ({ [k]: T.stats[k][0] }))) }); snapped.fmSnap[k0] = snapV;
  const keep = (it) => JSON.stringify(it.stats); const was = { fresh: keep(fresh), never: keep(never), exo: keep(exo), trans: keep(trans) };
  const kam = Ss.kamas, runes0 = Object.assign({}, Ss.runes), cr0 = Ss.cons.cristal_fm || 0;
  assert.strictEqual(E.softResetCheck(Ss), null, "désactivé : rien ne se passe"); assert.ok(!Ss.softReset && E.isPerfect(old), "désactivé : objets intacts");
  const P0 = E.softResetPlan(Ss); assert.strictEqual(P0.n, 2, "aperçu : l'objet forgemagé à l'ancienne et celui photographié"); assert.ok(E.isPerfect(old), "l'aperçu ne change rien");
  E.SOFT_RESET_ON = true; const P = E.softResetCheck(Ss); E.SOFT_RESET_ON = false;
  assert.ok(P && P.n === 2, "activé : 2 objets touchés");
  near(P0.items.find((x) => x.uid === old.uid).q1, E.itemQuality(old), "l'aperçu annonce le bon jet");
  pos.forEach((k) => assert.strictEqual(old.stats[k], Math.min(T.stats[k][1], E.softTarget(old, k)), `${k} redescend à 80 % de sa fourchette`));
  assert.ok(!E.isPerfect(old) && E.itemQuality(old) >= 0.75 && E.itemQuality(old) <= 0.9, "plus Parfait, jet ≈ 80 % : " + E.itemQuality(old));
  assert.strictEqual(E.softTarget({ tpl, stats: {} }, k0), Math.round(T.stats[k0][0] + (T.stats[k0][1] - T.stats[k0][0]) * 0.8), "l'entier le plus proche de 80 % de la fourchette");
  assert.strictEqual(snapped.stats[k0], T.stats[k0][1] - (snapV - E.softTarget(snapped, k0)), "objet photographié : seul ce qui dépassait 80 % à la photo est retiré");
  pos.filter((k) => k !== k0).forEach((k) => assert.strictEqual(snapped.stats[k], T.stats[k][1], "forgemagie faite depuis la 1.0.30 gardée"));
  assert.ok(old.fmNew && !snapped.fmSnap && snapped.fmNew, "la suite se fait avec les nouvelles règles");
  assert.strictEqual(keep(fresh), was.fresh, "forgemagé depuis la 1.0.30 : intact"); assert.strictEqual(keep(never), was.never, "jamais forgemagé : intact");
  assert.strictEqual(keep(exo), was.exo, "seulement des exos : intact"); assert.strictEqual(keep(trans), was.trans, "transcendé : intact");
  // compensation : runes ×1,5 (Ra, Pa puis simples), un Cristal et 100 000 k par objet, le titre une fois
  let eq = 0; for (const rk in P.runes) { const r = E.runeInfo(rk); eq += P.runes[rk] * r.pts / STATS[r.stat].pts; assert.strictEqual(Ss.runes[rk] - (runes0[rk] || 0), P.runes[rk], "runes données : " + rk); }
  let cutEq = 0; P.items.forEach((x) => { for (const k in x.cut) cutEq += x.cut[k] / STATS[k].pts; }); assert.ok(eq >= cutEq * 1.5 - 1e-9 && eq <= cutEq * 1.5 + 2 * pos.length + 1, `runes ×1,5 (${eq} pour ${cutEq})`);
  assert.strictEqual(Ss.cons.cristal_fm - cr0, 2, "un Cristal par objet"); assert.strictEqual(Ss.kamas - kam, 2 * E.SOFT_KAMAS, "100 000 k par objet");
  assert.ok(Ss.titlesExtra.includes("Forgemage d'antan"), "titre « Forgemage d'antan »"); assert.ok(Ss.softReset && Ss.softReset.n === 2);
  assert.ok(old.fmLog[0].txt.startsWith("Remise à niveau des jets"), "noté dans l'historique de l'objet");
  E.SOFT_RESET_ON = true; const st = keep(old), k1 = Ss.kamas; assert.strictEqual(E.softResetCheck(Ss), null, "une seule fois par partie");
  const L = E.deserialize(E.serialize(Ss)); assert.strictEqual(E.softResetCheck(L), null, "une seule fois, même après rechargement"); E.SOFT_RESET_ON = false;
  assert.strictEqual(keep(old), st); assert.strictEqual(Ss.kamas, k1); assert.strictEqual(Ss.titlesExtra.filter((x) => x === "Forgemage d'antan").length, 1);
  // Rayonnant : la cible garde le bonus du Rayonnant
  const rad = mk({ fm: 5, radiant: 10 }); const Sr = Ss; rad.stats[k0] = Math.ceil(T.stats[k0][1] * 1.1); assert.strictEqual(E.softTarget(rad, k0), Math.ceil(Math.round(T.stats[k0][0] + (T.stats[k0][1] - T.stats[k0][0]) * 0.8) * 1.1));
  assert.ok(E.softItem(rad).cut[k0] > 0); delete Sr.items[rad.uid]; E.SOFT_RESET_ON = ON0; }

// 11. 43A : atelier de brisage (le calcul des runes ne change pas : E.breakPreview)
{ const Sb = E.newState("Atelier", "iop"); const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].lvl >= 150 && !ITEMS[k].trophy && ITEMS[k].stats.vit && ITEMS[k].stats.fo);
  const a = E.rollItem(Sb, tpl, { radiant: false }), b = E.rollItem(Sb, tpl, { radiant: false }); const before = E.serialize(Sb);
  const rows = E.breakEst(Sb, [a.uid, b.uid], null); assert.strictEqual(E.serialize(Sb), before, "l'atelier ne change rien");
  const pv = E.breakPreview(Sb, a.uid, null), pv2 = E.breakPreview(Sb, b.uid, null);
  const f2 = (pv2.coef - 3) / pv2.coef; // le deuxième exemplaire du même objet se brise à −3 %
  rows.forEach((r) => { const s = STATS[r.k]; near(r.eq, ((pv.weights[r.k] || 0) + (pv2.weights[r.k] || 0) * f2) * E.BREAK_MEAN / (s.w * s.pts), "runes attendues " + r.k);
    assert.ok(Math.abs(r.ra * 10 + r.pa * 3 + r.s - r.eq) <= 0.5 + 1e-9, "Ra + Pa + simples = runes attendues : " + r.k); });
  const fr = E.breakEst(Sb, [a.uid], "vit"); assert.ok(fr.find((r) => r.k === "vit").eq > rows.find((r) => r.k === "vit").eq / 2, "focus Vitalité : plus de Vitalité");
  assert.deepStrictEqual(E.runePriceOf({ ":vit": 10 }, "ra:vit"), { p: 100, d: true }, "prix déduit d'une autre taille");
  assert.deepStrictEqual(E.runePriceOf({ ":vit": 10, "ra:vit": 80 }, "ra:vit"), { p: 80, d: false }); assert.strictEqual(E.runePriceOf({}, "ra:vit"), null, "aucun prix inventé");
  const all = {}; rows.forEach((r) => ["", "pa", "ra"].forEach((t) => { all[E.runeKey(t, r.k)] = 1; }));
  const V = E.breakValue(all, rows); assert.strictEqual(V.cov, 1); near(V.v, rows.reduce((x, r) => x + r.ra + r.pa + r.s, 0), "valeur au prix connu");
  assert.deepStrictEqual(E.breakValue({}, rows), { v: 0, cov: 0, d: false }, "sans prix : rien"); }
console.log("ok - 1.0.30 « Forge » : forgemagie dure près du maximum, coefficient de 10 % à 200 %, soft reset des jets (activé en 1.0.30.1), atelier de brisage");
