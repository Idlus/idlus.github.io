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

  const MONO = ["monovue", "monoenligne", "monobouclier", "monojournal", "monoremise", "monotesteurs", "clesbeta", "monobureau", "mchat"];
  const CLASSIC = ["srvvue", "enligne", "verif", "fiches", "hdv", "guildes", "builds", "salon"];
  const TOUS = ["joueurs", "sig", "vue", "ann", "codes", "chat", "bugs", "idees", "equipe", "test"];
  const badges = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".px-sp button")].map((b) => [b.dataset.v, (b.querySelector("em") || {}).textContent || ""])));
  const same = (a, b) => a.join(",") === b.join(",");

  const a2 = async (w, h, list) => {
    const page = await open(w, h); await panel(page);
    await page.click(`.px-sp [data-v="t"]`); await page.waitForTimeout(500);
    for (const v of list) {
      const t0 = Date.now();
      await go(page, v); await page.waitForTimeout(800);
      const t = (await body(page)).replace(/\s+/g, " ").slice(0, 140);
      console.log(`  ${v} (${Date.now() - t0} ms) ${t}`);
    }
    await page.context().close();
  };
  const L = (process.env.L || "sig").split(",");
  try { await a2(1280, 900, L); } catch (e) { fail("exception : " + (e.message.split("\n")[0])); }
  await browser.close(); server.close();
  console.log(errors.join("\n"));
})();
