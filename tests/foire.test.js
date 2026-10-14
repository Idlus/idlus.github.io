/* 1.0.30 « L'économie » : Caisses du Trool (js/foire.js) et Comptoirs (js/comptoirs.js), sans navigateur.
   Le Jackpot du serveur est vérifié dans tests/online.test.js (faux serveur) et supabase/foire.sql.
   Lancer : node tests/foire.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "gboss", "koli", "legendaires", "dofusp", "songe", "wboss", "suivi", "vie", "quetes", "vente", "foire", "comptoirs"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA; const F = E.FOIRE;
let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);

/* ======================= Caisses du Trool ======================= */
// 1. Chances affichées (100 %), la maison garde environ 10 % des mises.
assert.strictEqual(F.RAR.reduce((a, r) => a + r.p, 0), 100);
assert.ok(Math.abs(E.foireRtp() - 0.895) < 1e-9, "89,5 % de la mise revient en lots");
assert.deepStrictEqual(F.CAISSES.map((c) => c.cost), [50000, 250000, 1000000]);
console.log("ok - chances et part de la maison");

// 2. Beaucoup d'ouvertures : raretés aux chances affichées, valeur rendue ≈ 0,895, jamais de Dofus ni d'objet légendaire,
//    les ressources (comptées ×3, le plafond de la vente directe) ne dépassent pas la valeur du lot.
const kinds = new Set();
for (const lvl of [20, 100, 200]) for (const C of F.CAISSES) {
  const S = E.newState("Foire", "iop"); S.chars[0].lvl = lvl; S.quest.step = 10; E.sab(S);
  const N = 6000; const rar = [0, 0, 0, 0, 0]; let mise = 0, val = 0, k = 0;
  for (let i = 0; i < N; i++) {
    E.foireState(S).n = 0; S.kamas = C.cost; if (S.sablier) S.sablier.r = 0;
    const r = E.foireOpen(S, C.id); assert.ok(r.ok, r.err); const L = r.lot;
    assert.strictEqual(S.kamas, L.k, "la mise est retirée, les kamas du lot versés");
    mise += C.cost; val += L.v; k += L.k; rar[L.r]++;
    assert.strictEqual(L.v, Math.round(C.cost * F.RAR[L.r].mult));
    if (L.item) { const T = D.ITEMS[L.item]; assert.ok(T.slot !== "dofus" && !T.leg && !T.wboss && !T.hidden, "jamais de Dofus : " + L.item); kinds.add("item"); }
    if (L.res) { assert.ok(E.venteOk(L.res[0]), "ressource vendable"); assert.ok(L.res[1] === 1 || L.res[1] * 3 * E.resPrice(L.res[0]) <= L.v, "ressources ×3 ≤ valeur du lot"); kinds.add("res"); }
    if (L.cons) { assert.ok(!/dofus/i.test(L.cons[0])); kinds.add(L.cons[0].replace(/_.*/, "")); }
    if (L.sab) kinds.add("sab"); if (L.key) kinds.add("key"); if (L.title) kinds.add("title");
    assert.ok(L.k >= 0 && L.k <= L.v, "les kamas ne dépassent pas la valeur du lot");
    if (i % 500 === 0) { S.items = {}; S.res = {}; S.cons = {}; }
  }
  F.RAR.forEach((R, i) => assert.ok(Math.abs((rar[i] / N) * 100 - R.p) < Math.max(1, R.p * 0.15), `rareté ${R.name} : ${(rar[i] / N * 100).toFixed(1)} % au lieu de ${R.p} %`));
  assert.ok(val / mise > 0.82 && val / mise < 0.97, `valeur rendue ${val / mise}`);
  assert.ok(k / mise < 0.8, "une bonne part revient en objets");
}
["res", "item", "key", "sab", "coffre", "bonbon", "parch", "potion", "title"].forEach((x) => assert.ok(kinds.has(x), "sorte de lot jamais vue : " + x));
console.log("ok - lots (raretés, valeur, jamais de Dofus)");

// 3. 20 ouvertures par jour (heure de Paris), toutes caisses confondues ; refus sans kamas.
{
  const S = E.newState("Limite", "cra"); S.kamas = 100e6;
  for (let i = 0; i < F.DAY; i++) assert.ok(E.foireOpen(S, F.CAISSES[i % 3].id).ok);
  const k = S.kamas; const r = E.foireOpen(S, "bois"); assert.ok(r.err && /20 caisses/.test(r.err)); assert.strictEqual(S.kamas, k, "rien n'est pris");
  assert.strictEqual(E.foireLeft(S), 0);
  t += 24 * 3600000; assert.strictEqual(E.foireLeft(S), F.DAY, "le lendemain : 20 de nouveau");
  S.kamas = 49999; const r2 = E.foireOpen(S, "bois"); assert.ok(r2.err && /50 000/.test(r2.err.replace(/\s/g, " "))); assert.strictEqual(S.kamas, 49999); assert.strictEqual(E.foireLeft(S), F.DAY);
  assert.ok(E.foireOpen(S, "inconnue").err);
}
console.log("ok - 20 par jour");

