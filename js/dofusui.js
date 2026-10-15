/* ============================================================================
   PAGE DOFUS (Héros › Dofus), Idlus 1.0.33. Demande de Mathis « avoir un menu spécialement pour les Dofus ».
   Choix de Mathis sur maquette (1A à 6A) : vitrine des 31 œufs, « À faire maintenant », Dofus animés (CSS seulement). 4 onglets :
   - Collection : œufs rangés par famille de passif, fiche du Dofus choisi à côté (passif, exemplaires, porteur, Potentiel, quête) ;
   - Quêtes et butin : la page de quêtes de js/questui.js (étapes, « Y aller », épingle, butin des boss) ;
   - Potentiel : la page de js/collui.js (rangs, éclat, Sublimé) ;
   - Par héros : une carte par héros (6 emplacements, primordiaux de l'Éveil des Dragons, Dofus libres qui lui iraient).
   Affichage seulement : rien ici ne touche aux chances d'obtenir un Dofus. Suivi › Quêtes › Dofus ouvre cette page.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.DOFUS || !window.DX) return;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const IC = (n) => X().IC(n);
  const im = (src, cls, alt) => X().im(src, cls, alt);
  const dimg = (id) => X().dofusImg(id);
  const st = { tab: "coll", f: "all", sel: null, pop: null };
  const TABS = [["coll", "Collection"], ["quetes", "Quêtes et butin"], ["pot", "Potentiel"], ["heros", "Par héros"]];

  const ids = () => E.DOFUS_ORDER.slice().sort((a, b) => E.DOFUS[a].lvl - E.DOFUS[b].lvl || (E.DOFUS[a].name < E.DOFUS[b].name ? -1 : 1));
  const copies = (s, id) => Object.values(s.items || {}).filter((it) => it.tpl === "dofus_" + id).length;
  const wearers = (s, id) => s.chars.filter((c) => E.dofpOf ? E.dofpOf(s, c).includes(id) : Object.values(c.equip).some((u) => s.items[u] && s.items[u].tpl === "dofus_" + id));
  const famCls = (id) => (E.DOFP_LIST && X().dofpFc ? "fam-" + X().dofpFc(id) : "");
  const roman = (n) => (E.roman ? E.roman(n) : String(n));
  const rankOf = (s, id) => (E.dpotRank ? E.dpotRank(s, id) : 0);
  const rankTxt = (r) => (r >= (E.DPOT_MAX || 10) ? "Sublimé" : `Potentiel ${r ? roman(r) : "0"}`);
  function state(s, id) {
    const Q = E.dofusQuest(s, id); const owned = E.dofusOwned(s, id);
    if (owned) return "got";
    return Q.step > 0 || E.dofusStepProgress(s, id, 0)[0] > 0 || (id === "ocre" && E.soulCount(s) > 0) ? "run" : "lock";
  }
  function questTxt(s, id) {
    const Df = E.DOFUS[id]; const Q = E.dofusQuest(s, id);
    if (Q.done) return "Quête terminée";
    if (id === "ocre") return `Éternelle moisson · palier ${E.ocreTier(s) + 1} sur ${E.OCRE_TIERS.length}`;
    if (Df.steps[0] && Df.steps[0].t === "gift") return "Cadeau de lancement";
    const [a, b] = E.dofusStepProgress(s, id, Q.step);
    return `Quête · étape ${Q.step + 1} sur ${Df.steps.length}${b > 1 ? ` (${fmt(Math.min(a, b))} / ${fmt(b)})` : ""}`;
  }

  /* ---------- 1.0.33 : choix de Mathis 1A à 6A (vitrine, œufs et fiche, familles, « À faire maintenant », cartes de héros, Dofus animés) ---------- */
  const FAMS = () => E.DOFP_FAMS || [];
  /* 6A : Dofus animés (flottent, brillent dans la couleur du passif, reflet ; aura dorée du Dofus Sublimé). Tout est en CSS (css/dofus.css), dans le navigateur ;
     « animations réduites » ou animations coupées dans les options : rien ne bouge */
  const live = (s) => !(s.settings && (s.settings.reduced || s.settings.anim === "none"));
  const isSub = (s, id) => !!(E.dpotSub && E.dofusOwned(s, id) && E.dpotSub(s, id));
  const absUrl = (u) => { try { return new URL(u, location.href).href; } catch (e) { return u; } }; // url() dans une variable CSS se lit depuis css/dofus.css : adresse complète
  const shine = (id) => `<span class="du-sh" style="--m:url('${absUrl(dimg(id))}')"></span>`;
  const spk = `<i class="du-spk" style="--x:-12px;--y:-14px;left:28%;top:22%"></i><i class="du-spk" style="--x:10px;--y:-8px;left:66%;top:34%;animation-delay:.5s"></i><i class="du-spk" style="--x:-5px;--y:12px;left:46%;top:66%;animation-delay:1s"></i>`;
  const qFrac = (s, id) => { const Df = E.DOFUS[id]; const Q = E.dofusQuest(s, id); if (Q.done) return 1; if (id === "ocre") { const t = E.ocreTier(s); const [a, b] = E.ocreProgress(s, Math.min(t, E.OCRE_TIERS.length - 1)); return (t + (b ? a / b : 0)) / E.OCRE_TIERS.length; }
    if (Df.steps[0] && Df.steps[0].t === "gift") return 0; const [a, b] = E.dofusStepProgress(s, id, Q.step); return (Q.step + (b ? Math.min(a, b) / b : 0)) / Df.steps.length; };
  const freeCopies = (s) => Object.values(s.items || {}).filter((it) => /^dofus_/.test(it.tpl) && !E.equippedBy(s, it.uid));
  function vitrine(s) {
    const L = ids(); const own = L.filter((id) => E.dofusOwned(s, id)).length; const pc = Math.round((own / L.length) * 100);
    const done = L.filter((id) => E.dofusQuest(s, id).done).length; const T = E.team(s); const worn = T.reduce((n, c) => n + (E.dofpOf ? E.dofpOf(s, c).length : 0), 0);
    const eveil = s.chars.filter((c) => E.dofpReso && E.dofpReso(s, c)).length; const pot = L.reduce((n, id) => n + (E.dofusOwned(s, id) ? rankOf(s, id) : 0), 0);
    const eggs = L.map((id, i) => { const got = E.dofusOwned(s, id); return `<button class="du-ve ${got ? "got" : ""} ${isSub(s, id) ? "sub" : ""} ${famCls(id)}" style="--i:${i % 7}" data-act="du-sel" data-v="${id}" title="${h(E.DOFUS[id].name)}">${im(dimg(id), "", E.DOFUS[id].name)}</button>`; }).join("");
    const pill = (v, l) => `<span class="du-vp"><b class="num">${v}</b>${l}</span>`;
    return `<section class="du-vit"><div class="du-ring" style="--p:${pc}"><b class="num">${own}</b><small>sur ${L.length}</small></div><div class="du-vr"><div class="du-vt"><b>Ta collection de Dofus</b><span class="xs muted">${pc} % · touche un œuf pour sa fiche</span></div><div class="du-shelf">${eggs}</div>
      <div class="du-vps">${pill(`${done}/${L.length}`, "quêtes finies")}${pill(`${worn}/${T.length * 6}`, "portés par l'équipe")}${E.dpotRank ? pill(pot, "rangs de Potentiel") : ""}${E.DOFP_PRIM ? pill(eveil, "Éveil des Dragons") : ""}</div></div></section>`;
  }
  function todoHtml(s) {
    const L = ids().filter((id) => !E.dofusQuest(s, id).done && !(E.DOFUS[id].steps[0] && E.DOFUS[id].steps[0].t === "gift")).map((id) => [id, qFrac(s, id)]).sort((a, b) => b[1] - a[1] || E.DOFUS[a[0]].lvl - E.DOFUS[b[0]].lvl).slice(0, 3);
    const fr = freeCopies(s);
    const cards = L.map(([id, f]) => { const stp = E.dofusStep(s, id); const go = stp && X().dofusStepGo ? X().dofusStepGo(stp) : "";
      return `<div class="du-td">${im(dimg(id), "du-tdi", E.DOFUS[id].name)}<div class="du-tdt"><b>${h(E.DOFUS[id].name)}</b><span class="bar"><i style="width:${Math.round(f * 100)}%"></i></span><span class="xs muted">${h(questTxt(s, id))}</span></div><div class="du-tdb">${go || `<button class="btn xs" data-act="du-q" data-v="${id}">Voir</button>`}</div></div>`; }).join("");
    return `<section class="panel du-todo"><div class="phead"><h2>${X().G ? X().G("target") : ""} À faire maintenant</h2><span class="xs muted">les 3 quêtes de Dofus les plus avancées</span></div><div class="pad stack" style="gap:8px">${cards || `<span class="small muted">Toutes les quêtes sont finies !</span>`}
      ${fr.length ? `<div class="du-free"><span class="small"><b>${fr.length} Dofus libre${fr.length > 1 ? "s" : ""}</b> dans le sac, portés par personne</span><span class="du-frl">${fr.slice(0, 8).map((it) => im(dimg(D.ITEMS[it.tpl].dofus), "du-fri", "")).join("")}</span><span class="grow"></span><button class="btn xs primary" data-act="du-tab" data-v="heros">Les équiper</button></div>` : ""}</div></section>`;
  }
  function ficheHtml(s, id) {
    const Df = E.DOFUS[id]; const got = E.dofusOwned(s, id); const Q = E.dofusQuest(s, id); const W = wearers(s, id); const cp = copies(s, id); const r = got ? rankOf(s, id) : 0;
    const stp = E.dofusStep(s, id); const f = qFrac(s, id);
    const stars = E.dpotRank ? `<span class="du-stars">${Array.from({ length: E.DPOT_MAX || 10 }, (_, i) => (i < r ? "★" : "☆")).join("")}</span>` : "";
    const pin = X().pinBtn && !Q.done && stp ? X().pinBtn({ k: "dof", id }, "Suivre") : "";
    return `<div class="panel du-fiche"><div class="pad stack" style="gap:10px"><div class="row" style="flex-wrap:nowrap;gap:12px"><span class="du-fegg ${got ? "got" : ""} ${isSub(s, id) ? "sub" : ""} ${famCls(id)}">${isSub(s, id) ? spk : ""}${im(dimg(id), "du-fpic" + (got ? "" : " off"), Df.name)}${got ? shine(id) : ""}</span><div class="grow"><h3>${h(Df.name)}</h3><span class="xs muted">niveau ${Df.lvl}</span><div class="qj-bon">${h(E.dofusBonusTxt(id))}</div></div></div>
      ${X().dofpBlock ? X().dofpBlock(id, { mini: true }) : ""}
      <div class="du-fs"><div><span class="xs muted">Exemplaires</span><b>${got ? `×${cp}` : "aucun"}</b></div><div><span class="xs muted">Porté par</span><b>${W.length ? W.map((c) => `<span class="du-hd"><img src="${X().headImg(c)}" alt="">${h(c.name)}</span>`).join(" ") : got ? "personne" : "—"}</b></div>${E.dpotRank && got ? `<div><span class="xs muted">${rankTxt(r)}</span>${stars}</div>` : ""}</div>
      <div class="du-fq"><div class="row between"><b class="small">${Q.done ? "✓ Quête terminée" : "Sa quête"}</b><span class="xs muted num">${Math.round(f * 100)} %</span></div><span class="bar"><i style="width:${Math.round(f * 100)}%"></i></span><span class="xs">${h(Q.done ? "Un exemplaire déjà reçu. Les copies viennent du butin du boss." : stp ? E.dofusStepTxt(stp) : questTxt(s, id))}</span>
        <div class="row" style="gap:6px;flex-wrap:wrap">${!Q.done && stp && X().dofusStepGo ? X().dofusStepGo(stp) : ""}${pin}<button class="btn xs" data-act="du-q" data-v="${id}">Toutes les étapes et le butin</button>${got && E.dpotRank ? `<button class="btn xs" data-act="du-pot" data-v="${id}">Potentiel</button>` : ""}</div></div></div></div>`;
  }
  function collHtml(s) {
    const L = ids(); const stt = Object.fromEntries(L.map((id) => [id, state(s, id)]));
    const list = L.filter((id) => st.f === "all" || stt[id] === st.f || (st.f === "miss" && stt[id] !== "got"));
    if (!st.sel || !E.DOFUS[st.sel]) st.sel = list.find((id) => stt[id] === "run") || L[0];
    const tile = (id) => { const Df = E.DOFUS[id]; const got = stt[id] === "got"; const W = wearers(s, id); const f = qFrac(s, id);
      const sub = got && isSub(s, id);
      return `<button class="du-tile ${stt[id]} ${famCls(id)} ${sub ? "sub" : ""} ${st.pop === id ? "pop" : ""}" style="--i:${ids().indexOf(id) % 5}" data-act="du-sel" data-v="${id}" aria-pressed="${st.sel === id}">${got && copies(s, id) > 1 ? `<span class="du-cp">×${copies(s, id)}</span>` : ""}${W.length ? `<span class="du-wh"><img src="${X().headImg(W[0])}" alt="">${W.length > 1 ? `+${W.length - 1}` : ""}</span>` : ""}<span class="du-egg">${sub ? spk : ""}${im(dimg(id), "", Df.name)}${got ? shine(id) : ""}</span><b>${h(Df.name.replace(/^Dofus (des |du )?/, ""))}</b>${sub ? `<small class="du-gold">Sublimé</small>` : ""}<em class="qj-pas ${famCls(id)}"><i></i>${h(E.dofpName(id))}</em>${got ? `<small class="plus">✓ obtenu</small>` : `<span class="bar sm"><i style="width:${Math.round(f * 100)}%"></i></span>`}</button>`; };
    let grid;
    if (FAMS().length) grid = FAMS().map((F) => { const g = list.filter((id) => E.dofpFam(id) === F); if (!g.length) return ""; const fc = X().dofpFcOf ? X().dofpFcOf(F) : "";
      return `<div class="du-fam fam-${fc}"><div class="du-famh"><i class="qj-fd"></i><b>${h(F)}</b><span class="xs muted num">${g.filter((id) => stt[id] === "got").length} / ${g.length}</span></div><div class="du-tiles">${g.map(tile).join("")}</div></div>`; }).join("");
    else grid = `<div class="du-tiles">${list.map(tile).join("")}</div>`;
    const n = (f) => L.filter((id) => f === "all" || stt[id] === f || (f === "miss" && stt[id] !== "got")).length;
    const fil = [["all", "Tous"], ["got", "Obtenus"], ["miss", "Manquants"], ["run", "Quête en cours"]];
    return `<div class="qj-fil">${fil.map(([k, l]) => `<button data-act="du-f" data-v="${k}" aria-pressed="${st.f === k}">${l} <b class="num">${n(k)}</b></button>`).join("")}</div><div class="du-lay"><div class="stack" style="gap:10px">${grid || `<div class="empty">Aucun Dofus dans cette liste.</div>`}</div>${ficheHtml(s, st.sel)}</div>`;
  }
  function herosHtml(s) {
    const T = E.team(s); const others = s.chars.filter((c) => !T.includes(c)); const fr = freeCopies(s);
    const card = (c) => {
      const w = E.dofpOf ? E.dofpOf(s, c) : []; const reso = E.dofpReso && E.dofpReso(s, c);
      const slots = D.DOFUS_SLOTS.map((sl) => { const it = s.items[c.equip[sl]]; const id = it && D.ITEMS[it.tpl] && D.ITEMS[it.tpl].dofus;
        if (it && id) return `<div class="du-hs on ${famCls(id)}">${im(dimg(id), "", E.DOFUS[id].name)}<b>${h(E.DOFUS[id].name.replace(/^Dofus (des |du )?/, ""))}</b><small>${h(E.dofpName(id))}</small></div>`;
        if (it) return `<div class="du-hs tro">${im(X().itemImg(it.tpl), "", D.ITEMS[it.tpl].name)}<b>${h(D.ITEMS[it.tpl].name)}</b><small>trophée</small></div>`;
        return `<div class="du-hs"><span class="du-plus">+</span><small>libre</small></div>`; }).join("");
      const prim = E.DOFP_PRIM ? E.DOFP_PRIM.map((id) => `<span class="du-pe ${w.includes(id) ? "on" : E.dofusOwned(s, id) ? "own" : ""}" title="${h(E.DOFUS[id].name)}${w.includes(id) ? " : porté" : E.dofusOwned(s, id) ? " : obtenu, pas porté" : " : pas encore obtenu"}">${im(dimg(id), "", "")}</span>`).join("") : "";
      const sug = fr.filter((it) => { const id = D.ITEMS[it.tpl].dofus; return !w.includes(id) && D.ITEMS[it.tpl].lvl <= c.lvl; }).filter((it, i, a) => a.findIndex((x) => x.tpl === it.tpl) === i).slice(0, 4);
      return `<div class="du-hc ${reso ? "reso" : ""}" data-k="h${c.id}"><div class="du-hch"><img class="du-hh" src="${X().headImg(c)}" alt=""><div class="grow"><b>${h(c.name)}</b><span class="xs muted"> ${h(D.CLASSES[c.cls].name)} niv. ${c.lvl}</span><div class="du-prim">${prim}<span class="xs ${reso ? "du-gold" : "muted"}">${reso ? `✦ Éveil des Dragons : passifs +${E.DOFP_RESO} %` : `Primordiaux ${E.DOFP_PRIM ? E.DOFP_PRIM.filter((id) => w.includes(id)).length : 0} / 6`}</span></div></div><button class="btn sm" data-act="du-hero" data-id="${c.id}">Changer</button></div>
        <div class="du-hss">${slots}</div>${sug.length && w.length < 6 ? `<div class="du-sug xs"><span class="muted">Libres pour ce héros :</span>${sug.map((it) => `<span class="du-hd">${im(dimg(D.ITEMS[it.tpl].dofus), "", "")}${h(E.DOFUS[D.ITEMS[it.tpl].dofus].name.replace(/^Dofus (des |du )?/, ""))}</span>`).join("")}</div>` : ""}</div>`;
    };
    return `<div class="du-hcs">${T.map(card).join("")}</div>${others.length ? `<h3 class="sec">Autres héros</h3><div class="du-hcs">${others.map(card).join("")}</div>` : ""}`;
  }

  /* ---------- la page ---------- */
  function page(main, soft) {
    const s = S(); if (!s) return;
    const C = window.COLL;
    if (C && C.potSet) { if (st.tab === "quetes" && C.potOn()) st.tab = "pot"; else if (st.tab === "pot" && !C.potOn()) C.potSet(true); else if (st.tab !== "pot" && C.potOn()) C.potSet(false); }
    const tabs = TABS.filter(([k]) => k !== "pot" || (C && C.potHtml));
    if (!tabs.some(([k]) => k === st.tab)) st.tab = "coll";
    const body = st.tab === "quetes" && window.QUI && window.QUI.dofusHtml ? window.QUI.dofusHtml(s) : st.tab === "pot" ? C.potHtml(s) : st.tab === "heros" ? herosHtml(s) : collHtml(s);
    const html = `<div class="pagehead"><h1>${IC("dofus")} Dofus</h1>${X().archiBtn && st.tab !== "quetes" ? X().archiBtn() : ""}</div>
      <div class="stack du-page ${live(s) ? "du-live" : ""}">${vitrine(s)}${st.tab === "coll" ? todoHtml(s) : ""}<nav class="subtabs">${tabs.map(([k, n]) => `<button data-act="du-tab" data-v="${k}" aria-pressed="${st.tab === k}">${n}</button>`).join("")}</nav><section class="stack">${body}</section></div>`;
    if (soft && window.DX.morph) window.DX.morph(main, html); else main.innerHTML = html;
  }
  window.DX.pages.dofus = page;

  /* ouvrir la page sur un onglet (et un Dofus) : anciens boutons « Où trouver les Dofus », « Voir la quête », Potentiel */
  function open(tab, id) {
    const ui = UI(); st.tab = tab || "coll";
    if (st.tab === "quetes" && window.QUI && window.QUI.pick && id) window.QUI.pick(id);
    if (window.COLL && window.COLL.potSet) window.COLL.potSet(st.tab === "pot");
    if (st.tab === "pot" && window.COLL && window.COLL.pickDofus) window.COLL.pickDofus(id || null);
    ui.tab = "dofus"; ui.slot = null; ui.zoneView = null; X().closeSheet(); X().render(); window.scrollTo(0, 0);
  }
  function act(a, t) {
    const d = t.dataset; const ui = UI(); const s = S(); if (!s) return;
    switch (a) {
      case "du-tab": st.tab = d.v; if (window.COLL && window.COLL.potSet) window.COLL.potSet(d.v === "pot"); break;
      case "du-f": st.f = d.v; break;
      case "du-sel": st.sel = d.v; st.pop = d.v; setTimeout(() => { st.pop = null; const n = document.querySelector(".du-tile.pop"); if (n) n.classList.remove("pop"); }, 700); st.tab = "coll"; if (window.COLL && window.COLL.potSet) window.COLL.potSet(false); X().render(); { const f = document.querySelector(".du-fiche"); if (f && window.matchMedia("(max-width:860px)").matches) f.scrollIntoView({ block: "start" }); } return;
      case "du-q": open("quetes", d.v); return;
      case "du-pot": open("pot", d.v); return;
      case "du-hero": ui.cid = +d.id; ui.tab = "team"; ui.teamBoard = false; ui.tview = "hero"; ui.hero = "equip"; ui.slot = null; ui.hlSlot = "dofus"; X().render(); window.scrollTo(0, 0); return;
      default: return;
    }
    X().render();
  }
  window.DOFUI = { act, open, page };
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "dofus")) E.SEARCH_PAGES.push(["dofus", "Dofus", "Héros › Dofus : collection, quêtes, butin des boss, Potentiel, Dofus de chaque héros"]);
})();
