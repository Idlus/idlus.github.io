/* supabase/monocompte.sql dans un vrai Postgres jetable (jamais la base en ligne) : espace Monocompte isolé (étape 4) et
   registre des Éclats du Temps (étape 6b), d'après le plan directeur, section 6.2 lignes 4 et 6b.
   - un compte ne lit ni n'écrit hors de son espace, aucune écriture directe, non-testeur refusé ;
   - conflit entre deux appareils, reprise sans perte, compte suspendu, remise par Mathis, copies sur 14 jours ;
   - horloge de test (accélérée, vers l'avant seulement, refusée hors de l'espace de test) ;
   - même source jamais créditée deux fois, bornes du jour, quota de 100 par semaine cumulable compté sur les Éclats générés
     (après une dépense, une vente, un échange, un changement de personnage, un passage à l'Éternel) ;
   - changement de semaine et changement d'heure (heure de Paris, dernier dimanche d'octobre) ; solde = somme des lignes ;
   - achat en boutique = une seule opération (débit + droit), droit jamais en double, objet échangeable sans droit ;
   - Classique intact (tables, colonnes, règles, déclencheurs et droits du schéma public identiques avant/après) ;
   - le déploiement automatique (.github/workflows/supabase.yml) ne passe jamais monocompte.sql.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/monocompte_sql.test.js
   Sans IDLUS_PG (ou sans psql), la partie SQL est sautée. La base « idlus_mono_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");

// déploiement manuel seulement (décision 6A) : le workflow « Serveur en ligne » ne connaît pas monocompte.sql
{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/schema.sql"), "liste des fichiers déployés introuvable");
  assert(!/monocompte/.test(tous), "monocompte.sql ne doit pas être déployé automatiquement"); }

const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - monocompte.sql hors du déploiement automatique (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_mono_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
  const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
  const J = (i, s) => JSON.parse(as(i, `select ${s}`) || "null");
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
  // rôles et authentification simulés (auth.uid() lit request.jwt.claim.sub), comme Supabase
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated;
     create table public.ladder (user_id uuid primary key references auth.users(id) on delete cascade, flagged boolean default false, flag_reason text, main text, main_lvl int);
     create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade); alter table public.admins enable row level security;
     create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;`);
  file(path.join(ROOT, "supabase", "schema.sql"));
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`); // comme les droits par défaut de Supabase
  // photo du Classique (schéma public) avant le Monocompte
  const snap = () => q(`select string_agg(x, E'\\n' order by x) from (
      select 'T ' || table_name || ' ' || column_name || ' ' || data_type || ' ' || coalesce(column_default, '') x from information_schema.columns where table_schema = 'public'
      union all select 'P ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies where schemaname = 'public'
      union all select 'R ' || relname || ' ' || relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r'
      union all select 'D ' || tgrelid::regclass || ' ' || tgname from pg_trigger where not tgisinternal
      union all select 'G ' || table_name || ' ' || grantee || ' ' || privilege_type from information_schema.role_table_grants where table_schema = 'public'
      union all select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname not like 'mono\\_%' and p.proname <> 'cosm_mine') s`);
  const before = snap();
  file(path.join(ROOT, "supabase", "monocompte.sql")); file(path.join(ROOT, "supabase", "monocompte.sql")); // relancé deux fois : sans danger
  assert.strictEqual(snap(), before, "le schéma public du Classique a changé");
  assert.strictEqual(+q(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'mono\\_%' or p.proname = 'cosm_mine')`), 48, "fonctions du jeu");
  // fonctions du Bouclier (mono_srv_*) : la fonction serveur seulement (service_role), ni les joueurs ni anon
  assert.strictEqual(q(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mono\\_srv\\_%'
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'))`), "0", "mono_srv_* : service_role seulement");

  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users;
     insert into admins values ('${U(9)}');`);
  // ---------- saison de test et accès ----------
  fails(() => as(1, `select mono_adm_saison(0, 'Saison de test', '2026-10-19 00:00 Europe/Paris', true, 'ouverte')`), /réservé à Mathis/, "saison créée par un joueur");
  J(9, `mono_adm_saison(0, 'Saison de test', '2026-10-19 00:00 Europe/Paris', true, 'ouverte')`);
  const at = (ts) => q(`update mono.saisons set clk_t = '${ts}'::timestamptz, clk_ref = now(), clk_pause = true where id = 0`); // date de saison figée (superutilisateur du test)
  at("2026-10-19 10:00 Europe/Paris");
  assert.deepStrictEqual(J(5, `mono_acces()`), { ok: false }, "non-testeur");
  for (const f of ["mono_info()", "mono_pull()", "mono_push('x', '{}', '1', 'pc', null)", "mono_eclats_etat()", "mono_hdv_sync(0)", "mono_trade_state()", "mono_eclats_defi('d1', 0)", "mono_boutique_achat('emb')", "mono_copies()", "mono_eternel()", "mono_delete()"])
    fails(() => as(5, `select ${f}`), /réservé aux testeurs/, "non-testeur : " + f);
  fails(() => as(1, `select mono_adm_testeur('Joueur01', true)`), /réservé à Mathis/, "un joueur s'ouvre l'accès");
  for (const i of [1, 2, 3, 4]) assert.strictEqual(as(9, `select mono_adm_testeur('Joueur0${i}', true)`), "");
  assert.strictEqual(as(9, `select mono_adm_testeur('Inconnu', true)`), "Pseudo inconnu.");
  const A = J(1, `mono_acces()`); assert(A.ok && A.saison.id === 0 && A.saison.test && A.jour === 1 && A.semaine === 1 && A.manche === 1, JSON.stringify(A));
  assert(J(9, `mono_acces()`).ok, "l'admin entre aussi");
  // ---------- aucune écriture directe, aucune fonction interne, rien pour anon ----------
  const direct = ["insert into mono.parties (user_id, saison, data) values (auth.uid(), 0, 'x')", "insert into mono.eclats (user_id, saison, n, origine, source) values (auth.uid(), 0, 500, 'defi', 'triche')",
    "insert into mono.cosm_droits (user_id, cle, source) values (auth.uid(), 'tf_aura', 'triche')", "insert into mono.testeurs (user_id) values ('" + U(5) + "')", "update mono.eclats set n = 999",
    "delete from mono.eclats", "insert into mono.eternel (user_id, saison, data) values (auth.uid(), 0, 'x')", "insert into mono.copies (user_id, jour, saison, data) values (auth.uid(), current_date, 0, 'x')",
    "update mono.saisons set clk_vitesse = 168", "insert into mono.collection (user_id, saison, objet) values (auth.uid(), 0, 'cri')", "select mono.mouvement(auth.uid(), 0, 500, 'defi', 'triche')",
    "select mono.vers_eternel(auth.uid(), 0)", "select mono.etat('" + U(2) + "', 0)",
    "insert into mono.parties_ok (user_id, saison, data) values (auth.uid(), 0, 'x')", "update mono.parties_ok set resume = '{}'", "select mono.bon(auth.uid(), 0, 'dj', 'triche', 8)",
    "insert into mono.bons (user_id, saison, combat, kind, jour) values (auth.uid(), 0, 'triche', 'dj', 1)", "insert into mono.ops (user_id, saison, payload) values (auth.uid(), 0, '{\"k\": 1000000}')",
    "select mono_srv_valider(auth.uid(), now()::text, '{}', '{}', 0, '[]')", "select mono_srv_push(auth.uid(), 'x', '{}', '1', 'pc', null)", "select mono_srv_etat(auth.uid())",
    "select mono.apres_validation(auth.uid(), 0, '{}')", "select mono.payer_defis(auth.uid(), 0)", "select mono.cloture_marche(0, 10)"];
  for (const s of direct) fails(() => as(1, s), /permission denied/, "écriture directe : " + s);
  for (const s of ["select * from mono.parties", "select mono_acces()", "select cosm_mine()", "select mono_push('x', '{}', '1', 'pc', null)"])
    fails(() => q(`set role anon; ${s}`), /permission denied/, "anon : " + s);

  // ---------- partie en ligne : envoi, reprise sans perte, conflit entre deux appareils ----------
  const txt = JSON.stringify({ mono: { s: 1 }, chars: [{ name: "Évangéline l'Éniripsa", lvl: 12 }], note: "é".repeat(5000) }).replace(/'/g, "''");
  const t1 = as(1, `select mono_push('${txt}', '{"lvl":12,"pid":"pc"}', '2.1.34', 'ordinateur', null)`); assert(/Z$/.test(t1), "premier envoi : " + t1);
  assert.strictEqual(as(1, `select mono_pull()`), txt.replace(/''/g, "'"), "reprise sans perte");
  assert.strictEqual(as(1, `select mono_push('autre', '{}', '2.1.34', 'téléphone', null)`), "", "deuxième appareil sans version connue : conflit");
  const i1 = as(1, `select updated_at || '|' || saison from mono_info()`); assert.strictEqual(i1, t1 + "|0", "même format de date que push_save");
  const t2 = as(1, `select mono_push('v2', '{"lvl":13}', '2.1.34', 'ordinateur', '${t1}')`); assert(t2 && t2 !== t1, "envoi suivant");
  assert.strictEqual(as(1, `select mono_push('v2-tel', '{}', '2.1.34', 'téléphone', '${t1}')`), "", "appareil en retard : conflit, rien d'écrit");
  assert.strictEqual(as(1, `select mono_pull()`), "v2");
  const t3 = as(1, `select mono_push('v3-tel', '{}', '2.1.34', 'téléphone', '${t1}', true)`); assert(t3, "version de l'appareil gardée (envoi forcé)");
  assert.strictEqual(as(1, `select mono_pull()`), "v3-tel");
  // isolement : un autre compte ne voit ni ne touche rien
  assert.strictEqual(as(2, `select count(*) from mono_info()`), "0"); assert.strictEqual(as(2, `select mono_pull()`), "");
  assert.strictEqual(as(2, `select count(*) from mono.parties`), "0", "RLS : la partie d'un autre est invisible"); assert.strictEqual(as(1, `select count(*) from mono.parties`), "1");
  assert.strictEqual(as(2, `select count(*) from mono.copies`), "0");
  const t4 = as(2, `select mono_push('partie-2', '{}', '2.1.34', 'pc', null)`); assert(t4);
  assert.strictEqual(as(1, `select mono_pull()`), "v3-tel", "l'envoi d'un autre compte ne touche pas la partie");
  assert.strictEqual(q(`select count(*) from public.saves`), "0", "rien dans les parties du Classique");
  // compte suspendu, remise par Mathis
  q(`update profiles set suspended_at = now() where id = '${U(3)}'`); fails(() => as(3, `select mono_push('x', '{}', '1', 'pc', null)`), /suspendu/, "compte suspendu");
  assert.match(as(3, `select mono_eclats_defi('d1', 0)`), /suspendu/); q(`update profiles set suspended_at = null where id = '${U(3)}'`);
  fails(() => as(1, `select mono_adm_restaurer('${U(1)}', current_date)`), /réservé à Mathis/, "remise par un joueur");
  assert.strictEqual(as(9, `select mono_adm_restaurer('${U(1)}', (now() at time zone 'Europe/Paris')::date)`), "");
  assert.strictEqual(as(1, `select mono_pull()`), txt.replace(/''/g, "'"), "remise : la copie du jour (la première reçue)");
  assert.strictEqual(as(1, `select mono_push('par-dessus', '{}', '1', 'pc', '${t3}', true)`), "", "remise : pas d'envoi forcé par-dessus");
  const t5 = as(1, `select updated_at from mono_info()`); assert(as(1, `select mono_push('repris', '{}', '1', 'pc', '${t5}')`), "remise reprise puis envoi normal");
  // copies sur 14 jours : une par jour, la plus ancienne supprimée
  q(`insert into mono.copies (user_id, jour, saison, data) select '${U(1)}', (now() at time zone 'Europe/Paris')::date - i, 0, 'jour -' || i from generate_series(1, 20) i`);
  as(1, `select mono_push('encore', '{}', '1', 'pc', (select updated_at from mono_info()))`);
  assert.strictEqual(q(`select count(*) || '/' || (min(jour) = (now() at time zone 'Europe/Paris')::date - 13) from mono.copies where user_id = '${U(1)}'`), "14/true", "14 copies");
  assert.strictEqual(+as(1, `select jsonb_array_length(mono_copies())`), 14);
  assert.strictEqual(as(1, `select mono_copie((now() at time zone 'Europe/Paris')::date - 5)`), "jour -5");
  assert.strictEqual(as(2, `select mono_copie((now() at time zone 'Europe/Paris')::date - 5)`), "", "copie d'un autre compte");

  // ---------- horloge de test ----------
  fails(() => as(1, `select mono_adm_horloge(168)`), /réservé à Mathis/, "horloge réglée par un joueur");
  J(9, `mono_adm_horloge(168, null, false)`); q(`update mono.saisons set clk_ref = clk_ref - interval '1 hour' where id = 0`); // une heure réelle à ×168 = une semaine
  assert.strictEqual(J(1, `mono_acces()`).jour, 8, "×168 : une semaine de saison par heure");
  fails(() => as(9, `select mono_adm_horloge(null, 3)`), /vers l'avant/, "horloge reculée");
  assert.strictEqual(J(9, `mono_adm_horloge(24, 10, true)`).jour, 10, "avancer au jour 10, en pause");
  fails(() => as(9, `select mono_adm_horloge(7)`), /vitesse inconnue/, "vitesse");

  // ---------- 2.1.36 : Panel Xener côté Monocompte (lecture seule) : vue d'ensemble et copies d'un joueur ----------
  fails(() => as(1, `select mono_adm_vue()`), /réservé à Mathis/, "vue d'ensemble par un joueur");
  fails(() => as(1, `select mono_adm_copies('${U(1)}')`), /réservé à Mathis/, "copies d'un autre par un joueur");
  q(`insert into mono.bouclier (user_id, saison, why, at) values ('${U(2)}', 0, 'gain trop gros', now() - interval '3 hours'), ('${U(2)}', 0, 'encore', now() - interval '2 hours'), ('${U(3)}', 0, 'niveau impossible', now() - interval '1 hour'), ('${U(5)}', 0, 'vieux refus', now() - interval '9 days')`);
  const clk0 = q(`select clk_t || '|' || clk_ref || '|' || clk_vitesse || '|' || clk_pause from mono.saisons where id = 0`);
  const vu = J(9, `mono_adm_vue()`);
  assert.deepStrictEqual([vu.saison.id, vu.saison.etat, vu.saison.test, vu.saison.jour, vu.saison.vitesse, vu.saison.pause, vu.saison.horloge], [0, "ouverte", true, 10, 24, true, true], "vue : saison de test, jour 10, horloge ×24 en pause " + JSON.stringify(vu.saison));
  assert.strictEqual(vu.testeurs, +q(`select count(*) from mono.testeurs`), "vue : testeurs");
  assert.strictEqual(vu.parties, +q(`select count(*) from mono.parties where saison = 0`), "vue : parties de la saison"); assert(vu.parties >= 2);
  assert.strictEqual(vu.refus, 2, "vue : comptes refusés ces 7 jours"); assert.strictEqual(vu.derniers.length, 4); assert.strictEqual(vu.derniers[0].pseudo, "Joueur03"); assert.strictEqual(vu.derniers[0].why, "niveau impossible");
  assert.strictEqual(q(`select clk_t || '|' || clk_ref || '|' || clk_vitesse || '|' || clk_pause from mono.saisons where id = 0`), clk0, "vue : l'horloge de test n'est pas touchée");
  q(`delete from mono.bouclier`);
  const cp = J(9, `mono_adm_copies('${U(1)}')`);
  assert.strictEqual(cp.length, 14, "copies du joueur (14 jours)"); assert(cp[0].jour > cp[1].jour, "plus récente d'abord"); assert.strictEqual(cp[0].ouverte, true);
  assert.deepStrictEqual(J(9, `mono_adm_copies('${U(8)}')`), [], "joueur sans copie");

  // ---------- registre : bornes du jour, quota cumulable, même bon (6a : les Éclats d'activité ne viennent que des bons du serveur) ----------
  const act = (i, k, n, src) => ({ n: +q(`select mono.bon('${U(i)}', 0, '${k}', '${src}', ${n})`) });
  const etat = (i, s) => J(i, `mono_eclats_etat(${s == null ? "null" : s})`);
  const somme = (i, s) => +q(`select coalesce(sum(n), 0) from mono.eclats where user_id = '${U(i)}' and saison = ${s}`);
  at("2026-10-19 10:00 Europe/Paris"); // jour 1, semaine 1 (lundi)
  assert.strictEqual(act(1, "dj", 12, "j1-dj").n, 8, "8 donjons par jour au plus");
  assert.strictEqual(act(1, "dj", 1, "j1-dj-bis").n, 0, "borne du jour atteinte");
  assert.strictEqual(act(1, "arch", 6, "j1-arch").n + act(1, "job", 4, "j1-job").n + act(1, "grp", 5, "j1-grp").n, 12, "20 par jour en tout");
  assert.strictEqual(act(1, "inconnue", 3, "j1-x").n, 0, "activité inconnue");
  assert.strictEqual(+q(`select mono.bons_partie('${U(1)}', 0, '[{"j": "x", "k": "dj", "n": 3}, {"j": 1, "k": "DJ;", "n": 3}, {"j": 1, "k": "dj", "n": "-4"}]')`), 0, "bons d'une partie : lignes illisibles ignorées");
  assert.strictEqual(+q(`select mono.bons_partie('${U(1)}', 0, '[{"j": 9, "k": "dj", "n": 3}]')`), 0, "bons d'un jour à venir : rien");
  for (let d = 2; d <= 5; d++) { at(`2026-10-${18 + d} 10:00 Europe/Paris`); ["dj:8", "arch:6", "job:4", "grp:2"].forEach((x, j) => { const [k, n] = x.split(":"); act(1, k, +n, `j${d}-${k}`); }); }
  let e = etat(1); assert.deepStrictEqual([e.genere, e.quota, e.reste, e.solde], [100, 100, 0, 100], "quota de la semaine 1 rempli en 5 jours : " + JSON.stringify(e));
  at("2026-10-24 10:00 Europe/Paris"); assert.strictEqual(act(1, "dj", 8, "j6-dj").n, 0, "quota de la semaine atteint");
  // même source jamais créditée deux fois (même un autre jour), même en écriture brute
  at("2026-10-26 10:00 Europe/Paris"); assert.strictEqual(act(1, "dj", 5, "j1-dj").n, 0, "même source, autre jour");
  fails(() => q(`insert into mono.eclats (user_id, saison, n, origine, source) values ('${U(1)}', 0, 1, 'act', 'bon:j1-dj')`), /eclats_source_unique/, "source en double");
  fails(() => q(`insert into mono.eclats (user_id, saison, n, origine, source) values ('${U(1)}', 0, -5, 'defi', 'signe')`), /eclats_signe/, "défi négatif");
  // défis : hors quota, une fois par défi et palier, dans l'ordre, une fois la manche ouverte
  at("2026-10-24 10:00 Europe/Paris");
  const valide = (i, data, defis) => q(`insert into mono.parties_ok (user_id, saison, data, resume) values ('${U(i)}', 0, '${data}', '{"defis": ${JSON.stringify(defis)}}')
    on conflict (user_id, saison) do update set resume = excluded.resume`); // partie validée par le Bouclier (tests/mono_eco_sql.test.js : par la fonction serveur)
  assert.match(JSON.stringify(J(1, `mono_eclats_defi('d1', 0)`)), /pas encore validée/, "défi sans partie validée");
  valide(1, "v3-tel", { d1: 30 });
  assert.strictEqual(J(1, `mono_eclats_defi('d1', 0)`).n + J(1, `mono_eclats_defi('d1', 1)`).n, 96, "progression validée : 2 paliers sur 3");
  assert.match(JSON.stringify(J(1, `mono_eclats_defi('d1', 2)`)), /pas encore validée/, "palier au-delà de la progression validée");
  valide(1, "v3-tel", { d1: 50 });
  assert.strictEqual(J(1, `mono_eclats_defi('d1', 0)`).n + J(1, `mono_eclats_defi('d1', 1)`).n + J(1, `mono_eclats_defi('d1', 2)`).n, 64, "défi 1 : 40 + 56 puis 64, hors quota");
  assert.strictEqual(J(1, `mono_eclats_defi('d1', 2)`).n, 0, "palier déjà payé");
  assert.match(JSON.stringify(J(1, `mono_eclats_defi('d2', 1)`)), /Palier précédent/); assert.match(JSON.stringify(J(1, `mono_eclats_defi('d4', 0)`)), /pas encore ouvert/);
  assert.match(JSON.stringify(J(1, `mono_eclats_defi('d99', 0)`)), /inconnu/);
  e = etat(1); assert.deepStrictEqual([e.genere, e.reste, e.solde], [100, 0, 260], "les défis ne prennent rien au quota");
  // dépense en Boutique temporelle : une seule opération (débit + droit lié au compte)
  const achat = (i, o, s) => J(i, `mono_boutique_achat('${o}'${s != null ? ", " + s : ""})`);
  let b = achat(1, "emb"); assert(b.ok && b.droit === "tf_emb" && b.solde === 60, JSON.stringify(b));
  assert.strictEqual(q(`select count(*) from mono.cosm_droits where user_id = '${U(1)}' and cle = 'tf_emb' and source = 'boutique:emb'`), "1");
  assert.match(JSON.stringify(achat(1, "emb")), /lié à ton compte/, "droit jamais en double"); assert.strictEqual(somme(1, 0), 60, "pas de second débit");
  assert.match(JSON.stringify(achat(1, "aura")), /Il faut 600/); assert.strictEqual(q(`select count(*) from mono.cosm_droits where user_id = '${U(1)}'`), "1", "achat refusé : ni débit ni droit");
  e = etat(1); assert.deepStrictEqual([e.genere, e.reste], [100, 0], "dépense : quota inchangé (jamais remis à zéro)");
  // vente à l'HdV et échange entre joueurs (fonction interne, appelée plus tard par l'HdV de saison, 6a) : hors quota, sans création
  q(`select mono.mouvement('${U(1)}', 0, -50, 'hdv_vente', 'hdv:7', 'vente'); select mono.mouvement('${U(2)}', 0, 50, 'hdv_achat', 'hdv:7', 'achat');
     select mono.mouvement('${U(2)}', 0, -20, 'echange_envoi', 'ech:3', null); select mono.mouvement('${U(3)}', 0, 20, 'echange_recu', 'ech:3', null)`);
  assert.strictEqual(q(`select mono.mouvement('${U(2)}', 0, 50, 'hdv_achat', 'hdv:7', 'achat')`), "0", "même opération d'HdV rejouée");
  fails(() => q(`select mono.mouvement('${U(2)}', 0, -999, 'echange_envoi', 'ech:4', null)`), /solde insuffisant/, "échange au-delà du solde");
  e = etat(1); assert.deepStrictEqual([e.genere, e.reste, e.solde], [100, 0, 10], "vente : quota inchangé");
  const e2 = etat(2), e3 = etat(3); assert.deepStrictEqual([e2.genere, e2.reste, e2.solde, e3.genere, e3.solde], [0, 100, 30, 0, 20], "achat et échange reçus : hors quota");
  assert.strictEqual(q(`select sum(n) from mono.eclats where origine in ('hdv_vente', 'hdv_achat', 'echange_envoi', 'echange_recu')`), "0", "les échanges ne créent rien");
  // changement de personnage : partie effacée puis nouveau héros, le registre et le quota ne bougent pas
  as(1, `select mono_delete()`); assert.strictEqual(as(1, `select count(*) from mono_info()`), "0");
  assert(as(1, `select mono_push('nouveau-heros', '{}', '1', 'pc', null)`)); e = etat(1); assert.deepStrictEqual([e.genere, e.reste, e.solde], [100, 0, 10], "changement de personnage");
  // ---------- semaine et changement d'heure (heure de Paris) ----------
  // départ lundi 19/10 à minuit (UTC+2) ; dimanche 25/10 dure 25 h (passage à UTC+1 à 3 h) ; semaine 2 : lundi 26/10 à minuit = 25/10 23:00 UTC
  const js = () => { const a = J(1, `mono_acces()`); return a.jour + "/" + a.semaine; };
  at("2026-10-24T22:30:00Z"); assert.strictEqual(js(), "7/1", "dimanche 0 h 30 (heure d'été)");
  at("2026-10-25T22:30:00Z"); assert.strictEqual(js(), "7/1", "dimanche 23 h 30 (heure d'hiver) : toujours la semaine 1 (un calcul en UTC dirait semaine 2)");
  assert.strictEqual(act(1, "dj", 8, "j7-dj").n, 0, "dimanche soir : quota de la semaine 1 toujours plein");
  at("2026-10-25T22:59:59Z"); assert.strictEqual(js(), "7/1");
  at("2026-10-25T23:00:00Z"); assert.strictEqual(js(), "8/2", "lundi minuit à Paris : semaine 2");
  e = etat(1); assert.deepStrictEqual([e.quota, e.reste], [200, 100], "semaine 2 : 100 de plus, cumulables");
  assert.strictEqual(act(1, "dj", 8, "j8-dj").n, 8); assert.strictEqual(q(`select jour || '/' || semaine from mono.eclats where source = 'bon:j8-dj'`), "8/2", "ligne datée en heure de Paris");
  at("2026-10-26T22:30:00Z"); assert.strictEqual(act(1, "dj", 8, "j8-dj-soir").n, 0, "lundi 23 h 30 : même jour, borne atteinte");
  at("2026-10-26T23:00:00Z"); assert.strictEqual(act(1, "dj", 8, "j9-dj").n, 8, "mardi minuit : nouvelle journée");
  // deux appareils créditent en même temps : le verrou du compte les fait passer l'un après l'autre (8 au plus, pas 16)
  at("2026-10-28 10:00 Europe/Paris");
  const sess = (src, pause) => `psql '${dbUrl}' -X -q -At -c "begin; select mono.bon('${U(1)}', 0, 'dj', '${src}', 8); select pg_sleep(${pause}); commit;"`;
  execFileSync("bash", ["-c", `${sess("par-a", 0.6)} & sleep 0.2; ${sess("par-b", 0)} & wait`], { encoding: "utf8" });
  assert.strictEqual(q(`select sum(n) from mono.eclats where user_id = '${U(1)}' and jour = 10 and quoi = 'dj'`), "8", "crédits simultanés");
  // cumul : sans jouer de la semaine 3 à la 8, tout reste à prendre, jamais plus de 800
  at("2026-12-13 10:00 Europe/Paris"); e = etat(1); assert.deepStrictEqual([e.jour, e.semaine, e.quota, e.reste], [56, 8, 800, 676], "fin de saison : 800 au plus");
  assert.strictEqual(somme(1, 0), e.solde, "solde = somme des lignes"); assert.strictEqual(somme(2, 0), etat(2).solde); assert.strictEqual(somme(3, 0), etat(3).solde);
  // ---------- achats : objets de collection sans droit, numéro du Cristal, opération unique ----------
  valide(2, "partie-2", Object.fromEntries(Array.from({ length: 12 }, (_, d) => ["d" + (d + 1), 999])));
  for (let d = 1; d <= 12; d++) [0, 1, 2].forEach((p) => J(2, `mono_eclats_defi('d${d}', ${p})`));
  assert.strictEqual(etat(2).solde, 30 + 1600 - 120 - 120, "défi 6 compté par le serveur (pas de ventes), défi 12 en attente des groupes en direct");
  // défi 6 « Marché des échos » : lots vendus à d'autres joueurs, comptés seulement à partir de 3 acheteurs différents
  q(`insert into mono.ventes (saison, monde, key, cat, qty, price, seller, buyer) select 0, 's', 'Blé', 'res', 1, 10, '${U(2)}', '${U(3)}' from generate_series(1, 60)`);
  assert.match(JSON.stringify(J(2, `mono_eclats_defi('d6', 0)`)), /pas encore validée/, "60 ventes au même acheteur : défi 6 non compté");
  q(`insert into mono.ventes (saison, monde, key, cat, qty, price, seller, buyer) values (0, 's', 'Blé', 'res', 1, 10, '${U(2)}', '${U(4)}'), (0, 's', 'Blé', 'res', 1, 10, '${U(2)}', '${U(1)}')`);
  [0, 1, 2].forEach((p) => J(2, `mono_eclats_defi('d6', ${p})`));
  assert.match(JSON.stringify(J(2, `mono_eclats_defi('d12', 0)`)), /pas encore validée/, "défi 12 : groupes en direct, pas encore là");
  q(`select mono.mouvement('${U(2)}', 0, 120, 'echange_recu', 'test:sans-d12', null)`); // remplace le défi 12 pour la suite du test
  assert.strictEqual(etat(2).solde, 30 + 1600, "les 12 défis : 1 600 Éclats");
  b = achat(2, "sab"); assert(b.ok && b.droit === null && b.numero === null, JSON.stringify(b));
  b = achat(2, "cri"); assert(b.ok && b.droit === null && b.numero === 1, "Cristal n° 1 : " + JSON.stringify(b));
  assert.strictEqual(q(`select count(*) from mono.cosm_droits where user_id = '${U(2)}'`), "0", "objets échangeables : jamais de droit");
  assert.match(JSON.stringify(achat(2, "cri")), /Déjà acheté cette saison/);
  // débit et droit ensemble : si le droit ne peut pas s'écrire, le débit n'a pas lieu non plus
  q(`alter table mono.cosm_droits add constraint t_panne check (cle <> 'tf_aura')`);
  fails(() => as(2, `select mono_boutique_achat('aura')`), /t_panne/, "panne pendant l'achat");
  assert.strictEqual(q(`select count(*) from mono.eclats where user_id = '${U(2)}' and source = 'boutique:aura'`), "0", "panne : pas de débit sans droit");
  q(`alter table mono.cosm_droits drop constraint t_panne`);
  b = achat(2, "aura"); assert(b.ok && b.solde === 1630 - 750 - 600, JSON.stringify(b));
  assert.deepStrictEqual(J(2, `cosm_mine()`).map((x) => x.cle), ["tf_aura"], "cosm_mine : ses droits");
  assert.deepStrictEqual(J(1, `cosm_mine()`).map((x) => x.cle), ["tf_emb"], "cosm_mine : seulement les siens");
  assert.strictEqual(as(2, `select count(*) from mono.cosm_droits`), "1", "RLS : droits d'un autre invisibles");
  // titre de défi : droit partagé, une seule fois
  q(`update mono.defis set titre = 'Gardien des échos' where contenu = 1 and defi = 'd9' and palier = 2`);
  valide(3, "partie-3", { d9: 50 });
  [0, 1, 2].forEach((p) => J(3, `mono_eclats_defi('d9', ${p})`)); J(3, `mono_eclats_defi('d9', 2)`);
  assert.deepStrictEqual(J(3, `cosm_mine()`).map((x) => x.cle), ["titre:Gardien des échos"], "titre du défi");
  q(`update mono.defis set titre = null where defi = 'd9'`);
  // ---------- fin de saison : passage à l'Éternel par lots, reprenable ----------
  assert(as(3, `select mono_push('partie-3', '{}', '1', 'pc', null)`));
  const avant = [1, 2, 3].map((i) => etat(i));
  fails(() => as(1, `select mono_adm_fin_saison(0)`), /réservé à Mathis/, "fin de saison par un joueur");
  let f = J(9, `mono_adm_fin_saison(0, 1)`); assert.deepStrictEqual([f.passees, f.reste, f.etat], [1, 2, "cloture"], "premier lot puis coupure");
  fails(() => as(2, `select mono_push('trop-tard', '{}', '1', 'pc', null)`), /fermée/, "plus d'envoi pendant la clôture");
  assert.strictEqual(act(2, "dj", 1, "apres").n, 0, "plus de bon pendant la clôture");
  f = J(9, `mono_adm_fin_saison(0)`); assert.deepStrictEqual([f.passees, f.reste, f.etat], [2, 0, "finie"], "reprise");
  f = J(9, `mono_adm_fin_saison(0)`); assert.deepStrictEqual([f.passees, f.reste], [0, 0], "rejouée : rien de plus");
  assert.strictEqual(q(`select count(*) from mono.parties where saison = 0`), "0"); assert.strictEqual(q(`select count(*) from mono.eternel where saison = 0`), "3");
  assert.strictEqual(as(1, `select mono_eternel_pull(0)`), "nouveau-heros", "Éternel : la dernière partie de la saison");
  assert.strictEqual(as(1, `select count(*) from mono.eternel`), "1", "Éternel d'un autre invisible"); assert.strictEqual(as(1, `select mono_eternel_pull(9)`), "");
  fails(() => as(1, `update mono.eternel set data = 'triche'`), /permission denied/, "Éternel en lecture seule");
  const apres = [1, 2, 3].map((i) => J(i, `mono_eclats_etat(0)`));
  apres.forEach((x, i) => assert.deepStrictEqual([x.solde, x.genere], [avant[i].solde, avant[i].genere], "Éternel : solde et quota exacts"));
  assert.strictEqual(J(1, `mono_eternel()`)[0].solde, avant[0].solde);
  // Boutique d'Archives : dans l'Éternel seulement, avec les Éclats de la saison finie
  assert.match(JSON.stringify(achat(1, "sab", 0)), /Il faut 250/, "Archives : solde de la saison finie");
  b = achat(2, "emb", 0); assert(b.ok && b.droit === "tf_emb" && b.solde === 80, "Archives : " + JSON.stringify(b));
  assert.deepStrictEqual(J(2, `cosm_mine()`).map((x) => x.cle).sort(), ["tf_aura", "tf_emb"]);
  assert.match(JSON.stringify(achat(4, "sab", 0)), /réservée à l'Éternel/, "Archives sans héros dans l'Éternel");
  // nouvelle saison (vraie, sans horloge de test) : les Éclats ne reviennent pas, les droits partagés restent
  J(9, `mono_adm_saison(1, 'Saison 1', now() - interval '1 day', false, 'ouverte', 'Les Fragments du Temps')`);
  fails(() => as(9, `select mono_adm_horloge(168)`), /hors de l'espace de test/, "horloge de test hors de l'espace de test");
  fails(() => q(`update mono.saisons set clk_vitesse = 168 where id = 1`), /horloge_test_seulement/, "horloge sur la vraie saison");
  e = etat(1); assert.deepStrictEqual([e.saison, e.solde, e.genere, e.jour], [1, 0, 0, 2], "nouvelle saison : rien ne revient (règle 9)");
  assert.strictEqual(as(1, `select count(*) from mono_info()`), "0", "nouvelle saison : nouveau héros");
  assert.match(JSON.stringify(achat(1, "emb")), /lié à ton compte/, "droit partagé gardé d'une saison à l'autre");
  assert.match(JSON.stringify(achat(1, "orn", 0)), /Il faut 300/);
  assert.deepStrictEqual(J(1, `cosm_mine()`).map((x) => x.cle).slice(0, 1), ["tf_emb"]);
  // le Classique continue sans rien voir : push_save du Classique pour le même compte
  assert(as(1, `select push_save('classique', '{}', '1', 'pc', null)`)); assert.strictEqual(q(`select data from public.saves where user_id = '${U(1)}'`), "classique");
  assert.strictEqual(as(1, `select count(*) from mono_info()`), "0", "la partie Classique n'est pas une partie Monocompte");
  // compte supprimé : tout son espace Monocompte part avec lui
  q(`delete from auth.users where id = '${U(4)}'`); assert.strictEqual(q(`select count(*) from mono.testeurs where user_id = '${U(4)}'`), "0");
  assert.strictEqual(snap(), before, "schéma public toujours identique");
  console.log("ok - monocompte.sql : espace isolé (accès, aucune écriture directe, conflits, reprise, copies 14 jours, Éternel), registre des Éclats (source unique, bornes, quota cumulable, heure de Paris, solde = somme), boutique en une opération, droits partagés, Classique intact");
} finally { psql(`drop database if exists ${DB}`); }
