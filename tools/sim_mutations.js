/* Mutation de la semaine (Monocompte, js/monoplus.js) : chaque règle doit garder les cibles du Monocompte à ± 0,5 stasis
   (aucune puissance en plus). Lance tools/sim_mono.js sans mutation puis avec chaque mutation imposée aux stasis 7 et plus,
   et compare la stasis « fine » moyenne (stasis réussie + part de victoires à la suivante) par profil d'équipement.
   Usage : node tools/sim_mutations.js [--essais 3] [--classes iop,cra] [--profils bon,optimise] [--seules seve,miroir] [--json]
   Par défaut : les 6 classes et les donjons de tools/sim_mono.js, 3 essais, profils « bon » et « optimisé » (le profil sans
   équipement ne monte jamais en stasis 7, la mutation ne le touche pas). Les simulations tournent 4 par 4. */
"use strict";
const { execFile } = require("child_process");
const path = require("path");
const E = require("../js/engine.js"); require("../js/mono.js"); require("../js/monoplus.js");
const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def; };
const PROF = arg("profils", "bon,optimise"), ESS = arg("essais", "3"), CLS = arg("classes", ""), ONLY = arg("seules", "");
const ids = ["aucune"].concat(E.MONO.mut.list.map((m) => m.id).filter((id) => !ONLY || ONLY.split(",").includes(id)));
const run = (id) => new Promise((ok, ko) => {
  const a = [path.join(__dirname, "sim_mono.js"), "--profils", PROF, "--essais", ESS, "--json", "--mutation", id].concat(CLS ? ["--classes", CLS] : []);
  execFile(process.execPath, a, { maxBuffer: 64 << 20 }, (e, out) => { if (e) return ko(e); try { ok(JSON.parse(out.slice(out.indexOf("{")))); } catch (x) { ko(x); } });
});
const mean = (R, p) => { const v = R.results.map((r) => r.fine[p]); return v.reduce((a, b) => a + b, 0) / v.length; };
(async () => {
  const res = {}; let q = ids.slice();
  await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) { const id = q.shift(); res[id] = await run(id); } }));
  const profs = PROF.split(","); const base = {}; profs.forEach((p) => (base[p] = mean(res.aucune, p)));
  const out = { base, mut: {} }; let bad = 0;
  console.log(`Sans mutation : ${profs.map((p) => `${p} ${base[p].toFixed(2)}`).join(" · ")}`);
  ids.slice(1).forEach((id) => {
    const o = (out.mut[id] = {}); let ok = true;
    profs.forEach((p) => { const m = mean(res[id], p); o[p] = { m: +m.toFixed(2), d: +(m - base[p]).toFixed(2) }; if (Math.abs(m - base[p]) > 0.5) ok = false; });
    o.ok = ok; if (!ok) bad++;
    console.log(`${E.MONO.mut.byId[id].n.padEnd(18)} ${profs.map((p) => `${p} ${o[p].m.toFixed(2)} (${o[p].d >= 0 ? "+" : ""}${o[p].d.toFixed(2)})`).join(" · ")}  ${ok ? "ok" : "HORS CIBLE"}`);
  });
  if (process.argv.includes("--json")) console.log(JSON.stringify(out));
  console.log(bad ? `\n${bad} mutation(s) hors de ± 0,5 stasis.` : "\nToutes les mutations gardent les cibles à ± 0,5 stasis.");
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
