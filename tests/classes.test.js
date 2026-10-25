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
  assert.strictEqual(E.PSV.fecaProt, 0.15); assert.strictEqual(E.PSV0.fecaProt, 0.1); assert.strictEqual(E.PSV0.enuButin, 0);
  assert.ok(/Butin de guerre/.test(D.CLASSES.enu.passive.desc) && /sève/.test(D.CLASSES.sadi.passive.desc) && /Transposition/.test(D.CLASSES.sacri.passive.desc));
  assert.ok(/−15 %/.test(D.CLASSES.feca.passive.desc) && /bouclier/.test(D.CLASSES.eni.passive.desc));
  console.log("ok - valeurs et textes");
}
// 4. Eniripsa : le soin en trop (soins et vol de vie) devient un bouclier visible, sans baisser un bouclier plus grand ; rien au Kolizéum ni sous l'idole Ougah.
{
  const en = ent({ cls: "eni", name: "E" }), al = ent({ cls: "iop", name: "A", hp: 900 });
  const F = fight([en, al]);
  E.doHeal(al, 300, F); const g = E.eniSurplus(F, en, al);
  assert.strictEqual(al.hp, 1000); assert.strictEqual(g, 80, `bouclier de 40 % des 200 PV en trop : ${g}`); assert.strictEqual(al.shield, 80);
  assert.ok(F.fx.some((x) => x.k === "buff" && x.txt === "Bouclier +80"), "le bouclier s'affiche");
  E.doHeal(en, 2000, F); E.eniSurplus(F, en, en); assert.strictEqual(en.shield, 250, "plafond à 25 % des PV (vol de vie sur soi)");
  al.shield = 400; E.doHeal(al, 500, F); E.eniSurplus(F, en, al); assert.strictEqual(al.shield, 400, "ne réduit jamais un bouclier plus grand");
  const io = ent({ cls: "iop", name: "B" }); E.doHeal(io, 500, F); assert.strictEqual(E.eniSurplus(F, io, en), 0, "seulement les soins de l'Eniripsa");
  const G = fight([en, al]); G.idol = { heals: "none" }; al.shield = 0; E.doHeal(al, 500, G); assert.strictEqual(E.eniSurplus(G, en, al), 0, "pas de bouclier quand l'idole interdit les soins");
  const K = fight([en, al]); K.pvp = true; E.doHeal(al, 500, K); assert.strictEqual(E.eniSurplus(K, en, al), 0, "pas au Kolizéum");
  console.log("ok - surplus de soin de l'Eniripsa");
}
// 5. 2.1.40.12 (retours de Jérémygnon, Monocompte) : seule, l'Eniripsa profite de Mots liés grâce au vol de vie,
//    et ses soins à une cible vont au héros blessé avant son Lapino.
{
  const st = { ine: 100, cha: 100, fo: 0, age: 0, pui: 0, so: 0, do: 0, pa: 6 };
  const S = { chars: [], settings: {} };
  const mk = (o) => ent(Object.assign({ st, cd: {}, els: [], lvl: 100, cid: 1 }, o));
  const en = mk({ cls: "eni", name: "E", hp: 600 }), lap = mk({ cls: "eni", name: "Lapino", summon: true, owner: 0, hp: 100, cid: undefined }), mon = mk({ side: "m", name: "M", hp: 99999, hpMax: 99999 });
  const F = fight([en, lap, mon]);
  assert.strictEqual(API.healPick(F), en, "le soin va à l'Eniripsa blessée, pas au Lapino");
  en.hp = en.hpMax; assert.strictEqual(API.healPick(F), lap, "le Lapino est soigné quand aucun héros n'est blessé");
  const vamp = E.spellDef("eni", "s25870"); en.eniDmg = false;
  const r = API.castSpell(S, F, en, vamp, null, { id: vamp.id, cond: "", tgt: "low" });
  assert.ok(r.ok && en.eniDmg === true, "Mot Vampirique renforce la prochaine attaque (Mots liés)");
  const K = fight([mk({ cls: "eni", name: "K", tm: 0 }), mk({ side: "m", name: "N", hp: 99999, hpMax: 99999, tm: 1 })]); K.pvp = true;
  API.castSpell(S, K, K.ents[0], vamp, null, { id: vamp.id, cond: "", tgt: "low" }); assert.ok(!K.ents[0].eniDmg, "pas au Kolizéum (anciens passifs)");
  console.log("ok - Mots liés en solo et soins de l'Eniripsa");
}
console.log("classes.test.js : tout est bon");
