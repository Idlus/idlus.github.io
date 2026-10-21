/* Régression UI PC/mobile, uniquement sur une partie éphémère hors ligne.
   node tests/fm-cristal.test.js ; PLAYWRIGHT_EXECUTABLE_PATH facultatif. */
"use strict";
const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => { res.writeHead(err ? 404 : 200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }); res.end(err ? "not found" : buf); });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {});
    const base = `http://127.0.0.1:${server.address().port}/`;
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route((url) => !url.href.startsWith(base), (r) => r.abort());
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      await page.goto(base);
      await page.locator('[data-act="startgame"]').click();
      await page.waitForFunction(() => window.DX && window.DX.S);
      await page.waitForTimeout(1200);
      const uid = await page.evaluate(() => {
        const { ENGINE: E, DATA: D, DX } = window;
        document.querySelector("#sheet").innerHTML = "";
        document.querySelector("#cele").innerHTML = "";
        const tpl = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "coiffe" && D.ITEMS[k].stats.vit && D.ITEMS[k].lvl < 20);
        const it = E.rollItem(DX.S, tpl, { radiant: false });
        it.stats.vit = D.ITEMS[tpl].stats.vit[0];
        DX.S.runes[":vit"] = 10; DX.S.cons.cristal_fm = 2; DX.S.fmHardSeen = 1;
        DX.ui.tab = "forge"; DX.ui.fg = "fm"; DX.ui.fmSel = it.uid; DX.ui.fmBench = true;
        DX.social.render(); return it.uid;
      });
      const button = () => page.locator('.fmcrystal [data-act="usecons"]');
      assert.match(await page.locator(".fmcrystal").innerText(), /Stock : 2/);
      const box = await button().boundingBox(); assert.ok(box && box.width > 0);
      if (mobile) await button().tap(); else await button().click();
      await page.waitForFunction(() => window.DX.S.fmShield);
      assert.ok(await button().isDisabled());
      assert.match(await page.locator(".fmcrystal").innerText(), /Stock : 1/);
      // Deux événements synchrones, y compris sur un ancien élément détaché.
      await page.evaluate(() => {
        const b = document.querySelector('.fmcrystal button'); b.disabled = false;
        b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      assert.strictEqual(await page.evaluate(() => window.DX.S.cons.cristal_fm), 1);
      // Échec critique déterministe, avec les vrais boutons de rune.
      const stats = await page.evaluate((id) => { window.ENGINE.setRng(() => 0.999999); return JSON.stringify(window.DX.S.items[id].stats); }, uid);
      await page.locator('[data-act="fm"][data-k=":vit"]').click();
      assert.strictEqual(await page.evaluate((id) => JSON.stringify(window.DX.S.items[id].stats), uid), stats);
      assert.ok(!(await button().isDisabled()));
      await button().click();
      assert.ok(await button().isDisabled());
      assert.match(await page.locator(".fmcrystal").innerText(), /Stock : 0/);
      assert.match(await page.locator(".fmcrystal").innerText(), /Cristal actif/);
      await page.locator('[data-act="fm"][data-k=":vit"]').click();
      assert.ok(await button().isDisabled());
      assert.match(await page.locator(".fmcrystal").innerText(), /Aucun cristal en stock/);
      assert.strictEqual(await page.evaluate(() => window.DX.ui.fmSel), uid);
      assert.strictEqual(await page.evaluate(() => window.DX.ui.tab), "forge");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "aucun débordement horizontal");
      assert.deepStrictEqual(errors, []);
      console.log(`Cristal FM : ${mobile ? "mobile tactile" : "PC"} OK`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
