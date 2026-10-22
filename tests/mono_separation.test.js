/* Séparation du Monocompte et du Classique (Mathis, 22/10 : « 1A », rien du Classique en Monocompte, même en lecture ; « 3B »)
   1. Inventaire des appels au serveur : chaque fonction appelée par le jeu (rpc, functions.invoke) est rangée, soit permise en
      Monocompte (liste blanche E.MONO.RPC de js/mono.js, ou HdV et échanges renommés en mono_*), soit dans CLASSIQUE ci-dessous.
      Une nouvelle fonction non rangée fait échouer le test : il faut choisir son camp.
   2. Aucune fonction du serveur qui verse des gains du Classique (registre hdv_ops) n'est permise en Monocompte.
   3. Dans le navigateur (faux serveur, aucune requête ne sort), partie Monocompte de l'emplacement 4 : menu limité à la liste
      blanche E.MONO.PAGES, modules du Classique éteints, page du Classique ouverte par son nom → Havre-Sac, Classements sans
      « Voir le Classique », accueil sans encart du Classique, appel d'une fonction du Classique refusé sans partir sur le réseau,
      amis appelés avec p_srv 'm' ; partie Classique : menu complet et appels inchangés. PC 1280 px et téléphone 390 px, sans
      erreur console ni défilement de côté.
   Lancer : node tests/mono_separation.test.js (SHOTS=dossier pour garder des captures) */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..");
const E = require("../js/engine.js");
require("../js/mono.js");

/* fonctions du serveur du Classique : jamais appelées depuis une partie Monocompte (refusées par js/online.js) */
const CLASSIQUE = new Set([
  "align_regions", "ally_chat", "ally_claim", "ally_me", "ally_say", "asc_claim", "build_delete", "build_like", "build_publish", "build_report", "build_view",
  "builds_list", "builds_me", "defi_guild_prize", "defi_share", "defi_vote", "foire_jackpot", "foire_jackpot_buy", "gboss_claim", "gift_mine", "gift_redeem",
  "guild_chat", "guild_extra", "guild_give", "guild_list", "guild_me", "guild_of", "guild_say", "guild_view", "hdv_prix7", "koli_me", "perco_map", "rain_join", "rain_state",
  "songe_claim", "vente_courbe", "vente_cours", "vente_sell", "wb_info", "adm_rain_open", "adm_rain_stop", "adm_rains", "adm_hdv_remove", "record",
  // sauvegarde : chaque emplacement a les siennes (le Monocompte passe par mono_push, mono_pull, mono_info, mono_delete)
  "push_save", "push_slot", "save_info", "slot_info", "delete_slot",
]);
/* HdV de saison et échanges : renommés en mono_* par js/online.js quand la partie Monocompte est en ligne (MONO_RPC) */
const MONO_RPC = /^(hdv_(sync|list|buy|cancel|reprice|market|offers|history|mine|bought|order_new|order_cancel|order_fill|orders_list|orders_mine)|trade_(start|state|offer|ok|cancel))$/;

/* ---------- 1. inventaire des appels ---------- */
const files = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "js", f));
const names = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const re of [/\brpc\(\s*"([a-z_0-9]+)"/g, /functions\.invoke\(\s*"([a-z_0-9]+)"/g]) {
    let m; while ((m = re.exec(src))) { if (!names.has(m[1])) names.set(m[1], new Set()); names.get(m[1]).add(path.basename(f)); }
  }
}
assert(names.size > 100, "inventaire des appels : trop peu de fonctions trouvées (" + names.size + ")");
const sql = fs.readdirSync(path.join(ROOT, "supabase")).filter((f) => f.endsWith(".sql")).map((f) => fs.readFileSync(path.join(ROOT, "supabase", f), "utf8")).join("\n");
const sansCamp = [];
for (const [n, w] of names) {
  const mono = E.monoRpcOk(n) || E.MONO.FN.has(n) || (MONO_RPC.test(n) && new RegExp(`function mono\\.?_?(public\\.)?mono_${n}\\b|function public\\.mono_${n}\\b`).test(sql));
  if (mono && CLASSIQUE.has(n)) assert.fail(`${n} : à la fois permise en Monocompte et rangée au Classique`);
  if (!mono && !CLASSIQUE.has(n) && !MONO_RPC.test(n)) sansCamp.push(`${n} (${[...w].join(", ")})`);
}
assert.deepStrictEqual(sansCamp, [], "fonctions du serveur sans camp : ajoute-les à E.MONO.RPC (js/mono.js) si le Monocompte s'en sert, sinon à CLASSIQUE (ce test)");
console.log(`ok - ${names.size} fonctions du serveur appelées par le jeu, toutes rangées (Monocompte ou Classique)`);

