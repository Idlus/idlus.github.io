/* Statistiques d'inventaire et de fin de jeu (demande de Mathis du 21/10/2026 : « Réfère toi au save des joueurs pour tes simulations »).
   LECTURE SEULE, chiffres agrégés seulement : jamais de pseudo, jamais d'identifiant, jamais la partie elle-même.
   Sert au Recycleur (ce qui remplit le sac) et aux idées de fin de jeu qui consomment runes et kamas.
   1. Relevé des parties (le workflow « Serveur OVH », étape stats-inventaire, le fait dans son dossier temporaire puis l'efface) :
        bash tools/serveur/vps_sql.sh lecture "select s.data from public.saves s" > parties.json
   2. node tools/stats_inventaire.js parties.json */
"use strict";
const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "../js/engine.js"));
require(path.join(__dirname, "../js/systems.js"));
const D = require(path.join(__dirname, "../js/data.js"));
const { ITEMS } = D;

const file = process.argv[2];
if (!file) { console.error("Usage : node tools/stats_inventaire.js parties.json"); process.exit(2); }
const raw = fs.readFileSync(file, "utf8").trim();
let rows; try { const j = JSON.parse(raw); rows = Array.isArray(j) ? j : [j]; } catch (e) { rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
const txtOf = (r) => (typeof r.data === "string" ? r.data : JSON.stringify(r.data));
const quiet = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };
const pct = (L, p) => { if (!L.length) return 0; const s = L.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const f = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
const dist = (name, L) => console.log(`${name.padEnd(42)} n=${L.length}  médiane ${f(pct(L, 0.5))}  p75 ${f(pct(L, 0.75))}  p90 ${f(pct(L, 0.9))}  max ${f(pct(L, 1))}  total ${f(L.reduce((a, b) => a + b, 0))}`);

const A = []; let illisibles = 0;
const tplAll = {}; // modèle → nombre d'exemplaires (tous comptes)
const tplAcc = {}; // modèle → nombre de comptes qui en ont 10 ou plus
for (const r of rows) {
  let S; const txt = txtOf(r);
  try { S = quiet(() => E.deserialize(txt)); } catch (e) { illisibles++; continue; }
  if (!S || !S.items) { illisibles++; continue; }
  const items = Object.values(S.items); const n = items.length; const cap = E.itemCap(S); const over = Array.isArray(S.over) ? S.over.length : 0;
  const team = (S.chars || []).filter((c) => c.inTeam); const minL = team.length ? Math.min(...team.map((c) => c.lvl)) : 1;
  const maxL = Math.max(1, ...(S.chars || []).map((c) => c.lvl || 1));
  const by = {}; items.forEach((it) => { (by[it.tpl] = by[it.tpl] || []).push(it); });
  let worn = 0, locked = 0, rad = 0, perf = 0, exo = 0, sets = 0, craftable = 0, low30 = 0, q50 = 0, dupes = 0, bulk = 0, bulkCraft = 0;
  const lv = { "1-59": 0, "60-119": 0, "120-179": 0, "180-200": 0 };
  for (const tpl in by) {
    const L = by[tpl]; const T = ITEMS[tpl]; if (!T) continue;
    tplAll[tpl] = (tplAll[tpl] || 0) + L.length; if (L.length >= 10) tplAcc[tpl] = (tplAcc[tpl] || 0) + 1;
    dupes += L.length - 1; if (L.length >= 10) { bulk += L.length; if (T.craft) bulkCraft += L.length; }
    for (const it of L) {
      if (quiet(() => E.equippedBy(S, it.uid))) worn++;
      if (it.locked) locked++; if (it.radiant) rad++; if (it.exo) exo++; if (E.isPerfect(it)) perf++;
      if (T.set) sets++; if (T.craft) craftable++;
      if (T.lvl < minL - 30) low30++;
      if (E.itemQuality(it) < 0.5) q50++;
      lv[T.lvl < 60 ? "1-59" : T.lvl < 120 ? "60-119" : T.lvl < 180 ? "120-179" : "180-200"]++;
    }
  }
  let runesN = 0, runesW = 0; for (const k in S.runes || {}) { const q = S.runes[k] || 0; runesN += q; try { runesW += q * E.runeInfo(k).weight; } catch (e) { /* rune inconnue */ } }
  const jobs = S.crafts || {}; const jl = Object.keys(jobs).map((k) => jobs[k].lvl || 1); const jren = Object.keys(jobs).reduce((a, k) => a + (jobs[k].ren || 0), 0);
  const Au = (S.settings && S.settings.auto) || {};
  A.push({ n, cap, over, fill: cap ? n / cap : 0, worn, locked, rad, perf, exo, sets, craftable, low30, q50, dupes, bulk, bulkCraft, lv,
    runesN, runesW, kamas: S.kamas || 0, h: ((S.stats && S.stats.playtime) || 0) / 3600, maxL, team: team.length, j200: jl.filter((x) => x >= 200).length, jmax: Math.max(1, ...jl), jren,
    auto: (Au.action && Au.action !== "none") || Au.low > 0 || Au.lowLvl > 1 || !!Au.recycle, grenier: (S.havre && S.havre.bag) || 0, size: txt.length });
}

console.log(`== Parties lues : ${A.length} (illisibles : ${illisibles})`);
const groups = [["Toutes les parties", A], ["Héros niv. 150+", A.filter((a) => a.maxL >= 150)], ["Sac rempli à 80 % ou plus", A.filter((a) => a.fill >= 0.8)]];
for (const [name, G] of groups) {
  console.log(`\n== ${name} : ${G.length} comptes`);
  if (!G.length) continue;
  dist("Objets dans le sac", G.map((a) => a.n));
  dist("Taille du sac", G.map((a) => a.cap));
  dist("Remplissage du sac (%)", G.map((a) => a.fill * 100));
  dist("Objets au trop-plein", G.map((a) => a.over));
  dist("Niveau du Grenier", G.map((a) => a.grenier));
  dist("Doublons (exemplaires en plus du 1er)", G.map((a) => a.dupes));
  dist("Objets en lots de 10+ exemplaires", G.map((a) => a.bulk));
  dist("  dont modèles fabricables", G.map((a) => a.bulkCraft));
  dist("Objets fabricables (tous)", G.map((a) => a.craftable));
  dist("Objets de panoplie", G.map((a) => a.sets));
  dist("Objets 30 niv. sous l'équipe", G.map((a) => a.low30));
  dist("Objets au jet < 50 %", G.map((a) => a.q50));
  dist("Portés", G.map((a) => a.worn));
  dist("Cadenas", G.map((a) => a.locked));
  dist("Rayonnants", G.map((a) => a.rad));
  dist("Parfaits", G.map((a) => a.perf));
  dist("Exo", G.map((a) => a.exo));
  for (const k of ["1-59", "60-119", "120-179", "180-200"]) dist(`Objets niv. ${k}`, G.map((a) => a.lv[k]));
  dist("Runes (nombre)", G.map((a) => a.runesN));
  dist("Runes (poids total)", G.map((a) => a.runesW));
  dist("Kamas", G.map((a) => a.kamas));
  dist("Temps de jeu (h)", G.map((a) => a.h));
  dist("Kamas par heure de jeu", G.filter((a) => a.h >= 5).map((a) => a.kamas / a.h));
  dist("Métiers d'artisanat niv. 200", G.map((a) => a.j200));
  dist("Renaissances de métiers (total)", G.map((a) => a.jren));
  dist("Héros dans l'équipe", G.map((a) => a.team));
  dist("Poids de la partie (Ko)", G.map((a) => a.size / 1000));
  console.log(`${"Règles automatiques actives".padEnd(42)} ${G.filter((a) => a.auto).length} / ${G.length}`);
}
console.log("\n== Modèles les plus présents (tous comptes) : modèle · exemplaires · comptes qui en ont 10+ · fabricable");
Object.entries(tplAll).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t, q]) => console.log(`  ${ITEMS[t].name} (niv. ${ITEMS[t].lvl}) · ${f(q)} · ${tplAcc[t] || 0} · ${ITEMS[t].craft ? "oui" : "non"}`));
