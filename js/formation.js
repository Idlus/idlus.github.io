/* ============================================================================
   COMBAT EN FORMATION et PETIT MODULE DE COMBAT — Idlus 1.0.30 (choix 24A et 25A de Mathis)
   - Vue « Formation » de l'arène, celle par défaut (« Scène » et « Compacte » restent au bouton) :
     ton équipe à gauche, les ennemis à droite, chacun en deux colonnes (arrière, première ligne) selon le
     placement ; un médaillon par combattant avec ses PV et 3 icônes au plus ; l'ordre de jeu du tour en haut,
     celui qui joue entouré d'or ; la faiblesse et les boosts de chaque monstre, toutes ses résistances au
     survol (PC) ou en le touchant (téléphone).
   - Petit module de combat hors de l'onglet Combat : sous « Combat en cours » dans le menu de gauche (PC),
     bande fine et repliable au-dessus de la barre du bas (téléphone). Un clic ouvre le combat.
   ui.js garde l'arène et la boucle (buildArena, updateCombat) ; ce fichier donne le contenu et les mises à jour
   ciblées (rien n'est redessiné en entier pendant le combat). Pas de règle de jeu ici.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const G = (n) => X().G(n);
  const nf = (n) => Math.max(0, Math.floor(n || 0)).toLocaleString("fr-FR");
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const mqPhone = window.matchMedia ? window.matchMedia("(max-width:859px)") : { matches: false };
  const mqSmall = window.matchMedia ? window.matchMedia("(max-width:640px)") : { matches: false };
  const tours = (t) => `${t} tour${t > 1 ? "s" : ""}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- vue de l'arène ----------
     Formation par défaut ; « Scène » et « Compacte » restent au choix (S.settings.cview).
     Migration 1.0.30 (S.settings.cviewV, une seule fois) : un ancien choix de vue est oublié pour que chacun découvre la Formation. */
  function view(St) {
    const st = St.settings; if (!st.cviewV) { st.cviewV = 1; if (st.cview !== "form") delete st.cview; }
    return st.cview === "scene" || st.cview === "compact" ? st.cview : "form";
  }

  /* ---------- monstres : résistances, faiblesse, boosts ---------- */
  const ELS4 = ["t", "f", "e", "a"];
  const EL_IC = { n: "el_n", t: "el_t", f: "ine", e: "cha", a: "age" };
  const elName = (k) => (D.ELEMENTS[k] || D.ELEMENTS.n).name;
  const elPic = (k) => `<img class="fm-el" src="assets/c/${EL_IC[k] || "el_n"}.png" alt="${h(elName(k))}">`;
  const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
  const monEnt = (e) => !!e && e.side === "m" && !e.st && !!D.MONSTERS[e.key];
  function monRes(F, e) { // comme dealDamage (js/engine.js) : résistances du monstre et des idoles, plafonnées à 50 %
    const r = e.res || {}, I = F && F.idol, o = {};
    ["n", ...ELS4].forEach((k) => { o[k] = Math.min(50, (r[k] || 0) + (I ? (I.resAll || 0) + (I.resMain && I.resEl === k ? I.resMain : 0) : 0)); });
    return o;
  }
  const skinDiv = (e) => (e.mech && e.mech.includes("humeurs") ? 4 : 2);
  const elMul = (e, R, k) => (1 - R[k] / 100) * (e.skinEl === k ? 1 / skinDiv(e) : 1) * (e.openEl && e.openEl !== k ? 0.5 : 1);
  /* l'élément qui le blesse le plus (peau et fournaise des boss comprises) ; null si les quatre se valent */
  function monWeak(e, R) {
    let best = null, bm = -1, lo = Infinity;
    ELS4.forEach((k) => { const m = elMul(e, R, k); lo = Math.min(lo, m); if (m > bm + 1e-9) { bm = m; best = k; } });
    return bm - lo < 1e-9 ? null : best;
  }
  function monBoosts(F, e) { // [style, pastille, texte]
    const out = [];
    const bf = (e.buffs || []).filter((b) => b.mdmg && b.turns >= 1);
    if (bf.length) { const v = bf.reduce((a, b) => a + b.mdmg, 0), t = Math.max(...bf.map((b) => b.turns)); out.push(["bf", `${G("bolt")}+${v} %`, `Renforcé : +${v} % de dégâts, encore ${tours(t)}`]); }
    if (e.shield > 0) out.push(["sh", `${G("shield")}${short(e.shield)}`, `Bouclier de ${nf(e.shield)} PV`]);
    if (e.enraged) out.push(["bf", `${G("flame")}Rage`, "Rage : +40 % de dégâts, mais il subit 15 % de dégâts en plus"]);
    else if (e.enrageMod && e.hp < e.hpMax * 0.5) out.push(["bf", `${G("flame")}+25 %`, "Enragé sous la moitié de ses PV : +25 % de dégâts"]);
    if (e.mech && e.mech.includes("totems") && F.ents.some((m) => m.alive && m.totem)) out.push(["sh", G("lock"), "Invulnérable tant que ses totems tiennent debout"]);
    if (e.reflect) out.push(["bf", "↺", "Reflet : renvoie 30 % des dégâts reçus jusqu'à son prochain tour"]);
    if (e.skinEl) out.push(["sh", `${elPic(e.skinEl)}÷${skinDiv(e)}`, `Peau ${elName(e.skinEl)} : dégâts ${elName(e.skinEl)} divisés par ${skinDiv(e)}`]);
    if (e.openEl) out.push(["sh", `${elPic(e.openEl)}seul`, `Ne craint que l'élément ${elName(e.openEl)} : les autres éléments font moitié moins de dégâts`]);
    if (e.weakOpen) out.push(["wk", `${G("target")}×1,5`, "Point faible exposé : +50 % de dégâts jusqu'à son prochain tour"]);
    if (e.vamp) out.push(["bf", "♥", `Vol de vie : se soigne de ${Math.round(e.vamp * 100)} % des dégâts qu'il inflige`]);
    return out;
  }
  function monStates(F, e) { // états posés par l'équipe : dans l'infobulle
    const o = [], db = (e.debuffs || []).filter((b) => b.turns >= 0 && b.turns < 99);
    const vu = db.filter((b) => b.vuln), wk = db.filter((b) => b.weak);
    if (vu.length) o.push(`Vulnérable : +${vu.reduce((a, b) => a + b.vuln, 0)} % de dégâts subis`);
    if (wk.length) o.push(`Affaibli : −${Math.min(60, wk.reduce((a, b) => a + b.weak, 0))} % de dégâts`);
    if (e.mark > 0) o.push(`Marqué : +10 % de dégâts subis, encore ${tours(e.mark)}`);
    if ((e.dots || []).length) o.push(`Empoisonné, encore ${tours(Math.max(...e.dots.map((d) => d.turns)))}`);
    if (e.paLoss > 0) o.push(`−${e.paLoss} PA`);
    if (e.stun > 0) o.push("Passe son tour");
    if (e.charging) o.push("Prépare une attaque dévastatrice !");
    return o;
  }
  function weakChip(F, e) {
    const R = monRes(F, e), w = monWeak(e, R);
    if (!w) return ["eq", `=${sgn(R.t)} %`, `Aucune faiblesse : ${sgn(R.t)} % de résistance dans chaque élément`];
    return ["wk", `${elPic(w)}${sgn(R[w])} %`, `Faible : ${elName(w)}`];
  }
  /* infobulle d'un monstre (survol, ou toucher sur téléphone) : niveau, rôle, champion, 5 résistances, faiblesse, boosts, états */
  function tipMon(i) {
    const F = fightOf(); const e = F && F.ents[i]; if (!e) return "";
    const Ro = e.role && E.MON_ROLES[e.role], P = e.champ && E.CHAMP_POWERS[e.champ];
    let o = `<b>${h(e.name)}</b>${e.lvl ? ` <span class="muted">niv. ${e.lvl}</span>` : ""}<div class="xs muted">Frappe en ${h(elName(e.el || "n"))}${Ro ? ` · ${h(Ro.name)} : ${h(Ro.desc)}` : ""}</div>`;
    if (P) o += `<div class="xs" style="color:var(--gold)">Champion · ${h(P.name)} : PV ×2, dégâts +20 %. ${h(P.desc)}</div>`;
    const R = monRes(F, e), w = monWeak(e, R);
    const ws = w ? ELS4.filter((k) => Math.abs(elMul(e, R, k) - elMul(e, R, w)) < 1e-9) : []; // ex aequo : tous nommés
    o += `<div class="fm-tres">${["n", ...ELS4].map((k) => `<span class="${ws.includes(k) ? "lo" : ""}">${elPic(k)}<b>${sgn(R[k])} %</b></span>`).join("")}</div>`;
    o += w ? `<div class="xs"><b class="plus">Faible : ${h(ws.map(elName).join(" et "))}</b>${e.openEl === w ? " (le seul élément qui le blesse pleinement)" : e.skinEl && e.skinEl !== w && R[w] === R[e.skinEl] ? " (sa peau protège d'un autre élément)" : R[w] < 0 ? ` : il subit ${-R[w]} % de dégâts en plus` : " : sa résistance la plus basse"}</div>` : `<div class="xs muted">Aucune faiblesse : mêmes résistances partout.</div>`;
    monBoosts(F, e).forEach(([c, , t]) => { o += `<div class="xs fm-tl ${c}">${h(t)}</div>`; });
    monStates(F, e).forEach((t) => { o += `<div class="xs fm-tl muted">${h(t)}</div>`; });
    return o;
  }

  /* ---------- héros : bouclier, boosts, malus ---------- */
  const short = (v) => { v = Math.round(v || 0); return v >= 10000 ? Math.round(v / 1000) + " k" : nf(v); };
  const ICO = {
    down: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 9L1.6 5h2.2V1h2.4v4h2.2z" fill="currentColor"/></svg>',
    stun: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0v10M0 5h10M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.4"/></svg>',
  };
  function buffTxt(b) {
    const k = Object.keys(b).find((x) => x !== "turns" && x !== "name"); if (!k) return b.name || "boost";
    const St = D.STATS[k]; return `${b.name ? b.name + " " : ""}+${b[k]} ${St ? (St.short || St.name).replace("% ", "") : k} (${tours(b.turns)})`;
  }
  function heroChips(F, e, i) {
    const out = [];
    if (e.shield > 0) out.push(["sh", `${G("shield")}${short(e.shield)}`, `bouclier de ${nf(e.shield)} PV`]);
    const bf = (e.buffs || []).filter((b) => b.turns >= 1 && !b.mdmg);
    if (bf.length) out.push(["bf", `${G("bolt")}${bf.length > 1 ? bf.length : ""}`, "boosts : " + bf.map(buffTxt).join(", ")]);
    const db = (e.debuffs || []).filter((b) => b.turns >= 0 && b.turns < 99), bad = [];
    if ((e.dots || []).length) bad.push("empoisonné");
    if (db.some((b) => b.weak)) bad.push("affaibli");
    if (db.some((b) => b.vuln)) bad.push("vulnérable");
    if (db.some((b) => b.healcut)) bad.push("soins reçus réduits");
    if (e.paLoss > 0) bad.push(`−${e.paLoss} PA`);
    if (e.silence > 0) bad.push("muet");
    if (e.rooted > 0) bad.push("enraciné");
    if (F.ents.some((m) => m.alive && m.doom && m.doom.i === i)) bad.push("condamné");
    if (e.stun > 0) out.push(["db", ICO.stun, "passe son tour" + (bad.length ? ", " + bad.join(", ") : "")]);
    else if (bad.length) out.push(["db", `${ICO.down}${bad.length > 1 ? bad.length : ""}`, bad.join(", ")]);
    return out;
  }
  const chipsHtml = (L) => {
    const C = L.length > 3 ? L.slice(0, 2).concat([["more", `+${L.length - 2}`, ""]]) : L;
    return C.map(([c, t]) => `<span class="fc ${c}">${t}</span>`).join("");
  };
  function chipsOf(F, e, i) {
    if (!e.alive) return [];
    if (monEnt(e)) return [weakChip(F, e)].concat(monBoosts(F, e));
    return heroChips(F, e, i);
  }
  const rowTxt = (r) => (r === "b" ? "arrière" : "première ligne");
  function plainTip(F, e, i, L) {
    const own = e.summon && F.ents[e.owner];
    let t = own ? `${e.name}, invocation de ${own.name}` : `${e.name}${e.lvl ? " niv. " + e.lvl : ""}${e.summon || e.minion ? "" : " · " + rowTxt(rowOf(F, e, i))}`;
    const extra = (L || chipsOf(F, e, i)).map((c) => c[2]).filter(Boolean);
    if (extra.length) t += " : " + extra.join(" ; ");
    return t;
  }

  /* ---------- placement : deux colonnes de chaque côté ---------- */
  const BACK_ROLES = ["rodeur", "soigneur", "invoc"];
  /* Les héros suivent le placement (première ligne ou arrière, Terreur et Tapis roulant compris), leurs invocations vont devant.
     Les monstres n'ont pas de rangée dans le moteur : le boss et les plus solides devant, rôdeurs, soigneurs et invocateurs derrière. */
  function monRows(F) {
    const L = F.ents.map((e, i) => [e, i]).filter(([e]) => e.side !== "c"), out = {};
    if (L.some(([e]) => e.row === "f" || e.row === "b")) { L.forEach(([e, i]) => (out[i] = e.row === "b" ? "b" : "f")); return out; } // Kolizéum : leur placement
    const back = L.filter(([e]) => !e.boss && BACK_ROLES.includes(e.role)), front = L.filter((x) => !back.includes(x));
    const want = Math.ceil(L.length / 2);
    front.sort(([a, ia], [b, ib]) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || b.hpMax - a.hpMax || ia - ib);
    while (L.length >= 3 && front.length > want) back.push(front.pop());
    if (!front.length && back.length) front.push(back.shift());
    front.forEach(([, i]) => (out[i] = "f")); back.forEach(([, i]) => (out[i] = "b"));
    return out;
  }
  function rowOf(F, e, i) {
    if (e.side === "c") return e.summon ? "f" : e.row === "b" ? "b" : "f";
    const A = UI().arena; const MR = A && A.fmRows; if (MR && MR[i]) return MR[i];
    return e.row === "b" || (!e.minion && !e.boss && BACK_ROLES.includes(e.role)) ? "b" : "f";
  }
  function avatar(e) {
    const C = D.CLASSES, St = S();
    if (e.side === "c" && !e.summon && C[e.cls]) { const c = (e.cid != null && St && St.chars.find((x) => x.id === e.cid && x.cls === e.cls)) || { cls: e.cls, sex: e.sex };
      return `<span class="av hd" style="--cc:${C[e.cls].color}">${X().im(X().headImg(c), "", e.name)}</span>`; }
    if (e.dop && C[e.dop.cls]) return `<span class="av hd" style="--cc:${C[e.dop.cls].color}">${X().im(X().headImg(e.dop), "", e.name)}</span>`;
    if (e.img) return `<span class="av">${X().im(`assets/m/${e.img}.png`, "", e.name)}</span>`;
    return `<span class="av"><b>✦</b></span>`;
  }
  function tokHtml(F, e, i) {
    const mon = monEnt(e);
    const cls = `ent tk ${e.side === "c" ? "hero" : "m"}${e.summon || e.minion ? " summon" : ""}${e.boss ? " boss" : ""}${e.archi ? " archi" : ""}${e.champ ? " champ" : ""}${e.seal && e.seal.cri ? " sealaura" : ""}${e.criOn ? " sealcri" : ""}${e.alive ? "" : " dead"}${window.COLL && window.COLL.auraCls ? window.COLL.auraCls(e) : ""}`; // 1.0.30 : aura du Dofus Sublimé et de Grand Couturier (js/collui.js)
    return `<div class="${cls}" data-i="${i}" data-act="mtarget" ${mon ? `data-tipmon="${i}"` : `data-tip="${h(plainTip(F, e, i))}"`}>${avatar(e)}<span class="tx"><span class="who">${e.champ ? G("crown") : ""}${h(e.name)}${e.side === "c" && !e.summon && window.MAITUI && window.MAITUI.ksBadge ? window.MAITUI.ksBadge(window.DX.S.chars.find((c) => c.id === e.cid)) : ""}</span><span class="hpb"><i></i><b></b><em class="fhp"></em></span><span class="fics"></span></span>${window.COLL && window.COLL.petBadge ? window.COLL.petBadge(e) : ""}</div>`; // 1.1 : pastille du familier
  }
  const byRow = (F, side, r) => F.ents.map((e, i) => [e, i]).filter(([e, i]) => (e.side === "c") === (side === "c") && rowOf(F, e, i) === r)
    .sort(([a, ia], [b, ib]) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || ia - ib);
  /* contenu de l'arène (appelé par buildArena) ; A = ui.arena, déjà créé */
  function html(F, A) {
    A.fmRows = monRows(F);
    const line = (side, r) => `<div class="fm-line ${r}" data-r="${r}"><i>${r === "f" ? "Première ligne" : "Arrière"}</i><div class="fm-col">${byRow(F, side, r).map(([e, i]) => tokHtml(F, e, i)).join("")}</div></div>`;
    return `<div class="fm-ord" id="fmOrd"></div><div class="fm-board"><div class="fm-side c"><b class="fm-lbl">Ton équipe</b><div class="fm-lines">${line("c", "b")}${line("c", "f")}</div></div><div class="fm-vs">VS</div>`
      + `<div class="fm-side m"><b class="fm-lbl">${F.pvp ? "Adversaires" : "Ennemis"}</b><div class="fm-lines">${line("m", "f")}${line("m", "b")}</div></div></div><div class="result" id="fresult"></div>`;
  }
  /* un combattant arrivé en cours de combat (invocation) : rangé dans sa colonne */
  function add(F, A, i) {
    const e = F.ents[i]; const r = rowOf(F, e, i); if (e.side !== "c" && A.fmRows) A.fmRows[i] = r;
    const box = A.el.querySelector(`.fm-side.${e.side === "c" ? "c" : "m"} .fm-line.${r} .fm-col`); if (!box) return null;
    box.insertAdjacentHTML("beforeend", tokHtml(F, e, i)); const n = box.lastElementChild;
    n.classList.add("spawn"); setTimeout(() => n.classList.remove("spawn"), 650);
    return n;
  }

  /* ---------- ordre de jeu du tour ---------- */
  function ordIcon(e) {
    const C = D.CLASSES, cls = e.side === "c" && !e.summon ? e.cls : e.dop ? e.dop.cls : null;
    if (cls && C[cls]) return `<img src="${X().symImg(cls)}" alt="" style="--cc:${C[cls].color}" class="cl">`;
    return e.img ? `<img src="assets/m/${e.img}.png" alt="">` : `<b>✦</b>`;
  }
  function ordHtml(F) {
    const cur = F.order && F.oi > 0 ? F.order[F.oi - 1] : -1, seen = new Set(), L = [];
    (F.order || []).forEach((i, k) => { const e = F.ents[i]; if (seen.has(i) || !e || !e.alive) return; seen.add(i); L.push({ i, e, done: k < F.oi - 1 && i !== cur }); });
    const max = mqSmall.matches ? 7 : 12, pos = Math.max(0, L.findIndex((x) => x.i === cur));
    const from = Math.max(0, Math.min(pos - 2, L.length - max)), V = L.slice(from, from + max);
    return `<b>Tour ${F.round}</b>${from ? `<span class="more">+${from}</span>` : ""}${V.map((x) => `<span class="o ${x.e.side === "c" ? "c" : "m"}${x.done ? " done" : ""}${x.i === cur && !F.over ? " cur" : ""}" data-tip="${h(x.e.name)}${x.i === cur ? " : à lui de jouer" : x.done ? " : a déjà joué ce tour" : ""}">${ordIcon(x.e)}</span>`).join("")}${L.length > from + max ? `<span class="more">+${L.length - from - max}</span>` : ""}`;
  }

  /* ---------- mise à jour (appelée par updateCombat à chaque passage) ---------- */
  function update(F, A, force) {
    const ord = A.el.querySelector("#fmOrd");
    if (ord) { const k = `${F.id}|${F.round}|${F.oi}|${F.over ? 1 : 0}|${F.order ? F.order.filter((i) => F.ents[i] && F.ents[i].alive).join(",") : ""}|${mqSmall.matches ? 1 : 0}`; if (force || ord.dataset.k !== k) { ord.dataset.k = k; ord.innerHTML = ordHtml(F); } }
    const deep = force || A.fmSeq !== F.seq; A.fmSeq = F.seq;
    F.ents.forEach((e, i) => {
      const n = A.nodes[i]; if (!n) return;
      const hv = n.querySelector(".fhp"); if (hv) { const v = nf(e.hp); if (hv.textContent !== v) hv.textContent = v; }
      if (!deep) return;
      const L = chipsOf(F, e, i), fc = n.querySelector(".fics");
      const k = L.map((c) => c[0] + c[1]).join("|");
      if (fc && fc.dataset.k !== k) { fc.dataset.k = k; fc.innerHTML = chipsHtml(L); if (!monEnt(e)) n.dataset.tip = plainTip(F, e, i, L); }
      n.classList.toggle("low", e.alive && e.side === "c" && !e.summon && e.hp < e.hpMax * 0.25);
      n.classList.toggle("sealcri", !!(e.criOn && e.alive)); // Cri du Champion (js/champions.js)
      if (e.side === "c" && !e.summon) { // Terreur, Tapis roulant : le héros change de colonne
        const r = rowOf(F, e, i), line = n.closest(".fm-line");
        if (line && line.dataset.r !== r) { const box = A.el.querySelector(`.fm-side.c .fm-line.${r} .fm-col`); if (box) { box.appendChild(n); n.dataset.tip = plainTip(F, e, i, L); } }
      }
    });
  }

  /* ---------- petit module de combat (hors de l'onglet Combat) ---------- */
  const mfPic = (e) => (e.side === "c" && !e.summon && D.CLASSES[e.cls] ? X().symImg(e.cls) : e.dop && D.CLASSES[e.dop.cls] ? X().headImg(e.dop) : e.img ? `assets/m/${e.img}.png` : "assets/ui/logo.webp"); // 1.0.30.7 : le Dopeul garde sa tête (il porte aussi l'image du monstre de la zone)
  const mfPct = (v, m) => Math.max(0, Math.min(100, Math.round((Math.max(0, v) / Math.max(1, m)) * 100)));
  function mfLive(St) { // même règle que « Combat en cours » dans le menu
    if (!E.team(St).length) return false;
    return !!((E.expActive && E.expActive(St)) || (St.dungeon && D.DUNGEONS[St.dungeon.id]) || (St.hunting && St.sub));
  }
  function mfName(St, F) {
    if (E.expActive && E.expActive(St)) return window.SGUI ? window.SGUI.where(St) : "Songe infini";
    const dg = St.dungeon && D.DUNGEONS[St.dungeon.id]; if (dg) return dg.name;
    if (F.prot && !F.over) return F.label;
    return St.sub && E.SUBS[St.sub] ? E.SUBS[St.sub].name : F.label;
  }
  function mfData(St, F) {
    const he = [], al = [], dd = []; let hc = 0, hm = 0, mc = 0, mm = 0;
    F.ents.forEach((e, i) => {
      if (e.side === "c") { if (e.summon) return; if (he.length < 5) he.push(i); hc += Math.max(0, e.hp); hm += e.hpMax; }
      else { (e.alive ? al : dd).push(i); mc += Math.max(0, e.hp); mm += e.hpMax; }
    });
    const mo = al.slice(0, 5).concat(dd.slice(0, Math.max(0, 5 - al.length))).sort((a, b) => a - b); // les monstres encore debout d'abord
    const last = F.log.length ? F.log[F.log.length - 1].txt : "";
    return { he, mo, tot: [mfPct(hc, hm), mfPct(mc, mm)], log: F.over ? (F.result === "win" ? "Victoire !" : "Défaite…") : last || "Le combat commence…", name: mfName(St, F), shape: `${F.id}|${he}|${mo}` };
  }
  const setTxt = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
  const mfUnit = (F, i) => { const e = F.ents[i]; return `<span class="mf-u${e.alive ? "" : " dead"}" data-mi="${i}"><img src="${mfPic(e)}" alt=""><i class="mf-b"><i style="width:${mfPct(e.hp, e.hpMax)}%"></i></i></span>`; };
  const mfBox = (St, F, D2) => `<span class="mf-hd"><b class="mf-n">${h(D2.name)}</b><span class="mf-t">tour ${F.round}</span></span><span class="mf-cols"><span class="mf-c">${D2.he.map((i) => mfUnit(F, i)).join("")}</span><span class="mf-c m">${D2.mo.map((i) => mfUnit(F, i)).join("")}</span></span><span class="mf-lg">${h(D2.log)}</span>`;
  const mfStrip = (St, F, D2) => `<span class="mf-hd"><b class="mf-n">${h(D2.name)}</b><span class="mf-t">tour ${F.round}</span></span><span class="mf-sides">${[D2.he, D2.mo].map((L, k) => `<span class="mf-sd${k ? " m" : ""}"><span class="mf-ics">${L.map((i) => `<img src="${mfPic(F.ents[i])}" alt="">`).join("")}</span><i class="mf-b"><i data-ms="${k}" style="width:${D2.tot[k]}%"></i></i></span>`).join("")}</span><button class="mf-fold" data-act="fm-fold" aria-label="${St.settings.mfFold ? "Déplier" : "Replier"} le résumé du combat">${St.settings.mfFold ? "▴" : "▾"}</button><span class="mf-lg">${h(D2.log)}</span>`;
  function mfPaint(el, St, F, D2, build) {
    if (el.dataset.s !== D2.shape) { el.innerHTML = build(St, F, D2); el.dataset.s = D2.shape; return; }
    el.querySelectorAll(".mf-n").forEach((x) => setTxt(x, D2.name)); el.querySelectorAll(".mf-t").forEach((x) => setTxt(x, `tour ${F.round}`));
    setTxt(el.querySelector(".mf-lg"), D2.log);
    el.querySelectorAll("[data-mi]").forEach((u) => { const e = F.ents[+u.dataset.mi]; if (!e) return; if (u.classList.contains("dead") === !!e.alive) u.classList.toggle("dead", !e.alive); const w = mfPct(e.hp, e.hpMax) + "%"; const b = u.querySelector(".mf-b>i"); if (b && b.style.width !== w) b.style.width = w; });
    el.querySelectorAll("[data-ms]").forEach((b) => { const w = D2.tot[+b.dataset.ms] + "%"; if (b.style.width !== w) b.style.width = w; });
  }
  /* S.settings.miniFight (Options › Affichage) : false = jamais ; S.settings.mfFold : bande du téléphone repliée */
  function mini() {
    const St = S(), F = St && St.fight, ui = UI();
    const on = !!(St && F && F.ents && St.settings.miniFight !== false && ui.tab !== "combat" && !ui.watch && mfLive(St));
    const phone = mqPhone.matches;
    let box = $("#navmf"); let st = $("#mfstrip");
    if (!box && on && !phone) { const f = $("#nav .sn-fight"); if (f) { f.insertAdjacentHTML("afterend", `<button id="navmf" class="navmf" data-act="nav" data-v="combat" title="Ouvrir le combat" hidden></button>`); box = $("#navmf"); } }
    const pcOn = on && !phone && !St.settings.navMini && !!box, phOn = on && phone;
    if (box && !pcOn && !box.hidden) { box.hidden = true; box.innerHTML = ""; box.dataset.s = ""; box.dataset.k = ""; }
    if (st && !phOn) { st.remove(); st = null; }
    document.body.classList.toggle("mfon", phOn); document.body.classList.toggle("mffold", phOn && !!St.settings.mfFold);
    if (!pcOn && !phOn) return;
    const k = `${F.id}:${F.seq}:${F.round}:${F.over ? 1 : 0}:${St.settings.mfFold ? 1 : 0}`;
    if (pcOn && box.dataset.k === k && !box.hidden) return; if (phOn && st && st.dataset.k === k) return;
    const D2 = mfData(St, F);
    if (pcOn) { mfPaint(box, St, F, D2, mfBox); box.dataset.k = k; box.hidden = false; return; }
    if (!st) { st = document.createElement("div"); st.id = "mfstrip"; st.setAttribute("role", "button"); st.setAttribute("aria-label", "Ouvrir le combat"); st.dataset.act = "nav"; st.dataset.v = "combat"; document.body.appendChild(st); }
    const fold = !!St.settings.mfFold; if (st.classList.contains("fold") !== fold || !st.className) { st.className = "mfstrip" + (fold ? " fold" : ""); st.dataset.s = ""; }
    mfPaint(st, St, F, D2, mfStrip); st.dataset.k = k;
  }
  let mfAt = 0;
  function loop() { if (Date.now() - mfAt < 250) return; mfAt = Date.now(); try { mini(); } catch (e) { /* le module ne bloque jamais la boucle du jeu */ } }
  mqPhone.addEventListener && mqPhone.addEventListener("change", () => { const b = $("#navmf"); if (b) b.dataset.k = ""; mini(); });

  /* ---------- actions ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-act^="fm-"]'); if (!t || !S()) return;
    if (t.dataset.act === "fm-fold") { ev.stopPropagation(); const st = S().settings; st.mfFold = !st.mfFold; X().markDirty(); const s = $("#mfstrip"); if (s) s.dataset.k = ""; mini(); }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target; if (!t.dataset || t.dataset.act !== "fm-mini" || !S()) return;
    S().settings.miniFight = t.checked; X().markDirty(); mini();
  });
  const fightOf = () => { const ui = UI(); return ui.watch ? ui.watch.W.S2.fight : S() && S().fight; };

  window.FORMUI = { view, html, add, update, tipMon, mini, loop, monRes, monWeak };
})();
