/* ============================================================================
   Saison 1, lot 0b : espace de saison « s1 » dans la même base (Mathis, choix « Un espace de saison »).
   Fabrique supabase/saison1.sql à partir des fichiers déployés par le workflow « Serveur en ligne »
   (.github/workflows/supabase.yml, liste « tous ») : chaque table, vue et fonction du Classique est recréée dans
   le schéma s1, vide. Les comptes restent partagés (même connexion) : profils, pseudos, suspensions, admins,
   modération, chat, bugs, idées, codes cadeaux et annonces restent dans public.
   Le jeu choisit l'espace à la connexion (createClient … db.schema = "s1") pour la partie Classique · Saison 1 :
   tous les appels (rpc, from, realtime) partent alors dans s1, sans autre changement dans le jeu.
   NE S'INSTALLE PAS TOUT SEUL : Mathis a demandé (03/11) de tout préparer avant d'envoyer quoi que ce soit au serveur.
   Lancer : node tools/saison_schema.js   (écrit supabase/saison1.sql)
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const SCHEMA = "s1";
// fichiers dont tout reste partagé entre l'Éternel et la saison
const SHARED_FILES = ["supabase/chat.sql", "supabase/bugs.sql", "supabase/idees.sql", "supabase/codes.sql", "supabase/annonces_boucle.sql", "supabase/annonces_srv.sql", "supabase/vote.sql"]; // vote : public, la récompense va dans la partie ouverte (vote_verse : hdv_ops, s1.hdv_ops ou mono.ops, 04/11)
// objets de supabase/schema.sql qui restent partagés : le compte, le pseudo, la suspension, le journal des admins
// fichiers propres à la saison (pas dans la liste « tous ») : registre des Fragments et vitrine (lot 4)
const EXTRA = ["supabase/saison1_vitrine.sql", "supabase/tournoi.sql", "supabase/wboss_s1.sql", "supabase/histoire_s1.sql", "supabase/classements_s1.sql"]; // lot 8 : Tournoi des guildes (aussi dans public, pour l'Éternel) ; wboss_s1 : règles du boss des mondes de saison (remplace wb_info/wb_start/wb_done de s1)
const SHARED_OBJ = ["profiles", "susp", "susp_lift", "delete_my_account", "admin_log", "alog", "adm_need", "adm_suspend", "is_admin", "is_staff", "my_role", "admins", "mods"];

function files() {
  const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8");
  const tous = (/tous="([^"]+)"/.exec(yml) || [])[1];
  if (!tous) throw new Error("liste « tous » introuvable dans supabase.yml");
  const L = tous.split(/\s+/).filter(Boolean);
  // base neuve : defi.sql lit les guildes, il passe après guildes.sql (sur le serveur actuel, elles existaient déjà)
  const AFTER = { "supabase/defi.sql": "supabase/guildes.sql" };
  for (const [f, a] of Object.entries(AFTER)) { const i = L.indexOf(f); if (i >= 0 && L.indexOf(a) > i) { L.splice(i, 1); L.splice(L.indexOf(a) + 1, 0, f); } }
  return L.concat(EXTRA); // fichiers propres à la saison, jamais installés dans le Classique
}
// noms créés par un fichier (tables, vues, fonctions, types, séquences)
function defined(sql) {
  const re = /create\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view|function|type|sequence)\s+(?:if\s+not\s+exists\s+)?public\.([a-z_0-9]+)/gi;
  const out = new Set(); let m; while ((m = re.exec(sql))) out.add(m[1].toLowerCase()); return out;
}
function build() {
  const list = files();
  const shared = new Set(SHARED_OBJ);
  for (const f of SHARED_FILES) if (list.includes(f)) defined(fs.readFileSync(path.join(ROOT, f), "utf8")).forEach((n) => shared.add(n));
  const parts = [`-- FICHIER FABRIQUÉ par tools/saison_schema.js : ne pas modifier à la main (relancer le script).
-- Espace de la Saison 1 : schéma ${SCHEMA}, recréé à côté de public. Les comptes (profils, pseudos, admins, chat) restent dans public.
-- Relançable sans danger, comme les autres fichiers. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.
create schema if not exists ${SCHEMA};
-- mêmes droits par défaut que public sur Supabase (tools/serveur/restaurer.sh) : les règles RLS et les « revoke » des fichiers font le reste
grant usage on schema ${SCHEMA} to postgres, anon, authenticated, service_role;
grant all on schema ${SCHEMA} to postgres, service_role;
alter default privileges in schema ${SCHEMA} grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema ${SCHEMA} grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema ${SCHEMA} grant all on sequences to postgres, anon, authenticated, service_role;
-- À L'INSTALLATION : ajouter ${SCHEMA} à PGRST_DB_SCHEMAS (API du serveur), puis recharger l'API.
`];
  for (const f of list) {
    if (SHARED_FILES.includes(f)) continue;
    let sql = fs.readFileSync(path.join(ROOT, f), "utf8");
    sql = sql.replace(/\bpublic\.([a-z_0-9]+)/gi, (all, n) => (shared.has(n.toLowerCase()) ? all : `${SCHEMA}.${n}`));
    sql = sql.replace(/\bpublic\.(?=['%"])/g, `${SCHEMA}.`); // droits donnés dans une boucle (« execute 'grant … on function public.' || f »)
    sql = sql.replace(/\b(nspname|schemaname|table_schema)\s*=\s*'public'/g, `$1 = '${SCHEMA}'`); // boucles sur le catalogue (droits, colonnes)
    sql = sql.replace(/search_path\s*=\s*public\b/gi, `search_path = ${SCHEMA}, public`);
    // la publication du temps réel est commune : on y ajoute les tables de la saison
    parts.push(`\n-- ======================== ${f} ========================\nset search_path = ${SCHEMA}, public;\n${sql}\nreset search_path;\n`);
  }
  // objets recréés dans la saison : le jeu (js/online.js) envoie dans s1 les appels qui les visent, le reste (compte, chat…) reste dans public
  const own = new Set(); for (const f of list) if (!SHARED_FILES.includes(f)) defined(fs.readFileSync(path.join(ROOT, f), "utf8")).forEach((n) => { if (!shared.has(n)) own.add(n); });
  return { sql: parts.join(""), shared: [...shared].sort(), own: [...own].sort() };
}
module.exports = { build, SCHEMA, SHARED_FILES, SHARED_OBJ, EXTRA };
if (require.main === module) {
  const { sql, shared, own } = build();
  fs.writeFileSync(path.join(ROOT, "supabase/saison1.sql"), sql);
  fs.writeFileSync(path.join(ROOT, "js/saison1_srv.js"), `/* FICHIER FABRIQUÉ par tools/saison_schema.js (ne pas modifier à la main).
   Tables, vues et fonctions de l'espace de saison « ${SCHEMA} » (supabase/saison1.sql) : une partie Classique · Saison 1
   envoie dans ${SCHEMA} les appels qui les visent (js/online.js) ; le compte, les pseudos et le chat restent dans public. */
window.S1_OBJ = ${JSON.stringify(own)};
`);
  console.log(`supabase/saison1.sql : ${(sql.length / 1024).toFixed(0)} Ko, ${shared.length} objets partagés gardés dans public`);
}
