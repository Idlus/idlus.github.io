/* Simulateur du Défi du jour (refonte 1.1) : des équipes équipées jouent N jours de défi par palier
   et on regarde victoires, règles tenues, score et bourses (bronze / argent / or).
   Usage : node tools/defi_sim.js [--jours 21] [--profil bon|optimise] [--taille 3] */
"use strict";
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js");
const D = require("../js/data.js");
const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : def; };
const REN = +arg("renaissance", 0), ONLY = arg("paliers", ""), K = arg("stasis", ""), NM = arg("mods", "");
const DAYS = +arg("jours", 21), PROF = arg("profil", "bon"), SIZE = +arg("taille", 4);
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const sc = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += ((a + b) / 2) * (k === main ? 1 : W[k] || 0); } return s; };
const memo = {};
const bestFor = (slot, lvl, main) => memo[slot + lvl + main] || (memo[slot + lvl + main] = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === slot && D.ITEMS[id].lvl <= lvl && (slot === "dofus" || !D.ITEMS[id].dofus)).sort((x, y) => sc(D.ITEMS[y], main) - sc(D.ITEMS[x], main)));
const give = (S, c, tpl, slot, perfect) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = perfect ? b : Math.round((a + b) / 2); } E.equip(S, c.id, it.uid, slot); };
const gear = (S, c) => { const main = D.CLASSES[c.cls].main, perfect = PROF === "optimise";
  for (const slot of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"]) { const t = bestFor(slot, c.lvl, main)[0]; if (t) give(S, c, t, slot, perfect); }
  const r = bestFor("anneau", c.lvl, main); if (r[0]) give(S, c, r[0], "anneau1", perfect); if (r[1]) give(S, c, r[1], "anneau2", perfect);
  if (perfect) { bestFor("dofus", c.lvl, main).slice(0, D.DOFUS_SLOTS.length).forEach((t, i) => give(S, c, t, D.DOFUS_SLOTS[i], true)); c.scrolls = { vit: 100, sa: 100, [main]: 100 }; }
  if (REN && c.lvl >= 200) { c.ren = REN; } };
const POOLS = [["iop", "eni", "feca", "cra", "sacri"], ["sram", "osa", "eni", "xelor", "panda"], ["cra", "sadi", "feca", "zobal", "iop"]];
const LV = { dec: 55, ave: 125, leg: 190, eli: 200 };
const t0 = Date.UTC(2030, 2, 4, 12, 0);
for (const T of E.DEFI_TIERS.filter((x) => !ONLY || ONLY.split(",").includes(x.id))) {
  const st = { n: 0, win: 0, rules: 0, nr: 0, score: [], med: [0, 0, 0, 0], perRule: {}, sun: [] };
  for (let d = 0; d < DAYS; d++) for (const pool of POOLS) {
    const t = t0 + d * 86400000; E.setClock(() => t); const def = E.defi(T.id, E.defiDay(t));
    if (process.argv.includes("--sansregles")) def.rules = [];
    if (K) def.k = +K; if (NM) def.mods = def.mods.slice(0, +NM);
    const R = E.DEFI_TEAM[def.team];
    let cls = pool.filter((c) => (def.team !== "noeni" || c !== "eni") && (def.team !== "noiop" || c !== "iop")).slice(0, def.team === "max3" ? Math.min(3, SIZE) : SIZE);
    const S = E.newState("Sim", cls[0]); S.chars = []; cls.forEach((x, i) => { const c = E.addChar(S, x, "H" + i, LV[T.id]); c.inTeam = true; });
    S.chars.forEach((c) => gear(S, c)); S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c)));
    if (!R.ok(E.team(S))) throw new Error("équipe hors règle " + def.team);
    const r = E.defiSim(S, def, t); st.n++;
    if (r.win) st.win++;
    for (const id in r.rules) { const p = st.perRule[id] = st.perRule[id] || [0, 0]; p[1]++; if (r.rules[id]) { p[0]++; st.rules++; } st.nr++; }
    if (r.win) st.score.push(r.score); if (def.sun) st.sun.push(r.win ? r.score : 0);
    const M = E.defiMedal(r.score); st.med[M ? E.DEFI_MEDALS.indexOf(M) + 1 : 0]++;
  }
  const s = st.score.sort((a, b) => a - b); const q = (p) => s.length ? s[Math.floor((s.length - 1) * p)] : 0;
  console.log(`${T.name} (niv. ${LV[T.id]}, ${PROF}, ${SIZE} héros) : ${st.win}/${st.n} victoires · règles tenues ${Math.round(100 * st.rules / Math.max(1, st.nr))} %`);
  console.log(`  score des victoires : min ${q(0)} · médiane ${q(0.5)} · 90 % ${q(0.9)} · max ${q(1)}`);
  console.log(`  bourses : rien ${st.med[0]} · bronze ${st.med[1]} · argent ${st.med[2]} · or ${st.med[3]}${st.sun.length ? ` · dimanches ${st.sun.join(", ")}` : ""}`);
  console.log("  par règle : " + Object.entries(st.perRule).map(([k, p]) => `${k} ${p[0]}/${p[1]}`).join(", "));
}
