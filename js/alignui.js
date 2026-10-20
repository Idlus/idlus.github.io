/* ============================================================================
   ALIGNEMENT — interface (1.0.30, choix 34A). Page Journal › Quêtes › Alignement :
   - les deux cités (ton camp, joueurs de chaque camp, bonus), la guerre des cités de la semaine
     (barre des points, tes points, gagnant de la semaine passée et son bonus de +5 % d'XP et de butin),
   - les quêtes de ta cité (5 chapitres de 5 étapes, js/alignement.js), « Y aller » et « Remettre »,
   - qui est de quel camp (vue lb_align du serveur), le rang, la mission en cours, l'ordre,
   - un seul camp par compte : changer de camp demande 7 jours d'attente (annulable) et ramène au rang 1.
   Le camp des joueurs s'affiche aussi dans le chat, les profils et les classements (ALIGNUI.tag, appelé
   par pname dans js/ui.js). Sans compte ni serveur : la page marche, sans la guerre ni les camps des autres.
   Le rendu est déterministe (rafraîchi toutes les 3 s par le journal de quêtes) ; le réseau est limité
   par des délais (régions : 1 min, camps : 10 min).
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE;
  if (!E || !E.ALIGN_CH || !window.DX || !window.DX.social) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const IC = (n) => X().IC(n);
  const ONL = () => window.ONLINE;
  const online = () => { const o = ONL(); return !!(o && o.enabled && o.db && !window.__IDLUS_OFFLINE); };
  const linked = () => { const o = ONL(); return !!(online() && o.user && o.profile && !(o.solo && o.solo())); };
  const top = (s) => Math.max(1, ...s.chars.map((c) => c.lvl));
  const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
  const SIDES = ["bonta", "brakmar"];
  const short = { bonta: "b", brakmar: "k" };
  const left = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const j = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60); return j ? `${j} j ${hh} h` : hh ? `${hh} h ${m % 60} min` : `${m % 60} min`; };
  /* numéro de semaine du calendrier (lundi) et fin de la semaine de jeu (lundi 0 h UTC, comme E.weekIdx) */
  const isoWeek = (t) => { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round((d - y0) / 864e5 / 7 - ((y0.getUTCDay() + 6) % 7 - 3) / 7); };
  const weekEnd = (w) => ((w + 1) * 7 - 3) * 86400000;

  /* ---------- données du serveur ---------- */
  const WARS = { w: -1, data: null, at: 0, busy: false, err: false };
  const CAMP = { u: {}, p: {}, r: {}, list: null, at: 0, busy: false };
  function syncSide() { const s = S(); E.alignRegSet({ side: linked() && s && s.align ? s.align.side : null }); } // le bonus de région va au camp du compte (pas aux parties solo ni sans compte)
  async function warLoad(force) {
    const o = ONL(); if (!online() || !o.rpc || WARS.busy) return;
    if (!force && WARS.data && Date.now() - WARS.at < 60000) return;
    WARS.busy = true; WARS.at = Date.now();
    try {
      const r = await o.rpc("align_regions", {});
      if (r && !r.err && r.data && typeof r.data === "object" && r.data.regs) {
        WARS.data = r.data; WARS.w = r.data.w; WARS.err = false; const held = {}, gauge = {};
        Object.entries(r.data.regs).forEach(([k, v]) => { if (v && v.h) held[k] = v.h; const t = (+v.b || 0) + (+v.k || 0); gauge[k] = t ? Math.round(((+v.b || 0) / t) * 100) : 50; });
        E.alignRegSet({ held, gauge }); syncSide();
      } else WARS.err = true;
    } catch (e) { WARS.err = true; }
    WARS.busy = false; paint();
  }
  async function campLoad(force) {
    const o = ONL(); const db = online() && o.db(); if (!db || CAMP.busy) return;
    if (!force && Date.now() - CAMP.at < 600000) return;
    CAMP.busy = true; CAMP.at = Date.now();
    try {
      const r = await db.from("lb_align").select("user_id,pseudo,side,ord,lvl,chap,main,main_lvl").order("lvl", { ascending: false }).limit(3000);
      if (r && !r.error && Array.isArray(r.data)) {
        CAMP.u = {}; CAMP.p = {}; CAMP.r = {}; CAMP.list = r.data;
        /* 2A : le rang d'honneur tenu par le serveur (lb_hon, supabase/alignement2.sql) ; à défaut, le niveau envoyé (5 par rang, js/honneur.js) */
        let hr = null; try { const q = await db.from("lb_hon").select("user_id,side,rank").limit(5000); if (q && !q.error && Array.isArray(q.data)) { hr = {}; q.data.forEach((y) => { hr[y.user_id + "|" + y.side] = Math.max(0, Math.min(20, +y.rank || 0)); }); } } catch (e) { hr = null; }
        r.data.forEach((x) => { x.rank = hr && (x.user_id + "|" + x.side) in hr ? hr[x.user_id + "|" + x.side] : Math.min(20, Math.floor((+x.lvl || 0) / 5)); });
        r.data.sort((a, b) => b.rank - a.rank || (b.main_lvl || 0) - (a.main_lvl || 0));
        r.data.forEach((x) => { if (!SIDES.includes(x.side)) return; CAMP.u[x.user_id] = x.side; CAMP.r[x.user_id] = x.rank; if (x.pseudo) CAMP.p[String(x.pseudo).toLowerCase()] = x.side; });
        if (window.CHAT && window.CHAT.repaint) window.CHAT.repaint();
        const ui = UI(); if (S() && ["ladder", "guild", "exp", "builds"].includes(ui.tab) && !document.querySelector("#sheet .sheet")) X().render();
      }
    } catch (e) {}
    CAMP.busy = false; paint();
  }
  /* repeint seulement la page Alignement si elle est affichée (mise à jour ciblée) */
  function paint() {
    const ui = UI(); if (!S() || ui.tab !== "quests" || ui.qt !== "align") return;
    const el = document.getElementById("alWar"); if (el && window.DX.morph) window.DX.morph(el, warHtml(S()));
    const wh = document.getElementById("alWho"); if (wh && window.DX.morph) window.DX.morph(wh, whoHtml(S()));
    const ci = document.getElementById("alCities"); if (ci && window.DX.morph) window.DX.morph(ci, citiesHtml(S()));
  }

  /* ---------- le camp d'un joueur (chat, profils, classements) ---------- */
  function sideOf(u, p) {
    const o = ONL(); const me = o && o.user && u && u === o.user.id;
    const sv = (u && CAMP.u[u]) || (p && CAMP.p[String(p).toLowerCase()]) || null;
    if (sv) return sv;
    const s = S(); return me && s && s.align ? s.align.side : null;
  }
  function tag(u, p) {
    const side = sideOf(u, p); const A = side && E.ALIGN[side]; if (!A) return "";
    return `<i class="al-w ${short[side]}" data-tip="${A.adj}" data-n="${A.name}"><img src="assets/i/${A.badge}.png" alt="${A.name}"></i>`;
  }

  /* les ailes d'alignement autour du portrait, dans le chat : elles grandissent avec le rang (rien au rang 0, Néophyte) */
  function rankIdx(u) {
    const o = ONL(); const s = S(); if (o && o.user && u && u === o.user.id && s && s.align) return E.alignRankIdx(s);
    return (u && CAMP.r[u]) || 0;
  }
  function wings(u, p, inner) {
    const side = sideOf(u, p); const r = side ? rankIdx(u) : 0; const W = window.DX.social.wingSVG; if (!r || !W) return inner;
    const w = W(side);
    const st = (S() && S().settings) || {}; const fly = !st.reduced && (st.anim || "full") === "full" ? " fly" : ""; // battement d'ailes seulement avec les animations complètes
    const t = Math.min(5, Math.ceil(r / 4)); const gold = r >= 16 ? " gold" : ""; // 20 rangs : la taille change tous les 4 rangs, ailes dorées dès le rang 16
    return `<span class="chw ${short[side]} r${t}${gold}${fly}" data-tip="${E.ALIGN[side].adj} · rang ${r} / 20">${w.replace('class="orn wing"', 'class="chw-w l"')}${inner}${w.replace('class="orn wing"', 'class="chw-w r"').replace(/(<svg[^>]*>)([\s\S]*)<\/svg>/, '$1<g transform="translate(64 0) scale(-1 1)">$2</g></svg>')}</span>`;
  }

  /* ---------- morceaux de page ---------- */
  function citiesHtml(s) {
    const A = s.align; const D = WARS.data; const r = A ? E.alignRankIdx(s) : 0;
    const city = (side) => {
      const C = E.ALIGN[side]; const mine = A && A.side === side; const pend = A && A.pend && A.pend.side === side;
      const n = D ? (side === "bonta" ? D.cb : D.ck) : null;
      const bonus = side === "bonta" ? `+1 % de PV par rang (10 % au rang 10)` : `+1 % de dommages par rang (10 % au rang 10)`;
      const sub = mine ? `${h(C.orders[A.order].name)} · rang ${r} <span class="al-nw">« ${h(E.alignRankName(s))} »</span>` : side === "bonta" ? "la cité blanche" : "la cité sombre";
      return `<div class="al-city ${short[side]}${mine ? " on" : ""}"><img class="al-bd" src="assets/i/${C.badge}.png" alt=""><h3>${C.name}${mine ? ` <span class="tag good">ton camp</span>` : ""}${pend ? ` <span class="tag warn">dans ${left(E.alSwitchLeft(s))}</span>` : ""}</h3>
        <span class="small">${sub}</span>${D && D.regs ? `<span class="xs">${Object.values(D.regs).filter((v) => v.h === side).length} région${Object.values(D.regs).filter((v) => v.h === side).length > 1 ? "s" : ""} tenue${Object.values(D.regs).filter((v) => v.h === side).length > 1 ? "s" : ""}</span>` : ""}${n === null || n === undefined ? `<span class="xs muted">${online() ? "joueurs : chargement…" : "joueurs : en ligne seulement"}</span>` : `<span class="big num">${fmt(n)} <small>joueur${n > 1 ? "s" : ""}</small></span>`}
        <span class="xs muted">${mine && r ? `+${fmt(2 * Math.min(5, r / 2))} % de ${side === "bonta" ? "PV" : "dommages"} pour tes héros` : bonus}</span></div>`;
    };
    return `<div class="al-cities">${SIDES.map(city).join("")}</div>`;
  }
  function warHtml(s) {
    const D = WARS.data; const A = s.align; const ui = UI(); const R = E.alignRegState();
    const sel = ui.alReg && E.ALIGN_REG[ui.alReg] ? ui.alReg : (A ? E.regNow(s) : "amakna");
    const Z = (window.CARTE && window.CARTE.z) || {};
    const cls = (k) => (R.held[k] === "bonta" ? "b" : R.held[k] === "brakmar" ? "k" : "n");
    const pts = Object.keys(E.ALIGN_REG).filter((k) => Z[k]).map((k) => `<button class="alr-p ${cls(k)}${k === sel ? " sel" : ""}${A && k === A.front ? " front" : ""}" style="left:${Z[k][0] / 10}%;top:${Z[k][1] / 8}%" data-act="al-reg" data-v="${k}" aria-label="${h(E.ALIGN_REG[k])}" data-tip="${h(E.ALIGN_REG[k])}"></button>`).join("")
      + (Z[E.ALIGN_CITY] ? `<span class="alr-p c" style="left:${Z[E.ALIGN_CITY][0] / 10}%;top:${Z[E.ALIGN_CITY][1] / 8}%" data-tip="Bonta et Brâkmar : les cités (non conquérables)"></span>` : "");
    const g = D && D.regs && D.regs[sel]; const b = g ? +g.b || 0 : 0, k = g ? +g.k || 0 : 0; const pb = b + k > 0 ? Math.round((b / (b + k)) * 100) : 50;
    const hd = R.held[sel]; const mine = A && hd === A.side;
    const nb = (c) => Object.keys(E.ALIGN_REG).filter((x) => cls(x) === c).length;
    const myPts = A && A.war && A.war.rg ? A.war.rg[sel] || 0 : 0;
    const side = `<div class="alr-side pad stack" style="gap:8px"><h3>${h(E.ALIGN_REG[sel])}</h3>
      <div class="small">${hd ? `Tenue par <b class="alr-${cls(sel)}">${E.ALIGN[hd].name}</b>${g && g.since ? ` depuis le ${new Date(g.since).toLocaleDateString("fr-FR")}` : ""}` : "Tenue par personne"}${mine ? ` <span class="tag good">+${E.ALIGN_REG_BONUS} % d'XP et de butin</span>` : ""}</div>
      ${D ? `<div class="alr-tug"><i class="b" style="width:${pb}%"></i><i class="k" style="width:${100 - pb}%"></i></div><div class="row between xs muted"><span>Bonta ${pb} % · ${fmt(b)}</span><span>${fmt(k)} · Brâkmar ${100 - pb} %</span></div>`
        : `<div class="xs muted">${online() ? (WARS.err ? "Serveur injoignable : réessaie plus tard." : "Chargement des régions…") : "La guerre des régions se joue en ligne, avec un compte."}</div>`}
      <div class="xs">Le camp qui tient une région y gagne <b>+${E.ALIGN_REG_BONUS} % d'XP et de butin</b>. Chasser ici, y faire des missions ou gagner des agressions avec ce front pousse la jauge. À ${E.ALIGN_REG_FLIP} % des points de la semaine, la région change de camp.</div>
      ${A ? `<div class="xs muted">Tes points ici cette semaine : <b>${fmt(myPts)}</b> · en tout ${fmt(A.war.p)} / ${fmt(E.ALIGN_WAR.cap)}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${A.front === sel ? `<span class="tag good">ton front</span>` : `<button class="btn sm primary" data-act="al-front" data-v="${sel}">En faire mon front</button>`}</div>` : ""}
      <div class="alr-leg xs"><span><i class="b"></i>Bonta ${nb("b")}</span><span><i class="k"></i>Brâkmar ${nb("k")}</span><span><i class="n"></i>Libres ${nb("n")}</span></div></div>`;
    return `<section class="panel"><div class="phead"><h2>${IC("combat")} Guerre des régions</h2><span class="xs muted">${A ? `tes points vont à ${h(E.ALIGN_REG[E.regNow(s)])}` : ""}</span></div>
      <div class="alr-map"><div class="alr-img"><img src="assets/carte/monde.webp" alt="Carte du Monde des Douze">${pts}</div>${side}</div></section>`;
  }
  function honHead(s) {
    const A = s.align; const r = E.alignRankIdx(s); const C = E.ALIGN[A.side];
    const lo = E.honCum(r), hi = E.honCum(Math.min(20, r + 1));
    return `<div class="panel alh-head ${short[A.side]}"><div class="alh-wing">${X().wingSVG ? `<span class="l">${X().wingSVG(A.side)}</span><span class="r">${X().wingSVG(A.side)}</span>` : ""}<img src="assets/i/${C.badge}.png" alt=""></div>
      <div class="grow"><h2>${C.name} · ${h(C.orders[A.order].name)}</h2><div class="alh-rk">Rang <b>${r}</b> / 20 · « ${h(E.alignRankName(s))} »</div>
      <div class="alh-bar"><i style="width:${r >= 20 ? 100 : pct(A.hon - lo, hi - lo)}%"></i><span>${r >= 20 ? `${fmt(A.hon)} points d'honneur · rang maximum` : `${fmt(A.hon - lo)} / ${fmt(hi - lo)} vers le rang ${r + 1}`}</span></div>
      <div class="xs muted">Honneur : agressions gagnées (+${E.ALIGN_HON.agrMin} à +${E.ALIGN_HON.agrMax}), missions et quêtes de cité, région défendue (+${E.ALIGN_HON.regDay} par jour), défenses gagnées (+${E.ALIGN_HON.def}). Perdre une agression lancée par toi : −${E.ALIGN_HON.agrLoss}, sans jamais perdre de rang. Être agressé ne coûte rien.</div></div></div>`;
  }
  function talHtml(s) {
    const A = s.align; const r = E.alignRankIdx(s); const L = E.ALIGN_TAL[A.order];
    return `<section class="panel"><div class="phead"><h2>Talents de l'ordre ${h(E.ALIGN[A.side].orders[A.order].name)}</h2><span class="xs muted">un par rang de 1 à 5</span></div><div class="pad alh-tal">${L.map((t, i) => `<div class="alh-t${i < r ? " on" : ""}"><span class="alh-tn">${i + 1}</span><b>${h(t.n[A.side])}</b><span class="xs">${h(t.d)}</span><span class="xs muted">${i < r ? "actif" : `rang ${i + 1}`}</span></div>`).join("")}</div></section>`;
  }
  function shopHtml(s) {
    const A = s.align; const r = E.alignRankIdx(s); const I = window.DATA.ITEMS;
    const rows = E.HON_GEAR[A.side].map((id, i) => { const T = I[id]; const need = E.honGearRank(i); const own = E.honGearOwned(s, id); const cost = E.HON_GEAR_COST[i];
      return `<div class="alh-g${own ? " own" : r >= need ? "" : " lock"}"><img src="assets/i/${T.icon}.png" alt=""><div class="grow"><b>${h(T.name)}</b><div class="xs muted">niveau 200 · ${h(T.war.d)}</div></div>
        ${own ? `<span class="tag good">obtenu</span>` : r < need ? `<span class="tag soft">${X().G("lock")} rang ${need}</span>` : `<button class="btn sm ${A.pur >= cost ? "primary" : ""}" data-act="al-buy" data-v="${T.slot}" ${A.pur >= cost && !A.pend ? "" : "disabled"}>${fmt(cost)} honneur</button>`}</div>`; }).join("");
    return `<section class="panel"><div class="phead"><h2>Arsenal de ${E.ALIGN[A.side].name}</h2><span class="xs muted">honneur à dépenser : <b>${fmt(A.pur)}</b></span></div><div class="pad stack" style="gap:6px">${rows}
      <span class="xs muted">Panoplie « ${h(window.DATA.SETS[E.HON_GEAR[A.side][0] && I[E.HON_GEAR[A.side][0]].set].name)} » : une pièce par rang de 6 à 10, liées au compte (ni HdV ni échange). Les 5 portées par un héros : +10 % d'honneur. Dépenser de l'honneur ne fait jamais baisser ton rang.</span></div></section>`;
  }
  function agrHtml(s) {
    const A = s.align; const L = E.agrTargets(s); const last = A.ag.last; const left = E.ALIGN_HON.agrDay - A.ag.n; const done = A.ag.dd === A.ag.d ? A.ag.done || [] : [];
    const rows = L.map((T) => { const foe = E.ALIGN[T.side]; return `<div class="alh-ag"><div class="alh-agn"><b>${h(T.name)}</b><span class="xs muted">${foe.name} · rang ${T.rank} · niveau ${T.lvl}</span></div>
      <span class="tag ${T.diff === "Facile" ? "good" : T.diff === "Difficile" ? "warn" : ""}">${T.diff}</span><span class="small">+${T.hon} honneur</span>
      ${done.includes(T.i) ? `<span class="tag soft">combattu</span>` : `<button class="btn sm primary" data-act="al-agr" data-v="${T.i}" ${left > 0 && !A.pend ? "" : "disabled"}>Attaquer</button>`}</div>`; }).join("");
    const res = last && last.at > E.now() - 6 * 3600000 ? `<div class="alh-res ${last.win ? "w" : "l"}"><img src="assets/ui/trophee.webp" alt=""><span class="grow"><b>${last.win ? "Victoire" : "Défaite"} contre ${h(last.name)}</b> · ${last.hon > 0 ? "+" : ""}${fmt(last.hon)} honneur${last.win ? ` · +${fmt(last.war)} points pour ${h(E.ALIGN_REG[last.reg] || "")}` : ""}</span></div>` : "";
    return `<section class="panel"><div class="phead"><h2>Agressions</h2><span class="small">${left} / ${E.ALIGN_HON.agrDay} aujourd'hui</span></div><div class="pad stack" style="gap:8px">
      <span class="xs muted">Des équipes fantômes du camp adverse, comme au Kolizéum, contre ton équipe d'arène. Gagner rapporte de l'honneur et des points à ton front (${h(E.ALIGN_REG[A.front])}).</span>
      <div class="alh-ags">${rows}</div>${res}</div></section>`;
  }
  const LADDER = [[1, 5, "Les ailes poussent", "Ailes de ta cité, qui grandissent tous les 4 rangs (dans le chat aussi), et un talent d'ordre par rang."],
    [6, 10, "L'arsenal de la cité", "Un équipement de rang par rang : coiffe, cape, anneau, amulette, bottes, payés en honneur."],
    [11, 15, "Les vétérans", "Bonus de camp et d'ordre au complet dès le rang 10, nouvelles ailes au rang 13."],
    [16, 19, "Les rangs rares", "Titres « Commandeur » (16) et « Grand Maître » (18), ailes dorées."],
    [20, 20, "Héros de la cité", "Titre « Héros de Bonta » ou « Héros de Brâkmar », ailes de héros."]];
  function ladderHtml(s) {
    const r = s.align ? E.alignRankIdx(s) : 0;
    return `<section class="panel"><div class="phead"><h2>Les 20 rangs</h2></div><div class="pad alh-lad">${LADDER.map(([a, b, n, d]) => `<div class="alh-step${b <= r ? " done" : a <= r ? " cur" : ""}"><span class="alh-rr">${a === b ? a : `${a}-${b}`}</span><div class="grow"><b>${n}</b><div class="xs">${d}</div></div></div>`).join("")}
      <span class="xs muted">Honneur pour passer un rang : ${fmt(E.honStep(1))} au rang 1, puis +15 % par rang (${fmt(E.honCum(20))} pour le rang 20).</span></div></section>`;
  }
  function stepRow(s, C, ci, i, state) {
    const st = C.steps[i]; const cur = state === "cur"; const r = E.alStepRew(ci);
    let prog = "", go = "";
    if (cur) {
      const [a, b] = E.alProgress(s);
      if (st.t === "kill" || st.t === "mis" || st.t === "res") prog = ` · ${fmt(a)} / ${fmt(b)}`;
      if (st.t === "rank") prog = ` · rang ${E.alignRankIdx(s)} / ${st.r}`;
      if (st.t === "kill") go = `<button class="btn sm primary" data-act="zoneview" data-id="${st.sub}" data-gotab="world">Y aller</button>`;
      if (st.t === "boss") go = `<button class="btn sm primary" data-act="dgopen" data-id="${st.dg}">Y aller</button>`;
      if (st.t === "res") go = `<button class="btn sm ${a >= b ? "primary" : ""}" data-act="al-give" ${a >= b && E.alOpen(s) ? "" : "disabled"}>Remettre</button>`;
    }
    return `<div class="${state}"><span class="k">${state === "ok" ? "✓" : i + 1}</span><span><b>${h(st.name)}</b><br><span class="xs muted">${h(st.txt)}${prog}${state === "ok" ? "" : ` · +${fmt(r.kamas)} kamas, +${r.ins} insignes`}</span></span>${go}</div>`;
  }
  function questsHtml(s) {
    const A = s.align; const Q = A.q; const L = E.ALIGN_CH[A.side]; const ui = UI();
    const all = Q.c >= L.length; let ci = ui.alCh === undefined || ui.alCh === null ? Math.min(Q.c, L.length - 1) : Math.max(0, Math.min(L.length - 1, ui.alCh));
    const C = L[ci]; const lvl = E.ALIGN_CH_LVL[ci]; const open = top(s) >= lvl;
    const pills = `<div class="al-chs">${L.map((x, j) => `<button data-act="al-ch" data-v="${j}" aria-pressed="${j === ci}" class="${j < Q.c ? "ok" : j === Q.c ? "cur" : ""}" title="${h(x.name)}">${j < Q.c ? "✓" : j + 1}</button>`).join("")}</div>`;
    const state = (i) => (ci < Q.c ? "ok" : ci > Q.c ? "todo" : i < Q.i ? "ok" : i === Q.i && open ? "cur" : "todo");
    const R = E.alChapRew(ci); const chest = window.DATA.CONSUMABLES[R.chest];
    const head = `<div class="row between small"><span><b>Chapitre ${ci + 1} : ${h(C.name)}</b> <span class="xs muted">· ${h(C.where)} · niveau ${lvl}</span></span>${ci < Q.c ? `<span class="tag good">terminé</span>` : !open ? `<span class="tag soft">${X().G("lock")} niveau ${lvl}</span>` : ""}</div>`;
    const rew = `<span class="xs muted">Fin du chapitre : ${fmt(R.kamas)} kamas, ${R.ins} insignes${chest ? `, ${h(chest.name)}` : ""}${ci === L.length - 1 ? `, titre « ${h(E.alHeroTitle(A.side))} »` : ""}.</span>`;
    const lock = ci === Q.c && !open ? `<span class="xs muted">Ce chapitre s'ouvre quand un de tes héros atteint le niveau ${lvl} (ton meilleur héros est niveau ${top(s)}).</span>` : "";
    return `<section class="panel"><div class="phead"><h2>Quêtes de ${E.ALIGN[A.side].name}</h2><span class="xs muted">${all ? "les 5 chapitres sont finis" : `chapitre ${Q.c + 1} sur ${L.length}`}</span></div><div class="pad stack" style="gap:8px">
      ${pills}${head}<div class="al-ql">${C.steps.map((x, i) => stepRow(s, C, ci, i, state(i))).join("")}</div>${lock}${rew}
      ${all ? `<span class="small plus">Titre « ${h(E.alHeroTitle(A.side))} » obtenu : ta cité te doit beaucoup.</span>` : ""}</div></section>`;
  }
  function whoHtml(s) {
    const L = CAMP.list; const o = ONL();
    const rows = (L || []).slice(0, 8).map((x) => `<div class="li small">${X().cmed(x.main, x.main_lvl)}<span class="al-wing ${short[x.side] || ""}">${h((E.ALIGN[x.side] || {}).name || "")}</span><b class="grow al-nm">${h(x.pseudo || "?")}${o && o.user && x.user_id === o.user.id ? ` <span class="xs muted">(toi)</span>` : ""}</b><span class="xs muted">${h(E.honRankName(x.side, x.ord, x.rank || 0))} · rang ${fmt(x.rank || 0)}</span></div>`).join("");
    const body = !online() ? `<div class="pad small muted">Hors ligne : connecte-toi à ton compte pour voir le camp des autres joueurs.</div>`
      : L === null ? `<div class="pad small muted">Chargement…</div>` : rows ? `<div class="list">${rows}</div>` : `<div class="pad small muted">Personne n'a encore choisi son camp sur le serveur.</div>`;
    return `<section class="panel"><div class="phead"><h2>Qui est de quel camp</h2>${L && L.length ? `<span class="xs muted">${fmt(L.length)} joueur${L.length > 1 ? "s" : ""}</span>` : ""}</div>${body}<div class="pad xs muted">Le camp s'affiche aussi dans le chat, les profils et les classements.</div></section>`;
  }
  function rankHtml(s) {
    const A = s.align; const side = E.ALIGN[A.side]; const O = side.orders[A.order]; const r = E.alignRankIdx(s); const q = s.alignQuest; const ui = UI();
    const other = A.side === "bonta" ? "brakmar" : "bonta";
    const sw = A.pend ? `<div class="al-pend"><span class="grow small">Tu as demandé à rejoindre <b>${E.ALIGN[A.pend.side].name}</b> : changement dans <b>${left(E.alSwitchLeft(s))}</b>, puis retour au rang 2 au plus et nouvelles quêtes.</span><button class="btn sm" data-act="al-cancel">Annuler</button></div>`
      : ui.confirm === "traitre" ? `<div class="al-pend"><span class="grow small">Rejoindre ${E.ALIGN[other].name} : 7 jours d'attente, puis ton honneur retombe au rang 2 au plus, ta bourse d'honneur est vidée et les quêtes de ${E.ALIGN[other].name} commencent au chapitre 1. Tu restes ${side.adj} pendant l'attente et tu peux annuler.</span>
          <button class="btn sm danger" data-act="align" data-side="${other}" data-order="coeur">Confirmer</button><button class="btn sm" data-act="al-nope">Garder ${side.name}</button></div>`
      : `<div class="row"><button class="btn sm" data-act="asktraitre">Changer de camp…</button></div>`;
    return `<section class="panel"><div class="phead"><div class="row"><img src="assets/i/${side.badge}.png" alt="" style="width:48px;height:48px;object-fit:contain"><div><h2>${side.adj} · ${h(O.name)}</h2><div class="small muted">Rang <b style="color:var(--gold2)">${r} / 20</b> · « ${h(E.alignRankName(s))} »</div></div></div></div>
    <div class="pad stack" style="gap:10px">
      <div class="small">Bonus actuels : <b class="plus">+${fmt(2 * Math.min(5, r / 2))} % ${side.bonusName}</b> (camp) · <b class="plus">+${fmt(E.ORDER_BONUS[A.order].per * Math.min(5, r / 2))} % ${h(E.ORDER_BONUS[A.order].txt.replace(/^\+\d+ % (de |d')?/, "").replace(" par rang", ""))}</b> (ordre, complet au rang 10)</div>
      ${q ? `<div class="qcard cur"><span class="qnum">${IC("combat")}</span><div class="grow"><b>${h(q.title)}</b><div class="small muted">${h(q.txt)}</div><div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(q.prog, q.n)}%"></i></div><span class="num small">${q.prog}/${q.n}</span></div><div class="xs muted">Mission d'alignement : ${fmt(Math.max(1, Math.round(q.axp / 10)))} honneur, ${fmt(q.kamas)} kamas, +${E.ALIGN_WAR.mis} points de guerre</div></div>${X().pinBtn({ k: "align" })}${q.sub ? `<button class="btn sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>` : ""}
      <div class="row small"><span class="muted">Changer d'ordre :</span>${Object.entries(side.orders).filter(([oid]) => oid !== A.order).map(([oid, O2]) => `<button class="btn sm" data-act="align" data-side="${A.side}" data-order="${oid}">${h(O2.name)}</button>`).join("")}
        <span class="xs muted">Insignes : <b>${fmt(s.tokens.insignes || 0)}</b></span><button class="btn sm" data-act="qj-shop" data-v="cite">${X().emo(E.SHOPS.cite.icon)} ${h(E.SHOPS.cite.name)}</button></div>
      ${sw}
    </div></section>`;
  }
  const NOTE = `Bonta, la cité blanche, ou Brâkmar, la cité sombre. Agressions, missions, quêtes et régions défendues rapportent de l'honneur : 20 rangs, des talents d'ordre et l'Arsenal de ta cité. Les quêtes de ta cité racontent 5 chapitres, du niveau 30 au niveau 180, et finissent par un titre. Les deux camps se disputent les régions de la carte. Un seul camp par compte, pour tous tes héros. Changer de camp : 7 jours d'attente et retour au rang 2.`;
  let orig = null;
  function alignHtml() {
    const s = S(); if (!s) return "";
    syncSide(); warLoad(false); campLoad(false);
    const foot = `<div class="note xs">Un seul camp par compte, pour tous tes héros. Changer de camp : 7 jours d'attente et retour au rang 2.</div>`;
    if (!s.align) return `<p class="note">${NOTE}</p><div class="stack" id="alPage"><div id="alCities">${citiesHtml(s)}</div>${orig ? orig() : ""}<div id="alWar">${warHtml(s)}</div><div id="alWho">${whoHtml(s)}</div>${foot}</div>`;
    E.alInit(s); E.honInit(s);
    return `<p class="note">${NOTE}</p><div class="stack" id="alPage">${honHead(s)}<div id="alCities">${citiesHtml(s)}</div><div id="alWar">${warHtml(s)}</div>
      <div class="grid2g even">${agrHtml(s)}${shopHtml(s)}</div>${talHtml(s)}
      <div class="grid2g even">${questsHtml(s)}<div id="alWho">${whoHtml(s)}</div></div>${rankHtml(s)}${ladderHtml(s)}${foot}</div>`;
  }

  /* ---------- actions (data-act="al-…", routées par js/ui.js) ---------- */
  function act(a, t) {
    const s = S(); if (!s) return; const d = t.dataset; const ui = UI();
    switch (a) {
      case "al-give": { const r = E.act(s, "alGive"); if (r) { X().toast(r); return; } X().toast("Ressources remises à la Milice."); break; }
      case "al-cancel": { const r = E.act(s, "alignCancel"); if (r) { X().toast(r); return; } ui.confirm = null; break; }
      case "al-nope": ui.confirm = null; break;
      case "al-ch": ui.alCh = +d.v; break;
      case "al-reg": ui.alReg = d.v; break;
      case "al-front": { const r = E.act(s, "alignSetFront", d.v); if (r) { X().toast(r); return; } X().toast(`Ton front : ${E.ALIGN_REG[d.v]}.`); break; }
      case "al-buy": { const r = E.act(s, "honBuy", d.v); if (r) { X().toast(r); return; } X().toast("Équipement de rang obtenu : il est dans ton sac."); break; }
      case "al-agr": { const r = E.agrFight(s, +d.v); if (r.err) { X().toast(r.err); return; } X().toast(r.win ? `Victoire : +${r.hon} honneur.` : `Défaite : ${r.hon} honneur.`); break; }
      default: return;
    }
    X().markDirty(); X().render();
  }

  /* ---------- branchement ---------- */
  orig = X().alignHtml || null;
  const keep = orig;
  orig = keep ? () => { const html = keep(); return html.replace(/<p class="note">[\s\S]*?<\/p>/, ""); } : null;
  window.DX.social.alignHtml = alignHtml;
  if (ONL() && ONL().onChange) ONL().onChange((st) => { if (st === "ok") setTimeout(() => { syncSide(); warLoad(false); campLoad(false); }, 1800); });
  setInterval(() => { const s = S(); if (s) { syncSide(); if (s.align && online()) warLoad(false); } }, 60000);
  /* Panel Xener › Test › Essayer une nouveauté : voir le bonus de région sans attendre le serveur */
  if (window.PANEL && window.PANEL.register) window.PANEL.register({ toggle: { id: "alreg", n: `Régions : ton camp tient toute la carte (+${E.ALIGN_REG_BONUS} % d'XP et de butin)`, ok: () => !!(S() && S().align), on: () => !!E.alignRegState().side && Object.keys(E.alignRegState().held).length > 0,
    set: (v) => { const s = S(); if (v && s && s.align) { const held = {}; Object.keys(E.ALIGN_REG).forEach((k) => (held[k] = s.align.side)); E.alignRegSet({ held, side: s.align.side }); } else E.alignRegSet({ held: {}, side: null }); } } });
  window.ALIGNUI = { tag, wings, sideOf, act, warLoad, campLoad, WARS, CAMP, html: alignHtml, isoWeek };
})();
