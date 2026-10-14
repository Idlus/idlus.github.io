/* 1.0.30 « L'économie » : vente directe des ressources (js/vente.js), sans navigateur.
   Lancer : node tests/vente.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
global.window = global;
for (const f of ["gamedata", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "koli", "wboss", "vie", "vente"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA; const V = E.VENTE;
const near = (a, b, eps, m) => assert.ok(Math.abs(a - b) <= eps, `${m} : ${a} au lieu de ${b} (±${eps})`);

// 1. Remontée : la moitié de l'écart en 6 h, jamais au-dessus de ×3 ni sous ×0,1 ; le volume récent s'efface de moitié.
near(E.venteNow(1, 100, 6).c, 2, 1e-9, "6 h : moitié de l'écart");
near(E.venteNow(1, 100, 12).c, 2.5, 1e-9, "12 h : trois quarts");
near(E.venteNow(1, 100, 6).v, 50, 1e-9, "volume : moitié en 6 h");
assert.strictEqual(E.venteNow(0.1, 0, 0).c, 0.1); assert.strictEqual(E.venteNow(3, 0, 48).c, 3);
assert.strictEqual(E.venteNow(-5, 0, 0).c, V.MIN, "plancher"); assert.strictEqual(E.venteNow(9, 0, 0).c, V.MAX, "plafond");
assert.strictEqual(E.venteNow(1, 0, -3).c, 1, "pas de remontée dans le passé");
console.log("ok - remontée");

// 2. Prix d'un lot : aire sous le coef, qui baisse de q / 2 000 pendant la vente ; le plancher est atteint en route.
assert.strictEqual(V.VOL, 2000);
assert.deepStrictEqual(E.venteLot(20, 3, 2000), { k: Math.floor(20 * 2000 * 2.5), c: 2 }, "2 000 unités à ×3 : payées ×2,5 en moyenne");
assert.deepStrictEqual(E.venteLot(10, 0.5, 2000), { k: Math.floor(10 * (800 * 0.3 + 1200 * 0.1)), c: 0.1 }, "le plancher pendant la vente");
assert.deepStrictEqual(E.venteLot(10, 0.1, 1000), { k: 1000, c: 0.1 }, "au plancher : ×0,1 l'unité");
assert.strictEqual(E.venteLot(100, 3, 1, 1.05).k, Math.floor(100 * 1 * (3 + 3 - 1 / 2000) / 2 * 1.05), "Comptoir de guilde : +5 %");
assert.strictEqual(E.venteLot(100, 3, 0).k, 0); assert.strictEqual(E.venteLot(100, 3, -5).k, 0);
// vendre en un lot ou en deux donne la même chose (aucun intérêt à découper)
{ const a = E.venteLot(37, 2.2, 3000); const b1 = E.venteLot(37, 2.2, 1000); const b2 = E.venteLot(37, b1.c, 2000); near(a.k, b1.k + b2.k, 2, "un lot = deux lots"); }
console.log("ok - prix d'un lot");

// 3. Calibrage : 300 unités par heure tiennent une ressource vers ×1,7, 650 par heure vers ×0,2 ; trois vendeurs, au plancher.
const run = (perH, hours) => { let c = 3; const step = perH / 6; for (let i = 0; i < hours * 6; i++) { c = E.venteNow(c, 0, 1 / 6).c; c = E.venteLot(1, c, step).c; } return c; };
near(run(300, 72), 3 - 300 / 231, 0.12, "équilibre d'un vendeur (3 − r / 231)");
assert.ok(run(300, 72) > 1.5 && run(300, 72) < 1.9, "300 par heure : vers ×1,7");
assert.ok(run(650, 72) < 0.4, "650 par heure : vers ×0,2");
assert.strictEqual(run(1950, 72), V.MIN, "trois vendeurs : ×0,1");
assert.strictEqual(run(15 * 650, 24), V.MIN, "quinze vendeurs : ×0,1");
assert.ok(run(100, 72) > 2.4, "une ressource peu vendue reste chère");
// tendance : remonte sans vente, baisse sous un gros volume récent, stable à l'équilibre
assert.strictEqual(E.venteTrend(1, 0), 1); assert.strictEqual(E.venteTrend(2.5, 8000), -1); assert.strictEqual(E.venteTrend(1.6, 1.4 * V.VOL), 0); assert.strictEqual(E.venteTrend(3, 0), 0);
console.log("ok - calibrage");

// 4. Courbe des 48 h : 49 points, plafond avant la première vente, remontée ensuite ; ventes des 24 dernières heures.
const now = Date.UTC(2030, 0, 10, 12, 0);
const C = E.venteCourbe([[now - 10 * 3600000, 0.5, 300], [now - 30 * 3600000, 2, 50], [now + 3600000, 0.1, 9]], now);
assert.strictEqual(C.length, 49); assert.strictEqual(C[0], 3, "avant la première vente : ×3");
near(C[48 - 10], 0.5, 1e-9, "juste après la vente"); near(C[48 - 4], 3 - 2.5 / 2, 1e-9, "6 h plus tard : moitié de l'écart");
assert.ok(C[48] > C[48 - 10] && C[48] < 3);
assert.deepStrictEqual(E.venteCourbe([], now), Array(49).fill(3));
assert.strictEqual(E.vente24([[now - 10 * 3600000, 0.5, 300], [now - 30 * 3600000, 2, 50], [now + 3600000, 0.1, 9]], now), 300);
console.log("ok - courbe");

// 5. Ce qui se vend : ressources avec une valeur, pas les clefs, pas les Fragments d'anomalie.
const key = Object.values(D.DUNGEONS).map((d) => d.key).find((k) => k && D.RES[k]);
assert.ok(E.venteOk("Laine de Bouftou")); assert.ok(!E.venteOk(key), "pas de clef"); assert.ok(!E.venteOk(E.WB_FRAG || "Fragment d'anomalie"), "pas de Fragment");
assert.ok(!E.venteOk("Ressource qui n'existe pas"));
console.log("ok - ressources vendables");

// 6. Surplus et marchand de secours : sans vente directe, rien ne change ; avec, le surplus attend la vente directe.
let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
{
  const S = E.newState("Vente", "iop"); assert.deepStrictEqual(S.venteQ, {}, "S.venteQ créé avec la partie");
  S.res["Laine de Bouftou"] = 500; S.resCap["Laine de Bouftou"] = 100; const k0 = S.kamas;
  assert.strictEqual(E.venteDirect(S), false, "sans compte : pas de vente directe");
  E.emit(S, "harvest", { n: 1 });
  assert.strictEqual(S.res["Laine de Bouftou"], 100, "sans compte : le marchand rachète le surplus");
  assert.strictEqual(S.kamas - k0, E.merchantPrice("Laine de Bouftou", 400), "au prix du marchand (30 %)");
  E.venteHook = () => true;
  S.res["Laine de Bouftou"] = 500; const k1 = S.kamas; E.emit(S, "harvest", { n: 1 });
  assert.strictEqual(S.res["Laine de Bouftou"], 500, "compte connecté : le surplus attend la vente directe"); assert.strictEqual(S.kamas, k1);
  S.res["Bois de Frêne"] = 2000; S.venteQ["Bois de Frêne"] = 500; S.res[key] = 50; S.resCap[key] = 1;
  const L = E.venteSurplus(S);
  assert.deepStrictEqual(L.map((x) => x[0]).sort(), ["Bois de Frêne", "Laine de Bouftou"], "les clefs ne sont pas vendues");
  assert.deepStrictEqual(Object.fromEntries(L), { "Laine de Bouftou": 400, "Bois de Frêne": 1500 });
  assert.ok(E.resPrice(L[0][0]) * L[0][1] >= E.resPrice(L[1][0]) * L[1][1], "le plus cher d'abord");
  S.resCap["Bois de Frêne"] = 1800; assert.strictEqual(Object.fromEntries(E.venteSurplus(S))["Bois de Frêne"], 1500, "la plus basse des deux limites");
  E.emit(S, "harvest", { n: 1 }); assert.strictEqual(S.res[key], 1, "une clef au-delà de sa limite part toujours au marchand"); assert.strictEqual(S.res["Laine de Bouftou"], 500);
  E.venteHook = null;
  // migration 1.0.30 : une ancienne partie sans S.venteQ (ou abîmée) la retrouve au chargement
  const old = JSON.parse(E.serialize(S)); delete old.venteQ; const S2 = E.deserialize(JSON.stringify(old)); assert.deepStrictEqual(S2.venteQ, {});
  old.venteQ = [1, 2]; assert.deepStrictEqual(E.deserialize(JSON.stringify(old)).venteQ, {});
}
console.log("ok - surplus et marchand de secours");

// 7. Absence (consignes, js/vie.js) : limite de banque vendue au marchand sans compte, gardée pour la vente directe avec.
{
  const team = () => { const S = E.newState("Absent", "iop"); S.chars[0].lvl = 60; ["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S, k, "H" + i, 60).inTeam = true; }); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20));
    E.startHunt(S, Object.values(E.SUBS).find((s) => !s.hidden && s.lvl[0] >= 35 && s.lvl[1] <= 55).id); S.stats.recent = Array.from({ length: 10 }, () => ({ d: 15, w: 1 })); E.consigneSet(S, "cap", 5); return S; };
  let seed = 99; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
  const A = team(); t += 3 * 3600000; const k0 = A.kamas; const r = E.catchUp(A, 3 * 3600);
  assert.ok(r.consigne.some((l) => /Limite de banque.*marchand de secours/.test(l)), "sans compte : marchand de secours");
  assert.deepStrictEqual(A.venteQ, {});
  seed = 99; E.venteHook = () => true;
  const B2 = team(); const r2 = E.catchUp(B2, 3 * 3600);
  assert.ok(r2.consigne.some((l) => /Limite de banque.*vente directe/.test(l)), "compte connecté : vendu au prix de la vente directe");
  const Q = Object.keys(B2.venteQ); assert.ok(Q.length > 0, "des ressources attendent la vente");
  Q.forEach((n) => { assert.strictEqual(B2.venteQ[n], 5); assert.ok(B2.res[n] > 5, "le surplus est gardé pour la vente : " + n); });
  assert.ok(E.venteSurplus(B2).every(([n, q]) => q === Math.floor(B2.res[n] - Math.min(5, B2.resCap[n] === undefined ? 5 : B2.resCap[n]))));
  assert.ok(k0 <= A.kamas);
  E.venteHook = null;
}
console.log("ok - limite de banque d'une absence");

// 8. Les prix de base du serveur (supabase/vente_data.sql) sont ceux du jeu.
const B = require("../tools/build_vente.js");
const file = fs.readFileSync(path.join(__dirname, "..", "supabase", "vente_data.sql"), "utf8");
assert.ok(file === B.sql(B.rows()), "supabase/vente_data.sql n'est pas à jour : lance « node tools/build_vente.js »");
assert.ok(!/\bdelete\b|\btruncate\b|\bdrop\b/i.test(file), "vente_data.sql ne supprime rien");
assert.ok(B.rows().length > 1000 && B.rows().every(([n, b]) => b > 0 && E.venteOk(n)));
console.log("ok - prix de base du serveur à jour");
console.log("vente directe : tout est bon");