// 4. Le tirage suit la graine de la partie : recharger la page ne change pas le lot suivant.
{
  const S = E.newState("Graine", "eni"); S.kamas = 10e6; E.foireOpen(S, "argent");
  const S2 = E.deserialize(E.serialize(S));
  const a = E.foireOpen(S, "argent").lot, b = E.foireOpen(S2, "argent").lot;
  delete a.uid; delete b.uid; assert.deepStrictEqual(a, b, "même graine, même lot");
  assert.strictEqual(E.foireState(S).log.length, 2); assert.ok(E.foireState(S).tot.mise === 500000);
  // le titre « Chouchou du Trool » n'est donné qu'une fois (ensuite, sa valeur en kamas)
  S.titlesExtra = [F.TITLE]; let n = 0;
  for (let i = 0; i < 3000 && n < 3; i++) { E.foireState(S).n = 0; S.kamas = 50000; const L = E.foireOpen(S, "bois").lot; if (L.r === 4) { n++; assert.ok(!L.title && L.k === L.v); } }
  assert.strictEqual(S.titlesExtra.filter((x) => x === F.TITLE).length, 1);
  // migration 1.0.30 : une partie sans S.foire, ou abîmée, se charge
  const old = JSON.parse(E.serialize(S)); delete old.foire; const S3 = E.deserialize(JSON.stringify(old)); assert.strictEqual(E.foireLeft(S3), F.DAY);
  old.foire = { seed: "x", log: 5 }; const S4 = E.deserialize(JSON.stringify(old)); assert.ok(E.foireState(S4).seed > 0 && Array.isArray(S4.foire.log));
}
console.log("ok - graine et migration");
// Carnet de bord : la mise et les kamas du lot vont dans la case « Foire du Trool » du bilan
{ const S = E.newState("Carnet", "iop"); S.kamas = 1e6; E.tick(S, 1000); const r = E.act(S, "foireOpen", "bois"); assert.ok(r.ok);
  const L = E.carnetLedger(S, 7); const o = L.out.find((x) => x.k === "foire"), i = L.inn.find((x) => x.k === "foire");
  assert.strictEqual((o ? o.v : 0) - (i ? i.v : 0), 50000 - r.lot.k, "bilan des kamas"); }
console.log("ok - carnet de bord");

