/* ============================================================================
   CODES CADEAUX — Idlus (0.1.26, bêta)
   Les codes sont créés par Mathis dans le panel admin (onglet « Codes cadeaux ») et gardés par le
   serveur (supabase/codes.sql) : le jeu ne les connaît pas, il demande seulement à gift_redeem si un
   code est valable et reçoit alors ses récompenses. Les anciens codes IDLUS-… restent vérifiés sur place.
   Lien partageable : …/beta/?code=HALLOWEEN26 ouvre les options avec le code déjà rempli.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA, ON = window.ONLINE;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (c) => String(c || "").toUpperCase().replace(/\s+/g, "");
  const OK = /^[A-Z0-9]{4,20}$/;

  /* ---------- côté joueur ---------- */
  async function redeem(S, raw) {
    const code = String(raw || "").trim();
    if (!code) return { err: "Tape un code d'abord." };
    if (/^IDLUS-/i.test(code)) return E.redeemGift(S, code);
    const c = norm(code);
    if (!OK.test(c)) return { err: "Ce code n'existe pas." };
    S.gifts = S.gifts || {};
    if (S.gifts["srv:" + c]) return { err: "Ce code a déjà été utilisé sur cette partie." };
    if (!ON || !ON.enabled || !ON.db()) return { err: "Les codes cadeaux ont besoin d'Internet. Réessaie une fois connecté." };
    if (!S.gid) S.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); // identifiant de la partie pour les joueurs sans compte
    const r = await ON.rpc("gift_redeem", { p_code: c, p_guest: ON.user ? null : S.gid });
    if (r.err) return { err: /fetch|connexion|network/i.test(r.err) ? "Pas de connexion au serveur. Réessaie dans un moment." : "Impossible de vérifier ce code pour le moment." };
    const d = r.data || {};
    if (d.err) return { err: d.err };
    // 1.0.6.3 : la partie a pu être remplacée pendant l'attente (partie en ligne rechargée) : on donne à celle affichée
    const cur = (window.DX && window.DX.S) || S;
    return E.giveGift(cur, Object.assign({}, d.reward || {}, { id: "srv:" + c, m: d.msg || "" }));
  }

  /* 1.0.6.3 : au chargement, on demande au serveur les codes déjà utilisés par ce compte (ou cette partie sans
     compte) et on redonne ceux dont la partie n'a pas gardé la trace : réponse perdue en route, autre onglet ou
     autre appareil qui a écrasé la sauvegarde… Une fois par compte et par chargement de la page. */
  const recovered = {};
  async function recover() {
    const S = window.DX && window.DX.S;
    if (!S || !ON || !ON.enabled || !ON.db()) return;
    if (!($("#nav") && $("#nav").innerHTML) || ($("#sheet") && $("#sheet").innerHTML)) return; // partie pas encore affichée, ou choix de partie en cours
    if (ON.user ? ON.state !== "ok" : !S.gid) return;
    const who = ON.user ? ON.user.id : "g:" + S.gid;
    if (recovered[who]) return; recovered[who] = 1;
    const r = await ON.rpc("gift_mine", { p_guest: ON.user ? null : S.gid });
    if (r.err || !Array.isArray(r.data)) { recovered[who] = 0; return; } // on réessaiera plus tard
    const cur = window.DX.S; if (!cur || cur !== S) { recovered[who] = 0; return; }
    cur.gifts = cur.gifts || {}; const got = [];
    r.data.forEach((x) => { if (!x || !x.code || cur.gifts["srv:" + x.code]) return; E.giveGift(cur, Object.assign({}, x.reward || {}, { id: "srv:" + x.code, m: x.msg || "" })); got.push(x.code); });
    if (got.length) { X().markDirty(); X().render(); X().toast(`Récompenses du code ${got.join(", ")} récupérées.`); }
  }
  setInterval(() => { recover().catch(() => {}); }, 5000);

  /* Lien partageable ?code=… : on retire le code de l'adresse, on le garde le temps d'une connexion,
     puis on ouvre les options (onglet Jeu) avec le code rempli dès que la partie est affichée. */
  const PK = "idlus-code-lien";
  try {
    const m = /[?&]code=([A-Za-z0-9-_]{4,400})/.exec(location.search);
    if (m) {
      sessionStorage.setItem(PK, m[1]);
      const q = location.search.replace(/([?&])code=[^&]*&?/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    }
  } catch (e) {}
  let calm = 0;
  const waiter = setInterval(() => {
    let code = null; try { code = sessionStorage.getItem(PK); } catch (e) {}
    if (!code) { clearInterval(waiter); return; }
    const ready = window.DX && window.DX.S && $("#nav") && $("#nav").innerHTML && !($("#sheet") && $("#sheet").innerHTML);
    calm = ready ? calm + 1 : 0;
    if (calm < 3) return;
    clearInterval(waiter); try { sessionStorage.removeItem(PK); } catch (e) {}
    window.DX.ui.giftCode = code; X().options("jeu"); setTimeout(() => { const i = $("#giftCode"); if (i) i.scrollIntoView({ block: "center" }); }, 50);
    X().toast("Code cadeau rempli : appuie sur « Utiliser ».");
  }, 600);

  /* ---------- panel admin (onglet « Codes cadeaux », Mathis seulement) ---------- */
  const TYPES = [["k", "Kamas"], ["r", "Ressource"], ["c", "Consommable"], ["i", "Objet"], ["t", "Titre"], ["o", "Ornement"], ["s", "Heures de sablier"]];
  const F = { code: "", rows: [{ t: "k", n: "", q: "" }], max: "", end: "", msg: "", acc: false, ann: false, pub: null, users: null };
  const consByName = () => { const o = {}; for (const id in D.CONSUMABLES) o[D.CONSUMABLES[id].name.toLowerCase()] = id; return o; };
  const itemByName = () => { const o = {}; for (const id in D.ITEMS) { const k = D.ITEMS[id].name.toLowerCase(); if (!o[k]) o[k] = id; } return o; };
  /* 1.0.4.8 : liste de choix maison (la liste du navigateur se refermait dès que la page bougeait un peu) */
  const NAMES = {}; const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const names = (k) => NAMES[k] || (NAMES[k] = k === "r" ? Object.keys(D.RES).sort() : k === "c" ? Object.values(D.CONSUMABLES).map((c) => c.name) : [...new Set(Object.keys(D.ITEMS).filter((id) => !/^trophee_/.test(id)).map((id) => D.ITEMS[id].name))].sort());
  const SUG = { inp: null, list: [], on: -1 };
  function sugShow(inp) {
    const box = inp.parentNode.querySelector(".gc-sug"); if (!box) return;
    const q = fold(inp.value.trim()); const all = names(inp.dataset.k);
    const L = q ? all.filter((n) => fold(n).startsWith(q)).concat(all.filter((n) => !fold(n).startsWith(q) && fold(n).includes(q))) : all;
    SUG.inp = inp; SUG.list = L.slice(0, 40); SUG.on = Math.min(SUG.on, SUG.list.length - 1);
    if (!SUG.list.length || (SUG.list.length === 1 && fold(SUG.list[0]) === q)) { box.hidden = true; return; }
    box.innerHTML = SUG.list.map((n, j) => `<button type="button" class="gc-opt${j === SUG.on ? " on" : ""}" data-act="gc-pick" data-i="${inp.dataset.i}" data-v="${h(n)}" tabindex="-1">${h(n)}</button>`).join("") + (L.length > 40 ? `<span class="xs muted">Tape la suite du nom pour voir les ${L.length - 40} autres.</span>` : "");
    box.hidden = false; const o = box.querySelector(".gc-opt.on"); if (o) o.scrollIntoView({ block: "nearest" });
  }
  function sugHide() { document.querySelectorAll(".gc-sug").forEach((b) => (b.hidden = true)); SUG.inp = null; SUG.on = -1; }
  function pick(i, v) {
    const inp = $(`#gcN${i}`); if (!inp) return; inp.value = v; sugHide(); readForm(); preview();
    const q = $(`#gcQ${i}`); if (q) { q.focus(); q.select(); }
  }

  /* Relit le formulaire avant chaque nouvel affichage, pour ne rien perdre de ce qui est tapé. */
  function readForm() {
    if (!$("#gcCode")) return;
    F.code = $("#gcCode").value; F.max = $("#gcMax").value; F.end = $("#gcEnd").value; F.msg = $("#gcMsg").value;
    F.acc = $("#gcAcc").checked; F.ann = $("#gcAnn").checked;
    F.rows.forEach((r, i) => { const t = $(`#gcT${i}`), n = $(`#gcN${i}`), q = $(`#gcQ${i}`); if (t) r.t = t.value; if (n) r.n = n.value; if (q) r.q = q.value; });
  }
  /* Transforme les lignes en récompense ; renvoie { reward } ou { err }. */
  function buildReward() {
    const w = {}; const cb = consByName(), ib = itemByName();
    for (const r of F.rows) {
      const q = Math.round(+r.q) || 0, n = String(r.n || "").trim();
      if (r.t === "k") { if (q > 0) w.k = (w.k || 0) + q; continue; }
      if (r.t === "s") { if (q > 0) w.s = Math.min(24, (w.s || 0) + q); continue; }
      if (r.t === "t") { if (n) w.t = n.slice(0, 40); continue; }
      if (r.t === "o") { if (n && E.ORN[n]) w.o = n; continue; }
      if (!n) continue;
      if (q < 1) return { err: `Indique une quantité pour « ${n} ».` };
      if (r.t === "r") { const k = Object.keys(D.RES).find((x) => x.toLowerCase() === n.toLowerCase()); if (!k) return { err: `Ressource inconnue : ${n}` }; (w.r = w.r || []).push([k, q]); }
      if (r.t === "c") { const id = cb[n.toLowerCase()] || (D.CONSUMABLES[n] ? n : null); if (!id) return { err: `Consommable inconnu : ${n}` }; (w.c = w.c || []).push([id, q]); }
      if (r.t === "i") { const id = ib[n.toLowerCase()] || (D.ITEMS[n] ? n : null); if (!id) return { err: `Objet inconnu : ${n}` }; (w.i = w.i || []).push([id, Math.min(10, q)]); }
    }
    if (!Object.keys(w).length) return { err: "Ajoute au moins une récompense." };
    return { reward: w };
  }
  const endTxt = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "sans fin");

  function rowHtml(r, i) {
    const sel = `<select id="gcT${i}" data-gc="type" data-i="${i}" aria-label="Type de récompense">${TYPES.map(([k, n]) => `<option value="${k}" ${k === r.t ? "selected" : ""}>${n}</option>`).join("")}</select>`;
    const qty = (ph) => `<input type="number" id="gcQ${i}" min="1" value="${h(r.q)}" placeholder="${ph}" aria-label="Quantité">`;
    let mid = "", q = "";
    if (r.t === "k") q = `<input type="number" id="gcQ${i}" min="1" step="1000" value="${h(r.q)}" placeholder="50000" aria-label="Kamas" style="grid-column:span 2">`;
    else if (r.t === "s") q = `<input type="number" id="gcQ${i}" min="1" max="24" value="${h(r.q)}" placeholder="3" aria-label="Heures de sablier" style="grid-column:span 2">`;
    else if (r.t === "t") mid = `<input type="text" id="gcN${i}" maxlength="40" value="${h(r.n)}" placeholder="Citrouille d'Amakna" aria-label="Titre" style="grid-column:span 2">`;
    else if (r.t === "o") mid = `<select id="gcN${i}" aria-label="Ornement" style="grid-column:span 2"><option value="">Choisir…</option>${Object.keys(E.ORN).map((k) => `<option value="${k}" ${k === r.n ? "selected" : ""}>${h(E.ORN[k].name(null))}</option>`).join("")}</select>`;
    else { mid = `<span class="gc-ac"><input type="text" id="gcN${i}" data-gc="name" data-k="${r.t}" data-i="${i}" autocomplete="off" value="${h(r.n)}" placeholder="${r.t === "r" ? "Blé" : r.t === "c" ? "Coffre" : "Nom de l'objet"}" aria-label="Nom"><span class="gc-sug" hidden></span></span>`; q = qty(r.t === "i" ? "1 (max 10)" : "1"); }
    return `<div class="gc-rw">${sel}${mid}${q}<button class="btn sm" data-act="gc-del" data-i="${i}" aria-label="Retirer" ${F.rows.length < 2 ? "disabled" : ""}>×</button></div>`;
  }

  function adminHtml(list) {
    const pre = buildReward(); const c = norm(F.code);
    const left = `<div class="box gc-form"><h2>Nouveau code</h2>
      <label class="gc-f"><b>Le code</b><span class="row"><input type="text" id="gcCode" maxlength="20" value="${h(F.code)}" placeholder="HALLOWEEN26" autocomplete="off" style="flex:1;min-width:0;text-transform:uppercase"><button class="btn sm" data-act="gc-rand">Au hasard</button></span>
        <small>4 à 20 lettres ou chiffres, sans espace. Majuscules et minuscules comptent pareil.</small></label>
      <div class="gc-f"><b>Récompenses</b>${F.rows.map(rowHtml).join("")}<div><button class="btn sm" data-act="gc-add">+ Ajouter une récompense</button></div></div>
      <div class="gc-two"><label class="gc-f"><b>Utilisations au total</b><input type="number" id="gcMax" min="1" value="${h(F.max)}" placeholder="illimité"><small>Vide = illimité</small></label>
        <label class="gc-f"><b>Valable jusqu'au</b><input type="date" id="gcEnd" value="${h(F.end)}"><small>Vide = sans fin. Inclus, heure de Paris.</small></label></div>
      <label class="gc-f"><b>Message affiché au joueur</b><input type="text" id="gcMsg" maxlength="120" value="${h(F.msg)}" placeholder="Merci de jouer à Idlus !"></label>
      <label class="row small"><input type="checkbox" id="gcAcc" ${F.acc ? "checked" : ""}> Réservé aux joueurs avec un compte</label>
      <label class="row small"><input type="checkbox" id="gcAnn" ${F.ann ? "checked" : ""}> Annoncer le code dans le chat du jeu</label>
      <div class="row"><button class="btn primary" data-act="gc-create">Créer le code</button><button class="btn" data-act="gc-pub" data-tip="Le jeu public n'a pas encore de serveur : il garde les anciens codes IDLUS-…">Code pour le jeu public</button></div>
      ${F.pub ? `<div class="gc-pub"><b class="small">Code pour le jeu public</b><span class="xs muted">Même contenu, vérifié par le jeu lui-même. Il marche aussi sur la bêta. Pas de limite d'utilisations.</span><textarea id="gcPubTxt" readonly>${h(F.pub)}</textarea><div><button class="btn sm" data-act="gc-copy" data-v="pub">Copier</button></div></div>` : ""}
      </div>`;
    const preview = `<div class="box"><h2>Ce que verra le joueur</h2><div class="gc-card"><span class="gc-code">${h(c || "TONCODE")}</span>
      <span>${pre.reward ? h(E.giftText(pre.reward)) : `<span class="muted">${h(pre.err)}</span>`}</span>${F.msg ? `<span class="muted small">${h(F.msg)}</span>` : ""}</div>
      ${OK.test(c) ? `<span class="xs muted">Lien à partager : <b>${h(link(c))}</b></span>` : ""}</div>`;
    const rows = !list ? `<div class="empty">Chargement…</div>` : !list.length ? `<div class="empty">Aucun code pour l'instant.</div>` : list.map((g) => {
      const st = !g.active ? `<span class="st m">Désactivé</span>` : g.expired || (g.max_uses && g.uses >= g.max_uses) ? `<span class="st v">Terminé</span>` : `<span class="st mod">Actif</span>`;
      const pct = g.max_uses ? Math.min(100, Math.round((g.uses / g.max_uses) * 100)) : 0;
      return `<div class="ln gc-ln"><span class="gc-main"><b>${h(g.code)}</b> ${st}${g.accounts_only ? ` <span class="st v">comptes</span>` : ""}<br><span class="xs muted">${h(E.giftText(g.reward || {}))}</span></span>
        <span class="gc-use"><span><b>${g.uses}</b> / ${g.max_uses || "illimité"}</span>${g.max_uses ? `<span class="gc-bar"><i style="width:${pct}%"></i></span>` : ""}<span class="xs muted">${endTxt(g.ends)}</span></span>
        <span class="acts"><button class="btn sm" data-act="gc-copy" data-v="${h(g.code)}">Copier le lien</button><button class="btn sm" data-act="gc-users" data-v="${h(g.code)}">Joueurs</button><button class="btn sm${g.active ? " danger" : ""}" data-act="gc-set" data-v="${h(g.code)}" data-on="${g.active ? 0 : 1}">${g.active ? "Désactiver" : "Réactiver"}</button></span>
        ${F.users && F.users.code === g.code ? `<div class="gc-users">${F.users.data ? `${F.users.data.players.length ? F.users.data.players.map((p) => `<span>${h(p.pseudo)}</span>`).join("") : `<span class="muted">Aucun joueur avec compte.</span>`}${F.users.data.guests ? `<span class="muted">+ ${F.users.data.guests} sans compte</span>` : ""}` : `<span class="muted">Chargement…</span>`}</div>` : ""}</div>`;
    }).join("");
    return `<div class="two">${left}<div class="stack" style="gap:12px">${preview}<div class="box"><h2>Codes créés</h2>${rows}</div></div></div>`;
  }
  const link = (c) => `${location.origin}${location.pathname}?code=${c}`;
  const repaint = () => { if (window.CHAT && window.CHAT.repaintAdmin) window.CHAT.repaintAdmin(); }; // 1.0.4.8 : redessine sans recharger depuis le serveur
  const reload = () => { const b = $('[data-act="adm-reload"]'); if (b) b.click(); };
  const copy = (txt, ok) => { const done = () => X().toast(ok); try { navigator.clipboard.writeText(txt).then(done, () => X().toast(txt)); } catch (e) { X().toast(txt); } };

  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^gc-/.test(t.dataset.act)) return;
    const a = t.dataset.act, d = t.dataset; readForm();
    switch (a) {
      case "gc-pick": pick(+d.i, d.v); return;
      case "gc-add": F.rows.push({ t: "c", n: "", q: "1" }); repaint(); return;
      case "gc-del": F.rows.splice(+d.i, 1); if (!F.rows.length) F.rows.push({ t: "k", n: "", q: "" }); repaint(); return;
      case "gc-rand": { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 10; i++) s += A[Math.floor(Math.random() * A.length)]; F.code = s; repaint(); return; }
      case "gc-pub": {
        const r = buildReward(); if (r.err) return X().toast(r.err);
        const data = Object.assign({ id: (norm(F.code) || "code").toLowerCase() + "-" + Date.now().toString(36) }, r.reward);
        if (F.end) data.e = F.end; if (F.msg.trim()) data.m = F.msg.trim().slice(0, 120);
        F.pub = E.makeGift(data); repaint(); return;
      }
      case "gc-create": {
        const c = norm(F.code); if (!OK.test(c)) return X().toast("Le code doit faire 4 à 20 lettres ou chiffres, sans espace ni accent.");
        const r = buildReward(); if (r.err) return X().toast(r.err);
        const max = F.max === "" ? null : Math.round(+F.max); if (max !== null && !(max >= 1)) return X().toast("Le nombre d'utilisations doit être au moins 1.");
        if (F.busy) return; F.busy = true;
        const res = await ON.rpc("adm_gift_create", { p_code: c, p_reward: r.reward, p_max: max, p_ends: F.end || null, p_accounts: F.acc, p_msg: F.msg.trim(), p_announce: F.ann });
        F.busy = false;
        if (res.err || res.data) return X().toast(res.err || res.data);
        X().toast(`Code ${c} créé.`); Object.assign(F, { code: "", rows: [{ t: "k", n: "", q: "" }], max: "", end: "", msg: "", acc: false, ann: false, pub: null }); const f = $(".gc-form"); if (f) f.remove(); reload(); return;
      }
      case "gc-copy": if (d.v === "pub") copy(F.pub, "Code copié."); else copy(link(d.v), "Lien copié : colle-le sur le Discord."); return;
      case "gc-set": { const r = await ON.rpc("adm_gift_set", { p_code: d.v, p_active: d.on === "1" }); X().toast(r.err || (d.on === "1" ? "Code réactivé." : "Code désactivé.")); reload(); return; }
      case "gc-users": {
        if (F.users && F.users.code === d.v) { F.users = null; repaint(); return; }
        F.users = { code: d.v, data: null }; repaint();
        const r = await ON.rpc("adm_gift_users", { p_code: d.v }); if (r.err) { X().toast(r.err); F.users = null; } else F.users.data = r.data; repaint(); return;
      }
    }
  });
  /* Changer le type d'une récompense redessine la ligne ; taper ailleurs met à jour l'aperçu. */
  document.addEventListener("change", (ev) => { if (ev.target && ev.target.dataset && ev.target.dataset.gc === "type") { readForm(); const r = F.rows[+ev.target.dataset.i]; r.n = ""; r.q = r.t === "k" ? "" : "1"; repaint(); } });
  const preview = () => {
    const p = buildReward(); const c = norm(F.code); const card = $(".gc-card");
    if (card) card.innerHTML = `<span class="gc-code">${h(c || "TONCODE")}</span><span>${p.reward ? h(E.giftText(p.reward)) : `<span class="muted">${h(p.err)}</span>`}</span>${F.msg ? `<span class="muted small">${h(F.msg)}</span>` : ""}`;
  };
  let tm = null;
  document.addEventListener("input", (ev) => { if (!ev.target || !ev.target.closest || !ev.target.closest(".gc-form")) return;
    if (ev.target.dataset.gc === "name") { SUG.on = -1; sugShow(ev.target); }
    clearTimeout(tm); tm = setTimeout(() => { readForm(); preview(); }, 250); });
  document.addEventListener("focusin", (ev) => { if (ev.target && ev.target.dataset && ev.target.dataset.gc === "name") sugShow(ev.target); });
  document.addEventListener("focusout", (ev) => { if (ev.target && ev.target.dataset && ev.target.dataset.gc === "name") setTimeout(() => { if (document.activeElement !== SUG.inp) sugHide(); }, 150); });
  document.addEventListener("mousedown", (ev) => { if (ev.target.closest && ev.target.closest(".gc-sug")) ev.preventDefault(); }); // le champ garde la main pendant le choix
  document.addEventListener("keydown", (ev) => {
    const t = ev.target; if (!t || !t.dataset || t.dataset.gc !== "name") return;
    const box = t.parentNode.querySelector(".gc-sug"); const open = box && !box.hidden;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); if (!open) { sugShow(t); return; } const n = SUG.list.length; SUG.on = ev.key === "ArrowDown" ? (SUG.on + 1) % n : (SUG.on - 1 + n) % n; sugShow(t); }
    else if (ev.key === "Enter" && open && SUG.on >= 0) { ev.preventDefault(); pick(+t.dataset.i, SUG.list[SUG.on]); }
    else if (ev.key === "Escape" && open) { ev.preventDefault(); sugHide(); }
  });

  window.GIFTS = { redeem, adminHtml, readForm };
})();
