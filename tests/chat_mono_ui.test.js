/* Salon « Général Monocompte » du chat (js/chat.js) dans le navigateur, avec un faux serveur (aucune requête ne sort) :
   - onglet « Monocompte » caché sans compte, et pour un compte sans accès au Monocompte (mono_acces { ok: false }) : le
     Général garde son nom ;
   - compte avec accès : onglets « Classique » et « Monocompte » ; partie Classique affichée : « Classique » par défaut,
     partie Monocompte (E.isMono) : « Monocompte » par défaut ; accès retiré : l'onglet disparaît, retour au Classique ;
   - envoi dans le bon salon (chat_send sans p_ch pour le Classique, p_ch 'm' pour le Monocompte), lecture du salon 'm'
     seulement avec l'accès, messages non lus du salon 'm' (pastille de l'onglet et du chat réduit), épinglage sur 'm' ;
   - PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/chat_mono_ui.test.js (SHOTS=dossier pour garder des captures) */
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
    { id: 1, ch: "g", user_id: U2, pseudo: "Zoé", lvl: 50, body: "Bonjour le Classique", kind: "msg", created_at: at },
    { id: 2, ch: "m", user_id: U2, pseudo: "Zoé", lvl: 12, body: "Bonjour le Monocompte", kind: "msg", created_at: at },
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
      case "staff_list": return [];
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
  // connexion simulée : compte, pseudo, accès au Monocompte relu (comme menuStart), chat rechargé
  const login = (page, acces) => page.evaluate(async (ok) => { window.__CM.acces = ok; window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Moi" };
    await window.ONLINE.monoCheck(); await window.CHAT.refresh(); }, acces);
  // bulle du chat cliquée par le script : au téléphone, elle se cache quand la page défile (scrolldn)
  const openChat = async (page) => { if (!(await page.$("#chat .ch-tabs"))) await page.evaluate(() => document.querySelector("#chat .chmin").click()); await page.waitForSelector("#chat .ch-tabs", { timeout: 5000 }); };
  const tabs = (page) => page.evaluate(() => [...document.querySelectorAll("#chat .ch-tabs .ch-tab")].map((b) => (b.dataset.v || "?") + ":" + b.querySelector("span").textContent));
  const cur = (page) => page.evaluate(() => window.CHAT.state.tab);
  const listTxt = (page) => page.evaluate(() => (document.querySelector("#chat .ch-list") || {}).textContent || "");
  const sendTxt = async (page, t) => { await page.fill("#chIn", t); await page.click('#chat [data-act="ch-send"]'); await page.waitForTimeout(300);
    await page.evaluate(() => { window.CHAT.state.next = 0; }); // mode lent du jeu (4 s) sauté pour le test
    return page.evaluate(() => { const c = window.__CM.calls.filter((x) => x[0] === "chat_send"); return c[c.length - 1][1]; }); };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const loadsM = (page) => page.evaluate(() => window.__CM.calls.length && window.CHAT.state.m.length);
  try {
    /* ---------- 1. partie Classique, PC ---------- */
    const p1 = await open(1280, 800, false);
    await openChat(p1);
    let t = await tabs(p1);
    if (t.some((x) => /^m:/.test(x)) || !t.includes("g:Général")) fail("pas connecté : pas d'onglet Monocompte, Général inchangé : " + JSON.stringify(t));
    await login(p1, false);
    t = await tabs(p1);
    if (t.some((x) => /^m:/.test(x)) || !t.includes("g:Général")) fail("compte sans accès : pas d'onglet Monocompte : " + JSON.stringify(t));
    if (await loadsM(p1)) fail("compte sans accès : salon 'm' chargé");
    let a = await sendTxt(p1, "salut tout le monde");
    if ("p_ch" in a) fail("Général : chat_send sans p_ch attendu : " + JSON.stringify(a));
    console.log("ok - onglet Monocompte caché sans compte et pour un compte sans accès ; Général inchangé");

    await login(p1, true);
    t = await tabs(p1);
    if (!t.includes("g:Classique") || !t.includes("m:Monocompte") || t.indexOf("m:Monocompte") !== t.indexOf("g:Classique") + 1) fail("compte avec accès : onglets Classique puis Monocompte : " + JSON.stringify(t));
    if ((await cur(p1)) !== "g") fail("partie Classique : onglet Classique par défaut, trouvé " + (await cur(p1)));
    if (!/Bonjour le Classique/.test(await listTxt(p1)) || /Bonjour le Monocompte/.test(await listTxt(p1))) fail("Classique : messages du salon g seulement");
    if (/Épinglé pour le Monocompte/.test(await p1.evaluate(() => document.querySelector("#chat").textContent))) fail("épinglé sur 'm' seulement : absent du Classique");
    a = await sendTxt(p1, "message classique");
    if ("p_ch" in a || a.p_body !== "message classique") fail("Classique : chat_send sans p_ch : " + JSON.stringify(a));
    // non lus du salon 'm' : pastille de l'onglet
    await p1.evaluate(() => window.__CM.live({ new: { id: 500, ch: "m", user_id: "00000000-0000-0000-0000-000000000003", pseudo: "Bob", lvl: 3, body: "coucou les monos", kind: "msg", created_at: new Date().toISOString() } }));
    const badge = await p1.evaluate(() => { const b = document.querySelector('#chat .ch-tab[data-v="m"] .n'); return b ? b.textContent : ""; });
    if (badge !== "1") fail("message reçu dans 'm' : pastille 1 sur l'onglet Monocompte, trouvé " + JSON.stringify(badge));
    await p1.click('#chat .ch-tab[data-v="m"]');
    if ((await cur(p1)) !== "m") fail("clic sur Monocompte : salon 'm' affiché");
    const lm = await listTxt(p1);
    if (!/Bonjour le Monocompte/.test(lm) || !/coucou les monos/.test(lm) || /Bonjour le Classique/.test(lm)) fail("Monocompte : messages du salon m seulement : " + lm.slice(0, 200));
    if (await p1.evaluate(() => window.CHAT.state.unreadM)) fail("salon Monocompte ouvert : non lus remis à zéro");
    if (!/Épinglé pour le Monocompte/.test(await p1.evaluate(() => document.querySelector("#chat").textContent))) fail("épinglé sur 'm' : affiché dans le salon Monocompte");
    if ((await p1.getAttribute("#chIn", "placeholder")) !== "Écrire aux joueurs du Monocompte…") fail("Monocompte : texte d'aide de la zone d'écriture");
    a = await sendTxt(p1, "message mono");
    if (a.p_ch !== "m" || a.p_body !== "message mono") fail("Monocompte : chat_send avec p_ch 'm' : " + JSON.stringify(a));
    await p1.waitForTimeout(1600); // rechargement du salon après l'envoi
    if (!/message mono/.test(await listTxt(p1))) fail("Monocompte : message envoyé affiché");
    if (!(await p1.evaluate(() => window.__CM.msgs.some((m) => m.ch === "m" && m.body === "message mono")))) fail("message rangé dans le salon m du serveur");
    await shot(p1, "chat-mono-1280.png");
    // chat réduit : pastille des non lus du salon 'm' comptée
    await p1.click('#chat [data-act="ch-close"]');
    await p1.evaluate(() => window.__CM.live({ new: { id: 501, ch: "m", user_id: "00000000-0000-0000-0000-000000000003", pseudo: "Bob", lvl: 3, body: "encore", kind: "msg", created_at: new Date().toISOString() } }));
    const nmin = await p1.evaluate(() => { const b = document.querySelector("#chat .chmin .n"); return b ? b.textContent : ""; });
    if (nmin !== "1") fail("chat réduit : 1 non lu (salon m), trouvé " + JSON.stringify(nmin));
    await noScroll(p1, "1280 px");
    console.log("ok - accès Monocompte, partie Classique : onglets Classique (par défaut) et Monocompte, envoi dans le bon salon, non lus et épinglage du salon m");

    /* ---------- 2. partie Monocompte, PC : Monocompte par défaut ; accès retiré : retour au Classique ---------- */
    const p2 = await open(1280, 800, true);
    if (!(await p2.evaluate(() => window.ENGINE.isMono(window.DX.S)))) fail("partie Monocompte attendue");
    await login(p2, true); await openChat(p2);
    if ((await cur(p2)) !== "m") fail("partie Monocompte : onglet Monocompte par défaut, trouvé " + (await cur(p2)));
    if (!/Bonjour le Monocompte/.test(await listTxt(p2))) fail("partie Monocompte : salon m affiché");
    a = await sendTxt(p2, "depuis la partie mono");
    if (a.p_ch !== "m") fail("partie Monocompte : envoi par défaut dans 'm' : " + JSON.stringify(a));
    await p2.click('#chat .ch-tab[data-v="g"]');
    await p2.evaluate(() => window.CHAT.refresh());
    if ((await cur(p2)) !== "g") fail("choix du joueur gardé au rechargement du chat");
    await p2.click('#chat .ch-tab[data-v="m"]');
    await login(p2, false); // accès retiré par le serveur
    t = await tabs(p2);
    if (t.some((x) => /^m:/.test(x)) || (await cur(p2)) !== "g") fail("accès retiré : onglet Monocompte caché, retour au Général : " + JSON.stringify(t) + " " + (await cur(p2)));
    if (/Bonjour le Monocompte/.test(await listTxt(p2))) fail("accès retiré : messages du salon m plus affichés");
    console.log("ok - partie Monocompte : onglet Monocompte par défaut, choix du joueur gardé ; accès retiré : onglet caché, retour au Général");

    /* ---------- 3. téléphone 390 px, partie Monocompte ---------- */
    const p3 = await open(390, 844, true);
    await login(p3, true); await openChat(p3);
    if ((await cur(p3)) !== "m") fail("390 px : onglet Monocompte par défaut");
    const box = await p3.evaluate(() => { const r = document.querySelector('#chat .ch-tab[data-v="m"]').getBoundingClientRect(), c = document.querySelector("#chat").getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, cl: c.left, cr: c.right }; });
    if (box.l < box.cl - 1 || box.r > box.cr + 1 || box.w < 30) fail("390 px : onglet Monocompte visible dans le chat " + JSON.stringify(box));
    a = await sendTxt(p3, "mono au téléphone");
    if (a.p_ch !== "m") fail("390 px : envoi dans 'm'");
    await p3.click('#chat .ch-tab[data-v="g"]');
    a = await sendTxt(p3, "classique au téléphone");
    if ("p_ch" in a) fail("390 px : envoi dans le Classique");
    await noScroll(p3, "390 px"); await shot(p3, "chat-mono-390.png");
    console.log("ok - téléphone 390 px : onglet Monocompte par défaut et visible, envois dans les deux salons, sans défilement de côté");
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - aucune erreur console");
})();
