/* Kolizéum : les recettes de DOFUS qui demandent des Galets (DofusDB), pour les objets déjà dans le jeu.
   Le jeu avait retiré les Galets de ces recettes (« recette simplifiée ») ; js/koli.js les y remet au chargement.
   Écrit la table entre les marqueurs GALETS de js/koli.js. Lancer : node tools/koli_galets.js */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
globalThis.window = globalThis;
require(path.join(ROOT, "js", "gamedata.js"));
const G = globalThis.GAMEDATA;
const GALETS = { 12737: "Galet cramoisi", 12738: "Galet rutilant", 13366: "Galet Lunaire", 29444: "Galet rayonnant", 13367: "Galet Solaire", 12740: "Galet brasillant" };
const UA = { "User-Agent": "DofousXen-fan-idle-import (perso)", Accept: "application/json" };

(async () => {
  const q = Object.keys(GALETS).map((g) => `ingredientIds[$in][]=${g}`).join("&");
  const all = [];
  for (let skip = 0; ; skip += 50) {
    const r = await fetch(`https://api.dofusdb.fr/recipes?${q}&$limit=50&$skip=${skip}`, { headers: UA }); const d = await r.json();
    all.push(...d.data); if (skip + 50 >= d.total) break;
  }
  const byDb = {}; Object.entries(G.ITEMS).forEach(([k, x]) => (byDb[x.dbid] = k));
  const out = {}; Object.values(GALETS).forEach((n) => (out[n] = []));
  let n = 0;
  for (const r of all) {
    const k = byDb[r.resultId]; if (!k) continue;
    r.ingredientIds.forEach((id, i) => { if (GALETS[id]) { out[GALETS[id]].push([r.resultId, r.quantities[i]]); n++; } });
  }
  Object.values(out).forEach((L) => L.sort((a, b) => a[0] - b[0]));
  const body = Object.entries(out).map(([g, L]) => `    ${JSON.stringify(g)}: ${JSON.stringify(L)},`).join("\n");
  const file = path.join(ROOT, "js", "koli.js"); const src = fs.readFileSync(file, "utf8");
  const re = /(\/\* GALETS:début[^\n]*\n)[\s\S]*?([ \t]*\/\* GALETS:fin \*\/)/;
  if (!re.test(src)) throw new Error("marqueurs GALETS introuvables dans js/koli.js");
  fs.writeFileSync(file, src.replace(re, `$1${body}\n$2`));
  console.log(`js/koli.js : ${n} recettes avec des Galets (${Object.entries(out).map(([g, L]) => `${g} ${L.length}`).join(", ")})`);
})();
