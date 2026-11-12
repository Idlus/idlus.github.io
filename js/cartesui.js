/* ============================================================================
   Saison 1, lot 6 (interface) : la page Album de cartes (Héros › Album de cartes), la tuile Boosters de l'accueil de
   saison et la cérémonie d'ouverture (1A) : le booster se déchire, 5 cartes face cachée dont le dos annonce la rareté,
   on les retourne une à une (ou toutes). Moteur : js/cartes.js. L'Éternel montre l'album de la saison, sans boosters.
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const G = { f: "", nw: null, open: null };
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

  /* ---------- la page (2.2.6, refonte validée par Mathis le 04/11 : 1A 2A 3A 4A 5A 6A) ----------
     1A bandeau compact (compteur, barre des paliers, Poussière, booster et le suivant, règles derrière « ? »),
     2A une section par rareté + une ligne de filtres, 3A cartes manquantes en gris et ⚒ si la Poussière suffit,
     4A fiche complète qu'on feuillette, 5A cartes plus petites (4 par ligne au téléphone), 6A « Nouvelle » jusqu'à la sortie de la page. */
  const RC = { c: "#9aa3ad", r: "#3f8fd8", e: "#a463e0", l: "#f0b43c", h: "#ff6fa8" };
  const FIL = [["", "Toutes"], ["miss", "Manquantes"], ["new", "Nouvelles"], ["dbl", "Doubles"], ["sh", "Brillantes"]];
  const fresh = () => G.nw || [];
  function cell(c, M, dust) { const e = E(), own = !!M.o[c.id];
    let x = card(c, { own, sh: !!M.b[c.id], n: M.o[c.id], nw: own && fresh().includes(c.id) });
    if (!own && dust !== null && dust >= e.CARTE_CRAFT[c.rar]) x = x.replace('<div class="ca-foot">', `<span class="ca-fab" title="Fabricable avec ta Poussière d'étoile">⚒</span><div class="ca-foot">`);
    return `<button class="ca-cell" data-act="ca-see" data-v="${c.id}" aria-label="${h(c.n)}${own ? "" : " (manquante)"}">${x}</button>`; }
  function pageHtml() {
    const s = S(), e = E(), R = e.CARTE_RAR, M = e.cardMine(s), S1 = e.cardOn && e.cardOn(s);
    if (S1) { const t = e.cardNewTake(s); if (t.length) { G.nw = fresh().filter((id) => !t.includes(id)).concat(t); X().markDirty(); } }
    const n = e.cardCount(s), T = e.CARTES.length, P = e.CARTE_PAL, nx = P.find(([k]) => n < k), dust = S1 ? e.cardDust(s) : null;
    const ok = (c) => G.f === "miss" ? !M.o[c.id] : G.f === "new" ? fresh().includes(c.id) : G.f === "dbl" ? M.o[c.id] > 1 : G.f === "sh" ? !!M.b[c.id] : true;
    const cnt = { miss: T - n, new: fresh().length, dbl: e.CARTES.filter((c) => M.o[c.id] > 1).length, sh: e.cardShinyCount(s) };
    const bst = S1 ? (() => { const bl = e.boosterLeft(s), over = e.s1cOver(s), dj = e.cardDjDone ? e.cardDjDone(s) : null;
      return `<div class="ca-bst"><span class="ca-dust"><img src="assets/ui/poussiere.webp" alt=""><b>${dust}</b> Poussière d'étoile <button class="ca-q" data-act="ca-rules" aria-label="Règles de l'album" title="Règles de l'album">?</button></span>
        ${bl && !over ? `<button class="btn primary" data-act="ca-open">Ouvrir un booster (${bl})</button>` : ""}${(() => { const p = e.cardReduceAllPreview(s); return p.n ? `<button class="btn" data-act="ca-redall">${G.ra ? `Confirmer : ${p.n} double${p.n > 1 ? "s" : ""} → +${p.pd}` : `Tout réduire (${p.n} double${p.n > 1 ? "s" : ""} · +${p.pd})`}</button>` : ""; })()}
        <span class="xs muted">${over ? "La saison est finie : l'album reste, les boosters s'arrêtent." : `${e.boosterFree(s) ? "Booster du jour disponible" : `Prochain offert dans ${dur(e.boosterNext())}`}${dj === null ? "" : e.boosterDjLeft(s) ? ` · donjons ${dj} / ${e.BOOSTER_DJ} pour le suivant` : " · boosters de donjon du jour déjà gagnés"}`}</span></div>`; })()
      : `<div class="ca-bst"><span class="xs muted">L'album est lié à ton compte : il montre les cartes de ta partie de saison, où s'ouvrent les boosters. <button class="ca-q" data-act="ca-rules" aria-label="Règles de l'album">?</button></span></div>`;
    const head = `<div class="ca-hd"><div><div class="ca-cnt"><b>${n} / ${T}</b><span class="small muted">cartes · ${e.cardShinyCount(s)} brillante${e.cardShinyCount(s) > 1 ? "s" : ""}</span></div>
        <div class="ca-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${T}" aria-valuenow="${n}"><i style="width:${(n / T) * 100}%"></i>${P.map(([k, nm]) => `<span class="ca-mk${n >= k ? " ok" : ""}" style="left:${(k / T) * 100}%" title="${k} cartes : titre « ${h(nm)} »"><small>${k}</small></span>`).join("")}</div>
        <span class="xs muted">${nx ? `Encore <b>${nx[0] - n}</b> carte${nx[0] - n > 1 ? "s" : ""} pour le titre « ${h(nx[1])} »` : "Album complet : titre « Maître de l'Album » !"}</span></div>${bst}</div>`;
    const chips = FIL.filter(([k]) => k !== "new" || cnt.new || G.f === "new").map(([k, nm]) => `<button aria-pressed="${G.f === k}" data-act="ca-f" data-v="${k}">${nm}${k && cnt[k] ? ` <small>${cnt[k]}</small>` : ""}</button>`).join("");
    const secs = Object.keys(R).map((r) => { const C = e.CARTES.filter((c) => c.rar === r); if (!C.length) return ""; const L = C.filter(ok); if (!L.length) return "";
      const k = C.filter((c) => M.o[c.id]).length;
      return `<section class="ca-sec" style="--rc:${RC[r]}"><div class="ca-sh"><b>${R[r]}</b><span class="ca-sbar"><i style="width:${(k / C.length) * 100}%"></i></span><span class="xs muted">${k} / ${C.length}</span></div>
        <div class="ca-grid">${L.map((c) => cell(c, M, dust)).join("")}</div></section>`; }).join("");
    return `<div class="ca-page"><div class="pagehead"><h1>Album de cartes</h1></div>
      <section class="panel">${head}<nav class="subtabs ca-chips">${chips}</nav>${secs || `<p class="muted">Aucune carte ici.</p>`}</section></div>`;
  }
  const page = (main) => { main.innerHTML = pageHtml(); };
  window.DX.pages.album = page;
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "album" && m) page(m); else X().render(); };
  // 6A : les « Nouvelle » s'effacent quand on quitte la page
  document.addEventListener("click", () => setTimeout(() => { if (G.nw && UI() && UI().tab !== "album") G.nw = null; }, 0));

  function rules() { const e = E();
    X().openSheet(`<div class="stack"><h2>L'album de cartes</h2>
      <p class="small">Une carte par boss de donjon${e.CARTE_HEROS.length ? ", et la page Héros d'Idlus : les héros des joueurs (1 booster sur 50 en contient un)" : ""}.</p>
      <p class="small">Un booster offert par jour, et un de plus tous les ${e.BOOSTER_DJ} donjons de la partie de saison (${e.BOOSTER_DJ_JOUR} par jour au plus). 5 cartes par booster, la 5e rare ou mieux ; chaque carte a 1 chance sur 100 d'être brillante.</p>
      <p class="small">Un double reste une carte : tu choisis de le réduire en Poussière d'étoile (« Réduire » sur sa fiche, ou « Tout réduire ») ou de le vendre. La Poussière fabrique une carte manquante (le ⚒ doré montre celles que tu peux déjà fabriquer). Les cartes ne changent pas la puissance.</p>
      <p class="small">Bourse aux cartes : les doubles se vendent à l'Hôtel de vente (catégorie Cartes de collection) ou s'échangent avec un joueur, après ${e.CARD_TRADE_MIN} boosters ouverts. Le dernier exemplaire reste toujours dans l'album, et ta propre carte de Héros ne s'échange pas. Une carte reçue compte pour l'album, les paliers et les titres, mais ne donne jamais de Poussière. Pas d'échange de cartes en Ironman ni depuis l'Éternel.</p>
      <p class="small">Paliers : ${e.CARTE_PAL.map(([k, nm]) => `${k} cartes « ${h(nm)} »`).join(", ")}.</p>
      <button class="btn" data-act="closesheet">Fermer</button></div>`); }
  function see(id) { const s = S(), e = E(), c = e.carte(id), M = e.cardMine(s); if (!c) return; const own = !!M.o[id], S1 = e.cardOn && e.cardOn(s);
    const L = e.CARTES, i = L.indexOf(c), p = e.CARTE_CRAFT[c.rar], ok = S1 && !own && e.cardDust(s) >= p, dbl = own ? M.o[id] - 1 : 0;
    const dg = (window.DATA && window.DATA.DUNGEONS || {})[id], R = e.CARTE_RAR[c.rar];
    const MK = !!(window.MARKET && window.MARKET.sellCard && !(window.MARKET.closed && window.MARKET.closed())), lock = S1 && e.cardTradeLock ? e.cardTradeLock(s) : null;
    const rows = [[c.rar === "h" ? "Héros" : "Boss", c.rar === "h" ? h(c.d) : `${h(c.n)}, niveau ${c.lvl}`]];
    if (dg) rows.push(["Donjon", h(c.d)]);
    rows.push(["Dans ton album", own ? `${M.o[id]} exemplaire${M.o[id] > 1 ? "s" : ""}${M.b[id] ? " · brillante ✦" : ""}` : "pas encore"]);
    const DB = S1 ? [false, true].map((sh) => ({ sh, n: e.cardDbl(s, id, sh), r: e.cardDustable(s, id, sh), pd: e.cardDustOf(id, sh), key: e.cardKey(id, sh) })).filter((x) => x.n > 0) : [];
    if (own) rows.push(["Doubles", DB.length ? DB.map((x) => `${x.n}${x.sh ? " brillante" + (x.n > 1 ? "s" : "") : ""}${x.r < x.n ? ` (${x.n - x.r} sans Poussière)` : ""}`).join(" · ") : dbl && !S1 ? `${dbl}` : "aucun"]);
    else rows.push(["Fabriquer", c.apart ? "jamais : offerte par Xener avec un code cadeau" : c.rar === "h" ? "dans les boosters seulement" : `${p} Poussières d'étoile${S1 ? ` (tu en as ${e.cardDust(s)})` : ""}`]);
    rows.push(["Brillante", M.b[id] ? "obtenue ✦" : c.apart ? (c.artB ? "un seul exemplaire au monde, offert par Xener" : "aucune") : "1 chance sur 100 par carte de booster"]);
    X().openSheet(`<div class="ca-see">${card(c, { own, sh: !!M.b[id], big: 1 })}
      <div class="stack"><h2>${h(c.n)}</h2><span><span class="ca-tag" style="--rc:${RC[c.rar]}">${R}</span> <span class="xs muted">carte ${i + 1} / ${L.length}</span></span>
      <div class="ca-kv">${rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join("")}</div>
      ${S1 && !own && c.rar !== "h" ? `<button class="btn${ok ? " primary" : ""}" data-act="ca-craft" data-v="${id}"${ok ? "" : " disabled"}>Fabriquer · ${p} Poussières d'étoile</button>` : ""}
      ${DB.map((x) => `<div class="ca-dbl"><b class="small">${x.sh ? "Double brillant ✦" : "Double"}${x.n > 1 ? ` ×${x.n}` : ""}</b><span class="row">${x.r ? `<button class="btn sm" data-act="ca-red" data-v="${id}" data-sh="${x.sh ? 1 : ""}">Réduire 1 · +${x.pd} Poussières</button>` : ""}${MK && !lock ? `<button class="btn sm primary" data-act="ca-sell" data-v="${x.key}">Vendre à l'HdV</button><button class="btn sm" data-act="ca-trade">⇄ Proposer à un joueur</button>` : ""}</span></div>`).join("")}
      ${DB.length && MK && lock ? `<span class="xs muted">${h(lock)}</span>` : ""}
      ${S1 && MK && !own && !c.apart ? `<button class="btn" data-act="ca-buy" data-v="${id}">Acheter à l'HdV</button>` : ""}
      ${dg ? `<button class="btn" data-act="dgopen" data-id="${id}">Voir le donjon</button>` : ""}
      ${c.art ? "" : `<span class="xs muted">Illustration de saison à venir : la carte montre le boss en attendant.</span>`}
      <div class="ca-nav"><button class="btn" data-act="ca-see" data-v="${L[(i - 1 + L.length) % L.length].id}">‹ Précédente</button><button class="btn" data-act="ca-see" data-v="${L[(i + 1) % L.length].id}">Suivante ›</button></div>
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
      return `<button class="ca-flip r-${c.rar}${x.sh ? " sh" : ""}" data-act="ca-flip" data-i="${i}" style="--d:${i * 90}ms"><span class="ca-back"><i></i></span><span class="ca-face">${card(c, { sh: x.sh, nw: x.nw })}${x.dbl ? `<small class="ca-pd">double</small>` : x.pd ? `<small class="ca-pd">+${x.pd} poussière</small>` : ""}</span></button>`; }).join("");
    bar(); }
  function bar() { const el = document.querySelector(".ca-cer"); if (!el || !G.open) return; const e = E(), s = S(); const all = G.open.up >= G.open.L.length;
    const nw = G.open.L.filter((x) => x.nw).length, pd = G.open.L.reduce((a, x) => a + (x.pd || 0), 0), sh = G.open.L.some((x) => x.sh), db = G.open.L.filter((x) => x.dbl).length;
    el.querySelector(".ca-cbar").innerHTML = all ? `<span class="small">${sh ? "✦ Carte brillante ! " : ""}${nw} nouvelle${nw > 1 ? "s" : ""}${pd ? ` · +${pd} Poussière d'étoile` : ""}${db ? ` · ${db} double${db > 1 ? "s" : ""} : réduis-les ou vends-les depuis l'album` : ""}</span>
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
    if (a === "ca-f") { G.f = G.f === t.dataset.v ? "" : t.dataset.v; repaint(); return; }
    if (a === "ca-rules") { rules(); return; }
    if (a === "ca-see") { see(t.dataset.v); return; }
    if (a === "ca-red") { const g = E().cardReduce(S(), t.dataset.v, !!t.dataset.sh, 1); if (typeof g !== "number") { X().toast(g); return; } X().markDirty(); X().toast(`+${g} Poussière d'étoile.`); see(t.dataset.v); return; }
    if (a === "ca-redall") { if (!G.ra) { G.ra = 1; repaint(); setTimeout(() => { if (G.ra) { G.ra = 0; if (UI().tab === "album") repaint(); } }, 5000); return; }
      G.ra = 0; const r = E().cardReduceAll(S()); if (r.n) { X().markDirty(); X().toast(`${r.n} double${r.n > 1 ? "s" : ""} réduit${r.n > 1 ? "s" : ""} : +${r.pd} Poussière d'étoile.`); } repaint(); return; }
    if (a === "ca-sell" || a === "ca-buy") { if (!window.MARKET) return; X().closeSheet(); if (a === "ca-sell") window.MARKET.sellCard(t.dataset.v); else window.MARKET.buyCard(t.dataset.v); window.DX.go("hdv"); window.scrollTo(0, 0); return; }
    if (a === "ca-trade") { if (!window.MARKET) return; X().closeSheet(); window.MARKET.M.tPick = "card"; window.MARKET.tradeAsk(""); return; }
    if (a === "ca-craft") { const err = E().cardCraft(S(), t.dataset.v); if (err) { X().toast(err); return; } X().markDirty(); X().toast("Carte fabriquée : elle rejoint l'album."); X().closeSheet(); repaint(); }
  });
  window.CARTEUI = { tile, card, pageHtml };
})();
