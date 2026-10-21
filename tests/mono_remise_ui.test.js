/* Remise à zéro de la bêta Monocompte dans le navigateur (2.1.35.2, aucune requête ne sort ; faux serveur en mémoire) :
   - partie Monocompte créée avant la remise (génération 0) : au démarrage suivant, après la remise (mono_acces : saison.gen = 1),
     elle est mise de côté (copie renommée dofousxen-save-mono-remise-1, jamais effacée), message « La bêta a été remise à zéro :
     ta partie repart de zéro » et la carte « Nouvelle partie de la bêta » ; la nouvelle partie porte la génération 1 ;
   - partie créée après la remise : jamais touchée au démarrage suivant (ni message, ni mise de côté) ;
   - partie sans génération (jeu d'avant 2.1.35.2) : mise de côté si elle a commencé avant la remise, gardée sinon ;
   - pendant le jeu : le serveur refuse l'envoi d'une partie d'avant la remise → retour à l'écran des parties, partie mise de côté ;
   PC 1280 px et téléphone 390 px, sans erreur console.
   Lancer : node tests/mono_remise_ui.test.js (SHOTS=dossier pour garder des captures) */
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

/* faux serveur : un testeur connecté (pseudo Testeur), saison de test 0 ouverte ; état dans localStorage « __rz » (gen, remise,
   partie en ligne, envois refusés) pour survivre aux rechargements */
