/* Passe le jeu à une nouvelle version, partout d'un coup :
   - js/ui.js : GAME_VERSION + nouvelle entrée en tête du CHANGELOG
   - index.html : les ?v= de la feuille de style et des scripts (cache-busting)
   - sw.js : VERSION (nouveau cache du service worker)
   - version.json : détection « nouvelle version en ligne » (et annonce Discord une fois sur main)
   - changelog.json : régénéré depuis le CHANGELOG (comme tools/export_changelog.js)
   Usage : node tools/bump_version.js 3.1.2 "Nom de la version" "Nouveauté 1" "Nouveauté 2" ...
   Si l'entrée 3.1.2 existe déjà dans le CHANGELOG de js/ui.js, le nom et les nouveautés peuvent être omis.
   --dry-run : affiche ce qui changerait sans rien écrire. */
const fs = require("fs"); const path = require("path");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2); const DRY = args.includes("--dry-run");
const [v, name, ...items] = args.filter((a) => a !== "--dry-run");
const fail = (m) => { console.error("Erreur : " + m); process.exit(1); };
if (!v || !/^\d+\.\d+\.\d+$/.test(v)) fail('version attendue au format X.Y.Z, ex. node tools/bump_version.js 3.1.2 "Nom" "Nouveauté"');
const vNum = (s) => s.split(".").reduce((a, x) => a * 1000 + Number(x), 0);

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const files = {}; const out = (f, s) => { files[f] = s; };
// remplace exactement `count` occurrences (ou au moins une si count est omis), sinon échoue : on préfère s'arrêter qu'oublier un endroit
const sub = (f, src, re, rep, count) => {
  const n = (src.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
  if (count ? n !== count : !n) fail(`${f} : ${n} occurrence(s) de ${re} au lieu de ${count || "≥ 1"}`);
  return src.replace(re, rep);
};

/* js/ui.js */
let ui = read("js/ui.js");
const cur = (ui.match(/const GAME_VERSION = "([^"]+)"/) || fail("GAME_VERSION introuvable dans js/ui.js"))[1];
if (vNum(v) < vNum(cur)) fail(`${v} est inférieure à la version actuelle ${cur}`);
const hasEntry = ui.includes(`{ v: "${v}",`);
if (!hasEntry) {
  if (!name || !items.length) fail(`pas d'entrée ${v} dans le CHANGELOG : donnez un nom et au moins une nouveauté`);
  const entry = `  { v: ${JSON.stringify(v)}, name: ${JSON.stringify(name)}, items: [\n` + items.map((x) => "    " + JSON.stringify(x)).join(",\n") + " ] },\n";
  ui = sub("js/ui.js", ui, /const CHANGELOG = \[\n/, (m) => m + entry, 1);
} else if (name || items.length) fail(`l'entrée ${v} existe déjà dans le CHANGELOG de js/ui.js : retirez le nom et les nouveautés, ou modifiez-la à la main`);
ui = sub("js/ui.js", ui, /const GAME_VERSION = "[^"]+";/, `const GAME_VERSION = "${v}";`, 1);
out("js/ui.js", ui);

/* index.html : css/style.css + les 6 scripts js/*.js */
out("index.html", sub("index.html", read("index.html"), /((?:css|js)\/[\w-]+\.(?:css|js))\?v=[\w.-]+/g, `$1?v=${v}`, 7));

/* sw.js */
out("sw.js", sub("sw.js", read("sw.js"), /const VERSION = "[^"]+";/, `const VERSION = "${v}";`, 1));

/* version.json */
out("version.json", JSON.stringify({ v }) + "\n");

/* changelog.json (même logique que tools/export_changelog.js, mais depuis le ui.js modifié) */
const start = ui.indexOf("const CHANGELOG = [");
const block = ui.slice(start, ui.indexOf("];", start) + 2);
const CHANGELOG = eval(block.replace("const CHANGELOG =", "(").replace(/\];\s*$/, "])"));
if (CHANGELOG[0].v !== v) fail(`la première entrée du CHANGELOG est ${CHANGELOG[0].v}, pas ${v} : remettez l'entrée ${v} en tête`);
out("changelog.json", JSON.stringify({ version: v, versions: CHANGELOG }, null, 2) + "\n");

for (const [f, s] of Object.entries(files)) {
  const changed = s !== read(f);
  console.log(`${changed ? "✔" : "·"} ${f}${changed ? "" : " (inchangé)"}`);
  if (changed && !DRY) fs.writeFileSync(path.join(ROOT, f), s);
}
console.log(`${DRY ? "[essai] " : ""}${cur} → ${v} « ${CHANGELOG[0].name} » (${CHANGELOG[0].items.length} nouveauté${CHANGELOG[0].items.length > 1 ? "s" : ""})`);
