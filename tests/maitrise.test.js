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
console.log("maitrise.test.js : OK");
