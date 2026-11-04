/* 2.2.4.11 (ticket #173) : la GIGA annonce plein écran d'un Dofus ou du Jackpot du Trool (js/giga.js) ne s'ouvre que sur le
   serveur où elle a eu lieu (data.srv ; sans serveur : Éternel). Parties Éternel, Saison 1 et Monocompte, faux serveur (aucune
   requête ne sort), PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/giga_srv_ui.test.js */
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
    { id: 1, ch: "g", user_id: U2, pseudo: "Zoé", cls: "iop", lvl: 200, kind: "ann", data: { t: "lvl200", cls: "iop", name: "Zozo", ren: 0, srv: "e" }, created_at: at },
    { id: 2, ch: "g", user_id: U2, pseudo: "Léo", cls: "cra", lvl: 120, kind: "ann", data: { t: "lvl200", cls: "cra", name: "Flèche", ren: 0, srv: "s" }, created_at: at },
    { id: 3, ch: "g", user_id: U2, pseudo: "Max", cls: "eca", lvl: 200, kind: "ann", data: { t: "lvl200", cls: "eca", name: "Chatou", ren: 0 }, created_at: at }, // ancien haut fait : sans serveur
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
  const ann = (page, id, data) => page.evaluate(([i, d]) => window.__CM.live({ new: { id: i, ch: "g", user_id: "00000000-0000-0000-0000-000000000003", pseudo: "Bob", cls: "iop", lvl: 200, kind: "ann", data: d, created_at: new Date().toISOString() } }), [id, data]);
  try {
    for (const [w, hh] of [[1280, 800], [390, 844]]) {
      for (const k of ["e", "s", "m"]) {
        const p = await open(w, hh, k);
        await openChat(p); await login(p);
        await p.evaluate(() => { window.__GG = []; const o = window.GIGA.onAnn; window.GIGA.onAnn = (m) => { window.__GG.push(m.id); return o(m); }; });
        const dof = await p.evaluate(() => Object.keys(window.ENGINE.DOFUS)[0]);
        await ann(p, 501, { t: "giga", id: dof, did: "x", k: 3, srv: "e" });
        await ann(p, 502, { t: "giga", id: dof, did: "x", k: 3, srv: "s" });
        await ann(p, 503, { t: "giga", id: dof, did: "x", k: 3 }); // ancienne annonce sans serveur : Éternel
        await ann(p, 504, { t: "jack", k: 90000, n: 10, pl: 2, h: Date.now(), srv: "s" });
        await ann(p, 505, { t: "giga", id: dof, did: "x", k: 3, srv: "m" });
        await p.waitForTimeout(200);
        const got = await p.evaluate(() => window.__GG);
        const want = k === "e" ? [501, 503] : k === "s" ? [502, 504] : [505];
        if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${w} px, partie ${k} : annonces plein écran ${JSON.stringify(got)} au lieu de ${JSON.stringify(want)}`);
        const shown = await p.evaluate(() => !!document.querySelector("#giga, .giga"));
        if (shown !== (want.length > 0)) fail(`${w} px, partie ${k} : plein écran ${shown ? "ouvert" : "fermé"}`);
        await noScroll(p, `${w} px, partie ${k}`);
        console.log(`ok - ${w} px, partie ${k} : seules les annonces de ce serveur s'ouvrent en plein écran`);
        await p.context().close();
      }
    }
  } catch (e) { fail("exception : " + (e && e.stack || e)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("Annonce des Dofus par serveur : tout est bon");
})();