/* ======================= Comptoirs ======================= */
// 5. Les 6 boutiques, chacune avec sa monnaie ; les anciennes boutiques marchent comme avant.
{
  assert.deepStrictEqual(E.CPT.map((B) => B.id), ["prime", "cite", "temple", "koli", "songe", "wb"]);
  const S = E.newState("Comptoir", "iop");
  E.CPT.forEach((B) => { assert.ok(B.name() && B.cur(), B.id); assert.strictEqual(typeof B.bal(S), "number"); assert.ok(B.items(S).length > 0, B.id + " vide"); });
  S.tokens.jetons = 100;
  assert.strictEqual(E.buyShop(S, "prime", "b1"), null); assert.strictEqual(S.cons.bonbon_sagesse, 1); assert.strictEqual(S.tokens.jetons, 96, "article d'origine");
  assert.strictEqual(E.cptBuy(S, "prime", "b1", 1), null); assert.strictEqual(S.cons.bonbon_sagesse, 2, "même achat par la page Comptoirs");
  // des objets qu'on rachète : Sablier (1 par jour), Trousseau de clés (3 par semaine), coffres
  E.sab(S).r = 0; assert.strictEqual(E.cptBuy(S, "prime", "ps1", 1), null); assert.strictEqual(Math.round(E.sab(S).r), 3600);
  assert.ok(/Limite atteinte aujourd'hui/.test(E.cptBuy(S, "prime", "ps1", 1)));
  assert.ok(/donjon/.test(E.cptBuy(S, "prime", "pk1", 1, "pas_un_donjon")));
  const dg = E.shopKeys(S)[0];
  if (dg) { const k0 = S.res[D.DUNGEONS[dg].key] || 0; assert.strictEqual(E.cptBuy(S, "prime", "pk1", 1, dg), null); assert.strictEqual(S.res[D.DUNGEONS[dg].key], k0 + 1); }
  assert.strictEqual(E.cptBuy(S, "prime", "pc1", 2), null); assert.strictEqual(S.cons.coffre_argent, 2);
  // teinture : palette de couleurs débloquée une fois
  S.tokens.jetons = 40; assert.strictEqual(E.cptBuy(S, "prime", "pt1"), null); assert.ok(S.unlocks.teint_chasseur); assert.strictEqual(S.tokens.jetons, 0);
  assert.strictEqual(E.cptBuy(S, "prime", "pt1"), "Déjà obtenu.");
  assert.ok(window.LOOKS.PALETTES.some((p) => p.id === "t_chasseur" && p.lock === "teint_chasseur"), "palette ajoutée, verrouillée");
  // la cité demande un alignement
  S.tokens.insignes = 500; assert.ok(/alignement/.test(E.cptBuy(S, "cite", "cs1", 1)));
  S.align = { side: "bonta", lvl: 1, xp: 0 }; assert.strictEqual(E.cptBuy(S, "cite", "ct1"), null); assert.ok(S.unlocks.teint_cite_bonta, "teinture de la cité de son camp");
  assert.strictEqual(E.cptBuy(S, "cite", "cq_fo", 3), null); assert.strictEqual(S.cons.parch_fo_p, 3);
  // Marché onirique et Boss des mondes passent par leurs fonctions d'origine
  assert.ok(typeof E.cptBuy(S, "songe", E.SG_SHOP[0].id) === "string", "pas assez de Bribes : refus");
  assert.ok(typeof E.cptBuy(S, "wb", E.WB_SHOP[0][0]) === "string", "pas assez de Fragments : refus");
}
console.log("ok - 6 boutiques et objets rachetables");

// 6. Offre de la semaine : un objet qu'on rachète, −30 %, 3 fois par semaine, la même pour tout le monde.
{
  const S = E.newState("Offre", "iop"); S.tokens.jetons = 1000; E.sab(S).r = 0;
  const O = E.cptOffer(S, "prime"); assert.ok(O && O.item.rebuy && O.left === 3);
  assert.strictEqual(O.cost, Math.ceil(O.item.cost * 0.7));
  assert.deepStrictEqual(E.cptOffer(E.newState("Autre", "cra"), "prime").id, O.id, "même offre pour tout le monde");
  const arg = O.item.key ? E.shopKeys(S)[0] : undefined;
  const j0 = S.tokens.jetons; assert.strictEqual(E.cptBuy(S, "prime", O.id, 1, arg, true), null);
  assert.strictEqual(j0 - S.tokens.jetons, O.cost, "payé au prix de l'offre");
  assert.strictEqual(E.cptOffer(S, "prime").left, 2);
  // un achat refusé ne coûte rien et ne compte pas
  const j1 = S.tokens.jetons; S.tokens.jetons = 0; const r = E.cptBuy(S, "prime", O.id, 1, arg, true); assert.ok(typeof r === "string"); assert.strictEqual(S.tokens.jetons, 0); S.tokens.jetons = j1;
  assert.strictEqual(E.cptOffer(S, "prime").left, 2);
  // la semaine suivante : une offre neuve
  t += 7 * 86400000; assert.strictEqual(E.cptOffer(S, "prime").left, 3);
  const all = E.CPT.map((B) => E.cptOffer(S, B.id)); assert.ok(all.every((o) => o && o.item.rebuy), "une offre dans chaque boutique");
}
console.log("ok - offre de la semaine");

// 7. Le point du menu : quelque chose de neuf à acheter, pas encore vu ; il s'éteint une fois vu.
{
  const S = E.newState("Neuf", "iop");
  assert.strictEqual(E.cptHasNew(S), false, "sans monnaie : rien de neuf");
  S.tokens.jetons = 5; assert.ok(E.cptNew(S, "prime").length > 0 && E.cptHasNew(S));
  assert.ok(!E.cptNew(S, "prime").includes("t2"), "trop cher : pas neuf");
  E.cptSeen(S, "prime"); assert.strictEqual(E.cptHasNew(S), false, "vu : le point s'éteint");
  S.tokens.jetons = 30; assert.ok(E.cptNew(S, "prime").includes("t1"), "plus de jetons : de nouveaux objets");
  S.tokens.insignes = 100; assert.ok(!E.cptNew(S, "cite").length, "cité sans alignement : rien");
  const S2 = E.deserialize(E.serialize(S)); assert.deepStrictEqual(S2.cpt.seen, S.cpt.seen, "gardé dans la partie");
  const old = JSON.parse(E.serialize(S)); delete old.cpt; assert.ok(E.cptState(E.deserialize(JSON.stringify(old))).seen, "migration : S.cpt créé");
}
console.log("ok - point du menu");
console.log("Foire du Trool et Comptoirs : tout est bon");
