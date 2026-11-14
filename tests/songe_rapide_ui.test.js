/* 3.1.3 « Le Songe ne traîne plus » : avec Auto, la fiche de choix ne s'ouvre plus seule (« Un choix t'attend » sur la page) ; ouverte
   par le joueur, le choix auto attend ; sans Auto, la fiche s'ouvre comme avant. PC 1280 et téléphone 390 sans erreur console.
   Lancer : node tests/songe_rapide_ui.test.js (SHOTS=dossier pour garder des captures) */
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
      const st = () => page.evaluate(() => { const S = window.DX.S || window.S; const X = S.exp; return { on: !!(X && X.on), pend: X && X.pend[0] ? X.pend[0].t : null, sheet: !!document.querySelector("#sheet .sg-sheet:not(.end)"), timer: (document.querySelector("#sgTimer") || {}).textContent || "" }; });
      // un songe en cours, Auto coché, un choix (Sable de Draconiros) arrive
      await page.evaluate(() => { const S = window.DX.S || window.S; const E = window.ENGINE; S.chars[0].lvl = 30; E.songe(S).seen = 1; S.settings.expAuto = true; E.expStart(S, 0); S.exp.sable = 1; S.exp.pick = 0; S.exp.pend.push({ t: "sable", at: E.now() + 60000, id: 901 }); window.DX.ui.tab = "exp"; window.DX.render(); });
      await page.waitForTimeout(700);
      let r = await st();
      if (r.sheet) fail(`${tag} : avec Auto, la fiche de choix s'ouvre toute seule`);
      const btn = await page.$('[data-act="sg-reopen"]');
      if (!btn) fail(`${tag} : « Un choix t'attend » absent de la page`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/rapide-page-${tag}.png` });
      // le joueur ouvre la fiche : le choix auto attend
      if (btn) { await btn.click(); await page.evaluate(() => { const S = window.DX.S || window.S; S.exp.pend[0].at = window.ENGINE.now(); }); }
      await page.waitForTimeout(2600);
      r = await st();
      if (!r.sheet || r.pend !== "sable") fail(`${tag} : fiche ouverte par le joueur, mais le choix auto a été fait (${JSON.stringify(r)})`);
      if (!/en pause/.test(r.timer)) fail(`${tag} : le minuteur ne dit pas que le choix auto attend (${r.timer})`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/rapide-fiche-${tag}.png` });
      // fiche fermée : le jeu choisit en 1,5 s
      await page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; });
      await page.waitForTimeout(2600);
      r = await st();
      if (r.pend === "sable") fail(`${tag} : fiche fermée, le choix auto n'est pas fait en 1,5 s`);
      // sans Auto : la fiche s'ouvre comme avant
      await page.evaluate(() => { const S = window.DX.S || window.S; const E = window.ENGINE; if (!E.expActive(S)) E.expStart(S, 0); S.settings.expAuto = false; S.exp.sable = 1; S.exp.pick = 0; S.exp.pend.push({ t: "sable", at: E.now(), id: 902 }); });
      await page.waitForTimeout(900);
      r = await st();
      if (!r.sheet) fail(`${tag} : sans Auto, la fiche de choix ne s'ouvre plus`);
      const ow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (ow) fail(`${tag} : la page déborde en largeur`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("songe_rapide_ui.test : ÉCHEC\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("songe_rapide_ui.test : OK");
})();
