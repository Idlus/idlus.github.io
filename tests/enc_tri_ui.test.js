/* 2.1.40.10 « Trier l'encyclopédie » (idée de hattory) : Encyclopédie › Équipements filtre par élément ou stat et trie,
   Panoplies aussi ; PC 1280 et téléphone 390 sans erreur console ni débordement.
   Lancer : node tests/enc_tri_ui.test.js (SHOTS=dossier pour garder des captures) */
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
      await page.addStyleTag({ content: ".wtip,#cele,#toasts{display:none!important}" });
      const open = (tab) => page.evaluate((tab) => { const { ui } = window.DX; ui.tab = "world"; ui.zoneView = null; ui.world = "enc"; ui.enc = { tab, f: "all", q: "", fam: "zone", boss: "all" }; window.DX.render(); }, tab);
      await open("eq"); await page.waitForTimeout(300);
      if (!(await page.$("#main select.eqstat"))) fail(`${tag} : le filtre de stat est absent de l'onglet Équipements`);
      // tous les emplacements, tous niveaux, élément Eau : chaque objet donne Chance ou Dommages Eau, trié du plus fort au plus faible
      if (tag === "pc") await page.click('#main [data-act="enceqslot"][data-v="all"]'); else await page.selectOption('#main select[data-act="enceqslotsel"]', "all");
      await page.waitForTimeout(150);
      await page.click('#main [data-act="enceqf"][data-k="lv"][data-v="all"]'); await page.waitForTimeout(150);
      await page.selectOption("#main select.eqstat", "el:e"); await page.waitForTimeout(250);
      let r = await page.evaluate(() => { const { ui } = window.DX; const D = window.DATA; const F = ui.encEq;
        const cards = [...document.querySelectorAll("#main .eqgrid .eqcard [data-act=encitem]")].map((b) => b.dataset.v);
        const v = cards.map((t) => window.ENCSTAT.val(D.ITEMS[t].stats, "el:e"));
        return { F: { ...F }, n: cards.length, ok: v.every((x) => x > 0), sorted: v.every((x, i) => !i || v[i - 1] >= x), hi: document.querySelectorAll("#main .eqst.hi").length, slots: new Set(cards.map((t) => D.ITEMS[t].slot)).size, ow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      if (!r.n || !r.ok) fail(`${tag} : filtre Eau incorrect (${JSON.stringify(r)})`);
      if (r.F.sort !== "val" || !r.sorted) fail(`${tag} : choisir une stat doit trier par sa valeur (${JSON.stringify(r)})`);
      if (!r.hi) fail(`${tag} : la stat filtrée n'est pas surlignée`);
      if (r.slots < 3) fail(`${tag} : « Tous les emplacements » devrait mélanger les emplacements (${r.slots})`);
      if (r.ow) fail(`${tag} : la page déborde en largeur`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/enc-eq-${tag}.png`, fullPage: false });
      // caractéristique précise + tri par niveau décroissant
      await page.selectOption("#main select.eqstat", "pa"); await page.waitForTimeout(150);
      await page.selectOption('#main select[data-act="enceqsort"]', "lvld"); await page.waitForTimeout(200);
      r = await page.evaluate(() => { const D = window.DATA; const cards = [...document.querySelectorAll("#main .eqgrid .eqcard [data-act=encitem]")].map((b) => b.dataset.v);
        return { n: cards.length, pa: cards.every((t) => (D.ITEMS[t].stats.pa || [0, 0])[1] > 0), desc: cards.every((t, i) => !i || D.ITEMS[cards[i - 1]].lvl >= D.ITEMS[t].lvl) }; });
      if (!r.n || !r.pa || !r.desc) fail(`${tag} : filtre PA + niveau ↓ incorrect (${JSON.stringify(r)})`);
      // Panoplies : élément Feu, niveaux 101–150
      await open("sets"); await page.waitForTimeout(300);
      const ss = await page.$('#main select[data-co="sst"]');
      if (!ss) fail(`${tag} : le filtre de stat est absent des Panoplies`);
      else {
        await page.selectOption('#main select[data-co="sst"]', "el:f"); await page.waitForTimeout(200);
        await page.selectOption('#main select[data-co="slv"]', "101-150"); await page.waitForTimeout(250);
        r = await page.evaluate(() => { const n = document.querySelectorAll("#main .co-sets .co-set").length; const tot = +((document.querySelector("#main .co-tb .num") || {}).textContent || "0").replace(/\D/g, ""); return { n, tot, ow: document.documentElement.scrollWidth > innerWidth + 1 }; });
        if (!r.n || !r.tot) fail(`${tag} : aucune panoplie Feu 101–150 (${JSON.stringify(r)})`);
        if (r.ow) fail(`${tag} : Panoplies déborde en largeur`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/enc-sets-${tag}.png` });
      }
      await page.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("Encyclopédie › tri par élément, stat et niveau : OK");
})();
