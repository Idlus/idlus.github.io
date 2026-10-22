/* 2.1.37.5 « Clés à l'atelier » : plus aucune clé ne tombe sur les monstres (Classique et Monocompte partagent les mêmes monstres) ;
   chaque donjon garde une recette de clé chez le Bricoleur. Lancer : node tests/cles.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
let seed = 7; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
E.now = () => 1.8e12; E.protSpawn = () => {}; E.almMult = () => 1;
const KEYS = new Set(Object.values(D.DUNGEONS).map((d) => d.key));
// aucune clé dans les butins des monstres, aucun taux de clé en chasse
{ const bad = []; for (const k in D.MONSTERS) (D.MONSTERS[k].drops || []).forEach(([r]) => { if (KEYS.has(r) || /^Clef (secrète|végétale)/.test(r)) bad.push(D.MONSTERS[k].name + " : " + r); });
  assert.deepStrictEqual(bad, [], "clés dans les butins : " + bad.join(", "));
  assert.deepStrictEqual(Object.keys(D.DUNGEONS).filter((d) => D.DUNGEONS[d].keyDrop), [], "plus de keyDrop sur les donjons"); }
// chaque donjon a une recette de clé
assert.deepStrictEqual(Object.keys(D.DUNGEONS).filter((d) => !D.SPECIAL_CRAFTS[D.DUNGEONS[d].key]), [], "donjon sans recette de clé");
// les ingrédients des clés tombent toujours (ex. Crypte de Kardorim)
assert.ok(Object.values(D.MONSTERS).some((m) => m.drops.some(([r]) => r === "Relique d'Incarnam")), "ingrédient de la Clef de la Crypte de Kardorim toujours en butin");
// Fraktale et Merkator : chaque ingrédient de la clé tombe hors du donjon (sous-zone d'accès) ou se récolte
{ const GATH = new Set(); Object.values(D.GATHER_JOBS).forEach((j) => j.items.forEach(([r]) => GATH.add(r)));
  for (const did of ["megalithe_fraktale", "aquadome_merkator"]) { const mons = new Set(Object.values(E.SUBS).filter((s) => (s.dungeons || [s.dungeon]).includes(did)).flatMap((s) => s.monsters));
    D.SPECIAL_CRAFTS[D.DUNGEONS[did].key].ing.forEach(([r]) => assert.ok(GATH.has(r) || [...mons].some((k) => D.MONSTERS[k].drops.some(([x]) => x === r)), `${did} : ${r} introuvable hors du donjon`)); } }
// chasse dans une sous-zone d'accès à un donjon : aucune clé
{ const sub = Object.values(E.SUBS).find((s) => s.dungeon && s.monsters.length && !s.hidden); assert.ok(sub, "une sous-zone avec donjon");
  const S = E.newState("Cle", "iop"); S.sub = sub.id; S.hunting = true;
  for (let i = 0; i < 400; i++) E.giveRewards(S, sub.monsters.map((key) => ({ key, lvl: D.MONSTERS[key].lvl[0], name: "x" })), { offline: true });
  assert.ok(Object.keys(S.res).length > 0, "les autres ressources tombent toujours");
  assert.ok(!Object.keys(S.res).some((r) => KEYS.has(r)), "aucune clé après 400 combats dans " + sub.name);
  const dg = D.DUNGEONS[sub.dungeon]; assert.strictEqual(E.resRateH(S, dg.key).h, 0, "aucun rythme de clé en chasse"); }
// 2.1.39.1 : plusieurs clés d'un coup (ressources pour 3 clés → 3 clés, ingrédients consommés)
{ const S = E.newState("Cle2", "iop"); const did = Object.keys(D.DUNGEONS)[0]; const key = D.DUNGEONS[did].key; const R = D.SPECIAL_CRAFTS[key];
  S.crafts[R.job].lvl = Math.max(S.crafts[R.job].lvl, R.lvl); R.ing.forEach(([r, q]) => { S.res[r] = q * 3; });
  assert.strictEqual(E.craftCount(S, "special", key), 3, "3 clés possibles");
  const out = E.craftMany(S, "special", key, 3); assert.strictEqual(out.n, 3, "3 clés fabriquées"); assert.strictEqual(S.res[key], 3);
  assert.ok(R.ing.every(([r]) => !S.res[r]), "ingrédients consommés"); }
console.log("cles : OK");
