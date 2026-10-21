/* Bouclier Monocompte (étape 5), bons de butin et économie de saison (6a), fin de saison du marché (6c), « Échanges et HdV de
   saison » (lot 2, point 7), dans un vrai Postgres jetable (jamais la base en ligne), avec la vraie fonction serveur « mono »
   (supabase/functions/mono/index.ts, rejouée sans Deno : ses appels à la base passent par psql, rôle service_role).
   Plan directeur, section 6.2 lignes 5, 6a et 6c, et 6.3 :
   - envois acceptés : partie validée (mono.parties_ok) avec le résumé calculé par le serveur, bons de butin, mono.apres_validation ;
   - parties trichées refusées par la fonction (kamas, héros en double, Maîtrise, objets impossibles, 4ᵉ Dofus, spécialités, pass,
     solde d'Éclats ≠ registre, objet numéroté d'un autre joueur, objet vendu encore dans le sac, partie reculée) ;
   - même bon deux fois, deux onglets, objet chez deux joueurs, échange coupé au milieu, rien de perdu ni de dupliqué ;
   - HdV de saison : taxe de 2 %, Éclats du Temps échangeables, objets liés au compte refusés, défi 6 compté par le serveur ;
   - gel 24 h avant la fin, clôture interrompue puis relancée (chaque annonce et chaque offre rendue une fois), HdV de l'Éternel ;
   - Classique intact (schéma public identique, aucune fonction mono_srv_* ouverte aux joueurs).
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/mono_eco_sql.test.js
   Sans IDLUS_PG (ou Node < 22.6), le test est sauté. La base « idlus_mono_eco » est recréée puis effacée. */
"use strict";
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs"); const os = require("os"); const path = require("path"); const assert = require("assert");
const { pathToFileURL } = require("url");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
const [maj, min] = process.versions.node.split(".").map(Number);
if (!URL0) { console.log("ok - économie Monocompte (IDLUS_PG absent : test SQL sauté)"); process.exit(0); }
if (maj < 22 || (maj === 22 && min < 6)) { console.log("ok - (Node trop ancien : test sauté)"); process.exit(0); }
if (!process.execArgv.includes("--experimental-strip-types")) { // la fonction serveur est en TypeScript
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", __filename], { stdio: "inherit", env: process.env });
  process.exit(r.status == null ? 1 : r.status);
}

const DB = "idlus_mono_eco";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64e6 }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const as = (i, s) => q(`set role authenticated; set request.jwt.claim.sub = '${U(i)}'; ${s}`);
const J = (i, s) => JSON.parse(as(i, `select (${s})::text`) || "null");
const fails = (fn, re, why) => { let e0 = null; try { fn(); } catch (e) { e0 = e; } assert(e0, why + " : aurait dû être refusé"); const m = String(e0.stderr || e0.message); assert(re.test(m), why + " : " + m); };
// valeur SQL d'un argument (texte entre dollars, jsonb, nombre, booléen)
const lit = (v) => { if (v == null) return "null"; if (typeof v === "number") return String(v); if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return lit(JSON.stringify(v)) + "::jsonb"; let t = "q"; while (String(v).includes("$" + t + "$")) t += "x"; return `$${t}$${v}$${t}$`; };

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idlus-mono-"));
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
    const snap = () => q(`select md5(string_agg(x, E'\\n' order by x)) from (
        select 'T ' || table_name || ' ' || column_name || ' ' || data_type || ' ' || coalesce(column_default, '') x from information_schema.columns where table_schema = 'public'
        union all select 'P ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies where schemaname = 'public'
        union all select 'G ' || table_name || ' ' || grantee || ' ' || privilege_type from information_schema.role_table_grants where table_schema = 'public'
        union all select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname not like 'mono\\_%' and p.proname <> 'cosm_mine') s`);
    const before = snap();
    file(path.join(ROOT, "supabase", "monocompte.sql"));
    assert.strictEqual(snap(), before, "le schéma public du Classique a changé");
    // contrat avec supabase/mono_social.sql : mono.apres_validation est appelée après chaque partie validée, avec le résumé du serveur
    q(`create table mono.t_apres (id serial, user_id uuid, saison int, resume jsonb);
       create or replace function mono.apres_validation(p_user uuid, p_saison int, p_resume jsonb) returns void language plpgsql security definer set search_path = mono, public
       as $$ begin insert into mono.t_apres (user_id, saison, resume) values (p_user, p_saison, p_resume); end $$;`);
    q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 9) i;
       insert into profiles (id, pseudo) select id, 'Joueur' || substr(id::text, 35) from auth.users;
       insert into admins values ('${U(9)}');`);
    J(9, `mono_adm_saison(0, 'Saison de test', '2026-10-19 00:00 Europe/Paris', true, 'ouverte')`);
    for (const i of [1, 2, 3, 4, 5, 6]) as(9, `select mono_adm_testeur('Joueur0${i}', true)`);
    const DEBUT = Date.parse("2026-10-18T22:00:00Z");
    let now = DEBUT + 15 * 86400e3 + 10 * 3600e3; // jour 16 (manche 2 : défi 6 ouvert), 10 h à Paris
    const at = (t) => { now = t; q(`update mono.saisons set clk_t = to_timestamp(${t / 1000}), clk_ref = now(), clk_pause = true where id = 0`); };
    at(now);

    /* ---------- la fonction serveur « mono », sans Deno : chaque appel à la base passe par psql (rôle service_role) ---------- */
    execFileSync(process.execPath, [path.join(ROOT, "tools/build_server.js")], { stdio: "pipe" });
    const game = JSON.stringify(path.join(ROOT, "supabase/functions/mono/game.js"));
    const src = fs.readFileSync(path.join(ROOT, "supabase/functions/mono/index.ts"), "utf8");
    const fake = `
