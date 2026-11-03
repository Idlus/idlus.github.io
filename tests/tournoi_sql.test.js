/* Saison 1, lot 8 : supabase/tournoi.sql dans un vrai Postgres jetable (jamais la base en ligne) : semaine et phase comme
   js/tournoi.js, inscription par le serveur seulement, 5 par guilde, retrait par le joueur ou le Meneur, lecture publique
   sans les équipes, tableau gardé une fois fini, copie dans l'espace de saison s1.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/tournoi_sql.test.js
   Sans IDLUS_PG, la partie SQL est sautée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
global.window = global; for (const f of ["gamedata", "looks", "data", "engine", "defi", "koli", "tournoi"]) require("../js/" + f + ".js");
const E = window.ENGINE;
assert(fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8").includes("create table if not exists s1.tour_teams"), "copie dans s1 (node tools/saison_schema.js)");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - tournoi : copie s1 (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_tournoi_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const as = (i, s) => JSON.parse(q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; select ${s}`) || "null");
  const srv = (s) => JSON.parse(q(`set role service_role; select ${s}`) || "null");
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); assert(re.test(String(e0.stderr || e0.message)), why); };
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;`);
  q(`create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql", "guildes.sql"]) file(path.join(ROOT, "supabase", f));
  file(path.join(ROOT, "supabase", "tournoi.sql")); file(path.join(ROOT, "supabase", "tournoi.sql")); // relancé : sans danger
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  const clock = (ts) => q(`create or replace function public.tour_now() returns timestamp language sql stable as $$ select timestamp '${ts}' $$`);
  // semaine et phase : comme js/tournoi.js (lundi 7 janvier 2030, heure de Paris = UTC+1 en hiver)
  for (const [ts, d, h] of [["2030-01-07 10:00", 0, 10], ["2030-01-12 11:59", 5, 11.98], ["2030-01-12 12:00", 5, 12.01], ["2030-01-13 19:00", 6, 19], ["2030-01-13 20:30", 6, 20.5]]) {
    clock(ts); const t = Date.UTC(2030, 0, 7 + d, 0, 0) + (h - 1) * 3600000;
    assert.strictEqual(q(`select tour_phase()`), E.tourPhase(t), "phase " + ts); assert.strictEqual(Number(q(`select tour_wk()`)), E.tourWeek(t), "semaine " + ts); }
  console.log("ok - semaine et phase : comme le jeu");
  clock("2030-01-08 10:00"); const w = Number(q(`select tour_wk()`));
  for (let i = 1; i <= 8; i++) q(`insert into auth.users values ('${U(i)}')`);
  q(`insert into guilds (name) values ('Alpha'), ('Beta')`);
  q(`insert into guild_members (user_id, guild_id, rank) values ('${U(1)}', 1, 0)` + [2, 3, 4, 5, 6].map((i) => `, ('${U(i)}', 1, 2)`).join("") + `, ('${U(7)}', 2, 0)`);
  const team = `'[{"cls":"iop","lvl":100}]'::jsonb`;
  const join = (i, ww = w) => srv(`tour_join('${U(i)}', ${ww}, 'J${i}', ${team}, 100, '[]'::jsonb)`);
  fails(() => as(1, `tour_join('${U(1)}', ${w}, 'J1', ${team}, 100, '[]'::jsonb)`), /permission denied/, "un joueur ne s'inscrit pas lui-même (l'équipe vient de sa partie)");
  for (let i = 1; i <= 5; i++) assert(join(i).ok, "inscription " + i);
  assert(/5 équipes/.test(join(6).err), "5 par guilde"); assert(join(1).ok, "se réinscrire remplace l'équipe");
  assert(/guilde/.test(join(8).err), "sans guilde"); assert(join(7).ok); assert(/Semaine/.test(join(7, w - 1).err));
  assert(/arène/.test(srv(`tour_join('${U(7)}', ${w}, 'J7', '[]'::jsonb, 100, '[]'::jsonb)`).err));
  console.log("ok - inscription par le serveur, 5 par guilde, sans guilde refusé");
  assert(/Meneur/.test(as(2, `tour_leave('${U(3)}')`).err), "un membre ne retire pas un autre");
  assert(as(1, `tour_leave('${U(3)}')`).ok, "le Meneur retire un membre"); assert(as(4, `tour_leave()`).ok, "on se retire soi-même");
  assert(/Meneur|introuvable/.test(as(7, `tour_leave('${U(2)}')`).err), "le Meneur d'une autre guilde ne retire rien");
  assert.strictEqual(q(`select count(*) from tour_teams`), "4");
  // lecture : tout le monde, sans les équipes ; les tables ne se lisent pas directement
  const v = JSON.parse(q(`set role anon; select tour_view()`)); assert.strictEqual(v.phase, "inscr"); assert.strictEqual(v.ins.length, 4);
  assert(!JSON.stringify(v).includes('"team"'), "pas d'équipe dans la lecture publique");
  assert.strictEqual(q(`set role authenticated; set request.jwt.claim.sub = '${U(1)}'; select count(*) from tour_teams`), "0", "table illisible");
  fails(() => as(1, `tour_entries(${w})`), /permission denied/, "équipes réservées au serveur");
  // tableau : fait par le serveur après le samedi midi
  clock("2030-01-12 13:00"); assert(/fermées/.test(join(2).err), "inscriptions fermées");
  const L = srv(`tour_entries(${w})`); assert.strictEqual(L.length, 2); assert.strictEqual(L[0].teams.length, 3);
  const st = E.tourInit(w, L); E.tourStep(st, 99, Date.UTC(2030, 0, 13, 21), () => ({ win: true, rounds: 3, hpA: 40, hpB: 0 }));
  srv(`tour_save(${w}, '${JSON.stringify(st).replace(/'/g, "''")}'::jsonb, true)`);
  srv(`tour_save(${w}, '{"seeds":[]}'::jsonb, false)`); // une fois fini, le tableau ne change plus
  const v2 = JSON.parse(q(`set role anon; select tour_view(${w})`)); assert(v2.done && v2.state.seeds.length === 2 && v2.state.champ === 0);
  assert(!JSON.stringify(v2.state).includes('"team"'), "pas d'équipe dans le tableau public");
  fails(() => as(1, `tour_save(${w}, '{}'::jsonb, false)`), /permission denied/, "un joueur n'écrit pas le tableau");
  console.log("ok - tableau fait par le serveur, gardé une fois fini, lisible par tous sans les équipes");
} finally { psql(`drop database if exists ${DB}`); }
