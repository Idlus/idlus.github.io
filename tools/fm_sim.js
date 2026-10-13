/* Simulation de la forgemagie 0.1.41 (trois issues, reliquat, over 101).
   Lancer : node tools/fm_sim.js [niveau] [essais]
   Stratégie d'un joueur : monter chaque caractéristique vers son jet max (rune la plus grosse qui ne dépasse pas),
   puis tenter l'over sur la caractéristique principale ; on mesure les runes dépensées et le poids final. */
"use strict";
const E = require("../js/engine.js"); require("../js/systems.js");
const { ITEMS, STATS } = require("../js/data.js");
const lvl = +process.argv[2] || 150; const N = +process.argv[3] || 300;
let seed = 99; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
const tpls = Object.keys(ITEMS).filter((k) => { const T = ITEMS[k]; return Math.abs(T.lvl - lvl) <= 10 && !T.trophy && T.slot !== "dofus" && Object.keys(T.stats).length >= 3; });
const S = E.newState("Sim", "iop"); E.fmJobs(S).old = 1;
const res = { perfect: 0, runesP: [], wP: [], wOver: [], runesTot: [], kinds: { sc: 0, sn: 0, ec: 0 } };
for (let n = 0; n < N; n++) {
  const tpl = tpls[n % tpls.length]; const T = ITEMS[tpl];
  const it = E.rollItem(S, tpl, { radiant: false });
  S.items[it.uid] = it; let used = 0; let gotP = false;
  const main = Object.keys(T.stats).filter((k) => T.stats[k][1] > 0 && !E.EXO_STATS.includes(k) && STATS[k].w <= 6).sort((a, b) => T.stats[b][1] * STATS[b].w - T.stats[a][1] * STATS[a].w)[0];
  for (let step = 0; step < 400; step++) {
    let k = null, key = null;
    const below = Object.keys(T.stats).filter((s) => STATS[s] && T.stats[s][1] > 0 && (it.stats[s] || 0) < T.stats[s][1] && !E.EXO_STATS.includes(s)).sort((a, b) => (it.stats[a] || 0) / T.stats[a][1] - (it.stats[b] || 0) / T.stats[b][1]);
    if (below.length) { k = below[0]; const gap = T.stats[k][1] - (it.stats[k] || 0);
      key = ["ra", "pa", ""].map((t) => E.runeKey(t, k)).find((rk) => E.runeInfo(rk).pts <= gap && (!E.RUNE_SIMPLE_ONLY || true)) || E.runeKey("", k); }
    else { if (!gotP) { gotP = true; res.perfect++; res.runesP.push(used); res.wP.push(E.fmWeights(it).load); } if (used > 250) break;
      k = Object.keys(T.stats).filter((s) => STATS[s] && T.stats[s][1] > 0 && !E.EXO_STATS.includes(s) && (it.stats[s] || 0) + STATS[s].pts <= E.fmCap(T, s)).sort((a, b) => (E.fmCap(T, b) - (it.stats[b] || 0)) * STATS[b].w - (E.fmCap(T, a) - (it.stats[a] || 0)) * STATS[a].w)[0];
      if (!k) break; key = E.runeKey("", k); }
    if (require("../js/data.js").RUNE_SIMPLE_ONLY.includes(k)) key = E.runeKey("", k);
    S.runes[key] = 5; const f = E.fmInfo(S, it.uid, key); if (!f || !f.ok) { if (gotP || !below.length) break; else continue; }
    const r = E.forgemage(S, it.uid, key); used++; res.kinds[r.kind]++;
  }
  res.wOver.push(E.fmWeights(it).load); res.runesTot.push(used); delete S.items[it.uid];
}
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; const pc = (x) => Math.round(x * 1000) / 10;
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
const K = res.kinds; const tot = K.sc + K.sn + K.ec;
console.log(`niveau ${lvl} · ${N} objets (${tpls.length} modèles)`);
console.log(`jet max partout atteint : ${pc(res.perfect / N)} % · runes pour y arriver : moyenne ${avg(res.runesP).toFixed(0)}, médiane ${med(res.runesP)}`);
console.log(`poids au jet max : ${pc(avg(res.wP))} % · poids final après ~250 runes d'over : ${pc(avg(res.wOver))} % (médiane ${pc(med(res.wOver))} %)`);
console.log(`issues : SC ${pc(K.sc / tot)} % · SN ${pc(K.sn / tot)} % · EC ${pc(K.ec / tot)} %`);
