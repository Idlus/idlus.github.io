/* ============================================================================
   CHROMATIQUES — interface (1.0.33). La logique est dans js/chroma.js.
   - Combat : monstre aux couleurs inversées, halo doré et étincelles (prismatique : arc-en-ciel), pastille de chaîne
     dans la barre du combat, ligne dans le résultat ; aura chromatique des héros (Atelier du prisme).
   - Célébration : nouveau chromatique de l'album (seulement la première fois par espèce, 6A), palier, trophée.
   - Encyclopédie › Chromatiques : l'album par région (et Donjons), paliers, vitrine de 3, compteur de chasse,
     espèce recherchée, Atelier du prisme, trophées chromatiques de sous-zone ; fiche de rencontre.
   - Héros › Apparence : teinture chromatique ; résumé d'absence ; vitrine sur la fiche joueur (classements).
   Rien ne se redessine dans la boucle de 3 s : l'album se redessine au clic, comme l'Encyclopédie.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !D || !window.DX || !E.chroma) return;
  const { MONSTERS, ZONES, DUNGEONS } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const phone = () => window.innerWidth < 900;
  const st = { z: null };
  const mImg = (k) => (MONSTERS[k] ? `assets/m/${MONSTERS[k].img}.png` : "");
  const mName = (k) => (MONSTERS[k] ? MONSTERS[k].name : k);
  const kind = (p) => (p ? "prismatique" : "chromatique");
  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const day = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const when = (t) => new Date(t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(" ", " à ");
  const odds = (s, k) => Math.max(1, Math.round(1 / E.chromaOdds(s, k)));
  const chainTxt = (m) => `×${String(Math.round(m * 100) / 100).replace(".", ",")}`;
  const mons = (n) => `${fmt(n)} monstre${n > 1 ? "s" : ""}`;
  const art = (k, p, cls = "") => `<span class="cx-art ${p ? "prism" : "on"} ${cls}"><img src="${mImg(k)}" alt="" loading="lazy"><i class="cx-spk"></i></span>`;

  /* ---------- combat ---------- */
  function auraCls(e) {
    if (!e || e.summon) return "";
    if (e.side !== "c") return e.chroma ? (e.prism ? " chroma prism" : " chroma") : "";
    const s = S(); return s && s.chroma && s.chroma.shop && s.chroma.shop.aura && s.chroma.auraOn ? " chaura" : "";
  }
  function pill(F) {
    const s = S(); if (!s || !F || !(s.hunting || s.dungeon) || (s.dungeon && s.dungeon.gboss) || F.exp) return "";
    const C = E.chroma(s); const here = F.ents.find((e) => e.side === "m" && e.chroma && e.alive);
    const m = E.chromaChainMult(s); const w = C.want && MONSTERS[C.want.k] ? C.want.k : null;
    const tip = `Chromatiques : 1 monstre sur ${fmt(odds(s))} en ce moment${m > 1 ? ` (chaîne ${chainTxt(m)} : ${fmt(C.chain.n)} victoires d'affilée ici, ×${E.CHROMA_CHAIN_MAX} à ${E.CHROMA_CHAIN_N})` : ". La chaîne monte en restant dans la même zone"}${E.chromaCharm(s) ? `, Charme ×${String(E.CHROMA_CHARM).replace(".", ",")}` : ""}. ${fmt(C.since || 0)} monstres depuis le dernier.${w ? ` Espèce recherchée : ${mName(w)} (×${E.CHROMA_WANT}).` : ""} Toucher pour ouvrir l'album.`;
    return `<span class="pill cxpill ${here ? "good on" : ""}" data-act="cx-open" data-tip="${h(tip)}">✦ ${here ? `${here.prism ? "Prismatique" : "Chromatique"} ! ` : ""}${m > 1 ? `Chaîne ${chainTxt(m)}` : "Chaîne ×1"} · ${fmt(C.since || 0)}${w ? " · 🎯" : ""}</span>`;
  }
  function winHtml(L) {
    if (!L || !L.length) return "";
    return `<div class="cxwin">${L.map((x) => `<div class="row">${art(x.k, x.p, "sm")}<span class="grow"><b>${h(mName(x.k))} ${kind(x.p)}</b>${x.first ? ` <span class="tag good">Nouveau dans l'album</span>` : ""}<br><span class="xs">Butin et XP ×${E.CHROMA_MULT} · +${x.p ? 5 : 1} Éclat${x.p ? "s" : ""} chromatique${x.p ? "s" : ""}${x.after ? ` · trouvé après ${mons(x.after)}` : ""}</span></span><button class="btn sm" data-act="cx-fiche" data-k="${x.k}">Fiche</button></div>`).join("")}</div>`;
  }
  /* ---------- célébrations ---------- */
  function cele(ev) {
    if (ev.t === "chroma") { if (!MONSTERS[ev.k]) return "";
      return `<div class="cele-art pet cx-cele"><span class="chcmp"><img src="${mImg(ev.k)}" alt=""><i>normal</i></span>${art(ev.k, ev.p, "big")}</div><div class="cele-k">✦ ${ev.p ? "Monstre prismatique !" : "Monstre chromatique"}${ev.first ? " · nouveau dans l'album" : ""}</div><div class="cele-t ${ev.p ? "cx-rainbow" : "cx-gold"}">${h(mName(ev.k))} ${kind(ev.p)}</div><div class="cele-s">${ev.where ? h(ev.where) + " · " : ""}${ev.after ? `trouvé après ${mons(ev.after)} · ` : ""}album ${ev.n} / ${E.CHROMA_TOTAL}</div><div class="chloot"><span>Butin ×${E.CHROMA_MULT}</span><span>XP ×${E.CHROMA_MULT}</span><span>+${ev.p ? 5 : 1} Éclat${ev.p ? "s" : ""}</span></div>`; }
    if (ev.t === "chromatier") return `<div class="cele-art pet cx-cele"><span class="cx-big">✦</span></div><div class="cele-k">✦ Album chromatique · palier ${ev.n}</div><div class="cele-t cx-gold">${h(ev.txt)}</div><div class="cele-s">${ev.n} chromatiques dans l'album</div>`;
    if (ev.t === "chromatro") { const sb = E.SUBS[ev.sid]; if (!sb) return "";
      return `<div class="cele-art pet cx-cele"><span class="cx-big">🏆</span></div><div class="cele-k">✦ Trophée chromatique</div><div class="cele-t cx-gold">${h(sb.name)}</div><div class="cele-s">Tous ses chromatiques sont dans l'album : +${E.CHROMA_TROPHY} % de butin et d'XP dans cette sous-zone.</div>`; }
    return "";
  }

  /* ---------- Encyclopédie ---------- */
  function kpi() {
    const s = S(); const n = E.chromaCount(s);
    return `<button class="enckpi cxkpi" data-act="enctab" data-v="chroma" data-tip="Album chromatique : 1 monstre sur ${fmt(Math.round(1 / E.CHROMA_CHANCE))} est chromatique (couleurs inversées, butin et XP ×${E.CHROMA_MULT}).${E.chromaPrismCount(s) ? ` ${E.chromaPrismCount(s)} prismatique${E.chromaPrismCount(s) > 1 ? "s" : ""}.` : ""}"><span class="xs">✦ Chromatiques</span><b class="num">${fmt(n)} <small>/ ${fmt(E.CHROMA_TOTAL)}</small></b><span class="bar"><i style="width:${pct(n, E.CHROMA_TOTAL)}%"></i></span><span class="xs encopen">Ouvrir l'album ›</span></button>`;
  }
  const subKeys = (sid) => E.chromaSubMons(sid);
  const groups = () => ZONES.map((z) => ({ id: z.id, name: z.name, subs: z.subs.map((sb) => ({ id: sb.id, name: sb.name, lvl: sb.lvl, ks: subKeys(sb.id) })).filter((x) => x.ks.length) }))
    .concat([{ id: "dg", name: "Donjons", subs: Object.keys(DUNGEONS).sort((a, b) => DUNGEONS[a].lvl - DUNGEONS[b].lvl).map((id) => ({ id: "dg:" + id, name: DUNGEONS[id].name, lvl: [DUNGEONS[id].lvl, DUNGEONS[id].lvl], ks: E.chromaDgMons[id] || [], dg: true })).filter((x) => x.ks.length) }]);
  const gCount = (s, g) => { let a = 0, b = 0; g.subs.forEach((x) => { b += x.ks.length; a += x.ks.filter((k) => s.chroma && s.chroma.dex[k]).length; }); return [a, b]; };
  function card(s, k) {
    const C = E.chroma(s); const d = C.dex[k]; const want = C.want && C.want.k === k; const met = (s.bestiary[k] || 0) > 0;
    if (d) return `<button class="cxcard on ${d.p ? "prism" : ""}" data-act="cx-fiche" data-k="${k}" data-tip="${h(`${mName(k)} ${kind(d.p)} · vu ${d.n} fois`)}">${art(k, d.p)}<b>${h(mName(k))}</b><span class="xs">${d.p ? "🌈 Prismatique" : "✦ " + day(d.t)}${d.n > 1 ? ` · ×${d.n}` : ""}</span></button>`;
    return `<button class="cxcard off ${want ? "want" : ""}" data-act="cx-fiche" data-k="${k}" data-tip="${h(met ? `${mName(k)} : pas encore vu en chromatique` : "Monstre jamais rencontré")}"><span class="cx-art off"><img src="${mImg(k)}" alt="" loading="lazy"></span><b>${met ? h(mName(k)) : "???"}</b><span class="xs muted">${want ? `🎯 recherché ×${E.CHROMA_WANT}` : met ? "pas encore vu" : "jamais rencontré"}</span></button>`;
  }
  function boxes(s) {
    const C = E.chroma(s); const r = C.rec || {};
    const vit = (C.vit || []).filter((k) => C.dex[k]);
    const slots = [0, 1, 2].map((i) => { const k = vit[i]; const d = k && C.dex[k];
      return d ? `<button class="cxslot" data-act="cx-fiche" data-k="${k}">${art(k, d.p, "sm")}<span><b>${h(mName(k))}</b><span class="xs">${h(d.where || "")} · ${day(d.t)}</span></span></button>` : `<div class="cxslot empty"><span class="xs muted">Place libre : ouvre un chromatique et touche « Mettre en vitrine »</span></div>`; }).join("");
    const avg = r.tot ? Math.round(r.sum / r.tot) : 0;
    const w = C.want && MONSTERS[C.want.k] ? C.want.k : null;
    const shop = E.CHROMA_SHOP.map((it) => { const own = it.id === "dye" ? 0 : C.shop[it.id]; const ok = (C.ec || 0) >= it.cost;
      return `<div class="cxit ${own ? "own" : ""}"><span class="ico">${{ dye: "🎨", orn: "💠", frame: "🖼️", aura: "🌈" }[it.id]}</span><b>${h(it.name)}</b><span class="xs muted">${h(it.txt)}</span>${own ? (it.id === "aura" ? `<button class="btn sm" data-act="cx-aura">${C.auraOn ? "Aura : activée" : "Aura : coupée"}</button>` : `<span class="tag good">Obtenu</span>`) : `<button class="btn sm ${ok ? "primary" : ""}" data-act="cx-buy" data-v="${it.id}" ${ok ? "" : "disabled"}>${it.cost} Éclats</button>`}${it.id === "dye" && C.dyes ? `<span class="xs">${C.dyes} en réserve</span>` : ""}</div>`; }).join("");
    return `<div class="cxboxes">
      <div class="cxbox"><h3>✦ Ma vitrine <span class="xs muted">visible sur ta fiche joueur</span></h3><div class="cxvit">${slots}</div></div>
      <div class="cxbox"><h3>⏱ Compteur de chasse</h3><div class="cxrow"><span>Depuis le dernier : <b>${fmt(C.since || 0)}</b> monstres</span><span>Moyenne : <b>${avg ? fmt(avg) : "—"}</b></span><span>Plus rapide : <b>${r.fast ? fmt(r.fast[0]) : "—"}</b>${r.fast ? ` <span class="xs muted">(${h(mName(r.fast[1]))})</span>` : ""}</span><span>Plus long : <b>${r.slow ? fmt(r.slow[0]) : "—"}</b>${r.slow ? ` <span class="xs muted">(${h(mName(r.slow[1]))})</span>` : ""}</span></div></div>
      <div class="cxbox"><h3>🎯 Espèce recherchée</h3><div class="cxrow">${w ? `<span>Tu vises <b>${h(mName(w))}</b> : chances ×${E.CHROMA_WANT} pour lui seul.</span>` : `<span>Aucune. Ouvre un monstre déjà rencontré dans l'album et touche « Rechercher ».</span>`}<span class="xs muted">${E.chromaWantFree(s) ? "Tu peux changer aujourd'hui." : "Déjà changée aujourd'hui : prochain changement demain."}</span></div></div>
      <div class="cxbox wide"><h3>✦ Atelier du prisme <span class="cxec">${fmt(C.ec || 0)} Éclat${(C.ec || 0) > 1 ? "s" : ""} chromatique${(C.ec || 0) > 1 ? "s" : ""}</span></h3><div class="cxshop">${shop}</div></div>
    </div>`;
  }
  function html(enc) {
    const s = S(); const C = E.chroma(s); const n = E.chromaCount(s); const G = groups();
    const curLoc = s.sub && G.find((g) => g.subs.some((x) => x.id === s.sub));
    if (!st.z || !G.some((g) => g.id === st.z)) st.z = (curLoc || G[0]).id;
    const q = E.searchNorm ? E.searchNorm(enc && enc.q) : "";
    const side = G.map((g) => { const [a, b] = gCount(s, g); return `<button class="enczone ${a === b ? "done" : ""}" data-act="cx-zone" data-v="${g.id}" aria-pressed="${g.id === st.z}"><span class="grow">${h(g.name)}</span><span class="xs num">${a}/${b}</span><span class="bar"><i style="width:${pct(a, b)}%"></i></span></button>`; }).join("");
    const sel = `<select class="encsel" data-act="cx-zonesel">${G.map((g) => { const [a, b] = gCount(s, g); return `<option value="${g.id}" ${g.id === st.z ? "selected" : ""}>${h(g.name)} · ${a}/${b}</option>`; }).join("")}</select>`;
    const tiers = E.CHROMA_TIERS.map((T) => `<div class="cxtier ${n >= T.n ? "ok" : ""}"><b>${T.n} chromatiques</b>${h(T.txt)}</div>`).join("");
    let body;
    if (q) {
      const hits = E.CHROMA_KEYS.filter((k) => (C.dex[k] || s.bestiary[k] > 0) && (E.searchNorm(mName(k)).includes(q))).slice(0, 60);
      body = `<h3 class="sec">Résultats pour « ${h(enc.q)} » <span class="xs muted">${hits.length}</span></h3>${hits.length ? `<div class="cxgrid">${hits.map((k) => card(s, k)).join("")}</div>` : `<div class="empty">Aucun monstre rencontré ne correspond.</div>`}`;
    } else {
      const g = G.find((x) => x.id === st.z);
      body = `<div class="enczhead"><h2>${h(g.name)}</h2></div>` + g.subs.map((sb) => { const a = sb.ks.filter((k) => C.dex[k]).length; const tro = !sb.dg && E.chromaTrophy(s, sb.id);
        return `<h3 class="sec">${h(sb.name)} <span class="xs muted num">${a}/${sb.ks.length}</span>${sb.dg ? "" : tro ? `<span class="cxtro">🏆 Trophée chromatique · +${E.CHROMA_TROPHY} % butin et XP ici</span>` : `<span class="cxtro off">🏆 ${a}/${sb.ks.length} pour le trophée</span>`}</h3><div class="cxgrid">${sb.ks.map((k) => card(s, k)).join("")}</div>`; }).join("");
    }
    const loc = s.dungeon ? "dg:" + s.dungeon.id : s.hunting ? s.sub : null;
    const m = E.chromaChainMult(s);
    return `<section class="panel encpanel cxalb"><div class="encbest"><aside class="enczones">${side}</aside><div class="encmain">
      <div class="cxhead"><h2>✦ Album chromatique</h2><span class="cxodds">1 monstre sur ${fmt(odds(s))}${loc ? (m > 1 ? ` · chaîne ${chainTxt(m)}` : " · chaîne ×1") : ""}${E.chromaCharm(s) ? ` · Charme ×${String(E.CHROMA_CHARM).replace(".", ",")}` : ""}</span><span class="cxodds">${fmt(n)} / ${fmt(E.CHROMA_TOTAL)} · ${E.chromaPrismCount(s)} prismatique${E.chromaPrismCount(s) > 1 ? "s" : ""}</span></div>
      <p class="xs muted">Couleurs inversées et halo doré, même force qu'un monstre normal : butin et XP ×${E.CHROMA_MULT} et 1 Éclat chromatique. Rester dans la même zone fait monter la chaîne (×${E.CHROMA_CHAIN_MAX} après ${E.CHROMA_CHAIN_N} victoires d'affilée). 1 chromatique sur ${Math.round(1 / E.PRISM_CHANCE)} est prismatique (arc-en-ciel, 5 Éclats). Les Dofus ne changent jamais.</p>
      <div class="cxtiers">${tiers}</div>${boxes(s)}
      ${q ? "" : `<div class="enctools">${sel}</div>`}${body}</div></div></section>`;
  }

  /* ---------- fiche de rencontre (11A) ---------- */
  function fiche(k) {
    const s = S(); const C = E.chroma(s); const d = C.dex[k]; if (!MONSTERS[k]) return;
    const subs = Object.values(E.SUBS).filter((x) => subKeys(x.id).includes(k)).map((x) => x.name);
    const dgs = Object.keys(DUNGEONS).filter((id) => (E.chromaDgMons[id] || []).includes(k)).map((id) => DUNGEONS[id].name);
    const where = subs.concat(dgs).slice(0, 4).join(", ");
    if (!d) {
      const met = (s.bestiary[k] || 0) > 0; const want = C.want && C.want.k === k;
      X().openSheet(`<div class="cxsheet"><div class="art"><span class="cx-art off big"><img src="${mImg(k)}" alt=""></span></div><h2>${met ? h(mName(k)) : "Monstre inconnu"}</h2>
        <p class="small">${met ? `Pas encore vu en chromatique. ${where ? `On le trouve : ${h(where)}.` : ""}` : "Rencontre-le une première fois pour le voir ici."}</p>
        ${met ? `<p class="xs muted">Chance en ce moment : 1 sur ${fmt(odds(s, k))} par monstre${want ? "" : ` (×${E.CHROMA_WANT} si c'est l'espèce recherchée)`}.</p>` : ""}
        <div class="row">${met && !want ? `<button class="btn primary" data-act="cx-want" data-k="${k}" ${E.chromaWantFree(s) ? "" : "disabled"}>🎯 Rechercher cette espèce</button>` : want ? `<span class="tag good">🎯 Espèce recherchée</span>` : ""}<button class="btn" data-act="closesheet">Fermer</button></div>
        ${met && !want && !E.chromaWantFree(s) ? `<p class="xs muted">Tu as déjà changé d'espèce recherchée aujourd'hui.</p>` : ""}</div>`);
      return;
    }
    const inVit = (C.vit || []).includes(k);
    X().openSheet(`<div class="cxsheet ${d.p ? "prism" : ""}"><div class="art"><span class="chcmp"><img src="${mImg(k)}" alt=""><i>normal</i></span>${art(k, d.p, "big")}</div>
      <h2 class="${d.p ? "cx-rainbow" : "cx-gold"}">✦ ${h(mName(k))} ${kind(d.p)}</h2>
      <dl><dt>Rencontré le</dt><dd>${when(d.t)}</dd><dt>Où</dt><dd>${h(d.where || where || "—")}</dd><dt>Trouvé après</dt><dd>${mons(d.after || 0)} depuis le précédent</dd><dt>Équipe</dt><dd>${h((d.team || []).join(", ") || "—")}</dd><dt>Vu</dt><dd>${d.n} fois en tout</dd>${d.p ? `<dt>Prismatique</dt><dd>depuis le ${when(d.p)}</dd>` : ""}<dt>Butin</dt><dd>×${E.CHROMA_MULT}, XP ×${E.CHROMA_MULT}, +1 Éclat (5 en prismatique)</dd></dl>
      <div class="row"><button class="btn" data-act="cx-replay" data-k="${k}">✦ Revoir la célébration</button><button class="btn ${inVit ? "" : "primary"}" data-act="cx-vit" data-k="${k}" data-on="${inVit ? 0 : 1}">${inVit ? "Retirer de la vitrine" : "Mettre en vitrine"}</button><button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }

  /* ---------- Héros › Apparence : teinture chromatique ---------- */
  function dyeHtml(c) {
    const s = S(); const C = E.chroma(s);
    const body = c.chromaDye ? `<span class="seg">${[[0, "Couleurs normales"], [1, "✦ Chromatique"]].map(([v, n]) => `<button data-act="cx-dye" data-cid="${c.id}" data-on="${v}" aria-pressed="${!!c.chroma === !!v}">${n}</button>`).join("")}</span>`
      : C.dyes > 0 ? `<button class="btn sm primary" data-act="cx-dye" data-cid="${c.id}" data-on="1">Teindre ce héros (${C.dyes} teinture${C.dyes > 1 ? "s" : ""})</button>`
      : `<span class="xs muted">Une teinture se gagne au palier ${E.CHROMA_TIERS.find((T) => T.dye).n} de l'album chromatique ou à l'Atelier du prisme (${E.CHROMA_SHOP.find((x) => x.id === "dye").cost} Éclats).</span>`;
    return `<div class="small cxdye"><b>✦ Teinture chromatique</b> <span class="xs muted">couleurs inversées et reflet doré, pour toujours sur ce héros (on la coupe quand on veut)</span><div>${body}</div></div>`;
  }

  /* ---------- fiche joueur : vitrine (10A) ---------- */
  let prof = null; // null = pas encore testé ; false = le serveur n'a pas encore le classement des chromatiques
  async function profile(u) {
    const ON = window.ONLINE; const el = () => $("#lbChroma");
    if (prof === false || !ON || !ON.db || !ON.db()) return;
    try {
      const { data, error } = await ON.db().from("lb_chroma").select("n,vit").eq("user_id", u).maybeSingle();
      if (error) { prof = false; return; } prof = true;
      const n = el(); if (!n || !data || !data.n) return;
      const vit = Array.isArray(data.vit) ? data.vit.filter((x) => Array.isArray(x) && MONSTERS[x[0]]).slice(0, 3) : [];
      n.innerHTML = `<b>Ses chromatiques <span class="xs muted">· ${fmt(data.n)} / ${fmt(E.CHROMA_TOTAL)}</span></b>${vit.length ? `<div class="cxvit">${vit.map(([k, p]) => `<div class="cxslot">${art(k, p, "sm")}<span><b>${h(mName(k))}</b><span class="xs">${kind(p)}</span></span></div>`).join("")}</div>` : ""}`;
    } catch (x) { /* pas de connexion : la fiche reste sans vitrine */ }
  }

  /* ---------- actions ---------- */
  const repaint = () => { X().markDirty(); X().render(); };
  function act(a, t) {
    const d = t.dataset; const s = S(); if (!s) return;
    switch (a) {
      case "cx-open": { const ui = UI(); X().closeSheet(); ui.tab = "world"; ui.world = "enc"; ui.zoneView = null; (ui.enc = ui.enc || { tab: "best", f: "all", q: "", fam: "zone", boss: "all" }).tab = "chroma"; X().render(); window.scrollTo(0, 0); return; }
      case "cx-zone": st.z = d.v; X().render(); return;
      case "cx-zonesel": st.z = t.value; X().render(); return;
      case "cx-fiche": fiche(d.k); return;
      case "cx-want": { const r = E.chromaSetWant(s, d.k); if (r) { X().toast(r, "warn"); return; } X().toast(`🎯 ${mName(d.k)} : chances ×${E.CHROMA_WANT} pour lui jusqu'à ce que tu le trouves.`); X().closeSheet(); repaint(); return; }
      case "cx-vit": { const r = E.chromaSetVit(s, d.k, d.on === "1"); if (r) { X().toast(r, "warn"); return; } X().toast(d.on === "1" ? `${mName(d.k)} est dans ta vitrine.` : `${mName(d.k)} quitte la vitrine.`); repaint(); fiche(d.k); return; }
      case "cx-replay": { const x = E.chroma(s).dex[d.k]; if (!x) return; X().closeSheet(); const was = s.settings.cele; s.settings.cele = true; E.celebrate({ t: "chroma", k: d.k, p: !!x.p, first: false, n: E.chromaCount(s), after: x.after, where: x.where }); setTimeout(() => { s.settings.cele = was; }, 4000); return; }
      case "cx-buy": { const r = E.chromaBuy(s, d.v); if (r) { X().toast(r, "warn"); return; } const it = E.CHROMA_SHOP.find((x) => x.id === d.v); X().toast(`Atelier du prisme : ${it.name} !${d.v === "dye" ? " Utilise-la dans Héros › Apparence." : ""}`, "rare"); repaint(); return; }
      case "cx-aura": { const C = E.chroma(s); C.auraOn = !C.auraOn; repaint(); return; }
      case "cx-dye": { const r = E.chromaDye(s, +d.cid, d.on === "1"); if (r) { X().toast(r, "warn"); return; } repaint(); const c = s.chars.find((x) => x.id === +d.cid); if (c && X().lookSheet) X().lookSheet(c); return; }
    }
  }

  /* collui.js donne déjà les crochets de l'aura et des célébrations : on les complète */
  if (window.COLL) {
    const a0 = window.COLL.auraCls, c0 = window.COLL.cele;
    window.COLL.auraCls = (e) => (a0 ? a0(e) : "") + auraCls(e);
    window.COLL.cele = (ev) => cele(ev) || (c0 ? c0(ev) : "");
  }
  window.CHROMA = { kpi, html, pill, winHtml, act, dyeHtml, profile, auraCls, cele, fiche };
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "chroma")) E.SEARCH_PAGES.push(["chroma", "Album chromatique", "Journal › Encyclopédie › Chromatiques : album, vitrine, Atelier du prisme"]);
})();
