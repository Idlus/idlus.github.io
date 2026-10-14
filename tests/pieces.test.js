/* 1.0.18 « Panoplies complètes » : pièces de panoplie et faux ajoutées par js/pieces.js (tools/build_pieces.js).
   Lancer : node tests/pieces.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
global.window = global;
for (const f of ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA; const P = window.PIECES; const { ITEMS, SETS, MONSTERS, RES, CRAFT_JOBS } = D;

// 1. Chaque panoplie peut atteindre son dernier bonus ; les bonus de DOFUS ne changent pas (Mathis 3A).
const size = {}; for (const t in ITEMS) if (ITEMS[t].set) size[ITEMS[t].set] = (size[ITEMS[t].set] || 0) + 1;
const stuck = Object.keys(SETS).filter((s) => Math.max(...Object.keys(SETS[s].bonus).map(Number)) > (size[s] || 0));
assert.deepStrictEqual(stuck.map((s) => SETS[s].name), [], "panoplies au dernier bonus impossible");
for (const s in SETS) assert.strictEqual(SETS[s].size, size[s] || 0, "taille de " + SETS[s].name);
console.log("ok - toutes les panoplies sont complètes");

// 2. Les objets ajoutés existent une seule fois, avec leur image, et ne remplacent rien.
const ids = Object.keys(P.items); assert.ok(ids.length >= 84, ids.length + " objets ajoutés");
const db = {}; for (const t in ITEMS) if (ITEMS[t].dbid) { assert.ok(!db[ITEMS[t].dbid], "objet en double : " + ITEMS[t].name); db[ITEMS[t].dbid] = t; }
assert.ok(!db[32117] || ITEMS[db[32117]].leg, "le Jugement de Thanatena reste le légendaire du Songe");
for (const t of ids) { const T = ITEMS[t];
  assert.strictEqual(T, P.items[t], t); assert.ok(T.lvl >= 1 && T.lvl <= 200, t);
  assert.ok(Object.keys(T.stats).length, "caractéristiques de " + T.name);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "i", T.icon + ".png")), "image de " + T.name); }
console.log("ok - " + ids.length + " objets ajoutés, sans doublon");

// 3. Recette DOFUS sans les ingrédients absents d'Idlus, ou drop pour la pièce sans recette (Bottes de Stroud).
const src = {}; for (const k in MONSTERS) (MONSTERS[k].items || []).forEach(([t, p]) => { (src[t] = src[t] || []).push([k, p]); });
for (const t of ids) { const T = ITEMS[t];
  if (T.craft) { assert.ok(CRAFT_JOBS[T.craft.job] && T.craft.ing.length, "recette de " + T.name); T.craft.ing.forEach(([r, q]) => assert.ok(RES[r] && q > 0, T.name + " : " + r)); }
  assert.ok(src[t], T.name + " tombe sur un monstre"); }
const stroud = ids.find((t) => ITEMS[t].name === "Bottes de Stroud"), ceinture = Object.keys(ITEMS).find((t) => ITEMS[t].name === "Ceinture de Stroud");
assert.ok(stroud && !ITEMS[stroud].craft, "Bottes de Stroud sans recette");
assert.deepStrictEqual(src[stroud], src[ceinture], "Bottes de Stroud : mêmes monstres et même chance que la Ceinture");
console.log("ok - recettes et drops");

// 4. Les 13 faux ajoutées ont leurs dégâts propres (type Faux), sauf la Faux Enracinée de Malter (ligne Neutre de son niveau, comme les autres armes sans dégâts connus).
const faux = ids.filter((t) => ITEMS[t].slot === "arme" && /Faux|Serpe|Flashaux|Nenufaur/.test(ITEMS[t].name));
assert.strictEqual(faux.length, 13, "faux ajoutées");
faux.forEach((t) => { const w = E.weaponData(t); assert.ok(w && w.lines.length, t); if (!w.guess) assert.strictEqual(w.type, 22, ITEMS[t].name + " est une faux"); });
assert.strictEqual(faux.filter((t) => !E.weaponData(t).guess).length, 12);
console.log("ok - faux");

// 5. Une pièce se fabrique, s'équipe et complète sa panoplie jusqu'au dernier bonus.
{ const S = E.newState("T", "iop"); const c = S.chars[0]; c.lvl = 200;
  const t = ids.find((x) => ITEMS[x].set && ITEMS[x].craft && ITEMS[x].slot === "coiffe" && size[ITEMS[x].set] <= 6);
  const T = ITEMS[t]; S.crafts[T.craft.job].lvl = 200; T.craft.ing.forEach(([r, q]) => { S.res[r] = q; });
  const it = E.craftItem(S, t); assert.ok(it && it.uid, "fabrication de " + T.name + " : " + it);
  const pieces = Object.keys(ITEMS).filter((x) => ITEMS[x].set === T.set);
  const ring = { anneau: 0 };
  pieces.forEach((x) => { const u = x === t ? it : E.rollItem(S, x); if (x !== t) S.items[u.uid] = u;
    let slot = ITEMS[x].slot; if (slot === "anneau") slot = "anneau" + (++ring.anneau); E.equip(S, c.id, u.uid, slot); });
  const n = E.setCounts(S, c)[T.set]; assert.strictEqual(n, pieces.length, "pièces portées");
  const max = Math.max(...Object.keys(SETS[T.set].bonus).map(Number));
  assert.strictEqual(E.setBonus(T.set, n), SETS[T.set].bonus[max], "dernier bonus de " + SETS[T.set].name); }
console.log("ok - fabrication et dernier bonus");

// 6. 1.0.30 « Nouvelles caractéristiques » (41A) : les pièces ajoutées ont aussi leurs lignes de PM, Tacle, Fuite et Dommages de poussée.
{ const has = (k) => ids.filter((t) => ITEMS[t].stats[k]);
  ["pm", "tac", "fui", "pou"].forEach((k) => assert.ok(has(k).length > 0, "pièces avec " + k));
  assert.deepStrictEqual(P.items.i12412.stats.pm, [1, 1], "Bottes de Grozilla : 1 PM"); assert.deepStrictEqual(P.items.i12412.stats.fui, [4, 5], "Bottes de Grozilla : Fuite");
  assert.deepStrictEqual(P.items.i14059.stats.pou, [16, 20], "Ceinture Glaciale : Dommages de poussée");
  assert.ok(P.items.i12416.stats.tac[1] < 0, "Ceinture de Grozilla : malus de Tacle"); }
console.log("ok - lignes de PM, Tacle, Fuite et Dommages de poussée des pièces");
