/* Salon « Général Monocompte » (ch 'm') de supabase/chat.sql dans un vrai Postgres jetable (jamais la base en ligne) :
   - chat.sql se réapplique sur une base qui a déjà des messages (version de main chargée d'abord), avec le lock_timeout du
     workflow « Serveur en ligne », sans réécrire la table chat_msgs ni perdre un message ; relancé deux fois : sans danger ;
   - base sans espace Monocompte (pas de table mono.testeurs) : 'm' refusé proprement à tout le monde (lecture et écriture),
     'g' inchangé ;
   - avec monocompte.sql : un testeur et l'admin lisent et écrivent 'm', un compte sans accès et un visiteur ne lisent ni
     n'écrivent 'm' (ni par chat_send, ni par signalement), 'g', 'c', 'v' inchangés pour tous ;
   - mêmes règles que le Général : 200 caractères, mode lent partagé, muet, banni, chat fermé, liens refusés ; modération
     (adm_msgs, adm_msg_purge, adm_chat_clear('m')) ; 2.1.36 (panel par serveur) : message épinglé du salon 'm' à part
     (adm_pin_mono ; adm_pin ne prend plus 'm', l'ancien message sur 'm' est repris une fois), annonces par serveur
     (announces.srv, adm_announce_mono), annonces en boucle jamais bloquées par un bandeau Monocompte.
   - 2.1.35.3, profils séparés : un message de 'm' porte le héros Monocompte du joueur (classe et niveau de la partie validée
     mono.parties_ok, à défaut de mono.parties ; titre du héros Monocompte), jamais son profil Classique (ladder : niv. 200,
     « Légende de la 1.0 ») ; sans héros Monocompte (ou saison finie) : classe vide, niveau 1, sans titre ; le même joueur garde
     son profil Classique dans 'g' ; carte Monocompte (chat_mono_profil) réservée aux comptes qui ont accès au salon ; niveau
     minimal du chat compté sur le héros Monocompte dans 'm'.
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
     insert into chat_msgs (ch, user_id, pseudo, body) select (array['g', 'c', 'v'])[1 + i % 3], '${U(5)}', 'Joueur05', 'ancien ' || i from generate_series(1, 3000) i;
     insert into announces (body, banner, until) values ('Ancienne annonce', true, null), ('Annonce finie', true, now() - interval '1 hour');
     update chat_settings set pin_body = 'Épinglé de partout', pin_chs = 'g,m', pin_at = '2026-10-01T00:00:00Z';`);
  const before = q(`select count(*) || ' ' || md5(string_agg(id || ch || body, ',' order by id)) from chat_msgs`);
  const annBefore = q(`select string_agg(id || ':' || body || ':' || coalesce(until::text, '-'), ',' order by id) from announces`);
  const relA = q(`select pg_relation_filenode('public.announces')`), relS = q(`select pg_relation_filenode('public.chat_settings')`);
  const rel0 = q(`select pg_relation_filenode('public.chat_msgs')`);
  const src = fs.readFileSync(path.join(ROOT, "supabase", "chat.sql"), "utf8");
  deploy(src); deploy(src); // relancé : sans danger
  assert.strictEqual(q(`select count(*) || ' ' || md5(string_agg(id || ch || body, ',' order by id)) from chat_msgs`), before, "aucun message perdu ni modifié");
  assert.strictEqual(q(`select pg_relation_filenode('public.chat_msgs')`), rel0, "table chat_msgs pas réécrite");
  // 2.1.36 (panel par serveur) : annonces gardées, sans serveur (= Classique) ; message épinglé du Monocompte repris de l'ancien s'il était sur 'm'
  assert.strictEqual(q(`select string_agg(id || ':' || body || ':' || coalesce(until::text, '-'), ',' order by id) from announces`), annBefore, "annonces gardées");
  assert.strictEqual(q(`select count(*) from announces where srv is not null`), "0", "annonces d'avant : Classique (srv vide)");
  assert.strictEqual(q(`select pg_relation_filenode('public.announces')`), relA, "table announces pas réécrite");
  assert.strictEqual(q(`select pg_relation_filenode('public.chat_settings')`), relS, "table chat_settings pas réécrite");
  assert.strictEqual(q(`select pin_body || '|' || pin_chs || '|' || pin_m_body from chat_settings`), "Épinglé de partout|g,m|Épinglé de partout", "épinglé Monocompte repris de l'ancien message sur 'm', une seule fois");
  as(99, `select adm_pin_mono('Bienvenue aux testeurs')`); deploy(src);
  assert.strictEqual(q(`select pin_m_body from chat_settings`), "Bienvenue aux testeurs", "chat.sql relancé : l'épinglé Monocompte n'est pas écrasé");
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
  assert.deepStrictEqual(JSON.parse(q(`select public.chat_mono_hero('${U(1)}')::text`)), { s: null, nom: null, cls: null, lvl: 1, title: null, hero: null }, "sans espace Monocompte : pas de héros Monocompte");
  assert.strictEqual(as(1, `select coalesce(chat_mono_profil('${U(2)}')::text, 'null')`), "null", "sans espace Monocompte : pas de carte Monocompte");
  fails(() => as(1, `select chat_mono_hero('${U(1)}')`), /permission denied/, "chat_mono_hero réservé au serveur");
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
  // 2.1.36 : le message épinglé du Classique ne va plus sur 'm' ; celui du salon Monocompte est à part (adm_pin_mono)
  as(99, `select adm_pin('Épinglé', 'g,m,x')`);
  assert.strictEqual(q(`select pin_chs from chat_settings`), "g", "épinglé du Classique : 'm' et salon inconnu retirés");
  as(99, `select adm_pin('Épinglé', 'm')`);
  assert.strictEqual(q(`select pin_chs from chat_settings`), "g", "épinglé du Classique demandé sur 'm' seul : Général");
  const pinAt0 = q(`select pin_m_at from chat_settings`);
  as(99, `select adm_pin_mono('  Épinglé Monocompte  ')`);
  assert.strictEqual(q(`select pin_body || '|' || pin_m_body || '|' || (pin_m_at > '${pinAt0}'::timestamptz) from chat_settings`), "Épinglé|Épinglé Monocompte|true", "épinglé Monocompte à part, date changée");
  assert.strictEqual(+anon(`select count(*) from chat_settings where pin_chs = 'g' and pin_m_body = 'Épinglé Monocompte'`), 1, "épinglages lisibles");
  assert.match(q(`select txt from admin_log order by id desc limit 1`), /message épinglé Monocompte/);
  fails(() => as(1, `select adm_pin_mono('x')`), /réservé à Mathis/, "testeur n'épingle pas");
  as(99, `select adm_pin_mono('')`); assert.strictEqual(q(`select pin_m_body from chat_settings`), "", "épinglé Monocompte retiré");
  // annonces par serveur : adm_announce (Classique, srv vide, chat 'g') et adm_announce_mono (srv 'm', chat 'm')
  q(`delete from announces`);
  as(99, `select adm_announce('Annonce Classique', true, true, 24)`);
  as(99, `select adm_announce_mono('Annonce Monocompte', true, true, 0)`);
  assert.strictEqual(q(`select string_agg(body || ':' || coalesce(srv, '-') || ':' || (until is null), ',' order by id) from announces`), "Annonce Classique:-:false,Annonce Monocompte:m:true", "bandeaux et serveur");
  assert.strictEqual(q(`select string_agg(ch || ':' || body, ',' order by id) from chat_msgs where kind = 'ann' and body like 'Annonce %'`), "g:Annonce Classique,m:Annonce Monocompte", "message de l'annonce dans le bon salon");
  assert.strictEqual(+anon(`select count(*) from announces where srv = 'm'`), 1, "bandeau Monocompte lisible (le jeu le filtre)");
  assert.strictEqual(+as(2, `select count(*) from chat_msgs where kind = 'ann' and body = 'Annonce Monocompte'`), 0, "message Monocompte invisible hors du Monocompte");
  assert.strictEqual(+as(1, `select count(*) from chat_msgs where kind = 'ann' and body = 'Annonce Monocompte'`), 1, "message Monocompte lu par un testeur");
  as(99, `select adm_announce_mono('Bandeau seul', true, false, 1)`);
  assert.strictEqual(+q(`select count(*) from chat_msgs where body = 'Bandeau seul'`), 0, "bandeau seul : pas de message");
  fails(() => as(99, `select adm_announce_mono('   ', true, true, 1)`), /annonce vide/, "annonce vide");
  fails(() => as(1, `select adm_announce_mono('x', true, true, 1)`), /réservé à Mathis/, "testeur n'annonce pas");
  fails(() => anon(`select adm_announce_mono('x', true, true, 1)`), /permission denied/, "visiteur n'annonce pas");
  const mid2 = q(`select id from announces where body = 'Annonce Monocompte'`); as(99, `select adm_announce_end(${mid2})`);
  assert.strictEqual(+anon(`select count(*) from announces where srv = 'm' and (until is null or until > now())`), 1, "bandeau Monocompte retiré (adm_announce_end)");
  q(`delete from announces; delete from chat_msgs where kind = 'ann'`);
  assert.strictEqual(as(99, `select adm_chat_clear('m')`), "1", "salon Monocompte vidé");
  assert.strictEqual(+q(`select count(*) from chat_msgs where ch = 'm' and kind = 'msg'`), 0);
  assert.match(q(`select txt from admin_log order by id desc limit 1`), /salon Monocompte vidé/);
  send(1, "T:m2", "m");
  assert.strictEqual(as(99, `select adm_msg_purge('${U(1)}')`), "2", "messages publics effacés, 'm' compris");
  fails(() => as(2, `select adm_chat_clear('m')`), /réservé à Mathis/, "joueur ne vide pas 'm'");
  console.log("ok - mêmes règles que le Général dans 'm' (200 caractères, liens, mode lent partagé, chat fermé, muet, banni) et modération (adm_msgs, épinglage, vider le salon, effacer les messages)");

  // ---------- 5. profils séparés : héros Monocompte dans 'm', profil Classique dans 'g' ----------
  reset(); q(`delete from chat_msgs where ch = 'm'`);
  const LEG = "Légende de la 1.0";
  q(`insert into ladder (user_id, main, main_lvl, title, heroes) values ('${U(1)}', 'iop', 200, ${lit(LEG)}, '[{"cls":"iop","lvl":200}]')
       on conflict (user_id) do update set main = 'iop', main_lvl = 200, title = ${lit(LEG)}, heroes = excluded.heroes;
     insert into ladder (user_id, main, main_lvl, title) values ('${U(99)}', 'eni', 180, 'Fondateur d''Idlus') on conflict (user_id) do update set main = 'eni', main_lvl = 180, title = 'Fondateur d''Idlus';`);
  const last = (ch, i) => JSON.parse(q(`select row_to_json(x)::text from (select cls, lvl, title, data from chat_msgs where ch = '${ch}' and user_id = '${U(i)}' order by id desc limit 1) x`));
  // pas de saison ouverte : pas de héros Monocompte
  assert.strictEqual(send(1, "T:sans saison", "m"), "OK");
  assert.deepStrictEqual(last("m", 1), { cls: null, lvl: 1, title: null, data: { mono: true, s: null } }, "sans saison : classe vide, niveau 1, sans titre, jamais le Classique");
  q(`insert into mono.saisons (id, nom, debut, etat, test) values (0, 'Saison de test', now() - interval '3 days', 'ouverte', true)`);
  // saison ouverte, pas de partie Monocompte
  reset(); assert.strictEqual(send(1, "T:sans partie", "m"), "OK");
  assert.deepStrictEqual(last("m", 1), { cls: null, lvl: 1, title: null, data: { mono: true, s: 0 } }, "sans partie Monocompte : classe vide, niveau 1, sans titre");
  // partie envoyée, pas encore validée : meta de mono.parties (héros principal hc / hl, titre actif)
  q(`insert into mono.parties (user_id, saison, data, meta) values ('${U(1)}', 0, '{}', '{"main":"cra","mainLvl":9,"title":"Voyageur du Temps","hc":"cra","hl":9,"hn":"Flèche"}')`);
  reset(); assert.strictEqual(send(1, "T:partie envoyée", "m"), "OK");
  assert.deepStrictEqual(last("m", 1), { cls: "cra", lvl: 9, title: "Voyageur du Temps", data: { mono: true, s: 0 } }, "partie Monocompte envoyée : son héros");
  // partie validée par le Bouclier : niveau et classe du résumé du serveur (la partie envoyée, plus loin, n'est pas encore validée)
  q(`insert into mono.parties_ok (user_id, saison, data, resume, accept) values ('${U(1)}', 0, '{}', '{"niveau":12,"classe":"cra","nom":"Flèche"}', true);
     update mono.parties set meta = meta || '{"hl":15,"mainLvl":15}' where user_id = '${U(1)}'`);
  reset(); assert.strictEqual(send(1, "T:Bonjour du Monocompte", "m"), "OK");
  const mm = last("m", 1);
  assert.deepStrictEqual(mm, { cls: "cra", lvl: 12, title: "Voyageur du Temps", data: { mono: true, s: 0 } }, "partie validée : niv. 12 du résumé du serveur, classe et titre Monocompte");
  assert(mm.lvl !== 200 && mm.cls !== "iop" && mm.title !== LEG, "jamais le profil Classique dans 'm'");
  // le même joueur dans 'g' (et en privé) : profil Classique inchangé
  reset(); assert.strictEqual(send(1, "T:Bonjour du Classique", "g"), "OK");
  assert.deepStrictEqual(last("g", 1), { cls: "iop", lvl: 200, title: LEG, data: null }, "'g' : profil Classique");
  reset(); assert.strictEqual(as(1, `select coalesce(chat_send('T:privé', '${U(2)}'), 'OK')`), "OK");
  assert.deepStrictEqual(last("p", 1), { cls: "iop", lvl: 200, title: LEG, data: null }, "privé : profil Classique");
  // héros Monocompte sans titre : aucun titre (pas celui du Classique)
  q(`update mono.parties set meta = meta - 'title' where user_id = '${U(1)}'`);
  reset(); assert.strictEqual(send(1, "T:sans titre", "m"), "OK");
  assert.deepStrictEqual(last("m", 1), { cls: "cra", lvl: 12, title: null, data: { mono: true, s: 0 } }, "héros Monocompte sans titre : sans titre");
  q(`update mono.parties set meta = meta || '{"title":"Voyageur du Temps"}' where user_id = '${U(1)}'`);
  // l'admin sans partie Monocompte : pas son profil Classique non plus
  reset(); assert.strictEqual(send(99, "T:admin mono", "m"), "OK");
  assert.deepStrictEqual(last("m", 99), { cls: null, lvl: 1, title: null, data: { mono: true, s: 0 } }, "admin sans partie Monocompte : classe vide, niveau 1");
  // niveau minimal du chat : compté sur le héros Monocompte dans 'm', sur le Classique dans 'g'
  q(`update chat_settings set min_level = 13`); reset();
  assert.strictEqual(send(1, "T:niv min m", "m"), "Il faut un héros au niveau 13 pour écrire.", "niveau minimal : héros Monocompte niv. 12 refusé dans 'm'");
  assert.strictEqual(send(1, "T:niv min g", "g"), "OK", "niveau minimal : héros Classique niv. 200 accepté dans 'g'");
  q(`update chat_settings set min_level = 12`); reset();
  assert.strictEqual(send(1, "T:niv min m2", "m"), "OK", "niveau minimal atteint par le héros Monocompte");
  q(`update chat_settings set min_level = 0`);
  // carte Monocompte (clic sur le pseudo dans 'm')
  const card = (i, who) => JSON.parse(as(i, `select coalesce(chat_mono_profil('${U(who)}')::text, 'null')`));
  assert.deepStrictEqual(card(99, 1), { s: 0, nom: "Saison de test", cls: "cra", lvl: 12, title: "Voyageur du Temps", hero: "Flèche", u: U(1), pseudo: "Joueur01" }, "carte Monocompte : pseudo, héros, titre, saison");
  assert.deepStrictEqual(card(1, 99), { s: 0, nom: "Saison de test", cls: null, lvl: 1, title: null, hero: null, u: U(99), pseudo: "Joueur99" }, "carte d'un joueur sans héros Monocompte");
  assert.strictEqual(card(2, 1), null, "compte sans accès au Monocompte : pas de carte");
  fails(() => anon(`select chat_mono_profil('${U(1)}')`), /permission denied/, "visiteur : pas de carte");
  // saison finie : plus de héros en cours
  q(`update mono.saisons set etat = 'finie' where id = 0`);
  reset(); assert.strictEqual(send(1, "T:saison finie", "m"), "OK");
  assert.deepStrictEqual(last("m", 1), { cls: null, lvl: 1, title: null, data: { mono: true, s: null } }, "saison finie : pas de héros Monocompte");
  // chat.sql relancé avec des parties Monocompte : sans danger, messages gardés
  const avant = q(`select count(*) from chat_msgs`); deploy(src); assert.strictEqual(q(`select count(*) from chat_msgs`), avant);
  console.log("ok - profils séparés : 'm' montre le héros Monocompte (partie validée, sinon envoyée ; titre Monocompte ; rien sans héros ou saison finie), jamais le Classique (niv. 200, « Légende de la 1.0 ») ; 'g' et privés gardent le Classique ; carte Monocompte réservée aux comptes du salon ; niveau minimal sur le héros Monocompte");

  // ---------- 6. 2.1.36 : un bandeau Monocompte ne prend pas la place des annonces en boucle du Classique ----------
  file("annonces_boucle.sql"); deploy(src); file("annonces_boucle.sql");
  q(`delete from announces; delete from chat_msgs where kind = 'ann'`);
  as(99, `select adm_announce_mono('Bandeau Monocompte', true, false, 0)`);
  assert.strictEqual(as(99, `select coalesce(adm_loop_save(null, 'Boucle Classique', 60, true, false, 10, null, true), 'OK')`), "OK");
  as(1, `select ann_tick()`);
  assert.strictEqual(q(`select string_agg(body || ':' || coalesce(srv, '-'), ',' order by id) from announces where until is null or until > now()`), "Bandeau Monocompte:m,Boucle Classique:-", "bandeau de la boucle publié malgré le bandeau Monocompte, et rangé au Classique");
  as(99, `select adm_announce('Bandeau Classique', true, false, 0)`);
  q(`update announce_loops set next_at = now() - interval '1 minute'`); as(1, `select ann_tick()`);
  assert.strictEqual(+q(`select count(*) from chat_msgs where kind = 'ann' and ch = 'g' and body = 'Boucle Classique'`), 1, "bandeau Classique déjà pris : la boucle passe dans le chat Général");
  console.log("ok - 2.1.36 : chat.sql réappliqué (annonces gardées et Classique, épinglé Monocompte repris de l'ancien, tables pas réécrites) ; adm_pin sans 'm', adm_pin_mono, adm_announce_mono (bandeau srv 'm', message dans 'm'), réservés à Mathis ; un bandeau Monocompte ne bloque pas les annonces en boucle du Classique");
} finally {
  run(`drop database if exists ${DB}`, URL0);
}
