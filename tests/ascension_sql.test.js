/* supabase/ascension.sql dans un vrai Postgres jetable (jamais la base en ligne) : Idlus 3.0 (1B de Mathis, 12/11/2026),
   le classement « breche » (meilleur étage de la Brèche de la semaine, dès l'étage 1) rempli par la partie validée,
   et la contrainte de catégorie mise à jour sur une table qui existait déjà.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/ascension_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_asc_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test SQL de la Brèche sauté)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."); const DB = "idlus_asc_test";
const url = (db) => URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? url(db) : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f, db) => execFileSync("psql", [url(db), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, DB);
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create publication supabase_realtime; create schema auth; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;`);
  for (const f of ["schema", "classements", "chat", "hdv", "guildes"]) file(path.join(ROOT, "supabase", f + ".sql"), DB);
  // une table d'avant la 3.0 (contrainte sans « breche »), puis le fichier relancé deux fois
  q(`create table public.asc_scores (user_id uuid not null references auth.users (id) on delete cascade, m int not null,
       cat text not null check (cat in ('rapidite', 'classe', 'sursis', 'puriste', 'audela')), k text not null default '', score int not null,
       at timestamptz not null default now(), primary key (user_id, m, cat, k))`);
  file(path.join(ROOT, "supabase", "ascension.sql"), DB); file(path.join(ROOT, "supabase", "ascension.sql"), DB);
  const U = "00000000-0000-0000-0000-000000000001";
  q(`insert into auth.users values ('${U}'); insert into profiles (id, pseudo) values ('${U}', 'Grimpeur')`);
  const wk = +q(`select asc_week()`);
  const save = (x) => q(`insert into saves_ok (user_id, data, meta) values ('${U}', '{}', '{"asc": {"m": -1, "w": ${wk}, "x": ${x}}}')
    on conflict (user_id) do update set meta = excluded.meta`);
  save(42);
  assert.strictEqual(q(`select score from asc_scores where cat = 'breche' and m = ${wk}`), "42", "étage 42 de la Brèche classé (avant : seulement au-delà de 100)");
  save(30); assert.strictEqual(q(`select score from asc_scores where cat = 'breche' and m = ${wk}`), "42", "un score plus bas ne remplace pas le record");
  save(130); assert.strictEqual(q(`select score from asc_scores where cat = 'breche' and m = ${wk}`), "130");
  assert.strictEqual(q(`select count(*) from asc_scores where cat = 'audela'`), "0", "plus de score « audela »");
  assert.strictEqual(q(`select r from lb_asc where cat = 'breche'`), "1", "classement lisible");
  console.log("ok - ascension_sql : classement de la Brèche (dès l'étage 1, record de la semaine, contrainte mise à jour)");
} finally { psql(`drop database if exists ${DB}`); }
