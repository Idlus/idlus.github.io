/* 2.2.11 « Bourse aux cartes » au Monocompte (supabase/monocompte.sql) : cartes à l'HdV de saison et en échange direct, doubles
   seulement, après 7 boosters ouverts, rien depuis l'Éternel. Postgres jetable, jamais la base en ligne.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/cartes_bourse_mono_sql.test.js */
"use strict";
const path = require("path"), assert = require("assert");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : bourse aux cartes du Monocompte sautée)"); process.exit(0); }
const DB = "idlus_cartes_mono";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64e6 }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const J = (i, s) => JSON.parse(q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; select (${s})::text`) || "null");
run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role;
     create table public.ladder (user_id uuid primary key references auth.users(id) on delete cascade, flagged boolean default false, flag_reason text, main text, main_lvl int);
     create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade); alter table public.admins enable row level security;
     create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;`);
  file(path.join(ROOT, "supabase", "schema.sql"));
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  file(path.join(ROOT, "supabase", "monocompte.sql")); file(path.join(ROOT, "supabase", "monocompte.sql")); // relançable
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users; insert into admins values ('${U(9)}');`);
  J(9, `mono_adm_saison(0, 'Saison de test', '2026-10-19 00:00 Europe/Paris', true, 'ouverte')`);
  for (const i of [1, 2]) J(9, `mono_adm_testeur('Joueur0${i}', true)`);
  const save = (o, b, nb, et) => JSON.stringify({ kamas: 100000, res: {}, items: {}, chars: [], hdv: { op: 0 }, mono: Object.assign({ s: 1, cards: { o, b: b || {}, nb, pd: 0, v: 2 } }, et ? { eternel: true } : {}) });
  q(`insert into mono.parties_ok (user_id, saison, data) values ('${U(1)}', 0, '${save({ tour_solar: 3 }, { tour_solar: 2 }, 9)}'), ('${U(2)}', 0, '${save({ grange_tournesol: 2 }, {}, 2)}')`);
  const list = (i, k, n) => J(i, `mono_hdv_list(0, 'card', '${k}', null, 1, ${n}, 5000, 'Solar', 200, 'l', null)`);
  assert(/dernier exemplaire/.test(list(1, "tour_solar", 3).err), "2A : doubles seulement");
  assert.strictEqual(list(1, "tour_solar", 2).ok, true, "2 doubles mis en vente");
  assert(/7 boosters/.test(list(2, "grange_tournesol", 1).err), "4A : 7 boosters ouverts");
  const id = q(`select id from mono.hdv where key = 'tour_solar' and status = 'open' order by id limit 1`);
  assert.strictEqual(J(2, `mono_hdv_buy(0, ${id}, null)`).ok, true, "achat");
  const last = (i) => JSON.parse(q(`select payload::text from mono.ops where user_id = '${U(i)}' order by id desc limit 1`));
  assert.deepStrictEqual(last(2).cards, { tour_solar: 1 }, "l'acheteur reçoit la carte");
  assert(J(2, `mono_hdv_market('card', '', '', null, null)`).some((x) => x.key === "tour_solar"), "catégorie « Cartes » de l'HdV de saison");
  // échange direct : une brillante en double contre des kamas
  const t = J(1, `mono_trade_start('Joueur02', null)`); assert(t.ok, JSON.stringify(t));
  J(1, `mono_trade_offer(${t.id}, '{"cards": {"tour_solar*": 1}}'::jsonb)`); J(2, `mono_trade_offer(${t.id}, '{"k": 7000}'::jsonb)`);
  const v = J(1, `mono_trade_state()`).ver; J(1, `mono_trade_ok(${t.id}, ${v}, 0)`); const r = J(2, `mono_trade_ok(${t.id}, ${v}, 0)`);
  assert(r.done, "échange fait : " + JSON.stringify(r));
  assert.deepStrictEqual([last(1).cards, last(2).cards], [{ "tour_solar*": -1 }, { "tour_solar*": 1 }], "la brillante change de main");
  // partie de l'Éternel : pas de cartes à vendre
  q(`update mono.parties_ok set data = '${save({ tour_solar: 5 }, {}, 9, true)}' where user_id = '${U(1)}'`);
  assert(/partie de saison/.test(list(1, "tour_solar", 1).err), "Éternel : refusé");
  console.log("ok - bourse aux cartes (Monocompte) : doubles seulement, 7 boosters, vente, achat, échange direct, rien depuis l'Éternel");
} finally { run(`drop database if exists ${DB}`, URL0); }
