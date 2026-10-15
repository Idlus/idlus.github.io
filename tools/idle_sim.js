/* 1.0.30 « Place à l'optimisation » : simulation d'équilibrage de l'idle (js/expeditions.js).
   1. Expéditions : ce que rapporte une heure d'expédition (meilleur cas : héros bien équipé, exigences remplies,
      niveau de mission le plus rentable) comparé à une heure de chasse d'UN héros dans une équipe de 8 (bon équipement).
      Règle : le rapport doit rester sous 1 pour les kamas, les ressources (valeur) et l'XP.
   2. Heures de donjon : 8 h hors ligne (E.dghRun) comparées à 8 h de donjon joué au rendement hors ligne
      (8 h × rendement de vrai jeu, E.tick), même équipe, même donjon, même stasis. Règle : hors ligne ≤ joué.
   Usage : node tools/idle_sim.js [--niveaux 20,50,110,200] [--donjons id1,id2] [--rendement 0.25] [--rapide] [--graine 1] */
"use strict";
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/idols.js"); require("../js/renaissance.js");
require("../js/archis.js"); require("../js/defi.js"); require("../js/expeditions.js");
const D = require("../js/data.js");

const arg = (k, def) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def; };
const flag = (k) => process.argv.includes("--" + k);
const FAST = flag("rapide");
let seed = +arg("graine", 1);
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.weekly = () => null; E.flash = () => []; E.eventOn = () => false; E.subUnlocked = () => true; E.dungeonUnlocked = () => true;

