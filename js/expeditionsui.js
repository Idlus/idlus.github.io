/* ============================================================================
   1.0.30 « Place à l'optimisation » : écrans de l'idle (règles dans js/expeditions.js).
   - Havre-Sac › Expéditions (ui.home = "expe") : missions en cours, une carte par héros hors de l'équipe avec la mission
     conseillée (Envoyer / Changer), le tableau du jour, les places (Salle des cartes) et les derniers retours.
     Tuile « Expéditions » dans « Aujourd'hui » de l'accueil.
   - Aventure › Donjons : encadré « Donjon pendant ton absence » (heures en banque, donjon et stasis, interrupteur, estimation,
     dernière absence).
   - Fenêtre « Pendant votre absence » : compte rendu du donjon et retours d'expédition.
   Actions « ex-… » (une ligne dans le clic de js/ui.js) ; listes de choix : écouteur « change » ici.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE; const D = window.DATA;
  if (!E || !E.dgh || !E.mis) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(Math.round(n || 0));
  const IC = (n, c) => X().IC(n, c);
  const hrs = (s) => E.hrsTxt(s);
  const pl = (n, a, b) => (n > 1 ? b || a + "s" : a);
  const kfmt = (n) => { n = Math.round(n || 0); return n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace(".", ",") + " M" : fmt(n >= 1e4 ? Math.round(n / 1000) * 1000 : n); };
  const st = { pick: {}, conf: null, confT: 0 };

  /* ---------- expéditions ---------- */
  const xpTxt = (c, xp) => { if (!xp || c.lvl >= E.MAX_LVL) return ""; const f = xp / E.heroXpNeed(c); return f >= 0.01 ? `≈ ${String(Math.round(f * 100) / 100).replace(".", ",")} niveau` : `${kfmt(xp)} XP`; };
  const rewardTxt = (c, m, R) => {
    const T = E.MIS_TYPES[m.t]; const parts = [`≈ ${kfmt(R.kamas)} k`, `${fmt(R.res)} ressources de la zone`];
    if (R.keys) parts.push(`${R.keys} ${pl(R.keys, "clé")}`);
    const x = c ? xpTxt(c, R.xp) : ""; if (x) parts.push(x);
    return `${parts.join(", ")}${T.item >= 1 ? `<br><b class="xs">un objet de la zone garanti si réussie</b>` : `<br><span class="xs muted">chance d'équipement (${Math.round(T.item * 100)} %)</span>`}`;
  };
  const reqHtml = (info) => `<div class="exm-req">${info.req.map((r) => `<span class="exm-q ${r.sc >= 0.999 ? "ok" : r.sc >= 0.5 ? "mid" : "no"}" title="${h(r.q.k === "st" ? `${r.txt} demandés, ${fmt(r.have)} pour ce héros` : r.txt)}">${r.sc >= 0.999 ? "✓" : r.sc >= 0.5 ? "≈" : "✗"} ${h(r.txt)}${r.q.k === "st" && r.sc < 0.999 ? ` <span class="exm-have">(${fmt(r.have)})</span>` : ""}</span>`).join("")}</div>`;
  const chanceBar = (p) => `<div class="gbar exm-bar"><i style="width:${Math.round(p * 100)}%"></i><b>${Math.round(p * 100)} % de réussite</b></div>`;
  const jobTag = (s, c) => (c.job ? `<span class="tag soft">récolte</span>` : s.training === c.id ? `<span class="tag soft">entraînement</span>` : E.atelierHero && E.atelierHero(s) === c ? `<span class="tag soft">atelier</span>` : "");
  /* une mission conseillée par héros (meilleur gain attendu par heure), sans doublon ; « Changer » passe à la suivante */
  function plan(s) {
    const board = E.misBoard(s); const heroes = E.misHeroes(s).sort((a, b) => b.lvl - a.lvl || a.id - b.id);
    const used = new Set(); const stc = new Map(heroes.map((c) => [c.id, E.charStats(s, c)]));
    const cards = heroes.map((c) => {
      const cs = stc.get(c.id);
      const list = board.filter((m) => m.taken == null).map((m) => { const i = E.misInfo(s, c, m, cs); const R = E.misReward(s, c, m, cs); return { m, i, R, sc: (i.p + (1 - i.p) * E.MIS.fail) * R.kamas / R.h }; })
        .filter((x) => x.i.ok).sort((a, b) => b.sc - a.sc || b.m.lvl - a.m.lvl);
      const cand = list.filter((x) => !used.has(x.m.id)); const pool = cand.length ? cand : list;
      const ch = pool.length ? pool[(st.pick[c.id] || 0) % pool.length] : null; if (ch) used.add(ch.m.id);
      return { c, ch, n: pool.length };
    });
    const best = {}; board.filter((m) => m.taken == null).forEach((m) => { let b = null; heroes.forEach((c) => { const i = E.misInfo(s, c, m, stc.get(c.id)); if (i.ok && (!b || i.p > b.p)) b = { c, p: i.p }; }); best[m.id] = b; });
    return { cards, best, board };
  }
  function runsHtml(s) {
    const M = E.mis(s); if (!M.runs.length) return "";
    const now = E.now();
    return `<section class="panel"><div class="phead"><h2>${IC("carte")} En cours</h2><span class="xs muted">${M.runs.length} / ${E.misSlots(s)}</span></div><div class="list">${M.runs.map((r) => {
      const c = s.chars.find((x) => x.id === r.cid); if (!c) return ""; const T = E.MIS_TYPES[r.m.t]; const p = Math.min(100, Math.max(0, Math.round((now - r.t0) / Math.max(1, r.t1 - r.t0) * 100)));
      const conf = st.conf === c.id && Date.now() - st.confT < 5000;
      return `<div class="li exm-run">${X().cmed(c.cls, c.lvl, c.ren)}<span class="grow"><b>${h(c.name)}</b> <span class="xs muted">niv. ${c.lvl}</span> · <span class="small">${h(E.misTitle(r.m))}</span><br><span class="xs muted">mission niv. ${r.m.lvl} · ${T.h} h · ${Math.round(r.p0 * 100)} % de réussite</span><span class="exm-prog"><i style="width:${p}%"></i></span></span><span class="exm-left xs"><b class="num" data-exleft="${r.t1}">${hrs((r.t1 - now) / 1000)}</b><span class="muted">avant le retour</span></span><button class="btn sm ${conf ? "bad" : ""}" data-act="ex-recall" data-id="${c.id}" data-tip="Le héros rentre tout de suite, sans rien rapporter">${conf ? "Sûr ? Rien n'est rapporté" : "Rappeler"}</button></div>`;
    }).join("")}</div></section>`;
  }
  function cardsHtml(s, P) {
    const full = E.mis(s).runs.length >= E.misSlots(s);
    if (!P.cards.length) {
      const n = s.chars.length; const away = E.mis(s).runs.length;
      return `<section class="panel"><div class="pad small">${away ? "Tous tes héros hors de l'équipe sont déjà en mission." : n < 2 ? "Recrute un deuxième héros : les héros hors de l'équipe partent en mission." : "Tous tes héros sont dans l'équipe. Sors-en un de l'équipe, ou recrute-en un de plus, pour l'envoyer en mission."}
        ${away ? "" : `<div class="row" style="margin-top:8px"><button class="btn sm" data-tab="team">Équipe et héros</button></div>`}</div></section>`;
    }
    return `<div class="exm-cards">${P.cards.map(({ c, ch, n }) => {
      const head = `<h3>${X().cmed(c.cls, c.lvl, c.ren)} <span class="exm-n">${h(c.name)}</span> <span class="xs muted">niv. ${c.lvl} · ${h(D.CLASSES[c.cls].name)} · ${E.MIS_EL[E.heroEl(s, c)]}</span>${jobTag(s, c)}</h3>`;
      if (!ch) return `<div class="exm-card">${head}<span class="small muted">Aucune mission à sa portée aujourd'hui : elles demandent un niveau plus haut. Nouvelles missions à minuit.</span></div>`;
      const T = E.MIS_TYPES[ch.m.t];
      return `<div class="exm-card">${head}<b class="small">${IC(T.ic)} ${h(E.misTitle(ch.m))}</b><span class="xs muted">durée ${T.h} h · mission niv. ${ch.m.lvl}</span>
        ${reqHtml(ch.i)}${chanceBar(ch.i.p)}<span class="small">${rewardTxt(c, ch.m, ch.R)}</span>
        <div class="row" style="flex-wrap:wrap"><button class="btn sm primary" data-act="ex-send" data-id="${c.id}" data-m="${ch.m.id}" ${full ? `disabled title="Toutes les places sont prises"` : ""}>Envoyer</button><button class="btn sm" data-act="ex-next" data-id="${c.id}" ${n > 1 ? "" : "disabled"}>Changer${n > 1 ? ` (${n})` : ""}</button><button class="btn sm ghost" data-act="teamgo" data-v="equip" data-id="${c.id}">Équipement</button></div></div>`;
    }).join("")}</div>`;
  }
  function boardHtml(s, P) {
    const full = E.mis(s).runs.length >= E.misSlots(s);
    return `<section class="panel"><div class="phead"><h2>Missions du jour</h2><span class="xs muted">${P.board.filter((m) => m.taken == null).length} libres · nouvelles à minuit</span></div><div class="list">${P.board.map((m) => {
      const T = E.MIS_TYPES[m.t]; const tk = m.taken != null ? s.chars.find((x) => x.id === m.taken) : null; const b = P.best[m.id]; const R = E.misReward(s, null, m);
      const right = m.taken != null ? `<span class="tag soft">${tk ? h(tk.name) : "un héros"} en route</span>` : b ? `<button class="btn sm" data-act="ex-send" data-id="${b.c.id}" data-m="${m.id}" ${full ? "disabled" : ""}>Envoyer ${h(b.c.name)} · ${Math.round(b.p * 100)} %</button>` : `<span class="xs muted">aucun héros à niveau</span>`;
      return `<div class="li exm-m ${m.taken != null ? "taken" : ""}">${IC(T.ic)}<span class="grow"><b>${h(E.misTitle(m))}</b> <span class="xs muted exm-nw">niv. ${m.lvl} · ${T.h} h</span><br><span class="xs">${m.req.map((q) => h(E.misReqTxt(q))).join(" · ")}</span><br><span class="xs muted">≈ ${kfmt(R.kamas)} k, ${fmt(R.res)} ressources${R.keys ? `, ${R.keys} ${pl(R.keys, "clé")}` : ""}${T.item >= 1 ? ", un objet garanti" : ""}</span></span>${right}</div>`;
    }).join("") || `<div class="empty">Aucune mission aujourd'hui.</div>`}</div></section>`;
  }
  function slotsHtml(s) {
    const M = E.mis(s); const n = E.misSlots(s);
    return `<section class="panel"><div class="phead"><h2>Places d'expédition</h2><span class="xs muted">${M.runs.length} / ${n}</span></div><div class="pad stack" style="gap:8px"><span class="small muted">${E.MIS.slots} expéditions en même temps, une ${E.MIS.slots + 1}e avec la Salle des cartes du Havre-Sac. Elles avancent aussi quand tu n'es pas là.</span>
      ${M.room ? `<span class="small">${IC("carte")} Salle des cartes construite : <b>${n} places</b>.</span>` : `<div class="row" style="flex-wrap:wrap"><button class="btn sm ${s.kamas >= E.MIS.roomCost ? "primary" : ""}" data-act="ex-room" ${s.kamas >= E.MIS.roomCost ? "" : "disabled"}>Construire la Salle des cartes · ${kfmt(E.MIS.roomCost)} kamas</button>${s.kamas < E.MIS.roomCost ? `<span class="xs muted">il manque ${fmt(E.MIS.roomCost - s.kamas)} kamas</span>` : ""}</div>`}</div></section>`;
  }
  function logHtml(s) {
    const L = E.mis(s).log.slice(0, 6); if (!L.length) return "";
    return `<section class="panel"><div class="phead"><h2>Derniers retours</h2><span class="xs muted">${fmt(E.mis(s).n || L.length)} ${pl(E.mis(s).n || L.length, "mission")} en tout</span></div><div class="list">${L.map((x) => retLine(x)).join("")}</div></section>`;
  }
  const retLine = (x) => `<div class="li">${X().cmed(x.cls, 0, 0)}<span class="grow"><b>${h(x.name)}</b> · <span class="small">${h(E.misTitle(x))}</span> <span class="tag ${x.ok ? "good" : "warn"}">${x.ok ? "réussie" : "ratée"}</span><br><span class="xs muted">+${fmt(x.kamas)} kamas${x.nres ? ` · ${fmt(x.nres)} ressources` : ""}${x.keys ? ` · ${x.keys} ${pl(x.keys, "clé")}` : ""}${x.tpl && D.ITEMS[x.tpl] ? ` · <b>${h(D.ITEMS[x.tpl].name)}</b>` : ""}${x.up ? ` · +${x.up} ${pl(x.up, "niveau", "niveaux")}` : ""}</span></span></div>`;
  function html() {
    const s = S(); if (!s) return "";
    const P = plan(s);
    return `<div class="pagehead"><h1>${IC("carte")} Expéditions</h1><span class="grow"></span><span class="small"><span class="coin"></span> <b class="num">${fmt(s.kamas)}</b></span><button class="btn sm" data-act="ex-back">← Havre-Sac</button></div>
    <div class="stack exm-pg">
      <p class="small muted exm-intro">Les héros qui ne sont pas dans l'équipe partent en mission. Leur chance de réussite dépend de leur niveau et de leur équipement (et de l'élément ou de la classe demandés). Une mission ratée rapporte un quart.</p>
      ${runsHtml(s)}${cardsHtml(s, P)}${boardHtml(s, P)}${slotsHtml(s)}${logHtml(s)}
    </div>`;
  }
  function tile() {
    const s = S(); if (!s || s.chars.length < 2) return null;
    const M = E.mis(s); const n = E.misSlots(s); const av = E.misHeroes(s).length; const free = n - M.runs.length;
    const next = M.runs.length ? Math.min(...M.runs.map((r) => r.t1)) : 0;
    return { ic: IC("carte"), t: "Expéditions", s: M.runs.length ? `${M.runs.length} en cours · prochain retour dans ${hrs((next - E.now()) / 1000)}${free > 0 && av ? ` · ${free} ${pl(free, "place libre", "places libres")}` : ""}` : av ? `${av} ${pl(av, "héros", "héros")} hors de l'équipe ${av > 1 ? "peuvent" : "peut"} partir en mission` : "les héros hors de l'équipe partent en mission",
      hot: free > 0 && av > 0, done: free <= 0, act: `data-act="ex-go"`, badge: `<span class="pill num">${M.runs.length}/${n}</span>` };
  }

  /* ---------- donjon pendant l'absence (page des donjons) ---------- */
  function dghPanel() {
    const s = S(); if (!s) return "";
    const cleared = Object.keys(D.DUNGEONS).filter((d) => s.stasis && s.stasis[d] && s.stasis[d].max >= 1).sort((a, b) => D.DUNGEONS[a].lvl - D.DUNGEONS[b].lvl || (D.DUNGEONS[a].name < D.DUNGEONS[b].name ? -1 : 1));
    if (!cleared.length) return "";
    const H = E.dgh(s); const rate = E.offRate(s); const cur = s.dungeon && !s.dungeon.defi && !s.dungeon.gboss ? s.dungeon : null;
    const T = E.dghTarget(s, cur); const did = T.did || null; const dg = did && D.DUNGEONS[did];
    const sel = `<select data-ex="dg" aria-label="Donjon pendant l'absence"><option value="">Le donjon en cours quand je pars</option>${cleared.map((d) => `<option value="${d}" ${H.did === d ? "selected" : ""}>${h(D.DUNGEONS[d].name)} (niv. ${D.DUNGEONS[d].lvl})</option>`).join("")}</select>`;
    const SI = did ? E.stasisInfo(s, did) : null;
    const ksel = H.did && SI && SI.max >= 1 ? `<select data-ex="k" aria-label="Stasis">${[0].concat(Array.from({ length: SI.max }, (_, i) => i + 1)).map((k) => `<option value="${k}" ${(H.k || 0) === k ? "selected" : ""}>${k ? `stasis ${k}` : `stasis choisie au donjon (${Math.min(SI.sel || SI.max, SI.max)})`}</option>`).join("")}</select>` : "";
    const tog = `<label class="dgh-tog"><input type="checkbox" data-act="ex-dghon" ${H.on ? "checked" : ""}><i></i>Continuer quand je pars</label>`;
    // lot ergonomie (21/10) : replié par défaut sur une ligne, la liste des donjons d'abord ; « Régler » déplie (S.settings.dghOpen)
    if (!s.settings.dghOpen) return `<section class="panel dgh-pan dgh-mini"><div class="dgh-line"><span class="dgh-hg" aria-hidden="true">⏳</span><span class="stack grow" style="gap:0;min-width:0"><b>Donjon pendant ton absence</b><span class="xs muted">${hrs(H.b)} sur ${hrs(E.DGH.max)} · ${H.on ? (dg ? `${h(dg.name)}${T.k ? ` · stasis ${T.k}` : ""}` : "le donjon en cours quand tu pars") : "coupé : l'équipe chasse"}</span></span>${tog}<button class="btn sm" data-act="ex-dghfold" aria-expanded="false">Régler</button></div></section>`;
    let box, rows = [];
    if (dg && T.k) {
      const keys = E.dgEntries ? E.dgEntries(s, did) : s.res[dg.key] || 0; const est = E.dghEst(s, did, T.k); // 2.1.39 : + l'entrée du Trousseau du jour
      const P = E.dghPlan(s, did, T.k, rate);
      box = `<div class="dgh-sel">${X().im(X().imgM(dg.boss), "", D.MONSTERS[dg.boss].name)}<div class="stack" style="gap:2px;min-width:0"><b>${h(dg.name)}</b><span class="xs muted">stasis ${T.k} · ${fmt(keys)} ${pl(keys, "clé")} · ${est.src === "mesure" ? `${Math.round(est.w * 100)} % de victoires` : "réussite pas encore mesurée"}${T.auto ? " · donjon en cours" : ""}</span></div>${tog}</div>`;
      rows.push([`Pour ${hrs(H.b)}`, P.runs ? `≈ ${P.runs} ${pl(P.runs, "course")}, il te faut ${P.runs} ${pl(P.runs, "clé")} (tu en as ${fmt(keys)})` : "pas assez d'heures pour une course"]);
      rows.push(["Une course", `${est.s < 3600 ? `≈ ${Math.max(1, Math.round(est.s / 60))} min` : hrs(est.s)} en jeu${est.src === "mesure" ? `, mesuré sur tes ${est.n} ${pl(est.n, "course")} en stasis ${T.k}` : est.src === "estime" ? ", estimé d'après tes combats dans ce donjon" : ", estimation prudente (joue-le une fois dans cette stasis)"}`]);
    } else if (dg) {
      box = `<div class="dgh-sel">${X().im(X().imgM(dg.boss), "", D.MONSTERS[dg.boss].name)}<div class="stack" style="gap:2px;min-width:0"><b>${h(dg.name)}</b><span class="xs muted">${h(E.DGH_WHY[T.why] || "")} : réussis-le une fois en jeu</span></div>${tog}</div>`;
    } else box = `<div class="dgh-sel dgh-none"><span class="dgh-hg">${IC("cle")}</span><div class="stack" style="gap:2px;min-width:0"><b>Le donjon en cours quand tu pars</b><span class="xs muted">${cur ? "" : "aucun donjon en cours pour l'instant : choisis-en un, ou quitte le jeu en plein donjon"}</span></div>${tog}</div>`;
    rows.push(["Dofus", "même chance par course qu'en jeu, aucun bonus"]);
    const L = H.last;
    const last = L && L.did && D.DUNGEONS[L.did] ? `<div class="xs dgh-last">Dernière absence (${hrs(L.sec)}) : ${L.runs ? `${L.runs} ${pl(L.runs, "course")}, ${L.wins} ${pl(L.wins, "victoire")}, ${L.keys} ${pl(L.keys, "clé")}, ${L.items} ${pl(L.items, "objet")}, ${L.dofus} Dofus` : "aucune course"}${L.why && E.DGH_WHY[L.why] ? ` (${h(E.DGH_WHY[L.why])})` : ""} · ${h(D.DUNGEONS[L.did].name)}.</div>` : "";
    return `<section class="panel dgh-pan"><div class="phead"><h2>Donjon pendant ton absence</h2><button class="btn sm" data-act="ex-dghfold" aria-expanded="true">Replier</button></div><div class="pad stack" style="gap:10px">
      <div class="dgh-bank"><span class="dgh-hg" aria-hidden="true">⏳</span><div class="stack grow" style="gap:4px;min-width:200px"><b>Heures de donjon : ${hrs(H.b)} sur ${hrs(E.DGH.max)} ${window.GUIDE ? GUIDE.q("expeditions#heures-de-donjon") : ""}</b><div class="gbar dgh-g"><i style="width:${Math.round(H.b / E.DGH.max * 100)}%"></i></div><span class="xs muted dgh-bs">+2 h chaque jour à minuit, gardées jusqu'à 8 h</span></div></div>
      <div class="dgh-ch">${sel}${ksel}</div>
      ${box}
      <div class="small">Quand tu quittes le jeu, l'équipe continue ce donjon au rendement hors ligne (<b>${Math.round(rate * 100)} %</b> chez toi) tant qu'il reste des heures et des clés, puis elle repart chasser. Seules les stasis déjà réussies continuent.</div>
      <div class="list">${rows.map(([a, b]) => `<div class="li small"><b class="dgh-lab">${h(a)}</b><span class="grow">${h(b)}</span></div>`).join("")}</div>
      ${last}</div></section>`;
  }

  /* ---------- fenêtre « Pendant votre absence » ---------- */
  function offDg(r) {
    const R = r && r.dg; if (!R) return "";
    const dg = D.DUNGEONS[R.did]; const name = dg ? dg.name : "le donjon";
    if (!R.runs) return R.why && E.DGH_WHY[R.why] ? `<p class="small muted">${IC("cle")} Donjon pendant l'absence${dg ? ` (${h(name)})` : ""} : rien, ${h(E.DGH_WHY[R.why])}.</p>` : "";
    const H = E.dgh(S());
    return `<div class="dgh-off"><div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap">${dg ? X().im(X().imgM(dg.boss), "dgh-offimg", D.MONSTERS[dg.boss].name) : ""}<span class="grow"><b>Donjon pendant l'absence : ${h(name)}</b> <span class="xs muted">stasis ${R.k}</span><br><span class="small">${R.runs} ${pl(R.runs, "course")}, <b>${R.wins}</b> ${pl(R.wins, "victoire")}, ${R.keys} ${pl(R.keys, "clé")} · ${hrs(R.used)} de tes heures de donjon (il en reste ${hrs(H.b)})</span></span></div>
      <div class="xs">+${fmt(R.kamas)} kamas · ${kfmt(R.xp)} XP par héros · ${R.items} ${pl(R.items, "objet")} · ${R.dust} ${R.dust > 1 ? "Poussières de stasis" : "Poussière de stasis"} · ${R.dofus.length ? `<b class="dgh-dof">Dofus : ${R.dofus.map((id) => h((E.DOFUS && E.DOFUS[id] && E.DOFUS[id].name) || id)).join(", ")} !</b>` : "0 Dofus"}</div>
      ${R.why && E.DGH_WHY[R.why] ? `<div class="xs muted">Arrêt : ${h(E.DGH_WHY[R.why])}, puis l'équipe est repartie chasser.</div>` : ""}</div>`;
  }
  function offMis(r) {
    if (!r || !r.mis || !r.mis.length) return "";
    return `<h3 class="sec">Retours d'expédition</h3><div class="list small">${r.mis.map(retLine).join("")}</div>`;
  }

  /* ---------- actions ---------- */
  const repaint = () => { X().markDirty(); X().render(); };
  function act(a, t) {
    const s = S(); if (!s) return; const d = t.dataset; const ui = UI();
    switch (a) {
      case "ex-go": ui.tab = "home"; ui.home = "expe"; X().closeSheet(); X().render(); window.scrollTo(0, 0); return;
      case "ex-back": ui.tab = "home"; ui.home = "apercu"; X().render(); window.scrollTo(0, 0); return;
      case "ex-next": st.pick[+d.id] = (st.pick[+d.id] || 0) + 1; X().render(); return;
      case "ex-send": { const c = s.chars.find((x) => x.id === +d.id); const r = E.act(s, "misSend", +d.id, d.m); if (r) { X().toast(r, "warn"); return; } delete st.pick[+d.id]; X().toast(`${c ? c.name : "Le héros"} part en mission. Retour dans ${hrs(E.misRun(s, +d.id).t1 / 1000 - E.now() / 1000)}.`); repaint(); return; }
      case "ex-recall": { const id = +d.id; if (st.conf !== id || Date.now() - st.confT > 5000) { st.conf = id; st.confT = Date.now(); X().render(); setTimeout(() => { if (st.conf === id) { st.conf = null; if (ui.tab === "home" && ui.home === "expe") X().render(); } }, 5000); return; }
        st.conf = null; const r = E.act(s, "misRecall", id); if (r) { X().toast(r, "warn"); return; } X().toast("Le héros est rentré."); repaint(); return; }
      case "ex-room": { const r = E.act(s, "misBuildRoom"); if (r) { X().toast(r, "warn"); return; } X().toast("Salle des cartes construite : une place d'expédition de plus !", "rare"); repaint(); return; }
      case "ex-dghfold": s.settings.dghOpen = !s.settings.dghOpen; X().render(); return;
      case "ex-dghon": { const r = E.act(s, "dghSet", { on: !!t.checked }); if (r) { X().toast(r, "warn"); return; } X().toast(t.checked ? "L'équipe continuera le donjon quand tu pars." : "Pendant ton absence, l'équipe chassera."); repaint(); return; }
    }
  }
  document.addEventListener("change", (ev) => {
    const el = ev.target; const k = el && el.dataset && el.dataset.ex; const s = S(); if (!k || !s) return;
    const r = k === "dg" ? E.act(s, "dghSet", { did: el.value || null }) : E.act(s, "dghSet", { k: +el.value || 0 });
    if (r) X().toast(r, "warn"); repaint();
  });
  /* la page des expéditions suit l'horloge : compte à rebours chaque seconde, missions revenues redessinées (mise à jour ciblée) */
  setInterval(() => {
    try {
      const s = S(); const ui = UI(); if (!s || document.hidden || ui.tab !== "home" || ui.home !== "expe") return;
      const main = document.getElementById("main"); const sh = document.getElementById("sheet"); if (!main || (sh && sh.innerHTML)) return;
      const now = E.now(); let gone = false;
      main.querySelectorAll("[data-exleft]").forEach((b) => { const left = (+b.dataset.exleft - now) / 1000; if (left <= 0) gone = true; const t2 = hrs(left); if (b.textContent !== t2) b.textContent = t2; });
      const sig = JSON.stringify([E.mis(s).runs.length, E.mis(s).log.length && E.mis(s).log[0].at, E.mis(s).n, E.misHeroes(s).length, s.kamas >= E.MIS.roomCost]);
      if (gone || sig !== st.sig) { st.sig = sig; window.DX.morph(main, html()); }
    } catch (e) { /* jamais bloquer */ }
  }, 1000);

  window.EXPUI = { html, tile, dghPanel, offDg, offMis, act };
})();
