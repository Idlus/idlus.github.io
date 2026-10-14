/* 1.0.32.1 « Compositions et métiers » : chaque composition garde son placement métier.
   Lancer : node tests/compmetiers.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js");
let now = 1.8e12; E.now = () => now; E.protSpawn = () => {};
const S = E.newState("Comp", "iop");
["cra", "eni", "xelor", "feca"].forEach((k) => E.addChar(S, k, "H" + k, 50));
const [a, b, c, d, e] = S.chars; S.jobs.paysan.lvl = 50; S.jobs.bucheron.lvl = 50;
// composition 1 : a, b, c en équipe ; d au blé, e au frêne
[a, b, c].forEach((x) => (x.inTeam = true)); d.inTeam = e.inTeam = false;
assert.strictEqual(E.setJob(S, d.id, "paysan", "Blé"), null); assert.strictEqual(E.setJob(S, e.id, "bucheron", "Bois de Frêne"), null);
assert.strictEqual(E.saveComp(S, -1, "Une"), null);
assert.deepStrictEqual(S.comps[0].jobs, { [d.id]: { job: "paysan", res: "Blé" }, [e.id]: { job: "bucheron", res: "Bois de Frêne" } }, "placement métier enregistré");
// composition 2 : d, e en équipe, a récolte
assert.strictEqual(E.applyComp(S, 0).err, undefined);
E.setJob(S, d.id, null); E.setJob(S, e.id, null); d.inTeam = e.inTeam = true; b.inTeam = c.inTeam = false; E.setJob(S, a.id, "bucheron", "Bois de Frêne");
assert.strictEqual(E.saveComp(S, -1, "Deux"), null);
assert.deepStrictEqual(Object.keys(S.comps[1].jobs), [String(a.id)]);
// retour à la composition 1 : d et e reprennent leur récolte, a revient dans l'équipe
let r = E.applyComp(S, 0); assert.ok(!r.err, r.err);
assert.deepStrictEqual(E.team(S).map((x) => x.id).sort(), [a.id, b.id, c.id].sort());
assert.strictEqual(d.job && d.job.res, "Blé"); assert.strictEqual(e.job && e.job.res, "Bois de Frêne"); assert.ok(!a.job);
// en quittant la composition 1, son placement modifié est retenu
E.setJob(S, d.id, "paysan", "Orge");
r = E.applyComp(S, 1); assert.ok(!r.err, r.err);
assert.strictEqual(S.comps[0].jobs[d.id].res, "Orge", "placement retenu en quittant la composition");
assert.strictEqual(a.job && a.job.res, "Bois de Frêne"); assert.ok(!b.job, "héros sans métier dans la composition : au repos");
// héros occupé à l'entraînement : laissé tel quel et signalé
S.training = e.id; e.inTeam = false;
S.comps[0].jobs[e.id] = { job: "bucheron", res: "Bois de Frêne" };
r = E.applyComp(S, 0); assert.ok(!r.err);
assert.deepStrictEqual(r.busy, [e.name]); assert.ok(!e.job); assert.strictEqual(S.training, e.id);
// ancienne composition sans placement : la récolte en cours ne bouge pas
delete S.comps[1].jobs; S.training = null; E.setJob(S, c.id, null); b.inTeam = false; E.setJob(S, b.id, "paysan", "Blé");
r = E.applyComp(S, 1); assert.ok(!r.err);
assert.strictEqual(b.job && b.job.res, "Blé", "ancienne composition : placement inchangé");
console.log("compmetiers : OK");
