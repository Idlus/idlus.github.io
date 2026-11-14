/* 3.1.8 (retour d'Aglouglou, 14/11) : le ×2 du Chantier compte aussi pour l'absence calculée au chargement de la page
   (avant la première réponse du serveur), au prorata de la part de l'absence couverte par le bonus ; le rendement de zone
   suit la dernière heure de jeu. Lancer : node tests/chantier_x2.test.js */
"use strict";
const assert = require("assert");
globalThis.window = globalThis;
const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
globalThis.document = { visibilityState: "hidden" };
const E = require("../js/engine.js"); window.ENGINE = E;
require("../js/systems.js");
window.ONLINE = { enabled: true, solo: () => false, monoGame: () => false, rpc: async () => ({ err: "hors ligne" }), state: "offline" };
window.DX = { S: {} };
const realSI = setInterval, realST = setTimeout; globalThis.setInterval = () => 0; globalThis.setTimeout = () => 0;
require("../js/chantier.js");
globalThis.setInterval = realSI; globalThis.setTimeout = realST;

const T0 = Date.UTC(2030, 0, 8, 10, 0); let t = T0; E.setClock(() => t);
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const S0 = E.newState("Chantier", "iop"); S0.chars[0].lvl = 200;
["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S0, k, "H" + i, 200).inTeam = true; }); // niveau 200 : l'XP va dans la Maîtrise (cas d'Aglouglou)
Object.values(E.SUBS).forEach((s) => (S0.progress.wins[s.id] = 20));
E.startHunt(S0, Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] >= 180 && E.SUBS[k].monsters && E.SUBS[k].monsters.length));
S0.stats.recent = Array.from({ length: 20 }, (_, i) => ({ d: 2 + (i % 3), w: i % 6 ? 1 : 0 }));
const base = E.serialize(S0);
const xpOf = (S) => S.chars.reduce((s, c) => { const M = E.mt(c); return s + E.mtXpTot(M.lvl) + M.xp; }, 0);
const run = (h) => { E.setRng(rng(3)); t = T0; const S = E.deserialize(base); const x0 = xpOf(S); E.catchUp(S, h * 3600); return xpOf(S) - x0; };
const iso = (ms) => new Date(ms).toISOString();

delete store["idlus-chantier-bonus"];
const plain = run(8);
assert.ok(plain > 0, "de l'XP sans Chantier");
// bonus couvrant toute l'absence : ×2 (le poll du serveur n'a pas encore répondu : E.chUntil = 0)
store["idlus-chantier-bonus"] = JSON.stringify({ classic: { d: iso(T0 - 20 * 3600e3), b: iso(T0 + 28 * 3600e3) } });
assert.strictEqual(E.chUntil, 0);
const full = run(8);
assert.ok(Math.abs(full / plain - 2) < 0.02, `×2 sur toute l'absence (${(full / plain).toFixed(3)})`);
// bonus commencé au milieu de l'absence : ×1,5
store["idlus-chantier-bonus"] = JSON.stringify({ classic: { d: iso(T0 - 4 * 3600e3), b: iso(T0 + 44 * 3600e3) } });
const half = run(8);
assert.ok(Math.abs(half / plain - 1.5) < 0.02, `×1,5 pour la moitié de l'absence (${(half / plain).toFixed(3)})`);
// bonus fini pendant l'absence (retour après la fin) : la part couverte compte quand même
store["idlus-chantier-bonus"] = JSON.stringify({ classic: { d: iso(T0 - 50 * 3600e3), b: iso(T0 - 6 * 3600e3) } });
const after = run(8);
assert.ok(Math.abs(after / plain - 1.25) < 0.02, `×1,25 pour 2 h sur 8 (${(after / plain).toFixed(3)})`);
assert.strictEqual(E.chFrac, null, "rien ne reste après le calcul");
// serveur Monocompte : le Chantier du Classique ne compte pas
window.ONLINE.monoGame = () => true; window.ONLINE.monoMarket = () => true;
store["idlus-chantier-bonus"] = JSON.stringify({ classic: { d: iso(T0 - 20 * 3600e3), b: iso(T0 + 28 * 3600e3) } });
assert.ok(Math.abs(run(8) / plain - 1) < 0.001, "pas de ×2 du Classique en Monocompte");
window.ONLINE.monoGame = () => false;
// en jeu : bonus connu = ×2, avec un événement ×2 de Mathis = pas de ×4
assert.strictEqual(E.evMult("xp"), 2); assert.strictEqual(window.CHANTIER.on(), true);
const ev = E.EVENT; E.EVENT = { name: "Test", from: T0 - 1, to: T0 + 1e6, xp: 2, drop: 2, mt: true }; assert.strictEqual(E.evMult("xp"), 2); E.EVENT = ev;
store["idlus-chantier-bonus"] = "{}"; assert.strictEqual(E.evMult("xp"), 1);

// rendement de zone : la dernière heure de jeu
{ E.setRng(rng(5)); t = T0; const S = E.deserialize(base); const z = (S.zoneStats[S.sub] = { f: 50000, w: 50000, s: 100 * 3600, xp: 100 * 3600 * 1000, k: 0, r: 0, i: 0 });
  for (let i = 0; i < 400; i++) { E.tick(S, 1000); t += 1000; }
  const zz = S.zoneStats[S.sub]; assert.ok(zz.s <= E.ZONE_WIN_S + 60, "fenêtre d'une heure"); assert.ok(zz.f < 50000, "anciens combats allégés");
  void z; }
console.log("chantier_x2 : OK");
