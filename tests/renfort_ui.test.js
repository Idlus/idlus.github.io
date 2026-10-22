/* Renfort d'un ami au Monocompte dans le navigateur (aucune requête ne sort) : la copie d'un ami (équipée chez lui) entre en
   donjon avec le héros ; sa fiche montre ses caractéristiques équipement compris (pas « toute nue »), l'onglet Équipement
   l'explique, « Tout équiper au mieux » ne la propose pas ; PC 1280 px et téléphone 390 px, sans erreur console ni défilement
   de côté. Lancer : node tests/renfort_ui.test.js (SHOTS=dossier pour garder des captures) */
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
        const { E, S } = window.DX; const D = window.DATA; const IT = D.ITEMS;
        E.monoStart(S); E.monoBoot(S); const me = S.chars[0]; me.lvl = 55; E.autoAllocate(S, me);
        // l'ami : un Crâ niveau 60 équipé chez lui
        const F = E.monoStart(E.newState("Zeph", "cra")); E.monoBoot(F); const f = F.chars[0]; f.lvl = 60; E.autoAllocate(F, f);
        ["coiffe", "cape", "amulette", "ceinture", "bottes"].forEach((sl) => { const id = Object.keys(IT).find((k) => IT[k].slot === sl && IT[k].lvl <= 60 && IT[k].lvl >= 40 && IT[k].stats && IT[k].stats.vit); if (id) { const it = E.rollItem(F, id, {}); E.equip(F, f.id, it.uid, sl); } });
        E.refreshSpells(f, E.charStats(F, f));
        const nu = E.charStats(F, Object.assign({}, f, { equip: {} })).hpMax; const snap = E.monoSnap(F, f);
        const did = Object.keys(D.DUNGEONS).find((k) => D.DUNGEONS[k].lvl >= 40); S.res[D.DUNGEONS[did].key] = 1;
        const du = E.dungeonUnlocked; E.dungeonUnlocked = () => true;
        const err = E.monoEnter(S, did, 1, { ami: { u: "00000000-0000-0000-0000-000000000002", p: "Zeph", snap } }); E.dungeonUnlocked = du;
        const rc = S.chars.find((c) => c.merc); window.DX.ui.cid = rc && rc.id; window.DX.ui.hero = "stats"; window.DX.go("team");
        return { err, rc: !!rc, hp: rc && E.charStats(S, rc).hpMax, snapHp: snap.st.hpMax, nu };
      });
      if (st.err || !st.rc) fail(`${w} px : entrée avec le renfort impossible ${JSON.stringify(st)}`);
      if (st.hp !== st.snapHp || st.hp <= st.nu) fail(`${w} px : la fiche du renfort n'a pas son équipement ${JSON.stringify(st)}`);
      await page.waitForTimeout(400);
      const fiche = await page.evaluate(() => (document.querySelector("#fiche") || document.body).textContent);
      if (!fiche.includes(String(st.snapHp))) fail(`${w} px : PV de la copie (${st.snapHp}) absents de la fiche`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `renfort-stats-${w}.png`) });
      await page.evaluate(() => { window.DX.ui.hero = "equip"; window.DX.go("team"); });
      await page.waitForTimeout(400);
      const eq = await page.evaluate(() => ({ t: (document.querySelector("#fiche") || document.body).textContent, all: !!document.querySelector('[data-act="teamequipall"]') }));
      if (!/Copie du héros de Zeph/.test(eq.t)) fail(`${w} px : l'onglet Équipement n'explique pas la copie`);
      if (eq.all) fail(`${w} px : « Tout équiper au mieux » proposé pour la copie`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `renfort-equip-${w}.png`) });
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (sw[0] > sw[1] + 1) fail(`${w} px : défilement de côté (${sw[0]} > ${sw[1]})`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - renfort d'un ami : fiche avec ses caractéristiques équipement compris, onglet Équipement expliqué, rien à équiper, PC et téléphone sans erreur");
})().catch((e) => { console.error(e); process.exit(1); });
