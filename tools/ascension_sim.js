/* L'Ascension : équilibrage par simulation (montées en auto, blessures gardées entre les tentatives).
   Lancer : node tools/ascension_sim.js [joueurs=40] [mode=n] [montées=30] */
"use strict";
const E = require("../js/engine.js");
["systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "legendaires", "songe", "ascension"].forEach((f) => require("../js/" + f + ".js"));
const N = +(process.argv[2] || 40), MODE = process.argv[3] || "n", RUNS = +(process.argv[4] || 30);
(process.env.ASC || "").split(",").filter(Boolean).forEach((kv) => { const [k, v] = kv.split("="); if (k.startsWith("d.")) E.ASC_DIFF.d[k.slice(2)] = E.ASC_DIFF.x[k.slice(2)] = +v; else E.ASC[k] = +v; });
let seed = 99; E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const first = [], reach = [], tops = [], deaths = {};
const t0 = Date.now();
for (let p = 0; p < N; p++) {
  const S = E.newState("Sim" + p, "iop"); const A = E.ascState(S); A.vol = 1e9; A.runs = p * 1000;
  if (MODE !== "n") A.best.n = 100;
  let got = 0;
  for (let r = 0; r < RUNS; r++) {
    const cl = E.ascClassChoices(S); if (E.ascStart(S, MODE, cl[0])) break; A.prio = ["dmg", "heal", "ctrl", "cls"][r % 4];
    for (let i = 0; i < 2000 && A.run; i++) { const o = E.ascStepFloor(S, true); if (o && o.dead) { const f = A.run ? 0 : A.last.top + 1; deaths[f] = (deaths[f] || 0) + 1; } }
    const top = A.last.top; tops.push(top); if (r === 0) first.push(top);
    // les Fragments servent : débloquer ce qui est à portée
    let u; while ((u = E.ascUnlocks(S).filter((x) => x.price <= A.frag).sort((a, b) => a.price - b.price)[0])) E.ascUnlock(S, u.id);
    if (top >= (MODE === "x" ? 120 : 100) && !got) { got = r + 1; }
  }
  reach.push(got || RUNS + 1);
}
const dz = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, n]) => `${f}:${n}`).join(" ");
console.log(`mode ${MODE} · ${N} joueurs × ${RUNS} montées · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`1re montée : médiane ${q(first, 0.5)}, 10 % ${q(first, 0.1)}, 90 % ${q(first, 0.9)}`);
console.log(`toutes : médiane ${q(tops, 0.5)}, 90 % ${q(tops, 0.9)}`);
console.log(`montées pour finir : médiane ${q(reach, 0.5)}, 25 % ${q(reach, 0.25)}, 75 % ${q(reach, 0.75)} (${RUNS + 1} = pas fini)`);
console.log(`étages de mort les plus fréquents : ${dz}`);
