/* ============================================================================
   Amis (Classique et Monocompte) et Couronne du Temps : décisions de Mathis du 21/10/2026 (maquette validée).
   - La liste est tenue par le serveur (supabase/amis.sql) : demande à accepter, 100 amis au plus, mode invisible,
     un joueur bloqué (liste « ignorer » du chat) ne peut ni envoyer de demande ni écrire. Le navigateur n'écrit
     jamais une table : il appelle les fonctions amis_* (security definer, droits vérifiés côté serveur).
   - Ajouter : par pseudo (page Amis), ou depuis un pseudo du chat, des classements ou de la guilde.
   - Présence : en ligne, mode (Classique ou Monocompte), niveau et « cherche un groupe » ; un battement par minute.
   - Inviter dans un groupe (Monocompte) ; rendez-vous du Bureau prévu (bouton inactif) ; message privé = MP du chat.
   - Renfort (Monocompte) : la copie validée du héros d'un ami remplace le mercenaire dans un donjon solo
     (supabase/mono_social.sql : mono_renfort_publier, mono_renforts, mono_renfort_utiliser ; aucun gain pour l'ami).
   - Couronne du Temps : petite couronne à côté du pseudo du porteur, partout (couronne_temps).
   Hors connexion : la page explique qu'il faut le serveur, rien n'est appelé.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE; if (!E || !window.DX) return;
  const ON = window.ONLINE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const A = { list: null, at: 0, crown: null, renf: null, cour: null, busy: false, err: "", lastPres: 0, lastSnap: 0 };
  const live = () => !!(ON && ON.enabled && ON.user && ON.rpc);
  const monoLive = () => { const s = S(); return !!(live() && ON.monoOn && ON.monoOn() && s && s.mono && !s.mono.eternel && ON.slot && ON.slot() === 4); };
  const rpc = async (n, a) => { if (!live()) return { err: "Pas de connexion au serveur." }; try { const r = await ON.rpc(n, a || {}); if (r.err) return r; if (r.data && r.data.err) return { err: r.data.err }; return r; } catch (e) { return { err: "Pas de connexion au serveur." }; } };
  const MODE = { mo: ["Monocompte", "am-mo"], cl: ["Classique", "am-cl"] };
  const CROWN = `<svg class="am-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9-4.6 3.8L12 5l-2.8 7.8L4.6 9z" fill="#e8c45a" stroke="#7a5a0c" stroke-width="1.2"/><circle cx="12" cy="5" r="1.4" fill="#7fe6ff"/></svg>`;
  const ago = (t) => { if (!t) return "Hors ligne"; const m = Math.max(0, (Date.now() - Date.parse(t)) / 60000); return m < 60 ? `Vu il y a ${Math.max(1, Math.round(m))} min` : m < 1440 ? `Vu il y a ${Math.round(m / 60)} h` : m < 2880 ? "Vu hier" : `Vu il y a ${Math.round(m / 1440)} jours`; };
  const isFriend = (u) => !!(A.list && A.list.amis.some((f) => f.u === u));
  const isSent = (u) => !!(A.list && A.list.envoyees.some((f) => f.u === u));
  const me = () => (ON && ON.user ? ON.user.id : null);

  /* ---------- lecture du serveur ---------- */
  async function refresh(full) {
    if (!live() || A.busy) return; A.busy = true;
    try {
      const [L, C] = await Promise.all([rpc("amis_liste"), rpc("couronne_temps")]);
      if (!L.err && L.data) { A.list = Object.assign({ amis: [], recues: [], envoyees: [], bloques: [], invits: [], moi: {}, max: 100 }, L.data); A.err = ""; } else if (L.err) A.err = L.err;
      if (!C.err) A.crown = C.data && C.data.u ? C.data : null;
      if (monoLive() || full) {
        const [R, K] = await Promise.all([rpc("mono_renforts"), rpc("mono_couronne")]);
        if (!R.err && R.data) A.renf = R.data;
        if (!K.err && K.data && K.data.saison != null) { A.cour = K.data; if (E.MONO && E.MONO.mut) E.MONO.mut.srv = { semaine: K.data.semaine, at: Date.now() }; }
      }
      A.at = Date.now();
    } finally { A.busy = false; }
    if (UI() && UI().tab === "amis") page(document.getElementById("main"));
  }
  /* présence (une fois par minute) et photo du héros pour le renfort (toutes les 10 minutes, Monocompte en ligne) */
  async function beat() {
    if (!live() || document.hidden) return; const s = S(); if (!s || !s.chars || !s.chars.length) return;
    const c = s.chars.find((x) => !x.merc) || s.chars[0];
    if (Date.now() - A.lastPres > 55000) { A.lastPres = Date.now(); await rpc("amis_presence", { p_mode: monoLive() ? "mo" : "cl", p_lvl: c.lvl || 1, p_cls: c.cls, p_cherche: null }); }
    if (monoLive() && E.monoSnap && !(E.monoFer && E.monoFer(s)) && Date.now() - A.lastSnap > 600000) {
      A.lastSnap = Date.now();
      try { const snap = Object.assign(E.monoSnap(s, c), { n: c.name, sex: c.sex, head: c.head || 0 }); delete snap.id; await rpc("mono_renfort_publier", { p_snap: snap }); } catch (e) {}
    }
    if (Date.now() - A.at > 60000) refresh();
  }
  setInterval(beat, 20000);
  setTimeout(() => { beat(); refresh(); }, 4000);
  // E.monoRenfortUsed : appelé par le moteur quand un renfort entre en donjon (compteur cosmétique de l'ami)
  E.monoRenfortUsed = (u) => { rpc("mono_renfort_utiliser", { p_ami: u }); };
  if (E.MONO && E.MONO.renfort) E.MONO.renfort.get = (u) => { const r = A.renf && (A.renf.amis || []).find((x) => x.u === u); return r ? { u: r.u, p: r.p, snap: r.snap } : null; };

  /* ---------- boutons posés ailleurs (chat, classements, guilde) ---------- */
  const crown = (u) => (u && A.crown && A.crown.u === u ? `<span class="am-cw" data-tip="Couronne du Temps : meilleur temps en donjon de groupe la semaine passée">${CROWN}</span>` : "");
  const btnTxt = (u) => (isFriend(u) ? "Déjà ami" : isSent(u) ? "Demande envoyée" : "Ajouter en ami");
  const menuBtn = (u, p, src) => (live() && u && u !== me() ? `<button data-act="am-ask" data-u="${h(u)}" data-p="${h(p)}" data-src="${h(src)}" ${isFriend(u) || isSent(u) ? "disabled" : ""}>${X().G("star")} ${btnTxt(u)}</button>` : "");
  const addBtn = (u, p, src, sz) => (live() && u && u !== me() ? `<button class="btn ${sz || ""}" data-act="am-ask" data-u="${h(u)}" data-p="${h(p)}" data-src="${h(src)}" ${isFriend(u) || isSent(u) ? "disabled" : ""}>${btnTxt(u)}</button>` : "");

  /* ---------- page Amis (Communauté) ---------- */
  function page(main) {
    if (!main) return;
    const head = (sub) => `<div class="pagehead"><h1>Amis</h1>${sub ? `<span class="small muted">${sub}</span>` : ""}</div>`;
    if (!live()) { main.innerHTML = `${head("Communauté")}<div class="panel"><div class="pad stack"><b>Les amis passent par le serveur</b><span class="small muted">Connecte-toi pour ajouter des amis, voir qui est en ligne, les inviter et prendre le renfort d'un ami au Monocompte.</span></div></div>`; return; }
    if (!A.list) { main.innerHTML = `${head("Communauté")}<div class="empty">${A.err ? h(A.err) : "Chargement…"}</div>`; if (!A.busy && !A.err) refresh(); return; }
    const L = A.list, F = L.amis || [], on = F.filter((f) => f.on), off = F.filter((f) => !f.on), mo = monoLive();
    const renfOf = (u) => A.renf && (A.renf.amis || []).find((x) => x.u === u);
    const row = (f) => { const M = MODE[f.mode];
      return `<div class="am-fr ${f.on ? "" : "off"}">${X().cmed(f.cls, f.lvl)}<span class="am-dot ${f.on ? "on" : ""}"></span>
      <div class="am-fi"><b>${X().pname(f.p, f.u)}</b><span class="xs muted">Niv. ${f.lvl || 1} · ${f.on ? (f.cherche ? "Cherche un groupe" : "En ligne") : ago(f.vu)}</span></div>
      ${M ? `<span class="am-o ${M[1]}">${M[0]}</span>` : ""}${f.cherche ? `<span class="am-o am-grp">Cherche un groupe</span>` : ""}
      <span class="am-acts">${f.on && f.mode === "mo" && mo ? `<button class="btn sm" data-act="am-inv" data-u="${h(f.u)}" data-v="groupe">Inviter</button>` : ""}
        <button class="btn sm ghost" disabled data-tip="Rendez-vous du Bureau : bientôt">Bureau</button>
        <button class="btn sm ghost" data-act="am-pm" data-u="${h(f.u)}" data-p="${h(f.p)}">Message</button>
        ${mo && renfOf(f.u) ? `<button class="btn sm ghost" data-act="am-renf" data-u="${h(f.u)}" data-tip="Copie de son héros en donjon solo, à la place du mercenaire, sans gain pour lui">Renfort</button>` : ""}
        <button class="btn sm ghost" data-act="am-del" data-u="${h(f.u)}" data-p="${h(f.p)}" aria-label="Retirer ${h(f.p)} de mes amis">Retirer</button></span></div>`; };
    const inv = (L.invits || []).map((v) => `<div class="am-fr"><div class="am-fi"><b>${h(v.p)}</b><span class="xs muted">${v.quoi === "groupe" ? "t'invite dans son groupe (Monocompte)" : "te donne rendez-vous au Bureau"}</span></div><span class="am-acts"><button class="btn sm" data-act="am-invok" data-id="${v.id}" data-v="1">Accepter</button><button class="btn sm ghost" data-act="am-invok" data-id="${v.id}" data-v="0">Refuser</button></span></div>`).join("");
    const rec = (L.recues || []).map((d) => `<div class="am-fr">${X().cmed(d.cls, d.lvl)}<div class="am-fi"><b>${h(d.p)}</b><span class="xs muted">Niv. ${d.lvl || 1} · ${{ chat: "depuis le chat", classement: "depuis les classements", guilde: "depuis la guilde" }[d.src] || "par son pseudo"}</span></div><span class="am-acts"><button class="btn sm" data-act="am-rep" data-u="${h(d.u)}" data-v="1">Accepter</button><button class="btn sm ghost" data-act="am-rep" data-u="${h(d.u)}" data-v="0">Refuser</button><button class="btn sm ghost" data-act="am-blk" data-u="${h(d.u)}" data-v="1">Bloquer</button></span></div>`).join("");
    const sent = (L.envoyees || []).map((d) => `<div class="am-fr sm"><div class="am-fi"><b>${h(d.p)}</b><span class="xs muted">en attente de sa réponse</span></div><button class="btn sm ghost" data-act="am-cancel" data-u="${h(d.u)}">Annuler</button></div>`).join("");
    const blk = (L.bloques || []).map((d) => `<div class="am-fr sm"><div class="am-fi"><b>${h(d.p)}</b><span class="xs muted">Ne peut plus t'écrire ni t'envoyer de demande</span></div><button class="btn sm ghost" data-act="am-blk" data-u="${h(d.u)}" data-v="0">Débloquer</button></div>`).join("");
    const sw = (k, on, t) => `<button class="am-tg" data-act="am-set" data-k="${k}" data-v="${on ? 0 : 1}" aria-pressed="${!!on}"><span class="am-sw ${on ? "on" : ""}"></span>${t}</button>`;
    const moi = L.moi || {};
    main.innerHTML = `${head(`${F.length} / ${L.max || 100} · Communauté`)}
      <div class="am-cols"><section class="am-main">
        <div class="panel am-add"><input id="amPseudo" type="text" maxlength="16" placeholder="Pseudo d'un joueur" aria-label="Pseudo d'un joueur"><button class="btn sm primary" data-act="am-askp">Envoyer une demande</button><span class="xs muted">On peut aussi ajouter depuis un pseudo dans le chat, les classements ou la guilde.</span></div>
        ${inv ? `<div class="panel am-card"><div class="am-ct">Invitations <span class="am-n">${L.invits.length}</span></div>${inv}</div>` : ""}
        ${rec ? `<div class="panel am-card"><div class="am-ct">Demandes reçues <span class="am-n">${L.recues.length}</span></div>${rec}</div>` : ""}
        <div class="panel am-card">${F.length ? `<div class="am-ct">En ligne <span class="am-n">${on.length}</span></div>${on.map(row).join("") || `<span class="xs muted">Personne en ligne pour l'instant.</span>`}
          <div class="am-ct">Hors ligne <span class="am-n">${off.length}</span></div>${off.map(row).join("") || `<span class="xs muted">Tout le monde est là.</span>`}` : `<div class="am-ct">Tes amis</div><span class="small muted">Pas encore d'amis : envoie une demande à un joueur croisé dans le chat, les classements ou ta guilde.</span>`}</div>
        ${sent ? `<div class="panel am-card"><div class="am-ct">Demandes envoyées <span class="am-n">${L.envoyees.length}</span></div>${sent}</div>` : ""}
      </section><aside class="am-side">
        <div class="panel am-card"><div class="am-ct">Ma présence</div>${sw("vis", !moi.invisible, "Visible par mes amis")}${sw("grp", !!moi.cherche, "Je cherche un groupe")}<span class="xs muted">En mode invisible, tes amis te voient hors ligne et ne peuvent pas t'inviter.</span></div>
        ${mo && A.renf ? `<div class="panel am-card"><div class="am-ct">Mon héros en renfort</div><span class="small">Ta copie a accompagné tes amis <b>${A.renf.aides || 0}</b> fois cette saison.</span><span class="xs muted">Sans gain pour toi ni pour eux : un simple compteur. La copie vient de ta partie validée par le serveur.</span></div>` : ""}
        <div class="panel am-card"><div class="am-ct">Bloqués <span class="am-n">${(L.bloques || []).length}</span></div>${blk || `<span class="xs muted">Personne. Un joueur bloqué ne peut plus t'écrire ni t'envoyer de demande.</span>`}</div>
        <div class="panel am-card am-note">La liste est tenue par le serveur : le navigateur ne peut ni ajouter ni retirer un ami sans l'accord des deux joueurs. 100 amis au plus.</div>
      </aside></div>`;
  }
  window.DX.pages.amis = page;

  const done = (r, ok) => { if (r && r.err) { X().toast(r.err); return false; } if (ok) X().toast(ok); refresh(); return true; };
  const closeChMenu = () => { const m = document.getElementById("chMenu"); if (m) m.remove(); };
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t || !/^am-/.test(t.dataset.act)) return; const a = t.dataset.act, d = t.dataset;
    if (a === "am-ask") { closeChMenu(); t.disabled = true; const r = await rpc("amis_demander", { p_user: d.u, p_pseudo: null, p_src: d.src || "pseudo" }); if (done(r, r.data && r.data.etat === "amis" ? `${d.p} et toi êtes maintenant amis.` : `Demande envoyée à ${d.p}.`)) t.textContent = "Demande envoyée"; else t.disabled = false; return; }
    if (a === "am-askp") { const i = document.getElementById("amPseudo"); const p = (i && i.value.trim()) || ""; if (p.length < 3) { X().toast("Écris le pseudo d'un joueur."); return; } const r = await rpc("amis_demander", { p_user: null, p_pseudo: p, p_src: "pseudo" }); if (done(r, r.data && r.data.etat === "amis" ? `${p} et toi êtes maintenant amis.` : `Demande envoyée à ${p}.`) && i) i.value = ""; return; }
    if (a === "am-rep") return done(await rpc("amis_repondre", { p_de: d.u, p_ok: d.v === "1" }), d.v === "1" ? "Demande acceptée." : "Demande refusée.");
    if (a === "am-cancel") return done(await rpc("amis_annuler", { p_a: d.u }), "Demande annulée.");
    if (a === "am-del") { if (!confirm(`Retirer ${d.p} de tes amis ?`)) return; return done(await rpc("amis_retirer", { p_ami: d.u }), `${d.p} n'est plus dans tes amis.`); }
    if (a === "am-blk") return done(await rpc("amis_bloquer", { p_user: d.u, p_pseudo: null, p_on: d.v === "1" }), d.v === "1" ? "Joueur bloqué." : "Joueur débloqué.");
    if (a === "am-set") { const on = d.v === "1"; const r = await rpc("amis_reglages", d.k === "vis" ? { p_invisible: !on, p_cherche: null } : { p_invisible: null, p_cherche: on }); return done(r); }
    if (a === "am-inv") return done(await rpc("amis_inviter", { p_ami: d.u, p_quoi: d.v, p_data: null }), "Invitation envoyée.");
    if (a === "am-invok") { const r = await rpc("amis_invit_repondre", { p_id: +d.id, p_ok: d.v === "1" }); if (!done(r, d.v === "1" ? "Invitation acceptée : écris-lui pour lancer le groupe." : "Invitation refusée.")) return;
      if (d.v === "1" && r.data && r.data.de) { const f = (A.list.amis || []).find((x) => x.u === r.data.de); openPm(r.data.de, f ? f.p : ""); } return; }
    if (a === "am-pm") return openPm(d.u, d.p);
    if (a === "am-renf") { UI().mercCls = "ami:" + d.u; UI().tab = "dungeons"; X().render(); X().toast("Renfort choisi : il remplace le mercenaire dans ton prochain donjon solo."); return; }
  });
  // message privé : celui du chat (MP), qui refuse déjà un joueur bloqué
  function openPm(u, p) { const C = window.CHAT && window.CHAT.state; if (!C) { X().toast("Le chat n'est pas disponible."); return; } C.names[u] = p; C.tab = "p"; C.peer = u; C.open = true; window.CHAT.repaint(); }

  window.AMIS = { crown, menuBtn, addBtn, refresh, get state() { return A; }, renforts: () => (A.renf && A.renf.amis) || [], couronne: () => A.cour, monoLive };
})();
