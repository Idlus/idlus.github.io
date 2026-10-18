/* ============================================================================
   COMPTOIRS (interface), Idlus 1.0.30 « L'économie » (choix 35A)
   Page Économie › Comptoirs : les 6 boutiques du jeu (js/comptoirs.js) avec leur monnaie, l'offre de la semaine,
   les objets qu'on rachète, et les étiquettes NOUVEAU (achetable et pas encore vu) / ACHETÉ.
   Un point sur le menu tant qu'une monnaie peut acheter quelque chose de neuf (vu = montré sur cette page).
   Les pages Kolizéum, Songe infini et Boss des mondes gardent leur boutique : un bouton y mène.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.CPT || !window.DX) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const st = { shop: null, pend: null, key: {} };

  /* « vu » : les objets neufs montrés sur la page le restent jusqu'à ce qu'on change de boutique ou de page */
  function commit() { const s = S(); if (st.pend && s) { E.cptSeen(s, st.pend.sid, st.pend.ids); st.pend = null; X().markDirty(); } }
  const newOf = (s, sid) => { const L = E.cptNew(s, sid); return st.pend && st.pend.sid === sid ? L.filter((id) => !st.pend.ids.includes(id)) : L; };
  function dot() {
    const s = S(); if (!s) return false;
    if (UI().tab !== "comptoirs") commit();
    return E.CPT.some((B) => newOf(s, B.id).length > 0);
  }

  /* ---------- un objet ---------- */
  function icon(B, x) {
    const it = x.it, o = x.o; const C = it && it.cons ? D.CONSUMABLES[it.cons] : o && o.cons ? D.CONSUMABLES[o.cons] : null;
    if (x.tpl) return X().im(X().itemImg(x.tpl), "", x.name);
    if (C) return X().consIco(C);
    if (o) return X().IC(o.dust ? "poussiere" : o.kind === "look" ? "teinture" : "idee");
    if (it.res) return X().im(X().resImg(it.res), "", it.res);
    if (it.sab) return X().IC("cristal");
    if (it.key) return X().IC("cle");
    if (it.teint) return X().IC("teinture");
    if (it.wing) return X().IC("ailes");
    if (it.furn) return X().furnIco(it.furn);
    if (it.tresor) return X().IC("carte");
    if (it.orn) return X().G("frame");
    return X().IC("couronne");
  }
  function desc(B, x) {
    const it = x.it, o = x.o;
    if (x.tpl) return "Objet niv. 200 du Boss des mondes, jet tiré à l'achat.";
    if (o) return o.desc;
    if (it.cons) return D.CONSUMABLES[it.cons].desc;
    if (it.res) return `Ressource niv. ${(D.RES[it.res] || {}).lvl || "?"}`;
    if (it.sab) return `Une heure de vitesse ×2 / ×3 ajoutée à ta réserve (jusqu'à ${E.sabGiftMaxOf(S()) / 3600} h).`;
    if (it.key) return "Une clé du donjon de ton choix, parmi ceux débloqués.";
    if (it.teint) return "Nouvelles couleurs pour tous tes héros (Héros › Apparence).";
    if (it.wing) return "Couleur des ailes d'alignement (Héros › Ornement).";
    if (it.furn) return `Meuble du Havre-Sac : ${E.furnEffect ? E.furnEffect(it.furn) : ""}`;
    if (it.tresor) return `Un parchemin de plus pour la chasse au trésor (${E.TRESOR_STOCK || 3} en réserve au plus).`;
    if (it.orn) return "Ornement de carte de héros.";
    return "Titre affiché sur la carte du héros.";
  }
  function keySel(s, x) {
    const L = E.shopKeys(s); if (!L.length) return `<span class="xs muted">Aucun donjon débloqué pour l'instant.</span>`;
    const top = Math.max(...E.team(s).map((c) => c.lvl));
    if (!L.includes(st.key[x.id])) st.key[x.id] = L.filter((d) => D.DUNGEONS[d].lvl <= top).pop() || L[0];
    return `<select data-act="cp-key" data-id="${h(x.id)}" aria-label="Donjon de la clé">${L.map((d) => `<option value="${d}" ${d === st.key[x.id] ? "selected" : ""}>${h(D.DUNGEONS[d].name)} (niv. ${D.DUNGEONS[d].lvl})</option>`).join("")}</select>`;
  }
  function card(s, B, x, isNew, O, need) {
    const bal = B.bal(s); const off = O && O.id === x.id && O.left > 0; const cost = off ? O.cost : x.cost;
    const lim = x.per ? `<span class="xs muted">${fmt(x.left)}/${x.lim} ${x.per === "jour" ? "aujourd'hui" : "cette semaine"}</span>` : "";
    const can = !need && !x.owned && x.left > 0 && bal >= cost && (!x.key || E.shopKeys(s).length);
    const ten = x.many && !x.owned && !need && x.left >= 10 && bal >= cost * 10 && !off;
    const btn = x.owned ? `<span class="cp-ok" title="Déjà obtenu">✓</span>`
      : `<div class="cp-btns"><button class="btn sm ${can ? "primary" : ""}" data-act="cp-buy" data-s="${B.id}" data-id="${h(x.id)}" data-q="1" ${off ? 'data-o="1"' : ""} ${can ? "" : "disabled"}>Acheter</button>${ten ? `<button class="btn sm" data-act="cp-buy" data-s="${B.id}" data-id="${h(x.id)}" data-q="10">×10</button>` : ""}</div>`;
    return `<div class="cp-it ${isNew ? "new" : ""} ${x.owned ? "own" : ""}"><span class="cp-ic">${icon(B, x)}</span>
      <div class="cp-mid"><span class="cp-nm"><b class="small">${h(x.name)}</b>${isNew ? ` <span class="tag good cp-tag">NOUVEAU</span>` : x.owned ? ` <span class="tag soft cp-tag">ACHETÉ</span>` : ""}</span>
        <span class="xs muted cp-d">${h(desc(B, x))}</span>
        <span class="xs"><b class="num cp-cost">${off ? `<s>${fmt(x.cost)}</s> ${fmt(cost)}` : fmt(cost)}</b> ${h(B.cur().toLowerCase())} ${lim}</span>${x.key && !x.owned ? keySel(s, x) : ""}</div>${btn}</div>`;
  }

  /* ---------- la page ---------- */
  function page(main) {
    const s = S();
    if (!st.shop || !E.cptShop(st.shop)) st.shop = (E.CPT.find((B) => E.cptNew(s, B.id).length) || E.CPT[0]).id;
    const B = E.cptShop(st.shop); const need = B.need ? B.need(s) : null; const O = E.cptOffer(s, B.id);
    const fresh = need ? [] : E.cptNew(s, B.id); const shownNew = new Set(fresh.concat(st.pend && st.pend.sid === B.id ? st.pend.ids : []));
    st.pend = { sid: B.id, ids: [...shownNew] };
    const shops = E.CPT.map((x) => { const n = x.id === B.id ? 0 : newOf(s, x.id).length;
      return `<button class="cp-sh ${x.id === B.id ? "on" : ""}" data-act="cp-shop" data-v="${x.id}" aria-pressed="${x.id === B.id}">${n ? `<span class="navdot" title="De quoi acheter du neuf"></span>` : ""}<span class="cp-shi">${X().IC(x.icon)}</span><b>${h(x.name())}</b><span>${h(x.cur())}</span><span class="cur num">${fmt(x.bal(s))}</span></button>`; }).join("");
    const items = B.items(s);
    const OI = O ? items.find((x) => x.id === O.id) : null;
    const offer = OI && !need ? `<div class="cp-offer"><span class="cp-ic">${icon(B, OI)}</span><div class="cp-mid"><span class="xs cp-gold">Offre de la semaine · −${E.CPT_OFF.pct} %</span><b>${h(OI.name)}</b>
        <span class="xs"><s class="muted">${fmt(OI.cost)}</s> <b class="num">${fmt(O.cost)}</b> ${h(B.cur().toLowerCase())} · ${O.left ? `encore ${O.left} à ce prix cette semaine` : "épuisée cette semaine, retour lundi"}</span>${OI.key ? keySel(s, OI) : ""}</div>
        <button class="btn sm ${O.left && B.bal(s) >= O.cost ? "primary" : ""}" data-act="cp-buy" data-s="${B.id}" data-id="${h(OI.id)}" data-q="1" data-o="1" ${O.left && B.bal(s) >= O.cost && OI.left > 0 ? "" : "disabled"}>Acheter · ${fmt(O.cost)}</button></div>` : "";
    const list = items.slice().sort((a, b) => (a.owned ? 1 : 0) - (b.owned ? 1 : 0) || (shownNew.has(b.id) ? 1 : 0) - (shownNew.has(a.id) ? 1 : 0));
    const go = B.page ? `<button class="btn sm" data-act="nav" data-v="${B.page}">Ouvrir la page</button>` : "";
    main.innerHTML = `<div class="pagehead"><h1>Comptoirs</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s.kamas)}</b> kamas</span></div>
      <div class="stack"><p class="note">Toutes les boutiques du jeu au même endroit, avec ce que tu peux t'offrir. Un point sur le menu quand une monnaie peut acheter quelque chose de neuf.</p>
      <div class="cp-shops">${shops}</div>
      <section class="panel"><div class="phead"><div><h2>${X().IC(B.icon)} ${h(B.name())}</h2><div class="xs muted"><b class="cp-gold num">${fmt(B.bal(s))}</b> ${h(B.cur().toLowerCase())}${OI ? ` · offre de la semaine : ${h(OI.name)} −${E.CPT_OFF.pct} %` : ""}</div></div>${go}</div>
        <div class="pad stack"><span class="xs muted">${h(B.desc || "")}</span>
        ${need ? `<div class="row between cp-need"><span class="small"><b>${h(need)}</b></span><button class="btn sm" data-act="qtab" data-v="align" data-gotab="quests">Alignement</button></div>` : ""}
        ${offer}<div class="cp-items">${list.map((x) => card(s, B, x, shownNew.has(x.id) && !x.owned, O, need)).join("")}</div></div></section></div>`;
  }
  window.DX.pages.comptoirs = page;
  const paint = () => { if (UI().tab === "comptoirs" && S()) X().render(); };
  /* ouvrir la page sur une boutique (anciens boutons « Comptoir » des quêtes, alignement, avis de recherche) */
  function open(sid) { const ui = UI(); if (sid && E.cptShop(sid)) { if (st.shop !== sid) commit(); st.shop = sid; } ui.tab = "comptoirs"; ui.slot = null; X().render(); window.scrollTo(0, 0); }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^cp-/.test(a) || !S()) return;
    const s = S(); const d = t.dataset;
    if (a === "cp-shop") { if (st.shop !== d.v) { commit(); st.shop = d.v; } paint(); return; }
    if (a === "cp-buy") {
      const B = E.cptShop(d.s); if (!B) return; const x = B.items(s).find((i) => i.id === d.id); if (!x) return;
      const q = Math.max(1, +d.q || 1); const k0 = B.bal(s);
      const r = E.cptBuy(s, B.id, x.id, q, x.key ? st.key[x.id] : undefined, d.o === "1");
      if (r) { X().toast(r); return; }
      X().markDirty();
      const nm = x.key && D.DUNGEONS[st.key[x.id]] ? D.DUNGEONS[st.key[x.id]].key : x.name;
      X().toast(`${q > 1 ? q + " × " : ""}${nm} : acheté pour ${fmt(k0 - B.bal(s))} ${B.cur().toLowerCase()} !`, "rare");
      paint();
    }
  });
  document.addEventListener("change", (ev) => { const t = ev.target; if (t.dataset && t.dataset.act === "cp-key") st.key[t.dataset.id] = t.value; });

  window.CPTUI = { open, dot, st };
})();
