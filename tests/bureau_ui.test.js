/* Bureau des Aventuriers (js/bureau.js) dans le navigateur, avec un faux serveur Monocompte (les fonctions mono_bureau_* et la
   route { bureau } de la fonction « mono » simulées dans la page ; aucune requête ne sort) : entrée du menu seulement en
   Monocompte, recherche, bandeau d'invitation (60 s), salon, discussion, transition (sauvegarde puis confirmation), combat
   regardé ensemble en direct, héros « en groupe » pendant le combat (activités solo arrêtées, Sablier coupé), butin une seule
   fois, Bureau.inviter, règle du défi 12, PC 1280 px et téléphone 390 px, sans erreur console.
   Le combat rejoué par le navigateur (tous les fichiers du jeu) est comparé à celui de la fonction serveur (fichiers de
   tools/build_server.js, joués ici par Node) : mêmes photos, même graine, même heure de lancement = même combat.
   Lancer : node tests/bureau_ui.test.js (SHOTS=dossier pour garder des captures) */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const GV = /const GAME_VERSION = "([\d.]+)"/.exec(fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"))[1]; // version du jeu, envoyée par le Bureau
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

/* le moteur de la fonction serveur « mono » : les mêmes fichiers que tools/build_server.js */
const serverBC = () => {
  const src = fs.readFileSync(path.join(ROOT, "tools/build_server.js"), "utf8");
  const list = (n) => JSON.parse(src.match(new RegExp(`const ${n} = (\\[[^\\]]*\\])`))[1]);
  for (const f of list("FILES").concat(list("MONO"))) require(path.join(ROOT, "js", f + ".js"));
  return require(path.join(ROOT, "js/bureau_combat.js"));
};

/* faux serveur Monocompte, installé dans la page */
function fake() {
  const E = window.ENGINE, BC = E.BUREAU, ON = window.ONLINE, DX = window.DX;
  const F = (window.__BX = { calls: [], invoke: [] });
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  const U1 = "00000000-0000-0000-0000-000000000001", U2 = "00000000-0000-0000-0000-000000000002";
  const st = { saison: 1, bloque: null, spectateur: false, recherche: null, compteurs: { total: 3, donjons: {} }, invitations: [], manquees: [], butins: [], salon: null };
  F.st = st;
  const snap = () => Object.assign(JSON.parse(JSON.stringify(st)), { now: new Date().toISOString() });
  const ok = (o) => ({ data: Object.assign(snap(), { ok: true }, o || {}) });
  ON.enabled = true; ON.monoOn = () => true; ON.slot = () => 4; ON.user = { id: U1 };
  DX.social.onPush = async () => { F.pushes = (F.pushes || 0) + 1; return "ok"; };
  ON.rpc = async (name, a) => {
    F.calls.push([name, a || {}]);
    const x = st.salon;
    switch (name) {
      case "mono_bureau_etat": return { data: snap() };
      case "mono_bureau_salons": return { data: [{ id: 3, etat: "ouvert", did: "crypte_kardorim", stasis: 1, chef: "Alice", n: 2, pseudos: ["Alice", "Zoé"] }] };
      case "mono_bureau_expeditions": return { data: [] };
      case "mono_bureau_rdv": return { data: { actif: false, creneaux: [] } };
      case "mono_bureau_chercher": st.invitations = [{ id: 1, salon: 10, quoi: "auto", did: a.p_donjons[0], stasis: a.p_stasis, expire: iso(60000), membres: ["Bob"] }]; return ok();
      case "mono_bureau_repondre": {
        const i = st.invitations[0]; st.invitations = []; if (!a.p_oui) return ok();
        st.salon = { id: 10, etat: "ouvert", did: i.did, stasis: i.stasis, cle: BC.cle(i.did), public: false, remplacants: false, chef: U1, titulaire: U1, provisoire: false, cree: iso(0), attente_fin: iso(120000), seq: 1, serie: 1, serie_id: null, serie_stop: null,
          membres: [{ user: U1, pseudo: "Moi", pret: false, present: true, venu: true, chef: true, moi: true }, { user: U2, pseudo: "Bob", pret: true, present: true, venu: true, chef: false, moi: false }],
          invites: [], combat: null, journal: [{ t: "Salon formé à 2 joueurs.", at: iso(0) }], msgs: [] };
        return ok();
      }
      case "mono_bureau_pret": x.membres[0].pret = !!a.p_on; return ok();
      case "mono_bureau_dire": x.msgs.push({ id: x.msgs.length + 1, p: "Moi", b: a.p_txt, at: iso(0), moi: true }); return { data: { ok: true } };
      case "mono_bureau_lancer": x.etat = "transition"; x.combat = { id: 5, etat: "transition", did: x.did, stasis: x.stasis, transition_fin: iso(60000), membres: [{ user: U1, pseudo: "Moi", ok: false }, { user: U2, pseudo: "Bob", ok: true }] }; return ok({ combat: 5 });
      case "mono_bureau_confirmer": x.combat.membres[0].ok = true; x.combat.etat = "calcul"; return ok({ calcul: true, combat: 5 });
      case "mono_bureau_butin": {
        F.pris = F.pris || {}; if (F.pris[a.p_combat]) return { data: { err: "Butin déjà récupéré." } }; F.pris[a.p_combat] = true; st.butins = st.butins.filter((b) => b.combat !== a.p_combat);
        const c = x.combat;
        return { data: { ok: true, combat: a.p_combat, did: c.did, stasis: c.stasis, seed: c.seed, win: c.win, result: JSON.stringify(BC.resume(F.R)), ids: [U2], serie_id: c.serie_id || null, serie_k: c.serie_k || 1, serie_n: c.serie_n || 1 } };
      }
      case "mono_bureau_serie": { // le serveur refuse hors de 1 à 10 et pour un membre qui n'est pas chef
        if (x.chef !== U1) return { data: { err: "Seul le chef choisit le nombre de combats." } };
        if (!(Number.isInteger(a.p_n) && a.p_n >= 1 && a.p_n <= 10)) return { data: { err: "De 1 à 10 combats à la suite." } };
        if (a.p_n !== x.serie) { x.serie = a.p_n; x.membres.forEach((m) => (m.pret = false)); } return ok();
      }
      case "mono_bureau_serie_arreter": x.serie_stop = "Moi a demandé l'arrêt"; return ok();
      case "mono_bureau_inviter": return ok();
      default: return { err: "inconnu : " + name };
    }
  };
  /* la fonction « mono » : photos (ici : le héros de la page et un second héros), graine, heure du lancement, combat joué d'un coup */
  ON.db = () => ({ functions: { invoke: async (fn, o) => {
    F.invoke.push([fn, o && o.body]);
    const x = st.salon, c = x.combat, S = DX.S, h = S.chars.find((y) => !y.merc);
    const T = E.monoStart(E.newState("Bob", "eni")); T.chars[0].lvl = h.lvl; E.autoAllocate(T, T.chars[0]);
    const snaps = [Object.assign(E.monoSnap(S, h), { merc: 0 }), Object.assign(E.monoSnap(T, T.chars[0]), { merc: 0 })];
    const at = Date.now() - 5000, seed = 4242;
    F.R = BC.run(JSON.parse(JSON.stringify(snaps)), c.did, c.stasis, seed, null, at);
    Object.assign(c, { etat: "fini", snaps: JSON.stringify(snaps), seed, at, debut: iso(0), fin: iso(F.R.t), duree: F.R.t, win: F.R.done });
    x.etat = "combat"; st.butins = [{ combat: 5, did: c.did, stasis: c.stasis, fin: c.fin, win: c.win }];
    return { data: { ok: true, combat: 5 } };
  } } });
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [], fail = (m) => errors.push(m);
  const SHOTS = process.env.SHOTS;
  const browser = await chromium.launch();
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
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
  const clean = (page) => page.evaluate(() => { document.querySelector("#sheet").innerHTML = ""; const c = document.querySelector("#cele"); if (c) c.innerHTML = ""; });
  const go = (page) => page.evaluate(() => window.DX.go("bureau"));
  const noScroll = async (page, what) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (w[0] > w[1] + 1) fail(`${what} : la page défile de côté (${w[0]} px pour ${w[1]})`); };
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n) }); };
  try {
    const page = await open(1280, 800);
    // Classique : pas d'entrée Bureau
    await page.waitForTimeout(2300);
    if (await page.evaluate(() => window.DX.NAV.some((F) => F.pages.some((p) => p[0] === "bureau")))) fail("Classique : entrée Bureau dans le menu");
    // partie Monocompte, hors ligne : l'entrée apparaît, la page explique
    await page.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); const c = S.chars[0]; c.lvl = 40; E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c)); window.DX.render(); });
    await page.waitForTimeout(2300);
    if (!(await page.evaluate(() => window.DX.NAV.find((F) => F.id === "av").pages.some((p) => p[0] === "bureau")))) fail("Monocompte : pas d'entrée Bureau dans le menu Aventure");
    await go(page); await clean(page);
    let txt = await page.textContent("#main");
    if (!/Bureau des Aventuriers/.test(txt) || !/Hors ligne/.test(txt)) fail("hors ligne : message absent : " + txt.slice(0, 200));
    // en ligne (faux serveur)
    await page.evaluate(fake);
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(400); await go(page); await page.waitForTimeout(300);
    txt = await page.textContent("#main");
    if (!/Jouer maintenant/.test(txt) || !/Salons ouverts/.test(txt) || !/Alice/.test(txt)) fail("onglet Jouer maintenant incomplet : " + txt.slice(0, 300));
    await shot(page, "bureau-jouer-pc.png");
    // recherche → invitation (bandeau 60 s) → salon
    await page.click('[data-act="bx-go"]'); await page.waitForTimeout(300);
    const ch = await page.evaluate(() => window.__BX.calls.find((c) => c[0] === "mono_bureau_chercher"));
    if (!ch || !ch[1].p_donjons.length || ch[1].p_version !== GV || !ch[1].p_appareil || !ch[1].p_onglet) fail("recherche : paramètres " + JSON.stringify(ch));
    if (!(await page.$("#bxInv [data-act=bx-oui]"))) fail("bandeau d'invitation absent");
    if (!/Bob/.test((await page.textContent("#bxInv")) || "")) fail("bandeau : joueurs de l'invitation");
    await page.click("#bxInv [data-act=bx-oui]"); await page.waitForTimeout(400);
    if (await page.$("#bxInv")) fail("bandeau resté après la réponse");
    txt = await page.textContent("#main");
    if (!/Bob/.test(txt) || !/Quitter le salon/.test(txt) || !/Lancer le combat/.test(txt)) fail("salon : " + txt.slice(0, 300));
    // discussion
    await page.fill("#bxSay", "On y va ?"); await page.press("#bxSay", "Enter"); await page.waitForTimeout(300);
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(300);
    if (!/On y va \?/.test(await page.textContent("#bxChat"))) fail("discussion : message absent");
    // prêt, lancement, transition (sauvegarde validée puis confirmation), calcul par la fonction serveur
    await page.click('[data-act="bx-pret"]'); await page.waitForTimeout(300);
    const solo = await page.evaluate(() => { const { E, S } = window.DX; const sid = Object.keys(E.SUBS)[0]; E.startHunt(S, sid); return !!S.hunting; });
    await page.click('[data-act="bx-lancer"]'); await page.waitForTimeout(2500);
    const st1 = await page.evaluate(() => ({ push: window.__BX.pushes || 0, conf: window.__BX.calls.some((c) => c[0] === "mono_bureau_confirmer"), inv: window.__BX.invoke, live: window.DX.S.mono.live || 0 }));
    if (!st1.push || !st1.conf) fail("transition : sauvegarde puis confirmation attendues " + JSON.stringify(st1));
    if (st1.inv.length !== 1 || st1.inv[0][0] !== "mono" || !st1.inv[0][1].bureau || st1.inv[0][1].bureau.combat !== 5 || Object.keys(st1.inv[0][1].bureau).length !== 1) fail("la fonction serveur reçoit seulement le numéro du combat (jamais de photo) : " + JSON.stringify(st1.inv));
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(600);
    // combat regardé en direct ; le héros est « en groupe »
    const fight = await page.evaluate(() => { const { E, S } = window.DX; const v = document.querySelector("#bxView"); const x0 = JSON.stringify([S.chars[0].xp, S.kamas, S.hunting && S.hunting.kills]);
      E.tick(S, 60000, 60000); return { html: v ? v.innerHTML : "", live: S.mono.live, now: Date.now(), sab: E.sabSpend(S, 1000), same: x0 === JSON.stringify([S.chars[0].xp, S.kamas, S.hunting && S.hunting.kills]) }; });
    if (!/bx-fight|Salle/.test(fight.html)) fail("écran du combat absent : " + fight.html.slice(0, 200));
    if (!(fight.live > fight.now)) fail("héros pas marqué « en groupe » pendant le combat");
    if (fight.sab !== 1) fail("Sablier pas coupé pendant le combat de groupe");
    if (solo && !fight.same) fail("activités solo pas arrêtées pendant le combat de groupe");
    await shot(page, "bureau-combat-pc.png");
    // même combat dans le navigateur et dans la fonction serveur
    const cmp = await page.evaluate(() => { const c = window.__BX.st.salon.combat, BC = window.ENGINE.BUREAU; return { snaps: c.snaps, did: c.did, stasis: c.stasis, seed: c.seed, at: c.at, R: BC.resume(BC.voir(c.snaps, c.did, c.stasis, c.seed, c.at).R) }; });
    const SB = serverBC(); const RS = SB.resume(SB.voir(cmp.snaps, cmp.did, cmp.stasis, cmp.seed, cmp.at).R);
    if (JSON.stringify(RS) !== JSON.stringify(cmp.R)) fail(`combat différent entre le navigateur et la fonction serveur : ${JSON.stringify(cmp.R).slice(0, 200)} / ${JSON.stringify(RS).slice(0, 200)}`);
    // fin du combat : butin récupéré une seule fois, activités solo reprises
    const before = await page.evaluate(() => { const S = window.DX.S; return { xp: S.chars[0].xp, lvl: S.chars[0].lvl, k: S.kamas }; });
    await page.evaluate(() => { const c = window.__BX.st.salon.combat; c.debut = new Date(Date.now() - c.duree - 2000).toISOString(); c.fin = new Date(Date.now() - 1000).toISOString(); window.__BX.st.butins[0].fin = c.fin; window.__BX.st.salon.etat = "ouvert"; });
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(800);
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(500);
    const after = await page.evaluate(() => { const S = window.DX.S; return { xp: S.chars[0].xp, lvl: S.chars[0].lvl, k: S.kamas, pris: !!(S.mono.gpris && S.mono.gpris[5]), live: S.mono.live || 0, n: window.__BX.calls.filter((c) => c[0] === "mono_bureau_butin").length, view: (document.querySelector("#bxView") || {}).textContent || "" }; });
    if (!after.pris || after.n !== 1) fail("butin : " + JSON.stringify(after));
    if (after.live) fail("le héros reste « en groupe » après le combat");
    if (!(after.xp !== before.xp || after.lvl !== before.lvl || after.k !== before.k) && (await page.evaluate(() => window.__BX.R.rooms.length))) fail("butin : rien reçu");
    if (!/Victoire|Défaite/.test(after.view)) fail("résultat du combat absent : " + after.view);
    // série : le chef choisit ×1, ×5, ×10 ou un nombre libre (1 à 10) ; les autres voient le choix
    await page.evaluate(() => { const x = window.__BX.st.salon; x.etat = "ouvert"; }); await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(400);
    const sb = await page.evaluate(() => { const b = document.querySelector(".bx-serie"); return b ? { txt: b.textContent, btn: [...b.querySelectorAll("[data-act=bx-serie]")].map((e) => e.textContent) } : null; });
    if (!sb || !/Enchaîner/.test(sb.txt) || !["×1", "×5", "×10"].every((t) => sb.btn.includes(t))) fail("série : choix ×1, ×5, ×10 absent : " + JSON.stringify(sb));
    await page.click('.bx-serie [data-act="bx-serie"][data-v="5"]'); await page.waitForTimeout(400);
    if (!/5 combats à la suite/.test(await page.textContent(".bx-serie"))) fail("série ×5 pas affichée");
    await page.click('.bx-serie [aria-label="Un combat de plus"]'); await page.waitForTimeout(400);
    const sc = await page.evaluate(() => window.__BX.calls.filter((c) => c[0] === "mono_bureau_serie").map((c) => c[1].p_n));
    if (JSON.stringify(sc) !== "[5,6]") fail("série : appels au serveur " + JSON.stringify(sc));
    await page.evaluate(() => { window.__BX.st.salon.serie = 10; }); await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(400);
    if (!(await page.evaluate(() => document.querySelector('.bx-serie [aria-label="Un combat de plus"]').disabled))) fail("série : « + » actif au plafond de 10");
    await page.evaluate(() => { const x = window.__BX.st.salon; x.serie = 3; x.chef = "00000000-0000-0000-0000-000000000002"; }); await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(400);
    const sm = await page.evaluate(() => { const b = document.querySelector(".bx-serie"); return b ? { txt: b.textContent, n: b.querySelectorAll("[data-act=bx-serie]").length } : null; });
    if (!sm || sm.n || !/×3/.test(sm.txt) || !/Choisi par le chef/.test(sm.txt)) fail("série vue d'un membre : " + JSON.stringify(sm));
    await page.evaluate(() => { window.__BX.st.salon.chef = "00000000-0000-0000-0000-000000000001"; });
    // série en cours : « Combat 1 / 3 », arrêt après ce combat, cumul du butin
    const serie = () => { const B = window.__BX, x = B.st.salon, c0 = x.combat, t = Date.now();
      x.combat = Object.assign({}, c0, { id: 6, serie_id: 6, serie_k: 1, serie_n: 3, serie_bilan: [], win: true, debut: new Date(t).toISOString(), fin: new Date(t + c0.duree).toISOString() }); x.etat = "combat"; x.serie_id = 6; x.serie_stop = null;
      B.st.butins = [{ combat: 6, did: c0.did, stasis: c0.stasis, fin: x.combat.fin, win: true }]; };
    await page.evaluate(serie); await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(800);
    const sv = await page.evaluate(() => ({ view: (document.querySelector("#bxView") || {}).textContent || "", main: document.querySelector("#main").textContent, stop: !!document.querySelector("[data-act=bx-sstop]") }));
    if (!/Combat 1 \/ 3/.test(sv.view) || !/Série en cours/.test(sv.main) || !sv.stop) fail("série en cours : " + JSON.stringify(sv).slice(0, 300));
    await shot(page, "bureau-serie-pc.png");
    await page.evaluate(() => { const B = window.__BX, c = B.st.salon.combat; c.debut = new Date(Date.now() - c.duree - 2000).toISOString(); c.fin = new Date(Date.now() - 1000).toISOString(); B.st.butins[0].fin = c.fin; });
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(800); await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(500);
    const sf = await page.evaluate(() => ({ view: (document.querySelector("#bxView") || {}).textContent || "", n: window.__BX.calls.filter((c) => c[0] === "mono_bureau_butin" && c[1].p_combat === 6).length, pris: !!window.DX.S.mono.gpris[6] }));
    if (sf.n !== 1 || !sf.pris) fail("série : butin du combat 1 / 3 pris une fois " + JSON.stringify(sf));
    if (!/Butin de la série \(1 combat\)/.test(sf.view) || !/combat suivant se lance tout seul/.test(sf.view)) fail("série : cumul du butin et suite : " + sf.view.slice(0, 300));
    await page.click("[data-act=bx-sstop]"); await page.waitForTimeout(400);
    if (!(await page.evaluate(() => window.__BX.calls.some((c) => c[0] === "mono_bureau_serie_arreter")))) fail("série : « Arrêter après ce combat »");
    if (!/arrêt après ce combat/.test(await page.textContent("#main"))) fail("série : arrêt demandé pas affiché");
    await page.evaluate(() => { const x = window.__BX.st.salon; x.serie_id = null; x.serie_stop = null; x.etat = "ouvert"; x.combat.serie_k = 1; x.combat.serie_bilan = [{ k: 1, win: x.combat.win }]; });
    await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(500);
    if (!/Série (terminée|arrêtée)/.test(await page.textContent("#bxView"))) fail("série : bilan de fin absent");
    await noScroll(page, "PC, série");
    // Bureau.inviter (page des amis) et règle du défi 12
    const inv = await page.evaluate(async () => { await window.Bureau.inviter("00000000-0000-0000-0000-000000000003"); return window.__BX.calls.filter((c) => c[0] === "mono_bureau_inviter").map((c) => c[1]); });
    if (inv.length !== 1 || inv[0].p_user !== "00000000-0000-0000-0000-000000000003") fail("Bureau.inviter : " + JSON.stringify(inv));
    const d12 = await page.evaluate(() => window.Bureau.d12());
    if (!d12 || d12.manche !== 4 || !/joueur différent/.test(d12.texte)) fail("Bureau.d12 : " + JSON.stringify(d12));
    // onglets Expéditions et Rendez-vous
    await page.evaluate(() => { window.__BX.st.salon = null; }); await page.evaluate(() => window.Bureau.actualiser()); await page.waitForTimeout(300);
    await page.click('[data-act="bx-tab"][data-v="exp"]'); await page.waitForTimeout(300);
    if (!/Annoncer une expédition/.test(await page.textContent("#main"))) fail("onglet Expéditions");
    await page.click('[data-act="bx-tab"][data-v="rdv"]'); await page.waitForTimeout(300);
    if (!/Pas de rendez-vous/.test(await page.textContent("#main"))) fail("onglet Rendez-vous (désactivé)");
    await noScroll(page, "PC");
    await page.close();

    // téléphone : salon et bandeau d'invitation à 390 px
    const tel = await open(390, 844);
    await tel.evaluate(() => { const { E, S } = window.DX; E.monoStart(S); E.monoBoot(S); window.DX.render(); });
    await tel.evaluate(fake);
    await tel.waitForTimeout(2300); await go(tel); await tel.evaluate(() => window.Bureau.actualiser()); await tel.waitForTimeout(400); await clean(tel);
    await noScroll(tel, "téléphone, Jouer maintenant");
    await tel.click('[data-act="bx-go"]'); await tel.waitForTimeout(300);
    const box = await tel.evaluate(() => { const r = document.querySelector("#bxInv").getBoundingClientRect(); return [r.left, r.right]; });
    if (box[0] < 0 || box[1] > 390) fail("téléphone : bandeau d'invitation hors de l'écran " + box);
    await shot(tel, "bureau-invitation-tel.png");
    await tel.click("#bxInv [data-act=bx-oui]"); await tel.waitForTimeout(400);
    await noScroll(tel, "téléphone, salon");
    if (!(await tel.$(".bx-serie [data-act=bx-serie]"))) fail("téléphone : choix de la série absent");
    // série en cours sur téléphone (combat simulé dans le faux serveur)
    await tel.evaluate(() => { const B = window.__BX, x = B.st.salon, t = Date.now(); x.etat = "combat"; x.serie = 10; x.serie_id = 7;
      x.combat = { id: 7, etat: "transition", did: x.did, stasis: x.stasis, transition_fin: new Date(t + 60000).toISOString(), membres: [{ user: x.membres[0].user, pseudo: "Moi", ok: true }, { user: x.membres[1].user, pseudo: "Bob", ok: true }], serie_id: 7, serie_k: 4, serie_n: 10 }; });
    await tel.evaluate(() => window.Bureau.actualiser()); await tel.waitForTimeout(600);
    if (!/Combat 4 \/ 10/.test((await tel.textContent("#bxView")) || "")) fail("téléphone : « Combat 4 / 10 » absent");
    await noScroll(tel, "téléphone, série");
    await shot(tel, "bureau-salon-tel.png");
    await tel.close();
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC :\n - " + errors.join("\n - ")); process.exit(1); }
  console.log("ok - Bureau des Aventuriers : menu Monocompte, recherche, invitation, salon, discussion, transition, combat en direct (même combat que le serveur), héros en groupe, butin une fois, Bureau.inviter, défi 12, séries (×1/×5/×10, Combat k / N, cumul, arrêt), PC et téléphone sans erreur console");
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
