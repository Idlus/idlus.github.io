/* 2.2.9.6 « Clavier du téléphone » (signalé par Mathis sur iPhone) : en tapant dans la recherche du choix d'équipement, iOS laissait
   le menu du bas et le suivi de quête au milieu de l'écran. Pendant la saisie au téléphone, ces barres sont cachées (body.kbd),
   puis reviennent à la sortie du champ. Sur PC rien ne change. PC 1280 et téléphone 390 sans erreur console.
   Lancer : node tests/clavier_tel_ui.test.js */
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
      await page.evaluate(() => { const ui = window.DX.ui; ui.tab = "heroes"; ui.slot = "bouclier"; window.DX.render(); });
      await page.waitForTimeout(300);
      const inp = await page.$('#main input[type="search"], #main input[type="text"], #main input:not([type])');
      if (!inp) { fail(`${tag} : aucun champ de recherche dans le choix d'équipement`); await page.close(); continue; }
      const vis = () => page.evaluate(() => getComputedStyle(document.getElementById("nav")).visibility);
      if (await vis() !== "visible") fail(`${tag} : menu du bas caché avant la saisie`);
      await inp.focus(); await page.waitForTimeout(200);
      const kbd = await page.evaluate(() => document.body.classList.contains("kbd"));
      if (touch && (!kbd || await vis() !== "hidden")) fail(`${tag} : le menu du bas reste affiché pendant la saisie`);
      if (!touch && kbd) fail(`${tag} : la saisie sur PC ne doit rien cacher`);
      await page.keyboard.type("bou"); await page.waitForTimeout(3500); // la page se redessine toutes les 3 s : le menu doit rester caché
      if (touch && !(await page.evaluate(() => document.body.classList.contains("kbd")))) fail(`${tag} : le menu du bas revient pendant la frappe`);
      await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.waitForTimeout(300);
      if (await page.evaluate(() => document.body.classList.contains("kbd"))) fail(`${tag} : le menu du bas ne revient pas après la saisie`);
      if (await vis() !== "visible") fail(`${tag} : menu du bas invisible après la saisie`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (sw > 1) fail(`${tag} : la page déborde en largeur (${sw} px)`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC clavier_tel_ui :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("OK clavier_tel_ui : barres cachées pendant la saisie au téléphone, rien sur PC, sans erreur console");
})();
