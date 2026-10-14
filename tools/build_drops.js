/* 1.0.15 (Mathis : « 1A 2x15 ») : tables de drop des équipements, écrites dans js/drops.js.
   Chaque équipement fabricable tombe sur les monstres de la sous-zone qui donne ses principaux ingrédients,
   ou sur le boss du donjon quand ses ingrédients viennent surtout de ce boss. La chance est réglée pour que droper
   un objet précis prenne environ DROP_K (15) fois le temps de chasse qu'il faut pour réunir ses ingrédients.
   Méthode : le vrai moteur joue une heure de chasse dans chaque sous-zone (4 héros bien équipés, niveau de la zone)
   et un passage de chaque donjon en stasis 1, on mesure les monstres tués et les ressources gagnées par heure.
   Les taux sont des chances par héros (un tirage par héros, comme les Dofus), en %.
   Dofus, légendaires et trophées sont exclus. Un objet sans recette garde ses drops DofusDB.
   Lancer : node tools/build_drops.js (environ 2 minutes) */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
global.DROPS = {}; // les tables actuelles n'influencent pas la mesure
const E = require(ROOT + "/js/engine.js"); require(ROOT + "/js/systems.js");
require(ROOT + "/js/pets.js"); require(ROOT + "/js/mounts.js"); require(ROOT + "/js/idols.js"); require(ROOT + "/js/renaissance.js");
const D = require(ROOT + "/js/data.js");
const DROP_K = 15, HEROES = 4;
let seed = 7; E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.EVENT = null; E.weekly = () => null; E.flash = () => []; E.subUnlocked = () => true; E.dungeonUnlocked = () => true;
const I = D.ITEMS, M = D.MONSTERS, SC = D.SPECIAL_CRAFTS;
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += (a + b) / 2 * (k === main ? 1 : W[k] || 0); } return s; };
const bestCache = {};
const bestFor = (slot, lvl, main) => (bestCache[slot + lvl + main] = bestCache[slot + lvl + main] || Object.keys(I).filter((id) => I[id].slot === slot && I[id].lvl <= lvl).sort((x, y) => score(I[y], main) - score(I[x], main)));
const give = (S, c, tpl, slot) => { const it = E.rollItem(S, tpl, { radiant: false }); for (const k in it.stats) { const [a, b] = I[tpl].stats[k]; it.stats[k] = Math.round((a + b) / 2); } E.equip(S, c.id, it.uid, slot); };
const team = (L) => { const S = E.newState("Sim", "iop"); S.chars = [];
  ["iop", "eni", "feca", "cra"].forEach((x, j) => { const c = E.addChar(S, x, "H" + j, L); c.inTeam = true; });
  S.chars.forEach((c) => { const main = D.CLASSES[c.cls].main;
    for (const slot of ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"]) { const t = bestFor(slot, c.lvl, main)[0]; if (t) give(S, c, t, slot); }
    const r = bestFor("anneau", c.lvl, main); if (r[0]) give(S, c, r[0], "anneau1"); if (r[1]) give(S, c, r[1], "anneau2");
    E.refreshSpells(c, E.charStats(S, c)); });
  return S; };
const gained = (S, r0) => { const o = {}; for (const r in S.res) if ((S.res[r] || 0) > (r0[r] || 0)) o[r] = S.res[r] - (r0[r] || 0); return o; };
// 1. une heure de chasse par sous-zone
const Z = {};
for (const sid of Object.keys(E.SUBS)) { const sub = E.SUBS[sid]; if (!sub.lvl || sub.hidden) continue;
  const S = team(Math.max(5, Math.min(200, sub.lvl[1]))); const r0 = Object.assign({}, S.res); E.startHunt(S, sid); let last = null; const kills = {};
  for (let t = 0; t < 3600 * 1000; t += 1000) { E.tick(S, 1000); const F = S.fight; if (F && F.over && F !== last) { last = F; if (F.result === "win") F.ents.filter((e) => e.side === "m" && !e.fake && !e.summon).forEach((m) => { const k = m.base || m.key; kills[k] = (kills[k] || 0) + 1; }); } }
  const res = gained(S, r0); let base = 0, got = 0;
  for (const k in kills) M[k].drops.forEach(([r, rate]) => { if (!E.isKey(r)) base += kills[k] * Math.min(100, E.resRate(rate)) / 100; });
  for (const r in res) if (!E.isKey(r)) got += res[r];
  Z[sid] = { kills, res, L: sub.lvl[1], mult: base ? got / base : 1 }; } // mult : bonus de butin réels de l'équipe (Prospection, rythme…), déjà comptés dans le temps des ingrédients
// 2. un passage de chaque donjon en stasis 1 (le cycle compte aussi la chasse de la clé)
const keyH = {}; for (const sid in Z) for (const r in Z[sid].res) keyH[r] = Math.max(keyH[r] || 0, Z[sid].res[r]);
const SRC = {}; for (const sid in Z) SRC["z:" + sid] = { rate: Z[sid].res, kills: Z[sid].kills, mult: Z[sid].mult };
for (const did of Object.keys(D.DUNGEONS)) { const dg = D.DUNGEONS[did]; const S = team(Math.max(10, Math.min(200, dg.lvl))); S.res[dg.key] = 1; const r0 = Object.assign({}, S.res); delete r0[dg.key];
  const near = Object.values(Z).filter((z) => Math.abs(z.L - dg.lvl) <= 15).map((z) => z.mult).sort((a, b) => a - b);
  if (E.enterDungeon(S, did, 1)) continue; let t = 0; for (; S.dungeon && t < 3 * 3600 * 1000; t += 1000) E.tick(S, 1000);
  const cyc = 1 / (keyH[dg.key] || 0.5) + t / 3600000; const res = gained(S, r0); const rate = {}; for (const r in res) rate[r] = res[r] / cyc; SRC["d:" + did] = { rate, cyc, boss: dg.boss, mult: near.length ? near[near.length >> 1] : 1.5 }; }
// 3. coût de chaque objet en heures de chasse, puis chance par héros
const best = {}; for (const s in SRC) for (const r in SRC[s].rate) if (!best[r] || SRC[s].rate[r] > best[r].h) best[r] = { s, h: SRC[s].rate[r] };
const flat = (ing, mul = 1, acc = {}) => { ing.forEach(([r, q]) => { if (best[r]) acc[r] = (acc[r] || 0) + q * mul; else if (SC[r]) flat(SC[r].ing, q * mul, acc); }); return acc; };
// panoplie au nom d'un boss de donjon (« Panoplie du Minotot ») → ce donjon ; le nom le plus long l'emporte (Minotot avant Minot…)
const norm = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const SET_DG = {}; for (const st in D.SETS) { const sn = norm(D.SETS[st].name).replace(/royale/g, "royal"); let best = null;
  for (const did in D.DUNGEONS) { const bn = norm(M[D.DUNGEONS[did].boss].name); if (new RegExp("(^|[^a-z])" + bn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)").test(sn) && (!best || bn.length > best.n)) best = { d: "d:" + did, n: bn.length }; }
  if (best) SET_DG[st] = best.d; }
// sinon, panoplie au nom d'un monstre qu'on ne trouve que dans un seul donjon (« Panoplie du Strigide ») → le boss de ce donjon
{ const inZone = new Set(); for (const sid in E.SUBS) (E.SUBS[sid].monsters || []).forEach((m) => inZone.add(Array.isArray(m) ? m[0] : m));
  const dgOf = {}; for (const did in D.DUNGEONS) D.DUNGEONS[did].rooms.flatMap((r) => r.mobs).forEach((m) => (dgOf[m] = dgOf[m] || new Set()).add(did));
  for (const st in D.SETS) { if (SET_DG[st]) continue; const sn = norm(D.SETS[st].name);
    for (const m in dgOf) { if (inZone.has(m) || dgOf[m].size !== 1) continue; const mn = norm(M[m].name);
      if (mn.length > 3 && new RegExp("(^|[^a-z])" + mn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)").test(sn)) { SET_DG[st] = "d:" + [...dgOf[m]][0]; break; } } } }
const dropsOf = {}; for (const k in M) M[k].drops.forEach(([r]) => (dropsOf[r] = dropsOf[r] || []).push(k));
const OUT = {};
for (const id of Object.keys(I).sort()) { const T = I[id]; if (!T.craft || T.slot === "dofus" || T.leg || T.trophy) continue;
  const f = flat(T.craft.ing); const by = {}; for (const r in f) { const b = best[r]; by[b.s] = Math.max(by[b.s] || 0, f[r] / b.h); }
  const hours = Object.values(by).reduce((a, b) => a + b, 0); if (!hours) continue;
  let main = Object.entries(by).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  if (T.set && SET_DG[T.set] && SRC[SET_DG[T.set]]) main = SET_DG[T.set]; // 1.0.25.1 : une panoplie au nom d'un boss de donjon tombe sur ce boss (Minotot, et non Minotoror)
  const src = SRC[main];
  let mons, kh;
  if (main.startsWith("d:")) { mons = [src.boss]; kh = 1 / src.cyc; }
  else { mons = [...new Set(Object.keys(f).flatMap((r) => dropsOf[r] || []))].filter((k) => src.kills[k] && !M[k].archiOf); kh = mons.reduce((a, k) => a + src.kills[k], 0); }
  if (!mons.length || !kh) continue;
  const p = Math.min(100, 100 / (DROP_K * hours * kh) / HEROES / Math.max(1, src.mult));
  mons.forEach((k) => (OUT[k] = OUT[k] || []).push([id, +p.toPrecision(3)]));
}
// objets sans recette (drops DofusDB, futurs objets de boss) : on garde leur source, taux DofusDB × 0,04 partagé entre les 4 héros de référence
for (const k in M) (M[k].items || []).forEach(([t, rate]) => { const T = I[t]; if (!T || T.craft || T.slot === "dofus" || T.leg || T.trophy) return; (OUT[k] = OUT[k] || []).push([t, +(rate * 0.04 / HEROES).toPrecision(3)]); });
console.log(`panoplies rattachées à un boss : ${Object.keys(SET_DG).length}`);
const keys = Object.keys(OUT).sort((a, b) => +a.slice(1) - +b.slice(1));
const body = keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(OUT[k])).join(",\n");
fs.writeFileSync(process.env.DROPS_OUT || path.join(ROOT, "js", "drops.js"), `/* Généré par tools/build_drops.js — ne pas modifier à la main. Données DOFUS via DofusDB, © Ankama Games.
   Pour chaque monstre : [équipement, chance par héros en %]. Lu par js/engine.js à la place des drops DofusDB. */
(function (root) {
  const DROPS = {
${body}
  };
  root.DROPS = DROPS;
  if (typeof module !== "undefined" && module.exports) module.exports = DROPS;
})(typeof window !== "undefined" ? window : globalThis);
`);
const n = keys.reduce((a, k) => a + OUT[k].length, 0); const its = new Set(keys.flatMap((k) => OUT[k].map((x) => x[0]))).size;
const ms = Object.values(Z).map((z) => z.mult).sort((a, b) => a - b); console.log(`bonus de butin mesurés : médiane ×${ms[ms.length >> 1].toFixed(2)} (${ms[0].toFixed(2)} – ${ms[ms.length - 1].toFixed(2)})`);
console.log(`js/drops.js : ${its} équipements sur ${keys.length} monstres (${n} lignes)`);
