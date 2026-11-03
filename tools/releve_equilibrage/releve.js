/* Relevé d'équilibrage pour la Saison 1 (Mathis 03/11/2026 : « prévoir un équilibrage de l'xp, ressources… pour la saison 1 »).
   LECTURE SEULE (Mathis 28/10 : « lis les sauvegardes sans mon accord »). Lit les relevés faits par le workflow « Serveur OVH »
   (étape releve-equilibrage) et n'affiche que des totaux et des médianes : jamais un pseudo ni une partie seule.
   Lancer : node tools/releve_equilibrage/releve.js classique.json jours.json mono.json */
"use strict";
const fs = require("fs");
const D = (() => { try { return require("../../js/data.js"); } catch (e) { return { DUNGEONS: {} }; } })();
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { console.log(`(relevé ${f} illisible : ${e.message})`); return []; } };
const [fc, fj, fm] = process.argv.slice(2);
const q = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const med = (a) => q(a, 0.5);
const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
const heroes = (h) => (Array.isArray(h) ? h : []).filter((c) => c && !c.x && +c.l > 0);
const top = (h) => Math.max(0, ...heroes(h).map((c) => +c.l));
const top8 = (h) => { const l = heroes(h).map((c) => +c.l).sort((a, b) => b - a).slice(0, 8); return l.length ? l.reduce((a, b) => a + b, 0) / 8 : 0; };
const mtTop = (h) => Math.max(0, ...heroes(h).map((c) => +c.m || 0));
const line = (cols) => console.log("  " + cols.map((c, i) => String(c).padStart(i ? 14 : 14)).join(" |"));

/* ---------------- Classique ---------------- */
const C = rd(fc).filter((r) => !r.mono).map((r) => ({ age: +r.age, idle: +r.inactif, pt: (+r.pt || 0) / 3600, k: +r.k || 0, h: r.h, st: r.st || {}, sus: r.suspect || r.flagged }));
const A = C.filter((r) => !r.sus && heroes(r.h).length);
console.log(`== Classique : ${C.length} parties, ${A.length} gardées (sans les comptes signalés ni les parties vides)`);
console.log("\n== Temps de jeu par jour d'ancienneté (heures comptées / jours depuis la création du compte, comptes de 2 jours ou plus)");
const hpd = A.filter((r) => r.age >= 2).map((r) => r.pt / r.age);
console.log(`  n ${hpd.length} · p25 ${r1(q(hpd, 0.25))} h · médiane ${r1(med(hpd))} h · p75 ${r1(q(hpd, 0.75))} h · p90 ${r1(q(hpd, 0.9))} h`);
console.log("\n== Niveau selon l'ancienneté du compte");
line(["ancienneté", "comptes", "niv.méd", "niv.p75", "niv.p90", "% 200", "h.méd", "équipe8"]);
[[0, 1], [1, 3], [3, 7], [7, 10], [10, 14], [14, 18], [18, 22], [22, 99]].forEach(([a, b]) => {
  const g = A.filter((r) => r.age >= a && r.age < b); if (!g.length) return;
  const L = g.map((r) => top(r.h));
  line([`${a}-${b} j`, g.length, med(L), q(L, 0.75), q(L, 0.9), Math.round((100 * L.filter((x) => x >= 200).length) / g.length) + " %", r1(med(g.map((r) => r.pt))), Math.round(med(g.map((r) => top8(r.h))))]);
});
console.log("\n== Niveau selon le temps de jeu compté (le hors ligne n'est pas compté)");
line(["heures", "comptes", "niv.méd", "niv.p75", "équipe8", "héros100", "Maîtrise", "kamas.méd"]);
[[0, 2], [2, 5], [5, 10], [10, 20], [20, 40], [40, 80], [80, 150], [150, 250], [250, 9999]].forEach(([a, b]) => {
  const g = A.filter((r) => r.pt >= a && r.pt < b); if (!g.length) return;
  line([`${a}-${b} h`, g.length, med(g.map((r) => top(r.h))), q(g.map((r) => top(r.h)), 0.75), Math.round(med(g.map((r) => top8(r.h)))), med(g.map((r) => heroes(r.h).filter((c) => c.l >= 100).length)), med(g.map((r) => mtTop(r.h))), fmt(med(g.map((r) => r.k)))]);
});
const at200 = A.filter((r) => top(r.h) >= 200);
console.log(`\n== Comptes avec un héros niveau 200 : ${at200.length} · âge médian ${r1(med(at200.map((r) => r.age)))} j · temps de jeu médian ${Math.round(med(at200.map((r) => r.pt)))} h (p25 ${Math.round(q(at200.map((r) => r.pt), 0.25))} h) · héros à 200 par compte médiane ${med(at200.map((r) => heroes(r.h).filter((c) => c.l >= 200).length))}`);
const M = at200.map((r) => mtTop(r.h));
console.log(`== Maîtrise du meilleur héros (comptes à 200) : médiane ${med(M)} · p75 ${q(M, 0.75)} · p90 ${q(M, 0.9)} · max ${Math.max(0, ...M)}`);
const K = at200.map((r) => r.k);
console.log(`== Kamas (comptes à 200) : médiane ${fmt(med(K))} · p90 ${fmt(q(K, 0.9))} · max ${fmt(Math.max(0, ...K))}`);
console.log("\n== Classes : héros dans l'équipe (comptes actifs depuis 7 jours) · tous niveaux · niveau 200");
const act = A.filter((r) => r.idle <= 7), cls = {};
act.forEach((r) => heroes(r.h).filter((c) => c.t).forEach((c) => { const o = (cls[c.c] = cls[c.c] || [0, 0]); o[0]++; if (c.l >= 200) o[1]++; }));
console.log("  " + Object.entries(cls).sort((a, b) => b[1][0] - a[1][0]).map(([c, [n, m]]) => `${c} ${n}/${m}`).join(" · "));
console.log("\n== Donjons : comptes dont le meilleur héros a le niveau du donjon · % qui l'ont fini · stasis médiane · % stasis 5+ · % stasis 10+ · % 15");
const rows = Object.entries(D.DUNGEONS || {}).sort((a, b) => a[1].lvl - b[1].lvl).map(([id, d]) => {
  const g = A.filter((r) => top(r.h) >= d.lvl); if (!g.length) return null;
  const s = g.map((r) => +r.st[id] || 0);
  return `${d.lvl}|${id}|${g.length}|${Math.round((100 * s.filter((x) => x >= 1).length) / g.length)}|${med(s)}|${Math.round((100 * s.filter((x) => x >= 5).length) / g.length)}|${Math.round((100 * s.filter((x) => x >= 10).length) / g.length)}|${Math.round((100 * s.filter((x) => x >= 15).length) / g.length)}`;
}).filter(Boolean);
rows.forEach((x) => console.log("  " + x));

