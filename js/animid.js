/* Identité des sorts : animation de base de chaque sort (vue Scène) et effets visibles de ses mécaniques.
   Chaque sort lance son motif (flèche, carte, bombe, lance, horloge…) tiré de son nom, dans la couleur de son élément ;
   chaque mécanique (cumul, état, retardement, piège, glyphe, bombe, portail…) a son propre effet quand elle se déclenche.
   Chargé après ui.js et animsorts.js. Les sorts signature (animsorts.js) gardent leur animation faite à la main. */
(function () {
  const K = window.DX && window.DX.anim; if (!K) return;
  const { axMk, axLater, axPt, axRnd, anFoot, axBody, axC } = K;
  const E = window.ENGINE;
  const SVG = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}">${body}</svg>`;
  /* motifs : un dessin par famille de sort */
  const MO = {
    fleche: (c) => SVG(60, 14, `<path d="M2 7h44" stroke="#8a6a3a" stroke-width="3"/><path d="M44 1l14 6-14 6z" fill="${c}"/><path d="M2 7l-0 0M4 2l8 5-8 5M10 2l8 5-8 5" stroke="${c}" stroke-width="2" fill="none"/>`),
    bombe: (c) => SVG(40, 40, `<circle cx="18" cy="24" r="14" fill="#2b2b33" stroke="${c}" stroke-width="2"/><path d="M27 12q5-8 10-6" stroke="#b08a50" stroke-width="3" fill="none"/><circle cx="37" cy="6" r="3.5" fill="#ffd84d"/><circle cx="13" cy="19" r="3" fill="rgba(255,255,255,.35)"/>`),
    piege: (c) => SVG(60, 26, `<path d="M3 22h54" stroke="#5a3d1a" stroke-width="3"/><path d="M6 22L11 6l5 16 5-16 5 16 5-16 5 16 5-16 5 16 5-16 3 16" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`),
    lance: (c) => SVG(80, 14, `<path d="M2 7h58" stroke="#7a5a32" stroke-width="3.5"/><path d="M58 1l20 6-20 6 4-6z" fill="${c}" stroke="#eee" stroke-width="1"/>`),
    epee: (c) => SVG(60, 18, `<path d="M18 9h38l-6-5v10z" fill="${c}" stroke="#fff" stroke-width="1"/><rect x="14" y="2" width="4" height="14" fill="#b8860b"/><rect x="2" y="7" width="12" height="4" rx="2" fill="#6b4a2a"/>`),
    carte: (c) => SVG(26, 36, `<rect x="1" y="1" width="24" height="34" rx="3" fill="#fff8e6" stroke="${c}" stroke-width="2"/><text x="13" y="24" font-size="15" text-anchor="middle" fill="${c}">♦</text>`),
    horloge: (c) => SVG(40, 40, `<circle cx="20" cy="20" r="17" fill="rgba(20,30,60,.6)" stroke="${c}" stroke-width="3"/><path d="M20 20V8M20 20l8 5" stroke="#f1cf6e" stroke-width="2.5" stroke-linecap="round"/>`),
    mot: (c) => SVG(44, 34, `<path d="M4 4h36v20H18l-8 7v-7H4z" fill="#fff" stroke="${c}" stroke-width="2.5"/><text x="22" y="20" font-size="14" font-weight="700" text-anchor="middle" fill="${c}">!</text>`),
    ronce: (c) => SVG(60, 20, `<path d="M2 12q14-12 28 0t28 0" stroke="#4e7a2a" stroke-width="4" fill="none"/><path d="M12 6l3-5M26 13l2 5M40 6l3-5M52 13l2 5" stroke="${c}" stroke-width="2.5"/>`),
    biere: (c) => SVG(34, 38, `<rect x="4" y="8" width="20" height="26" rx="3" fill="#f0a830" stroke="#7a4a10" stroke-width="2"/><path d="M24 14h5a4 4 0 0 1 0 12h-5" fill="none" stroke="#7a4a10" stroke-width="2.5"/><path d="M3 9q5-7 11-2 6-6 11 1" fill="#fff" stroke="#ddd"/>`),
    sang: (c) => SVG(26, 34, `<path d="M13 2C13 2 3 16 3 22a10 10 0 0 0 20 0C23 16 13 2 13 2z" fill="#c0392b" stroke="${c}" stroke-width="1.5"/>`),
    portail: (c) => SVG(40, 40, `<circle cx="20" cy="20" r="15" fill="none" stroke="${c}" stroke-width="4"/><circle cx="20" cy="20" r="8" fill="none" stroke="#bff6ff" stroke-width="2" stroke-dasharray="4 3"/>`),
    rune: (c) => SVG(34, 40, `<path d="M17 2l14 18-14 18L3 20z" fill="${c}" stroke="#fff" stroke-width="1.5"/><path d="M17 10v20M11 20h12" stroke="#fff" stroke-width="2"/>`),
    masque: (c) => SVG(40, 40, `<path d="M4 10q16-8 32 0q0 22-16 26Q4 32 4 10z" fill="#f2e6d0" stroke="${c}" stroke-width="2.5"/><path d="M11 17l6 2-6 2zM29 17l-6 2 6 2z" fill="#222"/>`),
    eau: (c) => SVG(26, 34, `<path d="M13 2C13 2 3 16 3 22a10 10 0 0 0 20 0C23 16 13 2 13 2z" fill="${c}" stroke="#e8f6ff" stroke-width="1.5"/>`),
    os: () => SVG(60, 20, `<path d="M8 4a5 5 0 1 1 3 7h38a5 5 0 1 1 3-7 5 5 0 1 1-3 9H11a5 5 0 1 1-3-9z" fill="#f4ecd8" stroke="#9c8a62" stroke-width="1.5"/>`),
    piece: () => SVG(30, 30, `<circle cx="15" cy="15" r="12" fill="#f1c232" stroke="#a67c00" stroke-width="2.5"/><text x="15" y="20" font-size="12" font-weight="700" text-anchor="middle" fill="#a67c00">K</text>`),
    glyphe: (c) => SVG(40, 40, `<path d="M20 3l15 26H5zM20 37L5 11h30z" fill="none" stroke="${c}" stroke-width="2.5"/>`),
    bete: (c) => SVG(36, 34, `<ellipse cx="18" cy="22" rx="9" ry="8" fill="${c}"/><circle cx="7" cy="12" r="4" fill="${c}"/><circle cx="14" cy="6" r="4" fill="${c}"/><circle cx="22" cy="6" r="4" fill="${c}"/><circle cx="29" cy="12" r="4" fill="${c}"/>`),
    /* repli selon l'élément */
    f: (c) => SVG(30, 40, `<path d="M15 2c6 10 12 14 12 24a12 12 0 0 1-24 0c0-6 4-9 6-14 2 5 4 6 6 7 0-6-2-11 0-17z" fill="${c}" stroke="#ffe08a" stroke-width="1.5"/>`),
    e: (c) => SVG(26, 34, `<path d="M13 2C13 2 3 16 3 22a10 10 0 0 0 20 0C23 16 13 2 13 2z" fill="${c}" stroke="#e8f6ff" stroke-width="1.5"/>`),
    t: (c) => SVG(36, 30, `<path d="M4 24l6-16 12-6 10 10-2 14z" fill="${c}" stroke="#5a3d1a" stroke-width="2"/>`),
    a: (c) => SVG(40, 30, `<path d="M4 18q10-16 30-12-14 2-20 12 10-6 22-2-14 0-22 10" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`),
    n: (c) => SVG(30, 30, `<path d="M15 2l4 9 10 1-8 7 3 10-9-5-9 5 3-10-8-7 10-1z" fill="${c}" stroke="#fff" stroke-width="1"/>`),
  };
  const SIZE = { fleche: [46, 12], lance: [62, 12], epee: [46, 14], ronce: [44, 16], os: [40, 14] };
  const mk = (A, cls, x, y, html, w, h) => { const d = axMk(A, "anid " + cls, x, y); d.style.width = w + "px"; d.style.height = h + "px"; if (html) d.innerHTML = html; return d; };
  const elOf = (def, src) => { const g = E.spellGrade(def, src.lvl); const f = g.fx.find((x) => x.el && x.el !== "best"); return f ? f.el : def.el && def.el !== "best" ? def.el : "n"; };
  /* lancer : le motif du sort vole vers chaque cible et arrive au moment de l'impact */
  window.anId = (F, A, src, sn, def, hits, when) => {
    const id = E.idOf && E.idOf(def); if (!id || !sn || !sn.isConnected) return;
    const el = elOf(def, src), col = axC(el), key = id.motif && MO[id.motif] ? id.motif : el in MO ? el : "n";
    const [w, h] = SIZE[key] || [26, 26]; const a = axPt(A, sn, 0.4);
    const tg = [...new Set(hits.map((f) => f.t))].map((t) => A.nodes[t]).filter(Boolean).slice(0, 3);
    if (!tg.length) { // sort sur soi ou un allié : le motif tourne au-dessus du lanceur
      const d = mk(A, "idaura", a.x, a.y - 30, MO[key](col), w, h);
      d.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-80%) scale(1.15) rotate(-8deg)", opacity: 1, offset: 0.35 }, { transform: "translate(-50%,-120%) scale(1) rotate(8deg)", opacity: 0 }], { duration: 900, easing: "ease-out", fill: "forwards" }); axLater(d, 950); return;
    }
    tg.forEach((tn, i) => { const b = axPt(A, tn, 0.45), dur = Math.max(260, (when({ t: A.nodes.indexOf(tn) }) || 400) - 30);
      const d = mk(A, "idmo", a.x, a.y, MO[key](col), w, h); const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      const spin = ["carte", "piece", "bombe", "os", "horloge", "rune", "glyphe"].includes(key); const arc = key === "bombe" || key === "biere" ? -60 : key === "fleche" || key === "lance" ? -16 : -28;
      const kf = []; for (let s = 0; s <= 8; s++) { const t = s / 8, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + arc * 4 * t * (1 - t); kf.push({ left: x + "px", top: y + "px", transform: `translate(-50%,-50%) rotate(${spin ? t * 540 : ang + (arc * (1 - 2 * t)) * 0.6}deg) scale(${0.7 + 0.3 * Math.sin(t * Math.PI)})`, opacity: t > 0.95 ? 0 : 1 }); }
      d.animate(kf, { duration: dur, delay: i * 70, easing: "linear", fill: "forwards" }); axLater(d, dur + i * 70 + 60);
      setTimeout(() => { if (!tn.isConnected) return; const r = mk(A, "idimp", b.x, b.y, "", 10, 10); r.style.setProperty("--c", col); axLater(r, 520); }, dur + i * 70);
    });
  };
  /* mécaniques : un effet par déclenchement */
  const pop = (A, n, html, w, h, dy = -0.15, ms = 1000) => { const p = axPt(A, n, 0.5 + dy); const d = mk(A, "idpop", p.x, p.y, html, w, h);
    d.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.75 }, { transform: "translate(-50%,-90%) scale(.9)", opacity: 0 }], { duration: ms, easing: "ease-out", fill: "forwards" }); axLater(d, ms + 30); return d; };
  const ground = (A, n, col, ms = 1100, star) => { const f = anFoot(A, n), r = axBody(n).getBoundingClientRect(), w = Math.max(56, r.width * 1.2);
    const g = mk(A, "idground", f.x, f.y, SVG(100, 50, `<ellipse cx="50" cy="25" rx="47" ry="21" fill="none" stroke="${col}" stroke-width="3"/>${star ? `<path d="M50 6l18 32H32zM50 44L32 12h36z" fill="none" stroke="${col}" stroke-width="2"/>` : `<ellipse cx="50" cy="25" rx="30" ry="12" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="5 4"/>`}`), w, w * 0.5);
    if (A.fxg) A.fxg.appendChild(g); g.animate([{ transform: "translate(-50%,-50%) scale(.2) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.9, offset: 0.8 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 0 }], { duration: ms, fill: "forwards" }); axLater(g, ms + 30); };
  const sparks = (A, n, col, k = 8, up = true) => { const p = axPt(A, n, 0.5); for (let i = 0; i < k; i++) { const s = mk(A, "idspk", p.x + axRnd(-20, 20), p.y + axRnd(-10, 10), "", 6, 6); s.style.background = col;
    s.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(calc(-50% + ${axRnd(-30, 30)}px),calc(-50% + ${up ? -axRnd(30, 70) : axRnd(-40, 40)}px)) scale(.3)`, opacity: 0 }], { duration: 700, delay: i * 30, easing: "ease-out", fill: "forwards" }); axLater(s, 800); } };
  const body = (n, kf, o) => { const b = axBody(n); if (b && b.animate) b.animate(kf, o); };
  const FX = {
    cumul: (A, n) => { for (let i = 0; i < 3; i++) setTimeout(() => pop(A, n, SVG(30, 20, '<path d="M3 17l12-12 12 12" fill="none" stroke="#ffd84d" stroke-width="4"/>'), 26, 16, 0.1 - i * 0.12, 600), i * 90); },
    etat: (A, n) => { ground(A, n, "#c77dff", 1300); sparks(A, n, "#d9a8ff", 6); },
    retard: (A, n) => pop(A, n, MO.horloge("#f1cf6e"), 30, 30, -0.35, 1100),
    retard2: (A, n) => { pop(A, n, MO.horloge("#ff7a3c"), 40, 40, 0, 500); setTimeout(() => { sparks(A, n, "#ffb347", 12, false); body(n, [{ filter: "brightness(2.5)" }, { filter: "none" }], 300); }, 380); },
    erosion: (A, n) => { const p = axPt(A, n, 0.45); for (let i = 0; i < 5; i++) { const d = mk(A, "idspk", p.x + axRnd(-16, 16), p.y, "", 5, 9); d.style.background = "#c0392b"; d.style.borderRadius = "50% 50% 50% 50% / 60% 60% 40% 40%";
      d.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(-50%,calc(-50% + ${axRnd(30, 50)}px))`, opacity: 0 }], { duration: 700, delay: i * 60, fill: "forwards" }); axLater(d, 900); } },
    attire: (A, n) => { const b = axBody(n); const d = n.closest && A.el ? 1 : 1; body(n, [{ translate: "0 0" }, { translate: `${-12 * d}px 0`, offset: 0.4 }, { translate: "0 0" }], { duration: 500 }); pop(A, n, SVG(36, 30, '<path d="M6 4v12a12 12 0 0 0 24 0V4" fill="none" stroke="#e74c3c" stroke-width="7"/><path d="M6 4v6M30 4v6" stroke="#ddd" stroke-width="7"/>'), 26, 22, -0.3, 800); },
    tp: (A, n) => { sparks(A, n, "#bff6ff", 10); body(n, [{ opacity: 1 }, { opacity: 0.1, offset: 0.3 }, { opacity: 0.1, offset: 0.55 }, { opacity: 1 }], { duration: 600 }); },
    esquive: (A, n) => body(n, [{ translate: "0 0", opacity: 1 }, { translate: "-14px -4px", opacity: 0.5, offset: 0.4 }, { translate: "0 0", opacity: 1 }], { duration: 420 }),
    telefrag: (A, n) => { ground(A, n, "#57d0ff", 700); sparks(A, n, "#57d0ff", 10, false); },
    piege: (A, n) => { const f = anFoot(A, n); const d = mk(A, "idtrap", f.x, f.y - 4, MO.piege("#b9bec4"), 44, 18); d.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1200, fill: "forwards" }); axLater(d, 1250); },
    piege2: (A, n) => { const p = axPt(A, n, 0.75); const t1 = mk(A, "idtrap", p.x, p.y - 6, MO.piege("#e5e8ec"), 50, 20), t2 = mk(A, "idtrap", p.x, p.y + 6, MO.piege("#e5e8ec"), 50, 20); t2.style.transform = "translate(-50%,-50%) scaleY(-1)";
      t1.animate([{ transform: "translate(-50%,-150%)" }, { transform: "translate(-50%,-50%)", offset: 0.3 }, { transform: "translate(-50%,-50%)", opacity: 0 }], { duration: 600, fill: "forwards" }); t2.animate([{ transform: "translate(-50%,50%) scaleY(-1)" }, { transform: "translate(-50%,-50%) scaleY(-1)", offset: 0.3 }, { transform: "translate(-50%,-50%) scaleY(-1)", opacity: 0 }], { duration: 600, fill: "forwards" }); axLater(t1, 650); axLater(t2, 650); },
    glyphe: (A, n) => ground(A, n, "#ffd84d", 1300, true),
    glyphe2: (A, n, F) => F.ents.forEach((e, i) => { if (e.alive && e.side === "m" && A.nodes[i]) ground(A, A.nodes[i], "#ffd84d", 700, true); }),
    bombe: (A, n) => { const f = anFoot(A, n); const d = mk(A, "idbomb", f.x + 26, f.y - 12, MO.bombe("#ff7a3c"), 26, 26); d.animate([{ transform: "translate(-50%,-250%)", opacity: 0 }, { transform: "translate(-50%,-50%)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-70%)", offset: 0.55 }, { transform: "translate(-50%,-50%)", offset: 0.7 }, { opacity: 0 }], { duration: 1300, fill: "forwards" }); axLater(d, 1350); },
    boom: (A, n, F) => F.ents.forEach((e, i) => { if (e.alive && e.side === "m" && A.nodes[i]) { const p = axPt(A, A.nodes[i], 0.5); const r = mk(A, "idboom", p.x, p.y, "", 20, 20); axLater(r, 700); sparks(A, A.nodes[i], "#ffb347", 8, false); } }),
    portail: (A, n) => { const p = axPt(A, n, 0.45); const d = mk(A, "idportal", p.x + 30, p.y, MO.portail("#57d0ff"), 40, 40); d.animate([{ transform: "translate(-50%,-50%) scale(0) rotate(0)" }, { transform: "translate(-50%,-50%) scale(1.2) rotate(180deg)", offset: 0.4 }, { transform: "translate(-50%,-50%) scale(1) rotate(360deg)", offset: 0.8 }, { transform: "translate(-50%,-50%) scale(0) rotate(540deg)" }], { duration: 1100, fill: "forwards" }); axLater(d, 1150); },
    pioche: (A, n) => { const d = pop(A, n, MO.carte("#c0392b"), 22, 30, -0.4, 1000); d.animate([{ rotate: "y 0deg" }, { rotate: "y 360deg" }], { duration: 500 }); },
    relance: (A, n) => pop(A, n, SVG(36, 36, '<path d="M30 18a12 12 0 1 1-4-9" fill="none" stroke="#7ee06a" stroke-width="4"/><path d="M28 2v9h-9" fill="none" stroke="#7ee06a" stroke-width="4"/>'), 26, 26, -0.35, 800),
    rune: (A, n) => pop(A, n, MO.rune("#9b8cff"), 22, 26, -0.3, 1100),
    echo: (A, n) => { const p = axPt(A, n, 0.45); for (let i = 0; i < 2; i++) setTimeout(() => { const r = mk(A, "idimp", p.x, p.y, "", 10, 10); r.style.setProperty("--c", "#e0e0ff"); axLater(r, 520); }, i * 160); },
    contagion: (A, n) => sparks(A, n, "#9bf06a", 10),
    sacrifice: (A, n) => { sparks(A, n, "#e74c3c", 8, false); body(n, [{ filter: "none" }, { filter: "drop-shadow(0 0 8px #e74c3c) saturate(1.6)" , offset: 0.4 }, { filter: "none" }], { duration: 600 }); },
  };
  window.anIdTrig = (F, A, f, n) => { const fn = FX[f.idx]; if (!fn || !n || !n.isConnected || !(A.view === "scene")) return; try { fn(A, n, F); } catch (e) { /* le nœud a pu disparaître */ } };
})();
