/* ============================================================================
   CHAT et PANEL ADMIN — Idlus (multijoueur)
   Chat général et messages privés en temps réel, objets montrés dans les messages,
   annonces automatiques (Premiers, numéros 1, niveau 200, Renaissance, Dofus),
   ignorer / signaler, et le panel admin de Mathis (joueurs, signalements, vérification,
   annonces, modérateurs). Toutes les règles sont vérifiées par le serveur (supabase/chat.sql).
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const PREF = "idlus-chat";
  const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF) || "{}"); } catch (e) { return {}; } })();
  const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  const C = { started: false, open: !!pref.open, tab: "g", g: [], p: [], peer: null, names: {}, unread: 0, unreadP: 0, unreadH: 0, count: 0, role: null, ign: new Set(), item: null, err: "", next: 0, me: {}, menu: null, loaded: false, banner: null, below: false };
  const A = { tab: "vue", ov: null, q: "", list: null, sel: null, msgs: null, reps: null, flag: null, mods: null, anns: null, ann: { body: "", banner: true, chat: true, hours: 24 }, busy: false };
  const myId = () => (ON.user && ON.user.id) || null;
  const canWrite = () => !!(ON.user && ON.profile);
  const hhmm = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const clsName = (c) => ((window.DATA.CLASSES || {})[c] || {}).name || "héros";
  const S = () => window.DX.S;

  /* ---------- démarrage (appelé par ui.js quand la partie est lancée) ---------- */
  async function start() {
    if (C.started) return; C.started = true;
    mount();
    ON.onChange((st) => { if (st === "anon" && (C.role || C.p.length)) { C.role = null; C.p = []; C.peer = null; C.tab = "g"; X().renderStatus(); paint(true); } else paintMin(); });
    ON.chatLive(onMsg, (n) => { C.count = n; paintHead(); });
    await refresh();
    banner();
    setInterval(banner, 120000); // 0.1.40.1 : le bandeau arrive aussi aux joueurs déjà en jeu (annonce sans message dans le chat, temps réel coupé) et disparaît à l'heure prévue
    setInterval(() => { const el = $("#chat"); if (el && !el.innerHTML && S()) paint(); }, 2000); // partie commencée après le lancement
  }
  /* Rechargé à la connexion ou au changement de compte. */
  async function refresh() {
    const [g, p, ign, role, me] = await Promise.all([ON.chatLoad("g"), canWrite() ? ON.chatLoad("p") : [], canWrite() ? ON.ignores() : [], canWrite() ? ON.role() : null, canWrite() ? ON.chatMe() : {}]);
    C.g = g || []; C.p = p || []; C.ign = new Set(ign); C.role = role; C.me = me || {}; C.loaded = g !== null;
    try { if (role === "admin") localStorage.setItem("idlus-testeur", "1"); } catch (e) {} // la bêta, sans serveur, ouvre le panel de test à ce navigateur
    await names(C.p.map((m) => (m.user_id === myId() ? m.to_id : m.user_id)));
    if (C.role) X().renderStatus();
    paint();
  }
  async function names(ids) {
    const miss = [...new Set(ids.filter((i) => i && !C.names[i]))];
    if (miss.length) Object.assign(C.names, await ON.pseudos(miss));
    C.p.forEach((m) => { if (m.user_id && m.pseudo) C.names[m.user_id] = m.pseudo; });
  }
  /* 0.1.33.2 : les annonces automatiques (exploits, records de stasis, niveau 200, Renaissance, Dofus) ont leur onglet « Hauts faits » ; les annonces de Mathis restent dans le Général */
  const isFeat = (m) => m.kind === "ann" && !(m.data && m.data.t === "admin");
  function onMsg(m) {
    if (!m || !m.id) return;
    const list = m.ch === "p" ? C.p : C.g;
    if (list.some((x) => x.id === m.id)) return;
    list.push(m); if (list.length > 200) list.shift();
    const mine = m.user_id === myId() && m.kind === "msg";
    if (m.ch === "p") { if (m.user_id && m.pseudo) C.names[m.user_id] = m.pseudo; if (!mine && !(C.open && C.tab === "p" && C.peer === m.user_id)) C.unreadP++; }
    else if (isFeat(m)) { if (!(C.open && C.tab === "h")) C.unreadH++; }
    else if (!mine && !C.ign.has(m.user_id) && !(C.open && C.tab === "g")) C.unread++;
    if (m.kind === "ann" && m.data && m.data.t === "admin" && m.data.banner) setTimeout(banner, 800);
    paint(true);
  }

  /* ---------- affichage ---------- */
  function mount() {
    if ($("#chat")) return;
    const el = document.createElement("div"); el.id = "chat"; document.body.appendChild(el);
    const b = document.createElement("div"); b.id = "annbar"; const up = $("#updbar"); if (up) up.after(b); else document.body.prepend(b);
  }
  function paint(keepScroll) {
    const el = $("#chat"); if (!el || !S()) { if (el) el.innerHTML = ""; document.body.classList.remove("chat-open"); return; }
    document.body.classList.toggle("chat-open", C.open);
    if (!C.open) { el.className = ""; el.innerHTML = minHtml(); return; }
    // 0.1.31.1 : la position de lecture est lue AVANT de redessiner (l'ancienne liste, une fois retirée, répondait 0 et le chat remontait tout en haut)
    const list = el.querySelector(".ch-list"); const top = list ? list.scrollTop : 0, oldH = list ? list.scrollHeight : 0; const atEnd = !list || top + list.clientHeight >= oldH - 30;
    const typed = el.querySelector("#chIn") ? el.querySelector("#chIn").value : pref.draft || "";
    const focus = document.activeElement && document.activeElement.id === "chIn";
    el.className = "chat"; el.innerHTML = headHtml() + eventHtml() + discordHtml() + `<div class="ch-list" id="chList">${listHtml()}</div><div class="ch-foot">${footHtml(typed)}</div>`;
    const nl = el.querySelector(".ch-list");
    if (nl && (atEnd || !keepScroll)) { nl.scrollTop = nl.scrollHeight; C.below = false; }
    else if (nl) { nl.scrollTop = top; if (nl.scrollHeight > oldH + 4) C.below = true; } // on lit plus haut : on reste en place, un bouton signale les nouveaux messages
    if (nl) {
      if (C.below) nl.insertAdjacentHTML("beforeend", `<button class="ch-new" data-act="ch-bottom">Nouveaux messages ↓</button>`);
      nl.addEventListener("scroll", () => { if (C.below && nl.scrollTop + nl.clientHeight >= nl.scrollHeight - 30) { C.below = false; const b = nl.querySelector(".ch-new"); if (b) b.remove(); } }, { passive: true });
    }
    if (focus && $("#chIn")) { const i = $("#chIn"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  function paintHead() { const e = $("#chat .ch-on"); if (e) e.innerHTML = onlineTxt(); }
  function paintMin() { if (!C.open) paint(); }
  const onlineTxt = () => `<i></i>${C.count || 1}<span class="ol"> en ligne</span>`;
  function minHtml() {
    const last = [...C.g].reverse().find((m) => !C.ign.has(m.user_id) && !isFeat(m));
    const n = C.unread + C.unreadP + ((window.GUILD && window.GUILD.unread) || 0);
    return `<button class="chmin" data-act="ch-open" aria-label="Ouvrir le chat">${X().G("chat")}<span class="t">Chat</span>${evOn() ? `<span class="ev">XP et butin x2</span>` : ""}${n ? `<span class="n">${n > 99 ? "99+" : n}</span>` : ""}${last ? `<span class="last">${h(last.kind === "ann" ? annTxt(last, true) : `${last.pseudo} : ${last.body || (last.item ? "[objet]" : "")}`)}</span>` : ""}</button>`;
  }
  /* Bandeau fixe sous les onglets : le serveur Discord pour les questions et les bugs. */
  const DISCORD = "https://discord.gg/9ApPgWjPUM";
  /* 0.1.28.4 : rappel de l'événement en cours (E.EVENT), au-dessus de la carte Discord */
  const evOn = () => { const E = window.ENGINE; return !!(E && E.eventOn && E.eventOn()); };
  const eventHtml = () => { const E = window.ENGINE; return evOn() ? `<div class="ch-ev">${X().IC("parchemin_or")}<span><b>Événement ${h(E.EVENT.name)}</b> : XP et butin x2 pour tout le monde</span></div>` : ""; };
  const discordHtml = () => `<a class="ch-dis" href="${DISCORD}" target="_blank" rel="noopener"><span class="dl">${X().DISCORD_SVG}</span><span class="tx"><b>Serveur Discord d'Idlus</b><small>Questions, bugs, idées</small></span><span class="go">Rejoindre</span></a>`;
  function headHtml() {
    const tab = (k, n, extra) => `<button class="ch-tab${C.tab === k ? " on" : ""}" data-act="ch-tab" data-v="${k}">${n}${extra || ""}</button>`;
    return `<div class="ch-head">${tab("g", "Général", C.unread && C.tab !== "g" ? ` <span class="n">${C.unread}</span>` : "")}${canWrite() ? tab("p", "Privé", C.unreadP ? ` <span class="n">${C.unreadP}</span>` : "") : ""}${window.GUILD && window.GUILD.inGuild() ? tab("u", "Guilde", window.GUILD.unread && C.tab !== "u" ? ` <span class="n">${window.GUILD.unread}</span>` : "") : `<span class="ch-tab lock" data-tip="Rejoins une guilde (Communauté › Guilde) pour discuter avec elle.">${X().G("lock")} Guilde</span>`}${tab("h", "Hauts faits", C.unreadH && C.tab !== "h" ? ` <span class="n">${C.unreadH > 99 ? "99+" : C.unreadH}</span>` : "")}<span class="ch-on">${onlineTxt()}</span><button class="ch-x" data-act="ch-close" title="Réduire" aria-label="Réduire le chat">–</button></div>`;
  }
  function msgHtml(m) {
    if (m.kind === "ann" && !annTxt(m, true).trim()) return ""; // annonce illisible : on ne montre pas de barre vide
    if (m.kind === "ann") return `<div class="ann${m.data && m.data.t === "admin" ? " ann-adm" : ""}">${X().IC(m.data && m.data.t === "dofus" ? "dofus" : m.data && m.data.t === "admin" ? "parchemin_or" : "trophee")}<span>${annTxt(m)}</span></div>`;
    const me = m.user_id === myId();
    const it = m.item && window.DATA.ITEMS[m.item.tpl];
    const chip = it ? `<button class="itm" data-act="ch-item" data-tpl="${h(m.item.tpl)}"><img src="${X().itemImg(m.item.tpl)}" alt="">[${h(it.name)}]</button>` : "";
    return `<div class="msg${me ? " me" : ""}${X().staffCls(m.user_id)}">${X().cmed(m.cls, m.lvl)}<div><div class="who"><button class="ps" data-act="ch-who" data-u="${h(m.user_id || "")}" data-p="${h(m.pseudo || "")}" data-id="${m.id}">${X().pname(m.pseudo || "?", m.user_id)}</button>${m.lvl ? `<span class="lv">niv. ${m.lvl}</span>` : ""}${m.title ? `<span class="tt">${h(m.title)}</span>` : ""}<span class="hr">${hhmm(m.created_at)}</span></div><div class="tx">${h(m.body || "")}${m.body && chip ? " " : ""}${chip}</div></div></div>`;
  }
  function annTxt(m, plain) {
    const d = Object.assign({}, m.data); if (typeof d.t !== "string") d.t = d.did ? "top1" : ""; // 0.1.18-0.1.20 : le temps du record écrasait le type (t)
    const b = (s) => (plain ? s : `<b>${h(s)}</b>`); const p = b(m.pseudo || "?");
    const DOF = (window.ENGINE && window.ENGINE.DOFUS) || (window.DX.E && window.DX.E.DOFUS) || {};
    const t = (s) => (plain ? s.replace(/<[^>]+>/g, "") : s);
    switch (d.t) {
      case "first": return t(`${p} entre dans l'histoire : ${h(d.label || "un exploit")} !`);
      case "top1": return t(`${p} prend la 1re place de ${b(d.dname || "un donjon")} (stasis ${d.k}) !`);
      case "lvl200": return t(`${b(d.name || "Un héros")}, ${h(clsName(d.cls))} de ${p}, atteint le niveau 200${d.ren ? " (encore)" : ""} !`);
      case "ren": return t(`${b(d.name || "Un héros")}, ${h(clsName(d.cls))} de ${p}, renaît : Renaissance ${d.n} !`);
      case "dofus": return t(`${p} obtient le ${b((DOF[d.id] && DOF[d.id].name) || "Dofus")} !`);
      case "koli": return t(`${p} atteint le grade ${b(["Bronze", "Argent", "Or", "Cristal", "Diamant"][d.g] || "Or")} au Kolizéum (cote ${(+d.cote || 0).toLocaleString("fr-FR")}) !`); // 0.1.44
      case "admin": return t(`${plain ? "Annonce" : "<b>Annonce</b>"} : ${h(m.body || "")}`);
      default: return h(m.body || "");
    }
  }
  function listHtml() {
    if (!C.loaded) return `<div class="sys">Connexion au chat…</div>`;
    if (C.tab === "p") {
      if (!C.peer) {
        const conv = {}; C.p.forEach((m) => { const o = m.user_id === myId() ? m.to_id : m.user_id; if (o && !C.ign.has(o)) conv[o] = m; });
        const ids = Object.keys(conv).sort((a, b) => conv[b].id - conv[a].id);
        if (!ids.length) return `<div class="sys">Aucun message privé. Clique sur le pseudo d'un joueur dans le chat général pour lui écrire.</div>`;
        return ids.map((o) => { const m = conv[o]; return `<button class="conv" data-act="ch-peer" data-u="${h(o)}"><b>${C.names[o] ? X().pname(C.names[o], o) : "Joueur"}</b><span class="last">${m.user_id === myId() ? "Toi : " : ""}${h(m.body || "[objet]")}</span><span class="hr">${hhmm(m.created_at)}</span></button>`; }).join("");
      }
      const th = C.p.filter((m) => m.user_id === C.peer || m.to_id === C.peer);
      return `<div class="sys">Conversation privée avec <b>${h(C.names[C.peer] || "ce joueur")}</b>. Personne d'autre ne la voit.</div>` + th.map(msgHtml).join("");
    }
    if (C.tab === "u") {
      if (!window.GUILD || !window.GUILD.inGuild()) { C.tab = "g"; return listHtml(); }
      return `<div class="sys">Chat de ta guilde : seuls ses membres le voient.</div>` + window.GUILD.msgs.map((m) => (m.kind === "sys" ? `<div class="sys">${h(m.body)}</div>` : msgHtml(m))).join("");
    }
    if (C.tab === "h") {
      const fe = C.g.filter(isFeat);
      return `<div class="sys">Les hauts faits des joueurs : records de stasis, exploits, niveau 200, Renaissances et Dofus.</div>` + (fe.length ? fe.map(msgHtml).join("") : `<div class="sys">Aucun haut fait pour l'instant.</div>`);
    }
    const rows = C.g.filter((m) => !C.ign.has(m.user_id) && !isFeat(m));
    return `<div class="sys">Bienvenue sur le chat général. Reste courtois : liens et publicité sont refusés, un message déplacé peut être signalé.</div>` + rows.map(msgHtml).join("");
  }
  function footHtml(typed) {
    if (C.tab === "h") return `<div class="ch-lock">Les hauts faits s'affichent ici tout seuls.</div>`;
    if (!ON.user) return `<div class="ch-lock">Connecte-toi pour écrire dans le chat. <button class="btn sm" data-act="on-loginscreen">Se connecter</button></div>`;
    if (!ON.profile) return `<div class="ch-lock">Choisis un pseudo pour écrire dans le chat.</div>`;
    if (C.me.banned) return `<div class="ch-lock">Tu ne peux plus écrire dans le chat.</div>`;
    if (C.tab === "p" && !C.peer) return `<div class="ch-lock">Choisis une conversation.</div>`;
    const it = C.item && window.DATA.ITEMS[C.item];
    const wait = Math.max(0, Math.ceil((C.next - Date.now()) / 1000));
    return `${C.tab === "p" ? `<div class="ch-back"><button class="lnk" data-act="ch-peer" data-u="">← Toutes les conversations</button></div>` : ""}${it ? `<div class="ch-att"><span class="itm"><img src="${X().itemImg(C.item)}" alt="">[${h(it.name)}]</span><button class="lnk" data-act="ch-unitem">retirer</button></div>` : ""}
      <div class="ch-in"><input id="chIn" value="${h(typed)}" maxlength="200" autocomplete="off" placeholder="${C.tab === "p" ? `Écrire à ${h(C.names[C.peer] || "ce joueur")}…` : C.tab === "u" ? "Écrire à ta guilde…" : "Écrire à tout le monde…"}"><button class="btn sm primary" data-act="ch-send">Envoyer</button></div>
      <div class="ch-hint">${C.err ? `<span class="bad">${h(C.err)}</span>` : `<span>Bouton « Montrer dans le chat » sur la fiche d'un objet</span>`}<span id="chCnt">${wait ? `encore ${wait} s` : `${typed.length}/200`}</span></div>`;
  }

  /* ---------- actions du chat ---------- */
  async function send() {
    const i = $("#chIn"); if (!i) return; const body = i.value.trim();
    if (!body && !C.item) return;
    if (Date.now() < C.next) { C.err = "Doucement : attends quelques secondes."; return paint(true); }
    const to = C.tab === "p" ? C.peer : null;
    const err = C.tab === "u" && window.GUILD ? await window.GUILD.say(body, C.item ? { tpl: C.item } : null) : await ON.chatSend(body, to, C.item ? { tpl: C.item } : null);
    if (err) { C.err = err; if (/muet/.test(err)) C.me = await ON.chatMe(); return paint(true); }
    C.err = ""; C.item = null; i.value = ""; pref.draft = ""; savePref(); C.next = Date.now() + 4000;
    setTimeout(() => { const c = $("#chCnt"); if (c) c.textContent = "0/200"; }, 4100);
    // le message revient par le temps réel ; on recharge au cas où la connexion temps réel serait coupée
    setTimeout(async () => { const l = await ON.chatLoad(to ? "p" : "g"); if (l && l.length) { if (to) C.p = l; else C.g = l; paint(true); } }, 1500);
    paint();
  }
  function menu(t) {
    closeMenu();
    const u = t.dataset.u, p = t.dataset.p, id = +t.dataset.id; if (!u) return;
    const r = t.getBoundingClientRect(); const el = document.createElement("div"); el.className = "chmenu"; el.id = "chMenu";
    const mine = u === myId(); const ign = C.ign.has(u);
    el.innerHTML = `<div class="hd"><b>${h(p)}</b></div>
      <button data-act="ch-prof" data-u="${h(u)}">${X().IC("trophee")} Voir son profil</button>
      ${!mine && canWrite() ? `<button data-act="ch-pm" data-u="${h(u)}" data-p="${h(p)}">${X().G("chat")} Lui écrire en privé</button>
      ${window.MARKET ? `<button data-act="mk-trade-ask" data-p="${h(p)}">${X().G("chat")} Proposer un échange</button>` : ""}
      <button data-act="ch-ign" data-u="${h(u)}" data-v="${ign ? 0 : 1}">${X().G(ign ? "unlock" : "lock")} ${ign ? "Ne plus ignorer" : "Ignorer ses messages"}</button>
      <button class="red" data-act="ch-rep" data-u="${h(u)}" data-p="${h(p)}" data-id="${id}">${X().G("warn")} Signaler</button>` : ""}
      ${C.role && !mine ? `<button data-act="adm-find" data-q="${h(p)}">${X().G("shield")} Fiche admin</button>` : ""}`;
    document.body.appendChild(el);
    const w = el.offsetWidth, hgt = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left - 20)) + "px";
    el.style.top = Math.max(8, Math.min(innerHeight - hgt - 8, r.bottom + 4)) + "px";
  }
  const closeMenu = () => { const m = $("#chMenu"); if (m) m.remove(); };
  function reportSheet(u, p, id) {
    const m = C.g.concat(C.p).find((x) => x.id === id);
    X().openSheet(`<h2>Signaler ${h(p)}</h2><p class="muted small">Mathis et les modérateurs verront ce message et décideront. ${h(p)} ne saura pas qui l'a signalé.</p>
      ${m ? `<div class="rep-q"><b>${h(p)}</b> · ${hhmm(m.created_at)}<br>${h(m.body || "")}</div>` : ""}
      <div class="rep-opts">${["Insultes ou harcèlement", "Arnaque ou publicité", "Spam", "Autre"].map((r, i) => `<label><input type="radio" name="chRep" value="${h(r)}" ${i ? "" : "checked"}> ${h(r)}</label>`).join("")}</div>
      <label class="row small"><input type="checkbox" id="chRepIgn" checked> Ignorer aussi ses messages</label>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="closesheet">Annuler</button><button class="btn primary" data-act="ch-repgo" data-u="${h(u)}" data-id="${id}">Envoyer le signalement</button></div>`);
  }
  async function ignore(u, on) {
    const e = await ON.setIgnore(u, on); if (e) return X().toast(e);
    if (on) C.ign.add(u); else C.ign.delete(u);
    X().toast(on ? "Tu ne verras plus ses messages." : "Tu vois de nouveau ses messages.");
    paint(true);
  }

  /* ---------- bandeau d'annonce ---------- */
  async function banner() {
    const el = $("#annbar"); if (!el) return;
    const list = await ON.announces(); const seen = pref.annSeen || 0;
    const a = list.find((x) => x.id > seen);
    el.innerHTML = a ? `<div class="annbar">${X().IC("parchemin_or")}<span class="grow">${h(a.body)}</span><button class="lnk" data-act="ch-annok" data-id="${a.id}">Fermer</button></div>` : "";
  }

  /* ---------- panel admin ---------- */
  const isAdmin = () => C.role === "admin";
  function adminBtn() { return C.role ? `<button class="cloud admbtn" data-act="adm-open" data-tip="Panel admin">${X().G("shield")}<span class="hide-sm">${C.role === "admin" ? "Admin" : "Modération"}</span></button>` : ""; }
  const ATABS = () => [["vue", "Vue d'ensemble"], ["joueurs", "Joueurs"], ["sig", "Signalements", A.ov && A.ov.reports], ["verif", "En vérification", A.ov && A.ov.flagged]].concat(window.MARKET ? [["hdv", "Hôtel de vente"]] : []).concat(window.GUILD ? [["guildes", "Guildes"]] : []).concat(window.IDEES ? [["idees", "Suggestions"]] : []).concat(isAdmin() ? [["ann", "Annonces"]].concat(window.GIFTS ? [["codes", "Codes cadeaux"]] : []).concat([["equipe", "Équipe"]]) : []).filter((x) => isAdmin() || x[0] !== "verif");
  async function admLoad() {
    const r = (n, a) => ON.rpc(n, a).then((x) => { if (x.err) X().toast(x.err); return x.data; });
    A.ov = await r("adm_overview");
    if (A.tab === "joueurs") { A.list = await r("adm_players", { p_q: A.q }); if (A.sel) { A.sel = (A.list || []).find((x) => x.id === A.sel.id) || A.sel; A.msgs = await r("adm_msgs", { p_user: A.sel.id }); } }
    if (A.tab === "sig") A.reps = await r("adm_reports");
    if (A.tab === "verif") A.flag = await r("adm_flagged");
    if (A.tab === "equipe") A.mods = await r("adm_mods");
    if (A.tab === "ann") A.anns = await ON.announces();
    if (A.tab === "hdv") A.hdv = await r("adm_hdv"); // 0.1.20, voir js/market.js
    if (A.tab === "guildes") A.guildes = await r("adm_guilds"); // 0.1.21, voir js/guilds.js
    if (A.tab === "codes") A.codes = await r("adm_gifts"); // 0.1.26, voir js/codes.js
    if (A.tab === "idees") A.idees = await r("adm_ideas"); // 0.1.36, voir js/idees.js
  }
  function renderAdmin(main) {
    if (!C.role) { main.innerHTML = `<section class="panel"><div class="pad empty">Le panel admin est réservé à l'équipe d'Idlus.</div></section>`; return; }
    if (window.GIFTS) window.GIFTS.readForm(); // garde ce qui est tapé dans « Codes cadeaux »
    main.innerHTML = admHtml(true);
    admLoad().then(() => { if (window.DX.ui.tab === "admin") { const m = $("#main"); if (m) m.innerHTML = admHtml(false); } });
  }
  const repaintAdm = () => { const m = $("#main"); if (m && window.DX.ui.tab === "admin") { if (window.GIFTS) window.GIFTS.readForm(); m.innerHTML = admHtml(false); } };
  function admHtml(loading) {
    const tabs = `<div class="atabs">${ATABS().map(([k, n, c]) => `<button class="${k === A.tab ? "on" : ""}" data-act="adm-tab" data-v="${k}">${n}${c ? ` <span class="n">${c}</span>` : ""}</button>`).join("")}</div>`;
    const body = loading || !A.ov ? `<div class="box"><div class="empty">Chargement…</div></div>` : admBody();
    return `<section class="adm"><div class="ahd"><h1>${isAdmin() ? "Administration" : "Modération"}</h1><span class="badge">${isAdmin() ? "Réservé à ton compte" : "Modérateur"}</span><button class="btn sm" data-act="adm-reload">Actualiser</button></div>
      <p class="small muted">Ce panel agit sur le serveur, pour tous les joueurs. Il ne touche pas à ta partie. Le panel de test reste à part, sur la bêta.</p>${tabs}${body}</section>`;
  }
  const when = (t) => { if (!t) return "—"; const s = (Date.now() - new Date(t)) / 1000; return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const dur = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return sec >= 3600 ? `${Math.round(sec / 3600)} h` : `${Math.round(sec / 60)} min`; };
  function admBody() {
    const o = A.ov;
    if (A.tab === "hdv" && window.MARKET) return window.MARKET.adminHtml(A.hdv);
    if (A.tab === "guildes" && window.GUILD) return window.GUILD.adminHtml(A.guildes);
    if (A.tab === "codes" && window.GIFTS) return window.GIFTS.adminHtml(A.codes);
    if (A.tab === "idees" && window.IDEES) return window.IDEES.adminHtml(A.idees);
    if (A.tab === "vue") {
      const st = o.settings || {};
      return `<div class="kpis"><div class="kpi"><b>${o.accounts}</b><span>comptes créés</span></div><div class="kpi"><b>${C.count || 1}</b><span>joueurs en ligne maintenant</span></div><div class="kpi"><b>${o.active}</b><span>parties envoyées ces 24 h</span></div><div class="kpi${o.reports + o.flagged ? " warn" : ""}"><b>${o.reports + (isAdmin() ? o.flagged : 0)}</b><span>choses à regarder</span></div></div>
      <div class="two"><div class="box"><h2>À regarder</h2>
        ${o.reports ? `<div class="ln"><span class="st m">${o.reports} signalé${o.reports > 1 ? "s" : ""}</span>joueurs signalés dans le chat<button class="btn sm" style="margin-left:auto" data-act="adm-tab" data-v="sig">Voir</button></div>` : ""}
        ${o.flagged && isAdmin() ? `<div class="ln"><span class="st v">En vérification</span>${o.flagged} joueur${o.flagged > 1 ? "s" : ""} retiré${o.flagged > 1 ? "s" : ""} des classements<button class="btn sm" style="margin-left:auto" data-act="adm-tab" data-v="verif">Voir</button></div>` : ""}
        ${o.muted ? `<div class="ln"><span class="st m">Sanctions</span>${o.muted} joueur${o.muted > 1 ? "s" : ""} muet${o.muted > 1 ? "s" : ""} ou banni${o.muted > 1 ? "s" : ""} du chat</div>` : ""}
        ${o.reports + o.flagged + o.muted ? "" : `<div class="ln muted">Rien à signaler.</div>`}</div>
      <div class="box"><h2>Dernières inscriptions</h2>${(o.signups || []).map((x) => `<button class="ln lnb" data-act="adm-find" data-q="${h(x.pseudo)}">${X().cmed(x.cls)}<b>${h(x.pseudo)}</b><span class="t">${when(x.at)}</span></button>`).join("") || `<div class="ln muted">Aucune.</div>`}</div></div>
      ${isAdmin() ? `<div class="box"><h2>Réglages du chat</h2><div class="row small"><label class="row">Niveau minimum pour écrire <select id="admMin">${[0, 10, 20, 30, 50].map((v) => `<option value="${v}" ${+st.min_level === v ? "selected" : ""}>${v ? `héros niveau ${v}` : "aucun"}</option>`).join("")}</select></label>
        <label class="row">Entre deux messages <select id="admSlow">${[0, 4, 10, 30].map((v) => `<option value="${v}" ${+st.slow_s === v ? "selected" : ""}>${v ? `${v} s` : "aucun délai"}</option>`).join("")}</select></label><button class="btn sm primary" data-act="adm-settings">Enregistrer</button></div></div>` : ""}
      <div class="box"><h2>Journal</h2>${(o.log || []).map((x) => `<div class="ln"><span class="t" style="margin:0;min-width:64px">${hhmm(x.at)}</span><span>${h(x.txt)}${x.who ? ` <span class="xs muted">· ${h(x.who)}</span>` : ""}</span></div>`).join("") || `<div class="ln muted">Rien pour l'instant.</div>`}</div>`;
    }
    if (A.tab === "joueurs") {
      const L = A.list || [];
      return `<div class="srch"><input id="admQ" value="${h(A.q)}" placeholder="Chercher un pseudo" autocomplete="off"><button class="btn" data-act="adm-search">Chercher</button></div>
        ${A.sel ? ficheHtml(A.sel) : ""}
        <div class="box"><h2>${A.q ? "Résultats" : "Derniers comptes"}</h2>${L.map((x) => `<button class="ln lnb${A.sel && A.sel.id === x.id ? " on" : ""}" data-act="adm-sel" data-id="${x.id}">${X().cmed(x.cls)}<b>${h(x.pseudo)}</b>${stTags(x)}<span class="t">${x.level ? `${x.level} niveaux · ` : ""}${when(x.last_save)}</span></button>`).join("") || `<div class="ln muted">Aucun joueur trouvé.</div>`}</div>`;
    }
    if (A.tab === "sig") {
      const R = A.reps || [];
      return R.length ? R.map((r) => `<div class="modrow"><div class="row between"><div class="row">${X().cmed(r.cls)}<b>${h(r.pseudo || "?")}</b></div><span class="xs muted">signalé par ${r.n} joueur${r.n > 1 ? "s" : ""} · ${h(r.reasons || "")}</span></div>
          ${(r.bodies || []).slice(0, 3).map((b) => `<div class="rep-q">${h(b || "")}</div>`).join("")}
          <div class="acts"><button class="btn sm" data-act="adm-mute" data-u="${r.id}" data-v="60" data-close="1">Muet 1 h</button><button class="btn sm" data-act="adm-mute" data-u="${r.id}" data-v="1440" data-close="1">Muet 24 h</button>${isAdmin() ? `<button class="btn sm danger" data-act="adm-ban" data-u="${r.id}" data-v="1" data-close="1">Bannir du chat</button>` : ""}<button class="btn sm" data-act="adm-close" data-u="${r.id}">Classer sans suite</button><button class="btn sm" data-act="adm-find" data-q="${h(r.pseudo || "")}">Fiche</button></div></div>`).join("")
        : `<div class="box"><div class="empty">Aucun signalement en attente.</div></div>`;
    }
    if (A.tab === "verif") {
      const F = A.flag || [];
      return F.length ? `<div class="box">${F.map((x) => `<div class="ln">${X().cmed(x.cls)}<b>${h(x.pseudo)}</b><span class="xs muted">${h(x.reason || "")}</span><span class="t">${when(x.updated_at)}</span><button class="btn sm" data-act="adm-flag" data-u="${x.id}" data-v="0">Remettre</button><button class="btn sm" data-act="adm-find" data-q="${h(x.pseudo)}">Fiche</button></div>`).join("")}</div>`
        : `<div class="box"><div class="empty">Personne n'est en vérification.</div></div>`;
    }
    if (A.tab === "ann") {
      const a = A.ann;
      return `<div class="box"><h2>Nouvelle annonce</h2><textarea id="admAnn" maxlength="300" placeholder="Ex. : maintenance ce soir à 22 h, le chat sera coupé 10 minutes.">${h(a.body)}</textarea>
        <div class="row small"><span class="muted">Où :</span><label class="row"><input type="checkbox" id="admAnnB" ${a.banner ? "checked" : ""}> Bandeau en haut du jeu</label><label class="row"><input type="checkbox" id="admAnnC" ${a.chat ? "checked" : ""}> Message dans le chat</label></div>
        <div class="row small"><span class="muted">Bandeau pendant :</span><select id="admAnnH">${[[1, "1 h"], [24, "24 h"], [168, "7 jours"], [0, "jusqu'à ce que je l'enlève"]].map(([v, n]) => `<option value="${v}" ${a.hours === v ? "selected" : ""}>${n}</option>`).join("")}</select><button class="btn primary" style="margin-left:auto" data-act="adm-announce">Publier</button></div></div>
        <div class="box"><h2>Bandeaux affichés</h2>${(A.anns || []).map((x) => `<div class="ln"><span class="grow">${h(x.body)}</span><span class="t">${x.until ? `jusqu'à ${new Date(x.until).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "sans fin"}</span><button class="btn sm" data-act="adm-annend" data-id="${x.id}">Retirer</button></div>`).join("") || `<div class="ln muted">Aucun bandeau en ce moment.</div>`}</div>`;
    }
    if (A.tab === "equipe") {
      return `<div class="box"><h2>Modérateurs</h2><p class="small muted">Ils peuvent rendre muet et traiter les signalements. Ils ne peuvent ni bannir, ni suspendre un compte, ni publier d'annonce.</p>
        ${(A.mods || []).map((x) => `<div class="ln">${X().cmed(x.cls)}<b>${h(x.pseudo)}</b><span class="t">depuis ${when(x.at)}</span><button class="btn sm" data-act="adm-mod" data-p="${h(x.pseudo)}" data-v="0">Retirer</button></div>`).join("") || `<div class="ln muted">Aucun modérateur pour l'instant.</div>`}
        <div class="srch"><input id="admMod" placeholder="Pseudo du joueur" autocomplete="off"><button class="btn" data-act="adm-mod" data-v="1">Nommer modérateur</button></div></div>`;
    }
    return "";
  }
  function stTags(x) {
    const mute = x.mute_until && new Date(x.mute_until) > Date.now();
    return `${x.is_admin ? `<span class="st mod">Admin</span>` : x.is_mod ? `<span class="st mod">Modérateur</span>` : ""}${x.suspended_at ? `<span class="st m">Suspendu</span>` : ""}${x.banned ? `<span class="st m">Banni du chat</span>` : mute ? `<span class="st m">Muet ${dur((new Date(x.mute_until) - Date.now()) / 1000)}</span>` : ""}${x.flagged ? `<span class="st v">En vérification</span>` : ""}`;
  }
  function ficheHtml(x) {
    const mute = x.mute_until && new Date(x.mute_until) > Date.now(); const H = x.heroes || [];
    const self = x.id === myId();
    return `<div class="box"><div class="row between"><div class="row">${X().cmed(x.cls)}<h2>${h(x.pseudo)}</h2>${stTags(x)}</div><span class="xs muted">compte créé le ${new Date(x.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span></div>
      <div class="fiche"><div><small>Niveau d'équipe</small>${x.level || 0}</div><div><small>Temps de jeu</small>${dur(x.playtime || 0)}</div><div><small>Dernier envoi de la partie</small>${when(x.last_save)}</div>
        <div><small>Héros</small>${H.slice(0, 4).map((c) => `${h(clsName(c.cls))} ${c.lvl}${c.ren ? ` (R${c.ren})` : ""}`).join(", ") || "—"}</div><div><small>Signalements reçus</small>${x.reports || 0}</div><div><small>Classements</small>${x.flagged ? `en vérification${x.flag_reason ? ` (${h(x.flag_reason)})` : ""}` : "visible"}</div></div>
      ${self ? `<p class="small muted">C'est ton compte.</p>` : `<div class="acts"><button class="btn sm" data-act="ch-prof" data-u="${x.id}">Voir son profil</button>
        ${mute ? `<button class="btn sm" data-act="adm-mute" data-u="${x.id}" data-v="0">Lever le muet</button>` : ""}<button class="btn sm" data-act="adm-mute" data-u="${x.id}" data-v="60">Muet 1 h</button><button class="btn sm" data-act="adm-mute" data-u="${x.id}" data-v="1440">Muet 24 h</button>
        ${isAdmin() ? `<button class="btn sm${x.banned ? "" : " danger"}" data-act="adm-ban" data-u="${x.id}" data-v="${x.banned ? 0 : 1}">${x.banned ? "Lever le bannissement" : "Bannir du chat"}</button>
        <button class="btn sm" data-act="adm-flag" data-u="${x.id}" data-v="${x.flagged ? 0 : 1}">${x.flagged ? "Remettre dans les classements" : "Mettre en vérification"}</button>
        <button class="btn sm" data-act="adm-rename" data-u="${x.id}">Changer son pseudo</button>
        <button class="btn sm${x.suspended_at ? "" : " danger"}" data-act="adm-suspend" data-u="${x.id}" data-v="${x.suspended_at ? 0 : 1}">${x.suspended_at ? "Rétablir le compte" : "Suspendre le compte"}</button>` : ""}</div>`}
      ${A.ren === x.id ? `<div class="srch"><input id="admRen" value="${h(x.pseudo)}" maxlength="16" autocomplete="off"><button class="btn primary" data-act="adm-renamego" data-u="${x.id}">Renommer</button></div>` : ""}
      ${A.sus === x.id ? `<div class="stack" style="gap:6px"><span class="minus small">Le compte de ${h(x.pseudo)} ne pourra plus envoyer sa partie ni écrire dans le chat, et disparaît des classements. Tu pourras le rétablir.</span><div class="row"><button class="btn sm danger" data-act="adm-suspendgo" data-u="${x.id}">Confirmer la suspension</button><button class="btn sm" data-act="adm-suspendno">Annuler</button></div></div>` : ""}
      <h2>Ses derniers messages publics</h2>${(A.msgs || []).map((m) => `<div class="ln"><span class="t" style="margin:0;min-width:64px">${hhmm(m.created_at)}</span>${h(m.body)}</div>`).join("") || `<div class="ln muted">Aucun message ces dernières 48 h.</div>`}</div>`;
  }
  async function admDo(name, args, msg) {
    if (A.busy) return; A.busy = true;
    const r = await ON.rpc(name, args); A.busy = false;
    if (r.err) { X().toast(r.err); return false; }
    if (typeof r.data === "string" && r.data) { X().toast(r.data); return false; }
    if (msg) X().toast(msg);
    await admLoad(); repaintAdm(); return true;
  }
  function openAdmin(tab, q) {
    closeMenu(); X().closeSheet();
    if (tab) A.tab = tab; if (q != null) { A.q = q; A.sel = null; A.msgs = null; }
    window.DX.ui.tab = "admin"; window.DX.render(); window.scrollTo(0, 0);
  }

  /* ---------- clics ---------- */
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]");
    if (!ev.target.closest("#chMenu") && !(t && t.dataset.act === "ch-who")) closeMenu();
    if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^(ch|adm)-/.test(a)) return;
    switch (a) {
      case "ch-open": C.open = true; pref.open = true; savePref(); if (C.tab === "g") C.unread = 0; paint(); setTimeout(() => { const i = $("#chIn"); if (i && matchMedia("(min-width:641px)").matches) i.focus(); }, 30); return;
      case "ch-bottom": { const l = $("#chat .ch-list"); C.below = false; t.remove(); if (l) l.scrollTop = l.scrollHeight; return; }
      case "ch-close": C.open = false; pref.open = false; pref.draft = $("#chIn") ? $("#chIn").value : ""; savePref(); paint(); return;
      case "ch-tab": C.tab = d.v; C.err = ""; if (d.v === "g") C.unread = 0; if (d.v === "h") C.unreadH = 0; if (d.v === "u" && window.GUILD) window.GUILD.chatSeen(); if (d.v === "p" && !C.peer) C.unreadP = 0; paint(); return;
      case "ch-peer": C.peer = d.u || null; C.err = ""; if (C.peer) C.unreadP = 0; paint(); return;
      case "ch-send": send(); return;
      case "ch-who": menu(t); return;
      case "ch-prof": closeMenu(); X().lbProfile(d.u); return;
      case "ch-pm": closeMenu(); C.names[d.u] = d.p; C.tab = "p"; C.peer = d.u; C.open = true; pref.open = true; savePref(); paint(); return;
      case "ch-ign": closeMenu(); ignore(d.u, d.v === "1"); return;
      case "ch-rep": closeMenu(); reportSheet(d.u, d.p, +d.id); return;
      case "ch-repgo": {
        const r = (document.querySelector('input[name="chRep"]:checked') || {}).value || "Autre"; const ig = $("#chRepIgn") && $("#chRepIgn").checked;
        const e = await ON.chatReport(+d.id, r); if (e) return X().toast(e);
        X().closeSheet(); X().toast("Signalement envoyé. Merci !"); if (ig) ignore(d.u, true); return;
      }
      case "ch-item": X().itemSheet(d.tpl); return;
      case "ch-share": C.item = d.tpl; C.open = true; pref.open = true; savePref(); X().closeSheet(); paint(); setTimeout(() => { const i = $("#chIn"); if (i) i.focus(); }, 30); return;
      case "ch-unitem": C.item = null; paint(true); return;
      case "ch-annok": pref.annSeen = +d.id; savePref(); banner(); return;
      case "adm-open": openAdmin(); return;
      case "adm-tab": A.tab = d.v; repaintAdm(); await admLoad(); repaintAdm(); return;
      case "adm-reload": A.ov = null; repaintAdm(); await admLoad(); repaintAdm(); return;
      case "adm-find": openAdmin("joueurs", d.q || ""); return;
      case "adm-search": A.q = ($("#admQ").value || "").trim(); A.sel = null; A.msgs = null; await admLoad(); repaintAdm(); return;
      case "adm-sel": A.sel = (A.list || []).find((x) => x.id === d.id) || null; A.ren = A.sus = null; await admLoad(); repaintAdm(); return;
      case "adm-mute": if (await admDo("adm_mute", { p_user: d.u, p_min: +d.v }, +d.v ? "Joueur rendu muet." : "Le joueur peut de nouveau écrire.") && d.close) await admDo("adm_report_close", { p_user: d.u }); return;
      case "adm-ban": if (await admDo("adm_ban", { p_user: d.u, p_on: d.v === "1" }, d.v === "1" ? "Joueur banni du chat." : "Bannissement levé.") && d.close) await admDo("adm_report_close", { p_user: d.u }); return;
      case "adm-close": admDo("adm_report_close", { p_user: d.u }, "Signalements classés."); return;
      case "adm-flag": admDo("adm_flag", { p_user: d.u, p_on: d.v === "1" }, d.v === "1" ? "Joueur mis en vérification." : "Joueur remis dans les classements."); return;
      case "adm-rename": A.ren = A.ren === d.u ? null : d.u; repaintAdm(); return;
      case "adm-renamego": if (await admDo("adm_rename", { p_user: d.u, p_pseudo: ($("#admRen").value || "").trim() }, "Pseudo changé.")) A.ren = null; repaintAdm(); return;
      case "adm-suspend": if (d.v === "0") admDo("adm_suspend", { p_user: d.u, p_on: false }, "Compte rétabli."); else { A.sus = d.u; repaintAdm(); } return;
      case "adm-suspendgo": A.sus = null; admDo("adm_suspend", { p_user: d.u, p_on: true }, "Compte suspendu."); return;
      case "adm-suspendno": A.sus = null; repaintAdm(); return;
      case "adm-settings": admDo("adm_settings", { p_min_level: +$("#admMin").value, p_slow: +$("#admSlow").value }, "Réglages du chat enregistrés."); return;
      case "adm-announce": {
        const b = ($("#admAnn").value || "").trim(); A.ann = { body: b, banner: $("#admAnnB").checked, chat: $("#admAnnC").checked, hours: +$("#admAnnH").value };
        if (!b) return X().toast("L'annonce est vide.");
        if (!A.ann.banner && !A.ann.chat) return X().toast("Choisis au moins le bandeau ou le chat.");
        if (await admDo("adm_announce", { p_body: b, p_banner: A.ann.banner, p_chat: A.ann.chat, p_hours: A.ann.hours }, "Annonce publiée.")) { A.ann.body = ""; repaintAdm(); banner(); }
        return;
      }
      case "adm-annend": if (await admDo("adm_announce_end", { p_id: +d.id }, "Bandeau retiré.")) banner(); return;
      case "adm-mod": { const p = d.p || ($("#admMod") ? $("#admMod").value.trim() : ""); if (!p) return; admDo("adm_set_mod", { p_pseudo: p, p_on: d.v === "1" }, d.v === "1" ? `${p} est modérateur.` : `${p} n'est plus modérateur.`); return; }
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target && ev.target.id === "chIn") {
      if (ev.key === "Enter") { ev.preventDefault(); send(); }
      else if (ev.key === "Escape") { ev.target.blur(); }
      ev.stopPropagation();
    } else if (ev.target && ev.target.id === "admQ" && ev.key === "Enter") { ev.preventDefault(); const b = document.querySelector('[data-act="adm-search"]'); if (b) b.click(); }
  }, true);
  document.addEventListener("input", (ev) => { if (ev.target && ev.target.id === "chIn") { const c = $("#chCnt"); if (c && Date.now() >= C.next) c.textContent = `${ev.target.value.length}/200`; if (C.err) { C.err = ""; const b = document.querySelector("#chat .ch-hint .bad"); if (b) b.outerHTML = "<span></span>"; } } });

  window.CHAT = { start, refresh, renderAdmin, adminBtn, repaint: () => { const el = $("#chat"); if (el && C.open) paint(true); else if (el) paint(); }, canShare: () => canWrite(), openAdmin, get role() { return C.role; }, get state() { return C; } };
})();
