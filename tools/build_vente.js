/* 1.0.30 « L'économie » : prix de base de chaque ressource vendable au jeu (E.venteOk, E.resPrice), écrit dans
   supabase/vente_data.sql pour que le serveur calcule le prix lui-même (le jeu ne peut pas l'inventer).
   À relancer quand les données du jeu changent : node tools/build_vente.js (tests/vente.test.js vérifie que le fichier est à jour).
   Le fichier ne fait qu'ajouter ou mettre à jour des prix : rien n'est jamais supprimé. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
globalThis.window = globalThis;
// tous les fichiers du moteur, dans l'ordre de index.html (ceux d'avant js/vendor/) : certains ajoutent des ressources (Galets du Kolizéum…)
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const all = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => m[1]);
const cut = all.findIndex((f) => f.startsWith("js/vendor/"));
for (const f of all.slice(0, cut < 0 ? all.length : cut)) require(path.join(ROOT, f));
if (!globalThis.ENGINE || !globalThis.ENGINE.venteOk) require(path.join(ROOT, "js", "vente.js"));
const D = globalThis.DATA, E = globalThis.ENGINE;

const rows = () => Object.keys(D.RES).filter((n) => E.venteOk(n)).sort().map((n) => [n, E.resPrice(n)]);
const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const sql = (L) => [
  "-- Généré par tools/build_vente.js : ne pas modifier à la main.",
  "-- 1.0.30 vente directe (supabase/vente.sql) : prix de base de chaque ressource vendable au jeu, en kamas (E.resPrice du jeu).",
  "-- Relançable : ajoute ou met à jour les prix, ne supprime rien.",
  "create table if not exists public.vente_base (key text primary key, base int not null);",
  "alter table public.vente_base enable row level security;",
  `insert into public.vente_base (key, base) values\n${L.map(([n, b]) => `(${q(n)}, ${b})`).join(",\n")}\non conflict (key) do update set base = excluded.base where public.vente_base.base is distinct from excluded.base;`,
  "",
].join("\n");
module.exports = { rows, sql };
if (require.main === module) {
  const L = rows();
  fs.writeFileSync(path.join(ROOT, "supabase", "vente_data.sql"), sql(L));
  console.log(`supabase/vente_data.sql : ${L.length} ressources`);
}
