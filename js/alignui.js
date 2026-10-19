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
   par des délais (guerre : 1 min, camps : 10 min).
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
  const rankOf = (side, ord, lvl) => { const i = Math.min(5, Math.floor((lvl || 0) / 20)); const A = E.ALIGN[side]; const O = A && (A.orders[ord] || A.orders.coeur); return i && O ? O.ranks[i - 1] : "Néophyte"; };
  const left = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const j = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60); return j ? `${j} j ${hh} h` : hh ? `${hh} h ${m % 60} min` : `${m % 60} min`; };
  /* numéro de semaine du calendrier (lundi) et fin de la semaine de jeu (lundi 0 h UTC, comme E.weekIdx) */
  const isoWeek = (t) => { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round((d - y0) / 864e5 / 7 - ((y0.getUTCDay() + 6) % 7 - 3) / 7); };
  const weekEnd = (w) => ((w + 1) * 7 - 3) * 86400000;

  /* ---------- données du serveur ---------- */
  const WARS = { w: -1, data: null, at: 0, busy: false, err: false };
  const CAMP = { u: {}, p: {}, r: {}, list: null, at: 0, busy: false };
  function syncSide() { const s = S(); E.alignWarSet({ side: s && s.align ? s.align.side : null }); }
  async function warLoad(force) {
    const o = ONL(); if (!online() || !o.rpc || WARS.busy) return;
    const w = E.weekIdx(); if (!force && WARS.w === w && Date.now() - WARS.at < 60000) return;
    WARS.busy = true; WARS.at = Date.now();
    try {
      const r = await o.rpc("align_war_state", { p_w: w });
      if (r && !r.err && r.data && typeof r.data === "object") { WARS.data = r.data; WARS.w = w; WARS.err = false; const pv = r.data.prev || {}; E.alignWarSet({ w, win: linked() ? pv.win || null : null }); syncSide(); } // le bonus va au camp du compte (pas aux parties solo ni sans compte)
      else WARS.err = true;
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
        r.data.forEach((x) => { if (!SIDES.includes(x.side)) return; CAMP.u[x.user_id] = x.side; CAMP.r[x.user_id] = Math.min(5, Math.floor((+x.lvl || 0) / 20)); if (x.pseudo) CAMP.p[String(x.pseudo).toLowerCase()] = x.side; });
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
    return `<span class="chw ${short[side]} r${r}${fly}" data-tip="${E.ALIGN[side].adj} · rang ${r}">${w.replace('class="orn wing"', 'class="chw-w l"')}${inner}${w.replace('class="orn wing"', 'class="chw-w r"').replace(/(<svg[^>]*>)([\s\S]*)<\/svg>/, '$1<g transform="translate(64 0) scale(-1 1)">$2</g></svg>')}</span>`;
  }

  /* ---------- morceaux de page ---------- */
  function citiesHtml(s) {
    const A = s.align; const D = WARS.data; const r = A ? E.alignRankIdx(s) : 0;
    const city = (side) => {
      const C = E.ALIGN[side]; const mine = A && A.side === side; const pend = A && A.pend && A.pend.side === side;
      const n = D ? (side === "bonta" ? D.cb : D.ck) : null;
      const bonus = side === "bonta" ? `+2 % de PV par rang` : `+2 % de dommages par rang`;
      const sub = mine ? `${h(C.orders[A.order].name)} · rang ${r} <span class="al-nw">« ${h(E.alignRankName(s))} »</span>` : side === "bonta" ? "la cité blanche" : "la cité sombre";
      return `<div class="al-city ${short[side]}${mine ? " on" : ""}"><img class="al-bd" src="assets/i/${C.badge}.png" alt=""><h3>${C.name}${mine ? ` <span class="tag good">ton camp</span>` : ""}${pend ? ` <span class="tag warn">dans ${left(E.alSwitchLeft(s))}</span>` : ""}</h3>
        <span class="small">${sub}</span>${n === null || n === undefined ? `<span class="xs muted">${online() ? "joueurs : chargement…" : "joueurs : en ligne seulement"}</span>` : `<span class="big num">${fmt(n)} <small>joueur${n > 1 ? "s" : ""}</small></span>`}
        <span class="xs muted">${mine && r ? `+${2 * r} % de ${side === "bonta" ? "PV" : "dommages"} pour tes héros` : bonus}</span></div>`;
    };
    return `<div class="al-cities">${SIDES.map(city).join("")}</div>`;
  }
  function warHtml(s) {
    const w = E.weekIdx(); const D = WARS.data && WARS.w === w ? WARS.data : null; const A = s.align;
    const b = D ? +D.b || 0 : 0, k = D ? +D.k || 0 : 0; const pb = b + k > 0 ? Math.round((b / (b + k)) * 100) : 50;
    const my = A ? E.alWarPts(s) : 0; const pv = D && D.prev; const won = E.alignWarOn();
    const prev = pv && pv.win ? `<div class="al-prev small">${IC("trophee")}<span class="grow">Semaine dernière : victoire de <b>${E.ALIGN[pv.win].name}</b> (${fmt(pv.win === "bonta" ? pv.b : pv.k)} points contre ${fmt(pv.win === "bonta" ? pv.k : pv.b)}).</span>${won ? `<span class="tag good">+${E.ALIGN_WAR_BONUS} % d'XP et de butin pour toi</span>` : ""}</div>`
      : pv ? `<div class="al-prev small muted">Semaine dernière : pas de gagnant.</div>` : "";
    const bar = D ? `<div class="al-war"><i class="b" style="width:${pb}%"></i><i class="k" style="width:${100 - pb}%"></i><b><span>Bonta ${pb} %</span><span>Brâkmar ${100 - pb} %</span></b></div>
        <div class="row between xs muted"><span>${fmt(b)} points · ${fmt(D.nb || 0)} joueur${D.nb > 1 ? "s" : ""}</span><span>${fmt(D.nk || 0)} joueur${D.nk > 1 ? "s" : ""} · ${fmt(k)} points</span></div>`
      : `<div class="al-war off"><b><span>${online() ? (WARS.err ? "Serveur injoignable : réessaie plus tard." : "Chargement de la guerre…") : "La guerre se joue en ligne, avec un compte."}</span></b></div>`;
    const mine = A ? `<div class="row small al-mine"><span class="grow">Tes points cette semaine : <b class="num">${fmt(my)}</b> / ${fmt(E.ALIGN_WAR.cap)}${A.pend ? ` <span class="xs muted">(en pause pendant ton changement de camp)</span>` : ""}</span>
        <span class="xs muted">mission +${E.ALIGN_WAR.mis} · étape de quête +${E.ALIGN_WAR.step} · chapitre +${E.ALIGN_WAR.chap} · donjon +${E.ALIGN_WAR.dg} · avis +${E.ALIGN_WAR.bounty}</span></div>${linked() ? "" : `<span class="xs muted">${online() ? "Connecte-toi à ton compte pour que tes points comptent pour ton camp." : "Hors ligne : tes points sont gardés dans ta partie."}</span>`}` : "";
    return `<section class="panel"><div class="phead"><h2>${IC("combat")} Guerre des cités · semaine ${isoWeek(E.now())}</h2><span class="xs muted al-nw">finit dans ${left(weekEnd(w) - E.now())}</span></div><div class="pad stack">
      ${bar}<span class="small">Chaque mission, quête et victoire de donjon de ton camp compte. Le camp gagnant a <b>+${E.ALIGN_WAR_BONUS} % d'XP et de butin</b> toute la semaine suivante.</span>${mine}${prev}</div></section>`;
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
    const rows = (L || []).slice(0, 8).map((x) => `<div class="li small">${X().cmed(x.main, x.main_lvl)}<span class="al-wing ${short[x.side] || ""}">${h((E.ALIGN[x.side] || {}).name || "")}</span><b class="grow al-nm">${h(x.pseudo || "?")}${o && o.user && x.user_id === o.user.id ? ` <span class="xs muted">(toi)</span>` : ""}</b><span class="xs muted">${h(rankOf(x.side, x.ord, x.lvl))} · niv. ${fmt(x.lvl)}</span></div>`).join("");
    const body = !online() ? `<div class="pad small muted">Hors ligne : connecte-toi à ton compte pour voir le camp des autres joueurs.</div>`
      : L === null ? `<div class="pad small muted">Chargement…</div>` : rows ? `<div class="list">${rows}</div>` : `<div class="pad small muted">Personne n'a encore choisi son camp sur le serveur.</div>`;
    return `<section class="panel"><div class="phead"><h2>Qui est de quel camp</h2>${L && L.length ? `<span class="xs muted">${fmt(L.length)} joueur${L.length > 1 ? "s" : ""}</span>` : ""}</div>${body}<div class="pad xs muted">Le camp s'affiche aussi dans le chat, les profils et les classements.</div></section>`;
  }
  function rankHtml(s) {
    const A = s.align; const side = E.ALIGN[A.side]; const O = side.orders[A.order]; const r = E.alignRankIdx(s); const q = s.alignQuest; const ui = UI();
    const other = A.side === "bonta" ? "brakmar" : "bonta";
    const sw = A.pend ? `<div class="al-pend"><span class="grow small">Tu as demandé à rejoindre <b>${E.ALIGN[A.pend.side].name}</b> : changement dans <b>${left(E.alSwitchLeft(s))}</b>, puis retour au rang 1 et nouvelles quêtes.</span><button class="btn sm" data-act="al-cancel">Annuler</button></div>`
      : ui.confirm === "traitre" ? `<div class="al-pend"><span class="grow small">Rejoindre ${E.ALIGN[other].name} : 7 jours d'attente, puis ton niveau d'alignement retombe au rang 1 et les quêtes de ${E.ALIGN[other].name} commencent au chapitre 1. Tu restes ${side.adj} pendant l'attente et tu peux annuler.</span>
          <button class="btn sm danger" data-act="align" data-side="${other}" data-order="coeur">Confirmer</button><button class="btn sm" data-act="al-nope">Garder ${side.name}</button></div>`
      : `<div class="row"><button class="btn sm" data-act="asktraitre">Changer de camp…</button></div>`;
    return `<section class="panel"><div class="phead"><div class="row"><img src="assets/i/${side.badge}.png" alt="" style="width:48px;height:48px;object-fit:contain"><div><h2>${side.adj} · ${h(O.name)}</h2><div class="small muted">Rang : <b style="color:var(--gold2)">${h(E.alignRankName(s))}</b> · niveau d'alignement ${A.lvl}/100</div></div></div></div>
    <div class="pad stack" style="gap:10px">
      <div>${A.lvl < 100 ? `<div class="row between xs muted"><span>vers le niveau ${A.lvl + 1}</span><span class="num">${fmt(A.xp)} / ${fmt(E.alignNeed(A.lvl))}</span></div><div class="bar"><i style="width:${pct(A.xp, E.alignNeed(A.lvl))}%"></i></div>` : `<span class="tag good">Niveau maximum</span>`}</div>
      <div class="row small al-rks">${O.ranks.map((n, i) => `<span class="tag ${i < r ? "good" : "soft"}">${i + 1}. ${h(n)} (${(i + 1) * 20})</span>`).join("")}</div>
      <div class="small">Bonus actuels : <b class="plus">+${2 * r} % ${side.bonusName}</b> (camp) · <b class="plus">${h(E.ORDER_BONUS[A.order].txt.replace("par rang", ""))}× ${r}</b> (ordre)</div>
      ${q ? `<div class="qcard cur"><span class="qnum">${IC("combat")}</span><div class="grow"><b>${h(q.title)}</b><div class="small muted">${h(q.txt)}</div><div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(q.prog, q.n)}%"></i></div><span class="num small">${q.prog}/${q.n}</span></div><div class="xs muted">Mission d'alignement : ${fmt(q.axp)} points d'alignement, ${fmt(q.kamas)} kamas, +${E.ALIGN_WAR.mis} points de guerre</div></div>${X().pinBtn({ k: "align" })}${q.sub ? `<button class="btn sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>` : ""}
      <div class="row small"><span class="muted">Changer d'ordre :</span>${Object.entries(side.orders).filter(([oid]) => oid !== A.order).map(([oid, O2]) => `<button class="btn sm" data-act="align" data-side="${A.side}" data-order="${oid}">${h(O2.name)}</button>`).join("")}
        <span class="xs muted">Insignes : <b>${fmt(s.tokens.insignes || 0)}</b></span><button class="btn sm" data-act="qj-shop" data-v="cite">${X().emo(E.SHOPS.cite.icon)} ${h(E.SHOPS.cite.name)}</button></div>
      ${sw}
    </div></section>`;
  }
  const NOTE = `Bonta, la cité blanche, ou Brâkmar, la cité sombre. Missions, avis de recherche et boss de donjon font monter ton rang : tes ailes grandissent et tes bonus augmentent. Les quêtes de ta cité racontent 5 chapitres, du niveau 30 au niveau 180, et finissent par un titre. Chaque semaine, la guerre des cités additionne les points des deux camps. Un seul camp par compte, pour tous tes héros. Changer de camp : 7 jours d'attente et retour au rang 1.`;
  let orig = null;
  function alignHtml() {
    const s = S(); if (!s) return "";
    syncSide(); warLoad(false); campLoad(false);
    const foot = `<div class="note xs">Un seul camp par compte, pour tous tes héros. Changer de camp : 7 jours d'attente et retour au rang 1.</div>`;
    if (!s.align) return `<p class="note">${NOTE}</p><div class="stack" id="alPage"><div id="alCities">${citiesHtml(s)}</div>${orig ? orig() : ""}<div id="alWar">${warHtml(s)}</div><div id="alWho">${whoHtml(s)}</div>${foot}</div>`;
    E.alInit(s);
    return `<p class="note">${NOTE}</p><div class="stack" id="alPage"><div id="alCities">${citiesHtml(s)}</div><div id="alWar">${warHtml(s)}</div>
      <div class="grid2g even">${questsHtml(s)}<div id="alWho">${whoHtml(s)}</div></div>${rankHtml(s)}${foot}</div>`;
  }

  /* ---------- actions (data-act="al-…", routées par js/ui.js) ---------- */
  function act(a, t) {
    const s = S(); if (!s) return; const d = t.dataset; const ui = UI();
    switch (a) {
      case "al-give": { const r = E.act(s, "alGive"); if (r) { X().toast(r); return; } X().toast("Ressources remises à la Milice."); break; }
      case "al-cancel": { const r = E.act(s, "alignCancel"); if (r) { X().toast(r); return; } ui.confirm = null; break; }
      case "al-nope": ui.confirm = null; break;
      case "al-ch": ui.alCh = +d.v; break;
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
  setInterval(() => { const s = S(); if (s) { syncSide(); if (s.align && E.weekIdx() !== WARS.w && online()) warLoad(false); } }, 60000);
  /* Panel Xener › Test › Essayer une nouveauté : voir le bonus du camp gagnant sans attendre la fin de la semaine */
  if (window.PANEL && window.PANEL.register) window.PANEL.register({ toggle: { id: "alwar", n: `Guerre des cités : ton camp a gagné (+${E.ALIGN_WAR_BONUS} % d'XP et de butin)`, ok: () => !!(S() && S().align), on: () => E.alignWarOn(),
    set: (v) => { const s = S(); if (v && s && s.align) E.alignWarSet({ w: E.weekIdx(), win: s.align.side, side: s.align.side }); else E.alignWarSet({ win: null }); } } });
  window.ALIGNUI = { tag, wings, sideOf, act, warLoad, campLoad, WARS, CAMP, html: alignHtml, isoWeek };
})();
