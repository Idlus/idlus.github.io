/* Test de démarrage dans un vrai navigateur (Chromium headless via Playwright) :
   la page se charge, une partie démarre, chaque onglet s'affiche, sans erreur console.
   Lancer : npm install && npx playwright install chromium && node tests/smoke.test.js */
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
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // le test ne dépend pas d'Internet : polices et images distantes sont remplacées par des réponses vides
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; }); // pas de vrai serveur pendant le test
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));
    page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`HTTP ${r.status()} : ${r.url()}`); });

    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    const ok = await page.evaluate(() => !!(window.DX && window.DX.S && window.DX.S.chars.length));
    if (!ok) errors.push("la partie n'a pas démarré");

    // 0.1.31 : chaque page du menu de gauche (PC)
    const keys = await page.$$eval("#nav .sn-side [data-nk]", (bs) => bs.map((b) => b.dataset.nk));
    const tabs = [];
    for (const k of keys) {
      await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); });
      await page.click(`#nav .sn-side [data-nk="${k}"]`);
      await page.waitForTimeout(300);
      const filled = await page.$eval("#main", (m) => m.innerHTML.trim().length > 0);
      if (!filled) errors.push(`page ${k} vide`);
      const cur = await page.$eval("#nav .sn-side [aria-current]", (b) => b.dataset.nk).catch(() => null);
      if (cur !== k) errors.push(`page ${k} : le menu montre ${cur}`);
      tabs.push(k);
    }
    // « Fiche » d'un héros : la page Équipe et héros garde la fiche sous l'équipe
    const noTip = () => page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // une bulle de découverte peut recouvrir le menu
    await noTip(); await page.click('#nav .sn-side [data-nk="team"]'); await page.waitForTimeout(200);
    if (!(await page.$("#teamtop")) || !(await page.$("#fiche"))) errors.push("Équipe et héros : tableau ou fiche absent");
    // 0.1.40 : liste des héros à gauche, fiche à droite, menu « ⋯ Plus » qui s'ouvre et se referme
    if (!(await page.$("#tlist .trow.on"))) errors.push("Équipe et héros : liste des héros absente");
    if (!(await page.$("#fiche .hban"))) errors.push("Équipe et héros : bannière du héros absente");
    await noTip(); await page.click("#fiche .hmore"); await page.waitForTimeout(150);
    if (!(await page.$("#fiche .hmenu"))) errors.push("Équipe et héros : le menu « Plus » ne s'ouvre pas");
    await page.click("#tlist .tgt"); await page.waitForTimeout(150);
    if (await page.$("#fiche .hmenu")) errors.push("Équipe et héros : le menu « Plus » ne se referme pas");
    // menu réduit aux icônes, puis rétabli
    await noTip(); await page.click('#nav [data-act="navmini"]'); await page.waitForTimeout(150);
    if (!(await page.evaluate(() => document.body.classList.contains("navmini")))) errors.push("menu : réduction sans effet");
    await noTip(); await page.click('#nav [data-act="navmini"]'); await page.waitForTimeout(150);
    // une chasse dans la première sous-zone, affichée dans la page Combat
    await page.evaluate(() => { const { E, S } = window.DX; E.startHunt(S, Object.keys(E.SUBS)[0]); });
    await noTip(); await page.click('#nav .sn-side [data-nk="combat"]');
    await page.waitForFunction(() => window.DX.S.fight, null, { timeout: 15000 });
    await page.waitForTimeout(2000);
    // téléphone : barre du bas, bouton Menu et ses tuiles
    await page.setViewportSize({ width: 390, height: 844 });
    await noTip(); await page.click('#nav .sn-mob [data-nk="menu"]');
    await page.waitForSelector(".navsheet .ns-tiles button", { timeout: 5000 });
    await page.click('.navsheet [data-v="forge"]'); await page.waitForTimeout(300);
    // 0.1.40 : au téléphone, la liste d'abord, puis la fiche en plein écran et « ← Équipe »
    const vis = (sel) => page.$eval(sel, (e) => !!(e.offsetWidth || e.offsetHeight)).catch(() => false);
    await page.evaluate(() => { window.DX.ui.tab = "team"; window.DX.ui.tview = "list"; window.DX.render(); });
    if (!(await vis("#tlist")) || (await vis("#fiche .hban"))) errors.push("téléphone : Équipe et héros devrait montrer la liste seule");
    await noTip(); await page.click("#tlist .trow"); await page.waitForTimeout(200);
    if ((await vis("#tlist")) || !(await vis("#fiche .hban"))) errors.push("téléphone : toucher un héros devrait ouvrir sa fiche");
    await noTip(); await page.click('#fiche [data-act="teamlist"]'); await page.waitForTimeout(200);
    if (!(await vis("#tlist"))) errors.push("téléphone : « ← Équipe » ne revient pas à la liste");
    await page.evaluate(() => { window.DX.ui.tab = "home"; window.DX.render(); });
    await noTip(); await page.click('#nav .sn-mob [data-nk="menu"]'); await page.waitForSelector(".navsheet .ns-tiles button", { timeout: 5000 });
    await page.click('.navsheet [data-v="forge"]'); await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.DX.ui.tab)) !== "forge") errors.push("menu du téléphone : la tuile Forgemagie n'ouvre pas la page");
    if (await page.$(".navsheet")) errors.push("menu du téléphone : reste ouvert après le choix");
    // 0.1.42 : accueil du jour (tuiles, journal à onglets, têtes des héros)
    await page.evaluate(() => { const { E, S } = window.DX; E.addCons(S, "coffre_bois"); window.DX.ui.tab = "home"; window.DX.ui.home = "apercu"; window.DX.render(); });
    await noTip();
    if ((await page.$$(".ac-tds .ac-td")).length < 4) errors.push("accueil : il manque des tuiles « Aujourd'hui »");
    await page.click('[data-act="hjtab"][data-v="c"]'); await page.waitForTimeout(150);
    if ((await page.evaluate(() => window.DX.ui.hj)) !== "c") errors.push("accueil : l'onglet Derniers combats ne s'ouvre pas");
    await noTip(); await page.click('.ac-td[data-act="usecons"]'); await page.waitForTimeout(300);
    if (await page.evaluate(() => (window.DX.S.cons.coffre_bois || 0) > 0)) errors.push("accueil : la tuile Coffres n'ouvre pas le coffre");
    await page.evaluate(() => { const s = document.querySelector("#sheet"); if (s) s.innerHTML = ""; window.DX.render(); }); await noTip();
    await page.click(".ac-heads .ac-h:not(.ac-add)"); await page.waitForTimeout(200);
    if ((await page.evaluate(() => window.DX.ui.tab)) !== "team") errors.push("accueil : la tête d'un héros n'ouvre pas sa fiche");
    console.log(`Onglets visités : ${tabs.join(", ")}`);
  } catch (e) {
    errors.push(`étape échouée : ${e.message.split("\n")[0]}`);
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error("ÉCHEC\n" + errors.join("\n")); process.exit(1); }
  console.log("ok - le jeu démarre sans erreur console");
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
