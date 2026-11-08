/* 2.2.13.3 (08/11/2026, #190, retour de Piwki) : PC mis en veille avec le jeu ouvert. Pendant la veille, le chronomètre du
   navigateur (performance.now) s'arrête et seule l'heure de l'appareil avance : au réveil, l'absence doit être comptée
   (fenêtre « Pendant votre absence », gains), une seule fois. PC 1280 px et téléphone 390 px, sans erreur console.
   Le cas en ligne (serveur muet au réveil, puis qui répond) est dans tests/online.test.js (partie 12).
   Lancer : node tests/veille_ui.test.js */
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
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt } });
      const page = await ctx.newPage();
      await page.clock.install();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; window.__IDLUS_NOLAUNCH = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.clock.runFor(2000);
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.evaluate(() => { window.DX.ui.startCls = "iop"; window.DX.ui.startSex = null; });
      await page.click('[data-act="startgame"]');
      await page.clock.runFor(3000);
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.evaluate(() => { const { S, E } = window.DX; const sid = Object.keys(E.SUBS).find((k) => E.subUnlocked(S, k)); E.startHunt(S, sid); });
      await page.clock.runFor(2000);
      const p0 = await page.evaluate(() => [performance.now(), Date.now(), window.DX.S.kamas, window.DX.S.stats.playtime]);
      await page.clock.setSystemTime(p0[1] + 3 * 3600e3); // veille de 3 h : l'heure de l'appareil avance, pas le chronomètre
      await page.clock.runFor(3000);
      for (let i = 0; i < 40 && await page.evaluate(() => !!document.getElementById("offc")); i++) await page.clock.runFor(500);
      const r = await page.evaluate((p) => ({ perf: performance.now() - p[0], t: (document.querySelector("#sheet") || {}).innerText || "", kam: window.DX.S.kamas - p[2], pt: window.DX.S.stats.playtime - p[3], lag: window.DX.E.now() - window.DX.S.lastTick }), p0);
      if (r.perf > 60000) fail(`${w} px : le chronomètre a avancé (${r.perf} ms), test sans objet`);
      if (!/Pendant votre absence/.test(r.t) || !/Absent (2 h 5\d|3 h)/.test(r.t)) fail(`${w} px : veille de 3 h non comptée au réveil : ${r.t.slice(0, 100)}`);
      if (!(r.kam > 0)) fail(`${w} px : aucun gain pendant la veille`);
      if (r.pt > 60) fail(`${w} px : la veille a été jouée en direct (${Math.round(r.pt)} s)`);
      if (!(r.lag < 10000)) fail(`${w} px : heure de la partie pas reprise (${r.lag} ms)`);
      // rien n'est recompté ensuite (retour sur l'onglet, passages de la boucle)
      await page.evaluate(() => { const s = document.getElementById("sheet"); if (s) s.innerHTML = ""; document.dispatchEvent(new Event("visibilitychange")); });
      await page.clock.runFor(6000);
      if (await page.evaluate(() => !!document.getElementById("offc") || /Pendant votre absence/.test(document.body.innerText))) fail(`${w} px : absence recomptée après le réveil`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) fail(`${w} px : défilement de côté`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("veille_ui : ÉCHEC\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("veille_ui : PC mis en veille avec le jeu ouvert, absence comptée au réveil une seule fois (PC et téléphone) OK");
})().catch((e) => { console.error(e); process.exit(1); });
