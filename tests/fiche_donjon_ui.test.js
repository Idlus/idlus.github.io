/* Bouton « Fiche du donjon » immobile en combat (2.1.41.2, demande de Mathis) : il est dans l'en-tête, au-dessus de l'arène,
   et ne bouge pas pendant les combats dans les 3 affichages (Formation, Scène, Compacte). Sur PC, le cadre « Drops possibles »
   passe au-dessus du Butin pour ne plus glisser quand le butin s'allonge. PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/fiche_donjon_ui.test.js */
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
  const errors = [], fail = (m) => errors.push(m);
  const browser = await chromium.launch();
  try {
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.evaluate(() => { window.DX.ui.startCls = "iop"; window.DX.ui.startSex = null; });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.waitForTimeout(500);
      // le premier donjon, enchaîné 20 fois pour rester en combat pendant la mesure
      await page.evaluate(() => { const { E, S, ui } = window.DX; const DG = window.DATA.DUNGEONS;
        const did = Object.keys(DG).sort((a, b) => DG[a].lvl - DG[b].lvl)[0]; E.dungeonUnlocked = () => true;
        E.team(S).forEach((c) => { c.lvl = 60; }); E.enterDungeon(S, did, 1, 20, 0); ui.tab = "combat"; window.DX.render && window.DX.render(); });
      await page.waitForSelector(".cdgfiche", { timeout: 5000 }).catch(() => fail(`${w} px : pas de bouton « Fiche du donjon » dans l'en-tête du combat`));
      if (w < 640) await page.evaluate(() => { const x = document.querySelector('[data-act="ctab"][data-v="butin"]'); x && x.click(); });
      for (const v of ["form", "scene", "compact"]) {
        await page.evaluate((v) => { const x = document.querySelector(`[data-act="cview"][data-v="${v}"]`); x && x.click(); window.scrollTo(0, 0); }, v);
        await page.waitForTimeout(400);
        const pos = (q) => page.evaluate((q) => { const x = document.querySelector(q); if (!x || !x.offsetParent) return null; const r = x.getBoundingClientRect(); return Math.round(r.top + window.scrollY); }, q);
        const head = new Set(), side = new Set();
        for (let i = 0; i < 12; i++) { head.add(await pos(".cdgfiche")); if (w >= 640) side.add(await pos("#cdrops")); await page.waitForTimeout(400); }
        if (head.size !== 1 || head.has(null)) fail(`${w} px, ${v} : le bouton de l'en-tête bouge ou disparaît (${[...head].join(", ")})`);
        side.delete(null); if (side.size > 1) fail(`${w} px, ${v} : le cadre Drops possibles bouge (${[...side].join(", ")})`);
      }
      await page.click(".cdgfiche");
      await page.waitForTimeout(300);
      if (!(await page.evaluate(() => !!document.querySelector("#sheet .dgsheet, #sheet h2, .sheet h2")))) fail(`${w} px : la fiche du donjon ne s'ouvre pas`);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("fiche_donjon_ui : ok (PC 1280 px, téléphone 390 px)");
})();
