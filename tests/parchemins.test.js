/* 2.1.40.5 « Plusieurs parchemins d'un coup » : ×N coûte exactement comme N fabrications une par une. Lancer : node tests/parchemins.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
const mk = (dust, kamas, done) => ({ res: { "Poussière de stasis": dust }, kamas, scrollCrafted: Object.assign({}, done || {}), cons: {} });
// même résultat qu'en cliquant N fois
{ const a = mk(5000, 1e6, { vit: 7 }), b = mk(5000, 1e6, { vit: 7 });
  const n = E.scrollCraftMax(a, "vit");
  assert.ok(n > 1 && n < E.SCROLL_MAX, "assez pour plusieurs, pas pour 100 : " + n);
  const tot = E.scrollCraftTotal(a, "vit", n);
  assert.strictEqual(E.craftScroll(a, "vit", n), null);
  for (let i = 0; i < n; i++) assert.strictEqual(E.craftScroll(b, "vit"), null);
  assert.strictEqual(E.scrollCraftMax(b, "vit"), 0, "le suivant n'est plus payable");
  assert.deepStrictEqual(a.res, b.res); assert.strictEqual(a.kamas, b.kamas); assert.deepStrictEqual(a.cons, b.cons); assert.deepStrictEqual(a.scrollCrafted, b.scrollCrafted);
  assert.strictEqual(5000 - (a.res["Poussière de stasis"] || 0), tot.dust, "coût total annoncé = coût réel");
  assert.strictEqual(1e6 - a.kamas, tot.kamas);
  assert.strictEqual(a.cons.parch_vit_p, n); }
// plafond : jamais plus que demandé, ni plus de 100 d'un coup ; les kamas limitent aussi
{ const a = mk(1e9, 1e12); assert.strictEqual(E.scrollCraftMax(a, "sa", 12), 12); assert.strictEqual(E.scrollCraftMax(a, "sa"), E.SCROLL_MAX);
  E.craftScroll(a, "sa", 5000); assert.strictEqual(a.cons.parch_sa_p, E.SCROLL_MAX, "100 au plus par clic");
  const k = mk(1e9, 1000); assert.strictEqual(E.scrollCraftMax(k, "fo"), 2, "400 + 440 kamas"); }
// rien à payer : message d'erreur, rien ne bouge
{ const a = mk(5, 1e6); assert.ok(typeof E.craftScroll(a, "ch", 10) === "string"); assert.deepStrictEqual(a.cons, {}); assert.strictEqual(E.scrollCraftMax(a, "ch"), 0); }
console.log("ok - parchemins ×N");
