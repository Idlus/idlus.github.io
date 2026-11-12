/* La Brèche (Idlus 3.0, 1B de Mathis, 13/11/2026 « avec mon équipe ») : l'équipe et son équipement montent des étages sans fin
   (moteur du Songe, js/songe.js) : boss tous les 10 étages, étages du Songe en 5, règle de la semaine, record de la semaine,
   résumé à part (le dernier songe ne bouge pas), le Songe infini fermé pendant une montée. */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "koli", "legendaires", "songe"].forEach((f) => require("../js/" + f + ".js"));
const V = require("../js/verify.js");
const w = E.weekIdx();
// étages : boss tous les 10, étages du Songe en 5, les mêmes pour tous
for (let d = 10; d <= 300; d += 10) assert.strictEqual(E.brNode(w, d).t, "boss", "boss à l'étage " + d);
const five = []; for (let d = 5; d <= 205; d += 10) five.push(E.brNode(w, d).t);
assert.ok(five.every((t) => t === "favor" || t === "archi") && five.includes("favor") && five.includes("archi"), "étages en 5 : Faveur ou Archimonstre");
assert.deepStrictEqual(E.brNode(w, 37), E.brNode(w, 37), "même étage pour tous");
assert.ok(E.brStasis(80, "fight", 200) > E.brStasis(40, "fight", 200), "plus dur en montant");
assert.ok(E.brStasis(40, "fight", 120) > E.brStasis(40, "fight", 200), "pas plus haut pour une équipe plus basse");
// une montée
const S = E.newState("B", "iop"); S.chars[0].lvl = 60; ["cra", "eni"].forEach((c, i) => { const x = E.addChar(S, c, "H" + i, 60); x.inTeam = true; });
E.BR.base = -1; E.BR.step = 0; // une équipe sans équipement doit passer un boss pour le test
assert.strictEqual(E.act(S, "brStart"), null); assert.ok(E.brOn(S)); assert.strictEqual(S.exp.nodes.length, 1);
assert.ok(typeof E.expStart(S, 0) === "string", "pas de songe pendant la Brèche");
let sd = 7; E.setRng(() => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }); E.expAutoPlay(S, 25);
const top = E.brOn(S) ? S.exp.nodes[S.exp.at].d : S.brLast.d;
assert.ok(top >= 10, "un boss franchi : étage " + top); assert.strictEqual(E.brWeek(S).d, top, "record de la semaine");
assert.ok(E.songe(S).br > 0, "Bribes de rêve du boss");
if (E.brOn(S)) E.expQuit(S);
assert.ok(!E.expActive(S) && S.brLast && S.brLast.d === top && !S.expLast, "sortie : résumé de la Brèche à part");
const m = V.summary(E, S); assert.deepStrictEqual(m.brk, { w, d: top }, "résumé envoyé au classement");
console.log(`ok - la Brèche : étages sans fin (boss tous les 10, Songe en 5), règle de la semaine, record étage ${top}, Bribes, résumé à part`);
