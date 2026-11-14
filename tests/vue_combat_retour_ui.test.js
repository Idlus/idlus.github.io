/* 3.1.10 (SegFault 14/11 : « pas moyen de passer de la vue de combat détaillée à la nouvelle vue ? ») : dans la vue détaillée,
   un bouton « ← Nouvelle vue » ramène au tableau de la 3.0, et le menu Combat aussi. PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/vue_combat_retour_ui.test.js */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(ROOT, p); if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end("not found"); } res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }); res.end(buf); });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const browser = await chromium.launch();
  try {
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const page = await (await browser.newContext({ viewport: { width: w, height: hgt } })).newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; window.__IDLUS_NOLAUNCH = true; window.__IDLUS_V3 = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 15000 });
      await page.evaluate(() => { window.DX.ui.startCls = "iop"; });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 15000, state: "attached" });
      const fire = (attrs) => page.evaluate((a) => { const b = document.createElement("button"); Object.assign(b.dataset, a); document.body.appendChild(b); b.click(); b.remove(); }, attrs);
      await fire({ act: "hunt", id: await page.evaluate(() => Object.keys(window.DX.E.SUBS)[0]) }); await page.waitForTimeout(300);
      await fire({ tab: "combat" }); await page.waitForTimeout(800);
      const vis = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((e) => !!e.offsetParent), sel);
      if (!(await vis('#v3b [data-act="v3det"]'))) fail(`${w} px : bouton « Vue détaillée » absent de la nouvelle vue`);
      await page.click('#v3b [data-act="v3det"]'); await page.waitForTimeout(600);
      if (!(await vis(".cv3back"))) fail(`${w} px : pas de bouton « Nouvelle vue » dans la vue détaillée`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail(`${w} px : défilement de côté`);
      await page.click(".cv3back"); await page.waitForTimeout(600);
      if (!(await page.evaluate(() => document.body.classList.contains("v3home")))) fail(`${w} px : le bouton ne ramène pas à la nouvelle vue`);
      await page.click('#v3b [data-act="v3det"]'); await page.waitForTimeout(600);
      await page.evaluate(() => { const b = [...document.querySelectorAll('#nav [data-nk="combat"]')].find((e) => e.offsetParent) || document.querySelector('#nav [data-nk="combat"]'); b.click(); });
      await page.waitForTimeout(600);
      if (!(await page.evaluate(() => document.body.classList.contains("v3home")))) fail(`${w} px : le menu Combat ne ramène pas à la nouvelle vue`);
      console.log(`ok - ${w} px : aller-retour vue détaillée / nouvelle vue`);
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { errors.forEach((e) => console.log("not ok - " + e)); process.exit(1); }
  console.log("ok - retour à la nouvelle vue : PC 1280 px et téléphone 390 px, sans erreur console");
})();
