/* 2.1.29.6 : le bilan des kamas du carnet range chaque source dans sa case (Songe infini, Kolizéum, marchand,
   coffres, opérations du serveur), et le total tombe toujours juste. Sans navigateur.
   Lancer : node tests/carnet.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "archis", "welcome", "defi", "koli", "legendaires", "champions", "songe", "expeditions", "suivi", "vie", "quetes", "ascension", "reliques"].forEach((f) => require(`../js/${f}.js`));

let seed = 4242;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const team = (L) => { const S = E.newState("Carnet", "iop"); S.chars[0].lvl = L; ["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S, k, "H" + i, L).inTeam = true; }); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20)); return S; };
const inn = (S, k) => (E.carnetLedger(S, 7).inn.find((x) => x.k === k) || { v: 0 }).v;
const net = (S) => { const L = E.carnetLedger(S, 7); return L.inn.reduce((s, x) => s + x.v, 0) - L.out.reduce((s, x) => s + x.v, 0); };

// 1. Songe infini : les kamas des combats et de la validation vont dans « Songe infini », pas dans « Chasse » ni « Quêtes ».
{
  const S = team(60); E.carnet(S); const k0 = S.kamas;
  assert.strictEqual(E.act(S, "expStart", 0), null);
  for (let i = 0; i < 400 && E.expActive(S); i++) { now += 1500; E.tick(S, 1500); const p = E.expPending(S); if (p) E.act(S, "expChoose", p.t === "fount" ? "no" : 0); }
  const got = S.kamas - k0;
  assert.ok(S.history.some((h) => h.x === 1), "combats du songe marqués");
  assert.ok(got > 0, "le songe rapporte des kamas");
  assert.strictEqual(inn(S, "chasse"), 0, "rien dans « Chasse »");
  assert.strictEqual(inn(S, "expedition"), got, "tout le gain du songe dans « Songe infini »");
  assert.strictEqual(net(S), got, "le bilan tombe juste");
  console.log("ok - carnet : songe infini", got, "kamas");
}

// 2. Marchand de secours, coffre, Kolizéum : chacun dans sa case, sans double compte (pendant une action ou hors action).
{
  const S = team(60); E.carnet(S); const k0 = S.kamas;
  const res = Object.keys(require("../js/data.js").RES).find((n) => E.resPrice(n) > 10);
  S.res[res] = 1000; const p = E.merchantRes(S, res, 1000); // appelé directement par l'écran (vente du surplus)
  E.tick(S, 250);
  assert.strictEqual(inn(S, "vented"), p, "marchand de secours");
  E.addCons(S, "coffre_or"); const kc = S.kamas; assert.strictEqual(E.act(S, "useConsumable", "coffre_or"), null); const ck = S.kamas - kc;
  if (ck > 0) assert.strictEqual(inn(S, "coffre"), ck, "coffre ouvert");
  E.koliSetTeam(S, S.chars.slice(0, 3).map((c) => c.id)); S.cons[E.KOLI_TICKET] = 5;
  const kk = S.kamas; const r = E.act(S, "koliFight", 0); const kg = S.kamas - kk;
  assert.ok(r && typeof r === "object", "combat de Koli");
  assert.strictEqual(inn(S, "koli"), kg, "bourse du Kolizéum");
  assert.strictEqual(net(S), S.kamas - k0, "le bilan tombe juste");
  console.log("ok - carnet : marchand, coffre, Kolizéum");
}

// 3. Opérations du serveur : vente directe, guilde, Hôtel de vente ; pas recomptées au prochain tic.
{
  const S = team(60); E.carnet(S); const k0 = S.kamas; S.hdv = { op: 0, log: [] };
  const ops = [[{ k: 50000, vd: 1 }, "Vente directe"], [{ k: 12000 }, "Percepteur de Bonta récolté"], [{ k: 8000, sold: 3 }, "Vendu à X : Coiffe"], [{ k: -500 }, "Mis en vente : Coiffe"]];
  ops.forEach(([p, t], i) => { S.kamas += p.k; S.hdv.op = i + 1; E.carnetOp(S, p, t); });
  E.tick(S, 250);
  assert.strictEqual(inn(S, "vented"), 50000); assert.strictEqual(inn(S, "guilde"), 12000); assert.strictEqual(inn(S, "hdv"), 8000);
  assert.strictEqual(net(S), S.kamas - k0, "le bilan tombe juste");
  console.log("ok - carnet : opérations du serveur");
}
console.log("ok - carnet de bord");
