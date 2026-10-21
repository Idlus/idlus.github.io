/* Monocompte : le Dofus de saison « Dofus du Phénix » (js/monodofus.js). Quête de saison, autres Dofus fermés à leur quête,
   passif évolutif « Second souffle » (Cendres, Braise, Flamme, Phénix) compté par renaissance. Sans navigateur.
   Lancer : node tests/monodofus.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/alignement.js"); require("../js/wboss.js"); require("../js/defi.js"); require("../js/koli.js");
require("../js/legendaires.js"); require("../js/dofusp.js"); require("../js/mono.js"); require("../js/monopass.js"); require("../js/monodofus.js");
const D = require("../js/data.js");

let seed = 77;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);

// 1. La quête : seulement en Monocompte, les autres Dofus ne se gagnent plus par leur quête.
const S = E.monoStart(E.newState("Phenix", "iop")); E.monoBoot(S);
{
  assert.ok(E.DOFUS_ORDER.includes("phenix"), "le Dofus de saison a sa quête");
  assert.strictEqual(E.DOFUS.phenix.steps.length, 5);
  assert.ok(E.dofusStep(S, "phenix"), "étape 1 ouverte");
  const other = E.DOFUS_ORDER.find((k) => k !== "phenix" && E.DOFUS[k].steps[0] && E.DOFUS[k].steps[0].t !== "gift");
  assert.strictEqual(E.dofusStep(S, other), null, "les autres quêtes de Dofus sont fermées en Monocompte");
  assert.ok(E.dofusStep(E.newState("Classique", "iop"), other), "elles restent ouvertes sur le Classique");
  assert.strictEqual(E.DOFUS.phenix.steps[0].k, "hon", "étape 1 : honneur pour ton camp (P-A3, variante B)"); assert.deepStrictEqual(E.dofusStepProgress(S, "phenix", 0), [0, E.DOFUS.phenix.steps[0].n]);
  E.dofusQuest(S, "phenix").step = 5; E.emit(S, "win", { mons: [], sub: null });
  assert.ok(E.dofusOwned(S, "phenix"), "quête finie : le Dofus est donné");
  console.log("ok - quête du Dofus du Phénix");
}
// 2. Les stades : 25, 100 puis 300 renaissances.
{
  const at = (n) => { S.mono.phx = n; return E.phxStage(S); };
  assert.deepStrictEqual([0, 24, 25, 99, 100, 299, 300, 9999].map(at), [0, 0, 1, 1, 2, 2, 3, 3]);
  S.mono.phx = 42; E.monoBoot(S);
  assert.ok(/Stade 2\/4 « Braise » · 42\/100/.test(E.dofpTxt("phenix")), E.dofpTxt("phenix"));
  assert.strictEqual(D.ITEMS.dofus_phenix.icon, 99021, "œuf du stade Braise");
  S.mono.phx = 0; E.monoBoot(S); assert.strictEqual(D.ITEMS.dofus_phenix.icon, 99024, "œuf du stade Cendres");
  console.log("ok - stades du passif");
}
// 3. En combat : soin sous 30 %, compté comme une renaissance ; Flamme deux fois ; Phénix renaît au lieu de tomber.
{
  const fight = (n) => {
    S.mono.phx = n; const c = S.chars[0];
    const e = { side: "c", cid: c.id, name: c.name, cls: c.cls, hp: 1000, hpMax: 1000, alive: true, dp: ["phenix"], buffs: [], debuffs: [], dots: [], st: {}, shield: 0 };
    const m = { side: "m", name: "Bouftou", hp: 100, hpMax: 100, alive: true, buffs: [], debuffs: [], dots: [], st: {}, shield: 0 };
    const F = { ents: [e, m], log: [], fx: [], round: 1, seq: 0, deaths: [] }; E.dofpFight(S, F);
    const hit = (v) => { e.hp -= v; if (e.hp <= 0 && E.dofpSave) E.dofpSave(F, e); if (e.hp > 0) E.dofpHurt(F, m, e, v); };
    return { e, hit };
  };
  let f = fight(0); f.hit(800); assert.strictEqual(f.e.hp, 450, "Cendres : +25 %"); assert.strictEqual(S.mono.phx, 1, "une renaissance comptée");
  f.hit(300); assert.strictEqual(f.e.hp, 150, "une seule fois par combat");
  f = fight(25); f.hit(800); assert.strictEqual(f.e.hp, 500, "Braise : +30 %");
  f = fight(100); f.hit(800); f.hit(300); assert.strictEqual(f.e.hp, 500, "Flamme : deux fois par combat"); assert.strictEqual(S.mono.phx, 102);
  f = fight(300); f.hit(2000); assert.strictEqual(f.e.hp, 300, "Phénix : renaît avec 30 %"); f.hit(2000); assert.ok(f.e.hp <= 0, "une seule renaissance par combat");
  const T = E.deserialize(E.serialize(S)); assert.strictEqual(T.mono.phx, S.mono.phx, "le compteur reste dans la sauvegarde");
  console.log("ok - passif évolutif en combat");
}
console.log("Dofus du Phénix : tout est bon");
