/* Saison 1, lot 6 (js/cartes.js), sans navigateur : une carte par boss de donjon en 4 raretés, booster du jour et boosters
   des donjons (bornés), 5 cartes dont la 5e rare ou mieux, brillantes ~1 sur 100, doubles en poussière, fabrication,
   album lié au compte (l'Éternel le relit), seulement en saison, paliers de l'album.
   Lancer : node tests/cartes.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js");
global.window = {}; require("../js/boucliers.js"); global.BOUCLIERS = window.BOUCLIERS; delete global.window;
require("../js/garderobe.js"); require("../js/vitrine.js"); require("../js/saisonsoc.js"); require("../js/cartes.js");
const D = require("../js/data.js");
const DAY = 86400000; let now = Date.UTC(2030, 0, 9, 12); E.setClock(() => now); const t0 = now;
const s1 = () => { const S = E.newState("Héros", "iop"); E.s1cStart(S, t0); return S; };

// les cartes
assert.strictEqual(E.CARTES.length, Object.keys(D.DUNGEONS).length, "une carte par donjon");
const n = { c: 0, r: 0, e: 0, l: 0 }; E.CARTES.forEach((c) => n[c.rar]++);
assert(n.c > n.r && n.r > n.e && n.e > n.l && n.l >= 10, "pyramide des raretés " + JSON.stringify(n));
E.CARTES.forEach((c) => { assert(c.img || c.art, "image de " + c.id); if (c.art) assert(fs.existsSync(path.join(__dirname, "..", c.art)), c.art);
  if (c.artB) assert(fs.existsSync(path.join(__dirname, "..", c.artB)), c.artB);
  if (c.img) assert(fs.existsSync(path.join(__dirname, "..", c.img)), c.img); });
console.log("ok - " + E.CARTES.length + " cartes, une par boss de donjon : " + JSON.stringify(n));

// boosters
{ const S = s1();
  assert.strictEqual(E.boosterLeft(S), 1, "un booster offert par jour");
  const o = E.boosterOpen(S); assert(Array.isArray(o) && o.length === 5);
  assert(E.CARTES.find((c) => c.id === o[4].id).rar !== "c", "la 5e est rare ou mieux");
  assert.strictEqual(typeof E.boosterOpen(S), "string", "un seul offert par jour");
  for (let i = 0; i < 40; i++) E.emit(S, "dungeon", { id: "cour_bouftou_royal" });
  assert.strictEqual(E.boosterLeft(S), 2, "2 boosters de donjon par jour au plus");
  now += DAY; assert.strictEqual(E.boosterLeft(S), 3, "le lendemain, le booster du jour revient"); now = t0;
  const Et = E.newState("Ancien", "iop"); assert.strictEqual(E.boosterLeft(Et), 0); assert.strictEqual(typeof E.boosterOpen(Et), "string", "hors saison : pas de booster");
  E.cardImport(Et, E.deserialize(E.serialize(S))); assert.strictEqual(E.cardCount(Et), E.cardCount(S), "album lié au compte : l'Éternel le relit"); }
console.log("ok - boosters : un par jour, 2 de plus en donjon au plus, 5 cartes, seulement en saison, album lié au compte");

// brillantes, doubles, fabrication
{ const S = s1(); let sh = 0, cards = 0; let seed = 7; E.setRng(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  for (let i = 0; i < 2000; i++) { E.boosterGive(S, 1); const o = E.boosterOpen(S); if (typeof o === "string") continue; cards += o.length; sh += o.filter((x) => x.sh).length; }
  E.setRng(Math.random);
  const p = sh / cards; assert(p > 0.006 && p < 0.014, "brillantes ≈ 1 sur 100 : " + p);
  assert(E.cardDust(S) > 0, "les doubles donnent de la poussière");
  const T = s1(); T.s1c.cards = { o: {}, b: {}, pd: 1000, bst: 0, free: 0, dj: 0, djd: 0, djn: 0 };
  const c = E.CARTES.find((x) => x.rar === "l"); assert.strictEqual(E.cardCraft(T, c.id), null); assert.strictEqual(E.cardDust(T), 1000 - E.CARTE_CRAFT.l);
  assert(E.cardCraft(T, c.id), "pas deux fois"); assert(!E.cardShiny(T, c.id), "jamais brillante en fabrication");
  T.s1c.cards.o = Object.fromEntries(E.CARTES.map((x) => [x.id, 1]));
  assert(E.titles(T).includes("Maître de l'Album"), "titre de l'album complet");
  assert(E.ACH.some((a) => a.id === "s1ca30" && a.s1), "succès de l'album dans la saison"); }
console.log("ok - brillantes ≈ 1 sur 100, doubles en poussière, fabrication d'une carte manquante, paliers de l'album");
