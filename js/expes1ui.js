/* ============================================================================
   Saison 1, lot 8 (interface) : la page Expéditions de saison (Aventure). Moteur : js/expes1.js (sur js/defi.js).
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const G = { last: {} };
  const fr = (n) => Math.round(n || 0).toLocaleString("fr-FR");
  const MED = { br: "Bronze", ar: "Argent", or: "Or" };
  function card(s, i) {
    const e = E(), D = window.DATA, def = e.exps1For(s, i); if (!def) return "";
    const dg = D.DUNGEONS[def.did], m = dg && D.MONSTERS[dg.boss], T = e.defiTier(def.tier), R = e.DEFI_TEAM[def.team];
    const st = e.exps1State(s), b = st.best[i], left = e.exps1Left(s, i), L = G.last[i];
    const mods = def.mods.map((k) => (e.STASIS_MODS[k] ? `<span class="tag soft" title="${h(e.STASIS_MODS[k].desc)}">${h(e.STASIS_MODS[k].name)}</span>` : "")).join("");
    const rules = def.rules.map((k) => (e.CHALLENGES[k] ? `<span class="tag" title="${h(e.CHALLENGES[k].desc || "")}">${h(e.CHALLENGES[k].name)}</span>` : "")).join("");
    const TRI = { br: 3, ar: 2, or: 1 }; const meds = e.DEFI_MEDALS.map((x) => `<span class="xs1-m m-${x.id}${st.got[i + x.id] ? " ok" : ""}" title="${x.name} : ${fr(x.pts)} points"><img src="assets/s1/tr/${TRI[x.id]}.webp" alt="">${x.name}</span>`).join("");
    const res = L ? `<p class="small xs1-res ${L.r.win ? "win" : "lose"}">${L.r.win ? `Réussie : ${fr(L.r.score)} points en ${L.r.turns} tours${L.medal ? `, bourse ${L.medal.of}` : ""}.` : L.r.err ? h(L.r.err) : "Échec : l'équipe est tombée."}${L.rew.cons.length ? ` ${L.rew.cons.length} coffre${L.rew.cons.length > 1 ? "s" : ""}${L.rew.booster ? " et un booster de cartes" : ""} !` : ""}</p>` : "";
    return `<article class="panel xs1-c">
      <header><img src="${m && m.img != null ? `assets/m/${m.img}.png` : ""}" alt="" loading="lazy"><div class="grow"><span class="xs muted">Expédition ${i + 1}${s.mono ? " · Défi de la manche" : ""}</span><h3>${h(e.EXPS1_NAMES[i])}</h3><span class="small">${h(dg ? dg.name : def.did)} · stasis ${def.k} · palier ${h(T ? T.name : def.tier)}</span></div></header>
      <div class="xs1-l"><span class="xs muted">Modificateurs</span>${mods}</div>
      <div class="xs1-l"><span class="xs muted">Règles</span>${rules}</div>
      <div class="xs1-l"><span class="xs muted">Équipe</span><span class="tag soft" title="${h(R ? R.desc : "")}">${h(R ? R.name : "")}</span>${e.exps1Pick(s, def) ? `<span class="xs muted">tes ${e.exps1Pick(s, def).length} héros les plus forts qui la respectent partiront</span>` : ""}</div>
      <div class="xs1-l xs1-ms">${meds}<span class="xs muted grow">Meilleur : ${b ? `${fr(b.score)} points` : "aucun"}</span></div>${res}
      <button class="btn primary" data-act="xs1-go" data-v="${i}"${left ? "" : " disabled"}>Lancer (${left} / ${e.EXPS1_TRIES} aujourd'hui)</button></article>`;
  }
  function pageHtml() {
    const s = S(), e = E(); const S1 = e.isS1c && e.isS1c(s);
    const head = `<div class="pagehead"><h1>Expéditions de saison</h1></div>`;
    if (!S1) return `<div class="xs1-page">${head}<section class="panel"><p>Les Expéditions de saison sont un mode de la Saison 1 : elles se jouent dans la partie de saison.</p></section></div>`;
    const n = e.exps1Count(s), m = e.s1cManche(s), left = e.s1cMancheLeft(s), dj = Math.ceil(left / 86400000);
    return `<div class="xs1-page">${head}
      <section class="panel xs1-top"><img class="s1-mo" src="assets/s1/mo/expe.webp" alt="" loading="lazy"><p class="small">Chaque manche ouvre ${n === 1 ? "une expédition" : `${n} expéditions`}, les mêmes pour tous : un donjon, des modificateurs, des règles à tenir et une règle d'équipe. Le score est celui du Défi du jour. ${e.EXPS1_TRIES} essais par jour et par expédition, le meilleur de la manche compte.</p>
        <div class="xs1-sum"><span><span class="xs muted">Manche ${m}</span><b>${h(e.S1C.manches[m - 1] || "")}</b></span><span><span class="xs muted">Total de la manche</span><b class="num">${fr(e.exps1Total(s))}</b></span><span><span class="xs muted">Fin de la manche</span><b>${dj} jour${dj > 1 ? "s" : ""}</b></span></div>
        <span class="xs muted">Une fois par manche et par expédition : un coffre en argent pour le bronze, un coffre en or pour l'argent, un coffre d'obsidienne et un booster de cartes pour l'or. Toutes les bourses en or : titre « Explorateur du Temps ». Le classement (la somme des meilleurs scores) ouvre avec la saison.</span></section>
      <div class="xs1-grid">${Array.from({ length: n }, (_, i) => card(s, i)).join("")}</div></div>`;
  }
  /* classement de la manche (supabase/classements_s1.sql : lb_exps1), lu sur la partie validée par le serveur */
  const LB = { key: "", rows: null };
  const lbHtml = () => `<section class="panel s1-lb"><div class="phead"><h2>Classement de la manche</h2></div><div class="pad" id="xs1Lb">${LB.rows == null ? `<div class="empty">Chargement…</div>`
    : !LB.rows.length ? `<div class="empty">Personne pour l'instant cette manche.</div>` : `<ol class="s1-lbl">${LB.rows.map((r) => `<li><b class="num">${r.rang}</b><span class="grow">${h(r.pseudo || "?")}</span><span class="small num">${fr(r.score)} points</span></li>`).join("")}</ol>`}
    <span class="xs muted">La somme de tes 3 meilleurs scores de la manche, d'après ta partie validée par le serveur.</span></div></section>`;
  function lbLoad(m) { const ON = window.ONLINE, key = "m" + m; if (LB.key === key && LB.rows) return; LB.key = key; LB.rows = null;
    if (!ON || !ON.user) { LB.rows = []; return; }
    Promise.resolve(ON.rpc("lb_exps1", { p_m: m })).then((r) => { LB.rows = r && !r.err && Array.isArray(r.data) ? r.data : []; if (UI().tab === "xs1") repaint(); }, () => { LB.rows = []; repaint(); }); }
  const page = (main) => { main.innerHTML = pageHtml(); const s = S(), e = E(); if (e.isS1c && e.isS1c(s) && window.ONLINE && window.ONLINE.user) { lbLoad(e.s1cManche(s)); main.querySelector(".xs1-page").insertAdjacentHTML("beforeend", lbHtml()); } };
  window.DX.pages.xs1 = page;
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "xs1" && m) page(m); };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^xs1-/.test(t.dataset.act) || !S()) return;
    if (t.dataset.act === "xs1-go") { const i = +t.dataset.v; const r = E().exps1Play(S(), i); if (typeof r === "string") { X().toast(r); return; }
      G.last[i] = r; X().markDirty(); X().toast(r.r.win ? `Expédition réussie : ${fr(r.r.score)} points.` : "Expédition ratée."); repaint(); }
  });
  window.XS1UI = { pageHtml };
})();
