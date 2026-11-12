/* Idlus 3.0 « Un écran de jeu » (maquette validée par Mathis le 11-12/11/2026, réponses 1 à 31) :
   le combat reste au centre, les 41 pages deviennent 8 espaces + la Saison, ouverts dans un panneau à droite (PC)
   ou en plein écran avec un bandeau du combat (téléphone). D'abord en option « Essayer Idlus 3.0 » (Options › Affichage).
   Ce fichier est chargé avant js/ui.js : il n'utilise ses fonctions (NAV, S, ui, render…) qu'au moment de l'appel. */
(function () {
  const V3 = (window.V3 = {});
  let X = null; // le contexte de js/ui.js (V3.init), qui garde ses variables pour lui
  let h, fmt, fmtK, pct, med, G, hudPic, navLiveTxt, morphTo, toast, saveNow, render, renderNav, E, DUNGEONS, NAV, ui, PAGES, NAV_DESC, IC;
  V3.init = function (ctx) {
    X = ctx; ({ h, fmt, fmtK, pct, med, G, hudPic, navLiveTxt, morphTo, toast, saveNow, render, renderNav, E, DUNGEONS, NAV, ui, PAGES, NAV_DESC, IC } = ctx);
    Object.keys(XP3).forEach((k) => { if (PAGES && !PAGES[k]) PAGES[k] = (m) => { m.innerHTML = XP3[k].html(); }; if (NAV_DESC) NAV_DESC[k] = XP3[k].d; });
  };
  V3.on = () => !!(X && X.S && X.S.settings && X.S.settings.v3);

  /* ---------- les 8 espaces (question 3) et leurs onglets ; lvl : niveau qui ouvre l'espace (question 4) ---------- */
  const SPACES = [
    { id: "av", n: "Aventure", ic: "monde", keys: ["world", "dungeons", "asc", "exp", "defi", "chev", "xs1", "wb", "routines"] },
    { id: "he", n: "Équipe", ic: null, keys: ["team", "plan", "maitrise", "garde", "builds"] },
    { id: "sac", n: "Sac", ic: "sac", keys: ["inv", "dofus"] },
    { id: "ec", n: "Artisanat", ic: "metiers", keys: ["metiers", "forge", "grav", "comptoirs"], lvl: 5 },
    { id: "col", n: "Collection", ic: "dofus", keys: ["album", "pets", "elev", "chasse", "enc"], lvl: 10 },
    { id: "mar", n: "Marché", ic: "bourse", keys: ["cours", "boutique3", "chantier", "echanges", "hdv", "foire"], lvl: 15 },
    { id: "co", n: "Joueurs", ic: "couronne", keys: ["guild", "tour", "koli", "align", "ladder", "amis", "vote"], lvl: 20 },
    { id: "jo", n: "Journal", ic: "quetes", keys: ["quests", "succes", "carnet"] },
  ];
  V3.SPACES = SPACES;
  /* les noms courts des onglets dans la 3.0 */
  const REN = { world: "Zones", asc: "Ascension", exp: "Songe infini", defi: "Défi", wb: "Boss", chev: "Chevauchée", team: "Héros", inv: "Objets", cours: "Vendre", pets: "Compagnons", elev: "Élevage", chasse: "Champions", ladder: "Classements", tour: "Tournoi", album: "Album", hdv: "Hôtel de vente" };
  V3.ren = REN;
  let ALL = null; // les espaces complets, avant les déblocages par niveau
  const maxLvl = () => X.S.chars.reduce((a, c) => Math.max(a, c.lvl || 1), 1);
  /* les anciens comptes ont tout dès le premier passage en 3.0 (question 4) */
  V3.allOpen = () => !!(X.S && (X.S.v3all || X.S.mono));
  V3.lockOf = (F) => (!F || !F.v3lvl || V3.allOpen() || maxLvl() >= F.v3lvl ? 0 : F.v3lvl);
  /* reconstruit NAV (js/ui.js) en espaces : appelé au démarrage, après les filtres du Monocompte et de la Saison 1 */
  V3.boot = function () {
    if (!V3.on()) return;
    if (X.S.v3all == null) X.S.v3all = maxLvl() >= 20 || (X.S.stats && X.S.stats.fights > 300) ? 1 : 0;
    if (!ALL) {
      const pool = new Map(); let season = null;
      NAV.forEach((F) => { if (F.season) { season = F; return; } F.pages.forEach((p) => pool.set(p[0], p)); });
      Object.keys(XP3).forEach((k) => pool.set(k, XP3[k].nav)); // les pages propres à la 3.0
      ALL = { season, spaces: SPACES.map((s) => ({ id: s.id, n: s.n, ic: s.ic, v3lvl: s.lvl || 0, pages: s.keys.filter((k) => pool.has(k)).map((k) => { const p = pool.get(k).slice(); pool.delete(k); if (REN[k]) p[1] = REN[k]; return p; }) })) };
      const jo = ALL.spaces.find((F) => F.id === "jo"); pool.forEach((p) => jo.pages.push(p.slice())); // une page oubliée reste trouvable dans le Journal
    }
    V3.relock(true);
    document.body.classList.add("v3");
    if (!ui.v3booted) { ui.v3booted = true; if (ui.tab === "home") ui.tab = "combat"; }
    V3.mount();
  };
  let openSig = "";
  V3.relock = function (quiet) {
    if (!ALL || !V3.on()) return;
    const open = ALL.spaces.filter((F) => F.pages.length && !V3.lockOf(F));
    const sig = open.map((F) => F.id).join(",");
    if (sig === openSig) return; const was = openSig; openSig = sig;
    NAV.length = 0; if (ALL.season) NAV.push(ALL.season); open.forEach((F) => NAV.push(F));
    if (!quiet && was) { const nw = open.filter((F) => !was.split(",").includes(F.id)); nw.forEach((F) => toast(`Nouvel espace : ${F.n}`, "rare")); if (typeof renderNav === "function") renderNav(); }
  };
  V3.locked = () => (ALL ? ALL.spaces.filter((F) => F.pages.length && V3.lockOf(F)).map((F) => [F.n, F.v3lvl]) : []);

  /* ---------- l'écran : un tableau de combat au centre (questions 1, 7 à 10) ---------- */
  V3.mount = function () {
    const app = document.querySelector(".app"); if (!app) return;
    let b = document.getElementById("v3b");
    if (!b) { b = document.createElement("section"); b.id = "v3b"; b.className = "v3b"; b.setAttribute("aria-label", "Combat en direct"); app.insertBefore(b, document.getElementById("main")); }
    let band = document.getElementById("v3band");
    if (!band) { band = document.createElement("button"); band.id = "v3band"; band.className = "v3band"; band.dataset.act = "nav"; band.dataset.v = "combat"; app.insertBefore(band, document.getElementById("main")); }
  };
  V3.home = () => V3.on() && ui.tab === "combat" && !ui.v3det; // le tableau remplace la page de combat détaillée
  V3.layout = function () {
    if (!V3.on()) return; const B = document.body;
    const home = V3.home();
    B.classList.toggle("v3home", home); B.classList.toggle("v3pan", !home && ui.tab !== "combat"); B.classList.toggle("v3det", ui.tab === "combat" && !!ui.v3det);
  };
  const MOM = []; // les moments importants (question 8)
  let lossRow = 0;
  V3.ev = function (ev) {
    if (!ev || !ev.txt) return;
    const t = ev.txt;
    if (ev.kind === "loss") { lossRow++; if (lossRow >= 3) V3.alert = { k: "loss", txt: `${lossRow} défaites de suite ici : ton équipe est en difficulté.` }; }
    else if (/vaincu|Victoire/.test(t)) lossRow = 0;
    const imp = ["rare", "radiant", "up", "cele"].includes(ev.kind) || /passe niveau \d*0 !|Archimonstre|Champion|Dofus|vaincu !$/.test(t);
    if (!imp || /^Succès/.test(t)) return;
    MOM.unshift({ t: t.replace(/\s*!$/, ""), k: ev.kind === "loss" ? "loss" : ev.kind === "up" ? "up" : "rare", at: Date.now() }); if (MOM.length > 6) MOM.length = 6;
  };
  const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `il y a ${s} s` : s < 3600 ? `il y a ${Math.round(s / 60)} min` : `il y a ${Math.round(s / 3600)} h`; };
  const s0 = { at: Date.now(), k: null, f: null };
  const rate = () => { const m = Math.max(1, (Date.now() - s0.at) / 60000); if (s0.k == null) { s0.k = X.S.kamas; s0.f = (X.S.stats && X.S.stats.fights) || 0; } return { k: (X.S.kamas - s0.k) / m, f: (((X.S.stats && X.S.stats.fights) || 0) - s0.f) / m }; };
  const title = () => {
    const XP = E.expActive(X.S) ? X.S.exp : null; const dg = X.S.dungeon ? DUNGEONS[X.S.dungeon.id] : null; const sub = X.S.sub ? E.SUBS[X.S.sub] : null;
    return XP ? `Le Songe infini · ${E.SG_INT[XP.ii].name}` : dg ? dg.name : X.S.fight && X.S.fight.prot && !X.S.fight.over ? X.S.fight.label : X.S.hunting && sub ? sub.name : "Ton équipe se repose";
  };
  const bar = (p, cls) => `<i class="v3bar ${cls || ""}"><b style="width:${Math.max(0, Math.min(100, p)).toFixed(1)}%"></b></i>`;
  V3.boardHtml = function () {
    const F = X.S.fight; const team = E.team(X.S); const live = navLiveTxt();
    const ents = F && F.ents ? F.ents.filter((e) => !e.summon) : [];
    const mine = ents.filter((e) => e.side === "c"), foes = ents.filter((e) => e.side === "m");
    const sum = (L, f) => L.reduce((a, e) => a + f(e), 0);
    const ally = mine.length ? pct(sum(mine, (e) => (e.alive ? Math.max(0, e.hp) : 0)), sum(mine, (e) => e.hpMax)) : 100;
    const foe = foes.length ? pct(sum(foes, (e) => (e.alive ? Math.max(0, e.hp) : 0)), sum(foes, (e) => e.hpMax)) : 0;
    const tot = sum(mine, (e) => e.dealt || 0) || 1;
    const pin = (() => { try { const P = E.pins(X.S); if (!P.length) return null; const i = E.pinInfo(X.S, P[0]); return i ? { t: i.short || i.label, v: i.txt, p: pct(i.a, i.b), key: E.pinKey(P[0]) } : null; } catch (e) { return null; } })();
    const r = rate();
    const al = V3.alert;
    const head = `<div class="v3h"><div class="v3t"><h1>${h(title())}</h1><div class="small muted">${live ? h(live) : "Choisis une zone pour repartir chasser"}${F && !F.over ? ` · tour ${F.round}` : ""}</div></div>
      <div class="v3hb"><button class="btn sm" data-act="csetsheet">${G("gear")} Réglages du combat</button><button class="btn sm" data-act="v3det">Vue détaillée</button>${live ? "" : `<button class="btn sm primary" data-act="nav" data-v="world">Choisir une zone</button>`}</div></div>`;
    const alert = al ? `<div class="v3al" data-k="al"><span aria-hidden="true">⚠</span><span class="grow">${h(al.txt)}</span><button class="btn sm primary" data-act="nav" data-v="world">Changer de zone</button><button class="btn sm" data-act="v3alok" aria-label="Fermer">✕</button></div>` : "";
    const obj = pin ? `<button class="v3obj" data-act="pingo" data-key="${h(pin.key)}"><span class="grow"><b>Prochain objectif :</b> ${h(pin.t)}</span>${bar(pin.p, "g")}<span class="v3pill">${h(pin.v)}</span></button>` : "";
    const tugs = `<div class="v3tugs"><div class="v3tug a"><i style="width:${ally.toFixed(1)}%"></i><span>Équipe ${Math.round(ally)} %</span></div><div class="v3tug m"><i style="width:${foe.toFixed(1)}%"></i><span>Ennemis ${Math.round(foe)} %</span></div></div>`;
    const heroRows = (mine.length ? mine : team.map((c) => ({ side: "c", cid: c.id, name: c.name, cls: c.cls, hp: 1, hpMax: 1, alive: true }))).map((e) => `<div class="v3r${e.alive ? "" : " ko"}" data-k="h${e.cid}"><span class="v3p">${hudPic(e)}</span><span class="grow"><span class="v3n"><b>${h(e.name)}</b><span class="muted">${e.alive ? Math.round(pct(e.hp, e.hpMax)) + " %" : "K.O."}</span></span>${bar(pct(e.hp, e.hpMax), pct(e.hp, e.hpMax) < 30 ? "r" : "")}${bar(pct(e.dealt || 0, tot), "d")}</span></div>`).join("");
    const foeRows = foes.length ? foes.map((e, i) => `<div class="v3r${e.alive ? "" : " ko"}${e.alive && (e.boss || i === 0) ? " tg" : ""}" data-k="m${i}"><span class="v3p">${hudPic(e)}</span><span class="grow"><span class="v3n"><b>${h(e.name)}</b><span class="muted">${e.alive ? Math.round(pct(e.hp, e.hpMax)) + " %" : "vaincu"}</span></span>${bar(e.alive ? pct(e.hp, e.hpMax) : 0, "m")}</span></div>`).join("") : `<div class="small muted v3e">${live ? "Le combat suivant commence…" : "Aucun ennemi."}</div>`;
    const mom = MOM.length ? MOM.map((m, i) => `<div class="v3m ${m.k}" data-k="mo${i}"><span aria-hidden="true">${m.k === "up" ? "▲" : m.k === "loss" ? "✕" : "✦"}</span><span class="grow">${h(m.t)}</span><span class="xs muted">${ago(m.at)}</span></div>`).join("") : `<div class="small muted v3e">Les butins rares, les boss vaincus et les niveaux s'afficheront ici.</div>`;
    return `${head}${alert}${obj}${tugs}<div class="v3g"><div class="v3box"><h4>Ton équipe<small>barre fine = part des dégâts</small></h4>${heroRows}</div><div class="v3col"><div class="v3box"><h4>Ennemis</h4>${foeRows}</div><div class="v3box"><h4>Ce qui compte<small>les moments importants</small></h4>${mom}</div></div></div>
      <div class="v3k"><div><b>${fmtK(Math.max(0, r.k))}</b><span>kamas / min</span></div><div><b>${(Math.round(r.f * 10) / 10).toLocaleString("fr-FR")}</b><span>combats / min</span></div><div><b>${MOM.filter((m) => m.k === "rare").length}</b><span>butins rares</span></div><div><b>${fmt(team.length)}</b><span>héros en combat</span></div></div>`;
  };
  V3.bandHtml = function () {
    const F = X.S.fight; const live = navLiveTxt(); const ents = F && F.ents ? F.ents.filter((e) => !e.summon) : [];
    const mine = ents.filter((e) => e.side === "c"), foes = ents.filter((e) => e.side === "m");
    const s = (L) => L.reduce((a, e) => a + (e.alive ? Math.max(0, e.hp) : 0), 0) / Math.max(1, L.reduce((a, e) => a + e.hpMax, 0)) * 100;
    return `${med("combat")}<span class="grow"><b>${h(live || "Ton équipe se repose")}</b>${mine.length ? `<span class="v3bb">${bar(s(mine))}${bar(s(foes), "m")}</span>` : ""}</span><span class="v3pill">Combat ›</span>`;
  };
  let tAt = 0;
  V3.tick = function (force) {
    if (!V3.on()) return; const now = performance.now(); if (!force && now - tAt < 300) return; tAt = now;
    V3.relock(); V3.layout();
    const b = document.getElementById("v3b"), band = document.getElementById("v3band");
    if (b) { const show = V3.home() || (window.innerWidth >= 1180 && ui.tab !== "combat"); b.hidden = !show; if (show) morphTo(b, V3.boardHtml()); }
    if (band) { const show = !V3.home() && ui.tab !== "combat" && window.innerWidth < 1180; band.hidden = !show; if (show) { const x = V3.bandHtml(); if (band.dataset.h !== x) { band.dataset.h = x; band.innerHTML = x; } } }
  };
  /* barre du bas du téléphone (question 2) : Combat, Aventure, Équipe, Sac, Plus */
  V3.mobHtml = function (k, fight, famOn, famBadge, icon) {
    const F = (id) => NAV.find((x) => x.id === id);
    const mb = (F0, key) => F0 ? `<button data-act="nav" data-v="${key || F0.pages[0][0]}" data-nk="${key || F0.pages[0][0]}" ${famOn(F0) ? 'aria-current="page"' : ""}>${icon(F0.ic)}<span>${h(F0.n)}</span>${famBadge(F0)}</button>` : "";
    const on = (id) => famOn(F(id) || {});
    const rest = !fight && k !== "home" && !on("av") && !on("he") && !on("sac");
    return `<div class="sn-mob"><button class="navfight" data-act="nav" data-v="combat" data-nk="combat" ${fight ? 'aria-current="page"' : ""}>${med("combat")}<span>Combat</span></button>${mb(F("av"))}${mb(F("he"), "team")}${mb(F("sac"), "inv")}<button class="sn-menu" data-act="navmenu" data-nk="menu" ${rest ? 'aria-current="page"' : ""}><i class="sn-burger" aria-hidden="true"><b></b><b></b><b></b></i><span>Plus</span></button></div>`;
  };
  /* ---------- Plan de bataille (question 11) : posture, cible, réflexes ; Routines (question 12) : l'automatisme en un endroit ---------- */
  const FOCUS = [["auto", "Les dangereux d'abord", "Soigneurs, chefs, invocateurs et protecteurs"], ["low", "Le plus faible", "Achève vite un monstre blessé"], ["boss", "Le boss", "Tout sur le chef du groupe"], ["adds", "Les sbires d'abord", "Nettoie le groupe, puis le boss"], ["prep", "Qui prépare un coup", "Coupe le monstre qui charge une attaque"]];
  const POST_D = { as: "+12 % de dégâts infligés, +20 % de dégâts reçus. Pour les chasses faciles.", eq: "Aucun bonus, aucun malus.", re: "−20 % de dégâts infligés, −12 % de dégâts reçus. Pour tenir face aux gros boss." };
  const tgl = (act, on, n, d, extra) => `<label class="v3tg"><input type="checkbox" data-act="${act}" ${extra || ""} ${on ? "checked" : ""}><span><b>${h(n)}</b><small>${h(d)}</small></span></label>`;
  const planHtml = () => {
    const st = X.S.settings; const post = E.POSTURES[st.posture] ? st.posture : "eq"; const refl = Array.isArray(st.refl) ? st.refl : [];
    const F = X.S.fight; const now = F && !F.over && F.post && F.post !== F.post0 ? E.POSTURES[F.post] : null;
    return `<section class="card v3pl"><h2>Plan de bataille</h2><p class="small muted">Trois réglages pour toute l'équipe. Ils comptent dès le prochain combat, partout sauf contre d'autres joueurs.</p>
      <h3 class="sec">Posture</h3><div class="v3seg" role="radiogroup" aria-label="Posture">${Object.entries(E.POSTURES).map(([k, P]) => `<button class="v3sb${k === post ? " on" : ""}" role="radio" aria-checked="${k === post}" data-act="v3-post" data-v="${k}"><b>${h(P.n)}</b><small>${h(POST_D[k])}</small></button>`).join("")}</div>
      ${now ? `<div class="small v3e">En ce moment : <b>${h(now.n)}</b> (réflexe)</div>` : ""}
      <h3 class="sec">Cible</h3><div class="v3seg c">${FOCUS.map(([k, n, d]) => `<button class="v3sb${(st.focus || "auto") === k ? " on" : ""}" role="radio" aria-checked="${(st.focus || "auto") === k}" data-act="v3-focus" data-v="${k}"><b>${h(n)}</b><small>${h(d)}</small></button>`).join("")}</div>
      <p class="xs muted">Les bombes et les totems passent toujours avant. Un sort réglé sur une autre cible garde la sienne.</p>
      <h3 class="sec">Réflexes <small class="muted">${refl.length} / 2</small></h3><div class="v3tgs">${Object.entries(E.REFLEXES).map(([k, R]) => tgl("v3-refl", refl.includes(k), R.n, R.d, `data-v="${k}"`)).join("")}</div>
      <h3 class="sec">Challenges</h3><div class="v3tgs">${tgl("chalai", !!st.chalAI, "Respecter les challenges", "L'IA évite les actions qui feraient échouer les challenges du combat")}</div></section>`;
  };
  const routinesHtml = () => {
    const st = X.S.settings; const R = (E.recyCfg && E.recyCfg(X.S)) || {};
    const sg = typeof E.expAutoOn === "function";
    return `<section class="card v3pl"><h2>Routines</h2><p class="small muted">Ce que ton équipe fait toute seule, même quand tu n'es pas là.</p>
      <h3 class="sec">Chasse</h3><div class="v3tgs">${tgl("autozone", !!st.autoZone, "Suivre mon niveau", "Monte de sous-zone quand tout va bien, redescend après plusieurs défaites")}${tgl("roam", !!st.roam, "Chasse itinérante", `Part vers une zone qui a 2 étoiles de plus (XP et butin −${Math.round((E.ROAM_MALUS || 0) * 100)} %)`)}</div>
      <h3 class="sec">Butin</h3><div class="v3tgs">${tgl("v3-chest", !!st.autoChest, "Ouvrir les coffres", "Les coffres gagnés s'ouvrent tout seuls")}${tgl("recyset", !!R.auto, "Recycler quand le sac est plein", "Suit les règles du Recycleur (Sac › Objets › Recycleur)", 'data-k="auto"')}</div>
      ${sg ? `<h3 class="sec">Songe infini</h3><div class="v3tgs">${tgl("v3-sgauto", E.expAutoOn(X.S), "Choix automatiques", "Le songe choisit seul ses salles et ses bonus")}${tgl("v3-sgloop", E.sgLoopOn ? E.sgLoopOn(X.S) : !!st.sgLoop, "Songes en boucle", "Un nouveau songe repart quand le précédent finit")}</div>` : ""}</section>`;
  };
  const XP3 = {
    plan: { nav: ["plan", "Plan de bataille", "combat"], d: "Posture, cible et réflexes de l'équipe", html: planHtml },
    routines: { nav: ["routines", "Routines", "almanax"], d: "Ce que l'équipe fait toute seule", html: routinesHtml },
  };
  const rePage = () => { if (XP3[ui.tab]) { const m = document.getElementById("main"); if (m) morphTo(m, `${XP3[ui.tab].html()}`); } };
  /* cases à cocher de la 3.0 (événement change de js/ui.js) */
  V3.change = function (a, t) {
    const st = X.S.settings;
    if (a === "v3-refl") {
      const L = Array.isArray(st.refl) ? st.refl.filter((k) => E.REFLEXES[k]) : []; const k = t.dataset.v; if (!E.REFLEXES[k]) return;
      const i = L.indexOf(k); if (t.checked && i < 0) { if (L.length >= 2) { t.checked = false; toast("Deux réflexes au plus."); return; } L.push(k); } else if (!t.checked && i >= 0) L.splice(i, 1);
      st.refl = L; if (X.S.fight && !X.S.fight.pvp) X.S.fight.refl = L.slice();
      toast(t.checked ? `Réflexe actif : ${E.REFLEXES[k].n}.` : "Réflexe retiré.");
    } else if (a === "v3-chest") { st.autoChest = !!t.checked; if (st.autoChest && E.openAllChests) E.openAllChests(X.S, true); toast(st.autoChest ? "Les coffres s'ouvrent tout seuls." : "Les coffres attendent dans le sac."); }
    else if (a === "v3-sgauto") { E.expSetAuto(X.S, t.checked); }
    else if (a === "v3-sgloop") { E.sgSetLoop(X.S, t.checked); }
    else return;
    saveNow(); rePage();
  };
  /* actions propres à la 3.0 (appelées par le grand aiguillage de js/ui.js) */
  V3.act = function (a, t) {
    if (a && a.startsWith("v3-") && t && (t.tagName === "INPUT" || t.tagName === "SELECT")) return true; // les cases passent par V3.change
    if (a === "v3-post") { const k = t.dataset.v; if (!E.POSTURES[k]) return true; X.S.settings.posture = k; const F = X.S.fight; if (F && !F.over && !F.pvp) { F.post0 = k; F.post = k; } toast(`Posture : ${E.POSTURES[k].n}.`); saveNow(); rePage(); return true; }
    if (a === "v3-focus") { const k = t.dataset.v; if (!FOCUS.some((f) => f[0] === k)) return true; X.S.settings.focus = k; toast(`Cible : ${FOCUS.find((f) => f[0] === k)[1].toLowerCase()}.`); saveNow(); rePage(); return true; }
    if (a === "v3det") { ui.v3det = !ui.v3det; render(); return true; }
    if (a === "v3alok") { V3.alert = null; lossRow = 0; V3.tick(true); return true; }
    if (a === "v3try") { X.S.settings.v3 = !X.S.settings.v3; if (X.S.settings.v3) X.S.v3all = X.S.v3all == null ? (maxLvl() >= 20 || (X.S.stats && X.S.stats.fights > 300) ? 1 : 0) : X.S.v3all; X.reload(); return true; }
    return false;
  };
})();
