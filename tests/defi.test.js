/* Lot Se montrer (0.1.19) : défi du jour et garde-robe, sans navigateur.
   Lancer : node tests/defi.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js");
const D = require("../js/data.js");

// 1. Le jour change à minuit heure de Paris ; le défi est le même pour tous et change chaque jour.
let t = Date.UTC(2030, 0, 7, 22, 59); E.setClock(() => t); // 23 h 59 à Paris (hiver)
const d0 = E.defiDay(); t += 2 * 60000; assert.strictEqual(E.defiDay(), d0 + 1, "minuit à Paris");
t = Date.UTC(2030, 6, 7, 21, 59); const s0 = E.defiDay(); t += 2 * 60000; assert.strictEqual(E.defiDay(), s0 + 1, "minuit à Paris (été)");
const a = E.defi("ave", 9000), b = E.defi("ave", 9000), c = E.defi("ave", 9001);
assert.deepStrictEqual(a, b, "même défi pour tous");
assert.ok(a.did !== c.did || a.k !== c.k || a.mods.join() !== c.mods.join() || a.seed !== c.seed, "il change chaque jour");
for (const T of E.DEFI_TIERS) for (let d = 9000; d < 9030; d++) { const x = E.defi(T.id, d); const dg = D.DUNGEONS[x.did];
  assert.ok(dg.lvl >= T.lo && dg.lvl <= T.hi, "donjon du palier"); assert.ok(x.k >= T.k[0] && x.k <= T.k[1]); assert.strictEqual(new Set(x.mods).size, 2); }
console.log("ok - défi : jour de Paris, même tirage pour tous");

// 2. Le palier : jamais en dessous de son héros le plus fort.
t = Date.UTC(2030, 0, 8, 12, 0);
const S = E.newState("Défi", "iop"); S.chars[0].lvl = 90;
assert.ok(!E.defiTierOk(S, "dec") && E.defiTierOk(S, "ave") && E.defiTierOk(S, "leg"));
assert.strictEqual(E.defiTierDefault(S), "ave");
assert.ok(typeof E.defiPlay(S, "dec") === "string", "palier refusé");

// 3. Même équipe + même jour = même combat ; la partie n'est pas touchée par la simulation.
const G = E.newState("Équipe", "iop"); G.chars[0].lvl = 60; ["eni", "feca", "cra"].forEach((k, i) => { const x = E.addChar(G, k, "H" + i, 60); x.inTeam = true; });
const before = E.serialize(G); const def = E.defi("dec");
const r1 = E.defiSim(G, def, t), r2 = E.defiSim(G, def, t);
assert.deepStrictEqual(r1, r2, "même résultat à chaque essai");
assert.strictEqual(E.serialize(G), before, "la vraie partie ne bouge pas");
const r3 = E.defiSim(JSON.parse(before), def, t); assert.strictEqual(r3.turns, r1.turns, "le serveur (partie relue) trouve le même résultat");
const WT = E.defiWatch(G, def, t); let n0 = 0;
while (!WT.done && n0++ < 500000) { E.defiWatchStep(WT); E.rnd(); E.rnd(); } // l'écran et le reste du jeu tirent du hasard entre deux pas
assert.deepStrictEqual(E.defiResult(WT), r1, "« Regarder le combat » montre exactement le même combat");
console.log("ok - défi : combat identique à chaque essai et pour le serveur");

// 4. Coffre une fois par jour, série stricte (7 jours = titre).
let wins = 0; G.kamas = 0;
for (let day = 0; day < 9; day++) {
  t = Date.UTC(2030, 0, 10 + day, 12, 0);
  let r = null; for (const tid of ["dec", "ave", "leg"]) { if (!E.defiTierOk(G, tid)) continue; r = E.defiPlay(G, tid); if (r.win) break; }
  if (!r || !r.win) { G.chars.forEach((x) => { x.lvl = Math.min(60, x.lvl); }); continue; }
  wins++; assert.ok(r.chest && r.chest.kamas >= 0 && r.chest.dust > 0, "coffre à la première victoire");
  const again = E.defiPlay(G, r.tier); assert.ok(!again.chest, "un seul coffre par jour");
}
assert.ok(wins >= 1, "une équipe niveau 60 gagne au moins un défi Découverte");
if (wins === 9) { assert.strictEqual(G.defiStreak.n, 9); E.checkAch(G); assert.ok(E.titles(G).includes(E.DEFI_TITLE), "titre à 7 jours"); }
const n = G.defiStreak.n; t += 3 * 86400000; E.defiState(G); assert.strictEqual(E.defiStreakNow(G), 0, "un jour manqué remet la série à zéro"); assert.ok(n > 0);
console.log(`ok - défi : coffre, série (${wins}/9 victoires)`);

// 5. Garde-robe : tout ce qu'on possède y entre, on garde l'apparence après avoir vendu l'objet.
const W = E.newState("Garde", "iop");
const coiffe = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "coiffe" && D.ITEMS[k].lvl <= 20);
const it = E.rollItem(W, coiffe, { radiant: false });
assert.ok(E.wardrobe(W)[coiffe], "objet obtenu = apparence obtenue");
delete W.items[it.uid];
assert.ok(E.wardrobe(W)[coiffe], "gardée pour toujours");
const h0 = W.chars[0];
assert.strictEqual(E.setShow(W, h0.id, "coiffe", coiffe), null);
assert.strictEqual(E.shownTpl(W, h0, "coiffe"), coiffe);
assert.strictEqual(E.setShow(W, h0.id, "coiffe", "none"), null); assert.strictEqual(E.shownTpl(W, h0, "coiffe"), null);
const other = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "cape" && !E.wardrobe(W)[k]);
assert.ok(typeof E.setShow(W, h0.id, "cape", other) === "string", "apparence pas encore obtenue");
const old = E.newState("Ancienne", "cra"); const it2 = { uid: 99, tpl: coiffe, stats: {} }; old.items[99] = it2; delete old.wardrobe; delete old.wardrobeInit;
assert.ok(E.wardrobe(old)[coiffe], "à la mise à jour, l'inventaire rejoint la garde-robe");
console.log("ok - garde-robe :", E.WARDROBE_ALL.coiffe.length, "coiffes,", E.WARDROBE_ALL.cape.length, "capes");
console.log("ok - lot Se montrer");
