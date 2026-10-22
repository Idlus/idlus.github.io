/* Combat de groupe en direct sur l'écran de combat (js/bureau_direct.js), avec un faux serveur Monocompte dans la page :
   - le combat rejoué pas à pas est exactement celui du serveur (mêmes PV, seconde par seconde, que BC.voir), même si la partie
     du joueur avance entre deux pas ;
   - sur la page du Bureau, l'écran de combat s'ouvre tout seul à la bonne seconde (Tableau du groupe, discussion, progression) ;
   - ailleurs, le bandeau « Ton groupe combat » (Regarder / Plus tard) ;
   - fin : résultat, meilleur du combat, ton butin, « Revoir » (vitesses ×1 ×2 ×4) et « Retour au salon » ;
   - PC 1280 px et téléphone 390 px, sans défilement de côté ni erreur console.
   Lancer : node tests/bureau_direct.test.js (SHOTS=dossier pour garder des captures) */
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

/* un salon de 4 joueurs dont le combat (joué par le « serveur ») vient de partir */
function setup() {
  const E = window.ENGINE, BC = E.BUREAU, ON = window.ONLINE, DX = window.DX, S = DX.S;
  E.monoStart(S); E.monoBoot(S); const me = S.chars[0]; me.lvl = 32; E.autoAllocate(S, me); E.refreshSpells(me, E.charStats(S, me));
  const pal = (n, cls) => { const T = E.monoStart(E.newState(n, cls)); const c = T.chars[0]; c.name = n; c.lvl = 32; E.autoAllocate(T, c); E.refreshSpells(c, E.charStats(T, c)); return Object.assign(E.monoSnap(T, c), { merc: 0 }); };
  const snaps = [Object.assign(E.monoSnap(S, me), { merc: 0 }), pal("Krokette", "iop"), pal("Lunaia", "eni"), pal("Tirelame", "cra")];
  const did = "cour_bouftou_royal", stasis = 2, seed = 777, at = Date.now() - 4000;
  const R = BC.run(JSON.parse(JSON.stringify(snaps)), did, stasis, seed, null, at);
  const U = (k) => "00000000-0000-0000-0000-00000000000" + k;
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  const membres = [me.name, "Krokette", "Lunaia", "Tirelame"].map((p, i) => ({ user: U(i + 1), pseudo: p, pret: true, present: true, venu: true, chef: i === 0, moi: i === 0, ok: true }));
  const st = { saison: 1, bloque: null, spectateur: false, recherche: null, compteurs: { total: 3, donjons: {} }, invitations: [], manquees: [], butins: [],
    salon: { id: 10, etat: "ouvert", did, stasis, cle: BC.cle(did), public: false, remplacants: false, chef: U(1), titulaire: U(1), provisoire: false, cree: iso(-300000), attente_fin: iso(-100000), seq: 1, membres, invites: [], combat: null,
      journal: [{ t: "Salon formé à 4 joueurs.", at: iso(-300000) }], msgs: [{ id: 1, p: "Krokette", b: "On y va !", at: iso(-60000), moi: false }] } };
  const F = (window.__BD = { st, R, snaps, did, stasis, seed, at, calls: [] });
  /* lance le combat : il a commencé il y a « depuis » ms */
  F.lancer = (id, depuis) => {
    const x = st.salon; x.etat = "combat";
    x.combat = { id, etat: "fini", did, stasis, membres, snaps: JSON.stringify(snaps), seed, at, debut: iso(-depuis), fin: iso(R.t - depuis), duree: R.t, win: R.done };
    st.butins = [{ combat: id, did, stasis, fin: x.combat.fin, win: R.done }];
  };
  ON.enabled = true; ON.monoOn = () => true; ON.slot = () => 4; ON.user = { id: U(1) };
  DX.social.onPush = async () => "ok";
  ON.rpc = async (name, a) => {
    F.calls.push([name, a || {}]);
    if (name === "mono_bureau_etat") return { data: Object.assign(JSON.parse(JSON.stringify(st)), { now: new Date().toISOString() }) };
    if (name === "mono_bureau_salons") return { data: [] };
    if (name === "mono_bureau_dire") { st.salon.msgs.push({ id: st.salon.msgs.length + 1, p: me.name, b: a.p_txt, at: iso(0), moi: true }); return { data: { ok: true } }; }
    if (name === "mono_bureau_butin") { const c = st.salon.combat; st.butins = []; return { data: { ok: true, combat: c.id, did, stasis, seed, win: R.done, result: JSON.stringify(BC.resume(R)), ids: [U(2), U(3), U(4)] } }; }
    return { data: { ok: true } };
  };
  return { t: R.t, done: R.done, rooms: R.rooms.length };
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  const open = async (w, hh) => {
    const page = await browser.newPage({ viewport: { width: w, height: hh } });
    await page.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(() => { window.__IDLUS_OFFLINE = true; });
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} px, console : ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${w} px, exception : ${e.message}`));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await page.click('[data-act="startgame"]');
    await page.waitForSelector("#nav [data-nk]", { timeout: 10000, state: "attached" });
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: ".wtip{display:none!important}" });
    return page;
  };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  const noScroll = async (page, what) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (w[0] > w[1] + 1) fail(`${what} : la page défile de côté (${w[0]} px pour ${w[1]})`); };
  const refresh = async (page) => { await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(300); };
  try {
    for (const [dev, w, hh] of [["pc", 1280, 800], ["tel", 390, 844]]) {
      const page = await open(w, hh);
      const info = await page.evaluate(setup);
      if (!(info.rooms > 0 && info.t > 10000)) fail(`${dev} : combat d'essai trop court ${JSON.stringify(info)}`);

      if (dev === "pc") {
        /* même combat que le serveur, seconde par seconde, même si la partie du joueur avance entre deux pas */
        const same = await page.evaluate(() => {
          const F = window.__BD, BC = window.ENGINE.BUREAU, BD = window.BureauDirect, E = window.ENGINE, S = window.DX.S;
          const c = { id: 1, snaps: JSON.stringify(F.snaps), did: F.did, stasis: F.stasis, seed: F.seed, at: F.at };
          const V = BC.voir(F.snaps, F.did, F.stasis, F.seed, F.at); const W = BD.lecture(c);
          E.startHunt(S, Object.keys(E.SUBS)[0]);
          for (let i = 0; i < V.frames.length; i++) {
            if (i % 3 === 0) { delete S.mono.live; E.tick(S, 3000, 3000); } // la partie du joueur joue avec son propre hasard
            BD.pas(W); const f = V.frames[i], G = W.S2.fight;
            const a = JSON.stringify(f.ents.map((e) => e.hp)), b = JSON.stringify(G ? G.ents.filter((e) => !e.summon).map((e) => Math.max(0, Math.round(e.hp))) : []);
            if (a !== b) return `seconde ${i + 1} : ${a} / ${b}`;
          }
          if (!W.done || W.t !== V.R.t) return `fin : ${W.t}/${V.R.t}, ${W.salles} salles / ${V.R.rooms.length}, fini ${W.done}`;
          const st = BD.stats(W); if (st.length !== 4 || !st.some((x) => x.d > 0)) return "tableau du groupe vide";
          return "";
        });
        if (same) fail("combat rejoué différent de celui du serveur : " + same);
      }

      /* 3A : sur la page du Bureau, l'écran de combat s'ouvre tout seul, à la bonne seconde */
      await page.evaluate(() => window.DX.go("bureau")); await refresh(page);
      await page.evaluate(() => window.__BD.lancer(5, 20000)); await refresh(page); await page.waitForTimeout(1600);
      let st = await page.evaluate(() => { const w = window.DX.ui.watch; return { tab: window.DX.ui.tab, ext: !!(w && w.ext && w.ext.direct), t: w ? w.W.t : 0, arena: !!document.querySelector("#arena .ent"), live: !!document.querySelector(".bxd-live"), meter: (document.getElementById("bxdMeter") || {}).textContent || "", chat: !!document.getElementById("bxSay"), prog: document.querySelectorAll("#bxdProg i").length, me: document.querySelectorAll(".bxd-mr.me").length }; });
      if (!st.ext || st.tab !== "combat") fail(`${dev} : l'écran de combat ne s'ouvre pas tout seul sur la page du Bureau ${JSON.stringify(st)}`);
      if (!(st.t >= 16000 && st.t <= 24000)) fail(`${dev} : le combat ne reprend pas à la bonne seconde (${st.t} ms au lieu d'environ 20 000)`);
      if (!st.arena || !st.live || !st.chat || st.prog < 2) fail(`${dev} : écran incomplet ${JSON.stringify(st)}`);
      if (!/Krokette/.test(st.meter) || st.me !== 1) fail(`${dev} : Tableau du groupe ${JSON.stringify(st)}`);
      await page.waitForTimeout(1500);
      await noScroll(page, `${dev}, combat en direct`);
      await shot(page, `direct-${dev}.png`);
      if (dev === "tel") { await page.evaluate(() => document.getElementById("bxdMeter").scrollIntoView()); await shot(page, `direct-tableau-${dev}.png`); await page.evaluate(() => window.scrollTo(0, 0)); }
      /* discussion du salon à côté du combat */
      await page.fill("#bxSay", "Bien joué !"); await page.press("#bxSay", "Enter"); await page.waitForTimeout(400); await refresh(page); await page.waitForTimeout(1200);
      if (!/Bien joué/.test((await page.textContent("#bxChat")) || "")) fail(`${dev} : message de la discussion absent de l'écran de combat`);

      /* fin du combat : résultat, butin, Revoir, Retour au salon */
      await page.evaluate(() => { const c = window.__BD.st.salon.combat; const d = c.duree + 1500; c.debut = new Date(Date.now() - d).toISOString(); c.fin = new Date(Date.now() - 1500).toISOString(); window.__BD.st.butins[0].fin = c.fin; });
      await refresh(page); await page.waitForTimeout(2500); await refresh(page); await page.waitForTimeout(1500);
      const end = await page.evaluate(() => ({ dbg: (() => { const w = window.DX.ui.watch; return w ? { t: w.W.t, done: w.W.done, timer: !!w.timer, tab: window.DX.ui.tab, ext: !!w.ext } : { none: true, tab: window.DX.ui.tab }; })(), txt: (document.getElementById("watchEnd") || {}).textContent || "", done: !!(window.DX.ui.watch && window.DX.ui.watch.W.done), gain: window.Bureau.gain(5) }));
      if (!end.done || !/Victoire|Défaite/.test(end.txt) || !/Revoir le combat/.test(end.txt) || !/Retour au salon/.test(end.txt)) fail(`${dev} : fin du combat ${JSON.stringify(end).slice(0, 300)}`);
      if (end.gain && !/Ton butin/.test(end.txt)) fail(`${dev} : butin reçu mais absent de la fin du combat : ${end.txt}`);
      if (!end.gain) fail(`${dev} : butin pas récupéré`);
      await page.evaluate(() => { document.getElementById("watchEnd").scrollIntoView({ block: "center" }); const b = document.querySelector('[data-act="bxd-revoir"]').getBoundingClientRect(), a = document.querySelector(".arenasticky").getBoundingClientRect(); if (b.top < a.bottom + 8) window.scrollBy(0, b.top - a.bottom - 16); }); await shot(page, `fin-${dev}.png`); // au téléphone, l'arène reste collée en haut : on amène le bouton juste en dessous
      await page.click('[data-act="bxd-revoir"]'); await page.waitForTimeout(1200);
      st = await page.evaluate(() => { const w = window.DX.ui.watch; return { revoir: !!(w && w.ext && !w.ext.direct), spd: document.querySelectorAll('[data-act="sm-wspd"]').length, t: w ? w.W.t : -1 }; });
      if (!st.revoir || st.spd !== 3 || st.t > 6000) fail(`${dev} : « Revoir » ${JSON.stringify(st)}`);
      await page.click('[data-act="sm-wquit"]'); await page.waitForTimeout(500);
      if ((await page.evaluate(() => window.DX.ui.tab)) !== "bureau" || await page.evaluate(() => !!window.DX.ui.watch)) fail(`${dev} : « Retour au salon » ne ramène pas au Bureau`);

      /* 3A : ailleurs dans le jeu, le bandeau ; « Plus tard » le ferme, « Regarder » ouvre le combat */
      await page.evaluate(() => window.DX.go("home")); await page.waitForTimeout(300);
      await page.evaluate(() => window.__BD.lancer(6, 8000)); await refresh(page); await page.waitForTimeout(1300);
      if ((await page.evaluate(() => window.DX.ui.tab)) !== "home") fail(`${dev} : le combat s'ouvre tout seul hors de la page du Bureau`);
      if (!(await page.$("#bxdBan [data-act=bxd-voir]"))) fail(`${dev} : bandeau « Ton groupe combat » absent`);
      const box = await page.evaluate(() => { const r = document.querySelector("#bxdBan").getBoundingClientRect(); return [r.left, r.right]; });
      if (box[0] < 0 || box[1] > w) fail(`${dev} : bandeau hors de l'écran ${box}`);
      await shot(page, `bandeau-${dev}.png`);
      await page.click("#bxdBan [data-act=bxd-tard]"); await page.waitForTimeout(1200);
      if (await page.$("#bxdBan")) fail(`${dev} : « Plus tard » ne ferme pas le bandeau`);
      await page.evaluate(() => window.__BD.lancer(7, 5000)); await refresh(page); await page.waitForTimeout(1300);
      await page.click("#bxdBan [data-act=bxd-voir]"); await page.waitForTimeout(800);
      st = await page.evaluate(() => { const w = window.DX.ui.watch; return { ext: !!(w && w.ext && w.ext.direct), id: w && w.ext && w.ext.combat, ban: !!document.getElementById("bxdBan") }; });
      if (!st.ext || st.id !== 7 || st.ban) fail(`${dev} : « Regarder » ${JSON.stringify(st)}`);
      /* série (×N) : le combat 7 se termine, le suivant (8) se lance tout seul et l'écran le suit */
      await page.evaluate(() => { const c = window.__BD.st.salon.combat; c.debut = new Date(Date.now() - c.duree - 1000).toISOString(); }); await refresh(page); await page.waitForTimeout(2500);
      await page.evaluate(() => { window.__BD.lancer(8, 1000); Object.assign(window.__BD.st.salon.combat, { serie_id: 7, serie_k: 2, serie_n: 3 }); window.__BD.st.salon.serie_id = 7; }); await refresh(page); await page.waitForTimeout(1500);
      st = await page.evaluate(() => { const w = window.DX.ui.watch; return { id: w && w.ext && w.ext.combat, k: /combat 2 \/ 3/.test(document.querySelector(".combathead").textContent), stop: !!document.querySelector('.combathead [data-act="bx-sstop"]') }; });
      if (st.id !== 8 || !st.k || !st.stop) fail(`${dev} : série, l'écran ne suit pas le combat suivant ${JSON.stringify(st)}`);
      /* la page du Bureau garde le résumé et le bouton */
      await page.click('[data-act="sm-wquit"]'); await page.waitForTimeout(500); await refresh(page); await page.waitForTimeout(1100);
      if (!(await page.$('#bxView [data-act="bxd-voir"]'))) fail(`${dev} : bouton « Regarder le combat » absent du Bureau`);
      /* onglet qui clignote : le titre change quand la page est cachée */
      const blink = await page.evaluate(async () => { const c = window.Bureau.etat().salon.combat; window.__dbg = [c && c.id, c && c.etat, c && (window.Bureau.heure() - Date.parse(c.debut)), c && c.duree, window.DX.ui.tab, !!window.DX.ui.watch]; const t0 = document.title; Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); let seen = ""; for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 300)); if (/Ton groupe/.test(document.title)) seen = document.title; } delete document.hidden; await new Promise((r) => setTimeout(r, 1200)); return [t0, seen, document.title]; });
      if (!/Ton groupe combat/.test(blink[1]) && !/Ton groupe combat/.test(blink[0])) fail(`${dev} : l'onglet ne clignote pas ${JSON.stringify(blink)} ${JSON.stringify(await page.evaluate(() => window.__dbg))}`);
      if (/Ton groupe combat/.test(blink[2])) fail(`${dev} : titre de l'onglet pas rendu ${JSON.stringify(blink)}`);
      await noScroll(page, `${dev}, Bureau`);
      await page.close();
    }
  } catch (e) { fail("exception : " + (e && e.stack || e)); }
  await browser.close(); server.close();
  if (errors.length) { console.error("ÉCHEC bureau_direct :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log("ok - combat de groupe en direct sur l'écran de combat (même combat que le serveur, 3A, discussion, Tableau du groupe, fin, Revoir, bandeau, onglet), PC et téléphone");
})();
