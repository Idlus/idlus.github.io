/* ============================================================================
   L'EXPÉDITION SANS FIN — interface (0.1.24). La logique est dans js/expedition.js.
   Page Aventure › Expédition (expédition en cours, portes, reliques, bénédictions, campement),
   fiches de choix (relique, bénédiction, pari du palier, Marchand) et bilan de fin.
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const { MONSTERS, DUNGEONS, ITEMS } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const ui = { view: "run", forge: [], drop: null, pend: 0, end: 0, key: "", confirm: false, init: false };

  /* ---------- petits rendus ---------- */
  const mi = (key, cls = "xp-tm") => (MONSTERS[key] ? `<img class="${cls}" src="assets/m/${MONSTERS[key].img}.png" alt="${h(MONSTERS[key].name)}" loading="lazy">` : "");
  const uiIc = (n, cls = "xp-ti") => `<img class="${cls}" src="assets/ui/${n}.webp" alt="" loading="lazy">`;
  const relIc = (id, cls = "xp-ti") => { const r = E.EXP_RELICS[id]; return r ? X().im(X().resImg(r.res), cls, r.name) : ""; };
  const rk = (r) => (r === "l" ? "leg" : r === "r" ? "rare" : "");
  const plural = (n, s) => `${n} ${s}${n > 1 ? "s" : ""}`;
  const lives = (X_) => `<span class="xp-lives" data-tip="Une défaite coûte une vie et fait rejouer l'étage. À zéro, l'expédition s'arrête et tu gardes tout.">${"❤️".repeat(Math.max(0, X_.lives))}${"🖤".repeat(Math.max(0, X_.livesMax - X_.lives))}</span><span class="xs muted">${X_.lives} vie${X_.lives > 1 ? "s" : ""} sur ${X_.livesMax}</span>`;
  const weekLeft = () => { const s = Math.max(0, (E.weekEnd() - E.now()) / 1000); const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600); return d ? `${d} j ${hh} h` : hh ? `${hh} h` : "moins d'une heure"; };
  const relicCard = (id, extra = "", idx) => { const r = E.EXP_RELICS[id]; if (!r) return "";
    return `<div class="xp-r ${rk(r.r)} ${extra}" ${idx !== undefined ? `data-act="ex-forge" data-i="${idx}"` : ""} data-tip="${h(`${r.name} (${E.EXP_RARITY[r.r].toLowerCase()}) : ${r.desc}`)}">${relIc(id)}<b>${h(r.name)}</b><span class="muted">${h(r.desc)}</span></div>`; };
  const doorCard = (s, d, X_, clickable) => {
    const T = E.EXP_DOORS[d.t]; const lv = E.campHas(s, "longuevue") || d.t === "boss";
    let mons = "", title = T.name, extra = "";
    if (d.t === "fight" || d.t === "elite") {
      const cnt = {}; d.mons.forEach((m) => (cnt[m.id] = (cnt[m.id] || 0) + 1));
      title = lv ? Object.entries(cnt).map(([k, n]) => `${MONSTERS[k].name}${n > 1 ? ` ×${n}` : ""}`).join(", ") : plural(d.mons.length, "monstre");
      mons = lv ? d.mons.map((m) => mi(m.id)).join("") : d.mons.map(() => `<span class="xp-tm q">?</span>`).join("");
      if (d.t === "elite") extra = `<span class="pill" style="margin-left:4px">${d.mons.filter((m) => m.champ).length > 1 ? "Champions" : "Champion"}</span>`;
    } else if (d.t === "boss") { const dg = DUNGEONS[d.did]; title = MONSTERS[dg.boss].name; mons = mi(dg.boss, "xp-tm big"); extra = `<span class="xs muted">${h(dg.name)} · ${E.bossMechs(d.did).map((m) => h(E.BOSS_MECHS[m].name)).join(", ")}</span>`; }
    else if (d.t === "altar") { mons = X().cmed(["iop", "eni", "feca", "xelor", "enu", "eca", "panda", "sacri", "cra", "osa"][Math.floor(E.rnd() * 10)]); title = "Une bénédiction au choix"; }
    else if (d.t === "shop") { mons = d.opts.map((o) => relIc(o.id, "xp-tm")).join(""); title = "Trois reliques en vente"; }
    else if (d.t === "rest") { mons = uiIc("havre", "xp-tm"); title = E.campHas(s, "repos") ? "Tous les PV, héros ranimés" : "50 % des PV, héros ranimés"; }
    else if (d.t === "treasure") { mons = uiIc("coffre", "xp-tm"); title = "Kamas, ressources, relique"; }
    const ec = d.t === "boss" ? 50 + X_.floor * 2 : d.t === "elite" ? 25 + X_.floor * 1.4 : d.t === "fight" ? 10 + X_.floor * 0.7 : 0;
    const rw = [ec ? `<span class="pill good">+${Math.round(ec)} Éclats</span>` : "", d.t === "elite" ? `<span class="pill" style="color:#b3a8ff">relique rare</span>` : "", d.t === "boss" ? `<span class="pill good">bénédiction</span><span class="pill">relique</span>${X_.floor % E.EXP_PALIER === 0 ? `<span class="pill" style="color:var(--gold2)">coffre de palier</span>` : ""}` : "", d.t === "treasure" ? `<span class="pill">relique commune</span>` : "", d.t === "altar" ? `<span class="pill good">bénédiction</span>` : "", d.t === "fight" ? `<span class="pill">butin</span>` : ""].join("");
    return `<${clickable ? "button" : "div"} class="xp-door ${d.t}" ${clickable ? `data-act="ex-door" data-i="${d.i}"` : ""}><span class="dk">${T.name}${d.t === "boss" && X_.floor % E.EXP_PALIER === 0 ? ` · palier ${X_.floor}` : ""}</span><span class="mons">${mons}${extra && d.t !== "boss" ? extra : ""}</span><b>${h(title)}</b>${d.t === "boss" ? extra : ""}<span class="xs muted">${h(T.desc)}</span><span class="rw">${rw}</span></${clickable ? "button" : "div"}>`;
  };
  const floorsStrip = (X_) => {
    const lost = new Set(X_.log.filter((l) => !l.w).map((l) => l.f)); const won = new Set(X_.log.filter((l) => l.w).map((l) => l.f));
    const start = Math.max(1, X_.floor - 24); let out = "";
    for (let n = start; n < start + 40; n++) { const c = (n === X_.floor ? "cur " : "") + (won.has(n) ? "w " : lost.has(n) && n < X_.floor ? "l " : lost.has(n) ? "l " : "") + (n % E.EXP_BOSS_EVERY === 0 ? "b" : ""); out += `<i class="${c}" data-tip="Étage ${n}${n % E.EXP_PALIER === 0 ? " · palier" : n % E.EXP_BOSS_EVERY === 0 ? " · boss" : ""}">${n}</i>`; }
    return `<div class="xp-floors">${out}</div>`;
  };

  /* ---------- la page ---------- */
  function render(main) {
    const s = S(); const on = E.expActive(s); const X_ = s.exp; const C = E.camp(s); const wk = E.expWeek(s);
    if (!on && ui.view === "run" && !ui.init) ui.init = true;
    const head = `<div class="pagehead"><div><div class="small muted">Aventure · dès le niveau ${E.EXP_MIN_LVL} · semaine du ${h(new Date(E.weekEnd() - 7 * 86400000).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }))}</div><h1>L'Expédition sans fin</h1></div>
      <div class="row"><span class="pill" data-tip="Éclats d'expédition : gagnés à chaque étage, même en cas de chute. Ils achètent les améliorations du campement.">${uiIc("cristal", "uico")} <b class="num">${fmt(C.ec)}</b> Éclats</span><span class="seg">${[["run", "Expédition"], ["camp", "Campement"]].map(([v, n]) => `<button data-act="ex-view" data-v="${v}" aria-pressed="${ui.view === v}">${n}</button>`).join("")}</span>
      ${on ? `<button class="btn sm ${ui.confirm ? "danger" : ""}" data-act="ex-quit">${ui.confirm ? "Confirmer l'abandon" : "Abandonner (garder tout)"}</button>` : ""}</div></div>`;
    main.innerHTML = head + (ui.view === "camp" ? campHtml(s, C) : on ? runHtml(s, X_, wk) : introHtml(s, wk));
    ui.key = stateKey(s);
  }
  const stateKey = (s) => { const X_ = s.exp; return E.expActive(s) ? `${X_.floor}|${X_.door}|${X_.lives}|${X_.pend.length}|${X_.eclats}|${X_.relics.length}|${X_.bless.length}|${(s.camp || {}).ec}` : `off|${s.expLast ? s.expLast.t : 0}|${(s.camp || {}).ec}`; };

  function introHtml(s, wk) {
    const err = E.expCanStart(s); const best = (s.cnt && s.cnt.expBest) || 0; const starts = E.expStarts(s); const L = s.expLast;
    const team = E.team(s); const lvl = team.length ? Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length) : 0;
    const titles = E.EXP_TITLES.map(([f, t]) => `<span class="pill ${best >= f ? "good" : ""}">${best >= f ? "✓ " : ""}étage ${f} · ${h(t)}</span>`).join("");
    return `<div class="defi"><div class="df-head"><span class="wk">${X().G("star")} Partir à l'expédition</span><span class="xs muted">record : <b>étage ${best}</b> · cette semaine : étage ${wk.best} · nouvelle carte dans <b>${weekLeft()}</b></span></div>
      <div class="xs muted">Des étages sans fin, adaptés au niveau de ton équipe à l'entrée (niveau ${lvl} : monstres et boss des zones de niveau ${Math.max(1, lvl - E.EXP_ZONE)} à ${lvl + E.EXP_ZONE}, de plus en plus forts). À chaque étage, choisis une porte ; un boss tous les ${E.EXP_BOSS_EVERY} étages, un coffre de palier tous les ${E.EXP_PALIER}. Les reliques s'additionnent jusqu'à la chute, les Éclats restent et améliorent le campement. Pas de clé, rien ne tourne hors ligne : l'expédition t'attend.</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${err ? `<span class="tag warn">${h(err)}</span>` : starts.map((f) => `<button class="btn ${f === 1 ? "primary" : ""}" data-act="ex-start" data-v="${f}">${f === 1 ? "Partir (étage 1)" : `Repartir du palier ${f - 1}`}</button>`).join("")}${!err && (s.hunting || s.dungeon) ? `<span class="xs muted">la chasse reprend toute seule après l'expédition</span>` : ""}</div></div>
    <div class="xp-top2"><div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h2>Les portes</h2><span class="xs muted">2 ou 3 par étage, les mêmes pour tous</span></div><div class="pad stack small" style="gap:6px">${Object.entries(E.EXP_DOORS).map(([k, T]) => `<div class="row" style="gap:8px;align-items:flex-start">${uiIc(T.icon, "uico")}<span><b>${T.name}</b> · ${h(T.desc)}</span></div>`).join("")}
        <div class="xs muted">Un « règne » par tranche de 10 étages (un modificateur de donjon, ordre tiré chaque semaine). Difficulté : étage 10 ≈ stasis 4, 20 ≈ 7, 30 ≈ 10, puis sans limite. XP et butin : +${Math.round(E.EXP_FLOOR_REW * 100)} % par étage. Vies : ${E.EXP_LIVES} (plus avec le campement).</div></div></section>
      ${L ? lastHtml(s, L) : ""}
    </div><div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h2>Titres</h2><span class="xs muted">selon le meilleur étage</span></div><div class="pad row" style="gap:6px;flex-wrap:wrap">${titles}</div></section>
      ${campSummary(s)}
    </div></div>`;
  }
  const lastHtml = (s, L) => `<section class="panel"><div class="phead"><h2>Dernière expédition</h2><span class="xs muted">${L.how === "fall" ? "chute" : "abandon"} à l'étage ${L.floor}${L.record ? " · record !" : ""}</span></div><div class="pad stack small" style="gap:8px">${sumHtml(L)}${L.loss ? `<div><b>Pourquoi tu es tombé :</b> ${h(L.loss.txt)}</div>` : ""}</div></section>`;
  const sumHtml = (L) => `<div class="xp-sum"><div><b>${fmt(L.rew.kamas)}</b>kamas</div><div><b>${fmt(L.rew.xp)}</b>XP par héros</div><div><b>${fmt(L.rew.dust)}</b>${h(E.POUSSIERE)}</div><div><b>${fmt(L.rew.res)}</b>ressources</div><div><b>+${fmt(L.eclats)}</b>Éclats</div><div><b>${L.rew.chests}</b>coffre${L.rew.chests > 1 ? "s" : ""}${L.rew.dbl ? ` (${L.rew.dbl} doublé${L.rew.dbl > 1 ? "s" : ""})` : ""}</div></div>`;
  const campSummary = (s) => { const C = E.camp(s); const nx = E.EXP_BRANCHES.map(([b]) => E.campNext(s, b)).filter(Boolean).sort((a, b) => a.cost - b.cost)[0];
    return `<section class="panel"><div class="phead"><h2>Campement</h2><span class="xs muted">progrès permanent</span></div><div class="pad stack small" style="gap:6px">
      <div class="row" style="gap:8px">${uiIc("cristal")}<span class="grow"><b>${fmt(C.ec)} Éclats d'expédition</b><br><span class="xs muted">gagnés à chaque étage, même en cas de chute</span></span><button class="btn sm" data-act="ex-view" data-v="camp">Améliorer</button></div>
      <div class="xs muted">${E.campCount(s)} amélioration${E.campCount(s) > 1 ? "s" : ""} sur ${E.EXP_CAMP.length}${nx ? ` · prochaine : ${h(nx.name)} (${nx.cost} Éclats)` : " · tout est acheté !"}</div></div></section>`; };

  function runHtml(s, X_, wk) {
    const best = (s.cnt && s.cnt.expBest) || 0; const d = X_.door !== null ? X_.doors[X_.door] : null; const p = X_.pend[0];
    const fx = E.expFx(s); const fxt = E.expFxTxt(fx);
    const state = p ? `<b>Un choix t'attend</b> <button class="btn sm primary" data-act="ex-reopen">${p.t === "relic" ? "Choisir une relique" : p.t === "bless" ? "Choisir une bénédiction" : p.t === "pari" ? "Le coffre du palier" : "Le Marchand"}</button>` : d ? `<b>${["fight", "elite", "boss"].includes(d.t) ? "Combat en cours" : "Porte franchie"}</b> <button class="btn sm" data-tab="combat">Voir le combat</button>` : `<b>Choisis ta porte</b>`;
    const mult = (1 + E.EXP_FLOOR_REW * X_.floor).toFixed(2).replace(".", ",");
    const band = `<div class="defi"><div class="df-head"><span class="wk">${X().G("star")} Expédition en cours · règne de ${h(X_.regne.god)}</span><span class="xs muted">même carte pour tous · nouvelle carte dans <b>${weekLeft()}</b></span></div>
      <div class="df-main"><div class="xp-floorbox"><span class="xs muted">Étage</span><span class="xp-big">${X_.floor}</span><span class="xs muted">record : ${best}</span></div>
      <div class="grow"><span class="row" style="gap:8px;flex-wrap:wrap">${state}<span class="pill">niveau ${X_.lvl}</span>${lives(X_)}</span>
      <div class="xs muted">${h(E.STASIS_MODS[X_.regne.mod].desc)} Boss tous les ${E.EXP_BOSS_EVERY} étages, palier tous les ${E.EXP_PALIER}. Une défaite coûte une vie et fait rejouer l'étage ; à zéro, l'expédition s'arrête et tu gardes tout.</div>
      <div class="xp-kv"><div><b>${X_.relics.length}</b>relique${X_.relics.length > 1 ? "s" : ""}</div><div><b>×${mult}</b>XP et butin à cet étage</div><div><b>+${fmt(X_.eclats)}</b>Éclats cette expédition</div>${X_.pot ? `<div><b>Palier ${X_.pot.palier}</b>coffre mis en jeu</div>` : ""}</div></div></div>
      ${floorsStrip(X_)}</div>`;
    const doors = `<section class="panel"><div class="phead"><h2>Étage ${X_.floor} · ${X_.doors.length > 1 ? `${X_.doors.length === 3 ? "trois" : "deux"} portes` : "le boss"}</h2><span class="xs muted">${d ? "porte choisie" : E.expAutoOn(s) ? `sans choix, le jeu choisit après ${Math.round(E.EXP_DOOR_MS / 1000)} s` : "le jeu attend ton choix"}</span></div>
      <div class="pad xp-doors">${X_.doors.map((x) => doorCard(s, x, X_, !d && !p)).join("")}</div>
      <div class="pad row" style="padding-top:0;gap:8px;flex-wrap:wrap">${!d && E.campHas(s, "rechercher") ? `<button class="btn sm" data-act="ex-reroll" ${X_.rerolled ? "disabled" : ""}>Rechercher (relancer les portes)</button>` : ""}<label class="xs"><input type="checkbox" data-act="ex-auto" ${E.expAutoOn(s) ? "checked" : ""}> Choix automatique quand je ne réponds pas (${Math.round(E.EXP_AUTO_MS / 1000)} s)</label>
      ${E.campHas(s, "carte") && !d ? `<span class="xs muted">Étage suivant : ${nextDoorsTxt(s, X_)}</span>` : ""}</div></section>`;
    const commons = X_.relics.map((id, i) => [id, i]).filter(([id]) => E.EXP_RELICS[id].r === "c");
    const relics = `<section class="panel"><div class="phead"><h2>Reliques de l'expédition</h2><span class="xs muted">s'additionnent · perdues à la chute · ${E.EXP_RELIC_MAX} au plus</span></div><div class="pad xp-relg">${X_.relics.map((id, i) => relicCard(id, ui.forge.includes(i) ? "sel" : "", E.campHas(s, "forge") && E.EXP_RELICS[id].r === "c" ? i : undefined)).join("")}${X_.relics.length < E.EXP_RELIC_MAX ? `<div class="xp-r empty"><span style="font-size:24px">?</span><b>Place libre</b><span class="muted">${E.EXP_RELIC_MAX - X_.relics.length} restante${E.EXP_RELIC_MAX - X_.relics.length > 1 ? "s" : ""}</span></div>` : ""}</div>
      <div class="pad xs muted" style="padding-top:0">${fxt.length ? "Total : " + h(fxt.join(", ")) + "." : "Aucune relique pour l'instant : les Élites, les Trésors, le Marchand et les boss en donnent."}${E.campHas(s, "forge") && commons.length >= 2 ? ` <b>Forge du Forgelance :</b> clique deux reliques communes pour les fusionner en une rare${ui.forge.length ? ` (${ui.forge.length}/2)` : ""}.` : ""}</div></section>`;
    const bless = `<section class="panel"><div class="phead"><h2>Bénédictions</h2><span class="xs muted">après chaque boss ou autel</span></div><div class="pad row" style="gap:8px;flex-wrap:wrap">${X_.bless.length ? X_.bless.map((id) => { const b = E.EXP_BLESS[id]; return `<span class="row xp-bl">${X().cmed(b.cls)}<span class="small"><b>${h(b.name)}</b> · ${h(b.desc)}</span></span>`; }).join("") : `<span class="xs muted">Aucune pour l'instant.</span>`}</div></section>`;
    const regnes = `<section class="panel"><div class="phead"><h2>Les règnes</h2><span class="xs muted">un par tranche de 10 étages</span></div><div class="pad stack small" style="gap:4px">${[0, 1, 2, 3].map((k) => { const f = Math.floor((X_.floor - 1) / 10) + k; const r = E.expRegne(X_.w, f * 10 + 1); const M = E.STASIS_MODS[r.mod]; return `<div class="row ${k ? "muted" : ""}" style="gap:8px">${X().cmed(r.cls)}<span class="grow"><b>Étages ${f * 10 + 1}-${f * 10 + 10} · ${h(r.god)}</b> · ${h(M.name)} : ${h(M.desc)}</span></div>`; }).join("")}</div></section>`;
    return band + `<div class="xp-top2"><div class="stack" style="gap:14px">${doors}${relics}</div><div class="stack" style="gap:14px">${bless}${regnes}${campSummary(s)}</div></div>`;
  }
  const nextDoorsTxt = (s, X_) => { const Y = Object.assign({}, X_, { floor: X_.floor + 1, reroll: 0 }); const ds = E.expDoors(s, Y); X_.regne = E.expRegne(X_.w, X_.floor); return ds.map((d) => E.EXP_DOORS[d.t].name).join(", "); };

  function campHtml(s, C) {
    const up = (u) => { const got = E.campHas(s, u.id); const nx = E.campNext(s, u.br); const next = nx && nx.id === u.id; const ok = next && C.ec >= u.cost;
      return `<div class="xp-up ${got ? "on" : next ? "next" : "lock"}"><span><b>${h(u.name)}</b>${u.desc ? h(u.desc) : ""}</span><span class="c">${got ? "acheté" : next ? `<button class="btn sm ${ok ? "primary" : ""}" data-act="ex-campbuy" data-id="${u.id}" ${ok ? "" : "disabled"}>${fmt(u.cost)}</button>` : fmt(u.cost)}</span></div>`; };
    const nxAll = E.EXP_BRANCHES.map(([b]) => E.campNext(s, b)).filter(Boolean).sort((a, b) => a.cost - b.cost)[0];
    return `<div class="defi"><div class="df-head"><span class="wk">${X().G("star")} ${E.EXP_CAMP.length} améliorations permanentes</span><span class="xs muted">${E.campCount(s)} achetée${E.campCount(s) > 1 ? "s" : ""}${nxAll ? ` · prochaine : ${h(nxAll.name)} (${nxAll.cost} Éclats)` : ""}</span></div>
      <div class="xs muted">Les Éclats tombent à chaque étage (plus l'étage est haut, plus il en donne), davantage sur les Élites et les boss, même quand l'expédition se termine par une chute. Une amélioration achetée reste pour toujours ; chaque branche s'achète dans l'ordre. Les premières coûtent 40 Éclats, la dernière 2 500 ; tout acheter demande ${fmt(E.expCampTotal)} Éclats.</div></div>
      <div class="xp-camp">${E.EXP_BRANCHES.map(([b, name, cls]) => `<div class="xp-br"><h3>${X().cmed(cls)}${h(name)}</h3>${E.EXP_CAMP.filter((u) => u.br === b).map(up).join("")}</div>`).join("")}</div>`;
  }

  /* ---------- fiches de choix ---------- */
  const timerTxt = (p) => (E.expAutoOn(S()) ? `<span class="xs muted" id="xpTimer">choix auto dans ${Math.max(0, Math.ceil((E.EXP_AUTO_MS - (E.now() - p.at)) / 1000))} s</span>` : "");
  function pendHtml(s, p) {
    const X_ = s.exp; const d = X_.doors[X_.door] || {};
    let body = "";
    if (p.t === "relic") {
      const full = X_.relics.length >= E.EXP_RELIC_MAX;
      const why = p.kind === "start" ? "Relique de départ offerte par le campement" : p.kind === "rare" ? `Élite vaincue à l'étage ${X_.floor}` : p.kind === "boss" ? `Boss vaincu à l'étage ${X_.floor}` : d.t === "treasure" ? `Trésor de l'étage ${X_.floor}` : `Étage ${X_.floor}`;
      body = `<h2>${h(why)}</h2><p class="small muted">Choisis une relique${p.opts.length > 2 ? " (l'Œil d'Ecaflip en montre 3)" : ""}, ou refuse pour +${E.EXP_REFUSE} Éclats.${full ? ` <b>Tes ${E.EXP_RELIC_MAX} places sont prises : choisis d'abord la relique à remplacer.</b>` : ""}</p>
        ${full ? `<div class="xp-relg">${X_.relics.map((id, i) => relicCard(id, ui.drop === i ? "sel" : "", undefined).replace('class="xp-r', `data-act="ex-drop" data-i="${i}" class="xp-r clk`)).join("")}</div>` : ""}
        <div class="xp-pick">${p.opts.map((id, i) => { const r = E.EXP_RELICS[id]; return `<button class="xp-pk ${rk(r.r)}" data-act="ex-pick" data-i="${i}" ${full && ui.drop === null ? "disabled" : ""}>${relIc(id)}<span class="rk ${r.r === "c" ? "muted" : ""}">${E.EXP_RARITY[r.r]}</span><b>${h(r.name)}</b><span class="xs muted">${h(r.desc)}</span></button>`; }).join("")}</div>
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" data-act="ex-no">Refuser (+${E.EXP_REFUSE} Éclats)</button>${timerTxt(p)}</div>`;
    } else if (p.t === "bless") {
      body = `<h2>${d.t === "altar" ? "L'autel des Douze" : `Boss vaincu à l'étage ${X_.floor}`}</h2><p class="small muted">Une bénédiction à garder jusqu'à la chute :</p>
        <div class="xp-pick">${p.opts.map((id, i) => { const b = E.EXP_BLESS[id]; return `<button class="xp-pk" data-act="ex-pick" data-i="${i}">${X().cmed(b.cls)}<b>${h(b.name)}</b><span class="xs muted">${h(b.desc)}</span></button>`; }).join("")}</div>
        <div class="row" style="gap:8px;align-items:center">${timerTxt(p)}</div>`;
    } else if (p.t === "pari") {
      const ch = p.chest;
      body = `<h2>Palier ${ch.palier} : coffre de palier !</h2><p class="small muted">${X_.pot ? "" : ""}Que fais-tu du coffre ?</p>
        <div class="xp-sum"><div><b>${fmt(ch.kamas)}</b>kamas</div><div><b>${fmt(ch.xp)}</b>XP par héros</div><div><b>${ch.dust}</b>${h(E.POUSSIERE)}</div><div><b>${ch.items.length}</b>objet${ch.items.length > 1 ? "s" : ""} de ton niveau</div><div><b>+${ch.eclats}</b>Éclats (déjà gagnés)</div></div>
        <div class="xp-choice"><div class="xp-ch keep"><span class="xs muted">Encaisser</span><span class="odds">tout de suite</span><span class="small">Le coffre va dans ton sac maintenant. L'expédition continue normalement.</span><button class="btn primary" data-act="ex-pari" data-v="0">Encaisser</button></div>
        <div class="xp-ch dbl"><span class="xs muted">Mettre en jeu jusqu'au palier ${ch.palier + E.EXP_PALIER}</span><span class="odds" style="color:#ff9a5a">coffre ×2</span><span class="small">Si tu atteins le palier ${ch.palier + E.EXP_PALIER}, le coffre est doublé. Si tu tombes avant, il est perdu (les Éclats sont gardés).</span><button class="btn" data-act="ex-pari" data-v="1">Mettre en jeu</button></div></div>
        <div class="row" style="gap:8px;align-items:center">${timerTxt(p)}</div>`;
    } else if (p.t === "shop") {
      const C = E.camp(s);
      body = `<h2>Le Marchand de l'étage ${X_.floor}</h2><p class="small muted">Trois reliques contre tes Éclats (tu en as <b>${fmt(C.ec)}</b>)${E.campHas(s, "marchand") ? " · Marchand ami : −25 %" : ""}. ${X_.relics.length >= E.EXP_RELIC_MAX ? "Tes places de reliques sont toutes prises." : ""}</p>
        <div class="xp-pick">${p.opts.map((o, i) => { const r = E.EXP_RELICS[o.id]; const ok = !o.sold && C.ec >= o.price && X_.relics.length < E.EXP_RELIC_MAX; return `<button class="xp-pk ${rk(r.r)}" data-act="ex-buy" data-i="${i}" ${ok ? "" : "disabled"}>${relIc(o.id)}<span class="rk ${r.r === "c" ? "muted" : ""}">${E.EXP_RARITY[r.r]}</span><b>${h(r.name)}</b><span class="xs muted">${h(r.desc)}</span><span class="pill ${o.sold ? "" : "good"}">${o.sold ? "vendu" : `${o.price} Éclats`}</span></button>`; }).join("")}</div>
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" data-act="ex-no">Continuer l'expédition</button>${timerTxt(p)}</div>`;
    }
    return `<div class="xp-sheet" data-pend="${p.id}">${body}</div>`;
  }
  function endHtml(s, L) {
    const starts = E.expStarts(s); const err = E.expCanStart(s);
    return `<div class="xp-sheet end"><h2>${L.how === "fall" ? `L'expédition s'arrête à l'étage ${L.floor}` : `Expédition abandonnée à l'étage ${L.floor}`}</h2>
      <p class="small muted">${L.how === "fall" ? "Plus de vies. " : ""}${L.record ? `<b>Nouveau record : ${L.best}</b> (ancien : ${L.prev}).` : `Meilleur étage : ${L.best} (record : ${L.prev}).`} Tu gardes tout :</p>${sumHtml(L)}
      ${L.lost ? `<div class="small"><b>Le coffre du palier ${L.lost.palier} mis en jeu est perdu.</b></div>` : ""}
      ${L.loss ? `<div class="small"><b>Pourquoi tu es tombé :</b> ${h(L.loss.txt)}${L.loss.boss ? ` Essaie le Repos avant un boss, ou une relique de protection (Os de Chafer, Cœur de Craqueleur).` : ""}</div>` : ""}
      <div class="row" style="gap:8px;flex-wrap:wrap">${err ? `<span class="tag warn">${h(err)}</span>` : starts.map((f) => `<button class="btn ${f === 1 ? "primary" : ""}" data-act="ex-start" data-v="${f}">${f === 1 ? "Relancer (étage 1)" : `Repartir du palier ${f - 1}`}</button>`).join("")}<button class="btn" data-act="ex-gocamp">Campement</button><button class="btn" data-act="closesheet">Fermer</button></div></div>`;
  }
  const ours = () => !!$("#sheet .xp-sheet");
  const openPend = (s, p) => { ui.pend = p.id; ui.drop = null; X().openSheet(pendHtml(s, p)); };

  /* ---------- actions ---------- */
  const after = (r, re = true) => { if (r) { X().toast(r); return false; } X().markDirty(); if (re) X().render(); return true; };
  function act(a, t) {
    const s = S(); const d = t.dataset; const X_ = s.exp;
    switch (a) {
      case "ex-view": ui.view = d.v; ui.confirm = false; X().closeSheet(); X().render(); return;
      case "ex-start": { X().closeSheet(); if (after(E.act(s, "expStart", +d.v), false)) { ui.view = "run"; ui.confirm = false; window.DX.ui.tab = "exp"; X().render(); const p = E.expPending(s); if (p) openPend(s, p); } return; }
      case "ex-quit": { if (!ui.confirm) { ui.confirm = true; X().render(); setTimeout(() => { if (ui.confirm) { ui.confirm = false; if (window.DX.ui.tab === "exp") X().render(); } }, 5000); return; } ui.confirm = false; after(E.act(s, "expQuit")); return; }
      case "ex-door": after(E.act(s, "expDoor", +d.i)); { const p = E.expPending(s); if (p) openPend(s, p); } return;
      case "ex-reroll": after(E.act(s, "expReroll")); return;
      case "ex-auto": after(E.act(s, "expSetAuto", t.checked), false); return;
      case "ex-reopen": { const p = E.expPending(s); if (p) openPend(s, p); return; }
      case "ex-drop": ui.drop = +d.i; { const p = E.expPending(s); if (p) X().openSheet(pendHtml(s, p)); } return;
      case "ex-pick": { const p = E.expPending(s); if (!p) return; const r = E.act(s, "expChoose", +d.i, ui.drop === null ? undefined : ui.drop); if (r) { X().toast(r); return; } X().markDirty(); nextSheet(s); return; }
      case "ex-no": { const r = E.act(s, "expChoose", "no"); if (r) { X().toast(r); return; } X().markDirty(); nextSheet(s); return; }
      case "ex-pari": { const r = E.act(s, "expChoose", +d.v); if (r) { X().toast(r); return; } X().markDirty(); nextSheet(s); return; }
      case "ex-buy": { const r = E.act(s, "expBuy", +d.i); if (r) { X().toast(r); return; } X().markDirty(); const p = E.expPending(s); if (p) X().openSheet(pendHtml(s, p)); return; }
      case "ex-campbuy": after(E.act(s, "campBuy", d.id)); return;
      case "ex-gocamp": X().closeSheet(); ui.view = "camp"; window.DX.ui.tab = "exp"; X().render(); return;
      case "ex-forge": { const i = +d.i; if (!X_ || !E.campHas(s, "forge")) return; const k = ui.forge.indexOf(i); if (k >= 0) ui.forge.splice(k, 1); else ui.forge.push(i);
        if (ui.forge.length >= 2) { const r = E.act(s, "expForge", ui.forge[0], ui.forge[1]); ui.forge = []; after(r); return; } X().render(); return; }
    }
  }
  /* après un choix : la fiche suivante s'il y en a une, sinon on ferme et on rafraîchit */
  const nextSheet = (s) => { const p = E.expPending(s); if (p) openPend(s, p); else { X().closeSheet(); X().render(); } };

  /* ---------- suivi : fiches qui s'ouvrent seules, page rafraîchie ---------- */
  function tick() {
    const s = S(); if (!s) return;
    const on = E.expActive(s); const p = on ? E.expPending(s) : null;
    const busy = $("#sheet").innerHTML && !ours();
    if (!ui.init) { ui.init = true; ui.end = s.expLast ? s.expLast.t : 0; if (p) ui.pend = 0; }
    if (p && !busy && ui.pend !== p.id) openPend(s, p);
    else if (p && ours()) { const el = $("#xpTimer"); if (el) el.textContent = `choix auto dans ${Math.max(0, Math.ceil((E.EXP_AUTO_MS - (E.now() - p.at)) / 1000))} s`; if ($("#sheet .xp-sheet").dataset.pend !== String(p.id)) openPend(s, p); }
    else if (!p && ours() && !$("#sheet .xp-sheet.end")) { X().closeSheet(); if (window.DX.ui.tab === "exp") X().render(); }
    if (!on && s.expLast && s.expLast.t !== ui.end) { ui.end = s.expLast.t; if (!busy && E.now() - s.expLast.t < 120000) { X().openSheet(endHtml(s, s.expLast)); if (window.DX.ui.tab === "exp") X().render(); } }
    if (window.DX.ui.tab === "exp" && !$("#sheet").innerHTML && stateKey(s) !== ui.key) X().render();
  }
  setInterval(() => { try { tick(); } catch (e) { /* jamais bloquer la boucle du jeu */ } }, 700);

  /* texte de l'en-tête du combat et de la barre d'état */
  const where = (s) => (E.expActive(s) ? `Expédition · étage ${s.exp.floor}` : null);
  window.EXPUI = { render, act, where, ui };
})();
