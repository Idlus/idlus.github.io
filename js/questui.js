/* ============================================================================
   JOURNAL DE QUÊTES — interface (0.1.28). Refonte du menu Quêtes.
   Journal en 2 familles (Aujourd'hui, Aventures ; Succès et ornements ont leur page depuis 0.1.31), tableau du jour,
   quête principale (étape en cours en haut), Dofus en grille, Succès par famille,
   boutiques regroupées dans les Comptoirs, textes d'aide derrière un « ? ».
   Les pages Almanax, Avis, Commandes, Temples et Alignement gardent leur rendu (ui.js).
   Utilise les outils de l'interface exposés par ui.js (window.DX.social).
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const { MONSTERS, DUNGEONS, CLASSES } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const IC = (n) => X().IC(n);
  const st = { dof: null, dfil: "all", cat: null, shop: "prime", help: {} };

  const FAMS = [
    { id: "day", n: "Aujourd'hui", ic: "almanax", pages: [["jour", "Tableau du jour", "almanax"], ["almanax", "Almanax", "almanax"], ["bounty", "Avis de recherche", "carte"], ["commandes", "Commandes", "metiers"], ["temples", "Temples", "combat"]] },
    { id: "adv", n: "Aventures", ic: "quetes", pages: [["main", "Quête principale", "quetes"], ["dofus", "Dofus", "dofus"], ["align", "Alignement", "ailes"]] },
  ];
  const COL = [["ach", "Succès", "trophee"], ["orn", "Ornements", "couronne"]]; // 0.1.31 : page Succès à part (menu Suivi)
  const pageName = (qt) => (qt === "shops" ? "Comptoirs" : (FAMS.flatMap((F) => F.pages).concat(COL).find((p) => p[0] === qt) || [0, "Quêtes"])[1]);

  /* ---------- état du jour ---------- */
  const almState = (s) => { const A = E.almanax(s); const have = s.res[A.res] || 0; return { A, have, ready: !A.done && have >= A.qty }; };
  const cmdReady = (s, o) => o.got < o.n && (s.res[o.res] || 0) >= o.n - o.got;
  const templeLeft = (s) => { const T = E.templeState(s); return E.templeClasses(s).filter((k) => !T.done[k]); };
  /* ce qui est prêt maintenant : offrande, commandes à livrer en entier, Dopeuls à défier, défi du jour */
  function todo(s) {
    if (!s || !s.chars || !s.chars.length) return 0;
    let n = almState(s).ready ? 1 : 0;
    n += E.cmdState(s).list.filter((o) => cmdReady(s, o)).length;
    n += templeLeft(s).length;
    if (X().defiTodo && X().defiTodo()) n += 1; // 0.1.28.1 : défi du jour pas encore réussi
    return n;
  }
  const untilMidnight = () => { const t = E.now(); const d = new Date(t); d.setHours(24, 0, 0, 0); const m = Math.max(0, Math.round((d - t) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };

  /* compteurs du journal : [texte, classe] */
  function counter(s, id) {
    switch (id) {
      case "almanax": { const a = almState(s); return a.A.done ? ["faite", "ok"] : a.ready ? ["prête", "todo"] : ["à faire", ""]; }
      case "bounty": return [`${(s.bounties || []).length}`, ""];
      case "commandes": { const C = E.cmdState(s); const done = C.list.filter((o) => o.got >= o.n).length; return [`${done}/${C.list.length}`, done === C.list.length ? "ok" : C.list.some((o) => cmdReady(s, o)) ? "todo" : ""]; }
      case "temples": { const all = E.templeClasses(s).length; const left = templeLeft(s).length; return all ? [`${all - left}/${all}`, left ? "todo" : "ok"] : ["", ""]; }
      case "main": return [`${Math.min(s.quest.step, E.MAIN_QUEST.length)}/${E.MAIN_QUEST.length}`, s.quest.step >= E.MAIN_QUEST.length ? "ok" : ""];
      case "dofus": return [`${E.dofusCount(s)}/18`, ""];
      case "align": return [s.align ? `rang ${E.alignRankIdx(s)}` : "", ""];
      case "ach": return [`${Object.keys(s.ach).length}/${E.ACH.length}`, ""];
      case "orn": { const ids = Object.keys(E.ORN); return [`${ids.filter((id) => E.ornUnlocked(s, id)).length}/${ids.length}`, ""]; }
    }
    return ["", ""];
  }
  const cnt = (s, id) => { const [t, c] = counter(s, id); return t ? `<span class="qj-cnt ${c}">${h(t)}</span>` : ""; };

  /* ---------- journal (PC) et familles (téléphone) ---------- */
  function journal(s, qt) {
    const left = todo(s);
    return `<aside class="qj-journal" aria-label="Journal de quêtes"><div class="qj-jh">${IC("quetes")}<h3>Journal</h3></div>
      ${FAMS.map((F) => `<div class="qj-grp"><div class="qj-gt">${F.n}${F.id === "day" ? `<i>dans ${untilMidnight()}</i>` : ""}</div>
        ${F.pages.map(([id, n, ic]) => `<button class="qj-ji" data-act="qtab" data-v="${id}" ${qt === id ? 'aria-current="page"' : ""}>${IC(ic)}<b>${n}</b>${id === "jour" && left ? `<span class="qj-pip" title="${left} chose${left > 1 ? "s" : ""} à faire"></span>` : cnt(s, id)}</button>`).join("")}</div>`).join("")}
      <button class="qj-shopbtn" data-act="qtab" data-v="shops" ${qt === "shops" ? 'aria-current="page"' : ""}>${IC("bourse")}<b>Comptoirs</b><span>3 boutiques</span></button></aside>`;
  }
  /* téléphone : une seule rangée d'onglets (0.1.31) */
  function mtabs(s, qt) {
    const left = todo(s);
    return `<div class="qj-m"><div class="qj-chips">${FAMS.flatMap((F) => F.pages).map(([id, n]) => `<button data-act="qtab" data-v="${id}" aria-pressed="${qt === id}">${n}${id === "jour" ? (left ? ' <span class="qj-pip"></span>' : "") : cnt(s, id)}</button>`).join("")}<button data-act="qtab" data-v="shops" aria-pressed="${qt === "shops"}">${IC("bourse")} Comptoirs</button></div></div>`;
  }

  /* en-tête de page : titre, compteur, bouton « ? » (aide repliée) */
  function head(s, id, help, extra = "") {
    const open = !!st.help[id];
    return `<div class="qj-ph"><h2>${h(pageName(id))}</h2>${cnt(s, id)}<span class="grow"></span>${extra}${help ? `<button class="qj-help" data-act="qj-help" data-v="${id}" aria-expanded="${open}" title="${open ? "Masquer l'aide" : "Comment ça marche ?"}">?</button>` : ""}</div>${help && open ? `<p class="note qj-note">${help}</p>` : ""}`;
  }
  /* sort le texte d'aide (<p class="note"> du début) d'une page de ui.js */
  const splitNote = (html) => { const m = html.match(/^\s*<p class="note">([\s\S]*?)<\/p>/); return m ? [m[1], html.slice(m[0].length)] : ["", html]; };

  /* ---------- tableau du jour ---------- */
  function jourHtml(s) {
    const q = E.questStep(s); const qp = E.questProgress(s); const cur = s.quest.step;
    const hero = q ? `<div class="qj-hero"><div class="qj-chap">${IC("quetes")}</div>
        <div class="qj-hb"><span class="qj-eb">Quête principale · étape ${cur + 1} sur ${E.MAIN_QUEST.length}</span><h2>${h(q.title)}</h2><span class="small muted">${h(q.txt)}</span>
          ${qp ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div>` : ""}
          ${E.questExtraText(cur) ? `<span class="qj-rew">${IC("coffre")} Récompense : <b>${h(E.questExtraText(cur))}</b></span>` : ""}</div>
        <div class="qj-acts">${q.sub ? `<button class="btn primary sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}<button class="btn sm" data-act="qtab" data-v="main">Toute la quête</button></div></div>`
      : `<div class="qj-hero"><div class="qj-chap">${IC("trophee")}</div><div class="qj-hb"><span class="qj-eb">Quête principale</span><h2>Terminée</h2><span class="small muted">Les Dofus, l'alignement et l'Expédition attendent dans Aventures.</span></div><div class="qj-acts"><button class="btn sm" data-act="qtab" data-v="dofus">Les Dofus</button></div></div>`;
    // Almanax
    const a = almState(s); const A = a.A; const d = new Date(E.now()); const sn = (s.almStreak && s.almStreak.n) || 0;
    const nextT = E.ALM_TIERS.find((t) => t > sn);
    const alm = `<article class="qj-card ${a.ready ? "hot" : ""} ${A.done ? "done" : ""}"><div class="qj-ch">${IC("almanax")}<h3>Almanax</h3>${A.done ? `<span class="qj-tag ok">Offrande faite ✓</span>` : a.ready ? `<span class="qj-tag ready">Prêt à offrir</span>` : `<span class="qj-tag">À faire</span>`}</div>
      <div class="qj-alm"><div class="qj-cal"><b>${d.getDate()}</b><span>${d.toLocaleDateString("fr-FR", { month: "short" })}</span></div><div class="grow stack" style="gap:3px">
        <span class="small row" style="gap:6px">${X().im(X().resImg(A.res), "ico sm", A.res)} <b>${A.qty} × ${h(A.res)}</b> <span class="muted">· ${fmt(a.have)} en banque</span></span>
        <span class="small">${h(A.mer)} : <b class="plus">${h(A.bonus.txt)}</b> jusqu'à minuit</span>
        <span class="xs muted row" style="gap:6px"><span class="qj-streak">${Array.from({ length: 7 }, (_, i) => `<i class="${i < sn % 7 || (sn && sn % 7 === 0) ? "on" : ""}"></i>`).join("")}</span>série ${sn} j${nextT ? ` · palier à ${nextT} j` : ""}</span></div></div>
      <div class="row">${A.done ? "" : `<button class="btn sm ${a.ready ? "primary" : ""}" data-act="almanax" ${a.ready ? "" : "disabled"}>Faire l'offrande</button>`}<button class="btn sm" data-act="qtab" data-v="almanax">Ouvrir</button></div></article>`;
    // Avis de recherche
    const bs = s.bounties || [];
    const avis = `<article class="qj-card"><div class="qj-ch">${IC("carte")}<h3>Avis de recherche</h3><span class="qj-tag">${fmt(s.tokens[E.SHOPS.prime.cur] || 0)} jetons</span></div>
      ${bs.map((b) => { const m = MONSTERS[b.key]; const where = b.dg ? DUNGEONS[b.dg].name : E.SUBS[b.sub] ? E.SUBS[b.sub].name : "";
        return `<div class="qj-mini">${X().im(X().imgM(b.key), "", m.name)}<span class="grow"><b>${h(m.name)}</b><br><span class="xs muted">${b.dg ? "Boss · " : ""}${h(where)}</span></span><div class="bar"><i style="width:${X().pct(b.prog, b.n)}%"></i></div><span class="num xs">${b.prog}/${b.n}</span></div>`; }).join("") || `<span class="small muted">Aucun avis pour l'instant.</span>`}
      <div class="row"><button class="btn sm" data-act="qtab" data-v="bounty">Ouvrir</button><span class="xs muted">un avis rempli est remplacé aussitôt</span></div></article>`;
    // Commandes
    const C = E.cmdState(s); const cdone = C.list.filter((o) => o.got >= o.n).length;
    const cmd = `<article class="qj-card ${C.list.some((o) => cmdReady(s, o)) ? "hot" : ""} ${cdone === C.list.length ? "done" : ""}"><div class="qj-ch">${IC("metiers")}<h3>Commandes d'artisans</h3><span class="qj-tag ${cdone === C.list.length ? "ok" : ""}">${cdone} / ${C.list.length} livrées</span></div>
      ${C.list.map((o) => { const ok = o.got >= o.n; const rd = cmdReady(s, o);
        return `<div class="qj-mini">${X().im(X().resImg(o.res), "", o.res)}<span class="grow"><b>${o.n} × ${h(o.res)}</b><br><span class="xs muted">${h(E.CMD_ARTS[o.art])}${o.urgent ? " · urgent" : ""}</span></span>${ok ? `<span class="qj-tag ok">Livrée ✓</span>` : rd ? `<button class="btn sm primary" data-act="vi-deliver" data-id="${o.id}">Livrer</button>` : `<span class="num xs muted">${Math.min(o.got + (s.res[o.res] || 0), o.n)}/${o.n}</span>`}</div>`; }).join("")}
      <div class="row"><button class="btn sm" data-act="qtab" data-v="commandes">Ouvrir</button><span class="xs muted">${C.bonus === C.day ? "coffre du jour reçu ✓" : "tout livrer : coffre du jour"}</span></div></article>`;
    // Temples
    const T = E.templeState(s); const cls = E.templeClasses(s); const left = cls.filter((k) => !T.done[k]); const pend = T.pend || T.fighting;
    const tpl = `<article class="qj-card ${left.length && !pend ? "hot" : ""} ${cls.length && !left.length ? "done" : ""}"><div class="qj-ch">${IC("combat")}<h3>Temples</h3><span class="qj-tag ${left.length ? "" : "ok"}">${cls.length - left.length} / ${cls.length} Dopeuls</span></div>
      <div class="qj-tpls">${cls.map((k) => { const CL = CLASSES[k]; const dn = T.done[k];
        return `<span class="qj-tpl ${dn ? "done" : ""}" style="--cc:${CL.color}"><i><img src="${X().symImg(k)}" alt=""></i>${h(CL.name)}<span class="xs ${dn ? "plus" : "muted"}">${dn ? "vaincu ✓" : pend === k ? "arrive" : "à défier"}</span></span>`; }).join("") || `<span class="small muted">Aucun héros.</span>`}</div>
      <div class="row">${pend ? `<span class="xs muted grow">Le Dopeul ${h(CLASSES[pend].name)} ${T.fighting ? "affronte l'équipe" : "arrive au prochain combat"}.</span>` : left.length ? `<button class="btn sm primary" data-act="vi-tfight" data-v="${left[0]}">Défier ${h(CLASSES[left[0]].name)}</button>` : ""}<button class="btn sm" data-act="qtab" data-v="temples">Ouvrir</button></div></article>`;
    // les cartes terminées descendent en bas
    const cards = [[alm, A.done], [avis, false], [cmd, cdone === C.list.length], [tpl, cls.length && !left.length]].sort((x, y) => x[1] - y[1]).map((c) => c[0]).join("");
    return `<div class="qj-ph"><h2>Aujourd'hui</h2><span class="grow"></span><span class="xs muted">${IC("almanax")} Tout se renouvelle à minuit, dans <b class="num">${untilMidnight()}</b></span></div>${hero}${X().defiLine ? X().defiLine() : ""}<div class="qj-day">${cards}</div>`;
  }

  /* ---------- quête principale ---------- */
  function mainHtml(s) {
    const Q = E.MAIN_QUEST; const cur = s.quest.step; const qp = E.questProgress(s);
    const step = (i, cls) => { const q = Q[i]; if (!q) return ""; const lock = cls === "lock"; const rw = E.questExtraText(i);
      return `<div class="qj-step ${cls}"><span class="n">${lock ? "?" : i + 1}</span><div class="grow stack" style="gap:4px"><b>${lock ? "???" : h(q.title)}</b><span class="small muted">${lock ? "Termine les étapes précédentes." : h(q.txt)}</span>
        ${cls === "cur" && qp ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div>` : ""}
        ${!lock && rw ? `<span class="qj-rew">${IC("coffre")} ${cls === "cur" ? "Récompense" : "Puis"} : <b>${h(rw)}</b></span>` : ""}</div>
        ${cls === "cur" ? `<div class="qj-side"><span class="pinbtn auto" data-tip="La quête principale est toujours suivie dans la bande d'objectifs">${X().G("pin")} suivie</span>${q.sub ? `<button class="btn sm primary" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>` : ""}</div>`; };
    const bar = `<div class="qj-chapbar" aria-label="Avancée : ${Math.min(cur, Q.length)} étapes sur ${Q.length}">${Q.map((q, i) => `<i class="${i < cur ? "ok" : i === cur ? "cur" : ""}" title="${i <= cur + 2 ? h(q.title) : "???"}"></i>`).join("")}</div>`;
    const done = Q.slice(0, Math.min(cur, Q.length));
    const doneList = done.length ? `<details class="qj-done" ${cur >= Q.length || st.doneOpen ? "open" : ""}><summary>${done.length} étape${done.length > 1 ? "s" : ""} terminée${done.length > 1 ? "s" : ""} <span class="xs muted">(récompenses reçues)</span></summary><div class="qj-dl">${done.map((q, i) => `<div><b>✓</b><span class="grow">${i + 1}. ${h(q.title)}</span><span class="xs">${h(E.questExtraText(i) || "")}</span></div>`).join("")}</div></details>` : "";
    const body = cur < Q.length ? `${step(cur, "cur")}${cur + 1 < Q.length ? `<div class="stack" style="gap:8px"><span class="qj-lab">Ensuite</span>${step(cur + 1, "next")}${step(cur + 2, "next")}${step(cur + 3, "lock")}</div>` : ""}`
      : `<div class="qj-step cur"><span class="n">✓</span><div class="grow"><b>Quête principale terminée</b><div class="small muted">Bravo ! Toutes les étapes sont faites.</div></div></div>`;
    return `${head(s, "main", "La quête principale guide les premiers pas : chaque étape se valide toute seule en jouant et donne une récompense. L'étape en cours est toujours suivie dans la bande d'objectifs, en haut de l'écran.")}
      <section class="panel"><div class="pad stack">${bar}${body}${doneList}</div></section>`;
  }

  /* ---------- Dofus ---------- */
  function dofState(s, id) {
    const Q = E.dofusQuest(s, id); const owned = E.dofusOwned(s, id);
    return Q.done || owned ? "got" : Q.step > 0 || E.dofusStepProgress(s, id, 0)[0] > 0 || (id === "ocre" && E.soulCount(s) > 0) ? "run" : "lock";
  }
  function dofusHtml(s) {
    const ids = E.DOFUS_ORDER.slice().sort((a, b) => E.DOFUS[a].lvl - E.DOFUS[b].lvl || (E.DOFUS[a].name < E.DOFUS[b].name ? -1 : 1));
    const stt = Object.fromEntries(ids.map((id) => [id, dofState(s, id)]));
    if (!st.dof || !E.DOFUS[st.dof]) st.dof = ids.find((id) => stt[id] === "run") || ids.find((id) => stt[id] === "lock") || ids[0];
    const list = ids.filter((id) => st.dfil === "all" || stt[id] === st.dfil);
    const tier = E.ocreTier(s);
    const dots = (id) => { const Df = E.DOFUS[id]; const Q = E.dofusQuest(s, id);
      if (id === "ocre") return E.OCRE_TIERS.map((T, i) => `<i class="${i < tier ? "ok" : i === tier && stt[id] === "run" ? "cur" : ""}"></i>`).join("");
      return Df.steps.map((x, i) => `<i class="${Q.done || i < Q.step ? "ok" : i === Q.step && stt[id] === "run" ? "cur" : ""}"></i>`).join(""); };
    const eggs = list.map((id) => { const Df = E.DOFUS[id];
      return `<button class="qj-egg ${stt[id]}" data-act="qj-dof" data-v="${id}" aria-pressed="${st.dof === id}">${X().im(X().dofusImg(id), "", Df.name)}<b>${h(Df.name.replace(/^Dofus /, ""))}</b><small>niv. ${Df.lvl}</small><span class="qj-dots">${dots(id)}</span></button>`; }).join("") || `<p class="small muted">Aucun Dofus dans cette liste.</p>`;
    // fiche du Dofus choisi (mêmes informations que l'ancienne carte)
    const id = st.dof; const Df = E.DOFUS[id]; const Q = E.dofusQuest(s, id); const owned = E.dofusOwned(s, id); const by = E.dofusWornBy(s, id);
    const state = Q.done ? `Quête terminée${by ? ` · porté par ${h(by.name)}` : owned ? " · dans le sac" : ""}` : owned ? `Obtenu en butin${by ? ` · porté par ${h(by.name)}` : ""} · quête en cours` : stt[id] === "run" ? `Quête en cours${id === "ocre" ? "" : ` · étape ${Q.step + 1} sur ${Df.steps.length}`}` : "Quête à commencer";
    const steps = id === "ocre" ? E.OCRE_TIERS.map((T, i) => { const [dd, all] = E.ocreProgress(s, i); return `<li class="${i < tier ? "ok" : dd ? "cur" : "todo"}">Palier ${i + 1} · ${h(T.name)} <span class="num muted">${dd} / ${all}</span></li>`; }).join("")
      : Df.steps.map((x, i) => { const [a, bb] = E.dofusStepProgress(s, id, i); const cls = Q.done || i < Q.step ? "ok" : i === Q.step ? "cur" : "todo";
        return `<li class="${cls}">${h(E.dofusStepTxt(x))}${cls === "cur" && bb > 1 ? ` <span class="num muted">${fmt(a)} / ${fmt(bb)}</span>` : ""}${cls === "cur" && x.dg && DUNGEONS[x.dg] ? ` <button class="btn xs" data-act="dgopen" data-id="${x.dg}">Voir le donjon</button>` : ""}</li>`; }).join("");
    const drop = Df.dg ? `Butin du boss ${h(MONSTERS[DUNGEONS[Df.dg].boss].name)} : 1 chance sur ${Math.round(1 / E.DOFUS_DROP)} dès la stasis ${E.DOFUS_DROP_STASIS}` : `Butin de tout boss de niveau 160 ou plus : 1 chance sur ${Math.round(1 / E.OCRE_DROP)} dès la stasis 8`;
    const fiche = `<div class="panel qj-fiche"><div class="pad stack" style="gap:10px"><div class="row" style="flex-wrap:nowrap">${X().im(X().dofusImg(id), "qj-fpic", Df.name)}<div class="grow"><h3>${h(Df.name)}</h3><span class="xs muted">niveau ${Df.lvl}</span><div class="qj-bon">${h(E.dofusBonusTxt(id))}</div></div></div>
      <span class="qj-tag ${stt[id] === "got" ? "ok" : stt[id] === "run" ? "todo" : ""}" style="justify-self:start">${state}</span>
      <ol class="qj-steps">${steps}</ol><span class="xs muted">${drop}${owned ? ` · copie pour un autre héros chez le Bricoleur (${Math.round(Df.lvl * 1.5)} Poussière de stasis)` : ""}</span></div></div>`;
    const n = (f) => ids.filter((x) => f === "all" || stt[x] === f).length;
    const fil = [["all", "Tous"], ["run", "En cours"], ["lock", "À commencer"], ["got", "Obtenus"]];
    return `${head(s, "dofus", "Chaque Dofus a sa quête : les étapes se valident toutes seules en jouant (les donjons déjà vaincus à la stasis demandée comptent). Un Dofus peut aussi tomber, très rarement, en butin du boss de son donjon. Une fois obtenu, une copie pour un autre héros se fabrique chez le Bricoleur avec de la Poussière de stasis. Un héros ne porte qu'un exemplaire de chaque Dofus, dans ses 6 emplacements Dofus/Trophée.", X().archiBtn())}
      <div class="qj-fil">${fil.map(([k, l]) => `<button data-act="qj-dfil" data-v="${k}" aria-pressed="${st.dfil === k}">${l} <b class="num">${n(k)}</b></button>`).join("")}</div>
      <div class="qj-dofl"><div class="qj-eggs">${eggs}</div>${fiche}</div>`;
  }

  /* ---------- succès ---------- */
  const CAT_IC = { Progression: "trophee", Combat: "combat", Donjons: "cle", Chasse: "carte", Objets: "dofus", Métiers: "pioche", Forgemagie: "forge", Quêtes: "quetes", Alignement: "ailes", "Havre-Sac": "havre", Archimonstres: "dofus", Expédition: "carte", Exploration: "monde" };
  const catIc = (c) => (c === "Idoles" ? `<img class="uico" src="assets/id/pro.webp" alt="">` : IC(CAT_IC[c] || "trophee"));
  function achItem(s, a) {
    const got = s.ach[a.id]; const pr = !got && E.achProgress(s, a.id);
    return `<div class="ach ${got ? "ok" : ""}"><span class="ic">${got ? IC("trophee") : "·"}</span><span class="grow"><b>${h(a.name)}</b>${pr ? ` <span class="xs num">${fmt(Math.min(pr[0], pr[1]))}/${fmt(pr[1])}</span>` : ""}<br><span class="xs muted">${h(a.desc)} · ${fmt(a.kamas)} k${a.title ? ` · titre « ${h(a.title)} »` : ""}</span></span>${pr ? X().pinBtn({ k: "ach", id: a.id }) : ""}</div>`;
  }
  function achHtml(s) {
    const cats = [...new Set(E.ACH.map((a) => a.cat))];
    const prog = (a) => { if (s.ach[a.id]) return 2; const p = E.achProgress(s, a.id); return p && p[1] ? Math.min(0.999, p[0] / p[1]) : 0; };
    const near = E.ACH.filter((a) => !s.ach[a.id]).map((a) => [a, prog(a)]).filter((x) => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 3);
    if (!st.cat || !cats.includes(st.cat)) st.cat = near.length ? near[0][0].cat : cats[0];
    const tiles = cats.map((c) => { const all = E.ACH.filter((a) => a.cat === c); const g = all.filter((a) => s.ach[a.id]).length;
      return `<button class="qj-cat" data-act="qj-cat" data-v="${h(c)}" aria-pressed="${st.cat === c}"><span class="row" style="flex-wrap:nowrap">${catIc(c)}<b class="grow">${h(c)}</b><span class="num xs muted">${g}/${all.length}</span></span><div class="bar"><i style="width:${X().pct(g, all.length)}%"></i></div></button>`; }).join("");
    const list = E.ACH.filter((a) => a.cat === st.cat).map((a) => [a, prog(a)]).sort((x, y) => (x[1] === 2) - (y[1] === 2) || y[1] - x[1]).map((x) => achItem(s, x[0])).join("");
    return `${head(s, "ach", "Les succès se débloquent tout seuls en jouant et donnent des kamas, parfois un titre. Le bouton épingle suit un succès dans la bande d'objectifs.")}
      ${near.length ? `<div class="stack" style="gap:8px"><span class="qj-lab">Presque terminés</span><div class="qj-near">${near.map(([a, r]) => { const p = E.achProgress(s, a.id);
        return `<div class="qj-nc"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b>${h(a.name)}</b>${X().pinBtn({ k: "ach", id: a.id })}</div><span class="xs muted">${h(a.desc)} · ${fmt(a.kamas)} k${a.title ? ` · titre « ${h(a.title)} »` : ""}</span><div class="row"><div class="bar grow"><i style="width:${Math.round(r * 100)}%"></i></div><span class="num xs">${fmt(Math.min(p[0], p[1]))}/${fmt(p[1])}</span></div></div>`; }).join("")}</div></div>` : ""}
      <div class="qj-cats">${tiles}</div>
      <section class="panel"><div class="phead"><h2>${catIc(st.cat)} ${h(st.cat)}</h2><span class="xs muted">les plus proches en haut, les obtenus en bas</span></div><div class="pad achgrid">${list}</div></section>`;
  }
  function ornHtml(s) {
    return `${head(s, "orn", "Les ornements entourent la carte d'un héros. Ils se débloquent avec les succès, les quêtes et les boutiques, et s'équipent dans Héros › Ornement.")}${X().ornHtml()}`;
  }

  /* ---------- comptoirs ---------- */
  function shopsHtml(s) {
    const ids = Object.keys(E.SHOPS).filter((id) => ["prime", "cite", "temple"].includes(id));
    if (!ids.includes(st.shop)) st.shop = ids[0];
    const Sh = E.SHOPS;
    return `${head(s, "shops", "Les boutiques des quêtes réunies : le Bureau des primes (jetons des avis de recherche), le Comptoir de la cité (insignes d'alignement) et le Comptoir des temples (Doplons des Dopeuls).")}
      <div class="qj-fil">${ids.map((id) => `<button data-act="qj-shop" data-v="${id}" aria-pressed="${st.shop === id}">${X().emo(Sh[id].icon)} ${h(Sh[id].name)} <b class="num">${fmt(s.tokens[Sh[id].cur] || 0)}</b></button>`).join("")}</div>
      ${X().shopHtml(st.shop)}`;
  }

  /* ---------- pages gardées de ui.js, avec l'aide repliée ---------- */
  function keptHtml(s, qt) {
    const fn = { bounty: "bountiesHtml", align: "alignHtml", almanax: "almanaxHtml", commandes: "commandesHtml", temples: "templesHtml" }[qt];
    const [note, rest] = splitNote(X()[fn]());
    return `${head(s, qt, note)}${rest}`;
  }

  function render(main) {
    const s = S(); const ui = UI();
    const valid = ["jour", "shops"].concat(FAMS.flatMap((F) => F.pages.map((p) => p[0])), COL.map((p) => p[0]));
    if (!valid.includes(ui.qt)) ui.qt = "jour";
    const qt = ui.qt;
    if (qt === "ach" || qt === "orn") { // page Succès : succès et ornements, sans le journal
      main.innerHTML = `<div class="pagehead"><h1>Succès</h1></div><nav class="subtabs">${COL.map(([id, n]) => `<button data-act="qtab" data-v="${id}" aria-pressed="${qt === id}">${n} ${cnt(s, id)}</button>`).join("")}</nav><section class="stack">${qt === "ach" ? achHtml(s) : ornHtml(s)}</section>`;
      return;
    }
    const body = qt === "jour" ? jourHtml(s) : qt === "main" ? mainHtml(s) : qt === "dofus" ? dofusHtml(s) : qt === "ach" ? achHtml(s) : qt === "orn" ? ornHtml(s) : qt === "shops" ? shopsHtml(s) : keptHtml(s, qt);
    main.innerHTML = `<div class="pagehead"><h1>Quêtes</h1></div><div class="qj-lay">${journal(s, qt)}<div class="qj-main">${mtabs(s, qt)}<section class="stack">${body}</section></div></div>`;
  }

  function act(a, t) {
    const d = t.dataset; const ui = UI();
    switch (a) {
      case "qj-help": st.help[d.v] = !st.help[d.v]; break;
      case "qj-dof": st.dof = d.v; break;
      case "qj-dfil": st.dfil = d.v; break;
      case "qj-cat": st.cat = d.v; break;
      case "qj-shop": st.shop = d.v; ui.tab = "quests"; ui.qt = "shops"; X().closeSheet(); break;
      default: return;
    }
    X().render();
  }

  // garde la liste des étapes terminées ouverte malgré le rafraîchissement automatique de la page
  document.addEventListener("toggle", (e) => { if (e.target.classList && e.target.classList.contains("qj-done")) st.doneOpen = e.target.open; }, true);
  window.QUI = { render, act, todo };
})();
