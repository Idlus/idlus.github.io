/* 2.2.11 « Songes en boucle » : case « En boucle » sur la page du Songe et pendant le songe, récap avec le compte à rebours,
   relance seule, « Arrêter la boucle » ; PC 1280 et téléphone 390 sans erreur console.
   Lancer : node tests/songe_boucle_ui.test.js (SHOTS=dossier pour garder des captures) */
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
    for (const [w, hgt, tag] of [[1280, 800, "pc"], [390, 844, "tel"]]) {
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
      await page.addStyleTag({ content: ".wtip,#cele{display:none!important}" });
      // page du Songe : la case « En boucle » sous « Entrer »
      await page.evaluate(() => { const S = window.DX.S || window.S; S.chars[0].lvl = 30; window.ENGINE.songe(S).seen = 1; window.DX.ui.tab = "exp"; window.DX.render(); });
      await page.waitForTimeout(300);
      const box = await page.$('[data-act="sg-loop"]');
      if (!box) fail(`${tag} : case « En boucle » absente de la page du Songe`);
      else { await box.click(); await page.waitForTimeout(150); if (!(await page.evaluate(() => (window.DX.S || window.S).settings.sgLoop))) fail(`${tag} : la case ne coche pas le réglage`); }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/boucle-entree-${tag}.png` });
      // un songe en cours : la case est à côté d'Auto, cochée
      await page.evaluate(() => { const S = window.DX.S || window.S; window.ENGINE.expStart(S, 0); window.DX.render(); });
      await page.waitForTimeout(400);
      if (!(await page.$('[data-act="sg-loop"]:checked'))) fail(`${tag} : case « En boucle » absente ou décochée pendant le songe`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/boucle-songe-${tag}.png` });
      // réveil automatique : récap avec le compte à rebours, puis le songe repart seul
      await page.evaluate(() => { const S = window.DX.S || window.S; const E = window.ENGINE; S.exp.valid = true; S.exp.pend.push({ t: "wave", at: E.now(), auto: true }); E.expChoose(S, "no"); });
      await page.waitForTimeout(1500);
      const t1 = await page.evaluate(() => (document.querySelector("#sheet") || {}).textContent || "");
      if (!/Prochain songe dans/.test(t1)) fail(`${tag} : le récap ne montre pas la relance (${t1.slice(0, 160)})`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/boucle-recap-${tag}.png` });
      await page.waitForTimeout(5500);
      const r = await page.evaluate(() => { const S = window.DX.S || window.S; return { on: window.ENGINE.expActive(S), end: !!document.querySelector("#sheet .sg-sheet.end") }; });
      if (!r.on) fail(`${tag} : le songe ne s'est pas relancé`);
      if (r.end) fail(`${tag} : le récap reste ouvert après la relance`);
      // Arrêter la boucle depuis le récap
      await page.evaluate(() => { const S = window.DX.S || window.S; const E = window.ENGINE; S.exp.valid = true; S.exp.pend.push({ t: "wave", at: E.now(), auto: true }); E.expChoose(S, "no"); });
      await page.waitForTimeout(1500);
      const stop = await page.$('#sheet [data-act="sg-loopstop"]');
      if (!stop) fail(`${tag} : bouton « Arrêter la boucle » absent`); else { await stop.click(); await page.waitForTimeout(6000); if (await page.evaluate(() => window.ENGINE.expActive(window.DX.S || window.S))) fail(`${tag} : relance malgré « Arrêter la boucle »`); }
      const ow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (ow) fail(`${tag} : la page déborde en largeur`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("songe_boucle_ui.test : ÉCHEC\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("songe_boucle_ui.test : OK");
})();
