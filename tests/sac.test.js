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

// 3. sac de 4 000 places (Recycleur, 21/10), +100 par niveau de Grenier
assert.strictEqual(E.ITEM_CAP, 4000);
assert.strictEqual(E.HAVRE.find((x) => x.id === "bag").per, 100);
console.log("ok - sac de 4 000 places");

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
  // 2.1.20 : « Sous le niveau N », sans regarder le niveau des héros (un héros niveau 1 ne bloque plus la règle)
  E.addChar(T, "cra", "Petit", 1).inTeam = true; T.settings.auto.lowLvl = D.ITEMS[low].lvl + 1;
  const g = mk(low); assert.strictEqual(E.applyAuto(T, g), "low", "sous le niveau choisi : brisé"); assert.ok(!T.items[g.uid]);
  const g2 = mk(high); assert.strictEqual(E.applyAuto(T, g2), null, "au-dessus : gardé");
  const g3 = mk(lowSet); assert.strictEqual(E.applyAuto(T, g3), null, "panoplie gardée");
  T.settings.auto.lowLvl = 0; const g4 = mk(low); assert.strictEqual(E.applyAuto(T, g4), null, "réglage vide : gardé");
  // 2.1.29.2 (Akileuss) : « jet < 80 % » + « sous le niveau N » : il faut les deux ; mode « ou » : chacune suffit
  const lowWide = tpls.find((t) => D.ITEMS[t].lvl < 100 && !D.ITEMS[t].set && !D.ITEMS[t].leg && Object.values(D.ITEMS[t].stats).length >= 1 && Object.values(D.ITEMS[t].stats).every(([x, y]) => y - x >= 5));
  const good = (it) => { const L = Object.keys(it.stats); L.forEach((k, i) => (it.stats[k] = D.ITEMS[it.tpl].stats[k][1] - (i ? 0 : 1))); if (it.roll) it.roll = { ...it.stats }; return it; }; // bon jet, pas parfait
  T.settings.auto = { action: "break", q: 80, keepSets: false, recycle: false, lowLvl: Math.max(D.ITEMS[low].lvl, D.ITEMS[lowWide].lvl) + 1 };
  const k1 = mk(high); assert.strictEqual(E.applyAuto(T, k1), null, "jet bas mais niveau trop haut : gardé");
  const k2 = mk(low); assert.strictEqual(E.applyAuto(T, k2), "break", "jet bas et sous le niveau : brisé");
  const k3 = good(mk(lowWide)); assert.ok(E.itemQuality(k3) * 100 >= 80 && !E.isPerfect(k3), "jet ≥ 80 % non parfait");
  assert.strictEqual(E.applyAuto(T, k3), null, "sous le niveau mais bon jet : gardé");
  T.settings.auto.mode = "ou"; const k4 = mk(high); assert.strictEqual(E.applyAuto(T, k4), "break", "mode ou : le jet seul suffit");
  T.settings.auto.action = "none"; const k5 = good(mk(lowWide)); assert.strictEqual(E.applyAuto(T, k5), "low", "niveau seul, quel que soit le jet");
}
console.log("ok - règle Bas niveau");
// 5. « Tout prendre » : le trop-plein revient dans le sac, dans la limite de la place
{
  const T = E.newState("Prendre", "iop"); const tpl = tpls[5]; const cap = E.itemCap(T);
  for (let i = E.itemCount(T); i < cap - 3; i++) E.rollItem(T, tpl, { radiant: false });
  T.over = []; for (let i = 0; i < 5; i++) T.over.push({ uid: 900000 + i, tpl, stats: {}, at: 1 });
  const r = E.overTakeAll(T);
  assert.deepStrictEqual(r, { n: 3, left: 2 }); assert.strictEqual(E.itemCount(T), cap); assert.ok(T.items[900004] && !T.items[900004].at, "les plus récents d'abord");
  assert.deepStrictEqual(E.overTakeAll(T), { n: 0, left: 2 }, "sac plein : rien ne bouge");
}
console.log("ok - Tout prendre");
console.log("sac.test.js : OK");
