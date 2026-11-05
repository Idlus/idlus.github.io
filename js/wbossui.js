/* ============================================================================
   BOSS DES MONDES — interface (0.1.49). Les règles et le combat sont dans js/wboss.js.
   Page Aventure › Boss des mondes : le boss, sa barre de PV commune (phases à 66 % et 33 %), tes essais du jour,
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
  const LOCAL_HP = 900; // version de test : un boss local tombe en quelques jours d'essais
  const ui = { info: null, at: 0, loading: false, busy: false, err: "", off: 0, shown: 0 };

  /* ---------- préférences de cet appareil : effets, boss déjà annoncé, bandeaux fermés, boss local ---------- */
  const LS = "idlus-wb";
  let pref = {}; try { pref = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { pref = {}; }
  const savePref = () => { try { localStorage.setItem(LS, JSON.stringify(pref)); } catch (e) { /* stockage indisponible */ } };
  const fxOn = () => pref.fx !== false;
  // portrait animé : il respire, plus vite en phase 2, enragé (aura rouge) en phase 3 ; coupé par l'option des effets
  const an = (ph) => (fxOn() ? ` wb-an wb-p${ph || 1}` : "");

  const mode = () => { const o = ON(); if (!o || !o.enabled) return "local"; return o.user && o.profile && !(o.solo && o.solo()) ? "acc" : "guest"; }; // 1.0.11 : partie solo = comme sans compte (on regarde, essai d'entraînement)
  const solo = () => { const o = ON(); return !!(o && o.user && o.solo && o.solo()); };
  const day = () => E.defiDay(Date.now());
  const nextMidnight = () => { const t = Date.now(), d = E.defiDay(t); let lo = t, hi = t + 90000000; while (hi - lo > 30000) { const m = (lo + hi) / 2; if (E.defiDay(m) > d) hi = m; else lo = m; } return hi; };
  const dur = (ms) => { const s = Math.max(0, ms / 1000); const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60); return d ? `${d} j ${hh} h` : hh ? `${hh} h ${String(mm).padStart(2, "0")}` : `${Math.max(1, mm)} min`; };
  const img = (def) => X().imgM(def.mon);
  const chest = (k) => X().chestImg(k.replace("coffre_", ""));
  const fragImg = (c = "wb-fi") => `<img class="${c}" src="${X().resImg(FRAG)}" alt="">`;
  const consTxt = (cons) => Object.entries(cons || {}).map(([k, q]) => `${q > 1 ? q + " " : ""}${(window.DATA.CONSUMABLES[k] || {}).name || k}${q > 1 ? "" : ""}`.replace(/^(\d+) Coffre/, "$1 Coffres")).join(", ");
  const ELC = { n: "neutre", t: "terre", f: "feu", e: "eau", a: "air" };

  // 2.2.8.6 : le Boss des mondes n'existe pas en Monocompte (window.WBUI y vaut null, les clics « wb-* » ne trouvent plus personne) : ni effet plein écran, ni bandeau, ni appel au serveur
  const off = () => { const o = ON(), s = S(); return !!((o && o.monoPart && o.monoPart()) || (s && E.isMono && E.isMono(s))); };
  const isS1 = () => !!(E.isS1c && S() && E.isS1c(S())); // Saison 1 : boss de la semaine (E.wbS1Def)
  const defOf = (n) => (isS1() ? E.wbS1Def(n) : E.wbDef(n));
  /* ---------- état du boss (serveur, ou boss local de la version de test) ---------- */
  function loc() {
    const L = pref.loc || (pref.loc = { n: 1, hp: LOCAL_HP, dmg: 0, started: Date.now(), day: day(), today: 0, pts: 0, best: 0, k: 0, bonus: 0, last: null });
    if (L.day !== day()) { L.day = day(); L.today = 0; }
    return L;
  }
  function st() {
    if (isS1()) return stS1();
    if (mode() === "local") {
      const L = loc(); const me = { today: L.today, pts: L.pts, best: L.best || null, rank: 1 };
      return { n: L.n, hp: L.hp, dmg: L.dmg, phase: E.wbPhase(L.dmg, L.hp), started: L.started, players: L.pts ? 1 : 0, top: L.pts ? [{ u: "me", p: "Toi", pts: L.pts, n: L.k, best: L.best }] : [], me, last: L.last, bonus: L.bonus, local: true };
    }
    const I = ui.info; if (!I) return null;
    return { n: I.n, hp: +I.hp, dmg: +I.dmg, phase: I.phase, started: Date.parse(I.started) - ui.off, players: I.players || 0, top: I.top || [], me: I.me, last: I.last, bonus: I.bonus ? Date.parse(I.bonus) - ui.off : 0 };
  }
  async function load(force) {
    const o = ON(); if (!o || !o.enabled || ui.loading || off()) return;
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
  const maxTries = (s) => (s && s.s1 ? (s.me && s.me.max) || E.wbS1Tries(s, Date.now()) : E.WB_TRIES);
  const triesLeft = (s) => (s && s.me ? Math.max(0, maxTries(s) - (s.me.today || 0)) : 0);
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
    if (isS1()) return s1Page();
    const s = st(); const m = mode();
    const top = `<div class="wb-top"><div><h1>Boss des mondes</h1><span class="small muted">Tout le serveur frappe le même boss. Quand ses PV tombent à zéro, le suivant arrive.</span></div><span class="tag boss">${m === "local" ? "Version de test : boss local" : "Tout le serveur"}</span></div>`;
    if (!s) return top + `<section class="panel wb-p"><p class="muted">${ui.err ? h(ui.err) + ` <button class="btn sm" data-act="wb-reload">Réessayer</button>` : "Chargement du boss…"}</p></section>`;
    const def = defOf(s.n);
    return top + heroHtml(s, def) + `<div class="wb-grid"><div class="stack" style="gap:14px">${gradesHtml(s)}${shopHtml(def)}${rotHtml(s)}</div><div class="stack" style="gap:14px">${lbHtml(s)}${killHtml(s, def)}</div></div>`;
  }
  function heroHtml(s, def) {
    const m = mode(); const tl = triesLeft(s); const ph = s.phase; const team = E.team(S()).length;
    const rate = s.dmg > 0 ? s.dmg / Math.max(60000, Date.now() - s.started) : 0;
    const eta = rate > 0 ? ` · au rythme actuel, il tombe dans environ ${dur(left(s) / rate)}` : "";
    const next = defOf(s.n + 1);
    const side = m === "guest"
      ? solo() ? `<span class="small"><b>Partie solo</b> : le boss des mondes se joue avec ta partie 1. Ici, tu peux regarder le boss et le classement.</span><button class="btn primary" data-act="sv-menu">Changer de partie</button><button class="btn sm" data-act="wb-attack" ${team ? "" : "disabled"}>Essai d'entraînement (non compté)</button>`
      : `<span class="small"><b>Sans compte</b>, tu peux regarder le boss et le classement.</span><button class="btn primary" data-act="on-loginscreen">Créer un compte pour frapper</button><button class="btn sm" data-act="wb-attack" ${team ? "" : "disabled"}>Essai d'entraînement (non compté)</button>`
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
  function noteHtml(s) {
    const t = E.team(S());
    const lv = t.length ? Math.round(t.reduce((a, x) => a + (x.lvl || 1), 0) / t.length) : 0;
    return `<p class="small wb-note"><b>Ton niveau, ton équipement et le nombre de héros comptent.</b>${t.length ? ` Ton équipe : ${t.length} héros, niveau moyen ${lv}.` : ""} Avec 8 héros bien équipés, on vise B au niveau 60, A vers 80-100, S vers 120-160 et SSS au niveau 200. Avec moins de héros, le boss encaisse mieux.</p>`;
  }
  function gradesHtml(s) {
    const on = s.me && s.me.best ? gradeOf(s.me.best) : "";
    return `<section class="panel wb-p"><h3>Grade de chaque essai</h3>
      <p class="small muted" style="margin:0 0 8px">Chaque essai joue ${E.WB_FIGHTS} combats de ${E.WB_ROUNDS} tours : leurs dégâts s'additionnent. Plus le total est haut, plus le grade est haut. Le coffre arrive tout de suite dans ton sac.</p>
      ${noteHtml(s)}
      <div class="wb-grades">${E.WB_GRADES.slice().reverse().map((g) => { const [k, q] = Object.entries(g.cons)[0]; return `<div class="wb-gr ${g.g === on ? "on" : ""}"><span class="L g-${g.g}">${g.g}</span>${chest(k)}<b>${g.min ? nf(g.min * E.WB_PV) + " PV" : "moins de " + nf(E.WB_GRADES[E.WB_GRADES.length - 2].min * E.WB_PV)}</b><span class="muted">${q > 1 ? q + " × " : ""}${h(window.DATA.CONSUMABLES[k].name)}<br>+${g.frag} Fragment${g.frag > 1 ? "s" : ""}</span></div>`; }).join("")}</div></section>`;
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
    for (let i = 0; i < 6; i++) { const d = defOf(s.n + i); L.push({ d, cls: i === 0 ? "now" : i === 1 ? "next" : "mys" }); }
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
    if (m === "local") { if (isS1()) s1LocalAttack(); else localAttack(s); return; }
    ui.busy = true; paint();
    try { await X().onPush(); } catch (e) { /* le serveur rejoue avec la partie en ligne */ }
    const R = await ON().submitGuild({ wboss: 1 });
    ui.busy = false;
    if (R.net) { X().toast("Pas de connexion au serveur : réessaie dans un moment."); paint(); return; }
    if (!R.ok) { X().toast(R.err || "Refusé par le serveur."); load(true); return; }
    if (E.sabEarn) E.sabEarn(S(), "wb"); // Plus de Sablier (3B) : +30 min par essai
    if (window.MARKET) { try { await window.MARKET.sync(); } catch (e) { /* les coffres arriveront à la prochaine synchro */ } }
    load(true);
    watch(Object.assign({ dmg0: R.before != null ? R.before : Math.max(0, R.dmg - R.points) }, R));
  }
  function train(s) {
    const seed = (Date.now() >>> 0) || 1; const def = defOf(s.n);
    const r = E.wbSim(S(), def, s.phase, seed); if (r.err) { X().toast(r.err); return; }
    watch(Object.assign({ train: true, n: s.n, seed, phase: s.phase, name: def.name, hp: s.hp, dmg0: s.dmg, dmg: s.dmg }, r));
  }
  function localAttack() {
    const s = S(); const L = loc(); const def = defOf(L.n); const phase = E.wbPhase(L.dmg, L.hp); const seed = E.wbSeed(L.n, "local", L.k);
    const r = E.wbSim(s, def, phase, seed); if (r.err) { X().toast(r.err); return; }
    const G = E.wbGrade(r.points);
    for (const k in G.cons) E.addCons(s, k, G.cons[k]);
    if (E.sabEarn) E.sabEarn(s, "wb");
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
    const s = S(); const def = defOf(R.n);
    const W = E.wbWatch(s, def, R.phase, R.watchSeed || R.seed); if (W.err) { X().toast(W.err); return; }
    X().extWatchStart(W, { step: E.wbWatchStep, html: watchHtml, head: watchHead, end: watchEnd, back: "wb", res: R, def });
  }
  /* points des combats de l'essai qu'on ne regarde pas (« Revoir le combat » montre l'un des 3) */
  function others(R) { const F = R.fights || []; const i = F.findIndex((f) => f.seed === (R.watchSeed || R.seed)); return i < 0 ? 0 : Math.max(0, R.points - F[i].points); }
  function livePts(W) { const B = W.B; return Math.round((Math.max(0, B.hpMax - Math.max(0, B.hp)) / W.base) * 100 * (W.def.pow || 1) * E.wbMult(W.lvl || 1, W.n || 1)); } // même calcul que E.wbResult
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
    const pts = W.done ? R.points : others(R) + livePts(W); const g = gradeOf(pts); // les 2 autres combats + celui qu'on regarde
    const room = $("#wroom"); if (room) room.textContent = `· tour ${Math.min(F.round || 1, E.WB_ROUNDS)} sur ${E.WB_ROUNDS}`;
    const rest = Math.max(0, R.hp - R.dmg0 - pts);
    const bar = $("#wbwHp"); if (bar) bar.style.width = `${(rest / R.hp) * 100}%`;
    const tx = $("#wbwTxt"); if (tx) tx.textContent = `${nf(rest * E.WB_PV)} PV · ${pctTxt((rest / R.hp) * 100)}`;
    const dm = $("#wbwDmg"); if (dm) dm.innerHTML = `Dégâts de ${R.fights ? `tes ${R.fights.length} combats` : "ton équipe"} : <b>${nf(pts * E.WB_PV)} PV</b>`;
    const ge = $("#wbwG"); if (ge && ge.textContent !== g) { ge.textContent = g; ge.className = `wbw-g g-${g} up`; }
  }
  function watchEnd(w) {
    const R = w.ext.res, def = w.ext.def; const G = E.wbGrade(R.points); const i = E.WB_GRADES.indexOf(G); const up = i > 0 ? E.WB_GRADES[i - 1] : null;
    const s = st(); const tl = R.left != null ? Math.max(0, R.left) : s ? triesLeft(s) : 0; // le serveur sait combien il en reste, même avant le rechargement
    const why = R.alive ? `${R.rounds} tours joués` : `ton équipe est tombée au tour ${R.rounds}`;
    const tip = up ? `Au grade ${up.g}, il te manquait ${nf((up.min - R.points) * E.WB_PV)} PV. ` : "";
    const le = (k) => `${{ t: "la ", a: "l'", e: "l'" }[k] || "le "}${E.wbElName(k)}`; const w2 = le(def.weak); // 1.0.12.8 : « Le Feu », « La Terre », « L'Air » (avant : « L'Feu »)
    const el2 = `${w2[0].toUpperCase() + w2.slice(1)} fait +50 % sur lui, ${le(def.res)} seulement la moitié.`;
    if (R.train) return `<div class="wb-res"><span class="xs muted">Essai d'entraînement · ${why}</span><div class="big g-${G.g}">${G.g}</div><div class="dmg">${nf(R.pv)} PV de dégâts</div>
      <p class="small muted">${solo() ? "Rien n'est compté dans une partie solo." : "Rien n'est compté sans compte."} ${tip}${el2}</p>
      <div class="row" style="gap:8px;justify-content:center"><button class="btn" data-act="wb-rewatch">Revoir le combat</button>${solo() ? `<button class="btn primary" data-act="sv-menu">Changer de partie</button>` : `<button class="btn primary" data-act="on-loginscreen">Créer un compte pour frapper</button>`}<button class="btn" data-act="sm-wquit">Retour</button></div></div>`;
    const ch = Object.entries(R.cons || {})[0] || ["coffre_bois", 1];
    const kill = R.killed ? `<div class="wb-killed">${confetti()}<b>Tu as porté le dernier coup : ${h(def.name)} est tombé !</b><br><span class="small">Coffre en or, Fragments et bonus d'XP pour tout le monde. Le boss suivant arrive.</span></div>` : "";
    return `<div class="wb-res">${kill}<span class="xs muted">${R.local ? "Version de test · " : ""}Essai ${E.WB_TRIES - (R.left || 0)} sur ${E.WB_TRIES} · ${h(def.name)} · phase ${R.phase} · ${why}</span>
      <div class="big g-${G.g}">${G.g}</div><div class="dmg">${nf(R.pv)} PV de dégâts</div>${R.fights ? `<div class="wb-fights"><span class="xs muted">Total de tes ${R.fights.length} combats (le combat montré est l'un d'eux) :</span>${R.fights.map((f, i) => `<span class="tag soft">Combat ${i + 1} · ${nf(f.points * E.WB_PV)} PV${f.alive ? "" : ` · tombés au tour ${f.rounds}`}</span>`).join("")}</div>` : ""}<span class="small muted">soit ${pctTxt((R.points / R.hp) * 100)} de ses PV${R.rank ? ` · tu es ${R.rank}<sup>${R.rank === 1 ? "er" : "e"}</sup> au classement` : ""}</span><br>
      <div class="chest">${chest(ch[0])}<span style="text-align:left"><b>${h(consTxt(R.cons))}</b><br><span class="xs muted">dans ton sac</span></span>${fragImg()}<span style="text-align:left"><b>+${R.frag} Fragment${R.frag > 1 ? "s" : ""}</b><br><span class="xs muted">${nf(E.wbFrags(S()))} au total</span></span></div>
      ${R.killed ? "" : `<div class="wb-hp" style="margin:6px 0 10px"><i style="width:${(Math.max(0, R.hp - R.dmg) / R.hp) * 100}%"></i><b>Il lui reste ${pctTxt((Math.max(0, R.hp - R.dmg) / R.hp) * 100)}</b></div>`}
      <p class="small muted">${tip}${el2}</p>
      <div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn" data-act="usecons" data-id="${ch[0]}">Ouvrir le coffre</button><button class="btn" data-act="wb-rewatch">Revoir le combat</button>${tl ? `<button class="btn primary" data-act="wb-again">Encore ${tl} essai${tl > 1 ? "s" : ""}</button>` : ""}<button class="btn" data-act="sm-wquit">Retour</button></div></div>`;
  }
  function confetti() { const c = ["#f1cf6e", "#e2533b", "#9fd84a", "#6cb6ff", "#c45cff"]; let s = ""; for (let i = 0; i < 14; i++) s += `<i class="cf" style="left:${i < 7 ? i * 14 + 2 : (i - 7) * 14 + 4}%;top:${i < 7 ? 2 + (i % 2) * 4 : 86 + (i % 2) * 5}%;background:${c[i % 5]};transform:rotate(${i * 41}deg)"></i>`; return s; }

  /* ---------- carte du chat Général (E1, E4) ---------- */
  function card(m) {
    const d = m.data || {}; const def = defOf(d.n || 1); const s = st(); const live = s && s.n === d.n;
    if (d.ev === "ph") return `<div class="ann-wb ph"><img class="b${live ? an(d.ph) : ""}" src="${img(def)}" alt=""><div><div class="k">Phase ${d.ph} · ${d.ph === 2 ? 66 : 33} %</div><div class="t">${h(def.name)} : ${h(phName(def, d.ph))} ! Il ${d.ph === 2 ? "frappe 30 % plus fort" : "est enragé et subit 25 % de dégâts en plus"}.</div></div>${live ? `<button class="btn sm go" data-act="wb-go">Attaquer le boss</button>` : ""}</div>`;
    if (d.ev === "fled") return `<div class="ann-wb old"><img class="b" src="${img(def)}" alt=""><div><div class="k">Boss des mondes · fin de semaine</div><div class="t">${h(def.name)} s'est enfui à ${100 - (d.pct || 0)} % de vie.</div></div><div class="s">${d.players || 0} joueur${d.players > 1 ? "s l'ont" : " l'a"} frappé : les paliers atteints restent acquis. Ses PV s'ajustent pour le prochain.</div></div>`;
    if (d.ev === "dead" && d.s1) {
      const next = defOf((d.n || 1) + 1);
      return `<div class="ann-wb dead">${confetti()}<img class="b" src="${img(def)}" alt=""><div><div class="k">Boss de la semaine vaincu${d.dur ? ` · ${dur(d.dur * 1000)}` : ""}</div><div class="t">${h(def.name)} est tombé !</div></div>
        <div class="s">Dernier coup : <b>${h(m.pseudo || "?")}</b>. ${d.players || ""} joueur${d.players > 1 ? "s reçoivent" : " reçoit"} le coffre du palier 100 %. <b>+${E.WB_KILL.xp} % d'XP pour tout le monde pendant ${E.WB_KILL.xpH} h.</b></div><div class="s muted">La semaine prochaine : ${h(next.name)}.</div></div>`;
    }
    if (d.ev === "dead") {
      const top = (d.top || []).slice(0, 3).map((p, i) => `<span>${["🥇", "🥈", "🥉"][i]} ${h(p)}</span>`).join("");
      const next = defOf((d.n || 1) + 1);
      return `<div class="ann-wb dead">${confetti()}<img class="b" src="${img(def)}" alt=""><div><div class="k">Boss des mondes vaincu${d.dur ? ` · ${dur(d.dur * 1000)}` : ""}</div><div class="t">${h(def.name)} est tombé !</div></div>
        <div class="s">Dernier coup : <b>${h(m.pseudo || "?")}</b>. ${d.players || ""} joueur${d.players > 1 ? "s reçoivent" : " reçoit"} un Coffre en or${d.n === 1 ? " et le titre « Briseur de Titan »" : ""}. <b>+${E.WB_KILL.xp} % d'XP pour tout le monde pendant ${E.WB_KILL.xpH} h.</b></div>${top ? `<div class="top">${top}</div>` : ""}<div class="s muted">${h(next.name)} arrive…</div></div>`;
    }
    const p = live ? pctLeft(s) : s && s.n > d.n ? 0 : 100;
    return `<div class="ann-wb${live ? "" : " old"}"><img class="b${live ? an(s.phase) : ""}" src="${img(def)}" alt=""><div><div class="k">Boss des mondes</div><div class="t">${h(def.name)} ${h(def.line)}</div></div><div class="s">${h(def.story)} Tout le serveur peut l'attaquer : ${E.WB_TRIES} essais par jour.</div><div class="hp"><i style="width:${p}%"></i></div>${live ? `<button class="btn primary sm go" data-act="wb-go">Attaquer le boss</button>` : ""}</div>`;
  }
  function onAnn(m) { const d = m.data || {}; if (d.ev === "dead" && window.DX && window.DX.fanPlay) window.DX.fanPlay("boss"); load(true).then(() => { if (d.ev === "dead" && fxOn()) X().toast(`${defOf(d.n || 1).name} est tombé : +${E.WB_KILL.xp} % d'XP pour tout le monde pendant ${E.WB_KILL.xpH} h !`, "rare"); }); }

  /* ---------- effet plein écran à l'arrivée d'un boss (E2) : une fois par joueur, jamais par-dessus le chat ouvert ---------- */
  function maybeOverlay() {
    if (off()) { closeOverlay(); return; }
    const s = st(); if (!s || !S() || $(".wbo")) return;
    if ((pref.seen || 0) >= s.n || (S().sessions || 0) < 2) return; // pas pendant la toute première partie : il le verra à la suivante
    if (!fxOn()) { pref.seen = s.n; savePref(); return; }
    const a = document.activeElement;
    if ($("#chat.chat") || ($("#cele") && $("#cele").innerHTML.trim()) || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || ($("#sheet") && $("#sheet").innerHTML) || (window.DX.ui && window.DX.ui.watch)) { setTimeout(maybeOverlay, 15000); return; } // pas pendant un combat qu'on regarde
    pref.seen = s.n; savePref();
    const def = defOf(s.n);
    const ch = [[18, 22, 30], [74, 18, -20], [12, 70, 60], [82, 66, -45], [30, 86, 15], [64, 84, -70], [44, 12, 80]].map(([x, y, r]) => `<span class="wbo-ch" style="left:${x}%;top:${y}%;--r:${r}deg"></span>`).join("");
    const o = document.createElement("div"); o.className = "wbo"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Nouveau boss des mondes");
    o.addEventListener("click", (ev) => { const b = ev.target.closest("[data-act]"); if (!b || !o.contains(b)) return; ev.stopPropagation(); act(b.dataset.act, b); }); // 2.2.8.6 : les boutons répondent même sans le routeur de js/ui.js
    o.innerHTML = `${def.mon === "m8062" ? ch : ""}<div class="wbo-flash"></div><div class="wbo-in"><span class="wbo-k">Boss des mondes · nouveau boss</span><img class="wbo-boss" src="${img(def)}" alt=""><span class="wbo-t">${h(def.name)} ${h(def.line)}</span><span class="wbo-s">${h(def.story)}</span><div class="wbo-hp"><i style="width:${pctLeft(s)}%"></i></div><div class="row"><button class="btn primary" data-act="wb-go">Attaquer le boss</button><button class="btn" data-act="wb-ovclose">Plus tard</button></div><span class="xs wbo-n">Vu une seule fois · effets à couper dans Options</span></div>`;
    document.body.appendChild(o);
    setTimeout(() => o.classList.add("calm"), 3000);
  }
  const closeOverlay = () => { const o = $(".wbo"); if (o) o.remove(); };

  /* ---------- bandeaux du haut (E3) : boss en vie (phase, PV, Attaquer), puis bonus d'XP après sa mort ---------- */
  function paintBar() {
    let b = $("#wbbar");
    if (!b) { const up = $("#updbar"); if (!up) return; b = document.createElement("div"); b.id = "wbbar"; up.after(b); }
    const s = off() ? null : st(); const tab = window.DX && window.DX.ui ? window.DX.ui.tab : "";
    if (!s || !S() || (window.DX.ui && window.DX.ui.watch)) { b.innerHTML = ""; return; }
    const def = defOf(s.n); let html = "";
    const C = X().tchip; // 1.0.4.7 : même pastille que le reste de la ligne du haut
    if (s.bonus > Date.now() && pref.xpbar !== s.bonus && s.last) html += C({ k: "bonus", ico: X().IC("bonbon"), t: `${h(s.last.name)} vaincu`, d: `+${E.WB_KILL.xp} % XP · ${dur(s.bonus - Date.now())}`, s: `+${E.WB_KILL.xp} % · ${dur(s.bonus - Date.now())}`, tip: `${s.last.name} est tombé ! +${E.WB_KILL.xp} % d'XP pour tout le monde, encore ${dur(s.bonus - Date.now())}.`, x: `data-act="wb-barclose" data-v="xp"` });
    const key = `${s.n}:${s.phase}`;
    if (tab !== "wb" && pref.bar !== key) html += C({ k: "boss", ico: `<img class="b${an(s.phase)}" src="${img(def)}" alt="">`, t: h(def.name), d: `phase ${s.phase}`, bar: pctLeft(s), v: pctTxt(pctLeft(s)), go: `data-act="wb-go"`, tip: `Boss des mondes : ${def.name} · phase ${s.phase}${s.phase > 1 ? ` (${phName(def, s.phase)})` : ""}`, act: `<button class="tc-act" data-act="wb-go">${mode() === "guest" ? "Voir" : "Attaquer"}</button>`, x: `data-act="wb-barclose" data-v="${key}"` });
    if (b.innerHTML !== html) b.innerHTML = html;
  }

  /* ---------- accueil et options ---------- */
  function tile() {
    const m = mode(); if (m === "guest" || !S() || !E.team(S()).length) return null;
    const s = st(); if (!s) return null; const tl = triesLeft(s); if (!tl) return null;
    const def = defOf(s.n);
    return { ic: X().im(img(def), "ac-tm", def.name), t: "Boss des mondes", s: `${h(def.name)} · ${pctTxt(pctLeft(s))} de PV · ${tl} essai${tl > 1 ? "s" : ""}`, hot: true, act: `data-act="wb-go"`, badge: `<span class="tag">Attaquer</span>` };
  }
  const optHtml = () => `<section class="optsec"><div class="optsec-h"><b>Boss des mondes</b><span class="xs muted">annonces des boss qui touchent tout le serveur</span></div><label class="optline optchk"><span class="optname"><b>Effets du Boss des mondes</b><span class="xs muted">effet plein écran à l'arrivée d'un nouveau boss (une fois par boss) et portraits animés</span></span><input type="checkbox" data-act="wb-fx" ${fxOn() ? "checked" : ""}></label></section>`;

  /* ---------- actions ---------- */
  function act(a, t) {
    const d = t.dataset;
    switch (a) {
      case "wb-go": closeOverlay(); if (window.DX.ui.watch) X().watchStop(); window.DX.ui.tab = "wb"; X().closeSheet(); X().render(); window.scrollTo(0, 0); return;
      case "wb-attack": attack(); return;
      case "wb-train": { const s = st(); if (s) train(s); return; }
      case "wb-tab": ui.s1tab = d.v; paint(); return;
      case "wb-s1item": X().itemSheet(d.tpl); return;
      case "wb-s1buy": { const s = S(); if (!s) return; const r = E.wbS1Buy(s, d.k, d.tpl); if (r.err) { X().toast(r.err); return; } X().markDirty(); X().toast(r.ap ? `${(AP()[r.ap] || {}).name} : dans ta Garde-robe !` : r.cons ? "Dans ton sac !" : `${window.DATA.ITEMS[d.tpl].name} : dans ton sac !`, "rare"); paint(); return; }
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
  setTimeout(() => { if (off()) return; if (mode() === "local") sync(); else load(true); }, 2500);
  setInterval(() => { try { if (document.hidden || off()) return; if (mode() === "local") sync(); else load(true); } catch (e) { /* jamais bloquer */ } }, 120000);
  document.addEventListener("click", () => setTimeout(() => { try { paintBar(); maybeOverlay(); } catch (e) { /* jamais bloquer */ } }, 0));
  window.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeOverlay(); });

  /* ===================== SAISON 1 (refonte du 03/11/2026, js/wboss.js E.WB_S1) =====================
     Une page à 3 onglets (12A) : Le boss (semaine, paliers du serveur, mécanique, calendrier), Boutique d'anomalie, Classement
     (paliers d'essais et podium du meilleur essai). Version de test : un boss local par semaine de saison sur cet appareil. */
  const C1 = () => E.WB_S1;
  const tabS1 = () => ui.s1tab || "boss";
  function locS1() {
    const w = E.s1cWeek(S()); const L = pref.loc1 || (pref.loc1 = { n: w, hp: 2000, dmg: 0, started: Date.now(), day: day(), today: 0, week: 0, pts: 0, best: 0, k: 0, pal: [], tiers: [], cap: 0, last: null });
    if (L.day !== day()) { L.day = day(); L.today = 0; }
    if (L.n !== w) { const cap = L.cap; L.last = { n: L.n, name: E.wbS1Def(L.n).name, fled: L.dmg < L.hp }; Object.assign(L, { n: w, hp: Math.max(2000, Math.round(0.7 * (cap || 2000) * 1.2)), dmg: 0, started: Date.now(), week: 0, pts: 0, best: 0, k: 0, pal: [], tiers: [], cap: 0 }); savePref(); }
    return L;
  }
  const weekEnd = (n) => E.s1cT0(S()) + n * C1().week;
  function stS1() {
    if (mode() === "local") { const L = locS1(); return { s1: true, n: L.n, hp: L.hp, dmg: L.dmg, phase: E.wbPhase(L.dmg, L.hp), started: L.started, ends: weekEnd(L.n), killed: L.dmg >= L.hp, players: L.k ? 1 : 0,
      top: L.best ? [{ u: "me", p: "Toi", best: L.best, n: L.week, pts: L.pts }] : [], me: { today: L.today, week: L.week, pts: L.pts, best: L.best || null, rank: L.best ? 1 : null, tiers: L.tiers }, last: L.last, bonus: 0, local: true }; }
    const I = ui.info; if (!I) return null;
    return { s1: true, n: I.n, hp: +I.hp, dmg: +I.dmg, phase: I.phase, started: Date.parse(I.started) - ui.off, ends: Date.parse(I.ends) - ui.off, killed: !!I.killed, players: I.players || 0, top: I.top || [], me: I.me, last: I.last, bonus: I.bonus ? Date.parse(I.bonus) - ui.off : 0 };
  }
  const tierOf = (n) => E.wbS1Tier(n || 0);
  function s1Page() {
    const s = st(); const m = mode(); const t = tabS1();
    const tabs = `<div class="wbs-tabs">${[["boss", "Le boss"], ["shop", "Boutique d'anomalie"], ["lb", "Classement"]].map(([k, n]) => `<button class="btn sm ${t === k ? "primary" : ""}" data-act="wb-tab" data-v="${k}">${n}</button>`).join("")}<span class="wb-frag" style="margin-left:auto">${fragImg()} ${nf(E.wbFrags(S()))} Fragments d'anomalie</span></div>`;
    const top = `<div class="wb-top"><div><h1>Boss des mondes</h1><span class="small muted">Un grand boss par semaine pour tout le serveur. Abattez-le avant qu'il ne s'enfuie.</span></div><span class="tag boss">${m === "local" ? "Version de test : boss local" : "Saison 1 · tout le serveur"}</span></div>`;
    if (!s) return top + `<section class="panel wb-p"><p class="muted">${ui.err ? h(ui.err) + ` <button class="btn sm" data-act="wb-reload">Réessayer</button>` : "Chargement du boss…"}</p></section>`;
    const def = E.wbS1Def(s.n);
    if (t === "shop") return top + tabs + s1Shop(s);
    if (t === "lb") return top + tabs + `<div class="wb-grid"><div class="stack" style="gap:14px">${s1Tiers(s, def)}</div><div class="stack" style="gap:14px">${s1Podium(s, def)}</div></div>`;
    return top + tabs + s1Hero(s, def) + `<div class="wb-grid"><div class="stack" style="gap:14px">${s1Mech(def)}${gradesHtml(s)}${s1Cal(s)}</div><div class="stack" style="gap:14px">${s1Tiers(s, def)}${s1Pal(s)}</div></div>`;
  }
  function s1Bar(s) {
    const p = pctLeft(s); const done = 100 - p;
    const marks = [25, 50, 75].map((q) => `<span class="wb-mark" style="left:${100 - q}%"></span><img class="wbp-ch ${done >= q ? "ok" : ""}" style="left:${100 - q}%" src="assets/ui/coffres/${q === 25 ? "argent" : "or"}.svg" alt="">`).join("") + `<img class="wbp-ch end ${s.killed ? "ok" : ""}" src="assets/ui/coffres/douze.svg" alt="">`;
    return `<div class="wb-hp wbp-hp"><i style="width:${p}%"></i>${marks}<b>${nf(left(s) * E.WB_PV)} / ${nf(s.hp * E.WB_PV)} PV · ${pctTxt(p)}</b></div>`;
  }
  /* « Dernier soir » : bandeau le dernier jour de la semaine (Mathis 03/11) */
  function s1Night(s) {
    const N = E.WB_S1.night; const now = Date.now(); if (s.killed || !E.wbS1LastDay(s.ends, now)) return "";
    const low = s.dmg * 100 >= s.hp * N.pct;
    if (E.wbS1Night(s, now)) return `<span class="tag wbp-night on">Dernier soir : +1 essai pour tout le monde jusqu'à ${N.h1} h. Achevez-le avant sa fuite !</span>`;
    return `<span class="tag wbp-night">Dernier soir ce soir de ${N.h0} h à ${N.h1} h : ${low ? "il est sous 25 %, chacun recevra +1 essai" : `s'il passe sous ${100 - N.pct} % de vie, chacun recevra +1 essai`}.</span>`;
  }
  function s1Hero(s, def) {
    const m = mode(); const tl = triesLeft(s); const team = E.team(S()).length; const me = s.me || {};
    const pal = [25, 50, 75, 100].filter((q) => (s.dmg / s.hp) * 100 >= q).length;
    const left1 = Math.max(0, s.ends - Date.now());
    const side = m === "guest" ? `<span class="small"><b>${solo() ? "Partie solo" : "Sans compte"}</b> : tu peux regarder le boss et t'entraîner.</span>${solo() ? `<button class="btn primary" data-act="sv-menu">Changer de partie</button>` : `<button class="btn primary" data-act="on-loginscreen">Créer un compte pour frapper</button>`}`
      : `<span class="small"><b>${tl} essai${tl > 1 ? "s" : ""} sur ${maxTries(s)}</b> aujourd'hui</span><div class="wb-pips">${Array.from({ length: maxTries(s) }, (_, i) => `<i class="${i < tl ? "on" : ""}"></i>`).join("")}</div>
        <button class="btn primary" data-act="wb-attack" ${tl && team && !ui.busy ? "" : "disabled"}>${X().IC("combat")} ${ui.busy ? "Le serveur joue ton essai…" : s.killed ? "Frapper encore (grades et paliers)" : "Attaquer le boss"}</button>
        <span class="xs muted">${tl ? "3 combats de 15 tours avec ton équipe active" : `Nouveaux essais dans ${dur(nextMidnight() - Date.now())}`}</span>
        <div class="wb-me">Tes dégâts : <b>${nf((me.pts || 0) * E.WB_PV)} PV</b>${me.best ? `<br>Meilleur essai : <b>${nf(me.best * E.WB_PV)} PV</b>, grade <b class="g g-${gradeOf(me.best)}">${gradeOf(me.best)}</b>${me.rank ? ` · ${me.rank}<sup>${me.rank === 1 ? "er" : "e"}</sup>` : ""}` : "<br>Pas encore d'essai cette semaine"}</div>`;
    return `<section class="panel wb-hero"><div class="wb-img"><img class="${an(s.phase).trim()}" src="${img(def)}" alt=""></div><div class="wb-mid">
      <span class="tag wbp-wk">Boss de la semaine · semaine ${s.n} sur ${C1().weeks} · manche ${Math.min(4, Math.ceil(s.n / 2))}${def.pass > 1 ? " · il revient plus fort" : ""}</span>
      <span class="small">${s.killed ? `<b>Abattu !</b> Les essais comptent encore pour les grades et tes paliers jusqu'à la fin de la semaine (${dur(left1)}).` : `<b>Il s'enfuit dans ${dur(left1)}</b>. Ses PV ont été fixés d'après la semaine passée.`}</span>
      <span class="wb-name">${h(def.name)}</span><div class="row" style="gap:6px;flex-wrap:wrap">${el(def.weak, `Faible : ${E.wbElName(def.weak)} +50 %`)}${el(def.res, `Résiste : ${E.wbElName(def.res)} −50 %`)}</div>
      ${s1Night(s)}${s1Bar(s)}<span class="small muted">${h(def.story)} ${s.players} joueur${s.players > 1 ? "s l'ont" : " l'a"} frappé · ${pal} palier${pal > 1 ? "s" : ""} du serveur sur 4.</span>
      ${m === "local" ? `<span class="xs muted">Version de test : pas de serveur, ce boss n'existe que sur cet appareil.</span>` : ""}</div>
      <div class="wb-side">${team ? side : `<span class="small">Il faut au moins un héros dans l'équipe active.</span>`}${team ? `<button class="btn sm" data-act="wb-train">Entraînement (non compté)</button>` : ""}</div></section>`;
  }
  function s1Mech(def) {
    const BM = E.BOSS_MECHS || {}; const sig = BM[def.sig] || {};
    const others = def.mech.filter((k) => k !== def.sig).map((k) => `<span class="tag soft" title="${h((BM[k] || {}).desc || "")}">${h((BM[k] || {}).name || k)}${k === def.more ? " · nouveau" : ""}</span>`).join("");
    return `<section class="panel wb-p"><h3>Sa mécanique de la semaine</h3><div class="wbp-mech"><span class="wbp-mi">${X().IC("couronne")}</span><div><b>${h(def.sigName || sig.name || "")}</b><p class="small" style="margin:2px 0">${h(sig.desc || "")}</p>${sig.tip ? `<p class="small wbp-ok" style="margin:0"><b>Conseil</b> : ${h(sig.tip)}.</p>` : ""}</div></div>
      ${others ? `<div class="wbp-int"><span class="xs muted">Il a aussi :</span>${others}</div>` : ""}<div class="wb-phases" style="margin-top:8px"><span>Phase 2 sous 66 % : ${phTxt(2)}</span><span>Phase 3 sous 33 % : ${phTxt(3)}</span></div>
      <p class="xs muted" style="margin:6px 0 0">Ses coups sont annoncés pendant le combat. L'entraînement permet de tester ton équipe contre lui sans dépenser d'essai.</p></section>`;
  }
  function s1Cal(s) {
    return `<section class="panel wb-p"><h3>Les ${C1().weeks} boss de la Saison 1</h3><p class="small muted" style="margin:0 0 8px">Un boss par semaine. Les trois derniers reviennent avec une mécanique en plus.</p>
      <div class="wb-rot">${C1().rot.map((k, i) => { const d = E.wbS1Def(i + 1); const cls = i + 1 < s.n ? "dead" : i + 1 === s.n ? "now" : "next"; return `<div class="wb-rc ${cls}"><img src="${img(d)}" alt=""><b>${h(d.name)}</b><span class="${cls === "now" ? "" : "muted"}">${cls === "dead" ? "Passé" : cls === "now" ? "Cette semaine" : "Semaine " + (i + 1)}</span>${d.pass > 1 ? `<span class="tag wbp-new">retour</span>` : ""}</div>`; }).join("")}</div></section>`;
  }
  function s1Tiers(s, def) {
    const n = (s.me && s.me.week) || 0; const got = (s.me && s.me.tiers) || [];
    const R = { bronze: "Coffre en argent", argent: "Coffre en or + 3 Fragments", or: `Coffre en or, 5 Fragments et le titre « Chasseur de ${def.name} »` };
    return `<section class="panel wb-p"><h3>Ta contribution</h3><p class="xs muted" style="margin:0 0 6px">Des paliers que chacun peut atteindre : ils comptent tes essais de la semaine, pas tes dégâts.</p>
      <div class="wbp-tiers">${C1().tiers.map((t) => `<div class="wbp-t ${got.includes(t.id) || n >= t.k ? "ok" : ""}"><b>${t.n}</b><span class="xs">${t.k} essais</span><span class="xs muted">${h(R[t.id])}</span></div>`).join("")}</div>
      <div class="wbp-tb"><i style="width:${Math.min(100, (n / 18) * 100)}%"></i><b>${n} essai${n > 1 ? "s" : ""} sur 18 cette semaine</b></div></section>`;
  }
  function s1Podium(s, def) {
    const me = mode() === "acc" ? ON().user.id : "me";
    const rows = (s.top || []).map((r, i) => `<div class="wb-row ${r.u === me ? "me" : ""}"><span class="n">${i + 1}</span><span class="grow"><b>${h(r.p || "?")}</b><span class="xs muted">${r.n} essai${r.n > 1 ? "s" : ""} cette semaine</span></span><span class="small">${nf(r.best * E.WB_PV)} PV</span><b class="wb-lg g-${gradeOf(r.best)}">${gradeOf(r.best)}</b></div>`).join("");
    const last = s.last ? `<p class="xs muted" style="margin:8px 0 0">Semaine passée : ${h(s.last.name)} ${s.last.fled ? "s'est enfui" : "est tombé"}.</p>` : "";
    return `<section class="panel wb-p"><h3>Meilleur essai de la semaine</h3><p class="xs muted" style="margin:0 0 6px">Le podium compte ton meilleur essai, pas le nombre d'essais. À la fin de la semaine, les 3 premiers gagnent 30 Fragments et le titre « Fléau des mondes ».</p>${rows || `<p class="small muted">Personne ne l'a encore frappé.</p>`}${last}</section>`;
  }
  function s1Pal(s) {
    const done = (s.dmg / s.hp) * 100;
    const P = C1().pal.map((x) => { const ok = done >= x.p; const [k] = Object.keys(x.cons); return `<div class="wbp-pl ${ok ? "ok" : ""}">${chest(k)}<b>${x.p} %</b><span class="small">${h(consTxt(x.cons))} + ${x.frag} Fragments${x.xp ? ", +10 % d'XP 1 h pour tous" : ""}</span><span class="tag ${ok ? "" : "soft"}">${ok ? "Atteint" : "À venir"}</span></div>`; }).join("");
    return `<section class="panel wb-p"><h3>Paliers du serveur</h3><p class="xs muted" style="margin:0 0 8px">Chaque palier atteint par tout le serveur récompense tous ceux qui ont frappé ce boss au moins une fois cette semaine, même en arrivant après. S'il s'enfuit, les paliers atteints restent gagnés.</p><div class="wbp-pal">${P}</div></section>`;
  }
  const AP = () => (E.WB_S1_ITEMS && E.WB_S1_ITEMS.ap) || {};
  function s1Shop(s) {
    const SS = S(); const n = E.wbFrags(SS); const KIND = { amulette: "Amulette", arme: "Arme", bouclier: "Bouclier", anneau: "Anneau", coiffe: "Coiffe", cape: "Cape", bottes: "Bottes", ceinture: "Ceinture" };
    const card = (key, ref, p) => {
      let icon, nm, sub, tag = "", owned = false, act = `data-act="wb-s1item" data-tpl="${ref}"`;
      if (ref.startsWith("ap:")) { const A = AP()[ref.slice(3)] || {}; icon = `assets/i/${A.icon}.png`; nm = A.name; sub = A.kind; tag = `<span class="tag soft">cosmétique</span>`; owned = E.wbS1Owns(SS, ref.slice(3)); act = ""; }
      else if (ref.startsWith("cons:")) { const k = ref.slice(5); nm = (window.DATA.CONSUMABLES[k] || {}).name || k; sub = "consommable"; act = ""; }
      else { const T = window.DATA.ITEMS[ref]; icon = X().itemImg(ref); nm = T.name; sub = `${KIND[T.slot] || T.slot} niv. ${T.lvl}`; }
      const pic = ref.startsWith("cons:") ? chest(ref.slice(5)) : `<img src="${icon}" alt="">`;
      return `<div class="wb-it ${ref.startsWith("ap:") ? "ap" : ""}"><button class="wb-itb" ${act || 'data-act="none"'}>${pic}<b>${h(nm)}</b><span class="xs muted">${h(sub)}</span>${tag}</button>${owned ? `<span class="tag">Dans ta Garde-robe</span>` : `<button class="btn sm ${n >= p ? "primary" : ""}" data-act="wb-s1buy" data-k="${key}" data-tpl="${ref}" ${n >= p ? "" : "disabled"}>${fragImg("wb-fi sm")} ${p}</button>`}</div>`;
    };
    const shelves = Object.keys(E.WB_S1_SHOP).map((key) => {
      const d = E.wbS1Def(E.WB_S1.rot.indexOf(key) + 1); const open = E.wbS1ShelfOpen(SS, key); const w0 = E.wbS1Weeks(key)[0];
      return `<section class="wbs-shelf ${open ? "" : "locked"}"><div class="wbs-h"><img src="${img(d)}" alt=""><div><b>${h(d.name)}</b><span class="xs muted">${open ? (w0 === s.n ? "Cette semaine" : `Venu en semaine ${w0}`) : `Ouvre en semaine ${w0}`}</span></div></div>
        ${open ? `<div class="wb-loot">${E.WB_S1_SHOP[key].map(([ref, p]) => card(key, ref, p)).join("")}</div>` : `<p class="small muted wbs-lock">Rayon fermé jusqu'à l'arrivée de ${h(d.name)}.</p>`}</section>`;
    }).join("");
    return `<div class="stack" style="gap:12px"><p class="small muted" style="margin:0">Chaque essai donne 1 à 6 Fragments d'anomalie selon le grade, les paliers du serveur et ta contribution en donnent aussi. Le rayon d'un boss ouvre à son arrivée et reste ouvert toute la saison. Les cosmétiques vont dans la Garde-robe.</p>${shelves}</div>`;
  }
  function s1LocalAttack() {
    const s = S(); const L = locS1(); const def = E.wbS1Def(L.n); const phase = E.wbPhase(L.dmg, L.hp); const seed = E.wbSeed(L.n, "local", L.k);
    const r = E.wbSim(s, def, phase, seed); if (r.err) { X().toast(r.err); return; }
    r.points = E.wbS1Cap(r.points); const G = E.wbGrade(r.points);
    for (const k in G.cons) E.addCons(s, k, G.cons[k]);
    s.res[FRAG] = (s.res[FRAG] || 0) + G.frag;
    const dmg0 = L.dmg; L.k++; L.today++; L.week++; L.pts += r.points; L.cap += r.points; L.best = Math.max(L.best || 0, r.points);
    const T = C1().tiers.find((t) => t.k === L.week); if (T && !L.tiers.includes(T.id)) { L.tiers.push(T.id); for (const k in T.cons) E.addCons(s, k, T.cons[k]); s.res[FRAG] += T.frag; }
    const was = L.dmg >= L.hp; if (!was) L.dmg = Math.min(L.hp, L.dmg + r.points);
    C1().pal.forEach((x) => { if (!L.pal.includes(x.p) && (L.dmg / L.hp) * 100 >= x.p) { L.pal.push(x.p); for (const k in x.cons) E.addCons(s, k, x.cons[k]); s.res[FRAG] += x.frag; } });
    const R = Object.assign({ local: true, s1: true, n: L.n, k: L.k - 1, seed, phase, name: def.name, frag: G.frag, cons: G.cons, hp: L.hp, dmg0, dmg: L.dmg, killed: !was && L.dmg >= L.hp, left: maxTries(stS1()) - L.today, rank: 1 }, r);
    savePref(); X().markDirty(); sync(); watch(R);
  }
  /* cosmétiques d'apparat achetés (Garde-robe) : boucliers, familiers et montures d'apparat */
  (function wireCos() {
    if (!E.GR_SHIELDS || E.GR_SHIELDS.wb) return; E.GR_SHIELDS.wb = true;
    Object.entries(AP()).forEach(([id, A]) => { if (A.kind === "Bouclier d'apparat" && !E.GR_SHIELDS.some((b) => b.id === id.slice(1))) E.GR_SHIELDS.push({ id: id.slice(1), n: A.name, lv: 1, ic: A.icon, w: { k: "wb", v: A.b }, rar: "l" }); });
    const ok0 = E.grShieldOk, req0 = E.grShieldReq, comps0 = E.grComps, cok0 = E.grCompOk;
    E.grShieldOk = (S0, b) => (b && b.w && b.w.k === "wb" ? E.wbS1Owns(S0, "i" + b.id) : ok0(S0, b));
    E.grShieldReq = (b) => (b && b.w && b.w.k === "wb" ? "Boutique d'anomalie (boss des mondes, Saison 1)" : req0(b));
    if (comps0) E.grComps = (S0) => comps0(S0).concat((S0.wbCos || []).filter((id) => AP()[id] && AP()[id].kind !== "Bouclier d'apparat").map((id) => ({ id: "wb_" + id, n: AP()[id].name, ic: AP()[id].icon, rar: "l" })));
    if (cok0) E.grCompOk = (S0, id) => (String(id).startsWith("wb_") ? E.wbS1Owns(S0, String(id).slice(3)) : cok0(S0, id));
  })();

  window.WBUI = { render, act, card, onAnn, tile, optHtml, paintBar, ui, st };
})();
