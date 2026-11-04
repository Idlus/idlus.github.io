/* ============================================================================
   Saison 1, lot 6 (interface) : la page Album de cartes (Héros › Album de cartes), la tuile Boosters de l'accueil de
   saison et la cérémonie d'ouverture (1A) : le booster se déchire, 5 cartes face cachée dont le dos annonce la rareté,
   on les retourne une à une (ou toutes). Moteur : js/cartes.js. L'Éternel montre l'album de la saison, sans boosters.
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const G = { r: "", miss: false, open: null };
  const art = (c, sh) => (c.art ? `<img class="ca-ill" src="${sh && c.artB ? c.artB : c.art}" alt="" loading="lazy">` : `<img class="ca-mon" src="${c.img}" alt="" loading="lazy">`);
  // une carte (own : à toi, sh : brillante, n : exemplaires)
  function card(c, o) { o = o || {}; const R = E().CARTE_RAR;
    return `<div class="ca r-${c.rar}${o.sh ? " sh" : ""}${o.own === false ? " miss" : ""}${o.big ? " big" : ""}" data-el="${c.el}">
      <div class="ca-art">${art(c, o.sh)}${o.sh ? `<span class="ca-holo"></span>` : ""}</div>
      <div class="ca-foot"><b>${h(c.n)}</b><small>${h(c.d)} · niv. ${c.lvl}</small></div>
      <i class="ca-gem" title="${R[c.rar]}"></i>${o.n > 1 ? `<span class="ca-n">×${o.n}</span>` : ""}${o.nw ? `<span class="ca-new">Nouvelle</span>` : ""}</div>`; }

  /* ---------- tuile de l'accueil de saison ---------- */
  function tile(s) { const e = E(); if (!e.boosterLeft) return ""; const n = e.boosterLeft(s), over = e.s1cOver(s);
    return `<div class="s1t"><span class="xs muted">Boosters de cartes</span><b class="num">${n}</b><span class="xs muted">${e.boosterFree(s) ? "Un offert aujourd'hui" : `Le prochain offert dans ${dur(e.boosterNext())}`} · ${e.cardCount(s)} / ${e.CARTES.length} cartes</span>
      <span class="ca-tbtn">${n && !over ? `<button class="btn sm primary" data-act="ca-open">Ouvrir</button>` : ""}<button class="btn sm" data-act="ca-album">Album</button></span></div>`; }
  const dur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };

  /* ---------- la page ---------- */
  function pageHtml() {
    const s = S(), e = E(), R = e.CARTE_RAR, M = e.cardMine(s), S1 = e.cardOn && e.cardOn(s);
    const L = e.CARTES.filter((c) => (!G.r || c.rar === G.r) && (!G.miss || !M.o[c.id]));
    const cnt = (r) => e.CARTES.filter((c) => c.rar === r && M.o[c.id]).length + " / " + e.CARTES.filter((c) => c.rar === r).length;
    const tabs = [["", "Toutes"]].concat(Object.entries(R).filter(([k]) => k !== "h" || e.CARTE_HEROS.length)).map(([k, n]) => `<button class="${G.r === k ? "on" : ""}" data-act="ca-r" data-v="${k}">${n}${k ? ` <small>${cnt(k)}</small>` : ""}</button>`).join("");
    const pal = e.CARTE_PAL.map(([k, nm]) => `<span class="ca-pal${e.cardCount(s) >= k ? " ok" : ""}">${k} · ${h(nm)}</span>`).join("");
    const head = S1 ? `<div class="ca-top"><span><img src="assets/ui/poussiere.webp" alt=""> <b>${e.cardDust(s)}</b> Poussière d'étoile</span>
        ${e.boosterLeft(s) && !e.s1cOver(s) ? `<button class="btn primary" data-act="ca-open">Ouvrir un booster (${e.boosterLeft(s)})</button>` : `<span class="xs muted">Prochain booster offert dans ${dur(e.boosterNext())}</span>`}</div>`
      : `<p class="small muted">L'album est lié à ton compte : il montre les cartes de ta partie Saison 1. Les boosters s'ouvrent dans la partie de saison.</p>`;
    return `<div class="ca-page"><div class="pagehead"><h1>Album de cartes</h1><span class="small muted">${e.cardCount(s)} / ${e.CARTES.length} cartes · ${e.cardShinyCount(s)} brillante${e.cardShinyCount(s) > 1 ? "s" : ""}</span></div>
      <section class="panel">${head}<div class="ca-pals">${pal}</div>
        <span class="xs muted">Une carte par boss de donjon${e.CARTE_HEROS.length ? ", et la page Héros d'Idlus : les héros des joueurs (1 booster sur 50 en contient un)" : ""}. Un booster offert par jour et un de plus tous les ${e.BOOSTER_DJ} donjons de saison (${e.BOOSTER_DJ_JOUR} par jour au plus). Les doubles donnent de la Poussière d'étoile, qui fabrique une carte manquante. Les cartes ne changent pas la puissance.</span>
        <nav class="subtabs ca-tabs">${tabs}<button class="${G.miss ? "on" : ""}" data-act="ca-miss">Manquantes</button></nav>
        <div class="ca-grid">${L.map((c) => `<button class="ca-cell" data-act="ca-see" data-v="${c.id}">${card(c, { own: !!M.o[c.id], sh: !!M.b[c.id], n: M.o[c.id] })}</button>`).join("") || `<p class="muted">Rien ici.</p>`}</div></section></div>`;
  }
  const page = (main) => { main.innerHTML = pageHtml(); };
  window.DX.pages.album = page;
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "album" && m) page(m); else X().render(); };

  function see(id) { const s = S(), e = E(), c = e.carte(id), M = e.cardMine(s); if (!c) return; const own = !!M.o[id], S1 = e.cardOn && e.cardOn(s);
    const p = e.CARTE_CRAFT[c.rar], ok = S1 && !own && e.cardDust(s) >= p;
    X().openSheet(`<div class="ca-see">${card(c, { own, sh: !!M.b[id], big: 1 })}
      <div class="stack"><h2>${h(c.n)}</h2><span class="small">${h(c.d)} · niveau ${c.lvl} · ${e.CARTE_RAR[c.rar]}</span>
      <span class="small muted">${own ? `Tu l'as en ${M.o[id]} exemplaire${M.o[id] > 1 ? "s" : ""}${M.b[id] ? `, dont ${M.b[id]} brillante${M.b[id] > 1 ? "s" : ""}` : ""}.` : "Pas encore dans ton album : elle sort des boosters."}</span>
      ${S1 && !own ? `<button class="btn${ok ? " primary" : ""}" data-act="ca-craft" data-v="${id}"${ok ? "" : " disabled"}>Fabriquer · ${p} Poussières d'étoile</button>` : ""}
      ${c.art ? "" : `<span class="xs muted">Illustration de saison à venir : la carte montre le boss en attendant.</span>`}
      <button class="btn" data-act="closesheet">Fermer</button></div></div>`); }

  /* ---------- la cérémonie du booster ---------- */
  function ceremony() {
    const s = S(), e = E(); const o = e.boosterOpen(s); if (typeof o === "string") { X().toast(o); return; }
    X().markDirty(); G.open = { L: o, up: 0 };
    let el = document.querySelector(".ca-cer"); if (el) el.remove();
    el = document.createElement("div"); el.className = "ca-cer"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Ouverture du booster");
    el.innerHTML = `<div class="ca-pack" data-act="ca-tear"><span class="ca-pk-t">Saison 1</span><img src="assets/s1/ca/booster.webp" alt=""><b>Booster de cartes</b><small>Touche pour ouvrir</small></div>
      <div class="ca-row"></div><div class="ca-cbar"></div>`;
    document.body.appendChild(el);
  }
  function tear() { const el = document.querySelector(".ca-cer"); if (!el || !G.open) return; const e = E();
    el.querySelector(".ca-pack").classList.add("torn");
    el.querySelector(".ca-row").innerHTML = G.open.L.map((x, i) => { const c = e.carte(x.id);
      return `<button class="ca-flip r-${c.rar}${x.sh ? " sh" : ""}" data-act="ca-flip" data-i="${i}" style="--d:${i * 90}ms"><span class="ca-back"><i></i></span><span class="ca-face">${card(c, { sh: x.sh, nw: x.nw })}${x.pd ? `<small class="ca-pd">+${x.pd} poussière</small>` : ""}</span></button>`; }).join("");
    bar(); }
  function bar() { const el = document.querySelector(".ca-cer"); if (!el || !G.open) return; const e = E(), s = S(); const all = G.open.up >= G.open.L.length;
    const nw = G.open.L.filter((x) => x.nw).length, pd = G.open.L.reduce((a, x) => a + x.pd, 0), sh = G.open.L.some((x) => x.sh);
    el.querySelector(".ca-cbar").innerHTML = all ? `<span class="small">${sh ? "✦ Carte brillante ! " : ""}${nw} nouvelle${nw > 1 ? "s" : ""}${pd ? ` · +${pd} Poussière d'étoile` : ""}</span>
        ${e.boosterLeft(s) && !e.s1cOver(s) ? `<button class="btn primary" data-act="ca-open">Encore un (${e.boosterLeft(s)})</button>` : ""}<button class="btn" data-act="ca-close">Fermer</button>`
      : `<button class="btn" data-act="ca-all">Tout retourner</button>`; }
  function flip(b) { if (!b || b.classList.contains("up") || !G.open) return; b.classList.add("up"); G.open.up++; if (G.open.up >= G.open.L.length) bar(); }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^ca-/.test(t.dataset.act) || !S()) return;
    const a = t.dataset.act;
    if (a === "ca-open") { X().closeSheet && X().closeSheet(); ceremony(); return; }
    if (a === "ca-tear") { tear(); return; }
    if (a === "ca-flip") { flip(t); return; }
    if (a === "ca-all") { document.querySelectorAll(".ca-flip:not(.up)").forEach((b, i) => setTimeout(() => flip(b), i * 120)); return; }
    if (a === "ca-close") { const el = document.querySelector(".ca-cer"); if (el) el.remove(); G.open = null; repaint(); return; }
    if (a === "ca-album") { window.DX.go("album"); return; }
    if (a === "ca-r") { G.r = t.dataset.v; repaint(); return; }
    if (a === "ca-miss") { G.miss = !G.miss; repaint(); return; }
    if (a === "ca-see") { see(t.dataset.v); return; }
    if (a === "ca-craft") { const err = E().cardCraft(S(), t.dataset.v); if (err) { X().toast(err); return; } X().markDirty(); X().toast("Carte fabriquée : elle rejoint l'album."); X().closeSheet(); repaint(); }
  });
  window.CARTEUI = { tile, card, pageHtml };
})();
