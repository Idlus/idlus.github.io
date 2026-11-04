/* 04/11 (Mathis : « les canaux commerce ect associés à chaque serveur ») : Commerce et PvP de chaque serveur dans supabase/chat.sql,
   dans un vrai Postgres jetable (jamais la base en ligne) :
   - chat_send range le message dans le salon demandé : 'c'/'v' Éternel, 'sc'/'sv' Saison 1, 'mc'/'mv' Monocompte ; 's' Saison 1 ;
   - Commerce et PvP du Monocompte : héros Monocompte (data.mono), réservés aux comptes qui ont le Monocompte (lecture et écriture) ;
   - un message toutes les 30 s dans le Commerce de chaque serveur (les trois Commerces comptent à part) ;
   - les modos suppriment un message de ces salons, Mathis les vide (adm_chat_clear), chat.sql relancé sans danger ;
   - koli.sql : le grade du Kolizéum part dans le PvP du serveur ('v' Éternel, 'sv' pour la copie de saison1.sql).
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/chat_srv_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_chat_srv » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert"); const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - chat par serveur (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_chat_srv";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => run("set lock_timeout = '3s';\n" + fs.readFileSync(path.join(ROOT, "supabase", f), "utf8"));
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const anon = (s) => q(`set role anon; set request.jwt.claim.sub = ''; ${s}`);
const send = (i, ch, b) => as(i, `select coalesce(chat_send('${b}', null, null, '${ch}'), 'OK')`);
run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql"); file("chat.sql"); file("chat.sql"); // relancé : sans danger
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
     insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 99) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users on conflict do nothing;
     delete from admins; insert into admins values ('${U(99)}'); insert into mods (user_id) values ('${U(10)}');
     update chat_settings set slow_s = 0 where id = 1;
     create schema mono; create table mono.testeurs (user_id uuid primary key); insert into mono.testeurs values ('${U(5)}'); create table mono.saisons (id int, etat text, test boolean); grant select on mono.saisons to anon, authenticated;
     grant usage on schema mono to anon, authenticated; grant select on mono.testeurs to anon, authenticated;`);
  console.log("ok - chat.sql appliqué deux fois");

  for (const ch of ["c", "v", "s", "sc", "sv", "mc", "mv"]) assert.strictEqual(send(5, ch, "salut " + ch), "OK", "envoi dans " + ch);
  assert.strictEqual(q(`select string_agg(ch || ':' || body, ',' order by id) from chat_msgs`), "c:salut c,v:salut v,s:salut s,sc:salut sc,sv:salut sv,mc:salut mc,mv:salut mv", "chaque message dans son salon");
  assert.strictEqual(q(`select string_agg(ch, ',' order by id) from chat_msgs where data->>'mono' = 'true'`), "mc,mv", "Commerce et PvP du Monocompte : héros Monocompte");
  console.log("ok - chat_send : Commerce et PvP de chaque serveur, salon Saison 1, héros Monocompte dans mc et mv");

  assert.match(send(6, "mc", "pas mono"), /réservé aux joueurs du Monocompte/, "Commerce Monocompte : compte sans Monocompte refusé");
  assert.match(send(6, "mv", "pas mono"), /réservé aux joueurs du Monocompte/, "PvP Monocompte : compte sans Monocompte refusé");
  assert.strictEqual(anon(`select string_agg(ch, ',' order by id) from chat_msgs`), "c,v,s,sc,sv", "visiteur : pas les salons du Monocompte");
  assert.strictEqual(as(6, `select string_agg(ch, ',' order by id) from chat_msgs`), "c,v,s,sc,sv", "compte sans Monocompte : pas les salons du Monocompte");
  assert.strictEqual(as(5, `select count(*) from chat_msgs`), "7", "compte du Monocompte : tous les salons");
  console.log("ok - Commerce et PvP du Monocompte : lus et écrits seulement avec le Monocompte");

  assert.match(send(5, "c", "encore"), /un message toutes les 30 secondes/, "Commerce Éternel : 30 s");
  assert.match(send(5, "sc", "encore"), /un message toutes les 30 secondes/, "Commerce Saison 1 : 30 s");
  assert.strictEqual(send(7, "c", "vends Gelano"), "OK"); assert.strictEqual(send(7, "sc", "vends Coiffe"), "OK", "un autre Commerce compte à part"); assert.strictEqual(send(7, "v", "koli"), "OK", "PvP : pas de délai de 30 s");
  console.log("ok - un message toutes les 30 s dans chaque Commerce, à part");

  // 2.2.8.1 (Mathis, 04/11 : « le chat saison 1 classique n'est pas bien synchronisé au perso ») : salons de la Saison 1 = héros de la saison
  q(`insert into ladder (user_id, main, main_lvl, title, heroes) values ('${U(8)}', 'iop', 187, 'Titre Éternel', '[{"cls":"iop","lvl":187}]')
     on conflict (user_id) do update set main = 'iop', main_lvl = 187, title = 'Titre Éternel'`);
  assert.strictEqual(send(8, "s", "sans saison"), "OK");
  assert.strictEqual(q(`select coalesce(cls, '-') || ':' || lvl || ':' || coalesce(title, '-') from chat_msgs where body = 'sans saison'`), "-:1:-", "salon Saison 1 sans s1 : jamais le héros de l'Éternel");
  q(`create schema if not exists s1; create table s1.ladder (like ladder including defaults); insert into s1.ladder (user_id, main, main_lvl, title, heroes) values ('${U(8)}', 'cra', 12, 'Titre S1', '[{"cls":"cra","lvl":12}]')`);
  for (const ch of ["s", "sv", "sc"]) assert.strictEqual(send(8, ch, "perso " + ch), "OK");
  assert.strictEqual(q(`select string_agg(ch || ':' || cls || ':' || lvl || ':' || title, ',' order by id) from chat_msgs where body like 'perso %'`), "s:cra:12:Titre S1,sv:cra:12:Titre S1,sc:cra:12:Titre S1", "salons Saison 1 : héros, niveau et titre de la saison");
  assert.strictEqual(send(8, "v", "perso eternel"), "OK"); assert.strictEqual(send(8, "g", "perso eternel g"), "OK");
  assert.strictEqual(q(`select string_agg(ch || ':' || cls || ':' || lvl, ',' order by id) from chat_msgs where body like 'perso eternel%'`), "v:iop:187,g:iop:187", "salons de l'Éternel : héros de l'Éternel");
  assert.strictEqual(as(8, `select coalesce(chat_send('mp saison', '${U(9)}', null, 's'), 'OK')`), "OK"); assert.strictEqual(as(8, `select coalesce(chat_send('mp eternel', '${U(9)}', null, 'g'), 'OK')`), "OK");
  assert.strictEqual(q(`select string_agg(ch || ':' || cls || ':' || lvl, ',' order by id) from chat_msgs where body like 'mp %'`), "p:cra:12,p:iop:187", "message privé : héros du serveur d'où il part");
  q(`update chat_settings set min_level = 20 where id = 1`);
  assert.match(send(8, "s", "niveau"), /niveau 20/, "niveau minimum : compté sur les héros de la saison");
  assert.strictEqual(send(8, "g", "niveau ok"), "OK", "niveau minimum : Éternel compté sur l'Éternel");
  q(`update chat_settings set min_level = 0 where id = 1; drop schema s1 cascade;`);
  console.log("ok - salons de la Saison 1 : héros, niveau et titre de la saison, jamais ceux de l'Éternel");

  const id = q(`select id from chat_msgs where ch = 'sv' limit 1`);
  as(10, `select adm_msg_del(${id})`); assert.strictEqual(q(`select count(*) from chat_msgs where id = ${id}`), "0", "modo : message du PvP Saison 1 supprimé");
  as(99, `select adm_chat_clear('sc')`); assert.strictEqual(q(`select count(*) from chat_msgs where ch = 'sc'`), "0", "Mathis vide le Commerce Saison 1");
  assert.strictEqual(q(`select count(*) from chat_msgs where ch = 'c'`), "2", "le Commerce de l'Éternel n'est pas touché");
  assert.match(q(`select txt from admin_log order by id desc limit 1`), /Commerce Saison 1/, "journal : nom du salon");
  console.log("ok - modos et Mathis : suppression et salon vidé, les autres serveurs pas touchés");

  const k = fs.readFileSync(path.join(ROOT, "supabase/koli.sql"), "utf8"), s1 = fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8");
  assert(/case current_schema\(\) when 's1' then 'sv' else 'v' end/.test(k), "koli.sql : PvP du serveur");
  const f = s1.slice(s1.indexOf("create or replace function s1.koli_done("), s1.indexOf("revoke all on function s1.koli_done("));
  assert(/set search_path = s1, public/.test(f) && /when 's1' then 'sv'/.test(f), "saison1.sql : s1.koli_done annonce dans 'sv'");
  assert.strictEqual(q(`create schema s1; create function s1.t() returns text language sql set search_path = s1, public as $$ select current_schema()::text $$; select s1.t();`), "s1", "current_schema() vaut s1 dans une fonction de saison");
  console.log("ok - Kolizéum : grade annoncé dans le PvP de son serveur");
} finally { run(`drop database if exists ${DB}`, URL0); }
