/* ============================================================================
   ÉLEVAGE — interface (refonte de la 1.1). La logique est dans js/elevage.js.
   Page Héros › Élevage (choix 5A), en 4 onglets :
   - Enclos : éleveur automatique (objectif, journal), les couples avec leurs chances (nouvelle couleur, étoiles,
     capacité), les objets d'élevage posés sur chaque emplacement, l'Essence, la boutique d'objets, les commandes du jour ;
   - Écurie : balades, filtres, relâcher en masse, fiche de chaque monture (nom, famille, nourrir, polir, balade) ;
   - Carnet : récompenses par espèce, couleurs par génération, bicolores et chromatiques ;
   - Capture : filets et zones sauvages.
   Aussi : la monture montée dessinée à côté du héros (11A), la fête des naissances exceptionnelles et leur annonce
   dans le chat (résumé « mrare », supabase/elevage.sql), le résumé « elev » du classement Élevage (12A).
   La page se met à jour seule (DX.morph) toutes les 5 s, les minuteurs chaque seconde.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE;
  if (!E || !window.DX || !E.elevState) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const IC = (n, c) => X().IC(n, c || "");
  const phone = () => window.innerWidth < 900;
  const st = { tab: "enclos", sp: "all", f: "all", sort: "st", csp: "dd", logAll: false, tier: {} };
  const MO = () => E.MOUNTS;
  const spName = (sp) => MO()[sp].name;
  const spPl = (sp) => spName(sp) + "s";
  const fem = (sp) => (sp === "dd" ? "e" : "");
  const eta = (ms) => (E.etaTxt ? E.etaTxt(Math.ceil(ms / 1000)) : `${Math.ceil(ms / 60000)} min`);

  /* ---------- petits rendus ---------- */
  const mImg = (sp, c, chr, cls) => `<img class="${chr ? "el-chr " : ""}${cls || ""}" src="assets/mt/${E.mountIcon(sp, c)}.webp" alt="" loading="lazy">`;
  const starsHtml = (n, max) => `<span class="el-st" aria-label="${n} étoile${n > 1 ? "s" : ""}">${"★".repeat(n)}<i>${"★".repeat(Math.max(0, max - n))}</i></span>`;
  const starsOf = (M) => starsHtml(M.st || 1, E.starCap(S(), M));
  const capTag = (k) => (k && E.CAPS[k] ? `<span class="tag el-cap" data-tip="${h(E.CAPS[k].txt)}">${h(E.CAPS[k].name)}</span>` : "");
  const chrTag = (M) => (M.chr ? `<span class="tag el-chrt" data-tip="Variante chromatique : une étoile de plus possible">chromatique</span>` : "");
  const statTxt = (o) => (window.DX.social.petBonus ? window.DX.social.petBonus(o) : Object.entries(o).map(([k, v]) => `+${v} ${k}`).join(" · "));
  const statsNow = (M) => bonusTxt(E.mountStatsAt(M));
  const PCT = ["cri", "rt", "rf", "re", "ra", "rn", "dsort"];
  function bonusTxt(o) {
    const ST = (window.DATA && window.DATA.STATS) || {};
    return Object.entries(o || {}).filter(([, v]) => v).map(([k, v]) => { const n = k === "pa" ? "PA" : k === "pm" ? "PM" : k === "inv" ? "Invocation" : ST[k] ? ST[k].name.replace("% ", "") : k; return `+${fmt(v)}${PCT.includes(k) ? " %" : ""} ${n}`; }).join(" · ");
  }
  const essTxt = (n) => `<b class="el-ess num">${fmt(n)}</b> Essence`;
  const label = (M) => (M.nm ? `« ${h(M.nm)} » <span class="xs muted">${h(E.mountName(M))}</span>` : h(E.mountName(M)));
  const busyTxt = (s, M) => { const o = E.mountOwner(s, M.uid); return o ? `montée par ${h(o.name)}` : E.inPair(s, M.uid) ? "à l'enclos" : E.onBalade(s, M.uid) ? "en balade" : ""; };

  /* ======================= ENCLOS ======================= */
  function autoPanel(s) {
    const v = s.elev; const A = v.auto; const goals = [["carnet", "Compléter le carnet"]];
    for (const sp of E.MOUNT_ORDER) { const cols = MO()[sp].cols;
      Object.keys(cols).filter((c) => cols[c].p && !(s.mountSeen[sp] && s.mountSeen[sp][c])).forEach((c) => goals.push([`col:${sp}:${c}`, `Obtenir : ${spName(sp)} ${c}`]));
      Object.keys(cols).filter((c) => s.mountSeen[sp] && s.mountSeen[sp][c]).forEach((c) => goals.push([`star:${sp}:${c}`, `Étoiles : ${spName(sp)} ${c}`])); }
    const L = st.logAll ? v.log : v.log.slice(0, 5);
    const tm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
    return `<section class="panel"><div class="phead"><h2>Éleveur automatique</h2><button class="el-sw ${A.on ? "on" : ""}" data-act="el-auto" role="switch" aria-checked="${!!A.on}" aria-label="Éleveur automatique"></button></div><div class="pad stack" style="gap:8px">
      <select data-el="goal" aria-label="Objectif de l'éleveur">${goals.map(([k, n]) => `<option value="${h(k)}" ${A.goal === k ? "selected" : ""}>${h(n)}</option>`).join("")}</select>
      <p class="note xs" style="margin:0">${A.on ? "Il choisit les couples qui rapprochent de l'objectif, relance dès qu'une place se libère, pose les meilleurs objets d'élevage du sac et laisse tranquilles les montures montées et en balade. Il travaille aussi hors ligne." : "Éteint : vous lancez les couples vous-même. Allumé, il remplit l'enclos tout seul, même hors ligne."}</p>
      ${L.length ? `<div class="el-log">${L.map((x) => `<span><b class="num">${tm(x.t)}</b> ${h(x.txt)}</span>`).join("")}</div>${v.log.length > 5 ? `<button class="btn sm" data-act="el-logall">${st.logAll ? "Moins" : `Tout le journal (${v.log.length})`}</button>` : ""}` : `<span class="xs muted">Le journal de l'élevage est vide pour l'instant.</span>`}</div></section>`;
  }
  function slotItems(s, i) {
    const sl = s.elev.slots[i] || {}; const has = E.ELV_ORDER.filter((k) => sl[k]);
    const chips = has.map((k) => `<span class="el-it"><b>${h(E.ELV_ITEMS[k].name)} ${E.ROMAN5[sl[k].t]}</b> <span class="xs muted">${sl[k].n} naissance${sl[k].n > 1 ? "s" : ""}</span><button class="el-x" data-act="el-uneq" data-s="${i}" data-k="${k}" aria-label="Retirer">×</button></span>`).join("");
    const can = s.elev.inv.some((it) => !sl[it.k]);
    return `<div class="el-its">${chips || `<span class="xs muted">Aucun objet d'élevage</span>`}${can ? `<button class="btn sm" data-act="el-autoeq" data-s="${i}">Poser les meilleurs</button>` : ""}</div>`;
  }
  function coupleHtml(s, p, idx) {
    const A = s.mounts[p.a], B = s.mounts[p.b]; if (!A || !B) return "";
    const I = E.breedInfo(s, A, B, p.s); const cap = E.starCap(s, A);
    const odds = I.odds.map(([c, pc, neu]) => `${neu ? `<b class="neu">${s.mountSeen[A.sp] && s.mountSeen[A.sp][c] ? h(E.colourName(A.sp, c)) : "nouvelle couleur"} ${fmtPct(pc)}</b>` : `<span>${h(E.colourName(A.sp, c))} ${fmtPct(pc)}</span>`}`).join("");
    return `<div class="el-couple"><div class="bpair">${mImg(A.sp, A.c, A.chr)}<b>+</b>${mImg(B.sp, B.c, B.chr)}</div><div class="grow" style="min-width:0">
      <b>${h(E.colourName(A.sp, A.c))} ${starsOf(A)} + ${h(E.colourName(B.sp, B.c))} ${starsOf(B)}</b> <span class="xs muted">couple ${p.s + 1}</span>
      <div class="el-odds xs">${odds}</div>
      <div class="xs">Petit : ${starsHtml(Math.min(cap, I.st), cap)} <span class="muted">· ${fmtPct(I.up)} une étoile de plus, ${fmtPct(I.down)} une de moins · ${fmtPct(I.cap)} une capacité</span></div>
      <div class="xs ${p.wait ? "ko" : "muted"}" data-elt="${idx}">${p.wait ? "Le petit attend : l'écurie est pleine, relâchez une monture" : `Naissance dans ${eta(p.t)} · continue hors ligne`}</div><div class="bar"><i data-elb="${idx}" style="width:${100 - Math.round((p.t / (p.T || p.t || 1)) * 100)}%"></i></div>
      ${slotItems(s, p.s)}</div><button class="btn sm" data-act="breedstop" data-i="${idx}" data-a="${p.a}">Annuler</button></div>`;
  }
  const fmtPct = (v) => `${String(Math.round(v * 10) / 10).replace(".", ",")} %`;
  function enclosPanel(s) {
    if (!s.enclos.built) return `<section class="panel"><div class="phead"><h2>Enclos</h2></div><div class="pad stack"><p class="note" style="margin:0">L'enclos ouvre l'élevage : deux montures de la même espèce, niveau ${E.BREED_LVL} au moins, donnent un petit après ${E.BIRTH_MS / 3600e3} h, même hors ligne. Il ajoute ${E.STABLE_ENCLOS} places à l'écurie et accueille ${E.PAIRS_BASE} couples.</p><div><button class="btn sm ${s.kamas >= E.ENCLOS_COST ? "primary" : ""}" data-act="enclosbuild" ${s.kamas >= E.ENCLOS_COST ? "" : "disabled"}>Construire · ${fmt(E.ENCLOS_COST)} k</button></div></div></section>`;
    const cap = E.pairCap(s); const rows = [];
    for (let i = 0; i < cap; i++) {
      const idx = s.enclos.pairs.findIndex((p) => p.s === i);
      rows.push(idx >= 0 ? coupleHtml(s, s.enclos.pairs[idx], idx) : `<div class="el-couple free"><div class="grow"><b>Couple ${i + 1} libre</b><div class="xs muted">${s.elev.auto.on ? "L'éleveur automatique le remplira." : "Choisissez deux montures de la même espèce."}</div>${slotItems(s, i)}</div><button class="btn sm primary" data-act="breedpick" data-reset="1">Croiser</button></div>`);
    }
    const c4 = !(s.elev.c4 || E.grandEleveur(s));
    return `<section class="panel"><div class="phead"><h2>Enclos</h2><span class="xs muted">${s.enclos.pairs.length} couple${s.enclos.pairs.length > 1 ? "s" : ""} sur ${cap}</span></div><div class="pad stack" style="gap:8px">
      ${rows.join("")}
      <div class="row"><button class="btn sm" data-act="breedpick" data-reset="1">Croiser deux montures au choix</button><button class="btn sm" data-act="mtree">Voir l'arbre</button>${c4 ? `<button class="btn sm" data-act="el-pair4" ${s.kamas >= E.PAIR4_COST ? "" : "disabled"} data-tip="Offert avec les trois carnets complets (Grand Éleveur)">4e couple · ${fmt(E.PAIR4_COST)} k</button>` : ""}</div></div></section>`;
  }
  function nextPanel(s) {
    const L = []; E.MOUNT_ORDER.forEach((sp) => E.nextCrosses(s, sp).forEach((x) => L.push(Object.assign({ sp }, x))));
    if (!L.length || !s.enclos.built) return "";
    return `<section class="panel carnet"><div class="phead"><h2>Prochains croisements</h2><span class="xs muted">nouvelles couleurs à portée</span></div><div class="pad stack" style="gap:6px">${L.slice(0, 6).map((x) => {
      const why = !x.a || !x.b ? `${!x.a ? x.p[0] : x.p[1]} : ${(E.mountsBySp(s, x.sp).filter((M) => E.mainColour(M.c) === (!x.a ? x.p[0] : x.p[1])).map((M) => E.mountOwner(s, M.uid) ? "montée" : E.breedWhy(s, M)).filter(Boolean)[0]) || "indisponible"}` : !x.ok ? "enclos plein" : "";
      return `<div class="nx"><span class="bpair">${mImg(x.sp, x.p[0])}<b>+</b>${mImg(x.sp, x.p[1])}</span><span class="grow"><b>${h(x.p[0])} + ${h(x.p[1])}</b> <span class="xs muted">${h(spPl(x.sp).toLowerCase())}</span><br><span class="xs neu">${x.pct != null ? fmtPct(x.pct) : "20 à 40 %"} : nouvelle couleur de génération ${MO()[x.sp].cols[x.c].g}</span>${why ? `<br><span class="xs muted">${h(why)}</span>` : ""}</span><button class="btn sm ${x.ok ? "primary" : ""}" data-act="breed" data-a="${x.a ? x.a.uid : ""}" data-b="${x.b ? x.b.uid : ""}" ${x.ok ? "" : "disabled"}>Lancer</button></div>`; }).join("")}
      <p class="note xs" style="margin:0">Ascendance : 20 % de nouvelle couleur, +5 % par parent de chaque monture qui a sa couleur (une capture compte comme pure). Faites naître une couleur de deux parents de cette couleur avant de la croiser : jusqu'à 40 %.</p></div></section>`;
  }
  function essPanel(s) {
    return `<section class="panel"><div class="phead"><h2>Essence de monture</h2></div><div class="pad stack" style="gap:6px">
      <div class="el-essbox"><span class="big num">${fmt(s.elev.ess)}</span><span class="small">Essence en réserve<br><span class="xs muted">Relâcher une monture rend niveau × étoiles. Balades et commandes en rapportent aussi.</span></span></div>
      <p class="note xs" style="margin:0">${E.ESS_LVL} Essence = 1 niveau de monture. ${fmt(E.ESS_STAR)} Essence = 1 étoile (une fois par jour et par monture). Les objets d'élevage coûtent kamas + Essence. Tout se fait depuis la fiche d'une monture (onglet Écurie).</p></div></section>`;
  }
  function shopPanel(s) {
    const inv = s.elev.inv; const cnt = {}; inv.forEach((it) => { const k = `${it.k}:${it.t}`; cnt[k] = (cnt[k] || 0) + 1; });
    return `<section class="panel"><div class="phead"><h2>Objets d'élevage</h2><span class="xs muted">chacun dure ${E.ITEM_USES} naissances</span></div><div class="pad stack" style="gap:6px">
      ${E.ELV_ORDER.map((k) => { const I = E.ELV_ITEMS[k]; const t = st.tier[k] == null ? 0 : st.tier[k]; const P = E.elvPrice(s, k, t); const ok = s.kamas >= P.k && s.elev.ess >= P.e;
        return `<div class="el-shop"><div class="grow"><b>${h(I.name)}</b> <span class="xs">${h(I.txt(I.v[t]))}</span><div class="el-tiers">${E.ROMAN5.map((r, i) => `<button class="el-tier" data-act="el-tier" data-k="${k}" data-v="${i}" aria-pressed="${t === i}">${r}</button>`).join("")}</div></div>
          ${E.elevAlm(s) ? `<span class="tag good">−${E.ALM_ITEMS} %</span>` : ""}<button class="btn sm ${ok ? "primary" : ""}" data-act="el-buy" data-k="${k}" data-v="${t}" ${ok ? "" : "disabled"}>${fmt(P.k)} k + ${fmt(P.e)} Ess.</button></div>`; }).join("")}
      ${inv.length ? `<div class="xs"><span class="muted">Dans le sac :</span> ${Object.entries(cnt).map(([key, n]) => { const [k, t] = key.split(":"); return `${h(E.ELV_ITEMS[k].name)} ${E.ROMAN5[+t]}${n > 1 ? ` ×${n}` : ""}`; }).join(", ")}</div>` : ""}
      <p class="note xs" style="margin:0">Un objet se pose sur un couple de l'enclos et sert à toutes les naissances de cet emplacement, puis s'use. Baffeur : étoiles. Caresseur : capacités. Foudroyeur : naissances plus rapides. Dragofesse : nouvelles couleurs.</p></div></section>`;
  }
  function ordersPanel(s) {
    const O = E.orders(s);
    if (!O.length) return `<section class="panel"><div class="phead"><h2>Commandes du jour</h2></div><div class="pad"><p class="note xs" style="margin:0">Capturez une première monture : des éleveurs vous en commanderont chaque jour.</p></div></section>`;
    return `<section class="panel"><div class="phead"><h2>Commandes du jour</h2><span class="xs muted">nouvelles à minuit</span></div><div class="pad stack" style="gap:6px">${O.map((o) => { const fit = E.orderFits(s, o);
      return `<div class="el-ord ${o.done ? "done" : ""}">${mImg(o.sp, o.c)}<div class="grow"><b>${h(spName(o.sp))} ${h(o.c)}</b> ${starsHtml(o.st, o.st)} <span class="xs muted">niveau ${o.lvl}+</span><div class="xs">${fmt(o.kamas)} kamas · ${fmt(o.ess)} Essence${o.nets ? ` · ${o.nets} filets` : ""}</div></div>
        ${o.done ? `<span class="tag good">livrée</span>` : `<button class="btn sm ${fit.length ? "primary" : ""}" data-act="el-ord" data-i="${o.i}" ${fit.length ? "" : "disabled"} data-tip="${h(fit.length ? `Livre ${E.mountName(fit[0])} ${"★".repeat(fit[0].st || 1)} niveau ${fit[0].lvl}` : "Aucune monture libre qui convient")}">Livrer</button>`}</div>`; }).join("")}
      <p class="note xs" style="margin:0">La monture livrée quitte l'écurie. Les montures montées, à l'enclos, en balade ou chromatiques ne sont jamais livrées.</p></div></section>`;
  }

  /* ======================= ÉCURIE ======================= */
  const FILTERS = [["all", "Toutes"], ["low", "★1-2"], ["cap", "Avec capacité"], ["ready", "Prêtes à l'enclos"], ["chr", "Chromatiques"]];
  const fOk = (s, M, f) => (f === "low" ? (M.st || 1) <= 2 : f === "cap" ? !!M.cap : f === "ready" ? !E.breedWhy(s, M) && !E.mountOwner(s, M.uid) : f === "chr" ? !!M.chr : true);
  function balPanel(s) {
    const B = s.elev.bal; const rows = B.map((b, i) => { const M = s.mounts[b.uid]; if (!M) return ""; const R = E.BAL[b.h];
      return `<div class="el-bal">${mImg(M.sp, M.c, M.chr)}<div class="grow"><b>${label(M)}</b> <span class="xs muted">${b.h} h · ${h((E.SUBS[E.MOUNT_SP[M.sp].sub] || {}).name || "")}</span><div class="xs">+${R.ess} Essence · ${R.res[0]} à ${R.res[1]} ressources${R.net ? " · parfois un filet" : ""}</div>
        <div class="xs muted" data-ebt="${i}">Retour dans ${eta(b.t)}</div><div class="bar"><i data-ebb="${i}" style="width:${100 - Math.round(b.t / (b.h * 3600e3) * 100)}%"></i></div></div><button class="btn sm" data-act="el-balstop" data-uid="${M.uid}">Rappeler</button></div>`; }).join("");
    return `<section class="panel"><div class="phead"><h2>Balades</h2><span class="xs muted">${B.length} / ${E.BAL_MAX}</span></div><div class="pad stack" style="gap:6px">${rows}
      ${B.length < E.BAL_MAX ? `<div class="row"><button class="btn sm primary" data-act="el-balpick">Envoyer en balade</button><span class="xs muted">niveau ${E.BAL_LVL} · 4 h (+${E.BAL[4].ess} Essence, ressources) ou 8 h (+${E.BAL[8].ess} Essence, 1 chance sur 20 : un filet) · continue hors ligne</span></div>` : ""}</div></section>`;
  }
  function mountRow(s, M) {
    const b = busyTxt(s, M); const w = E.breedWhy(s, M);
    return `<div class="li"><div class="petcard mountcard"><span class="peticon">${mImg(M.sp, M.c, M.chr)}</span><div class="grow stack" style="gap:2px;min-width:0">
      <div><b>${label(M)}</b> ${starsOf(M)} ${capTag(M.cap)} ${chrTag(M)}</div>
      <div class="xs muted">niveau ${M.lvl} · génération ${E.gen(M.sp, M.c)} · petits ${M.kids}/${E.kidsCap(s, M)}${b ? ` · ${b}` : !w ? " · prête à l'enclos" : ""}</div>
      <div class="small pbon">${h(statsNow(M))}</div></div>
      <div class="stack" style="gap:4px"><button class="btn sm" data-act="el-fiche" data-uid="${M.uid}">Fiche</button><button class="btn sm" data-act="el-free" data-uid="${M.uid}" ${E.inPair(s, M.uid) || E.onBalade(s, M.uid) ? "disabled" : ""}>Relâcher</button></div></div></div>`;
  }
  function ecurie(s) {
    const all = Object.values(s.mounts || {});
    const bySp = all.filter((M) => st.sp === "all" || M.sp === st.sp);
    const L = bySp.filter((M) => fOk(s, M, st.f));
    const sorts = { st: (a, b) => (b.st || 1) - (a.st || 1) || b.lvl - a.lvl, lvl: (a, b) => b.lvl - a.lvl || (b.st || 1) - (a.st || 1), col: (a, b) => E.MOUNT_ORDER.indexOf(a.sp) - E.MOUNT_ORDER.indexOf(b.sp) || E.gen(b.sp, b.c) - E.gen(a.sp, a.c) || a.c.localeCompare(b.c, "fr") };
    L.sort(sorts[st.sort] || sorts.st);
    const mass = E.massReleaseList(s); const massE = mass.reduce((a, M) => a + E.releaseEss(M), 0);
    const cap = E.stableCap(s); const canBuy = cap + E.STABLE_BUY <= E.STABLE_MAXCAP; const cost = E.stableBuyCost(s);
    return `<div class="el-2c"><div class="col">
      <section class="panel"><div class="phead"><h2>Écurie</h2><span class="xs muted">${E.stableN(s)} / ${cap} places</span></div><div class="pad stack" style="gap:8px">
        <div class="co-chips">${[["all", "Toutes", all.length]].concat(E.MOUNT_ORDER.map((sp) => [sp, spPl(sp), all.filter((M) => M.sp === sp).length])).map(([k, n, c]) => `<button class="co-chip" data-act="el-sp" data-v="${k}" aria-pressed="${st.sp === k}">${h(n)} <span class="n">${c}</span></button>`).join("")}</div>
        <div class="row"><span class="co-chips">${FILTERS.map(([k, n]) => `<button class="co-chip" data-act="el-f" data-v="${k}" aria-pressed="${st.f === k}">${h(n)} <span class="n">${bySp.filter((M) => fOk(s, M, k)).length}</span></button>`).join("")}</span>
          <select data-el="sort" aria-label="Tri">${[["st", "Tri : étoiles"], ["lvl", "Tri : niveau"], ["col", "Tri : couleur"]].map(([k, n]) => `<option value="${k}" ${st.sort === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        ${mass.length ? `<div class="el-mass"><div class="grow"><b>Relâcher en masse</b><div class="xs muted">${mass.length} monture${mass.length > 1 ? "s" : ""} à ★1-2, sans capacité ni nom, ni montées, ni à l'enclos, ni en balade, en gardant la meilleure de chaque couleur · rend ${fmt(massE)} Essence</div></div><button class="btn sm" data-act="el-masslist">Voir la liste</button><button class="btn sm primary" data-act="el-mass">Relâcher les ${mass.length}</button></div>` : ""}
      </div><div class="list">${L.map((M) => mountRow(s, M)).join("") || `<div class="empty">${all.length ? "Aucune monture avec ce filtre." : "Aucune monture : chassez dans une zone sauvage avec un filet de capture (onglet Capture)."}</div>`}</div>
      <div class="pad"><p class="note xs" style="margin:0">Étoiles : un petit a la moyenne de ses parents, avec ${E.ST_UP} % de chance d'en gagner une et ${E.ST_DOWN} % d'en perdre une. Chaque étoile ajoute ${String(E.ST_STEP * 100).replace(".", ",")} % à la stat de sa couleur (PA, PM et Invocation à part) : ★★★★★ = +50 %. Les captures naissent à ★.</p></div></section>
      </div><div class="col">${balPanel(s)}
      <section class="panel"><div class="phead"><h2>Agrandir l'écurie</h2><span class="xs muted">${cap} places</span></div><div class="pad stack" style="gap:6px">
        ${canBuy ? `<div class="row between"><span class="small"><b>+${E.STABLE_BUY} places</b> <span class="xs muted">${cap} → ${cap + E.STABLE_BUY}</span></span><button class="btn sm ${s.kamas >= cost ? "primary" : ""}" data-act="el-stbuy" ${s.kamas >= cost ? "" : "disabled"}>Acheter · ${fmt(cost)} k</button></div>` : `<span class="small">L'écurie a ses ${E.STABLE_MAXCAP} places.</span>`}
        <p class="note xs" style="margin:0">${E.STABLE} places, +${E.STABLE_ENCLOS} avec l'enclos, +${E.STABLE_CARNET} par carnet d'espèce complet, +${E.STABLE_BUY} par achat (le prix double à chaque fois), ${E.STABLE_MAXCAP} au plus.</p></div></section>
      ${essPanel(s)}</div></div>`;
  }
  function ficheSheet(uid) {
    const s = S(); const M = s.mounts[uid]; if (!M) { X().closeSheet(); return; }
    const cap = E.starCap(s, M); const mx = E.mountStatsMax(M.sp, M.c, M); const b = busyTxt(s, M); const v = s.elev;
    const anc = (c) => `<span class="el-anc">${mImg(M.sp, c)}${h(c)}</span>`;
    const fam = M.pc ? `<div class="el-fam"><span class="muted">Parents</span><span>${M.pc.map(anc).join("")}</span>${M.gc ? `<span class="muted">Grands-parents</span><span>${M.gc.map(anc).join("")}</span>` : ""}</div><div class="xs muted">Pureté : ${E.purity(M)} parent${E.purity(M) > 1 ? "s" : ""} sur 2 de sa couleur, elle ajoute +${5 * E.purity(M)} % de chance de nouvelle couleur quand elle est parent</div>` : `<div class="xs muted">${M.got ? "Capturée ou née avant la refonte : comptée comme pure (2 parents sur 2 de sa couleur)." : ""}</div>`;
    const toMax = E.MOUNT_MAX - M.lvl; const pol = M.pol === (E.dayKey ? E.dayKey() : "");
    const balWhy = E.baladeWhy(s, M); const balFull = v.bal.length >= E.BAL_MAX;
    X().openSheet(`<div class="el-sheet"><div class="row" style="gap:12px;align-items:center"><span class="el-big">${mImg(M.sp, M.c, M.chr)}</span><div class="grow stack" style="gap:3px;min-width:0">
        <h2 style="margin:0">${label(M)}</h2><div>${starsOf(M)} ${capTag(M.cap)} ${chrTag(M)}</div><span class="xs muted">niveau ${M.lvl} · génération ${E.gen(M.sp, M.c)} · petits ${M.kids}/${E.kidsCap(s, M)}${b ? ` · ${b}` : ""}</span></div></div>
      <div class="small"><span class="muted">Maintenant :</span> <b class="pbon">${h(statsNow(M))}</b></div>
      ${M.lvl < E.MOUNT_MAX ? `<div class="xs muted">Au niveau ${E.MOUNT_MAX} : ${h(bonusTxt(mx))}</div>` : ""}
      ${M.cap ? `<div class="xs"><b>${h(E.capName(M.cap))}</b> : ${h(E.CAPS[M.cap].txt)}</div>` : ""}
      ${fam}
      <div class="el-acts">
        <button class="btn sm" data-act="el-name" data-uid="${M.uid}">Renommer</button>
        ${toMax > 0 ? `<button class="btn sm" data-act="el-feed" data-uid="${M.uid}" data-n="1" ${v.ess >= E.ESS_LVL ? "" : "disabled"}>+1 niveau · ${E.ESS_LVL}</button>${toMax > 1 ? `<button class="btn sm" data-act="el-feed" data-uid="${M.uid}" data-n="10" ${v.ess >= E.ESS_LVL * Math.min(10, toMax) ? "" : "disabled"}>+${Math.min(10, toMax)} niveaux · ${fmt(E.ESS_LVL * Math.min(10, toMax))}</button>` : ""}` : ""}
        ${(M.st || 1) < cap ? `<button class="btn sm ${v.ess >= E.ESS_STAR && !pol ? "primary" : ""}" data-act="el-polish" data-uid="${M.uid}" ${v.ess >= E.ESS_STAR && !pol ? "" : "disabled"} data-tip="${pol ? "Déjà polie aujourd'hui" : "Une étoile par jour et par monture"}">+1 étoile · ${fmt(E.ESS_STAR)}</button>` : ""}
        ${!balWhy && !balFull ? `<button class="btn sm" data-act="el-bal" data-uid="${M.uid}" data-h="4">Balade 4 h</button><button class="btn sm" data-act="el-bal" data-uid="${M.uid}" data-h="8">Balade 8 h</button>` : ""}
        <button class="btn sm" data-act="el-free" data-uid="${M.uid}" ${E.inPair(s, M.uid) || E.onBalade(s, M.uid) ? "disabled" : ""}>Relâcher · +${fmt(E.releaseEss(M))} Essence</button></div>
      <div class="xs muted">Réserve : ${essTxt(v.ess)}</div>
      <div><button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }
  function balPickSheet() {
    const s = S(); const L = Object.values(s.mounts).filter((M) => !E.baladeWhy(s, M)).sort((a, b) => b.lvl - a.lvl);
    X().openSheet(`<div class="el-sheet"><h2>${IC("carte")} Envoyer en balade</h2><p class="small muted" style="margin:0">Niveau ${E.BAL_LVL} au moins, ni montée ni à l'enclos. Elle se promène dans sa zone sauvage, même hors ligne.</p>
      <div class="list">${L.map((M) => `<div class="li"><span class="icobox">${mImg(M.sp, M.c, M.chr)}</span><span class="grow"><b>${label(M)}</b> ${starsOf(M)}<br><span class="xs muted">niveau ${M.lvl}</span></span><button class="btn sm" data-act="el-bal" data-uid="${M.uid}" data-h="4">4 h</button><button class="btn sm primary" data-act="el-bal" data-uid="${M.uid}" data-h="8">8 h</button></div>`).join("") || `<div class="empty">Aucune monture libre de niveau ${E.BAL_LVL}.</div>`}</div>
      <div><button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }
  function massSheet() {
    const s = S(); const L = E.massReleaseList(s);
    X().openSheet(`<div class="el-sheet"><h2>Relâcher en masse</h2><div class="list">${L.map((M) => `<div class="li"><span class="icobox">${mImg(M.sp, M.c)}</span><span class="grow"><b>${h(E.mountName(M))}</b> ${starsOf(M)}<br><span class="xs muted">niveau ${M.lvl} · +${fmt(E.releaseEss(M))} Essence</span></span></div>`).join("")}</div>
      <div class="row"><button class="btn primary" data-act="el-mass">${L.length > 1 ? `Relâcher les ${L.length}` : "Relâcher"}</button><button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }

  /* ======================= CARNET ======================= */
  function carnet(s) {
    const tot = E.elevColoursTotal(); const seenN = E.MOUNT_ORDER.reduce((a, sp) => a + E.spSeen(s, sp), 0);
    const sp = MO()[st.csp] ? st.csp : "dd"; const Sp = MO()[sp]; const gens = {}; for (const c in Sp.cols) (gens[Sp.cols[c].g] = gens[Sp.cols[c].g] || []).push(c);
    const chrS = (s.elev.chrSeen[sp] || {}); const bicos = Object.keys(s.mountSeen[sp] || {}).filter(E.isBico);
    const chip = (c) => { const own = !!(s.mountSeen[sp] && s.mountSeen[sp][c]); const n = Object.values(s.mounts).filter((M) => M.sp === sp && M.c === c).length;
      return `<span class="mtchip ${own ? "own" : ""}" data-tip="${h(own ? `${spName(sp)} ${E.colourName(sp, c)} · au niveau 100 : ${bonusTxt(E.mountStatsMax(sp, c))}${Sp.cols[c] && Sp.cols[c].p ? ` · ${Sp.cols[c].p.join(" + ")}` : " · capture"}` : "Couleur jamais obtenue")}">${mImg(sp, c)}${n > 1 ? `<em>×${n}</em>` : ""}</span>`; };
    return `<div class="el-2c"><div class="col">
      <section class="panel"><div class="phead"><h2>Carnet de l'éleveur</h2><b class="num">${seenN} / ${tot}</b></div><div class="pad">
        ${E.MOUNT_ORDER.map((k) => { const a = E.spSeen(s, k), b = E.spColours(k).length, done = a >= b; const wild = E.MOUNT_SP[k].wild[0];
          return `<div class="el-sp">${mImg(k, wild)}<div class="grow"><b>${h(spPl(k))}</b> <span class="xs muted">${a} / ${b} couleurs</span><div class="bar"><i style="width:${Math.round(a / b * 100)}%"></i></div>
            <div class="xs ${done ? "" : "muted"}">${done ? "✓ " : ""}Titre « ${h(E.SP_TITLE[k])} », +${E.STABLE_CARNET} places d'écurie, une 6e étoile possible pour les ${h(spPl(k).toLowerCase())}</div></div>${done ? `<span class="tag good">obtenu</span>` : ""}</div>`; }).join("")}
        <p class="note xs" style="margin:6px 0 0">${E.grandEleveur(s) ? "✓ " : ""}Les trois carnets complets : titre « ${E.GRAND_TITLE} » et un 4e couple à l'enclos offert.</p></div></section>
      </div><div class="col"><section class="panel carnet"><div class="phead"><h2>Couleurs</h2><span class="seg">${E.MOUNT_ORDER.map((k) => `<button data-act="el-csp" data-v="${k}" aria-pressed="${sp === k}">${h(spPl(k))} <span class="num xs">${E.spSeen(s, k)}/${E.spColours(k).length}</span></button>`).join("")}</span></div><div class="pad stack">
        <div class="gens">${Object.keys(gens).sort().map((g) => { const L = gens[g]; const n = L.filter((c) => s.mountSeen[sp] && s.mountSeen[sp][c]).length;
          return `<div class="gen"><div class="gl"><b>Génération ${g}</b><span class="xs muted">${n} / ${L.length} couleurs${g == 1 ? " · capture" : ""}</span><div class="bar"><i style="width:${Math.round(n / L.length * 100)}%"></i></div></div><div class="chips">${L.map(chip).join("")}</div></div>`; }).join("")}
          ${bicos.length ? `<div class="gen"><div class="gl"><b>Bicolores</b><span class="xs muted">${bicos.length} obtenu${bicos.length > 1 ? "s" : ""}</span></div><div class="chips">${bicos.map(chip).join("")}</div></div>` : ""}
          <div class="gen"><div class="gl"><b>Chromatiques</b><span class="xs muted">${Object.keys(chrS).length} / ${E.spColours(sp).length} · 1 naissance sur ${E.CHR_ODDS}</span></div><div class="chips">${E.spColours(sp).filter((c) => chrS[c]).map((c) => `<span class="mtchip own">${mImg(sp, c, true)}</span>`).join("") || `<span class="xs muted">Aucune pour l'instant.</span>`}</div></div></div>
        <div class="row"><button class="btn sm" data-act="mtree">Voir l'arbre</button></div></div></section></div></div>`;
  }

  /* ======================= CAPTURE ======================= */
  function capture(s) {
    const nets = s.cons.filet || 0; const hunting = s.hunting && s.sub;
    return `<section class="panel"><div class="phead"><h2>Capture</h2><span class="row small">${IC("cristal")} <b class="num">${nets}</b> filet${nets > 1 ? "s" : ""}<button class="btn sm ${s.kamas >= E.NET_COST ? "primary" : ""}" data-act="buynet" ${s.kamas >= E.NET_COST ? "" : "disabled"}>Acheter 1 · ${fmt(E.NET_COST)} k</button></span></div>
      <div class="list">${E.MOUNT_ORDER.map((sp) => { const Z = E.MOUNT_SP[sp]; const sb = E.SUBS[Z.sub]; const here = hunting === Z.sub;
        return `<div class="li"><span class="icobox">${mImg(sp, Z.wild[0])}</span><span class="grow"><b>${h(spPl(sp))} sauvages</b> <span class="xs muted">héros niveau ${Z.req}</span><br><span class="xs muted">${h(sb.name)} (niv. ${sb.lvl[0]}-${sb.lvl[1]}) · couleurs : ${Z.wild.join(", ")}</span></span>${here ? `<span class="tag good">en chasse ici</span>` : `<button class="btn sm" data-act="searchzone" data-id="${h(Z.sub)}">${IC("carte")} Y aller</button>`}</div>`; }).join("")}</div>
      <div class="pad"><p class="note xs" style="margin:0">Avec un filet dans le sac, chaque victoire dans une zone sauvage peut capturer une monture ★ de niveau 1, en ligne comme hors ligne. Le filet n'est utilisé que si la capture réussit. Le Bricoleur en fabrique dès le niveau 40. Les autres couleurs naissent à l'enclos.</p></div></section>`;
  }

  /* ======================= SÉRIE 4 ======================= */
  /* 19A : « Pendant ton absence » */
  function awayBox(s) {
    const A = s.elev.away; if (!A) return "";
    const kids = (A.kids || []).map((u) => s.mounts[u]).filter(Boolean);
    const hrs = A.sec >= 3600 ? `${Math.floor(A.sec / 3600)} h ${String(Math.floor((A.sec % 3600) / 60)).padStart(2, "0")}` : `${Math.round(A.sec / 60)} min`;
    const todo = E.elevTodo(s);
    return `<section class="panel el-away"><div class="phead"><h2>Pendant ton absence</h2><span class="xs muted">${hrs} hors ligne</span></div><div class="pad stack" style="gap:6px">
      ${A.births ? `<div class="el-arow">${kids.slice(0, 4).map((M) => mImg(M.sp, M.c, M.chr)).join("")}<div class="grow"><b>${A.births} naissance${A.births > 1 ? "s" : ""} à l'enclos</b><div class="xs">${A.neu > 0 ? `${A.neu} nouvelle${A.neu > 1 ? "s" : ""} couleur${A.neu > 1 ? "s" : ""} · ` : ""}${kids.map((M) => `${h(E.colourName(M.sp, M.c))} ${"★".repeat(M.st || 1)}${M.cap ? ` (${h(E.capName(M.cap))})` : ""}`).join(", ")}</div></div></div>` : ""}
      ${A.bal ? `<div class="el-arow"><div class="grow"><b>${A.bal} balade${A.bal > 1 ? "s" : ""} terminée${A.bal > 1 ? "s" : ""}</b></div></div>` : ""}
      ${A.ess ? `<div class="xs">+${fmt(A.ess)} Essence en tout</div>` : ""}
      ${A.worn > 0 || todo.length ? `<div class="el-arow"><div class="grow"><b>À faire</b><div class="xs">${[A.worn > 0 ? `${A.worn} objet${A.worn > 1 ? "s" : ""} d'élevage usé${A.worn > 1 ? "s" : ""}` : ""].concat(todo).filter(Boolean).map(h).join(" · ")}</div></div></div>` : ""}
      <div><button class="btn sm primary" data-act="el-awayok">Compris</button></div></div></section>`;
  }
  /* 22A : quête « Apprenti éleveur » */
  function questPanel(s) {
    const q = s.elev.q || 0; if (q >= E.ELQ.length) return "";
    return `<section class="panel"><div class="phead"><h2>Apprenti éleveur</h2><span class="xs muted">quête de départ · ${q} / ${E.ELQ.length}</span></div><div class="pad">${E.ELQ.map((Q, i) => `<div class="el-q ${i === q ? "now" : ""}"><span class="ck ${i < q ? "ok" : ""}">${i < q ? "✓" : i + 1}</span><span class="grow">${h(Q.t)}</span><span class="xs muted">${h(Q.r)}</span></div>`).join("")}</div></section>`;
  }
  /* 24A : jour de l'élevage */
  const almBar = (s) => (E.elevAlm(s) ? `<div class="el-alm"><b>Aujourd'hui : jour de l'élevage</b> <span class="xs">${h(E.elevAlmTxt())}</span><span class="tag good">jusqu'à minuit</span></div>` : "");

  /* ======================= PAGE ======================= */
  const TABS = [["enclos", "Enclos"], ["ecurie", "Écurie"], ["carnet", "Carnet"], ["capture", "Capture"]];
  function pageHtml(s) {
    E.elevState(s);
    const n = { ecurie: `${E.stableN(s)}/${E.stableCap(s)}`, carnet: `${E.MOUNT_ORDER.reduce((a, sp) => a + E.spSeen(s, sp), 0)}/${E.elevColoursTotal()}`, enclos: s.enclos.built ? `${s.enclos.pairs.length}/${E.pairCap(s)}` : "" };
    const body = st.tab === "ecurie" ? ecurie(s) : st.tab === "carnet" ? carnet(s) : st.tab === "capture" ? capture(s)
      : `<div class="el-2c"><div class="col">${questPanel(s)}${autoPanel(s)}${enclosPanel(s)}${nextPanel(s)}</div><div class="col">${essPanel(s)}${shopPanel(s)}${ordersPanel(s)}</div></div>`;
    return `<div class="el-page"><div class="pagehead"><h1>Élevage</h1><span class="small muted">${essTxt(s.elev.ess)} · <span class="coin"></span> <b class="num">${fmt(s.kamas)}</b> kamas</span></div>
      ${almBar(s)}${awayBox(s)}<nav class="subtabs">${TABS.map(([k, nm]) => `<button data-act="el-tab" data-v="${k}" aria-pressed="${st.tab === k}">${nm}${n[k] ? ` <span class="num xs">${n[k]}</span>` : ""}</button>`).join("")}</nav>${body}</div>`;
  }
  function page(main, soft) {
    const s = S(); if (!s) return; const html = pageHtml(s);
    if ((soft || main.querySelector(":scope > .el-page")) && window.DX.morph) window.DX.morph(main, html); else main.innerHTML = html;
  }
  window.DX.pages.elev = (main) => page(main);
  const paint = () => { const m = $("#main"); if (UI().tab === "elev" && m) page(m, true); };
  const editing = () => { const a = document.activeElement; return a && (a.tagName === "SELECT" || a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
  let since = 0;
  setInterval(() => {
    const s = S(); if (!s || UI().tab !== "elev" || !s.elev) return;
    s.enclos.pairs.forEach((p, i) => { const t = document.querySelector(`[data-elt="${i}"]`); if (t && !p.wait) t.textContent = `Naissance dans ${eta(p.t)} · continue hors ligne`; const b = document.querySelector(`[data-elb="${i}"]`); if (b) b.style.width = `${100 - Math.round((p.t / (p.T || 1)) * 100)}%`; });
    s.elev.bal.forEach((x, i) => { const t = document.querySelector(`[data-ebt="${i}"]`); if (t) t.textContent = `Retour dans ${eta(x.t)}`; const b = document.querySelector(`[data-ebb="${i}"]`); if (b) b.style.width = `${100 - Math.round(x.t / (x.h * 3600e3) * 100)}%`; });
    if (++since >= 5 && !$("#sheet").innerHTML && !editing()) { since = 0; paint(); }
  }, 1000);

  /* ---------- actions ---------- */
  const done = (r, ok) => { if (r) { X().toast(r, "warn"); return false; } X().markDirty(); if (ok) X().toast(ok); return true; };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^el-/.test(a) || !S()) return;
    const s = S(); const d = t.dataset; const M = d.uid != null ? s.mounts[+d.uid] : null;
    switch (a) {
      case "el-tab": st.tab = d.v; X().render(); window.scrollTo(0, 0); return;
      case "el-auto": done(E.act(s, "setAuto", !s.elev.auto.on, null)); break;
      case "el-logall": st.logAll = !st.logAll; break;
      case "el-uneq": done(E.act(s, "elvUnequip", +d.s, d.k)); break;
      case "el-autoeq": { const n = E.act(s, "elvAutoEquip", +d.s); X().markDirty(); if (!n) X().toast("Rien à poser.", "warn"); break; }
      case "el-pair4": done(E.act(s, "pair4Buy")); break;
      case "el-tier": st.tier[d.k] = +d.v; break;
      case "el-buy": done(E.act(s, "elvBuy", d.k, +d.v), `${E.ELV_ITEMS[d.k].name} ${E.ROMAN5[+d.v]} acheté : il se pose sur un couple de l'enclos.`); break;
      case "el-ord": done(E.act(s, "orderDeliver", +d.i)); break; // 1.1.0.1 : la note du moteur suffit (le message s'affichait deux fois)
      case "el-sp": st.sp = d.v; break;
      case "el-f": st.f = d.v; break;
      case "el-csp": st.csp = d.v; break;
      case "el-fiche": ficheSheet(+d.uid); return;
      case "el-free": { if (!M) return; if (!confirm(`Relâcher ${E.mountName(M)} (niveau ${M.lvl}, ${"★".repeat(M.st || 1)}) ? Elle disparaît pour toujours et rend ${fmt(E.releaseEss(M))} Essence.`)) return;
        if (done(E.act(s, "releaseMount", M.uid), `${E.mountName(M)} est relâché${fem(M.sp)} : +${fmt(E.releaseEss(M))} Essence.`)) X().closeSheet(); break; }
      case "el-masslist": massSheet(); return;
      case "el-mass": { const L = E.massReleaseList(s); if (!L.length) return; if (!confirm(`Relâcher ${L.length > 1 ? `${L.length} montures faibles ? Elles disparaissent` : "1 monture faible ? Elle disparaît"} pour toujours.`)) return; done(E.act(s, "massRelease")); X().closeSheet(); break; }
      case "el-feed": if (done(E.act(s, "feedMount", +d.uid, +d.n))) ficheSheet(+d.uid); X().render(); return;
      case "el-polish": if (done(E.act(s, "polishMount", +d.uid))) ficheSheet(+d.uid); X().render(); return;
      case "el-name": { if (!M) return; const nm = prompt("Nom de la monture (20 caractères, vide pour retirer le nom)", M.nm || ""); if (nm === null) return; done(E.act(s, "renameMount", M.uid, nm)); ficheSheet(M.uid); X().render(); return; }
      case "el-bal": if (done(E.act(s, "baladeStart", +d.uid, +d.h), `Partie en balade pour ${+d.h} h.`)) X().closeSheet(); break;
      case "el-balstop": { if (!confirm("Rappeler cette monture ? La balade s'arrête sans rien rapporter.")) return; done(E.act(s, "baladeStop", +d.uid)); break; }
      case "el-balpick": balPickSheet(); return;
      case "el-stbuy": done(E.act(s, "stableBuy")); break;
      case "el-awayok": done(E.act(s, "awayOk")); break;
      case "el-go": UI().tab = "elev"; if (d.v) st.tab = d.v; X().closeSheet(); X().render(); window.scrollTo(0, 0); return;
      default: return;
    }
    X().render();
  });
  document.addEventListener("change", (ev) => { const t = ev.target; if (!t || !t.dataset || !t.dataset.el || !S()) return;
    if (t.dataset.el === "goal") { E.act(S(), "setAuto", null, t.value); X().markDirty(); }
    else if (t.dataset.el === "sort") st.sort = t.value; else return;
    t.blur(); X().render(); });

  /* ---------- fêtes (naissance exceptionnelle, carnet complet) ---------- */
  function cele(ev) {
    const s = S();
    if (ev.t === "elevrare") { const M = s.mounts[ev.uid]; if (!M) return "";
      const k = ev.kind === "chr" ? "Naissance chromatique !" : ev.kind === "st" ? `Naissance ${"★".repeat(M.st)}` : "Dernière génération";
      return `<div class="cele-art pet">${mImg(M.sp, M.c, M.chr, "celepet")}</div><div class="cele-k">${IC("ailes")} ${k}</div><div class="cele-t">${h(E.mountName(M))}</div><div class="cele-s">${ev.kind === "chr" ? "Une naissance sur 150 : couleurs inversées, halo doré et une étoile de plus possible." : `Au niveau ${E.MOUNT_MAX} : ${h(bonusTxt(E.mountStatsMax(M.sp, M.c, M)))}`} Tout le serveur l'apprend dans le chat (compte en ligne).</div>`; }
    if (ev.t === "elevcarnet") return `<div class="cele-art pet">${mImg(ev.sp, E.MOUNT_SP[ev.sp].wild[0], false, "celepet")}</div><div class="cele-k">${IC("trophee")} Carnet complet</div><div class="cele-t">${h(E.SP_TITLE[ev.sp])}</div><div class="cele-s">Titre débloqué, +${E.STABLE_CARNET} places d'écurie et une 6e étoile possible pour les ${h(spPl(ev.sp).toLowerCase())}.${E.grandEleveur(s) ? ` Les trois carnets : « ${E.GRAND_TITLE} » et un 4e couple !` : ""}</div>`;
    return "";
  }
  /* 11A : la monture montée à côté du héros (fiche Équipement) */
  function figMount(c) {
    const s = S(); const M = E.mountOf(s, c); if (!M || !E.mountStats(s, c)) return "";
    return `<span class="el-fig" data-tip="${h(`${E.mountLabel(M)} ${"★".repeat(M.st || 1)} · niveau ${M.lvl}`)}">${mImg(M.sp, M.c, M.chr)}</span>`;
  }
  /* pièce Enclos du Havre-Sac : un résumé et le lien vers la page */
  function roomHtml() {
    const s = S(); E.elevState(s);
    if (!s.enclos.built) return `<p class="note">L'enclos ouvre l'élevage : ${E.PAIRS_BASE} couples, étoiles, capacités, éleveur automatique. Il ajoute aussi ${E.STABLE_ENCLOS} places à l'écurie.</p><div class="row"><button class="btn sm ${s.kamas >= E.ENCLOS_COST ? "primary" : ""}" data-act="enclosbuild" ${s.kamas >= E.ENCLOS_COST ? "" : "disabled"}>Construire · ${fmt(E.ENCLOS_COST)} k</button><button class="btn sm" data-act="el-go">Ouvrir l'Élevage</button></div>`;
    const P = s.enclos.pairs.map((p) => { const A = s.mounts[p.a], B = s.mounts[p.b]; return A && B ? `<div class="xs">${h(E.colourName(A.sp, A.c))} + ${h(E.colourName(B.sp, B.c))} · ${p.wait ? "écurie pleine" : `naissance dans ${eta(p.t)}`}</div>` : ""; }).join("");
    return `<div class="stack" style="gap:6px">${P || `<p class="note xs" style="margin:0">Enclos libre.</p>`}<div class="xs muted">Éleveur automatique : ${s.elev.auto.on ? "allumé" : "éteint"} · ${essTxt(s.elev.ess)}</div><div><button class="btn sm primary" data-act="el-go">Ouvrir l'Élevage</button></div></div>`;
  }

  /* ---------- résumé envoyé au serveur : classement Élevage (elev) et naissances exceptionnelles (mrare) ---------- */
  if (window.VERIFY && window.VERIFY.summary && !window.VERIFY.summary.elev) {
    const sum0 = window.VERIFY.summary;
    window.VERIFY.summary = (E0, S0) => { const r = sum0(E0, S0); try { if (r && S0.mounts) { r.elev = E.elevSummary(S0); if (S0.elev && S0.elev.rare && S0.elev.rare.length) r.mrare = S0.elev.rare.slice(-10); } } catch (x) { /* résumé sans élevage */ } return r; };
    Object.assign(window.VERIFY.summary, sum0); window.VERIFY.summary.elev = 1;
  }
  if (E.carnetCat) E.carnetCat({ elvBuy: "monture", elvEquip: "monture", elvUnequip: "monture", elvAutoEquip: "monture", feedMount: "monture", polishMount: "monture", renameMount: "monture", massRelease: "monture", setAuto: "monture", baladeStart: "monture", baladeStop: "monture", orderDeliver: "monture", stableBuy: "monture", pair4Buy: "monture" });
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "elev")) E.SEARCH_PAGES.push(["elev", "Élevage", "Héros › Élevage : enclos, écurie, carnet, capture"]);

  window.ELEVUI = { page, cele, figMount, roomHtml, starsOf, capTag, open: (tab) => { if (tab) st.tab = tab; UI().tab = "elev"; X().render(); }, st };
})();