function fake() {
  const U1 = "00000000-0000-0000-0000-000000000001";
  const st = () => { try { return JSON.parse(localStorage.getItem("__rz") || "null") || { gen: 0, remise: null, p: null, refus: 0, envois: 0 }; } catch (e) { return { gen: 0 }; } };
  const put = (x) => localStorage.setItem("__rz", JSON.stringify(x));
  const saison = (x) => ({ id: 0, nom: "Saison de test", theme: null, debut: new Date(Date.now() - 864e5).toISOString(), etat: "ouverte", test: true, fin: new Date(Date.now() + 50 * 864e5).toISOString(), gen: x.gen, remise: x.remise });
  const srv = (name) => {
    const x = st();
    switch (name) {
      case "mono_acces": return { ok: true, admin: false, saison: saison(x), date: new Date().toISOString(), jour: 2, semaine: 1, manche: 1, gel: false, clk: { v: 1, pause: false }, srv: new Date().toISOString() };
      case "mono_info": return x.p ? [{ updated_at: x.p.at, meta: x.p.meta, device: "ordinateur", game_version: "2.1.35.2", saison: 0 }] : [];
      case "mono_pull": return x.p ? x.p.data : null;
      case "mono_push": return null;
      case "save_info": return [];
      case "cosm_mine": return [];
      case "mono_eclats_etat": return { saison: 0, solde: 0, genere: 0, quota: 100, reste: 100, semaine: 1, jour: 2 };
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
      if (name === "mono" && o.body.push) { const x = st(), a = o.body.push;
        const g = /^\d{1,9}$/.test(String((a.meta || {}).gen == null ? "" : a.meta.gen)) ? +a.meta.gen : 0;
        if (g < x.gen) { x.refus++; put(x); return { data: { ok: false, err: "partie d'avant la remise à zéro de la bêta : recharge le jeu" }, error: null }; }
        if (!a.force && ((a.expected == null && x.p) || (a.expected != null && (!x.p || x.p.at !== a.expected)))) return { data: { ok: true, at: null }, error: null };
        x.p = { data: a.data, meta: a.meta, at: new Date().toISOString().replace("Z", "001Z") }; x.envois++; put(x);
        return { data: { ok: true, at: x.p.at, verif: null }, error: null }; }
      return { data: { ok: false, err: "absent" }, error: null }; } },
    rpc: async (name, a) => ({ data: srv(name, a || {}), error: null }),
  }) };
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://idlus.test:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP idlus.test 127.0.0.1"] });
  const KEY = "dofousxen-save-mono", AK = KEY + "-remise-1";
  const MSG = /La bêta a été remise à zéro : ta partie repart de zéro/;
  try {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
      await page.addInitScript(fake);
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
      const rz = (p) => page.evaluate((v) => { const x = JSON.parse(localStorage.getItem("__rz") || "null") || { gen: 0, remise: null, p: null, refus: 0, envois: 0 }; Object.assign(x, v); localStorage.setItem("__rz", JSON.stringify(x)); }, p);
      const menu = async () => { await page.waitForSelector('.svc2[data-slot="4"]', { timeout: 15000 }); await page.waitForTimeout(300); };
      const msg = () => page.evaluate(() => (document.querySelector("#onMsg") || {}).textContent || "");
      const card4 = () => page.textContent('.svc2[data-slot="4"]');
      const local = () => page.evaluate((k) => { const raw = localStorage.getItem(k); if (!raw) return null; const E = window.ENGINE; try { return E.deserialize(raw); } catch (e) { return "illisible"; } }, KEY);
      const startMono = async (name) => {
        await page.click('.svc2[data-slot="4"] [data-act="sv-play"]');
        await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
        await page.fill("#startName", name);
        await page.click('[data-act="startgame"]');
        await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
        await page.waitForTimeout(800);
      };
      const toMenu = async () => { await page.evaluate(() => { try { sessionStorage.setItem("idlus-menu", "1"); } catch (e) {} }); await page.reload(); await menu(); };

      /* ---------- 1. partie créée avant la remise ---------- */
      await page.goto(base, { waitUntil: "load" }); await menu();
      if (!/Nouvelle partie de la bêta/.test(await card4())) fail(`${w} px : carte « Nouvelle partie de la bêta » attendue au départ`);
      await startMono("Avant");
      let L = await local();
      if (!L || !L.mono || L.mono.gen !== 0) fail(`${w} px : partie d'avant la remise : génération 0 attendue, trouvé ${JSON.stringify(L && L.mono && L.mono.gen)}`);
      if (await page.evaluate(() => window.ONLINE.slot && window.ONLINE.slot()) !== 4) fail(`${w} px : partie 4 attendue`);
      await page.evaluate(() => window.DX.social.markDirty && window.DX.social.markDirty());
      // la remise : le serveur passe en génération 1 et efface la partie en ligne
      await rz({ gen: 1, remise: new Date().toISOString(), p: null });
      await toMenu();
      if (!MSG.test(await msg())) fail(`${w} px : message de remise attendu, trouvé « ${await msg()} »`);
      if (!/Nouvelle partie de la bêta/.test(await card4())) fail(`${w} px : après la remise, carte « Nouvelle partie de la bêta » attendue`);
      if (await page.evaluate((k) => localStorage.getItem(k), KEY)) fail(`${w} px : l'ancienne partie est encore la partie Monocompte`);
      const aside = await page.evaluate((k) => { const raw = localStorage.getItem(k); try { return raw ? window.ENGINE.deserialize(raw).chars[0].name : null; } catch (e) { return "illisible"; } }, AK);
      if (aside !== "Avant") fail(`${w} px : ancienne partie mise de côté sous ${AK} attendue, trouvé ${aside}`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `remise-menu-${w}.png`) });
      { const x = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (x[0] > x[1] + 1) fail(`${w} px : la page défile de côté`); }
      console.log(`ok - ${w} px : partie d'avant la remise mise de côté (${AK}), message et « Nouvelle partie de la bêta »`);

      /* ---------- 2. partie créée après la remise : jamais touchée ---------- */
      await startMono("Apres");
      L = await local();
      if (!L || L.mono.gen !== 1) fail(`${w} px : nouvelle partie : génération 1 attendue, trouvé ${JSON.stringify(L && L.mono && L.mono.gen)}`);
      await page.waitForTimeout(1500);
      await toMenu();
      if (MSG.test(await msg())) fail(`${w} px : partie d'après la remise : aucun message attendu`);
      L = await local();
      if (!L || L.chars[0].name !== "Apres") fail(`${w} px : partie d'après la remise touchée`);
      if (/Nouvelle partie de la bêta/.test(await card4())) fail(`${w} px : partie d'après la remise : sa carte doit rester`);
      if ((await page.evaluate((k) => localStorage.getItem(k), AK)) == null) fail(`${w} px : la copie mise de côté a disparu`);
      console.log(`ok - ${w} px : partie d'après la remise (génération 1) intacte au démarrage suivant`);

      /* ---------- 3. parties sans génération (jeu d'avant 2.1.35.2) ---------- */
      const unstamp = (t0) => page.evaluate(([k, t]) => { const E = window.ENGINE; const S = E.deserialize(localStorage.getItem(k)); delete S.mono.gen; S.mono.t0 = t; localStorage.setItem(k, E.packSave ? E.packSave(E.serialize(S)) : E.serialize(S)); localStorage.removeItem(k + "-remise-2"); }, [KEY, t0]);
      const remiseAt = Date.now() - 3600e3;
      await rz({ remise: new Date(remiseAt).toISOString(), p: null });
      await unstamp(remiseAt + 60e3); await toMenu();
      if (MSG.test(await msg()) || !(await local())) fail(`${w} px : partie sans génération commencée après la remise : gardée attendue`);
      await unstamp(remiseAt - 60e3);
      await page.evaluate((k) => localStorage.removeItem(k), AK); await toMenu();
      if (!MSG.test(await msg()) || (await local())) fail(`${w} px : partie sans génération commencée avant la remise : mise de côté attendue`);
      console.log(`ok - ${w} px : partie sans génération : gardée si commencée après la remise, mise de côté sinon`);

      /* ---------- 4. remise pendant le jeu : envoi refusé → écran des parties, partie mise de côté ---------- */
      await rz({ gen: 1, p: null });
      await startMono("Pendant");
      await rz({ gen: 2, remise: new Date().toISOString(), p: null, refus: 0 });
      await page.evaluate(() => { window.DX.social.markDirty && window.DX.social.markDirty(); });
      await page.evaluate(() => window.ONLINE.push(localStorage.getItem("dofousxen-save-mono"), { gen: 1 }, Date.now()).catch(() => {}));
      await menu();
      await page.waitForFunction(() => /remise à zéro/.test((document.querySelector("#onMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
      if (!MSG.test(await msg())) fail(`${w} px : remise pendant le jeu : retour à l'écran des parties avec le message attendu, trouvé « ${await msg()} »`);
      if (await local()) fail(`${w} px : remise pendant le jeu : partie pas mise de côté`);
      if ((await page.evaluate((k) => localStorage.getItem(k + "-remise-2"), KEY)) == null) fail(`${w} px : remise pendant le jeu : copie -remise-2 attendue`);
      console.log(`ok - ${w} px : remise pendant le jeu : envoi refusé, retour à l'écran des parties, partie mise de côté`);
      await ctx.close();
    }
  } catch (e) { fail("exception : " + (e && e.stack || e)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - remise à zéro de la bêta : PC 1280 px et téléphone 390 px, sans erreur console");
})();
