/* ============================================================================
   BOÎTE À IDÉES — Idlus (0.1.36)
   Page Aide › Suggestions (aussi depuis Options › Aide) : le joueur choisit ce que son idée concerne
   (les tags du forum #idées du Discord), écrit un titre et son idée. Le serveur la garde (supabase/idees.sql)
   et le workflow « Suggestions vers Discord » la publie dans le forum #idées, où les joueurs votent avec 👍.
   Sans serveur (version de test hors ligne, pas d'Internet) : l'idée est copiée et le Discord s'ouvre.
   Le panel admin a un onglet « Suggestions » pour relire et masquer les idées.
   ========================================================================== */
(function () {
  "use strict";
  const D = window.DATA, ON = window.ONLINE;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s); // même échappement que le jeu (ui.js)
  const DISCORD = "https://discord.gg/9ApPgWjPUM";
  const TAGS = [["Combat", "⚔️"], ["Équipement", "🛡️"], ["Contenu", "🗺️"], ["Interface", "🖥️"]];
  const MAXT = 80, MAXB = 500, WAIT = 60000; // 2.1.29.1 : une idée par minute (au lieu de 10 min), la limite de 10 par jour reste
  const F = { tag: "", title: "", body: "", busy: false, err: "" };

  const S = () => window.DX.S;
  const online = () => !!(ON && ON.enabled && ON.db && ON.db());
  const hero = () => { const s = S(); return s ? s.chars.find((c) => c.id === s.mainHero) || s.chars[0] : null; };
  const info = () => { const c = hero(); return c ? `niv. ${c.lvl} · ${(D.CLASSES[c.cls] || {}).name || ""}` : ""; };
  const author = () => (ON && ON.user && ON.profile ? ON.profile.pseudo : (hero() || {}).name || "Joueur");
  const waitLeft = () => { const s = S(); return Math.max(0, ((s && s.ideaAt) || 0) + WAIT - Date.now()); };
  const date = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  function readForm() {
    const t = $("#idTitle"), b = $("#idBody"); if (t) F.title = t.value; if (b) F.body = b.value;
  }

  function html() {
    const on = online(); const left = waitLeft(); const s = S(); const mine = (s && s.ideas) || [];
    const chips = TAGS.map(([n, e]) => `<button aria-pressed="${F.tag === n}" data-act="id-tag" data-v="${h(n)}">${e} ${h(n)}</button>`).join("");
    const form = `<div class="box id-form">
      <h2>${X().IC("idee")} Proposer une idée</h2>
      <p class="small muted">${on ? "Ton idée est publiée dans le forum <b>Idées</b> du Discord, où les joueurs votent avec 👍. Chaque dimanche, les 5 idées les plus votées arrivent chez Xener."
        : "Le serveur n'est pas joignable ici : ton idée sera copiée et le Discord s'ouvrira, il suffira de la coller dans le forum <b>Idées</b>."}</p>
      <div><b class="small">Ça concerne…</b><div class="chips id-tags">${chips}</div></div>
      <label class="id-f"><b class="small">Titre</b><input type="text" id="idTitle" maxlength="${MAXT}" value="${h(F.title)}" placeholder="Un donjon pour le Bouftou Royal" autocomplete="off"></label>
      <label class="id-f"><b class="small">Ton idée</b><textarea id="idBody" maxlength="${MAXB}" placeholder="Explique ce que tu aimerais voir dans le jeu, et pourquoi.">${h(F.body)}</textarea>
        <span class="xs muted id-meta"><span>Signé <b>${h(author())}</b>${info() ? ` · ${h(info())}` : ""}${on && !(ON && ON.user) ? " · sans compte" : ""}</span><span id="idCnt">${F.body.length} / ${MAXB}</span></span></label>
      ${F.err ? `<div class="small bad">${h(F.err)}</div>` : ""}
      <div class="row id-send"><button class="btn primary" data-act="id-send" ${F.busy || (on && left) ? "disabled" : ""}>${F.busy ? "Envoi…" : on ? "Envoyer l'idée" : "Copier et ouvrir Discord"}</button>
        <span class="grow"></span><span class="xs muted">${on ? (left ? `Prochaine idée dans ${Math.ceil(left / 60000)} min` : "Une idée par minute") : ""}${on ? " · " : ""}<a href="${DISCORD}" target="_blank" rel="noopener">${on ? "ou poster sur Discord" : "Ouvrir le Discord"}</a></span></div>
    </div>`;
    const list = `<div class="box"><h2>Tes idées envoyées</h2>${mine.length ? `<div class="list">${mine.map((x) => `<div class="li"><span class="grow"><b>${h(x.t)}</b><br><span class="xs muted">${h(x.g)} · ${date(x.d)}</span></span></div>`).join("")}</div>` : `<div class="empty">Aucune idée pour l'instant. La première sera peut-être dans le jeu !</div>`}
      <p class="xs muted" style="margin:8px 0 0">Les idées retenues sont marquées « Retenue » sur le Discord, et les plus votées sont regardées chaque semaine.</p></div>
      <div class="box id-bug"><span class="grow small">Plutôt un <b>bug</b> ? Signale-le ici : il part directement pour être corrigé.</span><button class="btn sm" data-act="reportbug"><img class="uico" src="assets/ui/bug.webp" alt=""> Signaler un bug</button></div>`;
    return `<div class="pagehead"><h1>Suggestions</h1></div><div class="two id-page">${form}<div class="stack" style="gap:12px">${list}</div></div>`;
  }
  function render(main) { if (main) { readForm(); main.innerHTML = html(); } } // 1.0.10.3 : le texte en cours n'est plus effacé par un redessin de la page
  const repaint = () => { if (window.DX.ui.tab === "sugg") { readForm(); render($("#main")); } };

  function check(tag, t, b) {
    if (!tag) return "Choisis ce que ton idée concerne.";
    if (t.length < 4) return "Donne un titre à ton idée (4 caractères au moins).";
    if (b.length < 10) return "Explique un peu plus ton idée (10 caractères au moins).";
    return "";
  }
  function remember(t, g) {
    const s = S(); if (!s) return;
    s.ideas = [{ t: t.slice(0, MAXT), g, d: Date.now() }].concat(s.ideas || []).slice(0, 10);
  }

  /* Envoi d'une idée, partagé avec l'onglet « Idée » de la fenêtre Signaler un bug (1.2.3.2) :
     renvoie { ok: titre }, { err: message } ou { copied: true } (hors ligne : copiée, le Discord s'ouvre). */
  async function post(tag, title, body) {
    const t = (title || "").trim().replace(/\s+/g, " "), b = (body || "").trim();
    const err = check(tag, t, b); if (err) return { err };
    if (!online()) {
      const txt = `${t}\n\n${b}\n\n— ${author()}${info() ? ` (${info()})` : ""}, catégorie ${tag}`;
      const open = () => window.open(DISCORD, "_blank", "noopener");
      try { navigator.clipboard.writeText(txt).then(() => { X().toast("Idée copiée : ouvre un fil dans le forum Idées et colle-la."); open(); }, open); } catch (e) { open(); }
      return { copied: true };
    }
    const left = waitLeft(); if (left) return { err: `Une idée par minute : la prochaine dans ${Math.ceil(left / 60000)} min.` };
    const s = S(); if (s && !s.gid) s.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); // identifiant de la partie pour les joueurs sans compte
    const r = await ON.rpc("idea_send", { p_tag: tag, p_title: t, p_body: b, p_info: info(), p_guest: ON.user ? null : s.gid, p_name: author() });
    if (r.err) return { err: /fetch|connexion|network/i.test(r.err) ? "Pas de connexion au serveur. Réessaie dans un moment." : "Impossible d'envoyer l'idée pour le moment." };
    if (r.data) return { err: r.data };
    s.ideaAt = Date.now(); remember(t, tag);
    return { ok: t };
  }
  const thanks = (t) => `<h2>✅ Merci, ton idée est partie !</h2>
      <p class="small" style="margin:0">« <b>${h(t)}</b> » sera publiée dans le forum Idées du Discord dans la demi-heure. Les autres joueurs pourront voter pour elle avec 👍.</p>
      <p class="xs muted" style="margin:0">Tu pourras en proposer une autre dans une minute.</p>
      <div class="row"><a class="btn" href="${DISCORD}" target="_blank" rel="noopener">Voir le Discord</a><button class="btn primary sm" data-act="closesheet">Fermer</button></div>`;

  async function send() {
    readForm(); if (F.busy) return;
    F.busy = true; F.err = ""; repaint();
    const r = await post(F.tag, F.title, F.body);
    F.busy = false;
    if (r.err) { F.err = r.err; return repaint(); }
    if (r.copied) return repaint();
    Object.assign(F, { tag: "", title: "", body: "", err: "" });
    ["#idTitle", "#idBody"].forEach((q) => { const el = $(q); if (el) el.value = ""; }); // 1.0.10.3 : sinon repaint() relisait l'ancien texte et le formulaire restait rempli
    repaint();
    X().openSheet(thanks(r.ok));
  }

  /* ---------- panel admin (onglet « Suggestions ») ---------- */
  function adminHtml(list) {
    const rows = !list ? `<div class="empty">Chargement…</div>` : !list.length ? `<div class="empty">Aucune idée pour l'instant.</div>` : list.map((x) => {
      const st = x.hidden ? `<span class="st m">Masquée</span>` : x.url ? `<span class="st mod">Sur Discord</span>` : `<span class="st v">En attente</span>`;
      return `<div class="ln id-ln"><span class="grow"><b>${h(x.title)}</b> ${st} <span class="xs muted">${h(x.tag)}</span><br>
        <span class="small">${h(x.body)}</span><br><span class="xs muted">${h(x.pseudo)}${x.guest ? " (sans compte)" : ""}${x.info ? ` · ${h(x.info)}` : ""} · ${new Date(x.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
        <span class="acts">${x.url ? `<a class="btn sm" href="${h(x.url)}" target="_blank" rel="noopener">Voir sur Discord</a>` : ""}<button class="btn sm${x.hidden ? "" : " danger"}" data-act="id-hide" data-v="${x.id}" data-on="${x.hidden ? 0 : 1}">${x.hidden ? "Réafficher" : "Masquer"}</button></span></div>`;
    }).join("");
    return `<div class="box"><h2>Suggestions des joueurs</h2><p class="small muted">Chaque idée est publiée dans le forum #idées du Discord dans la demi-heure qui suit l'envoi (relais automatique, ou « Run workflow » sur « Suggestions vers Discord » pour l'envoyer tout de suite). Masquer une idée en attente l'empêche d'y partir ; une idée déjà publiée se supprime aussi sur Discord.</p>${rows}</div>`;
  }

  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^id-/.test(t.dataset.act)) return;
    const a = t.dataset.act, d = t.dataset;
    if (a === "id-tag") { readForm(); F.tag = F.tag === d.v ? "" : d.v; F.err = ""; repaint(); return; }
    if (a === "id-send") { send(); return; }
    if (a === "id-hide") {
      const r = await ON.rpc("adm_idea_hide", { p_id: +d.v, p_on: d.on === "1" });
      X().toast(r.err || (d.on === "1" ? "Idée masquée." : "Idée réaffichée."));
      const b = $('[data-act="adm-reload"]'); if (b) b.click(); return;
    }
  });
  document.addEventListener("input", (ev) => {
    if (!ev.target || ev.target.id !== "idBody") return;
    const c = $("#idCnt"); if (c) c.textContent = `${ev.target.value.length} / ${MAXB}`;
  });

  window.IDEES = { render, adminHtml, post, thanks, TAGS, MAXT, MAXB, waitLeft };
})();
