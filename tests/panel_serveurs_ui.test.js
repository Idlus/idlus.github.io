/* Panel Xener dissocié par serveur (2.1.36, js/panel.js, js/admin.js, js/chat.js), dans le navigateur (aucune requête ne sort) :
   - sélecteur « Classique | Monocompte » sous le titre, Classique par défaut, choix gardé dans le navigateur (page rechargée) ;
   - Classique : les pages d'avant, aucune page Monocompte (Clés bêta, Bouclier Monocompte…), pas de case « Monocompte » dans le
     message épinglé ni dans « Vider » ; recherche (Ctrl K) limitée aux pages du serveur choisi ;
   - Monocompte : Vue d'ensemble (saison, horloge, testeurs, parties, refus), Testeurs, Clés bêta, Bouclier Monocompte, Remettre une
     partie (confirmation dans la page, jamais de boîte confirm()), Bureau des Aventuriers (réglage, créneau), Chat Monocompte
     (épinglé du salon 'm', vider 'm'), Annonces Monocompte ; pas d'onglet Test ni de départ rapide ;
   - fiche d'un joueur ouverte depuis le côté Monocompte : le panel repasse au Classique ;
   - bandeaux : une annonce Monocompte ne s'affiche que dans une partie Monocompte, une annonce Classique seulement dans le Classique ;
     message épinglé du Classique dans 'g', celui du Monocompte dans 'm' ;
   - PC 1280 px et téléphone 390 px, sans erreur console ni défilement de côté.
   Lancer : node tests/panel_serveurs_ui.test.js (SHOTS=dossier pour garder des captures) */
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

/* faux serveur (window.__IDLUS_SB) : compte admin posé par le test ; rpc simule supabase/chat.sql, monocompte.sql, mono_bureau.sql
   et mono_cles.sql (mêmes réponses) ; état gardé dans le stockage local pour le jeu rouvert dans un nouvel onglet */
