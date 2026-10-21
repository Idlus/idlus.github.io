/* Prépare le code du jeu pour la fonction serveur « record » (Supabase) :
   assemble les fichiers du moteur en un seul module dans supabase/functions/record/game.js.
   Lancé par le workflow « Serveur en ligne » avant chaque déploiement (le fichier n'est pas dans le dépôt).
   Lancer : node tools/build_server.js */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "gboss", "verify", "koli", "legendaires", "dofusp", "collections", "sram", "champions", "wboss", "songe", "alliance", "chroma", "alignement", "honneur", "quetes"]; // 2.1.34.1 : quetes (points de succès du classement : sans lui, le serveur envoyait 0 point) // 2.1.4 « Bouclier du serveur » : chroma et alignement, pour le résumé des classements calculé par le serveur // 1.0.30 : songe (rejeu du classement du Songe), collections (Couture fine change les caractéristiques)
const out = ["/* Généré par tools/build_server.js — ne pas modifier. */", "globalThis.window = globalThis;"];
for (const f of FILES) out.push(`/* ---- js/${f}.js ---- */`, fs.readFileSync(path.join(ROOT, "js", f + ".js"), "utf8"));
out.push("export const E = globalThis.ENGINE, V = globalThis.VERIFY, D = globalThis.DATA;");
const dest = path.join(ROOT, "supabase", "functions", "record", "game.js");
fs.writeFileSync(dest, out.join("\n"));
console.log(`${path.relative(ROOT, dest)} : ${(fs.statSync(dest).size / 1e6).toFixed(2)} Mo`);
