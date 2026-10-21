/* Ticket #129 : sauvegardes synthétiques, PC et mobile, aucun service réel. */
"use strict";
const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..");
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url.split("?")[0] === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.setHeader("Content-Type", ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html" })[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch(process.env.IDLUS_TEST_BROWSER ? { executablePath: process.env.IDLUS_TEST_BROWSER } : {});
    for (const viewport of [{ width: 2844, height: 1412 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route(url => !url.href.startsWith(base), route => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      await page.goto(base);
      await page.click('[data-act="startgame"]');
      await page.waitForFunction(() => window.DX && DX.S);
      // Un butin Ocre seul ne termine pas la moisson ; le sixième palier reste à faire.
      await page.evaluate(() => {
        const { E, S } = DX;
        E.tipState(S).off = true;
        S.ocre = { tier: 5 };
        S.dofusQ = { ocre: { step: 0, prog: 0, done: 0 } };
        document.querySelector("#sheet").innerHTML = "";
        document.querySelector("#cele").innerHTML = "";
        document.querySelector("#wtip")?.remove();
        E.giveDofus(S, "ocre", "fixture");
        DOFUI.open("coll", "ocre");
      });
      assert.match(await page.locator(".du-todo").innerText(), /palier 6 sur 6/);
      assert.equal(await page.evaluate(() => !!DX.E.dofusQuest(DX.S, "ocre").done), false);
      // Ancienne sauvegarde : dernier palier récompensé, indicateur de quête oublié.
      const before = await page.evaluate(() => {
        const { S } = DX;
        S.ocre.tier = 6;
        return { kamas: S.kamas, items: JSON.stringify(S.items) };
      });
      await page.evaluate(() => DOFUI.open("coll", "ocre"));
      assert.doesNotMatch(await page.locator(".du-todo").innerText(), /Dofus Ocre|palier 7 sur 6/);
      await page.locator('.du-ve[data-v="ocre"]').click();
      assert.match(await page.locator(".du-fiche").innerText(), /Quête terminée/);
      assert.match(await page.locator(".du-fiche").innerText(), /100 %/);
      assert.equal(await page.evaluate(() => DX.E.dofusStep(DX.S, "ocre")), null);
      assert.deepEqual(await page.evaluate(() => {
        for (let i = 0; i < 3; i++) DOFUI.open("coll", "ocre");
        return { kamas: DX.S.kamas, items: JSON.stringify(DX.S.items) };
      }), before, "aucune récompense rejouée au rendu");
      await context.close();
      console.log(`ok - Ocre terminé, récompenses stables, ${viewport.width}px`);
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; server.close(); });
