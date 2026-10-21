/* supabase/schema.sql dans un vrai Postgres jetable (jamais la base en ligne) : faille de sauvegarde du Classique (21/10/2026).
   Le jeu ne peut plus écrire ni effacer sa ligne de public.saves directement (insert, update, upsert, delete du client) :
   tout passe par push_save (security definer), qui garde la suspension, la remise imposée (meta.remise) et p_expected.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/sauvegarde_rls_sql.test.js
   Sans IDLUS_PG (ou sans psql), le test est sauté. La base « idlus_saves_rls_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."); const DB = "idlus_saves_rls_test";
const url = (db) => db ? URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1") : URL0;
const psql = (sql, db) => execFileSync("psql", [url(db), "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f, db) => execFileSync("psql", [url(db), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, DB);
  // Comme Supabase : rôles anon / authenticated, auth.uid() lit le jeton (request.jwt.claim.sub), et tous les droits de table
  // donnés par défaut aux rôles du site (alter default privileges de tools/serveur/restaurer.sh) : seules les règles RLS protègent.
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
     create schema auth; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
     alter default privileges in schema public grant all on tables to anon, authenticated;
     alter default privileges in schema public grant all on functions to anon, authenticated;
     create table public.ladder (user_id uuid primary key references auth.users(id) on delete cascade, flagged boolean default false, flag_reason text);`);
  file(path.join(ROOT, "supabase", "schema.sql"), DB);
  // Base déjà en ligne : les trois anciennes règles d'écriture existent ; schema.sql relancé tel quel doit les retirer.
  q(`create policy "créer sa partie" on public.saves for insert to authenticated with check (user_id = auth.uid());
     create policy "modifier sa partie" on public.saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
     create policy "effacer sa partie" on public.saves for delete to authenticated using (user_id = auth.uid());
     grant all on public.saves to anon, authenticated;`);
  file(path.join(ROOT, "supabase", "schema.sql"), DB); file(path.join(ROOT, "supabase", "schema.sql"), DB); // relancé : sans danger
  assert.strictEqual(q(`select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'saves'`), "lire sa partie:SELECT", "seule la règle de lecture reste");
  assert.strictEqual(q(`select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'saves' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')`), "", "droits d'écriture retirés");
  assert.strictEqual(q(`select prosecdef from pg_proc where proname = 'push_save'`), "t", "push_save en security definer");
  assert.ok(/search_path=public/.test(q(`select array_to_string(proconfig, ',') from pg_proc where proname = 'push_save'`)), "push_save garde search_path = public");

  const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";
  q(`insert into auth.users values ('${A}'), ('${B}'), ('${C}'); insert into profiles (id, pseudo) values ('${A}', 'Alpha'), ('${B}', 'Beta'), ('${C}', 'Gamma');`);
  const as = (u, sql) => q(`set role authenticated; set request.jwt.claim.sub = '${u}'; ${sql}`);
  const refus = (u, sql, re, msg) => { let err = null; try { as(u, sql); } catch (e) { err = String(e.stderr || e.message); } assert.ok(err && re.test(err), msg + " : " + (err || "accepté")); };
  const push = (u, data, exp, force) => as(u, `select coalesce(push_save('${data}', '{"m":1}'::jsonb, '2.1.34', 'pc', ${exp ? `'${exp}'` : "null"}, ${force ? "true" : "false"}), 'NULL')`);
  const row = (u) => q(`select coalesce((select data || '|' || meta::text from saves where user_id = '${u}'), '-')`);
  const DENIED = /permission denied/;

  // 1. Écritures directes refusées (client Supabase from("saves").insert / upsert / update / delete)
  refus(A, `insert into saves (user_id, data) values ('${A}', 'triche')`, DENIED, "insert direct refusé");
  refus(A, `insert into saves (user_id, data) values ('${A}', 'triche') on conflict (user_id) do update set data = excluded.data`, DENIED, "upsert direct refusé");
  assert.strictEqual(row(A), "-", "rien d'écrit");
  // 2. Premier envoi par push_save, puis envoi avec la bonne date, conflit avec une date fausse, envoi forcé
  const t1 = push(A, "v1"); assert.ok(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(t1), "premier envoi : date renvoyée " + t1); assert.strictEqual(row(A), 'v1|{"m": 1}');
  assert.strictEqual(push(A, "v1bis"), "NULL", "second « premier envoi » : rien n'écrase la partie en ligne"); assert.strictEqual(row(A), 'v1|{"m": 1}');
  const info = JSON.parse(as(A, `select row_to_json(x) from save_info() x`)); assert.strictEqual(info.updated_at, t1, "save_info renvoie la date de push_save"); assert.strictEqual(info.device, "pc"); assert.strictEqual(info.game_version, "2.1.34");
  const t2 = push(A, "v2", t1); assert.ok(t2 !== "NULL" && t2 !== t1, "envoi avec p_expected correct"); assert.strictEqual(row(A).split("|")[0], "v2");
  assert.strictEqual(push(A, "v3", t1), "NULL", "p_expected périmé : conflit, rien d'écrit"); assert.strictEqual(row(A).split("|")[0], "v2");
  const t4 = push(A, "v4", t1, true); assert.ok(t4 !== "NULL", "p_force écrit malgré la date"); assert.strictEqual(row(A).split("|")[0], "v4");
  // 3. Update / delete directs refusés sur sa propre ligne (ils contournaient p_expected, la suspension et la remise)
  refus(A, `update saves set data = 'triche' where user_id = '${A}'`, DENIED, "update direct refusé");
  refus(A, `delete from saves where user_id = '${A}'`, DENIED, "delete direct refusé");
  assert.strictEqual(row(A).split("|")[0], "v4", "partie intacte");
  // 4. Lecture : sa partie oui, celle des autres non ; jamais d'écriture sur la partie d'un autre
  assert.strictEqual(as(A, `select data from saves where user_id = '${A}'`), "v4");
  push(B, "b1");
  assert.strictEqual(as(A, `select count(*) from saves where user_id = '${B}'`), "0", "la partie de B est invisible pour A");
  assert.strictEqual(as(A, `select count(*) from saves`), "1", "A ne voit que sa ligne");
  refus(A, `update saves set data = 'pirate' where user_id = '${B}'`, DENIED, "update de la partie d'un autre refusé");
  refus(A, `delete from saves where user_id = '${B}'`, DENIED, "delete de la partie d'un autre refusé");
  refus(A, `insert into saves (user_id, data) values ('${C}', 'pirate')`, DENIED, "insert pour un autre compte refusé");
  push(A, "v5", null, true); assert.strictEqual(row(B).split("|")[0], "b1", "push_save n'écrit que la partie de l'appelant"); assert.strictEqual(row(C), "-");
  // 5. Non connecté (anon, ou authenticated sans jeton) : refusé
  refus(A, `reset request.jwt.claim.sub; select push_save('x', null, null, null, null, true)`, /non connecté/, "sans jeton refusé");
  { let err = null; try { q(`set role anon; set request.jwt.claim.sub = '${A}'; select push_save('x', null, null, null, null, true)`); } catch (e) { err = String(e.stderr); } assert.ok(err && DENIED.test(err), "anon ne peut pas appeler push_save"); }
  { let err = null; try { q(`set role anon; insert into saves (user_id, data) values ('${A}', 'x')`); } catch (e) { err = String(e.stderr); } assert.ok(err && DENIED.test(err), "anon : insert refusé"); }
  // 6. Compte suspendu : push_save refuse (avant : un update direct passait quand même)
  q(`update profiles set suspended_at = now() where id = '${B}'`);
  const tb = JSON.parse(as(B, `select row_to_json(x) from save_info() x`)).updated_at;
  refus(B, `select push_save('b2', null, null, null, '${tb}', false)`, /compte suspendu/, "compte suspendu : envoi normal refusé");
  refus(B, `select push_save('b2', null, null, null, null, true)`, /compte suspendu/, "compte suspendu : envoi forcé refusé");
  refus(B, `update saves set data = 'b2' where user_id = '${B}'`, DENIED, "compte suspendu : update direct refusé");
  assert.strictEqual(row(B).split("|")[0], "b1");
  q(`update profiles set suspended_until = now() - interval '1 minute' where id = '${B}'`);
  assert.ok(push(B, "b3", tb) !== "NULL", "suspension finie : l'envoi repart"); assert.strictEqual(row(B).split("|")[0], "b3");
  // 7. Remise imposée (adm_save_restore pose meta.remise) : p_force est ignoré ; un envoi normal à jour efface la marque
  q(`update saves set data = 'copie', meta = meta || jsonb_build_object('remise', '2026-10-21T10:00:00'), updated_at = clock_timestamp() where user_id = '${A}'`);
  const tr = JSON.parse(as(A, `select row_to_json(x) from save_info() x`)).updated_at;
  assert.strictEqual(push(A, "garde_mon_appareil", null, true), "NULL", "remise : p_force sans date ignoré (premier envoi refusé)");
  assert.strictEqual(push(A, "garde_mon_appareil", t4, true), "NULL", "remise : p_force avec une vieille date ignoré");
  refus(A, `update saves set data = 'garde_mon_appareil' where user_id = '${A}'`, DENIED, "remise : update direct refusé");
  refus(A, `delete from saves where user_id = '${A}'`, DENIED, "remise : delete direct refusé");
  assert.strictEqual(row(A).split("|")[0], "copie", "la copie remise reste en ligne");
  assert.ok(push(A, "reprise", tr) !== "NULL", "envoi normal depuis la version remise"); assert.strictEqual(row(A), 'reprise|{"m": 1}', "marque de remise effacée");
  assert.ok(push(A, "force_ok", null, true) !== "NULL", "sans marque, p_force refonctionne");
  // 8. Supprimer son compte efface toujours sa partie (cascade depuis auth.users, delete_my_account en security definer)
  as(C, `select push_save('c1', null, null, null, null, false)`); assert.strictEqual(row(C).split("|")[0], "c1");
  as(C, `select delete_my_account()`); assert.strictEqual(row(C), "-", "partie effacée avec le compte"); assert.strictEqual(q(`select count(*) from auth.users where id = '${C}'`), "0");
  assert.strictEqual(row(A).split("|")[0], "force_ok"); assert.strictEqual(row(B).split("|")[0], "b3");
  console.log("ok - schema.sql : écritures directes sur saves refusées (insert, upsert, update, delete, autre compte, anon), push_save (premier envoi, p_expected, conflit, p_force), suspension, remise imposée, lecture limitée à sa partie, save_info, suppression du compte");
} finally { psql(`drop database if exists ${DB}`); }
