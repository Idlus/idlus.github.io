/* audit 19/10/2026 (choix 1A + 2C) : le calcul de l'absence par tranches (E.catchUpAsync) donne exactement la même partie et le même
   compte rendu que le calcul d'un bloc (E.catchUp), avec les mêmes tirages, pour plusieurs durées ; la collection de panoplies suit
   l'Encyclopédie sans la recompter. Lancer : node tests/absence.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/chroma.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/legendaires.js"); require("../js/dofusp.js");
require("../js/collections.js"); require("../js/songe.js"); require("../js/expeditions.js"); require("../js/suivi.js"); require("../js/vie.js");

const T0 = Date.UTC(2030, 0, 8, 10, 0); let t = T0; E.setClock(() => t);
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
E.setRng(rng(7));
const S0 = E.newState("Absence", "iop"); S0.chars[0].lvl = 120;
["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S0, k, "H" + i, 120).inTeam = true; });
Object.values(E.SUBS).forEach((s) => (S0.progress.wins[s.id] = 20));
E.startHunt(S0, Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] >= 100 && E.SUBS[k].monsters && E.SUBS[k].monsters.length));
S0.stats.recent = Array.from({ length: 20 }, (_, i) => ({ d: 2 + (i % 3), w: i % 6 ? 1 : 0 }));
const base = E.serialize(S0);

const once = (h, seed, async) => {
  E.setRng(rng(seed)); t = T0; const S = E.deserialize(base); S.lastTick = T0 - h * 3600e3;
  if (!async) { const r = E.catchUp(S, h * 3600); return Promise.resolve({ st: E.serialize(S), r: JSON.stringify(r), steps: 0 }); }
  let steps = 0; return E.catchUpAsync(S, h * 3600, (p) => { steps++; assert.ok(p.i > 0 && p.i <= p.n, "progression"); }, 1).then((r) => ({ st: E.serialize(S), r: JSON.stringify(r), steps }));
};
(async () => {
  for (const h of [0.5, 1, 8, 24]) for (const seed of [1, 2]) {
    const a = await once(h, seed, false), b = await once(h, seed, true);
    assert.strictEqual(b.st, a.st, `même partie après ${h} h (graine ${seed})`);
    assert.strictEqual(b.r, a.r, `même compte rendu après ${h} h (graine ${seed})`);
    if (h >= 8) assert.ok(b.steps > 10, "le calcul rend la main plusieurs fois");
  }
  assert.ok(!E.offBusy, "plus de calcul en cours à la fin");
  // collection de panoplies : la version de l'Encyclopédie suit chaque modèle nouveau, la collection est recalculée seulement alors
  const S = E.deserialize(base); const C1 = E.collState(S); assert.strictEqual(E.collState(S), C1, "même collection tant que rien ne change");
  const tpl = Object.keys(E.ITEMS || require("../js/data.js").ITEMS).find((k) => !E.itemDex(S)[k] && (E.ITEMS || require("../js/data.js").ITEMS)[k].set);
  const v0 = E.dexVer(E.itemDex(S)); E.itemDexAdd(S, tpl); assert.strictEqual(E.dexVer(E.itemDex(S)), v0 + 1, "nouveau modèle : version +1");
  E.itemDexAdd(S, tpl); assert.strictEqual(E.dexVer(E.itemDex(S)), v0 + 1, "modèle déjà vu : version inchangée");
  assert.strictEqual(E.collState(S).nDex, Object.keys(E.itemDex(S)).length, "la collection voit le nouveau modèle");
  console.log("absence.test : OK");
})().catch((e) => { console.error(e); process.exit(1); });
