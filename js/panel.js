/* ============================================================================
   PANEL XENER — Idlus 1.0.30 (choix 29A). Le panel admin et le panel de test réunis sur une page :
   - un menu par thème (Vue d'ensemble, Joueurs, Économie, Contenu, Test) et une recherche d'action
     (Ctrl K : « donner Dofus », un pseudo, « stasis 10 »…) ;
   - les pages du serveur restent celles de js/chat.js (mêmes onglets, mêmes actions « adm-… »), chaque appel
     est vérifié par le serveur (adm_need : compte de Mathis ; les modérateurs gardent seulement les outils
     du chat, adm_need_chat, supabase/chat.sql) ;
   - l'onglet Test : sur la partie de test (bêta, ou partie de test du jeu public, sauvegarde à part depuis
     1.0.8.2) ses outils sont ceux de js/admin.js ; sur la vraie partie, il prépare la partie de test (départs
     rapides, copie de la partie d'un joueur) puis passe dessus.
   D'autres fichiers peuvent ajouter une page, une action de la recherche ou une nouveauté à essayer :
     PANEL.register({ id, name, group: "Joueurs" | "Économie" | "Contenu" | "Test", html(), load(), count() })
     PANEL.register({ cmd: { n, k, run, test } })      (k : mots-clés ; test : seulement sur la partie de test)
     PANEL.register({ toggle: { id, n, on(), set(v) } }) (onglet Test › Essayer une nouveauté)
     PANEL.register({ id, srv: "m", … })              (2.1.36 : page du côté Monocompte ; sans srv : Classique)
   2.1.36 : un panel par serveur. Sélecteur « Classique | Monocompte » sous le titre (choix gardé dans ce navigateur) ; chaque page
   appartient à un serveur, le menu, la recherche et les pastilles ne montrent que celles du serveur choisi. L'onglet Test et les
   départs rapides restent côté Classique. Ouvrir une page de l'autre serveur (fiche d'un joueur, lien direct) y passe.
   03/11 (Saison 1, Mathis : « réadapter mon panel pour mono et classique ») : trois espaces au lieu de deux, « Éternel | Saison 1 |
   Monocompte ». Les pages du Classique servent pour l'Éternel et la Saison 1 Classique ; l'espace choisi fixe ON.admSp, et les
   fonctions d'admin qui existent dans l'espace de saison (Hôtel de vente, guildes, builds, fiches, En vérification, Bouclier,
   copies) visent alors s1, quelle que soit la partie jouée. Comptes, chat, annonces, codes, idées et bugs sont communs.
   Pas de boucle de rafraîchissement : la page se redessine sur les clics et après les réponses du serveur.
   ========================================================================== */
