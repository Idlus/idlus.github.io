/* ============================================================================
   Saison 1, lot 5 (interface) : blason de guilde (forme + emblème + 2 couleurs) partout où un emblème de guilde s'affiche,
   et le créateur de blason dans la fondation et les réglages de la guilde (js/guilds.js). Moteur : js/saisonsoc.js.
   Le blason voyage dans le champ « ic » de la guilde (« bl_ » + 3 lettres) : aucun changement du serveur. Les emblèmes
   s'affichent à une dizaine d'endroits (guilde, alliance, chasse, classements, profils) : chaque image d'un blason
   (sa forme, avec « #bl_… » au bout : window.gIco dans js/data.js) est remplacée à l'affichage par les calques du blason.
   ========================================================================== */
(function () {
  "use strict";
  const E = () => window.DX && window.DX.E;
  const layers = (ic, col1) => { const e = E(); const c = e && e.crestOf(ic); if (!c) return "";
    const s = `assets/s1/bl/s${c.shape + 1}.webp`, m = `assets/s1/bl/e${c.emb + 1}.webp`;
    const abs = (u) => new URL(u, document.baseURI).href; // la variable CSS est lue depuis css/garderobe.css : chemin complet
    return `<span class="crest" style="--c1:${col1 || "#8cc63f"};--c2:${c.col2}"><i class="cs" style="--m:url(${abs(s)})"><img src="${s}" alt=""></i><i class="ce" style="--m:url(${abs(m)})"><img src="${m}" alt=""></i></span>`; };
  window.crestHtml = layers;
  const RE = /#(bl_[a-h][a-x][a-p])$/;
  function up(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('img[src*="#bl_"]').forEach((im) => {
      const m = RE.exec(im.getAttribute("src") || ""); if (!m) return; const box = im.closest(".gemb, .pc-chip") || im.parentElement; if (!box || box.dataset.crest === m[1]) return;
      const col = getComputedStyle(box).getPropertyValue("--gc").trim() || "#8cc63f";
      if (box.classList.contains("gemb")) { box.classList.add("gcrest"); box.dataset.crest = m[1]; box.innerHTML = layers(m[1], col); }
      else { const sp = document.createElement("span"); sp.className = "gemb gcrest mini"; sp.dataset.crest = m[1]; sp.innerHTML = layers(m[1], col); im.replaceWith(sp); }
    });
  }
  new MutationObserver((ms) => ms.forEach((x) => x.addedNodes.forEach((n) => { if (n.nodeType === 1) up(n.parentElement || n); }))).observe(document.documentElement, { childList: true, subtree: true });

  /* créateur de blason (fondation et réglages de la guilde) : html à poser sous le choix des icônes */
  const F = { open: false };
  function builder(f) {
    const e = E(); if (!e || !e.crestOf) return ""; const c = e.crestOf(f.ic) || { shape: 0, emb: 0, c2: 11 };
    if (!F.open && !e.crestOf(f.ic)) return `<button class="btn sm" data-act="gc-open">Créer un blason (forme, emblème, 2 couleurs)</button>`;
    const cur = (k, i) => (c[k] === i ? " on" : "");
    return `<div class="gc-b"><b class="small">Blason</b>
      <div class="gc-row">${e.CREST_SHAPES.map((n, i) => `<button class="gc-o${cur("shape", i)}" data-act="gc-set" data-k="shape" data-v="${i}" title="${n}"><img src="assets/s1/bl/s${i + 1}.webp" alt="${n}"></button>`).join("")}</div>
      <div class="gc-row">${e.CREST_EMB.map((n, i) => `<button class="gc-o${cur("emb", i)}" data-act="gc-set" data-k="emb" data-v="${i}" title="${n}"><img src="assets/s1/bl/e${i + 1}.webp" alt="${n}"></button>`).join("")}</div>
      <span class="xs muted">2e couleur (la 1re est la couleur de la guilde)</span>
      <div class="gpick col">${e.CREST_COLS.map((col, i) => `<button class="${c.c2 === i ? "on" : ""}" data-act="gc-set" data-k="c2" data-v="${i}" style="background:${col}" aria-label="couleur"></button>`).join("")}</div>
      <button class="btn sm" data-act="gc-off">Revenir à une icône simple</button></div>`;
  }
  // appelé par js/guilds.js : renvoie le nouveau code, ou null
  function act(t, f) {
    const e = E(), a = t.dataset.act; if (!/^gc-/.test(a)) return null;
    if (a === "gc-open") { F.open = true; return e.crestCode(0, 0, 11); }
    if (a === "gc-off") { F.open = false; return "dofus"; }
    const c = e.crestOf(f.ic) || { shape: 0, emb: 0, c2: 11 }; c[t.dataset.k] = +t.dataset.v;
    return e.crestCode(c.shape, c.emb, c.c2);
  }
  window.CRESTUI = { builder, act, up };
})();
