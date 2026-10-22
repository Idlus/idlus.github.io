/* Bureau des Aventuriers (serveur Monocompte) : supabase/mono_bureau.sql dans un vrai Postgres jetable (jamais la base en ligne),
   avec la vraie fonction serveur « mono » (route { bureau: { combat } }, rejouée sans Deno : ses appels à la base passent par
   psql, rôle service_role) et de vraies parties passées par le Bouclier. Plan directeur, section 6.2 ligne 13 :
   - les 18 cas limites de la maquette, les règles 1B à 11A, 2 min de reconnexion et 5 min de grâce, chef provisoire,
     invitation manquée, combat commencé non rejoignable ;
   - triche : salon plein (deux joueurs sur la dernière place en même temps), lancer sans être chef, double lancement,
     photo forgée (le jeu n'envoie jamais de photo), héros modifié après sa validation, quitter pendant le combat, compte hors
     saison, non testeur, suspendu, en vérification, butin pris deux fois, fonctions du serveur appelées par un joueur ;
   - même combat côté jeu et serveur, temps de calcul, butin reçu une seule fois, aucun faux refus du Bouclier après le butin ;
   - défi 12 compté par le serveur ; créneaux de rendez-vous et messages privés désactivés par défaut ; Classique intact ;
   - ORDRE DE CHARGEMENT unique du Monocompte : monocompte.sql → amis.sql → mono_social.sql → mono_bureau.sql (puis
     monocompte.sql relancé) : défi 12, crochets sociaux (classements, renfort) et Bouclier ensemble, aucun crochet effacé ;
   - amis : invitation directe aux amis acceptés non bloqués seulement, salon fermé au joueur bloqué par un membre ;
   - renfort d'un ami : la copie prêtée (marque rf / renfort) n'entre jamais dans un groupe (fonction serveur et base) ;
   - séries (×1, ×5, ×10 ou 1 à 10 combats) : série de 3 jouée jusqu'au bout, butin une fois par joueur et par combat, plafond 10,
     arrêt sur départ, déconnexion, défaite, transition ratée ou demande ; triche (rejouer, plus de 10, membre non chef) refusée.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/bureau_sql.test.js
   Sans IDLUS_PG (ou Node < 22.6), le test est sauté. La base « idlus_mono_bureau » est recréée puis effacée. */
