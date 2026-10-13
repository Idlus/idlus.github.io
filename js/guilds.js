/* ============================================================================
   GUILDES — Idlus (multijoueur, étape 5)
   Créer une guilde (Guildalogemme), la rejoindre, rangs, XP de guilde donnée par les membres
   (part choisie de 0 à 90 %), niveaux et bonus, chat de guilde (onglet Guilde du chat),
   journal, réglages. Règles vérifiées par le serveur (supabase/guildes.sql).
   0.1.22 : boss de la semaine et Percepteurs (règles dans js/gboss.js, serveur dans supabase/gboss.sql).
   Le jeu garde dans S.guild : { id, name, lvl, ic, col, share, pend } (pend = XP à envoyer).
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const E = window.ENGINE;
  const X = () => window.DX.social;
  const D = () => window.DATA;
  const S = () => window.DX.S;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const MAXM = 30, COST = 100000, LVL = 30;
  const RANKS = ["Meneur", "Bras droit", "Membre", "Recrue"];
  const ICONS = ["dofus", "couronne", "trophee", "cristal", "phenix", "ailes", "coffre", "havre", "monde", "combat", "pioche", "cle"];
  const COLS = ["#8cc63f", "#e8c063", "#ff8a6b", "#e0674f", "#c77dff", "#7fb3ff", "#4fd1c5", "#f0f0e0"];
  const G = { me: null, ex: null, off: 0, res: null, sureRm: null, atkSeen: {}, zone: "", list: null, q: "", tab: "home", busy: false, chat: [], after: 0, unread: 0, seenChat: 0, form: { name: "", ic: "dofus", col: "#8cc63f" }, adm: null };

  /* ---------- bonus de guilde (sous les plafonds du jeu) ---------- */
  const perks = (l) => ({ xp: Math.floor(l / 5), drop: Math.floor(l / 10), kamas: Math.floor(l / 10) });
  const inGuild = () => { const s = S(); return !!(s && s.guild && s.guild.id); };
  E.guildBonus = (s, kind) => { const g = s && s.guild; if (!g || !g.id) return 0; return perks(g.lvl || 1)[kind] || 0; };
  E.guildXpShare = (s, c, g) => {
    const q = s && s.guild; if (!q || !q.id || !(q.share > 0) || g <= 0) return 0;
    const d = Math.floor(g * Math.min(90, q.share) / 100); q.pend = (q.pend || 0) + d; return d;
  };

  /* ---------- serveur ---------- */
  const mine = () => !!(S() && ON.user && ON.profile && ON.link().uid === ON.user.id);
  async function call(name, args, okTxt) {
    if (G.busy) return null;
    if (!mine()) { X().toast("Crée ton compte (gratuit) pour les guildes : ta partie te suit."); return null; }
    G.busy = true; paint();
    const r = await ON.rpc(name, args || {});
    G.busy = false;
    if (r.err) { X().toast(r.err); paint(); return null; }
    if (r.data && r.data.err) { X().toast(r.data.err); paint(); return null; }
    if (okTxt) X().toast(okTxt);
    return r.data || {};
  }
  /* Envoie l'XP donnée et relit la guilde. */
  async function sync() {
    if (!mine()) return;
    const s = S(); s.guild = s.guild || { share: 0, pend: 0 };
    const q = s.guild; const pend = Math.floor(q.pend || 0);
    if (q.id) {
      const r = await ON.rpc("guild_give", { p_xp: pend, p_share: q.share || 0 });
      if (r.data && r.data.ok) { q.pend = Math.max(0, (q.pend || 0) - pend); if (r.data.lvl) q.lvl = r.data.lvl; }
      else if (r.data && r.data.none) q.id = null;
    }
    await load();
  }
  async function load() {
    const r = await ON.rpc("guild_me"); if (r.err || !r.data || r.data.err) return;
    G.me = r.data; const s = S(); if (!s) return;
    const q = (s.guild = s.guild || { share: 0, pend: 0 });
    const was = q.id;
    if (G.me.g) { Object.assign(q, { id: G.me.g.id, name: G.me.g.name, lvl: G.me.g.lvl, ic: G.me.g.ic, col: G.me.g.col }); if (!was) q.share = G.me.share || q.share || 0; }
    else { q.id = null; q.pend = 0; }
    if (was !== q.id) { X().markDirty(); G.chat = []; G.after = 0; G.ex = null; if (q.id) chatPoll(); }
    paint();
    if (q.id) loadEx();
    if (window.CHAT && window.CHAT.repaint) window.CHAT.repaint();
  }
  /* boss de la semaine et Percepteurs ; les coffres gagnés s'ouvrent tout seuls */
  async function loadEx() {
    const r = await ON.rpc("guild_extra"); if (r.err || !r.data || r.data.none || r.data.err) return;
    G.ex = r.data; G.off = Date.parse(r.data.now) - Date.now();
    (G.ex.percos || []).forEach((p) => { if (p.atk && !G.atkSeen[p.id + p.atk.at]) { G.atkSeen[p.id + p.atk.at] = 1; if (!p.atk.done) X().toast(`⚔ Le Percepteur de ${p.name} est attaqué ! Défends-le dans Communauté › Guilde › Percepteurs.`, "rare"); } });
    if (G.ex.boss && G.ex.boss.claim && !G.claiming) {
      G.claiming = true;
      const c = await ON.rpc("gboss_claim", { p_after: (S().hdv && S().hdv.op) || 0 }); G.claiming = false;
      if (c.data && c.data.ops && window.MARKET) window.MARKET.apply(c.data.ops, true);
      if (c.data && c.data.ok) X().toast(`Boss de guilde : ${c.data.ok > 1 ? `${c.data.ok} coffres ouverts` : "coffre ouvert"} (+${fmt(c.data.k)} kamas, +${c.data.dust} Poussières de stasis).`, "rare");
      return loadEx();
    }
    paint();
  }
  async function loadList() { const r = await ON.rpc("guild_list", { p_q: G.q }); G.list = r.data || []; paint(); }

  /* ---------- chat de guilde (onglet « Guilde » du chat) ---------- */
  async function chatPoll() {
    if (!inGuild() || !mine()) return;
    const r = await ON.rpc("guild_chat", { p_after: G.after }); const L = r.data || [];
    if (!L.length) return;
    L.forEach((m) => { if (!G.chat.some((x) => x.id === m.id)) G.chat.push(m); });
    G.chat.sort((a, b) => a.id - b.id); G.chat = G.chat.slice(-150); G.after = G.chat[G.chat.length - 1].id;
    const C = window.CHAT && window.CHAT.state;
    const fresh = L.filter((m) => m.kind === "msg" && m.user_id !== ON.user.id && m.id > G.seenChat).length;
    if (!(C && C.open && C.tab === "u") && G.seenChat) G.unread += fresh;
    if (!G.seenChat || (C && C.open && C.tab === "u")) G.seenChat = G.after;
    if (window.CHAT && window.CHAT.repaint) window.CHAT.repaint();
  }
  async function say(body, item) {
    const r = await ON.rpc("guild_say", { p_body: body, p_item: item || null });
    if (r.err) return r.err; if (r.data) return r.data;
    await chatPoll(); return null;
  }
  const chatSeen = () => { G.unread = 0; G.seenChat = G.after; };

  /* ---------- rendu ---------- */
  const emb = (ic, col, sz) => `<span class="gemb" style="--gc:${h(col || "#8cc63f")};${sz ? `--gs:${sz}px` : ""}"><img src="assets/ui/${h(ic || "dofus")}.webp" alt=""></span>`;
  const ago = (t) => { if (!t) return "jamais"; const s = (Date.now() - new Date(t)) / 1000; return s < 300 ? "en ligne" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const paint = () => { if (window.DX.ui.tab === "guild") { const m = $("#main"); if (m) { const y = window.scrollY; window.DX.repaint(m, html()); window.scrollTo(0, y); } } }; // garde le curseur là où on écrit
  function render(main) {
    if (!main) return;
    window.DX.repaint(main, html());
    if (mine() && !G.me) load();
    if (G.list === null && !(G.me && G.me.g)) loadList();
  }
  function html() {
    const s = S();
    const head = `<div class="pagehead"><h1>Guilde</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s ? s.kamas : 0)}</b> kamas</span></div>`;
    if (!mine()) return head + `<div class="stack"><div class="panel"><div class="pad row between"><span><b>Crée ton compte pour rejoindre une guilde</b><br><span class="small muted">C'est gratuit, et ta partie de cet appareil te suit sur ton compte. En attendant, tu peux regarder les guildes.</span></span><button class="btn primary sm" data-act="on-loginscreen">Créer mon compte</button></div></div>${listHtml(false)}</div>`;
    if (!G.me) return head + `<div class="empty">Chargement…</div>`;
    return head + (G.me.g ? guildHtml() : noneHtml());
  }

  /* --- sans guilde : invitations, fonder, liste --- */
  function noneHtml() {
    const s = S(); const inv = G.me.invites || [];
    const best = Math.max(...s.chars.map((c) => (c.ren ? 200 : c.lvl)));
    const f = G.form;
    const why = best < LVL ? `Il faut un héros au niveau ${LVL} (ton meilleur : ${best}).` : s.kamas < COST ? `Il te manque ${fmt(COST - s.kamas)} kamas.` : f.name.trim().length < 3 ? "Choisis un nom (3 à 24 caractères)." : "";
    const invites = inv.length ? `<section class="panel" style="border-color:var(--gold)"><div class="phead"><h2>Invitations</h2></div><div class="list">${inv.map((i) => `<div class="li">${emb(i.ic, i.col, 40)}<span class="grow"><b>${h(i.name)}</b><br><span class="xs muted">niveau ${i.lvl} · ${i.n} / ${MAXM} membres · invité par ${h(i.by || "?")}</span></span><button class="btn sm primary" data-act="g-inv" data-g="${i.gid}" data-v="1">Rejoindre</button><button class="btn sm" data-act="g-inv" data-g="${i.gid}" data-v="0">Refuser</button></div>`).join("")}</div></section>` : "";
    const found = `<section class="panel"><div class="phead"><h2>Fonder une guilde</h2><span class="xs muted">Guildalogemme : ${fmt(COST)} kamas et un héros niveau ${LVL}</span></div><div class="pad stack">
      <div class="gfound">${emb(f.ic, f.col, 72)}<div class="stack grow">
        <input type="text" id="gName" data-act="g-name" maxlength="24" placeholder="Nom de la guilde" value="${h(f.name)}">
        <div class="gpick">${ICONS.map((ic) => `<button class="${f.ic === ic ? "on" : ""}" data-act="g-ic" data-v="${ic}" aria-label="${ic}"><img src="assets/ui/${ic}.webp" alt=""></button>`).join("")}</div>
        <div class="gpick col">${COLS.map((c) => `<button class="${f.col === c ? "on" : ""}" data-act="g-col" data-v="${c}" style="background:${c}" aria-label="couleur"></button>`).join("")}</div>
      </div></div>
      <div class="row"><button class="btn primary" data-act="g-create" ${why || G.busy ? "disabled" : ""}>Fonder la guilde</button><span class="xs ${why ? "" : "muted"}" ${why ? 'style="color:var(--danger)"' : ""}>${why || "Tu en deviens le Meneur. Les kamas sont pris tout de suite."}</span></div>
    </div></section>`;
    return `<div class="stack">${invites}${listHtml(true)}${found}</div>`;
  }
  function listHtml(canJoin) {
    const L = G.list; const asks = (G.me && G.me.asks) || [];
    const rows = L === null ? `<div class="empty">Chargement…</div>` : !L.length ? `<div class="empty">Aucune guilde pour l'instant. Fonde la première !</div>`
      : `<div class="list">${L.map((g) => `<div class="li">${emb(g.ic, g.col, 40)}<span class="grow"><b>${h(g.name)}</b> <span class="tag" style="background:var(--panel3);color:var(--ink)">niv. ${g.lvl}</span><br><span class="xs muted">${g.n} / ${MAXM} membres · Meneur : ${h(g.chef || "?")} · ${g.open ? "entrée libre" : "sur demande"}</span>${g.motd ? `<br><span class="xs">« ${h(g.motd)} »</span>` : ""}</span>
        ${canJoin ? (asks.includes(g.id) ? `<span class="xs muted">demande envoyée</span>` : g.n >= MAXM ? `<span class="xs muted">complète</span>` : `<button class="btn sm ${g.open ? "primary" : ""}" data-act="g-join" data-g="${g.id}" ${G.busy ? "disabled" : ""}>${g.open ? "Rejoindre" : "Demander"}</button>`) : ""}</div>`).join("")}</div>`;
    return `<section class="panel"><div class="phead"><h2>Guildes</h2><input type="text" id="gQ" data-act="g-q" placeholder="Rechercher…" value="${h(G.q)}" style="max-width:220px"></div>${rows}</section>`;
  }

  /* --- dans une guilde --- */
  function guildHtml() {
    const g = G.me.g; const n = G.me.members.length;
    const span = g.next ? g.next - g.base : 1; const pct = g.next ? Math.min(100, ((g.xp - g.base) / span) * 100) : 100;
    const banner = `<section class="panel gban">${emb(g.ic, g.col, 76)}<div class="grow stack" style="gap:6px"><div class="row"><h2 style="font-size:26px">${h(g.name)}</h2><span class="tag good">niveau ${g.lvl}</span><span class="xs muted">${n} / ${MAXM} membres · tu es ${RANKS[G.me.rank]}</span></div>
      <div class="gbar"><i style="width:${pct.toFixed(1)}%"></i><b>${g.next ? `${fmt(g.xp - g.base)} / ${fmt(span)} XP` : "niveau maximum"}</b></div>
      ${g.motd ? `<div class="gmotd">${h(g.motd)}</div>` : ""}</div></section>`;
    const asks = (G.me.asks || []).length; const atk = G.ex && (G.ex.percos || []).some((p) => p.atk && !p.atk.done);
    const tabs = `<nav class="subtabs">${ [["home", "Accueil"], ["boss", "Boss"], ["percos", `Percepteurs${atk ? " ⚔" : ""}`], ["members", `Membres${asks ? ` · ${asks} demande${asks > 1 ? "s" : ""}` : ""}`], ["log", "Journal"], ["set", "Réglages"]].map(([id, t]) => `<button data-act="g-tab" data-v="${id}" aria-pressed="${G.tab === id}">${t}</button>`).join("")}
      <button class="btn sm mktrade" data-act="g-chat">${X().G("chat")} Chat de guilde</button></nav>`;
    const body = G.tab === "boss" ? bossHtml() : G.tab === "percos" ? percosHtml() : G.tab === "members" ? membersHtml() : G.tab === "log" ? logHtml() : G.tab === "set" ? setHtml() : homeHtml();
    return `<div class="stack">${banner}${tabs}${body}</div>`;
  }
  function homeHtml() {
    const g = G.me.g; const s = S(); const share = (s.guild && s.guild.share) || 0; const p = perks(g.lvl);
    const me = G.me.members.find((m) => m.u === ON.user.id) || {};
    const lines = [[1, "Chat de guilde et emblème"], [5, "Percepteurs (1 au niveau 5, +1 tous les 5 niveaux)"], [10, "+2 % XP, +1 % butin, +1 % kamas"], [25, "+5 % XP, +2 % butin, +2 % kamas"], [50, "+10 % XP, +5 % butin, +5 % kamas"], [100, "+20 % XP, +10 % butin, +10 % kamas"]];
    return `<div class="grid2g">
      <section class="panel"><div class="phead"><h2>Ma part d'XP pour la guilde</h2><b class="num">${share} %</b></div><div class="pad stack">
        <input type="range" min="0" max="90" step="5" value="${share}" data-act="g-share" id="gShare" aria-label="Part d'XP donnée à la guilde">
        <span class="small muted">Comme dans DOFUS : cette part de l'XP gagnée par tes héros en combat part à la guilde au lieu d'aller aux héros. La guilde monte de niveau et tout le monde profite de ses bonus.</span>
        <div class="mksum"><span>Donné cette semaine</span><b>${fmt(me.week || 0)} XP</b><span>Donné depuis ton arrivée</span><b>${fmt(me.given || 0)} XP</b></div>
      </div></section>
      <section class="panel"><div class="phead"><h2>Bonus de la guilde</h2><span class="xs muted">sous les plafonds du jeu</span></div><div class="pad stack">
        <div class="row"><span class="tag good">+${p.xp} % XP</span><span class="tag good">+${p.drop} % butin</span><span class="tag good">+${p.kamas} % kamas</span></div>
        <div class="list gperks">${lines.map(([l, t, soon]) => `<div class="li small ${g.lvl >= l ? "" : "lock"}"><b class="lv">niv. ${l}</b><span class="grow">${t}</span>${soon ? `<span class="tag soft2">bientôt</span>` : g.lvl >= l ? "✓" : ""}</div>`).join("")}</div>
        <span class="xs muted">Entre deux paliers : +1 % XP tous les 5 niveaux, +1 % butin et kamas tous les 10 niveaux.</span>
      </div></section>
      <section class="panel"><div class="phead"><h2>Activités de guilde</h2></div><div class="list">
        ${bossLine()}${percoLine()}
        <div class="li">${X().IC("coffre")}<span class="grow"><b>Coffre de guilde</b><br><span class="xs muted">Un coffre partagé pour s'entraider entre membres.</span></span><span class="tag soft2">prochaine mise à jour</span></div>
      </div></section></div>`;
  }
  /* --- boss de la semaine --- */
  const left = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d} j ${hh} h` : hh ? `${hh} h ${String(mm).padStart(2, "0")}` : `${mm} min`; };
  const srvNow = () => Date.now() + (G.off || 0);
  function bossLine() {
    const b = G.ex && G.ex.boss; const def = E.gboss();
    const pct = b ? Math.min(100, Math.floor((b.pts / b.goal) * 100)) : 0;
    return `<div class="li clk" data-act="g-tab" data-v="boss">${X().IC("trophee")}<span class="grow"><b>Boss de la semaine : ${h(def.name)}</b><br><span class="xs muted">${b ? `${pct} % · ${E.GBOSS_TRIES - b.today} essai${E.GBOSS_TRIES - b.today > 1 ? "s" : ""} aujourd'hui` : "Chargement…"}</span></span><span class="tag good">Voir</span></div>`;
  }
  function percoLine() {
    const P = (G.ex && G.ex.percos) || []; const lvl = G.me.g.lvl; const slots = E.percoSlots(lvl); const atk = P.filter((p) => p.atk).length;
    return `<div class="li clk" data-act="g-tab" data-v="percos">${X().IC("bourse")}<span class="grow"><b>Percepteurs</b><br><span class="xs muted">${slots ? `${P.length} / ${slots} posé${P.length > 1 ? "s" : ""}${atk ? ` · <b style="color:var(--danger)">${atk} attaqué${atk > 1 ? "s" : ""}</b>` : ""}` : "le premier arrive au niveau 5 de guilde"}</span></span><span class="tag ${atk ? "warn" : "good"}">${atk ? "Défendre" : "Voir"}</span></div>`;
  }
  function bossHtml() {
    const b = G.ex && G.ex.boss; if (!b) return `<div class="empty">Chargement…</div>`;
    const def = E.gboss(b.w); const M = D().MONSTERS[def.boss] || {};
    const mechs = E.bossMechs(def.did).map((k) => E.BOSS_MECHS[k] && E.BOSS_MECHS[k].name).filter(Boolean);
    const tries = Math.max(0, E.GBOSS_TRIES - b.today); const pct = Math.min(100, (b.pts / b.goal) * 100);
    const s = S(); const lvl = b.lvl || Math.max(...E.team(s).map((c) => (c.ren ? 200 : c.lvl)), 1);
    const steps = b.steps.map((st) => { const c = E.gbossChest(st.step, lvl); return `<span class="gbstep ${st.reached ? "on" : ""}" style="left:${st.step}%" data-tip="${st.step} % · ${E.GBOSS_CHEST_NAMES[st.step]} : ${fmt(c.k)} kamas et ${c.dust} Poussières de stasis${st.claimed ? " (ouvert)" : ""}">${X().IC("coffre")}</span>`; }).join("");
    const r = G.res && G.res.gboss ? G.res : null;
    const fight = `<div class="row"><button class="btn primary" data-act="g-boss" ${!tries || G.busy || G.fighting ? "disabled" : ""}>${G.fighting ? "Combat en cours…" : tries ? `Affronter le boss (${tries} essai${tries > 1 ? "s" : ""} aujourd'hui)` : "Plus d'essai aujourd'hui"}</button>
      ${r ? `<span class="small"><b class="num">${fmt(r.points)}</b> points en ${r.rounds} tours · ${r.alive} héros debout</span>` : `<span class="xs muted">Ton équipe actuelle, au niveau de tes héros, pendant ${E.GBOSS_ROUNDS} tours.</span>`}</div>`;
    const hit = (b.hitters || []).map((x, i) => `<div class="li small"><b class="num lv">${i + 1}</b><span class="grow">${X().pname(x.p, x.u)} <span class="xs muted">· ${x.n} essai${x.n > 1 ? "s" : ""} · meilleur ${fmt(x.best)}</span></span><b class="num">${fmt(x.pts)}</b></div>`).join("") || `<div class="empty">Personne n'a encore frappé cette semaine.</div>`;
    const top = (b.top || []).map((g, i) => `<div class="li small ${g.id === G.me.g.id ? "gme" : ""}"><b class="num lv">${i + 1}</b>${emb(g.ic, g.col, 26)}<span class="grow">${h(g.name)} <span class="xs muted">· niv. ${g.lvl} · ${g.who} membre${g.who > 1 ? "s" : ""}</span></span><b class="num">${fmt(g.pts)}</b></div>`).join("") || `<div class="empty">Aucune guilde n'a encore frappé.</div>`;
    const last = (b.last || []).length ? `<div class="pad xs muted">Semaine passée : ${b.last.map((g, i) => `${i + 1}. ${h(g.name)}`).join(" · ")}</div>` : "";
    return `<section class="panel gboss"><div class="gbhead">${M.img ? `<img class="gbimg" src="${X().imgM(def.boss)}" alt="">` : ""}<div class="stack grow" style="gap:4px">
        <span class="xs muted">Boss de la semaine · change dans ${left(E.gbossLeft(srvNow()))}</span><h2 style="font-size:24px">${h(def.name)}</h2>
        <span class="small muted">${h(def.dname)}${mechs.length ? ` · ${mechs.map(h).join(", ")}` : ""}</span></div></div>
      <div class="pad stack">
        <div class="row between small"><b>Jauge de la guilde</b><span><b class="num">${fmt(b.pts)}</b> / ${fmt(b.goal)} points · ${Math.floor(pct)} %</span></div>
        <div class="gbbar"><i style="width:${pct.toFixed(1)}%"></i>${steps}</div>
        <span class="xs muted">Objectif : ${fmt(E.GBOSS_PER_MEMBER)} points par membre (au moins 5 comptés). Un coffre s'ouvre à 25 % (Coffre de l'assaut), 50 % (de la brèche), 75 % (du siège) et 100 % (de la victoire) pour chaque membre qui a frappé au moins une fois. Tes points cette semaine : <b>${fmt(b.mine)}</b>.</span>
        ${fight}
      </div></section>
      <div class="grid2g even"><section class="panel"><div class="phead"><h2>Dans ta guilde</h2></div><div class="list">${hit}</div></section>
      <section class="panel"><div class="phead"><h2>Guildes cette semaine</h2><span class="xs muted">titre « ${h(E.GBOSS_TITLE)} » pour le podium</span></div><div class="list">${top}</div>${last}</section></div>
      <p class="xs muted">Le combat est rejoué par le serveur avec ta partie en ligne : le boss est au niveau de ton équipe, ses PV ne baissent pas vraiment, on compte les dégâts (100 points = ses PV normaux). Pas d'idoles ni de seconde chance : même boss pour tout le monde.</p>`;
  }

  /* --- Percepteurs --- */
  function percosHtml() {
    if (!G.ex) return `<div class="empty">Chargement…</div>`;
    const s = S(); const P = G.ex.percos || []; const lvl = G.me.g.lvl; const slots = E.percoSlots(lvl); const off = G.me.rank <= 1;
    const cards = P.map((p) => {
      const f = Math.max(0, p.fill || 0); const cap = p.cap || { k: 0, res: {} };
      const res = Object.keys(cap.res || {}).slice(0, 5).map((k) => `<span class="gres" data-tip="${h(k)}">${X().resImg(k) ? `<img src="${X().resImg(k)}" alt="">` : ""}${fmt(Math.floor(cap.res[k] * Math.min(f, 2.5)))}</span>`).join("");
      const a = p.atk; const rest = a ? Date.parse(a.ends) - srvNow() : 0;
      const atk = a ? `<div class="gatk"><b>⚔ Attaqué !</b> <span class="small">encore ${left(rest)} pour le défendre${a.n ? ` · ${a.n} défenseur${a.n > 1 ? "s" : ""} battu${a.n > 1 ? "s" : ""} (+${a.n} monstre${a.n > 1 ? "s" : ""})` : ""}</span>
          ${(a.by || []).length ? `<br><span class="xs muted">Ont tenté : ${a.by.map(h).join(", ")}</span>` : ""}
          <div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="g-def" data-g="${p.id}" ${a.done || G.fighting ? "disabled" : ""}>${G.fighting === p.id ? "Combat en cours…" : a.done ? "Tu as déjà tenté" : "Défendre avec mon équipe"}</button><span class="xs muted">Victoire : poche +25 %, XP de guilde et la Bourse du Percepteur pour toi. Sans victoire en 2 h : la moitié de la poche est perdue.</span></div></div>` : "";
      const r = G.res && G.res.perco && G.res.id === p.id ? `<div class="small ${G.res.win ? "" : "muted"}">${G.res.win ? `🛡 Victoire en ${G.res.rounds} tours ! Poche +25 %${G.res.gxp ? `, +${fmt(G.res.gxp)} XP de guilde` : ""}, Bourse du Percepteur reçue.` : `Défaite contre ${G.res.foes} monstres : le suivant en affrontera un de plus.`}</div>` : "";
      return `<section class="panel gperco ${a ? "hot" : ""}"><div class="phead"><h2>${h(p.name || p.sid)}</h2><span class="xs muted">niv. ${p.zlvl || "?"} · posé par ${h(p.by || "?")} · ${p.wins} défense${p.wins > 1 ? "s" : ""} réussie${p.wins > 1 ? "s" : ""}, ${p.losses} pillage${p.losses > 1 ? "s" : ""}</span></div><div class="pad stack">
        <div class="gbar"><i style="width:${Math.min(100, f * 100).toFixed(1)}%"></i><b>poche ${Math.round(f * 100)} %${f > 1 ? " (bonus de défense)" : f >= 1 ? " (pleine)" : ""}</b></div>
        <div class="row small"><span class="coin"></span><b class="num">${fmt(Math.floor(cap.k * Math.min(f, 2.5)))}</b> ${res}</div>
        ${atk}${r}
        <div class="row"><button class="btn sm ${f >= 1 ? "primary" : ""}" data-act="g-collect" data-g="${p.id}" ${a || f < 0.05 || G.busy ? "disabled" : ""}>Récolter</button>
          ${off ? (G.sureRm === p.id ? `<button class="btn sm danger" data-act="g-prm" data-g="${p.id}">Oui, retirer</button>` : `<button class="btn sm" data-act="g-prm" data-g="${p.id}" ${a ? "disabled" : ""}>Retirer</button>`) : ""}
          <span class="xs muted">${a ? "" : `Prochaine attaque vers ${new Date(Date.parse(p.next) - (G.off || 0)).toLocaleTimeString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</span></div>
      </div></section>`;
    }).join("");
    const used = new Set(P.map((p) => p.sid)); const zones = E.percoZones(s).filter((z) => !used.has(z)).sort((a, b) => (E.SUBS[b].lvl[0] - E.SUBS[a].lvl[0]));
    if (G.zone && !zones.includes(G.zone)) G.zone = "";
    const z = G.zone || zones[0]; const cap = z ? E.percoCap(z) : null;
    const place = !slots ? `<div class="pad small muted">Le premier Percepteur arrive au niveau 5 de guilde.</div>`
      : P.length >= slots ? `<div class="pad small muted">${P.length} / ${slots} Percepteurs posés.${E.percoNextSlot(lvl) ? ` Le suivant au niveau ${E.percoNextSlot(lvl)} de guilde.` : ""}</div>`
      : !off ? `<div class="pad small muted">Le Meneur et les Bras droits posent les Percepteurs (${P.length} / ${slots}).</div>`
      : !zones.length ? `<div class="pad small muted">Il faut une zone finie : tous ses monstres au palier Traqueur (le trophée de la zone).</div>`
      : `<div class="pad stack"><div class="row"><select id="gZone" data-act="g-zone">${zones.map((k) => `<option value="${k}" ${k === z ? "selected" : ""}>${h(E.SUBS[k].name)} (niv. ${E.SUBS[k].lvl[0]}-${E.SUBS[k].lvl[1]})</option>`).join("")}</select>
          <button class="btn primary sm" data-act="g-place" ${s.kamas < E.PERCO_PRICE || G.busy ? "disabled" : ""}>Poser (${fmt(E.PERCO_PRICE)} kamas)</button></div>
          ${cap ? `<span class="xs muted">Poche pleine en ${E.PERCO_FILL_H} h : ${fmt(cap.k)} kamas et ${Object.keys(cap.res).slice(0, 4).map((k) => `${fmt(cap.res[k])} ${h(k)}`).join(", ")}…</span>` : ""}
          ${s.kamas < E.PERCO_PRICE ? `<span class="xs" style="color:var(--danger)">Il te manque ${fmt(E.PERCO_PRICE - s.kamas)} kamas.</span>` : ""}</div>`;
    return `<section class="panel"><div class="phead"><h2>Percepteurs</h2><span class="xs muted">${P.length} / ${slots}</span></div>
        <div class="pad small muted">Posé dans une zone finie, un Percepteur ramasse ${E.PERCO_RATE} % des kamas et ressources qu'on y gagnerait : sa poche est pleine en ${E.PERCO_FILL_H} h. N'importe quel membre peut la récolter (+ XP de guilde). Environ une fois par jour, des monstres l'attaquent : chaque membre peut tenter une défense avec son équipe pendant ${E.PERCO_ATK_H} h. Il n'est jamais détruit.</div>
        ${place}</section>${cards}`;
  }

  function membersHtml() {
    const me = G.me.rank; const asks = G.me.asks || [];
    const canRank = (m) => m.u !== ON.user.id && (me === 0 || (me === 1 && m.rank >= 2));
    const canKick = (m) => m.u !== ON.user.id && me <= 1 && m.rank > me;
    const req = me <= 1 && asks.length ? `<section class="panel" style="border-color:var(--gold)"><div class="phead"><h2>Demandes pour entrer</h2></div><div class="list">${asks.map((a) => `<div class="li">${X().cmed(a.cls, a.lvl)}<span class="grow"><b>${h(a.p)}</b> <span class="xs muted">niv. ${a.lvl || 1}</span></span><button class="btn sm primary" data-act="g-ask" data-u="${h(a.u)}" data-v="1">Accepter</button><button class="btn sm" data-act="g-ask" data-u="${h(a.u)}" data-v="0">Refuser</button></div>`).join("")}</div></section>` : "";
    const rows = G.me.members.map((m) => `<div class="gmrow${X().staffCls(m.u)}">${X().cmed(m.cls, m.lvl)}<span class="grow"><b>${X().pname(m.p, m.u)}</b>${m.u === ON.user.id ? ` <span class="xs muted">(toi)</span>` : ""}<br><span class="xs muted">niv. ${m.lvl || 1} · ${ago(m.seen)}</span></span>
      <span class="grk r${m.rank}">${RANKS[m.rank]}</span>
      <span class="xs num hm">${m.share} % · ${fmt(m.week)} XP cette semaine</span>
      <span class="gact">${canRank(m) ? `<select data-act="g-rank" data-u="${h(m.u)}" aria-label="Rang">${RANKS.map((r, i) => (me === 0 || i >= 2) ? `<option value="${i}" ${i === m.rank ? "selected" : ""}>${i === 0 ? "Meneur (donner ma place)" : r}</option>` : "").join("")}</select>` : ""}${canKick(m) ? `<button class="btn sm" data-act="g-kick" data-u="${h(m.u)}" data-p="${h(m.p)}">Renvoyer</button>` : ""}</span></div>`).join("");
    const inv = me <= 2 ? `<div class="pad row"><input type="text" id="gInv" placeholder="Pseudo d'un joueur" maxlength="16" style="max-width:220px"><button class="btn sm" data-act="g-invite" ${G.me.members.length >= MAXM ? "disabled" : ""}>Inviter</button>${(G.me.invited || []).length ? `<span class="xs muted">Invités : ${G.me.invited.map(h).join(", ")}</span>` : ""}</div>` : `<div class="pad xs muted">Les recrues pourront inviter une fois Membres.</div>`;
    return `${req}<section class="panel"><div class="phead"><h2>Membres</h2><span class="xs muted">${G.me.members.length} / ${MAXM}</span></div><div class="list">${rows}</div>${inv}</section>
      <p class="xs muted">Meneur : tout. Bras droit : accepte les demandes, gère et renvoie Membres et Recrues, change le message du jour. Membre : invite. Recrue : discute et participe.</p>`;
  }
  function logHtml() {
    return `<section class="panel"><div class="phead"><h2>Journal de la guilde</h2></div><div class="list">${(G.me.log || []).map((l) => `<div class="li small"><span class="grow">${h(l.t)}</span><span class="xs muted">${ago(l.at).replace("en ligne", "à l'instant")}</span></div>`).join("") || `<div class="empty">Rien pour l'instant.</div>`}</div></section>`;
  }
  function setHtml() {
    const g = G.me.g; const off = G.me.rank <= 1; const f = G.form;
    if (!G.setInit) { f.motd = g.motd; f.open = g.open; f.ic = g.ic; f.col = g.col; G.setInit = true; }
    return `${off ? `<section class="panel"><div class="phead"><h2>Réglages</h2></div><div class="pad stack">
        <label class="small"><b>Message du jour</b></label><input type="text" id="gMotd" maxlength="200" value="${h(f.motd || "")}" placeholder="Visible par tous, aussi dans la liste des guildes">
        <label class="row small"><input type="checkbox" id="gOpen" ${f.open ? "checked" : ""}> Entrée libre (sinon, les joueurs envoient une demande)</label>
        ${G.me.rank === 0 ? `<div class="gfound">${emb(f.ic, f.col, 60)}<div class="stack grow"><div class="gpick">${ICONS.map((ic) => `<button class="${f.ic === ic ? "on" : ""}" data-act="g-ic" data-v="${ic}" aria-label="${ic}"><img src="assets/ui/${ic}.webp" alt=""></button>`).join("")}</div><div class="gpick col">${COLS.map((c) => `<button class="${f.col === c ? "on" : ""}" data-act="g-col" data-v="${c}" style="background:${c}" aria-label="couleur"></button>`).join("")}</div></div></div>` : ""}
        <div><button class="btn primary" data-act="g-save">Enregistrer</button></div></div></section>` : ""}
      <section class="panel"><div class="phead"><h2>Quitter la guilde</h2></div><div class="pad row between"><span class="small muted">${G.me.rank === 0 && G.me.members.length > 1 ? "Ta place de Meneur passera au Bras droit (ou au membre) le plus ancien." : G.me.members.length === 1 ? "Tu es seul : la guilde sera dissoute." : "Tu pourras en rejoindre une autre tout de suite."}</span>
        ${G.leave ? `<button class="btn sm danger" data-act="g-leave2">Oui, quitter</button>` : `<button class="btn sm" data-act="g-leave">Quitter</button>`}</div></section>`;
  }

  /* ---------- panel admin (onglet « Guildes ») ---------- */
  function adminHtml(a) {
    if (!a) return `<div class="box"><div class="empty">Chargement…</div></div>`;
    return `<div class="box"><h2>Guildes (${a.length})</h2>${a.map((g) => `<div class="ln">${emb(g.ic, g.col, 30)}<span><b>${h(g.name)}</b> · niv. ${g.lvl} · ${g.n} membres · Meneur ${h(g.chef || "?")} · ${g.msgs} messages en 24 h${g.motd ? `<br><span class="xs muted">« ${h(g.motd)} »</span>` : ""}</span>
      <span style="margin-left:auto" class="row">${g.motd ? `<button class="btn sm" data-act="g-adm" data-g="${g.id}" data-v="motd">Effacer le message</button>` : ""}<button class="btn sm" data-act="g-admren" data-g="${g.id}" data-p="${h(g.name)}">Renommer</button>${window.CHAT && window.CHAT.role === "admin" ? `<button class="btn sm" data-act="g-adm" data-g="${g.id}" data-v="dissolve">Dissoudre</button>` : ""}</span></div>`).join("") || `<div class="ln muted">Aucune guilde.</div>`}</div>
      <p class="small muted">Renommer ou effacer le message du jour sert pour un nom ou un texte qui ne respecte pas les règles. Dissoudre (admin) renvoie tous les membres ; c'est noté dans le journal.</p>`;
  }
  const admReload = () => { const b = document.querySelector('[data-act="adm-reload"]'); if (b) b.click(); };

  /* ---------- événements ---------- */
  let qT = null;
  document.addEventListener("input", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^g-/.test(a)) return;
    if (a === "g-name") { G.form.name = ev.target.value; clearTimeout(qT); qT = setTimeout(paint, 400); }
    if (a === "g-q") { G.q = ev.target.value; clearTimeout(qT); qT = setTimeout(loadList, 350); }
  });
  document.addEventListener("change", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^g-/.test(a)) return;
    if (a === "g-share") { const s = S(); s.guild = s.guild || { pend: 0 }; s.guild.share = Math.max(0, Math.min(90, +ev.target.value)); X().markDirty(); ON.rpc("guild_give", { p_xp: 0, p_share: s.guild.share }); paint(); }
    if (a === "g-zone") { G.zone = ev.target.value; paint(); }
    if (a === "g-rank") { const u = ev.target.dataset.u; const v = +ev.target.value; call("guild_rank", { p_user: u, p_rank: v }, v === 0 ? "Tu as donné ta place de Meneur." : "Rang changé.").then(load); }
  });
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^g-/.test(a)) return;
    switch (a) {
      case "g-tab": G.tab = d.v; G.leave = false; G.setInit = false; G.sureRm = null; paint(); if (d.v === "boss" || d.v === "percos") loadEx(); return;
      case "g-boss": case "g-def": {
        if (G.fighting) return;
        if (!mine()) { X().toast("Crée ton compte (gratuit) pour les guildes : ta partie te suit."); return; }
        G.fighting = a === "g-def" ? +d.g : true; G.res = null; paint();
        try { await X().onPush(); } catch (e) {} // le serveur rejoue avec la partie en ligne
        const r = await ON.submitGuild(a === "g-def" ? { perco: +d.g } : { gboss: 1 });
        G.fighting = false;
        if (r.net) X().toast("Pas de connexion au serveur : réessaie dans un moment.");
        else if (!r.ok) X().toast(r.err || "Refusé par le serveur.");
        else { G.res = Object.assign({ id: +d.g || 0 }, r); X().toast(r.gboss ? `Boss de la semaine : ${fmt(r.points)} points pour ta guilde !` : r.win ? "Percepteur défendu !" : "Défense ratée : un autre membre peut encore tenter.", r.win || r.gboss ? "rare" : undefined); }
        await loadEx(); return; }
      case "g-collect": { const r = await call("perco_collect", { p_after: (S().hdv && S().hdv.op) || 0, p_id: +d.g }); if (r) { if (r.ops && window.MARKET) window.MARKET.apply(r.ops, true); X().toast(`Percepteur récolté : +${fmt(r.k)} kamas et ses ressources, +${fmt(r.gxp)} XP de guilde.`, "rare"); load(); } else loadEx(); return; }
      case "g-place": { const z = G.zone || (($("#gZone") || {}).value); if (!z) return; const r = await call("perco_place", { p_after: (S().hdv && S().hdv.op) || 0, p_sid: z }, "Percepteur posé !"); if (r) { if (r.ops && window.MARKET) window.MARKET.apply(r.ops, true); G.zone = ""; loadEx(); } return; }
      case "g-prm": { if (G.sureRm !== +d.g) { G.sureRm = +d.g; paint(); return; } G.sureRm = null; const r = await call("perco_remove", { p_id: +d.g }, "Percepteur retiré."); if (r) loadEx(); return; }
      case "g-ic": G.form.ic = d.v; paint(); return;
      case "g-col": G.form.col = d.v; paint(); return;
      case "g-create": { const r = await call("guild_create", { p_after: (S().hdv && S().hdv.op) || 0, p_name: G.form.name.trim(), p_ic: G.form.ic, p_col: G.form.col }, "Guilde fondée ! Tu en es le Meneur.");
        if (r) { if (r.ops && window.MARKET) window.MARKET.apply(r.ops, true); G.tab = "home"; await load(); } return; }
      case "g-join": { const r = await call("guild_join", { p_id: +d.g }); if (r) { X().toast(r.ok === "in" ? "Bienvenue dans la guilde !" : "Demande envoyée : le Meneur ou un Bras droit va répondre."); await load(); loadList(); } return; }
      case "g-inv": { const r = await call("guild_answer", { p_gid: +d.g, p_user: null, p_yes: d.v === "1" }, d.v === "1" ? "Bienvenue dans la guilde !" : "Invitation refusée."); if (r) load(); return; }
      case "g-ask": { const r = await call("guild_answer", { p_gid: G.me.g.id, p_user: d.u, p_yes: d.v === "1" }, d.v === "1" ? "Nouveau membre accepté." : "Demande refusée."); if (r) load(); return; }
      case "g-invite": { const p = (($("#gInv") || {}).value || "").trim(); if (!p) return; const r = await call("guild_invite", { p_pseudo: p }, `Invitation envoyée à ${p}.`); if (r) load(); return; }
      case "g-kick": { if (G.kick !== d.u) { G.kick = d.u; X().toast(`Clique encore sur « Renvoyer » pour confirmer (${d.p}).`); return; } G.kick = null; const r = await call("guild_kick", { p_user: d.u }, `${d.p} a été renvoyé.`); if (r) load(); return; }
      case "g-save": { const f = G.form; const r = await call("guild_set", { p_motd: (($("#gMotd") || {}).value || ""), p_open: !!($("#gOpen") || {}).checked, p_ic: f.ic, p_col: f.col }, "Réglages enregistrés."); G.setInit = false; if (r) load(); return; }
      case "g-leave": G.leave = true; paint(); return;
      case "g-leave2": { const r = await call("guild_leave", {}, "Tu as quitté la guilde."); G.leave = false; if (r) { G.list = null; await load(); loadList(); } return; }
      case "g-chat": { const C = window.CHAT && window.CHAT.state; if (C) { C.open = true; C.tab = "u"; chatSeen(); window.CHAT.repaint(); } return; }
      case "g-adm": { if (d.v === "dissolve" && G.admSure !== d.g) { G.admSure = d.g; X().toast("Clique encore sur « Dissoudre » pour confirmer."); return; } const r = await ON.rpc("adm_guild", { p_id: +d.g, p_act: d.v }); X().toast(r.err || (r.data && r.data.err) || "Fait."); admReload(); return; }
      case "g-admren": { X().openSheet(`<h2>Renommer la guilde</h2><input type="text" id="gRen" maxlength="24" value="${h(d.p)}"><div class="row"><button class="btn primary" data-act="g-admren2" data-g="${d.g}">Renommer</button><button class="btn" data-act="closesheet">Annuler</button></div>`); return; }
      case "g-admren2": { const r = await ON.rpc("adm_guild", { p_id: +d.g, p_act: "rename", p_name: (($("#gRen") || {}).value || "").trim() }); X().toast(r.err || (r.data && r.data.err) || "Guilde renommée."); X().closeSheet(); admReload(); return; }
    }
  });

  /* ---------- démarrage (appelé par ui.js) ---------- */
  let started = false, tick = 0;
  function start() {
    if (started) return; started = true;
    setTimeout(sync, 5000);
    setInterval(() => {
      if (!mine() || ON.state === "offline") return; tick++;
      const C = window.CHAT && window.CHAT.state;
      if (inGuild() && ((C && C.open && C.tab === "u") ? true : tick % 8 === 0)) chatPoll();
      if (tick % 15 === 0) sync();
    }, 4000);
  }

  window.GUILD = { start, render, sync, load, say, adminHtml, chatSeen, inGuild,
    get msgs() { return G.chat; }, get unread() { return G.unread; }, G };
})();
