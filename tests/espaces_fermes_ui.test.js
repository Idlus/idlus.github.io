/* 3.1.9 (Mathis 14/11 : « il manque plein d'onglets en Saison 1 ? ») : les espaces de la 3.0 encore fermés (Artisanat 5, Collection 10,
   Marché 15, Joueurs 20) restent visibles, grisés avec leur niveau, dans le menu en icônes, le menu complet et le menu Plus du téléphone ;
   un clic dit le niveau ; au niveau 20 ils sont tous ouverts. PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/espaces_fermes_ui.test.js */
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
      await page.waitForTimeout(500);
      const lk = () => page.evaluate(() => [...document.querySelectorAll("#nav .v3lk")].map((e) => e.textContent.replace(/\s+/g, " ").trim()));
      const a = await lk();
      if (a.length !== 4 || !/Artisanat.*niv\. 5/.test(a[0]) || !/Joueurs.*niv\. 20/.test(a[3])) fail(`${w} px : espaces fermés attendus (4, niv. 5 à 20) : ${JSON.stringify(a)}`);
      if (w === 1280) {
        await page.click("#nav .sn-rail .v3lk");
        const said = await page.waitForFunction(() => /Artisanat s'ouvre quand un de tes héros atteint le niveau 5/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true, () => false);
        if (!said) fail("1280 px : le clic sur un espace fermé ne dit pas son niveau");
        await page.click('[data-act="navall"]'); await page.waitForTimeout(300);
        if (await page.evaluate(() => document.querySelectorAll("#nav .sn-full .v3lk").length) !== 4) fail("1280 px : menu complet sans les espaces fermés");
        await page.click('[data-act="navall"]'); await page.waitForTimeout(300);
      } else {
        await page.click('[data-act="navmenu"]'); await page.waitForTimeout(500);
        if (await page.evaluate(() => document.querySelectorAll("#sheet .ns-ft.v3lk").length) !== 4) fail("390 px : menu Plus sans les espaces fermés");
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail("390 px : défilement de côté");
        await page.click('[data-act="closesheet"]'); await page.waitForTimeout(300);
      }
      await page.evaluate(() => { window.DX.S.chars.forEach((c) => (c.lvl = 20)); window.V3.relock(); });
      await page.waitForTimeout(400);
      const b = await lk();
      if (b.length) fail(`${w} px : au niveau 20, des espaces restent fermés : ${JSON.stringify(b)}`);
      console.log(`ok - ${w} px : espaces fermés grisés avec leur niveau, tous ouverts au niveau 20`);
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { errors.forEach((e) => console.log("not ok - " + e)); process.exit(1); }
  console.log("ok - espaces fermés : PC 1280 px et téléphone 390 px, sans erreur console");
})();
