/* 12/11/2026 (2.2.14.20, retour d'Eronny) : créer un héros dans l'Éternel ne doit jamais remplacer la partie Classique · Saison 1.
   Avant, l'écran de création montrait encore « Choisis ton serveur » avec la Saison 1 cochée d'avance : « Commencer l'aventure »
   repartait de zéro dans la partie de saison existante. Dans le navigateur (faux serveur, aucune requête ne sort), PC 1280 px
   et téléphone 390 px :
   - premier lancement : le choix du serveur est montré (Saison 1 proposée) et crée la partie de saison ;
   - écran des parties, partie 1 vide de l'Éternel (le cas d'Eronny) : la Saison 1 n'est plus proposée, le héros part dans
     l'Éternel et la partie de saison est intacte ;
   - même chose avec la partie 2 ;
   - sans erreur console ni défilement de côté.
   Lancer : node tests/s1_pas_ecrasee_ui.test.js (SHOTS=dossier pour garder des captures) */
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
/* faux serveur : visiteur non connecté, espace Saison 1 actif, Monocompte coupé */
function fake() {
  window.__IDLUS_NOMONO = true; window.__IDLUS_S1 = true;
  const q = () => { const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: null, error: null }) : () => b) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  const db = { from: q, rpc: async () => ({ data: null, error: null }) };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {}, schema: () => db,
    functions: { invoke: async () => ({ data: null, error: { message: "absent" } }) },
    rpc: async () => ({ data: null, error: null }),
  }) };
}

(async () => {
  const { chromium } = require("playwright");
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const K1 = "dofousxen-save", KS1 = "dofousxen-save-s1";
  const heroOf = (page, key) => page.evaluate((k) => { const t = localStorage.getItem(k); return t ? window.DX.E.deserialize(t).chars[0].name : null; }, key);
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n), fullPage: true }); };
  const start = async (page, name) => { await page.waitForSelector("#startName", { timeout: 15000 }); await page.fill("#startName", name); await page.click("[data-act=startgame]"); await page.waitForFunction(() => window.DX && window.DX.S, null, { timeout: 15000 }); await page.waitForTimeout(400); };
  try {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const tag = `${w} px`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(fake);
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag}, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${tag}, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      // 1. premier lancement : la Saison 1 est proposée et cochée d'avance
      await page.waitForSelector("#startName", { timeout: 15000 });
      if (!(await page.$("[data-act=startsrv][data-v=s1][aria-pressed=true]"))) fail(`${tag} : premier lancement, la Saison 1 devrait être proposée`);
      await shot(page, `s1-premier-${w}.png`);
      await start(page, "Saisonnier");
      if ((await heroOf(page, KS1)) !== "Saisonnier") fail(`${tag} : le premier héros devrait être dans la partie de saison`);
      // 2. écran des parties (ou pastille du serveur, qui y mène), carte vide de l'Éternel : plus de Saison 1 proposée, la saison reste
      await page.evaluate(() => sessionStorage.setItem("idlus-reprise", "1"));
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector("[data-act=sv-play][data-n='1']", { timeout: 15000 });
      await shot(page, `s1-menu-${w}.png`);
      await page.click("[data-act=sv-play][data-n='1']");
      await page.waitForSelector("#startName", { timeout: 15000 });
      if (await page.$("[data-act=startsrv][data-v=s1]")) fail(`${tag} : la Saison 1 ne doit plus être proposée quand la partie de saison existe`);
      await shot(page, `s1-eternel-${w}.png`);
      await noScroll(page, `${tag}, création dans l'Éternel`);
      await start(page, "Eternelle");
      if ((await heroOf(page, KS1)) !== "Saisonnier") fail(`${tag} : la partie de saison a été remplacée (${await heroOf(page, KS1)})`);
      if ((await heroOf(page, K1)) !== "Eternelle") fail(`${tag} : le héros de l'Éternel devrait être dans la partie 1 (${await heroOf(page, K1)})`);
      // 3. depuis l'écran des parties : partie 2 vide de l'Éternel, pas de choix du serveur, la saison reste
      await page.evaluate(() => sessionStorage.setItem("idlus-menu", "1"));
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector("[data-act=sv-play][data-n='2']", { timeout: 15000 });
      await page.click("[data-act=sv-play][data-n='2']");
      await page.waitForSelector("#startName", { timeout: 15000 });
      if (await page.$("[data-act=startsrv]")) fail(`${tag} : le serveur a déjà été choisi sur l'écran des parties`);
      await start(page, "Deuxieme");
      if ((await heroOf(page, KS1)) !== "Saisonnier") fail(`${tag} : la partie de saison a été remplacée depuis l'écran des parties`);
      if ((await heroOf(page, "dofousxen-save-2")) !== "Deuxieme") fail(`${tag} : le héros devrait être dans la partie 2`);
      await ctx.close();
    }
  } catch (e) { fail(`exception : ${e.stack || e.message}`); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC s1_pas_ecrasee_ui :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("OK s1_pas_ecrasee_ui : créer un héros dans l'Éternel ne touche plus la partie de saison (PC et téléphone)");
})();
