/* supabase/alignement2.sql dans un vrai Postgres jetable (jamais la base en ligne) : honneur plafonné (premier envoi, +600 de l'heure,
   changement de camp), anciens envois sans honneur ignorés, valeurs illisibles, points par région, état des régions gardé 3 minutes.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/alignement2_sql.test.js
   Sans IDLUS_PG (ou sans psql), le test est sauté. La base « idlus_align2_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."); const DB = "idlus_align2_test";
const psql = (sql, db) => execFileSync("psql", [db ? URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1") : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f, db) => execFileSync("psql", [URL0.replace(/\/postgres(\?|$)/, "/" + db + "$1"), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, DB);
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
     create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
     create table public.ladder (user_id uuid primary key references auth.users(id) on delete cascade, flagged boolean default false, flag_reason text, main text, main_lvl int);`);
  for (const f of ["schema", "alignement", "alignement2", "alignement2"]) file(path.join(ROOT, "supabase", f + ".sql"), DB); // relancé deux fois : sans danger
  q(`create function t_save(u uuid, a jsonb) returns void language sql as $$ insert into saves_ok (user_id, data, meta) values (u, 'x', jsonb_build_object('align', a)) on conflict (user_id) do update set meta = excluded.meta, at = now() $$;
     insert into auth.users select ('00000000-0000-0000-0000-00000000000' || i)::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'J' || substr(id::text, 36) || 'xx' from auth.users;`);
  const U = (i) => `'00000000-0000-0000-0000-00000000000${i}'`;
  const hon = (i) => q(`select coalesce((select hon || '/' || rank || '/' || side from align_hon where user_id = ${U(i)}), '-')`);
  const pts = (i) => +q(`select coalesce(sum(pts), 0) from align_reg_pts where user_id = ${U(i)}`);
  const save = (i, a) => q(`select t_save(${U(i)}, '${JSON.stringify(a)}'::jsonb || jsonb_build_object('w', align_wk()))`);
  // 1. premier envoi plafonné au rang 10, puis +100 et +600 de l'heure
  save(1, { s: "bonta", o: "coeur", l: 50, h: 40000, rg: { amakna: 300, cania: 200 } }); assert.strictEqual(hon(1), "6100/10/bonta");
  save(1, { s: "bonta", l: 50, h: 40000 }); assert.strictEqual(hon(1), "6200/10/bonta", "+100 tout de suite");
  q(`update align_hon set at = now() - interval '1 hour' where user_id = ${U(1)}`); save(1, { s: "bonta", l: 50, h: 40000 }); assert.strictEqual(hon(1), "6900/10/bonta", "+700 en une heure");
  // 2. changement de camp accepté : jamais plus que l'honneur tenu + 100 (avant le correctif : 40 000, rang 20)
  q(`update align_camp set pend_side = 'brakmar', pend_at = now() - interval '1 day' where user_id = ${U(1)}`);
  save(1, { s: "brakmar", l: 10, h: 40000 }); assert.strictEqual(hon(1), "7000/10/brakmar", "changement de camp plafonné");
  save(1, { s: "brakmar", l: 10, h: 650 }); assert.strictEqual(hon(1), "650/2/brakmar", "le jeu redescend au rang 2");
  // 3. ancien jeu v13 (ou serveur sans honneur.js) : pas de « h », rien n'est écrit ; l'envoi v14 suivant garde son honneur (rang 10)
  save(2, { s: "bonta", o: "oeil", l: 100, p: 0 }); assert.strictEqual(hon(2), "-", "envoi sans honneur ignoré");
  save(2, { s: "bonta", o: "oeil", l: 50, h: 6100, r: 10 }); assert.strictEqual(hon(2), "6100/10/bonta", "honneur converti gardé");
  save(2, { s: "bonta", o: "oeil", l: 100 }); assert.strictEqual(hon(2), "6100/10/bonta", "un vieil onglet ne remet pas l'honneur à 0");
  // 4. valeurs illisibles : honneur ignoré, les autres régions comptent
  save(3, { s: "brakmar", h: "abc", rg: { amakna: "x", cania: -5, frigost: 50, inconnue: 600 } }); assert.strictEqual(hon(3), "-"); assert.strictEqual(pts(3), 50, "frigost compté");
  save(4, { s: "bonta", h: 2000.7, rg: [1, 2] }); assert.strictEqual(hon(4), "-", "honneur décimal ignoré"); save(4, { s: "bonta", h: 2000 }); assert.strictEqual(hon(4), "2000/4/bonta");
  // 5. 600 points de guerre au plus par semaine (toutes régions)
  save(5, { s: "brakmar", h: 0, rg: { amakna: 600, cania: 600 } }); assert.strictEqual(pts(5), 600);
  // 6. état des régions gardé 3 minutes, recalculé si une région change de camp hors du calcul, ou à expiration
  const reg = () => JSON.parse(q(`select align_regions()`)); const r1 = reg(); assert.strictEqual(r1.regs.amakna.h, "bonta"); assert.strictEqual(r1.regs.amakna.b, 300);
  save(6, { s: "brakmar", h: 0, rg: { amakna: 600 } }); assert.strictEqual(reg().regs.amakna.k, 0, "gardé en cache");
  q(`update align_regions_cache set at = now() - interval '4 minutes'`); const r2 = reg(); assert.strictEqual(r2.regs.amakna.k, 600, "recalculé après 3 minutes");
  assert.strictEqual(r2.regs.amakna.h, "bonta", "70 % pas atteints : la région garde son camp");
  q(`update align_region set holder = 'brakmar' where region = 'astrub'`); assert.strictEqual(reg().regs.astrub.h, "brakmar", "changement à la main : cache effacé");
  assert.strictEqual(+q(`select count(*) from align_regions_cache`), 1);
  q(`update align_regions_cache set w = w - 1`); assert.strictEqual(reg().w, +q(`select align_wk()`), "nouvelle semaine : recalculé");
  console.log("ok - alignement2.sql : honneur plafonné (premier envoi, heure, changement de camp), anciens envois ignorés, valeurs illisibles, régions en cache 3 minutes");
} finally { psql(`drop database if exists ${DB}`); }
