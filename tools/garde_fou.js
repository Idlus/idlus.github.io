/* Garde-fou des publications (choix de Mathis 4A, 14/10/2026).
   Compare la copie de travail à une version de référence du jeu (par défaut origin/main, sinon la révision donnée) :
   - échoue si une version déjà publiée a disparu des nouveautés (CHANGELOG de js/ui.js) : signe qu'on publie depuis une copie
     trop ancienne et qu'on efface le travail d'un autre (1.0.23.1 et 1.0.24.2 effacées le 14/10/2026) ;
   - échoue si GAME_VERSION recule ;
   - prévient (sans échouer) quand un fichier du jeu grossit ou maigrit d'un coup.
   Une remise en place (comme la 1.0.24.4) ajoute une version : elle passe.
   Lancer : node tools/garde_fou.js [révision]   (lancé aussi par npm test et par les tests de GitHub) */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
const tryGit = (...a) => { try { return git(...a); } catch (e) { return null; } };

let ref = process.argv[2];
if (ref && /^0+$/.test(ref)) ref = null; // premier envoi d'une branche : rien à comparer
if (!ref) ref = tryGit("rev-parse", "--verify", "-q", "origin/main") ? "origin/main" : null;
if (!ref || tryGit("cat-file", "-e", ref + "^{commit}") === null) { console.log("garde-fou : pas de version de référence (git ou origin/main absent), vérification passée"); process.exit(0); }

const before = tryGit("show", `${ref}:js/ui.js`);
if (before === null) { console.log(`garde-fou : js/ui.js absent de ${ref}, vérification passée`); process.exit(0); }
const now = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");

// une version = son numéro et son nom (deux fils qui prennent le même numéro : l'un efface l'autre, comme 4b069c1 sur la 1.0.24.2)
const versions = (src) => new Set([...src.matchAll(/^\s*\{ v: "([^"]+)", name: "((?:[^"\\]|\\.)*)"/gm)].map((m) => `${m[1]} « ${m[2]} »`));
const gameVersion = (src) => (/const GAME_VERSION = "([\d.]+)"/.exec(src) || [])[1] || "0";
const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

const fails = [];
const lost = [...versions(before)].filter((v) => !versions(now).has(v));
if (lost.length) fails.push(`des versions publiées ont disparu des nouveautés : ${lost.join(", ")}. La copie est sans doute partie d'un main plus ancien : récupère main (git fetch origin main puis rebase) et garde le travail des autres`);
const vb = gameVersion(before), vn = gameVersion(now);
if (cmp(vn, vb) < 0) fails.push(`GAME_VERSION recule : ${vb} sur ${ref}, ${vn} ici. Prends le numéro suivant de main`);

// alerte de taille : fichiers du jeu dont le poids change de plus de 25 % (et de plus de 20 Ko)
const files = ["index.html", "sw.js", ...fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => "js/" + f), ...fs.readdirSync(path.join(ROOT, "css")).map((f) => "css/" + f)];
const warns = [];
for (const f of files) {
  const old = tryGit("cat-file", "-s", `${ref}:${f}`); if (old === null) continue;
  const a = +old, b = fs.statSync(path.join(ROOT, f)).size;
  if (Math.abs(b - a) > 20480 && Math.abs(b - a) > a * 0.25) warns.push(`${f} : ${Math.round(a / 1024)} Ko → ${Math.round(b / 1024)} Ko`);
}
const gh = !!process.env.GITHUB_ACTIONS;
warns.forEach((w) => console.log(gh ? `::warning::Garde-fou : ${w}` : `attention (taille) : ${w}`));
if (fails.length) { fails.forEach((f) => console.log(gh ? `::error::Garde-fou : ${f}` : `GARDE-FOU : ${f}`)); process.exit(1); }
console.log(`garde-fou : ok (comparé à ${ref}, ${versions(now).size} versions, ${vn})`);
