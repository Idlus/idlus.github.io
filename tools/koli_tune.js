/* Kolizéum : règle E.KOLI_POW (puissance par classe) par simulation, jusqu'à ~50 % de victoires pour chaque classe.
   Lancer : node tools/koli_tune.js [tours=5] [combats=1200] → affiche la table à coller dans js/engine.js */
"use strict";
global.window = global;
for (const f of ["gamedata", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "verify", "koli", "sram"]) require("../js/" + f + ".js");
const E = window.ENGINE; const { CLASSES } = window.DATA;
const IT = +process.argv[2] || 5, N = +process.argv[3] || 1200; const L = E.KOLI_LVLS;
const P = {}; Object.keys(CLASSES).forEach((c) => (P[c] = (E.KOLI_POW[c] || L.map(() => 1)).slice()));
const pools = L.map((lvl) => { const p = []; for (let i = 0; i < 150; i++) p.push(E.koliGhost(1000 * lvl + i, lvl)); return p; });
const rate = (li) => {
  const st = {}; Object.keys(CLASSES).forEach((c) => (st[c] = { w: 0, n: 0 })); const pool = pools[li];
  for (let i = 0; i < N; i++) { const a = pool[(i * 7) % pool.length], b = pool[(i * 13 + 5) % pool.length]; if (a === b) continue;
    const r = E.koliSim(a, b, (i * 2654435761) >>> 0);
    a.forEach((h) => { st[h.cls].n++; if (r.win) st[h.cls].w++; }); b.forEach((h) => { st[h.cls].n++; if (!r.win) st[h.cls].w++; }); }
  return Object.fromEntries(Object.entries(st).map(([c, x]) => [c, x.n ? x.w / x.n : 0.5]));
};
let last;
for (let it = 0; it <= IT; it++) {
  E.KOLI_POW = P; const R = L.map((_, li) => rate(li)); last = R;
  const spread = L.map((_, li) => { const v = Object.values(R[li]); return `${L[li]}: ${Math.round(Math.min(...v) * 100)}-${Math.round(Math.max(...v) * 100)} %`; });
  console.error(`tour ${it} : ${spread.join(" · ")}`);
  if (it === IT) break;
  Object.keys(CLASSES).forEach((c) => L.forEach((_, li) => { P[c][li] = Math.max(0.25, Math.min(2.5, P[c][li] * Math.pow(0.5 / Math.max(0.05, R[li][c]), 0.7))); }));
}
console.log("E.KOLI_POW = " + JSON.stringify(Object.fromEntries(Object.entries(P).map(([c, t]) => [c, t.map((x) => Math.round(x * 100) / 100)]))) + ";");
console.log(Object.keys(CLASSES).map((c) => CLASSES[c].name.padEnd(12) + L.map((_, li) => String(Math.round(last[li][c] * 100)).padStart(5)).join("")).join("\n"));
