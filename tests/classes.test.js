/* Retouches des classes faibles (E.PSV) : Transposition du Sacrieur, Souffrance, Glyphe de Protection,
   anciennes valeurs (E.PSV0) au Kolizéum. Sans navigateur. Lancer : node tests/classes.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
const D = require("../js/data.js");
const API = E.fightApi;
const ent = (o) => Object.assign({ side: "c", hp: 1000, hpMax: 1000, alive: true, buffs: [], debuffs: [], dots: [], shield: 0, name: "X" }, o);
const fight = (ents) => ({ ents, fx: [], seq: 0, log: [], deaths: [], round: 1, cs: { focus: {}, first: {}, last: {}, turnCasts: {}, el: {}, hitTurn: {} } });

// 1. Transposition : le Sacrieur encaisse 30 % des dégâts d'un allié, sans descendre sous 1 PV ; rien au Kolizéum.
{
  const mon = ent({ side: "m", name: "M" }), al = ent({ cls: "iop", name: "A" }), sc = ent({ cls: "sacri", name: "S" });
  const F = fight([mon, al, sc]);
  const d = API.dealDamage(F, mon, al, 100, null);
  assert.ok(d <= 71 && sc.hp <= 971 && sc.hp >= 969, `Transposition : ${d} pour l'allié, Sacrieur à ${sc.hp}`);
  sc.hp = 5; API.dealDamage(F, mon, al, 1000, null); assert.strictEqual(sc.hp, 1, "jamais sous 1 PV par Transposition");
  const a2 = ent({ cls: "iop", tm: 0 }), s2 = ent({ cls: "sacri", tm: 0 }), m2 = ent({ side: "m", tm: 1 });
  const G = fight([m2, a2, s2]); G.pvp = true; API.dealDamage(G, m2, a2, 100, null); assert.strictEqual(s2.hp, 1000, "pas de Transposition au Kolizéum");
  console.log("ok - Transposition du Sacrieur");
}

// 2. Souffrance : −1,5 % de dégâts subis par coup reçu (jusqu'à −22 %).
{
  const mon = ent({ side: "m" }), sc = ent({ cls: "sacri", suffer: 15 }), sc0 = ent({ cls: "sacri", suffer: 0 });
  const F = fight([mon, sc, sc0]);
  const a = API.dealDamage(F, mon, sc0, 1000, null), b = API.dealDamage(F, mon, sc, 1000, null);
  assert.ok(b < a * 0.8, `Souffrance : ${b} contre ${a}`);
  console.log("ok - Souffrance du Sacrieur");
}

// 3. Valeurs : nouvelles en donjon, anciennes au Kolizéum ; les textes des passifs suivent.
{
  assert.strictEqual(E.PSV.fecaProt, 0.2); assert.strictEqual(E.PSV0.fecaProt, 0.1); assert.strictEqual(E.PSV0.enuButin, 0);
  assert.ok(/Butin de guerre/.test(D.CLASSES.enu.passive.desc) && /sève/.test(D.CLASSES.sadi.passive.desc) && /Transposition/.test(D.CLASSES.sacri.passive.desc));
  assert.ok(/−20 %/.test(D.CLASSES.feca.passive.desc) && /bouclier/.test(D.CLASSES.eni.passive.desc));
  console.log("ok - valeurs et textes");
}
console.log("classes.test.js : tout est bon");
