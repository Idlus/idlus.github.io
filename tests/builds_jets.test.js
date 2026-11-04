/* 2.2.3.3 : le code d'un build garde les vrais jets des objets portés, leur exo et la gravure ; la fiche du build
   retrouve les mêmes caractéristiques que le héros. Lancer : node tests/builds_jets.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = E.DATA || require("../js/data.js");
const { ITEMS } = D;
const S = E.newState("Test", "iop");
const c = S.chars[0]; c.lvl = 200;
// le pire cas pour la taille du code : dans chaque emplacement, l'objet qui a le plus de lignes
const SL = ["coiffe", "cape", "amulette", "anneau1", "anneau2", "ceinture", "bottes", "arme", "bouclier", "dofus1", "dofus2", "dofus3", "dofus4", "dofus5", "dofus6"];
const used = new Set();
for (const sl of SL) {
  const want = sl.replace(/\d$/, "");
  const tpl = Object.keys(ITEMS).filter((k) => { const T = ITEMS[k]; return (T.slot === want || (want === "dofus" && T.slot === "dofus")) && !T.trophy && !used.has(k) && T.lvl <= 200; })
    .sort((a, b) => Object.keys(ITEMS[b].stats || {}).length - Object.keys(ITEMS[a].stats || {}).length)[0];
  if (!tpl) continue; used.add(tpl);
  const it = E.rollItem(S, tpl, { radiant: false });
  for (const k in it.stats) if (it.stats[k] > 0) it.stats[k] += 7; // forgemagie au-dessus du jet maximum
  c.equip[sl] = it.uid;
}
const coiffe = S.items[c.equip.coiffe]; coiffe.exo = "pa";
const cape = S.items[c.equip.cape]; cape.exo = "pm";
c.grav = { coiffe: 4, bottes: 10 };
const code = E.buildCode(S, c);
assert.ok(code.length <= 4000, `code trop long pour le serveur (${code.length} > 4000)`);
const b = E.parseBuild(code);
assert.ok(b && b.rx, "jets lus");
assert.deepStrictEqual(b.rx.coiffe.st, Object.fromEntries(Object.entries(coiffe.stats).filter(([, v]) => v)));
assert.strictEqual(b.rx.coiffe.exo, "pa"); assert.strictEqual(b.rx.cape.exo, "pm"); assert.strictEqual(b.rx.bottes.exo, null);
assert.deepStrictEqual(b.gv, { coiffe: 4, bottes: 10 });
// mêmes caractéristiques que le héros (comme statsOf de js/builds.js)
const S2 = E.newState("Vue", "cra"); const eq = {}; let k = -900;
for (const sl in b.eq) { const r = b.rx[sl]; S2.items[k] = { uid: k, tpl: b.eq[sl], stats: Object.assign({}, r.st), exo: r.exo || undefined }; eq[sl] = k--; }
const fake = { id: -1, cls: b.cls, lvl: b.lvl, alloc: Object.assign({}, b.st), scrolls: {}, equip: eq, grav: Object.assign({}, b.gv), pet: null, mount: null, spells: [] };
const a = E.charStats(S2, fake), h = E.charStats(S, c);
for (const key of ["hpMax", "pa", "pm", "po", "fo", "ine", "cha", "age", "sa", "pui", "do", "cri", "so", "ini", "pp"]) assert.strictEqual(a[key], h[key], `${key} : ${a[key]} au lieu de ${h[key]}`);
// un vieux code (sans jets) reste lisible : jets moyens côté fiche
const old = E.BUILD_PREFIX + Buffer.from(JSON.stringify({ v: 1, cls: "iop", lvl: 50, st: {}, sp: [], eq: { coiffe: coiffe.tpl } })).toString("base64");
const ob = E.parseBuild(old); assert.ok(ob && ob.rx === null && ob.eq.coiffe === coiffe.tpl);
// valeurs hostiles ignorées
const bad = E.BUILD_PREFIX + Buffer.from(JSON.stringify({ v: 1, cls: "iop", lvl: 50, st: {}, sp: [], eq: { coiffe: coiffe.tpl }, rx: { coiffe: [{ fo: 1e9, zz: 5, vit: "x" }, "nope"] }, gv: { coiffe: 99 } })).toString("base64");
const bb = E.parseBuild(bad); assert.deepStrictEqual(bb.rx.coiffe, { st: { fo: 5000 }, exo: null }); assert.ok(bb.gv.coiffe <= E.GRAV.max);
console.log(`builds_jets : OK (code de ${code.length} caractères au pire)`);
