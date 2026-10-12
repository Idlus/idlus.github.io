/* Simulateur d'équilibrage : fait jouer des équipes de 4 héros dans les donjons, stasis par stasis,
   avec trois niveaux d'équipement, et vérifie les paliers voulus :
     - sans équipement : jusqu'à la stasis 4
     - bon équipement : stasis 6-7
     - équipe optimisée : stasis 10
   Usage : node tools/simulate.js [--taille 4] [--tactique moyen|plafond|tac|fui|pm|rpa|rpm|epa|epm|inv] [--profils bon] [--mutateur champions] [--exo pa|pm|po] [--donjons id1,id2|tous] [--classes iop,cra|toutes] [--essais 3] [--graine 1] [--meubles] [--idoles hebdo,dynamo|max] [--renaissance N] [--json]
   --meubles : place dans la Salle des trophées les 5 meilleurs trophées de PV des donjons de niveau inférieur ou égal.
   --tactique : donne aux héros des stats tactiques (Tacle, Fuite, PM, Retrait, Esquive, Invocation) :
     moyen = valeurs d'un héros avec un bon familier ; plafond = tout au maximum ; un nom de stat = cette stat seule, au maximum.
   --chasse niv1,niv2 : au lieu des donjons, une heure de chasse sans équipement dans une sous-zone de ce niveau (victoires/heure).
   Par défaut : un donjon par tranche de niveau, 6 équipes, 3 essais par case. */
"use strict";
const E = require("../js/engine.js");
require("../js/systems.js");
require("../js/pets.js"); require("../js/mounts.js"); require("../js/idols.js"); require("../js/renaissance.js");
const D = require("../js/data.js");

const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def; };
const flag = (k) => process.argv.includes("--" + k);
const TRIES = +arg("essais", 3), SEED = +arg("graine", 1), JSON_OUT = flag("json"), FURN = flag("meubles");

// aléatoire reproductible (mulberry32)
let seed = SEED;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.dungeonUnlocked = () => true; // on teste l'équilibrage, pas la progression
E.weekly = () => null; E.flash = () => []; // pas de mutateur imposé par la date (voir --mutateur)

/* ---------- équipes ---------- */
const PARTNERS = ["eni", "feca", "cra", "sacri", "iop"];
const MUT = arg("mutateur", ""); if (MUT && !E.STASIS_MODS[MUT]) throw new Error("Mutateur inconnu : " + MUT);
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

/* ---------- stats tactiques (essai 0.1) ---------- */
const TACT = arg("tactique", "");
const TACT_P = {
  moyen: { f: { tac: 32, pm: 3, rpa: 30, epa: 22 }, b: { fui: 48, epm: 30, rpm: 12, inv: 1 } },
  plafond: { f: { tac: 92, pm: 5, rpa: 50, rpm: 50, epa: 100, epm: 100, inv: 2 }, b: { fui: 60, rpa: 50, rpm: 50, epa: 100, epm: 100, inv: 2 } },
};
const CAP = { tac: 92, fui: 60, pm: 5, rpa: 50, rpm: 50, epa: 100, epm: 100, inv: 2 };
if (CAP[TACT]) TACT_P[TACT] = { f: { [TACT]: CAP[TACT] }, b: { [TACT]: CAP[TACT] } };
if (TACT && !TACT_P[TACT]) throw new Error("Profil tactique inconnu : " + TACT);
if (TACT) { E.tactLog = {}; const cs = E.charStats; E.charStats = (S, c, o) => { const st = cs(S, c, o); if (c._row) Object.assign(st, TACT_P[TACT][c._row]); return st; }; }
/* --familiers : chaque héros porte, adulte, le meilleur familier de son niveau pour son élément (montilier élémentaire dès 60) */
const FAM = flag("familiers");
/* --exo pa|pm|po : chaque héros porte un objet exo (0.1.9.2), sur son arme (ou sa coiffe) */
const EXO = arg("exo", "");
const giveExo = (S) => { if (!EXO || !["pa", "pm", "po"].includes(EXO)) return; S.chars.forEach((c) => { const uid = c.equip.arme || c.equip.coiffe; const it = uid && S.items[uid]; if (it) it.exo = EXO; }); };
const petFor = (c) => { const main = D.CLASSES[c.cls].main;
  const ok = Object.keys(E.PETS).filter((id) => { const p = E.PETS[id]; return p.kind !== "boss" && p.fam !== "l" && c.lvl >= E.petReqLvl(id) && p.lvl <= c.lvl && (p.stats[main] || p.stats.pui); });
  const val = (id) => { const st = E.PETS[id].stats; return (st[main] || 0) + (st.pui || 0) * 1.2 + (st.cri || 0) * 4; };
  return ok.sort((a, b) => val(b) - val(a))[0]; };
