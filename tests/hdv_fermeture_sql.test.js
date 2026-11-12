/* supabase/hdv_fermeture.sql dans un vrai Postgres jetable (jamais la base en ligne) : Idlus 3.0 (2B de Mathis, 12/11/2026),
   l'Hôtel de vente ferme : annonces ouvertes rendues à leurs vendeurs, kamas des offres d'achat rendus, plus rien ne se vend
   ni ne s'achète ensuite ; les annonces déjà vendues ne bougent pas ; relancer ne rend rien deux fois.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/hdv_fermeture_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_hdvf_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test SQL de la fermeture de l'HdV sauté)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."); const DB = "idlus_hdvf_test";
const url = (db) => URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? url(db) : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f, db) => execFileSync("psql", [url(db), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, DB);
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create publication supabase_realtime; create schema auth; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;`);
  for (const f of ["schema", "classements", "chat", "hdv", "hdv"]) file(path.join(ROOT, "supabase", f + ".sql"), DB);
  const A = "00000000-0000-0000-0000-000000000001", B = "00000000-0000-0000-0000-000000000002";
  q(`insert into auth.users values ('${A}'), ('${B}'); insert into profiles (id, pseudo) values ('${A}', 'Vendeur'), ('${B}', 'Acheteur');
     insert into saves_ok (user_id, data) values ('${A}', '{"kamas": 1000000}'), ('${B}', '{"kamas": 1000000}');
     insert into hdv_listings (seller, cat, key, name, qty, price, item) values
       ('${A}', 'res', 'Plume de Piou', 'Plume de Piou', 100, 5000, null),
       ('${A}', 'eq', 'i1', 'Coiffe du Bouftou', 1, 20000, '{"uid": 7, "tpl": "i1"}');
     insert into hdv_listings (seller, cat, key, name, qty, price, status, buyer) values ('${A}', 'res', 'Bois', 'Bois', 10, 100, 'sold', '${B}');
     insert into hdv_orders (buyer, cat, key, name, qty, filled, price, held, expires_at) values ('${B}', 'res', 'Bois', 'Bois', 100, 40, 10, 1020, now() + interval '7 days');`);
  // avant : on peut encore vendre (la fonction ne répond pas « fermé »)
  const as = (u, sql) => psql(`set t.uid = '${u}'; ${sql}`, DB).split("\n").pop();
  assert.ok(!/fermé/.test(as(A, `select hdv_reprice(0, (select min(id) from hdv_listings), 6000)`)), "avant la fermeture : l'HdV marche");
  const run = () => file(path.join(ROOT, "supabase", "hdv_fermeture.sql"), DB);
  run();
  assert.strictEqual(q(`select count(*) from hdv_listings where status = 'open'`), "0", "plus aucune annonce ouverte");
  assert.strictEqual(q(`select count(*) from hdv_listings where status = 'sold'`), "1", "les ventes faites ne bougent pas");
  const opsA = JSON.parse(q(`select coalesce(jsonb_agg(payload order by id), '[]') from hdv_ops where user_id = '${A}'`));
  assert.ok(opsA.some((p) => p.res && p.res["Plume de Piou"] === 100), "lot de ressources rendu : " + JSON.stringify(opsA));
  assert.ok(opsA.some((p) => p.add && p.add[0].uid === 7), "équipement exact rendu");
  const opsB = JSON.parse(q(`select coalesce(jsonb_agg(payload order by id), '[]') from hdv_ops where user_id = '${B}'`));
  const back = 1020 - 40 * 10 - Math.ceil(400 * 0.02);
  assert.ok(opsB.some((p) => p.k > 0 && p.k <= 1020 - 400), "kamas de l'offre d'achat rendus : " + JSON.stringify(opsB) + " (≈" + back + ")");
  assert.strictEqual(q(`select count(*) from hdv_orders where status = 'open'`), "0");
  for (const sql of [`hdv_buy(0, 1)`, `hdv_reprice(0, 1, 5)`, `hdv_order_fill(0, 1, 1)`]) assert.ok(/fermé avec Idlus 3.0/.test(as(B, `select ${sql}`)), sql + " refusé");
  const n0 = q(`select count(*) from hdv_ops`); run(); assert.strictEqual(q(`select count(*) from hdv_ops`), n0, "relancer ne rend rien deux fois");
  console.log("ok - hdv_fermeture_sql : annonces et kamas des offres rendus, HdV fermé, relançable");
} finally { psql(`drop database if exists ${DB}`); }
