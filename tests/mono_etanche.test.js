/* Monocompte étanche (2.1.37.x) : rien du serveur Classique n'entre dans une partie Monocompte, ni n'en sort.
   1. Node : héritage cosmétique d'une saison à l'autre sans les ornements des codes cadeaux du Classique ; filtre des fonctions
      Classique (online.js) ; un retrait plus gros que la bourse ne laisse plus d'écart en « Autres » au carnet.
   2. Navigateur, faux serveur en mémoire (aucune requête ne sort), PC 1280 px et téléphone 390 px :
      - partie Monocompte avec des opérations Classique en attente (vente directe, Jackpot du Trool, pluie de kamas, dépôt de guilde) :
        aucune fonction Classique n'est appelée (lots de l'Ascension, du Songe, d'alliance, boss de guilde, vente directe, Jackpot,
        pluie, guilde, Percepteurs, builds, fonction « record »), les opérations Classique ne s'appliquent pas, les kamas ne
        bougent que par l'HdV de saison, le curseur S.hdv.op reste celui du Monocompte ;
      - pages Classique : « Réservé au serveur Classique » (guilde, Jackpot, vente directe, builds), pas de pluie de kamas ;
      - puis la partie Classique : les mêmes opérations s'appliquent (rien n'a été acquitté depuis le Monocompte), ses boutons sont là ;
      - retour au Monocompte : kamas inchangés. Aucune erreur console.
   Lancer : node tests/mono_etanche.test.js (SHOTS=dossier pour garder des captures, jamais dans le dépôt) */
"use strict";
const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");

/* ---------- 1. node ---------- */
{
  const E = require("../js/engine.js");
  ["systems", "mono", "monopass", "saison1", "suivi"].forEach((f) => { try { require("../js/" + f + ".js"); } catch (e) { if (f !== "suivi") throw e; } });
  const S = E.monoStart(E.newState("Leg", "iop"));
  S.unlocks = { wing_or: 1, gift_o_mono_s1: 1, gift_f_mono_pres: 1, gift_o_tf_orn: 1, gift_o_halloween26: 1, gift_f_noel: 1, teint_x: 1 };
  const L = E.monoLegacy(S);
  ["wing_or", "gift_o_mono_s1", "gift_f_mono_pres", "gift_o_tf_orn", "teint_x"].forEach((k) => assert(L.u.includes(k), `${k} suit le compte`));
  ["gift_o_halloween26", "gift_f_noel"].forEach((k) => assert(!L.u.includes(k), `${k} (code cadeau du Classique) ne passe pas à la saison suivante`));
  const T = E.monoStart(E.newState("Nouv", "cra")); T.unlocks = {};
  E.monoApplyLegacy(T, { t: [], u: ["gift_o_halloween26", "gift_o_mono_s1", "wing_or"] });
  assert(T.unlocks.gift_o_mono_s1 && T.unlocks.wing_or && !T.unlocks.gift_o_halloween26, "ancien relevé : les ornements du Classique sont écartés");
  console.log("ok - héritage de saison : ornements et cadres du Monocompte gardés, ceux des codes cadeaux du Classique écartés");
}
{
  // filtre des fonctions Classique : chargé avec un faux client, partie 4
  const store = {}; const g = { location: { pathname: "/", hostname: "idlus.test", search: "" }, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: { userAgent: "node" }, __IDLUS_SB: { createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, rpc: async (n) => { sent.push(n); return { data: { ok: true }, error: null }; } }) } };
  const sent = []; g.window = g; g.globalThis = g;
  const src = fs.readFileSync(path.join(__dirname, "../js/online.js"), "utf8");
  new Function("window", "globalThis", "self", src)(g, g, g);
  const ON = g.ONLINE; assert(ON && ON.classicRpc, "ONLINE.classicRpc exposé");
  ["vente_sell", "foire_jackpot_buy", "rain_join", "adm_rain_open", "guild_deposit", "guild_create", "perco_collect", "perco_place", "gboss_claim", "ally_claim", "asc_claim", "songe_claim",
    "defi_guild_prize", "hdv_sync", "hdv_list", "trade_ok", "koli_me", "brisage_set", "gift_redeem", "build_publish"].forEach((n) => assert(ON.classicRpc(n, {}), `${n} : fonction Classique`));
  assert(ON.classicRpc("une_nouvelle_fonction", { p_after: 3 }), "toute fonction qui reçoit p_after (curseur des opérations du Classique)");
  ["mono_hdv_sync", "mono_push", "chat_send", "amis_liste", "builds_list", "hdv_market", "hdv_offers", "bug_send"].forEach((n) => assert(!ON.classicRpc(n, {}), `${n} : permise`));
  console.log("ok - liste des fonctions Classique coupées dans une partie Monocompte");
}

