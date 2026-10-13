/* Boss des mondes (0.1.49), sans navigateur.
   Lancer : node tests/wboss.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js"); require("../js/gboss.js"); require("../js/wboss.js");
const D = require("../js/data.js");

// 1. Rotation : Gargandyas ouvre, 8 grands boss, puis il revient ; tous les boss existent et sont calibrés.
assert.strictEqual(E.wbDef(1).name, "Gargandyas");
assert.strictEqual(E.wbDef(1 + E.WB_ROT.length).name, "Gargandyas", "Gargandyas revient après la rotation");
for (let n = 1; n <= E.WB_ROT.length; n++) { const d = E.wbDef(n); assert.ok(D.MONSTERS[d.mon], "boss inconnu " + n); assert.ok(E.WB_POW[d.key] > 0, "boss non calibré " + d.key); assert.notStrictEqual(d.weak, d.res); }
assert.deepStrictEqual([0, 149, 150, 299, 300, 600, 1050, 1500, 15000].map((p) => E.wbGrade(p).g), ["C", "C", "B", "B", "A", "S", "SS", "SSS", "SSS"]);
assert.deepStrictEqual([0, 33, 34, 66, 67, 100].map((d) => E.wbPhase(d, 100)), [1, 1, 2, 2, 3, 3]);
console.log("ok - rotation, grades, phases");

// 2. Un essai : même hasard = mêmes points ; la partie n'est pas touchée ; le donjon de passage disparaît.
const t = Date.UTC(2030, 0, 6, 12); E.setClock(() => t);
const G = E.newState("Équipe", "iop"); G.chars[0].lvl = 120; ["eni", "feca", "cra"].forEach((k, i) => { const x = E.addChar(G, k, "H" + i, 120); x.inTeam = true; });
G.chars.forEach((c) => E.refreshSpells(c, E.charStats(G, c)));
const before = E.serialize(G); const nD = Object.keys(D.DUNGEONS).length;
for (const n of [1, 2]) {
  const def = E.wbDef(n); const seed = E.wbSeed(n, "u", 0);
  const r1 = E.wbSim(G, def, 1, seed, t), r2 = E.wbSim(G, def, 1, seed, t);
  assert.deepStrictEqual(r1, r2, "même essai, même résultat");
  assert.ok(r1.points >= 0 && r1.rounds <= E.WB_ROUNDS && r1.pv === r1.points * E.WB_PV, JSON.stringify(r1));
  const r3 = E.wbSim(G, def, 3, seed, t); assert.ok(r3.points >= 0 && r3.rounds <= E.WB_ROUNDS);
}
assert.strictEqual(E.serialize(G), before, "la partie n'est pas touchée");
assert.strictEqual(Object.keys(D.DUNGEONS).length, nD, "pas de donjon de passage oublié");
assert.ok(!Object.keys(D.DUNGEONS).some((k) => k.startsWith("wb_")));
// le pas à pas (Revoir le combat) donne le même résultat que l'essai joué d'un coup
const W = E.wbWatch(G, E.wbDef(1), 2, 77, t); for (let g = 0; g < 200000 && !W.done; g++) E.wbWatchStep(W);
assert.deepStrictEqual(E.wbResult(W), E.wbFight(G, E.wbDef(1), 2, 77, t));
// 0.1.56 : un essai = 3 combats (1.0.4.6 : leur total) ; le combat montré est l'un d'eux
const R = E.wbSim(G, E.wbDef(1), 1, 99, t);
assert.strictEqual(R.fights.length, E.WB_FIGHTS);
assert.strictEqual(R.points, R.fights.reduce((a, f) => a + f.points, 0), "1.0.4.6 : l'essai compte le total des 3 combats");
assert.ok(R.fights.some((f) => f.seed === R.watchSeed));
const W2 = E.wbWatch(G, E.wbDef(1), 1, R.watchSeed, t); for (let g = 0; g < 200000 && !W2.done; g++) E.wbWatchStep(W2);
assert.ok(R.fights.some((f) => f.points === E.wbResult(W2).points), "le combat revu fait partie des 3");
// plus de héros et plus de niveau = plus de points
assert.ok(E.wbMult(200, 8) > E.wbMult(60, 8) && E.wbMult(60, 8) > E.wbMult(60, 4) && E.wbMult(60, 4) > E.wbMult(20, 4));
console.log("ok - essai rejouable, partie intacte");

// 3. Boutique de Fragments d'anomalie et bonus d'XP.
assert.ok(E.wbBuy(G, "i31789").err, "pas assez de Fragments");
G.res[E.WB_FRAG] = 130; const b = E.wbBuy(G, "i31789"); assert.ok(b.ok && G.items[b.it.uid] && G.items[b.it.uid].tpl === "i31789");
assert.strictEqual(G.res[E.WB_FRAG], 10);
E.WB_SHOP.forEach(([tpl]) => assert.ok(D.ITEMS[tpl] && D.ITEMS[tpl].lvl === 200));
const x0 = E.evMult("xp", t); E.wbXpUntil = t + 3600e3; assert.ok(Math.abs(E.evMult("xp", t) - x0 * 1.1) < 1e-9, "+10 % d'XP"); E.wbXpUntil = 0;
console.log("ok - boutique, bonus d'XP");

// 4. La page charge bien les deux fichiers (une fusion les avait déjà fait disparaître de index.html).
const html = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
["js/wboss.js", "js/wbossui.js"].forEach((f) => assert.ok(html.includes(`<script src="${f}?v=`), `${f} absent de index.html`));
assert.ok(html.indexOf("js/legendaires.js") < html.indexOf("js/wboss.js"), "wboss.js après legendaires.js");
console.log("ok - index.html charge le Boss des mondes");
