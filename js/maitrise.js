/* ============================================================================
   IDLUS 2.0 — LA MAÎTRISE : l'affichage (page Héros › Maîtrise, DX.pages.maitrise)
   Onglets Arbre (ciel de constellation par classe, 3 arbres enregistrés, recherche, chemin vers une étoile, annuler,
   comparer, partager, joyaux), Bestiaire et Classement ; ligne de la fiche du héros, aura des clés de voûte
   dans la Scène, ornements du Bestiaire. Le moteur est dans js/maitrise_moteur.js.
   Actions « mt-… » relayées par ui.js.
   ========================================================================== */
(function () {
  "use strict";
  if (!window.DX) return;
  const E = window.DX.E; const D = window.DATA; const { CLASSES, MONSTERS } = D;
  const TAU = Math.PI * 2;
  if (!E.mtTree) return; // moteur : js/maitrise_moteur.js
  const build = E.mtTree, JOY = E.JOY, DOM = E.MT_DOM, FORT = E.MT_FORT; const CLS_IDX = () => D.CLASS_ORDER || Object.keys(CLASSES);

  /* ============================== affichage ============================== */
  const X = () => window.DX.social; const h = (s) => X().h(s); const IC = (n) => X().IC(n);
  const S = () => window.DX.S; const ui = () => window.DX.ui;
  const fmt = (n) => Math.floor(n).toLocaleString("fr-FR");
  const pctf = (a, b) => Math.max(0, Math.min(100, b ? (a / b) * 100 : 0));
  const sym = (cls) => `assets/h/${cls}_sym.png`;
  const st = { tab: "arbre", cid: null, view: null, z: 0, ox: 0, oy: 0, sel: null, hov: null, q: "", hist: [], cmp: null, share: false, fam: "all", key: "", draft: null, peek: null, anim: null, mm: null };
  const IMG = {}; const img = (k, src) => { if (!IMG[k]) { const i = new Image(); i.onload = () => { BK = ""; draw(); }; i.src = src; IMG[k] = i; } return IMG[k]; };
  const hero = () => { const s = S(); let c = s.chars.find((x) => x.id === st.cid); if (!c) { c = s.chars.slice().sort((a, b) => b.lvl - a.lvl || ((b.mt && b.mt.lvl) || 0) - ((a.mt && a.mt.lvl) || 0))[0]; st.cid = c ? c.id : null; } return c; };
  const treeCls = () => st.view || hero().cls;
  const canEdit = () => !st.view && E.mtOn(hero());
  let got = new Set();
  const loadGot = () => { const c = hero(); const T = build(treeCls()); got = st.view ? new Set([T.start, ...(st.peek && st.peek.cls === treeCls() ? st.peek.ids.filter((id) => T.N[id]) : [])]) : E.mtGot(c); }; // 2.1 (15A) : arbre d'un joueur du classement, en lecture seule
  /* 2.0.4 (choix de Mathis 3B) : rendre des étoiles coûte pareil partout (une étoile, un autre arbre enregistré, un code, Tout rendre) : E.MT_RESPEC par point rendu au-delà des E.MT_FREE premiers */
  const respecCost = (n) => (E.mtFreeWeek && E.mtFreeWeek() ? 0 : Math.max(0, Math.min(n, used() - E.MT_FREE)) * E.MT_RESPEC);
  const payRespec = (n, what) => { const cost = respecCost(n); if (!cost) return true; if (cost > S().kamas) { X().toast(`Pas assez de kamas : ${what} coûte ${fmt(cost)} kamas.`, "info"); return false; } if (n > 1 && !confirm(`${what.charAt(0).toUpperCase() + what.slice(1)} rend ${n} points et coûte ${fmt(cost)} kamas. Continuer ?`)) return false; S().kamas -= cost; st.hist = []; st.paid = true; return true; };
  const pushHist = (h) => { st.hist.push(h); if (st.hist.length > E.MT_UNDO) st.hist.shift(); };
  const pts = () => (st.view ? E.MT_OPEN + 200 : E.mtPts(hero()));
  const used = () => got.size - 1;
  const nebOpen = () => pts() >= E.MT_OPEN;
  const T = () => build(treeCls());
  let GC = null; const gatesSet = () => { const t = performance.now(); if (!GC || t - GC.t > 400) GC = { t, s: new Set(E.mtGatesOpen(S())) }; return GC.s; };
  const gateOpen = (pid) => gatesSet().has(T().N[pid].gate.b); /* 2.1.2 : lu une fois, pas pour chaque étoile parcourue */ // 2.1 : Portes des étoiles (pour tout le compte)
  const allowed = (id) => { const n = T().N[id]; return n.t !== "start" && !(n.neb && !nebOpen()) && !(n.gated != null && !gateOpen(n.gated)); };
  const pathTo = (t, base) => { const N = T().N; const B = base || got; if (B.has(t)) return []; if (!allowed(t)) return null;
    const prev = new Map(); const q = [...B]; q.forEach((x) => prev.set(x, -1)); let hd = 0;
    while (hd < q.length) { const x = q[hd++]; if (x === t) break; for (const y of N[x].adj) { if (!allowed(y) || prev.has(y)) continue; prev.set(y, x); q.push(y); } }
    if (!prev.has(t)) return null; const p = []; let x = t; while (!B.has(x)) { p.push(x); x = prev.get(x); } return p.reverse(); };
  /* 2.1 (13A) : rendre une étoile prise rend aussi celles qui ne sont plus reliées au départ sans elle */
  const cutSet = (rm) => { const N = T().N, s0 = T().start; const seen = new Set([s0]); const q = [s0]; while (q.length) { const x = q.pop(); for (const y of N[x].adj) if (got.has(y) && y !== rm && !seen.has(y)) { seen.add(y); q.push(y); } } return [...got].filter((x) => !seen.has(x)); };
  const draftSet = () => new Set([...got, ...(st.draft || [])]);
  const connectedWithout = (rm) => { const N = T().N, s0 = T().start; const seen = new Set([s0]); const q = [s0]; while (q.length) { const x = q.pop(); for (const y of N[x].adj) if (got.has(y) && y !== rm && !seen.has(y)) { seen.add(y); q.push(y); } } return seen.size === got.size - 1; };
  const save = () => { if (st.view) return; const M = E.mt(hero()); M.t[M.lo] = [...got].filter((x) => x !== T().start); for (const id in M.j) if (!got.has(+id)) delete M.j[id]; }; // 2.0.3 : une étoile rendue rend son joyau
  const domCol = (n) => (n.t === "start" || n.t === "cls" || n.t === "cks" ? CLASSES[treeCls()].color : n.col || DOM[n.d].c);

  /* ---------- dessin ---------- */
  let cv = null, g = null, W = 0, H = 0, dpr = 1;
  const toS = (n) => [W / 2 + (n.X + st.ox) * st.z, H / 2 + (n.Y + st.oy) * st.z];
  const BASE = { s: 8, cls: 8, joy: 8, nt: 15, ks: 24, cks: 26, start: 30 };
  const rad = (n) => BASE[n.t] * (n.big ? 1.5 : 1) * Math.max(0.45, Math.min(1.5, st.z));
  const hits = () => { const q = norm(st.q.trim()); return new Set(q.length < 2 ? [] : T().N.filter((n) => n.t !== "start" && !(n.neb && !nebOpen()) && norm(n.n + " " + n.txt).includes(q)).map((n) => n.id)); };
  const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  /* 2.1.2 : un seul dessin par image (la souris envoie bien plus d'événements que l'écran n'affiche d'images) ; sans halos pendant un déplacement */
  let RAF = 0, FAST = false, FT = 0;
  function draw() { if (RAF) return; RAF = requestAnimationFrame(() => { RAF = 0; drawNow(); }); }
  const moving = () => { FAST = true; clearTimeout(FT); FT = setTimeout(() => { FAST = false; draw(); }, 160); };
  /* 2.1.2 : le ciel est gardé en image tant que la vue et les étoiles prises ne changent pas ; le survol ne redessine que le chemin et la bulle par-dessus */
  let BK = "", OFF = null;
  function drawNow() {
    if (!g || !cv || !cv.isConnected) return; const hv = st.hov; const sumOf = (it) => { let t = 0, n = 0; for (const x of it) { t += x * 7 + 1; n++; } return n + ":" + t; };
    const key = st.anim ? "" : [treeCls(), W, H, dpr, st.z, st.ox, st.oy, sumOf(got), st.draft ? sumOf(st.draft) : "-", st.sel, st.q, FAST, [...gatesSet()].join(), nebOpen(), st.view ? "v" + (st.peek ? st.peek.ids.length : 0) : E.mt(hero()).obj + JSON.stringify(E.mt(hero()).j), pts(), (S().joy || []).length].join("|");
    const lo = FAST && dpr > 1; const wd = lo ? Math.ceil(W) : cv.width, ht = lo ? Math.ceil(H) : cv.height; // pendant un déplacement : le ciel en basse définition, net dès l'arrêt
    if (!key || key !== BK || !OFF || OFF.width !== wd) { if (!OFF || OFF.width !== wd || OFF.height !== ht) { OFF = document.createElement("canvas"); OFF.width = wd; OFF.height = ht; }
      const g0 = g, d0 = dpr; g = OFF.getContext("2d"); if (lo) dpr = 1; st.hov = null; try { drawBase(); } finally { g = g0; dpr = d0; st.hov = hv; } BK = key; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(OFF, 0, 0, cv.width, cv.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (hv != null && hv !== st.sel) hoverLayer(hv);
    tip(hv != null ? hv : st.sel);
  }
  function hoverLayer(id) {
    const N = T().N; if (!canEdit() || (N[id].neb && !nebOpen())) return;
    if (got.has(id)) { if (st.draft) return; const C = new Set(cutSet(id)); g.strokeStyle = "#ff7b7b"; g.lineWidth = Math.max(1, 2.6 * st.z); g.beginPath(); C.forEach((x) => N[x].adj.forEach((y) => { if ((C.has(y) || got.has(y)) && (C.has(y) ? x < y : true)) { const [ax, ay] = toS(N[x]), [bx, by] = toS(N[y]); g.moveTo(ax, ay); g.lineTo(bx, by); } })); g.stroke(); C.forEach((x) => { const [px, py] = toS(N[x]); ring(px, py, rad(N[x]) + 5, "#ff7b7b"); }); return; }
    const DS = st.draft ? draftSet() : got; if (st.draft && DS.has(id)) return; const p = pathTo(id, DS); if (!p || !p.length) return; const on = new Set(DS);
    g.setLineDash(st.draft ? [7, 6] : []); g.strokeStyle = "rgba(240,195,90,.9)"; g.lineWidth = Math.max(1, 2 * st.z); g.beginPath();
    p.forEach((x) => { const y = N[x].adj.find((z) => on.has(z)); if (y != null) { const [ax, ay] = toS(N[x]), [bx, by] = toS(N[y]); g.moveTo(ax, ay); g.lineTo(bx, by); } on.add(x); }); g.stroke(); g.setLineDash([]);
    p.forEach((x) => { const n = N[x]; const [px, py] = toS(n); const r = n.t === "s" ? rad(n) : rad(n) * 0.8; g.fillStyle = n.t === "ks" || n.t === "cks" ? "rgba(255,159,90,.75)" : "rgba(240,195,90,.7)"; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); });
  }
  function drawBase() {
    const Tr = T(), N = Tr.N, cc = CLASSES[Tr.cls].color, HIT = hits();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const fo = st.hov != null ? st.hov : st.sel; const DS = st.draft ? draftSet() : null; const path = fo != null && !got.has(fo) && canEdit() && !(DS && DS.has(fo)) ? pathTo(fo, DS) || [] : []; const ps = new Set(path);
    const OB = fo == null && !st.draft && canEdit() && E.mt(hero()).obj != null ? (st.objC && st.objC[0] === `${E.mt(hero()).obj}:${got.size}:${treeCls()}` ? st.objC[1] : (st.objC = [`${E.mt(hero()).obj}:${got.size}:${treeCls()}`, objPath()])[1]) : null; if (OB) OB.forEach((i) => ps.add(i)); /* 2.1 (12A) : chemin vers l'objectif épinglé */ if (st.draft) st.draft.forEach((i) => ps.add(i)); const CUT = fo != null && got.has(fo) && canEdit() && !st.draft ? new Set(cutSet(fo)) : null; // 2.1 : brouillon (5A), étoiles rendues avec (13A)
    /* Nébuleuse */
    { const c0 = [W / 2 + st.ox * st.z, H / 2 + (1880 + st.oy) * st.z], R = 420 * st.z; const gr = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], R);
      gr.addColorStop(0, nebOpen() ? "rgba(196,155,255,.30)" : "rgba(160,150,200,.22)"); gr.addColorStop(1, "rgba(160,150,200,0)"); g.fillStyle = gr; g.beginPath(); g.arc(c0[0], c0[1], R, 0, TAU); g.fill();
      if (!nebOpen()) { g.save(); g.textAlign = "center"; g.fillStyle = "rgba(220,210,255,.8)"; g.font = `400 ${Math.max(13, 34 * st.z)}px Kavoon, Georgia, serif`; g.fillText("? ? ?", c0[0], c0[1]); g.font = `800 ${Math.max(11, 20 * st.z)}px Nunito, system-ui, sans-serif`; g.fillText(`Nébuleuse cachée · ${fmt(E.MT_OPEN)} points`, c0[0], c0[1] + Math.max(18, 40 * st.z)); g.restore(); } }
    /* symbole allumé */
    if (Tr.coreIds.every((id) => got.has(id))) { const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const [x, y] = toS(N[Tr.start]); const s = 330 * st.z; g.save(); g.globalAlpha = 0.34; g.shadowColor = cc; g.shadowBlur = 50; g.drawImage(im, x - s / 2, y - s / 2, s, s); g.restore(); } }
    /* liens */
    const GO = gatesSet(); const SH = FAST || got.size > 350 ? 0 : 1; const shut = (n) => n.gated != null && !n.gate && !GO.has(N[n.gated].gate.b); // 2.1 : branches fermées en retrait
    const EB = new Map();
    for (const [a, b] of Tr.ED) {
      if ((N[a].neb || N[b].neb) && !nebOpen()) continue;
      const A = toS(N[a]), B = toS(N[b]); if ((A[0] < -60 && B[0] < -60) || (A[0] > W + 60 && B[0] > W + 60) || (A[1] < -60 && B[1] < -60) || (A[1] > H + 60 && B[1] > H + 60)) continue;
      const on = got.has(a) && got.has(b), pp = (ps.has(a) || got.has(a)) && (ps.has(b) || got.has(b)) && (ps.has(a) || ps.has(b));
      const core = ["cls", "start", "cks"].includes(N[a].t) && ["cls", "start", "cks"].includes(N[b].t);
      const oc = on ? domCol(N[N[b].t === "start" ? a : b]) : null; // 2.1 (2A) : le chemin pris prend la couleur de sa voie
      const col = on ? (CUT && (CUT.has(a) || CUT.has(b)) ? "#ff7b7b" : oc) : pp ? "rgba(240,195,90,.9)" : core ? cc + "88" : "rgba(170,180,255,.16)";
      const key = `${(st.draft || OB) && pp && !on ? 1 : 0}|${col}|${on ? 2.6 : core ? 2 : 1.4}|${shut(N[a]) || shut(N[b]) ? 0.3 : 1}|${on && SH ? 1 : 0}`; let L = EB.get(key); if (!L) EB.set(key, (L = [])); L.push(A[0], A[1], B[0], B[1]);
    }
    /* 2.1.2 : un seul tracé par style de lien (avant : un tracé par lien, plus de 2 000 par image) */
    EB.forEach((L, key) => { const [ds, col, w, al, sh] = key.split("|"); g.setLineDash(ds === "1" ? [7, 6] : []); g.strokeStyle = col; g.lineWidth = Math.max(1, +w * st.z); g.globalAlpha = +al; if (sh === "1") { g.shadowColor = col; g.shadowBlur = 8; }
      g.beginPath(); for (let i = 0; i < L.length; i += 4) { g.moveTo(L[i], L[i + 1]); g.lineTo(L[i + 2], L[i + 3]); } g.stroke(); g.shadowBlur = 0; });
    g.globalAlpha = 1; g.setLineDash([]);
    /* domaines */
    if (st.z > 0.1) { g.save(); g.font = `400 ${Math.max(14, 30 * st.z)}px Kavoon, Georgia, serif`; g.textAlign = "center";
      DOM.forEach((D0, d) => { if (Tr.domTh[d] == null) return; const R = 1680; let x = W / 2 + (Math.sin(Tr.domTh[d]) * R + st.ox) * st.z, y = H / 2 + (-Math.cos(Tr.domTh[d]) * R + st.oy) * st.z; const tw = g.measureText(D0.n).width / 2; if (x > -tw && x < W + tw && y > -20 && y < H + 30) { x = Math.max(tw + 8, Math.min(W - tw - 8, x)); y = Math.max(28, Math.min(H - 10, y)); } g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.7)"; g.strokeText(D0.n, x, y); g.fillStyle = D0.c; g.fillText(D0.n, x, y); }); g.restore(); }
    /* étoiles */
    const M = st.view ? { j: {} } : E.mt(hero()); const SM0 = new Path2D(), SM1 = new Path2D();
    for (const n of N) {
      if (n.neb && !nebOpen()) continue;
      const [x, y] = toS(n); if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      const r = rad(n), on = got.has(n.id), pp = ps.has(n.id), dc = domCol(n); const lock = n.gated != null && !gateOpen(n.gated); g.globalAlpha = lock && !n.gate ? 0.38 : 1;
      if (n.gate && st.z > 0.25) { g.save(); g.font = `800 ${Math.max(11, 15 * Math.min(1, st.z * 1.6))}px Nunito, system-ui, sans-serif`; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; const t0 = lock ? `🔒 ${n.gate.b} · stasis ${n.gate.s}+` : n.gate.b; const yy = y - r - 9 - 60 * st.z; g.strokeText(t0, x, yy); g.fillStyle = lock ? "#9fe7ff" : "#bdf09b"; g.fillText(t0, x, yy); g.restore(); }
      if (n.t === "start") { g.shadowColor = cc; g.shadowBlur = FAST ? 0 : 26; g.fillStyle = cc; g.strokeStyle = "#e2f5ae"; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.shadowBlur = 0;
        const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const s = r * 1.7; g.drawImage(im, x - s / 2, y - s / 2, s, s); } continue; }
      if (!on && !pp && n.t === "s" && !HIT.has(n.id) && n.id !== st.sel) { const P0 = lock ? SM1 : SM0; P0.moveTo(x + r * 0.42, y); P0.arc(x, y, r * 0.42, 0, TAU); continue; } // 2.1.2 : petites étoiles en un seul tracé
      if (on) { g.shadowColor = n.t === "ks" ? "#ff9f5a" : n.t === "cks" || n.t === "cls" ? cc : "#cfe8ff"; g.shadowBlur = n.t === "s" || n.t === "cls" || n.t === "joy" ? 8 * SH : FAST ? 0 : 16; }
      if (n.t === "ks" || n.t === "cks") { g.beginPath(); for (let q = 0; q < 16; q++) { const a = q * Math.PI / 8 - Math.PI / 2; const rr = q % 2 ? r * 0.62 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath();
        g.fillStyle = on ? (n.t === "cks" ? cc : "#ff9f5a") : pp ? "rgba(255,159,90,.6)" : "#1d1530"; g.fill(); g.lineWidth = 3; g.strokeStyle = n.t === "cks" ? "#e2f5ae" : dc; g.stroke();
        if (n.t === "cks") { const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const s = r * 0.95; g.drawImage(im, x - s / 2, y - s / 2, s, s); } } }
      else if (n.t === "joy") { const J = M.j[n.id] && (S().joy || []).find((z) => z.uid === M.j[n.id]); const jc = J ? JOY[J.k].c : "#7fffd4";
        g.beginPath(); g.moveTo(x, y - r * 1.15); g.lineTo(x + r * 1.15, y); g.lineTo(x, y + r * 1.15); g.lineTo(x - r * 1.15, y); g.closePath(); g.fillStyle = J ? jc : on ? "#7fffd4" : pp ? "rgba(127,255,212,.5)" : "#14302a"; g.fill(); g.lineWidth = 2; g.strokeStyle = J ? "#fff" : "#7fffd4"; g.stroke(); }
      else if (n.t === "nt") { g.beginPath(); for (let q = 0; q < 6; q++) { const a = q * TAU / 6 + TAU / 12; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fillStyle = on ? "#f0c35a" : pp ? "rgba(240,195,90,.55)" : "#221c38"; g.fill(); g.lineWidth = 3; g.strokeStyle = on ? "#fff3c4" : "#c99a3a"; g.stroke(); }
      else { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = on ? dc : pp ? "rgba(240,195,90,.55)" : "#221c38"; g.fill(); g.lineWidth = n.t === "cls" ? 2.5 : 1.8; g.strokeStyle = n.t === "cls" ? "#e2f5ae" : dc; g.stroke(); }
      g.shadowBlur = 0;
      if (n.ic && r > 6) { const im = img("s_" + n.ic, `assets/c/${n.ic}.png`); if (im.naturalWidth) { const s = r * (n.t === "nt" ? 1.25 : 1.3); g.globalAlpha = on ? 1 : 0.7; g.drawImage(im, x - s / 2, y - s / 2, s, s); g.globalAlpha = 1; } }
      else if (n.t === "cls" && r > 6) { const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const s = r * 1.4; g.globalAlpha = on ? 1 : 0.55; g.drawImage(im, x - s / 2, y - s / 2, s, s); g.globalAlpha = 1; } }
      if (n.gate) { g.globalAlpha = 1; ring(x, y, r + 7, lock ? "#9fe7ff" : "#bdf09b"); ring(x, y, r + 13, lock ? "rgba(159,231,255,.4)" : "rgba(189,240,155,.5)"); }
      if (HIT.has(n.id)) ring(x, y, r + 6); if (n.id === st.sel) ring(x, y, r + 4, "#fff"); if (!st.view && n.id === E.mt(hero()).obj) ring(x, y, r + 9, "#f0c35a");
      if (n.end && st.z > 0.12 && st.z <= 0.3) { g.font = `400 ${Math.max(12, 40 * st.z)}px Kavoon, Georgia, serif`; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.75)"; const bw = g.measureText(n.br).width / 2, bx = Math.max(bw + 6, Math.min(W - bw - 6, x)), by = Math.max(22, y - r - 8); const al = g.globalAlpha; g.globalAlpha = Math.max(al, 0.8); g.strokeText(n.br, bx, by); g.fillStyle = n.col; g.fillText(n.br, bx, by); g.globalAlpha = al; } // 2.1 : de loin, le nom de la branche ; de près, celui de sa clé de voûte
      if (((n.t === "ks" || n.t === "cks") && st.z > 0.3) || (n.t === "nt" && st.z > 0.85)) { g.font = `800 ${n.t === "nt" ? 11.5 : 13}px Nunito, system-ui, sans-serif`; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(n.n, x, y - r - 7); g.fillStyle = n.t === "cks" ? "#e2f5ae" : n.t === "ks" ? "#ffd2b0" : "#f6e3b0"; g.fillText(n.n, x, y - r - 7); }
    }
    g.globalAlpha = 1; g.fillStyle = "rgba(200,210,255,.75)"; g.fill(SM0); g.globalAlpha = 0.38; g.fill(SM1); g.globalAlpha = 1;
    if (st.draft) st.draft.forEach((i) => { const [x, y] = toS(N[i]); g.save(); g.setLineDash([4, 4]); g.strokeStyle = "#f0c35a"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rad(N[i]) + 5, 0, TAU); g.stroke(); g.restore(); });
    if (CUT) CUT.forEach((i) => { if (i === fo) return; const [x, y] = toS(N[i]); ring(x, y, rad(N[i]) + 5, "#ff7b7b"); });
    if (st.anim) animDraw(N);
    miniMap(N); objUi();
    const hn = cv.parentNode.querySelector(".mt-hint"); if (hn) hn.hidden = (!st.view && used() > 0) || !!st.draft || !!st.peek || !!cv.parentNode.querySelector(".mt-obj"); // l'aide s'efface dès le premier point placé
  }
  /* 2.0.1 : l'effet d'une étoile s'affiche sur l'arbre, au survol (souris) ou au premier toucher, avec ce que le chemin rapporte */
  const gainOf = (ids) => { if (!ids.length) return [];
    if (st.view) { const t = {}; ids.forEach((id) => (T().N[id].b || []).forEach(([k, v]) => (t[k] = (t[k] || 0) + v))); return Object.entries(t); }
    const A = E.mtStats(S(), hero(), got), B = E.mtStats(S(), hero(), new Set([...got, ...ids]));
    const ks = B.ks.filter((k) => !A.ks.some((a) => a.n === k.n)).map((k) => ["✦ " + k.n, null]);
    return ks.concat(Object.keys(B.t).map((k) => [k, B.t[k] - (A.t[k] || 0)]).filter(([, d]) => d > 0.0001).sort((a, b) => b[1] - a[1]))
      .concat(B.sym && !A.sym ? [["✦ Symbole allumé", null]] : []); };
  /* 2.1 (10A) : part des joueurs de la classe (classement du serveur) qui ont pris cette clé de voûte */
  const popTxt = (n) => { if (!(n.t === "ks" || n.t === "cks") || !RK.rows) return ""; const L = RK.rows.filter((r) => r.cls === treeCls()); if (L.length < 5) return ""; const k = L.filter((r) => (r.all || r.ks).includes(n.n)).length;
    return `<span class="mt-pop">👥 Prise par ${Math.round(k * 100 / L.length)} % des joueurs ${h(CLASSES[treeCls()].name)}</span>`; };
  /* 2.1 (12A) : objectif épinglé (une clé de voûte) ; les nouveaux niveaux y placent leurs points tout seuls */
  const objPath = () => { const c = hero(); const M = E.mt(c); if (M.obj == null || !E.mtOn(c) || got.has(M.obj)) return null; return pathTo(M.obj); };
  function objUi() {
    const box = cv && cv.parentNode; if (!box) return; let el = box.querySelector(".mt-obj"); const c = hero(); const M = st.view ? {} : E.mt(c); const p = M.obj != null && !st.view ? (st.objC && st.objC[0] === `${M.obj}:${got.size}:${treeCls()}` ? st.objC[1] : (st.objC = [`${M.obj}:${got.size}:${treeCls()}`, objPath()])[1]) : null;
    if (!p) { if (el) el.remove(); return; } if (!el) { el = document.createElement("div"); el.className = "mt-obj"; box.appendChild(el); }
    const ok = `${M.obj}:${p.length}:${pts() - used()}`; if (el.dataset.k === ok) return; el.dataset.k = ok;
    const left = Math.max(0, pts() - used()); el.innerHTML = `<span>🎯 <b>${h(T().N[M.obj].n)}</b> · encore ${p.length} point${p.length > 1 ? "s" : ""}${left ? ` (${fmt(left)} à placer : touche-la pour les poser)` : ", posés tout seuls aux prochains niveaux"}</span><button class="btn xs" data-act="mt-pin" data-v="">Retirer</button>`;
  }
  let TK = "";
  function tip(id) {
    const el = cv && cv.parentNode.querySelector(".mt-tip"); if (!el) return;
    if (id == null || T().N[id].t === "start" || (T().N[id].neb && !nebOpen())) { el.hidden = true; TK = ""; return; }
    const tk = `${treeCls()}:${id}:${got.size}:${st.draft ? st.draft.length : -1}:${st.sel}:${RK.at}:${pts()}`; if (tk === TK && !el.hidden) { tipPos(el, T().N[id]); return; } TK = tk; /* 2.1.2 : la bulle ne se recalcule que si elle change */
    const n = T().N[id], on = got.has(id), p = on ? [] : canEdit() ? pathTo(id) || [] : [], left = pts() - used();
    const gl = gainOf(on || st.view ? [id] : p.length ? p : [id]);
    const lkN = n.gated != null && !gateOpen(n.gated) ? T().N[n.gated].gate : null; // 2.1
    const cut = on && canEdit() && !st.draft ? cutSet(id) : null; const cc0 = cut && cut.length > 1 ? respecCost(cut.length) : 0;
    const foot = lkN ? `🔒 Fermée · donjon de ${lkN.b} en stasis ${lkN.s}+` : st.view ? "" : !E.mtOn(hero()) ? "S'ouvre au niveau 200" : st.draft ? (on ? "✓ Prise" : (st.draft.includes(id) ? "Dans le brouillon · touche pour l'enlever" : "Touche pour l'ajouter au brouillon")) : cut && cut.length > 1 ? `Rendre cette étoile et les ${cut.length - 1} qui en dépendent · ${cc0 ? fmt(cc0) + " kamas" : "gratuit"}` : on ? "✓ Prise" + (respecCost(1) ? ` · la rendre coûte ${fmt(respecCost(1))} kamas` : "") + (st.sel === id && !matchMedia("(hover: hover)").matches ? " · touche encore pour la rendre" : "") : !p.length ? "" : p.length <= left ? `Coûte ${p.length} point${p.length > 1 ? "s" : ""}${matchMedia("(hover: hover)").matches ? " · clic pour prendre" : " · touche encore pour prendre"}` : `Chemin de ${p.length} points (${fmt(left)} à placer)`;
    el.innerHTML = `<span class="mt-ty" style="color:${domCol(n)}">${n.gate ? "Porte des étoiles" : TYP[n.t]}${n.br ? ` · ${h(n.br)}` : ""}</span><b>${h(n.n)}</b><span>${h(n.txt)}</span>${gl.length ? `<div class="mt-gain"><i>${on ? "Cette étoile donne" : p.length > 1 ? `Avec le chemin (${p.length} étoiles)` : "Gain"}</i>${gl.slice(0, 6).map(([k, v]) => `<div><span>${h(k)}</span>${v == null ? "" : `<b class="num">+${E.mtNf(v)}</b>`}</div>`).join("")}</div>` : ""}${popTxt(n)}${foot ? `<em class="${cut && cut.length > 1 ? "mt-cut" : ""}">${foot}</em>` : ""}`;
    el.hidden = false; tipPos(el, n);
  }
  function tipPos(el, n) {
    const [x, y] = toS(n); const bw = el.offsetWidth, bh = el.offsetHeight;
    let lx = x + rad(n) + 12, ly = y - bh / 2; if (lx + bw > W - 8) lx = x - rad(n) - 12 - bw; if (lx < 8) { lx = Math.max(8, Math.min(W - bw - 8, x - bw / 2)); ly = y + rad(n) + 12; if (ly + bh > H - 8) ly = y - rad(n) - 12 - bh; }
    el.style.left = Math.round(lx) + "px"; el.style.top = Math.round(Math.max(8, Math.min(H - bh - 8, ly))) + "px";
  }
  /* 2.1 (3A) : mini-carte en bas à gauche, cadre « tu es ici » ; un clic dessus y emmène */
  let MM = null;
  function miniMap(N) {
    st.mm = null; let a = 1e9, b = -1e9, c2 = 1e9, d = -1e9; N.forEach((n) => { if (n.neb && !nebOpen()) return; a = Math.min(a, n.X); b = Math.max(b, n.X); c2 = Math.min(c2, n.Y); d = Math.max(d, n.Y); });
    if (st.z < Math.min(W / (b - a + 360), H / (d - c2 + 260)) * 1.6) return; // presque tout le ciel est déjà à l'écran
    const zb = cv.parentNode.querySelector(".mt-zoom"); const zh = zb && zb.offsetLeft < 120 ? zb.offsetHeight + 8 : 0; const mw = W < 600 ? 92 : 140, mh = mw, mx = 10, my = H - mh - 10 - zh; /* au-dessus des boutons quand ils prennent toute la largeur */ const k = Math.min((mw - 12) / (b - a), (mh - 12) / (d - c2)); const cx = (a + b) / 2, cy = (c2 + d) / 2;
    const mp = (X0, Y0) => [mx + mw / 2 + (X0 - cx) * k, my + mh / 2 + (Y0 - cy) * k];
    g.save(); g.fillStyle = "rgba(8,8,18,.82)"; g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1; g.beginPath(); if (g.roundRect) g.roundRect(mx, my, mw, mh, 10); else g.rect(mx, my, mw, mh); g.fill(); g.stroke();
    const mk = `${treeCls()}:${got.size}:${mw}:${nebOpen()}:${dpr}`; if (!MM || MM.k !== mk) { const oc = document.createElement("canvas"); oc.width = mw * dpr; oc.height = mh * dpr; const q = oc.getContext("2d"); q.scale(dpr, dpr); /* 2.1.2 : les points de la mini-carte sont gardés en image */
      N.forEach((n) => { if (n.neb && !nebOpen()) return; const x = mw / 2 + (n.X - cx) * k, y = mh / 2 + (n.Y - cy) * k; const on = got.has(n.id); q.fillStyle = on ? "#fff" : domCol(n); q.globalAlpha = on ? 1 : 0.4; const w = on ? 2 : 1.3; q.fillRect(x - w / 2, y - w / 2, w, w); }); MM = { k: mk, c: oc }; }
    g.drawImage(MM.c, mx, my, mw, mh);
    g.globalAlpha = 1; const [vx0, vy0] = mp(-st.ox - W / 2 / st.z, -st.oy - H / 2 / st.z), [vx1, vy1] = mp(-st.ox + W / 2 / st.z, -st.oy + H / 2 / st.z);
    const rx = Math.max(mx, vx0), ry = Math.max(my, vy0); g.strokeStyle = "#bdf09b"; g.lineWidth = 1.5; g.strokeRect(rx, ry, Math.max(4, Math.min(mx + mw, vx1) - rx), Math.max(4, Math.min(my + mh, vy1) - ry)); g.restore();
    st.mm = { mx, my, mw, mh, k, cx, cy };
  }
  const miniHit = (x, y) => { const m = st.mm; if (!m || x < m.mx || x > m.mx + m.mw || y < m.my || y > m.my + m.mh) return false; st.ox = -(m.cx + (x - m.mx - m.mw / 2) / m.k); st.oy = -(m.cy + (y - m.my - m.mh / 2) / m.k); draw(); return true; };
  /* 2.1 (1A) : la première fois qu'on ouvre l'arbre après avoir ouvert une Porte, la lumière remonte ses deux branches */
  function animDraw(N) {
    const A = st.anim; const P = N.find((n) => n.gate && n.gate.b === A.b); if (!P) { st.anim = null; return; } const t = Math.min(1, (performance.now() - A.t0) / 2600);
    const B = N.filter((n) => n.gated === P.id && !n.gate).sort((x, y) => Math.hypot(x.X - P.X, x.Y - P.Y) - Math.hypot(y.X - P.X, y.Y - P.Y)); const k = Math.floor(B.length * t);
    B.slice(0, k).forEach((n, i) => { const [x, y] = toS(n); g.save(); g.globalAlpha = (0.35 + 0.65 * (i / Math.max(1, k))) * (t < 1 ? 1 : 0.5); g.shadowColor = n.col; g.shadowBlur = 26; g.fillStyle = n.col; g.beginPath(); g.arc(x, y, rad(n) * 0.9, 0, TAU); g.fill(); g.restore(); });
    const [px, py] = toS(P); const R0 = 140 * Math.max(0.6, st.z) * (1 - t * 0.5); g.save(); const gr = g.createRadialGradient(px, py, 0, px, py, R0); gr.addColorStop(0, `rgba(159,231,255,${0.75 * (1 - t * 0.6)})`); gr.addColorStop(1, "rgba(159,231,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(px, py, R0, 0, TAU); g.fill(); g.restore();
    if (t < 1) setTimeout(draw, 16); else setTimeout(() => { st.anim = null; const bn = cv && cv.parentNode.querySelector(".mt-ban"); if (bn) bn.remove(); draw(); }, 1800);
  }
  function animCheck() {
    const s = S(); if (st.view || st.anim || !E.mtOn(hero())) return; const open = E.mtGatesOpen(s); s.mtGateSeen = s.mtGateSeen || []; const b = open.find((x) => !s.mtGateSeen.includes(x)); if (!b) return;
    s.mtGateSeen.push(b); const P = T().N.find((n) => n.gate && n.gate.b === b); if (!P) return; const brs = [...new Set(T().N.filter((n) => n.gated === P.id && n.br).map((n) => n.br))];
    st.z = Math.max(0.3, Math.min(0.45, st.z || 0.45)); st.ox = -P.X; st.oy = -P.Y * 0.92; st.anim = { b, t0: performance.now() };
    const box = cv.parentNode; const d = document.createElement("div"); d.className = "mt-ban"; d.innerHTML = `✦ <b>Porte des étoiles ouverte · ${h(b)}</b><br><span>${h(brs.join(" et "))} s'allument pour tout le compte</span>`; box.appendChild(d);
    noteSnd([523.25, 659.25, 783.99, 1046.5], 0.22); draw();
  }
  /* 2.1 (11A) : une note par étoile prise, qui monte le long du chemin ; un accord sur une clé de voûte. Seulement si les sons de l'interface sont allumés */
  let AC = null;
  function noteSnd(freqs, step = 0.09) {
    const sc = (S().settings && S().settings.snd) || {}; if (!sc.ui || sc.mute) return; const vol = ((sc.gvol == null ? 80 : sc.gvol) / 100) * ((sc.ivol == null ? 50 : sc.ivol) / 100) * 0.16; if (vol <= 0) return;
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t0 = AC.currentTime + 0.01;
      freqs.slice(0, 12).forEach((f, i) => { const o = AC.createOscillator(), gn = AC.createGain(); o.type = "triangle"; o.frequency.value = f; const t = t0 + i * step; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + 0.015); gn.gain.exponentialRampToValueAtTime(0.0008, t + 0.45); o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + 0.5); }); } catch (e) {}
  }
  const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51, 1396.91, 1567.98];
  const takeSnd = (ids) => { const N = T().N; const f = ids.slice(0, 12).map((id, i) => SCALE[i]); if (ids.some((id) => ["ks", "cks"].includes(N[id].t))) f.push(1046.5, 1318.51, 1567.98); noteSnd(f); };
  function ring(x, y, r, col = "#7fffd4") { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  const center = () => { st.z = Math.min(W, H) / 760; st.ox = 0; st.oy = 0; draw(); };
  const fitAll = () => { const N = T().N.filter((n) => !(n.neb && !nebOpen())); let a = 1e9, b = -1e9, c2 = 1e9, d = -1e9; N.forEach((n) => { a = Math.min(a, n.X); b = Math.max(b, n.X); c2 = Math.min(c2, n.Y); d = Math.max(d, n.Y); }); st.z = Math.min(W / (b - a + 360), H / (d - c2 + 260)); st.ox = -(a + b) / 2; st.oy = -(c2 + d) / 2; draw(); };
  const pick = (mx, my) => { let best = null, bd = 1e9; for (const n of T().N) { if (n.neb && !nebOpen()) continue; const [x, y] = toS(n); const dd = Math.hypot(x - mx, y - my); if (dd < Math.max(16, rad(n) + 10) && dd < bd) { bd = dd; best = n.id; } } return best; };
  let RO = null;
  function mount() {
    const box = document.getElementById("mtCv"); if (!box) return; cv = box.querySelector("canvas"); g = cv.getContext("2d");
    const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; H = box.clientHeight; cv.width = W * dpr; cv.height = H * dpr; if (!st.z) center(); else draw(); };
    if (RO) RO.disconnect(); RO = new ResizeObserver(resize); RO.observe(box); resize(); /* 2.0.10 : un seul observateur (avant : un de plus à chaque affichage de la page) */
    /* 2.0.4 : position du pointeur en pixels du dessin, même avec le zoom de l'interface (Options) : offsetX se décalait avec le zoom */
    const P = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / (r.width || W)), (e.clientY - r.top) * (H / (r.height || H))]; };
    const ptrs = new Map(); let drag = null, moved = 0, pinch = null;
    box.addEventListener("pointerdown", (e) => { if (e.target.closest(".mt-zoom, .mt-draft, .mt-ban, .mt-peek")) return; box.setPointerCapture(e.pointerId); const q = P(e); ptrs.set(e.pointerId, q); moved = 0; drag = [q[0], q[1], st.ox, st.oy]; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = [Math.hypot(a[0] - b[0], a[1] - b[1]), st.z]; } });
    box.addEventListener("pointermove", (e) => { const q = P(e); if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, q);
      if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; st.z = Math.max(0.12, Math.min(3, pinch[1] * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch[0])); moved = 99; moving(); draw(); return; }
      if (drag && ptrs.size === 1) { const dx = q[0] - drag[0], dy = q[1] - drag[1]; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); if (moved > 8) { st.ox = drag[2] + dx / st.z; st.oy = drag[3] + dy / st.z; moving(); draw(); } return; }
      if (e.pointerType === "mouse") { const hv = pick(q[0], q[1]); if (hv !== st.hov) { st.hov = hv; draw(); } } });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (drag && moved <= 8 && e.type === "pointerup" && !e.target.closest(".mt-zoom, .mt-draft, .mt-ban, .mt-peek")) { if (miniHit(...P(e))) { if (!ptrs.size) drag = null; return; } const id = pick(...P(e)); if (id == null) { if (st.sel != null) { st.sel = null; draw(); } } else if (e.pointerType !== "mouse" && st.sel !== id) { st.sel = id; st.hov = null; side(); draw(); } else clickNode(id); } if (!ptrs.size) drag = null; };
    box.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && st.hov != null) { st.hov = null; draw(); } }); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    draftUi(); if (window.ONLINE && window.ONLINE.enabled) rkLoad(); setTimeout(animCheck, 250); // 2.1
    box.addEventListener("wheel", (e) => { e.preventDefault(); const nz = Math.max(0.12, Math.min(3, st.z * Math.exp(-e.deltaY * 0.0015))); const [ex, ey] = P(e); const mx = (ex - W / 2) / st.z - st.ox, my = (ey - H / 2) / st.z - st.oy; st.z = nz; st.ox = (ex - W / 2) / st.z - mx; st.oy = (ey - H / 2) / st.z - my; moving(); draw(); }, { passive: false });
  }
  function clickNode(id) {
    const n = T().N[id]; st.sel = id; if (st.hov != null) st.hov = id;
    if (canEdit() && allowed(id) && st.draft) { // 2.1 (5A) : en brouillon, un clic ajoute le chemin (ou retire l'étoile et ce qui en dépend)
      if (st.draft.includes(id)) { const keep = new Set(got); const out = []; let grew = true; const rest = st.draft.filter((x) => x !== id); while (grew) { grew = false; rest.forEach((x) => { if (!keep.has(x) && T().N[x].adj.some((y) => keep.has(y))) { keep.add(x); out.push(x); grew = true; } }); } st.draft = out; }
      else if (!got.has(id)) { const p = pathTo(id, draftSet()); if (p) st.draft.push(...p); }
      draftUi(); side(); draw(); return; }
    if (canEdit() && allowed(id)) { const before = [...got]; st.paid = false; let took = [];
      if (got.has(id)) { const cut = cutSet(id); if (cut.length && payRespec(cut.length, cut.length > 1 ? `rendre ces ${cut.length} étoiles` : "rendre cette étoile")) cut.forEach((x) => got.delete(x)); } // 2.1 (13A) : avec celles qui en dépendent
      else { const p = pathTo(id); if (p) { took = p.slice(0, Math.max(0, pts() - used())); took.forEach((x) => got.add(x)); } }
      if (got.size !== before.length) { if (!st.paid) pushHist(before); save(); if (took.length) takeSnd(took); } }
    side(); draw();
  }
  /* 2.1 (5A, 6A) : brouillon, et placement automatique dans le brouillon selon un profil (règles simples, pas l'optimum) */
  const PROF = { deg: ["Dégâts", /dégâts|Puissance|Force|Intelligence|Chance|Agilité|critique|Critique|premier tour|vol de vie|crescendo|tour écoulé/], tank: ["Tank", /PV|Vitalité|résistance|bouclier|soins|renvoy|se relève/], farm: ["Farm", /butin|kamas|XP|Prospection|Sagesse|récolte|métier|Champion/], boss: ["Boss", /boss|dégâts|Critique|critique|Puissance/] };
  const nodeVal = (n, re) => { if (!allowed(n.id)) return -1; let v = 0; (n.b || []).forEach(([l, x]) => { if (re.test(l)) v += /^%/.test(l) ? x : x / 10; }); if (n.fx) { const t = E.mtFxTxt(n.fx); if (re.test(t)) v += 6; if (/boss/.test(t) && re === PROF.boss[1]) v += 6; } return v; };
  function autoFill(k) {
    const re = PROF[k][1]; const N = T().N; const base = new Set(got); st.draft = []; let left = Math.max(0, pts() - used()); const val = new Map(); N.forEach((n) => val.set(n.id, nodeVal(n, re)));
    let depth = 8; while (left > 0) { const prev = new Map(), dist = new Map(), sum = new Map(); const q = [...base]; q.forEach((x) => { prev.set(x, -1); dist.set(x, 0); sum.set(x, 0); }); let hd = 0, best = null, br = 0;
      while (hd < q.length) { const x = q[hd++]; if (dist.get(x) >= Math.min(depth, left)) continue; for (const y of N[x].adj) { if (prev.has(y) || val.get(y) < 0) continue; prev.set(y, x); dist.set(y, dist.get(x) + 1); sum.set(y, sum.get(x) + val.get(y)); q.push(y); const r = sum.get(y) / dist.get(y); if (val.get(y) > 0 && r > br) { br = r; best = y; } } }
      if (best == null) { if (depth < 40) { depth = 40; continue; } break; } depth = 8; const p = []; for (let x = best; !base.has(x); x = prev.get(x)) p.push(x); p.reverse().forEach((x) => { base.add(x); st.draft.push(x); }); left -= p.length; }
    st.prof = k; draftUi(); side(); draw();
  }
  function draftUi() {
    const box = cv && cv.parentNode; if (!box) return; let el = box.querySelector(".mt-draft"); if (!st.draft) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.className = "mt-draft"; box.appendChild(el); }
    const free = Math.max(0, pts() - used()); const n = st.draft.length; const A = E.mtStats(S(), hero(), got), B = E.mtStats(S(), hero(), draftSet());
    const ks = B.ks.filter((k) => !A.ks.some((a) => a.n === k.n)).map((k) => "✦ " + h(k.n)); const gl = Object.keys(B.t).map((k) => [k, B.t[k] - (A.t[k] || 0)]).filter(([, d]) => d > 0.0001).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, d]) => `+${E.mtNf(d)} ${h(k)}`);
    el.innerHTML = `<div class="mt-row"><b>Brouillon · ${n} point${n > 1 ? "s" : ""}</b><span class="xs muted">${fmt(free)} à placer</span></div><div class="mt-dprof">${Object.entries(PROF).map(([k, [nm]]) => `<button class="btn xs" data-act="mt-auto" data-v="${k}" aria-pressed="${st.prof === k}">${nm}</button>`).join("")}</div>${n ? `<span class="xs">${ks.concat(gl).join(" · ") || "Aucun bonus de plus."}</span>` : `<span class="xs muted">Touche des étoiles pour les poser en pointillés, ou choisis un profil pour remplir le brouillon.</span>`}${n > free ? `<span class="xs" style="color:#ffb27b">Il manque ${n - free} point${n - free > 1 ? "s" : ""} : Valider prend les ${free} premiers.</span>` : ""}<div class="mt-row"><button class="btn xs primary" data-act="mt-dok" ${n && free ? "" : "disabled"}>Valider</button><button class="btn xs" data-act="mt-dclr" ${n ? "" : "disabled"}>Effacer</button><button class="btn xs" data-act="mt-draft">Fermer</button></div>`;
  }

  /* ---------- panneaux ---------- */
  const TYP = { s: "Petite étoile", nt: "Notable", ks: "Clé de voûte", cks: "Clé de voûte de classe", start: "Cœur de classe", cls: "Cœur de classe", joy: "Emplacement de joyau" };
  function infoHtml() {
    if (st.sel == null) return `<span class="mt-ty muted">Étoile</span><b>Touche une étoile</b><span class="muted xs">Son effet s'affiche ici. Un clic sur une étoile lointaine prend le chemin le plus court.</span>`;
    const n = T().N[st.sel]; const p = got.has(n.id) ? null : pathTo(n.id); const left = pts() - used();
    const gk = n.gated != null && !gateOpen(n.gated) ? T().N[n.gated].gate : null; // 2.1
    const who = gk ? `🔒 Porte fermée : termine le donjon de ${gk.b} en stasis ${gk.s} ou plus.` : st.view ? "Arbre d'une autre classe : lecture seule." : !E.mtOn(hero()) ? "La Maîtrise s'ouvre au niveau 200." : got.has(n.id) ? (respecCost(1) ? `Prise. La rendre coûte ${fmt(respecCost(1))} kamas.` : "Prise.") : p ? (p.length <= left ? `Coûte ${p.length} point${p.length > 1 ? "s" : ""} avec le chemin.` : (left > 0 ? `Chemin de ${p.length} points : un clic prend les ${left} premières étoiles, la suite aux prochains niveaux.` : `Chemin de ${p.length} points : gagne des niveaux de Maîtrise pour le prendre.`)) : n.t === "start" ? "" : n.neb ? `S'ouvre à ${fmt(E.MT_OPEN)} points.` : "Pas atteignable.";
    let joy = "";
    if (n.t === "joy" && got.has(n.id) && !st.view) { const M = E.mt(hero()); const cur = M.j[n.id]; const J = cur && (S().joy || []).find((z) => z.uid === cur);
      const free = (S().joy || []).filter((z) => !E.joyOwner(S(), z.uid)); // 2.0.3 : un joyau serti chez un autre héros n'est pas libre
      joy = `<div class="mt-joyset">${J ? `<span class="mt-jw" style="--jc:${JOY[J.k].c}">◆ ${h(JOY[J.k].n)} · +${JOY[J.k].b[1]} ${h(JOY[J.k].b[0])}</span><button class="btn xs" data-act="mt-unsock">Retirer</button>` : free.length ? `<span class="xs muted">Sertir :</span>${free.slice(0, 6).map((z) => `<button class="btn xs mt-jw" style="--jc:${JOY[z.k].c}" data-act="mt-sock" data-v="${z.uid}">◆ ${h(JOY[z.k].n)}</button>`).join("")}` : `<span class="xs muted">Aucun joyau libre : ils tombent sur les boss en stasis 10 et plus.</span>`}</div>`; }
    return `<span class="mt-ty" style="color:${domCol(n)}">${TYP[n.t]}${["start", "cls", "cks"].includes(n.t) ? " · " + h(CLASSES[treeCls()].name) : n.neb ? " · Nébuleuse" : " · " + (n.br || DOM[n.d].n)}</span><b>${h(n.n)}</b><span class="small">${h(n.txt)}</span><span class="muted xs">${h(who)}</span>${joy}${(n.t === "ks" || n.t === "cks") && canEdit() && !got.has(n.id) && p ? `<div class="mt-row"><button class="btn xs" data-act="mt-pin" data-v="${E.mt(hero()).obj === n.id ? "" : n.id}">${E.mt(hero()).obj === n.id ? "Retirer l'objectif" : "🎯 En faire mon objectif"}</button></div>` : ""}`;
  }
  function totHtml(set) {
    const c = hero(); const R = st.view ? (() => { const t = {}; const ks = []; set.forEach((id) => { const n = T().N[id]; if (n.t === "ks" || n.t === "cks") ks.push(n); (n.b || []).forEach(([s, v]) => (t[s] = (t[s] || 0) + v)); }); return { t, ks, sym: false }; })() : E.mtStats(S(), c, set);
    const rows = Object.entries(R.t).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<div><span>${h(s)}</span><b class="num">+${E.mtNf(v)}</b></div>`).join("");
    const ph = recap(R.t); if (ph.length) return `<div class="mt-rec">${(R.sym ? [`Le symbole ${h(CLASSES[treeCls()].name)} est allumé : +5 % au passif de classe.`] : []).concat(R.ks.map((k) => `<span class="${k.t === "cks" ? "mt-cl" : "mt-kl"}">✦ <b>${h(k.n)}</b> : ${h(k.txt)}</span>`), ph).map((x) => `<p>${x}</p>`).join("")}</div><details class="mt-all"><summary>Voir tous les chiffres</summary>${rows}</details>`;
    return (R.sym ? `<div class="mt-cl"><span>✦ Symbole ${h(CLASSES[treeCls()].name)} allumé</span><b>+5 %</b></div>` : "") + R.ks.map((k) => `<div class="${k.t === "cks" ? "mt-cl" : "mt-kl"}"><span>✦ ${h(k.n)}</span></div>`).join("") + (rows || `<span class="muted xs">Aucun point placé.</span>`);
  }
  /* 2.1 (20A) : le total en phrases, du plus important au plus discret */
  const ELN = { Feu: "de Feu", Eau: "d'Eau", Terre: "de Terre", Air: "d'Air" };
  const PH = [[/^% dégâts$/, (v) => `Tes sorts font <b>+${v} %</b> de dégâts.`], [/^% dégâts (Feu|Eau|Terre|Air)$/, (v, m) => `Tes sorts ${ELN[m[1]]} font <b>+${v} %</b> de dégâts.`], [/^% dégâts aux boss$/, (v) => `<b>+${v} %</b> de dégâts contre les boss.`],
    [/^% dégâts aux Champions$/, (v) => `<b>+${v} %</b> de dégâts contre les Champions.`], [/^% dégâts aux ennemis sous 30 % PV$/, (v) => `<b>+${v} %</b> de dégâts sur les ennemis sous 30 % de PV.`], [/^% dégâts par tour/, (v) => `Tes dégâts montent de <b>${v} %</b> à chaque tour (10 tours au plus).`],
    [/^% dégâts au premier tour$/, (v) => `<b>+${v} %</b> de dégâts au premier tour.`], [/^% dégâts sous la moitié des PV$/, (v) => `<b>+${v} %</b> de dégâts sous la moitié de tes PV.`], [/^% dégâts critiques$/, (v) => `Tes coups critiques font <b>+${v} %</b> de dégâts.`],
    [/^% vol de vie$/, (v) => `Tu voles <b>${v} %</b> des dégâts infligés.`], [/^% dégâts renvoyés$/, (v) => `Tu renvoies <b>${v} %</b> des dégâts reçus.`], [/^% PV$/, (v) => `<b>+${v} %</b> de points de vie.`], [/^Bouclier \(% PV\)$/, (v) => `Bouclier de départ : <b>${v} %</b> de tes PV.`],
    [/^% soins$/, (v) => `Tes soins et boucliers sont <b>${v} %</b> plus forts.`], [/^% butin$/, (v) => `<b>+${v} %</b> de butin.`], [/^% kamas gagnés$/, (v) => `<b>+${v} %</b> de kamas gagnés.`], [/^% XP$/, (v) => `<b>+${v} %</b> d'XP.`], [/^% XP de métier$/, (v) => `<b>+${v} %</b> d'XP de métier.`],
    [/^% récolte$/, (v) => `<b>+${v} %</b> de récolte.`], [/^% chance de Champion$/, (v) => `<b>+${v} %</b> de chances de croiser un Champion.`], [/^Passif (.+) \(%\)$/, (v, m) => `Passif ${h(m[1])} : <b>+${v} %</b>.`]];
  const recap = (t) => { const out = [], car = []; Object.entries(t).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { const f = PH.find(([re]) => re.test(k)); if (f) out.push([PH.indexOf(f), f[1](E.mtNf(v), f[0].exec(k))]); else car.push(`+${E.mtNf(v)} ${h(k)}`); });
    out.sort((a, b) => a[0] - b[0]); return out.map((x) => x[1]).concat(car.length ? [`Caractéristiques : ${car.join(", ")}.`] : []); };
  function cmpHtml() {
    if (st.cmp == null) return ""; const c = hero(); const A = E.mtStats(S(), c, got), B = E.mtStats(S(), c, E.mtGot(c, st.cmp));
    const keys = [...new Set([...Object.keys(A.t), ...Object.keys(B.t)])]; const rows = keys.map((k) => [k, (B.t[k] || 0) - (A.t[k] || 0)]).filter(([, d]) => d).sort((a, b) => b[1] - a[1]);
    const an = new Set(A.ks.map((k) => k.n)), bn = new Set(B.ks.map((k) => k.n)); const kin = [...bn].filter((k) => !an.has(k)), kout = [...an].filter((k) => !bn.has(k));
    return `<div class="mt-cmp"><b>Passer à « ${LO[st.cmp]} »</b>${kin.map((k) => `<div class="up"><span>✦ ${h(k)}</span><b>gagnée</b></div>`).join("")}${kout.map((k) => `<div class="dn"><span>✦ ${h(k)}</span><b>perdue</b></div>`).join("")}${rows.map(([k, d]) => `<div class="${d > 0 ? "up" : "dn"}"><span>${h(k)}</span><b class="num">${d > 0 ? "+" : "−"}${E.mtNf(Math.abs(d))}</b></div>`).join("") || (kin.length || kout.length ? "" : `<span class="muted xs">Aucune différence.</span>`)}${(() => { const tg = E.mtGot(hero(), st.cmp); const rm = [...got].filter((x) => !tg.has(x)).length; const cost = respecCost(rm); return cost ? `<span class="xs muted">Changer rend ${rm} points de l'arbre actuel : ${fmt(cost)} kamas.</span>` : ""; })()}<div class="mt-row"><button class="btn sm primary" data-act="mt-cgo">Changer</button><button class="btn sm" data-act="mt-cno">Garder</button></div></div>`;
  }
  const LO = ["Donjons", "Ascension", "Chasse"];
  function sideHtml() {
    const c = hero(); const M = E.mt(c); const lv = pts(), left = lv - used(), on = E.mtOn(c);
    const respec = respecCost(used());
    const lvCard = st.view && st.peek ? `<div class="mt-card"><h3>Arbre de ${h(st.peek.n)}</h3><p class="xs muted">${h(CLASSES[st.view].name)}${st.peek.p ? ` de ${h(st.peek.p)}` : ""}, ${fmt(st.peek.ids.length)} points placés. « Copier cet arbre » le charge sur ton héros de la même classe (même règle que les codes de partage).</p><button class="btn sm" data-act="mt-view" data-v="">Revenir à ${h(c.name)}</button></div>`
      : st.view ? `<div class="mt-card"><h3>Ciel ${h(CLASSES[st.view].name)}</h3><p class="xs muted">Tu regardes l'arbre d'une autre classe, sans y placer de points. Tes héros ${h(CLASSES[st.view].name)} l'ouvriront au niveau 200.</p><button class="btn sm" data-act="mt-view" data-v="">Revenir à ${h(c.name)}</button></div>`
      : `<div class="mt-card"><h3>Maîtrise de ${h(c.name)}</h3>${on ? `<div class="mt-pts"><b class="num">${fmt(lv)}</b><span class="muted">points · <b class="num">${fmt(left)}</b> à placer</span></div><div class="bar xp"><i style="width:${pctf(M.xp, E.mtNeed(c))}%"></i></div><span class="xs muted num">Maîtrise ${fmt(M.lvl)} · ${fmt(M.xp)} / ${fmt(E.mtNeed(c))} XP vers le niveau ${fmt(M.lvl + 1)}</span>${M.bn ? `<span class="xs muted">Dont ${fmt(M.bn)} points venus des Éveils et des sorts de ses vies passées.</span>` : ""}` : `<p class="small">La Maîtrise s'ouvre au <b>niveau 200</b>. ${h(c.name)} est niveau ${c.lvl} : au niveau 200, toute son XP remplit la Maîtrise.</p>`}
        ${on ? `<div class="mt-row"><button class="btn sm" data-act="mt-undo" ${st.hist.length ? "" : "disabled"}>Annuler${st.hist.length ? ` (${st.hist.length})` : ""}</button><button class="btn sm" data-act="mt-reset" ${used() ? "" : "disabled"}>Tout rendre${used() ? respec ? ` · ${fmt(respec)} kamas` : " · gratuit" : ""}</button><button class="btn sm" data-act="mt-share">Partager</button><button class="btn sm" data-act="mt-img">Image</button></div>
        <span class="xs muted">${E.mtFreeWeek && E.mtFreeWeek() ? "<b>Rendre est gratuit jusqu'au jeudi 22 octobre à 23 h.</b>" : `Rendre : gratuit jusqu'à ${E.MT_FREE} points placés, puis ${fmt(E.MT_RESPEC)} kamas par point.`}</span>` : ""}
        ${st.share && on ? `<div class="mt-share"><code>${h(E.mtCode(c))}</code><div class="mt-row"><button class="btn xs" data-act="mt-copy">Copier</button><input id="mtImp" placeholder="Coller le code d'un ami" aria-label="Code d'un arbre" value="${h(st.imp || "")}"><button class="btn xs" data-act="mt-imp">Charger</button></div></div>` : ""}</div>
      <div class="mt-card"><h3>Arbres enregistrés</h3><div class="seg">${LO.map((n, i) => `<button data-act="mt-lo" data-v="${i}" aria-pressed="${M.lo === i}">${n}</button>`).join("")}</div>${cmpHtml()}</div>`;
    const joys = (S().joy || []); const setJ = new Set(Object.values(M.j));
    return `${lvCard}
      <div class="mt-card"><h3>Chercher</h3><input id="mtQ" type="search" value="${h(st.q)}" placeholder="Critique, Phénix, joyau…" aria-label="Chercher une étoile"><span class="xs muted">${st.q.trim().length >= 2 ? `${hits().size} étoile${hits().size > 1 ? "s" : ""} allumée${hits().size > 1 ? "s" : ""}` : ""}</span>${nearHtml()}</div>
      <div class="mt-card mt-info">${infoHtml()}</div>
      <div class="mt-card"><h3>Total des bonus</h3><div class="mt-tot">${totHtml(got)}</div></div>
      ${st.view ? "" : `<div class="mt-card"><h3>Joyaux <span class="xs muted">${joys.length}</span></h3>${joys.length ? `<div class="mt-joys">${joys.map((z) => `<span class="mt-jw ${setJ.has(z.uid) ? "on" : ""}" style="--jc:${JOY[z.k].c}" title="${h(JOY[z.k].n)} : +${JOY[z.k].b[1]} ${h(JOY[z.k].b[0])}">◆ ${h(JOY[z.k].n)}</span>`).join("")}</div><span class="xs muted">Touche un emplacement ◆ pris dans l'arbre pour sertir.</span>` : `<span class="xs muted">Les joyaux tombent sur les boss en stasis 10 et plus.</span>`}</div>`}
      ${!st.view && E.mtBrDone(c).length ? `<div class="mt-card"><h3>Branches complètes</h3><div class="mt-tot">${E.mtBrDone(c).map((B) => `<div><span style="color:${B.c}">✦ ${h(B.n)}</span><b>${h(E.MT_BR_TITLE[B.n] || "")}</b></div>`).join("")}</div><span class="xs muted">Une branche entière donne son aura en combat et son titre.</span></div>` : ""}
      <div class="mt-card"><h3>Maîtrise du compte</h3><div class="mt-tot">${S().chars.filter((x) => E.mtPts(x)).sort((a, b) => E.mtPts(b) - E.mtPts(a)).map((x) => `<div><span>${h(x.name)} <span class="xs muted">${h(CLASSES[x.cls].name)}</span></span><b class="num">${fmt(E.mtPts(x))}</b></div>`).join("")}<div class="mt-sum"><span>Total : ${fmt(E.mtAcct(S()))} points</span><b>+${E.mtAcctPct(S())} % d'XP</b></div></div><span class="xs muted">Chaque tranche de 100 points, tous héros confondus, donne +1 % d'XP au compte.</span></div>`;
  }
  /* 2.1 (7A) : la recherche montre l'étoile trouvée la plus proche et y emmène */
  const nearest = () => { const H0 = hits(); if (!H0.size) return null; let best = null, bl = 1e9; H0.forEach((id) => { const p = got.has(id) ? [] : pathTo(id); const l = p ? p.length : 1e6; if (l < bl) { bl = l; best = id; } }); return best == null ? null : [best, bl]; };
  const nearHtml = () => { const r = nearest(); if (!r) return ""; const n = T().N[r[0]]; return `<div class="mt-near"><span class="small">Plus proche : <b>${h(n.n)}</b> <span class="xs muted">${got.has(n.id) ? "déjà prise" : r[1] < 1e6 ? `${r[1]} point${r[1] > 1 ? "s" : ""}` : "pas atteignable"}</span></span><button class="btn xs" data-act="mt-go" data-v="${n.id}">Y aller</button></div>`; };
  function side() { const el = document.getElementById("mtSide"); if (el) el.innerHTML = sideHtml(); }

  function treeHtml() {
    const s = S(); const c = hero(); const Tc = treeCls(); const C = CLASSES[Tc]; const f = FORT[Tc] || [0, 1];
    const heroes = s.chars.slice().sort((a, b) => b.lvl - a.lvl || ((b.mt && b.mt.lvl) || 0) - ((a.mt && a.mt.lvl) || 0));
    return `<div class="mt-heroes" role="group" aria-label="Héros">${heroes.map((x) => `<button class="mt-hb ${E.mtOn(x) ? "" : "off"}" data-act="mt-hero" data-v="${x.id}" aria-pressed="${!st.view && x.id === c.id}" style="--cc:${CLASSES[x.cls].color}"><img src="${sym(x.cls)}" alt=""><span><b>${h(x.name)}</b><span class="xs">${E.mtOn(x) ? `Maîtrise ${fmt(E.mt(x).lvl)}` : `niv. ${x.lvl}`}</span></span></button>`).join("")}</div>
      <div class="mt-head" style="--cc:${C.color}"><img src="${sym(Tc)}" alt=""><div><h2>Ciel ${h(C.name)}</h2><div class="mt-chips">${f.map((d) => `<span class="mt-chip" style="color:${DOM[d].c}">${DOM[d].n}</span>`).join("")}<span class="mt-chip">Passif : ${h(build(Tc).pas)}</span><span class="mt-chip num">${fmt(build(Tc).N.length)} étoiles</span></div></div>
        <details class="mt-other" ${st.view && !st.peek ? "open" : ""}><summary>Voir une autre classe</summary><div class="mt-cls">${CLS_IDX().map((k) => `<button data-act="mt-view" data-v="${k}" aria-pressed="${Tc === k}" title="${h(CLASSES[k].name)}" aria-label="Ciel ${h(CLASSES[k].name)}"><img src="${sym(k)}" alt=""></button>`).join("")}</div></details></div>
      <div class="mt-grid"><div class="mt-cv" id="mtCv" style="--cc:${C.color}"><div class="mt-bg">${STARS}</div><canvas></canvas><div class="mt-tip" hidden></div><span class="mt-hint">${st.view ? "Lecture seule : touche une étoile pour voir son effet" : E.mtOn(c) ? (matchMedia("(hover: hover)").matches ? "Survole une étoile pour voir son effet, clique pour la prendre" : "Touche une étoile pour voir son effet, touche-la encore pour la prendre") : "La Maîtrise s'ouvre au niveau 200"}</span><div class="mt-zoom"><button class="btn sm" data-act="mt-z" data-v="in" aria-label="Zoomer">+</button><button class="btn sm" data-act="mt-z" data-v="out" aria-label="Dézoomer">−</button><button class="btn sm" data-act="mt-z" data-v="c">Centrer</button><button class="btn sm" data-act="mt-z" data-v="all">Tout voir</button>${canEdit() ? `<button class="btn sm" data-act="mt-draft" aria-pressed="${!!st.draft}">✎ Brouillon</button>` : ""}</div>${st.peek && st.view ? `<div class="mt-peek"><span>👁 Arbre de <b>${h(st.peek.n)}</b>${st.peek.p ? ` · ${h(st.peek.p)}` : ""} · ${fmt(st.peek.ids.length)} points · lecture seule</span><span class="mt-row"><button class="btn xs primary" data-act="mt-pcopy">Copier cet arbre</button><button class="btn xs" data-act="mt-view" data-v="">Revenir</button></span></div>` : ""}</div>
      <aside class="mt-side" id="mtSide">${sideHtml()}</aside></div>`;
  }
  const STARS = (() => { let sd = 7; const r = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; }; let o = ""; for (let i = 0; i < 110; i++) o += `<i style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 100).toFixed(1)}%;animation-duration:${(2 + r() * 4).toFixed(1)}s;animation-delay:-${(r() * 6).toFixed(1)}s"></i>`; return o + "<b></b><b></b><b></b>"; })();

  /* ---------- Bestiaire ---------- */
  function bestHtml() {
    const s = S(); const R = Object.keys(E.RACE_MONS).filter((r) => (E.RACE_MONS[r] || []).some((k) => MONSTERS[k] && !MONSTERS[k].archiOf));
    const day = E.btDay(s); const rank = E.btRank(s), max = R.length * 20;
    const row = (r) => { const n = E.btKills(s, r), t = E.btTier(s, r); const nx = E.BT[t], pv = t ? E.BT[t - 1] : 0;
      return `<div class="bt-row ${t >= 20 ? "max" : ""} ${r === day ? "day" : ""}"><span class="bt-pic">${pic(r)}</span><div class="bt-mid"><div class="bt-top"><b>${h(D.RACES[r] || r)}</b><span class="bt-tier num">${t}/20</span></div><div class="bar"><i style="width:${t >= 20 ? 100 : pctf(n - pv, nx - pv)}%"></i></div>
        <div class="bt-sub"><span class="xs muted num">${fmt(n)}${t < 20 ? ` / ${fmt(nx)}` : ""} victoires</span><span class="xs">+${(t * 0.5).toLocaleString("fr-FR")} % contre la famille</span></div>
        <div class="bt-rew">${[5, 10, 15, 20].map((p) => `<span class="${t >= p ? "on" : ""}" title="${h(E.BT_REW[p])}">${p}</span>`).join("")}</div></div></div>`; };
    let L = R.slice(); if (st.fam === "near") L = L.filter((r) => { const t = E.btTier(s, r); return t < 20 && [5, 10, 15, 20].some((p) => p > t && p - t <= 2); }); if (st.fam === "done") L = L.filter((r) => E.btTier(s, r) >= 5);
    L.sort((a, b) => E.btTier(s, b) - E.btTier(s, a) || E.btKills(s, b) - E.btKills(s, a));
    return `<div class="bt-head"><div class="mt-card"><h3>Rang de Chasseur</h3><div class="mt-pts"><b class="num">${fmt(rank)}</b><span class="muted">paliers sur ${fmt(max)}</span></div><div class="bar xp"><i style="width:${pctf(rank, max)}%"></i></div><span class="xs muted">20 paliers par famille, de 10 à 100 000 victoires. Chaque palier : +0,5 % de dégâts contre la famille.</span></div>
      ${day ? `<div class="mt-card bt-daycard"><h3>Famille du jour</h3><div class="bt-dayin"><span class="bt-pic">${pic(day)}</span><div><b>${h(D.RACES[day] || day)}</b><span class="xs">Les victoires comptent double aujourd'hui.</span></div></div></div>` : ""}
      <div class="mt-card"><h3>Récompenses</h3>${[5, 10, 15, 20].map((p) => `<div class="mt-tot"><div><span><b class="num">Palier ${p}</b></span><span class="xs">${h(E.BT_REW[p])}</span></div></div>`).join("")}</div></div>
      <div class="mt-row"><span class="seg">${[["all", "Toutes"], ["near", "Récompense proche"], ["done", "Palier 5 et plus"]].map(([v, n]) => `<button data-act="mt-fam" data-v="${v}" aria-pressed="${st.fam === v}">${n}</button>`).join("")}</span><span class="xs muted">${L.length} famille${L.length > 1 ? "s" : ""}</span></div>
      <div class="bt-grid">${L.map(row).join("") || `<div class="empty">Aucune famille ici pour l'instant.</div>`}</div>`;
  }
  /* classement du serveur : lu dans lb_level (les héros envoyés par js/verify.js portent leurs points de Maîtrise) */
  const RK = { at: 0, rows: null, err: null, busy: false, cls: "" };
  async function rkLoad() {
    const ON = window.ONLINE && window.ONLINE.enabled ? window.ONLINE : null; if (!ON || !ON.db || RK.busy || Date.now() - RK.at < 60000) return;
    RK.busy = true;
    try { const { data, error } = await ON.db().from("lb_level").select("user_id,pseudo,heroes").order("level", { ascending: false }).limit(1000); if (error) throw error;
      const rows = []; (data || []).forEach((r) => { let acct = 0; (Array.isArray(r.heroes) ? r.heroes : []).forEach((x) => { const mt = x ? Math.floor(+x.mt) : 0; if (mt > 0 && CLASSES[x.cls]) { acct += mt; const row = { p: r.pseudo, u: r.user_id, n: x.name, cls: x.cls, mt, ks: Array.isArray(x.ks) ? x.ks : [] }; if (typeof x.mc === "string" && x.mc.length < 600) { const R0 = E.mtRead(x.mc); if (R0 && R0.cls === x.cls) { const Tt = build(x.cls); row.ids = R0.ids.filter((id) => Tt.N[id] && Tt.N[id].t !== "start"); row.all = row.ids.filter((id) => ["ks", "cks"].includes(Tt.N[id].t)).map((id) => Tt.N[id].n); } } rows.push(row); } }); /* 2.0.3 : une ligne abîmée du serveur ne bloque plus le classement */ r.acct = acct; });
      RK.rows = rows.sort((x, y) => y.mt - x.mt); RK.acct = (data || []).filter((r) => r.acct).sort((x, y) => y.acct - x.acct).slice(0, 20).map((r) => ({ p: r.pseudo, u: r.user_id, mt: r.acct })); RK.err = null;
    } catch (e) { RK.err = "Classement indisponible pour l'instant."; }
    RK.at = Date.now(); RK.busy = false; if (st.tab === "rank" && ui().tab === "maitrise") window.DX.render(); else if (st.tab === "arbre") draw();
  }
  function rankHtml() {
    const s = S(); const ON = window.ONLINE && window.ONLINE.enabled ? window.ONLINE : null; const me = ON && ON.user && ON.user.id;
    const line = (c, i) => `<div class="mt-rk ${c.u && c.u === me ? "me" : ""}" style="--cc:${CLASSES[c.cls].color}"><b class="num">${i + 1}</b><img src="${sym(c.cls)}" alt=""><span class="grow"><b>${h(c.n)}</b> <span class="xs muted">${h(CLASSES[c.cls].name)}${c.p ? ` · ${h(c.p)}` : ""}</span></span><span class="num"><b>${fmt(c.mt)}</b> points</span>${(c.ks || []).slice(0, 2).map((k) => `<span class="mt-chip">✦ ${h(k)}</span>`).join("")}${c.ids && c.ids.length && RK.rows ? `<button class="btn xs" data-act="mt-peek" data-v="${RK.rows.indexOf(c)}">Voir l'arbre</button>` : ""}</div>`; // 2.1 (15A)
    const mine = s.chars.filter((c) => E.mtPts(c)).sort((a, b) => E.mtPts(b) - E.mtPts(a)).map((c) => ({ n: c.name, cls: c.cls, mt: E.mtPts(c), ks: E.mtOn(c) ? E.mtStats(s, c).ks.map((k) => k.n) : [] }));
    let srv = "";
    if (ON) { rkLoad();
      const L = (RK.rows || []).filter((r) => !RK.cls || r.cls === RK.cls);
      srv = `<div class="mt-card"><h3>Serveur</h3><div class="mt-row"><button class="btn xs" data-act="mt-rkc" data-v="" aria-pressed="${!RK.cls}">Toutes les classes</button>${CLS_IDX().map((k) => `<button class="btn xs" data-act="mt-rkc" data-v="${k}" aria-pressed="${RK.cls === k}" title="${h(CLASSES[k].name)}"><img src="${sym(k)}" alt="${h(CLASSES[k].name)}" style="width:16px;height:16px"></button>`).join("")}</div>
        ${RK.err ? `<p class="note">${h(RK.err)}</p>` : !RK.rows ? `<p class="xs muted">Chargement…</p>` : `<div class="mt-rank">${L.slice(0, 50).map(line).join("") || `<div class="empty">Personne n'a encore de Maîtrise${RK.cls ? " dans cette classe" : ""}.</div>`}</div>`}
        ${RK.acct && RK.acct.length && !RK.cls ? `<h3>Maîtrise du compte</h3><div class="mt-rank">${RK.acct.map((r, i) => `<div class="mt-rk ${r.u === me ? "me" : ""}"><b class="num">${i + 1}</b><span class="grow"><b>${h(r.p)}</b></span><span class="num"><b>${fmt(r.mt)}</b> points</span></div>`).join("")}</div>` : ""}</div>`;
    }
    return `${srv || `<p class="note">Le classement du serveur s'affiche avec un compte en ligne. Tes héros :</p>`}
      ${srv ? `<h3 style="margin:10px 14px 0">Tes héros</h3>` : ""}<div class="mt-rank">${mine.map(line).join("") || `<div class="empty">Aucun héros n'a encore de Maîtrise.</div>`}</div>
      <div class="mt-sum mt-card"><span>Maîtrise du compte : <b class="num">${fmt(E.mtAcct(s))}</b> points</span><b>+${E.mtAcctPct(s)} % d'XP</b></div>`;
  }

  function page(main) {
    const c = hero(); if (!c) { main.innerHTML = `<div class="empty">Recrute un héros d'abord.</div>`; return; }
    const key = `${st.cid}:${st.view}:${E.mt(c).lo}`; if (key !== st.key || st.M !== E.mt(c)) { st.key = key; st.M = E.mt(c); st.hist = []; loadGot(); st.sel = null; st.hov = null; st.cmp = null; }
    main.innerHTML = `<section class="panel mt-page"><div class="phead"><h2>${IC("cristal")} Maîtrise</h2><span class="seg">${[["arbre", "Arbre"], ["best", "Bestiaire"], ["rank", "Classement"]].map(([v, n]) => `<button data-act="mt-tab" data-v="${v}" aria-pressed="${st.tab === v}">${n}</button>`).join("")}</span></div>
      ${st.tab === "best" ? bestHtml() : st.tab === "rank" ? rankHtml() : treeHtml()}</section>`;
    if (st.tab === "arbre") mount();
  }
  window.DX.pages.maitrise = page;

  function act(a, t) {
    const d = t.dataset; const c = hero(); const rer = () => window.DX.render();
    switch (a) {
      case "mt-tab": st.tab = d.v; rer(); return;
      case "mt-hero": st.cid = +d.v; st.view = null; st.peek = null; st.draft = null; st.hist = []; st.z = 0; rer(); return;
      case "mt-view": st.peek = null; st.draft = null; st.view = d.v && d.v !== hero().cls ? d.v : null; st.hist = []; st.z = 0; rer(); return;
      case "mt-z": if (d.v === "in") st.z = Math.min(3, st.z * 1.35); else if (d.v === "out") st.z = Math.max(0.12, st.z / 1.35); else if (d.v === "c") return center(); else return fitAll(); draw(); return;
      case "mt-undo": if (st.hist.length) { got = new Set(st.hist.pop()); save(); side(); draw(); } return;
      case "mt-reset": { const cost = respecCost(used()); if (!payRespec(used(), "tout rendre")) return; if (!cost) pushHist([...got]); got = new Set([T().start]); save(); side(); draw(); return; } // 2.0.3 : une remise payée ne s'annule pas
      case "mt-share": st.share = !st.share; side(); return;
      case "mt-copy": { const code = E.mtCode(c); try { navigator.clipboard.writeText(code).then(() => X().toast("Code de l'arbre copié.", "info"), () => {}); } catch (e) {} return; }
      case "mt-imp": { st.imp = ""; const v = document.getElementById("mtImp"); const R = v && E.mtRead(v.value); if (!R || R.cls !== c.cls) { X().toast(R ? "Ce code est pour une autre classe." : "Code illisible.", "info"); return; }
        const raw = R.ids.filter((id) => id !== T().start); const ids = E.mtClean(c, raw); if (ids.length !== raw.length) { X().toast("Ce code d'arbre n'est pas valable ici (étoiles non reliées ou Nébuleuse fermée).", "info"); return; } if (ids.length > pts()) { X().toast(`Cet arbre demande ${ids.length} points.`, "info"); return; } const keep = new Set(ids); const rm = [...got].filter((x) => x !== T().start && !keep.has(x)).length; const paid = respecCost(rm); if (!payRespec(rm, "ce code")) return; if (!paid) pushHist([...got]); got = new Set([T().start, ...ids]); save(); side(); draw(); return; }
      case "mt-lo": { const l = +d.v; if (l === E.mt(c).lo) return; st.cmp = l; side(); return; }
      case "mt-cno": st.cmp = null; side(); return;
      case "mt-cgo": { const tg = E.mtGot(c, st.cmp); if (!payRespec([...got].filter((x) => !tg.has(x)).length, "changer d'arbre")) return; E.mt(c).lo = st.cmp; st.cmp = null; st.hist = []; rer(); return; }
      case "mt-sock": { if (st.sel == null || !got.has(st.sel) || E.joyOwner(S(), +d.v)) return; E.mt(c).j[st.sel] = +d.v; side(); draw(); return; }
      case "mt-unsock": { if (st.sel == null) return; delete E.mt(c).j[st.sel]; side(); draw(); return; }
      case "mt-fam": st.fam = d.v; rer(); return;
      case "mt-rkc": RK.cls = d.v || ""; rer(); return;
      case "mt-draft": if (!canEdit()) return; st.draft = st.draft ? null : []; st.prof = null; draftUi(); rer(); return; // 2.1 (5A)
      case "mt-auto": if (!canEdit() || !st.draft) return; autoFill(d.v); return; // 2.1 (6A)
      case "mt-dclr": if (st.draft) { st.draft = []; st.prof = null; draftUi(); draw(); } return;
      case "mt-dok": { if (!st.draft || !canEdit()) return; const free = Math.max(0, pts() - used()); const take = st.draft.slice(0, free); if (!take.length) return; pushHist([...got]); take.forEach((x) => got.add(x)); save(); takeSnd(take); st.draft = null; st.prof = null; draftUi(); rer(); X().toast(`${take.length} point${take.length > 1 ? "s" : ""} placé${take.length > 1 ? "s" : ""}.`, "info"); return; }
      case "mt-go": { const id = +d.v; const n = T().N[id]; if (!n) return; st.z = Math.max(st.z, 0.6); st.ox = -n.X; st.oy = -n.Y; st.sel = id; side(); draw(); return; } // 2.1 (7A)
      case "mt-pin": { if (st.view) return; const M = E.mt(c); M.obj = d.v === "" ? null : +d.v; if (M.obj != null) { const n = E.mtObjStep(S(), c); if (n) { loadGot(); st.hist = []; X().toast(`${n} point${n > 1 ? "s" : ""} placé${n > 1 ? "s" : ""} vers l'objectif.`, "info"); } } side(); draw(); return; } // 2.1 (12A)
      case "mt-peek": { const r = RK.rows && RK.rows[+d.v]; if (!r || !r.ids) return; st.peek = { cls: r.cls, ids: r.ids, n: r.n, p: r.p }; st.view = r.cls; st.tab = "arbre"; st.hist = []; st.z = 0; st.key = ""; rer(); window.scrollTo(0, 0); return; } // 2.1 (15A)
      case "mt-pcopy": { const P0 = st.peek; if (!P0) return; const Tt = build(P0.cls); const by = new Uint8Array(Math.ceil(Tt.N.length / 8)); [Tt.start, ...P0.ids].forEach((id) => (by[id >> 3] |= 1 << (id & 7))); let s0 = ""; by.forEach((b) => (s0 += String.fromCharCode(b))); const code = `IDLUS-MT-${P0.cls}-${btoa(s0).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
        const mine = S().chars.filter((x) => x.cls === P0.cls && E.mtOn(x)).sort((a, b) => E.mtPts(b) - E.mtPts(a)); try { navigator.clipboard.writeText(code).catch(() => {}); } catch (e) {}
        st.peek = null; st.view = null; st.key = ""; if (mine.length) { st.cid = (mine.find((x) => x.id === c.id) || mine[0]).id; st.share = true; st.imp = code; X().toast("Code copié : touche « Charger » pour l'appliquer.", "info"); } else X().toast(`Code copié. Aucun héros ${CLASSES[P0.cls].name} au niveau 200 pour le charger.`, "info"); rer(); return; }
      case "mt-img": shareImg(); return; // 2.1 (4A)
      case "mt-open": st.cid = +d.v; st.view = null; st.tab = "arbre"; window.DX.ui.tab = "maitrise"; rer(); window.scrollTo(0, 0); return;
    }
  }
  document.addEventListener("input", (ev) => { if (ev.target && ev.target.id === "mtQ") { st.q = ev.target.value; draw(); const sp = ev.target.nextElementSibling; if (sp) { const n = hits().size; sp.textContent = st.q.trim().length >= 2 ? `${n} étoile${n > 1 ? "s" : ""} allumée${n > 1 ? "s" : ""}` : ""; } const nr = ev.target.parentNode.querySelector(".mt-near"); if (nr) nr.remove(); ev.target.parentNode.insertAdjacentHTML("beforeend", nearHtml()); } });

  /* fiche du héros : une ligne Maîtrise ; Scène : aura des clés de voûte */
  const picSrc = (r) => { const k = (E.RACE_MONS[r] || []).find((x) => MONSTERS[x] && MONSTERS[x].img && !MONSTERS[x].archiOf); return k ? `assets/m/${MONSTERS[k].img}.png` : ""; };
  function pic(r) { const s = picSrc(r); return s ? `<img src="${s}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ""; }
  /* ornement du Bestiaire (palier 5) : le monstre de la famille en médaillon */
  const ornHtml = (id) => { const s = picSrc(String(id).slice(3)); return s ? `<img class="orn regorn btorn" src="${s}" alt="">` : ""; };
  const heroLine = (c) => { if (!c || !E.mtOn(c)) return ""; const M = E.mt(c); return `<div class="mt-line"><span class="small">${IC("cristal")} Maîtrise <b class="num">${fmt(M.lvl)}</b> · <b class="num">${fmt(E.mtPts(c))}</b> points</span><div class="bar xp"><i style="width:${pctf(M.xp, E.mtNeed(c))}%"></i></div><button class="btn xs" data-act="mt-open" data-v="${c.id}">Ouvrir l'arbre</button></div>`; };
  const btAura = () => { const F = S().fight; if (!F || !F.ents) return null; const e = F.ents.find((x) => x.side === "m" && x.race !== undefined && E.btTier(S(), x.race) >= 20); return e ? e.race : null; }; // palier 20 : aura de la famille
  const auraHtml = (c) => { if (!c || !c.id) return ""; const br = btAura(); if (!E.mtOn(c) || !c.mt) return br != null ? `<i class="mt-aura" style="--mt:#f2c14e" title="${h(`Maître des ${D.RACES[br] || "monstres"}`)}"></i>` : ""; const R = ksOf(c); if (R.br.length) { const B = R.br[R.br.length - 1]; return `<i class="mt-aura" style="--mt:${B.c}" title="${h(E.MT_BR_TITLE[B.n] || B.n)}"></i>`; } if (!R.ks.length) return br != null ? `<i class="mt-aura" style="--mt:#f2c14e" title="${h(`Maître des ${D.RACES[br] || "monstres"}`)}"></i>` : ""; const k = R.ks[0]; const col = k.t === "cks" ? CLASSES[c.cls].color : DOM[k.d].c; return `<i class="mt-aura" style="--mt:${col}" title="${h(k.n)}"></i>`; };
  /* 2.1 (4A) : image de l'arbre (format carte Discord, 1200 × 630) avec le nom, la classe, les points et les clés de voûte */
  function shareImg() {
    if (!cv) return; const c = hero(); const sv = [st.z, st.ox, st.oy, st.sel, st.hov]; st.sel = st.hov = null; fitAll(); drawNow();
    const o = document.createElement("canvas"); o.width = 1200; o.height = 630; const q = o.getContext("2d"); const cc = CLASSES[c.cls].color;
    const gr = q.createLinearGradient(0, 0, 1200, 630); gr.addColorStop(0, "#0d0b1d"); gr.addColorStop(1, "#1c1236"); q.fillStyle = gr; q.fillRect(0, 0, 1200, 630);
    const k = Math.min(700 / cv.width, 600 / cv.height); q.drawImage(cv, 0, 0, cv.width, cv.height, 15 + (700 - cv.width * k) / 2, 15 + (600 - cv.height * k) / 2, cv.width * k, cv.height * k);
    const R0 = E.mtStats(S(), c, got); q.fillStyle = cc; q.fillRect(740, 40, 6, 120); q.fillStyle = "#fff"; q.font = "400 46px Kavoon, Georgia, serif"; q.fillText(String(c.name).slice(0, 18), 762, 92);
    q.font = "800 26px Nunito, system-ui, sans-serif"; q.fillStyle = "#cfd3ff"; q.fillText(`${CLASSES[c.cls].name} · ${fmt(used())} points`, 762, 136);
    let y = 210; q.font = "800 24px Nunito, system-ui, sans-serif"; R0.ks.slice(0, 5).forEach((x) => { q.fillStyle = x.t === "cks" ? cc : "#ffb27b"; q.fillText("✦ " + x.n, 750, y); y += 38; });
    q.font = "700 21px Nunito, system-ui, sans-serif"; q.fillStyle = "#e8e6f5"; Object.entries(R0.t).filter(([l]) => /^%/.test(l)).sort((a, b) => b[1] - a[1]).slice(0, Math.max(3, 8 - R0.ks.length)).forEach(([l, v]) => { y += 4; q.fillText(`+${E.mtNf(v)} ${l.replace(/^% /, "% ")}`, 750, y); y += 30; });
    q.font = "400 30px Kavoon, Georgia, serif"; q.fillStyle = "#bdf09b"; q.fillText("IDLUS", 1060, 600); q.font = "700 16px Nunito, system-ui, sans-serif"; q.fillStyle = "#9a98b8"; q.fillText("idlus.github.io", 750, 600);
    [st.z, st.ox, st.oy, st.sel, st.hov] = sv; drawNow();
    o.toBlob((b) => { if (!b) return; const f = `idlus-${c.cls}-${String(c.name).replace(/[^\w-]+/g, "_")}.png`;
      try { const file = new File([b], f, { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [file] }) && !matchMedia("(hover: hover)").matches) { navigator.share({ files: [file], text: E.mtCode(c) }).catch(() => {}); return; } } catch (e) {}
      const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = f; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); X().toast("Image de l'arbre enregistrée.", "info"); }, "image/png");
  }
  /* 2.1 (9A, 19A) : aura d'une branche complète et icône ✦ des clés de voûte en combat ; calcul gardé en cache (l'arène se redessine souvent) */
  const KC = new Map(); const ksOf = (c) => { const M = c.mt; const key = `${M.lo}:${(M.t[M.lo] || []).length}:${(S().mtGates || []).length}`; const o = KC.get(c.id); if (o && o.key === key) return o; const v = { key, ks: E.mtStats(S(), c).ks, br: E.mtBrDone(c) }; KC.set(c.id, v); return v; };
  const ksBadge = (c) => { if (!c || !c.id || !E.mtOn(c) || !c.mt) return ""; const K0 = ksOf(c).ks; if (!K0.length) return ""; return `<span class="mt-ksb" data-tip="${h(K0.map((k) => `✦ ${k.n} : ${k.txt}`).join("\n"))}">✦${K0.length > 1 ? K0.length : ""}</span>`; };
  window.MAITUI = { act, ksBadge, drawNow, heroLine, auraHtml, ornHtml, st, center, fitAll, clickNode, draw, get got() { return got; }, set got(v) { got = v; }, T, side, save };
})();
