/* 2.2.10.2 (06/11/2026, retour du modérateur Likie) : une partie sauvegardée avec une heure du jeu en retard (appareil mis en
   veille, serveur injoignable au réveil) ne compte plus ce retard comme une absence au rechargement : l'absence comptée est la
   plus petite entre l'heure du jeu et l'heure de l'appareil (S.devAt), et le Sablier ne se remplit pas de l'écart.
   Une vraie absence (les deux heures d'accord) reste comptée. PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/absence_horloge_ui.test.js */
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
const H40 = 40 * 3600e3;

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const browser = await chromium.launch();
  try {
    // 1. calcul seul (DX.absGap)
    {
      const page = await browser.newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; window.__IDLUS_NOLAUNCH = true; });
      page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      const r = await page.evaluate((H) => { const E = window.DX.E, f = window.DX.absGap, now = E.now();
        const mk = (lt, dv, sab) => ({ lastTick: lt, devAt: dv, sablier: { r: 0, at: sab } });
        const a = mk(now - H, Date.now() - 30e3, now - H); const ga = f(a);             // heure du jeu en retard : 30 s comptées
        const b = mk(now - H, Date.now() - H, now - H); const gb = f(b);                 // vraie absence de 40 h : comptée
        const c = mk(now - 600e3, undefined, now - 600e3); const gc = f(c);              // ancienne partie sans devAt : comme avant
        const d = mk(now - 600e3, Date.now() + 5 * 86400e3, now - 600e3); const gd = f(d); // appareil reculé depuis : heure du jeu
        return { ga, gb, gc, gd, sabA: now - a.sablier.at, ltA: now - a.lastTick, sabB: now - b.sablier.at };
      }, H40);
      if (!(r.ga >= 29 && r.ga < 40)) fail(`retard de l'heure du jeu compté comme absence : ${r.ga} s`);
      if (!(r.ltA < 40e3 && r.sabA < 40e3)) fail(`heure de la partie et Sablier non recalés (${r.ltA} ms, ${r.sabA} ms)`);
      if (!(Math.abs(r.gb - H40 / 1000) < 5 && r.sabB > H40 - 5000)) fail(`vraie absence de 40 h mal comptée : ${r.gb} s`);
      if (!(Math.abs(r.gc - 600) < 5)) fail(`partie sans devAt : ${r.gc} s au lieu de 600`);
      if (!(Math.abs(r.gd - 600) < 5)) fail(`appareil reculé : ${r.gd} s au lieu de 600`);
      await page.close();
    }
    // 2. dans le jeu : partie sauvegardée avec une heure du jeu en retard de 40 h, puis rechargement
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt } });
      const page = await ctx.newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; window.__IDLUS_NOLAUNCH = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.evaluate(() => { window.DX.ui.startCls = "iop"; window.DX.ui.startSex = null; });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.waitForTimeout(800);
      const txt = await page.evaluate((H) => { const { E, S } = window.DX; const now = E.now();
        const o = JSON.parse(E.serialize(S)); o.lastTick = now - H; o.savedAt = now - H; o.devAt = Date.now() - 20e3; o.sablier = Object.assign({}, o.sablier, { r: 0, at: now - H });
        return JSON.stringify(o); }, H40);
      const key = await page.evaluate(() => Object.keys(localStorage).find((k) => /^dofousxen-save[^-]*$/.test(k) || k === "dofousxen-save"));
      await page.close();
      const p2 = await ctx.newPage();
      await p2.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await p2.addInitScript(([k, t]) => { window.__IDLUS_OFFLINE = true; window.__IDLUS_NOLAUNCH = true; if (!sessionStorage.getItem("__done")) { sessionStorage.setItem("__done", "1"); localStorage.setItem(k, t); } }, [key, txt]);
      p2.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      p2.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await p2.goto(base, { waitUntil: "load" });
      await p2.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" }).catch(() => {});
      const play = await p2.$('[data-act="sv-play"][data-n="1"]'); if (play) { await play.click(); await p2.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" }); }
      await p2.waitForTimeout(1500);
      const r = await p2.evaluate(() => { const { E, S } = window.DX; const t = document.body.innerText;
        return { loaded: !!S, sab: S && S.sablier ? S.sablier.r : null, away: /Pendant votre absence/.test(t), lag: S ? E.now() - S.lastTick : null }; });
      if (!r.loaded) fail(`${w} px : partie non chargée`);
      else {
        if (r.away) fail(`${w} px : « Pendant votre absence » affiché pour une heure du jeu en retard`);
        if (!(r.sab < 600)) fail(`${w} px : Sablier rempli par l'écart d'heure (${r.sab} s)`);
        if (!(r.lag < 10000)) fail(`${w} px : heure de la partie pas reprise (${r.lag} ms)`);
      }
      const wide = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) fail(`${w} px : défilement de côté`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("absence_horloge_ui : ÉCHEC\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("absence_horloge_ui : heure du jeu en retard non comptée comme absence, Sablier recalé, vraie absence gardée (PC et téléphone) OK");
})().catch((e) => { console.error(e); process.exit(1); });
