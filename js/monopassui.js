/* ============================================================================
   Monocompte — page « Pass de saison » (moteur : js/monopass.js), d'après la maquette validée le 18/10/2026.
   Défis › Pass de saison, seulement dans une partie Monocompte : en-tête du palier, piste des 50 paliers
   (Gratuit et Prestige), quêtes de saison du jour et de la semaine, hauts faits de saison par famille.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.MONO_PASS || !window.DX) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const BP = E.MONO.bp;

  /* image et nom court d'une récompense */
  const img = (d) => {
    if (d.x && d.x.length) { const [t, id] = d.x[0];
      if (t === "m") return "assets/ui/poussiere.webp";
      if (t === "pet") return `assets/p/${(E.PETS[id] || {}).icon}.webp`;
      if (t === "mt") { const [sp, c] = id.split("/"); return `assets/mt/${((E.MOUNTS[sp] || { cols: {} }).cols[c] || {}).icon}.webp`; }
      if (t === "wing") return "assets/ui/ailes.webp";
      if (t === "aura") return "assets/ui/teinture.webp";
      if (t === "tit") return "assets/ui/parchemin_or.webp";
      if (t === "dgh") return "assets/ui/cle.webp";
      return "assets/ui/couronne.webp"; }
    if (d.c && d.c.length) { const C = D.CONSUMABLES[d.c[0][0]] || {};
      if (C.kind === "chest") return `assets/ui/coffres/${C.img || "bois"}.svg`;
      if (d.c[0][0] === "fiole_temps") return "assets/ui/potions/26003.png";
      return "assets/ui/cristal.webp"; }
    return "assets/ui/kamas.webp";
  };
  const name = (d) => {
    const parts = [];
    if (d.k) parts.push(`${fmt(d.k)} kamas`);
    (d.c || []).forEach(([id, q]) => parts.push(`${q > 1 ? q + " × " : ""}${(D.CONSUMABLES[id] || { name: id }).name}`));
    (d.x || []).forEach((r) => { const T = E.GIFT_X[r[0]]; if (!T) return;
      parts.push(r[0] === "tit" ? `Titre « ${r[1]} »` : r[0] === "m" ? `${fmt(r[2])} Essence` : r[0] === "dgh" ? `${r[2]} h de donjon` : r[0] === "orn" ? E.ORN[r[1]].name({}) : r[0] === "fr" ? E.SFRAMES[r[1]].name({}) : T.txt(r[1], r[2] || 1)); });
    return parts.join(" + ");
  };
  const dur = (ms) => { const m = Math.floor(ms / 60000); const j = Math.floor(m / 1440); return j ? `${j} j ${Math.floor((m % 1440) / 60)} h` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };

  function cell(s, line, t) {
    const d = E.MONO_PASS[line][t]; const B = E.bpState(s); const big = t % 5 === 0;
    const st = B[line][t] ? "done" : E.bpCanClaim(s, line, t) ? "ready" : "lock";
    const why = st === "lock" ? (E.bpTier(s) < t ? `palier ${t}` : `${t} pts de Prestige`) : "";
    const act = st === "done" ? `<span class="bp-ok">✓</span>` : st === "ready" ? `<button class="bp-get" data-act="bp-claim" data-l="${line}" data-t="${t}">Récupérer</button>` : `<span class="bp-lk" title="${h(why)}">🔒</span>`;
    return `<div class="bp-c ${st}${big ? " big" : ""}${line === "pres" ? " bp-pres" : ""}" data-tip="${h(name(d))}"><img src="${img(d)}" alt="" loading="lazy"><span class="bp-n">${h(name(d))}</span>${act}</div>`;
  }
  function track(s) {
    const cur = E.bpTier(s); let cols = "";
    for (let t = 1; t <= BP.tiers; t++) cols += `<div class="bp-col${t === Math.min(BP.tiers, cur + 1) ? " cur" : ""}${t === BP.tiers ? " fin" : ""}" ${t === Math.min(BP.tiers, cur + 1) ? 'id="bpCur"' : ""}><div class="bp-t"><span>${t}</span></div>${cell(s, "free", t)}${cell(s, "pres", t)}</div>`;
    return `<div class="bp-wrap"><div class="bp-lbl"><div class="bp-t"></div><div class="bp-l">🎁<b>Gratuit</b></div><div class="bp-l bp-pres">✨<b>Prestige</b><span>hauts faits</span></div></div><div class="bp-track" id="bpTrack">${cols}</div></div>`;
  }
  function quests(s) {
    const Q = E.bpQuests(s); const L = E.MONO_QUESTS;
    const q = (x, pts) => { const d = L.day.concat(L.week).find((y) => y.id === x.id); if (!d) return ""; const ok = x.p >= d.need;
      return `<div class="bp-q${ok ? " done" : ""}"><div class="row between"><span>${h(d.n)}</span><b class="bp-pts">+${pts}</b></div><div class="bp-qb"><div style="width:${Math.round((x.p / d.need) * 100)}%"></div></div><span class="small muted">${fmt(x.p)} / ${fmt(d.need)}${ok ? " · fait ✓" : ""}</span></div>`; };
    return `<div class="panel"><div class="pad stack"><div class="bp-head"><h2 style="margin:0">Quêtes de saison</h2><span class="pill">jour : ${dur(E.bpLeft("day"))}</span></div>
      <b class="small muted">AUJOURD'HUI</b>${Q.day.map((x) => q(x, BP.day)).join("")}
      <b class="small muted">CETTE SEMAINE · ${dur(E.bpLeft("week"))}</b>${Q.week.map((x) => q(x, BP.week)).join("")}
      <span class="xs muted">Les mêmes quêtes pour tout le serveur. Elles changent à minuit (jour) et le lundi (semaine).</span></div></div>`;
  }
  const MED = ["·", "🥉", "🥈", "🥇"];
  function feats(s) {
    const B = E.bpState(s); const HF = E.MONO_HF; const got = HF.filter((H) => (B.hf[H.id] || 0) >= 1).length;
    const fams = Object.keys(E.MONO_FAM).map((f) => { const L = HF.filter((H) => H.fam === f); const n = L.filter((H) => (B.hf[H.id] || 0) >= 1).length; const F = E.MONO_FAM[f];
      return `<div class="bp-fam"><div class="bp-fi">${{ solo: "⚔", groupe: "👥", artisan: "⚒", camp: "🛡" }[f]}</div><b>${F.n}</b><div class="bp-qb"><div style="width:${Math.round((n / L.length) * 100)}%"></div></div><span class="small muted">${n} / ${L.length} hauts faits</span><span class="small">${B.fam && B.fam[f] ? "✓ " : ""}Famille complète : ${h(F.txt)}</span></div>`; }).join("");
    const row = (H) => { const m = B.hf[H.id] || 0; const v = E.hfValue(s, H); const hid = H.secret && !m;
      const thr = H.secret ? "" : H.m.map((x, i) => `${["bronze", "argent", "or"][i]} ${fmt(x)}`).join(" · ");
      const sub = hid ? "haut fait secret" : H.soon ? `${h(H.d)} · arrive avec le serveur Monocompte` : `${h(H.d)} : ${fmt(v)}${thr ? ` · <span class="bp-thr">${thr}</span>` : ""}`;
      return `<div class="bp-hf${H.soon ? " soon" : ""}"><span class="bp-md">${hid ? "❔" : MED[m]}</span><span class="grow"><b>${hid ? "???" : h(H.n)}</b><br><span class="small muted">${sub}</span></span><span class="bp-pp">${m ? "+" + m : hid ? "?" : ""}</span></div>`; };
    const fam = UI().bpFam || "solo"; const list = HF.filter((H) => (fam === "secret" ? H.secret : H.fam === fam));
    return `<div class="panel"><div class="pad stack"><div class="bp-head"><h2 style="margin:0">Hauts faits de saison</h2><span class="pill">${got} / ${HF.length}</span></div>
      <div class="bp-fams">${fams}</div>
      <nav class="subtabs">${[["solo", "Solo"], ["groupe", "Groupe"], ["artisan", "Artisan"], ["camp", "Camp"], ["secret", "Secrets"]].map(([k, n]) => `<button data-act="bp-fam" data-v="${k}" aria-pressed="${fam === k}">${n}</button>`).join("")}</nav>
      ${list.map(row).join("")}
      <span class="xs muted">Bronze, argent, or : 1 point de Prestige chacun. La récompense Prestige du palier n demande n points. La rareté (part des joueurs) s'affichera avec le serveur.</span></div></div>`;
  }
  function page(main) {
    const s = S(); if (!s || !s.mono) { UI().tab = "home"; X().render(); return; }
    const B = E.bpState(s); E.bpQuests(s); E.hfCheck(s);
    const t = E.bpTier(s), into = B.pts - t * BP.step, pp = E.bpPrestigePts(s);
    const man = E.monoManche ? Math.min(4, E.monoManche(s)) : 1; const left = Math.max(0, E.monoEnd(s) - (E.monoDate ? E.monoDate(s) : E.now()));
    const nextBig = [...Array(BP.tiers).keys()].map((i) => i + 1).find((x) => x > t && x % 5 === 0) || BP.tiers; const prize = E.MONO_PASS.free[nextBig];
    const ready = [...Array(BP.tiers).keys()].reduce((n, i) => n + (E.bpCanClaim(s, "free", i + 1) ? 1 : 0) + (E.bpCanClaim(s, "pres", i + 1) ? 1 : 0), 0);
    main.innerHTML = `<div class="pagehead"><h1>Pass de saison</h1></div>
      <div class="bp-hero"><div class="bp-lvl"><span>palier</span><b>${t}</b><span>/ ${BP.tiers}</span></div>
        <div class="bp-mid"><span class="bp-kick">${h(E.monoSeasonDef(s.mono.s).nom)} · manche ${man} / 4</span><h2>Pass de saison</h2>
          <div class="bp-xp"><div style="width:${t >= BP.tiers ? 100 : Math.round((into / BP.step) * 100)}%"></div></div>
          <div class="row between small" style="gap:8px;flex-wrap:wrap"><span>${t >= BP.tiers ? "<b>Pass terminé !</b>" : `<b>${fmt(into)} / ${fmt(BP.step)}</b> points vers le palier ${t + 1}`}</span><span class="muted">fin de saison dans ${dur(left)}</span></div>
          <div class="bp-tags"><span class="pill">Gratuit pour tous</span><span class="pill bp-pr">✨ Prestige ${pp} pts, gagnés par les hauts faits</span>${ready ? `<button class="btn sm primary" data-act="bp-all">Tout récupérer (${ready})</button>` : ""}</div></div>
        <div class="bp-prize"><img src="${img(prize)}" alt=""><span class="small muted">palier ${nextBig}</span><b>${h(name(prize))}</b></div></div>
      <div class="panel"><div class="pad stack"><div class="bp-head"><h2 style="margin:0">Récompenses</h2><span class="small muted">jamais payant · les paliers 5, 10, 15… sont les grands paliers</span></div>${track(s)}</div></div>
      <div class="bp-two">${quests(s)}${feats(s)}</div>`;
    const tr = document.getElementById("bpTrack"), cur = document.getElementById("bpCur");
    if (tr && cur) tr.scrollLeft = Math.max(0, cur.offsetLeft - tr.offsetLeft - 3 * cur.offsetWidth);
  }
  window.DX.pages.pass = page;
  /* ---------- Défi de la manche ---------- */
  function mdPage(main) {
    const s = S(); if (!s || !s.mono) { UI().tab = "home"; X().render(); return; }
    const R = E.mdState(s); const dg = D.DUNGEONS[R.did]; const m = Math.min(4, E.monoManche(s));
    const end = E.monoT0(s) + m * E.MONO.jobs.manche - (E.monoDate ? E.monoDate(s) : E.now()); const k = Math.min(E.STASIS_MAX, R.best + 1);
    const me = s.chars.find((c) => !c.merc) || s.chars[0]; const run = s.mono.mdRun;
    const pend = E.mdPending(s); const ch = E.mdChest(R.best);
    const rows = E.MONO.md.chest.slice().reverse().map(([st, c]) => `<div class="bp-hf${R.best >= st ? "" : " soon"}"><img src="assets/ui/coffres/${(D.CONSUMABLES[c] || {}).img}.svg" alt="" style="width:34px;height:34px"><span class="grow"><b>${h(D.CONSUMABLES[c].name)}</b><br><span class="small muted">meilleure stasis ${st} ou plus</span></span>${R.best >= st ? '<span class="bp-ok">✓</span>' : ""}</div>`).join("");
    main.innerHTML = `<div class="pagehead"><h1>Défi de la manche</h1></div>
      <div class="panel"><div class="pad stack"><div class="bp-head"><h2 style="margin:0">🏁 ${h(dg.name)} <span class="small muted">niv. ${dg.lvl}</span></h2><span class="pill">fin dans ${dur(Math.max(0, end))}</span></div>
        <p class="small muted" style="margin:0">Un donjon imposé pendant 2 semaines, le même pour tout le serveur. Pas besoin de clé, essais libres : tu montes la stasis une par une. Chaque nouvelle stasis donne ${E.MONO.md.pts} points de pass ; ta meilleure stasis donne un coffre à la fin de la manche.</p>
        ${pend.map((x) => `<div class="smallbox monobox"><span>🎁 <b>Manche ${x.m}</b> : stasis ${x.best}, ${h(D.CONSUMABLES[x.chest].name)} à récupérer.</span><button class="btn sm primary" data-act="bp-mdgot" data-m="${x.m}">Récupérer</button></div>`).join("")}
        <div class="bp-two" style="margin-top:0"><div class="stack"><b>Seul</b><div class="bp-q"><div class="row between"><span>${h(me.name)} · ${h(D.CLASSES[me.cls].name)}</span><b>${R.best ? `stasis ${R.best}` : "pas encore"}</b></div><span class="small muted">${R.tries} essai${R.tries > 1 ? "s" : ""}${ch ? ` · coffre visé : ${h(D.CONSUMABLES[ch].name)}` : ""}</span></div>
          <span class="xs muted">Le classement de tous les joueurs arrive avec le serveur Monocompte.</span></div>
          <div class="stack"><b>En groupe</b><div class="bp-q soon" style="opacity:.6"><span>Classement des groupes</span><span class="small muted">avec les groupes en direct (serveur Monocompte)</span></div></div></div>
        ${run ? `<button class="btn primary" data-act="bp-mdgo" disabled>Essai en cours : stasis ${run.k}</button>` : R.best >= E.STASIS_MAX ? `<b>Stasis ${E.STASIS_MAX} atteinte : défi terminé !</b>` : `<button class="btn primary" data-act="bp-mdgo">⚔ Tenter la stasis ${k}</button>`}
      </div></div>
      <div class="panel" style="margin-top:14px"><div class="pad stack"><h2 style="margin:0">Coffres de fin de manche</h2>${rows}</div></div>`;
  }
  window.DX.pages.manche = mdPage;
  /* ---------- Camp de la saison (alignements du Classique, js/monoalign.js) et Boss de saison ---------- */
  function warPage(main) {
    const s = S(); if (!s || !s.mono) { UI().tab = "home"; X().render(); return; }
    const m = Math.min(4, E.monoManche(s)); const end = E.monoT0(s) + m * E.MONO.jobs.manche - (E.monoDate ? E.monoDate(s) : E.now());
    const side = s.align && s.align.side; const AL = side ? E.ALIGN[side] : null;
    const top = Math.max(1, ...s.chars.filter((c) => !c.merc).map((c) => c.lvl));
    const def = E.sbDef(); const st = E.sbState(s); const open = E.sbOpen(); const nx = E.sbNext();
    const last = UI().sbLast;
    let camp;
    if (side && E.honInit) {
      const A = E.honInit(s); const r = E.alignRankIdx(s); const lo = E.honCum(r), hi = E.honCum(Math.min(20, r + 1)); const left = E.ALIGN_HON.agrDay - A.ag.n;
      camp = `<p class="small" style="margin:0">Ton camp : <b style="color:${side === "bonta" ? "#7fb2ff" : "#ff8a6e"}">${h(AL.name)}</b>, pour toute la saison. Rang <b>${r} / 20</b> « ${h(E.alignRankName(s))} ».</p>
        <div class="bp-q"><div class="row between"><span>Honneur de la saison</span><b>${fmt(A.hon)}</b></div><span class="small muted">${r >= 20 ? "rang maximum" : `${fmt(A.hon - lo)} / ${fmt(hi - lo)} vers le rang ${r + 1}`} · agressions restantes aujourd'hui : ${left} / ${E.ALIGN_HON.agrDay}</span></div>
        <div class="row" style="gap:8px"><button class="btn sm primary" data-act="nav" data-v="align">Agressions, régions et Arsenal</button></div>`;
    } else if (top < E.ALIGN_MIN_LVL) camp = `<p class="small" style="margin:0">Au niveau ${E.ALIGN_MIN_LVL}, choisis ton camp, Bonta ou Brâkmar, une fois pour toute la saison (ton héros est niveau ${top}).</p>`;
    else camp = `<p class="small" style="margin:0">Choisis ton camp, une fois pour toute la saison. Agressions, missions et donjons te donneront alors de l'honneur : 20 rangs, des talents et l'Arsenal de ta cité.</p><div class="row" style="gap:8px"><button class="btn sm" data-act="bp-camp" data-v="bonta">Rejoindre Bonta</button><button class="btn sm" data-act="bp-camp" data-v="brakmar">Rejoindre Brâkmar</button></div>`;
    main.innerHTML = `<div class="pagehead"><h1>Guerre et Boss de saison</h1></div>
      <div class="panel"><div class="pad stack"><div class="bp-head"><h2 style="margin:0">⚔ Bonta contre Brâkmar · manche ${m}</h2><span class="pill">fin dans ${dur(Math.max(0, end))}</span></div>
        ${camp}
        <span class="xs muted">Comme sur le Classique : agressions contre des équipes fantômes du camp adverse (ici à un héros), régions de la carte (le camp qui tient une région y gagne +${E.ALIGN_REG_BONUS || 5} % d'XP et de butin), honneur et 20 rangs. L'honneur repart de 0 à chaque saison ; ton rang et tes équipements de rang restent à ton héros dans l'Éternel. Les régions tenues arriveront avec le serveur Monocompte.</span></div></div>
      <div class="panel" style="margin-top:14px"><div class="pad stack" style="text-align:center;align-items:center">
        <span class="pill">BOSS DE SAISON${open ? " · EN DIRECT" : ""}</span>
        <h2 style="margin:0">${def ? `${h(def.name)} ${h(def.line)}` : "Boss de saison"}</h2>
        <p class="small muted" style="margin:0;max-width:60ch">${def ? h(def.story) : ""} Tous les soirs de 21 h à 22 h, ${E.MONO.sb.tries} essais. Chaque essai donne un coffre selon son grade ; 5 soirées donnent l'ornement « Horloge du Comte ».</p>
        <div class="row" style="gap:14px;flex-wrap:wrap;justify-content:center"><span class="small">Ce soir : <b>${st.day.tries} / ${E.MONO.sb.tries}</b> essais · <b>${fmt(st.day.pts)}</b> points</span><span class="small">Meilleur essai : <b>${fmt(st.B.best)}</b></span><span class="small">Soirées : <b>${s.mono.bp.cnt.live || 0} / ${E.MONO.sb.evenings}</b></span></div>
        ${last ? `<div class="bp-q" style="min-width:min(100%,360px)"><div class="row between"><span>Dernier essai</span><b>${fmt(last.points)} points · grade ${h(last.grade.g || last.grade)}</b></div></div>` : ""}
        ${open ? (st.day.tries < E.MONO.sb.tries ? `<button class="btn primary" data-act="bp-sb">⚔ Affronter le boss (seul)</button>` : `<b>Tes 3 essais sont faits : reviens demain à 21 h.</b>`) : `<button class="btn" disabled>Ouvre dans ${dur(nx)}</button>`}
        <span class="xs muted">Les groupes en direct et les dégâts des camps (le camp en tête : +10 % d'XP pour la manche) arrivent avec le serveur Monocompte.</span></div></div>`;
  }
  window.DX.pages.guerre = warPage;

  /* Éternel : la partie d'une saison finie. Le héros garde ses kamas et ses objets ; plus de pass, de Défi de la manche,
     de guerre ni de Boss de saison. La page garde le bilan de sa saison. */
  function eternelPage(main) {
    const s = S(); if (!s || !E.monoEternal(s)) { UI().tab = "home"; X().render(); return; }
    const ET = s.mono.eternel, def = E.monoSeasonDef(ET.s), B = E.bpState(s) || { cnt: {}, hf: {}, md: {}, war: {} }, c = s.chars[0] || {};
    const med = [1, 2, 3].map((k) => Object.values(B.hf || {}).filter((v) => v === k).length);
    const md = [1, 2, 3, 4].map((m) => (B.md && B.md[m] ? B.md[m].best : 0));
    const AL = s.align && s.align.side ? E.ALIGN[s.align.side] : null, rk = ET.al ? ET.al.r : AL && E.alignRankIdx ? E.alignRankIdx(s) : 0;
    const sb = B.sb || { days: {}, best: 0 }, ev = Object.values(sb.days || {}).filter((x) => x.tries > 0).length;
    const tile = (v, l) => `<div class="et-t"><b>${v}</b><span>${l}</span></div>`;
    const date = new Date(ET.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const next = E.monoCurrent();
    main.innerHTML = `<div class="pagehead"><h1>Éternel</h1></div>
      <div class="bp-hero"><div class="bp-lvl"><span>niveau</span><b>${c.lvl || 1}</b><span>héros</span></div>
        <div class="bp-mid"><span class="bp-kick">${h(def.nom)} · finie le ${h(date)}</span><h2>${h(c.name || "")} rejoint l'Éternel</h2>
          <span class="small">Ton héros garde ses kamas, ses objets (équipements de rang compris), ses montures et ses familiers. Plus de contenu de saison ici : le pass, le Défi de la manche, la guerre et le Boss de saison continuent dans la saison en cours.</span>
          <div class="bp-tags"><span class="pill">Classement de l'Éternel avec le serveur, sans récompenses</span><span class="pill">Spécialités de métier libres</span></div></div></div>
      <div class="panel"><div class="pad stack"><h2 style="margin:0">Bilan de la ${h(def.nom)}</h2>
        <div class="et-grid">${tile(`${E.bpTier(s)} / ${BP.tiers}`, "paliers du pass")}${tile(E.bpPrestigePts(s), "points Prestige")}${tile(`${med[0]} · ${med[1]} · ${med[2]}`, "hauts faits bronze · argent · or")}
          ${tile(md.map((x) => x || "–").join(" · "), "Défi de la manche, stasis par manche")}${tile(AL ? `rang ${rk}` : "–", AL ? `d'honneur pour ${h(AL.name)}` : "pas de camp choisi")}${tile(ev ? `${ev} soir${ev > 1 ? "s" : ""}` : "–", `Boss de saison${sb.best ? `, record ${fmt(sb.best)} pts` : ""}`)}</div></div></div>
      <div class="panel" style="margin-top:14px"><div class="pad row between" style="gap:10px;flex-wrap:wrap"><span><b>${next ? `La ${h(E.monoSeasonDef(next).nom)} est ouverte` : "La prochaine saison arrive bientôt"}</b><br><span class="small muted">${next ? "Un nouveau héros part du niveau 1, avec tes titres et apparences." : "Tu pourras y lancer un nouveau héros, avec tes titres et apparences."}</span></span>${next ? `<button class="btn primary" data-act="sv-menu">Choisir ma partie</button>` : ""}</div></div>`;
  }
  window.DX.pages.eternel = eternelPage;



  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^bp-/.test(a) || !S()) return;
    const keep = () => { const tr = document.getElementById("bpTrack"); return tr ? tr.scrollLeft : 0; };
    const redraw = (sl) => { page(document.getElementById("main")); const tr = document.getElementById("bpTrack"); if (tr && sl != null) tr.scrollLeft = sl; };
    if (a === "bp-claim") { const sl = keep(); const r = E.bpClaim(S(), t.dataset.l, +t.dataset.t); if (r) X().toast(r); X().markDirty(); redraw(sl); X().renderStatus && X().renderStatus(); return; }
    if (a === "bp-all") { const sl = keep(); const n = E.bpClaimAll(S()); X().toast(`${n} récompense${n > 1 ? "s" : ""} récupérée${n > 1 ? "s" : ""}.`); X().markDirty(); redraw(sl); return; }
    if (a === "bp-mdgo") { const r = E.mdEnter(S()); if (r) { X().toast(r); return; } X().markDirty(); UI().tab = "combat"; X().render(); window.scrollTo(0, 0); return; }
    if (a === "bp-mdgot") { const r = E.mdClaim(S(), +t.dataset.m); if (r) X().toast(r); X().markDirty(); mdPage(document.getElementById("main")); return; }
    if (a === "bp-sb") { const r = E.sbTry(S()); if (r.err) { X().toast(r.err); return; } UI().sbLast = r; X().markDirty(); warPage(document.getElementById("main")); return; }
    if (a === "bp-camp") { const r = E.chooseAlign(S(), t.dataset.v, Object.keys(E.ALIGN[t.dataset.v].orders)[0]); if (r) X().toast(r); X().markDirty(); warPage(document.getElementById("main")); return; }
    if (a === "bp-fam") { const sl = keep(); UI().bpFam = t.dataset.v; redraw(sl); return; }
  });
})();
