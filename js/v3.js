/* Idlus 3.0 « Un écran de jeu » (maquette validée par Mathis le 11-12/11/2026, réponses 1 à 31) :
   le combat reste au centre, les 41 pages deviennent 8 espaces + la Saison, ouverts dans un panneau à droite (PC)
   ou en plein écran avec un bandeau du combat (téléphone). Pour tout le monde depuis la 3.0.1 (d'abord en option à la 3.0.0).
   Ce fichier est chargé avant js/ui.js : il n'utilise ses fonctions (NAV, S, ui, render…) qu'au moment de l'appel. */
(function () {
  const V3 = (window.V3 = {});
  let X = null; // le contexte de js/ui.js (V3.init), qui garde ses variables pour lui
  let h, fmt, fmtK, pct, med, G, hudPic, navLiveTxt, morphTo, toast, saveNow, render, renderNav, E, DUNGEONS, NAV, ui, PAGES, NAV_DESC, IC;
  V3.init = function (ctx) {
    X = ctx; ({ h, fmt, fmtK, pct, med, G, hudPic, navLiveTxt, morphTo, toast, saveNow, render, renderNav, E, DUNGEONS, NAV, ui, PAGES, NAV_DESC, IC } = ctx);
    Object.keys(XP3).forEach((k) => { if (PAGES && !PAGES[k]) PAGES[k] = (m) => { m.innerHTML = XP3[k].html(); }; if (NAV_DESC) NAV_DESC[k] = XP3[k].d; });
  };
  /* 3.0.1 (Mathis 13/11 : « uniquement le nouvel affichage, plus l'ancien ») : la 3.0 pour tout le monde, l'option est retirée.
     L'ancien écran ne reste que pour les tests automatiques de l'ancien affichage (navigateur piloté, sans window.__IDLUS_V3). */
  V3.classic = () => !!(typeof navigator !== "undefined" && navigator.webdriver && !window.__IDLUS_V3);
  V3.on = () => !!(X && X.S) && !V3.classic();

  /* ---------- les 8 espaces (question 3) et leurs onglets ; lvl : niveau qui ouvre l'espace (question 4) ---------- */
  const SPACES = [
    { id: "av", n: "Aventure", ic: "monde", keys: ["world", "breche", "asc", "exp", "routines", "dungeons", "defi", "wb", "chev", "xs1"] },
    { id: "he", n: "Équipe", ic: null, keys: ["team", "plan", "maitrise", "garde", "builds"] },
    { id: "sac", n: "Sac", ic: "sac", keys: ["inv", "dofus"] },
    { id: "ec", n: "Artisanat", ic: "metiers", keys: ["metiers", "forge", "grav", "comptoirs"], lvl: 5 },
    { id: "col", n: "Collection", ic: "dofus", keys: ["album", "pets", "elev", "chasse", "enc"], lvl: 10 },
    { id: "mar", n: "Marché", ic: "bourse", keys: ["cours", "boutique3", "chantier", "echanges", "hdv", "foire"], lvl: 15 },
    { id: "co", n: "Joueurs", ic: "couronne", keys: ["guild", "tour", "koli", "align", "ladder", "amis", "vote"], lvl: 20 },
    { id: "jo", n: "Journal", ic: "quetes", keys: ["hebdo", "quests", "succes", "carnet"] },
  ];
  V3.SPACES = SPACES;
  /* les noms courts des onglets dans la 3.0 */
  const REN = { hdv: "Échanges", world: "Zones", asc: "Ascension", exp: "Songe infini", defi: "Défi", wb: "Boss", chev: "Chevauchée", team: "Héros", inv: "Objets", cours: "Vendre", pets: "Compagnons", elev: "Élevage", chasse: "Champions", ladder: "Classements", tour: "Tournoi", album: "Album" };
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
      Object.keys(XP3).forEach((k) => { if (!XP3[k].on || XP3[k].on()) pool.set(k, XP3[k].nav); }); // les pages propres à la 3.0
      ALL = { season, spaces: SPACES.map((s) => ({ id: s.id, n: s.n, ic: s.ic, v3lvl: s.lvl || 0, pages: s.keys.filter((k) => pool.has(k)).map((k) => { const p = pool.get(k).slice(); pool.delete(k); if (REN[k]) p[1] = REN[k]; return p; }) })) };
      // 1B (12/11, « avec mon équipe ») : la Brèche est sa propre page (XP3.breche, moteur du Songe) ; l'Ascension reste le mode solo du mois
      const jo = ALL.spaces.find((F) => F.id === "jo"); pool.forEach((p) => jo.pages.push(p.slice())); // une page oubliée reste trouvable dans le Journal
    }
    V3.relock(true);
    document.body.classList.add("v3");
    if (!ui.v3booted) { ui.v3booted = true; if (ui.tab === "home") ui.tab = "combat"; }
    if (!X.S.v3tuto) X.S.v3tuto = X.S.v3all ? { done: true, i: 0, paid: 0 } : { i: 0, paid: 0 }; // les anciens comptes le relancent dans Options
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
  /* visuels DOFUS 3 animés (5A, livrés avec la 3.0 par un autre lot) : un module window.ANIM3 pourra donner son propre portrait
     (ANIM3.pic(ent) → HTML, ou rien pour garder l'image actuelle) et réagir aux sorts (ANIM3.fx(F)) ; rien d'autre à changer ici */
  const pic = (e) => { try { const A = window.ANIM3; const x = A && A.pic ? A.pic(e) : null; if (x) return x; } catch (er) {} return hudPic(e); };
  /* effets des sorts sur la scène (4C) : au choix du joueur ; lu par window.ANIM3 avec V3.fxMode() */
  const FXN = { all: "Tous", big: "Gros sorts", none: "Aucun" };
  V3.fxMode = () => { const m = X && X.S && X.S.settings && X.S.settings.a3fx; return FXN[m] ? m : "all"; };
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
      <div class="v3hb"><button class="btn sm" data-act="csetsheet">${G("gear")} Réglages du combat</button>${window.ANIM3 ? `<button class="btn sm" data-act="v3-fx" title="Effets des sorts sur la scène">Effets : ${FXN[V3.fxMode()]}</button>` : ""}<button class="btn sm" data-act="v3det">Vue détaillée</button>${(() => { const S = X.S; if (!team.length || E.expActive(S)) return ""; if (S.dungeon) { const ask = ui.navQuitAsk && Date.now() - ui.navQuitAsk < 5000; return `<button class="btn sm danger" data-act="navquit">${ask ? "Sûr ? La clé est perdue" : "Quitter le donjon"}</button>`; } return S.hunting && S.sub ? `<button class="btn sm" data-act="navquit">Rentrer</button>` : ""; })()}${live ? "" : `<button class="btn sm primary" data-act="nav" data-v="world">Choisir une zone</button>`}</div></div>`;
    const alert = al ? `<div class="v3al" data-k="al"><span aria-hidden="true">⚠</span><span class="grow">${h(al.txt)}</span><button class="btn sm primary" data-act="nav" data-v="world">Changer de zone</button><button class="btn sm" data-act="v3alok" aria-label="Fermer">✕</button></div>` : "";
    const obj = pin ? `<button class="v3obj" data-act="pingo" data-key="${h(pin.key)}"><span class="grow"><b>Prochain objectif :</b> ${h(pin.t)}</span>${bar(pin.p, "g")}<span class="v3pill">${h(pin.v)}</span></button>` : "";
    const tugs = `<div class="v3tugs"><div class="v3tug a"><i style="width:${ally.toFixed(1)}%"></i><span>Équipe ${Math.round(ally)} %</span></div><div class="v3tug m"><i style="width:${foe.toFixed(1)}%"></i><span>Ennemis ${Math.round(foe)} %</span></div></div>`;
    const heroRows = (mine.length ? mine : team.map((c) => ({ side: "c", cid: c.id, name: c.name, cls: c.cls, hp: 1, hpMax: 1, alive: true }))).map((e) => `<button class="v3r${e.alive ? "" : " ko"}" data-k="h${e.cid}" data-act="teamgo" data-id="${e.cid}" data-v="equip" title="Ouvrir la fiche du héros"><span class="v3p">${pic(e)}</span><span class="grow"><span class="v3n"><b>${h(e.name)}</b><span class="muted">${e.alive ? Math.round(pct(e.hp, e.hpMax)) + " %" : "K.O."}</span></span>${bar(pct(e.hp, e.hpMax), pct(e.hp, e.hpMax) < 30 ? "r" : "")}${bar(pct(e.dealt || 0, tot), "d")}</span></button>`).join("");
    const foeRows = foes.length ? foes.map((e, i) => `<button class="v3r${e.alive ? "" : " ko"}${e.alive && (e.boss || i === 0) ? " tg" : ""}" data-k="m${i}" data-act="v3-mon" data-v="${h(String(e.base || ""))}" title="Ouvrir la fiche du monstre"><span class="v3p">${pic(e)}</span><span class="grow"><span class="v3n"><b>${h(e.name)}</b><span class="muted">${e.alive ? Math.round(pct(e.hp, e.hpMax)) + " %" : "vaincu"}</span></span>${bar(e.alive ? pct(e.hp, e.hpMax) : 0, "m")}</span></button>`).join("") : `<div class="small muted v3e">${live ? "Le combat suivant commence…" : "Aucun ennemi."}</div>`;
    const mom = MOM.length ? MOM.map((m, i) => `<div class="v3m ${m.k}" data-k="mo${i}"><span aria-hidden="true">${m.k === "up" ? "▲" : m.k === "loss" ? "✕" : "✦"}</span><span class="grow">${h(m.t)}</span><span class="xs muted">${ago(m.at)}</span></div>`).join("") : `<div class="small muted v3e">Les butins rares, les boss vaincus et les niveaux s'afficheront ici.</div>`;
    const A3 = window.ANIM3; const scene = A3 ? `<div id="a3scene" class="v3scene" data-k="scene" data-morph-keep aria-hidden="true"></div>` : "";
    return `${head}${alert}${obj}${scene}${tugs}<div class="v3g"><div class="v3box"><h4>Ton équipe<small>barre fine = part des dégâts</small></h4>${heroRows}</div><div class="v3col"><div class="v3box"><h4>Ennemis</h4>${foeRows}</div><div class="v3box"><h4>Ce qui compte<small>les moments importants</small></h4>${mom}</div></div></div>
      <div class="v3k"><div><b>${fmtK(Math.max(0, r.k))}</b><span>kamas / min</span></div><div><b>${(Math.round(r.f * 10) / 10).toLocaleString("fr-FR")}</b><span>combats / min</span></div><div><b>${MOM.filter((m) => m.k === "rare").length}</b><span>butins rares</span></div><div><b>${fmt(team.length)}</b><span>héros en combat</span></div></div>`;
  };
  V3.bandHtml = function () {
    const F = X.S.fight; const live = navLiveTxt(); const ents = F && F.ents ? F.ents.filter((e) => !e.summon) : [];
    const mine = ents.filter((e) => e.side === "c"), foes = ents.filter((e) => e.side === "m");
    const s = (L) => L.reduce((a, e) => a + (e.alive ? Math.max(0, e.hp) : 0), 0) / Math.max(1, L.reduce((a, e) => a + e.hpMax, 0)) * 100;
    return `${med("combat")}<span class="grow"><b>${h(live || "Ton équipe se repose")}</b>${mine.length ? `<span class="v3bb">${bar(s(mine))}${bar(s(foes), "m")}</span>` : ""}</span><span class="v3pill">Voir le combat</span>`;
  };
  let tAt = 0;
  V3.tick = function (force) {
    if (!V3.on()) return; const now = performance.now(); if (!force && now - tAt < 300) return; tAt = now;
    V3.relock(); V3.layout();
    const b = document.getElementById("v3b"), band = document.getElementById("v3band");
    const wide = window.innerWidth >= 1180 && !document.body.classList.contains("chat-open"); // 3.0.1 : chat ouvert = pas de colonne du combat
    try { if (window.ANIM3 && window.ANIM3.fx && X.S.fight) window.ANIM3.fx(X.S.fight, b); } catch (er) {}
    if (b) { const show = V3.home() || (wide && ui.tab !== "combat"); b.hidden = !show; if (show) morphTo(b, V3.boardHtml()); }
    tutoPaint(); try { V3.brTick(); } catch (er) {}
    if (band) { const show = !V3.home() && ui.tab !== "combat" && !wide; band.hidden = !show; if (show) { const x = V3.bandHtml(); if (band.dataset.h !== x) { band.dataset.h = x; band.innerHTML = x; } } }
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
  /* ---------- Marché › Chantier du serveur (js/chantier.js, supabase/chantier.sql) ---------- */
  const dur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
  const chantierHtml = () => {
    const C = window.CHANTIER; const st = C && C.st; const w = C && C.where ? C.where() : null;
    const head = `<section class="card v3pl"><h2>Chantier du serveur</h2><p class="small muted">Tout le serveur y verse des kamas. Une fois l'objectif atteint : <b>×2 XP et ×2 butin pour tout le serveur pendant 48 h</b> (hors Dofus et runes Ga). Un Chantier par semaine, il rouvre le lundi.</p>`;
    if (C && C.on()) {
      return `${head}<div class="v3al ok"><span aria-hidden="true">✦</span><span class="grow">Le ×2 est en cours : encore <b>${dur(C.left())}</b>.</span></div>${st ? chTop(st) : ""}</section>`;
    }
    if (!w) return `${head}<div class="empty">Le Chantier se joue avec ta partie en ligne (partie 1, Saison 1 ou Monocompte).</div></section>`;
    if (!st) return `${head}<div class="empty">Chargement du Chantier… <button class="btn sm" data-act="v3-chload">Réessayer</button></div></section>`;
    const p = pct(st.total, st.goal); const room = Math.max(0, Math.min(st.cap - st.mine, st.goal - st.total)); const k = Math.floor(X.S.kamas || 0);
    const steps = [0.01, 0.05, 0.1].map((f) => Math.max(1000, Math.round((st.goal * f) / 1000) * 1000)).concat([Math.min(room, k)]).filter((v, i, L) => v >= 1000 && v <= room && L.indexOf(v) === i);
    const ask = ui.v3chc ? `<div class="v3al"><span class="grow">Verser <b>${fmt(ui.v3chc)} kamas</b> au Chantier ? Ils ne reviennent pas.</span><button class="btn sm primary" data-act="v3-chgive" data-v="${ui.v3chc}" data-ok="1">Verser</button><button class="btn sm" data-act="v3-chno">Annuler</button></div>` : "";
    return `${head}<div class="v3box"><h4>Semaine ${h(String(st.wk).split("-")[1] || "")}<small>${st.n} mécène${st.n > 1 ? "s" : ""}</small></h4>
      <div class="v3n"><b>${fmt(st.total)} / ${fmt(st.goal)} kamas</b><span class="muted">${Math.floor(p)} %</span></div>${bar(p, "g")}
      <p class="xs muted">Objectif calé sur les kamas des joueurs actifs du serveur. Chacun verse au plus ${fmt(st.cap)} kamas par semaine (40 %) : il faut au moins 3 mécènes.</p></div>
      ${st.done ? `<div class="empty">Le Chantier de la semaine est fini. Le prochain ouvre lundi.</div>` : `
      <h3 class="sec">Verser</h3><p class="small">Ta part cette semaine : <b>${fmt(st.mine)}</b> / ${fmt(st.cap)} kamas · tu as ${fmt(k)} kamas.</p>
      ${ask}<div class="v3hb">${steps.length ? steps.map((v) => `<button class="btn${v === Math.min(room, k) ? " primary" : ""}" data-act="v3-chgive" data-v="${v}" ${v > k ? "disabled" : ""}>${v === room ? "Toute ma part · " : v === k ? "Tous mes kamas · " : ""}${fmt(v)}</button>`).join("") : `<span class="small muted">Ta part de la semaine est versée : merci !</span>`}</div>`}
      ${chTop(st)}</section>`;
  };
  const chTop = (st) => `<h3 class="sec">Mécènes de la semaine</h3>${(st.top || []).length ? `<div class="v3tgs">${st.top.map((t, i) => `<div class="v3m${i < 3 ? " rare" : ""}"><b>${i + 1}</b><span class="grow">${h(t.p)}</span><span class="num">${fmt(t.k)}</span></div>`).join("")}</div>` : `<div class="small muted v3e">Personne n'a encore versé cette semaine.</div>`}`;
  V3.chantierPaint = () => { if (V3.on() && ui.tab === "chantier") rePage(); };
  /* ---------- Journal › Semaine : 5 objectifs et un coffre (js/hebdo.js) ---------- */
  const hebdoHtml = () => {
    const L = E.hebdoList(X.S); const W = E.hebdo(X.S); const nDone = L.filter((o) => o.done).length;
    const C = window.DATA && window.DATA.CONSUMABLES ? window.DATA.CONSUMABLES[E.hebdoChest(X.S)] : null;
    const mon = new Date(Date.now()); const d = (8 - (mon.getDay() || 7)) % 7 || 7;
    return `<section class="card v3pl"><h2>Objectifs de la semaine</h2><p class="small muted">5 objectifs, les mêmes pour tout le monde. Les 5 faits : ${C ? h(C.name).toLowerCase() : "un coffre"}. Nouveaux objectifs lundi (dans ${d} jour${d > 1 ? "s" : ""}).</p>
      <div class="v3tgs">${L.map((o) => `<div class="v3box"><div class="v3n"><b>${o.done ? "✓ " : ""}${h(o.name)}</b><span class="muted num">${fmt(o.v)} / ${fmt(o.goal)}</span></div>${bar(pct(o.v, o.goal), o.done ? "g" : "")}</div>`).join("")}</div>
      <div class="v3hb" style="margin-top:10px">${W.got ? `<span class="small">Coffre de la semaine pris. À lundi !</span>` : `<button class="btn primary" data-act="v3-hebdo" ${nDone >= L.length ? "" : "disabled"}>${nDone >= L.length ? "Prendre le coffre" : `Encore ${L.length - nDone} objectif${L.length - nDone > 1 ? "s" : ""}`}</button>`}</div></section>`;
  };
  /* ---------- Marché › Boutique de la semaine (js/boutique.js) ---------- */
  const btqHtml = () => {
    const L = E.btqWeek(); const k = Math.floor(X.S.kamas || 0); const RN = E.GR_RAR || {};
    const d = (8 - (new Date().getDay() || 7)) % 7 || 7;
    const pic = (it) => it.k === "aura" ? `<span class="gr-aura gr-a-${h(it.id)} mini"></span>` : `<b class="gr-pc gr-pc-${h(it.id)} v3bpc">${h(X.S.name || "Pseudo")}</b>`;
    return `<section class="card v3pl"><h2>Boutique de la semaine</h2><p class="small muted">6 apparences, payées en kamas, rien qui change les combats. Elles vont dans ta Garde-robe. Nouvelle Boutique lundi (dans ${d} jour${d > 1 ? "s" : ""}).</p>
      <div class="v3btq">${L.map((it) => { const own = E.btqHas(X.S, it.id); return `<div class="v3bi r-${it.rar}"><div class="v3bp">${pic(it)}</div><b>${h(it.n)}</b><span class="xs muted">${it.k === "aura" ? "Aura" : "Couleur du pseudo"} · ${h(RN[it.rar] || "")}</span>
        ${own ? `<span class="small">✓ Dans ta Garde-robe</span>` : ui.v3bq === it.id ? `<span class="v3hb"><button class="btn sm primary" data-act="v3-btq" data-v="${h(it.id)}" data-ok="1">Payer ${fmt(it.prix)}</button><button class="btn sm" data-act="v3-btqno">Non</button></span>` : `<button class="btn sm" data-act="v3-btq" data-v="${h(it.id)}" ${k >= it.prix ? "" : "disabled"}>${fmt(it.prix)} kamas</button>`}</div>`; }).join("")}</div></section>`;
  };
  /* ---------- Aventure › La Brèche (1B de Mathis, « avec mon équipe ») : étages sans fin, moteur du Songe (js/songe.js, E.brStart) ---------- */
  const BR_T = { fight: ["⚔", "Combat"], hard: ["💀", "Combat redoutable"], archi: ["👁", "Archimonstre"], favor: ["✨", "Faveur onirique"], fount: ["⛲", "Fontaine onirique"], boss: ["👑", "Boss"] };
  const brRk = { at: 0, rows: null, me: null, w: -1 };
  const brRkLoad = () => {
    const ON = window.ONLINE; const w = E.weekIdx();
    if (!(ON && ON.enabled && ON.db) || (ON.monoGame && ON.monoGame()) || (Date.now() - brRk.at < 60000 && brRk.w === w)) return; brRk.at = Date.now(); brRk.w = w;
    try { const q = () => ON.db().from("lb_asc").select("user_id,pseudo,score,r").eq("m", w).eq("cat", "breche").eq("k", "");
      Promise.all([q().order("r", { ascending: true }).limit(3), ON.user ? q().eq("user_id", ON.user.id).maybeSingle() : Promise.resolve({ data: null })])
        .then(([A, B]) => { brRk.rows = A.error ? null : A.data || []; brRk.me = (B && B.data) || null; if (ui.tab === "breche") rePage(); }).catch(() => {}); } catch (e) {}
  };
  /* 3.0.4 : la page de la Brèche d'après la maquette (Mathis 13/11 : 1A le puits, 2A les paliers, 3B pas de mur estimé, 4A la course sur la page, 5A top 3 et ta place) */
  const brLeft = () => { const ms = Math.max(0, E.weekEnd() - E.now()); const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000); return d ? `${d} j ${hh} h` : `${Math.max(1, hh)} h`; };
  const brBoss = (w, lvl, d) => { const id = E.brBossAt ? E.brBossAt(w, lvl, d) : null; const g = id && DUNGEONS[id]; const M = (window.DATA && window.DATA.MONSTERS) || {}; return g ? (M[g.boss] && M[g.boss].name) || g.name : "Boss de donjon"; };
  const brDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`; };
  const brHero = (reg, M, extra) => `<header class="brx-hero"><span class="brx-lab">Cette semaine · Règne de ${h(reg.god)}</span>${extra || `<h2>La Brèche</h2><span class="small">Finit dans ${brLeft()}. Ton équipe descend étage par étage, un boss de donjon tous les 10 étages.</span>`}
    <div class="brx-rule"><b>Règle de la semaine · ${h(M.name)}</b><span class="small">${h(M.desc)} Sur tous les étages, pour tout le monde.</span></div></header>`;
  const brWell = (S, wk, lvl) => {
    const best = (S.cnt && S.cnt.brBest) || 0; const R = brRk.rows; const top = R && R[0] ? R[0] : null; const w = E.weekIdx();
    const hi = Math.max(50, Math.ceil((Math.max(best, wk.d, top ? top.score : 0) + 1) / 10) * 10); const lo = Math.max(10, Math.min(hi - 60, Math.floor(Math.max(0, wk.d - 15) / 10) * 10));
    const rows = []; for (let d = lo; d <= hi; d += 10) rows.push([d, "boss", "Boss de donjon", brBoss(w, lvl, d)]);
    if (top && top.score) rows.push([top.score, "top", "Le plus bas du serveur", top.pseudo || "?"]);
    if (best) rows.push([best, "best", "Ton record de toujours", "toutes semaines"]);
    rows.push([wk.d, "me", "Ta semaine", wk.d ? "depuis lundi" : "pas encore de course"]);
    const K = { me: 0, best: 1, top: 2, boss: 3 }; rows.sort((a, b) => b[0] - a[0] || K[a[1]] - K[b[1]]);
    return `<section class="card brx-well"><h3>Le puits</h3>${rows.map(([d, k, t, s]) => `<div class="brx-fl ${k}"><span class="n">${fmt(d)}</span><i></i><span class="t"><b>${h(t)}</b><small>${h(s)}</small></span></div>`).join("")}</section>`;
  };
  const brTiers = (wk) => `<section class="card brx-box"><h3>Paliers de la semaine</h3><p class="xs muted">Une fois par semaine, dès que le boss de l'étage tombe.</p>${(E.BR_PAL || []).map(([f, r]) => { const got = (wk.pal || []).includes(f); const near = !got && wk.d >= f - 10;
      return `<div class="brx-tier ${got ? "got" : near ? "near" : ""}"><span class="e">Étage ${f}</span><b>${h(E.brPalTxt(r))}</b><span class="s">${got ? "✓ pris" : near ? `encore ${f - wk.d}` : "à atteindre"}</span></div>`; }).join("")}</section>`;
  const brRank = (wk) => { if ((window.ONLINE && window.ONLINE.monoGame && window.ONLINE.monoGame()) || !(window.ONLINE && window.ONLINE.enabled)) return ""; brRkLoad(); const R = brRk.rows, me = brRk.me;
    const row = (x, mine) => `<div class="brx-rk ${mine ? "me" : x.r <= 3 ? "p" + x.r : ""}"><b>${x.r}</b><span>${mine ? "Toi" : h(x.pseudo || "?")}</span><b>${fmt(x.score)}</b></div>`;
    const meIn = me && R && R.some((x) => x.user_id === me.user_id);
    return `<section class="card brx-box"><h3>Classement de la semaine</h3>${R === null ? `<p class="small muted">Chargement…</p>` : R.length ? R.map((x) => row(x, me && x.user_id === me.user_id)).join("") + (me && !meIn ? `<div class="brx-rk gap"><b>…</b><span></span><span></span></div>${row(me, true)}` : !me ? `<p class="xs muted">${wk.d ? "Ton étage part avec ta sauvegarde en ligne." : "Pas encore classé cette semaine."}</p>` : "") : `<p class="small muted">Personne encore cette semaine : à toi !</p>`}
      <p class="xs muted">Le top 10 gagne le titre « Maître de la Brèche » et 2 Fioles de Volonté le lundi.</p></section>`; };
  const brHtml = () => {
    const S = X.S; const on = E.brOn(S); const songe = E.expActive(S) && !on; const w = E.weekIdx(); const reg = E.brRegne(w); const M = (E.STASIS_MODS || {})[reg.mod] || { name: reg.mod, desc: "" };
    const wk = E.brWeek(S); const team = E.team(S); const top = team.length ? Math.max(...team.map((c) => c.lvl)) : 0; const lvl = team.length ? Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length) : 1;
    const best = (S.cnt && S.cnt.brBest) || 0;
    if (!on) {
      const err = songe ? "Ton équipe est dans le Songe infini : réveille-la d'abord." : E.expCanStart(S, 0); const L = S.brLast;
      const last = L ? `<section class="card brx-box"><span class="brx-lab m">Ta dernière course</span><b>Étage ${fmt(L.d)}${L.how === "away" ? " · sortie pendant ton absence" : ""}</b>
        <span class="small muted">${brDur(L.dur || 0)} · ${fmt(L.fights || 0)} combats · ${(L.relics || []).length} bonus · ${fmt(L.bribes || 0)} Bribes de rêve</span>${L.loss ? `<div class="brx-hint">${h(L.loss.txt)}</div>` : ""}</section>` : "";
      return `<div class="brx">${brHero(reg, M)}
        <div class="brx-stats"><div class="me"><b>${wk.d ? fmt(wk.d) : "—"}</b><span>ta semaine</span></div><div class="best"><b>${best ? fmt(best) : "—"}</b><span>ton record</span></div><div><b>${fmt(wk.runs || 0)}</b><span>${(wk.runs || 0) > 1 ? "courses" : "course"} cette semaine</span></div></div>
        <button class="btn primary brx-go" data-act="v3-brgo" ${err ? `disabled data-tip="${h(err)}"` : ""}>${err && top < E.EXP_MIN_LVL ? `S'ouvre au niveau ${E.EXP_MIN_LVL}` : "Entrer dans la Brèche"}</button>${err && top >= E.EXP_MIN_LVL ? `<p class="xs muted">${h(err)}</p>` : ""}
        <div class="brx-cols"><div class="brx-col">${last}${brTiers(wk)}</div><div class="brx-col">${brWell(S, wk, lvl)}${brRank(wk)}</div></div>
        <p class="xs muted">Ton équipe et son équipement, les mêmes étages pour tous cette semaine. Chaque étage est un peu plus dur : chaque équipe trouve son mur. Les étages en 5 viennent du Songe (Faveur onirique ou Archimonstre), une Fontaine de temps en temps. Les PV remontent un peu à chaque étage, et de moitié après un boss.</p></div>`;
    }
    const Xb = S.exp; const cur = Xb.at !== null ? Xb.nodes[Xb.at].d : 0; const nx = Xb.pick !== null ? Xb.nodes[Xb.pick] : null; const p = E.expPending(S); const fl = nx ? nx.d : cur + 1;
    const base = Math.floor((fl - 1) / 10) * 10; const bossD = base + 10; const nextPal = (E.BR_PAL || []).map((x) => x[0]).find((f) => !(wk.pal || []).includes(f));
    const seg = []; for (let d = base + 1; d <= bossD; d++) seg.push(`<i class="${d <= cur ? "done" : d === fl ? "cur" : d === bossD ? "boss" : ""}"></i>`);
    const up = []; for (let d = cur + 1; d <= cur + 8; d++) { const n = E.brNode(Xb.w, d); const T = BR_T[n.t] || ["⚔", n.t]; up.push(`<div class="brx-nx t-${n.t} ${nx && nx.d === d ? "cur" : ""}"><b>étage ${d}</b><i></i><span>${n.t === "boss" ? `Boss : ${h(brBoss(Xb.w, Xb.lvl, d))}` : T[1]}</span><small>stasis ${E.brStasis(d, n.t, Xb.lvl).toFixed(1)}</small></div>`); }
    const hpRows = team.map((c) => { const v = Xb.hp[c.id] === undefined ? 100 : Math.max(0, Math.round(Xb.hp[c.id])); return `<div class="brx-hp ${v < 30 ? "low" : v < 60 ? "mid" : ""}"><span>${h(c.name)}</span><span class="bar"><i style="width:${v}%"></i></span><span>${v} %</span></div>`; }).join("");
    const rel = Xb.relics.map((id) => { const r = E.EXP_RELICS[id]; return r ? `<span class="small"><b>${h(r.name)}</b> · ${h(r.desc)}</span>` : ""; }).join("") || `<span class="small muted">Pas encore de bonus : le premier vient avec le boss de l'étage 10.</span>`;
    const pend = p && window.SGUI && window.SGUI.pend ? `<section class="brx-pick">${window.SGUI.pend(S, p)}</section>` : p ? `<div class="v3box"><b>Un choix t'attend</b> <button class="btn sm primary" data-act="sg-reopen">Ouvrir</button></div>` : "";
    return `<div class="brx run">${brHero(reg, M, `<div class="brx-head"><h2>Étage ${fmt(fl)}</h2><span class="small">record de la semaine : ${wk.d ? `étage ${fmt(wk.d)}` : "—"}${nextPal ? ` · prochain palier : étage ${nextPal}` : ""}</span></div>
      <div class="brx-seg" aria-label="Étages ${base + 1} à ${bossD}">${seg.join("")}</div><div class="brx-head xs"><span>${base + 1}</span><span>boss au ${bossD} : ${h(brBoss(Xb.w, Xb.lvl, bossD))}</span></div>`)}
      ${pend}
      <div class="brx-cols"><div class="brx-col"><section class="card brx-box"><h3>La suite</h3>${up.join("")}</section></div>
        <div class="brx-col"><section class="card brx-box"><span class="brx-lab m">Ton équipe · ${E.sgAvgHp(S)} % de PV</span>${hpRows}</section>
          <section class="card brx-box"><span class="brx-lab m">Tes bonus (${Xb.relics.length})</span>${rel}</section>
          <section class="card brx-box"><span class="brx-lab m">Cette course</span><span class="small">${fmt(Xb.bribes || 0)} Bribes de rêve · ${Math.floor(cur / 10)} boss vaincu${cur >= 20 ? "s" : ""}</span><span class="small">${brDur(E.now() - Xb.t0)} · ${fmt(Xb.fights)} combats · ${fmt(Xb.pts)} points de rêve · ${Xb.sable} Sable</span></section>
          <label class="row xs"><input type="checkbox" data-act="v3-sgauto" ${E.expAutoOn(S) ? "checked" : ""}> Choix automatiques (bonus, Fontaines, Sable)</label>
          <div class="v3hb"><button class="btn sm" data-act="nav" data-v="combat">Voir le combat</button>${ui.v3brq ? `<button class="btn sm danger" data-act="v3-brquit" data-ok="1">Oui, sortir (tout le butin est gardé)</button><button class="btn sm" data-act="v3-brno">Non</button>` : `<button class="btn sm danger" data-act="v3-brquit">Quitter la Brèche</button>`}</div></div></div>
      ${brRank(wk)}</div>`;
  };
  let brKey = "";
  V3.brTick = () => { if (!V3.on() || ui.tab !== "breche") return; const S = X.S; const Xb = S.exp; const k = E.brOn(S) ? `${Xb.at}|${Xb.pick}|${Xb.pend.length}|${Xb.pts}|${Xb.relics.length}|${E.sgAvgHp(S)}` : `off|${S.brLast ? S.brLast.t : 0}`; if (k !== brKey) { brKey = k; rePage(); } };
  const XP3 = {
    breche: { nav: ["breche", "Brèche", "monde"], d: "Ton équipe, des étages sans fin, classement de la semaine", html: brHtml, on: () => !!E.brStart },
    boutique3: { nav: ["boutique3", "Boutique", "bourse"], d: "6 apparences par semaine, en kamas", html: btqHtml, on: () => !!E.BTQ },
    hebdo: { nav: ["hebdo", "Semaine", "quetes"], d: "5 objectifs de la semaine et un coffre", html: hebdoHtml, on: () => !!E.HEBDO },
    plan: { nav: ["plan", "Plan de bataille", "combat"], d: "Posture, cible et réflexes de l'équipe", html: planHtml },
    routines: { nav: ["routines", "Routines", "almanax"], d: "Ce que l'équipe fait toute seule", html: routinesHtml },
    chantier: { nav: ["chantier", "Chantier", "pioche"], d: "Les kamas de tout le serveur pour un ×2 XP et butin de 48 h", html: chantierHtml, on: () => !!window.CHANTIER && !!window.ONLINE && window.ONLINE.enabled },
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
  /* ---------- tuto en 8 étapes (question 13) : l'écran pièce par pièce, 500 kamas par étape ; relançable dans Options › Affichage ---------- */
  const TUTO = [
    ["#v3b .v3h", "Le combat est ton accueil", "Ton équipe chasse ici en continu, même quand tu n'es pas là."],
    ["#v3b .v3tugs", "Qui gagne ?", "La barre verte, c'est ton équipe ; la rouge, les ennemis."],
    ["#v3b .v3g .v3box", "Tes héros", "La vie de chacun, et la barre fine dorée : sa part des dégâts. Touche un héros pour ouvrir sa fiche."],
    ["#v3b .v3col .v3box:last-child", "Ce qui compte", "Seulement les moments importants : butins rares, boss vaincus, niveaux."],
    ["#v3b [data-act=csetsheet]", "Réglages du combat", "Cible, suivi de niveau et chasse itinérante. Le Plan de bataille est dans Équipe."],
    ["#nav", "8 espaces", "Aventure, Équipe, Sac, Artisanat, Collection, Marché, Joueurs, Journal. De nouveaux espaces s'ouvrent en montant de niveau."],
    ["#v3b .v3obj, #v3b .v3k", "Ton prochain objectif", "Le prochain pas à faire, et tes gains à la minute."],
    ["#nav", "C'est parti !", "Les objectifs de la semaine sont dans le Journal, onglet Semaine. Bonne chasse !"],
  ];
  const TUTO_K = 500;
  let tutoEl = null;
  const tutoPaint = () => {
    const st = X.S && X.S.v3tuto; document.querySelectorAll(".v3hl").forEach((e) => e.classList.remove("v3hl"));
    if (!V3.on() || !st || st.done || !V3.home()) { if (tutoEl) { tutoEl.remove(); tutoEl = null; } return; }
    const i = st.i || 0; const T = TUTO[i]; if (!T) return;
    const el = document.querySelector(T[0]); if (el) el.classList.add("v3hl");
    if (!tutoEl) { tutoEl = document.createElement("div"); tutoEl.className = "v3tuto"; tutoEl.setAttribute("role", "dialog"); tutoEl.setAttribute("aria-label", "Tuto"); document.body.appendChild(tutoEl); }
    const x = `<div class="xs muted">Étape ${i + 1} / ${TUTO.length} · +${TUTO_K} kamas</div><b>${h(T[1])}</b><div class="small">${h(T[2])}</div><div class="v3hb"><button class="btn sm primary" data-act="v3-tuto">${i + 1 < TUTO.length ? "Suivant" : "Terminer"}</button><button class="btn sm" data-act="v3-tutox">Passer le tuto</button></div>`;
    if (tutoEl.dataset.h !== x) { tutoEl.dataset.h = x; tutoEl.innerHTML = x; }
  };
  V3.tutoStart = () => { X.S.v3tuto = { i: 0, paid: (X.S.v3tuto && X.S.v3tuto.paid) || 0 }; tutoPaint(); };
  /* actions propres à la 3.0 (appelées par le grand aiguillage de js/ui.js) */
  V3.act = function (a, t) {
    if (a && a.startsWith("v3-") && t && (t.tagName === "INPUT" || t.tagName === "SELECT")) return true; // les cases passent par V3.change
    if (a === "v3-post") { const k = t.dataset.v; if (!E.POSTURES[k]) return true; X.S.settings.posture = k; const F = X.S.fight; if (F && !F.over && !F.pvp) { F.post0 = k; F.post = k; } toast(`Posture : ${E.POSTURES[k].n}.`); saveNow(); rePage(); return true; }
    if (a === "v3-focus") { const k = t.dataset.v; if (!FOCUS.some((f) => f[0] === k)) return true; X.S.settings.focus = k; toast(`Cible : ${FOCUS.find((f) => f[0] === k)[1].toLowerCase()}.`); saveNow(); rePage(); return true; }
    if (a === "v3-mon") { const k = t.dataset.v; if (k && X.monSheet) X.monSheet(k); return true; }
    if (a === "v3-hebdo") { const r = E.hebdoClaim(X.S); if (r.err) toast(r.err); else { toast(`Coffre de la semaine : ${(window.DATA.CONSUMABLES[r.id] || {}).name || "coffre"} dans ton sac.`, "rare"); saveNow(); } rePage(); return true; }
    if (a === "v3-tuto" || a === "v3-tutox") {
      const st = X.S.v3tuto || (X.S.v3tuto = { i: 0, paid: 0 });
      if (a === "v3-tutox") { st.done = true; tutoPaint(); saveNow(); return true; }
      const i = st.i || 0; if ((st.paid || 0) <= i) { st.paid = i + 1; X.S.kamas += TUTO_K; } // une seule fois par étape, même relancé
      st.i = i + 1; if (st.i >= TUTO.length) { st.done = true; toast(`Tuto fini : ${fmt(TUTO_K * TUTO.length)} kamas gagnés en tout. Bonne chasse !`, "rare"); }
      tutoPaint(); saveNow(); return true;
    }
    if (a === "v3-tutogo") { V3.tutoStart(); ui.tab = "combat"; ui.v3det = false; render(); return true; }
    if (a === "v3-fx") { const L = Object.keys(FXN); X.S.settings.a3fx = L[(L.indexOf(V3.fxMode()) + 1) % L.length]; toast(`Effets des sorts : ${FXN[X.S.settings.a3fx].toLowerCase()}.`); saveNow(); V3.tick(true); return true; }
    if (a === "v3-brgo") { const r = E.act(X.S, "brStart"); if (r) toast(r); else { toast("La Brèche s'ouvre : bonne montée !", "rare"); saveNow(); } rePage(); return true; }
    if (a === "v3-brno") { ui.v3brq = false; rePage(); return true; }
    if (a === "v3-brquit") { if (!t.dataset.ok) { ui.v3brq = true; rePage(); return true; } ui.v3brq = false; const r = E.act(X.S, "expQuit"); if (r) toast(r); saveNow(); rePage(); return true; }
    if (a === "v3-btqno") { ui.v3bq = null; rePage(); return true; }
    if (a === "v3-btq") { const id = t.dataset.v; if (!t.dataset.ok) { ui.v3bq = id; rePage(); return true; } ui.v3bq = null; const r = E.btqBuy(X.S, id); if (r.err) toast(r.err); else { toast(`${r.it.n} : dans ta Garde-robe.`, "rare"); saveNow(); } rePage(); return true; }
    if (a === "v3-chload") { if (window.CHANTIER) window.CHANTIER.poll(); return true; }
    if (a === "v3-chno") { ui.v3chc = 0; rePage(); return true; }
    if (a === "v3-chgive") {
      const v = Math.floor(+t.dataset.v || 0); if (!(v >= 1000)) return true;
      if (!t.dataset.ok) { ui.v3chc = v; rePage(); return true; }
      ui.v3chc = 0; window.CHANTIER.give(v).then((r) => { if (r.err) toast(r.err); else toast(`Merci ! ${fmt(r.given)} kamas versés au Chantier.`, "rare"); rePage(); });
      return true;
    }
    if (a === "v3det") { ui.v3det = !ui.v3det; render(); return true; }
    if (a === "v3alok") { V3.alert = null; lossRow = 0; V3.tick(true); return true; }
    if (a === "v3try" && !V3.classic()) return true; // l'option n'existe plus
    if (a === "v3try") { X.S.settings.v3 = !X.S.settings.v3; if (X.S.settings.v3) X.S.v3all = X.S.v3all == null ? (maxLvl() >= 20 || (X.S.stats && X.S.stats.fights > 300) ? 1 : 0) : X.S.v3all; X.reload(); return true; }
    return false;
  };
})();
