/* Saison 1, lot 3 (Garde-robe, Mathis 10A) : boucliers d'apparat. Les 129 boucliers de DOFUS (DofusDB, typeId 82, relevé du 03/11
   dans tools/data/boucliers_dofusdb.json : [id, nom, niveau, icône]) deviennent des cosmétiques, sans aucun effet sur les
   caractéristiques. Chacun est rattaché à un donjon (même boss dans le nom, sinon le donjon le plus proche en niveau) et se
   gagne en le terminant en stasis 5 ; quelques-uns vont à l'alignement et aux points de succès.
   Lancer : node tools/build_boucliers.js   (écrit js/boucliers.js) */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global; require(path.join(ROOT, "js/gamedata.js"));
const G = window.GAMEDATA, D = G.DUNGEONS, M = G.MONSTERS;
const L = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/data/boucliers_dofusdb.json"), "utf8"));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const dg = Object.keys(D).sort((a, b) => D[a].lvl - D[b].lvl || (a < b ? -1 : 1));
const bossN = Object.fromEntries(dg.map((id) => [id, norm((M[D[id].boss] || {}).name)]));
const out = {}, used = new Set();
// rattachements fixes : alignement, départ, points de succès
const FIX = { "Bouclier d'entraînement": { k: "base" }, "Bouclier Bontarien": { k: "align", v: "bonta" }, "Bouclier Brâkmarien": { k: "align", v: "brakmar" },
  "Bouclier de Boufbowler Bontarien": { k: "align", v: "bonta", r: 10 }, "Bouclier de Boufbowler Brâkmarien": { k: "align", v: "brakmar", r: 10 } };
L.forEach(([id, n]) => { if (FIX[n]) out[id] = FIX[n]; });
// 1) même boss dans le nom
L.forEach(([id, n]) => { if (out[id]) return; const nn = norm(n);
  const d = dg.find((x) => !used.has(x) && bossN[x].length > 3 && (nn.includes(bossN[x]) || nn.includes(norm(D[x].name)))); if (d) { out[id] = { k: "dg", v: d }; used.add(d); } });
// 2) le reste par niveau : le donjon libre le plus proche
L.forEach(([id, n, lv]) => { if (out[id]) return; let best = null;
  for (const d of dg) if (!used.has(d) && (!best || Math.abs(D[d].lvl - lv) < Math.abs(D[best].lvl - lv))) best = d;
  if (best) { out[id] = { k: "dg", v: best }; used.add(best); } });
// 3) sans donjon libre : paliers de points de succès
let pal = 0; L.forEach(([id]) => { if (!out[id]) out[id] = { k: "pts", v: [500, 1000, 2000, 3500, 5000, 7500, 10000, 15000][pal++] || 20000 }; });
const rows = L.map(([id, n, lv, ic]) => [id, n, lv, ic, out[id]]);
fs.writeFileSync(path.join(ROOT, "js/boucliers.js"), `/* FICHIER FABRIQUÉ par tools/build_boucliers.js (ne pas modifier à la main).
   Boucliers d'apparat (DOFUS, DofusDB) : [id de l'objet, nom, niveau, icône, comment l'obtenir] ; k « dg » = donjon en stasis 5,
   « align » = camp (r = rang), « pts » = points de succès, « base » = offert. Aucun effet sur les caractéristiques. */
window.BOUCLIERS = ${JSON.stringify(rows)};
`);
const n = (k) => rows.filter((r) => r[4].k === k).length;
console.log(`js/boucliers.js : ${rows.length} boucliers (donjons ${n("dg")}, alignement ${n("align")}, points ${n("pts")}, offert ${n("base")})`);
const named = rows.filter((r) => r[4].k === "dg" && /troph/i.test(r[1])).map((r) => r[1] + " → " + D[r[4].v].name); console.log(named.join("\n"));
