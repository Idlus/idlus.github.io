/* Calibrage du Boss des mondes (0.1.49) : fait jouer chaque boss de la rotation par des équipes bien équipées
   (niveaux 60, 120 et 200, quatre classes, phase 1) et écrit dans js/wboss.js la table E.WB_POW :
   multiplicateur de points pour viser 300 points (grade S) par essai.
   Usage : node tools/wboss_calib.js [--print] */
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); ["pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "koli", "wboss"].forEach((f) => require(`../js/${f}.js`));
const D = require("../js/data.js");
E.weekly = () => null; E.flash = () => [];
const TARGET = 300;
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += ((a + b) / 2) * (k === main ? 1 : W[k] || 0); } return s; };
const memo = {};
const best = (slot, lvl, main) => memo[slot + lvl + main] || (memo[slot + lvl + main] = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === slot && D.ITEMS[id].lvl <= lvl).sort((x, y) => score(D.ITEMS[y], main) - score(D.ITEMS[x], main)));
const give = (S, c, tpl, slot) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = Math.round((a + b) / 2); } E.equip(S, c.id, it.uid, slot); };
const team = (cls, lvl) => {
  const S = E.newState("Sim", "iop"); S.chars = [];
  [cls, "eni", "feca", "sacri"].forEach((x, i) => { const c = E.addChar(S, x, "H" + i, lvl); c.inTeam = true; });
  S.chars.forEach((c) => { const m = D.CLASSES[c.cls].main;
    for (const s of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"]) { const t = best(s, c.lvl, m)[0]; if (t) give(S, c, t, s); }
    const r = best("anneau", c.lvl, m); if (r[0]) give(S, c, r[0], "anneau1"); if (r[1]) give(S, c, r[1], "anneau2");
    E.refreshSpells(c, E.charStats(S, c)); });
  return S;
};
const POW = {}; const rows = [];
for (let n = 1; n <= E.WB_ROT.length; n++) {
  const def = Object.assign(E.wbDef(n), { pow: 1 }); const pts = [];
  for (const lvl of [60, 120, 200]) for (const cls of ["iop", "cra", "sram", "osa"]) { const r = E.wbSim(team(cls, lvl), def, 1, 1000 + pts.length); pts.push(r.raw || 0); }
  pts.sort((a, b) => a - b); const med = Math.max(1, (pts[5] + pts[6]) / 2);
  rows.push(`${def.name.padEnd(20)} ${pts.join(" ").padEnd(50)} médiane ${String(Math.round(med)).padStart(5)} x${(TARGET / med).toFixed(2)}`);
  POW[def.key] = +(TARGET / med).toFixed(2);
}
console.log(rows.join("\n"));
if (!process.argv.includes("--print")) {
  const f = path.join(__dirname, "../js/wboss.js"); const src = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, src.replace(/\/\*WB_POW\*\/[\s\S]*?\/\*\/WB_POW\*\//, `/*WB_POW*/${JSON.stringify(POW)}/*/WB_POW*/`));
  console.log("js/wboss.js mis à jour");
}
