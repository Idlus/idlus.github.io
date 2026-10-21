/* Clés bêta du Monocompte : supabase/mono_cles.sql dans un vrai Postgres jetable (jamais la base en ligne).
   - ordre de chargement : monocompte.sql → amis.sql → mono_social.sql → mono_bureau.sql → mono_cles.sql, relançable
     (mono_cles.sql deux fois, puis monocompte.sql et mono_cles.sql à nouveau : aucune clé ni aucun testeur perdu) ;
   - panel : créer des clés (format MONO-XXXX-XXXX, alphabet sans caractères ambigus), liste, annuler ;
   - joueur : saisie normalisée, une clé = un compte, « déjà testeur » sans prendre de clé, accès ouvert (mono_acces) ;
   - triche : clé déjà utilisée, annulée, inventée, 6e essai raté dans l'heure, deux comptes en même temps sur la même clé
     (un seul gagne), fonctions du panel appelées par un joueur, anon refusé, lecture directe des tables refusée.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/mono_cles_sql.test.js
   Sans IDLUS_PG, le test SQL est sauté. La base « idlus_mono_cles » est recréée puis effacée. */
"use strict";
const { execFileSync, spawn } = require("child_process");
const fs = require("fs"); const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
// déploiement manuel seulement : le workflow « Serveur en ligne » ne connaît pas mono_cles.sql ; l'étape monocompte-installer le charge en dernier
{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/schema.sql"), "liste des fichiers déployés introuvable"); assert(!/mono_cles|monocompte/.test(tous), "mono_cles.sql ne doit pas être déployé automatiquement");
  const ovh = fs.readFileSync(path.join(ROOT, ".github/workflows/serveur-ovh.yml"), "utf8");
  assert(/supabase\/mono_bureau\.sql supabase\/mono_cles\.sql; do/.test(ovh), "monocompte-installer : mono_cles.sql après mono_bureau.sql"); }
