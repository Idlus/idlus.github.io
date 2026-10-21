/* Salon « Général Monocompte » (ch 'm') de supabase/chat.sql dans un vrai Postgres jetable (jamais la base en ligne) :
   - chat.sql se réapplique sur une base qui a déjà des messages (version de main chargée d'abord), avec le lock_timeout du
     workflow « Serveur en ligne », sans réécrire la table chat_msgs ni perdre un message ; relancé deux fois : sans danger ;
   - base sans espace Monocompte (pas de table mono.testeurs) : 'm' refusé proprement à tout le monde (lecture et écriture),
     'g' inchangé ;
   - avec monocompte.sql : un testeur et l'admin lisent et écrivent 'm', un compte sans accès et un visiteur ne lisent ni
     n'écrivent 'm' (ni par chat_send, ni par signalement), 'g', 'c', 'v' inchangés pour tous ;
   - mêmes règles que le Général : 200 caractères, mode lent partagé, muet, banni, chat fermé, liens refusés ; modération
     (adm_msgs, adm_msg_purge, adm_chat_clear('m'), adm_pin avec 'm').
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/chat_mono_sql.test.js
   Sans IDLUS_PG, le test SQL est sauté. La base « idlus_chat_mono » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/chat.sql"), "chat.sql est dans la liste automatique de « Serveur en ligne »");
  assert(!/monocompte\.sql/.test(tous), "monocompte.sql reste hors de la liste automatique : chat.sql ne doit pas en dépendre au chargement"); }
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - chat.sql dans la liste automatique (IDLUS_PG absent : test SQL du salon Monocompte sauté)"); process.exit(0); }

const DB = "idlus_chat_mono";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(ROOT, "supabase", f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
// comme le workflow : « set lock_timeout = '3s'; » puis le fichier
const deploy = (txt) => run("set lock_timeout = '3s';\n" + txt);
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const lit = (v) => `$q$${v}$q$`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const anon = (s) => q(`set role anon; set request.jwt.claim.sub = ''; ${s}`);
const send = (i, body, ch) => as(i, `select coalesce(chat_send(${lit(body)}, null, null, ${lit(ch)}), 'OK')`);
const seen = (i, ch) => +as(i, `select count(*) from chat_msgs where ch = '${ch}'`);
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
const reset = () => q(`delete from chat_msgs where kind = 'msg' and body like 'T:%'; delete from chat_sanctions; update chat_settings set slow_s = 0, closed = false where id = 1;`);

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql");
  // ---------- 1. base déjà en service : chat.sql de main (sans 'm') avec des messages, puis le nouveau chat.sql ----------
  let old; // chat.sql de main avant le salon Monocompte (2.1.35.1) ; dépôt sans cet historique : le fichier actuel
  try { old = execFileSync("git", ["-C", ROOT, "show", "6ebfd0b6:supabase/chat.sql"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) { old = fs.readFileSync(path.join(ROOT, "supabase", "chat.sql"), "utf8"); }
  deploy(old);
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`); // droits par défaut de Supabase
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 99) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users;
     delete from admins; insert into admins values ('${U(99)}'); -- classements.sql nomme admin le premier profil : seul le compte 99 l'est ici
     insert into chat_msgs (ch, user_id, pseudo, body) select (array['g', 'c', 'v'])[1 + i % 3], '${U(5)}', 'Joueur05', 'ancien ' || i from generate_series(1, 3000) i;`);
  const before = q(`select count(*) || ' ' || md5(string_agg(id || ch || body, ',' order by id)) from chat_msgs`);
  const rel0 = q(`select pg_relation_filenode('public.chat_msgs')`);
  const src = fs.readFileSync(path.join(ROOT, "supabase", "chat.sql"), "utf8");
  deploy(src); deploy(src); // relancé : sans danger
  assert.strictEqual(q(`select count(*) || ' ' || md5(string_agg(id || ch || body, ',' order by id)) from chat_msgs`), before, "aucun message perdu ni modifié");
  assert.strictEqual(q(`select pg_relation_filenode('public.chat_msgs')`), rel0, "table chat_msgs pas réécrite");
  console.log("ok - chat.sql réappliqué deux fois sur une base avec 3000 messages (lock_timeout 3 s) : aucun message touché, table pas réécrite");

  // ---------- 2. base sans espace Monocompte : 'm' refusé à tout le monde ----------
  reset();
  assert.strictEqual(q(`select to_regclass('mono.testeurs') is null`), "t");
  q(`insert into chat_msgs (ch, user_id, pseudo, body) values ('m', '${U(7)}', 'Joueur07', 'T:m posé à la main')`);
  for (const i of [1, 2, 99]) {
    assert.strictEqual(send(i, "T:essai m " + i, "m"), "Ce salon est réservé aux joueurs du Monocompte.", `sans Monocompte : compte ${i} n'écrit pas dans 'm'`);
    assert.strictEqual(seen(i, "m"), 0, `sans Monocompte : compte ${i} ne lit pas 'm'`);
  }
  assert.strictEqual(+anon(`select count(*) from chat_msgs where ch = 'm'`), 0, "visiteur : 'm' illisible");
  assert.strictEqual(send(2, "T:bonjour classique", "g"), "OK", "'g' inchangé");
  assert.strictEqual(+as(1, `select count(*) from chat_msgs where ch = 'g' and body = 'T:bonjour classique'`), 1, "le message 'g' est lu par les autres");
  assert.strictEqual(+as(7, `select count(*) from chat_msgs where ch = 'm'`), 1, "l'auteur garde la vue sur son propre message");
  console.log("ok - sans espace Monocompte (pas de mono.testeurs) : 'm' refusé en lecture et en écriture à tous (admin compris), 'g' inchangé");

  // ---------- 3. avec monocompte.sql : testeur et admin oui, les autres non ----------
  file("monocompte.sql");
  deploy(src); // chat.sql relancé après monocompte.sql (ordre du serveur) : sans danger
  q(`insert into mono.testeurs (user_id) values ('${U(1)}')`);
  reset(); q(`delete from chat_msgs where ch = 'm'`);
  assert.strictEqual(send(1, "T:salut les monos", "m"), "OK", "testeur écrit dans 'm'");
  assert.strictEqual(send(99, "T:bonjour de Mathis", "m"), "OK", "admin écrit dans 'm'");
  assert.strictEqual(send(2, "T:je force", "m"), "Ce salon est réservé aux joueurs du Monocompte.", "non-testeur n'écrit pas dans 'm'");
  assert.strictEqual(seen(1, "m"), 2, "testeur lit 'm'"); assert.strictEqual(seen(99, "m"), 2, "admin lit 'm'");
  assert.strictEqual(seen(2, "m"), 0, "non-testeur ne lit pas 'm'");
  assert.strictEqual(+anon(`select count(*) from chat_msgs where ch = 'm'`), 0, "visiteur ne lit pas 'm'");
  assert.strictEqual(+as(1, `select count(*) from chat_msgs where ch = 'm' and body = 'T:salut les monos' and pseudo = 'Joueur01'`), 1, "message rangé dans 'm' avec le pseudo");
  // salon inconnu : retombe sur le Général, comme avant
  assert.strictEqual(send(2, "T:salon bidon", "z"), "OK"); assert.strictEqual(+q(`select count(*) from chat_msgs where body = 'T:salon bidon' and ch = 'g'`), 1, "salon inconnu → 'g'");
  for (const [ch, i] of [["g", 2], ["c", 3], ["v", 4], ["g", 1]]) assert.strictEqual(send(i, `T:${ch} par ${i}`, ch), "OK", `'${ch}' inchangé`);
  for (const i of [1, 2, 99]) assert.strictEqual(+as(i, `select count(*) from chat_msgs where body like 'T:_ par _'`), 4, `'g', 'c', 'v' lus par ${i}`);
  // signalement : seulement un message qu'on peut lire
  const mid = q(`select id from chat_msgs where body = 'T:bonjour de Mathis'`);
  assert.strictEqual(as(2, `select chat_report(${mid}, 'Spam')`), "Message introuvable.", "non-testeur ne signale pas un message de 'm'");
  const mid1 = q(`select id from chat_msgs where body = 'T:salut les monos'`);
  assert.strictEqual(as(99, `select coalesce(chat_report(${mid1}, 'Spam'), 'OK')`), "OK", "admin signale un message de 'm'");
  assert.strictEqual(+q(`select count(*) from reports where msg_id = ${mid1}`), 1);
  // un testeur retiré perd le salon
  q(`delete from mono.testeurs where user_id = '${U(1)}'`);
  assert.strictEqual(send(1, "T:encore là ?", "m"), "Ce salon est réservé aux joueurs du Monocompte.", "testeur retiré : n'écrit plus");
  assert.strictEqual(seen(1, "m"), 1, "testeur retiré : ne voit plus que son propre message");
  q(`insert into mono.testeurs (user_id) values ('${U(1)}')`);
  console.log("ok - avec monocompte.sql : testeur et admin lisent et écrivent 'm', non-testeur et visiteur non (signalement compris), 'g' 'c' 'v' inchangés");

  // ---------- 4. mêmes règles que le Général ----------
  reset();
  assert.strictEqual(send(1, "T:" + "x".repeat(205), "m"), "200 caractères au maximum.");
  assert.strictEqual(send(1, "T:va sur www.exemple.com", "m"), "Les liens ne sont pas autorisés dans le chat.");
  assert.strictEqual(send(1, "   ", "m"), "Le message est vide.");
  q(`update chat_settings set slow_s = 4`);
  assert.strictEqual(send(1, "T:un", "m"), "OK");
  assert.match(send(1, "T:deux", "m"), /Doucement/, "mode lent dans 'm'");
  assert.match(send(1, "T:trois", "g"), /Doucement/, "mode lent partagé avec 'g'");
  q(`update chat_settings set slow_s = 0, closed = true`);
  assert.strictEqual(send(1, "T:fermé", "m"), "Le chat est fermé pour le moment.", "chat fermé");
  q(`update chat_settings set closed = false; insert into chat_sanctions (user_id, mute_until) values ('${U(1)}', now() + interval '10 minutes')`);
  assert.match(send(1, "T:muet", "m"), /muet/, "muet");
  q(`update chat_sanctions set mute_until = null, banned = true`);
  assert.strictEqual(send(1, "T:banni", "m"), "Tu ne peux plus écrire dans le chat.", "banni");
  q(`delete from chat_sanctions`);
  // modération par l'admin
  reset(); send(1, "T:m1", "m"); send(1, "T:g1", "g");
  const am = JSON.parse(as(99, `select adm_msgs('${U(1)}')::text`)).map((x) => x.body).sort();
  assert.deepStrictEqual(am, ["T:g1", "T:m1"], "adm_msgs montre aussi 'm'");
  as(99, `select adm_pin('Épinglé', 'g,m,x')`);
  assert.strictEqual(q(`select pin_chs from chat_settings`), "g,m", "épinglage sur 'm'");
  assert.strictEqual(+anon(`select count(*) from chat_settings where pin_chs = 'g,m'`), 1, "épinglage lisible");
  assert.strictEqual(as(99, `select adm_chat_clear('m')`), "1", "salon Monocompte vidé");
  assert.strictEqual(+q(`select count(*) from chat_msgs where ch = 'm' and kind = 'msg'`), 0);
  assert.match(q(`select txt from admin_log order by id desc limit 1`), /salon Monocompte vidé/);
  send(1, "T:m2", "m");
  assert.strictEqual(as(99, `select adm_msg_purge('${U(1)}')`), "2", "messages publics effacés, 'm' compris");
  fails(() => as(2, `select adm_chat_clear('m')`), /réservé à Mathis/, "joueur ne vide pas 'm'");
  console.log("ok - mêmes règles que le Général dans 'm' (200 caractères, liens, mode lent partagé, chat fermé, muet, banni) et modération (adm_msgs, épinglage, vider le salon, effacer les messages)");
} finally {
  run(`drop database if exists ${DB}`, URL0);
}
