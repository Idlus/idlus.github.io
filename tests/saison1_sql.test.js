/* Saison 1, lot 0b : espace de saison « s1 » (tools/saison_schema.js → supabase/saison1.sql + js/saison1_srv.js).
   - les deux fichiers fabriqués sont à jour (relancer node tools/saison_schema.js après un changement d'un fichier SQL déployé) ;
   - le compte reste partagé : profils, pseudos, chat et admins ne sont jamais recréés dans s1 ;
   - avec IDLUS_PG (Postgres jetable, jamais la base en ligne) : tous les fichiers déployés puis saison1.sql deux fois sans erreur,
     les tables du Classique ne bougent pas, s1 a les mêmes règles RLS et aucune fonction plus ouverte que sa jumelle de public.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/saison1_sql.test.js */
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const G = require(path.join(ROOT, "tools/saison_schema.js"));
const { sql, own } = G.build();
assert.strictEqual(fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8"), sql, "supabase/saison1.sql pas à jour : node tools/saison_schema.js");
const js = fs.readFileSync(path.join(ROOT, "js/saison1_srv.js"), "utf8");
assert(js.includes(JSON.stringify(own)), "js/saison1_srv.js pas à jour : node tools/saison_schema.js");
for (const n of ["profiles", "chat_msgs", "admins", "pseudo_of", "chat_send", "is_admin"]) assert(!own.includes(n), `${n} doit rester partagé`);
for (const n of ["saves", "push_save", "save_info", "ladder", "hdv_listings", "guilds"]) assert(own.includes(n), `${n} doit exister dans la saison`);
assert(!/\bpublic\.(saves|ladder|hdv_listings|push_save)\b/.test(sql), "un objet de saison vise encore public");
// le jeu (js/online.js) route seulement vers s1 la partie 5, et la fonction « record » suit (saison: 1)
const on = fs.readFileSync(path.join(ROOT, "js/online.js"), "utf8");
assert(/const S1_N = 5;/.test(on) && /sb\.schema\("s1"\)/.test(on) && !/\bsb\.(rpc|from)\(/.test(on), "js/online.js : appels hors du routage de saison");
const rec = fs.readFileSync(path.join(ROOT, "supabase/functions/record/index.ts"), "utf8");
assert(/body\.saison === 1 \? seasonDb\(db0\) : db0/.test(rec), "fonction record : espace de saison absent");
const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert(idx.indexOf("js/saison1_srv.js") > 0 && idx.indexOf("js/saison1_srv.js") < idx.indexOf("js/online.js"), "index.html : saison1_srv.js avant online.js");
console.log("ok - espace de saison s1 : fichiers à jour, compte partagé, routage du jeu et de la fonction record");

const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : chargement SQL sauté)"); process.exit(0); }
const DB = "idlus_saison1";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const q = (s, u) => execFileSync("psql", [u || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64e6 }).trim();
q(`drop database if exists ${DB}`, URL0); q(`create database ${DB}`, URL0);
try {
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
     create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
     set client_min_messages = error; create publication supabase_realtime;
     grant usage on schema public to anon, authenticated, service_role;
     alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
     alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
     alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;`);
  const files = (/tous="([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8")) || [])[1].split(/\s+/);
  for (let pass = 0; pass < 2; pass++) for (const f of files) { try { q("set client_min_messages = error;\n" + fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { if (pass) throw new Error(f + " : " + e.stderr); } }
  const snap = () => q(`select string_agg(c.relname || ':' || c.relrowsecurity, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v')`);
  const before = snap();
  q("set client_min_messages = error;\n" + sql); q("set client_min_messages = error;\n" + sql); // relançable
  assert.strictEqual(snap(), before, "le Classique (public) a changé");
  const n = q(`select count(*) from pg_tables where schemaname = 's1'`); assert(+n > 50, "trop peu de tables dans s1 : " + n);
  const rls = q(`select string_agg(c.relname, ',') from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 's1' and c.relkind = 'r' and not c.relrowsecurity
    and exists (select 1 from pg_class d join pg_namespace m on m.oid = d.relnamespace where m.nspname = 'public' and d.relname = c.relname and d.relrowsecurity)`);
  assert.strictEqual(rls, "", "tables de saison sans RLS : " + rls);
  for (const role of ["anon", "authenticated"]) {
    const open = q(`select string_agg(distinct p.proname, ',') from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 's1' and has_function_privilege('${role}', p.oid, 'execute')
      and exists (select 1 from pg_proc x join pg_namespace m on m.oid = x.pronamespace where m.nspname = 'public' and x.proname = p.proname and pg_get_function_identity_arguments(x.oid) = pg_get_function_identity_arguments(p.oid) and not has_function_privilege('${role}', x.oid, 'execute'))`);
    assert.strictEqual(open, "", `fonctions de saison plus ouvertes que le Classique pour ${role} : ${open}`);
  }
  console.log(`ok - saison1.sql chargé deux fois sur une base jetable : ${n} tables dans s1, Classique intact, mêmes règles et mêmes droits`);
} finally { q(`drop database if exists ${DB}`, URL0); }
