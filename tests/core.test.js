/* Fondations du multijoueur : horloge réglable, hasard rejouable, liste des actions, sauvegarde.
   Lancer : node tests/core.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const SV = require("../js/save.js");
const D = require("../js/data.js");
const firstSub = D.ZONES[0].subs[0].id;

const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 1. L'horloge du jeu est réglable : la partie lit l'heure imposée, pas celle de l'appareil.
const T0 = Date.UTC(2030, 0, 7, 12, 0, 0);
E.setClock(() => T0);
assert.strictEqual(E.now(), T0);
assert.strictEqual(E.newState("Horloge", "iop").created, T0, "la partie neuve doit prendre l'heure du jeu");
console.log("ok - horloge du jeu réglable");

// 2. Même hasard + même horloge = exactement la même partie (le serveur pourra rejouer).
function run() {
  let t = T0; E.setClock(() => t); E.setRng(mulberry(777));
  const S = E.newState("Rejeu", "cra");
  assert.strictEqual(E.act(S, "startHunt", firstSub), null);
  for (let i = 0; i < 20 * 60 * 4; i++) { t += 250; E.tick(S, 250); }
  return E.serialize(S);
}
const a = run(), b = run();
assert.ok(JSON.parse(a).stats.fights > 5, "trop peu de combats");
assert.strictEqual(a, b, "deux parties rejouées avec le même hasard et la même horloge diffèrent");
console.log("ok - partie rejouable à l'identique (20 min de chasse)");

// 3. La liste des actions : toutes existent, prennent la partie en premier, le reste est refusé.
for (const k in E.ACTIONS) assert.strictEqual(typeof E[k], "function", `action ${k} introuvable dans le moteur`);
const S0 = E.newState("Actions", "iop");
assert.ok(/inconnue/.test(E.act(S0, "serialize")), "une fonction hors liste doit être refusée");
assert.ok(/inconnue/.test(E.act(S0, "constructor")), "un nom piégé doit être refusé");
console.log(`ok - ${Object.keys(E.ACTIONS).length} actions du joueur`);

// 4. Sauvegarde avec un support factice (comme le serveur demain).
const mem = {}; SV.useStore({ get: (k) => (k in mem ? mem[k] : null), set: (k, v) => { mem[k] = v; return true; }, del: (k) => { delete mem[k]; } });
SV.init({ key: "test-save", version: "9.9.9", engine: E });
assert.strictEqual(SV.load().state, null, "aucune partie au départ");
const S1 = E.newState("Sauve", "iop");
assert.ok(SV.write(E.serialize(S1), S1));
assert.strictEqual(SV.copies().length, 1, "première écriture : une copie automatique");
assert.strictEqual(SV.load().state.chars[0].name, "Sauve");
SV.beforeUpdate(S1, null); assert.strictEqual(mem["test-save-version"], "9.9.9");
mem["test-save"] = "illisible";
const r = SV.load(); assert.ok(r.state && r.restored, "partie illisible : la copie doit prendre le relais");
SV.remove(); assert.strictEqual(SV.read(), null);
const tr = SV.load(E.serialize(S1)); assert.ok(tr.transferred && tr.state, "reprise depuis l'ancienne adresse");
console.log("ok - sauvegarde (écriture, copies, partie illisible, reprise)");
