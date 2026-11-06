/* 2.2.11 « Bourse aux cartes » (Mathis 1A 2A 3B 4A 5A), côté serveur de la saison (s1, fabriqué depuis supabase/hdv.sql) :
   cartes à l'HdV et en échange direct, doubles seulement (le dernier exemplaire reste), après 7 boosters ouverts, rien depuis
   l'Éternel ; la carte vendue part de la partie, l'acheteur la reçoit, l'annonce retirée revient. Postgres jetable, jamais la base en ligne.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/cartes_bourse_sql.test.js */
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : test de la bourse aux cartes sauté)"); process.exit(0); }
const DB = "idlus_cartes";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const q = (s, u) => execFileSync("psql", [u || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64e6 }).trim();
q(`drop database if exists ${DB}`, URL0); q(`create database ${DB}`, URL0);
try {
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
     create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
     set client_min_messages = error; create publication supabase_realtime;
     grant usage on schema public to anon, authenticated, service_role;
     alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
     alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
     alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;`);
  const files = (/tous="([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8")) || [])[1].split(/\s+/);
  for (let pass = 0; pass < 2; pass++) for (const f of files) { try { q("set client_min_messages = error;\n" + fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { if (pass) throw new Error(f + " : " + e.stderr); } }
  q("set client_min_messages = error;\n" + fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8"));
  const A = "00000000-0000-0000-0000-0000000000a1", B = "00000000-0000-0000-0000-0000000000b2";
  const save = (o, b, nb, k) => JSON.stringify({ kamas: k == null ? 100000 : k, res: {}, items: {}, chars: [], hdv: { op: 0 }, s1c: { cards: { o, b: b || {}, nb, pd: 0, v: 2, r: {}, rb: {} } } }).replace(/'/g, "''");
  q(`insert into auth.users (id) values ('${A}'), ('${B}'); insert into public.profiles (id, pseudo) values ('${A}', 'Likie'), ('${B}', 'Panda');
     insert into s1.saves_ok (user_id, data) values ('${A}', '${save({ tour_solar: 3, palais_nidas: 1 }, { tour_solar: 2 }, 9)}'), ('${B}', '${save({ grange_tournesol: 2 }, {}, 3)}');`);
  const as = (u, s) => JSON.parse(q(`set role authenticated; set request.jwt.claim.sub = '${u}'; select (${s})::text`));
  const list = (u, key, n, price) => as(u, `s1.hdv_list(0, 'card', '${key}', null, 1, ${n}, ${price}, 'Carte', 200, 'l')`);
  const ops = (u) => JSON.parse(q(`select coalesce(jsonb_agg(jsonb_build_object('p', payload) order by id), '[]')::text from s1.hdv_ops where user_id = '${u}'`));
  // 2A : doubles seulement
  assert(/dernier exemplaire/.test(list(A, "palais_nidas", 1, 500).err), "le dernier exemplaire ne se vend pas");
  assert(/dernier exemplaire/.test(list(A, "tour_solar", 3, 500).err), "3 exemplaires : 2 doubles");
  assert.strictEqual(list(A, "tour_solar", 2, 90000).ok, true, "2 doubles mis en vente");
  assert(/dernier exemplaire/.test(list(A, "tour_solar", 1, 90000).err), "plus de double (opérations comptées)");
  assert.strictEqual(list(A, "tour_solar*", 1, 900000).ok, true, "une brillante en double se vend");
  assert(/Carte inconnue/.test(list(A, "Bad-Key!", 1, 5).err), "clé refusée");
  // 4A : 7 boosters ouverts
  assert(/7 boosters/.test(list(B, "grange_tournesol", 1, 300).err), "compte à 3 boosters : refusé");
  const o1 = ops(A); assert.deepStrictEqual(o1.map((o) => o.p.cards), [{ tour_solar: -2 }, { "tour_solar*": -1 }], "les cartes quittent la partie");
  // achat : la carte arrive chez l'acheteur, les kamas chez le vendeur
  const row = q(`select id from s1.hdv_listings where key = 'tour_solar' and status = 'open' order by id limit 1`);
  const r = as(B, `s1.hdv_buy(0, ${row})`); assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(ops(B).slice(-1)[0].p, { cards: { tour_solar: 1 }, k: -90000 }, "l'acheteur reçoit la carte");
  assert.strictEqual(ops(A).slice(-1)[0].p.k, 90000, "le vendeur reçoit les kamas");
  const mk = as(B, `s1.hdv_market('card', '', '', null)`); assert(mk.some((x) => x.key === "tour_solar" && x.n === 1) && mk.some((x) => x.key === "tour_solar*"), "catégorie « Cartes » du marché");
  // retrait : la carte revient
  const row2 = q(`select id from s1.hdv_listings where key = 'tour_solar*' and status = 'open'`); assert.strictEqual(as(A, `s1.hdv_cancel(0, ${row2})`).ok, true);
  assert.deepStrictEqual(ops(A).slice(-1)[0].p, { cards: { "tour_solar*": 1 } }, "annonce retirée : la brillante revient");
  // échange direct : B (3 boosters) ne peut pas donner de carte ; A donne un double contre des kamas
  const t = as(A, `s1.trade_start('Panda')`); assert(t.ok, JSON.stringify(t));
  as(B, `s1.trade_offer(${t.id}, '{"cards": {"grange_tournesol": 1}}'::jsonb)`);
  as(A, `s1.trade_offer(${t.id}, '{"cards": {"palais_nidas": 1}}'::jsonb)`);
  let st = as(A, `s1.trade_state()`); as(A, `s1.trade_ok(${t.id}, ${st.ver}, 0)`); const e1 = as(B, `s1.trade_ok(${t.id}, ${st.ver}, 0)`);
  assert(e1.err && /dernier exemplaire|7 boosters/.test(e1.err), "échange refusé (dernier exemplaire, 7 boosters) : " + JSON.stringify(e1));
  as(B, `s1.trade_offer(${t.id}, '{"k": 5000}'::jsonb)`); as(A, `s1.trade_offer(${t.id}, '{"cards": {"tour_solar*": 1}}'::jsonb)`);
  st = as(A, `s1.trade_state()`); as(A, `s1.trade_ok(${t.id}, ${st.ver}, 0)`); const e2 = as(B, `s1.trade_ok(${t.id}, ${st.ver}, 0)`);
  assert(e2.done, "échange fait : " + JSON.stringify(e2));
  const pa = ops(A).slice(-1)[0].p, pb = ops(B).slice(-1)[0].p;
  assert.deepStrictEqual([pa.cards, pa.k, pb.cards, pb.k], [{ "tour_solar*": -1 }, 5000, { "tour_solar*": 1 }, -5000], "la brillante change de main contre 5 000 kamas");
  // l'Éternel (public) : pas de partie de saison, rien à vendre
  q(`insert into public.saves_ok (user_id, data) values ('${A}', '{"kamas": 1000, "hdv": {"op": 0}, "xcards": {"o": {"tour_solar": 5}}}')`);
  assert(/partie de saison/.test(as(A, `public.hdv_list(0, 'card', 'tour_solar', null, 1, 1, 5, 'Solar', 200, 'l')`).err), "Éternel : les cartes ne se vendent pas");
  console.log("ok - bourse aux cartes (s1) : doubles seulement, 7 boosters, vente, achat, retrait, échange direct, rien depuis l'Éternel");
} finally { q(`drop database if exists ${DB}`, URL0); }
