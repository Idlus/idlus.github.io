/* Builds du Monocompte (2.2.4.1, Mathis 04/11 : « la page des builds n'est pas sur monocompte ») :
   fabrique supabase/mono_builds.sql à partir de supabase/builds.sql, avec des tables et des fonctions à part
   (mono_builds, mono_build_likes…, mono_builds_list, mono_build_publish…, adm_builds_mono, adm_build_set_mono),
   comme l'HdV de saison : les builds du Monocompte ne se mélangent pas à ceux du Classique.
   Lancer : node tools/mono_builds.js   (tests/mono_builds_sql.test.js vérifie que le fichier est à jour) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const NAMES = {
  builds: "mono_builds", build_likes: "mono_build_likes", build_views: "mono_build_views", build_reports: "mono_build_reports",
  build_row: "mono_build_row", builds_list: "mono_builds_list", builds_me: "mono_builds_me", build_publish: "mono_build_publish",
  build_delete: "mono_build_delete", build_like: "mono_build_like", build_view: "mono_build_view", build_report: "mono_build_report",
  adm_builds: "adm_builds_mono", adm_build_set: "adm_build_set_mono",
  builds_user: "mono_builds_user", builds_cls_lvl: "mono_builds_cls_lvl", build_likes_at: "mono_build_likes_at",
};
const make = () => {
  const src = fs.readFileSync(path.join(ROOT, "supabase/builds.sql"), "utf8");
  const re = new RegExp(`\\b(${Object.keys(NAMES).join("|")})\\b`, "g");
  const body = src.split("\n").map((l) => (/^\s*--/.test(l) ? l : l.replace(re, (m) => NAMES[m]))).join("\n");
  return `-- FICHIER FABRIQUÉ par tools/mono_builds.js à partir de supabase/builds.sql : ne pas modifier à la main (relancer le script).
-- Builds du Monocompte (2.2.4.1) : mêmes règles que les builds du Classique, tables et fonctions à part (mono_*).
-- Installation : workflow « Serveur OVH », étape mono-builds (accord écrit de Mathis). Relançable sans danger.
${body}`;
};
module.exports = { make, NAMES };
if (require.main === module) { fs.writeFileSync(path.join(ROOT, "supabase/mono_builds.sql"), make()); console.log("supabase/mono_builds.sql écrit"); }
