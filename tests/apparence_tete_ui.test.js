/* 3.1.4 « Tête et couleurs » (ticket #199, signalé par Ondwuin) : avec une coiffe ou une cape que DofusDB ne sait dessiner
   qu'avec la tête et les couleurs d'origine (presque toutes au-delà du niveau 50), changer de tête ou de couleurs ne changeait rien.
   Maintenant : changer de tête ou de couleurs montre la tête et les couleurs (l'objet est caché, choix « Sur le héros »
   pour le remettre). PC 1280 et téléphone 390 sans erreur console.
   Lancer : node tests/apparence_tete_ui.test.js */
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
  const browser = await chromium.launch();
  try {
    for (const [w, hgt, tag, touch] of [[1280, 800, "pc", false], [390, 844, "tel", true]]) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt }, hasTouch: touch, isMobile: touch });
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
      /* le héros porte une coiffe de niveau 100+ que DofusDB dessine seul (tête et couleurs d'origine) */
      const tpl = await page.evaluate(() => {
        const S = window.DX.S, c = S.chars[0], L = window.LOOKS;
        const tpl = Object.keys(window.DATA.ITEMS).find((k) => window.DATA.ITEMS[k].slot === "coiffe" && /^i\d+$/.test(k) && !L.ITEM_SKINS[k] && !L.NO_LOOK.includes(k) && window.DATA.ITEMS[k].lvl >= 100);
        c.show = c.show || {}; c.show.coiffe = tpl; S.wardrobe = S.wardrobe || {}; S.wardrobe[tpl] = 1;
        const ui = window.DX.ui; ui.tab = "heroes"; window.DX.render(); return tpl;
      });
      if (!tpl) { fail(`${tag} : aucune coiffe de test`); await page.close(); continue; }
      await page.evaluate(() => document.querySelector('[data-act="looksheet"]').click());
      await page.waitForTimeout(300);
      const src = () => page.evaluate(() => { const i = document.querySelector("#sheet .lookbig"); return i ? i.getAttribute("src") : ""; });
      const before = await src();
      if (!/\/kool\/|assets\/look\//.test(before)) fail(`${tag} : avant le choix, la coiffe devrait être dessinée par DofusDB (${before.slice(0, 60)})`);
      if (!(await page.$('[data-act="lookprio"]'))) fail(`${tag} : pas de choix « Sur le héros » alors qu'une coiffe cache la tête`);
      await page.evaluate(() => document.querySelector('#sheet [data-act="lookhead"][data-v="3"]').click());
      await page.waitForTimeout(300);
      const afterHead = await src();
      if (!/_3\.webp$/.test(afterHead)) fail(`${tag} : la tête 3 ne s'affiche pas (${afterHead.slice(0, 80)})`);
      await page.evaluate(() => document.querySelector('#sheet [data-act="lookpal"][data-v="nuit"]').click());
      await page.waitForTimeout(300);
      const afterPal = await src();
      if (!/renderer\.dofusdb\.fr\/look\//.test(afterPal)) fail(`${tag} : la palette Nuit ne s'affiche pas (${afterPal.slice(0, 80)})`);
      const st = await page.evaluate(() => { const c = window.DX.S.chars[0]; return { head: c.head, pal: c.palette, prio: c.lookPrio }; });
      if (st.head !== 3 || st.pal !== "nuit" || st.prio !== "tete") fail(`${tag} : état ${JSON.stringify(st)}`);
      /* retour à la coiffe */
      await page.evaluate(() => document.querySelector('#sheet [data-act="lookprio"][data-v="objet"]').click());
      await page.waitForTimeout(300);
      const back = await src();
      if (/_3\.webp$|renderer\.dofusdb\.fr\/look\//.test(back)) fail(`${tag} : « Mes objets » ne remet pas la coiffe (${back.slice(0, 80)})`);
      if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${tag}.png` });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC apparence_tete_ui :\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("OK apparence_tete_ui : tête et couleurs visibles malgré une coiffe que DofusDB dessine seul (PC + téléphone)");
})();
