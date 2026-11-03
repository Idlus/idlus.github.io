/* ============================================================================
   VOTE SUR DOFUS FAN GAMES — récompense de vote (choix de Mathis du 02/11/2026 : Sablier + kamas, sans limite par jour)
   Une ligne sous l'accueil, comme celle du Discord : « Voter » ouvre https://dofusfangames.com/jeu/idlus, puis
   « Récupérer » demande à la fonction serveur « vote » (supabase/functions/vote) de vérifier le vote avec l'adresse IP.
   La récompense (30 min de Sablier + un quart d'heure de kamas au niveau du héros principal) arrive par l'hôtel de vente
   (hdv_ops, js/market.js). Un vote par heure sur le site, une récompense par heure et par compte. Rien d'obligatoire :
   le site interdit de réserver un contenu aux votants. Partie Classique et compte connecté seulement.
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const X = () => window.DX.social;
  const URL_VOTE = "https://dofusfangames.com/jeu/idlus";
  const WAIT = 55 * 60e3;
  const V = { st: null, off: 0, last: 0, busy: false, voted: false, msg: "" };

  const monoP = () => !!(ON.monoPart && ON.monoPart());
  const ready = () => !!(ON.user && ON.state === "ok" && !monoP() && !(ON.solo && ON.solo()) && V.st && V.st.actif);
  const leftMs = () => (V.st && V.st.last ? Math.max(0, Date.parse(V.st.last) + WAIT - (Date.now() + V.off)) : 0);

  async function poll() {
    V.last = Date.now();
    if (!ON.user || monoP() || !ON.rpc) return;
    const r = await ON.rpc("vote_moi"); if (r.err || !r.data) return;
    V.st = r.data; if (V.st.now) V.off = Date.parse(V.st.now) - Date.now();
    /* 3A+B : paliers de l'objectif du mois versés par vote_moi (Sablier par l'hôtel de vente) */
    const P = Array.isArray(V.st.paye) ? V.st.paye : [];
    if (V.st.titre) { X().toast(`Top 10 des votants du mois dernier : titre « ${V.st.titre.t} » !`, "rare"); if (window.MARKET && window.MARKET.sync) setTimeout(() => window.MARKET.sync(), 600); }
    if (P.length) { const hrs = P.reduce((a, x) => a + (+x.h || 0), 0); X().toast(`Objectif des votes du mois atteint : +${hrs} h de Sablier !`, "rare"); if (window.MARKET && window.MARKET.sync) setTimeout(() => window.MARKET.sync(), 600); }
  }

  /* ligne de l'accueil (appelée par renderHome dans js/ui.js) ; rien tant que la récompense n'est pas ouverte */
  function line() {
    if (!ready()) return "";
    const ms = leftMs();
    const ic = `<span class="dc-i vt-i" aria-hidden="true">⏳</span>`;
    if (ms > 0) {
      const m = Math.max(1, Math.ceil(ms / 60e3));
      return `<div class="dcline vtline done">${ic}<span class="grow">Merci pour ton vote ! <span class="xs muted">Prochaine récompense dans ${m} min.</span></span><a class="btn sm ghost" href="${URL_VOTE}" target="_blank" rel="noopener">Dofus Fan Games ›</a></div>`;
    }
    return `<div class="dcline vtline">${ic}<span class="grow">Vote pour Idlus sur Dofus Fan Games <span class="xs muted">Sablier et kamas à chaque vote, une fois par heure</span></span>`
      + `<span class="vt-b"><a class="btn sm" href="${URL_VOTE}" target="_blank" rel="noopener" data-act="vt-go">Voter ›</a><button class="btn sm primary" data-act="vt-get" ${V.busy ? "disabled" : ""}>Récupérer</button></span></div>`;
  }

  async function claim() {
    if (V.busy) return;
    if (!ON.user) { X().toast("Connecte-toi à ton compte pour récupérer la récompense de vote."); return; }
    if (monoP()) { X().toast(ON.CLASSIC_ERR); return; }
    V.busy = true; repaint();
    const r = await ON.vote();
    V.busy = false;
    if (r && r.ok) {
      X().toast(`Merci pour ton vote ! +${X().fmt(r.k || 0)} kamas et ${Math.round((r.sab || 0.5) * 60)} min de Sablier${r.bonus ? ` (série +${r.bonus} %)` : ""}.`, "rare");
      V.st = Object.assign({}, V.st, { last: new Date(Date.now() + V.off).toISOString() });
      if (window.MARKET && window.MARKET.sync) setTimeout(() => window.MARKET.sync(), 600); // les gains arrivent par l'hôtel de vente
    } else {
      X().toast((r && r.err) || "Pas de connexion au serveur. Réessaie dans un moment.");
      if (r && r.attente) await poll();
    }
    repaint();
  }
  function repaint() {
    const ui = window.DX.ui || {};
    if (ui.tab === "vote") { const m = document.querySelector("#main"); if (m) page(m); return; }
    if (ui.tab === "home" && window.DX.render && !(document.querySelector("#sheet") || {}).innerHTML) { try { window.DX.render(); } catch (e) {} }
  }

  /* ---------- page « Voter pour Idlus » (menu Joueurs) ---------- */
  const PTS = [[1, 20000], [20, 75000], [60, 385000], [120, 510000], [200, 870000]]; // mêmes repères que V.KAMAS_PTS (js/verify.js) et vote_kamas (supabase/vote.sql)
  const kamasOf = (l) => { l = Math.max(1, Math.min(200, l || 1)); for (let i = 1; i < PTS.length; i++) if (l <= PTS[i][0]) { const [a, x] = PTS[i - 1], [b, y] = PTS[i]; return Math.round((x + (y - x) * (l - a) / (b - a)) / 4); } return 217500; };
  const mainLvl = () => { const S = window.DX.S; if (!S || !S.chars) return 1; const c = S.chars.find((x) => x.id === S.mainHero) || S.chars[0]; return (c && c.lvl) || 1; };
  function page(main) {
    const h = X().h, fmt = X().fmt, st = V.st || {};
    if (!ON.user) { main.innerHTML = `<section class="panel"><div class="pad stack"><h1>Voter pour Idlus</h1><div class="small">Connecte-toi à ton compte (Options › Compte) pour recevoir une récompense à chaque vote.</div></div></section>`; return; }
    const ms = leftMs(), m = Math.max(1, Math.ceil(ms / 60e3));
    const serie = Math.max(0, st.serie || 0), bonus = Math.max(0, Math.min(50, st.bonus || 0)); // bonus calculé par le serveur (jours d'affilée avant aujourd'hui)
    const k = Math.round(kamasOf(mainLvl()) * (1 + bonus / 100));
    const btns = ms > 0
      ? `<span class="vt-wait">Prochaine récompense dans <b class="num">${m} min</b></span>`
      : `<a class="btn primary vt-big" href="${URL_VOTE}" target="_blank" rel="noopener" data-act="vt-go">1. Voter sur Dofus Fan Games ›</a><button class="btn vt-big" data-act="vt-get" ${V.busy ? "disabled" : ""}>2. Récupérer ma récompense</button>`;
    const days = (st.jours || []).slice(-7); // 7 derniers jours : nombre de votes
    const dots = days.length ? `<div class="vt-days">${days.map((d) => `<span class="${d.n ? "on" : ""}" title="${h(d.d)} : ${d.n} vote${d.n > 1 ? "s" : ""}"><b>${d.n || ""}</b><small>${h(d.j)}</small></span>`).join("")}</div>` : "";
    const obj = st.obj; const objP = obj ? Math.min(100, Math.round((obj.n / Math.max(1, obj.cible)) * 100)) : 0;
    const top = (st.top || []).map((x, i) => `<div class="li small"><b class="vt-rk">${i + 1}</b><span class="grow">${h(x.p)}${x.moi ? ` <span class="xs muted">(toi)</span>` : ""}</span><b class="num">${fmt(x.n)}</b></div>`).join("");
    main.innerHTML = `
    <section class="panel vt-hero"><div class="pad stack">
      <div class="row between wrap"><div class="stack" style="gap:2px"><h1>⏳ Voter pour Idlus</h1><span class="small muted">Chaque vote fait monter Idlus dans le classement des fan games Dofus et amène de nouveaux joueurs.</span></div>${st.rang ? `<span class="tag good">n° ${h(st.rang)} ce mois-ci</span>` : ""}</div>
      <div class="vt-rew"><div><span class="xs muted">À chaque vote (une fois par heure)</span><div class="vt-rew-l"><span>⏳ <b>${Math.round(30 * (1 + bonus / 100))} min</b> de Sablier</span><span>${X().IC("kamas")} <b class="num">${fmt(k)}</b> kamas</span>${bonus ? `<span class="tag good">+${bonus} % série</span>` : ""}</div></div></div>
      <div class="row wrap vt-btns">${btns}</div>
      <span class="xs muted">Vote depuis le même appareil et le même réseau (Wi-Fi ou 4G) que le jeu : le site reconnaît ton vote à ta connexion.</span>
    </div></section>
    <section class="grid2" style="margin-top:14px">
      <section class="panel"><div class="phead"><h2>Tes votes</h2></div><div class="pad stack">
        <div class="vt-stats"><span><b class="num">${fmt(st.n || 0)}</b><small>au total</small></span><span><b class="num">${fmt(st.nm || 0)}</b><small>ce mois-ci</small></span><span><b class="num">${serie}</b><small>jour${serie > 1 ? "s" : ""} d'affilée</small></span></div>
        ${dots}
        <span class="xs muted">Série : au moins un vote par jour. Chaque jour d'affilée ajoute 10 % de kamas et de Sablier, jusqu'à +50 %.</span>
      </div></section>
      <section class="panel"><div class="phead"><h2>Objectif du mois</h2>${obj ? `<span class="xs muted">${h(obj.fin || "")}</span>` : ""}</div><div class="pad stack">
        ${obj ? `<div class="small">Tous ensemble : <b class="num">${fmt(obj.n)}</b> / ${fmt(obj.cible)} votes</div><div class="bar"><i style="width:${objP}%"></i></div>
        <div class="vt-paliers">${(obj.paliers || []).map((x) => `<span class="${obj.n >= x.n ? "on" : ""}"><b class="num">${fmt(x.n)}</b><small>${h(x.r)}</small></span>`).join("")}</div>
        <span class="xs muted">Chaque palier atteint donne du Sablier à tous les joueurs du serveur, et 1 h de plus à ceux qui ont voté ce mois-ci.</span>` : `<span class="small muted">Aucun objectif ce mois-ci.</span>`}
      </div></section>
    </section>
    ${top ? `<section class="panel" style="margin-top:14px"><div class="phead"><h2>Votants du mois</h2><span class="xs muted">top 10 du mois : titre « Voix d'Idlus »</span></div><div class="pad"><div class="list">${top}</div></div></section>` : ""}
    <section class="panel" style="margin-top:14px"><div class="phead"><h2>Bon à savoir</h2></div><div class="pad stack small">
      <span>• Voter est libre : rien dans le jeu n'est réservé aux votants.</span>
      <span>• Le site compte un vote par heure et par connexion. VPN et votes automatiques sont interdits par le site et annulés.</span>
      <span>• La récompense arrive dans ta partie Classique, comme une vente à l'hôtel de vente.</span>
    </div></section>`;
  }

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-act^='vt-']"); if (!b) return;
    if (b.dataset.act === "vt-get") { ev.preventDefault(); claim(); }
    if (b.dataset.act === "vt-go") V.voted = true; // le lien s'ouvre dans un nouvel onglet
  });

  let started = false;
  function start() {
    if (started) return; started = true;
    if (window.DX && window.DX.pages) window.DX.pages.vote = (main) => { page(main); if (Date.now() - V.last > 60e3) poll().then(() => { if ((window.DX.ui || {}).tab === "vote") page(main); }); };
    setTimeout(poll, 3000);
    setInterval(() => { if (document.visibilityState === "visible" && Date.now() - V.last >= (V.st ? 5 * 60e3 : 20e3)) poll(); }, 30e3);
  }
  const dot = () => ready() && leftMs() <= 0; // 5A : pastille du menu quand un vote est possible
  window.VOTE = { start, line, poll, dot, V };
})();
