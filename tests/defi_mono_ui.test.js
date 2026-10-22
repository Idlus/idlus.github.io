/* Défi du jour en Monocompte, dans le navigateur (aucune requête ne sort) : bug de Mathis, « en Monocompte on a 1 perso, donc pas de Run ».
   Le 22/10/2026, la règle d'équipe du palier Découverte est « Sans Eniripsa » (Classique). Une partie Monocompte dont le seul héros est un
   Eniripsa voit une règle jouable seul à la place, le bouton « Lancer le défi » est actif et le défi se joue (fiche du résultat).
   PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/defi_mono_ui.test.js (SHOTS=dossier pour garder des captures) */
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

const NOON = Date.UTC(2026, 9, 22, 10, 0); // 12 h à Paris, le jour du signalement (jour 20748)

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  try {
    for (const [w, hgt] of [[1280, 800], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      await page.clock.setFixedTime(NOON);
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
      await page.evaluate(() => { window.DX.ui.startCls = "eni"; window.DX.ui.startSex = null; });
      await page.click('[data-act="startgame"]');
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
      await page.waitForTimeout(500);
      await page.addStyleTag({ content: ".wtip{display:none!important}" });
      // partie Monocompte : un seul héros, un Eniripsa niveau 40
      const st = await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); const c = S.chars[0]; c.lvl = 40; E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
        const cl = E.defi("dec"), mo = E.defiFor(S, "dec"); return { mono: E.isMono(S), n: E.team(S).length, cls: c.cls, day: E.defiDay(), cl: cl.team, mo: mo.team, err: E.defiTeamErr(S, mo) }; });
      if (!st.mono || st.n !== 1 || st.cls !== "eni") fail(`${w} px : partie de test inattendue ${JSON.stringify(st)}`);
      if (st.day !== 20748 || st.cl !== "noeni") fail(`${w} px : le jour de test devait tirer « Sans Eniripsa » en Classique ${JSON.stringify(st)}`);
      if (st.mo === "noeni" || st.err) fail(`${w} px : Monocompte, règle d'équipe injouable ${JSON.stringify(st)}`);
      await page.evaluate(() => { window.DX.ui.defiTier = "dec"; window.DX.go("defi"); });
      await page.waitForTimeout(400);
      const txt = await page.textContent("#main");
      if (/Sans Eniripsa/.test(txt)) fail(`${w} px : « Sans Eniripsa » encore affiché en Monocompte`);
      if (!/ton équipe la respecte/.test(txt)) fail(`${w} px : règle d'équipe pas respectée à l'écran : ${txt.slice(0, 300)}`);
      const btn = await page.$('.defi [data-act="sm-dplay"][data-v="dec"]');
      if (!btn) fail(`${w} px : bouton « Lancer le défi » absent`);
      else if (await btn.isDisabled()) fail(`${w} px : bouton « Lancer le défi » désactivé`);
      else {
        await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(800);
        const res = await page.evaluate(() => { const st = window.DX.E.defiState(window.DX.S); return { tries: st.tries.length, sheet: (document.querySelector("#sheet") || {}).textContent || "" }; });
        if (res.tries !== 1) fail(`${w} px : le défi ne s'est pas joué (${res.tries} essai)`);
        if (!/Réessayer/.test(res.sheet)) fail(`${w} px : fiche du résultat absente : ${res.sheet.slice(0, 200)}`);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `defi-mono-${w}.png`) });
      }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - défi du jour en Monocompte : un Eniripsa seul lance le défi du 22/10/2026 (PC 1280 px, téléphone 390 px)");
})().catch((e) => { console.error(e); process.exit(1); });
