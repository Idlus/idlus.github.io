/* ============================================================================
   LE SONGE INFINI — interface (0.1.48). La logique est dans js/songe.js, les légendaires dans js/legendaires.js.
   Page Jouer › Songe infini : le Puits des Songes (intensités, entrer), la carte du songe en cours et les
   salles suivantes, le Marché onirique, la collection des objets légendaires. Fiches : Faveur, Fontaine,
   Gobledore, vague suivante, Sable de Draconiros, réveil. Dans l'onglet Combat : la barre du songe et les salles.
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
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
  const intName = (ii) => E.SG_INT[ii].name;
  const bribes = (s) => `<span class="pill" data-tip="Bribes de rêve : gagnées quand un songe est validé, à échanger au Marché onirique.">${uimg("cristal", "uico")} <b class="num">${fmt(E.songe(s).br)}</b> Bribes</span>`;

  /* ---------- l'en-tête de la page ---------- */
  function render(main) {
    const s = S(); const on = E.expActive(s);
    const tabs = `<span class="seg">${[["songe", "Le Songe"], ["marche", "Marché onirique"], ["legs", "Légendaires"]].map(([v, n]) => `<button data-act="sg-view" data-v="${v}" aria-pressed="${ui.view === v}">${n}</button>`).join("")}</span>`;
    const sub = on ? `${intName(s.exp.ii)} · ${palName(s.exp)}` : `Aventure · dès le niveau ${E.EXP_MIN_LVL} · une carte par semaine, la même pour tous`;
    const head = `<div class="pagehead"><div><div class="small muted">${h(sub)}</div><h1>Le Songe infini</h1></div>
      <div class="row" style="flex-wrap:wrap">${bribes(s)}${tabs}${on && ui.view === "songe" ? `<button class="btn sm ${ui.confirm ? "danger" : ""}" data-act="sg-quit">${ui.confirm ? "Confirmer le réveil" : "Se réveiller"}</button>` : ""}</div></div>`;
    main.innerHTML = head + (ui.view === "marche" ? shopHtml(s) : ui.view === "legs" ? legsHtml(s) : on ? runHtml(s, s.exp) : puitsHtml(s));
    ui.key = stateKey(s);
  }
  const palName = (X_) => { const d = X_.at === null ? 1 : X_.nodes[X_.at].d; const p = E.SG_PALIERS[Math.max(0, E.sgPalier(d))]; return `palier ${ROM[E.sgPalier(d)] || "V"}, ${p[2]}`; };
  const stateKey = (s) => { const X_ = s.exp; return E.expActive(s) ? `${X_.at}|${X_.pick}|${X_.pend.length}|${X_.pts}|${X_.relics.length}|${X_.wave}|${X_.waves}|${X_.sable}` : `off|${s.expLast ? s.expLast.t : 0}|${E.songe(s).br}|${E.songe(s).unl}`; };

  /* ---------- le Puits des Songes (pas de songe en cours) ---------- */
  function puitsHtml(s) {
    const G_ = E.songe(s); const wk = E.sgWeek(s); const unl = G_.unl;
    if (ui.ii === null || ui.ii > unl) ui.ii = Math.min(unl, s.settings.sgLast === undefined ? unl : s.settings.sgLast);
    const ii = ui.ii; const err = E.expCanStart(s, ii); const INT = E.SG_INT[ii];
    const tm = team(s); const lvl = tm.length ? Math.round(tm.reduce((a, c) => a + c.lvl, 0) / tm.length) : 0;
    const reg = E.sgRegne(E.weekIdx()); const M = E.STASIS_MODS[reg.mod];
    const steps = E.SG_INT.map((x, i) => { const st = i < unl ? "done" : i === unl ? "" : "lock"; return `<button class="sg-step ${st} ${i === ii ? "on" : ""}" data-act="sg-int" data-v="${i}" ${i > unl ? "disabled" : ""} style="--gc:${x.col}"><span class="gem">${i === 0 ? "R" : i <= 4 ? "P" + i : "C" + (i - 4)}</span><b>${h(x.name)}</b><span class="lt">${x.loot ? `+${x.loot} % de butin` : "butin normal"}</span><span class="lt">${plural(x.waves, "vague")}</span><span class="st">${i < unl ? "✓ validé" : i === unl ? "à tenter" : "🔒"}</span></button>`; }).join("");
    const L = s.expLast;
    const conv = G_.from && !G_.fromSeen ? `<section class="sgd" style="margin-bottom:14px"><div class="sg-head" style="padding:14px 16px"><span class="stack" style="gap:3px"><span class="sg-k">${G("star")} L'Expédition devient le Songe infini</span><span class="small">Tes ${fmt(G_.from.ec)} Éclats sont devenus <b>${fmt(G_.from.ec * 5)} Bribes de rêve</b>${G_.from.ups ? `, et tes ${G_.from.ups} améliorations du campement <b>${fmt(G_.from.ups * 150)} Bribes</b>` : ""}. Ton record (étage ${fmt(G_.from.floor)}) et tes titres sont gardés.</span></span><button class="btn sm" data-act="sg-convok">Compris</button></div></section>` : "";
    return conv + `<section class="sgd"><div class="sg-hero"><div class="txt"><span class="sg-k">${G("star")} Le Puits des Songes</span><div class="sg-ttl">Rêve plus loin, chaque semaine</div>
      <span class="small muted">26 salles, la même carte pour tous jusqu'à lundi. Choisis ton couloir, ramasse des bonus et des points de rêve, puis tiens les vagues de la Fin du rêve. Les monstres sont au niveau de ton équipe (niveau ${lvl}).</span>
      <div class="row" style="gap:8px;flex-wrap:wrap">${err ? `<span class="tag warn">${h(err)}</span>` : `<button class="sg-btn" data-act="sg-start" data-v="${ii}">${uimg("cristal", "sg-ui")} Entrer · ${h(INT.name)}</button>`}${!err && (s.hunting || s.dungeon) ? `<span class="xs muted">la chasse reprend toute seule au réveil</span>` : ""}</div></div>
      <div class="sg-portal">${tm.slice(0, 4).map(look).join("")}</div></div>
      <div style="padding:6px 16px 16px"><div class="sg-ladder">${steps}</div></div></section>
    <div class="sg-grid">
      <section class="sgd sg-card"><h3>${G("calendar")} Cette semaine</h3>
        <div class="sg-rowi">${uimg("carte")}<span>Nouvelle carte dans <b>${weekLeft()}</b></span></div>
        <div class="sg-rowi">${uimg("couronne")}<span>Ton meilleur : <b>${wk.ii >= 0 ? `${h(intName(wk.ii))}, ${plural(wk.waves, "vague")}` : "aucun songe validé"}</b></span></div>
        <div class="sg-rowi">${uimg("trophee")}<span>Record : <b>${G_.best ? `${h(intName(G_.best.ii))}, ${plural(G_.best.waves, "vague")}` : "—"}</b></span></div>
        ${M ? `<div class="sg-rowi">${X().cmed(reg.cls)}<span><b>Songe de ${h(reg.god)}</b> (dès Paradoxe 1) : ${h(M.name)}, ${h(M.desc)}</span></div>` : ""}</section>
      <section class="sgd sg-card"><h3>${G("sparkle")} Ce que tu gardes</h3>
        <div class="sg-rowi">${uimg("sac")}<span>Le butin de chaque combat, même si tu tombes</span></div>
        <div class="sg-rowi">${uimg("cristal")}<span><b>Bribes de rêve</b> si le songe est validé, à échanger au Marché onirique</span></div>
        <div class="sg-rowi">${uimg("dofus")}<span>Un <b>objet légendaire</b>, très rarement, dès Paradoxe 2</span></div>
        <div class="sg-rowi">${uimg("parchemin_or")}<span>Les bonus et les points de rêve, eux, s'effacent au réveil</span></div></section>
      ${L ? lastHtml(s, L) : `<section class="sgd sg-card"><h3>${G("target")} Comment ça marche</h3><div class="small">Combat : points de rêve et un petit bonus. Faveur : un bonus gratuit. Fontaine (salles 4, 10, 16 et 25) : des vœux contre tes points. Gobledore : revenir en arrière ou parier. Une défaite te réveille, sauf avec un Sable de Draconiros.</div></section>`}
    </div>`;
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
    return `<section class="sgd"><div class="sg-head" style="padding:12px 16px 4px"><span class="sg-k">${G("star")} Où aller ?</span><span class="xs muted">${E.expAutoOn(s) ? `sans choix, le jeu choisit après ${Math.round(E.EXP_DOOR_MS / 1000)} s (${h(E.SG_MODES[E.sgMode(s)].toLowerCase())})` : "le jeu attend ton choix"}</span></div><div style="padding:8px 16px 16px"><div class="sg-doors" style="grid-template-columns:repeat(${Math.min(3, nx.length)},minmax(0,1fr))">${nx.map((n) => doorCard(s, X_, n, true)).join("")}</div></div></section>`; };
  const pendBtn = (p) => `<button class="sg-btn" data-act="sg-reopen">${p.t === "favor" ? "La Faveur onirique" : p.t === "fount" ? "La Fontaine onirique" : p.t === "gob" ? "Le Gobledore" : p.t === "wave" ? "Vague suivante ?" : "Sable de Draconiros ?"}</button>`;
  function runHtml(s, X_) {
    const p = X_.pend[0]; const n = X_.pick !== null ? X_.nodes[X_.pick] : null;
    const state = p ? `<div class="sg-wave"><b>Un choix t'attend</b>${pendBtn(p)}</div>` : n ? `<div class="sg-wave"><b>${n.t === "end" ? `Fin du rêve · vague ${X_.wave}` : `Salle ${n.d} · ${TNAME[n.t]}`}</b><button class="btn sm" data-tab="combat">Voir le combat</button></div>` : "";
    const vert = window.innerWidth < 760;
    return `<section class="sgd">${runbar(s, X_)}${state}<div class="sg-mapwrap" style="padding:8px">${mapSvg(s, X_, vert)}</div><div style="padding:0 16px 14px">${legend}</div></section>
      ${!p && !n ? `<div style="margin-top:14px">${doorsHtml(s, X_)}</div>` : ""}
      <div class="sg-grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
        <section class="sgd sg-card"><h3>${G("sparkle")} Tes bonus du songe</h3><span class="xs muted">ils s'effacent au réveil</span>${bonusChips(s, X_)}</section>
        <section class="sgd sg-card"><h3>${G("settings")} Choix automatique</h3>
          <label class="small"><input type="checkbox" data-act="sg-auto" ${E.expAutoOn(s) ? "checked" : ""}> Choisir à ma place quand je ne réponds pas</label>
          <label class="small">Style <select data-act="sg-mode">${Object.entries(E.SG_MODES).map(([k, v]) => `<option value="${k}" ${E.sgMode(s) === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <span class="xs muted">Prudent : Faveurs et soins d'abord, réveil dès la validation. Équilibré : combats simples, continue tant que l'équipe a la moitié de ses PV. Gourmand : combats redoutables et archimonstres, paris, vagues jusqu'au bout.</span></section></div>`;
  }
  /* 0.1.48 : dans l'onglet Combat, la barre du songe et les salles suivantes entre deux combats */
  function combatHtml(s) {
    const X_ = s.exp; if (!E.expActive(s) || !X_) return "";
    const p = X_.pend[0];
    if (p) return `<section class="sgd" style="margin-bottom:12px">${runbar(s, X_)}<div class="sg-wave"><b>Un choix t'attend</b>${pendBtn(p)}</div></section>`;
    if (X_.pick !== null) return `<section class="sgd" style="margin-bottom:12px">${runbar(s, X_)}</section>`;
    return `<section class="sgd" style="margin-bottom:12px">${runbar(s, X_)}</section>${doorsHtml(s, X_)}`;
  }

  /* ---------- les fiches ---------- */
  const timer = (p) => (E.expAutoOn(S()) ? `<span class="xs muted" id="sgTimer">choix auto dans ${Math.max(0, Math.ceil((E.EXP_AUTO_MS - (E.now() - p.at)) / 1000))} s</span>` : "");
  const offer = (o, i, act, extra = "") => {
    let ic = "", rk = "", nm = "", d = "", col = "#d8d2f0";
    if (o.k === "relic") { const r = E.EXP_RELICS[o.id]; ic = relImg(o.id); rk = `Bonus ${RK[r.r][0].toLowerCase()}`; nm = r.name; d = r.desc; col = RK[r.r][1]; }
    if (o.k === "heal") { ic = uimg("phenix", ""); rk = "Soin"; nm = o.v >= 100 ? "Source de vie" : "Second souffle"; d = o.v >= 100 ? "Tous les PV, et les héros à terre se relèvent" : `L'équipe récupère ${o.v} % de ses PV`; col = "#8ff0a0"; }
    if (o.k === "pts") { ic = uimg("dofus", ""); rk = "Points de rêve"; nm = "Songeur aguerri"; d = `+${o.v} points de rêve tout de suite`; col = "#f0c35a"; }
    if (o.k === "sable") { ic = uimg("poussiere", ""); rk = "Utilitaire"; nm = "Sable de Draconiros"; d = "Rejoue un combat perdu au lieu de te réveiller"; col = "#5fd8d0"; }
    return `<button class="sg-of ${o.sold ? "sold" : ""}" style="--oc:${col}" data-act="${act}" data-i="${i}" ${o.sold ? "disabled" : ""}><span class="orb">${ic}</span><span class="rk">${h(rk)}</span><b>${h(nm)}</b><span class="xs muted">${h(d)}</span>${extra}</button>`;
  };
  function pendHtml(s, p) {
    const X_ = s.exp; const n = X_.pick !== null ? X_.nodes[X_.pick] : null; const room = n ? `Salle ${n.d}` : "";
    const head = (k, t, sub) => `<div class="stack" style="gap:4px"><span class="sg-k">${G("star")} ${h(k)}</span><span class="sg-ttl" style="font-size:24px">${h(t)}</span>${sub ? `<span class="small muted">${sub}</span>` : ""}</div>`;
    const storm = `<button class="sg-btn ghost" data-act="sg-storm" ${X_.pts < E.SG_STORM ? "disabled" : ""}>Tempête astrale · ${E.SG_STORM} points</button>`;
    let body = "";
    if (p.t === "favor") body = head(`${room} · Faveur onirique`, "Un songeur t'offre un présent", "Pas de combat ici. Choisis un bonus, il dure jusqu'au réveil.") + `<div class="sg-offer" style="grid-template-columns:repeat(${p.opts.length},minmax(0,1fr))">${p.opts.map((o, i) => offer(o, i, "sg-pick")).join("")}</div><div class="row" style="gap:8px;flex-wrap:wrap">${storm}${timer(p)}</div>`;
    if (p.t === "fount") body = head(`${room} · Fontaine onirique`, "La Fontaine murmure cinq vœux", `Dépense tes points de rêve (il t'en reste <b>${fmt(X_.pts)}</b>). Tu peux en prendre plusieurs.`) + `<div class="sg-shop">${p.opts.map((o, i) => offer(o, i, "sg-buy", `<span class="sg-chip g">${G("star")} ${o.price} points</span>`)).join("")}</div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="sg-btn" data-act="sg-no">Continuer le songe</button>${storm}${timer(p)}</div>`;
    if (p.t === "gob") body = head(`${room} · Gobledore`, "Un Gobledore te barre la route", "Ce petit être rare plie le songe. Il ne revient pas deux fois dans le même rêve.") + `<div class="sg-offer">
      <button class="sg-of" style="--oc:#5fd8d0" data-act="sg-gob" data-v="back" ${p.back === null || p.back === undefined ? "disabled" : ""}><span class="orb">${uimg("carte", "")}</span><span class="rk">Retour</span><b>Reprendre un chemin</b><span class="xs muted">${p.back !== null && p.back !== undefined ? `Revenir à la salle ${X_.nodes[p.back].d} et choisir un autre couloir` : "Pas encore de salle où revenir"}</span></button>
      <button class="sg-of" style="--oc:#f0c35a" data-act="sg-gob" data-v="bet" ${X_.pts < E.SG_BET ? "disabled" : ""}><span class="orb">${uimg("bourse", "")}</span><span class="rk">Pari</span><b>Quitte ou double</b><span class="xs muted">Mise ${E.SG_BET} points de rêve : une chance sur deux de les doubler</span></button>
      <button class="sg-of" style="--oc:#8ff0a0" data-act="sg-gob" data-v="pass"><span class="orb">${uimg("cle", "")}</span><span class="rk">Passage</span><b>Le laisser filer</b><span class="xs muted">+${E.SG_PTS.gob} points de rêve, et tu continues</span></button></div><div class="row">${timer(p)}</div>`;
    if (p.t === "wave") { const INT = E.SG_INT[X_.ii];
      body = head("Fin du rêve", X_.valid ? `Vague ${X_.waves} tenue · songe validé ✓` : `Vague ${X_.waves} tenue`, X_.valid ? `Chaque vague de plus donne ${Math.round(20 * (1 + 0.5 * X_.ii))} Bribes de rêve. Les PV ne remontent pas : équipe à ${E.sgAvgHp(s)} %.` : `Encore ${INT.waves - X_.waves} vague${INT.waves - X_.waves > 1 ? "s" : ""} pour valider le songe. Équipe à ${E.sgAvgHp(s)} % de ses PV.`)
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
      <span class="small muted">${L.valid ? "Tu gardes tout : butin, Bribes de rêve et le coffre du songe." : "Tu gardes le butin des combats. Les bonus et les points de rêve s'effacent."}</span></div>
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
      return `<div class="sg-it ${o.kind === "look" ? "leg" : o.kind === "up" ? "act" : ""} ${own ? "sold" : ""}"><span class="top"><span class="ico">${icon}</span><span><span class="rk">${h(E.SG_SHOP_KIND[o.kind])}</span><br><b>${h(o.name)}</b></span></span><span class="xs muted">${h(o.desc)}</span>
        <span class="pr"><span class="sg-chip g">${uimg("cristal")} ${fmt(o.price)}</span>${own ? (o.id === "cadre" ? `<label class="xs"><input type="checkbox" data-act="sg-cadre" ${s.settings.cadreSonge ? "checked" : ""}> porté</label>` : `<span class="xs">✓ échangé</span>`) : `<button class="btn sm ${ok ? "primary" : ""}" data-act="sg-shop" data-id="${o.id}" ${ok ? "" : "disabled"}>Échanger</button>`}</span></div>`; };
    return `<section class="sgd"><div class="sg-head" style="padding:14px 16px"><span class="stack" style="gap:2px"><span class="sg-k">${G("star")} Marché onirique</span><span class="small muted">Neru Stalar échange tes Bribes de rêve. Elles tombent quand un songe est validé : plus l'intensité est haute, plus il en tombe.</span></span>
      <span class="seg">${[["all", "Tout"], ["coffre", "Coffres"], ["look", "Apparence"], ["up", "Améliorations"]].map(([v, n]) => `<button data-act="sg-shopf" data-v="${v}" aria-pressed="${f === v}">${n}</button>`).join("")}</span></div>
      <div style="padding:0 16px 16px"><div class="sg-shop">${E.SG_SHOP.filter((o) => f === "all" || o.kind === f).map(it).join("")}</div></div></section>`;
  }

  /* ---------- les objets légendaires ---------- */
  const legName = (tpl) => `<span class="iname lxn cf">${h(ITEMS[tpl].name)}</span>`;
  const evPips = (n) => `<span class="lgev">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const legOwned = (s, k) => { let best = 0; Object.values(s.items).forEach((it) => { if (it.tpl === "leg_" + k) best = Math.max(best, E.legEv(it)); }); return best; };
  function legsHtml(s) {
    const lv = ui.lv; const L = E.LEG_LIST.filter((x) => !lv || x.lvl === lv); const owned = E.LEG_LIST.filter((x) => legOwned(s, x.k)).length;
    const card = (x) => { const ev = legOwned(s, x.k); return `<button class="sg-lg ${ev ? `lx cf ${ev <= 2 ? "e1" : ev >= 5 ? "e5" : ""}` : "no"}" data-act="sg-leg" data-k="${x.k}">${ev >= 5 ? `<i class="lxsp"></i>` : ""}<span class="lv">${x.lvl}</span><span class="or ${x.db ? "d" : ""}">${x.db ? "DOFUS" : "IDLUS"}</span><span class="ic"><img src="assets/i/${x.icon}.png" alt=""></span><b>${h(x.name)}</b>${ev ? evPips(ev) : `<span class="xs muted">${h(E.legTxt(x, 1))}</span>`}</button>`; };
    return `<section class="sgd"><div class="sg-head" style="padding:14px 16px"><span class="stack" style="gap:3px;min-width:0"><span class="sg-k" style="color:#ff9d3c">${G("star")} Objets légendaires · ${owned} sur ${E.LEG_LIST.length}</span><span class="small muted">Chacun a un passif unique. Les 26 de DOFUS sont niveau 200 ; les 12 inédits d'Idlus existent aux niveaux 50, 100 et 150. Ils ne tombent qu'à la validation d'un songe, très rarement, et seulement ceux de ton niveau ou en dessous.</span></span>
      <span class="seg">${[[0, "Tous"], [50, "50"], [100, "100"], [150, "150"], [200, "200"]].map(([v, n]) => `<button data-act="sg-legf" data-v="${v}" aria-pressed="${lv === v}">${n}</button>`).join("")}</span></div>
      <div style="padding:0 16px 12px" class="row"><span class="sg-chip">Chance par songe validé :</span>${E.LEG_RATE.map((p, i) => (p ? `<span class="sg-chip ${i >= 5 ? "r" : "v"}">${h(intName(i))} · 1 sur ${fmt(1 / p)}</span>` : "")).join("")}<span class="xs muted">pas de garantie · un seul légendaire par héros · les copies font monter l'Éveil</span></div>
      <div style="padding:0 16px 16px"><div class="sg-lgrid">${L.map(card).join("")}</div></div></section>`;
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
      case "sg-buy": { const r = E.act(s, "expBuy", +d.i); if (r) { X().toast(r); return; } X().markDirty(); const p = E.expPending(s); if (p) openPend(s, p); return; }
      case "sg-gob": choose(s, d.v); return;
      case "sg-wave": { choose(s, d.v === "no" ? "no" : 0); if (d.v !== "no") { window.DX.ui.tab = "combat"; X().render(); } return; }
      case "sg-sable": choose(s, d.v === "no" ? "no" : 0); return;
      case "sg-shop": after(E.act(s, "sgBuy", d.id)); return;
      case "sg-shopf": ui.shop = d.v; X().render(); return;
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
    if ((window.DX.ui.tab === "exp" || (window.DX.ui.tab === "combat" && on)) && !$("#sheet").innerHTML && stateKey(s) !== ui.key) { ui.key = stateKey(s); X().render(); }
  }
  setInterval(() => { try { tick(); } catch (e) { /* jamais bloquer la boucle du jeu */ } }, 700);

  /* texte de l'en-tête du combat et de la barre d'état */
  const where = (s) => { if (!E.expActive(s)) return null; const X_ = s.exp; const n = X_.pick !== null ? X_.nodes[X_.pick] : X_.at !== null ? X_.nodes[X_.at] : null; return `Songe · ${intName(X_.ii)} · ${n && n.t === "end" ? `vague ${X_.wave}` : `salle ${n ? n.d : 1}`}`; };
  window.SGUI = { render, act, change, where, combatHtml, legSheet, ui };
})();
