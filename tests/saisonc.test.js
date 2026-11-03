/* Classique · Saison 1, lot 1 (js/saisonc.js) : calendrier, Fragments du Temps (borne du jour, quota de 100 par semaine,
   jamais deux fois la même source, rien hors de la saison), bénédictions tous les 10 niveaux (même offre pour tous, choix
   proposé seulement), plafond de Maîtrise par manche, Éternel et Monocompte jamais touchés. Sans navigateur.
   Lancer : node tests/saisonc.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/mono.js"); require("../js/saisonc.js");
const C = E.S1C, RES = C.frag.res, DAY = 86400000;
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const t0 = now;
const s1 = () => { const S = E.newState("Héros", "iop"); E.s1cStart(S, t0); return S; };

// calendrier
{ const S = s1(); assert.strictEqual(E.s1cDay(S), 1); assert.strictEqual(E.s1cManche(S), 1); assert.strictEqual(E.s1cWeek(S), 1);
  now = t0 + 15 * DAY; assert.strictEqual(E.s1cManche(S), 2); assert.strictEqual(E.s1cWeek(S), 3);
  now = t0 + 56 * DAY; assert(E.s1cOver(S)); now = t0; }
console.log("ok - calendrier : 56 jours, 4 manches de 14 jours, semaines");

// Fragments : borne du jour et quota
{ const S = s1();
  for (let i = 0; i < 20; i++) E.s1cActivity(S, "dj");
  assert.strictEqual(E.s1cFrag(S), C.ACT.dj.max, "borne du jour des donjons");
  assert.strictEqual(S.res[RES], C.ACT.dj.max, "le sac montre le registre");
  for (let d = 1; d < 7; d++) { now = t0 + d * DAY; for (const k of Object.keys(C.ACT)) for (let i = 0; i < 20; i++) E.s1cActivity(S, k); }
  assert.strictEqual(E.s1cFrag(S), C.frag.quota, "quota de la semaine 1");
  now = t0 + 7 * DAY; E.s1cActivity(S, "arch"); assert.strictEqual(E.s1cFrag(S), C.frag.quota + C.ACT.arch.gain, "semaine 2 : le quota repart");
  assert.strictEqual(E.s1cSpend(S, 1000), "Il faut 1000 Fragments du Temps.");
  assert.strictEqual(E.s1cSpend(S, 50, "achat:x"), null); assert.strictEqual(E.s1cSpend(S, 50, "achat:x"), "Déjà acheté.");
  now = t0 + 60 * DAY; assert.strictEqual(E.s1cActivity(S, "dj"), 0, "saison finie : plus de gain"); now = t0; }
console.log("ok - Fragments du Temps : borne du jour, quota de 100 par semaine, une source ne paie qu'une fois, fin de saison");

// bénédictions
{ const S = s1(); assert.strictEqual(E.s1cBoonOffer(S), null, "niveau 1 : rien à choisir");
  S.chars[0].lvl = 25; const o = E.s1cBoonOffer(S); assert.strictEqual(o.step, 1); assert.strictEqual(new Set(o.ids).size, 3);
  assert.strictEqual(E.s1cBoonPick(S, "nope"), "Ce choix n'est pas proposé.");
  const xp0 = E.bonus(S, "xp"); const id = o.ids.find((x) => x === "xp") || o.ids[0]; assert.strictEqual(E.s1cBoonPick(S, id), null);
  const B = C.BOONS.find((x) => x.id === id); assert.strictEqual(E.bonus(S, B.k) > 0 || B.k === "offrate", true);
  if (B.k === "xp") assert.strictEqual(E.bonus(S, "xp"), xp0 + B.v);
  assert.strictEqual(E.s1cBoonOffer(S).step, 2); E.s1cBoonPick(S, E.s1cBoonOffer(S).ids[0]); assert.strictEqual(E.s1cBoonOffer(S), null, "2 paliers au niveau 25");
  const T = s1(); T.chars[0].lvl = 25; assert.deepStrictEqual(E.s1cBoonOffer(T).ids, o.ids, "même offre pour tous"); }
console.log("ok - bénédictions : un choix tous les 10 niveaux parmi 3, même offre pour tous, bonus ajouté");

// Maîtrise par manche
{ const S = s1(); const c = S.chars[0]; c.lvl = E.MAX_LVL; for (let i = 0; i < 400; i++) E.giveXp(S, c, 1e12);
  assert.strictEqual(E.mt(c).lvl, C.mtCap[0], "manche 1 : plafond");
  now = t0 + 15 * DAY; for (let i = 0; i < 400; i++) E.giveXp(S, c, 1e12); assert.strictEqual(E.mt(c).lvl, C.mtCap[1]); now = t0; }
console.log("ok - Maîtrise : plafond par manche, relevé à la manche suivante");

// rien hors de la saison
{ const S = E.newState("Héros", "iop"); for (let i = 0; i < 10; i++) E.s1cActivity(S, "dj"); assert.strictEqual(E.s1cFrag(S), 0); S.res[RES] = 50; E.s1cSync(S); assert.strictEqual(S.res[RES], undefined, "Éternel : pas de Fragments");
  S.chars[0].lvl = 50; assert.strictEqual(E.s1cBoonOffer(S), null); const c = S.chars[0]; c.lvl = E.MAX_LVL; for (let i = 0; i < 200; i++) E.giveXp(S, c, 1e12); assert(E.mt(c).lvl > C.mtCap[0], "Éternel : pas de plafond");
  const M = E.monoStart(E.newState("Mono", "iop")); M.s1c = { s: 1, t0 }; assert(!E.isS1c(M), "Monocompte jamais touché");
  const txt = E.serialize ? E.serialize(s1()) : null; if (txt) { const R = E.deserialize(txt); assert(E.isS1c(R)); } }
console.log("ok - Éternel et Monocompte jamais touchés, sauvegarde relue");
