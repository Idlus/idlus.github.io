/* 2.2.14.7 « Forgemagie fluide » (Mathis 08/11 : « le serveur lag trop pour spam les runes ») : aucune rune ne passe par le serveur ;
   le lag venait du redessin complet de la page Forgemagie à chaque rune. Une rune ne redessine plus que l'établi, la ligne de l'objet
   et la barre des métiers. On vérifie, au PC 1280 et au téléphone 390, avec un sac de 400 objets :
   - le bouton de la rune reste le même élément (un clic rapide n'est plus perdu) ;
   - après 20 runes et un exo, la page est identique à un redessin complet (rien d'oublié) ;
   - un clic coûte nettement moins qu'un redessin complet ; aucune erreur console.
   Lancer : node tests/forgemagie_fluide_ui.test.js */
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
    for (const [w, hgt, tag] of [[1280, 800, "pc"], [390, 844, "tel"]]) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
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
      await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE, D = window.DATA;
        const tpls = Object.keys(D.ITEMS).filter((t) => D.ITEMS[t].lvl >= 100 && D.ITEMS[t].slot !== "dofus" && !D.ITEMS[t].trophy && !D.ITEMS[t].leg);
        for (let i = 0; i < 400; i++) E.rollItem(S, tpls[(i * 37) % tpls.length], { radiant: false });
        const J = E.fmJobs(S); for (const j in J) J[j].lvl = 150;
        ["ba", "pa", "ra"].forEach((t) => Object.keys(D.STATS).forEach((s) => { S.runes[E.runeKey(t, s)] = 9999; }));
        ["pm", "po", "inv"].forEach((s) => { S.runes[E.exoKey(s)] = 3; });
        const it = Object.values(S.items).find((x) => D.ITEMS[x.tpl].slot === "amulette" && !D.ITEMS[x.tpl].stats.pm);
        const ui = window.DX.ui; ui.tab = "forge"; ui.fg = "fm"; ui.fmSel = it.uid; ui.fmBench = true; window.DX.render(); });
      await page.waitForSelector('#fmbench [data-act="fm"]', { timeout: 5000 });
      // le même bouton reste en place après une rune
      const same = await page.evaluate(() => { const b = document.querySelectorAll('#fmbench [data-act="fm"]')[0]; const k = b.dataset.k; b.click(); return document.querySelector(`#fmbench [data-act="fm"][data-k="${k}"]`) === b; });
      if (!same) fail(`${tag} : le bouton de la rune est recréé après un clic (un clic rapide peut se perdre)`);
      const t = await page.evaluate(() => { const ms = []; for (let i = 0; i < 20; i++) { const B = document.querySelectorAll('#fmbench [data-act="fm"]'); const b = B[i % Math.min(3, B.length)]; const t0 = performance.now(); b.click(); document.body.offsetHeight; ms.push(performance.now() - t0); } return ms; });
      const exo = await page.evaluate(() => { const b = document.querySelector('#fmbench [data-act="exo"]'); if (b) b.click(); return !!b; });
      const r = await page.evaluate(() => { const S = window.DX.S; const n = S.items[window.DX.ui.fmSel].fm || 0; const a = document.querySelector("#main").innerHTML;
        const t0 = performance.now(); window.DX.render(); document.body.offsetHeight; const full = performance.now() - t0; return { n, same: a === document.querySelector("#main").innerHTML, full }; });
      if (r.n < 21) fail(`${tag} : ${r.n} runes comptées sur l'objet (21 attendues au moins)`);
      if (!r.same) fail(`${tag} : après les runes, la page diffère d'un redessin complet`);
      const med = t.sort((a, b) => a - b)[10];
      if (med > r.full) fail(`${tag} : une rune (${med.toFixed(1)} ms) coûte plus qu'un redessin complet (${r.full.toFixed(1)} ms)`);
      console.log(`  ${tag} : rune ${med.toFixed(1)} ms (médiane), redessin complet ${r.full.toFixed(1)} ms${exo ? ", exo testé" : ""}`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("forgemagie_fluide_ui.test : ÉCHEC\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("forgemagie_fluide_ui.test : OK");
})();
