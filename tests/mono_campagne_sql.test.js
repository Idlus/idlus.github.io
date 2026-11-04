/* Monocompte : objectif commun au serveur de la campagne de saison (supabase/mono_campagne.sql) dans un vrai Postgres jetable.
   - déploiement manuel seulement (jamais dans « Serveur en ligne »), chargé par monocompte-installer après mono_cles.sql et par l'étape monocompte-campagne ;
   - un chapitre n'est compté que pendant sa semaine, une fois par compte et par saison ; nombres de la saison ouverte seulement ;
   - droits : mono_camp_done pour les joueurs connectés, mono_camp_count lisible par tous, table et fonction interne fermées ;
   - relançable : rien d'effacé.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/mono_campagne_sql.test.js */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/schema.sql") && !/mono_campagne/.test(tous), "mono_campagne.sql ne doit pas être déployé automatiquement");
  const ovh = fs.readFileSync(path.join(ROOT, ".github/workflows/serveur-ovh.yml"), "utf8");
  assert(/supabase\/mono_cles\.sql supabase\/mono_campagne\.sql; do/.test(ovh), "monocompte-installer : mono_campagne.sql après mono_cles.sql");
  assert(/inputs\.etape == 'monocompte-campagne'/.test(ovh) && /monocompte-campagne/.test(/options: \[([^\]]+)\]/.exec(ovh)[1]), "étape monocompte-campagne"); }
if (!URL0) { console.log("ok - mono_campagne.sql hors du déploiement automatique (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }

const DB = "idlus_mono_camp";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(ROOT, "supabase", f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); assert(re.test(String(e0.stderr || e0.message)), why + " : " + String(e0.stderr || e0.message)); };
const done = (i, ch) => +as(i, `select mono_camp_done(${ch})`);
const count = () => JSON.parse(q(`set role anon; select mono_camp_count()::text`));
// la saison 1 a commencé il y a d jours (heure de Paris)
const debut = (d) => q(`update mono.saisons set debut = now() - interval '${d} days' - interval '1 hour' where id = 1`);

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql"]) file(f);
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  for (const f of ["monocompte.sql", "amis.sql", "mono_social.sql", "mono_bureau.sql", "mono_cles.sql", "mono_campagne.sql", "mono_campagne.sql"]) file(f);
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 5) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users;
     delete from mono.saisons; insert into mono.saisons (id, nom, debut, etat) values (1, 'Saison 1', now(), 'ouverte');`);
  assert.strictEqual(q(`select has_function_privilege('anon', 'public.mono_camp_done(integer)', 'execute') || ' ' || has_function_privilege('authenticated', 'public.mono_camp_done(integer)', 'execute') || ' ' || has_function_privilege('anon', 'public.mono_camp_count()', 'execute') || ' ' || has_function_privilege('authenticated', 'mono.camp_wk(integer)', 'execute')`), "false true true false", "droits");
  fails(() => as(1, `select count(*) from mono.camp_fin`), /permission denied/, "lecture directe de la table");
  fails(() => q(`set role anon; select mono_camp_done(1)`), /permission denied/, "anon compte un chapitre");
  console.log("ok - chargé après mono_cles.sql, relancé, droits d'appel");

  debut(2); // semaine 1
  assert.strictEqual(done(1, 1), 1); assert.strictEqual(done(1, 1), 1, "une fois par compte"); assert.strictEqual(done(2, 1), 2);
  assert.strictEqual(done(3, 2), 0, "chapitre 2 fini en semaine 1 : pas compté");
  fails(() => done(1, 9), /chapitre inconnu/, "chapitre 9");
  debut(8); // semaine 2
  assert.strictEqual(done(3, 1), 2, "chapitre 1 rattrapé en semaine 2 : pas compté"); assert.strictEqual(done(3, 2), 1);
  assert.deepStrictEqual(count(), { 1: 2, 2: 1 });
  console.log("ok - un chapitre compte pendant sa semaine, une fois par compte ; nombres lisibles par tous");

  q(`update mono.saisons set etat = 'finie' where id = 1; insert into mono.saisons (id, nom, debut, etat) values (2, 'Saison 2', now() - interval '1 hour', 'ouverte');`);
  assert.deepStrictEqual(count(), {}, "nouvelle saison : compteurs à zéro"); assert.strictEqual(done(1, 1), 1);
  file("mono_campagne.sql"); assert.strictEqual(q(`select count(*) from mono.camp_fin`), "4", "relance : rien d'effacé");
  console.log("ok - une saison à la fois, relance sans perte");
} finally {
  run(`drop database if exists ${DB}`, URL0);
}
