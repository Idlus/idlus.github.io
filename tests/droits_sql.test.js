/* 05/11/2026 : droits d'écriture des joueurs retirés des tables (supabase/droits.sql), dans un vrai Postgres jetable
   (jamais la base en ligne) : plus d'insert / update / delete / truncate pour anon et authenticated, sauf créer son
   pseudo (profiles) et ignorer un joueur (ignores) ; la lecture et les fonctions du serveur (chat_send) marchent toujours.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/droits_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_droits » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert"); const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - droits d'écriture (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_droits";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const file = (f) => run("set lock_timeout = '3s';\n" + fs.readFileSync(path.join(ROOT, "supabase", f), "utf8"));
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  run(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;
     alter default privileges in schema public grant all on tables to anon, authenticated;`);
  file("schema.sql"); file("classements.sql"); file("chat.sql");
  const P = (r, t, p) => `has_table_privilege('${r}', 'public.${t}', '${p}')`;
  assert.strictEqual(run(`select ${P("authenticated", "bouclier_log", "insert")}::text`), "true", "avant : droits par défaut de Supabase");
  file("droits.sql"); file("droits.sql"); // relançable
  assert.strictEqual(run(`select concat_ws(',', ${P("authenticated", "bouclier_log", "insert")}, ${P("anon", "admins", "truncate")}, ${P("authenticated", "saves", "update")}, ${P("authenticated", "profiles", "update")}, ${P("anon", "lb_level", "delete")})`), "f,f,f,f,f", "plus aucune écriture directe");
  assert.strictEqual(run(`select concat_ws(',', ${P("authenticated", "chat_msgs", "select")}, ${P("anon", "lb_level", "select")}, ${P("authenticated", "profiles", "insert")}, ${P("authenticated", "ignores", "insert")}, ${P("authenticated", "ignores", "delete")})`), "t,t,t,t,t", "lecture, pseudo et ignorés gardés");
  run(`insert into auth.users values ('${U(1)}'), ('${U(2)}');
     set role authenticated; select set_config('request.jwt.claim.sub', '${U(1)}', false);
     insert into public.profiles (id, pseudo) values ('${U(1)}', 'Testeur');
     insert into public.ignores (user_id, other) values ('${U(1)}', '${U(2)}'); delete from public.ignores where other = '${U(2)}';
     select public.chat_send('bonjour'); reset role;`);
  assert.strictEqual(run(`select count(*)::text from public.chat_msgs`), "1", "le chat passe toujours par sa fonction");
  console.log("ok - droits d'écriture : seules les fonctions du serveur écrivent, sauf pseudo et ignorés");
} finally { run(`drop database if exists ${DB}`, URL0); }
