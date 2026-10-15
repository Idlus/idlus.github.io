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
  const C = { started: false, open: !!pref.open, tab: "g", g: [], p: [], peer: null, names: {}, unread: 0, unreadP: 0, unreadH: 0, c: [], v: [], unreadC: 0, unreadV: 0, count: 0, role: null, ign: new Set(), item: null, err: "", next: 0, me: {}, menu: null, loaded: false, banner: null, below: false, pin: null, ac: null };
  const A = { tab: "vue", ov: null, q: "", list: null, sel: null, msgs: null, reps: null, flag: null, mods: null, anns: null, ann: { body: "", banner: true, chat: true, hours: 24 }, pin: null, busy: false };
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
    ON.chatLive(onMsg, (n) => { C.count = n; paintHead(); }, () => { missed = true; setTimeout(() => catchUp(30000), Math.random() * 15000); }); // 1.0.9.1 : messages manqués rechargés quand le temps réel revient (1.0.10.2 : salon ouvert seulement, étalé sur 15 s)
    setTimeout(() => { slow = true; if (!C.loaded) paint(true); }, 6000); // 1.0.10.1 : pas de « Connexion au chat… » sans fin
    setInterval(() => { if (ON.chatLost && ON.chatLost()) catchUp(cuWait); }, 15000); // 1.0.10.1 : chat en direct coupé → messages rechargés sans lui (1.0.10.2 : allégé, voir catchUp)
    await refresh();
    banner();
    setInterval(banner, 120000);
    setInterval(loadPin, 120000); // 0.1.50.2 : un message épinglé changé dans le panel arrive aussi aux joueurs déjà en jeu // 0.1.40.1 : le bandeau arrive aussi aux joueurs déjà en jeu (annonce sans message dans le chat, temps réel coupé) et disparaît à l'heure prévue
    setInterval(() => { const el = $("#chat"); if (el && !el.innerHTML && S()) paint(); }, 2000); // partie commencée après le lancement
  }
  /* Rechargé à la connexion ou au changement de compte. */
  /* 1.0.9.1 : si le serveur est lent au moment du chargement (délai dépassé), le chat ne restait plus jamais sur
     « Connexion au chat… » qu'avec un rechargement de la page : il réessaie seul (5 s, 10 s, 20 s puis toutes les 30 s). */
  let busy = false, tries = 0, retryT = 0, slow = false;
  async function refresh() {
    if (busy) return; clearTimeout(retryT);
    if (document.hidden && tries) { retryT = setTimeout(refresh, 10000); return; } // 1.0.10.2 : pas de nouvel essai quand l'onglet est caché
    busy = true; if (!C.loaded && (tries || slow)) paint(true); // 1.0.10.5 : « Nouvel essai en cours… » pendant l'attente
    try { await load(); } catch (e) {}
    busy = false;
    if (C.loaded) tries = 0;
    else { tries++; retryT = setTimeout(refresh, Math.min(120000, 10000 * 2 ** (tries - 1)) + Math.random() * 5000); paint(true); } // 1.0.10.2 : 10 s, 20 s, 40 s, 80 s puis toutes les 2 min, étalé entre les joueurs
  }
  /* 1.0.10.2 : chat en direct coupé (panne Supabase Realtime). Pour ne pas charger le serveur : une seule lecture (le salon
     affiché), seulement chat ouvert et onglet visible, au plus une fois par minute, et de plus en plus espacé si ça échoue. */
  let cuAt = 0, cuWait = 60000, cuBusy = false, missed = false; // missed : messages peut-être manqués pendant que le chat était fermé
  async function catchUp(minGap) {
    if (cuBusy || !C.loaded || !C.open || document.hidden || Date.now() - cuAt < minGap) return;
    const k = C.tab === "p" ? (canWrite() ? "p" : null) : C.tab === "c" || C.tab === "v" ? C.tab : C.tab === "u" || C.tab === "a" ? null : "g"; // la guilde (et l'alliance) a sa propre mise à jour
    if (!k) return;
    cuBusy = true; cuAt = Date.now();
    const l = await ON.chatLoad(k);
    cuBusy = false;
    if (!l) { cuWait = Math.min(300000, cuWait * 2); return; }
    cuWait = 60000; missed = false; C[k] = keepLive(C[k], l);
    if (k === "p") await names(C.p.map((m) => (m.user_id === myId() ? m.to_id : m.user_id)));
    paint(true);
  }
  /* 1.0.21.2 : un rechargement du salon garde les messages arrivés en direct pendant la lecture (plus récents que la liste
     reçue) ; avant, un message (une @mention par exemple) pouvait disparaître de l'écran jusqu'au rechargement suivant */
  function keepLive(old, fresh) {
    if (!old || !old.length || !fresh) return fresh; const top = fresh.reduce((a, m) => Math.max(a, +m.id || 0), 0); const ids = new Set(fresh.map((m) => m.id));
    const add = old.filter((m) => (+m.id || 0) > top && !ids.has(m.id)); return add.length ? fresh.concat(add).slice(-200) : fresh;
  }
  async function load() {
    const [g, p, ign, role, me, c, v, pin] = await Promise.all([ON.chatLoad("g"), canWrite() ? ON.chatLoad("p") : [], canWrite() ? ON.ignores() : [], canWrite() ? ON.role() : null, canWrite() ? ON.chatMe() : {}, ON.chatLoad("c"), ON.chatLoad("v"), ON.chatPin()]);
    if (g === null && C.loaded) return; // 1.0.9.1 : rechargement raté après une coupure → on garde les messages déjà affichés
    C.pin = pin; C.g = keepLive(C.g, g || []); C.p = keepLive(C.p, p || []); C.c = c ? keepLive(C.c, c) : C.c; C.v = v ? keepLive(C.v, v) : C.v; C.ign = new Set(ign); C.role = role; C.me = me || {}; C.loaded = g !== null;
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
  const isFeat = (m) => m.kind === "ann" && !(m.data && (m.data.t === "admin" || m.data.t === "wb" || m.data.t === "giga" || m.data.t === "jack" || m.data.t === "defi" || /^race1[01]$/.test(m.data.kind))); // 1.1 : « Montrer dans le chat » du Défi du jour reste dans le Général // 1.0.5 (race11 : course de la 1.1, L'Ascension) : la course de lancement aussi // 0.1.49 : le Boss des mondes s'annonce dans le Général // 1.0.30 : la GIGA annonce d'un Dofus aussi
  /* 0.1.53.7 : mentions « @pseudo ». Surlignées dans le message ; le joueur mentionné voit le message mis en évidence
     et une pastille « @ » sur le chat et le salon, même s'il lit un autre salon. Seules les 3 premières mentions d'un
     message comptent (pas de mention de masse), un joueur ignoré ne prévient pas, et le mode lent du serveur s'applique. */
  const PS = "A-Za-zÀ-ÖØ-öø-ÿ0-9_-";
  const MRE = new RegExp(`(^|[^@${PS}])@([${PS}]{3,16})`, "g");
  const myPs = () => ((ON.profile && ON.profile.pseudo) || "").toLowerCase();
  const mentions = (b) => { const o = []; String(b || "").replace(MRE, (x, a, p) => { o.push(p.toLowerCase()); return x; }); return o; };
  const pingsMe = (m) => { const me = myPs(); return !!me && m.kind === "msg" && !!m.user_id && m.user_id !== myId() && !C.ign.has(m.user_id) && mentions(m.body).slice(0, 3).includes(me); };
  const fmtBody = (b) => { const me = myPs(); return h(b).replace(MRE, (x, a, p) => `${a}<span class="mt${p.toLowerCase() === me ? " me" : ""}">@${p}</span>`); };
  const PING = ["g", "c", "v"];
  const seenMax = (k) => (pref.ms && pref.ms[k]) || 0;
  const pings = (k) => C[k].filter((m) => m.id > seenMax(k) && pingsMe(m)).length;
  const pingsAll = () => PING.reduce((n, k) => n + pings(k), 0);
  function markSeen(k) {
    if (!PING.includes(k) || !C[k].length) return;
    const top = C[k][C[k].length - 1].id; if (top > seenMax(k)) { pref.ms = Object.assign({}, pref.ms, { [k]: top }); savePref(); }
  }
  const atNb = (n) => (n ? `<span class="n at" title="On t'a mentionné">@${n > 1 ? n : ""}</span>` : "");
  const CH_NAME = { g: "Général", c: "Commerce", v: "PvP" };
  /* Pseudos proposés quand on tape « @ » : auteurs récents du salon, puis des autres salons, puis les joueurs connectés. */
  function cands(q) {
    const me = myPs(), seen = new Set(), out = [];
    const add = (p, u) => { if (!p) return; const l = p.toLowerCase(); if (l === me || seen.has(l) || (u && C.ign.has(u))) return; seen.add(l); out.push(p); };
    const cur = C.tab === "u" && window.GUILD ? window.GUILD.msgs : C.tab === "a" && window.ALLY ? window.ALLY.msgs : C[C.tab] || [];
    [cur, C.g, C.c, C.v].forEach((L) => [...L].reverse().forEach((m) => { if (m.kind === "msg") add(m.pseudo, m.user_id); }));
    (ON.onlinePseudos ? ON.onlinePseudos() : []).forEach((p) => add(p));
    q = q.toLowerCase();
    return out.filter((p) => p.toLowerCase().startsWith(q)).concat(out.filter((p) => !p.toLowerCase().startsWith(q) && p.toLowerCase().includes(q))).slice(0, 6);
  }
  const acHtml = () => `<div class="ch-ac" id="chAc"${C.ac ? "" : " hidden"}>${C.ac ? `<span class="hd">Mentionner</span>${C.ac.list.map((p, k) => `<button class="${k === C.ac.sel ? "on" : ""}" data-act="ch-acpick" data-p="${h(p)}">@${h(p)}</button>`).join("")}` : ""}</div>`;
  const acPaint = () => { const b = $("#chAc"); if (b) b.outerHTML = acHtml(); };
  function acUpdate(i) {
    const v = i.value.slice(0, i.selectionStart == null ? i.value.length : i.selectionStart);
    const mm = C.tab !== "p" && v.match(new RegExp(`(^|\\s)@([${PS}]{0,16})$`));
    const L = mm ? cands(mm[2]) : [];
    C.ac = L.length ? { list: L, sel: 0, at: v.length - mm[2].length - 1, end: v.length } : null;
    acPaint();
  }
  function insertAt(i, from, to, txt) {
    const v = i.value; const nv = (v.slice(0, from) + txt + v.slice(to).replace(/^\s+/, "")).slice(0, 200);
    const pos = Math.min(nv.length, from + txt.length); i.value = nv; i.focus(); i.setSelectionRange(pos, pos);
    const c = $("#chCnt"); if (c && Date.now() >= nextAt()) c.textContent = `${nv.length}/200`;
  }
  function acPick(p) { const i = $("#chIn"); if (!i || !C.ac) return; const a = C.ac; C.ac = null; acPaint(); insertAt(i, a.at, a.end, `@${p} `); }
  function onMsg(m) {
    if (!m || !m.id) return;
    const list = m.ch === "p" ? C.p : m.ch === "c" ? C.c : m.ch === "v" ? C.v : C.g;
    if (list.some((x) => x.id === m.id)) return;
    list.push(m); if (list.length > 200) list.shift();
    const mine = m.user_id === myId() && m.kind === "msg";
    if (m.ch === "p") { if (m.user_id && m.pseudo) C.names[m.user_id] = m.pseudo; if (!mine && !(C.open && C.tab === "p" && C.peer === m.user_id)) { C.unreadP++; if (C.loaded && window.DX.sndPlay) window.DX.sndPlay("msg"); } }
    else if (m.ch === "c" || m.ch === "v") { const k = m.ch === "c" ? "unreadC" : "unreadV"; if (!mine && !C.ign.has(m.user_id) && !(C.open && C.tab === m.ch)) C[k]++; }
    else if (isFeat(m)) { if (!(C.open && C.tab === "h")) C.unreadH++; }
    else if (!mine && !C.ign.has(m.user_id) && !(C.open && C.tab === "g")) C.unread++;
    if (m.kind === "ann" && m.data && m.data.t === "admin" && m.data.banner) setTimeout(banner, 800);
    if (m.kind === "ann" && m.data && m.data.t === "wb" && window.WBUI && C.loaded) window.WBUI.onAnn(m); // 0.1.49 : arrivée, phase, mort du boss
    if (m.kind === "ann" && m.data && (m.data.t === "giga" || m.data.t === "jack") && window.GIGA) window.GIGA.onAnn(m); // 1.0.30 (Jackpot du Trool : 1.0.30.6) : GIGA annonce d'un Dofus, en plein écran chez tous (js/giga.js)
    if (m.kind === "ann" && m.data && /^race1[01]$/.test(m.data.kind) && C.loaded) { X().toast(`👑 ${raceTxt(m, true)}`, "rare"); if (window.DX.raceRefresh) window.DX.raceRefresh(); } // 1.0.5 : prévient tout le monde
    if (PING.includes(m.ch || "g") && pingsMe(m) && !(C.open && C.tab === (m.ch || "g"))) { X().toast(`${m.pseudo || "Un joueur"} t'a mentionné dans le chat ${CH_NAME[m.ch || "g"]}.`); if (window.DX.sndPlay) window.DX.sndPlay("msg"); } // 0.1.53.7, son 1.0.22
    paint(true);
  }

  /* ---------- affichage ---------- */
  function mount() {
    if ($("#chat")) return;
    const el = document.createElement("div"); el.id = "chat"; document.body.appendChild(el);
    const b = document.createElement("div"); b.id = "annbar"; const up = $("#topchips") || $("#updbar"); if (up) up.after(b); else document.body.prepend(b); // 0.1.57.2 : hors de la ligne de pastilles (sinon le bandeau, très haut, y écrasait la page sur téléphone)
  }
  function paint(keepScroll) {
    const el = $("#chat"); if (!el || !S()) { if (el) el.innerHTML = ""; document.body.classList.remove("chat-open"); return; }
    document.body.classList.toggle("chat-open", C.open);
    if (!C.open) { el.className = ""; el.innerHTML = minHtml(); return; }
    // 0.1.31.1 : la position de lecture est lue AVANT de redessiner (l'ancienne liste, une fois retirée, répondait 0 et le chat remontait tout en haut)
    const list = el.querySelector(".ch-list"); const top = list ? list.scrollTop : 0, oldH = list ? list.scrollHeight : 0; const atEnd = !list || top + list.clientHeight >= oldH - 30;
    // 1.0.3.3 : un texte surligné dans le chat (pour le copier) n'est pas effacé par un nouveau message : on redessine quand la sélection est finie
    if (keepScroll && list && selIn(el)) { C.held = true; return; }
    C.held = false;
    const typed = el.querySelector("#chIn") ? el.querySelector("#chIn").value : pref.draft || "";
    const focus = document.activeElement && document.activeElement.id === "chIn";
    markSeen(C.tab); // 0.1.53.7 : les mentions du salon ouvert sont lues
    // 1.0.3.3 : la zone d'écriture n'est recréée que si elle change vraiment ; sinon un message reçu fermait le clavier
    // et la bulle « Coller » du téléphone au milieu d'un copier-coller
    const sig = footHtml("").replace(/<span id="chCnt">[^<]*<\/span>/, ""), foot = el.querySelector(".ch-foot");
    const body = headHtml() + discordHtml() + pinHtml() + `<div class="ch-list" id="chList">${listHtml()}</div>`;
    if (foot && list && el.className === "chat" && C.footSig === sig && el.querySelector("#chIn")) {
      el.querySelectorAll(":scope > :not(.ch-foot)").forEach((x) => x.remove()); foot.insertAdjacentHTML("beforebegin", body);
    } else { el.className = "chat"; el.innerHTML = body + `<div class="ch-foot">${footHtml(typed)}</div>`; }
    C.footSig = sig;
    const nl = el.querySelector(".ch-list");
    if (nl && (atEnd || !keepScroll)) { nl.scrollTop = nl.scrollHeight; C.below = false; }
    else if (nl) { nl.scrollTop = top; if (nl.scrollHeight > oldH + 4) C.below = true; } // on lit plus haut : on reste en place, un bouton signale les nouveaux messages
    if (nl) {
      if (C.below) nl.insertAdjacentHTML("beforeend", `<button class="ch-new" data-act="ch-bottom">Nouveaux messages ↓</button>`);
      nl.addEventListener("scroll", () => { if (C.below && nl.scrollTop + nl.clientHeight >= nl.scrollHeight - 30) { C.below = false; const b = nl.querySelector(".ch-new"); if (b) b.remove(); } }, { passive: true });
    }
    if (focus && $("#chIn") && document.activeElement !== $("#chIn")) { const i = $("#chIn"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    cntTick(); // 1.0.12.8
  }
  const selIn = (el) => { const s = window.getSelection && window.getSelection(); return !!(s && !s.isCollapsed && s.rangeCount && el.contains(s.anchorNode) && !(s.anchorNode.closest ? s.anchorNode : s.anchorNode.parentElement).closest(".ch-foot")); };
  document.addEventListener("selectionchange", () => { if (C.held && C.open) { const el = $("#chat"); if (el && !selIn(el)) paint(true); } });
  /* 1.0.3.3 : « Copier le message » dans le menu du pseudo (le plus simple au téléphone) */
  async function copyTxt(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
    const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(a); a.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} a.remove(); return ok;
  }
  function paintHead() { const e = $("#chat .ch-on"); if (e) e.innerHTML = onlineTxt(); }
  function paintMin() { if (!C.open) paint(); }
  const onlineTxt = () => `<i></i>${C.count || 1}<span class="ol"> en ligne</span>`;
  function minHtml() {
    const last = [...C.g].reverse().find((m) => !C.ign.has(m.user_id) && !isFeat(m));
    const n = C.unread + C.unreadP + C.unreadC + C.unreadV + ((window.GUILD && window.GUILD.unread) || 0);
    return `<button class="chmin" data-act="ch-open" aria-label="Ouvrir le chat">${X().G("chat")}<span class="t">Chat</span>${evOn() ? `<span class="ev">XP et butin x2</span>` : ""}${atNb(pingsAll())}${n ? `<span class="n">${n > 99 ? "99+" : n}</span>` : ""}${last ? `<span class="last">${h(last.kind === "ann" ? annTxt(last, true) : `${last.pseudo} : ${last.body || (last.item ? "[objet]" : "")}`)}</span>` : ""}</button>`;
  }
  /* Bandeau fixe sous les onglets : le serveur Discord pour les questions et les bugs. */
  const DISCORD = "https://discord.gg/9ApPgWjPUM";
  /* 0.1.28.4 : rappel de l'événement en cours (E.EVENT), au-dessus de la carte Discord */
  const evOn = () => { const E = window.ENGINE; return !!(E && E.eventOn && E.eventOn()); };
  /* 0.1.48.2 : l'événement et le lien Discord tiennent sur une seule ligne fine sous les onglets */
  const eventHtml = () => { const E = window.ENGINE; return evOn() ? `<span class="ev">${X().IC("parchemin_or")}<span><b>${h(E.EVENT.name)}</b> : XP et butin x2</span></span>` : ""; };
  const discordHtml = () => `<div class="ch-strip">${eventHtml() || `<span class="ev muted">Questions, bugs, idées ?</span>`}<a class="dl" href="${DISCORD}" target="_blank" rel="noopener">${X().DISCORD_SVG} Discord</a></div>`;
  /* 0.1.50.2 : message épinglé en haut du chat (texte et salons choisis dans le panel admin, onglet Annonces).
     La croix le cache jusqu'au lendemain, ou jusqu'à ce que le texte change. */
  const today = () => new Date().toDateString();
  const pinBody = () => String((C.pin && C.pin.pin_body) || "").replace(/^\s*\u{1F4A1}\s*/u, "").trim(); // l'ampoule du jeu remplace l'emoji
  function pinHtml() {
    const p = C.pin, body = pinBody();
    if (!body || !String(p.pin_chs || "g").split(",").includes(C.tab)) return "";
    const hid = pref.pinHide; if (hid && hid.at === p.pin_at && hid.day === today()) return "";
    const m = body.match(/^(.{4,80}?[?!])\s+(\S.*)$/s); // la première question en gras
    return `<div class="ch-pin"><img class="pi" src="assets/ui/idee.webp" alt=""><div class="pt"><span class="pk">📌 Épinglé</span>${m ? `<b>${h(m[1])}</b> ${h(m[2])}` : h(body)}<div class="pf"><button class="btn sm primary" data-act="nav" data-v="sugg">Boîte à idées</button></div></div><button class="px" data-act="ch-pinx" title="Masquer jusqu'à demain" aria-label="Masquer le message épinglé">×</button></div>`;
  }
  async function loadPin() {
    const p = await ON.chatPin(); if (!p) return;
    const was = JSON.stringify(C.pin); C.pin = p;
    if (JSON.stringify(p) !== was && C.open) paint(true);
  }
  /* 0.1.48.2 : six salons sur une ligne à part, sous le titre ; chacun a son icône et sa pastille de messages non lus */
  const nb = (n) => (n ? `<span class="n">${n > 99 ? "99+" : n}</span>` : "");
  function headHtml() {
    const G = X().G;
    const tab = (k, ic, n, unread, lock) => lock ? `<span class="ch-tab lock" data-tip="${h(lock)}">${G("lock")}<span>${n}</span></span>`
      : `<button class="ch-tab${C.tab === k ? " on" : ""}" data-act="ch-tab" data-v="${k}">${G(ic)}<span>${n}</span>${C.tab === k ? "" : PING.includes(k) && pings(k) ? atNb(pings(k)) : nb(unread)}</button>`;
    const guild = window.GUILD && window.GUILD.inGuild();
    return `<div class="ch-head"><div class="ch-top"><span class="ch-ttl">${G("chat")} Chat</span><span class="ch-on">${onlineTxt()}</span><button class="ch-x" data-act="ch-close" title="Réduire" aria-label="Réduire le chat">–</button></div>
      <div class="ch-tabs" role="tablist">${tab("g", "chat", "Général", C.unread)}${tab("c", "cart", "Commerce", C.unreadC)}${tab("v", "target", "PvP", C.unreadV)}${tab("u", "shield", "Guilde", guild ? window.GUILD.unread : 0, guild ? "" : "Rejoins une guilde (Communauté › Guilde) pour discuter avec elle.")}${window.ALLY && window.ALLY.inAlliance() ? tab("a", "crown", "Alliance", window.ALLY.unread) : ""}${tab("p", "share", "Privé", C.unreadP, canWrite() ? "" : "Connecte-toi pour écrire en privé.")}${tab("h", "star", "Hauts faits", C.unreadH)}</div></div>`;
  }
  function msgHtml(m) {
    if (m.kind === "ann" && !annTxt(m, true).trim()) return ""; // annonce illisible : on ne montre pas de barre vide
    if (m.kind === "ann" && m.data && m.data.t === "wb" && window.WBUI) return window.WBUI.card(m); // 0.1.49 : carte animée du Boss des mondes
    if (m.kind === "ann" && m.data && (m.data.t === "giga" || m.data.t === "jack") && window.GIGA) return window.GIGA.card(m); // 1.0.30 : ligne dorée, un clic remontre l'annonce
    if (m.kind === "ann" && m.data && m.data.t === "defi") return defiCard(m); // 1.1 : score du Défi du jour montré par le joueur
    if (m.kind === "ann" && m.data && /^race1[01]$/.test(m.data.kind)) return `<div class="ann race">${X().IC("couronne")}<span>${raceTxt(m)}</span></div>`; // 1.0.5 : carte dorée
    if (m.kind === "ann") return `<div class="ann${m.data && m.data.t === "admin" ? " ann-adm" : ""}${m.data && m.data.t === "chroma" ? " ann-chroma" : ""}">${X().IC(m.data && (m.data.t === "dofus" || m.data.t === "dsub") ? "dofus" : m.data && m.data.t === "mrare" ? "ailes" : m.data && m.data.t === "admin" ? "parchemin_or" : "trophee")}<span>${annTxt(m)}</span></div>`;
    const me = m.user_id === myId();
    const it = m.item && window.DATA.ITEMS[m.item.tpl];
    const chip = it ? `<button class="itm" data-act="ch-item" data-tpl="${h(m.item.tpl)}"><img src="${X().itemImg(m.item.tpl)}" alt="">[${h(it.name)}]</button>` : "";
    return `<div class="msg${me ? " me" : ""}${pingsMe(m) ? " ment" : ""}${X().staffCls(m.user_id)}">${X().cmed(m.cls, m.lvl)}<div><div class="who"><button class="ps" data-act="ch-who" data-u="${h(m.user_id || "")}" data-p="${h(m.pseudo || "")}" data-id="${m.id}">${X().pname(m.pseudo || "?", m.user_id)}</button>${m.lvl ? `<span class="lv">niv. ${m.lvl}</span>` : ""}${m.title ? `<span class="tt">${h(m.title)}</span>` : ""}<span class="hr">${hhmm(m.created_at)}</span></div><div class="tx">${fmtBody(m.body || "")}${m.body && chip ? " " : ""}${chip}</div></div></div>`;
  }
  /* 1.0.5 : course de lancement : « X prend la 3e place ! Plus que 7 places » */
  function raceTxt(m, plain) {
    const n = +m.data.key || 1, left = 10 - n, b = (x) => (plain ? x : `<b>${x}</b>`); const v = m.data.kind === "race11" ? "1.1" : "1.0"; // 1.1 : l'étage 100 de L'Ascension en Difficile
    return `${b(h(m.pseudo || "?"))} prend la ${b(`${n === 1 ? "1re" : n + "e"} place`)} de la Course de lancement${v === "1.1" ? " de L'Ascension" : ""} !${plain ? " " : "<small>"}${left > 0 ? `Plus que ${left} place${left > 1 ? "s" : ""} pour le titre « Légende de la ${v} ».` : `La course est finie : les 10 Légendes de la ${v} sont connues.`}${plain ? "" : "</small>"}`;
  }
  /* 1.1 (Défi du jour, série 3) : carte du score validé, postée par le serveur (supabase/defi.sql, defi_share) */
  function defiInfo(d) {
    const E = window.DX.E; const T = E.defiTier && E.defiTier(d.tier); const dg = window.DATA.DUNGEONS[d.did];
    const M = E.defiMedal ? E.defiMedal(+d.score || 0) : null; const R = d.rules && typeof d.rules === "object" ? Object.values(d.rules) : [];
    return { sc: (+d.score || 0).toLocaleString("fr-FR"), tier: T ? T.name : "", dg: dg ? dg.name : "", med: M ? M.name : "", held: R.filter(Boolean).length, tot: R.length };
  }
  function defiCard(m) {
    const d = m.data; const i = defiInfo(d); const team = Array.isArray(d.team) ? d.team.slice(0, 8) : [];
    return `<div class="ann ann-defi">${X().IC("trophee")}<span class="t"><span><b>${h(m.pseudo || "?")}</b> a fait <b>${i.sc} points</b> au Défi du jour !</span><small>${[i.tier, i.dg, i.med ? `bourse ${i.med.toLowerCase()}` : "", i.tot ? `${i.held} règle${i.held > 1 ? "s" : ""} sur ${i.tot}` : ""].filter(Boolean).map(h).join(" · ")}</small>${team.length ? `<span class="df-team">${team.map((c) => (/^[a-z]+$/.test(c) ? `<img src="assets/h/${c}_sym.png" alt="">` : "")).join("")}</span>` : ""}</span></div>`;
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
      case "jack": return window.GIGA ? window.GIGA.txt(m, plain) : t(`${p} remporte le Jackpot du Trool : ${b(`${(+d.k || 0).toLocaleString("fr-FR")} kamas`)} !`); // 1.0.30.6
      case "giga": return window.GIGA ? window.GIGA.txt(m, plain) : t(`${p} obtient le ${b((DOF[d.id] && DOF[d.id].name) || "Dofus")} !`); // 1.0.30
      case "dsub": return t(`${p} sublime son ${b((DOF[d.id] && DOF[d.id].name) || "Dofus")} : Potentiel X !`); // 1.0.30 : Potentiel des Dofus (supabase/collections.sql)
      case "chroma": { const M = (window.DATA && window.DATA.MONSTERS) || {}; return t(`${p} trouve un ${b((M[d.k] && M[d.k].name) || "monstre")} ${d.p ? "prismatique" : "chromatique"} !`); } // 1.0.33 : chromatiques (supabase/chromatiques.sql)
      case "defi": { const i = defiInfo(d); return t(`${p} a fait ${b(`${i.sc} points`)} au Défi du jour${i.tier ? ` (${h(i.tier)})` : ""} !`); } // 1.1
      case "mrare": { const SP = { dd: "Dragodinde", mu: "Muldo", vk: "Volkorne" }; const f = d.sp === "dd"; const un = f ? "une" : "un"; const nm = `${SP[d.sp] || "Monture"} ${String(d.c || "")}`; // 1.1 : naissance exceptionnelle à l'enclos (supabase/elevage.sql)
        return t(d.k === "chr" ? `${p} fait naître ${un} ${b(nm + " chromatique")} : une naissance sur 150 !` : d.k === "st" ? `${p} fait naître ${un} ${b(nm)} ${"★".repeat(Math.max(1, Math.min(7, +d.st || 5)))} !` : `${p} fait naître ${f ? "sa première" : "son premier"} ${b(nm)}, couleur de dernière génération !`); }
      case "koli": return t(`${p} atteint le grade ${b(["Bronze", "Argent", "Or", "Cristal", "Diamant"][d.g] || "Or")} au Kolizéum (cote ${(+d.cote || 0).toLocaleString("fr-FR")}) !`); // 0.1.44
      case "admin": return t(`${plain ? "Annonce" : "<b>Annonce</b>"} : ${h(m.body || "")}`);
      case "wb": return t(d.ev === "dead" ? `${b(d.name || "Le boss")} est tombé ! Dernier coup : ${p}.` : d.ev === "ph" ? `${b(d.name || "Le boss")} passe en phase ${d.ph} !` : `Boss des mondes : ${b(d.name || "un boss")} arrive !`); // 0.1.49
      default: return h(m.body || "");
    }
  }
  function listHtml() { // 1.0.10.1 : le joueur sait que le direct est coupé (incident du serveur)
    const l = listHtml0();
    return C.loaded && C.tab !== "u" && ON.chatLost && ON.chatLost() ? `<div class="sys">Chat en direct perturbé côté serveur : messages mis à jour chaque minute tant que le chat est ouvert. Tu peux toujours écrire.</div>${l}` : l;
  }
  function listHtml0() {
    if (!C.loaded) return tries || slow ? `<div class="sys">Chat momentanément indisponible, reconnexion automatique…<br>${busy ? `<span class="small" style="display:inline-block;margin-top:6px">Nouvel essai en cours…</span>` : `<button class="btn sm" data-act="ch-retry" style="font-style:normal;margin-top:6px">Réessayer maintenant</button>`}</div>` : `<div class="sys">Connexion au chat…</div>`;
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
    if (C.tab === "a") { // Alliances (11A) : salon des guildes de l'alliance (js/allianceui.js)
      if (!window.ALLY || !window.ALLY.inAlliance()) { C.tab = "g"; return listHtml(); }
      return `<div class="sys">Chat de ton alliance : seuls les membres de ses guildes le voient.</div>` + window.ALLY.msgs.map((m) => (m.kind === "sys" ? `<div class="sys">${h(m.body)}</div>` : msgHtml(m))).join("");
    }
    if (C.tab === "u") {
      if (!window.GUILD || !window.GUILD.inGuild()) { C.tab = "g"; return listHtml(); }
      return `<div class="sys">Chat de ta guilde : seuls ses membres le voient.</div>` + window.GUILD.msgs.map((m) => (m.kind === "sys" ? `<div class="sys">${h(m.body)}</div>` : msgHtml(m))).join("");
    }
    if (C.tab === "c" || C.tab === "v") {
      const rows = C[C.tab].filter((m) => !C.ign.has(m.user_id));
      const intro = C.tab === "c" ? "Commerce : achat, vente et échange. Un message toutes les 30 secondes ; montrez vos objets avec « Montrer dans le chat »." : "PvP : Kolizéum, défis et adversaires. Les grades Or, Cristal et Diamant y sont annoncés.";
      return `<div class="sys">${intro}</div>` + rows.map(msgHtml).join("");
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
    const wait = Math.max(0, Math.ceil((nextAt() - Date.now()) / 1000));
    return `${C.tab === "p" ? `<div class="ch-back"><button class="lnk" data-act="ch-peer" data-u="">← Toutes les conversations</button></div>` : ""}${it ? `<div class="ch-att"><span class="itm"><img src="${X().itemImg(C.item)}" alt="">[${h(it.name)}]</span><button class="lnk" data-act="ch-unitem">retirer</button></div>` : ""}
      ${acHtml()}<div class="ch-in"><input id="chIn" value="${h(typed)}" maxlength="200" autocomplete="off" placeholder="${C.tab === "p" ? `Écrire à ${h(C.names[C.peer] || "ce joueur")}…` : C.tab === "u" ? "Écrire à ta guilde…" : C.tab === "a" ? "Écrire à ton alliance…" : C.tab === "c" ? "Vendre, acheter, échanger…" : C.tab === "v" ? "Kolizéum, adversaires…" : "Écrire à tout le monde…"}"><button class="btn sm primary" data-act="ch-send">Envoyer</button></div>
      <div class="ch-hint">${C.err ? `<span class="bad">${h(C.err)}</span>` : `<span>${C.tab === "p" ? "Bouton « Montrer dans le chat » sur la fiche d'un objet" : "@pseudo pour mentionner un joueur"}</span>`}<span id="chCnt">${wait ? `encore ${wait} s` : `${typed.length}/200`}</span></div>`; // 1.0.12.8 : texte d'aide du PvP raccourci (coupé au téléphone)
  }

  /* ---------- actions du chat ---------- */
  const nextAt = () => (C.tab === "c" ? Math.max(C.next, C.nextC || 0) : C.next); // 0.1.48.2 : le Commerce a son propre rythme (30 s)
  /* 1.0.12.8 : le compteur décompte « encore N s » chaque seconde, puis montre la longueur du texte tapé (et retire « Doucement… ») */
  let cntT = 0;
  function cntTick() {
    clearTimeout(cntT); const c = $("#chCnt"), i = $("#chIn"); if (!c || !i) return;
    const left = nextAt() - Date.now();
    if (left > 0) { c.textContent = `encore ${Math.ceil(left / 1000)} s`; cntT = setTimeout(cntTick, (left % 1000 || 1000) + 20); return; }
    c.textContent = `${i.value.length}/200`;
    if (C.err && C.err === C.errWait) { C.err = ""; const b = $("#chat .ch-hint .bad"); if (b) b.outerHTML = "<span></span>"; }
  }
  async function send() {
    const i = $("#chIn"); if (!i) return; const body = i.value.trim();
    if (!body && !C.item) return;
    if (Date.now() < nextAt()) { C.err = C.tab === "c" ? "Commerce : un message toutes les 30 secondes." : "Doucement : attends quelques secondes."; C.errWait = C.err; return paint(true); }
    const to = C.tab === "p" ? C.peer : null; const ch = C.tab === "c" || C.tab === "v" ? C.tab : null;
    const err = C.tab === "a" && window.ALLY ? await window.ALLY.say(body) : C.tab === "u" && window.GUILD ? await window.GUILD.say(body, C.item ? { tpl: C.item } : null) : await ON.chatSend(body, to, C.item ? { tpl: C.item } : null, ch);
    if (err) { C.err = err; if (/muet/.test(err)) C.me = await ON.chatMe(); return paint(true); }
    C.err = ""; C.item = null; C.ac = null; i.value = ""; pref.draft = ""; savePref(); C.next = Date.now() + 4000; if (ch === "c") C.nextC = Date.now() + 30000;
    // le message revient par le temps réel ; on recharge au cas où la connexion temps réel serait coupée
    setTimeout(async () => { const k = to ? "p" : ch || "g"; const l = await ON.chatLoad(k); if (l && l.length) { C[k] = keepLive(C[k], l); paint(true); } }, 1500);
    paint();
  }
  function menu(t) {
    closeMenu();
    const u = t.dataset.u, p = t.dataset.p, id = +t.dataset.id; if (!u) return;
    const r = t.getBoundingClientRect(); const el = document.createElement("div"); el.className = "chmenu"; el.id = "chMenu";
    const mine = u === myId(); const ign = C.ign.has(u);
    el.innerHTML = `<div class="hd"><b>${h(p)}</b></div>
      ${msgById(id) && msgById(id).body ? `<button data-act="ch-copy" data-id="${id}">${X().G("copy")} Copier le message</button>` : ""}
      <button data-act="ch-prof" data-u="${h(u)}">${X().IC("trophee")} Voir son profil</button>
      ${!mine && canWrite() && !C.me.banned && C.tab !== "p" && C.tab !== "h" ? `<button data-act="ch-ment" data-p="${h(p)}"><b class="at">@</b> Le mentionner</button>` : ""}
      ${!mine && canWrite() ? `<button data-act="ch-pm" data-u="${h(u)}" data-p="${h(p)}">${X().G("chat")} Lui écrire en privé</button>
      ${window.MARKET ? `<button data-act="mk-trade-ask" data-p="${h(p)}">${X().G("chat")} Proposer un échange</button>` : ""}
      <button data-act="ch-ign" data-u="${h(u)}" data-v="${ign ? 0 : 1}">${X().G(ign ? "unlock" : "lock")} ${ign ? "Ne plus ignorer" : "Ignorer ses messages"}</button>
      <button class="red" data-act="ch-rep" data-u="${h(u)}" data-p="${h(p)}" data-id="${id}">${X().G("warn")} Signaler</button>` : ""}
      ${C.role && !mine ? `<button data-act="adm-find" data-q="${h(p)}">${X().G("shield")} Fiche admin</button>` : ""}`;
    document.body.appendChild(el);
    const w = el.offsetWidth, hgt = el.offsetHeight;
    const nv = $("#nav .sn-mob"), nr = nv && nv.getBoundingClientRect(), bot = (nr && nr.height ? nr.top : innerHeight) - 8; // 1.0.12.8 : jamais sur la barre du bas du téléphone
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left - 20)) + "px";
    el.style.top = Math.max(8, r.bottom + 4 + hgt <= bot ? r.bottom + 4 : Math.min(bot, r.top - 4) - hgt) + "px"; // 1.0.12.8 : pas la place dessous : le menu s'ouvre au-dessus du pseudo
  }
  const msgById = (id) => C.g.concat(C.p, C.c, C.v, (window.GUILD && window.GUILD.msgs) || []).find((x) => x.id === id);
  const closeMenu = () => { const m = $("#chMenu"); if (m) m.remove(); };
  function reportSheet(u, p, id) {
    const m = C.g.concat(C.p, C.c, C.v).find((x) => x.id === id);
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
    const a = list.find((x) => x.id > seen) || null; if (!a || !C.ann || a.id !== C.ann.id) C.annMore = false;
    C.ann = a; annPaint();
  }
  /* 1.0.12.8 : au téléphone, une annonce longue tient sur 2 lignes ; « Lire la suite » l'ouvre en entier */
  function annPaint() {
    const el = $("#annbar"), a = C.ann; if (!el) return;
    el.innerHTML = a ? `<div class="annbar${C.annMore ? " more" : ""}">${X().IC("parchemin_or")}<span class="grow"><span class="atx">${h(a.body)}</span><button class="lnk" data-act="ch-annmore">${C.annMore ? "Réduire" : "Lire la suite"}</button></span><button class="tc-x" data-act="ch-annok" data-id="${a.id}" aria-label="Fermer" title="Fermer">✕</button></div>` : "";
    annClip();
  }
  const annClip = () => { const t = $("#annbar .atx"); if (t && !C.annMore) t.closest(".annbar").classList.toggle("clip", t.scrollHeight > t.clientHeight + 1); };
  addEventListener("resize", annClip, { passive: true }); // téléphone tourné

  /* ---------- panel admin ---------- */
  const isAdmin = () => C.role === "admin";
  function adminBtn() { return C.role ? `<button class="cloud admbtn" data-act="adm-open" data-tip="${C.role === "admin" ? "Panel Xener" : "Modération"}" aria-label="${C.role === "admin" ? "Panel Xener" : "Modération"}">${X().G("shield")}</button>` : ""; } // 1.0.30 : Panel Xener (js/panel.js)
  const ATABS = () => [["vue", "Vue d'ensemble"], ["joueurs", "Joueurs"]].concat(isAdmin() && window.FICHES ? [["fiches", "Fiches joueurs"]] : []).concat([ ["sig", "Signalements", A.ov && A.ov.reports], ["verif", "En vérification", A.ov && (A.ov.flagged + (A.ov.suspect || 0))]]).concat(window.MARKET ? [["hdv", "Hôtel de vente"]] : []).concat(window.GUILD ? [["guildes", "Guildes"]] : []).concat(window.IDEES ? [["idees", "Suggestions"]] : []).concat(window.BUGS ? [["bugs", "Bugs"]] : []).concat(window.BUILDS ? [["builds", "Builds"]] : []).concat(isAdmin() ? [["ann", "Annonces"]].concat(window.GIFTS ? [["codes", "Codes cadeaux"]] : []).concat([["equipe", "Équipe"]]) : []).filter((x) => isAdmin() || ["vue", "joueurs", "sig"].includes(x[0])); // 1.0.30 : les modérateurs gardent seulement les outils du chat
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
    if (A.tab === "bugs") A.bugs = await r("adm_bugs"); // 1.1.1.3, voir js/bugs.js
    if (A.tab === "builds") A.builds = await r("adm_builds"); // 1.0.23, voir js/builds.js
    if (A.tab === "fiches" && window.FICHES && isAdmin()) await window.FICHES.load(); // 0.1.52.1, voir js/fiches.js
    if (window.PANEL && window.PANEL.load) await window.PANEL.load(A.tab); // 1.0.30 : pages ajoutées au Panel Xener (js/panel.js)
  }
  function renderAdmin(main) {
    if (!C.role) { main.innerHTML = `<section class="panel"><div class="pad empty">Le panel admin est réservé à l'équipe d'Idlus.</div></section>`; return; }
    if (window.GIFTS) window.GIFTS.readForm(); // garde ce qui est tapé dans « Codes cadeaux »
    keepFocus(() => (main.innerHTML = admHtml(true)));
    admLoad().then(() => { if (window.DX.ui.tab === "admin") { const m = $("#main"); if (window.GIFTS) window.GIFTS.readForm(); if (m) keepFocus(() => (m.innerHTML = admHtml(false))); } });
  }
  /* 1.0.4.8 : le champ en cours (et le curseur) reste actif quand le panel se redessine */
  function keepFocus(fn) {
    const a = document.activeElement; const id = a && a.id && a.closest && a.closest("#main") ? a.id : "";
    let s0 = null, s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) {}
    fn();
    const b = id && document.getElementById(id); if (!b || b === document.activeElement) return;
    b.focus({ preventScroll: true }); try { if (s0 !== null && s0 !== undefined) b.setSelectionRange(s0, s1); } catch (e) {}
  }
  const repaintAdm = () => { const m = $("#main"); if (m && window.DX.ui.tab === "admin") { if (window.GIFTS) window.GIFTS.readForm(); keepFocus(() => (m.innerHTML = admHtml(false))); } };
  function admHtml(loading) {
    if (window.PANEL && window.PANEL.html) return window.PANEL.html(loading); // 1.0.30 : Panel Xener, menu par thème et recherche (js/panel.js)
    const tabs = `<div class="atabs">${ATABS().map(([k, n, c]) => `<button class="${k === A.tab ? "on" : ""}" data-act="adm-tab" data-v="${k}">${n}${c ? ` <span class="n">${c}</span>` : ""}</button>`).join("")}</div>`;
    const body = loading || !A.ov ? `<div class="box"><div class="empty">Chargement…</div></div>` : admBody();
    return `<section class="adm"><div class="ahd"><h1>${isAdmin() ? "Administration" : "Modération"}</h1><span class="badge">${isAdmin() ? "Réservé à ton compte" : "Modérateur"}</span><button class="btn sm" data-act="adm-reload">Actualiser</button>${isAdmin() ? `<button class="btn sm" data-act="adm-test">${X().G("bug")} Panel de test</button>` : ""}</div>
      <p class="small muted">Ce panel agit sur le serveur, pour tous les joueurs. Il ne touche pas à ta partie. « Panel de test » passe sur ta partie de test (hors ligne, sauvegarde séparée) : ta vraie partie est envoyée en ligne puis mise de côté, intacte.</p>${tabs}${body}</section>`;
  }
  const when = (t) => { if (!t) return "—"; const s = (Date.now() - new Date(t)) / 1000; return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const dur = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return sec >= 3600 ? `${Math.round(sec / 3600)} h` : `${Math.round(sec / 60)} min`; };
  function admBody() {
    const o = A.ov;
    if (A.tab === "hdv" && window.MARKET) return window.MARKET.adminHtml(A.hdv);
    if (A.tab === "guildes" && window.GUILD) return window.GUILD.adminHtml(A.guildes);
    if (A.tab === "codes" && window.GIFTS) return window.GIFTS.adminHtml(A.codes);
    if (A.tab === "idees" && window.IDEES) return window.IDEES.adminHtml(A.idees);
    if (A.tab === "bugs" && window.BUGS) return window.BUGS.adminHtml(A.bugs);
    if (A.tab === "builds" && window.BUILDS) return window.BUILDS.adminHtml(A.builds);
    if (A.tab === "fiches" && window.FICHES) return window.FICHES.adminHtml();
    if (A.tab === "vue") {
      const st = o.settings || {};
      return `<div class="kpis"><div class="kpi"><b>${o.accounts}</b><span>comptes créés</span></div><div class="kpi"><b>${C.count || 1}</b><span>joueurs en ligne maintenant</span></div><div class="kpi"><b>${o.active}</b><span>parties envoyées ces 24 h</span></div><div class="kpi${o.reports + o.flagged + (o.suspect || 0) ? " warn" : ""}"><b>${o.reports + (isAdmin() ? o.flagged + (o.suspect || 0) : 0)}</b><span>choses à regarder</span></div></div>
      <div class="two"><div class="box"><h2>À regarder</h2>
        ${o.reports ? `<div class="ln"><span class="st m">${o.reports} signalé${o.reports > 1 ? "s" : ""}</span>joueurs signalés dans le chat<button class="btn sm" style="margin-left:auto" data-act="adm-tab" data-v="sig">Voir</button></div>` : ""}
        ${o.flagged && isAdmin() ? `<div class="ln"><span class="st v">En vérification</span>${o.flagged} joueur${o.flagged > 1 ? "s" : ""} retiré${o.flagged > 1 ? "s" : ""} des classements<button class="btn sm" style="margin-left:auto" data-act="adm-tab" data-v="verif">Voir</button></div>` : ""}
        ${o.suspect && isAdmin() ? `<div class="ln"><span class="st v">À vérifier</span>${o.suspect} joueur${o.suspect > 1 ? "s" : ""} signalé${o.suspect > 1 ? "s" : ""} par la vérification, toujours classé${o.suspect > 1 ? "s" : ""} : à toi de décider<button class="btn sm" style="margin-left:auto" data-act="adm-tab" data-v="verif">Voir</button></div>` : ""}
        ${o.muted ? `<div class="ln"><span class="st m">Sanctions</span>${o.muted} joueur${o.muted > 1 ? "s" : ""} muet${o.muted > 1 ? "s" : ""} ou banni${o.muted > 1 ? "s" : ""} du chat</div>` : ""}
        ${o.reports + o.flagged + (o.suspect || 0) + o.muted ? "" : `<div class="ln muted">Rien à signaler.</div>`}</div>
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
      return F.length ? `<div class="box">${F.map((x) => `<div class="ln">${X().cmed(x.cls)}<b>${h(x.pseudo)}</b><span class="xs muted">${h(x.reason || "")}</span><span class="t">${when(x.updated_at)}</span>${x.flagged ? `<span class="st m">Retiré</span><button class="btn sm" data-act="adm-flag" data-u="${x.id}" data-v="0" title="Vérifié : il revient dans les classements et y reste, même après ses prochains envois">Remettre</button>` : `<span class="st v">Toujours classé</span><button class="btn sm" data-act="adm-flag" data-u="${x.id}" data-v="0" title="Vérifié : il reste dans les classements, la vérification ne le signale plus">C'est bon</button><button class="btn sm danger" data-act="adm-flag" data-u="${x.id}" data-v="1" title="Il triche : retiré des classements jusqu'à ce que tu le remettes">Retirer</button>`}<button class="btn sm" data-act="adm-find" data-q="${h(x.pseudo)}">Fiche</button></div>`).join("")}</div>`
        : `<div class="box"><div class="empty">Personne n'est en vérification.</div></div>`;
    }
    if (A.tab === "ann") {
      const a = A.ann; const st = Object.assign({}, C.pin, o.settings); const pn = A.pin || { body: st.pin_body || "", chs: st.pin_chs || "g" }; const on = pn.chs.split(",");
      return `<div class="box"><h2>Message épinglé du chat</h2><p class="small muted">Reste en haut du chat pour tous les joueurs, avec le bouton « Boîte à idées ». 200 caractères au plus. Un joueur qui le ferme le revoit le lendemain, ou tout de suite si tu changes le texte.</p>
        <textarea id="admPin" maxlength="200" placeholder="Ex. : Une idée pour améliorer Idlus ? Partagez-la ici ou dans la Boîte à idées !">${h(pn.body)}</textarea>
        <div class="row small"><span class="muted">Salons :</span>${[["g", "Général"], ["c", "Commerce"], ["v", "PvP"]].map(([k, n]) => `<label class="row"><input type="checkbox" id="admPin${k}" ${on.includes(k) ? "checked" : ""}> ${n}</label>`).join("")}<span class="muted" id="admPinN" style="margin-left:auto">${pn.body.length}/200</span>${st.pin_body ? `<button class="btn sm" data-act="adm-pinoff">Retirer</button>` : ""}<button class="btn sm primary" data-act="adm-pin">Enregistrer</button></div></div>
        <div class="box"><h2>Nouvelle annonce</h2><textarea id="admAnn" maxlength="300" placeholder="Ex. : maintenance ce soir à 22 h, le chat sera coupé 10 minutes.">${h(a.body)}</textarea>
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
    return `${x.is_admin ? `<span class="st mod">Admin</span>` : x.is_mod ? `<span class="st mod">Modérateur</span>` : ""}${x.suspended_at ? `<span class="st m">Suspendu</span>` : ""}${x.banned ? `<span class="st m">Banni du chat</span>` : mute ? `<span class="st m">Muet ${dur((new Date(x.mute_until) - Date.now()) / 1000)}</span>` : ""}${x.flagged ? `<span class="st v">Retiré des classements</span>` : x.suspect ? `<span class="st v">À vérifier</span>` : x.verified ? `<span class="st mod">Vérifié</span>` : ""}`;
  }
  function ficheHtml(x) {
    const mute = x.mute_until && new Date(x.mute_until) > Date.now(); const H = x.heroes || [];
    const self = x.id === myId();
    return `<div class="box"><div class="row between"><div class="row">${X().cmed(x.cls)}<h2>${h(x.pseudo)}</h2>${stTags(x)}</div><span class="xs muted">compte créé le ${new Date(x.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span></div>
      <div class="fiche"><div><small>Niveau d'équipe</small>${x.level || 0}</div><div><small>Temps de jeu</small>${dur(x.playtime || 0)}</div><div><small>Dernier envoi de la partie</small>${when(x.last_save)}</div>
        <div><small>Héros</small>${H.slice(0, 4).map((c) => `${h(clsName(c.cls))} ${c.lvl}${c.ren ? ` (R${c.ren})` : ""}`).join(", ") || "—"}</div><div><small>Signalements reçus</small>${x.reports || 0}</div><div><small>Classements</small>${x.flagged ? `en vérification${x.flag_reason ? ` (${h(x.flag_reason)})` : ""}` : "visible"}</div></div>
      ${self ? `<p class="small muted">C'est ton compte.</p>` : `<div class="acts"><button class="btn sm" data-act="ch-prof" data-u="${x.id}">Voir son profil</button>${isAdmin() && window.FICHES ? `<button class="btn sm" data-act="adm-fiche" data-u="${x.id}">Fiche détaillée</button>` : ""}
        ${mute ? `<button class="btn sm" data-act="adm-mute" data-u="${x.id}" data-v="0">Lever le muet</button>` : ""}<button class="btn sm" data-act="adm-mute" data-u="${x.id}" data-v="60">Muet 1 h</button><button class="btn sm" data-act="adm-mute" data-u="${x.id}" data-v="1440">Muet 24 h</button>
        ${isAdmin() ? `<button class="btn sm${x.banned ? "" : " danger"}" data-act="adm-ban" data-u="${x.id}" data-v="${x.banned ? 0 : 1}">${x.banned ? "Lever le bannissement" : "Bannir du chat"}</button>
        <button class="btn sm" data-act="adm-flag" data-u="${x.id}" data-v="${x.flagged ? 0 : 1}">${x.flagged ? "Remettre dans les classements" : "Retirer des classements"}</button>${x.suspect && !x.flagged ? `<button class="btn sm" data-act="adm-flag" data-u="${x.id}" data-v="0">C'est bon</button>` : ""}
        <button class="btn sm" data-act="adm-rename" data-u="${x.id}">Changer son pseudo</button>${window.PANEL ? `<button class="btn sm" data-act="adm-pxcopy" data-u="${x.id}" data-p="${h(x.pseudo)}">Copier dans ma partie de test</button>` : ""}
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
    if (a === "nav" && t.closest("#chat") && matchMedia("(max-width:640px)").matches) { C.open = false; pref.open = false; if ($("#chIn")) pref.draft = $("#chIn").value; savePref(); paint(); return; } // le chat couvre la page sur téléphone : on le réduit (1.0.12.8 : en gardant le message en cours, comme la croix)
    if (!/^(ch|adm)-/.test(a)) return;
    switch (a) {
      case "ch-open": C.open = true; pref.open = true; savePref(); if (missed) setTimeout(() => catchUp(0), 50); if (C.tab === "g") C.unread = 0; if (C.tab === "c") C.unreadC = 0; if (C.tab === "v") C.unreadV = 0; paint(); setTimeout(() => { const i = $("#chIn"); if (i && matchMedia("(min-width:641px)").matches) i.focus(); }, 30); return;
      case "ch-bottom": { const l = $("#chat .ch-list"); C.below = false; t.remove(); if (l) l.scrollTop = l.scrollHeight; return; }
      case "ch-retry": refresh(); return;
      case "ch-close": C.open = false; pref.open = false; pref.draft = $("#chIn") ? $("#chIn").value : ""; savePref(); paint(); return;
      case "ch-tab": C.tab = d.v; C.err = ""; C.ac = null; if (d.v === "g") C.unread = 0; if (d.v === "h") C.unreadH = 0; if (d.v === "c") C.unreadC = 0; if (d.v === "v") C.unreadV = 0; if (d.v === "u" && window.GUILD) window.GUILD.chatSeen(); if (d.v === "a" && window.ALLY) { window.ALLY.chatSeen(); window.ALLY.chatPoll(); } if (d.v === "p" && !C.peer) C.unreadP = 0; paint(); return;
      case "ch-peer": C.peer = d.u || null; C.err = ""; if (C.peer) C.unreadP = 0; paint(); return;
      case "ch-send": send(); return;
      case "ch-acpick": acPick(d.p); return;
      case "ch-ment": { closeMenu(); const i = $("#chIn"); if (!i) return; const v = i.value.replace(/\s+$/, ""); insertAt(i, 0, i.value.length, `${v ? v + " " : ""}@${d.p} `); return; }
      case "ch-who": menu(t); return;
      case "ch-copy": { closeMenu(); const m = msgById(+d.id); if (m && m.body) X().toast((await copyTxt(m.body)) ? "Message copié." : "Copie impossible : reste appuyé sur le texte pour le sélectionner."); return; }
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
      case "ch-pinx": pref.pinHide = { at: C.pin && C.pin.pin_at, day: today() }; savePref(); paint(true); return;
      case "ch-annok": pref.annSeen = +d.id; savePref(); banner(); return;
      case "ch-annmore": C.annMore = !C.annMore; annPaint(); return; // 1.0.12.8
      case "adm-open": openAdmin(); return;
      case "adm-tab": A.tab = d.v; repaintAdm(); await admLoad(); repaintAdm(); return;
      case "adm-reload": A.ov = null; repaintAdm(); await admLoad(); repaintAdm(); return;
      case "adm-test": { // 1.0.8.2 : partie de test sur le jeu public (compte admin vérifié par le serveur)
        if (!isAdmin()) return; X().toast("Passage sur ta partie de test…");
        try { await X().onPush(); } catch (er) {}
        try { localStorage.setItem("idlus-testeur", "1"); localStorage.setItem("idlus-partie-test", "1"); } catch (er) {}
        location.reload(); return; }
      case "adm-find": openAdmin("joueurs", d.q || ""); return;
      case "adm-fiche": if (window.FICHES) window.FICHES.select(d.u); openAdmin("fiches"); return;
      case "adm-search": A.q = ($("#admQ").value || "").trim(); A.sel = null; A.msgs = null; await admLoad(); repaintAdm(); return;
      case "adm-sel": A.sel = (A.list || []).find((x) => x.id === d.id) || null; A.ren = A.sus = null; await admLoad(); repaintAdm(); return;
      case "adm-mute": if (await admDo("adm_mute", { p_user: d.u, p_min: +d.v }, +d.v ? "Joueur rendu muet." : "Le joueur peut de nouveau écrire.") && d.close) await admDo("adm_report_close", { p_user: d.u }); return;
      case "adm-ban": if (await admDo("adm_ban", { p_user: d.u, p_on: d.v === "1" }, d.v === "1" ? "Joueur banni du chat." : "Bannissement levé.") && d.close) await admDo("adm_report_close", { p_user: d.u }); return;
      case "adm-close": admDo("adm_report_close", { p_user: d.u }, "Signalements classés."); return;
      case "adm-flag": admDo("adm_flag", { p_user: d.u, p_on: d.v === "1" }, d.v === "1" ? "Joueur retiré des classements." : "Joueur vérifié : il reste dans les classements."); return;
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
      case "adm-pin": case "adm-pinoff": {
        const b = a === "adm-pinoff" ? "" : ($("#admPin").value || "").trim(); const chs = a === "adm-pinoff" ? (C.pin && C.pin.pin_chs) || "g" : ["g", "c", "v"].filter((k) => $("#admPin" + k).checked).join(",");
        if (a === "adm-pin" && !b) return X().toast("Le message est vide. Pour l'enlever, utilise « Retirer ».");
        if (a === "adm-pin" && !chs) return X().toast("Choisis au moins un salon.");
        A.pin = { body: b, chs };
        if (await admDo("adm_pin", { p_body: b, p_chs: chs }, b ? "Message épinglé enregistré." : "Message épinglé retiré.")) { A.pin = null; await loadPin(); }
        return;
      }
      case "adm-annend": if (await admDo("adm_announce_end", { p_id: +d.id }, "Bandeau retiré.")) banner(); return;
      case "adm-mod": { const p = d.p || ($("#admMod") ? $("#admMod").value.trim() : ""); if (!p) return; admDo("adm_set_mod", { p_pseudo: p, p_on: d.v === "1" }, d.v === "1" ? `${p} est modérateur.` : `${p} n'est plus modérateur.`); return; }
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target && ev.target.id === "chIn") {
      if (C.ac && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) { ev.preventDefault(); const n = C.ac.list.length; C.ac.sel = (C.ac.sel + (ev.key === "ArrowDown" ? 1 : n - 1)) % n; acPaint(); }
      else if (C.ac && (ev.key === "Tab" || ev.key === "Enter")) { ev.preventDefault(); acPick(C.ac.list[C.ac.sel]); }
      else if (C.ac && ev.key === "Escape") { C.ac = null; acPaint(); }
      else if (ev.key === "Enter") { ev.preventDefault(); send(); }
      else if (ev.key === "Escape") { ev.target.blur(); }
      ev.stopPropagation();
    } else if (ev.target && ev.target.id === "admQ" && ev.key === "Enter") { ev.preventDefault(); const b = document.querySelector('[data-act="adm-search"]'); if (b) b.click(); }
  }, true);
  /* 1.0.12.8 : ce qui est tapé dans le panel (annonce, message épinglé, recherche d'un pseudo) est gardé en changeant d'onglet */
  function admKeep(id) {
    if (/^admAnn/.test(id)) A.ann = { body: $("#admAnn").value, banner: $("#admAnnB").checked, chat: $("#admAnnC").checked, hours: +$("#admAnnH").value };
    else if (/^admPin/.test(id)) A.pin = { body: $("#admPin").value, chs: ["g", "c", "v"].filter((k) => $("#admPin" + k).checked).join(",") };
    else if (id === "admQ") A.q = $("#admQ").value.trim();
  }
  document.addEventListener("input", (ev) => { if (ev.target && /^adm(Ann|Pin|Q)/.test(ev.target.id || "")) admKeep(ev.target.id); if (ev.target && ev.target.id === "admPin") { const n = $("#admPinN"); if (n) n.textContent = `${ev.target.value.length}/200`; return; } if (ev.target && ev.target.id === "chIn") { acUpdate(ev.target); const c = $("#chCnt"); if (c && Date.now() >= nextAt()) c.textContent = `${ev.target.value.length}/200`; if (C.err) { C.err = ""; const b = document.querySelector("#chat .ch-hint .bad"); if (b) b.outerHTML = "<span></span>"; } } });

  window.CHAT = { start, refresh, renderAdmin, adminBtn, repaint: () => { const el = $("#chat"); if (el && C.open) paint(true); else if (el) paint(); }, canShare: () => canWrite(), openAdmin, repaintAdmin: () => repaintAdm(), get role() { return C.role; }, get state() { return C; },
    adm: { get A() { return A; }, body: () => admBody(), load: () => admLoad(), tabs: () => ATABS(), repaint: () => repaintAdm(), keepFocus, isAdmin } }; // 1.0.30 : pour le Panel Xener (js/panel.js)
})();
