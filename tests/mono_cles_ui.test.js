/* Clés bêta du Monocompte dans le navigateur (aucune requête ne sort) :
   - Options › Compte › Bêta Monocompte, Monocompte en ligne coupé (flag mono à false, comme aujourd'hui) : l'ancien code marche
     comme avant ;
   - Monocompte en ligne actif (faux serveur : mono_cle_utiliser simulé dans la page) : la saisie part au serveur par
     js/mono_online.js, l'ancien code n'ouvre plus rien, la partie se débloque seulement sur la réponse du serveur ;
   - Panel Xener › Clés bêta (js/admin.js) : créer N clés d'un lot, copier la liste, libres / utilisées avec pseudo, annuler une
     clé, retirer un testeur ; PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Le jeu est servi sous un nom autre que localhost (sur localhost, la partie Monocompte est toujours visible).
   Lancer : node tests/mono_cles_ui.test.js (SHOTS=dossier pour garder des captures) */
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

/* faux serveur (window.__IDLUS_SB, comme tests/online.test.js) : visiteur non connecté, le test pose ONLINE.user ; rpc simule
   supabase/mono_cles.sql (mêmes réponses) et ce que le panel lit. __IDLUS_NOMONO : flag mono coupé (comme main aujourd'hui). */
function fake(nomono) {
  if (nomono) window.__IDLUS_NOMONO = true;
  const F = (window.__MC = { calls: [], testeur: false, essais: 0, n: 0 });
  const U1 = "00000000-0000-0000-0000-000000000001";
  F.cles = { "MONO-ABCD-EFGH": { lot: "Vague 0", annulee: false, user: null }, "MONO-WXYZ-2345": { lot: "Vague 0", annulee: false, user: "u7", pseudo: "Zoé", at: new Date().toISOString(), testeur: true } };
  const norm = (t) => { const x = String(t || "").toUpperCase().replace(/[\s\-_.]/g, "").replace(/^MONO/, ""); return /^[A-HJ-NP-Z2-9]{8}$/.test(x) ? `MONO-${x.slice(0, 4)}-${x.slice(4)}` : null; };
  const srv = (name, a) => {
    switch (name) {
      case "mono_acces": return F.testeur ? { ok: true, saison: null } : { ok: false };
      case "mono_cle_utiliser": {
        if (F.testeur) return { ok: true, deja: true, msg: "Tu es déjà testeur." };
        if (F.essais >= 5) return { err: "Trop d'essais ratés : réessaie dans une heure." };
        const c = norm(a.p_code), k = c && F.cles[c];
        if (!k) { F.essais++; return { err: "Clé inconnue." }; }
        if (k.annulee) { F.essais++; return { err: "Cette clé a été annulée." }; }
        if (k.user) { F.essais++; return { err: "Cette clé a déjà été utilisée." }; }
        Object.assign(k, { user: U1, pseudo: "Moi", at: new Date().toISOString(), testeur: true }); F.testeur = true;
        return { ok: true, msg: "Bienvenue dans la bêta Monocompte !" };
      }
      case "mono_adm_cles": return Object.entries(F.cles).map(([code, k]) => ({ code, lot: k.lot, annulee: k.annulee, user: k.user, pseudo: k.pseudo || null, at: k.at || null, testeur: !!k.testeur }));
      case "mono_adm_cles_creer": { const L = []; for (let i = 0; i < a.p_n; i++) { const c = "MONO-TEST-" + "ABCDEFGHJK"[F.n % 10] + "2" + "34"[i % 2] + "Z"; F.n++; F.cles[c] = { lot: a.p_lot, annulee: false, user: null }; L.push(c); } return L; }
      case "mono_adm_cle_annuler": { const k = F.cles[a.p_code]; if (!k) return "Clé inconnue."; if (k.user) return "Clé déjà utilisée : retire plutôt le testeur."; k.annulee = true; return null; }
      case "mono_adm_testeur": { const k = Object.values(F.cles).find((x) => x.pseudo === a.p_pseudo); if (!k) return "Pseudo inconnu."; if (!a.p_on) k.testeur = false; return null; }
      case "my_role": return window.__ADMIN ? "admin" : null;
      case "adm_overview": return { reports: 0, flagged: 0 };
      case "cosm_mine": return [];
      default: return null;
    }
  };
  const q = () => { const b = new Proxy(function () {}, { get: (t, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: null, error: null }) : () => b) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async () => ({ data: null, error: { message: "absent" } }) },
    rpc: async (name, a) => { F.calls.push([name, a || {}]); return { data: srv(name, a || {}), error: null }; },
  }) };
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const open = async (w, h, nomono) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(fake, !!nomono);
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: ".wtip{display:none!important}" });
    await page.evaluate(() => { window.__TOASTS = []; new MutationObserver((M) => M.forEach((m) => m.addedNodes.forEach((n) => window.__TOASTS.push(n.textContent || ""))))
      .observe(document.querySelector("#toasts"), { childList: true }); });
    return page;
  };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const opts = (page) => page.evaluate(() => window.DX.social.options("sauvegarde"));
  const beta = (page) => page.evaluate(() => { const i = document.querySelector("#monobeta"); return i ? i.placeholder : null; });
  /* tape un code, valide, puis lit la bulle (les bulles attendent qu'on ne tape plus) */
  const enter = async (page, code) => {
    await page.fill("#monobeta", code);
    await page.evaluate(() => { window.__T0 = window.__TOASTS.length; });
    await page.click('[data-act="sv-monobeta"]');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(900);
    return page.evaluate(() => window.__TOASTS.slice(window.__T0).join(" | "));
  };
  const flag = (page) => page.evaluate(() => localStorage.getItem("idlus-mono-beta"));
  try {
    /* ---------- 1. Monocompte en ligne coupé (flag mono false) : comme avant ---------- */
    const page = await open(1280, 800, true);
    await page.evaluate(() => { window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; });
    if (await page.evaluate(() => !!(window.ONLINE.monoCleOn && window.ONLINE.monoCleOn()))) fail("flag mono coupé : le serveur ne doit pas être appelé");
    await opts(page);
    if ((await beta(page)) !== "Code testeur") fail("hors ligne : champ « Code testeur » attendu, trouvé " + (await beta(page)));
    if (!/Code inconnu/.test(await enter(page, "MONO-ABCD-EFGH"))) fail("hors ligne : une clé du serveur n'ouvre rien (Code inconnu)");
    if (await flag(page)) fail("hors ligne : code inconnu, partie débloquée");
    if (await page.evaluate(() => window.__MC.calls.some((c) => /^mono_cle/.test(c[0])))) fail("flag mono coupé : appel au serveur");
    await enter(page, "fragments21");
    if ((await flag(page)) !== "1") fail("hors ligne : l'ancien code ne débloque plus la partie");
    await opts(page);
    if (await beta(page)) fail("hors ligne : section Bêta encore là après le code");
    await page.evaluate(() => localStorage.removeItem("idlus-mono-beta"));
    console.log("ok - flag mono coupé : champ « Code testeur » et ancien code inchangés, aucun appel au serveur");

    /* ---------- 2. Monocompte en ligne actif : le serveur décide ---------- */
    await page.close();
    const p2 = await open(1280, 800);
    await p2.evaluate(() => { window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; });
    await opts(p2);
    if ((await beta(p2)) !== "MONO-XXXX-XXXX") fail("serveur actif : champ pour une clé MONO-XXXX-XXXX attendu");
    await shot(p2, "cles-options-1280.png");
    let txt = await enter(p2, "FRAGMENTS21");
    if (!/Clé inconnue/.test(txt)) fail("serveur actif : l'ancien code doit être refusé par le serveur");
    if (await flag(p2)) fail("serveur actif : l'ancien code débloque encore la partie");
    // drapeau posé avant (ancien code FRAGMENTS21 entré hors serveur) : n'ouvre plus la partie, seul le serveur décide
    await p2.evaluate(() => localStorage.setItem("idlus-mono-beta", "1")); await opts(p2);
    if ((await beta(p2)) !== "MONO-XXXX-XXXX") fail("serveur actif : l'ancien drapeau de l'appareil ouvre encore la partie Monocompte");
    await p2.evaluate(() => localStorage.removeItem("idlus-mono-beta"));
    const c1 = await p2.evaluate(() => window.__MC.calls.filter((c) => c[0] === "mono_cle_utiliser").map((c) => c[1].p_code));
    if (c1.length !== 1 || c1[0] !== "FRAGMENTS21") fail("serveur actif : la saisie part au serveur telle quelle : " + JSON.stringify(c1));
    if (!/déjà été utilisée/.test(await enter(p2, "MONO-WXYZ-2345"))) fail("serveur actif : clé déjà utilisée, message attendu");
    await p2.evaluate(() => { window.__U = window.ONLINE.user; window.ONLINE.user = null; });
    if (!/Connecte-toi/.test(await enter(p2, "MONO-ABCD-EFGH"))) fail("serveur actif, pas connecté : message attendu");
    await p2.evaluate(() => { window.ONLINE.user = window.__U; });
    if (await p2.evaluate(() => window.__MC.calls.filter((c) => c[0] === "mono_cle_utiliser").length) !== 2) fail("pas connecté : aucun appel au serveur");
    txt = await enter(p2, "  mono abcd efgh ");
    if (!/Bienvenue dans la bêta Monocompte/.test(txt)) fail("serveur actif : bonne clé, message de bienvenue attendu");
    if ((await flag(p2)) !== "1") fail("serveur actif : bonne clé, partie pas débloquée");
    if (!(await p2.evaluate(() => window.__MC.calls.some((c) => c[0] === "mono_acces") && window.ONLINE.mono && window.ONLINE.mono.ok))) fail("serveur actif : accès (mono_acces) pas relu après la clé");
    if (await beta(p2)) fail("serveur actif : section Bêta encore là après la clé");
    console.log("ok - serveur actif : saisie envoyée à mono_cle_utiliser, ancien code et clé utilisée refusés, pas connecté refusé, bonne clé : partie débloquée et accès relu");

    /* ---------- 3. Panel Xener › Clés bêta ---------- */
    const panel = async (pg) => {
      await pg.evaluate(async () => { window.__ADMIN = true; window.ONLINE.profile = { pseudo: "Moi" }; await window.CHAT.refresh(); window.DX.social.closeSheet();
        window.CHAT.adm.A.tab = "clesbeta"; window.DX.ui.tab = "admin"; window.DX.render(); });
      await pg.waitForSelector('[data-act="mcle-creer"]', { timeout: 5000 });
      await pg.waitForSelector(".mc-tab", { timeout: 5000 });
    };
    await panel(p2);
    if (!(await p2.evaluate(() => [...document.querySelectorAll(".px-nav button")].some((b) => /Clés bêta/.test(b.textContent))))) fail("panel : entrée « Clés bêta » absente du menu");
    await p2.fill("#mcN", "3"); await p2.fill("#mcLot", "Vague T");
    await p2.click('[data-act="mcle-creer"]');
    await p2.waitForSelector("#mcList", { timeout: 5000 });
    const made = await p2.evaluate(() => document.querySelector("#mcList").value.split("\n"));
    if (made.length !== 3) fail("panel : 3 clés attendues dans la liste : " + JSON.stringify(made));
    const cr = await p2.evaluate(() => window.__MC.calls.find((c) => c[0] === "mono_adm_cles_creer"));
    if (!cr || cr[1].p_n !== 3 || cr[1].p_lot !== "Vague T") fail("panel : appel de création " + JSON.stringify(cr));
    // presse-papiers : http://idlus.test n'est pas un contexte sûr, le test en pose un (le jeu en ligne est en https)
    await p2.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__CLIP = t; } } }));
    await p2.click('[data-act="mcle-copier"][data-v="neuves"]'); await p2.waitForTimeout(300);
    const clip = await p2.evaluate(() => window.__CLIP || "");
    if (clip !== made.join("\n")) fail("panel : liste copiée attendue, presse-papiers : " + JSON.stringify(clip));
    const rows = await p2.evaluate(() => [...document.querySelectorAll(".mc-tab tbody tr")].map((r) => r.innerText.replace(/\s+/g, " ")));
    if (rows.length !== 5) fail("panel : 5 clés dans le tableau : " + JSON.stringify(rows));
    if (!rows.some((r) => /MONO-ABCD-EFGH/.test(r) && /Moi/.test(r))) fail("panel : clé utilisée avec pseudo attendue : " + JSON.stringify(rows));
    await p2.click('[data-act="mcle-vue"][data-v="libre"]');
    if ((await p2.$$(".mc-tab tbody tr")).length !== 3) fail("panel : filtre « Libres » : 3 clés attendues");
    await p2.click(`[data-act="mcle-annuler"][data-v="${made[0]}"]`); await p2.waitForTimeout(300);
    if (!(await p2.evaluate((c) => window.__MC.cles[c].annulee, made[0]))) fail("panel : annuler une clé");
    if ((await p2.$$(".mc-tab tbody tr")).length !== 2) fail("panel : clé annulée retirée des libres");
    await p2.click('[data-act="mcle-vue"][data-v="utilisee"]');
    await p2.click('[data-act="mcle-retirer"][data-v="MONO-WXYZ-2345"]');
    if (await p2.evaluate(() => window.__MC.calls.some((c) => c[0] === "mono_adm_testeur"))) fail("panel : retirer un testeur demande une confirmation");
    if (!(await p2.$('[data-act="mcle-retirer"][data-v="MONO-WXYZ-2345"].danger'))) fail("panel : bouton « Confirmer le retrait » attendu");
    await p2.click('[data-act="mcle-retirer"][data-v="MONO-WXYZ-2345"]'); await p2.waitForTimeout(300);
    const rt = await p2.evaluate(() => window.__MC.calls.find((c) => c[0] === "mono_adm_testeur"));
    if (!rt || rt[1].p_pseudo !== "Zoé" || rt[1].p_on !== false) fail("panel : retrait du testeur " + JSON.stringify(rt));
    if (!(await p2.evaluate(() => /retiré/.test(document.querySelector(".mc-tab").textContent)))) fail("panel : testeur retiré marqué");
    await shot(p2, "cles-panel-1280.png");
    await noScroll(p2, "panel 1280 px");
    console.log("ok - panel Clés bêta : créer 3 clés d'un lot, copier la liste, libres / utilisées (pseudo), annuler, retirer un testeur (avec confirmation)");

    /* ---------- 4. téléphone 390 px ---------- */
    const tel = await open(390, 844);
    await tel.evaluate(() => { window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; });
    await opts(tel);
    if ((await beta(tel)) !== "MONO-XXXX-XXXX") fail("390 px : champ de clé attendu");
    await noScroll(tel, "options 390 px"); await shot(tel, "cles-options-390.png");
    await panel(tel);
    await noScroll(tel, "panel 390 px"); await shot(tel, "cles-panel-390.png");
    console.log("ok - téléphone 390 px : champ de clé et panel sans défilement de côté");
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - PC 1280 px et téléphone 390 px sans erreur console");
})();
