/* La fonction serveur « record » (supabase/functions/record/index.ts) doit au moins se lire : une accolade oubliée
   (1.0.30, fusion de branches) faisait tomber tout le serveur de jeu (Boss des mondes, Kolizéum, Défi, guildes, records)
   alors que tous les autres tests passaient. Le fichier est lu sans Deno : types retirés par Node (22.6 et plus),
   imports et Deno remplacés par des leurres, puis chargé. Lancer : node tests/serveur.test.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "supabase/functions/record/index.ts"), "utf8");

/* accolades, parenthèses et crochets équilibrés (chaînes, gabarits et commentaires sautés) */
function balance(s) {
  const st = []; const open = { "{": "}", "(": ")", "[": "]" }; let line = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\n") { line++; continue; }
    if (c === "/" && s[i + 1] === "/") { while (i < s.length && s[i] !== "\n") i++; line++; continue; }
    if (c === "/" && s[i + 1] === "*") { i += 2; while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) { if (s[i] === "\n") line++; i++; } i++; continue; }
    if (c === "'" || c === '"') { i++; while (i < s.length && s[i] !== c) { if (s[i] === "\\") i++; i++; } continue; }
    if (c === "`" || (c === "}" && st[st.length - 1] === "${")) {
      if (c === "}") st.pop();
      i++; while (i < s.length && s[i] !== "`") { if (s[i] === "\\") i++; else if (s[i] === "$" && s[i + 1] === "{") { st.push("${"); i++; break; } else if (s[i] === "\n") line++; i++; }
      continue;
    }
    if (open[c]) st.push(open[c]);
    else if (c === "}" || c === ")" || c === "]") { const want = st.pop(); if (want !== c) return `« ${c} » inattendu ligne ${line} (attendu « ${want || "rien"} »)`; }
  }
  return st.length ? `il manque « ${st.reverse().join(" ")} » à la fin du fichier` : "";
}
const errs = [];
const b = balance(src); if (b) errs.push("record/index.ts : " + b);

const [maj, min] = process.versions.node.split(".").map(Number);
if (!b && (maj > 22 || (maj === 22 && min >= 6))) {
  const tmp = path.join(os.tmpdir(), `idlus-record-${process.pid}.mts`);
  fs.writeFileSync(tmp, "globalThis.Deno = { serve() {}, env: { get() { return ''; } } }; const createClient = () => ({}); const D = {}, E = {}, V = {};\n" + src.replace(/^import .*$/gm, ""));
  try { execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", tmp], { stdio: "pipe" }); }
  catch (e) { errs.push("record/index.ts ne se charge pas : " + String(e.stderr || e.message).split("\n").filter((l) => /Error|ligne|:\d+/.test(l)).slice(0, 3).join(" | ")); }
  finally { fs.unlinkSync(tmp); }
}
if (errs.length) { console.error("ÉCHEC\n" + errs.join("\n")); process.exit(1); }
console.log("ok - la fonction serveur « record » se lit");
