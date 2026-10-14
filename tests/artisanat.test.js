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
/* 1.0.9.2 « Recettes trop faciles » : XP pleine jusqu'à 30 niveaux d'objet d'écart, puis baisse jusqu'à 1 XP à 90 niveaux (1.0.19 : comptés en niveaux de métier = niveaux d'objet) */
{ const { SPECIAL_CRAFTS } = require("../js/data.js");
  const casque = Object.keys(ITEMS).find((k) => ITEMS[k].name === "Casque" && ITEMS[k].craft); const C = ITEMS[casque]; const base = 12 + C.lvl * 3;
  const xpAt = (lvl, id = casque) => { const S2 = E.newState("Xp", "iop"); S2.crafts.tailleur.lvl = lvl; S2.crafts.tailleur.xp = 0; ITEMS[id].craft.ing.forEach(([r, q]) => (S2.res[r] = q)); E.craftItem(S2, id); return S2.crafts.tailleur.lvl === lvl ? S2.crafts.tailleur.xp : -1; };
  assert.strictEqual(E.craftTop("tailleur"), 200, "Tailleur : recette la plus haute au métier 200");
  const bo = (lvl, job = "tailleur") => E.craftBoost({ crafts: { [job]: { lvl } } }, job);
  assert.strictEqual(xpAt(E.craftReq(casque) + 30), Math.round(base * bo(E.craftReq(casque) + 30)), "30 niveaux d'écart : XP pleine");
  assert.strictEqual(xpAt(E.craftReq(casque) + 60), Math.round(base / 2 * bo(E.craftReq(casque) + 60)), "60 niveaux d'écart : moitié");
  assert.strictEqual(xpAt(E.craftReq(casque) + 90), 1, "90 niveaux d'écart ou plus : 1 XP");
  assert.strictEqual(E.craftXpOf({ crafts: { tailleur: { lvl: 200 } } }, "tailleur", 200, 612), 612, "niveau 200 : la recette la plus haute garde l'XP pleine");
  const S3 = E.newState("Clé", "iop"); S3.crafts.bricoleur.lvl = 70; S3.crafts.bricoleur.xp = 0; const key = Object.keys(SPECIAL_CRAFTS).find((n) => E.isKey(n) && SPECIAL_CRAFTS[n].lvl === 10);
  SPECIAL_CRAFTS[key].ing.forEach(([r, q]) => (S3.res[r] = q)); E.craftSpecial(S3, key); assert.strictEqual(S3.crafts.bricoleur.xp, 1, "clé niveau 10 au Bricoleur 70 : 1 XP");
}
/* « Artisanat haut niveau » : la recette la plus haute vaut au moins 1/E.craftStep de niveau (1.0.19 : environ 3 fabrications par niveau
   pour les métiers d'objets, 10 pour le Bricoleur), jamais moins d'XP qu'avant */
