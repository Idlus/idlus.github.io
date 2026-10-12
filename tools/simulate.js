/* Simulateur d'équilibrage : fait jouer des équipes de 4 héros dans les donjons, stasis par stasis,
   avec trois niveaux d'équipement, et vérifie les paliers voulus :
     - sans équipement : jusqu'à la stasis 4
     - bon équipement : stasis 6-7
     - équipe optimisée : stasis 10
   Usage : node tools/simulate.js [--taille 4] [--donjons id1,id2|tous] [--classes iop,cra|toutes] [--essais 3] [--graine 1] [--meubles] [--json]
   --meubles : place dans la Salle des trophées les 5 meilleurs trophées de PV des donjons de niveau inférieur ou égal.
   Par défaut : un donjon par tranche de niveau, 6 équipes, 3 essais par case. */
"use strict";
const E = require("../js/engine.js");
require("../js/systems.js");
const D = require("../js/data.js");

const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def; };
const flag = (k) => process.argv.includes("--" + k);
const TRIES = +arg("essais", 3), SEED = +arg("graine", 1), JSON_OUT = flag("json"), FURN = flag("meubles");

// aléatoire reproductible (mulberry32)
let seed = SEED;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.dungeonUnlocked = () => true; // on teste l'équilibrage, pas la progression

/* ---------- équipes ---------- */
const PARTNERS = ["eni", "feca", "cra", "sacri", "iop"];
const SIZE = +arg("taille", 4); // --taille 1|2|3|4 : nombre de héros dans l'équipe
const teamFor = (cls) => [cls, ...PARTNERS.filter((x) => x !== cls)].slice(0, SIZE);
const CLS = arg("classes", "") === "toutes" ? D.CLASS_ORDER : arg("classes", "") ? arg("classes").split(",") : ["iop", "cra", "eni", "sram", "osa", "zobal"];

/* ---------- donjons : par défaut, le premier de chaque tranche de niveau ---------- */
const DG = D.DUNGEONS;
const byLvl = {}; for (const id in DG) if (!byLvl[DG[id].lvl]) byLvl[DG[id].lvl] = id;
const DUNS = arg("donjons", "") === "tous" ? Object.keys(DG) : arg("donjons", "") ? arg("donjons").split(",") : Object.values(byLvl);

/* ---------- équipement ---------- */
const STAT_OF_EL = { t: "fo", n: "fo", f: "ine", e: "cha", a: "age" };
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; const v = (a + b) / 2; s += v * (k === main ? 1 : W[k] || 0); } return s; };
const byScore = {};
const bestFor = (slot, lvl, main) => {
  const key = slot + lvl + main; if (byScore[key]) return byScore[key];
  return (byScore[key] = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === slot && D.ITEMS[id].lvl <= lvl).sort((x, y) => score(D.ITEMS[y], main) - score(D.ITEMS[x], main)));
};
const give = (S, c, tpl, slot, perfect) => {
  const it = E.rollItem(S, tpl, { radiant: false });
  for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = perfect ? b : Math.round((a + b) / 2); }
  return E.equip(S, c.id, it.uid, slot);
};
const gearUp = (S, c, prof) => {
  if (prof === "aucun") return;
  const main = D.CLASSES[c.cls].main, perfect = prof === "optimise";
  for (const slot of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"]) { const t = bestFor(slot, c.lvl, main)[0]; if (t) give(S, c, t, slot, perfect); }
  const rings = bestFor("anneau", c.lvl, main); if (rings[0]) give(S, c, rings[0], "anneau1", perfect); if (rings[1]) give(S, c, rings[1], "anneau2", perfect);
  if (perfect) {
    bestFor("dofus", c.lvl, main).slice(0, D.DOFUS_SLOTS.length).forEach((t, i) => give(S, c, t, D.DOFUS_SLOTS[i], true));
    c.scrolls = { vit: 100, sa: 100, [main]: 100 };
  }
};

/* ---------- une tentative de donjon ---------- */
function run(did, k, cls, prof) {
  const dg = DG[did], lvl = Math.max(1, dg.lvl);
  const S = E.newState("Sim", "iop"); S.chars = [];
  teamFor(cls).forEach((x, i) => { const c = E.addChar(S, x, "H" + i, lvl); c.inTeam = true; });
  S.chars.forEach((c) => { gearUp(S, c, prof); E.refreshSpells(c, E.charStats(S, c)); });
  if (FURN) {
    const hp = Object.keys(E.FURN).filter((n) => E.FURN[n].kind === "hp" && E.FURN[n].trophy && DG[E.FURN[n].trophy].lvl <= dg.lvl).sort((a, b) => E.FURN[b].v - E.FURN[a].v).slice(0, 5);
    S.havre.drop = 40; hp.forEach((n) => { S.furniture.push(n); E.placeFurn(S, n); });
  }
  const SI = E.stasisInfo(S, did); SI.max = k - 1; S.res[dg.key] = 1;
  const err = E.enterDungeon(S, did, k); if (err) throw new Error(`${did} stasis ${k} : ${err}`);
  for (let t = 0; S.dungeon && t < 3 * 3600 * 1000; t += 1000) E.tick(S, 1000);
  return SI.max >= k;
}

/* ---------- tableau ---------- */
const PROFS = [["aucun", "sans équipement", [4, 4]], ["bon", "bon équipement", [6, 7]], ["optimise", "équipe optimisée", [10, 10]]];
const results = [];
for (const did of DUNS) {
  const row = { did, name: DG[did].name, lvl: DG[did].lvl, prof: {} };
  for (const [p] of PROFS) {
    // stasis la plus haute réussie au moins une fois sur deux, en montant tant que ça passe
    let best = 0;
    for (let k = 1; k <= E.STASIS_MAX; k++) {
      let wins = 0, n = 0;
      for (const cls of CLS) for (let i = 0; i < TRIES; i++) { n++; if (run(did, k, cls, p)) wins++; }
      if (wins / n < 0.5) break;
      best = k;
    }
    row.prof[p] = best;
  }
  results.push(row);
  if (!JSON_OUT) console.log(`${row.name.padEnd(34)} niv. ${String(row.lvl).padStart(3)}  ` + PROFS.map(([p, , [lo, hi]]) => `${p.padEnd(8)} ${String(row.prof[p]).padStart(2)} ${row.prof[p] >= lo && row.prof[p] <= hi ? "ok" : row.prof[p] < lo ? "trop dur" : "trop facile"}`).join("   "));
}
if (JSON_OUT) console.log(JSON.stringify(results, null, 1));
else console.log(`\nStasis la plus haute réussie au moins 1 fois sur 2 (${CLS.length} équipes × ${TRIES} essais). Cibles : sans équipement 4, bon équipement 6-7, optimisé 10.`);
