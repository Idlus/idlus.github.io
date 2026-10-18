/* Temps de jeu de tous les comptes (demande de Mathis, 18/10/2026, lecture seule) : « regarde le temps de jeu comme pour
   JustEver avec les autres ». Lit le relevé de l'étape temps-de-jeu-tous du workflow « Serveur OVH » (une ligne par copie :
   copies du jour, partie validée, partie en ligne ; seulement temps de jeu, kamas et Maîtrise, jamais la partie) et compare,
   d'une copie à la suivante, le temps de jeu gagné au temps réel écoulé. Le Sablier permet d'avancer d'au plus 48 h de réserve
   au-delà du temps réel : au-dessus, ce n'est pas possible.
   Lancer : node tools/temps_de_jeu.js releve.json */
"use strict";
const fs = require("fs");
const R = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const RESERVE = 48, MT_T0 = Date.parse("2026-10-16T16:00:00Z");
const h1 = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR"), fm = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
const by = {};
for (const r of R) { if (!r.at || r.pt == null) continue; (by[r.pseudo || "?"] = by[r.pseudo || "?"] || []).push({ ...r, t: Date.parse(r.at) }); }
const out = [];
for (const [p, L] of Object.entries(by)) {
  L.sort((a, b) => a.t - b.t);
  const U = L.filter((x, i) => !i || x.t - L[i - 1].t > 60000 || x.pt !== L[i - 1].pt);
  let worst = null, sum = 0;
  for (let i = 1; i < U.length; i++) {
    const a = U[i - 1], b = U[i], real = (b.t - a.t) / 3600000, play = (b.pt - a.pt) / 3600;
    if (play > 0) sum += play;
    const over = play - real - RESERVE;
    if (!worst || over > worst.over) worst = { over, real, play, from: a.at, to: b.at, mt: b.mt - a.mt, k: b.k - a.k };
  }
  const first = U[0], last = U[U.length - 1], real = (last.t - first.t) / 3600000;
  // Maîtrise : seulement les copies d'après la remise à zéro (version de partie 13, 2.1.15) ; les copies plus anciennes ont les points d'avant
  const V13 = U.filter((x) => (+x.v || 0) >= 13), top = V13.reduce((m, x) => (x.mtmax > m.mtmax ? x : m), V13[0] || { mtmax: 0, t: MT_T0 });
  const capMt = 50 + 30 * 1.25 * Math.max(0, (top.t - MT_T0) / 3600000);
  out.push({ p, n: U.length, real, play: sum, total: last.pt / 3600, worst, mt: last.mt, mtAt: top.at, mtmax: top.mtmax, mtOver: top.mtmax > capMt, capMt, src: last.src });
}
out.sort((a, b) => (b.worst ? b.worst.over : -1e9) - (a.worst ? a.worst.over : -1e9));
const bad = out.filter((o) => (o.worst && o.worst.over > 0) || o.mtOver);

console.log(`== ${out.length} comptes, ${R.length} copies lues. Dépassements (temps de jeu > temps réel + ${RESERVE} h de Sablier, ou Maîtrise au-dessus du plafond) : ${bad.length}`);
for (const o of bad) {
  const w = o.worst;
  console.log(`  ${o.p} : ${w ? `${h1(w.play)} h de jeu en ${h1(w.real)} h réelles (${String(w.from).slice(5, 16)} → ${String(w.to).slice(5, 16)}), Maîtrise ${fm(w.mt)}, kamas ${fm(w.k)}` : ""}${o.mtOver ? ` · Maîtrise d'un héros ${fm(o.mtmax)} le ${String(o.mtAt).slice(5, 16)} (plafond ${fm(o.capMt)})` : ""} · temps de jeu total ${h1(o.total)} h`);
}
console.log("\n== Tous les comptes (du plus serré au plus large) : copies, période réelle, temps de jeu gagné, pire écart, Maîtrise équipe / meilleur héros");
for (const o of out) console.log(`  ${o.p} : ${o.n} copies, ${h1(o.real)} h réelles, +${h1(o.play)} h de jeu, pire écart ${o.worst ? (o.worst.over > 0 ? "+" : "") + h1(o.worst.over) + " h" : "—"}, Maîtrise ${fm(o.mt)} / ${fm(o.mtmax)}, total ${h1(o.total)} h`);
