/* Test de démarrage dans un vrai navigateur (Chromium headless via Playwright) :
   la page se charge, une partie démarre, chaque onglet s'affiche, sans erreur console.
   Lancer : npm install && npx playwright install chromium && node tests/smoke.test.js */
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

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // le test ne dépend pas d'Internet : polices et images distantes sont remplacées par des réponses vides
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));
    page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`HTTP ${r.status()} : ${r.url()}`); });

    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-tab]", { timeout: 10000 });
    const ok = await page.evaluate(() => !!(window.DX && window.DX.S && window.DX.S.chars.length));
    if (!ok) errors.push("la partie n'a pas démarré");

    const tabs = await page.$$eval("#nav [data-tab]", (bs) => bs.map((b) => b.dataset.tab));
    for (const t of tabs) {
      await page.click(`#nav [data-tab="${t}"]`);
      await page.waitForTimeout(300);
      const filled = await page.$eval("#main", (m) => m.innerHTML.trim().length > 0);
      if (!filled) errors.push(`onglet ${t} vide`);
    }
    // une chasse dans la première sous-zone, affichée dans l'onglet Combat
    await page.evaluate(() => { const { E, S } = window.DX; E.startHunt(S, Object.keys(E.SUBS)[0]); });
    await page.click('#nav [data-tab="combat"]');
    await page.waitForFunction(() => window.DX.S.fight, null, { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log(`Onglets visités : ${tabs.join(", ")}`);
  } catch (e) {
    errors.push(`étape échouée : ${e.message.split("\n")[0]}`);
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error("ÉCHEC\n" + errors.join("\n")); process.exit(1); }
  console.log("ok - le jeu démarre sans erreur console");
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
