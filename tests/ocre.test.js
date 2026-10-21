"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/elevage.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
E.setClock(() => 1800000000000);
const count = S => Object.values(S.items).filter(it => it.tpl === "dofus_ocre").length;
{
  const S = E.newState("Moisson", "iop");
  S.souls = Object.fromEntries(Object.keys(E.ARCHIS).map(k => [k, 1]));
  E.refreshArchis(S);
  assert.equal(E.ocreTier(S), 6);
  assert.ok(E.dofusQuest(S, "ocre").done);
  assert.equal(E.dofusStep(S, "ocre"), null);
  assert.equal(count(S), 1);
  const kamas = S.kamas;
  E.refreshArchis(S); E.refreshArchis(S);
  assert.equal(count(S), 1);
  assert.equal(S.kamas, kamas);
}
for (const savedQ of [undefined, { step: 0, prog: 0, done: 0 }]) {
  const S = E.newState("Ancienne partie", "iop");
  S.ocre = { tier: 6 }; S.dofusQ = savedQ ? { ocre: savedQ } : {};
  const before = JSON.stringify(S.items), kamas = S.kamas;
  const Q = E.dofusQuest(S, "ocre");
  assert.ok(Q.done); assert.equal(Q.step, E.DOFUS.ocre.steps.length);
  assert.deepEqual(E.dofusQuest(JSON.parse(JSON.stringify(S)), "ocre"), Q);
  assert.equal(JSON.stringify(S.items), before); assert.equal(S.kamas, kamas);
}
{
  const S = E.newState("Butin seul", "iop");
  E.giveDofus(S, "ocre", "test");
  assert.ok(!E.dofusQuest(S, "ocre").done);
  assert.ok(E.dofusStep(S, "ocre"));
}
console.log("ok - Ocre : six paliers, anciennes parties, butin seul et récompense unique");
