/* 1.0.34 « Sorts et boss animés » : un sort signature de plus pour chaque classe (le plus joué), une attaque à eux pour les boss des mondes
   dans leur donjon, et la mise en scène « Titan » des boss des mondes (Gargandyas a la sienne). Chargé après ui.js : complète SG et BXSP. */
(function () {
  const K = window.DX && window.DX.anim; if (!K) return;
  const { SG, BXSP, axMk, axLater, axDust, axPt, axRnd, anFoot, pulse } = K;
  /* petite boîte à formes : particules, symboles en SVG, glyphe au sol, pics, entaille */
  const dot = (c, x, y, col, s = 8) => { const d = c.mk("anp", x, y, { "--c": col }); d.style.width = d.style.height = s + "px"; return d; };
  const burst = (c, x, y, col, k = 10, dist = 60, dur = 600, s = 7) => { for (let i = 0; i < k; i++) { const d = dot(c, x, y, col, s), a = (i / k) * Math.PI * 2 + c.rnd(-0.3, 0.3), r = c.rnd(dist * 0.5, dist);
    d.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px),calc(-50% + ${Math.sin(a) * r}px)) scale(.3)`, opacity: 0 }], { duration: dur * c.T, easing: "ease-out", fill: "forwards" }); c.later(d, dur + 50); } };
  const rise = (c, x, y, w, col, k = 10, hgt = 80, dur = 800, s = 6) => { for (let i = 0; i < k; i++) { const d = dot(c, x + c.rnd(-w / 2, w / 2), y, col, s);
    d.animate([{ transform: "translate(-50%,-50%)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(calc(-50% + ${c.rnd(-12, 12)}px),calc(-50% - ${c.rnd(hgt * 0.5, hgt)}px)) scale(.4)`, opacity: 0 }], { duration: dur * c.T, delay: i * 40 * c.T, fill: "both" }); c.later(d, dur + i * 40 + 60); } };
  const art = (c, cls, x, y, w, h, svg) => { const d = c.mk("ansvg " + cls, x, y); d.style.width = w + "px"; d.style.height = h + "px"; d.innerHTML = svg; return d; };
  const R = (c, n) => c.body(n).getBoundingClientRect();
  const glyph = (c, n, col, ms = 1200) => { const f = c.foot(n), w = Math.max(60, R(c, n).width * 1.3);
    const g = art(c, "anglyph", f.x, f.y, w, w * 0.5, `<svg viewBox="0 0 100 50"><ellipse cx="50" cy="25" rx="47" ry="22" fill="none" stroke="${col}" stroke-width="2.5"/><ellipse cx="50" cy="25" rx="34" ry="15" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="5 4"/><path d="M50 5L58 25L50 45L42 25Z" fill="none" stroke="${col}" stroke-width="1.5"/></svg>`);
    if (c.A.fxg) c.A.fxg.appendChild(g); g.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.8 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 0 }], { duration: ms * c.T, fill: "forwards" }); c.later(g, ms + 50); return g; };
  const spikes = (c, n, col, k = 5, hgt = 1) => { const f = c.foot(n), r = R(c, n); for (let i = 0; i < k; i++) { const sp = c.mk("anspike", f.x + (i - (k - 1) / 2) * r.width * 0.2, f.y + 2, { "--c": col }); sp.style.height = r.height * hgt * c.rnd(0.45, 0.8) + "px"; sp.style.width = r.width * 0.14 + "px";
    sp.animate([{ transform: "translate(-50%,-100%) scaleY(0)" }, { transform: "translate(-50%,-100%) scaleY(1.1)", offset: 0.3 }, { transform: "translate(-50%,-100%) scaleY(1)", offset: 0.75 }, { transform: "translate(-50%,-100%) scaleY(0)", opacity: 0.6 }], { duration: 900 * c.T, delay: i * 40 * c.T, fill: "both" }); c.later(sp, 1000 + i * 40); } };
  const slash = (c, n, col, ang = -35, w = 1.4) => { const p = c.pt(n, 0.45), r = R(c, n); const s = c.mk("anslash", p.x, p.y, { "--c": col }); s.style.width = r.width * w + "px";
    s.animate([{ transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.4 }, { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1) scaleY(.2)`, opacity: 0 }], { duration: 380 * c.T, fill: "forwards" }); c.later(s, 420); };
  const fly = (c, d, a, b, dur, arc = -40, spin = 0) => { const kf = []; for (let i = 0; i <= 10; i++) { const t = i / 10; kf.push({ left: a.x + (b.x - a.x) * t + "px", top: a.y + (b.y - a.y) * t + arc * 4 * t * (1 - t) + "px", transform: `translate(-50%,-50%) rotate(${spin * t}deg)` }); }
    d.animate(kf, { duration: dur * c.T, easing: "linear", fill: "forwards" }); };
  const SV = {
    bone: '<svg viewBox="0 0 60 20"><path d="M8 4a5 5 0 1 1 3 7h38a5 5 0 1 1 3-7 5 5 0 1 1-3 9H11a5 5 0 1 1-3-9z" fill="#f4ecd8" stroke="#9c8a62" stroke-width="1.5"/></svg>',
    mask: '<svg viewBox="0 0 40 40"><path d="M4 10q16-8 32 0q0 22-16 26Q4 32 4 10z" fill="#f2e6d0" stroke="#7a3b8f" stroke-width="2.5"/><path d="M11 17l6 2-6 2zM29 17l-6 2 6 2z" fill="#222"/><path d="M14 27q6 4 12 0" stroke="#c0392b" stroke-width="2" fill="none"/></svg>',
    card: (s) => `<svg viewBox="0 0 26 36"><rect x="1" y="1" width="24" height="34" rx="3" fill="#fff8e6" stroke="#b8860b" stroke-width="1.5"/><text x="13" y="24" font-size="15" text-anchor="middle" fill="${s === "♠" ? "#222" : "#c0392b"}">${s}</text></svg>`,
    bird: '<svg viewBox="0 0 80 50"><path d="M40 28C30 10 12 6 2 12c12 2 20 8 26 18-8-2-14 0-20 6 10-2 18 0 24 4l8 6 8-6c6-4 14-6 24-4-6-6-12-8-20-6 6-10 14-16 26-18C68 6 50 10 40 28z" fill="#ff8a2a"/><path d="M40 28c-2-8 0-14 4-18-1 6 0 12-4 18z" fill="#ffe27a"/></svg>',
    doll: '<svg viewBox="0 0 30 44"><circle cx="15" cy="10" r="8" fill="#b9935a" stroke="#5a3d1a" stroke-width="1.5"/><path d="M7 20h16l3 16H4z" fill="#a07c46" stroke="#5a3d1a" stroke-width="1.5"/><path d="M11 9l2 2M13 9l-2 2M17 9l2 2M19 9l-2 2" stroke="#222" stroke-width="1.2"/><path d="M15 22v12M10 27h10" stroke="#5a3d1a" stroke-dasharray="2 2"/></svg>',
    clock: '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" fill="rgba(20,30,60,.55)" stroke="#f1cf6e" stroke-width="3"/><g stroke="#f1cf6e" stroke-width="2">' + Array.from({ length: 12 }, (_, i) => `<path d="M${30 + 22 * Math.sin(i * Math.PI / 6)} ${30 - 22 * Math.cos(i * Math.PI / 6)}L${30 + 26 * Math.sin(i * Math.PI / 6)} ${30 - 26 * Math.cos(i * Math.PI / 6)}"/>`).join("") + '</g><path class="hand" d="M30 30L30 9" stroke="#9fd6ff" stroke-width="3" stroke-linecap="round"/></svg>',
    trap: '<svg viewBox="0 0 70 30"><path d="M5 26h60" stroke="#5a3d1a" stroke-width="3"/><path d="M8 26L14 8l6 18 6-18 6 18 6-18 6 18 6-18 6 18 6-18 4 18" fill="none" stroke="#b9bec4" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    chain: '<svg viewBox="0 0 30 14"><rect x="1.5" y="1.5" width="18" height="11" rx="5.5" fill="none" stroke="#9aa3ad" stroke-width="3"/><rect x="12" y="4" width="16" height="6" rx="3" fill="none" stroke="#6d7680" stroke-width="2.5"/></svg>',
    maw: '<svg viewBox="0 0 80 60"><path d="M4 30Q40 -6 76 30Q40 66 4 30z" fill="#3a0d12"/><path d="M8 28l6-10 5 9 6-12 6 12 5-12 6 12 6-12 5 12 6-10 5 9" fill="#fff" stroke="#999"/><path d="M8 32l6 10 5-9 6 12 6-12 5 12 6-12 6 12 5-12 6 10 5-9" fill="#fff" stroke="#999"/></svg>',
    root: '<svg viewBox="0 0 40 90"><path d="M20 90C12 70 30 60 18 40S28 12 24 0" stroke="#5b3a1e" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M19 50c-8-4-12-10-12-16M22 30c8-2 12-8 12-14" stroke="#4e8a2a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="7" cy="33" r="4" fill="#7bc043"/><circle cx="34" cy="15" r="4" fill="#7bc043"/></svg>',
  };
  const hitT = async (c, t, gap = 70) => { c.hit(t); await c.wait(gap); await c.hitAll(gap); };

  /* ===== sorts signature : le sort le plus joué de chaque classe ===== */
  Object.assign(SG, {
    /* Iop · Tempête de Puissance : une tornade de flammes se lève sous la cible et l'emporte */
    s13121: async (c) => { c.hold(1300); const t = c.foes[0], f = c.foot(t), r = R(c, t);
      const tor = c.mkg("antor", f.x, f.y); tor.style.height = r.height * 1.5 + "px"; tor.style.width = r.width * 0.9 + "px"; c.later(tor, 1500);
      rise(c, f.x, f.y, r.width * 0.6, "#ffb347", 16, r.height * 1.5, 900, 7);
      await c.wait(250); c.anim(t, [{ transform: "none" }, { transform: "translateY(-26px) rotate(-8deg)", offset: 0.3 }, { transform: "translateY(-34px) rotate(8deg)", offset: 0.6 }, { transform: "none" }], 900);
      c.hit(t); await c.wait(300); await c.hitAll(80); await c.wait(500); },
    /* Eniripsa · Vacarme : un cri en ondes et en notes, la cible vacille */
    s25856: async (c) => { c.hold(1200); const t = c.foes[0], a = c.pt(c.me, 0.3), b = c.pt(t, 0.45), d = c.dir(t);
      c.anim(c.me, [{ transform: "none" }, { transform: `rotate(${-d * 6}deg) scale(1.08)`, offset: 0.3 }, { transform: "none" }], 500);
      for (let i = 0; i < 4; i++) { const w = c.mk("anwave", a.x, a.y); w.animate([{ left: a.x + "px", top: a.y + "px", transform: "translate(-50%,-50%) scale(.3)", opacity: 1 }, { left: b.x + "px", top: b.y + "px", transform: "translate(-50%,-50%) scale(1.4)", opacity: 0.2 }], { duration: 420 * c.T, delay: i * 90 * c.T, easing: "ease-out", fill: "both" }); c.later(w, 900); }
      for (let i = 0; i < 6; i++) { const nt = c.mk("annote", a.x, a.y); nt.textContent = i % 2 ? "♪" : "♫"; nt.animate([{ left: a.x + "px", top: a.y + "px", opacity: 0 }, { opacity: 1, offset: 0.2 }, { left: b.x + c.rnd(-20, 20) + "px", top: b.y - c.rnd(20, 60) + "px", opacity: 0 }], { duration: 700 * c.T, delay: i * 70 * c.T, fill: "both" }); c.later(nt, 1300); }
      await c.wait(420); c.anim(t, [{ transform: "none" }, { transform: "skewX(10deg)" }, { transform: "skewX(-10deg)" }, { transform: "skewX(6deg)" }, { transform: "none" }], 500); c.shake("shake"); c.hit(t); await c.wait(150); await c.hitAll(60); c.rest(); await c.wait(400); },
    /* Féca · Frisson : un vent glacé tourbillonne, la cible se couvre de givre */
    s12989: async (c) => { c.hold(1000); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.45), r = R(c, t);
      for (let i = 0; i < 14; i++) { const s = dot(c, a.x, a.y, "#d8f3ff", 6); fly(c, s, { x: a.x, y: a.y + c.rnd(-20, 20) }, { x: b.x + c.rnd(-20, 20), y: b.y + c.rnd(-25, 25) }, 420 + i * 20, c.rnd(-40, 40)); c.later(s, 500 + i * 20); }
      await c.wait(420); const fr = c.clone(t, "anfrost"); c.later(fr, 900); burst(c, b.x, b.y, "#bfe8ff", 12, r.width * 0.6, 600, 5); c.hit(t); await c.wait(100); await c.hitAll(60); await c.wait(400); },
    /* Roublard · Resquille : une gerbe d'eau en pistolet, la cible détrempée lâche ses PA */
    s13443: async (c) => { c.hold(900); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.45), d = c.dir(t);
      c.anim(c.me, [{ transform: "none" }, { transform: `translateX(${-d * 10}px) rotate(${-d * 4}deg)`, offset: 0.3 }, { transform: "none" }], 350);
      for (let i = 0; i < 9; i++) { const s = dot(c, a.x + d * 20, a.y, "#5fb4ff", 9 - i * 0.5); fly(c, s, { x: a.x + d * 20, y: a.y }, { x: b.x, y: b.y + c.rnd(-6, 6) }, 260 + i * 18, -10); c.later(s, 320 + i * 18); }
      await c.wait(270); burst(c, b.x, b.y, "#8fd0ff", 14, 55, 550, 6); c.puff(b.x, b.y, "rgba(140,200,255,.8)", 4); await hitT(c, t, 60); await c.wait(300); },
    /* Crâ · Flèche Dévorante : la flèche enflammée s'ouvre en gueule de feu et mord */
    s32446: async (c) => { c.hold(1000); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.45), r = R(c, t); c.proj(a, b, "f", "arrow", 240); await c.wait(240);
      const m = art(c, "anmaw", b.x, b.y, r.width * 1.1, r.width * 0.8, SV.maw); m.animate([{ transform: "translate(-50%,-50%) scale(.3,.1)", opacity: 0, filter: "hue-rotate(0)" }, { transform: "translate(-50%,-50%) scale(1,1)", opacity: 1, offset: 0.35 }, { transform: "translate(-50%,-50%) scale(1.1,.1)", opacity: 1, offset: 0.6 }, { transform: "translate(-50%,-50%) scale(1.2,.05)", opacity: 0 }], { duration: 560 * c.T, fill: "forwards" }); c.later(m, 600);
      await c.wait(330); burst(c, b.x, b.y, "#ff7a2a", 12, 60, 500, 7); c.shake("shake"); await hitT(c, t); await c.wait(300); },
    /* Enutrof · Remblai : un monticule de terre jaillit sous la cible et la soulève */
    s13335: async (c) => { c.hold(1000); const t = c.foes[0], f = c.foot(t), r = R(c, t);
      const mo = c.mkg("anmound", f.x, f.y + 4); mo.style.width = r.width * 1.2 + "px"; mo.style.height = r.height * 0.45 + "px"; c.later(mo, 1100);
      c.anim(t, [{ transform: "none" }, { transform: `translateY(${-r.height * 0.35}px)`, offset: 0.35 }, { transform: `translateY(${-r.height * 0.3}px) rotate(6deg)`, offset: 0.6 }, { transform: "none" }], 900);
      c.dust(f.x, f.y, 6); for (let i = 0; i < 8; i++) { const s = dot(c, f.x, f.y - 6, "#8a6a3a", 7); fly(c, s, { x: f.x, y: f.y - 6 }, { x: f.x + c.rnd(-70, 70), y: f.y + 6 }, 600, -c.rnd(40, 90)); c.later(s, 650); }
      await c.wait(300); c.shake("shake"); await hitT(c, t); await c.wait(600); },
    /* Sadida · Sacrifice Vaudou : une poupée se dresse devant la cible ; chaque aiguille la fait tressaillir */
    s13531: async (c) => { c.hold(1300); const t = c.foes[0], f = c.foot(t), r = R(c, t), d = c.dir(t);
      const dl = art(c, "andoll", f.x - d * r.width * 0.7, f.y - r.width * 0.35, r.width * 0.45, r.width * 0.66, SV.doll); dl.animate([{ transform: "translate(-50%,-50%) scale(0)" }, { transform: "translate(-50%,-50%) scale(1)" }], { duration: 250 * c.T, fill: "forwards" }); c.later(dl, 1300);
      const dp = dl.getBoundingClientRect(), ar = c.A.el.getBoundingClientRect(), cx = dp.left - ar.left + dp.width / 2, cy = dp.top - ar.top + dp.height / 2;
      for (let i = 0; i < 3; i++) { await c.wait(230); const nd = c.mk("anneedle", cx + c.rnd(-8, 8), cy - 30); nd.animate([{ transform: "translate(-50%,-50%) rotate(30deg) translateY(-20px)", opacity: 0 }, { transform: "translate(-50%,-50%) rotate(30deg) translateY(10px)", opacity: 1 }], { duration: 120 * c.T, fill: "forwards" }); c.later(nd, 900 - i * 200);
        c.anim(t, [{ transform: "none", filter: "none" }, { transform: `translateX(${d * 5}px) scale(.96)`, filter: "brightness(1.6) sepia(.6) hue-rotate(60deg)" }, { transform: "none", filter: "none" }], 220); if (i === 0) c.hit(t); }
      await c.hitAll(60); c.rest(); await c.wait(300); },
    /* Osamodas · Chant du Phénix : un phénix de feu traverse la cible et renaît en étincelles */
    s31145: async (c) => { c.hold(1200); const t = c.foes[0], a = c.pt(c.me, 0.35), b = c.pt(t, 0.45), d = c.dir(t), r = R(c, t);
      const bd = art(c, "anbird", a.x, a.y, r.width * 1.1, r.width * 0.7, SV.bird); if (d < 0) bd.firstChild.style.transform = "scaleX(-1)";
      fly(c, bd, a, { x: b.x + d * 60, y: b.y - 20 }, 620, -70); c.later(bd, 660); const tr = setInterval(() => { if (!bd.isConnected) return clearInterval(tr); const q = bd.getBoundingClientRect(), ar = c.A.el.getBoundingClientRect(); const s = dot(c, q.left - ar.left + q.width / 2, q.top - ar.top + q.height / 2, "#ffb347", 6); s.animate([{ opacity: 1 }, { opacity: 0, transform: "translate(-50%,-30%) scale(.3)" }], { duration: 400 }); c.later(s, 450); }, 40);
      await c.wait(470); burst(c, b.x, b.y, "#ffd27a", 14, 70, 600, 6); c.shake("shake"); await hitT(c, t); c.rest(); await c.wait(400); },
    /* Sacrieur · Nervosité : il tremble de rage, puis trois entailles d'eau sanglante */
    s12727: async (c) => { c.hold(1100); const t = c.foes[0], d = c.dir(t);
      c.anim(c.me, [{ transform: "none", filter: "none" }, { transform: "translateX(-3px)", filter: "drop-shadow(0 0 8px #e0382b)" }, { transform: "translateX(3px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "none", filter: "none" }], 420);
      await c.wait(380); const a = c.pt(c.me), b = c.pt(t); const dx = b.x - a.x - d * 40, dy = b.y - a.y;
      c.anim(c.me, [{ transform: "none" }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.3 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.75 }, { transform: "none" }], 700);
      await c.wait(200); for (let i = 0; i < 3; i++) { slash(c, t, i % 2 ? "#4fa8ff" : "#d8263c", [-40, 35, -10][i]); if (!i) c.hit(t); await c.wait(110); }
      await c.hitAll(50); c.rest(); await c.wait(300); },
    /* Xélor · Réfraction : une horloge s'arrête au-dessus de la cible, trois reflets d'elle se rejoignent en un éclat */
    s13286: async (c) => { c.hold(1200); const t = c.foes[0], p = c.pt(t, 0.15), b = c.pt(t, 0.5), r = R(c, t);
      const ck = art(c, "anclock", p.x, p.y - 26, 54, 54, SV.clock); ck.animate([{ transform: "translate(-50%,-50%) scale(0)" }, { transform: "translate(-50%,-50%) scale(1)", offset: 0.25 }, { transform: "translate(-50%,-50%) scale(1)", offset: 0.85 }, { transform: "translate(-50%,-50%) scale(0)" }], { duration: 1100 * c.T, fill: "forwards" }); c.later(ck, 1150);
      ck.querySelector(".hand").animate([{ transform: "rotate(0)" }, { transform: "rotate(-720deg)" }], { duration: 900 * c.T }); ck.querySelector(".hand").style.transformOrigin = "30px 30px";
      const cl = [-1, 0, 1].map((k) => { const x = c.clone(t, "anghost"); x.animate([{ transform: `translate(calc(-50% + ${k * r.width * 0.7}px),-50%)`, opacity: 0.6 }, { transform: "translate(-50%,-50%)", opacity: 0.2 }], { duration: 600 * c.T, delay: 250 * c.T, fill: "both" }); c.later(x, 900); return x; });
      await c.wait(850); burst(c, b.x, b.y, "#ff9a3c", 12, 50, 500, 6); await hitT(c, t); await c.wait(300); },
    /* Ecaflip · Tromperie : trois cartes se mélangent au-dessus de la cible, l'une se retourne : la mauvaise */
    s12881: async (c) => { c.hold(1300); const t = c.foes[0], p = c.pt(t, 0.1), b = c.pt(t, 0.5);
      const cs = ["♥", "♠", "♦"].map((s, i) => { const k = art(c, "ancard", p.x + (i - 1) * 30, p.y - 20, 26, 36, SV.card(s)); k.style.filter = "brightness(.2)"; return k; });
      for (let r2 = 0; r2 < 3; r2++) { cs.forEach((k, i) => k.animate([{ left: p.x + (i - 1) * 30 + "px" }, { left: p.x + ((i + r2 + 1) % 3 - 1) * 30 + "px" }], { duration: 180 * c.T, fill: "forwards" })); await c.wait(190); }
      cs[1].animate([{ transform: "translate(-50%,-50%) rotateY(90deg)" }, { transform: "translate(-50%,-50%) rotateY(0)" }], { duration: 200 * c.T, fill: "forwards" }); cs[1].style.filter = "none"; await c.wait(240);
      const ks = cs[1].getBoundingClientRect(), ar = c.A.el.getBoundingClientRect(); fly(c, cs[1], { x: ks.left - ar.left + 13, y: ks.top - ar.top + 18 }, b, 220, -20, 540); cs.forEach((k) => c.later(k, 500));
      await c.wait(220); burst(c, b.x, b.y, "#ffd84d", 10, 50, 500, 6); await hitT(c, t); c.rest(); await c.wait(300); },
    /* Sram · Piège de Dérive : un piège se dessine sous la cible, se referme et s'embrase */
    s12942: async (c) => { c.hold(1100); const t = c.foes[0], f = c.foot(t), r = R(c, t); glyph(c, t, "#b06cff", 1000);
      const tp = art(c, "antrap", f.x, f.y - 8, r.width * 1.1, r.width * 0.45, SV.trap); tp.animate([{ transform: "translate(-50%,-50%) scaleY(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scaleY(1)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%) scaleY(1)", opacity: 1, offset: 0.75 }, { transform: "translate(-50%,-50%) scaleY(-1)", opacity: 0 }], { duration: 800 * c.T, fill: "forwards" }); c.later(tp, 850);
      await c.wait(560); c.shake("shake"); rise(c, f.x, f.y, r.width * 0.8, "#ff7a2a", 14, r.height * 0.9, 700, 7); await hitT(c, t); await c.wait(400); },
    /* Pandawa · Pandatak : il se met en boule, roule jusqu'à la cible et rebondit */
    s12797: async (c) => { c.hold(1100); const t = c.foes[0], a = c.pt(c.me), b = c.pt(t), d = c.dir(t), dx = b.x - a.x - d * 40, dy = b.y - a.y; c.z(c.me, true);
      c.anim(c.me, [{ transform: "none" }, { transform: "scale(.8) rotate(0)", offset: 0.15 }, { transform: `translate(${dx}px,${dy}px) scale(.8) rotate(${d * 720}deg)`, offset: 0.55 }, { transform: `translate(${dx - d * 30}px,${dy - 40}px) scale(.9) rotate(${d * 900}deg)`, offset: 0.75 }, { transform: "none" }], 900);
      await c.wait(500); c.shake("shake"); c.dust(b.x, c.foot(t).y, 6); await hitT(c, t); await c.wait(450); c.z(c.me, false); },
    /* Steamer · Vapor : un jet de vapeur brûlante repousse la cible */
    s13826: async (c) => { c.hold(1000); const t = c.foes[0], a = c.pt(c.me, 0.5), b = c.pt(t, 0.5), d = c.dir(t);
      for (let i = 0; i < 16; i++) { const s = c.mk("smoke", a.x + d * 20, a.y + c.rnd(-8, 8)); s.style.background = "radial-gradient(circle,rgba(240,245,250,.9),transparent 70%)"; s.animate([{ left: a.x + d * 20 + "px", transform: "translate(-50%,-50%) scale(.4)", opacity: 0.9 }, { left: b.x + c.rnd(-10, 30) * d + "px", top: b.y + c.rnd(-25, 25) + "px", transform: "translate(-50%,-50%) scale(1.8)", opacity: 0 }], { duration: 520 * c.T, delay: i * 18 * c.T, fill: "both" }); c.later(s, 650 + i * 18); }
      await c.wait(300); await hitT(c, t); await c.wait(450); },
    /* Zobal · Agular : son masque part en boomerang, tranche la cible et revient */
    s13407: async (c) => { c.hold(1100); const t = c.foes[0], a = c.pt(c.me, 0.25), b = c.pt(t, 0.45), r = R(c, t);
      const m = art(c, "anmask", a.x, a.y, 34, 34, SV.mask); m.animate([{ left: a.x + "px", top: a.y + "px", transform: "translate(-50%,-50%) rotate(0)" }, { left: b.x + "px", top: b.y - 20 + "px", transform: "translate(-50%,-50%) rotate(540deg)", offset: 0.45 }, { left: (a.x + b.x) / 2 + "px", top: b.y + 30 + "px", transform: "translate(-50%,-50%) rotate(900deg)", offset: 0.75 }, { left: a.x + "px", top: a.y + "px", transform: "translate(-50%,-50%) rotate(1260deg)" }], { duration: 900 * c.T, fill: "forwards" }); c.later(m, 950);
      await c.wait(400); slash(c, t, "#9be7ff", -20, 1.2); await hitT(c, t); await c.wait(500); },
    /* Éliotrope · Faisceau : un portail s'ouvre au-dessus de la cible et y verse un rayon de lumière */
    s14606: async (c) => { c.hold(1100); const t = c.foes[0], p = c.pt(t, 0), f = c.foot(t), r = R(c, t);
      const pt = c.mk("portal", p.x, p.y - 30); pt.animate([{ transform: "translate(-50%,-50%) rotate(90deg) scaleY(0)" }, { transform: "translate(-50%,-50%) rotate(90deg) scaleY(1)", offset: 0.2 }, { transform: "translate(-50%,-50%) rotate(90deg) scaleY(1)", offset: 0.8 }, { transform: "translate(-50%,-50%) rotate(90deg) scaleY(0)" }], { duration: 1000 * c.T, fill: "forwards" }); c.later(pt, 1050);
      await c.wait(250); const bm = c.mk("anbeamv", p.x, p.y - 30); bm.style.height = f.y - p.y + 30 + "px"; bm.style.width = r.width * 0.5 + "px"; bm.animate([{ transform: "translate(-50%,0) scaleX(0)", opacity: 1 }, { transform: "translate(-50%,0) scaleX(1)", opacity: 1, offset: 0.3 }, { transform: "translate(-50%,0) scaleX(.1)", opacity: 0 }], { duration: 600 * c.T, fill: "forwards" }); c.later(bm, 650);
      await c.wait(150); burst(c, f.x, f.y - 10, "#6ff0e6", 12, 55, 500, 6); await hitT(c, t); c.rest(); await c.wait(400); },
    /* Huppermage · Glacier : une rune d'eau au sol, des pics de glace jaillissent */
    s13676: async (c) => { c.hold(1100); const t = c.foes[0]; glyph(c, t, "#4fa8ff", 1000); await c.wait(300); spikes(c, t, "#bfe8ff", 5, 0.9); c.shake("shake"); await hitT(c, t); await c.wait(500); },
    /* Ouginak · Tibia : il lance un os énorme qui tournoie et revient */
    s13763: async (c) => { c.hold(1100); const t = c.foes[0], a = c.pt(c.me, 0.4), b = c.pt(t, 0.45), r = R(c, t);
      const bn = art(c, "anbone", a.x, a.y, r.width * 0.9, r.width * 0.3, SV.bone); bn.animate([{ left: a.x + "px", top: a.y + "px", transform: "translate(-50%,-50%) rotate(0)" }, { left: b.x + "px", top: b.y + "px", transform: "translate(-50%,-50%) rotate(720deg)", offset: 0.45 }, { left: a.x + "px", top: a.y + "px", transform: "translate(-50%,-50%) rotate(1440deg)" }], { duration: 900 * c.T, fill: "forwards" }); c.later(bn, 950);
      await c.wait(400); c.shake("shake"); burst(c, b.x, b.y, "#f4ecd8", 8, 40, 400, 5); await hitT(c, t); await c.wait(500); },
    /* Forgelance · Estoc Brûlant : la lance s'embrase et transperce en laissant un sillage de feu */
    s23754: async (c) => { c.hold(1000); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.45), d = c.dir(t), dx = b.x - a.x - d * 46, dy = b.y - a.y;
      c.anim(c.me, [{ transform: "none", filter: "none" }, { transform: `translateX(${-d * 12}px)`, filter: "drop-shadow(0 0 8px #ff7a2a)", offset: 0.25 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.7 }, { transform: "none", filter: "none" }], 800);
      await c.wait(400); for (let i = 0; i < 8; i++) { const s = dot(c, a.x + (dx * i) / 8, a.y + (dy * i) / 8, "#ff8a2a", 8); s.animate([{ opacity: 1 }, { opacity: 0, transform: "translate(-50%,-90%) scale(.3)" }], { duration: 500 * c.T, delay: i * 15 * c.T, fill: "both" }); c.later(s, 560); }
      slash(c, t, "#ffb347", 0, 1.6); burst(c, b.x, b.y, "#ff7a2a", 10, 50, 500, 6); await hitT(c, t); await c.wait(400); },
  });

  /* ===== boss des mondes, aussi dans leur donjon : une attaque à eux ===== */
  Object.assign(BXSP, {
    /* Nileza · Engrenages : un plan s'affiche, des engrenages roulent jusqu'aux héros et explosent */
    976: async (c) => { c.hold(2100); c.banner("Engrenages"); const T = c.tg.length ? c.tg : c.heroes; const a = c.foot(c.me);
      const bp = c.bg("anplan", 0, 0); c.later(bp, 2300);
      c.anim(c.me, [{ transform: "none" }, { transform: "translateY(-10px) rotate(-6deg) scale(1.08)", offset: 0.4 }, { transform: "none" }], 600); await c.wait(350);
      T.slice(0, 4).forEach((n, i) => { const b = c.foot(n); const g = c.b("angear", a.x, a.y - 18); g.innerHTML = '<svg viewBox="0 0 40 40"><path fill="#c9a24a" stroke="#6b4e16" stroke-width="2" d="M17 2h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"/><circle cx="20" cy="20" r="6" fill="#3a2a0c"/></svg>';
        g.animate([{ left: a.x + "px", top: a.y - 18 + "px", transform: "translate(-50%,-50%) rotate(0)" }, { left: b.x + "px", top: b.y - 18 + "px", transform: "translate(-50%,-50%) rotate(-900deg)" }], { duration: 700 * c.T, delay: i * 150 * c.T, easing: "cubic-bezier(.3,0,.8,1)", fill: "both" });
        setTimeout(() => { g.remove(); c.scatter(b.x, b.y - 20, "b-spark", 10, 60, 500); c.puff(b.x, b.y - 18, "rgba(255,210,120,.85)", 5); c.hit(n); c.shake("shake"); }, (700 + i * 150) * c.T); });
      T.slice(4).forEach((n) => setTimeout(() => c.hit(n), 1300 * c.T));
      await c.wait(700 + Math.min(4, T.length) * 150 + 400); },
    /* Kolosso · Glaciation : des stalactites tombent sur les héros et les prennent dans la glace */
    849: async (c) => { c.hold(1900); c.banner("Glaciation"); const T = c.tg.length ? c.tg : c.heroes; c.cls("frost", true);
      c.anim(c.me, [{ transform: "none" }, { transform: "translateY(-14px) scale(1.06)", offset: 0.4 }, { transform: "translateY(4px) scale(1.04,.94)", offset: 0.7 }, { transform: "none" }], 700); await c.wait(500); c.shake("shake2");
      for (const n of T) { const p = c.pt(n, 0.1), r = R(c, n); const st = c.mk("anspike ice", p.x, -10, { "--c": "#d8f3ff" }); st.style.width = r.width * 0.25 + "px"; st.style.height = r.height * 0.5 + "px";
        st.animate([{ top: "-10px", transform: "translate(-50%,-100%) rotate(180deg)" }, { top: p.y + r.height * 0.4 + "px", transform: "translate(-50%,-100%) rotate(180deg)" }], { duration: 360 * c.T, easing: "ease-in", fill: "forwards" }); c.later(st, 420);
        setTimeout(() => { const fr = c.clone(n, "anfrost"); c.later(fr, 700); burst(c, p.x, p.y + r.height * 0.4, "#d8f3ff", 10, 50, 500, 6); c.hit(n); }, 360 * c.T); await c.wait(140); }
      await c.wait(800); c.cls("frost", false); },
    /* Korriandre · Racines : la forêt répond, des racines sortent sous chaque héros et les enserrent */
    841: async (c) => { c.hold(1800); c.banner("Racines"); const T = c.tg.length ? c.tg : c.heroes;
      c.anim(c.me, [{ transform: "none" }, { transform: "scale(1.05,.92)", offset: 0.4 }, { transform: "none" }], 600); await c.wait(300);
      for (const n of T) { const f = c.foot(n), r = R(c, n); [-1, 1].forEach((k) => { const ro = art(c, "anroot", f.x + k * r.width * 0.25, f.y, r.width * 0.3, r.height * 0.8, SV.root); if (k > 0) ro.firstChild.style.transform = "scaleX(-1)";
        ro.animate([{ transform: "translate(-50%,-100%) scaleY(0)" }, { transform: "translate(-50%,-100%) scaleY(1)", offset: 0.35 }, { transform: "translate(-50%,-100%) scaleY(1)", offset: 0.8 }, { transform: "translate(-50%,-100%) scaleY(0)" }], { duration: 1100 * c.T, fill: "forwards" }); c.later(ro, 1150); });
        c.dust(f.x, f.y, 3); setTimeout(() => c.hit(n), 300 * c.T); await c.wait(120); }
      await c.wait(1000); },
    /* Comte Harebourg · Aiguille du temps : une horloge géante, son aiguille balaie l'équipe */
    993: async (c) => { c.hold(2000); c.banner("Aiguille du temps"); const T = c.tg.length ? c.tg : c.heroes, W = c.W(), H = c.H();
      const ck = art(c, "anclock big", W * 0.35, H * 0.45, H * 0.8, H * 0.8, SV.clock); ck.animate([{ transform: "translate(-50%,-50%) scale(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.85, offset: 0.2 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.85, offset: 0.85 }, { transform: "translate(-50%,-50%) scale(1.2)", opacity: 0 }], { duration: 1800 * c.T, fill: "forwards" }); c.later(ck, 1850);
      const hd = ck.querySelector(".hand"); hd.style.transformOrigin = "30px 30px"; hd.animate([{ transform: "rotate(0)" }, { transform: "rotate(-360deg)" }], { duration: 1200 * c.T, delay: 300 * c.T, easing: "ease-in", fill: "both" }); c.cls("warp", true);
      await c.wait(600); for (const n of T) { c.anim(n, [{ filter: "none" }, { filter: "grayscale(1) sepia(.5) hue-rotate(180deg)" }, { filter: "none" }], 500); c.hit(n); await c.wait(150); }
      await c.wait(700); c.cls("warp", false); },
    /* Ougah · Dévoration : une gueule immense se referme sur un héros */
    640: async (c) => { c.hold(1600); c.banner("Dévoration"); const T = c.tg.length ? c.tg : c.heroes; const t = T[0]; if (!t) return; const b = c.pt(t, 0.45), r = R(c, t);
      c.anim(c.me, [{ transform: "none" }, { transform: "scale(1.12) translateY(-8px)", offset: 0.5 }, { transform: "none" }], 800); await c.wait(300);
      const m = art(c, "anmaw", b.x, b.y, r.width * 2, r.width * 1.5, SV.maw); m.animate([{ transform: "translate(-50%,-50%) scale(.2,1.4)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1,1.4)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%) scale(1,.08)", opacity: 1, offset: 0.65 }, { transform: "translate(-50%,-50%) scale(1.1,.05)", opacity: 0 }], { duration: 900 * c.T, fill: "forwards" }); c.later(m, 950);
      await c.wait(580); c.shake("shake2"); burst(c, b.x, b.y, "#e04040", 14, 70, 600, 7); for (const n of T) { c.hit(n); await c.wait(60); } await c.wait(500); },
    /* Roi Nidas · Toucher d'or : une pluie de pièces, les héros se changent en or un instant */
    1106: async (c) => { c.hold(1900); c.banner("Toucher d'or"); const T = c.tg.length ? c.tg : c.heroes; const W = c.W();
      for (let i = 0; i < 24; i++) { const k = c.mk("coin", c.rnd(0, W * 0.6), -10); k.animate([{ top: "-10px", opacity: 1 }, { top: c.H() * c.rnd(0.5, 0.9) + "px", opacity: 0.2 }], { duration: 900 * c.T, delay: i * 30 * c.T, easing: "ease-in", fill: "both" }); c.later(k, 1000 + i * 30); }
      await c.wait(500); for (const n of T) { c.anim(n, [{ filter: "none" }, { filter: "sepia(1) saturate(3) brightness(1.3) hue-rotate(-10deg)", offset: 0.2 }, { filter: "sepia(1) saturate(3) brightness(1.3) hue-rotate(-10deg)", offset: 0.8 }, { filter: "none" }], 900); c.hit(n); await c.wait(90); }
      await c.wait(800); },
    /* Ilyzaelle · Lumière céleste : des rayons tombent du ciel sur chaque héros */
    1628: async (c) => { c.hold(1800); c.banner("Lumière céleste"); const T = c.tg.length ? c.tg : c.heroes; c.dim(true);
      c.anim(c.me, [{ transform: "none", filter: "none" }, { transform: "translateY(-10px)", filter: "drop-shadow(0 0 16px #fff6c0) brightness(1.3)", offset: 0.5 }, { transform: "none", filter: "none" }], 900); await c.wait(400);
      for (const n of T) { const f = c.foot(n), r = R(c, n); const bm = c.mk("anbeamv gold", f.x, 0); bm.style.height = f.y + "px"; bm.style.width = r.width * 0.55 + "px"; bm.animate([{ transform: "translate(-50%,0) scaleX(0)", opacity: 1 }, { transform: "translate(-50%,0) scaleX(1)", opacity: 1, offset: 0.3 }, { transform: "translate(-50%,0) scaleX(.1)", opacity: 0 }], { duration: 600 * c.T, fill: "forwards" }); c.later(bm, 650);
        burst(c, f.x, f.y - 8, "#fff3b0", 8, 40, 450, 5); c.hit(n); await c.wait(140); }
      await c.wait(500); c.dim(false); },
    /* Vortex · Aspiration : une spirale s'ouvre, les héros sont attirés vers elle puis recrachés */
    1208: async (c) => { c.hold(2000); c.banner("Aspiration"); const T = c.tg.length ? c.tg : c.heroes; const W = c.W(), H = c.H(); const cx = W * 0.5, cy = H * 0.45;
      const sp = c.b("b-spiral", cx, cy); c.later(sp, 1800); await c.wait(300);
      for (const n of T) { const p = c.pt(n); c.anim(n, [{ transform: "none" }, { transform: `translate(${(cx - p.x) * 0.35}px,${(cy - p.y) * 0.35}px) rotate(-25deg) scale(.85)`, offset: 0.55 }, { transform: "none" }], 1100); }
      await c.wait(600); c.shake("shake2"); for (const n of T) { c.hit(n); await c.wait(60); } await c.wait(700); },
  });

  /* ===== Gargandyas : le Titan enchaîné, une mise en scène rien qu'à lui ===== */
  const GARGA = {
    /* Sceaux Telluriques : un sceau de terre sous la cible, des pics de roche jaillissent */
    "Sceaux Telluriques": async (c) => { c.hold(1500); c.banner("Sceaux Telluriques"); const t = (c.tg[0]) || c.heroes[0]; if (!t) return;
      c.anim(c.me, [{ transform: "none" }, { transform: "translateY(-18px) scale(1.04)", offset: 0.4 }, { transform: "translateY(4px) scale(1.06,.9)", offset: 0.6 }, { transform: "none" }], 700); await c.wait(420); c.shake("shake2");
      glyph(c, t, "#c08a3e", 1100); await c.wait(250); spikes(c, t, "#8a6a3a", 6, 1.1); c.dust(c.foot(t).x, c.foot(t).y, 6); c.hit(t); await c.wait(100); for (const n of c.tg.slice(1)) c.hit(n); await c.wait(700); },
    /* Rafale Bestiale : un souffle de vent traverse l'équipe, chaque héros est griffé trois fois */
    "Rafale Bestiale": async (c) => { c.hold(1800); c.banner("Rafale Bestiale"); const T = c.tg.length ? c.tg : c.heroes; const W = c.W();
      c.anim(c.me, [{ transform: "none" }, { transform: "translateX(18px) rotate(6deg)", offset: 0.3 }, { transform: "translateX(-26px) rotate(-6deg) scale(1.08)", offset: 0.55 }, { transform: "none" }], 700); await c.wait(300);
      for (let i = 0; i < 18; i++) { const y = c.H() * c.rnd(0.25, 0.85); const s = c.mk("anwind", W, y); s.animate([{ left: W + "px", opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { left: -60 + "px", opacity: 0 }], { duration: 500 * c.T, delay: i * 25 * c.T, easing: "ease-in", fill: "both" }); c.later(s, 600 + i * 25); }
      await c.wait(250); for (const n of T) { for (let k = 0; k < 3; k++) slash(c, n, "#d27bff", -50 + k * 12, 1.1); c.anim(n, [{ transform: "none" }, { transform: "translateX(-14px) rotate(-6deg)" }, { transform: "none" }], 350); c.hit(n); await c.wait(90); }
      await c.wait(600); },
    /* Amnésie Animale : un brouillard violet, la cible oublie (points d'interrogation) et ses PA filent vers le Titan */
    "Amnésie Animale": async (c) => { c.hold(1600); c.banner("Amnésie Animale"); const t = c.tg[0] || c.heroes[0]; if (!t) return; const b = c.pt(t, 0.3), q = c.pt(c.me, 0.45);
      c.puff(b.x, b.y + 20, "rgba(170,80,220,.75)", 8); for (let i = 0; i < 3; i++) { const m = c.mk("annote q", b.x + (i - 1) * 18, b.y - 10); m.textContent = "?"; m.animate([{ transform: "translate(-50%,-50%) scale(0)", opacity: 0 }, { transform: "translate(-50%,-80%) scale(1.2)", opacity: 1, offset: 0.3 }, { transform: "translate(-50%,-160%) scale(1)", opacity: 0 }], { duration: 1000 * c.T, delay: i * 120 * c.T, fill: "both" }); c.later(m, 1300); }
      c.anim(t, [{ transform: "none" }, { transform: "rotate(-10deg)" }, { transform: "rotate(10deg)" }, { transform: "rotate(-6deg)" }, { transform: "none" }], 800); c.hit(t);
      await c.wait(350); for (let i = 0; i < 3; i++) { const o = c.mk("anorb", b.x, b.y + 20, { "--c": "#5fb4ff" }); fly(c, o, { x: b.x + c.rnd(-10, 10), y: b.y + 20 }, q, 600, -50); c.later(o, 650); await c.wait(80); }
      await c.wait(600); },
  };
  const garga = (src) => src && src.name === "Gargandyas";
  /* l'arrivée : le collier se brise, les chaînes volent, le Titan s'écrase sur sa case */
  function gargaEntry(A, n, b, p, T) {
    const dl = 200 * T, du = 1000 * T; const chain = '<svg viewBox="0 0 30 14"><rect x="1.5" y="1.5" width="18" height="11" rx="5.5" fill="none" stroke="#9aa3ad" stroke-width="3"/><rect x="12" y="4" width="16" height="6" rx="3" fill="none" stroke="#6d7680" stroke-width="2.5"/></svg>';
    const sh = axMk(A, "anshadow", p.x, p.y - 4); sh.animate([{ transform: "translate(-50%,-50%) scale(.1)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0.85 }], { duration: du * 0.8, delay: dl, fill: "both" }); axLater(sh, dl + du + 300);
    b.animate([{ transform: `translateY(${-(p.y + 240)}px) scale(1.5)`, opacity: 0 }, { transform: `translateY(${-(p.y + 240)}px) scale(1.5)`, opacity: 1, offset: 0.45 }, { transform: "translateY(0) scale(1.25,.7)", offset: 0.78 }, { transform: "scale(.95,1.08)", offset: 0.9 }, { transform: "none" }], { duration: du, delay: dl, easing: "cubic-bezier(.6,0,1,.6)", fill: "backwards" });
    setTimeout(() => { if (!n.isConnected) return; const q = anFoot(A, n), c0 = axPt(A, n, 0.35); axDust(A, q.x, q.y, 16); pulse(A.el, "shake2");
      const w = axMk(A, "whiteout sg", 0, 0); w.style.background = "#e9c8ff"; w.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 380 }); axLater(w, 400);
      for (let i = 0; i < 10; i++) { const k = axMk(A, "sg ansvg anchain", c0.x, c0.y); k.style.width = "26px"; k.style.height = "12px"; k.innerHTML = chain; const a = (i / 10) * Math.PI * 2, r = axRnd(90, 170);
        k.animate([{ transform: "translate(-50%,-50%) rotate(0)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px),calc(-50% + ${Math.sin(a) * r * 0.6}px)) rotate(${axRnd(360, 900)}deg)`, opacity: 0 }], { duration: 900, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }); axLater(k, 950); }
      for (let i = 0; i < 3; i++) { const r2 = axMk(A, "sg anult", c0.x, c0.y); r2.style.borderColor = "#c77dff"; r2.style.boxShadow = "0 0 20px #c77dff"; r2.style.animationDelay = i * 160 + "ms"; axLater(r2, 1300); }
    }, dl + du * 0.78);
    return dl + du;
  }
  /* entrée de tous les boss des mondes ; Gargandyas a la sienne */
  window.anTitanEntry = (A, F, n, e, b, p, T) => {
    if (garga(e)) return gargaEntry(A, n, b, p, T);
    const dl = 160 * T, du = 900 * T; const sh = axMk(A, "anshadow", p.x, p.y - 4); sh.animate([{ transform: "translate(-50%,-50%) scale(.1)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.8 }], { duration: du * 0.75, delay: dl, fill: "both" }); axLater(sh, dl + du + 200);
    b.animate([{ transform: `translateY(${-(p.y + 200)}px) scale(1.4)`, opacity: 0 }, { transform: `translateY(${-(p.y + 200)}px) scale(1.4)`, opacity: 1, offset: 0.5 }, { transform: "translateY(0) scale(1.2,.75)", offset: 0.8 }, { transform: "none" }], { duration: du, delay: dl, easing: "cubic-bezier(.6,0,1,.6)", fill: "backwards" });
    setTimeout(() => { if (!n.isConnected) return; const q = anFoot(A, n); axDust(A, q.x, q.y, 14); pulse(A.el, "shake2"); const w = axMk(A, "whiteout sg", 0, 0); w.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 300 }); axLater(w, 320); }, dl + du * 0.8);
    return dl + du;
  };
  /* attaque ultime des boss des mondes (tours 4, 8 et 12) : l'écran s'assombrit, le Titan grandit, puis son attaque frappe toute l'équipe */
  const ULT = { 2513: ["Gargameha", "#c77dff"], 849: ["Hiver éternel", "#9fe3ff"], 841: ["Forêt vengeresse", "#7bc043"], 993: ["Fin des temps", "#9fd6ff"], 640: ["Grande Faim", "#e0382b"], 1106: ["Midas", "#ffd84d"], 1628: ["Jugement", "#fff3b0"], 976: ["Machine ultime", "#ffb347"], 1208: ["Trou noir", "#b06cff"] };
  async function ultime(c) { const src = c.src, U = ULT[src.img] || ["Attaque ultime", "#ff3b2f"], sn = c.me, a = c.pt(sn, 0.5);
    c.hold(3400); c.cls("ultdark", true); const dm = c.mkg("sgdim", 0, 0); c.later(dm, 3300); c.z(sn, true); c.banner(U[0]);
    c.anim(sn, [{ transform: "none", filter: "none" }, { transform: "scale(1.35) translateY(-12px)", filter: `drop-shadow(0 0 18px ${U[1]}) brightness(1.3)` }], { duration: 900, fill: "forwards" });
    for (let i = 0; i < 3; i++) { const r = c.mk("anult", a.x, a.y); r.style.borderColor = U[1]; r.style.boxShadow = `0 0 20px ${U[1]}`; r.style.animationDelay = i * 220 + "ms"; c.later(r, 1600); }
    await c.wait(1000); c.whiteout(220); c.shake("shake2"); c.cls("rumble", true);
    if (garga(src)) { // Gargameha : rochers sur chaque héros et le sol se fend
      const cr = c.bg("ancrack", 0, 0); c.later(cr, 1800);
      for (const n of c.heroes) { const f = c.foot(n), r = R(c, n); const rk = c.mk("anrock", f.x, -20); rk.style.width = rk.style.height = r.width * 0.55 + "px"; rk.animate([{ top: "-20px", transform: "translate(-50%,-50%) rotate(0)" }, { top: f.y - r.height * 0.3 + "px", transform: "translate(-50%,-50%) rotate(260deg)" }], { duration: 380 * c.T, easing: "ease-in", fill: "forwards" }); c.later(rk, 420);
        setTimeout(() => { c.dust(f.x, f.y, 5); burst(c, f.x, f.y - r.height * 0.3, "#8a6a3a", 8, 50, 500, 7); }, 380 * c.T); await c.wait(110); }
      await c.wait(300); }
    for (const n of c.heroes) { c.anim(n, [{ transform: "none" }, { transform: "translateX(-26px) rotate(-12deg)", offset: 0.3 }, { transform: "none" }], 600); c.hit(n); await c.wait(70); }
    c.flush(); await c.wait(700); c.cls("rumble", false); c.cancel(sn); c.z(sn, false); c.cls("ultdark", false); dm.remove(); await c.wait(200); }
  /* choix de l'animation d'un tour de boss ; null = rien de spécial.
     first = true : l'ultime des boss des mondes, une fois à partir des tours 4, 8 et 12 (il passe avant les mécaniques) ; sinon : les sorts de Gargandyas */
  window.anBossPick = (F, A, src, cast, hitsLeft, first) => {
    if (!hitsLeft.length || !src.boss) return null;
    if (first) { const t = F.round >= 12 ? 3 : F.round >= 8 ? 2 : F.round >= 4 ? 1 : 0; if (!F.wboss || t <= (A.anUlt || 0)) return null; A.anUlt = t; return ultime; }
    if (garga(src) && cast.msp && GARGA[cast.msp]) return GARGA[cast.msp];
    return null;
  };
})();