const givePets = (S) => { if (!FAM) return; S.chars.forEach((c) => { const id = petFor(c); if (!id) return; const uid = S.petUid++; S.pets[uid] = { uid, id, g: 100, t: 0 }; c.pet = uid; E.refreshSpells(c, E.charStats(S, c)); }); };
/* --montures dd|mu|vk : chaque héros monte, au niveau 100, la monture de son élément (ou la première couleur) de cette espèce */
const MNT = arg("montures", "");
const giveMounts = (S) => { if (!MNT || !E.MOUNTS[MNT]) return; S.enclos.built = true; S.chars.forEach((c) => { const main = D.CLASSES[c.cls].main; const cols = E.MOUNTS[MNT].cols;
  const col = Object.keys(cols).find((k) => cols[k].s[main]) || Object.keys(cols).find((k) => cols[k].s.pui) || Object.keys(cols)[0];
  const M = E.giveMount(S, MNT, col, "", { quiet: true }); if (!M) return; M.lvl = 100; c.mount = M.uid; E.refreshSpells(c, E.charStats(S, c)); }); E.events.length = 0; };
/* --idoles hebdo,dynamo,farle : active ces idoles (0.1.10) pour toutes les équipes ; « max » = les 6 idoles de plus haut score */
const IDOLS = arg("idoles", "");
const giveIdols = (S) => { if (!IDOLS) return; let ids = IDOLS.split(",").map((x) => x.trim()).filter((x) => E.IDOLS[x]);
  if (IDOLS === "max") { const best = {}; E.IDOL_ORDER.forEach((id) => { const I = E.IDOLS[id]; if (!best[I.fam] || E.IDOLS[best[I.fam]].score < I.score) best[I.fam] = id; }); ids = Object.values(best).sort((a, b) => E.IDOLS[b].score - E.IDOLS[a].score).slice(0, E.IDOL_MAX); }
  ids.forEach((id) => { E.giveIdol(S, id, ""); E.toggleIdol(S, id); }); E.events.length = 0; };
const tagRows = (S) => { const fr = E.frontSet(S); S.chars.forEach((c) => (c._row = fr.has(c.id) ? "f" : "b")); };

/* --renaissance N : chaque héros a N renaissances (0.1.12) avec un jeu d'Éveils typique (dégâts, PV, critiques, résistances, Éveil de classe à V et X) */
const REN = Math.min(E.REN_MAX, +arg("renaissance", 0));
const REN_PLAN = ["fureur", "robu", "lame", "fureur", "classe", "ecorce", "fureur", "robu", "lame", "classe"];
const giveRen = (S) => { if (!REN) return; S.chars.forEach((c) => { c.ren = REN; c.eveils = {}; REN_PLAN.slice(0, REN).forEach((id) => (c.eveils[id] = (c.eveils[id] || 0) + 1)); E.refreshSpells(c, E.charStats(S, c)); }); };

/* ---------- une tentative de donjon ---------- */
function run(did, k, cls, prof) {
  const dg = DG[did], lvl = Math.max(1, dg.lvl);
  const S = E.newState("Sim", "iop"); S.chars = [];
  teamFor(cls).forEach((x, i) => { const c = E.addChar(S, x, "H" + i, lvl); c.inTeam = true; });
  S.chars.forEach((c) => { gearUp(S, c, prof); }); giveExo(S); S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c))); givePets(S); giveMounts(S); giveIdols(S); giveRen(S); tagRows(S);
  if (FURN) {
    const hp = Object.keys(E.FURN).filter((n) => E.FURN[n].kind === "hp" && E.FURN[n].trophy && DG[E.FURN[n].trophy].lvl <= dg.lvl).sort((a, b) => E.FURN[b].v - E.FURN[a].v).slice(0, 5);
    S.havre.drop = 40; hp.forEach((n) => { S.furniture.push(n); E.placeFurn(S, n); });
  }
  const SI = E.stasisInfo(S, did); SI.max = k - 1; S.res[dg.key] = 1;
  const err = E.enterDungeon(S, did, k); if (err) throw new Error(`${did} stasis ${k} : ${err}`);
  if (MUT && !S.dungeon.mods.includes(MUT)) S.dungeon.mods = [MUT].concat(S.dungeon.mods).slice(0, Math.max(1, S.dungeon.mods.length)); // --mutateur : impose un modificateur à toutes les stasis
  for (let t = 0; S.dungeon && t < 3 * 3600 * 1000; t += 1000) E.tick(S, 1000);
  return SI.max >= k;
}

