/* 04/11 (Mathis : « les canaux commerce ect associés à chaque serveur ») : onglets Commerce et PvP du chat (js/chat.js) par serveur,
   avec un faux serveur (aucune requête ne sort) : partie Éternel = salons 'c'/'v', Saison 1 = 'sc'/'sv', Monocompte = 'mc'/'mv' ;
   lecture, envoi (p_ch), messages en direct d'un autre serveur ignorés (ni affichés ni comptés), passage Éternel → Saison 1 ;
   PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/chat_commerce_srv_ui.test.js (SHOTS=dossier pour garder des captures) */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(ROOT, p);
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

/* faux serveur (window.__IDLUS_SB), repris de tests/chat_mono_ui.test.js, avec Commerce et PvP des trois serveurs */
function fake() {
  const F = (window.__CM = { calls: [], acces: false, n: 100, live: null });
  const U2 = "00000000-0000-0000-0000-000000000002";
  const at = new Date().toISOString();
  F.msgs = [
    { id: 1, ch: "g", user_id: U2, pseudo: "Zoé", cls: "iop", lvl: 200, title: "Légende de la 1.0", body: "Bonjour le Classique", kind: "msg", created_at: at },
    { id: 2, ch: "m", user_id: U2, pseudo: "Zoé", cls: "cra", lvl: 12, title: null, body: "Bonjour le Monocompte", kind: "msg", data: { mono: true, s: 0 }, created_at: at },
    { id: 4, ch: "m", user_id: U2, pseudo: "Zoé", cls: "iop", lvl: 200, title: "Fondateur d'Idlus", body: "Ancien message du Monocompte", kind: "msg", created_at: at }, // posé avant 2.1.35.3 : profil Classique
    { id: 3, ch: "c", user_id: U2, pseudo: "Zoé", lvl: 50, body: "Vends Gelano", kind: "msg", created_at: at },
    { id: 5, ch: "sc", user_id: U2, pseudo: "Zoé", lvl: 20, body: "Vends Coiffe S1", kind: "msg", created_at: at },
    { id: 6, ch: "mc", user_id: U2, pseudo: "Zoé", cls: "cra", lvl: 12, body: "Vends Bottes Mono", kind: "msg", data: { mono: true, s: 0 }, created_at: at },
    { id: 7, ch: "v", user_id: U2, pseudo: "Zoé", lvl: 50, body: "Koli Éternel", kind: "msg", created_at: at },
    { id: 8, ch: "sv", user_id: U2, pseudo: "Zoé", lvl: 20, body: "Koli S1", kind: "msg", created_at: at },
    { id: 9, ch: "mv", user_id: U2, pseudo: "Zoé", cls: "cra", lvl: 12, body: "Koli Mono", kind: "msg", data: { mono: true, s: 0 }, created_at: at },
  ];
  const rows = (t, f) => (t === "chat_msgs" ? F.msgs.filter((m) => m.ch === f.ch && (!["m", "mc", "mv"].includes(m.ch) || F.acces)).slice().sort((a, b) => b.id - a.id) : []);
  const one = (t) => (t === "chat_settings" ? { pin_body: "Épinglé pour le Monocompte", pin_chs: "m", pin_at: "2026-10-21T00:00:00Z" } : null);
  const q = (t) => { const f = {}; const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: rows(t, f), error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: one(t), error: null }) : (...a) => { if (k === "eq") f[a[0]] = a[1]; return b; }) }); return b; };
  const ch = () => { const c = { on: (type, filt, fn) => { if (type === "postgres_changes" && filt.event === "INSERT") F.live = fn; return c; }, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  const srv = (name, a) => {
    switch (name) {
      case "mono_acces": return F.acces ? { ok: true, saison: null } : { ok: false };
      case "chat_send": { const c = a.p_to ? "p" : ["c", "v", "m", "sc", "sv", "mc", "mv"].includes(a.p_ch) ? a.p_ch : "g"; if (c === "m" && !F.acces) return "Ce salon est réservé aux joueurs du Monocompte.";
        F.msgs.push({ id: ++F.n, ch: c, user_id: "00000000-0000-0000-0000-000000000001", pseudo: "Moi", lvl: 1, body: a.p_body, kind: "msg", created_at: new Date().toISOString() }); return null; }
      case "chat_me": return {};
      case "my_role": return null;
      case "cosm_mine": return [];
      case "staff_list": return [{ u: U2, p: "Zoé", r: "mod" }];
      case "chat_mono_profil": return F.acces && a.p_user === U2 ? { s: 0, nom: "Saison de test", cls: "cra", lvl: 12, title: "Voyageur du Temps", hero: "Flèche", u: U2, pseudo: "Zoé" } : null;
      default: return null;
    }
  };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async () => ({ data: null, error: { message: "absent" } }) },
    rpc: async (name, a) => { F.calls.push([name, a || {}]); return { data: srv(name, a || {}), error: null }; },
  }) };
}


