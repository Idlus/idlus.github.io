/* Bouton « Comptoirs » des Quêtes (2.2.9.8, signalé par Likie) : en Monocompte, la page Comptoirs est fermée (module CPTUI éteint),
   le bouton renvoyait au Havre-Sac. Il doit ouvrir les 3 boutiques des quêtes ; au Classique, il ouvre toujours Économie › Comptoirs.
   PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/comptoirs_mono_ui.test.js (SHOTS=dossier pour garder des captures) */
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
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  try {
    for (const mono of [true, false]) for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const tag = `${mono ? "Monocompte" : "Classique"} ${w} px`;
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag}, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${tag}, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.waitForTimeout(500);
      await page.addStyleTag({ content: ".wtip{display:none!important}" });
      if (mono) await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S);
        // comme monoSeal (js/ui.js) : le module des Comptoirs du Classique est éteint
        Object.defineProperty(window, "CPTUI", { configurable: true, get: () => null, set: () => {} }); });
      await page.evaluate(() => window.DX.go("quests"));
      await page.waitForTimeout(400);
      const sel = w > 800 ? '.qj-shopbtn[data-v="shops"]' : '.qj-chips [data-act="qtab"][data-v="shops"]';
      const btn = await page.$(sel);
      if (!btn) { fail(`${tag} : bouton Comptoirs absent (${sel})`); await page.close(); continue; }
      await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(500);
      const r = await page.evaluate(() => ({ tab: window.DX.ui.tab, qt: window.DX.ui.qt, txt: document.querySelector("#main").textContent }));
      if (mono) {
        if (r.tab !== "quests" || r.qt !== "shops") fail(`${tag} : le bouton mène à ${r.tab}/${r.qt} au lieu des boutiques des quêtes`);
        for (const n of ["Bureau des primes", "Comptoir de la cité", "Comptoir des temples"]) if (!r.txt.includes(n)) fail(`${tag} : « ${n} » absent`);
      } else if (r.tab !== "comptoirs") fail(`${tag} : le bouton mène à ${r.tab} au lieu d'Économie › Comptoirs`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `comptoirs-${mono ? "mono" : "classique"}-${w}.png`) });
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${tag} : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - bouton Comptoirs des Quêtes : 3 boutiques en Monocompte, page Comptoirs au Classique (PC 1280 px, téléphone 390 px)");
})().catch((e) => { console.error(e); process.exit(1); });
