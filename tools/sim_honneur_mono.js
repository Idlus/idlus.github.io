/* Monocompte : rythme de l'honneur et des rangs d'alignement pour UN héros sur une saison de 56 jours (plan directeur,
   étape 3 : P-A1, P-A3, ⚠️C3 et ⚠️C4). Tout passe par le vrai code : agressions et défenses jouées par le moteur du
   Kolizéum (js/honneur.js), honneur des donjons et des missions par les mêmes fonctions que le jeu, Arsenal acheté et porté
   dès que possible, talents, Serment et bonus de panoplie compris.
   Hypothèses (plan, 5.3) : actif 30 donjons et 5 missions par jour, occasionnel 10 donjons et 2 missions ; « peu optimisé » :
   rythme occasionnel, équipement de 8 niveaux en dessous (ni anneaux ni bouclier), niveaux plus lents.
   Niveau du héros : 200 au jour 15 (actif), 28 (occasionnel), 40 (peu optimisé) ; le camp se choisit au niveau 30.
   Agressions : 5 par jour (actif), 3 (occasionnel et peu optimisé) ; défenses : 3 par jour (actif), 1 sinon ;
   ton camp tient ta région de front un jour sur deux (camps équilibrés). Quêtes de cité non comptées (moins de 1 %).
   Usage : node tools/sim_honneur_mono.js [--classes iop,cra|toutes] [--jours 56] [--profils actif,occasionnel] [--avant] [--classique] [--pas 1500,30]
     --avant : sans js/monoalign.js (le code d'avant l'étape 3 : table des rangs du Classique)
     --classique : seulement les victoires d'agression d'une équipe de 3 héros du Classique (pour comparer)
     --pas a,b : essai d'une autre table du Monocompte (rang r : a + b × (r − 1) honneur)
   Résultats du 21/10 (6 classes × 2 camps) :
     avant (table du Classique)  actif rang 6 j6, 10 j11, 20 j44 · occasionnel rang final 15 · peu optimisé 14
     après (1 400 + 30 par rang, 33 700 pour le rang 20) : actif rang 6 j15, 10 j25 (j24-28), 20 j49 (j45-55, 12/12)
       · occasionnel rang 6 j35, rang final 9,8 (9-10) · peu optimisé rang 6 j42 (11/12), rang final 7,8 (5-10)
     Honneur par jour en fin de saison : actif 800, occasionnel 330, peu optimisé 280 ; agressions gagnées 85 / 92 / 75 %.
     Quête du Phénix, étape d'honneur (10 000) : actif j18, occasionnel j38, peu optimisé j45 (js/monodofus.js). */
"use strict";
const path = require("path");
const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def; };
const flag = (k) => process.argv.includes("--" + k);
const J = (f) => require(path.join(__dirname, "../js", f));
const E = J("engine.js"), D = J("data.js");
["systems.js", "pets.js", "mounts.js", "elevage.js", "idols.js", "renaissance.js", "archis.js", "welcome.js", "defi.js", "koli.js", "legendaires.js", "dofusp.js", "mono.js", "monopass.js", "monodofus.js", "wboss.js", "quetes.js", "saison1.js", "verify.js", "alignement.js", "honneur.js"].forEach(J);
const AVANT = flag("avant"), CLASSIQUE = flag("classique");
if (!AVANT) J("monoalign.js");
if (arg("pas", "") && E.MONO.align) { const [a, b] = arg("pas").split(",").map(Number); E.MONO.align.step = (r) => Math.round((a + b * (r - 1)) / 10) * 10; }
let DAYS = +arg("jours", 56);
const CLS = arg("classes", "") === "toutes" ? D.CLASS_ORDER : (arg("classes", "") || "iop,cra,eni,sram,osa,zobal").split(",");

let seed = 1;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const T0 = Date.UTC(2030, 0, 7, 9, 0); let now = T0; E.setClock(() => now);
E.subUnlocked = () => true; E.dungeonUnlocked = () => true; E.note = () => {};

