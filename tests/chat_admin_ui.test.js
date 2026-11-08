/* 05/11 (Mathis : « accéder à tous les chats des serveurs, tous les droits, m'appeler Xener, toutes les émotes ») : chat du compte admin
   (js/chat.js) avec un faux serveur (aucune requête ne sort) : depuis une partie de l'Éternel, Xener choisit le serveur des salons
   (Éternel, Saison 1, Monocompte), les lit et y écrit (p_ch du bon serveur), même sans accès testeur au Monocompte ; il a les 36
   autocollants ; un joueur ne voit pas ce choix. PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/chat_admin_ui.test.js (SHOTS=dossier pour garder des captures) */
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
    { id: 10, ch: "s", user_id: U2, pseudo: "Zoé", lvl: 20, body: "Bonjour la Saison 1", kind: "msg", created_at: at },
    { id: 9, ch: "mv", user_id: U2, pseudo: "Zoé", cls: "cra", lvl: 12, body: "Koli Mono", kind: "msg", data: { mono: true, s: 0 }, created_at: at },
  ];
  const rows = (t, f) => (t === "chat_msgs" ? F.msgs.filter((m) => m.ch === f.ch && (!["m", "mc", "mv"].includes(m.ch) || F.acces || F.role === "admin")).slice().sort((a, b) => b.id - a.id) : []);
  const one = (t) => (t === "chat_settings" ? { pin_body: "Épinglé pour le Monocompte", pin_chs: "m", pin_at: "2026-10-21T00:00:00Z" } : null);
  const q = (t) => { const f = {}; const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: rows(t, f), error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: one(t), error: null }) : (...a) => { if (k === "eq") f[a[0]] = a[1]; return b; }) }); return b; };
  const ch = () => { const c = { on: (type, filt, fn) => { if (type === "postgres_changes" && filt.event === "INSERT") F.live = fn; return c; }, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  const srv = (name, a) => {
    switch (name) {
      case "mono_acces": return F.acces ? { ok: true, saison: null } : { ok: false };
      case "chat_send": { const c = a.p_to ? "p" : ["c", "v", "m", "sc", "sv", "mc", "mv"].includes(a.p_ch) ? a.p_ch : "g"; if (["m", "mc", "mv"].includes(c) && !F.acces && F.role !== "admin") return "Ce salon est réservé aux joueurs du Monocompte.";
        F.msgs.push({ id: ++F.n, ch: c, user_id: "00000000-0000-0000-0000-000000000001", pseudo: F.role === "admin" ? "Xener" : "Moi", lvl: 1, body: a.p_body, kind: "msg", created_at: new Date().toISOString() }); return null; }
      case "chat_me": return {};
      case "my_role": return F.role || null;
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
  const open = async (w, h, role) => {
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
    await page.evaluate(async (r) => { window.__CM.role = r; window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Mathis29" };
      await window.ONLINE.monoCheck(); await window.CHAT.refresh(); }, role);
    await page.waitForSelector("#chat .chmin, #chat .ch-tabs", { timeout: 10000, state: "attached" });
    if (!(await page.$("#chat .ch-tabs"))) await page.evaluate(() => document.querySelector("#chat .chmin").click());
    await page.waitForSelector("#chat .ch-tabs", { timeout: 5000 });
    return page;
  };
  const listTxt = (page) => page.evaluate(() => (document.querySelector("#chat .ch-list") || {}).textContent || "");
  const tabs = (page) => page.evaluate(() => [...document.querySelectorAll("#chat .ch-tab")].map((x) => x.dataset.v || "lock").join(","));
  const sendTxt = async (page, t) => { await page.fill("#chIn", t); await page.click('#chat [data-act="ch-send"]'); await page.waitForTimeout(300);
    await page.evaluate(() => { window.CHAT.state.next = 0; window.CHAT.state.nextC = 0; });
    return page.evaluate(() => { const c = window.__CM.calls.filter((x) => x[0] === "chat_send"); return c[c.length - 1][1]; }); };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const pick = async (page, k) => { await page.click(`#chat .ch-srv [data-v="${k}"]`); await page.waitForTimeout(250); };
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const page = await open(w, h, "admin");
    if (!(await page.$("#chat .ch-srv"))) fail(`${w} px : le choix du serveur manque pour Xener`);
    await shot(page, `admin-e-${w}.png`);
    let l = await listTxt(page);
    if (!l.includes("Bonjour le Classique")) fail(`${w} px : salon de l'Éternel par défaut : ` + l.slice(0, 200));
    // Saison 1
    await pick(page, "s");
    if (!(await tabs(page)).startsWith("g,")) fail(`${w} px : Saison 1 : Général commun (2.2.14) : ` + (await tabs(page)));
    l = await listTxt(page); if (!l.includes("Bonjour la Saison 1")) fail(`${w} px : Saison 1 lue : ` + l.slice(0, 200));
    let a = await sendTxt(page, "salut la S1"); if (a.p_ch !== "s") fail(`${w} px : envoi dans 's' : ` + JSON.stringify(a));
    await page.click('#chat .ch-tab[data-v="c"]'); l = await listTxt(page);
    if (!l.includes("Vends Coiffe S1") || l.includes("Vends Gelano")) fail(`${w} px : Commerce de la Saison 1 : ` + l.slice(0, 200));
    a = await sendTxt(page, "achète S1"); if (a.p_ch !== "sc") fail(`${w} px : envoi dans 'sc' : ` + JSON.stringify(a));
    // Monocompte, sans accès testeur
    await pick(page, "m");
    if (!(await tabs(page)).startsWith("g,c,v,p,h")) fail(`${w} px : Monocompte : ses onglets : ` + (await tabs(page)));
    l = await listTxt(page); if (!l.includes("Bonjour le Monocompte")) fail(`${w} px : salon Monocompte lu : ` + l.slice(0, 200));
    a = await sendTxt(page, "salut Mono"); if (a.p_ch !== "m") fail(`${w} px : envoi dans 'm' : ` + JSON.stringify(a));
    await page.click('#chat .ch-tab[data-v="v"]'); l = await listTxt(page);
    if (!l.includes("Koli Mono")) fail(`${w} px : PvP du Monocompte : ` + l.slice(0, 200));
    a = await sendTxt(page, "koli ?"); if (a.p_ch !== "mv") fail(`${w} px : envoi dans 'mv' : ` + JSON.stringify(a));
    await page.click('#chat .ch-tab[data-v="g"]'); await page.waitForTimeout(1600);
    if (!(await listTxt(page)).includes("Xener")) fail(`${w} px : le message de Mathis signé Xener`);
    await shot(page, `admin-m-${w}.png`); await noScroll(page, `${w} px Monocompte`);
    // autocollants : les 36
    await page.click('#chat [data-act="ch-stb"]');
    const n = await page.evaluate(() => document.querySelectorAll("#chat .ch-stp button").length);
    if (n !== 36) fail(`${w} px : Xener a les 36 autocollants, trouvé ${n}`);
    await shot(page, `admin-st-${w}.png`);
    // 2.2.14.1 : la grille défile, le dernier autocollant est atteignable et les messages gardent de la place
    const g = await page.evaluate(() => { const p = document.querySelector("#chat .ch-stp"), l = document.querySelector("#chat .ch-list"), cs = getComputedStyle(p);
      p.scrollTop = p.scrollHeight; const last = p.lastElementChild.getBoundingClientRect(), r = p.getBoundingClientRect(), ch = document.querySelector("#chat").getBoundingClientRect();
      return { ov: cs.overflowY, sh: p.scrollHeight, ph: p.clientHeight, top: p.scrollTop, lastIn: last.bottom <= r.bottom + 1 && last.bottom <= ch.bottom + 1, list: l ? l.clientHeight : 0 }; });
    if (g.ov !== "auto" || g.sh <= g.ph || g.top <= 0) fail(`${w} px : la grille des autocollants ne défile pas : ` + JSON.stringify(g));
    if (!g.lastIn) fail(`${w} px : le dernier autocollant reste caché : ` + JSON.stringify(g));
    if (g.list < 60) fail(`${w} px : les messages sont écrasés par la grille : ` + JSON.stringify(g));
    await page.click('#chat .ch-stp [data-v="36"]'); await page.waitForTimeout(300);
    a = await page.evaluate(() => { const c = window.__CM.calls.filter((x) => x[0] === "chat_send"); return c[c.length - 1][1]; });
    if (a.p_body !== ":st:36:") fail(`${w} px : autocollant 36 envoyé : ` + JSON.stringify(a));
    // retour à l'Éternel
    await page.evaluate(() => { window.CHAT.state.next = 0; });
    await pick(page, "e");
    if (!(await tabs(page)).startsWith("g,")) fail(`${w} px : retour à l'Éternel : ` + (await tabs(page)));
    await noScroll(page, `${w} px Éternel`);
    await page.context().close();
    // joueur : pas de choix du serveur
    const p2 = await open(w, h, null);
    if (await p2.$("#chat .ch-srv")) fail(`${w} px : un joueur ne doit pas voir le choix du serveur`);
    await p2.context().close();
  }
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - Xener : choix du serveur du chat (Éternel, Saison 1, Monocompte), lecture et envoi dans chaque salon, 36 autocollants ; caché aux joueurs (PC et téléphone)");
})().catch((e) => { console.error(e); process.exit(1); });
