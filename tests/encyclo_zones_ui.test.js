/* Zones cliquables dans l'encyclopédie (2.2.9.1, demande de Mathis) : dans le Bestiaire, le nom d'une sous-zone ouvre la zone,
   et « ← Encyclopédie » ramène au Bestiaire. PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/encyclo_zones_ui.test.js */
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
      // Encyclopédie › Bestiaire : le nom d'une sous-zone ouverte est un lien vers la zone, retour « ← Encyclopédie »
      await page.evaluate(() => window.DX.go("enc")); await page.waitForTimeout(300);
      const lk = await page.$$eval("#main .enczlink", (L) => L.map((b) => ({ id: b.dataset.id, lock: b.classList.contains("locked") })));
      const open = lk.find((x) => !x.lock);
      if (!lk.length || !open) fail(`${w} px : aucun lien de zone dans le Bestiaire`);
      else {
        await page.click(`#main .enczlink[data-id="${open.id}"]`); await page.waitForTimeout(300);
        const zv = await page.evaluate(() => [window.DX.ui.zoneView, !!document.querySelector('#main [data-act="zonebackenc"]'), !!document.querySelector('#main [data-act="hunt"]')]);
        if (zv[0] !== open.id || !zv[1] || !zv[2]) fail(`${w} px : le lien n'ouvre pas la zone ${open.id} (${JSON.stringify(zv)})`);
        if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/zone-${w}.png` });
        await page.click('#main [data-act="zonebackenc"]'); await page.waitForTimeout(300);
        if (!(await page.$("#main .enczlink"))) fail(`${w} px : le retour ne ramène pas à l'encyclopédie`);
        if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/enc-${w}.png` });
      }
      if (lk.some((x) => x.lock) === false && w === 1280) {
        const hid = await page.evaluate(() => { const L = []; window.DATA.ZONES.forEach((z) => z.subs.forEach((s) => { if (s.hidden) L.push(s.id); })); return L; });
        const bad = await page.$$eval("#main .enczlink", (L, H) => L.filter((b) => H.includes(b.dataset.id) && b.classList.contains("locked")).length, hid);
        if (bad) fail("une zone cachée encore fermée a un lien");
      }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("encyclo_zones_ui : ok (PC 1280 px, téléphone 390 px)");
})();
