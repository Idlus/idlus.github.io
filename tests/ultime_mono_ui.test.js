/* 2.2.12.2 (#183, Nerisia) : en Monocompte, la fiche du donjon montre les Sceaux ultimes dès la stasis 7 et la fiche d'un légendaire
   dit d'où viennent les copies. PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/ultime_mono_ui.test.js (SHOTS=dossier pour garder des captures) */
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
      if (mono) await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); });
      const did = await page.evaluate(() => { const { E, S } = window.DX; const D = window.DATA; S.chars.forEach((c) => (c.lvl = 200));
        const did = Object.keys(D.DUNGEONS).find((d) => D.DUNGEONS[d].lvl >= 161 && d !== E.ultWeek()); S.res[D.DUNGEONS[did].key] = 1; const SI = E.stasisInfo(S, did); SI.max = 9;
        E.ultSt(S).tr = 1500; return did; });
      await page.evaluate((did) => { const b = document.createElement("button"); b.dataset.act = "dgstasis"; b.dataset.id = did; b.dataset.v = "8"; b.id = "tbtn"; document.body.appendChild(b); b.click(); b.remove(); }, did);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const box = document.querySelector("#sheet .ultbox"); return { box: !!box, txt: box ? box.textContent : "", buy: !!document.querySelector('#sheet [data-act="ultbuy"]') }; });
      if (mono) { if (!r.box || !/dès la stasis 7/.test(r.txt) || !r.buy) fail(`${tag} : encadré des Sceaux ultimes absent en stasis 8 (${r.txt.slice(0, 80)})`); }
      else if (r.box) fail(`${tag} : encadré des Sceaux ultimes affiché en stasis 8 au Classique`);
      if (SHOTS) { const el = await page.$("#sheet .ultbox"); if (el) await el.screenshot({ path: path.join(SHOTS, `ult-${mono ? "mono" : "classique"}-${w}.png`) }); }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${tag} : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      // fiche du légendaire
      const t = await page.evaluate(() => { const { E, S } = window.DX; const x = E.LEG_LIST[0]; const it = E.giveLeg(S, x.k, "test"); window.SGUI.legSheet(S, x.k, it.uid); return document.querySelector("#sheet").textContent; });
      if (mono !== /En Monocompte, les copies viennent des Sceaux ultimes/.test(t)) fail(`${tag} : phrase des copies ${mono ? "absente" : "affichée au Classique"}`);
      if (SHOTS && mono) await page.screenshot({ path: path.join(SHOTS, `leg-mono-${w}.png`) });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - Sceaux ultimes dès la stasis 7 en Monocompte : fiche du donjon et fiche du légendaire (PC 1280 px, téléphone 390 px)");
})().catch((e) => { console.error(e); process.exit(1); });
