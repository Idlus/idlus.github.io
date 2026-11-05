/* 05/11 (Mathis : « accéder à tous les chats des serveurs, avoir tous les droits dans les chats, m'appeler Xener, toutes les émotes ») :
   droits du compte admin dans supabase/chat.sql, dans un vrai Postgres jetable (jamais la base en ligne) :
   - Mathis écrit dans tous les salons des 3 serveurs (g, c, v, s, sc, sv, m, mc, mv), sans testeur Monocompte, et les lit tous ;
   - ses messages sont signés « Xener », même si le pseudo du compte est autre ; staff_list connaît « Xener » (couronne) ;
   - aucune limite pour lui : mode lent, Commerce 30 s, message répété, liens, niveau minimum, muet, joueur qui l'ignore ;
   - un joueur garde toutes ses limites et ne peut pas lire les salons du Monocompte sans y avoir accès.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/chat_admin_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_chat_admin » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert"); const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - droits de Xener dans le chat (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_chat_admin";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => run("set lock_timeout = '3s';\n" + fs.readFileSync(path.join(ROOT, "supabase", f), "utf8"));
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const send = (i, ch, b, to) => as(i, `select coalesce(chat_send('${b}', ${to ? `'${U(to)}'` : "null"}, null, '${ch}'), 'OK')`);
run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql"); file("chat.sql"); file("chat.sql");
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
     insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 99) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users on conflict do nothing;
     update profiles set pseudo = 'Mathis29' where id = '${U(99)}';
     delete from admins; insert into admins values ('${U(99)}');
     update chat_settings set slow_s = 30, min_level = 50 where id = 1;
     create schema mono; create table mono.testeurs (user_id uuid primary key); create table mono.saisons (id int, etat text, test boolean);
     grant usage on schema mono to anon, authenticated; grant select on mono.testeurs, mono.saisons to anon, authenticated;
     insert into chat_sanctions (user_id, mute_until) values ('${U(99)}', now() + interval '1 hour');
     insert into ignores (user_id, other) values ('${U(7)}', '${U(99)}');`);
  console.log("ok - chat.sql appliqué deux fois");

  const ALL = ["g", "c", "v", "s", "sc", "sv", "m", "mc", "mv"];
  for (const ch of ALL) assert.strictEqual(send(99, ch, "coucou"), "OK", "Xener écrit dans " + ch + " (mode lent, message répété, Commerce 30 s, niveau minimum, muet : rien ne l'arrête)");
  assert.strictEqual(send(99, "g", "le site idlus.github.io et discord.gg/9ApPgWjPUM"), "OK", "Xener peut donner un lien");
  assert.strictEqual(send(99, "g", "salut", 7), "OK", "message privé à un joueur qui l'ignore");
  assert.strictEqual(q(`select string_agg(distinct pseudo, ',') from chat_msgs where user_id = '${U(99)}'`), "Xener", "signé Xener partout");
  assert.strictEqual(q(`select count(*) from chat_msgs where user_id = '${U(99)}'`), "11");
  assert.strictEqual(as(99, `select string_agg(distinct ch, ',' order by ch) from chat_msgs where to_id is null`), [...ALL].sort().join(","), "Xener lit les salons des 3 serveurs");
  assert.ok(JSON.parse(as(1, `select staff_list()`)).some((x) => x.p === "Xener" && x.r === "crea" && x.u === U(99)), "staff_list : couronne sur « Xener »");
  console.log("ok - Xener : tous les salons des 3 serveurs, signé Xener, aucune limite");

  q(`update chat_settings set min_level = 0 where id = 1`);
  assert.strictEqual(send(5, "g", "salut"), "OK");
  assert.match(send(5, "c", "vite"), /Doucement/, "joueur : mode lent toujours là");
  assert.match(send(6, "g", "va sur discord.gg/abc"), /liens/, "joueur : liens refusés");
  assert.match(send(6, "mc", "vends"), /réservé aux joueurs du Monocompte/, "joueur sans Monocompte : refusé");
  assert.strictEqual(as(6, `select count(*) from chat_msgs where ch in ('m', 'mc', 'mv')`), "0", "joueur sans Monocompte : ne lit pas ces salons");
  assert.match(send(7, "g", "x", 99).replace("OK", ""), /^$/, "un joueur peut répondre à Xener");
  assert.strictEqual(q(`select pseudo from chat_msgs where user_id = '${U(7)}' order by id desc limit 1`), "Joueur07", "un joueur garde son pseudo");
  console.log("ok - les joueurs gardent leurs limites et leur pseudo");
} finally {
  run(`drop database if exists ${DB}`, URL0);
}