/* ---------- 2. aucune source de gains du Classique permise ---------- */
const credit = new Set();
{ const re = /create or replace function public\.([a-z_0-9]+)\s*\(([\s\S]*?)\$\$;/g; let m;
  while ((m = re.exec(sql))) if (/hdv_ops_after\(|hdv_op\(|hdv_kamas\(/.test(m[2])) credit.add(m[1]); }
assert(credit.size >= 15, "fonctions qui versent par le registre du Classique : trop peu trouvées (" + credit.size + ")");
const fuites = [...credit].filter((n) => E.monoRpcOk(n));
assert.deepStrictEqual(fuites, [], "fonctions du Classique qui versent des gains, permises en Monocompte");
for (const n of ["songe_claim", "asc_claim", "ally_claim", "gboss_claim", "rain_join", "vente_sell", "foire_jackpot_buy", "guild_give", "defi_guild_prize", "gift_redeem", "gift_mine", "hdv_sync", "trade_ok", "builds_list"])
  assert(!E.monoRpcOk(n), n + " : refusée en Monocompte");
for (const n of ["mono_push", "mono_hdv_sync", "chat_send", "amis_liste", "couronne_temps", "bug_send", "cosm_mine"]) assert(E.monoRpcOk(n), n + " : permise en Monocompte");
assert(!E.monoRpcOk("adm_rain_open"), "pluie de kamas jamais lancée depuis une partie Monocompte");
console.log(`ok - aucune des ${credit.size} fonctions du Classique qui versent des kamas ou des objets n'est permise en Monocompte`);

/* modules éteints : chacun existe bien dans le jeu (un nom mal écrit ne couperait rien) */
{ const all = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  for (const k of E.MONO.CLASSIC_MODS) assert(new RegExp(`window\\.${k} = `).test(all), `module ${k} : introuvable dans js/`); }
for (const k of ["exp", "asc", "wb", "elev", "comptoirs", "foire", "guild", "builds", "cours"]) assert(!E.monoPageOk(k), `page ${k} : fermée en Monocompte`);
console.log("ok - liste blanche des pages et modules du Classique éteints : noms vérifiés");

/* ---------- 3. dans le navigateur ---------- */
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
/* faux serveur : visiteur non connecté ; espace Monocompte du serveur coupé (__IDLUS_NOMONO : partie 4 sur l'appareil) ; chaque appel noté */
function fake() {
  window.__IDLUS_NOMONO = true;
  const F = (window.__SEP = { calls: [] });
  const q = () => { const b = new Proxy(function () {}, { get: (o, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: null, error: null }) : () => b) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }) },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async (n) => { F.calls.push(["fn:" + n, {}]); return { data: null, error: { message: "absent" } }; } },
    rpc: async (name, a) => { F.calls.push([name, a || {}]); return { data: null, error: null }; },
  }) };
}

