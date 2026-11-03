/* ============================================================================
   Saison 1, lot 3 : la page Garde-robe (Héros › Garde-robe) et ce qui se voit sur la carte du héros (aura, décor,
   compagnon) et à la fin d'un donjon (effet de victoire). Moteur : js/garderobe.js. Toutes les parties y ont accès ;
   la partie de saison y ajoute les cosmétiques de saison et les exclusifs de l'Éternel (9A).
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const RN = () => E().GR_RAR;
  const TABS = [["tenue", "Tenue"], ["cadre", "Cadres"], ["orn", "Ornements"], ["titre", "Titres"], ["aura", "Auras"], ["shield", "Boucliers"], ["comp", "Compagnon"], ["bg", "Décor"], ["vic", "Victoire"], ["pcol", "Pseudo"]];
  const G = { tab: "aura", cid: null, q: "" };
  const hero = () => { const s = S(); return s.chars.find((c) => c.id === G.cid) || s.chars.find((c) => c.id === UI().cid) || s.chars[0]; };

  /* ---------- sur la carte du héros ---------- */
  function back(c) { const s = S(), e = E(); if (!s || !e.grWorn) return ""; const w = e.grWorn(s, c); const d = w.bg && e.grDecor(s, w.bg);
    return `${d ? `<span class="gr-bg" style="background-image:url(${d.url})"></span>` : ""}${w.aura ? `<span class="gr-aura gr-a-${w.aura}"></span>` : ""}`; }
  function front(c) { const s = S(), e = E(); if (!s || !e.grWorn) return ""; const w = e.grWorn(s, c); const P = w.comp && (e.PETS || {})[w.comp];
    return P ? `<img class="gr-comp" src="assets/p/${P.icon}.webp" alt="" loading="lazy">` : ""; }

  /* ---------- la page ---------- */
  const card = (o) => `<button class="gr-it r-${o.rar}${o.on ? " on" : ""}${o.ok ? "" : " lock"}" data-act="${o.ok ? "gr-set" : "gr-where"}" data-k="${o.k}" data-v="${h(o.id)}" data-tip="${h(o.n + " · " + RN()[o.rar] + (o.ok ? "" : " · à débloquer : " + o.req))}">
      <span class="gr-pic">${o.pic || ""}</span><b>${h(o.n)}</b><small>${o.ok ? RN()[o.rar] : "🔒 " + h(o.req)}</small></button>`;
  const none = (k, on, n) => `<button class="gr-it r-c${on ? " on" : ""}" data-act="gr-set" data-k="${k}" data-v=""><span class="gr-pic">∅</span><b>${n || "Aucun"}</b><small>rien de montré</small></button>`;
  const sortOk = (L) => L.sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0));
  function list(s, c) {
    const e = E(), w = e.grWorn(s, c), q = G.q.toLowerCase(), f = (L) => (q ? L.filter((o) => o.n.toLowerCase().includes(q)) : L);
    switch (G.tab) {
      case "aura": return none("aura", !w.aura) + Object.entries(e.GR_AURAS).map(([id, a]) => card({ k: "aura", id, n: a.n, rar: a.rar, req: a.req, ok: a.ok(s), on: w.aura === id, pic: `<span class="gr-aura gr-a-${id} mini"></span>` })).join("");
      case "vic": return Object.entries(e.GR_VIC).map(([id, a]) => card({ k: "vic", id, n: a.n, rar: a.rar, req: a.req, ok: a.ok(s), on: w.vic === id, pic: `<span class="gr-vfx gr-v-${id} mini"><i></i><i></i><i></i><i></i><i></i></span>` })).join("");
      case "pcol": { const pc = e.grPcol(s); return none("pcol", !pc, "Couleur normale") + Object.entries(e.GR_PCOL).map(([id, a]) => card({ k: "pcol", id, n: a.n, rar: a.rar, req: a.req, ok: a.ok(s), on: pc === id, pic: `<span class="gr-pc gr-pc-${id}"><b>${h(s.name || "Pseudo")}</b></span>` })).join(""); }
      case "shield": return none("shield", !w.shield) + sortOk(f(e.GR_SHIELDS.map((b) => ({ k: "shield", id: b.id, n: b.n, rar: b.rar, req: e.grShieldReq(b), ok: e.grShieldOk(s, b), on: w.shield === b.id, pic: `<img src="assets/i/${b.ic}.png" alt="" loading="lazy">` })))).map(card).join("");
      case "comp": { const own = new Set(e.grComps(s).map((x) => x.id)); return none("comp", !w.comp) + sortOk(f(Object.entries(e.PETS || {}).map(([id, P]) => ({ k: "comp", id, n: P.name, rar: P.gold || P.fam === "l" ? "l" : P.kind === "monti" ? "e" : "r", req: "Obtenir ce familier", ok: own.has(id), on: w.comp === id, pic: `<img src="assets/p/${P.icon}.webp" alt="" loading="lazy">` })))).map(card).join(""); }
      case "bg": return none("bg", !w.bg) + sortOk(f(e.grDecors(s).map((d) => ({ k: "bg", id: d.id, n: d.n, rar: d.rar, req: d.req, ok: d.ok, on: w.bg === d.id, pic: `<img class="gr-bgpic" src="${d.url}" alt="" loading="lazy">` })))).map(card).join("");
      case "titre": { const own = e.titles(s); return none("titre", !c.title) + f(own.map((t) => ({ k: "titre", id: t, n: t, rar: e.titleRar(t), req: "", ok: true, on: c.title === t, pic: `<span class="gr-ttl gr-t-${e.titleRar(t)}">${h(t)}</span>` }))).map(card).join("") + (own.length ? "" : `<p class="small muted">Les succès, les quêtes et les classements donnent des titres.</p>`); }
      case "orn": return none("orn", !c.orn) + sortOk(f(Object.keys(e.ORN).map((id) => ({ k: "orn", id, n: e.ORN[id].name(s), rar: id === "pionnier" ? "l" : /^reg_/.test(id) ? "r" : "e", req: e.ORN[id].req || "voir la page Succès", ok: e.ornUnlocked(s, id), on: c.orn === id, pic: /^reg_/.test(id) ? `<img src="assets/ui/orn/orn_${id.slice(4)}.svg" alt="" loading="lazy">` : "✦" })))).map(card).join("");
      case "cadre": return none("cadre", !c.frame, "Cadre du niveau") + Object.keys(e.SFRAMES).map((id) => { const F = e.SFRAMES[id]; return card({ k: "cadre", id, n: F.name(s), rar: id === "pionnier" || id === "stasis" ? "l" : "e", req: F.req, ok: e.sframeOk(s, id), on: c.frame === id, pic: "▣" }); }).join("");
      default: return "";
    }
  }
  function pageHtml() {
    const s = S(), e = E(), c = hero(); if (!c) return "";
    const n = e.grCount(s);
    const cnt = { aura: n.aura, vic: n.vic, pcol: n.pcol, shield: n.shield, comp: n.comp, bg: n.bg };
    const heroes = s.chars.map((x) => `<button class="gr-hb${x.id === c.id ? " on" : ""}" data-act="gr-hero" data-v="${x.id}">${X().lookImg(x, "gr-hl", { bare: false })}<span>${h(x.name)}</span></button>`).join("");
    const tabs = TABS.map(([id, nm]) => `<button data-act="gr-tab" data-v="${id}" aria-pressed="${G.tab === id}">${nm}${cnt[id] ? ` <span class="num">${cnt[id][0]}/${cnt[id][1]}</span>` : ""}</button>`).join("");
    const search = ["shield", "comp", "bg", "orn", "titre"].includes(G.tab) ? `<input class="gr-q" type="search" placeholder="Chercher…" value="${h(G.q)}" data-act="gr-q">` : "";
    const body = G.tab === "tenue" ? `<div class="gr-tenue"><p class="small">Tête, couleurs, teinture, coiffe et cape se choisissent dans la fenêtre Apparence du héros.</p><button class="btn primary" data-act="gr-look">Ouvrir l'apparence de ${h(c.name)}</button></div>`
      : `${G.tab === "vic" ? `<div class="row gr-vtog"><span class="small grow">L'effet joue à la fin d'un donjon gagné, sur l'écran de combat, une fois par minute au plus.</span><button class="btn sm" data-act="gr-vicoff">${s.settings.grVic === false ? "Réactiver l'effet" : "Couper l'effet"}</button></div>` : ""}<div class="gr-grid">${list(s, c)}</div>`;
    const extra = e.isS1c && e.isS1c(s) && s.s1c.xcos ? `<p class="xs muted">Saison 1 : tes titres, cadres et ornements exclusifs de l'Éternel se portent aussi ici.</p>` : "";
    return `<div class="gr-page"><div class="pagehead"><h1>Garde-robe</h1></div>
      <div class="gr-heroes">${heroes}</div>
      <div class="gr-wrap"><aside class="gr-prev panel"><div class="gr-stage">${back(c)}${X().lookImg(c, "gr-big")}${front(c)}</div>
        <div class="gr-card">${X().heroCard(c)}</div><span class="xs muted">Aucun cosmétique ne change les caractéristiques.</span>${extra}</aside>
      <section class="panel gr-main"><nav class="subtabs gr-tabs">${tabs}</nav>${search}${body}</section></div></div>`;
  }
  function page(main) { main.innerHTML = pageHtml(); }
  window.DX.pages.garde = (main) => page(main);
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "garde" && m) page(m); };

  /* ---------- effet de victoire (6A) : à la fin d'un donjon gagné, quand l'écran est ouvert ---------- */
  let lastFx = 0;
  function victory(c) {
    const s = S(), e = E(); if (!s || !c || (s.settings && s.settings.grVic === false) || document.visibilityState !== "visible") return;
    if (!["combat", "dungeons"].includes(UI().tab) || Date.now() - lastFx < 60000) return; lastFx = Date.now(); // pas plus d'une fois par minute, seulement sous les yeux
    const v = e.grWorn(s, c).vic; const el = document.createElement("div"); el.className = `gr-win gr-v-${v}`; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<div class="gr-wh">${X().lookImg(c, "gr-wl")}</div><div class="gr-vfx gr-v-${v}">${"<i></i>".repeat(18)}</div>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }
  { const e = E(); const emit0 = e.emit; e.emit = function (s, type, data) { const r = emit0.apply(this, arguments);
      if (type === "dungeon" && s === S() && data && !data.offline) { const c = s.chars.find((x) => x.inTeam) || s.chars[0]; setTimeout(() => victory(c), 300); }
      return r; }; }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^gr-/.test(t.dataset.act) || !S()) return;
    const s = S(), e = E(), a = t.dataset.act, c = hero();
    if (a === "gr-tab") { G.tab = t.dataset.v; G.q = ""; repaint(); return; }
    if (a === "gr-hero") { G.cid = +t.dataset.v || t.dataset.v; repaint(); return; }
    if (a === "gr-vicoff") { s.settings.grVic = s.settings.grVic === false; X().markDirty(); repaint(); return; }
    if (a === "gr-look") { X().lookSheet(c); return; }
    if (a === "gr-where") { X().toast("À débloquer : " + (t.dataset.tip || "").split("à débloquer : ").pop()); return; }
    if (a === "gr-set") { const k = t.dataset.k, v = t.dataset.v || null; let err = null;
      if (k === "titre") { if (v && !e.titles(s).includes(v)) err = "Titre pas encore obtenu."; else c.title = v; }
      else if (k === "orn") err = e.setOrn(s, c.id, v);
      else if (k === "cadre") err = e.setFrame(s, c.id, v);
      else err = e.grSet(s, c.id, k, v);
      if (err) { X().toast(err); return; }
      X().markDirty(); X().render(); repaint(); }
  });
  document.addEventListener("input", (ev) => { const t = ev.target; if (!t.matches || !t.matches("[data-act=gr-q]")) return; G.q = t.value;
    const g = document.querySelector(".gr-grid"); if (g) { g.innerHTML = list(S(), hero()); } });
  window.GRUI = { back, front, victory, pageHtml };
})();
