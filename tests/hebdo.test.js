/* 3.0 : objectifs de la semaine (js/hebdo.js) : 5 tirés par semaine, comptés par les événements seulement avec la 3.0,
   coffre une fois les 5 faits, une seule fois, remis à zéro le lundi. Lancer : node tests/hebdo.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "defi", "hebdo"]) require("../js/" + f + ".js");
const E = window.ENGINE; const H = E.HEBDO;
let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t); // mardi
const S = E.newState("Semaine", "iop");
const W = E.hebdo(S); assert.strictEqual(W.ids.length, 5); assert.strictEqual(new Set(W.ids).size, 5);
const S2 = E.newState("Autre", "cra"); assert.deepStrictEqual(E.hebdo(S2).ids, W.ids, "les mêmes pour tout le monde");
for (const o of E.hebdoList(S)) {
  const K = H.KINDS.find((k) => k.id === o.id);
  for (let i = 0; i < K.goal + 2; i++) {
    if (o.id === "win") E.emit(S, "win", { mons: [] }); else if (o.id === "boss") E.emit(S, "win", { mons: [{ boss: true }] }); else if (o.id === "archi") E.emit(S, "win", { mons: [{ archi: true }] });
    else if (o.id === "harvest") E.emit(S, "harvest", { n: 1 }); else E.emit(S, o.id, {});
  }
  assert.ok(E.hebdoList(S).find((x) => x.id === o.id).done, "objectif " + o.id);
}
assert.ok(E.hebdoDone(S));
const id = E.hebdoChest(S); const n0 = S.cons[id] || 0;
assert.ok(E.hebdoClaim(S).ok); assert.strictEqual(S.cons[id], n0 + 1); assert.ok(E.hebdoClaim(S).err, "une seule fois");
t += 7 * 86400000; assert.ok(!E.hebdo(S).got && !E.hebdoDone(S), "nouvelle semaine");
const wks = new Set(); for (let i = 0; i < 6; i++) { t += 7 * 86400000; wks.add(E.hebdo(S).ids.join()); } assert.ok(wks.size > 1, "les objectifs changent");
// lundi 00:30 à Paris = nouvelle semaine ; dimanche 23:30 = encore l'ancienne
const mon = Date.UTC(2030, 0, 13, 23, 30); assert.strictEqual(E.hebdoWk(mon) - E.hebdoWk(mon - 3600000), 1);
console.log("ok - objectifs de la semaine : 5 par semaine, comptés avec la 3.0, coffre une fois, nouvelle semaine le lundi (Paris)");
