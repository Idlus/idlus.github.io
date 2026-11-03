/* ============================================================================
   Saison 1, lot 8 (interface) : la page Chevauchée des Cavaliers (Aventure). Moteur : js/chevauchee.js.
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const G = { k: 1, last: null };
  const boss = (id) => { const D = window.DATA, d = D.DUNGEONS[id], m = d && D.MONSTERS[d.boss]; return { n: m ? m.name : id, d: d ? d.name : "", img: m && m.img != null ? `assets/m/${m.img}.png` : "" }; };
  function pageHtml() {
    const s = S(), e = E(); const S1 = e.isS1c && e.isS1c(s);
    const head = `<div class="pagehead"><h1>Chevauchée des Cavaliers</h1></div>`;
    if (!S1) return `<div class="chv-page">${head}<section class="panel"><p>La Chevauchée des Cavaliers est un mode de la Saison 1 : elle se joue dans la partie de saison.</p></section></div>`;
    const C = e.chevState(s), left = e.chevLeft(s), L = G.last;
    const row = e.CHEV_BOSSES.map((id, i) => { const b = boss(id), f = L && L.r.fights[i];
      const st = !f ? "" : f.win ? "win" : "lose";
      return `<div class="chv-b ${st}"><img src="${b.img}" alt="" loading="lazy"><b>${h(b.n)}</b><small>${h(b.d)}</small>${f ? `<i><u style="width:${f.hp}%"></u></i><span class="xs">${f.win ? `Vaincu · ${f.turns} tours · ${f.hp} % PV` : "Défaite"}</span>` : `<span class="xs muted">Cavalier ${i + 1}</span>`}</div>`; }).join(`<span class="chv-arr">›</span>`);
    const best = C.best ? `${C.best.n} / 4 Cavaliers en stasis ${C.best.k} (${C.best.turns} tours)` : "aucun essai";
    const ks = Array.from({ length: e.CHEV_KMAX }, (_, i) => i + 1).map((k) => `<button class="${G.k === k ? "on" : ""}" data-act="chv-k" data-v="${k}">${k}</button>`).join("");
    const rew = L && L.rew && (L.rew.cons.length || L.rew.booster || L.rew.title) ? `<p class="small chv-rew">Récompenses : ${[L.rew.cons.length ? `${L.rew.cons.length} coffre${L.rew.cons.length > 1 ? "s" : ""}` : "", L.rew.booster ? "1 booster de cartes" : "", L.rew.title ? `titre « ${h(L.rew.title)} »` : ""].filter(Boolean).join(" · ")}</p>` : "";
    return `<div class="chv-page">${head}
      <section class="panel chv-top"><img class="s1-mo" src="assets/s1/mo/chev.webp" alt="" loading="lazy"><p class="small">Les 4 Cavaliers à la suite, dans leur salle, à la stasis choisie. Les PV perdus restent d'un Cavalier au suivant, et un héros à terre ne revient pas. ${e.CHEV_TRIES} essais par semaine : le meilleur compte. Équipe conseillée : niveau ${e.CHEV_LVL} et plus.</p>
        <div class="chv-row">${row}</div>${rew}
        <div class="chv-ctl"><span class="small">Stasis</span><div class="seg chv-k">${ks}</div>
          <button class="btn primary" data-act="chv-go"${left && !e.s1cOver(s) ? "" : " disabled"}>Lancer la chevauchée (${left} / ${e.CHEV_TRIES})</button></div>
        <span class="xs muted">Meilleur de la semaine ${e.s1cWeek(s)} : ${best}. Une fois par semaine et par stasis : un coffre par Cavalier vaincu, un booster de cartes pour les 4. Titres pour les 4 en stasis 5 et en stasis 10.</span></section></div>`;
  }
  /* classement de la semaine (supabase/classements_s1.sql : lb_chev), lu sur la partie validée par le serveur */
  const LB = { key: "", rows: null };
  const lbHtml = () => `<section class="panel s1-lb"><div class="phead"><h2>Classement de la semaine</h2></div><div class="pad" id="chvLb">${LB.rows == null ? `<div class="empty">Chargement…</div>`
    : !LB.rows.length ? `<div class="empty">Personne pour l'instant cette semaine.</div>` : `<ol class="s1-lbl">${LB.rows.map((r) => `<li><b class="num">${r.rang}</b><span class="grow">${h(r.pseudo || "?")}</span><span class="small">${r.n} / 4 · stasis ${r.k} · ${r.t} tours</span></li>`).join("")}</ol>`}
    <span class="xs muted">D'après ta partie validée par le serveur : un nouvel essai y apparaît quelques minutes après l'envoi.</span></div></section>`;
  function lbLoad(w) { const ON = window.ONLINE, key = "w" + w; if (LB.key === key && LB.rows) return; LB.key = key; LB.rows = null;
    if (!ON || !ON.user) { LB.rows = []; return; }
    Promise.resolve(ON.rpc("lb_chev", { p_w: w })).then((r) => { LB.rows = r && !r.err && Array.isArray(r.data) ? r.data : []; const el = document.querySelector("#chvLb"); if (el && UI().tab === "chev") repaint(); }, () => { LB.rows = []; repaint(); }); }
  const page = (main) => { main.innerHTML = pageHtml(); const s = S(), e = E(); if (e.isS1c && e.isS1c(s) && window.ONLINE && window.ONLINE.user) { lbLoad(e.s1cWeek(s)); main.querySelector(".chv-page").insertAdjacentHTML("beforeend", lbHtml()); } };
  window.DX.pages.chev = page;
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "chev" && m) page(m); };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^chv-/.test(t.dataset.act) || !S()) return;
    if (t.dataset.act === "chv-k") { G.k = +t.dataset.v; repaint(); return; }
    if (t.dataset.act === "chv-go") { const r = E().chevPlay(S(), G.k); if (typeof r === "string") { X().toast(r); return; }
      G.last = r; X().markDirty(); X().toast(r.r.n === 4 ? "Les 4 Cavaliers sont tombés !" : `${r.r.n} Cavalier${r.r.n > 1 ? "s" : ""} sur 4.`); repaint(); }
  });
  window.CHEVUI = { pageHtml };
})();
