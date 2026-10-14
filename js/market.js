/* ============================================================================
   HÔTEL DE VENTE et ÉCHANGES — Idlus (multijoueur, étape 4)
   Acheter et vendre entre joueurs (ressources par lots de 1, 10 ou 100, équipements avec
   leur jet exact), annonces de 14 jours, taxe de 2 % à la mise en vente, échange direct
   entre deux joueurs, et offres d'achat (0.1.33 : « j'achète N × ressource à P l'unité »). Toutes les règles sont vérifiées par le serveur (supabase/hdv.sql).
   Le serveur renvoie des « opérations » (kamas, objets, ressources) que le jeu applique à la
   partie dans l'ordre ; S.hdv.op garde le numéro de la dernière appliquée.
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const D = window.DATA, E = window.ENGINE;
  const { ITEMS, RES, SPECIAL_CRAFTS, CONSUMABLES } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const MAX = 20, TAX = 0.02, OMAX = 10;
  const M = { tab: "buy", cat: "eq", q: "", slot: "", lv: "", list: null, sel: null, offers: null, stats: null, sort: "price",
    sCat: "eq", sSel: null, lot: 100, n: 1, price: "", mine: null, busy: false, confirm: null, rep: null, trade: null, tSeen: 0, tPick: "eq", tVer: -1,
    oView: "all", oQ: "", oCat: "res", oFind: "", oSel: null, oQty: "", oPrice: "", oDays: 14, orders: null, oMine: null, detOrd: null };

  /* ---------- noms, images, catégories ---------- */
  const bucket = (cat) => ({ res: "res", rune: "runes", cons: "cons" }[cat]);
  const nameOf = (cat, key) => cat === "eq" ? (ITEMS[key] ? ITEMS[key].name : key) : cat === "rune" ? E.runeName(key) : cat === "cons" ? (CONSUMABLES[key] ? CONSUMABLES[key].name : key) : key;
  const lvlOf = (cat, key) => cat === "eq" ? (ITEMS[key] ? ITEMS[key].lvl : 0) : cat === "res" ? (RES[key] ? RES[key].lvl || 0 : 0) : 0;
  const slotOf = (cat, key) => cat === "eq" ? (ITEMS[key] ? ITEMS[key].slot : null) : cat === "res" && E.isKey(key) ? "clef" : null;
  const icon = (cat, key) => {
    if (cat === "eq") return `<span class="icobox">${X().im(X().itemImg(key), "", nameOf(cat, key))}</span>`;
    if (cat === "res") return `<span class="icobox">${X().im(X().resImg(key), "", key)}</span>`;
    if (cat === "rune") return `<span class="icobox mkrune">${X().sIco(E.runeInfo(key).stat) || "ᚱ"}</span>`;
    return `<span class="icobox mkcons">${X().consIco(CONSUMABLES[key], true)}</span>`;
  };
  const kk = (n) => `<span class="mkpx"><span class="coin"></span> ${fmt(Math.round(n))}</span>`;
  const blocked = (cat, key) => (cat === "eq" && ITEMS[key] && ITEMS[key].slot === "dofus") || (cat === "res" && SPECIAL_CRAFTS[key] && (SPECIAL_CRAFTS[key].unique || SPECIAL_CRAFTS[key].furn || SPECIAL_CRAFTS[key].idol));
  /* 0.1.38 : plus de prix minimum (on ne vend plus au jeu). Le seul plancher est 1 kama par unité.
     La « valeur de base » (l'ancienne revente au jeu) sert de repère et de garde-fou : sous la moitié du prix moyen
     (ou de cette valeur quand rien ne s'est encore vendu), le jeu demande une confirmation. */
  const floorOf = (cat, key, lot) => (cat === "eq" ? 1 : Math.max(1, lot));
  const baseOf = (cat, key, lot, it) => {
    if (cat === "eq") { const T = ITEMS[key]; const q = it ? E.itemQuality(it) : 0.5; return Math.max(1, Math.round(T.lvl * 6 * (0.6 + q * 0.6) * (it && it.radiant ? 5 : 1))); }
    if (cat === "res") return Math.max(1, E.resPrice(key) * lot);
    return lot;
  };
  const LOW = 0.5;
  const refOf = (cat, key, lot, it, st) => (st && st.avg ? Math.round(st.avg * lot) : baseOf(cat, key, lot, it));
  const CATS = [["eq", "Équipements"], ["res", "Ressources"], ["clef", "Clefs"], ["rune", "Runes"], ["cons", "Consommables"]];
  const SLOTS = [["", "Tous"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"], ["bouclier", "Boucliers"]];
  const LVLS = [["", "Tous niveaux"], ["0-50", "Niveau 1 à 50"], ["51-100", "51 à 100"], ["101-150", "101 à 150"], ["151-200", "151 à 200"]];
  const ago = (t) => { const s = (Date.now() - new Date(t)) / 1000; return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const left = (t) => { const s = (new Date(t) - Date.now()) / 1000; return s < 3600 ? `expire dans ${Math.max(1, Math.round(s / 60))} min` : s < 86400 ? `expire dans ${Math.round(s / 3600)} h` : `encore ${Math.round(s / 86400)} j`; };

  /* ---------- opérations du serveur appliquées à la partie ---------- */
  const cursor = () => { const s = S(); return (s && s.hdv && s.hdv.op) || 0; };
  const mine = () => !!(S() && ON.user && ON.profile && ON.link().uid === ON.user.id && !(ON.solo && ON.solo())); // 1.0.11 : pas de vente ni d'achat depuis une partie solo
  function apply(ops, quiet) {
    const s = S(); if (!s || !ops || !ops.length || !mine()) return 0;
    s.hdv = s.hdv || { op: 0, log: [] }; s.hdv.log = s.hdv.log || [];
    let n = 0, got = false;
    ops.slice().sort((a, b) => a.id - b.id).forEach((o) => {
      if (o.id <= (s.hdv.op || 0)) return;
      const p = o.p || {};
      if (p.k) s.kamas = Math.max(0, Math.round((s.kamas || 0) + Number(p.k)));
      ["res", "runes", "cons"].forEach((b) => { if (!p[b]) return; s[b] = s[b] || {}; for (const k in p[b]) { const v = (s[b][k] || 0) + Number(p[b][k]); if (v > 0) s[b][k] = v; else delete s[b][k]; } });
      (p.rm || []).forEach((uid) => { uid = +uid; delete s.items[uid]; s.chars.forEach((c) => { for (const sl in c.equip) if (c.equip[sl] === uid) delete c.equip[sl]; }); });
      if (p.title) { s.titlesExtra = s.titlesExtra || []; if (!s.titlesExtra.includes(p.title)) s.titlesExtra.push(String(p.title).slice(0, 40)); } // 0.1.22 : titre du boss de guilde
      if (p.untitle) { s.titlesExtra = (s.titlesExtra || []).filter((x) => x !== p.untitle); (s.chars || []).forEach((c) => { if (c.title === p.untitle) c.title = null; }); } // 0.1.49 : « Fléau des mondes » passe au podium suivant
      (p.add || []).forEach((it) => { if (!it || !ITEMS[it.tpl]) return; const uid = s.nextUid++; s.items[uid] = Object.assign({}, it, { uid }); delete s.items[uid].locked; delete s.items[uid].well; delete s.items[uid].fmLog; if (E.itemDexAdd) E.itemDexAdd(s, it.tpl); }); // 0.1.41 : passer par l'HdV efface le reliquat (comme dans DOFUS)
      s.hdv.op = o.id; n++; if (p.got) got = true;
      if (o.t) { s.hdv.log.unshift({ t: o.t, at: Date.now(), k: p.k || 0 }); if (!quiet && (p.sold || p.got)) X().toast(o.t, "rare"); }
    });
    s.hdv.log = s.hdv.log.slice(0, 40);
    if (n) { X().markDirty(); X().onPush(); X().renderStatus(); }
    if (got) { M.oMine = null; if (window.DX.ui.tab === "hdv" && M.tab === "ord") loadOMine(); } // 0.1.33 : une offre d'achat a avancé
    return n;
  }
  async function sync() {
    if (!mine()) return;
    const r = await ON.rpc("hdv_sync", { p_after: cursor() });
    if (r.data && r.data.ops) apply(r.data.ops);
  }
  async function act(name, args, okTxt) {
    if (M.busy) return null;
    if (!mine()) { X().toast(ON.user && ON.solo && ON.solo() ? ON.SOLO_ERR : "Crée ton compte (gratuit) pour acheter et vendre : ta partie te suit."); return null; }
    M.busy = true; paint();
    /* la partie en ligne doit être à jour : le serveur vérifie les kamas et le sac dedans */
    if (name === "hdv_list" || name === "hdv_buy" || name === "hdv_order_new" || name === "hdv_order_fill") { try { await X().onPush(); } catch (e) {} }
    const r = await ON.rpc(name, Object.assign({ p_after: cursor() }, args));
    M.busy = false;
    if (r.err) { X().toast(/connexion/i.test(r.err) ? r.err : "Refusé par le serveur : " + r.err); paint(); return null; }
    if (r.data && r.data.err) { X().toast(r.data.err); paint(); return null; }
    if (r.data && r.data.ops) apply(r.data.ops, true);
    if (okTxt) X().toast(okTxt);
    return r.data;
  }

  /* ---------- données ---------- */
  const lvRange = () => { const m = /^(\d+)-(\d+)$/.exec(M.lv); return m ? [+m[1], +m[2]] : [0, 1000]; };
  async function search() {
    const [a, b] = lvRange(); const cat = M.cat === "clef" ? "res" : M.cat;
    const r = await ON.rpc("hdv_search", { p_cat: cat, p_q: M.q, p_slot: M.cat === "clef" ? "clef" : M.cat === "eq" ? M.slot : "", p_lmin: a, p_lmax: b });
    M.lErr = !!r.err; // 1.0.12.8 : une panne du serveur n'est plus affichée comme une liste vide
    M.list = r.err ? [] : (r.data || []).filter((x) => M.cat !== "res" || x.slot !== "clef");
    M.list.sort((x, y) => (M.sort === "lvl" ? y.lvl - x.lvl : 0) || x.unit - y.unit);
    if (M.sel && !M.list.some((x) => x.key === M.sel)) { M.sel = null; M.offers = null; }
    if (!M.sel && M.list.length && matchMedia("(min-width:861px)").matches) return pick(M.list[0].key);
    paint();
  }
  async function pick(key) {
    M.sel = key; M.offers = null; M.stats = null; M.confirm = null; M.detOrd = null; paint();
    const [o, st, od] = await Promise.all([ON.rpc("hdv_offers", { p_key: key }), ON.rpc("hdv_stats", { p_key: key }), ON.rpc("hdv_orders_list", { p_key: key, p_q: "", p_cat: "" })]);
    if (M.sel !== key) return;
    M.offers = o.data || []; M.offErr = !!o.err; M.stats = st.data || null; M.detOrd = od.data || []; paint();
  }
  async function loadMine() { const r = await ON.rpc("hdv_mine"); M.mine = r.data || { open: [], sold: [] }; paint(); }
  async function priceHint(cat, key) { const r = await ON.rpc("hdv_stats", { p_key: key }); const o = await ON.rpc("hdv_offers", { p_key: key }); const od = cat === "eq" ? {} : await ON.rpc("hdv_orders_list", { p_key: key, p_q: "", p_cat: "" });
    M.hint = { key, st: r.data || null, low: (o.data || []).filter((x) => !x.mine)[0] || null, ord: (od.data || []).filter((x) => !x.mine)[0] || null }; paint(); }

  /* ---------- rendu ---------- */
  function render(main) {
    if (!main) return;
    window.DX.repaint(main, html());
    if (M.tab === "buy" && M.list === null) search();
    if (M.tab === "mine" && M.mine === null && mine()) loadMine();
    if (M.tab === "ord") { if (M.orders === null) loadOrders(); if (M.oMine === null && mine()) loadOMine(); }
  }
  const paint = () => { if (window.DX.ui.tab === "hdv") { const m = $("#main"); if (m) { const y = window.scrollY; window.DX.repaint(m, html()); window.scrollTo(0, y); } } }; // garde le curseur là où on écrit
  function html() {
    const s = S(); const open = M.mine ? M.mine.open.length : null;
    const login = mine() ? "" : ON.user && ON.solo && ON.solo() ? X().soloPanel("l'Hôtel de vente") : guest("acheter, vendre et échanger avec les autres joueurs");
    const panel = s && s.panelUsed ? `<p class="note">Partie retouchée par le panel de test : tu peux regarder, mais pas vendre ni acheter.</p>` : "";
    const body = M.tab === "sell" ? sellHtml() : M.tab === "mine" ? mineHtml() : M.tab === "log" ? logHtml() : M.tab === "ord" ? ordHtml() : buyHtml();
    const oOpen = M.oMine ? M.oMine.filter((x) => x.st === "open").length : null;
    return `<div class="pagehead"><h1>Hôtel de vente</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s ? s.kamas : 0)}</b> kamas</span></div>
      <nav class="subtabs">${[["buy", "Acheter"], ["sell", "Vendre"], ["ord", `Offres d'achat${oOpen !== null ? ` · ${oOpen} / ${OMAX}` : ""}`], ["mine", `Mes ventes${open !== null ? ` · ${open} / ${MAX}` : ""}`], ["log", "Historique"]].map(([id, n]) => `<button data-act="mk-tab" data-v="${id}" aria-pressed="${M.tab === id}">${n}</button>`).join("")}
      ${mine() ? `<button class="btn sm mktrade" data-act="mk-trade-ask">${X().G("chat")} ${M.trade && M.trade.st === "open" ? "Échange en cours" : "Proposer un échange"}</button>` : ""}</nav>
      <div class="stack">${login}${panel}${body}</div>`;
  }
  /* 0.1.19.4 : pas de compte obligatoire. Sans compte on regarde les prix ; on propose le compte, sans mur. */
  const guest = (what) => `<div class="panel"><div class="pad row between"><span><b>Crée ton compte pour ${what}</b><br><span class="small muted">C'est gratuit, et ta partie de cet appareil te suit sur ton compte. En attendant, tu peux regarder les prix.</span></span><button class="btn primary sm" data-act="on-loginscreen">Créer mon compte</button></div></div>`;
  const netErr = (v) => `<div class="empty">Pas de connexion au serveur : réessaie dans un moment. <button class="btn sm" data-act="mk-retry" data-v="${v}">Réessayer</button></div>`;
  const cats = (act, cur, list) => `<div class="row catchips">${(list || CATS).map(([id, n]) => `<button data-act="${act}" data-v="${id}" aria-pressed="${cur === id}">${n}</button>`).join("")}</div>`;
  function buyHtml() {
    const L = M.list;
    const bar = `<div class="row invbar"><input type="text" id="mkQ" data-act="mk-q" placeholder="Rechercher…" value="${h(M.q)}">
      ${M.cat === "eq" ? `<select data-act="mk-slot" aria-label="Emplacement">${SLOTS.map(([v, n]) => `<option value="${v}" ${M.slot === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
      ${M.cat === "eq" || M.cat === "res" ? `<select data-act="mk-lv" aria-label="Niveau">${LVLS.map(([v, n]) => `<option value="${v}" ${M.lv === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
      <select data-act="mk-sort" aria-label="Tri"><option value="price" ${M.sort === "price" ? "selected" : ""}>Tri : prix</option><option value="lvl" ${M.sort === "lvl" ? "selected" : ""}>Tri : niveau</option></select>
      <span class="small muted">${M.lErr ? "" : L ? `${L.length} en vente` : "Chargement…"}</span></div>`;
    const list = L === null ? `<div class="empty">Chargement…</div>` : M.lErr ? netErr("list") : !L.length ? `<div class="empty">Rien en vente ici pour l'instant. Sois le premier : onglet Vendre.</div>`
      : `<div class="list">${L.map((x) => `<button class="li mkli ${M.sel === x.key ? "on" : ""}" data-act="mk-pick" data-k="${h(x.key)}">${icon(x.cat, x.key)}<span class="grow"><b>${h(nameOf(x.cat, x.key))}</b><br><span class="xs muted">${x.lvl ? `niv. ${x.lvl} · ` : ""}${x.cat === "eq" ? `${x.n} en vente` : `${fmt(x.qty)} en vente`}</span></span>${kk(x.unit)}</button>`).join("")}</div>`;
    return `${bar}${cats("mk-cat", M.cat)}<div class="mkgrid ${M.sel ? "hassel" : ""}"><section class="panel mklist"><div class="phead"><h2>${h((CATS.find((c) => c[0] === M.cat) || [])[1] || "")}</h2><span class="xs muted">${M.cat === "eq" ? "à partir de" : "prix le plus bas, à l'unité"}</span></div>${list}</section>${M.sel ? detailHtml() : ""}</div>`;
  }
  function spark(days) {
    if (!days || days.length < 2) return "";
    const v = days.map((d) => +d.u); const mx = Math.max(...v), mn = Math.min(...v);
    const X_ = (i) => (i / (v.length - 1)) * 300, Y = (u) => 58 - ((u - mn) / (mx - mn || 1)) * 48;
    const d = v.map((u, i) => `${i ? "L" : "M"}${X_(i).toFixed(1)} ${Y(u).toFixed(1)}`).join(" ");
    return `<svg class="mkspark" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${d} L300 64 L0 64 Z"/><path class="l" d="${d}"/></svg>`;
  }
  function statsHtml(st, cat, key) {
    if (!st) return "";
    const res = cat === "res" ? `Valeur de base : ${fmt(E.resPrice(key))} l'unité. ` : "";
    return `<div><div class="row between"><b class="small">Prix moyen sur 14 jours</b><span class="small">${st.avg ? `<b>${fmt(st.avg)}</b> <span class="muted">/ unité</span>` : `<span class="muted">pas encore de vente</span>`}</span></div>
      ${spark(st.days)}<span class="xs muted">${res}${fmt(st.week || 0)} vendu${st.week > 1 ? "s" : ""} cette semaine.</span></div>`;
  }
  function detailHtml() {
    const key = M.sel; const x = (M.list || []).find((y) => y.key === key) || { cat: M.cat === "clef" ? "res" : M.cat, key };
    const cat = x.cat; const O = M.offers;
    const head = `<div class="phead"><div class="row">${icon(cat, key)}<div><h2>${h(nameOf(cat, key))}</h2><span class="xs muted">${lvlOf(cat, key) ? `niv. ${lvlOf(cat, key)}` : ""}${M.stats && M.stats.avg ? ` · prix moyen ${fmt(M.stats.avg * (cat === "eq" ? 1 : 1))}${cat === "eq" ? "" : " / unité"}` : ""}</span></div></div>
      <button class="btn sm mkback" data-act="mk-unpick">Retour</button></div>`;
    if (!O) return `<section class="panel mkdet">${head}<div class="pad empty">Chargement…</div></section>`;
    if (M.offErr) return `<section class="panel mkdet">${head}${netErr("offers")}</section>`;
    const buyBtn = (o) => o.mine ? `<span class="tag" style="background:var(--panel3);color:var(--ink)">ton annonce</span>`
      : o.price > ((S() && S().kamas) || 0) ? `<button class="btn sm mkshort" disabled>Il te manque ${fmt(o.price - ((S() && S().kamas) || 0))} kamas</button>` // 1.0.12.8 : grisé quand la bourse ne suffit pas (avant : refus du serveur après coup)
      : M.confirm === o.id ? `<button class="btn sm primary" data-act="mk-buy" data-id="${o.id}">Confirmer ${fmt(o.price)}</button>`
      : `<button class="btn sm primary" data-act="mk-ask" data-id="${o.id}" ${M.busy ? "disabled" : ""}>Acheter</button>`;
    if (cat === "eq") {
      const c = X().mainHero(); const T = ITEMS[key];
      const rows = O.map((o) => { const it = o.item || { tpl: key, stats: {} }; const q = Math.round(E.itemQuality(it) * 100);
        return `<div class="mkoffer"><span class="mkjet ${q >= 90 ? "hi" : ""}">jet ${q} %</span><div class="grow"><div class="mkst">${X().itemStatsHtml(it)}</div>
          <div class="xs muted">${it.radiant ? `<b style="color:var(--gold)">✦ Rayonnant +${it.radiant} %</b> · ` : ""}${it.fm ? `forgemagé ×${it.fm} · ` : ""}${c && T.lvl <= c.lvl ? X().cmpItem(c, it) : ""}</div></div>${kk(o.price)}${buyBtn(o)}</div>`; }).join("");
      return `<section class="panel mkdet">${head}<div class="list">${rows || `<div class="empty">Plus aucune offre.</div>`}</div><div class="pad stack">${statsHtml(M.stats, cat, key)}<span class="xs muted">Chaque offre est un objet précis : tu reçois exactement ce que tu vois.</span></div></section>`;
    }
    const lots = [1, 10, 100].map((q) => { const os = O.filter((o) => o.qty === q && !o.mine); const best = os[0];
      return `<div class="mklot ${best && O.filter((o) => !o.mine).every((z) => z.price / z.qty >= best.price / best.qty) ? "best" : ""}"><span class="xs muted">Lot de ${q}</span>${best ? `<b class="big">${kk(best.price)}</b><span class="xs muted">${fmt(Math.round(best.price / q * 10) / 10)} / unité · ${os.length} lot${os.length > 1 ? "s" : ""}</span>${buyBtn(best)}` : `<span class="xs muted">aucun lot</span>`}</div>`; }).join("");
    const own = O.filter((o) => o.mine).length;
    return `<section class="panel mkdet">${head}<div class="pad stack"><div class="mklots">${lots}</div>${own ? `<span class="xs muted">Dont ${own} lot${own > 1 ? "s" : ""} à toi (onglet Mes ventes).</span>` : ""}${detOrdHtml(cat, key)}${need(key)}${statsHtml(M.stats, cat, key)}</div></section>`;
  }
  /* Liste de courses : ce qu'il manque de cette ressource pour les recettes épinglées. */
  function need(key) {
    const s = S(); if (!s || !s.shop || !s.shop.length) return "";
    let want = 0; (s.shop || []).forEach((e) => { const ing = E.shopIng ? E.shopIng(s, e) : []; ing.forEach(([r, q]) => { if (r === key) want += q; }); });
    const miss = want - ((s.res || {})[key] || 0); if (miss <= 0) return "";
    return `<p class="note">${X().G("cart")} Liste de courses : il te manque <b>${fmt(miss)} ${h(key)}</b>. <button class="btn sm" data-act="mk-need" data-k="${h(key)}" data-n="${miss}">Acheter au meilleur prix</button> <button class="btn sm" data-act="mk-onew" data-c="res" data-k="${h(key)}" data-n="${miss}">Faire une offre</button></p>`;
  }
  async function buyNeed(key, n) {
    let got = 0; const O = (M.offers || []).filter((o) => !o.mine).slice().sort((a, b) => a.price / a.qty - b.price / b.qty);
    for (const o of O) { if (got >= n) break; if (o.qty > (n - got) * 1.5 && got) continue; const r = await act("hdv_buy", { p_id: o.id }); if (!r) break; got += o.qty; }
    if (got) X().toast(`${fmt(got)} ${key} achetés.`); pick(key);
  }

  /* ---------- vendre ---------- */
  function sellable(cat) {
    const s = S(); if (!s) return [];
    if (cat === "eq") return Object.values(s.items).filter((it) => ITEMS[it.tpl] && !it.locked && !E.equippedBy(s, it.uid) && !E.inGear(s, it.uid) && !blocked("eq", it.tpl))
      .sort((a, b) => ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl).map((it) => ({ cat, key: it.tpl, uid: it.uid, it, n: 1 }));
    const b = cat === "clef" ? "res" : bucket(cat); const o = s[b] || {};
    return Object.keys(o).filter((k) => o[k] > 0 && !blocked(b === "res" ? "res" : cat, k) && (cat === "clef" ? E.isKey(k) : cat === "res" ? !E.isKey(k) : true))
      .sort((x, y) => (cat === "res" ? lvlOf("res", y) - lvlOf("res", x) : 0) || x.localeCompare(y, "fr")).map((k) => ({ cat: cat === "clef" ? "res" : cat, key: k, n: o[k] }));
  }
  function sellHtml() {
    if (!mine()) return "";
    let items = sellable(M.sCat);
    if (M.sCat === "eq" && typeof grpItems === "function") items = grpItems(items.map((x) => x.it)).map((gr) => { const it = gr.items.find((y) => String(y.uid) === M.sSel) || gr.rep; return { cat: "eq", key: it.tpl, uid: it.uid, it, n: 1, cnt: gr.items.length }; }); // 1.0.8.8 : exemplaires identiques sur une case
    items = items.slice(0, 120);
    const sel = items.find((x) => (x.uid ? String(x.uid) : x.key) === M.sSel);
    const grid = items.length ? `<div class="invgrid">${items.map((x) => { const id = x.uid ? String(x.uid) : x.key;
      return `<button class="itile ${id === M.sSel ? "on" : ""}" data-act="mk-ssel" data-v="${h(id)}" ${x.uid ? `data-tipitem="${x.uid}"` : `data-tip="${h(nameOf(x.cat, x.key))}"`}>${x.cat === "eq" ? X().im(X().itemImg(x.key), "", "") : x.cat === "res" ? X().im(X().resImg(x.key), "", "") : `<span class="mkbig">${x.cat === "rune" ? X().sIco(E.runeInfo(x.key).stat) : h((CONSUMABLES[x.key] || {}).icon || "•")}</span>`}${x.cat === "eq" ? `<span class="ilvl">${ITEMS[x.key].lvl}</span>${x.cnt > 1 ? `<span class="icount">×${x.cnt}</span>` : ""}` : `<span class="icount">×${fmt(x.n)}</span>`}</button>`; }).join("")}</div>`
      : `<div class="empty">Rien à vendre dans cette catégorie.</div>`;
    return `${cats("mk-scat", M.sCat)}<span class="small muted">Les objets équipés, verrouillés ou rangés dans un équipement enregistré, les Dofus, les trophées et les objets uniques n'apparaissent pas.</span>
      <div class="mkgrid ${sel ? "hassel" : ""}"><section class="panel mklist"><div class="phead"><h2>Ton sac</h2><span class="xs muted">choisis ce que tu vends</span></div><div class="pad">${grid}</div></section>${sel ? sellForm(sel) : ""}</div>`;
  }
  function sellForm(x) {
    const s = S(); const res = x.cat !== "eq"; const lot = res ? M.lot : 1; const maxN = res ? Math.min(MAX, Math.floor(x.n / lot)) : 1; const n = Math.max(1, Math.min(M.n, maxN || 1));
    const price = Math.round(+String(M.price).replace(/\s/g, "")) || 0; const tax = price ? Math.max(1, Math.ceil(price * TAX)) : 0; const floor = floorOf(x.cat, x.key, lot);
    const used = M.mine ? M.mine.open.length : 0; const hint = M.hint && M.hint.key === x.key ? M.hint : null;
    const base = baseOf(x.cat, x.key, lot, x.it); const st = hint && hint.st; const ref = refOf(x.cat, x.key, lot, x.it, st);
    const sug = st && st.avg ? Math.max(floor, Math.round(st.avg * lot)) : null;
    const low = price >= floor && price < ref * LOW && M.lowOk !== `${x.key}|${price}|${lot}`; // 1.0.12.8 : « N % de moins » plafonné à 99 (« 100 % » se lisait « gratuit »)
    const unitTxt = (v) => (res ? `${fmt(Math.round(v / lot * 10) / 10)} l'unité` : fmt(v));
    const why = !price ? "Indique un prix." : price < floor ? (res ? `Au moins 1 kama par unité (${fmt(floor)} le lot).` : "Au moins 1 kama.") : res && x.n < lot ? `Il t'en faut au moins ${lot}.` : used + n > MAX ? "Plus de place de vente." : tax * n > s.kamas ? "Pas assez de kamas pour la taxe." : "";
    return `<section class="panel mkdet"><div class="phead"><div class="row">${icon(x.cat, x.key)}<div><h2>${h(nameOf(x.cat, x.key))}</h2><span class="xs muted">${x.cat === "eq" ? `niv. ${ITEMS[x.key].lvl} · jet ${Math.round(E.itemQuality(x.it) * 100)} %${x.it.radiant ? " · ✦ Rayonnant" : ""}${x.it.fm ? ` · forgemagé ×${x.it.fm}` : ""}` : `tu en as ${fmt(x.n)}`}</span></div></div><button class="btn sm mkback" data-act="mk-ssel" data-v="">Retour</button></div>
      <div class="pad stack">
        ${res ? `<div class="mkfield"><span class="small"><b>Taille du lot</b></span><span class="seg">${[1, 10, 100].map((q) => `<button data-act="mk-lot" data-v="${q}" aria-pressed="${lot === q}" ${x.n < q ? "disabled" : ""}>×${q}</button>`).join("")}</span></div>
          <div class="mkfield"><span class="small"><b>Nombre de lots</b></span><span class="row"><span class="seg"><button data-act="mk-n" data-v="-1">−</button><button aria-pressed="true">${n}</button><button data-act="mk-n" data-v="1">+</button></span><span class="xs muted">${fmt(n * lot)} sur ${fmt(x.n)}</span></span></div>` : ""}
        <div class="mkfield"><span class="small"><b>${res ? "Prix d'un lot" : "Ton prix"}</b></span><input type="text" inputmode="numeric" class="mkbigin" id="mkPrice" data-act="mk-price" value="${h(M.price)}" placeholder="${sug || base}"></div>
        <div class="mkrefs"><div><span class="xs muted">Prix moyen des ventes (14 j)</span><b>${!hint ? "…" : st && st.avg ? `${fmt(Math.round(st.avg * lot))}` : "pas encore de vente"}</b></div><div><span class="xs muted">Valeur de base</span><b>${fmt(base)}</b></div></div>
        <div class="mkfield"><span></span><span class="xs muted">${hint ? `${hint.low ? `Le moins cher en vente : <b>${fmt(hint.low.price)}</b>${hint.low.qty > 1 ? ` le lot de ${hint.low.qty}` : ""}. ` : ""}` : "Recherche des prix… "}${res ? `Prix pour un lot de ${lot}. ` : ""}Pas de prix minimum : 1 kama par unité au plus bas.</span></div>
        ${res ? sellOrdHtml(x, hint, price, lot, n) : ""}
        <div class="mksum"><span>Taxe de mise en vente (2 %)${n > 1 ? ` × ${n}` : ""}</span><b>− ${fmt(tax * n)}</b><span>Durée</span><b>14 jours</b><span class="tot">Tu recevras à la vente</span><b class="tot">${kk(price * n)}</b></div>
        <div><div class="row between xs"><span>Places de vente</span><b>${used + n} / ${MAX}</b></div><div class="mkslots">${Array.from({ length: MAX }, (_, i) => `<i class="${i < used ? "on" : i < used + n ? "new" : ""}"></i>`).join("")}</div></div>
        ${low && !why ? `<div class="mklow"><span><b>Ce prix est très bas, tu confirmes ?</b> ${unitTxt(price)}, soit ${Math.min(99, Math.round((1 - price / ref) * 100))} % de moins que ${st && st.avg ? "le prix moyen" : "la valeur de base"} (${unitTxt(ref)}).</span>
          <span class="row"><button class="btn sm mkwarnbtn" data-act="mk-lowok" data-v="${h(`${x.key}|${price}|${lot}`)}">Oui, vendre à ${fmt(price)}</button><button class="btn sm" data-act="mk-lowfix" data-i="mkPrice">Corriger le prix</button></span></div>`
          : `<button class="btn primary" data-act="mk-sell" ${why || M.busy ? "disabled" : ""}>${res && n > 1 ? `Mettre ${n} lots en vente` : "Mettre en vente"}</button>`}
        <span class="xs ${why ? "" : "muted"}" ${why ? 'style="color:var(--danger)"' : ""}>${why || "L'objet quitte ton sac tout de suite et attend sur le serveur. Si tu le retires, il revient dans ton sac mais la taxe est perdue."}</span>
      </div></section>`;
  }
  async function doSell() {
    const x = sellable(M.sCat).find((y) => (y.uid ? String(y.uid) : y.key) === M.sSel); if (!x) return;
    const res = x.cat !== "eq"; const price = Math.round(+String(M.price).replace(/\s/g, "")) || 0; const lot = res ? M.lot : 1;
    const n = res ? Math.max(1, Math.min(M.n, Math.floor(x.n / lot))) : 1;
    if (price < floorOf(x.cat, x.key, lot)) return X().toast("Au moins 1 kama par unité.");
    const r = await act("hdv_list", { p_cat: x.cat, p_key: x.key, p_uid: x.uid || null, p_lot: lot, p_n: n, p_price: price, p_name: nameOf(x.cat, x.key), p_lvl: lvlOf(x.cat, x.key), p_slot: slotOf(x.cat, x.key) }, res && n > 1 ? `${n} lots mis en vente.` : "Mis en vente.");
    if (r) { M.sSel = null; M.price = ""; M.n = 1; M.mine = null; M.list = null; loadMine(); }
  }

  /* ---------- mes ventes, historique ---------- */
  function mineHtml() {
    if (!mine()) return "";
    const m = M.mine; if (!m) return `<div class="empty">Chargement…</div>`;
    const since = (S().hdv && S().hdv.seen) || 0; const fresh = m.sold.filter((x) => new Date(x.at) > since);
    const sum = fresh.reduce((a, x) => a + x.price, 0);
    const row = (x) => `${icon(x.cat, x.key)}<span class="grow"><b>${h(nameOf(x.cat, x.key))}</b> <span class="xs muted">${x.cat === "eq" && x.item ? `jet ${Math.round(E.itemQuality(x.item) * 100)} %` : `×${x.qty}`}</span>`;
    return `${fresh.length ? `<div class="panel" style="border-color:var(--gold)"><div class="pad row between"><span><b>${fresh.length} vente${fresh.length > 1 ? "s" : ""} depuis ta dernière visite</b><br><span class="small muted">Les kamas sont déjà dans ta bourse.</span></span><b class="mkpx plus" style="font-size:20px">+ ${fmt(sum)}</b></div></div>` : ""}
      <section class="panel"><div class="phead"><h2>En vente</h2><span class="xs muted">${m.open.length} / ${MAX} places</span></div><div class="list">
        ${m.open.map((x) => `<div class="li mkrow">${row(x)}<br><span class="xs ${new Date(x.exp) - Date.now() < 86400000 ? "mkwarn" : "muted"}">${left(x.exp)}</span></span>${kk(x.price)}
          ${M.rep === x.id ? `<input type="text" inputmode="numeric" class="mkrep" id="mkRep" value="${x.price}"><button class="btn sm primary" data-act="mk-repgo" data-id="${x.id}">OK</button>` : `<button class="btn sm" data-act="mk-rep" data-id="${x.id}">Modifier le prix</button>`}
          <button class="btn sm" data-act="mk-cancel" data-id="${x.id}" ${M.busy ? "disabled" : ""}>Retirer</button></div>`).join("") || `<div class="empty">Aucune annonce. Onglet Vendre pour en créer.</div>`}
      </div></section>
      ${M.rep ? `<span class="xs muted">Changer le prix coûte de nouveau 2 % du nouveau prix, comme dans DOFUS.</span>` : ""}
      <section class="panel"><div class="phead"><h2>Vendu ces 7 jours</h2></div><div class="list">${m.sold.map((x) => `<div class="li mkrow">${row(x)} · acheté par <b>${h(x.buyer || "un joueur")}</b><br><span class="xs muted">${ago(x.at)}</span></span>${kk(x.price)}</div>`).join("") || `<div class="empty">Rien de vendu cette semaine.</div>`}</div></section>
      <span class="xs muted">Une annonce dure 14 jours ; à la fin, l'objet revient seul dans ton sac.</span>`;
  }
  function logHtml() {
    const L = (S() && S().hdv && S().hdv.log) || [];
    return `<section class="panel"><div class="phead"><h2>Historique</h2><span class="xs muted">tes 40 derniers mouvements</span></div><div class="list">${L.map((x) => `<div class="li small"><span class="grow">${h(x.t)}<br><span class="xs muted">${ago(x.at)}</span></span>${x.k ? `<b class="mkpx ${x.k > 0 ? "plus" : ""}">${x.k > 0 ? "+" : "−"} ${fmt(Math.abs(x.k))}</b>` : ""}</div>`).join("") || `<div class="empty">Aucun mouvement pour l'instant.</div>`}</div></section>`;
  }


  /* ---------- offres d'achat (0.1.33) ----------
     L'acheteur fixe la ressource, la quantité et le prix à l'unité ; ses kamas (taxe de 2 % comprise)
     sont mis de côté par le serveur. Les vendeurs remplissent tout ou une partie et sont payés tout
     de suite. La taxe ne porte que sur ce qui est vraiment reçu : le reste revient à la fin. */
  const OCATS = [["res", "Ressources"], ["clef", "Clefs"], ["rune", "Runes"], ["cons", "Consommables"]];
  const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const haveOf = (cat, key) => { const s = S(); return s ? ((s[bucket(cat)] || {})[key] || 0) : 0; };
  const oFloor = () => 1;
  const oBase = (cat, key) => cat === "res" ? Math.max(1, E.resPrice(key)) : 1;
  const oLowTag = (o) => o.cat === "res" && o.price < oBase(o.cat, o.key) * LOW ? `<span class="tag mklowtag">très bas</span>` : "";
  const oSort = (L) => L.slice().sort((a, b) => (oLowTag(a) ? 1 : 0) - (oLowTag(b) ? 1 : 0));
  const oTax = (tot) => tot > 0 ? Math.ceil(tot * TAX) : 0;
  let RUNES = null;
  function catalog(c) {
    if (c === "rune") { if (!RUNES) { RUNES = []; Object.keys(D.STATS).forEach((st) => ["", "pa", "ra"].forEach((t) => RUNES.push(E.runeKey(t, st)))); } return RUNES.map((k) => ["rune", k]); }
    if (c === "cons") return Object.keys(CONSUMABLES).map((k) => ["cons", k]);
    return Object.keys(RES).filter((k) => !blocked("res", k) && (c === "clef" ? E.isKey(k) : !E.isKey(k))).map((k) => ["res", k]);
  }
  async function loadOrders() { const r = await ON.rpc("hdv_orders_list", { p_key: "", p_q: M.oQ, p_cat: "" }); M.orders = r.data || []; M.ordErr = !!r.err; paint(); }
  async function loadOMine() { if (!mine()) return; const r = await ON.rpc("hdv_orders_mine"); M.oMine = r.data || []; paint(); }
  const fillBtn = (o, cls) => {
    if (o.mine) return `<span class="tag" style="background:var(--panel3);color:var(--ink)">ton offre</span>`;
    const have = haveOf(o.cat, o.key); const n = Math.min(have, o.left);
    return n > 0 ? `<button class="btn sm primary ${cls || ""}" data-act="mk-ofill" data-id="${o.id}" data-n="${n}" data-nm="${h(nameOf(o.cat, o.key))}" data-p="${o.price}" ${M.busy ? "disabled" : ""}>Vendre ${fmt(n)}</button>`
      : `<span class="xs muted">tu n'en as pas</span>`;
  };
  const ordLine = (o, withName) => `<div class="li mkrow mkord">${withName ? icon(o.cat, o.key) : ""}<span class="grow">${withName ? `<b>${h(nameOf(o.cat, o.key))}</b><br>` : ""}<span class="xs muted">${fmt(o.left)} voulue${o.left > 1 ? "s" : ""}${o.left < o.qty ? ` sur ${fmt(o.qty)}` : ""} · ${left(o.exp)}${haveOf(o.cat, o.key) ? ` · tu en as ${fmt(haveOf(o.cat, o.key))}` : ""}</span></span>${kk(o.price)}<span class="xs muted">/ unité</span>${oLowTag(o)}${fillBtn(o)}</div>`;
  /* Fiche d'une ressource (onglet Acheter) : les meilleures offres d'achat à côté des lots en vente. */
  function detOrdHtml(cat, key) {
    if (M.detOrd === null) return "";
    const L = oSort(M.detOrd).slice(0, 4);
    return `<div class="mkobox"><div class="row between"><b>On achète</b><span class="xs muted">meilleur prix d'abord</span></div>
      ${L.length ? `<div class="list">${L.map((o) => ordLine(o, false)).join("")}</div>` : `<span class="xs muted">Personne ne demande cette ressource pour l'instant.</span>`}
      ${mine() && !L.some((o) => o.mine) ? `<div><button class="btn sm" data-act="mk-onew" data-c="${cat}" data-k="${h(key)}">Faire une offre d'achat</button></div>` : ""}</div>`;
  }
  /* Vendre (Q8) : si quelqu'un achète déjà au prix demandé ou plus, le jeu propose de lui vendre directement. */
  function sellOrdHtml(x, hint, price, lot, n) {
    const o = hint && hint.ord; if (!o) return "";
    if (price && price / lot > o.price) return `<span class="xs muted">Une offre d'achat paie ${fmt(o.price)} l'unité (${fmt(o.left)} voulues).</span>`;
    const q = Math.min(x.n, o.left, price ? n * lot : x.n);
    return `<p class="note mkonote">Quelqu'un achète déjà à <b>${fmt(o.price)}</b> kamas l'unité (${fmt(o.left)} voulues). Vendre directement ?
      <button class="btn sm primary" data-act="mk-ofill" data-id="${o.id}" data-n="${q}" data-nm="${h(nameOf(x.cat, x.key))}" data-p="${o.price}" ${M.busy ? "disabled" : ""}>Vendre ${fmt(q)} pour ${fmt(q * o.price)}</button></p>`;
  }
  function ordHtml() {
    const open = M.oMine ? M.oMine.filter((x) => x.st === "open").length : 0;
    const seg = `<div class="row catchips">${[["all", "On achète"], ["mine", `Mes offres${M.oMine ? ` · ${open} / ${OMAX}` : ""}`]].map(([id, n]) => `<button data-act="mk-oview" data-v="${id}" aria-pressed="${M.oView === id}">${n}</button>`).join("")}</div>`;
    if (M.oView === "mine") return seg + (mine() ? oMineHtml(open) : "");
    const L = M.orders;
    const list = L === null ? `<div class="empty">Chargement…</div>` : M.ordErr ? netErr("ord") : !L.length ? `<div class="empty">Aucune offre d'achat${M.oQ ? " pour cette recherche" : ""} pour l'instant.</div>`
      : `<div class="list">${oSort(L).map((o) => ordLine(o, true)).join("")}</div>`;
    return `${seg}<div class="row invbar"><input type="text" id="mkOQ" data-act="mk-oq" placeholder="Rechercher une ressource…" value="${h(M.oQ)}"><span class="small muted">${L && !M.ordErr ? `${L.length} offre${L.length > 1 ? "s" : ""}` : ""}</span></div>
      <section class="panel"><div class="phead"><h2>Les joueurs achètent</h2><span class="xs muted">tu es payé tout de suite, même si l'acheteur n'est pas là</span></div>${list}</section>
      <span class="xs muted">Tu peux vendre tout ou une partie. Les acheteurs restent anonymes.</span>`;
  }
  function oMineHtml(open) {
    const s = S(); const sel = M.oSel;
    const found = M.oFind.trim().length >= 2 ? catalog(M.oCat).filter(([c, k]) => norm(nameOf(c, k)).includes(norm(M.oFind.trim()))).slice(0, 24) : [];
    let form;
    if (!sel) {
      form = `${cats("mk-ocat", M.oCat, OCATS)}<input type="text" id="mkOF" data-act="mk-ofind" placeholder="Nom de la ressource (2 lettres au moins)…" value="${h(M.oFind)}">
        ${found.length ? `<div class="list">${found.map(([c, k]) => `<button class="li mkli" data-act="mk-opick" data-c="${c}" data-k="${h(k)}">${icon(c, k)}<span class="grow"><b>${h(nameOf(c, k))}</b><br><span class="xs muted">${lvlOf(c, k) ? `niv. ${lvlOf(c, k)} · ` : ""}tu en as ${fmt(haveOf(c, k))}</span></span></button>`).join("")}</div>`
          : `<span class="xs muted">${M.oFind.trim().length >= 2 ? "Rien trouvé." : "Écris le nom de ce que tu veux acheter."}</span>`}`;
    } else {
      const qty = Math.max(0, Math.round(+String(M.oQty).replace(/\s/g, "")) || 0); const price = Math.max(0, Math.round(+String(M.oPrice).replace(/\s/g, "")) || 0);
      const tot = qty * price, tax = oTax(tot), floor = oFloor(sel.cat, sel.key); const hint = M.hint && M.hint.key === sel.key ? M.hint : null;
      const base = oBase(sel.cat, sel.key); const ref = hint && hint.st && hint.st.avg ? hint.st.avg : base;
      const low = price >= floor && price < ref * LOW && M.lowOk !== `o|${sel.key}|${price}`; // 1.0.12.8 : « N % de moins » plafonné à 99 (« 100 % » se lisait « gratuit »)
      const dup = M.oMine && M.oMine.some((o) => o.st === "open" && o.key === sel.key);
      const why = !qty ? "Indique une quantité." : qty > 100000 ? "100 000 au maximum." : !price ? "Indique un prix à l'unité." : price < floor ? "Au moins 1 kama l'unité." : tot > 2e9 ? "Offre trop grosse." : open >= OMAX ? `Déjà ${OMAX} offres en cours.` : dup ? "Tu as déjà une offre pour cette ressource." : tot + tax > s.kamas ? "Pas assez de kamas." : "";
      form = `<div class="row">${icon(sel.cat, sel.key)}<div class="grow"><b>${h(nameOf(sel.cat, sel.key))}</b><br><span class="xs muted">tu en as ${fmt(haveOf(sel.cat, sel.key))}</span></div><button class="btn sm" data-act="mk-opick" data-k="">Changer</button></div>
        <div class="mkfield"><span class="small"><b>Quantité</b></span><input type="text" inputmode="numeric" class="mkbigin" id="mkOQty" data-act="mk-oqty" value="${h(M.oQty)}" placeholder="100"></div>
        <div class="mkfield"><span class="small"><b>Prix à l'unité</b></span><input type="text" inputmode="numeric" class="mkbigin" id="mkOPrice" data-act="mk-oprice" value="${h(M.oPrice)}" placeholder="${Math.round(ref)}"></div>
        <div class="mkfield"><span></span><span class="xs muted">${hint ? `${hint.low ? `En vente dès <b>${fmt(Math.round(hint.low.price / hint.low.qty * 10) / 10)}</b> l'unité. ` : "Rien en vente. "}${hint.ord ? `Meilleure offre : <b>${fmt(hint.ord.price)}</b>. ` : ""}${hint.st && hint.st.avg ? `Moyenne des ventes : <b>${fmt(hint.st.avg)}</b>. ` : ""}` : "Recherche des prix… "}Valeur de base : ${fmt(base)}. Pas de prix minimum.</span></div>
        <div class="mkfield"><span class="small"><b>Durée</b></span><span class="seg">${[3, 7, 14].map((d) => `<button data-act="mk-odays" data-v="${d}" aria-pressed="${M.oDays === d}">${d} j</button>`).join("")}</span></div>
        <div class="mksum"><span>${fmt(qty)} × ${fmt(price)}</span><b>${fmt(tot)}</b><span>Taxe 2 % (seulement sur ce que tu reçois)</span><b>${fmt(tax)}</b><span class="tot">Mis de côté maintenant</span><b class="tot">${kk(tot + tax)}</b></div>
        ${low && !why ? `<div class="mklow"><span><b>Ce prix est très bas, tu confirmes ?</b> ${fmt(price)} l'unité, soit ${Math.min(99, Math.round((1 - price / ref) * 100))} % de moins que ${hint && hint.st && hint.st.avg ? "le prix moyen" : "la valeur de base"} (${fmt(Math.round(ref))}). Ton offre sera rangée en bas de la liste avec l'étiquette « très bas ».</span>
          <span class="row"><button class="btn sm mkwarnbtn" data-act="mk-lowok" data-v="${h(`o|${sel.key}|${price}`)}">Oui, publier à ${fmt(price)}</button><button class="btn sm" data-act="mk-lowfix" data-i="mkOPrice">Corriger le prix</button></span></div>`
          : `<button class="btn primary" data-act="mk-onewgo" ${why || M.busy ? "disabled" : ""}>Publier l'offre</button>`}
        <span class="xs ${why ? "" : "muted"}" ${why ? 'style="color:var(--danger)"' : ""}>${why || "Tu reçois la marchandise même hors ligne. Si tu retires l'offre ou à la fin, les kamas qui n'ont pas servi te reviennent, taxe comprise."}</span>`;
    }
    const L = M.oMine;
    const rows = L === null ? `<div class="empty">Chargement…</div>` : !L.length ? `<div class="empty">Aucune offre pour l'instant.</div>`
      : L.map((o) => { const pct = Math.round(o.filled / o.qty * 100);
        return `<div class="li mkrow mkord">${icon(o.cat, o.key)}<span class="grow"><b>${h(nameOf(o.cat, o.key))}</b> · ${kk(o.price)} <span class="xs muted">l'unité</span><br>
          <span class="xs muted">${fmt(o.filled)} / ${fmt(o.qty)} reçus · ${o.st === "open" ? left(o.exp) : o.st === "done" ? `complète ${ago(o.at)}` : `terminée ${ago(o.at)}`}</span><span class="mkobar"><i style="width:${pct}%"></i></span></span>
          ${o.st === "open" ? `<button class="btn sm" data-act="mk-ocancel" data-id="${o.id}" ${M.busy ? "disabled" : ""}>Retirer</button>` : `<span class="tag ${o.st === "done" ? "good" : ""}" ${o.st === "done" ? "" : 'style="background:var(--panel3);color:var(--ink)"'}>${o.st === "done" ? "Complète" : "Terminée"}</span>`}</div>`; }).join("");
    return `<div class="grid2"><section class="panel"><div class="phead"><h2>Nouvelle offre</h2><span class="xs muted">${open} / ${OMAX}</span></div><div class="pad stack">${form}</div></section>
      <section class="panel"><div class="phead"><h2>Mes offres</h2><span class="xs muted">en cours et 7 derniers jours</span></div><div class="list">${rows}</div></section></div>`;
  }
  function oPick(cat, key, qty) {
    M.oSel = key ? { cat, key } : null; M.oPrice = ""; if (qty) M.oQty = String(qty); else if (!key) M.oQty = "";
    if (key) priceHint(cat, key);
  }

  /* ---------- échange direct ---------- */
  async function tradePoll() {
    if (!mine()) return;
    const r = await ON.rpc("trade_state"); const t = r.data || null;
    const was = M.trade; M.trade = t;
    const sig = JSON.stringify(t); const same = sig === M.tSig; M.tSig = sig;
    if (t && t.st === "open" && (!was || was.id !== t.id) && t.me === "b" && M.tSeen !== t.id) { M.tSeen = t.id; X().toast(`${t.pa} te propose un échange.`, "rare"); }
    if (t && t.st === "done" && was && was.st === "open") { sync(); X().toast("Échange terminé !", "rare"); }
    if (t && t.st === "cancel" && was && was.st === "open") X().toast("Échange annulé.");
    if (t && t.st === "open" && t.me === "b" && !$("#mkTrade") && M.tSeen === t.id && (!was || was.id !== t.id)) tradeSheet();
    else if ($("#mkTrade") && !same) tradeSheet(); // pas de nouveau dessin si rien n'a changé (on ne perd pas ce qu'on tape)
  }
  function offerHtml(t, side) {
    const o = t["o" + side] || {}; const its = t["i" + side] || []; const res = [];
    ["res", "runes", "cons"].forEach((b) => { for (const k in o[b] || {}) res.push([b === "runes" ? "rune" : b, k, o[b][k]]); });
    const tiles = its.map((x) => x.it && ITEMS[x.it.tpl] ? `<span class="itile" data-tip="${h(ITEMS[x.it.tpl].name)} · jet ${Math.round(E.itemQuality(x.it) * 100)} %">${X().im(X().itemImg(x.it.tpl), "", "")}<span class="ilvl">${ITEMS[x.it.tpl].lvl}</span></span>` : "").join("")
      + res.map(([c, k, q]) => `<span class="itile" data-tip="${h(nameOf(c, k))}">${c === "res" ? X().im(X().resImg(k), "", "") : `<span class="mkbig">${c === "rune" ? X().sIco(E.runeInfo(k).stat) : X().consIco(CONSUMABLES[k], true)}</span>`}<span class="icount">×${fmt(q)}</span></span>`).join("");
    return `<div class="mktiles">${tiles || `<span class="xs muted">rien pour l'instant</span>`}</div><span class="small">${kk(o.k || 0)}</span>`;
  }
  function tradeSheet() {
    const t = M.trade;
    if (!t) { if ($("#mkTrade")) X().closeSheet(); return; }
    const me = t.me, other = me === "a" ? "b" : "a"; const myOk = t["k" + me], hisOk = t["k" + other];
    const done = t.st !== "open";
    const items = sellable(M.tPick).slice(0, 60); const o = t["o" + me] || {};
    const inOffer = (x) => x.uid ? (o.items || []).includes(x.uid) : !!((o[bucket(x.cat) || "res"] || {})[x.key]);
    X().openSheet(`<div id="mkTrade" class="stack"><h2>Échange avec ${h(t["p" + other])}</h2>
      ${done ? `<p class="note">${t.st === "done" ? "Échange terminé : tout est dans ton sac." : `Échange annulé${t.note && t.note !== "annulé" ? ` (${h(t.note.replace("annulé par ", "par "))})` : ""}.`}</p>` : `<span class="small muted">Chacun pose ce qu'il donne. L'échange se fait quand les deux ont validé ; si quelqu'un change quelque chose, les validations s'annulent.</span>`}
      <div class="mktrade2"><div class="mkside ${myOk ? "ok" : ""}"><b>Tu donnes</b>${offerHtml(t, me)}<span class="tag ${myOk ? "good" : ""}" ${myOk ? "" : 'style="background:var(--panel3);color:var(--ink)"'}>${myOk ? "✓ validé" : "pas encore validé"}</span></div>
        <div class="mkside ${hisOk ? "ok" : ""}"><b>${h(t["p" + other])} donne</b>${offerHtml(t, other)}<span class="tag ${hisOk ? "good" : ""}" ${hisOk ? "" : 'style="background:var(--panel3);color:var(--ink)"'}>${hisOk ? "✓ validé" : "pas encore validé"}</span></div></div>
      ${done ? `<div><button class="btn" data-act="closesheet">Fermer</button></div>` : `
      <details class="mkadd" ${M.tOpen ? "open" : ""}><summary>Ajouter ou retirer ce que tu donnes</summary>
        <div class="row" style="margin:8px 0"><span class="small">Kamas</span><input type="text" inputmode="numeric" id="mkTK" value="${o.k || 0}" style="width:130px"><button class="btn sm" data-act="mk-tk">OK</button></div>
        ${cats("mk-tpick", M.tPick)}
        <div class="invgrid" style="margin-top:8px">${items.map((x) => { const id = x.uid ? String(x.uid) : x.key; const on = inOffer(x);
          return `<button class="itile ${on ? "on" : ""}" data-act="mk-tadd" data-v="${h(id)}" ${x.uid ? `data-tipitem="${x.uid}"` : `data-tip="${h(nameOf(x.cat, x.key))} (${fmt(x.n)})"`}>${x.cat === "eq" ? X().im(X().itemImg(x.key), "", "") : x.cat === "res" ? X().im(X().resImg(x.key), "", "") : `<span class="mkbig">${x.cat === "rune" ? X().sIco(E.runeInfo(x.key).stat) : h((CONSUMABLES[x.key] || {}).icon || "•")}</span>`}${x.cat === "eq" ? `<span class="ilvl">${ITEMS[x.key].lvl}</span>` : `<span class="icount">×${fmt(x.n)}</span>`}</button>`; }).join("") || `<span class="xs muted">Rien dans cette catégorie.</span>`}</div>
        <span class="xs muted">Un clic ajoute (ressources : tout le tas, modifiable ci-dessous) ; un second clic retire.</span>
        ${["res", "runes", "cons"].map((b) => Object.keys(o[b] || {}).map((k) => `<div class="row small" style="margin-top:6px">${h(nameOf(b === "runes" ? "rune" : b, k))} <input type="text" inputmode="numeric" data-tq="${b}|${h(k)}" value="${o[b][k]}" style="width:90px"><button class="btn xs" data-act="mk-tq" data-v="${b}|${h(k)}">OK</button></div>`).join("")).join("")}
      </details>
      <div class="row"><button class="btn primary" data-act="mk-tok" ${myOk ? "disabled" : ""}>${myOk ? "En attente de l'autre…" : "Valider l'échange"}</button><button class="btn" data-act="mk-tcancel">Annuler</button></div>
      <span class="xs muted">Pas de taxe. Un échange par minute au maximum. Les Dofus et les trophées ne s'échangent pas.</span>`}</div>`);
  }
  async function tradeSet(fn) {
    const t = M.trade; if (!t || t.st !== "open") return;
    const o = JSON.parse(JSON.stringify(t["o" + t.me] || {})); fn(o);
    const r = await ON.rpc("trade_offer", { p_id: t.id, p_offer: o });
    if (r.err || (r.data && r.data.err)) X().toast(r.err || r.data.err);
    await tradePoll();
  }
  function tradeAsk(pseudo) {
    X().openSheet(`<h2>Proposer un échange</h2><span class="small muted">Écris le pseudo du joueur. Il reçoit la demande s'il est connecté.</span>
      <input type="text" id="mkTP" value="${h(pseudo || "")}" placeholder="Pseudo" maxlength="16"><div class="row"><button class="btn primary" data-act="mk-tgo">Proposer</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
  }
  async function tradeStart(p) {
    if (!p) return;
    try { await X().onPush(); } catch (e) {}
    const r = await ON.rpc("trade_start", { p_pseudo: p });
    if (r.err || (r.data && r.data.err)) return X().toast(r.err || r.data.err);
    M.tOpen = true; await tradePoll(); tradeSheet();
  }

  /* ---------- panel admin (onglet « Hôtel de vente ») ---------- */
  function adminHtml(a) {
    if (!a) return `<div class="box"><div class="empty">Chargement…</div></div>`;
    return `<div class="kpis"><div class="kpi"><b>${fmt(a.open)}</b><span>annonces en cours</span></div><div class="kpi"><b>${fmt(a.sellers)}</b><span>vendeurs</span></div><div class="kpi"><b>${fmt(a.sales7)}</b><span>ventes en 7 jours</span></div><div class="kpi"><b>${fmt(a.vol7)}</b><span>kamas échangés en 7 jours</span></div><div class="kpi"><b>${fmt(a.trades7)}</b><span>échanges directs en 7 jours</span></div>${a.orders != null ? `<div class="kpi"><b>${fmt(a.orders)}</b><span>offres d'achat en cours</span></div>` : ""}</div>
      <div class="two"><div class="box"><h2>Dernières ventes</h2>${(a.last || []).map((x) => `<div class="ln"><span class="t" style="margin:0;min-width:64px">${ago(x.at)}</span><span>${h(x.name)}${x.qty > 1 ? ` ×${x.qty}` : ""} · <b>${fmt(x.price)}</b> <span class="xs muted">· ${h(x.s || "?")} → ${h(x.b || "?")}</span></span></div>`).join("") || `<div class="ln muted">Aucune vente.</div>`}</div>
      <div class="box"><h2>Annonces les plus chères</h2>${(a.top || []).map((x) => `<div class="ln"><span>${h(x.name)}${x.qty > 1 ? ` ×${x.qty}` : ""} · <b>${fmt(x.price)}</b> <span class="xs muted">· ${h(x.s || "?")}</span></span><button class="btn sm" style="margin-left:auto" data-act="mk-admdel" data-id="${x.id}">Retirer</button></div>`).join("") || `<div class="ln muted">Aucune annonce.</div>`}</div></div>
      <p class="small muted">« Retirer » rend l'objet à son vendeur (taxe perdue) et note l'action dans le journal.</p>`;
  }

  /* ---------- événements ---------- */
  let qTimer = null;
  document.addEventListener("input", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^mk-/.test(a)) return;
    if (a === "mk-q") { M.q = ev.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => { M.list = null; search(); }, 350); }
    if (a === "mk-oq") { M.oQ = ev.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => { M.orders = null; loadOrders(); }, 350); }
    if (a === "mk-ofind" || a === "mk-oqty" || a === "mk-oprice") { M[{ "mk-ofind": "oFind", "mk-oqty": "oQty", "mk-oprice": "oPrice" }[a]] = ev.target.value;
      clearTimeout(qTimer); qTimer = setTimeout(paint, a === "mk-ofind" ? 300 : 500); }
    if (a === "mk-price") { M.price = ev.target.value; clearTimeout(qTimer); qTimer = setTimeout(paint, 500); }
  });
  document.addEventListener("toggle", (ev) => { if (ev.target.classList && ev.target.classList.contains("mkadd")) M.tOpen = ev.target.open; }, true);
  document.addEventListener("change", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^mk-/.test(a)) return;
    if (ev.target.tagName !== "SELECT") return; // les champs texte sont gérés par « input »
    if (a === "mk-slot") M.slot = ev.target.value; if (a === "mk-lv") M.lv = ev.target.value; if (a === "mk-sort") M.sort = ev.target.value;
    M.list = null; M.sel = null; search();
  });
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^mk-/.test(a)) return;
    switch (a) {
      case "mk-tab": M.tab = d.v; M.confirm = null; if (d.v === "mine") { loadMine(); } if (d.v === "buy") { M.list = null; } if (d.v === "sell" && !M.mine) loadMine(); render($("#main")); return;
      case "mk-cat": M.cat = d.v; M.sel = null; M.list = null; render($("#main")); return;
      case "mk-pick": pick(d.k); if (!matchMedia("(min-width:861px)").matches) window.scrollTo(0, 0); return;
      case "mk-unpick": M.sel = null; paint(); return;
      case "mk-retry": if (d.v === "offers") { pick(M.sel); return; } if (d.v === "ord") M.orders = null; else M.list = null; render($("#main")); return;
      case "mk-ask": M.confirm = +d.id; paint(); return;
      case "mk-buy": { const r = await act("hdv_buy", { p_id: +d.id }, "Acheté ! C'est dans ton sac."); M.confirm = null; if (r) { M.list = null; search(); pick(M.sel); } else if (M.sel) pick(M.sel); return; }
      case "mk-need": buyNeed(d.k, +d.n); return;
      case "mk-scat": M.sCat = d.v; M.sSel = null; M.price = ""; M.n = 1; M.lot = d.v === "eq" ? 1 : 100; paint(); return;
      case "mk-ssel": { M.sSel = d.v || null; M.price = ""; M.n = 1; if (M.sSel) { const x = sellable(M.sCat).find((y) => (y.uid ? String(y.uid) : y.key) === M.sSel); if (x) { if (x.cat !== "eq") M.lot = x.n >= 100 ? 100 : x.n >= 10 ? 10 : 1; priceHint(x.cat, x.key); } } paint(); return; }
      case "mk-lot": M.lot = +d.v; M.n = 1; paint(); return;
      case "mk-n": M.n = Math.max(1, Math.min(MAX, M.n + +d.v)); paint(); return;
      case "mk-sell": doSell(); return;
      case "mk-lowok": M.lowOk = d.v; paint(); return;
      case "mk-lowfix": { const i = document.getElementById(d.i); if (i) { i.focus(); i.select(); } return; }
      case "mk-cancel": { const r = await act("hdv_cancel", { p_id: +d.id }, "Retiré : de retour dans ton sac."); if (r) loadMine(); return; }
      case "mk-rep": M.rep = +d.id; paint(); setTimeout(() => { const i = $("#mkRep"); if (i) i.focus(); }, 0); return;
      case "mk-repgo": { const v = Math.round(+String(($("#mkRep") || {}).value || "").replace(/\s/g, "")); if (!(v > 0)) return; const r = await act("hdv_reprice", { p_id: +d.id, p_price: v }, "Prix modifié."); M.rep = null; if (r) loadMine(); else paint(); return; }
      case "mk-trade-ask": { const m = $("#chMenu"); if (m) m.remove(); if (M.trade && M.trade.st === "open") return tradeSheet(); tradeAsk(d.p || ""); return; }
      case "mk-tgo": tradeStart((($("#mkTP") || {}).value || "").trim()); return;
      case "mk-tpick": M.tPick = d.v; M.tOpen = true; tradeSheet(); return;
      case "mk-tadd": { const x = sellable(M.tPick).find((y) => (y.uid ? String(y.uid) : y.key) === d.v); if (!x) return; M.tOpen = true;
        tradeSet((o) => { if (x.uid) { o.items = o.items || []; const i = o.items.indexOf(x.uid); if (i >= 0) o.items.splice(i, 1); else o.items.push(x.uid); } else { const b = bucket(x.cat); o[b] = o[b] || {}; if (o[b][x.key]) delete o[b][x.key]; else o[b][x.key] = x.n; } }); return; }
      case "mk-tq": { const [b, k] = d.v.split("|"); const inp = document.querySelector(`[data-tq="${CSS.escape(d.v)}"]`); const v = Math.max(0, Math.round(+(inp ? inp.value : 0))); tradeSet((o) => { o[b] = o[b] || {}; if (v) o[b][k] = v; else delete o[b][k]; }); return; }
      case "mk-tk": { const v = Math.max(0, Math.round(+String(($("#mkTK") || {}).value || 0).replace(/\s/g, ""))); tradeSet((o) => { o.k = v; }); return; }
      case "mk-tok": { const t2 = M.trade; if (!t2) return; try { await X().onPush(); } catch (e) {} const r = await ON.rpc("trade_ok", { p_id: t2.id, p_ver: t2.ver, p_after: cursor() });
        if (r.err || (r.data && r.data.err)) X().toast(r.err || r.data.err); else if (r.data && r.data.ops) apply(r.data.ops, true); await tradePoll(); return; }
      case "mk-tcancel": { const t2 = M.trade; if (t2) await ON.rpc("trade_cancel", { p_id: t2.id }); await tradePoll(); X().closeSheet(); return; }
      case "mk-oview": M.oView = d.v; if (d.v === "all") M.orders = null; else M.oMine = null; render($("#main")); return;
      case "mk-ocat": M.oCat = d.v; paint(); return;
      case "mk-opick": oPick(d.c, d.k || null); paint(); return;
      case "mk-odays": M.oDays = +d.v; paint(); return;
      case "mk-onew": M.tab = "ord"; M.oView = "mine"; oPick(d.c === "clef" ? "res" : d.c, d.k, +d.n || 0); render($("#main")); window.scrollTo(0, 0); return;
      case "mk-onewgo": { const o = M.oSel; if (!o) return; const qty = Math.round(+String(M.oQty).replace(/\s/g, "")) || 0, price = Math.round(+String(M.oPrice).replace(/\s/g, "")) || 0;
        if (price < oFloor(o.cat, o.key)) return X().toast("Au moins 1 kama l'unité.");
        const r = await act("hdv_order_new", { p_cat: o.cat, p_key: o.key, p_qty: qty, p_price: price, p_days: M.oDays, p_name: nameOf(o.cat, o.key), p_lvl: lvlOf(o.cat, o.key), p_slot: slotOf(o.cat, o.key) }, "Offre publiée : les kamas sont mis de côté.");
        if (r) { M.oSel = null; M.oQty = ""; M.oPrice = ""; M.oFind = ""; M.orders = null; loadOMine(); } return; }
      case "mk-ocancel": { const r = await act("hdv_order_cancel", { p_id: +d.id }, "Offre retirée : les kamas restants sont revenus."); if (r) loadOMine(); return; }
      case "mk-ofill": { const r = await act("hdv_order_fill", { p_id: +d.id, p_qty: +d.n }); if (r) { X().toast(`Vendu : ${fmt(r.n)} × ${d.nm} pour ${fmt(r.k)} kamas.`, "rare"); M.orders = null; M.hint = null; M.sSel = null; if (M.tab === "ord") loadOrders(); if (M.sel) pick(M.sel); else paint(); } else { M.orders = null; if (M.tab === "ord") loadOrders(); } return; }
      case "mk-admdel": { const r = await ON.rpc("adm_hdv_remove", { p_id: +d.id }); X().toast(r.err ? r.err : "Annonce retirée, objet rendu au vendeur."); const b = document.querySelector('[data-act="adm-reload"]'); if (b) b.click(); return; }
    }
  });

  /* ---------- démarrage (appelé par ui.js quand la partie est lancée) ---------- */
  let started = false, tick = 0;
  function start() {
    if (started) return; started = true;
    setTimeout(sync, 4000);
    setInterval(() => {
      if (!mine() || ON.state === "offline") return; tick++;
      const open = !!$("#mkTrade");
      if (open || tick % 5 === 0) tradePoll();
      if (tick % 20 === 0) sync();
    }, 3000);
  }
  const markSeen = () => { const s = S(); if (s) { s.hdv = s.hdv || { op: 0, log: [] }; s.hdv.seen = Date.now(); } };

  /* 0.1.37 : « Vendre à l'HdV » depuis le trop-plein ouvre la mise en vente de cet objet */
  const sellItem = (uid) => { M.tab = "sell"; M.sCat = "eq"; M.sSel = String(uid); M.price = ""; M.n = 1; M.lot = 1; const it = S() && S().items[uid]; if (it) priceHint("eq", it.tpl); if (M.mine === null && mine()) loadMine(); };
  /* 0.1.38 : « Vendre à l'HdV » depuis une ressource de l'inventaire */
  const sellRes = (key) => { const c = E.isKey(key) ? "clef" : "res"; const n = (S() && S().res[key]) || 0; M.tab = "sell"; M.sCat = c; M.sSel = key; M.price = ""; M.n = 1; M.lot = n >= 100 ? 100 : n >= 10 ? 10 : 1; priceHint("res", key); if (M.mine === null && mine()) loadMine(); };
  /* 0.1.41 : « Offre d'achat HdV » depuis les métiers et la forgemagie (ressource ou rune qui manque) */
  const orderFor = (cat, key, qty) => { M.tab = "ord"; M.oView = "mine"; oPick(cat, key, qty || 0); if (M.oMine === null && mine()) loadOMine(); };
  window.MARKET = { start, sellItem, sellRes, orderFor, canSell: (key) => !blocked("res", key), render: (m) => { render(m); if (M.tab === "mine") setTimeout(markSeen, 4000); if (mine()) sync(); }, sync, apply, adminHtml, tradeAsk, poll: tradePoll, M };
})();
