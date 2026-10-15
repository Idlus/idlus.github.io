/* 1.0.35 « Vies plus longues » et « Mémoire des vies » (choix de Mathis 1A 2A 3A, +50 %) :
   plus de bonus d'XP de renaissance, chaque renaissance demande +50 % d'XP par niveau (×6 à la X) ;
   à chaque renaissance, le héros apprend pour toujours un sort d'une autre classe, au choix parmi 3,
   et en équipe 1 (Ren I à IV), 2 (dès la V) ou 3 (à la X) ; les héros déjà renés rattrapent leurs choix.
   Lancer : node tests/memoire.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
require("../js/renaissance.js");
const { CLASSES } = require("../js/data.js");
let seed = 5; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });

// 1. XP : plus de bonus, +50 % demandé par renaissance
const S = E.newState("Mem", "iop"); const c = S.chars[0];
assert.strictEqual(E.renXpMult(c), 1);
assert.strictEqual(E.heroXpNeed(c), E.xpNeed(c.lvl));
c.ren = 4; assert.strictEqual(E.renXpMult(c), 1, "aucun bonus d'XP de renaissance");
assert.strictEqual(E.heroXpNeed(c, 150), Math.floor(E.xpNeed(150) * 3), "Ren IV : ×3");
c.ren = 10; assert.strictEqual(E.heroXpNeed(c, 150), Math.floor(E.xpNeed(150) * 6), "Ren X : ×6");
c.ren = 0; c.lvl = 10; c.xp = 0; E.giveXp(S, c, E.xpNeed(10)); assert.strictEqual(c.lvl, 11, "sans renaissance, rien ne change");
c.ren = 2; c.lvl = 10; c.xp = 0; E.giveXp(S, c, E.xpNeed(10)); assert.strictEqual(c.lvl, 10, "Ren II : il faut deux fois plus d'XP");
E.giveXp(S, c, E.xpNeed(10)); assert.strictEqual(c.lvl, 11);

// 2. Renaissance : un sort à apprendre, 3 propositions de 3 autres classes, sans invocation
const S2 = E.newState("Mem2", "cra"); const h = S2.chars[0]; h.lvl = 200;
assert.strictEqual(E.renaissance(S2, h.id, E.renChoices(h)[0][0]), null);
assert.strictEqual(h.memPend, 1); assert.strictEqual(E.MEM_SLOTS(h), 1);
const off = E.memOffer(S2, h); assert.strictEqual(off.length, 3);
assert.deepStrictEqual(E.memOffer(S2, h), off, "les propositions ne changent pas tant que le joueur n'a pas choisi");
const cls = off.map(E.spellCls); assert.strictEqual(new Set(cls).size, 3, "3 classes différentes"); assert.ok(!cls.includes("cra"), "aucune de sa classe");
off.forEach((id) => assert.ok(!E.memDef(id).grades.some((g) => g.fx.some((f) => f.k === "summon")), "pas d'invocation"));
assert.ok(/proposés/.test(E.act(S2, "memPick", h.id, "pas_un_sort")));
const low = off.slice().sort((a, b) => E.memDef(a).lvl - E.memDef(b).lvl)[0];
assert.strictEqual(E.act(S2, "memPick", h.id, low), null, "action du joueur");
assert.deepStrictEqual(h.mem, [low]); assert.strictEqual(h.memPend, 0); assert.ok(/Aucun/.test(E.memPick(S2, h.id, low)));
h.lvl = Math.max(h.lvl, E.memDef(low).lvl); E.refreshSpells(h, E.charStats(S2, h));
assert.ok(E.knownSpells(h).some((s) => s.id === low), "le sort appris fait partie des sorts connus");
const d = E.spellDef("cra", low); assert.ok(d && d.mem === E.spellCls(low) && d.pair === "m:" + low, "définition du sort d'une autre classe");
assert.strictEqual(E.spellDef("iop", "pas_un_sort"), undefined);

// 3. Limite : 1 sort d'une autre classe à la Ren I, 2 dès la V, 3 à la X
h.lvl = 200; h.ren = 1; h.spellsManual = true;
const others = []; for (const k in CLASSES) if (k !== "cra" && others.length < 4) { const sp = CLASSES[k].spells.find((s) => s.lvl <= 50 && !s.grades.some((g) => g.fx.some((f) => f.k === "summon"))); if (sp && !h.mem.includes(sp.id)) others.push(sp.id); }
h.mem = h.mem.concat(others); h.spells = h.spells.slice(0, 4);
let nIn = E.memCount(h);
for (const id of h.mem) E.equipSpell(S2, h, id);
assert.strictEqual(E.memCount(h), 1, "Ren I : un seul sort d'une autre classe dans la barre (avant : " + nIn + ")");
assert.ok(/Un seul sort/.test(E.equipSpell(S2, h, h.mem.find((id) => !h.spells.some((x) => x.id === id)))));
h.ren = 5; for (const id of h.mem) E.equipSpell(S2, h, id); assert.strictEqual(E.memCount(h), 2, "Ren V : 2");
h.ren = 10; for (const id of h.mem) E.equipSpell(S2, h, id); assert.strictEqual(E.memCount(h), 3, "Ren X : 3");
h.ren = 1; E.refreshSpells(h, E.charStats(S2, h)); assert.strictEqual(E.memCount(h), 1, "la limite est remise si elle baisse");
h.spellsManual = false; h.ren = 5; E.refreshSpells(h, E.charStats(S2, h)); assert.ok(E.memCount(h) <= 2, "la sélection automatique respecte la limite");
const forgot = h.mem.pop(); h.spells.push({ id: forgot, cond: "always", tgt: "low" }); h.spellsManual = true; E.refreshSpells(h, E.charStats(S2, h));
assert.ok(!h.spells.some((x) => x.id === forgot), "un sort non appris ne reste pas dans la barre");
assert.ok(E.memFit(h, [{ id: forgot }]).length === 0, "ni dans une stratégie enregistrée");

// 4. Rattrapage : un héros déjà rené reçoit un choix par renaissance faite, la sauvegarde garde tout
const S3 = E.newState("Mem3", "iop"); S3.chars[0].ren = 3; S3.chars[0].lvl = 120; delete S3.chars[0].mem; S3.v = 9;
const T = E.deserialize(E.serialize(S3)); const t = T.chars[0];
assert.strictEqual(t.memPend, 3, "Ren III : 3 sorts à choisir"); assert.deepStrictEqual(t.mem, []);
assert.ok((T.migration || []).some((x) => /1\.0\.35/.test(x)), "le joueur est prévenu");
E.memPick(T, t.id, E.memOffer(T, t)[0]); const U = E.deserialize(E.serialize(T)); assert.strictEqual(U.chars[0].memPend, 2); assert.strictEqual(U.chars[0].mem.length, 1, "le rattrapage n'est pas redonné");
const S4 = E.newState("Mem4", "iop"); S4.v = 9; const V4 = E.deserialize(E.serialize(S4)); assert.ok(!V4.chars[0].memPend, "rien pour un héros sans renaissance");
console.log("memoire.test.js : OK");
