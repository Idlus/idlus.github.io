/* « Vendre plusieurs » en Monocompte (2.2.14.9, Mathis) : sans vente directe, Héros › Inventaire › Ressources propose
   « Vendre plusieurs », qui vend la sélection au marchand de secours (30 % de la valeur). PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/vente_plusieurs_mono_ui.test.js (SHOTS=dossier pour garder des captures) */
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
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const tag = `Monocompte ${w} px`;
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
      const R = await page.evaluate(() => {
        const { E, S } = window.DX, D = window.DATA; E.monoStart(S); E.monoBoot(S); (E.MONO.CLASSIC_MODS || []).forEach((k) => Object.defineProperty(window, k, { configurable: true, get: () => null, set: () => {} })); // comme monoSeal (js/ui.js)
        const L = Object.keys(D.RES).filter((n) => E.venteOk(n) && !E.isKey(n)).slice(0, 3);
        L.forEach((n, i) => (S.res[n] = 100 * (i + 1))); S.kamas = 0;
        return { L, want: E.merchantPrice(L[0], 100) + E.merchantPrice(L[1], 200) + E.merchantPrice(L[2], 300) - E.merchantPrice(L[2], 50) };
      });
      await page.evaluate(() => { const ui = window.DX.ui; ui.tab = "inv"; ui.inv = "res"; ui.resF = "all"; ui.resQ = ""; window.DX.render(); });
      await page.waitForTimeout(300);
      if (await page.evaluate(() => !!window.VENTEUI)) fail(`${tag} : la vente directe du Classique n'est pas éteinte`);
      const btn = await page.$('[data-act="mk-pick"]');
      if (!btn) { fail(`${tag} : bouton « Vendre plusieurs » absent`); await page.close(); continue; }
      await btn.click(); await page.waitForTimeout(200);
      for (const n of R.L) await page.click(`[data-act="mk-ptile"][data-n="${n}"]`);
      await page.waitForTimeout(200);
      await page.fill(`[data-act="mk-pq"][data-n="${R.L[2]}"]`, "250");
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `vente-plusieurs-mono-${w}.png`) });
      await page.click('[data-act="mk-psell"]'); await page.waitForTimeout(300);
      const o = await page.evaluate((L) => { const S = window.DX.S; return { k: S.kamas, q: L.map((n) => S.res[n] || 0) }; }, R.L);
      if (o.k !== R.want) fail(`${tag} : ${o.k} kamas reçus, attendu ${R.want}`);
      if (o.q.join(",") !== "0,0,50") fail(`${tag} : stocks après la vente ${o.q.join(",")}, attendu 0,0,50`);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${tag} : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - « Vendre plusieurs » en Monocompte : sélection vendue au marchand (PC 1280 px, téléphone 390 px)");
})().catch((e) => { console.error(e); process.exit(1); });
