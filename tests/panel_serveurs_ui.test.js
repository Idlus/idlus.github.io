/* Panel Xener dissocié par serveur (2.1.36, js/panel.js, js/admin.js, js/chat.js), dans le navigateur (aucune requête ne sort) :
   - sélecteur « Éternel | Saison 1 | Monocompte » sous le titre (03/11), Éternel par défaut, choix gardé dans le navigateur (page rechargée) ;
   - Classique : les pages d'avant, aucune page Monocompte (Clés bêta, Bouclier Monocompte…), pas de case « Monocompte » dans le
     message épinglé ni dans « Vider » ; recherche (Ctrl K) limitée aux pages du serveur choisi ;
   - Monocompte : Vue d'ensemble (saison, horloge, testeurs, parties, refus), Testeurs, Clés bêta, Bouclier Monocompte, Remettre une
     partie (confirmation dans la page, jamais de boîte confirm()), Bureau des Aventuriers (réglage, créneau), Chat Monocompte
     (épinglé du salon 'm', vider 'm'), Annonces Monocompte ; pas d'onglet Test ni de départ rapide ;
   - Saison 1 : mêmes pages que l'Éternel, Hôtel de vente et « En vérification » lus dans l'espace s1 (admin_flagged), « Vider Saison 1 » ;
     Éternel : les mêmes fonctions dans public, même quand la partie jouée est la Saison 1 ;
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
      case "admin_flagged": return [{ user_id: "u7", pseudo: "Saisonnier", reason: "Bouclier : kamas impossibles", level: 30, updated_at: "2026-11-03T22:30:00Z" }];
      case "adm_hdv": return { open: 0, sellers: 0, last: [] };
      case "ann_tick": return null;
      case "adm_overview": return { accounts: 42, active: 7, reports: 0, flagged: 0, suspect: 0, muted: 0, signups: [], log: [], settings: { min_level: 0, slow_s: 4, closed: false } };
      case "adm_players": return [{ id: "u2", pseudo: "Zoé", cls: "cra" }, { id: "u9", pseudo: "Kralamour", cls: "iop" }].filter((x) => !a.p_q || x.pseudo.toLowerCase().includes(String(a.p_q).toLowerCase()));
      case "adm_pin": F.pin.pin_body = a.p_body; F.pin.pin_chs = a.p_chs; return null;
      case "adm_pin_mono": F.pin.pin_m_body = a.p_body; F.pin.pin_m_at = new Date().toISOString(); return null;
      case "adm_chat_clear": return 3;
      case "adm_announce": F.anns.unshift({ id: ++F.n, body: a.p_body, banner: true, until: null, srv: null }); return null;
      case "adm_announce_mono": F.anns.unshift({ id: ++F.n, body: a.p_body, banner: true, until: null, srv: "m" }); return null;
      case "adm_announce_srv": F.anns.unshift({ id: ++F.n, body: a.p_body, banner: true, until: null, srv: a.p_srv }); return null;
      case "adm_bugs": return [{ id: 1, status: "nouveau", body: "Bouton cassé" }, { id: 2, status: "corrige", body: "Vieux bug" }];
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
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({ u2: [{ p: "Zoé", s: "s" }], u3: [{ p: "Bob", s: "e" }], u4: [{ p: "Lou", s: "m" }], u5: [{ p: "Vieux" }], "anon-1": [{}] }) }; return c; };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async () => ({ data: null, error: { message: "absent" } }) },
    rpc: async (name, a) => { F.calls.push([name, a || {}, "public"]); const d = srv(name, a || {}); put(); return { data: d, error: null }; },
    schema: (sc) => ({ from: q, rpc: async (name, a) => { F.calls.push([name, a || {}, sc]); const d = srv(name, a || {}); put(); return { data: d, error: null }; } }),
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
    const b = await page.waitForSelector('[data-act="startgame"], [data-slot="1"] [data-act="sv-play"]', { timeout: 10000 });
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
  const where = (page, n) => page.evaluate((x) => window.__PX.calls.filter((c) => c[0] === x).map((c) => c[2]), n);
  const search = async (page, t) => { await page.fill("#pxQ", t); await page.waitForTimeout(100); const r = await page.evaluate(() => [...document.querySelectorAll("#pxRes button")].map((b) => (b.querySelector(".grow") || b).textContent)); await page.fill("#pxQ", ""); return r; };
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n), fullPage: true }); };
  const body = (page) => page.evaluate(() => document.querySelector(".px-body").innerText);
  const annbar = (page) => page.evaluate(() => (document.querySelector("#annbar") || {}).textContent || "");

  const MONO = ["monovue", "monoenligne", "monobouclier", "monojournal", "monoremise", "monotesteurs", "clesbeta", "monobureau", "mbuilds", "mchat"]; // 2.2.4.2 : Builds du Monocompte;
  const CLASSIC = ["srvvue", "enligne", "verif", "fiches", "hdv", "guildes", "builds", "salon"];
  const TOUS = ["joueurs", "sig", "vue", "ann", "codes", "chat", "bugs", "idees", "equipe", "test"];
  const badges = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".px-sp button")].map((b) => [b.dataset.v, (b.querySelector("em") || {}).textContent || ""])));
  const same = (a, b) => a.join(",") === b.join(",");

  const run = async (w, h, full) => {
    let page = await open(w, h);
    const W = `${w} px`;
    await panel(page);
    /* ---------- accueil (2A) : aucune case choisie, pas de menu, ce qui t'attend, une colonne par serveur ---------- */
    if (await srvOn(page)) fail(`${W} : l'accueil doit s'ouvrir sans case choisie`);
    if (await page.$(".px-nav")) fail(`${W} : l'accueil n'a pas de menu`);
    await page.waitForFunction(() => /Saisonnier/.test(document.querySelector(".px-body").innerText), null, { timeout: 6000 }).catch(() => fail(`${W} : accueil sans le joueur à vérifier de la Saison 1`));
    let t = await body(page);
    if (!/Ce qui t'attend/.test(t) || !/1 bug nouveau/.test(t) || !/1 refus du Bouclier/.test(t) || !/Jour 10/.test(t) || !/Ouvrir Éternel/.test(t) || !/Ouvrir Monocompte/.test(t)) fail(`${W}, accueil : ` + t.slice(0, 600));
    if ((await where(page, "admin_flagged")).some((x) => x !== "s1") || (await where(page, "adm_flagged")).some((x) => x !== "public")) fail(`${W}, accueil : à vérifier lu dans le mauvais espace`);
    if (await page.evaluate(() => window.ONLINE.admSp) !== "e") fail(`${W}, accueil : l'espace des fonctions d'admin a changé après la lecture de la Saison 1`);
    await page.evaluate(() => window.PANEL.repaint());
    const bd = await badges(page); if (bd.s !== "1" || bd.m !== "1" || bd.t !== "1" || bd.e) fail(`${W} : pastilles des cases ` + JSON.stringify(bd));
    await shot(page, `panel-accueil-${w}.png`); await noScroll(page, `${W}, accueil`);
    /* « Voir » : Saison 1 › À vérifier, dans s1, boutons qui disent le serveur (idée 1) */
    await page.click('[data-act="adm-pxgo"][data-s="s"][data-v="verif"]');
    await page.waitForFunction(() => /Saisonnier/.test(document.querySelector(".px-body").innerText), null, { timeout: 5000 }).catch(() => fail(`${W} : « Voir » ne mène pas à la liste de la Saison 1`));
    if ((await srvOn(page)) !== "s" || !(await page.$('.px-nav button.on[data-v="verif"]'))) fail(`${W} : « Voir » doit ouvrir Saison 1 › À vérifier`);
    if (!/Tu agis sur la Saison 1/.test(await page.evaluate(() => document.querySelector(".px-where").innerText))) fail(`${W} : bandeau « Tu agis sur la Saison 1 » absent`);
    if (!/Retirer de la Saison 1/.test(await body(page))) fail(`${W} : le bouton Retirer doit dire « de la Saison 1 »`);
    await page.click('[data-act="adm-flag"][data-u="u7"][data-v="0"]'); await page.waitForTimeout(300);
    { const uf = await where(page, "admin_unflag"); if (uf[uf.length - 1] !== "s1" || (await calls(page, "adm_flag")).length) fail(`${W}, Saison 1 : « C'est bon » doit viser s1.admin_unflag`); }
    let N = await nav(page);
    if (!same(N, CLASSIC)) fail(`${W}, Saison 1 : menu ${N.join(",")}`);
    await shot(page, `panel-saison1-${w}.png`); await noScroll(page, `${W}, Saison 1`);
    /* Saison 1 › Salon : épinglé lu, vider avec confirmation dans la page */
    await go(page, "salon"); t = await body(page);
    if (!/Salon Saison 1/.test(t) || !/Vider le salon Saison 1/.test(t)) fail(`${W}, Salon Saison 1 : ` + t.slice(0, 300));
    await page.click('[data-act="adm-clr"][data-v="s"]'); await page.waitForTimeout(150);
    if ((await calls(page, "adm_chat_clear")).length) fail(`${W} : salon vidé sans confirmation`);
    await page.click('[data-act="adm-clr"][data-v="s"][data-ok="1"]'); await page.waitForTimeout(400);
    { const cl = await calls(page, "adm_chat_clear"); if (cl.length !== 1 || cl[0].p_ch !== "s") fail(`${W} : vider Saison 1 ` + JSON.stringify(cl)); }
    /* Éternel : même menu, la page reste, Hôtel de vente dans public */
    await page.click('.px-srv button[data-v="e"]'); await page.waitForTimeout(500);
    N = await nav(page); if (!same(N, CLASSIC)) fail(`${W}, Éternel : menu ${N.join(",")}`);
    if (!(await page.$('.px-nav button.on[data-v="salon"]')) || !/Salon Éternel/.test(await body(page))) fail(`${W} : d'un serveur du Classique à l'autre, la page reste (Salon Éternel)`);
    await go(page, "hdv"); await page.waitForTimeout(300); { const w1 = await where(page, "adm_hdv"); if (w1[w1.length - 1] !== "public") fail(`${W}, Éternel : Hôtel de vente lu dans ${w1.join(",")}`); }
    await go(page, "srvvue"); await page.waitForTimeout(300); t = await body(page);
    if (!/en ligne/.test(t) || !/Personne à vérifier/.test(t)) fail(`${W}, Éternel : vue d'ensemble ` + t.slice(0, 300));
    await go(page, "enligne"); t = await body(page);
    if (!/Bob/.test(t) || !/Vieux/.test(t) || /Zoé|Lou/.test(t)) fail(`${W}, Éternel : En ligne : ` + t.slice(0, 300));
    await noScroll(page, `${W}, Éternel`);
    /* ---------- Monocompte ---------- */
    await page.click('.px-srv button[data-v="m"]'); await page.waitForTimeout(500);
    if ((await srvOn(page)) !== "m") fail(`${W} : Monocompte pas choisi`);
    N = await nav(page); if (!same(N, MONO)) fail(`${W}, Monocompte : menu ${N.join(",")}`);
    if (await page.$('[data-act="adm-test"]')) fail(`${W}, Monocompte : bouton Partie de test`);
    await page.waitForFunction(() => /Saison de test/.test(document.querySelector(".px-body").innerText), null, { timeout: 5000 }).catch(() => fail(`${W}, Monocompte : vue d'ensemble sans la saison`));
    if ((await calls(page, "mono_adm_horloge")).length) fail("vue Monocompte : l'horloge ne doit pas être changée");
    await go(page, "mchat"); t = await body(page);
    if (!/Salon Monocompte/.test(t) || !/Épinglé du Monocompte/.test(t)) fail(`${W}, Salon Monocompte : ` + t.slice(0, 300));
    await page.click('[data-act="adm-clr"][data-v="m"]'); await page.click('[data-act="adm-clr"][data-v="m"][data-ok="1"]'); await page.waitForTimeout(400);
    { const cl = await calls(page, "adm_chat_clear"); if (cl[cl.length - 1].p_ch !== "m") fail(`${W} : vider Monocompte ` + JSON.stringify(cl)); }
    await shot(page, `panel-mono-${w}.png`); await noScroll(page, `${W}, Monocompte`);
    if (full) {
      let r = await search(page, "clés"); if (!r.some((x) => /Aller à : Clés bêta/.test(x))) fail("Monocompte : recherche « clés » : " + r.join(" | "));
      r = await search(page, "nouveau joueur"); if (r.some((x) => /Partie de test/.test(x))) fail("Monocompte : départs rapides de test dans la recherche");
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
    }
    /* fiche d'un joueur depuis le Monocompte : « Tous les serveurs › Comptes » */
    await page.evaluate(() => window.CHAT.openAdmin("joueurs", "Zoé")); await page.waitForTimeout(500);
    if ((await srvOn(page)) !== "t" || !(await page.$('.px-nav button.on[data-v="joueurs"]'))) fail(`${W} : fiche d'un joueur : « Tous les serveurs › Comptes » attendu`);
    /* ---------- Tous les serveurs ---------- */
    N = await nav(page); if (!same(N, TOUS)) fail(`${W}, Tous les serveurs : menu ${N.join(",")}`);
    if (full) { const r = await search(page, "annoncer"); if (!r.some((x) => /Aller à : Annoncer/.test(x))) fail("Tous : recherche « annoncer » : " + r.join(" | ")); }
    await go(page, "ann"); await page.waitForSelector("#admAnn", { timeout: 5000 });
    t = await body(page);
    if (!/Sur quels serveurs/.test(t) || !(await page.$("#admAnnSe")) || !(await page.$("#admAnnSs")) || !(await page.$("#admAnnSm"))) fail(`${W}, Annoncer : cases des serveurs absentes`);
    // Éternel et Saison 1 : adm_announce_srv 'e,s'
    await page.fill("#admAnn", "Pour le Classique"); await page.uncheck("#admAnnSm"); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(500);
    { const x = await calls(page, "adm_announce_srv"); if (x.length !== 1 || x[0].p_srv !== "e,s" || x[0].p_body !== "Pour le Classique" || (await calls(page, "adm_announce")).length) fail(`${W}, Annoncer Éternel + Saison 1 : ` + JSON.stringify(x)); }
    // Monocompte seul : adm_announce_mono
    await page.fill("#admAnn", "Nouvelle saison de test lundi"); await page.uncheck("#admAnnSe"); await page.uncheck("#admAnnSs"); await page.check("#admAnnSm"); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(500);
    { const x = await calls(page, "adm_announce_mono"); if (x.length !== 1 || x[0].p_body !== "Nouvelle saison de test lundi") fail(`${W}, Annoncer Monocompte seul : ` + JSON.stringify(x)); }
    // les trois : adm_announce
    await page.fill("#admAnn", "Pour tout le monde"); await page.check("#admAnnSe"); await page.check("#admAnnSs"); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(500);
    { const x = await calls(page, "adm_announce"); if (x.length !== 1 || x[0].p_body !== "Pour tout le monde") fail(`${W}, Annoncer les trois : ` + JSON.stringify(x)); }
    await page.fill("#admAnn", "Personne"); for (const k of ["e", "s", "m"]) await page.uncheck("#admAnnS" + k); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(300);
    if ((await calls(page, "adm_announce_srv")).length !== 1) fail(`${W} : annonce envoyée sans serveur coché`);
    t = await body(page);
    if (!/Pour le Classique/.test(t) || !/Nouvelle saison de test lundi/.test(t) || !/Pour tout le monde/.test(t)) fail(`${W}, Bandeaux affichés : ` + t.slice(0, 800));
    // message épinglé : Éternel + Saison 1 + Monocompte
    await page.fill("#admPin", "Nouvel épinglé partout"); await page.check("#admPing"); await page.check("#admPins"); await page.check("#admPinm"); await page.click('[data-act="adm-pin"]'); await page.waitForTimeout(500);
    { const a = await calls(page, "adm_pin"), b = await calls(page, "adm_pin_mono");
      if (!a.length || a[a.length - 1].p_chs !== "s,g" || a[a.length - 1].p_body !== "Nouvel épinglé partout" || !b.length || b[b.length - 1].p_body !== "Nouvel épinglé partout") fail(`${W}, épinglé : ` + JSON.stringify([a, b])); }
    await shot(page, `panel-annoncer-${w}.png`); await noScroll(page, `${W}, Annoncer`);
    // Réglages du chat : Commerce vidé avec confirmation
    await go(page, "chat"); t = await body(page);
    if (!/Fermer le chat des trois serveurs/.test(t)) fail(`${W}, Réglages du chat : ` + t.slice(0, 300));
    await page.click('[data-act="adm-clr"][data-v="c"]'); await page.click('[data-act="adm-clr"][data-v="c"][data-ok="1"]'); await page.waitForTimeout(400);
    { const cl = await calls(page, "adm_chat_clear"); if (cl[cl.length - 1].p_ch !== "c") fail(`${W} : vider Commerce ` + JSON.stringify(cl)); }
    await noScroll(page, `${W}, Réglages du chat`);
    /* retour à l'accueil */
    await page.click('[data-act="adm-pxsrv"][data-v="a"]'); await page.waitForTimeout(500);
    if (await srvOn(page) || !/Ce qui t'attend/.test(await body(page))) fail(`${W} : bouton Accueil`);
    if (full) {
      /* bandeaux : partie Éternel → « Pour le Classique » (e,s) oui, « Nouvelle saison » (m) non */
      await page.evaluate(() => { window.DX.ui.tab = "home"; window.DX.render(); });
      const seenAnn = async () => page.evaluate(() => (window.ONLINE.announces ? window.ONLINE.announces() : Promise.resolve([])).then(() => (document.querySelector("#annbar") || {}).textContent || ""));
      let ab = await seenAnn();
      if (/Nouvelle saison/.test(ab)) fail("partie Éternel : bandeau Monocompte affiché : " + ab);
      /* jeu rouvert : le panel revient à l'accueil */
      { const ctx = page.context(); await page.close(); page = await hook(await ctx.newPage(), w); }
      await panel(page);
      if (await srvOn(page)) fail("jeu rouvert : le panel doit s'ouvrir sur l'accueil");
      /* partie Monocompte → l'annonce Monocompte, jamais celle de l'Éternel et de la Saison 1 */
      await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); window.DX.ui.tab = "home"; window.DX.render(); });
      await page.waitForFunction(() => /Nouvelle saison de test lundi|Pour tout le monde/.test((document.querySelector("#annbar") || {}).textContent || ""), null, { timeout: 6000 }).catch(() => {});
      ab = await annbar(page);
      if (/Pour le Classique/.test(ab) || !/Nouvelle saison de test lundi|Pour tout le monde/.test(ab)) fail("partie Monocompte : bandeau attendu du Monocompte : " + ab);
      await noScroll(page, `${W}, partie Monocompte`);
    }
    await page.context().close();
  };
  try {
    await run(1280, 900, true);
    console.log("ok - 1280 px : accueil (ce qui t'attend, colonnes, pastilles), quatre cases (Éternel et Saison 1 au même menu, Saison 1 dans s1, Monocompte, Tous les serveurs), salons vidés avec confirmation, page Annoncer (e,s → adm_announce_srv, m → adm_announce_mono, les trois → adm_announce), épinglé sur les trois, bandeaux par serveur");
    await run(390, 844, true);
    console.log("ok - téléphone 390 px : mêmes parcours, sans défilement de côté");
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("ok - aucune erreur console ni boîte de dialogue");
})();
