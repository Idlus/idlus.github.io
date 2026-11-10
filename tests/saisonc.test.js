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

// 2.2.14.15 (Mathis 10/11) : plus de plafond de Maîtrise en Saison 1, plus de Fragments pour l'XP au plafond
{ const S = s1(); const c = S.chars[0]; c.lvl = E.MAX_LVL; assert.strictEqual(E.s1cMtCap(S), Infinity); assert(!C.ACT.mt, "plus d'activité « XP au plafond »");
  const f0 = E.s1cFrag(S); for (let i = 0; i < 400; i++) E.giveXp(S, c, 1e12);
  assert(E.mt(c).lvl > 250, "manche 1 : plus de plafond"); assert.strictEqual(E.s1cFrag(S), f0, "pas de Fragments pour la Maîtrise"); assert.strictEqual(E.s1cBanked(S, c), 0, "rien gardé"); }
console.log("ok - Maîtrise sans plafond en Saison 1");
// l'XP déjà gardée (ancienne règle) est versée tout de suite, une seule fois
{ const S = s1(); const c = S.chars[0]; c.lvl = E.MAX_LVL; const M = E.mt(c); E.giveXp(S, c, E.mtXpTot(50));
  const l0 = M.lvl; E.s1cBank(S).x[c.id] = E.mtXpTot(80) - E.mtXpTot(50);
  const pts = E.s1cBankPay(S); assert(pts >= 29 && M.lvl === l0 + pts, "réserve versée sans attendre la manche suivante");
  assert.strictEqual(E.s1cBanked(S, c), 0); assert.strictEqual(E.s1cBankPay(S), 0, "versé une seule fois"); }
console.log("ok - XP gardée au plafond : versée tout de suite");

// équilibrage 1B : un week-end Double gain par manche (2e week-end, vendredi 18 h → dimanche 22 h UTC)
{ const ev0 = E.EVENT; assert.deepStrictEqual(E.s1Weekends(), [], "sans date d'ouverture : pas de week-end");
  C.debut = Date.UTC(2026, 10, 28, 18, 0); const W = E.s1Weekends(); assert.strictEqual(W.length, 4);
  W.forEach((w, m) => { const d = new Date(w.from); assert.strictEqual(d.getUTCDay(), 5); assert.strictEqual(d.getUTCHours(), 18); assert(w.from >= C.debut + (m * 14 + 7) * DAY && w.from < C.debut + (m * 14 + 14) * DAY, "dans la 2e semaine de la manche"); assert.strictEqual(new Date(w.to).getUTCDay(), 0); });
  E.EVENT = { name: "vieux", from: 0, to: 1, xp: 2, drop: 2 }; E.s1EventSync(W[0].from - DAY); assert(E.EVENT.s1 === 1 && !E.eventOn(W[0].from - DAY), "annoncé, pas encore ouvert");
  assert(E.eventOn(W[0].from + 3600000) && E.evMult("xp", W[0].from + 3600000) >= 2);
  E.s1EventSync(W[0].to + 1); assert.strictEqual(E.EVENT.s1, 2, "puis le week-end de la manche 2");
  const hand = { name: "à la main", from: W[1].from - 5 * DAY, to: W[1].from + DAY, xp: 3, drop: 3 }; E.EVENT = hand; E.s1EventSync(W[1].from); assert.strictEqual(E.EVENT, hand, "un événement prévu à la main passe avant");
  E.EVENT = W[3]; E.s1EventSync(W[3].to + 1); assert.strictEqual(E.EVENT, null, "fini après la saison");
  C.debut = null; E.EVENT = ev0; }
console.log("ok - week-end Double gain : 1 par manche, dans la 2e semaine, sans écraser un événement prévu");

// équilibrage 4A / 7A : réglage des donjons pour les parties de saison seulement
{ const S = s1(), O = E.newState("Héros", "iop"); const M = E.monoStart(E.newState("Mono", "iop"));
  const at = (X, did, k) => { X.dungeon = { id: did, stasis: k }; const v = E.dgDiff(X, did); X.dungeon = null; return v; };
  assert(at(S, "crypte_kardorim", 1) > at(O, "crypte_kardorim", 1), "4A : plus dur en saison");
  assert.strictEqual(at(O, "crypte_kardorim", 1), E.DG_DIFF.crypte_kardorim || 1, "4A : Éternel inchangé");
  assert(at(M, "crypte_kardorim", 1) > at(O, "crypte_kardorim", 1), "4A : Monocompte de saison aussi");
  assert.strictEqual(at(S, "epave_grolandais", 7), at(O, "epave_grolandais", 7), "7A : stasis 1 à 7 inchangées");
  assert(at(S, "epave_grolandais", 8) < at(O, "epave_grolandais", 8), "7A : adouci dès la stasis 8");
  assert.strictEqual(at(O, "epave_grolandais", 12), E.DG_DIFF.epave_grolandais || 1, "7A : Éternel inchangé"); }
console.log("ok - donjons de saison : 9 durcis, 4 murs adoucis dès la stasis 8, Éternel inchangé");

// équilibrage 3A : retouches Xélor, Pandawa, Enutrof en saison seulement, jamais au Kolizéum
{ const S = s1(), O = E.newState("Héros", "iop");
  assert.strictEqual(E.xelorClock(S, {}), E.RET_S1.xelorClock); assert.strictEqual(E.xelorClock(O, {}), 12, "Éternel : horloge à 12");
  assert.strictEqual(E.xelorClock(S, { pvp: true }), 12, "Kolizéum : inchangé"); }
console.log("ok - retouches de classes : saison seulement, hors Kolizéum");

// rien hors de la saison
{ const S = E.newState("Héros", "iop"); for (let i = 0; i < 10; i++) E.s1cActivity(S, "dj"); assert.strictEqual(E.s1cFrag(S), 0); S.res[RES] = 50; E.s1cSync(S); assert.strictEqual(S.res[RES], undefined, "Éternel : pas de Fragments");
  S.chars[0].lvl = 50; assert.strictEqual(E.s1cBoonOffer(S), null); const c = S.chars[0]; c.lvl = E.MAX_LVL; for (let i = 0; i < 200; i++) E.giveXp(S, c, 1e12); assert(E.mt(c).lvl > 50, "Éternel : pas de plafond");
  const M = E.monoStart(E.newState("Mono", "iop")); M.s1c = { s: 1, t0 }; assert(!E.isS1c(M), "Monocompte jamais touché");
  const txt = E.serialize ? E.serialize(s1()) : null; if (txt) { const R = E.deserialize(txt); assert(E.isS1c(R)); } }
console.log("ok - Éternel et Monocompte jamais touchés, sauvegarde relue");
