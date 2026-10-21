/* ============================================================================
   GRAVURE RUNIQUE (choix de Mathis 1A 2A 3A 4C, 21/10/2026) : page Héros › Gravure runique (DX.pages.grav)
   Fin de jeu qui consomme énormément de runes et de kamas : chaque emplacement d'équipement d'un héros se grave
   du rang 1 au rang 10, +1 % aux caractéristiques de l'objet porté par rang. Le moteur est dans js/engine.js
   (E.GRAV, E.gravCost, E.gravPlan, E.gravUp, bonus dans E.charStats). Paiement : runes cochées par le joueur, ou « Auto ».
   Actions « gv-… » (clic) et « gvc-… » (cases à cocher) relayées par ui.js.
   ========================================================================== */
(function () {
  "use strict";
  if (!window.DX) return;
  const E = window.DX.E; const D = window.DATA; const { ITEMS, STATS, CLASSES } = D;
  if (!E.GRAV) return;
  const X = () => window.DX.social; const h = (s) => X().h(s); const fmt = (n) => X().fmt(n);
  const S = () => window.DX.S;
  const SLOT_N = { arme: "Arme", coiffe: "Coiffe", cape: "Cape", amulette: "Amulette", anneau1: "Anneau", anneau2: "Anneau", ceinture: "Ceinture", bottes: "Bottes", bouclier: "Bouclier" };
  const st = { cid: null, sl: "arme", auto: true, keys: [] };
  const big = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(".", ",")} G` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",")} M` : fmt(n));
  const team = () => E.team(S());
  const hero = () => { const T = team(); return T.find((c) => c.id === st.cid) || T[0] || S().chars[0]; };
  const runesW = () => { const s = S(); let w = 0; for (const k in s.runes) w += s.runes[k] * E.runeInfo(k).weight; return w; };
  const tot = (a, b) => { let w = 0, k = 0; for (let r = a + 1; r <= b; r++) { const c = E.gravCost(r); w += c.w; k += c.k; } return { w, k }; };
  const runeTxt = (take) => Object.entries(take).map(([k, n]) => `${h(E.runeName(k))} ×${fmt(n)}`).join(", ");

  function page(main) {
    const s = S(); const c = hero(); if (!c) { main.innerHTML = `<div class="empty">Recrute un héros d'abord.</div>`; return; }
    st.cid = c.id; const M = E.GRAV.max;
    const sl = E.GRAV.slots.includes(st.sl) ? st.sl : "arme"; const r = E.gravRank(c, sl); const uid = c.equip[sl]; const it = uid && s.items[uid]; const T = it && ITEMS[it.tpl];
    const top = r >= M; const nx = top ? null : E.gravCost(r + 1); const keys = st.auto ? null : st.keys.filter((k) => (s.runes[k] || 0) > 0);
    const P = nx ? E.gravPlan(s, nx.w, keys) : null; const okK = nx && s.kamas >= nx.k;
    const card = (x) => { const u = c.equip[x]; const o = u && s.items[u]; const R = E.gravRank(c, x);
      return `<button class="gvslot ${x === sl ? "on" : ""}" data-act="gv-slot" data-v="${x}">${o ? `<span class="icobox">${X().im(X().itemImg(o.tpl), "", ITEMS[o.tpl].name)}</span>` : `<span class="icobox gvempty"></span>`}<span class="gvsn">${SLOT_N[x]}</span><span class="gvrk r${R}">${R ? `Rang ${R}/${M}` : "—"}</span>${R ? `<span class="xs muted">+${R * E.GRAV.pct} %</span>` : ""}</button>`; };
    const base = it ? (E.isPerfect(it) ? E.perfectStats(it) : it.stats) : null; const now = base ? E.gravStats(base, r) : {}; const nxt = base && !top ? E.gravStats(base, r + 1) : {};
    const rows = base ? Object.entries(base).filter(([k, v]) => v > 0 && STATS[k] && !E.GRAV_SKIP[k]).map(([k, v]) => `<div class="gvst">${X().sIco(k)}<span class="grow">${fmt(v)} ${h(STATS[k].name)}</span><span class="num ${now[k] ? "plus" : "muted"}">+${now[k] || 0}</span>${top ? "" : `<span class="num gvnx">→ +${nxt[k] || 0}</span>`}</div>`).join("") : "";
    const runeList = Object.keys(s.runes).filter((k) => s.runes[k] > 0).sort((a, b) => s.runes[b] * E.runeInfo(b).weight - s.runes[a] * E.runeInfo(a).weight);
    const pay = nx ? `<div class="gvpay"><div class="row" style="gap:8px"><span class="xs muted grow">Runes à fondre</span><span class="seg sm"><button data-act="gv-auto" data-v="1" aria-pressed="${st.auto}">Auto</button><button data-act="gv-auto" data-v="0" aria-pressed="${!st.auto}">Je choisis</button></span></div>
        ${st.auto ? `<div class="xs muted">Le jeu fond d'abord les runes dont tu as le plus (en poids). Jamais les runes Ga, de transcendance, ni celles de PA, PM, Portée et Invocation.</div>`
        : `<div class="gvrunes">${runeList.map((k) => { const i = E.runeInfo(k); return `<label class="gvst"><input type="checkbox" data-act="gvc-rune" data-k="${h(k)}" ${st.keys.includes(k) ? "checked" : ""}>${X().sIco(i.stat)}<span class="grow">${h(E.runeName(k))} <span class="xs muted">×${fmt(s.runes[k])}</span></span><span class="num muted">${big(s.runes[k] * i.weight)}</span></label>`; }).join("") || `<div class="empty">Aucune rune. Brise des objets pour en obtenir.</div>`}</div>`}
        ${P && P.weight ? `<div class="xs ${P.ok ? "muted" : "minus"}">${P.ok ? "Fondra" : "Pas assez"} : ${runeTxt(P.take)}${P.ok ? ` (poids ${fmt(P.weight)})` : ` (poids ${fmt(P.weight)} sur ${fmt(nx.w)})`}</div>` : !st.auto ? `<div class="xs muted">Coche les runes à fondre.</div>` : ""}</div>` : "";
    const miss = nx && (!P.ok || !okK) ? `<span class="xs minus">Il te manque ${[!P.ok ? (st.auto ? `${big(nx.w - P.weight)} de poids de runes` : "des runes cochées") : "", !okK ? `${big(nx.k - s.kamas)} kamas` : ""].filter(Boolean).join(" et ")}.</span>` : "";
    const nRk = (x) => E.GRAV.slots.reduce((a, y) => a + E.gravRank(x, y), 0);
    const done = team().reduce((a, x) => a + nRk(x), 0);
    const left = team().reduce((a, x) => { E.GRAV.slots.forEach((y) => { const t = tot(E.gravRank(x, y), M); a.w += t.w; a.k += t.k; }); return a; }, { w: 0, k: 0 });
    main.innerHTML = `<div class="pagehead"><h1>Gravure runique</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s.kamas)}</b> kamas · <b class="num">${big(runesW())}</b> de poids de runes</span></div>
    <div class="stack">
      <section class="panel"><div class="pad stack" style="gap:10px">
        <span class="small muted">Grave les emplacements d'équipement de tes héros avec des runes et des kamas. Chaque rang donne <b>+${E.GRAV.pct} %</b> aux caractéristiques de l'objet porté (sauf PA, PM, Portée et Invocation), jusqu'au rang ${M}. La gravure reste sur l'emplacement quand tu changes d'objet. Chaque rang coûte ${E.GRAV.mult} fois plus que le précédent.</span>
        <div class="invfor">${team().map((x) => `<button class="invcmp ${x === c ? "on" : ""}" data-act="gv-hero" data-v="${x.id}" title="${h(x.name)}" style="--cc:${CLASSES[x.cls].color}"><img src="${X().headImg(x)}" alt="${h(x.name)}" loading="lazy"></button>`).join("")}<span class="small"><b>${h(c.name)}</b> · ${nRk(c)} rang${nRk(c) > 1 ? "s" : ""} gravé${nRk(c) > 1 ? "s" : ""}</span></div>
      </div></section>
      <div class="gvlay">
        <section class="panel"><div class="phead"><h2>Emplacements</h2></div><div class="pad gvgrid">${E.GRAV.slots.map(card).join("")}</div></section>
        <section class="panel gvdet"><div class="phead"><div class="row">${T ? `<span class="icobox">${X().im(X().itemImg(it.tpl), "", T.name)}</span>` : ""}<div><h2>${SLOT_N[sl]} · ${r ? `Rang ${r}` : "Pas gravé"}</h2><div class="xs muted">${T ? `${h(T.name)} · niv. ${T.lvl}` : "Aucun objet porté : la gravure agira sur le prochain."}</div></div></div></div>
          <div class="pad stack" style="gap:10px">
            ${rows ? `<div class="gvsts">${rows}</div>` : ""}
            ${top ? `<div class="tag good">Rang maximum atteint</div>` : `<div class="gvcost"><div class="xs muted">Rang ${r + 1} sur ${M} : +${(r + 1) * E.GRAV.pct} % au total</div>
              <div class="gvprice"><span><b class="num">${big(nx.w)}</b> <span class="xs muted">poids de runes</span></span><span><span class="coin"></span> <b class="num">${big(nx.k)}</b> <span class="xs muted">kamas</span></span></div>
              ${pay}
              <button class="btn primary" data-act="gv-go" ${P.ok && okK ? "" : "disabled"}>Graver le rang ${r + 1}</button>${miss}</div>`}
            ${top ? "" : `<div class="gvtable"><div class="xs muted">Prochains rangs</div>${[1, 2, 3, 4, 5].map((d) => r + d).filter((x) => x <= M).map((x) => `<div class="gvst"><span class="grow">Rang ${x} · +${x * E.GRAV.pct} %</span><span class="num">${big(E.gravCost(x).w)}</span><span class="num">${big(E.gravCost(x).k)} kamas</span></div>`).join("")}</div>`}
          </div></section>
      </div>
      <section class="panel"><div class="pad row" style="gap:16px;flex-wrap:wrap"><span class="small">Équipe : <b class="num">${fmt(done)}</b> rang${done > 1 ? "s" : ""} gravé${done > 1 ? "s" : ""} sur ${fmt(team().length * E.GRAV.slots.length * M)}</span><span class="small muted">Reste pour tout graver au rang ${M} : <b class="num">${big(left.w)}</b> de poids de runes et <b class="num">${big(left.k)}</b> kamas</span></div></section>
    </div>`;
  }
  window.DX.pages.grav = page;

  function act(a, t) {
    const d = t.dataset; const rer = () => window.DX.render();
    switch (a) {
      case "gv-hero": st.cid = +d.v; rer(); return;
      case "gv-slot": st.sl = d.v; rer(); return;
      case "gv-auto": st.auto = d.v === "1"; rer(); return;
      case "gvc-rune": { const k = d.k; st.keys = st.keys.filter((x) => x !== k); if (t.checked) st.keys.push(k); rer(); return; }
      case "gv-go": { const c = hero(); const r = E.gravUp(S(), c.id, st.sl, st.auto ? null : st.keys);
        if (typeof r === "string") { X().toast(r, "info"); return; }
        X().toast(`${SLOT_N[st.sl]} de ${c.name} gravé au rang ${r.r} (+${r.r * E.GRAV.pct} %). Runes fondues : ${runeTxt(r.take)} · ${big(r.k)} kamas.`, "info");
        E.refreshSpells && E.refreshSpells(c, E.charStats(S(), c)); X().markDirty(); rer(); return; }
    }
  }
  window.GRAVUI = { act };
})();
