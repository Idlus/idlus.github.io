/* Kolizéum : équilibre des classes en 3 contre 3 (0.1.44).
   Des équipes Fantômes au hasard (3 classes, même niveau, équipement correct) se battent ;
   on compte le taux de victoire de chaque classe, la durée des combats et la part des combats finis au temps.
   Lancer : node tools/koli_sim.js [combats par niveau=1500] [niveaux=50,100,150,200] */
"use strict";
global.window = global;
for (const f of ["gamedata", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "verify", "koli", "sram"]) require("../js/" + f + ".js");
const E = window.ENGINE; const { CLASSES } = window.DATA; if (process.env.NO_SRAM) E.SR2 = false;
const N = +process.argv[2] || 1500; const LVLS = (process.argv[3] || "50,100,150,200").split(",").map(Number);
const out = {};
for (const lvl of LVLS) {
  const st = {}; Object.keys(CLASSES).forEach((c) => (st[c] = { w: 0, n: 0 })); let rounds = 0, timeouts = 0;
  const pool = []; for (let i = 0; i < 120; i++) pool.push(E.koliGhost(1000 * lvl + i, lvl));
  for (let i = 0; i < N; i++) {
    const a = pool[(i * 7) % pool.length], b = pool[(i * 13 + 5) % pool.length]; if (a === b) continue;
    const r = E.koliSim(a, b, i * 2654435761 >>> 0); rounds += r.rounds; if (r.rounds >= E.KOLI.maxRound) timeouts++;
    a.forEach((h) => { st[h.cls].n++; if (r.win) st[h.cls].w++; }); b.forEach((h) => { st[h.cls].n++; if (!r.win) st[h.cls].w++; });
  }
  out[lvl] = Object.fromEntries(Object.entries(st).map(([c, x]) => [c, x.n ? Math.round((100 * x.w) / x.n) : null]));
  console.log(`niveau ${lvl} : ${(rounds / N).toFixed(1)} tours en moyenne, ${Math.round((100 * timeouts) / N)} % finis au temps`);
}
console.log("\ntaux de victoire par classe (%) :");
console.log("classe".padEnd(12) + LVLS.map((l) => String(l).padStart(6)).join(""));
Object.keys(CLASSES).forEach((c) => console.log(CLASSES[c].name.padEnd(12) + LVLS.map((l) => String(out[l][c]).padStart(6)).join("")));
