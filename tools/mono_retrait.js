/* Retrait des gains venus du Classique dans deux parties Monocompte (22/10/2026, choix écrit de Mathis : « 2 » puis « a et préviens les »).
   Lit le relevé (pseudo, user_id, data, updated_at) et la consigne CIBLES (JSON) :
     { "Pseudo": { "kamas": n } }   retire n kamas (sans descendre sous 0)
     { "Pseudo": { "havre": n } }   retire des niveaux de Havre-Sac, les plus chers d'abord, pour au moins n kamas de valeur
   Mode essai (par défaut) : n'écrit rien, affiche les changements. Mode vrai : écrit un fichier SQL (une transaction, contrôle de
   updated_at : si le joueur a sauvegardé entre-temps, rien n'est écrit) qui remet la partie avec la marque « remise » (comme
   mono_adm_restaurer : le jeu la reprend sans question). N'affiche que des chiffres.
   Lancer : node tools/mono_retrait.js releve.json [sortie.sql] */
"use strict";
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
for (const f of ["gamedata", "data", "engine", "systems"]) { const p = path.join(__dirname, "../js", f + ".js"); if (fs.existsSync(p)) require(p); }
const E = globalThis.ENGINE;
const fm = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
const CIBLES = JSON.parse(process.env.CIBLES || "{}");
let R = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); if (!Array.isArray(R)) R = [R];
const out = process.argv[3]; const sql = ["begin;", "set local lock_timeout = '3s';"];
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let ok = true;
for (const r of R) {
  const c = CIBLES[r.pseudo]; if (!c) continue;
  const S = JSON.parse(r.data); const k0 = Math.floor(+S.kamas || 0); const h0 = JSON.stringify(S.havre || {});
  if (c.kamas) { const n = Math.min(k0, Math.floor(c.kamas)); S.kamas = k0 - n; console.log(`== ${r.pseudo} : kamas ${fm(k0)} → ${fm(S.kamas)} (−${fm(n)})`); }
  if (c.havre) {
    let rest = c.havre; const H = E.HAVRE; const pris = {};
    while (rest > 0) {
      let best = null; for (const x of H) { const l = (S.havre || {})[x.id] || 0; if (l > 0) { const v = Math.round(x.base * Math.pow(x.g, l - 1)); if (!best || v > best.v) best = { id: x.id, v }; } }
      if (!best) { console.log("   plus aucun niveau à retirer"); break; }
      S.havre[best.id]--; if (!S.havre[best.id]) delete S.havre[best.id]; rest -= best.v; pris[best.id] = (pris[best.id] || 0) + 1;
    }
    const val = c.havre - rest;
    console.log(`== ${r.pseudo} : Havre-Sac ${h0} → ${JSON.stringify(S.havre)} ; retiré ${Object.entries(pris).map(([id, n]) => `${E.HAVRE.find((x) => x.id === id).name} −${n}`).join(", ")} (valeur ${fm(val)} kamas)`);
  }
  const ops = typeof r.ops === "string" ? JSON.parse(r.ops) : (r.ops || []); const cur = (S.hdv && S.hdv.op) || 0;
  console.log(`   curseur S.hdv.op ${cur} ; dernier n° du registre Monocompte ${r.op_max} ; ${ops.length} opération(s) Monocompte : ${ops.map((o) => `${o.id} (${String(o.at).slice(0, 16)}, ${fm(o.k)} k)`).join(", ") || "aucune"}`);
  if (!r.user_id || !r.updated_at) { ok = false; continue; }
  const jour = new Date().toISOString().slice(0, 10);
  sql.push(`do $rz$ begin perform mono.verrou(${q(r.user_id)}::uuid); update mono.parties set data = ${q(JSON.stringify(S))}, meta = meta || jsonb_build_object('remise', ${q(jour)}), updated_at = clock_timestamp() where user_id = ${q(r.user_id)}::uuid and saison = 0 and updated_at = ${q(r.updated_at)}::timestamptz; if not found then raise exception 'partie de % changée entre-temps : relancer', ${q(r.pseudo)}; end if; end $rz$;`);
}
sql.push("commit;");
if (out) { if (!ok) { console.error("relevé incomplet"); process.exit(1); } fs.writeFileSync(out, sql.join("\n")); console.log(`SQL prêt (${sql.length - 3} partie(s))`); }
