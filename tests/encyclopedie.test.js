/* 1.0.8.3 : Encyclopédie › Équipements : le jeu retient chaque équipement obtenu au moins une fois.
   Lancer : node tests/encyclopedie.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");

const S = E.newState("Collection", "iop");
const bag = Object.values(S.items).map((it) => it.tpl).filter((t) => D.ITEMS[t].slot !== "dofus");
const dex = E.itemDex(S);
bag.forEach((t) => assert.ok(dex[t], "un objet du sac de départ compte comme obtenu : " + t));

const tpl = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].slot === "cape" && !dex[t]);
const it = E.rollItem(S, tpl);
assert.ok(E.itemDex(S)[tpl], "un objet obtenu est retenu");
delete S.items[it.uid];
assert.ok(E.itemDex(S)[tpl], "il reste retenu après avoir été vendu ou brisé");

const dof = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].slot === "dofus");
E.itemDexAdd(S, dof);
assert.ok(!E.itemDex(S)[dof], "les Dofus et trophées n'entrent pas dans la collection d'équipements");

const S2 = E.deserialize(E.serialize(S));
assert.ok(E.itemDex(S2)[tpl], "la collection est gardée dans la sauvegarde");

/* ancienne sauvegarde sans collection : le sac, le surplus et la garde-robe sont comptés au premier passage */
const S3 = E.newState("Ancienne", "cra"); delete S3.itemDex; delete S3.itemDexInit;
const t2 = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].slot === "bottes"); const t3 = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].slot === "coiffe");
S3.over = [{ uid: 9999, tpl: t2, stats: {} }]; S3.wardrobe = { [t3]: 1 };
const dex3 = E.itemDex(S3);
assert.ok(dex3[t2] && dex3[t3], "le surplus et la garde-robe comptent pour une ancienne sauvegarde");
console.log("Encyclopédie › Équipements : OK");
