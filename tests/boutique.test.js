/* 3.0 : Boutique de la semaine (js/boutique.js) : 6 apparences par semaine (au moins 1 Légendaire et 1 couleur de pseudo),
   prix de 200 000 à 2 M, achat une fois, visibles dans la Garde-robe une fois achetées. Lancer : node tests/boutique.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "defi", "garderobe", "hebdo", "boutique"]) require("../js/" + f + ".js");
const E = window.ENGINE; const B = E.BTQ;
let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
const seen = new Set();
for (let w = 0; w < 30; w++) { const L = E.btqWeek(E.btqWk() + w); assert.strictEqual(L.length, 6); assert.strictEqual(new Set(L.map((i) => i.id)).size, 6);
  assert.ok(L.some((i) => i.rar === "l") && L.some((i) => i.k === "pcol")); L.forEach((i) => { seen.add(i.id); assert.ok(i.prix >= 200000 && i.prix <= 2000000); }); }
assert.ok(seen.size >= B.ITEMS.length - 2, "tout le catalogue passe en quelques semaines");
const S = E.newState("Boutique", "iop"); const it = E.btqWeek()[0];
assert.ok(!E.GR_AURAS[it.id] && !E.GR_PCOL[it.id] ? false : true);
const T = it.k === "aura" ? E.GR_AURAS : E.GR_PCOL; assert.ok(!T[it.id].ok(S), "pas encore à moi");
S.kamas = it.prix - 1; assert.ok(E.btqBuy(S, it.id).err); assert.strictEqual(S.kamas, it.prix - 1);
S.kamas = it.prix * 2; assert.ok(E.btqBuy(S, it.id).ok); assert.strictEqual(S.kamas, it.prix); assert.ok(T[it.id].ok(S), "dans la Garde-robe");
assert.ok(E.btqBuy(S, it.id).err, "une seule fois"); assert.strictEqual(S.kamas, it.prix);
const off = B.ITEMS.find((i) => !E.btqWeek().some((x) => x.id === i.id)); assert.ok(E.btqBuy(S, off.id).err, "hors de la semaine");
const S2 = E.deserialize(E.serialize(S)); assert.ok(E.btqHas(S2, it.id), "gardé dans la sauvegarde");
console.log("ok - Boutique de la semaine : 6 apparences, prix, achat unique, Garde-robe, sauvegarde");
