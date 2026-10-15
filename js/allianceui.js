/* ============================================================================
   ALLIANCES ET PRISMES — Idlus (multijoueur, pour la 1.1) : interface
   Onglet « Alliance » de la guilde (choix 1A), prismes sur la carte du Monde, salon « Alliance » du chat (11A),
   bonus du prisme (6A, ajouté au bonus de guilde sous les plafonds), Percepteurs alliés à défendre (9A).
   Règles et chiffres : js/alliance.js (E.ALLY) ; serveur : supabase/alliances.sql (ally_me relu au plus une fois par
   minute, toutes les 15 s pendant la bataille quand on regarde l'onglet) ; combats rejoués par la fonction record.
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const E = window.ENGINE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const GU = () => window.GUILD;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const fk = (n) => `${fmt(Math.round(n || 0))} k`;
  const ICONS = ["dofus", "couronne", "trophee", "cristal", "phenix", "ailes", "coffre", "havre", "monde", "combat", "pioche", "cle"];
  const COLS = ["#7cc7ff", "#8cc63f", "#e8c063", "#ff8a6b", "#e0674f", "#c77dff", "#4fd1c5", "#f0f0e0"];
  const A = { d: null, at: 0, off: 0, loading: false, err: false, form: { name: "", tag: "", ic: "couronne", col: "#7cc7ff" }, fighting: null, res: null, busy: false,
    sel: "", chat: [], after: 0, unread: 0, seen: 0, claiming: false, kick: null, leave: false, list: null };
  const now = () => Date.now() + (A.off || 0);
  const left = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d} j ${hh} h` : hh ? (mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`) : `${mm} min`; };
  const myGid = () => { const s = S(); return (s && s.guild && s.guild.id) || null; };
  const mine = () => !!(S() && ON.user && ON.profile && ON.link().uid === ON.user.id && !(ON.solo && ON.solo()));
  const al = () => (A.d && A.d.al) || null;
  const myAid = () => (al() ? al().id : null);
  const officer = () => !!(A.d && A.d.rank != null && A.d.rank <= 1);
  const chef = () => !!(A.d && A.d.rank === 0);
  const ZN = (id) => ((window.DATA && window.DATA.ZONES) || []).find((z) => z.id === id) || { id, name: id, subs: [{ lvl: [1, 1] }] };
  const zlv = (id) => { const z = ZN(id); const lo = Math.min(...z.subs.map((s) => s.lvl[0])), hi = Math.min(200, Math.max(...z.subs.map((s) => s.lvl[1]))); return lo === hi ? `${lo}` : `${lo}-${hi}`; };
  const allyOf = (aid) => (A.d && A.d.alliances && A.d.alliances[aid]) || (al() && al().id === aid ? al() : null) || { name: "Alliance", tag: "", ic: "dofus", col: "#7d7a6a" };
  const prisms = () => (A.d ? A.d.prisms || [] : []);
  const prismOf = (zid) => prisms().find((p) => p.zone === zid) || null;
  const battle = () => { const b = A.d && A.d.battle; if (b && Date.now() - A.at < 120000) return { on: !!b.on && now() < Date.parse(b.end), ms: b.on ? Date.parse(b.end) - now() : Date.parse(b.start) - now() }; return E.allyBattle(now()); };

  /* ---------- visuels : blason de l'alliance, prisme ---------- */
  let uid = 0;
  const shield = (a, sz) => { const id = "alg" + uid++; const c = h(a.col || "#7cc7ff"); return `<span class="al-emb" style="--ac:${c};--as:${sz}px"><svg viewBox="0 0 48 56" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
    <path d="M24 2 L45 8 V26 C45 40 36 49 24 54 C12 49 3 40 3 26 V8 Z" fill="${c}"/><path d="M24 2 L45 8 V26 C45 40 36 49 24 54 C12 49 3 40 3 26 V8 Z" fill="url(#${id})" opacity=".55"/>
    <path d="M24 5.5 L42 10.5 V26 C42 38 34.5 46 24 50.5 C13.5 46 6 38 6 26 V10.5 Z" fill="none" stroke="#f5e6b0" stroke-width="1.6" opacity=".8"/></svg><img src="assets/ui/${h(a.ic || "dofus")}.webp" alt=""></span>`; };
  const prism = (col, cls = "al-prs") => { const id = "alp" + uid++; const c = h(col || "#7d7a6a"); return `<svg class="${cls}" viewBox="0 0 40 56" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".55"/></linearGradient></defs>
    <ellipse cx="20" cy="51" rx="15" ry="4" fill="#000" opacity=".35"/><path d="M9 50 L31 50 L28 44 L12 44 Z" fill="#6b5a3a"/><path d="M12 44 L28 44 L27 41 L13 41 Z" fill="#9a8458"/>
    <path d="M20 2 L31 18 L26 41 L14 41 L9 18 Z" fill="url(#${id})" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>
    <path d="M20 2 L20 41 M9 18 L20 24 L31 18" stroke="#fff" stroke-opacity=".45" stroke-width=".8" fill="none"/><circle cx="20" cy="15" r="2.2" fill="#fff" opacity=".9"/></svg>`; };
  const tagH = (a) => (a && a.tag ? `<span class="al-tag" style="--ac:${h(a.col)}">${h(a.tag)}</span>` : "");
  const chip = (a, extra) => `<span class="al-chip" style="--ac:${h(a.col)}">${prism(a.col, "")}${h(a.tag || a.name)}${extra ? ` <span class="muted" style="font-weight:600">${extra}</span>` : ""}</span>`;
  const gemb = (g, sz) => `<span class="gemb" style="--gc:${h(g.col || "#8cc63f")};--gs:${sz}px"><img src="assets/ui/${h(g.ic || "dofus")}.webp" alt=""></span>`;
  const bonusTags = (p) => { const m = (p && p.mods) || {};
    return `<span class="tag good">+${E.ALLY.bonus} % kamas</span><span class="tag good">+${E.ALLY.bonus + (m.prospection || 0)} % butin</span><span class="tag good">+${E.ALLY.bonus + (m.sagesse || 0)} % XP</span><span class="tag good">Percepteurs alliés +${Math.round(E.ALLY.percoHp * 100)} % PV</span>`; };
  const modTags = (m) => { m = m || {}; const L = Object.keys(E.ALLY_MODS).filter((k) => m[k]);
    return L.length ? `<div class="al-mods">${L.map((k) => `<span class="al-mod">${E.ALLY_MODS[k].name} <b>${E.ALLY_MODS[k].max === 1 ? "✓" : "rang " + m[k]}</b></span>`).join("")}</div>` : ""; };

  /* ---------- données ---------- */
  async function load(force) {
    if (!ON.user || A.loading || !mine() || !myGid()) return;
    const gap = A.err ? 30000 : battle().on && window.DX.ui.tab === "guild" && GU() && GU().G.tab === "alliance" ? 15000 : 60000;
    if (!force && A.at && Date.now() - A.at < gap) return; // aussi après une erreur : pas de relecture à chaque rendu
    A.loading = true;
    const r = await ON.rpc("ally_me");
    A.loading = false; A.at = Date.now();
    if (r.err || !r.data || r.data.err) { const was = A.err; A.err = true; if (!was && window.DX.ui.tab === "guild") repaint(); return; }
    A.err = false; A.d = r.data; A.off = Date.parse(r.data.now) - Date.now();
    if (A.d.claim && !A.claiming) claim();
    repaint();
  }
  function repaint() {
    const ui = window.DX.ui;
    if (ui.tab === "guild" && GU()) GU().paint(true);
    else if (ui.tab === "world" && !document.querySelector("#sheet .sheet")) window.DX.render();
  }
  async function claim() {
    A.claiming = true;
    const r = await ON.rpc("ally_claim", { p_after: (S().hdv && S().hdv.op) || 0 });
    A.claiming = false;
    if (r.data && r.data.ops && window.MARKET) window.MARKET.apply(r.data.ops, true);
    if (r.data && r.data.ok) { X().toast(`👑 Ton alliance est première du classement des prismes : titre « ${E.ALLY.title} » et ornement « Prisme des Douze » !`, "rare"); A.d.claim = false; }
  }
  async function call(name, args, okTxt) {
    if (A.busy) return null;
    A.busy = true; GU().paint();
    const r = await ON.rpc(name, args);
    A.busy = false;
    const err = r.err ? "Pas de connexion au serveur : réessaie dans un moment." : r.data && r.data.err;
    if (err) { X().toast(err); GU().paint(); return null; }
    if (okTxt) X().toast(okTxt, "rare");
    return r.data || {};
  }

  /* ---------- bonus du prisme (6A) : E.guildBonus (js/guilds.js) l'ajoute, sous les plafonds du jeu ---------- */
  function bonus(s, kind) {
    const aid = myAid(); if (!aid || !s || !s.sub || !s.guild || s.guild.id !== (A.d && A.d.gid)) return 0;
    const p = prismOf(E.allyRegion(s.sub)); if (!p || p.aid !== aid) return 0;
    return E.allyBonus(p, kind, window.CHASSE ? window.CHASSE.domBonus(s, kind) : 0);
  }
  const allied = (gid) => !!(al() && gid && gid !== myGid() && (al().guilds || []).some((g) => g.id === gid));

  /* ---------- onglet « Alliance » : sans alliance (fonder, rejoindre) ---------- */
  function noneHtml() {
    const d = A.d; const f = A.form; const lvlOk = (d.glvl || 1) >= E.ALLY.foundLvl; const chestOk = (d.chest || 0) >= E.ALLY.foundK;
    const inv = (d.invites || []).map((x) => `<div class="li al-gl">${shield(x, 36)}<span class="grow"><b>${h(x.name)}</b> ${tagH(x)}<br><span class="xs muted">${x.n} / ${E.ALLY.max} guildes · invitation de ${h(x.by || "?")}</span></span>${chef() ? `<span class="row"><button class="btn sm primary" data-act="al-inv" data-a="${x.aid}" data-v="1" ${A.busy ? "disabled" : ""}>Accepter</button><button class="btn sm" data-act="al-inv" data-a="${x.aid}" data-v="0" ${A.busy ? "disabled" : ""}>Refuser</button></span>` : `<span class="xs muted">le Meneur répond</span>`}</div>`).join("");
    const found = `<section class="panel"><div class="pad al-found">${shield(f, 84)}<div class="grow stack" style="gap:8px"><h2 style="font-size:22px">Fonder une alliance</h2>
      <span class="small muted">Une alliance réunit jusqu'à ${E.ALLY.max} guildes grâce à une Alliogemme. Ensemble, elles posent des prismes pour tenir des régions du Monde (+${E.ALLY.bonus} % de kamas, de butin et d'XP pour tous leurs membres dans la région), ne peuvent pas s'attaquer et défendent les Percepteurs les unes des autres.</span>
      <div class="al-cost"><span class="tag ${chestOk ? "good" : "soft"}">${X().IC("coffre")} ${fk(E.ALLY.foundK)} du coffre de guilde</span><span class="tag ${lvlOk ? "good" : "soft"}">guilde niveau ${E.ALLY.foundLvl}</span><span class="tag ${chef() ? "good" : "soft"}">Meneur seulement</span></div>
      ${chef() ? `<div class="gpick">${ICONS.map((ic) => `<button class="${f.ic === ic ? "on" : ""}" data-act="al-ic" data-v="${ic}" aria-label="${ic}"><img src="assets/ui/${ic}.webp" alt=""></button>`).join("")}</div>
        <div class="gpick col">${COLS.map((c) => `<button class="${f.col === c ? "on" : ""}" data-act="al-col" data-v="${c}" style="background:${c}" aria-label="couleur"></button>`).join("")}</div>
        <div class="row"><input type="text" id="alName" maxlength="${E.ALLY.nameMax}" placeholder="Nom de l'alliance" value="${h(f.name)}" style="max-width:240px"><input type="text" id="alTag" maxlength="4" placeholder="Sigle" value="${h(f.tag)}" style="max-width:80px;text-transform:uppercase"><button class="btn primary" data-act="al-found" ${!lvlOk || !chestOk || A.busy ? "disabled" : ""}>Fonder l'alliance</button></div>` : ""}
      <span class="xs muted">Coffre de ta guilde : ${fk(d.chest)} · guilde niveau ${d.glvl || 1}${lvlOk ? " ✓" : ""}</span></div></div></section>`;
    const list = (d.list || []); const asked = d.asked || [];
    const rows = list.map((x) => { const full = x.n >= E.ALLY.max;
      return `<div class="li al-rank"><span></span>${shield(x, 34)}<span class="grow"><b>${h(x.name)}</b> ${tagH(x)}<br><span class="xs muted">${(x.guilds || []).map(h).join(", ")}${x.regions ? ` · ${x.regions} prisme${x.regions > 1 ? "s" : ""}` : ""}</span></span><span class="tag ${full ? "soft" : "good"}">${x.n} / ${E.ALLY.max} guildes</span>${full ? `<span class="xs muted hm">complète</span>` : asked.includes(x.id) ? `<span class="xs muted hm">demande envoyée</span>` : chef() ? `<button class="btn sm hm" data-act="al-ask" data-a="${x.id}" ${A.busy ? "disabled" : ""}>Demander à rejoindre</button>` : `<span class="hm"></span>`}</div>`; }).join("");
    return `${inv ? `<section class="panel"><div class="phead"><h2>Invitations</h2></div><div class="list">${inv}</div></section>` : ""}${found}
      <section class="panel"><div class="phead"><h2>Alliances du serveur</h2><span class="xs muted">${list.length} alliance${list.length > 1 ? "s" : ""}</span></div><div class="list">${rows || `<div class="empty">Aucune alliance pour l'instant. Fonde la première !</div>`}</div></section>`;
  }

  /* ---------- onglet « Alliance » : dans une alliance ---------- */
  function banner() {
    const a = al(); const G = a.guilds || []; const n = G.reduce((s, g) => s + (g.n || 0), 0); const P = prisms().filter((p) => p.aid === a.id);
    const fd = G.find((g) => g.id === a.founder);
    return `<section class="panel al-ban" style="--ac:${h(a.col)}">${shield(a, 74)}<div class="grow stack" style="gap:6px"><div class="row"><h2>${h(a.name)}</h2>${tagH(a)}</div>
      <div class="row"><span class="tag good">${G.length} / ${E.ALLY.max} guildes</span><span class="xs muted">${n} membres · ${P.length} prisme${P.length > 1 ? "s" : ""}${fd ? ` · dirigée par ${h(fd.name)}` : ""}</span></div>
      <div class="al-bon"><span class="xs muted" style="align-self:center">${P.length ? `Dans nos ${P.length > 1 ? `${P.length} régions` : "région"} :` : "Dans chaque région de nos prismes :"}</span>${bonusTags(null)}</div></div>
      <button class="btn sm mktrade" data-act="al-chat">${X().G("chat")} Chat d'alliance</button></section>`;
  }
  function prismsPanel() {
    const a = al(); const P = prisms().filter((p) => p.aid === a.id); const b = battle();
    const rows = P.map((p) => `<div class="li al-pr">${prism(a.col)}<span class="grow" style="min-width:0"><b>${h(ZN(p.zone).name)}</b> <span class="xs muted">niv. ${zlv(p.zone)}${p.by ? ` · posé par ${h(p.by)}` : p.g ? ` · pris par ${h(p.g)}` : ""}</span>
        <br>${b.on ? `<span class="al-vuln now">⚔ bataille en cours</span>` : `<span class="al-safe">🛡 jusqu'à la bataille (${E.allyBattleWhen()})</span>`}${modTags(p.mods)}</span>
        <span class="al-act row" style="justify-content:flex-end">${officer() && !b.on ? `<button class="btn sm" data-act="al-up" data-z="${p.zone}">Améliorer</button>` : ""}</span></div>`).join("");
    return `<section class="panel"><div class="phead"><h2>Nos prismes</h2><span class="xs muted">${P.length} région${P.length > 1 ? "s" : ""} tenue${P.length > 1 ? "s" : ""}</span></div><div class="list">
      ${rows || `<div class="empty">Pas encore de prisme. Une guilde de l'alliance doit dominer une région (le plus de Percepteurs) pour en poser un.</div>`}
      <div class="li"><span class="grow xs muted">Les prismes ne craignent rien en dehors de la bataille des prismes, ${E.allyBattleWhen()} : toutes les régions s'y jouent en même temps.</span></div></div></section>`;
  }
  function guildsPanel() {
    const a = al(); const G = a.guilds || []; const free = Math.max(0, E.ALLY.max - G.length);
    const rows = G.map((g) => `<div class="li al-gl">${gemb(g, 40)}<span class="grow"><b>${h(g.name)}</b>${g.id === a.founder ? ` <span class="tag soft">dirige</span>` : ""}<br><span class="xs muted">niv. ${g.lvl} · ${g.n} membre${g.n > 1 ? "s" : ""}${g.chef ? ` · Meneur ${h(g.chef)}` : ""}${g.percos ? ` · ${g.percos} Percepteur${g.percos > 1 ? "s" : ""}` : ""}</span></span>
      ${g.id === myGid() ? `<span class="tag good">ta guilde</span>` : a.lead && chef() ? (A.kick === g.id ? `<button class="btn sm danger" data-act="al-kick" data-g="${g.id}">Confirmer</button>` : `<button class="btn sm" data-act="al-kick" data-g="${g.id}">Renvoyer</button>`) : `<button class="btn sm" data-act="g-view" data-g="${g.id}">Fiche</button>`}</div>`).join("");
    const asks = (a.asks || []).map((x) => `<div class="li al-gl">${gemb(x, 34)}<span class="grow"><b>${h(x.name)}</b> <span class="xs muted">niv. ${x.lvl} · ${x.n} membres · demande à rejoindre</span></span><span class="row"><button class="btn sm primary" data-act="al-ans" data-g="${x.gid}" data-v="1" ${A.busy ? "disabled" : ""}>Accepter</button><button class="btn sm" data-act="al-ans" data-g="${x.gid}" data-v="0" ${A.busy ? "disabled" : ""}>Refuser</button></span></div>`).join("");
    const inv = (a.invited || []).length ? `<div class="li"><span class="grow xs muted">Invitation${a.invited.length > 1 ? "s" : ""} envoyée${a.invited.length > 1 ? "s" : ""} : ${a.invited.map((x) => h(x.name)).join(", ")}</span></div>` : "";
    const foot = free ? `<div class="li"><span class="grow small muted">${free} place${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""}. ${a.lead ? "Invite une guilde : son Meneur accepte." : "Le Meneur et les Bras droits de la guilde qui dirige l'alliance invitent les guildes."}</span>${a.lead ? `<button class="btn sm primary" data-act="al-invite">Inviter une guilde</button>` : ""}</div>` : `<div class="li"><span class="grow small muted">L'alliance est complète (${E.ALLY.max} guildes au plus).</span></div>`;
    const leave = chef() ? (A.leave ? `<div class="li"><span class="grow small">Ta guilde quitte l'alliance${G.length <= 1 ? " (elle disparaîtra, avec ses prismes)" : ""} ?</span><button class="btn sm danger" data-act="al-leave2" ${A.busy ? "disabled" : ""}>Quitter</button><button class="btn sm" data-act="al-leave0">Annuler</button></div>` : `<div class="li"><span class="grow"></span><button class="btn sm" data-act="al-leave">Quitter l'alliance</button></div>`) : "";
    return `<section class="panel"><div class="phead"><h2>Guildes de l'alliance</h2><span class="xs muted">${G.length} / ${E.ALLY.max}</span></div><div class="list">${rows}${asks}${inv}${foot}${leave}</div></section>`;
  }
  /* 7B, 12A, 13A, 14B : la bataille des prismes */
  function battlePanel() {
    const d = A.d; const a = al(); const b = battle(); const sc = d.score || {};
    const F = d.fights || { used: 0, max: E.ALLY.fights, extra: {} };
    const ptsOf = (z) => sc[z] || {};
    if (!b.on) {
      const L = d.last; const res = (k) => ((L && L[k]) || []);
      const zn = (x) => h(ZN(x.zone).name);
      const mineT = res("taken").filter((x) => x.to === a.id), mineL = res("lost").filter((x) => x.from === a.id), mineF = res("freed").filter((x) => x.from === a.id);
      const last = L ? `<div class="stack" style="gap:6px">${mineT.map((x) => `<div class="al-res win">${prism(a.col)}<span class="small">Dernière bataille : votre alliance a pris <b>${zn(x)}</b> avec ${x.pts} points.</span></div>`).join("")}
        ${mineL.map((x) => `<div class="al-res">${prism(allyOf(x.to).col)}<span class="small">Dernière bataille : ${h(allyOf(x.to).name)} a pris <b>${zn(x)}</b>.</span></div>`).join("")}
        ${mineF.map((x) => `<div class="al-res">${prism("#7d7a6a")}<span class="small">Dernière bataille : égalité à <b>${zn(x)}</b>, la région est redevenue libre.</span></div>`).join("")}</div>` : "";
      return `<section class="panel"><div class="phead"><h2>Bataille des prismes</h2><span class="al-vuln">${E.allyBattleWhen()} · dans ${left(b.ms)}</span></div><div class="pad stack" style="gap:10px">
        <span class="small">Chaque semaine, ${E.allyBattleWhen()} (heure de Paris), toutes les régions se jouent en même temps. Chacun a <b>${E.ALLY.fights} combats</b> avec son équipe d'arène (+${E.ALLY.rally} avec le Ralliement pour défendre sa région) : <b>1 point par victoire</b>.</span>
        <div class="al-note small">⚔ <b>En attaque</b>, ton équipe affronte le prisme et ses gardes (+${Math.round(E.ALLY.prism * 100)} %, +${Math.round(E.ALLY.rempart * 100)} % par rang de Rempart). 🛡 <b>En défense</b>, elle repousse une vague d'assaillants (+${Math.round(E.ALLY.assail * 100)} %). À ${E.ALLY.to} h, l'alliance qui a le plus de points garde ou prend la région (${E.ALLY.freeMin} points au moins pour la prendre) ; égalité en tête : la région redevient libre.</div>
        ${last}</div></section>`;
    }
    /* régions à jouer : les nôtres (défendre), celles des autres (attaquer), les libres déjà disputées */
    const Z = new Set(prisms().map((p) => p.zone).concat(Object.keys(sc)));
    const extra = (z) => (F.extra && F.extra[z]) || 0;
    const canFight = (z, def) => { const p = prismOf(z); return F.used < F.max || (def && p && p.mods && p.mods.ralliement && extra(z) < E.ALLY.rally); };
    const row = (z) => { const p = prismOf(z); const def = !!(p && p.aid === a.id); const pts = ptsOf(z); const tot = Object.values(pts).reduce((s, n) => s + n, 0) || 1;
      const ids = Object.keys(pts).sort((x, y) => pts[y] - pts[x]);
      const holder = p ? allyOf(p.aid) : null;
      return `<div class="al-koth"><span><b>${h(ZN(z).name)}</b> <span class="xs muted">${holder ? `prisme ${h(holder.tag || holder.name)}${p.mods && p.mods.rempart ? ` · Rempart ${p.mods.rempart}` : ""}` : "libre"}</span></span>
        <span class="xs">${ids.length ? ids.map((k) => `<b style="color:${h(allyOf(+k).col)}">${h(allyOf(+k).tag || allyOf(+k).name)} ${pts[k]}</b>`).join(" · ") : `<span class="muted">0 point</span>`}</span>
        <button class="btn sm ${def ? "" : "primary"}" data-act="al-fight" data-z="${z}" ${A.fighting || !canFight(z, def) ? "disabled" : ""}>${A.fighting === z ? "Combat…" : def ? "🛡 Défendre" : "⚔ Attaquer"}</button>
        <div class="al-kbar">${ids.map((k) => `<i style="width:${(pts[k] / tot) * 100}%;background:${h(allyOf(+k).col)}"></i>`).join("")}</div></div>`; };
    const ord = [...Z].sort((x, y) => { const px = prismOf(x), py = prismOf(y); const dx = px && px.aid === a.id ? 0 : px ? 1 : 2, dy = py && py.aid === a.id ? 0 : py ? 1 : 2; return dx - dy || ZN(x).name.localeCompare(ZN(y).name); });
    const freeZ = ((window.DATA && window.DATA.ZONES) || []).filter((z) => !Z.has(z.id));
    const r = A.res;
    const resH = r ? `<div class="al-res ${r.win ? "win" : ""}">${prism(r.win ? a.col : "#7d7a6a")}<span class="small">${r.win ? `Victoire à <b>${h(ZN(r.zone).name)}</b> : +1 point pour ton alliance !` : `Défaite à <b>${h(ZN(r.zone).name)}</b> (${r.rounds} tours).`}</span></div>` : "";
    return `<section class="panel"><div class="phead"><h2>Bataille des prismes</h2><span class="al-vuln now">en cours · fin dans ${left(b.ms)}</span></div><div class="pad stack" style="gap:10px">
      <span class="small">Tes combats : <b>${Math.min(F.used, F.max)} / ${F.max}</b>${Object.keys(F.extra || {}).length ? ` (+ ${Object.values(F.extra).reduce((s, n) => s + n, 0)} de Ralliement)` : ""} · avec ton équipe d'arène (celle du Kolizéum). 1 point par victoire ; à ${E.ALLY.to} h, la meilleure alliance garde ou prend chaque région.</span>
      ${resH}${ord.map(row).join("") || `<div class="empty">Aucun prisme sur la carte : attaque une région libre pour la prendre (${E.ALLY.freeMin} points au moins).</div>`}
      ${F.used < F.max && freeZ.length ? `<div class="row"><select id="alFree" aria-label="Région libre">${freeZ.map((z) => `<option value="${z.id}" ${A.sel === z.id ? "selected" : ""}>${h(z.name)} (niv. ${zlv(z.id)})</option>`).join("")}</select><button class="btn sm primary" data-act="al-fight" data-z="" ${A.fighting ? "disabled" : ""}>⚔ Attaquer cette région libre</button></div>` : ""}
      </div></section>`;
  }
  function posePanel() {
    const L = A.d.dom || []; const b = battle();
    const rows = L.map((x) => `<div class="li al-pr">${prism(al().col)}<span class="grow" style="min-width:0"><b>${h(ZN(x.zone).name)}</b> <span class="xs muted">niv. ${zlv(x.zone)} · région libre</span><br><span class="xs">dominée par ${h(x.g)} (le plus de Percepteurs)</span></span>
      <span class="al-act row" style="justify-content:flex-end">${officer() ? `<button class="btn sm primary" data-act="al-place" data-z="${x.zone}" ${A.busy || b.on || (A.d.chest || 0) < E.ALLY.prismK ? "disabled" : ""}>Poser · ${fk(E.ALLY.prismK)}</button>` : `<span class="xs muted">Meneur ou Bras droit</span>`}</span></div>`).join("");
    return `<section class="panel"><div class="phead"><h2>Poser un prisme</h2><span class="xs muted">${fk(E.ALLY.prismK)} du coffre de ta guilde</span></div><div class="list">
      ${rows || `<div class="empty">Aucune région libre dominée par une guilde de l'alliance pour l'instant.</div>`}
      <div class="li"><span class="grow xs muted">Une guilde de l'alliance doit dominer la région (le plus de Percepteurs, Chasse aux Percepteurs). Une fois posé, le prisme garde la région même si la domination change, jusqu'à ce qu'il tombe pendant une bataille.${(A.d.chest || 0) < E.ALLY.prismK ? ` Coffre de ta guilde : ${fk(A.d.chest)}.` : ""}</span></div></div></section>`;
  }
  /* 9A : Percepteurs alliés attaqués */
  function helpPanel() {
    const L = A.d.help || []; const G = GU() && GU().G;
    const rows = L.map((x) => `<div class="li al-pr">${gemb(x.dg || {}, 40)}<span class="grow" style="min-width:0"><b>${h(x.zone)}</b> <span class="xs muted">Percepteur de ${h((x.dg || {}).name)}</span><br><span class="xs al-warn">⚔ attaqué par ${h(x.by)} (${h((x.ag || {}).name)}) · fin dans ${left(Date.parse(x.ends) - now())}</span></span>
      <span class="al-act row" style="justify-content:flex-end">${x.tried ? `<span class="tag soft">déjà tenté</span>` : `<button class="btn sm primary" data-act="g-rdef" data-g="${x.id}" ${G && (G.fighting || G.busy) ? "disabled" : ""}>${G && G.fighting === "r" + x.id ? "Combat en cours…" : "⚔ Aider à défendre"}</button>`}</span></div>`).join("");
    return `<section class="panel"><div class="phead"><h2>Percepteurs alliés</h2><span class="xs muted">${L.length ? `${L.length} attaque${L.length > 1 ? "s" : ""} en cours` : "aucune attaque"}</span></div><div class="list">${rows}
      <div class="li"><span class="grow xs muted">Les guildes d'une même alliance ne peuvent pas s'attaquer. Chacun peut aider à défendre les Percepteurs alliés, une fois par attaque : une défense gagnée compte pour ta guilde. Dans une région d'un de nos prismes, nos Percepteurs ont +${Math.round(E.ALLY.percoHp * 100)} % de PV.</span></div></div></section>`;
  }
  function rankPanel() {
    const T = A.d.top || []; const a = al();
    const rows = T.map((x, i) => `<div class="li al-rank ${x.id === a.id ? "me" : ""}"><span class="n">${i + 1}</span>${shield(x, 30)}<span class="grow"><b>${h(x.name)}</b> ${tagH(x)}</span><span class="tag good">${x.regions} région${x.regions > 1 ? "s" : ""}</span><span class="xs muted hm">${x.wins} combat${x.wins > 1 ? "s" : ""} gagné${x.wins > 1 ? "s" : ""}</span></div>`).join("");
    const L = A.d.last && A.d.last.top && A.d.last.top[0];
    return `<section class="panel"><div class="phead"><h2>Classement des alliances</h2><span class="xs muted">cette semaine</span></div><div class="list">${rows || `<div class="empty">Personne au classement pour l'instant.</div>`}
      <div class="li"><span class="grow xs muted">Régions tenues, puis combats gagnés à la bataille. Le lundi, les membres des guildes de l'alliance première reçoivent le titre « ${E.ALLY.title} » et l'ornement « Prisme des Douze ».${L ? ` Semaine passée : ${h(L.name)}.` : ""}</span></div></div></section>`;
  }
  function pageHtml() {
    if (!mine()) return `<div class="empty">Les alliances se jouent avec la partie en ligne.</div>`;
    load();
    if (!A.d) return `<div class="empty">${A.err ? "Pas de connexion au serveur : réessaie dans un moment." : "Chargement…"}</div>`;
    if (!al()) return noneHtml();
    return `${banner()}<div class="grid2g even">${battlePanel()}${prismsPanel()}${helpPanel()}${guildsPanel()}${posePanel()}${rankPanel()}</div>`;
  }

  /* ---------- carte du Monde (ui.js) ---------- */
  function foldTag(z) {
    load(); const p = prismOf(z.id); if (!p) return "";
    const a = allyOf(p.aid); const me = p.aid === myAid();
    return `<span data-tip="Prisme de l'alliance ${h(a.name)} : +${E.ALLY.bonus} % de kamas, de butin et d'XP pour ses membres dans toute la région">${chip(a, me ? "· bonus" : "")}</span>`;
  }
  function zoneBox(sid) {
    load(); const z = E.allyRegion(sid); const p = z && prismOf(z); if (!p) return "";
    const a = allyOf(p.aid); const me = p.aid === myAid(); const b = battle();
    return `<div class="al-zone" style="--ac:${h(a.col)}">${prism(a.col)}<div class="grow stack" style="gap:5px"><b>Prisme de l'alliance ${h(a.name)} ${tagH(a)}</b>
      <span class="xs muted">Dans toute la région ${h(ZN(z).name)}, ${me ? "les membres de ton alliance gagnent" : "les membres de cette alliance gagnent"} :</span><div class="al-bon">${bonusTags(p)}</div>${modTags(p.mods)}
      <div class="row">${b.on ? `<span class="al-vuln now">⚔ bataille des prismes en cours</span>${myAid() ? `<button class="btn sm primary" data-act="al-go" data-gotab="guild">${me ? "🛡 Défendre" : "⚔ Attaquer"}</button>` : ""}` : `<span class="al-safe">🛡 jusqu'à la bataille, ${E.allyBattleWhen()}</span>`}</div></div></div>`;
  }
  function mapLegend() {
    load(); if (!prisms().length) return "";
    const n = prisms().filter((p) => p.aid === myAid()).length; const a = al();
    return `<section class="panel al-legend"><div class="pad al-mapl">${prism(a ? a.col : "#7cc7ff")}<span class="grow small">💎 Un prisme par région : l'alliance qui le tient y donne +${E.ALLY.bonus} % de kamas, de butin et d'XP à ses membres.${a ? ` Ton alliance ${tagH(a)} tient <b>${n} région${n > 1 ? "s" : ""}</b>.` : ""}${battle().on ? " <b>Bataille des prismes en cours !</b>" : ""}</span>${myGid() ? `<button class="btn sm" data-act="al-go" data-gotab="guild">Alliance</button>` : ""}</div></section>`;
  }

  /* ---------- sheet des améliorations (8A) ---------- */
  function upSheet(zone) {
    const p = prismOf(zone); if (!p) return; const m = p.mods || {}; const chest = (A.d && A.d.chest) || 0;
    X().openSheet(`<h2>💎 Prisme de ${h(ZN(zone).name)}</h2><p class="small muted">Améliorations payées avec le coffre de ta guilde (${fk(chest)}). Elles restent tant que le prisme ne tombe pas.</p>
      <div class="list">${Object.entries(E.ALLY_MODS).map(([k, M]) => { const r = m[k] || 0; const price = E.allyModK(k, r);
        return `<div class="li al-gl">${prism(al().col)}<span class="grow"><b>${M.ic} ${M.name}</b> <span class="tag soft">${M.max === 1 ? (r ? "active" : "unique") : `rang ${r} / ${M.max}`}</span><br><span class="xs muted">${M.txt(Math.max(1, r + (price ? 1 : 0)))}${M.max > 1 ? " (au rang suivant)" : ""}</span></span>${price == null ? `<span class="tag good">max</span>` : `<button class="btn sm ${k === "rempart" ? "primary" : ""}" data-act="al-up2" data-z="${zone}" data-k="${k}" ${chest < price || A.busy ? "disabled" : ""}>${fk(price)}</button>`}</div>`; }).join("")}</div>
      <div class="row"><button class="btn" data-act="closesheet">Fermer</button></div>`);
  }
  async function inviteSheet() {
    X().openSheet(`<h2>Inviter une guilde</h2><div class="empty">Chargement…</div>`);
    const r = await ON.rpc("guild_list", { p_q: "" }); const ids = new Set((al().guilds || []).map((g) => g.id).concat((al().invited || []).map((x) => x.gid)));
    const L = (r.data || []).filter((g) => !ids.has(g.id));
    X().openSheet(`<h2>Inviter une guilde</h2><p class="small muted">Son Meneur accepte dans Communauté › Guilde › Alliance. ${E.ALLY.max} guildes au plus.</p>
      <div class="list" style="max-height:60vh;overflow:auto">${L.map((g) => `<div class="li al-gl">${gemb(g, 34)}<span class="grow"><b>${h(g.name)}</b><br><span class="xs muted">niv. ${g.lvl} · ${g.n} membres</span></span><button class="btn sm primary" data-act="al-invite2" data-g="${g.id}">Inviter</button></div>`).join("") || `<div class="empty">Aucune autre guilde.</div>`}</div>
      <div class="row"><button class="btn" data-act="closesheet">Fermer</button></div>`);
  }

  /* ---------- chat « Alliance » (js/chat.js, onglet a) ---------- */
  async function chatPoll() {
    if (!myAid() || !mine()) return;
    const r = await ON.rpc("ally_chat", { p_after: A.after }); const L = r.data || [];
    if (!L.length) return;
    L.forEach((m) => { if (!A.chat.some((x) => x.id === m.id)) A.chat.push(m); });
    A.chat.sort((a, b) => a.id - b.id); A.chat = A.chat.slice(-150); A.after = A.chat[A.chat.length - 1].id;
    const C = window.CHAT && window.CHAT.state;
    const fresh = L.filter((m) => m.kind === "msg" && m.user_id !== ON.user.id && m.id > A.seen).length;
    if (!(C && C.open && C.tab === "a") && A.seen) A.unread += fresh;
    if (!A.seen || (C && C.open && C.tab === "a")) A.seen = A.after;
    if (window.CHAT && window.CHAT.repaint) window.CHAT.repaint();
  }
  async function say(body) {
    const r = await ON.rpc("ally_say", { p_body: body });
    if (r.err) return r.err; if (r.data) return r.data;
    await chatPoll(); return null;
  }
  const chatSeen = () => { A.unread = 0; A.seen = A.after; };
  const inAlliance = () => !!myAid();

  /* ---------- événements ---------- */
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^al-/.test(a)) return;
    switch (a) {
      case "al-ic": A.form.ic = d.v; GU().paint(); return;
      case "al-col": A.form.col = d.v; GU().paint(); return;
      case "al-found": {
        const f = A.form; f.name = ((document.querySelector("#alName") || {}).value || "").trim(); f.tag = ((document.querySelector("#alTag") || {}).value || "").trim().toUpperCase();
        if (!E.allyNameOk(f.name)) { X().toast(`Le nom fait de ${E.ALLY.nameMin} à ${E.ALLY.nameMax} caractères (lettres, chiffres, espaces, apostrophes, tirets).`); return; }
        if (!/^[A-Z0-9]{2,4}$/.test(f.tag)) { X().toast("Le sigle fait de 2 à 4 lettres ou chiffres."); return; }
        const r = await call("ally_found", { p_name: f.name, p_tag: f.tag, p_ic: f.ic, p_col: f.col }, `🤝 Alliance « ${f.name} » fondée ! Invite d'autres guildes.`);
        if (r) { f.name = ""; f.tag = ""; GU().load(); }
        return load(true); }
      case "al-inv": { const r = await call("ally_answer", { p_aid: +d.a, p_gid: null, p_yes: d.v === "1" }, d.v === "1" ? "🤝 Ta guilde rejoint l'alliance !" : "Invitation refusée."); if (r) load(true); return; }
      case "al-ans": { const r = await call("ally_answer", { p_aid: myAid(), p_gid: +d.g, p_yes: d.v === "1" }, d.v === "1" ? "🤝 Nouvelle guilde dans l'alliance !" : "Demande refusée."); if (r) load(true); return; }
      case "al-ask": { const r = await call("ally_ask", { p_aid: +d.a }, "Demande envoyée : la guilde qui dirige l'alliance va répondre."); if (r) load(true); return; }
      case "al-invite": inviteSheet(); return;
      case "al-invite2": { X().closeSheet(); const r = await call("ally_invite", { p_gid: +d.g }, "Invitation envoyée."); if (r) load(true); return; }
      case "al-kick": { if (A.kick !== +d.g) { A.kick = +d.g; GU().paint(); return; } A.kick = null; const r = await call("ally_kick", { p_gid: +d.g }, "Guilde renvoyée de l'alliance."); if (r) load(true); return; }
      case "al-leave": A.leave = true; GU().paint(); return;
      case "al-leave0": A.leave = false; GU().paint(); return;
      case "al-leave2": { A.leave = false; const r = await call("ally_leave", {}, "Ta guilde a quitté l'alliance."); if (r) { A.chat = []; A.after = 0; A.seen = 0; } load(true); return; }
      case "al-place": { const r = await call("prism_place", { p_zone: d.z }, `💎 Prisme posé à ${ZN(d.z).name} !`); if (r) { GU().load(); load(true); } return; }
      case "al-up": upSheet(d.z); return;
      case "al-up2": { X().closeSheet(); const r = await call("prism_up", { p_zone: d.z, p_mod: d.k }, `💎 Prisme de ${ZN(d.z).name} : ${E.ALLY_MODS[d.k].name} amélioré.`); if (r) { if (A.d) A.d.chest = r.chest; GU().load(); load(true); } return; }
      case "al-chat": { const C = window.CHAT && window.CHAT.state; if (C) { C.open = true; C.tab = "a"; chatSeen(); chatPoll(); window.CHAT.repaint(); } return; }
      case "al-go": { const G = GU() && GU().G; if (G) { G.tab = "alliance"; G.atk = null; G.view = null; } load(true); window.DX.render(); window.scrollTo(0, 0); return; }
      case "al-fight": {
        if (A.fighting) return;
        const z = d.z || ((document.querySelector("#alFree") || {}).value || ""); if (!z) return; A.sel = d.z ? A.sel : z;
        A.fighting = z; A.res = null; GU().paint();
        try { await X().onPush(); } catch (e) {} // l'équipe d'arène vient de la partie en ligne
        const r = await ON.submitGuild({ prism: z });
        A.fighting = null;
        if (r.net) X().toast("Pas de connexion au serveur : réessaie dans un moment.");
        else if (!r.ok) X().toast(r.err || "Refusé par le serveur.");
        else { A.res = r; X().toast(r.win ? `⚔ Victoire à ${ZN(z).name} : +1 point pour ton alliance !` : `Défaite à ${ZN(z).name}.`, r.win ? "rare" : undefined);
          if (A.d) { A.d.fights = Object.assign({}, A.d.fights, { used: r.used }); if (r.extra) { const x = Object.assign({}, A.d.fights.extra); x[z] = (x[z] || 0) + 1; A.d.fights.extra = x; } A.d.score = Object.assign({}, A.d.score, { [z]: r.pts }); } }
        GU().paint(); load(true); return; }
    }
  });
  document.addEventListener("change", (ev) => { if (ev.target.id === "alFree") A.sel = ev.target.value; });

  /* rafraîchissements : chat d'alliance (comme celui de la guilde), données de temps en temps */
  let tick = 0;
  setInterval(() => {
    if (!mine() || ON.state === "offline" || !GU() || !GU().inGuild()) return; tick++;
    const C = window.CHAT && window.CHAT.state;
    if (myAid() && ((C && C.open && C.tab === "a") || tick % 8 === 0)) chatPoll();
    const tab = window.DX.ui.tab;
    if ((tab === "guild" && GU().G.tab === "alliance") || tab === "world") load();
    else if (tick % 150 === 3) load(true); // bonus du prisme : les régions changent surtout après la bataille
  }, 4000);
  setTimeout(() => { if (mine() && GU() && GU().inGuild()) load(true); }, 8000);

  window.ALLY = { load, pageHtml, foldTag, zoneBox, mapLegend, bonus, allied, say, chatSeen, inAlliance, chatPoll,
    get msgs() { return A.chat; }, get unread() { return A.unread; }, A };
})();
