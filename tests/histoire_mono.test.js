/* Monocompte · Saison 1 : la même histoire que le Classique (Mathis 03/11 « pour les booster ect je veux les même quetes que classique »).
   Scènes de la quête principale, boosters par scène, album rangé dans S.mono.cards, campagne de saison comptée en Éclats du Temps,
   coffre du jour sans les expéditions (absentes du Monocompte) ; l'Éternel Monocompte n'a ni scènes ni boosters.
   Lancer : node tests/histoire_mono.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/quetes.js"); require("../js/saisonc.js"); require("../js/mono.js"); require("../js/monopass.js"); require("../js/saison1.js");
require("../js/cartes.js"); require("../js/histoire.js");
let now = Date.UTC(2026, 10, 4, 12, 0); E.setClock(() => now);
const mono = () => { const S = E.newState("Héros", "iop"); E.monoStart(S); E.refreshSystems(S); return S; };

{ const S = mono(); assert(E.isMono(S) && !E.isS1c(S)); assert(E.histOn(S), "histoire active en Monocompte de saison"); assert(E.cardOn(S), "album actif");
  assert.strictEqual(E.histScene(S).n, 0); assert.strictEqual(E.questStep(S), E.MAIN_QUEST[0]);
  const b0 = E.boosterLeft(S); assert.strictEqual(b0, 1, "booster offert du jour");
  S.chars[0].lvl = 5; E.histCheck(S);
  E.emit(S, "win", { sub: "inc_route", mons: new Array(10).fill({ key: "x" }) });
  S.chars[0].equip = { a: 1, b: 2 }; E.histCheck(S);
  assert.strictEqual(E.hist(S).sc, 1, "première scène finie");
  assert.strictEqual(E.boosterLeft(S) - b0, E.HIST_BOOST, "2 boosters par scène");
  assert(S.mono.cards && S.mono.cards.bst === E.HIST_BOOST, "album dans S.mono.cards"); assert(!S.s1c, "pas de partie Classique créée");
  const r = E.boosterOpen(S); assert(Array.isArray(r) && r.length === E.BOOSTER_N, "booster ouvert");
  assert(E.cardCount(S) >= 1); }
console.log("ok - Monocompte : scènes, boosters par scène, album de la partie");

{ const S = mono(); assert(E.campOpen(S, 0), "chapitre 1 de la campagne ouvert"); assert.strictEqual(E.campKey(S, "frag"), "Éclats du Temps gagnés");
  const T = E.camp(S); T.p = { dj: 99, harvest: 999 };
  for (let i = 0; i < 2; i++) E.emit(S, "bounty", {});
  assert.strictEqual(T.c, 1, "chapitre 1 fini"); assert(T.fin.length === 1);
  assert(!E.dchTasks(S).some((x) => x.id === "exp"), "pas d'expédition en Monocompte"); assert.strictEqual(E.dchTasks(S).length, E.DCH_TASKS.length - 1); }
console.log("ok - Monocompte : campagne de saison et coffre du jour");

// partie Monocompte déjà avancée dans l'ancienne quête (avant 2.2.1.1) : étapes gardées, rien repayé, boosters des scènes couvertes
{ const S = mono(); delete S.hist; S.quest = { step: 9, prog: 0 }; S.chars[0].lvl = 12;
  const S2 = E.deserialize(E.serialize ? E.serialize(S) : JSON.stringify(S));
  const T = E.hist(S2); assert(T.sc >= 2, `scènes couvertes passées (${T.sc})`);
  assert(S2.quest.step >= 9, `étape gardée (${S2.quest.step})`); assert(!JSON.stringify(S2.journal || []).includes("Objectif atteint"), "rien repayé");
  assert(E.boosterLeft(S2) > 1, "boosters de rattrapage"); for (let i = 0; i < 9; i++) assert(E.histGoalDone(S2, i), `étape ${i} faite`); }
console.log("ok - Monocompte déjà avancé : étapes gardées, rien repayé");

{ const S = mono(); S.mono.eternel = { s: 1, at: now, lvl: 1 }; assert(!E.histOn(S), "Éternel Monocompte : pas de scènes"); assert(!E.cardOn(S)); assert.strictEqual(E.boosterGive(S, 3), 0); }
{ const S = E.newState("Héros", "iop"); E.refreshSystems(S); assert(!E.histOn(S) && !E.cardOn(S), "Éternel Classique inchangé"); }
console.log("ok - Éternel (Monocompte et Classique) sans scènes ni boosters");