/* ---------- équipement (comme tools/sim_mono.js : « bon » = meilleurs objets du niveau, jets moyens ; « peu » = débutant) ---------- */
const STAT_W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += ((a + b) / 2) * (k === main ? 1 : STAT_W[k] || 0); } return s; };
const cache = {};
const bestFor = (slot, lvl, main) => (cache[slot + lvl + main] = cache[slot + lvl + main] || Object.keys(D.ITEMS).filter((id) => { const T = D.ITEMS[id]; return T.slot === slot && T.lvl <= lvl && !T.bound && !T.noDrop && !T.hidden; }).sort((x, y) => score(D.ITEMS[y], main) - score(D.ITEMS[x], main)));
const give = (S, c, tpl, slot) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = Math.round((a + b) / 2); } S.items[it.uid] = it; E.equip(S, c.id, it.uid, slot); };
const gearUp = (S, c, prof) => {
  Object.keys(c.equip).forEach((sl) => { const it = S.items[c.equip[sl]]; if (it && !D.ITEMS[it.tpl].bound) { delete S.items[c.equip[sl]]; delete c.equip[sl]; } });
  const main = D.CLASSES[c.cls].main;
  const slots = prof === "peu" ? ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes"] : ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier", "anneau1", "anneau2"];
  const lv = prof === "peu" ? Math.max(1, c.lvl - 8) : c.lvl;
  slots.forEach((sl) => { if (c.equip[sl]) return; const L = bestFor(sl.startsWith("anneau") ? "anneau" : sl, lv, main); const t = sl === "anneau2" ? L.find((x) => !Object.values(c.equip).some((u) => S.items[u] && S.items[u].tpl === x)) : L[0]; if (t) give(S, c, t, sl); });
  E.autoAllocate(S, c); c.spellsManual = false; E.refreshSpells(c, E.charStats(S, c));
};
const lvlAt = (d, T) => Math.max(1, Math.min(200, Math.round(200 * Math.pow(Math.min(1, (d + 1) / T), 0.6))));
const dgFor = (lvl) => { const L = Object.keys(D.DUNGEONS).filter((k) => D.DUNGEONS[k].lvl <= lvl).sort((a, b) => D.DUNGEONS[b].lvl - D.DUNGEONS[a].lvl); return L[0] || Object.keys(D.DUNGEONS)[0]; };

/* ---------- --classique : victoires d'agression d'une équipe de 3 héros (repère) ---------- */
if (CLASSIQUE && require.main === module) {
  const w = [0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0];
  for (const L of [60, 120, 200]) for (const cls of CLS) {
    const S = E.newState("Classique", cls); S.chars[0].lvl = L; ["eni", "feca"].filter((k) => k !== cls).concat(["cra"]).slice(0, 2).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; });
    S.chars.forEach((c) => gearUp(S, c, "bon")); E.chooseAlign(S, "bonta", "coeur");
    for (let d = 0; d < 6; d++) { now = T0 + (d * 7 + CLS.indexOf(cls)) * 86400000; E.honInit(S); for (let i = 0; i < 5; i++) { const r = E.agrFight(S, i); if (r.err) continue; n[i]++; if (r.win) w[i]++; } }
  }
  console.log("Classique, équipe de 3 (bon équipement, niveaux 60/120/200) : victoires par cible " + w.map((x, i) => `${["Facile", "Facile", "Serré", "Serré", "Difficile"][i]} ${Math.round((100 * x) / Math.max(1, n[i]))} %`).join(" · "));
  process.exit(0);
}

