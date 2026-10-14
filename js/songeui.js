/* ============================================================================
   LE SONGE INFINI — interface (0.1.48). La logique est dans js/songe.js, les légendaires dans js/legendaires.js.
   Page Jouer › Songe infini : le Puits des Songes (intensités, entrer), la carte du songe en cours et les
   salles suivantes, le Marché onirique, la collection des objets légendaires. Fiches : Faveur, Fontaine,
   Gobledore, vague suivante, Sable de Draconiros, réveil. Dans l'onglet Combat : la barre du songe et les salles.
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
/* 0.1.52 : emblèmes des 8 intensités, style DOFUS 3 (lunes en métal ciselé comme les grades du Kolizéum). sgIcon(i) -> SVG. */
(function (G) {
  let uid = 0;
  const f = (n) => +n.toFixed(1);
  const P = (pts) => "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join(" L") + " Z";
  const mir = (pts) => pts.map(([x, y]) => [200 - x, y]).reverse();
  const rh = (cx, cy, rx, ry) => [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
  const ring = (cx, cy, rx, ry, t) => P(rh(cx, cy, rx, ry)) + " " + P(rh(cx, cy, rx - t * 1.25, ry - t * 1.25).reverse());
  const star4 = (cx, cy, r, w = 0.28) => P([[cx, cy - r], [cx + r * w, cy - r * w], [cx + r, cy], [cx + r * w, cy + r * w], [cx, cy + r], [cx - r * w, cy + r * w], [cx - r, cy], [cx - r * w, cy - r * w]]);
  const rot = (pts, a, cx = 100, cy = 100) => pts.map(([x, y]) => { const c = Math.cos(a), s = Math.sin(a); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; });
  // croissant : grand cercle (cx,cy,r0) moins le cercle décalé (dx,dy,r1), en arcs
  function crescentD(cx, cy, r0, dx, dy, r1, sw = [1, 0, 0, 1]) {
    const x1 = cx + dx, y1 = cy + dy, d = Math.hypot(dx, dy), a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = Math.sqrt(r0 * r0 - a * a);
    const mx = cx + (a * dx) / d, my = cy + (a * dy) / d, A = [mx + (h * dy) / d, my - (h * dx) / d], B = [mx - (h * dy) / d, my + (h * dx) / d];
    return `M${f(A[0])} ${f(A[1])} A${r0} ${r0} 0 ${sw[0]} ${sw[1]} ${f(B[0])} ${f(B[1])} A${r1} ${r1} 0 ${sw[2]} ${sw[3]} ${f(A[0])} ${f(A[1])} Z`;
  }
  const MET = {
    reve: ["#eafffc", "#6fe3d8", "#1d7c84", "#062a30", "#5fe8e0"],
    para: ["#f3eeff", "#b49cff", "#5b3fc4", "#170c42", "#a58bff"],
    cauc: ["#ffe6ea", "#ff6178", "#a3142f", "#33040e", "#ff3e5e"],
    gold: ["#fff2a6", "#f0b92a", "#a86b06", "#4a2b02", "#ffc83a"],
  };
  function emblem(parts, met, id, extra = "") {
    const [l, m, d, e, glow] = MET[met];
    const body = parts.map((p) => `<path d="${p.d || p}" fill-rule="evenodd" fill="url(#${id}${p.m ? p.m : "a"})" stroke="${p.m ? MET[p.m === "g" ? "gold" : met][3] : e}" stroke-width="3" stroke-linejoin="miter"/>`).join("");
    const all = parts.map((p) => `<path d="${p.d || p}" fill-rule="evenodd"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" class="sgi" aria-hidden="true"><defs>
  <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="180"><stop offset="0" stop-color="${l}"/><stop offset=".44" stop-color="${m}"/><stop offset=".56" stop-color="${d}"/><stop offset="1" stop-color="${m}"/></linearGradient>
  <linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="160"><stop offset="0" stop-color="${MET.gold[0]}"/><stop offset=".44" stop-color="${MET.gold[1]}"/><stop offset=".56" stop-color="${MET.gold[2]}"/><stop offset="1" stop-color="${MET.gold[1]}"/></linearGradient>
  <linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="180" y2="180"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
  <radialGradient id="${id}r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${glow}" stop-opacity=".5"/><stop offset=".7" stop-color="${glow}" stop-opacity=".08"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
  <clipPath id="${id}c">${all}</clipPath></defs>
  <circle cx="100" cy="102" r="94" fill="url(#${id}r)"/>
  <g transform="translate(0 5)" fill="${e}">${parts.map((p) => `<path d="${p.d || p}" fill-rule="evenodd"/>`).join("")}</g>
  ${body}
  <g clip-path="url(#${id}c)"><rect width="200" height="200" fill="url(#${id}s)"/><path d="M0 100 L200 100" stroke="${l}" stroke-opacity=".35" stroke-width="2"/></g>
  ${parts.map((p) => `<path d="${p.d || p}" fill-rule="evenodd" fill="none" stroke="${p.m === "g" ? MET.gold[0] : l}" stroke-opacity=".7" stroke-width="1.3" transform="translate(100 100) scale(.975) translate(-100 -100)"/>`).join("")}${extra}</svg>`;
  }
  const FAM = (i) => (i === 0 ? "reve" : i <= 4 ? "para" : "cauc");
  // ---------- A : lunes ciselées ----------
  const SW = [1, 0, 0, 1];
  function lune(i) {
    const met = FAM(i), parts = [];
    parts.push(crescentD(92, 104, 64, 30, -18, 54, SW));
    const gx = 128, gy = 84;
    if (i === 0) { parts.push(star4(gx, gy, 22)); parts.push(star4(158, 128, 11)); parts.push(star4(150, 40, 8)); }
    if (i >= 1 && i <= 4) {
      parts.push({ d: P(rh(gx, gy, 14, 18)), m: "g" });
      if (i >= 2) parts.push(ring(gx, gy, 30, 36, 8));
      if (i >= 3) { parts.push(P([[gx, gy - 40], [gx - 7, gy - 52], [gx, gy - 74], [gx + 7, gy - 52]])); parts.push(P([[gx + 34, gy], [gx + 46, gy - 7], [gx + 68, gy], [gx + 46, gy + 7]])); }
      if (i >= 4) { const r = rot([[gx + 26, gy - 26], [gx + 40, gy - 46], [gx + 32, gy - 22]], 0, gx, gy); parts.push(P([[gx + 24, gy - 28], [gx + 46, gy - 50], [gx + 30, gy - 22]])); parts.push(P([[gx - 24, gy + 28], [gx - 30, gy + 22], [gx - 40, gy + 40]])); parts.push(P([[gx + 24, gy + 28], [gx + 46, gy + 50], [gx + 30, gy + 22]])); }
    }
    if (i >= 5) {
      parts.push(P([[40, 74], [8, 40], [50, 58]])); parts.push(P([[46, 150], [20, 186], [60, 160]]));
      parts.push({ d: P(rh(gx, gy, 13, 17)), m: "g" });
      if (i >= 6) { parts.push(ring(gx, gy, 28, 34, 8)); parts.push(P([[88, 42], [80, 8], [102, 40]])); parts.push(P([[150, 150], [176, 176], [140, 160]])); }
      if (i >= 7) { parts.push(P([[gx, gy - 38], [gx - 8, gy - 50], [gx, gy - 80], [gx + 8, gy - 50]])); parts.push(P([[gx + 32, gy], [gx + 46, gy - 8], [gx + 74, gy], [gx + 46, gy + 8]])); parts.push(P([[gx + 22, gy - 26], [gx + 50, gy - 56], [gx + 28, gy - 18]])); }
    }
    return emblem(parts, met, "l" + i + "_" + (uid++));
  }
  G.sgIcon = (i) => lune(i);
})(typeof window !== "undefined" ? window : globalThis);

(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const { MONSTERS, DUNGEONS, ITEMS } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(Math.round(n));
  const G = (n) => X().G(n);
  const ui = { view: "songe", ii: null, pend: 0, end: 0, key: "", confirm: false, init: false, lv: 0, shop: "all" };

  /* ---------- petits rendus ---------- */
  const uimg = (n, cls = "sg-ui") => `<img class="${cls}" src="assets/ui/${n}.webp" alt="" loading="lazy">`;
  const mimg = (k, sz = 40, cls = "") => (MONSTERS[k] ? `<img class="${cls}" src="assets/m/${MONSTERS[k].img}.png" alt="${h(MONSTERS[k].name)}" style="width:${sz}px;height:${sz}px;object-fit:contain" loading="lazy">` : "");
  const look = (c) => `<img class="sg-look" src="assets/look/${c.cls}_${c.sex === "f" ? "f" : "m"}_${c.head || 0}.webp" alt="${h(c.name)}" loading="lazy">`;
  const relImg = (id, cls = "") => { const r = E.EXP_RELICS[id]; return r ? X().im(X().resImg(r.res), cls, r.name) : ""; };
  const COL = { fight: "#d8d2f0", hard: "#ff9a5a", favor: "#8ff0a0", fount: "#5fd8d0", archi: "#c79bff", gob: "#f0c35a", end: "#ff6f86" };
  const TNAME = { fight: "Combat", hard: "Combat redoutable", archi: "Archimonstre", favor: "Faveur onirique", fount: "Fontaine onirique", gob: "Gobledore", end: "Fin du rêve" };
  const RK = { c: ["Commun", "#d8d2f0"], r: ["Rare", "#5fbfff"], l: ["Légendaire", "#f0c35a"] };
  const ROM = ["I", "II", "III", "IV", "V"];
  const plural = (n, s) => `${fmt(n)} ${s}${n > 1 ? "s" : ""}`;
  const weekLeft = () => { const s = Math.max(0, (E.weekEnd() - E.now()) / 1000); const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600); return d ? `${d} j ${hh} h` : hh ? `${hh} h` : "moins d'une heure"; };
  const team = (s) => E.team(s);
  const intName = (ii) => (E.SG_INT[ii] ? E.SG_INT[ii].name : E.SG_INT[0].name);
  const bribes = (s) => `<span class="pill" data-tip="Bribes de rêve : gagnées à chaque vague de la Fin du rêve et quand un songe est validé, à échanger au Marché onirique.">${uimg("cristal", "uico")} <b class="num">${fmt(E.songe(s).br)}</b> Bribes</span>`;

  /* ---------- l'en-tête de la page ---------- */
  function render(main) {
    const s = S(); const on = E.expActive(s); const X_ = s.exp;
    const legN = E.LEG_LIST.filter((x) => legOwned(s, x.k)).length;
    const afford = E.SG_SHOP.filter((o) => !(o.once && E.sgOwned(s, o.id)) && E.songe(s).br >= o.price).length + E.sgWeekShop().filter((o) => E.sgWeekLeft(s, o.id) > 0 && E.songe(s).br >= o.price).length; // 1.0.30 : offres de la semaine
    const tab = (v, ic, n, badge) => `<button data-act="sg-view" data-v="${v}" aria-pressed="${ui.view === v}">${uimg(ic, "sgx-ti")}<span>${n}</span>${badge !== "" ? `<em>${badge}</em>` : ""}</button>`;
    const sub = on ? `${intName(X_.ii)} · salle ${curD(X_)} sur ${E.SG_ROOMS}` : `dès le niveau ${E.EXP_MIN_LVL} · nouvelle carte dans ${weekLeft()}`;
    const head = `<div class="sgx-top"><div class="sgx-title"><span class="sgx-moon" aria-hidden="true"></span><span class="sgx-tt"><h1>Le Songe infini</h1><span class="small muted">${h(sub)}</span></span>${bribes(s)}</div>
      <nav class="sgx-tabs">${tab("songe", "carte", on ? "Mon songe" : "Le Puits", on ? `${curD(X_)}/${E.SG_ROOMS}` : "")}${tab("marche", "cristal", "Marché onirique", afford || "")}${tab("legs", "dofus", "Légendaires", `${legN}/${E.LEG_LIST.length}`)}</nav></div>`;
    const old = main.querySelector(".sgx-mapscroll"); const keep = old && ui.mapT && Date.now() - ui.mapT < 20000 ? old.scrollLeft : null; // 1.0.10.3 : la carte reste où le joueur l'a mise
    main.innerHTML = head + (ui.view === "marche" ? shopHtml(s) : ui.view === "legs" ? legsHtml(s) : on ? runHtml(s, s.exp) : puitsHtml(s));
    ui.key = stateKey(s);
    const sc = main.querySelector(".sgx-mapscroll[data-x]"); if (sc) { ui.mapAuto = Math.max(0, +sc.dataset.x - sc.clientWidth / 2); sc.scrollLeft = keep !== null ? keep : ui.mapAuto; ui.mapKeep = sc.scrollLeft; }
  }
  const curD = (X_) => (X_.pick !== null ? X_.nodes[X_.pick].d : X_.at !== null ? X_.nodes[X_.at].d : 1);
  const gem = (i) => (window.sgIcon ? window.sgIcon(i) : i === 0 ? "R" : i <= 4 ? "P" + i : "C" + (i - 4));
  const palName = (X_) => { const d = X_.at === null ? 1 : X_.nodes[X_.at].d; const p = E.SG_PALIERS[Math.max(0, E.sgPalier(d))]; return `palier ${ROM[E.sgPalier(d)] || "V"}, ${p[2]}`; };
  const stateKey = (s) => { const X_ = s.exp; return E.expActive(s) ? `${X_.at}|${X_.pick}|${X_.pend.length}|${X_.pts}|${X_.relics.length}|${X_.wave}|${X_.waves}|${X_.sable}` : `off|${s.expLast ? s.expLast.t : 0}|${E.songe(s).br}|${E.songe(s).unl}`; };

  /* ---------- le Puits des Songes (pas de songe en cours) ---------- */
  function puitsHtml(s) {
    const G_ = E.songe(s); const wk = E.sgWeek(s); const unl = G_.unl;
    if (ui.ii === null || ui.ii > unl) ui.ii = Math.min(unl, s.settings.sgLast === undefined ? unl : s.settings.sgLast);
    const ii = ui.ii; const err = E.expCanStart(s, ii); const INT = E.SG_INT[ii];
    const tm = team(s); const lvl = tm.length ? Math.round(tm.reduce((a, c) => a + c.lvl, 0) / tm.length) : 0;
    const reg = E.sgRegne(E.weekIdx()); const M = E.STASIS_MODS[reg.mod];
    const track = E.SG_INT.map((x, i) => { const st = i < unl ? "done" : i === unl ? "next" : "lock"; return `<button class="sgx-gem ${st} ${i === ii ? "on" : ""}" style="--gc:${x.col}" data-act="sg-int" data-v="${i}" ${i > unl ? "disabled" : ""} data-tip="${h(x.name)}"><i>${gem(i)}</i><span>${i < unl ? "✓" : i === unl ? "à tenter" : "🔒"}</span></button>`; }).join(`<span class="sgx-link"></span>`);
    const rate = E.LEG_RATE[ii]; const br = Math.round((60 + 20 * INT.waves) * (1 + 0.5 * ii));
    const diff = Math.round(E.SG_INT[ii].base);
    const detail = `<div class="sgx-int" style="--gc:${INT.col}"><div class="sgx-int-h"><span class="sgx-big">${gem(ii)}</span><span class="stack" style="gap:1px;min-width:0"><b>${h(INT.name)}</b><span class="xs muted">${ii < unl ? "déjà validé, tu peux le rejouer" : ii === unl ? "ta prochaine intensité à valider" : "verrouillé"}</span></span></div>
      <div class="sgx-facts"><span><b>${INT.loot ? `+${INT.loot} %` : "normal"}</b>butin</span><span><b>${INT.waves}</b>vague${INT.waves > 1 ? "s" : ""} à tenir</span><span><b class="sgx-pips">${Array.from({ length: 11 }, (_, k) => `<i class="${k < diff ? "on" : ""}"></i>`).join("")}</b>difficulté</span><span data-tip="${h(`Dont ${fmt(E.sgWaveBribes(ii))} à chaque vague tenue, gardées même sans valider`)}"><b>≈ ${fmt(br)}</b>Bribes si validé</span><span><b>${rate ? `1 sur ${fmt(1 / rate)}` : "—"}</b>légendaire</span></div>
      <div class="sgx-go">${err ? `<span class="tag warn">${h(err)}</span>` : `<button class="sg-btn sgx-enter" data-act="sg-start" data-v="${ii}">${uimg("cristal", "sg-ui")} Entrer en ${h(INT.name)}</button>`}<span class="xs muted">monstres niveau ${lvl} · ${tm.length} héros${!err && (s.hunting || s.dungeon) ? " · la chasse reprend au réveil" : ""}</span></div></div>`;
    const L = s.expLast && E.SG_INT[s.expLast.ii] ? s.expLast : null; // 1.0.10.4 : pas le résultat d'une ancienne Expédition
    const conv = G_.from && !G_.fromSeen ? `<section class="sgd sgx-note"><span class="small">${G("star")} <b>L'Expédition devient le Songe infini.</b> Tes ${fmt(G_.from.ec)} Éclats sont devenus <b>${fmt(G_.from.ec * 5)} Bribes de rêve</b>${G_.from.ups ? `, et tes ${G_.from.ups} améliorations du campement <b>${fmt(G_.from.ups * 150)} Bribes</b>` : ""}. Ton record et tes titres sont gardés.</span><button class="btn sm" data-act="sg-convok">Compris</button></section>` : "";
    const week = `<div class="sgx-week"><span class="sg-chip">${uimg("carte")} nouvelle carte dans <b>&nbsp;${weekLeft()}</b></span><span class="sg-chip">${uimg("couronne")} cette semaine : <b>&nbsp;${wk.ii >= 0 ? `${h(intName(wk.ii))}, ${plural(wk.waves, "vague")}` : "rien de validé"}</b></span><span class="sg-chip">${uimg("trophee")} record : <b>&nbsp;${G_.best ? `${h(intName(G_.best.ii))}, ${plural(G_.best.waves, "vague")}` : "—"}</b></span>${M ? `<span class="sg-chip v" data-tip="${h(M.desc)}">${X().cmed(reg.cls)} Songe ${/^[AEIOUÉ]/.test(reg.god) ? "d'" : "de "}${h(reg.god)} : <b>&nbsp;${h(M.name)}</b>&nbsp;(dès P1)</span>` : ""}</div>`; // 1.0.12.8 : « Songe d'Ecaflip » (avant : « de Ecaflip »)
    const how = `<section class="sgd sgx-how"><span class="sg-k">${G("target")} En 4 étapes</span><ol>
      <li>${uimg("carte")}<span><b>Choisis ta salle</b>combats, Faveurs, Fontaines… 26 salles en 5 paliers</span></li>
      <li>${uimg("dofus")}<span><b>Ramasse des bonus</b>et des points de rêve, dépensés aux Fontaines</span></li>
      <li>${uimg("combat")}<span><b>Tiens les vagues</b>de la Fin du rêve, sans regagner tes PV</span></li>
      <li>${uimg("cristal")}<span><b>Échange tes Bribes</b>au Marché onirique. Le butin des combats reste toujours</span></li></ol></section>`;
    return conv + rankHtml(s) + `<section class="sgd sgx-well"><div class="sgx-well-l"><span class="sg-k">${G("star")} Le Puits des Songes</span><div class="sg-ttl">Choisis ton intensité</div>
        <div class="sgx-track">${track}</div>${detail}</div>
      <div class="sgx-well-r"><div class="sg-portal">${tm.slice(0, 4).map(look).join("")}</div></div>${week}</section>
      <div class="sgx-row2">${how}${L ? lastHtml(s, L) : ""}</div>`;
  }
  const sumHtml = (L) => `<div class="sg-sum"><div><b>${L.valid ? plural(L.waves, "vague") : "non validé"}</b>Fin du rêve</div><div><b>+${fmt(L.bribes)}</b>Bribes de rêve</div><div><b>${fmt(L.rew.kamas)}</b>kamas</div><div><b>${fmt(L.rew.xp)}</b>XP par héros</div><div><b>${fmt(L.rew.items)}</b>objets</div><div><b>${fmt(L.fights)}</b>combats</div></div>`;
  const lastHtml = (s, L) => `<section class="sgd sg-card"><h3>${G("star")} Dernier songe</h3><span class="small muted">${h(intName(L.ii))} · ${L.valid ? `validé, réveil à la vague ${L.waves + (L.how === "fall" ? 1 : 0)}` : `réveil salle ${L.d}`}</span>${sumHtml(L)}${L.leg ? `<div class="small">Légendaire : ${legName(L.leg)}</div>` : ""}${L.loss && !L.valid ? `<div class="xs"><b>Pourquoi :</b> ${h(L.loss.txt)}</div>` : ""}</section>`;

  /* ---------- la carte du songe ---------- */
  const PFILL = ["rgba(150,120,255,.10)", "rgba(110,170,255,.08)", "rgba(95,216,208,.08)", "rgba(200,140,255,.09)", "rgba(255,111,134,.08)"];
  function mapSvg(s, X_, vertical) {
    const N = X_.nodes; const sp = 44, lw = vertical ? 98 : 62, pad = 30; const pi = (d) => Math.max(0, E.sgPalier(d));
    const pos = (n) => (vertical ? [pad + 30 + n.l * lw, pad + 26 + (n.d - 1) * sp + pi(n.d) * 34] : [pad + 6 + (n.d - 1) * sp, pad + 14 + n.l * lw]);
    const W = vertical ? 330 : pad * 2 + 12 + 25 * sp, H = vertical ? pad * 2 + 60 + 25 * sp + 4 * 34 : 236;
    const path = new Set(X_.path); const next = new Set(X_.pick === null && !X_.pend.length ? E.sgNext(X_) : []); const cur = X_.at;
    let o = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="height:auto;max-width:${vertical ? 380 : W}px;margin:0 auto;display:block" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carte du songe"><defs>
      <radialGradient id="sgf" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#c7b6ff" stop-opacity=".8"/><stop offset="1" stop-color="#6a4fd8" stop-opacity="0"/></radialGradient>
      <filter id="sgglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="sgc"><circle r="14"/></clipPath></defs>`;
    E.SG_PALIERS.forEach(([a, b, name], i) => { const [x1, y1] = pos({ d: a, l: 0 }), [x2, y2] = pos({ d: b, l: 2 });
      o += vertical ? `<rect x="6" y="${y1 - 46}" width="${W - 12}" height="${y2 - y1 + 70}" rx="12" fill="${PFILL[i]}" stroke="rgba(255,255,255,.07)"/><text x="16" y="${y1 - 28}" font-size="10" font-weight="800" fill="#d7ccff">${ROM[i]} · ${h(name.toUpperCase())}</text>`
        : `<rect x="${x1 - 20}" y="6" width="${x2 - x1 + 40}" height="${H - 12}" rx="12" fill="${PFILL[i]}" stroke="rgba(255,255,255,.07)"/><text x="${(x1 + x2) / 2}" y="${H - 14}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#d7ccff">${ROM[i]} · ${h(name.toUpperCase())}</text>`; });
    N.forEach((a) => a.nx.forEach((j) => { const b = N[j]; const [x1, y1] = pos(a), [x2, y2] = pos(b); const walked = path.has(a.i) && path.has(b.i) && X_.path.indexOf(b.i) === X_.path.indexOf(a.i) + 1; const nx = (a.i === cur || (cur === null && false)) && next.has(b.i);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const c = vertical ? `M${x1} ${y1}C${x1} ${my},${x2} ${my},${x2} ${y2}` : `M${x1} ${y1}C${mx} ${y1},${mx} ${y2},${x2} ${y2}`;
      o += `<path d="${c}" fill="none" stroke="${walked ? "#f0c35a" : nx ? "#a6d65a" : "rgba(220,210,255,.2)"}" stroke-width="${walked ? 3.5 : nx ? 3 : 1.4}" ${nx ? 'stroke-dasharray="5 4"' : ""}/>`; }));
    N.forEach((n) => { const [x, y] = pos(n); const c = COL[n.t]; const done = path.has(n.i) && n.i !== cur; const nx = next.has(n.i); const big = n.t === "end" ? 22 : ["fight", "hard", "archi"].includes(n.t) ? 16 : 13;
      const rc = ["fight", "hard", "archi"].includes(n.t) ? E.sgRoom(s, X_, n) : null; const mk = rc && rc.mons && rc.mons[0] ? rc.mons[0] : null;
      const mimgK = mk ? (mk.archi && MONSTERS[mk.id].archi ? MONSTERS[mk.id].archi : mk.id) : null;
      o += `<g ${nx ? `data-act="sg-door" data-i="${n.i}" style="cursor:pointer"` : ""} data-tip="${h(`Salle ${n.d} · ${TNAME[n.t]}${rc && rc.mons ? " · " + monsTxt(rc.mons) : ""}`)}">`;
      if (nx) o += `<circle cx="${x}" cy="${y}" r="${big + 7}" fill="none" stroke="#a6d65a" stroke-opacity=".6" stroke-width="2"/>`;
      if (n.t === "end") o += `<circle cx="${x}" cy="${y}" r="34" fill="url(#sgf)" opacity=".75"/>`;
      o += `<circle cx="${x}" cy="${y}" r="${big}" fill="${done ? "#2b2448" : "#120e24"}" stroke="${c}" stroke-width="${n.i === cur ? 4 : nx ? 3 : 2}" ${done ? 'opacity=".7"' : ""}/>`;
      if (mimgK && MONSTERS[mimgK]) o += `<g transform="translate(${x},${y})" ${done ? 'opacity=".45"' : ""}><image href="assets/m/${MONSTERS[mimgK].img}.png" x="-15" y="-16" width="30" height="30" clip-path="url(#sgc)" preserveAspectRatio="xMidYMid meet"/></g>`;
      if (n.pips) for (let i = 0; i < n.pips; i++) o += `<circle cx="${x - (n.pips - 1) * 3.2 + i * 6.4}" cy="${y + big + 6}" r="2.3" fill="${c}"/>`;
      if (n.t === "favor") o += `<path d="M${x} ${y - 8}L${x + 2.5} ${y - 2.5}L${x + 8} ${y}L${x + 2.5} ${y + 2.5}L${x} ${y + 8}L${x - 2.5} ${y + 2.5}L${x - 8} ${y}L${x - 2.5} ${y - 2.5}Z" fill="${c}"/>`;
      if (n.t === "fount") o += `<path d="M${x} ${y - 8}C${x + 7} ${y + 1},${x + 5} ${y + 7},${x} ${y + 7}C${x - 5} ${y + 7},${x - 7} ${y + 1},${x} ${y - 8}Z" fill="${c}"/>`;
      if (n.t === "gob") o += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="15" font-weight="900" fill="${c}">?</text>`;
      if (n.t === "end") o += `<text x="${x}" y="${y + 7}" text-anchor="middle" font-size="20" font-weight="900" fill="${c}">∞</text>`;
      if (n.t === "archi") o += `<circle cx="${x + 11}" cy="${y - 11}" r="6" fill="#c79bff"/><text x="${x + 11}" y="${y - 8}" text-anchor="middle" font-size="8" font-weight="900" fill="#1b1430">A</text>`;
      if (n.i === cur) o += `<circle cx="${x}" cy="${y}" r="${big + 5}" fill="none" stroke="#f0c35a" stroke-width="2" filter="url(#sgglow)"/><rect x="${x - 15}" y="${y - big - 21}" width="30" height="14" rx="7" fill="#f0c35a"/><text x="${x}" y="${y - big - 11}" text-anchor="middle" font-size="9" font-weight="900" fill="#1b1430">TOI</text>`;
      o += `</g>`; });
    return o + "</svg>";
  }
  const monsTxt = (mons) => { const cnt = {}; mons.forEach((m) => { const k = m.archi && MONSTERS[m.id].archi ? MONSTERS[m.id].archi : m.id; cnt[k] = (cnt[k] || 0) + 1; }); return Object.entries(cnt).map(([k, n]) => `${MONSTERS[k].name}${n > 1 ? ` ×${n}` : ""}`).join(", "); };
  const legend = `<div class="row" style="flex-wrap:wrap;gap:6px">${Object.keys(COL).map((k) => `<span class="sg-chip"><i style="width:10px;height:10px;border-radius:50%;background:${COL[k]};display:inline-block"></i>${TNAME[k]}</span>`).join("")}</div>`;
  const prog = (cur) => `<span class="sg-prog">${Array.from({ length: E.SG_ROOMS }, (_, i) => `<i class="${i + 1 < cur ? "d" : i + 1 === cur ? "c" : ""} ${[3, 9, 15, 21].includes(i) ? "p" : ""}"></i>`).join("")}</span>`;
  const runbar = (s, X_, extra = "") => { const d = X_.at === null ? 0 : X_.nodes[X_.at].d; const nd = X_.pick !== null ? X_.nodes[X_.pick].d : d;
    return `<div class="sg-runbar"><span class="sg-k">${G("star")} ${h(intName(X_.ii))} · salle ${Math.max(1, nd)} sur ${E.SG_ROOMS}</span>${prog(Math.max(1, nd))}<span class="sg-chip g" data-tip="Points de rêve : gagnés en combat, dépensés aux Fontaines. Ils s'effacent au réveil.">${G("star")} <b>${fmt(X_.pts)}</b>&nbsp;points de rêve</span><span class="sg-chip">équipe à <b>&nbsp;${E.sgAvgHp(s)} %</b>&nbsp;des PV</span>${X_.sable ? `<span class="sg-chip v" data-tip="Un combat perdu se rejoue au lieu de te réveiller.">${uimg("poussiere")} Sable ×${X_.sable}</span>` : ""}${X_.waves ? `<span class="sg-chip r">vague ${X_.waves}${X_.valid ? " · validé ✓" : ` sur ${E.SG_INT[X_.ii].waves}`}</span>` : ""}${extra}</div>`; };
  const bonusChips = (s, X_) => { const fx = E.expFx(s); const t = E.expFxTxt(fx); const rel = X_.relics.map((id) => { const r = E.EXP_RELICS[id]; return `<span class="sg-chip ${r.r === "l" ? "g" : r.r === "r" ? "v" : ""}" data-tip="${h(`${r.name} (${RK[r.r][0].toLowerCase()}) : ${r.desc}`)}">${relImg(id, "sg-ui")} ${h(r.name)}</span>`; }).join("");
    return `<div class="sg-bonus">${rel || `<span class="xs muted">Pas encore de bonus : les Faveurs, les Fontaines et les combats redoutables en donnent.</span>`}</div>${t.length ? `<div class="xs muted">Total : ${h(t.join(", "))}.</div>` : ""}`; };
  /* une salle reliée, en carte cliquable */
  const doorCard = (s, X_, n, click) => {
    const rc = ["fight", "hard", "archi"].includes(n.t) ? E.sgRoom(s, X_, n) : null; const c = COL[n.t];
    let art = "", title = TNAME[n.t], rw = [];
    if (rc && rc.mons) { const big = rc.mons[0]; const k0 = big.archi && MONSTERS[big.id].archi ? MONSTERS[big.id].archi : big.id; art = rc.mons.slice(1, 3).map((m) => mimg(m.id, 46)).join("") + mimg(k0, 74); title = monsTxt(rc.mons);
      const pts = E.SG_PTS[n.t] + (n.t === "fight" ? n.pips - 1 : 0); const mk = E.SG_MINOR[rc.minor]; rw.push(`<span class="sg-chip g">+${pts} points</span>`); if (mk) rw.push(`<span class="sg-chip">+${mk[0] * (n.t === "fight" ? 1 : 2)} % ${mk[1]}</span>`);
      if (n.t === "hard") rw.push(`<span class="sg-chip v">Champions · bonus en plus</span>`); if (n.t === "archi") rw.push(`<span class="sg-chip v">bonus rare · butin ×2</span>`); }
    else if (n.t === "favor") { art = uimg("idee", "") ; title = "Un bonus gratuit parmi trois"; rw.push(`<span class="sg-chip t">pas de combat</span><span class="sg-chip g">+${E.SG_PTS.favor} points</span>`); }
    else if (n.t === "fount") { art = uimg("havre", ""); title = "Cinq vœux contre tes points"; rw.push(`<span class="sg-chip t">pas de combat</span>`); }
    else if (n.t === "gob") { art = `<span style="font-size:54px;font-weight:900;color:${c}">?</span>`; title = "Revenir, parier ou passer"; rw.push(`<span class="sg-chip t">pas de combat</span>`); }
    else if (n.t === "end") { const did = E.sgRoom(s, X_, n).dgs[0]; art = mimg(DUNGEONS[did].boss, 80); title = `${E.SG_INT[X_.ii].waves} vague${E.SG_INT[X_.ii].waves > 1 ? "s" : ""} à tenir pour valider`; rw.push(`<span class="sg-chip r">les PV ne remontent pas</span><span class="sg-chip g">Bribes de rêve</span>`); }
    return `<${click ? "button" : "div"} class="sg-door" style="--dc:${c}55;--dc2:${c}" ${click ? `data-act="sg-door" data-i="${n.i}"` : ""}><span class="art">${art}<span class="typ sg-chip" style="border-color:${c}">${TNAME[n.t]}</span>${n.pips ? `<span class="pips">${[1, 2, 3].map((i) => `<i class="${i <= n.pips ? "on" : ""}"></i>`).join("")}</span>` : ""}</span><span class="bd"><span class="key">Salle ${n.d}</span><b>${h(title)}</b><span class="rw">${rw.join("")}</span></span></${click ? "button" : "div"}>`;
  };
  const doorsHtml = (s, X_) => { const nx = E.sgNext(X_).map((i) => X_.nodes[i]);
    return `<div class="sgx-next"><div class="sgx-next-h"><span class="sg-k">${G("star")} Ta prochaine salle</span>${E.expAutoOn(s) ? `<span class="sgx-cd"><i></i></span><span class="xs muted">choix auto (${h(E.SG_MODES[E.sgMode(s)].toLowerCase())})</span>` : `<span class="xs muted">le jeu attend ton choix</span>`}</div><div class="sg-doors sgx-doors n${Math.min(3, nx.length)}">${nx.map((n) => doorCard(s, X_, n, true)).join("")}</div></div>`; };
  const pendBtn = (p) => `<button class="sg-btn" data-act="sg-reopen">${p.t === "favor" ? "Ouvrir la Faveur onirique" : p.t === "fount" ? "Ouvrir la Fontaine onirique" : p.t === "gob" ? "Voir le Gobledore" : p.t === "wave" ? "Vague suivante ?" : "Sable de Draconiros ?"}</button>`;
  const runHead = (s, X_, compact) => { const d = curD(X_); const hp = E.sgAvgHp(s); const pal = E.SG_PALIERS[Math.max(0, E.sgPalier(d))];
    return `<div class="sgx-rh"><span class="sgx-big" style="--gc:${E.SG_INT[X_.ii].col}">${gem(X_.ii)}</span><span class="sgx-rt"><b>${h(intName(X_.ii))} · salle ${d} sur ${E.SG_ROOMS}</b><span class="xs muted">${ROM[Math.max(0, E.sgPalier(d))]} · ${h(pal[2])}</span></span>
      ${prog(d)}
      <span class="sgx-stats"><span class="sg-chip g" data-tip="Points de rêve : gagnés en combat, dépensés aux Fontaines.">${G("star")} <b>${fmt(X_.pts)}</b></span><span class="sgx-hp" data-tip="PV moyens de l'équipe : ils ne remontent pas entre les salles"><i style="width:${hp}%;background:${hp > 60 ? "#8ff0a0" : hp > 30 ? "#f0c35a" : "#ff6f86"}"></i><b>${hp} %</b></span>${X_.sable ? `<span class="sg-chip v">${uimg("poussiere")} ×${X_.sable}</span>` : ""}${X_.waves ? `<span class="sg-chip r">vague ${X_.waves}${X_.valid ? " ✓" : `/${E.SG_INT[X_.ii].waves}`}</span>` : ""}</span>
      ${compact ? `<button class="btn sm" data-tab="exp">Carte</button>` : `<span class="sgx-acts"><label class="sgx-auto" data-tip="Choisir à ma place si je ne réponds pas"><input type="checkbox" data-act="sg-auto" ${E.expAutoOn(s) ? "checked" : ""}> Auto</label><select data-act="sg-mode" aria-label="Style du choix automatique">${Object.entries(E.SG_MODES).map(([k, v]) => `<option value="${k}" ${E.sgMode(s) === k ? "selected" : ""}>${v}</option>`).join("")}</select><button class="btn sm ${ui.confirm ? "danger" : ""}" data-act="sg-quit">${ui.confirm ? "Confirmer le réveil" : "Se réveiller"}</button></span>`}</div>`; };
  const relicRow = (s, X_) => { if (!X_.relics.length) return `<div class="sgx-bon"><span class="xs muted">${G("sparkle")} Pas encore de bonus : les Faveurs, les Fontaines et les combats redoutables en donnent.</span></div>`;
    const t = E.expFxTxt(E.expFx(s)); return `<div class="sgx-bon"><span class="xs muted">${G("sparkle")} ${X_.relics.length} bonus</span>${X_.relics.map((id) => { const r = E.EXP_RELICS[id]; return `<span class="sg-chip ${r.r === "l" ? "g" : r.r === "r" ? "v" : ""}" data-tip="${h(`${r.name} : ${r.desc}`)}">${relImg(id, "sg-ui")}<span class="nm">${h(r.name)}</span></span>`; }).join("")}${t.length ? `<span class="xs muted sgx-tot" data-tip="${h(t.join(", "))}">Total : ${h(t.slice(0, 3).join(", "))}${t.length > 3 ? "…" : ""}</span>` : ""}</div>`; };
  function runHtml(s, X_) {
    const p = X_.pend[0]; const n = X_.pick !== null ? X_.nodes[X_.pick] : null;
    const state = p ? `<div class="sgx-state"><b>Un choix t'attend</b>${pendBtn(p)}</div>` : n ? `<div class="sgx-state"><b>${n.t === "end" ? `Fin du rêve · vague ${X_.wave}` : `Combat en cours · salle ${n.d}, ${TNAME[n.t].toLowerCase()}`}</b><button class="btn sm" data-tab="combat">Voir le combat</button></div>` : doorsHtml(s, X_);
    const cx = X_.at !== null ? 36 + (X_.nodes[X_.at].d - 1) * 44 : 0;
    return `<section class="sgd sgx-run">${runHead(s, X_)}${relicRow(s, X_)}${state}</section>
      <section class="sgd sgx-mapbox"><div class="sgx-maph"><span class="sg-k">${G("carte")} Carte du songe</span><span class="xs muted">la même pour tous jusqu'à lundi · touche une salle reliée pour y aller</span></div>
        <div class="sgx-mapscroll" data-x="${cx}">${mapSvg(s, X_, false)}</div><div class="sgx-legend">${legend}</div></section>`;
  }
  /* dans l'onglet Combat : une barre fine, et les salles suivantes entre deux combats */
  function combatHtml(s) {
    const X_ = s.exp; if (!E.expActive(s) || !X_) return "";
    const p = X_.pend[0];
    return `<section class="sgd sgx-cbar">${runHead(s, X_, true)}${p ? `<div class="sgx-state"><b>Un choix t'attend</b>${pendBtn(p)}</div>` : X_.pick === null ? doorsHtml(s, X_) : ""}</section>`;
  }

  /* ---------- les fiches ---------- */
  const timer = (p) => (E.expAutoOn(S()) ? `<span class="xs muted" id="sgTimer">choix auto dans ${Math.max(0, Math.ceil((E.EXP_AUTO_MS - (E.now() - p.at)) / 1000))} s</span>` : "");
  const offerName = (o) => !o ? "" : o.k === "relic" ? E.EXP_RELICS[o.id].name : o.k === "heal" ? (o.v >= 100 ? "Source de vie" : "Second souffle") : o.k === "sable" ? "Sable de Draconiros" : "Songeur aguerri";
  const offer = (o, i, act, extra = "") => {
    let ic = "", rk = "", nm = "", d = "", col = "#d8d2f0";
    if (o.k === "relic") { const r = E.EXP_RELICS[o.id]; ic = relImg(o.id); rk = `Bonus ${RK[r.r][0].toLowerCase()}`; nm = r.name; d = r.desc; col = RK[r.r][1]; }
    if (o.k === "heal") { ic = uimg("phenix", ""); rk = "Soin"; nm = o.v >= 100 ? "Source de vie" : "Second souffle"; d = o.v >= 100 ? "Tous les PV, et les héros à terre se relèvent" : `L'équipe récupère ${o.v} % de ses PV`; col = "#8ff0a0"; }
    if (o.k === "pts") { ic = uimg("dofus", ""); rk = "Points de rêve"; nm = "Songeur aguerri"; d = `+${o.v} points de rêve tout de suite`; col = "#f0c35a"; }
    if (o.k === "sable") { ic = uimg("poussiere", ""); rk = "Utilitaire"; nm = "Sable de Draconiros"; d = "Rejoue un combat perdu au lieu de te réveiller"; col = "#5fd8d0"; }
    return `<button class="sg-of ${o.sold ? "sold" : ""}" style="--oc:${col}" data-act="${act}" data-i="${i}" ${o.sold ? "disabled" : ""}><span class="orb">${ic}</span><span class="rk">${h(rk)}</span><b>${h(nm)}</b><span class="xs muted">${h(d)}</span>${o.sold && act === "sg-buy" ? `<span class="sg-got">✓ Obtenu</span>` : extra}</button>`;
  };
  function pendHtml(s, p) {
    const X_ = s.exp; const n = X_.pick !== null ? X_.nodes[X_.pick] : null; const room = n ? `Salle ${n.d}` : "";
    const head = (k, t, sub) => `<div class="stack" style="gap:4px"><span class="sg-k">${G("star")} ${h(k)}</span><span class="sg-ttl" style="font-size:24px">${h(t)}</span>${sub ? `<span class="small muted">${sub}</span>` : ""}</div>`;
    const storm = `<button class="sg-btn ghost" data-act="sg-storm" ${X_.pts < E.SG_STORM ? "disabled" : ""}>Tempête astrale · ${E.SG_STORM} points</button>`;
    let body = "";
    if (p.t === "favor") body = head(`${room} · Faveur onirique`, "Un songeur t'offre un présent", "Pas de combat ici. Choisis un bonus, il dure jusqu'au réveil.") + `<div class="sg-offer" style="grid-template-columns:repeat(${p.opts.length},minmax(0,1fr))">${p.opts.map((o, i) => offer(o, i, "sg-pick")).join("")}</div><div class="row" style="gap:8px;flex-wrap:wrap">${storm}${timer(p)}</div>`;
    if (p.t === "fount") body = head(`${room} · Fontaine onirique`, "La Fontaine murmure cinq vœux", `Dépense tes points de rêve (il t'en reste <b>${fmt(X_.pts)}</b>). Tu peux en prendre plusieurs.${p.opts.some((o) => o.sold) ? ` <b style="color:#8ff0a0">✓ ${plural(p.opts.filter((o) => o.sold).length, "vœu")} pris</b>` : ""}`) + `<div class="sg-shop">${p.opts.map((o, i) => offer(o, i, "sg-buy", `<span class="sg-chip g">${G("star")} ${o.price} points</span>`)).join("")}</div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="sg-btn" data-act="sg-no">Continuer le songe</button>${storm}${timer(p)}</div>`;
    if (p.t === "gob") body = head(`${room} · Gobledore`, "Un Gobledore te barre la route", "Ce petit être rare plie le songe. Il ne revient pas deux fois dans le même rêve.") + `<div class="sg-offer">
      <button class="sg-of" style="--oc:#5fd8d0" data-act="sg-gob" data-v="back" ${p.back === null || p.back === undefined ? "disabled" : ""}><span class="orb">${uimg("carte", "")}</span><span class="rk">Retour</span><b>Reprendre un chemin</b><span class="xs muted">${p.back !== null && p.back !== undefined ? `Revenir à la salle ${X_.nodes[p.back].d} et choisir un autre couloir` : "Pas encore de salle où revenir"}</span></button>
      <button class="sg-of" style="--oc:#f0c35a" data-act="sg-gob" data-v="bet" ${X_.pts < E.SG_BET ? "disabled" : ""}><span class="orb">${uimg("bourse", "")}</span><span class="rk">Pari</span><b>Quitte ou double</b><span class="xs muted">Mise ${E.SG_BET} points de rêve : une chance sur deux de les doubler</span></button>
      <button class="sg-of" style="--oc:#8ff0a0" data-act="sg-gob" data-v="pass"><span class="orb">${uimg("cle", "")}</span><span class="rk">Passage</span><b>Le laisser filer</b><span class="xs muted">+${E.SG_PTS.gob} points de rêve, et tu continues</span></button></div><div class="row">${timer(p)}</div>`;
    if (p.t === "wave") { const INT = E.SG_INT[X_.ii];
      body = head("Fin du rêve", X_.valid ? `Vague ${X_.waves} tenue · songe validé ✓` : `Vague ${X_.waves} tenue`, X_.valid ? `Chaque vague de plus donne ${Math.round(20 * (1 + 0.5 * X_.ii))} Bribes de rêve. Les PV ne remontent pas : équipe à ${E.sgAvgHp(s)} %.` : `Encore ${INT.waves - X_.waves} vague${INT.waves - X_.waves > 1 ? "s" : ""} pour valider le songe. +${fmt(E.sgWaveBribes(X_.ii))} Bribes de rêve à chaque vague tenue, gardées même en cas de défaite. Équipe à ${E.sgAvgHp(s)} % de ses PV.`)
        + `<div class="sg-wave" style="padding:0"><span class="sg-wv">${Array.from({ length: Math.max(INT.waves, X_.waves + 1) }, (_, i) => `<span class="${i < X_.waves ? "ok" : i === X_.waves ? "cur" : ""} ${i < INT.waves ? "" : "v"}">${i + 1}</span>`).join("")}</span></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="sg-btn" data-act="sg-wave" data-v="1">Vague suivante</button>${X_.valid ? `<button class="sg-btn ghost" data-act="sg-wave" data-v="no">Se réveiller (tout garder)</button>` : ""}${timer(p)}</div>`; }
    if (p.t === "sable") body = head("Défaite", "Le sable se met à couler…", `Un Sable de Draconiros peut rembobiner le temps : l'équipe rejoue ce combat avec 50 % de PV en plus. Il t'en reste <b>${X_.sable}</b>.`) + `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="sg-btn" data-act="sg-sable" data-v="1">Utiliser le Sable</button><button class="sg-btn ghost" data-act="sg-sable" data-v="no">Se réveiller</button>${timer(p)}</div>`;
    return `<div class="sgd sg-sheet" data-pend="${p.id}">${body}</div>`;
  }
  function endHtml(s, L) {
    const err = E.expCanStart(s, L.ii); const unl = E.songe(s).unl;
    return `<div class="sgd sg-sheet end"><div class="stack" style="gap:6px;align-items:center;text-align:center"><span class="sg-portal" style="height:150px;width:100%">${team(s).slice(0, 4).map(look).join("")}</span>
      <span class="sg-k" style="color:${L.valid ? "#8ff0a0" : "#ffc0ca"}">${L.valid ? `✓ Songe validé · ${h(intName(L.ii))}` : `Songe non validé · ${h(intName(L.ii))}`}</span>
      <span class="sg-ttl" style="font-size:26px">${L.valid ? `Réveil après ${plural(L.waves, "vague")}` : `Réveil salle ${L.d}`}</span>
      <span class="small muted">${L.valid ? "Tu gardes tout : butin, Bribes de rêve et le coffre du songe." : `Tu gardes le butin des combats${L.bribes ? " et les Bribes des vagues tenues" : ""}. Les bonus et les points de rêve s'effacent.`}</span></div>
      ${sumHtml(L)}
      ${L.chest && L.chest.got.length ? `<div class="small"><b>Coffre du songe :</b> ${h(L.chest.got.join(", "))}</div>` : ""}
      ${L.leg ? `<div class="small" style="text-align:center">${G("star")} <b>Objet légendaire :</b> ${legName(L.leg)}</div>` : ""}
      ${L.loss && !L.valid ? `<div class="small"><b>Pourquoi :</b> ${h(L.loss.txt)}</div>` : ""}
      <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center">${L.valid && unl > L.ii && !E.expCanStart(s, L.ii + 1) ? `<button class="sg-btn" data-act="sg-start" data-v="${L.ii + 1}">${h(intName(L.ii + 1))} : y aller</button>` : ""}${!err ? `<button class="sg-btn ${L.valid && unl > L.ii ? "ghost" : ""}" data-act="sg-start" data-v="${L.ii}">Rejouer en ${h(intName(L.ii))}</button>` : ""}<button class="sg-btn ghost" data-act="sg-view" data-v="marche">Marché onirique</button><button class="sg-btn ghost" data-act="closesheet">Fermer</button></div></div>`;
  }

  /* ---------- le Marché onirique ---------- */
  function shopHtml(s) {
    const G_ = E.songe(s); const f = ui.shop;
    const it = (o) => { const own = o.once && E.sgOwned(s, o.id); const ok = !own && G_.br >= o.price; const icon = o.cons ? X().chestImg((D.CONSUMABLES[o.cons] && D.CONSUMABLES[o.cons].img) || "or") : o.id === "poussiere" ? uimg("poussiere", "") : o.id === "draco" ? `<img src="assets/i/18048.png" alt="">` : o.id === "brume" ? uimg("ailes", "") : o.id === "titre" ? uimg("couronne", "") : o.id === "cadre" ? uimg("teinture", "") : o.id === "sablepoche" ? uimg("phenix", "") : o.id === "faveurs" ? uimg("idee", "") : uimg("dofus", "");
      return `<div class="sg-it ${o.kind === "look" ? "leg" : o.kind === "up" ? "act" : ""} ${own ? "sold" : ""}"><span class="top"><span class="ico">${icon}</span><span><span class="rk">${h(E.SG_SHOP_KIND[o.kind])}</span><br><b>${h(o.name)}</b></span></span><span class="xs muted">${h(o.desc)}</span>${!own && !ok ? `<span class="sgx-need"><i style="width:${Math.min(100, Math.round(100 * G_.br / o.price))}%"></i></span><span class="xs muted">il te manque ${fmt(o.price - G_.br)} Bribes</span>` : ""}
        <span class="pr"><span class="sg-chip g">${uimg("cristal")} ${fmt(o.price)}</span>${own ? (o.id === "cadre" ? `<label class="xs"><input type="checkbox" data-act="sg-cadre" ${s.settings.cadreSonge ? "checked" : ""}> porté</label>` : `<span class="xs">✓ échangé</span>`) : `<button class="btn sm ${ok ? "primary" : ""}" data-act="sg-shop" data-id="${o.id}" ${ok ? "" : "disabled"}>Échanger</button>`}</span></div>`; };
    return `<section class="sgd"><div class="sg-head" style="padding:14px 16px"><span class="stack" style="gap:2px"><span class="sg-k">${G("star")} Marché onirique</span><span class="small muted">Neru Stalar échange tes Bribes de rêve. Ce que tu peux prendre maintenant est en premier.</span></span>
      <span class="seg">${[["all", "Tout"], ["coffre", "Coffres"], ["look", "Apparence"], ["up", "Améliorations"]].map(([v, n]) => `<button data-act="sg-shopf" data-v="${v}" aria-pressed="${f === v}">${n}</button>`).join("")}</span></div>
      <div style="padding:0 16px 16px">${f === "all" ? weekShopHtml(s) : ""}<div class="sg-shop">${E.SG_SHOP.filter((o) => f === "all" || o.kind === f).map((o) => [o, o.once && E.sgOwned(s, o.id) ? 2 : G_.br >= o.price ? 0 : 1]).sort((a, b) => a[1] - b[1] || a[0].price - b[0].price).map(([o]) => it(o)).join("")}</div></div></section>`;
  }

  /* ---------- les objets légendaires ---------- */
  const legName = (tpl) => `<span class="iname lxn cf">${h(ITEMS[tpl].name)}</span>`;
  const evPips = (n) => `<span class="lgev">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const legOwned = (s, k) => { let best = 0; Object.values(s.items).forEach((it) => { if (it.tpl === "leg_" + k) best = Math.max(best, E.legEv(it)); }); return best; };
  function legsHtml(s) {
    const lv = ui.lv; const owned = E.LEG_LIST.filter((x) => legOwned(s, x.k)); const top = Math.max(0, ...team(s).map((c) => c.lvl));
    const pool = E.LEG_LIST.filter((x) => (lv === -1 ? legOwned(s, x.k) : !lv || x.lvl === lv));
    const holder = (x) => { const it = Object.values(s.items).find((i) => i.tpl === x.tpl && E.equippedBy(s, i.uid)); const c = it && E.equippedBy(s, it.uid); return c ? `porté par ${h(c.name)}` : "dans le sac"; };
    const big = (x) => { const ev = legOwned(s, x.k); return `<button class="sgx-lgo lx cf ${ev <= 2 ? "e1" : ev >= 5 ? "e5" : ""}" data-act="sg-leg" data-k="${x.k}">${ev >= 5 ? `<i class="lxsp"></i>` : ""}<span class="ic"><img src="assets/i/${x.icon}.png" alt=""></span><span class="bd"><b class="lxn cf">${h(x.name)}</b><span class="xs">${evPips(ev)} Éveil ${ROM[ev - 1]} · niv. ${x.lvl} · ${holder(x)}</span><span class="xs muted">${h(E.legTxt(x, ev))}</span></span></button>`; };
    const row = (x) => { const ev = legOwned(s, x.k); const ok = x.lvl <= top; return `<button class="sgx-lgr ${ev ? "own" : ""} ${ok ? "" : "far"}" data-act="sg-leg" data-k="${x.k}"><span class="ic"><img src="assets/i/${x.icon}.png" alt=""></span><span class="bd"><b>${h(x.name)}</b><span class="xs muted">${h(E.legTxt(x, ev || 1))}</span></span><span class="tg ${x.db ? "d" : ""}">${x.db ? "DOFUS" : "IDLUS"}</span></button>`; };
    const groups = [50, 100, 150, 200].map((L) => { const xs = pool.filter((x) => x.lvl === L && !legOwned(s, x.k)); if (!xs.length) return ""; const n = E.LEG_LIST.filter((x) => x.lvl === L && legOwned(s, x.k)).length;
      return `<details class="sgx-lgg" ${L <= top || lv ? "open" : ""}><summary><b>Niveau ${L}</b><span class="xs muted">${n} sur ${E.LEG_LIST.filter((x) => x.lvl === L).length} obtenus${L > top ? ` · tombent quand ton équipe est niveau ${L}` : ""}</span></summary><div class="sgx-lgl">${xs.map(row).join("")}</div></details>`; }).join("");
    const mine = pool.filter((x) => legOwned(s, x.k));
    return `<section class="sgd sgx-legs"><div class="sgx-lgh"><span class="stack" style="gap:6px;min-width:0;flex:1 1 260px"><span class="sg-k" style="color:#ff9d3c">${G("star")} ${owned.length} sur ${E.LEG_LIST.length} objets légendaires</span><span class="sgx-bar"><i style="width:${(100 * owned.length) / E.LEG_LIST.length}%"></i></span>
        <span class="xs muted">Un passif unique chacun · un par héros · les copies montent l'Éveil</span></span>
      <span class="seg">${[[0, "Tous"], [-1, "Obtenus"], [50, "50"], [100, "100"], [150, "150"], [200, "200"]].map(([v, n]) => `<button data-act="sg-legf" data-v="${v}" aria-pressed="${lv === v}">${n}</button>`).join("")}</span></div>
      <details class="sgx-rates"><summary class="xs">Chances par songe validé (Paradoxe 1 et plus, sans garantie)</summary><div class="row" style="gap:5px;flex-wrap:wrap;margin-top:6px">${E.LEG_RATE.map((p, i) => (p ? `<span class="sg-chip ${i >= 5 ? "r" : "v"}">${h(intName(i))} · 1 sur ${fmt(1 / p)}</span>` : "")).join("")}</div></details>
      ${mine.length ? `<div class="sgx-sub">Ta collection</div><div class="sgx-lgos">${mine.map(big).join("")}</div>` : ""}
      ${lv === -1 ? "" : `<div class="sgx-sub">À découvrir</div>${groups || `<span class="xs muted">Tu les as tous !</span>`}`}</section>`;
  }
  /* fiche d'un légendaire (aussi ouverte depuis le sac) */
  function legSheet(s, k, uid) {
    const x = E.LEG[k]; const T = ITEMS[x.tpl]; const it = uid ? s.items[uid] : Object.values(s.items).filter((i) => i.tpl === x.tpl).sort((a, b) => E.legCopies(b) - E.legCopies(a))[0];
    const ev = it ? E.legEv(it) : 1; const copies = it ? Object.values(s.items).filter((i) => i.tpl === x.tpl && i.uid !== it.uid && !E.equippedBy(s, i.uid)) : [];
    const best = x.best && ITEMS[x.best] ? ITEMS[x.best].name : "";
    const ranks = ROM.map((r, i) => `<span class="${i + 1 === ev && it ? "on" : ""}"><b>${r}</b>${h(String(x.v[i]))}<em class="xs muted">${i ? `+${E.LEG_COPIES[i] - E.LEG_COPIES[i - 1]} copie${E.LEG_COPIES[i] - E.LEG_COPIES[i - 1] > 1 ? "s" : ""}` : "à l'obtention"}</em></span>`).join("");
    const st = Object.keys(T.stats).map((k2) => `<span class="statl">${X().sIco(k2)}<span>${h(D.STATS[k2] ? `${T.stats[k2][0] > 0 ? "+" : ""}${T.stats[k2][0]}${D.STATS[k2].pct ? " %" : ""} ${D.STATS[k2].name}` : k2)}</span></span>`).join("");
    const owner = it && E.equippedBy(s, it.uid);
    X().openSheet(`<div class="stack" style="gap:12px"><div class="row" style="gap:14px;align-items:center"><span class="icobox lx cf ${ev <= 2 ? "e1" : ev >= 5 ? "e5" : ""}" style="width:72px;height:72px;border-radius:16px;display:grid;place-items:center">${ev >= 5 ? `<i class="lxsp"></i>` : ""}<img src="assets/i/${x.icon}.png" alt="" style="width:56px;height:56px;object-fit:contain"></span>
      <span class="stack" style="gap:3px;min-width:0"><span class="xs muted">Objet légendaire · ${h(T.slot)} · niveau ${x.lvl} · ${x.db ? "DOFUS" : "inédit Idlus"}</span><h2 style="margin:0">${legName(x.tpl)}</h2><span class="xs muted">${it ? (owner ? `porté par ${h(owner.name)}` : "dans ton sac") : "pas encore obtenu"}</span></span></div>
      <div class="lgpas"><b class="small">${G("star")} Passif unique${it ? ` · Éveil ${ROM[ev - 1]}` : ""}</b><b>${h(E.legTxt(x, ev))}</b><div class="lgranks">${ranks}</div>
        ${it ? (ev >= 5 ? `<span class="xs muted">Éveil V atteint.</span>` : `<span class="xs">Encore ${E.legNext(it)} copie${E.legNext(it) > 1 ? "s" : ""} pour l'Éveil ${ROM[ev]}.${copies.length ? ` Tu en as ${copies.length} dans le sac.` : ""}</span>`) : ""}</div>
      <div class="stack" style="gap:4px"><span class="xs muted">Caractéristiques fixes : ${Math.round(x.ratio * 100)} % du meilleur objet de même emplacement et de même niveau${best ? ` (${h(best)})` : ""}, le passif en plus.</span><div class="tipstats">${st}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill">1 légendaire par héros</span><span class="pill">se vend à l'HdV avec son Éveil</span><span class="pill">pas de forgemagie</span><span class="pill">passif actif partout</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${it && copies.length && ev < 5 ? `<button class="btn primary" data-act="sg-fuse" data-u="${it.uid}" data-u2="${copies[0].uid}">Fondre une copie</button>` : ""}<button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }

  /* ---------- 1.0.30 : classement de la semaine, lots du top 10, nouveautés, tuile du Havre-Sac ---------- */
  const ONL = () => window.ONLINE;
  const linked = () => { const o = ONL(); return !!(o && o.enabled && o.user && o.profile && !(o.solo && o.solo())); };
  const RANK = { w: -1, list: null, me: null, at: 0, busy: false, err: false, claimed: null };
  const ord = (r) => `${r}${r === 1 ? "er" : "e"}`;
  async function rkLoad(force) {
    const o = ONL(); const db = o && o.enabled && o.db && o.db(); if (!db || RANK.busy) return;
    const w = E.weekIdx(); if (!force && RANK.w === w && Date.now() - RANK.at < 60000) return;
    RANK.busy = true; RANK.at = Date.now();
    try {
      const cols = "user_id,pseudo,main,main_lvl,ii,waves,r";
      const [a, b] = await Promise.all([db.from("lb_songe").select(cols).eq("w", w).order("r").limit(10),
        o.user ? db.from("lb_songe").select(cols).eq("w", w).eq("user_id", o.user.id).maybeSingle() : Promise.resolve({ data: null })]);
      RANK.err = !!(a && a.error); RANK.list = RANK.err ? null : (a && a.data) || []; RANK.me = (b && b.data) || null; RANK.w = w;
    } catch (e) { RANK.err = true; }
    RANK.busy = false; rkPaint();
  }
  /* mise à jour ciblée : seulement le bloc du classement (et la tuile du Havre-Sac au prochain tour de boucle) */
  const rkPaint = () => { const el = $("#sgRank"); const s = S(); if (el && s) { const html = rankBody(s); if (el.innerHTML !== html) el.innerHTML = html; } };
  const sentGet = () => { try { return JSON.parse(localStorage.getItem("idlus-songe-envoi") || "null"); } catch (e) { return null; } };
  const sentSet = (o) => { try { localStorage.setItem("idlus-songe-envoi", JSON.stringify(o)); } catch (e) {} };
  function rankBody(s) {
    const wk = E.sgWeek(s); const o = ONL(); const mine = wk.ii >= 0 ? `${h(intName(wk.ii))}, ${plural(wk.waves, "vague")}` : "rien de validé";
    if (!o || !o.enabled) return `<div class="sgr-empty small">Le classement se joue en ligne. Ton meilleur songe de la semaine : <b>${mine}</b>.</div>`;
    const row = (x, me) => `<div class="sgr-row ${me ? "me" : ""}"><b class="n">${x.r}</b><span class="who">${X().cmed(x.main, x.main_lvl)}<b>${X().pname(x.pseudo, x.user_id)}</b></span><span class="xs int">${h(intName(x.ii))}</span><b class="num">${plural(x.waves, "vague")}</b></div>`;
    const myId = o.user && o.user.id; const L = RANK.list;
    let list = L === null ? `<div class="sgr-empty small muted">${RANK.err ? `Classement indisponible pour l'instant. <button class="btn sm" data-act="sg-rk">Réessayer</button>` : "Chargement du classement…"}</div>`
      : !L.length ? `<div class="sgr-empty small muted">Personne encore cette semaine : valide un songe pour ouvrir le classement.</div>`
      : L.map((x) => row(x, x.user_id === myId)).join("") + (RANK.me && !L.some((x) => x.user_id === myId) ? row(RANK.me, true) : "");
    const sent = sentGet(); const ok = sent && myId && sent.u === myId && sent.w === wk.w ? sent : null;
    const st = !myId ? `Crée ton compte (gratuit) pour y figurer. Ton meilleur songe de la semaine : <b>${mine}</b>.`
      : o.solo && o.solo() ? "Le classement suit ta partie 1." : wk.ii < 0 ? "Valide un songe cette semaine pour entrer au classement."
      : ok && ok.res && ok.res.err && ok.ii === wk.ii && ok.waves === wk.waves ? `Ton songe (${mine}) n'a pas été retenu : ${h(ok.res.err)}.`
      : ok && ok.ii === wk.ii && ok.waves === wk.waves ? `Ton record est vérifié${ok.res && ok.res.waves !== undefined && ok.res.waves < wk.waves ? ` : ${plural(ok.res.waves, "vague")} comptée${ok.res.waves > 1 ? "s" : ""} par le serveur` : ""}.`
      : `Ton record (${mine}) part au serveur à la prochaine sauvegarde, qui le rejoue avant de le compter.`;
    return `<div class="sgr-list">${list}</div><div class="sgr-foot xs muted">${st}<br>Top 3 : titre « Maître des Songes » pour la semaine et 2 000 Bribes · top 10 : 1 000 Bribes. Records vérifiés par le serveur.</div>`;
  }
  function rankHtml(s) {
    const o = ONL(); if (o && o.enabled) rkLoad(false);
    const rk = `<section class="sgd sgr"><div class="sgr-h"><span class="sg-k">${uimg("trophee")} Classement du Songe · semaine ${E.weekIdx() % 52 + 1}</span><span class="xs muted">même carte pour tous · finit dans ${weekLeft()}</span></div><div id="sgRank">${rankBody(s)}</div></section>`;
    if (s.settings.sgNews) return `<div class="sgr-grid one">${rk}</div>`;
    const wk = E.sgWeekShop();
    const news = `<section class="sgd sgr-new"><div class="sgr-h"><span class="sg-k">${G("sparkle")} Ce qui s'améliore</span><button class="btn sm" data-act="sg-news">Compris</button></div><div class="sgr-nl">
      <div>${uimg("cristal")}<span><b>Bribes à chaque vague</b><span class="xs muted">même en cas de défaite, plus seulement à la validation</span></span></div>
      <div>${uimg("dofus")}<span><b>Légendaires dès Paradoxe 1</b><span class="xs muted">1 chance sur ${fmt(1 / E.LEG_RATE[1])}</span></span></div>
      <button data-act="sg-view" data-v="marche">${uimg("coffre")}<span><b>Marché onirique tournant</b><span class="xs muted">3 objets neufs chaque semaine : ${h(wk.map((x) => x.name).join(", "))}</span></span></button>
      <div>${uimg("havre")}<span><b>Songe sur le Havre-Sac</b><span class="xs muted">une tuile avec la carte de la semaine et ta place</span></span></div></div></section>`;
    return `<div class="sgr-grid">${rk}${news}</div>`;
  }
  /* Marché : les 3 offres de la semaine, en tête de « Tout » */
  function weekShopHtml(s) {
    const br = E.songe(s).br;
    const it = (o) => { const left = E.sgWeekLeft(s, o.id); const ok = left > 0 && br >= o.price; const C = o.cons && D.CONSUMABLES[o.cons];
      const icon = C ? X().consIco(C) : o.dust ? uimg("poussiere", "") : uimg("forge", "");
      return `<div class="sg-it wk ${left ? "" : "sold"}"><span class="top"><span class="ico">${icon}</span><span><span class="rk">Offre de la semaine · encore ${left} sur ${o.lim}</span><br><b>${h(o.name)}</b></span></span><span class="xs muted">${h(o.desc || "")}</span>${left && !ok ? `<span class="sgx-need"><i style="width:${Math.min(100, Math.round(100 * br / o.price))}%"></i></span><span class="xs muted">il te manque ${fmt(o.price - br)} Bribes</span>` : ""}
        <span class="pr"><span class="sg-chip g">${uimg("cristal")} ${fmt(o.price)}</span>${left ? `<button class="btn sm ${ok ? "primary" : ""}" data-act="sg-shopw" data-id="${o.id}" ${ok ? "" : "disabled"}>Échanger</button>` : `<span class="xs">✓ plus rien cette semaine</span>`}</span></div>`; };
    return `<div class="sgx-sub">${G("sparkle")} Cette semaine · nouvelles offres dans ${weekLeft()}</div><div class="sg-shop sgw">${E.sgWeekShop().map(it).join("")}</div><div class="sgx-sub">Toujours au Marché</div>`;
  }
  /* tuile du Havre-Sac : la carte de la semaine et ta place */
  function tile() {
    const s = S(); if (!s || !E.team(s).length) return null;
    if (Math.max(...E.team(s).map((c) => c.lvl)) < E.EXP_MIN_LVL) return null;
    const wk = E.sgWeek(s); const reg = E.sgRegne(E.weekIdx()); const on = E.expActive(s);
    const me = RANK.me && RANK.w === E.weekIdx() ? RANK.me : null;
    const txt = on ? where(s) : `carte ${/^[AEIOUÉ]/.test(reg.god) ? "d'" : "de "}${h(reg.god)} · ${wk.ii >= 0 ? `${h(intName(wk.ii))}, ${plural(wk.waves, "vague")}` : "rien de validé cette semaine"}${me ? ` · ${ord(me.r)} du classement` : ""}`;
    return { ic: `<img class="ac-tm" src="assets/ui/carte.webp" alt="">`, t: "Songe infini", s: txt, hot: !on && wk.ii < 0, act: `data-act="sg-view" data-v="songe"`,
      badge: on ? `<span class="tag">Reprendre</span>` : me ? `<span class="pill num">${ord(me.r)}</span>` : `<span class="tag">Entrer</span>` };
  }
  /* envoi du record de la semaine (après une sauvegarde en ligne réussie) et lots des semaines passées */
  let subBusy = false, subAt = 0;
  async function sgSubmit() {
    const s = S(); if (!s || !linked() || subBusy || s.panelUsed) return;
    const wk = E.sgWeek(s); if (wk.ii < 0) return;
    const uid = ONL().user.id; const sent = sentGet();
    if (sent && sent.u === uid && sent.w === wk.w && (sent.ii > wk.ii || (sent.ii === wk.ii && sent.waves >= wk.waves))) return;
    if (Date.now() - subAt < 60000) return; subAt = Date.now(); subBusy = true;
    const r = await ONL().submitGuild({ songe: 1 }); subBusy = false;
    if (!r || r.net || r.err === "trop tôt") return;
    sentSet({ u: uid, w: wk.w, ii: wk.ii, waves: wk.waves, res: r.ok ? { ii: r.fii, waves: r.waves, rank: r.rank } : { err: String(r.err || "refusé").slice(0, 80) } });
    if (r.ok && r.improved) X().toast(`Songe infini : record vérifié par le serveur, ${intName(r.ii)} · ${plural(r.waves, "vague")} (${ord(r.rank)} cette semaine).`, "rare");
    rkLoad(true);
  }
  async function sgClaim() {
    const o = ONL(); const s = S(); if (!s || !linked() || !window.MARKET) return;
    const k = `${o.user.id}:${E.weekIdx()}`; if (RANK.claimed === k) return; RANK.claimed = k;
    try { if (localStorage.getItem("idlus-songe-lots") === k) return; } catch (e) {}
    const r = await o.rpc("songe_claim", { p_after: (s.hdv && s.hdv.op) || 0 });
    if (r.err || !r.data || r.data.err) { RANK.claimed = null; return; }
    try { localStorage.setItem("idlus-songe-lots", k); } catch (e) {}
    if (r.data.ops) window.MARKET.apply(r.data.ops, true);
    if (r.data.bribes) X().toast(`Classement du Songe infini : +${fmt(r.data.bribes)} Bribes de rêve${r.data.top ? " et le titre « Maître des Songes »" : ""} !`, "rare");
  }
  if (window.ONLINE && window.ONLINE.onChange) window.ONLINE.onChange((st) => { if (st === "ok") setTimeout(() => { sgClaim(); sgSubmit(); rkLoad(false); }, 1500); });

  /* ---------- actions ---------- */
  const ours = () => !!$("#sheet .sg-sheet");
  const openPend = (s, p) => { ui.pend = p.id; X().openSheet(pendHtml(s, p)); };
  const after = (r, re = true) => { if (r) { X().toast(r); return false; } X().markDirty(); if (re) X().render(); return true; };
  const nextSheet = (s) => { const p = E.expPending(s); if (p) openPend(s, p); else { X().closeSheet(); X().render(); } };
  const choose = (s, ...a) => { const r = E.act(s, "expChoose", ...a); if (r) { X().toast(r); return; } X().markDirty(); nextSheet(s); };
  function act(a, t) {
    const s = S(); const d = t.dataset;
    switch (a) {
      case "sg-view": ui.view = d.v; ui.confirm = false; X().closeSheet(); window.DX.ui.tab = "exp"; X().render(); return;
      case "sg-int": ui.ii = +d.v; X().render(); return;
      case "sg-convok": E.songe(s).fromSeen = 1; after(null); return;
      case "sg-start": { X().closeSheet(); s.settings.sgLast = +d.v; if (after(E.act(s, "expStart", +d.v), false)) { ui.view = "songe"; ui.confirm = false; X().render(); window.scrollTo(0, 0); } return; }
      case "sg-quit": { if (!ui.confirm) { ui.confirm = true; X().render(); setTimeout(() => { if (ui.confirm) { ui.confirm = false; if (window.DX.ui.tab === "exp") X().render(); } }, 5000); return; } ui.confirm = false; after(E.act(s, "expQuit")); return; }
      case "sg-door": { const n = E.sgNode(s.exp, +d.i); const fight = n && ["fight", "hard", "archi", "end"].includes(n.t);
        if (after(E.act(s, "expDoor", +d.i), false)) { if (fight) { window.DX.ui.tab = "combat"; window.scrollTo(0, 0); } X().render(); } const p = E.expPending(s); if (p) openPend(s, p); return; }
      case "sg-auto": after(E.act(s, "expSetAuto", t.checked), false); return;
      case "sg-reopen": { const p = E.expPending(s); if (p) openPend(s, p); return; }
      case "sg-pick": choose(s, +d.i); return;
      case "sg-no": choose(s, "no"); return;
      case "sg-storm": { const r = E.act(s, "expChoose", "storm"); if (r) { X().toast(r); return; } X().markDirty(); const p = E.expPending(s); if (p) openPend(s, p); return; }
      case "sg-buy": { const p0 = E.expPending(s); const o = p0 && p0.opts[+d.i]; const r = E.act(s, "expBuy", +d.i); if (r) { X().toast(r); return; } X().markDirty();
        X().toast(`✓ Vœu obtenu : ${offerName(o)}. Il te reste ${fmt(s.exp.pts)} points de rêve.`);
        const p = E.expPending(s); if (p) { openPend(s, p); const b = $(`#sheet .sg-of[data-act="sg-buy"][data-i="${+d.i}"]`); if (b) b.classList.add("just"); } return; }
      case "sg-gob": choose(s, d.v); return;
      case "sg-wave": { choose(s, d.v === "no" ? "no" : 0); if (d.v !== "no") { window.DX.ui.tab = "combat"; X().render(); } return; }
      case "sg-sable": choose(s, d.v === "no" ? "no" : 0); return;
      case "sg-shop": after(E.act(s, "sgBuy", d.id)); return;
      case "sg-shopf": ui.shop = d.v; X().render(); return;
      case "sg-shopw": after(E.act(s, "sgBuyWeek", d.id)); return; // 1.0.30 : offre de la semaine
      case "sg-news": s.settings.sgNews = 1; X().render(); return;
      case "sg-rk": rkLoad(true); return;
      case "sg-cadre": after(E.act(s, "sgCadre", t.checked)); return;
      case "sg-legf": ui.lv = +d.v; X().render(); return;
      case "sg-leg": legSheet(s, d.k, d.u ? +d.u : undefined); return;
      case "sg-fuse": { const r = E.act(s, "legFuse", +d.u, +d.u2); if (r) { X().toast(r); return; } X().markDirty(); const it = s.items[+d.u]; if (it) legSheet(s, ITEMS[it.tpl].leg, it.uid); X().render(); return; }
    }
  }
  function change(a, t) { const s = S(); if (a === "sg-mode") after(E.act(s, "sgSetMode", t.value), false); }

  /* ---------- suivi : fiches qui s'ouvrent seules, page rafraîchie ---------- */
  function tick() {
    const s = S(); if (!s) return;
    const on = E.expActive(s); const p = on ? E.expPending(s) : null;
    const busy = $("#sheet").innerHTML && !ours();
    if (!ui.init) { ui.init = true; ui.end = s.expLast ? s.expLast.t : 0; if (p) ui.pend = 0; }
    if (p && !busy && ui.pend !== p.id) openPend(s, p);
    else if (p && ours()) { const el = $("#sgTimer"); if (el) el.textContent = `choix auto dans ${Math.max(0, Math.ceil((E.EXP_AUTO_MS - (E.now() - p.at)) / 1000))} s`; const sh = $("#sheet .sg-sheet"); if (sh && !sh.classList.contains("end") && sh.dataset.pend !== String(p.id)) openPend(s, p); }
    else if (!p && ours() && !$("#sheet .sg-sheet.end")) { X().closeSheet(); if (window.DX.ui.tab === "exp") X().render(); }
    if (!on && s.expLast && s.expLast.t !== ui.end) { ui.end = s.expLast.t; if (!busy && E.now() - s.expLast.t < 120000) { X().openSheet(endHtml(s, s.expLast)); if (window.DX.ui.tab === "exp") X().render(); } }
    if ((window.DX.ui.tab === "exp" || (window.DX.ui.tab === "combat" && on)) && !$("#sheet").innerHTML && stateKey(s) !== ui.key) { ui.key = stateKey(s); const y = window.scrollY; X().render(); if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); } // 1.0.10.3 : la page ne remonte plus à chaque salle
  }
  setInterval(() => { try { tick(); } catch (e) { /* jamais bloquer la boucle du jeu */ } }, 700);
  // 1.0.10.3 : le joueur a fait défiler la carte lui-même (pas le recentrage automatique) : on la garde à cet endroit 20 s
  document.addEventListener("scroll", (e) => { const t = e.target; if (t && t.classList && t.classList.contains("sgx-mapscroll") && Math.abs(t.scrollLeft - ui.mapKeep) > 4) ui.mapT = Date.now(); }, true);

  /* texte de l'en-tête du combat et de la barre d'état */
  const where = (s) => { if (!E.expActive(s)) return null; const X_ = s.exp; const n = X_.pick !== null ? X_.nodes[X_.pick] : X_.at !== null ? X_.nodes[X_.at] : null; return `Songe · ${intName(X_.ii)} · ${n && n.t === "end" ? `vague ${X_.wave}` : `salle ${n ? n.d : 1}`}`; };
  window.SGUI = { render, act, change, where, combatHtml, legSheet, ui, tile, RANK, rkLoad, submit: sgSubmit, claim: sgClaim };
})();
