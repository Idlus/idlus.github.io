/* Objet suivi (ticket #198, 3.1.4) : quand la jauge est pleine, l'objet arrive verrouillé dans le sac même avec le tri automatique,
   le grand message « Objet suivi obtenu » s'affiche et la fiche dit « Obtenu 1 fois ».
   PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/objet_suivi_ui.test.js [dossier_captures] */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SHOTS = process.argv[2] || null;
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
      const r = await page.evaluate(() => { const { E, S } = window.DX; const { MONSTERS, ITEMS } = window.DATA;
        const mon = Object.keys(MONSTERS).find((k) => !MONSTERS[k].boss && (MONSTERS[k].items || []).some(([t, p]) => ITEMS[t] && ITEMS[t].lvl < 60 && p < 0.05));
        const [tpl] = MONSTERS[mon].items.find(([t, p]) => ITEMS[t] && ITEMS[t].lvl < 60 && p < 0.05);
        const old = E.rollItem(S, tpl, { floor: 1 }); S.items[old.uid] = S.items[old.uid] || old; // un exemplaire parfait : le tri automatique briserait le nouveau
        S.settings.auto = { recycle: true, action: "break", q: 101, low: 0, lowLvl: 0 };
        E.trackSet(S, tpl); S.track.g = E.TRACK_CAP - 1e-9; let got = [];
        for (let i = 0; i < 50 && !got.length; i++) { const o = E.giveRewards(S, [{ key: mon, lvl: 50, name: "x" }], {}); got = o.items.filter((u) => S.items[u] && S.items[u].tpl === tpl); }
        return { tpl, n: got.length, locked: got.length ? !!S.items[got[0]].locked : false }; });
      if (!r.n) fail(`${w} px : l'objet suivi n'arrive pas dans le sac`);
      else if (!r.locked) fail(`${w} px : l'objet suivi n'est pas verrouillé`);
      await page.waitForTimeout(1200);
      const cele = await page.evaluate(() => document.body.textContent.includes("Objet suivi obtenu"));
      if (!cele) fail(`${w} px : pas de grand message « Objet suivi obtenu »`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `suivi-pop-${w}.png`) });
      await page.evaluate((tpl) => { const b = document.createElement("button"); b.dataset.act = "encitem"; b.dataset.v = tpl; b.id = "tstSuivi"; document.body.appendChild(b); }, r.tpl);
      await page.evaluate(() => document.getElementById("tstSuivi").click());
      await page.waitForTimeout(600);
      const fiche = await page.evaluate(() => { const x = document.querySelector(".trackbox"); return x ? x.innerText : ""; });
      if (!/Obtenu 1 fois/.test(fiche)) fail(`${w} px : la fiche ne dit pas « Obtenu 1 fois » (${fiche.slice(0, 120)})`);
      if (SHOTS) { const tb = await page.$(".trackbox"); if (tb) await tb.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(SHOTS, `suivi-fiche-${w}.png`) }); }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : la page défile de côté (${sw[0]} px pour ${sw[1]})`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("objet_suivi_ui : ok (PC 1280 px, téléphone 390 px)");
})();
