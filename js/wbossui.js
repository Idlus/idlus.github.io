/* ============================================================================
   BOSS DES MONDES — interface (0.1.49). Les règles et le combat sont dans js/wboss.js.
   Page Jouer › Boss des mondes : le boss, sa barre de PV commune (phases à 66 % et 33 %), tes essais du jour,
   le grade de chaque essai, le classement, la boutique de Fragments d'anomalie et la rotation.
   Autour : la carte animée dans le chat Général (card), l'effet plein écran à l'arrivée d'un boss (une fois par joueur,
   coupable dans Options), le bandeau violet en haut tant qu'il est en vie et le bandeau du bonus d'XP après sa mort.
   En ligne avec un compte : le serveur joue l'essai (fonction « record ») et donne les coffres et Fragments (hdv_op).
   Sans compte : on regarde le boss et le classement, et on peut faire un essai d'entraînement (rien n'est compté).
   Version de test (sans serveur) : un boss local, sur cet appareil, avec moins de PV pour voir tout le cycle.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const ON = () => window.ONLINE;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const nf = (n) => Math.round(n || 0).toLocaleString("fr-FR");
  const FRAG = E.WB_FRAG;
  const LOCAL_HP = 1200; // version de test : un boss local tombe en quelques jours d'essais
  const ui = { info: null, at: 0, loading: false, busy: false, err: "", off: 0, shown: 0 };

  /* ---------- préférences de cet appareil : effets, boss déjà annoncé, bandeaux fermés, boss local ---------- */
  const LS = "idlus-wb";
  let pref = {}; try { pref = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { pref = {}; }
  const savePref = () => { try { localStorage.setItem(LS, JSON.stringify(pref)); } catch (e) { /* stockage indisponible */ } };
  const fxOn = () => pref.fx !== false;
  // portrait animé : il respire, plus vite en phase 2, enragé (aura rouge) en phase 3 ; coupé par l'option des effets
  const an = (ph) => (fxOn() ? ` wb-an wb-p${ph || 1}` : "");

  const mode = () => { const o = ON(); if (!o || !o.enabled) return "local"; return o.user && o.profile ? "acc" : "guest"; };
  const day = () => E.defiDay(Date.now());
  const nextMidnight = () => { const t = Date.now(), d = E.defiDay(t); let lo = t, hi = t + 90000000; while (hi - lo > 30000) { const m = (lo + hi) / 2; if (E.defiDay(m) > d) hi = m; else lo = m; } return hi; };
  const dur = (ms) => { const s = Math.max(0, ms / 1000); const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60); return d ? `${d} j ${hh} h` : hh ? `${hh} h ${String(mm).padStart(2, "0")}` : `${Math.max(1, mm)} min`; };
  const img = (def) => X().imgM(def.mon);
  const chest = (k) => X().chestImg(k.replace("coffre_", ""));
  const fragImg = (c = "wb-fi") => `<img class="${c}" src="${X().resImg(FRAG)}" alt="">`;
  const consTxt = (cons) => Object.entries(cons || {}).map(([k, q]) => `${q > 1 ? q + " " : ""}${(window.DATA.CONSUMABLES[k] || {}).name || k}${q > 1 ? "" : ""}`.replace(/^(\d+) Coffre/, "$1 Coffres")).join(", ");
  const ELC = { n: "neutre", t: "terre", f: "feu", e: "eau", a: "air" };

  /* ---------- état du boss (serveur, ou boss local de la version de test) ---------- */
  function loc() {
    const L = pref.loc || (pref.loc = { n: 1, hp: LOCAL_HP, dmg: 0, started: Date.now(), day: day(), today: 0, pts: 0, best: 0, k: 0, bonus: 0, last: null });
    if (L.day !== day()) { L.day = day(); L.today = 0; }
    return L;
  }
  function st() {
    if (mode() === "local") {
      const L = loc(); const me = { today: L.today, pts: L.pts, best: L.best || null, rank: 1 };
      return { n: L.n, hp: L.hp, dmg: L.dmg, phase: E.wbPhase(L.dmg, L.hp), started: L.started, players: L.pts ? 1 : 0, top: L.pts ? [{ u: "me", p: "Toi", pts: L.pts, n: L.k, best: L.best }] : [], me, last: L.last, bonus: L.bonus, local: true };
    }
    const I = ui.info; if (!I) return null;
    return { n: I.n, hp: +I.hp, dmg: +I.dmg, phase: I.phase, started: Date.parse(I.started) - ui.off, players: I.players || 0, top: I.top || [], me: I.me, last: I.last, bonus: I.bonus ? Date.parse(I.bonus) - ui.off : 0 };
  }
  async function load(force) {
    const o = ON(); if (!o || !o.enabled || ui.loading) return;
    if (!force && ui.info && Date.now() - ui.at < 30000) return;
    ui.loading = true;
    const r = await o.rpc("wb_info");
    ui.loading = false;
    if (r.err || !r.data) { ui.err = "Le serveur ne répond pas pour l'instant."; paint(); return; }
    ui.err = ""; ui.info = r.data; ui.at = Date.now();
    if (r.data.now) ui.off = Date.parse(r.data.now) - Date.now();
    sync();
  }
  /* bonus d'XP pour tout le monde après une victoire, bandeaux, effet d'arrivée, page */
  function sync() {
    const s = st(); if (!s) return;
    E.wbXpUntil = s.bonus > Date.now() ? E.now() + (s.bonus - Date.now()) : 0;
    paint(); paintBar(); maybeOverlay();
    /* la tuile de l'Accueil apparaît ou change une fois le boss chargé */
    const t = tile(); const key = t ? t.s : "";
    if (key !== ui.tileKey) { const first = ui.tileKey === undefined; ui.tileKey = key; const D2 = window.DX; if (!first || key) { if (D2 && D2.ui && D2.ui.tab === "home" && !D2.ui.watch && !($("#sheet") && $("#sheet").innerHTML)) D2.render(); } }
  }

  /* ---------- petits rendus ---------- */
  const triesLeft = (s) => (s && s.me ? Math.max(0, E.WB_TRIES - (s.me.today || 0)) : 0);
  const left = (s) => Math.max(0, s.hp - s.dmg);
  const pctLeft = (s) => (s.hp > 0 ? Math.max(0, Math.min(100, (left(s) / s.hp) * 100)) : 0);
  const pctTxt = (p) => (p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1).replace(".", ",")) + " %";
  const phName = (def, ph) => (ph >= 2 ? def.phNames[ph - 2] : "");
  const phTxt = (ph) => (ph === 2 ? "il frappe 30 % plus fort" : "enragé, il subit 25 % de dégâts en plus");
  const el = (k, txt) => `<span class="wb-el ${ELC[k]}">${txt}</span>`;
  const hpBar = (s, cls = "") => { const p = pctLeft(s); return `<div class="wb-hp ${cls}"><i style="width:${p}%"></i><span class="wb-mark" style="left:66.6%"></span><span class="wb-mark" style="left:33.3%"></span><b>${nf(left(s) * E.WB_PV)} / ${nf(s.hp * E.WB_PV)} PV · ${pctTxt(p)}</b></div>`; };
  const gradeOf = (pts) => E.wbGrade(pts || 0).g;

  /* ---------- page ---------- */
  function render(main) {
    if (mode() !== "local") load();
    main.innerHTML = `<div id="wbPage">${pageHtml()}</div>`;
    setTimeout(paintBar, 0);
  }
  function paint() {
    const w = $("#wbPage"); if (!w || !window.DX || window.DX.ui.tab !== "wb") return;
    w.innerHTML = pageHtml();
  }
  function pageHtml() {
    const s = st(); const m = mode();
    const top = `<div class="wb-top"><div><h1>Boss des mondes</h1><span class="small muted">Tout le serveur frappe le même boss. Quand ses PV tombent à zéro, le suivant arrive.</span></div><span class="tag boss">${m === "local" ? "Version de test : boss local" : "Tout le serveur"}</span></div>`;
    if (!s) return top + `<section class="panel wb-p"><p class="muted">${ui.err ? h(ui.err) + ` <button class="btn sm" data-act="wb-reload">Réessayer</button>` : "Chargement du boss…"}</p></section>`;
    const def = E.wbDef(s.n);
    return top + heroHtml(s, def) + `<div class="wb-grid"><div class="stack" style="gap:14px">${gradesHtml(s)}${shopHtml(def)}${rotHtml(s)}</div><div class="stack" style="gap:14px">${lbHtml(s)}${killHtml(s, def)}</div></div>`;
  }
  function heroHtml(s, def) {
    const m = mode(); const tl = triesLeft(s); const ph = s.phase; const team = E.team(S()).length;
    const rate = s.dmg > 0 ? s.dmg / Math.max(60000, Date.now() - s.started) : 0;
    const eta = rate > 0 ? ` · au rythme actuel, il tombe dans environ ${dur(left(s) / rate)}` : "";
    const next = E.wbDef(s.n + 1);
    const side = m === "guest"
      ? `<span class="small"><b>Sans compte</b>, tu peux regarder le boss et le classement.</span><button class="btn primary" data-act="on-loginscreen">Créer un compte pour frapper</button><button class="btn sm" data-act="wb-attack" ${team ? "" : "disabled"}>Essai d'entraînement (non compté)</button>`
      : `<span class="small"><b>${tl} essai${tl > 1 ? "s" : ""} sur ${E.WB_TRIES}</b> aujourd'hui</span><div class="wb-pips">${Array.from({ length: E.WB_TRIES }, (_, i) => `<i class="${i < tl ? "on" : ""}"></i>`).join("")}</div>
        <button class="btn primary" data-act="wb-attack" ${tl && team && !ui.busy ? "" : "disabled"}>${X().IC("combat")} ${ui.busy ? "Le serveur joue ton essai…" : "Attaquer le boss"}</button>
        <span class="xs muted">${tl ? "15 tours avec ton équipe active" : `Nouveaux essais dans ${dur(nextMidnight() - Date.now())} (minuit, heure de Paris)`}</span>
        <div class="wb-me">Tes dégâts : <b>${nf((s.me && s.me.pts) * E.WB_PV)} PV</b>${s.me && s.me.pts ? ` (${pctTxt((s.me.pts / s.hp) * 100)})<br>${s.me.rank}<sup>${s.me.rank === 1 ? "er" : "e"}</sup> sur ${s.players} · meilleur essai : ${nf(s.me.best * E.WB_PV)} PV, grade <b class="g g-${gradeOf(s.me.best)}">${gradeOf(s.me.best)}</b>` : "<br>Pas encore d'essai sur ce boss"}<br><span class="wb-frag">${fragImg()} ${nf(E.wbFrags(S()))} Fragments d'anomalie</span></div>`;
    return `<section class="panel wb-hero">
      <div class="wb-img"><img class="${an(s.phase).trim()}" src="${img(def)}" alt=""></div>
      <div class="wb-mid">
        <span class="xs muted">Boss des mondes n° ${s.n} · apparu il y a ${dur(Date.now() - s.started)} · niveau calé sur ton équipe</span>
        <span class="wb-name">${h(def.name)}</span>
        <div class="row" style="gap:6px;flex-wrap:wrap">${el(def.weak, `Faible : ${E.wbElName(def.weak)} +50 %`)}${el(def.res, `Résiste : ${E.wbElName(def.res)} −50 %`)}<span class="tag soft">${E.WB_ROUNDS} tours par essai</span></div>
        ${hpBar(s)}
        <div class="wb-phases"><span class="${ph === 2 ? "on" : ""}">${ph === 2 ? "<b>" : ""}Phase 2 sous 66 % · ${h(phName(def, 2))}${ph === 2 ? "</b>" : ""} : ${phTxt(2)}</span><span class="${ph === 3 ? "on" : ""}">${ph === 3 ? "<b>" : ""}Phase 3 sous 33 % · ${h(phName(def, 3))}${ph === 3 ? "</b>" : ""} : ${phTxt(3)}</span></div>
        <span class="small muted">${h(def.story)} ${s.players} joueur${s.players > 1 ? "s l'ont" : " l'a"} frappé${eta}. Ensuite, ${h(next.name)} arrive aussitôt.</span>
        ${m === "local" ? `<span class="xs muted">Version de test : pas de serveur, ce boss n'existe que sur cet appareil (${nf(LOCAL_HP * E.WB_PV)} PV au lieu de millions).</span>` : ""}
      </div>
      <div class="wb-side">${team ? side : `<span class="small">Il faut au moins un héros dans l'équipe active.</span>`}</div></section>`;
  }
  function gradesHtml(s) {
    const on = s.me && s.me.best ? gradeOf(s.me.best) : "";
    return `<section class="panel wb-p"><h3>Grade de chaque essai</h3>
      <p class="small muted" style="margin:0 0 8px">Plus ton équipe fait de dégâts en ${E.WB_ROUNDS} tours, plus le grade est haut. Le coffre arrive tout de suite dans ton sac.</p>
      <div class="wb-grades">${E.WB_GRADES.slice().reverse().map((g) => { const [k, q] = Object.entries(g.cons)[0]; return `<div class="wb-gr ${g.g === on ? "on" : ""}"><span class="L g-${g.g}">${g.g}</span>${chest(k)}<b>${g.min ? nf(g.min * E.WB_PV) + " PV" : "moins de " + nf(100 * E.WB_PV)}</b><span class="muted">${q > 1 ? q + " × " : ""}${h(window.DATA.CONSUMABLES[k].name)}<br>+${g.frag} Fragment${g.frag > 1 ? "s" : ""}</span></div>`; }).join("")}</div></section>`;
  }
  function lbHtml(s) {
    const me = mode() === "acc" ? ON().user.id : "me";
    const rows = (s.top || []).map((r, i) => `<div class="wb-row ${r.u === me ? "me" : ""}"><span class="n">${i + 1}</span><span class="grow"><b>${h(r.p || "?")}</b><span class="xs muted">${r.n} essai${r.n > 1 ? "s" : ""} · meilleur ${nf(r.best * E.WB_PV)} PV</span></span><span class="small" title="Total de ses essais">${nf(r.pts * E.WB_PV)} PV</span><b class="wb-lg g-${gradeOf(r.best)}" title="Grade de son meilleur essai">${gradeOf(r.best)}</b></div>`).join("");
    const last = s.last ? `<p class="xs muted" style="margin:8px 0 0">Boss précédent : ${h(s.last.name)}, tombé en ${dur(s.last.dur * 1000)}${s.last.by ? `, dernier coup de <b>${h(s.last.by)}</b>` : ""}.</p>` : "";
    return `<section class="panel wb-p"><h3>Classement de ce boss</h3><p class="xs muted" style="margin:0 0 6px">Total des dégâts de tous ses essais. La lettre est le grade de son meilleur essai.</p>${rows || `<p class="small muted">Personne ne l'a encore frappé. À toi le premier coup !</p>`}${last}</section>`;
  }
  function killHtml(s, def) {
    const K = E.WB_KILL;
    return `<section class="panel wb-p"><h3>Quand ${h(def.name)} tombe</h3><div class="wb-kill">
      ${chest("coffre_or")}<span>Chaque joueur qui l'a frappé reçoit un <b>Coffre en or</b> et <b>${K.all.frag} Fragments d'anomalie</b>.</span>
      ${chest("coffre_douze")}<span>Les <b>3 premiers</b> : <b>Coffre des Douze</b>, <b>${K.top3.frag} Fragments</b> et le titre « <b>${K.top3.title}</b> » jusqu'au boss suivant.</span>
      ${s.n === 1 ? `${X().IC("trophee")}<span>Pour ce premier passage, tous ceux qui l'ont frappé gagnent le titre « <b>${K.first}</b> ».</span>` : ""}
      ${X().IC("bonbon")}<span>Tout le monde (comptes et invités) gagne <b>+${K.xp} % d'XP pendant ${K.xpH} h</b>. Le dernier coup est annoncé dans le chat.</span></div></section>`;
  }
  function shopHtml(def) {
    const s = S(); const n = E.wbFrags(s);
    const KIND = { amulette: "Amulette", arme: "Arme", bouclier: "Bouclier" };
    return `<section class="panel wb-p"><h3>Butin du Titan</h3><p class="small muted" style="margin:0 0 8px">Les 4 objets de Gargandyas (DOFUS) ne s'obtiennent qu'ici. Chaque essai donne des Fragments d'anomalie selon le grade (C 1, B 2, A 3, S 4, SS 5, SSS 6), et sa mort en donne encore. Tu en as <b>${nf(n)}</b>.</p>
      <div class="wb-loot">${E.WB_SHOP.map(([tpl, p]) => { const T = window.DATA.ITEMS[tpl]; return `<div class="wb-it"><button class="wb-itb" data-act="wb-item" data-tpl="${tpl}"><img src="${X().itemImg(tpl)}" alt=""><b>${h(T.name)}</b><span class="xs muted">${KIND[T.slot] || T.slot} niv. ${T.lvl}</span></button><button class="btn sm ${n >= p ? "primary" : ""}" data-act="wb-buy" data-tpl="${tpl}" ${n >= p ? "" : "disabled"}>${fragImg("wb-fi sm")} ${p}</button></div>`; }).join("")}</div></section>`;
  }
  function rotHtml(s) {
    const L = [];
    for (let i = 0; i < 6; i++) { const d = E.wbDef(s.n + i); L.push({ d, cls: i === 0 ? "now" : i === 1 ? "next" : "mys" }); }
    return `<section class="panel wb-p"><h3>La rotation</h3><p class="small muted" style="margin:0 0 8px">Dès que les PV d'un boss sont épuisés, le suivant apparaît. Ses PV s'ajustent pour qu'il tienne environ une journée. Après les ${E.WB_ROT.length} boss, Gargandyas revient.</p>
      <div class="wb-rot">${L.map((x, i) => `<div class="wb-rc ${x.cls}"><img class="${an(i ? 1 : s.phase).trim()}" src="${img(x.d)}" alt=""><b>${x.cls === "mys" ? "???" : h(x.d.name)}</b><span class="${i ? "muted" : ""}">${i === 0 ? "En cours" : i === 1 ? "Prochain" : "Bientôt"}</span><span class="xs muted">${i === 0 ? `${pctTxt(pctLeft(s))} de PV` : i === 1 ? `faible : ${E.wbElName(x.d.weak)}` : ""}</span></div>`).join("")}</div></section>`;
  }

  /* ---------- un essai ---------- */
  async function attack() {
    const s0 = S(); if (!s0 || ui.busy) return;
    if (!E.team(s0).length) { X().toast("Il faut au moins un héros dans l'équipe active."); return; }
    const m = mode(); const s = st(); if (!s) return;
    if (m === "guest") { train(s); return; }
    if (triesLeft(s) < 1) { X().toast("Plus d'essai aujourd'hui : il en revient 3 à minuit."); return; }
    if (m === "local") { localAttack(s); return; }
    ui.busy = true; paint();
    try { await X().onPush(); } catch (e) { /* le serveur rejoue avec la partie en ligne */ }
    const R = await ON().submitGuild({ wboss: 1 });
    ui.busy = false;
    if (R.net) { X().toast("Pas de connexion au serveur : réessaie dans un moment."); paint(); return; }
    if (!R.ok) { X().toast(R.err || "Refusé par le serveur."); load(true); return; }
    if (window.MARKET) { try { await window.MARKET.sync(); } catch (e) { /* les coffres arriveront à la prochaine synchro */ } }
    load(true);
    watch(Object.assign({ dmg0: R.before != null ? R.before : Math.max(0, R.dmg - R.points) }, R));
  }
  function train(s) {
    const seed = (Date.now() >>> 0) || 1; const def = E.wbDef(s.n);
    const r = E.wbSim(S(), def, s.phase, seed); if (r.err) { X().toast(r.err); return; }
    watch(Object.assign({ train: true, n: s.n, seed, phase: s.phase, name: def.name, hp: s.hp, dmg0: s.dmg, dmg: s.dmg }, r));
  }
  function localAttack() {
    const s = S(); const L = loc(); const def = E.wbDef(L.n); const phase = E.wbPhase(L.dmg, L.hp); const seed = E.wbSeed(L.n, "local", L.k);
    const r = E.wbSim(s, def, phase, seed); if (r.err) { X().toast(r.err); return; }
    const G = E.wbGrade(r.points);
    for (const k in G.cons) E.addCons(s, k, G.cons[k]);
    s.res[FRAG] = (s.res[FRAG] || 0) + G.frag;
    const dmg0 = L.dmg; L.k++; L.today++; L.pts += r.points; L.best = Math.max(L.best || 0, r.points); L.dmg += r.points;
    const R = Object.assign({ local: true, n: L.n, k: L.k - 1, seed, phase, name: def.name, frag: G.frag, cons: G.cons, hp: L.hp, dmg0, dmg: Math.min(L.dmg, L.hp), killed: false, left: E.WB_TRIES - L.today, rank: 1 }, r);
    if (L.dmg >= L.hp) {
      const K = E.WB_KILL; R.killed = true;
      E.addCons(s, "coffre_or"); E.addCons(s, "coffre_douze"); s.res[FRAG] += K.all.frag + K.top3.frag;
      s.titlesExtra = s.titlesExtra || []; [K.top3.title].concat(L.n === 1 ? [K.first] : []).forEach((t) => { if (!s.titlesExtra.includes(t)) s.titlesExtra.push(t); });
      L.last = { n: L.n, name: def.name, dur: Math.round((Date.now() - L.started) / 1000), by: "toi", top: ["Toi"], players: 1 };
      L.n++; L.dmg = 0; L.pts = 0; L.best = 0; L.k = 0; L.started = Date.now(); L.bonus = Date.now() + K.xpH * 3600e3;
    }
    savePref(); X().markDirty(); sync();
    watch(R);
  }
  function watch(R) {
    const s = S(); const def = E.wbDef(R.n);
    const W = E.wbWatch(s, def, R.phase, R.seed); if (W.err) { X().toast(W.err); return; }
    X().extWatchStart(W, { step: E.wbWatchStep, html: watchHtml, head: watchHead, end: watchEnd, back: "wb", res: R, def });
  }
  function livePts(W) { const B = W.B; return Math.round((Math.max(0, B.hpMax - Math.max(0, B.hp)) / W.base) * 100 * (W.def.pow || 1)); }
  function watchHtml(w) {
    const R = w.ext.res, def = w.ext.def; const sp = w.spd || 1;
    return `<div class="pagehead combathead"><div><div class="small muted">${X().IC("couronne")} Boss des mondes${R.train ? " · entraînement, rien n'est compté" : ""} <span id="wroom"></span></div><h1>${h(def.name)}${R.phase > 1 ? ` · ${h(phName(def, R.phase))}` : ""}</h1></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="seg" data-tip="Vitesse de lecture">${[1, 2, 4].map((v) => `<button data-act="sm-wspd" data-v="${v}" aria-pressed="${sp === v}">×${v}</button>`).join("")}</span><button class="btn sm" data-act="sm-wskip">Passer</button><button class="btn sm" data-act="sm-wquit">Quitter</button></div></div>
    <section class="panel combatpanel watchpanel wbw">
      <div class="wbw-top"><img class="${an(R.phase).trim()}" src="${img(def)}" alt=""><div class="grow"><div class="wb-hp"><i id="wbwHp" style="width:${(Math.max(0, R.hp - R.dmg0) / R.hp) * 100}%"></i><b id="wbwTxt"></b></div><span class="small" id="wbwDmg"></span></div><span class="wbw-g" id="wbwG">C</span></div>
      <div class="arenasticky">
        <div class="cstrip"><div class="chalov" id="chalov"></div><span class="cstreak" id="cstreak"></span><span class="ctour" id="ctour"></span></div>
        <div class="arenawrap"><div class="arena" id="arena"></div></div>
        <div class="ftick" id="turn"></div>
      </div>
      <div class="chalbar" id="chalbar"></div><div id="await"></div>
      <div class="pad" id="watchEnd"></div>
      <div class="log" id="flog"></div>
      <div hidden><span id="fres"></span><div id="floot"></div></div>
    </section>`;
  }
  function watchHead(w) {
    const W = w.W, R = w.ext.res; const F = W.S2.fight; if (!F) return;
    const pts = W.done ? R.points : livePts(W); const g = gradeOf(pts);
    const room = $("#wroom"); if (room) room.textContent = `· tour ${Math.min(F.round || 1, E.WB_ROUNDS)} sur ${E.WB_ROUNDS}`;
    const rest = Math.max(0, R.hp - R.dmg0 - pts);
    const bar = $("#wbwHp"); if (bar) bar.style.width = `${(rest / R.hp) * 100}%`;
    const tx = $("#wbwTxt"); if (tx) tx.textContent = `${nf(rest * E.WB_PV)} PV · ${pctTxt((rest / R.hp) * 100)}`;
    const dm = $("#wbwDmg"); if (dm) dm.innerHTML = `Dégâts de ton équipe : <b>${nf(pts * E.WB_PV)} PV</b>`;
    const ge = $("#wbwG"); if (ge && ge.textContent !== g) { ge.textContent = g; ge.className = `wbw-g g-${g} up`; }
  }
  function watchEnd(w) {
    const R = w.ext.res, def = w.ext.def; const G = E.wbGrade(R.points); const i = E.WB_GRADES.indexOf(G); const up = i > 0 ? E.WB_GRADES[i - 1] : null;
    const s = st(); const tl = R.left != null ? Math.max(0, R.left) : s ? triesLeft(s) : 0; // le serveur sait combien il en reste, même avant le rechargement
    const why = R.alive ? `${R.rounds} tours joués` : `ton équipe est tombée au tour ${R.rounds}`;
    const tip = up ? `Au grade ${up.g}, il te manquait ${nf((up.min - R.points) * E.WB_PV)} PV. ` : "";
    const el2 = `${E.wbElName(def.weak)} fait +50 % sur lui, ${E.wbElName(def.res)} seulement la moitié.`;
    if (R.train) return `<div class="wb-res"><span class="xs muted">Essai d'entraînement · ${why}</span><div class="big g-${G.g}">${G.g}</div><div class="dmg">${nf(R.pv)} PV de dégâts</div>
      <p class="small muted">Rien n'est compté sans compte. ${tip}L'${el2}</p>
      <div class="row" style="gap:8px;justify-content:center"><button class="btn" data-act="wb-rewatch">Revoir le combat</button><button class="btn primary" data-act="on-loginscreen">Créer un compte pour frapper</button><button class="btn" data-act="sm-wquit">Retour</button></div></div>`;
    const ch = Object.entries(R.cons || {})[0] || ["coffre_bois", 1];
    const kill = R.killed ? `<div class="wb-killed">${confetti()}<b>Tu as porté le dernier coup : ${h(def.name)} est tombé !</b><br><span class="small">Coffre en or, Fragments et bonus d'XP pour tout le monde. Le boss suivant arrive.</span></div>` : "";
    return `<div class="wb-res">${kill}<span class="xs muted">${R.local ? "Version de test · " : ""}Essai ${E.WB_TRIES - (R.left || 0)} sur ${E.WB_TRIES} · ${h(def.name)} · phase ${R.phase} · ${why}</span>
      <div class="big g-${G.g}">${G.g}</div><div class="dmg">${nf(R.pv)} PV de dégâts</div><span class="small muted">soit ${pctTxt((R.points / R.hp) * 100)} de ses PV${R.rank ? ` · tu es ${R.rank}<sup>${R.rank === 1 ? "er" : "e"}</sup> au classement` : ""}</span><br>
      <div class="chest">${chest(ch[0])}<span style="text-align:left"><b>${h(consTxt(R.cons))}</b><br><span class="xs muted">dans ton sac</span></span>${fragImg()}<span style="text-align:left"><b>+${R.frag} Fragment${R.frag > 1 ? "s" : ""}</b><br><span class="xs muted">${nf(E.wbFrags(S()))} au total</span></span></div>
      ${R.killed ? "" : `<div class="wb-hp" style="margin:6px 0 10px"><i style="width:${(Math.max(0, R.hp - R.dmg) / R.hp) * 100}%"></i><b>Il lui reste ${pctTxt((Math.max(0, R.hp - R.dmg) / R.hp) * 100)}</b></div>`}
      <p class="small muted">${tip}L'${el2}</p>
      <div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn" data-act="usecons" data-id="${ch[0]}">Ouvrir le coffre</button><button class="btn" data-act="wb-rewatch">Revoir le combat</button>${tl ? `<button class="btn primary" data-act="wb-again">Encore ${tl} essai${tl > 1 ? "s" : ""}</button>` : ""}<button class="btn" data-act="sm-wquit">Retour</button></div></div>`;
  }
  function confetti() { const c = ["#f1cf6e", "#e2533b", "#9fd84a", "#6cb6ff", "#c45cff"]; let s = ""; for (let i = 0; i < 14; i++) s += `<i class="cf" style="left:${i < 7 ? i * 14 + 2 : (i - 7) * 14 + 4}%;top:${i < 7 ? 2 + (i % 2) * 4 : 86 + (i % 2) * 5}%;background:${c[i % 5]};transform:rotate(${i * 41}deg)"></i>`; return s; }

  /* ---------- carte du chat Général (E1, E4) ---------- */
  function card(m) {
    const d = m.data || {}; const def = E.wbDef(d.n || 1); const s = st(); const live = s && s.n === d.n;
    if (d.ev === "ph") return `<div class="ann-wb ph"><img class="b${live ? an(d.ph) : ""}" src="${img(def)}" alt=""><div><div class="k">Phase ${d.ph} · ${d.ph === 2 ? 66 : 33} %</div><div class="t">${h(def.name)} : ${h(phName(def, d.ph))} ! Il ${d.ph === 2 ? "frappe 30 % plus fort" : "est enragé et subit 25 % de dégâts en plus"}.</div></div>${live ? `<button class="btn sm go" data-act="wb-go">Attaquer le boss</button>` : ""}</div>`;
    if (d.ev === "dead") {
      const top = (d.top || []).slice(0, 3).map((p, i) => `<span>${["🥇", "🥈", "🥉"][i]} ${h(p)}</span>`).join("");
      const next = E.wbDef((d.n || 1) + 1);
      return `<div class="ann-wb dead">${confetti()}<img class="b" src="${img(def)}" alt=""><div><div class="k">Boss des mondes vaincu${d.dur ? ` · ${dur(d.dur * 1000)}` : ""}</div><div class="t">${h(def.name)} est tombé !</div></div>
        <div class="s">Dernier coup : <b>${h(m.pseudo || "?")}</b>. ${d.players || ""} joueur${d.players > 1 ? "s reçoivent" : " reçoit"} un Coffre en or${d.n === 1 ? " et le titre « Briseur de Titan »" : ""}. <b>+${E.WB_KILL.xp} % d'XP pour tout le monde pendant ${E.WB_KILL.xpH} h.</b></div>${top ? `<div class="top">${top}</div>` : ""}<div class="s muted">${h(next.name)} arrive…</div></div>`;
    }
    const p = live ? pctLeft(s) : s && s.n > d.n ? 0 : 100;
    return `<div class="ann-wb${live ? "" : " old"}"><img class="b${live ? an(s.phase) : ""}" src="${img(def)}" alt=""><div><div class="k">Boss des mondes</div><div class="t">${h(def.name)} ${h(def.line)}</div></div><div class="s">${h(def.story)} Tout le serveur peut l'attaquer : ${E.WB_TRIES} essais par jour.</div><div class="hp"><i style="width:${p}%"></i></div>${live ? `<button class="btn primary sm go" data-act="wb-go">Attaquer le boss</button>` : ""}</div>`;
  }
  function onAnn(m) { const d = m.data || {}; load(true).then(() => { if (d.ev === "dead" && fxOn()) X().toast(`${E.wbDef(d.n || 1).name} est tombé : +${E.WB_KILL.xp} % d'XP pour tout le monde pendant ${E.WB_KILL.xpH} h !`, "rare"); }); }

  /* ---------- effet plein écran à l'arrivée d'un boss (E2) : une fois par joueur, jamais par-dessus le chat ouvert ---------- */
  function maybeOverlay() {
    const s = st(); if (!s || !S() || $(".wbo")) return;
    if ((pref.seen || 0) >= s.n || (S().sessions || 0) < 2) return; // pas pendant la toute première partie : il le verra à la suivante
    if (!fxOn()) { pref.seen = s.n; savePref(); return; }
    const a = document.activeElement;
    if ($("#chat.chat") || ($("#cele") && $("#cele").innerHTML.trim()) || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || ($("#sheet") && $("#sheet").innerHTML) || (window.DX.ui && window.DX.ui.watch)) { setTimeout(maybeOverlay, 15000); return; } // pas pendant un combat qu'on regarde
    pref.seen = s.n; savePref();
    const def = E.wbDef(s.n);
    const ch = [[18, 22, 30], [74, 18, -20], [12, 70, 60], [82, 66, -45], [30, 86, 15], [64, 84, -70], [44, 12, 80]].map(([x, y, r]) => `<span class="wbo-ch" style="left:${x}%;top:${y}%;--r:${r}deg"></span>`).join("");
    const o = document.createElement("div"); o.className = "wbo"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Nouveau boss des mondes");
    o.innerHTML = `${def.mon === "m8062" ? ch : ""}<div class="wbo-flash"></div><div class="wbo-in"><span class="wbo-k">Boss des mondes · nouveau boss</span><img class="wbo-boss" src="${img(def)}" alt=""><span class="wbo-t">${h(def.name)} ${h(def.line)}</span><span class="wbo-s">${h(def.story)}</span><div class="wbo-hp"><i style="width:${pctLeft(s)}%"></i></div><div class="row"><button class="btn primary" data-act="wb-go">Attaquer le boss</button><button class="btn" data-act="wb-ovclose">Plus tard</button></div><span class="xs wbo-n">Vu une seule fois · effets à couper dans Options</span></div>`;
    document.body.appendChild(o);
    setTimeout(() => o.classList.add("calm"), 3000);
  }
  const closeOverlay = () => { const o = $(".wbo"); if (o) o.remove(); };

  /* ---------- bandeaux du haut (E3) : boss en vie (phase, PV, Attaquer), puis bonus d'XP après sa mort ---------- */
  function paintBar() {
    let b = $("#wbbar");
    if (!b) { const up = $("#updbar"); if (!up) return; b = document.createElement("div"); b.id = "wbbar"; up.after(b); }
    const s = st(); const tab = window.DX && window.DX.ui ? window.DX.ui.tab : "";
    if (!s || !S() || (window.DX.ui && window.DX.ui.watch)) { b.innerHTML = ""; return; }
    const def = E.wbDef(s.n); let html = "";
    if (s.bonus > Date.now() && pref.xpbar !== s.bonus && s.last) html += `<div class="updbar wbbar xp">${X().IC("bonbon")}<span><b>${h(s.last.name)} est tombé !</b> +${E.WB_KILL.xp} % d'XP pour tout le monde, encore ${dur(s.bonus - Date.now())}.</span><button class="btn sm" data-act="wb-barclose" data-v="xp">Fermer</button></div>`;
    const key = `${s.n}:${s.phase}`;
    if (tab !== "wb" && pref.bar !== key) html += `<div class="updbar wbbar"><img class="b${an(s.phase)}" src="${img(def)}" alt=""><span><b>Boss des mondes : ${h(def.name)}</b> · phase ${s.phase}${s.phase > 1 ? ` (${h(phName(def, s.phase))})` : ""} <span class="mini"><i style="width:${pctLeft(s)}%"></i></span> ${pctTxt(pctLeft(s))}</span><button class="btn sm primary" data-act="wb-go">${mode() === "guest" ? "Voir" : "Attaquer"}</button><button class="btn sm" data-act="wb-barclose" data-v="${key}" aria-label="Fermer">✕</button></div>`;
    if (b.innerHTML !== html) b.innerHTML = html;
  }

  /* ---------- accueil et options ---------- */
  function tile() {
    const m = mode(); if (m === "guest" || !S() || !E.team(S()).length) return null;
    const s = st(); if (!s) return null; const tl = triesLeft(s); if (!tl) return null;
    const def = E.wbDef(s.n);
    return { ic: X().im(img(def), "ac-tm", def.name), t: "Boss des mondes", s: `${h(def.name)} · ${pctTxt(pctLeft(s))} de PV · ${tl} essai${tl > 1 ? "s" : ""}`, hot: true, act: `data-act="wb-go"`, badge: `<span class="tag">Attaquer</span>` };
  }
  const optHtml = () => `<section class="optsec"><div class="optsec-h"><b>Boss des mondes</b><span class="xs muted">annonces des boss qui touchent tout le serveur</span></div><label class="optline optchk"><span class="optname"><b>Effets du Boss des mondes</b><span class="xs muted">effet plein écran à l'arrivée d'un nouveau boss (une fois par boss) et portraits animés</span></span><input type="checkbox" data-act="wb-fx" ${fxOn() ? "checked" : ""}></label></section>`;

  /* ---------- actions ---------- */
  function act(a, t) {
    const d = t.dataset;
    switch (a) {
      case "wb-go": closeOverlay(); if (window.DX.ui.watch) X().watchStop(); window.DX.ui.tab = "wb"; X().closeSheet(); X().render(); window.scrollTo(0, 0); return;
      case "wb-attack": attack(); return;
      case "wb-again": { X().watchStop(); window.DX.ui.tab = "wb"; X().render(); attack(); return; }
      case "wb-rewatch": { const w = window.DX.ui.watch; if (!w || !w.ext) return; watch(w.ext.res); return; }
      case "wb-reload": load(true); return;
      case "wb-item": X().itemSheet(d.tpl); return;
      case "wb-buy": { const s = S(); if (!s) return; const r = E.wbBuy(s, d.tpl); if (r.err) { X().toast(r.err); return; } X().markDirty(); X().toast(`${window.DATA.ITEMS[d.tpl].name} : dans ton sac !`, "rare"); paint(); return; }
      case "wb-fx": pref.fx = !!t.checked; savePref(); paint(); return;
      case "wb-ovclose": closeOverlay(); return;
      case "wb-barclose": if (d.v === "xp") { const s = st(); pref.xpbar = s ? s.bonus : 0; } else pref.bar = d.v; savePref(); paintBar(); return;
    }
  }

  /* le boss se rafraîchit seul ; le bandeau suit les changements d'onglet */
  setTimeout(() => { if (mode() === "local") sync(); else load(true); }, 2500);
  setInterval(() => { try { if (document.hidden) return; if (mode() === "local") sync(); else load(true); } catch (e) { /* jamais bloquer */ } }, 120000);
  document.addEventListener("click", () => setTimeout(() => { try { paintBar(); maybeOverlay(); } catch (e) { /* jamais bloquer */ } }, 0));
  window.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeOverlay(); });

  window.WBUI = { render, act, card, onAnn, tile, optHtml, paintBar, ui, st };
})();