"use strict";
const { execFileSync, spawnSync, spawn } = require("child_process");
const fs = require("fs"); const os = require("os"); const path = require("path"); const assert = require("assert");
const { pathToFileURL } = require("url");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
const [maj, min] = process.versions.node.split(".").map(Number);
// déploiement manuel seulement : le workflow « Serveur en ligne » ne connaît pas mono_bureau.sql
{ const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/supabase.yml"), "utf8"); const tous = (/tous="([^"]+)"/.exec(yml) || [])[1] || "";
  assert(tous.includes("supabase/schema.sql"), "liste des fichiers déployés introuvable"); assert(!/bureau/.test(tous), "mono_bureau.sql ne doit pas être déployé automatiquement"); }
if (!URL0) { console.log("ok - mono_bureau.sql hors du déploiement automatique (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
if (maj < 22 || (maj === 22 && min < 6)) { console.log("ok - (Node trop ancien : test sauté)"); process.exit(0); }
if (!process.execArgv.includes("--experimental-strip-types")) { // la fonction serveur est en TypeScript
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", __filename], { stdio: "inherit", env: process.env });
  process.exit(r.status == null ? 1 : r.status);
}

const DB = "idlus_mono_bureau";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64e6 }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const J = (i, s) => JSON.parse(as(i, `select (${s})::text`) || "null");
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
const lit = (v) => { if (v == null) return "null"; if (typeof v === "number") return String(v); if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return lit(JSON.stringify(v)) + "::jsonb"; let t = "q"; while (String(v).includes("$" + t + "$")) t += "x"; return `$${t}$${v}$${t}$`; };
// paramètres des fonctions des joueurs : une liste de textes est un text[]
const litA = (v) => (Array.isArray(v) && v.length && v.every((x) => typeof x === "string") ? `array[${v.map(lit).join(",")}]::text[]` : lit(v));
// plusieurs appels VRAIMENT en même temps (un psql par appel)
const race = (calls) => Promise.all(calls.map(([i, s, role]) => new Promise((res) => {
  const p = spawn("psql", [dbUrl, "-X", "-q", "-At", "-c", `set role ${role || "authenticated"}; set request.jwt.claim.sub = '${U(i)}'; select (${s})::text;`]);
  let o = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d)); p.on("close", () => res(o.trim()));
})));
const VER = "2.1.35";
const ok = (r, why) => { assert(r && r.ok && !r.err, why + " : " + JSON.stringify(r && (r.err || r))); return r; };
const err = (r, re, why) => { assert(r && r.err && re.test(r.err), why + " : " + JSON.stringify(r)); return r; };

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idlus-bureau-"));
  const REFUS = []; // scénarios de triche effectivement testés
  const refuse = (label, fn) => { fn(); REFUS.push(label); };
  try {
    q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
         if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if; end $$;
       create schema auth; grant usage on schema auth to anon, authenticated, service_role; create table auth.users (id uuid primary key);
       create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
       grant usage on schema public to anon, authenticated, service_role; create publication supabase_realtime;`);
    for (const f of ["schema.sql", "classements.sql", "chat.sql"]) file(path.join(ROOT, "supabase", f)); // amis.sql lit public.ignores (chat.sql)
    q(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
    // ordre de chargement unique (en tête de chaque fichier) : 1. monocompte.sql, 2. amis.sql, 3. mono_social.sql, 4. mono_bureau.sql
    file(path.join(ROOT, "supabase", "monocompte.sql")); file(path.join(ROOT, "supabase", "amis.sql")); file(path.join(ROOT, "supabase", "mono_social.sql"));
    const snap = () => q(`select md5(string_agg(x, E'\\n' order by x)) from (
        select 'T ' || table_name || ' ' || column_name || ' ' || data_type || ' ' || coalesce(column_default, '') x from information_schema.columns where table_schema = 'public'
        union all select 'P ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies where schemaname = 'public'
        union all select 'G ' || table_name || ' ' || grantee || ' ' || privilege_type from information_schema.role_table_grants where table_schema = 'public'
        union all select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname not like 'mono\\_%' and p.proname <> 'cosm_mine') s`);
    const before = snap();
    const monoAvant = q(`select md5(string_agg(p.oid::regprocedure::text || md5(p.prosrc), ',' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'public' and p.proname like 'mono\\_%' and p.proname not like 'mono\\_bureau%' and p.proname not like 'mono\\_adm\\_bureau%' and p.proname not like 'mono\\_srv\\_bureau%') or (n.nspname = 'mono' and p.proname not like 'bureau%' and p.proname not in ('defi_d12', 'bcfg', 'bn', 'bon_', 'bsec'))`);
    file(path.join(ROOT, "supabase", "mono_bureau.sql")); file(path.join(ROOT, "supabase", "mono_bureau.sql")); // relancé deux fois : sans danger
    assert.strictEqual(snap(), before, "le schéma public du Classique a changé");
    assert.strictEqual(q(`select md5(string_agg(p.oid::regprocedure::text || md5(p.prosrc), ',' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'public' and p.proname like 'mono\\_%' and p.proname not like 'mono\\_bureau%' and p.proname not like 'mono\\_adm\\_bureau%' and p.proname not like 'mono\\_srv\\_bureau%') or (n.nspname = 'mono' and p.proname not like 'bureau%' and p.proname not in ('defi_d12', 'bcfg', 'bn', 'bon_', 'bsec'))`), monoAvant,
      "mono_bureau.sql ne change que le crochet mono.defi_d12 (défi 12) : ni monocompte.sql, ni amis.sql, ni mono_social.sql");
    // relancer les fichiers d'avant (dans l'ordre) n'efface aucun crochet d'après : chaque fonction a un seul propriétaire
    const crochets = () => ["mono.defi_d12(uuid, integer)", "mono.defi_prog(uuid, integer, text)", "mono.apres_validation(uuid, integer, jsonb)", "mono.etat_social(uuid, integer)"]
      .map((f) => q(`select prosrc from pg_proc where oid = '${f}'::regprocedure`));
    const verifCrochets = (why) => { const [d12, prog, apres, social] = crochets();
      assert.match(d12, /bureau_d12/, why + " : défi 12 branché sur le Bureau"); assert.match(prog, /defi_d12/, why + " : mono.defi_prog lit le crochet du défi 12");
      assert.match(apres, /lb_saison/, why + " : mono.apres_validation de mono_social.sql"); assert.match(apres, /renfort_copier/, why + " : copie du renfort");
      assert.match(social, /renfort_log/, why + " : mono.etat_social de mono_social.sql"); };
    verifCrochets("quatre fichiers chargés");
    for (const f of ["monocompte.sql", "amis.sql", "mono_social.sql"]) { file(path.join(ROOT, "supabase", f)); verifCrochets(f + " relancé après mono_bureau.sql"); }
    { // aucune fonction définie (avec son vrai corps) dans deux des quatre fichiers : les crochets vides de monocompte.sql sont
      // créés par « execute » seulement s'ils manquent
      const own = {}; const dbl = [];
      for (const f of ["monocompte.sql", "amis.sql", "mono_social.sql", "mono_bureau.sql"])
        for (const m of fs.readFileSync(path.join(ROOT, "supabase", f), "utf8").matchAll(/^create (?:or replace )?function ([a-z_]+\.[a-z_0-9]+)/gm)) {
          if (own[m[1]] && own[m[1]] !== f) dbl.push(m[1] + " : " + own[m[1]] + " et " + f); own[m[1]] = own[m[1]] || f; }
      assert.deepStrictEqual(dbl, [], "fonctions définies dans deux fichiers"); }
    assert.strictEqual(q(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mono\\_srv\\_bureau\\_%'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'))`), "0", "mono_srv_bureau_* : service_role seulement");
    assert.strictEqual(q(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'mono\\_bureau\\_%' or p.proname like 'mono\\_adm\\_bureau%')
      and (has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('authenticated', p.oid, 'execute'))`), "0", "mono_bureau_* : joueurs connectés seulement");
    console.log("ok - ordre monocompte.sql → amis.sql → mono_social.sql → mono_bureau.sql : relançables, crochets gardés (défi 12, classements, renfort), Classique intact, droits d'appel");

    q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 12) i;
       insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users;
       delete from admins; insert into admins values ('${U(9)}');`); // classements.sql fait du premier profil un admin : Mathis = 9 ici
    // amis acceptés (supabase/amis.sql, les deux lignes) : 12 et 1, 5 et 1
    q(`insert into public.amis (user_id, ami, srv) values ('${U(12)}', '${U(1)}', 'm'), ('${U(1)}', '${U(12)}', 'm'), ('${U(5)}', '${U(1)}', 'm'), ('${U(1)}', '${U(5)}', 'm')`); // amis du Monocompte (3B)
    J(9, `mono_adm_saison(0, 'Saison de test', '2026-10-19 00:00 Europe/Paris', true, 'ouverte')`);
    for (const i of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]) as(9, `select mono_adm_testeur('Joueur${String(i).padStart(2, "0")}', true)`);
    const DEBUT = Date.parse("2026-10-18T22:00:00Z");
    let now = DEBUT + 43 * 86400e3 + 10 * 3600e3; // jour 44 : manche IV (défi 12)
    const at = (t) => { now = t; q(`update mono.saisons set clk_t = to_timestamp(${t / 1000}), clk_ref = now(), clk_pause = true where id = 0`); };
    at(now);

    /* ---------- la fonction serveur « mono », sans Deno ---------- */
    execFileSync(process.execPath, [path.join(ROOT, "tools/build_server.js")], { stdio: "pipe" });
    const game = JSON.stringify(path.join(ROOT, "supabase/functions/mono/game.js"));
    const src = fs.readFileSync(path.join(ROOT, "supabase/functions/mono/index.ts"), "utf8");
    const fake = `
const createClient = () => ({ auth: { getUser: async (j) => ({ data: { user: j ? { id: j } : null } }) },
  rpc: async (name, a) => { try { const r = globalThis.__RPC(name, a); return { data: r, error: null }; } catch (e) { if (process.env.DBG) console.error("RPC", name, String(e.stderr || e.message).slice(0, 800)); return { data: null, error: { message: String(e.stderr || e.message) } }; } } });
let H = null; globalThis.Deno = { serve(h) { H = h; }, env: { get() { return "x"; } } };
globalThis.__CALL = async (uid, body) => (await H(new Request("http://x/", { method: "POST", headers: { Authorization: "Bearer " + uid }, body: JSON.stringify(body) }))).json();
`;
    const tmp = path.join(dir, "mono.mts");
    fs.writeFileSync(tmp, fake + `import { D, E, V } from ${game};\nglobalThis.__GAME = { D, E, V };\n` + src.replace(/^import .*$/gm, ""));
    const RPC = [];
    globalThis.__RPC = (name, a) => {
      assert(/^mono_srv_/.test(name), "la fonction n'appelle que les fonctions mono_srv_* : " + name); RPC.push(name);
      const args = Object.keys(a || {}).map((k) => `${k} => ${lit(a[k])}`).join(", ");
      if (name === "mono_srv_refus") { run(`set role service_role; select public.${name}(${args});`); return null; }
      return JSON.parse(run(`set role service_role; select coalesce(to_jsonb(public.${name}(${args})), 'null'::jsonb)::text;`));
    };
    await import(pathToFileURL(tmp).href);
    const { D, E, V } = globalThis.__GAME; const call = globalThis.__CALL; const BC = E.BUREAU;
    assert(BC && BC.combat, "js/bureau_combat.js dans le module du serveur");
    E.setRng((() => { let s = 7; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })());
    E.weekly = () => null; E.flash = () => [];
    const clk = () => E.setClock(() => now);
    clk();

    /* ---------- les joueurs : un héros niveau 40 chacun, validé par le Bouclier ---------- */
    const DJ = "crypte_kardorim", KEY = D.DUNGEONS[DJ].key, DJ2 = "donjon_tofus";
    const P = {};
    const hero = (S) => S.chars.find((c) => !c.merc);
    const newGame = (i, cls) => {
      clk(); const S = E.monoStart(E.newState("Héros" + i, cls)); S.mono.t0 = DEBUT; E.monoBoot(S); E.MONO.saisons[S.mono.s].debut = DEBUT;
      const c = hero(S); c.lvl = 40; c.inTeam = true; E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
      S.kamas = 50000; S.res = Object.assign(S.res || {}, { [KEY]: 5, [D.DUNGEONS[DJ2].key]: 2 });
      S.stats = S.stats || {}; S.stats.playtime = 60 * 3600; E.stasisInfo(S, DJ).max = 3;
      return S;
    };
    const send = async (i, S, o = {}) => {
      clk(); const p = P[i] || (P[i] = {});
      const r = await call(U(i), { push: { data: E.serialize(S), meta: {}, version: VER, device: "pc", expected: o.expected !== undefined ? o.expected : p.base || null, force: !!o.force } });
      clk(); if (r.at) p.base = r.at;
      if (r.verif && r.verif.registre) E.tfSrvSet(S, r.verif.registre);
      return r;
    };
    const apply = (S, ops) => { S.hdv = S.hdv || { op: 0, log: [] };
      for (const o of (ops || []).slice().sort((a, b) => a.id - b.id)) { if (o.id <= (S.hdv.op || 0)) continue; const p = o.p || {};
        if (p.k) S.kamas = Math.max(0, Math.round((S.kamas || 0) + Number(p.k)));
        ["res", "runes", "cons"].forEach((b) => { if (!p[b]) return; S[b] = S[b] || {}; for (const k in p[b]) { const v = (S[b][k] || 0) + Number(p[b][k]); if (v > 0) S[b][k] = v; else delete S[b][k]; } });
        if (p.tdj) E.tdjUse(S, String(p.tdj.did || ""), String(p.tdj.d || "")); // 2.1.39 : comme MARKET.apply (js/market.js)
        S.hdv.op = o.id; } };
    const sync = (i) => { const r = J(i, `mono_hdv_sync(${(P[i].S.hdv && P[i].S.hdv.op) || 0})`); apply(P[i].S, r.ops); return r; };
    const CLS = { 1: "iop", 2: "cra", 3: "eni", 4: "feca", 5: "sram", 6: "osa", 10: "iop", 11: "cra", 12: "eni" };
    for (const i of [1, 2, 3, 4, 5, 6, 10, 11, 12]) { P[i] = { S: newGame(i, CLS[i]) }; const r = await send(i, P[i].S); assert(r.ok && r.verif && r.verif.ok, `joueur ${i} : ${JSON.stringify(r)}`); }
    const app = (i) => "appareil-" + String(i).padStart(4, "0");
    const etat = (i, o) => J(i, `mono_bureau_etat(${lit(o || null)}, '${app(i)}')`);
    const B = (i, f, ...a) => J(i, `mono_bureau_${f}(${a.map(litA).join(", ")})`);
    const chercher = (i, ds, k, flex, auto = true, appareil) => B(i, "chercher", ds, k, flex, auto, VER, appareil || app(i));
    // Bouclier + crochets sociaux ensemble : chaque partie validée passe par mono.apres_validation de mono_social.sql
    assert.strictEqual(+q(`select count(*) from mono.lb_saison where saison = 0`), 9, "classements de saison tenus après chaque validation du Bouclier");
    console.log("ok - 9 héros validés par le Bouclier (fonction « mono »), classements de saison tenus par mono_social.sql");

    /* ---------- accès : non testeur, anon, écritures directes, fonctions du serveur ---------- */
    for (const f of ["mono_bureau_etat()", "mono_bureau_chercher(array['crypte_kardorim'], 1, 0, true, '1')", "mono_bureau_salons()", "mono_bureau_expeditions()", "mono_bureau_rdv()", "mono_bureau_butin(1)"])
      refuse("non testeur : " + f, () => fails(() => as(8, `select ${f}`), /réservé aux testeurs/, "non testeur : " + f));
    for (const s of ["select mono_bureau_etat()", "select * from mono.bureau_salons"]) refuse("anon : " + s, () => fails(() => q(`set role anon; ${s}`), /permission denied/, "anon : " + s));
    const direct = ["insert into mono.bureau_membres (salon, user_id) values (1, auth.uid())", "update mono.bureau_combats set win = true", "insert into mono.bureau_butins (combat, user_id) values (1, auth.uid())",
      "select * from mono.bureau_recherches", "update mono.bureau_reglages set v = 'true' where cle = 'mp'", "select mono.bureau_menage()", "select mono.bureau_rencontre(auth.uid())",
      "select mono_srv_bureau_photos(auth.uid(), 1)", "select mono_srv_bureau_resultat(1, '[]', '{\"done\": true}', 1000, null, '[]')", "select mono_srv_bureau_horloge()", "select mono_srv_bureau_mp(10)",
      "select mono.bureau_d12(auth.uid(), 0)"];
    for (const s of direct) refuse("écriture ou lecture directe : " + s.slice(0, 60), () => fails(() => as(1, s), /permission denied/, "direct : " + s));
    refuse("réglage changé par un joueur", () => fails(() => as(1, `select mono_adm_bureau_reglage('rdv', 'true')`), /réservé à Mathis/, "réglage par un joueur"));
    console.log("ok - non testeur, anon, écritures directes et fonctions du serveur refusés");

    /* ---------- compte pas encore validé, suspendu, en vérification ---------- */
    err(chercher(7, [DJ], 1, 0), /pas encore validé/, "héros jamais validé");
    q(`update profiles set suspended_at = now() where id = '${U(10)}'`); refuse("compte suspendu", () => err(chercher(10, [DJ], 1, 0), /suspendu/, "suspendu"));
    q(`update profiles set suspended_at = null where id = '${U(10)}'`);
    q(`insert into mono.bouclier (user_id, saison, why) values ('${U(10)}', 0, 'test')`); refuse("partie en vérification", () => err(chercher(10, [DJ], 1, 0), /vérification/, "en vérification"));
    q(`delete from mono.bouclier where user_id = '${U(10)}'`);
    console.log("ok - héros non validé, compte suspendu, partie en vérification : ni recherche ni salon");

    /* ---------- recherche automatique : plusieurs donjons, le donjon qui réunit le plus de joueurs, chef = le plus ancien ---------- */
    let e1 = ok(chercher(1, [DJ, DJ2], 1, 1), "recherche 1"); assert.strictEqual(e1.salon, null); assert(e1.recherche && e1.recherche.compatibles === 0);
    ok(chercher(2, [DJ2], 9, 0), "recherche 2 (stasis 9 exacte : incompatible)");
    assert.strictEqual(etat(1).recherche.compatibles, 0, "stasis 9 ±0 et 1 ±1 ne se croisent pas");
    assert.strictEqual(etat(1).compteurs.total, 2);
    ok(chercher(2, [DJ2], 2, 1), "2 élargit sa recherche");
    // 1..2 ∩ 1..3 = 1..2, mais personne n'a réussi la stasis 1 du donjon des Tofus : la stasis 2 n'est pas possible (4A), salon en stasis 1
    let s1 = etat(1); assert(!s1.recherche && s1.invitations.length === 1 && s1.invitations[0].did === DJ2 && s1.invitations[0].stasis === 1, "salon proposé à 1 : " + JSON.stringify(s1.invitations));
    const sid1 = s1.invitations[0].salon;
    assert.strictEqual(q(`select chef = '${U(1)}' from mono.bureau_salons where id = ${sid1}`), "t", "chef = celui qui cherchait depuis le plus longtemps");
    assert.strictEqual(+q(`select count(*) from mono.bureau_recherches where user_id in ('${U(1)}', '${U(2)}')`), 0, "recherches retirées quand l'invitation part");
    // un seul « oui » : pas de salon à 1, celui qui a accepté retourne en tête de recherche, l'autre sort
    const dep1 = q(`select recherche ->> 'depuis' from mono.bureau_invitations where salon = ${sid1} and user_id = '${U(1)}'`);
    ok(B(1, "repondre", s1.invitations[0].id, true, VER, app(1)), "1 accepte");
    q(`update mono.bureau_invitations set expire_at = now() - interval '1 second' where salon = ${sid1}`);
    s1 = etat(1); assert(!s1.salon && s1.recherche && s1.recherche.depuis === dep1, "1 seul oui : 1 retourne en tête de recherche " + JSON.stringify(s1.recherche));
    const s2 = etat(2); assert(!s2.salon && !s2.recherche && s2.manquees.length === 1, "2 n'a pas répondu : hors recherche, invitation manquée visible");
    assert.strictEqual(q(`select etat from mono.bureau_salons where id = ${sid1}`), "ferme");
    console.log("ok - cas limites : 1 « oui » sur 2, recherche rendue en tête, invitation manquée visible, salon jamais à 1");

    // trois joueurs, deux donjons : le serveur choisit celui qui réunit le plus de joueurs, puis la stasis commune la plus haute (4A)
    // 4 attend déjà (recherche posée sans rencontre automatique, puis rendue automatique), 3 arrive en dernier
    ok(chercher(4, [DJ], 3, 2, false), "4"); q(`update mono.bureau_recherches set auto = true where user_id = '${U(4)}'`);
    ok(chercher(3, [DJ, DJ2], 2, 1), "3");
    // 1 (le plus ancien, DJ et DJ2, stasis 1 ±1), 3 (DJ/DJ2 2 ±1), 4 (DJ 3 ±2) : DJ réunit 1, 3, 4 ; stasis commune 1..2 → 2
    let s3 = etat(3); assert(s3.invitations.length === 1 && s3.invitations[0].did === DJ && s3.invitations[0].stasis === 2 && s3.invitations[0].membres.length === 2, "groupe à 3 sur DJ : " + JSON.stringify(s3.invitations));
    const sidA = s3.invitations[0].salon;
    assert.strictEqual(q(`select chef = '${U(1)}' from mono.bureau_salons where id = ${sidA}`), "t");
    for (const i of [1, 3, 4]) ok(B(i, "repondre", etat(i).invitations[0].id, true, VER, app(i)), "accepte " + i);
    let sa = etat(1).salon; assert(sa && sa.etat === "ouvert" && sa.membres.length === 3 && sa.chef === U(1), "salon formé à 3 : " + JSON.stringify(sa && sa.etat));
    assert(Date.parse(sa.attente_fin) - Date.parse(sa.cree) === 120000, "attente conseillée de 2 minutes");
    console.log("ok - plusieurs donjons communs : celui du plus de joueurs, stasis commune la plus haute, chef le plus ancien");

    /* ---------- deux comptes du même appareil : jamais dans le même salon (5A), paire autorisée par Mathis ---------- */
    ok(chercher(5, [DJ2], 1, 0), "5"); ok(chercher(6, [DJ2], 1, 0, true, app(5)), "6 sur l'appareil de 5");
    refuse("même appareil dans le même salon", () => assert(!etat(5).invitations.length && !etat(6).invitations.length, "même appareil : pas de groupe"));
    const adm = J(9, `mono_adm_bureau()`); assert(adm.appareils.some((x) => [x.a, x.b].sort().join() === ["Joueur05", "Joueur06"].join()), "panneau : comptes vus sur un même appareil");
    J(9, `mono_adm_bureau_paire('${U(5)}', '${U(6)}', true)`);
    ok(chercher(6, [DJ2], 1, 0, true, app(5)), "6 recherche de nouveau");
    const s6 = etat(6); assert(s6.invitations.length === 1, "paire autorisée par Mathis : groupe possible");
    for (const i of [5, 6]) B(i, "repondre", etat(i).invitations[0].id, false);
    J(9, `mono_adm_bureau_paire('${U(5)}', '${U(6)}', false)`);
    console.log("ok - deux comptes du même appareil jamais ensemble, sauf décision de Mathis dans son panneau");

    /* ---------- vie du salon : proposition, prêt, version, donjon solo (1B), stasis (4A), chef ---------- */
    refuse("proposer sans être chef", () => err(B(3, "proposer", DJ, 1, KEY, VER), /Seul le chef/, "proposer sans être chef"));
    refuse("stasis sans membre qui a réussi la précédente", () => err(B(1, "proposer", DJ, 6, KEY, VER), /réussi la stasis 5/, "4A"));
    ok(B(1, "proposer", DJ, 2, KEY, VER), "le chef propose stasis 2");
    refuse("« Prêt » avec une autre version du jeu", () => err(B(3, "pret", true, "2.0.0", false), /Version du jeu différente/, "version"));
    refuse("« Prêt » pendant un donjon solo (1B)", () => err(B(3, "pret", true, VER, true), /donjon solo/, "1B"));
    for (const i of [1, 3, 4]) ok(B(i, "pret", true, VER, false), "prêt " + i);
    refuse("lancer sans être chef", () => err(B(3, "lancer"), /Seul le chef/, "lancer sans être chef"));
    // le chef change la proposition : tout le monde doit reconfirmer « Prêt »
    ok(B(1, "proposer", DJ, 1, KEY, VER), "proposition changée"); assert(etat(1).salon.membres.every((m) => !m.pret), "prêts remis à zéro");
    for (const i of [1, 3, 4]) ok(B(i, "pret", true, VER, false), "prêt " + i);
    console.log("ok - proposition du chef, « Prêt » refusé (version, donjon solo 1B, stasis 4A), nouvelles confirmations");

    /* ---------- deux joueurs sur la dernière place en même temps ---------- */
    ok(B(1, "reglage_salon", true, false), "salon public, sans remplaçants");
    const lst = J(10, `mono_bureau_salons()`); assert(lst.some((x) => x.id === sidA && x.n === 3), "liste des salons ouverts : " + JSON.stringify(lst));
    const R2 = await race([[10, `mono_bureau_rejoindre(${sidA}, '${VER}', '${app(10)}')`], [11, `mono_bureau_rejoindre(${sidA}, '${VER}', '${app(11)}')`]]);
    const okN = R2.filter((x) => /"ok": true/.test(x)).length, plein = R2.filter((x) => /Salon complet/.test(x)).length;
    refuse("deux joueurs sur la dernière place", () => assert(okN === 1 && plein === 1, "dernière place : " + JSON.stringify(R2)));
    const quatre = etat(1).salon.membres.map((m) => m.user); assert.strictEqual(quatre.length, 4);
    const enPlus = quatre.includes(U(10)) ? 10 : 11, dehors = enPlus === 10 ? 11 : 10;
    refuse("rejoindre un salon plein", () => err(B(12, "rejoindre", sidA, VER, app(12)), /complet/, "salon plein"));
    refuse("deux salons à la fois", () => err(B(enPlus, "creer", DJ, 1, true, VER, app(enPlus)), /déjà dans un salon/, "deux salons"));
    console.log("ok - deux joueurs sur la dernière place en même temps : un seul la prend ; salon plein refusé");

    /* ---------- même compte dans deux onglets : une seule place, le second regarde ---------- */
    etat(enPlus, "ongletA"); const sp = etat(enPlus, "ongletB"); assert(sp.spectateur, "second onglet : spectateur");
    refuse("action depuis un second onglet", () => err(B(enPlus, "pret", true, VER, false, "ongletB"), /autre onglet/, "second onglet"));
    ok(B(enPlus, "pret", true, VER, false, "ongletA"), "prêt depuis le bon onglet");

    /* ---------- lancement : tous les présents prêts, transition de 60 s, photo après une dernière sauvegarde ---------- */
    // un joueur absent (pas de signe de vie depuis 30 s) : le combat part sans lui, il garde sa place 2 minutes
    q(`update mono.bureau_membres set vu_at = now() - interval '30 seconds' where user_id = '${U(4)}'`);
    const L1 = await race([[1, `mono_bureau_lancer()`], [1, `mono_bureau_lancer()`]]);
    refuse("double lancement", () => assert(L1.filter((x) => /"ok": true/.test(x)).length === 1 && L1.filter((x) => /"err": "[^"]*(déjà en cours|transition)/i.test(x)).length === 1, "double lancement : " + JSON.stringify(L1)));
    let c1 = etat(1).salon.combat; assert(c1 && c1.etat === "transition" && c1.membres.length === 3 && !c1.membres.some((m) => m.user === U(4)), "le combat part sans l'absent : " + JSON.stringify(c1));
    assert(etat(1).salon.membres.some((m) => m.user === U(4) && !m.present && m.place_fin), "l'absent garde sa place");
    refuse("changer la proposition pendant la transition", () => err(B(1, "proposer", DJ2, 1, null, VER), /transition/, "proposition pendant la transition"));
    refuse("confirmer sans partie validée depuis le lancement", () => err(B(1, "confirmer"), /pas encore validée/, "photo d'avant le lancement"));
    // un remplaçant qui arrive pendant le compte à rebours attend le combat suivant
    // (le salon est plein : 4 quitte, 12 entre)
    ok(B(4, "quitter"), "4 quitte"); ok(B(12, "rejoindre", sidA, VER, app(12)), "12 arrive pendant la transition");
    assert(!etat(1).salon.combat.membres.some((m) => m.user === U(12)), "remplaçant : attend le combat suivant");
    err(B(12, "confirmer"), /combat suivant/, "remplaçant pas dans ce combat");
    // héros modifié par le navigateur après sa validation : envoi direct (sans Bouclier) d'un héros niveau 200
    const forged = E.deserialize(E.serialize(P[3].S)); hero(forged).lvl = 200;
    for (const i of [1, 3, enPlus]) { const r = await send(i, P[i].S); assert(r.verif && r.verif.ok, "sauvegarde avant le combat " + i + " " + JSON.stringify(r.verif)); }
    q(`select pg_sleep(0.01)`);
    const atF = as(3, `select mono_push(${lit(E.serialize(forged))}, '{}', '${VER}', 'pc', '${P[3].base}')`); assert(atF, "partie brute modifiée");
    P[3].base = atF.replace(/^"|"$/g, ""); // la prochaine sauvegarde honnête de 3 remplace la partie brute
    let cf = null; for (const i of [1, 3, enPlus]) cf = ok(B(i, "confirmer"), "confirmer " + i);
    assert(cf.calcul, "tout le monde a confirmé : le serveur peut jouer le combat");
    // photo forgée : le jeu n'envoie jamais de photo (la route n'en lit aucune)
    const forgedSnap = [Object.assign(E.monoSnap(forged, hero(forged)), { n: "Tricheur" })];
    const t0 = Date.now();
    const F1 = await call(U(1), { bureau: { combat: c1.id, snaps: forgedSnap, seed: 1, did: DJ2, stasis: 15 } });
    const calcMs = Date.now() - t0;
    assert(F1.ok && F1.combat === c1.id && F1.fin, "combat joué par le serveur : " + JSON.stringify(F1));
    const F1b = await call(U(3), { bureau: { combat: c1.id } }); assert(F1b.ok && F1b.deja, "second appel : déjà calculé, rien de plus");
    const row = JSON.parse(q(`select to_jsonb(c) - 'result' - 'snaps' from mono.bureau_combats c where id = ${c1.id}`)); const snaps = JSON.parse(q(`select snaps from mono.bureau_combats where id = ${c1.id}`));
    assert.strictEqual(row.did, DJ); assert.strictEqual(row.stasis, 1);
    refuse("photo forgée envoyée par le jeu", () => assert(snaps.length === 3 && !snaps.some((x) => x.n === "Tricheur"), "photos du serveur seulement"));
    refuse("héros modifié après sa validation", () => assert(snaps.every((x) => x.lvl === 40), "photo = partie validée (niveau 40), jamais la partie brute : " + snaps.map((x) => x.lvl)));
    // même combat côté jeu et côté serveur (mêmes photos, même graine)
    const res0 = JSON.parse(q(`select result from mono.bureau_combats where id = ${c1.id}`));
    const V1 = BC.voir(q(`select snaps from mono.bureau_combats where id = ${c1.id}`), DJ, 1, +row.seed, etat(1).salon.combat.at);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(BC.resume(V1.R))), res0, "même combat côté jeu et serveur");
    assert.strictEqual(V1.frames.length * 1000, res0.t, "une image par seconde de combat");
    assert.strictEqual(Date.parse(row.fin_at) - Date.parse(row.debut_at), res0.t, "heure de fin = départ + durée du combat");
    assert(calcMs < 10000, "temps de calcul sous la limite de 10 s : " + calcMs + " ms");
    assert.strictEqual(q(`select etat from mono.bureau_salons where id = ${sidA}`), "combat");
    console.log(`ok - combat de groupe joué par le serveur : ${res0.rooms.length} salles, ${res0.done ? "victoire" : "défaite"}, ${res0.t / 1000} s de combat, calcul ${calcMs} ms ; même combat côté jeu`);

    /* ---------- pendant le combat : quitter (butin gardé), pas de nouveau lancement, pas de « Prêt » ---------- */
    refuse("lancer pendant un combat", () => err(B(1, "lancer"), /Combat déjà en cours/, "lancer pendant le combat"));
    err(B(12, "pret", true, VER, false), /Combat en cours/, "prêt pendant le combat");
    ok(B(enPlus, "quitter"), "quitter pendant le combat : le héros finit en automatique");
    refuse("butin avant la fin du combat", () => err(B(1, "butin", c1.id), /pas fini/, "butin avant la fin"));
    refuse("butin d'un combat auquel on n'a pas pris part", () => err(B(12, "butin", c1.id), /Aucun butin/, "butin d'un autre"));
    // 2.1.39 « Trousseau du jour » (4A) : premier combat du jour dans ce donjon = l'entrée du jour de chacun (une opération du serveur), pas de clé
    assert.strictEqual(+q(`select count(*) from mono.ops where saison = 0 and payload -> 'tdj' ->> 'did' = '${DJ}' and payload -> 'tdj' ->> 'd' = mono.bureau_tdj_jour(0)`), 3, "entrée du jour prise par joueur du combat");
    assert.strictEqual(+q(`select count(*) from mono.ops where saison = 0 and payload -> 'res' ->> '${KEY.replace(/'/g, "''")}' = '-1'`), 0, "aucune clé pour le premier combat du jour");
    { const lib = (i, did) => q(`select mono.bureau_tdj_libre('${U(i)}', 0, (select data::jsonb from mono.parties_ok where user_id = '${U(i)}' and saison = 0), '${did}')`);
      assert.strictEqual(lib(1, DJ), "f", "entrée du jour prise : plus libre aujourd'hui (opération pas encore reprise par la partie)");
      assert.strictEqual(lib(1, "grange_tournesol"), "t", "les autres donjons gardent leur entrée du jour");
      assert.strictEqual(q(`select mono.bureau_tdj_libre('${U(1)}', 0, jsonb_build_object('tdj', jsonb_build_object('d', mono.bureau_tdj_jour(0), 'u', jsonb_build_object('grange_tournesol', 1))), 'grange_tournesol')`), "f", "prise en solo (partie validée) : plus libre"); }
    // le combat se termine (on avance l'heure de fin)
    q(`update mono.bureau_combats set debut_at = debut_at - interval '1 hour', fin_at = now() - interval '1 second' where id = ${c1.id}`);
    sa = etat(1).salon; assert(sa.etat === "ouvert" && sa.membres.every((m) => !m.pret), "combat fini : salon ouvert, chacun reconfirme « Prêt »");
    // butin : une seule fois, même pour celui qui est parti pendant le combat
    for (const i of [1, 3, enPlus]) {
      assert(etat(i).butins.some((b) => b.combat === c1.id), "butin à récupérer " + i);
      const b = ok(B(i, "butin", c1.id), "butin " + i); assert.strictEqual(b.ids.length, 2, "les deux autres joueurs (défi 12)");
      sync(i); assert.strictEqual(P[i].S.res[KEY], 5, "clé gardée : l'entrée du jour a servi (partie " + i + ")"); assert(E.tdj(P[i].S).u[DJ], "entrée du jour marquée prise dans la partie " + i);
      const lvl0 = hero(P[i].S).lvl; const got = BC.butin(P[i].S, b); assert(got, "butin appliqué " + i);
      assert(!BC.butin(P[i].S, b), "le même butin n'est jamais appliqué deux fois dans la partie");
      P[i].S.stats.playtime += 300;
      const r = await send(i, P[i].S); assert(r.verif && r.verif.ok, `aucun faux refus du Bouclier après le butin du groupe (${i}) : ` + JSON.stringify(r) + " " + q(`select why from mono.bouclier where user_id = '${U(i)}' order by id desc limit 1`));
      assert(hero(P[i].S).lvl >= lvl0);
    }
    refuse("butin récupéré deux fois", () => err(B(1, "butin", c1.id), /déjà récupéré/, "butin deux fois"));
    const twice = await race([[3, `mono_bureau_butin(${c1.id})`], [3, `mono_bureau_butin(${c1.id})`]]); assert(twice.every((x) => /déjà récupéré/.test(x)));
    console.log("ok - butin individuel récupéré une seule fois (même parti pendant le combat), clés retirées, Bouclier sans faux refus");

    /* ---------- victoire en manche IV : bons « donjons en groupe » et défi 12 comptés par le serveur ---------- */
    if (res0.done) {
      for (const i of [1, 3, enPlus]) assert.strictEqual(+q(`select count(*) from mono.bons where user_id = '${U(i)}' and combat = 'g:${c1.id}'`), 1, "un bon par joueur et par combat");
      assert.strictEqual(+q(`select mono.bureau_d12('${U(1)}', 0)`), 2, "défi 12 : 2 joueurs différents");
      assert.strictEqual(+q(`select mono.defi_prog('${U(1)}', 0, 'd12')`), 2, "défi 12 lu par le serveur");
      assert.strictEqual(+q(`select count(*) from mono.eclats where user_id = '${U(1)}' and source = 'defi:d12:0'`), 1, "palier de bronze du défi 12 payé (2 joueurs)");
    } else console.log("   (défaite : bons et défi 12 vérifiés au combat suivant)");

    /* ---------- transition ratée : lancement annulé pour tous, ceux qui n'ont pas confirmé ne sont plus prêts ---------- */
    // le salon : 1 (chef), 3, 12
    for (const i of [1, 3, 12]) ok(B(i, "pret", true, VER, false), "prêt " + i);
    const c2 = ok(B(1, "lancer"), "nouveau lancement").combat;
    assert.deepStrictEqual(etat(1).salon.combat.membres.map((m) => m.user).sort(), [U(1), U(3), U(12)].sort(), "le remplaçant est dans le combat suivant");
    for (const i of [1, 3]) { await send(i, P[i].S); ok(B(i, "confirmer"), "confirmer " + i); }
    q(`update mono.bureau_combats set transition_fin = now() - interval '1 second' where id = ${c2}`);
    sa = etat(1).salon; assert(sa.etat === "ouvert" && !sa.combat || sa.combat.id !== c2, "transition dépassée : annulée");
    assert.deepStrictEqual(sa.membres.filter((m) => m.pret).map((m) => m.user).sort(), [U(1), U(3)].sort(), "les autres restent prêts, celui qui n'a pas confirmé ne l'est plus");
    assert.strictEqual(q(`select etat from mono.bureau_combats where id = ${c2}`), "annule");
    refuse("photos d'un lancement annulé", () => { const r = JSON.parse(run(`set role service_role; select mono_srv_bureau_photos('${U(1)}', ${c2})::text;`)); assert(r.err, JSON.stringify(r)); });
    console.log("ok - transition de 60 s ratée : lancement annulé pour tous, seuls les autres restent prêts");

    /* ---------- départ du combat refusé par le serveur (règle 4A : donjon pas débloqué) ---------- */
    ok(B(12, "pret", true, VER, false), "prêt 12");
    const c3 = ok(B(1, "lancer"), "lancement").combat;
    for (const i of [1, 3, 12]) { if (i === 12) { P[12].S.dungeon = { id: DJ2, room: 0, stasis: 1 }; } const r = await send(i, P[i].S); assert(r.verif.ok, "envoi " + i + " " + JSON.stringify(r.verif)); ok(B(i, "confirmer"), "confirmer " + i); }
    const F3 = await call(U(3), { bureau: { combat: c3 } });
    refuse("donjon solo en cours dans la photo (1B)", () => assert(F3.annule && /12 : donjon solo en cours/.test(F3.why), "1B côté serveur : " + JSON.stringify(F3)));
    sa = etat(1).salon; assert(sa.etat === "ouvert" && !sa.membres.find((m) => m.user === U(12)).pret && sa.membres.find((m) => m.user === U(3)).pret, "seul le joueur fautif n'est plus prêt");
    delete P[12].S.dungeon; await send(12, P[12].S);
    console.log("ok - le serveur refuse un départ qui enfreint 1B (donjon solo dans la partie validée)");

    /* ---------- triche : héros prêté en renfort par un ami (copie « rf » du serveur, mono_social.sql) dans la photo ---------- */
    for (const i of [12]) ok(B(i, "pret", true, VER, false), "prêt " + i);
    const c4 = ok(B(1, "lancer"), "lancement").combat;
    for (const i of [1, 3, 12]) { const r = await send(i, P[i].S); assert(r.verif.ok, "envoi " + i); ok(B(i, "confirmer"), "confirmer " + i); }
    // la partie validée de 12 présente comme son héros la copie d'un ami prêtée en renfort
    const fr = E.deserialize(q(`select data from mono.parties_ok where user_id = '${U(12)}'`)); Object.assign(hero(fr), { rf: 1, renfort: { u: U(2) } });
    q(`update mono.parties_ok set data = ${lit(E.serialize(fr))} where user_id = '${U(12)}'`);
    const F4 = await call(U(1), { bureau: { combat: c4 } });
    refuse("héros prêté en renfort dans le groupe", () => assert(F4.annule && /12 : héros prêté en renfort/.test(F4.why) && q(`select snaps is null from mono.bureau_combats where id = ${c4}`) === "t", "renfort côté serveur : " + JSON.stringify(F4)));
    await send(12, P[12].S);
    console.log("ok - triche : héros prêté en renfort refusé par le serveur dans un groupe de joueurs");

    /* ---------- renfort d'un ami (mono_social.sql) : la copie prêtée n'entre jamais dans un groupe ---------- */
    ok(J(1, `mono_renfort_publier()`), "1 prête son héros (copie tirée de sa partie validée)");
    const rf = ok(J(12, `mono_renfort_prendre('${U(1)}', '${DJ}', 1)`), "12 prend le renfort de 1 en donjon solo");
    assert(rf.snap && rf.snap.rf === 1, "copie de renfort marquée rf : " + JSON.stringify(rf.snap && Object.keys(rf.snap)));
    refuse("renfort d'un ami demandé pour un groupe", () => err(J(12, `mono_renfort_prendre('${U(1)}', '${DJ}', 1, null, 'bureau')`), /pas en groupe/, "renfort en groupe"));
    // (a) partie validée dont le héros est la copie du renfort (le Bouclier l'aurait laissée passer) : la fonction serveur refuse
    for (const i of [1, 3, 12]) ok(B(i, "pret", true, VER, false), "prêt " + i);
    const c5 = ok(B(1, "lancer"), "lancement").combat;
    for (const i of [1, 3, 12]) { await send(i, P[i].S); ok(B(i, "confirmer"), "confirmer " + i); }
    const vrai12 = q(`select data from mono.parties_ok where user_id = '${U(12)}' and saison = 0`);
    const dg = E.deserialize(E.serialize(P[12].S)); Object.assign(hero(dg), { renfort: { u: U(1), p: "Joueur01" }, snap: rf.snap });
    q(`update mono.parties_ok set data = ${lit(E.serialize(dg))} where user_id = '${U(12)}' and saison = 0`);
    const F5 = await call(U(3), { bureau: { combat: c5 } });
    q(`update mono.parties_ok set data = ${lit(vrai12)} where user_id = '${U(12)}' and saison = 0`);
    refuse("copie de renfort rendue par le serveur (renfort + snap) portée par le héros", () => assert(F5.annule && /12 : héros prêté en renfort/.test(F5.why), "renfort côté serveur : " + JSON.stringify(F5)));
    assert.strictEqual(+q(`select count(*) from mono.bureau_butins where combat = ${c5}`), 0, "aucun butin");
    // (b) photos envoyées à la base avec la copie (rf), un mercenaire, ou une photo de trop : refusées par mono_srv_bureau_resultat
    const vraies = BC.combat(V.mono, JSON.parse(run(`select jsonb_agg(jsonb_build_object('user', user_id, 'data', data) order by user_id)::text from mono.parties_ok where user_id in ('${U(1)}', '${U(3)}', '${U(12)}') and saison = 0`)), DJ, 1, 1, Date.now());
    assert(vraies.snaps, "photos honnêtes : " + JSON.stringify(vraies.exclus || vraies.err));
    const ph = JSON.parse(vraies.snaps);
    const triches = [["photo de la copie du renfort (rf)", [ph[0], ph[1], rf.snap]], ["photo d'un mercenaire", [ph[0], ph[1], Object.assign({}, ph[2], { merc: 1 })]],
      ["photo marquée renfort", [ph[0], ph[1], Object.assign({}, ph[2], { renfort: { u: U(1) } })]], ["photo en plus (copie du renfort ajoutée)", ph.concat([rf.snap])]];
    for (const [label, sn] of triches) {
      ok(B(12, "pret", true, VER, false), "prêt 12");
      const cx = ok(B(1, "lancer"), "lancement").combat;
      for (const i of [1, 3, 12]) { await send(i, P[i].S); ok(B(i, "confirmer"), "confirmer " + i); }
      const p0 = JSON.parse(run(`set role service_role; select mono_srv_bureau_photos('${U(1)}', ${cx})::text;`)); assert(p0.membres && p0.membres.length === 3, JSON.stringify(p0).slice(0, 200));
      const r = JSON.parse(run(`set role service_role; select mono_srv_bureau_resultat(${cx}, ${lit(JSON.stringify(sn))}, ${lit(JSON.stringify(vraies.R))}, ${vraies.duree}, null, '[]')::text;`));
      refuse(label + " (base)", () => assert(r.annule && /renfort/.test(r.err) && q(`select etat from mono.bureau_combats where id = ${cx}`) === "annule"
        && +q(`select count(*) from mono.bureau_butins where combat = ${cx}`) === 0, label + " : " + JSON.stringify(r)));
    }
    sa = etat(1).salon; assert(sa.etat === "ouvert", "salon rouvert après les lancements refusés");
    console.log("ok - renfort d'un ami : copie refusée dans un groupe par la fonction serveur et par la base (rf, renfort, mercenaire, photo en plus)");

    /* ---------- séries (idée de joueur validée) : ×1, ×5, ×10 ou un nombre libre de 1 à 10, combats enchaînés par le serveur ---------- */
    // le salon : 1 (chef), 3, 12 ; une clé par combat : 10 clés de plus pour chacun (opération du serveur)
    const G = [1, 3, 12];
    for (const i of G) { q(`select mono.op('${U(i)}', 0, jsonb_build_object('res', jsonb_build_object(${lit(KEY)}, 10)), 'Clés de test (séries)')`); sync(i); const r = await send(i, P[i].S); assert(r.verif && r.verif.ok, "clés reçues " + i + " " + JSON.stringify(r.verif)); }
    const keys0 = Object.fromEntries(G.map((i) => [i, P[i].S.res[KEY]]));
    const tdj0 = Object.fromEntries(G.map((i) => [i, !E.tdj(P[i].S).u[DJ]])); // 2.1.39 : l'entrée du jour (si encore libre) sert au premier combat de la série
    assert.strictEqual(etat(3).salon.serie, 1, "un seul combat par défaut");
    refuse("série choisie par un membre qui n'est pas chef", () => err(B(3, "serie", 3), /Seul le chef/, "série par un membre"));
    for (const n of [11, 0, -1, 1000]) refuse("série de " + n + " combats", () => err(B(1, "serie", n), /De 1 à 10/, "série " + n));
    refuse("plafond de 10 combats dans la table", () => fails(() => q(`update mono.bureau_salons set serie = 11 where id = ${sidA}`), /check constraint/, "serie = 11"));
    refuse("série écrite directement par un joueur", () => fails(() => as(1, `update mono.bureau_salons set serie = 10`), /permission denied/, "écriture directe"));
    ok(B(1, "serie", 10), "×10"); ok(B(1, "serie", 5), "×5"); ok(B(1, "serie", 3), "nombre libre : 3");
    let s3s = etat(3).salon; assert(s3s.serie === 3 && s3s.membres.every((m) => !m.pret), "les membres voient le choix (3) et reconfirment « Prêt » : " + JSON.stringify(s3s.serie));
    assert(s3s.journal.some((j) => /3 combats à la suite/.test(j.t)), "choix annoncé dans le journal du salon");
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    const lancerSerie = () => { const cid = ok(B(1, "lancer"), "lancement de la série").combat; return cid; };
    const jouer = async (cid, qui, appelant) => {
      for (const i of qui) { const r = await send(i, P[i].S); assert(r.verif && r.verif.ok, "sauvegarde " + i + " " + JSON.stringify(r.verif)); ok(B(i, "confirmer"), "confirmer " + i); }
      const F = await call(U(appelant || qui[0]), { bureau: { combat: cid } }); assert(F.ok && F.combat === cid && F.fin, "combat " + cid + " joué par le serveur : " + JSON.stringify(F));
      return F;
    };
    const finir = (cid) => q(`update mono.bureau_combats set debut_at = debut_at - interval '1 hour', fin_at = now() - interval '1 second' where id = ${cid}`);
    const prendre = async (cid, qui, k, n) => {
      for (const i of qui) {
        const b = ok(B(i, "butin", cid), "butin " + i + " du combat " + cid); assert(b.serie_k === k && b.serie_n === n, "butin numéroté dans la série : " + JSON.stringify([b.serie_k, b.serie_n]));
        sync(i); assert(BC.butin(P[i].S, b), "butin appliqué " + i); P[i].S.stats.playtime += 300;
        const r = await send(i, P[i].S); assert(r.verif && r.verif.ok, "Bouclier sans faux refus après le butin " + k + "/" + n + " (" + i + ") : " + JSON.stringify(r));
        err(B(i, "butin", cid), /déjà récupéré/, "butin pris deux fois");
      }
    };
    // série de 3 jouée jusqu'au bout : chaque combat est un combat normal (transition, confirmation, photos, verrou, butin)
    const cs = [lancerSerie()];
    let cc = etat(3).salon.combat; assert(cc.serie_k === 1 && cc.serie_n === 3 && cc.serie_id === cs[0], "Combat 1 / 3 : " + JSON.stringify([cc.serie_k, cc.serie_n]));
    refuse("changer le nombre pendant le lancement", () => err(B(1, "serie", 5), /pendant le lancement/, "série pendant la transition"));
    for (let k = 1; k <= 3; k++) {
      const cid = cs[k - 1];
      const F = await jouer(cid, G, G[k - 1]); assert(F.win, "victoire au combat " + k);
      const Fb = await call(U(3), { bureau: { combat: cid } });
      refuse("rejouer le combat " + k + " (fonction serveur)", () => assert(Fb.ok && Fb.deja && +q(`select count(*) from mono.bureau_butins where combat = ${cid}`) === 3, "rejouer le combat : déjà calculé " + JSON.stringify(Fb)));
      refuse("rejouer le combat " + k + " (résultat réécrit)", () => assert(/pas en calcul/.test(run(`set role service_role; select mono_srv_bureau_resultat(${cid}, '[]', '{"done": true}', 1000, null, '[]')::text;`))));
      refuse("lancer pendant la série", () => err(B(1, "lancer"), /Combat déjà en cours/, "lancer pendant la série"));
      err(B(1, "serie", 10), /fin du combat/, "changer le nombre pendant le combat");
      assert.strictEqual(+q(`select count(*) from mono.bureau_combats where salon = ${sidA} and etat in ('transition', 'calcul')`), 0, "un combat à la fois");
      // avant la fin du combat : pas de combat suivant
      etat(1); assert.strictEqual(+q(`select count(*) from mono.bureau_combats where serie_id = ${cs[0]}`), k, "le suivant attend la fin du combat");
      finir(cid);
      const s1x = etat(1).salon;
      if (k < 3) {
        const nx = s1x.combat; assert(s1x.etat === "transition" && nx.serie_k === k + 1 && nx.serie_n === 3 && nx.serie_id === cs[0] && nx.id !== cid, "Combat " + (k + 1) + " / 3 lancé tout seul : " + JSON.stringify([s1x.etat, nx.serie_k]));
        assert.deepStrictEqual(nx.membres.map((m) => m.user).sort(), G.map(U).sort(), "mêmes joueurs");
        assert(s1x.journal.some((j) => new RegExp(`Combat ${k + 1} / 3 : lancement automatique`).test(j.t)), "lancement automatique annoncé");
        cs.push(nx.id);
      } else {
        assert(s1x.etat === "ouvert" && !s1x.serie_id && s1x.membres.every((m) => !m.pret), "série finie : salon ouvert, chacun reconfirme « Prêt »");
        assert(s1x.journal.some((j) => /Série terminée : 3 combats sur 3/.test(j.t)), "fin de série annoncée");
        assert.deepStrictEqual(s1x.combat.serie_bilan.map((b) => [b.k, b.win]), [[1, true], [2, true], [3, true]], "bilan de la série");
      }
      await prendre(cid, G, k, 3);
    }
    assert.strictEqual(+q(`select count(*) from mono.bureau_combats where serie_id = ${cs[0]}`), 3, "exactement 3 combats");
    assert.strictEqual(+q(`select count(*) from mono.bureau_butins where combat = any(array[${cs}]::bigint[]) and pris_at is not null`), 9, "un butin par joueur et par combat, pris une fois");
    for (const i of G) {
      // bons « donjons en groupe » : un par combat au plus, et les mêmes plafonds que sans série (mono.act_regles : 2 par jour)
      assert(+q(`select count(*) from mono.bons where user_id = '${U(i)}' and combat = any(array[${cs.map((c) => `'g:${c}'`)}])`) >= 1, "bons de la série " + i);
      assert.strictEqual(+q(`select count(*) from mono.bons where user_id = '${U(i)}' and kind = 'grp'`), +q(`select max_jour from mono.act_regles where kind = 'grp'`), "plafond du jour des bons de groupe atteint, jamais dépassé " + i);
      sync(i); assert.strictEqual(P[i].S.res[KEY], keys0[i] - 3 + (tdj0[i] ? 1 : 0), "une clé par combat (l'entrée du jour d'abord) " + i); assert(E.tdj(P[i].S).u[DJ], "entrée du jour prise " + i);
    }
    refuse("rejouer un numéro de la série (base)", () => fails(() => q(`insert into mono.bureau_combats (salon, saison, did, stasis, seed, transition_fin, serie_id, serie_k, serie_n) values (${sidA}, 0, '${DJ}', 1, 1, now(), ${cs[0]}, 2, 3)`), /bureau_serie_k|duplicate/, "même numéro deux fois"));
    refuse("combat k au-delà de N (base)", () => fails(() => q(`insert into mono.bureau_combats (salon, saison, did, stasis, seed, transition_fin, serie_k, serie_n) values (${sidA}, 0, '${DJ}', 1, 1, now(), 4, 3)`), /check constraint/, "k > N"));
    console.log("ok - série de 3 : combats enchaînés par le serveur (Combat k / 3), butin une fois par joueur et par combat, une clé par combat, bons sous le plafond du jour, fin de série");

    // arrêt quand un joueur quitte le groupe (après le combat en cours ; les combats finis restent acquis)
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    let cx = lancerSerie(); await jouer(cx, G);
    ok(B(12, "quitter"), "12 quitte pendant le combat 1 / 3");
    assert(/Joueur12 a quitté le groupe/.test(etat(1).salon.serie_stop), "arrêt prévu après le combat en cours");
    finir(cx); let sx = etat(1).salon;
    assert(sx.etat === "ouvert" && !sx.serie_id && +q(`select count(*) from mono.bureau_combats where serie_id = ${cx}`) === 1, "série arrêtée sur le départ d'un joueur : " + JSON.stringify(sx.etat));
    assert(sx.journal.some((j) => /Série arrêtée après le combat 1 \/ 3 \(Joueur12 a quitté le groupe\)/.test(j.t)), "arrêt annoncé");
    await prendre(cx, G, 1, 3); // le butin de celui qui est parti l'attend
    ok(B(12, "rejoindre", sidA, VER, app(12)), "12 revient");
    // arrêt sur déconnexion (même règle de présence que l'existant)
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    cx = lancerSerie(); await jouer(cx, G);
    q(`update mono.bureau_membres set vu_at = now() - interval '30 seconds' where user_id = '${U(3)}'`);
    finir(cx); sx = etat(1).salon;
    assert(sx.etat === "ouvert" && !sx.serie_id && sx.journal.some((j) => /Joueur03 est déconnecté/.test(j.t)), "série arrêtée sur la déconnexion d'un joueur");
    await prendre(cx, G, 1, 3);
    // arrêt sur défaite (le résultat du serveur dit défaite)
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    cx = lancerSerie();
    for (const i of G) { await send(i, P[i].S); ok(B(i, "confirmer"), "confirmer " + i); }
    const pd = JSON.parse(run(`set role service_role; select mono_srv_bureau_photos('${U(1)}', ${cx})::text;`));
    const hd = BC.combat(V.mono, pd.membres, pd.did, pd.stasis, pd.seed, pd.at); assert(hd.snaps, JSON.stringify(hd.exclus || hd.err));
    const rd = JSON.parse(run(`set role service_role; select mono_srv_bureau_resultat(${cx}, ${lit(hd.snaps)}, ${lit(JSON.stringify(Object.assign({}, hd.R, { done: false })))}, ${hd.duree}, ${lit(hd.cle)}, '[]')::text;`));
    assert(rd.ok && rd.win === false, "défaite enregistrée : " + JSON.stringify(rd));
    finir(cx); sx = etat(1).salon;
    assert(sx.etat === "ouvert" && !sx.serie_id && sx.journal.some((j) => /Série arrêtée après le combat 1 \/ 3 \(défaite\)/.test(j.t)), "série arrêtée sur une défaite");
    assert.strictEqual(+q(`select count(*) from mono.bureau_combats where serie_id = ${cx}`), 1, "pas de combat après une défaite");
    // un joueur demande l'arrêt ; une transition ratée au combat 2 arrête aussi la série (pas de reprise automatique)
    err(B(3, "serie_arreter"), /Aucune série/, "arrêt sans série");
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    cx = lancerSerie(); await jouer(cx, G); finir(cx);
    const c2x = etat(1).salon.combat; assert(c2x.serie_k === 2, "combat 2 / 3 en transition");
    q(`update mono.bureau_combats set transition_fin = now() - interval '1 second' where id = ${c2x.id}`);
    sx = etat(1).salon; assert(sx.etat === "ouvert" && !sx.serie_id && sx.journal.some((j) => /Série arrêtée au combat 2 \/ 3/.test(j.t)), "transition ratée : série arrêtée, pas de reprise");
    for (const i of G) ok(B(i, "butin", cx), "butin du combat fini " + i);
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    cx = lancerSerie(); await jouer(cx, G);
    // un joueur arrivé pendant la série attend la fin : il ne l'arrête pas, et son départ non plus
    ok(B(2, "rejoindre", sidA, VER, app(2)), "2 arrive pendant la série");
    refuse("arrêter une série qu'on ne joue pas", () => err(B(2, "serie_arreter"), /ne joues pas/, "arrêt par un joueur hors série"));
    ok(B(2, "quitter"), "2 repart"); assert.strictEqual(etat(1).salon.serie_stop, null, "le départ d'un joueur hors série ne l'arrête pas");
    ok(B(3, "serie_arreter"), "3 arrête la série"); finir(cx); sx = etat(1).salon;
    assert(sx.etat === "ouvert" && !sx.serie_id && sx.journal.some((j) => /Joueur03 a demandé l'arrêt/.test(j.t)), "arrêt demandé par un joueur");
    for (const i of G) ok(B(i, "butin", cx), "butin " + i);
    for (const i of G) sync(i);
    ok(B(1, "serie", 1), "retour à ×1");
    for (const i of G) ok(B(i, "pret", true, VER, false), "prêt " + i);
    console.log("ok - série arrêtée après le combat en cours : départ, déconnexion, défaite, transition ratée, arrêt demandé ; combats finis acquis");

    /* ---------- chef déconnecté (8C) : chef provisoire immédiat, rôle rendu au retour, place libérée après 2 min ---------- */
    q(`update mono.bureau_membres set vu_at = now() - interval '30 seconds' where user_id = '${U(1)}'`);
    let s12 = etat(12).salon; assert(s12.chef === U(3) && s12.provisoire && s12.titulaire === U(1), "chef provisoire = le plus ancien connecté : " + JSON.stringify([s12.chef, s12.titulaire]));
    ok(B(3, "proposer", DJ, 1, KEY, VER), "le chef provisoire propose");
    s12 = etat(1).salon; assert(s12.chef === U(1) && !s12.provisoire, "retour du chef sous 2 min : rôle rendu");
    q(`update mono.bureau_membres set vu_at = now() - interval '150 seconds' where user_id = '${U(1)}'`);
    s12 = etat(3).salon; assert(!s12.membres.some((m) => m.user === U(1)) && s12.chef === U(3) && s12.titulaire === U(3), "place perdue après 2 min, le plus ancien devient chef");
    assert(!etat(1).salon, "1 n'est plus dans le salon");
    ok(B(3, "chef", U(12)), "transmission du rôle de chef"); assert.strictEqual(etat(12).salon.chef, U(12));
    console.log("ok - chef provisoire immédiat, rôle rendu au retour, place gardée 2 minutes puis libérée, transmission du chef");

    /* ---------- invitation d'un ami (Bureau.inviter), remplaçants automatiques ---------- */
    // invitation directe : amis acceptés non bloqués seulement (supabase/amis.sql)
    refuse("inviter un joueur qui n'est pas un ami", () => err(B(12, "inviter", U(2), VER, app(12)), /que tes amis/, "pas ami"));
    J(12, `amis_demander(p_user => '${U(2)}')`);
    refuse("inviter un joueur dont la demande d'ami n'est pas acceptée", () => err(B(12, "inviter", U(2), VER, app(12)), /que tes amis/, "demande en attente"));
    q(`insert into public.amis (user_id, ami, srv) values ('${U(12)}', '${U(2)}', 'm')`);
    refuse("inviter avec une amitié à sens unique", () => err(B(12, "inviter", U(2), VER, app(12)), /que tes amis/, "sens unique"));
    q(`delete from public.amis where user_id = '${U(12)}' and ami = '${U(2)}'; delete from public.amis_demandes where de = '${U(12)}'`);
    q(`insert into public.ignores (user_id, other) values ('${U(1)}', '${U(12)}')`);
    refuse("inviter un ami qui nous a bloqué", () => err(B(12, "inviter", U(1), VER, app(12)), /que tes amis/, "bloqué par l'ami"));
    q(`delete from public.ignores where user_id = '${U(1)}'; insert into public.ignores (user_id, other) values ('${U(12)}', '${U(1)}')`);
    refuse("inviter un ami qu'on a bloqué", () => err(B(12, "inviter", U(1), VER, app(12)), /que tes amis/, "ami bloqué"));
    q(`delete from public.ignores where user_id = '${U(12)}'`);
    assert.strictEqual(+q(`select count(*) from mono.bureau_invitations where salon = ${sidA} and etat = 'attente'`), 0, "aucune invitation partie");
    ok(B(12, "inviter", U(1), VER, app(12)), "inviter 1"); err(B(12, "inviter", U(1), VER, app(12)), /déjà envoyée/, "même invitation deux fois");
    const inv1 = etat(1).invitations; assert(inv1.length === 1 && inv1[0].quoi === "ami" && inv1[0].par === "Joueur12", "invitation d'un ami : " + JSON.stringify(inv1));
    ok(B(1, "repondre", inv1[0].id, true, VER, app(1)), "1 accepte l'ami"); assert.strictEqual(etat(1).salon.id, sidA);
    ok(B(1, "quitter"), "1 repart"); ok(B(12, "reglage_salon", true, true), "remplaçants automatiques");
    ok(chercher(1, [DJ], 1, 0), "1 cherche : une place libre dans un salon qui accepte des remplaçants");
    const inv2 = etat(1).invitations; assert(inv2.length === 1 && inv2[0].quoi === "remplacant" && inv2[0].salon === sidA, "remplaçant automatique : " + JSON.stringify(inv2));
    ok(B(1, "repondre", inv2[0].id, false), "1 refuse"); assert(!etat(1).recherche, "refus : hors recherche");
    // un joueur bloqué par un membre : salon absent de sa liste, « Rejoindre » refusé, jamais proposé comme remplaçant ;
    // la recherche et les salons ouverts restent ouverts à tous les autres
    q(`insert into public.ignores (user_id, other) values ('${U(12)}', '${U(2)}')`);
    assert(!J(2, `mono_bureau_salons()`).some((x) => x.id === sidA), "salon de celui qui l'a bloqué absent de la liste");
    assert(J(1, `mono_bureau_salons()`).some((x) => x.id === sidA), "salon ouvert visible des autres (même non amis)");
    refuse("rejoindre le salon de celui qui nous a bloqué", () => err(B(2, "rejoindre", sidA, VER, app(2)), /pas ouvert/, "bloqué : rejoindre"));
    ok(chercher(2, [DJ], 1, 0), "2 cherche");
    refuse("remplaçant automatique dans le salon de celui qui nous a bloqué", () => assert(!etat(2).invitations.some((v) => v.salon === sidA), "bloqué : pas de place proposée"));
    ok(J(2, `mono_bureau_annuler_recherche()`), "2 arrête de chercher");
    q(`delete from public.ignores where user_id = '${U(12)}'`);
    console.log("ok - invitation d'un ami (Bureau.inviter) réservée aux amis acceptés non bloqués, salon fermé au joueur bloqué, remplaçant automatique proposé, refus");

    /* ---------- discussion du salon (7A) : modération du chat actuel ---------- */
    ok(B(12, "dire", "On rejoue ?"), "message"); err(B(12, "dire", "Encore"), /2 secondes/, "un message toutes les 2 s");
    err(B(12, "dire", "x".repeat(201)), /200 caractères/, "200 caractères");
    q(`insert into public.chat_sanctions (user_id, mute_until) values ('${U(3)}', now() + interval '1 hour')`); // supabase/chat.sql
    refuse("message d'un joueur muet", () => err(B(3, "dire", "Bonjour"), /ne peux pas écrire/, "muet"));
    assert.strictEqual(etat(3).salon.msgs[0].b, "On rejoue ?");
    console.log("ok - discussion libre du salon, joueurs muets refusés, 200 caractères, 2 s entre deux messages");

    /* ---------- expéditions programmées (10A) ---------- */
    const H = (min) => new Date(Date.now() + min * 60000).toISOString();
    for (const i of [3, 12]) B(i, "quitter");
    err(B(1, "exp_creer", DJ, 1, H(5), 3, null), /plus de 10 minutes/, "trop tôt"); err(B(1, "exp_creer", DJ, 1, H(8 * 1440), 3, null), /7 jours/, "trop loin");
    err(B(1, "exp_creer", DJ, 1, H(60), 5, null), /2, 3 ou 4/, "places");
    const x1 = ok(B(1, "exp_creer", DJ, 1, H(60), 2, "Venez !"), "expédition 1").id; ok(B(1, "exp_creer", DJ, 1, H(120), 3, null), "expédition 2");
    refuse("3e annonce active", () => err(B(1, "exp_creer", DJ, 1, H(180), 3, null), /2 annonces/, "3e annonce"));
    at(DEBUT + 54 * 86400e3 + 10 * 3600e3); err(B(2, "exp_creer", DJ, 1, H(3 * 1440), 3, null), /fin de la saison/, "après la fin de saison"); at(DEBUT + 43 * 86400e3 + 10 * 3600e3);
    // inscriptions même organisateur hors ligne, complète, liste d'attente de 2
    q(`update mono.bureau_membres set vu_at = now() - interval '1 hour' where user_id = '${U(1)}'`);
    ok(B(2, "exp_inscrire", x1, true), "2 s'inscrit (organisateur hors ligne)");
    const w3 = ok(B(3, "exp_inscrire", x1, true), "3 en liste d'attente"); assert(w3.attente);
    ok(B(4, "exp_inscrire", x1, true), "4 en liste d'attente"); err(B(5, "exp_inscrire", x1, true), /liste d'attente comprise/, "complète");
    const avert = ok(B(2, "exp_inscrire", ok(B(10, "exp_creer", DJ, 5, H(90), 3, null), "expé stasis 5").id, true), "inscription stasis 5 (2 a réussi la stasis 3)");
    assert(/stasis 4/.test(avert.avertissement), "prévenu à l'inscription : stasis précédente pas réussie : " + JSON.stringify(avert));
    ok(B(2, "exp_inscrire", ok(B(11, "exp_creer", DJ, 1, H(100), 3, null), "expé de 11").id, true), "3e inscription de 2");
    refuse("4e inscription", () => err(B(2, "exp_inscrire", ok(B(12, "exp_creer", DJ, 1, H(110), 3, null), "expé de 12").id, true), /3 inscriptions/, "4e inscription"));
    ok(B(2, "exp_inscrire", x1, false), "2 se désinscrit : 3 monte de la liste d'attente");
    assert.strictEqual(q(`select attente from mono.bureau_inscriptions where expedition = ${x1} and user_id = '${U(3)}'`), "f", "la liste d'attente remplit la place");
    ok(B(2, "exp_inscrire", x1, true), "2 revient en liste d'attente");
    // annulation par l'organisateur (jusqu'à l'ouverture)
    const x2 = J(1, `mono_bureau_expeditions()`).find((e) => e.moi_org && e.id !== x1).id; ok(B(1, "exp_annuler", x2), "annulation");
    // suspendu : inscriptions libérées
    q(`update profiles set suspended_at = now() where id = '${U(4)}'`); etat(2);
    assert.strictEqual(+q(`select count(*) from mono.bureau_inscriptions where user_id = '${U(4)}'`), 0, "suspendu : inscriptions libérées"); q(`update profiles set suspended_at = null where id = '${U(4)}'`);
    // ouverture à H−10 : salon avec les inscrits, personne n'est encore venu
    ok(B(1, "quitter"), "1 n'est plus dans son ancien salon");
    q(`update mono.bureau_expeditions set heure = now() + interval '9 minutes' where id = ${x1}`);
    etat(3); const ex1 = J(3, `mono_bureau_expeditions()`).find((e) => e.id === x1); assert(ex1.etat === "ouverte" && ex1.salon, "salon ouvert à H−10");
    let se = etat(3).salon; assert(se && se.expedition === x1 && se.membres.length === 2 && se.titulaire === U(1), "salon de l'expédition : " + JSON.stringify(se && se.membres));
    refuse("départ d'une expédition avant l'heure", () => { ok(B(3, "pret", true, VER, false), "prêt"); });
    // 1 (organisateur) absent à l'heure : le premier inscrit présent devient chef
    q(`update mono.bureau_expeditions set heure = now() - interval '1 second' where id = ${x1}`);
    se = etat(3).salon; assert(se.chef === U(3) && se.titulaire === U(3), "organisateur absent à l'heure : le premier inscrit présent devient chef");
    // grâce de 5 minutes : l'absent perd sa place, la liste d'attente est invitée
    q(`update mono.bureau_expeditions set heure = now() - interval '301 seconds' where id = ${x1}`);
    se = etat(3).salon; assert(se.membres.length === 1 && se.membres[0].user === U(3), "grâce de 5 min : absent retiré");
    assert(etat(2).invitations.some((v) => v.quoi === "attente" && v.salon === se.id), "liste d'attente invitée sur la place libérée");
    // personne n'est venu : annulée
    q(`update mono.bureau_expeditions set heure = now() + interval '9 minutes' where id = (select id from mono.bureau_expeditions where org = '${U(11)}')`);
    for (const i of [11, 2]) q(`update mono.bureau_membres set vu_at = null where user_id = '${U(i)}'`);
    etat(5); q(`update mono.bureau_expeditions set heure = now() - interval '301 seconds' where org = '${U(11)}'`); etat(5);
    assert.strictEqual(q(`select etat || ' ' || motif from mono.bureau_expeditions where org = '${U(11)}'`), "vide Personne n'est venu.", "expédition sans aucun présent à H+5");
    q(`update mono.bureau_expeditions set heure = now() + interval '9 minutes' where org = '${U(10)}'`); etat(10);
    refuse("annuler une expédition déjà ouverte", () => err(B(10, "exp_annuler", +q(`select id from mono.bureau_expeditions where org = '${U(10)}'`)), /introuvable|ne s'annule plus/, "annulation tardive"));
    console.log("ok - expéditions : limites 10A, organisateur hors ligne, liste d'attente, salon à H−10, chef présent à l'heure, grâce de 5 min, « personne n'est venu »");

    /* ---------- rendez-vous (11A) et messages privés (9B) : désactivés par défaut ---------- */
    assert.deepStrictEqual(J(1, `mono_bureau_rdv()`), { actif: false, creneaux: [] }, "rendez-vous désactivés par défaut");
    assert.deepStrictEqual(J(9, `mono_adm_bureau()`).creneaux.map((c) => c.heure + (c.actif ? "+" : "-")), ["12:30-", "18:30-", "20:30-"], "créneaux 12:30, 18:30, 20:30 désactivés");
    assert.strictEqual(+q(`select count(*) from mono.bureau_mp`), 0, "aucun message privé préparé tant que le réglage est coupé");
    assert.strictEqual(run(`set role service_role; select mono_srv_bureau_mp(10)::text;`), "[]");
    J(1, `mono_bureau_prefs(true)`); B(5, "inviter", U(1), VER, app(5));
    assert.strictEqual(+q(`select count(*) from mono.bureau_mp`), 0, "joueur volontaire, réglage coupé : rien");
    J(9, `mono_adm_bureau_reglage('rdv', 'true')`); J(9, `mono_adm_bureau_creneau(3, null, null, true)`);
    const rdv = J(1, `mono_bureau_rdv()`); assert(rdv.actif && rdv.creneaux.length === 1 && rdv.creneaux[0].heure === "20:30", JSON.stringify(rdv));
    const rv = J(1, `mono_bureau_rdv_venir(3, true)`); assert(rv.creneaux[0].venir === 1 && rv.creneaux[0].moi, "« Je pense venir »");
    const hp = q(`select to_char(mono.bureau_rdv_at('20:30') at time zone 'Europe/Paris', 'HH24:MI')`); assert.strictEqual(hp, "20:30", "heure de Paris");
    // changement d'heure (dimanche 25 octobre 2026) : 20 h 30 à Paris = 18 h 30 UTC l'été, 19 h 30 UTC l'hiver
    assert.strictEqual(q(`select to_char((('2026-10-24'::date + '20:30'::time) at time zone 'Europe/Paris') at time zone 'UTC', 'HH24:MI') || ' ' || to_char((('2026-10-26'::date + '20:30'::time) at time zone 'Europe/Paris') at time zone 'UTC', 'HH24:MI')`), "18:30 19:30");
    J(9, `mono_adm_bureau_reglage('rdv', 'false')`); J(9, `mono_adm_bureau_creneau(3, null, null, false)`);
    console.log("ok - rendez-vous et messages privés Discord désactivés par défaut ; créneau activé par Mathis, « Je pense venir », heure de Paris");

    /* ---------- fin de saison : plus de recherche ni de salon ; un combat déjà calculé reste à récupérer ---------- */
    q(`update mono.saisons set etat = 'cloture' where id = 0`);
    refuse("recherche hors saison", () => err(chercher(3, [DJ], 1, 0), /saison Monocompte est fermée/, "hors saison"));
    q(`update mono.saisons set etat = 'ouverte' where id = 0`);

    console.log("ok - triche et cas interdits refusés : " + REFUS.length + "/" + REFUS.length);
    for (const l of REFUS) console.log("   - " + l);
    assert(RPC.length > 10 && RPC.every((n) => /^mono_srv_/.test(n)));
    q(`delete from public.chat_sanctions`); // joueur muet de ce test (supabase/chat.sql)
    // monocompte.sql relancé en fin de parcours : le défi 12 reste celui du Bureau
    file(path.join(ROOT, "supabase", "monocompte.sql")); verifCrochets("monocompte.sql relancé en fin de parcours");
    // mono_bureau.sql relancé avec des séries enregistrées : rien n'est perdu
    const series0 = q(`select string_agg(id || ':' || serie_id || ':' || serie_k || '/' || serie_n, ',' order by id) from mono.bureau_combats where serie_n > 1`);
    const choix0 = q(`select string_agg(id || ':' || serie, ',' order by id) from mono.bureau_salons`);
    assert(series0 && series0.split(",").length >= 9, "séries enregistrées : " + series0);
    file(path.join(ROOT, "supabase", "mono_bureau.sql"));
    assert.strictEqual(q(`select string_agg(id || ':' || serie_id || ':' || serie_k || '/' || serie_n, ',' order by id) from mono.bureau_combats where serie_n > 1`), series0, "séries gardées après relance");
    assert.strictEqual(q(`select string_agg(id || ':' || serie, ',' order by id) from mono.bureau_salons`), choix0, "choix des salons gardés après relance");
    assert.strictEqual(q(`select mono.defi_prog('${U(1)}', 0, 'd12') = mono.bureau_d12('${U(1)}', 0)`), "t", "défi 12 lu au Bureau après la relance");
    assert.strictEqual(snap(), before, "schéma public toujours identique");
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} run(`drop database if exists ${DB}`, URL0); }
})().catch((e) => { console.error(e); try { run(`drop database if exists ${DB}`, URL0); } catch (x) {} process.exit(1); });
