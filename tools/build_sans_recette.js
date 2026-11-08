/* 2.2.14.8 « Butin utile » (Mathis, 08/11 : choix « Arrêter de les faire tomber ») : liste des ressources de monstres qui ne servent
   à aucune recette (équipements, recettes spéciales, outils de récolte) ni à rien d'écrit en dur dans le jeu (nourriture de familier,
   missions d'alignement, Songe…). js/data.js les retire du butin des monstres ; elles restent dans les sacs et se vendent au même prix.
   Lancer après tout changement de recettes ou de butin : node tools/build_sans_recette.js (réécrit la liste entre les marqueurs de js/data.js). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = globalThis;
globalThis.IDLUS_GARDE_SANS_RECETTE = true; // js/data.js garde tout le butin : on calcule sur les données complètes
const FILES = ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "outils"];
for (const f of FILES) { try { require(path.join(ROOT, "js", f + ".js")); } catch (e) { /* module de page : sans effet sur les recettes */ } }
const E = globalThis.ENGINE, D = globalThis.DATA;
const { ITEMS, MONSTERS, GATHER_JOBS, SPECIAL_CRAFTS } = D;
const use = new Set(), dropped = new Set();
for (const k in MONSTERS) MONSTERS[k].drops.forEach(([r]) => dropped.add(r));
for (const t in ITEMS) if (ITEMS[t].craft) ITEMS[t].craft.ing.forEach(([r]) => use.add(r));
for (const n in SPECIAL_CRAFTS) SPECIAL_CRAFTS[n].ing.forEach(([r]) => use.add(r));
if (E.toolRecipe) for (const j in GATHER_JOBS) for (let L = 1; L <= E.TOOL_MAX; L++) E.toolRecipe(j, L).ing.forEach(([r]) => use.add(r));
for (const j in GATHER_JOBS) GATHER_JOBS[j].items.forEach(([r]) => use.add(r));
// noms écrits en dur ailleurs (familiers, alignement, Songe, boss des mondes…) : on les garde, par prudence
const txt = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js") && !["gamedata.js", "pieces.js", "drops.js", "armes.js"].includes(f))
  .map((f) => fs.readFileSync(path.join(ROOT, "js", f), "utf8").replace(/\/\*SANS_RECETTE\*\/[\s\S]*?\/\*FIN_SANS_RECETTE\*\//, "")).join("\n");
const named = (r) => ['"', "'", "`"].some((q) => txt.includes(q + r + q));
const list = [...dropped].filter((r) => !use.has(r) && !E.isKey(r) && r !== E.RARE_COMPONENT && !named(r)).sort((a, b) => a.localeCompare(b, "fr"));
const file = path.join(ROOT, "js", "data.js"); const src = fs.readFileSync(file, "utf8");
const out = src.replace(/\/\*SANS_RECETTE\*\/[\s\S]*?\/\*FIN_SANS_RECETTE\*\//, `/*SANS_RECETTE*/${JSON.stringify(list)}/*FIN_SANS_RECETTE*/`);
if (out === src && !src.includes("/*SANS_RECETTE*/")) throw new Error("marqueurs /*SANS_RECETTE*/ absents de js/data.js");
fs.writeFileSync(file, out);
console.log(`js/data.js : ${list.length} ressources sans recette retirées du butin (sur ${dropped.size} ressources de monstres)`);
