/* Salon « Général Monocompte » du chat (js/chat.js) dans le navigateur, avec un faux serveur (aucune requête ne sort) :
   - onglet « Monocompte » caché sans compte, et pour un compte sans accès au Monocompte (mono_acces { ok: false }) : le
     Général garde son nom ;
   - compte avec accès : onglets « Classique » et « Monocompte » ; partie Classique affichée : « Classique » par défaut,
     partie Monocompte (E.isMono) : « Monocompte » par défaut ; accès retiré : l'onglet disparaît, retour au Classique ;
   - envoi dans le bon salon (chat_send sans p_ch pour le Classique, p_ch 'm' pour le Monocompte), lecture du salon 'm'
     seulement avec l'accès, messages non lus du salon 'm' (pastille de l'onglet et du chat réduit), épinglage sur 'm' ;
   - 2.1.35.3, profils séparés : Zoé (Classique : Iop niv. 200, « Légende de la 1.0 », ailes de Bonta, modératrice ; héros
     Monocompte : Crâ niv. 12) montre son héros Monocompte dans 'm' (niv. 12, Crâ, sans titre ni ailes ni camp Classique, badge
     Modérateur gardé ; ancien message sans data.mono : ni classe, ni niveau, ni titre) et son profil Classique dans 'g' ;
     clic sur son pseudo dans 'm' : carte Monocompte (héros, titre et saison du Monocompte, privé, ignorer, signaler ; pas
     « Voir son profil ») ; dans 'g' : menu Classique inchangé ;
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
  // connexion simulée : compte, pseudo, accès au Monocompte relu (comme menuStart), chat rechargé
  const login = (page, acces) => page.evaluate(async (ok) => { window.__CM.acces = ok; window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Moi" };
    await window.ONLINE.monoCheck(); await window.CHAT.refresh(); }, acces);
  // bulle du chat cliquée par le script : au téléphone, elle se cache quand la page défile (scrolldn)
  /* le chat se dessine quand une partie est affichée : après « Commencer », par la vérification toutes les 2 s de js/chat.js (partie
     commencée après le lancement du chat) ; sur une machine chargée, la bulle peut donc manquer juste après le chargement : on l'attend */
  const openChat = async (page) => { await page.waitForSelector("#chat .chmin, #chat .ch-tabs", { timeout: 10000, state: "attached" });
    if (!(await page.$("#chat .ch-tabs"))) await page.evaluate(() => document.querySelector("#chat .chmin").click()); await page.waitForSelector("#chat .ch-tabs", { timeout: 5000 }); };
  const tabs = (page) => page.evaluate(() => [...document.querySelectorAll("#chat .ch-tabs .ch-tab")].map((b) => (b.dataset.v || "?") + ":" + b.querySelector("span").textContent));
  const cur = (page) => page.evaluate(() => window.CHAT.state.tab);
  const listTxt = (page) => page.evaluate(() => (document.querySelector("#chat .ch-list") || {}).textContent || "");
  const sendTxt = async (page, t) => { await page.fill("#chIn", t); await page.click('#chat [data-act="ch-send"]'); await page.waitForTimeout(300);
    await page.evaluate(() => { window.CHAT.state.next = 0; }); // mode lent du jeu (4 s) sauté pour le test
    return page.evaluate(() => { const c = window.__CM.calls.filter((x) => x[0] === "chat_send"); return c[c.length - 1][1]; }); };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const loadsM = (page) => page.evaluate(() => window.__CM.calls.length && window.CHAT.state.m.length);
  /* Zoé : camp de Bonta au rang 10 dans le Classique (ailes et écusson), puis messages relus dans le salon affiché */
  const campZoe = (page) => page.evaluate(() => { const A = window.ALIGNUI.CAMP, u = "00000000-0000-0000-0000-000000000002"; A.u[u] = "bonta"; A.r[u] = 10; A.p["zoé"] = "bonta"; A.at = Date.now(); window.CHAT.repaint(); });
  const msgInfo = (page, txt) => page.evaluate((t) => { const m = [...document.querySelectorAll("#chat .ch-list .msg")].find((x) => x.querySelector(".tx").textContent.includes(t)); if (!m) return null;
    const q = (s) => m.querySelector(s); return { lv: q(".who .lv") ? q(".who .lv").textContent : "", tt: q(".who .tt") ? q(".who .tt").textContent : "", cls: q(".cm img") ? q(".cm img").alt : "", wings: !!q(".chw"), camp: !!q(".al-w"), mod: !!q(".mtag") }; }, txt);
  /* profils séparés dans le salon Monocompte (onglet 'm' affiché) puis dans le Classique */
  const profils = async (page, w) => {
    await campZoe(page);
    let i = await msgInfo(page, "Bonjour le Monocompte");
    if (!i || i.lv !== "niv. 12" || i.cls !== "Crâ" || i.tt || i.wings || i.camp || !i.mod) fail(`${w} px, 'm' : héros Monocompte (niv. 12, Crâ), sans titre, ailes ni camp Classique, badge Modérateur gardé : ` + JSON.stringify(i));
    i = await msgInfo(page, "Ancien message du Monocompte");
    if (!i || i.lv || i.cls || i.tt || i.wings || i.camp) fail(`${w} px, 'm' : ancien message sans data.mono : ni classe, ni niveau, ni titre, ni ailes : ` + JSON.stringify(i));
    const txtM = await listTxt(page);
    if (/Légende de la 1\.0|Fondateur d'Idlus|niv\. 200/.test(txtM)) fail(`${w} px, 'm' : rien du profil Classique : ` + txtM.slice(0, 300));
    // clic sur le pseudo : carte Monocompte
    await page.evaluate(() => { const m = [...document.querySelectorAll("#chat .ch-list .msg")].find((x) => x.textContent.includes("Bonjour le Monocompte")); m.querySelector('[data-act="ch-who"]').click(); });
    await page.waitForFunction(() => /Voyageur du Temps/.test((document.querySelector("#chMenu .chm-card") || {}).textContent || ""), null, { timeout: 5000 }).catch(() => {});
    const card = await page.evaluate(() => { const el = document.querySelector("#chMenu"); if (!el) return null; const c = el.querySelector(".chm-card"); const r = el.getBoundingClientRect();
      return { card: c ? c.textContent : "", acts: [...el.querySelectorAll("button")].map((b) => b.dataset.act), txt: el.textContent, l: r.left, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; });
    if (!card || !/Crâ/.test(card.card) || !/niv\. 12/.test(card.card) || !/Voyageur du Temps/.test(card.card) || !/Saison de test/.test(card.card) || !/Flèche/.test(card.card)) fail(`${w} px, carte Monocompte (Crâ niv. 12, titre et saison du Monocompte) : ` + JSON.stringify(card));
    if (card && (card.acts.includes("ch-prof") || card.acts.includes("mk-trade-ask") || /Légende|Fondateur|niv\. 200|Iop/.test(card.txt))) fail(`${w} px, carte Monocompte : pas de fiche ni de profil Classique : ` + JSON.stringify(card.acts) + " " + card.txt);
    if (card && !["ch-pm", "ch-ign", "ch-rep"].every((k) => card.acts.includes(k))) fail(`${w} px, carte Monocompte : privé, ignorer et signaler : ` + JSON.stringify(card.acts));
    if (card && (card.l < 0 || card.r > card.w + 1 || card.b > card.h + 1)) fail(`${w} px, carte Monocompte dans l'écran : ` + JSON.stringify(card));
    await shot(page, `chat-mono-carte-${w}.png`);
    await page.evaluate(() => { const m = document.querySelector("#chMenu"); if (m) m.remove(); });
    // le même joueur dans le Classique : profil Classique inchangé
    await page.click('#chat .ch-tab[data-v="g"]'); await campZoe(page);
    i = await msgInfo(page, "Bonjour le Classique");
    if (!i || i.lv !== "niv. 200" || i.cls !== "Iop" || i.tt !== "Légende de la 1.0" || !i.wings || !i.camp || !i.mod) fail(`${w} px, 'g' : profil Classique (Iop niv. 200, titre, ailes, camp) : ` + JSON.stringify(i));
    await page.evaluate(() => { const m = [...document.querySelectorAll("#chat .ch-list .msg")].find((x) => x.textContent.includes("Bonjour le Classique")); m.querySelector('[data-act="ch-who"]').click(); });
    const mg = await page.evaluate(() => { const el = document.querySelector("#chMenu"); return el ? { card: !!el.querySelector(".chm-card"), acts: [...el.querySelectorAll("button")].map((b) => b.dataset.act) } : null; });
    if (!mg || mg.card || !mg.acts.includes("ch-prof")) fail(`${w} px, 'g' : menu Classique (Voir son profil, pas de carte Monocompte) : ` + JSON.stringify(mg));
    await page.evaluate(() => { const m = document.querySelector("#chMenu"); if (m) m.remove(); });
    await page.click('#chat .ch-tab[data-v="m"]');
  };
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
    await profils(p1, 1280);
    console.log("ok - 1280 px : 'm' montre le héros Monocompte (niv. 12, Crâ) sans titre, ailes ni camp Classique ; carte Monocompte au clic sur le pseudo ; 'g' garde le profil Classique");
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
    await profils(p3, 390);
    await p3.click('#chat .ch-tab[data-v="g"]');
    a = await sendTxt(p3, "classique au téléphone");
    if ("p_ch" in a) fail("390 px : envoi dans le Classique");
    await noScroll(p3, "390 px"); await shot(p3, "chat-mono-390.png");
    console.log("ok - téléphone 390 px : onglet Monocompte par défaut et visible, envois dans les deux salons, profils séparés et carte Monocompte, sans défilement de côté");
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - aucune erreur console");
})();
