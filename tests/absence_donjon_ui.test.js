/* Donjon pendant l'absence, panneau déplié (bug n°45, 2.1.39.1) : avec un donjon choisi et une stasis réussie,
   le panneau « Régler » s'affiche sans erreur (une ligne de code s'était retrouvée dans un commentaire).
   PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/absence_donjon_ui.test.js */
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
      // un donjon réussi en stasis 2, choisi pour l'absence, panneau déplié
      const r = await page.evaluate(() => { const { E, S } = window.DX; const DG = window.DATA.DUNGEONS;
        const did = Object.keys(DG).sort((a, b) => DG[a].lvl - DG[b].lvl)[0]; E.dungeonUnlocked = () => true;
        S.stasis = S.stasis || {}; S.stasis[did] = Object.assign({}, S.stasis[did], { max: 2, sel: 2 });
        const H = E.dgh(S); H.on = true; H.did = did; H.k = 2; S.settings.dghOpen = true;
        try { const html = window.EXPUI.dghPanel(); return { ok: /Pour /.test(html) && /Une course/.test(html), did }; } catch (e) { return { err: e.message, did }; } });
      if (r.err) fail(`${w} px : le panneau plante : ${r.err} (${r.did})`);
      else if (!r.ok) fail(`${w} px : le panneau ne montre pas le plan des courses (${r.did})`);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("absence_donjon_ui : ok (PC 1280 px, téléphone 390 px)");
})();
