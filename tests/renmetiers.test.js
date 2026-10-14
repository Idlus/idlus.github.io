/* 1.0.25 « Renaissance des métiers » : un métier d'artisanat ou de forgemagie au niveau 200 renaît (10 fois au plus, 1 million de kamas
   × le numéro de la renaissance) : +30 % d'XP par renaissance, plancher de jet de 10 % par renaissance (jets parfaits à la X) pour l'artisanat,
   +1 pt de succès critique / −0,5 pt d'échec critique pour la forgemagie (pas sur les runes Ga), classements sur l'XP de toutes les vies.
   Lancer : node tests/renmetiers.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
require("../js/renaissance.js");
const V = require("../js/verify.js");
const { ITEMS, CRAFT_JOBS } = require("../js/data.js");
let seed = 11; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
let cum = 0; for (let i = 1; i < 200; i++) cum += E.jobXpNeed(i);

// 1. Conditions et coût
const S = E.newState("Ren", "iop"); const J = S.crafts.tailleur;
assert.ok(/200/.test(E.canJobRen(S, "craft", "tailleur")), "niveau 200 requis");
J.lvl = 200; J.xp = 5000; S.kamas = 999999;
assert.ok(/1 000 000|1 000 000|1 000 000/.test(E.canJobRen(S, "craft", "tailleur")), "il faut 1 million de kamas pour la première");
assert.strictEqual(E.jobRenCost(1), 1000000); assert.strictEqual(E.jobRenCost(3), 3000000); assert.strictEqual(E.jobRenCost(10), 10000000);
const before = V.summary(E, S).jobs.tailleur;
S.kamas = 1000000; assert.strictEqual(E.jobRenaissance(S, "craft", "tailleur"), null, "renaissance faite");
assert.deepStrictEqual([J.lvl, J.xp, J.ren, S.kamas], [1, 0, 1, S.ach.jren1 ? 5000 : 0], "niveau 1, XP 0, Renaissance I, kamas payés (le succès rend 5 000)");
assert.strictEqual(J.renXp, cum + 5000, "l'XP de la vie passée est gardée (même l'XP au-delà du niveau 200)");
const after = V.summary(E, S).jobs.tailleur;
assert.strictEqual(after[3], 1, "le classement reçoit la renaissance");
assert.ok(after[2] >= before[2], "l'XP totale envoyée au classement ne recule pas");
assert.strictEqual(before.length, 3, "sans renaissance, rien ne change dans l'envoi");

// 2. XP : +30 % par renaissance
const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].craft && ITEMS[k].craft.job === "tailleur" && E.craftReq(k) === 1) || Object.keys(ITEMS).find((k) => ITEMS[k].craft && ITEMS[k].craft.job === "tailleur");
const S0 = E.newState("Ren0", "iop");
const base = 12 + ITEMS[tpl].lvl * 3, x0 = E.craftXpOf(S0, "tailleur", E.craftReq(tpl), base);
assert.strictEqual(E.craftXpOf(S, "tailleur", E.craftReq(tpl), base), Math.max(1, Math.round(base * E.craftXpMult(S, "tailleur", E.craftReq(tpl)) * E.craftBoost(S, "tailleur") * 1.3)), "Renaissance I : +30 %");
assert.ok(E.craftXpOf(S, "tailleur", E.craftReq(tpl), base) > x0, "plus d'XP qu'avant");
J.ren = 4; assert.strictEqual(E.craftXpOf(S, "tailleur", E.craftReq(tpl), base), Math.max(1, Math.round(base * E.craftXpMult(S, "tailleur", E.craftReq(tpl)) * E.craftBoost(S, "tailleur") * 2.2)), "Renaissance IV : +120 %");

// 3. Plancher des jets : 10 % par renaissance, jets parfaits à la X
const big = Object.keys(ITEMS).filter((k) => ITEMS[k].craft && ITEMS[k].craft.job === "tailleur" && Object.values(ITEMS[k].stats).some(([a, b]) => b - a >= 20)).sort((a, b) => ITEMS[b].lvl - ITEMS[a].lvl)[0];
const T = ITEMS[big]; const give = (n) => T.craft.ing.forEach(([r, q]) => (S.res[r] = q * n));
const craftN = (n) => { const out = []; give(n); for (let i = 0; i < n; i++) { const it = E.craftItem(S, big); assert.ok(it && it.uid, "fabriqué"); out.push(it); delete S.items[it.uid]; } return out; };
J.lvl = 200; J.ren = 5;
for (const it of craftN(40)) for (const k in T.stats) { const [a, b] = T.stats[k]; if (b <= a) continue; const lo = Math.ceil(a + (b - a) * 0.5); const v = it.roll ? it.roll[k] : it.stats[k]; assert.ok(v >= lo && v <= b, `Renaissance V : ${k} ${v} dans ${lo}..${b}`); }
J.ren = 10;
for (const it of craftN(10)) assert.ok(E.isPerfect(it), "Renaissance X : chaque objet sort parfait");
J.ren = 0; let low = false; for (const it of craftN(40)) for (const k in T.stats) { const [a, b] = T.stats[k]; if (b - a >= 20 && it.stats[k] < a + (b - a) * 0.5 && !it.radiant) low = true; }
assert.ok(low, "sans renaissance, les jets bas restent possibles");

// 4. Récompenses : titres, « Sept vies », ornement
const R = E.newState("Rec", "iop"); R.kamas = 1e9;
const reborn = (kind, job, n) => { const X = E.jobRenOf(R, kind, job); for (let i = 0; i < n; i++) { X.lvl = 200; assert.strictEqual(E.jobRenaissance(R, kind, job), null); } };
reborn("craft", "bijoutier", 1); E.checkAch(R); assert.ok(R.ach.jren1 && E.titles(R).includes("Artisan renaissant"), "titre « Artisan renaissant »");
assert.ok(!R.ach.jren7, "« Sept vies » attend les 7 métiers");
for (const j of Object.keys(CRAFT_JOBS)) if (j !== "bijoutier") reborn("craft", j, 1);
E.checkAch(R); assert.ok(R.ach.jren7, "« Sept vies » : les 7 métiers d'artisanat renés une fois");
reborn("fm", "joaillomage", 5); E.checkAch(R); assert.ok(E.titles(R).includes("Main d'or"), "titre « Main d'or » (forgemagie comprise)");
assert.ok(!E.ORN.enclume.ok(R), "pas d'ornement avant la X");
reborn("fm", "joaillomage", 5); E.checkAch(R);
assert.ok(E.titles(R).includes("Maître éternel") && E.ORN.enclume.ok(R), "Renaissance X : « Maître éternel » et « Enclume du Phénix »");
const k0 = R.kamas; R.fmJobs.joaillomage.lvl = 200; assert.ok(/dixième/.test(E.canJobRen(R, "fm", "joaillomage")), "10 renaissances au plus"); assert.strictEqual(R.kamas, k0);
assert.strictEqual(R.fmJobs.cordomage.ren || 0, 0, "chaque métier de forgemagie renaît à part");

// 5. Forgemagie : chances, XP par rune qui passe, signature, vitesse des plans
const o = E.fmRenOdds({ sc: 0.5, sn: 0.3, ec: 0.2 }, 4);
assert.ok(Math.abs(o.sc - 0.54) < 1e-9 && Math.abs(o.ec - 0.18) < 1e-9 && Math.abs(o.sc + o.sn + o.ec - 1) < 1e-9, "+1 pt de succès critique et −0,5 pt d'échec critique par renaissance");
assert.strictEqual(E.fmRenOdds({ sc: 0.5, sn: 0.3, ec: 0.2 }, 0).sc, 0.5, "sans renaissance : inchangé");
const F = E.newState("Fm", "iop"); F.kamas = 1e8;
const coiffe = Object.keys(ITEMS).find((k) => ITEMS[k].slot === "coiffe" && ITEMS[k].lvl >= 100 && ITEMS[k].stats.vit && ITEMS[k].stats.vit[1] > 0);
const it = E.rollItem(F, coiffe, { radiant: false }); it.stats.vit = ITEMS[coiffe].stats.vit[0];
F.runes[":vit"] = 50; const f0 = E.fmInfo(F, it.uid, ":vit");
F.fmJobs.costumage.lvl = 200; assert.strictEqual(E.jobRenaissance(F, "fm", "costumage"), null);
F.fmJobs.costumage.ren = 3; const f3 = E.fmInfo(F, it.uid, ":vit");
assert.ok(Math.abs(f3.sc - Math.min(0.95, f0.sc + 0.03)) < 1e-9, "Renaissance III : +3 pts de succès critique sur la rune");
assert.ok(f3.ec <= f0.ec, "et moins d'échec critique");
const ab = Object.keys(ITEMS).find((k) => ITEMS[k].slot === "amulette" && ITEMS[k].lvl >= 100 && !ITEMS[k].stats.pa);
if (ab && E.exoInfo) { const ia = E.rollItem(F, ab, { radiant: false }); const e0 = E.exoInfo(F, ia.uid, "pa").chance; F.fmJobs.joaillomage.ren = 9; assert.strictEqual(E.exoInfo(F, ia.uid, "pa").chance, e0, "aucun bonus sur les runes Ga (exo)"); }
F.fmJobs.costumage.lvl = 150; F.fmJobs.costumage.xp = 0;
let seen = { pass: 0, ec: 0 };
for (let i = 0; i < 60 && (!seen.pass || !seen.ec); i++) {
  it.stats.vit = ITEMS[coiffe].stats.vit[0]; it.well = 0; F.runes[":vit"] = 5; const xp0 = F.fmJobs.costumage.xp, lv0 = F.fmJobs.costumage.lvl;
  const w = E.fmInfo(F, it.uid, ":vit").w, gain = E.fmXpFor(F, it.tpl, w); const r = E.forgemage(F, it.uid, ":vit");
  if (F.fmJobs.costumage.lvl !== lv0) { F.fmJobs.costumage.lvl = 150; F.fmJobs.costumage.xp = 0; continue; }
  const d = F.fmJobs.costumage.xp - xp0;
  if (r.kind === "ec") { seen.ec++; assert.strictEqual(d, gain, "rune qui ne passe pas : XP normale"); } else { seen.pass++; assert.strictEqual(d, Math.round(gain * 1.9), "rune qui passe : +30 % par renaissance"); }
}
assert.ok(seen.pass > 0, "au moins une rune passée");
F.fmJobs.costumage.lvl = 1; assert.strictEqual(E.signItem(F, it.uid, "Xener"), null, "un métier qui a renu signe toujours");
assert.strictEqual(E.fmTop(F), 200, "un métier qui a renu compte comme niveau 200 pour les plans");
console.log("renmetiers.test.js : OK");
