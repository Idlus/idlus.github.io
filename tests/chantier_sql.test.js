/* supabase/chantier.sql dans un vrai Postgres jetable (jamais la base en ligne) : objectif calé sur les kamas des parties
   actives (5 fois la médiane), don vérifié par le serveur (kamas de la partie en ligne + opérations), part de 40 % au plus,
   ×2 de 48 h à l'objectif, une seule fois par semaine, objectif changé par Mathis seulement.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/chantier_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_chantier_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test SQL du Chantier sauté)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."); const DB = "idlus_chantier_test";
const url = (db) => URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? url(db) : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f, db) => execFileSync("psql", [url(db), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, DB);
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create publication supabase_realtime; create schema auth; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;`);
  for (const f of ["schema", "classements", "chat", "hdv", "chantier", "chantier"]) file(path.join(ROOT, "supabase", f + ".sql"), DB); // relancé deux fois : sans danger
  const U = (i) => `00000000-0000-0000-0000-00000000000${i}`;
  q(`insert into auth.users select ('00000000-0000-0000-0000-00000000000' || i)::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'J' || substr(id::text, 36) || 'xx' from auth.users;`);
  // parties validées : 8 joueurs à 1 M, un très riche à 1 milliard (compté au 5 fois la médiane)
  for (let i = 1; i <= 9; i++) q(`insert into saves_ok (user_id, data, bilan) values ('${U(i)}', '${JSON.stringify({ kamas: i === 9 ? 1e9 : 1e6 })}', '{"k": ${i === 9 ? 1e9 : 1e6}}')`);
  const as = (i, sql) => psql(`set t.uid = '${i ? U(i) : ""}'; ${sql}`, DB).split("\n").pop();
  const st = (i) => JSON.parse(as(i, `select chantier_state()`));
  const s0 = st(1); const goal = s0.goal;
  assert.ok(goal >= 1000000 && goal < 5000000, `objectif calé sans l'effet du compte très riche (${goal})`);
  assert.strictEqual(s0.total, 0); assert.strictEqual(s0.bonus, null);
  const give = (i, k) => JSON.parse(as(i, `select chantier_give(${k})`));
  assert.ok(give(0, 5000).err, "invité refusé");
  assert.ok(give(1, 10).err, "moins de 1 000 refusé");
  const r1 = give(1, 999999999); assert.ok(!r1.err, r1.err); assert.strictEqual(r1.given, Math.floor(goal * 0.4), "part plafonnée à 40 %");
  assert.strictEqual(r1.ops.length, 1); assert.strictEqual(r1.ops[0].p.k, -r1.given, "opération de kamas négative");
  assert.ok(give(1, 5000).err, "part de la semaine déjà versée");
  // kamas vérifiés avec les opérations pas encore dans la partie : le joueur 2 n'a que 1 M
  q(`update saves_ok set bilan = '{"k": 1000}', data = '{"kamas": 1000}' where user_id = '${U(2)}'`);
  assert.ok(/Pas assez/.test(give(2, 5000).err), "pas assez de kamas");
  q(`insert into ladder (user_id, flagged) values ('${U(3)}', true) on conflict (user_id) do update set flagged = true`);
  assert.ok(/vérification/.test(give(3, 5000).err), "partie en vérification refusée");
  const r4 = give(4, Math.floor(goal * 0.4)); assert.ok(!r4.err, r4.err);
  assert.strictEqual(st(4).bonus, null, "pas encore fini");
  const r5 = give(5, 999999999); assert.ok(!r5.err, r5.err); assert.strictEqual(r5.given, goal - r1.given - r4.given, "le dernier don s'arrête à l'objectif");
  const s1 = st(5); assert.ok(s1.done && s1.bonus, "Chantier fini, ×2 en cours"); assert.strictEqual(s1.total, goal);
  const h = (Date.parse(s1.bonus) - Date.parse(s1.now)) / 3600000; assert.ok(h > 47.9 && h <= 48, "48 h");
  assert.ok(/déjà fini/.test(give(6, 5000).err), "un seul Chantier par semaine");
  assert.strictEqual(s1.top.length, 3); assert.strictEqual(s1.top[0].k, r1.given);
  assert.strictEqual(+q(`select count(*) from chat_msgs where data->>'chantier' is not null`), 1, "une annonce dans le chat");
  // objectif : Mathis seul
  assert.throws(() => as(6, `select adm_chantier_goal(5000000)`), "un joueur ne change pas l'objectif");
  // nouvelle semaine : nouveau Chantier, le ×2 de la semaine d'avant continue
  q(`delete from chantier_dons; update chantier set wk = '2000-01'`);
  const s2 = st(6); assert.strictEqual(s2.total, 0); assert.ok(s2.bonus, "le ×2 continue la semaine suivante"); assert.ok(!s2.done);
  // pas de lecture directe des tables
  assert.throws(() => psql(`set role anon; select * from chantier`, DB));
  console.log("ok - chantier.sql : objectif calé (5 fois la médiane), dons vérifiés, part de 40 %, ×2 de 48 h, un par semaine, objectif réservé à Mathis");
} finally { psql(`drop database if exists ${DB}`); }