/* ---------------- copies du jour (7 jours) : gains par jour ---------------- */
const J = rd(fj); const byU = {};
J.forEach((r) => (byU[r.u] = byU[r.u] || []).push({ j: r.j, l: +r.l || 0, k: +r.k || 0, pt: (+r.pt || 0) / 3600 }));
console.log(`\n== Copies du jour : ${J.length} copies, ${Object.keys(byU).length} comptes`);
console.log("  gains par jour entre la plus vieille et la plus récente copie, selon la somme des niveaux des héros au départ (colonne lvl)");
line(["somme niv.", "comptes", "niv/j", "kamas/j", "kamas/j p75", "h/j"]);
[[1, 300], [300, 1000], [1000, 2000], [2000, 3000], [3000, 99999]].forEach(([a, b]) => {
  const g = Object.values(byU).map((c) => c.sort((x, y) => (x.j < y.j ? -1 : 1))).filter((c) => c.length >= 2 && c[0].l >= a && c[0].l < b).map((c) => { const o = c[0], n = c[c.length - 1]; const d = Math.max(1, (Date.parse(n.j) - Date.parse(o.j)) / 86400000); return { l: (n.l - o.l) / d, k: (n.k - o.k) / d, h: (n.pt - o.pt) / d }; });
  if (!g.length) return;
  line([`${a}-${b - 1}`, g.length, r1(med(g.map((x) => x.l))), fmt(med(g.map((x) => x.k))), fmt(q(g.map((x) => x.k), 0.75)), r1(med(g.map((x) => x.h)))]);
});

/* ---------------- Monocompte ---------------- */
const MO = rd(fm); const sais = MO.filter((r) => r.genre === "saison").map((r) => r.v);
console.log("\n== Monocompte : saisons " + sais.map((s) => `${s.id} ${s.etat}${s.test ? " (test)" : ""} début ${String(s.debut).slice(0, 10)} remise ${String(s.remise || "-").slice(0, 10)} gen ${s.gen}`).join(" · "));
const open = sais.find((s) => s.etat === "ouverte") || sais[sais.length - 1];
if (open) {
  const t0 = Date.parse(open.remise || open.debut);
  const P = MO.filter((r) => r.genre === "partie" && r.v.saison === open.id).map((r) => r.v).filter((p) => heroes(p.h).length);
  const day = (Date.now() - t0) / 86400000;
  console.log(`== Saison ${open.id} : jour ${r1(day)} depuis le départ (remise comprise), ${P.length} parties`);
  const L = P.map((p) => top(p.h)), PT = P.map((p) => (+p.pt || 0) / 3600);
  console.log(`  niveau : médiane ${med(L)} · p75 ${q(L, 0.75)} · p90 ${q(L, 0.9)} · max ${Math.max(0, ...L)} · ${L.filter((x) => x >= 200).length} au niveau 200`);
  console.log(`  temps de jeu : médiane ${r1(med(PT))} h · p90 ${r1(q(PT, 0.9))} h · kamas médiane ${fmt(med(P.map((p) => +p.k || 0)))} · Maîtrise max ${Math.max(0, ...P.map((p) => mtTop(p.h)))}`);
  const mc = {}; P.forEach((p) => heroes(p.h).filter((c) => !c.x).forEach((c) => (mc[c.c] = (mc[c.c] || 0) + 1)));
  console.log("  classes : " + Object.entries(mc).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(" · "));
  const cp = MO.filter((r) => r.genre === "copie" && r.v.saison === open.id && Date.parse(r.v.jour) >= t0 - 86400000).map((r) => r.v);
  const byD = {}; cp.forEach((c) => { const d = Math.floor((Date.parse(c.jour) - t0) / 86400000) + 1; (byD[d] = byD[d] || []).push(c); });
  console.log("  niveau du héros par jour de saison (copies du jour)");
  line(["jour", "parties", "niv.méd", "niv.p75", "niv.p90", "max", "h.méd", "kamas.méd"]);
  Object.keys(byD).map(Number).sort((a, b) => a - b).forEach((d) => { const g = byD[d]; const l = g.map((c) => +c.l || 0); line([d, g.length, med(l), q(l, 0.75), q(l, 0.9), Math.max(...l), r1(med(g.map((c) => (+c.pt || 0) / 3600))), fmt(med(g.map((c) => +c.k || 0)))]); });
}
