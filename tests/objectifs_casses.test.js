/* 2.2.7.3 : objectifs qui ne bougeaient jamais (défi « Premiers outils », hauts faits de groupe, Duelliste, familles, succès impossibles en Monocompte) */
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/alignement.js"); require("../js/wboss.js"); require("../js/defi.js"); require("../js/koli.js");
require("../js/legendaires.js"); require("../js/dofusp.js"); require("../js/mono.js"); require("../js/monopass.js"); require("../js/monodofus.js"); require("../js/vente.js");
require("../js/quetes.js"); require("../js/saison1.js"); require("../js/saisonc.js");
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const mono = () => { const S = E.monoStart(E.newState("Héros", "iop")); S.chars[0].lvl = 120; return S; };
const d2 = E.tfDefi("d2");

// 1. « Premiers outils » : un métier monté compte, même sans spécialité choisie
{
  const S = mono(); assert.deepStrictEqual(E.monoSpecs(S), []);
  S.jobs.paysan.lvl = 45; assert.strictEqual(E.tfProgress(S, d2), 45, "récolte sans spécialité");
  S.crafts = S.crafts || {}; S.crafts.forgeron = { lvl: 72, xp: 0 }; assert.strictEqual(E.tfProgress(S, d2), 72, "artisanat sans spécialité");
  E.emit(S, "joblvl", { job: "paysan", lvl: 45 });
  assert.strictEqual((E.tfState(S).d.d2 || {}).paid, 2, "bronze et argent payés");
  console.log("ok - Premiers outils compte tous les métiers");
}
// 2. Spécialiste : les spécialités, et tous les métiers en Ironman ; défi 11 en Ironman
{
  const S = mono(); S.jobs.mineur.lvl = 100; const H = E.MONO_HF.find((x) => x.id === "a_spec");
  assert.strictEqual(E.hfValue(S, H), 0, "sans spécialité ni Ironman");
  assert.strictEqual(E.monoIronOn(S), null); assert.strictEqual(E.hfValue(S, H), 100, "Ironman : tous les métiers");
  assert.ok(E.monoSpecJob(S, "forgeron"));
  console.log("ok - Spécialiste et Ironman");
}
// 3. hauts faits de groupe et Duelliste comptés ; la famille ne bloque plus sur les « soon »
{
  ["g_dj", "g_st", "g_four", "g_koli"].forEach((id) => assert.ok(!E.MONO_HF.find((x) => x.id === id).soon, id));
  const S = mono(); const B = E.bpState(S);
  E.emit(S, "dungeon", { id: Object.keys(require("../js/data.js").DUNGEONS)[0], stasis: 7, group: true, players: 4, down: 0 });
  assert.strictEqual(B.cnt.grp, 1); assert.strictEqual(B.cnt.grp4, 1); assert.strictEqual(B.cnt.grpSt, 7);
  const Q = E.koliState(S); E.koliApply(S, { cote: Q.cote, ghost: true, name: "x" }, { win: true, rounds: 3 }, 1);
  assert.strictEqual(B.cnt.koli, 1, "victoire de Kolizéum comptée");
  E.MONO_HF.filter((H) => H.fam === "groupe" && !H.soon).forEach((H) => (B.hf[H.id] = 1)); B.fam = {}; E.hfCheck(S);
  assert.ok(B.fam.groupe, "famille Groupe complète sans les hauts faits pas encore comptés");
  console.log("ok - hauts faits de groupe, Duelliste, familles");
}
// 4. succès impossibles en Monocompte cachés, visibles ailleurs
{
  const S = mono(), C = E.newState("Héros", "iop"); const a = E.ACH.find((x) => x.id === "team8");
  assert.ok(!E.achVisible(S, a)); assert.ok(E.achVisible(C, a));
  assert.ok(E.achVisible(S, E.ACH.find((x) => x.id === "lvl50")));
  console.log("ok - succès impossibles cachés en Monocompte");
}
