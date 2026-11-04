/* Monocompte, mode Ironman (Mathis, 03/11 : 1C 2A 3A 4A ; js/mono.js, js/verify_mono.js) :
   1. moteur : passage pendant la manche 1 ou au niveau 20 au plus, tous les métiers jusqu'au niveau 200, pas de renfort,
      sortie une seule fois (métiers hors spécialités au niveau 100), pas de retour ;
   2. Bouclier : métiers 200 acceptés en Ironman, vente / achat / échange refusés après le passage, passage déplacé,
      effacé ou repris refusé ; résumé avec le badge.
   Lancer : node tests/mono_iron.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "koli", "legendaires", "dofusp",
  "collections", "sram", "champions", "chroma", "alignement", "honneur", "quetes", "mono", "monopass", "monoplus", "monodofus", "monoalign", "saison1"].forEach((f) => require("../js/" + f + ".js"));
const V = require("../js/verify.js"); const VM = require("../js/verify_mono.js");
const DAY = 86400000;
const DEBUT = Date.parse("2026-11-01T23:00:00Z");
let now = DEBUT + 8 * 3600e3; E.setClock(() => now); V.now = () => now;
E.weekly = () => null; E.flash = () => [];
const regOf = (S) => ({ solde: E.tfBalance(S), genere: E.tfActTotal(S), max: E.tfBalance(S) });
const ctx = () => ({ debut: DEBUT, date: now });
const fresh = () => { const S = E.monoStart(E.newState("Ferrine", "iop")); S.mono.t0 = DEBUT; E.monoBoot(S); E.MONO.saisons[1].debut = DEBUT; S.hdv = { op: 0, log: [] }; return S; };
const ver = (S, prev, o) => { const r = VM.verifier(E, E.serialize(S), Object.assign({ prev, at: now, ctx: ctx(), reg: regOf(S) }, o || {})); E.setClock(() => now); return r; };
const keep = (r) => ({ bilan: r.bilan, res: r.res, at: now });

/* ---------- 1. moteur ---------- */
{
  const S = fresh();
  assert.strictEqual(E.monoIron(S), false);
  assert.strictEqual(E.jobCap(S, "g", "paysan"), 100);
  S.hdv.op = 7;
  assert.strictEqual(E.monoIronOn(S), null);
  assert.strictEqual(E.monoIron(S), true); assert.strictEqual(S.mono.iron.op, 7);
  assert.strictEqual(E.jobCap(S, "g", "paysan"), 200); assert.strictEqual(E.jobCap(S, "c", "forgeron"), 200);
  assert(/déjà/.test(E.monoIronOn(S)));
  assert(/Ironman/.test(E.monoRenfortErr(S, { u: "x", snap: { cls: "iop", lvl: 1, st: {}, sp: [] } }) || ""), "renfort permis en Ironman");
  // une spécialité retirée garde son niveau en Ironman
  E.monoSetSpec(S, 0, "mineur"); S.jobs.mineur.lvl = 150; S.mono.specM = 0;
  assert.strictEqual(E.monoSetSpec(S, 0, "bucheron"), null); assert.strictEqual(S.jobs.mineur.lvl, 150);
  // sortie : métiers hors spécialités à 100 (niveau gardé si le métier redevient spécialité), plus de retour
  S.jobs.paysan.lvl = 180; S.jobs.bucheron.lvl = 170; S.hdv.op = 9;
  assert.strictEqual(E.monoIronQuit(S), null);
  assert.strictEqual(E.monoIron(S), false); assert.strictEqual(S.mono.iron.qop, 9);
  assert.strictEqual(S.jobs.paysan.lvl, 100); assert.strictEqual(S.jobs.paysan.keep.lvl, 180);
  assert.strictEqual(S.jobs.bucheron.lvl, 170, "la spécialité garde son niveau");
  assert.strictEqual(S.jobs.mineur.lvl, 100);
  assert(/ne se reprend pas/.test(E.monoIronOn(S)));
  assert(/ne joues pas/.test(E.monoIronQuit(S)));
  console.log("ok - moteur : passage, métiers 200, renfort fermé, sortie unique");
}
{
  const S = fresh(); now = DEBUT + 20 * DAY; S.chars[0].lvl = 40;
  assert(/manche 1/.test(E.monoIronErr(S) || ""), "passage permis en manche 2 au niveau 40");
  S.chars[0].lvl = 15; assert.strictEqual(E.monoIronErr(S), null, "héros neuf refusé en manche 2");
  now = DEBUT + 8 * 3600e3;
  console.log("ok - passage : manche 1, ou héros du niveau 20 au plus");
}

