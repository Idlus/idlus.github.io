/* ============================================================================
   GIGA ANNONCE D'UN DOFUS — Idlus 1.0.30 (choix 37A de Mathis)
   Quand un Dofus tombe sur un boss, tous les joueurs connectés le voient en plein écran pendant 6 s :
   le Dofus en grand, qui l'a eu, où, et sa chance (« 1 chance sur 6 400 par héros · stasis 7 »),
   puis une ligne reste dans le chat Général.
   1. Le Dofus tombe (E.dofusDrop) : l'exemplaire est noté (uid de l'objet, donjon, stasis) dans le lien
      de la partie avec le compte (ON.link().dofq), sur cet appareil.
   2. Après l'envoi de la partie au serveur (onPush de ui.js), le jeu demande l'annonce (ON.dofusAnn).
      Le serveur vérifie tout lui-même (fonction « record » : le Dofus est dans la partie en ligne, il peut
      tomber de ce boss, la stasis est terminée et l'équipe la refait, compte pas « en vérification »)
      puis écrit l'annonce dans le chat (kind 'ann', data.t 'giga').
   3. Chaque joueur connecté la reçoit en direct (js/chat.js → GIGA.onAnn) : plein écran, puis la ligne du Général.
   Sans compte, hors ligne ou en partie solo : rien n'est envoyé (le Dofus reste fêté comme avant, sur l'appareil).
   Le premier exemplaire de chaque Dofus garde aussi son annonce dans les Hauts faits (supabase/chat.sql).
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const ON = window.ONLINE && window.ONLINE.enabled ? window.ONLINE : null;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const nf = (n) => Math.round(n || 0).toLocaleString("fr-FR");
  const SHOW_MS = 6000, MAX_AGE = 120000, KEEP = 7 * 86400000;

  /* ---------- 1. un Dofus tombe sur un boss : noté pour l'annonce ---------- */
  const drop0 = E.dofusDrop;
  if (drop0) E.dofusDrop = (S0, did, k, out) => {
    const u0 = (S0 && S0.nextUid) || 0;
    const r = drop0(S0, did, k, out);
    try {
      if (ON && window.DX && S0 && S0 === window.DX.S) {
        const got = Object.values(S0.items || {}).filter((it) => it && it.uid >= u0 && typeof it.tpl === "string" && it.tpl.startsWith("dofus_"));
        if (got.length) { const l = ON.link(); ON.setLink({ dofq: (l.dofq || []).concat(got.map((it) => ({ uid: it.uid, id: it.tpl.slice(6), did, k, t: Date.now() }))).slice(-10) }); }
      }
    } catch (e) { /* l'annonce ne gêne jamais le butin */ }
    return r;
  };

  /* ---------- 2. après l'envoi de la partie : demande d'annonce au serveur ---------- */
  let busy = false;
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function flush() {
    if (!ON || busy || !ON.user || (ON.solo && ON.solo())) return;
    const St = window.DX && window.DX.S;
    let q = (ON.link().dofq || []).filter((x) => x && Date.now() - (x.t || 0) < KEEP);
    if (!St || St.panelUsed) q = []; // partie de test : jamais d'annonce
    if (!q.length) { if ((ON.link().dofq || []).length) ON.setLink({ dofq: [] }); return; }
    busy = true;
    try {
      for (const x of q.slice()) {
        const r = await ON.dofusAnn(x);
        if (!r || r.net) break; // pas de réseau ou serveur occupé : au prochain envoi de la partie
        // la partie envoyée peut être d'avant le Dofus (envoi déjà parti) : on réessaie aux 3 envois suivants
        const retry = !r.ok && /introuvable/.test(r.err || "") && (x.n || 0) < 3;
        q = q.filter((y) => y.uid !== x.uid); if (retry) q.push(Object.assign({}, x, { n: (x.n || 0) + 1 }));
        ON.setLink({ dofq: q });
        if (retry) break;
        if (q.length) await wait(5500); // le serveur accepte une demande toutes les 5 s
      }
    } finally { busy = false; }
  }

  /* ---------- 3. l'annonce reçue par le chat : plein écran 6 s ---------- */
  const Q = [], seen = new Set();
  let cur = null, timer = 0;
  const odTxt = (d) => (d.odds ? `1 chance sur ${nf(d.odds)} par héros · stasis ${d.k}` : `stasis ${d.k}`);
  const bossOf = (d) => d.boss || (D.DUNGEONS[d.did] && D.MONSTERS[D.DUNGEONS[d.did].boss] ? D.MONSTERS[D.DUNGEONS[d.did].boss].name : "le boss");
  const dnameOf = (d) => d.dname || (D.DUNGEONS[d.did] ? D.DUNGEONS[d.did].name : "");
  const imgOf = (id) => (X().dofusImg ? X().dofusImg(id) : `assets/i/${E.DOFUS[id].icon}.png`);
  function onAnn(m) {
    const d = (m && m.data) || {}; if (!E.DOFUS[d.id] || seen.has(m.id)) return;
    seen.add(m.id);
    const at = m.created_at ? Date.parse(m.created_at) : Date.now(); if (Date.now() - at > MAX_AGE) return;
    Q.push({ m, at }); if (!cur) next();
  }
  function next() {
    clearTimeout(timer); cur = null;
    let x; while ((x = Q.shift()) && Date.now() - x.at > MAX_AGE); // trop vieille (onglet caché longtemps)
    if (!x) return;
    if (document.hidden) { Q.unshift(x); return; } // montrée au retour sur l'onglet
    cur = x; show(x.m);
    timer = setTimeout(close, SHOW_MS);
  }
  function show(m) {
    const d = m.data, Df = E.DOFUS[d.id];
    let el = $("#giga"); if (!el) { el = document.createElement("div"); el.id = "giga"; document.body.appendChild(el); }
    el.className = "giga"; el.setAttribute("role", "dialog"); el.setAttribute("aria-live", "assertive"); el.setAttribute("aria-label", `Annonce : ${Df.name} obtenu`); el.dataset.act = "giga-x";
    el.innerHTML = `<div class="giga-rays"></div><div class="giga-box">
      <img class="giga-img" src="${imgOf(d.id)}" alt="">
      <div class="giga-k">${X().IC("dofus")} Un Dofus vient de tomber</div>
      <div class="giga-t">${h(Df.name.toUpperCase())} !</div>
      <div class="giga-who"><b>${h(m.pseudo || "Un joueur")}</b> vient de l'obtenir en battant ${h(bossOf(d))}${dnameOf(d) ? ` <span>(${h(dnameOf(d))})</span>` : ""}</div>
      <div class="giga-odd">${h(odTxt(d))}</div>
      <div class="giga-s">Annonce envoyée à tous les joueurs connectés · <span style="white-space:nowrap">se ferme seule après ${SHOW_MS / 1000}&nbsp;s</span></div>
      <button class="btn sm" data-act="giga-x">Fermer</button></div>`;
    try { if (window.DX.sndPlay) window.DX.sndPlay("magic"); } catch (e) { /* son coupé */ }
  }
  function close() { clearTimeout(timer); const el = $("#giga"); if (el) el.remove(); cur = null; if (Q.length) setTimeout(next, 400); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !cur && Q.length) next(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && cur) close(); });
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-act="giga-x"],[data-act="giga-show"]'); if (!t) return;
    if (t.dataset.act === "giga-x") { close(); return; }
    const m = (window.GIGA._last || {})[t.dataset.id]; if (m && !cur) { cur = { m, at: Date.now() }; show(m); timer = setTimeout(close, SHOW_MS); } // revoir depuis le chat
  });

  /* ligne du chat Général (js/chat.js) ; un clic remontre l'annonce */
  function card(m) {
    const d = m.data || {}, Df = E.DOFUS[d.id]; if (!Df) return "";
    (window.GIGA._last = window.GIGA._last || {})[m.id] = m;
    return `<div class="ann giga-ann" data-act="giga-show" data-id="${h(m.id)}" data-tip="Revoir l'annonce"><img class="giga-ico" src="${imgOf(d.id)}" alt=""><span>${txt(m)}</span></div>`;
  }
  function txt(m, plain) {
    const d = m.data || {}, Df = E.DOFUS[d.id]; if (!Df) return "";
    const b = (s) => (plain ? s : `<b>${h(s)}</b>`);
    return `${b(m.pseudo || "Un joueur")} obtient le ${b(Df.name)} en battant ${plain ? bossOf(d) : h(bossOf(d))}, stasis ${d.k}${d.odds ? ` (1 chance sur ${nf(d.odds)} par héros)` : ""} !`;
  }

  window.GIGA = { flush, onAnn, card, txt, close };
})();
