/* 3.1.6 « Zones de chasse favorites » (idée de SegFault) : l'étoile ajoute une zone à la section Favoris sans ouvrir sa fiche,
   les favoris restent quel que soit le filtre de niveaux, la fiche de zone a son bouton, 12 au plus. PC 1280 et téléphone 390 sans erreur console.
   Lancer : node tests/favoris_zones_ui.test.js (SHOTS=dossier pour garder des captures) */
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
      // liste des régions, toutes tranches, une chasse en cours
      const L = await page.evaluate(() => { const D = window.DX; const S = D.S; const E = window.ENGINE; S.chars.forEach((c) => (c.lvl = 60));
        const subs = Object.values(E.SUBS).filter((s) => !s.hidden && s.lvl[0] >= 30 && s.lvl[0] <= 70).map((s) => s.id);
        E.startHunt(S, subs[3]); D.ui.tab = "world"; D.ui.world = "map"; D.ui.mapView = "liste"; D.ui.mapTier = -1; D.ui.mapOpen = { "-1": E.SUBS[subs[3]].zone }; D.render(); return subs; });
      await page.waitForTimeout(500);
      if (await page.$(".favp")) fail(`${tag} : section Favoris affichée sans favori`);
      // étoile d'une zone : ajout, sans ouvrir la fiche
      await page.click(`.zonefoldp.open .srfav[data-id="${L[3]}"]`); await page.waitForTimeout(300);
      let r = await page.evaluate(() => ({ f: window.DX.S.favZones, zv: window.DX.ui.zoneView || null, n: document.querySelectorAll(".favp .subrow").length }));
      if (!r.f || r.f[0] !== L[3]) fail(`${tag} : l'étoile n'ajoute pas la zone aux favoris (${JSON.stringify(r)})`);
      if (r.zv) fail(`${tag} : l'étoile ouvre la fiche de la zone`);
      if (r.n !== 1) fail(`${tag} : la section Favoris ne montre pas la zone (${r.n})`);
      // un autre filtre de niveaux : les favoris restent
      await page.evaluate(() => { window.DX.ui.mapTier = 4; window.DX.render(); }); await page.waitForTimeout(300);
      if (!(await page.$(".favp .subrow"))) fail(`${tag} : les favoris disparaissent avec un autre filtre de niveaux`);
      // la fiche de zone : bouton « Dans les favoris », retrait
      await page.click(".favp .subrow"); await page.waitForTimeout(300);
      const fb = await page.$('.favbtn[data-act="favzone"]');
      if (!fb) fail(`${tag} : pas de bouton favori sur la fiche de zone`);
      else { await fb.click(); await page.waitForTimeout(300); r = await page.evaluate(() => window.DX.S.favZones.length); if (r !== 0) fail(`${tag} : le bouton de la fiche ne retire pas le favori`); }
      // plafond de 12
      r = await page.evaluate((L) => { const D = window.DX; D.S.favZones = L.slice(0, 12); D.ui.zoneView = null; D.ui.mapTier = -1; D.render(); return document.querySelectorAll(".favp .subrow").length; }, L);
      if (r !== 12) fail(`${tag} : 12 favoris attendus, ${r} affichés`);
      await page.click(`.srfav:not(.on)`); await page.waitForTimeout(300);
      if (await page.evaluate(() => window.DX.S.favZones.length) !== 12) fail(`${tag} : plus de 12 favoris acceptés`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/favoris-${tag}.png` });
      const ow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (ow) fail(`${tag} : la page déborde en largeur`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("favoris_zones_ui.test : ÉCHEC\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("favoris_zones_ui.test : OK");
})();
