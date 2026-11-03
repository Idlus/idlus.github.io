/* Boss des mondes de l'Éternel, 2.1.43.4 « Ougah débloqué » : supabase/wboss.sql dans un vrai Postgres jetable (jamais la base en ligne).
   Ougah (n° 14) gonflé par les essais bogués sur Harebourg : ses PV restants passent à ~3 jours de dégâts (une seule fois), un essai
   compte au plus 6 000 points, et le boss suivant reçoit des PV d'après les dégâts des 3 derniers jours.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/wboss_ougah_sql.test.js */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."); const DB = "idlus_wb_ougah_test";
const url = (db) => db ? URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1") : URL0;
const psql = (sql, db) => execFileSync("psql", [url(db), "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f, db) => execFileSync("psql", [url(db), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, DB);
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
     if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; create table auth.users (id uuid primary key); create publication supabase_realtime;
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  const before = ["schema", "classements", "chat", "hdv_data", "hdv", "guildes", "percos_data", "gboss"];
  for (const f of before) file(path.join(ROOT, "supabase", f + ".sql"), DB);
  // la base en ligne : Ougah (n° 14) en vie depuis 11 jours, 1 034 366 points de PV, 98 471 de dégâts
  file(path.join(ROOT, "supabase", "wboss.sql"), DB);
  q(`delete from wb_resets where id = '2.1.43.4'; update wb_state set n = 14, hp = 1034366, dmg = 98471, started = now() - interval '11 days' where id = 1;`);
  file(path.join(ROOT, "supabase", "wboss.sql"), DB);
  assert.strictEqual(q(`select hp || '/' || dmg from wb_state`), "125471/98471", "PV restants = 27 000 points");
  file(path.join(ROOT, "supabase", "wboss.sql"), DB); // relancé : une seule fois
  assert.strictEqual(q(`select hp from wb_state`), "125471");
  assert.strictEqual(q(`select count(*) from wb_resets where id = '2.1.43.4'`), "1");
  console.log("ok - Ougah : PV restants ramenés à 27 000 points, une seule fois");

  const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
  q(`insert into auth.users values ('${A}'), ('${B}'); insert into profiles (id, pseudo) values ('${A}', 'Alpha'), ('${B}', 'Beta');`);
  const done = (u, k, p) => JSON.parse(q(`select wb_done('${u}', 14, ${k}, ${p}, 3, 200, 15, 8)::text`));
  const r1 = done(A, 0, 45000); assert.ok(r1.ok, JSON.stringify(r1)); assert.strictEqual(r1.points, 6000, "essai plafonné à 6 000");
  assert.strictEqual(q(`select dmg from wb_state`), String(98471 + 6000));
  assert.strictEqual(q(`select points from wb_hits where user_id = '${A}'`), "6000");
  console.log("ok - un essai compte au plus 6 000 points");
  // il tombe : les dégâts des 3 derniers jours donnent les PV du suivant (≈ 1 jour de dégâts)
  q(`insert into wb_hits (n, user_id, k, day, points, grade, phase, lvl, rounds, alive, at) values (14, '${B}', 9, gb_day() - 2, 3000, 'SSS', 3, 200, 15, 8, now() - interval '2 days')`);
  q(`update wb_state set dmg = hp - 500 where id = 1`);
  const r2 = done(B, 1, 800); assert.ok(r2.killed, JSON.stringify(r2));
  const nx = q(`select n || '/' || hp || '/' || dmg from wb_state`);
  assert.strictEqual(nx, `15/${Math.max(1800, Math.round((6000 + 3000 + 800) / 3))}/0`, nx);
  console.log("ok - Ougah tombe, le suivant reçoit ~1 jour de dégâts : " + nx);
} finally { psql(`drop database if exists ${DB}`); }
