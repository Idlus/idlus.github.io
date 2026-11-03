/* tools/serveur/mono_saison1.sql dans un Postgres jetable (jamais la base en ligne) : la saison de test de la bêta finit, ses
   héros passent dans l'Éternel du Monocompte (rien d'effacé), la Saison 1 s'ouvre ; relancé, rien ne change.
   Lancer : IDLUS_PG=... node tests/mono_saison1_sql.test.js (sans IDLUS_PG : sauté). */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - ouverture de la Saison 1 du Monocompte (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_mono_s1_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated;
     create table public.ladder (user_id uuid primary key references auth.users(id) on delete cascade, flagged boolean default false, flag_reason text, main text, main_lvl int);
     create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade); alter table public.admins enable row level security;
     create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;`);
  file(path.join(ROOT, "supabase", "schema.sql"));
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  for (const f of ["monocompte.sql"]) file(path.join(ROOT, "supabase", f));
  for (let i = 1; i <= 4; i++) q(`insert into auth.users values ('${U(i)}'); insert into public.profiles (id, pseudo) values ('${U(i)}', 'Joueur${i}') on conflict do nothing;`);
  q(`insert into public.admins values ('${U(1)}')`);
  file(path.join(ROOT, "tools", "serveur", "monocompte_installer.sql"));
  assert.strictEqual(q(`select mono.acces('${U(2)}')`), "f", "pendant la bêta : non-testeur refusé");
  for (let i = 1; i <= 3; i++) q(`insert into mono.parties (user_id, saison, data) values ('${U(i)}', 0, 'partie${i}')`);
  file(path.join(ROOT, "tools", "serveur", "mono_saison1.sql"));
  assert.strictEqual(q(`select etat from mono.saisons where id = 0`), "finie", "saison de test finie");
  assert.strictEqual(q(`select etat || ' ' || test || ' ' || coalesce(theme, '') from mono.saisons where id = 1`), "ouverte false Les Fragments du Temps", "Saison 1 ouverte");
  assert.strictEqual(q(`select count(*) from mono.eternel where saison = 0`), "3", "les 3 héros de la bêta dans l'Éternel");
  assert.strictEqual(q(`select string_agg(data, ',' order by data) from mono.eternel`), "partie1,partie2,partie3", "parties gardées telles quelles");
  const d0 = q(`select debut from mono.saisons where id = 1`);
  file(path.join(ROOT, "tools", "serveur", "mono_saison1.sql")); // relancé
  assert.strictEqual(q(`select debut from mono.saisons where id = 1`), d0, "date de la Saison 1 inchangée");
  assert.strictEqual(q(`select count(*) from mono.eternel`), "3", "rien en double");
  const A = JSON.parse(q(`set role authenticated; set request.jwt.claim.sub = '${U(2)}'; select mono_acces()`));
  assert.strictEqual(A.ok, true, "un joueur qui n'est pas testeur entre dans le Monocompte");
  assert.strictEqual(A.saison && A.saison.id, 1, "le jeu voit la Saison 1");
  assert.strictEqual(q(`select mono.acces(null)`), "f", "sans compte : refusé");
  // une partie de la bêta (sid 0, ou sans sid : jeu d'avant 2.2.0) n'entre pas dans la Saison 1 ; une partie de Saison 1 oui
  const push = (i, meta) => q(`select mono.push('${U(i)}', 'p${i}', '${JSON.stringify(meta)}'::jsonb, '2.2.0', 'appareil', null)`);
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); assert(re.test(String(e0.stderr || e0.message)), why + " : " + (e0.stderr || e0.message)); };
  fails(() => push(2, { gen: 1, sid: 0 }), /autre saison/, "partie de la bêta (sid 0)");
  fails(() => push(3, { gen: 1 }), /autre saison/, "partie sans saison (jeu d'avant 2.2.0)");
  assert.strictEqual(q(`select count(*) from mono.parties where saison = 1`), "0", "aucune partie de bêta en Saison 1");
  push(4, { gen: 0, sid: 1 });
  assert.strictEqual(q(`select count(*) from mono.parties where saison = 1 and user_id = '${U(4)}'`), "1", "partie de Saison 1 acceptée");
  console.log("ok - ouverture de la Saison 1 du Monocompte : bêta finie, héros dans l'Éternel, Saison 1 ouverte, relançable");
} finally { psql(`drop database if exists ${DB}`); }