(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  // srv : "e" Éternel, "s" Classique · Saison 1, "m" Monocompte
  const open = async (w, h, srv) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(fake);
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
    await page.waitForFunction(() => window.CHAT && window.CHAT.state.started && window.CHAT.state.loaded, null, { timeout: 10000 });
    await page.addStyleTag({ content: ".wtip{display:none!important}" });
    await setSrv(page, srv);
    await page.evaluate(() => window.DX.social.closeSheet());
    return page;
  };
  const setSrv = (page, srv) => page.evaluate((k) => { const { E, S } = window.DX;
    if (k === "m") { E.monoStart(S); E.monoBoot(S); } else if (k === "s") S.s1c = { s: 1, t0: Date.now() }; window.DX.render(); }, srv);
  const login = (page) => page.evaluate(async () => { window.__CM.acces = true; window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Moi" };
    await window.ONLINE.monoCheck(); await window.CHAT.refresh(); });
  const openChat = async (page) => { await page.waitForSelector("#chat .chmin, #chat .ch-tabs", { timeout: 10000, state: "attached" });
    if (!(await page.$("#chat .ch-tabs"))) await page.evaluate(() => document.querySelector("#chat .chmin").click()); await page.waitForSelector("#chat .ch-tabs", { timeout: 5000 }); };
  const listTxt = (page) => page.evaluate(() => (document.querySelector("#chat .ch-list") || {}).textContent || "");
  const sendTxt = async (page, t) => { await page.fill("#chIn", t); await page.click('#chat [data-act="ch-send"]'); await page.waitForTimeout(300);
    await page.evaluate(() => { window.CHAT.state.next = 0; window.CHAT.state.nextC = 0; });
    return page.evaluate(() => { const c = window.__CM.calls.filter((x) => x[0] === "chat_send"); return c[c.length - 1][1]; }); };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const live = (page, ch, body, id) => page.evaluate(([c, b, i]) => window.__CM.live({ new: { id: i, ch: c, user_id: "00000000-0000-0000-0000-000000000003", pseudo: "Bob", lvl: 3, body: b, kind: "msg", created_at: new Date().toISOString() } }), [ch, body, id]);
  const SRV = {
    e: { n: "Éternel", c: "c", v: "v", cm: "Vends Gelano", vm: "Koli Éternel", de: "de l'Éternel" },
    s: { n: "Saison 1", c: "sc", v: "sv", cm: "Vends Coiffe S1", vm: "Koli S1", de: "de la Saison 1" },
    m: { n: "Monocompte", c: "mc", v: "mv", cm: "Vends Bottes Mono", vm: "Koli Mono", de: "du Monocompte" },
  };
  const others = (k, f) => Object.keys(SRV).filter((x) => x !== k).map((x) => SRV[x][f]);
  const check = async (page, k, w) => {
    const R = SRV[k];
    await page.click('#chat .ch-tab[data-v="c"]');
    let l = await listTxt(page);
    if (!l.includes(R.cm) || others(k, "cm").some((x) => l.includes(x))) fail(`${w} px, ${R.n} : Commerce de ce serveur seulement : ` + l.slice(0, 300));
    if (!l.includes("Commerce " + R.de)) fail(`${w} px, ${R.n} : le Commerce dit son serveur : ` + l.slice(0, 160));
    await shot(page, `commerce-${k}-${w}.png`);
    let a = await sendTxt(page, "achète " + k);
    if (a.p_ch !== R.c) fail(`${w} px, ${R.n} : envoi dans le Commerce '${R.c}', trouvé ` + JSON.stringify(a));
    // message d'un autre serveur reçu en direct : ignoré ; du même serveur : affiché
    const n0 = await page.evaluate(() => window.CHAT.state.unreadC);
    await live(page, others(k, "c")[0], "autre serveur commerce", 900 + w);
    await live(page, R.c, "même serveur commerce", 950 + w);
    l = await listTxt(page);
    if (l.includes("autre serveur commerce") || !l.includes("même serveur commerce")) fail(`${w} px, ${R.n} : direct du Commerce filtré par serveur : ` + l.slice(-200));
    if ((await page.evaluate(() => window.CHAT.state.unreadC)) !== n0) fail(`${w} px, ${R.n} : un message d'un autre serveur ne compte pas en non lu`);
    await page.click('#chat .ch-tab[data-v="v"]');
    l = await listTxt(page);
    if (!l.includes(R.vm) || others(k, "vm").some((x) => l.includes(x))) fail(`${w} px, ${R.n} : PvP de ce serveur seulement : ` + l.slice(0, 300));
    a = await sendTxt(page, "koli " + k);
    if (a.p_ch !== R.v) fail(`${w} px, ${R.n} : envoi dans le PvP '${R.v}', trouvé ` + JSON.stringify(a));
    await noScroll(page, `${w} px, ${R.n}`);
  };
  try {
    for (const [w, hh] of [[1280, 800], [390, 844]]) {
      for (const k of ["e", "s", "m"]) {
        const p = await open(w, hh, k);
        await openChat(p); await login(p); await openChat(p);
        await check(p, k, w);
        console.log(`ok - ${w} px, ${SRV[k].n} : Commerce et PvP du serveur seulement (lecture, envoi, direct)`);
        await p.context().close();
      }
    }
    // changement de serveur sans recharger la page : Éternel → Saison 1, le Commerce suit
    const p = await open(1280, 800, "e");
    await openChat(p); await login(p); await openChat(p);
    await p.click('#chat .ch-tab[data-v="c"]');
    await setSrv(p, "s");
    await p.waitForFunction(() => /Coiffe S1/.test((document.querySelector("#chat .ch-list") || {}).textContent || ""), null, { timeout: 6000 }).catch(() => {});
    const l = await listTxt(p);
    if (!l.includes("Vends Coiffe S1") || l.includes("Vends Gelano")) fail("Éternel → Saison 1 : Commerce de la Saison 1 rechargé : " + l.slice(0, 200));
    console.log("ok - passage Éternel → Saison 1 : le Commerce suit le serveur");
  } catch (e) { fail("exception : " + (e && e.stack || e)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("Commerce et PvP par serveur : tout est bon");
})();
