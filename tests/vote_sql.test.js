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
  assert(/p\.sab && E\.sabGift\) E\.sabGift\(s, Math\.min\(4,/.test(m), "market.js applique le Sablier (4 h au plus par opération : palier 3 h + 1 h de votant)");
  assert(fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes('src="js/vote.js?v='), "index.html charge js/vote.js");
  assert(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").includes('"js/vote.js"'), "sw.js met js/vote.js en cache");
  { const mo = fs.readFileSync(path.join(ROOT, "js/mono.js"), "utf8"); assert(!/CLASSIC_MODS = \[[^\]]*"VOTE"/.test(mo) && /M\.FN = new Set\(\[[^\]]*"vote"/.test(mo), "04/11 : le vote marche aussi dans une partie Monocompte"); }
  assert(/c === "mono" \? await ON\.rpc\("mono_vote_moi"\)/.test(fs.readFileSync(path.join(ROOT, "js/vote.js"), "utf8")), "Monocompte : mono_vote_moi (liste blanche)");
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
  for (let i = 1; i <= 4; i++) q(`insert into profiles (id, pseudo) values ('${U(i)}', 'Joueur${i}')`);
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
  fails(() => as(2, `select adm_votes()`), /réservé à Mathis/, "compteurs du panel"); // le premier profil (Joueur1) est l'administrateur (classements.sql)
  assert.strictEqual(JSON.parse(as(1, `select adm_votes()`)).jour, 0, "Mathis lit les compteurs");
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
  assert(me.actif === true && me.n === 2 && me.nm === 2 && me.last && !("cle" in me) && !("ip" in me), JSON.stringify(me));
  assert(me.jours.length === 7 && me.jours[6].n === 2 && me.serie === 1 && me.bonus === 0, JSON.stringify(me.jours) + " " + me.serie);
  assert.deepStrictEqual(me.top.map((x) => [x.p, x.n, x.moi]), [["Joueur1", 2, true], ["Joueur2", 1, false], ["Joueur3", 1, false]], "votants du mois (compte en vérification exclu)");
  assert(me.obj.n === 4 && me.obj.cible === 1000 && me.obj.paliers.length === 3 && me.paye.length === 0, JSON.stringify(me.obj));
  // 2A + Sablier : série de jours d'affilée (heure de Paris) : +10 % de kamas ET de Sablier par jour avant aujourd'hui, jusqu'à +50 %
  q(`insert into auth.users values ('${U(5)}'); insert into profiles values ('${U(5)}', 'Serieux'); insert into ladder (user_id, main_lvl) values ('${U(5)}', 200)`);
  const jour = (n) => `(((now() at time zone 'Europe/Paris')::date - ${n})::timestamp + interval '12 hours') at time zone 'Europe/Paris'`;
  for (const n of [1, 2, 3]) q(`insert into vote_claims (user_id, ip, voted_at, at) values ('${U(5)}', 'old${n}', ${n}, ${jour(n)})`);
  q(`insert into vote_claims (user_id, ip, voted_at, at) values ('${U(5)}', 'old5', 5, ${jour(5)})`); // trou au jour 4 : la série s'arrête à 3
  assert.strictEqual(Number(q(`select vote_bonus('${U(5)}')`)), 30);
  const rs = srv(`vote_srv_claim('${U(5)}', 'ipS', 7000)`);
  assert(rs.ok && rs.bonus === 30 && rs.k === Math.round(217500 * 1.3) && Math.abs(rs.sab - 0.65) < 1e-6, JSON.stringify(rs));
  assert(/39 min de Sablier \(série \+30 %\)/.test(q(`select txt from hdv_ops where user_id = '${U(5)}' order by id desc limit 1`)));
  for (const n of [4, 6, 7]) q(`insert into vote_claims (user_id, ip, voted_at, at) values ('${U(5)}', 'more${n}', ${100 + n}, ${jour(n)})`);
  assert.strictEqual(Number(q(`select vote_bonus('${U(5)}')`)), 50, "plafond +50 % (7 jours d'affilée)");
  const ms = JSON.parse(as(5, `select vote_moi()`)); assert(ms.serie === 8 && ms.bonus === 50, JSON.stringify(ms));
  // 3A+B : objectif du mois, paliers versés une fois à chaque joueur qui se connecte, +1 h aux votants du mois
  q(`delete from vote_claims where user_id = '${U(5)}' and at < date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'`);
  q(`insert into vote_claims (user_id, ip, voted_at, at) select '${U(5)}', 'masse' || g, 10000 + g, now() - interval '1 minute' from generate_series(1, 600) g`);
  const p5 = JSON.parse(as(5, `select vote_moi()`));
  assert.deepStrictEqual(p5.paye, [{ n: 250, h: 2 }, { n: 500, h: 3 }], "votant : 1 h + 2 h de palier, plus 1 h chacun");
  assert.deepStrictEqual(JSON.parse(as(5, `select vote_moi()`)).paye, [], "versé une seule fois");
  q(`insert into auth.users values ('${U(6)}')`);
  assert.deepStrictEqual(JSON.parse(as(6, `select vote_moi()`)).paye, [{ n: 250, h: 1 }, { n: 500, h: 2 }], "non votant : le Sablier du palier sans le bonus");
  assert.deepStrictEqual(JSON.parse(as(4, `select vote_moi()`)).paye, [], "compte en vérification : rien");
  assert.strictEqual(q(`select string_agg(payload->>'sab', ',' order by id) from hdv_ops where user_id = '${U(6)}'`), "1,2");
  fails(() => as(6, `select count(*) from vote_paliers_pris`).replace(/^0$/, "") || (() => { throw new Error("permission denied"); })(), /permission denied/, "table des paliers illisible");
  // 4 : top 10 des votants du mois précédent : titre « Voix d'Idlus », une fois ; 11e et compte en vérification : rien
  const mAvant = (k) => `(date_trunc('month', now() at time zone 'Europe/Paris') - interval '1 month' + interval '${k} hours') at time zone 'Europe/Paris'`;
  for (let i = 10; i <= 21; i++) { q(`insert into auth.users values ('${U(i)}'); insert into profiles values ('${U(i)}', 'Votant${i}')`);
    q(`insert into vote_claims (user_id, ip, voted_at, at) select '${U(i)}', 'pm${i}-' || g, ${i * 1000} + g, ${mAvant(1)} + g * interval '1 hour' from generate_series(1, ${40 - i}) g`); }
  q(`insert into ladder (user_id, main_lvl, flagged) values ('${U(10)}', 10, true)`); // le 1er du mois dernier est en vérification
  const tt = (i) => JSON.parse(as(i, `select vote_moi()`)).titre;
  assert(tt(10) === null, "compte en vérification");
  assert.deepStrictEqual(tt(11), { rang: 1, t: "Voix d'Idlus" }); assert.strictEqual(tt(11), null, "une seule fois");
  assert.deepStrictEqual(tt(20), { rang: 10, t: "Voix d'Idlus" }); assert.strictEqual(tt(21), null, "11e : rien");
  assert.strictEqual(q(`select payload->>'title' from hdv_ops where user_id = '${U(20)}' and payload ? 'title'`), "Voix d'Idlus");
  // 04/11 (« pouvoir voter sur classique et monocompte saison 1 ») : la récompense va dans la partie ouverte (s1.hdv_ops, mono.ops)
  for (const i of [30, 31, 32]) q(`insert into auth.users values ('${U(i)}'); insert into profiles values ('${U(i)}', 'Saison${i}')`);
  assert(/pas encore ouverte/.test(srv(`vote_srv_claim('${U(30)}', 'ipS1a', 1, 's1')`).err), "espace s1 absent : message, rien de versé");
  q(`create schema s1; create table s1.ladder (user_id uuid primary key, main_lvl int not null default 1, flagged boolean not null default false);
     create table s1.hdv_ops (id bigint generated always as identity primary key, user_id uuid, payload jsonb, txt text);
     create function s1.hdv_op(p_user uuid, p jsonb, t text) returns void language sql as $f$ insert into s1.hdv_ops (user_id, payload, txt) values (p_user, p, t) $f$;
     create schema mono; create table mono.saisons (id int primary key, etat text);
     create function mono.saison_ouverte() returns int language sql stable as $f$ select id from mono.saisons where etat = 'ouverte' $f$;
     create table mono.parties (user_id uuid, saison int, primary key (user_id, saison));
     create table mono.lb_saison (user_id uuid, saison int, niveau int, primary key (user_id, saison));
     create table mono.ops (id bigint generated always as identity primary key, user_id uuid, saison int, payload jsonb, txt text);
     create function mono.op(u uuid, p_s int, p jsonb, t text) returns bigint language sql as $f$ insert into mono.ops (user_id, saison, payload, txt) values (u, p_s, p, t) returning id $f$;`);
  assert(/Saison 1 n'est pas encore sur le serveur/.test(srv(`vote_srv_claim('${U(30)}', 'ipS1a', 1, 's1')`).err), "partie Saison 1 inconnue du serveur");
  q(`insert into s1.ladder (user_id, main_lvl) values ('${U(30)}', 20), ('${U(31)}', 200)`);
  q(`insert into ladder (user_id, main_lvl, flagged) values ('${U(31)}', 200, true)`); // en vérification sur l'Éternel seulement
  const s1a = srv(`vote_srv_claim('${U(30)}', 'ipS1a', 1, 's1')`);
  assert(s1a.ok && s1a.cible === "s1" && s1a.k === Math.round(75000 / 4), "niveau du héros de la Saison 1 : " + JSON.stringify(s1a));
  assert.deepStrictEqual(JSON.parse(q(`select payload from s1.hdv_ops where user_id = '${U(30)}'`)), { k: 18750, sab: 0.5, vote: 1 });
  assert.strictEqual(q(`select count(*) from hdv_ops where user_id = '${U(30)}'`), "0", "rien dans la partie Éternel");
  assert.strictEqual(q(`select cible from vote_claims where ip = 'ipS1a'`), "s1");
  assert(srv(`vote_srv_claim('${U(30)}', 'ipS1b', 2, 'eternel')`).attente > 0, "une récompense par heure, toutes parties confondues");
  assert(srv(`vote_srv_claim('${U(31)}', 'ipS1a', 1, 's1')`).deja, "un vote ne paie qu'une partie");
  assert(srv(`vote_srv_claim('${U(31)}', 'ipS1c', 3, 's1')`).ok, "vérification de l'Éternel : la Saison 1 reçoit quand même");
  q(`update s1.ladder set flagged = true where user_id = '${U(31)}'`); q(`update vote_claims set at = now() - interval '2 hours' where user_id = '${U(31)}'`);
  assert(/vérification/.test(srv(`vote_srv_claim('${U(31)}', 'ipS1d', 4, 's1')`).err), "compte en vérification en Saison 1");
  assert(/Aucune saison Monocompte/.test(srv(`vote_srv_claim('${U(32)}', 'ipM1', 1, 'mono')`).err));
  q(`insert into mono.saisons values (1, 'close'), (2, 'ouverte')`);
  assert(/Monocompte n'est pas encore sur le serveur/.test(srv(`vote_srv_claim('${U(32)}', 'ipM1', 1, 'mono')`).err));
  q(`insert into mono.parties values ('${U(32)}', 1), ('${U(32)}', 2); insert into mono.lb_saison values ('${U(32)}', 2, 60)`);
  const mo = srv(`vote_srv_claim('${U(32)}', 'ipM1', 1, 'mono')`);
  assert(mo.ok && mo.cible === "mono" && mo.k === Math.round(385000 / 4), JSON.stringify(mo));
  assert.deepStrictEqual(JSON.parse(q(`select json_build_object('s', saison, 'p', payload) from mono.ops where user_id = '${U(32)}'`)), { s: 2, p: { k: 96250, sab: 0.5, vote: 1 } }, "saison ouverte");
  assert(srv(`vote_srv_claim('${U(32)}', 'ipM2', 2, 'n importe quoi')`).attente > 0, "cible inconnue : Éternel");
  // paliers du mois et état : versés dans la partie ouverte ; Monocompte par mono_vote_moi (liste blanche du jeu)
  const mm = JSON.parse(as(32, `select mono_vote_moi()`));
  assert(mm.cible === "mono" && mm.partie === null && mm.paye.length === 2 && mm.n === 1, JSON.stringify(mm));
  assert.strictEqual(q(`select string_agg(payload->>'sab', ',' order by id) from mono.ops where user_id = '${U(32)}' and not payload ? 'k'`), "2,3");
  assert.deepStrictEqual(JSON.parse(as(32, `select vote_moi('s1')`)).paye, [], "paliers une fois par compte, toutes parties confondues");
  const s1n = JSON.parse(as(30, `select vote_moi('s1')`)); assert(s1n.cible === "s1" && s1n.paye.length === 2, JSON.stringify(s1n));
  assert.strictEqual(q(`select count(*) from s1.hdv_ops where user_id = '${U(30)}' and payload ? 'sab' and not payload ? 'k'`), "2");
  q(`insert into auth.users values ('${U(33)}')`);
  const s1x = JSON.parse(as(33, `select vote_moi('s1')`)); assert(/pas encore sur le serveur/.test(s1x.partie) && s1x.paye.length === 0, "partie inconnue : rien de versé, rien de pris");
  assert.strictEqual(JSON.parse(as(33, `select vote_moi()`)).paye.length, 2, "puis versés dans l'Éternel");
  fails(() => as(1, `select vote_verse('${U(1)}', 'eternel', '{"k": 1}', 'x')`), /permission denied/, "un joueur se verse des kamas");
  fails(() => as(1, `select vote_partie('${U(1)}', 's1')`), /permission denied/, "vote_partie réservée au serveur");
  assert.deepStrictEqual(Object.keys(JSON.parse(as(1, `select adm_votes()`)).parties).sort(), ["eternel", "mono", "s1"], "panel : votes par partie");
  q(`update vote_cfg set actif = false`); assert.strictEqual(JSON.parse(as(1, `select vote_moi()`)).actif, false, "coupé depuis la base");
  // empreinte de l'adresse effacée au bout de 30 jours, le vote reste compté
  q(`update vote_claims set at = now() - interval '31 days' where user_id = '${U(2)}'`); srv(`vote_srv_claim('${U(3)}', 'ipG', 9999)`);
  assert.strictEqual(q(`select string_agg(ip, ',') from vote_claims where user_id = '${U(2)}'`).startsWith("efface:"), true);
  assert.strictEqual(as(1, `select count(*) from vote_claims`), "0");
  console.log("ok - vote : adresse du joueur, jeu, vote.sql (récompense, doublons, 55 min, vérification, droits)");
} finally { psql(`drop database if exists ${DB}`); }
