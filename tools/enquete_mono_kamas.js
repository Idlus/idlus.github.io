/* Enquête kamas Monocompte (22/10/2026, mots de Mathis : « lis les sauvegardes Monocompte de Ley et du compte à 226 M »).
   Lecture seule : n'affiche que des chiffres de jeu et les catégories du Carnet des kamas, jamais la partie.
   Lancer : node tools/enquete_mono_kamas.js releve.json */
"use strict";
const fs = require("fs");
const fm = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
let R = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); if (!Array.isArray(R)) R = [R];
for (const r of R) {
  let S = null; try { S = JSON.parse(r.data); } catch (e) { console.log(`== ${r.pseudo} : partie illisible (${String(e.message).slice(0, 60)})`); continue; }
  const st = S.stats || {};
  console.log(`\n== ${r.pseudo} : ${fm(S.kamas)} kamas, ${(Math.round((+st.playtime || 0) / 36) / 100)} h de jeu, version ${S.v || S.version || "?"}, héros ${(S.chars || []).map((c) => `${c.cls} ${c.lvl}`).join(", ")}`);
  console.log("   bilan validé :", JSON.stringify(r.bilan || null));
  const C = S.carnet || {}; const days = (C.L && C.L.days) || []; const tot = {};
  days.forEach((d, i) => { if (d && typeof d === "object") { const line = Object.entries(d).filter(([, v]) => v >= 100000).map(([k, v]) => `${k} ${fm(v)}`).join(" · "); if (line) console.log(`   jour ${(C.L.i0 || 0) + i} : ${line}`); Object.entries(d).forEach(([k, v]) => (tot[k] = (tot[k] || 0) + v)); } });
  console.log("   Carnet des kamas (total) :", Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fm(v)}`).join(" · ") || "vide");
  const sk = C.sk || {}; if (Object.keys(sk).length) console.log("   sk :", JSON.stringify(sk).slice(0, 600));
  (C.mom || []).filter((m) => /kamas|M\b|vente|vend/i.test(m.txt || "")).slice(0, 15).forEach((m) => console.log(`   moment ${new Date(m.t).toISOString().slice(5, 16)} ${m.k} : ${String(m.txt).slice(0, 140)}`));
  const big = (S.log || S.notes || []).filter((n) => { const t = typeof n === "string" ? n : (n && (n.t || n.txt || n.m)) || ""; return /kamas/i.test(t) && /\d[\d  .,]{6,}/.test(t); }).slice(0, 25);
  big.forEach((n) => console.log("   note :", String(typeof n === "string" ? n : JSON.stringify(n)).slice(0, 200)));
  console.log("   clés de la partie :", Object.keys(S).sort().join(" ").slice(0, 1500));
  if (S.mono) console.log("   S.mono :", Object.keys(S.mono).sort().join(" "));
}
