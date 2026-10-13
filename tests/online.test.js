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
    const f = []; let ins = null, del = false, ord = [], lim = 1e9, head = false;
    const rowsOf = () => { const d = db(); if (table === "profiles") return d.profiles; if (table === "saves") return Object.entries(d.saves).map(([user_id, s]) => Object.assign({ user_id }, s)); return (d.views || {})[table] || []; };
    const run = () => { let rows = rowsOf().slice(); f.forEach((fn) => { rows = rows.filter(fn); });
      ord.slice().reverse().forEach(([k, asc]) => rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1))); return rows.slice(0, lim); };
    const b = {
      select: (c, o) => { head = !!(o && o.head); return b; }, limit: (n) => { lim = n; return b; }, order: (k, o) => { ord.push([k, !o || o.ascending !== false]); return b; },
      eq: (k, v) => { f.push((r) => r[k] === v); return b; }, in: (k, v) => { f.push((r) => v.includes(r[k])); return b; }, delete: () => { del = true; return b; }, gt: (k, v) => { f.push((r) => r[k] > v); return b; }, lte: (k, v) => { f.push((r) => r[k] <= v); return b; },
      or: () => { f.push(() => false); return b; },
      ilike: (k, v) => { v = v.replace(/\\/g, ""); f.push((r) => String(r[k]).toLowerCase() === v.toLowerCase()); return b; },
      insert: (o) => { ins = o; return b; },
      maybeSingle: () => Promise.resolve({ data: run()[0] || null, error: null }),
      then: (ok, ko) => {
        if (ins && table !== "profiles") { const d = db(); d.views = d.views || {}; (d.views[table] = d.views[table] || []).push(ins); put(d); return Promise.resolve({ error: null }).then(ok, ko); }
        if (del) { const d = db(); const gone = run(); d.views[table] = (d.views[table] || []).filter((r) => !gone.some((g) => JSON.stringify(g) === JSON.stringify(r))); put(d); return Promise.resolve({ error: null }).then(ok, ko); }
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
    channel: () => { const hs = []; const ch = { on: (ev, o, cb) => { if (ev === "postgres_changes") hs.push(cb); return ch; }, subscribe: (cb) => { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; }, track: () => {}, presenceState: () => ({ u1: [{}], u9: [{}], u8: [{}] }) };
      window.__chatEmit = (m) => hs.forEach((cb) => cb({ new: m })); return ch; },
    removeChannel: () => {},
    functions: { invoke: async (name, o) => { const d = db(); d.invoked = (d.invoked || []).concat([o.body.did]); put(d); return { data: Object.assign({ ok: true, did: o.body.did, dname: "Donjon test", k: 3, t: 72, improved: true, rank: 2 }, d.recordReply || {}), error: null }; } },
    rpc: async (name, a) => {
      const d = db(); const u = user(); if (!u) return { error: { message: "non connecté" } };
      if (window.__offline) throw new Error("Failed to fetch");
      const s = d.saves[u.id];
      // 0.1.50.1 : changer son pseudo (une fois tous les 30 jours)
      if (name === "pseudo_info") { const me = d.profiles.find((p) => p.id === u.id); return { data: me ? { at: me.pseudo_at || null, next: me.pseudo_at ? new Date(Date.parse(me.pseudo_at) + 30 * 864e5).toISOString() : null } : null, error: null }; }
      if (name === "pseudo_change") { const me = d.profiles.find((p) => p.id === u.id); const p = a.p_pseudo;
        if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,16}$/.test(p)) return { data: "3 à 16 caractères", error: null };
        if (me.pseudo_at && Date.now() - Date.parse(me.pseudo_at) < 30 * 864e5) return { data: "Tu pourras rechanger de pseudo le 12/11.", error: null };
        if (d.profiles.some((x) => x.id !== u.id && x.pseudo.toLowerCase() === p.toLowerCase())) return { data: "Ce pseudo est déjà pris.", error: null };
        me.pseudo = p; me.pseudo_at = new Date().toISOString(); put(d); return { data: null, error: null }; }
      if (name === "save_info") return { data: s ? [{ updated_at: s.updated_at, meta: s.meta, device: s.device, game_version: s.game_version }] : [], error: null };
      if (name === "push_save") {
        if (!a.p_force && ((a.p_expected == null && s) || (a.p_expected != null && (!s || s.updated_at !== a.p_expected)))) return { data: null, error: null };
        d.saves[u.id] = { data: a.p_data, meta: a.p_meta, device: a.p_device, game_version: a.p_version, updated_at: ts() }; d.pushes = (d.pushes || 0) + 1; put(d);
        return { data: d.saves[u.id].updated_at, error: null };
      }
      const me = d.profiles.find((p) => p.id === u.id); const log = () => { d.admCalls = (d.admCalls || []).concat([[name, a]]); put(d); };
      if (name === "chat_send") {
        if (/www\.|https?:/.test(a.p_body)) return { data: "Les liens ne sont pas autorisés dans le chat.", error: null };
        d.views = d.views || {}; const L = (d.views.chat_msgs = d.views.chat_msgs || []);
        const m = { id: 1000 + L.length, ch: a.p_to ? "p" : a.p_ch || "g", user_id: u.id, to_id: a.p_to, pseudo: me && me.pseudo, cls: "iop", lvl: 50, body: a.p_body, item: a.p_item, kind: "msg", created_at: new Date().toISOString() };
        L.push(m); put(d); setTimeout(() => window.__chatEmit && window.__chatEmit(m), 50); return { data: null, error: null };
      }
      if (name === "chat_report") { d.reports = (d.reports || []).concat([a]); put(d); return { data: null, error: null }; }
      if (name === "chat_me") return { data: { banned: false }, error: null };
      if (name === "staff_list") return { data: [{ u: "u9", p: "Kralamour", r: "crea" }, { u: "u8", p: "Tofuline", r: "mod" }], error: null };
      if (name === "my_role") return { data: d.role || null, error: null };
      if (name === "adm_overview") return { data: { accounts: d.profiles.length, active: 1, reports: 1, flagged: 0, muted: 0, signups: [{ id: "u9", pseudo: "Kralamour", cls: "iop", at: new Date().toISOString() }], log: [{ at: new Date().toISOString(), txt: "test", who: "Xener" }], settings: { min_level: 0, slow_s: 4 }, role: d.role }, error: null };
      if (name === "adm_players") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", level: 4812, playtime: 7200, heroes: [{ cls: "iop", lvl: 200, ren: 1 }], created_at: new Date().toISOString(), last_save: new Date().toISOString(), reports: 1, flagged: false }], error: null };
      if (name === "adm_msgs" || name === "adm_mods" || name === "adm_flagged") return { data: [], error: null };
      if (name === "adm_reports") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", n: 1, reasons: "Spam", bodies: ["coucou"] }], error: null };
      if (name === "adm_announce") { log(); d.views = d.views || {}; (d.views.announces = d.views.announces || []).push({ id: 7, body: a.p_body, banner: true, until: null }); put(d); return { data: null, error: null }; }
      // 0.1.20 : hôtel de vente (une seule annonce, achetée une fois)
      const tpl = Object.keys(window.DATA.ITEMS).find((k) => window.DATA.ITEMS[k].lvl === 60 && window.DATA.ITEMS[k].slot === "coiffe"); const T = window.DATA.ITEMS[tpl];
      const item = { tpl, stats: Object.fromEntries(Object.entries(T.stats).map(([k, [lo]]) => [k, lo])) };
      if (name === "hdv_search") return { data: d.hdvSold ? [] : [{ cat: "eq", key: tpl, name: T.name, lvl: T.lvl, slot: T.slot, n: 1, qty: 1, unit: 5000 }], error: null };
      if (name === "hdv_offers") return { data: d.hdvSold ? [] : [{ id: 1, qty: 1, price: 5000, item, mine: false, exp: new Date(Date.now() + 864e5 * 14).toISOString() }], error: null };
      if (name === "hdv_stats") return { data: { avg: 4800, week: 3, days: [{ d: "2026-10-10", u: 4600 }, { d: "2026-10-11", u: 5000 }] }, error: null };
      if (name === "hdv_mine") return { data: { open: [], sold: [] }, error: null };
      if (name === "brisage_list" || name === "brisage_hit") return { data: {}, error: null };
      if (name === "hdv_sync" || name === "trade_state") return { data: name === "hdv_sync" ? { ops: [] } : null, error: null };
      if (name === "hdv_buy") { if (d.hdvSold) return { data: { err: "Déjà vendu." }, error: null }; d.hdvSold = true; put(d); return { data: { ok: true, ops: [{ id: 1, p: { k: -5000, add: [item] }, t: "Acheté : " + T.name }] }, error: null }; }
      // 0.1.33 : offres d'achat
      if (name === "hdv_orders_list") return { data: d.ordSold ? [] : [{ id: 5, cat: "res", key: "Laine de Bouftou", name: "Laine de Bouftou", lvl: 1, left: 50, qty: 50, price: 30, exp: new Date(Date.now() + 864e5 * 3).toISOString(), mine: false }], error: null };
      if (name === "hdv_orders_mine") return { data: d.ordMine || [], error: null };
      if (name === "hdv_order_new") { const held = a.p_qty * a.p_price + Math.ceil(a.p_qty * a.p_price * 0.02); d.ordMine = [{ id: 9, cat: a.p_cat, key: a.p_key, name: a.p_name, qty: a.p_qty, filled: 0, price: a.p_price, held, st: "open", exp: new Date(Date.now() + 864e5 * a.p_days).toISOString() }]; put(d);
        return { data: { ok: true, ops: [{ id: 3, p: { k: -held }, t: "Offre d'achat" }] }, error: null }; }
      if (name === "hdv_order_fill") { d.ordSold = true; put(d); return { data: { ok: true, n: a.p_qty, k: a.p_qty * 30, ops: [{ id: 2, p: { k: a.p_qty * 30, res: { "Laine de Bouftou": -a.p_qty } }, t: "Vendu à une offre d'achat" }] }, error: null }; }
      if (name === "guild_me") return { data: { g: null, invites: [{ gid: 3, name: "Les Bouftous", ic: "dofus", col: "#8cc63f", lvl: 4, n: 7, by: "Kralamour" }], asks: [] }, error: null };
      if (name === "guild_list") return { data: [{ id: 3, name: "Les Bouftous", ic: "dofus", col: "#8cc63f", lvl: 4, open: true, motd: "", n: 7, chef: "Kralamour" }], error: null };
      if (name === "guild_give" || name === "guild_chat") return { data: name === "guild_chat" ? [] : { ok: false, none: true }, error: null };
      if (name === "adm_hdv") return { data: { open: 1, sellers: 1, sales7: 0, vol7: 0, trades7: 0, last: [], top: [{ id: 1, name: T.name, qty: 1, price: 5000, s: "Kralamour" }] }, error: null };
      // 0.1.36 : boîte à idées
      if (name === "idea_send") { const L = (d.ideas = d.ideas || []); if (L.some((x) => x.user_id === u.id && Date.now() - x.t < 600000)) return { data: "Une idée toutes les 10 minutes : réessaie un peu plus tard.", error: null };
        L.push({ id: L.length + 1, user_id: u.id, t: Date.now(), pseudo: me && me.pseudo, info: a.p_info, tag: a.p_tag, title: a.p_title, body: a.p_body, hidden: false, url: null, created_at: new Date().toISOString(), guest: false }); put(d); return { data: null, error: null }; }
      if (name === "adm_ideas") return { data: (d.ideas || []).slice().reverse(), error: null };
      if (name === "adm_pin") { log(); d.views = d.views || {}; d.views.chat_settings = [{ id: 1, pin_body: a.p_body, pin_chs: a.p_chs, pin_at: ts() }]; put(d); return { data: null, error: null }; } // 0.1.50.2
      if (name.startsWith("adm_")) { log(); return { data: null, error: null }; }
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

    // 1. premier lancement : pas de compte obligatoire, on arrive directement sur le choix du héros
    await page.goto(base); await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    if (await page.$('[data-act="on-discord"]')) fail("écran de connexion au premier lancement");
    // « Se connecter » depuis l'écran de départ, puis « Continuer sans compte » : le choix est retenu
    await page.click('.start [data-act="on-loginscreen"]'); await page.waitForSelector('[data-act="on-discord"]', { timeout: 10000 });
    await page.click('[data-act="on-skip"]'); await page.waitForSelector('[data-act="startgame"]');
    await page.reload(); await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    // 2. partie sans compte, puis connexion depuis les Options : la partie de l'appareil est proposée
    await page.click('[data-act="startgame"]'); await page.waitForSelector("#nav [data-nk]");
    await page.evaluate(() => { window.DX.S.kamas = 4321; window.DX.saveNow(); });
    await page.click('[data-act="options"]'); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-loginscreen"]');
    await page.waitForSelector('[data-act="on-discord"]', { timeout: 10000 });
    await page.click('[data-act="on-discord"]');
    await page.waitForSelector("#onPseudo", { timeout: 10000 });
    await page.fill("#onPseudo", "a b"); await page.click('[data-act="on-pseudo"]'); await page.waitForTimeout(200);
    if (!/3 à 16/.test(await page.textContent("#onMsg"))) fail("pseudo invalide accepté");
    await page.fill("#onPseudo", "Xen3r"); await page.click('[data-act="on-pseudo"]'); await page.waitForTimeout(200);
    if ((await mock()).profiles.length) fail("pseudo qui imite le créateur accepté");
    await page.fill("#onPseudo", "Bouftou"); await page.click('[data-act="on-pseudo"]');
    await page.waitForSelector('[data-act="on-send"]', { timeout: 10000 });
    await page.click('[data-act="on-send"]'); await page.waitForSelector("#nav [data-nk]");
    await page.waitForFunction(() => document.querySelector("#onPill") && document.querySelector("#onPill").dataset.st === "ok", null, { timeout: 10000 });
    let m = await mock();
    if (!m.saves.u1 || JSON.parse(m.saves.u1.data).kamas < 4321) fail("la partie n'a pas été envoyée");
    if (m.profiles[0].pseudo !== "Bouftou") fail("pseudo non enregistré");
    // 3. rechargement : on continue sans question
    await page.reload(); await page.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    if (await page.$(".sheet .svc")) fail("question inattendue au rechargement");
    if ((await S()).kamas < 4321) fail("partie perdue au rechargement");
    // 4. autre appareil : la partie en ligne change, celle d'ici n'a pas bougé depuis le dernier envoi -> reprise directe
    await page.evaluate(() => { window.DX.saveNow(); });
    await page.click("#onPill"); await page.waitForTimeout(300);
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const st = JSON.parse(d.saves.u1.data); st.kamas = 99999; st.savedAt = Date.now(); d.saves.u1.data = JSON.stringify(st); d.saves.u1.updated_at = "2099-01-01T00:00:00.000001Z"; localStorage.setItem("__mock", JSON.stringify(d)); });
    // la page est rechargée sans laisser le jeu sauvegarder entre-temps
    await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("dofousxen-save-beta-online")); const st = JSON.parse(localStorage.getItem("dofousxen-save-beta")); l.savedAt = st.savedAt + 10 ** 9; localStorage.setItem("dofousxen-save-beta-online", JSON.stringify(l)); });
    await page.reload(); await page.waitForSelector("#nav [data-nk]", { timeout: 10000 }); await page.waitForTimeout(300);
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
    await page.click('#nav [data-nk="ladder"]');
    await page.waitForSelector(".podium .pod", { timeout: 10000 });
    if ((await page.$$(".lbt .lbr")).length < 2) fail("classement : lignes manquantes (dont la mienne)");
    if (!(await page.$(".pod.is-crea .xtag")) || !(await page.$(".pod .mtag"))) fail("classement : badges créateur et modérateur absents");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/lb.png" });
    for (const tb of ["dj", "album", "succ", "first", "lvl"]) { await page.click(`[data-act="lb-tab"][data-v="${tb}"]`); await page.waitForTimeout(250); if (/Chargement/.test(await page.textContent("#lbList"))) fail(`classement ${tb} : chargement sans fin`); }
    await page.selectOption('[data-act="lb-cls"]', "iop"); await page.waitForTimeout(250);
    if (!/Kralamour/.test(await page.textContent("#lbList"))) fail("filtre par classe vide");
    await page.click('.pod.p1'); await page.waitForSelector(".sheet .tm", { timeout: 5000 }); await page.click('[data-act="closesheet"].btn');
    await page.evaluate(() => { const S = window.DX.S; const did = Object.keys(window.DATA.DUNGEONS)[0]; S.stasis = S.stasis || {}; S.stasis[did] = { max: 3, sel: 3, firsts: {}, best: { 3: 80 } }; window.DX.saveNow(); });
    await page.click("#onPill"); await page.waitForSelector(".bigrec", { timeout: 8000 });
    if (!/Stasis 3/.test(await page.textContent(".bigrec"))) fail("fiche de record incorrecte");
    await page.click('[data-act="lb-goto"]'); await page.waitForTimeout(300);
    m = await mock(); if (!(m.invoked || []).length) fail("record non envoyé au serveur");
    // 7c. chat : lecture, envoi, refus d'un lien, objet montré, menu d'un joueur, signalement, ignorer, privé
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const t = new Date().toISOString();
      d.views.chat_msgs = [{ id: 1, ch: "g", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, title: "Maître de la semaine", body: "Salut !", kind: "msg", created_at: t },
        { id: 2, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, kind: "ann", data: { t: "first", label: "Premier héros au niveau 200" }, created_at: t }];
      d.views.chat_settings = [{ id: 1, pin_body: "💡 Une idée pour améliorer Idlus ? Partagez-la ici ou dans la Boîte à idées !", pin_chs: "g", pin_at: "2026-10-13T10:00:00Z" }];
      localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.CHAT.refresh()); await page.waitForSelector("#chat .chmin", { timeout: 5000 });
    await page.click("#chat .chmin"); await page.waitForSelector("#chat .ch-list .msg", { timeout: 5000 });
    // 0.1.50.2 : message épinglé en haut du Général (ampoule du jeu à la place de l'emoji), absent du Commerce, la croix le cache jusqu'au lendemain
    if (!(await page.$("#chat .ch-pin .pi"))) fail("chat : message épinglé absent du Général");
    else if (/💡/.test(await page.textContent("#chat .ch-pin")) || !/Une idée pour améliorer Idlus \?/.test(await page.textContent("#chat .ch-pin b"))) fail("chat : message épinglé mal affiché");
    if (!(await page.$('#chat .ch-pin [data-act="nav"][data-v="sugg"]'))) fail("chat : bouton Boîte à idées absent du message épinglé");
    await page.click('#chat [data-act="ch-tab"][data-v="c"]'); await page.waitForTimeout(100);
    if (await page.$("#chat .ch-pin")) fail("chat : message épinglé dans le Commerce");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(100);
    await page.click('#chat [data-act="ch-pinx"]'); await page.waitForTimeout(100);
    if (await page.$("#chat .ch-pin")) fail("chat : message épinglé toujours là après la croix");
    // 0.1.33.2 : les hauts faits ont leur onglet, le Général ne garde que les joueurs et les annonces officielles
    if (/entre dans l'histoire/.test(await page.textContent("#chat .ch-list"))) fail("chat : haut fait encore dans le Général");
    await page.click('#chat [data-act="ch-tab"][data-v="h"]'); await page.waitForTimeout(100);
    if (!/entre dans l'histoire/.test(await page.textContent("#chat .ch-list"))) fail("chat : haut fait absent de l'onglet Hauts faits");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-hf.png" });
    // 0.1.35.3 : le bouton pour réduire le chat reste dans le cadre, même avec tous les onglets et des pastilles
    if (await page.evaluate(() => { const C = window.CHAT.state; C.unread = 120; C.unreadP = 15; C.unreadH = 99; window.CHAT.repaint(); const c = document.querySelector("#chat").getBoundingClientRect(), x = document.querySelector("#chat .ch-x").getBoundingClientRect(); C.unread = C.unreadP = C.unreadH = 0; window.CHAT.repaint(); return x.right > c.right || x.left < c.left; })) fail("chat : bouton de fermeture hors du cadre (PC)");
    // 0.1.48.2 : salons Commerce et PvP
    await page.click('#chat [data-act="ch-tab"][data-v="c"]'); await page.waitForSelector("#chIn");
    if (!/Commerce : achat/.test(await page.textContent("#chat .ch-list"))) fail("chat : salon Commerce absent");
    await page.fill("#chIn", "Je vends une Coiffe Bouftou"); await page.press("#chIn", "Enter"); await page.waitForTimeout(400);
    if (!(await mock()).views.chat_msgs.some((x) => x.ch === "c" && /Coiffe Bouftou/.test(x.body))) fail("chat : message de commerce non envoyé dans le bon salon");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-commerce.png" });
    await page.click('#chat [data-act="ch-tab"][data-v="v"]'); await page.waitForTimeout(100);
    if (!/PvP : Kolizéum/.test(await page.textContent("#chat .ch-list"))) fail("chat : salon PvP absent");
    await page.evaluate(() => window.__chatEmit({ id: 777, ch: "v", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, kind: "ann", data: { t: "koli", g: 3, cote: 1520 }, created_at: new Date().toISOString() })); await page.waitForTimeout(100);
    if (!/grade/.test(await page.textContent("#chat .ch-list"))) fail("chat : annonce du Kolizéum absente du salon PvP");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(4200); // le Général garde son rythme de 4 s
    // 0.1.47.6 : chat ouvert, les notifications s'écartent ; pendant qu'on écrit, elles attendent
    await page.evaluate(() => window.DX.social.toast("Test de notification"));
    if (await page.evaluate(() => { const t = document.querySelector("#toasts").getBoundingClientRect(), c = document.querySelector("#chat").getBoundingClientRect(); return t.right > c.left; })) fail("notifications : elles recouvrent le chat (PC)");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/notif-pc.png" });
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForSelector("#chIn");
    await page.fill("#chIn", "Je suis en train d'écrire"); await page.focus("#chIn");
    await page.evaluate(() => { document.querySelectorAll("#toasts .toast").forEach((e) => e.remove()); window.DX.social.toast("Pendant la frappe"); });
    if (await page.$("#toasts .toast")) fail("notifications : affichées pendant qu'on écrit");
    await page.fill("#chIn", ""); await page.waitForTimeout(900);
    if (!/Pendant la frappe/.test(await page.textContent("#toasts"))) fail("notifications : pas rendues une fois le champ vidé");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(100);
    // 0.1.29.1 : badge du créateur (liste donnée par le serveur)
    if (!(await page.$("#chat .msg.is-crea .xen .crown")) || !/Créateur/.test(await page.textContent("#chat .msg.is-crea"))) fail("chat : badge du créateur absent");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat.png" });
    await page.fill("#chIn", "va sur www.test.fr"); await page.press("#chIn", "Enter"); await page.waitForSelector("#chat .ch-hint .bad", { timeout: 5000 });
    await page.fill("#chIn", "Bonjour à tous"); await page.press("#chIn", "Enter"); await page.waitForTimeout(400);
    if (!/Bonjour à tous/.test(await page.textContent("#chat .ch-list"))) fail("chat : message envoyé absent");
    await page.evaluate(() => { const m = { id: 50, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Coucou en direct", kind: "msg", created_at: new Date().toISOString() };
      const d = JSON.parse(localStorage.getItem("__mock")); d.views.chat_msgs.push(m); localStorage.setItem("__mock", JSON.stringify(d)); window.__chatEmit(m); }); await page.waitForTimeout(200);
    if (!/Coucou en direct/.test(await page.textContent("#chat .ch-list"))) fail("chat : message en temps réel absent");
    // 0.1.31.1 : le chat garde la position de lecture quand il se redessine, et signale les nouveaux messages
    await page.evaluate(() => { const C = window.CHAT.state; for (let i = 0; i < 40; i++) C.g.push({ id: 500 + i, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Ligne " + i, kind: "msg", created_at: new Date().toISOString() }); window.CHAT.repaint(); document.querySelector("#chat .ch-list").scrollTop = 120; window.CHAT.repaint(); });
    if ((await page.evaluate(() => document.querySelector("#chat .ch-list").scrollTop)) !== 120) fail("chat : la lecture remonte quand le chat se redessine");
    await page.evaluate(() => window.__chatEmit({ id: 600, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Plus bas", kind: "msg", created_at: new Date().toISOString() })); await page.waitForTimeout(100);
    if (!(await page.$("#chat .ch-new"))) fail("chat : bouton « Nouveaux messages » absent"); else { await page.click("#chat .ch-new"); if (await page.evaluate(() => { const l = document.querySelector("#chat .ch-list"); return l.scrollTop + l.clientHeight < l.scrollHeight - 30; })) fail("chat : « Nouveaux messages » ne descend pas"); }
    await page.evaluate(() => { const tpl = Object.keys(window.DATA.ITEMS)[0]; window.DX.social.itemSheet(tpl); }); await page.click('[data-act="ch-share"]');
    await page.waitForSelector("#chat .ch-att", { timeout: 3000 }); await page.waitForTimeout(4000); await page.click('[data-act="ch-send"]'); await page.waitForTimeout(400);
    if (!(await page.$("#chat .ch-list .itm"))) fail("chat : objet montré absent");
    await page.click('#chat .ps[data-u="u9"]'); await page.waitForSelector("#chMenu", { timeout: 3000 }); await page.click('#chMenu [data-act="ch-rep"]');
    await page.waitForSelector('[data-act="ch-repgo"]', { timeout: 3000 }); await page.click('[data-act="ch-repgo"]'); await page.waitForTimeout(500);
    m = await mock(); if (!(m.reports || []).length) fail("chat : signalement non envoyé");
    if (/Salut !/.test(await page.textContent("#chat .ch-list"))) fail("chat : joueur ignoré encore visible");
    await page.click('#chat .ps[data-u="u8"]'); await page.click('#chMenu [data-act="ch-pm"]'); await page.waitForTimeout(4200);
    await page.fill("#chIn", "Message privé"); await page.press("#chIn", "Enter"); await page.waitForTimeout(400);
    m = await mock(); if (!m.views.chat_msgs.some((x) => x.ch === "p" && x.to_id === "u8")) fail("chat : message privé non envoyé");
    // 7d. panel admin
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.role = "admin"; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.CHAT.refresh()); await page.waitForSelector('#status [data-act="adm-open"]', { timeout: 5000 });
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector(".adm .kpis", { timeout: 5000 });
    await page.click('.adm [data-act="adm-tab"][data-v="joueurs"]'); await page.waitForSelector('.adm [data-act="adm-sel"]', { timeout: 5000 });
    await page.click('.adm [data-act="adm-sel"]'); await page.waitForSelector(".adm .fiche", { timeout: 5000 });
    await page.click('.adm [data-act="adm-mute"][data-v="60"]'); await page.waitForTimeout(400);
    await page.click('.adm [data-act="adm-tab"][data-v="ann"]'); await page.waitForSelector("#admAnn", { timeout: 5000 });
    await page.fill("#admAnn", "Maintenance ce soir"); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(600);
    m = await mock(); const calls = (m.admCalls || []).map((x) => x[0]);
    if (!calls.includes("adm_mute") || !calls.includes("adm_announce")) fail("panel admin : actions non envoyées " + calls.join(","));
    if (!/Maintenance ce soir/.test(await page.textContent("#annbar"))) fail("panel admin : bandeau d'annonce absent");
    // 0.1.50.2 : le message épinglé se change dans l'onglet Annonces, et revient chez le joueur qui l'avait fermé
    await page.fill("#admPin", "Nouveau texte épinglé ! Venez sur le Discord."); await page.check("#admPinc"); await page.click('[data-act="adm-pin"]'); await page.waitForTimeout(600);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_pin" && x[1].p_chs === "g,c")) fail("panel admin : message épinglé non envoyé");
    await page.evaluate(() => { window.CHAT.state.tab = "c"; window.CHAT.repaint(); });
    if (!(await page.$("#chat .ch-pin")) || !/Nouveau texte épinglé/.test(await page.textContent("#chat .ch-pin"))) fail("chat : nouveau message épinglé absent après le changement");
    await page.click('.adm [data-act="adm-tab"][data-v="hdv"]'); await page.waitForSelector('.adm [data-act="mk-admdel"]', { timeout: 5000 });
    // 7d bis (0.1.36). boîte à idées : envoi depuis Communauté › Suggestions, puis lecture dans le panel admin
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#nav .sn-side [data-nk="sugg"]'); await page.waitForSelector("#idTitle", { timeout: 5000 });
    await page.click('[data-act="id-send"]'); await page.waitForTimeout(200);
    if (!/Choisis ce que ton idée concerne/.test(await page.textContent("#main"))) fail("idées : envoi sans catégorie accepté");
    await page.click('[data-act="id-tag"][data-v="Contenu"]'); await page.fill("#idTitle", "Un donjon pour le Bouftou Royal"); await page.fill("#idBody", "Un petit donjon niveau 20 à Astrub avec le Bouftou Royal en boss.");
    await page.click('[data-act="id-send"]'); await page.waitForSelector(".sheet", { timeout: 5000 });
    if (!/ton idée est partie/.test(await page.textContent(".sheet"))) fail("idées : pas de remerciement");
    await page.click('.sheet [data-act="closesheet"]');
    m = await mock(); const idea = (m.ideas || [])[0];
    if (!idea || idea.tag !== "Contenu" || idea.title !== "Un donjon pour le Bouftou Royal" || !/niv\. \d+ · /.test(idea.info || "")) fail("idées : idée mal envoyée " + JSON.stringify(idea));
    if (!(await page.$('[data-act="id-send"][disabled]')) || !/Prochaine idée dans 10 min/.test(await page.textContent("#main"))) fail("idées : attente de 10 minutes absente");
    if (!/Un donjon pour le Bouftou Royal/.test(await page.textContent("#main"))) fail("idées : absente de « Tes idées envoyées »");
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector(".adm .kpis", { timeout: 5000 });
    await page.click('.adm [data-act="adm-tab"][data-v="idees"]'); await page.waitForSelector('.adm [data-act="id-hide"]', { timeout: 5000 });
    if (!/Bouftou Royal/.test(await page.textContent(".adm"))) fail("idées : absente du panel admin");
    // 7e. hôtel de vente : achat d'un objet, il arrive dans le sac et les kamas baissent
    await page.click("#chat .ch-x"); await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#nav [data-nk="hdv"]');
    await page.waitForSelector('.mkdet [data-act="mk-ask"]', { timeout: 8000 });
    const before = await page.evaluate(() => ({ k: window.DX.S.kamas, n: Object.keys(window.DX.S.items).length }));
    await page.click('.mkdet [data-act="mk-ask"]'); await page.click('.mkdet [data-act="mk-buy"]'); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ k: window.DX.S.kamas, n: Object.keys(window.DX.S.items).length, op: window.DX.S.hdv && window.DX.S.hdv.op }));
    if (after.n !== before.n + 1 || after.k !== Math.max(0, before.k - 5000) || after.op !== 1) fail("hôtel de vente : achat mal appliqué " + JSON.stringify([before, after]));
    // 0.1.38 : « Vendre à l'HdV » depuis une ressource ouvre la mise en vente ; prix bas = confirmation, 1 kama l'unité au plus bas
    await page.evaluate(() => { const S = window.DX.S; S.res = S.res || {}; S.res["Laine de Bouftou"] = 150; });
    await page.evaluate(() => { window.MARKET.sellRes("Laine de Bouftou"); window.MARKET.render(document.querySelector("#main")); }); await page.waitForSelector("#mkPrice", { timeout: 5000 });
    if (!/Valeur de base/.test(await page.textContent(".mkdet"))) fail("hôtel de vente : valeur de base absente");
    await page.fill("#mkPrice", "99"); await page.waitForTimeout(800);
    if (!/Au moins 1 kama par unité/.test(await page.textContent(".mkdet"))) fail("hôtel de vente : 1 kama par unité non vérifié");
    await page.fill("#mkPrice", "100"); await page.waitForTimeout(800);
    if (!(await page.$(".mkdet .mklow")) || (await page.$('.mkdet [data-act="mk-sell"]'))) fail("hôtel de vente : pas de confirmation pour un prix très bas");
    await page.click('.mkdet [data-act="mk-lowok"]'); await page.waitForTimeout(200);
    if (!(await page.$('.mkdet [data-act="mk-sell"]:not([disabled])'))) fail("hôtel de vente : vente impossible après confirmation");
    await page.click('.subtabs [data-act="mk-tab"][data-v="log"]'); await page.waitForTimeout(300);
    if (!/Acheté/.test(await page.textContent("#main"))) fail("hôtel de vente : historique vide");
    // 7e bis. offres d'achat (0.1.33) : vendre à une offre, puis publier la sienne
    await page.evaluate(() => { const S = window.DX.S; S.res = S.res || {}; S.res["Laine de Bouftou"] = 20; S.kamas = Math.max(S.kamas, 10000); });
    await page.click('.subtabs [data-act="mk-tab"][data-v="ord"]'); await page.waitForSelector('[data-act="mk-ofill"]', { timeout: 5000 });
    const ob = await page.evaluate(() => window.DX.S.kamas);
    await page.click('[data-act="mk-ofill"]'); await page.waitForTimeout(600);
    const oa = await page.evaluate(() => ({ k: window.DX.S.kamas, r: (window.DX.S.res || {})["Laine de Bouftou"] || 0 }));
    if (oa.k !== ob + 600 || oa.r !== 0) fail("offres d'achat : vente mal appliquée " + JSON.stringify([ob, oa]));
    await page.click('[data-act="mk-oview"][data-v="mine"]'); await page.fill("#mkOF", "blé"); await page.waitForTimeout(500);
    await page.click('[data-act="mk-opick"][data-k="Blé"]'); await page.waitForSelector("#mkOQty"); await page.fill("#mkOQty", "10"); await page.waitForTimeout(650); await page.click("#mkOPrice"); await page.keyboard.type("5", { delay: 50 }); await page.waitForTimeout(800); await page.keyboard.press("Home"); await page.waitForTimeout(800); await page.keyboard.press("Delete"); await page.keyboard.type("5"); await page.waitForTimeout(800); await page.keyboard.press("End"); await page.keyboard.type("0"); await page.waitForTimeout(800);
    if ((await page.inputValue("#mkOPrice")) !== "50") fail("offres d'achat : saisie du prix cassée par le rafraîchissement : " + (await page.inputValue("#mkOPrice")));
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/offre.png" });
    // 0.1.38 : plus de prix minimum, mais une confirmation sous la moitié du prix moyen
    if (!(await page.$(".mklow")) || (await page.$('[data-act="mk-onewgo"]'))) fail("offres d'achat : pas de confirmation pour un prix très bas");
    await page.click('[data-act="mk-lowok"]'); await page.waitForTimeout(200);
    await page.click('[data-act="mk-onewgo"]'); await page.waitForTimeout(800);
    if ((await page.evaluate(() => window.DX.S.kamas)) !== oa.k - 510) fail("offres d'achat : kamas non mis de côté");
    if (!/0 \/ 10 reçus/.test(await page.textContent("#main"))) fail("offres d'achat : offre absente de Mes offres");
    // 7f. guildes : invitation reçue, liste, formulaire de fondation
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // bulle « Équiper un objet » après l'achat
    await page.click('#nav [data-nk="guild"]'); await page.waitForSelector('[data-act="g-inv"]', { timeout: 8000 });
    if (!(await page.$("#gName")) || !(await page.$('[data-act="g-join"]'))) fail("guildes : page incomplète");
    // la page se redessine pendant la frappe : le curseur doit rester à sa place (le nom s'écrivait à l'envers)
    await page.click("#gName"); await page.keyboard.type("Les Bouf", { delay: 120 }); await page.waitForTimeout(700); await page.keyboard.type("tous", { delay: 500 }); await page.waitForTimeout(700);
    const gn = await page.inputValue("#gName"); if (gn !== "Les Bouftous") fail("guildes : saisie du nom cassée par le rafraîchissement : " + JSON.stringify(gn));
    if (!(await page.evaluate(() => document.activeElement && document.activeElement.id === "gName"))) fail("guildes : le champ du nom perd le focus");
    await page.click('#nav [data-nk="world"]');
    // 8. mobile : la pastille tient dans la barre
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`page trop large sur téléphone : ${w}px`);
    await page.click("#chat .chmin"); await page.waitForSelector("#chat .ch-list", { timeout: 3000 });
    const cw = await page.evaluate(() => document.querySelector("#chat").getBoundingClientRect().width); if (cw > 392) fail(`chat trop large sur téléphone : ${cw}px`);
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-mob.png" });
    const hw = await page.evaluate(() => document.querySelector("#chat .ch-head").scrollWidth); if (hw > 392) fail(`onglets du chat trop larges sur téléphone : ${hw}px`);
    // 0.1.35.3 : le bouton pour réduire le chat reste dans le cadre, même avec tous les onglets et des pastilles
    if (await page.evaluate(() => { const C = window.CHAT.state; C.unread = 120; C.unreadP = 15; C.unreadH = 99; window.CHAT.repaint(); const c = document.querySelector("#chat").getBoundingClientRect(), x = document.querySelector("#chat .ch-x").getBoundingClientRect(); C.unread = C.unreadP = C.unreadH = 0; window.CHAT.repaint(); return x.right > c.right || x.left < c.left; })) fail("chat : bouton de fermeture hors du cadre (téléphone)");
    await page.evaluate(() => { document.querySelectorAll("#toasts .toast").forEach((e) => e.remove()); window.DX.social.toast("Un"); window.DX.social.toast("Deux"); });
    if (await page.evaluate(() => { const v = [...document.querySelectorAll("#toasts .toast")].filter((e) => e.offsetParent); const r = document.querySelector("#chIn").getBoundingClientRect(); return v.length !== 1 || v[0].getBoundingClientRect().bottom > r.top; })) fail("notifications : mal placées au téléphone, chat ouvert");
    await page.waitForTimeout(400);
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/notif-tel.png" });
    await page.click("#chat .ch-x");
    // 8 bis. 0.1.50.1 : changer son pseudo depuis Options › Sauvegarde, puis refus avant 30 jours
    await page.click('[data-act="options"]'); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-renpseudo"]');
    await page.waitForSelector("#onRenPseudo"); await page.fill("#onRenPseudo", "Bouftoune"); await page.press("#onRenPseudo", "Enter"); await page.waitForTimeout(400);
    m = await mock(); if (m.profiles[0].pseudo !== "Bouftoune") fail("pseudo : changement non enregistré");
    if (!/Bouftoune/.test(await page.textContent(".sheet"))) fail("pseudo : nouveau pseudo absent des Options");
    await page.click('.sheet [data-act="on-renpseudo"]'); await page.waitForTimeout(300);
    if (!(await page.$('.sheet [data-act="on-renpseudogo"][disabled]'))) fail("pseudo : second changement possible avant 30 jours");
    if (!/Prochain changement possible/.test(await page.textContent(".sheet"))) fail("pseudo : date du prochain changement absente");
    await page.click('.sheet [data-act="on-renpseudono"]'); await page.click('.sheet [data-act="closesheet"]').catch(() => {}); await page.keyboard.press("Escape");
    // 9. suppression du compte
    await page.click('[data-act="options"]'); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-askdelete"]');
    await page.fill("#onDelPseudo", "bouftoune"); await page.click('[data-act="on-delete"]'); await page.waitForTimeout(400);
    m = await mock(); if (m.saves.u1 || m.profiles.length) fail("compte non supprimé");
    if (!(await S())) fail("partie de l'appareil perdue après suppression");
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC :\n" + errors.join("\n")); process.exit(1); }
  console.log("Compte et sauvegarde en ligne : OK");
})();
