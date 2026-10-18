/* Monocompte : lance tools/sim_mono.js classe par classe (en parallèle) et résume la stasis moyenne par classe.
   Usage : node tools/sweep_mono.js [--donjons a,b] [--essais 2] [--profils aucun,optimise] (MONO / MONOCLS passent tels quels) */
"use strict";
const { execFile } = require("child_process");
const D = require("../js/data.js");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const DUN = arg("donjons", "cour_bouftou_royal,donjon_bworks,labo_brumen,caverne_koulosse,labyrinthe_minotoror,tertre_long_sommeil,poste_supervizoeuf,labo_nileza");
const TR = arg("essais", "2"), PR = arg("profils", "aucun,optimise");
const CLS = arg("classes", "") ? arg("classes").split(",") : D.CLASS_ORDER;
const PAR = +arg("par", 8);
const one = (cls) => new Promise((res) => execFile("node", [__dirname + "/sim_mono.js", "--classes", cls, "--donjons", DUN, "--essais", TR, "--profils", PR, "--json"], { maxBuffer: 1e8, env: process.env }, (e, out) => {
  if (e) return res({ cls, err: String(e).slice(0, 200) });
  const j = JSON.parse(out); const r = {}; PR.split(",").forEach((p) => { const v = j.results.map((x) => x.fine[p]); r[p] = { avg: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v), v }; }); res({ cls, r });
}));
(async () => {
  const out = []; const q = CLS.slice();
  await Promise.all(Array.from({ length: PAR }, async () => { while (q.length) { const c = q.shift(); out.push(await one(c)); } }));
  out.sort((a, b) => CLS.indexOf(a.cls) - CLS.indexOf(b.cls));
  const all = {};
  for (const o of out) { if (o.err) { console.log(o.cls, o.err); continue; }
    console.log(o.cls.padEnd(8) + PR.split(",").map((p) => { (all[p] = all[p] || []).push(o.r[p].avg); return `${p} ${o.r[p].avg.toFixed(2)} [${o.r[p].v.map((x) => x.toFixed(1)).join(" ")}]`; }).join("   ")); }
  console.log("MOYENNE " + Object.entries(all).map(([p, v]) => `${p} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} (écart ${Math.min(...v).toFixed(2)}–${Math.max(...v).toFixed(2)})`).join("   "));
})();
