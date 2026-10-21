/* ============================================================================
   Bureau des Aventuriers (Monocompte, bêta) — donjons de groupe en direct et recherche de groupe, d'après la maquette validée
   du 19/10 (réponses de Mathis : 1B 2A 3A 4A 5A 6A 7A 8C 9B 10A 11A).
   - Serveur : supabase/mono_bureau.sql (salons, recherche, invitations, expéditions, rendez-vous ; chaque action verrouille ce
     qu'elle change) et la fonction « mono » (route { bureau: { combat } }) qui joue le combat avec les photos des parties
     validées par le Bouclier (js/bureau_combat.js). Le jeu n'envoie jamais de photo de héros.
   - Ici : la page « Bureau des Aventuriers » (menu Aventure, partie Monocompte en ligne seulement), le signe de vie (l'état complet
     redemandé toutes les quelques secondes, aussi après une coupure), le bandeau d'invitation (60 s, titre de l'onglet qui
     clignote), la transition de 60 s (dernière sauvegarde validée puis confirmation), le combat regardé ensemble en direct (2A) à
     partir de l'heure du serveur, le butin récupéré une seule fois. Pendant le combat de groupe, les activités solo du héros
     s'arrêtent et le Sablier est coupé (3A) ; elles reprennent ensuite.
   - Séries (idée de joueur validée) : le chef choisit ×1, ×5, ×10 ou un nombre libre de 1 à 10 combats à la suite
     (mono_bureau_serie) ; le serveur lance seul le combat suivant (« Combat k / N ») ; ici, le cumul du butin de la série.
   - window.Bureau.inviter(userId) : bouton « Inviter » de la page des amis ; window.Bureau.d12() : règle du défi 12.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA, ON = window.ONLINE;
  if (!E || !E.BUREAU || !E.MONO || !window.DX) return;
  const BC = E.BUREAU;
  const DX = window.DX, X = () => DX.social || {};
  const S = () => DX.S;
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (t, k) => { try { X().toast(t, k); } catch (e) {} };
  /* version du jeu (même version pour tout le salon) : celle du ?v= des fichiers, changée à chaque version publiée */
  const VER = (() => { try { const m = /[?&]v=([\w.]+)/.exec((document.currentScript || {}).src || ""); return m ? m[1] : ""; } catch (e) { return ""; } })();
  const OFF = "Le Bureau des Aventuriers demande une partie Monocompte en ligne (bêta testeurs).";
  /* identifiant d'appareil (règle 5A) gardé par le jeu ; identifiant d'onglet (une seule place par compte, le second onglet regarde) */
  const appareil = (() => { let v = null; try { v = localStorage.getItem("idlus-appareil"); if (!v) { v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("idlus-appareil", v); } } catch (e) { v = null; } return v; })();
  const ONG = Math.random().toString(36).slice(2, 10);

  const mono = (s) => !!(s && s.mono && !s.mono.eternel);
  const live = () => !!(ON && ON.enabled && mono(S()) && ON.monoOn && ON.monoOn() && ON.slot && ON.slot() === 4);
  const me = () => (ON && ON.user && ON.user.id) || null;
  const B = { st: null, off: 0, at: 0, err: null, tab: "jouer", salons: null, salonsAt: 0, exps: null, rdv: null, V: {}, conf: {}, calc: {}, pris: {}, cumul: {}, gain: {}, pend: false, f: null };
  const now = () => Date.now() + B.off; // heure du serveur
  const left = (iso) => Math.max(0, Math.ceil((Date.parse(iso) - now()) / 1000));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const dname = (did) => (did ? BC.nom(did) : "Aucun donjon proposé");
  const rpc = async (name, args) => { if (!ON || !ON.rpc) return { err: OFF }; const r = await ON.rpc(name, args || {}); if (r.err) return { err: /function .* does not exist|Could not find the function/i.test(r.err) ? "Le Bureau des Aventuriers n'est pas encore ouvert sur le serveur." : r.err }; if (r.data && r.data.err) return { err: r.data.err, data: r.data }; return { data: r.data }; };

  /* ---------- pendant le combat de groupe : le héros est « en groupe » (activités solo arrêtées, Sablier coupé par js/mono.js) ---------- */
  const tick0 = E.tick;
  E.tick = function (s) {
    if (s && s.mono && s.mono.live && s === S()) { if (Date.now() < s.mono.live) return; delete s.mono.live; }
    return tick0.apply(this, arguments);
  };

  /* ---------- état du serveur ---------- */
  const setState = (d) => {
    if (!d || d.err) return;
    const prev = B.st; B.st = d; B.err = null; B.at = Date.now();
    if (d.now) B.off = Date.parse(d.now) - Date.now();
    if (prev && prev.salon && !d.salon) B.V = {};
    react(); banner(); paint();
  };
  let polling = false, lastPoll = 0;
  const poll = async () => {
    if (polling) return; if (!live()) { if (B.st) { B.st = null; banner(); } return; }
    polling = true; lastPoll = Date.now();
    try { const r = await rpc("mono_bureau_etat", { p_onglet: ONG, p_appareil: appareil }); if (r.data) setState(r.data); else { B.err = r.err; paint(); } }
    finally { polling = false; }
  };
  const involved = () => { const d = B.st; return !!(d && (d.salon || d.recherche || (d.invitations || []).length || (d.butins || []).length)); };
  setInterval(() => {
    if (!live()) { if (B.st) { B.st = null; banner(); } return; }
    const onPage = DX.ui && DX.ui.tab === "bureau";
    const every = involved() ? 4000 : onPage ? 8000 : 20000;
    if (Date.now() - lastPoll >= every) poll();
    view(); banner(true);
  }, 1000);

  /* après chaque état : transition, calcul, combat en direct, butin */
  const react = () => {
    const d = B.st, s = S(); if (!d || !s) return;
    const c = d.salon && d.salon.combat, u = me();
    const mine = c && (c.membres || []).some((m) => m.user === u);
    if (c && mine && c.etat === "transition" && !(c.membres.find((m) => m.user === u) || {}).ok && !B.conf[c.id]) confirm(c);
    if (c && mine && c.etat === "calcul" && !B.calc[c.id]) setTimeout(() => calcul(c.id), 1500);
    if (c && mine && c.etat === "calcul" && B.calc[c.id] && Date.now() - B.calc[c.id] > 65000) delete B.calc[c.id]; // calcul coupé : un autre membre le relance
    if (c && c.etat === "fini" && c.snaps && !B.V[c.id]) {
      B.V[c.id] = { wait: true };
      setTimeout(() => { try { B.V[c.id] = BC.voir(c.snaps, c.did, c.stasis, Number(c.seed), Number(c.at)); } catch (e) { B.V[c.id] = { err: true }; } view(); }, 30);
    }
    if (c && mine && c.etat === "fini" && c.fin) { const fin = Date.parse(c.fin) - B.off; if (fin > Date.now()) { if (s.mono.live !== fin) { s.mono.live = fin; mark(); } } }
    for (const b of d.butins || []) if (!B.pris[b.combat] && Date.parse(b.fin) <= now()) claim(b);
  };
  const mark = () => { try { X().markDirty(); } catch (e) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* transition de 60 s : la partie est sauvegardée et validée par le Bouclier, puis la confirmation part (la photo du héros sera
     prise par le serveur sur cette partie validée) */
  const confirm = async (c) => {
    B.conf[c.id] = 1;
    if (S() && S().dungeon) toast("Lancement du groupe : termine ton donjon solo, ou le lancement sera annulé au bout de 60 secondes.", "rare");
    for (let i = 0; i < 12 && live(); i++) {
      if (!S() || !S().dungeon) {
        if (i % 3 === 0) { try { await X().onPush(); } catch (e) {} }
        const r = await rpc("mono_bureau_confirmer", { p_onglet: ONG });
        if (r.data && r.data.ok) { setState(r.data); if (r.data.calcul) calcul(c.id); return; }
        if (!/pas encore validée/.test(r.err || "")) { if (r.err && !/Aucun lancement/.test(r.err)) toast(r.err); return; }
      }
      await sleep(4000);
      if (!B.st || !B.st.salon || !B.st.salon.combat || B.st.salon.combat.id !== c.id || B.st.salon.combat.etat !== "transition") return;
    }
  };
  /* le serveur joue le combat (un seul calcul : la base verrouille le combat, les autres appels attendent) */
  const calcul = async (id) => {
    if (B.calc[id]) return; B.calc[id] = Date.now();
    try { const db = ON.db && ON.db(); if (db) await db.functions.invoke("mono", { body: { bureau: { combat: id } } }); } catch (e) {}
    poll();
  };
  /* butin individuel (une seule fois) : la partie rejoue le combat enregistré et reçoit le butin, comme dans un donjon solo */
  const claim = async (b) => {
    B.pris[b.combat] = 1;
    const r = await rpc("mono_bureau_butin", { p_combat: b.combat });
    if (!r.data || !r.data.ok) { if (r.err && !/déjà récupéré/.test(r.err)) { toast(r.err); B.pris[b.combat] = 0; } return; }
    const s = S(); if (!s) return;
    const got = BC.butin(s, r.data);
    delete s.mono.live; mark();
    if (got) {
      B.gain[b.combat] = got; // écran du combat en direct (js/bureau_direct.js) : « Ton butin »
      const fmt = X().fmt || String, sr = r.data.serie_n > 1 ? ` · combat ${r.data.serie_k} / ${r.data.serie_n}` : "";
      if (sr) { const k = B.cumul[r.data.serie_id] || (B.cumul[r.data.serie_id] = { n: 0, xp: 0, kamas: 0, items: 0 }); k.n++; k.xp += got.xp || 0; k.kamas += got.kamas || 0; k.items += (got.items || []).length; }
      toast(`${r.data.win ? "Victoire" : "Défaite"} en groupe (${dname(r.data.did)}, stasis ${r.data.stasis}${sr}) : ${fmt(Math.round(got.xp))} XP, ${fmt(got.kamas)} kamas${got.items.length ? `, ${got.items.length} objet${got.items.length > 1 ? "s" : ""}` : ""}.`, "rare", 7000);
    }
    try { await X().onPush(); } catch (e) {}
    try { if (window.MARKET && window.MARKET.sync) window.MARKET.sync(); } catch (e) {} // clé du donjon retirée par une opération du serveur
    paint();
  };

  /* ---------- actions ---------- */
  const act = async (name, args, quiet) => {
    if (B.pend) return null; B.pend = true;
    try { const r = await rpc(name, Object.assign({}, args)); if (r.err) { toast(r.err); return null; } if (r.data && r.data.salon !== undefined && r.data.now) setState(r.data); else poll(); if (!quiet && r.data && r.data.avertissement) toast(r.data.avertissement); return r.data; }
    finally { B.pend = false; paint(); }
  };
  const base = () => ({ p_version: VER, p_appareil: appareil, p_onglet: ONG });

  /* ---------- bandeau d'invitation (60 s) et titre qui clignote ---------- */
  let title0 = null, blink = false;
  const banner = (tickOnly) => {
    let el = document.getElementById("bxInv");
    const inv = B.st && live() ? (B.st.invitations || []).filter((i) => Date.parse(i.expire) > now()) : [];
    if (!inv.length) { if (el) el.remove(); if (title0 != null) { document.title = title0; title0 = null; } return; }
    const i = inv[0];
    if (!el) { el = document.createElement("div"); el.id = "bxInv"; el.className = "bx-inv"; el.setAttribute("role", "alertdialog"); document.body.appendChild(el); tickOnly = false; }
    const sec = left(i.expire);
    if (tickOnly && el.dataset.id === String(i.id)) { const t = el.querySelector(".bx-inv-t"); if (t) t.textContent = `${sec} s`; }
    else {
      el.dataset.id = i.id;
      const qui = i.quoi === "ami" ? `${h(i.par || "Un joueur")} t'invite dans son salon` : i.quoi === "remplacant" ? "Une place se libère dans un salon" : i.quoi === "attente" ? "Une place se libère dans ton expédition" : "Le Bureau t'a trouvé un groupe";
      el.innerHTML = `<div class="bx-inv-m"><b>${qui}</b><span>${h(dname(i.did))}${i.stasis ? ` · stasis ${i.stasis}` : ""}${(i.membres || []).length ? ` · avec ${h(i.membres.join(", "))}` : ""}</span></div>
        <span class="bx-inv-t">${sec} s</span><button class="btn primary" data-act="bx-oui" data-v="${i.id}">Accepter</button><button class="btn" data-act="bx-non" data-v="${i.id}">Refuser</button>`;
    }
    if (document.hidden) { if (title0 == null) title0 = document.title; blink = !blink; document.title = blink ? "Invitation de groupe !" : title0; }
    else if (title0 != null) { document.title = title0; title0 = null; }
  };

  /* ---------- la page ---------- */
  const unlocked = (s) => Object.keys(D.DUNGEONS).filter((k) => { try { return E.dungeonUnlocked(s, k); } catch (e) { return false; } });
  const smax = (s, did) => { try { return E.stasisInfo(s, did).max || 0; } catch (e) { return 0; } };
  const form = () => {
    if (B.f) return B.f; const s = S(); const ul = unlocked(s);
    const pick = s && s.dungeon && s.dungeon.id && ul.includes(s.dungeon.id) ? s.dungeon.id : ul[ul.length - 1];
    return (B.f = { ds: pick ? [pick] : [], k: Math.max(1, Math.min(E.STASIS_MAX, smax(s, pick) + 1)), flex: 1, auto: true });
  };
  const dsel = (name, cur, s) => `<select name="${name}">${unlocked(s).map((k) => `<option value="${h(k)}"${k === cur ? " selected" : ""}>${h(BC.nom(k))} · stasis max ${smax(s, k)}</option>`).join("")}</select>`;

  function page(main) {
    const s = S();
    const head = `<div class="pagehead"><h1>Bureau des Aventuriers</h1></div>`;
    if (!mono(s)) { main.innerHTML = head + `<div class="panel"><div class="pad">Le Bureau des Aventuriers est ouvert aux parties Monocompte de la saison en cours.</div></div>`; return; }
    if (!live()) { main.innerHTML = head + `<div class="panel"><div class="pad stack"><b>Hors ligne</b><span class="small muted">${h(OFF)} Connecte-toi pour chercher un groupe : tes activités solo continuent normalement.</span></div></div>`; return; }
    if (!B.st) { main.innerHTML = head + `<div class="panel"><div class="pad">${B.err ? h(B.err) : "Connexion au Bureau…"}</div></div>`; if (!polling) poll(); return; }
    const d = B.st;
    let html = head;
    if (d.bloque) html += `<div class="panel bx-warn"><div class="pad">${h(d.bloque)}</div></div>`;
    if (d.spectateur) html += `<div class="panel bx-warn"><div class="pad">Ton salon est ouvert dans un autre onglet : celui-ci regarde seulement.</div></div>`;
    if ((d.butins || []).length) html += `<div class="panel"><div class="pad small">${d.butins.map((b) => `Butin du combat de groupe (${h(dname(b.did))}, stasis ${b.stasis}) : ${Date.parse(b.fin) > now() ? "à la fin du combat" : "récupération…"}`).join("<br>")}</div></div>`;
    html += d.salon ? salonHtml(d, s) : tabsHtml(d, s);
    main.innerHTML = html;
    view();
  }

  function tabsHtml(d, s) {
    const T = [["jouer", "Jouer maintenant"], ["exp", "Expéditions programmées"], ["rdv", "Rendez-vous"]];
    let out = `<div class="bx-tabs" role="tablist">${T.map(([k, n]) => `<button class="bx-tab" role="tab" aria-selected="${B.tab === k}" data-act="bx-tab" data-v="${k}">${n}</button>`).join("")}</div>`;
    if (B.tab === "exp") return out + expHtml(s);
    if (B.tab === "rdv") return out + rdvHtml();
    const f = form(), r = d.recherche, ul = unlocked(s);
    const manq = (d.manquees || [])[0];
    out += `<div class="bx-grid"><div class="panel"><div class="pad stack">`;
    if (manq) out += `<span class="small muted">Invitation manquée ${new Date(manq.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} : tu n'es plus en recherche.</span>`;
    if (r) {
      const depuis = Math.max(0, Math.floor((now() - Date.parse(r.depuis)) / 1000));
      out += `<h2 class="bx-h">Recherche en cours</h2>
        <span>${(r.donjons || []).map((k) => h(BC.nom(k))).join(", ")} · stasis ${r.stasis}${r.flex ? ` ±${r.flex}` : " exacte"}${r.auto ? "" : " · sans rencontre automatique"}</span>
        <span class="small muted">Depuis ${mmss(depuis)}. ${r.compatibles ? `${r.compatibles} joueur${r.compatibles > 1 ? "s" : ""} compatible${r.compatibles > 1 ? "s" : ""} en recherche.` : "Personne de compatible pour l'instant."}${r.avec_flex > r.compatibles && r.flex < 2 ? ` Avec une stasis plus souple : ${r.avec_flex}.` : ""} Ton héros continue sa chasse en attendant.</span>
        <div class="row" style="gap:8px;flex-wrap:wrap">${r.avec_flex > r.compatibles && r.flex < 2 ? `<button class="btn" data-act="bx-flex">Élargir à ±${r.flex + 1}</button>` : ""}<button class="btn" data-act="bx-stop">Annuler la recherche</button></div>`;
    } else if (!ul.length) out += `<span>Aucun donjon débloqué pour l'instant.</span>`;
    else {
      out += `<h2 class="bx-h">Jouer maintenant</h2><span class="small muted">Plusieurs donjons à la fois, la stasis voulue avec sa souplesse : le Bureau forme le groupe (2 à 4 joueurs) dès que c'est possible. Ton héros continue sa chasse en attendant.</span>
        <div class="bx-ds">${ul.map((k) => `<label class="bx-chip"><input type="checkbox" data-act="bx-d" value="${h(k)}"${f.ds.includes(k) ? " checked" : ""}> ${h(BC.nom(k))}</label>`).join("")}</div>
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
          <label>Stasis <input type="number" id="bxK" min="1" max="${E.STASIS_MAX}" value="${f.k}" style="width:64px"></label>
          <label>Souplesse <select id="bxF">${[[0, "exacte"], [1, "±1"], [2, "±2"]].map(([v, n]) => `<option value="${v}"${f.flex === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>
          <label><input type="checkbox" id="bxA"${f.auto ? " checked" : ""}> Rencontre automatique</label></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="bx-go"${d.bloque ? " disabled" : ""}>Chercher un groupe</button><button class="btn" data-act="bx-new"${d.bloque ? " disabled" : ""}>Créer mon salon</button></div>`;
    }
    const c = d.compteurs || {};
    out += `<span class="small muted">${c.total || 0} joueur${(c.total || 0) > 1 ? "s" : ""} en recherche en ce moment.</span></div></div>`;
    const L = B.salons;
    out += `<div class="panel"><div class="pad stack"><div class="row between"><h2 class="bx-h">Salons ouverts</h2><button class="btn small" data-act="bx-list">Actualiser</button></div>
      ${!L ? `<span class="small muted">Chargement…</span>` : !L.length ? `<span class="small muted">Aucun salon public ouvert.</span>` : L.map((x) => `<div class="bx-row"><div><b>${h(dname(x.did))}</b>${x.stasis ? ` · stasis ${x.stasis}` : ""}<br><span class="small muted">${h((x.pseudos || []).join(", "))} · ${x.n}/4${x.etat !== "ouvert" ? " · combat en cours" : ""}${x.version && x.version !== VER ? ` · version ${h(x.version)}` : ""}</span></div><button class="btn small" data-act="bx-join" data-v="${x.id}">Rejoindre</button></div>`).join("")}
    </div></div></div>`;
    if (!L || Date.now() - B.salonsAt > 15000) { B.salonsAt = Date.now(); rpc("mono_bureau_salons").then((r) => { if (Array.isArray(r.data)) { B.salons = r.data; paint(); } }); }
    return out;
  }

  function salonHtml(d, s) {
    const x = d.salon, u = me(), chef = x.chef === u, sp = d.spectateur ? " disabled" : "";
    const moi = (x.membres || []).find((m) => m.moi) || {};
    const c = x.combat, busy = x.etat !== "ouvert";
    let out = `<div class="panel bx-salon"><div class="pad stack">
      <div class="row between" style="flex-wrap:wrap;gap:8px"><div><span class="bx-kick">${x.expedition ? "Expédition programmée" : "Salon"} · ${x.public ? "public" : "privé"}${x.heure ? ` · départ à ${new Date(x.heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
        <h2 class="bx-h">${h(dname(x.did))}${x.stasis ? ` · stasis ${x.stasis}` : ""}</h2></div>
        <button class="btn" data-act="bx-quit"${sp}>Quitter le salon</button></div>`;
    if (x.etat === "invitation") out += `<span class="small muted">Le salon se forme : chacun a 60 secondes pour accepter.</span>`;
    else if (x.etat === "ouvert" && !x.expedition && left(x.attente_fin) > 0 && (x.membres || []).length < 4) out += `<span class="small muted">Attente conseillée : encore ${mmss(left(x.attente_fin))} pour d'autres joueurs ; départ anticipé possible.</span>`;
    out += `<div class="bx-mem">${(x.membres || []).map((m) => `<div class="bx-m${m.present ? "" : " off"}${m.moi ? " me" : ""}"><b>${h(m.pseudo)}${m.chef ? ` <span class="pill">chef${x.provisoire ? " provisoire" : ""}</span>` : ""}</b>
        <span class="small">${!m.venu ? "pas encore arrivé" : m.present ? (m.pret ? "Prêt" : "pas prêt") : `déconnecté${m.place_fin ? ` · place gardée ${mmss(left(m.place_fin))}` : ""}`}</span>
        ${chef && !m.moi && m.present && !busy ? `<button class="btn small" data-act="bx-chef" data-v="${h(m.user)}"${sp}>Nommer chef</button>` : ""}</div>`).join("")}
      ${(x.invites || []).map((i) => `<div class="bx-m wait"><b>${h(i.pseudo)}</b><span class="small">invité · ${left(i.expire)} s</span></div>`).join("")}
      ${Array.from({ length: Math.max(0, 4 - (x.membres || []).length - (x.invites || []).length) }, () => `<div class="bx-m free"><span class="small muted">${x.remplacants ? "place libre · remplaçant cherché" : "place libre"}</span></div>`).join("")}</div>`;
    if (!busy) {
      out += `<div class="row" style="gap:8px;flex-wrap:wrap">${x.did ? `<button class="btn${moi.pret ? "" : " primary"}" data-act="bx-pret" data-v="${moi.pret ? 0 : 1}"${sp}>${moi.pret ? "Plus prêt" : "Prêt"}</button>` : ""}
        ${chef ? `<button class="btn primary" data-act="bx-lancer"${sp}>Lancer le combat</button>` : ""}</div>`;
      if (s.dungeon) out += `<span class="small muted">Ton donjon solo n'est pas fini : tu pourras te mettre « Prêt » ensuite.</span>`;
      if (x.serie != null && x.did) out += serieHtml(x, chef, sp);
      if (chef && !x.expedition) out += `<div class="bx-chefbox"><span class="small muted">Le chef propose le donjon et la stasis ; tout le monde reconfirme « Prêt ».</span>
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${dsel("bxPd", x.did, s)}<label>Stasis <input type="number" id="bxPk" min="1" max="${E.STASIS_MAX}" value="${x.stasis || 1}" style="width:64px"></label><button class="btn" data-act="bx-prop"${sp}>Proposer</button></div>
        <div class="row" style="gap:12px;flex-wrap:wrap"><label><input type="checkbox" data-act="bx-pub"${x.public ? " checked" : ""}${sp}> Salon public</label><label><input type="checkbox" data-act="bx-rempl"${x.remplacants ? " checked" : ""}${sp}> Remplaçants automatiques</label></div></div>`;
    }
    if (busy && x.serie_id && c && c.serie_n > 1) {
      const dedans = (c.membres || []).some((m) => m.user === u);
      out += `<div class="row bx-serie-on" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="small"><b>Série en cours</b> : ${c.serie_n} combats à la suite${x.serie_stop ? ` · arrêt après ce combat (${h(x.serie_stop)})` : ""}</span>
        ${dedans && !x.serie_stop ? `<button class="btn small" data-act="bx-sstop"${sp}>Arrêter après ce combat</button>` : ""}</div>`;
    }
    if (c) out += `<div id="bxView" class="bx-view"></div>`;
    out += `</div></div>`;
    out += `<div class="bx-grid"><div class="panel"><div class="pad stack"><h2 class="bx-h">Discussion</h2>
      <div class="bx-chat" id="bxChat">${(x.msgs || []).map((m) => `<div${m.moi ? ' class="me"' : ""}><b>${h(m.p)}</b> ${h(m.b)}</div>`).join("") || `<span class="small muted">Aucun message.</span>`}</div>
      <div class="row" style="gap:6px"><input id="bxSay" maxlength="200" placeholder="Écrire au groupe…" style="flex:1;min-width:0"${sp}><button class="btn" data-act="bx-say"${sp}>Envoyer</button></div></div></div>
      <div class="panel"><div class="pad stack"><h2 class="bx-h">Journal du salon</h2><div class="bx-log">${(x.journal || []).slice().reverse().map((j) => `<div><span class="small muted">${new Date(j.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span> ${h(j.t)}</div>`).join("")}</div></div></div></div>`;
    return out;
  }

  /* Série : ×1, ×5, ×10 ou un nombre libre (1 à 10, plafond du serveur) ; le chef choisit, les autres voient le choix */
  const SERIE_MAX = 10;
  function serieHtml(x, chef, sp) {
    const n = Math.max(1, Math.min(SERIE_MAX, x.serie || 1));
    const btn = (v, t, on, dis, lab) => `<button class="sbtn${on ? " on" : ""}" data-act="bx-serie" data-v="${v}"${dis || sp}${lab ? ` aria-label="${lab}"` : ""}>${t}</button>`;
    return `<div class="bx-serie"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b>Enchaîner</b>${chef
      ? `<div class="chainrow">${[1, 5, 10].map((v) => btn(v, `×${v}`, n === v)).join("")}<span class="chainstep">${btn(n - 1, "−", false, n <= 1 ? " disabled" : "", "Un combat de moins")}<b class="num" id="bxSerieN">${n}</b>${btn(n + 1, "+", false, n >= SERIE_MAX ? " disabled" : "", "Un combat de plus")}</span></div>`
      : `<span class="pill" id="bxSerieN">×${n}</span>`}</div>
      <span class="small muted">${n > 1 ? `${n} combats à la suite, une clé chacun : le suivant se lance tout seul. Une défaite, un départ ou une déconnexion arrête la série après le combat en cours ; les combats finis restent acquis.` : "Un seul combat."}${chef ? "" : " Choisi par le chef."}</span></div>`;
  }
  const cumulTxt = (c) => { const k = c && c.serie_id && B.cumul[c.serie_id]; if (!k || !k.n) return ""; const fmt = X().fmt || String;
    return `<span class="small">Butin de la série (${k.n} combat${k.n > 1 ? "s" : ""}) : ${fmt(Math.round(k.xp))} XP, ${fmt(Math.round(k.kamas))} kamas${k.items ? `, ${k.items} objet${k.items > 1 ? "s" : ""}` : ""}</span>`; };

  /* l'écran du combat (mis à jour chaque seconde, sans redessiner la page) */
  function view() {
    const el = document.getElementById("bxView"); const d = B.st; if (!el || !d || !d.salon || !d.salon.combat) return;
    const c = d.salon.combat, u = me();
    const ser = c.serie_n > 1, kn = ser ? `Combat ${c.serie_k} / ${c.serie_n} · ` : "";
    let html = ser ? `<span class="bx-kick" id="bxSerieK">Combat ${c.serie_k} / ${c.serie_n}</span>` : "";
    if (c.etat === "transition") {
      html += `<b>Lancement : ${left(c.transition_fin)} s</b><span class="small muted">Chacun termine son action solo et sauvegarde ; la photo du héros est prise par le serveur sur sa partie validée.</span>
        <div class="bx-ok">${(c.membres || []).map((m) => `<span class="pill${m.ok ? " ok" : ""}">${h(m.pseudo)} ${m.ok ? "✓" : "…"}</span>`).join("")}</div>
        ${(c.membres || []).some((m) => m.user === u) ? "" : `<span class="small muted">Tu attends le combat suivant.</span>`}`;
    } else if (c.etat === "calcul") html += `<b>Le serveur prépare le combat…</b>`;
    else if (c.etat === "fini") {
      const t = now() - Date.parse(c.debut), V = B.V[c.id], fini = t >= (c.duree || 0);
      const suite = ser && d.salon.serie_id === c.serie_id && c.serie_k < c.serie_n && c.win && !d.salon.serie_stop;
      const fin = !ser ? "Le chef peut proposer de rejouer, changer de stasis ou de donjon."
        : suite ? "Le combat suivant se lance tout seul." : `Série ${c.serie_k >= c.serie_n && c.win ? "terminée" : "arrêtée"} : ${(c.serie_bilan || []).filter((b) => b.win).length} victoire${(c.serie_bilan || []).filter((b) => b.win).length > 1 ? "s" : ""} sur ${c.serie_k} combat${c.serie_k > 1 ? "s" : ""} (${c.serie_n} prévus).`;
      /* 21/10 : le combat se regarde sur l'écran de combat (js/bureau_direct.js) ; ici, le résumé et les boutons */
      const bd = window.BureauDirect ? (!fini ? `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="btn primary" data-act="bxd-voir">Regarder le combat</button><span class="small muted">sur l'écran de combat, en même temps que ton groupe</span></div>` : c.snaps ? `<div class="row" style="gap:8px"><button class="btn" data-act="bxd-revoir">Revoir le combat</button></div>` : "") : "";
      if (fini || !V || V.err) html += `<b>${c.win ? "Victoire" : "Défaite"} : ${h(dname(c.did))}, stasis ${c.stasis}</b><span class="small muted">${fini ? `Le butin de chacun arrive dans sa partie. ${fin}` : "Combat en cours…"}</span>${bd}`;
      else if (V.wait) html += `<b>${kn}Combat en cours…</b>${bd}`;
      else {
        const F = BC.image(V, t) || { ents: [] }; const bar = (e) => `<div class="bx-e${e.hp <= 0 ? " ko" : ""}">${e.s === "m" && e.k && D.MONSTERS[e.k] ? `<img src="assets/m/${h(D.MONSTERS[e.k].img)}.png" alt="" loading="lazy">` : ""}<span>${h(e.n)}</span><i><u style="width:${Math.round((100 * e.hp) / e.mx)}%"></u></i></div>`;
        html += `<div class="row between"><b>${F.boss ? "Salle du boss" : `Salle ${(F.salle || 0) + 1}`}</b><span class="small muted">${mmss(Math.floor(t / 1000))} / ${mmss(Math.ceil((c.duree || 0) / 1000))}</span></div>
          <div class="bx-fight"><div>${F.ents.filter((e) => e.s !== "m").map(bar).join("")}</div><div>${F.ents.filter((e) => e.s === "m").map(bar).join("")}</div></div>${bd}`;
      }
    }
    if (ser) html += cumulTxt(c);
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  function expHtml(s) {
    const L = B.exps;
    if (!L) { rpc("mono_bureau_expeditions").then((r) => { B.exps = Array.isArray(r.data) ? r.data : []; paint(); }); }
    const when = (iso) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const ul = unlocked(s), t0 = new Date(Date.now() + 3600e3); t0.setMinutes(t0.getMinutes() < 30 ? 30 : 60, 0, 0);
    const loc = new Date(t0.getTime() - t0.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return `<div class="bx-grid"><div class="panel"><div class="pad stack"><h2 class="bx-h">Expéditions annoncées</h2>
      ${!L ? `<span class="small muted">Chargement…</span>` : !L.length ? `<span class="small muted">Aucune expédition annoncée.</span>` : L.map((e) => `<div class="bx-row"><div><b>${h(dname(e.did))}</b> · stasis ${e.stasis} · ${e.places} joueurs<br>
        <span class="small">${h(when(e.heure))} · par ${h(e.org)}</span><br><span class="small muted">${e.etat === "annoncee" ? `${(e.inscrits || []).length}/${e.places} inscrits${(e.attente || []).length ? ` · ${e.attente.length} en attente` : ""}` : e.etat === "ouverte" ? "salon ouvert" : e.etat === "partie" ? "partie" : h(e.motif || e.etat)}${e.note ? ` · « ${h(e.note)} »` : ""}</span></div>
        ${e.etat !== "annoncee" ? "" : e.moi_org ? `<button class="btn small" data-act="bx-xann" data-v="${e.id}">Annuler</button>` : e.moi ? `<button class="btn small" data-act="bx-xout" data-v="${e.id}">${e.moi === "attente" ? "Quitter l'attente" : "Se désinscrire"}</button>` : `<button class="btn small primary" data-act="bx-xin" data-v="${e.id}">S'inscrire</button>`}</div>`).join("")}
      </div></div>
      <div class="panel"><div class="pad stack"><h2 class="bx-h">Annoncer une expédition</h2><span class="small muted">Jusqu'à 7 jours à l'avance, 2 annonces actives. Le salon ouvre 10 minutes avant ; départ à l'heure à 2, 3 ou 4 joueurs.</span>
        ${ul.length ? `${dsel("bxXd", ul[ul.length - 1], s)}
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><label>Stasis <input type="number" id="bxXk" min="1" max="${E.STASIS_MAX}" value="1" style="width:64px"></label>
          <label>Joueurs <select id="bxXp"><option>2</option><option>3</option><option selected>4</option></select></label></div>
        <label>Heure (heure de ton appareil) <input type="datetime-local" id="bxXh" value="${loc}"></label>
        <input id="bxXn" maxlength="120" placeholder="Note (facultative)">
        <button class="btn primary" data-act="bx-xnew">Annoncer</button>` : `<span>Aucun donjon débloqué pour l'instant.</span>`}</div></div></div>`;
  }

  function rdvHtml() {
    const R = B.rdv;
    if (!R) { rpc("mono_bureau_rdv").then((r) => { B.rdv = r.data || { actif: false, creneaux: [] }; paint(); }); return `<div class="panel"><div class="pad small muted">Chargement…</div></div>`; }
    if (!R.actif || !(R.creneaux || []).length) return `<div class="panel"><div class="pad stack"><b>Pas de rendez-vous communautaire pour l'instant.</b><span class="small muted">Les créneaux communs seront annoncés ici, sans engagement ni récompense réservée.</span></div></div>`;
    return `<div class="panel"><div class="pad stack"><h2 class="bx-h">Rendez-vous communautaires</h2><span class="small muted">Des heures communes pour trouver du monde, facultatives, sans récompense réservée. Heures affichées dans l'heure de ton appareil.</span>
      ${R.creneaux.map((c) => `<div class="bx-row${c.en_cours ? " now" : ""}"><div><b>${h(c.nom || "Rendez-vous")}</b> · ${new Date(c.at).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}<br>
        <span class="small muted">${c.en_cours ? `En cours · ${c.en_recherche || 0} en recherche` : `${c.venir} pense${c.venir > 1 ? "nt" : ""} venir`}</span></div>
        <button class="btn small${c.moi ? "" : " primary"}" data-act="bx-rdv" data-v="${c.id}" data-on="${c.moi ? 0 : 1}">${c.moi ? "Je ne viens plus" : "Je pense venir"}</button></div>`).join("")}</div></div>`;
  }

  /* redessine la page si elle est affichée (sans perdre le message en cours d'écriture) */
  function paint() {
    if (!DX.ui || DX.ui.tab !== "bureau") return; const m = document.getElementById("main"); if (!m) return;
    const a = document.activeElement; if (a && m.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.id !== "bxSay") return;
    const say = document.getElementById("bxSay"), txt = say ? say.value : "", foc = a === say;
    const ch = document.getElementById("bxChat"), bot = ch ? ch.scrollHeight - ch.scrollTop - ch.clientHeight < 30 : true;
    page(m);
    const s2 = document.getElementById("bxSay"); if (s2) { s2.value = txt; if (foc) s2.focus(); }
    const c2 = document.getElementById("bxChat"); if (c2 && bot) c2.scrollTop = c2.scrollHeight;
  }
  DX.pages.bureau = (main) => { page(main); const c2 = document.getElementById("bxChat"); if (c2) c2.scrollTop = c2.scrollHeight; if (live() && Date.now() - lastPoll > 3000) poll(); };

  /* ---------- l'entrée du menu (Aventure), seulement dans une partie Monocompte de la saison en cours ---------- */
  let navOn = null;
  function navSync() {
    const on = mono(S()); if (on === navOn || !DX.NAV) return;
    const F = DX.NAV.find((x) => x.id === "av"); if (!F) return;
    navOn = on; F.pages = F.pages.filter((p) => p[0] !== "bureau");
    if (on) { const i = F.pages.findIndex((p) => p[0] === "dungeons"); F.pages.splice(i < 0 ? F.pages.length : i + 1, 0, ["bureau", "Bureau des Aventuriers", "parchemin_or"]); }
    if (DX.S && DX.ui && DX.ui.tab !== "combat" && DX.nav) { try { DX.nav(); } catch (e) {} }
  }
  setInterval(navSync, 2000); setTimeout(navSync, 300);

  /* ---------- clics ---------- */
  const $ = (id) => document.getElementById(id);
  document.addEventListener("change", (ev) => {
    const t = ev.target; if (!t || !t.dataset || !/^bx-/.test(t.dataset.act || "")) return; const a = t.dataset.act;
    if (a === "bx-d") { const f = form(); f.ds = f.ds.filter((k) => k !== t.value); if (t.checked) { if (f.ds.length >= 12) { t.checked = false; toast("12 donjons au plus."); return; } f.ds.push(t.value); } return; }
    if (a === "bx-pub" || a === "bx-rempl") { const x = B.st && B.st.salon; if (!x) return; act("mono_bureau_reglage_salon", { p_public: a === "bx-pub" ? t.checked : x.public, p_remplacants: a === "bx-rempl" ? t.checked : x.remplacants, p_onglet: ONG }); }
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target && ev.target.id === "bxSay") { ev.preventDefault(); say(); } });
  const say = async () => { const i = $("bxSay"); if (!i || !i.value.trim()) return; const v = i.value; i.value = ""; const r = await rpc("mono_bureau_dire", { p_txt: v, p_onglet: ONG }); if (r.err) { toast(r.err); i.value = v; } else poll(); };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^bx-/.test(a) || t.tagName === "INPUT") return;
    const v = t.dataset.v, s = S();
    if (a === "bx-tab") { B.tab = v; if (v === "exp") B.exps = null; if (v === "rdv") B.rdv = null; paint(); return; }
    if (a === "bx-oui" || a === "bx-non") { act("mono_bureau_repondre", Object.assign({ p_invit: +v, p_oui: a === "bx-oui" }, base())).then((r) => { if (r && a === "bx-oui" && DX.go) DX.go("bureau"); }); return; }
    if (a === "bx-go" || a === "bx-new") {
      const f = form(); f.k = Math.max(1, Math.min(E.STASIS_MAX, +(($("bxK") || {}).value) || 1)); f.flex = +(($("bxF") || {}).value) || 0; f.auto = !!($("bxA") || {}).checked;
      if (!f.ds.length) { toast("Choisis au moins un donjon."); return; }
      if (a === "bx-go") act("mono_bureau_chercher", Object.assign({ p_donjons: f.ds, p_stasis: f.k, p_flex: f.flex, p_auto: f.auto }, base()));
      else act("mono_bureau_creer", Object.assign({ p_did: f.ds[0], p_stasis: f.k, p_public: true }, base()));
      return;
    }
    if (a === "bx-flex") { const r = B.st && B.st.recherche; if (r) act("mono_bureau_chercher", Object.assign({ p_donjons: r.donjons, p_stasis: r.stasis, p_flex: Math.min(2, r.flex + 1), p_auto: r.auto }, base())); return; }
    if (a === "bx-stop") { act("mono_bureau_annuler_recherche", {}); return; }
    if (a === "bx-list") { B.salonsAt = 0; B.salons = null; paint(); return; }
    if (a === "bx-join") { act("mono_bureau_rejoindre", Object.assign({ p_salon: +v }, base())); return; }
    if (a === "bx-quit") { act("mono_bureau_quitter", { p_onglet: ONG }); return; }
    if (a === "bx-pret") { act("mono_bureau_pret", { p_on: v === "1", p_version: VER, p_solo: !!(s && s.dungeon), p_onglet: ONG }); return; }
    if (a === "bx-prop") { const did = (document.querySelector("select[name=bxPd]") || {}).value, k = +(($("bxPk") || {}).value) || 1; act("mono_bureau_proposer", { p_did: did, p_stasis: k, p_cle: BC.cle(did), p_version: VER, p_onglet: ONG }); return; }
    if (a === "bx-lancer") { act("mono_bureau_lancer", { p_onglet: ONG }); return; }
    if (a === "bx-serie") { const n = Math.max(1, Math.min(SERIE_MAX, +v || 1)); act("mono_bureau_serie", { p_n: n, p_onglet: ONG }); return; }
    if (a === "bx-sstop") { act("mono_bureau_serie_arreter", { p_onglet: ONG }); return; }
    if (a === "bx-chef") { act("mono_bureau_chef", { p_user: v, p_onglet: ONG }); return; }
    if (a === "bx-say") { say(); return; }
    if (a === "bx-xin" || a === "bx-xout") { act("mono_bureau_exp_inscrire", { p_id: +v, p_on: a === "bx-xin" }).then(() => { B.exps = null; paint(); }); return; }
    if (a === "bx-xann") { act("mono_bureau_exp_annuler", { p_id: +v }).then(() => { B.exps = null; paint(); }); return; }
    if (a === "bx-xnew") {
      const hh = Date.parse(($("bxXh") || {}).value || ""); if (!(hh > 0)) { toast("Choisis une date et une heure."); return; }
      act("mono_bureau_exp_creer", { p_did: (document.querySelector("select[name=bxXd]") || {}).value, p_stasis: +(($("bxXk") || {}).value) || 1, p_heure: new Date(hh).toISOString(), p_places: +(($("bxXp") || {}).value) || 4, p_note: (($("bxXn") || {}).value || "").trim() || null })
        .then((r) => { if (r) { toast("Expédition annoncée."); B.exps = null; paint(); } });
      return;
    }
    if (a === "bx-rdv") { act("mono_bureau_rdv_venir", { p_creneau: +v, p_on: t.dataset.on === "1" }).then((r) => { if (r) { B.rdv = r; paint(); } }); return; }
  });

  /* ---------- pour les autres fichiers ---------- */
  window.Bureau = {
    /* bouton « Inviter » de la page des amis : crée le salon s'il le faut (privé) et invite le joueur (60 s) */
    inviter: async (userId) => {
      if (!live()) { toast(OFF); return { err: OFF }; }
      const r = await act("mono_bureau_inviter", Object.assign({ p_user: userId }, base()));
      if (r) { toast("Invitation envoyée : 60 secondes pour accepter."); if (DX.go) DX.go("bureau"); }
      return r || { err: true };
    },
    /* défi 12 « Rendez-vous du temps » : la règle, comptée par le serveur (mono.bureau_d12) */
    d12: () => Object.assign({ texte: "Finir (victoire) un donjon de groupe en direct du Bureau des Aventuriers pendant la manche IV ; chaque joueur différent compte une fois." }, BC.D12),
    etat: () => B.st,
    heure: () => now(), // heure du serveur
    gain: (id) => B.gain[id] || null, // butin reçu de ce combat de groupe (après sa fin)
    actualiser: () => poll(),
    ouvert: live,
  };
})();
