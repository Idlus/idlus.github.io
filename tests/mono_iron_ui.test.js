/* Mode Ironman du Monocompte dans le navigateur (aucune requête ne sort) : Métiers › Spécialités, bouton « Passer en Ironman »,
   refus hors connexion, passage avec un faux serveur sans vente en cours, sortie ; PC 1280 px et téléphone 390 px.
   Lancer : node tests/mono_iron_ui.test.js (SHOTS=dossier pour garder des captures) */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
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
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.evaluate(() => { window.DX.ui.startCls = "iop"; window.DX.ui.startSex = null; });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.waitForTimeout(500);
      await page.addStyleTag({ content: ".wtip{display:none!important}" });
      const st = await page.evaluate(() => {
        const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); S.jobs.paysan.lvl = 100;
        window.DX.ui.met = "recolte"; window.DX.go("metiers");
        return { err: E.monoIronErr(S) };
      });
      if (st.err) fail(`${w} px : passage refusé ${st.err}`);
      await page.waitForTimeout(400);
      if (!(await page.$('[data-act="monoiron"]'))) fail(`${w} px : bouton « Passer en Ironman » absent`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `iron-avant-${w}.png`), fullPage: false });
      // hors connexion : le passage demande le Monocompte en ligne (vérification des ventes en cours)
      page.once("dialog", (d) => d.accept());
      await page.click('[data-act="monoiron"]'); await page.waitForTimeout(300);
      const t1 = await page.evaluate(() => ({ on: window.DX.E.monoIron(window.DX.S), toast: document.body.textContent.includes("Connecte-toi au Monocompte pour passer en Ironman") }));
      if (t1.on || !t1.toast) fail(`${w} px : passage hors connexion ${JSON.stringify(t1)}`);
      // en ligne (simulé) : rien en cours, le passage se fait
      await page.evaluate(() => { const ON = window.ONLINE; ON.monoMarket = () => true; ON.rpc = async (n) => ({ data: n === "hdv_mine" ? { open: [], sold: [] } : n === "hdv_orders_mine" ? [] : null }); if (window.MARKET) window.MARKET.sync = async () => {}; });
      page.once("dialog", (d) => d.accept());
      await page.click('[data-act="monoiron"]'); await page.waitForTimeout(400);
      const t2 = await page.evaluate(() => ({ on: window.DX.E.monoIron(window.DX.S), quit: !!document.querySelector('[data-act="monoironquit"]'), cap: window.DX.E.jobCap(window.DX.S, "g", "paysan") }));
      if (!t2.on || !t2.quit || t2.cap !== 200) fail(`${w} px : passage en ligne ${JSON.stringify(t2)}`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `iron-on-${w}.png`), fullPage: false });
      page.once("dialog", (d) => d.accept());
      await page.click('[data-act="monoironquit"]'); await page.waitForTimeout(300);
      const t3 = await page.evaluate(() => ({ on: window.DX.E.monoIron(window.DX.S), txt: document.body.textContent.includes("Tu as quitté le mode Ironman") }));
      if (t3.on || !t3.txt) fail(`${w} px : sortie ${JSON.stringify(t3)}`);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : défilement de côté (${sw[0]} > ${sw[1]})`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - mode Ironman : bouton dans Métiers, passage en ligne seulement, sortie, PC et téléphone sans erreur");
})().catch((e) => { console.error(e); process.exit(1); });
