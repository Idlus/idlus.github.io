/* Annonce plein écran du Boss des mondes (2.2.8.6) : bug de Mathis, « quand je clique ça ne fait rien » (serveur Monocompte · S1).
   En Monocompte, window.WBUI vaut null (modules du Classique éteints) : les clics « wb-* » ne trouvaient plus personne, l'annonce restait.
   1. Partie Classique : l'annonce apparaît, « Plus tard » la ferme, « Attaquer le boss » la ferme et ouvre la page du boss.
   2. Partie Monocompte : plus d'annonce ni de bandeau du boss, et une annonce déjà affichée disparaît au premier clic.
   PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/wboss_annonce_ui.test.js (SHOTS=dossier pour garder des captures, jamais dans le dépôt) */
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
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  try {
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      // une partie neuve : rien de vu sur cet appareil ; deuxième partie du joueur (l'annonce attend la deuxième)
      const fresh = async () => {
        const page = await browser.newPage({ viewport: { width: w, height: hgt } });
        await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
        await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
        page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
        page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
        await page.goto(base, { waitUntil: "load" });
        await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
        await page.click('[data-act="startgame"]');
        await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
        await page.addStyleTag({ content: ".wtip{display:none!important}" });
        await page.evaluate(() => { window.DX.S.sessions = 3; });
        await page.waitForTimeout(3000); // le boss se charge 2,5 s après l'ouverture
        return page;
      };
      const ov = (page) => page.evaluate(() => !!document.querySelector(".wbo"));
      const nudge = async (page) => { await page.evaluate(() => document.body.click()); await page.waitForTimeout(300); };

      // 1. Classique : « Plus tard »
      let page = await fresh(); await nudge(page);
      if (!(await ov(page))) fail(`${w} px, Classique : l'annonce du boss n'apparaît pas`);
      else {
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `wbo-classique-${w}.png`) });
        await page.click('.wbo [data-act="wb-ovclose"]'); await page.waitForTimeout(200);
        if (await ov(page)) fail(`${w} px, Classique : « Plus tard » ne ferme pas l'annonce`);
      }
      await page.close();
      // 1 bis. Classique : « Attaquer le boss »
      page = await fresh(); await nudge(page);
      if (!(await ov(page))) fail(`${w} px, Classique : l'annonce du boss n'apparaît pas (Attaquer)`);
      else {
        await page.click('.wbo [data-act="wb-go"]'); await page.waitForTimeout(400);
        if (await ov(page)) fail(`${w} px, Classique : « Attaquer le boss » ne ferme pas l'annonce`);
        if ((await page.evaluate(() => window.DX.ui.tab)) !== "wb") fail(`${w} px, Classique : « Attaquer le boss » n'ouvre pas la page du boss`);
        const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${w} px : la page défile de côté`);
      }
      await page.close();

      // 2. Monocompte : même état qu'à l'ouverture d'une partie Monocompte (modules du Classique éteints, comme monoSeal dans js/ui.js)
      page = await fresh();
      await page.evaluate(() => { const o = document.createElement("div"); o.className = "wbo"; o.innerHTML = '<button class="btn" data-act="wb-ovclose">Plus tard</button>'; document.body.appendChild(o); }); // annonce restée d'avant
      await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); S.sessions = 3;
        E.MONO.CLASSIC_MODS.forEach((k) => Object.defineProperty(window, k, { configurable: true, get: () => null, set: () => {} })); });
      await nudge(page); await nudge(page);
      if (await ov(page)) fail(`${w} px, Monocompte : l'annonce du Boss des mondes est encore là`);
      if (await page.evaluate(() => { const b = document.querySelector("#wbbar"); return !!(b && b.innerHTML.trim()); })) fail(`${w} px, Monocompte : bandeau du Boss des mondes en haut`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `wbo-mono-${w}.png`) });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC wboss_annonce_ui :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("OK wboss_annonce_ui : annonce du Boss des mondes (Classique : boutons ; Monocompte : jamais affichée), PC 1280 et téléphone 390");
})();
