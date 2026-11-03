/* Saison 1, quêtes : supabase/histoire_s1.sql dans un vrai Postgres jetable (jamais la base en ligne) : semaine de la
   saison, un joueur compté une fois par chapitre et seulement pendant la semaine du chapitre, nombres lisibles par tous
   sans les comptes, aucune écriture directe ; copie dans l'espace de saison s1.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/histoire_sql.test.js
   Sans IDLUS_PG, la partie SQL est sautée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
assert(fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8").includes("create table if not exists s1.camp_fin"), "copie dans s1 (node tools/saison_schema.js)");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - campagne : copie s1 (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_histoire_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; select ${s}`);
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); assert(re.test(String(e0.stderr || e0.message)), why); };
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;`);
  q(`create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role;`);
  file(path.join(ROOT, "supabase", "saison1_vitrine.sql"));
  file(path.join(ROOT, "supabase", "histoire_s1.sql")); file(path.join(ROOT, "supabase", "histoire_s1.sql")); // relancé : sans danger
  q(`grant select on all tables in schema public to anon, authenticated;`);
  for (let i = 1; i <= 4; i++) q(`insert into auth.users values ('${U(i)}')`);
  assert.strictEqual(q(`select camp_wk()`), "0", "saison pas ouverte");
  assert.strictEqual(as(1, `camp_done(1)`), "0", "avant l'ouverture : rien n'est compté");
  q(`update s1_cfg set debut = now() - interval '2 days'`); assert.strictEqual(q(`select camp_wk()`), "1");
  assert.strictEqual(as(1, `camp_done(1)`), "1"); assert.strictEqual(as(1, `camp_done(1)`), "1", "une fois par compte");
  assert.strictEqual(as(2, `camp_done(1)`), "2"); assert.strictEqual(as(3, `camp_done(2)`), "0", "chapitre 2 pas encore ouvert");
  q(`update s1_cfg set debut = now() - interval '9 days'`); assert.strictEqual(q(`select camp_wk()`), "2");
  assert.strictEqual(as(3, `camp_done(1)`), "2", "chapitre 1 fini en retard : pas compté pour l'objectif");
  assert.strictEqual(as(3, `camp_done(2)`), "1");
  assert.deepStrictEqual(JSON.parse(q(`set role anon; select camp_count()`)), { 1: 2, 2: 1 }, "nombres lisibles par tous");
  fails(() => as(1, `camp_done(9)`), /chapitre inconnu/, "chapitre hors de la campagne");
  fails(() => q(`set role anon; select camp_done(1)`), /permission|connexion/, "sans compte");
  fails(() => q(`set role authenticated; set request.jwt.claim.sub = '${U(4)}'; insert into camp_fin values ('${U(4)}', 1)`), /permission/, "pas d'écriture directe");
  assert.strictEqual(as(4, `count(*) from camp_fin`), "0", "chacun ne voit que ses lignes");
  q(`update s1_cfg set debut = now() - interval '70 days'`); assert.strictEqual(q(`select camp_wk()`), "9", "après la saison");
  console.log("ok - campagne de saison (SQL) : semaine, une fois par compte, seulement pendant la semaine du chapitre, nombres publics, pas d'écriture directe");
} finally { psql(`drop database if exists ${DB}`); }