/* ---------- la saison d'un héros ---------- */
const PROF = {
  actif: { dj: 30, mis: 5, agr: 5, def: 3, gear: "bon", T: 15 },
  occasionnel: { dj: 10, mis: 2, agr: 3, def: 1, gear: "bon", T: 28 },
  "peu optimisé": { dj: 10, mis: 2, agr: 3, def: 1, gear: "peu", T: 40 },
};
const ONLY = arg("profils", ""); const PROFS = Object.keys(PROF).filter((p) => !ONLY || ONLY.split(",").includes(p));
function season(cls, pname, side) {
  const P = PROF[pname];
  now = T0; E.setClock(() => now); const S = E.monoStart(E.newState("Saison", cls)); E.monoBoot(S); const c = S.chars[0];
  const out = { cls, prof: pname, rankDay: {}, hon: [], agr: [0, 0], agrI: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], agrL: [[0, 0], [0, 0]], def: [0, 0], lvl200: null };
  let lastGear = -99;
  for (let d = 0; d < DAYS; d++) {
    now = T0 + d * 86400000 + 3600000; c.lvl = lvlAt(d, P.T); if (c.lvl >= 200 && out.lvl200 == null) out.lvl200 = d + 1;
    if (c.lvl - lastGear >= 10 || (c.lvl === 200 && lastGear < 200)) { gearUp(S, c, P.gear); lastGear = c.lvl; }
    if (!S.align && c.lvl >= E.ALIGN_MIN_LVL) { E.chooseAlign(S, side, "coeur"); }
    if (S.align) {
      E.honInit(S); const front = S.align.front;
      E.alignRegSet(d % 2 ? { held: { [front]: side }, side } : { held: {}, side }); // un jour sur deux, ton camp tient ta région
      S.sub = null;
      for (let k = 0; k < P.dj; k++) E.emit(S, "dungeon", { id: dgFor(c.lvl), stasis: 1, chals: [], down: 0 });
      for (let k = 0; k < P.mis; k++) { const boss = E.rnd() < 0.2; E.giveAlignXp(S, (420 + 9 * c.lvl) * (boss ? 1.5 : 1), d % 2); S.cnt.alignq = (S.cnt.alignq || 0) + 1; E.emit(S, "harvest", { n: 0 }); }
      for (let i = 0; i < P.agr; i++) { const r = E.agrFight(S, i); if (r.err) break; out.agr[1]++; out.agrI[i][1]++; if (r.win) { out.agr[0]++; out.agrI[i][0]++; } if (i === 4) { const L = out.agrL[c.lvl >= 200 ? 1 : 0]; L[1]++; if (r.win) L[0]++; } }
      for (let k = 0; k < P.def; k++) { S.align.ag.defAt = 1; const r = E.honDefTick(S); if (r) { out.def[1]++; if (r.won) out.def[0]++; } }
      // Arsenal : acheté et porté dès que le rang et la bourse le permettent
      if (c.lvl >= 200) E.HON_GEAR_SLOTS.forEach((sl) => { if (E.honBuy(S, sl) === null) { const id = E.HON_GEAR[side][E.HON_GEAR_SLOTS.indexOf(sl)]; const it = Object.values(S.items).find((x) => x.tpl === id); const slot = sl === "anneau" ? "anneau1" : sl; if (c.equip[slot]) { delete S.items[c.equip[slot]]; delete c.equip[slot]; } E.equip(S, c.id, it.uid, slot); E.refreshSpells(c, E.charStats(S, c)); } });
    }
    const r = S.align ? E.alignRankIdx(S) : 0; for (let k = 1; k <= r; k++) if (out.rankDay[k] == null) out.rankDay[k] = d + 1;
    out.hon.push(S.align ? S.align.hon : 0);
  }
  out.rank = S.align ? E.alignRankIdx(S) : 0;
  Object.defineProperty(out, "S", { value: S }); // la partie en fin de saison (tests)
  return out;
}

