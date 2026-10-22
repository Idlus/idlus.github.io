/* 2.1.39 « Trousseau du jour » (choix 1A 2A 3A 4A 5A de Mathis, 22/10) : une entrée gratuite par donjon débloqué et par jour
   (minuit, heure de Paris), à toute stasis, avant les clés (enchaînement, montée, donjon pendant l'absence), perdue comme une clé.
   Lancer : node tests/trousseau.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/expeditions.js");
const D = require("../js/data.js");
let seed = 5; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
let now = Date.UTC(2026, 9, 22, 10, 0, 0); E.now = () => now; E.protSpawn = () => {}; E.almMult = () => 1;
const did = "crypte_kardorim", dg = D.DUNGEONS[did];
const fresh = () => { const S = E.newState("Tdj", "iop"); S.chars[0].lvl = 40; E.refreshSpells(S.chars[0], E.charStats(S, S.chars[0])); E.dungeonUnlocked = () => true; return S; };
// jour de Paris : 23 h 30 UTC le 22/10 = 1 h 30 à Paris le 23/10
assert.strictEqual(E.tdjDay(Date.UTC(2026, 9, 22, 23, 30)), "2026-10-23", "minuit heure de Paris");
assert.strictEqual(E.tdjDay(Date.UTC(2026, 9, 22, 21, 30)), "2026-10-22");
// 1A : entrée gratuite sans clé, une seule par jour et par donjon
{ const S = fresh(); assert.ok(E.tdjFree(S, did)); assert.strictEqual(E.dgEntries(S, did), 1);
  assert.strictEqual(E.enterDungeon(S, did, 1), null, "entrée sans clé grâce au Trousseau");
  assert.ok(!E.tdjFree(S, did), "entrée du jour prise"); S.dungeon = null; S.fight = null;
  assert.ok(/Il vous faut/.test(E.enterDungeon(S, did, 1)), "deuxième entrée sans clé refusée");
  assert.ok(E.tdjFree(S, "grange_tournesol"), "les autres donjons gardent leur entrée");
  // 5A : la défaite ou la sortie ne la rend pas
  now += 3600e3; assert.ok(!E.tdjFree(S, did));
  // le lendemain (heure de Paris), elle revient
  now = Date.UTC(2026, 9, 22, 22, 5); assert.ok(E.tdjFree(S, did), "nouvelle entrée après minuit à Paris"); now = Date.UTC(2026, 9, 22, 10, 0); }
// 2A : toute stasis débloquée ; 3A : l'entrée du jour passe avant les clés
{ const S = fresh(); const SI = E.stasisInfo(S, did); SI.max = 7; S.res[dg.key] = 2;
  assert.strictEqual(E.dgEntries(S, did), 3);
  assert.strictEqual(E.enterDungeon(S, did, 8, 3), null); assert.strictEqual(S.res[dg.key], 2, "la clé reste : l'entrée du jour d'abord");
  assert.strictEqual(S.dungeon.stasis, 8, "stasis 8 avec l'entrée du jour");
  S.dungeon = null; assert.strictEqual(E.enterDungeon(S, did, 1), null); assert.strictEqual(S.res[dg.key], 1, "puis les clés"); }
// enchaînement : 1 entrée du jour + 1 clé = 2 courses, la troisième s'arrête
{ const S = fresh(); S.res[dg.key] = 1; S.hunting = false;
  assert.strictEqual(E.enterDungeon(S, did, 1, 3), null);
  for (let t = 0; t < 3 * 3600 && S.dungeon; t++) { now += 1000; E.tick(S, 1000); }
  assert.ok(!S.res[dg.key], "la clé a servi pour la deuxième course"); assert.ok((S.progress.bossKills[did] || 0) >= 1, "au moins une victoire"); }
// apporter sa propre clé (Défi de la manche, Bouclier) : l'entrée du jour n'est pas touchée
{ const S = fresh(); S.res[dg.key] = 1; assert.strictEqual(E.enterDungeon(S, did, 1, 1, 0, { noTdj: true }), null);
  assert.ok(!S.res[dg.key], "clé utilisée"); assert.ok(E.tdjFree(S, did), "entrée du jour intacte"); }
// donjon verrouillé : pas d'entrée du jour
{ const S = fresh(); E.dungeonUnlocked = (s, d) => d !== did; assert.ok(!E.tdjFree(S, did)); assert.strictEqual(E.dgEntries(S, did), 0); }
// donjon pendant l'absence : l'entrée du jour fait la première course, puis les clés
{ const S = fresh(); const SI = E.stasisInfo(S, did); SI.max = 1; S.res[dg.key] = 2; E.dghSet(S, { on: true, did, k: 1 }); const H = E.dgh(S); H.b = 8 * 3600;
  const r = E.dghRun(S, 4 * 3600, 1);
  assert.ok(r && r.runs === 3, `3 courses (entrée du jour + 2 clés) : ${r && r.runs} ${r && r.why}`); assert.strictEqual(r.tdj, 1); assert.strictEqual(r.keys, 2); assert.ok(!E.tdjFree(S, did)); }
// opération du serveur (donjon de groupe du Bureau) : marque l'entrée du jour, seulement pour le jour donné
{ const S = fresh(); assert.ok(!E.tdjUse(S, did, "2020-01-01"), "autre jour : ignorée"); assert.ok(E.tdjFree(S, did));
  assert.ok(E.tdjUse(S, did, E.tdjDay())); assert.ok(!E.tdjFree(S, did)); }
// la partie garde l'état du Trousseau
{ const S = fresh(); E.enterDungeon(S, did, 1); const S2 = E.deserialize(E.serialize(S)); assert.ok(!E.tdjFree(S2, did), "sauvegardé"); }
console.log("trousseau : OK");
