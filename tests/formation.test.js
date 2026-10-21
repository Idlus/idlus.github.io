/* 1.0.30 : combat en Formation (vue par défaut) et petit module de combat hors de l'onglet Combat (js/formation.js),
   dans un vrai navigateur, hors ligne : colonnes, ordre de jeu, résistances d'un monstre, bascule des vues,
   module du menu (PC) et bande repliable au-dessus de la barre du bas (téléphone), sans erreur console.
   Lancer : node tests/formation.test.js (SHOTS=dossier pour garder des captures) */
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
    await page.addStyleTag({ content: ".wtip{display:none!important}" }); // bulles de découverte
    const shot = async (name, clip) => { await page.evaluate(() => { const t = document.querySelector(".tooltip"); if (t) t.style.display = "none"; }); await page.screenshot(clip ? { path: SHOTS + "/" + name, clip } : { path: SHOTS + "/" + name }); }; // captures sans infobulle de la souris
    const clean = () => page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; const c = document.querySelector("#cele"); if (c) c.innerHTML = ""; });
    await clean();

    // migration : un ancien choix de vue est oublié une fois (la Formation devient la vue de chacun), puis respecté
    const mig = await page.evaluate(() => { const F = window.FORMUI; const a = { settings: { cview: "scene" } }, b = { settings: { cview: "compact", cviewV: 1 } }, c = { settings: {} };
      return [F.view(a), a.settings.cviewV, a.settings.cview === undefined, F.view(a), F.view(b), F.view(c)]; });
    if (JSON.stringify(mig) !== JSON.stringify(["form", 1, true, "form", "compact", "form"])) fail(`migration de la vue de combat incorrecte (${JSON.stringify(mig)})`);

    // une équipe de 4 au Château Ensablé : monstres aux résistances variées
    await page.evaluate(() => { const { E, S } = window.DX; const D = window.DATA;
      ["eni", "cra", "sacri"].forEach((c, i) => { try { E.recruit(S, c, "Héros" + (i + 1)); } catch (e) { /* recrutement plein */ } });
      S.chars.forEach((c) => { c.lvl = 34; try { E.autoAllocate(S, c); } catch (e) { /* points déjà placés */ } });
      const did = "chateau_ensable"; S.res[D.DUNGEONS[did].key] = 5; E.dungeonUnlocked = () => true; E.enterDungeon(S, did, 1); });
    await clean();
    await page.click('#nav .sn-side [data-nk="combat"]');
    await page.waitForFunction(() => window.DX.S.fight && document.querySelector("#arena .ent.tk"), null, { timeout: 15000 }).catch(() => fail("Formation : pas de combattants dans l'arène"));
    await page.waitForTimeout(1800); await clean();
    const fm = await page.evaluate(() => { const F = window.DX.S.fight, ar = document.querySelector("#arena");
      return { fmode: ar.classList.contains("fmode"), toks: ar.querySelectorAll(".ent.tk").length, ents: F.ents.length, ord: ar.querySelectorAll("#fmOrd .o").length, cur: ar.querySelectorAll("#fmOrd .o.cur").length,
        cols: ar.querySelectorAll(".fm-side .fm-line").length, heroL: ar.querySelectorAll(".fm-side.c .ent.tk.hero").length, monL: ar.querySelectorAll(".fm-side.m .ent.tk.m").length,
        team: F.ents.filter((e) => e.side === "c").length, mons: F.ents.filter((e) => e.side !== "c").length, weak: ar.querySelectorAll(".fm-side.m .fc.wk,.fm-side.m .fc.eq").length,
        hp: (ar.querySelector(".ent.tk .fhp") || {}).textContent, scene: !!ar.querySelector("svg.scene,.ents"), pressed: (document.querySelector('[data-act="cview"][aria-pressed="true"]') || {}).textContent }; });
    if (!fm.fmode || fm.pressed !== "Formation") fail(`Formation : ce n'est pas la vue par défaut (${JSON.stringify(fm)})`);
    if (fm.toks !== fm.ents || fm.heroL !== fm.team || fm.monL !== fm.mons) fail(`Formation : combattants mal rangés (${JSON.stringify(fm)})`);
    if (fm.cols !== 4) fail("Formation : il faut deux colonnes (arrière, première ligne) de chaque côté");
    if (!fm.ord) fail("Formation : ordre de jeu absent en haut");
    if (fm.cur > 1) fail("Formation : plusieurs combattants entourés d'or dans l'ordre de jeu");
    if (!fm.weak) fail("Formation : faiblesse des monstres absente");
    if (!/^\d/.test(fm.hp || "")) fail("Formation : PV absents des médaillons");
    if (fm.scene) fail("Formation : la scène dessinée est encore là");
    // résistances d'un monstre au survol
    // l'arène se redessine pendant le combat (un monstre meurt, un tour passe) : jusqu'à 5 essais, en relisant le monstre à chaque fois
    let mon = null, tip = null;
    for (let k = 0; k < 5 && !(tip && tip.res === 5); k++) {
      mon = await page.$("#arena .ent.tk[data-tipmon]"); if (!mon) break;
      try { await page.mouse.move(0, 0); await mon.hover({ timeout: 2000 }); } catch (e) { continue; } // médaillon redessiné entre-temps
      await page.waitForFunction(() => { const t = document.querySelector(".tooltip"); return t && t.style.display !== "none" && t.querySelectorAll(".fm-tres span").length; }, null, { timeout: 1500 }).catch(() => {});
      tip = await page.evaluate(() => { const t = document.querySelector(".tooltip"); return t && t.style.display !== "none" ? { txt: t.innerText, res: t.querySelectorAll(".fm-tres span").length } : null; });
    }
    if (mon) {
      if (!tip || tip.res !== 5 || !/Faible|Aucune faiblesse/.test(tip.txt)) fail(`Formation : infobulle d'un monstre sans ses 5 résistances (${JSON.stringify(tip)})`);
      if (SHOTS) await page.screenshot({ path: SHOTS + "/formation-pc-infobulle.png" });
      await page.mouse.move(5, 795);
    } else fail("Formation : monstre sans infobulle de résistances");
    if (SHOTS) await shot("formation-pc.png");
    // Scène et Compacte restent au bouton, puis retour à la Formation
    for (const [v, cls] of [["scene", "v2"], ["compact", "cmpmode"], ["form", "fmode"]]) {
      await page.click(`[data-act="cview"][data-v="${v}"]`); await page.waitForTimeout(400);
      const ok = await page.evaluate(([v, cls]) => document.querySelector("#arena").classList.contains(cls) && window.DX.S.settings.cview === v, [v, cls]);
      if (!ok) fail(`bascule de vue « ${v} » sans effet`);
    }
    await page.waitForTimeout(600);
    if ((await page.$$("#arena .ent.tk")).length !== (await page.evaluate(() => window.DX.S.fight.ents.length))) fail("Formation : combattants perdus après un aller-retour de vue");

    // petit module (PC) : sous « Combat en cours », hors de l'onglet Combat ; un clic ouvre le combat
    await page.click('#nav .sn-side [data-nk="home"]'); await page.waitForTimeout(900); await clean();
    const mf = await page.evaluate(() => { const b = document.querySelector("#navmf"), f = document.querySelector("#nav .sn-frow") || document.querySelector("#nav .sn-fight"); return b ? { vis: !b.hidden && b.offsetHeight > 0, txt: b.innerText, after: f && f.nextElementSibling === b, units: b.querySelectorAll(".mf-u").length } : null; });
    if (!mf || !mf.vis || !mf.after || !/Château Ensablé/.test(mf.txt) || !/tour \d/.test(mf.txt) || mf.units < 2) fail(`petit module (PC) absent ou incomplet (${JSON.stringify(mf)})`);
    if (SHOTS) await shot("petit-module-pc.png", { x: 0, y: 0, width: 640, height: 420 });
    // 1.0.30.7 : un Dopeul (monstre de la zone déguisé, il garde e.img) montre sa tête de classe, pas le monstre
    const dopPic = await page.evaluate(() => { const F = window.DX.S.fight, i = F.ents.findIndex((e) => e.side !== "c"); F.ents[i].dop = { cls: "iop", sex: "m", head: 0 }; const b = document.querySelector("#navmf"); b.dataset.k = ""; b.dataset.s = ""; window.FORMUI.mini(); const u = b.querySelector(`.mf-u[data-mi="${i}"] img`); const src = u ? u.getAttribute("src") : null; delete F.ents[i].dop; b.dataset.k = ""; b.dataset.s = ""; window.FORMUI.mini(); return src; });
    if (!dopPic || !/assets\/h\/iop_m/.test(dopPic)) fail(`petit module : le Dopeul montre l'image d'un monstre (${dopPic})`);
    await page.click("#navmf"); await page.waitForTimeout(400);
    if ((await page.evaluate(() => window.DX.ui.tab)) !== "combat") fail("petit module (PC) : le clic n'ouvre pas le combat");
    if (await page.evaluate(() => { const b = document.querySelector("#navmf"); return b && !b.hidden; })) fail("petit module (PC) : encore affiché dans l'onglet Combat");
    // option « Petit module de combat » (Options › Affichage) : coupé, il disparaît
    await page.evaluate(() => { window.DX.S.settings.miniFight = false; window.DX.ui.tab = "home"; window.DX.render(); }); await page.waitForTimeout(400);
    if (await page.evaluate(() => { const b = document.querySelector("#navmf"); return !!(b && !b.hidden); })) fail("petit module : toujours là une fois coupé dans les options");
    await page.evaluate(() => { window.DX.S.settings.miniFight = true; window.DX.render(); }); await page.waitForTimeout(400);

    // téléphone : bande au-dessus de la barre du bas, repliable, un toucher ouvre le combat
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800); await clean();
    const st = await page.evaluate(() => { const s = document.querySelector("#mfstrip"), bar = document.querySelector("#nav .sn-mob"); if (!s) return null; const r = s.getBoundingClientRect(), b = bar.getBoundingClientRect(); return { above: r.bottom <= b.top + 1, inside: r.left >= 0 && r.right <= 390, txt: s.innerText, h: r.height }; });
    if (!st || !st.above || !st.inside || !/Château Ensablé/.test(st.txt)) fail(`petit module (téléphone) : bande absente ou mal placée (${JSON.stringify(st)})`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > 390)) fail("téléphone : la page déborde en largeur");
    if (SHOTS) await shot("petit-module-tel.png");
    await page.click("#mfstrip .mf-fold"); await page.waitForTimeout(300);
    const fo = await page.evaluate(() => ({ fold: window.DX.S.settings.mfFold, cls: document.querySelector("#mfstrip").className, h: document.querySelector("#mfstrip").getBoundingClientRect().height, tab: window.DX.ui.tab }));
    if (!fo.fold || !/fold/.test(fo.cls) || fo.tab !== "home" || !(fo.h < st.h)) fail(`petit module (téléphone) : le repli ne marche pas (${JSON.stringify(fo)})`);
    if (SHOTS) await shot("petit-module-tel-replie.png");
    await page.click("#mfstrip .mf-fold"); await page.waitForTimeout(300);
    await page.click("#mfstrip .mf-hd"); await page.waitForTimeout(800);
    if ((await page.evaluate(() => window.DX.ui.tab)) !== "combat" || (await page.$("#mfstrip"))) fail("petit module (téléphone) : toucher la bande n'ouvre pas le combat");
    await page.waitForTimeout(1200);
    let fmob; for (let i = 0; i < 3; i++) { fmob = await page.evaluate(() => { const ar = document.querySelector("#arena"); return { fmode: ar.classList.contains("fmode"), w: ar.scrollWidth <= ar.clientWidth + 1, toks: ar.querySelectorAll(".ent.tk").length }; }); if (fmob.w) break; await page.waitForTimeout(400); } // un chiffre de dégâts qui s'envole peut dépasser un instant
    if (!fmob.fmode || !fmob.w || !fmob.toks) fail(`Formation (téléphone) : arène incorrecte (${JSON.stringify(fmob)})`);
    // au téléphone, toucher un monstre montre ses résistances
    let m2 = null; // même précaution : le médaillon peut être redessiné entre la recherche et le toucher
    for (let k = 0; k < 4; k++) { m2 = await page.$("#arena .ent.tk[data-tipmon]"); if (!m2 || await m2.click({ timeout: 2000 }).then(() => true, () => false)) break; }
    if (m2) { await page.waitForTimeout(200);
      if (!(await page.evaluate(() => { const t = document.querySelector(".tooltip"); return !!(t && t.style.display !== "none" && t.querySelector(".fm-tres")); })) && !(await page.evaluate(() => window.matchMedia("(hover: hover)").matches))) fail("Formation (téléphone) : toucher un monstre ne montre pas ses résistances"); }
    if (SHOTS) { await clean(); await shot("formation-tel.png"); }
  } catch (e) {
    errors.push(`étape échouée : ${e.message.split("\n")[0]}`);
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error("ÉCHEC\n" + errors.join("\n")); process.exit(1); }
  console.log("ok - combat en Formation et petit module de combat");
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
