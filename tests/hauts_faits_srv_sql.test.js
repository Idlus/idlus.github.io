/* 2.2.4.9 « Hauts faits par serveur » (Mathis, 04/11 : un stasis 15 de l'Éternel pris pour de la triche en Saison 1) :
   chaque haut fait dit de quel serveur il vient (data.srv), dans un vrai Postgres jetable (jamais la base en ligne) :
   - public.chat_ann (supabase/chat.sql) ajoute srv 'e' ;
   - s1.chat_ann (supabase/chat_s1.sql) : appelée par les fonctions de la saison (search_path s1, public), ajoute srv 's',
     lit le classement de la saison (compte signalé en saison = pas d'annonce) ;
   - saison1.sql contient bien s1.chat_ann (tools/saison_schema.js).
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/hauts_faits_srv_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_hf_srv » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert"); const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const s1 = fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8");
assert(/create or replace function s1\.chat_ann\(p_user uuid, p_data jsonb\)[^]*?set search_path = s1, public/.test(s1), "saison1.sql : s1.chat_ann présente");
console.log("ok - saison1.sql contient s1.chat_ann");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - hauts faits par serveur (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_hf_srv";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => run("set lock_timeout = '3s';\n" + fs.readFileSync(path.join(ROOT, "supabase", f), "utf8"));
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql"); file("chat.sql");
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users on conflict do nothing;
     insert into ladder (user_id, main, main_lvl) values ('${U(1)}', 'feca', 200), ('${U(2)}', 'iop', 200);
     create schema s1; create table s1.ladder (like public.ladder including defaults);
     insert into s1.ladder (user_id, main, main_lvl, flagged) values ('${U(1)}', 'cra', 12, false), ('${U(2)}', 'sacri', 30, true);`);
  file("chat_s1.sql");
  q(`create function s1.feat(u uuid) returns void language plpgsql security definer set search_path = s1, public as $$ begin perform chat_ann(u, jsonb_build_object('t', 'chroma', 'k', 'x')); end $$;`);
  q(`select public.chat_ann('${U(1)}', jsonb_build_object('t', 'first', 'label', 'stasis 15'))`);
  q(`select s1.feat('${U(1)}'); select s1.feat('${U(2)}');`);
  assert.strictEqual(q(`select string_agg(data->>'t' || ':' || (data->>'srv') || ':' || cls || ':' || lvl, ',' order by id) from chat_msgs`), "first:e:feca:200,chroma:s:cra:12", "Éternel 'e' (classement public), Saison 1 's' (classement de la saison), compte signalé en saison : rien");
  q(`select public.chat_ann('${U(1)}', jsonb_build_object('t', 'first', 'srv', 's'))`);
  assert.strictEqual(q(`select data->>'srv' from chat_msgs order by id desc limit 1`), "s", "un serveur déjà posé par l'appel est gardé");
  assert.strictEqual(q(`select has_function_privilege('authenticated', 's1.chat_ann(uuid, jsonb)', 'execute')::text`), "false", "s1.chat_ann : pas appelable par les joueurs");
  console.log("ok - hauts faits : serveur Éternel ou Saison 1 dans chaque annonce");
  // 05/11 (tickets 27, 48, 49) : un niveau 200, une renaissance ou un Dofus ne part qu'une fois par compte et par serveur
  q(`delete from chat_msgs`);
  q(`create function s1.lvl(u uuid) returns void language plpgsql security definer set search_path = s1, public as $$ begin perform chat_ann(u, jsonb_build_object('t', 'lvl200', 'cls', 'cra', 'name', 'Bozo', 'ren', 0)); end $$;`);
  for (let i = 0; i < 3; i++) q(`select public.chat_ann('${U(1)}', jsonb_build_object('t', 'lvl200', 'cls', 'cra', 'name', 'Bozo', 'ren', 0)); select public.chat_ann('${U(1)}', jsonb_build_object('t', 'dofus', 'id', 'dofus_emeraude')); select s1.lvl('${U(1)}');`);
  q(`select public.chat_ann('${U(1)}', jsonb_build_object('t', 'lvl200', 'cls', 'cra', 'name', 'Bozo', 'ren', 1))`); // après une renaissance : nouveau haut fait
  q(`select public.chat_ann('${U(1)}', jsonb_build_object('t', 'chroma', 'k', 'x')); select public.chat_ann('${U(1)}', jsonb_build_object('t', 'chroma', 'k', 'x'))`); // les autres annonces ne changent pas
  assert.strictEqual(q(`select string_agg(data->>'t' || ':' || (data->>'srv') || ':' || coalesce(data->>'ren', data->>'id', data->>'k'), ',' order by id) from chat_msgs`),
    "lvl200:e:0,dofus:e:dofus_emeraude,lvl200:s:0,lvl200:e:1,chroma:e:x,chroma:e:x", "chaque haut fait une seule fois par serveur");
  assert.strictEqual(q(`select has_table_privilege('authenticated', 'public.chat_ann_once', 'select')::text`), "false", "chat_ann_once : invisible pour les joueurs");
  console.log("ok - hauts faits : un niveau 200, une renaissance ou un Dofus n'est annoncé qu'une fois");
} finally { run(`drop database if exists ${DB}`, URL0); }
