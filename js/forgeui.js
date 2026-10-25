/* ============================================================================
   LA FORGE — interface (1.0.30). Chargé après ui.js ; utilise les outils exposés par ui.js (window.DX.social).
   - 36A : repère des 80 % sur les barres de l'établi et une ligne qui explique la forgemagie dure près du maximum.
   - 43A : atelier de brisage (runes Ra, Pa et simples de la sélection, valeur de chaque focus, valeur des runes face à la
     revente des objets aux prix moyens de l'HdV sur 7 jours, « ×1,8 » ou « vendre » sur chaque ligne) et bandeau des coefficients
     les plus hauts et les plus bas. Les lignes, la barre et l'atelier sont redessinés à part (brisagePatch dans ui.js, 1.0.28.1).
   - 39A : un objet d'un coup d'œil : grille compacte des caractéristiques (deux colonnes, jet min et max, écart avec l'objet porté).
   - 40A : fenêtre du soft reset des jets au lancement (seulement si E.SOFT_RESET_ON), et essai depuis le panel de test.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const { ITEMS, STATS, RUNE_SIMPLE_ONLY } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const IC = (n) => X().IC(n);
  const sIco = (k) => X().sIco(k);
  const nm = (k) => (STATS[k] ? STATS[k].name.replace("% ", "") : k);
  const pc = (x) => Math.round(x * 100);
  const kfmt = (v) => `${fmt(Math.round(v))} k`;
  const ratio = (x) => "×" + x.toFixed(1).replace(".", ",");
  const itImg = (tpl) => X().itemImg(tpl);
  const FX = {};

  /* ---------------- 36A : forgemagie dure près du maximum ---------------- */
  /* simulation 1.0.30 (scratch sim36, 300 objets niv. 190 à 200 au jet moyen de 52 %, runes Ra, Pa puis simples, version finale avec PM, Tacle et Fuite) : médiane des runes
     pour passer Parfait, avant et après ; un objet de ce niveau brisé à 100 % rend environ 533 runes. À refaire si E.FM_HARD change. */
  FX.HARD_SIM = { before: 80, after: 350, brk: 533 };
  const dec = (x) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");
  FX.hardNote = (it) => {
    const s = S(); const job = E.fmJobOf(it.tpl); const ren = E.fmRen(s, job); const sc = String(E.FM_HARD.sc).replace(".", ","), ec = pc(E.FM_HARD.ec);
    if (s.fmHardSeen) return `<div class="fhard xs">${X().G("warn")}<span><b>Près du jet maximum, la forgemagie devient dure</b> : au-dessus de ${pc(E.FM_HARD.at)} % du jet (repère rouge sur les barres), succès critique ×${sc} et échec critique +${ec} points, over compris.${ren ? ` Ta Renaissance ${E.roman(ren)} compte en plus.` : ""}</span></div>`;
    const Hs = FX.HARD_SIM, per = E.fmPlanPeriod(s) / 3600;
    return `<div class="fhardbox small"><b>${X().G("warn")} Près du jet maximum, la forgemagie devient dure (comme dans DOFUS)</b>
      <span>Au-dessus de ${pc(E.FM_HARD.at)} % du jet (repère rouge sur les barres) : succès critique ×${sc} et échec critique +${ec} points, over compris.</span>
      <table><thead><tr><th></th><th>Avant</th><th>Maintenant</th><th>Renaissance X</th></tr></thead><tbody>
        <tr><td>Runes pour passer un objet niv. 200 Parfait</td><td>≈ ${Hs.before}</td><td>≈ ${Hs.after}</td><td>0 (né Parfait)</td></tr>
        <tr><td>Objets brisés pour ces runes</td><td>≈ ${dec(Hs.before / Hs.brk)}</td><td>≈ ${dec(Hs.after / Hs.brk)}</td><td>0</td></tr>
        <tr><td>Plan automatique</td><td>≈&nbsp;${Math.round(Hs.before * per)}&nbsp;h</td><td>≈&nbsp;${Math.round(Hs.after * per)}&nbsp;h</td><td>–</td></tr></tbody></table>
      <span class="xs muted">${E.SOFT_RESET_ON ? "" : "Les objets déjà Parfaits le restent. "}La Renaissance des métiers de forgemagie (+1 point de succès critique par renaissance) compte en plus${ren ? ` : la tienne en ${h(E.FM_JOBS[job] ? E.FM_JOBS[job].name : job)} est ${E.roman(ren)}` : ""}.</span>
      <div class="row"><span class="grow"></span><button class="btn sm" data-fx="hardok">Compris</button></div></div>`;
  };
  FX.hardTip = (f) => (f && f.hard ? ` · près du maximum : succès critique ×${String(E.FM_HARD.sc).replace(".", ",")}, échec +${pc(E.FM_HARD.ec)} points` : "");

  /* ---------------- 43A : prix moyens de l'HdV (7 jours), lus sur le serveur ---------------- */
  const PR = { p: {}, at: {}, want: new Set(), busy: false, timer: 0 };
  const PR_TTL = 15 * 60000; // liste des prix relue toutes les 15 min
  /* l'HdV n'est ouvert qu'avec un compte, sur la partie en ligne (pas les parties solo) */
  FX.online = () => { const O = window.ONLINE; return !!(O && O.enabled && !window.__IDLUS_OFFLINE && O.user && !(O.solo && O.solo())); };
  FX.prices = () => PR.p;
  FX.need = (keys) => {
    if (!FX.online()) return; const now = Date.now();
    keys.forEach((k) => { if (k && !(PR.at[k] > now - PR_TTL)) PR.want.add(k); });
    if (PR.want.size && !PR.busy && !PR.timer) PR.timer = setTimeout(fetchPrices, 80);
  };
  async function fetchPrices() {
    PR.timer = 0; if (PR.busy || !PR.want.size) return; PR.busy = true;
    const keys = [...PR.want].slice(0, 400); keys.forEach((k) => PR.want.delete(k));
    let changed = false;
    try {
      const r = await window.ONLINE.rpc("hdv_prix7", { p_keys: keys }); const now = Date.now();
      if (!r.err && r.data && typeof r.data === "object") keys.forEach((k) => { const v = +r.data[k] || 0; if ((PR.p[k] || 0) !== v) changed = true; if (v > 0) PR.p[k] = v; else delete PR.p[k]; PR.at[k] = now; });
      else keys.forEach((k) => { PR.at[k] = now; }); // serveur muet : on ne redemande pas avant 15 min
    } catch (e) {}
    PR.busy = false;
    if (changed && X().brisageRefresh) X().brisageRefresh();
    if (PR.want.size) PR.timer = setTimeout(fetchPrices, 80);
  }
  FX.loading = () => PR.busy || PR.timer || PR.want.size > 0;

  /* ---------------- 43A : coefficients ---------------- */
  FX.coefTag = (c) => `<span class="fco ${c >= 160 ? "vhi" : c > 100 ? "hi" : c < 60 ? "lo" : ""}" data-tip="${h(E.netCoef ? "Coefficient commun à tous les joueurs en ligne (10 % à 200 %)" : "Coefficient de brisage de cet objet (10 % à 200 %)")}">${c > 100 ? "↑ " : ""}coef. ${c} %</span>`;
  /* bandeau : les coefficients les plus hauts et les plus bas (serveur en ligne, sinon ta partie) */
  FX.strip = () => {
    const s = S(); const map = E.netCoef || s.coef || {}; const base = E.coefBase(s);
    const L = Object.keys(map).filter((t) => ITEMS[t] && !ITEMS[t].trophy).map((t) => [t, E.getCoef(s, t)]);
    const hi = L.filter(([, c]) => c > 100 && c < base).sort((a, b) => b[1] - a[1] || ITEMS[b[0]].lvl - ITEMS[a[0]].lvl).slice(0, 3);
    const lo = L.filter(([, c]) => c < 100).sort((a, b) => a[1] - b[1] || ITEMS[b[0]].lvl - ITEMS[a[0]].lvl).slice(0, 3);
    if (!lo.length && !hi.length && base <= 100) return "";
    const ch = ([t, c]) => `<button class="fch" data-act="encitem" data-v="${h(t)}"><img src="${itImg(t)}" alt="" loading="lazy">${h(ITEMS[t].name)} ${FX.coefTag(c)}</button>`;
    return `<div class="fcstrip">${IC("forge")}<b>Au plus haut${E.netCoef ? " sur le serveur" : ""}</b>${base > 100 ? `<span class="fch">jamais brisés ${FX.coefTag(base)}</span>` : ""}${hi.map(ch).join("")}${!hi.length && base <= 100 ? `<span class="xs muted">aucun au-dessus de 100 %</span>` : ""}<b>Au plus bas</b>${lo.map(ch).join("") || `<span class="xs muted">personne n'a brisé ces derniers temps</span>`}</div>`;
  };

  /* ---------------- 43A : atelier de brisage ---------------- */
  const runeKeysOf = (rows) => rows.flatMap((r) => (RUNE_SIMPLE_ONLY.includes(r.k) ? [E.runeKey("", r.k)] : ["ra", "pa", ""].map((t) => E.runeKey(t, r.k))));
  const rowsW = (r) => r.eq * STATS[r.k].w * STATS[r.k].pts;
  /* valeur des runes d'une liste d'objets (focus compris) : { v, ok } ; ok quand 90 % du poids a un prix connu */
  const runeVal = (uids, focus) => { const rows = E.breakEst(S(), uids, focus); const V = E.breakValue(PR.p, rows); return { rows, v: V.v, ok: V.cov >= 0.9, d: V.d }; };
  FX.itemPrice = (tpl) => PR.p[tpl] || 0;
  /* « ×1,8 » si briser rapporte plus que revendre, « vendre » sinon ; rien sans prix connu */
  FX.rowBadge = (it, focus) => {
    if (!FX.online()) return ""; const sale = FX.itemPrice(it.tpl); const R = runeVal([it.uid], focus);
    FX.need([it.tpl].concat(runeKeysOf(R.rows)));
    if (!sale || !R.ok || !(R.v > 0)) return "";
    const k = R.v / sale; return `<span class="frent ${k >= 1 ? "ok" : "no"}" data-tip="${h(`Runes ≈ ${kfmt(R.v)} · revente ≈ ${kfmt(sale)} (prix moyens de l'HdV sur 7 jours)`)}">${k >= 1 ? ratio(k) : "vendre"}</span>`;
  };
  const table = (rows, focus, pr) => {
    const top = rows.slice(0, 6); const more = rows.length - top.length;
    const cell = (n, z) => `<td class="${n ? "" : "z"}">${z ? "–" : n ? fmt(n) : "–"}</td>`;
    return `<table class="frt"><thead><tr><th>Rune</th><th>Ra</th><th>Pa</th><th>simple</th>${pr ? "<th>≈ kamas</th>" : ""}</tr></thead><tbody>${top.map((r) => { const V = pr ? E.breakRowValue(PR.p, r) : null; const so = RUNE_SIMPLE_ONLY.includes(r.k);
      return `<tr class="${focus === r.k ? "fo" : ""}"><td>${sIco(r.k)}${h(nm(r.k))}</td>${cell(r.ra, so)}${cell(r.pa, so)}${cell(r.s)}${pr ? `<td>${V ? (V.d ? "≈ " : "") + fmt(Math.round(V.v)) : "–"}</td>` : ""}</tr>`; }).join("")}${more > 0 ? `<tr><td colspan="${pr ? 5 : 4}" class="xs muted">+ ${more} autre${more > 1 ? "s" : ""} caractéristique${more > 1 ? "s" : ""}</td></tr>` : ""}</tbody></table>`;
  };
  FX.atelier = (sel, focus, confirm) => {
    const s = S(); const uids = [...sel].filter((u) => s.items[u]); const n = uids.length;
    const head = `<section class="panel fbat"><div class="phead"><h2>${IC("forge")} Atelier de brisage</h2><span class="tag soft">${n} objet${n > 1 ? "s" : ""}</span></div><div class="pad">`;
    if (!n) return `${head}<div class="empty small">Coche des objets : l'atelier montre les runes que tu vas obtenir (Ra, Pa et simples), la valeur de chaque focus et s'il vaut mieux briser ou vendre.</div></div></section>`;
    const on = FX.online();
    const byTpl = new Map(); uids.forEach((u) => { const t = s.items[u].tpl; byTpl.set(t, (byTpl.get(t) || []).concat([u])); });
    const G = [...byTpl.entries()].sort((a, b) => ITEMS[b[0]].lvl - ITEMS[a[0]].lvl);
    const its = G.slice(0, 18).map(([t, us]) => { const c = E.getCoef(s, t); return `<span class="fbit" data-tip="${h(ITEMS[t].name)}"><img src="${itImg(t)}" alt="" loading="lazy">${us.length > 1 ? `<u>×${us.length}</u>` : ""}<i class="${c > 100 ? "hi" : c < 60 ? "lo" : ""}">${c} %</i></span>`; }).join("") + (G.length > 18 ? `<span class="fbit more">+${G.length - 18}</span>` : "");
    const rows = E.breakEst(s, uids, focus || null);
    if (on) FX.need(runeKeysOf(E.breakEst(s, uids, null)).concat(G.map(([t]) => t)));
    const val = (f) => { const R = f === (focus || null) ? { rows, V: E.breakValue(PR.p, rows) } : (() => { const r2 = E.breakEst(s, uids, f); return { rows: r2, V: E.breakValue(PR.p, r2) }; })(); return R; };
    const sortBy = (r) => { const V = on ? E.breakRowValue(PR.p, r) : null; return V ? V.v * 1e6 : rowsW(r); };
    rows.sort((a, b) => sortBy(b) - sortBy(a));
    const pr = on && rows.some((r) => E.breakRowValue(PR.p, r));
    /* focus : sans focus et les 5 caractéristiques qui pèsent le plus */
    const base = E.breakEst(s, uids, null).sort((a, b) => rowsW(b) - rowsW(a)).slice(0, 5).map((r) => r.k).filter((k) => k !== "pa" && STATS[k].pts > 0);
    const opts = [null].concat(base); if (focus && !opts.includes(focus)) opts.push(focus);
    const fv = opts.map((f) => { const R = val(f); const fr = f ? R.rows.find((r) => r.k === f) : null; return { f, v: R.V.cov >= 0.9 && (!f || fr) ? R.V.v : null, fr }; }); // focus sur une caractéristique absente : sans effet
    const best = fv.filter((x) => x.v !== null).sort((a, b) => b.v - a.v)[0];
    const chip = (x) => { const lab = x.f ? `${sIco(x.f)}${h(STATS[x.f].short || nm(x.f))}` : "Sans focus";
      const amt = x.v !== null ? kfmt(x.v) : x.fr ? (RUNE_SIMPLE_ONLY.includes(x.f) ? `${fmt(Math.round(x.fr.eq))} runes` : `${fmt(Math.round(x.fr.eq / 10))} Ra`) : x.f ? "–" : "";
      return `<button class="fchip ${(focus || null) === x.f ? "on" : ""} ${best && best === x ? "best" : ""}" data-act="fltset" data-ctx="br" data-k="focus" data-v="${x.f || ""}" ${best && best === x ? 'data-tip="Le focus qui rapporte le plus"' : ""}>${lab}${amt ? ` <em>${amt}</em>` : ""}</button>`; };
    const cur = fv.find((x) => x.f === (focus || null));
    const sales = G.map(([t, us]) => [FX.itemPrice(t), us.length]); const known = sales.filter(([p]) => p > 0); const sale = known.reduce((a, [p, q]) => a + p * q, 0); const nKnown = known.reduce((a, [, q]) => a + q, 0);
    let valBlock;
    if (!on) valBlock = `<div class="fval xs muted">Valeur en kamas et revente : prix moyens de l'HdV sur 7 jours, avec un compte sur ta partie en ligne.</div>`;
    else if (!cur || cur.v === null) valBlock = `<div class="fval xs muted">${FX.loading() ? "Prix de l'HdV en cours de lecture…" : "Pas assez de ventes de ces runes à l'HdV ces 7 derniers jours pour donner une valeur."}</div>`;
    else valBlock = `<div class="fval"><span>Valeur des runes, ${focus ? "focus " + h(nm(focus)) : "sans focus"} <span class="xs muted">(prix moyen HdV, 7 jours)</span></span><b class="num big">${kfmt(cur.v)}</b>
      <span>Revendre ${n > 1 ? `ces ${n} objets` : "cet objet"} à l'HdV${nKnown < n ? ` <span class="xs muted">(${nKnown ? `prix connu pour ${nKnown} sur ${n}` : "aucun prix connu"})</span>` : ""}</span><b class="num">${nKnown ? kfmt(sale) : "–"}</b></div>`;
    const full = on && cur && cur.v !== null && nKnown === n && sale > 0;
    const verdict = full ? `<span class="frent ${cur.v >= sale ? "ok" : "no"}">${cur.v >= sale ? `Briser rapporte ${ratio(cur.v / sale)}` : "Mieux vaut vendre"}</span>` : "";
    const btn = confirm === "brsel" ? `<button class="btn danger" data-act="brgo">Confirmer : briser ${n}</button><button class="btn sm" data-act="cancel">Annuler</button>` : `<button class="btn danger" data-act="brask">Briser ${n} objet${n > 1 ? "s" : ""}</button>`;
    return `${head}<div class="fbits">${its}</div>
      <b class="small">Ce que tu vas obtenir <span class="xs muted">· en moyenne, avant de briser</span></b>${table(rows, focus, pr)}
      <b class="small">Focus <span class="xs muted">· ${on ? "valeur des runes" : "runes"} si tu concentres tout sur une caractéristique</span></b><div class="ffc">${fv.map(chip).join("")}</div>
      ${valBlock}<div class="row fbgo">${verdict}<span class="grow"></span>${btn}</div></div></section>`;
  };

  /* ---------------- 39A : un objet d'un coup d'œil ---------------- */
  /* l'objet porté à comparer : celui du héros choisi (ou de l'équipe) au même emplacement */
  FX.wornRef = (tpl, shown) => {
    const s = S(); const T = ITEMS[tpl]; if (!T || T.slot === "dofus" || T.trophy) return null; const ui = UI();
    const c = (ui.cid && s.chars.find((x) => x.id === ui.cid)) || E.team(s)[0] || s.chars[0]; if (!c) return null;
    const slots = T.slot === "anneau" ? ["anneau1", "anneau2"] : [T.slot];
    for (const sl of slots) { const u = c.equip[sl]; const it = u && s.items[u]; if (it && (!shown || it.uid !== shown.uid)) return { it, c }; }
    return slots.some((sl) => shown && c.equip[sl] === shown.uid) ? { it: shown, c, self: true } : null;
  };
  FX.statGrid = (T, it, ref) => {
    const ks = Object.keys(T.stats).filter((k) => STATS[k]); const R = ref && !ref.self ? ref.it : null;
    const cell = (k, v, rng, d, cls) => `<div class="fsg-c ${cls || ""}">${sIco(k) || "<i></i>"}<span class="n">${h(nm(k))}${rng ? `<i>${rng}</i>` : ""}</span><b>${v}${d ? `<em class="${d > 0 ? "up" : "dn"}">${d > 0 ? "+" : ""}${fmt(d)}</em>` : ""}</b></div>`;
    const cells = ks.map((k) => { const [a, b] = T.stats[k]; const v = it ? it.stats[k] || 0 : null; const cmp = v === null ? b : v; const d = R ? cmp - (R.stats[k] || 0) : 0;
      const top = v !== null && a !== b && v >= b; return cell(k, v === null ? "" : `<span class="${v > b && b > 0 ? "ov jov" : top ? "mx jmx" : ""}">${fmt(v)}</span>`, a === b ? String(a) : `${a} à ${b}`, d, ""); });
    if (it && it.exo) cells.push(cell(it.exo, `+1`, "exo", R ? 1 - (R.exo === it.exo ? 1 : 0) - (R.stats[it.exo] || 0) : 0, "exo"));
    if (it) Object.keys(it.stats).filter((k) => !T.stats[k] && STATS[k] && it.stats[k]).forEach((k) => cells.push(cell(k, fmt(it.stats[k]), "exo", R ? it.stats[k] - (R.stats[k] || 0) : 0, "exo")));
    if (R) Object.keys(R.stats).filter((k) => !T.stats[k] && STATS[k] && R.stats[k] && !(it && it.stats[k])).forEach((k) => cells.push(cell(k, "–", "", -R.stats[k], "miss")));
    if (R && R.exo && !(it && it.exo === R.exo) && !T.stats[R.exo]) cells.push(cell(R.exo, "–", "", -1, "miss"));
    const cap = ref ? (ref.self ? `Porté par ${h(ref.c.name)}.` : `${it ? "En vert ou en rouge" : "Au jet maximum, en vert ou en rouge"} : l'écart avec ${h(ITEMS[R.tpl].name)} porté par ${h(ref.c.name)}.`) : it ? "" : "";
    return `<div class="fsg">${cells.join("")}</div>${cap ? `<div class="xs muted fsgcap">${cap}</div>` : ""}`;
  };
  /* fiche du sac : quel exemplaire montrer dans la grille */
  FX.pick = (copies) => { const u = UI().invPick; return copies.find((x) => x.uid === u) || copies[0]; };

  /* ---------------- 40A : soft reset des jets ---------------- */
  const itemLine = (x) => { const T = ITEMS[x.tpl]; const ks = Object.keys(x.cut).sort((a, b) => x.cut[b] * STATS[b].w - x.cut[a] * STATS[a].w);
    const was = x.perfect ? "Parfait" : `jet ${pc(x.q0)} %`; const now = `jet ${pc(x.q1)} %`;
    return `<div class="fsoft-it"><img src="${itImg(x.tpl)}" alt="" loading="lazy"><span><b>${h(T.name)}</b><br><span class="xs muted">${was} → ${now}</span></span><b class="num">${ks.slice(0, 2).map((k) => `−${fmt(x.cut[k])} ${h(nm(k))}`).join("<br>")}${ks.length > 2 ? `<br><span class="xs muted">+ ${ks.length - 2} autre${ks.length > 3 ? "s" : ""}</span>` : ""}</b></div>`; };
  FX.softHtml = (P, preview) => `<div class="stack fsoft">${preview ? `<span class="tag soft">Aperçu : rien n'a changé dans ta partie</span>` : ""}<h2>La forgemagie change, tes objets aussi</h2>
    <span class="small">La forgemagie devient plus dure près du jet maximum. Tout ce que la forgemagie a ajouté <b>au-dessus de ${pc(E.SOFT_AT)} %</b> du jet (entre le minimum et le maximum) est retiré : ces objets redescendent à ${pc(E.SOFT_AT)} %. Le jet d'origine et les exos ne bougent pas.</span>
    ${P.n ? `<div class="fsoft-l">${P.items.map(itemLine).join("")}</div>
    <b>Ta compensation</b><div class="fcomp"><span>${IC("forge")} ${fmt(P.runesN)} runes rendues ×${String(E.SOFT_RUNES).replace(".", ",")}</span><span>${IC("cristal")} ${P.n} Crista${P.n > 1 ? "ux" : "l"} de forgemagie</span><span>${IC("kamas")} ${fmt(P.kamas)} k</span><span>${IC("couronne")} titre « ${h(E.SOFT_TITLE)} »</span></div>
    <span class="xs muted">${P.n} objet${P.n > 1 ? "s" : ""} concerné${P.n > 1 ? "s" : ""} sur ton compte. Calculée objet par objet : les runes qui avaient fait les points retirés, ×${String(E.SOFT_RUNES).replace(".", ",")}, plus ${fmt(E.SOFT_KAMAS)} k et un Cristal par objet.</span>`
    : `<span class="small muted">Aucun de tes objets n'est concerné.</span>`}
    <div class="row"><button class="btn primary" data-act="closesheet">J'ai compris</button></div></div>`;
  /* au lancement : applique le soft reset s'il est activé, puis montre la fenêtre quand aucune autre n'est ouverte */
  FX.boot = (s) => {
    let P = null; try { P = E.softResetCheck(s); } catch (e) { P = null; }
    if (!P) return; X().markDirty(); let tries = 0;
    const show = () => { const sh = document.getElementById("sheet"); if (sh && sh.innerHTML && tries++ < 60) { setTimeout(show, 1000); return; } X().openSheet(FX.softHtml(P, false)); };
    setTimeout(show, 800);
  };
  /* panel de test : aperçu sans rien changer, ou application sur la partie de test */
  FX.softTry = (mode) => {
    const s = S(); if (!s) return;
    if (mode === "apply") { const P = E.softResetApply(s, { force: true }); X().markDirty(); X().render(); X().openSheet(FX.softHtml(P, false)); return; }
    X().openSheet(FX.softHtml(E.softResetPlan(s), true));
  };
  /* panel de test : 4 objets forgemagés « à l'ancienne » (Parfaits ou près du maximum) pour essayer le soft reset */
  FX.softGive = () => {
    const s = S(); if (!s) return 0; const lvl = Math.max(20, ...s.chars.map((c) => c.lvl));
    const tpls = Object.keys(ITEMS).filter((k) => { const T = ITEMS[k]; return !T.trophy && !T.leg && T.slot !== "dofus" && T.lvl <= lvl && T.lvl >= lvl - 30 && Object.keys(T.stats).filter((x) => T.stats[x][1] > T.stats[x][0] && T.stats[x][0] >= 0).length >= 3; });
    let n = 0; for (let i = 0; i < 4 && tpls.length; i++) { const tpl = tpls[Math.floor(Math.random() * tpls.length)]; const it = E.rollItem(s, tpl, { radiant: false }); const T = ITEMS[tpl];
      for (const k in T.stats) { const [a, b] = T.stats[k]; if (b > 0) it.stats[k] = i % 2 ? Math.round(a + (b - a) * 0.95) : b; } it.fm = 12; delete it.fmNew; n++; }
    return n;
  };

  /* clics propres à la forge (data-fx, à part du gestionnaire de ui.js) */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-fx]"); if (!t || !S()) return;
    if (t.dataset.fx === "pick") { UI().invPick = +t.dataset.uid; X().render(); }
    if (t.dataset.fx === "hardok") { S().fmHardSeen = 1; X().markDirty(); X().render(); } // l'encadré de l'établi devient une ligne
  });

  window.FORGEUI = FX;
})();
