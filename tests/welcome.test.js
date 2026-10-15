/* Lot Bienvenue (0.1.17) : bulles de découverte et recherche rapide, sans navigateur.
   Lancer : node tests/welcome.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js");

// 1. Une partie neuve : la première bulle (le combat) attend le premier combat, puis vient tout de suite.
let t = Date.UTC(2030, 0, 7, 12, 0, 0); E.setClock(() => t);
const S = E.newState("Bulles", "iop"); E.tipsStart(S, false);
assert.strictEqual(E.tipDue(S), null, "rien à montrer avant le premier combat");
S.stats.fights = 1;
assert.strictEqual(E.tipDue(S).id, "combat");
E.tipSeen(S, "combat");
S.items.u1 = { uid: "u1", tpl: "i44" };
assert.strictEqual(E.tipDue(S), null, "au plus une bulle toutes les 2 minutes");
t += E.TIP_GAP_MS + 1;
assert.strictEqual(E.tipDue(S).id, "equip");
E.tipLater(S, "equip"); t += E.TIP_GAP_MS + 1;
assert.strictEqual(E.tipDue(S), null, "« Plus tard » : elle attend 10 minutes");
t += E.TIP_LATER_MS;
assert.strictEqual(E.tipDue(S).id, "equip", "puis elle revient");
console.log("ok - bulles : ordre, délai, plus tard");

// 2. Un joueur qui connaît DOFUS saute les bulles communes (caractéristiques), pas celles propres à Idlus.
const K = E.newState("Connaisseur", "cra"); E.tipsStart(K, true); K.stats.fights = 1; K.chars[0].lvl = 2;
assert.ok(E.tipList(K).every((x) => !x.dofus));
assert.strictEqual(E.tipCount(K)[1], E.TIPS.filter((x) => !x.dofus).length);
assert.strictEqual(E.tipCount(S)[1], E.TIPS.length);
console.log("ok - bulles : « je connais DOFUS » en saute", E.TIPS.filter((x) => x.dofus).length);

// 3. Une partie déjà avancée (mise à jour) : les découvertes déjà faites sont marquées vues, pas de pluie de bulles.
const O = E.newState("Ancien", "eni"); O.stats.fights = 500; O.chars[0].lvl = 40; O.quest = { step: 12, prog: 0 }; delete O.tips;
E.tipState(O);
assert.ok(O.tips.seen.combat && O.tips.seen.stats && O.tips.seen.havre && O.tips.seen.align, "déjà vues");
assert.ok(!O.tips.seen.ren, "la Renaissance reste à découvrir");
assert.strictEqual(E.tipDue(O), null);
console.log("ok - bulles : partie existante sans pluie de bulles");

// 4. Recherche : sans accents ni majuscules, une faute tolérée, groupée par type, monstres inconnus en « ??? ».
const norm = E.searchNorm;
assert.strictEqual(norm("Épée de Boisaille"), "epee de boisaille");
const r1 = E.search("epee boisaille", { S });
assert.ok(r1.some((r) => r.k === "item" && r.id === "i44"), "objet trouvé sans accent");
const r2 = E.search("bouftou", { S });
assert.ok(r2.some((r) => r.k === "dg"), "donjon du Bouftou");
assert.ok(r2.some((r) => r.k === "mon" && r.unknown && r.name === "???"), "monstre jamais rencontré caché");
const bouf = r2.find((r) => r.k === "mon");
S.bestiary[bouf.id] = 3;
assert.ok(E.search("bouftou", { S }).some((r) => r.k === "mon" && !r.unknown && r.name !== "???"), "monstre rencontré nommé");
assert.ok(E.search("boufotu", { S }).some((r) => r.k === "dg"), "une faute de frappe passe");
assert.ok(E.search("almanax", { S }).some((r) => r.k === "page" && r.id === "almanax"), "les pages aussi");
assert.ok(!E.search("classements", { S, online: false }).some((r) => r.id === "ladder"), "pas de Classements sans compte en ligne");
assert.ok(E.search("classements", { S, online: true }).some((r) => r.id === "ladder"));
const kinds = E.search("ble", { S }).map((r) => r.k); const order = Object.keys(E.SEARCH_KINDS);
assert.deepStrictEqual(kinds, kinds.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b)), "groupés par type");
assert.strictEqual(E.search("", { S }).length, 0);
console.log("ok - recherche :", E.searchIndex().length, "entrées");
console.log("ok - lot Bienvenue");
