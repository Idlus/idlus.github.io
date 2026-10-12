/* Test du compte et de la sauvegarde en ligne (0.1.15) dans un vrai navigateur, avec un faux serveur
   Supabase en mémoire (window.__IDLUS_SB) : connexion, pseudo, envoi, reprise, deux appareils.
   Lancer : node tests/online.test.js */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg" };
// le jeu est servi sous /beta/, comme la version de test
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/beta/, "");
  let file = path.join(ROOT, path.normalize(u).replace(/^(\.\.[/\\])+/, ""));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

/* Faux serveur : l'état vit dans le localStorage sous « __mock » (session, profils, partie). */
const MOCK = () => {
  const db = () => JSON.parse(localStorage.getItem("__mock") || '{"session":null,"profiles":[],"saves":{}}');
  const put = (d) => localStorage.setItem("__mock", JSON.stringify(d));
  const ts = () => new Date(Date.now()).toISOString().replace("Z", "000Z").replace(/\.(\d{3})000Z$/, ".$1" + String(Math.floor(Math.random() * 1000)).padStart(3, "0") + "Z");
  const q = (table) => {
    const f = []; let ins = null, ord = [], lim = 1e9, head = false;
    const rowsOf = () => { const d = db(); if (table === "profiles") return d.profiles; if (table === "saves") return Object.entries(d.saves).map(([user_id, s]) => Object.assign({ user_id }, s)); return (d.views || {})[table] || []; };
    const run = () => { let rows = rowsOf().slice(); f.forEach((fn) => { rows = rows.filter(fn); });
      ord.slice().reverse().forEach(([k, asc]) => rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1))); return rows.slice(0, lim); };
    const b = {
      select: (c, o) => { head = !!(o && o.head); return b; }, limit: (n) => { lim = n; return b; }, order: (k, o) => { ord.push([k, !o || o.ascending !== false]); return b; },
      eq: (k, v) => { f.push((r) => r[k] === v); return b; }, gt: (k, v) => { f.push((r) => r[k] > v); return b; }, lte: (k, v) => { f.push((r) => r[k] <= v); return b; },
      or: () => { f.push(() => false); return b; },
      ilike: (k, v) => { v = v.replace(/\\/g, ""); f.push((r) => String(r[k]).toLowerCase() === v.toLowerCase()); return b; },
      insert: (o) => { ins = o; return b; },
      maybeSingle: () => Promise.resolve({ data: run()[0] || null, error: null }),
      then: (ok, ko) => {
        if (ins) { const d = db(); if (d.profiles.some((p) => p.pseudo.toLowerCase() === ins.pseudo.toLowerCase())) return Promise.resolve({ error: { message: "duplicate key" } }).then(ok, ko); d.profiles.push(ins); put(d); return Promise.resolve({ error: null }).then(ok, ko); }
        const rows = run(); return Promise.resolve(head ? { count: rows.length, error: null } : { data: rows, error: null }).then(ok, ko);
      },
    };
    return b;
  };
  const user = () => db().session;
  window.__IDLUS_SB = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: user() ? { user: user() } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOAuth: async () => { const d = db(); d.session = { id: "u1", email: "test@idlus.fr", identities: [{ provider: "discord", identity_data: { global_name: "Testeur" } }] }; put(d); location.reload(); return { error: null }; },
      signInWithOtp: async () => ({ error: null }),
      signOut: async () => { const d = db(); d.session = null; put(d); return { error: null }; },
      linkIdentity: async () => ({ error: null }),
    },
    from: q,
    functions: { invoke: async (name, o) => { const d = db(); d.invoked = (d.invoked || []).concat([o.body.did]); put(d); return { data: Object.assign({ ok: true, did: o.body.did, dname: "Donjon test", k: 3, t: 72, improved: true, rank: 2 }, d.recordReply || {}), error: null }; } },
    rpc: async (name, a) => {
      const d = db(); const u = user(); if (!u) return { error: { message: "non connecté" } };
      if (window.__offline) throw new Error("Failed to fetch");
      const s = d.saves[u.id];
      if (name === "save_info") return { data: s ? [{ updated_at: s.updated_at, meta: s.meta, device: s.device, game_version: s.game_version }] : [], error: null };
      if (name === "push_save") {
        if (!a.p_force && ((a.p_expected == null && s) || (a.p_expected != null && (!s || s.updated_at !== a.p_expected)))) return { data: null, error: null };
        d.saves[u.id] = { data: a.p_data, meta: a.p_meta, device: a.p_device, game_version: a.p_version, updated_at: ts() }; d.pushes = (d.pushes || 0) + 1; put(d);
        return { data: d.saves[u.id].updated_at, error: null };
      }
      if (name === "delete_my_account") { delete d.saves[u.id]; d.profiles = d.profiles.filter((p) => p.id !== u.id); d.session = null; put(d); return { data: null, error: null }; }
    },
  }) };
};

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/beta/`;
  const errors = []; const fail = (m) => errors.push(m);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(MOCK);
    await ctx.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") fail(`console : ${m.text()}`); });
    page.on("pageerror", (e) => fail(`exception : ${e.message}`));
    const mock = () => page.evaluate(() => JSON.parse(localStorage.getItem("__mock") || "{}"));
    const S = () => page.evaluate(() => window.DX.S && { kamas: window.DX.S.kamas, n: window.DX.S.chars.length });

    // 1. premier lancement : écran de connexion, puis « Jouer sans compte »
    await page.goto(base); await page.waitForSelector('[data-act="on-discord"]', { timeout: 10000 });
    await page.click('[data-act="on-skip"]'); await page.waitForSelector('[data-act="startgame"]');
    await page.reload(); await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 }); // le choix est retenu
    // 2. partie sans compte, puis connexion depuis les Options : la partie de l'appareil est proposée
    await page.click('[data-act="startgame"]'); await page.waitForSelector("#nav [data-tab]");
    await page.evaluate(() => { window.DX.S.kamas = 4321; window.DX.saveNow(); });
    await page.click('[data-act="options"]'); await page.click('[data-act="on-loginscreen"]');
    await page.waitForSelector('[data-act="on-discord"]', { timeout: 10000 });
    await page.click('[data-act="on-discord"]');
    await page.waitForSelector("#onPseudo", { timeout: 10000 });
    await page.fill("#onPseudo", "a b"); await page.click('[data-act="on-pseudo"]'); await page.waitForTimeout(200);
    if (!/3 à 16/.test(await page.textContent("#onMsg"))) fail("pseudo invalide accepté");
    await page.fill("#onPseudo", "Xener"); await page.click('[data-act="on-pseudo"]');
    await page.waitForSelector('[data-act="on-send"]', { timeout: 10000 });
    await page.click('[data-act="on-send"]'); await page.waitForSelector("#nav [data-tab]");
    await page.waitForFunction(() => document.querySelector("#onPill") && document.querySelector("#onPill").dataset.st === "ok", null, { timeout: 10000 });
    let m = await mock();
    if (!m.saves.u1 || JSON.parse(m.saves.u1.data).kamas < 4321) fail("la partie n'a pas été envoyée");
    if (m.profiles[0].pseudo !== "Xener") fail("pseudo non enregistré");
    // 3. rechargement : on continue sans question
    await page.reload(); await page.waitForSelector("#nav [data-tab]", { timeout: 10000 });
    if (await page.$(".sheet .svc")) fail("question inattendue au rechargement");
    if ((await S()).kamas < 4321) fail("partie perdue au rechargement");
    // 4. autre appareil : la partie en ligne change, celle d'ici n'a pas bougé depuis le dernier envoi -> reprise directe
    await page.evaluate(() => { window.DX.saveNow(); });
    await page.click("#onPill"); await page.waitForTimeout(300);
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const st = JSON.parse(d.saves.u1.data); st.kamas = 99999; st.savedAt = Date.now(); d.saves.u1.data = JSON.stringify(st); d.saves.u1.updated_at = "2099-01-01T00:00:00.000001Z"; localStorage.setItem("__mock", JSON.stringify(d)); });
    // la page est rechargée sans laisser le jeu sauvegarder entre-temps
    await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("dofousxen-save-beta-online")); const st = JSON.parse(localStorage.getItem("dofousxen-save-beta")); l.savedAt = st.savedAt + 10 ** 9; localStorage.setItem("dofousxen-save-beta-online", JSON.stringify(l)); });
    await page.reload(); await page.waitForSelector("#nav [data-tab]", { timeout: 10000 }); await page.waitForTimeout(300);
    if ((await S()).kamas < 99999) fail("partie en ligne plus récente non reprise");
    // 5. conflit : les deux ont avancé -> question, on garde celle en ligne
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const st = JSON.parse(d.saves.u1.data); st.kamas = 55555; d.saves.u1.data = JSON.stringify(st); d.saves.u1.updated_at = "2099-01-02T00:00:00.000001Z"; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => { window.DX.S.kamas = 11111; });
    await page.click("#onPill");
    await page.waitForSelector('[data-act="on-keepremote"]', { timeout: 10000 });
    await page.click('[data-act="on-keepremote"]'); await page.waitForTimeout(500);
    if ((await S()).kamas < 55555) fail("conflit : version en ligne non chargée");
    // 6. conflit au lancement, on garde celle d'ici (envoi forcé)
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.saves.u1.updated_at = "2099-01-03T00:00:00.000001Z"; localStorage.setItem("__mock", JSON.stringify(d)); window.DX.S.kamas = 77777; window.DX.saveNow(); });
    await page.reload(); await page.waitForSelector('[data-act="on-keeplocal"]', { timeout: 10000 });
    await page.click('[data-act="on-keeplocal"]'); await page.waitForTimeout(1200);
    m = await mock();
    if (JSON.parse(m.saves.u1.data).kamas < 77777) fail("conflit : version d'ici non envoyée");
    // 7. hors ligne : pastille grise, le jeu continue
    await page.evaluate(() => { window.__offline = true; }); await page.click("#onPill"); await page.waitForTimeout(400);
    if ((await page.getAttribute("#onPill", "data-st")) !== "offline") fail("pastille hors ligne absente");
    await page.evaluate(() => { window.__offline = false; });
    // 7b. classements : liste, onglets, profil, record vérifié
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const H = [{ cls: "iop", lvl: 120, ren: 1, name: "Grokk", gear: [] }];
      d.views = { lb_level: [{ user_id: "u9", pseudo: "Kralamour", main: "iop", level: 4812, album: 150, succes: 300, heroes: H }, { user_id: "u8", pseudo: "Tofuline", main: "eni", level: 4650, album: 120, succes: 250, heroes: H }, { user_id: "u7", pseudo: "Bworkman", main: "sacri", level: 4377, album: 90, succes: 200, heroes: H }, { user_id: "u6", pseudo: "Xenerium", main: "cra", level: 4102, album: 80, succes: 150, heroes: H }],
        lb_class: [{ user_id: "u9", pseudo: "Kralamour", cls: "iop", score: 320 }], lb_records: [{ user_id: "u9", pseudo: "Kralamour", main: "iop", did: "x", dname: "Château", k: 10, t: 72 }], lb_week: [], firsts: [{ kind: "lvl200", key: "", label: "Premier héros au niveau 200", pseudo: "Kralamour", user_id: "u9", at: "2026-10-12T10:00:00Z" }] };
      localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.click('#nav [data-fam="adv"]'); await page.click('#subnav [data-tab="ladder"]');
    await page.waitForSelector(".podium .pod", { timeout: 10000 });
    if ((await page.$$(".lbt .lbr")).length < 2) fail("classement : lignes manquantes (dont la mienne)");
    for (const tb of ["dj", "album", "succ", "first", "lvl"]) { await page.click(`[data-act="lb-tab"][data-v="${tb}"]`); await page.waitForTimeout(250); if (/Chargement/.test(await page.textContent("#lbList"))) fail(`classement ${tb} : chargement sans fin`); }
    await page.selectOption('[data-act="lb-cls"]', "iop"); await page.waitForTimeout(250);
    if (!/Kralamour/.test(await page.textContent("#lbList"))) fail("filtre par classe vide");
    await page.click('.pod.p1'); await page.waitForSelector(".sheet .tm", { timeout: 5000 }); await page.click('[data-act="closesheet"].btn');
    await page.evaluate(() => { const S = window.DX.S; const did = Object.keys(window.DATA.DUNGEONS)[0]; S.stasis = S.stasis || {}; S.stasis[did] = { max: 3, sel: 3, firsts: {}, best: { 3: 80 } }; window.DX.saveNow(); });
    await page.click("#onPill"); await page.waitForSelector(".bigrec", { timeout: 8000 });
    if (!/Stasis 3/.test(await page.textContent(".bigrec"))) fail("fiche de record incorrecte");
    await page.click('[data-act="lb-goto"]'); await page.waitForTimeout(300);
    m = await mock(); if (!(m.invoked || []).length) fail("record non envoyé au serveur");
    // 8. mobile : la pastille tient dans la barre
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`page trop large sur téléphone : ${w}px`);
    // 9. suppression du compte
    await page.click('[data-act="options"]'); await page.click('[data-act="on-askdelete"]');
    await page.fill("#onDelPseudo", "xener"); await page.click('[data-act="on-delete"]'); await page.waitForTimeout(400);
    m = await mock(); if (m.saves.u1 || m.profiles.length) fail("compte non supprimé");
    if (!(await S())) fail("partie de l'appareil perdue après suppression");
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC :\n" + errors.join("\n")); process.exit(1); }
  console.log("Compte et sauvegarde en ligne : OK");
})();
