/* 2.1.4 « Bouclier du serveur » : la fonction serveur « record » ({ verif: 1 }) rejouée sans Deno, avec une base en mémoire.
   Vérifie : une partie honnête devient la partie validée (résumé calculé par le serveur, pas celui du jeu), une partie
   retouchée est retenue (compte suspect, raison notée, partie validée inchangée), « C'est bon » de Mathis l'accepte,
   une copie par jour est gardée. Lancer : node tests/bouclier_serveur.test.js (Node 22.6 et plus) */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 22 || (maj === 22 && min < 6)) { console.log("ok - (Node trop ancien : test sauté)"); process.exit(0); }
execFileSync(process.execPath, [path.join(ROOT, "tools/build_server.js")], { stdio: "pipe" });
const src = fs.readFileSync(path.join(ROOT, "supabase/functions/record/index.ts"), "utf8");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idlus-bouclier-"));
const tmp = path.join(dir, "record.mts");
const game = JSON.stringify(path.join(ROOT, "supabase/functions/record/game.js"));

/* base en mémoire : juste ce que la fonction utilise (select / eq / gt / lte / gte / lt / order / limit / maybeSingle, upsert, insert, delete, rpc) */
const fake = `
const T = globalThis.__T = { saves: [], saves_ok: [], admins: [], ladder: [], hdv_ops: [], gift_uses: [], bouclier_log: [], saves_jour: [] };
const q = (t) => { const f = []; let ord = null, lim = null, mode = "select", payload = null, conf = null;
  const rows = () => { let r = T[t].filter((x) => f.every((g) => g(x))); if (ord) r = r.slice().sort((a, b) => (a[ord.k] < b[ord.k] ? -1 : 1) * (ord.asc ? 1 : -1)); if (lim != null) r = r.slice(0, lim); return r; };
  const run = () => {
    if (mode === "delete") { const keep = T[t].filter((x) => !f.every((g) => g(x))); T[t] = keep; return { data: null, error: null }; }
    if (mode === "update") { T[t].filter((x) => f.every((g) => g(x))).forEach((x) => Object.assign(x, payload)); return { data: null, error: null }; }
    return { data: rows(), error: null }; };
  const b = { select() { return b; }, eq(k, v) { f.push((x) => x[k] === v); return b; }, gt(k, v) { f.push((x) => x[k] > v); return b; }, lte(k, v) { f.push((x) => x[k] <= v); return b; },
    gte(k, v) { f.push((x) => x[k] >= v); return b; }, lt(k, v) { f.push((x) => x[k] < v); return b; }, order(k, o) { ord = { k, asc: !o || o.ascending !== false }; return b; }, limit(n) { lim = n; return b; },
    maybeSingle() { const r = rows(); return Promise.resolve({ data: r[0] || null, error: null }); },
    delete() { mode = "delete"; return b; }, update(p) { mode = "update"; payload = p; return b; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    upsert(row, o) { const keys = (o && o.onConflict ? o.onConflict.split(",") : ["user_id"]); const i = T[t].findIndex((x) => keys.every((k) => x[k] === row[k]));
      if (i >= 0) { if (!(o && o.ignoreDuplicates)) T[t][i] = Object.assign({}, T[t][i], row); } else T[t].push(Object.assign({}, row)); return Promise.resolve({ error: null }); },
    insert(row) { T[t].push(Object.assign({ at: new Date().toISOString() }, row)); return Promise.resolve({ error: null }); } };
  return b; };
const createClient = () => ({ auth: { getUser: async (j) => ({ data: { user: j ? { id: j } : null } }) }, from: q,
  rpc: async (name, a) => { if (name === "bouclier_signal") { const l = T.ladder.find((x) => x.user_id === a.p_user); if (l) Object.assign(l, { suspect: true, flag_reason: "Bouclier : " + a.p_why }); else T.ladder.push({ user_id: a.p_user, suspect: true, flag_reason: "Bouclier : " + a.p_why }); } return { data: null, error: null }; } });
let H = null; globalThis.Deno = { serve(h) { H = h; }, env: { get() { return "x"; } } };
`;
fs.writeFileSync(tmp, fake + `import { D, E, V } from ${game};\n` + src.replace(/^import .*$/gm, "") + `
const call = async (uid, body) => (await H(new Request("http://x/", { method: "POST", headers: { Authorization: "Bearer " + uid }, body: JSON.stringify(body) }))).json();
const fail = (m) => { console.error("ÉCHEC - " + m); process.exit(1); };
const iso = (t) => new Date(t).toISOString();
const S = E.newState("Honnête", "iop"); E.addChar(S, "cra", "Archer", 30); S.kamas = 1000;
S.ach.sec_minuit = 1; S.ach.rq1 = 1; // 2.1.34.1 : succès de js/quetes.js (points de succès du classement)
const t0 = Date.now() - 3600e3;
T.saves.push({ user_id: "u1", data: E.serialize(S), meta: { level: 9999 }, updated_at: iso(t0) });
// 1. première vérification : la partie devient la partie validée, avec le résumé calculé par le serveur
let r = await call("u1", { verif: 1 });
if (!r.ok) fail("partie honnête refusée : " + JSON.stringify(r));
const ok1 = T.saves_ok.find((x) => x.user_id === "u1"); if (!ok1) fail("pas de partie validée");
if (ok1.meta.level === 9999 || ok1.meta.level !== V.summary(E, E.deserialize(ok1.data)).level) fail("le résumé vient du jeu, pas du serveur");
if (!T.saves_jour.length) fail("pas de copie du jour");
if (!(ok1.meta.pts > 0) || ok1.meta.pts !== E.achPoints(E.deserialize(ok1.data))) fail("points de succès faux dans le résumé du serveur : " + ok1.meta.pts);
console.log("ok - partie validée, résumé calculé par le serveur, copie du jour");
// 2. une heure plus tard, +200 000 kamas : normal
S.kamas += 200000; Object.assign(T.saves[0], { data: E.serialize(S), updated_at: iso(t0 + 3600e3) });
T.saves_ok[0].at = iso(Date.now() - 60e3); // passé le délai entre deux vérifications
r = await call("u1", { verif: 1 }); if (!r.ok || r.later || r.same) fail("gain normal refusé : " + JSON.stringify(r));
// 3. une minute après, un milliard de kamas : retenu
const good = T.saves_ok[0].data;
S.kamas += 1e9; Object.assign(T.saves[0], { data: E.serialize(S), updated_at: iso(t0 + 3660e3) });
T.saves_ok[0].at = iso(Date.now() - 60e3); // passé le délai entre deux vérifications
r = await call("u1", { verif: 1 }); if (r.ok || !r.held) fail("milliard de kamas accepté : " + JSON.stringify(r));
if (T.saves_ok[0].data !== good) fail("la partie validée a changé");
const L = T.ladder.find((x) => x.user_id === "u1"); if (!L || !L.suspect || !/kamas/.test(L.flag_reason)) fail("compte non signalé");
if (!T.bouclier_log.length) fail("raison non notée pour le panel");
console.log("ok - " + T.bouclier_log[0].why);
// 4. un objet retouché : retenu aussi
const S2 = E.deserialize(good); const tpl = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].stats.vit && D.ITEMS[k].stats.vit[1] > 0);
const it = E.rollItem(S2, tpl, { radiant: false }); it.stats.vit = 99999;
Object.assign(T.saves[0], { data: E.serialize(S2), updated_at: iso(t0 + 3700e3) });
r = await call("u1", { verif: 1 }); if (r.ok) fail("objet à 99 999 Vitalité accepté");
// 5. « C'est bon » de Mathis : la partie retenue pour ses gains est acceptée telle quelle ; 2.1.25 : jamais une partie impossible
T.saves_ok[0].accept = true;
r = await call("u1", { verif: 1 }); if (r.ok) fail("« C'est bon » accepte un objet impossible");
const S1 = E.deserialize(good); S1.kamas += 1e9; Object.assign(T.saves[0], { data: E.serialize(S1), updated_at: iso(t0 + 3750e3) });
r = await call("u1", { verif: 1 }); if (!r.ok) fail("« C'est bon » n'accepte pas la partie : " + JSON.stringify(r));
if (T.saves_ok[0].accept) fail("l'accord de Mathis n'est valable qu'une fois");
console.log("ok - objet impossible retenu même après « C'est bon », gains acceptés par « C'est bon »");
// 5 bis. 2.1.18 : compte vérifié par Mathis : marge plus large sur les gains (15 h de kamas pour 10 h de réserve), le signalement du Bouclier s'efface ; l'impossible reste refusé
Object.assign(L, { verified: true, flagged: false });
T.saves_ok[0].res = 10; const S3 = E.deserialize(good); S3.kamas += Math.floor(V.rates(30).k * 15);
Object.assign(T.saves[0], { data: E.serialize(S3), updated_at: iso(t0 + 3800e3) });
T.saves_ok[0].at = iso(Date.now() - 60e3);
r = await call("u1", { verif: 1 }); if (!r.ok || r.same || r.later) fail("compte vérifié retenu pour ses gains : " + JSON.stringify(r));
if (L.suspect) fail("le signalement du Bouclier reste sur un compte vérifié");
const S4 = E.deserialize(good); const it4 = E.rollItem(S4, tpl, { radiant: false }); it4.stats.vit = 99999;
Object.assign(T.saves[0], { data: E.serialize(S4), updated_at: iso(t0 + 3900e3) }); T.saves_ok[0].at = iso(Date.now() - 60e3);
r = await call("u1", { verif: 1 }); if (r.ok) fail("objet impossible accepté sur un compte vérifié");
// 2.1.25 : le temps de jeu reste contrôlé même pour un compte vérifié
const S5 = E.deserialize(good); S5.stats.playtime += 160 * 3600;
Object.assign(T.saves[0], { data: E.serialize(S5), updated_at: iso(t0 + 4000e3) }); T.saves_ok[0].at = iso(Date.now() - 60e3);
r = await call("u1", { verif: 1 }); if (r.ok) fail("+160 h de temps de jeu accepté sur un compte vérifié");
console.log("ok - compte vérifié : marge plus large, temps de jeu et impossible toujours refusés");
// 6. combats rejoués : ils partent de la partie validée (un record de donjon sur une partie retenue ne voit pas les retouches)
if (!/okSave\\(db, uid\\)/.test(${JSON.stringify(src)})) fail("les combats ne lisent pas la partie validée");
console.log("ok - les combats rejoués lisent la partie validée");
// 7. refonte des alignements : le serveur charge js/honneur.js (honneur et rang dans le résumé, partie v13 convertie, pièces de rang connues)
{ const P = E.newState("Milicien", "iop"); P.chars[0].lvl = 200; E.chooseAlign(P, "bonta", "coeur");
  const o13 = JSON.parse(E.serialize(P)); o13.v = 13; o13.align = { side: "bonta", order: "coeur", lvl: 100, xp: 0, q: o13.align.q, war: o13.align.war }; // partie d'avant la refonte
  T.saves.push({ user_id: "u2", data: JSON.stringify(o13), meta: {}, updated_at: iso(t0) });
  r = await call("u2", { verif: 1 }); if (!r.ok) fail("partie v13 refusée : " + JSON.stringify(r));
  const k2 = T.saves_ok.find((x) => x.user_id === "u2"); const a2 = k2.meta.align || {};
  if (a2.h !== E.honCum(10) || a2.r !== 10) fail("résumé du serveur sans l'honneur converti : " + JSON.stringify(a2));
  if (k2.data !== JSON.stringify(o13)) fail("la partie validée n'est pas celle envoyée");
  const P2 = E.deserialize(JSON.stringify(o13)); P2.align.pur = 20000; E.HON_GEAR_SLOTS.forEach((sl) => E.honBuy(P2, sl));
  Object.values(P2.items).filter((x) => /^hon_/.test(x.tpl)).forEach((x) => E.equip(P2, P2.chars[0].id, x.uid, D.ITEMS[x.tpl].slot === "anneau" ? "anneau1" : D.ITEMS[x.tpl].slot));
  Object.assign(T.saves.find((x) => x.user_id === "u2"), { data: E.serialize(P2), updated_at: iso(t0 + 3600e3) }); k2.at = iso(Date.now() - 60e3);
  r = await call("u2", { verif: 1 }); if (!r.ok) fail("partie avec les pièces de rang refusée : " + JSON.stringify(r));
  const back = E.deserialize(T.saves_ok.find((x) => x.user_id === "u2").data); if (Object.values(back.items).filter((x) => /^hon_/.test(x.tpl)).length !== 5) fail("pièces de rang perdues");
  if (T.saves_ok.find((x) => x.user_id === "u2").meta.align.r !== 10) fail("rang perdu"); }
console.log("ok - alignements : honneur et rang calculés par le serveur, partie v13 convertie, pièces de rang acceptées");
process.exit(0);
`);
try { const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", tmp], { stdio: "pipe" }); process.stdout.write(out.toString()); }
catch (e) { process.stdout.write(String(e.stdout || "")); process.stderr.write(String(e.stderr || "")); process.exit(1); }
finally { fs.rmSync(dir, { recursive: true, force: true }); }
