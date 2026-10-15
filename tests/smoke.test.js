/* Test de démarrage dans un vrai navigateur (Chromium headless via Playwright) :
   la page se charge, une partie démarre, chaque onglet s'affiche, sans erreur console.
   Lancer : npm install && npx playwright install chromium && node tests/smoke.test.js */
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

/* 1.2 : une page peut être repliée dans sa famille : on ouvre la famille puis on clique (comme un joueur), sinon DX.go */
const navClick = async (page, k) => { const how = await page.evaluate((k) => { const vis = (e) => !!(e && (e.offsetWidth || e.offsetHeight)); let b = document.querySelector(`#nav .sn-side [data-nk="${k}"]`); if (vis(b)) return "nav"; const F = window.DX.NAV.find((F) => F.pages.some((p) => p[0] === k)); const fh = F && document.querySelector(`#nav .sn-side .sn-fh[data-fam="${F.id}"]`); if (fh && fh.getAttribute("aria-expanded") !== "true") { fh.click(); const w = document.querySelector("#wtip"); if (w) w.remove(); } b = document.querySelector(`#nav .sn-side [data-nk="${k}"]`); return vis(b) ? "nav" : "go"; }, k); if (how === "nav") await page.click(`#nav .sn-side [data-nk="${k}"]`); else await page.evaluate((k) => window.DX.go(k), k); };
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // le test ne dépend pas d'Internet : polices et images distantes sont remplacées par des réponses vides
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; }); // pas de vrai serveur pendant le test
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));
    page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`HTTP ${r.status()} : ${r.url()}`); });

    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    const ok = await page.evaluate(() => !!(window.DX && window.DX.S && window.DX.S.chars.length));
    if (!ok) errors.push("la partie n'a pas démarré");
    // 1.0 : l'écran de lancement (cadeau de la semaine de lancement) s'ouvre au démarrage : on vérifie puis on le ferme
    await page.waitForTimeout(800);
    if (!(await page.$(".launch10"))) errors.push("écran de lancement 1.0 absent");
    await page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; const c = document.querySelector("#cele"); if (c) c.innerHTML = ""; });

    // 0.1.31 : chaque page du menu de gauche (PC)
    // 1.2 : 6 familles repliables ; une page peut être repliée (on ouvre sa famille) ou rangée en onglet dans une autre (Élevage, Cours, Succès)
    const keys = await page.evaluate(() => ["home"].concat(window.DX.NAV.flatMap((F) => F.pages.map((p) => p[0]))));
    const tabs = [];
    for (const k of keys) {
      await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); });
      const how = await page.evaluate((k) => { const vis = (e) => !!(e && (e.offsetWidth || e.offsetHeight)); let b = document.querySelector(`#nav .sn-side [data-nk="${k}"]`); if (vis(b)) return "nav"; const F = window.DX.NAV.find((F) => F.pages.some((p) => p[0] === k)); const fh = F && document.querySelector(`#nav .sn-side .sn-fh[data-fam="${F.id}"]`); if (fh && fh.getAttribute("aria-expanded") !== "true") { fh.click(); const w = document.querySelector("#wtip"); if (w) w.remove(); } b = document.querySelector(`#nav .sn-side [data-nk="${k}"]`); return vis(b) ? "nav" : "tab"; }, k);
      if (how === "nav") await page.click(`#nav .sn-side [data-nk="${k}"]`);
      else { await page.evaluate((k) => window.DX.go(k), k); if (!(await page.$(`#subnav .sn-tabs [data-nk="${k}"][aria-current]`))) errors.push(`page ${k} : pas d'onglet dans le bandeau`); }
      await page.waitForTimeout(300);
      if (k === "bug") { // 1.1.1.3 : « Signaler un bug » ouvre une fenêtre, pas une page
        if (!(await page.$("#sheet #bgWhat"))) errors.push("Signaler un bug : fenêtre absente");
        await page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; }); continue;
      }
      const filled = await page.$eval("#main", (m) => m.innerHTML.trim().length > 0);
      if (!filled) errors.push(`page ${k} vide`);
      const cur = await page.evaluate(() => { const b = document.querySelector("#subnav .sn-tabs [aria-current]") || document.querySelector("#nav .sn-side .sn-fp [aria-current], #nav .sn-side [aria-current]"); return b ? b.dataset.nk : null; });
      if (cur !== k) errors.push(`page ${k} : le menu montre ${cur}`);
      tabs.push(k);
    }
    // « Fiche » d'un héros : la page Équipe et héros garde la fiche sous l'équipe
    const noTip = () => page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // une bulle de découverte peut recouvrir le menu
    await noTip(); await navClick(page, "team"); await page.waitForTimeout(200);
    if (!(await page.$("#teamtop")) || !(await page.$("#fiche"))) errors.push("Équipe et héros : tableau ou fiche absent");
    // 0.1.40 : liste des héros à gauche, fiche à droite, menu « ⋯ Plus » qui s'ouvre et se referme
    if (!(await page.$("#tlist .trow.on"))) errors.push("Équipe et héros : liste des héros absente");
    if (!(await page.$("#fiche .hban"))) errors.push("Équipe et héros : bannière du héros absente");
    await noTip(); await page.click("#fiche .hmore"); await page.waitForTimeout(150);
    if (!(await page.$("#fiche .hmenu"))) errors.push("Équipe et héros : le menu « Plus » ne s'ouvre pas");
    await page.click("#tlist .tgt"); await page.waitForTimeout(150);
    if (await page.$("#fiche .hmenu")) errors.push("Équipe et héros : le menu « Plus » ne se referme pas");
    // menu réduit aux icônes, puis rétabli
    await noTip(); await page.click('#nav [data-act="navmini"]'); await page.waitForTimeout(150);
    if (!(await page.evaluate(() => document.body.classList.contains("navmini")))) errors.push("menu : réduction sans effet");
    await noTip(); await page.click('#nav [data-act="navmini"]'); await page.waitForTimeout(150);
    // une chasse dans la première sous-zone, affichée dans la page Combat
    await page.evaluate(() => { const { E, S } = window.DX; E.startHunt(S, Object.keys(E.SUBS)[0]); });
    await noTip(); await page.click('#nav .sn-side [data-nk="combat"]');
    await page.waitForFunction(() => window.DX.S.fight, null, { timeout: 15000 });
    await page.waitForTimeout(2000);
    // téléphone : barre du bas, bouton Menu et ses tuiles
    await page.setViewportSize({ width: 390, height: 844 });
    await noTip(); await page.click('#nav .sn-mob [data-nk="menu"]');
    await page.waitForSelector(".navsheet .ns-tiles button", { timeout: 5000 });
    await page.click('.navsheet [data-v="forge"]'); await page.waitForTimeout(300);
    // 0.1.40 : au téléphone, la liste d'abord, puis la fiche en plein écran et « ← Équipe »
    const vis = (sel) => page.$eval(sel, (e) => !!(e.offsetWidth || e.offsetHeight)).catch(() => false);
    await page.evaluate(() => { window.DX.ui.tab = "team"; window.DX.ui.tview = "list"; window.DX.render(); });
    if (!(await vis("#tlist")) || (await vis("#fiche .hban"))) errors.push("téléphone : Équipe et héros devrait montrer la liste seule");
    await noTip(); await page.click("#tlist .trow"); await page.waitForTimeout(200);
    if ((await vis("#tlist")) || !(await vis("#fiche .hban"))) errors.push("téléphone : toucher un héros devrait ouvrir sa fiche");
    await noTip(); await page.click('#fiche [data-act="teamlist"]'); await page.waitForTimeout(200);
    if (!(await vis("#tlist"))) errors.push("téléphone : « ← Équipe » ne revient pas à la liste");
    await page.evaluate(() => { window.DX.ui.tab = "home"; window.DX.render(); });
    await noTip(); await page.click('#nav .sn-mob [data-nk="menu"]'); await page.waitForSelector(".navsheet .ns-tiles button", { timeout: 5000 });
    await page.click('.navsheet [data-v="forge"]'); await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.DX.ui.tab)) !== "forge") errors.push("menu du téléphone : la tuile Forgemagie n'ouvre pas la page");
    if (await page.$(".navsheet")) errors.push("menu du téléphone : reste ouvert après le choix");
    // 0.1.42 : accueil du jour (tuiles, journal à onglets, têtes des héros)
    await page.evaluate(() => { const { E, S } = window.DX; delete S.cons.coffre_douze; E.addCons(S, "coffre_bois"); window.DX.ui.tab = "home"; window.DX.ui.home = "apercu"; window.DX.render(); });
    await noTip();
    if ((await page.$$(".ac-tds .ac-td")).length < 4) errors.push("accueil : il manque des tuiles « Aujourd'hui »");
    await page.click('[data-act="hjtab"][data-v="c"]'); await page.waitForTimeout(150);
    if ((await page.evaluate(() => window.DX.ui.hj)) !== "c") errors.push("accueil : l'onglet Derniers combats ne s'ouvre pas");
    await noTip(); await page.click('.ac-td[data-act="usecons"]'); await page.waitForTimeout(300);
    if (await page.evaluate(() => (window.DX.S.cons.coffre_bois || 0) > 0)) errors.push("accueil : la tuile Coffres n'ouvre pas le coffre");
    await page.evaluate(() => { const s = document.querySelector("#sheet"); if (s) s.innerHTML = ""; window.DX.render(); }); await noTip();
    await page.click(".ac-heads .ac-h:not(.ac-add)"); await page.waitForTimeout(200);
    if ((await page.evaluate(() => window.DX.ui.tab)) !== "team") errors.push("accueil : la tête d'un héros n'ouvre pas sa fiche");
    // 1.0.7.11 : recherche rapide, un clic sur « Dernières recherches » remplit le champ et montre les résultats
    await page.evaluate(() => { localStorage.setItem("idlus-recherches", JSON.stringify(["bouftou", "dragon"])); document.querySelector("#sheet").innerHTML = ""; document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })); });
    await page.waitForSelector("#wsearch", { timeout: 3000 }); await page.click('#wsres [data-act="searchfill"][data-q="bouftou"]'); await page.waitForTimeout(150);
    if ((await page.inputValue("#wsq")) !== "bouftou" || !(await page.$('#wsres [data-act="searchgo"]'))) errors.push("recherche : un clic sur une dernière recherche ne la relance pas");
    await page.keyboard.press("Escape"); if (await page.$("#wsearch")) errors.push("recherche : Échap ne ferme pas la fenêtre");
    // 1.0.8.8 : objets identiques regroupés dans le choix d'équipement (une ligne ×N, dépliage gardé au redessin)
    const grp = await page.evaluate(() => { const { E, S, ui } = window.DX; const IT = window.GAMEDATA.ITEMS; const c = S.chars[0];
      const tpl = Object.keys(IT).find((t) => IT[t].slot === "coiffe" && IT[t].lvl <= c.lvl && Object.values(IT[t].stats).some(([a, b]) => b > a));
      for (let i = 0; i < 12; i++) E.rollItem(S, tpl, { radiant: false });
      const ref = Object.values(S.items).find((x) => x.tpl === tpl); for (let i = 0; i < 8; i++) { const u = S.nextUid++; S.items[u] = { uid: u, tpl, stats: Object.assign({}, ref.stats) }; }
      document.querySelector("#sheet").innerHTML = ""; ui.tab = "team"; ui.cid = c.id; ui.tview = "hero"; ui.hero = "equip"; ui.slot = "coiffe"; window.DX.render();
      const rows = [...document.querySelectorAll('#fiche [data-act="equip"]')].filter((b) => S.items[b.dataset.uid].tpl === tpl && !b.closest(".psubs")).length;
      const tog = document.querySelector('[data-act="pgrp"]'); if (tog) tog.click(); window.DX.render();
      const subs = document.querySelectorAll(".psubs .li").length; ui.slot = null; ui.pgrp = {}; ui.tab = "home"; window.DX.render(); return { rows, tog: !!tog, subs }; });
    if (grp.rows !== 1 || !grp.tog || !grp.subs) errors.push(`choix d'équipement : objets identiques mal regroupés (${JSON.stringify(grp)})`);
    // 1.0.8.4 : chaque monstre trouvé par la recherche mène quelque part (archimonstres, co-boss de donjon et boss des mondes compris), historique sans doublons
    const lost = await page.evaluate(() => { const { E, ui } = window.DX; const out = [];
      for (const e of E.searchIndex()) { if (e.k !== "mon") continue; document.querySelector("#sheet").innerHTML = ""; ui.tab = "home"; ui.zoneView = null; window.DX.searchGo(Object.assign({}, e));
        if (ui.tab === "home" && !document.querySelector("#sheet").innerHTML) out.push(e.name); }
      document.querySelector("#sheet").innerHTML = ""; ui.tab = "home"; window.DX.render(); return out; });
    if (lost.length) errors.push(`recherche : ${lost.length} monstres ne mènent nulle part (${lost.slice(0, 3).join(", ")}…)`);
    await page.evaluate(() => { localStorage.removeItem("idlus-recherches"); ["Bouftou", "bouftou ", "BOUFTOU"].forEach((q) => { window.DX.searchOpen(); const i = document.querySelector("#wsq"); i.value = q; window.DX.searchGo({ k: "page", id: "home" }); }); });
    if ((await page.evaluate(() => JSON.parse(localStorage.getItem("idlus-recherches") || "[]").length)) !== 1) errors.push("recherche : la même recherche apparaît plusieurs fois dans l'historique");
    // 1.0.17.1 : un donjon ouvert par la recherche garde sa fiche quand on change de stasis ou d'enchaînement (avant : le donjon vu juste avant revenait)
    const dgIds = await page.evaluate(() => { const D = window.GAMEDATA.DUNGEONS; const ids = Object.keys(D).slice(0, 2); const S = window.DX.S;
      ids.forEach((id) => { S.res[D[id].key] = 6; (S.stasis = S.stasis || {})[id] = { max: 4, sel: 1, firsts: {}, best: {} }; }); return ids; });
    await page.evaluate((a) => { document.querySelector("#sheet").innerHTML = ""; const b = document.createElement("button"); b.dataset.act = "dgopen"; b.dataset.id = a; document.body.appendChild(b); b.click(); b.remove(); }, dgIds[0]);
    await page.evaluate((b) => { document.querySelector("#sheet").innerHTML = ""; window.DX.searchGo({ k: "dg", id: b }); }, dgIds[1]);
    await page.click('#sheet [data-act="dgstasis"][data-v="3"]');
    const dgAfter = await page.evaluate(() => ({ name: (document.querySelector("#sheet .dghead h2") || {}).textContent, on: (document.querySelector('#sheet [data-act="dgstasis"].on') || {}).textContent }));
    const dgName = await page.evaluate((b) => window.GAMEDATA.DUNGEONS[b].name, dgIds[1]);
    if (dgAfter.name !== dgName || dgAfter.on !== "3") errors.push(`donjon : changer de stasis ouvre un autre donjon (${JSON.stringify(dgAfter)}, attendu ${dgName})`);
    await page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; });
    // 1.0.19.1 : un héros de l'équipe qui porte le Dokille (passif de butin) ou l'Argenté (kamas) ne casse plus le Havre-Sac
    const hv = await page.evaluate(() => { const { E, S, ui } = window.DX; const c = S.chars[0]; const lvl = c.lvl; c.lvl = 200;
      ["dokille", "argent"].forEach((id, i) => E.equip(S, c.id, E.rollItem(S, "dofus_" + id, {}).uid, "dofus" + (i + 1)));
      ui.tab = "home"; ui.home = "havre"; ui.bonOpen = true; let err = ""; try { window.DX.render(); } catch (e) { err = e.message; }
      const leg = [...document.querySelectorAll("#main .bonbox .bleg .bchip:not(.off)")].map((x) => x.textContent).join(" "); const out = { err, dof: /Dofus \+/.test(leg) };
      ["dofus1", "dofus2"].forEach((sl) => { delete c.equip[sl]; }); c.lvl = lvl; ui.home = "apercu"; window.DX.render(); return out; });
    if (hv.err) errors.push("Havre-Sac : la page plante avec un Dofus à passif de gains (" + hv.err + ")");
    else if (!hv.dof) errors.push("Havre-Sac : le passif du Dofus n'apparaît pas dans « Mes bonus »");
    console.log(`Onglets visités : ${tabs.join(", ")}`);
  } catch (e) {
    errors.push(`étape échouée : ${e.message.split("\n").slice(0, 3).join(" / ")}`);
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error("ÉCHEC\n" + errors.join("\n")); process.exit(1); }
  console.log("ok - le jeu démarre sans erreur console");
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