(async () => {
  const { chromium } = require("playwright");
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const open = async (w, h, mono) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(fake);
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
    if (mono) { // partie Monocompte rangée dans l'emplacement 4, puis reprise de cette partie (comme depuis l'écran des parties)
      await page.evaluate(() => { const { E } = window.DX; const N = E.newState("Mono", "cra"); E.monoStart(N); N.chars[0].lvl = 30;
        N.settings.pins = ["dungeons", "defi", "forge", "hdv", "exp"]; localStorage.setItem("dofousxen-save-mono", E.serialize(N));
        sessionStorage.setItem("idlus-reprise", "4"); });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => window.DX && window.DX.S && window.DX.S.mono, null, { timeout: 10000 });
      await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
    }
    await page.addStyleTag({ content: ".wtip{display:none!important}" });
    await page.evaluate(() => window.DX.social && window.DX.social.closeSheet && window.DX.social.closeSheet());
    return page;
  };
  const navKeys = (page) => page.evaluate(() => window.DX.NAV.flatMap((F) => F.pages.map((p) => p[0])));
  const noScroll = async (page, what) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${what} : la page défile de côté (${x[0]} px pour ${x[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const go = (page, k) => page.evaluate((t) => { window.DX.ui.tab = t; window.DX.render(); return window.DX.ui.tab; }, k);
  try {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      /* ---------- partie Monocompte ---------- */
      const p = await open(w, h, true);
      const slot = await p.evaluate(() => [window.ONLINE.slot(), window.ONLINE.monoGame()]);
      if (slot[0] !== 4 || !slot[1]) fail(`${w} px : partie Monocompte dans l'emplacement 4 attendue : ` + JSON.stringify(slot));
      const keys = await navKeys(p);
      const hors = keys.filter((k) => !E.monoPageOk(k));
      if (hors.length) fail(`${w} px : pages hors de la liste blanche dans le menu Monocompte : ` + hors.join(", "));
      for (const k of ["exp", "asc", "wb", "elev", "comptoirs", "foire", "guild", "builds", "cours"]) if (keys.includes(k)) fail(`${w} px : page du Classique « ${k} » dans le menu`);
      for (const k of ["world", "dungeons", "team", "inv", "metiers", "pass", "saisonlb", "ladder"]) if (!keys.includes(k)) fail(`${w} px : page « ${k} » attendue dans le menu Monocompte`);
      const pins = await p.evaluate(() => window.DX.S.settings.pins);
      if (pins.some((k) => !E.monoPageOk(k))) fail(`${w} px : épingles du Classique gardées : ` + JSON.stringify(pins));
      const mods = await p.evaluate((L) => L.filter((k) => window[k]), E.MONO.CLASSIC_MODS);
      if (mods.length) fail(`${w} px : modules du Classique encore actifs : ` + mods.join(", "));
      for (const k of ["exp", "asc", "wb", "guild", "foire", "comptoirs", "elev", "builds"]) { const t = await go(p, k); if (t !== "home") fail(`${w} px : page du Classique « ${k} » ouverte par son nom (onglet ${t})`); }
      { const t = await go(p, "defi"); const tx = await p.evaluate(() => document.querySelector("#main").textContent);
        if (t !== "defi" || /Classement ·|vote/i.test(tx)) fail(`${w} px : Défi du jour du Monocompte (onglet ${t}) : jouable, sans classement ni vote du Classique`); }
      await go(p, "home");
      const home = await p.evaluate(() => document.querySelector("#main").textContent);
      for (const re of [/Boss des mondes/, /Songe infini/, /L'Ascension/, /Pluie de kamas/, /Course de/, /Foire du Trool/]) if (re.test(home)) fail(`${w} px : accueil Monocompte, encart du Classique : ${re}`);
      await shot(p, `mono-sep-accueil-${w}.png`); await noScroll(p, `${w} px, accueil Monocompte`);
      await go(p, "ladder");
      const lb = await p.evaluate(() => [window.DX.ui.tab, document.querySelector("#main").textContent, !!document.querySelector('[data-act="lb-classic"]')]);
      if (lb[2] || /Voir le Classique/.test(lb[1])) fail(`${w} px : Classements Monocompte, bouton vers le Classique encore là`);
      if (lb[0] === "ladder" && !/saison/i.test(lb[1])) fail(`${w} px : Classements Monocompte : classements de saison attendus`);
      await shot(p, `mono-sep-classements-${w}.png`); await noScroll(p, `${w} px, classements Monocompte`);
      // appels au serveur : le Classique refusé sans partir, la liste blanche passe
      const r = await p.evaluate(async () => { const ON = window.ONLINE; window.__SEP.calls.length = 0; const out = {};
        for (const n of ["songe_claim", "asc_claim", "rain_join", "vente_sell", "gift_mine", "guild_me", "builds_list", "wb_info"]) out[n] = (await ON.rpc(n, { p_after: 0 })).err || null;
        out.chat = (await ON.rpc("chat_me")).err || null; out.sent = window.__SEP.calls.map((c) => c[0]); return out; });
      for (const n of ["songe_claim", "asc_claim", "rain_join", "vente_sell", "gift_mine", "guild_me", "builds_list", "wb_info"]) if (!/Pas en Monocompte|Réservé au serveur Classique/.test(r[n] || "")) fail(`${w} px : ${n} attendue refusée en Monocompte : ` + r[n]);
      if (r.chat || JSON.stringify(r.sent) !== JSON.stringify(["chat_me"])) fail(`${w} px : seul chat_me part au serveur : ` + JSON.stringify(r));
      if (!errors.length) console.log(`ok - ${w} px, partie Monocompte : menu de la liste blanche (${keys.length} pages), modules du Classique éteints, pages du Classique fermées, Classements sans le Classique, appels du Classique refusés`);
      /* ---------- partie Classique : rien ne change ---------- */
      const c = await open(w, h, false);
      const ck = await navKeys(c);
      for (const k of ["exp", "asc", "defi", "wb", "foire", "comptoirs"]) if (!ck.includes(k)) fail(`${w} px, partie Classique : page « ${k} » attendue dans le menu`);
      const cm = await c.evaluate((L) => L.filter((k) => !window[k]), ["SGUI", "WBUI", "ASCUI", "FOIREUI", "CPTUI"]);
      if (cm.length) fail(`${w} px, partie Classique : modules éteints à tort : ` + cm.join(", "));
      const cr = await c.evaluate(async () => { window.__SEP.calls.length = 0; const e = (await window.ONLINE.rpc("wb_info")).err || null; return [e, window.__SEP.calls.map((x) => x[0])]; });
      if (cr[0] || JSON.stringify(cr[1]) !== JSON.stringify(["wb_info"])) fail(`${w} px, partie Classique : wb_info doit partir : ` + JSON.stringify(cr));
      await noScroll(c, `${w} px, accueil Classique`);
      if (!errors.length) console.log(`ok - ${w} px, partie Classique : menu complet, modules et appels inchangés`);
      await p.context().close(); await c.context().close();
    }
  } catch (e) { fail("exception : " + (e.stack || e.message)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - aucune erreur console");
})();