(function () {
  "use strict";
  const DX = window.DX; if (!DX || !DX.social) return;
  const E = window.ENGINE, D = window.DATA;
  const X = () => DX.social;
  const h = (s) => X().h(s);
  const G = (n) => X().G(n);
  const IC = (n) => X().IC(n);
  const fmt = (n) => X().fmt(n);
  const $ = (q) => document.querySelector(q);
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  const TESTMODE = LS.get("idlus-partie-test") === "1" && !/\/beta\//.test(location.pathname);
  const TEST_KEY = "dofousxen-save-beta", TODO_KEY = "idlus-test-todo";

  const SRV_KEY = "idlus-panel-srv";
  /* espace du panel : "e" Éternel, "s" Classique · Saison 1, "m" Monocompte ; l'ancien choix « c » (Classique) devient l'espace de la partie jouée */
  /* 04/11 (refonte, choix 2A) : le panel s'ouvre sur l'accueil « Ce qui t'attend » ; le dernier serveur du Classique choisi reste gardé
     (P.lastC) pour les pages communes à l'Éternel et à la Saison 1 */
  const SRV0 = () => "a";
  const LASTC0 = () => { const v = LS.get(SRV_KEY); return v === "s" ? "s" : v === "e" ? "e" : window.ONLINE && window.ONLINE.s1Game && window.ONLINE.s1Game() ? "s" : "e"; };
  const P = { v: "test", q: "", sel: 0, res: [], reg: [], cmds: [], toggles: [], test: null, busy: false, copyQ: "", srv: SRV0(), lastC: LASTC0(), badge: {} };
  const CH = () => (window.CHAT && window.CHAT.adm ? window.CHAT : null);
  const role = () => (window.CHAT ? window.CHAT.role : null) || null;
  const testEnv = () => !!(DX.testerOk && DX.testerOk()); // cette partie est une partie de test : les outils agissent dessus
  const srv = () => !!(CH() && role() && !TESTMODE);         // panel du serveur (compte admin ou modérateur, vérifié par le serveur)
  const admin = () => role() === "admin";
  const allowed = () => srv() || testEnv();
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  /* ---------- pages du menu ---------- */
  const GROUPS = [["", ""], ["Joueurs", "Joueurs"], ["Économie", "Économie"], ["Contenu", "Contenu"], ["Test", "Test"], ["Modération", "Modération"]];
  const GROUP_OF = { vue: "", joueurs: "Joueurs", fiches: "Joueurs", sig: "Joueurs", verif: "Joueurs", equipe: "Joueurs", hdv: "Économie", guildes: "Économie", ann: "Contenu", codes: "Contenu", idees: "Contenu", builds: "Contenu", mchat: "Contenu", mann: "Contenu" };
  const NAME_OF = { equipe: "Modérateurs", sig: "Signalements" };
  const ICON_OF = { vue: "trophee", joueurs: "couronne", fiches: "parchemin_or", sig: "combat", verif: "cristal", equipe: "couronne", hdv: "bourse", guildes: "couronne", ann: "parchemin_or", codes: "coffre", idees: "idee", builds: "parchemin_or", test: "metiers",
    monovue: "trophee", monotesteurs: "couronne", clesbeta: "cle", monobouclier: "cristal", monoremise: "phenix", monobureau: "combat", mchat: "parchemin_or", mann: "parchemin_or", enligne: "couronne", monoenligne: "couronne", srvvue: "trophee", salon: "parchemin_or", chat: "parchemin_or", bugs: "bug", accueil: "trophee" };
  /* 2.1.36 : serveur de chaque page (pages du chat : mchat, mann ; pages ajoutées : leur srv) */
  const MONO_TABS = { mchat: 1, mann: 1 };
  /* 04/11 (refonte du panel, choix 1A) : quatre espaces, chacun son menu ; les trois serveurs ont le même menu (Vue d'ensemble,
     En ligne, Joueurs, Jeu, Salon), les pages valables partout (comptes, signalements, annonces, codes, chat, retours, équipe, test)
     sont dans « Tous les serveurs ». "a" = l'accueil (choix 2A), sans menu. */
  const SRV_NAME = { e: "Éternel", s: "Saison 1", m: "Monocompte", t: "Tous les serveurs", a: "Accueil" };
  const SRV_SUB = { e: "Classique, avant la saison", s: "Classique, saison en cours", m: "un compte, une partie", t: "comptes, annonces, équipe" };
  const SRV_TIP = { e: "Serveur Classique, espace Éternel (les parties d'avant la saison)", s: "Serveur Classique, espace de la Saison 1", m: "Serveur Monocompte (saison en cours)", t: "Pages communes aux trois serveurs" };
  const SRV_WHERE = { e: "Tu agis sur l'<b>Éternel</b> du Classique (les parties d'avant la saison).", s: "Tu agis sur la <b>Saison 1</b> du Classique.", m: "Tu agis sur le <b>Monocompte</b>. Rien ici ne touche au Classique.", t: "Pages <b>communes aux trois serveurs</b> : un compte, un code ou une annonce vaut partout." };
  const HOME = { a: "accueil", e: "srvvue", s: "srvvue", m: "monovue", t: "ann" };
  const MENU = {
    c: [["", [["srvvue", "Vue d'ensemble", "trophee"], ["enligne", "En ligne", "couronne"]]],
      ["Joueurs", [["verif", "À vérifier (Bouclier)", "cristal"], ["fiches", "Fiches joueurs", "parchemin_or"]]],
      ["Jeu", [["hdv", "Hôtel de vente", "bourse"], ["guildes", "Guildes", "couronne"], ["builds", "Builds", "parchemin_or"]]],
      ["Salon", [["salon", "", "parchemin_or"]]]],
    m: [["", [["monovue", "Vue d'ensemble", "trophee"], ["monoenligne", "En ligne", "couronne"]]],
      ["Joueurs", [["monobouclier", "À vérifier (Bouclier)", "cristal"], ["monojournal", "Journal du Bouclier", "parchemin_or"], ["monoremise", "Copies des parties", "phenix"], ["monotesteurs", "Testeurs", "couronne"], ["clesbeta", "Clés bêta", "cle"]]],
      ["Jeu", [["monobureau", "Bureau des Aventuriers", "combat"]]],
      ["Salon", [["mchat", "Salon Monocompte", "parchemin_or"]]]],
    t: [["", [["joueurs", "Comptes", "couronne"], ["sig", "Signalements du chat", "combat"], ["vue", "Inscriptions et journal", "trophee"]]],
      ["Communiquer", [["ann", "Annoncer", "parchemin_or"], ["codes", "Codes cadeaux", "coffre"], ["chat", "Réglages du chat", "parchemin_or"]]],
      ["Retours", [["bugs", "Bugs", "bug"], ["idees", "Suggestions", "idee"]]],
      ["Équipe", [["equipe", "Modérateurs", "couronne"], ["test", "Partie de test", "metiers"]]]],
    a: [["", [["accueil", "Accueil", "trophee"]]]],
  };
  const menuOf = (sp) => MENU[sp === "e" || sp === "s" ? "c" : sp] || [];
  const side = (v) => (v === "m" ? "m" : "c"); // côté des pages : Classique (Éternel et Saison 1) ou Monocompte
  const sel = () => !!(srv() && admin()); // le sélecteur de serveur : compte admin sur le vrai serveur
  const pageSrv = (k) => { if (MONO_TABS[k]) return "m"; const r = P.reg.find((x) => x.id === k); return r && r.srv === "m" ? "m" : "c"; };
  /* les pages visibles : [clé, nom, pastille, groupe] ; toutes : celles des deux serveurs, avec leur serveur en 5e */
  function views(all) {
    const L = [];
    if (srv()) {
      const tabs = CH().adm.tabs();
      tabs.forEach(([k, n, c]) => L.push([k, NAME_OF[k] || n, c, admin() ? (k in GROUP_OF ? GROUP_OF[k] : "Contenu") : "Modération", pageSrv(k)]));
      if (admin()) P.reg.forEach((r) => { if (r.id && r.html) L.push([r.id, r.name || r.id, r.count ? r.count() : 0, r.group || "Contenu", r.srv === "m" ? "m" : "c"]); });
    }
    if (admin() || testEnv()) L.push(["test", "Partie de test", 0, "Test", "c"]);
    if (!srv() && testEnv()) P.reg.forEach((r) => { if (r.id && r.html && r.group === "Test") L.push([r.id, r.name || r.id, r.count ? r.count() : 0, "Test", "c"]); });
    if (!sel()) return L;
    /* 04/11 : compte admin sur le vrai serveur : le menu de l'espace choisi (ou de tous, all), dans l'ordre de MENU */
    const have = new Map(L.map((x) => [x[0], x]));
    const out = [];
    (all ? ["a", "e", "s", "m", "t"] : [P.srv]).forEach((sp) => menuOf(sp).forEach(([g, M]) => M.forEach(([k, n]) => { const x = have.get(k); if (x) out.push([k, k === "salon" ? `Salon ${SRV_NAME[sp]}` : n || x[1], x[2], g, sp]); })));
    return out;
  }
  /* espace visé par les fonctions d'admin (js/online.js) : Saison 1 → s1, sinon public (Éternel, comptes, Monocompte) */
  const syncSp = () => { const ON = window.ONLINE; if (ON && "admSp" in ON) ON.admSp = sel() ? (P.srv === "s" ? "s1" : "e") : null; };
  function setSrv(v) { P.srv = v in SRV_NAME ? v : P.lastC; if (P.srv === "e" || P.srv === "s") { P.lastC = P.srv; LS.set(SRV_KEY, P.srv); } syncSp(); }
  /* page ouverte d'un autre serveur (fiche d'un joueur, lien direct) : le panel y passe ; la page d'accueil du Classique (« vue »,
     page par défaut à l'ouverture) ne change pas le choix gardé */
  function follow(v) { if (!sel() || !v) return; const S = views(true).filter((y) => y[0] === v).map((y) => y[4]); if (!S.length || S.includes(P.srv)) return; setSrv(S.includes(P.lastC) ? P.lastC : S[0]); }
  function srvHtml() {
    if (!sel()) return "";
    const B = P.badge || {};
    return `<div class="px-srv px-sp" role="tablist" aria-label="Serveur">${["e", "s", "m", "t"].map((k) => `<button role="tab" aria-selected="${P.srv === k}" class="px-${k}${P.srv === k ? " on" : ""}" data-act="adm-pxsrv" data-v="${k}" title="${SRV_TIP[k]}"><b><i class="d"></i>${SRV_NAME[k]}</b><span>${SRV_SUB[k]}</span>${B[k] ? `<em>${B[k]}</em>` : ""}</button>`).join("")}</div>`
      + (P.srv in SRV_WHERE ? `<div class="px-where px-${P.srv}"><i></i><span>${SRV_WHERE[P.srv]}</span></div>` : "");
  }
  const cur = () => { const A = srv() ? CH().adm.A : null; return A ? A.tab : P.v; };
  const isLocal = (v) => v === "test" || P.reg.some((r) => r.id === v && r.local);

  function navHtml() {
    const V = views(); const c0 = cur(); const act = srv() ? "adm-tab" : "adm-pxv";
    const G0 = sel() ? menuOf(P.srv).map(([g]) => [g, g]) : GROUPS;
    return `<nav class="px-nav${sel() ? ` px-col px-${P.srv}` : ""}" aria-label="Menu du panel">${G0.map(([g, n]) => {
      const L = V.filter((x) => x[3] === g); if (!L.length) return "";
      return (n ? `<h4>${n}</h4>` : "") + L.map(([k, nm, c]) => `<button class="${k === c0 ? "on" : ""}" data-act="${act}" data-v="${k}">${IC(ICON_OF[k] || "parchemin_or")}<span>${h(nm)}</span>${c ? `<span class="n">${c}</span>` : ""}</button>`).join("");
    }).join("")}</nav>`;
  }
  function cmdHtml() {
    return `<div class="px-cmd" role="search">${G("search")}<input id="pxQ" value="${h(P.q)}" placeholder="Chercher une action, un joueur, un objet… ex. « donner Dofus », « Floflo », « stasis 10 »" autocomplete="off" aria-label="Chercher une action"><kbd>Ctrl K</kbd><div id="pxRes" class="px-res">${resHtml()}</div></div>`;
  }

  /* ---------- page ---------- */
  function html(loading) {
    if (!allowed()) return `<section class="adm"><div class="box"><div class="empty">Le Panel Xener est réservé à l'équipe d'Idlus.</div></div></section>`;
    if (sel() && !P.init) { P.init = true; if (P.srv === "a") CH().adm.A.tab = "accueil"; } // 04/11 : ouverture sur l'accueil
    follow(cur()); syncSp();
    const V = views(); let v = cur();
    if (!V.some((x) => x[0] === v)) { v = V.some((x) => x[0] === HOME[P.srv]) ? HOME[P.srv] : V[0] ? V[0][0] : "test"; if (srv()) CH().adm.A.tab = v; else P.v = v; }
    const mod = srv() && !admin();
    const reg = P.reg.find((r) => r.id === v && r.html);
    let body;
    if (v === "test") body = testEnv() && P.test ? P.test.html() : realTestHtml();
    else if (reg) body = reg.html();
    else if (srv()) { const A = CH().adm.A; body = loading || !A.ov ? `<div class="box"><div class="empty">Chargement…</div></div>` : CH().adm.body(); }
    else body = "";
    const mono = sel() && P.srv === "m";
    const head = `<div class="ahd"><h1>${mod ? "Modération" : "Panel Xener"}</h1><span class="badge">${mod ? "Modérateur" : srv() ? "Réservé à ton compte" : "Partie de test"}</span>
      ${sel() && P.srv !== "a" ? `<button class="btn sm" data-act="adm-pxsrv" data-v="a">${IC("trophee")} Accueil</button>` : ""}${srv() ? `<button class="btn sm" data-act="adm-reload">Actualiser</button>` : ""}${srv() && admin() && !sel() ? `<button class="btn sm" data-act="adm-test">${G("bug")} Partie de test</button>` : ""}${TESTMODE ? `<button class="btn sm" data-quit-test="1">Revenir à ma partie</button>` : ""}</div>`;
    const note = sel() ? "" : srv() ? `<p class="small muted">${mod ? "Tes outils de modération du chat : joueurs, muet et signalements. Chaque action est vérifiée par le serveur." : mono ? "Côté Monocompte : saison en cours, accès, Bouclier, Bureau des Aventuriers, salon et annonces du Monocompte. Chaque action est vérifiée par le serveur et ne touche pas au Classique." : sel() && P.srv === "s" ? "Saison 1 du Classique : Hôtel de vente, guildes, builds, fiches, « En vérification », Bouclier et copies des parties visent l'espace de la Saison 1. Comptes, chat, annonces, codes cadeaux, idées et bugs sont communs à l'Éternel et à la saison. Chaque action est vérifiée par le serveur." : sel() ? "Éternel du Classique : Hôtel de vente, guildes, builds, fiches, « En vérification », Bouclier et copies des parties visent l'Éternel (les parties d'avant la saison). Comptes, chat, annonces, codes cadeaux, idées et bugs sont communs. Chaque action est vérifiée par le serveur, sans toucher à ta partie. L'onglet Test prépare ta partie de test (hors ligne, sauvegarde à part)." : "Ce panel agit sur le serveur, pour tous les joueurs, et chaque action est vérifiée par le serveur. Il ne touche pas à ta partie. L'onglet Test prépare ta partie de test (hors ligne, sauvegarde à part) : ta vraie partie est envoyée en ligne puis mise de côté, intacte."}</p>`
      : `<p class="small muted">${TESTMODE ? "Partie de test : hors ligne, sur une sauvegarde à part. Les outils du serveur (joueurs, économie, contenu) sont dans le Panel Xener de ta vraie partie." : "Version de test : ces outils modifient la partie de test de ce navigateur, jamais le jeu public."}</p>`;
    const home = sel() && P.srv === "a"; // accueil : pleine largeur, sans menu
    return `<section class="adm px${mono ? " px-mono" : ""}${sel() ? ` px-in-${P.srv}` : ""}">${head}${srvHtml()}${note}${mod ? "" : cmdHtml()}${home ? `<div class="px-body">${body}</div>` : `<div class="px-wrap">${navHtml()}<div class="px-body">${body}</div></div>`}</section>`;
  }
  function render(main) {
    if (!main) return;
    if (srv()) {
      const A = CH().adm.A;
      if (isLocal(A.tab) && A.ov) { CH().adm.keepFocus(() => (main.innerHTML = html(false))); return; } // page locale (Test) : pas d'appel au serveur
      window.CHAT.renderAdmin(main); return;
    }
    main.innerHTML = html(false);
  }
  const repaint = () => { const m = $("#main"); if (!m || DX.ui.tab !== "admin") return; if (srv()) { if (window.GIFTS) window.GIFTS.readForm(); CH().adm.keepFocus(() => (m.innerHTML = html(false))); } else { const a = document.activeElement; const id = a && a.id; m.innerHTML = html(false); if (id && document.getElementById(id)) document.getElementById(id).focus({ preventScroll: true }); } };
  async function load(v) { const r = P.reg.find((x) => x.id === v && x.load); if (r) { try { await r.load(); } catch (e) {} } }

  /* ---------- onglet Test sur la vraie partie : préparer la partie de test, puis y passer ---------- */
  function testSummary() {
    const raw = LS.get(TEST_KEY); if (!raw) return null;
    if (P.sumRaw === raw.length && P.sum) return P.sum;
    let s = null; try { s = E.deserialize(raw); } catch (e) { return null; }
    P.sumRaw = raw.length; P.sum = { n: s.chars.length, lvl: Math.max(...s.chars.map((c) => c.lvl || 1)), k: s.kamas || 0, at: s.savedAt || 0, name: (s.chars[0] || {}).name || "" };
    return P.sum;
  }
  const PRESETS = [["new", "Nouveau joueur", "niv. 1, rien débloqué"], ["mid", "Milieu de jeu", "niv. 100, bon équipement"], ["end", "Fin de jeu", "niv. 200, équipement optimisé"], ["copy", "Comme un joueur", "copie la partie d'un joueur (lecture)"]];
  P.PRESETS = PRESETS;
  function realTestHtml() {
    const t = testSummary();
    const sum = t ? `${t.n} héros, niveau ${t.lvl} au plus · ${fmt(Math.floor(t.k))} kamas${t.at ? ` · jouée le ${new Date(t.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}` : "Pas encore de partie de test : un départ rapide en crée une.";
    return `<div class="box"><div class="row between"><h2>Ta partie de test</h2><span class="tag soft">jamais le vrai jeu</span></div>
        <div class="small">${h(sum)}</div>
        <div class="px-pre">${PRESETS.map(([k, n, d]) => `<button data-act="adm-pxpre" data-v="${k}" ${!admin() ? "disabled" : ""}><b>${n}</b><span>${d}</span></button>`).join("")}</div>
        ${P.copyOpen ? `<div class="srch"><input id="pxCopy" value="${h(P.copyQ)}" placeholder="Pseudo du joueur à copier" autocomplete="off"><button class="btn primary" data-act="adm-pxcopy">Copier sa partie</button></div><span class="xs muted">La partie en ligne du joueur est lue par le serveur (réservé à ton compte), puis copiée dans ta partie de test. Rien ne change chez lui.</span>` : ""}
        <div class="row"><button class="btn primary" data-act="adm-test">${G("bug")} Ouvrir ma partie de test</button><span class="xs muted grow">Un départ rapide remplace la partie de test (une copie de secours est gardée).</span></div></div>
      <div class="box"><h2>Dans ta partie de test</h2><div class="px-tools">${[["Donner", "un seul champ pour donner n'importe quoi : ressource, objet, Dofus, idole, familier, kamas…"], ["Combat", "lancer un donjon à la stasis voulue, ou simuler 100 combats sur une copie de l'équipe"], ["Temps", "accélérer le jeu, simuler une absence"], ["Essayer une nouveauté", "thème d'Halouine, bonus de la guerre des cités, classement du Songe d'exemple…"], ["Parties types", "enregistrer une partie pour y revenir, créer une équipe toute prête"]].map(([a, b]) => `<div class="li small"><b>${a}</b><span class="xs muted">${b}</span></div>`).join("")}</div></div>`;
  }
  async function toTest(todo) {
    if (!admin()) { X().toast("Réservé au compte admin."); return; }
    if (todo && !LS.set(TODO_KEY, JSON.stringify(todo))) { X().toast("Plus de place dans ce navigateur pour préparer la partie de test."); return; }
    X().toast("Passage sur ta partie de test…");
    try { await X().onPush(); } catch (e) {}
    LS.set("idlus-testeur", "1"); LS.set("idlus-partie-test", "1");
    location.reload();
  }
  const teamCls = () => { const s = DX.S; if (!s) return [["iop", "Testeur", "m"]]; return (E.team(s).length ? E.team(s) : s.chars).slice(0, 4).map((c) => [c.cls, c.name, c.sex]); };
  async function copyPlayer(id, pseudo) {
    const ON = window.ONLINE; if (!admin() || !ON || !ON.rpc || P.busy) return;
    P.busy = true;
    try {
      if (!id) {
        const q = String(pseudo || "").trim(); if (!q) { X().toast("Tape le pseudo du joueur."); return; }
        const r = await ON.rpc("adm_roster", { p_q: q, p_sort: "" });
        if (r.err) { X().toast(r.err); return; }
        const L = Array.isArray(r.data) ? r.data : []; const x = L.find((y) => norm(y.pseudo) === norm(q)) || L[0];
        if (!x) { X().toast("Aucun joueur trouvé."); return; }
        id = x.id; pseudo = x.pseudo;
      }
      const r2 = await ON.rpc("adm_player", { p_user: id });
      if (r2.err) { X().toast(r2.err); return; }
      const txt = r2.data && r2.data.save && r2.data.save.data;
      const str = typeof txt === "string" ? txt : txt ? JSON.stringify(txt) : "";
      if (!str) { X().toast("Ce joueur n'a pas de partie en ligne."); return; }
      try { E.deserialize(str); } catch (e) { X().toast("Sa partie est illisible."); return; }
      const who = r2.data.pseudo || pseudo || "un joueur";
      if (testEnv() && P.test && P.test.load) { P.test.load(str, who); return; } // bêta : la partie de test est celle-ci
      await toTest({ k: "copy", txt: str, who, at: Date.now() });
    } finally { P.busy = false; }
  }

  /* ---------- recherche d'action (Ctrl K) ---------- */
  function catalog() {
    if (P.cat) return P.cat;
    const L = []; const add = (n, kind) => L.push([n, kind, norm(n)]);
    (E.DOFUS_ORDER || Object.keys(E.DOFUS || {})).forEach((id) => E.DOFUS[id] && add(E.DOFUS[id].name, "Dofus"));
    (E.LEG_LIST || []).forEach((x) => add(x.name, "Légendaire"));
    Object.values(E.IDOLS || {}).forEach((x) => add(x.name, "Idole"));
    Object.values(E.PETS || {}).forEach((x) => add(x.name, "Familier"));
    Object.values(D.CONSUMABLES).forEach((x) => add(x.name, "Consommable"));
    Object.values(D.ITEMS).forEach((x) => add(x.name, "Objet"));
    Object.keys(D.RES).forEach((n) => add(n, "Ressource"));
    return (P.cat = L);
  }
  function matches(q) {
    const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
    const hit = (s) => words.every((w) => s.includes(w));
    const out = [];
    views().forEach(([k, n, c, g]) => { if (hit(norm(`${n} ${g} aller ouvrir page`))) out.push({ n: `Aller à : ${n}`, sub: g || "Panel", run: () => go(k) }); });
    P.cmds.forEach((c) => { if (c.test && !testEnv()) return; if (sel() && P.srv !== "a" && (c.srv === "m" ? "m" : "c") !== side(P.srv)) return; if (hit(norm(`${c.n} ${c.k || ""}`))) out.push({ n: c.n, sub: c.test ? "partie de test" : c.sub || "", run: c.run }); });
    if (!testEnv() && admin() && !(sel() && !["t", "a"].includes(P.srv))) PRESETS.forEach(([k, n, d]) => { if (hit(norm(`${n} ${d} depart partie test`))) out.push({ n: `Partie de test : ${n}`, sub: d, run: () => preset(k) }); });
    if (testEnv() && P.test && P.test.give) {
      const g = norm(q).replace(/^(donner|give)\s+/, "").trim();
      if (g.length >= 3) { const gw = g.split(/\s+/); catalog().filter((x) => gw.every((w) => x[2].includes(w))).sort((a, b) => (a[2].startsWith(g) ? 0 : 1) - (b[2].startsWith(g) ? 0 : 1) || a[0].length - b[0].length).slice(0, 6)
        .forEach(([n, kind]) => out.push({ n: `Donner : ${n}`, sub: kind, run: () => P.test.give(n, 1) })); }
    }
    if (srv() && norm(q).length >= 2 && !/^donner\b/.test(norm(q))) out.push({ n: `Chercher le joueur « ${q.trim()} »`, sub: "Joueurs", run: () => window.CHAT.openAdmin("joueurs", q.trim()) });
    return out.slice(0, 9);
  }
  function resHtml() {
    if (!P.q.trim()) return "";
    P.res = matches(P.q); if (P.sel >= P.res.length) P.sel = 0;
    return P.res.length ? P.res.map((r, i) => `<button class="${i === P.sel ? "on" : ""}" data-act="adm-pxrun" data-i="${i}"><span class="grow">${h(r.n)}</span>${r.sub ? `<span class="xs muted">${h(r.sub)}</span>` : ""}</button>`).join("") : `<div class="xs muted px-none">Rien ne correspond.</div>`;
  }
  const resPaint = () => { const el = $("#pxRes"); if (el) el.innerHTML = resHtml(); };
  function run(i) { const r = P.res[i]; if (!r) return; P.q = ""; P.sel = 0; resPaint(); const q = $("#pxQ"); if (q) q.value = ""; try { r.run(); } catch (e) { X().toast("Action impossible : " + e.message); } }
  function go(v) {
    if (srv()) { const b = document.createElement("button"); b.dataset.act = "adm-tab"; b.dataset.v = v; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }
    else { P.v = v; repaint(); }
  }
  function preset(k) {
    if (testEnv() && P.test && P.test.preset) { P.test.preset(k); return; }
    if (k === "copy") { P.copyOpen = true; go("test"); setTimeout(() => { const i = $("#pxCopy"); if (i) i.focus(); }, 30); return; }
    toTest({ k: "preset", v: k, cls: teamCls(), at: Date.now() });
  }
  function open(v) {
    follow(v);
    if (v) { if (srv()) CH().adm.A.tab = v; else P.v = v; }
    X().closeSheet(); DX.ui.tab = "admin"; DX.render(); window.scrollTo(0, 0);
  }

  /* ---------- l'entrée « Panel Xener » du menu (Communauté), pour le compte admin et la partie de test ---------- */
  let navOn = null;
  function navSync() {
    const on = !!(admin() || testEnv()); if (on === navOn || !DX.NAV) return;
    const F = DX.NAV.find((x) => x.id === "co"); if (!F) return;
    navOn = on; F.pages = F.pages.filter((p) => p[0] !== "admin"); if (on) F.pages.push(["admin", "Panel Xener", "couronne"]);
    if (DX.S && DX.ui.tab !== "combat") DX.render();
  }
  setInterval(navSync, 2000); setTimeout(navSync, 300);

  /* ---------- clics, saisie, clavier ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^adm-px/.test(a)) return;
    switch (a) {
      case "adm-pxv": P.v = d.v; repaint(); window.scrollTo(0, 0); return;
      case "adm-pxsrv": { if (d.v === P.srv) return; const was = P.srv, c0 = cur(); setSrv(d.v); if (CH()) ["hdv", "guildes", "builds", "flag", "bdet"].forEach((k) => { CH().adm.A[k] = null; }); /* pas de liste de l'autre espace le temps du chargement */ P.q = ""; P.sel = 0; go(was !== P.srv && (was === "e" || was === "s") && (P.srv === "e" || P.srv === "s") && c0 ? c0 : HOME[P.srv]); return; } // entre Éternel et Saison 1, la page reste et se recharge
      case "adm-pxgo": setSrv(d.s); P.q = ""; P.sel = 0; go(d.v || HOME[P.srv]); window.scrollTo(0, 0); return; // 04/11 : lien de l'accueil vers la page d'un serveur
      case "adm-pxrun": run(+d.i); return;
      case "adm-pxpre": preset(d.v); return;
      case "adm-pxcopy": { if (d.u) { copyPlayer(d.u, d.p); return; } const i = $("#pxCopy") || $("#admCopy"); P.copyQ = i ? i.value : ""; copyPlayer(null, P.copyQ); return; }
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target && ev.target.id === "pxQ") { P.q = ev.target.value; P.sel = 0; resPaint(); }
    if (ev.target && ev.target.id === "pxCopy") P.copyQ = ev.target.value;
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target && ev.target.id === "pxQ") {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); const n = P.res.length; if (n) { P.sel = (P.sel + (ev.key === "ArrowDown" ? 1 : n - 1)) % n; resPaint(); } }
      else if (ev.key === "Enter") { ev.preventDefault(); run(P.sel); }
      else if (ev.key === "Escape") { P.q = ""; ev.target.value = ""; resPaint(); ev.target.blur(); }
      ev.stopPropagation();
    } else if (ev.target && (ev.target.id === "pxCopy" || ev.target.id === "admCopy") && ev.key === "Enter") { ev.preventDefault(); P.copyQ = ev.target.value; copyPlayer(null, P.copyQ); }
  }, true);
  window.addEventListener("keydown", (ev) => { // Ctrl K sur le panel : la recherche d'action (ailleurs : la recherche du jeu)
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || (ev.key !== "k" && ev.key !== "K") || DX.ui.tab !== "admin") return;
    const q = $("#pxQ"); if (!q) return; ev.preventDefault(); ev.stopImmediatePropagation(); q.focus(); q.select();
  }, true);

  /* ---------- pour les autres fichiers ---------- */
  function register(def) {
    if (!def) return;
    if (def.cmd) P.cmds.push(def.cmd);
    if (def.toggle) P.toggles.push(def.toggle);
    if (def.id && def.html) { P.reg = P.reg.filter((r) => r.id !== def.id); P.reg.push(def); }
  }
  window.PANEL = { html, render, load, repaint, register, open, go, preset, P, toTest, testEnv, admin, setSrv, srvOf: pageSrv, space: () => (sel() ? P.srv : null), badge: (k, n) => { P.badge[k] = n; }, NAMES: SRV_NAME, get toggles() { return P.toggles; }, setTest: (o) => { P.test = o; }, TODO_KEY, TESTMODE };
})();
