/* 04/11 (refonte du Panel Xener, choix 3A) : adm_announce_srv (supabase/annonces_srv.sql, à installer à la main après chat.sql), annonce sur les serveurs cochés.
   - les trois serveurs : bandeau srv vide (comme adm_announce), message dans 'g', 's', 'm' ;
   - un sous-ensemble : bandeau srv = 'e,s', 's'… dans l'ordre e, s, m, message seulement dans les salons cochés ('e' → 'g') ;
   - bandeau seul, message seul ; refus : annonce vide, aucun serveur, compte non admin, visiteur ; journal du panel.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/annonce_srv_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_annonce_srv » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - IDLUS_PG absent : test SQL des annonces par serveur sauté"); process.exit(0); }
const DB = "idlus_annonce_srv";
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
  file("schema.sql"); file("classements.sql"); file("chat.sql"); file("annonces_srv.sql");
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
     insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 99) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users;
     delete from admins; insert into admins values ('${U(99)}');`);
  const anns = () => q(`select string_agg(body || ':' || coalesce(srv, '-') || ':' || (until is null), ',' order by id) from announces`);
  const msgs = (b) => q(`select string_agg(ch, ',' order by ch) from chat_msgs where kind = 'ann' and body = '${b}'`);
  as(99, `select adm_announce_srv('Tous', true, true, 24, 'm,e,s')`);
  as(99, `select adm_announce_srv('Classique', true, true, 0, 's, e')`);
  as(99, `select adm_announce_srv('Saison', true, true, 1, 's')`);
  as(99, `select adm_announce_srv('Mono bandeau', true, false, 1, 'm,x')`);
  as(99, `select adm_announce_srv('Éternel chat', false, true, 1, 'e')`);
  assert.strictEqual(anns(), "Tous:-:false,Classique:e,s:true,Saison:s:false,Mono bandeau:m:false", "bandeaux : srv vide pour les trois, sinon la liste dans l'ordre e, s, m");
  assert.strictEqual(msgs("Tous"), "g,m,s", "les trois salons");
  assert.strictEqual(msgs("Classique"), "g,s", "Éternel ('g') et Saison 1");
  assert.strictEqual(msgs("Saison"), "s", "Saison 1 seule");
  assert.strictEqual(msgs("Mono bandeau"), "", "bandeau seul : pas de message");
  assert.strictEqual(msgs("Éternel chat"), "g", "message seul dans 'g'");
  assert.strictEqual(+q(`select count(*) from announces where body = 'Éternel chat'`), 0, "message seul : pas de bandeau");
  assert.match(q(`select txt from admin_log order by id desc limit 1`), /annonce publiée \(e\) : « Éternel chat »/);
  fails(() => as(99, `select adm_announce_srv('  ', true, true, 1, 'e')`), /annonce vide/, "annonce vide");
  fails(() => as(99, `select adm_announce_srv('x', true, true, 1, 'z')`), /aucun serveur/, "aucun serveur");
  fails(() => as(1, `select adm_announce_srv('x', true, true, 1, 'e')`), /réservé à Mathis/, "joueur n'annonce pas");
  fails(() => anon(`select adm_announce_srv('x', true, true, 1, 'e')`), /permission denied/, "visiteur n'annonce pas");
  file("chat.sql"); file("annonces_srv.sql"); assert.strictEqual(+q(`select count(*) from announces`), 4, "chat.sql et annonces_srv.sql relancés : annonces gardées");
  console.log("ok - adm_announce_srv : bandeau par serveur (vide pour les trois, sinon e,s,m), message dans les salons cochés, refus (vide, aucun serveur, joueur, visiteur), chat.sql relançable");
} finally { run(`drop database if exists ${DB}`, URL0); }
