/* 2.0 « La Maîtrise » (choix de Mathis) : au niveau 200, l'XP remplit la Maîtrise (1 point par niveau, coût du niveau 199 → 200),
   la Renaissance disparaît (2 % de l'XP des vies passées, 2 points par Éveil et par sort, retour au niveau 200),
   l'arbre agit en combat (E.mtFx), la monture garde une part réglable de 0 à 50 %, Maîtrise du Bestiaire.
   Lancer : node tests/maitrise.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/renaissance.js"); require("../js/maitrise_moteur.js");
let seed = 7; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });

// 1. XP au niveau 200 → Maîtrise
const S = E.newState("Mt", "iop"); const c = S.chars[0]; c.lvl = 200; c.xp = 0;
const need = E.mtNeed(); assert.strictEqual(need, E.xpNeed(199));
E.giveXp(S, c, need * 2 + 5); assert.strictEqual(c.mt.lvl, 2); assert.strictEqual(c.mt.xp, 5); assert.strictEqual(c.lvl, 200);
assert.ok(E.canRenaissance(S, c), "on ne renaît plus");
assert.strictEqual(E.MEM_SLOTS(c), 0);

// 2. Migration : une Renaissance X en cours de vie
const old = E.newState("Old", "cra"); const h = old.chars[0];
h.ren = 10; h.lvl = 120; h.xp = 0; h.eveils = { fureur: 3, robu: 3, lame: 2, classe: 2 }; h.mem = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const raw = JSON.parse(JSON.stringify(old)); raw.v = 10;
const D0 = E.deserialize(JSON.stringify(raw)); const S2 = D0.S || D0.state || D0; const h2 = S2.chars[0];
assert.strictEqual(h2.lvl, 200, "retour au niveau 200");
assert.ok(h2.mt.lvl >= 48 && h2.mt.lvl <= 56, "≈ 52 niveaux venus de 10 vies : " + h2.mt.lvl);
assert.strictEqual(h2.mt.bn, 40, "2 points × (10 Éveils + 10 sorts)");
assert.deepStrictEqual(h2.eveils, {}); assert.deepStrictEqual(h2.mem, []);
assert.strictEqual(h2.ren, 0, "plus d'affichage des vies (Mathis)"); assert.strictEqual(h2.renMt.n, 10);
assert.ok(S2.titlesExtra.includes("Le Phénix renaît de ses cendres"), "le titre souvenir");
assert.strictEqual(E.mtPts(h2), h2.mt.lvl + 40);

// 3. L'arbre agit en combat
const T = E.mtTree("cra"); const M = E.mt(c); c.cls = "cra";
const base = E.charStats(S, c);
const ks = T.N.find((n) => n.t === "ks" && n.fx && n.fx.d !== undefined && !n.neb);
// chemin le plus court jusqu'à la clé de voûte
const prev = new Map([[T.start, -1]]); const q = [T.start]; while (q.length) { const x = q.shift(); if (x === ks.id) break; for (const y of T.N[x].adj) if (!prev.has(y) && !T.N[y].neb) { prev.set(y, x); q.push(y); } }
const path = []; let x = ks.id; while (x !== T.start) { path.push(x); x = prev.get(x); }
M.lvl = path.length; M.t[0] = path;
const fx = E.mtFx(S, c); assert.ok(fx, "effets actifs au niveau 200");
assert.strictEqual(fx.d, ks.fx.d, "la clé de voûte compte");
const after = E.charStats(S, c); assert.ok(Object.keys(fx.st).some((k) => after[k] > base[k]), "caractéristiques en plus");
c.lvl = 199; assert.strictEqual(E.mtFx(S, c), null, "inactive sous le niveau 200"); c.lvl = 200;

// 4. Monture : 0 à 50 % au niveau 200
assert.strictEqual(E.mtShareOf(c), 25); E.setMtShare(S, c.id, 50); assert.strictEqual(E.mtShareOf(c), 50); E.setMtShare(S, c.id, 90); assert.strictEqual(E.mtShareOf(c), 50, "pas plus de 50 %");

// 5. Bestiaire
const r = Object.keys(E.RACE_MONS)[0]; const k0 = E.RACE_MONS[r][0]; S.bestiary[k0] = 10; assert.strictEqual(E.btTier(S, r), 1);
assert.strictEqual(E.btFx(S)[r], 0.5);

// 6. Combats avec la Maîtrise (clés de voûte, bouclier, relève) : rien ne casse
{
  const S3 = E.newState("Fx", "iop"); ["eni", "cra", "feca"].forEach((k) => E.recruit ? E.recruit(S3, k, k) : null); S3.kamas = 1e9;
  S3.chars.forEach((h) => { h.lvl = 200; h.inTeam = true; const T3 = E.mtTree(h.cls); const M3 = E.mt(h); M3.lvl = 300;
    const ids = new Set(); const want = [T3.cks[0], T3.cks[1], ...T3.SP.slice(0, 3).map((x) => x.ks)];
    want.forEach((tg) => { const pv = new Map([[T3.start, -1]]); const q2 = [T3.start]; while (q2.length) { const a = q2.shift(); if (a === tg) break; for (const b of T3.N[a].adj) if (!pv.has(b) && !T3.N[b].neb) { pv.set(b, a); q2.push(b); } } let z = tg; while (z !== T3.start && z !== undefined) { ids.add(z); z = pv.get(z); } });
    M3.t[0] = [...ids]; E.refreshSpells(h, E.charStats(S3, h)); });
  const sub = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] >= 190 && !E.SUBS[k].hidden);
  E.zoneUnlocked = () => true; const err = E.startHunt(S3, sub); assert.ok(!err, err);
  let n = 0, last = null; for (let t = 0; t < 600000; t += 1000) { E.tick(S3, 1000); const F = S3.fight; if (F && F.over && F !== last) { last = F; n++; } }
  assert.ok(n > 0, "des combats ont eu lieu"); console.log(`ok - ${n} combats avec la Maîtrise`);
}

// 2.0.3 : l'XP en trop au passage du niveau 200 va dans la Maîtrise ; arbre nettoyé ; un joyau pour un seul héros ; renaissance refaite sur un vieux client
{ const S4 = E.newState("Ov", "iop"); const a = S4.chars[0]; a.lvl = 199; a.xp = 0; E.giveXp(S4, a, E.heroXpNeed(a) + E.mtNeed() * 2);
  assert.strictEqual(a.lvl, 200); assert.strictEqual(a.mt.lvl, 2, "deux niveaux de Maîtrise après 200"); assert.strictEqual(a.xp, 0);
  const T = E.mtTree(a.cls); const M = E.mt(a); M.lvl = 60; const ks = T.N.filter((n) => n.t === "ks").map((n) => n.id);
  M.t[0] = [...ks, 99999, -1, "x"]; assert.strictEqual(E.mtGot(a).size, 1, "étoiles non reliées ou inconnues ignorées"); { const f = E.mtFx(S4, a); assert.ok(!f || (f.n === 0 && !f.t1 && !f.rev), "aucune clé de voûte en combat"); }
  const nb = T.N[T.start].adj.filter((x) => !T.N[x].neb)[0]; M.t[0] = [nb]; assert.strictEqual(E.mtGot(a).size, 2);
  const nebs = T.N.filter((n) => n.neb).map((n) => n.id); assert.ok(E.mtClean(a, nebs).length === 0, "Nébuleuse fermée sous 1 000 points");
  S4.joy = [{ uid: 5, k: Object.keys(E.JOY)[0] }]; const b = JSON.parse(JSON.stringify(a)); b.id = a.id + 1; S4.chars.push(b); M.j = { [nb]: 5 }; b.mt.j = { [nb]: 5 };
  assert.strictEqual(E.joyOwner(S4, 5), a); const t1 = E.mtStats(S4, a).t, t2 = E.mtStats(S4, b).t; const jk = E.JOY[S4.joy[0].k].b[0];
  assert.ok((t1[jk] || 0) > (t2[jk] || 0), "le joyau ne compte que pour le premier héros");
  const o5 = E.newState("Re", "cra"); const r = o5.chars[0]; r.ren = 2; r.lvl = 80; const raw5 = JSON.parse(JSON.stringify(o5)); raw5.v = 10;
  const S5 = E.deserialize(JSON.stringify(raw5)); const r5 = (S5.S || S5.state || S5).chars[0]; const pts5 = E.mtPts(r5);
  r5.ren = 1; r5.lvl = 1; const raw6 = JSON.parse(JSON.stringify(S5.S || S5.state || S5)); raw6.v = 10; const r6 = (() => { const D = E.deserialize(JSON.stringify(raw6)); return (D.S || D.state || D).chars[0]; })();
  assert.strictEqual(r6.lvl, 200); assert.strictEqual(r6.ren, 0); assert.strictEqual(E.mtPts(r6), pts5, "pas de nouveaux points pour une renaissance refaite");
  console.log("ok - 2.0.3 : XP au passage du 200, arbre nettoyé, joyau unique, pas de double conversion"); }
{ const o7 = E.newState("Co", "iop"); o7.stats.ren = 2; o7.titlesExtra = ["Né des cendres", "Autre"]; o7.chars[0].title = "Flamme éternelle"; o7.chars[0].orn = "phenix";
  const raw7 = JSON.parse(JSON.stringify(o7)); raw7.v = 11; const D7 = E.deserialize(JSON.stringify(raw7)); const S7 = D7.S || D7.state || D7;
  assert.ok(S7.titlesExtra.includes(E.REN_TITLE) && !S7.titlesExtra.includes("Né des cendres") && S7.titlesExtra.includes("Autre")); assert.strictEqual(S7.chars[0].title, null); assert.strictEqual(S7.chars[0].orn, null);
  const o8 = E.newState("Neuf", "iop"); const raw8 = JSON.parse(JSON.stringify(o8)); raw8.v = 11; const D8 = E.deserialize(JSON.stringify(raw8)); assert.ok(!((D8.S || D8.state || D8).titlesExtra || []).includes(E.REN_TITLE), "pas de titre sans renaissance");
  console.log("ok - 2.0.4 : souvenir de la Renaissance même quand le héros rené a été congédié"); }
console.log("maitrise.test.js : OK");

// 2.0.8 (choix de Mathis 2A) : en combat, pas plus d'étoiles que de points (sauvegarde modifiée)
{
  const S9 = E.newState("Cap", "cra"); const h9 = S9.chars[0]; h9.lvl = 200; const T9 = E.mtTree("cra"); const M9 = E.mt(h9);
  const all = T9.N.filter((n) => n.t !== "start" && !n.neb).map((n) => n.id); M9.lvl = 40; M9.bn = 0; M9.t[0] = all;
  assert.strictEqual(E.mtGot(h9).size - 1, 40, "40 points = 40 étoiles au plus");
  const got = E.mtGot(h9); const seen = new Set([T9.start]); const q = [T9.start]; while (q.length) { const x = q.pop(); for (const y of T9.N[x].adj) if (got.has(y) && !seen.has(y)) { seen.add(y); q.push(y); } }
  assert.strictEqual(seen.size, got.size, "les étoiles gardées restent reliées au départ");
  assert.strictEqual(E.mtFx(S9, h9).n, 40); M9.lvl = 0; assert.strictEqual(E.mtFx(S9, h9).n, 0, "0 point : aucune étoile en combat");
  console.log("ok - étoiles plafonnées aux points en combat");
}
// 2.0.9 : dans les 19 ciels, les 3 clés de voûte de chaque domaine sont reliées par le dernier cercle (sans repasser par le cœur)
{ const D0 = require("../js/data.js"); for (const cl of D0.CLASS_ORDER || Object.keys(D0.CLASSES)) { const T = E.mtTree(cl);
  const dist = (a, b) => { const seen = new Map([[a, 0]]); const q = [a]; while (q.length) { const x = q.shift(); if (x === b) return seen.get(x); for (const y of T.N[x].adj) { if (seen.has(y) || T.N[y].neb || T.N[y].r < 1000) continue; seen.set(y, seen.get(x) + 1); q.push(y); } } return -1; };
  for (let d = 0; d < 6; d++) { const ks = T.SP.filter((s) => s.d === d).map((s) => s.ks); assert.ok(dist(ks[0], ks[1]) > 0 && dist(ks[1], ks[2]) > 0, `${cl} : clés de voûte du domaine ${d} reliées`); } } }
console.log("ok - clés de voûte reliées dans chaque domaine");
