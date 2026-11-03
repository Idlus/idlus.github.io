/* Saison 1 : supabase/classements_s1.sql dans un vrai Postgres jetable (jamais la base en ligne) : classement de la semaine
   de la Chevauchée et de la manche des Expéditions, tirés du résumé de la partie validée (meta.s1lb, calculé par le serveur),
   comptes retirés absents, rien d'écrivable par le jeu ; résumé du jeu (js/verify.js) au bon format ; copie dans s1.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/classements_s1_sql.test.js */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const E = require("../js/engine.js"); require("../js/systems.js"); require("../js/quetes.js"); require("../js/saisonc.js");
const V = require("../js/verify.js");
// le résumé du jeu
{ const S = E.newState("Héros", "iop"); E.s1cStart(S, E.now());
  S.s1c.chev = { w: 2, tries: [1], best: { n: 3, k: 6, turns: 41 }, got: {} }; S.s1c.exps = { m: 1, best: { 0: { score: 1200 }, 1: { score: 800 } }, tries: {}, got: {} };
  assert.deepStrictEqual(V.fullSummary(E, S).s1lb, { w: 2, n: 3, k: 6, t: 41, m: 1, x: 2000 });
  const T = E.newState("Éternel", "iop"); assert.strictEqual(V.fullSummary(E, T).s1lb, undefined, "rien hors saison"); }
console.log("ok - résumé : Chevauchée de la semaine et total des Expéditions de la manche");
const all = fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8");
assert(all.includes("create or replace function s1.lb_chev") && all.includes("on s1.saves_ok"), "copie dans s1 (node tools/saison_schema.js)");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - classements de saison : copie s1 (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_lbs1_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); assert(re.test(String(e0.stderr || e0.message)), why); };
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$`);
  q(`create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql"]) file(path.join(ROOT, "supabase", f));
  file(path.join(ROOT, "supabase", "classements_s1.sql")); file(path.join(ROOT, "supabase", "classements_s1.sql")); // relancé : sans danger
  for (let i = 1; i <= 4; i++) { q(`insert into auth.users values ('${U(i)}')`); q(`insert into profiles (id, pseudo) values ('${U(i)}', 'Joueur${i}')`); }
  const put = (i, x) => q(`insert into saves_ok (user_id, data, meta) values ('${U(i)}', '{}', '{"s1lb": ${JSON.stringify(x)}}'::jsonb)
    on conflict (user_id) do update set meta = excluded.meta, at = now()`);
  put(1, { w: 2, n: 3, k: 6, t: 41, m: 1, x: 2000 }); put(2, { w: 2, n: 4, k: 2, t: 90, m: 1, x: 900 }); put(3, { w: 2, n: 3, k: 6, t: 30, m: 1, x: 5000 }); put(4, { w: 1, n: 4, k: 9, t: 20, m: 1, x: 99999 });
  const chev = JSON.parse(as(1, `select coalesce(json_agg(x), '[]') from lb_chev(2) x`));
  assert.deepStrictEqual(chev.map((r) => r.pseudo), ["Joueur2", "Joueur3", "Joueur1"], "Cavaliers, puis stasis, puis moins de tours ; la semaine d'avant n'y est pas");
  q(`update ladder set flagged = true where user_id = '${U(4)}'`);
  q(`insert into ladder (user_id, flagged) values ('${U(4)}', true) on conflict (user_id) do update set flagged = true`);
  const ex = JSON.parse(as(1, `select coalesce(json_agg(x), '[]') from lb_exps1(1) x`));
  assert.deepStrictEqual(ex.map((r) => r.pseudo + ":" + r.score), ["Joueur3:5000", "Joueur1:2000", "Joueur2:900"], "manche, compte retiré absent");
  fails(() => as(1, `insert into lb_s1 (user_id) values ('${U(1)}')`), /permission denied/, "le jeu n'écrit pas dans la table");
  fails(() => as(1, `select * from lb_s1`), /permission denied/, "le jeu ne lit pas la table brute");
  put(1, { w: 3, n: 1, k: 1, t: 10, m: 2, x: 10 }); assert.strictEqual(JSON.parse(as(1, `select coalesce(json_agg(x), '[]') from lb_chev(2) x`)).length, 2, "nouvelle semaine : l'ancien essai sort");
  console.log("ok - classements de saison : ordre, semaine et manche, comptes retirés absents, table fermée au jeu");
} finally { psql(`drop database if exists ${DB}`); }
