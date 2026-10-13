/* 0.1.53 « Armes » : coup d'arme, maîtrise, effets par type, potions de forgemagie élémentaire, Kolizéum.
   Lancer : node tests/armes.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "armes", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "verify", "koli"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA;

// 1. Données : les armes du jeu ont leurs dégâts DOFUS.
const armes = Object.keys(D.ITEMS).filter((t) => D.ITEMS[t].slot === "arme" && !D.ITEMS[t].leg);
const known = armes.filter((t) => window.ARMES[t]);
assert.ok(known.length / armes.length > 0.98, "presque toutes les armes ont leurs dégâts");
armes.forEach((t) => { const W = E.weaponData(t); assert.ok(W && W.pa > 0 && W.lines.length, t); });
console.log("ok - données des armes");

// 2. Sabre Heutelle (Épée, 2 × 16-20 Neutre, −1 PA) : ×1,5, maîtrise Iop +20 %, pas de maîtrise pour un Crâ.
const sIop = E.weaponSpellOf("iop", "i11624"), sCra = E.weaponSpellOf("cra", "i11624");
assert.strictEqual(sIop.wtype, 6); assert.ok(sIop.fav && !sCra.fav);
const d0 = sCra.grades[0].fx.find((f) => f.k === "dmg"), d1 = sIop.grades[0].fx.find((f) => f.k === "dmg");
assert.deepStrictEqual([d0.min, d0.max], [24, 30]); assert.deepStrictEqual([d1.min, d1.max], [29, 36]);
assert.ok(sIop.grades[0].fx.some((f) => f.k === "apdrain" && f.v === 1), "−1 PA à la cible");
const dag = armes.find((t) => window.ARMES[t] && window.ARMES[t][0] === 5);
assert.ok(E.weaponSpellOf("sram", dag).grades[0].casts >= 2, "Dague : double frappe");
console.log("ok - coup d'arme et maîtrise");

// 3. Potions : le Neutre passe en Terre (grande) ou pour moitié (petite) ; il faut la potion.
const G = E.newState("Test", "iop"); const c = G.chars[0]; c.lvl = 150;
const it = E.rollItem(G, "i11624", { radiant: false }); E.equip(G, c.id, it.uid, "arme");
assert.ok(E.weaponPotion(G, it.uid, "potion_seisme").err, "sans potion, rien");
E.addCons(G, "potion_seisme"); E.addCons(G, "potion_etincelle");
assert.ok(E.weaponPotion(G, it.uid, "potion_seisme").ok); assert.strictEqual(it.wel, "t"); assert.ok(!G.cons.potion_seisme);
assert.ok(E.weaponSpell(G, c).grades[0].fx.filter((f) => f.k === "dmg").every((f) => f.el === "t"), "tout en Terre");
assert.ok(E.weaponPotion(G, it.uid, "potion_etincelle").ok); assert.ok(it.welh);
const els = E.weaponSpell(G, c).grades[0].fx.filter((f) => f.k === "dmg").map((f) => f.el).sort();
assert.deepStrictEqual(els, ["f", "f", "n", "n"], "petite potion : la moitié");
const dofusPot = E.weaponPotion(G, it.uid, "potion_seisme"); assert.ok(dofusPot.err, "plus de potion");
console.log("ok - potions de forgemagie élémentaire");

// 4. Préparer une potion : Alchimiste et herbes.
G.jobs.alchimiste.lvl = 10; assert.ok(E.brewPotion(G, "potion_secousse"));
G.jobs.alchimiste.lvl = 25; G.res["Sauge"] = 10; G.kamas = 5000; assert.strictEqual(E.brewPotion(G, "potion_secousse"), null);
assert.strictEqual(G.cons.potion_secousse, 1); assert.ok(!G.res["Sauge"]); assert.strictEqual(G.kamas, 3000);
console.log("ok - préparer une potion");

// 5. En combat : le héros frappe avec son arme ; le Kolizéum emporte l'arme avec l'équipe.
const snap = E.koliSnap(G, [c.id]); assert.deepStrictEqual(snap[0].wp, { t: "i11624", e: "f", h: 1 });
const W = E.koliWatch(snap, snap, 7); assert.ok(W.S2.fight.ents.every((e) => e.wsp && e.wsp.wp), "coup d'arme au Kolizéum");
let used = 0; for (let g = 0; g < 20000 && !W.done; g++) { E.koliWatchStep(W); used += W.S2.fight.fx.filter((f) => f.k === "cast" && f.sp === "arme" && !f.seen && (f.seen = 1)).length; }
assert.ok(used > 0, "l'arme sert en combat");
console.log("ok - combat et Kolizéum");
console.log("armes.test.js : tout est bon");
