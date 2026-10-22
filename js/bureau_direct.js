/* ============================================================================
   Bureau des Aventuriers — le combat de groupe en direct sur l'écran de combat (idée de Bsasuk, maquette du 21/10 :
   réponses de Mathis 1A 2A 3A + améliorations 1 à 5).
   - 1A : le combat de groupe se regarde sur le vrai écran de combat (Formation, Scène ou Compacte, animations des sorts,
     chiffres, journal), à la même seconde pour tout le groupe. Le navigateur rejoue le combat du serveur pas à pas, une seconde
     de combat à la fois, avec les mêmes photos, la même graine et la même heure de lancement : exactement E.monoGroupRun
     (js/mono.js) et BC.run (js/bureau_combat.js), seulement découpé.
   - 2A : « Tableau du groupe » (dégâts, soins, dégâts subis, monstres vaincus de chaque joueur, sur tout le donjon).
   - 3A : sur la page du Bureau, l'écran s'ouvre tout seul au lancement ; ailleurs, un bandeau « Ton groupe combat ».
   - Améliorations : discussion du salon à côté du combat (1), ton héros en avant (2), progression du donjon (3),
     fin de combat avec ton butin, « Revoir » et « Retour au salon » (4), onglet qui clignote au lancement (5).
   Rien ne change dans le combat, le butin ni le serveur : c'est le même combat, mieux montré.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA, DX = window.DX;
  if (!E || !E.BUREAU || !DX || !window.Bureau) return;
  const BC = E.BUREAU, X = () => DX.social || {}, UI = () => DX.ui || {};
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (X().fmt ? X().fmt(n) : String(n));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  /* même hasard que le serveur (js/mono.js) */
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const BD = { vus: {}, plusTard: {}, title0: null, blink: false };

  /* ---------- le combat pas à pas ---------- */
  /* chaque pas se joue dans les mêmes conditions que BC.run : hasard du combat, horloge arrêtée sur l'heure du lancement,
     ni modificateurs de la semaine ni donjon éclair, équipe jusqu'à 4 ; la partie du joueur garde son propre hasard */
  const dans = (W, fn) => {
    const r0 = E.getRng(), c0 = E.getClock(), w0 = E.weekly, f0 = E.flashOf, ev = E.events.length, tm = E.TEAM_MAX;
    E.setRng(W.rng); E.weekly = () => null; E.flashOf = () => null; E.TEAM_MAX = Math.max(tm, W.n);
    if (W.at > 0) { const t = Math.floor(W.at / 1000) * 1000; E.setClock(() => t); }
    try { return fn(); } finally { E.setRng(r0); E.setClock(c0); E.weekly = w0; E.flashOf = f0; E.events.length = ev; E.TEAM_MAX = tm; }
  };
  const ajoute = (to, rows) => rows.forEach((x) => { const o = (to[x.id] = to[x.id] || { id: x.id, n: x.n, d: 0, h: 0, t: 0, k: 0 }); o.d += x.d; o.h += x.h; o.t += x.t; o.k += x.k; });
  BD.lecture = (c) => {
    const snaps = typeof c.snaps === "string" ? JSON.parse(c.snaps) : JSON.parse(JSON.stringify(c.snaps));
    const W = { c, snaps, n: snaps.length, at: Number(c.at), rng: mulberry(Number(c.seed) >>> 0), t: 0, done: false, err: null, base: {}, cur: [], fid: null, vu: null, salles: 0 };
    dans(W, () => { const G = E.monoGroupSetup(JSON.parse(JSON.stringify(snaps)), c.did, c.stasis); if (G.err) { W.err = G.err; W.done = true; } else W.S2 = G.S2; });
    return W;
  };
  /* une seconde de combat (comme une tour de boucle de E.monoGroupRun) */
  BD.pas = (W) => {
    if (W.done) return;
    dans(W, () => {
      const S2 = W.S2; if (!S2.dungeon || W.t >= 3 * 3600 * 1000) { W.done = true; return; }
      E.tick(S2, 1000); W.t += 1000;
      const F = S2.fight;
      /* la ligne « Victoire ! +XP, +kamas » parle du butin de la copie du combat, pas du tien : seul « Victoire ! » reste */
      if (F && F.log) F.log.forEach((l) => { if (l.cls === "win" && /^Victoire ! \+/.test(l.txt)) l.txt = "Victoire !"; });
      if (F) { if (F.id !== W.fid) { ajoute(W.base, W.cur); W.cur = []; W.fid = F.id; W.salles++; } W.cur = E.fightStats(F); }
      if (!S2.dungeon || (F && F.over && F.result === "lose")) W.done = true;
    });
  };
  BD.stats = (W) => { const o = JSON.parse(JSON.stringify(W.base)); ajoute(o, W.cur); return Object.values(o).sort((a, b) => b.d - a.d || b.h - a.h); };
  /* jusqu'à t ms de combat */
  BD.jusqua = (W, t) => { for (let g = 0; g < 20000 && !W.done && W.t + 1000 <= t; g++) BD.pas(W); };

  /* ---------- ce que montre l'écran ---------- */
  const B = () => window.Bureau;
  const heure = () => (B().heure ? B().heure() : Date.now());
  const ecoule = (c) => heure() - Date.parse(c.debut);
  /* le combat tel que le serveur le donne maintenant (l'heure de départ peut être corrigée après une coupure) */
  const frais = (c) => { const d = B().etat && B().etat(); const x = d && d.salon && d.salon.combat; return x && x.id === c.id && x.debut ? x : c; };
  const nSalles = (did) => ((D.DUNGEONS[did] || {}).rooms || []).length + 1;
  /* ton héros dans le groupe (même nom et même classe que le héros de ta partie) */
  const monIdx = (W) => { const s = DX.S; const me = s && (s.chars || []).find((x) => !x.merc); if (!me) return -1; return W.snaps.findIndex((x) => x.n === me.name && x.cls === me.cls); };
  /* série en cours où l'on peut encore demander l'arrêt (bouton du Bureau, js/bureau.js « bx-sstop ») */
  const serieStop = (c) => { const d = B().etat(); const x = d && d.salon; return !!(x && x.serie_id && x.serie_id === c.serie_id && !x.serie_stop && !d.spectateur && (x.membres || []).some((m) => m.moi)); };
  const salonMsgs = () => { const d = B().etat(); return (d && d.salon && d.salon.msgs) || []; };
  const chatHtml = () => (salonMsgs().map((m) => `<div${m.moi ? ' class="me"' : ""}><b>${h(m.p)}</b> ${h(m.b)}</div>`).join("") || `<span class="small muted">Aucun message.</span>`);
  /* une case par salle, la dernière pour le boss : faite, en cours ou perdue */
  const progHtml = (W) => { const n = nSalles(W.c.did), k = W.salles - 1; return Array.from({ length: n }, (_, i) => {
    const st = i < k || (i === k && W.done && W.c.win) ? "ok" : i === k ? (W.done ? "ko" : "now") : "";
    return `<i class="${i === n - 1 ? "boss " : ""}${st}" title="${i === n - 1 ? "Salle du boss" : `Salle ${i + 1}`}"></i>`; }).join(""); };
  const meterHtml = (W) => {
    const rows = BD.stats(W); if (!rows.length) return `<p class="note">Le tableau se remplit pendant le combat.</p>`;
    const mx = Math.max(1, ...rows.map((x) => x.d)), mi = monIdx(W);
    return `<div class="bxd-m">${rows.map((x, i) => { const sn = W.snaps[x.id - 1] || {}; const cl = D.CLASSES[sn.cls] || {};
      return `<div class="bxd-mr${i === 0 && x.d > 0 && rows.length > 1 ? " mvp" : ""}${x.id - 1 === mi ? " me" : ""}"><img src="assets/h/${h(sn.cls)}_${h(sn.sex || cl.sex || "m")}.png" alt="" loading="lazy"><b>${h(x.n)}${i === 0 && x.d > 0 && rows.length > 1 ? ` <span class="bxd-mvp" title="Meilleur du combat">👑</span>` : ""}</b><span class="num">${fmt(x.d)}</span>
        <span class="bxd-bar"><u style="width:${Math.round((100 * x.d) / mx)}%"></u></span><span class="xs muted bxd-sub">soins ${fmt(x.h)} · subis ${fmt(x.t)} · vaincus ${x.k}</span></div>`; }).join("")}</div>`;
  };
  const enDirect = (w) => !!(w.ext && w.ext.direct && !w.W.done);

  function html(w) {
    const W = w.W, c = W.c, direct = w.ext.direct;
    return `<div class="pagehead combathead"><div><div class="small muted">Bureau des Aventuriers · combat de groupe ${direct ? `<span class="bxd-live">En direct</span>` : `<span class="pill">Revoir</span>`}${c.serie_n > 1 ? ` · combat ${c.serie_k} / ${c.serie_n}` : ""} <span id="wroom"></span></div><h1>${h(BC.nom(c.did))}</h1>
        <div class="bxd-prog" id="bxdProg" aria-label="Progression du donjon">${progHtml(W)}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><span class="pill">Stasis ${c.stasis}</span><span class="pill num" id="bxdClock"></span>
        ${direct ? "" : `<span class="seg" data-tip="Vitesse de lecture">${[1, 2, 4].map((v) => `<button data-act="sm-wspd" data-v="${v}" aria-pressed="${(w.spd || 1) === v}">×${v}</button>`).join("")}</span>`}
        ${direct && c.serie_n > 1 && serieStop(c) ? `<button class="btn sm" data-act="bx-sstop">Arrêter la série après ce combat</button>` : ""}
        <button class="btn sm" data-act="sm-wquit">Retour au salon</button></div></div>
    <section class="grid2 combatgrid bxd-grid">
      <div class="panel combatpanel watchpanel">
        <div class="arenasticky">
          <div class="cstrip"><div class="chalov" id="chalov"></div><span class="cstreak" id="cstreak"></span><span class="seg viewtog">${[["form", "Formation"], ["scene", "Scène"], ["compact", "Compacte"]].map(([v, n]) => `<button data-act="cview" data-v="${v}" aria-pressed="${(window.FORMUI ? window.FORMUI.view(DX.S) : "form") === v}">${n}</button>`).join("")}</span><span class="ctour" id="ctour"></span></div>
          <div class="arenawrap"><div class="arena" id="arena"></div></div>
          <div class="ftick" id="turn"></div>
        </div>
        <div class="chalbar" id="chalbar"></div><div id="await"></div>
        <div class="pad" id="watchEnd"></div>
        <div class="log" id="flog"></div>
        <div hidden><span id="fres"></span><div id="floot"></div></div>
      </div>
      <div class="stack cside bxd-side">
        <div class="panel"><div class="phead"><h2>Tableau du groupe</h2><span class="small muted">tout le donjon</span></div><div class="pad" id="bxdMeter">${meterHtml(W)}</div></div>
        ${B().etat() && B().etat().salon ? `<div class="panel"><div class="phead"><h2>Discussion</h2></div><div class="pad stack">
          <div class="bx-chat" id="bxChat">${chatHtml()}</div>
          <div class="row" style="gap:6px"><input id="bxSay" maxlength="200" placeholder="Écrire au groupe…" style="flex:1;min-width:0"><button class="btn" data-act="bx-say">Envoyer</button></div></div></div>` : ""}
      </div>
    </section>`;
  }
  function head(w) {
    const W = w.W, c = W.c, n = nSalles(c.did);
    const r = document.getElementById("wroom"); if (r) r.textContent = W.salles >= n ? "· salle du boss" : W.salles ? `· salle ${W.salles} sur ${n}` : "";
    const k = document.getElementById("bxdClock"); if (k) k.textContent = `${mmss(Math.floor(W.t / 1000))} / ${mmss(Math.ceil((c.duree || W.t) / 1000))}`;
    const p = document.getElementById("bxdProg"); if (p) { const v = progHtml(W); if (p.dataset.k !== v) { p.dataset.k = v; p.innerHTML = v; } }
    const m = document.getElementById("bxdMeter"); if (m) { const v = meterHtml(W); if (m.dataset.k !== v) { m.dataset.k = v; m.innerHTML = v; } }
    const ch = document.getElementById("bxChat"); if (ch) { const v = chatHtml(); if (ch.dataset.k !== v) { const bas = ch.scrollHeight - ch.scrollTop - ch.clientHeight < 30; ch.dataset.k = v; ch.innerHTML = v; if (bas) ch.scrollTop = ch.scrollHeight; } }
    /* ton héros, encadré d'or dans l'arène */
    const A = UI().arena, mi = monIdx(W), F = W.S2 && W.S2.fight;
    if (A && A.nodes && F) F.ents.forEach((e, i) => { const nd = A.nodes[i]; if (nd) nd.classList.toggle("bxd-me", mi >= 0 && e.side === "c" && !e.summon && e.cid === mi + 1); });
  }
  /* fin du combat (ext.end : le jeu met ce texte dans #watchEnd) */
  function fin(w) {
    const W = w.W, c = W.c;
    const rows = BD.stats(W), top = rows[0];
    const g = B().gain ? B().gain(c.id) : null, wait = !g && w.ext.direct;
    const gain = g ? `Ton butin : <b>${fmt(Math.round(g.xp))} XP</b>, <b>${fmt(g.kamas)} kamas</b>${g.items.length ? `, ${g.items.length} objet${g.items.length > 1 ? "s" : ""}` : ""}${Object.keys(g.res || {}).length ? `, ${Object.values(g.res).reduce((a, b) => a + b, 0)} ressources` : ""}.` : wait ? "Ton butin arrive dans ta partie…" : "";
    const v = `<div class="bxd-end ${c.win ? "win" : "lose"}"><b class="bxd-res">${c.win ? "Victoire !" : "Défaite…"}</b>
      <span>${h(BC.nom(c.did))}, stasis ${c.stasis} · ${mmss(Math.floor(W.t / 1000))}${top && top.d > 0 && rows.length > 1 ? ` · meilleur du combat : <b>${h(top.n)}</b> 👑` : ""}</span>
      ${gain ? `<span class="small">${gain}</span>` : ""}
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="bxd-revoir">Revoir le combat</button><button class="btn sm primary" data-act="sm-wquit">Retour au salon</button></div></div>`;
    return v;
  }
  /* le pas de lecture : en direct, on suit l'heure du serveur ; en « Revoir », une seconde de combat par pas */
  function step(W) {
    const w = UI().watch; const f0 = W.fid;
    if (w && w.ext && w.ext.direct) BD.jusqua(W, ecoule(frais(W.c))); else BD.pas(W);
    if (W.done) return "end";
    return W.fid !== f0 ? "start" : "step";
  }

  /* ---------- ouvrir le combat ---------- */
  BD.regarder = (c, revoir) => {
    if (!c || !c.snaps) return false;
    const W = BD.lecture(c); if (W.err) { try { X().toast("Combat impossible à rejouer sur cet appareil."); } catch (e) {} return false; }
    const direct = !revoir && ecoule(c) < (c.duree || 0);
    if (direct) BD.jusqua(W, Math.max(0, ecoule(c) - 3000)); // on arrive en retard : le combat reprend à la bonne seconde
    else BD.pas(W);
    BD.vus[c.id] = 1; BD.plusTard[c.id] = 1; banniere();
    X().extWatchStart(W, { step, html, head, end: fin, back: "bureau", direct, combat: c.id });
    return true;
  };
  const regarde = (id) => { const w = UI().watch; return !!(w && w.ext && w.ext.combat === id); };

  /* ---------- le bandeau « Ton groupe combat », l'ouverture toute seule et l'onglet qui clignote ---------- */
  const enCours = () => { const d = B().etat && B().etat(); const c = d && d.salon && d.salon.combat; return c && c.etat === "fini" && c.snaps && c.debut && ecoule(c) < (c.duree || 0) ? c : null; };
  function banniere() {
    let el = document.getElementById("bxdBan"); const c = enCours();
    const show = c && !regarde(c.id) && !BD.plusTard[c.id] && !document.getElementById("bxInv");
    if (!show) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "bxdBan"; el.className = "bx-inv bxd-ban"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    const t = Math.max(0, Math.floor(ecoule(c) / 1000));
    const v = `<div class="bx-inv-m"><b><span class="bxd-live">En direct</span> Ton groupe combat</b><span>${h(BC.nom(c.did))} · stasis ${c.stasis} · ${mmss(t)} / ${mmss(Math.ceil((c.duree || 0) / 1000))}</span></div>
      <button class="btn primary" data-act="bxd-voir">Regarder</button><button class="btn" data-act="bxd-tard">Plus tard</button>`;
    if (el.dataset.k !== v) { el.dataset.k = v; el.innerHTML = v; }
  }
  function onglet() {
    const c = enCours();
    if (c && document.hidden && !regarde(c.id)) { if (BD.title0 == null) BD.title0 = document.title; BD.blink = !BD.blink; document.title = BD.blink ? "Ton groupe combat !" : BD.title0; }
    else if (BD.title0 != null && !document.hidden) { document.title = BD.title0; BD.title0 = null; }
  }
  setInterval(() => {
    let c = null; try { c = enCours(); } catch (e) { c = null; }
    /* 3A : sur la page du Bureau, le combat s'ouvre tout seul au lancement (une fois par combat) */
    if (c && !BD.vus[c.id] && UI().tab === "bureau" && !UI().watch && !document.hidden) BD.regarder(c);
    banniere(); onglet();
    /* série (×N) : le combat suivant se lance tout seul ; on le suit si on regardait le précédent en direct */
    const w0 = UI().watch;
    if (c && w0 && w0.ext && w0.ext.end === fin && w0.ext.direct && w0.W.done && w0.ext.combat !== c.id && !BD.vus[c.id] && !document.hidden) BD.regarder(c);
    const w = UI().watch; // le butin arrive après la fin : on récrit la fin quand il est là
    if (w && w.ext && w.ext.end === fin && w.W.done) { const el = document.getElementById("watchEnd"), v = fin(w); if (el && el.dataset.k !== v) { el.dataset.k = v; el.innerHTML = v; const st = document.querySelector(".arenasticky.stick"); if (st) st.classList.remove("stick"); } }
  }, 1000);

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act;
    if (a === "bxd-voir") { const c = enCours(); if (c) { if (DX.go && UI().tab !== "bureau") DX.go("bureau"); BD.regarder(c); } return; }
    if (a === "bxd-tard") { const c = enCours(); if (c) BD.plusTard[c.id] = 1; banniere(); return; }
    if (a === "bxd-revoir") {
      const w = UI().watch; let c = w && w.ext && w.ext.combat != null ? w.W.c : null;
      if (!c) { const d = B().etat(); c = d && d.salon && d.salon.combat; }
      if (c) BD.regarder(c, true); return;
    }
  });
  window.BureauDirect = BD;
})();
