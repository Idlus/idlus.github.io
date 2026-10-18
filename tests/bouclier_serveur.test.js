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
const t0 = Date.now() - 3600e3;
T.saves.push({ user_id: "u1", data: E.serialize(S), meta: { level: 9999 }, updated_at: iso(t0) });
// 1. première vérification : la partie devient la partie validée, avec le résumé calculé par le serveur
let r = await call("u1", { verif: 1 });
if (!r.ok) fail("partie honnête refusée : " + JSON.stringify(r));
const ok1 = T.saves_ok.find((x) => x.user_id === "u1"); if (!ok1) fail("pas de partie validée");
if (ok1.meta.level === 9999 || ok1.meta.level !== V.summary(E, E.deserialize(ok1.data)).level) fail("le résumé vient du jeu, pas du serveur");
if (!T.saves_jour.length) fail("pas de copie du jour");
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
// 5. « C'est bon » de Mathis : la partie retenue est acceptée telle quelle
T.saves_ok[0].accept = true;
r = await call("u1", { verif: 1 }); if (!r.ok) fail("« C'est bon » n'accepte pas la partie : " + JSON.stringify(r));
if (T.saves_ok[0].accept) fail("l'accord de Mathis n'est valable qu'une fois");
console.log("ok - objet impossible retenu, « C'est bon » de Mathis l'accepte");
// 5 bis. 2.1.18 : compte vérifié par Mathis : plus de contrôle des gains, le signalement du Bouclier s'efface ; l'impossible reste refusé
Object.assign(L, { verified: true, flagged: false });
const S3 = E.deserialize(good); S3.kamas += 5e9; Object.assign(T.saves[0], { data: E.serialize(S3), updated_at: iso(t0 + 3800e3) });
T.saves_ok[0].at = iso(Date.now() - 60e3);
r = await call("u1", { verif: 1 }); if (!r.ok) fail("compte vérifié retenu pour ses gains : " + JSON.stringify(r));
if (L.suspect) fail("le signalement du Bouclier reste sur un compte vérifié");
const S4 = E.deserialize(good); const it4 = E.rollItem(S4, tpl, { radiant: false }); it4.stats.vit = 99999;
Object.assign(T.saves[0], { data: E.serialize(S4), updated_at: iso(t0 + 3900e3) }); T.saves_ok[0].at = iso(Date.now() - 60e3);
r = await call("u1", { verif: 1 }); if (r.ok) fail("objet impossible accepté sur un compte vérifié");
console.log("ok - compte vérifié : gains libres, impossible toujours refusé");
// 6. combats rejoués : ils partent de la partie validée (un record de donjon sur une partie retenue ne voit pas les retouches)
if (!/okSave\\(db, uid\\)/.test(${JSON.stringify(src)})) fail("les combats ne lisent pas la partie validée");
console.log("ok - les combats rejoués lisent la partie validée");
process.exit(0);
`);
try { const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", tmp], { stdio: "pipe" }); process.stdout.write(out.toString()); }
catch (e) { process.stdout.write(String(e.stdout || "")); process.stderr.write(String(e.stderr || "")); process.exit(1); }
finally { fs.rmSync(dir, { recursive: true, force: true }); }
