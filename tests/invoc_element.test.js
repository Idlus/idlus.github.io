/* 2.2.9.4 : la sélection auto prend l'invocation de l'élément du profil (bombes du Roublard, créatures de l'Osamodas) ;
   une invocation frappe dans l'élément le plus fort du héros. Lancer : node tests/invoc_element.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/identite.js");
const name = (c) => c.spells.map((x) => E.spellDef(c.cls, x.id).name);
const WANT = { roub: { age: "Tornabombe", ine: "Explobombe", cha: "Bombe à Eau", fo: "Sismobombe" } };
for (const lvl of [20, 200]) for (const as in WANT.roub) {
  const S = E.newState("T", "iop"); S.chars.length = 0; const c = E.addChar(S, "roub", "R", lvl); c.autoStat = as; c.spellsManual = false;
  E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
  const bombs = name(c).filter((n) => /bombe|Bombe à Eau/.test(n) && !/Collante|Ambulante|Méga/.test(n));
  assert.deepStrictEqual(bombs, [WANT.roub[as]], `Roublard ${as} niv. ${lvl} : ${name(c).join(", ")}`);
}
assert.strictEqual(E.sumElE({ cls: "osa", st: { fo: 0, age: 800 } }), "a", "Osamodas Agilité : invocations en Air");
assert.strictEqual(E.sumElE({ cls: "osa", st: { fo: 300, age: 300 } }), "t", "égalité : élément de la classe");
assert.strictEqual(E.sumElE({ cls: "roub", st: {} }), "a", "sans caractéristique : élément de la classe");
console.log("invoc_element : ok");
