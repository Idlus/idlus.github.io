/* ============================================================================
   CHASSE AUX PERCEPTEURS — Idlus (multijoueur, suite de la Guerre des Percepteurs)
   Choix de Mathis : 1C (onglet « Chasse aux Percepteurs » de la guilde ET emblèmes sur la carte du Monde, reliés),
   2C (liste groupée par guilde), 3A (pas de chance de victoire affichée), 4A (pas de suivi), 5A (pas de limite par
   guilde), 6A revanche, 7A primes, 8A vétérans, 9A domination des régions, 10A Nuit des Percepteurs, 11B pas de pacte.
   Règles et chiffres : js/gboss.js (E.HUNT) ; serveur : supabase/gboss.sql (perco_map, guild_bounty, rd_*).
   La liste vient de perco_map (relue au plus une fois par minute, et toutes les 10 min pour la domination).
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const E = window.ENGINE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const GU = () => window.GUILD;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const fk = (n) => `${fmt(Math.round(n || 0))} k`;
  const C = { map: null, at: 0, off: 0, loading: false, err: false, f: "all", sort: "ok", dom: {} };
  const now = () => Date.now() + (C.off || 0);
  const left = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d} j ${hh} h` : hh ? (mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`) : `${mm} min`; };
  const emb = (g, sz) => `<span class="gemb" style="--gc:${h(g.col || "#8cc63f")};--gs:${sz}px"><img src="assets/ui/${h(g.ic || "dofus")}.webp" alt=""></span>`;
  const chip = (g, extra) => `<span class="pc-chip" style="--gc:${h(g.col || "#8cc63f")}"><img src="assets/ui/${h(g.ic || "dofus")}.webp" alt="">${h(g.name)}${extra || ""}</span>`;
  const resSum = (r) => Object.values(r || {}).reduce((a, b) => a + b, 0);
  const myGid = () => { const s = S(); return (s && s.guild && s.guild.id) || null; };
  const ex = () => (GU() && GU().G.ex) || null;
  const officer = () => { const G = GU() && GU().G; return !!(G && G.me && G.me.g && G.me.rank <= 1); };

  /* ---------- données ---------- */
  async function load(force) {
    if (!ON.user || C.loading) return;
    if (!force && C.map && Date.now() - C.at < 60000) return;
    C.loading = true;
    const r = await ON.rpc("perco_map");
    C.loading = false; C.at = Date.now();
    if (r.err || !r.data || r.data.err) { C.err = true; return; }
    C.err = false; C.map = r.data; C.off = Date.parse(r.data.now) - Date.now();
    C.dom = E.huntDomination(r.data.percos || []);
    const ui = window.DX.ui;
    if (ui.tab === "guild" && GU()) GU().paint(true);
    else if (ui.tab === "world" && !document.querySelector("#sheet .sheet")) window.DX.render();
  }
  const guildOf = (p) => (C.map && C.map.guilds && C.map.guilds[p.gid]) || { name: "?", ic: "dofus", col: "#8cc63f", lvl: 1, rob: 0 };
  const all = () => (C.map ? C.map.percos || [] : []);
  /* Percepteurs de cette zone de la carte (et de ses donjons) */
  const at = (sid) => all().filter((p) => p.sid === sid || (E.DUNGEON_SUB && E.DUNGEON_SUB[p.sid] === sid));
  const night = () => (C.map && C.map.nuit != null && Date.now() - C.at < 120000 ? !!C.map.nuit : E.huntNight(now()));
  const revOf = (gid) => ((ex() && ex().revenge) || []).find((v) => v.gid === gid && Date.parse(v.until) > now());
  const bounties = (p) => (p.bounty || []).filter((b) => b.gid !== myGid());
  const bountyK = (p) => bounties(p).reduce((a, b) => a + (+b.k || 0), 0);

  /* ---------- un Percepteur : attaquable ou pourquoi pas ---------- */
  function stateOf(p) {
    const g = guildOf(p); const t = now();
    if (p.gid === myGid()) return { ok: false, mine: true, html: `<span class="tag soft">ta guilde</span>` };
    if (!myGid()) return { ok: false, html: `<span class="xs muted">rejoins une guilde pour attaquer</span>` };
    if (window.ALLY && window.ALLY.allied(p.gid)) return { ok: false, html: `<span class="tag soft" data-tip="Les guildes d'une même alliance ne s'attaquent pas : aide plutôt à le défendre (Guilde › Alliance).">guilde alliée</span>` }; // Alliances (9A)
    if (g.young && Date.parse(g.young) > t) return { ok: false, html: `<span class="gx-shield">🛡 jeune guilde ${left(Date.parse(g.young) - t)}</span>` };
    if (p.raid) return { ok: false, html: `<span class="tag warn">attaqué par ${h(p.raid)}</span>` };
    if (p.shield && Date.parse(p.shield) > t) return { ok: false, html: `<span class="gx-shield">🛡 ${left(Date.parse(p.shield) - t)}</span>` };
    if (p.monsters) return { ok: false, html: `<span class="tag soft">monstres en cours</span>` };
    const v = revOf(p.gid);
    if (v && !v.used) return { ok: true, rev: true, html: `<button class="btn sm primary pc-rev" data-act="g-atk" data-g="${p.gid}" data-p="${p.id}" data-gotab="guild">⚔ Revanche</button>` };
    const E2 = ex(); if (E2 && E2.left <= 0) return { ok: false, html: `<span class="tag soft">plus d'attaque aujourd'hui</span>` };
    return { ok: true, html: `<button class="btn sm primary" data-act="g-atk" data-g="${p.gid}" data-p="${p.id}" data-gotab="guild">⚔ Attaquer</button>` };
  }
  /* part pillée (même calcul que rd_end_done, sans le Coffre-fort qu'on ne voit pas) avec la revanche et la nuit */
  function lootOf(p, rev) {
    const g = guildOf(p); const G = GU() && GU().G; const mine = (G && G.me && G.me.g && G.me.g.lvl) || 1;
    const base = E.raidPart(mine, g.lvl, false);
    const part = Math.min(1, base * (rev ? 1 + E.HUNT.revengeLoot / 100 : 1) * (night() ? E.HUNT.nightLoot : 1));
    const cap = E.percoCap(p.sid);
    const L = cap ? E.raidLoot(E.percoGain(cap, Math.min(1, p.fill || 0), {}), part) : { k: 0, res: {} };
    return Object.assign(L, { half: base < E.RAID.loot / 100, boost: part > base });
  }
  const vetHtml = (p) => { const n = Math.max(0, Math.min(E.HUNT.stars, p.stars || 0));
    return `<span class="pc-vet" data-tip="Une étoile par attaque de guilde repoussée (${E.HUNT.stars} au plus) : +${Math.round(E.HUNT.star * 100)} % de PV et de dommages chacune pour lui et ses gardes. Il les perd s'il est pillé.">Percepteur « ${h(E.percoNick(p.id))} » ${"★".repeat(n)}<span class="muted">${"★".repeat(E.HUNT.stars - n)}</span>${n ? ` +${Math.round(n * E.HUNT.star * 100)} %` : ""}</span>`; };
  const bountyHtml = (p) => (p.bounty || []).map((b) => `<span class="pc-bnty" data-tip="Celui qui pille ce Percepteur touche la prime, en plus du butin. Elle revient au coffre de ${h(b.by)} le ${new Date(Date.parse(b.until) - (C.off || 0)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} si personne ne le pille.">💰 Prime ${fk(b.k)} · ${h(b.by)}${b.gid === myGid() ? " (ta guilde)" : ""}</span>`).join("");
  const mapGo = (p) => { const sub = E.SUBS[p.sid] ? p.sid : E.DUNGEON_SUB && E.DUNGEON_SUB[p.sid]; return sub ? `<button class="btn sm" data-act="zoneview" data-id="${sub}" data-gotab="world" data-tip="Voir sur la carte">${X().IC("carte")}</button>` : ""; };
  const canBounty = (p) => officer() && p.gid !== myGid() && !(p.bounty || []).some((b) => b.gid === myGid());
  function row(p) {
    const s = stateOf(p); const L = lootOf(p, s.rev); const bk = bountyK(p); const zn = E.percoName(p.sid);
    return `<div class="li pc-row ${s.ok ? "" : "dim"}"><span class="pc-ic">${X().IC(p.dj ? "cle" : "bourse")}</span><span class="grow" style="min-width:0"><b>${h(zn)}</b> <span class="xs muted">niv. ${p.zlvl || E.percoLvl(p.sid)}${p.dj ? " · donjon" : ""}</span>
        <div class="pc-tags">${vetHtml(p)}${bountyHtml(p)}</div>
        <div class="pc-bar"><i style="width:${Math.min(100, (p.fill || 0) * 100).toFixed(0)}%"></i></div><span class="xs muted">poche ${Math.round((p.fill || 0) * 100)} %</span></span>
      <span class="pc-loot"><b class="num">≈ ${fk(L.k + bk)}</b><br><span class="xs muted">+ ${fmt(resSum(L.res))} ressources${L.half ? " (÷ 2)" : ""}${bk ? ` · dont ${fk(bk)} de prime` : ""}${L.boost ? ` · ${s.rev ? "revanche" : ""}${s.rev && night() ? " et " : ""}${night() ? "nuit" : ""}` : ""}</span></span>
      <span class="pc-act">${mapGo(p)}${canBounty(p) ? `<button class="btn sm" data-act="hc-bnty" data-p="${p.id}" data-tip="Mettre une prime sur ce Percepteur (payée par le coffre de guilde)">💰</button>` : ""}${s.html}</span></div>`;
  }

  /* ---------- onglet « Chasse aux Percepteurs » ---------- */
  const FILTERS = [["all", "Tous"], ["ok", "Attaquables"], ["zone", "Zones"], ["dj", "Donjons"], ["near", "Près de mon niveau"]];
  const SORTS = [["ok", "Attaquables d'abord, puis butin"], ["lvl", "Niveau de la zone"], ["bounty", "Primes d'abord"]];
  const myLvl = () => { const s = S(); return s ? Math.max(...s.chars.map((c) => (c.ren ? 200 : c.lvl))) : 1; };
  const keep = (p) => C.f === "ok" ? stateOf(p).ok : C.f === "zone" ? !p.dj : C.f === "dj" ? !!p.dj : C.f === "near" ? Math.abs((p.zlvl || 1) - myLvl()) <= 25 : true;
  const sorter = (a, b) => C.sort === "lvl" ? (b.zlvl || 0) - (a.zlvl || 0) : C.sort === "bounty" ? bountyK(b) - bountyK(a) || lootOf(b).k - lootOf(a).k
    : (stateOf(b).ok - stateOf(a).ok) || (lootOf(b).k + bountyK(b)) - (lootOf(a).k + bountyK(a));
  function nightBanner() {
    const n = E.huntNightLeft(now()); const on = night();
    if (on) return `<section class="pc-ban pc-night on" style="--gc:#c77dff"><span class="big">🌙</span><div class="grow stack" style="gap:2px"><b>Nuit des Percepteurs : c'est maintenant !</b><span class="small">Butin des pillages ×${String(E.HUNT.nightLoot).replace(".", ",")}, boucliers des Percepteurs réduits de moitié, une attaque de plus pour chacun. La guilde qui pille le plus gagne le titre « ${E.HUNT.nightTitle} ».</span></div><span class="tag warn">${n.on ? `encore ${left(n.ms)}` : `jusqu'à ${E.HUNT.nightTo} h`}</span></section>`;
    return `<section class="pc-ban pc-night" style="--gc:#c77dff"><span class="big">🌙</span><div class="grow stack" style="gap:2px"><b>Nuit des Percepteurs : samedi de ${E.HUNT.nightFrom} h à ${E.HUNT.nightTo} h</b><span class="small">Butin des pillages ×${String(E.HUNT.nightLoot).replace(".", ",")}, boucliers réduits de moitié, une attaque de plus pour chacun ; titre « ${E.HUNT.nightTitle} » pour la guilde qui pille le plus.</span></div><span class="tag soft">dans ${left(n.ms)}</span></section>`;
  }
  function revBanners() {
    return ((ex() && ex().revenge) || []).filter((v) => Date.parse(v.until) > now()).map((v) => `<section class="pc-ban" style="--gc:#e0674f">${emb({ ic: v.ic, col: v.col }, 44)}<div class="grow stack" style="gap:2px"><b>Revanche contre ${h(v.name)}</b><span class="small">${v.used ? `Tu as déjà pris ta revanche. Les autres membres de ta guilde peuvent encore attaquer un de leurs Percepteurs.` : `Ils ont pillé votre Percepteur de ${h(v.zone)}. Tu peux attaquer un de leurs Percepteurs une fois, sans utiliser tes attaques du jour, avec +${E.HUNT.revengeLoot} % de butin.`}</span></div><span class="tag ${v.used ? "soft" : "warn"}">${v.used ? "faite" : left(Date.parse(v.until) - now())}</span></section>`).join("");
  }
  function domLine() {
    const g = myGid(); if (!g) return "";
    const Z = E.ZONES || (window.DATA && window.DATA.ZONES) || [];
    const mine = Object.keys(C.dom).filter((z) => C.dom[z].gid === g).map((z) => (Z.find((x) => x.id === z) || { name: z }).name);
    return `<span class="xs muted">🏴 ${mine.length ? `Ta guilde domine ${mine.map(h).join(", ")} : +${E.HUNT.dom} % de kamas et de butin pour ses membres qui y chassent.` : `La guilde qui a le plus de Percepteurs dans une région la domine : +${E.HUNT.dom} % de kamas et de butin pour ses membres qui y chassent.`}</span>`;
  }
  function huntHtml() {
    load();
    if (!C.map) return `<div class="empty">${C.err ? "Pas de connexion au serveur : réessaie dans un moment." : "Chargement…"}</div>`;
    const P = all().filter((p) => p.gid !== myGid()); const ok = P.filter((p) => stateOf(p).ok).length;
    const E2 = ex(); const lft = E2 ? `${E2.left} / ${E2.max}` : "…";
    const chips = FILTERS.map(([k, t]) => `<button data-act="hc-f" data-v="${k}" aria-pressed="${C.f === k}">${t}${k === "all" ? ` (${P.length})` : k === "ok" ? ` (${ok})` : ""}</button>`).join("");
    const sel = `<select data-act="hc-sort" aria-label="Trier">${SORTS.map(([k, t]) => `<option value="${k}" ${C.sort === k ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    const head = `<section class="panel"><div class="phead"><h2>Chasse aux Percepteurs</h2><span class="xs muted">${P.length} Percepteur${P.length > 1 ? "s" : ""} ennemi${P.length > 1 ? "s" : ""} · ${ok} attaquable${ok > 1 ? "s" : ""} maintenant</span></div>
      <div class="pad stack" style="gap:10px"><div class="pc-head chips">${chips}<span class="grow"></span>${sel}<button class="btn sm" data-act="hc-map" data-gotab="world">${X().IC("monde")} Voir sur la carte</button></div>
        <span class="xs muted">Tes attaques aujourd'hui : ${lft} · avec ton équipe d'arène (3 héros, celle du Kolizéum)</span>${domLine()}</div></section>`;
    const prime = `<div class="pc-note small">💰 <b>Avis de recherche :</b> le Meneur ou un Bras droit peut mettre une prime sur un Percepteur ennemi, payée par le coffre (${fk(E.HUNT.bountyMin)} au moins). Celui qui le pille touche la prime en plus du butin ; sans pillage en ${E.HUNT.bountyDays} jours, elle revient au coffre.</div>`;
    const by = {}; P.filter(keep).sort(sorter).forEach((p) => { (by[p.gid] = by[p.gid] || []).push(p); });
    const score = (L) => (revOf(L[0].gid) && !revOf(L[0].gid).used ? 1e12 : 0) + L.filter((p) => stateOf(p).ok).length * 1e9 + L.reduce((a, p) => a + lootOf(p).k, 0);
    const groups = Object.values(by).sort((a, b) => score(b) - score(a)).map((L) => { const g = guildOf(L[0]); const v = revOf(L[0].gid);
      return `<section class="panel ${v && !v.used ? "pc-revg" : ""}"><div class="pc-grp">${emb(g, 30)}<span class="grow">${h(g.name)} <span class="xs muted">· niv. ${g.lvl} · ${L.length} Percepteur${L.length > 1 ? "s" : ""}${g.rob ? ` · Robustesse ${g.rob}` : ""}</span></span>${v && !v.used ? `<span class="tag warn">revanche</span>` : ""}<button class="btn sm" data-act="g-view" data-g="${L[0].gid}">Fiche de la guilde</button></div><div class="list">${L.map(row).join("")}</div></section>`; }).join("");
    const empty = !P.length ? `<div class="empty">Aucune autre guilde n'a de Percepteur pour l'instant.</div>` : !groups ? `<div class="empty">Aucun Percepteur avec ce filtre.</div>` : "";
    return `${head}${nightBanner()}${revBanners()}${prime}${groups}${empty}`;
  }

  /* ---------- carte du Monde (ui.js) ---------- */
  function subChip(sid) { const L = at(sid); if (!L.length) { load(); return ""; } return `<span class="pc-line">⚔ ${L.map((p) => chip(guildOf(p), p.dj ? " · donjon" : "")).join("")}</span>`; }
  function foldTag(z) {
    load(); if (!C.map) return "";
    const n = z.subs.reduce((a, s) => a + at(s.id).length, 0); if (!n) return "";
    const d = C.dom[z.id]; const tag = `<span class="tag warn">⚔ ${n} Percepteur${n > 1 ? "s" : ""}</span>`;
    if (!d) return tag;
    if (d.tie) return `<span class="tag soft" data-tip="Égalité en tête : personne ne domine cette région.">Territoire disputé</span>${tag}`;
    const g = (C.map.guilds || {})[d.gid] || { name: "?" };
    return `<span class="pc-dom" data-tip="${d.n} Percepteur${d.n > 1 ? "s" : ""} sur ${d.tot} : les membres de ${h(g.name)} gagnent +${E.HUNT.dom} % de kamas et de butin dans cette région">${chip(g)} <b class="xs">domine</b></span>${tag}`;
  }
  function zoneBox(sid) {
    load();
    return at(sid).map((p) => { const g = guildOf(p); const s = stateOf(p); const L = lootOf(p, s.rev); const bk = bountyK(p);
      return `<div class="pc-zone" style="--gc:${h(g.col || "#8cc63f")}">${emb(g, 54)}<div class="grow stack" style="gap:4px"><b>⚔ Percepteur · ${h(g.name)}${p.dj ? ` <span class="xs muted">(donjon ${h(E.percoName(p.sid))})</span>` : ""}</b>
        <div class="pc-tags">${vetHtml(p)}${bountyHtml(p)}</div>
        <span class="xs muted">guilde niv. ${g.lvl} · Robustesse ${g.rob || 0} · poche ${Math.round((p.fill || 0) * 100)} %${s.mine ? "" : ` · ≈ ${fk(L.k + bk)} et ${fmt(resSum(L.res))} ressources à piller`}</span>
        <div class="row">${s.html}${s.mine ? "" : `<button class="btn sm" data-act="hc-hunt">Chasse aux Percepteurs</button>`}</div></div></div>`; }).join("");
  }
  function mapLegend() {
    load(); if (!C.map) return "";
    const P = all().filter((p) => p.gid !== myGid()); if (!all().length) return "";
    const ok = P.filter((p) => stateOf(p).ok).length;
    return `<section class="panel pc-legend"><div class="pad row between"><span class="small">⚔ <b>${P.length} Percepteur${P.length > 1 ? "s" : ""} ennemi${P.length > 1 ? "s" : ""}</b> sur la carte${myGid() ? `, ${ok} attaquable${ok > 1 ? "s" : ""} maintenant` : ""} : l'emblème de leur guilde est sur la zone.<br>🏴 La guilde qui a le plus de Percepteurs dans une région la <b>domine</b> : ses membres y gagnent +${E.HUNT.dom} % de kamas et de butin (dans les plafonds).${night() ? "<br>🌙 <b>Nuit des Percepteurs</b> : butin ×1,5 jusqu'à 23 h." : ""}</span>${myGid() ? `<button class="btn sm primary" data-act="hc-hunt">Chasse aux Percepteurs</button>` : ""}</div></section>`;
  }

  /* ---------- domination (9A) : +5 % de kamas et de butin dans la région dominée, sous les plafonds ---------- */
  function domBonus(s, kind) {
    if (kind !== "drop" && kind !== "kamas") return 0;
    const g = s && s.guild && s.guild.id; if (!g || !s.sub) return 0;
    const d = C.dom[E.huntRegion(s.sub)]; return d && d.gid === g ? E.HUNT.dom : 0;
  }
  const domOf = (s) => { const g = s && s.guild && s.guild.id; const z = s && s.sub && E.huntRegion(s.sub); const d = z && C.dom[z]; return d && d.gid === g ? z : null; };

  /* ---------- événements ---------- */
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act, d = t.dataset;
    if (!/^hc-/.test(a)) return;
    const G = GU() && GU().G;
    switch (a) {
      case "hc-f": C.f = d.v; GU().paint(); return;
      case "hc-bnty": {
        const p = all().find((x) => x.id === +d.p); if (!p) return; const g = guildOf(p); const chest = (G && G.me && G.me.g && +G.me.g.chest) || 0;
        const max = Math.min(E.HUNT.bountyMax, chest); const def = Math.max(E.HUNT.bountyMin, Math.min(max, 250000));
        X().openSheet(`<h2>💰 Prime sur un Percepteur</h2><p class="small">Percepteur « ${h(E.percoNick(p.id))} » de <b>${h(g.name)}</b> à ${h(E.percoName(p.sid))}. Celui qui le pille dans les ${E.HUNT.bountyDays} jours touche la prime en plus du butin ; sinon, elle revient au coffre.</p>
          <label class="small"><b>Montant</b> <span class="muted">(${fk(E.HUNT.bountyMin)} à ${fk(E.HUNT.bountyMax)}, payé par le coffre : ${fk(chest)})</span></label>
          <input type="number" id="chBnty" min="${E.HUNT.bountyMin}" max="${max}" step="10000" value="${def}">
          <div class="row"><button class="btn primary" data-act="hc-bnty2" data-p="${p.id}" ${chest < E.HUNT.bountyMin ? "disabled" : ""}>Mettre la prime</button><button class="btn" data-act="closesheet">Annuler</button></div>
          ${chest < E.HUNT.bountyMin ? `<span class="xs" style="color:var(--danger)">Il faut au moins ${fk(E.HUNT.bountyMin)} dans le coffre.</span>` : ""}`);
        return; }
      case "hc-bnty2": {
        const k = Math.floor(+((document.querySelector("#chBnty") || {}).value || 0));
        if (!(k >= E.HUNT.bountyMin && k <= E.HUNT.bountyMax)) { X().toast(`Une prime va de ${fmt(E.HUNT.bountyMin)} à ${fmt(E.HUNT.bountyMax)} kamas.`); return; }
        X().closeSheet();
        const r = await GU().call("guild_bounty", { p_perco: +d.p, p_k: k }, `💰 Prime de ${fmt(k)} kamas posée : celui qui pille ce Percepteur la touchera.`);
        if (r) { if (G && G.me && G.me.g && r.chest != null) G.me.g.chest = r.chest; await load(true); GU().load(); }
        return; }
    }
  });
  document.addEventListener("change", (ev) => { const a = ev.target.dataset && ev.target.dataset.act; if (a === "hc-sort") { C.sort = ev.target.value; GU().paint(); } });

  window.CHASSE = { load, huntHtml, subChip, foldTag, zoneBox, mapLegend, domBonus, domOf, stateOf, lootOf, vetHtml, bountyHtml, find: (id) => all().find((p) => p.id === id), night, C };
})();
