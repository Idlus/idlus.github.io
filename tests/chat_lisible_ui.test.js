/* Chat lisible (2.1.43.1) : avec tous les salons (Classique, Monocompte, Commerce, PvP, Guilde, Alliance, Privé, Hauts faits), chaque nom d'onglet
   est écrit en entier (rien de coupé, rien hors du chat) ; la cloche ouverte avec le chat ouvert : le panneau Notifications passe
   par-dessus le chat. PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/chat_lisible_ui.test.js (SHOTS=dossier pour garder des captures) */
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

/* faux serveur (window.__IDLUS_SB) : visiteur non connecté au lancement, le test pose ONLINE.user ; chat_msgs filtré par salon,
   le salon 'm' rendu seulement avec l'accès (comme la règle « chat lisible » de supabase/chat.sql) */
function fake() {
  const F = (window.__CM = { calls: [], acces: false, n: 100, live: null });
  const U2 = "00000000-0000-0000-0000-000000000002";
  const at = new Date().toISOString();
  F.msgs = [
    { id: 1, ch: "g", user_id: U2, pseudo: "Zoé", cls: "iop", lvl: 200, title: "Légende de la 1.0", body: "Bonjour le Classique", kind: "msg", created_at: at },
    { id: 2, ch: "m", user_id: U2, pseudo: "Zoé", cls: "cra", lvl: 12, title: null, body: "Bonjour le Monocompte", kind: "msg", data: { mono: true, s: 0 }, created_at: at },
    { id: 4, ch: "m", user_id: U2, pseudo: "Zoé", cls: "iop", lvl: 200, title: "Fondateur d'Idlus", body: "Ancien message du Monocompte", kind: "msg", created_at: at }, // posé avant 2.1.35.3 : profil Classique
    { id: 3, ch: "c", user_id: U2, pseudo: "Zoé", lvl: 50, body: "Vends Gelano", kind: "msg", created_at: at },
  ];
  const rows = (t, f) => (t === "chat_msgs" ? F.msgs.filter((m) => m.ch === f.ch && (m.ch !== "m" || F.acces)).slice().sort((a, b) => b.id - a.id) : []);
  const one = (t) => (t === "chat_settings" ? { pin_body: "Épinglé pour le Monocompte", pin_chs: "m", pin_at: "2026-10-21T00:00:00Z" } : null);
  const q = (t) => { const f = {}; const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: rows(t, f), error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: one(t), error: null }) : (...a) => { if (k === "eq") f[a[0]] = a[1]; return b; }) }); return b; };
  const ch = () => { const c = { on: (type, filt, fn) => { if (type === "postgres_changes" && filt.event === "INSERT") F.live = fn; return c; }, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  const srv = (name, a) => {
    switch (name) {
      case "mono_acces": return F.acces ? { ok: true, saison: null } : { ok: false };
      case "chat_send": { const c = a.p_to ? "p" : ["c", "v", "m"].includes(a.p_ch) ? a.p_ch : "g"; if (c === "m" && !F.acces) return "Ce salon est réservé aux joueurs du Monocompte.";
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
  const open = async (w, h, mono) => {
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
    if (mono) await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); window.DX.render(); });
    await page.evaluate(() => window.DX.social.closeSheet());
    return page;
  };
  const login = (page) => page.evaluate(async () => { window.__CM.acces = true; window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Moi" };
    await window.ONLINE.monoCheck(); await window.CHAT.refresh(); });
  const openChat = async (page) => { await page.waitForSelector("#chat .chmin, #chat .ch-tabs", { timeout: 10000, state: "attached" });
    if (!(await page.$("#chat .ch-tabs"))) await page.evaluate(() => document.querySelector("#chat .chmin").click()); await page.waitForSelector("#chat .ch-tabs", { timeout: 5000 }); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const page = await open(w, h, false);
    await login(page);
    await page.evaluate(() => { if (window.ALLY) window.ALLY.inAlliance = () => true; });
    await openChat(page);
    await page.evaluate(() => window.CHAT.repaint());
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => { const ch = document.querySelector("#chat").getBoundingClientRect();
      return [...document.querySelectorAll("#chat .ch-tabs .ch-tab")].map((b) => { const s = b.querySelector("span:not(.n)"), r = b.getBoundingClientRect(), sr = s.getBoundingClientRect();
        return { n: s.textContent, cut: s.scrollWidth > s.clientWidth + 1 || sr.right > r.right + 1 || sr.left < r.left - 1, out: r.left < ch.left - 1 || r.right > ch.right + 1 }; }); });
    const names = t.map((x) => x.n);
    for (const k of ["Éternel", "Commerce", "PvP", "Guilde", "Alliance", "Privé", "Hauts faits"]) if (!names.includes(k)) fail(`${w} px : onglet « ${k} » absent : ${names.join(", ")}`);
    for (const x of t) if (x.cut || x.out) fail(`${w} px : onglet « ${x.n} » coupé ou hors du chat`);
    await shot(page, `chat-onglets-${w}.png`);
    // cloche ouverte avec le chat ouvert : le panneau Notifications est au-dessus
    await page.click('[data-act="tb-bell"]');
    await page.waitForTimeout(300);
    const top = await page.evaluate(() => { const tc = document.querySelector("#topchips"); if (!tc || !document.body.classList.contains("bellopen")) return "pas ouvert";
      const r = tc.getBoundingClientRect(), c = document.querySelector("#chat").getBoundingClientRect();
      const x = Math.max(r.left, c.left) + 20, y = Math.max(r.top, c.top) + 8; // un point commun aux deux
      if (x > Math.min(r.right, c.right) || y > Math.min(r.bottom, c.bottom)) return "ok";
      const el = document.elementFromPoint(x, y); return el && el.closest("#topchips") ? "ok" : "chat devant : " + (el ? el.className : "?"); });
    if (top !== "ok") fail(`${w} px : panneau Notifications sous le chat (${top})`);
    await shot(page, `chat-cloche-${w}.png`);
    // menu du compte (portrait en haut à droite) ouvert avec le chat ouvert : lui aussi devant le chat
    await page.click('[data-act="tb-bell"]'); await page.waitForTimeout(200);
    await page.click('[data-act="tb-acc"]'); await page.waitForTimeout(300);
    const acc = await page.evaluate(() => { const p = document.querySelector(".tb-accp"); if (!p) return "pas ouvert";
      const r = p.getBoundingClientRect(), c = document.querySelector("#chat").getBoundingClientRect();
      const x = Math.max(r.left, c.left) + 20, y = Math.max(r.top, c.top) + 8;
      if (x > Math.min(r.right, c.right) || y > Math.min(r.bottom, c.bottom)) return "ok";
      const el = document.elementFromPoint(x, y); return el && el.closest(".tb-accp") ? "ok" : "chat devant : " + (el ? el.className : "?"); });
    if (acc !== "ok") fail(`${w} px : menu du compte sous le chat (${acc})`);
    await shot(page, `chat-compte-${w}.png`);
    const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${w} px : la page défile de côté`);
    await page.context().close();
  }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC chat lisible :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("OK chat lisible : noms d'onglets entiers et Notifications au-dessus du chat (PC 1280 px, téléphone 390 px)");
})().catch((e) => { console.error(e); process.exit(1); });
