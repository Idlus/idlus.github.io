/* Ticket #141 : une mission d'alignement « boss » a son « Y aller » vers le donjon, PC et mobile, aucun service réel. */
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
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(String(e)));
      await page.route(url => !url.href.startsWith(base), route => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      await page.goto(base);
      await page.click('[data-act="startgame"]');
      await page.waitForFunction(() => window.DX && DX.S);
      const dg = await page.evaluate(() => {
        const { E, S } = DX;
        E.tipState(S).off = true;
        document.querySelector("#sheet").innerHTML = "";
        document.querySelector("#cele").innerHTML = "";
        document.querySelector("#wtip")?.remove();
        E.ALIGN_MIN_LVL = 0; const err = E.chooseAlign(S, "bonta", "coeur"); if (err) throw new Error(err);
        const d = Object.keys(GAMEDATA.DUNGEONS)[0];
        S.alignQuest = { title: "Mission test", t: "boss", dg: d, n: 1, prog: 0, axp: 100, kamas: 300, txt: "Vaincre le boss." };
        const b = document.createElement("button"); b.dataset.act = "qtab"; b.dataset.v = "align"; b.dataset.gotab = "quests"; b.id = "t141"; document.body.appendChild(b);
        return d;
      });
      await page.evaluate(() => document.querySelector("#t141").click());
      const go = page.locator(`.qcard.cur [data-act="dgopen"][data-id="${dg}"]`);
      await go.waitFor();
      assert.equal(await go.innerText(), "Y aller");
      await go.click();
      await page.waitForFunction(id => (document.querySelector("#sheet")?.innerText || "").includes(GAMEDATA.DUNGEONS[id].name), dg);
      // Mission remplie : plus de bouton.
      await page.evaluate(() => { DX.S.alignQuest.prog = 1; document.querySelector("#sheet").innerHTML = ""; document.querySelector("#t141").click(); });
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.qcard.cur [data-act="dgopen"]').count(), 0);
      if (viewport.width === 1280) await page.evaluate(() => { DX.S.alignQuest.prog = 0; document.querySelector("#t141").click(); });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(process.env.SHOT_DIR || require("os").tmpdir(), `align141-${viewport.width}.png`) });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`ok - mission d'alignement « boss » : Y aller vers le donjon, ${viewport.width}px`);
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; server.close(); });
