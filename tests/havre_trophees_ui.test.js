/* 2.1.41.2 « Liste des trophées » (signalé par Bellito, ticket #157) : au téléphone, le bouton des trophées de boss du Havre-Sac
   sortait du panneau « Meubles à placer » (explication sur une ligne qui élargissait la liste) ; il ouvre maintenant la liste des boss
   et de leurs trophées. Lancer : node tests/havre_trophees_ui.test.js (SHOTS=dossier pour garder des captures) */
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
  const errors = [];
  const fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  try {
    for (const [w, hgt, tag] of [[1280, 800, "pc"], [390, 844, "tel"], [378, 431, "android"]]) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag} console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${tag} exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.waitForTimeout(600);
      await page.addStyleTag({ content: ".wtip,#cele,#toasts{display:none!important}" });
      // une partie avancée : 60 meubles gagnés (dont des trophées), rien de placé
      await page.evaluate(() => { const { S } = window.DX; const E = window.ENGINE; Object.keys(E.FURN).slice(0, 60).forEach((f) => E.giveFurn(S, f)); const { ui } = window.DX; ui.tab = "home"; ui.home = "havre"; window.DX.render(); });
      await page.waitForTimeout(300);
      let r = await page.evaluate(() => [...document.querySelectorAll("#main section.panel")].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => (p.querySelector("h2") || {}).textContent));
      if (r.length) fail(`${tag} : un panneau du Havre-Sac déborde en largeur (${r.join(", ")})`);
      const btn = await page.$('#main [data-act="fcatalog"][data-v="troph"]');
      if (!btn) { fail(`${tag} : bouton de la liste des trophées absent`); await page.close(); continue; }
      await btn.scrollIntoViewIfNeeded();
      r = await btn.evaluate((b) => { const p = b.closest(".panel").getBoundingClientRect(), q = b.getBoundingClientRect(); return q.left >= p.left && q.right <= p.right + 1; });
      if (!r) fail(`${tag} : le bouton des trophées sort de son panneau (caché au téléphone)`);
      await btn.click(); await page.waitForTimeout(250);
      r = await page.evaluate(() => { const E = window.ENGINE, D = window.DATA; const li = [...document.querySelectorAll("#sheet .li")];
        const n = Object.keys(E.FURN).filter((f) => E.FURN[f].trophy).length;
        const boss = Object.keys(E.FURN).filter((f) => E.FURN[f].trophy).map((f) => D.MONSTERS[D.DUNGEONS[E.FURN[f].trophy].boss].name);
        return { title: (document.querySelector("#sheet h2") || {}).textContent, n, li: li.length, bossOk: boss.every((b) => document.querySelector("#sheet").textContent.includes(b)), go: document.querySelectorAll('#sheet [data-act="dgopen"]').length, got: document.querySelectorAll("#sheet .tag.good").length, ow: document.querySelector("#sheet").scrollWidth > document.querySelector("#sheet").clientWidth + 1 }; });
      if (!/Trophées de boss/.test(r.title || "") || r.li !== r.n || !r.bossOk) fail(`${tag} : la liste des trophées est incomplète (${JSON.stringify(r)})`);
      if (!r.go || !r.got || r.go + r.got !== r.n) fail(`${tag} : chaque trophée doit être « Obtenu » ou avoir « Y aller » (${JSON.stringify(r)})`);
      if (r.ow) fail(`${tag} : la liste des trophées déborde en largeur`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/trophees-${tag}.png` });
      await page.click('#sheet [data-act="dgopen"]'); await page.waitForTimeout(250);
      if (/Trophées de boss/.test(await page.evaluate(() => (document.querySelector("#sheet h2") || {}).textContent || ""))) fail(`${tag} : « Y aller » n'ouvre pas le donjon`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC trophées du Havre-Sac :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("OK trophées du Havre-Sac (PC, téléphone, Android 378×431)");
})();
