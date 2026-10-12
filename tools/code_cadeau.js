/* Fabrique un code cadeau pour Idlus (0.1.10.1), à donner sur le Discord. Le jeu le vérifie sans serveur.
   Usage : node tools/code_cadeau.js <id unique> [--kamas 50000] [--res "Blé:20,Fer:10"] [--cons "coffre_argent:1,bonbon_sagesse:2"]
                                     [--titre "Ami du Discord"] [--ornement pionnier] [--fin 2026-12-31] [--message "Merci les testeurs !"]
   Chaque code a un id unique : une partie ne peut utiliser un même id qu'une fois. Les consommables possibles : liste avec --liste. */
"use strict";
const E = require("../js/engine.js"); require("../js/systems.js");
const D = require("../js/data.js");
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes("--liste")) { console.log("Consommables :", Object.keys(D.CONSUMABLES).join(", ")); console.log("Ornements :", Object.keys(E.ORN).join(", ")); process.exit(0); }
const id = argv[0]; if (!id || id.startsWith("--")) { console.error("Donnez un id unique en premier argument, par exemple : node tools/code_cadeau.js noel2026 --kamas 50000"); process.exit(1); }
const pairs = (txt) => (txt ? txt.split(",").map((x) => { const i = x.lastIndexOf(":"); return [x.slice(0, i).trim(), +x.slice(i + 1) || 1]; }) : undefined);
const d = { id };
if (arg("kamas")) d.k = +arg("kamas");
const r = pairs(arg("res")); if (r) { r.forEach(([n]) => { if (!D.RES[n]) { console.error("Ressource inconnue : " + n); process.exit(1); } }); d.r = r; }
const c = pairs(arg("cons")); if (c) { c.forEach(([n]) => { if (!D.CONSUMABLES[n]) { console.error("Consommable inconnu : " + n + " (voir --liste)"); process.exit(1); } }); d.c = c; }
if (arg("titre")) d.t = arg("titre");
if (arg("ornement")) { if (!E.ORN[arg("ornement")]) { console.error("Ornement inconnu (voir --liste)"); process.exit(1); } d.o = arg("ornement"); }
if (arg("fin")) { if (!/^\d{4}-\d{2}-\d{2}$/.test(arg("fin"))) { console.error("Date de fin au format AAAA-MM-JJ"); process.exit(1); } d.e = arg("fin"); }
if (arg("message")) d.m = arg("message");
const code = E.makeGift(d);
console.log(code);
console.error(`Contenu : ${E.giftText(d) || "rien"}${d.e ? ` · valable jusqu'au ${d.e}` : ""}`);
