/* Saison 1, lot 5 (js/saisonsoc.js), sans navigateur : autocollants (4 offerts, succès, vitrine), blason (code en lettres
   accepté par guild_set, aller-retour), meubles rares (boss en stasis 5, vitrine), objets ajoutés à la vitrine de saison.
   Lancer : node tests/saisonsoc.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js");
global.window = {}; require("../js/boucliers.js"); global.BOUCLIERS = window.BOUCLIERS; delete global.window;
require("../js/garderobe.js"); require("../js/vitrine.js"); require("../js/saisonsoc.js");
const D = require("../js/data.js");

const S = E.newState("Héros", "iop");
assert.strictEqual(E.stMine(S).length, 4, "4 autocollants offerts");
assert(!E.stOk(S, 9) && !E.stOk(S, 99));
S.s1c = { shop: { v_st9: 1 } }; assert(E.stOk(S, 9), "autocollant de la vitrine");
assert(E.ST_RE.test(":st:12:") && !E.ST_RE.test(":st:12: coucou"));
console.log("ok - autocollants : 4 offerts, les autres par les succès et la vitrine");

for (let sh = 0; sh < 8; sh++) for (const em of [0, 7, 23]) for (const c2 of [0, 15]) {
  const code = E.crestCode(sh, em, c2); assert(/^[a-z_]{2,20}$/.test(code), "accepté par guild_set : " + code);
  const c = E.crestOf(code); assert.deepStrictEqual([c.shape, c.emb, c.c2], [sh, em, c2]); }
assert.strictEqual(E.crestOf("dofus"), null); assert.strictEqual(E.CREST_EMB.length, 24); assert.strictEqual(E.CREST_SHAPES.length, 8);
for (let i = 1; i <= 8; i++) assert(fs.existsSync(path.join(__dirname, `../assets/s1/bl/s${i}.webp`)));
for (let i = 1; i <= 24; i++) assert(fs.existsSync(path.join(__dirname, `../assets/s1/bl/e${i}.webp`)));
console.log("ok - blason : forme, emblème et 2e couleur dans « ic », en lettres seulement");

const B = E.newState("Boss", "iop"); assert.strictEqual(E.rfMine(B).length, 0);
B.stasis = { cour_bouftou_royal: { max: 5 } }; assert.strictEqual(E.rfMine(B).length, 1);
E.RARE_FURN.forEach((f) => { const m = /stMax\(S, "([a-z_]+)"\)/.exec(f.ok.toString()); if (m) assert(D.DUNGEONS[m[1]], "donjon connu : " + m[1]); });
assert(E.VIT.some((v) => v.k === "mb") && E.VIT.some((v) => v.k === "st"), "meubles et autocollants dans la vitrine");
console.log("ok - meubles rares : boss en stasis 5 et vitrine, sans place ni bonus");
