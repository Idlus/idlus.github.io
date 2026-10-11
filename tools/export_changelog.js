/* Exporte le CHANGELOG de js/ui.js vers changelog.json (utilisé par l'annonce Discord). */
const fs = require("fs"); const src = fs.readFileSync(__dirname + "/../js/ui.js", "utf8");
const v = src.match(/const GAME_VERSION = "([^"]+)"/)[1];
const block = src.slice(src.indexOf("const CHANGELOG = ["), src.indexOf("];", src.indexOf("const CHANGELOG = [")) + 2);
const CHANGELOG = eval(block.replace("const CHANGELOG =", "(") .replace(/\];\s*$/, "])"));
fs.writeFileSync(__dirname + "/../changelog.json", JSON.stringify({ version: v, versions: CHANGELOG }, null, 2) + "\n");
console.log("changelog.json :", v, CHANGELOG.length, "versions");
