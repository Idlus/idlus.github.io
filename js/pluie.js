/* ============================================================================
   PLUIE DE KAMAS — Idlus 1.2.8 (choix de Mathis 15/10 : 1C 2A 3A 5A 6A, maquette « Cagnotte de Xener »)
   Xener met des kamas de SON compte dans une pluie de quelques minutes (panel › Annonces). Les joueurs connectés à
   un compte cliquent « Je participe » (carte sur l'accueil, pastille sur les autres pages) ; à la fin, le serveur
   partage la pluie à parts égales et envoie les kamas par la voie de l'hôtel de vente (hdv_ops, js/market.js).
   Règles et vérifications : supabase/pluie.sql. Le jeu ne fait qu'afficher et demander.
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const P = { st: null, off: 0, busy: false, last: 0, paid: 0, adm: null, f: { total: "", min: 5, msg: "", ann: true }, confirm: false };

  const left = () => (P.st && P.st.st === "open" ? Math.max(0, Math.ceil((Date.parse(P.st.ends) - (Date.now() + P.off)) / 1000)) : 0);
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const open = () => !!(P.st && P.st.st === "open" && left() > 0);
  const est = () => (P.st ? Math.floor(P.st.total / Math.max(1, P.st.n + (P.st.in ? 0 : 1))) : 0); // part si je participe maintenant

  const monoP = () => !!(ON.monoPart && ON.monoPart()); // 2.1.37.x : la pluie de kamas est du serveur Classique (parts versées par hdv_ops) : rien dans une partie Monocompte
  async function poll() {
    if (monoP()) { if (P.st) { P.st = null; paint(); } return; }
    if (!ON.rpc || ON.state === "offline") return;
    P.last = Date.now();
    const r = await ON.rpc("rain_state"); if (r.err) return;
    P.st = r.data || null;
    if (P.st && P.st.now) P.off = Date.parse(P.st.now) - Date.now();
    /* la pluie vient de finir et j'y étais : les kamas arrivent par l'hôtel de vente (on les demande tout de suite) */
    if (P.st && P.st.st === "done" && P.st.in && P.paid !== P.st.id && window.MARKET) { P.paid = P.st.id; setTimeout(() => window.MARKET.sync(), 800); }
    paint();
  }
  function cardHtml() {
    const t = P.st; if (!t) return "";
    const drops = `<div class="pl-rain" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 53) % 100}%;animation-delay:${((i * 37) % 30) / 10}s"></i>`).join("")}</div>`;
    if (t.st === "open") {
      const s = left();
      const btn = t.mine ? `<span class="tag soft">C'est ta pluie : les joueurs la voient sur leur accueil.</span>`
        : t.in ? `<span class="tag good">✓ Tu participes</span><span class="xs muted">Reste tranquille : ta part arrive à la fin, même si tu changes de page.</span>`
          : (s <= 0 ? `<button class="btn" disabled>Partage en cours…</button>` : `<button class="btn primary" data-act="pl-join" ${P.busy ? "disabled" : ""}>Je participe</button>`) + `<span class="xs muted">${ON.user ? "Un clic suffit : la pluie est partagée à parts égales entre tous les participants à la fin." : "Il faut être connecté à un compte (gratuit) pour participer."}</span>`;
      return `<section class="panel pl-card" style="margin-top:14px">${drops}<div class="phead"><h2>${X().IC("kamas")} Pluie de kamas de ${h(t.by || "Xener")}</h2><span class="tag good">en direct</span></div><div class="pad stack">
        <div class="pl-row"><div class="stack" style="gap:2px"><span class="xs muted">À partager entre les joueurs qui participent</span><span class="pl-sum num">${fmt(t.total)} kamas</span></div>
          <div class="stack pl-end" style="gap:2px"><span class="xs muted">Fin de la pluie dans</span><span class="pl-big num" data-pl="left">${mmss(s)}</span></div></div>
        ${t.msg ? `<div class="small">${h(t.msg)}</div>` : ""}
        <div class="pl-row small"><span><b class="num">${fmt(t.n)}</b> joueur${t.n > 1 ? "s" : ""} participe${t.n > 1 ? "nt" : ""}</span><span>Part ${t.in ? "actuelle" : "si tu participes"} : <b class="num">≈ ${fmt(t.in ? Math.floor(t.total / Math.max(1, t.n)) : est())} kamas</b></span></div>
        <div class="row">${btn}</div></div></section>`;
    }
    /* finie depuis moins de 15 minutes */
    const got = t.in && t.share > 0;
    return `<section class="panel pl-card done" style="margin-top:14px"><div class="phead"><h2>${X().IC("kamas")} Pluie de kamas de ${h(t.by || "Xener")}</h2><span class="tag soft">finie</span></div><div class="pad stack" style="gap:6px">
      ${got ? `<div><b class="plus num">+${fmt(t.share)} kamas</b> pour toi, comme pour les ${fmt(t.n)} participants.</div>` : t.n ? `<div class="small">${fmt(t.n)} joueur${t.n > 1 ? "s ont" : " a"} reçu <b class="num">${fmt(t.share)} kamas</b>${t.n > 1 ? " chacun" : ""}.</div>` : `<div class="small muted">Personne n'a participé : les kamas sont revenus à ${h(t.by || "Xener")}.</div>`}
      ${got ? `<span class="xs muted">Les kamas sont dans ta partie (journal de l'hôtel de vente).</span>` : !t.mine && t.n ? `<span class="xs muted">Garde un œil sur le chat : la prochaine pluie y est annoncée.</span>` : ""}</div></section>`;
  }
  /* accueil (appelé par homeHtml dans js/ui.js) ; rien quand il n'y a pas de pluie */
  const homeHtml = () => (P.st && !monoP() ? cardHtml() : "");
  function pill() {
    let el = $("#plpill");
    const ui = window.DX.ui || {};
    const show = !monoP() && open() && !P.st.in && !P.st.mine && !(ui.tab === "home" && ui.home !== "havre" && ui.home !== "expe");
    if (!show) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("button"); el.id = "plpill"; el.className = "pl-pill"; el.dataset.act = "pl-join"; document.body.appendChild(el); }
    const txt = `${X().IC("kamas")}<span><b>Pluie de kamas</b> · <span class="num" data-pl="left">${mmss(left())}</span></span><span class="pl-go">Je participe</span>`;
    if (el.dataset.k !== String(P.st.id)) { el.innerHTML = txt; el.dataset.k = String(P.st.id); }
  }
  function paint() {
    pill();
    const c = $(".pl-card"); const ui = window.DX.ui || {};
    if (ui.tab === "home" && ui.home !== "havre" && ui.home !== "expe") {
      if (c && P.st) c.outerHTML = cardHtml(); // même HTML que homeHtml : le rendu suivant de l'accueil n'y verra aucune différence
      else if (!!c !== !!P.st && window.DX.render && !$("#sheet").innerHTML) { try { window.DX.render(); } catch (e) {} }
    }
    const a = document.activeElement;
    if (ui.tab === "admin" && P.adm !== null && !(a && a.closest && a.closest("#plAdm"))) repaintAdm(); // pas pendant qu'on tape
  }
  async function join() {
    if (monoP()) { X().toast(ON.CLASSIC_ERR); return; }
    if (P.busy || !open()) return;
    if (!ON.user) { X().toast("Connecte-toi à un compte (gratuit) pour participer à la pluie de kamas : Options › Compte."); return; }
    P.busy = true; paint();
    try { await X().onPush(); } catch (e) {} // le serveur vérifie la partie en ligne
    const r = await ON.rpc("rain_join", { p_id: P.st.id }); P.busy = false;
    if (r.err || (r.data && r.data.err)) { X().toast(r.err || r.data.err); paint(); return; }
    P.st = r.data; X().toast(`Tu participes à la pluie de kamas ! Ta part arrive à la fin (${mmss(left())}).`, "rare"); paint();
  }

  /* ---------- panel Xener › Annonces ---------- */
  async function admLoad() { const r = await ON.rpc("adm_rains"); P.adm = r.data || []; await poll(); }
  function readForm() {
    const v = (id) => { const e = $(id); return e ? e.value : null; };
    if ($("#plTot")) { P.f.total = v("#plTot"); P.f.min = +v("#plMin") || 5; P.f.msg = v("#plMsg"); P.f.ann = $("#plAnn").checked; }
  }
  const total = () => Math.floor(Number(String(P.f.total).replace(/[^\d]/g, "")) || 0);
  function adminBox() {
    if (monoP()) return `<div class="box"><h2>Pluie de kamas</h2><p class="small muted">Réservé au serveur Classique : ouvre ta partie Classique pour lancer une pluie (les kamas viennent de cette partie).</p></div>`;
    const t = P.st && P.st.st === "open" ? P.st : null; const k = Math.floor((S() && S().kamas) || 0);
    const cur = t ? `<div class="ln"><span class="grow"><b>En cours :</b> ${fmt(t.total)} kamas · ${fmt(t.n)} participant${t.n > 1 ? "s" : ""} · fin dans <span class="num" data-pl="left">${mmss(left())}</span></span>
        <button class="btn sm" data-act="pl-stop" data-v="1">Partager maintenant</button><button class="btn sm" data-act="pl-stop" data-v="0">Annuler (tout te revient)</button></div>` : "";
    const hist = (P.adm || []).filter((x) => x.status !== "open").slice(0, 5).map((x) => `<div class="ln small"><span class="grow">${fmt(x.total)} kamas · ${x.status === "cancel" ? "annulée" : `${fmt(x.n)} participant${x.n > 1 ? "s" : ""}, ${fmt(x.share)} chacun`}</span><span class="t">${new Date(x.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>`).join("");
    const T = total(); const ok = T >= 1000 && T <= k && !t;
    const form = t ? "" : `<div class="row small"><span class="muted">Kamas :</span><input id="plTot" inputmode="numeric" placeholder="ex. 5 000 000" value="${h(P.f.total)}" style="width:140px">
        <span class="muted">Durée :</span><select id="plMin">${[2, 5, 10, 15, 30].map((m) => `<option value="${m}" ${P.f.min === m ? "selected" : ""}>${m} min</option>`).join("")}</select>
        <label class="row"><input type="checkbox" id="plAnn" ${P.f.ann ? "checked" : ""}> Bandeau + chat Général</label></div>
      <input id="plMsg" maxlength="140" placeholder="Message (facultatif), ex. : Merci d'être là ce soir !" value="${h(P.f.msg)}">
      <div class="row">${P.confirm && ok ? `<button class="btn primary" data-act="pl-open" data-v="1">Confirmer : retirer ${fmt(T)} kamas de mon compte</button><button class="btn sm" data-act="pl-open" data-v="0">Annuler</button>`
        : `<button class="btn primary" data-act="pl-open" ${ok ? "" : "disabled"}>Lancer la pluie</button>`}<span class="xs muted">${T > k ? "Tu n'as pas assez de kamas." : T && T < 1000 ? "Au moins 1 000 kamas." : "Les kamas quittent ton compte au lancement ; ce qui n'est pas partagé te revient."}</span></div>`;
    return `<div class="box"><h2>Pluie de kamas</h2><p class="small muted">Tu donnes des kamas de ton compte (tu en as <b class="num">${fmt(k)}</b>). Pendant la durée choisie, les joueurs connectés à un compte cliquent « Je participe » ; à la fin, tout est partagé à parts égales entre eux. Personne = tout te revient.</p>
      ${cur}${form}${hist ? `<div class="stack" style="gap:2px"><span class="xs muted">Dernières pluies</span>${hist}</div>` : ""}</div>`;
  }
  function repaintAdm() { const b = $("#plAdm"); if (b) { readForm(); b.innerHTML = adminBox(); } }
  async function admOpen() {
    if (monoP()) { X().toast(ON.CLASSIC_ERR); return; }
    readForm(); const T = total(); if (P.busy) return; P.busy = true;
    try { await X().onPush(); } catch (e) {}
    const r = await ON.rpc("adm_rain_open", { p_total: T, p_min: P.f.min, p_msg: P.f.msg || "", p_announce: !!P.f.ann }); P.busy = false; P.confirm = false;
    if (r.err || (r.data && r.data.err)) { X().toast(r.err || r.data.err); repaintAdm(); return; }
    if (r.data.ops && window.MARKET) window.MARKET.apply(r.data.ops, true);
    P.f.total = ""; P.f.msg = ""; X().toast(`Pluie de kamas lancée : ${fmt(T)} kamas pendant ${P.f.min} min.`, "rare"); await admLoad(); repaintAdm();
  }

  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act^='pl-']"); if (!b) return;
    const a = b.dataset.act;
    if (a === "pl-join") return join();
    if (a === "pl-open") { readForm(); if (b.dataset.v === "1") return admOpen(); P.confirm = b.dataset.v !== "0"; repaintAdm(); return; }
    if (a === "pl-stop") { if (P.busy || !P.st) return; P.busy = true; const r = await ON.rpc("adm_rain_stop", { p_id: P.st.id, p_share: b.dataset.v === "1" }); P.busy = false; X().toast(r.err || (r.data && r.data.err) || (b.dataset.v === "1" ? "Pluie partagée." : "Pluie annulée : les kamas te reviennent.")); await admLoad(); if (window.MARKET) window.MARKET.sync(); repaintAdm(); }
  });
  document.addEventListener("input", (ev) => { if (ev.target && ev.target.id === "plTot") { P.f.total = ev.target.value; const T = total(); const k = Math.floor((S() && S().kamas) || 0); const btn = $("[data-act='pl-open']"); if (btn && !P.confirm) btn.disabled = !(T >= 1000 && T <= k); } });

  /* ---------- démarrage (appelé par ui.js) : toutes les 60 s, toutes les 10 s pendant une pluie ; décompte à la seconde ---------- */
  let started = false;
  function start() {
    if (started) return; started = true;
    setTimeout(poll, 2500);
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const wait = open() || (P.st && P.st.st === "open") ? 10e3 : 60e3;
      if (Date.now() - P.last >= wait) poll();
      if (P.st && P.st.st === "open") { const s = left(); document.querySelectorAll("[data-pl='left']").forEach((e) => { e.textContent = mmss(s); }); if (!s && Date.now() - P.last > 2500) poll(); }
      pill();
    }, 1000);
  }
  window.PLUIE = { start, homeHtml, adminBox, admLoad, readForm, poll, P };
})();
