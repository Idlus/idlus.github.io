/* ============================================================================
   L'ASCENSION — interface (1.1). La logique est dans js/ascension.js.
   Page Défis › L'Ascension : Volonté et Fioles, nouvelle montée (3 classes, mode Normal / Difficile / Au-delà),
   les choix en attente (3 sorts de départ, palier, âme, glyphe, événement, marchand, autel), la tour autour de
   l'étage en cours, le combat joué sous les yeux (rayures = PV retirés aux essais précédents), la montée (sorts,
   Sursis, recrues, échos), puis Progression (Fragments), Boutique des Écus, Bestiaire, Classements, Historique.
   Quand la page est ouverte, c'est elle qui joue les combats (E.ASC_LIVE) ; sinon la montée avance dans E.tick.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.ascState || !window.DX) return;
  const A = E.ASC;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const ON = window.ONLINE;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const CL = () => D.CLASSES;
  const st = { mode: "n", tab: "prog", sel: [], rep: -1, live: null, wait: 0, msg: null, key: "", rk: { cat: "classe", k: null, rows: null, at: 0, err: false } };
  const plural = (n, w) => `${fmt(n)} ${w}${n > 1 ? "s" : ""}`;
  const minTxt = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
  const KIND = { dmg: "Dégâts", aoe: "Zone", drain: "Vol de vie", heal: "Soin", buff: "Bonus", shield: "Bouclier", summon: "Invocation", dot: "Poison", ctrl: "Contrôle" };
  const RAR_CLS = { c: "", r: "rar-r", e: "rar-e", l: "rar-l" };

  /* ---------- petits morceaux ---------- */
  const sym = (cls) => `<span class="as-sym" style="--cc:${(CL()[cls] || {}).color || "#888"}"><img src="${X().symImg(cls)}" alt=""></span>`;
  const look = (cls) => { const c = S().chars[0] || {}; return `<img class="as-look" src="${X().lookLocal(cls, c.sex, 0)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`; };
  const spIco = (x) => (x ? X().spIcon({ name: x.name, el: x.el || (x.kind === "heal" ? "buff" : "n") }) : "");
  const spLine = (x) => { const d = x && E.ascDef({ k: x.k, lv: 1, gl: [] }); const g = d && d.grades[0]; if (!g) return "";
    const f = g.fx.find((y) => y.min !== undefined); return `${g.pa} PA${f ? ` · ${f.min}-${f.max}` : ""}${g.cd ? ` · relance ${g.cd}` : ""}`; };
  const spTip = (x) => (x ? `${x.name} (${(CL()[x.cls] || {}).name || x.cls}) : ${KIND[x.kind] || x.kind}, ${spLine(x)}` : "");
  const monImg = (key) => (D.MONSTERS[key] ? `assets/m/${D.MONSTERS[key].img}.png` : "");
  const monName = (key) => (D.MONSTERS[key] ? D.MONSTERS[key].name : "?");
  const ruleTag = (r) => { const R = E.ASC_RULES[r]; return R ? `<span class="tag soft as-rule" data-tip="${h(R.d)}">${R.ic} ${h(R.name)}</span>` : ""; };
  const echoTxt = (cls) => (E.ASC_ECHO[cls] ? E.ASC_ECHO[cls].d : "");
  const card = (title, body, extra = "") => `<section class="panel ${extra}"><div class="phead"><h2>${title}</h2></div><div class="pad stack">${body}</div></section>`;
  const fiolesN = () => E.ascFioles(S());

  /* ---------- Volonté ---------- */
  function volHtml(s) {
    const Q = E.ascState(s); E.ascVolSync(s); const nx = E.ascVolNext(s); const f = fiolesN(); const bl = E.ascBrewLeft(s); const R = E.ASC_BREW;
    const alch = ((s.jobs && s.jobs.alchimiste) || {}).lvl || 0;
    return `<div class="as-vol" id="asVol"><span class="as-volico">✦</span>
      <span class="grow"><b>Volonté <span class="num">${Q.vol} / ${A.volMax}</span></b><span class="bar as-volbar"><i style="width:${Math.min(100, (Q.vol / A.volMax) * 100)}%"></i></span>
      <span class="xs muted">${Q.vol >= A.volMax ? "Pleine." : `+1 dans ${minTxt(nx)}.`} Chaque essai coûte 1 ; les étages déjà réussis ce mois-ci sont gratuits.${E.ascGuild(s) ? " Bonus de guilde : +1 par heure." : ""}</span></span>
      <span class="row"><button class="btn sm" data-act="as-drink" ${f && Q.vol < A.volMax ? "" : "disabled"} data-tip="+5 Volonté, même au-delà de 30">Boire une Fiole (${f}) · +5</button>
      <button class="btn sm" data-act="as-brew" ${alch >= R.lvl && bl > 0 ? "" : "disabled"} data-tip="${h(`Alchimiste niveau ${R.lvl} : ${R.herb.map(([r, n]) => `${n} ${r}`).join(", ")} et ${fmt(R.kamas)} kamas. ${A.brewDay} par jour.`)}">Préparer (${bl}/${A.brewDay})</button></span></div>`;
  }

  /* ---------- nouvelle montée ---------- */
  function startHtml(s) {
    const Q = E.ascState(s); const cl = E.ascClassChoices(s); const xOk = !E.ascCanStart(s, "x") || (Q.best0 || 0) >= 100 || Q.best.n >= 100;
    const left = Math.ceil((E.ascMonthEnd() - E.now()) / 86400000);
    const seg = `<span class="seg" role="group" aria-label="Mode">${["n", "d", "x"].map((m) => `<button data-act="as-mode" data-v="${m}" aria-pressed="${st.mode === m}" ${m === "x" && !xOk ? "disabled data-tip=\"S'ouvre après l'étage 100 en Normal\"" : ""}>${m === "x" && !xOk ? "🔒 " : ""}${E.ASC_MODES[m]}</button>`).join("")}</span>`;
    const rec = st.mode === "x" ? `Record de la semaine : étage ${Q.best.x > 100 ? Q.best.x : "—"}` : `Record du mois : étage ${Q.best[st.mode] || 0} / 100`;
    const cards = cl.map((c) => { const C = CL()[c]; const sig = E.ascSpell(E.ascSignature(c));
      return `<div class="as-cls"><div class="row">${sym(c)}<b class="grow">${h(C.name)}</b></div>${look(c)}
        <span class="xs"><b>Écho</b> (3 sorts ${h(C.name)}) : ${h(echoTxt(c))}</span>
        ${sig ? `<span class="as-sp" data-tip="${h(spTip(sig))}">${spIco(sig)}<span class="grow"><b class="small">${h(sig.name)}</b><span class="xs muted">Sort signature, jamais remplacé</span></span></span>` : ""}
        <button class="btn primary sm" data-act="as-start" data-v="${c}">Monter avec ${/^[AEIOUÉÈ]/.test(C.name) ? "l'" : "le "}${h(C.name)}</button></div>`; }).join("");
    return card(`Nouvelle montée · ${st.mode === "x" ? "Au-delà de la semaine" : `Tour de ${E.ascMonthName(E.ascMonth())}`}`,
      `<div class="row between">${seg}<span class="row"><span class="tag soft">${st.mode === "x" ? "Remise à zéro le lundi" : `Remise à zéro dans ${plural(left, "jour")}`}</span><span class="tag">${rec}</span></span></div>
       <p class="note">Un héros neuf, niveau 1 et sans équipement. Choisis une des 3 classes tirées au sort : elle apporte son sort signature, et son écho si tu gardes 3 de ses sorts.${st.mode === "x" ? " L'Au-delà commence à l'étage 101 avec 8 tirages de sorts." : ""}</p>
       <div class="as-g3">${cards}</div>
       <div class="row between"><span class="xs muted">${st.mode === "d" ? "Difficile : ennemis plus solides. Les classements du mois se jouent ici." : st.mode === "n" ? "Normal : l'étage 100 ouvre l'Au-delà." : "Chaque étage de l'Au-delà est un peu plus dur que le précédent."}</span>
       <button class="btn sm" data-act="as-reroll" ${Q.roll.n >= 1 ? "disabled" : ""}>⟳ Relancer les classes (1 par jour)</button></div>`);
  }

  /* ---------- les choix en attente ---------- */
  function slotsPick(R, act) { // 1.1.0.1 : un glyphe se pose aussi sur le sort signature, jamais sur une âme
    return `<div class="as-slots">${R.spells.map((sp, i) => { if (act === "as-glyph" ? sp.soul : sp.sig) return ""; const x = sp.soul ? null : E.ascSpell(sp.k);
      return `<button class="as-slot ${st.rep === i ? "on" : ""}" data-act="${act}" data-i="${i}">${sp.soul ? `<img class="as-soulimg" src="${monImg(sp.k.slice(5))}" alt="">` : spIco(x)}<small>${h(sp.soul ? "Âme : " + monName(sp.k.slice(5)) : x ? x.name : "?")}</small></button>`; }).join("")}</div>`;
  }
  function pendHtml(s) {
    const Q = E.ascState(s); const R = Q.run; const P = R.pend; if (!P) return "";
    const auto = Q.auto ? `<span class="tag soft">Auto : choix fait dans ${Math.max(0, Math.ceil((P.at + 4000 - E.now()) / 1000))} s</span>` : "";
    const full = R.spells.length >= A.spellMax;
    if (P.t === "start") {
      const cards = P.opts.map((k, i) => { const x = E.ascSpell(k); const on = st.sel.includes(i);
        return `<button class="as-opt ${on ? "on" : ""}" data-act="as-sel" data-i="${i}" data-tip="${h(spTip(x))}">${spIco(x)}<span class="grow"><b>${h(x ? x.name : k)}</b><span class="xs muted">${h((CL()[x && x.cls] || {}).name || "")} · ${h(KIND[x && x.kind] || "")}</span><span class="xs">${h(spLine(x))}</span></span>${on ? "<i class=\"as-ck\">✓</i>" : ""}</button>`; }).join("");
      return card("Tes 3 sorts de départ", `<p class="note">Garde 3 sorts parmi ces 6, tirés dans les sorts de niveau 1 des classes de ta pioche.</p><div class="as-g3">${cards}</div>
        <div class="row between"><span class="tag">${st.sel.length} / ${A.keep} choisis</span>${auto}<button class="btn primary" data-act="as-go" ${st.sel.length === A.keep ? "" : "disabled"}>Entrer dans la tour</button></div>`, "as-choice");
    }
    if (P.t === "pick") {
      const cards = P.opts.map((k, i) => { if (k.startsWith("soul:")) { const b = k.slice(5); return `<button class="as-opt soul" data-act="as-pick" data-i="${i}"><img class="as-soulimg" src="${monImg(b)}" alt=""><span class="grow"><b>Âme : ${h(monName(b))}</b><span class="xs muted">Invocation 3 tours, 50 % de puissance, relance ${A.souls.cd}</span></span></button>`; }
        const x = E.ascSpell(k); const own = R.spells.find((y) => y.k === k); const rar = x ? E.ascRarity(x, E.ascLvl(R.f)) : "c";
        return `<button class="as-opt ${RAR_CLS[rar]}" data-act="as-pick" data-i="${i}" data-tip="${h(spTip(x))}">${spIco(x)}<span class="grow"><b>${h(x ? x.name : k)}</b><span class="xs muted">${h((CL()[x && x.cls] || {}).name || "")} · ${E.ASC_RAR[rar].name}</span><span class="xs">${own ? `Déjà dans ta barre : il passe niveau ${Math.min(A.spellLvMax, (own.lv || 1) + 1)}` : h(spLine(x))}</span></span></button>`; }).join("");
      return card(P.leg ? "Autel maudit : ton sort légendaire" : `Palier de l'étage ${R.f - 1} : un nouveau sort`, `<p class="note">Choisis 1 sort parmi ${P.opts.length}. Un sort que tu as déjà monte de niveau (3 au plus).${full ? " Ta barre est pleine : choisis d'abord le sort à remplacer." : ""}</p>
        ${full ? slotsPick(R, "as-rep") : ""}<div class="as-g3">${cards}</div><div class="row between">${auto}<button class="btn sm" data-act="as-pass">Passer</button></div>`, "as-choice");
    }
    if (P.t === "soul") {
      return card("Capture d'âme", `<div class="row"><img class="as-soulbig" src="${monImg(P.boss)}" alt=""><span class="grow stack" style="gap:4px"><b>Âme : ${h(monName(P.boss))}</b><span class="small">Un sort d'invocation : le boss se bat ${A.souls.turns} tours à ${Math.round(A.souls.pow * 100)} % de sa puissance, relance ${A.souls.cd}. Une âme à la fois, perdue à la fin de la montée. Le bestiaire, lui, la garde.</span></span></div>
        ${full ? `<p class="note">Ta barre est pleine : choisis le sort à remplacer.</p>${slotsPick(R, "as-rep")}` : ""}<div class="row between">${auto}<span class="row"><button class="btn sm" data-act="as-pass">Laisser l'âme</button><button class="btn primary sm" data-act="as-soul">Capturer</button></span></div>`, "as-choice");
    }
    if (P.t === "glyph") {
      const G = E.ASC_GLYPHS[P.g];
      return card(`Glyphe ${h(G.name)}`, `<p class="note">${h(G.d)}. À poser sur un sort (2 glyphes au plus par sort), perdu à la fin de la montée.</p>${slotsPick(R, "as-glyph")}<div class="row between">${auto}<button class="btn sm" data-act="as-pass">Garder pour rien</button></div>`, "as-choice");
    }
    if (P.t === "event") {
      const T = { prisoner: ["Un prisonnier", `${monName(P.mon)} est enchaîné ici. Libéré, il se bat à tes côtés.`, "Le libérer"], merc: ["Un mercenaire", `${monName(P.mon)} se bat pour toi contre ${P.price} Fragments de cette montée.`, `L'engager (${P.price} Fragments)`], tame: ["Un monstre à apprivoiser", `${monName(P.mon)} te suit si tu le nourris.`, "L'apprivoiser"] }[P.ev] || ["Événement", "", "Accepter"];
      return card(`Événement : ${T[0]}`, `<div class="row"><img class="as-soulbig" src="${monImg(P.mon)}" alt=""><span class="grow stack" style="gap:4px"><b>${h(monName(P.mon))}</b><span class="small">${h(T[1])} Une recrue se bat comme une invocation et garde ses PV d'un étage à l'autre. ${A.recruitsMax} recrues au plus, elles peuvent mourir.</span></span></div>
        <div class="row between">${auto}<span class="row"><button class="btn sm" data-act="as-ev" data-v="1">Passer</button><button class="btn primary sm" data-act="as-ev" data-v="0" ${R.recruits.length >= A.recruitsMax || (P.ev === "merc" && R.frag < P.price) ? "disabled" : ""}>${h(T[2])}</button></span></div>`, "as-choice");
    }
    if (P.t === "shop") {
      return card("Marchand", `<p class="note">Paie avec les Fragments gagnés pendant cette montée (<b>${fmt(R.frag)}</b>).</p><div class="as-g2">${E.ASC_SHOP.map((o, i) => `<div class="as-offer"><b>${h(o.name)}</b><span class="xs muted grow">${h(o.d)}</span><button class="btn sm" data-act="as-shop" data-i="${i}" ${R.frag >= o.price && !(o.id === "sursis" && R.boughtSursis) ? "" : "disabled"}>${o.price} Fragments</button></div>`).join("")}</div>
        <div class="row between">${auto}<button class="btn primary sm" data-act="as-pass">Continuer la montée</button></div>`, "as-choice");
    }
    if (P.t === "altar") {
      const x = P.leg && E.ascSpell(P.leg);
      return card("Autel maudit", `<p class="note">Un sort légendaire contre une malédiction : les ennemis ont +20 % de PV pendant 10 étages.</p>${x ? `<div class="as-opt rar-l">${spIco(x)}<span class="grow"><b>${h(x.name)}</b><span class="xs muted">${h((CL()[x.cls] || {}).name || "")} · Légendaire</span><span class="xs">${h(spLine(x))}</span></span></div>` : ""}
        <div class="row between">${auto}<span class="row"><button class="btn sm" data-act="as-altar" data-v="0">Refuser</button><button class="btn danger sm" data-act="as-altar" data-v="1">Accepter la malédiction</button></span></div>`, "as-choice");
    }
    return "";
  }

  /* ---------- la tour ---------- */
  function floorRow(s, R, f) {
    const fl = E.ascFloor(s, R.mode, f); const cur = f === R.f; const done = f < R.f; const Q = E.ascState(s);
    const wk = Q.wounds[E.ascWoundKey(R.mode, f)];
    const what = fl.t === "boss" ? `<b>Boss : ${h(monName(fl.boss))}</b><span class="tag boss">Boss</span>${!Q.bestiary[fl.boss] ? `<span class="tag soft">Âme à capturer</span>` : ""}`
      : fl.t === "event" ? `<span class="tag soft">❓ Événement</span>` : fl.t === "shop" ? `<span class="tag soft">🛒 Marchand</span>` : fl.t === "altar" ? `<span class="tag soft">🕯 Autel maudit</span>`
      : `${fl.mobs.slice(0, 3).map((k) => `<img class="as-mini" src="${monImg(k)}" alt="" data-tip="${h(monName(k))}">`).join("")}${fl.rule ? ruleTag(fl.rule) : f % 5 === 0 ? `<span class="tag">Palier : nouveau sort</span>` : ""}`;
    const wound = wk && !done ? `<span class="as-hp" data-tip="PV des ennemis gardés des essais précédents"><i style="width:${Math.round((wk.hp.reduce((a, b) => a + b, 0) / Math.max(1, wk.hp.length)) * 100)}%"></i></span>` : "";
    const cost = !done && ["fight", "boss"].includes(fl.t) ? (E.ascCost(s, R.mode, f) ? "1 ✦" : "gratuit") : done ? "✓" : "";
    return `<div class="as-fl ${cur ? "cur" : ""} ${done ? "done" : ""} ${fl.t === "boss" ? "boss" : ""}"><span class="as-n">${f}</span><span class="as-mid">${what}${wound}</span><span class="xs muted">${cost}</span></div>`;
  }
  function towerHtml(s) {
    const R = E.ascState(s).run; const lo = Math.max(R.mode === "x" ? 101 : 1, R.f - 1); const hi = R.mode === "x" ? R.f + 6 : Math.min(A.floors, R.f + 6);
    const rows = []; for (let f = hi; f >= lo; f--) rows.push(floorRow(s, R, f));
    return `<div class="as-tower">${rows.join("")}</div>`;
  }

  /* ---------- le combat ---------- */
  /* le combat en face à face (choix de Mathis) : les monstres en face, ton héros et ses alliés au premier plan,
     l'ordre de jeu en haut, les sorts en bas ; les coups partent en projectiles et les dégâts s'envolent */
  const imgOf = (e) => (e.side === "c" && !e.summon ? X().lookLocal(e.cls, (S().chars[0] || {}).sex, 0) : e.img ? `assets/m/${e.img}.png` : monImg(e.key || e.base));
  function spots(F) {
    const mob = window.innerWidth < 600; const P = [];
    const foes = [], al = []; F.ents.forEach((e, i) => (e.side === "m" ? foes : al).push(i));
    foes.sort((a, b) => !!F.ents[b].boss - !!F.ents[a].boss);
    const nf = foes.length; const two = nf > (mob ? 3 : 4);
    foes.forEach((ei, k) => { const r = two ? k % 2 : 0; const j = two ? Math.floor(k / 2) : k; const cols = two ? Math.ceil(nf / 2) : nf;
      const x0 = mob ? 18 : 50, x1 = mob ? 84 : 90; const x = cols > 1 ? x0 + (x1 - x0) * j / (cols - 1) + (r ? (mob ? 6 : 4) : 0) : (x0 + x1) / 2;
      P[ei] = { x, y: (mob ? 44 : 40) + (r ? (mob ? 13 : 16) : 0) + (two ? 0 : (j % 2) * 4), z: 10 - r, s: (F.ents[ei].boss ? 1.8 : 1.45) * (mob ? 0.8 : 1) }; });
    al.forEach((ei, k) => { const e = F.ents[ei];
      P[ei] = k === 0 && !e.summon ? { x: mob ? 22 : 14, y: mob ? 6 : 8, z: 30, s: mob ? 1.45 : 1.6 } : { x: (mob ? 46 : 28) + (k - 1) * (mob ? 16 : 9), y: (mob ? 10 : 14) + ((k - 1) % 2) * 6, z: 25 - k, s: 0.95 }; });
    return P;
  }
  function arenaHtml(s) {
    const W = st.live; if (!W) return "";
    const F = W.F; const brume = W.rule === "brouillard"; const aw = E.ascAwait(W); const P = spots(F);
    const cur = aw ? aw.ei : F.order && F.oi > 0 ? F.order[F.oi - 1] : -1; const tg = aw ? tgtOf(W) : -1;
    const ent = (e, i) => { const pc = e.hpMax ? Math.max(0, e.hp / e.hpMax) : 0; const st0 = W.start ? W.start[i] : 1; const p = P[i] || { x: 50, y: 30, z: 1, s: 1 };
      const who = e.side === "c" ? (e.summon ? (e.recruit !== undefined ? h(e.name || "Recrue") : "Âme invoquée") : "Toi") : h(e.name);
      const pickable = e.side === "m" && e.alive && aw;
      const hp = e.side === "m" && brume ? `<i style="width:100%;opacity:.25"></i>` : `<i style="width:${Math.round(pc * 100)}%"></i>${e.side === "m" && st0 < 1 ? `<s style="left:${Math.round(st0 * 100)}%;width:${Math.round((1 - st0) * 100)}%"></s>` : ""}`;
      return `<div class="as-u ${e.side === "c" ? "al" : "fo"} ${e.alive ? "" : "ko"} ${e.boss ? "boss" : ""} ${e.side === "c" && e.summon && e.recruit === undefined ? "soul" : ""} ${pickable ? "pick" : ""} ${i === tg ? "aimed" : ""} ${i === cur && !F.over ? "cur" : ""}" data-u="${i}" style="left:${p.x}%;bottom:${p.y}%;z-index:${p.z};--s:${p.s}" ${pickable ? `data-act="as-tgt" data-i="${i}" role="button" aria-label="Viser ${h(e.name)}"` : ""}>
        <div class="as-uh"><b>${who}</b><span class="as-hp ${e.side === "c" ? "ally" : ""}">${hp}</span>${e.side === "m" && !brume ? `<small>${fmt(Math.max(0, Math.round(e.hp)))}</small>` : ""}</div>
        <span class="as-ring"></span><img src="${imgOf(e)}" alt="" onerror="this.style.visibility='hidden'">${i === tg ? `<span class="as-aim">🎯</span>` : ""}</div>`; };
    const order = (F.order || []).slice(Math.max(0, F.oi - 1)).concat(F.order || []).filter((i) => F.ents[i] && F.ents[i].alive).slice(0, 8);
    const ord = order.map((i, k) => `<span class="as-oi ${F.ents[i].side === "c" ? "al" : "fo"} ${k === 0 && i === cur ? "now" : ""}"><img src="${imgOf(F.ents[i])}" alt=""></span>`).join("");
    const log = (F.log || []).slice(-3).map((l) => `<span>${h(l.txt)}</span>`).join("");
    const dec = E.ascDecor(S(), W.mode, W.f); const dg = dec && D.DUNGEONS[dec];
    return `<div class="as-stage ${aw ? "mine" : ""} ${dec ? "deco" : ""}">${dec ? `<div class="as-bg" style="background-image:url(assets/asc/${dec}.webp)" title="${h(dg.name)}"></div><div class="as-motes">${Array.from({ length: 9 }, (_, k) => `<i style="--i:${k}"></i>`).join("")}</div><div class="as-veil"></div>` : ""}
        <div class="as-top"><span class="as-fln">${h(F.label || "")}</span><span class="as-ord">${ord}</span><span class="row">${W.rule ? ruleTag(W.rule) : ""}<span class="tag soft">Tour ${F.round}</span></span></div>
        ${F.ents.map(ent).join("")}<div class="as-fxl"></div>${aw && st.turnK !== (st.turnK = F.id + ":" + F.round + ":" + aw.ei) ? `<div class="as-turn">À toi de jouer</div>` : ""}</div>${barHtml(W, aw)}<div class="as-log">${log}</div>`;
  }
  /* effets : ce qui s'est passé depuis le dernier dessin (projectiles, chiffres, recul) */
  function playFx(W) {
    const F = W.F; const root = $("#asArena .as-stage"); if (!root) return;
    if (st.fxF !== F) { st.fxF = F; st.fxSeq = F.seq; return; }
    const fresh = F.fx.filter((f) => f.seq > st.fxSeq).slice(-14); st.fxSeq = F.seq; if (!fresh.length || document.visibilityState !== "visible") return;
    const L = root.querySelector(".as-fxl"); const R = root.getBoundingClientRect();
    const node = (i) => root.querySelector(`.as-u[data-u="${i}"]`);
    const mid = (n) => { const r = n.querySelector("img").getBoundingClientRect(); return { x: r.left - R.left + r.width / 2, y: r.top - R.top + r.height * 0.45 }; };
    const add = (cls, x, y, txt, col, delay) => { const d = document.createElement("span"); d.className = cls; d.style.left = x + "px"; d.style.top = y + "px"; if (col) d.style.setProperty("--c", col); if (txt) d.textContent = txt; if (delay) d.style.animationDelay = delay + "ms"; L.appendChild(d); setTimeout(() => d.remove(), 1400 + (delay || 0)); return d; };
    const casters = new Map(); fresh.forEach((f) => { if (f.k === "cast") casters.set(f.seq, f.s); });
    const shot = new Set(); let k = 0;
    fresh.forEach((f) => {
      if (f.k === "cast") { const n = node(f.s); if (n) n.classList.add("act"); return; }
      const n = node(f.t); if (!n) return; const to = mid(n); const src = f.s !== undefined && f.s >= 0 ? f.s : casters.get(f.seq);
      const col = f.k === "heal" ? "#7ee06a" : f.k === "buff" ? "var(--gold2)" : `var(--el-${f.el || "n"})`; const dl = Math.min(k++, 5) * 70;
      if (f.k === "hit" && src !== undefined && src >= 0 && !shot.has(f.seq + ":" + f.t)) { const sn = node(src); shot.add(f.seq + ":" + f.t);
        if (sn && sn !== n) { const fr = mid(sn); const o = add("as-orb", fr.x, fr.y, "", col, 0);
          o.animate([{ transform: "translate(-50%,-50%) scale(.6)" }, { transform: `translate(calc(-50% + ${to.x - fr.x}px),calc(-50% + ${to.y - fr.y}px)) scale(1.2)` }], { duration: 260, easing: "ease-in", fill: "forwards" }); setTimeout(() => o.remove(), 300); } }
      if (f.k === "hit") { setTimeout(() => { n.classList.add("hit"); add("as-boom", to.x, to.y, "", col, 0); }, 240); add("as-num", to.x, to.y - 20, "-" + fmt(f.v), col, 240 + dl); }
      else if (f.k === "heal") add("as-num", to.x, to.y - 20, "+" + fmt(f.v), col, dl);
      else if (f.k === "buff" && f.txt) add("as-num sm", to.x, to.y - 34, f.txt, col, dl);
      else if (f.k === "summon") n.classList.add("pop");
    });
  }
  /* mode manuel : la barre de sorts du héros pendant son tour */
  const OFF = ["dmg", "drain", "dot", "apdrain", "mpdrain", "push", "weaken", "vuln", "poison"];
  const offensive = (d) => { const g = d && d.grades && d.grades[0]; return !!g && g.fx.some((f) => OFF.includes(f.k)); };
  function tgtOf(W) { const F = W.F; const t = F.ents[st.tgt]; if (t && t.side === "m" && t.alive) return st.tgt;
    let bi = -1; F.ents.forEach((e, i) => { if (e.side === "m" && e.alive && (bi < 0 || e.hp < F.ents[bi].hp)) bi = i; }); return bi; }
  function barHtml(W, aw) {
    const Q = E.ascState(S()); if (Q.auto) return "";
    if (!aw) return W.S2.manualLive ? `<div class="as-bar wait"><span class="xs muted">Les ennemis jouent…</span><button class="btn sm" data-act="as-fauto">Ce combat en auto</button></div>` : `<div class="as-bar wait"><span class="xs muted">Ce combat se joue en auto.</span><button class="btn sm" data-act="as-fman">Reprendre la main</button></div>`;
    const sp = W.defs.map((d, i) => { if (!d) return ""; const g = E.spellGrade(d, E.ascLvl(W.f)); const ok = E.ascCanCast(W, i); const x = E.ascSpell(d.id);
      const f = g.fx.find((y) => y.min !== undefined);
      return `<button class="as-cast" data-act="as-cast" data-i="${i}" ${ok ? "" : "disabled"} data-tip="${h(`${d.name} : ${g.pa} PA${f ? `, ${f.min}-${f.max}` : ""}${g.cd ? `, relance ${g.cd}` : ""}${offensive(d) ? " (sur la cible choisie)" : ""}`)}">${spIco(x || d)}<small>${h(d.name)}</small><span class="as-pa">${g.pa}</span></button>`; }).join("");
    const me = W.F.ents[aw.ei]; const pa0 = Math.max(aw.pa, (me && me.st && me.st.pa) || aw.pa);
    const pips = Array.from({ length: Math.min(pa0, 14) }, (_, k) => `<i class="${k < aw.pa ? "" : "off"}"></i>`).join("");
    return `<div class="as-bar"><div class="as-pas" data-tip="Tes points d'action pour ce tour"><span class="as-pips">${pips}</span><b class="num">${aw.pa} PA</b></div><div class="as-casts">${sp}</div>
      <div class="as-endb"><button class="btn primary as-end" data-act="as-endturn">Finir le tour</button><span class="row"><button class="btn sm" data-act="as-tauto">Ce tour en auto</button><button class="btn sm" data-act="as-fauto">Ce combat en auto</button></span></div></div>`;
  }
  const arenaKey = (W) => { const A = E.ascAwait(W); return `${W.F.seq}|${W.F.round}|${A ? A.pa + ":" + A.n : "-"}|${st.tgt}|${W.S2.manualLive}`; };

  /* ---------- la montée ---------- */
  function runHtml(s) {
    const Q = E.ascState(s); const R = Q.run; const C = CL()[R.cls];
    const slots = R.spells.map((sp) => { if (sp.soul) { const b = sp.k.slice(5); return `<div class="as-sl soul" data-tip="${h(`Âme : ${monName(b)}, invocation ${A.souls.turns} tours`)}"><img src="${monImg(b)}" alt=""><small>Âme</small></div>`; }
      const x = E.ascSpell(sp.k); return `<div class="as-sl" data-tip="${h(spTip(x))}">${spIco(x)}${(sp.lv || 1) > 1 ? `<span class="as-lv">${sp.lv}</span>` : ""}<small>${h(x ? x.name : "?")}</small>${(sp.gl || []).length ? `<span class="as-gl">${sp.gl.map((g) => `<i>${h(E.ASC_GLYPHS[g].name)}</i>`).join("")}</span>` : ""}</div>`; }).join("");
    const ech = E.ascEchoes(R).map((c) => `<span class="tag soft" data-tip="${h(echoTxt(c))}">Écho ${h(CL()[c].name)}</span>`).concat(E.ascCombos(R).map((x) => `<span class="tag good">Combo : ${h(x.name)}</span>`)).join("");
    const rec = R.recruits.length ? R.recruits.map((x) => `${h(monName(x.key))} (${Math.round(x.hp * 100)} %)`).join(", ") : "aucune";
    return `<section class="panel"><div class="phead"><h2>Ta montée</h2><span class="tag">${E.ASC_MODES[R.mode]}</span></div><div class="pad stack" style="gap:10px">
      <div class="row">${sym(R.cls)}<span class="grow"><b>${h(C.name)} niveau ${E.ascLvl(R.f)}</b><br><span class="xs muted">Étage ${R.f}${R.mode !== "x" ? " / 100" : ""} · record ${Q.best[R.mode] > (R.mode === "x" ? 100 : 0) ? Q.best[R.mode] : "—"}</span></span></div>
      <div class="as-slots">${slots}</div>${ech ? `<div class="row">${ech}</div>` : ""}
      <div class="as-stat"><span class="muted">Sursis</span><b>${R.sursis} ♥</b></div>
      <div class="as-stat"><span class="muted">Recrues</span><b>${rec}</b></div>
      <div class="as-stat"><span class="muted">Fragments gagnés</span><b>${fmt(R.frag)}</b></div>
      <div class="as-stat"><span class="muted">Mode</span><span class="seg"><button data-act="as-auto" data-v="0" aria-pressed="${!Q.auto}">Manuel</button><button data-act="as-auto" data-v="1" aria-pressed="${!!Q.auto}">Auto</button></span></div>
      ${Q.auto ? `<div class="as-stat"><span class="muted">L'auto préfère</span><select data-act="as-prio" aria-label="Priorité de l'auto">${[["dmg", "les dégâts"], ["heal", "les soins"], ["ctrl", "la protection"], ["cls", "les sorts de ta classe"]].map(([k, n]) => `<option value="${k}" ${Q.prio === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>` : ""}
      <p class="xs muted">${Q.auto ? "Auto : la tour avance et choisit sans toi, mais −30 % de Fragments sur ces étages, pas d'événement risqué, et ces étages ne comptent pas pour le classement Rapidité." : "Manuel : la tour t'attend à chaque choix, et pendant les combats c'est toi qui choisis tes sorts et tes cibles."}</p>
      <div class="row between">${st.msg ? `<span class="small">${h(st.msg)}</span>` : "<span></span>"}<button class="btn sm danger" data-act="as-quit">${st.quit ? "Vraiment abandonner ?" : "Abandonner"}</button></div></div></section>`;
  }

  /* ---------- onglets du bas ---------- */
  function progHtml(s) {
    const Q = E.ascState(s); const U = E.ascUnlocks(s).filter((u) => u.kind !== "soul");
    return `<p class="note">Les Fragments restent d'une montée à l'autre. Ils agrandissent la pioche de sorts, ajoutent des classes au tirage et débloquent des bonus de départ. Tu en as <b>${fmt(Q.frag)}</b>.</p>
      <div class="as-g2">${U.slice(0, 40).map((u) => `<div class="as-offer"><b>${h(u.name)}</b><span class="xs muted grow">${h(u.d)}</span><button class="btn sm" data-act="as-unl" data-v="${h(u.id)}" ${Q.frag >= u.price ? "" : "disabled"}>${fmt(u.price)} Fragments</button></div>`).join("") || `<p class="empty">Tout est débloqué.</p>`}</div>`;
  }
  function shopHtml(s) {
    const Q = E.ascState(s); const own = s.titlesExtra || [];
    return `<p class="note">Les Écus se gagnent sur les boss et dans les coffres du mois. Ils n'achètent que des titres : rien qui rende plus fort. Tu en as <b>${fmt(Q.ecus)}</b>.</p>
      <div class="as-g2">${E.ASC_ECU_SHOP.map((o) => `<div class="as-offer"><b>Titre « ${h(o.v)} »</b><span class="grow"></span><button class="btn sm" data-act="as-buy" data-v="${o.id}" ${own.includes(o.v) || Q.ecus < o.price ? "disabled" : ""}>${own.includes(o.v) ? "Obtenu" : `${o.price} Écus`}</button></div>`).join("")}</div>
      <p class="note">Coffres du mois aux étages 25, 50, 75 et 100 (Normal et Difficile) : kamas, Poussière, Sablier, Cristal de Forgemagie. Un titre tous les 10 étages.</p>`;
  }
  function bestHtml(s) {
    const Q = E.ascState(s); const B = Object.keys(Q.bestiary); const U = E.ascUnlocks(s).filter((u) => u.kind === "soul");
    if (!B.length) return `<p class="empty">Bats un boss de la tour pour inscrire son âme au bestiaire.</p>`;
    return `<p class="note">Chaque boss vaincu entre au bestiaire. Avec ${A.soulCost} Fragments, son âme peut sortir dans les tirages de sorts.</p>
      <div class="as-g4">${B.map((b) => { const u = U.find((x) => x.id === "soul:" + b); const has = (Q.souls || []).includes(b);
        return `<div class="as-best ${has ? "on" : ""}"><img src="${monImg(b)}" alt=""><b class="xs">${h(monName(b))}</b><span class="xs muted">vaincu ${Q.bestiary[b]} fois</span>${has ? `<span class="tag good">Dans la pioche</span>` : u ? `<button class="btn sm" data-act="as-unl" data-v="${h(u.id)}" ${Q.frag >= u.price ? "" : "disabled"}>${u.price} Fragments</button>` : ""}</div>`; }).join("")}</div>`;
  }
  const RK_CATS = [["classe", "Par classe"], ["rapidite", "Rapidité"], ["sursis", "Sans Sursis"], ["puriste", "Puriste"], ["audela", "Au-delà"]];
  const RK_D = { classe: "Meilleur étage en Difficile avec une classe.", rapidite: "Étages 91 à 100 en Difficile, sans auto : le moins de tours de combat.", sursis: "Meilleur étage en Difficile sans utiliser de Sursis.", puriste: "Meilleur étage en Difficile avec seulement des sorts de ta classe.", audela: "Meilleur étage de l'Au-delà cette semaine." };
  function rankHtml(s) {
    const Q = E.ascState(s); const K = E.ascRk(s); const cat = st.rk.cat; const myCls = st.rk.k || (s.asc.run && s.asc.run.cls) || Object.keys(K.cls)[0] || "iop";
    const mine = cat === "classe" ? K.cls[myCls] || 0 : cat === "rapidite" ? K.spd : cat === "sursis" ? K.nos : cat === "puriste" ? K.pur : Q.rkx.x;
    const fmtS = (v) => (cat === "rapidite" ? (v ? plural(v, "tour") : "—") : v ? `étage ${v}` : "—");
    const rows = st.rk.rows; const online = !!(ON && ON.enabled && ON.db);
    const list = !online ? `<p class="note">Le classement de tous les joueurs demande un compte (gratuit).</p>` : st.rk.err ? `<p class="note">Classement indisponible pour l'instant.</p>`
      : !rows ? `<p class="note">Chargement…</p>` : !rows.length ? `<p class="empty">Personne n'est encore classé.</p>`
      : `<div class="list">${rows.map((r) => `<div class="li small ${ON.user && r.user_id === ON.user.id ? "me" : ""}"><b class="num">${r.r}</b><span class="grow">${h(r.pseudo || "?")}</span><span class="num">${fmtS(r.score)}</span></div>`).join("")}</div>`;
    return `<div class="subtabs">${RK_CATS.map(([k, n]) => `<button data-act="as-rk" data-v="${k}" aria-pressed="${cat === k}">${n}</button>`).join("")}</div>
      ${cat === "classe" ? `<div class="row"><select data-act="as-rkcls" aria-label="Classe">${D.CLASS_ORDER.map((c) => `<option value="${c}" ${c === myCls ? "selected" : ""}>${h(CL()[c].name)}</option>`).join("")}</select></div>` : ""}
      <p class="note">${RK_D[cat]} Ton score : <b>${fmtS(mine)}</b>. Le top 10 gagne un titre${cat === "audela" ? " et 2 Fioles" : ", 3 Fioles et 100 000 kamas"} au ${cat === "audela" ? "lundi" : "début du mois"} suivant.</p>${list}`;
  }
  function histHtml(s) {
    const Q = E.ascState(s); if (!Q.hist.length) return `<p class="empty">Aucune montée finie pour l'instant.</p>`;
    const WHY = { dead: "à terre", quit: "abandon", top: "sommet atteint" };
    return `<div class="list">${Q.hist.map((x) => `<div class="li small">${sym(x.cls)}<span class="grow"><b>${E.ASC_MODES[x.mode]} · étage ${x.top}</b><br><span class="xs muted">${h(CL()[x.cls] ? CL()[x.cls].name : x.cls)}, ${WHY[x.why] || x.why}${x.auto ? `, ${x.auto} étage${x.auto > 1 ? "s" : ""} en auto` : ""}</span></span><span class="num">+${fmt(x.frag)} Fragments</span></div>`).join("")}</div>`;
  }
  function rulesHtml() {
    return `<p class="note">Chaque étage de combat a sa règle (sauf les paliers et les boss). Elles changent chaque mois.</p><div class="as-g2">${Object.entries(E.ASC_RULES).filter(([, r]) => !r.hal || (E.halWin && E.halWin(E.now()))).map(([, r]) => `<div class="as-offer"><b>${r.ic} ${h(r.name)}</b><span class="xs muted">${h(r.d)}</span></div>`).join("")}</div>`;
  }
  const TABS = [["prog", "Progression"], ["shop", "Écus"], ["best", "Bestiaire"], ["rank", "Classements"], ["hist", "Historique"], ["rules", "Règles"]];
  function tabsHtml(s) {
    const body = st.tab === "shop" ? shopHtml(s) : st.tab === "best" ? bestHtml(s) : st.tab === "rank" ? rankHtml(s) : st.tab === "hist" ? histHtml(s) : st.tab === "rules" ? rulesHtml() : progHtml(s);
    return `<section class="panel as-tabsp"><div class="phead"><div class="subtabs" style="margin:0">${TABS.map(([k, n]) => `<button data-act="as-tab" data-v="${k}" aria-pressed="${st.tab === k}">${n}</button>`).join("")}</div></div><div class="pad stack">${body}</div></section>`;
  }

  /* 1.1.2.8 : en manuel, la tour n'enchaîne plus les combats toute seule (Mathis : « Ne pas rentrer directement dans le prochain combat ») :
     entre deux étages, un encadré présente l'étage qui vient et c'est le joueur qui lance le combat */
  function readyHtml(s) {
    const Q = E.ascState(s); const R = Q.run; if (!R || R.pend || Q.auto) return "";
    const fl = E.ascFloor(s, R.mode, R.f); const fight = ["fight", "boss"].includes(fl.t);
    const what = fl.t === "boss" ? `<b>Boss : ${h(monName(fl.boss))}</b>` : fl.t === "event" ? "Un événement t'attend." : fl.t === "shop" ? "Le marchand t'attend." : fl.t === "altar" ? "Un autel maudit t'attend." : `${fl.mobs.map((k) => `<img class="as-mini" src="${monImg(k)}" alt="" data-tip="${h(monName(k))}">`).join("")}${fl.rule ? ruleTag(fl.rule) : ""}`;
    const cost = fight ? (E.ascCost(s, R.mode, R.f) ? "1 ✦ Volonté" : "gratuit (étage déjà réussi)") : "";
    const btn = fight ? "⚔️ Lancer le combat" : "Entrer";
    return `<section class="panel as-ready"><div class="pad stack"><div class="row between"><div><b>Étage ${R.f}</b> · ${fl.t === "boss" ? "boss" : fl.t === "fight" ? `${fl.mobs.length} monstre${fl.mobs.length > 1 ? "s" : ""}` : "sans combat"}${cost ? ` · <span class="muted">${cost}</span>` : ""}</div></div>
      <div class="row as-ready-what">${what}</div>
      <div class="row">${st.msg ? `<span class="small">${h(st.msg)}</span>` : ""}<button class="btn primary" data-act="as-next">${btn}</button></div></div></section>`;
  }

  /* ---------- la page ---------- */
  function page(main) {
    const s = S(); const Q = E.ascState(s); const R = Q.run;
    const head = `<div class="pagehead"><h1>L'Ascension</h1><span class="small muted">${plural(Q.frag, "Fragment")} · ${plural(Q.ecus, "Écu")}</span></div>`;
    let body;
    if (!R) body = startHtml(s);
    else body = `${pendHtml(s)}${st.live ? `<section class="panel"><div class="pad stack" id="asArena">${arenaHtml(s)}</div></section>` : readyHtml(s)}
      <div class="as-side2"><section class="panel"><div class="phead"><h2>${R.mode === "x" ? "L'Au-delà" : `Tour de ${E.ascMonthName(E.ascMonth())}`}</h2><span class="tag soft">${E.ASC_MODES[R.mode]}</span></div><div class="pad">${towerHtml(s)}</div></section>${runHtml(s)}</div>`;
    main.innerHTML = `${head}<div class="stack">${volHtml(s)}${body}${tabsHtml(s)}</div>`;
    st.key = keyOf(s);
  }
  const keyOf = (s) => { const Q = s.asc; const R = Q && Q.run; return R ? `${R.f}|${R.pend ? R.pend.t + R.pend.at : ""}|${R.spells.length}|${R.sursis}|${R.recruits.length}|${!!st.live}|${Q.auto}` : `none|${Q && Q.hist.length}|${Q && Q.roll.n}|${Q && Q.runs}`; };
  window.DX.pages.asc = (main) => { page(main); if (st.tab === "rank") rkLoad(false); };
  const paint = () => { const main = $("#main"); if (!main || UI().tab !== "asc" || !S()) return; const y = window.scrollY; page(main); if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); };
  const done = (r) => { if (r) { X().toast(r); return false; } X().markDirty(); paint(); return true; };

  /* ---------- le combat sous les yeux ---------- */
  function liveStart(s) {
    const Q = E.ascState(s); const R = Q.run; if (!R || R.pend || st.live) return;
    const fl = E.ascFloor(s, R.mode, R.f);
    if (!["fight", "boss"].includes(fl.t)) { E.ascStepFloor(s, Q.auto); X().markDirty(); paint(); return; }
    const e = E.ascPay(s); if (e) { if (st.msg !== e) { st.msg = e; paint(); } return; }
    st.msg = null; const W = E.ascNewFight(s); if (!W) { st.msg = "Combat impossible."; paint(); return; }
    W.start = W.F.ents.map((x) => (x.hpMax ? x.hp / x.hpMax : 1)); st.live = W; st.tgt = -1; if (!E.ascState(s).auto) E.ascManual(W, true); X().markDirty(); paint();
  }
  function liveEnd(s, instant) {
    const W = st.live; if (!W) return; const Q = E.ascState(s);
    if (instant) E.ascSim(s, W);
    const res = E.ascResult(W); st.live = null;
    if (!Q.run) return;
    const out = E.ascApply(s, W, res, !!Q.auto); X().markDirty();
    if (out.dead) X().toast(`L'Ascension : montée finie à l'étage ${Q.last ? Q.last.top : out.f}. +${Q.last ? fmt(Q.last.frag) : 0} Fragments gardés.`, "rare");
    else if (out.sursis) X().toast(`Sursis utilisé à l'étage ${out.f} : les ennemis gardent leurs blessures.`);
    else if (out.boss && out.newSoul) X().toast(`Âme de ${monName(out.boss)} inscrite au bestiaire !`, "rare");
    st.wait = Date.now() + 900;
    paint();
  }
  let lastStep = 0;
  setInterval(() => {
    const s = S(); if (!s || !s.asc) { E.ASC_LIVE = false; return; }
    const Q = s.asc; const on = UI().tab === "asc" && document.visibilityState === "visible" && !!Q.run;
    if (!on && st.live) liveEnd(s, true); // page quittée : le combat se finit d'un coup
    E.ASC_LIVE = on;
    if (!on) return;
    const R = Q.run;
    if (R.pend) { if (Q.auto && Date.now() - R.pend.at > 4000) { E.ascAutoPick(s); st.sel = []; st.rep = -1; X().markDirty(); paint(); } else if (Q.auto) { const t = document.querySelector(".as-choice .tag.soft"); if (t) t.textContent = `Auto : choix fait dans ${Math.max(0, Math.ceil((R.pend.at + 4000 - Date.now()) / 1000))} s`; } return; }
    if (st.live) {
      const W = st.live; if (W.F.over) { liveEnd(s, false); return; }
      if (E.ascAwait(W)) { const k = arenaKey(W); if (k !== st.akey) { st.akey = k; const a = $("#asArena"); if (a) { a.innerHTML = arenaHtml(s); playFx(W); } } return; } // le combat attend ton sort
      const sp = A.stepMs / (s.settings && s.settings.fastAsc ? 3 : 1);
      if (Date.now() - lastStep < sp) return; lastStep = Date.now();
      const r = E.ascStep(s, W);
      if (r === "end") liveEnd(s, false); else { st.akey = arenaKey(W); const a = $("#asArena"); if (a) { a.innerHTML = arenaHtml(s); playFx(W); } }
      return;
    }
    if (Date.now() < st.wait) return;
    if (!Q.auto) return; // 1.1.2.8 : en manuel, c'est le joueur qui lance l'étage suivant (bouton « Lancer le combat »)
    liveStart(s);
  }, 120);
  /* la Volonté qui remonte, et la page qui suit la montée jouée ailleurs (onglet de fond, mode auto) */
  setInterval(() => { const s = S(); if (!s || UI().tab !== "asc" || $("#sheet").innerHTML) return; const v = $("#asVol"); if (v && !st.live) { const k = keyOf(s); if (k !== st.key) paint(); else v.outerHTML = volHtml(s); } }, 5000);

  /* ---------- classements ---------- */
  function rkLoad(force) {
    if (!(ON && ON.enabled && ON.db)) return; if (!force && Date.now() - st.rk.at < 60000 && st.rk.rows) return;
    const s = S(); const cat = st.rk.cat; const K = E.ascRk(s); const k = cat === "classe" ? st.rk.k || (s.asc.run && s.asc.run.cls) || Object.keys(K.cls)[0] || "iop" : "";
    const m = cat === "audela" ? E.weekIdx() : E.ascMonth(); st.rk.at = Date.now(); st.rk.rows = null; st.rk.err = false;
    try { ON.db().from("lb_asc").select("user_id,pseudo,score,r").eq("m", m).eq("cat", cat).eq("k", k).order("r", { ascending: true }).limit(10).then(({ data, error }) => {
      if (error) st.rk.err = true; else st.rk.rows = data || []; if (st.tab === "rank") paint(); }).catch(() => { st.rk.err = true; paint(); }); } catch (e) { st.rk.err = true; }
  }
  /* lots du top 10 (mois et semaines passés) et course de lancement de la 1.1 (10 premiers à l'étage 100 en Difficile) */
  let claimAt = 0, raceAt = 0;
  function claim() {
    const s = S(); if (!s || !s.asc || !(ON && ON.user && ON.rpc) || Date.now() - claimAt < 3600000) return; claimAt = Date.now();
    ON.rpc("asc_claim", { p_after: (s.hdv && s.hdv.op) || 0 }).then((r) => { if (!r || r.err || !r.data || r.data.err) return;
      if (r.data.ops && window.MARKET) window.MARKET.apply(r.data.ops, true);
      if (r.data.ok) X().toast(`Classement de L'Ascension : +${r.data.fioles} Fioles de Volonté${r.data.kamas ? ` et ${fmt(r.data.kamas)} kamas` : ""}, et ton titre !`, "rare"); }).catch(() => {});
  }
  function race() {
    const s = S(); if (!s || !s.asc || !s.asc.d100 || (s.unlocks && s.unlocks.legende11) || !(ON && ON.user && ON.db) || Date.now() - raceAt < 60000) return; raceAt = Date.now();
    try { ON.db().from("firsts").select("key").eq("kind", "race11").eq("user_id", ON.user.id).limit(1).then(({ data }) => {
      if (!data || !data[0]) return; const n = +data[0].key || 1; s.unlocks.legende11 = n; s.titlesExtra = s.titlesExtra || [];
      if (!s.titlesExtra.includes("Légende de la 1.1")) s.titlesExtra.push("Légende de la 1.1"); X().markDirty();
      X().toast(`Course de lancement de L'Ascension : tu es n° ${n} sur 10 ! Titre « Légende de la 1.1 » débloqué.`, "rare"); }).catch(() => {}); } catch (e) { /* hors ligne */ }
  }
  if (ON && ON.onChange) ON.onChange((x) => { if (x === "ok") setTimeout(() => { claim(); race(); }, 2500); });

  /* ---------- actions ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^as-/.test(a) || !S()) return;
    if (t.tagName === "SELECT") return;
    const s = S(); const Q = E.ascState(s); const d = t.dataset;
    switch (a) {
      case "as-go-page": UI().tab = "asc"; X().closeSheet(); X().render(); window.scrollTo(0, 0); return;
      case "as-mode": st.mode = d.v; paint(); return;
      case "as-reroll": done(E.act(s, "ascReroll")); return;
      case "as-start": { const r = E.act(s, "ascStart", st.mode, d.v); st.sel = []; st.rep = -1; st.quit = false; if (done(r)) window.scrollTo(0, 0); return; }
      case "as-sel": { const i = +d.i; st.sel = st.sel.includes(i) ? st.sel.filter((x) => x !== i) : st.sel.length < A.keep ? st.sel.concat([i]) : st.sel; paint(); return; }
      case "as-go": { const r = E.act(s, "ascChoose", st.sel.slice()); if (!r) st.sel = []; done(r); return; }
      case "as-rep": st.rep = st.rep === +d.i ? -1 : +d.i; paint(); return;
      case "as-pick": { const r = E.act(s, "ascChoose", +d.i, st.rep); if (!r) st.rep = -1; done(r); return; }
      case "as-soul": { const r = E.act(s, "ascChoose", 0, st.rep); if (!r) st.rep = -1; done(r); return; }
      case "as-glyph": done(E.act(s, "ascChoose", +d.i)); return;
      case "as-pass": st.rep = -1; done(E.act(s, "ascChoose", -1)); return;
      case "as-ev": done(E.act(s, "ascChoose", +d.v)); return;
      case "as-shop": done(E.act(s, "ascChoose", +d.i)); return;
      case "as-altar": done(E.act(s, "ascChoose", +d.v)); return;
      case "as-auto": done(E.act(s, "ascSetAuto", d.v === "1")); return;
      case "as-next": { st.wait = 0; liveStart(s); if (st.live) window.scrollTo(0, 0); return; }
      case "as-quit": if (!st.quit) { st.quit = true; paint(); setTimeout(() => { if (st.quit) { st.quit = false; paint(); } }, 5000); return; }
        st.quit = false; if (st.live) st.live = null; done(E.act(s, "ascQuit")); return;
      case "as-tgt": { st.tgt = +d.i; const a = $("#asArena"); if (a && st.live) { st.akey = arenaKey(st.live); a.innerHTML = arenaHtml(s); } return; }
      case "as-cast": { const W = st.live; if (!W) return; const def = W.defs[+d.i]; const r = E.ascManualCast(s, W, +d.i, offensive(def) ? tgtOf(W) : null); if (r) X().toast(r); return; }
      case "as-endturn": if (st.live) E.ascManualEnd(s, st.live); return;
      case "as-tauto": { const W = st.live; if (!W || !E.ascAwait(W)) return; W.S2.manualLive = false; E.ascStep(s, W); E.ascManual(W, true); return; }
      case "as-fauto": if (st.live) E.ascManual(st.live, false); return;
      case "as-fman": if (st.live) E.ascManual(st.live, true); return;
      case "as-drink": done(E.act(s, "ascDrink")); return;
      case "as-brew": { const r = E.act(s, "ascBrew"); if (!r) X().toast("Fiole de Volonté préparée."); done(r); return; }
      case "as-unl": done(E.act(s, "ascUnlock", d.v)); return;
      case "as-buy": done(E.act(s, "ascBuy", d.v)); return;
      case "as-tab": st.tab = d.v; paint(); if (d.v === "rank") rkLoad(false); return;
      case "as-rk": st.rk.cat = d.v; paint(); rkLoad(true); return;
    }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target; if (!t || !t.dataset || !S()) return; const a = t.dataset.act;
    if (a === "as-prio") done(E.act(S(), "ascSetPrio", t.value));
    if (a === "as-rkcls") { st.rk.k = t.value; paint(); rkLoad(true); }
  });

  /* tuile du Havre-Sac : une montée en cours ou un choix qui attend */
  function tile() {
    const s = S(); if (!s) return null; const Q = s.asc; const R = Q && Q.run;
    return { ic: `<span class="as-tileico">✦</span>`, t: "L'Ascension", s: R ? `${E.ASC_MODES[R.mode]} · étage ${R.f}${R.pend ? " · un choix t'attend" : ""}` : `Volonté ${Q ? E.ascVolSync(s) : A.volMax} / ${A.volMax}`, hot: !!(R && R.pend), act: `data-act="as-go-page"`,
      badge: R ? `<span class="tag">${R.pend ? "Choisir" : "Reprendre"}</span>` : `<span class="tag">Monter</span>` };
  }
  window.ASCUI = { page, st, tile, rkLoad, where: (s) => (s.asc && s.asc.run ? `Ascension · étage ${s.asc.run.f}` : null) };
})();
