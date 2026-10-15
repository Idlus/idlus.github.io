/* ============================================================================
   COLLECTIONS — interface (1.0.30). La logique est dans js/collections.js (panoplies) et js/dofusp.js (Potentiel des Dofus).
   - Héros › Familiers et montures (choix 27A) : familiers, montiliers et montures en onglets, recherche (nom, bonus, zone),
     filtres possédés / manquants, tri, fiche à droite avec « Équiper sur » pour chaque héros ; ceux qui manquent disent
     où les trouver, avec « Y aller ». Au téléphone, la fiche s'ouvre en fenêtre.
   - Encyclopédie › Panoplies (choix 32A) : la Collection de panoplies (9 paliers, régions complètes), puis les panoplies
     avec « Équiper sur » en un clic, « Pièces manquantes » (liste de courses) et « Y aller ». L'ancien onglet Panoplies
     de l'Inventaire renvoie ici.
   - Quêtes › Dofus › Potentiel (choix 42A) : rang, éclat, caractéristiques et passif avant et après, copies, Sublimé.
   - Annonce « Dofus Sublimé » dans le chat : le résumé de la partie envoyé au serveur porte la liste « dsub »
     (supabase/collections.sql). Sans compte ou hors ligne : la fête et le journal seulement.
   Rien n'est redessiné par la boucle de 3 s ici : la vue Potentiel vit dans les Quêtes (DX.morph) ; les autres pages
   se redessinent au clic.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !D || !window.DX || !E.collState) return;
  const { ITEMS, SETS, STATS, CLASSES, DUNGEONS, MONSTERS } = D;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const im = (src, cls, alt) => X().im(src, cls === undefined ? "" : cls, alt || "");
  const IC = (n, c) => X().IC(n, c || "");
  const roman = (n) => (E.roman ? E.roman(n) : String(n));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const phone = () => window.innerWidth < 900;
  const st = { pk: "fam", q: "", f: "all", bon: "all", sort: "lvl", sel: {}, sq: "", sf: "all", scid: "", sn: 30, regAll: false, pot: false, dsel: null };

  /* ---------- petits rendus ---------- */
  const petImg = (id) => (E.PETS[id] ? `assets/p/${E.PETS[id].icon}.webp` : "");
  const petPic = (P) => `assets/p/${E.petIcon(P)}.webp`; // 1.1 : Mue (apparence d'un autre familier)
  const starsHtml = (n) => `<span class="co-pst" aria-label="Éveil ${n} sur 5">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>`;
  const mountImg = (sp, c) => `assets/mt/${E.mountIcon(sp, c)}.webp`;
  const PCT = ["cri", "rt", "rf", "re", "ra", "rn", "dsort"];
  const statName = (k) => (k === "pa" ? "PA" : k === "pm" ? "PM" : k === "po" ? "Portée" : k === "inv" ? "Invocation" : STATS[k] ? STATS[k].name.replace("% ", "") : k);
  const statTxt = (k, v) => (k === "pa" || k === "pm" || k === "po" || k === "inv" ? `+${v} ${statName(k)}` : `+${fmt(v)}${PCT.includes(k) ? " %" : ""} ${statName(k)}`);
  const bonusTxt = (stats) => Object.entries(stats || {}).filter(([, v]) => v).map(([k, v]) => statTxt(k, v)).join(" · ");
  const subName = (sid) => (E.SUBS[sid] ? E.SUBS[sid].name : sid || "");
  const heroesOf = (s) => s.chars.slice().sort((a, b) => (b.inTeam ? 1 : 0) - (a.inTeam ? 1 : 0) || b.lvl - a.lvl);
  const kamas = (s) => `<span class="small muted"><span class="coin"></span> <b class="num">${fmt(s.kamas)}</b> kamas</span>`;
  const itemImg = (t) => X().itemImg(t);

  /* ======================= HÉROS › FAMILIERS ET MONTURES (27A) ======================= */
  const PK = [["fam", "Familiers"], ["monti", "Montiliers"], ["mt", "Montures"]];
  function petEntries(s, monti) {
    return Object.keys(E.PETS).filter((id) => (E.PETS[id].kind === "monti") === monti).map((id) => {
      const p = E.PETS[id]; const P = E.petOwned(s, id) || null; const worn = P ? E.petOwner(s, P.uid) : null;
      return { key: id, name: p.name, img: P ? petPic(P) : petImg(id), gold: !!p.gold, stats: E.petMax(id), lvl: p.lvl, own: !!P, P, worn, where: E.petWhere(id), kind: p.kind, fam: p.fam, food: p.food, sub: p.sub, dg: p.dg, req: E.petReqLvl(id) };
    });
  }
  function mountEntries(s) {
    const out = [];
    E.MOUNT_ORDER.forEach((sp) => { const Sp = E.MOUNTS[sp], Z = E.MOUNT_SP[sp]; const sb = E.SUBS[Z.sub];
      Object.keys(Sp.cols).forEach((c) => {
        const col = Sp.cols[c]; const L = Object.values(s.mounts || {}).filter((M) => M.sp === sp && M.c === c).sort((a, b) => b.lvl - a.lvl);
        const wild = Z.wild.includes(c);
        const where = wild ? `Capture : ${subName(Z.sub)}${sb && sb.lvl ? ` (niv. ${sb.lvl[0]}-${sb.lvl[1]})` : ""}, avec un filet, 1 sur ${Math.round(Z.wild.length / Z.rate)} par victoire` : `Enclos : ${col.p ? col.p.join(" + ") : "élevage"}`;
        const worn = L.map((M) => E.mountOwner(s, M.uid)).find(Boolean) || null;
        out.push({ key: sp + ":" + c, sp, c, name: E.mountName({ sp, c }), img: mountImg(sp, c), stats: E.mountStatsMax(sp, c), lvl: Z.req, own: L.length > 0, L, worn, where, wild, sub: Z.sub, gen: col.g || 1, req: Math.max(E.MOUNT_LVL || 0, Z.req) });
      }); });
    return out;
  }
  const entriesOf = (s, pk) => (pk === "mt" ? mountEntries(s) : petEntries(s, pk === "monti"));
  const hay = (e) => norm(`${e.name} ${bonusTxt(e.stats)} ${e.where} ${e.food || ""}`);
  function listOf(s) {
    const all = entriesOf(s, st.pk);
    const q = norm(st.q).trim();
    const base = all.filter((e) => (!q || q.split(/\s+/).every((w) => hay(e).includes(w))) && (st.bon === "all" || (e.stats && e.stats[st.bon])));
    const n = { all: base.length, own: base.filter((e) => e.own).length }; n.miss = n.all - n.own;
    const L = base.filter((e) => st.f === "all" || (st.f === "own" ? e.own : !e.own));
    const first = (e) => Object.keys(e.stats || {})[0] || "";
    const by = { lvl: (a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name, "fr"), nom: (a, b) => a.name.localeCompare(b.name, "fr"),
      bonus: (a, b) => statName(first(a)).localeCompare(statName(first(b)), "fr") || (b.stats[first(b)] || 0) - (a.stats[first(a)] || 0),
      own: (a, b) => (b.own ? 1 : 0) - (a.own ? 1 : 0) || a.lvl - b.lvl };
    L.sort(by[st.sort] || by.lvl);
    return { all, L, n };
  }
  const kindTxt = (e) => (e.sp ? `monture, génération ${e.gen}, héros niveau ${e.req}` : e.kind === "monti" ? `montilier ${(E.PET_FAMS[e.fam] || "").toLowerCase().replace(/s$/, "")}, niv. ${e.lvl}` : e.kind === "boss" ? `familier rare de boss, niv. ${e.lvl}` : `familier de zone, niv. ${e.lvl}`);
  function goBtn(e) {
    const b = (attr) => `<button class="btn sm" ${attr}>${IC("carte")} Y aller</button>`;
    if (e.sp) return e.wild ? b(`data-act="searchzone" data-id="${h(e.sub)}"`) : window.ELEVUI ? b(`data-act="el-go" data-v="carnet"`) : b(`data-act="hvroomgo" data-v="enclos"`);
    if (e.dg && DUNGEONS[e.dg]) return b(`data-act="dgopen" data-id="${h(e.dg)}"`);
    if (e.sub && E.SUBS[e.sub]) return b(`data-act="searchzone" data-id="${h(e.sub)}"`);
    return "";
  }
  function heroBtns(s, e) {
    return heroesOf(s).map((c) => {
      const on = e.sp ? e.L.some((M) => c.mount === M.uid) : !!(e.P && c.pet === e.P.uid);
      const blocked = e.sp && E.mountBlocked && E.mountBlocked(s, c);
      const ok = c.lvl >= e.req && !blocked;
      const tip = on ? `${c.name} l'a déjà` : blocked ? `${c.name} chevauche un montilier` : !ok ? `Niveau ${e.req} requis` : e.worn && e.worn !== c ? `Le prendre à ${e.worn.name}` : `Équiper sur ${c.name}`;
      return `<button class="btn sm ${on ? "on" : ""}" data-act="co-peq" data-cid="${c.id}" data-v="${h(e.key)}" ${on || !ok ? "disabled" : ""} title="${h(tip)}">${X().cmed(c.cls, c.lvl, c.ren)} ${h(c.name)}${on ? " ✓" : !ok ? ` <span class="xs">niv. ${e.req}</span>` : ""}</button>`;
    }).join("");
  }
  /* 1.1 : croissance, aptitude, friandise, Éveil, Pension, Mue */
  function petGrow(s, e) {
    const P = e.P; const id = e.key; const p = E.PETS[id]; const lv = E.petLvl(P); const mon = p.kind === "monti";
    const pctNext = P.g >= 100 ? 100 : mon ? Math.floor((P.x || 0) * 100) : Math.floor((P.s || 0) / E.PET_SOUL_LVL * 100);
    const barTxt = P.g >= 100 ? "Niveau 100 · bonus au maximum" : mon ? `Niveau ${lv} · ${pctNext} % vers le suivant` : `Niveau ${lv} · ${fmt(Math.floor(P.s || 0))} / ${E.PET_SOUL_LVL} âmes`;
    const cur = E.petStatsAt(id, P.g, P.st);
    const aptOn = P.g >= 100;
    const prey = [...E.petPrey(id)].map((k) => (MONSTERS[k] ? MONSTERS[k].name : "")).filter(Boolean);
    const lines = [`<div class="pbar co-pbar"><i style="width:${P.g >= 100 ? 100 : P.g}%"></i><span>${barTxt}</span></div>`, `<div class="small"><span class="muted">Maintenant :</span> <b class="pbon">${h(bonusTxt(cur)) || "—"}</b></div>`];
    lines.push(`<div class="co-apt ${aptOn ? "on" : ""}"><b>🐾 ${h(E.petAptName(P))}</b><span class="xs">${h(E.petAptTxt(id))}${aptOn ? "" : " · au niveau 100"}</span></div>`);
    if (E.petHasAura(P)) lines.push(`<div class="xs co-gold">Aura : +${E.PET_AURA} % de dégâts pour toute l'équipe en combat (${E.PET_AURA_MAX} % au plus).</div>`);
    const btns = [];
    if (P.g < 100 && mon) lines.push(`<div class="xs muted">Il grandit avec l'XP de son héros : ${E.MONTI_SHARE} % de l'XP gagnée lui revient jusqu'au niveau 100 (toute l'XP si le héros est niveau ${E.MAX_LVL}).</div>`);
    if (P.g < 100 && !mon) {
      lines.push(`<div class="xs muted">1 âme par monstre vaincu par l'équipe, ${E.PET_PREY} pour ses proies${prey.length ? ` (${h(prey.slice(0, 4).join(", "))}${prey.length > 4 ? "…" : ""})` : ""}. Encore ${fmt(E.petSoulsLeft(P))} âmes avant le niveau 100.</div>`);
      if (p.food) { const have = s.res[p.food] || 0; const left = E.petTreatsLeft(s, P.uid); const ok = have >= E.PET_TREAT_N && left > 0;
        btns.push(`<button class="btn sm ${ok ? "primary" : ""}" data-act="co-ptreat" data-uid="${P.uid}" ${ok ? "" : "disabled"} title="${h(`${E.PET_TREAT_N} × ${p.food} = +1 niveau (${left} sur ${E.PET_TREAT_DAY} aujourd'hui)`)}">Friandise · ${E.PET_TREAT_N} ${h(p.food)} <span class="xs">(${fmt(have)} · ${left}/${E.PET_TREAT_DAY})</span></button>`); }
      if (E.petAlbum(s) >= 10) btns.push(s.petPension === P.uid ? `<button class="btn sm on" data-act="co-ppension" data-uid="0">En pension ✓</button>` : `<button class="btn sm" data-act="co-ppension" data-uid="${P.uid}" title="Il grandit à moitié vitesse sans être porté">Mettre en pension</button>`);
    }
    if (P.g >= 100) { const C = E.petStarCost(P);
      lines.push(`<div class="small row" style="gap:8px;flex-wrap:wrap"><span><span class="muted">Éveil :</span> ${starsHtml(P.st || 0)}</span>${C ? `<span class="xs muted">★${(P.st || 0) + 1} : ${fmt(C[0])} Essence + ${fmt(C[1])} k · tu as ${fmt(E.petEss(s))} Essence</span>` : `<span class="xs co-gold">Éveil au maximum</span>`}</div>`);
      if (C) { const ok = E.petEss(s) >= C[0] && s.kamas >= C[1]; btns.push(`<button class="btn sm ${ok ? "primary" : ""}" data-act="co-pawake" data-uid="${P.uid}" ${ok ? "" : "disabled"}>Éveiller ★${(P.st || 0) + 1}</button>`); } }
    if (E.petAlbum(s) >= 100) { const own = Object.values(s.pets).map((Q) => Q.id).filter((x, i, A) => A.indexOf(x) === i && x !== id && E.PETS[x]).sort((a, b) => E.PETS[a].name.localeCompare(E.PETS[b].name, "fr"));
      lines.push(`<label class="small row" style="gap:6px">Mue <select data-co="skin" data-uid="${P.uid}"><option value="">Son apparence</option>${own.map((x) => `<option value="${x}" ${P.skin === x ? "selected" : ""}>${h(E.PETS[x].name)}</option>`).join("")}</select></label>`); }
    return lines.join("") + (btns.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${btns.join("")}</div>` : "");
  }
  function albumHtml(s) {
    const n = E.petAlbum(s), all = E.petAlbumAll();
    return `<section class="panel co-album"><div class="phead"><h2>Album de la ménagerie ${window.GUIDE ? GUIDE.q("familiers#album-de-la-menagerie") : ""}</h2><span class="small"><b class="num">${n}</b> / ${all} · Essence <b class="num">${fmt(E.petEss(s))}</b></span></div>
      <div class="pad"><div class="co-mil">${E.PET_TIERS.map((T) => { const ok = n >= T.n; return `<div class="${ok ? "ok" : ""}"><b class="n">${T.n}</b><span><b>${h(T.name)}</b>${ok ? " ✓" : ""} · ${h(T.txt)}</span></div>`; }).join("")}</div></div></section>`;
  }
  function petFiche(s, e) {
    const word = st.pk === "mt" ? "montures" : st.pk === "monti" ? "montiliers" : "familiers";
    let bar = "";
    if (e.sp && e.L.length) { const M = e.L[0]; bar = `<div class="pbar"><i style="width:${M.lvl >= E.MOUNT_MAX ? 100 : Math.round(M.lvl / E.MOUNT_MAX * 100)}%"></i><span>Niveau ${M.lvl}${e.L.length > 1 ? ` · ${e.L.length} à l'écurie` : ""}</span></div>`; }
    const wearer = e.worn ? `<div class="small"><span class="muted">${e.sp ? "Montée par" : "Porté par"} :</span> ${h(e.worn.name)}</div>` : "";
    return `<div class="phead"><h2>${h(e.name)}</h2><span class="tag ${e.own ? "good" : "soft"}">${e.own ? "possédé" : "manquant"}</span></div><div class="pad co-pd">
      <div class="big ${e.gold ? "co-pgold" : ""}">${im(e.img, "", e.name)}<div class="stack" style="gap:3px;min-width:0"><b>${h(bonusTxt(e.stats))}</b><span class="xs muted">au maximum${e.sp ? "" : " (avant l'Éveil)"} · ${h(kindTxt(e))}</span>${bar}</div></div>
      ${e.P ? petGrow(s, e) : ""}
      <div class="small co-where"><span><span class="muted">Où :</span> ${h(e.where)}</span>${e.own ? "" : goBtn(e)}</div>
      ${e.food && !e.P ? `<div class="small"><span class="muted">Friandise :</span> ${h(e.food)} <span class="xs muted">(${E.PET_TREAT_N} = +1 niveau)</span></div>` : ""}
      ${!e.sp && !e.P && E.PETS[e.key] ? `<div class="co-apt"><b>🐾 ${h(E.petAptName(e.key))}</b><span class="xs">${h(E.petAptTxt(e.key))} · au niveau 100</span></div>` : ""}
      ${!e.own && e.kind === "zone" && !E.PETS[e.key].songe ? (() => { const t = E.petTraces(s, e.sub); return `<div class="co-trace"><div class="row between small"><span>Traces <b class="num">${fmt(Math.floor(t))}</b> / ${E.PET_TRACE_N}</span><span class="${t >= E.PET_TRACE_N ? "co-gold" : "muted"} xs">${t >= E.PET_TRACE_N ? "1 chance sur 1 500, pour toujours" : "1 chance sur 2 000 · 1 sur 1 500 à 600 traces"}</span></div><div class="co-mini"><i style="width:${Math.min(100, t / E.PET_TRACE_N * 100)}%"></i></div></div>`; })() : ""}
      ${wearer}
      ${e.sp && e.L.length ? `<div class="small muted">À l'écurie (${E.stableN(s)} / ${E.stableCap(s)} places) :</div><div class="stack" style="gap:4px">${e.L.map((M) => { const o = E.mountOwner(s, M.uid); const enc = E.inPair(s, M.uid);
        return `<div class="row between small"><span>Niveau ${M.lvl} · petits ${M.kids}/${E.kidsCap(s)}${o ? ` · montée par ${h(o.name)}` : ""}${enc ? " · à l'enclos" : ""}</span><button class="btn sm" data-act="co-mfree" data-uid="${M.uid}" ${enc ? "disabled" : ""}>Relâcher</button></div>`; }).join("")}</div>` : ""}
      ${e.own ? `<div class="small muted">Équiper sur :</div><div class="co-heroes">${heroBtns(s, e)}</div>` : `<p class="note xs">${e.sp ? (e.wild ? "Avec un filet dans le sac, chaque victoire dans cette zone sauvage peut la capturer, en ligne comme hors ligne." : "Cette couleur naît à l'enclos du Havre-Sac, en faisant se reproduire les deux couleurs indiquées.") : e.kind === "unique" ? "Il rejoint ta ménagerie quand l'album atteint 140 familiers." : e.kind === "zone" ? `1 chance sur 2 000 par victoire dans sa sous-zone, même hors ligne. Chaque victoire laisse une trace : à ${E.PET_TRACE_N} traces, la chance passe à 1 sur 1 500 pour toujours${E.petAlbum(s) >= 50 ? " (Pistage : traces +25 %)" : ""}.` : e.kind === "boss" ? "Sur son boss, à partir de la stasis 7 : 1 chance sur 25." : "Sur son boss, à partir de la stasis 6 : 1 chance sur 25, et forcément au plus tard à la 60e victoire."}</p>`}
      <div class="xs muted">Les ${word} que tu n'as pas encore : touche-les pour voir où les trouver, avec « Y aller ».</div></div>`;
  }
  const tileHtml = (e, sel) => `<button class="co-pt ${e.own ? "" : "no"} ${sel ? "sel" : ""} ${e.gold ? "co-pgold" : ""}" data-act="co-psel" data-v="${h(e.key)}" aria-pressed="${sel}">${im(e.img, "", e.name)}${e.own ? `<span class="own">✓</span>` : ""}${e.worn ? `<span class="worn">${e.sp ? "montée" : "porté"}</span>` : ""}<b>${h(e.name)}</b><span>${h(bonusTxt(e.stats))}</span><span>${h(e.own ? (e.sp ? `niv. ${e.L[0].lvl}` : `niveau ${E.petLvl(e.P)}${e.P.st ? " · " + "★".repeat(e.P.st) : ""}`) : e.where)}</span></button>`;
  function petsHtml(s) {
    const { all, L, n } = listOf(s);
    const counts = PK.map(([k]) => { const A = entriesOf(s, k); return [A.filter((e) => e.own).length, A.length]; });
    const selKey = st.sel[st.pk] && all.some((e) => e.key === st.sel[st.pk]) ? st.sel[st.pk] : (L.find((e) => e.worn) || L.find((e) => e.own) || L[0] || all[0] || {}).key;
    const sel = all.find((e) => e.key === selKey);
    const keys = []; all.forEach((e) => Object.keys(e.stats || {}).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
    const ORD = D.STAT_ORDER || []; keys.sort((a, b) => (ORD.indexOf(a) + 1 || 99) - (ORD.indexOf(b) + 1 || 99));
    const title = PK.find((x) => x[0] === st.pk)[1];
    const chips = [["all", "Tous", n.all], ["own", "Possédés", n.own], ["miss", "Manquants", n.miss]];
    const grid = L.map((e) => tileHtml(e, e.key === selKey)).join("") || `<div class="empty">Rien ne correspond à cette recherche.</div>`;
    return `<div class="co-page"><div class="pagehead"><h1>Familiers et montures</h1>${kamas(s)}</div>
      <div class="co-top"><span class="seg">${PK.map(([k, nm], i) => `<button data-act="co-ptab" data-v="${k}" aria-pressed="${st.pk === k}">${nm} ${counts[i][0]}/${counts[i][1]}</button>`).join("")}</span><span class="xs muted">Tout ce que tu possèdes et ce qui manque, au même endroit.</span></div>
      <div class="co-tb"><input type="search" id="coQ" data-co="q" placeholder="Rechercher un nom, un bonus, une zone…" value="${h(st.q)}" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <span class="co-chips">${chips.map(([k, nm, c]) => `<button class="co-chip" data-act="co-pf" data-v="${k}" aria-pressed="${st.f === k}">${nm} <span class="n">${c}</span></button>`).join("")}</span>
        <select data-co="bon" aria-label="Bonus"><option value="all">Tous les bonus</option>${keys.map((k) => `<option value="${k}" ${st.bon === k ? "selected" : ""}>${h(statName(k))}</option>`).join("")}</select>
        <select data-co="sort" aria-label="Tri">${[["lvl", "Tri : niveau"], ["nom", "Tri : nom"], ["bonus", "Tri : bonus"], ["own", "Possédés d'abord"]].map(([k, nm]) => `<option value="${k}" ${st.sort === k ? "selected" : ""}>${nm}</option>`).join("")}</select></div>
      ${st.pk === "mt" ? "" : albumHtml(s)}
      <div class="co-2c"><section class="panel"><div class="phead"><h2>${title}</h2><span class="xs muted">${n.own} possédé${n.own > 1 ? "s" : ""} sur ${n.all}</span></div><div class="pad"><div class="co-pg">${grid}</div></div></section>
        ${phone() || !sel ? "" : `<section class="panel co-fiche">${petFiche(s, sel)}</section>`}</div></div>`;
  }
  function renderPets(main, soft) {
    const html = petsHtml(S());
    if ((soft || main.querySelector(":scope > .co-page")) && window.DX.morph) window.DX.morph(main, html); else main.innerHTML = html;
  }
  function petSheet() {
    const s = S(); const e = entriesOf(s, st.pk).find((x) => x.key === st.sel[st.pk]); if (!e) return;
    X().openSheet(`<div class="co-sheet panel">${petFiche(s, e)}<div class="pad" style="padding-top:0"><button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }

  /* ======================= ENCYCLOPÉDIE › PANOPLIES (32A) ======================= */
  const scHero = (s) => (st.scid && s.chars.find((c) => String(c.id) === String(st.scid))) || X().mainHero() || s.chars[0];
  function tiersHtml(s, n) {
    return `<div class="co-mil">${E.COLL_TIERS.map((T) => { const ok = n >= T.n;
      return `<div class="${ok ? "ok" : ""}${T.u ? " u" : ""}"><b class="n">${T.n}</b><span>${h(T.txt)}${T.u ? `<span class="u1">unique</span>` : ""}${ok ? " ✓" : ""}</span></div>`; }).join("")}</div>`;
  }
  function regionsHtml(s, C) {
    const R = E.collRegions().map((z) => { const L = E.regionSets(z); const d = L.filter((sid) => C.done.has(sid)).length; return { z, d, t: L.length, ok: C.regs.has(z), miss: L.filter((sid) => !C.done.has(sid)) }; });
    R.sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0) || b.d / b.t - a.d / a.t || a.t - b.t);
    const show = st.regAll ? R : R.slice(0, 6);
    const here = s.sub && E.SUBS[s.sub] ? E.SUBS[s.sub].zone : null;
    return `<div class="co-reg">${show.map((r) => { const nm = E.zoneLabel(r.z);
      const line = r.ok ? `+${E.COLL_REGION} % de butin et de kamas en chasse dans la région${here === r.z ? " · actif ici" : ""}` : r.t - r.d === 1 ? `il manque la ${SETS[r.miss[0]].name.replace(/^Panoplie /, "panoplie ")}` : `+${E.COLL_REGION} % de butin et de kamas une fois complète`;
      return `<div class="${r.ok ? "ok" : ""}"><b>${h(nm)} <span class="num">${r.d} / ${r.t}</span>${r.ok ? " ✓" : ""}</b><span class="xs ${r.ok ? "" : "muted"}">${h(line)}</span></div>`; }).join("")}</div>
      ${R.length > 6 ? `<button class="btn sm" data-act="co-regall">${st.regAll ? "Moins de régions" : `Voir les ${R.length} régions`}</button>` : ""}`;
  }
  function collPanel(s) {
    const C = E.collState(s); const tot = E.collTotal(); const nx = E.collNext(s);
    return `<section class="panel co-coll"><div class="phead"><h2>Collection de panoplies ${window.GUIDE ? GUIDE.q("enc#collection-de-panoplies") : ""}</h2><b class="num">${C.n} / ${tot}</b></div><div class="pad stack">
      <div class="co-gbar"><i style="width:${Math.max(1, Math.round(C.n / tot * 100))}%"></i><b>${C.n} panoplie${C.n > 1 ? "s" : ""} complète${C.n > 1 ? "s" : ""}${nx ? ` · prochain palier : ${nx.n}` : " · tous les paliers"}</b></div>
      ${tiersHtml(s, C.n)}
      <b class="small">Régions complètes <span class="xs muted">· bonus unique dans la région</span></b>
      ${regionsHtml(s, C)}
      <span class="xs muted">Chaque palier donne une récompense permanente pour le compte. Une panoplie compte dès que chacune de ses pièces a été obtenue une fois : la collection ne baisse jamais. Les bonus restent dans les plafonds habituels.</span></div></section>`;
  }
  /* « Y aller » pour la première pièce qui manque : chasse, donjon ou métier */
  function setGo(s, sid) {
    const miss = E.collMissing(s, sid); if (!miss.length) return "";
    for (const t of miss) { for (const x of E.itemSources(t)) {
      if (x.k !== "craft" && x.subs && x.subs[0]) return `<button class="btn sm" data-act="searchzone" data-id="${h(x.subs[0])}" title="${h(`${ITEMS[t].name} : ${MONSTERS[x.mon] ? MONSTERS[x.mon].name : ""}`)}">${IC("carte")} Y aller</button>`;
      if (x.k !== "craft" && x.dgs && x.dgs[0]) return `<button class="btn sm" data-act="dgopen" data-id="${h(x.dgs[0])}" title="${h(`${ITEMS[t].name} : ${DUNGEONS[x.dgs[0]].name}`)}">${IC("carte")} Y aller</button>`; } }
    return `<button class="btn sm" data-act="nav" data-v="metiers">${IC("metiers")} Métiers</button>`;
  }
  function setCard(s, sid, c, owned, dex) {
    const P = E.setPieces(sid); const got = P.filter((t) => dex[t]).length; const inBag = P.filter((t) => owned[t]).length; const done = got === P.length;
    const worn = E.setCounts(s, c)[sid] || 0; const miss = P.filter((t) => !dex[t]); const craftMiss = P.filter((t) => ITEMS[t].craft && !owned[t]);
    const fine = E.setCountFx(s, sid, worn) !== worn;
    const pcs = P.map((t) => { const T = ITEMS[t]; const cls = !dex[t] ? "no" : owned[t] ? "" : "out";
      return `<span class="${cls}" data-tip="${h(`${T.name} · niv. ${T.lvl}${!dex[t] ? " · jamais obtenue" : owned[t] ? (owned[t] > 1 ? ` · ×${owned[t]} dans le sac` : " · dans le sac") : " · plus dans le sac"}`)}">${im(itemImg(t), "", T.name)}</span>`; }).join("");
    const reg = E.setRegion(sid);
    const lvlOk = P.some((t) => owned[t] && ITEMS[t].lvl <= c.lvl);
    return `<div class="co-set ${done ? "done" : ""}"><div class="hd"><b>${h(SETS[sid].name)}</b><span class="xs muted">niv. ${E.setLvl(sid)}${reg ? ` · ${h(E.zoneLabel(reg))}` : ""}</span><span class="tag ${done ? "good" : "soft"}">${got} / ${P.length}</span></div>
      <div class="pcs">${pcs}</div>
      <div class="bon">${done ? "Panoplie complète : comptée dans ta collection" : `Il manque ${miss.length} pièce${miss.length > 1 ? "s" : ""} : ${h(miss.map((t) => ITEMS[t].name).join(", "))}`}${worn ? ` · ${worn} portée${worn > 1 ? "s" : ""} par ${h(c.name)}${fine ? " (Couture fine : bonus complet)" : ""}` : ""}</div>
      <div class="row co-acts">${inBag ? `<button class="btn sm ${done ? "primary" : ""}" data-act="co-seteq" data-v="${h(sid)}" data-cid="${c.id}" ${lvlOk ? "" : "disabled"} title="${h(lvlOk ? `Met les pièces du sac sur ${c.name}` : `Niveau trop bas pour ${c.name}`)}">Équiper sur ${h(c.name)}</button>` : ""}${!done && craftMiss.length ? `<button class="btn sm" data-act="setshop" data-id="${h(sid)}" title="Ajoute les pièces fabricables qui manquent à la liste de courses">${X().G("cart")} Pièces manquantes</button>` : ""}${!done ? setGo(s, sid) : ""}<button class="btn sm co-more" data-act="co-setinfo" data-v="${h(sid)}">Bonus</button></div></div>`;
  }
  function setsHtml() {
    const s = S(); const C = E.collState(s); const c = scHero(s); const owned = E.ownedTpls(s); const dex = E.itemDex(s);
    let ids = E.collSets().slice();
    const q = norm(st.sq).trim();
    if (q) ids = ids.filter((sid) => norm(SETS[sid].name).includes(q) || E.setPieces(sid).some((t) => norm(ITEMS[t].name).includes(q)) || norm(E.zoneLabel(E.setRegion(sid))).includes(q));
    if (st.scid) { const main = CLASSES[c.cls].main; ids = ids.filter((sid) => { const L = E.setLvl(sid); if (L > c.lvl || L < c.lvl - 40) return false;
      const ks = new Set(E.setPieces(sid).flatMap((t) => Object.keys(ITEMS[t].stats))); return ks.has(main) || !["fo", "ine", "cha", "age"].some((k) => ks.has(k)); }); }
    const missN = (sid) => E.setPieces(sid).filter((t) => !dex[t]).length;
    const nDone = ids.filter((sid) => C.done.has(sid)).length, nOne = ids.filter((sid) => missN(sid) === 1).length, nRun = ids.filter((sid) => !C.done.has(sid) && missN(sid) < E.setPieces(sid).length).length;
    if (st.sf === "done") ids = ids.filter((sid) => C.done.has(sid)); else if (st.sf === "one") ids = ids.filter((sid) => missN(sid) === 1); else if (st.sf === "run") ids = ids.filter((sid) => !C.done.has(sid) && missN(sid) < E.setPieces(sid).length);
    const worn = E.setCounts(s, c); const have = (sid) => E.setPieces(sid).filter((t) => dex[t]).length / E.setPieces(sid).length;
    ids.sort((a, b) => (worn[b] || 0) - (worn[a] || 0) || (missN(a) === 1 ? 0 : 1) - (missN(b) === 1 ? 0 : 1) || have(b) - have(a) || E.setLvl(b) - E.setLvl(a) || a.localeCompare(b));
    const total = ids.length; const shown = ids.slice(0, st.sn);
    const chips = [["all", "Toutes", null], ["done", "Complètes", nDone], ["one", "Il manque 1 pièce", nOne], ["run", "Commencées", nRun]];
    return `<div class="stack co-sets-page" style="margin-top:10px">${collPanel(s)}
      <div class="co-tb"><input type="search" id="coSQ" data-co="sq" placeholder="Rechercher une panoplie ou une pièce…" value="${h(st.sq)}" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <span class="co-chips">${chips.map(([k, nm, n]) => `<button class="co-chip" data-act="co-sf" data-v="${k}" aria-pressed="${st.sf === k}">${nm}${n != null ? ` <span class="n">${n}</span>` : ""}</button>`).join("")}</span>
        <select data-co="scid" aria-label="Héros"><option value="" ${st.scid ? "" : "selected"}>Toutes, équiper sur ${h(c.name)}</option>${heroesOf(s).map((x) => `<option value="${x.id}" ${String(st.scid) === String(x.id) ? "selected" : ""}>Adaptées à ${h(x.name)} (${h(CLASSES[x.cls].name)} ${x.lvl})</option>`).join("")}</select>
        <span class="xs muted num">${total} panoplie${total > 1 ? "s" : ""}</span></div>
      <div class="co-sets">${shown.map((sid) => setCard(s, sid, c, owned, dex)).join("") || `<div class="empty">Aucune panoplie ici.</div>`}</div>
      ${total > shown.length ? `<div style="text-align:center"><button class="btn sm" data-act="co-smore">Voir ${Math.min(30, total - shown.length)} de plus (${total - shown.length} restantes)</button></div>` : ""}</div>`;
  }
  function setInfoSheet(sid) {
    const s = S(); const c = scHero(s); const worn = E.setCounts(s, c)[sid] || 0; const dex = E.itemDex(s); const owned = E.ownedTpls(s);
    const rows = E.setPieces(sid).map((t) => { const T = ITEMS[t]; const src = E.itemSources(t).slice(0, 2).map((x) => x.k === "craft" ? `Recette niv. ${x.lvl}` : `${x.k === "boss" ? "Boss" : "Butin"} : ${MONSTERS[x.mon] ? MONSTERS[x.mon].name : "?"}`).join(" · ");
      return `<div class="li"><span class="icobox">${im(itemImg(t), "", T.name)}</span><span class="grow"><b>${h(T.name)}</b> <span class="xs muted">niv. ${T.lvl}</span><br><span class="xs ${owned[t] ? "plus" : "muted"}">${owned[t] ? "✓ dans le sac" : dex[t] ? "obtenue, plus dans le sac" : h(src || "source inconnue")}</span></span></div>`; }).join("");
    X().openSheet(`<div class="co-sheet"><h2>${h(SETS[sid].name)}</h2><div class="list">${rows}</div>${X().setBlock ? X().setBlock(sid, worn) : ""}<div class="row" style="margin-top:10px"><button class="btn" data-act="closesheet">Fermer</button></div></div>`);
  }

  /* ======================= QUÊTES › DOFUS › POTENTIEL (42A) ======================= */
  const stars = (r) => `<span class="co-stars">${Array.from({ length: E.DPOT_MAX }, (_, i) => (i < r ? "<i>★</i>" : "☆")).join("")}</span>`;
  const rankTxt = (r) => (r >= E.DPOT_MAX ? "Sublimé" : `Potentiel ${r ? roman(r) : "0"}`);
  function potBtn(s) {
    const n = E.DOFUS_ORDER.filter((id) => E.dofusOwned(s, id)).length;
    return `<button class="co-potbtn" data-act="co-dview" aria-pressed="${st.pot}">✦ Potentiel <b class="num">${n}</b></button>`;
  }
  function statLines(id, r) {
    const Df = E.DOFUS[id]; const T = ITEMS[Df.tpl]; const add = E.dpotStatsOf(id, r);
    return Object.keys(T.stats).map((k) => { const v = T.stats[k][1]; const fixed = E.DPOT_FIX.includes(k);
      return `<span>${h(statName(k))}</span>${fixed ? `<span class="xs muted">ne monte pas</span><b>+${fmt(v)}</b>` : `<span class="o">${r ? `+${fmt(v)}${PCT.includes(k) ? " %" : ""}` : ""}</span><b class="${r ? "n" : ""}">+${fmt(v + (add[k] || 0))}${PCT.includes(k) ? " %" : ""}</b>`}`; }).join("");
  }
  function potFiche(s, id) {
    const Df = E.DOFUS[id]; const I = E.dpotInfo(s, id); const r = I.r; const by = E.dofusWornBy(s, id);
    const base = E.dofpVal(id, false, false, 0), now = E.dofpVal(id, false, false, r);
    const fixed = base === now && r > 0;
    const pas = E.DOFP_LIST && E.DOFP_LIST[id] ? `<span>Passif « ${h(E.dofpName(id))} »</span>${fixed || ["vulbis", "argente", "ocre"].includes(id) ? `<span class="xs muted">tout ou rien</span><b>=</b>` : `<span class="o">${r ? `${String(base).replace(".", ",")} %` : ""}</span><b class="${r ? "n" : ""}">${String(now).replace(".", ",")} %</b>`}` : "";
    const nx = I.next; const kOk = I.kamasOk, eOk = I.eclOk;
    const up = I.max ? "" : `<button class="btn ${I.ready ? "primary" : ""}" data-act="co-dup" data-v="${id}" ${I.ready ? "" : "disabled"}>Monter au rang ${roman(nx)} · ${I.cost >= 1e6 ? `${(I.cost / 1e6).toLocaleString("fr-FR")} M` : fmt(I.cost)} kamas</button>
      <span class="xs ${I.ready ? "plus" : "muted"}">${I.ready ? `+${E.dpotPct(nx)} % au rang ${roman(nx)}` : !eOk ? `il manque ${fmt(I.need - I.e)} éclats` : `il manque ${fmt(I.cost - s.kamas)} kamas`}</span>`;
    const cfm = st.cfm === id && I.canCopy; // une copie de Dofus est précieuse : deux clics pour la fondre
    const cp = I.max ? "" : `<button class="btn sm ${cfm ? "primary" : ""}" data-act="co-dcopy" data-v="${id}" ${I.canCopy ? "" : "disabled"} title="${h(I.canCopy ? "Fond une copie libre du sac dans le Potentiel" : "Il faut une autre copie de ce Dofus dans le sac, ni portée, ni dans une tenue, ni verrouillée")}">${cfm ? "Confirmer : la copie disparaît" : "Fondre une copie"} · +${fmt(E.dpotNeed(nx))} éclats</button>`;
    return `<section class="panel co-dfiche ${I.max ? "sub" : ""}"><div class="pad co-dd">
      <div class="big">${im(X().dofusImg(id), "", Df.name)}<div class="stack" style="gap:3px;min-width:0"><b class="co-dn">${h(Df.name)}</b><span class="co-rk">${rankTxt(r)}</span>${stars(r)}${by ? `<span class="xs muted">porté par ${h(by.name)}</span>` : `<span class="xs muted">dans le sac</span>`}</div></div>
      ${I.max ? `<div class="co-subl"><b>Dofus Sublimé</b> : +50 % aux caractéristiques et au passif, aura dorée en combat.</div>` : `<div class="stack" style="gap:4px"><div class="small"><b>Éclat : ${fmt(I.e)} / ${fmt(I.need)}</b> <span class="xs muted">avant le rang ${roman(nx)}</span></div><div class="co-mini big"><i style="width:${I.pct}%"></i></div></div>`}
      <div class="co-ln">${statLines(id, r)}${pas}</div>
      <div class="xs muted">+${E.DPOT_PCT} % aux caractéristiques et au passif par rang. PA, PM, Portée et Invocations ne montent pas.</div>
      ${I.max ? "" : `<div class="row co-acts">${up}</div><div class="row co-acts">${cp}<span class="xs muted">${I.copies ? `${I.copies} copie${I.copies > 1 ? "s" : ""} libre${I.copies > 1 ? "s" : ""} dans le sac` : "aucune copie libre"}</span></div>`}
      <div class="co-src"><div>${IC("combat")}<span>Chaque donjon terminé par le héros qui le porte</span><b class="xs">+${E.DPOT_ECL} éclats par stasis</b></div><div>${im(X().dofusImg(id), "", "")}<span>Une copie du même Dofus</span><b class="xs">+1 rang</b></div><div>${IC("kamas")}<span>Chaque rang coûte des kamas</span><b class="xs">rang² × 2 M</b></div></div>
      ${I.max ? "" : `<div class="co-subl"><b>Rang X : Dofus Sublimé</b><br>+50 %, aura dorée en combat, cadre doré, et une annonce à tout le serveur. Environ 3 mois de jeu régulier en stasis 7 (rang V vers 1 mois), un peu plus vite en stasis 10 ou avec des copies.</div>`}
    </div></section>`;
  }
  const potLink = (s, id) => `<button class="btn sm co-plink" data-act="co-dsel" data-v="${h(id)}">✦ ${rankTxt(E.dpotRank(s, id))} · voir le Potentiel</button>`;
  function potHtml(s, ids) {
    const own = (ids || E.DOFUS_ORDER).filter((id) => E.dofusOwned(s, id));
    const note = `<p class="note">Chaque Dofus a un Potentiel de 0 à X. Il monte en jouant avec, sans toucher aux chances d'obtenir un Dofus.</p>`;
    if (!own.length) return `<div class="stack">${note}<div class="empty">Aucun Dofus pour l'instant : le Potentiel s'ouvre avec le premier.</div></div>`;
    own.sort((a, b) => E.dpotRank(s, b) - E.dpotRank(s, a) || E.DOFUS[a].lvl - E.DOFUS[b].lvl);
    if (!st.dsel || !own.includes(st.dsel)) st.dsel = own[0];
    const tiles = own.map((id) => { const I = E.dpotInfo(s, id); const Df = E.DOFUS[id];
      return `<button class="co-dt ${id === st.dsel ? "sel" : ""} ${I.max ? "sub" : ""} ${I.ready ? "ready" : ""}" data-act="co-dsel" data-v="${id}" aria-pressed="${id === st.dsel}">${im(X().dofusImg(id), "", Df.name)}<b>${h(Df.name.replace(/^Dofus (des |du )?/, ""))}</b>${stars(I.r)}<span class="xs ${I.max ? "co-gold" : "muted"}">${rankTxt(I.r)}</span>${I.max ? "" : `<div class="co-mini"><i style="width:${I.pct}%"></i></div>`}</button>`; }).join("");
    return `<div class="stack">${note}<div class="co-pot"><div class="co-dg">${tiles}</div>${potFiche(s, st.dsel)}</div></div>`;
  }

  /* ======================= fêtes, aura, annonces ======================= */
  function cele(ev) {
    if (ev.t === "dsub" || ev.t === "dpot") { const Df = E.DOFUS[ev.id]; if (!Df) return "";
      return `<div class="cele-art pet">${im(X().dofusImg(ev.id), "celepet" + (ev.t === "dsub" ? " co-sublpic" : ""), Df.name)}</div><div class="cele-k">${IC("dofus")} ${ev.t === "dsub" ? "Dofus Sublimé" : `Potentiel ${roman(ev.r)}`}</div><div class="cele-t">${h(Df.name)}</div><div class="cele-s">${ev.t === "dsub" ? "Potentiel X : +50 % aux caractéristiques et au passif, aura dorée en combat. Tout le serveur l'apprend dans le chat." : `+${E.dpotPct(ev.r)} % aux caractéristiques et au passif (PA, PM, Portée et Invocations à part).`}</div>`; }
    if (ev.t === "coll") { const T = E.COLL_TIERS.find((x) => x.n === ev.n); if (!T) return "";
      return `<div class="cele-art pet">${IC("couronne", "celepet")}</div><div class="cele-k">${IC("couronne")} Collection de panoplies · palier ${T.n}</div><div class="cele-t">${h(T.name || T.txt)}</div><div class="cele-s">${h(T.txt)}${T.u ? " · bonus unique" : ""}</div>`; }
    return "";
  }
  /* aura dorée en combat : Dofus Sublimé porté (e.dpSub) ; Grand Couturier (palier 150) sur toute l'équipe */
  function auraCls(e) {
    if (!e || e.summon) return "";
    let c = e.dpSub ? " co-dsub" : "";
    try { if (e.side === "c" && E.collHas(S(), "aura")) c += " co-gold"; } catch (x) { /* partie pas encore chargée */ }
    return c;
  }
  /* 1.1 : pastille du familier à côté de son héros en combat ; elle s'anime quand l'aptitude se déclenche */
  function petBadge(e) {
    if (!e || !e.pet || e.summon || e.side !== "c") return "";
    return `<span class="petb ${e.pet.gold ? "gold" : ""} ${e.pet.aura ? "aura" : ""} ${e.pet.apts.length ? "" : "young"}" data-tip="${h(`${e.pet.name}${e.pet.apts.length ? " · " + e.pet.apn : " · aptitude au niveau 100"}`)}"><img src="assets/p/${e.pet.icon}.webp" alt="" loading="lazy"></span>`;
  }
  function petPulse(n) { const b = n && n.querySelector(".petb"); if (!b) return; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go"); }
  /* 1.1 : Ménagerie du Havre-Sac (album 75) : les familiers se promènent */
  function menagerieHtml() {
    const s = S(); const n = E.petAlbum(s);
    if (n < 75) return `<p class="note">La Ménagerie s'ouvre au palier 75 de l'Album de la ménagerie (tu en as ${n}). Tes familiers viendront s'y promener.</p><button class="btn sm" data-act="nav" data-v="pets">Voir l'album</button>`;
    const L = Object.values(s.pets).filter((P) => E.PETS[P.id]).sort((a, b) => (b.st || 0) - (a.st || 0) || b.g - a.g).slice(0, 24);
    const pens = E.petPensioner(s);
    return `<div class="co-men" aria-label="Ménagerie">${L.map((P, i) => { const p = E.PETS[P.id]; const w = E.petOwner(s, P.uid);
      return `<span class="co-menp ${p.gold || (P.skin && E.PETS[P.skin] && E.PETS[P.skin].gold) ? "gold" : ""}" style="--x:${(i % 6) * 14 + 2 + ((i * 7) % 4)}%;--y:${Math.floor(i / 6) * 21 + 4 + ((i * 11) % 7)}%;--d:${6 + (i % 5) * 1.3}s;--dl:-${(i * 0.7) % 5}s" title="${h(`${p.name} · niveau ${E.petLvl(P)}${P.st ? " ★" + P.st : ""}${w ? " · avec " + w.name : ""}`)}"><img src="assets/p/${E.petIcon(P)}.webp" alt="${h(p.name)}" loading="lazy"></span>`; }).join("")}</div>
      <p class="xs muted" style="margin:6px 0 0">${L.length} familier${L.length > 1 ? "s" : ""} se promènent${pens ? ` · en pension : ${h(E.PETS[pens.id].name)} (niveau ${E.petLvl(pens)})` : ""}.</p>`;
  }
  if (window.VERIFY && window.VERIFY.summary && !window.VERIFY.summary.dsub) {
    const sum0 = window.VERIFY.summary;
    window.VERIFY.summary = (E0, S0) => { const r = sum0(E0, S0); try { const L = E.dpotSublimes(S0); if (L.length && r) r.dsub = L; } catch (x) { /* résumé sans Potentiel */ } return r; };
    window.VERIFY.summary.dsub = 1;
  }

  /* ======================= actions ======================= */
  function paintSheet() { if ($("#sheet .co-sheet") && st.sel[st.pk] && UI().tab === "pets") petSheet(); }
  function act(a, t) {
    const d = t.dataset; const s = S(); if (!s) return;
    switch (a) {
      case "co-ptab": st.pk = d.v; st.bon = "all"; break;
      case "co-pf": st.f = d.v; break;
      case "co-psel": st.sel[st.pk] = d.v; if (phone()) { petSheet(); return; } break;
      case "co-peq": {
        const cid = +d.cid; const c = s.chars.find((x) => x.id === cid); let r = null, nm = "";
        if (st.pk === "mt") { const [sp, col] = String(d.v).split(":"); const L = Object.values(s.mounts || {}).filter((M) => M.sp === sp && M.c === col).sort((a1, b1) => (E.mountOwner(s, a1.uid) ? 1 : 0) - (E.mountOwner(s, b1.uid) ? 1 : 0) || b1.lvl - a1.lvl);
          if (!L.length) return; nm = E.mountName(L[0]); r = E.act(s, "equipMount", cid, L[0].uid); }
        else { const P = E.petOwned(s, d.v); if (!P) return; nm = E.PETS[P.id].name; r = E.act(s, "equipPet", cid, P.uid); }
        if (r) { X().toast(r, "warn"); return; }
        X().markDirty(); X().toast(`${nm} : ${st.pk === "mt" ? "montée" : "équipé"} sur ${c ? c.name : "le héros"}.`);
        X().render(); paintSheet(); return; }
      case "co-mfree": { const M = s.mounts[+d.uid]; if (!M) return; // 1.0.32 : relâcher une monture
        if (!confirm(`Relâcher ${E.mountName(M)} (niveau ${M.lvl}) ? Elle disparaît pour toujours et libère une place à l'écurie.`)) return;
        const r = E.act(s, "releaseMount", M.uid); if (r) { X().toast(r, "warn"); return; }
        X().markDirty(); X().toast(`${E.mountName(M)} est relâché${M.sp === "dd" ? "e" : ""}.`); X().render(); paintSheet(); return; }
      case "co-ptreat": case "co-pawake": case "co-ppension": { // 1.1 : friandise, Éveil, Pension
        const uid = +d.uid; const P = s.pets[uid]; const nm = P ? E.PETS[P.id].name : "";
        const r = a === "co-ptreat" ? E.act(s, "petTreat", uid) : a === "co-pawake" ? E.act(s, "petAwaken", uid) : E.act(s, "setPension", uid || null);
        if (r) { X().toast(r, "warn"); return; }
        X().markDirty(); X().toast(a === "co-ptreat" ? `${nm} : +1 niveau (niveau ${E.petLvl(P)}).` : a === "co-pawake" ? `${nm} s'éveille : ★${P.st} !` : uid ? `${nm} est en pension : il grandit à moitié vitesse.` : "Pension libérée.");
        X().render(); paintSheet(); return; }
      case "co-regall": st.regAll = !st.regAll; break;
      case "co-sf": st.sf = d.v; st.sn = 30; break;
      case "co-smore": st.sn += 30; break;
      case "co-setinfo": setInfoSheet(d.v); return;
      case "co-seteq": {
        const r = E.act(s, "equipSet", +d.cid, d.v); if (typeof r === "string") { X().toast(r, "warn"); return; }
        const c = s.chars.find((x) => x.id === +d.cid);
        X().markDirty(); X().toast(`${SETS[d.v].name} : ${r.n} pièce${r.n > 1 ? "s" : ""} sur ${c ? c.name : "le héros"}${r.miss ? `, ${r.miss} à trouver` : ""}${r.lvl ? `, ${r.lvl} de niveau trop élevé` : ""}.`);
        break; }
      case "co-dview": st.pot = !st.pot; break;
      case "co-dsel": st.dsel = d.v; st.cfm = null; st.pot = true; { X().render(); const f = document.querySelector(".co-dfiche"); if (f && phone()) f.scrollIntoView({ block: "start" }); } return;
      case "co-dup": case "co-dcopy": {
        if (a === "co-dcopy" && st.cfm !== d.v) { st.cfm = d.v; break; } st.cfm = null;
        const r = E.act(s, a === "co-dup" ? "dofPotUp" : "dofPotCopy", d.v); if (r) { X().toast(r, "warn"); return; }
        X().markDirty(); if (a === "co-dcopy") X().toast(`${E.DOFUS[d.v].name} : une copie fondue dans le Potentiel.`);
        if (X().onPush && E.dpotSub(s, d.v)) X().onPush(); // le serveur annonce le Dofus Sublimé au prochain envoi
        break; }
      default: return;
    }
    X().render();
  }
  /* recherche et listes déroulantes (hors du gestionnaire de clics de ui.js) */
  let qT = null;
  document.addEventListener("input", (ev) => { const t = ev.target; if (!t || !t.dataset || !t.dataset.co) return;
    if (t.dataset.co === "q") st.q = t.value; else if (t.dataset.co === "sq") { st.sq = t.value; st.sn = 30; } else return;
    clearTimeout(qT); qT = setTimeout(() => { const m = $("#main"); if (!m) return; if (UI().tab === "pets") renderPets(m, true); else if ($("#main .co-sets-page")) X().render(); }, 160); }); // le champ garde le focus (repaintKeep)
  document.addEventListener("change", (ev) => { const t = ev.target; if (!t || !t.dataset || !t.dataset.co) return;
    const k = t.dataset.co; if (k === "skin") { const r = E.act(S(), "setPetSkin", +t.dataset.uid, t.value || null); if (r) X().toast(r, "warn"); else X().markDirty(); X().render(); paintSheet(); return; } // 1.1 : Mue
    if (k === "bon") st.bon = t.value; else if (k === "sort") st.sort = t.value; else if (k === "scid") { st.scid = t.value; st.sn = 30; } else return;
    X().render(); });
  /* un filtre de la page Dofus (Tous, En cours…) ramène à la liste des quêtes */
  document.addEventListener("click", (ev) => { const t = ev.target.closest && ev.target.closest('[data-act="qj-dfil"],[data-act="qj-dof"]'); if (t) st.pot = false;
    const g = ev.target.closest && ev.target.closest('.co-sheet [data-act="hvroomgo"]'); if (g) X().closeSheet(); }, true); // « Y aller » vers l'enclos depuis la fenêtre du téléphone

  window.COLL = {
    render: renderPets, act, setsHtml, potBtn, potHtml, potLink, potOn: () => st.pot, cele, auraCls, petBadge, petPulse, menagerieHtml,
    pickDofus: (id) => { if (id) st.dsel = id; st.pot = true; },
    potSet: (v) => { st.pot = !!v; }, // 1.0.33 : onglets de la page Dofus (js/dofusui.js)
    setQuery: (q) => { st.sq = q || ""; st.sf = "all"; st.sn = 30; },
    /* recherche du jeu : un familier ou une monture ouvre sa fiche dans la page */
    pick: (k, id) => { const s = S(); st.q = ""; st.f = "all"; st.bon = "all";
      if (k === "pet" && E.PETS[id]) { st.pk = E.PETS[id].kind === "monti" ? "monti" : "fam"; st.sel[st.pk] = id; }
      else if (k === "mount" && E.MOUNTS[id]) { st.pk = "mt"; const own = s ? Object.values(s.mounts || {}).filter((M) => M.sp === id).sort((a, b) => b.lvl - a.lvl)[0] : null; st.sel.mt = id + ":" + (own ? own.c : Object.keys(E.MOUNTS[id].cols)[0]); } },
  };
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "pets")) E.SEARCH_PAGES.push(["pets", "Familiers et montures", "Héros › Familiers et montures : collection, recherche, Équiper sur"], ["sets", "Collection de panoplies", "Journal › Encyclopédie › Panoplies : paliers et régions"], ["dpot", "Potentiel des Dofus", "Héros › Dofus › Potentiel : rangs, éclat, Sublimé"]);
})();
