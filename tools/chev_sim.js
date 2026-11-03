/* Simulateur de la Chevauchée des Cavaliers (Saison 1, lot 8) : équipes de 8 héros niveau 200, « bon » ou « optimise »,
   4 Cavaliers à la suite par stasis. Usage : node tools/chev_sim.js [--profil bon|optimise] [--taille 8] */
"use strict";
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/maitrise_moteur.js"); require("../js/quetes.js"); require("../js/mono.js"); require("../js/saisonc.js"); require("../js/cartes.js"); require("../js/chevauchee.js");
const D = require("../js/data.js");
const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : def; };
const REN = +arg("renaissance", 0), ONLY = arg("paliers", ""), K = arg("stasis", ""), NM = arg("mods", "");
const DAYS = 0, PROF = arg("profil", "bon"), SIZE = +arg("taille", 4);
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
const POOL8 = ["iop", "eni", "feca", "cra", "sacri", "sram", "osa", "xelor"];
const t0 = Date.UTC(2030, 2, 4, 12, 0); E.setClock(() => t0);
for (const k of (arg("k", "1,3,5,7,10")).split(",").map(Number)) { let n = [0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) { const cls = POOL8.slice(0, SIZE); const S = E.newState("Sim", cls[0]); S.chars = []; cls.forEach((x, i) => { const c = E.addChar(S, x, "H" + i, 200); c.inTeam = true; });
    S.chars.forEach((c) => gear(S, c)); S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c))); E.s1cStart(S, t0);
    const r = E.chevSim(S, k, 1000 + s * 77); n[r.n]++; }
  console.log(`stasis ${k} : Cavaliers vaincus ${n.map((x, i) => i + "→" + x).join("  ")}`); }
