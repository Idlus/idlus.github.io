/* ============================================================================
   SIGNALER UN BUG — Idlus (1.1.1.3)
   Bouton « Signaler un bug » (Options › Aide, page Suggestions, recherche) : le joueur décrit le bug, le jeu joint
   un diagnostic (version, appareil, page ouverte, résumé de la partie, 5 dernières erreurs). Le serveur le garde
   (supabase/bugs.sql) ; le workflow « Bugs signalés » en fait un ticket GitHub (sans pseudo) que Claude reprend pour
   corriger le bug, et un fil dans le forum #bugs du Discord ; puis il recopie l'état du ticket : le joueur voit « Corrigé dans la 1.x » sous « Tes signalements ».
   Sans serveur : le rapport est copié et le forum Bugs du Discord s'ouvre (comme avant).
   Le panel admin a un onglet « Bugs ».
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const DISCORD_BUGS = "https://discord.gg/2xX6F9764Z";
  const MAXW = 1000, MAXX = 500;
  const F = { mode: "bug", what: "", exp: "", diag: true, busy: false, err: "", ctx: null, mine: null, at: 0, tag: "", title: "", body: "" };
  const ST = { nouveau: ["Reçu", "v"], transmis: ["Reçu, en examen", "v"], en_cours: ["Correction en cours", "mod"], corrige: ["Corrigé", "ok"], pas_un_bug: ["Pas un bug", "m"], a_voir: ["Regardé par Xener", "mod"] };

  const S = () => window.DX.S;
  const online = () => !!(ON && ON.enabled && ON.db && ON.db());
  const hero = () => { const s = S(); return s ? s.chars.find((c) => c.id === s.mainHero) || s.chars[0] : null; };
  const author = () => (ON && ON.user && ON.profile ? ON.profile.pseudo : (hero() || {}).name || "Joueur");
  const gid = () => { const s = S(); if (s && !s.gid) s.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); return s ? s.gid : null; }; // même identifiant que les idées (joueurs sans compte)
  const date = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const device = () => { const u = navigator.userAgent; return `${/android/i.test(u) ? "Android" : /iphone|ipad|ipod/i.test(u) ? "iPhone/iPad" : "PC"} · ${window.innerWidth}×${window.innerHeight}`; };

  /* contexte figé à l'ouverture : la page où le bug a été vu, pas la fenêtre de signalement */
  function snapshot() {
    const DX = window.DX; let diag = ""; try { diag = DX.diagText(); } catch (e) { diag = "Diagnostic indisponible : " + e.message; }
    const m = /^Onglet : (.*)$/m.exec(diag);
    return { diag: diag.slice(0, 4000), page: (m ? m[1] : DX.ui.tab || "").slice(0, 80), version: (/idlus ([0-9.]+)/.exec(diag) || [])[1] || "" };
  }
  function readForm() { const w = $("#bgWhat"), x = $("#bgExp"), c = $("#bgDiag"), t = $("#bgTitle"), b = $("#bgBody"); if (w) F.what = w.value; if (x) F.exp = x.value; if (c) F.diag = c.checked; if (t) F.title = t.value; if (b) F.body = b.value; }

  function mineHtml() {
    if (!online()) return "";
    const L = F.mine;
    const rows = !L ? `<div class="xs muted">Chargement…</div>` : !L.length ? `<div class="xs muted">Aucun signalement envoyé pour l'instant.</div>` : L.map((b) => {
      const st = ST[b.status] || ST.nouveau; const lab = b.status === "corrige" && b.fixed_in ? `Corrigé dans la ${h(b.fixed_in)}` : st[0];
      return `<div class="bg-li"><span class="grow"><span class="small">${h(b.what)}</span><br><span class="xs muted">n°${b.id} · ${date(b.created_at)}${b.note ? ` · ${h(b.note)}` : ""}</span></span><span class="bg-st ${st[1]}">${lab}</span></div>`;
    }).join("");
    return `<div class="bg-mine"><b class="small">Tes signalements</b>${rows}</div>`;
  }
  /* 1.2.3.2 (demande de Mathis) : onglet « Idée » dans la même fenêtre ; l'idée part dans la Boîte à idées (forum Idées du Discord), jamais en ticket de bug */
  const modes = () => `<div class="chips bg-mode" role="tablist"><button role="tab" aria-pressed="${F.mode === "bug"}" data-act="bg-mode" data-v="bug"><img class="uico" src="assets/ui/bug.webp" alt=""> Bug</button><button role="tab" aria-pressed="${F.mode === "idee"}" data-act="bg-mode" data-v="idee">${X().IC("idee")} Idée</button></div>`;
  function ideaHtml() {
    const I = window.IDEES; const on = online(); const left = on ? I.waitLeft() : 0;
    const chips = I.TAGS.map(([n, e]) => `<button aria-pressed="${F.tag === n}" data-act="bg-tag" data-v="${h(n)}">${e} ${h(n)}</button>`).join("");
    return `${modes()}<h2>${X().IC("idee")} Proposer une idée</h2>
      <p class="small muted" style="margin:0">${on ? "Ton idée est publiée dans le forum <b>Idées</b> du Discord, où les joueurs votent avec 👍. Chaque dimanche, les 5 idées les plus votées arrivent chez Xener."
        : "Le serveur n'est pas joignable ici : ton idée sera copiée et le Discord s'ouvrira, il suffira de la coller dans le forum <b>Idées</b>."}</p>
      <div><b class="small">Ça concerne…</b><div class="chips id-tags">${chips}</div></div>
      <label class="id-f"><b class="small">Titre</b><input type="text" id="bgTitle" maxlength="${I.MAXT}" value="${h(F.title)}" placeholder="Un donjon pour le Bouftou Royal" autocomplete="off"></label>
      <label class="id-f"><b class="small">Ton idée</b><textarea id="bgBody" maxlength="${I.MAXB}" placeholder="Explique ce que tu aimerais voir dans le jeu, et pourquoi.">${h(F.body)}</textarea>
        <span class="xs muted id-meta"><span>Signé <b>${h(author())}</b></span><span id="bgICnt">${F.body.length} / ${I.MAXB}</span></span></label>
      ${F.err ? `<div class="small bad">${h(F.err)}</div>` : ""}
      <div class="row id-send"><button class="btn primary" data-act="bg-idea" ${F.busy || left ? "disabled" : ""}>${F.busy ? "Envoi…" : on ? "Envoyer l'idée" : "Copier et ouvrir Discord"}</button><span class="grow"></span>${left ? `<span class="xs muted">Prochaine idée dans ${Math.ceil(left / 60000)} min</span>` : ""}<button class="btn sm" data-act="closesheet">Annuler</button></div>`;
  }
  function html() {
    if (F.mode === "idee" && window.IDEES) return ideaHtml();
    const on = online();
    return `${window.IDEES ? modes() : ""}<h2>${X().G("bug")} Signaler un bug</h2>
      <p class="small muted" style="margin:0">${on ? "Ton signalement part directement chez Claude et Xener pour être corrigé. Tu verras ici quand il est réparé, et dans quelle version."
        : "Le serveur n'est pas joignable ici : ton signalement sera copié et le forum Bugs du Discord s'ouvrira, il suffira de le coller."}</p>
      <label class="id-f"><b class="small">Que s'est-il passé ?</b><textarea id="bgWhat" maxlength="${MAXW}" placeholder="Ex. : en ouvrant l'Inventaire, ma Cape Bouffante a disparu de l'équipement de mon Iop.">${h(F.what)}</textarea>
        <span class="xs muted id-meta"><span>Envoyé par <b>${h(author())}</b>${on && !(ON && ON.user) ? " · sans compte" : ""}</span><span id="bgCnt">${F.what.length} / ${MAXW}</span></span></label>
      <label class="id-f"><b class="small">Qu'est-ce que tu attendais ? <span class="muted">(facultatif)</span></b><textarea id="bgExp" class="bg-short" maxlength="${MAXX}" placeholder="Ex. : la cape reste équipée.">${h(F.exp)}</textarea></label>
      <label class="bg-chk small"><input type="checkbox" id="bgDiag" ${F.diag ? "checked" : ""}><span>Joindre le diagnostic <span class="muted">(version, appareil, page « ${h(F.ctx ? F.ctx.page : "")} », résumé de la partie, dernières erreurs)</span></span></label>
      <details class="bg-diag"><summary class="xs muted">Voir le diagnostic</summary><pre>${h(F.ctx ? F.ctx.diag : "")}</pre></details>
      ${on ? `<p class="xs muted" style="margin:0">Ton signalement est aussi publié dans le forum Bugs du Discord, avec ton pseudo : n'écris rien de personnel.</p>` : ""}
      ${F.err ? `<div class="small bad">${h(F.err)}</div>` : ""}
      <div class="row id-send"><button class="btn primary" data-act="bg-send" ${F.busy ? "disabled" : ""}>${F.busy ? "Envoi…" : on ? "Envoyer le signalement" : "Copier et ouvrir Discord"}</button><span class="grow"></span><button class="btn sm" data-act="closesheet">Annuler</button></div>
      ${mineHtml()}`;
  }
  const repaint = () => { const sh = $("#sheet .bg-sheet"); if (!sh) return; readForm(); sh.innerHTML = html(); };

  async function loadMine() {
    if (!online() || Date.now() - F.at < 20000) return;
    F.at = Date.now();
    const r = await ON.rpc("bug_mine", { p_guest: ON.user ? null : gid() });
    F.mine = r.err ? [] : r.data || [];
    const s = S(); if (s && F.mine.length) s.bugs = F.mine.map((b) => ({ id: b.id, st: b.status, v: b.fixed_in || "" })).slice(0, 10);
    repaint();
  }

  function open(mode) {
    F.ctx = snapshot(); F.err = ""; F.busy = false; F.mode = mode === "idee" ? "idee" : "bug";
    X().openSheet(`<div class="bg-sheet">${html()}</div>`);
    const w = $("#bgWhat"); if (w && window.innerWidth > 700) w.focus();
    loadMine();
  }

  function report() {
    const parts = [`🐞 Bug — idlus ${F.ctx.version}`, `Ce qui s'est passé : ${F.what.trim()}`];
    if (F.exp.trim()) parts.push(`Ce que j'attendais : ${F.exp.trim()}`);
    if (F.diag) parts.push("", F.ctx.diag);
    return parts.join("\n");
  }
  async function send() {
    readForm();
    const w = F.what.trim();
    if (w.length < 10) { F.err = "Décris un peu plus le bug (10 caractères au moins)."; return repaint(); }
    if (!online()) {
      const txt = report(); const go = () => window.open(DISCORD_BUGS, "_blank", "noopener");
      try { navigator.clipboard.writeText(txt).then(() => { X().toast("Signalement copié : ouvre un fil dans le forum Bugs et colle-le."); go(); }, go); } catch (e) { go(); }
      return;
    }
    if (F.busy) return; F.busy = true; F.err = ""; repaint();
    const r = await ON.rpc("bug_send", { p_what: w, p_expected: F.exp.trim() || null, p_page: F.ctx.page, p_version: F.ctx.version, p_device: device(),
      p_diag: F.diag ? F.ctx.diag : null, p_guest: ON.user ? null : gid(), p_name: author() });
    F.busy = false;
    if (r.err) { F.err = /fetch|connexion|network/i.test(r.err) ? "Pas de connexion au serveur. Réessaie dans un moment." : "Impossible d'envoyer le signalement pour le moment."; return repaint(); }
    if (r.data && r.data.err) { F.err = r.data.err; return repaint(); }
    const id = r.data && r.data.id;
    Object.assign(F, { what: "", exp: "", err: "", diag: true, at: 0 });
    const s = S(); if (s && id) s.bugs = [{ id, st: "nouveau", v: "" }].concat(s.bugs || []).slice(0, 10);
    X().openSheet(`<div class="bg-sheet"><h2>✅ Merci, ton signalement est parti !</h2>
      <p class="small" style="margin:0">Signalement n°${id || "?"}. Il va être examiné et, si c'est bien un bug, corrigé dans une prochaine version. Il arrive aussi dans le forum Bugs du Discord dans le quart d'heure, où les autres joueurs peuvent dire s'ils ont le même. Tu pourras suivre où il en est en revenant sur « Signaler un bug ».</p>
      <div class="row"><span class="grow"></span><button class="btn primary sm" data-act="closesheet">Fermer</button></div></div>`);
  }

  async function sendIdea() {
    readForm(); if (F.busy) return;
    F.busy = true; F.err = ""; repaint();
    const r = await window.IDEES.post(F.tag, F.title, F.body);
    F.busy = false;
    if (r.err) { F.err = r.err; return repaint(); }
    if (r.copied) return repaint();
    Object.assign(F, { tag: "", title: "", body: "", err: "" });
    X().openSheet(`<div class="bg-sheet">${window.IDEES.thanks(r.ok)}</div>`);
  }

  /* ---------- panel admin (onglet « Bugs ») ---------- */
  const REPO = "https://github.com/idlus/idlus.github.io/issues/";
  function adminHtml(list) {
    const rows = !list ? `<div class="empty">Chargement…</div>` : !list.length ? `<div class="empty">Aucun bug signalé pour l'instant.</div>` : list.map((b) => {
      const st = ST[b.status] || ST.nouveau; const lab = b.status === "corrige" && b.fixed_in ? `Corrigé (${h(b.fixed_in)})` : st[0];
      return `<div class="ln id-ln"><span class="grow"><b>n°${b.id}</b> <span class="st ${st[1] === "ok" ? "mod" : st[1]}">${lab}</span> <span class="xs muted">${h(b.page || "")}</span><br>
        <span class="small">${h(b.what)}</span>${b.expected ? `<br><span class="xs muted">Attendu : ${h(b.expected)}</span>` : ""}${b.note ? `<br><span class="xs muted">Note : ${h(b.note)}</span>` : ""}<br>
        <span class="xs muted">${h(b.pseudo)}${b.guest ? " (sans compte)" : ""} · ${h(b.version || "?")} · ${h(b.device || "")} · ${new Date(b.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
        <span class="acts">${b.issue ? `<a class="btn sm" href="${REPO}${+b.issue}" target="_blank" rel="noopener">Ticket #${+b.issue}</a>` : ""}</span></div>`;
    }).join("");
    return `<div class="box"><h2>Bugs signalés par les joueurs</h2><p class="small muted">Chaque signalement devient un ticket GitHub (sans pseudo) dans le quart d'heure, que Claude reprend pour corriger le bug. Quand le ticket est fermé, le joueur voit « Corrigé dans la … » dans le jeu. Pour classer un signalement « pas un bug », mets l'étiquette pas-un-bug sur le ticket et ferme-le (ou dis-le à Claude).</p>${rows}</div>`;
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    if (a === "bg-send") { send(); return; }
    if (a === "bg-mode") { readForm(); F.mode = t.dataset.v === "idee" ? "idee" : "bug"; F.err = ""; repaint(); return; }
    if (a === "bg-tag") { readForm(); F.tag = F.tag === t.dataset.v ? "" : t.dataset.v; F.err = ""; repaint(); return; }
    if (a === "bg-idea") { sendIdea(); return; }
  });
  document.addEventListener("input", (ev) => {
    if (!ev.target) return;
    if (ev.target.id === "bgBody") { const c = $("#bgICnt"); if (c) c.textContent = `${ev.target.value.length} / ${window.IDEES.MAXB}`; return; }
    if (ev.target.id !== "bgWhat") return;
    const c = $("#bgCnt"); if (c) c.textContent = `${ev.target.value.length} / ${MAXW}`;
  });

  window.BUGS = { open, adminHtml };
})();
