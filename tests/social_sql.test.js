/* supabase/amis.sql (Classique et Monocompte) et supabase/mono_social.sql (Monocompte) dans un vrai Postgres jetable
   (jamais la base en ligne) :
   - amis : demande à accepter (par pseudo ou depuis un pseudo), refus, annulation, demande croisée, blocage (plus de demande
     ni de message privé), 100 amis au plus, mode invisible, présence et « cherche un groupe », invitations, aucun droit
     direct sur les tables, un compte ne voit pas les amis des autres ;
   - classements de saison lus sur la partie validée (mono.apres_validation), Serment de fer perdu après un Sablier
     (et après un abandon, pour toute la saison) ;
   - Couronne du Temps : meilleur de la semaine d'avant, semaine de saison en heure de Paris (changement d'heure du
     dimanche 25/10/2026), change de tête le lundi à 00 h 00, couronne publique ;
   - renfort d'un ami : copie construite par le serveur depuis la partie validée de l'ami (le jeu n'envoie que l'identifiant
     du héros), rendue au combat par mono_renfort_prendre et lue par le Bouclier ; scénarios de triche refusés (copie forgée,
     ami non accepté, ami bloqué, héros absent de la partie validée, renfort + mercenaire, renfort en groupe, serment de fer,
     écart de niveau) ; compteur cosmétique seulement (aucun gain pour l'ami) ;
   - défi de la mutation payé par le registre dans le quota, une fois par source ; aura de fer au passage dans l'Éternel ;
   - le Classique ne change pas (schéma public identique avant/après mono_social.sql) ; ni amis.sql ni mono_social.sql
     dans le déploiement automatique.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/social_sql.test.js
   Sans IDLUS_PG, la partie SQL est sautée. La base « idlus_social_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");

{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/chat.sql"), "liste des fichiers déployés introuvable");
  assert(!/mono_social|amis\.sql/.test(tous), "amis.sql et mono_social.sql ne sont pas déployés automatiquement (accord de Mathis)"); }

const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - amis.sql et mono_social.sql hors du déploiement automatique (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_social_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
  const J = (i, s) => JSON.parse(as(i, `select ${s}`) || "null");
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;`);
  q(`create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql"]) file(path.join(ROOT, "supabase", f));
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`); // droits par défaut de Supabase
  file(path.join(ROOT, "supabase", "monocompte.sql"));
  // contrat avec le Bouclier Monocompte (autre chantier) : créés ici s'ils n'existent pas encore
  q(`create table if not exists mono.parties_ok (user_id uuid not null references auth.users (id) on delete cascade, saison int not null references mono.saisons (id), data text, resume jsonb not null default '{}'::jsonb, at timestamptz not null default now(), primary key (user_id, saison));
     do $$ begin if to_regprocedure('mono.apres_validation(uuid, integer, jsonb)') is null then
       execute 'create function mono.apres_validation(u uuid, s int, r jsonb) returns void language plpgsql as $f$ begin null; end $f$'; end if; end $$;`);
  file(path.join(ROOT, "supabase", "amis.sql")); file(path.join(ROOT, "supabase", "amis.sql")); // relancé : sans danger
  const snap = () => q(`select string_agg(x, E'\\n' order by x) from (
      select 'T ' || table_name || ' ' || column_name || ' ' || data_type x from information_schema.columns where table_schema = 'public'
      union all select 'P ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || coalesce(qual, '') from pg_policies where schemaname = 'public'
      union all select 'D ' || tgrelid::regclass || ' ' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'mono.%'
      union all select 'G ' || table_name || ' ' || grantee || ' ' || privilege_type from information_schema.role_table_grants where table_schema = 'public'
      union all select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname not like 'mono\\_%' and p.proname <> 'couronne_temps') s`);
  const before = snap();
  file(path.join(ROOT, "supabase", "mono_social.sql")); file(path.join(ROOT, "supabase", "mono_social.sql"));
  assert.strictEqual(snap(), before, "mono_social.sql ne touche pas au schéma public du Classique");
  // ordre de chargement : relancer monocompte.sql après mono_social.sql garde les fonctions de mono_social.sql
  file(path.join(ROOT, "supabase", "monocompte.sql"));
  assert.match(q(`select prosrc from pg_proc where oid = 'mono.apres_validation(uuid, integer, jsonb)'::regprocedure`), /lb_saison/, "monocompte.sql relancé : mono.apres_validation de mono_social.sql gardée");
  assert.match(q(`select prosrc from pg_proc where oid = 'mono.etat_social(uuid, integer)'::regprocedure`), /renfort_log/, "monocompte.sql relancé : mono.etat_social de mono_social.sql gardée");

  q(`insert into auth.users select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 120) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || lpad(right(id::text, 3), 3, '0') from auth.users;
     insert into admins values ('${U(99)}');`);
  const P = (i) => "Joueur" + String(i).padStart(3, "0");

  // ======================= amis =======================
  const L = (i) => J(i, `amis_liste()`);
  const dem = (i, who, src) => J(i, `amis_demander(p_pseudo => '${who}'${src ? `, p_src => '${src}'` : ""})`);
  // aucun droit direct, même en lecture ; anon ne fait rien
  for (const s of ["select * from public.amis", "select * from public.amis_demandes", "select * from public.amis_presence", "select * from public.amis_invits",
    `insert into public.amis (user_id, ami) values (auth.uid(), '${U(2)}')`, `insert into public.amis_demandes (de, a) values ('${U(2)}', auth.uid())`,
    "update public.amis_presence set invisible = false", "delete from public.amis", `select public.amis_lier(auth.uid(), '${U(2)}', 'c')`, `select public.amis_n('${U(2)}', 'c')`])
    fails(() => as(1, s), /permission denied/, "écriture ou lecture directe : " + s);
  fails(() => q(`set role anon; select amis_liste()`), /permission denied/, "anon");
  fails(() => q(`set role anon; select amis_demander(null, 'Joueur002')`), /permission denied/, "anon");
  // demande par pseudo, puis acceptation
  assert.deepStrictEqual(dem(1, P(2)), { ok: true, etat: "envoyee" });
  assert.match(JSON.stringify(dem(1, P(2))), /déjà envoyée/);
  assert.match(JSON.stringify(dem(1, "Personne")), /Pseudo inconnu/); assert.match(JSON.stringify(dem(1, P(1))), /toi-même/);
  let l2 = L(2); assert.strictEqual(l2.recues.length, 1); assert.strictEqual(l2.recues[0].p, P(1));
  assert.strictEqual(L(1).envoyees[0].p, P(2));
  assert.deepStrictEqual(J(2, `amis_repondre('${U(1)}', true)`), { ok: true, etat: "amis" });
  assert.strictEqual(L(1).amis[0].p, P(2)); assert.strictEqual(L(2).amis[0].p, P(1)); assert.strictEqual(L(2).recues.length, 0);
  assert.match(JSON.stringify(dem(2, P(1))), /déjà amis/);
  // un compte ne voit pas les amis des autres
  assert.strictEqual(L(3).amis.length, 0); assert.strictEqual(L(3).recues.length, 0);
  // demande depuis le chat (par identifiant), refus ; demande croisée = amis tout de suite ; annulation
  assert(J(3, `amis_demander(p_user => '${U(1)}', p_src => 'chat')`).ok); assert.strictEqual(L(1).recues[0].src, "chat");
  assert.deepStrictEqual(J(1, `amis_repondre('${U(3)}', false)`), { ok: true, etat: "refusee" }); assert.strictEqual(L(1).amis.length, 1);
  assert(dem(4, P(5), "classement").ok); assert.deepStrictEqual(dem(5, P(4), "guilde"), { ok: true, etat: "amis" });
  assert(dem(6, P(7)).ok); assert(J(6, `amis_annuler('${U(7)}')`).ok); assert.strictEqual(L(7).recues.length, 0);
  assert.match(JSON.stringify(J(7, `amis_repondre('${U(6)}', true)`)), /n'existe plus/);
  // blocage : plus de demande, plus de message privé ; l'amitié et les demandes disparaissent
  assert(J(2, `amis_bloquer(p_user => '${U(1)}')`).ok);
  assert.strictEqual(L(1).amis.length, 0, "bloqué : l'amitié disparaît"); assert.strictEqual(L(2).bloques[0].p, P(1));
  assert.match(JSON.stringify(dem(1, P(2))), /ne reçoit pas de demandes/);
  assert.strictEqual(as(1, `select chat_send('coucou', '${U(2)}')`), "Ce joueur ne reçoit pas tes messages.", "bloqué : plus de message privé");
  assert.match(JSON.stringify(dem(2, P(1))), /débloque-le/);
  assert(J(2, `amis_bloquer(p_user => '${U(1)}', p_on => false)`).ok); assert(dem(1, P(2)).ok, "débloqué : la demande repasse"); assert.strictEqual(J(2, `amis_repondre('${U(1)}', true)`).etat, "amis");
  assert.strictEqual(as(1, `select chat_send('coucou', '${U(2)}')`), "", "débloqué : message privé possible");
  // limite de 100 amis (des deux côtés)
  q(`insert into public.amis (user_id, ami) select '${U(10)}', id from auth.users where id <> '${U(10)}' and id between '${U(11)}' and '${U(110)}'
     union all select id, '${U(10)}' from auth.users where id between '${U(11)}' and '${U(110)}'`);
  assert.strictEqual(L(10).amis.length, 100);
  assert.match(JSON.stringify(dem(111, P(10))), /déjà 100 amis/, "100 amis au plus (chez l'autre)");
  assert.match(JSON.stringify(dem(10, P(111))), /déjà 100 amis/, "100 amis au plus (chez soi)");
  q(`insert into public.amis_demandes (de, a) values ('${U(112)}', '${U(10)}')`);
  assert.match(JSON.stringify(J(10, `amis_repondre('${U(112)}', true)`)), /déjà 100 amis/, "accepter au-delà de 100");
  // présence, mode, niveau, « cherche un groupe », invisible
  assert(J(4, `amis_reglages(null, true)`).cherche); as(4, `select amis_presence('mo', 87, 'eni')`);
  let f = L(5).amis.find((x) => x.p === P(4)); assert.deepStrictEqual([f.on, f.mode, f.lvl, f.cls, f.cherche], [true, "mo", 87, "eni", true], JSON.stringify(f));
  as(5, `select amis_presence('cl', 200, 'iop')`);
  assert.match(JSON.stringify(J(5, `amis_inviter('${U(4)}', 'groupe')`)), /"ok":true/, "invitation dans un groupe");
  let inv = L(4).invits; assert.strictEqual(inv.length, 1); assert.strictEqual(inv[0].quoi, "groupe"); assert.strictEqual(inv[0].p, P(5));
  assert.match(JSON.stringify(J(4, `amis_inviter('${U(5)}', 'groupe')`)), /Monocompte/, "groupe : l'ami doit être au Monocompte");
  assert(J(4, `amis_invit_repondre(${inv[0].id}, true)`).ok); assert.strictEqual(L(4).invits.length, 0);
  assert.match(JSON.stringify(J(3, `amis_inviter('${U(4)}', 'groupe')`)), /pas dans tes amis/);
  assert(J(4, `amis_reglages(true, null)`).invisible);
  f = L(5).amis.find((x) => x.p === P(4)); assert.deepStrictEqual([f.on, f.mode, f.cherche, f.vu], [false, null, false, null], "invisible : hors ligne, sans mode ni « cherche un groupe »");
  assert.match(JSON.stringify(J(5, `amis_inviter('${U(4)}', 'rdv')`)), /pas en ligne/, "invisible : pas d'invitation");
  q(`update public.amis_presence set vu = now() - interval '10 minutes' where user_id = '${U(5)}'`); J(4, `amis_reglages(false, null)`);
  assert.strictEqual(L(4).amis.find((x) => x.p === P(5)).on, false, "plus de battement depuis 3 minutes : hors ligne");
  assert(J(4, `amis_retirer('${U(5)}')`).ok); assert.strictEqual(L(5).amis.length, 0, "retirer : des deux côtés");
  // 22/10 (Mathis, 3B) : une liste d'amis par serveur ; le Classique ('c', appel d'avant) et le Monocompte (p_srv 'm') ne se voient pas
  { const LM = (i) => J(i, `amis_liste(p_srv => 'm')`); const demM = (i, who) => J(i, `amis_demander(p_pseudo => '${who}', p_srv => 'm')`);
    assert.strictEqual(LM(1).amis.length, 0, "amis du Classique absents de la liste Monocompte");
    assert(demM(115, P(116)).ok); assert.strictEqual(L(116).recues.length, 0, "demande Monocompte absente du Classique"); assert.strictEqual(LM(116).recues.length, 1);
    assert.strictEqual(J(116, `amis_repondre('${U(115)}', true, 'm')`).etat, "amis");
    assert.strictEqual(LM(115).amis.length, 1); assert.strictEqual(L(115).amis.length, 0, "ami du Monocompte absent du Classique");
    assert.match(JSON.stringify(J(116, `amis_repondre('${U(115)}', true)`)), /n'existe plus/, "la demande Monocompte ne s'accepte pas depuis le Classique");
    as(116, `select amis_presence('mo', 50, 'iop')`);
    assert.match(JSON.stringify(J(115, `amis_inviter('${U(116)}', 'groupe')`)), /pas dans tes amis/, "invitation depuis le Classique : pas ami au Classique");
    assert(J(115, `amis_inviter('${U(116)}', 'groupe', null, 'm')`).ok, "invitation depuis le Monocompte");
    assert.strictEqual(J(116, `amis_liste()`).invits.length, 0); assert.strictEqual(LM(116).invits.length, 1, "invitation visible seulement au Monocompte");
    assert.strictEqual(J(115, `amis_retirer('${U(116)}')`).ok, false); assert.strictEqual(LM(116).amis.length, 1, "retirer au Classique ne touche pas le Monocompte");
    assert(J(115, `amis_retirer('${U(116)}', 'm')`).ok); assert.strictEqual(LM(116).amis.length, 0);
    console.log("ok - amis : listes séparées Classique / Monocompte (demandes, réponses, invitations, retrait)"); }

  // ======================= Monocompte : saison, classements, couronne =======================
  J(99, `mono_adm_saison(0, 'Saison de test', '2026-10-19 00:00 Europe/Paris', true, 'ouverte')`);
  for (const i of [1, 2, 3, 4, 5, 6]) as(99, `select mono_adm_testeur('${P(i)}', true)`);
  const at = (ts) => q(`update mono.saisons set clk_t = '${ts}'::timestamptz, clk_ref = now(), clk_pause = true where id = 0`);
  const valide = (i, r) => q(`insert into mono.parties_ok (user_id, saison, data, resume) values ('${U(i)}', 0, 'x', '${JSON.stringify(r).replace(/'/g, "''")}') on conflict (user_id, saison) do update set resume = excluded.resume, at = now();
    select mono.apres_validation('${U(i)}', 0, '${JSON.stringify(r).replace(/'/g, "''")}'::jsonb)`);
  fails(() => as(8, `select mono_classement('niveau')`), /réservé aux testeurs/, "classements : testeurs seulement");
  for (const s of ["select * from mono.lb_saison where user_id <> auth.uid()", `insert into mono.lb_saison (user_id, saison, niveau) values (auth.uid(), 0, 200)`, `select mono.apres_validation(auth.uid(), 0, '{"niveau":200}')`,
    `insert into mono.grp_semaine (user_id, saison, semaine, k, ms, at) values (auth.uid(), 0, 1, 15, 1, now())`, `update mono.renforts set aides = 999`])
    if (/^select \* from/.test(s)) assert.strictEqual(as(1, s.replace("*", "count(*)")), "0", "RLS : lignes des autres invisibles"); else fails(() => as(1, s), /permission denied/, "écriture directe : " + s);
  at("2026-10-21 12:00 Europe/Paris"); // semaine 1
  // 1 Iop niveau 120 sous serment de fer ; 2 Crâ 150 ; 3 Éniripsa 90 sous serment
  valide(1, { niveau: 120, classe: "iop", nom: "Fer1", serment: "fer", aide: { sab: 0, merc: 0, ren: 0 }, phenix: { etape: 2, renaissances: 0 }, grp: { 8: { ms: 300000, at: "2026-10-20T18:00:00Z" } } });
  valide(2, { niveau: 150, classe: "cra", nom: "Arc", phenix: { etape: 5, renaissances: 40 }, grp: { 8: { ms: 250000, at: "2026-10-21T10:00:00Z" }, 9: { ms: 400000, at: "2026-10-21T11:00:00Z" } } });
  valide(3, { niveau: 90, classe: "eni", nom: "Soin", serment: "fer", aide: {}, phenix: 1500 });
  const C = (i, t) => J(i, `mono_classement('${t}')`);
  assert.deepStrictEqual(C(1, "niveau").rows.map((r) => r.p), [P(2), P(1), P(3)], "classement de niveau");
  assert.deepStrictEqual(C(1, "phenix").rows.map((r) => r.p), [P(2), P(1), P(3)], "Dofus du Phénix : étapes puis renaissances");
  assert.deepStrictEqual(C(1, "grp").rows.map((r) => [r.p, r.k, r.ms]), [[P(2), 9, 400000], [P(1), 8, 300000]], "donjon de groupe : stasis la plus haute d'abord");
  assert.deepStrictEqual(C(1, "fer").rows.map((r) => r.p), [P(1), P(3)], "Serment de fer : à part");
  assert.strictEqual(C(3, "niveau").moi.rang, 3, "ma ligne");
  // la partie validée seulement : une partie envoyée mais non validée ne compte pas
  q(`insert into mono.parties (user_id, saison, data) values ('${U(4)}', 0, '{"niveau":200}')`);
  assert(!C(1, "niveau").rows.some((r) => r.p === P(4)), "partie non validée : hors classement");
  // Sablier sous serment : le serveur sort la partie du classement de fer, pour toute la saison
  valide(1, { niveau: 121, classe: "iop", nom: "Fer1", serment: "fer", aide: { sab: 120, merc: 0, ren: 0 }, grp: { 8: { ms: 300000, at: "2026-10-20T18:00:00Z" } } });
  assert.deepStrictEqual(C(1, "fer").rows.map((r) => r.p), [P(3)], "Sablier utilisé : hors du classement de fer");
  valide(1, { niveau: 122, classe: "iop", nom: "Fer1", serment: "fer", aide: { sab: 0 }, grp: { 8: { ms: 300000, at: "2026-10-20T18:00:00Z" } } });
  assert.deepStrictEqual(C(1, "fer").rows.map((r) => r.p), [P(3)], "un résumé sans aide ne fait pas revenir la partie");
  valide(3, { niveau: 91, classe: "eni", nom: "Soin", serment: null, phenix: 1500 });
  assert.deepStrictEqual(C(1, "fer").rows, [], "abandon du serment : hors du classement de fer");
  valide(3, { niveau: 92, classe: "eni", nom: "Soin", serment: "fer", aide: {}, phenix: 1500 });
  assert.deepStrictEqual(C(1, "fer").rows, [], "abandon : pas de retour dans la saison");
  valide(5, { niveau: 15, classe: "feca", nom: "Mur", serment: "fer", mercenaire: 1 });
  assert.deepStrictEqual(C(1, "fer").rows, [], "mercenaire : hors du classement de fer");

  // Couronne du Temps. Semaine 1 : personne ne la porte ; en tête : 2 (stasis 9).
  let K = J(1, `mono_couronne()`); assert.strictEqual(K.semaine, 1); assert.strictEqual(K.porteur, null); assert.strictEqual(K.en_tete.p, P(2));
  assert.strictEqual(q(`select to_char(('${K.change_at}')::timestamptz at time zone 'Europe/Paris', 'Dy DD/MM HH24:MI') || ' = ' || to_char(('${K.change_at}')::timestamptz at time zone 'UTC', 'DD/MM HH24:MI')`), "Mon 26/10 00:00 = 25/10 23:00",
    "change de tête le lundi 26/10 à 00 h 00 à Paris (dimanche 23 h UTC, après le changement d'heure)");
  assert.strictEqual(as(8, `select couronne_temps()`), "", "couronne publique : personne la semaine 1");
  // changement d'heure : dimanche 25/10 à 23 h 30 à Paris (22 h 30 UTC) = semaine 1 ; lundi 26/10 à 00 h 30 (25/10 23 h 30 UTC) = semaine 2
  valide(6, { niveau: 100, classe: "osa", nom: "Bête", grp: { 9: { ms: 380000, at: "2026-10-25T22:30:00Z" }, 10: { ms: 900000, at: "2026-10-25T23:30:00Z" } } });
  assert.deepStrictEqual(q(`select string_agg(semaine || ':' || k, ',' order by semaine) from mono.grp_semaine where user_id = '${U(6)}'`), "1:9,2:10", "semaine de Paris, changement d'heure compris");
  K = J(1, `mono_couronne()`); assert.strictEqual(K.en_tete.p, P(6), "semaine 1 : 6 bat 2 à la stasis 9 (380 000 < 400 000)");
  at("2026-10-25 23:59 Europe/Paris"); assert.strictEqual(J(1, `mono_couronne()`).semaine, 1, "dimanche 23 h 59 : encore la semaine 1");
  at("2026-10-26 00:00 Europe/Paris"); K = J(2, `mono_couronne()`);
  assert.deepStrictEqual([K.semaine, K.porteur.p, K.porteur.k, K.porteur.ms, K.en_tete.p], [2, P(6), 9, 380000, P(6)], "lundi 00 h 00 : la couronne change de tête : " + JSON.stringify(K));
  assert.deepStrictEqual(J(8, `couronne_temps()`), { u: U(6), p: P(6), semaine: 2 }, "couronne publique (même hors du Monocompte)");
  assert.deepStrictEqual(JSON.parse(q(`set role anon; select couronne_temps()`)).p, P(6), "couronne publique pour anon");
  assert.strictEqual(C(1, "grp").rows.find((r) => r.p === P(6)).couronne, true, "petite couronne dans le classement");
  assert.strictEqual(J(6, `mono_couronne()`).moi, 1, "semaines couronné");
  // semaine 2 : 1 fait mieux (stasis 11) → il porte la couronne la semaine 3
  valide(1, { niveau: 130, classe: "iop", nom: "Fer1", serment: "fer", aide: { sab: 120 }, grp: { 11: { ms: 999000, at: "2026-10-28T10:00:00Z" } } });
  at("2026-11-02 00:00 Europe/Paris"); K = J(1, `mono_couronne()`); assert.deepStrictEqual([K.semaine, K.porteur.p], [3, P(1)]);
  assert.deepStrictEqual([J(6, `mono_bilan()`).couronnes, J(1, `mono_bilan()`).couronnes, J(1, `mono_bilan()`).rang_grp], [1, 1, 1], "bilan : semaines couronné et rang");

  // ======================= renfort d'un ami : copie construite par le serveur =======================
  // la copie vient du résumé de la partie validée (clé « renfort », calculée par le Bouclier, js/verify_mono.js : VM.renfort)
  const copie = (cls, lvl, hid, hp) => ({ n: "Héros", cls, lvl, hid, rf: 1, merc: 0, st: { hpMax: hp || 3000, pa: 11 }, sp: [{ id: "x", lvl: 1 }] });
  for (const i of [20, 21, 22, 23, 24, 25]) as(99, `select mono_adm_testeur('${P(i)}', true)`);
  const amis = (i, j) => q(`insert into public.amis (user_id, ami, srv) values ('${U(i)}', '${U(j)}', 'm'), ('${U(j)}', '${U(i)}', 'm') on conflict do nothing`); // amis du Monocompte (3B)
  const PR = (i, v, extra) => J(i, `mono_renfort_prendre('${U(v)}'${extra ? ", " + extra : ""})`);
  const pub = (i, h) => J(i, `mono_renfort_publier(${h == null ? "" : h})`);
  // 20 prête son Crâ ; 21 l'emprunte (Iop 95, serment ordinaire) ; 22 a seulement demandé 20 en ami ; 23 a été bloqué par 20 ;
  // 24 est sous Serment de fer ; 25 est trop bas (niveau 80)
  assert.match(JSON.stringify(pub(20)), /pas encore validée/, "prêter sans partie validée : refusé");
  valide(20, { niveau: 100, classe: "cra", nom: "Arc", serment: "ord", aide: {} }); // partie validée sans copie du héros
  assert.match(JSON.stringify(pub(20)), /pas dans ta partie validée/, "héros absent de la partie validée : refusé");
  valide(20, { niveau: 100, classe: "cra", nom: "Arc", serment: "ord", aide: {}, renfort: copie("cra", 100, 1) });
  assert.match(JSON.stringify(pub(20, 7)), /pas dans ta partie validée/, "autre héros que celui de la partie validée : refusé");
  // copie forgée : la publication ne prend plus le contenu du client (ancienne signature disparue), et une copie écrite à la main est refusée
  fails(() => as(20, `select mono_renfort_publier('${JSON.stringify(copie("cra", 200, 1, 999999))}'::jsonb)`), /does not exist/, "copie forgée envoyée par le jeu");
  fails(() => as(20, `insert into mono.renforts (user_id, saison, snap, niveau, cls) values (auth.uid(), 0, '{}', 200, 'cra')`), /permission denied/, "copie écrite à la main");
  assert(pub(20, 1).ok, "prêter le héros de la partie validée");
  assert.deepStrictEqual(JSON.parse(q(`select snap from mono.renforts where user_id = '${U(20)}'`)), copie("cra", 100, 1), "la copie est celle de la partie validée");
  assert.strictEqual(q(`select count(*) from mono.lb_saison where resume ? 'renfort'`), "0", "la copie ne va pas dans les classements");
  for (const i of [21, 23, 24, 25]) amis(20, i);
  q(`insert into public.amis_demandes (de, a) values ('${U(22)}', '${U(20)}')`);
  valide(21, { niveau: 95, classe: "iop", nom: "Lame", serment: "ord", aide: {} });
  valide(22, { niveau: 95, classe: "sram", nom: "Ombre", aide: {} }); valide(23, { niveau: 95, classe: "eca", nom: "Chat", aide: {} });
  valide(24, { niveau: 95, classe: "feca", nom: "Mur", serment: "fer", aide: {} }); valide(25, { niveau: 80, classe: "sadi", nom: "Ronce", aide: {} });
  assert(J(20, `amis_bloquer(p_user => '${U(23)}')`).ok);
  assert.deepStrictEqual(J(21, `mono_renforts()`).amis.map((r) => [r.p, r.lvl, r.err]), [[P(20), 100, null]], "renfort visible pour un ami accepté");
  assert.strictEqual(J(22, `mono_renforts()`).amis.length, 0, "ami non accepté : pas de renfort");
  // l'emprunt : la copie du serveur, notée pour le Bouclier ; un compteur cosmétique chez l'ami, rien d'autre
  const avant = { eclats: J(20, `mono_eclats_etat()`), lb: q(`select niveau || '/' || coalesce(phenix, 0) || '/' || coalesce(grp_k, 0) from mono.lb_saison where user_id = '${U(20)}'`),
    partie: q(`select count(*) from mono.parties where user_id = '${U(20)}'`), ok: q(`select md5(resume::text) from mono.parties_ok where user_id = '${U(20)}'`), bons: q(`select count(*) from mono.bons where user_id = '${U(20)}'`) };
  const p1 = PR(21, 20, `'dj', 3`);
  assert.deepStrictEqual([p1.ok, p1.compte, p1.u, p1.p, p1.snap], [true, true, U(20), P(20), copie("cra", 100, 1)], "le combat reçoit la copie du serveur : " + JSON.stringify(p1));
  assert.strictEqual(PR(21, 20, `'dj', 3`).compte, false, "compteur : au plus une fois toutes les 2 minutes");
  assert.strictEqual(J(20, `mono_renforts()`).aides, 1, "compteur cosmétique de l'ami");
  assert.deepStrictEqual(J(20, `mono_eclats_etat()`), avant.eclats, "renfort : aucun Éclat pour l'ami");
  assert.strictEqual(q(`select niveau || '/' || coalesce(phenix, 0) || '/' || coalesce(grp_k, 0) from mono.lb_saison where user_id = '${U(20)}'`), avant.lb, "renfort : aucun gain de classement pour l'ami");
  assert.deepStrictEqual([q(`select count(*) from mono.parties where user_id = '${U(20)}'`), q(`select md5(resume::text) from mono.parties_ok where user_id = '${U(20)}'`), q(`select count(*) from mono.bons where user_id = '${U(20)}'`)],
    [avant.partie, avant.ok, avant.bons], "renfort : ni partie, ni partie validée, ni bon de butin touchés chez l'ami");
  const st = JSON.parse(q(`select public.mono_srv_etat('${U(21)}')::text`));
  assert.deepStrictEqual(st.renforts[0], { u: U(20), snap: copie("cra", 100, 1) }, "le Bouclier lit les copies rendues (mono_srv_etat)");
  assert.deepStrictEqual(JSON.parse(q(`select public.mono_srv_etat('${U(22)}')::text`)).renforts, [], "aucune copie rendue à un autre compte");
  fails(() => as(21, `select public.mono_srv_etat('${U(21)}')`), /permission denied/, "mono_srv_etat : Bouclier seulement");
  // nouvelle partie validée de l'ami : la copie suit (jamais ce que le jeu envoie)
  valide(20, { niveau: 102, classe: "cra", nom: "Arc", serment: "ord", aide: {}, renfort: copie("cra", 102, 1, 3100) });
  assert.deepStrictEqual(PR(21, 20, `'dj', 3`).snap, copie("cra", 102, 1, 3100), "copie refaite depuis la dernière partie validée");
  // scénarios de triche : tous refusés
  const refus = (r, re, why) => { assert(!r.ok && r.err && re.test(r.err), why + " : " + JSON.stringify(r)); };
  refus(PR(22, 20, `'dj', 3`), /pas dans tes amis/, "ami non accepté (demande en attente)");
  refus(PR(23, 20, `'dj', 3`), /pas dans tes amis/, "ami bloqué (l'amitié a disparu)");
  amis(20, 23); refus(PR(23, 20, `'dj', 3`), /pas dans tes amis/, "ami bloqué (même avec les lignes d'amis remises)");
  assert.strictEqual(J(23, `mono_renforts()`).amis.length, 0, "ami bloqué : pas de renfort visible");
  refus(PR(21, 20, `'dj', 3, p_merc => 'iop'`), /l'un ou l'autre/, "renfort + mercenaire ensemble");
  refus(PR(21, 20, `'dj', 3, p_groupe => 'g:42'`), /donjon solo/, "renfort en groupe");
  refus(PR(24, 20, `'dj', 3`), /Serment de fer/, "renfort sous Serment de fer");
  refus(PR(25, 20, `'dj', 3`), /trop fort/, "renfort plus de 10 niveaux au-dessus de la partie validée");
  refus(PR(21, 21, `'dj', 3`), /pas disponible/, "son propre héros");
  refus(PR(21, 23, `'dj', 3`), /pas dans tes amis|pas disponible/, "un joueur qui ne prête pas");
  valide(20, { niveau: 103, classe: "cra", nom: "Arc", serment: "ord", aide: {} }); // héros absent de la nouvelle partie validée
  refus(PR(21, 20, `'dj', 3`), /pas disponible/, "héros absent de la partie validée de l'ami");
  q(`delete from mono.parties_ok where user_id = '${U(21)}'`); valide(20, { niveau: 103, classe: "cra", nom: "Arc", aide: {}, renfort: copie("cra", 103, 1) }); assert(pub(20, 1).ok);
  refus(PR(21, 20, `'dj', 3`), /pas encore validée/, "emprunteur sans partie validée");
  fails(() => as(21, `select mono.renfort_refus(auth.uid(), '${U(20)}', 0)`), /permission denied/, "fonctions internes du renfort");
  fails(() => as(21, `select mono_renfort_utiliser('${U(20)}')`), /does not exist/, "ancien compteur sans vérification");

  // ======================= défi de la mutation : registre, quota, une fois par semaine =======================
  at("2026-10-21 12:00 Europe/Paris");
  // 6a : payé par des bons de butin depuis la ligne « act:<jour>:mut » de la partie validée (mono.bons_partie), 20 par semaine
  const g0 = J(2, `mono_eclats_etat()`).genere;
  assert.strictEqual(q(`select mono.bons_partie('${U(2)}', 0, '[{"j":3,"k":"mut","n":20}]')`), "20", "défi de groupe de la semaine : 20 Éclats");
  assert.strictEqual(q(`select mono.bons_partie('${U(2)}', 0, '[{"j":3,"k":"mut","n":20}]')`), "0", "le même jour : rien de plus");
  assert.strictEqual(q(`select mono.bons_partie('${U(2)}', 0, '[{"j":2,"k":"mut","n":20}]')`), "0", "un autre jour de la même semaine : rien de plus (20 par semaine)");
  assert.strictEqual(J(2, `mono_eclats_etat()`).genere, g0 + 20, "compté dans le quota");

  // ======================= aura de fer au passage dans l'Éternel =======================
  valide(3, { niveau: 92, classe: "eni", nom: "Soin", serment: "fer", aide: {} }); // perdu (abandon) : pas d'aura
  as(99, `select mono_adm_testeur('${P(115)}', true)`);
  valide(115, { niveau: 200, classe: "sacri", nom: "Roc", serment: "fer", aide: { sab: 0, merc: 0, ren: 0 } });
  for (const i of [1, 2, 3, 115]) as(i, `select mono_push('partie', '{}', '1', 'pc', null, true)`);
  J(99, `mono_adm_fin_saison(0)`);
  assert.strictEqual(as(115, `select cosm_mine()::text like '%fer_aura%'`), "t", "aura de fer : droit partagé du compte");
  for (const i of [1, 2, 3]) assert.strictEqual(as(i, `select cosm_mine()::text like '%fer_aura%'`), "f", "pas d'aura sans serment tenu");
  assert.strictEqual(snap(), before, "schéma public toujours identique");
  console.log("ok - amis.sql (demandes, refus, blocage = plus de demande ni de message privé, 100 amis, invisible, invitations, aucun droit direct, listes privées) et mono_social.sql (classements sur la partie validée, Serment de fer perdu après Sablier ou abandon, Couronne du Temps en semaine de Paris avec le changement d'heure, renfort sans gain, défi de la mutation dans le quota, aura de fer), Classique intact");
} finally { psql(`drop database if exists ${DB}`); }