if (!URL0) { console.log("ok - mono_cles.sql hors du déploiement automatique (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }

const DB = "idlus_mono_cles";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(ROOT, "supabase", f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const lit = (v) => `$q$${v}$q$`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const J = (i, s) => JSON.parse(as(i, `select (${s})::text`) || "null");
const use = (i, code) => J(i, `mono_cle_utiliser(${lit(code)})`);
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
const okR = (r, why) => { assert(r && r.ok && !r.err, why + " : " + JSON.stringify(r)); return r; };
const errR = (r, re, why) => { assert(r && r.err && re.test(r.err) && !r.ok, why + " : " + JSON.stringify(r)); return r; };
const acces = (i) => J(i, "mono_acces()").ok;
// plusieurs comptes VRAIMENT en même temps (un psql par compte ; chaque transaction garde son verrou 0,4 s)
const race = (calls) => Promise.all(calls.map(([i, code]) => new Promise((res) => {
  const p = spawn("psql", [dbUrl, "-X", "-q", "-At", "-f", "-"]);
  let o = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d));
  p.on("close", () => { const l = o.split("\n").find((x) => x.startsWith("{")); res(l ? JSON.parse(l) : { sortie: o }); });
  p.stdin.end(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; begin; select mono_cle_utiliser(${lit(code)})::text; select pg_sleep(0.4); commit;`);
})));

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
(async () => {
  const REFUS = [];
  const refuse = (label, fn) => { fn(); REFUS.push(label); };
  try {
    q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
         if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
       create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
       create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
       grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
    for (const f of ["schema.sql", "classements.sql", "chat.sql"]) file(f);
    q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
    for (const f of ["monocompte.sql", "amis.sql", "mono_social.sql", "mono_bureau.sql", "mono_cles.sql", "mono_cles.sql"]) file(f);
    { // aucune fonction de mono_cles.sql n'est définie ailleurs
      const own = {}; const dbl = [];
      for (const f of ["monocompte.sql", "amis.sql", "mono_social.sql", "mono_bureau.sql", "mono_cles.sql"])
        for (const m of fs.readFileSync(path.join(ROOT, "supabase", f), "utf8").matchAll(/^create (?:or replace )?function ([a-z_]+\.[a-z_0-9]+)/gm)) {
          if (own[m[1]] && own[m[1]] !== f) dbl.push(m[1] + " : " + own[m[1]] + " et " + f); own[m[1]] = own[m[1]] || f; }
      assert.deepStrictEqual(dbl, [], "fonctions définies dans deux fichiers"); }
    const FN = ["mono_adm_cles_creer(integer,text)", "mono_adm_cles()", "mono_adm_cle_annuler(text)", "mono_cle_utiliser(text)"];
    const droits = () => FN.map((f) => q(`select has_function_privilege('anon', 'public.${f}', 'execute') || ' ' || has_function_privilege('authenticated', 'public.${f}', 'execute')`)).join(",");
    assert.strictEqual(droits(), FN.map(() => "false true").join(","), "fonctions des clés : joueurs connectés seulement, jamais anon");
    assert.strictEqual(q(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'mono' and p.proname like 'cle%'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`), "0", "fonctions internes mono.cle_* : personne");
    console.log("ok - ordre monocompte.sql → amis.sql → mono_social.sql → mono_bureau.sql → mono_cles.sql, relancé, droits d'appel");

    q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 14) i;
       insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users;
       delete from admins; insert into admins values ('${U(9)}');`); // Mathis = 9

    /* ---------- panel ---------- */
    refuse("panel appelé par un joueur", () => {
      fails(() => as(1, `select mono_adm_cles_creer(5, 'x')`), /réservé à Mathis/, "un joueur crée des clés");
      fails(() => as(1, `select mono_adm_cles()`), /réservé à Mathis/, "un joueur lit les clés");
      fails(() => as(1, `select mono_adm_cle_annuler('MONO-AAAA-AAAA')`), /réservé à Mathis/, "un joueur annule une clé"); });
    refuse("anon refusé", () => {
      fails(() => q(`set role anon; select mono_cle_utiliser('MONO-AAAA-AAAA')`), /permission denied/, "anon utilise une clé");
      fails(() => q(`set role anon; select mono_adm_cles_creer(1, 'x')`), /permission denied/, "anon crée des clés"); });
    fails(() => as(9, `select mono_adm_cles_creer(0, 'x')`), /de 1 à 100/, "0 clé"); fails(() => as(9, `select mono_adm_cles_creer(101, 'x')`), /de 1 à 100/, "101 clés");
    const K = J(9, `mono_adm_cles_creer(12, '  Vague 1  ')`);
    assert.strictEqual(K.length, 12, "12 clés"); assert.strictEqual(new Set(K).size, 12, "clés toutes différentes");
    K.forEach((k) => assert.match(k, /^MONO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, "format " + k));
    const K2 = J(9, `mono_adm_cles_creer(100, null)`); assert.strictEqual(new Set(K.concat(K2)).size, 112, "100 clés de plus, sans doublon");
    assert.strictEqual(q(`select count(*) from mono.cles where lot = 'Vague 1'`), "12", "nom du lot gardé (sans espaces autour)");
    refuse("lecture directe des tables refusée", () => {
      fails(() => as(1, `select * from mono.cles`), /permission denied/, "un joueur lit mono.cles");
      fails(() => as(1, `select * from mono.cles_essais`), /permission denied/, "un joueur lit le journal");
      fails(() => as(1, `update mono.cles set annulee = false`), /permission denied/, "un joueur écrit dans mono.cles");
      fails(() => q(`set role anon; select * from mono.cles`), /permission denied/, "anon lit mono.cles"); });
    console.log("ok - panel : 12 + 100 clés MONO-XXXX-XXXX sans doublon, bornes 1..100, réservé à l'admin");

    /* ---------- joueur ---------- */
    assert.strictEqual(acces(1), false, "joueur 1 pas encore testeur");
    errR(use(1, "   "), /Entre ta clé/, "saisie vide");
    const saisie = "  " + K[0].toLowerCase().replace(/-/g, " ").replace(/^mono /, "mono") + " ";
    const r1 = okR(use(1, saisie), "clé en minuscules avec espaces"); assert(!r1.deja, "première clé : pas « déjà »");
    assert.strictEqual(acces(1), true, "joueur 1 testeur : mono_acces ok");
    const r2 = okR(use(1, K[1]), "déjà testeur"); assert(r2.deja && /déjà testeur/.test(r2.msg), "réponse « déjà testeur »");
    assert.strictEqual(q(`select utilisee_par is null from mono.cles where code = '${K[1]}'`), "t", "déjà testeur : aucune clé prise");
    const ra = okR(use(9, K[1]), "admin"); assert(ra.deja, "l'admin entre déjà dans l'espace Monocompte : aucune clé prise");
    okR(use(12, K[1].slice(5)), "clé sans « MONO- »");
    refuse("clé déjà utilisée", () => errR(use(2, K[0]), /déjà été utilisée/, "clé du joueur 1 par le joueur 2"));
    assert.strictEqual(as(9, `select mono_adm_cle_annuler('${K[2]}')`), "", "annuler une clé libre");
    assert.match(as(9, `select mono_adm_cle_annuler('${K[0]}')`), /déjà utilisée/, "une clé utilisée ne s'annule pas");
    assert.match(as(9, `select mono_adm_cle_annuler('MONO-ZZZZ-ZZZZ')`), /inconnue/, "annuler une clé inconnue");
    refuse("clé annulée", () => errR(use(2, K[2]), /annulée/, "clé annulée"));
    refuse("clé inventée", () => { errR(use(3, "MONO-ZZZZ-ZZZZ"), /inconnue/, "clé inventée"); errR(use(3, "FRAGMENTS21"), /inconnue/, "ancien code du jeu"); errR(use(3, "'; drop table mono.cles; --"), /inconnue/, "saisie piégée"); });
    assert.strictEqual(acces(2), false, "joueur 2 toujours pas testeur"); assert.strictEqual(acces(3), false, "joueur 3 toujours pas testeur");
    refuse("6e essai raté dans l'heure", () => {
      for (let n = 0; n < 5; n++) errR(use(4, "MONO-ZZZZ-ZZZ" + "ABCDE"[n]), /inconnue/, "essai raté " + (n + 1));
      errR(use(4, K[3]), /Trop d'essais/, "6e essai, même avec une bonne clé");
      assert.strictEqual(q(`select utilisee_par is null from mono.cles where code = '${K[3]}'`), "t", "clé pas prise par l'essai refusé");
      assert.strictEqual(acces(4), false, "joueur 4 pas testeur"); });
    q(`update mono.cles_essais set at = at - interval '61 minutes' where user_id = '${U(4)}'`);
    okR(use(4, K[3]), "une heure plus tard, la clé passe");
    { // les essais ratés d'un compte ne bloquent pas les autres
      okR(use(13, K[4]), "joueur 13 pas gêné par le joueur 4"); }
    console.log("ok - joueur : saisie normalisée, une clé par compte, « déjà testeur » sans clé prise, clé utilisée / annulée / inventée refusée, 5 essais ratés par heure");

    /* ---------- deux comptes en même temps sur la même clé ---------- */
    refuse("deux comptes en même temps sur la même clé", () => {});
    for (const [a, b, k] of [[5, 6, K[5]], [7, 8, K[6]], [10, 11, K[7]]]) {
      const R = await race([[a, k], [b, k]]);
      const won = R.filter((x) => x.ok); const lost = R.filter((x) => x.err);
      assert.strictEqual(won.length, 1, "un seul gagne : " + JSON.stringify(R)); assert.strictEqual(lost.length, 1, "l'autre est refusé : " + JSON.stringify(R));
      assert.match(lost[0].err, /déjà été utilisée/, "message du perdant");
      assert.strictEqual(+acces(a) + +acces(b), 1, "un seul des deux comptes devient testeur");
    }
    { // le même compte sur deux clés en même temps : une seule clé prise
      const R = await race([[14, K[8]], [14, K[9]]]);
      assert.strictEqual(R.filter((x) => x.ok && !x.deja).length, 1, "une seule clé pour le compte : " + JSON.stringify(R));
      assert.strictEqual(q(`select count(*) from mono.cles where utilisee_par = '${U(14)}'`), "1", "une seule clé au nom du joueur 14"); }
    console.log("ok - deux comptes sur la même clé en même temps : un seul gagne (3 essais) ; un compte sur deux clés : une seule prise");

    /* ---------- liste du panel, retirer un testeur ---------- */
    const L = J(9, "mono_adm_cles()");
    assert.strictEqual(L.length, 112, "toutes les clés listées");
    const x0 = L.find((x) => x.code === K[0]); assert(x0.pseudo === "Joueur01" && x0.at && x0.lot === "Vague 1" && x0.testeur === true, "clé utilisée : pseudo, date, lot " + JSON.stringify(x0));
    assert(L.find((x) => x.code === K[2]).annulee === true, "clé annulée marquée");
    assert(L.find((x) => x.code === K[10]).pseudo == null, "clé libre sans pseudo");
    assert.strictEqual(as(9, `select mono_adm_testeur('Joueur01', false)`), "", "retirer le testeur 1");
    assert.strictEqual(acces(1), false, "joueur 1 retiré : plus d'accès");
    assert.strictEqual(J(9, "mono_adm_cles()").find((x) => x.code === K[0]).testeur, false, "panel : clé utilisée par un testeur retiré");
    errR(use(1, K[10]), /déjà utilisé une clé/, "un testeur retiré ne revient pas avec une autre clé");
    assert.strictEqual(q(`select utilisee_par is null from mono.cles where code = '${K[10]}'`), "t", "la clé reste libre");
    console.log("ok - panel : liste (pseudo, date, lot, annulée), testeur retiré par mono_adm_testeur sans nouvelle clé possible");

    /* ---------- relance des fichiers : rien de perdu ---------- */
    const etat = () => q(`select md5(string_agg(code || coalesce(utilisee_par::text, '') || annulee || coalesce(lot, ''), ',' order by code)) || (select count(*) from mono.testeurs) || (select count(*) from mono.cles_essais) from mono.cles`);
    const e0 = etat();
    for (const f of ["mono_cles.sql", "monocompte.sql", "mono_cles.sql"]) file(f);
    assert.strictEqual(etat(), e0, "relance : clés, testeurs et journal intacts");
    assert.strictEqual(droits(), FN.map(() => "false true").join(","), "relance : droits d'appel inchangés");
    refuse("lecture directe après relance", () => fails(() => as(2, `select count(*) from mono.cles`), /permission denied/, "après relance"));
    okR(use(2, K[11]), "les clés marchent après relance");
    console.log("ok - relance de mono_cles.sql et monocompte.sql : rien d'effacé, droits gardés");
    console.log(`ok - triche refusée (${REFUS.length}) : ${REFUS.join(" ; ")}`);
  } finally {
    run(`drop database if exists ${DB}`, URL0);
  }
})().catch((e) => { console.error(e); try { run(`drop database if exists ${DB}`, URL0); } catch (x) {} process.exit(1); });
