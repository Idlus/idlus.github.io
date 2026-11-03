/* ============================================================================
   Saison 1, lot 8 (interface) : le Duel de caisses, dans la page Foire du Trool (partie de saison). Moteur : js/duel.js.
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const G = { c: "bois", r: 1, f: 1, last: null };
  const fmt = (n) => Math.round(n || 0).toLocaleString("fr-FR");
  function html() {
    const s = S(), e = E(); if (!e.duelOpen || !(e.isS1c && e.isS1c(s))) return "";
    const F = e.FOIRE, DL = e.DUEL, C = F.CAISSES.find((x) => x.id === G.c) || F.CAISSES[0], mise = C.cost * G.r;
    const err = e.duelErr(s, G.c, G.r, G.f);
    const seg = (act, L, cur, lab) => `<div class="seg">${L.map((v) => `<button class="${v === cur ? "on" : ""}" data-act="${act}" data-v="${v}">${lab(v)}</button>`).join("")}</div>`;
    const L = G.last;
    const res = L ? `<div class="du-seats">${L.seats.map((x, i) => `<div class="du-seat${L.win.includes(i) ? " win" : ""}${x.me ? " me" : ""}">
        <span class="du-who">${x.me ? `<b>Toi</b>` : `<img src="assets/m/${x.m}.png" alt=""><b>${h(x.n)}</b>`}</span>
        <div class="du-lots">${x.lots.map((k, j) => `<i style="--r:${F.RAR[k].color};--d:${j * 350 + i * 80}ms" title="${F.RAR[k].name}">${F.RAR[k].name}<small>${fmt(C.cost * F.RAR[k].mult)}</small></i>`).join("")}</div>
        <span class="num small">${fmt(x.v)} k</span></div>`).join("")}</div>
      <p class="small fo-c du-out ${L.gain ? "good" : ""}">${L.gain ? `Gagné ! Tu remportes ${fmt(L.gain)} kamas${L.win.length > 1 ? " (égalité, pot partagé)" : ""}.` : `Perdu : ${h(L.seats[L.win[0]].n)} remporte les ${fmt(L.pot)} kamas.`}</p>` : "";
    return `<section class="panel" id="foDuel"><div class="phead"><h2>${X().IC("coffre")} Duel de caisses</h2><span class="xs muted">Saison 1 · encore ${e.duelLeft(s)} duel${e.duelLeft(s) > 1 ? "s" : ""} aujourd'hui</span></div>
      <div class="pad stack"><span class="small">Toi contre des adversaires du Trool : chacun ouvre les mêmes caisses, celui dont les lots valent le plus remporte tout, en kamas. En moyenne, la même part de la mise revient qu'en ouvrant seul.</span>
        <div class="du-ctl"><span class="xs muted">Caisse</span>${seg("du-c", F.CAISSES.map((x) => x.id), G.c, (v) => h(F.CAISSES.find((x) => x.id === v).name))}
          <span class="xs muted">Manches</span>${seg("du-r", [1, 2, 3], G.r, (v) => v)}
          <span class="xs muted">Adversaires</span>${seg("du-f", DL.FOES, G.f, (v) => v)}</div>
        ${res}
        <div class="row fo-c"><button class="btn primary" data-act="du-go"${err ? " disabled" : ""}>Lancer le duel · ${fmt(mise)} k</button></div>
        <span class="xs muted fo-c">${err ? h(err) : `Chaque manche compte comme une ouverture de caisse du jour. ${DL.DAY} duels par jour. Rien ne s'achète avec de l'argent réel.`}</span></div></section>`;
  }
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "foire" && m && window.DX.pages.foire) window.DX.pages.foire(m); };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^du-/.test(t.dataset.act) || !S()) return; const a = t.dataset.act;
    if (a === "du-c") { G.c = t.dataset.v; repaint(); return; }
    if (a === "du-r") { G.r = +t.dataset.v; repaint(); return; }
    if (a === "du-f") { G.f = +t.dataset.v; repaint(); return; }
    if (a === "du-go") { const r = E().duelOpen(S(), G.c, G.r, G.f); if (typeof r === "string") { X().toast(r); return; } G.last = r; X().markDirty(); repaint(); }
  });
  window.DUELUI = { html };
})();
