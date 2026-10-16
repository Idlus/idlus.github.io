/* Simulateur des challenges : pour chaque challenge, une équipe le suit (option « Respecter les challenges ») dans toutes
   les salles d'un donjon, et on compare la part de donjons gagnés avec la même équipe qui ignore les challenges.
   Usage : node tools/chal_sim.js [--profil bon|debutant|optimise] [--stasis 5,6] [--essais 2] [--donjons id1,id2] [--challs focus,elitiste] */
"use strict";
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/idols.js"); require("../js/renaissance.js");
require("../js/identite.js"); require("../js/identmon.js"); require("../js/identboss.js"); require("../js/maitrise_moteur.js");
const D = require("../js/data.js");
const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def; };
if (process.argv.includes("--sansabandon")) E.CHAL_GIVEUP = 0; if (arg("seuil", "")) E.CHAL_GIVEUP = +arg("seuil"); if (arg("seuilcible", "")) E.CHAL_GIVEUP_TGT = +arg("seuilcible"); // comportement d'avant la 2.1.13 : l'IA suit le challenge jusqu'au bout
let seed = +arg("graine", 1);
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.dungeonUnlocked = () => true; E.weekly = () => null; E.flash = () => [];
const PROF = arg("profil", "bon"), TRIES = +arg("essais", 2), KS = arg("stasis", "4,6").split(",").map(Number);
const PARTNERS = ["eni", "feca", "cra", "sacri", "iop"]; const CLS = ["iop", "cra", "eni", "sram", "osa", "zobal"];
const teamFor = (cls) => [cls, ...PARTNERS.filter((x) => x !== cls)].slice(0, 4);
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += ((a + b) / 2) * (k === main ? 1 : W[k] || 0); } return s; };
const memo = {}; const bestFor = (slot, lvl, main) => memo[slot + lvl + main] || (memo[slot + lvl + main] = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === slot && D.ITEMS[id].lvl <= lvl).sort((x, y) => score(D.ITEMS[y], main) - score(D.ITEMS[x], main)));
const give = (S, c, tpl, slot, perfect) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = perfect ? b : Math.round((a + b) / 2); } E.equip(S, c.id, it.uid, slot); };
const gearUp = (S, c) => { if (typeof c !== "object") return; const main = D.CLASSES[c.cls].main;
  if (PROF === "debutant") { for (const slot of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes"]) { const t = bestFor(slot, Math.max(1, c.lvl - 8), main)[0]; if (t) give(S, c, t, slot, false); } return; }
  const perfect = PROF === "optimise"; for (const slot of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"]) { const t = bestFor(slot, c.lvl, main)[0]; if (t) give(S, c, t, slot, perfect); }
  const r = bestFor("anneau", c.lvl, main); if (r[0]) give(S, c, r[0], "anneau1", perfect); if (r[1]) give(S, c, r[1], "anneau2", perfect); };
const DG = D.DUNGEONS; const byLvl = {}; for (const id in DG) if (!byLvl[DG[id].lvl]) byLvl[DG[id].lvl] = id;
const DUNS = arg("donjons", "") ? arg("donjons").split(",") : Object.values(byLvl).filter((_, i) => i % 3 === 0);
/* chaque combat reçoit le challenge testé, comme s'il était tiré au sort */
let FORCE = null, WON = 0, KEPT = 0; E.emit = (S, type, d) => { if (type === "win" && FORCE) { WON++; if ((d.chals || []).includes(FORCE)) KEPT++; } }; const sf = E.startFight; E.startFight = (S) => { const F = sf(S); if (F && FORCE) F.chals = E.fixedChals(F, [FORCE]); return F; };
const run = (did, k, cls, ch) => {
  const dg = DG[did]; const S = E.newState("Sim", "iop"); S.chars = [];
  teamFor(cls).forEach((x, i) => { const c = E.addChar(S, x, "H" + i, Math.max(1, dg.lvl)); c.inTeam = true; });
  S.chars.forEach((c) => gearUp(S, c)); S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c)));
  const SI = E.stasisInfo(S, did); SI.max = k - 1; S.res[dg.key] = 1;
  S.settings.chalAI = !!ch && ch !== "-"; if (ch) S.settings.chalNo = undefined;
  const err = E.enterDungeon(S, did, k); if (err) throw new Error(err);
  FORCE = ch;
  let lastF = null;
  for (let t = 0; S.dungeon && t < 3 * 3600 * 1000; t += 1000) { E.tick(S, 1000); if (S.fight) lastF = S.fight; }
  if (process.env.DIAG && SI.max < k && lastF) console.log(`--- perdu ${did} ${cls} salle ${lastF.bossIdx !== undefined ? "boss" : "?"} tour ${lastF.round} abandon ${!!lastF.chalGive}\n` + lastF.log.slice(-8).map((l) => "   " + l.txt).join("\n"));
  return { win: SI.max >= k };
};
/* --chasse 60,120 : une heure de chasse au niveau donné, victoires par heure et part de défaites, par challenge suivi */
if (arg("chasse", "")) {
  E.subUnlocked = () => true; const CHH = arg("challs", "") ? arg("challs").split(",") : Object.keys(E.CHALLENGES);
  for (const L of arg("chasse").split(",").map(Number)) {
    const subs = Object.keys(E.SUBS).filter((k) => E.SUBS[k].lvl && Math.abs((E.SUBS[k].lvl[0] + E.SUBS[k].lvl[1]) / 2 - L) <= 6).slice(0, 3);
    console.log(`Chasse niv. ${L}, ${PROF}, ${subs.length} zones × ${CLS.length} équipes × ${TRIES} essais (1 h)`);
    for (const ch of [null, ...CHH]) { let win = 0, lose = 0, n = 0; WON = KEPT = 0; FORCE = ch;
      for (const sid of subs) for (const cls of CLS) for (let i = 0; i < TRIES; i++) { n++;
        const S = E.newState("Sim", "iop"); S.chars = []; teamFor(cls).forEach((x, j) => { const c = E.addChar(S, x, "H" + j, L); c.inTeam = true; });
        S.chars.forEach((c) => gearUp(S, c)); S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c))); S.settings.chalAI = !!ch;
        E.startHunt(S, sid); let last = null;
        for (let t = 0; t < 3600 * 1000; t += 1000) { E.tick(S, 1000); const F = S.fight; if (F && F.over && F !== last) { last = F; F.result === "win" ? win++ : lose++; } } }
      console.log(`  ${(ch || "sans (ignore)").padEnd(14)} ${(win / n).toFixed(1).padStart(5)} victoires/h · ${(100 * lose / Math.max(1, win + lose)).toFixed(1)} % de défaites${ch ? ` · challenge réussi dans ${WON ? Math.round(100 * KEPT / WON) : 0} % des victoires` : ""}`); }
  }
  process.exit(0);
}
const CH = arg("challs", "") ? arg("challs").split(",") : Object.keys(E.CHALLENGES);
for (const k of KS) {
  const res = {}; const rows = [["sans (ignore)", null], ...CH.map((c) => [c, c])];
  for (const [nm, ch] of rows) { let w = 0, n = 0; WON = KEPT = 0; for (const did of DUNS) for (const cls of CLS) for (let i = 0; i < TRIES; i++) { n++; if (run(did, k, cls, ch).win) w++; } res[nm] = [w, n, WON ? Math.round(100 * KEPT / WON) : 0]; }
  const base = res["sans (ignore)"][0] / res["sans (ignore)"][1];
  console.log(`Stasis ${k}, ${PROF}, ${DUNS.length} donjons × ${CLS.length} équipes × ${TRIES} essais`);
  for (const nm in res) { const p = res[nm][0] / res[nm][1]; console.log(`  ${nm.padEnd(14)} ${String(Math.round(100 * p)).padStart(3)} % de donjons gagnés${nm.startsWith("sans") ? "" : `  (${p >= base ? "+" : ""}${Math.round(100 * (p - base))}) · challenge réussi dans ${res[nm][2]} % des combats gagnés`}`); }
}
