/* ============================================================================
   FICHES JOUEURS — Idlus (0.1.52.1)
   Panel admin › « Fiches joueurs », réservé à Mathis : la liste de tous les comptes, et pour chacun
   une fiche détaillée. Le serveur (supabase/fiches.sql, adm_roster et adm_player) envoie le compte,
   la partie en ligne complète et ce qu'il sait (guilde, Kolizéum, Hôtel de vente, boss, codes, chat,
   modération) ; le jeu lit la partie ici même pour la détailler (héros, équipement, progression).
   Rien n'est modifié : les sanctions restent dans l'onglet « Joueurs ».
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA, ON = window.ONLINE;
  const X = () => window.DX.social;
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const F = { q: "", sort: "envoi", list: null, sel: null, data: null, S: null, key: null };

  const nb = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
  const kam = (n) => `${nb(n)} ${X().IC("kamas", "kk")}`;
  const when = (t) => { if (!t) return "—"; const s = (Date.now() - new Date(t)) / 1000; return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };
  const date = (t) => (t ? new Date(t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const dur = (sec) => { sec = Math.max(0, Math.round(+sec || 0)); const hh = Math.floor(sec / 3600), mm = Math.round((sec % 3600) / 60); return hh ? `${hh} h ${String(mm).padStart(2, "0")}` : `${mm} min`; };
  const clsName = (c) => ((D.CLASSES || {})[c] || {}).name || "—";
  const cell = (k, v) => `<div><small>${k}</small>${v}</div>`;
  const RANKS = ["Meneur", "Bras droit", "Membre", "Recrue"];

  /* ---------- chargement ---------- */
  async function load() {
    const r = await ON.rpc("adm_roster", { p_q: F.q, p_sort: F.sort });
    if (r.err) X().toast(r.err); else F.list = r.data || [];
    if (F.sel) await loadOne(F.sel);
  }
  async function loadOne(id) {
    const r = await ON.rpc("adm_player", { p_user: id });
    if (r.err) { X().toast(r.err); return; }
    F.data = r.data || null;
    const sv = F.data && F.data.save, key = sv ? `${id}|${sv.at}` : null;
    if (key !== F.key) { F.key = key; F.S = null; if (sv && sv.data) { try { F.S = JSON.parse(sv.data); } catch (e) { F.S = null; } } }
  }

  /* ---------- ce que la partie raconte ---------- */
  function readSave(S) {
    const items = S.items || {}, chars = Array.isArray(S.chars) ? S.chars : [];
    const team = chars.filter((c) => c.inTeam && !c.job).slice(0, 8).map((c) => c.id);
    const gear = (c) => Object.values(c.equip || {}).map((uid) => items[uid]).filter(Boolean).map((it) => ({ tpl: it.tpl, T: D.ITEMS[it.tpl] })).filter((g) => g.T)
      .sort((a, b) => (b.T.lvl || 0) - (a.T.lvl || 0));
    const heroes = chars.map((c) => ({ c, team: team.includes(c.id), gear: gear(c) })).sort((a, b) => (b.team - a.team) || ((b.c.ren || 0) - (a.c.ren || 0)) || ((b.c.lvl || 0) - (a.c.lvl || 0)));
    const subs = (D.ZONES || []).flatMap((z) => z.subs || []);
    let subsOpen = 0; try { subsOpen = subs.filter((s) => E.subUnlocked(S, s.id)).length; } catch (e) {}
    const st = S.stasis || {}; const dgs = Object.keys(st).filter((d) => (st[d].max || 0) > 0 && D.DUNGEONS[d]);
    const stMax = dgs.reduce((m, d) => Math.max(m, st[d].max || 0), 0);
    const bossKills = Object.keys((S.progress && S.progress.bossKills) || {}).filter((d) => D.DUNGEONS[d]).length;
    const sum = (o) => Object.values(o || {}).reduce((a, n) => a + (+n || 0), 0);
    const dofus = (E.DOFUS_ORDER || []).filter((id) => Object.values(items).some((it) => it.tpl === "dofus_" + id)).map((id) => (E.DOFUS[id] || {}).name || id);
    const G = S.songe || {}; const best = G.best && E.SG_INT && E.SG_INT[G.best.ii];
    let quest = "—"; try { const q = E.questStep(S); const n = (S.quest && S.quest.step) || 0; quest = q ? `${h(q.title)} (étape ${n + 1})` : `terminée (${n} étapes)`; } catch (e) {}
    let ach = 0, achTot = (E.ACH || []).length, pts = 0; try { ach = Object.keys(S.ach || {}).filter((k) => S.ach[k]).length; pts = E.achPoints ? E.achPoints(S) : 0; } catch (e) {}
    const jobs = Object.entries(S.jobs || {}).map(([k, j]) => [((D.GATHER_JOBS || {})[k] || {}).name || k, j.lvl || 1])
      .concat(Object.entries(S.crafts || {}).map(([k, j]) => [((D.CRAFT_JOBS || {})[k] || {}).name || k, j.lvl || 1]))
      .concat(S.fmJob ? [["Forgemage", S.fmJob.lvl || 1]] : []).sort((a, b) => b[1] - a[1]);
    const al = S.align && S.align.side ? `${S.align.side === "bonta" ? "Bonta" : S.align.side === "brakmar" ? "Brâkmar" : h(S.align.side)} niv. ${S.align.lvl || 0}` : "aucun";
    return {
      heroes, kamas: S.kamas || 0, playtime: (S.stats && S.stats.playtime) || 0, fights: (S.stats && S.stats.fights) || 0, wins: (S.stats && S.stats.wins) || 0, created: S.created,
      items: Object.keys(items).length, res: sum(S.res), resN: Object.keys(S.res || {}).length, runes: sum(S.runes), cons: sum(S.cons),
      pets: Object.keys(S.pets || {}).length, mounts: Object.keys(S.mounts || {}).length, idols: Object.keys((S.idols && S.idols.own) || {}).length,
      sab: S.sablier ? (S.sablier.open ? `${Math.floor((S.sablier.r || 0) / 3600)} h ${String(Math.floor(((S.sablier.r || 0) % 3600) / 60)).padStart(2, "0")} en réserve` : "pas encore débloqué") : "—",
      kz: (S.tokens && S.tokens[E.KOLI_CUR || "kolizetons"]) || 0,
      subsOpen, subsTot: subs.length, dgs: dgs.length, dgTot: Object.keys(D.DUNGEONS || {}).length, stMax, bossKills,
      dofus, souls: E.soulCount ? (() => { try { return E.soulCount(S); } catch (e) { return 0; } })() : 0,
      songe: best ? `${h(best.name)}, ${G.best.waves} vagues` : "pas encore", songeRuns: G.runs || 0, bribes: G.br || 0,
      quest, ach, achTot, pts, jobs, al, journal: (S.journal || []).slice(0, 12), sub: S.sub, dungeon: S.dungeon, gv: S.v,
    };
  }

  /* ---------- affichage ---------- */
  function tags(x) {
    const mute = x.mute_until && new Date(x.mute_until) > Date.now();
    return `${x.is_admin ? `<span class="st mod">Admin</span>` : x.is_mod ? `<span class="st mod">Modérateur</span>` : ""}${x.suspended_at ? `<span class="st m">Suspendu</span>` : ""}${x.banned ? `<span class="st m">Banni du chat</span>` : mute ? `<span class="st m">Muet</span>` : ""}${x.flagged ? `<span class="st v">En vérification</span>` : ""}`;
  }
  function rosterHtml() {
    const L = F.list || [];
    return `<div class="box fj-roster"><div class="srch"><input id="fjQ" value="${h(F.q)}" placeholder="Chercher un pseudo" autocomplete="off"><button class="btn" data-act="fj-search">Chercher</button></div>
      <div class="row small"><span class="muted">Trier :</span><select id="fjSort" data-act="fj-sortsel">${[["envoi", "dernière partie envoyée"], ["niveau", "niveau d'équipe"], ["temps", "temps de jeu"], ["creation", "compte le plus récent"]].map(([k, n]) => `<option value="${k}" ${F.sort === k ? "selected" : ""}>${n}</option>`).join("")}</select><span class="muted" style="margin-left:auto">${L.length} compte${L.length > 1 ? "s" : ""}</span></div>
      <div class="fj-list">${F.list === null ? `<div class="ln muted">Chargement…</div>` : L.map((x) => `<button class="ln lnb${F.sel === x.id ? " on" : ""}" data-act="fj-sel" data-id="${x.id}">${X().cmed(x.cls)}<span class="fj-who"><b>${h(x.pseudo)}</b>${tags(x)}<span class="xs muted">${x.level ? `niv. d'équipe ${x.level}` : "aucune partie classée"}${x.guild ? ` · ${h(x.guild)}` : ""}</span></span><span class="t">${when(x.last_save)}</span></button>`).join("") || `<div class="ln muted">Aucun joueur trouvé.</div>`}</div></div>`;
  }
  function ficheHtml() {
    const P = F.data;
    if (!P) return `<div class="box"><div class="empty">Choisis un joueur dans la liste pour voir sa fiche.</div></div>`;
    const a = P.acc || {}, sv = P.save, l = P.ladder || {}, g = P.guild, k = P.koli, hd = P.hdv || {}, b = P.boss || {}, ch = P.chat || {}, m = P.mod || {};
    const R = F.S && Array.isArray(F.S.chars) ? readSave(F.S) : null;
    const prov = (a.providers || []).filter(Boolean).map((p) => (p === "discord" ? "Discord" : p === "email" ? "e-mail" : p === "google" ? "Google" : h(p))).join(" + ") || "—";
    const mute = m.mute_until && new Date(m.mute_until) > Date.now();
    const statut = [a.suspended_at ? "compte suspendu" : "", m.banned ? "banni du chat" : mute ? `muet jusqu'à ${date(m.mute_until)}` : "", l.flagged ? `en vérification${l.flag_reason ? ` (${h(l.flag_reason)})` : ""}` : ""].filter(Boolean).join(", ") || "rien à signaler";
    const out = [];
    out.push(`<div class="box"><div class="row between"><div class="row">${X().cmed(l.main, l.main_lvl)}<h2>${h(P.pseudo)}</h2>${a.is_admin ? `<span class="st mod">Admin</span>` : a.is_mod ? `<span class="st mod">Modérateur</span>` : ""}</div>
        <div class="acts"><button class="btn sm fj-back" data-act="fj-back">Tous les joueurs</button><button class="btn sm" data-act="ch-prof" data-u="${P.id}">Profil public</button><button class="btn sm" data-act="adm-find" data-q="${h(P.pseudo)}">Sanctions</button>${sv ? `<button class="btn sm" data-act="fj-dl">Télécharger sa partie</button>` : ""}</div></div>
      <div class="fiche">${cell("Connexion", `${prov}${a.discord ? ` (${h(a.discord)})` : ""}`)}${cell("Compte créé", date(a.created_at))}${cell("Dernière connexion", when(a.last_login))}
        ${cell("Partie envoyée", sv ? `${when(sv.at)}` : "jamais")}${cell("Version · appareil", sv ? `${h(sv.version || "?")}${sv.device ? ` · ${h(sv.device)}` : ""}` : "—")}${cell("Statut", statut)}</div></div>`);
    if (!sv) out.push(`<div class="box"><div class="empty">Ce compte n'a encore jamais envoyé de partie : rien à détailler côté jeu.</div></div>`);
    else if (!R) out.push(`<div class="box"><div class="empty">La partie en ligne n'a pas pu être lue (${nb(sv.size)} caractères).</div></div>`);
    if (R) {
      out.push(`<div class="kpis"><div class="kpi"><b>${kam(R.kamas)}</b><span>kamas</span></div><div class="kpi"><b>${dur(R.playtime)}</b><span>temps de jeu</span></div><div class="kpi"><b>${l.level || "—"}</b><span>niveau d'équipe (classement)</span></div><div class="kpi"><b>${nb(R.wins)} / ${nb(R.fights)}</b><span>combats gagnés</span></div></div>`);
      out.push(`<div class="box"><h2>Héros (${R.heroes.length})</h2><div class="fj-heroes">${R.heroes.map(({ c, team, gear }) => `<details class="fj-hero"><summary>${X().cmed(c.cls, c.lvl, c.ren)}<span class="fj-who"><b>${h(c.name)}</b><span class="xs muted">${h(clsName(c.cls))} niv. ${c.lvl || 1}${c.ren ? ` · Renaissance ${c.ren}` : ""}${c.title ? ` · « ${h(c.title)} »` : ""}</span></span><span class="t">${team ? "équipe" : c.job ? "métier" : "réserve"} · ${gear.length} objet${gear.length > 1 ? "s" : ""}</span></summary>
          <div class="fj-gear">${gear.map((gi) => `<span data-act="ch-item" data-tpl="${h(gi.tpl)}"><img src="${X().itemImg(gi.tpl)}" alt="" loading="lazy">${h(gi.T.name)} <i>${gi.T.lvl || ""}</i></span>`).join("") || `<span class="muted">Rien d'équipé.</span>`}</div></details>`).join("")}</div></div>`);
      out.push(`<div class="two"><div class="box"><h2>Progression</h2><div class="fiche">${cell("Quête principale", R.quest)}${cell("Zones ouvertes", `${R.subsOpen} / ${R.subsTot}`)}${cell("Donjons finis", `${R.bossKills} / ${R.dgTot}`)}
          ${cell("Meilleure stasis", R.stMax ? `stasis ${R.stMax} (${R.dgs} donjon${R.dgs > 1 ? "s" : ""})` : "aucune")}${cell("Succès", `${R.ach} / ${R.achTot} · ${nb(R.pts)} pts`)}${cell("Album d'âmes", nb(R.souls))}
          ${cell("Songe infini", `${R.songe}${R.songeRuns ? ` · ${R.songeRuns} rêve${R.songeRuns > 1 ? "s" : ""}` : ""}`)}${cell("Alignement", R.al)}${cell("Dofus", R.dofus.length ? h(R.dofus.join(", ")) : "aucun")}</div></div>
        <div class="box"><h2>Inventaire</h2><div class="fiche">${cell("Équipements", nb(R.items))}${cell("Ressources", `${nb(R.res)} (${nb(R.resN)} sortes)`)}${cell("Runes", nb(R.runes))}${cell("Consommables", nb(R.cons))}
          ${cell("Familiers · montures", `${nb(R.pets)} · ${nb(R.mounts)}`)}${cell("Idoles", nb(R.idols))}${cell("Sablier", R.sab)}${cell("Kolizetons", nb(R.kz))}${cell("Bribes de rêve", nb(R.bribes))}</div></div></div>`);
      out.push(`<div class="box"><h2>Métiers</h2><div class="fj-jobs">${R.jobs.map(([n, v]) => `<span><b>${v}</b> ${h(n)}</span>`).join("")}</div></div>`);
    }
    out.push(`<div class="two"><div class="box"><h2>En ligne</h2><div class="fiche">
        ${cell("Guilde", g ? `${h(g.name)} (niv. ${g.lvl}) · ${RANKS[g.rank] || "membre"} · ${nb(g.given)} XP donnée` : "aucune")}
        ${cell("Kolizéum", k ? `cote ${k.cote} (meilleure ${k.best}) · ${k.win} V / ${k.loss} D cette semaine` : "jamais joué")}
        ${cell("Combats d'arène", k ? `${nb(k.fights)} en tout · défense ${k.dwin} V / ${k.dloss} D` : "—")}
        ${cell("Boss des mondes", b.wb_n ? `${nb(b.wb_n)} essai${b.wb_n > 1 ? "s" : ""} · ${nb(b.wb_pts)} points` : "aucun essai")}
        ${cell("Boss de guilde", b.gb_n ? `${nb(b.gb_n)} essai${b.gb_n > 1 ? "s" : ""} · ${nb(b.gb_pts)} points` : "aucun essai")}
        ${cell("Codes cadeaux", (P.gifts || []).length ? (P.gifts || []).map((x) => h(x.code)).join(", ") : "aucun")}</div></div>
      <div class="box"><h2>Hôtel de vente</h2><div class="fiche">${cell("En vente", `${nb(hd.open)} lot${hd.open > 1 ? "s" : ""} · ${kam(hd.open_k)}`)}${cell("Vendus", `${nb(hd.sold)} · ${kam(hd.sold_k)}`)}${cell("Achetés", `${nb(hd.bought)} · ${kam(hd.bought_k)}`)}
          ${cell("Ordres d'achat ouverts", nb(hd.orders))}${cell("Échanges conclus", nb(hd.trades))}</div>
        ${(hd.last || []).map((x) => `<div class="ln"><span class="st ${x.sold ? "v" : "mod"}">${x.sold ? "Vendu" : "Acheté"}</span>${x.qty > 1 ? `${nb(x.qty)} × ` : ""}${h(x.name || "?")}<span class="t">${kam(x.price)} · ${when(x.at)}</span></div>`).join("")}</div></div>`);
    out.push(`<div class="two"><div class="box"><h2>Chat et modération</h2><div class="fiche">${cell("Messages publics", `${nb(ch.pub)} (${nb(ch.pub7)} en 7 j)`)}${cell("Messages privés", nb(ch.priv))}${cell("Dernier message", when(ch.last))}
          ${cell("Signalé par", `${nb(m.reports)} joueur${m.reports > 1 ? "s" : ""}${m.reports_open ? ` (${m.reports_open} en attente)` : ""}`)}${cell("A signalé", nb(m.reported))}${cell("Idées envoyées", nb((P.ideas || []).length))}</div>
        ${(m.log || []).map((x) => `<div class="ln"><span class="t" style="margin:0;min-width:92px">${date(x.at)}</span>${h(x.txt)}</div>`).join("")}
        ${(P.ideas || []).slice(0, 5).map((x) => `<div class="ln"><span class="st mod">${h(x.tag)}</span>${h(x.title)}<span class="t">${when(x.at)}</span></div>`).join("")}</div>
      ${R ? `<div class="box"><h2>Journal de sa partie</h2>${R.journal.map((j) => `<div class="ln"><span class="t" style="margin:0;min-width:92px">${date(j.t)}</span>${h(j.txt)}</div>`).join("") || `<div class="ln muted">Vide.</div>`}</div>` : ""}</div>`);
    return out.join("");
  }
  function adminHtml() {
    return `<div class="fj${F.sel ? " has-sel" : ""}">${rosterHtml()}<div class="fj-main">${F.sel && !F.data ? `<div class="box"><div class="empty">Chargement…</div></div>` : ficheHtml()}</div></div>`;
  }

  /* ---------- clics ---------- */
  const paint = () => { if (window.CHAT && window.CHAT.repaintAdmin) window.CHAT.repaintAdmin(); };
  function download() {
    const sv = F.data && F.data.save; if (!sv) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([sv.data], { type: "application/json" }));
    a.download = `idlus-${F.data.pseudo}-${String(sv.at || "").slice(0, 10)}.json`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function open(id) { F.sel = id; F.data = null; paint(); await loadOne(id); paint(); const m = document.querySelector(".fj-main"); if (m && document.querySelector(".fj-roster") && !document.querySelector(".fj-roster").offsetParent) window.scrollTo(0, m.getBoundingClientRect().top + window.scrollY - 70); }
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^fj-/.test(t.dataset.act)) return;
    switch (t.dataset.act) {
      case "fj-sel": open(t.dataset.id); return;
      case "fj-back": F.sel = null; F.data = null; paint(); return;
      case "fj-search": F.q = (document.querySelector("#fjQ").value || "").trim(); await load(); paint(); return;
      case "fj-dl": download(); return;
    }
  });
  document.addEventListener("change", async (ev) => { if (ev.target && ev.target.id === "fjSort") { F.sort = ev.target.value; await load(); paint(); } });
  document.addEventListener("keydown", (ev) => { if (ev.target && ev.target.id === "fjQ" && ev.key === "Enter") { ev.preventDefault(); const b = document.querySelector('[data-act="fj-search"]'); if (b) b.click(); } }, true);

  window.FICHES = { load, adminHtml, readSave, select: (id) => { F.sel = id; F.data = null; } };
})();
