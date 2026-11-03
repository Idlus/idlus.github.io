/* 2.2.2 « Les modérateurs » : droits des modérateurs dans supabase/chat.sql, dans un vrai Postgres jetable (jamais la base en ligne).
   - un modo supprime un message de joueur d'un salon public, jamais un message privé, une annonce, ni un message de Mathis ou d'un modo ;
   - un modo avertit un joueur (message privé marqué data.warn), pas Mathis ni un autre modo, ni lui-même ;
   - un modo rend muet 24 h au plus, jamais un autre modo ; Mathis peut tout ;
   - un joueur sans rôle ne peut rien ; chaque action va dans le journal (admin_log) ;
   - journal vers Discord : colonne discord_at ajoutée, anciennes lignes marquées envoyées, chat.sql relancé sans danger.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/moderateur_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_moderateur » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert"); const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - modérateurs (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_moderateur";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => run("set lock_timeout = '3s';\n" + fs.readFileSync(path.join(ROOT, "supabase", f), "utf8"));
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
const msg = (u, ch, kind, to) => q(`insert into chat_msgs (ch, user_id, to_id, pseudo, body, kind) values ('${ch}', '${U(u)}', ${to ? `'${U(to)}'` : "null"}, 'Joueur${u}', 'T:${ch}${u}', '${kind || "msg"}') returning id`);
const left = (id) => +q(`select count(*) from chat_msgs where id = ${id}`);
// 99 = Mathis (admin), 10 et 11 = modérateurs, 5 et 6 = joueurs
run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql");
  // base déjà en service : chat.sql de main sans discord_at, avec un journal
  let old = null; try { old = execFileSync("git", ["-C", ROOT, "show", "2b41c5f:supabase/chat.sql"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) {}
  if (old) run("set lock_timeout = '3s';\n" + old);
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 99) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users on conflict do nothing;
     delete from admins; insert into admins values ('${U(99)}'); insert into mods (user_id) values ('${U(10)}'), ('${U(11)}');`);
  if (old) q(`insert into admin_log (by_user, txt) values ('${U(99)}', 'ancienne action')`);
  file("chat.sql"); file("chat.sql"); // relancé : sans danger
  if (old) assert.strictEqual(q(`select count(*) from admin_log where discord_at is null`), "0", "anciennes lignes du journal marquées envoyées");
  console.log("ok - chat.sql appliqué deux fois, journal existant marqué envoyé");

  // suppression de message
  let id = msg(5, "g"); as(10, `select adm_msg_del(${id})`); assert.strictEqual(left(id), 0, "modo : message de joueur du Général supprimé");
  for (const ch of ["c", "v", "s"]) { id = msg(6, ch); as(11, `select adm_msg_del(${id})`); assert.strictEqual(left(id), 0, "modo : salon " + ch); }
  id = msg(5, "p", "msg", 6); fails(() => as(10, `select adm_msg_del(${id})`), /seul Mathis/, "modo : message privé"); assert.strictEqual(left(id), 1);
  id = msg(99, "g", "ann"); fails(() => as(10, `select adm_msg_del(${id})`), /seul Mathis/, "modo : annonce");
  id = msg(99, "g"); fails(() => as(10, `select adm_msg_del(${id})`), /impossible sur Mathis/, "modo : message de Mathis");
  id = msg(11, "g"); fails(() => as(10, `select adm_msg_del(${id})`), /impossible sur un modérateur/, "modo : message d'un autre modo"); assert.strictEqual(left(id), 1);
  as(99, `select adm_msg_del(${id})`); assert.strictEqual(left(id), 0, "Mathis supprime le message d'un modo");
  id = msg(6, "g"); fails(() => as(5, `select adm_msg_del(${id})`), /réservé à l'équipe/, "joueur sans rôle"); assert.strictEqual(left(id), 1);
  console.log("ok - suppression : salons publics pour les modos, pas le privé, les annonces, Mathis ni les modos");

  // avertissement
  assert.strictEqual(as(10, `select coalesce(adm_warn('${U(5)}', '  Reste poli dans le Général.  '), 'OK')`), "OK", "modo avertit un joueur");
  assert.strictEqual(q(`select ch || '|' || user_id || '|' || to_id || '|' || body || '|' || (data->>'warn') from chat_msgs where data ? 'warn'`), `p|${U(10)}|${U(5)}|Reste poli dans le Général.|true`, "avertissement = message privé du modo marqué warn");
  assert.strictEqual(as(5, `select count(*) from chat_msgs where data ? 'warn'`), "1", "le joueur averti le lit");
  assert.strictEqual(as(6, `select count(*) from chat_msgs where data ? 'warn'`), "0", "un autre joueur ne le lit pas");
  assert.match(as(10, `select adm_warn('${U(5)}', '   ')`), /raison/, "raison obligatoire");
  assert.match(as(10, `select adm_warn('${U(5)}', '${"x".repeat(201)}')`), /200/, "200 caractères");
  fails(() => as(10, `select adm_warn('${U(11)}', 'stop')`), /impossible sur un modérateur/, "modo n'avertit pas un modo");
  fails(() => as(10, `select adm_warn('${U(99)}', 'stop')`), /impossible sur Mathis/, "modo n'avertit pas Mathis");
  fails(() => as(5, `select adm_warn('${U(6)}', 'stop')`), /réservé à l'équipe/, "joueur sans rôle");
  assert.strictEqual(as(99, `select coalesce(adm_warn('${U(11)}', 'Doucement avec les muets.'), 'OK')`), "OK", "Mathis avertit un modo");
  console.log("ok - avertissement : message privé officiel, pas sur Mathis ni un modo, raison de 1 à 200 caractères");

  // muet
  as(10, `select adm_mute('${U(5)}', 1440)`); assert.strictEqual(q(`select (mute_until > now() + interval '23 hours')::text from chat_sanctions where user_id = '${U(5)}'`), "true", "modo : muet 24 h");
  fails(() => as(10, `select adm_mute('${U(6)}', 10080)`), /24 h au plus/, "modo : pas 7 jours");
  fails(() => as(10, `select adm_mute('${U(11)}', 60)`), /impossible sur un modérateur/, "modo : pas un autre modo");
  fails(() => as(10, `select adm_mute('${U(99)}', 60)`), /impossible sur Mathis/, "modo : pas Mathis");
  as(99, `select adm_mute('${U(11)}', 10080)`); assert.strictEqual(q(`select count(*) from chat_sanctions where user_id = '${U(11)}' and mute_until > now() + interval '6 days'`), "1", "Mathis : 7 jours, même sur un modo");
  fails(() => as(10, `select adm_ban('${U(6)}', true)`), /réservé à Mathis/, "modo : pas de bannissement");
  console.log("ok - muet : 24 h au plus pour un modo, jamais sur un modo ni Mathis ; bannir reste à Mathis");

  // journal
  const j = q(`select count(*) from admin_log where discord_at is null and by_user in (select user_id from mods)`);
  assert.strictEqual(+j, 6, "actions des modos dans le journal, à envoyer sur Discord : " + j);
  assert.match(q(`select string_agg(txt, ' / ') from admin_log where by_user = '${U(10)}'`), /averti : « Reste poli/, "avertissement dans le journal");
  console.log("ok - journal : chaque action du modo notée, prête pour #modération");
} finally { if (!process.env.GARDE) run(`drop database if exists ${DB}`, URL0); }