/* ---------- chasse : une heure sans équipement, héros du niveau de la zone ---------- */
if (arg("chasse", "")) {
  E.subUnlocked = () => true;
  const lvls = arg("chasse").split(",").map(Number);
  for (const L of lvls) {
    const subs = Object.keys(E.SUBS).filter((k) => E.SUBS[k].lvl && Math.abs((E.SUBS[k].lvl[0] + E.SUBS[k].lvl[1]) / 2 - L) <= 6).slice(0, 4);
    let win = 0, lose = 0;
    for (const sid of subs) for (const cls of CLS) for (let i = 0; i < TRIES; i++) {
      const S = E.newState("Sim", "iop"); S.chars = [];
      teamFor(cls).forEach((x, j) => { const c = E.addChar(S, x, "H" + j, Math.max(1, L - +arg("ecart", 0))); c.inTeam = true; });
      S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c))); giveIdols(S); giveRen(S); tagRows(S);
      E.startHunt(S, sid); let last = null;
      for (let t = 0; t < 3600 * 1000; t += 1000) { E.tick(S, 1000); const F = S.fight; if (F && F.over && F !== last) { last = F; F.result === "win" || F.result === true ? win++ : lose++; } }
    }
    const n = subs.length * CLS.length * TRIES;
    console.log(`chasse niv. ${L} (${subs.length} zones) : ${(win / n).toFixed(1)} victoires/h, ${(100 * lose / Math.max(1, win + lose)).toFixed(1)} % de défaites`);
  }
  if (E.tactLog) console.log("déclenchements :", JSON.stringify(E.tactLog));
  process.exit(0);
}

/* ---------- tableau ---------- */
const PROFS = [["aucun", "sans équipement", [0, 1]], ["bon", "bon équipement", [5, 7]], ["optimise", "équipe optimisée", [8, 10]]];
const ONLY = arg("profils", ""); const PRF = ONLY ? PROFS.filter(([p]) => ONLY.split(",").includes(p)) : PROFS;
const results = [];
for (const did of DUNS) {
  const row = { did, name: DG[did].name, lvl: DG[did].lvl, prof: {} };
  for (const [p] of PRF) {
    // stasis la plus haute réussie au moins une fois sur deux, en montant tant que ça passe
    let best = 0, rate = {};
    for (let k = 1; k <= E.STASIS_MAX; k++) {
      let wins = 0, n = 0;
      for (const cls of CLS) for (let i = 0; i < TRIES; i++) { n++; if (run(did, k, cls, p)) wins++; }
      rate[k] = wins / n;
      if (wins / n < 0.5) break;
      best = k;
    }
    // stasis « fine » : la stasis réussie + la part de victoires à la suivante (ex. 6,4 = stasis 6 et 40 % de victoires en 7)
    row.prof[p] = best; (row.fine = row.fine || {})[p] = +(best + (rate[best + 1] || 0)).toFixed(2);
  }
  results.push(row);
  if (!JSON_OUT) console.log(`${row.name.padEnd(34)} niv. ${String(row.lvl).padStart(3)}  ` + PRF.map(([p, , [lo, hi]]) => `${p.padEnd(8)} ${String(row.fine[p]).padStart(4)} ${row.prof[p] >= lo && row.prof[p] <= hi ? "ok" : row.prof[p] < lo ? "trop dur" : "trop facile"}`).join("   "));
}
if (JSON_OUT) console.log(JSON.stringify({ results, tact: E.tactLog }, null, 1));
else if (E.tactLog) console.log("déclenchements :", JSON.stringify(E.tactLog));
else console.log(`\nStasis la plus haute réussie au moins 1 fois sur 2 (${CLS.length} équipes × ${TRIES} essais). Cibles : sans équipement 0-1, bon équipement 5-7, optimisé 8-10.`);