const createClient = () => ({ auth: { getUser: async (j) => ({ data: { user: j ? { id: j } : null } }) },
  rpc: async (name, a) => { try { const r = globalThis.__RPC(name, a); return { data: r, error: null }; } catch (e) { return { data: null, error: { message: String(e.stderr || e.message) } }; } } });
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
      const out = run(`set role service_role; select coalesce(to_jsonb(public.${name}(${args})), 'null'::jsonb)::text;`);
      return JSON.parse(out);
    };
    await import(pathToFileURL(tmp).href);
    const { D, E, V } = globalThis.__GAME; const call = globalThis.__CALL;
    E.setRng((() => { let s = 7; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })());
    E.weekly = () => null; E.flash = () => [];
    const clk = () => E.setClock(() => now);
    clk();

    /* ---------- les joueurs : une partie Monocompte chacun, envoyée par la fonction ---------- */
    const P = {}; // i -> { S, base (date en ligne connue de l'appareil) }
    const hero = (S) => S.chars.find((c) => !c.merc);
    const tplOf = (f) => Object.keys(D.ITEMS).find((k) => f(D.ITEMS[k]));
    const newGame = (i, cls) => {
      clk(); const S = E.monoStart(E.newState("Héros" + i, cls)); S.mono.t0 = DEBUT; E.monoBoot(S); E.MONO.saisons[S.mono.s].debut = DEBUT;
      S.kamas = 200000; S.res = Object.assign(S.res || {}, { "Blé": 400, "Frêne": 300 }); hero(S).inTeam = true;
      S.stats = S.stats || {}; S.stats.playtime = 40 * 3600;
      return S;
    };
    const send = async (i, S, o = {}) => {
      clk(); const p = P[i] || (P[i] = {});
      const r = await call(U(i), { push: { data: E.serialize(S), meta: {}, version: "2.1.35", device: "pc", expected: o.expected !== undefined ? o.expected : p.base || null, force: !!o.force } });
      clk();
      if (r.at) p.base = r.at;
      if (r.verif && r.verif.registre) E.tfSrvSet(S, r.verif.registre); // le jeu recopie le registre du serveur (js/mono_online.js)
      return r;
    };
    const okRow = (i) => JSON.parse(q(`select coalesce((select to_jsonb(k) - 'data' from mono.parties_ok k where user_id = '${U(i)}' and saison = 0), 'null')::text`));
    const okData = (i) => q(`select data from mono.parties_ok where user_id = '${U(i)}' and saison = 0`);
    // les opérations du serveur appliquées par le jeu (js/market.js, apply)
    const apply = (S, ops, reg) => {
      S.hdv = S.hdv || { op: 0, log: [] };
      for (const o of (ops || []).slice().sort((a, b) => a.id - b.id)) { if (o.id <= (S.hdv.op || 0)) continue; const p = o.p || {};
        if (p.k) S.kamas = Math.max(0, Math.round((S.kamas || 0) + Number(p.k)));
        ["res", "runes", "cons"].forEach((b) => { if (!p[b]) return; S[b] = S[b] || {}; for (const k in p[b]) { const v = (S[b][k] || 0) + Number(p[b][k]); if (v > 0) S[b][k] = v; else delete S[b][k]; } });
        (p.rm || []).forEach((uid) => { delete S.items[+uid]; });
        (p.rmM || []).forEach((uid) => E.mountGone && E.mountGone(S, +uid)); (p.rmP || []).forEach((uid) => E.petGone && E.petGone(S, +uid));
        (p.addM || []).forEach((m) => E.mountIn && E.mountIn(S, m)); (p.addP || []).forEach((x) => E.petIn && E.petIn(S, x));
        (p.add || []).forEach((it) => { const uid = S.nextUid++; S.items[uid] = Object.assign({}, it, { uid }); });
        S.hdv.op = o.id; }
      if (reg) E.tfSrvSet(S, reg);
    };
    const cur = (S) => (S.hdv && S.hdv.op) || 0;
    const sync = (i, S) => { const r = J(i, `mono_hdv_sync(${cur(S)})`); apply(S, r.ops, r.registre); return r; };

    // 1. premiers envois : acceptés, résumé du serveur, mono.apres_validation appelée
    const CLS = { 1: "iop", 2: "cra", 3: "eni", 4: "feca", 5: "sram", 6: "osa" };
    for (const i of [1, 2, 3, 4, 5, 6]) { P[i] = { S: newGame(i, CLS[i]) }; const r = await send(i, P[i].S); assert(r.ok && r.at && r.verif.ok, `joueur ${i} : ${JSON.stringify(r)}`); }
    let k1 = okRow(1); assert(k1 && k1.resume.classe === "iop" && k1.resume.nom === "Héros1" && k1.resume.niveau === 1, "résumé du serveur : " + JSON.stringify(k1 && k1.resume));
    assert.strictEqual(+q(`select count(*) from mono.t_apres`), 6, "mono.apres_validation après chaque partie validée");
    assert.deepStrictEqual(JSON.parse(q(`select resume::text from mono.t_apres where user_id = '${U(2)}'`)), okRow(2).resume, "mono.apres_validation reçoit le résumé du serveur");
    let r = await call(U(1), { verif: 1 }); assert(r.ok && r.same, "même partie : rien à refaire");
    // le jeu ne fixe pas son résumé : une partie qui annonce niveau 200 dans meta reste au niveau du serveur
    console.log("ok - 6 premiers envois acceptés par la fonction « mono » (résumé du serveur, mono.apres_validation)");

    // 2. bons de butin : les Éclats d'activité de la partie validée, une seule fois par combat
    const S1 = P[1].S; const day = E.monoDay(S1); assert.strictEqual(day, 16);
    E.tfPost(S1, 8, "act", `act:${day}:dj`); E.tfPost(S1, 4, "act", `act:${day}:job`); // 8 donjons et 4 gains de métier dans la journée
    r = await send(1, S1); assert(r.verif.ok && r.verif.bons === 12, "bons : " + JSON.stringify(r.verif));
    assert.strictEqual(q(`select string_agg(combat, ',' order by combat) from mono.bons where user_id = '${U(1)}' and kind = 'job'`), "j16:job:1,j16:job:2,j16:job:3,j16:job:4");
    S1.stats.playtime += 60; r = await send(1, S1); assert(r.verif.ok && r.verif.bons === 0, "même bon deux fois : rien de plus");
    assert.strictEqual(+q(`select mono.bon('${U(1)}', 0, 'dj', 'j16:dj:3', 1, 16)`), 0, "même bon rejoué à la main");
    assert.strictEqual(+q(`select sum(n) from mono.eclats where user_id = '${U(1)}'`), 12, "registre : 12 Éclats");
    // deux onglets envoient en même temps la même journée : un seul crédit par bon
    q(`select mono.bons_partie('${U(2)}', 0, '[{"j": 16, "k": "dj", "n": 5}]')`);
    execFileSync("bash", ["-c", [1, 2].map(() => `psql '${dbUrl}' -X -q -At -c "begin; select mono.bons_partie('${U(2)}', 0, '[{\\"j\\": 16, \\"k\\": \\"dj\\", \\"n\\": 8}]'); select pg_sleep(0.3); commit;" &`).join(" ") + " wait"]);
    assert.strictEqual(+q(`select sum(n) from mono.eclats where user_id = '${U(2)}'`), 8, "deux onglets : 8 au plus, jamais 16");
    q(`select mono.bons_partie('${U(3)}', 0, '[{"j": 16, "k": "dj", "n": 8}]'); select mono.bons_partie('${U(4)}', 0, '[{"j": 16, "k": "dj", "n": 8}]'); select mono.bons_partie('${U(5)}', 0, '[{"j": 16, "k": "dj", "n": 8}]')`);
    for (const i of [2, 3, 4, 5]) sync(i, P[i].S);
    console.log("ok - bons de butin : un par combat, jamais deux fois (même envoi, même bon, deux onglets)");

    // 3. parties trichées : refusées par la fonction, la partie validée ne change pas, raison notée pour le panel
    const good1 = E.serialize(S1);
    const dofusTpls = Object.keys(D.ITEMS).filter((k) => /^dofus_/.test(k) && k !== "dofus_phenix").slice(0, 4);
    const CHEATS = [];
    const cheat = async (label, fn) => {
      const T = E.deserialize(good1); E.monoBoot(T); fn(T); const before = okData(1);
      const rr = await send(1, T, { force: true }); assert(rr.ok && rr.at, label + " : envoi");
      assert(!rr.verif.ok && rr.verif.held, `${label} : accepté`); assert.strictEqual(okData(1), before, `${label} : la partie validée a changé`);
      const why = q(`select why from mono.bouclier where user_id = '${U(1)}' order by at desc, id desc limit 1`);
      CHEATS.push([label, why]); console.log(`ok - refusé par le serveur : ${label} (${why})`);
    };
    await cheat("kamas gonflés", (T) => { T.kamas += 1e9; });
    await cheat("héros en double", (T) => { const c = JSON.parse(JSON.stringify(hero(T))); c.id = 99; c.name = "Clone"; T.chars.push(c); });
    await cheat("Maîtrise", (T) => { hero(T).mt = { lvl: 900, bn: 0 }; });
    await cheat("objet impossible", (T) => { const it = E.rollItem(T, tplOf((x) => x.stats.vit && x.lvl <= 20), { radiant: false }); it.stats.vit = 99999; });
    await cheat("4ᵉ Dofus porté", (T) => { const c = hero(T); dofusTpls.forEach((tpl, n) => { const it = E.rollItem(T, tpl, { radiant: false }); c.equip["dofus" + (n + 1)] = it.uid; }); });
    await cheat("4 spécialités", (T) => { T.mono.spec = ["paysan", "bucheron", "mineur", "pecheur"]; });
    await cheat("pass de saison gonflé", (T) => { E.bpState(T).pts = 50000; });
    await cheat("solde d'Éclats différent du registre", (T) => { E.tfState(T).srv = { solde: 5000, genere: 12, quota: 300, at: now }; E.tfSync(T); });
    await cheat("Éclats d'activité au-delà de la borne du jour", (T) => { E.tfLedger(T).find((l) => l.src === "act:16:job").n = 60; });
    await cheat("Éclats d'activité ajoutés à un jour passé", (T) => { E.tfPost(T, 8, "act", "act:10:dj"); });
    // pendant la vérification en échec, les échanges sont bloqués
    assert.match(JSON.stringify(J(1, `mono_hdv_list(0, 'res', 'Blé', null, 10, 1, 100, 'Blé', 1, null)`)), /en vérification/, "HdV bloqué tant que la dernière partie est refusée");
    r = await send(1, S1, { force: true }); assert(r.verif.ok, "partie honnête renvoyée : acceptée " + JSON.stringify(r.verif));
    assert.strictEqual(+q(`select count(*) from mono.t_apres where user_id = '${U(1)}'`), 4, "mono.apres_validation : jamais après un refus (4 parties acceptées, 10 refusées)");
    // « C'est bon » de Mathis : la partie suivante passe le contrôle des gains, jamais celui de l'impossible
    fails(() => as(1, `select mono_adm_accepter('${U(1)}')`), /réservé à Mathis/, "« C'est bon » donné par un joueur");
    assert(J(9, `mono_adm_bouclier()`).some((b) => b.user === U(1) && /kamas/.test(b.why)), "panel : refus listés");
    console.log("ok - " + CHEATS.length + " parties trichées refusées par la fonction, partie validée inchangée, HdV bloqué pendant la vérification");

    // 4. HdV de saison : mise en vente (taxe de 2 %), achat en une opération, numéro unique
    const capeTpl = tplOf((x) => x.slot === "cape" && x.lvl <= 20);
    const cape = E.rollItem(S1, capeTpl, { radiant: false }); const dof = E.rollItem(S1, dofusTpls[0], { radiant: false });
    r = await send(1, S1); assert(r.verif.ok, "cape et Dofus : " + JSON.stringify(r.verif));
    assert.match(JSON.stringify(J(1, `mono_hdv_list(0, 'eq', '${dofusTpls[0]}', ${dof.uid}, 1, 1, 5000, 'Dofus', 1, null)`)), /ne s'échangent pas/, "Dofus lié au compte");
    const k0 = S1.kamas;
    let L = J(1, `mono_hdv_list(${cur(S1)}, 'eq', '${capeTpl}', ${cape.uid}, 1, 1, 1000, 'Cape', 1, 'cape')`); assert(L.ok, JSON.stringify(L));
    apply(S1, L.ops, L.registre); assert.strictEqual(S1.kamas, k0 - 20, "taxe de 2 % (1 000 kamas : 20)"); assert(!S1.items[cape.uid], "cape sortie du sac");
    const sn = +q(`select ref from mono.hdv where seller = '${U(1)}' and cat = 'eq'`); assert(sn > 0, "numéro unique donné à la mise en vente");
    assert.match(JSON.stringify(J(1, `mono_hdv_list(${cur(S1)}, 'eq', '${capeTpl}', ${cape.uid}, 1, 1, 1000, 'Cape', 1, 'cape')`)), /plus dans ton sac/, "même objet mis en vente deux fois");
    // objet vendu encore dans le sac : le jeu applique les kamas mais garde la cape
    { const T = E.deserialize(E.serialize(S1)); E.monoBoot(T); T.items[cape.uid] = Object.assign({}, cape); const before = okData(1);
      const rr = await send(1, T, { force: true }); assert(!rr.verif.ok, "objet vendu encore dans le sac : accepté"); assert.strictEqual(okData(1), before);
      CHEATS.push(["objet mis en vente encore dans le sac", q(`select why from mono.bouclier where user_id = '${U(1)}' order by at desc, id desc limit 1`)]); }
    r = await send(1, S1, { force: true }); assert(r.verif.ok, "après la vente : " + JSON.stringify(r.verif));
    // achat : kamas de l'acheteur et du vendeur, objet numéroté, en une opération
    const S2 = P[2].S; const k2 = S2.kamas; const hid = +q(`select id from mono.hdv where seller = '${U(1)}' and cat = 'eq'`);
    assert.match(JSON.stringify(J(1, `mono_hdv_buy(0, ${hid})`)), /propre annonce/);
    // deux acheteurs en même temps : un seul l'a
    const buyer = (i) => `psql '${dbUrl}' -X -q -At -c "set role authenticated; set request.jwt.claim.sub = '${U(i)}'; select mono_hdv_buy(0, ${hid});"`;
    const outs = execFileSync("bash", ["-c", `${buyer(2)} & ${buyer(3)} & wait`], { encoding: "utf8" });
    assert.strictEqual((outs.match(/"ok": true/g) || []).length, 1, "deux acheteurs : un seul achat " + outs);
    const who = q(`select buyer from mono.hdv where id = ${hid}`); const B = who === U(2) ? 2 : 3; const SB = P[B].S; const kB = SB.kamas;
    sync(B, SB); assert.strictEqual(SB.kamas, kB - 1000, "acheteur : -1 000 kamas"); const bought = Object.values(SB.items).find((x) => x.sn === sn); assert(bought, "objet numéroté reçu");
    sync(1, S1); assert.strictEqual(S1.kamas, k0 - 20 + 1000, "vendeur : +1 000 kamas");
    assert.strictEqual(q(`select owner from mono.objets where sn = ${sn}`), U(B), "numéro : nouveau propriétaire");
    assert.match(JSON.stringify(J(5, `mono_hdv_buy(0, ${hid})`)), /Trop tard/, "même annonce achetée deux fois");
    r = await send(B, SB); assert(r.verif.ok, "acheteur : partie avec l'objet acheté " + JSON.stringify(r.verif));
    r = await send(1, S1); assert(r.verif.ok);
    // objet chez deux joueurs : la même cape numérotée recopiée dans une autre partie
    { const O = B === 2 ? 3 : 2; const T = E.deserialize(E.serialize(P[O].S)); E.monoBoot(T); const u = T.nextUid++; T.items[u] = Object.assign({}, bought, { uid: u }); const before = okData(O);
      const rr = await send(O, T, { force: true }); assert(!rr.verif.ok, "objet numéroté chez deux joueurs : accepté"); assert.strictEqual(okData(O), before);
      CHEATS.push(["objet numéroté d'un autre joueur (chez deux joueurs)", q(`select why from mono.bouclier where user_id = '${U(O)}' order by at desc, id desc limit 1`)]);
      const rr2 = await send(O, P[O].S, { force: true }); assert(rr2.verif.ok); }
    // partie reculée : l'ancienne partie (avant la vente) renvoyée
    { const before = okData(1); const T = E.deserialize(good1); E.monoBoot(T); const rr = await send(1, T, { force: true }); assert(!rr.verif.ok, "partie reculée acceptée"); assert.strictEqual(okData(1), before);
      CHEATS.push(["partie reculée", q(`select why from mono.bouclier where user_id = '${U(1)}' order by at desc, id desc limit 1`)]); r = await send(1, S1, { force: true }); assert(r.verif.ok); }
    console.log("ok - HdV de saison : taxe de 2 %, achat en une opération, numéro unique, deux acheteurs, objet chez deux joueurs, partie reculée");

    // 5. Éclats du Temps à l'HdV : registre (vente, achat), jamais créés
    const tf = E.TF_RES; const tot0 = +q(`select sum(n) from mono.eclats where saison = 0`);
    L = J(1, `mono_hdv_list(${cur(S1)}, 'res', '${tf}', null, 10, 1, 500, '${tf}', 0, null)`); assert(L.ok, JSON.stringify(L)); apply(S1, L.ops, L.registre);
    assert.strictEqual(L.registre.solde, 2, "vendeur : 12 - 10 Éclats");
    const tfid = +q(`select id from mono.hdv where cat = 'tf'`);
    const b4 = J(4, `mono_hdv_buy(0, ${tfid})`); assert(b4.ok && b4.registre.solde === 18, "acheteur : 8 + 10 Éclats " + JSON.stringify(b4.registre));
    assert.strictEqual(+q(`select sum(n) from mono.eclats where saison = 0`), tot0, "les Éclats changent de main, aucun n'est créé");
    sync(4, P[4].S); assert.strictEqual(P[4].S.res[tf], 18, "sac de l'acheteur : copie du registre"); r = await send(4, P[4].S); assert(r.verif.ok, "acheteur d'Éclats : " + JSON.stringify(r.verif));
    sync(1, S1); r = await send(1, S1); assert(r.verif.ok);
    console.log("ok - Éclats du Temps à l'HdV de saison : registre du vendeur et de l'acheteur, aucun créé");

    // 6. défi 6 « Marché des échos » : compté par le serveur, à partir de 3 acheteurs différents
    const S6 = P[6].S; r = await send(6, S6);
    const list6 = () => { const l = J(6, `mono_hdv_list(${cur(S6)}, 'res', 'Blé', null, 1, 1, 10, 'Blé', 1, null)`); assert(l.ok, JSON.stringify(l)); apply(S6, l.ops); return +q(`select max(id) from mono.hdv where seller = '${U(6)}'`); };
    for (let n = 0; n < 5; n++) J(2, `mono_hdv_buy(0, ${list6()})`);
    assert.strictEqual(+q(`select count(*) from mono.eclats where user_id = '${U(6)}' and origine = 'defi'`), 0, "5 lots au même acheteur : rien");
    J(3, `mono_hdv_buy(0, ${list6()})`); J(5, `mono_hdv_buy(0, ${list6()})`);
    assert.strictEqual(q(`select string_agg(source, ',') from mono.eclats where user_id = '${U(6)}' and origine = 'defi'`), "defi:d6:0", "3 acheteurs, 7 lots : défi 6 bronze, payé par le serveur");
    console.log("ok - défi 6 compté par le serveur (3 acheteurs différents)");

    // 7. offres d'achat : kamas mis de côté (taxe comprise), vente à une offre en une opération, reste rendu
    const S3 = P[3].S; sync(3, S3); r = await send(3, S3); assert(r.verif.ok, JSON.stringify(r.verif)); const k3 = S3.kamas;
    let O = J(3, `mono_hdv_order_new(${cur(S3)}, 'res', 'Frêne', 10, 50, 7, 'Frêne', 1, null)`); assert(O.ok, JSON.stringify(O)); apply(S3, O.ops);
    assert.strictEqual(S3.kamas, k3 - 510, "500 kamas + 2 % mis de côté");
    const oid = +q(`select id from mono.ordres where buyer = '${U(3)}'`);
    const k1b = S1.kamas; O = J(1, `mono_hdv_order_fill(${cur(S1)}, ${oid}, 4)`); assert(O.ok && O.n === 4, JSON.stringify(O)); apply(S1, O.ops);
    assert.strictEqual(S1.kamas, k1b + 200); assert.strictEqual(S1.res["Frêne"], 296);
    O = J(3, `mono_hdv_order_cancel(${cur(S3)}, ${oid})`); apply(S3, O.ops);
    assert.strictEqual(S3.kamas, k3 - 200 - 4, "offre retirée : reste rendu (taxe sur ce qui a servi)"); assert.strictEqual(S3.res["Frêne"], 304);
    assert.match(JSON.stringify(J(3, `mono_hdv_order_cancel(${cur(S3)}, ${oid})`)), /déjà terminée/, "reste jamais rendu deux fois");
    for (const i of [1, 3]) { r = await send(i, P[i].S); assert(r.verif.ok, `après l'offre d'achat (${i}) : ` + JSON.stringify(r.verif)); }
    console.log("ok - offres d'achat : kamas mis de côté, vente en une opération, reste rendu une fois");

    // 8. échange direct : kamas, Éclats et objet ensemble ; coupé au milieu, rien n'a bougé
    const S4 = P[4].S; const ring = E.rollItem(S4, tplOf((x) => x.slot === "anneau" && x.lvl <= 20), { radiant: false }); r = await send(4, S4); assert(r.verif.ok, JSON.stringify(r.verif));
    sync(1, S1); r = await send(1, S1); assert(r.verif.ok);
    const t = J(1, `mono_trade_start('Joueur04')`); assert(t.ok, JSON.stringify(t));
    J(1, `mono_trade_offer(${t.id}, '{"k": 3000, "tf": 2}')`); J(4, `mono_trade_offer(${t.id}, '{"items": [${ring.uid}]}')`);
    const ver = () => J(1, `mono_trade_state()`).ver;
    const counts = () => q(`select (select count(*) from mono.ops) || '/' || (select coalesce(sum(n), 0) from mono.eclats) || '/' || (select count(*) from mono.sortis) || '/' || (select count(*) from mono.objets)`);
    const c0 = counts(); const tf1 = +q(`select mono.solde('${U(1)}', 0)`), tf4 = +q(`select mono.solde('${U(4)}', 0)`);
    assert(J(1, `mono_trade_ok(${t.id}, ${ver()}, 0)`).wait, "en attente de l'autre");
    q(`alter table mono.sortis add constraint t_panne check (user_id <> '${U(4)}')`); // panne au milieu de l'échange (après les opérations, avant la fin)
    fails(() => as(4, `select mono_trade_ok(${t.id}, ${ver()}, 0)`), /t_panne/, "échange coupé");
    assert.strictEqual(counts(), c0, "échange coupé : ni opération, ni Éclat, ni objet n'a bougé");
    assert.deepStrictEqual([+q(`select mono.solde('${U(1)}', 0)`), +q(`select mono.solde('${U(4)}', 0)`)], [tf1, tf4]);
    assert.strictEqual(q(`select status from mono.echanges where id = ${t.id}`), "open", "échange coupé : toujours ouvert");
    q(`alter table mono.sortis drop constraint t_panne`);
    const x4 = J(4, `mono_trade_ok(${t.id}, ${ver()}, ${cur(S4)})`); assert(x4.ok && x4.done, JSON.stringify(x4)); apply(S4, x4.ops, x4.registre);
    sync(1, S1);
    assert.deepStrictEqual([+q(`select mono.solde('${U(1)}', 0)`), +q(`select mono.solde('${U(4)}', 0)`)], [tf1 - 2, tf4 + 2], "Éclats échangés");
    assert(!S4.items[ring.uid] && Object.values(S1.items).some((x) => x.tpl === ring.tpl && x.sn), "anneau numéroté passé au joueur 1");
    assert.strictEqual(J(1, `mono_trade_ok(${t.id}, ${ver()}, 0)`).err, "Échange terminé.", "échange jamais fait deux fois");
    for (const i of [1, 4]) { r = await send(i, P[i].S); assert(r.verif.ok, `après l'échange (${i}) : ` + JSON.stringify(r.verif)); }
    console.log("ok - échange direct en une opération (kamas, Éclats, objet) ; coupé au milieu, rien n'a bougé");

    // 9. gel 24 h avant la fin, puis clôture interrompue et relancée : chaque annonce et chaque offre rendue une fois
    q(`select mono.mouvement('${U(5)}', 0, 250, 'echange_recu', 'test:collection', null)`); // de quoi acheter (test)
    const objCol = J(5, `mono_boutique_achat('sab')`); assert(objCol.ok, "objet de collection : " + JSON.stringify(objCol)); // Sablier de collection (échangeable)
    const colId = +q(`select id from mono.collection where user_id = '${U(5)}'`);
    const S5 = P[5].S; sync(5, S5); r = await send(5, S5); assert(r.verif.ok, JSON.stringify(r.verif));
    const lst = (i, a) => { const l = J(i, `mono_hdv_list(${cur(P[i].S)}, ${a})`); assert(l.ok, JSON.stringify(l)); apply(P[i].S, l.ops, l.registre); };
    lst(5, `'col', 'sab', ${colId}, 1, 1, 9000, 'Sablier', 0, null`); lst(5, `'res', '${tf}', null, 1, 3, 100, '${tf}', 0, null`); lst(3, `'res', 'Blé', null, 10, 5, 80, 'Blé', 1, null`);
    J(2, `mono_hdv_order_new(0, 'res', 'Blé', 30, 5, 14, 'Blé', 1, null)`); J(6, `mono_hdv_order_new(0, 'res', 'Frêne', 20, 7, 14, 'Frêne', 1, null)`);
    const t2 = J(2, `mono_trade_start('Joueur06')`); assert(t2.ok);
    at(Date.parse("2026-12-13T00:30:00Z")); // dimanche 13/12, 1 h 30 à Paris : moins de 24 h avant la fin (lundi 14/12 à minuit)
    assert(J(1, `mono_acces()`).gel, "le jeu voit le gel");
    assert.match(JSON.stringify(J(3, `mono_hdv_list(0, 'res', 'Blé', null, 10, 1, 80, 'Blé', 1, null)`)), /moins de 24 h/, "gel : plus de nouvelle annonce");
    assert.match(JSON.stringify(J(3, `mono_hdv_order_new(0, 'res', 'Blé', 1, 5, 3, 'Blé', 1, null)`)), /moins de 24 h/, "gel : plus de nouvelle offre d'achat");
    assert.match(JSON.stringify(J(3, `mono_trade_start('Joueur01')`)), /moins de 24 h/, "gel : plus de nouvel échange");
    const bl = +q(`select min(id) from mono.hdv where seller = '${U(3)}' and status = 'open'`); assert(J(1, `mono_hdv_buy(0, ${bl})`).ok, "gel : les achats continuent jusqu'à la clôture");
    const ouverts = JSON.parse(q(`select jsonb_build_object('h', (select jsonb_agg(id order by id) from mono.hdv where saison = 0 and status = 'open'), 'o', (select jsonb_agg(id order by id) from mono.ordres where saison = 0 and status = 'open'))::text`));
    assert(ouverts.h.length === 8 && ouverts.o.length === 2, JSON.stringify(ouverts));
    const tfAvant = +q(`select sum(n) + (select coalesce(sum(qty), 0) from mono.hdv where cat = 'tf' and status = 'open') from mono.eclats where saison = 0`); // registre + Éclats en vente
    const kamasDe = (i) => +q(`select mono.kamas('${U(i)}', 0, (select data::jsonb from mono.parties_ok where user_id = '${U(i)}' and saison = 0))`);
    const kAv = [2, 3, 5, 6].map(kamasDe);
    // premier lot, puis une panne au milieu du deuxième (la transaction du lot est annulée), puis la reprise
    let f = J(9, `mono_adm_fin_saison(0, 3)`); assert.deepStrictEqual([f.etape, f.etat, f.marche.annonces], ["marche", "cloture", 3], JSON.stringify(f));
    assert.strictEqual(q(`select status from mono.echanges where id = ${t2.id}`), "cancel", "échanges en cours annulés à la clôture");
    assert.match(JSON.stringify(J(1, `mono_hdv_buy(0, ${ouverts.h[5]})`)), /fermé/, "clôture : plus d'achat");
    q(`alter table mono.ops add constraint t_panne check (txt not like 'Fin de saison : annonce fermée%' or user_id <> '${U(3)}') not valid`);
    const avantPanne = q(`select count(*) || '/' || coalesce(sum(n), 0) from mono.eclats where origine = 'hdv_retour'`) + q(`select '/' || count(*) from mono.hdv where status = 'open'`);
    fails(() => as(9, `select mono_adm_fin_saison(0, 3)`), /t_panne/, "clôture coupée au milieu d'un lot");
    assert.strictEqual(q(`select count(*) || '/' || coalesce(sum(n), 0) from mono.eclats where origine = 'hdv_retour'`) + q(`select '/' || count(*) from mono.hdv where status = 'open'`), avantPanne, "lot coupé : rien de rendu (Éclats, annonces)");
    q(`alter table mono.ops drop constraint t_panne`);
    let tours = 0; do { f = J(9, `mono_adm_fin_saison(0, 3)`); tours++; } while (f.etat !== "finie" && tours < 20);
    assert.strictEqual(f.etat, "finie", JSON.stringify(f));
    assert.strictEqual(+q(`select count(*) from mono.ops where txt like 'Fin de saison : annonce fermée%'`), ouverts.h.length, "chaque annonce rendue une fois");
    assert.strictEqual(+q(`select count(*) from mono.ops where txt like 'Fin de saison : offre d''achat fermée%'`), ouverts.o.length, "chaque offre rendue une fois");
    assert.strictEqual(+q(`select count(*) from mono.hdv where saison = 0 and status = 'open'`) + +q(`select count(*) from mono.ordres where saison = 0 and status = 'open'`), 0);
    assert.strictEqual(+q(`select count(*) from mono.eclats where origine = 'hdv_retour'`), 3, "3 lots d'Éclats revenus, une fois chacun");
    assert.strictEqual(+q(`select sum(n) from mono.eclats where saison = 0`), tfAvant, "aucun Éclat créé ni perdu à la clôture (les 3 en vente reviennent au registre)");
    assert.strictEqual(q(`select user_id || '/' || coalesce(hdv::text, '-') from mono.collection where id = ${colId}`), U(5) + "/-", "objet de collection revenu à son vendeur");
    // kamas : chaque offre d'achat rend tout ce qui était mis de côté (rien n'a servi), les annonces rendent leurs objets
    assert.deepStrictEqual([2, 3, 5, 6].map(kamasDe), [kAv[0] + 153, kAv[1], kAv[2], kAv[3] + 143], "offres d'achat rendues (150 + 3, 140 + 3)");
    assert.strictEqual(q(`select string_agg(meta ->> 'valide', ',') from mono.eternel where saison = 0`), "true,true,true,true,true,true", "Éternel : les dernières parties validées");
    f = J(9, `mono_adm_fin_saison(0)`); assert.strictEqual(f.etat, "finie", "relancée : rien de plus");
    assert.strictEqual(+q(`select count(*) from mono.ops where txt like 'Fin de saison%'`), ouverts.h.length + ouverts.o.length);
    console.log(`ok - gel 24 h avant la fin, clôture coupée puis relancée : ${ouverts.h.length} annonces et ${ouverts.o.length} offres rendues une fois chacune, Éclats et kamas exacts`);

    // 10. HdV de l'Éternel : séparé de celui de la saison, réservé aux héros de la saison finie
    J(9, `mono_adm_saison(1, 'Saison 1', now() - interval '1 day', false, 'ouverte', 'Les Fragments du Temps')`);
    const e5 = J(5, `mono_hdv_list(0, 'res', 'Blé', null, 10, 1, 70, 'Blé', 1, null, 0)`); assert(e5.ok, "HdV de l'Éternel : " + JSON.stringify(e5));
    assert.strictEqual(q(`select monde from mono.hdv where seller = '${U(5)}' and status = 'open'`), "e");
    assert.strictEqual(J(1, `mono_hdv_market(null, null, null, null, 0)`).length, 1, "l'HdV de l'Éternel voit l'annonce");
    assert.match(JSON.stringify(J(1, `mono_hdv_list(0, 'res', 'Blé', null, 10, 1, 70, 'Blé', 1, null)`)), /pas encore validée/, "nouvelle saison : HdV de la saison 1, partie à valider d'abord");
    assert.strictEqual(J(1, `mono_hdv_market(null, null, null, null, null)`).length, 0, "l'HdV de la saison 1 ne voit pas l'Éternel");
    as(9, `select mono_adm_testeur('Joueur07', true)`);
    assert.match(JSON.stringify(J(7, `mono_hdv_list(0, 'res', 'Blé', null, 10, 1, 70, 'Blé', 1, null, 0)`)), /réservé aux héros de cette saison/, "Éternel : pas pour un compte sans héros de la saison");
    const be = J(1, `mono_hdv_buy(0, ${+q(`select id from mono.hdv where monde = 'e'`)}, 0)`); assert(be.ok, "achat dans l'Éternel " + JSON.stringify(be));
    console.log("ok - HdV de l'Éternel séparé de celui de la nouvelle saison");

    // 11. droits : aucune écriture directe, fonctions du Bouclier fermées aux joueurs, Classique intact
    for (const s of ["insert into mono.hdv (saison, monde, seller, cat, key, name, price) values (0, 's', auth.uid(), 'res', 'Blé', 'Blé', 1)", "update mono.objets set owner = auth.uid()",
      "insert into mono.ops (user_id, saison, payload) values (auth.uid(), 1, '{\"k\": 1}')", "select mono_srv_valider(auth.uid(), now()::text, '{}', '{}', 0, '[]')", "select mono.rendre(1, 'x')", "select mono.cloture_marche(0, 1)"])
      fails(() => as(1, s), /permission denied/, "écriture directe : " + s);
    assert.strictEqual(snap(), before, "schéma public toujours identique");
    assert(RPC.length > 20 && RPC.every((n) => /^mono_srv_/.test(n)));
    console.log("ok - tricheries refusées : " + CHEATS.length + "/" + CHEATS.length);
    for (const [l, w] of CHEATS) console.log("   - " + l + " : " + w);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} run(`drop database if exists ${DB}`, URL0); }
})().catch((e) => { console.error(e); try { run(`drop database if exists ${DB}`, URL0); } catch (x) {} process.exit(1); });
