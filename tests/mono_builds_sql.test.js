/* 2.2.4.1 : builds du Monocompte (supabase/mono_builds.sql, fabriqué par tools/mono_builds.js depuis builds.sql)
   - le fichier est à jour avec builds.sql, il n'est pas dans le déploiement automatique (accord de Mathis : Serveur OVH, étape monocompte-builds) ;
   - dans un vrai Postgres jetable (jamais la base en ligne) : les builds du Monocompte et ceux du Classique ne se mélangent pas,
     le Classique ne change pas (fonctions et tables de builds.sql identiques avant/après), publier, aimer, signaler et le panel marchent.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/mono_builds_sql.test.js */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const { make } = require("../tools/mono_builds.js");

assert.strictEqual(fs.readFileSync(path.join(ROOT, "supabase/mono_builds.sql"), "utf8"), make(), "supabase/mono_builds.sql pas à jour : node tools/mono_builds.js");
{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/builds.sql"), "liste des fichiers déployés introuvable");
  assert(!/mono_builds/.test(tous), "mono_builds.sql n'est pas déployé automatiquement (accord de Mathis)");
  const ovh = fs.readFileSync(path.join(ROOT, ".github/workflows/serveur-ovh.yml"), "utf8");
  assert(/inputs\.etape == 'monocompte-builds'[\s\S]*?cat supabase\/mono_builds\.sql/.test(ovh), "étape monocompte-builds du Serveur OVH"); }
const SQL = fs.readFileSync(path.join(ROOT, "supabase/mono_builds.sql"), "utf8");
for (const l of SQL.split("\n").filter((x) => !/^\s*--/.test(x))) assert(!/\b(builds|build_likes|build_views|build_reports)\b(?!_)/.test(l.replace(/mono_build\w*/g, "")) || /build n°/.test(l), "table du Classique dans mono_builds.sql : " + l);

const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - mono_builds.sql à jour et hors du déploiement automatique (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_mono_builds_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
  const J = (i, s) => JSON.parse(as(i, `select ${s}`) || "null");
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;`);
  q(`create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql", "builds.sql"]) file(path.join(ROOT, "supabase", f));
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  const snap = () => q(`select string_agg(x, E'\\n' order by x) from (
      select 'T ' || table_name || ' ' || column_name || ' ' || data_type x from information_schema.columns where table_schema = 'public' and table_name not like 'mono\\_%'
      union all select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname not like 'mono\\_%' and p.proname not like '%\\_mono') s`);
  const before = snap();
  file(path.join(ROOT, "supabase", "mono_builds.sql")); file(path.join(ROOT, "supabase", "mono_builds.sql")); // relancé : sans danger
  assert.strictEqual(snap(), before, "mono_builds.sql ne touche pas au Classique");
  q(`insert into auth.users select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 1) from auth.users; insert into admins values ('${U(9)}');`);
  const code = (cls, lvl) => "IDLUS1-" + Buffer.from(JSON.stringify({ v: 1, cls, lvl, st: {}, sp: [], eq: { coiffe: "i1", cape: "i2", bottes: "i3" }, rx: { coiffe: [{ pa: 1 }, "pa"] } })).toString("base64");
  const pub = (i, fn, t, cls = "iop") => J(i, `${fn}(null, 1, 'fo', 'moy', array['Donjon'], '${t}', 'note', '${code(cls, 200)}')`);
  const m = pub(1, "mono_build_publish", "Build mono Terre");
  assert(m && m.id, "publication Monocompte : " + JSON.stringify(m));
  as(1, "select pg_sleep(0)");
  const c = pub(2, "build_publish", "Build classique Feu", "cra");
  assert(c && c.id, "publication Classique : " + JSON.stringify(c));
  const lm = J(3, `mono_builds_list()`), lc = J(3, `builds_list()`);
  assert.deepStrictEqual(lm.rows.map((x) => x.title), ["Build mono Terre"], "liste Monocompte : seulement ses builds");
  assert.deepStrictEqual(lc.rows.map((x) => x.title), ["Build classique Feu"], "liste Classique : seulement ses builds");
  assert.strictEqual(J(1, `mono_builds_me()`).length, 1); assert.strictEqual(J(1, `builds_me()`).length, 0);
  assert.strictEqual(J(3, `mono_build_like(${m.id})`).likes, 1, "j'aime Monocompte");
  assert.strictEqual(J(3, `mono_builds_list()`).rows[0].likes, 1); assert.strictEqual(J(3, `builds_list()`).rows[0].likes, 0);
  as(4, `select mono_build_report(${m.id}, 'Spam ou publicité')`);
  const adm = J(9, `adm_builds_mono()`); assert.strictEqual(adm.length, 1); assert.strictEqual(adm[0].reports, 1, "panel : build signalé");
  as(9, `select adm_build_set_mono(${m.id}, 'hide')`);
  assert.strictEqual(J(3, `mono_builds_list()`).rows.length, 0, "caché par le panel");
  assert.strictEqual(J(9, `adm_builds()`).length, 1, "panel Classique : ses builds seulement");
  let refused = false; try { as(3, `select adm_builds_mono()`); } catch (e) { refused = true; } assert(refused, "panel Monocompte : réservé à l'équipe");
  refused = false; try { q(`set role authenticated; set request.jwt.claim.sub = '${U(3)}'; select * from public.mono_builds`); } catch (e) { refused = !!e; }
  const direct = refused ? [] : JSON.parse(as(3, `select coalesce(json_agg(x), '[]') from public.mono_builds x`) || "[]");
  assert.strictEqual(direct.length, 0, "aucune lecture directe de la table");
  console.log("ok - builds du Monocompte : à part du Classique (listes, j'aime, mes builds), panel, Classique inchangé, relançable");
} finally { psql(`drop database if exists ${DB}`); }