/* ---------- équipement : meilleur objet de son niveau, jets moyens (profil « bon ») ---------- */
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += (a + b) / 2 * (k === main ? 1 : W[k] || 0); } return s; };
const memo = {};
const bestFor = (slot, lvl, main) => memo[slot + lvl + main] || (memo[slot + lvl + main] = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === slot && D.ITEMS[id].lvl <= lvl && !D.ITEMS[id].hidden).sort((x, y) => score(D.ITEMS[y], main) - score(D.ITEMS[x], main)));
const give = (S, c, tpl, slot) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = D.ITEMS[tpl].stats[k]; it.stats[k] = Math.round((a + b) / 2); } return E.equip(S, c.id, it.uid, slot); };
const gearUp = (S, c) => { const main = D.CLASSES[c.cls].main; for (const slot of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"]) { const t = bestFor(slot, c.lvl, main)[0]; if (t) give(S, c, t, slot); } const r = bestFor("anneau", c.lvl, main); if (r[0]) give(S, c, r[0], "anneau1"); if (r[1]) give(S, c, r[1], "anneau2"); };
const P8 = ["eni", "feca", "cra", "sacri", "iop", "osa", "enu", "sram"];
const team = (S, L, n = 8) => { S.chars = []; P8.slice(0, n).forEach((x, j) => { const c = E.addChar(S, x, "H" + j, L); c.inTeam = true; }); S.chars.forEach((c) => { gearUp(S, c); E.refreshSpells(c, E.charStats(S, c)); }); S.settings.auto = { action: "none", q: 0, keepSets: true }; };
const resVal = (res) => { let n = 0, v = 0, k = 0; for (const r in res) { if (E.isKey(r)) { k += res[r]; continue; } n += res[r]; v += res[r] * E.resPrice(r); } return { n, v, k }; };
const diffRes = (a, b) => { const o = {}; for (const r in a) { const d = a[r] - (b[r] || 0); if (d > 0) o[r] = d; } return o; };
const xpAbs = (c, L0, xp0) => { let t = c.xp - xp0; for (let l = L0; l < c.lvl; l++) t += E.xpNeed(l); return t; };
const f0 = (n) => Math.round(n).toLocaleString("fr-FR");
const pc = (x) => `${Math.round(x * 100)} %`;

/* ---------- 1. chasse : un héros dans une équipe de 8, par heure ---------- */
const hunt = (L) => {
  const subs = Object.keys(E.SUBS).filter((k) => E.SUBS[k].lvl && !E.SUBS[k].hidden && Math.abs(E.subMid(E.SUBS[k]) - L) <= 6).slice(0, FAST ? 1 : 3);
  const tot = { k: 0, xp: 0, n: 0, v: 0, keys: 0, it: 0 }; let m = 0;
  for (const sid of subs) {
    const S = E.newState("Sim", "iop"); team(S, L); E.startHunt(S, sid);
    const k0 = S.kamas, r0 = Object.assign({}, S.res), it0 = Object.keys(S.items).length, x0 = S.chars.map((c) => [c.lvl, c.xp]);
    for (let t = 0; t < 3600 * 1000; t += 1000) E.tick(S, 1000);
    E.events.length = 0;
    const rv = resVal(diffRes(S.res, r0)); const n = S.chars.length;
    tot.k += (S.kamas - k0) / n; tot.n += rv.n / n; tot.v += rv.v / n; tot.keys += rv.k / n; tot.it += (Object.keys(S.items).length - it0) / n;
    tot.xp += S.chars.reduce((a, c, i) => a + xpAbs(c, x0[i][0], x0[i][1]), 0) / n; m++;
  }
  for (const k in tot) tot[k] /= Math.max(1, m);
  return tot;
};
/* ---------- 1. expédition : meilleur cas par heure (héros bien équipé, élément et classe demandés, meilleur niveau de mission) ---------- */
const expe = (L) => {
  const S = E.newState("Sim", "iop"); team(S, L, 1); S.chars.push(E.addChar(S, "eni", "Banc", L)); const c = S.chars[1]; c.inTeam = false; gearUp(S, c);
  const st = E.charStats(S, c); const el = E.heroEl(S, c, st);
  const sub = Object.values(E.SUBS).filter((s) => s.lvl && !s.hidden).sort((a, b) => Math.abs(E.subMid(a) - L) - Math.abs(E.subMid(b) - L))[0];
  const best = {};
  for (const t of Object.keys(E.MIS_TYPES)) {
    const T = E.MIS_TYPES[t];
    for (let off = -20; off <= 20; off++) {
      const Lm = Math.max(1, Math.min(200, L + off));
      let sts = T.st.filter((k) => !(E.MIS_STATS[k].min > Lm)); if (!sts.length) sts = ["ini"];
      const req = sts.slice(0, T.n || 1).map((k) => ({ k: "st", s: k, v: E.MIS_STATS[k].thr(Lm) })).concat([{ k: "el", e: el }]);
      const m = { t, sub: sub.id, lvl: Lm, req, key: "Clef x" };
      const info = E.misInfo(S, c, m, st); if (!info.ok) continue;
      const ev = info.p + (1 - info.p) * E.MIS.fail; const R = E.misReward(S, c, m, st);
      // valeur moyenne d'une ressource de la zone (mêmes poids que le tirage)
      const w = {}; sub.monsters.forEach((k) => (D.MONSTERS[k].drops || []).forEach(([r, rate]) => { if (!E.isKey(r)) w[r] = (w[r] || 0) + E.resRate(rate); }));
      const tw = Object.values(w).reduce((a, b) => a + b, 0) || 1; const avgP = Object.keys(w).reduce((a, r) => a + w[r] * E.resPrice(r), 0) / tw;
      const o = { t, Lm, p: info.p, k: R.kamas * ev / T.h, n: R.res * ev / T.h, v: R.res * ev * avgP / T.h, xp: R.xp * ev / T.h, keys: R.keys * info.p / T.h, it: (R.item >= 1 ? info.p : R.item * info.p) / T.h };
      const sc = o.k / 1e3 + o.v / 1e3 + o.xp / 1e4;
      if (!best[t] || sc > best[t].sc) best[t] = Object.assign(o, { sc });
    }
  }
  return best;
};

const LV = (arg("niveaux", FAST ? "20,110,195" : "20,50,80,110,140,170,195")).split(",").map(Number);
console.log("=== 1. Expéditions : une heure d'expédition (meilleur cas) / une heure de chasse d'un héros dans une équipe de 8 ===");
let worst = 0;
for (const L of LV) {
  const H = hunt(L); const X = expe(L);
  console.log(`niv ${L} · chasse, par héros et par heure : ${f0(H.k)} kamas · ${f0(H.n)} ressources (${f0(H.v)} k) · ${f0(H.xp)} XP · ${H.keys.toFixed(2)} clé · ${H.it.toFixed(2)} objet`);
  for (const t in X) {
    const o = X[t]; const r = [o.k / H.k, o.v / Math.max(1, H.v), H.xp > 0 ? o.xp / H.xp : 0]; worst = Math.max(worst, ...r);
    console.log(`   ${E.MIS_TYPES[t].name.padEnd(15)} mission niv ${String(o.Lm).padStart(3)} · ${pc(o.p)} · ${f0(o.k)} k/h (${pc(r[0])}) · ${f0(o.n)} res/h, ${f0(o.v)} k (${pc(r[1])}) · ${f0(o.xp)} XP/h (${pc(r[2])}) · ${o.keys.toFixed(2)} clé/h · ${o.it.toFixed(2)} objet/h`);
  }
}
console.log(`=> pire rapport expédition / chasse : ${pc(worst)} ${worst < 1 ? "(OK : sous 100 %)" : "(TROP HAUT)"}`);

/* ---------- 2. heures de donjon : 8 h hors ligne contre 8 h × rendement de vrai jeu ---------- */
const RATE = +arg("rendement", 0.25);
const DGS = (arg("donjons", FAST ? "cour_bouftou_royal:3,antre_crocabulia:6" : "cour_bouftou_royal:3,clos_blops:5,antre_dragon_cochon:3,antre_crocabulia:6,tertre_long_sommeil:4,bastion_marteaux:6")).split(",").map((x) => x.split(":")).filter(([d]) => D.DUNGEONS[d]);
const snap = (S) => ({ k: S.kamas, res: Object.assign({}, S.res), it: Object.keys(S.items).length, x: S.chars.map((c) => [c.lvl, c.xp]), boss: 0 });
const gain = (S, s0) => { const rv = resVal(diffRes(S.res, s0.res)); return { k: S.kamas - s0.k, n: rv.n, v: rv.v, it: Object.keys(S.items).length - s0.it, xp: S.chars.reduce((a, c, i) => a + xpAbs(c, s0.x[i][0], s0.x[i][1]), 0) / S.chars.length, dust: (S.res[E.POUSSIERE] || 0) - (s0.res[E.POUSSIERE] || 0) }; };
console.log(`\n=== 2. Heures de donjon : 8 h hors ligne / 8 h de donjon joué au rendement hors ligne (${pc(RATE)}, soit ${(8 * RATE).toFixed(1)} h de vrai jeu) ===`);
let worstD = 0;
for (const [did, kk] of DGS) {
  const dg = D.DUNGEONS[did]; const k = +kk || 3; const L = Math.min(195, dg.lvl + (k >= 6 ? 10 : 5)); // 195 au plus : l'XP se mesure encore
  const S0 = E.newState("Sim", "iop"); team(S0, L); S0.res[dg.key] = 5000; E.stasisInfo(S0, did).max = k;
  const txt = E.serialize(S0);
  // joué : enchaînements de courses pendant 8 h × rendement
  const Sp = E.deserialize(txt); const dofP = { n: 0 }; const dd = E.dofusDrop; E.dofusDrop = function () { dofP.n++; return dd.apply(this, arguments); };
  const p0 = snap(Sp); const kills0 = Sp.progress.bossKills[did] || 0;
  for (let t = 0; t < 8 * 3600 * RATE * 1000; t += 1000) { if (!Sp.dungeon) E.enterDungeon(Sp, did, k, 999); E.tick(Sp, 1000); }
  const runs = (p0.res[dg.key] || 0) - (Sp.res[dg.key] || 0);
  E.events.length = 0; const gp = gain(Sp, p0); const winsP = (Sp.progress.bossKills[did] || 0) - kills0;
  // hors ligne : même départ, avec la mesure des courses jouées
  const So = E.deserialize(txt); So.dgh = JSON.parse(JSON.stringify(E.dgh(Sp))); const H = E.dgh(So); H.b = 8 * 3600; H.did = did; H.k = k; H.on = true;
  const dofO = { n: 0 }; E.dofusDrop = function () { dofO.n++; return dd.apply(this, arguments); };
  const o0 = snap(So); const r = E.dghRun(So, 8 * 3600, RATE, {}); E.events.length = 0; const go = gain(So, o0);
  E.dofusDrop = dd;
  const rec = H.st[did + ":" + k];
  const rat = [go.k / gp.k, go.v / gp.v, gp.xp > 0 ? go.xp / gp.xp : 0, go.it / Math.max(1, gp.it)];
  worstD = Math.max(worstD, rat[0], rat[1], rat[2]);
  console.log(`${dg.name} (niv ${dg.lvl}, stasis ${k}, équipe de 8 niv ${L}) · mesure : ${rec ? `${f0(rec.s)} s par course, ${pc(rec.w)} de réussite (${rec.n} courses)` : "aucune"}`);
  console.log(`   joué      : ${winsP} boss / ${runs} clés · ${f0(gp.k)} kamas · ${f0(gp.n)} res (${f0(gp.v)} k) · ${f0(gp.xp)} XP/héros · ${gp.it} objets · ${gp.dust} poussières · ${dofP.n} tirages de Dofus (×${S0.chars.length} héros)`);
  console.log(`   hors ligne: ${r.wins} boss / ${r.keys} clés · ${f0(go.k)} kamas · ${f0(go.n)} res (${f0(go.v)} k) · ${f0(go.xp)} XP/héros · ${go.it} objets · ${go.dust} poussières · ${dofO.n} tirages de Dofus · ${E.hrsTxt(r.used)} d'heures utilisées`);
  console.log(`   rapport hors ligne / joué : kamas ${pc(rat[0])} · ressources ${pc(rat[1])} · XP ${pc(rat[2])} · objets ${pc(rat[3])}`);
}
console.log(`=> pire rapport donjon hors ligne / joué : ${pc(worstD)} ${worstD <= 1.0 ? "(OK)" : "(au-dessus de 100 %)"}`);
