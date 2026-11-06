/* 2.2.11 « Songes en boucle » : la case « En boucle » relance la même intensité 5 s après le réveil, s'arrête après 2 songes
   de suite non validés ou sur un réveil voulu ; une absence en plein songe réveille l'équipe et compte comme de la chasse.
   Lancer : node tests/songe_boucle.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/welcome.js"); require("../js/defi.js"); require("../js/legendaires.js"); require("../js/songe.js");

let seed = 77;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const sub = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] >= 20);
const mk = () => { const S = E.newState("Boucle", "iop"); S.chars[0].lvl = 30; E.subUnlocked = () => true; E.startHunt(S, sub); return S; };
const fakeEnd = (S, valid) => { S.exp.valid = valid; E.expQuit(S); }; // fin d'un songe sans le jouer

// 1. Sans la case : rien ne se relance.
{ const S = mk(); assert.ok(!E.sgLoopOn(S)); E.expStart(S, 0); S.exp.valid = true; S.exp.pend.push({ t: "wave", at: now, auto: true }); E.expChoose(S, "no");
  now += 10000; E.tick(S, 1000); assert.ok(!E.expActive(S), "pas de relance sans la case"); assert.ok(S.hunting, "retour à la chasse");
  console.log("ok - boucle : sans la case, rien ne se relance"); }

// 2. Avec la case : réveil automatique → relance 5 s plus tard, même intensité.
{ const S = mk(); E.sgSetLoop(S, true); E.songe(S).unl = 2; E.expStart(S, 1);
  S.exp.valid = true; S.exp.pend.push({ t: "wave", at: now, auto: true }); E.expChoose(S, "no");
  assert.ok(!E.expActive(S) && S.sgLoop && S.sgLoop.ii === 1, "relance prévue");
  now += 3000; E.tick(S, 1000); assert.ok(!E.expActive(S), "pas avant 5 s");
  now += 2500; E.tick(S, 1000); assert.ok(E.expActive(S) && S.exp.ii === 1 && S.exp.loop, "relancé en Paradoxe 1");
  // 3. Deux songes de suite non validés : la boucle s'arrête.
  S.exp.pend.push({ t: "sable", at: now }); S.exp.sable = 0; E.expChoose(S, "no");
  assert.ok(S.sgLoop && S.sgLoop.fail === 1, "1er échec compté"); now += 6000; E.tick(S, 1000); assert.ok(E.expActive(S), "relance après 1 échec");
  S.exp.pend.push({ t: "sable", at: now }); S.exp.sable = 0; E.expChoose(S, "no");
  assert.strictEqual(S.sgLoop, null, "arrêt après 2 échecs"); now += 6000; E.tick(S, 1000); assert.ok(!E.expActive(S), "plus de relance");
  assert.ok(E.sgLoopOn(S), "la case reste cochée");
  console.log("ok - boucle : relance après 5 s, arrêt après 2 échecs de suite"); }

// 4. Se réveiller soi-même (bouton, ou « se réveiller » choisi à la main) arrête la boucle.
{ const S = mk(); E.sgSetLoop(S, true); E.expStart(S, 0); fakeEnd(S, true); assert.strictEqual(S.sgLoop, null, "Se réveiller : arrêt");
  E.expStart(S, 0); S.exp.valid = true; S.exp.pend.push({ t: "wave", at: now }); E.expChoose(S, "no"); assert.strictEqual(S.sgLoop, null, "réveil choisi à la main : arrêt");
  E.expStart(S, 0); S.exp.valid = true; S.exp.pend.push({ t: "wave", at: now, auto: true }); E.expChoose(S, "no"); assert.ok(S.sgLoop, "réveil automatique : la boucle continue");
  E.sgLoopStop(S); now += 6000; E.tick(S, 1000); assert.ok(!E.expActive(S), "Arrêter la boucle");
  console.log("ok - boucle : un réveil voulu arrête la boucle"); }

// 5. Absence en plein songe : réveil, chasse pendant l'absence, pas de relance au retour.
{ const S = mk(); E.sgSetLoop(S, true); E.expStart(S, 0); assert.ok(!S.hunting);
  E.catchUp(S, 120); assert.ok(E.expActive(S), "absence de 2 min : le songe continue");
  E.catchUp(S, 3600); assert.ok(!E.expActive(S) && S.hunting && S.expLast.away, "absence d'1 h : réveil et chasse"); assert.strictEqual(S.sgLoop, null, "pas de relance au retour");
  const T = mk(); T.hunting = false; E.expStart(T, 0); E.catchUp(T, 3600); assert.ok(T.hunting && T.sub === sub, "sans chasse avant le songe : l'équipe chasse dans sa dernière zone");
  console.log("ok - boucle : l'absence en plein songe compte comme de la chasse"); }

// 6. Monocompte : pas de boucle (Songe fermé).
{ const S = mk(); S.mono = {}; E.sgSetLoop(S, true); assert.ok(!E.sgLoopOn(S)); console.log("ok - boucle : fermée en Monocompte"); }
