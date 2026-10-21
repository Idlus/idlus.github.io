/* 2.1.31.5 : bouton à côté de « Combat en cours » dans le menu de gauche (PC) : rentrer de la chasse,
   quitter le donjon en deux clics (la clé est perdue), menu réduit et téléphone, sans erreur console.
   Lancer : node tests/navquit.test.js (SHOTS=dossier pour garder des captures) */
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
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: ".wtip{display:none!important}" });
    const clean = () => page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; const c = document.querySelector("#cele"); if (c) c.innerHTML = ""; });
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: SHOTS + "/" + name, clip: { x: 0, y: 0, width: 320, height: 400 } }); };
    const nav = () => page.evaluate(() => { window.DX.render && window.DX.render(); });
    const state = () => page.evaluate(() => { const S = window.DX.S; return { dg: !!S.dungeon, hunt: !!S.hunting, tab: document.querySelector("#main .combathead") ? "combat" : "autre", q: (document.querySelector("#nav .sn-side .sn-quit") || {}).className || "" }; });
    await clean();

    // chasse : le bouton apparaît, un clic fait rentrer l'équipe sans ouvrir le combat
    await page.evaluate(() => { const { E, S } = window.DX; S.chars.forEach((c) => { c.lvl = 30; }); const sid = Object.keys(E.SUBS)[0]; E.startHunt(S, sid); });
    await page.click('#nav .sn-side [data-nk="home"]'); await page.waitForTimeout(400); await clean();
    let st = await state();
    if (!st.hunt || !/sn-quit/.test(st.q) || /dg/.test(st.q)) fail(`chasse : bouton Rentrer absent (${JSON.stringify(st)})`);
    await shot("navquit-chasse-pc.png");
    await page.click("#nav .sn-side .sn-quit"); await page.waitForTimeout(400);
    st = await state();
    if (st.hunt || st.tab === "combat" || st.q) fail(`chasse : le clic n'a pas fait rentrer l'équipe (${JSON.stringify(st)})`);

    // donjon : premier clic = « Sûr ? », second = sortie ; la chasse de la zone reprend
    await page.evaluate(() => { const { E, S } = window.DX; const D = window.DATA; const sid = Object.keys(E.SUBS)[0]; E.startHunt(S, sid);
      const did = "chateau_ensable"; S.res[D.DUNGEONS[did].key] = 5; E.dungeonUnlocked = () => true; E.enterDungeon(S, did, 1); });
    await page.click('#nav .sn-side [data-nk="home"]'); await page.waitForTimeout(400); await clean();
    st = await state();
    if (!st.dg || !/\bdg\b/.test(st.q)) fail(`donjon : bouton Quitter absent (${JSON.stringify(st)})`);
    await shot("navquit-donjon-pc.png");
    await page.click("#nav .sn-side .sn-quit"); await page.waitForTimeout(300);
    st = await state();
    if (!st.dg || !/ask/.test(st.q)) fail(`donjon : le premier clic doit demander confirmation (${JSON.stringify(st)})`);
    await shot("navquit-sur-pc.png");
    await page.click("#nav .sn-side .sn-quit"); await page.waitForTimeout(400);
    st = await state();
    if (st.dg || st.tab === "combat") fail(`donjon : le second clic n'a pas quitté le donjon (${JSON.stringify(st)})`);
    if (!st.hunt || !/sn-quit/.test(st.q) || /\bdg\b/.test(st.q)) fail(`donjon quitté : la chasse doit reprendre avec le bouton Rentrer (${JSON.stringify(st)})`);

    // la confirmation retombe d'elle-même après 5 s
    await page.evaluate(() => { const { E, S } = window.DX; const D = window.DATA; S.res[D.DUNGEONS.chateau_ensable.key] = 5; E.enterDungeon(S, "chateau_ensable", 1); });
    await page.click('#nav .sn-side [data-nk="home"]'); await page.waitForTimeout(400); await clean();
    await page.click("#nav .sn-side .sn-quit");
    await page.waitForFunction(() => { const b = document.querySelector("#nav .sn-side .sn-quit"); return b && !b.classList.contains("ask"); }, null, { timeout: 9000 }).catch(() => fail("donjon : « Sûr ? » ne retombe pas"));
    if (!(await page.evaluate(() => !!window.DX.S.dungeon))) fail("donjon : quitté sans second clic");

    // menu réduit : le bouton passe sous Combat, dans la colonne
    await page.evaluate(() => { document.querySelector('#nav [data-act="navmini"]').click(); });
    await page.waitForTimeout(300); await clean();
    const mini = await page.evaluate(() => { const f = document.querySelector("#nav .sn-mcol .sn-fight"), q = document.querySelector("#nav .sn-mcol .sn-quit"); if (!f || !q) return null; const a = f.getBoundingClientRect(), b = q.getBoundingClientRect(); return { below: b.top >= a.bottom - 1, w: Math.round(b.width) }; });
    if (!mini || !mini.below) fail(`menu réduit : bouton mal placé (${JSON.stringify(mini)})`);
    await shot("navquit-mini-pc.png");
    await page.evaluate(() => { document.querySelector('#nav [data-act="navmini"]').click(); });
    await page.waitForTimeout(300);

    // largeur : la ligne Combat + bouton ne déborde pas du menu
    const fit = await page.evaluate(() => { const r = document.querySelector("#nav .sn-frow").getBoundingClientRect(), s = document.querySelector("#nav .sn-side").getBoundingClientRect(); return r.right <= s.right + 1; });
    if (!fit) fail("la ligne Combat + bouton déborde du menu");

    // téléphone : pas d'erreur, la barre du bas reste la même
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); await clean();
    if (SHOTS) await page.screenshot({ path: SHOTS + "/navquit-tel.png" });
  } finally {
    await browser.close(); server.close();
  }
  if (errors.length) { console.error("navquit : " + errors.length + " problème(s)\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("navquit : OK");
})();
