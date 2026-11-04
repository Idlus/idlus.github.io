/* 2.2.4.4 (Mathis 04/11 : « plein de parties que je ne vois pas dans les panels ») : adm_parties (supabase/panel_parties.sql),
   parties de chaque compte sur les trois serveurs, pour les pages Comptes et « Parties des joueurs » du panel.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/panel_parties_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_panel_parties » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - IDLUS_PG absent : test SQL des parties du panel sauté"); process.exit(0); }
const DB = "idlus_panel_parties";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(ROOT, "supabase", f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const anon = (s) => q(`set role anon; set request.jwt.claim.sub = ''; ${s}`);
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql"); file("chat.sql"); file("panel_parties.sql");
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 99) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users;
     delete from admins; insert into admins values ('${U(99)}');
     alter table saves disable trigger user;
     insert into saves (user_id, data, updated_at) values ('${U(1)}', 'x', now() - interval '2 hours'), ('${U(2)}', 'x', now() - interval '1 hour');
     insert into ladder (user_id, level, main) values ('${U(1)}', 120, 'iop'), ('${U(2)}', 80, 'cra');`);
  const P = (srv, ids) => JSON.parse(as(99, `select adm_parties(${srv ? `'${srv}'` : "null"}, ${ids ? `array[${ids.map((i) => `'${U(i)}'`).join(",")}]::uuid[]` : "null"})`));
  /* sans les espaces s1 et mono (base de test) : Éternel seulement, les autres vides */
  let L = P("e"); assert.deepStrictEqual(L.map((x) => x.pseudo), ["Joueur02", "Joueur01"], "Éternel : parties du dernier envoi au plus ancien");
  assert.strictEqual(L[1].e_lvl, 120); assert.strictEqual(L[1].cls, "iop");
  assert.deepStrictEqual(P("s"), [], "sans s1 : liste vide"); assert.deepStrictEqual(P("m"), [], "sans mono : liste vide");
  /* avec s1 et mono */
  q(`create schema s1; create table s1.saves (user_id uuid primary key, data text, updated_at timestamptz); create table s1.ladder (user_id uuid primary key, level int);
     insert into s1.saves values ('${U(3)}', 'x', now() - interval '3 hours'), ('${U(1)}', 'x', now());
     insert into s1.ladder values ('${U(3)}', 15), ('${U(1)}', 40);
     create schema mono; create table mono.parties (user_id uuid, saison int, data text, updated_at timestamptz, primary key (user_id, saison));
     create table mono.parties_ok (user_id uuid, saison int, resume jsonb, primary key (user_id, saison));
     insert into mono.parties values ('${U(4)}', 0, 'x', now() - interval '5 days'), ('${U(4)}', 1, 'x', now() - interval '1 day'), ('${U(2)}', 1, 'x', now() - interval '2 days');
     insert into mono.parties_ok values ('${U(4)}', 0, '{"niveau": 99}'), ('${U(4)}', 1, '{"niveau": 33}'), ('${U(2)}', 1, '{"niveau": "?"}');`);
  L = P("s"); assert.deepStrictEqual(L.map((x) => `${x.pseudo}:${x.s_lvl}`), ["Joueur01:40", "Joueur03:15"], "Saison 1 : parties de s1, dernier envoi d'abord");
  L = P("m"); assert.deepStrictEqual(L.map((x) => `${x.pseudo}:${x.m_lvl}`), ["Joueur04:33", "Joueur02:null"], "Monocompte : dernière saison, niveau de parties_ok");
  L = P(null, [1, 2, 5]); const o = Object.fromEntries(L.map((x) => [x.pseudo, x]));
  assert.strictEqual(L.length, 3, "comptes donnés, même sans partie");
  assert.ok(o.Joueur01.e_at && o.Joueur01.s_at && !o.Joueur01.m_at, "Joueur01 : Éternel et Saison 1");
  assert.ok(o.Joueur02.e_at && !o.Joueur02.s_at && o.Joueur02.m_at, "Joueur02 : Éternel et Monocompte");
  assert.ok(!o.Joueur05.e_at && !o.Joueur05.s_at && !o.Joueur05.m_at, "Joueur05 : aucune partie");
  fails(() => as(1, `select adm_parties('e', null)`), /réservé à Mathis/, "joueur ne lit pas");
  fails(() => anon(`select adm_parties('e', null)`), /permission denied/, "visiteur ne lit pas");
  file("panel_parties.sql");
  console.log("ok - adm_parties : parties Éternel, Saison 1 et Monocompte par compte et par serveur (dernier envoi d'abord), espaces absents vides, refus joueur et visiteur, relançable");
} finally { run(`drop database if exists ${DB}`, URL0); }
