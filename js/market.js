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
  const M = { tab: "buy", q: "", list: null, sel: null, offers: null, stats: null,
    sCat: "eq", sSel: null, lot: 100, n: 1, price: "", mine: null, busy: false, confirm: null, rep: null, trade: null, tSeen: 0, tPick: "eq", tVer: -1,
    oView: "all", oQ: "", oCat: "res", oFind: "", oSel: null, oQty: "", oPrice: "", oDays: 14, orders: null, oMine: null, detOrd: null,
    fam: "eq", sub: "", lmin: "", lmax: "", stat: "", set: "", reach: false, sk: "unit", sd: 1, per: 30, fOpen: false, bq: "", mineV: "open", bought: null }; // 1.0.16 : HdV façon DOFUS 3

  /* ---------- noms, images, catégories ---------- */
  const bucket = (cat) => ({ res: "res", rune: "runes", cons: "cons" }[cat]);
  /* 2.1.30 « Marché des bêtes » (choix 1A 2A 3A 4A 5B 6A de Mathis) : montures (mt, clé « espèce:couleur ») et familiers (pet, clé = id).
     Chaque annonce est une bête précise (item) ; une bête achetée ou reçue en échange est marquée « achetée » (b). */
  const BEAST = (cat) => cat === "mt" || cat === "pet";
  const mtKey = (key) => { const k = String(key), i = k.indexOf(":"); return { sp: k.slice(0, i), c: k.slice(i + 1) }; };
  const beastOk = (cat, key) => { if (cat === "pet") return !!(E.PETS && E.PETS[key] && E.PETS[key].kind !== "unique");
    const { sp, c } = mtKey(key); const Sp = E.MOUNTS && E.MOUNTS[sp]; return !!Sp && !!(c.includes("|") ? Sp.bico[c] : Sp.cols[c]); };
  const beastImg = (cat, key, b) => !beastOk(cat, key) ? "" : cat === "mt" ? `<img class="${b && b.chr ? "el-chr" : ""}" src="assets/mt/${E.mountIcon(mtKey(key).sp, mtKey(key).c)}.webp" alt="" loading="lazy">`
    : `<img src="assets/p/${E.PETS[key].icon}.webp" alt="" loading="lazy">`;
  const MT_SUBS = [["dd", "Dragodindes"], ["mu", "Muldos"], ["vk", "Volkornes"]], PET_SUBS = [["zone", "Familiers de zone"], ["boss", "Familiers de boss"], ["monti", "Montiliers"]];
  const nameOf = (cat, key) => cat === "mt" ? (beastOk(cat, key) ? E.mountName(mtKey(key)) : key) : cat === "pet" ? (E.PETS && E.PETS[key] ? E.PETS[key].name : key) : cat === "eq" ? (ITEMS[key] ? ITEMS[key].name : key) : cat === "rune" ? E.runeName(key) : cat === "cons" ? (CONSUMABLES[key] ? CONSUMABLES[key].name : key) : key;
  const lvlOf = (cat, key) => cat === "eq" ? (ITEMS[key] ? ITEMS[key].lvl : 0) : cat === "res" ? (RES[key] ? RES[key].lvl || 0 : 0) : 0;
  const slotOf = (cat, key) => cat === "eq" ? (ITEMS[key] ? ITEMS[key].slot : null) : cat === "res" && E.isKey(key) ? "clef" : null;
  const icon = (cat, key, b) => {
    if (BEAST(cat)) return `<span class="icobox">${beastImg(cat, key, b)}</span>`;
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
  const CATS = [["eq", "Équipements"], ["res", "Ressources"], ["clef", "Clefs"], ["rune", "Runes"], ["cons", "Consommables"], ["mt", "Montures"], ["pet", "Familiers"]];
  const SLOTS = [["", "Tous"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"], ["bouclier", "Boucliers"]];
  const ago = (t) => { const s = (Date.now() - new Date(t)) / 1000; return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const left = (t) => { const s = (new Date(t) - Date.now()) / 1000; return s < 3600 ? `expire dans ${Math.max(1, Math.round(s / 60))} min` : s < 86400 ? `expire dans ${Math.round(s / 3600)} h` : `encore ${Math.round(s / 86400)} j`; };

  /* 2.1.30 : une bête en quelques mots (étoiles, niveau, capacité…), ses caractéristiques, sa tuile */
  const mtStars = (b) => { const n = Math.max(1, b.st || 1), cap = E.starCap && E.MOUNTS && E.MOUNTS[b.sp] ? E.starCap(S(), b) : 5; return `<span class="el-st" aria-label="${n} étoile${n > 1 ? "s" : ""}">${"★".repeat(n)}<i>${"★".repeat(Math.max(0, cap - n))}</i></span>`; };
  const petStars = (b) => (b.st ? `<span class="co-pst" aria-label="Éveil ${b.st} sur 5">${"★".repeat(b.st)}<i>${"★".repeat(Math.max(0, 5 - b.st))}</i></span>` : "");
  const kidsLeft = (b) => Math.max(0, (E.kidsCap ? E.kidsCap(S(), b) : 3) - (b.kids || 0));
  function beastSub(cat, b) {
    if (!b) return "";
    if (cat === "mt") { const k = kidsLeft(b);
      return `${mtStars(b)} niv. ${b.lvl || 1}${b.cap && E.CAPS && E.CAPS[b.cap] ? ` · <span class="mkbcap">${h(E.capName(b.cap))}</span>` : ""}${b.chr ? ` · <span class="mkbchr">✦ chromatique</span>` : ""} · ${k ? `encore ${k} petit${k > 1 ? "s" : ""}` : "plus de petits"}${b.b ? " · achetée" : ""}`; }
    return `niv. ${E.petLvl ? E.petLvl(b) : Math.floor(b.g || 1)}${b.st ? ` · ${petStars(b)}` : ""}${b.b ? " · acheté" : ""}`;
  }
  function beastStats(cat, b) {
    const o = cat === "mt" ? E.mountStatsAt(b) : E.petStatsAt(b.id, b.g || 1, b.st || 0);
    return Object.keys(o).filter((k) => o[k] && D.STATS[k]).map((k) => `<span class="stli">${X().sIco(k)}+${fmt(o[k])} ${h(D.STATS[k].name.replace("% ", ""))}</span>`).join("");
  }
  const beastTile = (x) => `${beastImg(x.cat, x.key, x.b)}<span class="ilvl">${x.cat === "mt" ? x.b.lvl || 1 : E.petLvl ? E.petLvl(x.b) : Math.floor(x.b.g || 1)}</span>${x.cat === "mt" && (x.b.st || 1) > 1 ? `<span class="icount">★${x.b.st}</span>` : x.cat === "pet" && x.b.st ? `<span class="icount">★${x.b.st}</span>` : ""}`;
  const beastTip = (x) => `${x.b.nm ? `« ${x.b.nm} » · ` : ""}${nameOf(x.cat, x.key)} · niv. ${x.cat === "mt" ? x.b.lvl || 1 : Math.floor(x.b.g || 1)}`;
  /* 5B : une bête achetée ne compte ni au carnet de l'éleveur ni à l'album ; « nouvelle » = pas encore au carnet / dans l'album */
  const beastNew = (cat, key) => { const s = S(); if (!s) return false; if (cat === "pet") return !(E.petMine ? E.petMine(s, key) : E.petOwned(s, key)); const { sp, c } = mtKey(key); return !(s.mountSeen && s.mountSeen[sp] && s.mountSeen[sp][c]); };

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
      if (p.bribes && E.songe) { const G = E.songe(s), n = Math.max(0, Math.round(Number(p.bribes) || 0)); G.br += n; G.tot = (G.tot || 0) + n; } // 1.0.30 : lots du classement du Songe infini
      if (p.untitle) { s.titlesExtra = (s.titlesExtra || []).filter((x) => x !== p.untitle); (s.chars || []).forEach((c) => { if (c.title === p.untitle) c.title = null; }); } // 0.1.49 : « Fléau des mondes » passe au podium suivant
      (p.rmM || []).forEach((uid) => { if (E.mountGone) E.mountGone(s, +uid); }); (p.rmP || []).forEach((uid) => { if (E.petGone) E.petGone(s, +uid); }); // 2.1.30 : bêtes vendues ou échangées
      (p.addM || []).forEach((m) => { if (E.mountIn) E.mountIn(s, m); }); (p.addP || []).forEach((x) => { if (E.petIn) E.petIn(s, x); });
      (p.add || []).forEach((it) => { if (!it || !ITEMS[it.tpl]) return; const uid = s.nextUid++; s.items[uid] = Object.assign({}, it, { uid }); delete s.items[uid].locked; delete s.items[uid].well; delete s.items[uid].fmLog; if (E.itemDexAdd) E.itemDexAdd(s, it.tpl); }); // 0.1.41 : passer par l'HdV efface le reliquat (comme dans DOFUS)
      s.hdv.op = o.id; n++; if (p.got) got = true;
      // 1.0.30 : la vente directe (p.vd, js/venteui.js) a son propre journal (le surplus part toutes les 10 minutes) ; le Jackpot du Trool (p.jack) s'annonce
      if (o.t && p.vd) { s.venteLog = (Array.isArray(s.venteLog) ? s.venteLog : []); s.venteLog.unshift({ t: o.t, at: Date.now(), k: p.k || 0 }); s.venteLog = s.venteLog.slice(0, 20); }
      else if (o.t) { s.hdv.log.unshift(Object.assign({ t: o.t, at: Date.now(), k: p.k || 0 }, p.sold ? { s: 1 } : {})); if (!quiet && (p.sold || p.got || p.jack || p.rain)) X().toast(o.t, "rare"); }
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
  async function pick(key) {
    M.sel = key; M.offers = null; M.stats = null; M.confirm = null; M.detOrd = null; paint();
    const [o, st, od] = await Promise.all([ON.rpc("hdv_offers", { p_key: key }), ON.rpc("hdv_history", { p_key: key, p_days: 30 }), ON.rpc("hdv_orders_list", { p_key: key, p_q: "", p_cat: "" })]);
    if (M.sel !== key) return;
    M.offers = o.data || []; M.offErr = !!o.err; M.stats = st.data || null; M.detOrd = od.data || []; paint();
  }
  async function loadMine() { const r = await ON.rpc("hdv_mine"); M.mine = r.data || { open: [], sold: [] }; paint(); }
  async function priceHint(cat, key) { const r = await ON.rpc("hdv_history", { p_key: key, p_days: 30 }); const o = await ON.rpc("hdv_offers", { p_key: key }); const od = cat === "eq" || BEAST(cat) ? {} : await ON.rpc("hdv_orders_list", { p_key: key, p_q: "", p_cat: "" });
    M.hint = { key, offs: o.data || [], st: r.data || null, low: (o.data || []).filter((x) => !x.mine)[0] || null, ord: (od.data || []).filter((x) => !x.mine)[0] || null }; paint(); }

  /* ---------- rendu ---------- */
  function render(main) {
    if (!main) return;
    window.DX.repaint(main, html());
    if (M.tab === "buy" && M.list === null) search();
    if (M.tab === "mine" && M.mine === null && mine()) loadMine();
    if (M.tab === "mine" && M.mineV === "bought" && M.bought === null && mine()) loadBought();
    if (M.tab === "ord") { if (M.orders === null) loadOrders(); if (M.oMine === null && mine()) loadOMine(); }
  }
  const paint = () => { if (window.DX.ui.tab === "hdv") { const m = $("#main"); if (m) { const y = window.scrollY; window.DX.repaint(m, html()); window.scrollTo(0, y); } } }; // garde le curseur là où on écrit
  function html() {
    const s = S();
    const login = mine() ? "" : ON.user && ON.solo && ON.solo() ? X().soloPanel("l'Hôtel de vente") : guest("acheter, vendre et échanger avec les autres joueurs");
    const panel = s && s.panelUsed ? `<p class="note">Partie retouchée par le panel de test : tu peux regarder, mais pas vendre ni acheter.</p>` : "";
    const body = M.tab === "sell" ? sellHtml() : M.tab === "mine" ? mineHtml() : M.tab === "log" ? logHtml() : M.tab === "ord" ? ordHtml() : buyHtml();
    const oOpen = M.oMine ? M.oMine.filter((x) => x.st === "open").length : null;
    return `<div class="pagehead"><h1>Hôtel de vente</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s ? s.kamas : 0)}</b> kamas</span></div>
      <nav class="subtabs">${[["buy", "Acheter"], ["sell", "Vendre"], ["ord", `Offres d'achat${oOpen !== null ? ` · ${oOpen} / ${OMAX}` : ""}`], ["mine", `Mes ventes et achats${newSales() ? ` <span class="mknew">${newSales()}</span>` : ""}`], ["log", "Historique"]].map(([id, n]) => `<button data-act="mk-tab" data-v="${id}" aria-pressed="${M.tab === id}">${n}</button>`).join("")}
      ${mine() ? `<button class="btn sm mktrade" data-act="mk-trade-ask">${X().G("chat")} ${M.trade && M.trade.st === "open" ? "Échange en cours" : "Proposer un échange"}</button>` : ""}</nav>
      <div class="stack">${login}${panel}${body}</div>`;
  }
  /* 0.1.19.4 : pas de compte obligatoire. Sans compte on regarde les prix ; on propose le compte, sans mur. */
  const guest = (what) => `<div class="panel"><div class="pad row between"><span><b>Crée ton compte pour ${what}</b><br><span class="small muted">C'est gratuit, et ta partie de cet appareil te suit sur ton compte. En attendant, tu peux regarder les prix.</span></span><button class="btn primary sm" data-act="on-loginscreen">Créer mon compte</button></div></div>`;
  const netErr = (v) => `<div class="empty">Pas de connexion au serveur : réessaie dans un moment. <button class="btn sm" data-act="mk-retry" data-v="${v}">Réessayer</button></div>`;
  const cats = (act, cur, list) => `<div class="row catchips">${(list || CATS).map(([id, n]) => `<button data-act="${act}" data-v="${id}" aria-pressed="${cur === id}">${n}</button>`).join("")}</div>`;
  /* Liste de courses : ce qu'il manque de cette ressource pour les recettes épinglées. */
  function need(key) {
    const s = S(); if (!s || !s.shop || !s.shop.length) return "";
    let want = 0; (s.shop || []).forEach((e) => { const ing = E.shopIng ? E.shopIng(s, e) : []; ing.forEach(([r, q]) => { if (r === key) want += q; }); });
    const miss = want - ((s.res || {})[key] || 0); if (miss <= 0) return "";
    return `<p class="note">${X().G("cart")} Liste de courses : il te manque <b>${fmt(miss)} ${h(key)}</b>. <button class="btn sm" data-act="mk-bqset" data-v="${miss}">Acheter au meilleur prix</button> <button class="btn sm" data-act="mk-onew" data-c="res" data-k="${h(key)}" data-n="${miss}">Faire une offre</button></p>`;
  }

  /* ---------- vendre ---------- */
  function sellable(cat) {
    const s = S(); if (!s) return [];
    if (cat === "mt") return Object.values(s.mounts || {}).filter((Mt) => beastOk("mt", `${Mt.sp}:${Mt.c}`) && !E.mountBusy(s, Mt))
      .sort((a, b) => E.MOUNT_ORDER.indexOf(a.sp) - E.MOUNT_ORDER.indexOf(b.sp) || (b.st || 1) - (a.st || 1) || b.lvl - a.lvl).map((Mt) => ({ cat, key: `${Mt.sp}:${Mt.c}`, uid: Mt.uid, b: Mt, n: 1 }));
    if (cat === "pet") return Object.values(s.pets || {}).filter((P) => beastOk("pet", P.id) && !E.petOwner(s, P.uid))
      .sort((a, b) => b.g - a.g || (b.st || 0) - (a.st || 0)).map((P) => ({ cat, key: P.id, uid: P.uid, b: P, n: 1 }));
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
      if (BEAST(x.cat)) return `<button class="itile ${id === M.sSel ? "on" : ""}" data-act="mk-ssel" data-v="${h(id)}" data-tip="${h(beastTip(x))}">${beastTile(x)}</button>`;
      return `<button class="itile ${id === M.sSel ? "on" : ""}" data-act="mk-ssel" data-v="${h(id)}" ${x.uid ? `data-tipitem="${x.uid}"` : `data-tip="${h(nameOf(x.cat, x.key))}"`}>${x.cat === "eq" ? X().im(X().itemImg(x.key), "", "") : x.cat === "res" ? X().im(X().resImg(x.key), "", "") : `<span class="mkbig">${x.cat === "rune" ? X().sIco(E.runeInfo(x.key).stat) : h((CONSUMABLES[x.key] || {}).icon || "•")}</span>`}${x.cat === "eq" ? `<span class="ilvl">${ITEMS[x.key].lvl}</span>${x.cnt > 1 ? `<span class="icount">×${x.cnt}</span>` : ""}` : `<span class="icount">×${fmt(x.n)}</span>`}</button>`; }).join("")}</div>`
      : `<div class="empty">Rien à vendre dans cette catégorie.</div>`;
    if (BEAST(M.sCat)) return `${cats("mk-scat", M.sCat)}<span class="small muted">${M.sCat === "mt" ? "Les montures montées, à l'enclos ou en balade n'apparaissent pas." : "Les familiers portés par un héros et le Chacha Doré n'apparaissent pas."} Une bête vendue garde son niveau, ses étoiles et sa capacité ; son acheteur la reçoit marquée « achetée ».</span>
      <div class="mkgrid ${sel ? "hassel" : ""}"><section class="panel mklist"><div class="phead"><h2>${M.sCat === "mt" ? "Ton écurie" : "Ta ménagerie"}</h2><span class="xs muted">choisis ce que tu vends</span></div><div class="pad">${grid}</div></section>${sel ? sellForm(sel) : ""}</div>`;
    return `${cats("mk-scat", M.sCat)}<span class="small muted">Les objets équipés, verrouillés ou rangés dans un équipement enregistré, les Dofus, les trophées et les objets uniques n'apparaissent pas.</span>
      <div class="mkgrid ${sel ? "hassel" : ""}"><section class="panel mklist"><div class="phead"><h2>Ton sac</h2><span class="xs muted">choisis ce que tu vends</span></div><div class="pad">${grid}</div></section>${sel ? sellForm(sel) : ""}</div>`;
  }
  function sellForm(x) {
    const s = S(); const res = x.cat !== "eq" && !BEAST(x.cat); const lot = res ? M.lot : 1; const maxN = res ? Math.min(MAX, Math.floor(x.n / lot)) : 1; const n = Math.max(1, Math.min(M.n, maxN || 1));
    const SG = M.hint && M.hint.key === x.key ? sugHtml(x, M.hint, res ? M.lot : 1) : null; const price = Math.round(+String(M.price === "" && SG && SG.sug ? SG.sug : M.price).replace(/\s/g, "")) || 0; const tax = price ? Math.max(1, Math.ceil(price * TAX)) : 0; const floor = floorOf(x.cat, x.key, lot); // 1.0.16 : prix conseillé déjà rempli
    const used = M.mine ? M.mine.open.length : 0; const hint = M.hint && M.hint.key === x.key ? M.hint : null;
    const base = baseOf(x.cat, x.key, lot, x.it); const st = hint && hint.st; const ref = refOf(x.cat, x.key, lot, x.it, st);
    const sug = st && st.avg ? Math.max(floor, Math.round(st.avg * lot)) : null;
    const low = price >= floor && price < ref * LOW && M.lowOk !== `${x.key}|${price}|${lot}`; // 1.0.12.8 : « N % de moins » plafonné à 99 (« 100 % » se lisait « gratuit »)
    const unitTxt = (v) => (res ? `${fmt(Math.round(v / lot * 10) / 10)} l'unité` : fmt(v));
    const why = !price ? "Indique un prix." : price < floor ? (res ? `Au moins 1 kama par unité (${fmt(floor)} le lot).` : "Au moins 1 kama.") : res && x.n < lot ? `Il t'en faut au moins ${lot}.` : used + n > MAX ? "Plus de place de vente." : tax * n > s.kamas ? "Pas assez de kamas pour la taxe." : "";
    return `<section class="panel mkdet"><div class="phead"><div class="row">${icon(x.cat, x.key)}<div><h2>${h(BEAST(x.cat) && x.b.nm ? `« ${x.b.nm} »` : nameOf(x.cat, x.key))}</h2><span class="xs muted">${BEAST(x.cat) ? beastSub(x.cat, x.b) : x.cat === "eq" ? `niv. ${ITEMS[x.key].lvl} · jet ${Math.round(E.itemQuality(x.it) * 100)} %${x.it.radiant ? " · ✦ Rayonnant" : ""}${x.it.fm ? ` · forgemagé ×${x.it.fm}` : ""}` : `tu en as ${fmt(x.n)}`}</span></div></div><button class="btn sm mkback" data-act="mk-ssel" data-v="">Retour</button></div>
      <div class="pad stack">
        ${res ? `<div class="mkfield"><span class="small"><b>Taille du lot</b></span><span class="seg">${[1, 10, 100].map((q) => `<button data-act="mk-lot" data-v="${q}" aria-pressed="${lot === q}" ${x.n < q ? "disabled" : ""}>×${q}</button>`).join("")}</span></div>
          <div class="mkfield"><span class="small"><b>Nombre de lots</b></span><span class="row"><span class="seg"><button data-act="mk-n" data-v="-1">−</button><button aria-pressed="true">${n}</button><button data-act="mk-n" data-v="1">+</button></span><span class="xs muted">${fmt(n * lot)} sur ${fmt(x.n)}</span></span></div>` : ""}
        ${SG ? SG.html : ""}<div class="mkfield"><span class="small"><b>${res ? "Prix d'un lot" : "Ton prix"}</b></span><input type="text" inputmode="numeric" class="mkbigin" id="mkPrice" data-act="mk-price" value="${h(M.price === "" && SG && SG.sug ? SG.sug : M.price)}" placeholder="${sug || base}">${price && st && st.avg ? `<span></span><span>${dealTag(price / lot, st.avg)}</span>` : ""}</div>
        ${BEAST(x.cat) ? `<div class="mkst">${beastStats(x.cat, x.b)}</div>` : ""}
        <div class="mkrefs"><div><span class="xs muted">Prix moyen des ventes (14 j)</span><b>${!hint ? "…" : st && st.avg ? `${fmt(Math.round(st.avg * lot))}` : "pas encore de vente"}</b></div>${BEAST(x.cat) ? "" : `<div><span class="xs muted">Valeur de base</span><b>${fmt(base)}</b></div>`}</div>
        <div class="mkfield"><span></span><span class="xs muted">${hint ? `${hint.low ? `Le moins cher en vente : <b>${fmt(hint.low.price)}</b>${hint.low.qty > 1 ? ` le lot de ${hint.low.qty}` : ""}. ` : ""}` : "Recherche des prix… "}${res ? `Prix pour un lot de ${lot}. ` : ""}Pas de prix minimum : 1 kama par unité au plus bas.</span></div>
        ${res ? sellOrdHtml(x, hint, price, lot, n) : ""}
        <div class="mksum"><span>Taxe de mise en vente (2 %)${n > 1 ? ` × ${n}` : ""}</span><b>− ${fmt(tax * n)}</b><span>Durée</span><b>14 jours</b><span class="tot">Tu recevras à la vente</span><b class="tot">${kk(price * n)}</b></div>
        <div><div class="row between xs"><span>Places de vente</span><b>${used + n} / ${MAX}</b></div><div class="mkslots">${Array.from({ length: MAX }, (_, i) => `<i class="${i < used ? "on" : i < used + n ? "new" : ""}"></i>`).join("")}</div></div>
        ${low && !why ? `<div class="mklow"><span><b>Ce prix est très bas, tu confirmes ?</b> ${unitTxt(price)}, soit ${Math.min(99, Math.round((1 - price / ref) * 100))} % de moins que ${st && st.avg ? "le prix moyen" : "la valeur de base"} (${unitTxt(ref)}).</span>
          <span class="row"><button class="btn sm mkwarnbtn" data-act="mk-lowok" data-v="${h(`${x.key}|${price}|${lot}`)}">Oui, vendre à ${fmt(price)}</button><button class="btn sm" data-act="mk-lowfix" data-i="mkPrice">Corriger le prix</button></span></div>`
          : `<button class="btn primary" data-act="mk-sell" ${why || M.busy ? "disabled" : ""}>${res && n > 1 ? `Mettre ${n} lots en vente` : "Mettre en vente"}</button>`}
        <span class="xs ${why ? "" : "muted"}" ${why ? 'style="color:var(--danger)"' : ""}>${why || (BEAST(x.cat) ? `${x.cat === "mt" ? "La monture quitte ton écurie" : "Le familier quitte ta ménagerie"} tout de suite et attend sur le serveur. Si tu la retires, elle revient (la taxe est perdue)${x.b.nm ? " ; son surnom est effacé" : ""}.` : "") || "L'objet quitte ton sac tout de suite et attend sur le serveur. Si tu le retires, il revient dans ton sac mais la taxe est perdue."}</span>
      </div></section>`;
  }
  async function doSell() {
    const x = sellable(M.sCat).find((y) => (y.uid ? String(y.uid) : y.key) === M.sSel); if (!x) return;
    const res = x.cat !== "eq"; const lot = res ? M.lot : 1; const SG = M.hint && M.hint.key === x.key ? sugHtml(x, M.hint, lot) : null; // 1.0.16 : le prix conseillé déjà rempli
    const price = Math.round(+String(M.price === "" && SG && SG.sug ? SG.sug : M.price).replace(/\s/g, "")) || 0;
    const n = res ? Math.max(1, Math.min(M.n, Math.floor(x.n / lot))) : 1;
    if (price < floorOf(x.cat, x.key, lot)) return X().toast("Au moins 1 kama par unité.");
    const r = await act("hdv_list", { p_cat: x.cat, p_key: x.key, p_uid: x.uid || null, p_lot: lot, p_n: n, p_price: price, p_name: nameOf(x.cat, x.key),
      p_lvl: BEAST(x.cat) ? Math.floor(x.cat === "mt" ? x.b.lvl : x.b.g) || 1 : lvlOf(x.cat, x.key), p_slot: x.cat === "mt" ? x.b.sp : x.cat === "pet" ? E.PETS[x.key].kind : slotOf(x.cat, x.key) }, res && n > 1 ? `${n} lots mis en vente.` : "Mis en vente.");
    if (r) { M.sSel = null; M.price = ""; M.n = 1; M.mine = null; M.list = null; loadMine(); }
  }

  /* ---------- mes ventes, historique ---------- */
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
    const bts = (t["m" + side] || []).filter((x) => x.m && beastOk("mt", `${x.m.sp}:${x.m.c}`)).map((x) => ({ cat: "mt", key: `${x.m.sp}:${x.m.c}`, b: x.m })) // 2.1.30 : bêtes posées
      .concat((t["f" + side] || []).filter((x) => x.p && beastOk("pet", x.p.id)).map((x) => ({ cat: "pet", key: x.p.id, b: x.p })));
    const tiles = bts.map((x) => `<span class="itile" data-tip="${h(beastTip(x))}">${beastTile(x)}</span>`).join("") + its.map((x) => x.it && ITEMS[x.it.tpl] ? `<span class="itile" data-tip="${h(ITEMS[x.it.tpl].name)} · jet ${Math.round(E.itemQuality(x.it) * 100)} %">${X().im(X().itemImg(x.it.tpl), "", "")}<span class="ilvl">${ITEMS[x.it.tpl].lvl}</span></span>` : "").join("")
      + res.map(([c, k, q]) => `<span class="itile" data-tip="${h(nameOf(c, k))}">${c === "res" ? X().im(X().resImg(k), "", "") : `<span class="mkbig">${c === "rune" ? X().sIco(E.runeInfo(k).stat) : X().consIco(CONSUMABLES[k], true)}</span>`}<span class="icount">×${fmt(q)}</span></span>`).join("");
    return `<div class="mktiles">${tiles || `<span class="xs muted">rien pour l'instant</span>`}</div><span class="small">${kk(o.k || 0)}</span>`;
  }
  function tradeSheet() {
    const t = M.trade;
    if (!t) { if ($("#mkTrade")) X().closeSheet(); return; }
    const me = t.me, other = me === "a" ? "b" : "a"; const myOk = t["k" + me], hisOk = t["k" + other];
    const done = t.st !== "open";
    const items = sellable(M.tPick).slice(0, 60); const o = t["o" + me] || {};
    const inOffer = (x) => x.cat === "mt" ? (o.mounts || []).includes(x.uid) : x.cat === "pet" ? (o.pets || []).includes(x.uid) : x.uid ? (o.items || []).includes(x.uid) : !!((o[bucket(x.cat) || "res"] || {})[x.key]);
    X().openSheet(`<div id="mkTrade" class="stack"><h2>Échange avec ${h(t["p" + other])}</h2>
      ${done ? `<p class="note">${t.st === "done" ? "Échange terminé : tout est dans ton sac." : `Échange annulé${t.note && t.note !== "annulé" ? ` (${h(t.note.replace("annulé par ", "par "))})` : ""}.`}</p>` : `<span class="small muted">Chacun pose ce qu'il donne. L'échange se fait quand les deux ont validé ; si quelqu'un change quelque chose, les validations s'annulent.</span>`}
      <div class="mktrade2"><div class="mkside ${myOk ? "ok" : ""}"><b>Tu donnes</b>${offerHtml(t, me)}<span class="tag ${myOk ? "good" : ""}" ${myOk ? "" : 'style="background:var(--panel3);color:var(--ink)"'}>${myOk ? "✓ validé" : "pas encore validé"}</span></div>
        <div class="mkside ${hisOk ? "ok" : ""}"><b>${h(t["p" + other])} donne</b>${offerHtml(t, other)}<span class="tag ${hisOk ? "good" : ""}" ${hisOk ? "" : 'style="background:var(--panel3);color:var(--ink)"'}>${hisOk ? "✓ validé" : "pas encore validé"}</span></div></div>
      ${done ? `<div><button class="btn" data-act="closesheet">Fermer</button></div>` : `
      <details class="mkadd" ${M.tOpen ? "open" : ""}><summary>Ajouter ou retirer ce que tu donnes</summary>
        <div class="row" style="margin:8px 0"><span class="small">Kamas</span><input type="text" inputmode="numeric" id="mkTK" value="${o.k || 0}" style="width:130px"><button class="btn sm" data-act="mk-tk">OK</button></div>
        ${cats("mk-tpick", M.tPick)}
        <div class="invgrid" style="margin-top:8px">${items.map((x) => { const id = x.uid ? String(x.uid) : x.key; const on = inOffer(x);
          if (BEAST(x.cat)) return `<button class="itile ${on ? "on" : ""}" data-act="mk-tadd" data-v="${h(id)}" data-tip="${h(beastTip(x))}">${beastTile(x)}</button>`;
          return `<button class="itile ${on ? "on" : ""}" data-act="mk-tadd" data-v="${h(id)}" ${x.uid ? `data-tipitem="${x.uid}"` : `data-tip="${h(nameOf(x.cat, x.key))} (${fmt(x.n)})"`}>${x.cat === "eq" ? X().im(X().itemImg(x.key), "", "") : x.cat === "res" ? X().im(X().resImg(x.key), "", "") : `<span class="mkbig">${x.cat === "rune" ? X().sIco(E.runeInfo(x.key).stat) : h((CONSUMABLES[x.key] || {}).icon || "•")}</span>`}${x.cat === "eq" ? `<span class="ilvl">${ITEMS[x.key].lvl}</span>` : `<span class="icount">×${fmt(x.n)}</span>`}</button>`; }).join("") || `<span class="xs muted">Rien dans cette catégorie.</span>`}</div>
        <span class="xs muted">Un clic ajoute (ressources : tout le tas, modifiable ci-dessous) ; un second clic retire.</span>
        ${["res", "runes", "cons"].map((b) => Object.keys(o[b] || {}).map((k) => `<div class="row small" style="margin-top:6px">${h(nameOf(b === "runes" ? "rune" : b, k))} <input type="text" inputmode="numeric" data-tq="${b}|${h(k)}" value="${o[b][k]}" style="width:90px"><button class="btn xs" data-act="mk-tq" data-v="${b}|${h(k)}">OK</button></div>`).join("")).join("")}
      </details>
      <div class="row"><button class="btn primary" data-act="mk-tok" ${myOk ? "disabled" : ""}>${myOk ? "En attente de l'autre…" : "Valider l'échange"}</button><button class="btn" data-act="mk-tcancel">Annuler</button></div>
      <span class="xs muted">Pas de taxe. Un échange par minute au maximum. Les Dofus, les trophées et le Chacha Doré ne s'échangent pas ; une monture montée, à l'enclos ou en balade non plus. Une bête reçue est marquée « achetée ».</span>`}</div>`);
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

  /* ======================================================================
     1.0.16 « Hôtel de vente façon DOFUS 3 » (Mathis : 1A … 9A)
     Catégories à gauche, tableau des prix ×1 / ×10 / ×100 et prix moyen, filtres faits par le jeu,
     la ligne choisie s'ouvre dessous (lots, achat d'une quantité, historique des prix sur 7 ou 30 jours),
     étiquettes Bonne affaire / Prix normal / Cher, favoris, prix conseillé à la vente, mes achats.
     Le serveur ne fait que lire : hdv_market (liste), hdv_history (courbe), hdv_bought (achats).
     ====================================================================== */
  const FAMS = [["fav", "Favoris"], ["eq", "Équipements"], ["res", "Ressources"], ["clef", "Clefs"], ["rune", "Runes"], ["cons", "Consommables"], ["mt", "Montures"], ["pet", "Familiers"]];
  const famIco = (id) => id === "fav" ? X().G("star") : id === "mt" ? `<img class="uico mkfi" src="assets/mt/${E.mountIcon("dd", "Rousse")}.webp" alt="" loading="lazy">` : id === "pet" ? `<img class="uico mkfi" src="assets/p/${E.PETS.chacha.icon}.webp" alt="" loading="lazy">` : X().IC({ eq: "coffre", res: "pioche", clef: "cle", rune: "cristal", cons: "bonbon" }[id]);
  const favs = () => { const s = S(); return (s && s.hdv && s.hdv.fav) || {}; };
  const isFav = (k) => !!favs()[k];
  const best = () => { const s = S(); return s && s.chars.length ? Math.max(...s.chars.map((c) => c.lvl)) : 200; };
  /* repère de prix : 15 % sous la moyenne ou mieux = bonne affaire, 15 % au-dessus ou plus = cher */
  const deal = (unit, avg) => { if (!avg || !unit) return null; const r = unit / avg; const pct = Math.round((r - 1) * 100);
    return { pct, cls: r <= 0.85 ? "good" : r >= 1.15 ? "bad" : "mid", txt: r <= 0.85 ? "Bonne affaire" : r >= 1.15 ? "Cher" : "Prix normal" }; };
  const pctTxt = (p) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)} %`;
  const dealTag = (unit, avg) => { const d = deal(unit, avg); return d ? `<span class="mkdeal ${d.cls}">${d.txt} <i>${pctTxt(d.pct)}</i></span>` : ""; };
  const u1 = (v) => v >= 100 ? fmt(Math.round(v)) : (Math.round(v * 10) / 10).toLocaleString("fr-FR");
  const avgOf = (key) => { const x = (M.list || []).find((y) => y.key === key); return (M.sel === key && M.stats && M.stats.avg) || (x && x.avg) || null; };
  let STATL = null, SETL = null;
  const statList = () => STATL || (STATL = [...new Set(Object.values(ITEMS).flatMap((T) => Object.keys(T.stats || {})))].filter((k) => D.STATS[k]).map((k) => [k, D.STATS[k].name]).sort((a, b) => a[1].localeCompare(b[1], "fr")));
  const setList = () => SETL || (SETL = Object.keys(D.SETS || {}).map((id) => D.SETS[id].name).sort((a, b) => a.localeCompare(b, "fr")));
  const setName = (key) => { const T = ITEMS[key]; return T && T.set && D.SETS[T.set] ? D.SETS[T.set].name : ""; };
  const resCatName = (key) => (D.RES_CATS.find((c) => c.id === D.RES_CAT_OF(key)) || {}).name || "";

  /* ---------- données ---------- */
  async function search() {
    const fam = M.fam, q = M.q.trim(); const cat = q || fam === "fav" ? "" : fam === "clef" ? "res" : fam;
    const keys = fam === "fav" && !q ? Object.keys(favs()) : null;
    if (keys && !keys.length) { M.list = []; M.lErr = false; paint(); return; }
    const r = await ON.rpc("hdv_market", { p_cat: cat, p_q: q, p_slot: !q && fam === "clef" ? "clef" : "", p_keys: keys });
    if (fam !== M.fam || q !== M.q.trim()) return;
    M.lErr = !!r.err; // une panne du serveur n'est pas affichée comme une liste vide
    M.list = r.err ? [] : (r.data || []).map((x) => Object.assign(x, { unit: +x.unit, avg: x.avg ? +x.avg : null }));
    if (M.sel && !rows().some((x) => x.key === M.sel)) { M.sel = null; M.offers = null; }
    paint();
  }
  /* filtres faits par le jeu : le serveur ne connaît ni les caractéristiques ni les panoplies */
  function keep(x) {
    const q = M.q.trim();
    if (!q) {
      if (M.fam === "res" && x.slot === "clef") return false;
      if (M.fam === "eq" && M.sub && x.slot !== M.sub) return false;
      if (M.fam === "res" && M.sub && D.RES_CAT_OF(x.key) !== M.sub) return false;
      if (M.fam === "mt" && M.sub && x.slot !== M.sub) return false;
      if (M.fam === "pet" && M.sub && (!E.PETS[x.key] || E.PETS[x.key].kind !== M.sub)) return false;
    } else if (!norm(x.name).includes(norm(q))) return false;
    if (M.fam === "fav" && !q) return isFav(x.key);
    if (BEAST(x.cat)) return beastOk(x.cat, x.key) && !(M.bnew && !beastNew(x.cat, x.key)); // 2.1.30 : les filtres des bêtes portent sur les offres (ouverture d'une ligne)
    const lo = +M.lmin || 0, hi = +M.lmax || 1000; if (x.lvl && (x.lvl < lo || x.lvl > hi)) return false;
    if (M.stat) { if (x.cat === "eq" && !(ITEMS[x.key] && ITEMS[x.key].stats && ITEMS[x.key].stats[M.stat])) return false; if (x.cat === "rune" && E.runeInfo(x.key).stat !== M.stat) return false; if (x.cat !== "eq" && x.cat !== "rune") return false; }
    if (M.set && !(x.cat === "eq" && norm(setName(x.key)).includes(norm(M.set)))) return false;
    if (M.reach && x.cat === "eq" && x.lvl > best()) return false;
    return true;
  }
  const BIG = 1e15;
  const SORTS = { name: (a, b) => a.name.localeCompare(b.name, "fr"), lvl: (a, b) => a.lvl - b.lvl, avg: (a, b) => (a.avg || BIG) - (b.avg || BIG), unit: (a, b) => a.unit - b.unit,
    p1: (a, b) => (a.p1 || BIG) - (b.p1 || BIG), p10: (a, b) => (a.p10 || BIG) - (b.p10 || BIG), p100: (a, b) => (a.p100 || BIG) - (b.p100 || BIG), n: (a, b) => a.qty - b.qty };
  function rows() { const f = SORTS[M.sk] || SORTS.unit; return (M.list || []).filter(keep).sort((a, b) => M.sd * f(a, b) || a.name.localeCompare(b.name, "fr")); }
  async function loadBought() { if (!mine()) return; const r = await ON.rpc("hdv_bought"); M.bought = r.err ? [] : r.data || []; paint(); }
  /* ventes arrivées depuis la dernière visite de « Mes ventes et achats » (pastille de l'onglet et du menu) */
  const newSales = () => { const s = S(); if (!s || !s.hdv || !s.hdv.log) return 0; const seen = s.hdv.seen || 0; return s.hdv.log.filter((x) => x.s && x.at > seen).length; };

  /* ---------- colonne de gauche : catégories ---------- */
  function sideHtml() {
    const fam = M.q.trim() ? "" : M.fam;
    const tree = FAMS.map(([id, n]) => {
      const subs = id === "eq" ? SLOTS.slice(1) : id === "res" ? D.RES_CATS.filter((c) => c.id !== "cle").map((c) => [c.id, c.name]) : id === "mt" ? MT_SUBS : id === "pet" ? PET_SUBS : [];
      const cnt = id === "fav" ? Object.keys(favs()).length : null;
      return `<button class="mktr ${fam === id ? "on" : ""}" data-act="mk-fam" data-v="${id}">${famIco(id)}<span class="grow">${n}</span>${cnt !== null ? `<span class="mkcnt">${cnt}</span>` : subs.length ? `<i class="mkcar">${fam === id ? "▾" : "▸"}</i>` : ""}</button>
        ${fam === id && subs.length ? `<div class="mksub">${[["", { eq: "Tous les équipements", mt: "Toutes les montures", pet: "Tous les familiers" }[id] || "Toutes les ressources"]].concat(subs).map(([v, nm]) => `<button class="${M.sub === v ? "on" : ""}" data-act="mk-sub" data-v="${v}">${h(nm)}</button>`).join("")}</div>` : ""}`; }).join("");
    return `<aside class="panel mkside3"><div class="phead"><h2>Catégories</h2></div><div class="mktree">${tree}</div></aside>`;
  }
  function filtHtml() {
    const fam = M.q.trim() ? "" : M.fam; if (fam === "fav") return "";
    if (BEAST(fam)) { // 2.1.30
      const mt = fam === "mt"; const any = M.bst || M.bcap || M.bkids || M.bnew;
      return `<div class="mkflts"><label class="mkflt"><span class="xs muted">${mt ? "Étoiles" : "Éveil"}</span><select id="mkBst" data-act="mk-bst"><option value="">${mt ? "Toutes" : "Tous"}</option>${(mt ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((n) => `<option value="${n}" ${+M.bst === n ? "selected" : ""}>★${n} et plus</option>`).join("")}</select></label>
        ${mt ? `<label class="mkflt"><span class="xs muted">Capacité</span><select id="mkBcap" data-act="mk-bcap"><option value="">Toutes</option>${(E.CAP_ORDER || []).map((k) => `<option value="${k}" ${M.bcap === k ? "selected" : ""}>${h(E.capName(k))}</option>`).join("")}</select></label>
        <label class="mkchk"><input type="checkbox" id="mkBkids" data-act="mk-bkids" ${M.bkids ? "checked" : ""}> <span class="small">Peut encore avoir des petits</span></label>` : ""}
        <label class="mkchk"><input type="checkbox" id="mkBnew" data-act="mk-bnew" ${M.bnew ? "checked" : ""}> <span class="small">${mt ? "Pas encore à mon carnet" : "Pas encore dans mon album"}</span></label>${any ? `<button class="btn sm" data-act="mk-freset">Effacer</button>` : ""}</div>`;
    }
    const lv = `<label class="mkflt"><span class="xs muted">Niveau</span><span class="mklv"><input type="text" inputmode="numeric" id="mkLmin" data-act="mk-lmin" value="${h(M.lmin)}" placeholder="1" aria-label="Niveau minimum"><span class="xs muted">à</span><input type="text" inputmode="numeric" id="mkLmax" data-act="mk-lmax" value="${h(M.lmax)}" placeholder="200" aria-label="Niveau maximum"></span></label>`;
    const st = fam === "eq" || fam === "rune" ? `<label class="mkflt"><span class="xs muted">Caractéristique</span><select id="mkStat" data-act="mk-stat"><option value="">Toutes</option>${statList().map(([k, nm]) => `<option value="${k}" ${M.stat === k ? "selected" : ""}>${h(nm)}</option>`).join("")}</select></label>` : "";
    const set = fam === "eq" ? `<label class="mkflt"><span class="xs muted">Panoplie</span><input type="text" id="mkSet" data-act="mk-set" list="mkSets" value="${h(M.set)}" placeholder="Bouftou, Kralamour…"><datalist id="mkSets">${setList().map((nm) => `<option value="${h(nm)}">`).join("")}</datalist></label>` : "";
    const reach = fam === "eq" ? `<label class="mkchk"><input type="checkbox" id="mkReach" data-act="mk-reach" ${M.reach ? "checked" : ""}> <span class="small">À ma portée <span class="xs muted">(niv. ${best()} et moins)</span></span></label>` : "";
    const any = M.lmin || M.lmax || M.stat || M.set || M.reach;
    return `<div class="mkflts">${lv}${st}${set}${reach}${any ? `<button class="btn sm" data-act="mk-freset">Effacer</button>` : ""}</div>`;
  }

  /* ---------- tableau des prix ---------- */
  function listHtml() {
    const L = M.list === null ? null : rows(); const fam = M.fam, q = M.q.trim();
    const eq = L && L.length && L.every((x) => x.cat === "eq" || BEAST(x.cat)); const bst = L && L.length && L.every((x) => BEAST(x.cat));
    const cur = q ? `Recherche « ${q} »` : BEAST(fam) && M.sub ? ((fam === "mt" ? MT_SUBS : PET_SUBS).find((x) => x[0] === M.sub) || [])[1] : fam === "eq" ? (M.sub ? (SLOTS.find((s) => s[0] === M.sub) || [])[1] : "Équipements") : fam === "res" && M.sub ? (D.RES_CATS.find((c) => c.id === M.sub) || {}).name : (FAMS.find((f) => f[0] === fam) || [])[1];
    const th = (k, n, cls) => `<button class="mkth ${cls || ""} ${M.sk === k ? "on" : ""}" data-act="mk-sk" data-v="${k}">${n}${M.sk === k ? (M.sd < 0 ? " ▾" : " ▴") : ""}</button>`;
    const star = (x) => `<span class="mkstar ${isFav(x.key) ? "on" : ""}" data-act="mk-fav" data-k="${h(x.key)}" role="button" tabindex="0" aria-label="${isFav(x.key) ? "Retirer des favoris" : "Ajouter aux favoris"}">${X().G("star")}</span>`;
    const px = (v, avg, n) => { if (!v) return `<span class="mkpc muted">—</span>`; const d = deal(v / n, avg); return `<span class="mkpc">${fmt(v)}${d && d.cls !== "mid" ? `<i class="mkdot ${d.cls}" title="${d.txt} (${pctTxt(d.pct)})"></i>` : ""}</span>`; };
    let body;
    if (L === null) body = `<div class="empty">Chargement…</div>`;
    else if (M.lErr) body = netErr("list");
    else if (!L.length) body = `<div class="empty">${fam === "fav" && !q ? "Aucun favori en vente. Touche l'étoile d'un objet pour le suivre ici." : "Rien en vente ici avec ces filtres."}</div>`;
    else {
      const head = eq ? `<div class="mktr2 mkhd eq"><span></span>${th("name", bst ? (L.every((x) => x.cat === "mt") ? "Monture" : L.every((x) => x.cat === "pet") ? "Familier" : "Bête") : "Objet", "nm")}${th("lvl", bst && L.every((x) => x.cat === "mt") ? "Gén." : "Niv.")}${th("avg", "Prix moyen")}${th("unit", "À partir de")}${th("n", "En vente")}</div>`
        : `<div class="mktr2 mkhd"><span></span>${th("name", "Objet", "nm")}${th("lvl", "Niv.")}${th("avg", "Moyen / u")}${th("p1", "×1")}${th("p10", "×10")}${th("p100", "×100")}</div>`;
      body = head + L.map((x) => { const e = x.cat === "eq" || BEAST(x.cat); const sub = BEAST(x.cat) ? beastRowSub(x) : x.cat === "eq" ? setName(x.key) : x.cat === "res" ? resCatName(x.key) : "";
        return `<div class="mktr2 ${eq ? "eq" : ""} ${M.sel === x.key ? "on" : ""}" data-act="mk-pick" data-k="${h(x.key)}" role="button" tabindex="0">${star(x)}<span class="nm">${icon(x.cat, x.key)}<span><b>${h(nameOf(x.cat, x.key))}</b>${sub ? `<br><span class="xs muted">${h(sub)}</span>` : ""}</span></span>
          <span class="mkc lv" data-l="${x.cat === "mt" ? "Gén." : "Niv."}">${x.cat === "mt" ? mtGen(x.key) : x.cat === "pet" ? (E.PETS[x.key].lvl || 1) : x.lvl || "—"}</span><span class="mkc av" data-l="Moyen">${x.avg ? (e ? fmt(x.avg) : u1(x.avg)) : "—"}</span>
          ${eq ? `<span class="mkc" data-l="À partir de">${px(x.unit, x.avg, 1)}</span><span class="mkc" data-l="En vente">${x.n}</span>`
            : `<span class="mkc" data-l="×1">${px(e ? x.unit : x.p1, x.avg, 1)}</span><span class="mkc" data-l="×10">${px(x.p10, x.avg, 10)}</span><span class="mkc" data-l="×100">${px(x.p100, x.avg, 100)}</span>`}</div>${M.sel === x.key ? `<div class="mkopen">${detailHtml(x)}</div>` : ""}`; }).join("");
    }
    return `<section class="panel mklist3"><div class="phead"><h2>${h(cur || "")}</h2><span class="xs muted">${L && !M.lErr ? `${L.length} objet${L.length > 1 ? "s" : ""}` : ""}</span></div>${filtHtml()}<div class="mktbl">${body}</div></section>`;
  }
  const mtGen = (key) => { const { sp, c } = mtKey(key); return c.includes("|") ? "bico" : E.gen(sp, c); };
  const beastRowSub = (x) => x.cat === "mt" ? (beastNew("mt", x.key) ? "nouvelle couleur pour ton carnet" : "déjà à ton carnet") : `${{ zone: "familier de zone", boss: "familier de boss", monti: "montilier" }[E.PETS[x.key].kind] || ""} · ${beastNew("pet", x.key) ? "pas dans ton album" : "dans ton album"}`;
  function buyHtml() {
    const fam = M.fam, q = M.q.trim();
    const curTxt = q ? "Catégories" : BEAST(fam) && M.sub ? `${fam === "mt" ? "Montures" : "Familiers"} › ${((fam === "mt" ? MT_SUBS : PET_SUBS).find((x) => x[0] === M.sub) || [])[1]}` : fam === "eq" && M.sub ? `Équipements › ${(SLOTS.find((s) => s[0] === M.sub) || [])[1]}` : fam === "res" && M.sub ? `Ressources › ${(D.RES_CATS.find((c) => c.id === M.sub) || {}).name}` : (FAMS.find((f) => f[0] === fam) || [])[1];
    const nf = (BEAST(fam) ? [M.bst, M.bcap, M.bkids, M.bnew] : [M.lmin || M.lmax, M.stat, M.set, M.reach]).filter(Boolean).length;
    const bar = `<div class="row invbar mkbar3"><input type="text" id="mkQ" data-act="mk-q" placeholder="Rechercher un objet, une ressource…" value="${h(M.q)}">
      <button class="btn mkfbtn" data-act="mk-fopen">${X().G("tag")} ${h(curTxt)}${nf ? ` · ${nf} filtre${nf > 1 ? "s" : ""}` : ""} ${M.fOpen ? "▴" : "▾"}</button></div>`;
    return `${bar}<div class="mk3 ${M.fOpen ? "fopen" : ""}">${sideHtml()}${listHtml()}</div>`;
  }

  /* ---------- historique des prix ---------- */
  function chartHtml(st, cat) {
    if (!st) return "";
    const per = M.per === 7 ? 7 : 30; const since = Date.now() - per * 864e5;
    const days = (st.days || []).filter((d) => new Date(d.d) >= since - 864e5);
    const tabs = `<span class="seg mkper">${[[7, "7 jours"], [30, "30 jours"]].map(([v, n]) => `<button data-act="mk-per" data-v="${v}" aria-pressed="${per === v}">${n}</button>`).join("")}</span>`;
    const head = `<div class="row between"><b class="small">${X().G("chart")} Historique des prix</b>${tabs}</div>`;
    if (days.length < 2) return `<div class="mkchart">${head}<span class="xs muted">${days.length ? "Une seule journée de ventes : la courbe arrive avec les suivantes." : "Pas encore de vente sur cette période."}${st.avg ? ` Prix moyen : <b>${cat === "eq" ? fmt(st.avg) : u1(st.avg)}</b>.` : ""}</span></div>`;
    const W = 600, H = 170, B = 36; const v = days.map((d) => +d.u); const mx = Math.max(...v), mn = Math.min(...v); const qx = Math.max(...days.map((d) => +d.q || 0), 1);
    const xo = (d) => Math.max(0, Math.min(W, ((new Date(d.d) - since) / (per * 864e5)) * W));
    const yo = (u) => 8 + (1 - (u - mn) / (mx - mn || 1)) * (H - B - 18);
    const line = days.map((d, i) => `${i ? "L" : "M"}${xo(d).toFixed(1)} ${yo(+d.u).toFixed(1)}`).join(" ");
    const bw = Math.max(3, (W / per) * 0.6);
    const bars = days.map((d) => { const hh = ((+d.q || 0) / qx) * (B - 6); return `<rect x="${(xo(d) - bw / 2).toFixed(1)}" y="${(H - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="1.5"/>`; }).join("");
    const avg = st.avg ? +st.avg : null; const vol = days.reduce((a, d) => a + (+d.q || 0), 0);
    const fd = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const f = (u) => (cat === "eq" ? fmt(u) : u1(u));
    return `<div class="mkchart">${head}
      <div class="mkcg"><div class="mkya"><span>${f(mx)}</span><span>${f(mn)}</span><span>ventes</span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line class="g" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/>${avg && avg >= mn && avg <= mx ? `<line class="avg" x1="0" x2="${W}" y1="${yo(avg).toFixed(1)}" y2="${yo(avg).toFixed(1)}"/>` : ""}
          <g class="vol">${bars}</g><path class="a" d="${line} L${xo(days[days.length - 1]).toFixed(1)} ${H - B} L${xo(days[0]).toFixed(1)} ${H - B} Z"/><path class="l" d="${line}"/></svg></div>
      <div class="mkxa"><span>${fd(since)}</span><span>${per === 7 ? "" : fd(since + 15 * 864e5)}</span><span>aujourd'hui</span></div>
      <div class="mkkpi"><div><span class="xs muted">Prix moyen (14 j)</span><b>${avg ? f(avg) : "—"}</b></div><div><span class="xs muted">Plus bas</span><b>${f(mn)}</b></div><div><span class="xs muted">Plus haut</span><b>${f(mx)}</b></div><div><span class="xs muted">Vendus (${per} j)</span><b>${fmt(vol)}</b></div></div>
      <span class="xs muted">${cat === "eq" ? "Prix de vente moyen de chaque jour, tous jets confondus." : "Prix moyen à l'unité de chaque jour ; les barres montrent la quantité vendue."}${avg && avg >= mn && avg <= mx ? " La ligne pointillée est le prix moyen." : ""}</span></div>`;
  }

  /* ---------- acheter une quantité : le jeu prend les lots les moins chers ---------- */
  function qtyPlan(O, n) {
    const L = O.filter((o) => !o.mine).slice().sort((a, b) => a.price / a.qty - b.price / b.qty || a.qty - b.qty); const out = []; let got = 0, cost = 0;
    for (const o of L) { if (got >= n) break; const rem = n - got;
      if (o.qty > rem * 1.5 && L.some((z) => !out.includes(z) && z !== o && z.qty <= rem)) continue; // un lot bien trop gros quand de plus petits suffisent
      out.push(o); got += o.qty; cost += o.price; }
    return { out, got, cost };
  }
  async function buyQty(key, n) {
    const P = qtyPlan(M.offers || [], n); if (!P.out.length) return;
    let got = 0, paid = 0;
    for (const o of P.out) { const r = await act("hdv_buy", { p_id: o.id }); if (!r) break; got += o.qty; paid += o.price; }
    if (got) X().toast(`${fmt(got)} × ${nameOf("res", key)} achetés pour ${fmt(paid)} kamas.`, "rare");
    M.bq = ""; M.confirm = null; search(); pick(key);
  }

  /* ---------- la ligne ouverte : offres, lots, historique ---------- */
  function detailHtml(x) {
    const key = x.key, cat = x.cat; const O = M.offers; const avg = avgOf(key);
    const T = cat === "eq" ? ITEMS[key] : null; const sn = T ? setName(key) : "";
    if (BEAST(cat)) return beastDetail(x, O, avg);
    const head = `<div class="phead"><div class="row">${icon(cat, key)}<div><h2>${h(nameOf(cat, key))}</h2><span class="xs muted">${lvlOf(cat, key) ? `niv. ${lvlOf(cat, key)}` : ""}${T ? ` · ${h((SLOTS.find((s) => s[0] === T.slot) || [, T.slot])[1])}` : cat === "res" ? ` · ${h(resCatName(key))}` : ""}${sn ? ` · ${h(sn)}` : ""}${avg ? ` · moyenne ${cat === "eq" ? fmt(avg) : u1(avg) + " / u"}` : ""}</span></div></div>
      <span class="row"><button class="btn sm mkfavb ${isFav(key) ? "on" : ""}" data-act="mk-fav" data-k="${h(key)}">${X().G("star")} ${isFav(key) ? "Suivi" : "Suivre"}</button><button class="btn sm" data-act="mk-pick" data-k="${h(key)}">Fermer</button></span></div>`;
    if (!O) return `<section class="panel mkdet">${head}<div class="pad empty">Chargement…</div></section>`;
    if (M.offErr) return `<section class="panel mkdet">${head}${netErr("offers")}</section>`;
    const kam = (S() && S().kamas) || 0;
    const buyBtn = (o) => o.mine ? `<span class="tag" style="background:var(--panel3);color:var(--ink)">ton annonce</span>`
      : o.price > kam ? `<button class="btn sm mkshort" disabled>Il te manque ${fmt(o.price - kam)} kamas</button>` // 1.0.12.8 : grisé quand la bourse ne suffit pas
      : M.confirm === o.id ? `<button class="btn sm primary" data-act="mk-buy" data-id="${o.id}">Confirmer ${fmt(o.price)}</button>`
      : `<button class="btn sm primary" data-act="mk-ask" data-id="${o.id}" ${M.busy ? "disabled" : ""}>Acheter</button>`;
    if (cat === "eq") {
      const c = X().mainHero();
      const offs = O.map((o) => { const it = o.item || { tpl: key, stats: {} }; const q = Math.round(E.itemQuality(it) * 100);
        return `<div class="mkoffer"><span class="mkjet ${q >= 90 ? "hi" : ""}">jet ${q} %</span><div class="grow"><div class="mkst">${X().itemStatsHtml(it)}</div>
          <div class="xs muted">${it.radiant ? `<b style="color:var(--gold)">✦ Rayonnant +${it.radiant} %</b> · ` : ""}${it.fm ? `forgemagé ×${it.fm} · ` : ""}${c && T.lvl <= c.lvl ? `pour ${h(c.name)} : ${X().cmpItem(c, it)}` : ""}</div></div><span class="mkpcol">${kk(o.price)}${dealTag(o.price, avg)}</span>${buyBtn(o)}</div>`; }).join("");
      return `<section class="panel mkdet">${head}<div class="list">${offs || `<div class="empty">Plus aucune offre.</div>`}</div><div class="pad stack">${chartHtml(M.stats, cat)}<span class="xs muted">Chaque offre est un objet précis : tu reçois exactement ce que tu vois.</span></div></section>`;
    }
    const lots = [1, 10, 100].map((q) => { const os = O.filter((o) => o.qty === q && !o.mine); const b = os[0];
      return `<div class="mklot ${b && O.filter((o) => !o.mine).every((z) => z.price / z.qty >= b.price / b.qty) ? "best" : ""}"><span class="xs muted">Lot de ${q}</span>${b ? `<b class="big">${kk(b.price)}</b><span class="xs muted">${u1(b.price / q)} / unité · ${os.length} lot${os.length > 1 ? "s" : ""}</span>${dealTag(b.price / q, avg)}${buyBtn(b)}` : `<span class="xs muted">aucun lot</span>`}</div>`; }).join("");
    const n = Math.max(0, Math.round(+String(M.bq || "").replace(/\s/g, "")) || 0); const P = n ? qtyPlan(O, n) : null;
    const parts = P ? [100, 10, 1].map((q) => { const c = P.out.filter((o) => o.qty === q).length; return c ? `${c} lot${c > 1 ? "s" : ""} de ${q}` : ""; }).filter(Boolean).join(" + ") : "";
    const qbox = O.some((o) => !o.mine) ? `<div class="mkqbox"><div class="row between"><b class="small">${X().G("cart")} Acheter une quantité</b><span class="xs muted">le jeu prend les lots les moins chers</span></div>
      <div class="mkqrow"><input type="text" inputmode="numeric" class="mkbigin" id="mkBQ" data-act="mk-bq" value="${h(M.bq || "")}" placeholder="Combien ?" aria-label="Quantité à acheter"><span class="seg">${[10, 100, 1000].map((q) => `<button data-act="mk-bqset" data-v="${q}">${fmt(q)}</button>`).join("")}</span></div>
      ${P && P.got ? `<div class="mksum"><span>${h(parts)}</span><b>${fmt(P.got)} ${P.got !== n ? `<span class="xs muted">(${P.got > n ? `${fmt(P.got - n)} de plus` : `il en manque ${fmt(n - P.got)}`})</span>` : ""}</b><span>Prix à l'unité</span><b>${u1(P.cost / P.got)} ${dealTag(P.cost / P.got, avg)}</b><span class="tot">Total</span><b class="tot">${kk(P.cost)}</b></div>
        ${P.cost > kam ? `<button class="btn primary" disabled>Il te manque ${fmt(P.cost - kam)} kamas</button>` : M.confirm === "q" ? `<button class="btn primary" data-act="mk-bqgo" ${M.busy ? "disabled" : ""}>Confirmer : ${fmt(P.got)} pour ${fmt(P.cost)} kamas</button>` : `<button class="btn primary" data-act="mk-bqask" ${M.busy || !mine() ? "disabled" : ""}>Acheter ${fmt(P.got)} pour ${fmt(P.cost)} kamas</button>`}` : n ? `<span class="xs muted">Rien en vente pour l'instant.</span>` : ""}</div>` : "";
    const own = O.filter((o) => o.mine).length;
    return `<section class="panel mkdet">${head}<div class="pad mkdg"><div class="stack"><div class="mklots">${lots}</div>${qbox}${own ? `<span class="xs muted">Dont ${own} lot${own > 1 ? "s" : ""} à toi (onglet Mes ventes et achats).</span>` : ""}${need(key)}</div><div class="stack">${chartHtml(M.stats, cat)}${detOrdHtml(cat, key)}</div></div></section>`;
  }

  /* 2.1.30 : la ligne ouverte d'une monture ou d'un familier : chaque offre est une bête précise */
  function beastDetail(x, O, avg) {
    const key = x.key, cat = x.cat, mt = cat === "mt", s = S(); const kam = (s && s.kamas) || 0;
    const sp = mt ? mtKey(key).sp : null; const full = mt && s && E.stableFull && E.stableFull(s, sp);
    const sub = mt ? `${mtGen(key) === "bico" ? "bicolore" : `génération ${mtGen(key)}`} · au niveau 100 : ${Object.entries(E.mountStatsMax(sp, mtKey(key).c)).map(([k, v]) => `${fmt(v)} ${h((D.STATS[k] || { name: k }).name.replace("% ", ""))}`).join(", ")}`
      : `${{ zone: "Familier de zone", boss: "Familier de boss", monti: "Montilier" }[E.PETS[key].kind] || "Familier"}${E.petAptTxt ? ` · au niveau 100 : ${h(E.petAptTxt(key))}` : ""}`;
    const head = `<div class="phead"><div class="row">${icon(cat, key)}<div><h2>${h(nameOf(cat, key))}</h2><span class="xs muted">${sub}${avg ? ` · moyenne ${fmt(avg)}` : ""}</span></div></div>
      <span class="row"><button class="btn sm mkfavb ${isFav(key) ? "on" : ""}" data-act="mk-fav" data-k="${h(key)}">${X().G("star")} ${isFav(key) ? "Suivi" : "Suivre"}</button><button class="btn sm" data-act="mk-pick" data-k="${h(key)}">Fermer</button></span></div>`;
    const note = `<div class="mkbnote"><span class="tag ${beastNew(cat, key) ? "" : "good"}">${mt ? (beastNew(cat, key) ? "Pas encore à ton carnet" : "Déjà à ton carnet") : beastNew(cat, key) ? "Pas dans ton album" : "Dans ton album"}</span> ${mt
      ? "Une monture achetée ne compte ni au carnet de l'éleveur ni au classement d'élevage : il faut la faire naître ou la capturer toi-même. Ses petits, eux, comptent."
      : "Un familier acheté ne compte pas dans l'album de la ménagerie : il faut l'obtenir toi-même, en zone ou en donjon."}</div>`;
    if (!O) return `<section class="panel mkdet">${head}<div class="pad empty">Chargement…</div></section>`;
    if (M.offErr) return `<section class="panel mkdet">${head}${netErr("offers")}</section>`;
    const okOff = (o) => { const b = o.item || {}; if (o.mine) return true;
      if (M.bst && (mt ? b.st || 1 : b.st || 0) < +M.bst) return false;
      if (mt && M.bcap && b.cap !== M.bcap) return false; if (mt && M.bkids && !kidsLeft(b)) return false; return true; };
    const L = O.filter(okOff); const hid = O.length - L.length;
    const buyBtn = (o) => o.mine ? `<span class="tag" style="background:var(--panel3);color:var(--ink)">ton annonce</span>`
      : full ? `<button class="btn sm mkshort" disabled>Écurie pleine</button>`
      : o.price > kam ? `<button class="btn sm mkshort" disabled>Il te manque ${fmt(o.price - kam)} kamas</button>`
      : M.confirm === o.id ? `<button class="btn sm primary" data-act="mk-buy" data-id="${o.id}">Confirmer ${fmt(o.price)}</button>`
      : `<button class="btn sm primary" data-act="mk-ask" data-id="${o.id}" ${M.busy ? "disabled" : ""}>Acheter</button>`;
    const offs = L.map((o) => { const b = Object.assign({ sp, c: mt ? mtKey(key).c : undefined, id: mt ? undefined : key }, o.item || {});
      return `<div class="mkoffer mkboff"><span class="icobox mkbig2">${beastImg(cat, key, b)}</span><div class="grow"><div class="small">${beastSub(cat, b)}</div><div class="mkst">${beastStats(cat, b)}</div>
        <div class="xs muted">${left(o.exp)}</div></div><span class="mkpcol">${kk(o.price)}</span>${buyBtn(o)}</div>`; }).join("");
    return `<section class="panel mkdet">${head}${note}<div class="list">${offs || `<div class="empty">${hid ? "Aucune offre avec ces filtres." : "Plus aucune offre."}</div>`}</div>
      <div class="pad stack">${hid && L.length ? `<span class="xs muted">${hid} autre${hid > 1 ? "s" : ""} offre${hid > 1 ? "s" : ""} cachée${hid > 1 ? "s" : ""} par les filtres.</span>` : ""}${chartHtml(M.stats, "eq")}
      <span class="xs muted">Chaque offre est ${mt ? "une monture précise, avec son niveau, ses étoiles et sa capacité" : "un familier précis, avec son niveau et son Éveil"} : tu reçois exactement ce que tu vois.${full ? ` Ton écurie des ${h(E.MOUNTS[sp].name.toLowerCase())}s est pleine : libère une place pour acheter.` : ""}</span></div></section>`;
  }

  /* ---------- mes ventes et achats ---------- */
  function mineHtml() {
    if (!mine()) return "";
    const m = M.mine; if (!m) return `<div class="empty">Chargement…</div>`;
    const v = M.mineV || "open"; const seen = (S().hdv && S().hdv.seen) || 0;
    const row = (x) => `${icon(x.cat, x.key, x.item)}<span class="grow"><b>${h(nameOf(x.cat, x.key))}</b> <span class="xs muted">${BEAST(x.cat) && x.item ? beastSub(x.cat, x.item) : x.cat === "eq" && x.item ? `jet ${Math.round(E.itemQuality(x.item) * 100)} %` : `×${x.qty}`}</span>`;
    const fresh = m.sold.filter((x) => new Date(x.at) > seen); const sum = fresh.reduce((a, x) => a + x.price, 0); const nNew = newSales();
    const seg = `<div class="row catchips">${[["open", `En vente · ${m.open.length} / ${MAX}`], ["sold", `Vendus${nNew ? ` <span class="mknew">${nNew}</span>` : ""}`], ["bought", "Achats"]].map(([id, n]) => `<button data-act="mk-mv" data-v="${id}" aria-pressed="${v === id}">${n}</button>`).join("")}</div>`;
    const top = fresh.length ? `<div class="panel mksold"><div class="pad row between"><span><b>${fresh.length} vente${fresh.length > 1 ? "s" : ""} depuis ta dernière visite</b><br><span class="small muted">Les kamas sont déjà dans ta bourse.</span></span><b class="mkpx plus" style="font-size:20px">+ ${fmt(sum)}</b></div></div>` : "";
    let body;
    if (v === "sold") body = `<section class="panel"><div class="phead"><h2>Vendu ces 7 jours</h2></div><div class="list">${m.sold.map((x) => `<div class="li mkrow">${row(x)} · acheté par <b>${h(x.buyer || "un joueur")}</b><br><span class="xs muted">${ago(x.at)}</span></span>${kk(x.price)}</div>`).join("") || `<div class="empty">Rien de vendu cette semaine.</div>`}</div></section>`;
    else if (v === "bought") body = `<section class="panel"><div class="phead"><h2>Achats de ces 7 jours</h2></div><div class="list">${M.bought === null ? `<div class="empty">Chargement…</div>` : M.bought.map((x) => `<div class="li mkrow">${row(x)} · vendu par <b>${h(x.seller || "un joueur")}</b><br><span class="xs muted">${ago(x.at)}</span></span><b class="mkpx">− ${fmt(x.price)}</b></div>`).join("") || `<div class="empty">Aucun achat cette semaine.</div>`}</div></section>`;
    else body = `<section class="panel"><div class="phead"><h2>En vente</h2><span class="xs muted">${m.open.length} / ${MAX} places</span></div><div class="list">
        ${m.open.map((x) => { const a = (M.list || []).find((y) => y.key === x.key); const av = a && a.avg;
          return `<div class="li mkrow">${row(x)}<br><span class="xs ${new Date(x.exp) - Date.now() < 86400000 ? "mkwarn" : "muted"}">${left(x.exp)}</span>${av ? ` <span class="xs muted">· moyenne ${x.cat === "eq" ? fmt(av) : u1(av * x.qty)}</span>` : ""}</span><span class="mkpcol">${kk(x.price)}${av ? dealTag(x.price / x.qty, av) : ""}</span>
          ${M.rep === x.id ? `<input type="text" inputmode="numeric" class="mkrep" id="mkRep" value="${x.price}"><button class="btn sm primary" data-act="mk-repgo" data-id="${x.id}">OK</button>` : `<button class="btn sm" data-act="mk-rep" data-id="${x.id}">Modifier le prix</button>`}
          <button class="btn sm" data-act="mk-cancel" data-id="${x.id}" ${M.busy ? "disabled" : ""}>Retirer</button></div>`; }).join("") || `<div class="empty">Aucune annonce. Onglet Vendre pour en créer.</div>`}</div></section>
      ${M.rep ? `<span class="xs muted">Changer le prix coûte de nouveau 2 % du nouveau prix, comme dans DOFUS.</span>` : ""}`;
    return `${top}${seg}${body}<span class="xs muted">Une annonce dure 14 jours ; à la fin, l'objet revient seul dans ton sac. Chaque vente est annoncée, même sur une autre page.</span>`;
  }

  /* ---------- vendre : prix conseillé (1 kama de moins que le lot le moins cher) ---------- */
  function sugHtml(x, hint, lot) {
    if (!hint || !hint.offs) return null;
    const res = x.cat !== "eq" && !BEAST(x.cat); const same = hint.offs.filter((o) => !o.mine && o.qty === lot).slice(0, 5); const st = hint.st;
    const avgLot = st && st.avg ? Math.max(1, Math.round(st.avg * lot)) : null; const low = same[0] ? same[0].price : null;
    const sug = low ? Math.max(lot, low - 1) : avgLot;
    const chips = `<span class="row mkchips">${low ? `<button class="btn sm" data-act="mk-pset" data-v="${Math.max(lot, low - 1)}">Moins cher − 1 : ${fmt(Math.max(lot, low - 1))}</button>` : ""}${avgLot ? `<button class="btn sm" data-act="mk-pset" data-v="${avgLot}">Prix moyen : ${fmt(avgLot)}</button>` : ""}</span>`;
    const tbl = `<div class="mkcur"><span class="xs muted">${res ? `Lots de ${lot} en vente` : BEAST(x.cat) ? `${x.cat === "mt" ? "Même monture en vente" : "Même familier en vente"}` : "Le même objet en vente"}</span>${same.length ? same.map((o) => `<span class="mkcurr"><span>${res ? `${u1(o.price / lot)} / u` : BEAST(x.cat) ? beastSub(x.cat, Object.assign(x.cat === "mt" ? mtKey(x.key) : { id: x.key }, o.item || {})) : `jet ${Math.round(E.itemQuality(o.item || { tpl: x.key, stats: {} }) * 100)} %`}</span><b>${fmt(o.price)}</b></span>`).join("") : `<span class="xs muted">aucun pour l'instant : c'est toi qui fixes le prix.</span>`}</div>`;
    return { sug, html: `<div class="mksug"><div class="row between"><b class="small">${X().G("tag")} Prix conseillé</b><b class="mkpx">${sug ? fmt(sug) : "—"}</b></div><span class="xs muted">${low ? "Un kama de moins que l'offre la moins chère : la tienne passe en premier." : avgLot ? "Personne n'en vend : le prix moyen des dernières ventes." : "Ni offre ni vente récente : choisis ton prix."}</span>${sug || same.length ? chips + tbl : ""}</div>` };
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
    if (a === "mk-bq") M.confirm = null;
    if (a === "mk-lmin" || a === "mk-lmax" || a === "mk-set" || a === "mk-bq") { M[{ "mk-lmin": "lmin", "mk-lmax": "lmax", "mk-set": "set", "mk-bq": "bq" }[a]] = ev.target.value; clearTimeout(qTimer); qTimer = setTimeout(paint, 400); }
  });
  document.addEventListener("keydown", (ev) => { const t = ev.target; if ((ev.key === "Enter" || ev.key === " ") && t.getAttribute && t.getAttribute("role") === "button" && /^mk-/.test(t.dataset.act || "")) { ev.preventDefault(); t.click(); } });
  document.addEventListener("toggle", (ev) => { if (ev.target.classList && ev.target.classList.contains("mkadd")) M.tOpen = ev.target.open; }, true);
  document.addEventListener("change", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^mk-/.test(a)) return;
    if (a === "mk-reach") { M.reach = ev.target.checked; paint(); return; }
    if (a === "mk-stat") { M.stat = ev.target.value; paint(); return; }
    if (a === "mk-bst" || a === "mk-bcap") { M[a === "mk-bst" ? "bst" : "bcap"] = ev.target.value; paint(); return; } // 2.1.30
    if (a === "mk-bkids" || a === "mk-bnew") { M[a === "mk-bkids" ? "bkids" : "bnew"] = ev.target.checked; paint(); return; }
  });
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^mk-/.test(a)) return;
    switch (a) {
      case "mk-tab": M.tab = d.v; M.confirm = null; if (d.v === "mine") { loadMine(); } if (d.v === "buy") { M.list = null; } if (d.v === "sell" && !M.mine) loadMine(); render($("#main")); return;
      case "mk-fam": M.fam = d.v; M.sub = ""; M.stat = ""; M.set = ""; M.bst = M.bcap = ""; M.bkids = M.bnew = false; M.q = ""; M.sel = null; M.list = null; M.tab = "buy"; M.fOpen = false; render($("#main")); return;
      case "mk-sub": M.sub = d.v; M.sel = null; M.fOpen = false; paint(); return;
      case "mk-sk": if (M.sk === d.v) M.sd = -M.sd; else { M.sk = d.v; M.sd = d.v === "n" || d.v === "lvl" ? -1 : 1; } paint(); return;
      case "mk-fav": { const s = S(); if (!s) return; s.hdv = s.hdv || { op: 0, log: [] }; const F = (s.hdv.fav = s.hdv.fav || {}); if (F[d.k]) delete F[d.k]; else F[d.k] = 1; X().markDirty(); paint(); return; }
      case "mk-fopen": M.fOpen = !M.fOpen; paint(); return;
      case "mk-freset": M.lmin = M.lmax = M.stat = M.set = M.bst = M.bcap = ""; M.reach = M.bkids = M.bnew = false; paint(); return;
      case "mk-per": M.per = +d.v; paint(); return;
      case "mk-bqset": M.bq = d.v; M.confirm = null; paint(); return;
      case "mk-bqask": M.confirm = "q"; paint(); return;
      case "mk-mv": M.mineV = d.v; if (d.v === "sold") markSeen(); if (d.v === "bought") loadBought(); paint(); return;
      case "mk-bqgo": { const n = Math.round(+String(M.bq).replace(/\s/g, "")) || 0; if (n > 0 && M.sel) buyQty(M.sel, n); return; }
      case "mk-pset": M.price = d.v; paint(); return;
      case "mk-pick": if (M.sel === d.k) { M.sel = null; paint(); return; } M.bq = ""; pick(d.k); return;
      case "mk-unpick": M.sel = null; paint(); return;
      case "mk-retry": if (d.v === "offers") { pick(M.sel); return; } if (d.v === "ord") M.orders = null; else M.list = null; render($("#main")); return;
      case "mk-ask": M.confirm = +d.id; paint(); return;
      case "mk-buy": { const r = await act("hdv_buy", { p_id: +d.id }, "Acheté ! C'est dans ton sac."); M.confirm = null; if (r) { search(); pick(M.sel); } else if (M.sel) pick(M.sel); return; }
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
        tradeSet((o) => { if (BEAST(x.cat)) { const f = x.cat === "mt" ? "mounts" : "pets"; o[f] = o[f] || []; const i = o[f].indexOf(x.uid); if (i >= 0) o[f].splice(i, 1); else o[f].push(x.uid); } // 2.1.30
          else if (x.uid) { o.items = o.items || []; const i = o.items.indexOf(x.uid); if (i >= 0) o.items.splice(i, 1); else o.items.push(x.uid); } else { const b = bucket(x.cat); o[b] = o[b] || {}; if (o[b][x.key]) delete o[b][x.key]; else o[b][x.key] = x.n; } }); return; }
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
  /* 2.1.30 : « Vendre à l'HdV » depuis la fiche d'une monture ou d'un familier */
  const sellBeast = (cat, uid) => { const x = sellable(cat).find((y) => y.uid === uid); M.tab = "sell"; M.sCat = cat; M.sSel = x ? String(uid) : null; M.price = ""; M.n = 1; M.lot = 1; if (x) priceHint(cat, x.key); if (M.mine === null && mine()) loadMine(); };
  /* 0.1.38 : « Vendre à l'HdV » depuis une ressource de l'inventaire */
  const sellRes = (key) => { const c = E.isKey(key) ? "clef" : "res"; const n = (S() && S().res[key]) || 0; M.tab = "sell"; M.sCat = c; M.sSel = key; M.price = ""; M.n = 1; M.lot = n >= 100 ? 100 : n >= 10 ? 10 : 1; priceHint("res", key); if (M.mine === null && mine()) loadMine(); };
  /* 0.1.41 : « Offre d'achat HdV » depuis les métiers et la forgemagie (ressource ou rune qui manque) */
  const orderFor = (cat, key, qty) => { M.tab = "ord"; M.oView = "mine"; oPick(cat, key, qty || 0); if (M.oMine === null && mine()) loadOMine(); };
  window.MARKET = { start, newSales, sellItem, sellBeast, sellRes, orderFor, canSell: (key) => !blocked("res", key), render: (m) => { render(m); if (M.tab === "mine") setTimeout(markSeen, 4000); if (mine()) sync(); }, sync, apply, adminHtml, tradeAsk, poll: tradePoll, M };
})();
