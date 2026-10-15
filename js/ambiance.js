/* 1.2 « Réorganisation des menus » (Mathis 13A-19A) : effet d'ambiance du thème, dessiné sur un canvas fixe par-dessus la page
   (comme les braises de l'Halouine) : lucioles (Émeraude), étoiles et poussière (Nuit violette), flocons (Givre), étincelles (Ambre),
   braises (Braise), bulles (Écume). AMB.start(nom, intensité) ; AMB.stop(). Une seule boucle, en pause quand l'onglet est caché. */
(function () {
  "use strict";
  const R = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  /* chaque effet : n particules pour 640×400 à intensité 1, init(p, w, h, first), step(p, w, h, dt), draw(ctx, p, t), bg?(ctx, w, h, t) */
  const FX = {
    lucioles: { n: 18, init(p, w, h) { p.x = R(0, w); p.y = R(0, h); p.vx = R(-8, 8); p.vy = R(-6, 6); p.ph = R(0, TAU); p.sp = R(.6, 1.4); p.r = R(1.6, 2.6); },
      step(p, w, h, dt) { p.vx += R(-4, 4) * dt; p.vy += R(-4, 4) * dt; p.vx *= .995; p.vy *= .995; p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10; if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10; },
      draw(c, p, t) { const a = Math.max(0, Math.sin(p.ph + t * p.sp)) ** 3; if (a < .02) return; c.globalAlpha = a; c.shadowBlur = 14; c.shadowColor = "#d8ff7a"; c.fillStyle = "#eaffb0"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); } },
    etoiles: { n: 40, init(p, w, h) { p.x = R(0, w); p.y = R(0, h * .7); p.ph = R(0, TAU); p.sp = R(.4, 1.1); p.r = R(.6, 1.6); p.shoot = 0; },
      step(p, w, h, dt) { if (p.shoot > 0) { p.shoot -= dt; p.sx += 420 * dt; p.sy += 180 * dt; } else if (Math.random() < .0009) { p.shoot = .7; p.sx = R(0, w * .8); p.sy = R(0, h * .3); } },
      draw(c, p, t) { c.globalAlpha = .35 + .65 * Math.abs(Math.sin(p.ph + t * p.sp)); c.fillStyle = "#fff6e0"; c.shadowBlur = 6; c.shadowColor = "#d9c3ff"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
        if (p.shoot > 0) { c.globalAlpha = p.shoot; const g = c.createLinearGradient(p.sx - 90, p.sy - 38, p.sx, p.sy); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "#fff"); c.strokeStyle = g; c.lineWidth = 1.6; c.beginPath(); c.moveTo(p.sx - 90, p.sy - 38); c.lineTo(p.sx, p.sy); c.stroke(); } } },
    poussiere: { n: 30, init(p, w, h, f) { p.x = R(0, w); p.y = f ? R(0, h) : h + 10; p.vy = R(-14, -6); p.ph = R(0, TAU); p.r = R(1, 2.2); p.hue = R(260, 300); },
      step(p, w, h, dt) { p.y += p.vy * dt; p.x += Math.sin(p.ph + p.y / 30) * 10 * dt; if (p.y < -10) { p.y = h + 10; p.x = R(0, w); } },
      draw(c, p, t) { c.globalAlpha = .25 + .45 * Math.abs(Math.sin(p.ph + t)); c.fillStyle = `hsl(${p.hue},90%,78%)`; c.shadowBlur = 10; c.shadowColor = `hsl(${p.hue},90%,70%)`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); } },
    nuit: { n: 0, mix: ["etoiles", "poussiere"], init() {}, step() {}, draw() {} }, // 15D : le mélange des deux
    flocons: { n: 45, init(p, w, h, f) { p.x = R(0, w); p.y = f ? R(0, h) : -10; p.vy = R(14, 38); p.r = R(1, 3); p.ph = R(0, TAU); p.sw = R(6, 16); },
      step(p, w, h, dt) { p.y += p.vy * dt; p.x += Math.sin(p.ph + p.y / 45) * p.sw * dt; if (p.y > h + 10) { p.y = -10; p.x = R(0, w); } if (p.x > w + 10) p.x = -10; if (p.x < -10) p.x = w + 10; },
      draw(c, p) { c.globalAlpha = .55 + p.r * .12; c.fillStyle = "#f4fbff"; c.shadowBlur = 4; c.shadowColor = "#bfe9ff"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); } },
    etincelles: { n: 16, init(p, w, h, f) { p.x = R(0, w); p.y = f ? R(0, h) : h + 6; p.vx = R(-20, 20); p.vy = R(-70, -30); p.life = R(1.2, 2.6); p.t = f ? R(0, p.life) : 0; p.r = R(.8, 1.6); },
      step(p, w, h, dt) { p.t += dt; p.vy += 28 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life || p.y > h + 10) { p.t = 0; p.x = R(0, w); p.y = h + 6; p.vx = R(-20, 20); p.vy = R(-70, -30); } },
      draw(c, p) { const k = 1 - p.t / p.life; c.globalAlpha = Math.max(0, k); c.fillStyle = k > .5 ? "#fff1c0" : "#ffb347"; c.shadowBlur = 8; c.shadowColor = "#ff9a2e"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); c.strokeStyle = c.fillStyle; c.lineWidth = .8; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); c.stroke(); } },
    braises: { n: 26, init(p, w, h, f) { p.x = R(0, w); p.y = f ? R(0, h) : h + 10; p.vy = R(-32, -12); p.ph = R(0, TAU); p.r = R(1.2, 2.6); p.sw = R(8, 20); },
      step(p, w, h, dt) { p.y += p.vy * dt; p.x += Math.sin(p.ph + p.y / 35) * p.sw * dt; if (p.y < -10) { p.y = h + 10; p.x = R(0, w); } },
      draw(c, p, t) { c.globalAlpha = .45 + .5 * Math.abs(Math.sin(p.ph + t * 2)); c.fillStyle = "#ffb04a"; c.shadowBlur = 10; c.shadowColor = "#ff6a2a"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); } },
    bulles: { n: 22, init(p, w, h, f) { p.x = R(0, w); p.y = f ? R(0, h) : h + 10; p.vy = R(-40, -16); p.r = R(1.5, 5); p.ph = R(0, TAU); },
      step(p, w, h, dt) { p.y += p.vy * dt; p.x += Math.sin(p.ph + p.y / 30) * 12 * dt; if (p.y < -10) { p.y = h + 10; p.x = R(0, w); } },
      draw(c, p) { c.globalAlpha = .55; c.strokeStyle = "rgba(190,255,240,.9)"; c.lineWidth = 1; c.shadowBlur = 4; c.shadowColor = "#7fe8d6"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke(); c.fillStyle = "rgba(255,255,255,.9)"; c.beginPath(); c.arc(p.x - p.r * .35, p.y - p.r * .35, p.r * .25, 0, TAU); c.fill(); } },
  };
  let cv = null, st = null, raf = 0, last = 0, bgOn = false, bgcv = null, bgCol = null, bgAt = 0;
  const make = (e, w, h, k) => { const n = Math.round(e.n * k * (w * h) / (640 * 400)); const ps = []; for (let i = 0; i < n; i++) { const p = {}; e.init(p, w, h, true); ps.push(p); } return ps; };
  function fit() { if (!cv || !st) return; const w = Math.max(320, window.innerWidth), h = Math.max(320, window.innerHeight); if (cv.width === w && cv.height === h) return; cv.width = w; cv.height = h; st.layers = st.names.map((n) => ({ e: FX[n], ps: make(FX[n], w, h, st.k) })); }
  /* 1.2.6.2 « Jeu fluide » : le fond de page animé (halos qui dérivent + rideau d'aurore, variante G) était fait de deux couches CSS
     de 150 % de l'écran qui bougeaient en continu : le navigateur recomposait 2 × 2,25 écrans de pixels à chaque image (≈ 20 images/s
     mesurées, même animations en pause, dès que les particules bougeaient). Il est maintenant peint dans une toute petite toile
     (1/8 de l'écran, agrandie et donc floutée gratuitement) derrière la page, avec exactement les mêmes dégradés et le même mouvement. */
  const BGR = 8;
  const rgba = (v) => { const m = String(v).match(/[\d.]+/g); return m && m.length >= 3 ? [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1] : [0, 0, 0, 0]; };
  const col = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${c[3] * a})`;
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x))); // proche de ease-in-out
  function bgFit() { if (!bgcv) return; const w = Math.max(40, Math.round(window.innerWidth / BGR)), h = Math.max(40, Math.round(window.innerHeight / BGR)); if (bgcv.width !== w || bgcv.height !== h) { bgcv.width = w; bgcv.height = h; } }
  function bgDraw(t) {
    if (!bgcv) return; if (!bgCol || t - bgAt > 5) { bgAt = t; /* les couleurs suivent le thème (et l'Halouine qui arrive à minuit) */ const cs = getComputedStyle(document.documentElement); bgCol = [rgba(cs.getPropertyValue("--bg1")), rgba(cs.getPropertyValue("--bg2"))]; }
    const c = bgcv.getContext("2d"), W = window.innerWidth, H = window.innerHeight, [c1, c2] = bgCol;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bgcv.width, bgcv.height); c.setTransform(bgcv.width / W, 0, 0, bgcv.height / H, 0, 0);
    const LW = W * 1.5, LH = H * 1.5; // la couche fait 150 % de l'écran, centrée (comme avant)
    // halos : bgaur 20 s aller-retour, translate(-5 %, 4 %) scale(1.08) rotate(2deg) au bout
    let u = (t / 20) % 2; if (u > 1) u = 2 - u; const e = ease(u);
    c.save(); c.translate(W / 2 - 0.05 * LW * e, H / 2 + 0.04 * LH * e); c.rotate(2 * Math.PI / 180 * e); c.scale(1 + 0.08 * e, 1 + 0.08 * e); c.translate(-LW / 2, -LH / 2);
    const halo = (cx, cy, rx, ry, C) => { c.save(); c.translate(cx * LW, cy * LH); c.scale(1, (ry * LH) / (rx * LW)); const r = rx * LW, g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, col(C, 1)); g.addColorStop(0.7, col(C, 0)); c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r); c.restore(); };
    halo(0.72, 0.18, 0.45, 0.35, c1); halo(0.18, 0.82, 0.38, 0.32, c2); c.restore();
    // rideau : bgmix 18 s, opacité 0 → .75 (35 %) → .45 (70 %) → 0, translateX(-18 % → 18 %) skewX(-12° → -18°)
    const p = (t / 18) % 1, k = ease(p);
    const op = p < 0.35 ? 0.75 * ease(p / 0.35) : p < 0.7 ? 0.75 - 0.3 * ease((p - 0.35) / 0.35) : 0.45 * (1 - ease((p - 0.7) / 0.3));
    if (op > 0.01) {
      c.save(); c.globalAlpha = op; c.translate(W / 2 + (-0.18 + 0.36 * k) * LW, H / 2); c.transform(1, 0, Math.tan(-(12 + 6 * k) * Math.PI / 180), 1, 0, 0);
      const a = 100 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L = Math.abs(LW * dx) + Math.abs(LH * dy);
      const g = c.createLinearGradient(-dx * L / 2, -dy * L / 2, dx * L / 2, dy * L / 2);
      [[0.24, c1, 0], [0.42, c1, 1], [0.6, c1, 0], [0.64, c2, 0], [0.8, c2, 1], [0.96, c2, 0]].forEach(([o, C, a]) => g.addColorStop(o, col(C, a)));
      c.fillStyle = g; c.fillRect(-LW / 2, -LH / 2, LW, LH); c.restore();
    }
  }
  function loop(now) {
    raf = 0; if (!st && !bgOn) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) { last = 0; return; } // onglet caché : rien à dessiner, mais la boucle reste prête
    if (last && now - last < 31) return; // 1.2.6.2 : 30 images/s suffisent à ces mouvements lents, la page garde le reste pour elle
    const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now; const t = now / 1000;
    if (bgOn) bgDraw(t);
    if (!st || !cv) return;
    const c = cv.getContext("2d"); const w = cv.width, h = cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.shadowBlur = 0;
    for (const L of st.layers) { if (L.e.bg) { L.e.bg(c, w, h, t); c.shadowBlur = 0; } for (const p of L.ps) { L.e.step(p, w, h, dt); L.e.draw(c, p, t); c.shadowBlur = 0; } }
    c.globalAlpha = 1;
  }
  const kick = () => { if (!raf && (st || bgOn)) raf = requestAnimationFrame(loop); };
  function start(name, k = 1) {
    const e = FX[name]; if (!e) return stop();
    if (st && st.name === name && st.k === k) return;
    if (!cv) { cv = document.createElement("canvas"); cv.id = "ambfx"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv); window.addEventListener("resize", fit); }
    st = { name, k, names: e.mix || [name], layers: [] }; cv.width = 0; fit(); last = 0; document.body.classList.add("amb-on"); // les poussières des décors (js/decors.js) s'effacent : l'ambiance suffit
    kick();
  }
  function stop() { st = null; document.body.classList.remove("amb-on"); if (!bgOn && raf) { cancelAnimationFrame(raf); raf = 0; } if (cv) { cv.remove(); cv = null; window.removeEventListener("resize", fit); } }
  /* fond animé : AMB.bg(true) l'allume (et relit les couleurs du thème), AMB.bg(false) l'éteint */
  function bg(on) {
    bgCol = null;
    if (on) { if (!bgcv) { bgcv = document.createElement("canvas"); bgcv.id = "ambbg"; bgcv.setAttribute("aria-hidden", "true"); document.body.prepend(bgcv); window.addEventListener("resize", bgFit); } bgOn = true; bgFit(); bgDraw(performance.now() / 1000); last = 0; kick(); return; }
    bgOn = false; if (bgcv) { bgcv.remove(); bgcv = null; window.removeEventListener("resize", bgFit); } if (!st && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  window.AMB = { start, stop, bg, names: Object.keys(FX), get on() { return st ? st.name : null; } };
})();
