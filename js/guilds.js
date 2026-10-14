/* ============================================================================
   GUILDES — Idlus (multijoueur, étape 5)
   Créer une guilde (Guildalogemme), la rejoindre, rangs, XP de guilde donnée par les membres
   (part choisie de 0 à 90 %), niveaux et bonus, chat de guilde (onglet Guilde du chat),
   journal, réglages. Règles vérifiées par le serveur (supabase/guildes.sql).
   0.1.22 : boss de la semaine et Percepteurs (règles dans js/gboss.js, serveur dans supabase/gboss.sql).
   1.0.30 « Refonte des guildes » : coffre de guilde, places (5 à 15) et améliorations payées avec le coffre,
   Percepteurs en zone ou en donjon (un seul par zone sur tout le serveur), attaques entre guildes
   (« Guerre des Percepteurs », combats rejoués par le serveur comme au Kolizéum), fiche des autres guildes,
   boss en 5 phases avec une réserve d'essais. Chiffres et règles : js/gboss.js.
   Le jeu garde dans S.guild : { id, name, lvl, ic, col, share, pend, ups, sale } (pend = XP à envoyer,
   ups = améliorations de la guilde, lues par E.guildHas ; sale = part des ventes directes pour le coffre).
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
  const fk = (n) => `${fmt(Math.round(n || 0))} k`; // 1.0.30 : sommes du coffre, comme sur la maquette
  const big = (n) => (n >= 1e6 && n % 1e5 === 0 ? `${String(n / 1e6).replace(".", ",")} M` : fk(n));
  const RANKS = ["Meneur", "Bras droit", "Membre", "Recrue"];
  const ICONS = ["dofus", "couronne", "trophee", "cristal", "phenix", "ailes", "coffre", "havre", "monde", "combat", "pioche", "cle"];
  const COLS = ["#8cc63f", "#e8c063", "#ff8a6b", "#e0674f", "#c77dff", "#7fb3ff", "#4fd1c5", "#f0f0e0"];
  const G = { me: null, ex: null, off: 0, exAt: 0, res: null, sureRm: null, sureBuy: null, atkSeen: {}, raidSeen: {}, endTry: {}, ending: 0, zone: "", list: null, q: "", tab: "home", busy: false, chat: [], after: 0, unread: 0, seenChat: 0,
    form: { name: "", ic: "dofus", col: "#8cc63f" }, adm: null, view: null, atk: null };
  /* 1.0.30 : résultats d'attaque déjà lus (l'encart « Victoire ! » ne revient pas à chaque chargement) */
  const SEEN_K = "idlus-raids-vus";
  const seen = (() => { try { return JSON.parse(localStorage.getItem(SEEN_K) || "{}") || {}; } catch (e) { return {}; } })();
  const seenAdd = (id) => { seen[id] = Date.now(); const cut = Date.now() - 3 * 864e5; for (const k in seen) if (seen[k] < cut) delete seen[k]; try { localStorage.setItem(SEEN_K, JSON.stringify(seen)); } catch (e) {} };

  /* ---------- bonus de guilde (sous les plafonds du jeu) ---------- */
  const perks = (l) => ({ xp: Math.floor(l / 5), drop: Math.floor(l / 10), kamas: Math.floor(l / 10) });
  const inGuild = () => { const s = S(); return !!(s && s.guild && s.guild.id); };
  E.guildBonus = (s, kind) => { const g = s && s.guild; if (!g || !g.id) return 0; return perks(g.lvl || 1)[kind] || 0; };
  E.guildXpShare = (s, c, g) => {
    const q = s && s.guild; if (!q || !q.id || !(q.share > 0) || g <= 0) return 0;
    const d = Math.floor(g * Math.min(90, q.share) / 100); q.pend = (q.pend || 0) + d; return d;
  };

  /* ---------- serveur ---------- */
  const mine = () => !!(S() && ON.user && ON.profile && ON.link().uid === ON.user.id && !(ON.solo && ON.solo())); // 1.0.11 : la guilde se joue avec la partie 1
  const after = () => (S().hdv && S().hdv.op) || 0;
  async function call(name, args, okTxt) {
    if (G.busy) return null;
    if (!mine()) { X().toast(ON.user && ON.solo && ON.solo() ? ON.SOLO_ERR : "Crée ton compte (gratuit) pour les guildes : ta partie te suit."); return null; }
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
      const r = await ON.rpc("guild_give", { p_xp: pend, p_share: null });
      if (r.data && r.data.ok) { q.pend = Math.max(0, (q.pend || 0) - pend); if (r.data.lvl) q.lvl = r.data.lvl; }
      else if (r.data && r.data.none) q.id = null;
    }
    await load();
  }
  async function load() {
    const r = await ON.rpc("guild_me"); if (r.err || !r.data || r.data.err) { if (r.err && !G.me) { G.meErr = true; paint(); } return; } // 1.0.12.8 : panne du serveur affichée (avant : « Chargement… » sans fin)
    G.me = r.data; G.meErr = false; const s = S(); if (!s) return;
    const q = (s.guild = s.guild || { share: 0, pend: 0 });
    const was = q.id;
    if (G.me.g) {
      Object.assign(q, { id: G.me.g.id, name: G.me.g.name, lvl: G.me.g.lvl, ic: G.me.g.ic, col: G.me.g.col, ups: Object.assign({}, G.me.g.ups || {}) }); // 1.0.30 : améliorations (E.guildHas)
      q.share = Math.max(0, Math.min(90, +G.me.share || 0)); q.sale = Math.max(0, Math.min(E.GUILD_SALE_MAX, +G.me.sale || 0));
    } else { q.id = null; q.pend = 0; q.ups = {}; q.sale = 0; }
    if (was !== q.id) { X().markDirty(); G.chat = []; G.after = 0; G.ex = null; G.atk = null; if (q.id) { G.view = null; chatPoll(); } }
    paint(true);
    if (q.id) loadEx();
    if (window.CHAT && window.CHAT.repaint) window.CHAT.repaint();
  }
  /* boss de la semaine, Percepteurs et attaques ; les coffres gagnés s'ouvrent tout seuls */
  async function loadEx() {
    const r = await ON.rpc("guild_extra"); if (r.err || !r.data || r.data.none || r.data.err) return;
    G.ex = r.data; G.off = Date.parse(r.data.now) - Date.now(); G.exAt = Date.now();
    alerts();
    if (G.ex.boss && G.ex.boss.claim && !G.claiming) {
      G.claiming = true;
      const c = await ON.rpc("gboss_claim", { p_after: after() }); G.claiming = false;
      if (c.data && c.data.ops && window.MARKET) window.MARKET.apply(c.data.ops, true);
      if (c.data && c.data.ok) X().toast(`Boss de guilde : ${c.data.ok > 1 ? `${c.data.ok} coffres ouverts` : "coffre ouvert"} (+${fmt(c.data.k)} kamas, +${c.data.dust} Poussières de stasis).`, "rare");
      ((c.data && c.data.titles) || []).forEach((t) => X().toast(`Nouveau titre : « ${t} » !`, "rare"));
      return loadEx();
    }
    autoEnd();
    paint(true);
  }
  async function loadList() { const r = await ON.rpc("guild_list", { p_q: G.q }); G.list = r.data || []; G.lErr = !!r.err; paint(true); } // 1.0.12.8 : une panne n'est plus « Aucune guilde »
  /* 1.0.30 : fiche d'une autre guilde (6A) */
  async function loadView(id) {
    const r = await ON.rpc("guild_view", { p_id: id });
    if (!G.view || G.view.id !== id) return;
    if (r.err || !r.data || r.data.err) { G.view.err = (r.data && r.data.err) || "Pas de connexion au serveur : réessaie dans un moment."; } else { G.view.d = r.data; G.view.err = null; }
    paint(true);
  }

  /* 1.0.30 : alertes (monstres pour tous ; attaques de guilde avec la Vigie) */
  function alerts() {
    (G.ex.percos || []).forEach((p) => { if (p.atk && !G.atkSeen[p.id + p.atk.at]) { G.atkSeen[p.id + p.atk.at] = 1; if (!p.atk.done) X().toast(`⚔ Le Percepteur de ${p.name} est attaqué ! Défends-le dans Communauté › Guilde › Percepteurs.`, "rare"); } });
    const vig = +((G.ex.ups || {}).vigie) > 0;
    (G.ex.raids_in || []).forEach((x) => {
      if (x.st !== "open" || G.raidSeen[x.id]) return; G.raidSeen[x.id] = 1;
      if (vig) X().toast(`⚔ Vigie : ${x.ag ? x.ag.name : "une guilde"} attaque votre Percepteur de ${x.zone} ! Repoussez l'attaque dans Communauté › Guilde › Percepteurs (encore ${left(Date.parse(x.ends) - srvNow())}).`, "rare");
    });
  }
  /* 1.0.30 : fin d'une attaque (personne ne l'a repoussée) : l'attaquant lance tout de suite le dernier combat,
     un autre membre de l'une des deux guildes 2 min plus tard s'il n'est pas là. Le serveur le joue une seule fois. */
  function autoEnd() {
    if (G.ending || !G.ex) return; const now = srvNow();
    const L = (G.ex.raids_out || []).concat(G.ex.raids_in || []);
    const due = L.find((x) => (x.st === "open" || x.st === "fight") && Date.parse(x.ends) + (x.me ? 3000 : 120000) <= now && !(G.endTry[x.id] > Date.now() - 60000));
    if (due) endRaid(due, true);
  }
  async function endRaid(x, auto) {
    if (G.ending) return; G.ending = x.id; G.endTry[x.id] = Date.now(); paint();
    const r = await ON.submitGuild({ raid: { end: x.id } }); G.ending = 0;
    if (r.net || !r.ok) { if (!auto) X().toast(r.err || "Pas de connexion au serveur : réessaie dans un moment."); paint(); return; }
    const ours = (G.ex.raids_in || []).some((y) => y.id === x.id);
    X().toast(x.me ? (r.win ? `🏆 Victoire ! Tu pilles le Percepteur de ${x.zone} : +${fmt((r.loot && r.loot.k) || 0)} kamas au coffre de ta guilde.` : `Le Percepteur de ${x.zone} et ses gardes ont battu ton équipe.`)
      : ours ? (r.win ? `Le Percepteur de ${x.zone} a été pillé par ${x.by}.` : `🛡 Le Percepteur de ${x.zone} et ses gardes ont repoussé ${x.by} !`)
      : r.win ? `🏆 ${x.by} pille le Percepteur de ${x.zone} !` : `${x.by} est battu par le Percepteur de ${x.zone}.`, r.win === !ours ? "rare" : undefined);
    await loadEx();
  }

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
  const netErr = (v) => `<div class="empty">Pas de connexion au serveur : réessaie dans un moment. <button class="btn sm" data-act="g-retry" data-v="${v}">Réessayer</button></div>`;
  const srvNow = () => Date.now() + (G.off || 0);
  const left = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d} j ${hh} h` : hh ? (mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`) : `${mm} min`; };
  const since = (t) => { const s = Math.max(0, (srvNow() - Date.parse(t)) / 1000); return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const pill = (t) => `<span class="gx-shield">🛡 ${t}</span>`;
  const shieldPill = (ts, pre) => (ts && Date.parse(ts) > srvNow() ? pill(`${pre || ""}${left(Date.parse(ts) - srvNow())}`) : "");
  const team = (L) => `<div class="gx-team">${(L || []).map((x) => X().cmed(x.cls, x.ren ? 200 : x.lvl)).join("")}</div>`;
  const myTeam = () => { const s = S(); const ids = (s && s.koli && s.koli.team) || []; return ids.map((id) => s.chars.find((c) => c.id === id)).filter(Boolean); };
  const off = () => !!(G.me && G.me.rank <= 1); // Meneur ou Bras droit : dépense le coffre, pose et retire les Percepteurs
  const ups = () => (G.me && G.me.g && G.me.g.ups) || {};
  const up = (k) => +ups()[k] || 0;
  const chest = () => (G.me && G.me.g && +G.me.g.chest) || 0;
  const seats = () => (G.me && G.me.g && +G.me.g.seats) || E.GUILD_SEATS;
  const nth = (n) => `${n}e`;
  const resList = (res, n) => { const k = Object.keys(res || {}).sort((a, b) => res[b] - res[a]); return k.length ? k.slice(0, n || 3).map((x) => `+${fmt(res[x])} ${h(x)}`).join(", ") + (k.length > (n || 3) ? "…" : "") : "rien"; };
  const resSum = (res) => Object.values(res || {}).reduce((a, b) => a + b, 0);
  const paint = (soft) => { // soft : données arrivées en arrière-plan, mise à jour par DX.morph (pas de redessin complet)
    if (window.DX.ui.tab !== "guild") return; const m = $("#main"); if (!m) return;
    if (soft && window.DX.morph) { window.DX.morph(m, html()); return; }
    const y = window.scrollY; window.DX.repaint(m, html()); window.scrollTo(0, y); // garde le curseur là où on écrit
  };
  function render(main) {
    if (!main) return;
    window.DX.repaint(main, html());
    if (mine() && !G.me) load();
    if (G.list === null && !(G.me && G.me.g)) loadList();
  }
  function html() {
    const s = S();
    const head = `<div class="pagehead"><h1>Guilde</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(s ? s.kamas : 0)}</b> kamas</span></div>`;
    if (!mine() && ON.user && ON.solo && ON.solo()) return head + `<div class="stack">${X().soloPanel("la guilde")}${listHtml(false)}</div>`;
    if (!mine()) return head + `<div class="stack"><div class="panel"><div class="pad row between"><span><b>Crée ton compte pour rejoindre une guilde</b><br><span class="small muted">C'est gratuit, et ta partie de cet appareil te suit sur ton compte. En attendant, tu peux regarder les guildes.</span></span><button class="btn primary sm" data-act="on-loginscreen">Créer mon compte</button></div></div>${listHtml(false)}</div>`;
    if (!G.me) return head + (G.meErr ? netErr("me") : `<div class="empty">Chargement…</div>`);
    if (!G.me.g && G.view) return head + `<div class="stack">${viewHtml()}</div>`;
    return head + (G.me.g ? guildHtml() : noneHtml());
  }

  /* --- sans guilde : code GUILDES, invitations, fonder, liste (1.0.30 : choix 5A et 21A) --- */
  function noneHtml() {
    const s = S(); const inv = G.me.invites || [];
    const best = Math.max(...s.chars.map((c) => (c.ren ? 200 : c.lvl)));
    const f = G.form; const COST = E.GUILD_FOUND_K, LVL = E.GUILD_FOUND_LVL;
    const why = best < LVL ? `Il faut un héros au niveau ${LVL} (ton meilleur : ${best}).` : s.kamas < COST ? `Il te manque ${fmt(COST - s.kamas)} kamas.` : f.name.trim().length < 3 ? "Choisis un nom (3 à 24 caractères)." : "";
    const gift = G.me.gift && window.GIFTS ? `<section class="panel gban gx-gift">${emb("couronne", "#e8c063", 70)}<div class="grow stack" style="gap:6px"><h2 style="font-size:24px">Les guildes repartent de zéro</h2>
      <span class="small">Avec la refonte, toutes les anciennes guildes ont été dissoutes : chacun repart sans guilde, à égalité. Tes titres déjà gagnés restent.</span>
      <div class="row"><span class="tag good">Code cadeau GUILDES</span><span class="small">300 000 kamas et 6 h de Sablier de Xélor</span><button class="btn sm primary" data-act="g-gift" ${G.gifting ? "disabled" : ""}>Utiliser le code</button></div>
      <span class="xs muted">Valable 7 jours, une fois par compte.</span></div></section>` : "";
    const invites = inv.length ? `<section class="panel" style="border-color:var(--gold)"><div class="phead"><h2>Invitations</h2></div><div class="list">${inv.map((i) => `<div class="li">${emb(i.ic, i.col, 40)}<span class="grow"><b>${h(i.name)}</b><br><span class="xs muted">niveau ${i.lvl} · ${i.n} / ${i.cap || E.GUILD_SEATS} membres · invité par ${h(i.by || "?")}</span></span><button class="btn sm primary" data-act="g-inv" data-g="${i.gid}" data-v="1">Rejoindre</button><button class="btn sm" data-act="g-inv" data-g="${i.gid}" data-v="0">Refuser</button></div>`).join("")}</div></section>` : "";
    const found = `<section class="panel"><div class="phead"><h2>Fonder une guilde</h2><span class="xs muted">Guildalogemme : ${fmt(COST)} kamas et un héros niveau ${LVL}</span></div><div class="pad stack">
      <div class="gfound">${emb(f.ic, f.col, 72)}<div class="stack grow">
        <input type="text" id="gName" data-act="g-name" maxlength="24" placeholder="Nom de la guilde" value="${h(f.name)}">
        <div class="gpick">${ICONS.map((ic) => `<button class="${f.ic === ic ? "on" : ""}" data-act="g-ic" data-v="${ic}" aria-label="${ic}"><img src="assets/ui/${ic}.webp" alt=""></button>`).join("")}</div>
        <div class="gpick col">${COLS.map((c) => `<button class="${f.col === c ? "on" : ""}" data-act="g-col" data-v="${c}" style="background:${c}" aria-label="couleur"></button>`).join("")}</div>
      </div></div>
      <div class="list"><div class="li small">${X().IC("couronne")}<span class="grow"><b>${E.GUILD_SEATS} places</b> au départ, agrandies avec le coffre jusqu'à ${E.GUILD_SEATS_MAX}</span></div>
        <div class="li small">${pill(`${E.GUILD_SHIELD_H} h`)}<span class="grow">Bouclier de jeune guilde : tes Percepteurs ne peuvent pas être attaqués pendant ${E.GUILD_SHIELD_H} h</span></div>
        <div class="li small">${X().IC("trophee")}<span class="grow">Classement hebdomadaire de la <b>Guerre des Percepteurs</b> : titre « ${E.WAR_TITLE} » pour la 1re guilde</span></div></div>
      <div class="row"><button class="btn primary" data-act="g-create" ${why || G.busy ? "disabled" : ""}>Fonder la guilde</button><span class="xs ${why ? "" : "muted"}" ${why ? 'style="color:var(--danger)"' : ""}>${why || "Tu en deviens le Meneur. Les kamas sont pris tout de suite."}</span></div>
    </div></section>`;
    return `<div class="stack">${gift}${invites}${found}${listHtml(true)}</div>`;
  }
  function listHtml(canJoin, title) {
    const L = G.list; const asks = (G.me && G.me.asks) || []; const myId = G.me && G.me.g && G.me.g.id; const see = mine();
    const rows = L === null ? `<div class="empty">Chargement…</div>` : G.lErr ? netErr("list") : !L.length ? `<div class="empty">Aucune guilde pour l'instant. Fonde la première !</div>`
      : `<div class="list">${L.map((g) => { const cap = g.cap || E.GUILD_SEATS;
        return `<div class="li ${see ? "clk" : ""} ${g.id === myId ? "gme" : ""}" ${see ? `data-act="g-view" data-g="${g.id}"` : ""}>${emb(g.ic, g.col, 40)}<span class="grow"><b>${h(g.name)}</b> <span class="tag" style="background:var(--panel3);color:var(--ink)">niv. ${g.lvl}</span><br><span class="xs muted">${g.n} / ${cap} membres · Meneur : ${h(g.chef || "?")}${g.w || g.l ? ` · ⚔ ${g.w || 0} / ${g.l || 0}` : ""}${g.percos ? ` · ${g.percos} Percepteur${g.percos > 1 ? "s" : ""}` : ""} · ${g.open ? "entrée libre" : "sur demande"}</span>${g.motd ? `<br><span class="xs">« ${h(g.motd)} »</span>` : ""}</span>
        ${shieldPill(g.shield)}${canJoin ? (asks.includes(g.id) ? `<span class="xs muted">demande envoyée</span>` : g.n >= cap ? `<span class="xs muted">complète</span>` : `<button class="btn sm ${g.open ? "primary" : ""}" data-act="g-join" data-g="${g.id}" ${G.busy ? "disabled" : ""}>${g.open ? "Rejoindre" : "Demander"}</button>`) : ""}</div>`; }).join("")}</div>`;
    return `<section class="panel"><div class="phead"><h2>${title || "Guildes"}</h2><input type="text" id="gQ" data-act="g-q" placeholder="Rechercher…" value="${h(G.q)}" style="max-width:220px"></div>${rows}</section>`;
  }

  /* --- dans une guilde --- */
  const hot = () => !!(G.ex && ((G.ex.percos || []).some((p) => p.atk && !p.atk.done) || (G.ex.raids_in || []).some((x) => x.st === "open" || x.st === "fight")));
  function guildHtml() {
    const g = G.me.g; const n = G.me.members.length;
    const span = g.next ? g.next - g.base : 1; const pct = g.next ? Math.min(100, ((g.xp - g.base) / span) * 100) : 100;
    const banner = `<section class="panel gban">${emb(g.ic, g.col, 76)}<div class="grow stack" style="gap:6px"><div class="row"><h2 style="font-size:26px">${h(g.name)}</h2><span class="tag good">niveau ${g.lvl}</span><span class="xs muted">${n} / ${seats()} membres · tu es ${RANKS[G.me.rank]}</span>${shieldPill(g.shield, "jeune guilde, encore ")}</div>
      <div class="gbar"><i style="width:${pct.toFixed(1)}%"></i><b>${g.next ? `${fmt(g.xp - g.base)} / ${fmt(span)} XP` : "niveau maximum"}</b></div>
      ${g.motd ? `<div class="gmotd">${h(g.motd)}</div>` : ""}</div></section>`;
    const asks = (G.me.asks || []).length;
    const tabs = `<nav class="subtabs">${[["home", "Accueil"], ["coffre", "Coffre"], ["upg", "Améliorations"], ["percos", `Percepteurs${hot() ? " ⚔" : ""}`], ["boss", "Boss"], ["members", `Membres${asks ? ` · ${asks} demande${asks > 1 ? "s" : ""}` : ""}`], ["others", "Autres guildes"], ["log", "Journal"]].map(([id, t]) => `<button data-act="g-tab" data-v="${id}" aria-pressed="${G.tab === id || (id === "members" && G.tab === "set")}">${t}</button>`).join("")}
      <button class="btn sm mktrade" data-act="g-chat">${X().G("chat")} Chat de guilde</button></nav>`;
    const T = G.tab;
    const body = G.atk ? attackHtml() : T === "coffre" ? coffreHtml() : T === "upg" ? upgHtml() : T === "boss" ? bossHtml() : T === "percos" ? percosHtml() : T === "members" || T === "set" ? membersHtml() + setHtml() : T === "others" ? othersHtml() : T === "log" ? logHtml() : homeHtml(); // 1.0.30 : les réglages sont sous les membres (8 onglets, comme la maquette)
    return `<div class="stack">${banner}${tabs}${body}</div>`;
  }

  /* --- accueil (v-home) --- */
  const chestBox = (day) => `<div class="gx-chest"><img src="assets/ui/coffre.webp" alt=""><div class="stack" style="gap:2px"><span class="xs muted">Dans le coffre</span><span class="big num">${fk(chest())}</span>${day ? `<span class="xs muted">+${fk(G.me.g.chest24 || 0)} ces dernières 24 h</span>` : ""}</div></div>`;
  const buyBtn = (k, price, label, primary) => !off() ? `<span class="tag soft">${label || fk(price)}</span>`
    : G.sureBuy === k ? `<button class="btn sm primary" data-act="g-buy" data-k="${k}" ${G.busy ? "disabled" : ""}>Confirmer · ${fk(price)}</button>`
    : `<button class="btn sm ${primary ? "primary" : ""}" data-act="g-buy" data-k="${k}" ${chest() < price || G.busy ? "disabled" : ""} ${chest() < price ? `data-tip="Il manque ${fk(price - chest())} dans le coffre."` : ""}>${label || fk(price)}</button>`;
  const seatLine = (tag) => { const n = seats(); if (n >= E.GUILD_SEATS_MAX) return `<div class="li">${X().IC("couronne")}<span class="grow"><b>Places de membres</b><br><span class="xs muted">${n} places, le maximum</span></span><span class="tag good">${n} / ${E.GUILD_SEATS_MAX}</span></div>`;
    return `<div class="li">${X().IC("couronne")}<span class="grow"><b>Agrandir la guilde</b>${tag ? ` <span class="tag soft">${n} / ${E.GUILD_SEATS_MAX}</span>` : ""}<br><span class="xs muted">${nth(n + 1)} place${tag ? "" : ` · payée avec le coffre · jusqu'à ${E.GUILD_SEATS_MAX} membres`}</span></span>${buyBtn("place", E.guildSeatPrice(n + 1), null, true)}</div>`; };
  function homeHtml() {
    const g = G.me.g; const s = S(); const share = (s.guild && s.guild.share) || 0; const p = perks(g.lvl);
    const me = G.me.members.find((m) => m.u === ON.user.id) || {};
    const lines = [[1, "Chat de guilde, emblème et un Percepteur"], [5, "Percepteurs (un de plus tous les 5 niveaux, 5 au niveau 20)"], [10, "+2 % XP, +1 % butin, +1 % kamas"], [25, "+5 % XP, +2 % butin, +2 % kamas"], [50, "+10 % XP, +5 % butin, +5 % kamas"], [100, "+20 % XP, +10 % butin, +10 % kamas"]];
    /* les améliorations les moins chères : rangs des Percepteurs et améliorations uniques débloquées */
    const next = E.GUILD_RANKS.filter((u) => up(u.k) < E.GUILD_RANK_MAX).map((u) => ({ k: u.k, ic: u.ic, name: `${u.name} des Percepteurs`, tag: `rang ${up(u.k)}`, d: u.d.split(" ; ")[0], price: E.guildRankPrice(up(u.k) + 1) }))
      .concat(E.GUILD_UQ.filter((u) => !up(u.k) && g.lvl >= u.lvl).map((u) => ({ k: u.k, ic: u.ic, name: u.name, tag: "unique", d: u.d, price: u.cost })))
      .sort((a, b) => a.price - b.price).slice(0, 2);
    return `<div class="grid2g">
      <section class="panel"><div class="phead"><h2>Coffre de guilde</h2><span class="xs muted">kamas des Percepteurs et dépôts</span></div><div class="pad stack">${chestBox(true)}</div></section>
      <section class="panel"><div class="phead"><h2>À améliorer avec le coffre</h2></div><div class="list">${seatLine()}
        ${next.map((u) => `<div class="li">${X().IC(u.ic)}<span class="grow"><b>${h(u.name)}</b> <span class="tag soft">${u.tag}</span><br><span class="xs muted">${h(u.d)}</span></span>${buyBtn(u.k, u.price)}</div>`).join("")}
        <div class="li clk small" data-act="g-tab" data-v="upg"><span class="grow muted">Toutes les améliorations</span><span class="tag good">Voir</span></div></div></section>
      <section class="panel"><div class="phead"><h2>Activités de guilde</h2></div><div class="list">${percoLine()}${bossLine()}${warLine()}</div></section>
      <section class="panel"><div class="phead"><h2>Ma part d'XP pour la guilde</h2><b class="num">${share} %</b></div><div class="pad stack">
        <input type="range" min="0" max="90" step="5" value="${share}" data-act="g-share" id="gShare" aria-label="Part d'XP donnée à la guilde">
        ${G.me.share_by ? `<span class="xs" style="color:var(--gold)">Réglée par ${h(G.me.share_by)}. Tu peux toujours la changer.</span>` : ""}
        <span class="small muted">Comme dans DOFUS : cette part de l'XP gagnée par tes héros en combat part à la guilde au lieu d'aller aux héros. La guilde monte de niveau et tout le monde profite de ses bonus.</span>
        <div class="mksum"><span>Donné cette semaine</span><b>${fmt(me.week || 0)} XP</b><span>Donné depuis ton arrivée</span><b>${fmt(me.given || 0)} XP</b></div>
      </div></section>
      <section class="panel"><div class="phead"><h2>Bonus de la guilde</h2><span class="xs muted">sous les plafonds du jeu</span></div><div class="pad stack">
        <div class="row"><span class="tag good">+${p.xp} % XP</span><span class="tag good">+${p.drop} % butin</span><span class="tag good">+${p.kamas} % kamas</span></div>
        <div class="list gperks">${lines.map(([l, t]) => `<div class="li small ${g.lvl >= l ? "" : "lock"}"><b class="lv">niv. ${l}</b><span class="grow">${t}</span>${g.lvl >= l ? "✓" : ""}</div>`).join("")}</div>
        <span class="xs muted">Entre deux paliers : +1 % XP tous les 5 niveaux, +1 % butin et kamas tous les 10 niveaux.</span>
      </div></section></div>`;
  }
  function bossLine() {
    const b = G.ex && G.ex.boss; const def = E.gboss(b ? b.w : undefined);
    let t = "Chargement…";
    if (b) { const ph = E.gbossPhase(b.pts, b.goal); const n = Math.floor(tok(b)); t = ph.p > 5 ? "vaincu cette semaine ✓" : `phase ${ph.p} / 5 · ${n} essai${n > 1 ? "s" : ""} en réserve`; }
    return `<div class="li clk" data-act="g-tab" data-v="boss">${X().IC("trophee")}<span class="grow"><b>Boss de la semaine : ${h(def.name)}</b><br><span class="xs muted">${t}</span></span><span class="tag good">Voir</span></div>`;
  }
  function percoLine() {
    const P = (G.ex && G.ex.percos) || []; const slots = G.ex ? G.ex.slots : E.percoSlots(G.me.g.lvl, up("qg"));
    const mon = P.filter((p) => p.atk && !p.atk.done).length; const R = ((G.ex && G.ex.raids_in) || []).filter((x) => x.st === "open" || x.st === "fight");
    const by = [...new Set(R.map((x) => (x.ag ? x.ag.name : "?")))];
    const warn = R.length ? `<b style="color:var(--danger)">${R.length} attaqué${R.length > 1 ? "s" : ""} par ${by.map(h).join(", ")}</b>` : mon ? `<b style="color:var(--danger)">${mon} attaqué${mon > 1 ? "s" : ""} par des monstres</b>` : "";
    return `<div class="li clk" data-act="g-tab" data-v="percos">${X().IC("bourse")}<span class="grow"><b>Percepteurs</b><br><span class="xs muted">${P.length} / ${slots} posé${P.length > 1 ? "s" : ""}${warn ? ` · ${warn}` : ""}</span></span><span class="tag ${warn ? "warn" : "good"}">Voir</span></div>`;
  }
  function warLine() {
    const w = G.ex && G.ex.war; const me = (w && w.me) || null;
    return `<div class="li clk" data-act="g-tab" data-v="percos">${X().IC("combat")}<span class="grow"><b>Guerre des Percepteurs</b><br><span class="xs muted">${!w ? "Chargement…" : `cette semaine : ${(me && me.win) || 0} victoire${me && me.win > 1 ? "s" : ""}, ${(me && me.loss) || 0} défaite${me && me.loss > 1 ? "s" : ""}${me && me.pts ? ` · ${w.rank === 1 ? "1re" : nth(w.rank)} au classement` : ""}`}</span></span><span class="tag good">Voir</span></div>`;
  }

  /* --- coffre (v-coffre, choix 3A) --- */
  function coffreHtml() {
    const sale = +G.me.sale || 0; const L = G.me.chestlog || [];
    return `<div class="grid2g">
      <section class="panel"><div class="phead"><h2>Coffre de guilde</h2></div><div class="pad stack">${chestBox(false)}
        <span class="small muted">Les kamas des Percepteurs vont au coffre (les ressources vont à celui qui récolte). Chacun peut déposer, et donner une part de ses ventes directes. Personne ne peut retirer : le coffre sert seulement aux améliorations.</span>
        <div class="row"><input type="number" id="gDep" min="1000" step="1000" value="100000" style="max-width:150px" aria-label="Montant"><button class="btn primary sm" data-act="g-deposit" ${G.busy ? "disabled" : ""}>Déposer</button></div></div></section>
      <section class="panel"><div class="phead"><h2>Ma part des ventes pour le coffre</h2><b class="num">${sale} %</b></div><div class="pad stack">
        <input type="range" min="0" max="${E.GUILD_SALE_MAX}" step="1" value="${sale}" data-act="g-sale" id="gSale" aria-label="Part des ventes">
        <span class="small muted">Comme la part d'XP : ce pourcentage de tes ventes directes de ressources part au coffre de la guilde.</span></div></section>
      <section class="panel"><div class="phead"><h2>Mouvements du coffre</h2></div><div class="list">${L.map((x) => `<div class="li small"><span class="grow">${h(x.t)}${x.n > 1 ? ` <span class="xs muted">(${x.n} fois)</span>` : ""}<br><span class="xs muted">${since(x.at)}</span></span><b class="num ${x.k > 0 ? "gx-in" : "gx-out"}">${x.k > 0 ? "+" : ""}${fk(x.k)}</b></div>`).join("") || `<div class="empty">Le coffre est vide pour l'instant : récoltez vos Percepteurs ou déposez des kamas.</div>`}</div></section></div>`;
  }

  /* --- améliorations (q18A : uniques ; 4A : rangs des Percepteurs ; 1A : places) --- */
  function upgHtml() {
    const g = G.me.g; const nU = E.GUILD_UQ.filter((u) => up(u.k)).length;
    const uq = (u) => { const lk = g.lvl < u.lvl, got = up(u.k) > 0;
      const foot = lk ? `<span class="tag soft">guilde niv. ${u.lvl}</span>` : got ? `<span class="tag good">achetée ✓</span>` : buyBtn(u.k, u.cost, null, true);
      return `<div class="gx-card ${lk ? "lk" : ""} ${got ? "on" : ""}"><h3>${X().IC(u.ic)} ${h(u.name)}</h3><span class="small">${h(u.d)}</span><div class="row between" style="margin-top:auto"><span class="xs muted">${lk ? fk(u.cost) : got ? "" : "une seule fois"}</span>${foot}</div></div>`; };
    const rk = (u) => { const r = up(u.k);
      return `<div class="gx-card"><h3>${X().IC(u.ic)} ${h(u.name)} <span class="tag soft" style="margin-left:auto">rang ${r} / ${E.GUILD_RANK_MAX}</span></h3><div class="gx-pips">${Array.from({ length: E.GUILD_RANK_MAX }, (_, i) => `<i class="${i < r ? "on" : ""}"></i>`).join("")}</div><span class="small">${h(u.d)}</span>
        <div class="row between"><span class="xs muted">Actuel : ${u.now(r)}</span>${r >= E.GUILD_RANK_MAX ? `<span class="tag good">rang maximum</span>` : buyBtn(u.k, E.guildRankPrice(r + 1), `Rang ${r + 1} · ${fk(E.guildRankPrice(r + 1))}`, true)}</div></div>`; };
    return `${off() ? "" : `<div class="pad small muted">Seuls le Meneur et les Bras droits dépensent le coffre. Chacun peut le remplir (onglet Coffre).</div>`}
      <section class="panel"><div class="phead"><h2>Améliorations uniques</h2><span class="xs muted">coffre : <b class="num">${fk(chest())}</b> · ${nU} / ${E.GUILD_UQ.length} achetées</span></div><div class="pad stack"><span class="small muted">Achetées une seule fois avec le coffre, débloquées par le niveau de la guilde. Des effets qu'on ne trouve nulle part ailleurs dans le jeu.</span><div class="gx-uq">${E.GUILD_UQ.map(uq).join("")}</div></div></section>
      <section class="panel"><div class="phead"><h2>Améliorations des Percepteurs</h2><span class="xs muted">${E.GUILD_RANK_MAX} rangs, 100 000 k × rang²</span></div><div class="pad stack"><span class="small muted">Quatre améliorations communes à tous les Percepteurs de la guilde, achetées avec le coffre.</span><div class="gx-up">${E.GUILD_RANKS.map(rk).join("")}</div></div></section>
      <section class="panel"><div class="phead"><h2>Guilde</h2></div><div class="list">${seatLine(true)}</div></section>`;
  }

  /* --- boss de la semaine (12A et 20A : 5 phases, un essai toutes les 25 min, 6 en réserve) --- */
  const tok = (b) => E.gbossTok(b.tok, G.exAt || Date.now(), Date.now(), b.every);
  function bossHtml() {
    const b = G.ex && G.ex.boss; if (!b) return `<div class="empty">Chargement…</div>`;
    const def = E.gboss(b.w); const M = D().MONSTERS[def.boss] || {};
    const ph = E.gbossPhase(b.pts, b.goal); const t = tok(b); const n = Math.floor(t); const every = b.every || E.GBOSS_EVERY;
    const s = S(); const lvl = b.lvl || Math.max(...E.team(s).map((c) => (c.ren ? 200 : c.lvl)), 1);
    const r = G.res && G.res.gboss ? G.res : null; const over = ph.p > 5;
    const segs = E.GBOSS_PHASES.map((_, i) => { const d = i < ph.done, cur = i === ph.done && !over; return `<div class="${d ? "done" : ""}">${cur && ph.cur > 0 ? `<i style="width:${Math.min(100, (ph.cur / ph.need) * 100).toFixed(1)}%"></i>` : ""}<b>${d ? "✓ " : ""}Phase ${i + 1}</b></div>`; }).join("");
    const nextIn = E.gbossNextIn(t, every);
    const fight = over ? `<div class="row"><span class="tag good">Boss vaincu ✓</span><span class="xs muted">Un nouveau boss arrive lundi.</span></div>`
      : `<div class="row"><button class="btn primary" data-act="g-boss" ${!n || G.busy || G.fighting ? "disabled" : ""}>${G.fighting === true ? "Combat en cours…" : n ? `Affronter le boss (${n} en réserve)` : "Pas d'essai en réserve"}</button>
        <span class="xs muted">${n} essai${n > 1 ? "s" : ""} en réserve (${E.GBOSS_RESERVE} au plus)${nextIn ? ` · le prochain dans ${left(nextIn)}` : ""}</span></div>`;
    const res = r ? `<span class="small"><b class="num">${fmt(r.points)}</b> points en ${r.rounds} tours · ${r.alive} héros debout</span>` : "";
    const T = ph.T; const names = Object.values(E.GBOSS_CHEST_NAMES);
    const phases = E.GBOSS_PHASES.map((_, i) => { const need = T[i] - (i ? T[i - 1] : 0); const c = i < 4 ? E.gbossChest(E.GBOSS_STEPS[i], lvl) : null;
      return `<div class="li small ${i < ph.done ? "" : "lock"}"><b class="lv">Phase ${i + 1}</b><span class="grow">${big(E.GBOSS_PHASE_K[i])} au coffre · ${i < 4 ? `<span data-tip="${fmt(c.k)} kamas et ${c.dust} Poussières de stasis pour chaque membre qui a frappé">${names[i]}</span>` : "trophée du boss, titre pour la 1re guilde"}<br><span class="xs muted">« ${E.GBOSS_PHASE_NAMES[i]} » · ${fmt(need)} points</span></span>${i < ph.done ? "✓" : ""}</div>`; }).join("");
    const top = (b.top || []).map((g, i) => `<div class="li small ${g.id === G.me.g.id ? "gme" : ""}"><b class="num lv">${i + 1}</b>${emb(g.ic, g.col, 26)}<span class="grow">${h(g.name)} <span class="xs muted">· niv. ${g.lvl} · ${g.who} membre${g.who > 1 ? "s" : ""}</span></span><b>${g.ph >= 5 ? "vaincu ✓" : `phase ${g.ph + 1}`}</b></div>`).join("") || `<div class="empty">Aucune guilde n'a encore frappé.</div>`;
    const last = (b.last || []).length ? `<div class="pad xs muted">Semaine passée : ${b.last.map((g, i) => `${i + 1}. ${h(g.name)}`).join(" · ")}</div>` : "";
    const hit = (b.hitters || []).map((x, i) => `<div class="li small"><b class="num lv">${i + 1}</b><span class="grow">${X().pname(x.p, x.u)} <span class="xs muted">· ${x.n} essai${x.n > 1 ? "s" : ""} · meilleur ${fmt(x.best)}</span></span><b class="num">${fmt(x.pts)}</b></div>`).join("") || `<div class="empty">Personne n'a encore frappé cette semaine.</div>`;
    const tro = (b.trophies || []).length ? `<div class="list">${b.trophies.map((x) => { const d2 = E.gboss(x.w); return `<div class="li small">${X().IC("trophee")}<span class="grow">${h(d2.name)}${x.first ? ` <span class="tag good">1re guilde</span>` : ""}</span><span class="xs muted">${since(x.at)}</span></div>`; }).join("")}</div>` : `<div class="empty">Finissez la phase 5 pour gagner le trophée du boss.</div>`;
    return `<section class="panel gboss"><div class="gbhead">${M.img ? `<img class="gbimg" src="${X().imgM(def.boss)}" alt="">` : ""}<div class="stack grow" style="gap:4px">
        <span class="xs muted">Boss de la semaine · change dans ${left(E.gbossLeft(srvNow()))}</span><h2 style="font-size:24px">${h(def.name)}</h2>
        <span class="small muted">${over ? "Vaincu ! Un nouveau boss arrive lundi." : `Phase ${ph.p} / 5 : « ${E.GBOSS_PHASE_NAMES[ph.p - 1]} »${ph.p > 1 ? `, +${Math.round((E.gbossDmg(ph.p) - 1) * 100)} % de résistance` : ""}`} · ${h(def.dname)}</span></div></div>
      <div class="pad stack">
        <div class="row between small"><b>Vie du boss</b><span>${over ? `${fmt(b.pts)} points` : `phase ${ph.p} : ${fmt(ph.cur)} / ${fmt(ph.need)} points`}</span></div>
        <div class="gx-ph">${segs}</div>
        <span class="xs muted">Un essai toutes les ${every} min. Ils s'accumulent jusqu'à ${E.GBOSS_RESERVE} (${left(E.GBOSS_RESERVE * every * 60000)}) : un joueur qui revient après une pause en a plusieurs d'avance. Tes points cette semaine : <b>${fmt(b.mine)}</b>.</span>
        ${fight}${res}
      </div></section>
      <div class="grid2g even"><section class="panel"><div class="phead"><h2>Phases</h2><span class="xs muted">vie pour ta guilde (${fmt(b.goal)} points)</span></div><div class="list">${phases}</div><div class="pad xs muted">Chaque phase tombée : des kamas dans le coffre de guilde, de l'XP de guilde et un coffre pour chaque membre qui a frappé. La phase suivante est plus dure.</div></section>
      <section class="panel"><div class="phead"><h2>Course entre guildes</h2><span class="xs muted">titre « ${h(E.GBOSS_TITLE)} » pour le podium</span></div><div class="list">${top}</div>${last}<div class="pad xs muted">Un essai rapporte environ 300 points avec une bonne équipe. Le boss entier vaut ${fmt(E.GBOSS_PER_MEMBER)} points par membre (au moins ${E.GBOSS_MIN_MEMBERS} comptés) : une guilde qui joue tous les jours le finit en fin de semaine.</div></section></div>
      <div class="grid2g even"><section class="panel"><div class="phead"><h2>Dans ta guilde</h2></div><div class="list">${hit}</div></section>
      <section class="panel"><div class="phead"><h2>Trophées de la guilde</h2></div>${tro}</section></div>
      <p class="xs muted">Le combat est rejoué par le serveur avec ta partie en ligne : le boss est au niveau de ton équipe, ses PV ne baissent pas vraiment, on compte les dégâts (100 points = ses PV normaux). Pas d'idoles ni de seconde chance : même boss pour tout le monde.</p>`;
  }

  /* --- Percepteurs (7A, 8A, 9B, 10A, 11A, 19A) --- */
  function raidInHtml(x) {
    const ends = Date.parse(x.ends), start = Date.parse(x.at), now = srvNow(), tot = Math.max(1, ends - start), gone = Math.min(tot, Math.max(0, now - start));
    const T = myTeam(); const mineTry = (x.tries || []).find((t) => t.p === (ON.profile && ON.profile.pseudo));
    const late = now >= ends || x.st === "fight";
    const btn = late ? `<span class="small">Le temps est écoulé : le Percepteur et ses gardes affrontent l'attaquant.</span>${G.ending === x.id ? "" : ` <button class="btn sm" data-act="g-rend" data-g="${x.id}">Voir le combat</button>`}`
      : x.tried ? `<span class="small">Tu as déjà défendu pendant cette attaque${mineTry ? ` (${mineTry.win ? "victoire" : "défaite"})` : ""}. Un autre membre peut encore tenter.</span>`
      : !T.length ? `<button class="btn sm" data-act="nav" data-v="koli">Choisir mon équipe d'arène</button><span class="xs muted">On défend avec son équipe d'arène (Kolizéum).</span>`
      : `<button class="btn primary" data-act="g-rdef" data-g="${x.id}" ${G.fighting || G.busy ? "disabled" : ""}>${G.fighting === "r" + x.id ? "Combat en cours…" : "Défendre (1 essai par attaque)"}</button><span class="xs muted">Combat rejoué par le serveur, comme au Kolizéum.</span>`;
    return `<section class="gx-alert"><div class="row between"><b style="font-size:18px">⚔ ${h(x.ag ? x.ag.name : "Une guilde")} attaque ton Percepteur de ${h(x.zone)}</b><span class="tag warn">${late ? "dernier combat" : `encore ${left(ends - now)}`}</span></div>
      <div class="gbar"><i style="width:${((gone / tot) * 100).toFixed(1)}%"></i><b>fenêtre de défense : ${left(gone)} passées sur ${left(tot)}</b></div>
      <div class="gx-vs"><div class="stack" style="gap:6px"><b class="small">Équipe d'arène de ${h(x.by)} (${h(x.ag ? x.ag.name : "?")})</b>${team(x.heads)}</div><span class="vs">VS</span><div class="stack" style="gap:6px"><b class="small">Ton équipe d'arène</b>${T.length ? team(T) : `<span class="xs muted">aucune</span>`}</div></div>
      <div class="row">${btn}</div></section>`;
  }
  function defendersHtml(L) {
    const n = G.me.members.length;
    return L.map((x) => `<section class="panel"><div class="phead"><h2>Défenseurs</h2><span class="xs muted">${L.length > 1 ? `${h(x.zone)} · ` : ""}${(x.tries || []).length} essai${(x.tries || []).length > 1 ? "s" : ""} sur ${n} membre${n > 1 ? "s" : ""}</span></div><div class="list">${(x.tries || []).map((t) => `<div class="li small">${t.heads && t.heads[0] ? X().cmed(t.heads[0].cls, t.heads[0].lvl) : ""}<span class="grow"><b>${h(t.p)}</b> <span class="xs muted">${since(t.at)}</span></span><span class="${t.win ? "gx-in" : "gx-out"}">${t.win ? "victoire" : "défaite"}</span></div>`).join("") || `<div class="empty">Personne n'a encore défendu.</div>`}</div></section>`).join("");
  }
  function raidOutHtml(x) {
    const now = srvNow(), ends = Date.parse(x.ends); const dg = x.dg || {};
    if (x.st === "open" || x.st === "fight") {
      const tot = Math.max(1, ends - Date.parse(x.at)), gone = Math.min(tot, Math.max(0, now - Date.parse(x.at)));
      const tried = (x.tries || []).map((t) => `${h(t.p)} (${t.win ? "victoire" : "défaite"})`).join(", ");
      return `<section class="panel gx-out-raid"><div class="phead"><h2>⚔ Attaque en cours</h2><span class="xs muted">${h(x.zone)} · ${h(dg.name || "?")} · par ${h(x.by)}</span></div><div class="pad stack">
        <div class="gbar"><i style="width:${((gone / tot) * 100).toFixed(1)}%"></i><b>${now >= ends || x.st === "fight" ? "dernier combat : le Percepteur et ses gardes" : `encore ${left(ends - now)}`}</b></div>
        <span class="small">${now >= ends || x.st === "fight" ? "Personne n'a battu l'équipe : elle affronte maintenant le Percepteur et ses gardes." : `${h(dg.name || "Ils")} peuvent venir battre l'équipe de ${h(x.by)} (une fois chacun). Si personne n'y arrive, elle affronte à la fin le Percepteur et ses gardes : gagne, et la poche est pillée.`}</span>
        ${tried ? `<span class="xs muted">Déjà repoussé : ${tried}</span>` : ""}
        ${(now >= ends || x.st === "fight") && G.ending !== x.id ? `<div class="row"><button class="btn sm primary" data-act="g-rend" data-g="${x.id}">Lancer le dernier combat</button></div>` : ""}</div></section>`;
    }
    if (!x.me || seen[x.id]) return "";
    const ok = `<div class="row"><button class="btn sm" data-act="g-rseen" data-g="${x.id}">OK</button></div>`;
    if (x.st === "won") { const L = x.res || {}; const tried = (x.tries || []).map((t) => h(t.p));
      return `<section class="panel gx-win"><div class="phead"><h2>🏆 Victoire !</h2><span class="xs muted">${h(x.zone)} · ${h(dg.name || "?")}</span></div><div class="pad stack">
        <span class="small">Personne ne t'a battu en ${left(ends - Date.parse(x.at))}${tried.length ? ` (${tried.join(" et ")} ${tried.length > 1 ? "ont" : "a"} essayé)` : ""}, puis ton équipe a battu le Percepteur et ses gardes.</span>
        <div class="mksum"><span>Pillé (${Math.round((L.part || 0.5) * 100)} % de la poche)</span><b class="gx-in">+${fk(L.k || 0)} pour le coffre${L.half ? " (butin ÷ 2 : ils ont 10 niveaux de moins)" : ""}${L.fort ? " (Coffre-fort : 25 %)" : ""}</b><span>Ressources pour toi</span><b>${resList(L.res, 3)}</b><span>Guerre des Percepteurs</span><b>+${E.RAID.win} points pour ta guilde</b><span>La zone</span><b>leur Percepteur rentre chez lui ; pose le tien dans l'heure (avec ${E.RAID.shield} h de bouclier)</b></div>${ok}</div></section>`; }
    const txt = x.st === "repelled" ? `${h((x.res && x.res.by) || "Un défenseur")} a battu ton équipe : l'attaque est repoussée (bouclier de ${E.RAID.shield} h sur leur Percepteur).`
      : x.res && x.res.gone ? "Le Percepteur n'était plus là à la fin de l'attaque." : `Le Percepteur et ses gardes ont battu ton équipe (bouclier de ${E.RAID.shield} h sur leur Percepteur).`;
    return `<section class="panel"><div class="phead"><h2>Attaque perdue</h2><span class="xs muted">${h(x.zone)} · ${h(dg.name || "?")}</span></div><div class="pad stack"><span class="small">${txt}</span>${ok}</div></section>`;
  }
  function percosHtml() {
    if (!G.ex) return `<div class="empty">Chargement…</div>`;
    const s = S(); const P = G.ex.percos || []; const slots = G.ex.slots || 1; const ko = G.ex.ko || []; const used = P.length + ko.length;
    const RI = (G.ex.raids_in || []).filter((x) => x.st === "open" || x.st === "fight");
    const rob = up("robustesse");
    const alertsH = RI.length ? RI.map(raidInHtml).join("") + `<section class="panel"><div class="phead"><h2>Et si personne ne gagne ?</h2></div><div class="list"><div class="li small"><b style="width:22px;text-align:center">🏰</b><span class="grow">Si personne ne le bat avant la fin, l'attaquant affronte ton Percepteur et ses gardes (${rob ? `Robustesse rang ${rob} : +${3 * rob} % de PV et de dommages` : "achète des rangs de Robustesse pour les rendre plus forts"}). Une guilde absente n'est pas un butin gratuit.</span></div></div></section>` + defendersHtml(RI) : "";
    const outs = (G.ex.raids_out || []).map(raidOutHtml).join("");
    /* poser un Percepteur : zones finies et donjons faits en stasis 1 ou plus */
    const have = new Set(P.map((p) => p.sid)); const taken = G.ex.taken || {}; const holds = G.ex.holds || {};
    const all = E.percoZones(s).filter((z) => !have.has(z)).sort((a, b) => E.percoLvl(b) - E.percoLvl(a));
    const zs = all.filter((z) => !E.percoIsDj(z)), djs = all.filter((z) => E.percoIsDj(z));
    if (G.zone && !all.includes(G.zone)) G.zone = "";
    const z = G.zone || all.find((k) => !taken[k]) || all[0]; const tk = z && taken[z]; const hd = z && holds[z]; const hdOther = hd && hd.gid !== G.me.g.id;
    const lab = (k) => { const sub = E.SUBS[k]; return `${h(E.percoName(k))} (niv. ${sub ? `${sub.lvl[0]}-${sub.lvl[1]}` : E.percoLvl(k)})${taken[k] ? " · prise" : ""}`; };
    const opt = (k) => `<option value="${k}" ${k === z ? "selected" : ""}>${lab(k)}</option>`;
    const cap = z ? E.percoCap(z) : null; const gain = cap ? E.percoGain(cap, 1, ups()) : null;
    const full = used >= slots;
    const why = full ? "" : !off() ? "" : s.kamas < E.PERCO_PRICE ? `Il te manque ${fmt(E.PERCO_PRICE - s.kamas)} kamas.` : "";
    const fillH = up("percodore") ? E.PERCO_FILL_H_DORE : E.PERCO_FILL_H;
    const place = !all.length ? `<div class="pad small muted">Il faut une zone finie (tous ses monstres au palier Traqueur, le trophée de la zone) ou un donjon fait au moins en stasis 1.</div>`
      : `<div class="pad stack"><div class="row"><select id="gZone" data-act="g-zone">${zs.length ? `<optgroup label="Zones finies">${zs.map(opt).join("")}</optgroup>` : ""}${djs.length ? `<optgroup label="Donjons faits en stasis 1 ou plus">${djs.map(opt).join("")}</optgroup>` : ""}</select>
          ${off() && !full ? `<button class="btn primary sm" data-act="g-place" ${tk || hdOther || why || G.busy ? "disabled" : ""}>Poser (${fmt(E.PERCO_PRICE)} kamas)</button>` : ""}</div>
        ${tk ? `<div class="gatk gx-taken"><b>Place prise par ${h(tk.g)}.</b> <span class="small">Une zone = un seul Percepteur sur tout le serveur. Bats son Percepteur pour prendre la place.</span><div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="g-atk" data-g="${tk.gid}" data-p="${tk.pid}">⚔ Attaquer pour prendre la place</button><span class="xs muted">guilde niv. ${tk.lvl} · Robustesse rang ${tk.rob || 0}</span></div></div>` : ""}
        ${hd ? (hdOther ? `<span class="xs" style="color:var(--danger)">Zone gardée par ${h(hd.g)} encore ${left(Date.parse(hd.until) - srvNow())} (ils viennent de la gagner).</span>` : `<span class="xs" style="color:var(--gold)">Zone gagnée : pose ton Percepteur avant ${left(Date.parse(hd.until) - srvNow())}, il aura ${E.RAID.shield} h de bouclier.</span>`) : ""}
        ${z && E.percoIsDj(z) ? `<span class="xs muted">Dans un donjon : poche +50 % (kamas et ressources des salles, jamais de Dofus ni d'objet du boss), mais il est attaqué deux fois plus souvent.</span>` : ""}
        ${gain && !tk ? `<span class="xs muted">Poche pleine en ${fillH} h : ${fk(gain.k)} pour le coffre et ${resList(gain.res, 3).replace(/\+/g, "")} pour celui qui récolte.</span>` : ""}
        ${full ? `<span class="xs muted">${used} / ${slots} Percepteurs posés${ko.length ? ` (dont ${ko.length} place${ko.length > 1 ? "s" : ""} assommée${ko.length > 1 ? "s" : ""})` : ""}.${E.percoNextSlot(G.me.g.lvl) ? ` Le suivant au niveau ${E.percoNextSlot(G.me.g.lvl)} de guilde.` : ""}</span>` : ""}
        ${!off() ? `<span class="xs muted">Le Meneur et les Bras droits posent les Percepteurs (${used} / ${slots}).</span>` : ""}
        ${why ? `<span class="xs" style="color:var(--danger)">${why}</span>` : ""}</div>`;
    const kos = ko.length ? `<div class="list">${ko.map((k) => `<div class="li small">${X().IC("bourse")}<span class="grow">Place assommée : <b>${h(k.name)}</b></span><span class="xs muted">libre dans ${left(Date.parse(k.until) - srvNow())}</span></div>`).join("")}</div>` : "";
    const cards = P.map(percoCard).join("");
    return `${alertsH}${outs}<section class="panel"><div class="phead"><h2>Percepteurs</h2><span class="xs muted">${used} / ${slots}</span></div>
        <div class="pad small muted">Posé dans une zone finie ou un donjon fait en stasis 1 ou plus, un Percepteur ramasse ${E.PERCO_RATE} % des kamas et ressources qu'on y gagnerait : sa poche est pleine en ${fillH} h. Les kamas vont au coffre de guilde, les ressources à celui qui récolte. Des monstres l'attaquent environ une fois par jour, et les autres guildes peuvent l'attaquer.</div>
        ${place}${kos}</section>${cards}${warHtml()}`;
  }
  function percoCard(p) {
    const f = Math.max(0, p.fill || 0); const cap = p.cap || { k: 0, res: {} }; const gain = E.percoGain(cap, Math.min(f, 2.5), ups());
    const res = Object.keys(gain.res).sort((a, b) => gain.res[b] - gain.res[a]).slice(0, 5).map((k) => `<span class="gres" data-tip="${h(k)}">${X().resImg(k) ? `<img src="${X().resImg(k)}" alt="">` : ""}${fmt(gain.res[k])}</span>`).join("");
    const a = p.atk; const rest = a ? Date.parse(a.ends) - srvNow() : 0; const raided = p.raided;
    const atk = a ? `<div class="gatk"><b>⚔ Attaqué par des monstres !</b> <span class="small">encore ${left(rest)} pour le défendre${a.n ? ` · ${a.n} défenseur${a.n > 1 ? "s" : ""} battu${a.n > 1 ? "s" : ""} (+${a.n} monstre${a.n > 1 ? "s" : ""})` : ""}</span>
        ${(a.by || []).length ? `<br><span class="xs muted">Ont tenté : ${a.by.map(h).join(", ")}</span>` : ""}
        <div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="g-def" data-g="${p.id}" ${a.done || G.fighting ? "disabled" : ""}>${G.fighting === p.id ? "Combat en cours…" : a.done ? "Tu as déjà tenté" : "Défendre avec mon équipe"}</button><span class="xs muted">Victoire : poche +25 %, XP de guilde et la Bourse du Percepteur pour toi. Sans victoire en ${E.PERCO_ATK_H} h : ${Math.round((1 - Math.min(0.8, 0.5 + 0.03 * up("robustesse"))) * 100)} % de la poche est perdue.</span></div></div>` : "";
    const r = G.res && G.res.perco && G.res.id === p.id ? `<div class="small ${G.res.win ? "" : "muted"}">${G.res.win ? `🛡 Victoire en ${G.res.rounds} tours ! Poche +25 %${G.res.gxp ? `, +${fmt(G.res.gxp)} XP de guilde` : ""}, Bourse du Percepteur reçue.` : `Défaite contre ${G.res.foes} monstres : le suivant en affrontera un de plus.`}</div>` : "";
    return `<section class="panel gperco ${a || raided ? "hot" : ""}"><div class="phead"><h2>${h(p.name || p.sid)}</h2><span class="xs muted">niv. ${p.zlvl || "?"}${p.dj ? " · donjon" : ""} · posé par ${h(p.by || "?")} · ${p.wins} défense${p.wins > 1 ? "s" : ""} réussie${p.wins > 1 ? "s" : ""}, ${p.losses} pillage${p.losses > 1 ? "s" : ""}</span>${shieldPill(p.shield, "bouclier ")}</div><div class="pad stack">
        <div class="gbar"><i style="width:${Math.min(100, f * 100).toFixed(1)}%"></i><b>poche ${Math.round(f * 100)} %${f > 1 ? " (bonus de défense)" : f >= 1 ? " (pleine)" : ""}</b></div>
        <div class="row small"><span class="coin"></span><b class="num">${fmt(gain.k)}</b> kamas pour le coffre · ressources pour toi ${res}</div>
        ${raided ? `<div class="gatk"><b>⚔ Une guilde l'attaque.</b> <span class="small">Pas de récolte avant la fin de l'attaque : repoussez-la plus haut.</span></div>` : ""}${atk}${r}
        <div class="row"><button class="btn sm ${f >= 1 ? "primary" : ""}" data-act="g-collect" data-g="${p.id}" ${a || raided || f < 0.05 || G.busy ? "disabled" : ""}>Récolter</button>
          ${off() ? (G.sureRm === p.id ? `<button class="btn sm danger" data-act="g-prm" data-g="${p.id}">Oui, retirer</button>` : `<button class="btn sm" data-act="g-prm" data-g="${p.id}" ${a || raided ? "disabled" : ""}>Retirer</button>`) : ""}
          <span class="xs muted">${a ? "" : `Prochaine attaque de monstres vers ${new Date(Date.parse(p.next) - (G.off || 0)).toLocaleTimeString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</span></div>
      </div></section>`;
  }
  /* Guerre des Percepteurs : classement de la semaine, règles (v-loot) et attaques récentes */
  function warHtml() {
    const w = G.ex.war || {}; const me = w.me || {}; const myId = G.me.g.id;
    const top = (w.top || []).map((g, i) => `<div class="li small ${g.id === myId ? "gme" : ""}"><b class="num lv">${i + 1}</b>${emb(g.ic, g.col, 26)}<span class="grow">${h(g.name)} <span class="xs muted">· niv. ${g.lvl} · ⚔ ${g.win} / ${g.loss}${g.def ? ` · ${g.def} repoussée${g.def > 1 ? "s" : ""}` : ""}</span></span><b class="num">${fmt(g.pts)} pt${g.pts > 1 ? "s" : ""}</b></div>`).join("") || `<div class="empty">Aucune guilde n'a encore marqué de point cette semaine.</div>`;
    const lastW = (w.last || [])[0];
    const rules = [["⚔", `${G.ex.max || E.RAID.day} attaques par joueur et par jour, avec ton équipe d'arène (3 héros, celle du Kolizéum)${up("banniere") ? " (Bannière de guerre)" : ""}`], ["⏳", `${E.RAID.h} h pour défendre (${E.RAID.hVigie} h avec la Vigie) : chaque membre de la guilde attaquée peut affronter l'attaquant une fois`], ["🏰", "Personne n'a gagné ? L'attaquant affronte le Percepteur et ses gardes (plus forts avec la Robustesse)"], ["💰", `Victoire : ${E.RAID.loot} % de la poche (${E.RAID.lootFort} % contre un Coffre-fort), kamas au coffre et ressources pour l'attaquant ; le Percepteur battu rentre chez lui, sa place est assommée ${E.RAID.ko} h`], ["🛡", `Attaque repoussée : bouclier de ${E.RAID.shield} h sur le Percepteur`], ["⚖", `Butin divisé par 2 si la guilde attaquée a ${E.RAID.gap} niveaux de moins que la tienne`], ["🌱", `Nouvelles guildes protégées ${E.GUILD_SHIELD_H} h`], ["🏆", `${E.RAID.win} points par attaque gagnée, ${E.RAID.def} par attaque repoussée ; titre « ${E.WAR_TITLE} » pour la 1re guilde de la semaine`]];
    const done = (G.ex.raids_in || []).map((x) => Object.assign({ in: true }, x)).concat((G.ex.raids_out || []).map((x) => Object.assign({ in: false }, x))).filter((x) => !(x.st === "open" || x.st === "fight")).sort((a, b) => b.id - a.id).slice(0, 8);
    const res = (x) => x.in ? (x.st === "won" ? [`pillé par ${h(x.by)} (${h(x.ag ? x.ag.name : "?")})`, "gx-out"] : [`${h(x.by)} (${h(x.ag ? x.ag.name : "?")}) repoussé`, "gx-in"]) : (x.st === "won" ? [`${h(x.by)} pille ${h(x.dg ? x.dg.name : "?")}`, "gx-in"] : [`${h(x.by)} repoussé par ${h(x.dg ? x.dg.name : "?")}`, "gx-out"]);
    return `<div class="grid2g even"><section class="panel"><div class="phead"><h2>Guerre des Percepteurs</h2><span class="xs muted">cette semaine${me.pts ? ` · ta guilde : ${me.pts} pt${me.pts > 1 ? "s" : ""}, ${w.rank === 1 ? "1re" : nth(w.rank)}` : ""}</span></div><div class="list">${top}</div>
        ${lastW ? `<div class="pad xs muted">Semaine passée : ${h(lastW.name)} (titre « ${E.WAR_TITLE} »)</div>` : ""}
        <div class="pad xs muted">Tes attaques aujourd'hui : ${G.ex.left} / ${G.ex.max} restante${G.ex.left > 1 ? "s" : ""}. Pour attaquer, ouvre la fiche d'une guilde dans « Autres guildes ».</div></section>
      <section class="panel"><div class="phead"><h2>Règles des attaques</h2></div><div class="list">${rules.map(([i, t]) => `<div class="li small"><b style="width:22px;text-align:center">${i}</b><span class="grow">${t}</span></div>`).join("")}</div>
        ${done.length ? `<div class="phead"><h2>Attaques récentes</h2></div><div class="list">${done.map((x) => { const [t, c] = res(x); return `<div class="li small"><span class="grow">${h(x.zone)} : ${t}</span><span class="xs ${c}">${since(x.at)}</span></div>`; }).join("")}</div>` : ""}</section></div>`;
  }

  /* --- autres guildes (6A) et attaque (v-attack) --- */
  function othersHtml() { return G.view ? viewHtml() : listHtml(false, "Toutes les guildes"); }
  function viewHtml() {
    const v = G.view; const back = `<div class="row"><button class="btn sm" data-act="g-vback">← Toutes les guildes</button></div>`;
    if (v.err) return back + `<div class="empty">${h(v.err)}</div>`;
    const g = v.d; if (!g) return back + `<div class="empty">Chargement…</div>`;
    const inG = !!(G.me && G.me.g); const pvp = g.pvp || [0, 0]; const bossTxt = g.boss >= 5 ? "Boss vaincu ✓" : `Boss : phase ${(g.boss || 0) + 1} / 5`;
    const sheet = `<section class="panel gban">${emb(g.ic, g.col, 70)}<div class="grow stack" style="gap:6px"><div class="row"><h2 style="font-size:24px">${h(g.name)}</h2><span class="tag good">niveau ${g.lvl}</span><span class="xs muted">${g.n} / ${g.cap} membres · Meneur : ${h(g.chef || "?")}</span></div>
      <div class="row small"><span class="tag soft">⚔ ${pvp[0]} victoire${pvp[0] > 1 ? "s" : ""} · ${pvp[1]} défaite${pvp[1] > 1 ? "s" : ""}</span><span class="tag soft">${bossTxt}</span>${g.trophies ? `<span class="tag soft">🏆 ${g.trophies} trophée${g.trophies > 1 ? "s" : ""}</span>` : ""}<span class="tag soft">créée ${since(g.created)}</span>${shieldPill(g.shield, "jeune guilde, encore ")}</div>
      ${g.motd ? `<div class="gmotd">« ${h(g.motd)} »</div>` : ""}</div></section>`;
    const mem = `<section class="panel"><div class="phead"><h2>Membres</h2>${g.spy ? `<span class="xs muted">équipes d'arène (Espionnage)</span>` : ""}</div><div class="list">${(g.members || []).map((m) => `<div class="gmrow gx-vrow">${X().cmed(m.cls, m.lvl)}<span class="grow"><b>${h(m.p)}</b><br><span class="xs muted">niv. ${m.lvl || 1}</span></span><span class="grk r${m.rank}">${RANKS[m.rank]}</span>${g.spy ? (m.team && m.team.length ? team(m.team) : `<span class="xs muted">pas d'équipe</span>`) : "<span></span>"}<span></span></div>`).join("")}</div></section>`;
    const P = g.percos || [];
    const act = (p) => g.mine ? `<span class="xs muted">ta guilde</span>` : g.shield && Date.parse(g.shield) > srvNow() ? shieldPill(g.shield, "encore ") : p.raid ? `<span class="tag warn">attaque en cours</span>` : p.shield && Date.parse(p.shield) > srvNow() ? shieldPill(p.shield, "encore ") : p.monsters ? `<span class="tag soft">attaqué par des monstres</span>` : inG ? `<button class="btn sm primary" data-act="g-atk" data-g="${g.id}" data-p="${p.id}">⚔ Attaquer</button>` : "";
    const percos = `<section class="panel"><div class="phead"><h2>Percepteurs</h2><span class="xs muted">${P.length} posé${P.length > 1 ? "s" : ""}${g.rob ? ` · Robustesse rang ${g.rob}` : ""}</span></div><div class="list">${P.map((p) => `<div class="li">${X().IC("bourse")}<span class="grow"><b>${h(p.name)}</b> <span class="xs muted">niv. ${p.zlvl}${p.dj ? " · donjon" : ""}</span><br><span class="xs muted">poche ${Math.round((p.fill || 0) * 100)} %${p.pocket ? ` · ${fk(p.pocket.k)} et ${fmt(resSum(p.pocket.res))} ressources` : ""}${p.raid ? ` · attaqué par ${h(p.raid.g || p.raid.by)}` : ""}</span></span>${act(p)}</div>`).join("") || `<div class="empty">Aucun Percepteur posé.</div>`}</div></section>`;
    return `${back}${sheet}<div class="grid2g even">${mem}${percos}</div>`;
  }
  function attackHtml() {
    const back = `<div class="row"><button class="btn sm" data-act="g-atkback">← Retour</button></div>`;
    const v = G.view && G.view.id === G.atk.gid ? G.view.d : null; if (!v) return back + `<div class="empty">${G.view && G.view.err ? h(G.view.err) : "Chargement…"}</div>`;
    const p = (v.percos || []).find((x) => x.id === G.atk.pid); if (!p) return back + `<div class="empty">Ce Percepteur n'est plus là.</div>`;
    const T = myTeam(); const cap = E.percoCap(p.sid); const part = E.raidPart(v.mylvl || G.me.g.lvl, v.lvl, !!v.fort);
    const est = p.pocket ? E.raidLoot(p.pocket, part) : E.raidLoot(E.percoGain(cap, Math.min(1, p.fill || 0), {}), part);
    const leftN = G.ex ? G.ex.left : E.RAID.day; const maxN = G.ex ? G.ex.max : E.RAID.day;
    const blocked = v.shield && Date.parse(v.shield) > srvNow() ? `Jeune guilde protégée encore ${left(Date.parse(v.shield) - srvNow())}.` : p.shield && Date.parse(p.shield) > srvNow() ? `Ce Percepteur a un bouclier encore ${left(Date.parse(p.shield) - srvNow())}.`
      : p.raid ? "Une attaque est déjà en cours sur ce Percepteur." : p.monsters ? "Des monstres l'attaquent déjà : reviens plus tard." : !leftN ? `Plus d'attaque aujourd'hui (${maxN} par jour) : reviens demain.` : "";
    const def = `<div class="gatk"><b>Attaque annoncée à ${h(v.name)}</b> <span class="small">Ils ont ${E.RAID.h} h (${E.RAID.hVigie} h avec la Vigie) pour venir défendre : chaque membre qui se connecte peut affronter ton équipe une fois (rejouée par le serveur). Si personne ne te bat, ton équipe affronte à la fin le Percepteur et ses gardes${v.rob ? ` (Robustesse rang ${v.rob} : +${3 * v.rob} %)` : ""} : gagne, et tu pilles la poche.</span></div>
      ${v.spy ? `<div class="stack" style="gap:4px;margin-top:6px"><b class="xs">Leurs équipes d'arène (Espionnage)</b>${(v.members || []).filter((m) => m.team && m.team.length).map((m) => `<div class="row xs">${h(m.p)} ${team(m.team)}</div>`).join("") || `<span class="xs muted">aucune équipe d'arène</span>`}</div>` : ""}`;
    return `${back}<section class="panel"><div class="phead"><h2>⚔ Attaquer le Percepteur de ${h(p.name)}</h2><span class="xs muted">${h(v.name)} · niv. ${v.lvl} · poche ${Math.round((p.fill || 0) * 100)} %</span></div><div class="pad stack">
      <div class="gx-vs"><div class="stack" style="gap:6px"><b class="small">Ton équipe d'arène (${T.length} héros, celle du Kolizéum)</b>${T.length ? team(T) : `<button class="btn sm" data-act="nav" data-v="koli">Choisir mon équipe d'arène</button>`}</div><span class="vs">VS</span><div>${def}</div></div>
      <div class="row"><button class="btn primary" data-act="g-rgo" data-g="${p.id}" ${blocked || !T.length || G.busy || G.fighting ? "disabled" : ""}>${G.fighting === "go" ? "Envoi…" : "Lancer l'attaque"}</button><span class="xs ${blocked ? "" : "muted"}" ${blocked ? 'style="color:var(--danger)"' : ""}>${blocked || `Ton équipe attend leurs défenseurs pendant ${E.RAID.h} h, puis le Percepteur. ${leftN} / ${maxN} attaque${leftN > 1 ? "s" : ""} restante${leftN > 1 ? "s" : ""} aujourd'hui.`}</span></div>
      <div class="mksum"><span>À gagner${p.pocket ? "" : " (environ)"}</span><b>${fk(est.k)} pour ton coffre et ${p.pocket ? "" : "~"}${fmt(resSum(est.res))} ressources pour toi${part < 0.5 ? ` (butin ÷ 2 : ils ont ${E.RAID.gap} niveaux de moins)` : ""}</b><span>Si tu gagnes</span><b>son Percepteur rentre chez lui, la zone est à ta guilde pendant ${E.RAID.hold} h</b></div></div></section>`;
  }

  function membersHtml() {
    const me = G.me.rank; const asks = G.me.asks || []; const n = G.me.members.length; const cap = seats();
    const canRank = (m) => m.u !== ON.user.id && (me === 0 || (me === 1 && m.rank >= 2));
    const canKick = (m) => m.u !== ON.user.id && me <= 1 && m.rank > me;
    const canShare = canKick;
    const shareSel = (m) => `<select data-act="g-mshare" data-u="${h(m.u)}" aria-label="Part d'XP" title="Part d'XP donnée à la guilde">${Array.from({ length: 19 }, (_, i) => i * 5).concat(m.share % 5 ? [m.share] : []).sort((a, b) => a - b).map((v) => `<option value="${v}" ${v === m.share ? "selected" : ""}>${v} % XP</option>`).join("")}</select>`;
    const req = me <= 1 && asks.length ? `<section class="panel" style="border-color:var(--gold)"><div class="phead"><h2>Demandes pour entrer</h2>${n >= cap ? `<span class="xs" style="color:var(--danger)">guilde complète (${n} / ${cap})</span>` : ""}</div><div class="list">${asks.map((a) => `<div class="li">${X().cmed(a.cls, a.lvl)}<span class="grow"><b>${h(a.p)}</b> <span class="xs muted">niv. ${a.lvl || 1}</span></span><button class="btn sm primary" data-act="g-ask" data-u="${h(a.u)}" data-v="1" ${n >= cap ? "disabled" : ""}>Accepter</button><button class="btn sm" data-act="g-ask" data-u="${h(a.u)}" data-v="0">Refuser</button></div>`).join("")}</div></section>` : "";
    const rows = G.me.members.map((m) => `<div class="gmrow${X().staffCls(m.u)}">${X().cmed(m.cls, m.lvl)}<span class="grow"><b>${X().pname(m.p, m.u)}</b>${m.u === ON.user.id ? ` <span class="xs muted">(toi)</span>` : ""}<br><span class="xs muted">niv. ${m.lvl || 1} · ${ago(m.seen)}</span></span>
      <span class="grk r${m.rank}">${RANKS[m.rank]}</span>
      <span class="xs num hm">${m.share} %${m.sby ? ` <span class="muted" title="Réglée par ${h(m.sby)}">(${h(m.sby)})</span>` : ""} · ${fmt(m.week)} XP cette semaine</span>
      <span class="gact">${canShare(m) ? shareSel(m) : ""}${canRank(m) ? `<select data-act="g-rank" data-u="${h(m.u)}" aria-label="Rang">${RANKS.map((r, i) => (me === 0 || i >= 2) ? `<option value="${i}" ${i === m.rank ? "selected" : ""}>${i === 0 ? "Meneur (donner ma place)" : r}</option>` : "").join("")}</select>` : ""}${canKick(m) ? `<button class="btn sm" data-act="g-kick" data-u="${h(m.u)}" data-p="${h(m.p)}">Renvoyer</button>` : ""}</span></div>`).join("");
    const more = me <= 1 && cap < E.GUILD_SEATS_MAX ? buyBtn("place", E.guildSeatPrice(cap + 1), `Acheter la ${nth(cap + 1)} place · ${fk(E.guildSeatPrice(cap + 1))}`, n >= cap) : "";
    const inv = me <= 2 ? `<div class="pad row"><input type="text" id="gInv" placeholder="Pseudo d'un joueur" maxlength="16" style="max-width:220px"><button class="btn sm" data-act="g-invite" ${n >= cap ? "disabled" : ""}>${n >= cap ? "Inviter (complet)" : "Inviter"}</button>${more}${(G.me.invited || []).length ? `<span class="xs muted">Invités : ${G.me.invited.map(h).join(", ")}</span>` : ""}</div>` : `<div class="pad xs muted">Les recrues pourront inviter une fois Membres.</div>`;
    return `${req}<section class="panel"><div class="phead"><h2>Membres</h2><span class="xs muted">${n} / ${cap}</span></div><div class="list">${rows}</div>${inv}
      <div class="pad xs muted">${E.GUILD_SEATS} places au départ ; chaque place en plus s'achète avec le coffre (${fk(E.guildSeatPrice(E.GUILD_SEATS + 1))} la ${nth(E.GUILD_SEATS + 1)}, ${big(E.guildSeatPrice(E.GUILD_SEATS_MAX))} la ${nth(E.GUILD_SEATS_MAX)}), jusqu'à ${E.GUILD_SEATS_MAX}.</div></section>
      <p class="xs muted">Meneur : tout. Bras droit : accepte les demandes, gère et renvoie Membres et Recrues, règle leur part d'XP, change le message du jour, dépense le coffre, pose et retire les Percepteurs. Membre : invite. Recrue : discute et participe.</p>`;
  }
  function logHtml() {
    return `<section class="panel"><div class="phead"><h2>Journal de la guilde</h2></div><div class="list">${(G.me.log || []).map((l) => `<div class="li small"><span class="grow">${h(l.t)}</span><span class="xs muted">${ago(l.at).replace("en ligne", "à l'instant")}</span></div>`).join("") || `<div class="empty">Rien pour l'instant.</div>`}</div></section>`;
  }
  function setHtml() {
    const g = G.me.g; const off2 = G.me.rank <= 1; const f = G.form;
    if (!G.setInit) { f.motd = g.motd; f.open = g.open; f.ic = g.ic; f.col = g.col; G.setInit = true; }
    return `${off2 ? `<section class="panel"><div class="phead"><h2>Réglages</h2></div><div class="pad stack">
        <label class="small"><b>Message du jour</b></label><input type="text" id="gMotd" maxlength="200" value="${h(f.motd || "")}" placeholder="Visible par tous, aussi dans la liste des guildes">
        <label class="row small"><input type="checkbox" id="gOpen" ${f.open ? "checked" : ""}> Entrée libre (sinon, les joueurs envoient une demande)</label>
        ${G.me.rank === 0 ? `<div class="gfound">${emb(f.ic, f.col, 60)}<div class="stack grow"><div class="gpick">${ICONS.map((ic) => `<button class="${f.ic === ic ? "on" : ""}" data-act="g-ic" data-v="${ic}" aria-label="${ic}"><img src="assets/ui/${ic}.webp" alt=""></button>`).join("")}</div><div class="gpick col">${COLS.map((c) => `<button class="${f.col === c ? "on" : ""}" data-act="g-col" data-v="${c}" style="background:${c}" aria-label="couleur"></button>`).join("")}</div></div></div>` : ""}
        <div><button class="btn primary" data-act="g-save">Enregistrer</button></div></div></section>` : ""}
      <section class="panel"><div class="phead"><h2>Quitter la guilde</h2></div><div class="pad row between"><span class="small muted">${G.me.rank === 0 && G.me.members.length > 1 ? "Ta place de Meneur passera au Bras droit (ou au membre) le plus ancien." : G.me.members.length === 1 ? "Tu es seul : la guilde sera dissoute, avec son coffre." : "Tu pourras en rejoindre une autre tout de suite."}</span>
        ${G.leave ? `<button class="btn sm danger" data-act="g-leave2">Oui, quitter</button>` : `<button class="btn sm" data-act="g-leave">Quitter</button>`}</div></section>`;
  }

  /* ---------- panel admin (onglet « Guildes ») ---------- */
  function adminHtml(a) {
    if (!a) return `<div class="box"><div class="empty">Chargement…</div></div>`;
    return `<div class="box"><h2>Guildes (${a.length})</h2>${a.map((g) => `<div class="ln">${emb(g.ic, g.col, 30)}<span><b>${h(g.name)}</b> · niv. ${g.lvl} · ${g.n}${g.cap ? ` / ${g.cap}` : ""} membres${g.chest != null ? ` · coffre ${fk(g.chest)}` : ""} · Meneur ${h(g.chef || "?")} · ${g.msgs} messages en 24 h${g.motd ? `<br><span class="xs muted">« ${h(g.motd)} »</span>` : ""}</span>
      <span style="margin-left:auto" class="row">${g.motd ? `<button class="btn sm" data-act="g-adm" data-g="${g.id}" data-v="motd">Effacer le message</button>` : ""}<button class="btn sm" data-act="g-admren" data-g="${g.id}" data-p="${h(g.name)}">Renommer</button>${window.CHAT && window.CHAT.role === "admin" ? `<button class="btn sm" data-act="g-adm" data-g="${g.id}" data-v="dissolve">Dissoudre</button>` : ""}</span></div>`).join("") || `<div class="ln muted">Aucune guilde.</div>`}</div>
      <p class="small muted">Renommer ou effacer le message du jour sert pour un nom ou un texte qui ne respecte pas les règles. Dissoudre (admin) renvoie tous les membres ; c'est noté dans le journal.</p>`;
  }
  const admReload = () => { const b = document.querySelector('[data-act="adm-reload"]'); if (b) b.click(); };

  /* ---------- événements ---------- */
  let qT = null;
  const solo = () => { X().toast(ON.user && ON.solo && ON.solo() ? ON.SOLO_ERR : "Crée ton compte (gratuit) pour les guildes : ta partie te suit."); };
  const openView = (id) => { if (!G.view || G.view.id !== id) { G.view = { id, d: null, err: null }; loadView(id); } };
  document.addEventListener("input", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^g-/.test(a)) return;
    if (a === "g-name") { G.form.name = ev.target.value; clearTimeout(qT); qT = setTimeout(paint, 400); }
    if (a === "g-q") { G.q = ev.target.value; clearTimeout(qT); qT = setTimeout(loadList, 350); }
  });
  document.addEventListener("change", (ev) => {
    const a = ev.target.dataset && ev.target.dataset.act; if (!a || !/^g-/.test(a)) return;
    if (a === "g-share") { const s = S(); s.guild = s.guild || { pend: 0 }; s.guild.share = Math.max(0, Math.min(90, +ev.target.value)); if (G.me) { G.me.share = s.guild.share; G.me.share_by = null; } X().markDirty(); ON.rpc("guild_give", { p_xp: 0, p_share: s.guild.share }); paint(); }
    if (a === "g-sale") { const v = Math.max(0, Math.min(E.GUILD_SALE_MAX, Math.round(+ev.target.value) || 0)); call("guild_sale_pct", { p_pct: v }, v ? `${v} % de tes ventes directes iront au coffre.` : "Tes ventes directes ne donnent plus rien au coffre.").then((r) => { if (r && G.me) { G.me.sale = r.sale; const s = S(); if (s.guild) s.guild.sale = r.sale; } paint(); }); }
    if (a === "g-zone") { G.zone = ev.target.value; paint(); }
    if (a === "g-mshare") { const u = ev.target.dataset.u; const v = +ev.target.value; call("guild_share", { p_user: u, p_share: v }, `Part d'XP réglée à ${v} %.`).then(load); }
    if (a === "g-rank") { const u = ev.target.dataset.u; const v = +ev.target.value; call("guild_rank", { p_user: u, p_rank: v }, v === 0 ? "Tu as donné ta place de Meneur." : "Rang changé.").then(load); }
  });
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^g-/.test(a)) return;
    switch (a) {
      case "g-tab": G.tab = d.v; G.leave = false; G.setInit = false; G.sureRm = null; G.sureBuy = null; G.atk = null; if (d.v !== "others") G.view = null; paint(); if (d.v === "boss" || d.v === "percos" || d.v === "home") loadEx(); if (d.v === "others") loadList(); if (d.v === "coffre" || d.v === "upg") load(); return;
      case "g-boss": case "g-def": {
        if (G.fighting) return;
        if (!mine()) { solo(); return; }
        G.fighting = a === "g-def" ? +d.g : true; G.res = null; paint();
        try { await X().onPush(); } catch (e) {} // le serveur rejoue avec la partie en ligne
        const r = await ON.submitGuild(a === "g-def" ? { perco: +d.g } : { gboss: 1 });
        G.fighting = false;
        if (r.net) X().toast("Pas de connexion au serveur : réessaie dans un moment.");
        else if (!r.ok) X().toast(r.err || "Refusé par le serveur.");
        else {
          G.res = Object.assign({ id: +d.g || 0 }, r);
          if (r.gboss && G.ex && G.ex.boss) { const b = G.ex.boss; const was = E.gbossPhase(b.pts, b.goal).done; Object.assign(b, { pts: r.pts, goal: r.goal || b.goal, tok: r.tok != null ? r.tok : b.tok, every: r.every || b.every }); G.exAt = Date.now();
            const now2 = E.gbossPhase(b.pts, b.goal).done; if (now2 > was) X().toast(now2 >= 5 ? "🏆 Boss de la semaine vaincu ! Trophée pour la guilde." : `Phase ${now2} tombée ! Des kamas dans le coffre et un coffre pour chaque membre qui a frappé.`, "rare"); }
          X().toast(r.gboss ? `Boss de la semaine : ${fmt(r.points)} points pour ta guilde !` : r.win ? "Percepteur défendu !" : "Défense ratée : un autre membre peut encore tenter.", r.win || r.gboss ? "rare" : undefined);
        }
        await loadEx(); return; }
      /* 1.0.30 : attaques entre guildes (rejouées par la fonction serveur record, supabase/gboss.sql rd_*) */
      case "g-rgo": case "g-rdef": {
        if (G.fighting) return;
        if (!mine()) { solo(); return; }
        G.fighting = a === "g-rgo" ? "go" : "r" + d.g; paint();
        try { await X().onPush(); } catch (e) {} // l'équipe d'arène vient de la partie en ligne
        const r = await ON.submitGuild({ raid: a === "g-rgo" ? { go: +d.g } : { def: +d.g } });
        G.fighting = false;
        if (r.net) X().toast("Pas de connexion au serveur : réessaie dans un moment.");
        else if (!r.ok) X().toast(r.err || "Refusé par le serveur.");
        else if (a === "g-rgo") { X().toast(`⚔ Attaque lancée sur le Percepteur de ${r.zone} ! ${r.g} a ${E.RAID.h} h pour la repousser, puis ton équipe affrontera le Percepteur et ses gardes.`, "rare"); G.atk = null; G.view = null; G.tab = "percos"; }
        else X().toast(r.win ? `🛡 Attaque repoussée ! Bouclier de ${E.RAID.shield} h pour le Percepteur, +${E.RAID.def} point de Guerre des Percepteurs.` : `Défaite contre l'équipe de ${r.by} : un autre membre peut encore tenter.`, r.win ? "rare" : undefined);
        await loadEx(); return; }
      case "g-rend": { const x = ((G.ex && G.ex.raids_out) || []).concat((G.ex && G.ex.raids_in) || []).find((y) => y.id === +d.g); if (x) { G.endTry[x.id] = 0; endRaid(x, false); } return; }
      case "g-rseen": seenAdd(+d.g); paint(); return;
      case "g-view": if (!mine()) return; openView(+d.g); if (G.me && G.me.g) G.tab = "others"; paint(); window.scrollTo(0, 0); return;
      case "g-vback": G.view = null; G.atk = null; paint(); return;
      case "g-atk": if (!mine()) { solo(); return; } openView(+d.g); G.atk = { gid: +d.g, pid: +d.p }; G.tab = "others"; paint(); window.scrollTo(0, 0); if (!G.ex) loadEx(); return;
      case "g-atkback": G.atk = null; paint(); return;
      case "g-collect": { const r = await call("perco_collect", { p_after: after(), p_id: +d.g }); if (r) { if (r.ops && window.MARKET) window.MARKET.apply(r.ops, true);
          const tx = r.txp > 0 ? E.percoTeamXp(S(), r.txp, r.zl) : 0; if (tx) X().markDirty(); // 1.0.30 : Sagesse : XP pour l'équipe qui récolte
          X().toast(`Percepteur récolté : +${fmt(r.k)} kamas au coffre, ses ressources pour toi${r.item ? " et un équipement" : ""}, +${fmt(r.gxp)} XP de guilde${tx ? `, +${fmt(tx)} XP pour ton équipe` : ""}.`, "rare"); load(); } else loadEx(); return; }
      case "g-place": { const z = G.zone || (($("#gZone") || {}).value); if (!z) return; const r = await call("perco_place", { p_after: after(), p_sid: z }, "Percepteur posé !"); if (r) { if (r.ops && window.MARKET) window.MARKET.apply(r.ops, true); G.zone = ""; loadEx(); } else loadEx(); return; }
      case "g-prm": { if (G.sureRm !== +d.g) { G.sureRm = +d.g; paint(); return; } G.sureRm = null; const r = await call("perco_remove", { p_id: +d.g }, "Percepteur retiré."); if (r) loadEx(); return; }
      /* 1.0.30 : coffre et améliorations */
      case "g-buy": { if (G.sureBuy !== d.k) { G.sureBuy = d.k; paint(); return; } G.sureBuy = null;
        const U = E.GUILD_UQ_BY[d.k] || E.GUILD_RANKS.find((u) => u.k === d.k);
        const r = await call("guild_buy", { p_k: d.k }, d.k === "place" ? "Place achetée : un membre de plus peut entrer !" : `${U ? U.name : "Amélioration"} : achat fait avec le coffre !`);
        if (r && G.me && G.me.g) { if (r.ups) G.me.g.ups = r.ups; if (r.seats) G.me.g.seats = r.seats; if (r.chest != null) G.me.g.chest = r.chest; const s = S(); if (s.guild && r.ups) s.guild.ups = Object.assign({}, r.ups); }
        paint(); load(); return; }
      case "g-deposit": { const k = Math.floor(+(($("#gDep") || {}).value || 0)); if (!(k >= 1000)) { X().toast("1 000 kamas au moins."); return; } if (k > S().kamas) { X().toast("Tu n'as pas autant de kamas."); return; }
        const r = await call("guild_deposit", { p_after: after(), p_k: k }, `${fmt(k)} kamas déposés au coffre de guilde.`); if (r) { if (r.ops && window.MARKET) window.MARKET.apply(r.ops, true); if (G.me && G.me.g && r.chest != null) G.me.g.chest = r.chest; X().markDirty(); load(); } return; }
      case "g-gift": { if (G.gifting || !window.GIFTS) return; G.gifting = true; paint();
        const r = await window.GIFTS.redeem(S(), "GUILDES"); G.gifting = false;
        if (r && r.err) X().toast(r.err); else { if (G.me) G.me.gift = false; X().markDirty(); X().renderStatus(); }
        paint(); return; }
      case "g-retry": G.meErr = false; if (G.lErr) G.list = null; render($("#main")); return;
      case "g-ic": G.form.ic = d.v; paint(); return;
      case "g-col": G.form.col = d.v; paint(); return;
      case "g-create": { const r = await call("guild_create", { p_after: after(), p_name: G.form.name.trim(), p_ic: G.form.ic, p_col: G.form.col }, "Guilde fondée ! Tu en es le Meneur.");
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
      const C = window.CHAT && window.CHAT.state; const here = window.DX.ui.tab === "guild";
      if (inGuild() && ((C && C.open && C.tab === "u") ? true : tick % 8 === 0)) chatPoll();
      if (tick % 15 === 0) sync();
      else if (here && inGuild() && tick % 5 === 0) loadEx(); // 1.0.30 : attaques et boss plus frais quand on regarde la guilde
      else if (here && G.me && !G.busy && !document.querySelector("#sheet .sheet")) paint(true); // comptes à rebours (DX.morph, pas de redessin complet)
      if (inGuild() && G.ex && !here && tick % 15 === 1) autoEnd();
    }, 4000);
  }

  window.GUILD = { start, render, sync, load, say, adminHtml, chatSeen, inGuild,
    get msgs() { return G.chat; }, get unread() { return G.unread; }, G };
})();
