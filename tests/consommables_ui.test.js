/* 2.2.8.5 « Consommables » (signalé par Ley) : le Parfum de pistage activé en combat n'apparaissait nulle part (bonus « piste »
   absent de la liste des bonus en cours). Chaque bonbon, potion ou parfum utilisé depuis la barre du combat doit s'afficher
   avec son vrai effet ; PC 1280 et téléphone 390 sans erreur console.
   Lancer : node tests/consommables_ui.test.js (SHOTS=dossier pour garder des captures) */
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

// consommable → texte attendu dans la barre du combat une fois activé
const CASES = [["parfum_piste", "archis ×2"], ["bonbon_traqueur", "archis ×1,5"], ["bonbon_sagesse", "+10 % XP"], ["bonbon_prospecteur", "+10 % butin"],
  ["bonbon_dore", "+15 % kamas"], ["bonbon_royal", "+10 % XP/butin/kamas"], ["potion_recolte", "+20 % récolte"]];

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
      await page.evaluate((ids) => { const S = window.DX.S || window.S; ids.forEach((id) => (S.cons[id] = 2)); window.DX.ui.tab = "combat"; window.DX.render(); }, CASES.map((c) => c[0]));
      for (const [id, want] of CASES) {
        const sel = `#cbar [data-act="usecons"][data-id="${id}"]`;
        if (!(await page.$(sel))) { fail(`${tag} : ${id} absent de la barre du combat`); continue; }
        await page.click(sel); await page.waitForTimeout(150);
        const r = await page.evaluate(() => ({ bar: document.querySelector("#cbar") ? document.querySelector("#cbar").textContent : "", toast: document.querySelector("#toasts") ? document.querySelector("#toasts").textContent : "" }));
        if (!r.bar.includes(want)) fail(`${tag} : ${id} activé mais « ${want} » n'apparaît pas dans la barre (${r.bar.trim().slice(0, 200)})`);
        if (!r.toast.includes(want)) fail(`${tag} : le message d'activation de ${id} ne dit pas « ${want} » (${r.toast.slice(-200)})`);
      }
      // la Pierre d'âme dorée ne se cumule pas avec le Parfum : le refus nomme le bonus en cours et la pierre reste dans le sac
      const pd = await page.evaluate(() => { const S = window.DX.S || window.S; S.cons.pierre_ame_doree = 1; const r = window.ENGINE.useConsumable(S, "pierre_ame_doree"); return { r, n: S.cons.pierre_ame_doree }; });
      if (!pd.r || !pd.r.includes("Parfum de pistage") || pd.n !== 1) fail(`${tag} : refus de la Pierre d'âme dorée incorrect (${JSON.stringify(pd)})`);
      const ow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (ow) fail(`${tag} : la page déborde en largeur`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/consommables-${tag}.png`, fullPage: false });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("consommables_ui.test : ÉCHEC\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("consommables_ui.test : OK");
})();
