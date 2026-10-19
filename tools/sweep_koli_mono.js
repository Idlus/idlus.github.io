/* Monocompte : réglage du Kolizéum en 1 contre 1. Fantômes de niveau 200 (équipement tiré comme au Kolizéum), chaque classe
   contre chaque autre, plusieurs tirages ; on corrige le % de PV et de dégâts de chaque classe vers 50 % de victoires.
   node tools/sweep_koli_mono.js [tours=6] [tirages=3] */
const path = require("path"); const J = (f) => require(path.join(__dirname, "../js", f));
const E = J("engine.js"), D = J("data.js");
["systems.js", "pets.js", "mounts.js", "idols.js", "renaissance.js", "archis.js", "defi.js", "koli.js", "mono.js"].forEach(J);
E.KOLI.size = 1;
const ROUNDS = +process.argv[2] || 6, N = +process.argv[3] || 3, LVL = 200;
const cls = Object.keys(D.CLASSES); const pool = {}; cls.forEach((c) => (pool[c] = []));
for (let s = 1; cls.some((c) => pool[c].length < N) && s < 20000; s++) { const g = E.koliGhost(s * 7919 + (+process.env.OFF || 0), LVL, 1); if (pool[g[0].cls].length < N) pool[g[0].cls].push(g); }
const K = E.MONO.koli.cls; if (process.env.ZERO) Object.keys(K).forEach((c) => (K[c] = 0)); // ZERO=1 : repartir de 0
const run = () => { const w = {}; cls.forEach((c) => (w[c] = [0, 0]));
  cls.forEach((a, i) => cls.slice(i + 1).forEach((b) => { for (let k = 0; k < N; k++) for (const sw of [0, 1]) { const A = pool[a][k], B = pool[b][(k + 1) % N];
    const r = sw ? E.koliSim(B, A, 31 * k + 7) : E.koliSim(A, B, 31 * k + 7); const aw = sw ? !r.win : r.win; w[a][1]++; w[b][1]++; w[aw ? a : b][0]++; } }));
  return w; };
for (let r = 0; r <= ROUNDS; r++) { const w = run(); const rate = (c) => (100 * w[c][0]) / w[c][1];
  const spread = cls.map(rate); console.log(`tour ${r} : écart ${Math.round(Math.min(...spread))}-${Math.round(Math.max(...spread))} % · ` + cls.map((c) => `${c} ${Math.round(rate(c))}`).join(" "));
  if (r < ROUNDS) cls.forEach((c) => (K[c] = Math.max(-60, Math.min(150, Math.round((K[c] || 0) + (50 - rate(c)) * (r < 4 ? 0.6 : 0.3)))))); }
console.log("cls:", JSON.stringify(K));
