/* 2.2.1 « Les modérateurs » : PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   - connecté en modérateur : menu d'un joueur = « Supprimer ce message », « L'avertir », muet ; menu d'un autre modo ou de Mathis :
     ni suppression, ni avertissement, ni sanction ; « L'avertir » ouvre la fiche, une phrase toute prête, envoi = adm_warn ;
   - pseudo d'un modo en couleur de l'équipe (pas celle de la Garde-robe) ;
   - connecté en joueur : l'avertissement reçu en privé est marqué « Avertissement de la modération ».
   Lancer : node tests/moderateur_ui.test.js (SHOTS=dossier pour garder des captures) */
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

function fake() {
  const F = (window.__CM = { calls: [], role: null, n: 100 });
  const ME = "00000000-0000-0000-0000-000000000001", U2 = "00000000-0000-0000-0000-000000000002", U3 = "00000000-0000-0000-0000-000000000003", U9 = "00000000-0000-0000-0000-000000000099";
  const at = new Date().toISOString();
  F.msgs = [
    { id: 1, ch: "g", user_id: U2, pseudo: "Zoé", cls: "iop", lvl: 200, body: "Vous êtes tous nuls", kind: "msg", created_at: at },
    { id: 2, ch: "g", user_id: U3, pseudo: "Léo", cls: "eniripsa", lvl: 180, body: "Reste poli Zoé, merci.", kind: "msg", data: { pc: "braise" }, created_at: at },
    { id: 3, ch: "g", user_id: U9, pseudo: "Xener", cls: "cra", lvl: 200, body: "Bonne soirée à tous !", kind: "msg", created_at: at },
    { id: 4, ch: "p", user_id: U3, to_id: ME, pseudo: "Léo", body: "Reste courtois dans le chat, s'il te plaît.", kind: "msg", data: { warn: true }, created_at: at },
  ];
  const rows = (t, f) => (t === "chat_msgs" ? F.msgs.filter((m) => m.ch === f.ch).slice().sort((a, b) => b.id - a.id) : []);
  const q = (t) => { const f = {}; const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: rows(t, f), error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: null, error: null }) : (...a) => { if (k === "eq") f[a[0]] = a[1]; return b; }) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  const srv = (name, a) => {
    switch (name) {
      case "chat_me": return {};
      case "my_role": return F.role;
      case "cosm_mine": return [];
      case "staff_list": return [{ u: U3, p: "Léo", r: "mod" }, { u: U9, p: "Xener", r: "crea" }].concat(F.role === "mod" ? [{ u: ME, p: "Moi", r: "mod" }] : []);
      case "adm_overview": return { accounts: 3, active: 1, reports: 0, flagged: 0, suspect: 0, muted: 0, signups: [], log: [], settings: {}, role: F.role };
      case "adm_warn": return null;
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
  const open = async (w, h) => {
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
    await page.evaluate(() => window.DX.social.closeSheet());
    return page;
  };
  const login = (page, role) => page.evaluate(async (role) => { window.__CM.role = role; window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Moi" };
    await window.CHAT.refresh(); }, role);
  const openChat = async (page) => { await page.waitForSelector("#chat .chmin, #chat .ch-tabs", { timeout: 10000, state: "attached" });
    if (!(await page.$("#chat .ch-tabs"))) await page.evaluate(() => document.querySelector("#chat .chmin").click()); await page.waitForSelector("#chat .ch-tabs", { timeout: 5000 }); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const menu = async (page, id) => { await page.evaluate(() => { const m = document.querySelector("#chMenu"); if (m) m.remove(); });
    await page.click(`#chat .ps[data-id="${id}"]`); await page.waitForSelector("#chMenu", { timeout: 3000 });
    return page.evaluate(() => [...document.querySelectorAll("#chMenu [data-act]")].map((b) => b.dataset.act)); };
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    // ---------- modérateur ----------
    let page = await open(w, h);
    await login(page, "mod"); await openChat(page);
    await page.evaluate(() => { window.CHAT.state.tab = "g"; window.CHAT.repaint(); }); await page.waitForTimeout(300);
    const col = await page.evaluate(() => { const m = [...document.querySelectorAll("#chat .msg")].find((x) => x.textContent.includes("Reste poli"));
      return m ? { mod: m.classList.contains("is-mod"), gr: !!m.querySelector(".gr-pc"), tag: !!m.querySelector(".mtag") } : null; });
    if (!col || !col.mod || col.gr || !col.tag) fail(`${w} px : message du modo sans couleur de l'équipe ou avec la couleur de Garde-robe : ${JSON.stringify(col)}`);
    let acts = await menu(page, 1);
    for (const a of ["adm-del", "adm-warn", "adm-mute"]) if (!acts.includes(a)) fail(`${w} px : menu d'un joueur sans ${a} (${acts.join(", ")})`);
    if (acts.includes("adm-ban") || acts.includes("adm-purge")) fail(`${w} px : un modo voit bannir ou effacer tout`);
    await shot(page, `modo-menu-joueur-${w}.png`);
    for (const id of [2, 3]) { acts = await menu(page, id);
      for (const a of ["adm-del", "adm-warn", "adm-mute"]) if (acts.includes(a)) fail(`${w} px : menu du message ${id} (modo ou Mathis) avec ${a}`); }
    await menu(page, 1); await page.click('#chMenu [data-act="adm-warn"]');
    await page.waitForSelector("#admWarn", { timeout: 3000 });
    await page.click('[data-act="adm-warnpick"]');
    await shot(page, `modo-avertir-${w}.png`);
    await page.click('[data-act="adm-warngo"]'); await page.waitForTimeout(400);
    const call = await page.evaluate(() => window.__CM.calls.find((c) => c[0] === "adm_warn"));
    if (!call || call[1].p_user !== "00000000-0000-0000-0000-000000000002" || !/courtois/.test(call[1].p_body)) fail(`${w} px : adm_warn non envoyé : ${JSON.stringify(call)}`);
    if (await page.$("#admWarn")) fail(`${w} px : la fiche Avertir reste ouverte après l'envoi`);
    await page.context().close();
    // ---------- joueur averti ----------
    page = await open(w, h);
    await login(page, null); await openChat(page);
    await page.evaluate(() => { const C = window.CHAT.state; C.tab = "p"; C.peer = "00000000-0000-0000-0000-000000000003"; window.CHAT.repaint(); }); await page.waitForTimeout(300);
    const wn = await page.evaluate(() => { const m = document.querySelector("#chat .msg.warnmsg"); return m ? m.textContent : null; });
    if (!wn || !/Avertissement de la modération/.test(wn) || !/courtois/.test(wn)) fail(`${w} px : avertissement reçu non marqué : ${wn}`);
    await shot(page, `joueur-averti-${w}.png`);
    const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${w} px : la page défile de côté`);
    await page.context().close();
  }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC modérateurs :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("OK modérateurs : menus du modo, avertissement envoyé et reçu, couleur de l'équipe (PC 1280 px, téléphone 390 px)");
})().catch((e) => { console.error(e); process.exit(1); });
