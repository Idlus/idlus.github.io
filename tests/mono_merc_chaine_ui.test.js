/* Monocompte, donjons enchaînés avec mercenaire (ticket #151, Vector) : sur la fiche du donjon, choisir un mercenaire puis « Toutes »
   lance bien 3 courses avec le mercenaire. PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/mono_merc_chaine_ui.test.js (SHOTS=dossier pour garder des captures) */
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
      // partie Monocompte : un Iop niveau 60, 3 clés d'un donjon de son niveau, de quoi payer le mercenaire
      const did = await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); const c = S.chars[0]; c.lvl = 60; E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
        const DG = window.DATA.DUNGEONS; const did = Object.keys(DG).find((k) => DG[k].lvl <= 60 && E.dungeonUnlocked(S, k)) || Object.keys(DG)[0]; E.dungeonUnlocked = () => true;
        S.res[DG[did].key] = 3; /* 2.1.39 : + l'entrée du Trousseau du jour = 4 courses */ S.kamas = 1e6; const b = document.createElement("button"); b.dataset.act = "searchdg"; b.dataset.id = did; b.id = "tstdg"; document.body.appendChild(b); return did; });
      await page.evaluate(() => document.getElementById("tstdg").click()); await page.waitForTimeout(300);
      await page.click('#sheet [data-act="mercpick"][data-v="eni"]'); await page.waitForTimeout(200);
      await page.click('#sheet [data-act="dgchainset"][data-v="-1"]'); await page.waitForTimeout(200);
      const txt = await page.textContent("#sheet");
      if (!/à chaque donjon/.test(txt)) fail(`${w} px : le prix par donjon n'est pas affiché`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `merc-chain-${w}.png`) });
      await page.click('#sheet [data-act="enterdg"]'); await page.waitForTimeout(300);
      const st = await page.evaluate(() => { const { E, S } = window.DX; return { dg: !!S.dungeon, chain: S.dungeon && S.dungeon.chain, merc: !!E.monoMercOf(S), n: E.team(S).length }; });
      if (!st.dg || st.chain !== 4 || !st.merc || st.n !== 2) fail(`${w} px : donjon avec mercenaire pas enchaîné ${JSON.stringify(st)} (${did})`);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - Monocompte : un donjon lancé avec un mercenaire s.enchaîne (3 clés + entrée du jour), PC 1280 px et téléphone 390 px");
})().catch((e) => { console.error(e); process.exit(1); });