function fake() {
  const KEY = "__px";
  const F0 = { calls: [], anns: [{ id: 5, body: "Annonce du Classique", banner: true, until: null, srv: null }], pin: { pin_body: "Épinglé du Classique", pin_chs: "g", pin_at: "2026-10-20T00:00:00Z", pin_m_body: "Épinglé du Monocompte", pin_m_at: "2026-10-20T00:00:00Z" },
    testeurs: [{ id: "u2", pseudo: "Zoé", at: "2026-10-01T10:00:00Z" }, { id: "u3", pseudo: "Bob", at: "2026-10-02T10:00:00Z" }],
    reg: { invit_s: 60, place_s: 120, rdv: false, rdv_min: 60, suspects_n: 6 }, cre: [{ id: 1, heure: "20:30", nom: "Soirée", actif: false }], n: 10 };
  let F; try { F = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { F = null; }
  F = window.__PX = F || F0;
  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(F)); } catch (e) {} };
  const srv = (name, a) => {
    switch (name) {
      case "my_role": return "admin";
      case "mono_acces": return { ok: true, saison: 0 };
      case "chat_me": return {};
      case "cosm_mine": case "staff_list": case "adm_loops": case "adm_reports": case "adm_flagged": case "adm_mods": return [];
      case "ann_tick": return null;
      case "adm_overview": return { accounts: 42, active: 7, reports: 0, flagged: 0, suspect: 0, muted: 0, signups: [], log: [], settings: { min_level: 0, slow_s: 4, closed: false } };
      case "adm_players": return [{ id: "u2", pseudo: "Zoé", cls: "cra" }, { id: "u9", pseudo: "Kralamour", cls: "iop" }].filter((x) => !a.p_q || x.pseudo.toLowerCase().includes(String(a.p_q).toLowerCase()));
      case "adm_pin": F.pin.pin_body = a.p_body; F.pin.pin_chs = a.p_chs; return null;
      case "adm_pin_mono": F.pin.pin_m_body = a.p_body; F.pin.pin_m_at = new Date().toISOString(); return null;
      case "adm_chat_clear": return 3;
      case "adm_announce": F.anns.unshift({ id: ++F.n, body: a.p_body, banner: true, until: null, srv: null }); return null;
      case "adm_announce_mono": F.anns.unshift({ id: ++F.n, body: a.p_body, banner: true, until: null, srv: "m" }); return null;
      case "adm_announce_end": F.anns = F.anns.filter((x) => x.id !== a.p_id); return null;
      case "mono_adm_vue": return { saison: { id: 0, nom: "Saison de test", etat: "ouverte", test: true, jour: 10, duree: 56, date: "2026-10-30T12:00:00Z", vitesse: 24, pause: true, horloge: true },
        testeurs: F.testeurs.length, parties: 5, validees: 4, actives: 2, refus: 1, derniers: [{ user: "u3", pseudo: "Bob", why: "niveau impossible", at: "2026-10-21T08:00:00Z" }] };
      case "mono_adm_journal": return [{ user: "u3", pseudo: "Bob", etat: "refus", why: "niveau impossible", n: 3, at: "2026-10-21T08:00:00Z" },
        { user: "u2", pseudo: "Zoé", etat: "note", why: "[observation] 9 000 000 kamas au jour 1 (au plus 5 000 000)", n: 1, at: "2026-10-21T07:00:00Z" },
        { user: "u2", pseudo: "Zoé", etat: "ok", niveau: 42, kamas: 1234567, n: 5, at: "2026-10-21T06:00:00Z" }].filter((x) => (!a.p_etat || x.etat === a.p_etat) && (!a.p_user || x.user === a.p_user));
      case "mono_adm_testeurs": return F.testeurs;
      case "mono_adm_testeur": { if (a.p_on) { if (a.p_pseudo === "Inconnu") return "Pseudo inconnu."; F.testeurs.push({ id: "u" + ++F.n, pseudo: a.p_pseudo, at: new Date().toISOString() }); } else F.testeurs = F.testeurs.filter((x) => x.pseudo !== a.p_pseudo); return null; }
      case "mono_adm_bouclier": return [{ user: "u3", pseudo: "Bob", saison: 0, why: "niveau impossible", at: "2026-10-21T08:00:00Z" }];
      case "mono_adm_cles": return [{ code: "MONO-ABCD-EFGH", lot: "Vague 0", annulee: false, user: null }];
      case "mono_adm_copies": return a.p_user === "u2" ? [{ jour: "2026-10-21", saison: 0, at: "2026-10-21T06:00:00Z", lvl: 12, ouverte: true }, { jour: "2026-10-20", saison: 0, at: "2026-10-20T06:00:00Z", lvl: 11, ouverte: true }] : [];
      case "mono_adm_restaurer": return null;
      case "mono_adm_bureau": return { reglages: F.reg, creneaux: F.cre, salons: [], expeditions: [{ id: 1 }], suspects: [], appareils: [] };
      case "mono_adm_bureau_reglage": F.reg[a.p_cle] = a.p_v; return F.reg;
      case "mono_adm_bureau_creneau": { const c = F.cre.find((x) => x.id === a.p_id); if (a.p_heure == null && a.p_nom == null && a.p_actif == null) F.cre = F.cre.filter((x) => x.id !== a.p_id); else if (c) Object.assign(c, { heure: a.p_heure, nom: a.p_nom, actif: a.p_actif }); else F.cre.push({ id: a.p_id, heure: a.p_heure, nom: a.p_nom, actif: a.p_actif }); return F.cre; }
      default: return null;
    }
  };
  const rows = (t) => (t === "announces" ? F.anns : []);
  const one = (t) => (t === "chat_settings" ? F.pin : null);
  const q = (t) => { const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: rows(t), error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: one(t), error: null }) : () => b) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async () => ({ data: null, error: { message: "absent" } }) },
    rpc: async (name, a) => { F.calls.push([name, a || {}]); const d = srv(name, a || {}); put(); return { data: d, error: null }; },
  }) };
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const boot = async (page, w) => {
    await page.goto(base, { waitUntil: "load" });
    // nouvelle partie (premier lancement) ou jeu rouvert (menu des parties : partie 1)
    const b = await page.waitForSelector('[data-act="startgame"], .svc2[data-slot="1"] [data-act="sv-play"]', { timeout: 10000 });
    await b.click();
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
    await page.waitForTimeout(400);
    await page.addStyleTag({ content: ".wtip{display:none!important}" });
    // connexion simulée : compte admin, accès au Monocompte relu, chat rechargé
    await page.evaluate(async () => { window.ONLINE.user = { id: "00000000-0000-0000-0000-000000000001" }; window.ONLINE.profile = { pseudo: "Xener" };
      await window.ONLINE.monoCheck(); await window.CHAT.refresh(); window.DX.social.closeSheet(); });
    page.__w = w;
  };
  const hook = async (page, w) => {
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(fake);
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
    page.on("dialog", (d) => { errors.push(`${w} px : boîte de dialogue du navigateur « ${d.message()} » (confirmation attendue dans la page)`); d.dismiss().catch(() => {}); });
    await boot(page, w);
    return page;
  };
  const open = async (w, h) => hook(await (await browser.newContext({ viewport: { width: w, height: h } })).newPage(), w);
  const panel = async (page) => { await page.evaluate(() => { window.DX.ui.tab = "admin"; window.DX.render(); }); await page.waitForSelector(".px-srv", { timeout: 5000 }); await page.waitForTimeout(300); };
  const nav = (page) => page.evaluate(() => [...document.querySelectorAll(".px-nav button")].map((b) => b.dataset.v));
  const srvOn = (page) => page.evaluate(() => { const b = document.querySelector(".px-srv button.on"); return b ? b.dataset.v : null; });
  const go = async (page, v) => { await page.click(`.px-nav button[data-v="${v}"]`); await page.waitForTimeout(350); };
  const calls = (page, n) => page.evaluate((x) => window.__PX.calls.filter((c) => c[0] === x).map((c) => c[1]), n);
  const search = async (page, t) => { await page.fill("#pxQ", t); await page.waitForTimeout(100); const r = await page.evaluate(() => [...document.querySelectorAll("#pxRes button")].map((b) => (b.querySelector(".grow") || b).textContent)); await page.fill("#pxQ", ""); return r; };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n), fullPage: true }); };
  const body = (page) => page.evaluate(() => document.querySelector(".px-body").innerText);
  const annbar = (page) => page.evaluate(() => (document.querySelector("#annbar") || {}).textContent || "");
  const MONO = ["monovue", "monotesteurs", "clesbeta", "monobouclier", "monojournal", "monoremise", "monobureau", "mchat", "mann"];
  const CLASSIC = ["vue", "joueurs", "ann", "equipe", "test"];

  const run = async (w, h, full) => {
    let page = await open(w, h);
    const W = `${w} px`;
    await panel(page);
    /* ---------- Classique par défaut ---------- */
    if ((await srvOn(page)) !== "c") fail(`${W} : Classique attendu par défaut`);
    let N = await nav(page);
    if (MONO.some((k) => N.includes(k))) fail(`${W}, Classique : page Monocompte dans le menu : ${N.join(",")}`);
    if (CLASSIC.some((k) => !N.includes(k))) fail(`${W}, Classique : pages d'avant absentes : ${N.join(",")}`);
    if (full) {
      let r = await search(page, "clés bêta"); if (r.some((x) => /Clés bêta/.test(x))) fail("Classique : la recherche propose une page Monocompte : " + r.join(" | "));
      r = await search(page, "bouclier"); if (r.some((x) => /Bouclier Monocompte/.test(x))) fail("Classique : la recherche propose le Bouclier Monocompte");
      r = await search(page, "annonces"); if (!r.some((x) => /Aller à : Annonces$/.test(x)) || r.some((x) => /Monocompte/.test(x))) fail("Classique : recherche « annonces » : " + r.join(" | "));
      r = await search(page, "nouveau joueur"); if (!r.some((x) => /Partie de test/.test(x))) fail("Classique : départs rapides de test absents de la recherche");
      if (await page.$('[data-act="adm-chclear"][data-v="m"]')) fail("Classique : « Vider Monocompte » encore là");
      if (!(await page.$('[data-act="adm-chclear"][data-v="g"]'))) fail("Classique : « Vider Général » absent");
      await go(page, "ann");
      await page.waitForSelector("#admPin", { timeout: 5000 });
      if (await page.$("#admPinm")) fail("Classique : case « Monocompte » dans le message épinglé");
      if (!(await page.$("#admPing")) || !(await page.$("#admPinc")) || !(await page.$("#admPinv"))) fail("Classique : cases Général, Commerce, PvP attendues");
      if (/Monocompte/.test(await body(page))) fail("Classique : la page Annonces parle du Monocompte : " + (await body(page)).slice(0, 200));
      await page.fill("#admPin", "Nouvel épinglé du Classique"); await page.check("#admPinc"); await page.click('[data-act="adm-pin"]'); await page.waitForTimeout(400);
      const pn = await calls(page, "adm_pin"); if (!pn.length || pn[pn.length - 1].p_chs !== "g,c") fail("Classique : épinglé envoyé sans 'm' : " + JSON.stringify(pn));
      await shot(page, `panel-classique-${w}.png`);
    }
    await noScroll(page, `${W}, Classique`);
    /* ---------- Monocompte ---------- */
    await page.click('.px-srv button[data-v="m"]'); await page.waitForTimeout(500);
    if ((await srvOn(page)) !== "m") fail(`${W} : Monocompte pas choisi`);
    if ((await page.evaluate(() => localStorage.getItem("idlus-panel-srv"))) !== "m") fail(`${W} : choix pas gardé dans le navigateur`);
    N = await nav(page);
    if (MONO.some((k) => !N.includes(k))) fail(`${W}, Monocompte : pages attendues : ${N.join(",")}`);
    if (CLASSIC.some((k) => N.includes(k)) || N.includes("hdv") || N.includes("codes")) fail(`${W}, Monocompte : page Classique dans le menu : ${N.join(",")}`);
    if (await page.$('[data-act="adm-test"]')) fail(`${W}, Monocompte : bouton Partie de test`);
    await page.waitForFunction(() => /Saison de test/.test(document.querySelector(".px-body").innerText), null, { timeout: 5000 }).catch(() => fail(`${W}, Monocompte : vue d'ensemble sans la saison`));
    let t = await body(page);
    if (!/×24, en pause/.test(t) || !/Jour 10 sur 56/.test(t) || !/niveau impossible/.test(t) || !/testeurs/.test(t)) fail(`${W}, vue Monocompte : ` + t.slice(0, 400));
    if ((await calls(page, "mono_adm_horloge")).length) fail("vue Monocompte : l'horloge ne doit pas être changée (mono_adm_horloge écrit)");
    await shot(page, `panel-mono-${w}.png`);
    await noScroll(page, `${W}, Monocompte`);
    if (full) {
      let r = await search(page, "clés"); if (!r.some((x) => /Aller à : Clés bêta/.test(x))) fail("Monocompte : recherche « clés » : " + r.join(" | "));
      r = await search(page, "nouveau joueur"); if (r.length && r.some((x) => /Partie de test/.test(x))) fail("Monocompte : départs rapides de test dans la recherche");
      r = await search(page, "Zoé"); if (r.some((x) => /Chercher le joueur/.test(x))) fail("Monocompte : recherche d'un joueur du Classique proposée");
      r = await search(page, "annonces"); if (!r.some((x) => /Annonces Monocompte/.test(x)) || r.some((x) => /Aller à : Annonces$/.test(x))) fail("Monocompte : recherche « annonces » : " + r.join(" | "));
      /* choix gardé : le jeu rouvert dans un nouvel onglet du même navigateur (même stockage local) */
      { const ctx = page.context(); await page.close(); page = await hook(await ctx.newPage(), w); }
      await panel(page);
      if ((await srvOn(page)) !== "m") fail("choix Monocompte perdu après rechargement");
      if (!(await nav(page)).includes("monovue") || !(await page.$('.px-nav button.on[data-v="monovue"]'))) fail("après rechargement : Vue d'ensemble Monocompte attendue");
      /* Testeurs */
      await go(page, "monojournal"); await page.waitForFunction(() => /Acceptée/.test(document.querySelector(".px-body").innerText), null, { timeout: 5000 }).catch(() => {});
      t = await body(page);
      if (!/Refusée/.test(t) || !/×3/.test(t) || !/niveau 42 · 1\s?234\s?567 kamas/.test(t) || !/Note/.test(t) || /\[observation\]/.test(t)) fail(`${W}, journal du Bouclier : ` + t.slice(0, 500));
      await page.click('[data-act="mjr-etat"][data-v="refus"]'); await page.waitForTimeout(300); t = await body(page);
      if (/niveau 42/.test(t) || !/niveau impossible/.test(t)) fail(`${W}, journal : filtre Refusées : ` + t.slice(0, 300));
      await page.click('[data-act="mjr-etat"][data-v=""]'); await page.click('[data-act="mjr-user"][data-v="u2"]'); await page.waitForTimeout(300); t = await body(page);
      if (/Bob/.test(t) || !/Zoé ✕/.test(t)) fail(`${W}, journal : filtre par compte : ` + t.slice(0, 300));
      await noScroll(page, `${W}, journal du Bouclier`); await shot(page, `panel-journal-${w}.png`);
      await go(page, "monotesteurs"); await page.waitForSelector("#mtAdd", { timeout: 5000 });
      await page.fill("#mtAdd", "Inconnu"); await page.click('[data-act="mtst-add"]'); await page.waitForTimeout(300);
      await page.fill("#mtAdd", "Lou"); await page.click('[data-act="mtst-add"]'); await page.waitForTimeout(400);
      if (!/Lou/.test(await body(page))) fail("Testeurs : ajout pas affiché");
      await page.click('[data-act="mtst-del"][data-u="u3"]');
      if ((await calls(page, "mono_adm_testeur")).some((c) => c.p_on === false)) fail("Testeurs : retrait sans confirmation");
      await page.click('[data-act="mtst-del"][data-u="u3"][data-v="1"]'); await page.waitForTimeout(400);
      const tr = (await calls(page, "mono_adm_testeur")).find((c) => c.p_on === false);
      if (!tr || tr.p_pseudo !== "Bob" || /Bob/.test(await body(page))) fail("Testeurs : retrait de Bob " + JSON.stringify(tr));
      /* Remettre une partie */
      await go(page, "monoremise"); await page.waitForSelector('[data-act="mrem-pick"][data-u="u2"]', { timeout: 5000 });
      await page.click('[data-act="mrem-pick"][data-u="u2"]'); await page.waitForSelector('[data-act="mrem-day"][data-v="2026-10-20"]', { timeout: 5000 });
      await page.click('[data-act="mrem-day"][data-v="2026-10-20"]'); await page.waitForTimeout(200);
      if ((await calls(page, "mono_adm_restaurer")).length) fail("Remise : partie remise sans confirmation");
      if (!/Remettre la partie Monocompte de Zoé à sa copie du 20\/10\/2026/.test(await body(page))) fail("Remise : confirmation dans la page attendue");
      await page.click('[data-act="mrem-no"]'); await page.waitForTimeout(150);
      if (await page.$('[data-act="mrem-go"]')) fail("Remise : « Annuler » garde la confirmation");
      await page.click('[data-act="mrem-day"][data-v="2026-10-21"]'); await page.click('[data-act="mrem-go"]'); await page.waitForTimeout(400);
      const rs = await calls(page, "mono_adm_restaurer");
      if (rs.length !== 1 || rs[0].p_user !== "u2" || rs[0].p_jour !== "2026-10-21") fail("Remise : appel " + JSON.stringify(rs));
      await page.fill("#mrQ", "Kralamour"); await page.click('[data-act="mrem-find"]'); await page.waitForTimeout(400);
      if (!/Copies de Kralamour/.test(await body(page)) || !/Pas de copie/.test(await body(page))) fail("Remise : joueur cherché par son pseudo (adm_players)");
      await shot(page, `panel-mono-remise-${w}.png`);
      /* Bureau des Aventuriers */
      await go(page, "monobureau"); await page.waitForSelector("#mbR-rdv", { timeout: 5000 });
      await page.check("#mbR-rdv"); await page.click('[data-act="mbur-reg"][data-v="rdv"]'); await page.waitForTimeout(300);
      await page.fill("#mbR-invit_s", "90"); await page.click('[data-act="mbur-reg"][data-v="invit_s"]'); await page.waitForTimeout(300);
      const rg = await calls(page, "mono_adm_bureau_reglage");
      if (!rg.some((c) => c.p_cle === "rdv" && c.p_v === true) || !rg.some((c) => c.p_cle === "invit_s" && c.p_v === 90)) fail("Bureau : réglages " + JSON.stringify(rg));
      await page.fill("#mbN-1", "Soirée des aventuriers"); await page.check("#mbA-1"); await page.click('[data-act="mbur-cre"][data-v="1"]'); await page.waitForTimeout(300);
      await page.click('[data-act="mbur-new"]'); await page.waitForTimeout(300);
      const cr = await calls(page, "mono_adm_bureau_creneau");
      if (!cr.some((c) => c.p_id === 1 && c.p_nom === "Soirée des aventuriers" && c.p_actif === true && c.p_heure === "20:30") || !cr.some((c) => c.p_id === 2 && c.p_actif === false)) fail("Bureau : créneaux " + JSON.stringify(cr));
      await page.click('[data-act="mbur-del"][data-v="2"]'); await page.click('[data-act="mbur-del"][data-v="2"][data-ok="1"]'); await page.waitForTimeout(300);
      if (await page.$("#mbH-2")) fail("Bureau : créneau supprimé encore affiché");
      await shot(page, `panel-mono-bureau-${w}.png`);
      /* Chat Monocompte */
      await go(page, "mchat"); await page.waitForSelector("#admMPin", { timeout: 5000 });
      if ((await page.inputValue("#admMPin")) !== "Épinglé du Monocompte") fail("Chat Monocompte : épinglé actuel attendu");
      await page.fill("#admMPin", "Bienvenue aux testeurs !"); await page.click('[data-act="adm-mpin"]'); await page.waitForTimeout(400);
      const mp = await calls(page, "adm_pin_mono"); if (!mp.length || mp[0].p_body !== "Bienvenue aux testeurs !") fail("Chat Monocompte : épinglé " + JSON.stringify(mp));
      if ((await calls(page, "adm_pin")).length > 1) fail("Chat Monocompte : l'épinglé du Classique a été changé");
      await page.click('[data-act="adm-mclear"]'); await page.waitForTimeout(150);
      if ((await calls(page, "adm_chat_clear")).length) fail("Chat Monocompte : salon vidé sans confirmation");
      await page.click('[data-act="adm-mclear"][data-v="1"]'); await page.waitForTimeout(400);
      const cl = await calls(page, "adm_chat_clear"); if (cl.length !== 1 || cl[0].p_ch !== "m") fail("Chat Monocompte : vider " + JSON.stringify(cl));
      /* Annonces Monocompte */
      await go(page, "mann"); await page.waitForSelector("#admMAnn", { timeout: 5000 });
      if (/Annonce du Classique/.test(await body(page))) fail("Annonces Monocompte : bandeau du Classique listé");
      await page.fill("#admMAnn", "Nouvelle saison de test lundi"); await page.click('[data-act="adm-mannounce"]'); await page.waitForTimeout(500);
      const am = await calls(page, "adm_announce_mono"); if (!am.length || am[0].p_body !== "Nouvelle saison de test lundi" || !am[0].p_banner || !am[0].p_chat) fail("Annonces Monocompte : " + JSON.stringify(am));
      if ((await calls(page, "adm_announce")).length) fail("Annonces Monocompte : annonce Classique envoyée");
      if (!/Nouvelle saison de test lundi/.test(await body(page))) fail("Annonces Monocompte : bandeau pas listé");
      await shot(page, `panel-mono-annonces-${w}.png`);
      /* bandeaux : partie Classique → seulement le Classique */
      await page.waitForTimeout(300);
      let ab = await annbar(page);
      if (!/Annonce du Classique/.test(ab) || /Nouvelle saison/.test(ab)) fail("partie Classique : bandeau attendu « Annonce du Classique » seul : " + ab);
      /* épinglés : 'g' Classique, 'm' Monocompte */
      const pins = await page.evaluate(() => { const C = window.CHAT.state, out = {}, o0 = C.open; C.open = true; for (const k of ["g", "m"]) { C.tab = k; window.CHAT.repaint(); const p = document.querySelector("#chat .ch-pin"); out[k] = p ? p.textContent : ""; } C.tab = "g"; C.open = o0; window.CHAT.repaint(); return out; });
      if (!/Nouvel épinglé du Classique/.test(pins.g) || /Bienvenue aux testeurs/.test(pins.g)) fail("épinglé de 'g' : " + pins.g);
      if (!/Bienvenue aux testeurs/.test(pins.m) || /Classique/.test(pins.m)) fail("épinglé de 'm' : " + pins.m);
      /* fiche d'un joueur depuis le côté Monocompte : retour au Classique */
      await page.evaluate(() => window.CHAT.openAdmin("joueurs", "Zoé")); await page.waitForTimeout(500);
      if ((await srvOn(page)) !== "c" || !(await page.$('.px-nav button.on[data-v="joueurs"]'))) fail("fiche d'un joueur : le panel doit repasser au Classique");
      /* partie Monocompte → seulement l'annonce Monocompte */
      await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); window.DX.ui.tab = "home"; window.DX.render(); });
      await page.waitForFunction(() => /Nouvelle saison de test lundi/.test((document.querySelector("#annbar") || {}).textContent || ""), null, { timeout: 6000 }).catch(() => {});
      ab = await annbar(page);
      if (!/Nouvelle saison de test lundi/.test(ab) || /Annonce du Classique/.test(ab)) fail("partie Monocompte : bandeau attendu « Nouvelle saison… » seul : " + ab);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
      await page.click('#annbar [data-act="ch-annok"]'); await page.waitForTimeout(400);
      if (await annbar(page)) fail("partie Monocompte : bandeau fermé encore là (et pas de bandeau Classique à la place)");
      await shot(page, `panel-mono-bandeau-${w}.png`);
      await noScroll(page, `${W}, partie Monocompte`);
    }
    await page.context().close();
  };
  try {
    await run(1280, 900, true);
    console.log("ok - 1280 px : sélecteur Classique | Monocompte (Classique par défaut, choix gardé), pages et recherche par serveur, épinglé Classique sans 'm', pages Monocompte (vue, testeurs, remise confirmée dans la page, Bureau, chat, annonces), bandeau Monocompte seulement en partie Monocompte");
    await run(390, 844, true);
    console.log("ok - téléphone 390 px : mêmes parcours, sans défilement de côté");
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - aucune erreur console ni boîte de dialogue");
})();
