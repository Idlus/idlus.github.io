/* 3.0.1 (Mathis 13/11 : « illisible », « des coupures ») : sur PC, les pages de la 3.0 s'ouvrent dans un panneau à droite,
   bien plus étroit que l'écran ; leurs règles « écran étroit » (@media max-width) ne s'y appliquaient pas.
   Ce script recopie chaque règle @media (min/max-width) des feuilles du jeu en règle @container v3m : elle s'applique
   alors selon la largeur du panneau (#main, conteneur « v3m » seulement dans le panneau PC, css/v3.css).
   Fabrique css/v3cq.css ; à relancer quand une feuille change : node tools/v3_cq.js (tests/v3cq.test.js le vérifie). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const files = [...html.matchAll(/href="(css\/[a-z0-9_-]+\.css)\?/g)].map((m) => m[1]).filter((f) => f !== "css/v3.css" && f !== "css/v3cq.css");
const COND = /^\s*(\(\s*(min|max)-width\s*:\s*\d+px\s*\)\s*(and\s*)?)+$/;
function blocks(css) { // les @media du niveau le plus haut : [condition, contenu]
  const out = []; let i = 0;
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  while (i < css.length) {
    const at = css.indexOf("@media", i); if (at < 0) break;
    const ob = css.indexOf("{", at); if (ob < 0) break;
    // vérifie que ce @media est au niveau le plus haut
    let depth = 0; for (let j = 0; j < at; j++) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; }
    let d = 1, k = ob + 1; while (k < css.length && d) { if (css[k] === "{") d++; else if (css[k] === "}") d--; k++; }
    if (depth === 0) out.push([css.slice(at + 6, ob).trim(), css.slice(ob + 1, k - 1)]);
    i = k;
  }
  return out;
}
let out = "/* Fabriqué par tools/v3_cq.js — ne pas modifier à la main. Règles « écran étroit » des pages, selon la largeur du panneau de la 3.0 (PC). */\n";
let n = 0;
for (const f of files) {
  const css = fs.readFileSync(path.join(ROOT, f), "utf8");
  for (const [cond, body] of blocks(css)) {
    if (!COND.test(cond) || !/max-width/.test(cond)) continue; // seulement les règles pour les écrans plus étroits
    out += `@container v3m ${cond.replace(/\s+/g, " ")}{${body.trim()}}\n`; n++;
  }
}
const dest = path.join(ROOT, "css/v3cq.css");
if (process.argv.includes("--check")) { if (fs.readFileSync(dest, "utf8") !== out) { console.error("css/v3cq.css n'est pas à jour : node tools/v3_cq.js"); process.exit(1); } console.log(`ok - css/v3cq.css à jour (${n} règles)`); }
else { fs.writeFileSync(dest, out); console.log(`css/v3cq.css : ${n} règles @container depuis ${files.length} feuilles`); }
