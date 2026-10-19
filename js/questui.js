/* ============================================================================
   JOURNAL DE QUÊTES — interface (0.1.28). Refonte du menu Quêtes.
   Journal en 2 familles (Aujourd'hui, Aventures ; Succès et ornements ont leur page depuis 0.1.31), tableau du jour,
   quête principale (étape en cours en haut), Dofus en grille, Succès par famille,
   boutiques regroupées dans les Comptoirs, textes d'aide derrière un « ? ».
   Les pages Almanax, Avis, Commandes, Temples et Alignement gardent leur rendu (ui.js).
   0.1.49 « Quêtes, succès et chasses » : 3 familles (Aujourd'hui, Aventures, Chasses), rangée « À faire ensuite »,
   chapitres de la quête principale, quêtes de région, quêtes de la semaine, tableau des avis (rang, boss, élite),
   chasse au trésor en 3 tailles, Succès avec points, paliers, filtres, recherche et secrets.
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
  const st = { dof: null, dfil: "all", cat: null, shop: "prime", help: {}, chap: null, reg: null, rf: "lvl", af: "all", achq: "" };
  const top = (s) => Math.max(1, ...s.chars.map((c) => c.lvl));

  const FAMS = [
    { id: "day", n: "Aujourd'hui", ic: "almanax", pages: [["jour", "Tableau du jour", "almanax"], ["hebdo", "Semaine", "coffre"], ["almanax", "Almanax", "almanax"], ["commandes", "Commandes", "metiers"], ["temples", "Temples", "combat"]] },
    { id: "adv", n: "Aventures", ic: "quetes", pages: [["main", "Quête principale", "quetes"], ["region", "Quêtes de région", "monde"], ["dofus", "Dofus", "dofus"], ["align", "Alignement", "ailes"]] },
    { id: "hunt", n: "Chasses", ic: "carte", pages: [["bounty", "Avis de recherche", "carte"], ["tresor", "Trésor", "parchemin_or"]] },
  ];
  const famOf = (qt) => (FAMS.find((F) => F.pages.some((p) => p[0] === qt)) || FAMS[0]).id;
  const COL = [["ach", "Succès", "trophee"], ["orn", "Ornements", "couronne"]]; // 0.1.31 : page Succès à part (menu Suivi)
  const pageName = (qt) => (qt === "shops" ? "Comptoirs" : qt === "hebdo" ? "Quêtes de la semaine" : qt === "tresor" ? "Chasse au trésor" : (FAMS.flatMap((F) => F.pages).concat(COL).find((p) => p[0] === qt) || [0, "Quêtes"])[1]);

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
    if (E.REGIONS) n += E.REGIONS.filter((R) => E.rqReady(s, R)).length; // 0.1.49 : ressources à remettre, quête de région à rendre
    return n;
  }
  const untilMidnight = () => { const t = E.now(); const d = new Date(t); d.setHours(24, 0, 0, 0); const m = Math.max(0, Math.round((d - t) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };

  /* compteurs du journal : [texte, classe] */
  function counter(s, id) {
    switch (id) {
      case "almanax": { const a = almState(s); return a.A.done ? ["faite", "ok"] : a.ready ? ["prête", "todo"] : ["à faire", ""]; }
      case "bounty": { const B0 = s.belite; return [`${(s.bounties || []).length + (B0 && B0.key && !B0.done ? 1 : 0)}`, ""]; }
      case "hebdo": { const W = s.wk; if (!W) return ["", ""]; const d = W.list.filter((q) => q.done).length; return [`${d}/${W.list.length}`, W.claimed ? "ok" : ""]; }
      case "region": { const L = E.REGIONS || []; const d = E.rqDoneCount(s); return [`${d}/${L.length}`, L.length && d >= L.length ? "ok" : L.some((R) => E.rqReady(s, R)) ? "todo" : ""]; }
      case "tresor": { const T = E.tresorState(s); return T.cur ? ["en cours", "todo"] : T.stock.length ? [`${T.stock.length}`, "todo"] : ["", ""]; }
      case "commandes": { const C = E.cmdState(s); const done = C.dn || 0; return [`${done}/${E.CMD_DAY_MAX}`, done >= E.CMD_DAY_MAX ? "ok" : C.list.some((o) => cmdReady(s, o)) ? "todo" : ""]; }
      case "temples": { const all = E.templeClasses(s).length; const left = templeLeft(s).length; return all ? [`${all - left}/${all}`, left ? "todo" : "ok"] : ["", ""]; }
      case "main": return [`${Math.min(s.quest.step, E.MAIN_QUEST.length)}/${E.MAIN_QUEST.length}`, s.quest.step >= E.MAIN_QUEST.length ? "ok" : ""];
      case "dofus": { const d = E.dofusCount(s); return [`${d}/${E.DOFUS_ORDER.length}`, d >= E.DOFUS_ORDER.length ? "ok" : ""]; }
      case "align": return [s.align ? `rang ${E.alignRankIdx(s)}` : "", ""];
      case "ach": { const d = E.achCount(s); return [`${d}/${E.ACH.length}`, d >= E.ACH.length ? "ok" : ""]; }
      case "orn": { const ids = Object.keys(E.ORN); const d = ids.filter((id) => E.ornUnlocked(s, id)).length; return [`${d}/${ids.length}`, d >= ids.length ? "ok" : ""]; }
    }
    return ["", ""];
  }
  const cnt = (s, id) => { const [t, c] = counter(s, id); return t ? `<span class="qj-cnt ${c}">${h(t)}</span>` : ""; };

  /* ---------- journal (PC) et familles (téléphone) ---------- */
  function journal(s, qt) {
    const left = todo(s);
    return `<aside class="qj-journal" aria-label="Journal de quêtes"><div class="qj-jh">${IC("quetes")}<h3>Journal</h3></div>
      ${FAMS.map((F) => `<div class="qj-grp"><div class="qj-gt">${F.n}${F.id === "day" ? `<i>dans ${untilMidnight()}</i>` : F.id === "hunt" ? `<i>rang ${E.hunterRank(s) + 1}</i>` : ""}</div>
        ${F.pages.map(([id, n, ic]) => `<button class="qj-ji" data-act="qtab" data-v="${id}" ${qt === id ? 'aria-current="page"' : ""}>${IC(ic)}<b>${n}</b>${id === "jour" && left ? `<span class="qj-pip" title="${left} chose${left > 1 ? "s" : ""} à faire"></span>` : cnt(s, id)}</button>`).join("")}</div>`).join("")}
      <button class="qj-shopbtn" data-act="qtab" data-v="shops" ${qt === "shops" ? 'aria-current="page"' : ""}>${IC("bourse")}<b>Comptoirs</b><span>${window.CPTUI ? "6 boutiques" : "3 boutiques"}</span></button></aside>`;
  }
  /* téléphone : les 3 familles en gros boutons, puis les pages de la famille (0.1.49) */
  function mtabs(s, qt) {
    const left = todo(s); const F = FAMS.find((f) => f.id === famOf(qt));
    const n = F.pages.length + (F.id === "day" || qt === "shops" ? 1 : 0); // 1.0.3.2 : 3 colonnes si le compte tombe juste, sinon 2
    return `<div class="qj-m"><div class="qj-fam3">${FAMS.map((f) => `<button data-act="qtab" data-v="${f.pages[0][0]}" aria-pressed="${f.id === F.id && qt !== "shops"}">${IC(f.ic)}${f.n}${f.id === "day" && left ? '<span class="qj-pip"></span>' : ""}</button>`).join("")}</div>
      <div class="qj-chips" style="--qc:${n % 3 === 0 ? 3 : 2}">${F.pages.map(([id, n]) => `<button data-act="qtab" data-v="${id}" aria-pressed="${qt === id}">${id === "jour" ? "Du jour" : n}${id === "jour" ? (left ? ' <span class="qj-pip"></span>' : "") : cnt(s, id)}</button>`).join("")}${F.id === "day" || qt === "shops" ? `<button data-act="qtab" data-v="shops" aria-pressed="${qt === "shops"}">${IC("bourse")} Comptoirs</button>` : ""}</div></div>`;
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
        <div class="qj-hb"><span class="qj-eb">Quête principale · chapitre ${chapOf(cur) + 1} · étape ${cur + 1 - E.QUEST_CHAPTERS[chapOf(cur)].start} sur ${E.QUEST_CHAPTERS[chapOf(cur)].end - E.QUEST_CHAPTERS[chapOf(cur)].start}</span><h2>${h(q.title)}</h2><span class="small muted">${h(q.txt)}</span>
          ${qp ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div>` : ""}
          ${E.questExtraText(cur) ? `<span class="qj-rew">${IC("coffre")} Récompense : <b>${h(E.questExtraText(cur))}</b></span>` : ""}</div>
        <div class="qj-acts">${X().questGoBtn(q, "primary")}<button class="btn sm" data-act="qtab" data-v="main">Toute la quête</button></div></div>`
      : `<div class="qj-hero"><div class="qj-chap">${IC("trophee")}</div><div class="qj-hb"><span class="qj-eb">Quête principale</span><h2>Terminée</h2><span class="small muted">Les quêtes de région, les Dofus et l'alignement attendent dans Aventures.</span></div><div class="qj-acts"><button class="btn sm" data-act="qtab" data-v="dofus">Les Dofus</button></div></div>`;
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
    // Commandes (1.0.23.1 « Commandes d'artisans plus claires » : barre livré + en banque, ce qui manque, paie, « Livrer », « Tout livrer », où trouver, prime du jour)
    const C = E.cmdState(s); const cready = C.list.filter((o) => cmdReady(s, o));
    const dn = C.dn || 0; const MX = E.CMD_DAY_MAX; const allDone = dn >= MX || C.list.every((o) => o.got >= o.n); const p1 = C.bonus === C.day, p2 = C.bonus2 === C.day; // 1.0.24.1 : 10 par jour, 2 primes
    const chest = p1 ? E.CMD_PRIMES[1][1] : E.cmdChest(s); const CH = D.CONSUMABLES[chest]; const goal = p1 ? E.CMD_PRIMES[1][0] : E.CMD_PRIMES[0][0]; const cleft = E.cmdLeft(s);
    const jn = (o) => h((D.GATHER_JOBS[o.art] || D.CRAFT_JOBS[o.art] || { name: "" }).name);
    const cmd = `<article class="qj-card qj-cmd ${cready.length ? "hot" : ""} ${allDone ? "alldone" : ""}"><div class="qj-ch">${IC("metiers")}<h3>Commandes d'artisans</h3><span class="qj-tag ${allDone ? "ok" : cready.length ? "todo" : ""}">${dn} / ${MX} livrées</span></div>
      ${C.list.map((o) => { const ok = o.got >= o.n; const bank = Math.min(s.res[o.res] || 0, o.n - o.got); const miss = o.n - o.got - bank; const rd = !ok && !miss;
        const st = ok ? `<span class="plus">Livrée</span>` : rd ? `<span class="qj-co-rd">Prête à livrer</span>` : `il manque <b>${fmt(miss)}</b>`;
        const act = ok ? `<span class="qj-co-ok" aria-label="Livrée">✓</span>` : rd ? `<button class="btn sm primary" data-act="vi-deliver" data-id="${o.id}">Livrer</button>`
          : `${bank ? `<button class="btn sm" data-act="vi-deliver" data-id="${o.id}" data-tip="Les livraisons partielles comptent">Livrer ${fmt(bank)}</button>` : ""}${X().cmdGoBtn(o.res)}`;
        return `<div class="qj-co ${ok ? "done" : rd ? "ready" : "miss"} ${o.urgent ? "urgent" : ""}">
          <span class="qj-co-ic">${X().im(X().resImg(o.res), "", o.res)}<img class="qj-co-job" src="${X().jobImg(o.art)}" alt="" data-tip="${h(E.CMD_ARTS[o.art])} · ${jn(o)}"></span>
          <div class="qj-co-b"><div class="qj-co-t"><b>${o.n} × ${h(o.res)}</b>${o.urgent ? `<span class="qj-urg" data-tip="Commande urgente : kamas et XP ×1,5, et la prime du jour devient un Coffre en argent">Urgent ×1,5</span>` : ""}</div>
            <span class="qj-co-who"><span>${h(E.CMD_ARTS[o.art])}</span><span class="nw" data-tip="Paie : ${fmt(E.cmdReward(s, o))} kamas et ${fmt(o.jxp)} XP ${jn(o)}"><span class="coin"></span> <b>${fmt(E.cmdReward(s, o))}</b> · <b>${fmt(o.jxp)}</b> XP</span></span>
            <div class="qj-co-p"><span class="qj-cbar" data-tip="${fmt(o.got)} livrée${o.got > 1 ? "s" : ""} · ${fmt(bank)} en banque"><i style="width:${X().pct(o.got, o.n)}%"></i><i class="bk" style="width:${X().pct(bank, o.n)}%"></i></span><span class="num xs">${fmt(Math.min(o.got + bank, o.n))}/${fmt(o.n)}</span><span class="xs qj-co-st">${st}</span></div></div>
          <div class="qj-co-a">${act}</div></div>`; }).join("") || `<span class="small muted">Aucune commande aujourd'hui.</span>`}
      <div class="qj-cfoot ${p2 ? "got" : ""}"><span class="qj-chest" data-tip="${h(CH.name)} : ${h(CH.desc)}${p1 ? "" : chest === "coffre_bois" ? " Une commande urgente le change en Coffre en argent." : " (en argent grâce à la commande urgente)"}">${X().chestImg(CH.img)}</span><span class="grow"><b>${p2 ? `Primes du jour reçues ✓` : `${p1 ? "Grande prime" : "Prime"} à ${goal} livrées : ${h(CH.name)}`}</b><br><span class="xs muted">${p2 || (!cleft && allDone) ? "nouvelles commandes à minuit" : `<b class="num">${dn}/${goal}</b>${p1 ? " · 1re prime reçue ✓" : ""}${cleft ? ` · <span class="nw" data-tip="Chaque commande livrée est remplacée aussitôt, jusqu'à ${MX} par jour">encore ${cleft} à venir</span>` : ""} · <span class="nw">${untilMidnight()} avant minuit</span>`}</span></span>
        ${cready.length > 1 ? `<button class="btn sm primary" data-act="vi-deliverall">Tout livrer (${cready.length})</button>` : ""}<button class="btn sm" data-act="qtab" data-v="commandes">Ouvrir</button></div></article>`;
    // Temples
    const T = E.templeState(s); const cls = E.templeClasses(s); const left = cls.filter((k) => !T.done[k]); const pend = T.pend || T.fighting;
    const tpl = `<article class="qj-card ${left.length && !pend ? "hot" : ""} ${cls.length && !left.length ? "done" : ""}"><div class="qj-ch">${IC("combat")}<h3>Temples</h3><span class="qj-tag ${left.length ? "" : "ok"}">${cls.length - left.length} / ${cls.length} Dopeuls</span></div>
      <div class="qj-tpls">${cls.map((k) => { const CL = CLASSES[k]; const dn = T.done[k];
        return `<span class="qj-tpl ${dn ? "done" : ""}" style="--cc:${CL.color}"><i><img src="${X().symImg(k)}" alt=""></i>${h(CL.name)}<span class="xs ${dn ? "plus" : "muted"}">${dn ? "vaincu ✓" : pend === k ? "arrive" : "à défier"}</span></span>`; }).join("") || `<span class="small muted">Aucun héros.</span>`}</div>
      <div class="row">${pend ? `<span class="xs muted grow">Le Dopeul ${h(CLASSES[pend].name)} ${T.fighting ? "affronte l'équipe" : "arrive au prochain combat"}.</span>` : left.length ? `<button class="btn sm primary" data-act="vi-tfight" data-v="${left[0]}">Défier ${h(CLASSES[left[0]].name)}</button>` : ""}<button class="btn sm" data-act="qtab" data-v="temples">Ouvrir</button></div></article>`;
    // les cartes terminées descendent en bas
    const cards = [[alm, A.done], [avis, false], [cmd, allDone], [tpl, cls.length && !left.length]].sort((x, y) => x[1] - y[1]).map((c) => c[0]).join("");
    return `<div class="qj-ph"><h2>Aujourd'hui</h2><span class="grow"></span><span class="xs muted">${IC("almanax")} Tout se renouvelle à minuit, dans <b class="num">${untilMidnight()}</b></span></div>${hero}${nextUp(s)}${X().defiLine ? X().defiLine() : ""}<div class="qj-day">${cards}</div>`;
  }

  /* ---------- « À faire ensuite » : le plus utile du moment, en une rangée ---------- */
  const daysLeft = () => { const ms = E.weekLeft(); const d = Math.floor(ms / 86400000); return d >= 1 ? `encore ${d} j` : `encore ${Math.max(1, Math.round(ms / 3600000))} h`; };
  const achRatio = (s, a) => { if (s.ach[a.id]) return 2; const p = E.achProgress(s, a.id); return p && p[1] ? Math.min(0.999, p[0] / p[1]) : 0; };
  function nearAch(s, n) { return E.ACH.filter((a) => !s.ach[a.id] && !a.secret).map((a) => [a, achRatio(s, a)]).filter((x) => x[1] > 0 && x[1] < 1).sort((x, y) => y[1] - x[1]).slice(0, n); }
  function nextUp(s) {
    const out = [];
    const L = E.REGIONS || [];
    const R = L.find((x) => E.rqReady(s, x)) || L.find((x) => { const T = E.rqState(s, x.id); return !T.done && T.i > 0 && E.rqOpen(s, x); }) || L.find((x) => !E.rqState(s, x.id).done && E.rqOpen(s, x));
    if (R) { const T = E.rqState(s, R.id); out.push([`data-act="qj-reg" data-v="${R.id}"`, "monde", R.title, E.rqReady(s, R) ? `Quête de région · ${R.steps[T.i].t === "talk" ? "à rendre" : "à remettre"}` : `Quête de région · étape ${T.i + 1}/${R.steps.length}`, E.rqReady(s, R)]); }
    const W = s.wk; if (W && !W.claimed) out.push([`data-act="qtab" data-v="hebdo"`, "coffre", "Coffre de la semaine", `${W.list.filter((q) => q.done).length} quête${W.list.filter((q) => q.done).length > 1 ? "s" : ""} sur 3 · ${daysLeft()}`]);
    const B0 = s.belite; if (B0 && B0.key && !B0.done) out.push([`data-act="qtab" data-v="bounty"`, "carte", `Élite : ${MONSTERS[B0.key].name}`, `Avis d'élite · stasis ${B0.s} · ${daysLeft()}`]);
    const T = E.tresorState(s); if (T.cur) out.push([`data-act="qtab" data-v="tresor"`, "parchemin_or", "Chasse au trésor en cours", T.cur.ready ? "Le gardien t'attend" : `Étape ${T.cur.i + 1} sur ${T.cur.steps.length}`, T.cur.ready]);
    else if (T.stock.length) out.push([`data-act="qtab" data-v="tresor"`, "parchemin_or", `${T.stock.length} parchemin${T.stock.length > 1 ? "s" : ""} de chasse`, "Chasse au trésor · à ouvrir"]);
    else if (E.tresorFreeOk(s)) out.push([`data-act="qtab" data-v="tresor"`, "parchemin_or", "Chasse courte du jour", "Chasse au trésor · gratuite"]);
    const A = nearAch(s, 1)[0]; if (A) { const p = E.achProgress(s, A[0].id); out.push([`data-act="qj-ach" data-v="${h(A[0].cat)}"`, "trophee", A[0].name, `Succès presque fini · ${fmt(Math.min(p[0], p[1]))}/${fmt(p[1])} · +${E.achPts(A[0])} pts`]); }
    if (!out.length) return "";
    return `<section class="qx-next"><span class="qj-lab">À faire ensuite</span><div class="qx-nrow">${out.slice(0, 4).map(([a, ic, t, sub, hot]) => `<button class="qx-ni ${hot ? "hot" : ""}" ${a}>${IC(ic)}<span><b>${h(t)}</b><small>${h(sub)}</small></span><i>›</i></button>`).join("")}</div></section>`;
  }

  /* ---------- quête principale : 5 chapitres (0.1.49) ---------- */
  const chapOf = (i) => E.questChapter(Math.min(i, E.MAIN_QUEST.length - 1));
  function mainHtml(s) {
    const Q = E.MAIN_QUEST; const cur = s.quest.step; const qp = E.questProgress(s); const CH = E.QUEST_CHAPTERS; const t = top(s);
    const curCh = cur >= Q.length ? CH.length - 1 : chapOf(cur);
    if (st.chap === null || !CH[st.chap]) st.chap = curCh;
    const k = st.chap; const C = CH[k];
    const chaps = `<div class="qx-chaps">${CH.map((c, i) => { const n = c.end - c.start; const d = Math.max(0, Math.min(n, cur - c.start)); const cls = d >= n ? "got" : i === curCh ? "cur" : cur < c.start ? "lock" : "";
      return `<button class="qx-chap ${cls}" data-act="qj-chap" data-v="${i}" aria-pressed="${i === k}"><span class="qj-eb">Chapitre ${i + 1}${d >= n ? " ✓" : ""}</span><b>${h(c.name)}</b><small>niv. ${c.lvl[0]}–${c.lvl[1]} · ${n} étapes</small><span class="qx-cb"><i style="width:${X().pct(d, n)}%"></i></span></button>`; }).join("")}</div>`;
    const step = (i, cls) => { const q = Q[i]; if (!q) return ""; const lock = cls === "lock"; const rw = E.questExtraText(i); const kam = E.questReward ? E.questReward(i).kamas : 0;
      return `<div class="qj-step ${cls}"><span class="n">${lock ? "?" : i + 1 - C.start}</span><div class="grow stack" style="gap:4px"><b>${lock ? "???" : h(q.title)}</b><span class="small muted">${lock ? "Termine les étapes précédentes." : h(q.txt)}</span>
        ${cls === "cur" && qp ? `<div class="row"><div class="bar grow"><i style="width:${X().pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div>` : ""}
        ${!lock ? `<span class="qj-rew">${IC("coffre")} ${cls === "cur" ? "Récompense" : "Puis"} : <b>${fmt(kam)} kamas${rw ? ", " + h(rw) : ""}</b></span>` : ""}</div>
        ${cls === "cur" ? `<div class="qj-side"><span class="pinbtn auto" data-tip="La quête principale est toujours suivie dans la bande d'objectifs">${X().G("pin")} suivie</span>${X().questGoBtn(q, "primary")}</div>` : ""}</div>`; };
    const n = C.end - C.start;
    const bar = `<div class="qj-chapbar" aria-label="Chapitre ${k + 1} : ${Math.max(0, Math.min(n, cur - C.start))} étapes sur ${n}">${Q.slice(C.start, C.end).map((q, j) => { const i = C.start + j; return `<i class="${i < cur ? "ok" : i === cur ? "cur" : ""}" title="${i <= cur + 2 ? h(q.title) : "???"}"></i>`; }).join("")}</div>`;
    const done = Q.slice(C.start, Math.min(cur, C.end));
    const doneList = done.length ? `<details class="qj-done" ${cur >= C.end || st.doneOpen ? "open" : ""}><summary>${done.length} étape${done.length > 1 ? "s" : ""} terminée${done.length > 1 ? "s" : ""} <span class="xs muted">(récompenses reçues)</span></summary><div class="qj-dl">${done.map((q, j) => `<div><b>✓</b><span class="grow">${j + 1}. ${h(q.title)}</span><span class="xs">${h(E.questExtraText(C.start + j) || "")}</span></div>`).join("")}</div></details>` : "";
    let body;
    if (cur >= C.end) body = `<div class="qj-step cur"><span class="n">✓</span><div class="grow"><b>Chapitre terminé : titre « ${h(C.title)} »</b><div class="small muted">${k + 1 < CH.length ? `La suite : chapitre ${k + 2}, ${h(CH[k + 1].name)} (niv. ${CH[k + 1].lvl[0]}–${CH[k + 1].lvl[1]}).` : "Bravo ! Toute la quête principale est faite."}</div></div>${k + 1 < CH.length ? `<button class="btn sm" data-act="qj-chap" data-v="${k + 1}">Chapitre ${k + 2} ›</button>` : ""}</div>`;
    else if (cur < C.start) body = `<div class="qj-step lock"><span class="n">${G("lock")}</span><div class="grow"><b>Chapitre ${k + 1} · ${h(C.name)}</b><div class="small muted">Il s'ouvre à la fin du chapitre ${k}. Régions : ${h(C.where)}. Au bout : titre « ${h(C.title)} »${k === CH.length - 1 ? "" : " et 2 Coffres en or"}.${t < C.lvl[0] ? ` Prévu pour le niveau ${C.lvl[0]}.` : ""}</div></div></div>${step(C.start, "next")}${step(C.start + 1, "lock")}`;
    else body = `${step(cur, "cur")}${cur + 1 < C.end ? `<div class="stack" style="gap:8px"><span class="qj-lab">Ensuite</span>${step(cur + 1, "next")}${cur + 2 < C.end ? step(cur + 2, "next") : ""}${cur + 3 < C.end ? step(cur + 3, "lock") : ""}</div>` : ""}`;
    return `${head(s, "main", "La quête principale tient en 5 chapitres, du niveau 1 au niveau 200. Chaque étape se valide toute seule en jouant et donne des kamas, de l'XP et une récompense à thème ; chaque chapitre terminé donne un titre. L'étape en cours est toujours suivie dans la bande d'objectifs, en haut de l'écran.")}
      ${chaps}<section class="panel"><div class="phead"><h2>Chapitre ${k + 1} · ${h(C.name)}</h2><span class="xs muted">${h(C.where)} · titre « ${h(C.title)} »</span></div><div class="pad stack">${bar}${body}${doneList}</div></section>`;
  }
  const G = (n) => X().G(n);

  /* ---------- Dofus ---------- */
  function dofState(s, id) {
    const Q = E.dofusQuest(s, id); const owned = E.dofusOwned(s, id);
    return Q.done || owned ? "got" : Q.step > 0 || E.dofusStepProgress(s, id, 0)[0] > 0 || (id === "ocre" && E.soulCount(s) > 0) ? "run" : "lock";
  }
  function dofusHtml(s) {
    const ids = E.DOFUS_ORDER.slice().sort((a, b) => E.DOFUS[a].lvl - E.DOFUS[b].lvl || (E.DOFUS[a].name < E.DOFUS[b].name ? -1 : 1));
    const stt = Object.fromEntries(ids.map((id) => [id, dofState(s, id)]));
    if (!st.dof || !E.DOFUS[st.dof]) st.dof = ids.find((id) => stt[id] === "run") || ids.find((id) => stt[id] === "lock") || ids[0];
    const dfam = E.DOFP_LIST ? st.dfam || "all" : "all"; // 1.0.16 : filtre par famille de passif
    const list = ids.filter((id) => (st.dfil === "all" || stt[id] === st.dfil) && (dfam === "all" || E.dofpFam(id) === dfam));
    const tier = E.ocreTier(s);
    const dots = (id) => { const Df = E.DOFUS[id]; const Q = E.dofusQuest(s, id);
      if (id === "ocre") return E.OCRE_TIERS.map((T, i) => `<i class="${i < tier ? "ok" : i === tier && stt[id] === "run" ? "cur" : ""}"></i>`).join("");
      return Df.steps.map((x, i) => `<i class="${Q.done || i < Q.step ? "ok" : i === Q.step && stt[id] === "run" ? "cur" : ""}"></i>`).join(""); };
    const eggs = list.map((id) => { const Df = E.DOFUS[id];
      return `<button class="qj-egg ${stt[id]}" data-act="qj-dof" data-v="${id}" aria-pressed="${st.dof === id}">${X().im(X().dofusImg(id), "", Df.name)}<b>${h(Df.name.replace(/^Dofus /, ""))}</b>${E.DOFP_LIST ? `<em class="qj-pas fam-${X().dofpFc(id)}"><i></i>${h(E.dofpName(id))}</em>` : ""}<small>niv. ${Df.lvl}</small><span class="qj-dots">${dots(id)}</span></button>`; }).join("") || `<p class="small muted">Aucun Dofus dans cette liste.</p>`;
    // fiche du Dofus choisi (mêmes informations que l'ancienne carte)
    const id = st.dof; const Df = E.DOFUS[id]; const Q = E.dofusQuest(s, id); const owned = E.dofusOwned(s, id); const by = E.dofusWornBy(s, id);
    const state = Q.done ? `Quête terminée${by ? ` · porté par ${h(by.name)}` : owned ? " · dans le sac" : ""}` : owned ? `Obtenu en butin${by ? ` · porté par ${h(by.name)}` : ""} · quête en cours` : stt[id] === "run" ? `Quête en cours${id === "ocre" ? "" : ` · étape ${Q.step + 1} sur ${Df.steps.length}`}` : "Quête à commencer";
    const steps = id === "ocre" ? E.OCRE_TIERS.map((T, i) => { const [dd, all] = E.ocreProgress(s, i); return `<li class="${i < tier ? "ok" : dd ? "cur" : "todo"}">Palier ${i + 1} · ${h(T.name)} <span class="num muted">${dd} / ${all}</span></li>`; }).join("")
      : Df.steps.map((x, i) => { const [a, bb] = E.dofusStepProgress(s, id, i); const cls = Q.done || i < Q.step ? "ok" : i === Q.step ? "cur" : "todo";
        return `<li class="${cls}">${h(E.dofusStepTxt(x))}${cls === "cur" && bb > 1 ? ` <span class="num muted">${fmt(a)} / ${fmt(bb)}</span>` : ""}${cls === "cur" ? ` ${X().dofusStepGo(x)}` : ""}</li>`; }).join("");
    // 1.0.6.2 « Où trouver les Dofus » : les deux façons de l'obtenir, chacune avec son bouton pour y aller
    const gift = Df.steps[0] && Df.steps[0].t === "gift";
    const fiche = `<div class="panel qj-fiche"><div class="pad stack" style="gap:10px"><div class="row" style="flex-wrap:nowrap">${X().im(X().dofusImg(id), "qj-fpic", Df.name)}<div class="grow"><h3>${h(Df.name)}</h3><span class="xs muted">niveau ${Df.lvl}</span><div class="qj-bon">${h(E.dofusBonusTxt(id))}</div></div></div>${X().dofpBlock ? X().dofpBlock(id, { c: by || null }) : ""}
      <div class="row" style="gap:6px"><span class="qj-tag ${stt[id] === "got" ? "ok" : stt[id] === "run" ? "todo" : ""}">${state}</span>${Q.done || gift ? "" : `<span class="grow"></span>${X().pinBtn({ k: "dof", id }, E.pinned(s, { k: "dof", id }) ? "Suivie" : "Suivre")}`}</div>${window.COLL && owned ? window.COLL.potLink(s, id) : ""}
      <div class="qj-how"><b>${gift ? "Comment l'obtenir" : "① Sa quête"}</b><span class="xs muted">${gift ? "" : id === "ocre" ? "un exemplaire garanti, une fois par compte : capture les âmes avec des Pierres d'âme" : Df.mono ? "un exemplaire par saison · les étapes se valident toutes seules en jouant la saison" : "un exemplaire garanti, une fois par compte · les étapes se valident toutes seules en jouant"}</span></div>
      <ol class="qj-steps">${steps}</ol>
      ${Df.mono ? `<div class="qj-how"><b>Dofus de saison</b><span class="xs muted">il ne tombe d'aucun boss · après la saison, il reste au héros dans l'Éternel et ne s'obtient plus</span></div></div></div>` : `<div class="qj-how"><b>${gift ? "Butin" : E.DOFUS[id].drop && E.DOFUS[id].drop.songe ? "② Le butin du Songe" : "② Le butin du boss"}</b><span class="xs muted">${gift ? "" : "très rare, sans limite : c'est ainsi qu'on équipe ses autres héros"}</span></div>
      <div class="list qj-drop">${X().dofusDropHtml(id)}</div></div></div>`}`;
    const n = (f) => ids.filter((x) => f === "all" || stt[x] === f).length;
    const fil = [["all", "Tous"], ["run", "En cours"], ["lock", "À commencer"], ["got", "Obtenus"]];
    return `${head(s, "dofus", "Un Dofus s'obtient de deux façons : ① sa quête, qui en donne un exemplaire par compte (les étapes se valident toutes seules en jouant, les donjons déjà vaincus à la stasis demandée comptent) ; ② le butin du boss de son donjon, très rare : à chaque victoire, chaque héros de l'équipe a sa chance, dès la stasis 1 (1 sur " + fmt(E.dofusOdds(1)).replace(/,/g, " ") + ") et de mieux en mieux jusqu'à la stasis 10 (1 sur " + fmt(E.dofusOdds(10)).replace(/,/g, " ") + "). C'est le seul moyen d'en avoir d'autres pour tes autres héros. Choisis un Dofus : sa fiche dit où aller. Un héros porte un seul exemplaire de chaque Dofus.", X().archiBtn())}
      <div class="qj-fil">${fil.map(([k, l]) => `<button data-act="qj-dfil" data-v="${k}" aria-pressed="${st.dfil === k && !(window.COLL && window.COLL.potOn())}">${l} <b class="num">${n(k)}</b></button>`).join("")}${window.COLL ? window.COLL.potBtn(s) : ""}</div>
      ${E.DOFP_LIST ? `<div class="qj-fil qj-ffam">${[["all", "Toutes les familles"]].concat(E.DOFP_FAMS.map((f) => [f, f])).map(([k, l]) => `<button class="${k === "all" ? "" : "fam-" + X().dofpFcOf(k)}" data-act="qj-dfam" data-v="${k}" aria-pressed="${dfam === k}">${k === "all" ? "" : `<i class="qj-fd"></i>`}${l}</button>`).join("")}</div>` : ""}
      ${window.COLL && window.COLL.potOn() ? window.COLL.potHtml(s, ids.filter((x) => dfam === "all" || E.dofpFam(x) === dfam)) : `<div class="qj-dofl"><div class="qj-eggs">${eggs}</div>${fiche}</div>`}`; // 1.0.30 : Potentiel des Dofus (js/collui.js)
  }

  /* ---------- quêtes de région (0.1.49) ---------- */
  const regCls = (s, R) => { const T = E.rqState(s, R.id); return T.done ? "got" : E.rqOpen(s, R) ? "run" : "lock"; };
  const regFil = (s, R, f, t) => { const c = regCls(s, R); return f === "all" || (f === "lvl" ? c === "run" && (R.lvM >= t - 10 || E.rqState(s, R.id).i > 0) : f === "run" ? c === "run" && E.rqState(s, R.id).i > 0 : c === f); };
  function regionHtml(s) {
    const L = E.REGIONS; const t = top(s);
    if (!st.reg || !E.REGION[st.reg]) st.reg = (L.find((R) => E.rqReady(s, R)) || L.find((R) => regCls(s, R) === "run" && E.rqState(s, R.id).i > 0) || L.find((R) => regCls(s, R) === "run") || L[0]).id;
    const R = E.REGION[st.reg]; const T = E.rqState(s, R.id); const cls = regCls(s, R); const [pa, pb] = E.rqProgress(s, R);
    const steps = R.steps.map((x, i) => { const c = T.done || i < T.i ? "ok" : i === T.i && cls === "run" ? "cur" : "todo"; let btn = "";
      if (c === "cur") {
        if (x.t === "kill") btn = `<button class="btn xs primary" data-act="zoneview" data-id="${x.sub}" data-gotab="world">Y aller</button>`;
        else if (x.t === "boss") btn = `<button class="btn xs primary" data-act="dgopen" data-id="${x.dg}">Voir le donjon</button>`;
        else if (x.t === "res") btn = `<button class="btn xs ${pa >= pb ? "primary" : ""}" data-act="qj-rqgive" data-v="${R.id}" ${pa >= pb ? "" : "disabled"}>Remettre</button>`;
        else if (x.t === "talk") btn = `<button class="btn xs primary" data-act="qj-rqclaim" data-v="${R.id}">Terminer la quête</button>`;
      }
      return `<li class="${c}"><span>${h(x.txt)}${c === "cur" && (x.t === "kill" || x.t === "res") ? ` <span class="num muted">${fmt(pa)}/${fmt(pb)}</span>` : ""}${c !== "ok" ? ` <span class="xs muted">· ${fmt(i === R.steps.length - 1 ? E.rqFinalRew(R) : E.rqStepRew(R, i))} k</span>` : ""}</span>${c === "cur" ? `<span class="row" style="gap:6px">${x.t !== "talk" ? X().pinBtn({ k: "rq", id: R.id }) : ""}${btn}</span>` : ""}</li>`; }).join("");
    const state = cls === "got" ? `<span class="qj-tag ok">Terminée ✓</span>` : cls === "run" ? `<span class="qj-tag todo">étape ${T.i + 1} sur ${R.steps.length}</span>` : `<span class="qj-tag">${R.lv > t + 5 ? `dès le niveau ${Math.max(1, R.lv - 5)}` : "zone à débloquer"}</span>`;
    const hero = X().mainHero ? X().mainHero() : s.chars[0];
    const card = (x) => { const c = regCls(s, x); const TT = E.rqState(s, x.id);
      return `<button class="qx-reg ${c}" data-act="qj-reg" data-v="${x.id}" aria-pressed="${x.id === st.reg}"><span class="qx-ri">${X().im(X().imgM(x.img), "", "")}</span><span class="grow"><b>${h(x.name)}</b><small>niv. ${x.lv}–${x.lvM} · ${h(x.npc)}</small></span><img class="qx-ro" src="assets/ui/orn/orn_${x.id}.svg" alt="" loading="lazy"><span class="qx-rs ${E.rqReady(s, x) ? "hot" : ""}">${c === "got" ? "✓" : c === "run" ? `${TT.i}/${x.steps.length}` : `niv. ${x.lv}`}</span></button>`; };
    const fil = [["lvl", "À mon niveau"], ["run", "En cours"], ["got", "Terminées"], ["all", "Toutes"]];
    const shown = L.filter((x) => regFil(s, x, st.rf, t));
    return `${head(s, "region", "Chaque région du Monde des Douze a son histoire, donnée par un personnage de DOFUS : chasser, rapporter des ressources, vaincre les boss de la région. Les chasses et les boss se valident tout seuls ; les ressources se remettent avec un bouton. Au bout : kamas, un Coffre en argent, le titre « l'Ami de … » et l'emblème de la région, un ornement de carte de héros. Une quête s'ouvre 5 niveaux avant la région.")}
      <div class="qj-fil">${fil.map(([k, l]) => `<button data-act="qj-rf" data-v="${k}" aria-pressed="${k === st.rf}">${l} <b class="num">${L.filter((x) => regFil(s, x, k, t)).length}</b></button>`).join("")}<span class="grow"></span><span class="xs muted">${L.length} régions · ${L.reduce((a, x) => a + x.steps.length, 0)} étapes</span></div>
      <section class="panel qx-fiche2"><div class="pad qx-f2">
        <div class="stack" style="gap:10px"><div class="row" style="flex-wrap:nowrap"><span class="qx-npc">${X().im(X().imgM(R.img), "", "")}</span><div class="grow"><span class="qj-eb">${h(R.name)} · niv. ${R.lv}–${R.lvM}</span><h3>${h(R.title)}</h3><span class="xs muted">donnée par ${h(R.npc)}</span></div>${state}</div>
        <p class="small qx-story">« ${h(R.story)} »</p>
        <ol class="qj-steps qx-steps">${steps}</ol></div>
        <div class="qx-rewb"><span class="qj-lab">Récompense de fin</span><div class="qx-orprev">${hero ? X().heroCard(hero, "", { orn: "reg_" + R.id }) : ""}</div><div class="row" style="flex-wrap:nowrap"><img class="qx-omid" src="assets/ui/orn/orn_${R.id}.svg" alt=""><span><b>Emblème de ${h(R.name)}</b><br><span class="xs muted">ornement de carte de héros</span></span></div><span class="qj-rew">${IC("kamas")} <b>${fmt(E.rqFinalRew(R))} k</b> · ${IC("coffre")} <b>Coffre en argent</b> · ${IC("couronne")} <b>titre « ${h(E.regionTitle(R))} »</b></span><span class="xs muted">Chaque étape donne aussi des kamas et de l'XP.</span></div></div></section>
      <div class="qx-regs">${shown.map(card).join("") || `<p class="small muted">Aucune quête de région dans cette liste.</p>`}</div>`;
  }

  /* ---------- quêtes de la semaine (0.1.49) ---------- */
  const WK_IC = { kill: "combat", champ: "combat", dg: "cle", bounty: "carte", tresor: "parchemin_or", cmd: "metiers", harvest: "pioche", craft: "metiers", almanax: "almanax" };
  const wkGo = (q) => ({ kill: `data-act="nav" data-v="world"`, champ: `data-act="nav" data-v="world"`, dg: `data-act="nav" data-v="dungeons"`, bounty: `data-act="qtab" data-v="bounty"`, tresor: `data-act="qtab" data-v="tresor"`, cmd: `data-act="qtab" data-v="commandes"`, harvest: `data-act="nav" data-v="metiers"`, craft: `data-act="nav" data-v="metiers"`, almanax: `data-act="qtab" data-v="almanax"` }[q.t]);
  function hebdoHtml(s) {
    const W = E.wkState(s); const nd = W.list.filter((q) => q.done).length;
    return `${head(s, "hebdo", "Chaque lundi, 3 nouvelles quêtes à ton niveau : une de chasse, une de donjon ou de chasse aux primes, une d'artisan ou d'Almanax. Chacune donne des kamas et de l'XP dès qu'elle est finie ; les 3 finies ouvrent le Coffre de la semaine.")}
      <div class="qx-week ${W.claimed ? "done" : ""}"><div class="qx-wh">${IC("coffre")}<div class="grow"><b>Coffre de la semaine</b><span class="small muted">${W.claimed ? "Reçu ✓ : un Coffre en or et 3 parchemins de chasse. De nouvelles quêtes arrivent lundi." : "Les 3 quêtes terminées : un Coffre en or et 3 parchemins de chasse."}</span></div><span class="qj-tag ${W.claimed ? "ok" : ""}">${daysLeft()}</span></div>
      <div class="qx-wbar">${W.list.map((q) => `<i class="${q.done ? "ok" : ""}"></i>`).join("")}</div></div>
      <div class="qx-wl">${W.list.map((q, i) => `<article class="qj-card ${q.done ? "done" : ""}"><div class="qj-ch">${IC(WK_IC[q.t] || "quetes")}<h3>${h(E.wkName(q))}</h3>${q.done ? `<span class="qj-tag ok">Terminée ✓</span>` : `<span class="qj-tag">${fmt(q.p)}/${fmt(q.n)}</span>`}</div><span class="small muted">${h(E.wkTxt(q))}</span><div class="row"><div class="bar grow"><i style="width:${X().pct(q.p, q.n)}%"></i></div><span class="num xs">${fmt(q.p)}/${fmt(q.n)}</span></div><div class="row"><span class="qj-rew">${IC("kamas")} <b>${fmt(E.wkRew(q))} k</b> · <b>XP</b></span><span class="grow"></span>${q.done ? "" : `${X().pinBtn({ k: "wk", id: i })}<button class="btn sm" ${wkGo(q)}>Y aller</button>`}</div></article>`).join("")}</div>
      <p class="xs muted" style="margin:0">${nd}/3 cette semaine · ${fmt(s.cnt.wk || 0)} coffre${(s.cnt.wk || 0) > 1 ? "s" : ""} de la semaine ouvert${(s.cnt.wk || 0) > 1 ? "s" : ""} en tout.</p>`;
  }

  /* ---------- tableau des avis : rang de chasseur, 3 avis, un boss, l'élite de la semaine (0.1.49) ---------- */
  function bountyHtml(s) {
    const bs = s.bounties || []; const rk = E.hunterRank(s); const R = E.HUNT_RANKS; const n = s.cnt.bounty || 0; const nx = R[rk + 1];
    const cost = E.rerollCost(s); const free = (s.cons.parchemin_avis || 0) > 0;
    const poster = (b, tier) => { const m = MONSTERS[b.key]; const where = b.dg ? DUNGEONS[b.dg].name : E.SUBS[b.sub] ? E.SUBS[b.sub].name : "";
      const kam = Math.round(b.kamas * E.huntBonus(s));
      return `<div class="qx-pos ${tier}"><span class="qx-tier">${tier === "elite" ? "Élite · semaine" : tier === "boss" ? "Boss" : "Recherché"}</span>${X().im(X().imgM(b.key), "", m.name)}<b>${h(m.name)}</b><span class="xs muted">${h(where)} · niv. ${m.lvl[0]}–${m.lvl[1]}${tier === "elite" ? ` · stasis ${b.s} ou plus` : ""}</span>
        <div class="row" style="width:100%"><div class="bar grow"><i style="width:${X().pct(b.prog, b.n)}%"></i></div><span class="num xs">${b.prog}/${b.n}</span></div>
        <span class="qx-prime">${IC("kamas")} <b>${fmt(kam)}</b> · ${tier === "elite" ? "5 jetons · Coffre en or" : tier === "boss" ? "2 jetons" : "1 jeton"}${s.align && b.axp ? ` · +${b.axp} alignement` : ""}</span>
        <div class="row qx-pb">${tier === "elite" ? (b.done ? `<span class="qj-tag ok">Rempli ✓</span>` : X().pinBtn({ k: "belite" })) : X().pinBtn({ k: "bounty", id: b.id })}${b.dg ? (b.done ? "" : `<button class="btn sm primary" data-act="dgopen" data-id="${b.dg}">Donjon</button>`) : `<button class="btn sm primary" data-act="zoneview" data-id="${b.sub}" data-gotab="world">Y aller</button>`}${tier === "elite" ? "" : `<button class="btn sm" data-act="reroll" data-id="${b.id}" ${!free && s.kamas < cost ? "disabled" : ""} data-tip="Changer d'avis · ${free ? "gratuit (Parchemin d'Avis)" : fmt(cost) + " kamas"}">↻</button>`}</div></div>`; };
    const B0 = E.eliteState(s);
    const board = bs.filter((b) => !b.boss).map((b) => poster(b, "")).join("") + bs.filter((b) => b.boss).map((b) => poster(b, "boss")).join("")
      + (B0.key ? poster(B0, "elite") : `<div class="qx-pos elite lock"><span class="qx-tier">Élite · semaine</span><b>Avis d'élite</b><span class="xs muted">Un boss de ton niveau en stasis ${E.ELITE_STASIS}. Il apparaît dès qu'un donjon de ton niveau est ouvert.</span></div>`);
    return `${head(s, "bounty", "Les avis de recherche suivent le niveau de ton équipe et se remplissent tout seuls en chassant (ou en battant le boss demandé). Un avis rempli est remplacé aussitôt ; un avis pas commencé devenu trop facile aussi. Chaque rang de chasseur ajoute +10 % aux primes. L'avis d'élite change chaque lundi : un boss de ton niveau à battre en stasis " + E.ELITE_STASIS + " ou plus.")}
      <div class="qx-rank">${IC("carte")}<div class="grow"><div class="row between"><b>Rang de chasseur : ${h(R[rk][0])}</b><span class="xs muted">${fmt(n)} avis remplis${nx ? ` · prochain : ${h(nx[0])} à ${fmt(nx[1])}` : " · rang maximal"}</span></div><div class="bar"><i style="width:${nx ? X().pct(n - R[rk][1], nx[1] - R[rk][1]) : 100}%"></i></div><span class="xs muted">Primes +${rk * 10} %${nx ? ` · +${(rk + 1) * 10} % au rang suivant` : ""}</span></div><button class="btn sm" data-act="qj-shop" data-v="prime">${IC("bourse")} Bureau des primes · ${fmt(s.tokens[E.SHOPS.prime.cur] || 0)} jetons</button></div>
      <div class="qx-board">${board}</div>
      <p class="xs muted" style="margin:0">Changer un avis : ${free ? `gratuit (${s.cons.parchemin_avis} Parchemin${s.cons.parchemin_avis > 1 ? "s" : ""} d'Avis)` : `${fmt(cost)} kamas`} · ${fmt(s.cnt.bboss || 0)} avis de boss et ${fmt(s.cnt.belite || 0)} avis d'élite remplis.</p>`;
  }

  /* ---------- chasse au trésor (déplacée du Monde, 0.1.49) ---------- */
  function tresorPage(s) {
    return `${head(s, "tresor", "Trois tailles de chasse : la courte est gratuite chaque jour, la normale se trouve sur les monstres en chasse, la légendaire se prend une fois par semaine dès le niveau 50 (8 indices, un donjon, un gardien d'élite et un Coffre en or). L'équipe suit les indices toute seule.")}${X().tresorHtml()}`;
  }

  /* ---------- succès : points, paliers, classement, filtres, recherche, secrets (0.1.49) ---------- */
  const CAT_IC = { Progression: "trophee", Combat: "combat", Donjons: "cle", Chasse: "carte", Objets: "dofus", Métiers: "pioche", Forgemagie: "forge", Quêtes: "quetes", Alignement: "ailes", "Havre-Sac": "havre", Archimonstres: "dofus", Expédition: "carte", Exploration: "monde", "Songe infini": "cristal", Régions: "monde", Classes: "couronne", Kolizéum: "combat", Économie: "bourse", Chasses: "carte", Collection: "sac", Secrets: "idee" };
  const catIc = (c) => (c === "Idoles" ? `<img class="uico" src="assets/id/pro.webp" alt="">` : IC(CAT_IC[c] || "trophee"));
  const hidden = (s, a) => a.secret && !s.ach[a.id];
  function achItem(s, a) {
    const got = s.ach[a.id]; const sec = hidden(s, a); const pr = !got && !sec && E.achProgress(s, a.id);
    return `<div class="ach ${got ? "ok" : ""} ${sec ? "sec" : ""}" data-q="${h((sec ? "" : a.name + " " + a.desc).toLowerCase())}"><span class="ic">${got ? IC("trophee") : sec ? "?" : "·"}</span><span class="grow"><b>${sec ? "???" : h(a.name)}</b>${pr ? ` <span class="xs num">${fmt(Math.min(pr[0], pr[1]))}/${fmt(pr[1])}</span>` : ""} <span class="qx-pt">${E.achPts(a)} pts</span><br><span class="xs muted">${sec ? `Indice : ${h(a.hint || "un succès secret")}` : h(a.desc)} · ${fmt(a.kamas)} k${a.title && !sec ? ` · titre « ${h(a.title)} »` : ""}</span></span>${pr ? X().pinBtn({ k: "ach", id: a.id }) : ""}</div>`;
  }
  function achList(s, list) {
    const sorted = list.map((a) => [a, achRatio(s, a)]).sort((x, y) => (x[1] === 2) - (y[1] === 2) || y[1] - x[1]).map((x) => x[0]);
    const grps = [...new Set(sorted.map((a) => a.grp || ""))];
    if (grps.length < 2) return `<div class="pad achgrid">${sorted.map((a) => achItem(s, a)).join("")}</div>`;
    return `<div class="pad stack">${grps.map((g) => { const L = sorted.filter((a) => (a.grp || "") === g); return `<h3 class="sec">${h(g || "Autres")} <span class="xs muted num">${L.filter((a) => s.ach[a.id]).length}/${L.length}</span></h3><div class="achgrid">${L.map((a) => achItem(s, a)).join("")}</div>`; }).join("")}</div>`;
  }
  function achHtml(s) {
    const cats = [...new Set(E.ACH.map((a) => a.cat))];
    const P = E.achPoints(s); const PL = E.ACH_PALIERS; const maxP = PL[PL.length - 1].n; const nx = PL.find((x) => x.n > P); const prv = PL.filter((x) => x.n <= P).pop();
    const nGot = E.ACH.filter((a) => s.ach[a.id]).length;
    const lb = X().achLb ? X().achLb() : null;
    const lbHtml = lb && lb.rows && lb.rows.length ? `${lb.rows.map((r, i) => `<div class="row between ${r.me ? "me" : ""}"><span><b class="num">${i + 1}.</b> ${h(r.p)}</span><span class="num">${fmt(r.v)}</span></div>`).join("")}${lb.me && lb.me.rank > 3 ? `<div class="row between me"><span><b class="num">${fmt(lb.me.rank)}.</b> toi</span><span class="num">${fmt(lb.me.v)}</span></div>` : ""}<button class="btn xs" data-act="nav" data-v="ladder">Tout le classement</button>`
      : `<span class="xs muted">${window.ONLINE && window.ONLINE.user && window.ONLINE.solo && window.ONLINE.solo() ? "Partie solo : le classement des points suit ta partie 1." : window.ONLINE && window.ONLINE.enabled ? "Connecte-toi pour entrer au classement des points (Communauté › Classements › Succès)." : "Le classement des points est sur le jeu en ligne."}</span>`;
    const track = `<div class="qx-pts"><div class="qx-pbig">${IC("trophee")}<span><b class="num">${fmt(P)}</b><small>points de succès</small></span></div><div class="grow stack" style="gap:6px"><div class="row between"><span class="small">${nx ? `Prochain palier : <b>${fmt(nx.n)} pts</b> · ${h(nx.txt)}` : "<b>Tous les paliers sont atteints !</b>"}</span><span class="xs muted">${fmt(nGot)} / ${fmt(E.ACH.length)} succès</span></div>
      <div class="qx-pal">${PL.map((x) => `<span class="${x.n <= P ? "ok" : nx && x.n === nx.n ? "cur" : ""}" style="left:${Math.sqrt(x.n / maxP) * 100}%" data-tip="${h(x.txt)}"><i></i><small>${fmt(x.n)}</small></span>`).join("")}<b style="width:${Math.min(100, Math.sqrt(P / maxP) * 100)}%"></b></div>
      <span class="xs muted">${prv ? `Dernier palier : ${h(prv.txt)} ✓ · ` : ""}les paliers donnent coffres, ornements et titres</span></div>
      <div class="qx-lb"><span class="qj-lab">Classement des points</span>${lbHtml}</div></div>`;
    const FIL = [["all", "Tous"], ["near", "Presque finis"], ["run", "En cours"], ["got", "Obtenus"], ["sec", "Secrets"]];
    const tools = `<div class="row qx-atools"><div class="qj-fil">${FIL.map(([k, l]) => `<button data-act="qj-af" data-v="${k}" aria-pressed="${st.af === k}">${l}</button>`).join("")}</div><span class="grow"></span><input class="qx-search" id="qxSearch" type="search" placeholder="Chercher un succès…" aria-label="Chercher un succès" value="${h(st.achq)}" autocomplete="off"></div>`;
    const q = E.searchNorm(st.achq); // 1.0.12.8 : sans accents ni majuscules (« kolizeum » trouve les succès du Kolizéum)
    const fil = (a) => st.af === "all" || (st.af === "got" ? s.ach[a.id] : st.af === "sec" ? a.secret : st.af === "near" ? !s.ach[a.id] && !hidden(s, a) && achRatio(s, a) >= 0.5 : !s.ach[a.id] && !hidden(s, a) && achRatio(s, a) > 0);
    let main;
    if (q || st.af !== "all") {
      const L = E.ACH.filter((a) => fil(a) && (!q || (!hidden(s, a) && E.searchNorm(a.name + " " + a.desc).includes(q))));
      main = `<section class="panel"><div class="phead"><h2>${q ? `Recherche « ${h(st.achq)} »` : h(FIL.find((x) => x[0] === st.af)[1])}</h2><span class="xs muted num">${L.length} succès</span></div>${L.length ? achList(s, L.slice(0, 300)) : `<div class="pad small muted">Aucun succès ne correspond.</div>`}</section>`;
    } else {
      const near = nearAch(s, 3);
      if (!st.cat || !cats.includes(st.cat)) st.cat = near.length ? near[0][0].cat : cats[0];
      const tiles = cats.map((c) => { const all = E.ACH.filter((a) => a.cat === c); const g = all.filter((a) => s.ach[a.id]).length;
        return `<button class="qj-cat" data-act="qj-cat" data-v="${h(c)}" aria-pressed="${st.cat === c}"><span class="row" style="flex-wrap:nowrap">${catIc(c)}<b class="grow">${h(c)}</b><span class="num xs muted">${g}/${all.length}</span></span><div class="bar"><i style="width:${X().pct(g, all.length)}%"></i></div></button>`; }).join("");
      main = `${near.length ? `<div class="stack" style="gap:8px"><span class="qj-lab">Presque terminés</span><div class="qj-near">${near.map(([a, r]) => { const p = E.achProgress(s, a.id);
        return `<div class="qj-nc"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b>${h(a.name)}</b>${X().pinBtn({ k: "ach", id: a.id })}</div><span class="xs muted">${h(a.desc)} · ${fmt(a.kamas)} k · ${E.achPts(a)} pts${a.title ? ` · titre « ${h(a.title)} »` : ""}</span><div class="row"><div class="bar grow"><i style="width:${Math.round(r * 100)}%"></i></div><span class="num xs">${fmt(Math.min(p[0], p[1]))}/${fmt(p[1])}</span></div></div>`; }).join("")}</div></div>` : ""}
      <div class="qj-cats">${tiles}</div>
      <section class="panel"><div class="phead"><h2>${catIc(st.cat)} ${h(st.cat)}</h2><span class="xs muted">${st.cat === "Secrets" ? "cachés jusqu'à ce qu'on les trouve" : "les plus proches en haut, les obtenus en bas"}</span></div>${achList(s, E.ACH.filter((a) => a.cat === st.cat))}</section>`;
    }
    return `${head(s, "ach", "Les succès se débloquent tout seuls en jouant et donnent des kamas, des points de succès et parfois un titre. Les points ouvrent des paliers (coffres, ornements, titres) et comptent pour le classement. Les succès secrets ne montrent qu'un indice. Le bouton épingle suit un succès dans la bande d'objectifs.")}${track}${tools}${main}`;
  }
  function ornHtml(s) {
    const L = E.REGIONS; const got = L.filter((R) => E.ornUnlocked(s, "reg_" + R.id)).length;
    const pal = [["pal1", "Médaillon du Mérite", "500 points de succès"], ["pal2", "Couronne d'étoiles", "3 500 points de succès"]];
    const gal = `<section class="panel"><div class="phead"><h2>Emblèmes de région</h2><span class="xs muted">${got}/${L.length} · un par quête de région terminée · à équiper dans Héros › Ornement</span></div>
      <div class="pad qx-ogal">${L.map((R) => { const ok = E.ornUnlocked(s, "reg_" + R.id); return `<button class="qx-og ${ok ? "ok" : ""}" data-act="qj-reg" data-v="${R.id}"><img src="assets/ui/orn/orn_${R.id}.svg" alt="" loading="lazy"><b>${h(R.name)}</b><small>${ok ? "obtenu ✓" : `quête de région · niv. ${R.lv}`}</small></button>`; }).join("")}
      ${pal.map(([id, n, r]) => { const ok = E.ornUnlocked(s, id); return `<div class="qx-og pal ${ok ? "ok" : ""}"><img src="assets/ui/orn/orn_${id}.svg" alt="" loading="lazy"><b>${h(n)}</b><small>${ok ? "obtenu ✓" : `palier · ${r}`}</small></div>`; }).join("")}</div></section>`;
    const rest = X().ornHtml().replace(/<h2>Ornements<\/h2>/, "<h2>Autres ornements</h2>");
    return `${head(s, "orn", "Les ornements entourent la carte d'un héros. Ils se débloquent avec les succès, les quêtes et les boutiques, et s'équipent dans Héros › Ornement.")}${gal}${rest}`;
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

  function render(main, soft) { // soft : rafraîchissement automatique (toutes les 3 s), mise à jour ciblée qui garde défilement et saisie
    const s = S(); const ui = UI();
    const valid = ["jour", "shops"].concat(FAMS.flatMap((F) => F.pages.map((p) => p[0])), COL.map((p) => p[0]));
    if (!valid.includes(ui.qt)) ui.qt = "jour";
    const qt = ui.qt;
    if (qt === "ach" || qt === "orn") { // page Succès : succès et ornements, sans le journal
      // la recherche garde le curseur malgré le rafraîchissement de la page
      const f = document.activeElement && document.activeElement.id === "qxSearch" ? document.activeElement.selectionStart : null;
      main.innerHTML = `<div class="pagehead"><h1>Succès</h1></div><nav class="subtabs">${COL.map(([id, n]) => `<button data-act="qtab" data-v="${id}" aria-pressed="${qt === id}">${n} ${cnt(s, id)}</button>`).join("")}</nav><section class="stack">${qt === "ach" ? achHtml(s) : ornHtml(s)}</section>`;
      if (f !== null) { const el = document.getElementById("qxSearch"); if (el) { el.focus(); try { el.setSelectionRange(f, f); } catch (e) {} } }
      return;
    }
    const body = qt === "jour" ? jourHtml(s) : qt === "main" ? mainHtml(s) : qt === "region" ? regionHtml(s) : qt === "hebdo" ? hebdoHtml(s) : qt === "bounty" ? bountyHtml(s) : qt === "tresor" ? tresorPage(s) : qt === "dofus" ? dofusHtml(s) : qt === "shops" ? shopsHtml(s) : keptHtml(s, qt);
    // 1.0.3.2 : la page se redessine toutes les 3 s ; on garde le défilement des rangées horizontales (chapitres…)
    const keep = st.lastQt === qt ? [...main.querySelectorAll(".qj-main *")].filter((e) => e.scrollLeft > 0 && typeof e.className === "string" && e.className.trim()).map((e) => [e.className, e.scrollLeft]) : [];
    st.lastQt = qt;
    const html = `<div class="pagehead"><h1>Quêtes</h1></div><div class="qj-lay">${journal(s, qt)}<div class="qj-main">${mtabs(s, qt)}<section class="stack">${body}</section></div></div>`;
    if (soft && window.DX.morph) { window.DX.morph(main, html); return; }
    main.innerHTML = html;
    keep.forEach(([c, x]) => { const e = main.querySelector(".qj-main ." + c.trim().split(/\s+/).join(".")); if (e) e.scrollLeft = x; });
  }

  function act(a, t) {
    const d = t.dataset; const ui = UI();
    switch (a) {
      case "qj-help": st.help[d.v] = !st.help[d.v]; break;
      case "qj-dof": { st.dof = d.v; X().render(); const f = document.querySelector(".qj-fiche"); // 1.0.12.8 : au téléphone la fiche est au-dessus de la grille, on la fait venir à l'écran
        if (f && window.matchMedia("(max-width:860px)").matches) f.scrollIntoView({ block: "start" }); return; }
      case "qj-dfil": st.dfil = d.v; break;
      case "qj-dfam": st.dfam = d.v; break; // 1.0.16
      case "qj-cat": st.cat = d.v; break;
      case "qj-shop": if (window.CPTUI) { X().closeSheet(); window.CPTUI.open(d.v); return; } st.shop = d.v; ui.tab = "quests"; ui.qt = "shops"; X().closeSheet(); break; // 1.0.30 : Économie › Comptoirs (js/comptoirsui.js)
      case "qj-chap": st.chap = +d.v; break;
      case "qj-reg": st.reg = d.v; ui.tab = "quests"; ui.qt = "region"; if (!regFil(S(), E.REGION[d.v], st.rf, top(S()))) st.rf = "all"; X().closeSheet(); window.scrollTo(0, 0); break;
      case "qj-rf": st.rf = d.v; break;
      case "qj-af": st.af = d.v; break;
      case "qj-ach": st.cat = d.v; st.af = "all"; st.achq = ""; ui.tab = "quests"; ui.qt = "ach"; window.scrollTo(0, 0); break;
      case "qj-rqgive": case "qj-rqclaim": { const r = E.act(S(), a === "qj-rqgive" ? "rqGive" : "rqClaim", d.v); if (r) { X().toast(r, "warn"); return; } if (X().markDirty) X().markDirty(); if (a === "qj-rqgive") X().toast("Ressources remises.", "rare"); break; }
      default: return;
    }
    X().render();
  }

  // garde la liste des étapes terminées ouverte malgré le rafraîchissement automatique de la page
  document.addEventListener("toggle", (e) => { if (e.target.classList && e.target.classList.contains("qj-done")) st.doneOpen = e.target.open; }, true);
  // recherche dans les succès : la liste se met à jour en tapant
  let qTimer = null;
  document.addEventListener("input", (e) => { if (e.target && e.target.id === "qxSearch") { st.achq = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => X().render(), 180); } });
  window.QUI = { render, act, todo, dofusHtml, pick: (id) => { if (E.DOFUS[id]) { st.dof = id; st.dfil = "all"; } } };
})();
