/* ============================================================================
   HISTOIRE — interface de la quête principale en scènes (Classique · Saison 1). Moteur : js/histoire.js.
   Page Quêtes › Quête principale et carte du tableau du jour, quand la partie est la Saison 1 (questui.js passe la main).
   Une scène : le portrait du personnage, ses répliques en bulles, 2 à 4 objectifs qui avancent ensemble, la récompense.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const X = () => window.DX.social;
  const h = (s) => X().h(s), fmt = (n) => X().fmt(n), IC = (n) => X().IC(n);
  const Q = () => E.MAIN_QUEST, SC = () => E.HIST_SC, CH = () => E.QUEST_CHAPTERS;
  const st = { ch: null, open: {} };

  const initials = (n) => n.split(/[ ']/).filter((w) => w && w[0] === w[0].toUpperCase()).slice(0, 2).map((w) => w[0]).join("");
  function portrait(sc, cls) {
    const w = E.histWho(sc);
    if (w.img) return `<span class="hs-por ${cls || ""}"><img src="${w.img}" alt="${h(w.n)}" loading="lazy"></span>`;
    if (w.mon && D.MONSTERS[w.mon]) return `<span class="hs-por mon ${cls || ""}">${X().im(X().imgM(w.mon), "", w.n)}</span>`;
    return `<span class="hs-por ini ${cls || ""}"><b>${h(initials(w.n || sc.t))}</b></span>`;
  }
  const bossOf = (sc) => { const b = sc.g.map((i) => Q()[i]).find((q) => q.t === "boss" && D.DUNGEONS[q.dg]); return b ? D.DUNGEONS[b.dg].boss : null; };
  const kamasOf = (sc) => sc.g.reduce((a, i) => a + (E.questReward ? E.questReward(i).kamas : 0), 0);
  const boostOf = (sc) => E.HIST_BOOST + (sc.last ? E.HIST_BOOST_CH : 0);
  function rewLine(sc) {
    const ex = sc.g.map((i) => E.questExtraText(i)).filter(Boolean);
    return `<span class="qj-rew">${IC("coffre")} Récompenses : <b>${fmt(kamasOf(sc))} kamas, ${boostOf(sc)} boosters de cartes${ex.length ? `, ${h(ex.join(", "))}` : ""}</b>${sc.last ? ` <span class="xs muted">(fin de chapitre)</span>` : ""}</span>`;
  }
  function goals(s, sc, live) {
    return `<ol class="hs-goals">${sc.g.map((i) => { const q = Q()[i]; const [a, b] = E.histGoalProg(s, i); const ok = a >= b;
      return `<li class="${ok ? "ok" : ""}"><span class="hs-ck">${ok ? "✓" : ""}</span><div class="grow stack" style="gap:3px"><b>${h(q.title)}</b><span class="xs muted">${h(q.txt)}</span>
        ${live && !ok && b > 1 ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(a, b)}%"></i></div><span class="num xs">${fmt(a)}/${fmt(b)}</span></div>` : ""}</div>
        ${live && !ok ? X().questGoBtn(q, "") : ""}</li>`; }).join("")}</ol>`;
  }
  function sceneCard(s, sc) {
    const w = E.histWho(sc); const C = CH()[sc.ch]; const k = SC().filter((x) => x.ch === sc.ch); const j = k.indexOf(sc) + 1;
    const lines = sc.in.length ? sc.in.map((t) => `<p class="hs-bub">${h(t)}</p>`).join("") : `<p class="hs-bub muted">Le texte de cette scène arrive bientôt.</p>`;
    const bo = bossOf(sc);
    return `<section class="panel hs-card"><div class="pad stack" style="gap:12px">
      <div class="hs-top">${portrait(sc, "big")}<div class="grow stack" style="gap:2px"><span class="qj-eb">Chapitre ${sc.ch + 1} · scène ${j} sur ${k.length}</span><h3>${h(sc.t)}</h3>${w.n ? `<span class="xs muted">${h(w.n)}${w.r ? ` · ${h(w.r)}` : ""}</span>` : ""}</div>
        ${bo ? `<span class="hs-foe" data-tip="${h(D.MONSTERS[bo].name)}">${X().im(X().imgM(bo), "", D.MONSTERS[bo].name)}</span>` : ""}</div>
      <div class="hs-talk">${lines}</div>
      ${goals(s, sc, true)}
      ${rewLine(sc)}
      <span class="xs muted">Les objectifs avancent tous en même temps ; chacun paie sa part dès qu'il est fini.${C ? ` Fin du chapitre : titre « ${h(C.title)} ».` : ""}</span></div></section>`;
  }
  function pastRow(sc) {
    const w = E.histWho(sc); const open = !!st.open[sc.n];
    return `<details class="hs-past" data-n="${sc.n}" ${open ? "open" : ""}><summary>${portrait(sc, "sm")}<b class="grow">${h(sc.t)}</b><span class="xs muted">✓ ${sc.g.length} objectif${sc.g.length > 1 ? "s" : ""}</span></summary>
      <div class="hs-talk">${sc.in.map((t) => `<p class="hs-bub">${h(t)}</p>`).join("")}${sc.out ? `<p class="hs-bub end">${h(sc.out)}</p>` : ""}</div>${w.n ? `<span class="xs muted">${h(w.n)}</span>` : ""}</details>`;
  }
  function mainHtml(s, head) {
    const T = E.hist(s); const all = SC(); const cur = E.histScene(s); const curCh = cur ? cur.ch : CH().length - 1;
    if (st.ch === null || !CH()[st.ch]) st.ch = curCh;
    const k = st.ch; const C = CH()[k]; const list = all.filter((x) => x.ch === k);
    const chaps = `<div class="qx-chaps">${CH().map((c, i) => { const L = all.filter((x) => x.ch === i); const d = L.filter((x) => x.n < T.sc).length; const cls = d >= L.length ? "got" : i === curCh ? "cur" : !cur || L[0].n > T.sc ? "lock" : "";
      return `<button class="qx-chap ${cls}" data-act="qj-hsch" data-v="${i}" aria-pressed="${i === k}"><span class="qj-eb">Chapitre ${i + 1}${d >= L.length ? " ✓" : ""}</span><b>${h(c.name)}</b><small>niv. ${c.lvl[0]}–${c.lvl[1]} · ${L.length} scènes</small><span class="qx-cb"><i style="width:${X().pct(d, L.length)}%"></i></span></button>`; }).join("")}</div>`;
    const past = list.filter((x) => x.n < T.sc); const next = list.filter((x) => x.n > T.sc);
    let body = "";
    if (cur && cur.ch === k) body = sceneCard(s, cur);
    else if (!past.length) body = `<div class="qj-step lock"><span class="n">${X().G("lock")}</span><div class="grow"><b>Chapitre ${k + 1} · ${h(C.name)}</b><div class="small muted">Il s'ouvre à la fin du chapitre ${k}. Régions : ${h(C.where)}.</div></div></div>`;
    else body = `<div class="qj-step cur"><span class="n">✓</span><div class="grow"><b>Chapitre terminé : titre « ${h(C.title)} »</b></div>${k + 1 < CH().length ? `<button class="btn sm" data-act="qj-hsch" data-v="${k + 1}">Chapitre ${k + 2} ›</button>` : ""}</div>`;
    const more = next.length - 1;
    const nx = next.length ? `<div class="stack" style="gap:6px"><span class="qj-lab">Ensuite</span><div class="hs-next">${portrait(next[0], "sm")}<b class="grow">${h(next[0].t)}</b><span class="xs muted">${next[0].g.length} objectif${next[0].g.length > 1 ? "s" : ""}</span></div>${more > 0 ? `<div class="hs-next lock"><span class="hs-por ini sm"><b>?</b></span><b class="grow">${more} scène${more > 1 ? "s" : ""} à découvrir</b></div>` : ""}</div>` : "";
    const pl = past.length ? `<div class="stack" style="gap:6px"><span class="qj-lab">Scènes jouées · relire</span>${past.slice().reverse().map(pastRow).join("")}</div>` : "";
    if (cur && E.histNew(s)) E.histSeen(s);
    return `${head}${chaps}<section class="panel"><div class="phead"><h2>Chapitre ${k + 1} · ${h(C.name)}</h2><span class="xs muted">${h(C.where)} · titre « ${h(C.title)} »</span></div><div class="pad stack">${body}${nx}${pl}</div></section>`;
  }
  // carte du tableau du jour : la scène en cours, sa première réplique et l'objectif mis en avant
  function heroHtml(s) {
    const sc = E.histScene(s);
    if (!sc) return `<div class="qj-hero"><div class="qj-chap">${IC("trophee")}</div><div class="qj-hb"><span class="qj-eb">Quête principale</span><h2>Terminée</h2><span class="small muted">Les quêtes de région, les Dofus et l'alignement attendent dans Aventures.</span></div><div class="qj-acts"><button class="btn sm" data-act="qtab" data-v="dofus">Les Dofus</button></div></div>`;
    const i = E.histFocus(s); const q = Q()[i]; const [a, b] = E.histGoalProg(s, i); const w = E.histWho(sc); const T = E.hist(s);
    return `<div class="qj-hero">${portrait(sc, "")}<div class="qj-hb"><span class="qj-eb">Quête principale · chapitre ${sc.ch + 1} · ${h(sc.t)}${E.histNew(s) ? ` <span class="qj-tag todo">nouvelle scène</span>` : ""}</span>
      ${sc.in[0] ? `<span class="small hs-quote">${w.n ? `<b>${h(w.n)} :</b> ` : ""}« ${h(sc.in[0])} »</span>` : ""}
      <h2>${h(q.title)}</h2><span class="small muted">${h(q.txt)} · objectif ${T.d.length + 1} sur ${sc.g.length}</span>
      ${b > 1 ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(a, b)}%"></i></div><span class="num small">${fmt(a)}/${fmt(b)}</span></div>` : ""}</div>
      <div class="qj-acts">${X().questGoBtn(q, "primary")}<button class="btn sm" data-act="qtab" data-v="main">Toute la scène</button></div></div>`;
  }
  /* ---------- campagne de saison (3A) ---------- */
  const cst = { cnt: null, at: 0, busy: false };
  async function campSync(force) {
    const s = window.DX && window.DX.S; const ON = window.ONLINE;
    if (!s || !E.histOn(s) || !ON || !ON.campCount || cst.busy || (!force && Date.now() - cst.at < 300000)) return;
    cst.busy = true; cst.at = Date.now();
    try {
      const T = E.camp(s);
      for (const f of T.fin) if (!f.sent && f.w === f.i + 1) { const n = await ON.campDone(f.i + 1); if (n != null) f.sent = 1; }
      const c = await ON.campCount(); if (c) { cst.cnt = c; let got = false; E.CAMP.forEach((_, i) => { if (E.campBonus(s, i, +c[i + 1] || 0)) got = true; }); if (got && X().markDirty) X().markDirty(); }
    } catch (e) {} finally { cst.busy = false; }
  }
  setInterval(() => campSync(false), 60000);
  function campHtml(s, head) {
    campSync(false);
    const T = E.camp(s); const wk = E.campWeek(s); const cur = E.campCur(s);
    const manche = (i) => (E.S1C ? E.S1C.manches[Math.floor(i / 2)] : "");
    const who = { npc: "xelorium" };
    const rows = E.CAMP.map((C, i) => {
      const done = i < T.c, open = E.campOpen(s, i), isCur = i === cur; const n = cst.cnt ? +cst.cnt[i + 1] || 0 : null;
      const srv = `<span class="hs-srv ${n != null && n >= E.CAMP_GOAL ? "ok" : ""}">${IC("monde")} Objectif du serveur : ${n == null ? `<b class="num">${E.CAMP_GOAL}</b> aventuriers finissent ce chapitre pendant sa semaine` : `<b class="num">${fmt(Math.min(n, 9999))}/${E.CAMP_GOAL}</b> aventuriers ont fini ce chapitre pendant sa semaine`}${T.bon.includes(i) ? " · Coffre en or reçu ✓" : ""}</span>`;
      if (!open && !done) return `<div class="hs-next lock"><span class="hs-por ini sm"><b>${i + 1}</b></span><b class="grow">Chapitre ${i + 1} · ${i === wk ? h(C.t) : "???"}</b><span class="xs muted">semaine ${i + 1}${E.S1C ? ` · ${h(manche(i))}` : ""}</span></div>`;
      if (done) return `<details class="hs-past"><summary>${portrait(who, "sm")}<b class="grow">Chapitre ${i + 1} · ${h(C.t)}</b><span class="xs muted">✓ fini</span></summary><div class="hs-talk">${C.in.map((l) => `<p class="hs-bub">${h(l)}</p>`).join("")}<p class="hs-bub end">${h(C.out)}</p></div>${srv}</details>`;
      const goals = Object.keys(C.g).map((k) => { const [a, b] = E.campProg(s, i, k); const ok = a >= b;
        return `<li class="${ok ? "ok" : ""}"><span class="hs-ck">${ok ? "✓" : ""}</span><div class="grow stack" style="gap:3px"><b>${h(E.CAMP_K[k])}</b>${!ok ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(a, b)}%"></i></div><span class="num xs">${fmt(a)}/${fmt(b)}</span></div>` : ""}</div></li>`; }).join("");
      return `<section class="panel hs-card"><div class="pad stack" style="gap:12px">
        <div class="hs-top">${portrait(who, "big")}<div class="grow stack" style="gap:2px"><span class="qj-eb">Campagne de saison · chapitre ${i + 1} sur ${E.CAMP.length}${E.S1C ? ` · ${h(manche(i))}` : ""}</span><h3>${h(C.t)}</h3><span class="xs muted">${h(E.HIST_NPC.xelorium.n)} · ${h(E.HIST_NPC.xelorium.r)}</span></div></div>
        <div class="hs-talk">${C.in.map((l) => `<p class="hs-bub">${h(l)}</p>`).join("")}</div>
        <ol class="hs-goals">${goals}</ol>
        <span class="qj-rew">${IC("coffre")} Récompenses : <b>${E.CAMP_BOOST} boosters de cartes, Coffre en argent${i === E.CAMP.length - 1 ? ", titre « Gardien du Temps »" : ""}</b></span>
        ${srv}${isCur && i + 1 < wk ? `<span class="xs muted">Tu as du retard : les chapitres se rattrapent dans l'ordre, mais l'objectif du serveur ne compte que pendant la semaine du chapitre.</span>` : ""}</div></section>`; });
    const head2 = head;
    return `${head2}<div class="stack" style="gap:10px"><span class="qj-lab">Semaine ${Math.min(wk, 8)} de la saison · ${fmt(Math.min(T.c, E.CAMP.length))}/${E.CAMP.length} chapitres finis</span>${rows.join("")}</div>`;
  }
  function act(a, t) {
    if (a === "qj-hsch") { st.ch = +t.dataset.v; X().render(); return true; }
    return false;
  }
  document.addEventListener("toggle", (e) => { const el = e.target; if (el.classList && el.classList.contains("hs-past")) st.open[el.dataset.n] = el.open; }, true);
  window.HUI = { mainHtml, heroHtml, campHtml, campSync, act, on: (s) => !!(E.histOn && E.histOn(s)) };
})();
