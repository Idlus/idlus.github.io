/* 2.1.43.3 : un héros qui respecte les challenges ne doit plus passer son tour en boucle.
   Retour d'un joueur (03/11) : Sadida niveau 200 contre Halbardent et Hacharné, « passe son tour » plusieurs tours de suite.
   Cause : « L'IA respecte les challenges » + un challenge (ici Élémentaire) qui interdit tous les sorts de la barre.
   Lancer : node tests/challenge_tour.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "elevage", "idols", "renaissance", "archis", "identite", "identmon", "identboss", "maitrise_moteur", "sram"].forEach((f) => require(`../js/${f}.js`));

let seed = 7;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });

const fight = (defi) => {
  const S = E.newState("T", "iop"); S.chars = [];
  const c = E.addChar(S, "sadi", "Sadida", 200); c.inTeam = true;
  c.spells = ["s13577", "s13559", "s13569"].map((id) => ({ id })); // sorts Air seulement : Élémentaire (Terre, l'élément du Sadida) les interdit tous
  S.settings.chalAI = true;
  assert.strictEqual(E.startHunt(S, "sid_magmatiques"), null);
  E.startFight(S); const F = S.fight;
  F.chals = E.fixedChals(F, ["elementaire"]); if (defi) F.defiRules = true;
  for (let n = 0; !F.over && n < 400; n++) E.step(S);
  return F.log.map((l) => l.txt || l);
};

const L = fight(false);
assert.ok(!L.some((t) => /^Sadida passe son tour/.test(t)), "le Sadida passe encore son tour :\n" + L.slice(0, 20).join("\n"));
assert.ok(L.some((t) => /^Sadida · (Cigüe|Mandragore|Inoculation)/.test(t)), "le Sadida n'attaque pas");
// Défi du jour : les challenges sont la règle, le héros les respecte toujours
const D = fight(true);
assert.ok(D.some((t) => /^Sadida passe son tour/.test(t)), "dans le Défi du jour, le héros doit garder la règle");
console.log("ok - challenges : un héros ne passe plus son tour en boucle (lâche le challenge, sauf Défi du jour)");

// les monstres qui ratent leur cible n'affichent plus « Geoassaut → , rend … vulnérable »
const all = L.concat(D);
assert.ok(!all.some((t) => /→ ,|→ $/.test(t)), "ligne de journal vide : " + all.find((t) => /→ ,|→ $/.test(t)));
console.log("ok - journal : plus de ligne vide quand la cible esquive");
