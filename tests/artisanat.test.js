/* 1.0.4.3 « Fabriquer sac plein » : quand le sac est plein, l'objet fabriqué part dans le trop-plein.
   Lancer : node tests/artisanat.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const { ITEMS } = require("../js/data.js");
const S = E.newState("Art", "iop");
const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].craft && ITEMS[k].lvl < 3);
const give = (n) => ITEMS[tpl].craft.ing.forEach(([r, q]) => (S.res[r] = q * n));
give(5); assert.strictEqual(E.craftCount(S, "tpl", tpl), 5, "sac vide : 5 fabrications");
while (E.itemCount(S) < E.itemCap(S)) E.rollItem(S, tpl, { radiant: false });
assert.ok(E.craftCount(S, "tpl", tpl) > 0, "sac plein : la fabrication reste possible");
const r = E.craftMany(S, "tpl", tpl, 3);
assert.strictEqual(r.n, 3, "3 objets fabriqués"); assert.strictEqual(r.over, 3, "rangés dans le trop-plein");
assert.strictEqual(E.itemCount(S), E.itemCap(S), "le sac ne déborde pas");
S.over = Array.from({ length: E.overCap(S) }, (_, i) => ({ uid: 900000 + i, tpl, stats: {} })); give(5);
assert.strictEqual(E.craftCount(S, "tpl", tpl), 0, "sac et trop-plein pleins : rien");
assert.ok(typeof E.craftItem(S, tpl) === "string", "message d'erreur clair");
/* 1.0.9.2 « Recettes trop faciles » : XP pleine jusqu'à 10 niveaux de métier d'écart, puis baisse jusqu'à 1 XP à 30 niveaux */
{ const { SPECIAL_CRAFTS } = require("../js/data.js");
  const casque = Object.keys(ITEMS).find((k) => ITEMS[k].name === "Casque" && ITEMS[k].craft); const C = ITEMS[casque]; const base = 12 + C.lvl * 3;
  const xpAt = (lvl, id = casque) => { const S2 = E.newState("Xp", "iop"); S2.crafts.tailleur.lvl = lvl; S2.crafts.tailleur.xp = 0; ITEMS[id].craft.ing.forEach(([r, q]) => (S2.res[r] = q)); E.craftItem(S2, id); return S2.crafts.tailleur.lvl === lvl ? S2.crafts.tailleur.xp : -1; };
  assert.strictEqual(E.craftTop("tailleur"), 66, "Tailleur : recette la plus haute au métier 66");
  const bo = (lvl, job = "tailleur") => E.craftBoost({ crafts: { [job]: { lvl } } }, job);
  assert.strictEqual(xpAt(E.craftReq(casque) + 10), Math.round(base * bo(E.craftReq(casque) + 10)), "10 niveaux d'écart : XP pleine");
  assert.strictEqual(xpAt(E.craftReq(casque) + 20), Math.round(base / 2 * bo(E.craftReq(casque) + 20)), "20 niveaux d'écart : moitié");
  assert.strictEqual(xpAt(60), 1, "30 niveaux d'écart ou plus : 1 XP");
  assert.strictEqual(E.craftXpOf({ crafts: { tailleur: { lvl: 200 } } }, "tailleur", 66, 612), 612, "niveau 200 : la recette la plus haute garde l'XP pleine");
  const S3 = E.newState("Clé", "iop"); S3.crafts.bricoleur.lvl = 70; S3.crafts.bricoleur.xp = 0; const key = Object.keys(SPECIAL_CRAFTS).find((n) => E.isKey(n) && SPECIAL_CRAFTS[n].lvl === 10);
  SPECIAL_CRAFTS[key].ing.forEach(([r, q]) => (S3.res[r] = q)); E.craftSpecial(S3, key); assert.strictEqual(S3.crafts.bricoleur.xp, 1, "clé niveau 10 au Bricoleur 70 : 1 XP");
}
/* « Artisanat haut niveau » : la recette la plus haute vaut au moins 1/10 de niveau (environ 10 fabrications par niveau), jamais moins d'XP qu'avant */
{ assert.strictEqual(E.craftBoost({ crafts: { tailleur: { lvl: 5 } } }, "tailleur"), 1, "petit niveau : XP inchangée");
  for (const job of ["tailleur", "bijoutier", "bricoleur"]) for (const lvl of [20, 40, 66, 100, 150, 199]) {
    const S4 = { crafts: { [job]: { lvl } } }; const x = E.craftXpOf(S4, job, lvl + 99, E.craftTopXp(job, lvl)); const n = Math.ceil(E.jobXpNeed(lvl) / x);
    assert.ok(n >= 9 && n <= 11, `${job} ${lvl} : ${n} fabrications de la recette la plus haute pour un niveau`);
    assert.ok(E.craftBoost(S4, job) >= 1, `${job} ${lvl} : jamais moins d'XP qu'avant`); }
  assert.strictEqual(E.craftTopXp("tailleur", 66), 612, "Tailleur 66 : objet niveau 200");
  assert.strictEqual(E.craftTopXp("bricoleur", 100), 320, "Bricoleur 100 : clés et alliages niveau 100");
}
/* 1.0.12.4 : le Coffre en merisier (meuble unique niveau 120) ne compte plus comme recette la plus haute du Bricoleur.
   Avec la vraie recette (sa vraie baisse « trop facile »), la meilleure recette refaisable vaut toujours ~1/10 de niveau, même au-delà de 120 */
{ const { SPECIAL_CRAFTS } = require("../js/data.js");
  assert.strictEqual(E.craftTop("bricoleur"), 100, "Bricoleur : recette refaisable la plus haute au niveau 100");
  for (const job of ["tailleur", "bijoutier", "bricoleur"]) for (const lvl of [100, 121, 130, 150, 199]) {
    const S5 = { crafts: { [job]: { lvl } } }; let best = 0;
    for (const id in ITEMS) { const T = ITEMS[id]; if (T.craft && T.craft.job === job && E.craftReq(id) <= lvl) best = Math.max(best, E.craftXpOf(S5, job, E.craftReq(id), 12 + T.lvl * 3)); }
    for (const n in SPECIAL_CRAFTS) { const R = SPECIAL_CRAFTS[n]; if (R.job === job && R.lvl <= lvl && !R.unique) best = Math.max(best, E.craftXpOf(S5, job, R.lvl, 20 + R.lvl * 3)); }
    const n = Math.ceil(E.jobXpNeed(lvl) / best); assert.ok(n >= 9 && n <= 11, `${job} ${lvl} : ${n} fabrications de la meilleure recette refaisable pour un niveau`); }
  const S6 = E.newState("Brico", "iop"); S6.crafts.bricoleur.lvl = 130; S6.crafts.bricoleur.xp = 0;
  SPECIAL_CRAFTS["Ardonite"].ing.forEach(([r, q]) => (S6.res[r] = q)); E.craftSpecial(S6, "Ardonite");
  assert.ok(S6.crafts.bricoleur.xp >= E.jobXpNeed(130) / 11, `Bricoleur 130 : une Ardonite vaut ~1/10 de niveau (${S6.crafts.bricoleur.xp} XP)`);
}
console.log("artisanat : OK");