/* ---------- 2. Bouclier ---------- */
{
  const S = fresh();
  const r0 = ver(S, null); assert(r0.ok, "départ refusé : " + r0.why);
  let P = keep(r0);
  // sans Ironman, un métier à 150 hors spécialité est refusé
  S.jobs.paysan.lvl = 150; now += 60e3;
  const r1 = ver(S, P); assert(!r1.ok && /Paysan/.test(r1.why), "métier 150 sans Ironman accepté : " + JSON.stringify(r1));
  S.jobs.paysan.lvl = 1;
  S.hdv.op = 3; assert.strictEqual(E.monoIronOn(S), null); now += 60e3;
  const r2 = ver(S, P, { ops: [{ id: 3, p: { k: 500, sold: 1 } }] }); assert(r2.ok, "passage refusé : " + r2.why);
  assert.strictEqual(r2.resume.iron, true, "badge absent du résumé");
  P = keep(r2);
  S.jobs.paysan.lvl = 150; S.crafts = S.crafts || {}; S.crafts.forgeron = { lvl: 120, xp: 0 }; now += 60e3;
  const r3 = ver(S, P); assert(r3.ok, "métiers 200 en Ironman refusés : " + r3.why); P = keep(r3);
  // vente, achat, échange après le passage
  S.hdv.op = 5; now += 60e3;
  const r4 = ver(S, P, { ops: [{ id: 4, p: { tdj: { d: "x", did: "y" } } }, { id: 5, p: { k: -1000, add: [] } }] });
  assert(!r4.ok && /Ironman/.test(r4.why), "achat en Ironman accepté : " + JSON.stringify(r4));
  const r5 = ver(S, P, { ops: [{ id: 4, p: { tdj: { d: "x", did: "y" } } }, { id: 5, p: { res: { "Clé": -1 } } }] });
  assert(r5.ok, "opérations du Bureau refusées : " + r5.why); P = keep(r5);
  // #172 : la récompense de vote (kamas + Sablier) arrive en opération du serveur, ce n'est pas une vente
  S.hdv.op = 7; now += 60e3;
  const r5b = ver(S, P, { ops: [{ id: 6, p: { k: 128219, sab: 1980, vote: 1 } }, { id: 7, p: { sab: 7200, vote: 1 } }] });
  assert(r5b.ok, "récompense de vote refusée en Ironman : " + r5b.why); P = keep(r5b);
  // passage déplacé, effacé
  const T = VM.load(E, E.serialize(S)); T.mono.iron.op = 50; now += 60e3;
  const r6 = ver(T, P); assert(!r6.ok && /déplacé/.test(r6.why), "passage déplacé accepté : " + JSON.stringify(r6));
  const T2 = VM.load(E, E.serialize(S)); delete T2.mono.iron; T2.jobs.paysan.lvl = 1; T2.crafts.forgeron.lvl = 1;
  const r7 = ver(T2, P); assert(!r7.ok && /effacé/.test(r7.why), "passage effacé accepté : " + JSON.stringify(r7));
  // sortie : métiers à 100, les ventes après la sortie sont permises
  assert.strictEqual(E.monoIronQuit(S), null); S.hdv.op = 8; now += 60e3;
  const r8 = ver(S, P, { ops: [{ id: 8, p: { k: 900, sold: 2 } }] }); assert(r8.ok, "sortie refusée : " + r8.why); P = keep(r8);
  assert.strictEqual(r8.resume.iron, false);
  // retour après la sortie
  const T3 = VM.load(E, E.serialize(S)); delete T3.mono.iron.quit; now += 60e3;
  const r9 = ver(T3, P); assert(!r9.ok && /repris/.test(r9.why), "retour en Ironman accepté : " + JSON.stringify(r9));
  console.log("ok - Bouclier : métiers 200, ventes et échanges refusés, passage déplacé, effacé ou repris refusé, sortie acceptée");
}
{
  // passage tardif avec un héros trop haut
  const S = fresh(); S.chars[0].lvl = 30; now = DEBUT + 20 * DAY;
  const r0 = ver(S, null, { accept: true }); assert(r0.ok); const P = keep(r0);
  S.mono.iron = { at: now, op: 0, lvl: 30 }; now += 60e3;
  const r1 = ver(S, P); assert(!r1.ok && /niveau 20/.test(r1.why), "passage tardif accepté : " + JSON.stringify(r1));
  console.log("ok - Bouclier : passage après la manche 1 au-dessus du niveau 20 refusé");
}
console.log("mono_iron : tout est bon");
