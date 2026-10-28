/* Usage des modes de jeu (préparation de la Saison 1, Mathis 28/10/2026 : « tu peux lire les sauvegardes sans mon accord »).
   Lecture seule. Lit le relevé fait par le workflow « Serveur OVH » (étape usage-modes) : pour chaque compte Classique actif
   depuis 7 jours, la partie en ligne et sa plus vieille copie du jour (saves_jour, 7 jours au plus).
   N'affiche que des totaux : jamais un pseudo, une partie ou un chiffre d'un compte seul.
   Lancer : node tools/usage_modes.js releve.json */
"use strict";
const fs = require("fs");
const file = process.argv[2];
if (!file) { console.error("Usage : node tools/usage_modes.js releve.json"); process.exit(2); }
const rows = JSON.parse(fs.readFileSync(file, "utf8"));
const parse = (t) => { if (!t) return null; if (typeof t === "object") return t; try { return JSON.parse(t); } catch (e) { return null; } };
const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fm = (n) => Math.round(+n || 0).toLocaleString("fr-FR");

const P = []; // [cur, old, jours]
for (const r of rows) { const c = parse(r.cur); if (!c) continue; P.push([c, parse(r.old), +r.jours || 0]); }
console.log(`== Comptes Classique actifs depuis 7 jours : ${P.length} (dont ${P.filter((p) => p[1]).length} avec une copie plus ancienne pour mesurer la semaine)`);

/* 1. compteurs de la partie (S.cnt) : comptes qui l'ont déjà utilisé, et comptes qui l'ont fait bouger cette semaine */
const keys = new Set(); P.forEach(([c]) => Object.keys(c.cnt || {}).forEach((k) => keys.add(k)));
const T = [];
for (const k of keys) {
  const ever = P.filter(([c]) => +((c.cnt || {})[k]) > 0).length;
  const d = P.filter(([, o]) => o).map(([c, o]) => (+((c.cnt || {})[k]) || 0) - (+((o.cnt || {})[k]) || 0)).filter((x) => x > 0);
  T.push([k, ever, d.length, d.reduce((a, b) => a + b, 0), med(d)]);
}
T.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
console.log("\n== Compteurs (S.cnt) : clé · comptes qui l'ont déjà fait · comptes actifs cette semaine · total de la semaine · médiane des actifs");
T.forEach(([k, e, w, s, m]) => { if (typeof e === "number" && (e || w)) console.log(`  ${k.padEnd(16)} ${String(e).padStart(4)} · ${String(w).padStart(4)} · ${fm(s).padStart(10)} · ${fm(m)}`); });

/* 2. états présents dans la partie (un mode utilisé au moins une fois laisse son état) */
const ST = ["asc", "songe", "sg", "exp", "tresor", "mis", "dgh", "koli", "foire", "defi", "defiHero", "chroma", "grav", "mounts", "elev", "pets", "idols", "align", "wb", "gboss", "carnet", "fiches", "builds", "portail", "champ", "vie", "cmd", "temple"];
console.log("\n== États présents dans la partie (comptes) : " + ST.map((k) => `${k} ${P.filter(([c]) => c[k] != null && !(typeof c[k] === "object" && !Object.keys(c[k]).length)).length}`).join(" · "));

/* 3. coffres et consommables */
const cons = (c, re) => Object.entries(c.cons || {}).filter(([k]) => re.test(k)).reduce((a, [, n]) => a + (+n || 0), 0);
const chestsHeld = P.map(([c]) => cons(c, /^coffre_/));
const candy = P.map(([c]) => cons(c, /^bonbon_/));
const scrolls = P.map(([c]) => cons(c, /^parch_/));
console.log(`\n== Coffres gardés sans les ouvrir : ${P.filter((_, i) => chestsHeld[i] > 0).length} comptes, médiane ${fm(med(chestsHeld.filter((x) => x > 0)))}, total ${fm(chestsHeld.reduce((a, b) => a + b, 0))}`);
console.log(`== Ouverture automatique des coffres : ${P.filter(([c]) => c.settings && c.settings.autoChest).length} comptes sur ${P.length}`);
console.log(`== Bonbons en réserve : ${P.filter((_, i) => candy[i] > 0).length} comptes, médiane ${fm(med(candy.filter((x) => x > 0)))}, total ${fm(candy.reduce((a, b) => a + b, 0))}`);
console.log(`== Parchemins en réserve : ${P.filter((_, i) => scrolls[i] > 0).length} comptes, médiane ${fm(med(scrolls.filter((x) => x > 0)))}, total ${fm(scrolls.reduce((a, b) => a + b, 0))}`);
const perId = {}; P.forEach(([c]) => Object.entries(c.cons || {}).forEach(([k, n]) => { if (+n > 0) { perId[k] = perId[k] || [0, 0]; perId[k][0]++; perId[k][1] += +n; } }));
console.log("== Consommables en réserve (id : comptes / total) : " + Object.entries(perId).sort((a, b) => b[1][1] - a[1][1]).map(([k, [a, n]]) => `${k} ${a}/${fm(n)}`).join(" · "));

/* 4. temps de jeu de la semaine (pour situer) */
const pt = P.filter(([, o]) => o).map(([c, o]) => ((c.stats && c.stats.playtime) || 0) - ((o.stats && o.stats.playtime) || 0)).filter((x) => x > 0).map((x) => x / 3600);
console.log(`\n== Temps de jeu compté sur la période : médiane ${fm(med(pt))} h, ${pt.filter((x) => x >= 20).length} comptes à 20 h ou plus`);
console.log(`== Écart moyen entre la copie la plus ancienne et la partie en ligne : ${fm(P.filter(([, o]) => o).reduce((a, p) => a + p[2], 0) / Math.max(1, P.filter(([, o]) => o).length))} jours`);
