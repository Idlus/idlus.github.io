// 09/11/2026 : de quoi est faite une sauvegarde en ligne (taille de chaque partie de la sauvegarde, et compressée).
// Lecture seule : n'affiche que des tailles, jamais le contenu. Usage : node tools/taille_sauvegarde.js releve.json
const fs = require("fs"), zlib = require("zlib");
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ko = (n) => Math.round(n / 1024);
const tot = {};
let all = 0, gz = 0;
for (const r of rows) {
  const txt = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  all += txt.length; gz += zlib.gzipSync(txt).length;
  let o; try { o = JSON.parse(txt); } catch (e) { continue; }
  for (const k in o) tot[k] = (tot[k] || 0) + JSON.stringify(o[k]).length;
  if (r.pseudo) console.log(`${r.pseudo} : ${ko(txt.length)} Ko, compressée ${ko(zlib.gzipSync(txt).length)} Ko`);
}
console.log(`${rows.length} parties : ${ko(all / rows.length)} Ko en moyenne, compressée (gzip) ${ko(gz / rows.length)} Ko`);
Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log(`  ${k.padEnd(18)} ${String(ko(n / rows.length)).padStart(6)} Ko  (${Math.round((100 * n) / all)} %)`));
