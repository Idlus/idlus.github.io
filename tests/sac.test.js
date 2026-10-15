/* 1.0.33.1 « Sac de 3 000 places » : rangement compact des objets dans le navigateur et règle « Bas niveau ».
   Lancer : node tests/sac.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
const SV = require("../js/save.js");
const tpls = Object.keys(D.ITEMS).filter((t) => D.ITEMS[t].slot !== "dofus" && !D.ITEMS[t].trophy);

// 1. aller-retour exact : objets normaux, verrouillés, Rayonnants, caractéristique ajoutée, trop-plein
const S = E.newState("Sac", "iop");
for (let i = 0; i < 1500; i++) { const it = E.rollItem(S, tpls[(i * 37) % tpls.length], { radiant: i % 50 === 0 }); if (i % 7 === 0) it.locked = true; if (i % 11 === 0) it.stats.pa = 1; }
S.over = [{ uid: 999999, tpl: tpls[3], stats: { vit: 3 }, at: 5 }];
const txt = E.serialize(S), z = E.packSave(txt);
assert.ok(z.length < txt.length * 0.8, "la version compacte est plus légère");
assert.deepStrictEqual(JSON.parse(E.unpackSave(z)), JSON.parse(txt), "rien ne se perd au rangement compact");
assert.strictEqual(E.packSave(z), z, "déjà compact : inchangé");
assert.strictEqual(E.unpackSave(txt), txt, "format normal : inchangé");
const S2 = E.deserialize(z);
assert.strictEqual(Object.keys(S2.items).length, Object.keys(S.items).length);
assert.strictEqual(S2.over.length, 1);
console.log("ok - rangement compact sans perte");

// 2. le navigateur garde la version compacte, la lecture (qui part en ligne) rend le format normal
{
  const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  SV.useStore(SV.local); SV.init({ key: "dofousxen-save", version: "t", engine: E });
  assert.ok(SV.write(txt, S));
  assert.ok(m.get("dofousxen-save").indexOf('"zItems"') >= 0, "écrit en compact");
  assert.strictEqual(SV.read(), JSON.stringify(JSON.parse(txt)), "lu au format normal");
  assert.ok(SV.copies().length && SV.copies()[0].txt.indexOf('"zItems"') >= 0, "copie de secours compacte");
  assert.strictEqual(Object.keys(E.deserialize(SV.copies()[0].txt).items).length, Object.keys(S.items).length, "copie de secours relisible");
  const u = SV.usage(); assert.ok(u.game > 0 && u.total >= u.game + u.copies);
  delete globalThis.localStorage;
}
console.log("ok - sauvegarde du navigateur compacte, lecture normale");

// 3. sac de 3 000 places, +100 par niveau de Grenier
assert.strictEqual(E.ITEM_CAP, 3000);
assert.strictEqual(E.HAVRE.find((x) => x.id === "bag").per, 100);
console.log("ok - sac de 3 000 places");

// 4. règle « Bas niveau » : brise ce qui est 30 niveaux sous le héros le plus faible, garde panoplies, Rayonnants, exo, cadenas
{
  const T = E.newState("Bas", "iop"); T.chars[0].lvl = 150; T.chars[0].inTeam = true;
  T.settings.auto = { action: "none", q: 0, keepSets: true, recycle: false, low: 30 };
  const ranged = (t) => Object.values(D.ITEMS[t].stats).every(([x, y]) => y > x);
  const mk = (tpl) => { const it = E.rollItem(T, tpl, { radiant: false }); for (const k in it.stats) it.stats[k] = D.ITEMS[tpl].stats[k][0]; return it; }; // jet minimum : jamais « parfait »
  const low = tpls.find((t) => D.ITEMS[t].lvl < 100 && !D.ITEMS[t].set && !D.ITEMS[t].leg && ranged(t));
  const lowSet = tpls.find((t) => D.ITEMS[t].lvl < 100 && D.ITEMS[t].set && ranged(t));
  const high = tpls.find((t) => D.ITEMS[t].lvl >= 130 && !D.ITEMS[t].set && !D.ITEMS[t].leg && ranged(t));
  const a = mk(low); assert.strictEqual(E.applyAuto(T, a), "low"); assert.ok(!T.items[a.uid], "objet bas niveau brisé");
  const b = mk(lowSet); assert.strictEqual(E.applyAuto(T, b), null, "panoplie gardée");
  const c = mk(high); assert.strictEqual(E.applyAuto(T, c), null, "objet à niveau gardé");
  const d = mk(low); d.locked = true; assert.strictEqual(E.applyAuto(T, d), null, "cadenas gardé");
  T.settings.auto.low = 0; const f = mk(low); assert.strictEqual(E.applyAuto(T, f), null, "règle éteinte");
}
console.log("ok - règle Bas niveau");
console.log("sac.test.js : OK");
