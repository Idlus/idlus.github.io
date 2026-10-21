/* ============================================================================
   Monocompte — écrans de la Saison 1 « Les Fragments du Temps » (moteur : js/saison1.js), d'après la seconde
   maquette tranchée le 20/10/2026 (5A 8A 9A) : Carnet des Fragments (Défis › Carnet des Fragments, avec l'événement
   final à partir du jour 50 et, dans une partie de test, l'horloge de test), Boutique temporelle, fiche des Éclats
   du Temps dans le sac, Boutique d'Archives dans l'Éternel.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.MONO || !E.MONO.tf || !window.DX) return;
  const TF = E.MONO.tf;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(Math.round(n));
  const IC = (n) => X().IC(n, "");
  const I = (id, c) => `<img class="${c || ""}" src="assets/i/${id}.png" alt="" loading="lazy">`;
  const EC = (c) => I(TF.icon, "tf-ec " + (c || ""));
  const MED = ["🥉", "🥈", "🥇"], TIER = ["bronze", "argent", "or"], CL = ["br", "ar", "or"];
  const CAT_IC = ["combat", "metiers", "couronne"];
  const dur = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); const j = Math.floor(m / 1440); return j ? `${j} j ${Math.floor((m % 1440) / 60)} h` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
  const testOk = (s) => !!(s && s.mono && !s.mono.eternel && (s.mono.test || (window.DX.testerOk && window.DX.testerOk()) || (window.DX.monoBetaOn && window.DX.monoBetaOn()))); // bêta fermée : chaque testeur peut lancer l'horloge accélérée (jour 3)
  const back = () => { UI().tab = "home"; X().render(); };

  /* ---------- morceaux ---------- */
  function banner(s) {
    const day = E.monoDay(s), mi = Math.min(4, E.monoManche(s)) - 1, M = TF.MANCHES[mi], bal = E.tfBalance(s);
    const act = E.tfActTotal(s), q = E.tfQuota(s);
    const nextJ = mi < 3 ? (mi + 1) * 14 + 1 : 57;
    return `<div class="tf-hero"><div class="tf-bal">${I(TF.icon)}<b>${fmt(bal)}</b><span>Éclats du Temps</span></div>
      <div class="tf-mid"><span class="tf-kick">${h(E.monoSeasonDef(s.mono.s).nom)} · ${h(E.monoSeasonDef(s.mono.s).theme || "")} · jour ${day} sur 56${E.monoClockOn(s) ? " · horloge de test" : ""}</span><h2>Manche ${M.n} · ${h(M.nom)}</h2>
        <div class="tf-season">${TF.MANCHES.map((m, i) => `<div class="${i < mi ? "done" : i === mi ? "cur" : ""}" style="${i === mi ? `--p:${(((day - 1) % 14) + 0.5) / 14 * 100}%` : ""}">${m.n}</div>`).join("")}<span class="tf-now" style="left:${((day - 0.5) / 56) * 100}%"></span></div>
        <div class="tf-quota">Éclats d'activité : <b>${fmt(act)} / ${fmt(q)}</b> débloqués (100 par semaine, cumulables jusqu'à 800)<div class="tf-qb"><div style="width:${q ? Math.min(100, (act / q) * 100) : 0}%"></div></div></div>
        <div class="tf-tags"><span class="pill">${mi < 3 ? `Manche ${TF.MANCHES[mi + 1].n} au jour ${nextJ}` : "Fin de saison au jour 56"}</span><span class="pill">Défis ouverts jusqu'au jour 56</span></div></div>
      <div class="tf-side"><button class="btn primary" data-act="tf-go" data-v="boutique">${EC()} Boutique temporelle</button></div></div>`;
  }
  function tiers(s, x) {
    const v = E.tfReward(x), r = E.tfTier(s, x), paid = ((E.tfState(s).d[x.id] || {}).paid) || 0;
    return `<div class="tf-tiers">${x.need.map((n, i) => { const st = i < paid ? "done" : i < r ? "ready" : "lock";
      return `<div class="tf-t ${CL[i]} ${st}"><span class="tf-md">${MED[i]}</span><span>${fmt(n)}${x.u ? " " + x.u : ""}</span><b>${EC()}${v[i]}</b>${st === "done" ? `<span class="xs">✓ reçu</span>` : ""}</div>`; }).join("")}</div>`;
  }
  function card(s, x) {
    const p = E.tfProgress(s, x), top = x.need[2], on = E.tfDefiOpen(s, x);
    return `<div class="tf-card${on ? "" : " lock"}"><span class="tf-cat">${IC(CAT_IC[x.c])}${h(TF.CATS[x.c])}</span><h3>${h(x.n)}</h3><p>${h(x.d)}</p>
      <div class="tf-bar"><div style="width:${Math.min(100, (p / top) * 100)}%"></div></div><span class="xs muted">${fmt(p)} / ${fmt(top)}${x.u ? " " + x.u : ""}${soon(x)}</span>${tiers(s, x)}${bureau(x)}</div>`;
  }
  /* défi 12 « Rendez-vous du temps » : la règle vient du Bureau des Aventuriers (window.Bureau.d12, compté par le serveur) */
  const BU = () => (window.Bureau && window.Bureau.d12 ? window.Bureau : null);
  function soon(x) {
    if (x.id === "d12" && BU()) { let R = null; try { R = BU().d12(); } catch (e) { R = null; } if (R && R.texte) return ` · ${h(R.texte)}`; }
    return x.soon ? ` · se remplit ${h(x.soon)}` : "";
  }
  function bureau(x) {
    if (x.id !== "d12" || !BU()) return "";
    let on = false; try { on = !!(BU().ouvert && BU().ouvert()); } catch (e) { on = false; }
    return on ? `<div class="tf-side"><button class="btn sm" data-act="tf-go" data-v="bureau">Bureau des Aventuriers</button></div>` : "";
  }
  const ORIG = { defi: "Défis de la saison", act: "Activités (combats, donjons, métiers)", recu: "Reçus d'autres joueurs (HdV, échanges)", achat: "Dépensés en boutique" };
  function ledger(s) {
    const L = E.tfLedger(s); const by = {}; L.forEach((l) => { const k = l.o === "achat" || l.n < 0 ? "achat" : l.o; by[k] = (by[k] || 0) + l.n; });
    const row = (k) => `<span>${ORIG[k]}</span><b class="${k === "achat" ? "neg" : ""}">${by[k] ? (by[k] > 0 ? "+" : "−") + fmt(Math.abs(by[k])) : "0"}</b>`;
    const last = L.slice().sort((a, b) => b.t - a.t || b.id - a.id).slice(0, 6);
    return `<div class="tf-two"><section class="panel"><div class="phead"><h2>${EC()} D'où viennent tes Éclats</h2><span class="small muted">registre provisoire, avant le serveur</span></div><div class="pad tf-led">
      ${["defi", "act", "recu", "achat"].map(row).join("")}<span class="tot"><b>Solde</b></span><b class="tot">${fmt(E.tfBalance(s))}</b></div></section>
      <section class="panel"><div class="phead"><h2>Derniers mouvements</h2></div><div class="pad tf-log">${last.length ? last.map((l) => `<div><span>${h(l.why || ORIG[l.o] || l.o)}</span><b class="${l.n < 0 ? "neg" : ""}">${l.n > 0 ? "+" : "−"}${fmt(Math.abs(l.n))}</b></div>`).join("") : `<span class="small muted">Aucun mouvement pour l'instant : finis des donjons, bats des archimonstres, récolte et fabrique.</span>`}</div></section></div>`;
  }
  function today(s) {
    const T = E.tfState(s); const A = T.act.day === E.monoDay(s) ? T.act : {};
    return `<section class="panel" style="margin-top:12px"><div class="phead"><h2>Activités du jour</h2><span class="small muted">jour ${E.monoDay(s)} · ${TF.DAYMAX} au plus par jour, hors ligne et Sablier compris</span></div><div class="pad tf-acts">
      ${Object.entries(TF.ACT).map(([k, a]) => `<div><span>${h(a.n)}</span><b>${fmt(A[k] || 0)} / ${a.max}</b></div>`).join("")}</div></section>`;
  }
  function finale(s) {
    if (!E.tfFinOpen(s)) return "";
    const marks = TF.FIN.marks; const pct = 0;
    return `<section class="panel tf-fin"><div class="pad tf-ev">${I(995003)}<div class="stack"><span class="tf-kick2">Manche IV · événement final · jours 50 à 56</span><h2 style="margin:0">Stabiliser le temps</h2>
      <div class="tf-gauge"><div style="width:${pct}%"></div>${marks.map(([p, r]) => `<i style="left:${p}%"></i><span style="left:${p}%">${p} %</span><em style="left:${p}%">${h(r.replace(/ «.*/, ""))}</em>`).join("")}</div>
      <span class="small">Chaque donjon fini, objet fabriqué ou ressource récoltée pendant l'événement fait monter la jauge du serveur. Les paliers donnent des cosmétiques à tous ceux qui ont contribué au moins un jour. <b>Aucun Éclat n'est créé ni dépensé.</b></span>
      <div class="tf-led"><span>Ta contribution</span><b>${E.tfFinDays(s)} jour${E.tfFinDays(s) > 1 ? "s" : ""}</b><span>Jauge du serveur</span><b>avec le serveur Monocompte</b></div></div></div></section>`;
  }
  function clock(s) {
    if (!testOk(s)) return "";
    const on = E.monoClockOn(s), k = s.mono.clk || {};
    return `<section class="panel tf-clock"><div class="phead"><h2>🧪 Horloge de test</h2><span class="small muted">partie de test seulement · la vraie saison garde 56, 14 et 7 jours</span></div><div class="pad stack">
      ${on ? `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="small">Vitesse</span>${TF.speeds.map((v) => `<button class="btn sm" data-act="tf-spd" data-v="${v}" aria-pressed="${(k.spd || 1) === v}">×${v}</button>`).join("")}
          <button class="btn sm" data-act="tf-pause">${k.pause ? "▶ Reprendre" : "⏸ Pause"}</button></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small">Avancer au jour</span>${[15, 29, 43, 50, 56, 57].map((d) => `<button class="btn sm" data-act="tf-day" data-v="${d}">${d === 57 ? "fin (57)" : d}</button>`).join("")}
          <label class="row small">jour <input type="number" min="1" max="57" data-act="tf-dayin" style="width:64px"></label></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small">Progression de défi</span><select data-act="tf-dsel">${TF.DEFIS.map((x) => `<option value="${x.id}">${h(x.n)}</option>`).join("")}</select>
          <input type="number" min="1" value="10" data-act="tf-dval" style="width:72px"><button class="btn sm" data-act="tf-dgive">Donner</button></div>
        <button class="btn sm" data-act="tf-clock" data-v="0">Couper l'horloge de test</button>`
      : `<span class="small">Fait avancer la date de saison plus vite pour parcourir les 56 jours (bêta, jour 3). Rien ne change hors de la partie de test.</span><button class="btn sm primary" data-act="tf-clock" data-v="1">Mettre l'horloge de test en route</button>`}
    </div></section>`;
  }

  /* ---------- Carnet des Fragments ---------- */
  function carnet(main) {
    const s = S(); if (!s || !s.mono || E.monoEternal(s)) return back();
    E.tfCheck(s);
    const cur = Math.min(4, E.monoManche(s)) - 1; const sel = UI().tfMan != null ? UI().tfMan : cur;
    const tabs = `<div class="tf-mt">${TF.MANCHES.map((m, i) => `<button data-act="tf-man" data-v="${i}" aria-pressed="${i === sel}" class="${i > cur ? "lock" : ""}"><b>${i > cur ? "🔒 " : ""}Manche ${m.n}</b><span>${h(m.nom)} · J${i * 14 + 1}</span></button>`).join("")}</div>`;
    main.innerHTML = `<div class="pagehead"><h1>Carnet des Fragments</h1></div>${banner(s)}${finale(s)}${tabs}
      <div class="tf-grid">${TF.DEFIS.filter((x) => x.m === sel).map((x) => card(s, x)).join("")}</div>
      <div class="tf-note">⏳ <span>Les défis d'une manche s'ouvrent à son premier jour et restent ouverts jusqu'au jour 56 : on peut tout rattraper, sans niveau ni objet offert. Chaque palier paie une fois ; les Éclats des défis ne comptent pas dans le quota d'activité.</span></div>
      ${today(s)}${ledger(s)}${clock(s)}`;
  }

  /* ---------- Boutique temporelle et Boutique d'Archives ---------- */
  function shopItem(s, x) {
    const own = E.tfOwned(s, x.id), bought = !!E.tfState(s).own[x.id], can = E.tfCanBuy(s) && !(x.lie ? own : bought) && E.tfBalance(s) >= x.p;
    const wear = x.lie && own && (x.id === "emb" || x.id === "aura") ? `<button class="btn sm" data-act="tf-wear" data-v="${x.id}">${E.tfWorn(s, x.id) ? "Retirer" : "Porter"}</button>` : x.lie && own ? `<span class="xs muted">à choisir dans Apparence</span>` : "";
    const col = !x.lie && E.tfState(s).col[x.id] ? `<span class="xs muted">${x.id === "cri" ? `n° ${E.tfState(s).criNo} (provisoire)` : "dans ta collection"}</span>` : "";
    return `<div class="tf-it ${(x.lie ? own : bought) ? "own" : ""}"><div class="vis">${I(x.ic)}</div><span class="tf-tag ${x.lie ? "lie" : "ech"}">${x.lie ? "Lié au compte" : "Échangeable"}</span>
      <h3>${h(x.n)}</h3><p>${h(x.d)}</p>${col}<div class="tf-buy"><span class="tf-price">${EC()}${fmt(x.p)}</span>${(x.lie ? own : bought) ? `<span class="tag good">Obtenu ✓</span>${wear}` : `<button class="btn sm ${can ? "primary" : ""}" data-act="tf-buy" data-v="${x.id}" ${can ? "" : "disabled"}>Acheter</button>`}</div></div>`;
  }
  function preview(s) {
    const c = s.chars.find((x) => !x.merc) || s.chars[0];
    return `<div class="tf-prev"><div class="tf-pcard">${c ? X().heroCard(c, "", { act: "noop" }) : ""}</div>
      <div class="stack"><span class="tf-chip" style="align-self:flex-start">${I(TF.icon)}${fmt(E.tfBalance(s))} Éclats du Temps</span>
      <b>Aperçu sur ton héros : ce que tu portes s'affiche ici</b>
      <span class="small muted">Rien ici ne donne de force en combat. Les cosmétiques sont liés à ton compte et te suivent dans les prochaines saisons. Les objets de collection s'échangent entre joueurs (avec le serveur Monocompte).</span>
      <span class="small">Toute la boutique : <b>${fmt(TF.SHOP_TOTAL)} Éclats</b></span></div></div>`;
  }
  function boutique(main) {
    const s = S(); if (!s || !s.mono || E.monoEternal(s)) return back();
    main.innerHTML = `<div class="pagehead"><h1>Boutique temporelle</h1></div>
      <section class="panel"><div class="pad">${preview(s)}</div></section>
      <div class="tf-shop" style="margin-top:12px">${TF.SHOP.map((x) => shopItem(s, x)).join("")}</div>
      <div class="tf-note">🛈 <span>Les récompenses de classement et les titres d'exploit ne s'achètent pas. Un Éclat dépensé ici disparaît pour de bon. Les Éclats qui te restent à la fin de la saison passent dans l'Éternel, pour la Boutique d'Archives.</span></div>`;
  }
  function archives(main) {
    const s = S(); if (!s || !E.monoEternal(s)) return back();
    const nom = E.monoSeasonDef(s.mono.eternel.s).nom;
    main.innerHTML = `<div class="pagehead"><h1>Boutique d'Archives</h1></div>
      <section class="panel"><div class="phead"><h2>${EC()} Archives · ${h(nom)}</h2><span class="tf-chip">${I(TF.icon)}${fmt(E.tfBalance(s))} Éclats du Temps · ${h(nom)}</span></div><div class="pad stack">
        <span class="small">Tes Éclats non dépensés t'ont suivi dans l'Éternel. Tu peux les dépenser ici ou les échanger entre héros de l'Éternel, à l'HdV de l'Éternel (séparé, avec le serveur). Ils ne reviennent jamais dans une nouvelle saison.</span>
        <div class="tf-shop">${TF.SHOP.map((x) => shopItem(s, x)).join("")}</div></div></section>`;
  }

  /* ---------- fiche des Éclats du Temps dans le sac ---------- */
  function resDetail(n) {
    const s = S(); const bal = E.isMono(s) ? E.tfBalance(s) : 0;
    return `<div class="panel invdetail"><div class="phead"><div class="row">${I(TF.icon, "ico lg")}<div><h2>${h(n)}</h2><div class="xs muted">${h(E.monoSeasonDef((s.mono && s.mono.s) || 1).nom)} · ${fmt(bal)} au registre</div></div></div><button class="btn sm" data-act="ressel" data-n="">✕</button></div>
      <div class="pad stack" style="gap:8px">
        <div class="vd-box"><div class="row between"><b>Échanges</b><span class="xs muted">solde tenu par le registre</span></div>
          <span class="small">Pas de vente directe ni de marchand pour les Éclats du Temps. Ils passent seulement de joueur à joueur : à l'HdV de saison ou par échange, avec le serveur Monocompte.</span>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" disabled>Vendre à l'HdV de saison</button><button class="btn sm" disabled>Proposer un échange</button></div></div>
        <h3 class="sec">D'où elle vient</h3><div class="list"><div class="empty">Défis du Carnet des Fragments (hors quota) ; activités en ligne, hors ligne et au Sablier (100 par semaine, cumulables jusqu'à 800) ; échanges entre joueurs.</div></div>
        <h3 class="sec">À quoi elle sert</h3><div class="list"><div class="empty">Boutique temporelle de la saison, puis Boutique d'Archives dans l'Éternel.</div></div>
        <button class="btn sm primary" data-act="tf-go" data-v="${E.monoEternal(s) ? "archives" : "fragments"}">${E.monoEternal(s) ? "Boutique d'Archives" : "Carnet des Fragments"}</button>
      </div></div>`;
  }

  window.DX.pages.fragments = carnet;
  window.DX.pages.boutique = boutique;
  window.DX.pages.archives = archives;
  window.TFUI = { resDetail };

  const redraw = () => { const m = document.getElementById("main"); const p = window.DX.pages[UI().tab]; if (m && p) p(m); };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^tf-/.test(a) || !S()) return;
    const s = S(); const done = (r) => { if (r) X().toast(r); X().markDirty(); redraw(); X().renderStatus && X().renderStatus(); };
    if (a === "tf-go") { UI().tab = t.dataset.v; X().render(); window.scrollTo(0, 0); return; }
    if (a === "tf-man") { UI().tfMan = +t.dataset.v; redraw(); return; }
    if (a === "tf-buy") { const r = E.tfBuy(s, t.dataset.v); if (r && r.then) { t.disabled = true; return r.then(done, () => done("Pas de connexion au serveur.")); } return done(r); } // partie en ligne : achat fait par le serveur
    if (a === "tf-wear") return done(E.tfWear(s, t.dataset.v, !E.tfWorn(s, t.dataset.v)));
    if (a === "tf-clock") { if (!testOk(s)) return; return done(E.monoTestClock(s, t.dataset.v === "1")); }
    if (a === "tf-spd") return done(E.monoClockSet(s, { spd: +t.dataset.v }));
    if (a === "tf-pause") return done(E.monoClockSet(s, { pause: !(s.mono.clk && s.mono.clk.pause) }));
    if (a === "tf-day") return done(E.monoClockSet(s, { day: +t.dataset.v }));
    if (a === "tf-dgive") { const sel = document.querySelector('[data-act="tf-dsel"]'), v = document.querySelector('[data-act="tf-dval"]'); return done(E.tfTestProgress(s, sel && sel.value, v && v.value)); }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target; if (!t || !t.dataset || t.dataset.act !== "tf-dayin" || !S()) return;
    const r = E.monoClockSet(S(), { day: +t.value }); if (r) X().toast(r); X().markDirty(); redraw();
  });
})();
