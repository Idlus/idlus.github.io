/* ============================================================================
   BUILDS PARTAGÉS — Idlus (1.0.23)
   Page Joueurs › Builds, « un peu comme Huzounet » (choix de Mathis : tout en A).
   - Liste en cartes (héros en pied, objets, Dofus, ❤, vues), bandeau « Build de la semaine »,
     filtres en haut : classe, tranche de niveau, élément, budget, recherche (titre, objet, Dofus), tri.
   - Fiche : équipement en « poupée » comme l'onglet Équipement, panoplies, caractéristiques aux jets moyens,
     « Comparer avec mon héros », sorts, conseil de l'auteur ; Appliquer (sorts + caractéristiques),
     Liste de courses, Copier le code, ☆ Favori, ⚑ Signaler.
   - Publication depuis la fenêtre « Partager le build » du héros (compte Discord, 30 builds au plus),
     onglet « Mes builds » (1.0.25.2) : ses builds publiés, mise à jour depuis le héros et suppression sur place,
     mise à jour en un clic quand le héros change ; titre « Théorycrafteur » à 25 ❤.
   - Panel admin : onglet « Builds » (signalés d'abord : remettre en ligne, cacher, supprimer, rétablir).
   Le build est le code « IDLUS1-… » du jeu (E.buildCode / E.parseBuild) ; le serveur : supabase/builds.sql.
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
(function () {
  "use strict";
  const D = window.DATA, ON = window.ONLINE;
  const { CLASSES, ITEMS, STATS, SETS } = D;
  const X = () => window.DX.social, E = () => window.DX.E, U = () => window.DX.ui, S = () => window.DX.S;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s); // même échappement que le jeu (ui.js)
  const EL = { fo: ["Terre", "t"], ine: ["Feu", "f"], cha: ["Eau", "e"], age: ["Air", "a"], multi: ["Multi", "n"] };
  const ELS = ["fo", "ine", "cha", "age"];
  const BR = [["", "Tous"], ["1-50", "1 à 50"], ["51-100", "51 à 100"], ["101-150", "101 à 150"], ["151-199", "151 à 199"], ["200", "200"]];
  const BUD = { abo: ["Abordable", "#3fa34d", 1], moy: ["Moyen", "#c99a2e", 2], pre: ["Premium", "#9b4dff", 3] };
  const ORDER = ["coiffe", "cape", "amulette", "anneau1", "anneau2", "ceinture", "bottes", "arme", "bouclier"];
  const DOF = ["dofus1", "dofus2", "dofus3", "dofus4", "dofus5", "dofus6"];
  const TAGS = ["Donjon", "Kolizéum", "Farm", "Songe", "Débutant"];
  const SORTS = [["week", "Les plus aimés cette semaine"], ["new", "Les plus récents"], ["top", "Les plus aimés de tous les temps"], ["views", "Les plus vus"], ["fav", "Mes favoris"]]; // « Mes builds » est un onglet (1.0.25.2)
  const MAX = 30, LIKES_TITLE = 25, TITLE = "Théorycrafteur";
  const REASONS = ["Titre ou conseil insultant", "Pseudo ou texte inapproprié", "Spam ou publicité", "Autre"];

  const online = () => !!(ON && ON.enabled && ON.db && ON.db());
  const logged = () => !!(ON && ON.user);
  const monoP = () => !!(ON && ON.monoPart && ON.monoPart()); // 2.1.37.x : les builds sont ceux du serveur Classique : pas de publication depuis le héros Monocompte
  const F = { cls: "", br: "", el: "", bud: "", q: "", sort: "week" };
  /* 1.0.25.2 : onglet « Mes builds » (ses builds publiés, sans filtre) */
  const MINE = { cls: "", br: "", el: "", bud: "", q: "", sort: "mine" };
  const tab = () => (U().bdTab === "mine" ? "mine" : "all");
  const Q = () => (tab() === "mine" ? MINE : F);
  const L = { key: null, rows: [], n: 0, week: null, busy: false, err: "", at: 0, seq: 0 };
  const CACHE = {}; // numéro → build (ligne du serveur + build lu)
  let ME = null, meAt = 0, meBusy = null, meTry = 0; // mes builds (builds_me)
  const seen = new Set(); // vues déjà envoyées pendant cette session
  let lastHtml = "";

  /* ---------- outils ---------- */
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hash = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); };
  const ago = (t) => { const d = Math.floor((Date.now() - Date.parse(t)) / 864e5); return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : d < 45 ? `il y a ${d} jours` : `le ${new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`; };
  const favs = () => { const s = S(); return (s && s.bdFav) || []; };
  const isFav = (id) => favs().includes(id);
  const hero = (id) => { const s = S(); return s ? s.chars.find((c) => c.id === id) : null; };
  const mainHero = () => (X().mainHero ? X().mainHero() : S().chars[0]);
  const guest = () => { const s = S(); if (s && !s.gid) s.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); return s ? s.gid : null; };
  /* 1.0.20 : les trophées ne s'équipent plus ; un vieux code qui en porte les perd */
  const parse = (row) => { if (!row) return null; const b = E().parseBuild(row.code); if (!b) return null; for (const sl in b.eq) if (ITEMS[b.eq[sl]].trophy) delete b.eq[sl]; const x = Object.assign({}, row, { b }); CACHE[x.id] = x; return x; };
  const netErr = (e) => (/fetch|connexion|network|délai/i.test(e || "") ? "Pas de connexion au serveur. Réessaie dans un moment." : "Le serveur ne répond pas comme prévu. Réessaie dans un moment.");

  /* ---------- budget (13A) : d'après le coût des objets ----------
     Coût d'un objet = ses ingrédients au prix du jeu, ressources de boss comptées 4 fois ; rapporté au coût médian
     des objets du niveau du build (des objets plus bas coûtent moins cher). Objet sans recette ×2,5, légendaire ×4.
     Chaque Dofus ajoute 0,08, chaque trophée 0,03. Moins de 0,75 : Abordable ; moins de 1,3 : Moyen ; sinon Premium. */
  let BOSSRES = null, MED = null;
  function budgetPrep() {
    if (MED) return;
    const nb = {}, bo = {}; BOSSRES = {};
    for (const k in D.MONSTERS) (D.MONSTERS[k].drops || []).forEach(([r]) => { if (D.MONSTERS[k].boss) bo[r] = 1; else nb[r] = 1; });
    for (const r in bo) if (!nb[r]) BOSSRES[r] = 1;
    const band = {};
    for (const k in ITEMS) { const T = ITEMS[k]; if (!T.craft || T.slot === "dofus") continue; (band[Math.floor(T.lvl / 20)] = band[Math.floor(T.lvl / 20)] || []).push(rawCost(T)); }
    MED = {}; for (const b in band) { const a = band[b].sort((x, y) => x - y); MED[b] = a[Math.floor(a.length / 2)] || 1; }
  }
  function rawCost(T) { return T.craft.ing.reduce((n, [r, q]) => n + q * E().resPrice(r) * (BOSSRES[r] ? 4 : 1), 0); }
  function budgetOf(b) {
    budgetPrep();
    const ref = MED[Math.floor(b.lvl / 20)] || MED[Math.max(...Object.keys(MED).map(Number))] || 1;
    let sum = 0, n = 0, extra = 0;
    for (const [sl, t] of Object.entries(b.eq)) {
      const T = ITEMS[t]; if (!T) continue;
      if (sl.startsWith("dofus")) { extra += T.dofus ? 0.08 : 0.03; continue; }
      n++; sum += T.leg ? 4 : !T.craft ? 2.5 : Math.max(0.15, Math.min(4, rawCost(T) / ref));
    }
    const sc = (n ? sum / n : 0) + extra;
    return sc < 0.75 ? "abo" : sc < 1.3 ? "moy" : "pre";
  }

  /* ---------- caractéristiques aux jets moyens (4A), avec les bonus de panoplie ---------- */
  const mid = (r) => Math.round((r[0] + r[1]) / 2);
  function withItems(b, fn) {
    const s = S(); const eq = {}; let k = -900;
    try {
      for (const [sl, t] of Object.entries(b.eq)) { const T = ITEMS[t]; if (!T) continue; const st = {}; for (const [sk, r] of Object.entries(T.stats || {})) st[sk] = mid(r); s.items[k] = { uid: k, tpl: t, stats: st }; eq[sl] = k; k--; }
      return fn(eq);
    } finally { for (let i = -900; i > k; i--) delete s.items[i]; }
  }
  /* le build seul : sans les bonus du compte de celui qui regarde (familles, Vitrine des trophées) */
  function statsOf(b) {
    const S2 = Object.create(S()); S2.families = {}; S2.trophies = {};
    return disp(withItems(b, (eq) => E().charStats(S2, { id: -1, cls: b.cls, lvl: b.lvl, alloc: Object.assign({}, b.st), scrolls: {}, equip: eq, pet: null, mount: null, spells: [] })));
  }
  /* « Comparer avec mon héros » (15A) : le héros avec cet équipement et ces caractéristiques, ramenées à son niveau
     (comme « Appliquer »), en gardant ses parchemins, son familier et sa monture */
  function statsAs(b, c) {
    const s = S();
    return withItems(b, (eq) => {
      const t = JSON.parse(JSON.stringify(c)); t.equip = eq;
      const S2 = Object.create(s); S2.chars = [t];
      E().applyBuild(S2, t.id, b);
      return disp(E().charStats(S2, t));
    });
  }
  /* comme la fiche du héros : 3 PM de base en plus de ceux des objets */
  const disp = (st) => Object.assign({}, st, { pm: 3 + (st.pm || 0) });
  function setsOf(b) { const n = {}; Object.values(b.eq).forEach((t) => { const z = ITEMS[t] && ITEMS[t].set; if (z && SETS[z]) n[z] = (n[z] || 0) + 1; }); return Object.entries(n).filter(([, k]) => k >= 2).sort((a, z) => z[1] - a[1]); }
  /* élément trouvé tout seul : celui que le héros a le plus ; « Multi » si deux éléments ou plus sont proches */
  function elOf(st, cls) {
    const v = ELS.map((k) => [k, st[k] || 0]).sort((a, z) => z[1] - a[1]);
    if (v[0][1] <= 0) return CLASSES[cls].main || "fo";
    return v[1][1] >= v[0][1] * 0.6 ? "multi" : v[0][0];
  }

  /* ---------- héros dessiné avec la coiffe, la cape et le bouclier du build (17A, DofusDB) ---------- */
  function look(x, cls) {
    const local = X().lookLocal(x.cls, x.sex, x.head);
    const ids = ["coiffe", "cape", "bouclier"].map((s) => x.b.eq[s]).filter((t) => /^i\d+$/.test(t || "")).map((t) => +t.slice(1));
    if (!ids.length || !X().dbLook) return `<img class="${cls}" src="${local}" alt="" loading="lazy">`;
    const u = X().dbLook(x.cls, x.sex === "f" ? "f" : "m", ids);
    if (typeof u === "string") return `<img class="${cls} db" src="${h(u)}" alt="" loading="lazy" onerror="this.onerror=null;this.classList.remove('db');this.src='${local}'">`;
    return `<img class="${cls}" src="${local}" data-fk="${h(u.key)}" alt="" loading="lazy" onload="if(this.src.indexOf('dofusdb')>0)this.classList.add('db')">`;
  }

  /* ---------- petits morceaux ---------- */
  const elTag = (k) => `<span class="bd-el" style="--c:var(--el-${EL[k][1]})">${k === "multi" ? "✦" : X().sIco(k)} ${EL[k][0]}</span>`;
  const budTag = (k) => (BUD[k] ? `<span class="bd-bud" style="--c:${BUD[k][1]}" data-tip="Budget calculé d'après le coût des objets">${"◆".repeat(BUD[k][2])} ${BUD[k][0]}</span>` : "");
  const viewTag = (x) => `<span class="xs muted bd-views" data-tip="Vues">👁 ${X().fmt(x.views || 0)}</span>`;
  const tipOf = (t) => { const T = ITEMS[t]; return `${T.name} · niv. ${T.lvl}${Object.keys(T.stats || {}).length ? " · " + Object.entries(T.stats).slice(0, 4).map(([k, r]) => `${r[0] === r[1] ? r[0] : r[0] + " à " + r[1]} ${(STATS[k] || {}).name || k}`).join(", ") : ""}`; };
  const ico = (t) => `<span class="lootico own" data-tip="${h(tipOf(t))}">${X().im(X().itemImg(t), "", ITEMS[t].name)}</span>`;
  function votes(x, big) {
    const f = isFav(x.id);
    return `<span class="bd-votes"><button class="bd-v ${x.liked ? "on" : ""}" data-act="bd-like" data-id="${x.id}" data-tip="${x.mine ? "Ton build" : x.liked ? "Je n'aime plus" : "J'aime"}" ${x.mine ? "disabled" : ""}>${x.liked ? "❤" : "♡"} ${X().fmt(x.likes || 0)}</button><button class="bd-v ${f ? "on gold" : ""}" data-act="bd-fav" data-id="${x.id}" data-tip="${f ? "Retirer de mes favoris" : "Ajouter à mes favoris"}">${f ? "★" : "☆"}${big ? (f ? " Favori" : " Ajouter aux favoris") : ""}</button></span>`;
  }
  function card(x) {
    const C = CLASSES[x.cls]; const gear = ORDER.filter((s) => x.b.eq[s]).map((s) => ico(x.b.eq[s])).join("");
    const df = DOF.filter((s) => x.b.eq[s]).map((s) => ico(x.b.eq[s])).join("");
    return `<div class="bd-card" data-act="bd-open" data-id="${x.id}" style="--cc:${C.color}">
      <div class="bd-top">${look(x, "bd-look")}<img class="bd-wm" src="${X().symImg(x.cls)}" alt=""><span class="bd-lv num">${x.lvl}</span>${elTag(x.el)}${x.hidden ? `<span class="tag warn bd-hid">Caché</span>` : ""}</div>
      <div class="bd-body"><b class="bd-t">${h(x.title)}</b><span class="xs muted">${h(C.name)} · par <b>${h(x.by)}</b> · ${ago(x.at)}</span>
        <div class="bd-gear">${gear}</div>${df ? `<div class="bd-gear dof">${df}</div>` : ""}
        <div class="row bd-foot">${budTag(x.bud)}${(x.tags || []).map((t) => `<span class="tag soft">${h(t)}</span>`).join("")}<span class="grow"></span>${viewTag(x)}${votes(x)}</div>${tab() === "mine" && x.mine ? ownActs(x) : ""}</div></div>`;
  }
  /* « Mes builds » : le héros relié (mise à jour en un clic s'il a changé) et la suppression, sur la carte */
  function ownActs(x) {
    const c = S().chars.find((y) => y.bd === x.id);
    const st = !c ? `<span class="xs muted" data-tip="Publié depuis une autre partie ou un autre appareil">Aucun héros relié ici</span>`
      : changed(c) ? `<button class="btn sm primary" data-act="bd-upd" data-c="${c.id}">Mettre à jour depuis ${h(c.name)}</button>` : `<span class="xs muted">À jour avec ${h(c.name)}</span>`;
    return `<div class="row bd-own">${st}<span class="grow"></span><button class="btn xs bd-rep" data-act="bd-del" data-id="${x.id}">Supprimer</button></div>`;
  }

  /* ---------- liste ---------- */
  function filtersHtml() {
    const cls = `<div class="bd-cls" role="group" aria-label="Classe">${D.CLASS_ORDER.filter((c) => CLASSES[c]).map((c) => `<button class="${F.cls === c ? "on" : ""}" style="--cc:${CLASSES[c].color}" data-act="bd-f" data-k="cls" data-v="${c}" data-tip="${h(CLASSES[c].name)}" aria-pressed="${F.cls === c}"><img src="${X().symImg(c)}" alt="${h(CLASSES[c].name)}"></button>`).join("")}</div>`;
    const seg = (k, opts) => `<span class="seg">${opts.map(([v, n]) => `<button data-act="bd-f" data-k="${k}" data-v="${v}" aria-pressed="${F[k] === v}">${n}</button>`).join("")}</span>`;
    const sort = `<select id="bdSort" aria-label="Trier">${SORTS.map(([v, n]) => `<option value="${v}" ${F.sort === v ? "selected" : ""}>${n}</option>`).join("")}</select>`;
    return `<div class="panel pad stack bd-filt">${cls}
      <div class="row bd-fl"><span class="bd-lab">Niveau</span>${seg("br", BR)}</div>
      <div class="row bd-fl"><span class="bd-lab">Élément</span>${seg("el", [["", "Tous"], ["fo", "Terre"], ["ine", "Feu"], ["cha", "Eau"], ["age", "Air"], ["multi", "Multi"]])}</div>
      <div class="row bd-fl"><span class="bd-lab">Budget</span>${seg("bud", [["", "Tous"], ["abo", "◆ Abordable"], ["moy", "◆◆ Moyen"], ["pre", "◆◆◆ Premium"]])}</div>
      <div class="row bd-fl"><input type="search" id="bdQ" class="bd-q" placeholder="Chercher un objet, un Dofus, un titre…" value="${h(F.q)}" autocomplete="off">${sort}</div></div>`;
  }
  function weekHtml() {
    const x = L.week; if (!x) return "";
    return `<div class="bd-week" data-act="bd-open" data-id="${x.id}" style="--cc:${CLASSES[x.cls].color}">${look(x, "bd-look")}<div class="grow stack" style="gap:3px"><span><span class="tag good">🏆 Build de la semaine</span></span><b>${h(x.title)}</b><span class="xs muted">${h(CLASSES[x.cls].name)} niv. ${x.lvl} · par <b>${h(x.by)}</b> · ${X().fmt(x.wk)} ❤ cette semaine</span></div><div class="bd-gear">${ORDER.filter((s) => x.b.eq[s]).slice(0, 6).map((s) => ico(x.b.eq[s])).join("")}</div></div>`;
  }
  function gridHtml(empty) {
    if (L.err && !L.rows.length) return `<div class="empty">${h(L.err)}<div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm" data-act="bd-retry">Réessayer</button></div></div>`;
    if (!L.rows.length) return L.busy || L.key !== key() ? `<div class="empty">Chargement des builds…</div>` : `<div class="empty">${empty}</div>`;
    return `<div class="bd-grid">${L.rows.map(card).join("")}</div>${L.rows.length < L.n ? `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn sm" data-act="bd-more" ${L.busy ? "disabled" : ""}>${L.busy ? "Chargement…" : `Voir ${Math.min(24, L.n - L.rows.length)} builds de plus`}</button></div>` : ""}`;
  }
  function listHtml() {
    const anyF = F.cls || F.br || F.el || F.bud || F.q.trim();
    const body = F.sort === "fav" && !favs().length ? `<div class="empty">Aucun favori pour l'instant : touche ☆ sur un build pour le retrouver ici.</div>`
      : gridHtml(anyF ? "Aucun build ne correspond à ces filtres." : "Aucun build publié pour l'instant : sois le premier !");
    const count = L.rows.length ? `<span class="small muted">${X().fmt(L.n)} build${L.n > 1 ? "s" : ""}${anyF ? " pour ces filtres" : ""}</span>` : "";
    return `${F.sort === "week" && !anyF ? weekHtml() : ""}${filtersHtml()}${count}${body}`;
  }
  const myCount = () => (tab() === "mine" && L.key === key() && !L.busy && !L.err ? L.n : ME ? ME.length : null);
  function mineHtml() {
    if (!logged()) return `<div class="empty">Connecte-toi avec Discord pour publier et retrouver tes builds.<div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm primary" data-act="on-loginscreen">Se connecter avec Discord</button></div></div>`;
    const n = myCount(); const full = n !== null && n >= MAX;
    const top = `<div class="panel pad row bd-mine"><span class="grow stack" style="gap:5px"><b>${n === null ? "Tes builds publiés" : `${n} build${n > 1 ? "s" : ""} publié${n > 1 ? "s" : ""} sur ${MAX}`}</b>
      <span class="bar"><i style="width:${n === null ? 0 : Math.min(100, Math.round((100 * n) / MAX))}%"></i></span>
      <span class="xs muted">${full ? `Tu as atteint ${MAX} builds : supprimes-en un pour en publier un autre.` : "Quand un héros change, mets son build à jour ici ou depuis son menu ⋯. Supprimer un build retire aussi ses ❤ et ses vues."}</span></span>
      ${monoP() ? `<span class="xs muted">Réservé au serveur Classique</span>` : `<button class="btn primary sm" data-act="bd-pub" ${full ? "disabled" : ""}>＋ Publier un build</button>`}</div>`;
    return top + gridHtml("Tu n'as encore publié aucun build. Touche « Publier un build », ou ouvre un héros : menu ⋯ Plus, « Partager ou publier le build ».");
  }
  const key = () => { const q = Q(); return JSON.stringify([q.cls, q.br, q.el, q.bud, fold(q.q.trim()), q.sort, q.sort === "fav" ? favs().join(",") : ""]); };
  let NAMES = null;
  function itemsFor(q) {
    const f = fold(q.trim()); if (f.length < 3) return null;
    if (!NAMES) NAMES = Object.keys(ITEMS).map((k) => [k, fold(ITEMS[k].name)]);
    const r = NAMES.filter(([, n]) => n.includes(f)).slice(0, 80).map(([k]) => k);
    return r.length ? r : null;
  }
  async function load(more) {
    if (!online()) return;
    const k = key();
    if (!more && L.key === k && (L.busy || Date.now() - L.at < 60000)) return;
    const G = Q();
    if ((G.sort === "mine" && !logged()) || (G.sort === "fav" && !favs().length)) { L.key = k; L.rows = []; L.n = 0; L.err = ""; return; }
    const seq = ++L.seq; if (!more) { L.key = k; L.rows = []; L.week = null; } L.busy = true; L.err = "";
    const q = G.q.trim();
    const r = await ON.rpc("builds_list", { p_cls: G.cls || null, p_br: G.br || null, p_el: G.el || null, p_bud: G.bud || null, p_q: q.length >= 2 ? q : null, p_items: itemsFor(q),
      p_sort: G.sort, p_off: more ? L.rows.length : 0, p_ids: G.sort === "fav" ? favs() : null });
    if (seq !== L.seq) return;
    L.busy = false; L.at = Date.now();
    if (r.err || !r.data) L.err = netErr(r.err);
    else { const rows = (r.data.rows || []).map(parse).filter(Boolean); L.rows = more ? L.rows.concat(rows.filter((x) => !L.rows.some((y) => y.id === x.id))) : rows; L.n = r.data.n || 0; if (!more) L.week = parse(r.data.week); }
    repaint();
  }

  /* ---------- fiche d'un build ---------- */
  function gearHtml(x) {
    const C = CLASSES[x.cls];
    const ds = (s) => { const t = x.b.eq[s]; return t && ITEMS[t] ? `<button class="dslot filled" data-act="encitem" data-v="${t}" data-tip="${h(tipOf(t))}">${X().im(X().itemImg(t), "", ITEMS[t].name)}</button>` : `<span class="dslot" data-tip="${h(D.SLOTS[s])} : vide"><span class="dlabel">${h(D.SLOTS[s].split(" ")[0])}</span></span>`; };
    return `<section class="panel pad stack" style="gap:10px"><h3>Équipement</h3>
      <div class="doll bd-doll"><div class="dcol">${X().DOLL_L.map(ds).join("")}</div>
        <div class="dcenter" style="--cc:${C.color}"><div class="dfig">${look(x, "dlook")}<span class="dlv">Niveau ${x.lvl}</span></div><b>${h(C.name)}</b>${elTag(x.el)}</div>
        <div class="dcol">${X().DOLL_R.map(ds).join("")}</div>
        <div class="drow">${ds("arme")}<span class="dsep"></span>${DOF.map(ds).join("")}</div></div>
      <p class="xs muted" style="margin:0;text-align:center">Touche un objet pour voir sa fiche : caractéristiques, recette et où le trouver.</p></section>`;
  }
  const statName = (k, n) => h(n || ((STATS[k] || {}).name || k).replace("% ", ""));
  function statRows(x, st) {
    const els = x.el === "multi" ? ELS.filter((k) => st[k] > 0) : [x.el];
    return [["hpMax", "PV", "vit"], ["pa", "PA"], ["pm", "PM"], ["po", "Portée"]].concat(els.map((k) => [k]), [["sa"], ["pui"], ["do"], ["cri"], ["dcri"], ["so"], ["ini"], ["pp"], ["tac"], ["fui"]]);
  }
  function statsHtml(x, st) {
    const rows = statRows(x, st).filter(([k]) => ["hpMax", "pa", "pm"].includes(k) || st[k]).map(([k, n, ic]) => `<div class="bd-st">${X().sIco(ic || k)}<span class="grow small">${statName(k, n)}</span><b class="num">${X().fmt(st[k] || 0)}${k === "cri" ? " %" : ""}</b></div>`).join("");
    return `<section class="panel pad stack" style="gap:8px"><h3>Caractéristiques <span class="xs muted">(jets moyens)</span></h3><div class="bd-sts">${rows}</div></section>`;
  }
  function cmpHtml(x, st) {
    const s = S(); const mine = s.chars.filter((c) => c.cls === x.cls);
    const C = CLASSES[x.cls];
    if (!mine.length) return `<section class="panel pad stack" style="gap:6px"><h3>Comparer avec mon héros</h3><p class="small muted" style="margin:0">Aucun ${h(C.name)} dans tes héros : recrutes-en un pour comparer ce build avec lui.</p></section>`;
    const u = U(); const c = mine.find((y) => y.id === u.bdCmp) || mine.find((y) => y.id === s.mainHero) || mine[0];
    let as; try { as = statsAs(x.b, c); } catch (e) { as = st; }
    const now = disp(E().charStats(s, c));
    const rows = statRows(x, as).filter(([k]) => ["hpMax", "pa", "pm"].includes(k) || as[k] || now[k]).slice(0, 12);
    const high = Math.max(0, ...Object.values(x.b.eq).filter((t) => !t.startsWith("dofus_") && !/^trophee/.test(t)).map((t) => ITEMS[t].lvl));
    const pick = mine.length > 1 ? `<select id="bdCmp" aria-label="Héros comparé">${mine.map((y) => `<option value="${y.id}" ${y.id === c.id ? "selected" : ""}>${h(y.name)} (niv. ${y.lvl})</option>`).join("")}</select>` : `<span class="xs muted">${h(c.name)} · niv. ${c.lvl}</span>`;
    return `<section class="panel pad stack bd-cmp" style="gap:6px"><div class="row"><h3 class="grow">Comparer avec mon héros</h3>${pick}</div>
      <div class="bd-cmpt"><span></span><b class="xs">Avec ce build</b><b class="xs">${h(c.name)}</b><b class="xs">Écart</b>
      ${rows.map(([k, n, ic]) => { const a = as[k] || 0, m = now[k] || 0, d = Math.round(a - m); return `<span class="small bd-cn">${X().sIco(ic || k)}<span>${statName(k, n)}</span></span><b class="num">${X().fmt(a)}</b><span class="num">${X().fmt(m)}</span><b class="num ${d > 0 ? "bd-up" : d < 0 ? "bd-dn" : ""}">${d > 0 ? "+" : ""}${X().fmt(d)}</b>`; }).join("")}</div>
      <p class="xs muted" style="margin:0">${h(c.name)} avec cet équipement (jets moyens) et cette répartition ramenée à son niveau, en gardant ses parchemins. En vert : ce qu'il gagnerait.${high > c.lvl ? ` Certains objets demandent le niveau ${high}.` : ""}</p></section>`;
  }
  /* 1.0.16 : le passif de chaque Dofus du build, et l'Éveil des Dragons avec les 6 primordiaux */
  function dofpHtml(x) {
    const ids = DOF.map((sl) => x.b.eq[sl] && ITEMS[x.b.eq[sl]].dofus).filter((id) => id && E().DOFP_LIST && E().DOFP_LIST[id]);
    if (!ids.length || !X().dofpBlock) return "";
    const prim = (E().DOFP_PRIM || []).filter((id) => ids.includes(id)).length;
    return `<section class="panel pad stack bd-dofp" style="gap:8px"><h3>Passifs des Dofus</h3>${ids.map((id) => X().dofpBlock(id, { mini: true, boost: prim >= 6, r: 0 })).join("")}
      ${prim >= 6 ? `<p class="xs plus" style="margin:0">Les 6 Dofus primordiaux : Éveil des Dragons, passifs +${E().DOFP_RESO} %.</p>` : ""}</section>`;
  }
  function detailHtml(x) {
    const C = CLASSES[x.cls]; const st = statsOf(x.b); const s = S();
    const same = s.chars.filter((c) => c.cls === x.cls); const u = U(); const tc = same.find((y) => y.id === u.bdCmp) || same.find((y) => y.id === s.mainHero) || same[0];
    const sps = x.b.sp.map((p) => { const d = E().spellDef(x.cls, p.id); return d ? `<span class="bsp" data-tip="${h(X().spellTip ? X().spellTip(d, x.lvl) : d.name)}">${X().spIcon(d)}<span class="xs">${h(d.name)}</span></span>` : ""; }).join("");
    const craft = Object.values(x.b.eq).filter((t) => ITEMS[t].craft && !s.shop.some((e) => e.id === t)).length;
    const sets = setsOf(x.b);
    const by = s.chars.find((c) => c.bd === x.id);
    const acts = `<div class="row bd-acts">${tc ? `<button class="btn sm primary" data-act="bd-apply" data-id="${x.id}" data-c="${tc.id}">Appliquer à ${h(tc.name)}</button>` : ""}
        ${craft ? `<button class="btn sm" data-act="bd-shop" data-id="${x.id}" data-tip="Ajoute les objets à fabriquer de ce build à la liste de courses de l'Accueil">${X().G("cart")} Liste de courses (${craft} objet${craft > 1 ? "s" : ""})</button>` : ""}
        <button class="btn sm" data-act="bd-copy" data-id="${x.id}">Copier le code</button>
        <span class="grow"></span>${x.mine ? `${by ? `<button class="btn sm" data-act="bd-upd" data-c="${by.id}">Mettre à jour depuis ${h(by.name)}</button>` : ""}<button class="btn xs bd-rep" data-act="bd-del" data-id="${x.id}">Supprimer</button>` : `<button class="btn xs bd-rep" data-act="bd-report" data-id="${x.id}">⚑ Signaler</button>`}</div>
      <p class="xs muted" style="margin:0">${tc ? `Appliquer copie les sorts et la répartition des caractéristiques sur ${h(tc.name)}. L'équipement n'est pas donné : la liste de courses dit quoi fabriquer.` : `Pour appliquer ce build, il te faut un ${h(C.name)}.`} Le code se colle sur Discord ou dans « Partager le build ».</p>`;
    return `<div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="bd-back">← ${tab() === "mine" ? "Mes builds" : "Tous les builds"}</button></div>
      <div class="bd-dhead" style="--cc:${C.color}"><img class="bd-dsym" src="${X().symImg(x.cls)}" alt="">
        <div class="grow stack" style="gap:6px;position:relative"><h2>${h(x.title)}</h2><span class="small">${h(C.name)} · niveau ${x.lvl} · ${elTag(x.el)} ${budTag(x.bud)} · par <b>${h(x.by)}</b> · mis à jour ${ago(x.at)}</span>
          ${x.tags && x.tags.length ? `<div class="row">${x.tags.map((t) => `<span class="tag soft">${h(t)}</span>`).join("")}</div>` : ""}
          ${x.hidden ? `<div class="small bad">Ce build est caché : il a été signalé plusieurs fois et attend la décision de l'équipe.</div>` : ""}
          <div class="row">${votes(x, true)}${viewTag(x)}</div></div></div>
      <div class="bd-dgrid">
        <div class="stack" style="gap:12px">${gearHtml(x)}
          ${sets.length ? `<section class="panel pad stack" style="gap:8px"><h3>Panoplies</h3>${sets.map(([z, n]) => X().setBlock(z, n)).join("")}</section>` : ""}
          ${dofpHtml(x)}</div>
        <div class="stack" style="gap:12px">${statsHtml(x, st)}${cmpHtml(x, st)}
          <section class="panel pad stack" style="gap:8px"><h3>Sorts</h3><div class="bsps">${sps || `<span class="muted xs">Aucun sort enregistré</span>`}</div></section>
          ${x.note ? `<section class="panel pad stack" style="gap:8px"><h3>Le mot de ${h(x.by)}</h3><p class="small" style="margin:0;white-space:pre-line">${h(x.note)}</p></section>` : ""}
          <section class="panel pad stack" style="gap:8px">${acts}</section></div></div>`;
  }

  /* ---------- page ---------- */
  function html() {
    const u = U(); const x = u.bdOpen && CACHE[u.bdOpen];
    if (u.bdOpen && !x) u.bdOpen = null;
    const head = `<div class="pagehead row"><h1>Builds</h1><span class="muted small grow bd-sub">Les builds partagés par les joueurs d'Idlus${monoP() ? " · publier : réservé au serveur Classique" : ""}</span>${online() && !monoP() && !(tab() === "mine" && !u.bdOpen) ? `<button class="btn primary sm" data-act="bd-pub">＋ Publier un build</button>` : ""}</div>`; // « Mes builds » a le sien
    if (!online()) return `<div id="bdPage">${head}<div class="empty">Les builds des joueurs sont sur le serveur d'Idlus, qui n'est pas joignable ici. Tu peux toujours partager un build avec son code (héros, menu ⋯ Plus).</div></div>`;
    const n = logged() ? myCount() : null;
    const tabs = `<div class="subtabs bd-tabs" role="tablist"><button data-act="bd-tab" data-v="all" aria-pressed="${tab() === "all"}">Tous les builds</button><button data-act="bd-tab" data-v="mine" aria-pressed="${tab() === "mine"}">Mes builds${n !== null ? ` <span class="num">${n}/${MAX}</span>` : ""}</button></div>`;
    return `<div id="bdPage">${head}${x ? detailHtml(x) : `${tabs}<div class="stack" style="gap:12px">${tab() === "mine" ? mineHtml() : listHtml()}</div>`}</div>`;
  }
  function render(main) {
    if (!main) return;
    if (!U().bdOpen) load();
    if (logged() && Date.now() - meTry > 60000) { meTry = Date.now(); mine().then(() => repaint()); } // nombre de builds publiés (onglet « Mes builds »), une fois par minute au plus
    const s = html();
    if (s === lastHtml && main.querySelector("#bdPage")) return; // rien n'a changé : la page n'est pas redessinée (images, survol, saisie)
    lastHtml = s; window.DX.repaint(main, s);
  }
  const repaint = () => { if (U().tab === "builds") { lastHtml = ""; render($("#main")); } };

  /* ---------- mes builds (titre, mise à jour en un clic) ---------- */
  async function mine(force) {
    if (!online() || !logged()) return null;
    if (!force && ME && Date.now() - meAt < 60000) return ME;
    if (meBusy) return meBusy;
    meBusy = ON.rpc("builds_me").then((r) => { meBusy = null; if (r.err || !Array.isArray(r.data)) return ME; ME = r.data; meAt = Date.now(); titleCheck(); linkCheck(); return ME; });
    return meBusy;
  }
  function titleCheck() {
    const s = S(); if (!s || !ME || !ME.some((x) => x.likes >= LIKES_TITLE)) return;
    s.titlesExtra = s.titlesExtra || []; if (s.titlesExtra.includes(TITLE)) return;
    s.titlesExtra.push(TITLE); X().markDirty();
    X().toast(`🏆 Titre « ${TITLE} » débloqué : un de tes builds a ${LIKES_TITLE} ❤ !`);
  }
  /* un build supprimé (par son auteur sur un autre appareil, ou par l'équipe) n'est plus relié au héros */
  function linkCheck() { const s = S(); if (!s || !ME) return; s.chars.forEach((c) => { if (c.bd && !ME.some((x) => x.id === c.bd)) { c.bd = null; c.bdH = null; X().markDirty(); } }); }
  const changed = (c) => !monoP() && !!(c && c.bd && c.bdH && hash(E().buildCode(S(), c)) !== c.bdH);

  /* ---------- publier (5A, depuis « Partager le build ») ---------- */
  const P = { cid: null, title: "", el: "", tags: [], note: "", err: "", busy: false, ok: "" };
  function pubInit(c) {
    if (P.cid === c.id) return;
    const pub = c.bd && ME && ME.find((x) => x.id === c.bd);
    const st = E().charStats(S(), c); const el = pub ? pub.el : elOf(st, c.cls);
    Object.assign(P, { cid: c.id, el, title: pub ? pub.title : `${CLASSES[c.cls].name} ${EL[el][0]} niveau ${c.lvl}`, tags: pub ? (pub.tags || []).slice() : [], note: pub ? pub.note || "" : "", err: "", ok: "", busy: false });
  }
  function readPub() { const t = $("#bdPT"), n = $("#bdPN"); if (t) P.title = t.value; if (n) P.note = n.value; }
  function pubHtml(c) {
    if (!online() || !c) return "";
    if (monoP()) return `<div class="box bd-pubf" id="bdPub"><b>Publier dans Joueurs › Builds</b><p class="small" style="margin:6px 0">Réservé au serveur Classique : les builds publiés sont ceux des héros du Classique. Tu peux toujours partager le build de ton héros Monocompte avec son code.</p></div>`;
    const C = CLASSES[c.cls];
    if (!logged()) return `<div class="box bd-pubf" id="bdPub"><b>Publier dans Joueurs › Builds</b>
      <p class="small" style="margin:6px 0">Pour publier, il faut être connecté avec Discord (une seule fois). Sans compte, tu peux tout de même regarder et copier les builds des autres.</p>
      <button class="btn primary sm" data-act="on-loginscreen">Se connecter avec Discord</button></div>`;
    pubInit(c);
    const pub = c.bd && ME && ME.find((x) => x.id === c.bd);
    const code = E().buildCode(S(), c); const b = E().parseBuild(code); const bud = budgetOf(b);
    const n = ME ? ME.length : null; const full = n !== null && n >= MAX && !pub;
    const nItems = Object.keys(b.eq).length;
    const heroes = S().chars;
    const pick = heroes.length > 1 ? `<select id="bdPubHero" aria-label="Héros">${heroes.map((y) => `<option value="${y.id}" ${y.id === c.id ? "selected" : ""}>${h(y.name)} (${h(CLASSES[y.cls].name)} ${y.lvl})</option>`).join("")}</select>` : "";
    const state = pub ? `<div class="small ${pub.code !== code ? "warn-t" : "muted"}">${pub.code !== code ? `${h(c.name)} a changé depuis la publication : mets le build à jour en un clic.` : `Publié · ${X().fmt(pub.likes)} ❤ · ${X().fmt(pub.views)} vues${pub.hidden ? " · caché après des signalements" : ""}`}</div>` : "";
    return `<div class="box stack bd-pubf" id="bdPub" style="gap:8px"><b>Publier dans Joueurs › Builds</b>
      <div class="row" style="gap:10px"><img class="bd-mini" src="${X().lookLocal(c.cls, c.sex, c.head || 0)}" alt=""><span class="grow small"><b>${h(c.name)}</b> · ${h(C.name)} niv. ${c.lvl}<br><span class="xs muted">Équipement, Dofus, sorts et caractéristiques sont pris sur le héros.</span></span>${pick}</div>
      ${state}
      <label class="id-f"><b class="small">Titre</b><input type="text" id="bdPT" maxlength="60" value="${h(P.title)}" autocomplete="off"></label>
      <div class="row"><b class="small">Élément</b><span class="seg">${Object.keys(EL).map((k) => `<button data-act="bd-pel" data-v="${k}" aria-pressed="${P.el === k}">${EL[k][0]}</button>`).join("")}</span><span class="xs muted">trouvé tout seul, modifiable</span></div>
      <div class="row"><b class="small">Budget</b>${budTag(bud)}<span class="xs muted">calculé d'après le coût des objets</span></div>
      <div class="row"><b class="small">Pour</b>${TAGS.map((t) => `<button class="tag ${P.tags.includes(t) ? "" : "soft"} bd-ptag" data-act="bd-ptag" data-v="${h(t)}" aria-pressed="${P.tags.includes(t)}">${h(t)}</button>`).join("")}<span class="xs muted">3 au plus</span></div>
      <label class="id-f"><b class="small">Ton conseil (facultatif)</b><textarea id="bdPN" rows="2" maxlength="300" placeholder="Comment jouer ce build, ce qu'il faut monter en premier…">${h(P.note)}</textarea></label>
      ${P.err ? `<div class="small bad">${h(P.err)}</div>` : ""}${P.ok ? `<div class="small plus">${h(P.ok)}</div>` : ""}
      ${nItems < 3 ? `<div class="small muted">Équipe au moins 3 objets sur ${h(c.name)} pour publier son build.</div>` : ""}
      <div class="row"><button class="btn primary" data-act="bd-send" data-c="${c.id}" ${P.busy || full || nItems < 3 ? "disabled" : ""}>${P.busy ? "Envoi…" : pub ? "Mettre à jour le build publié" : "Publier le build"}</button>
        ${pub ? `<button class="btn sm" data-act="bd-see" data-id="${pub.id}">Voir sur la page Builds</button>` : ""}
        <span class="xs muted grow">${n === null ? "" : full ? `Tu as déjà ${MAX} builds publiés : supprimes-en un dans Joueurs › Builds › Mes builds.` : `${n} build${n > 1 ? "s" : ""} publié${n > 1 ? "s" : ""} sur ${MAX}.`}</span></div></div>`;
  }
  function pubRefresh() {
    const box = $("#bdPub"); const c = hero(P.cid); if (!box || !c) return;
    readPub(); const t = document.createElement("div"); t.innerHTML = pubHtml(c); box.replaceWith(t.firstElementChild);
  }
  /* appelé par ui.js à l'ouverture de « Partager le build » : mes builds arrivent, la case se met à jour */
  function pubOpen(c) { if (!online() || !logged()) return; if (P.cid !== c.id) P.cid = null; mine().then(() => { if (P.cid === c.id && ME) { const pub = c.bd && ME.find((x) => x.id === c.bd); if (pub) { P.cid = null; pubInit(c); } } pubRefresh(); }); }
  async function send(cid, quick) {
    const c = hero(cid); if (!c || P.busy) return;
    if (monoP()) { X().toast(ON.CLASSIC_ERR || "Réservé au serveur Classique."); return; }
    if (!logged()) { X().toast("Connecte-toi avec Discord pour publier un build."); return; }
    if (!quick) { readPub(); const t = P.title.trim(); if (t.length < 4) { P.err = "Donne un titre à ton build (4 caractères au moins)."; return pubRefresh(); } }
    const code = E().buildCode(S(), c); const b = E().parseBuild(code);
    if (Object.keys(b.eq).length < 3) { P.err = `Équipe au moins 3 objets sur ${c.name} pour publier son build.`; return pubRefresh(); }
    P.busy = true; P.err = ""; P.ok = ""; if (!quick) pubRefresh();
    const r = await ON.rpc("build_publish", { p_id: c.bd || null, p_hid: c.id, p_el: quick ? null : P.el, p_bud: budgetOf(b), p_tags: quick ? null : P.tags, p_title: quick ? null : P.title.trim(), p_note: quick ? null : P.note.trim(), p_code: code, p_sex: c.sex === "f" ? "f" : "m", p_head: c.head || 0 });
    P.busy = false;
    if (r.err || !r.data) P.err = netErr(r.err);
    else if (r.data.err) { P.err = r.data.err; if (r.data.gone) { c.bd = null; c.bdH = null; X().markDirty(); } }
    else {
      c.bd = r.data.id; c.bdH = hash(code); X().markDirty(); meAt = 0; L.at = 0; delete CACHE[r.data.id];
      P.ok = r.data.upd ? "Build mis à jour." : "Build publié ! Il est dans Joueurs › Builds.";
      X().toast(r.data.upd ? `Build ${quick ? "de " + c.name + " " : ""}mis à jour.` : "Build publié dans Joueurs › Builds !");
      await mine(true);
    }
    if (quick && P.err) X().toast(P.err);
    pubRefresh(); if (U().tab === "builds") repaint(); else if (quick) window.DX.render();
  }

  /* ---------- actions ---------- */
  function patch(id, o) { [CACHE[id], L.week && L.week.id === id ? L.week : null].concat(L.rows.filter((x) => x.id === id)).forEach((x) => { if (x) Object.assign(x, o); }); }
  async function like(id) {
    if (!logged()) { X().toast("Connecte-toi avec Discord (Options › Sauvegarde) pour aimer un build."); return; }
    const r = await ON.rpc("build_like", { p_id: id });
    if (r.err || !r.data) { X().toast(netErr(r.err)); return; }
    if (r.data.err) { X().toast(r.data.err); return; }
    patch(id, { liked: r.data.liked, likes: r.data.likes }); repaint();
  }
  function fav(id) {
    const s = S(); const L0 = favs().slice(); const i = L0.indexOf(id);
    if (i >= 0) L0.splice(i, 1); else { L0.unshift(id); if (L0.length > 200) L0.length = 200; }
    s.bdFav = L0; X().markDirty();
    X().toast(i >= 0 ? "Retiré de tes favoris." : "Ajouté à tes favoris (tri « Mes favoris »).");
    if (F.sort === "fav") L.at = 0;
    repaint();
  }
  async function openBuild(id) {
    const x = CACHE[id]; if (!x) return;
    U().bdOpen = id; U().bdCmp = null; repaint(); window.scrollTo(0, 0);
    if (seen.has(id)) return; seen.add(id);
    const r = await ON.rpc("build_view", { p_id: id, p_guest: logged() ? null : guest() });
    if (r.data === true) { patch(id, { views: (x.views || 0) + 1 }); repaint(); }
  }
  function confirmSheet(title, txt, btn, act, d) {
    X().openSheet(`<h2>${h(title)}</h2><p class="small" style="margin:0">${txt}</p><div class="row"><button class="btn primary" data-act="${act}" ${Object.entries(d).map(([k, v]) => `data-${k}="${h(v)}"`).join(" ")}>${h(btn)}</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
  }
  function apply(id, cid) {
    const x = CACHE[id], c = hero(cid); if (!x || !c) return;
    const err = E().applyBuild(S(), c.id, x.b); X().closeSheet();
    if (err) { X().toast(err); return; }
    X().markDirty(); X().toast(`Build appliqué à ${c.name} : sorts et caractéristiques.`); repaint();
  }
  function shop(id) {
    const x = CACHE[id]; if (!x) return; const s = S(); let n = 0;
    Object.values(x.b.eq).forEach((t) => { if (ITEMS[t].craft && !s.shop.some((e) => e.id === t)) { s.shop.push({ k: "tpl", id: t }); n++; } });
    X().markDirty(); X().toast(n ? `${n} objet${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} à la liste de courses (Accueil).` : "Ces objets sont déjà dans ta liste de courses.");
    repaint();
  }
  function copy(id) {
    const x = CACHE[id]; if (!x) return;
    try { navigator.clipboard.writeText(x.code).then(() => X().toast("Code du build copié : colle-le sur Discord ou dans « Partager le build »."), () => X().toast("Copie impossible ici.")); } catch (e) { X().toast("Copie impossible ici."); }
  }
  function reportSheet(id) {
    if (!logged()) { X().toast("Connecte-toi avec Discord pour signaler un build."); return; }
    X().openSheet(`<h2>Signaler ce build</h2><p class="small" style="margin:0">L'équipe d'Idlus regarde chaque signalement. Un build signalé 3 fois est caché en attendant sa décision.</p>
      <div class="stack bd-reasons" style="gap:4px">${REASONS.map((r, i) => `<label class="small"><input type="radio" name="bdRsn" value="${h(r)}" ${i === 0 ? "checked" : ""}> ${h(r)}</label>`).join("")}</div>
      <div class="row"><button class="btn primary" data-act="bd-reportgo" data-id="${id}">Signaler</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
  }
  async function report(id) {
    const r0 = document.querySelector('input[name="bdRsn"]:checked');
    const r = await ON.rpc("build_report", { p_id: id, p_reason: r0 ? r0.value : null });
    X().closeSheet();
    X().toast(r.err ? netErr(r.err) : r.data || "Merci, l'équipe va regarder ce build.");
  }
  async function del(id) {
    const r = await ON.rpc("build_delete", { p_id: id }); X().closeSheet();
    if (r.err || r.data) { X().toast(r.err ? netErr(r.err) : r.data); return; }
    S().chars.forEach((c) => { if (c.bd === id) { c.bd = null; c.bdH = null; } }); X().markDirty();
    delete CACHE[id]; L.rows = L.rows.filter((x) => x.id !== id); L.n = Math.max(0, L.n - 1); if (L.week && L.week.id === id) L.week = null;
    U().bdOpen = null; meAt = 0; X().toast("Build supprimé."); repaint();
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^bd-/.test(t.dataset.act)) return;
    const a = t.dataset.act, d = t.dataset, id = +d.id;
    if (a === "bd-open") return openBuild(id);
    if (a === "bd-back") { U().bdOpen = null; repaint(); return; }
    if (a === "bd-tab") { readQ(); U().bdTab = d.v === "mine" ? "mine" : "all"; U().bdOpen = null; repaint(); window.scrollTo(0, 0); return; }
    if (a === "bd-f") { readQ(); F[d.k] = F[d.k] === d.v && d.k === "cls" ? "" : d.v; repaint(); return; }
    if (a === "bd-more") { load(true); repaint(); return; }
    if (a === "bd-retry") { L.at = 0; L.key = null; repaint(); return; }
    if (a === "bd-like") return like(id);
    if (a === "bd-fav") return fav(id);
    if (a === "bd-apply") { const x = CACHE[id], c = hero(+d.c); if (x && c) confirmSheet(`Appliquer à ${c.name} ?`, `Les sorts et la répartition des caractéristiques de <b>${h(c.name)}</b> sont remplacés par ceux de « ${h(x.title)} ». L'équipement ne change pas.`, "Appliquer", "bd-applygo", { id, c: c.id }); return; }
    if (a === "bd-applygo") return apply(id, +d.c);
    if (a === "bd-shop") return shop(id);
    if (a === "bd-copy") return copy(id);
    if (a === "bd-report") return reportSheet(id);
    if (a === "bd-reportgo") return report(id);
    if (a === "bd-del") { const x = CACHE[id]; if (x) confirmSheet("Supprimer ce build ?", `« ${h(x.title)} » disparaît de la page Builds, avec ses ❤ et ses vues.`, "Supprimer", "bd-delgo", { id }); return; }
    if (a === "bd-delgo") return del(id);
    if (a === "bd-upd") return send(+d.c, true);
    if (a === "bd-quickupd") { U().heroMore = false; return send(+d.id, true); }
    if (a === "bd-pub") { const c = hero(U().cid) || mainHero(); if (c && X().buildSheet) X().buildSheet(c.id); return; }
    if (a === "bd-pel") { readPub(); P.el = d.v; return pubRefresh(); }
    if (a === "bd-ptag") { readPub(); const i = P.tags.indexOf(d.v); if (i >= 0) P.tags.splice(i, 1); else if (P.tags.length < 3) P.tags.push(d.v); else P.err = "Trois usages au plus."; return pubRefresh(); }
    if (a === "bd-send") return send(+d.c);
    if (a === "bd-see") { X().closeSheet(); U().tab = "builds"; U().bdOpen = null; U().bdTab = "mine"; L.at = 0; window.DX.render(); return; }
    if (a === "bd-adm") return admAct(id, d.v);
  });
  let qT = null;
  const readQ = () => { const n = $("#bdQ"); if (n) F.q = n.value; };
  document.addEventListener("input", (ev) => {
    const t = ev.target; if (!t) return;
    if (t.id === "bdQ") { F.q = t.value; clearTimeout(qT); qT = setTimeout(() => repaint(), 450); }
    if (t.id === "bdPT") P.title = t.value;
    if (t.id === "bdPN") P.note = t.value;
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target; if (!t) return;
    if (t.id === "bdSort") { readQ(); F.sort = t.value; repaint(); }
    if (t.id === "bdCmp") { U().bdCmp = +t.value; repaint(); }
    if (t.id === "bdPubHero" && X().buildSheet) { readPub(); X().buildSheet(+t.value); }
  });

  /* ---------- panel admin (onglet « Builds ») ---------- */
  function adminHtml(list) {
    const rows = !list ? `<div class="empty">Chargement…</div>` : !list.length ? `<div class="empty">Aucun build publié pour l'instant.</div>` : list.map((x) => {
      const st = x.removed ? `<span class="st m">Supprimé</span>` : x.hidden ? `<span class="st m">Caché</span>` : x.reports ? `<span class="st v">Signalé</span>` : `<span class="st mod">En ligne</span>`;
      const b = (v, n, cls = "") => `<button class="btn sm ${cls}" data-act="bd-adm" data-id="${x.id}" data-v="${v}">${n}</button>`;
      return `<div class="ln"><span class="grow"><b>${h(x.title)}</b> ${st} <span class="xs muted">${h((CLASSES[x.cls] || {}).name || x.cls)} niv. ${x.lvl} · ${x.likes} ❤ · ${x.views} vues${x.reports ? ` · ${x.reports} signalement${x.reports > 1 ? "s" : ""}` : ""}</span><br>
        ${x.note ? `<span class="small">${h(x.note)}</span><br>` : ""}<span class="xs muted">${h(x.pseudo)} · ${new Date(x.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${x.reasons ? ` · motifs : ${h(x.reasons)}` : ""}</span></span>
        <span class="acts">${x.removed ? b("restore", "Rétablir") : `${x.hidden || x.reports ? b("ok", "Remettre en ligne") : ""}${x.hidden ? "" : b("hide", "Cacher")}${b("del", "Supprimer", "danger")}`}</span></div>`;
    }).join("");
    return `<div class="box"><h2>Builds des joueurs</h2><p class="small muted">Les builds signalés, cachés ou supprimés sont en haut. Un build est caché tout seul à 3 signalements, jusqu'à ta décision : « Remettre en ligne » efface ses signalements. « Supprimer » le retire de la page (et du compte de son auteur), « Rétablir » le remet.</p>${rows}</div>`;
  }
  async function admAct(id, v) {
    const r = await ON.rpc("adm_build_set", { p_id: id, p_act: v });
    X().toast(r.err || { ok: "Build remis en ligne.", hide: "Build caché.", del: "Build supprimé.", restore: "Build rétabli." }[v]);
    L.at = 0; const b = $('[data-act="adm-reload"]'); if (b) b.click();
  }

  /* au lancement : un joueur qui a publié des builds récupère son titre « Théorycrafteur » s'il l'a mérité ailleurs */
  setTimeout(() => { const s = S(); if (s && logged() && s.chars.some((c) => c.bd) && !(s.titlesExtra || []).includes(TITLE)) mine(); }, 30000);

  window.BUILDS = { render, pubHtml, pubOpen, adminHtml, changed, budgetOf, elOf, statsOf };
})();
