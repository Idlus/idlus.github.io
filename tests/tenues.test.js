/* Tenues verrouillées : enregistrer une tenue pose le cadenas sur ses objets, il s'enlève quand l'objet quitte toutes les tenues. Lancer : node tests/tenues.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");
const S = E.newState("Test", "iop");
const c = S.chars[0];
const tpls = Object.keys(D.ITEMS).filter((t) => D.ITEMS[t].lvl <= 1 && D.ITEMS[t].slot && !D.ITEMS[t].leg && !D.ITEMS[t].trophy);
const byslot = {}; tpls.forEach((t) => { const s = D.ITEMS[t].slot; if (!byslot[s] && s !== "dofus" && s !== "anneau") byslot[s] = t; });
const pick = Object.values(byslot).slice(0, 2); assert.ok(pick.length === 2, "deux objets de niveau 1");
const [a, b] = pick.map((t) => E.rollItem(S, t));
const spare = E.rollItem(S, pick[0]); // exemplaire identique, hors tenue
E.equip(S, c.id, a.uid); E.equip(S, c.id, b.uid);
const handLock = E.rollItem(S, pick[1]); handLock.locked = true; // cadenas posé à la main
E.saveGear(S, c.id, 0, "Chasse");
assert.ok(S.items[a.uid].locked && S.items[b.uid].locked, "objets de la tenue verrouillés");
assert.ok(!S.items[spare.uid].locked, "l'exemplaire identique hors tenue reste libre");
E.equip(S, c.id, b.uid); // déjà porté
for (const k in c.equip) if (c.equip[k] === a.uid) delete c.equip[k];
assert.ok(E.breakItem(S, a.uid, null), "un objet de tenue ne se brise pas"); assert.ok(S.items[a.uid]);
// Écraser sans a : a perd le cadenas, b le garde
E.saveGear(S, c.id, 0, "Chasse");
assert.ok(!S.items[a.uid].locked && S.items[b.uid].locked, "Écraser enlève le cadenas des objets retirés");
// supprimer la tenue
E.deleteGear(S, c.id, 0);
assert.ok(!S.items[b.uid].locked, "supprimer la tenue enlève le cadenas");
assert.ok(S.items[handLock.uid].locked, "un cadenas posé à la main reste");
// ancienne sauvegarde : tenue enregistrée sans cadenas → verrouillée au chargement
E.saveGear(S, c.id, 1, "Donjon"); delete S.items[b.uid].locked; delete S.items[b.uid].glock;
const S2 = E.deserialize(E.serialize(S));
assert.ok(S2.items[b.uid].locked, "tenues d'avant la mise à jour verrouillées au chargement");
console.log("ok - tenues : cadenas posé à l'enregistrement, enlevé quand l'objet quitte la tenue, ancien jeu migré");