const span = (job) => (job === "bricoleur" ? [9, 11] : [2, 4]);
{ assert.strictEqual(E.craftBoost({ crafts: { tailleur: { lvl: 1 } } }, "tailleur"), 1, "niveau 1 : XP inchangée");
  for (const job of ["tailleur", "bijoutier", "bricoleur"]) for (const lvl of [20, 40, 66, 100, 150, 199]) {
    const S4 = { crafts: { [job]: { lvl } } }; const x = E.craftXpOf(S4, job, lvl + 99, E.craftTopXp(job, lvl)); const n = Math.ceil(E.jobXpNeed(lvl) / x);
    assert.ok(n >= span(job)[0] && n <= span(job)[1], `${job} ${lvl} : ${n} fabrications de la recette la plus haute pour un niveau`);
    assert.ok(E.craftBoost(S4, job) >= 1, `${job} ${lvl} : jamais moins d'XP qu'avant`); }
  assert.strictEqual(E.craftTopXp("tailleur", 200), 612, "Tailleur 200 : objet niveau 200");
  assert.ok(E.craftTopXp("tailleur", 66) <= 12 + 66 * 3, "Tailleur 66 : objets jusqu'au niveau 66");
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
    const n = Math.ceil(E.jobXpNeed(lvl) / best); assert.ok(n >= span(job)[0] && n <= span(job)[1], `${job} ${lvl} : ${n} fabrications de la meilleure recette refaisable pour un niveau`); }
  const S6 = E.newState("Brico", "iop"); S6.crafts.bricoleur.lvl = 130; S6.crafts.bricoleur.xp = 0;
  SPECIAL_CRAFTS["Ardonite"].ing.forEach(([r, q]) => (S6.res[r] = q)); E.craftSpecial(S6, "Ardonite");
  assert.ok(S6.crafts.bricoleur.xp >= E.jobXpNeed(130) / 11, `Bricoleur 130 : une Ardonite vaut ~1/10 de niveau (${S6.crafts.bricoleur.xp} XP)`);
}
/* 1.0.19 « Métiers comme dans DOFUS » : un objet se fabrique avec le métier à son niveau ; les parties existantes sont converties
   au niveau qui donne exactement les mêmes recettes (3 × niveau + 2, au plus 200), le Bricoleur ne change pas */
{ const it80 = Object.keys(ITEMS).find((k) => ITEMS[k].craft && ITEMS[k].lvl === 80); assert.strictEqual(E.craftReq(it80), 80, "objet niveau 80 : métier 80");
  const old = E.newState("Ancien", "iop"); delete old.craftObj;
  old.crafts.tailleur = { lvl: 30, xp: Math.floor(E.jobXpNeed(30) / 2) }; old.crafts.bijoutier = { lvl: 69, xp: 5 }; old.crafts.bricoleur = { lvl: 80, xp: 7 };
  const canOld = (job, L) => Object.keys(ITEMS).filter((k) => ITEMS[k].craft && ITEMS[k].craft.job === job && Math.max(1, Math.floor(ITEMS[k].lvl / 3)) <= L).sort().join();
  const before = canOld("tailleur", 30);
  const N = E.deserialize(E.serialize(old));
  assert.strictEqual(N.crafts.tailleur.lvl, 92, "Tailleur 30 → 92"); assert.strictEqual(N.crafts.bijoutier.lvl, 200, "Bijoutier 69 → 200");
  assert.deepStrictEqual(N.crafts.bricoleur, { lvl: 80, xp: 7 }, "Bricoleur inchangé"); assert.deepStrictEqual(N.crafts.forgeron, { lvl: 1, xp: 0 }, "métier jamais monté : niveau 1");
  assert.ok(Math.abs(N.crafts.tailleur.xp / E.jobXpNeed(92) - 0.5) < 0.01, "même part de la barre d'XP");
  const after = Object.keys(ITEMS).filter((k) => ITEMS[k].craft && ITEMS[k].craft.job === "tailleur" && E.craftReq(k) <= N.crafts.tailleur.lvl).sort().join();
  assert.strictEqual(after, before, "exactement les mêmes recettes qu'avant");
  assert.ok(N.migration && /Tailleur 30 → 92/.test(N.migration.join(" ")), "le joueur voit la conversion");
  const N2 = E.deserialize(E.serialize(N)); assert.strictEqual(N2.crafts.tailleur.lvl, 92, "convertie une seule fois"); assert.ok(!N2.migration, "pas de message au chargement suivant");
  const F = E.newState("Neuf", "iop"); F.crafts.tailleur = { lvl: 3, xp: 0 }; assert.strictEqual(E.deserialize(E.serialize(F)).crafts.tailleur.lvl, 3, "partie commencée après la mise à jour : pas de conversion");
  assert.strictEqual(require("../js/verify.js").summary(E, N).cobj, 1, "le résumé envoyé au serveur dit que la partie est convertie");
  // métier 1 → 200 avec la meilleure recette de chaque niveau : environ 3 fabrications par niveau (~660, autant qu'avant pour le métier 66)
  let crafts = 0; for (let L = 1; L < 200; L++) { const S7 = { crafts: { tailleur: { lvl: L } } }; let best = 0;
    for (const id in ITEMS) { const T = ITEMS[id]; if (T.craft && T.craft.job === "tailleur" && E.craftReq(id) <= L) best = Math.max(best, E.craftXpOf(S7, "tailleur", E.craftReq(id), 12 + T.lvl * 3)); }
    crafts += Math.ceil(E.jobXpNeed(L) / best); }
  assert.ok(crafts >= 550 && crafts <= 750, `Tailleur 1 → 200 : ${crafts} fabrications`);
}
console.log("artisanat : OK");
