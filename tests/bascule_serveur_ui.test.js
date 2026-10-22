/* 2.1.37.11 (idée de Zoubilus) : bouton ⇄ de la barre du haut, bascule Classique ⇄ Monocompte.
   Dans le navigateur (faux serveur, aucune requête ne sort), PC 1280 px et téléphone 390 px :
   - sans accès au Monocompte, pas de bouton ;
   - partie Classique → bouton → partie Monocompte (emplacement 4) ; la partie Classique a été sauvegardée juste avant ;
   - partie Monocompte → bouton → retour à la partie Classique ; chaque partie garde ses propres kamas (rien ne passe de l'une à l'autre) ;
   - sans erreur console ni défilement de côté.
   Lancer : node tests/bascule_serveur_ui.test.js (SHOTS=dossier pour garder des captures) */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

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
/* faux serveur : visiteur non connecté ; espace Monocompte du serveur coupé (__IDLUS_NOMONO : partie 4 sur l'appareil) ; chaque appel noté */
function fake() {
  window.__IDLUS_NOMONO = true;
  const F = (window.__BSC = { calls: [] });
  const q = () => { const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: null, error: null }) : () => b) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async (n) => { F.calls.push(["fn:" + n, {}]); return { data: null, error: { message: "absent" } }; } },
    rpc: async (name, a) => { F.calls.push([name, a || {}]); return { data: null, error: null }; },
  }) };
}

(async () => {
  const { chromium } = require("playwright");
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const ready = (page, mono) => page.waitForFunction((m) => window.DX && window.DX.S && !!window.DX.S.mono === m && document.querySelector("#status .brand"), mono, { timeout: 15000 });
  const kamasOf = (page, key) => page.evaluate((k) => { const t = localStorage.getItem(k); return t ? window.DX.E.deserialize(t).kamas : null; }, key);
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  try {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(fake);
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.click('[data-act="startgame"]');
      await ready(page, false);
      // 1. pas d'accès au Monocompte : pas de bouton
      if (await page.$('#status [data-act="sv-swap"]')) fail(`${w} px : bouton ⇄ montré sans accès au Monocompte`);
      // 2. une partie Monocompte existe sur l'appareil : le bouton apparaît dans la partie Classique
      await page.evaluate(() => { const { E } = window.DX; const N = E.newState("Mono", "cra"); E.monoStart(N); N.kamas = 777; localStorage.setItem("dofousxen-save-mono", E.serialize(N)); window.DX.S.kamas = 12345; window.DX.social.renderStatus(); });
      await page.waitForSelector('#status [data-act="sv-swap"].to-mo', { timeout: 5000 }).catch(() => fail(`${w} px : bouton ⇄ Monocompte absent de la partie Classique`));
      await shot(page, `bascule-classique-${w}.png`); await noScroll(page, `${w} px, partie Classique`);
      await Promise.all([page.waitForEvent("load"), page.click('#status [data-act="sv-swap"]')]);
      await ready(page, true);
      const m = await page.evaluate(() => [window.ONLINE.slot(), window.DX.S.kamas]);
      if (m[0] !== 4 || m[1] !== 777) fail(`${w} px : après ⇄, partie Monocompte (emplacement 4, 777 kamas) attendue : ` + JSON.stringify(m));
      if ((await kamasOf(page, "dofousxen-save")) !== 12345) fail(`${w} px : la partie Classique n'a pas été sauvegardée avant la bascule`);
      await page.waitForSelector('#status [data-act="sv-swap"].to-cl', { timeout: 5000 }).catch(() => fail(`${w} px : bouton ⇄ Classique absent de la partie Monocompte`));
      await shot(page, `bascule-mono-${w}.png`); await noScroll(page, `${w} px, partie Monocompte`);
      // 3. retour au Classique : chacun ses kamas
      await page.evaluate(() => { window.DX.S.kamas = 999; });
      await Promise.all([page.waitForEvent("load"), page.click('#status [data-act="sv-swap"]')]);
      await ready(page, false);
      const c = await page.evaluate(() => [window.ONLINE.slot(), window.DX.S.kamas]);
      if (c[0] !== 1 || c[1] !== 12345) fail(`${w} px : après le retour, partie Classique 1 avec 12 345 kamas attendue : ` + JSON.stringify(c));
      if ((await kamasOf(page, "dofousxen-save-mono")) !== 999) fail(`${w} px : la partie Monocompte n'a pas été sauvegardée avant le retour`);
      if (!errors.length) console.log(`ok - ${w} px : Classique ⇄ Monocompte en un clic, partie sauvegardée avant, chaque partie garde ses kamas`);
      await ctx.close();
    }
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - aucune erreur console");
})();
