/* ============================================================================
   LE PORTAIL INSTABLE — affichage (Idlus 2.1.38, choix 3A 4A de Mathis)
   Une case dans « Aujourd'hui » sur le Havre-Sac, l'encadré du portail en haut de Monde › Carte,
   et l'échoppe des Fragments instables. Moteur : js/portail.js.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const h = (s) => X().h(s);
  const sub = () => { const T = E.portalToday(); return T.sid ? E.SUBS[T.sid] : null; };
  const bossOf = (sb) => { const dg = sb && (sb.dungeon || (sb.dungeons || [])[0]); const D = window.DATA.DUNGEONS[dg]; return D ? D.boss : sb && sb.monsters[0]; };
  const leftTxt = () => { const s = S(); const n = E.portalLeft(s); return `${n} / ${E.PORTAL.n} victoire${n > 1 ? "s" : ""}`; };
  const minuit = () => { const d = new Date(E.now()); d.setHours(24, 0, 0, 0); return X().dur((d - E.now()) / 1000).replace(/ \d+ s$/, ""); };

  /* case « Aujourd'hui » : allumée tant qu'il reste des passages */
  function tile() {
    const s = S(); if (!s || !E.portalShown(s)) return null; const sb = sub(); const n = E.portalLeft(s); const on = E.portalActive(s);
    return { ic: X().im(X().imgM(bossOf(sb)), "ac-tm", sb.name), t: "Portail instable", s: n ? `${on ? "en cours · " : ""}${n} victoire${n > 1 ? "s" : ""} · ${h(sb.name)}` : `refermé jusqu'à minuit · ${h(sb.name)}`, done: !n, hot: n > 0 && !on,
      act: n && !on && !E.portalErr(s) ? `data-act="pt-enter"` : `data-act="pt-shop"`, badge: n && !on && !E.portalErr(s) ? `<span class="tag">Entrer</span>` : `<span class="pill num">${E.portalSt(s).fr}</span>` };
  }
  /* encadré de Monde › Carte */
  function card() {
    const s = S(); if (!s || !E.portalShown(s)) return ""; const sb = sub(); const P = E.portalSt(s); const err = E.portalErr(s); const on = E.portalActive(s);
    const mons = [...new Set(sb.monsters)].slice(0, 5).map((k) => X().im(X().imgM(k), "", window.DATA.MONSTERS[k] ? window.DATA.MONSTERS[k].name : "")).join("");
    return `<div class="pt-card ${on ? "on" : ""}"><span class="pt-ring">${X().im(X().imgM(bossOf(sb)), "", sb.name)}</span>
      <span class="pt-t"><span class="pt-k">Portail instable · aujourd'hui</span><b>${h(sb.name)}</b><span class="xs">Monstres +${Math.round((E.PORTAL.hp - 1) * 100)} % de vie et de dégâts · butin ×${E.PORTAL.drop} · ${E.PORTAL.fr} Fragments instables par victoire</span></span>
      <span class="pt-mons">${mons}</span>
      <span class="pt-side"><span class="pt-cnt">${leftTxt()}</span><span class="xs muted">se ferme dans ${minuit()}</span>
        <span class="row" style="gap:6px;justify-content:flex-end">${on ? `<span class="tag good">En cours</span>` : `<button class="btn sm primary" data-act="pt-enter" ${err ? `disabled data-tip="${h(err)}"` : ""}>Entrer</button>`}<button class="btn sm" data-act="pt-shop">${P.fr} Fragments</button></span>
        ${err && !on && E.portalLeft(s) ? `<span class="xs muted">${h(err)}</span>` : ""}</span></div>`;
  }
  function shop() {
    const s = S(); const P = E.portalSt(s);
    const rows = E.PORTAL_ORDER.map((id) => { const it = E.PORTAL_SHOP[id]; const own = E.portalOwned(s, id); const ok = !own && P.fr >= it.cost;
      return `<div class="li"><span class="grow"><b>${h(it.name)}</b><br><span class="xs muted">${h(it.txt)}</span></span>${own ? `<span class="tag good">✓ obtenu</span>` : `<button class="btn sm ${ok ? "primary" : ""}" data-act="pt-buy" data-v="${id}" ${ok ? "" : "disabled"}>${it.cost}</button>`}</div>`; }).join("");
    X().openSheet(`<h2>Fragments instables</h2><p class="small muted">Tu en as <b>${P.fr}</b> (${P.tot} gagnés en tout). ${E.PORTAL.fr} par victoire dans le portail instable, ${E.PORTAL.n} victoires par jour. Liés au compte.</p>
      <div class="list">${rows}</div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-act="closesheet">Fermer</button></div>`);
  }
  function act(a, t) {
    const s = S(); if (!s) return;
    if (a === "pt-enter") { const r = E.act(s, "portalEnter"); if (r) { X().toast(r, "warn"); return; } X().markDirty(); X().toast(`Portail instable : ${sub().name} !`, "rare"); X().render(); return; }
    if (a === "pt-shop") { shop(); return; }
    if (a === "pt-buy") { const r = E.act(s, "portalBuy", t.dataset.v); if (r) { X().toast(r, "warn"); return; } X().markDirty(); X().toast(`${E.PORTAL_SHOP[t.dataset.v].name} : obtenu !`, "rare"); shop(); }
  }
  window.PORTUI = { tile, card, shop, act };
})();
