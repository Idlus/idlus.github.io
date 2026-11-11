/* 11/11/2026 (audit de sécurité) : index.html porte une règle CSP qui interdit le JavaScript écrit dans le HTML. Ce test
   vérifie que la règle est là et qu'aucun fichier du jeu ne remet un gestionnaire inline (onerror="…", onclick="…"),
   qui serait bloqué par le navigateur. Pour une image de secours : data-fb / data-oe="h" (js/ui.js). */
"use strict";
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
assert.ok(m, "règle CSP absente d'index.html");
assert.ok(/script-src 'self'(;|$)/.test(m[1]), "script-src doit rester 'self' seul");
assert.ok(/object-src 'none'/.test(m[1]) && /base-uri 'self'/.test(m[1]), "object-src / base-uri");
assert.ok(!/<script>(?!\s*<\/script>)/.test(html) && !/<script(?![^>]*\ssrc=)[^>]*>/.test(html), "script inline dans index.html");
const bad = [];
for (const f of fs.readdirSync(path.join(ROOT, "js"))) {
  if (!f.endsWith(".js")) continue;
  fs.readFileSync(path.join(ROOT, "js", f), "utf8").split("\n").forEach((l, i) => { if (/<[a-z][^>]*\son[a-z]+=["'\\]/i.test(l)) bad.push(`js/${f}:${i + 1}`); });
}
assert.deepStrictEqual(bad, [], "gestionnaires inline bloqués par la CSP : " + bad.join(", "));
console.log("ok - CSP : règle présente, aucun gestionnaire inline");
