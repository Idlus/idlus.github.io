/* Récompense de vote sur Dofus Fan Games (02/11/2026) :
   - fonction serveur « vote » : lecture de l'adresse du joueur dans X-Forwarded-For (dernière adresse publique : une adresse
     inventée par le joueur en tête de liste est ignorée ; adresses Docker et locales écartées) ;
   - supabase/vote.sql dans un vrai Postgres jetable (jamais la base en ligne) : kamas selon le niveau, un vote = une récompense,
     une récompense par compte toutes les 55 minutes, compte en vérification refusé, gains par hdv_ops (kamas + Sablier),
     aucun droit des joueurs sur les tables ni sur les fonctions du serveur (la clé de l'API ne sort jamais) ;
   - le jeu : market.js applique le Sablier reçu, vote.js est chargé et mis en cache.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/vote_sql.test.js
   Sans IDLUS_PG, la partie SQL est sautée. La base « idlus_vote_test » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");

/* ---------- adresse du joueur (fonction serveur, sans Deno) ---------- */
{
  const src = fs.readFileSync(path.join(ROOT, "supabase/functions/vote/index.ts"), "utf8");
  const pick = (name) => { const i = src.indexOf("export function " + name); assert(i >= 0, name + " introuvable"); const j = src.indexOf("\n}\n", i); return src.slice(i + 7, j + 2); };
  const js = (pick("privee") + "\n" + pick("ipJoueur")).replace(/\((\w+): string\)/g, "($1)").replace(/\((\w+): string \| null, (\w+): string \| null\)/g, "($1, $2)").replace(/\): (boolean|string \| null) \{/g, ") {");
  const { privee, ipJoueur } = new Function(js + "\nreturn { privee, ipJoueur };")();
  assert.strictEqual(ipJoueur("86.12.3.4", null), "86.12.3.4");
  assert.strictEqual(ipJoueur("86.12.3.4, 172.18.0.5", null), "86.12.3.4", "adresse de la passerelle Docker écartée");
  assert.strictEqual(ipJoueur("1.2.3.4, 86.12.3.4, 172.18.0.5", null), "86.12.3.4", "adresse inventée en tête de liste ignorée");
  assert.strictEqual(ipJoueur("2a01:cb00:1:2::5, 10.0.0.2", null), "2a01:cb00:1:2::5", "IPv6");
  assert.strictEqual(ipJoueur("::ffff:86.12.3.4", null), "86.12.3.4");
  assert.strictEqual(ipJoueur("192.168.1.2, 127.0.0.1", null), null, "aucune adresse publique");
  assert.strictEqual(ipJoueur("", "90.1.2.3"), "90.1.2.3", "X-Real-IP en secours");
  assert.strictEqual(ipJoueur("n'importe quoi", null), null);
  assert(privee("100.64.1.1") && privee("fd00::1") && !privee("8.8.8.8"));
  assert(!/console\.log\([^)]*ip\b/.test(src), "l'adresse n'est jamais écrite dans les journaux");
  assert(/vote_srv_claim[\s\S]*empreinte\(/.test(src), "seule l'empreinte de l'adresse va dans la base");
}

/* ---------- jeu : Sablier par l'hôtel de vente, fichier chargé et mis en cache ---------- */
{
  const m = fs.readFileSync(path.join(ROOT, "js/market.js"), "utf8");
  assert(/p\.sab && E\.sabGift\) E\.sabGift\(s, Math\.min\(2,/.test(m), "market.js applique le Sablier (2 h au plus par opération)");
  assert(fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes('src="js/vote.js?v='), "index.html charge js/vote.js");
  assert(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").includes('"js/vote.js"'), "sw.js met js/vote.js en cache");
  assert(fs.readFileSync(path.join(ROOT, "js/mono.js"), "utf8").includes('"VOTE"'), "rien du vote dans une partie Monocompte");
  const v = fs.readFileSync(path.join(ROOT, "js/vote.js"), "utf8");
  assert(!/cle|DFG_VOTE_KEY|api\/v1/i.test(v.replace(/\/\*[\s\S]*?\*\//g, "")), "le jeu ne connaît ni la clé ni l'API");
}

const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - vote : adresse du joueur, jeu (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
const DB = "idlus_vote_test";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const psql = (sql, db) => execFileSync("psql", [db ? dbUrl : URL0, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
psql(`drop database if exists ${DB}`); psql(`create database ${DB}`);
try {
  const q = (s) => psql(s, true);
  const U = (i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
  const srv = (s) => JSON.parse(q(`set role service_role; select ${s}`) || "null");
  const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;`);
  q(`create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
  for (const f of ["schema.sql", "classements.sql", "chat.sql", "hdv_data.sql", "hdv.sql"]) file(path.join(ROOT, "supabase", f));
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`); // droits par défaut de Supabase
  file(path.join(ROOT, "supabase", "vote.sql")); file(path.join(ROOT, "supabase", "vote.sql")); // relancé : sans danger
  q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`); // même après coup : RLS sans règle
  for (let i = 1; i <= 4; i++) q(`insert into auth.users values ('${U(i)}')`);
  q(`insert into ladder (user_id, main_lvl) values ('${U(1)}', 200), ('${U(2)}', 1), ('${U(3)}', 60)`);
  q(`insert into ladder (user_id, main_lvl, flagged) values ('${U(4)}', 150, true)`);

  // kamas d'un vote : un quart d'heure des repères de js/verify.js
  const pts = [[1, 20000], [20, 75000], [60, 385000], [120, 510000], [200, 870000]];
  const kh = (l) => { for (let i = 1; i < pts.length; i++) if (l <= pts[i][0]) { const [a, x] = pts[i - 1], [b, y] = pts[i]; return x + (y - x) * (l - a) / (b - a); } return 870000; };
  for (const l of [1, 10, 20, 59, 60, 100, 150, 200, 250, 0]) assert.strictEqual(Number(q(`select vote_kamas(${l})`)), Math.round(kh(Math.max(1, Math.min(200, l))) / 4), "kamas au niveau " + l);
  { const m = /V\.KAMAS_PTS = (\[\[[^;]+\]\]);/.exec(fs.readFileSync(path.join(ROOT, "js/verify.js"), "utf8")); assert(m && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(pts), "mêmes repères que V.KAMAS_PTS"); }

  // personne d'autre que la fonction serveur ne lit la clé ni ne donne de récompense
  q(`update vote_cfg set cle = 'CLE-SECRETE'`);
  fails(() => as(1, `select vote_srv_cfg()`), /permission denied/, "un joueur lit la clé");
  fails(() => as(1, `select vote_srv_claim('${U(1)}', 'x', 1)`), /permission denied/, "un joueur se donne une récompense");
  fails(() => q(`set role anon; select vote_srv_claim('${U(1)}', 'x', 1)`), /permission denied/, "sans compte");
  assert.strictEqual(as(1, `select count(*) from vote_cfg`), "0", "table des réglages illisible");
  assert.strictEqual(as(1, `select count(*) from vote_claims`), "0", "table des votes illisible");
  fails(() => as(1, `select adm_votes()`), /réservé à Mathis/, "compteurs du panel");
  assert.strictEqual(srv(`vote_srv_cfg()`).cle, "CLE-SECRETE");

  // un vote récompensé : kamas + 30 min de Sablier par hdv_ops
  const r1 = srv(`vote_srv_claim('${U(1)}', 'ipA', 1000)`);
  assert(r1.ok && r1.k === 217500 && r1.sab === 0.5, JSON.stringify(r1));
  const op = JSON.parse(q(`select row_to_json(o) from hdv_ops o where user_id = '${U(1)}'`));
  assert.deepStrictEqual(op.payload, { k: 217500, sab: 0.5, vote: 1 }); assert(/217 500 kamas et 30 min de Sablier/.test(op.txt), op.txt);
  // le même vote une deuxième fois (double clic, autre compte sur la même box) : rien
  assert(srv(`vote_srv_claim('${U(1)}', 'ipA', 1000)`).deja);
  assert(srv(`vote_srv_claim('${U(2)}', 'ipA', 1000)`).deja, "un autre compte derrière la même adresse ne touche pas le même vote");
  // un nouveau vote avant 55 minutes (autre réseau) : attendre
  const r2 = srv(`vote_srv_claim('${U(1)}', 'ipB', 2000)`); assert(r2.attente > 3000 && r2.attente <= 3300, JSON.stringify(r2));
  // une heure plus tard : de nouveau
  q(`update vote_claims set at = now() - interval '56 minutes' where user_id = '${U(1)}'`);
  assert(srv(`vote_srv_claim('${U(1)}', 'ipA', 4600)`).ok);
  // niveau 1, compte sans ligne au classement, compte en vérification
  assert.strictEqual(srv(`vote_srv_claim('${U(2)}', 'ipC', 1000)`).k, 5000);
  q(`delete from ladder where user_id = '${U(3)}'`); assert.strictEqual(srv(`vote_srv_claim('${U(3)}', 'ipD', 1000)`).k, 5000);
  assert(/vérification/.test(srv(`vote_srv_claim('${U(4)}', 'ipE', 1000)`).err));
  assert(srv(`vote_srv_claim(null, 'ipF', 1000)`).err && srv(`vote_srv_claim('${U(2)}', '', 1000)`).err && srv(`vote_srv_claim('${U(2)}', 'ipF', 0)`).err);
  assert.strictEqual(q(`select count(*) from hdv_ops where payload ? 'vote'`), "4");
  // mon état (jamais l'adresse ni la clé)
  const me = JSON.parse(as(1, `select vote_moi()`));
  assert(me.actif === true && me.n === 2 && me.last && !("cle" in me) && !("ip" in me), JSON.stringify(me));
  q(`update vote_cfg set actif = false`); assert.strictEqual(JSON.parse(as(1, `select vote_moi()`)).actif, false, "coupé depuis la base");
  // vieux votes effacés au bout de 30 jours
  q(`update vote_claims set at = now() - interval '31 days' where user_id = '${U(2)}'`); srv(`vote_srv_claim('${U(3)}', 'ipG', 9999)`);
  assert.strictEqual(q(`select count(*) from vote_claims where user_id = '${U(2)}'`), "0");
  console.log("ok - vote : adresse du joueur, jeu, vote.sql (récompense, doublons, 55 min, vérification, droits)");
} finally { psql(`drop database if exists ${DB}`); }
