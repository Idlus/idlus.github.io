/* ============================================================================
   KOLIZÉUM — interface (0.1.44). La logique est dans js/koli.js, le combat dans le moteur.
   Page Jouer › Kolizéum : grade et cote, tickets, 3 adversaires (chance sur 20 combats d'essai),
   équipe d'arène, journal (combats à revoir), récompenses de la semaine, classement, boutique.
   Le combat se regarde sur l'écran de combat (koliWatchStart dans ui.js).
   En ligne (compte) : le serveur choisit les adversaires (vrais joueurs, Fantômes pour compléter) et joue le combat.
   Sans compte ou sur la version de test : contre des Fantômes, sur cet appareil.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const { CLASSES, CONSUMABLES } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const ON = () => window.ONLINE;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const K = E.KOLI;
  const ui = { opps: null, key: "", ch: {}, busy: false, loading: false, loaded: 0, me: null, fights: null, lb: null, srvErr: "", gen: 0 };

  /* ---------- petits rendus ---------- */
  const online = () => { const o = ON(); return !!(o && o.enabled && o.user && o.profile); };
  const emb = (g, cls = "") => `<img class="kz-emb ${cls}" src="assets/ui/koli/koli_${g.id}.svg" alt="${h(g.name)}" title="${h(g.name)}">`;
  const coin = (cls = "kz-coin") => `<img class="${cls}" src="assets/ui/koli/kolizeton.svg" alt="" loading="lazy">`;
  const tick = (cls = "kz-tk") => `<img class="${cls}" src="assets/ui/coffres/ticket_koli.svg" alt="" loading="lazy">`;
  const head = (x) => `<span class="head" style="--cc:${(CLASSES[x.cls] || {}).color || "#888"}" title="${h(`${(CLASSES[x.cls] || {}).name || x.cls} niv. ${x.lvl}`)}"><img src="${X().headImg(x)}" alt="">${x.lvl ? `<em>${x.lvl}</em>` : ""}</span>`;
  const heads = (L, dead) => `<div class="kz-heads">${(L || []).map((x, i) => `<span class="${dead && dead.includes(i) ? "kz-dead" : ""}">${head(x)}</span>`).join("")}</div>`;
  const nf = (n) => Math.round(n).toLocaleString("fr-FR");
  const left = () => { const s = Math.max(0, E.koliLeft() / 1000); const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600); return d ? `${d} j ${hh} h` : hh ? `${hh} h` : "moins d'une heure"; };
  const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? "à l'instant" : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : s < 172800 ? "hier" : `il y a ${Math.floor(s / 86400)} jours`; };
  const purse = (s) => K.purseK * E.koliLvl(s);

  /* ---------- adversaires ---------- */
  const oppKey = (s, Q) => `${online() ? "on" : "off"}:${E.defiDay()}:${Q.rf}:${Q.n}:${Q.win}:${Q.team.join(",")}:${E.koliLvl(s)}`;
  function ensureOpps(s, Q) {
    const k = oppKey(s, Q); if (ui.key === k && (ui.opps || ui.loading)) return;
    ui.key = k; ui.ch = {}; ui.opps = null; ui.srvErr = ""; const gen = ++ui.gen;
    if (!online()) { ui.opps = E.koliGhostOpps(s).map((o, i) => Object.assign(o, { slot: i, heads: o.team.map((x) => ({ cls: x.cls, sex: x.sex, head: x.head, lvl: x.lvl })) })); chances(s, Q, gen); return; }
    ui.loading = true;
    ON().koli({ opps: 1, r: Q.rf }).then((r) => {
      if (gen !== ui.gen) return; ui.loading = false;
      if (r && r.ok) { ui.opps = r.opps.map((o) => Object.assign(o, { team: o.team })); chances(s, Q, gen); }
      else { ui.srvErr = r && r.err ? r.err : "Pas de connexion au serveur : réessaie dans un moment."; ui.key = ""; }
      paint();
    });
  }
  /* chance : 20 combats d'essai par adversaire, un adversaire à la fois pour ne pas figer la page */
  function chances(s, Q, gen) {
    const A = E.koliSnap(s, Q.team); if (!A.length) return;
    const step = (i) => { if (gen !== ui.gen || !ui.opps || i >= ui.opps.length) { if (gen === ui.gen) paintOpps(); return; }
      ui.ch[i] = E.koliChance(A, ui.opps[i].team); paintOpps(); setTimeout(() => step(i + 1), 30); };
    setTimeout(() => step(0), 60);
  }
  const stakes = (Q, o) => (o.win !== undefined ? { win: o.win, lose: o.lose } : E.koliStakes(Q.cote, o.cote, o.ghost));
  /* conseillé : le meilleur gain attendu (chance × gain − (1 − chance) × perte) */
  const best = (Q) => { if (!ui.opps || Object.keys(ui.ch).length < ui.opps.length) return -1; let b = -1, bv = -1e9;
    ui.opps.forEach((o, i) => { const st = stakes(Q, o), c = ui.ch[i] / 100; const v = c * st.win - (1 - c) * st.lose; if (v > bv) { bv = v; b = i; } }); return b; };
  function oppHtml(s, Q, o, i, bi) {
    const g = E.koliGrade(o.cote); const st = stakes(Q, o); const ch = ui.ch[i];
    return `<div class="kz-opp ${i === bi ? "reco" : ""}"><div class="nm">${emb(g, "sm")}<span>${h(o.name)}</span></div>
      <span class="row xs muted" style="gap:6px;flex-wrap:wrap">Cote ${nf(o.cote)} · ${g.name}${o.ghost ? `<i class="kz-ghost" data-tip="Un Fantôme : une équipe créée par le jeu. Contre lui, la cote bouge deux fois moins.">Fantôme</i>` : ""}${i === bi ? `<span class="tag best">Conseillé</span>` : ""}</span>
      ${heads(o.heads)}
      <div class="kz-ch ${ch === undefined ? "" : ch >= 60 ? "hi" : ch >= 40 ? "mid" : "lo"}"><span>Chance</span><span class="pbar"><i style="width:${ch || 0}%"></i></span><span class="num">${ch === undefined ? "…" : ch + " %"}</span></div>
      <div class="kz-gain"><span class="p">Victoire +${st.win}</span><span class="m">Défaite −${st.lose}</span></div>
      <button class="btn primary sm" data-act="kz-fight" data-i="${i}" ${ui.busy || E.koliTickets(s) < 1 ? "disabled" : ""}>${tick("kz-tk sm")} Combattre</button></div>`;
  }
  function oppsInner(s, Q) {
    if (!E.koliArena(s).length) return `<div class="empty">Choisis d'abord ton équipe d'arène.</div>`;
    if (ui.srvErr) return `<div class="empty">${h(ui.srvErr)} <button class="btn sm" data-act="kz-retry">Réessayer</button></div>`;
    if (!ui.opps) return `<div class="empty">Recherche d'adversaires…</div>`;
    const bi = best(Q);
    return `<div class="kz-opps">${ui.opps.map((o, i) => oppHtml(s, Q, o, i, bi)).join("")}</div>`;
  }
  function paintOpps() { const el = $("#kzOpps"); const s = S(); if (!el || !s || window.DX.ui.tab !== "koli") return; el.innerHTML = oppsInner(s, E.koliState(s)); }

  /* ---------- en ligne : fiche, journal, classement ---------- */
  function loadOnline(force) {
    if (!online() || ui.loadingMe || (!force && Date.now() - ui.loaded < 60000)) return;
    ui.loadingMe = true; const w = E.koliWeek();
    Promise.all([ON().koliMe(w), ON().koliFights(), ON().koliLb(w)]).then(([me, fights, lb]) => {
      ui.loadingMe = false; ui.loaded = Date.now(); const s = S(); if (!s) return;
      if (me) { ui.me = me; const r = E.koliSync(s, me, me.weeks, fights || [], ON().user.id);
        r.weeks.filter((x) => x.got.length).forEach((x) => X().toast(`Kolizéum : semaine finie en ${E.KOLI_GRADES.find((g) => g.id === x.grade).name}. ${x.got.join(", ")}.`, "rare"));
        if (r.def) X().toast(`Kolizéum : ${r.def} défense${r.def > 1 ? "s" : ""} réussie${r.def > 1 ? "s" : ""} pendant ton absence, +${r.def * K.kzDef} Kolizeton${r.def * K.kzDef > 1 ? "s" : ""}.`, "rare");
        X().markDirty(); }
      if (fights) ui.fights = fights; if (lb) ui.lb = lb;
      if (window.DX.ui.tab === "koli") paint();
    }).catch(() => { ui.loadingMe = false; });
  }

  /* ---------- la page ---------- */
  function render(main) {
    const s = S(); const Q = E.koliState(s); const on = online();
    ensureOpps(s, Q); if (on) loadOnline();
    const g = E.koliGrade(Q.cote, Q.top); const nx = E.koliNext(Q.cote); const tk = E.koliTickets(s);
    const prevMin = g.min === Infinity ? 1700 : g.min; const prog = nx ? Math.max(0, Math.min(100, ((Q.cote - prevMin) / (nx.min - prevMin)) * 100)) : 100;
    const rank = on && ui.me && ui.me.rank ? `${ui.me.rank}<sup>e</sup> sur ${ui.me.players} joueur${ui.me.players > 1 ? "s" : ""}` : on ? "pas encore classé cette semaine" : "hors ligne, contre des Fantômes";
    main.innerHTML = `<div class="kz-top"><div><h1>Kolizéum</h1><span class="small muted">3 contre 3 · nouvelle semaine dans ${left()} (lundi à minuit)</span></div>
      <div class="row"><button class="btn sm" data-act="kz-shop">${coin("kz-coin sm")} Boutique</button><button class="btn sm" data-act="kz-rules">${X().IC("parchemin_or")} Règles</button></div></div>
    ${on ? "" : `<div class="kz-off">${X().IC("logo")} <span><b>Sans compte, tu t'entraînes contre des Fantômes</b> (des équipes créées par le jeu). ${ON() && ON().enabled ? "Avec un compte gratuit, tu affrontes les équipes des autres joueurs et tu entres au classement." : "Sur la version de test, tous les adversaires sont des Fantômes."}</span></div>`}
    <section class="panel"><div class="kz-band">${emb(g, "big")}
      <div class="kz-cote"><span class="big">${nf(Q.cote)}<small>de cote</small></span><span class="small"><b>${g.name}</b> · ${rank}${nx ? ` · <b>${nx.name} à ${nf(nx.min)}</b>` : ""}</span><div class="kz-prog g-${g.id}"><i style="width:${prog}%"></i></div>
        <span class="xs muted">Cette semaine : ${Q.n} combat${Q.n > 1 ? "s" : ""} classé${Q.n > 1 ? "s" : ""}${Q.n < K.minWeek ? ` (${K.minWeek} pour la récompense)` : ""} · meilleure cote ${nf(Q.best || Q.cote)}</span></div>
      <div class="kz-left"><span class="kz-tkn" data-tip="${h(CONSUMABLES[E.KOLI_TICKET].desc)}">${tick()}<b class="num">${tk}</b><span class="xs">ticket${tk > 1 ? "s" : ""} de Koli</span></span>
        <span class="xs muted">${K.daily} offerts chaque jour à minuit (${K.tkMax} en réserve au plus)</span>
        <span class="kz-tkn sm" data-tip="Kolizetons : la monnaie du Kolizéum (3 par victoire, 1 par défaite, 1 par défense réussie, plus la récompense de la semaine).">${coin()}<b class="num">${fmt(E.koliKz(s))}</b><span class="xs">Kolizetons</span></span>
        <span class="xs">${X().IC("kamas")} bourse de victoire : <b>${fmt(purse(s))} kamas</b> + ${K.dust} Poussière de stasis</span></div></div></section>
    <div class="kz-grid"><div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h2 style="margin:0">${X().IC("combat")} Choisis ton adversaire</h2><button class="btn sm" data-act="kz-refresh" ${ui.busy ? "disabled" : ""}>Autres adversaires · ${Q.rf < K.freeRefresh ? "gratuit" : `1 ticket`}</button></div>
        <div id="kzOpps">${oppsInner(s, Q)}</div>
        <p class="note" style="padding:0 14px 12px">La chance est calculée sur ${K.chance} combats d'essai. Le vrai combat a son propre hasard${on ? " : c'est le serveur qui le joue" : ""}. Un combat classé coûte un ticket.</p></section>
      <section class="panel"><div class="phead"><h2 style="margin:0">${X().IC("couronne")} Ton équipe d'arène</h2><div class="row"><button class="btn sm" data-act="kz-train" ${E.koliArena(s).length ? "" : "disabled"}>S'entraîner</button><button class="btn sm" data-act="kz-team">Modifier</button></div></div>
        <div class="kz-def"><div class="kz-team">${E.koliArena(s).map(hcard).join("") || `<span class="muted small">Aucun héros.</span>`}</div><div class="grow stack" style="gap:6px;min-width:200px"><span class="small"><b>Elle attaque et elle défend.</b> ${on ? "Quand un joueur t'attaque, c'est elle qui se bat, jouée par l'IA, même si tu n'es pas là." : "En ligne, c'est aussi elle qui défend quand un joueur t'attaque."}</span><span class="xs muted">Les autres voient ses classes et ses niveaux. Elle est mise à jour à chaque combat classé. S'entraîner ne coûte rien et ne rapporte rien.</span></div></div></section>
    </div><div class="stack" style="gap:14px">
      ${journal(s, Q, on)}
      ${rewards(Q, g)}
      ${on ? board() : ""}
    </div></div>`;
  }
  const hcard = (c) => `<div class="kz-h" style="--cc:${CLASSES[c.cls].color}">${X().lookImg(c, "l")}<span class="lv">${c.lvl}</span><span class="rw">${h(c.name)}</span></div>`;
  /* boutique en rayons (0.1.45) : Galets, combats, coffres, apparence ; ×1 / ×5 / ×10 pour ce qui se cumule */
  const SECS = [["galets", "Galets", "Demandés par les recettes d'équipement, comme dans DOFUS. Tu peux aussi les vendre ou les acheter à l'Hôtel de vente."],
    ["combat", "Combats et douceurs", ""], ["coffres", "Coffres", ""], ["look", "Apparence", "Pour la carte de tes héros. Rien ici ne rend tes héros plus forts."]];
  function shopRow(s, it, have) {
    const Sh = E.SHOPS.koli; const owned = E.shopOwned(s, it); const C = it.cons ? CONSUMABLES[it.cons] : null;
    const R = it.res ? D.RES[it.res] : null; const U = it.res && E.KOLI_GALET_USE ? E.KOLI_GALET_USE[it.res] : null;
    const ico = it.res ? X().im(X().resImg(it.res), "ico", it.res) : C ? X().consIco(C) : it.orn ? X().G("frame") : X().G("tag");
    const sub = U ? `niv. ${R.lvl} · ${U.n} objets à fabriquer (niv. ${U.lo} à ${U.hi})` : it.res ? `Ressource niv. ${R ? R.lvl : "?"}` : C ? h(C.desc) : it.orn ? "Ornement de carte de héros" : "Titre affiché sur la carte";
    const stock = it.res ? (s.res[it.res] || 0) : C ? (s.cons[it.cons] || 0) : 0;
    const btn = (n) => `<button class="btn sm ${have >= it.cost * n ? "primary" : ""}" data-act="buyshop" data-shop="koli" data-id="${it.id}" data-n="${n}" ${have < it.cost * n ? "disabled" : ""}>${n > 1 ? `×${n} · ` : ""}${coin("kz-coin sm")} ${it.cost * n}</button>`;
    const name = it.res ? `<button class="kz-lnk" data-act="kz-res" data-n="${h(it.res)}" title="Fiche de la ressource">${h(E.shopItemName(s, it))}</button>` : h(E.shopItemName(s, it));
    return `<div class="kz-si"><span class="em">${ico}</span><div class="grow" style="min-width:0"><b>${name}</b><div class="xs muted">${sub}${stock ? ` · <b>${nf(stock)}</b> en stock` : ""}</div></div>
      <div class="kz-buy">${owned ? `<button class="btn sm" disabled>Obtenu</button>` : it.many ? [1, 5, 10].map(btn).join("") : btn(1)}</div></div>`;
  }
  function shop() {
    const s = S(); const Sh = E.SHOPS.koli; const have = s.tokens[Sh.cur] || 0;
    return `<section class="panel kz-shop"><div class="phead"><h2 style="margin:0">${coin()} ${h(Sh.name)}</h2><span class="small"><b class="num">${nf(have)}</b> Kolizetons</span></div>
      ${SECS.map(([k, t, n]) => { const L = Sh.items.filter((it) => (it.sec || "combat") === k); if (!L.length) return "";
        return `<div class="kz-sec"><h3>${t}</h3>${n ? `<p class="xs muted">${n}</p>` : ""}${L.map((it) => shopRow(s, it, have)).join("")}</div>`; }).join("")}</section>`;
  }
  const shopSheet = () => X().openSheet(`${shop()}<p class="note" style="margin-top:8px">Les Kolizetons se gagnent au Kolizéum : ${K.kzWin} par victoire, ${K.kzLoss} par défaite, ${K.kzDef} par défense réussie, plus la récompense de la semaine.</p><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" data-act="closesheet">Fermer</button></div>`);
  function journal(s, Q, on) {
    let rows = [];
    if (on && ui.fights) {
      const me = ON().user.id;
      rows = ui.fights.map((f) => { const att = f.att === me; const won = att ? f.win : !f.win; const d = att ? f.d_att : f.d_def;
        return { won, t: new Date(f.at).getTime(), txt: att ? (f.win ? `Tu as battu ${f.def_name}` : `Tu as perdu contre ${f.def_name}`) : `${f.att_name} t'a attaqué`,
          res: att ? `${f.win ? "Victoire" : "Défaite"} ${d >= 0 ? "+" : "−"}${Math.abs(d)}` : `${won ? "Défense réussie" : "Défense perdue"} ${d >= 0 ? "+" : "−"}${Math.abs(d)}`, act: `data-act="kz-replay" data-id="${f.id}"`, def: !att }; });
    } else rows = (Q.log || []).map((l, i) => ({ won: l.win, t: l.t, txt: l.win ? `Tu as battu ${l.name}` : `Tu as perdu contre ${l.name}`, res: `${l.win ? "Victoire" : "Défaite"} ${l.d >= 0 ? "+" : "−"}${Math.abs(l.d)}`, act: l.A ? `data-act="kz-replay" data-i="${i}"` : "" }));
    const defs = rows.filter((r) => r.def); const dw = defs.filter((r) => r.won).length;
    return `<section class="panel kz-log"><div class="phead"><h2 style="margin:0">${X().IC("quetes")} Journal</h2>${defs.length ? `<span class="xs muted">${dw} défense${dw > 1 ? "s" : ""} sur ${defs.length} réussie${dw > 1 ? "s" : ""}</span>` : ""}</div>
      ${rows.length ? rows.slice(0, 12).map((r) => `<div class="li"><span class="grow small">${h(r.txt)}<br><span class="xs muted">${ago(r.t)}</span></span><span class="res ${r.won ? "w" : "l"}">${h(r.res)}</span>${r.act ? `<button class="btn sm" ${r.act}>Revoir</button>` : ""}</div>`).join("") : `<div class="empty">Aucun combat pour l'instant.</div>`}</section>`;
  }
  function rewards(Q, g) {
    const me = g.id;
    return `<section class="panel kz-rw"><div class="phead"><h2 style="margin:0">${X().IC("coffre")} Fin de la semaine</h2><span class="xs muted">dans ${left()}</span></div>
      ${E.KOLI_GRADES.map((x, i) => { const nx = E.KOLI_GRADES[i + 1]; const range = x.top ? `les ${x.top} premiers (${K.minWeek} combats au moins)` : nx && !nx.top ? `${nf(x.min)} à ${nf(nx.min - 1)}` : `${nf(x.min)} et plus`;
        const gift = [`${x.kz} Kolizetons`, CONSUMABLES[x.cons].name, x.title ? `titre « ${x.title} »` : "", x.orn ? "ornement « Lauriers du Kolizéum »" : ""].filter(Boolean).join(" · ");
        return `<div class="li ${x.id === me ? "me" : ""}">${emb(x, "sm")}<span class="grow small"><b>${x.name}</b> <span class="xs muted">${range}</span><br><span class="xs">${h(gift)}</span></span></div>`; }).join("")}
      <p class="note" style="padding:8px 14px 12px">Il faut ${K.minWeek} combats classés dans la semaine. Les titres et l'ornement des grades plus bas sont donnés aussi. À la nouvelle semaine, chaque cote revient à mi-chemin de 1 000.${Q.last ? ` Semaine dernière : ${E.KOLI_GRADES.find((x) => x.id === Q.last.grade).name} (cote ${nf(Q.last.cote)}, ${Q.last.n} combats).` : ""}</p></section>`;
  }
  function board() {
    const me = ON().user.id; const L = ui.lb;
    return `<section class="panel kz-lb"><div class="phead"><h2 style="margin:0">${X().IC("trophee")} Classement de la semaine</h2></div>
      ${!L ? `<div class="empty">Chargement…</div>` : !L.length ? `<div class="empty">Personne n'a encore combattu cette semaine. À toi d'ouvrir le bal !</div>` : L.map((r) => `<div class="li ${r.user_id === me ? "me" : ""}"><span class="rk">${r.r}</span>${emb(E.koliGrade(r.cote, r.r <= 3 && r.n >= K.minWeek), "sm")}<span class="grow small"><b>${h(r.pseudo)}</b> <span class="xs muted">${r.n} combat${r.n > 1 ? "s" : ""}</span></span>${heads(r.heads)}<span class="num small">${nf(r.cote)}</span></div>`).join("")}</section>`;
  }
  function paint() { const s = S(); if (!s || window.DX.ui.tab !== "koli") return; const m = $("#main"); if (m) render(m); }

  /* ---------- fiches ---------- */
  function teamSheet() {
    const s = S(); const Q = E.koliState(s);
    const L = s.chars.slice().sort((a, b) => b.lvl - a.lvl);
    X().openSheet(`<h2>Équipe d'arène</h2><p class="small muted">Choisis ${K.size} héros. Elle attaque quand tu lances un combat et elle défend quand on t'attaque. Les niveaux comptent vraiment : pas de mise à niveau.</p>
      <div class="kz-pick">${L.map((c) => { const on = Q.team.includes(c.id); return `<button class="kz-pk ${on ? "on" : ""}" data-act="kz-tg" data-id="${c.id}" aria-pressed="${on}">${head({ cls: c.cls, sex: c.sex, head: c.head, lvl: c.lvl })}<span class="grow"><b>${h(c.name)}</b><br><span class="xs muted">${CLASSES[c.cls].name} niv. ${c.lvl}</span></span>${on ? `<span class="tag good">${Q.team.indexOf(c.id) + 1}</span>` : ""}</button>`; }).join("")}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="closesheet">Terminé</button></div>`);
  }
  function rulesSheet() {
    X().openSheet(`<h2>Règles du Kolizéum</h2><ol class="kz-rules">
      <li>Ton équipe d'arène (${K.size} héros) affronte celle d'un autre joueur, jouée par l'IA. Les vrais niveaux comptent.</li>
      <li>Un combat classé coûte un <b>ticket de Koli</b>. ${K.daily} tickets sont offerts chaque jour à minuit, jusqu'à ${K.tkMax} en réserve. On en trouve aussi dans la boutique.</li>
      <li>La <b>cote</b> monte quand tu gagnes et baisse quand tu perds, plus ou moins selon la cote de l'adversaire. Contre un Fantôme, elle bouge deux fois moins.</li>
      <li>Quand on t'attaque et que tu perds, tu perds la moitié de ce que l'autre gagne. Une défense réussie rapporte un peu de cote et 1 Kolizeton.</li>
      <li>Dès le tour ${K.ero}, l'<b>érosion</b> réduit les PV maximum et les soins de ${K.eroStep} % par tour. Au tour ${K.maxRound}, l'équipe qui a le plus de PV (en %) gagne.</li>
      <li>Chaque victoire rapporte une bourse de kamas (selon le niveau de l'équipe), ${K.dust} Poussière de stasis et ${K.kzWin} Kolizetons ; une défaite, ${K.kzLoss} Kolizeton.</li>
      <li>La semaine finit le lundi à minuit. Avec ${K.minWeek} combats classés au moins, ton grade donne sa récompense, puis la cote revient à mi-chemin de 1 000.</li>
      <li>Grades : Bronze, Argent (1 100), Or (1 300), Cristal (1 500), Diamant (1 700) et Légende pour les ${E.KOLI_GRADES[5].top} premiers. Or et plus sont annoncés dans les Hauts faits.</li>
      <li>Les Kolizetons s'échangent dans la boutique contre des <b>Galets</b> (demandés par ${E.KOLI_GALET_ITEMS || "des"} recettes d'équipement, comme dans DOFUS), des tickets, des coffres et de l'apparence.</li></ol>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="closesheet">Compris</button></div>`);
  }

  /* ---------- regarder un combat (écran de combat) ---------- */
  function watch(A, B, seed, info) {
    const s = S(); const me = info.me || 0;
    // tes vrais héros (et leur apparence) quand l'équipe qui attaque est bien la tienne d'aujourd'hui
    let ids = me === 0 && info.own ? E.koliState(s).team.filter((id) => s.chars.some((c) => c.id === id)) : null;
    if (ids && (ids.length !== A.length || ids.some((id, i) => s.chars.find((c) => c.id === id).cls !== A[i].cls))) ids = null;
    const W = E.koliWatch(A, B, seed, { ids, me });
    X().koliWatchStart(W, Object.assign({ A, B, seed }, info));
  }
  function watchHtml(w) {
    const I = w.koli; const sp = w.spd || 1;
    const title = I.train ? `Entraînement contre ${h(I.opp.name)}` : I.me === 1 ? `${h(I.opp.name)} t'attaque` : `Contre ${h(I.opp.name)}`;
    return `<div class="pagehead combathead"><div><div class="small muted">${X().IC("combat")} Kolizéum · 3 contre 3 <span id="wroom"></span></div><h1>${title}</h1></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="seg" data-tip="Vitesse de lecture">${[1, 2, 4].map((v) => `<button data-act="sm-wspd" data-v="${v}" aria-pressed="${sp === v}">×${v}</button>`).join("")}</span><button class="btn sm" data-act="sm-wskip">Passer</button><button class="btn sm" data-act="sm-wquit">Quitter</button></div></div>
    <section class="panel combatpanel watchpanel kzw">
      <div class="kz-vsbar"><span class="side">${heads(I.me === 1 ? I.B : I.A)}<b class="small">${I.me === 1 ? "Ta défense" : "Ton équipe"}</b></span><span class="vs">VS</span><span class="side r"><b class="small">${h(I.opp.name)}</b>${heads(I.me === 1 ? I.A : I.B)}</span></div>
      <div class="arenasticky">
        <div class="cstrip"><div class="chalov" id="chalov"></div><span class="cstreak" id="cstreak"></span><span class="ctour" id="ctour"></span></div>
        <div class="arenawrap"><div class="arena" id="arena"></div></div>
        <div class="ftick" id="turn"></div>
      </div>
      <div class="chalbar" id="chalbar"></div><div id="await"></div>
      <div class="pad" id="watchEnd"></div>
      <div class="log" id="flog"></div>
      <div hidden><span id="fres"></span><div id="floot"></div></div>
    </section>`;
  }
  function watchHead(w) { const el = $("#wroom"); const F = w.W.S2.fight; if (el) el.textContent = F.ero ? `· érosion ${F.ero} %` : F.round >= K.ero - 2 && !F.over ? `· érosion au tour ${K.ero}` : ""; }
  function watchEnd(w) {
    const I = w.koli; const R = E.koliResult(w.W); const won = I.me === 1 ? !R.win : R.win;
    const s = S(); const tk = E.koliTickets(s);
    const reason = R.rounds >= K.maxRound && R.hpA > 0 && R.hpB > 0 ? `au tour ${K.maxRound}, ${won ? "ton équipe" : "l'autre équipe"} avait le plus de PV` : `en ${R.rounds} tour${R.rounds > 1 ? "s" : ""}`;
    if (I.train) return `<div class="kz-res"><b>${won ? "Victoire à l'entraînement" : "Défaite à l'entraînement"}</b> <span class="small muted">${reason}. Rien n'est compté.</span>
      <div class="row"><button class="btn sm" data-act="kz-rewatch">Revoir</button><button class="btn sm primary" data-act="sm-wquit">Retour au Kolizéum</button></div></div>`;
    const r = I.res; const d = r ? r.delta : I.d;
    return `<div class="kz-res"><div class="kz-big ${won ? "" : "lose"}">${won ? "Victoire !" : "Défaite"} <span>${d >= 0 ? "+" : "−"}${Math.abs(d)}</span></div>
      <span class="small" style="text-align:center">${I.me === 1 ? "Défense" : "Combat"} ${reason}.${r ? ` Cote <b>${nf(r.cote - r.delta)} → ${nf(r.cote)}</b> · ${r.grade.name}` : ""}</span>
      ${r ? `<div class="chk">${r.kamas ? `<div><span class="okc">${X().IC("kamas")}</span><span>Bourse de victoire : <b>${fmt(r.kamas)} kamas</b> et <b>${r.dust} Poussière de stasis</b></span></div>` : ""}<div><span class="okc">${coin("kz-coin sm")}</span><span><b>+${r.kz} Kolizeton${r.kz > 1 ? "s" : ""}</b></span></div>${online() && I.srv ? `<div><span class="okc">✓</span><span>Combat joué par le serveur : résultat vérifié</span></div>` : ""}</div>` : ""}
      <div class="row" style="justify-content:center">${r ? `<button class="btn primary" data-act="kz-next" ${tk < 1 ? "disabled" : ""}>Combat suivant · ${tk} ticket${tk > 1 ? "s" : ""}</button>` : ""}<button class="btn" data-act="kz-rewatch">Revoir</button><button class="btn" data-act="sm-wquit">Retour</button></div></div>`;
  }

  /* ---------- actions ---------- */
  async function fight(i) {
    const s = S(); const Q = E.koliState(s); const o = ui.opps && ui.opps[i]; if (!o || ui.busy) return;
    if (E.koliTickets(s) < 1) { X().toast(`Plus de ticket de Koli : il en arrive ${K.daily} chaque jour à minuit.`); return; }
    if (!online()) {
      const r = E.act(s, "koliFight", o.slot); if (typeof r === "string") { X().toast(r); return; }
      X().markDirty(); ui.key = ""; watch(r.A, r.opp.team, r.seed, { res: r, opp: r.opp, own: true }); return;
    }
    ui.busy = true; paintOpps();
    try { await X().onPush(); } catch (e) { /* le serveur rejoue avec la partie en ligne */ }
    const R = await ON().koli({ fight: o.id ? { id: o.id } : { slot: o.slot }, r: Q.rf });
    ui.busy = false;
    if (R.net) { X().toast("Pas de connexion au serveur : réessaie dans un moment."); paintOpps(); return; }
    if (!R.ok) { X().toast(R.err || "Refusé par le serveur."); ui.key = ""; paint(); return; }
    const r = E.koliOnline(s, R); X().markDirty(); ui.key = ""; ui.loaded = 0;
    if (ui.me) { ui.me.rank = R.rank; ui.me.cote = R.cote; ui.me.n = (ui.me.n || 0) + 1; }
    watch(R.A, R.B, R.seed, { res: r, opp: R.opp, own: true, srv: true });
  }
  function replay(t) {
    const s = S(); const d = t.dataset;
    if (d.id) { const f = (ui.fights || []).find((x) => String(x.id) === d.id); if (!f) return; const me = f.att === ON().user.id ? 0 : 1;
      watch(f.att_team, f.def_team, f.seed >>> 0, { me, opp: { name: me === 0 ? f.def_name : f.att_name }, d: me === 0 ? f.d_att : f.d_def, own: me === 0 }); return; }
    const l = (E.koliState(s).log || [])[+d.i]; if (!l || !l.A) return;
    watch(l.A, E.koliGhost(l.gs, l.gl, l.gz || K.size), l.seed, { opp: { name: l.name }, d: l.d });
  }
  function act(a, t) {
    const s = S(); const d = t.dataset;
    switch (a) {
      case "kz-fight": fight(+d.i); return;
      case "kz-next": { X().watchStop(); window.DX.ui.tab = "koli"; X().render(); window.scrollTo(0, 0); return; }
      case "kz-refresh": { const r = E.act(s, "koliRefresh"); if (r) { X().toast(r); return; } X().markDirty(); ui.key = ""; X().render(); return; }
      case "kz-retry": ui.key = ""; X().render(); return;
      case "kz-team": teamSheet(); return;
      case "kz-tg": { const r = E.act(s, "koliToggle", +d.id); if (r) { X().toast(r); return; } X().markDirty(); teamSheet(); ui.key = ""; return; }
      case "kz-rules": rulesSheet(); return;
      case "kz-shop": shopSheet(); return;
      case "kz-res": X().resSheet(d.n); return;
      case "kz-train": { const Q = E.koliState(s); const A = E.koliSnap(s, Q.team); if (!A.length) return;
        const seed = (Date.now() >>> 0) || 1; const o = E.koliGhostOpp(seed, 0, Q.cote, E.koliLvl(s), A.length);
        watch(A, o.team, seed ^ 0x5bd1e995, { train: true, opp: o, own: true }); return; }
      case "kz-replay": replay(t); return;
      case "kz-rewatch": { const w = window.DX.ui.watch; if (!w || !w.koli) return; const I = w.koli; watch(I.A, I.B, I.seed, I); return; }
    }
  }
  /* la page se rafraîchit seule (tickets à minuit, défenses en ligne) */
  setInterval(() => { try { if (window.DX && window.DX.ui && window.DX.ui.tab === "koli" && !$("#sheet").innerHTML && online()) loadOnline(); } catch (e) { /* jamais bloquer */ } }, 30000);
  // fiche de l'équipe ouverte : la rafraîchir quand l'équipe change est fait par kz-tg ; en la fermant, la page suit
  document.addEventListener("click", (ev) => { const t = ev.target.closest && ev.target.closest('[data-act="closesheet"]'); if (t && window.DX && window.DX.ui.tab === "koli") setTimeout(paint, 0); });

  // achat dans la boutique (fiche) : la fiche suit le nouveau solde
  document.addEventListener("click", (ev) => { const t = ev.target.closest && ev.target.closest('#sheet [data-act="buyshop"][data-shop="koli"]'); if (t) setTimeout(shopSheet, 0); });
  window.KOLIUI = { render, act, watchHtml, watchHead, watchEnd, ui };
})();