/* ---------- 2. navigateur ---------- */
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

/* faux serveur : un testeur connecté, saison Monocompte ouverte ; registre Classique (hdv_ops) et registre Monocompte (mono.ops)
   séparés, comme sur le vrai serveur ; chaque appel est noté (partie ouverte, nom) dans localStorage « __calls » */
function fake() {
  const U1 = "00000000-0000-0000-0000-000000000001";
  const CLASSIC = [
    { id: 900001, p: { k: -25000000 }, t: "Dépôt de 25 000 000 kamas au coffre de guilde" },
    { id: 900002, p: { k: 171000000, vd: 1 }, t: "Vente directe : 171 000 000 kamas" },
    { id: 900003, p: { k: 80000000, jack: 1 }, t: "Jackpot du Trool : 80 000 000 kamas !" },
    { id: 900004, p: { k: 5000000, rain: 1 }, t: "Pluie de kamas : 5 000 000 kamas" },
  ];
  const MONO = [{ id: 7, p: { k: 1234 }, t: "HdV de saison : vendu, 1 234 kamas" }];
  const after = (L, a) => L.filter((o) => o.id > (+a || 0));
  const st = () => { try { return JSON.parse(localStorage.getItem("__fx") || "null") || { mono: null, save: null }; } catch (e) { return { mono: null, save: null }; } };
  const put = (x) => localStorage.setItem("__fx", JSON.stringify(x));
  const log = (n) => { try { const L = JSON.parse(localStorage.getItem("__calls") || "[]"); L.push([window.ONLINE && window.ONLINE.slot ? window.ONLINE.slot() : 0, n]); localStorage.setItem("__calls", JSON.stringify(L)); } catch (e) {} };
  const saison = () => ({ id: 0, nom: "Saison de test", theme: null, debut: new Date(Date.now() - 864e5).toISOString(), etat: "ouverte", test: true, fin: new Date(Date.now() + 50 * 864e5).toISOString(), gen: 0, remise: null });
  const now = () => new Date().toISOString();
  const srv = (name, a) => {
    const x = st();
    switch (name) {
      case "mono_acces": return { ok: true, admin: false, saison: saison(), date: now(), jour: 2, semaine: 1, manche: 1, gel: false, clk: { v: 1, pause: false }, srv: now() };
      case "mono_info": return x.mono ? [{ updated_at: x.mono.at, meta: x.mono.meta, device: "ordinateur", game_version: "2.1.37", saison: 0 }] : [];
      case "mono_pull": return x.mono ? x.mono.data : null;
      case "save_info": return x.save ? [{ updated_at: x.save.at, meta: x.save.meta, device: "ordinateur", game_version: "2.1.37" }] : [];
      case "push_save": { x.save = { data: a.p_data, meta: a.p_meta, at: now() }; put(x); return x.save.at; }
      case "cosm_mine": return [];
      case "amis_liste": return { amis: [], recues: [], envoyees: [], bloques: [], invits: [], moi: {}, max: 100 };
      case "mono_renforts": return [];
      case "mono_eclats_etat": return { saison: 0, solde: 0, genere: 0, quota: 100, reste: 100, semaine: 1, jour: 2 };
      case "mono_hdv_sync": return { ops: after(MONO, a.p_after), registre: null };
      case "hdv_sync": return { ops: after(CLASSIC, a.p_after) };
      case "rain_state": return { id: 3, st: "open", total: 5000000, n: 2, in: false, mine: false, by: "Xener", ends: new Date(Date.now() + 240e3).toISOString(), now: now() };
      case "asc_claim": case "songe_claim": case "ally_claim": case "gboss_claim": case "vente_sell": case "foire_jackpot_buy": case "guild_deposit": case "perco_collect": case "perco_place": case "guild_create":
        return { ok: 0, ops: after(CLASSIC, a.p_after) };
      default: return null;
    }
  };
  const q = (table) => { const b = new Proxy(function () {}, { get: (t, k) => (k === "then" ? (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    : k === "maybeSingle" || k === "single" ? () => Promise.resolve({ data: table === "profiles" ? { pseudo: "Testeur" } : null, error: null }) : () => b) }); return b; };
  const ch = () => { const c = { on: () => c, subscribe: () => c, track: () => {}, untrack: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
  const user = { id: U1, email: "t@idlus.fr", identities: [] };
  window.__IDLUS_SB = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user } } }), getUser: async () => ({ data: { user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }), stopAutoRefresh: async () => {} },
    from: q, channel: ch, removeChannel: () => {}, removeAllChannels: () => {},
    functions: { invoke: async (name, o) => {
      log("fn:" + name + ":" + Object.keys((o && o.body) || {}).join(","));
      if (name === "mono" && o.body.push) { const x = st(), a = o.body.push; x.mono = { data: a.data, meta: a.meta, at: now() }; put(x); return { data: { ok: true, at: x.mono.at, verif: null }, error: null }; }
      return { data: { ok: false, err: "absent" }, error: null }; } },
    rpc: async (name, a) => { log(name); return { data: srv(name, a || {}), error: null }; },
  }) };
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const CLASSIC_NAMES = /^(asc_claim|songe_claim|ally_claim|gboss_claim|guild_|perco_|prism_|vente_sell|foire_jackpot|rain_|adm_rain_|hdv_sync|hdv_list|hdv_buy|trade_|koli_|defi_guild_prize|build_publish|gift_|fn:record)/;
  try {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(fake);
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      const menu = async () => { await page.waitForSelector('.svc2[data-slot="4"]', { timeout: 15000 }); await page.waitForTimeout(300); };
      const toMenu = async () => { await page.evaluate(() => { try { sessionStorage.setItem("idlus-menu", "1"); } catch (e) {} }); await page.reload(); await menu(); };
      const start = async (slot, name) => {
        await page.click(`.svc2[data-slot="${slot}"] [data-act="sv-play"]`);
        await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
        await page.fill("#startName", name);
        await page.click('[data-act="startgame"]');
        await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
        await page.waitForFunction(() => window.ONLINE && window.ONLINE.state === "ok", null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(800);
      };
      const play = async (slot) => { await page.click(`.svc2[data-slot="${slot}"] [data-act="sv-play"]`); await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
        await page.waitForFunction(() => window.ONLINE && window.ONLINE.state === "ok", null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800); };
      const st = () => page.evaluate(() => { const S = window.DX.S; return { mono: !!S.mono, k: S.kamas, op: (S.hdv && S.hdv.op) || 0, slot: window.ONLINE.slot() }; });
      const go = async (k) => { await page.evaluate((x) => window.DX.go(x), k); await page.waitForTimeout(500); return page.textContent("#main"); };
      const calls = () => page.evaluate(() => JSON.parse(localStorage.getItem("__calls") || "[]"));
      const wide = async (where) => { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${w} px, ${where} : la page défile de côté`); };

      await page.goto(base, { waitUntil: "load" }); await menu();
      await page.evaluate(() => localStorage.setItem("__calls", "[]"));

      /* ---------- partie Monocompte ---------- */
      let e0 = errors.length;
      await start(4, "Mono");
      let M = await st();
      if (!M.mono || M.slot !== 4) fail(`${w} px : partie Monocompte (4) attendue`);
      const k0 = M.k;
      const R = await page.evaluate(async () => {
        const ON = window.ONLINE, out = {};
        for (const n of ["asc_claim", "songe_claim", "ally_claim", "gboss_claim", "vente_sell", "foire_jackpot_buy", "rain_join", "rain_state", "adm_rain_open", "guild_deposit", "guild_create", "perco_collect", "perco_place", "build_publish", "defi_guild_prize"])
          out[n] = (await ON.rpc(n, { p_after: 0 })).err || "PASSÉ";
        out.record = [(await ON.submitRecord("x")).err, (await ON.submitDefi(1)).err, (await ON.submitGuild({ gboss: 1 })).err, (await ON.dofusAnn({ uid: 1, did: "x", k: 1 })).err];
        out.applied = window.MARKET.apply([{ id: 900002, p: { k: 171000000, vd: 1 }, t: "Vente directe" }], true); // comme une réponse d'une fonction Classique
        await window.MARKET.sync(); // HdV de saison : registre Monocompte seulement
        return out;
      });
      for (const n in R) if (n !== "record" && n !== "applied" && !/Réservé au serveur Classique/.test(R[n])) fail(`${w} px : ${n} depuis le Monocompte : refus attendu, trouvé ${R[n]}`);
      if (R.record.some((e) => !/Réservé au serveur Classique/.test(e || ""))) fail(`${w} px : fonction « record » depuis le Monocompte : ${JSON.stringify(R.record)}`);
      if (R.applied !== 0) fail(`${w} px : opération Classique appliquée au Monocompte (${R.applied})`);
      // les lots de l'Ascension, du Songe et des alliances partent seuls : on leur laisse le temps
      await go("asc"); await go("exp"); await go("home");
      await page.waitForTimeout(1500);
      M = await st();
      if (M.k !== k0 + 1234) fail(`${w} px : kamas du Monocompte : ${k0} + 1 234 (HdV de saison) attendus, trouvé ${M.k}`);
      if (M.op !== 7) fail(`${w} px : curseur du Monocompte : 7 attendu (registre Monocompte), trouvé ${M.op}`);
      const C4 = (await calls()).filter((c) => c[0] === 4 && CLASSIC_NAMES.test(c[1]));
      if (C4.length) fail(`${w} px : fonctions Classique appelées depuis le Monocompte : ${[...new Set(C4.map((c) => c[1]))].join(", ")}`);
      if (await page.$(".pl-card")) fail(`${w} px : pluie de kamas du Classique sur l'accueil du Monocompte`);
      if (await page.evaluate(() => { const p = document.querySelector("#plpill"); return !!(p && p.offsetParent); })) fail(`${w} px : pastille de pluie dans le Monocompte`);
      for (const [k, what] of [["guild", "guilde"], ["foire", "Jackpot"], ["cours", "vente directe"], ["builds", "builds"]]) {
        const t = await go(k);
        if (!/serveur Classique/.test(t)) fail(`${w} px : page ${k} du Monocompte : « serveur Classique » attendu`);
        await wide(k);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `etanche-mono-${k}-${w}.png`) });
      }
      if (await page.$('[data-act="bd-pub"]')) fail(`${w} px : bouton « Publier un build » dans le Monocompte`);
      if (await page.$('[data-act="g-dep"], [data-act="g-create"]')) fail(`${w} px : dépôt ou fondation de guilde proposés dans le Monocompte`);
      // pas de lien mort : chaque page du menu s'ouvre
      const keys = await page.evaluate(() => window.DX.NAV.flatMap((F) => F.pages.map((p) => p[0])).filter((k) => k !== "bug" && k !== "admin"));
      for (const k of keys) { const t = await go(k); if (!t || t.trim().length < 20) fail(`${w} px : page ${k} vide dans le Monocompte`); }
      if (errors.length === e0) console.log(`ok - ${w} px : Monocompte étanche (aucune fonction Classique appelée, opérations Classique non appliquées, curseur à 7, pages « serveur Classique »)`);

      /* ---------- partie Classique : les opérations attendent encore ---------- */
      e0 = errors.length;
      await toMenu();
      await start(1, "Classe");
      let K = await st();
      if (K.mono || K.slot !== 1) fail(`${w} px : partie Classique (1) attendue`);
      await page.evaluate(() => window.MARKET.sync()); await page.waitForTimeout(800);
      K = await st();
      if (K.op !== 900004) fail(`${w} px : partie Classique : les 4 opérations Classique attendues (curseur 900004), trouvé ${K.op}`);
      const want = Math.max(0, 0 - 25000000) + 171000000 + 80000000 + 5000000;
      if (Math.abs(K.k - want) > 100000) fail(`${w} px : kamas de la partie Classique : ≈ ${want} attendus, trouvé ${K.k}`);
      const led = await page.evaluate(() => window.ENGINE.carnetLedger(window.DX.S, 7));
      const cat = (L, c) => (L.find((x) => x.k === c) || { v: 0 }).v;
      if (cat(led.inn, "vented") !== 171000000 || cat(led.inn, "foire") !== 80000000 || cat(led.inn, "pluie") !== 5000000) fail(`${w} px : carnet Classique : ${JSON.stringify(led)}`);
      if (cat(led.inn, "autre")) fail(`${w} px : carnet : retrait de guilde plus gros que la bourse compté en « Autres » (${cat(led.inn, "autre")})`);
      await go("builds"); if (!(await page.$('[data-act="bd-pub"]'))) fail(`${w} px : partie Classique : bouton « Publier un build » attendu`);
      const tf = await go("foire"); if (/serveur Classique/.test(tf)) fail(`${w} px : partie Classique : la Foire ne doit pas dire « serveur Classique »`);
      await go("home"); await page.waitForTimeout(500);
      if (errors.length === e0) console.log(`ok - ${w} px : partie Classique : opérations Classique appliquées (rien n'avait été acquitté depuis le Monocompte), carnet sans « Autres », boutons là`);

      /* ---------- retour au Monocompte ---------- */
      e0 = errors.length;
      await toMenu(); await play(4);
      await page.evaluate(() => window.MARKET.sync()); await page.waitForTimeout(800);
      M = await st();
      if (!M.mono || M.k !== k0 + 1234 || M.op !== 7) fail(`${w} px : retour au Monocompte : kamas ${k0 + 1234} et curseur 7 attendus, trouvé ${M.k} / ${M.op}`);
      if (errors.length === e0) console.log(`ok - ${w} px : retour au Monocompte : kamas inchangés`);
      await ctx.close();
    }
  } catch (e) { fail("exception : " + (e && e.stack || e)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - Monocompte étanche : PC 1280 px et téléphone 390 px, sans erreur console");
})();