const pct = (a) => Math.round((100 * a[0]) / Math.max(1, a[1]));
module.exports = { E, D, season, PROF, lvlAt, setDays: (n) => { DAYS = n; } };
if (require.main === module) main();
function main() {
const avg = (L) => (L.length ? L.reduce((a, b) => a + b, 0) / L.length : 0);
const dayOf = (R, k) => { const L = R.map((x) => x.rankDay[k]); const ok = L.filter((x) => x != null); return ok.length === L.length ? `j${Math.round(avg(ok))}` : ok.length ? `j${Math.round(avg(ok))} (${ok.length}/${L.length})` : "jamais"; };
const dayHon = (R, h) => { const L = R.map((x) => { const i = x.hon.findIndex((v) => v >= h); return i < 0 ? null : i + 1; }); const ok = L.filter((x) => x != null); return ok.length === L.length ? Math.round(avg(ok)) : null; };
console.log(`Monocompte, un héros, ${DAYS} jours, ${CLS.length} classes × 2 camps · ${AVANT ? "AVANT l'étape 3 (sans js/monoalign.js)" : `table du Monocompte : rang 1 ${E.MONO.align.step(1)}, rang 20 ${E.MONO.align.step(20)} (${[...Array(20)].reduce((a, _, i) => a + E.MONO.align.step(i + 1), 0)} en tout)`}`);
const ALL = {};
for (const p of PROFS) {
  const R = []; CLS.forEach((cls) => ["bonta", "brakmar"].forEach((side) => R.push(season(cls, p, side)))); ALL[p] = R;
  const agr = R.reduce((a, x) => [a[0] + x.agr[0], a[1] + x.agr[1]], [0, 0]), def = R.reduce((a, x) => [a[0] + x.def[0], a[1] + x.def[1]], [0, 0]);
  const byI = [0, 1, 2, 3, 4].map((i) => pct(R.reduce((a, x) => [a[0] + x.agrI[i][0], a[1] + x.agrI[i][1]], [0, 0])));
  const h28 = Math.round(avg(R.map((x) => x.hon[Math.min(27, DAYS - 1)]))), h56 = Math.round(avg(R.map((x) => x.hon[DAYS - 1])));
  const last7 = Math.round(avg(R.map((x) => (x.hon[DAYS - 1] - x.hon[DAYS - 8]) / 7)));
  console.log(`\n${p.padEnd(13)} rang 6 ${dayOf(R, 6)} · rang 10 ${dayOf(R, 10)} · rang 15 ${dayOf(R, 15)} · rang 20 ${dayOf(R, 20)} · rang final ${avg(R.map((x) => x.rank)).toFixed(1)} (${Math.min(...R.map((x) => x.rank))}-${Math.max(...R.map((x) => x.rank))})`);
  console.log(`              honneur j28 ${h28} · j56 ${h56} · par jour en fin de saison ${last7} · niveau 200 au j${Math.round(avg(R.map((x) => x.lvl200 || DAYS)))}`);
  const dl = [0, 1].map((k) => R.reduce((a, x) => [a[0] + x.agrL[k][0], a[1] + x.agrL[k][1]], [0, 0]));
  console.log(`              cible Difficile (point B) : ${dl[0][1] ? pct(dl[0]) + " %" : "–"} sous le niveau 200, ${dl[1][1] ? pct(dl[1]) + " %" : "–"} au niveau 200 · par classe ${CLS.map((c) => c + " " + pct(R.filter((x) => x.cls === c).reduce((a, x) => [a[0] + x.agr[0], a[1] + x.agr[1]], [0, 0])) + " %").join(", ")}`);
  console.log(`              agressions gagnées ${pct(agr)} % (${(agr[0] / R.length).toFixed(0)} sur la saison ; par cible ${byI.join(" / ")} %) · défenses gagnées ${pct(def)} %`);
  const ph = [500, 2000, 3000, 4000, 5000, 6000, 8000].map((h) => `${h} : ${dayHon(R, h) != null ? "j" + dayHon(R, h) : "pas tous"}`).join(" · ");
  console.log(`              jour où l'honneur atteint  ${ph}`);
}
if (flag("json")) console.log(JSON.stringify(Object.fromEntries(Object.entries(ALL).map(([p, R]) => [p, R.map((x) => ({ cls: x.cls, rank: x.rank, rankDay: x.rankDay, agr: x.agr, h28: x.hon[27], h56: x.hon[DAYS - 1] }))]))));
}
