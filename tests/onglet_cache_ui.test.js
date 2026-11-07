/* 2.2.12.4 (07/11/2026, retour de Nerisia) : onglet caché ou fenêtre recouverte, le navigateur ne réveille plus la boucle du jeu
   qu'une fois par minute. Chaque passage comptait 5 s au plus : le jeu avançait 12 fois moins vite (Sablier ×3 compris).
   Vérifie avec une horloge simulée : des réveils espacés d'une minute jouent tout le temps écoulé, à la vitesse du Sablier
   (qui s'use d'autant) ; un arrêt de plus de 5 minutes (page gelée, veille) reste une absence calculée hors ligne, sans
   être comptée deux fois. PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/onglet_cache_ui.test.js */
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
  const browser = await chromium.launch();
  try {
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt } });
      const page = await ctx.newPage();
      await page.clock.install();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; window.__IDLUS_NOLAUNCH = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.clock.runFor(2000);
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.evaluate(() => { window.DX.ui.startCls = "iop"; window.DX.ui.startSex = null; });
      await page.click('[data-act="startgame"]');
      await page.clock.runFor(3000);
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      // Sablier ouvert en ×3 avec 1 h de réserve, équipe en chasse
      const st = () => page.evaluate(() => { const { S } = window.DX; return { pt: S.stats.playtime, r: S.sablier.r, at: S.sablier.at, spd: S.sablier.spd, hunting: !!S.hunting, off: !!document.getElementById("offc") || /Pendant votre absence/.test(document.body.innerText) }; });
      await page.evaluate(() => { const { S, E } = window.DX; E.sab(S); Object.assign(S.sablier, { open: true, r: 3600, spd: 3 }); const sid = Object.keys(E.SUBS || window.SUBS || {}).find((k) => E.subUnlocked(S, k)); E.startHunt(S, sid); });
      await page.clock.runFor(1000);
      const a = await st();
      if (!a.hunting) fail(`${w} px : l'équipe ne chasse pas, test sans objet`);
      // 5 réveils espacés d'une minute (comme un onglet caché depuis plus de 5 minutes)
      for (let i = 0; i < 5; i++) await page.clock.fastForward(60000);
      const b = await st();
      const played = b.pt - a.pt, used = a.r - b.r + (b.at - a.at) / 1000 * (3 / 24); // la réserve se remplit de 3 h par jour
      if (!(played > 290 && played < 320)) fail(`${w} px : ${Math.round(played)} s jouées pour 300 s de vrai temps (réveils toutes les minutes)`);
      if (!(used > 560 && used < 640)) fail(`${w} px : Sablier ×3 usé de ${Math.round(used)} s pour 300 s (600 attendues)`);
      if (b.off) fail(`${w} px : réveils d'une minute comptés comme une absence`);
      // arrêt de 30 minutes (page gelée) : absence hors ligne, pas de temps rapide
      await page.clock.fastForward(30 * 60000);
      await page.clock.runFor(4000);
      const c = await st();
      const played2 = c.pt - b.pt;
      if (!(played2 < 30)) fail(`${w} px : arrêt de 30 min joué en direct (${Math.round(played2)} s), il doit passer en absence`);
      if (!c.off) {
        const rec = await page.evaluate(() => window.DX.E.now() - window.DX.S.lastTick);
        if (rec > 10000) fail(`${w} px : arrêt de 30 min ni joué ni compté en absence`);
      }
      if (!(b.r - c.r < 60)) fail(`${w} px : Sablier usé pendant l'arrêt (${Math.round(b.r - c.r)} s)`);
      // le calcul d'absence se termine, puis un retour sur l'onglet ne recompte rien
      for (let i = 0; i < 40 && await page.evaluate(() => !!document.getElementById("offc")); i++) await page.clock.runFor(500);
      await page.evaluate(() => { const s = document.getElementById("sheet"); if (s) s.innerHTML = ""; });
      const lt0 = await page.evaluate(() => window.DX.S.lastTick);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.clock.runFor(4000);
      const d = await page.evaluate(() => ({ off: !!document.getElementById("offc"), lag: window.DX.E.now() - window.DX.S.lastTick }));
      if (d.off) fail(`${w} px : absence recomptée au retour sur l'onglet`);
      if (!(d.lag < 5000)) fail(`${w} px : heure de la partie pas reprise (${d.lag} ms, ${lt0})`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) fail(`${w} px : défilement de côté`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("onglet_cache_ui : ÉCHEC\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("onglet_cache_ui : onglet caché joué au vrai temps avec le Sablier, long arrêt compté en absence une seule fois (PC et téléphone) OK");
})().catch((e) => { console.error(e); process.exit(1); });
