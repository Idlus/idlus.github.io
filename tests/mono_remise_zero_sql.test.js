/* Remise à zéro des parties de la bêta Monocompte (tools/serveur/mono_remise_zero.sql, 2.1.35.2) dans un vrai Postgres
   jetable (jamais la base en ligne) :
   - ordre de chargement monocompte.sql → amis.sql → mono_social.sql → mono_bureau.sql → mono_cles.sql ;
   - 2 testeurs avec parties, copies, Bouclier, bons, Éclats, collection, droits, HdV de saison (annonces, ventes, offres),
     échanges, classements, renforts, Bureau (recherche, salon, membres, invitations, combat, butins, journal, discussion,
     expédition, inscriptions, rendez-vous), plus une saison finie (9) et une partie du Classique qui ne bougent pas ;
   - garde-fou : saison 0 pas ouverte → rien n'est fait ;
   - après l'outil : tout vide pour la saison 0 ; saisons, testeurs, clés, journal des clés, amis, réglages, saison 9 et
     Classique intacts ; génération 1 lue par mono_acces ;
   - une ancienne partie (meta.gen absent ou 0) est refusée par mono_push et mono_srv_push ; une nouvelle (meta.gen = 1) passe ;
   - relance de l'outil : rien n'est effacé (la nouvelle partie reste) ; relance de monocompte.sql : la génération reste.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/mono_remise_zero_sql.test.js
   Sans IDLUS_PG, le test SQL est sauté. La base « idlus_mono_rz » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
const TOOL = path.join(ROOT, "tools/serveur/mono_remise_zero.sql");
{ // l'outil et l'étape du workflow (sauvegarde complète, monocompte.sql puis mono_cles.sql, puis l'outil)
  const t = fs.readFileSync(TOOL, "utf8");
  assert(/^\\set ON_ERROR_STOP on$/m.test(t) && /^begin;$/m.test(t) && /^commit;$/m.test(t), "outil : ON_ERROR_STOP et une transaction");
  const ovh = fs.readFileSync(path.join(ROOT, ".github/workflows/serveur-ovh.yml"), "utf8");
  const st = ovh.split("      - name: ").find((x) => /inputs\.etape == 'monocompte-remise-zero'/.test(x)) || "";
  assert(st, "étape monocompte-remise-zero absente"); assert(/options: \[[^\]]*\bmonocompte-remise-zero\b[^\]]*\]/.test(ovh), "option monocompte-remise-zero");
  assert(/pg_dumpall/.test(st) && /for f in supabase\/monocompte\.sql supabase\/mono_cles\.sql tools\/serveur\/mono_remise_zero\.sql; do/.test(st) && /lock_timeout = '3s'/.test(st), "étape : sauvegarde, puis monocompte.sql, mono_cles.sql et l'outil");
  const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous && !/mono/.test(tous), "fichiers Monocompte hors du déploiement automatique"); }
if (!URL0) { console.log("ok - outil de remise à zéro et étape du workflow (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }

const DB = "idlus_mono_rz";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f.includes("/") ? f : path.join(ROOT, "supabase", f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tool = () => { const r = require("child_process").spawnSync("psql", [dbUrl, "-X", "-q", "-f", TOOL], { encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const J = (i, s) => JSON.parse(as(i, `select (${s})::text`) || "null");
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };

const VIDES = ["parties", "parties_ok", "copies", "eternel", "bouclier", "bons", "eclats", "collection", "cosm_droits", "ops", "sortis", "hdv", "ventes", "ordres", "echanges", "objets",
  "lb_saison", "grp_semaine", "renforts", "renfort_log", "bureau_recherches", "bureau_salons", "bureau_combats", "bureau_heros", "bureau_expeditions"];
const ENFANTS = ["bureau_membres", "bureau_invitations", "bureau_combat_membres", "bureau_butins", "bureau_journal", "bureau_msgs", "bureau_inscriptions", "bureau_intentions"];
const GARDEES = ["mono.saisons", "mono.testeurs", "mono.cles", "mono.cles_essais", "mono.act_regles", "mono.defis", "mono.boutique", "mono.bureau_reglages", "mono.bureau_creneaux",
  "mono.bureau_appareils", "mono.bureau_prefs", "public.amis", "public.amis_demandes", "public.amis_presence", "public.saves"];
const n0 = (t) => +q(`select count(*) from mono.${t} where saison = 0`);
const total = (t) => +q(`select count(*) from ${t}`);
const garde = () => GARDEES.map((t) => t + "=" + q(`select md5(coalesce(string_agg(x::text, ',' order by x::text), '')) from ${t} x`)).join(" ");

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql"]) file(f);
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  for (const f of ["monocompte.sql", "amis.sql", "mono_social.sql", "mono_bureau.sql", "mono_cles.sql"]) file(f);
  assert.strictEqual(q(`select count(*) from information_schema.columns where table_schema = 'mono' and table_name = 'saisons' and column_name in ('gen', 'remise')`), "2", "colonnes gen et remise");
  console.log("ok - ordre monocompte.sql → amis.sql → mono_social.sql → mono_bureau.sql → mono_cles.sql, colonnes mono.saisons.gen et remise");

  /* ---------- deux testeurs qui ont joué la saison 0, une saison finie 9, le Classique ---------- */
  const A = U(1), B = U(2);
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 4) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users;
     delete from admins; insert into admins values ('${U(4)}');
     insert into mono.saisons (id, nom, debut, etat, test) values (9, 'Saison finie', now() - interval '200 days', 'finie', false), (0, 'Saison de test', now() - interval '1 day', 'prevue', true);
     insert into mono.testeurs (user_id) values ('${A}'), ('${B}');
     insert into mono.cles (code, lot, utilisee_par, utilisee_a) values ('MONO-ABCD-EFGH', 'Vague 1', '${A}', now()), ('MONO-ABCD-EFGJ', 'Vague 1', null, null);
     insert into mono.cles_essais (user_id, saisie) values ('${B}', 'MONO-ZZZZ-ZZZZ');
     insert into public.amis (user_id, ami) values ('${A}', '${B}'), ('${B}', '${A}'); insert into public.amis_demandes (de, a) values ('${A}', '${U(3)}');
     insert into public.amis_presence (user_id, vu, mode) values ('${A}', now(), 'mo');
     insert into public.saves (user_id, data) values ('${A}', '{"classique":1}');
     insert into mono.bureau_appareils (user_id, appareil) values ('${A}', 'appareil-1'); insert into mono.bureau_prefs (user_id, mp) values ('${A}', false);
     insert into mono.eternel (user_id, saison, data) values ('${A}', 9, '{"eternel":9}');
     insert into mono.cosm_droits (user_id, cle, source, saison) values ('${A}', 'tf_emb_s9', 'boutique:emb', 9);`);
  q(`update mono.saisons set etat = 'ouverte' where id = 0;`);
  for (const u of [A, B]) {
    const o = u === A ? B : A;
    q(`insert into mono.parties (user_id, saison, data, meta) values ('${u}', 0, '{"lvl":200,"kamas":5000000}', '{"lvl":200}');
       insert into mono.parties_ok (user_id, saison, data, resume) values ('${u}', 0, '{"ok":1}', '{"niveau":200}');
       insert into mono.copies (user_id, jour, saison, data) values ('${u}', current_date, 0, '{"copie":1}'), ('${u}', current_date - 1, 0, '{"copie":0}');
       insert into mono.bouclier (user_id, saison, why) values ('${u}', 0, 'refus');
       insert into mono.eternel (user_id, saison, data) values ('${u}', 0, '{"eternel":0}');
       insert into mono.bons (user_id, saison, combat, kind, jour) values ('${u}', 0, 'j1:dj:1', 'dj', 1);
       insert into mono.eclats (user_id, saison, n, origine, source) values ('${u}', 0, 20, 'act', 'bon:j1:dj:1'), ('${u}', 0, -5, 'boutique', 'achat:1');
       insert into mono.collection (user_id, saison, objet) values ('${u}', 0, 'sab');
       insert into mono.cosm_droits (user_id, cle, source, saison) values ('${u}', 'tf_emb', 'boutique:emb', 0);
       insert into mono.ops (user_id, saison, payload) values ('${u}', 0, '{"k":"x"}');
       insert into mono.objets (saison, tpl, owner) values (0, 'coiffe', '${u}');
       insert into mono.sortis (user_id, saison, uid, tpl, op) values ('${u}', 0, 7, 'coiffe', 1);
       insert into mono.hdv (saison, monde, seller, cat, key, name, price) values (0, 's', '${u}', 'res', 'ble', 'Blé', 10);
       insert into mono.ventes (saison, monde, key, cat, qty, price, seller, buyer) values (0, 's', 'ble', 'res', 1, 10, '${u}', '${o}');
       insert into mono.ordres (saison, monde, buyer, cat, key, name, qty, price, held, expires_at) values (0, 's', '${u}', 'res', 'ble', 'Blé', 3, 10, 30, now() + interval '1 day');
       insert into mono.echanges (saison, monde, a, b) values (0, 's', '${u}', '${o}');
       insert into mono.lb_saison (user_id, saison, niveau) values ('${u}', 0, 200);
       insert into mono.grp_semaine (user_id, saison, semaine, k, ms, at) values ('${u}', 0, 1, 9, 60000, now());
       insert into mono.renforts (user_id, saison, snap, niveau, cls, hero) values ('${u}', 0, '{}', 200, 'iop', 1);
       insert into mono.renfort_log (user_id, ami, saison) values ('${u}', '${o}', 0);
       insert into mono.bureau_recherches (user_id, saison, donjons, stasis) values ('${u}', 0, '{bouftou}', 3);
       insert into mono.bureau_heros (user_id, saison) values ('${u}', 0);
       insert into mono.bureau_intentions (creneau, jour, user_id) values (1, current_date, '${u}');`);
  }
  q(`with s as (insert into mono.bureau_salons (saison, chef, did, stasis) values (0, '${A}', 'bouftou', 3) returning id),
          m as (insert into mono.bureau_membres (salon, user_id) select id, u from s, (values ('${A}'::uuid), ('${B}'::uuid)) v (u) returning salon),
          i as (insert into mono.bureau_invitations (salon, user_id, expire_at) select id, '${U(3)}', now() + interval '1 minute' from s returning id),
          j as (insert into mono.bureau_journal (salon, txt) select id, 'salon ouvert' from s returning id),
          g as (insert into mono.bureau_msgs (salon, user_id, body) select id, '${A}', 'salut' from s returning id),
          c as (insert into mono.bureau_combats (salon, saison, did, stasis, seed, etat, transition_fin) select id, 0, 'bouftou', 3, 42, 'fini', now() from s returning id),
          cm as (insert into mono.bureau_combat_membres (combat, user_id) select id, u from c, (values ('${A}'::uuid), ('${B}'::uuid)) v (u) returning combat),
          bt as (insert into mono.bureau_butins (combat, user_id) select id, u from c, (values ('${A}'::uuid), ('${B}'::uuid)) v (u) returning combat)
     select 1;
     with e as (insert into mono.bureau_expeditions (saison, org, did, stasis, heure, places) values (0, '${B}', 'bouftou', 3, now() + interval '1 day', 4) returning id)
     insert into mono.bureau_inscriptions (expedition, user_id) select id, '${A}' from e;`);
  for (const t of VIDES) assert(n0(t) > 0, "données de départ : " + t);
  for (const t of ENFANTS) assert(total("mono." + t) > 0, "données de départ : " + t);
  const g0 = garde();

  /* ---------- garde-fou : la saison 0 doit être la saison ouverte ---------- */
  q(`update mono.saisons set etat = 'prevue' where id = 0;`);
  { const r = tool(); assert.notStrictEqual(r.code, 0, "saison 0 pas ouverte : l'outil s'arrête"); assert.match(r.out, /pas la saison de test 0/, r.out); }
  assert(n0("parties") === 2 && q(`select gen from mono.saisons where id = 0`) === "0", "garde-fou : rien d'effacé, génération 0");
  q(`update mono.saisons set etat = 'ouverte' where id = 0;`);
  console.log("ok - garde-fou : saison 0 pas ouverte → rien n'est fait");

  /* avant la remise : une partie sans génération passe encore (jeu 2.1.35.1, serveur pas encore remis) */
  assert(as(1, `select mono_push('{"avant":1}', '{"lvl":200}'::jsonb, '2.1.35.1', 'ordinateur', null, true)`), "avant la remise : envoi accepté");
  assert.strictEqual(J(1, "mono_acces()").saison.gen, 0, "mono_acces : génération 0 avant la remise");

  /* ---------- remise à zéro ---------- */
  const r1 = tool(); assert.strictEqual(r1.code, 0, "outil : " + r1.out);
  assert.match(r1.out, /Remise à zéro faite : saison 0, génération 1/, r1.out);
  assert(/mono\.parties\s*\|\s*efface \(saison 0\)\s*\|\s*2\s*\|\s*0/.test(r1.out), "comptes avant/après affichés : " + r1.out);
  assert(!/5000000|"lvl"|salut|MONO-ABCD/.test(r1.out), "l'outil n'affiche aucune donnée de joueur");
  for (const t of VIDES) assert.strictEqual(n0(t), 0, "saison 0 vide : " + t);
  for (const t of ENFANTS) assert.strictEqual(total("mono." + t), 0, "vide : " + t);
  assert.strictEqual(q(`select gen || ' ' || (remise is not null) || ' ' || etat from mono.saisons where id = 0`), "1 true ouverte", "marqueur de remise, saison toujours ouverte");
  const g1 = garde().split(" "); const g0s = g0.split(" ");
  g0s.forEach((x, i) => { if (!x.startsWith("mono.saisons=")) assert.strictEqual(g1[i], x, "intact : " + x.split("=")[0]); });
  assert.strictEqual(q(`select count(*) from mono.eternel where saison = 9`) + q(`select count(*) from mono.cosm_droits where saison = 9`), "11", "saison 9 intacte (Éternel, droit)");
  assert.strictEqual(q(`select count(*) from mono.testeurs`) + q(`select count(*) from mono.cles`) + q(`select count(*) from public.amis`), "222", "testeurs, clés, amis intacts");
  assert.strictEqual(q(`select data from public.saves where user_id = '${A}'`), '{"classique":1}', "partie du Classique intacte");
  console.log(`ok - remise : ${VIDES.length + ENFANTS.length} tables vidées pour la saison 0 ; saisons, testeurs, clés, journal, amis, réglages, saison 9 et Classique intacts`);

  /* ---------- envois après la remise ---------- */
  const acc = J(1, "mono_acces()"); assert(acc.ok && acc.saison.gen === 1 && acc.saison.remise, "mono_acces : génération 1 et date de remise " + JSON.stringify(acc.saison));
  fails(() => as(1, `select mono_push('{"ancienne":1}', '{"lvl":200}'::jsonb, '2.1.35.1', 'ordinateur', null, false)`), /remise à zéro/, "ancienne partie sans génération");
  fails(() => as(1, `select mono_push('{"ancienne":1}', '{"gen":0}'::jsonb, '2.1.35.2', 'ordinateur', null, true)`), /remise à zéro/, "ancienne partie génération 0, envoi forcé");
  fails(() => as(1, `select mono_push('{"ancienne":1}', '{"gen":"1x"}'::jsonb, '2.1.35.2', 'ordinateur', null, true)`), /remise à zéro/, "génération illisible");
  fails(() => q(`select mono_srv_push('${B}', '{"ancienne":1}', '{}'::jsonb, '2.1.35.1', 'téléphone', null, true)`), /remise à zéro/, "fonction serveur « mono » : ancienne partie");
  assert.strictEqual(n0("parties") + n0("copies"), 0, "rien d'écrit par les envois refusés");
  assert(as(1, `select mono_push('{"nouvelle":1}', '{"gen":1,"lvl":1}'::jsonb, '2.1.35.2', 'ordinateur', null, false)`), "nouvelle partie acceptée");
  assert(q(`select mono_srv_push('${B}', '{"nouvelle":2}', '{"gen":1}'::jsonb, '2.1.35.2', 'téléphone', null, false)`), "nouvelle partie du joueur 2 acceptée");
  assert.strictEqual(n0("parties"), 2, "deux nouvelles parties");
  console.log("ok - après la remise : ancienne partie refusée (sans génération, génération 0, illisible, fonction serveur), nouvelle partie acceptée");

  /* ---------- relances ---------- */
  q(`insert into mono.eclats (user_id, saison, n, origine, source) values ('${A}', 0, 3, 'act', 'bon:apres')`);
  const r2 = tool(); assert.strictEqual(r2.code, 0, "relance : " + r2.out); assert.match(r2.out, /déjà faite \(génération 1\)/, r2.out);
  assert.strictEqual(n0("parties") + "," + n0("eclats") + "," + n0("copies"), "2,1,2", "relance : les parties d'après la remise ne sont pas touchées");
  for (const f of ["monocompte.sql", "mono_cles.sql"]) file(f);
  assert.strictEqual(q(`select gen from mono.saisons where id = 0`), "1", "relance de monocompte.sql : génération gardée");
  fails(() => as(2, `select mono_push('{"ancienne":1}', '{}'::jsonb, '2.1.35.1', 'ordinateur', null, true)`), /remise à zéro/, "après relance de monocompte.sql : toujours refusée");
  console.log("ok - relance de l'outil : rien d'effacé (parties d'après la remise gardées) ; relance de monocompte.sql : génération gardée");
} finally {
  run(`drop database if exists ${DB}`, URL0);
}
