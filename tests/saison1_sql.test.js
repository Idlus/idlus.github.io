/* Saison 1, lot 0b : espace de saison « s1 » (tools/saison_schema.js → supabase/saison1.sql + js/saison1_srv.js).
   - les deux fichiers fabriqués sont à jour (relancer node tools/saison_schema.js après un changement d'un fichier SQL déployé) ;
   - le compte reste partagé : profils, pseudos, chat et admins ne sont jamais recréés dans s1 ;
   - avec IDLUS_PG (Postgres jetable, jamais la base en ligne) : tous les fichiers déployés puis saison1.sql deux fois sans erreur,
     les tables du Classique ne bougent pas, s1 a les mêmes règles RLS et aucune fonction plus ouverte que sa jumelle de public.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/saison1_sql.test.js */
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const G = require(path.join(ROOT, "tools/saison_schema.js"));
const { sql, own } = G.build();
assert.strictEqual(fs.readFileSync(path.join(ROOT, "supabase/saison1.sql"), "utf8"), sql, "supabase/saison1.sql pas à jour : node tools/saison_schema.js");
const js = fs.readFileSync(path.join(ROOT, "js/saison1_srv.js"), "utf8");
assert(js.includes(JSON.stringify(own)), "js/saison1_srv.js pas à jour : node tools/saison_schema.js");
for (const n of ["profiles", "chat_msgs", "admins", "pseudo_of", "chat_send", "is_admin"]) assert(!own.includes(n), `${n} doit rester partagé`);
for (const n of ["saves", "push_save", "save_info", "ladder", "hdv_listings", "guilds"]) assert(own.includes(n), `${n} doit exister dans la saison`);
assert(!/\bpublic\.(saves|ladder|hdv_listings|push_save)\b/.test(sql), "un objet de saison vise encore public");
// le jeu (js/online.js) route seulement vers s1 la partie 5, et la fonction « record » suit (saison: 1)
const on = fs.readFileSync(path.join(ROOT, "js/online.js"), "utf8");
assert(/const S1_N = 5;/.test(on) && /sb\.schema\("s1"\)/.test(on) && !/\bsb\.(rpc|from)\(/.test(on), "js/online.js : appels hors du routage de saison");
const rec = fs.readFileSync(path.join(ROOT, "supabase/functions/record/index.ts"), "utf8");
assert(/body\.saison === 1 \? seasonDb\(db0\) : db0/.test(rec), "fonction record : espace de saison absent");
const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert(idx.indexOf("js/saison1_srv.js") > 0 && idx.indexOf("js/saison1_srv.js") < idx.indexOf("js/online.js"), "index.html : saison1_srv.js avant online.js");
console.log("ok - espace de saison s1 : fichiers à jour, compte partagé, routage du jeu et de la fonction record");

const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - (IDLUS_PG absent : chargement SQL sauté)"); process.exit(0); }
const DB = "idlus_saison1";
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
  const snap = () => q(`select string_agg(c.relname || ':' || c.relrowsecurity, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v')`);
  const before = snap();
  q("set client_min_messages = error;\n" + sql); q("set client_min_messages = error;\n" + sql); // relançable
  assert.strictEqual(snap(), before, "le Classique (public) a changé");
  const n = q(`select count(*) from pg_tables where schemaname = 's1'`); assert(+n > 50, "trop peu de tables dans s1 : " + n);
  const rls = q(`select string_agg(c.relname, ',') from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 's1' and c.relkind = 'r' and not c.relrowsecurity
    and exists (select 1 from pg_class d join pg_namespace m on m.oid = d.relnamespace where m.nspname = 'public' and d.relname = c.relname and d.relrowsecurity)`);
  assert.strictEqual(rls, "", "tables de saison sans RLS : " + rls);
  for (const role of ["anon", "authenticated"]) {
    const open = q(`select string_agg(distinct p.proname, ',') from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 's1' and has_function_privilege('${role}', p.oid, 'execute')
      and exists (select 1 from pg_proc x join pg_namespace m on m.oid = x.pronamespace where m.nspname = 'public' and x.proname = p.proname and pg_get_function_identity_arguments(x.oid) = pg_get_function_identity_arguments(p.oid) and not has_function_privilege('${role}', x.oid, 'execute'))`);
    assert.strictEqual(open, "", `fonctions de saison plus ouvertes que le Classique pour ${role} : ${open}`);
  }
  console.log(`ok - saison1.sql chargé deux fois sur une base jetable : ${n} tables dans s1, Classique intact, mêmes règles et mêmes droits`);
  // lot 4 : registre des Fragments et vitrine (supabase/saison1_vitrine.sql), seulement dans s1
  assert.strictEqual(q(`select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('frag_post', 'vit_buy')`), "0", "vitrine jamais dans le Classique");
  const U = "00000000-0000-0000-0000-0000000000a1"; q(`insert into auth.users (id) values ('${U}')`);
  const as = (s) => q(`set role authenticated; set request.jwt.claim.sub = '${U}'; ${s}`);
  const post = (rows) => +as(`select s1.frag_post('${JSON.stringify(rows)}'::jsonb)`);
  assert.strictEqual(post([{ src: "act:1:dj:1", n: 1 }, { src: "act:1:dj:9", n: 8 }]), 1, "borne du jour des donjons (8)");
  assert.strictEqual(post([{ src: "act:1:dj:1", n: 1 }]), 1, "une source ne paie qu'une fois");
  assert.strictEqual(post([{ src: "act:1:bidon:1", n: 5 }, { src: "achat:1", n: 5 }, { src: "act:1:arch:2", n: 9 }]), 1, "sources inconnues et montants trop gros refusés");
  let rows = []; for (let d = 1; d <= 7; d++) for (const [k, m] of [["dj", 8], ["arch", 6], ["job", 4], ["bounty", 4]]) rows.push({ src: `act:${d}:${k}:${m}`, n: m });
  rows = rows.filter((r) => r.src !== "act:1:dj:8"); const bal = post(rows.slice(0, 60));
  assert(bal <= 100 && bal >= 92, "quota de la semaine : 100 Fragments au plus la première semaine : " + bal);
  assert.strictEqual(as(`select coalesce(s1.vit_buy('v_aiguilles'), 'OK')`), "OK"); assert.strictEqual(as(`select coalesce(s1.vit_buy('v_aiguilles'), 'OK')`), "OK", "déjà acheté : rien à refaire");
  assert.strictEqual(+as(`select coalesce(sum(n), 0) from s1.frag_led`), bal - 60, "60 payés une seule fois");
  assert(/Il faut/.test(as(`select coalesce(s1.vit_buy('v_cadre'), 'OK')`)), "sans assez de Fragments : refusé");
  assert.strictEqual(as(`select s1.vit_mine()::text`), '["v_aiguilles"]');
  let e0 = null; try { as(`insert into s1.frag_led (user_id, src, n) values ('${U}', 'act:1:dj:99', 8)`); } catch (e) { e0 = e; } assert(e0, "le jeu n'écrit jamais directement dans le registre");
  console.log("ok - registre des Fragments (bornes du jour, quota de la semaine, sources uniques) et vitrine gardés par le serveur, dans s1 seulement");
  // Boss des mondes de saison (supabase/wboss_s1.sql, refonte du 03/11) : semaine, plafond, paliers du serveur, paliers d'essais, fuite
  {
    const W = (sq) => q(`set client_min_messages = error; ${sq}`);
    const U2 = "00000000-0000-0000-0000-0000000000b2";
    W(`insert into auth.users (id) values ('${U2}') on conflict do nothing; insert into public.profiles (id, pseudo) values ('${U}', 'Aldric'), ('${U2}', 'Mimosa') on conflict do nothing;
       update s1.s1_cfg set debut = now() - interval '1 day' where id = 1; delete from s1.wb_hits; update s1.wb_state set n = 1, hp = 20000, dmg = 0 where id = 1;`);
    assert.strictEqual(+W(`select (s1.wb_info()->>'n')`), 1, "semaine 1");
    const st = JSON.parse(W(`select s1.wb_start('${U}')::text`)); assert(st.ok && st.s1 && st.n === 1, "wb_start de saison");
    const done = (u, k, p) => JSON.parse(W(`select s1.wb_done('${u}', 1, ${k}, ${p}, 1, 200, 15, 8)::text`));
    let r = done(U, 0, 45000); assert.strictEqual(r.points, 6000, "plafond de 6 000 points"); assert.strictEqual(+W(`select count(*) from s1.wb_flags`), 1, "essai au-dessus du plafond noté");
    assert.strictEqual(+W(`select count(*) from s1.wb_pal where user_id = '${U}'`), 1, "palier 25 % atteint (6 000 sur 20 000)");
    r = done(U, 1, 3000); r = done(U, 2, 2000); assert.strictEqual(r.tier, "bronze", "Bronze au 3e essai");
    assert(/Plus d'essai/.test(W(`select s1.wb_done('${U}', 1, 3, 100, 1, 200, 15, 8)::text`)), "3 essais par jour");
    r = done(U2, 0, 6000); assert.strictEqual(+W(`select count(*) from s1.wb_pal where user_id = '${U2}'`), 3, "un joueur arrivé après les paliers les reçoit (25, 50, 75 %)");
    r = done(U2, 1, 6000); assert(r.killed, "boss abattu à 100 %"); assert.strictEqual(+W(`select count(*) from s1.wb_pal where p = 100`), 2, "palier 100 % pour les deux");
    r = done(U2, 2, 500); assert(!r.killed && r.dmg === 20000, "après sa mort, les essais comptent pour les grades mais plus pour la barre");
    const ann0 = +W(`select count(*) from public.chat_msgs where data->>'t' = 'wb'`);
    W(`update s1.s1_cfg set debut = now() - interval '8 days' where id = 1`);
    const I = JSON.parse(W(`select s1.wb_info()::text`)); assert.strictEqual(I.n, 2, "semaine 2 : nouveau boss");
    assert.strictEqual(+I.hp, Math.round(0.7 * 23500 * 1.2), "PV = 70 % des dégâts de la semaine passée (×1,2 la première fois)");
    assert.strictEqual(I.last.name, "Gargandyas"); assert(+W(`select count(*) from public.chat_msgs where data->>'t' = 'wb'`) > ann0, "arrivée annoncée");
    assert.strictEqual(+W(`select count(*) from s1.wb_kills where n = 1 and not fled`), 1, "semaine 1 notée comme abattue");
    const RC = JSON.parse(W(`select s1.wb_recap()::text`)); assert.strictEqual(RC.length, 1, "bilan du lundi de la semaine 1");
    assert(RC[0].n === 1 && RC[0].fled === false && RC[0].pct === 100 && RC[0].pal === 100 && RC[0].next_n === 2 && RC[0].top.length >= 1 && RC[0].tiers.bronze >= 1, JSON.stringify(RC[0]));
    assert.strictEqual(W(`select s1.wb_recap()::text`), "[]", "le bilan n'est rendu qu'une fois");
    W(`update s1.s1_cfg set debut = now() - interval '15 days' where id = 1`); W(`select s1.wb_info()`);
    assert.strictEqual(+W(`select count(*) from s1.wb_kills where n = 2`), 0, "semaine sans essai : pas de fuite notée");
    assert.strictEqual(q(`select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('wb_roll', 'wb_pal_give')`), "0", "règles de saison jamais dans l'Éternel");
    // « Dernier soir » : dernier soir de la semaine, 20 h - 22 h à Paris, boss sous 25 % de vie → 4e essai
    W(`update s1.s1_cfg set debut = date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - interval '20 days' where id = 1`); W(`select s1.wb_info()`);
    const nw = +W(`select n from s1.wb_state`); const fin = W(`select s1.wb_week_end(${nw})`);
    W(`update s1.wb_state set hp = 10000, dmg = 7600 where id = 1`);
    const at = (h) => `('${fin}'::timestamptz - interval '1 day' + interval '${h}')`;
    const LN = (h, g = false) => W(`select s1.wb_last_night(${g}, ${at(h)})`);
    assert.strictEqual(LN("20 hours 30 minutes"), "t", "dernier soir à 20 h 30");
    assert.strictEqual(LN("19 hours 59 minutes"), "f", "pas avant 20 h"); assert.strictEqual(LN("22 hours 5 minutes"), "f", "fini à 22 h");
    assert.strictEqual(LN("22 hours 5 minutes", true), "t", "15 min de grâce pour compter un essai commencé");
    assert.strictEqual(W(`select s1.wb_last_night(false, ${at("20 hours 30 minutes")} - interval '1 day')`), "f", "seulement le dernier soir");
    W(`update s1.wb_state set dmg = 7400 where id = 1`); assert.strictEqual(LN("20 hours 30 minutes"), "f", "boss encore au-dessus de 25 %");
    console.log("ok - dernier soir : 4e essai le dernier soir de 20 h à 22 h si le boss est sous 25 %");
    console.log("ok - boss des mondes de saison : semaine, plafond de 6 000, paliers du serveur et d'essais, mort puis nouvelle semaine");
  }

} finally { q(`drop database if exists ${DB}`, URL0); }
