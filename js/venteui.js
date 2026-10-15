/* ============================================================================
   VENTE DIRECTE (interface), Idlus 1.0.30 « L'économie » (choix 13 à 17, écrans v-sell, v-cours, v-guest)
   - Prix du serveur (vente_cours, supabase/vente.sql) relus toutes les 15 minutes au plus ; entre deux lectures, le jeu
     calcule la remontée (E.venteNow, js/vente.js).
   - Fiche d'une ressource (Héros › Inventaire › Ressources) : prix, tendance, jauge ×0,1 à ×3, courbe des 48 h,
     « Vendre » et « Vendre à l'HdV » ; une flèche ▲ ▼ sur chaque case.
   - Page Communauté › Cours des ressources : les plus chères, les plus vendues, ton sac au prix du moment.
   - Surplus (« Garder au maximum », limite de banque des absences) vendu au prix du moment toutes les 10 minutes.
   Compte connecté (partie 1) obligatoire pour vendre ; sans compte, hors ligne ou en partie solo, le marchand de
   secours rachète le surplus comme avant (E.venteHook, js/vente.js). Le serveur vérifie tout (hdv_save, hdv_qty).
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.VENTE || !window.DX) return;
  const ON = window.ONLINE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const VV = E.VENTE;
  /* V.c[ressource] = [coef, volume récent, vendues en 24 h, heure locale de la lecture (ms)] ; une ressource absente est au plafond ×3 */
  const V = { at: 0, c: {}, up: false, err: false, missing: false, block: null, loading: null, busy: false, curve: {}, qty: {}, cq: "", last: null };

  /* ---------- compte et serveur ---------- */
  const online = () => !!(ON && ON.enabled);
  const acct = () => !!(online() && ON.user && ON.link().uid === ON.user.id && !(ON.solo && ON.solo()));
  const sellOk = () => acct() && !!ON.profile && ON.state !== "offline" && !V.missing && !V.block;
  /* refus durable du serveur (partie retouchée par le panel de test, compte suspendu, partie en vérification) : le marchand de secours reprend */
  const BLOCK = /panel de test|suspendu|vérification/i;
  let hk = { t: 0, v: false }; // lu à chaque combat : gardé 2 s
  E.venteHook = () => { const n = Date.now(); if (n - hk.t > 2000 || n < hk.t) hk = { t: n, v: acct() && !!ON.profile && !V.missing && !V.block }; return hk.v; };
  const whyNot = () => (!online() ? "Hors ligne : la vente directe passe par le serveur." : ON.user && ON.solo && ON.solo() ? ON.SOLO_ERR
    : !acct() ? "Crée ton compte (gratuit) pour vendre au jeu : la vente directe passe par le serveur." : V.missing ? "La vente directe n'est pas encore ouverte sur le serveur." : V.block ? V.block
    : !ON.profile ? "Choisis d'abord ton pseudo." : "Hors ligne : la vente directe reviendra avec la connexion.");
  const noFn = (e) => /function|does not exist|could not find|schema cache|PGRST202/i.test(String(e || ""));

  function load(force) {
    if (!online()) return Promise.resolve(false);
    if (V.loading) return V.loading;
    if (!force && V.at && Date.now() - V.at < 15 * 60000) return Promise.resolve(true);
    V.loading = ON.rpc("vente_cours").then((r) => {
      V.loading = null;
      if (r.err || !r.data || r.data.err) { V.err = true; if (r.err && noFn(r.err)) { V.missing = true; hk.t = 0; } return false; }
      const t = Date.now(); V.c = {}; for (const k in r.data.c || {}) { const x = r.data.c[k]; V.c[k] = [+x[0], +x[1], +x[2] || 0, t]; }
      V.up = !!r.data.up; V.at = t; V.err = false; if (V.missing) hk.t = 0; V.missing = false; return true;
    }).catch(() => { V.loading = null; V.err = true; return false; });
    return V.loading;
  }
  /* coef et volume récent d'une ressource maintenant : { c, v, q24, trend } */
  const now = (n) => { const x = V.c[n]; const r = x ? E.venteNow(x[0], x[1], (Date.now() - x[3]) / 3600000) : { c: VV.MAX, v: 0 }; r.q24 = x ? x[2] : 0; r.trend = E.venteTrend(r.c, r.v); return r; };
  const mult = () => (V.up ? 1.05 : 1);
  const unit = (n) => E.resPrice(n) * now(n).c * mult();
  const quote = (n, q) => E.venteLot(E.resPrice(n), now(n).c, q, mult()).k;
  const cursor = () => { const s = S(); return (s && s.hdv && s.hdv.op) || 0; };

  /* vendre : lots = { ressource: quantité } ; la partie part d'abord en ligne (le serveur y vérifie les ressources) */
  async function sell(lots, noPush) {
    if (!sellOk()) return { err: whyNot() };
    if (V.busy) return { err: "Une vente est déjà en cours." };
    V.busy = true;
    try {
      if (!noPush) { try { await X().onPush(); } catch (e) {} }
      const r = await ON.rpc("vente_sell", { p_after: cursor(), p_lots: lots });
      if (r.err) { if (noFn(r.err)) { V.missing = true; hk.t = 0; } return { err: /connexion/i.test(r.err) ? r.err : "Refusé par le serveur : " + r.err }; }
      if (!r.data || r.data.err) { const m = (r.data && r.data.err) || "Refusé par le serveur."; if (BLOCK.test(m)) { V.block = m; hk.t = 0; } return { err: m }; }
      if (r.data.ops && window.MARKET) window.MARKET.apply(r.data.ops, true);
      const t = Date.now(); for (const k in r.data.c || {}) { const o = V.c[k]; V.c[k] = [+r.data.c[k][0], +r.data.c[k][1], ((o && o[2]) || 0) + ((r.data.sold || {})[k] || 0), t]; }
      V.up = !!r.data.up;
      const s = S(); if (s && s.venteQ) for (const k in r.data.sold || {}) delete s.venteQ[k];
      X().markDirty();
      return r.data;
    } finally { V.busy = false; }
  }
  /* surplus (« Garder au maximum », limite de banque d'une absence) : vendu au prix du moment, en une vente */
  async function surplus() {
    const s = S(); if (!s) return;
    if (!acct() || V.missing || V.block) { // plus de compte (ou vente fermée, ou refusée pour de bon) : ce qui attendait part au marchand de secours, comme avant
      const L = Object.keys((E.venteFix(s), s.venteQ)); if (!L.length) return;
      for (const [n, q] of E.venteSurplus(s)) if (s.venteQ[n] !== undefined && E.merchantRes) E.merchantRes(s, n, q);
      s.venteQ = {}; X().markDirty(); return;
    }
    if (!sellOk() || V.busy) return;
    const L = E.venteSurplus(s);
    for (const k in s.venteQ) if (!L.some((x) => x[0] === k)) delete s.venteQ[k]; // rien de plus à vendre : la limite de l'absence est faite
    if (!L.length) return;
    await sell(Object.fromEntries(L.slice(0, 40)));
  }

  /* courbe d'une ressource (lue à la demande, gardée 10 minutes) */
  function curve(n) {
    const C = V.curve[n]; if (C && (C.loading || Date.now() - C.at < 10 * 60000)) return C;
    const o = V.curve[n] = { at: Date.now(), loading: true, pts: C ? C.pts : null, q24: C ? C.q24 : 0 };
    if (!online()) { o.loading = false; return o; }
    ON.rpc("vente_courbe", { p_key: n }).then((r) => {
      o.loading = false; if (r.err || !r.data) return;
      const off = Date.now() - (+r.data.t || Date.now()); // décalage d'horloge avec le serveur
      const rows = (r.data.pts || []).map((x) => [+x[0] + off, +x[1], +x[2]]);
      o.pts = E.venteCourbe(rows, Date.now()); o.q24 = E.vente24(rows, Date.now());
      const el = $("#vdSpark"); if (el && el.dataset.n === n) el.outerHTML = sparkHtml(n);
    });
    return o;
  }

  /* ---------- petits morceaux ---------- */
  const coefTxt = (c) => "×" + c.toFixed(2).replace(".", ",");
  const kTxt = (x) => (x >= 100 ? fmt(x) : (Math.floor(x * 10) / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 }));
  const arrowHtml = (t, cls = "") => (t > 0 ? `<span class="vd-up ${cls}" title="Remonte : peu vendue en ce moment">▲</span>` : t < 0 ? `<span class="vd-dn ${cls}" title="Baisse : beaucoup vendue en ce moment">▼</span>` : `<span class="vd-eq ${cls}" title="Stable">=</span>`);
  const pos = (c) => (((c - VV.MIN) / (VV.MAX - VV.MIN)) * 100).toFixed(1);
  function sparkHtml(n) {
    const C = V.curve[n]; const cur = now(n).c;
    const pts = C && C.pts ? C.pts.slice(0, -1).concat([cur]) : Array(49).fill(cur);
    const W = 480, H = 70, y = (c) => (H - 4 - ((c - VV.MIN) / (VV.MAX - VV.MIN)) * (H - 8)).toFixed(1);
    const d = pts.map((c, i) => `${i ? "L" : "M"}${((i / 48) * W).toFixed(1)} ${y(c)}`).join(" ");
    return `<svg class="vd-spark" id="vdSpark" data-n="${h(n)}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Prix des 48 dernières heures"><line x1="0" x2="${W}" y1="${y(1)}" y2="${y(1)}" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="#e8c063" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const goTxt = (q, k) => `Vendre ${fmt(q)} · ${fmt(k)} k`;
  /* redessine la page si elle montre toujours la même chose (une fois les prix lus) */
  const again = (still) => load().then(() => { if (S() && still()) X().render(); });

  /* ---------- fiche d'une ressource : encadré « Vente directe » ---------- */
  function box(n) {
    const s = S(); const b = E.resPrice(n); const qq = s.res[n] || 0;
    const hdvB = online() && window.MARKET && window.MARKET.canSell(n) ? `<button class="btn sm" data-act="hdvres" data-n="${h(n)}">Vendre à l'HdV</button>` : "";
    const head = (sub) => `<div class="row between"><b>Vente directe</b><span class="xs muted">${sub}</span></div>`;
    if (!online()) return `<div class="vd-box">${head("prix du serveur")}<span class="small">${h(whyNot())} En attendant, le surplus au-delà de « Garder au maximum » part au marchand de secours (30 % de la valeur).</span></div>`;
    if (!V.at) {
      if (!V.loading && !V.err) again(() => UI().tab === "inv" && UI().resSel === n);
      return `<div class="vd-box">${head("prix du serveur, en direct")}<span class="small muted">${V.err ? `Pas de réponse du serveur : réessaie dans un moment. <button class="btn sm" data-act="vd-retry">Réessayer</button>` : "Lecture du prix…"}</span>${hdvB ? `<div class="row">${hdvB}</div>` : ""}</div>`;
    }
    const x = now(n); const u = b * x.c * mult(); curve(n);
    const price = `<div class="vd-price"><span class="big num">${kTxt(u)} k</span><span class="small">l'unité</span><span class="${x.c < 1 ? "vd-dn" : "vd-up"}">${arrowHtml(x.trend)} ${coefTxt(x.c)}</span><span class="xs muted">valeur de base ${fmt(b)} k</span></div>`;
    const gauge = `<div class="vd-gauge" title="${coefTxt(x.c)}"><b style="left:calc(${pos(x.c)}% - 2px)"></b></div><div class="vd-scale xs muted"><span>×0,1 (plancher)</span><span style="left:${pos(1)}%">×1</span><span>×${String(VV.MAX).replace(".", ",")} (plafond)</span></div>`;
    const spark = `${sparkHtml(n)}<span class="xs muted">48 dernières heures : chaque vente du serveur fait baisser le prix, jusqu'à ×0,1 ; il remonte tout seul (moitié de l'écart en 6 h).${x.q24 ? ` ${fmt(x.q24)} vendues sur le serveur en 24 h.` : ""}</span>`;
    if (!sellOk()) {
      const solo = ON.user && ON.solo && ON.solo();
      const panel = solo ? X().soloPanel("la vente directe") : acct() ? `<div class="vd-acc"><span class="small"><b>${h(whyNot())}</b></span>${hdvB}</div>`
        : `<div class="panel vd-guest"><div class="pad row between"><span><b>Crée ton compte pour vendre</b><br><span class="xs muted">C'est gratuit, et ta partie te suit. La vente directe et l'HdV passent par le serveur.</span></span><button class="btn primary sm" data-act="on-loginscreen">Créer mon compte</button></div></div>`;
      return `<div class="vd-box">${head("prix du serveur, en direct")}${price}${gauge}${panel}</div>`;
    }
    const q = Math.max(1, Math.min(qq, V.qty[n] > 0 ? V.qty[n] : qq));
    const done = V.last && V.last.n === n && Date.now() - V.last.at < 60000 ? `<div class="vd-done small">${h(V.last.t)}</div>` : "";
    const up = V.up ? `<span class="xs vd-gold">Comptoir de guilde : +5 % sur la vente directe.</span>` : "";
    return `<div class="vd-box">${head(`prix du serveur, en direct · <button class="linkbtn" data-act="nav" data-v="cours">Cours</button>`)}${price}${gauge}${spark}${up}${done}
      ${qq ? `<div class="row vd-go"><input type="number" id="vdQty" data-act="vd-qty" data-n="${h(n)}" min="1" max="${qq}" value="${q}" aria-label="Quantité à vendre"><button class="btn sm" data-act="vd-all" data-n="${h(n)}">Tout</button><button class="btn primary sm" id="vdGo" data-act="vd-sell" data-n="${h(n)}" ${V.busy || !qq ? "disabled" : ""}>${goTxt(q, quote(n, q))}</button>${hdvB}</div>` : ""}
      <span class="xs muted">Un gros lot fait baisser le prix pendant la vente : le total affiché en tient compte.</span>
      <div class="vd-note xs">La vente directe remplace le marchand de secours : le surplus au-delà de « Garder au maximum » est vendu au prix du moment. Les Commandes du jour restent.</div></div>`;
  }
  /* flèche de tendance sur une case de ressource (seulement quand les prix sont lus) */
  const arrow = (n) => (V.at && E.venteOk(n) ? arrowHtml(now(n).trend, "vd-ar") : "");
  const capTxt = (n) => (E.venteHook() ? "le surplus est vendu au prix de la vente directe (toutes les 10 minutes)"
    : `le surplus part au marchand de secours (${Math.round(E.MERCHANT * 100)} % de la valeur, ${kTxt(E.merchantPrice(n, 100) / 100)} k l'unité)${online() && !acct() ? " ; avec un compte, il est vendu au prix de la vente directe" : ""}`);
  const capToast = (v) => (E.venteHook() ? `Surplus au-delà de ${fmt(v)} vendu au prix de la vente directe (toutes les 10 minutes).` : `Surplus au-delà de ${fmt(v)} vendu au marchand de secours.`);
  const bankTxt = (fut) => (E.venteHook() ? (fut ? "sera vendu au prix de la vente directe" : "est vendu au prix de la vente directe (compte connecté)") : fut ? "ira au marchand de secours" : "part au marchand de secours (30 % de la valeur ; avec un compte, au prix de la vente directe)");
  const invNote = () => {
    if (online() && !V.at && !V.loading && !V.err) again(() => UI().tab === "inv" && UI().inv === "res");
    return `<div class="row small vd-inote"><span class="xs muted grow">Les ressources sont partagées entre tous vos héros. Pour vendre : la vente directe au prix du serveur ou l'hôtel de vente, depuis la fiche d'une ressource${V.at ? " (▲ le prix remonte, ▼ il baisse)" : ""}.</span>${online() ? `<button class="btn sm" data-act="nav" data-v="cours">${X().IC("kamas")} Cours des ressources</button>` : ""}</div>`;
  };

  /* ---------- page Communauté › Cours des ressources ---------- */
  function row(n) {
    const s = S(); const x = now(n); const b = E.resPrice(n); const own = s.res[n] || 0;
    return `<div class="li small vd-row">${X().im(X().resImg(n), "ico", n)}<span class="grow"><b>${h(n)}</b><br><span class="xs muted">base ${fmt(b)} k${x.q24 ? ` · ${fmt(x.q24)} vendues en 24 h` : ""}${own ? ` · tu en as ${fmt(own)}` : ""}</span></span>
      <b class="num vd-p">${kTxt(b * x.c * mult())} k</b><span class="vd-c ${x.c < 1 ? "vd-dn" : "vd-up"}">${arrowHtml(x.trend)} ${coefTxt(x.c)}</span>${own ? `<button class="btn sm" data-act="searchres" data-n="${h(n)}">Vendre</button>` : ""}</div>`;
  }
  function listHtml() {
    const s = S(); const q = E.searchNorm ? E.searchNorm(V.cq || "") : (V.cq || "").toLowerCase();
    const all = Object.keys(D.RES).filter((n) => E.venteOk(n));
    if (q) {
      const has = (n) => (E.searchNorm ? E.searchNorm(n) : n.toLowerCase()).includes(q);
      const L = all.filter(has).sort((a, b) => a.localeCompare(b, "fr")).slice(0, 40);
      return `<section class="panel vd-cours"><div class="phead"><h2>Recherche</h2><span class="xs muted">${L.length >= 40 ? "40 premières" : L.length} ressource${L.length > 1 ? "s" : ""}</span></div><div class="list">${L.map(row).join("") || `<div class="empty">Aucune ressource.</div>`}</div></section>`;
    }
    const price = (n) => E.resPrice(n) * now(n).c;
    const top = all.slice().sort((a, b) => price(b) - price(a) || a.localeCompare(b, "fr")).slice(0, 12);
    const sold = Object.keys(V.c).filter((n) => E.venteOk(n) && (now(n).q24 > 0 || now(n).v >= 1)).sort((a, b) => now(b).q24 - now(a).q24 || now(b).v - now(a).v || a.localeCompare(b, "fr")).slice(0, 12);
    const mine = Object.keys(s.res).filter((n) => s.res[n] > 0 && E.venteOk(n)).sort((a, b) => price(b) * s.res[b] - price(a) * s.res[a] || a.localeCompare(b, "fr")).slice(0, 8);
    const log = (Array.isArray(s.venteLog) ? s.venteLog : []).slice(0, 6);
    return `<div class="grid2g even">
      <section class="panel vd-cours"><div class="phead"><h2>Les plus chères (rares)</h2></div><div class="list">${top.map(row).join("")}</div></section>
      <section class="panel vd-cours"><div class="phead"><h2>Les plus vendues</h2><span class="xs muted">24 dernières heures</span></div><div class="list">${sold.map(row).join("") || `<div class="empty">Personne n'a vendu de ressource ces dernières heures : tout est au plus haut (×${String(VV.MAX).replace(".", ",")}).</div>`}</div></section></div>
      ${mine.length ? `<section class="panel vd-cours"><div class="phead"><h2>Ton sac au prix du moment</h2><span class="xs muted">les ressources qui valent le plus</span></div><div class="list">${mine.map(row).join("")}</div></section>` : ""}
      ${log.length ? `<section class="panel"><div class="phead"><h2>Tes dernières ventes directes</h2></div><div class="list">${log.map((l) => `<div class="li small"><span class="grow">${h(l.t)}</span></div>`).join("")}</div></section>` : ""}`;
  }
  function page(main) {
    const s = S();
    const head = `<div class="pagehead"><h1>Cours des ressources</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s.kamas)}</b> kamas</span></div>`;
    const intro = `<p class="note">Le prix de vente directe de chaque ressource, pour tout le serveur, de ×0,1 à ×${String(VV.MAX).replace(".", ",")} sa valeur. Plus une ressource est vendue, moins elle rapporte ; elle remonte quand personne n'en vend (moitié de l'écart en 6 h). ▲ remonte, ▼ baisse, = stable.</p>`;
    const solo = ON && ON.user && ON.solo && ON.solo();
    const gate = !online() ? "" : solo ? X().soloPanel("la vente directe") : !acct() ? `<div class="panel vd-guest"><div class="pad row between"><span><b>Crée ton compte pour vendre</b><br><span class="xs muted">C'est gratuit, et ta partie te suit. La vente directe et l'HdV passent par le serveur. En attendant, tu peux regarder les prix.</span></span><button class="btn primary sm" data-act="on-loginscreen">Créer mon compte</button></div></div>` : "";
    let body;
    if (!online()) body = `<div class="panel"><div class="empty">Hors ligne : les prix de la vente directe viennent du serveur. Sans connexion, le surplus part au marchand de secours (30 % de la valeur).</div></div>`;
    else if (!V.at) {
      if (!V.loading && !V.err) again(() => UI().tab === "cours");
      body = `<div class="panel"><div class="empty">${V.err ? `Pas de réponse du serveur : réessaie dans un moment. <button class="btn sm" data-act="vd-retry">Réessayer</button>` : "Lecture des prix…"}</div></div>`;
    } else body = `<div class="row invbar"><input type="text" id="vdCq" data-act="vd-cq" placeholder="Rechercher une ressource…" value="${h(V.cq)}" aria-label="Rechercher une ressource"><button class="btn sm" data-act="vd-inv">${X().IC("sac")} Mes ressources</button></div><div id="vdList" class="stack">${listHtml()}</div>`;
    main.innerHTML = `${head}<div class="stack">${intro}${gate}${body}</div>`;
  }
  window.DX.pages.cours = page;

  /* ---------- clics et saisie ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^vd-/.test(a) || !S()) return;
    const n = t.dataset.n; const s = S();
    if (a === "vd-all") { V.qty[n] = s.res[n] || 0; X().render(); return; }
    if (a === "vd-inv") { const ui = UI(); ui.tab = "inv"; ui.inv = "res"; ui.newResDone = false; X().render(); window.scrollTo(0, 0); return; }
    if (a === "vd-retry") { V.err = false; load(true).then(() => { if (S()) X().render(); }); return; }
    if (a === "vd-sell") {
      const inp = $("#vdQty"); const q = Math.floor(+(inp ? inp.value : 0) || 0);
      if (!(q > 0) || q > (s.res[n] || 0)) { X().toast("Quantité invalide."); return; }
      t.disabled = true; t.textContent = "Vente en cours…";
      sell({ [n]: q }).catch(() => ({ err: "La vente n'a pas pu se faire : réessaie dans un moment." })).then((r) => {
        if (r.err) X().toast(r.err, "warn", 6000);
        else { const got = (r.sold || {})[n] || 0; const txt = `Vendu : ${fmt(got)} × ${n} pour ${fmt(r.k)} kamas${r.share > 0 ? ` (+${fmt(r.share)} pour le coffre de ta guilde)` : ""}.`; X().toast(txt, "rare"); V.last = { n, t: txt, at: Date.now() }; delete V.qty[n]; setTimeout(() => { if (S() && UI().tab === "inv" && UI().resSel === n && !(S().res[n] > 0)) X().render(); }, 61000); }
        if (S()) X().render();
      });
    }
  });
  document.addEventListener("input", (ev) => {
    const t = ev.target; const a = t.dataset && t.dataset.act; if (!a || !/^vd-/.test(a) || !S()) return;
    if (a === "vd-qty") { const n = t.dataset.n; const q = Math.max(0, Math.min(S().res[n] || 0, Math.floor(+t.value || 0))); V.qty[n] = q; const b = $("#vdGo"); if (b) b.textContent = goTxt(q, q ? quote(n, q) : 0); return; }
    if (a === "vd-cq") { V.cq = t.value.slice(0, 40); clearTimeout(V.cqT); V.cqT = setTimeout(() => { const L = $("#vdList"); if (L && UI().tab === "cours") L.innerHTML = listHtml(); }, 150); }
  });

  /* ---------- toutes les minutes : prix relus toutes les 15 minutes, surplus vendu toutes les 10 minutes ---------- */
  let tick = 0;
  setTimeout(() => { if (S() && acct()) load().then(surplus); }, 45000);
  setInterval(() => {
    if (!S()) return; tick++;
    if (document.visibilityState === "visible" && online() && (acct() || UI().tab === "cours" || UI().tab === "inv")) load();
    if (tick % 10 === 0) surplus();
  }, 60000);

  window.VENTEUI = { has: (n) => E.venteOk(n), kept: (n) => !!(V.last && V.last.n === n && Date.now() - V.last.at < 60000), box, arrow, capTxt, capToast, bankTxt, invNote, load, now, quote, sell, surplus, V };
})();
