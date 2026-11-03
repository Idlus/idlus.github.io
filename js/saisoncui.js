/* ============================================================================
   Classique · Saison 1, lot 1 (interface) : tableau de bord de saison en haut de l'accueil (Mathis 8A « Incroyable pour le
   visuel ») et choix des bénédictions (3A). Seulement dans la partie Classique · Saison 1 (js/saisonc.js) : ailleurs, rien.
   Le bandeau reprend l'image de serveur du Classique de saison (assets/s1/srv-2.webp, générée avec ChatGPT, validée le 02/11).
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S;
  const h = (s) => X().h(s);
  const C = () => E().S1C;
  const dur = (ms) => { const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000); return d ? `${d} j ${hh} h` : `${hh} h`; };
  const on = () => { const s = S(); return !!(s && E().isS1c && E().isS1c(s)); };

  function homeHtml() {
    if (!on()) return "";
    const s = S(), e = E(), c = C(), m = e.s1cManche(s), over = e.s1cOver(s);
    const fr = e.s1cFrag(s), act = e.s1cFragAct(s), q = e.s1cQuota(s), left = e.s1cDayLeft(s);
    const offer = e.s1cBoonOffer(s), got = e.s1cBoonTxt(s), cap = e.s1cMtCap(s);
    const manches = c.manches.map((n, i) => `<span class="s1m ${i + 1 < m ? "done" : i + 1 === m ? "on" : ""}" title="${h(n)}"><b>${i + 1}</b><i>${h(n)}</i></span>`).join("");
    return `<section class="panel s1dash" style="margin-top:14px">
      <div class="s1ban" style="background-image:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.15)),url(assets/s1/srv-2.webp)">
        <div><span class="xs s1kick">${h(c.nom)} · ${h(c.titre)}</span><h2>${over ? "Saison terminée" : `Manche ${m} · ${h(c.manches[m - 1])}`}</h2>
        <span class="small">${over ? "Ton héros rejoindra l'Éternel avec son niveau et ses cosmétiques." : `Fin de la manche dans ${dur(e.s1cMancheLeft(s))} · fin de la saison dans ${dur(e.s1cLeft(s))}`}</span></div>
        <div class="s1ms">${manches}</div></div>
      <div class="s1grid">
        <div class="s1t"><span class="xs muted">Fragments du Temps</span><b class="num">${fr}</b><div class="bar"><i style="width:${q ? Math.min(100, (act / q) * 100) : 0}%"></i></div><span class="xs muted">${act} / ${q} gagnés par les activités${left && !over ? ` · encore ${left} aujourd'hui` : ""}</span></div>
        <div class="s1t"><span class="xs muted">Bénédictions</span><b class="num">${e.s1cBoonGot(s).length} / 20</b><span class="xs muted">${got.length ? h(got.join(" · ")) : "Une à choisir tous les 10 niveaux"}</span>${offer ? `<button class="btn sm primary" data-act="s1c-boon">Choisir (niv. ${offer.lvl})</button>` : ""}</div>
        <div class="s1t"><span class="xs muted">Maîtrise de la manche</span><b class="num">${cap === Infinity ? "—" : cap}</b><span class="xs muted">points au plus pendant cette manche, relevé à la suivante</span></div>
      </div></section>`;
  }
  function boonSheet() {
    const s = S(), e = E(), o = e.s1cBoonOffer(s); if (!o) return;
    const B = (id) => C().BOONS.find((x) => x.id === id);
    X().openSheet(`<h2>Bénédiction du niveau ${o.lvl}</h2><span class="small muted">Choisis-en une : elle dure toute la saison et se cumule avec les autres. Tous les joueurs ont les mêmes trois choix à ce palier.</span>
      <div class="s1boons">${o.ids.map((id) => `<button class="s1b" data-act="s1c-pick" data-id="${id}"><b>${h(B(id).n)}</b><span class="small">${h(B(id).d)}</span></button>`).join("")}</div>
      <div><button class="btn" data-act="closesheet">Plus tard</button></div>`);
  }
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^s1c-/.test(t.dataset.act) || !on()) return;
    if (t.dataset.act === "s1c-boon") { boonSheet(); return; }
    if (t.dataset.act === "s1c-pick") { const err = E().s1cBoonPick(S(), t.dataset.id); X().closeSheet(); X().toast(err || "Bénédiction choisie !"); X().render(); }
  });
  window.S1CUI = { homeHtml, boonSheet };
})();
