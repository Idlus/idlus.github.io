/* ============================================================================
   INTERFACE — Idlus (v2)
   Rendu des pages (innerHTML) + combat animé (DOM à clés, mis à jour en place).
   ========================================================================== */
(function () {
"use strict";
const D = window.DATA, E = window.ENGINE;
const { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, CLASSES, CLASS_ORDER, CONDITIONS, GATHER_JOBS, CRAFT_JOBS, SLOTS, MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, SPELL_IMG, EMBLEM, HUNT_TIERS, CONSUMABLES, STAT_HELP } = D;

let S = null;
const ui = {
  tab: "home", home: "apercu", world: "map", zoneView: null, hero: "equip", cid: null, slot: null, inv: "items", slotFilter: "all", met: "recolte", fg: "fm", qt: "main", fmSel: null, manualSpell: null,
  craftJob: "tailleur", craftOnly: false, craftSearch: "", focus: "", startCls: "iop", startSex: null, confirm: null, giveTo: null, combatCid: null, encZone: "incarnam",
};
const LS_KEY = "dofousxen-save";
/* ---------- Notes de mise à jour (bandeau « mise à jour appliquée ») ---------- */
const GAME_VERSION = "3.0.3";
const DISCORD = "https://discord.gg/9ApPgWjPUM";
const CHANGELOG = [
  { v: "3.0.3", name: "Application installable", items: [
    "idlus s'installe sur téléphone et PC comme une vraie application : icône, plein écran, lancement instantané",
    "Le jeu fonctionne hors connexion (les images sont gardées au fil de la partie)",
    "Bouton « Installer » dans les Options, avec un guide pour iPhone",
    "Le serveur Discord d'idlus est ouvert : bouton sur l'Accueil et « Signaler un bug » dans les Options",
    "Nouvelle adresse : mathiss29.github.io/idlus" ] },
  { v: "3.0.2", name: "Équilibrage des classes", items: [
    "Les 19 classes sont rééquilibrées par leurs sorts et passifs : les écarts de puissance entre classes sont bien plus faibles",
    "Iop : Colère à 6 charges (+40 %), Concentration 2 fois par tour, nouveau passif Vigueur (vol de vie 8 %)",
    "Zobal : masque choisi selon la situation (attaque +30 %, défense, soutien) ; Eliotrope : bouclier de portail et vol de vie",
    "Crâ : subit 15 % de dégâts en moins, Pas Chassé protège, Flèche Cinglante (niv. 12) et Dispersion (niv. 34) plus tôt",
    "Pandawa et Sadida : bonus de classe réduits (+20 % et +10 %)",
    "Ce bandeau vous résume chaque mise à jour, et le jeu vous prévient quand une nouvelle version est en ligne" ] },
  { v: "3.0.1", name: "Correctifs", items: [
    "Toutes les clés de donjon sont fabricables",
    "178 sorts de placement ou d'état ont un effet adapté au combat automatique",
    "Sous-zones de transition 68-86 (Kaliptus, Forêt Sombre, Canyon)",
    "Nouveau nom : idlus" ] },
  { v: "3.0", name: "Builds et contenu", items: [
    "Vrais sorts de DOFUS 3 et variantes, 6 à 8 emplacements",
    "Profil de build, simulateur de dégâts, nouvelles caractéristiques",
    "Challenges, mécaniques de boss, invocations",
    "Contenu jusqu'au niveau 120 et 17 nouveaux donjons" ] },
];
const vNum = (v) => v.split(".").map(Number).reduce((a, x, i) => a + x * Math.pow(1000, 2 - i), 0);

/* ---------- utilitaires ---------- */
const $ = (s) => document.querySelector(s);
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.floor(n).toLocaleString("fr-FR");
const pct = (a, b) => Math.max(0, Math.min(100, b ? (a / b) * 100 : 0));
const char = (id) => S.chars.find((c) => c.id === id);
const dur = (s) => { s = Math.round(s); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60); return hh ? `${hh} h ${mm} min` : mm ? `${mm} min` : `${s} s`; };
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "à l'instant" : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : `il y a ${Math.floor(s / 3600)} h`; };
const elVar = (el) => (el === "buff" ? "var(--buff)" : `var(--el-${el || "n"})`);
const eld = (el) => `<span class="eld" style="--c:${elVar(el)}" title="${ELEMENTS[el || "n"].name}">${ELEMENTS[el || "n"].name[0]}</span>`;
const fmtStatVal = (k, v) => (["cri", "rt", "rf", "re", "ra"].includes(k) ? `${fmt(v)} %` : fmt(v));
const statLine = (k, v) => `${v > 0 ? "+" : ""}${fmt(v)} ${STATS[k].name.replace("% ", "")}`;

/* images */
const imgM = (key) => (MONSTERS[key] ? `assets/m/${MONSTERS[key].img}.png` : "");
const imgI = (icon) => `assets/i/${icon}.png`;
const resImg = (name) => (RES[name] ? imgI(RES[name].icon) : "");
const itemImg = (tpl) => { const T = ITEMS[tpl]; if (!T) return ""; return T.mimg ? `assets/m/${T.mimg}.png` : imgI(T.icon); };
const spellImg = (name) => (SPELL_IMG[name] ? `assets/s/${SPELL_IMG[name]}.png` : "");
const headImg = (c) => `assets/h/${c.cls}_${c.sex || CLASSES[c.cls].sex}.png`;
const logoImg = (cls) => `assets/h/${cls}_logo.png`;
const im = (src, cls = "ico", alt = "") => (src ? `<img class="${cls}" src="${src}" alt="${h(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : "");
const headTag = (cls, sex, alt = "") => `<img src="assets/h/${cls}_${sex || CLASSES[cls].sex}.png" alt="${h(alt)}" loading="lazy" onerror="this.onerror=null;this.src='assets/h/${cls}_logo.png'">`;
const head = (c, lg) => `<span class="head ${lg ? "lg" : ""}" style="--cc:${CLASSES[c.cls].color}">${headTag(c.cls, c.sex, c.name)}</span>`;
const sIco = (k) => (["vit", "sa", "fo", "ine", "cha", "age", "pui", "do", "cri", "so", "pp", "ini", "pa", "rt", "rf", "re", "ra"].includes(k) ? `<img class="sico" src="assets/c/${k}.png" alt="" loading="lazy">` : "");
const tipAttr = (k) => (STAT_HELP[k] ? ` data-tip="${h((STATS[k] ? STATS[k].name.replace("% ", "") : "Points de vie") + " — " + STAT_HELP[k])}"` : "");
const resChips = (res) => Object.entries(res || {}).filter(([, v]) => v).map(([k, v]) => `<span class="chip ${v < 0 ? "neg" : ""}" style="--c:var(--el-${k})" data-tip="Résistance ${ELEMENTS[k].name} : ${v} %">${v > 0 ? "+" : ""}${v}%</span>`).join("");

/* ---------- carte de héros (v2.6) ---------- */
const symImg = (cls) => `assets/h/${cls}_sym.png`;
const EL_ICON = { t: "fo", f: "ine", e: "cha", a: "age", n: "vit" };
function heroCard(c, size = "", opts = {}) {
  const st = E.charStats(S, c); const el = E.domEl(st); const fi = E.frameIdx(c.lvl); const C = CLASSES[c.cls];
  const rad = E.radiantWorn(S, c); const orn = c.orn && E.ornUnlocked(S, c.orn) ? c.orn : null;
  const need = E.xpNeed(c.lvl);
  const stats3 = size === "big" ? [["vit", st.hpMax], [buildMain(c), st[buildMain(c)]], ["pa", st.pa], ["pui", st.pui], ["cri", st.cri + "%"], ["pp", st.pp]] : [["vit", st.hpMax], [buildMain(c), st[buildMain(c)]], ["pa", st.pa]];
  let ornHtml = "", ornCls = "";
  if (orn === "ailes" && S.align) { const r = E.alignRankIdx(S); ornCls = `o-ailes side-${S.align.side}${c.wing ? " wing-" + c.wing : ""}`; const w = wingSVG(S.align.side); ornHtml = `<img class="orn badge" src="assets/i/${E.ALIGN[S.align.side].badge}.png" alt="">${w.replace('class="orn wing"', 'class="orn wing l"')}${w.replace('class="orn wing"', 'class="orn wing r"')}`; opts.ws = (0.7 + r * 0.12).toFixed(2); }
  else if (orn === "couronne") ornHtml = `<span class="orn crown">👑</span>`;
  else if (orn === "lauriers") ornHtml = `<span class="orn laurel l">🌿</span><span class="orn laurel r">🌿</span>`;
  else if (orn === "heros") ornHtml = `<span class="orn crown">🎖</span>`;
  else if (orn === "avis") ornHtml = `<span class="orn seal">📜</span>`;
  else if (orn === "almanax") ornHtml = `<span class="orn seal">📅</span>`;
  if (orn && orn !== "ailes") ornCls = "o-" + orn;
  const job = c.job ? `<span class="jobtag">⛏ ${h(D.GATHER_JOBS[c.job.job].name)}</span>` : "";
  return `<button class="hcard ${size} f${fi} ${rad ? "radiant" : ""} ${ornCls}" style="--el:${elVar(el)};--cc:${C.color}${opts.ws ? ";--ws:" + opts.ws : ""}" data-act="${opts.act || "selchar"}" data-id="${c.id}" data-tip="${h(`${c.name} · ${C.name} niv. ${c.lvl} · cadre ${E.FRAMES[fi]} · élément ${ELEMENTS[el].name}${orn ? " · ornement " + E.ORN[orn].name(S) : ""}`)}">
    ${ornHtml}<div class="in"><div class="art">${im(logoImg(c.cls), "wm")}${im(symImg(c.cls), "sym", C.name)}<span class="hd">${headTag(c.cls, c.sex, c.name)}</span><span class="lv">${c.lvl}</span><span class="elb"><img src="assets/c/${EL_ICON[el]}.png" alt=""></span>${job}${rad ? `<span class="rb">✦ ${rad > 1 ? rad + " " : ""}Rayonnant${rad > 1 ? "s" : ""}</span>` : ""}</div>
    <div class="nm"><b>${h(c.name)}</b><span class="ttl">${c.title ? h(c.title) : ""}</span></div><div class="cl">${C.name}${E.isSolo(S) && c.inTeam && !c.job ? " · solo" : ""}</div>
    <div class="xpb"><i style="width:${pct(c.xp, need)}%"></i></div>
    <div class="st3">${stats3.map(([k, v]) => `<span>${sIco(k)}${typeof v === "number" ? fmt(v) : v}</span>`).join("")}</div></div><span class="tier">${E.FRAMES[fi]}</span></button>`;
}
/* ailes d'alignement (dessin générique : plumes claires / membranes sombres) */
function wingSVG(side) {
  if (side === "bonta") {
    const F = [[38, 52], [16, 58], [-6, 54], [-28, 46], [-48, 36]];
    return `<svg class="orn wing" viewBox="0 0 64 100" aria-hidden="true"><defs><linearGradient id="wgb" x1="0" x2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset=".55" stop-color="#e8f2ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
      <g fill="url(#wgb)" stroke="#4f8fe0" stroke-width="1.2">${F.map(([a, l]) => `<ellipse cx="${60 - l / 2}" cy="20" rx="${l / 2}" ry="7.5" transform="rotate(${a} 60 20)"/>`).join("")}</g><circle cx="58" cy="20" r="6" fill="#ffe08a" stroke="#c9962e"/></svg>`;
  }
  return `<svg class="orn wing" viewBox="0 0 64 100" aria-hidden="true"><defs><linearGradient id="wgr" x1="0" x2="1"><stop offset="0" stop-color="#3a0a0a"/><stop offset=".6" stop-color="#b3261e"/><stop offset="1" stop-color="#ff7a4a"/></linearGradient></defs>
    <path d="M60 20 L4 2 Q14 28 6 44 Q18 40 20 60 Q30 52 36 72 Q42 56 58 56 Z" fill="url(#wgr)" stroke="#1a0505" stroke-width="1.5"/>
    <path d="M60 20 L10 10 M60 20 L14 42 M60 20 L26 58 M60 20 L40 66" stroke="#1a0505" stroke-width="1.3" opacity=".7"/><circle cx="58" cy="20" r="6" fill="#ff9a4a" stroke="#5a1010"/></svg>`;
}
function fsGauge() {
  const team = E.team(S); const fs = E.freeSpirit(S); const solo = team.length === 1;
  const syn = E.synergy(S);
  const sub = solo ? `Emblème du Solitaire actif (niv. ${S.emblem.lvl})` : team.length ? `${team.length} héros${syn ? ` · Synergie +${syn} %` : ""}` : "aucun héros ne chasse";
  return `<div class="fsg ${solo ? "solo" : fs ? "" : "zero"}" style="--p:${fs}" data-tip="Esprit Libre : plus l'équipe est petite, plus le bonus est grand (XP, butin, PV, dégâts). 1 héros : +100 % · 2 : +80 % · 3 : +60 % · 4 : +40 % · 5 : +25 % · 6 : +15 % · 7 : +5 % · 8 : 0 %. Synergie : +2 % de dégâts et d'XP par classe différente dans l'équipe (à partir de 2 héros).">
    <span class="flame"><i></i></span><span class="txt"><b>${solo ? "Solitaire" : "Esprit Libre"} +${fs} %</b><br><span class="xs muted">${sub}</span><span class="pips5">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<i class="${n <= team.length ? "off" : ""}"></i>`).join("")}</span></span></div>`;
}
function questAlert() { return !!(S.almanax && S.almanax.day !== E.dayKey() && E.almanax(S).qty <= (S.res[E.almanax(S).res] || 0)); }
const jobImg = (j) => `assets/j/${j}.png`;
/* ---------- index des ressources : sources et usages ---------- */
let RIDX = null;
function resIndex() {
  if (RIDX) return RIDX; const src = {}, use = {};
  const add = (o, k, v) => (o[k] = o[k] || []).push(v);
  for (const k in MONSTERS) { const m = MONSTERS[k]; m.drops.forEach(([r, p]) => add(src, r, { m: k, p })); }
  for (const j in GATHER_JOBS) GATHER_JOBS[j].items.forEach(([r, l]) => add(src, r, { job: j, lvl: l }));
  for (const t in ITEMS) { const T = ITEMS[t]; if (T.craft) T.craft.ing.forEach(([r, q]) => add(use, r, { tpl: t, q })); }
  for (const n in SPECIAL_CRAFTS) SPECIAL_CRAFTS[n].ing.forEach(([r, q]) => add(use, r, { special: n, q }));
  for (const j in GATHER_JOBS) for (let L = 1; L <= E.TOOL_MAX; L++) E.toolRecipe(j, L).ing.forEach(([r, q]) => add(use, r, { tool: j, L, q }));
  for (const r in src) src[r].sort((a, b) => (b.p || 0) - (a.p || 0));
  return (RIDX = { src, use });
}
const subOfMon = (k) => Object.values(E.SUBS).find((s) => s.monsters.includes(k)) || (Object.entries(DUNGEONS).find(([, d]) => d.boss === k || d.rooms.some((r) => r.mobs.includes(k))) || [])[0];
function bestSource(r) {
  const L = resIndex().src[r] || []; const g = L.find((x) => x.job); if (g) return `${GATHER_JOBS[g.job].name} niv. ${g.lvl}`;
  const m = L.find((x) => x.m); if (!m) return r === E.RARE_COMPONENT ? "trouvailles de récolte, boss et coffres" : "source inconnue";
  const s = subOfMon(m.m); return `${MONSTERS[m.m].name}${s ? " (" + (typeof s === "string" ? DUNGEONS[s].name : s.name) + ")" : ""} · ${E.resRate(m.p).toFixed(1).replace(".", ",")} %`;
}
function shopIng(e) { return e.k === "tpl" ? (ITEMS[e.id] && ITEMS[e.id].craft ? ITEMS[e.id].craft.ing : []) : e.k === "special" ? (SPECIAL_CRAFTS[e.id] ? SPECIAL_CRAFTS[e.id].ing : []) : E.toolLvl(S, e.id) < E.TOOL_MAX ? E.toolCost(S, e.id).ing : []; }
function shopName(e) { return e.k === "tpl" ? ITEMS[e.id].name : e.k === "special" ? e.id : `${E.toolCost(S, e.id).name} (${GATHER_JOBS[e.id].name})`; }
function shopListHtml() {
  return S.shop.map((e, i) => { const ing = shopIng(e); const miss = ing.filter(([r, q]) => (S.res[r] || 0) < q); const ok = !miss.length && ing.length;
    return `<div class="qcard ${ok ? "cur" : ""}"><span class="qnum">${ok ? "✓" : "🛒"}</span><div class="grow"><b>${h(shopName(e))}</b>${ok ? ` <span class="tag good">tout est réuni</span>` : ""}${ingHtml(ing)}
      ${miss.length ? `<div class="xs muted" style="margin-top:4px">${miss.map(([r]) => `${h(r)} : ${h(bestSource(r))}`).join("<br>")}</div>` : ""}</div><button class="btn sm" data-act="shopdel" data-i="${i}" title="Retirer">✕</button></div>`; }).join("");
}

const ICONS = {
  metiers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-3 3-6-6 3-3z"/><path d="M11 7L3 15l3 3 8-8"/><path d="M6 21c0-2 2-3 4-3"/></svg>',
  forge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9h12a4 4 0 0 1-4 4H9l-1 4h8v3H6v-3l1-4H6a2 2 0 0 1-2-2V9z"/><path d="M16 9l4-2"/><path d="M18 3l1 2M21 4l-2 1"/></svg>',
  quests: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2h11v2a3 3 0 0 0 3 3"/><path d="M7 3a3 3 0 0 0-3 3v1h3"/><path d="M10 8h5M10 12h5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/></svg>',
  combat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20 14 10M14 4l6 6-3 1-3-3-1-3zM5 15l4 4M3 21l2-2"/></svg>',
  heroes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.6.2 4.3 2 4.8 4.6"/></svg>',
  inv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  ateliers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 21l8-8M14 4l6 6-4 4-6-6 4-4z"/><path d="M4 9h5M6.5 6.5v5"/></svg>',
};
const TABS = [["home", "Accueil", "Accueil"], ["world", "Monde", "Monde"], ["combat", "Combat", "Combat"], ["heroes", "Héros", "Héros"], ["inv", "Inventaire", "Sac"], ["metiers", "Métiers", "Métiers"], ["forge", "Forgemagie", "Forge"], ["quests", "Quêtes", "Quêtes"]];

/* ---------- décors de scène (SVG déterministe) ---------- */
const DECOS = {
  meadow: { day: { sky: ["#9fd8ff", "#e8f7ff"], far: "#a9dc8c", near: "#7cc35b", d: "clouds" }, night: { sky: ["#1b2550", "#3d4f86"], far: "#2f5141", near: "#25432f", d: "clouds" } },
  sky:    { day: { sky: ["#b8e2ff", "#fdf3ff"], far: "#c9ecb4", near: "#9fd685", d: "clouds" }, night: { sky: ["#1d1f4f", "#4a3f7d"], far: "#384f4a", near: "#2b3f37", d: "clouds" } },
  spirit: { day: { sky: ["#ffc98f", "#fff0d6"], far: "#d9b48a", near: "#b98d5f", d: "flames" }, night: { sky: ["#2a1530", "#5a2a3a"], far: "#3d2a2a", near: "#2a1d1d", d: "flames" } },
  lake:   { day: { sky: ["#a8dcff", "#e6f7ff"], far: "#7fc6e8", near: "#6bb85a", d: "waves" }, night: { sky: ["#101d40", "#24406b"], far: "#1d4561", near: "#22402a", d: "waves" } },
  forest: { day: { sky: ["#bfe7c0", "#effbe6"], far: "#5f9f55", near: "#3f7f3a", d: "trees" }, night: { sky: ["#0f2218", "#22412c"], far: "#1d3a24", near: "#142a1a", d: "trees" } },
  mine:   { day: { sky: ["#7a5a3a", "#c49a6a"], far: "#5e4630", near: "#463322", d: "crystals" }, night: { sky: ["#1a120c", "#3a2618"], far: "#2a1e14", near: "#1d150e", d: "crystals" } },
  grave:  { day: { sky: ["#b892e0", "#f6d2c0"], far: "#7c6a90", near: "#5e4f70", d: "tombs" }, night: { sky: ["#0f0c22", "#2b1f48"], far: "#2a2240", near: "#1d1730", d: "tombs" } },
  city:   { day: { sky: ["#9fd2ff", "#fff1d6"], far: "#d8c2a0", near: "#a9c77a", d: "houses" }, night: { sky: ["#16203f", "#3e3a5e"], far: "#3a3328", near: "#26331f", d: "houses" } },
  cave:   { day: { sky: ["#4d4256", "#8a7a8f"], far: "#3e3446", near: "#2c2533", d: "crystals" }, night: { sky: ["#120e16", "#2a2230"], far: "#1e1824", near: "#14101a", d: "crystals" } },
  wheat:  { day: { sky: ["#ffd77a", "#fff4d2"], far: "#e9c45a", near: "#d4a33a", d: "wheat" }, night: { sky: ["#3a2650", "#6b4161"], far: "#5d4a2a", near: "#4a3a20", d: "wheat" } },
  beach:  { day: { sky: ["#8fe3ff", "#fff6d8"], far: "#4fc3d9", near: "#f2d896", d: "waves" }, night: { sky: ["#0f2040", "#2c4f74"], far: "#1d4d63", near: "#5c5238", d: "waves" } },
  quarry: { day: { sky: ["#ffd9a8", "#fff3e0"], far: "#c99a6b", near: "#a87a4f", d: "rocks" }, night: { sky: ["#2a1d30", "#4f3a45"], far: "#4a3a2e", near: "#352a21", d: "rocks" } },
  sewer:  { day: { sky: ["#5d6b55", "#93a283"], far: "#4a5643", near: "#3a4434", d: "pipes" }, night: { sky: ["#11160f", "#273022"], far: "#1f281b", near: "#161d13", d: "pipes" } },
  dungeon:{ day: { sky: ["#6e2420", "#c0592f"], far: "#4a2a24", near: "#33201c", d: "pillars" }, night: { sky: ["#1e0b0d", "#4a1715"], far: "#2a1513", near: "#1a0d0c", d: "pillars" } },
};
const isDark = () => true; // thème unique « Krosmoz doré »
const seeded = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let svgId = 0;
function sceneSVG(deco, H, seed) {
  const P = (DECOS[deco] || DECOS.meadow)[isDark() ? "night" : "day"]; const W = 600; const R = seeded(seed + deco);
  const r = (a, b) => a + R() * (b - a); const id = "g" + (svgId++);
  let back = "", front = "";
  const k = P.d, dark = isDark();
  if (k === "clouds") for (let i = 0; i < 5; i++) { const x = r(0, W - 60), y = r(8, H * 0.3), s = r(0.6, 1.2); back += `<g opacity="${dark ? 0.22 : 0.9}" fill="#fff" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="30" cy="16" rx="30" ry="12"/><ellipse cx="52" cy="10" rx="20" ry="11"/><ellipse cx="14" cy="10" rx="14" ry="9"/></g>`; }
  if (k === "wheat") for (let i = 0; i < 50; i++) { const x = r(0, W), y = H * 0.66 + r(-6, 10); front += `<path d="M${x} ${y + 40} q2 -22 0 -40" stroke="${P.near}" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="3.5" ry="8" fill="${dark ? "#8a6f3a" : "#f3d27a"}"/>`; }
  if (k === "tombs") for (let i = 0; i < 7; i++) { const x = r(10, W - 30), y = H * 0.62 + r(-8, 8), s = r(0.7, 1.1); front += `<g transform="translate(${x} ${y}) scale(${s})" fill="${P.far}"><path d="M0 40 V12 a14 14 0 0 1 28 0 V40Z"/><rect x="11" y="6" width="6" height="22" fill="${dark ? "#3c3156" : "#a896bd"}"/><rect x="6" y="12" width="16" height="5" fill="${dark ? "#3c3156" : "#a896bd"}"/></g>`; }
  if (k === "pillars") for (let i = 0; i < 5; i++) { const x = i * (W / 4.2) + r(-10, 10); back += `<rect x="${x}" y="24" width="34" height="${H}" fill="${P.far}"/><rect x="${x - 6}" y="18" width="46" height="12" fill="${P.near}"/><circle cx="${x + 17}" cy="74" r="7" fill="#ffb347" opacity=".9"/><circle cx="${x + 17}" cy="74" r="22" fill="#ffb347" opacity=".18"/>`; }
  if (k === "trees") for (let i = 0; i < 9; i++) { const x = r(-10, W), y = H * r(0.35, 0.55), s = r(0.7, 1.3); back += `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="10" width="8" height="40" fill="${dark ? "#2a1d12" : "#6b4a2a"}"/><circle cx="0" cy="0" r="22" fill="${P.far}"/><circle cx="-14" cy="10" r="15" fill="${P.far}"/><circle cx="14" cy="10" r="15" fill="${P.near}"/></g>`; }
  if (k === "waves") for (let i = 0; i < 4; i++) { const y = H * 0.6 + i * 9; let d = `M0 ${y}`; for (let x = 0; x <= W; x += 30) d += ` q15 ${i % 2 ? 5 : -5} 30 0`; back += `<path d="${d}" stroke="#fff" stroke-opacity="${dark ? 0.15 : 0.45}" stroke-width="2" fill="none"/>`; }
  if (k === "rocks") for (let i = 0; i < 8; i++) { const x = r(0, W), y = H * r(0.5, 0.7), s = r(0.6, 1.4); back += `<path transform="translate(${x} ${y}) scale(${s})" d="M-24 30 L-16 -6 L4 -18 L22 -2 L28 30Z" fill="${i % 2 ? P.far : P.near}" stroke="rgba(0,0,0,.15)"/>`; }
  if (k === "crystals") for (let i = 0; i < 9; i++) { const x = r(0, W), y = H * r(0.5, 0.75), s = r(0.5, 1.2), c = ["#9b7bff", "#5fd3ff", "#ff9bd8"][i % 3]; back += `<g transform="translate(${x} ${y}) scale(${s})"><circle r="26" fill="${c}" opacity=".15"/><path d="M0 -26 L9 0 L0 20 L-9 0Z" fill="${c}" opacity=".85"/></g>`; }
  if (k === "houses") for (let i = 0; i < 6; i++) { const x = i * (W / 5.5) + r(-10, 10), w = r(50, 80), hh = r(40, 70), y = H * 0.62 - hh; back += `<rect x="${x}" y="${y}" width="${w}" height="${hh + 20}" fill="${dark ? "#4a3e30" : "#efe0c4"}" stroke="rgba(0,0,0,.15)"/><path d="M${x - 6} ${y} L${x + w / 2} ${y - 26} L${x + w + 6} ${y}Z" fill="${dark ? "#5a2a20" : "#c4583a"}"/><rect x="${x + w / 2 - 7}" y="${y + hh - 8}" width="14" height="28" fill="${dark ? "#2a2117" : "#8a5d33"}"/>${dark ? `<rect x="${x + 8}" y="${y + 10}" width="10" height="10" fill="#ffd27a" opacity=".85"/>` : ""}`; }
  if (k === "flames") for (let i = 0; i < 8; i++) { const x = r(10, W - 10), y = H * r(0.2, 0.55), s = r(0.6, 1.2), c = ["#ffb347", "#ff6b5e", "#8fd0ff", "#ffe08a"][i % 4]; back += `<g transform="translate(${x} ${y}) scale(${s})"><circle r="20" fill="${c}" opacity=".18"/><path d="M0 -16 C8 -6 9 4 0 10 C-9 4 -8 -6 0 -16Z" fill="${c}" opacity=".9"/></g>`; }
  if (k === "pipes") for (let i = 0; i < 5; i++) { const x = r(0, W - 40), y = H * r(0.2, 0.5); back += `<rect x="${x}" y="${y}" width="${r(60, 140)}" height="14" rx="6" fill="${P.near}" stroke="rgba(0,0,0,.2)"/><circle cx="${x}" cy="${y + 7}" r="11" fill="${P.far}" stroke="rgba(0,0,0,.25)"/>`; }
  const stars = dark && k !== "pillars" && k !== "mine" && k !== "cave" && k !== "sewer" ? Array.from({ length: 26 }, () => `<circle cx="${r(0, W)}" cy="${r(0, H * 0.45)}" r="${r(0.3, 1.6)}" fill="#fff" opacity="${r(0.2, 0.9)}"/>`).join("") : "";
  return `<svg class="bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${id})"/>${stars}${back}
    <path d="M0 ${H * 0.64} Q ${W * 0.25} ${H * 0.5} ${W * 0.5} ${H * 0.62} T ${W} ${H * 0.57} V ${H} H0Z" fill="${P.far}"/>
    ${k === "tombs" ? front : ""}
    <path d="M0 ${H * 0.8} Q ${W * 0.3} ${H * 0.7} ${W * 0.6} ${H * 0.8} T ${W} ${H * 0.76} V ${H} H0Z" fill="${P.near}"/>
    ${k === "wheat" ? front : ""}
  </svg>`;
}
const subDeco = (sid) => (E.SUBS[sid] ? E.SUBS[sid].deco : "meadow");

/* ---------- zones : informations dérivées ---------- */
function subResources(sub) {
  const map = new Map();
  sub.monsters.forEach((k) => MONSTERS[k].drops.forEach(([n, p]) => { const e = map.get(n) || { n, p: 0, from: 0 }; e.p = Math.max(e.p, p); e.from++; map.set(n, e); }));
  return [...map.values()].sort((a, b) => b.p - a.p);
}
function subItems(sub) {
  const map = new Map();
  sub.monsters.forEach((k) => MONSTERS[k].items.forEach(([t, p]) => { if (!ITEMS[t]) return; const e = map.get(t) || { t, p: 0 }; e.p = Math.max(e.p, p); map.set(t, e); }));
  return [...map.values()].sort((a, b) => ITEMS[a.t].lvl - ITEMS[b.t].lvl);
}

/* ---------- navigation & bandeau ---------- */
function renderNav() {
  const badge = (id) => (id === "quests" && S && questAlert() ? '<span class="navdot"></span>' : "");
  $("#nav").innerHTML = S ? TABS.map(([id, n, sh]) => `<button data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}>${ICONS[id] || ICONS.ateliers}<span class="lbl-l">${n}</span><span class="lbl-s">${sh}</span>${badge(id)}</button>`).join("") : "";
}
function statusHtml() {
  if (!S) return "";
  const team = E.team(S);
  const where = S.dungeon ? DUNGEONS[S.dungeon.id].name : S.hunting && S.sub ? E.SUBS[S.sub].name : "Au repos";
  const kills = Object.values(S.bestiary).reduce((a, b) => a + b, 0);
  const xpb = E.boostPct(S, "xp");
  return `<button class="brand" data-tab="home">idlus</button>
    <span class="it"><span class="coin"></span><b class="num" id="stKamas">${fmt(S.kamas)}</b><span class="hide-sm">kamas</span></span>
    <span class="it"><span class="dot ${(S.hunting && E.team(S).length) || S.dungeon ? "" : "off"}"></span><b>${team.length}</b>/8 <span class="hide-sm">héros</span></span>
    <span class="it">📍 <span>${h(where)}</span></span>
    ${activeBoosts().length ? `<span class="it boostchip" data-tip="${h(activeBoosts().map((b) => `${b.name} : ${b.txt} (${dur(b.left)})`).join(" · "))}">${activeBoosts().map((b) => b.icon).join("")} <span id="stBoost">${dur(Math.min(...activeBoosts().map((b) => b.left)))}</span></span>` : ""}
    ${S.almanax && S.almanax.day === E.dayKey() ? `<span class="it boostchip hide-sm" data-tip="Bonus de l'Almanax jusqu'à minuit">📅 Almanax +${S.almanax.pct} %</span>` : ""}
    <span class="it hide-sm">⚔ <b class="num" id="stKills">${fmt(kills)}</b> tués</span>
    <button class="ic-btn" data-act="options" title="Options" aria-label="Options">⚙</button>`;
}
function renderStatus() { const el = $("#status"); el.innerHTML = statusHtml(); el.style.display = S ? "" : "none"; }

/* ---------- écran de départ ---------- */
function classPick(sel, sexSel) {
  return `<div class="classgrid">${CLASS_ORDER.map((id) => { const c = CLASSES[id];
    return `<button class="clsbtn" data-act="startcls" data-cls="${id}" aria-pressed="${sel === id}" data-tip="${h(c.desc + " — Passif : " + c.passive.name + " : " + c.passive.desc)}">
      <span class="emb" style="--cc:${c.color}">${headTag(id, sel === id ? sexSel : c.sex, c.name)}</span><b>${c.name}</b></button>`; }).join("")}</div>`;
}
function classInfo(id) {
  const c = CLASSES[id];
  return `<div class="clsinfo"><span class="emb" style="--cc:${c.color};width:56px;height:56px">${im(logoImg(id), "", c.name)}</span>
    <div><b style="font-size:17px">${c.name}</b><div class="small muted">${h(c.desc)}</div><div class="small" style="margin-top:4px"><span class="tag soft">Passif</span> <b>${h(c.passive.name)}</b> : ${h(c.passive.desc)}</div></div></div>`;
}
function renderStart() {
  renderStatus(); renderNav();
  const sex = ui.startSex || CLASSES[ui.startCls].sex;
  $("#main").innerHTML = `
  <section class="start stack">
    <div class="logo">idlus</div>
    <p class="muted" style="text-align:center;margin:0">Un idle inspiré de DOFUS : vos héros combattent seuls, à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.</p>
    <div class="panel"><div class="pad stack">
      <h2>Choisissez votre premier héros</h2>
      ${classPick(ui.startCls, sex)}
      ${classInfo(ui.startCls)}
      <div class="row"><span class="small muted">Apparence</span><span class="seg">${[["m", "Masculin"], ["f", "Féminin"]].map(([v, n]) => `<button data-act="startsex" data-v="${v}" aria-pressed="${sex === v}">${n}</button>`).join("")}</span></div>
      <label class="stack" style="gap:4px"><span class="small muted">Nom du héros</span><input type="text" id="startName" maxlength="20" value="${h(ui.startName || D.NAMES[Math.floor(Math.random() * D.NAMES.length)])}"></label>
      <div><button class="btn primary" data-act="startgame">Commencer l'aventure</button></div>
    </div></div>
    <details class="panel"><summary class="pad" style="cursor:pointer;font-weight:800">Reprendre une partie (importer une sauvegarde)</summary>
      <div class="pad stack" style="padding-top:0"><textarea id="imp" placeholder="Collez ici le texte de votre sauvegarde exportée"></textarea>
      <div class="row"><button class="btn sm" data-act="import">Importer</button><span id="impmsg" class="minus small"></span></div></div></details>
  </section>`;
}
/* ---------- ACCUEIL ---------- */
const BOOST_INFO = { xp: ["🍬", "Bonbon Sagesse", "+10 % XP"], drop: ["🍭", "Bonbon Prospecteur", "+10 % butin"], kamas: ["🪙", "Bonbon Doré", "+15 % kamas"], gather: ["🌾", "Bonbon Récolteur", "+15 % récolte"], archi: ["🎯", "Bonbon Traqueur", "archis ×1,5"], royal: ["👑", "Bonbon Royal", "+10 % XP/butin/kamas"] };
function activeBoosts() { return Object.keys(BOOST_INFO).filter((k) => E.boostPct(S, k) > 0).map((k) => ({ k, icon: BOOST_INFO[k][0], name: BOOST_INFO[k][1], txt: BOOST_INFO[k][2], left: E.boostLeft(S, k) })); }
/* Barre de raccourcis des consommables (combat + accueil) */
function consBar(full) {
  const owned = Object.entries(S.cons || {}).filter(([id, n]) => n > 0 && CONSUMABLES[id]);
  const act = activeBoosts();
  const items = owned.map(([id, n]) => { const C = CONSUMABLES[id];
    return `<button class="cbtn ${C.auto ? "auto" : ""}" ${C.auto ? "" : `data-act="usecons" data-id="${id}"`} data-tip="${h(`${C.name} ×${n} — ${C.desc}${C.auto ? "" : " (cliquez pour utiliser)"}`)}"><span class="ci">${C.icon}</span><b class="num">${n}</b>${C.auto ? `<i>auto</i>` : ""}</button>`; }).join("");
  return `<div class="consbar">${act.map((b) => `<span class="cact" data-tip="${h(`${b.name} : ${b.txt}`)}">${b.icon} ${h(b.txt)} <b class="num" data-boostleft="${b.k}">${dur(b.left)}</b></span>`).join("")}${S.fmShield ? `<span class="cact" data-tip="La prochaine forgemagie ne peut rien faire baisser">💎 Cristal actif</span>` : ""}
    ${items || (full ? `<span class="xs muted">Aucun consommable. Quêtes, avis de recherche, coffres et boss en donnent.</span>` : "")}</div>`;
}
function consHtml() {
  return consBar(true) + `<div class="list" style="margin-top:8px">${Object.entries(S.cons || {}).filter(([id, n]) => n > 0 && CONSUMABLES[id]).map(([id, n]) => { const C = CONSUMABLES[id]; return `<div class="li"><span class="icobox candy">${C.icon}</span><span class="grow"><span class="name">${h(C.name)}</span> <span class="num muted">×${n}</span><br><span class="xs muted">${h(C.desc)}</span></span>${C.auto ? `<span class="tag soft">automatique</span>` : `<button class="btn sm primary" data-act="usecons" data-id="${id}">${C.kind === "chest" ? "Ouvrir" : "Utiliser"}</button>`}</div>`; }).join("")}</div>`;
}
function renderHome() {
  renderHomeInner();
  if (ui.home !== "havre") $("#main").insertAdjacentHTML("beforeend", `<section class="panel discordcard"><div class="pad row"><span class="dico">💬</span><span class="grow"><b>Rejoignez la communauté idlus sur Discord</b><br><span class="small muted">Annonces des mises à jour, aide, builds, et vos idées pour la suite du jeu.</span></span><a class="btn primary" href="${DISCORD}" target="_blank" rel="noopener">Rejoindre</a></div></section>`);
}
function renderHomeInner() {
  const team = E.team(S); const main = team[0] || S.chars[0];
  const deco = S.dungeon ? "dungeon" : S.sub ? subDeco(S.sub) : "sky";
  const act = S.dungeon ? `En donjon : <b>${h(DUNGEONS[S.dungeon.id].name)}</b> · salle ${Math.min(S.dungeon.room + 1, DUNGEONS[S.dungeon.id].rooms.length + 1)}/${DUNGEONS[S.dungeon.id].rooms.length + 1}`
    : !team.length ? `Tous vos héros récoltent. Rappelez-en un dans Métiers pour chasser.` : S.hunting && S.sub ? `Chasse en cours : <b>${h(E.SUBS[S.sub].name)}</b>` : `Votre équipe se repose. Choisissez une zone pour partir chasser.`;
  const zkey = S.dungeon ? null : S.sub; const rate = zkey ? E.zoneRate(S, zkey) : null;
  const archis = Object.values(S.archis).reduce((a, b) => a + b, 0);
  const tabs = `<nav class="subtabs">${[["apercu", "Aperçu"], ["havre", "Havre-Sac"]].map(([id, n]) => `<button data-act="hometab" data-v="${id}" aria-pressed="${ui.home === id}">${n}</button>`).join("")}</nav>`;
  if (ui.home === "havre") { $("#main").innerHTML = tabs + havreHtml(); return; }
  const q = E.questStep(S); const qp = E.questProgress(S); const A = E.almanax(S);
  $("#main").innerHTML = tabs + `
  <section class="hero-banner">
    <div class="scene">${sceneSVG(deco, 220, "home" + (S.sub || ""))}<div class="troupe" style="justify-content:flex-end;padding-right:5%">${team.map((c) => `<span class="ent hero" style="width:clamp(54px,10vw,80px)"><span class="medal" style="--cc:${CLASSES[c.cls].color}">${headTag(c.cls, c.sex, c.name)}</span></span>`).join("")}</div></div>
    <div class="inner">
      <div class="card"><h1>Bonjour ${h(main.name)} !</h1><div class="small" style="margin-top:4px">${act}</div></div>
      <div class="row">${S.hunting || S.dungeon ? `<button class="btn primary" data-tab="combat">⚔ Voir le combat</button>${S.dungeon ? "" : `<button class="btn" data-act="stophunt">Rentrer</button>`}` : `<button class="btn primary" data-tab="world">🗺 Choisir une zone</button>`}</div>
    </div>
  </section>
  <section class="panel" style="margin-top:14px"><div class="phead"><h2>Vos héros</h2>${fsGauge()}</div><div class="cardrow" style="padding-left:14px">${S.chars.map((c) => heroCard(c, "sm")).join("")}</div></section>
  <section class="grid2" style="margin-top:14px">
    <div class="panel"><div class="phead"><h2>Quête</h2><button class="btn sm" data-tab="quests">Toutes les quêtes</button></div><div class="pad stack" style="gap:8px">
      ${q ? `<div><b>${h(q.title)}</b><div class="small muted">${h(q.txt)}</div><div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div></div>` : `<p class="note">Quête principale terminée. Bravo, Héros d'Amakna !</p>`}
      <div class="small">📜 Avis de recherche : ${(S.bounties || []).map((b) => `<span class="tag soft">${h(MONSTERS[b.key].name)} ${b.prog}/${b.n}</span>`).join(" ") || "aucun"}</div>
      <div class="small">📅 Almanax : ${A.done ? `<span class="tag good">offrande faite · ${h(A.bonus.name)}</span>` : `${A.qty} × ${h(A.res)} → ${h(A.bonus.name)} <button class="btn sm" data-act="goquest" data-v="almanax">Offrir</button>`}</div></div></div>
    <div class="panel"><div class="phead"><h2>Rendement${zkey ? " · " + h(E.SUBS[zkey].name) : ""}</h2></div><div class="pad">${rateHtml(rate)}</div></div>
  </section>
  <section class="kpis" style="margin:14px 0">
    <div class="kpi"><b class="num">${Math.max(...S.chars.map((c) => c.lvl))}</b><span>niveau max</span></div>
    <div class="kpi"><b class="num">${fmt(S.stats.wins)}</b><span>victoires</span></div>
    <div class="kpi"><b class="num" style="color:var(--archi)">${archis}</b><span>archimonstres vaincus</span></div>
    <div class="kpi"><b class="num" style="color:var(--gold)">${S.radiants || 0}</b><span>objets rayonnants</span></div>
    <div class="kpi"><b class="num">${Object.keys(S.ach || {}).length}/${E.ACH.length}</b><span>succès</span></div>
    <div class="kpi"><b class="num">${E.havreTotal(S)}</b><span>améliorations du Havre-Sac</span></div>
  </section>
  <section class="grid2">
    <div class="panel"><div class="phead"><h2>Consommables</h2></div><div class="pad">${consBar(true)}</div></div>
    <div class="panel"><div class="phead"><h2>Derniers combats</h2></div><div class="pad">${historyHtml(6)}</div></div>
  </section>
  ${S.shop.length ? `<section class="panel" style="margin-top:14px"><div class="phead"><h2>🛒 Liste de courses</h2></div><div class="pad stack" style="gap:8px">${shopListHtml()}</div></section>` : ""}
  <section class="panel" style="margin-top:14px"><div class="phead"><h2>Journal</h2></div><div class="list journal">${S.journal.slice(0, 10).map((j) => `<div class="li k-${j.kind}"><span class="grow">${h(j.txt)}</span><span class="xs muted">${ago(j.t)}</span></div>`).join("") || `<div class="empty">Rien pour l'instant.</div>`}</div></section>`;
}
function havreHtml() {
  return `<section class="panel"><div class="phead"><h2>🏠 Havre-Sac</h2><span class="small"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b> kamas</span></div>
    <div class="pad stack"><p class="note">Votre refuge personnel. Chaque amélioration est permanente et s'applique à toute l'équipe ; son prix augmente à chaque niveau.</p>
    <div class="hvgrid">${E.HAVRE.map((H) => { const l = E.havreLvl(S, H.id); const cost = E.havreCost(S, H.id); const max = l >= H.max;
      return `<div class="hv"><div class="top"><span class="em">${H.icon}</span><div class="grow"><b>${h(H.name)}</b><div class="xs muted">+${H.per}${h(H.unit)} par niveau</div></div><span class="lvlpill">${l}/${H.max}</span></div>
        <div class="small">Actuel : <b class="plus">+${fmt(l * H.per)}${h(H.unit.split(" (")[0])}</b></div>
        <div class="pipsbar">${Array.from({ length: Math.min(H.max, 50) }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</div>
        <button class="btn sm ${!max && S.kamas >= cost ? "primary" : ""}" data-act="havre" data-id="${H.id}" ${max || S.kamas < cost ? "disabled" : ""}>${max ? "Maximum" : `Améliorer · ${fmt(cost)} k`}</button></div>`; }).join("")}</div></div></section>
    <section class="panel" style="margin-top:14px"><div class="phead"><h2>🪑 Meubles en attente</h2><span class="xs muted">ils prendront place dans le Havre-Sac lors de la mise à jour « housing »</span></div><div class="pad">${S.furniture.length ? `<div class="row">${S.furniture.map((f) => `<span class="tag soft">🪑 ${h(f)}</span>`).join("")}</div>` : `<p class="note">Aucun meuble pour l'instant : la quête principale, la série d'Almanax et le Comptoir de la cité en donnent.</p>`}</div></section>`;
}
function rateHtml(rate) {
  if (!rate) return `<p class="note">Les statistiques apparaissent après quelques combats dans une zone : XP, kamas et ressources par heure, pour comparer les zones.</p>`;
  return `<div class="rates">
    <div class="rate"><b class="num">${fmt(rate.xpH)}</b><span>XP / heure</span></div>
    <div class="rate"><b class="num">${fmt(rate.kH)}</b><span>kamas / heure</span></div>
    <div class="rate"><b class="num">${fmt(rate.rH)}</b><span>ressources / h</span></div>
    <div class="rate"><b class="num">${Math.round(rate.winRate * 100)} %</b><span>victoires (${rate.fights} combats)</span></div></div>`;
}
function historyHtml(n) {
  const rows = S.history.slice(0, n);
  if (!rows.length) return `<p class="note">Aucun combat pour l'instant.</p>`;
  return `<div class="hist">${rows.map((r) => `<div class="hrow"><span class="${r.w ? "w" : "l"}">${r.w ? "Victoire" : "Défaite"}</span><span class="z">${h(r.label)} <span class="muted xs num">${r.d} s</span></span><span class="x xs muted">${r.w ? `+${fmt(r.xp)} XP · ${fmt(r.k)} k · ${r.r} res.${r.i ? ` · ${r.i} obj.` : ""}` : ""}</span></div>`).join("")}</div>`;
}

/* ---------- MONDE ---------- */
function renderWorld() {
  if (ui.zoneView) return renderZoneView(ui.zoneView);
  const tabs = [["map", "Carte"], ["dungeons", "Donjons"], ["enc", "Encyclopédie"]];
  let body = "";
  if (ui.world === "map") body = ZONES.map(zonePanel).join("");
  else if (ui.world === "dungeons") body = dungeonsHtml();
  else body = encyclopediaHtml();
  $("#main").innerHTML = `<div class="pagehead"><h1>Le Monde des Douze</h1>${S.dungeon ? `<span class="tag warn">En donjon</span>` : ""}</div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="worldtab" data-v="${id}" aria-pressed="${ui.world === id}">${n}</button>`).join("")}</nav>
    <div class="stack">${body}</div>`;
}
function lockReason(sid) {
  const s = E.SUBS[sid]; const z = ZONES.find((x) => x.id === s.zone);
  if (!E.zoneUnlocked(S, z.id)) return `Battez ${MONSTERS[DUNGEONS[z.requires.boss].boss].name} (${DUNGEONS[z.requires.boss].name})`;
  if (s.requiresItem) return `Il faut : ${s.requiresItem} (Bricoleur)`;
  return "";
}
function topTeamLvl() { const t = E.team(S); return Math.max(...(t.length ? t : S.chars).map((c) => c.lvl)); }
function lvlHint(s) {
  const top = topTeamLvl();
  const cls = top < s.lvl[0] - 3 ? "minus" : top > s.lvl[1] + 4 ? "muted" : "plus";
  const pen = Math.round((1 - E.xpPenalty(top - s.lvl[1])) * 100);
  return `<span class="xs ${cls}" data-tip="Niveau conseillé selon les monstres de la zone. Votre meilleur héros est niveau ${top}.${pen ? ` Monstres trop faibles : expérience réduite de ${pen} %.` : ""}">Conseillé : niv. ${s.lvl[0]}–${s.lvl[1]}</span>${pen ? ` <span class="xppen" data-tip="Votre meilleur héros (niv. ${top}) dépasse le niveau des monstres de plus de 4 : −10 % d'XP par niveau d'écart.">XP −${pen} %</span>` : ""}`;
}
function tierBadge(k) {
  const t = E.huntTier(S, k); const n = S.bestiary[k] || 0; const next = HUNT_TIERS[t + 1];
  return `<div class="tierline" data-tip="${h(HUNT_TIERS.map((x, i) => `${i <= t ? "✓" : "·"} ${x.name} (${x.n}) : ${x.desc}`).join(" | "))}">
    ${t >= 0 ? `<span class="tier t${t}">${HUNT_TIERS[t].name}</span>` : `<span class="tier">Aucun palier</span>`}
    ${next ? `<span class="bar"><i style="width:${pct(n, next.n)}%"></i></span><span class="xs muted num">${fmt(n)}/${fmt(next.n)}</span>` : `<span class="xs muted">max</span>`}</div>`;
}
function zonePanel(z) {
  const zu = E.zoneUnlocked(S, z.id);
  return `<section class="panel"><div class="zonehead"><div><h2>${h(z.name)}</h2><div class="small muted">${h(z.desc)} · niveaux ${h(z.lvl)}</div></div>${zu ? "" : `<span class="tag soft">🔒 ${h(lockReason(z.subs[0].id))}</span>`}</div>
    <div class="subgrid">${z.subs.map((s) => {
      const un = E.subUnlocked(S, s.id); const here = S.hunting && S.sub === s.id && !S.dungeon;
      if (s.hidden && !un) return `<div class="subcard locked"><div class="scene">${sceneSVG("cave", 96, s.id)}</div><div class="body"><b>Lieu caché</b><span class="lockmsg">On raconte qu'un objet permet de rapetisser… (${h(s.requiresItem)}, Bricoleur)</span></div></div>`;
      const wins = S.progress.wins[s.id] || 0;
      return `<button class="subcard ${un ? "" : "locked"} ${here ? "here" : ""}" data-act="zoneview" data-id="${s.id}">
        <div class="scene">${sceneSVG(s.deco, 96, s.id)}<div class="troupe">${s.monsters.slice(0, 4).map((k) => im(imgM(k), "", MONSTERS[k].name)).join("")}</div>${S.trophies && S.trophies[s.id] ? `<span class="trophymark" data-tip="Trophée obtenu">🏆</span>` : ""}</div>
        <div class="body"><div class="row between"><b>${h(s.name)}</b>${lvlHint(s)}</div>
          ${here ? `<span class="tag good" style="align-self:flex-start">Chasse en cours</span>` : un ? `<span class="xs muted">${wins} victoire${wins > 1 ? "s" : ""}${s.dungeon ? " · donjon" : ""}</span>` : `<span class="lockmsg">🔒 ${h(lockReason(s.id))}</span>`}</div>
      </button>`; }).join("")}</div></section>`;
}
function renderZoneView(sid) {
  const s = E.SUBS[sid]; const z = ZONES.find((x) => x.id === s.zone); const un = E.subUnlocked(S, sid);
  const here = S.hunting && S.sub === sid && !S.dungeon;
  const res = subResources(s); const its = subItems(s); const rate = E.zoneRate(S, sid);
  const dg = s.dungeon ? DUNGEONS[s.dungeon] : null;
  const trophyDone = S.trophies && S.trophies[sid]; const traq = s.monsters.filter((k) => E.huntTier(S, k) >= 1).length;
  $("#main").innerHTML = `
  <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="zoneback">← Carte</button></div>
  <section class="panel">
    <div class="scene" style="height:210px">${sceneSVG(s.deco, 210, s.id)}<div class="crumb">${h(z.name)}<span class="title">${h(s.name)}</span>Niveau conseillé : ${s.lvl[0]} – ${s.lvl[1]}</div>
      <div class="troupe">${s.monsters.map((k) => im(imgM(k), "", MONSTERS[k].name)).join("")}</div></div>
    <div class="pad stack">
      <div class="row">${!un ? `<span class="tag soft">🔒 ${h(lockReason(sid))}</span>` : here ? `<button class="btn" data-act="stophunt">Rentrer au repos</button><button class="btn primary" data-tab="combat">Voir le combat</button>` : `<button class="btn primary" data-act="hunt" data-id="${sid}" ${S.dungeon ? "disabled" : ""}>⚔ Partir chasser</button>`}
        <span class="small muted">${E.team(S).length} héros · Esprit Libre +${E.freeSpirit(S)} % · ${lvlHint(s)}</span></div>
      ${rate ? `<div>${rateHtml(rate)}</div>` : ""}
      <div><div class="row between small"><span data-tip="Quand tous les monstres de la zone atteignent le palier Traqueur (250 tués), vous recevez le trophée de la zone, à équiper dans un emplacement Dofus/Trophée.">🏆 Trophée ${h(s.name)}${trophyDone ? " : obtenu" : ""}</span><span class="num">${traq}/${s.monsters.length} monstres Traqueur</span></div><div class="bar"><i style="width:${pct(traq, s.monsters.length)}%"></i></div></div>
      <h3 class="sec">Monstres</h3>
      <div class="mons">${s.monsters.map((k) => monCard(k)).join("")}</div>
      <h3 class="sec">Ressources</h3>
      <div class="loot">${res.map((r) => `<div class="lcard">${im(resImg(r.n), "ico", r.n)}<div><div class="n">${h(r.n)}</div><div class="p"><span class="pct">${r.p} %</span> · ${r.from} monstre${r.from > 1 ? "s" : ""}${S.res[r.n] ? ` · <span class="num">${fmt(S.res[r.n])}</span> en stock` : ""}</div></div></div>`).join("") || `<div class="note">Aucune ressource.</div>`}</div>
      ${its.length ? `<h3 class="sec">Équipements à looter</h3><div class="loot">${its.map((e) => `<div class="lcard"><span class="icobox">${im(itemImg(e.t), "", ITEMS[e.t].name)}</span><div><div class="n">${h(ITEMS[e.t].name)}</div><div class="p">niv. ${ITEMS[e.t].lvl} · <span class="pct">${(e.p * E.ITEM_DROP_SCALE).toFixed(2).replace(".", ",")} %</span></div></div></div>`).join("")}</div>` : ""}
      ${dg ? `<h3 class="sec">Donjon</h3>${dungeonCard(s.dungeon)}` : ""}
    </div>
  </section>`;
}
function monCard(k, opts = {}) {
  const m = MONSTERS[k]; const kills = S.bestiary[k] || 0;
  const archiKey = m.archi; const archiMet = archiKey && S.archis[archiKey];
  return `<div class="mcard ${m.boss ? "boss" : ""} ${opts.unknown ? "unknown" : ""}">${im(imgM(k), "mimg", m.name)}
    <div style="min-width:0"><div class="n">${opts.unknown ? "???" : h(m.name)} ${m.boss ? `<span class="tag boss">Boss</span>` : ""}</div>
    <div class="l">niv. <span class="num">${m.lvl[0]}${m.lvl[1] !== m.lvl[0] ? "–" + m.lvl[1] : ""}</span> ${eld(m.el)} ${kills ? `· <span class="num">${fmt(kills)}</span> tués` : ""}</div>
    <div class="res" style="margin-top:3px">${resChips(m.res)}</div>
    ${archiKey ? `<div class="xs" style="margin-top:3px;color:var(--archi)">Archi : ${archiMet ? h(MONSTERS[archiKey].name) + ` ×${S.archis[archiKey]}` : "???"}</div>` : ""}</div></div>`;
}
function dungeonCard(did) {
  const dg = DUNGEONS[did]; const un = E.dungeonUnlocked(S, did); const keys = S.res[dg.key] || 0; const kills = S.progress.bossKills[did] || 0;
  const R = SPECIAL_CRAFTS[dg.key];
  return `<div class="mcard" style="align-items:flex-start">${im(imgM(dg.boss), "mimg", MONSTERS[dg.boss].name)}
    <div class="grow stack" style="gap:6px"><div class="row between"><div><b>${h(dg.name)}</b><div class="xs muted">Boss ${h(MONSTERS[dg.boss].name)} · niv. ${dg.lvl} · ${dg.rooms.length + 1} salles${kills ? ` · vaincu ${kills} fois` : ""}</div></div>
      <button class="btn sm ${keys && un ? "primary" : ""}" data-act="enterdg" data-id="${did}" ${keys && un && !S.dungeon ? "" : "disabled"}>Entrer</button></div>
      <div class="small row">${im(resImg(dg.key), "ico sm", dg.key)} ${h(dg.key)} : <b class="num">${keys}</b></div>
      ${R ? `<div class="xs muted">Recette (Bricoleur) :</div>${ingHtml(R.ing)}` : ""}
      ${un ? "" : `<div class="xs muted">🔒 Débloquez ${h(E.SUBS[E.DUNGEON_SUB[did]].name)} pour y accéder.</div>`}</div></div>`;
}
function dungeonsHtml() {
  return `<section class="panel"><div class="pad stack">${Object.keys(DUNGEONS).sort((a, b) => DUNGEONS[a].lvl - DUNGEONS[b].lvl).map(dungeonCard).join("")}</div></section>`;
}
function encyclopediaHtml() {
  const z = ZONES.find((x) => x.id === ui.encZone) || ZONES[0];
  const total = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].archiOf).length; const met = Object.keys(S.bestiary).filter((k) => MONSTERS[k] && !MONSTERS[k].archiOf).length;
  const subs = z.subs.map((s) => `<h3 class="sec">${h(s.name)} ${S.trophies && S.trophies[s.id] ? "🏆" : ""}</h3><div class="mons">${s.monsters.map((k) => encCard(k)).join("")}</div>`).join("");
  const dgs = Object.entries(DUNGEONS).filter(([id]) => E.SUBS[E.DUNGEON_SUB[id]]?.zone === z.id).map(([id, d]) => `<h3 class="sec">${h(d.name)}</h3><div class="mons">${encCard(d.boss)}</div>`).join("");
  const fams = Object.entries(E.RACE_MONS).map(([r, ks]) => { const done = S.families && S.families[r]; const n = ks.filter((k) => E.huntTier(S, k) >= 1).length;
    return `<div class="famrow ${done ? "done" : ""}"><b>${h(D.RACES[r] || r)}</b><span class="xs muted num">${n}/${ks.length} Traqueur</span>${done ? `<span class="tag good">+5 Vi</span>` : ""}</div>`; }).join("");
  return `<section class="panel"><div class="phead"><h2>Bestiaire</h2><span class="small muted num">${met}/${total} monstres rencontrés</span></div>
    <div class="pad"><div class="seg">${ZONES.map((x) => `<button data-act="enczone" data-v="${x.id}" aria-pressed="${x.id === z.id}">${h(x.name)}</button>`).join("")}</div>
    <p class="note" style="margin-top:8px">Paliers de chasse par monstre : ${HUNT_TIERS.map((t) => `<b>${t.name}</b> (${t.n}) ${t.desc.toLowerCase()}`).join(" · ")}.</p>${subs}${dgs}</div></section>
  <section class="panel"><div class="phead"><h2>Familles</h2><span class="xs muted">tous les monstres d'une famille au palier Traqueur : +5 Vitalité pour tous vos héros</span></div><div class="pad famgrid">${fams}</div></section>`;
}
function encCard(k) {
  const m = MONSTERS[k]; const kills = S.bestiary[k] || 0; const seen = S.seenDrops[k] || {}; const a = m.archi; const t = E.huntTier(S, k);
  const reveal = t >= 0;
  const drops = m.drops.map(([n, p]) => seen[n] || reveal ? `<span class="dropico" data-tip="${h(n)} · ${p} %">${im(resImg(n), "ico sm", n)}${reveal ? `<span class="xs">${p}%</span>` : ""}</span>` : `<span class="icobox" style="width:26px;height:26px;font-size:12px;color:var(--muted)" data-tip="Butin inconnu : obtenez-le une fois ou atteignez le palier Connaisseur">?</span>`).join("");
  return `<div class="mcard ${kills ? "" : "unknown"}" style="align-items:flex-start">${im(imgM(k), "mimg", m.name)}
    <div style="min-width:0;flex:1" class="stack"><div><div class="n">${kills ? h(m.name) : "???"}</div><div class="l">niv. ${m.lvl[0]}–${m.lvl[1]}${m.race !== undefined && D.RACES[m.race] ? ` · ${h(D.RACES[m.race])}` : ""}</div></div>
    ${m.boss ? `<div class="xs muted num">${fmt(kills)} vaincu${kills > 1 ? "s" : ""}</div>` : tierBadge(k)}
    <div class="row" style="gap:4px">${drops}</div>
    ${a ? `<div class="xs" style="color:var(--archi)">Archimonstre : ${S.archis[a] ? h(MONSTERS[a].name) + ` (×${S.archis[a]})` : "non rencontré"}</div>` : ""}</div></div>`;
}
/* ---------- COMBAT ---------- */
function renderCombat() {
  const team = E.team(S); const fs = E.freeSpirit(S);
  const dg = S.dungeon ? DUNGEONS[S.dungeon.id] : null; const sub = S.sub ? E.SUBS[S.sub] : null;
  if (!ui.combatCid || !team.find((c) => c.id === ui.combatCid)) ui.combatCid = team[0] && team[0].id;
  const title = dg ? dg.name : S.hunting && sub ? sub.name : "Aucun combat";
  $("#main").innerHTML = `
  <div class="pagehead"><div><div class="small muted">${dg ? `Donjon · salle ${Math.min(S.dungeon.room + 1, dg.rooms.length + 1)} sur ${dg.rooms.length + 1}` : sub && S.hunting ? `${h(ZONES.find((z) => z.id === sub.zone).name)} · niv. ${sub.lvl[0]}–${sub.lvl[1]}` : "Votre équipe se repose"}</div><h1>${h(title)}</h1></div>
    <div class="row">${fsGauge()}<span class="seg mantoggle" data-tip="Mode manuel : à chaque tour d'un héros, choisissez le sort puis la cible. Sans action pendant ${E.MANUAL_TIMEOUT} s, ou si vous quittez cet écran, le combat repasse en automatique. Aucun bonus : c'est pour le plaisir !">${[[false, "Auto"], [true, "Manuel"]].map(([v, n]) => `<button data-act="manual" data-v="${v ? 1 : 0}" aria-pressed="${!!S.settings.manual === v}">${n}</button>`).join("")}</span>
      ${!dg && S.hunting ? `<label class="azchip" data-tip="Change de sous-zone automatiquement selon le niveau de l'équipe : monte quand tout se passe bien, redescend après plusieurs défaites."><input type="checkbox" data-act="autozone" ${S.settings.autoZone ? "checked" : ""}> Suivre mon niveau</label>` : ""}
      ${dg ? `<button class="btn sm danger" data-act="leavedg">Quitter le donjon</button>` : S.hunting ? `<button class="btn sm" data-act="stophunt">Rentrer</button>` : ""}</div></div>
  <section class="grid2 combatgrid">
    <div class="panel">
      <div class="arena" id="arena"></div>
      <div class="chalbar" id="chalbar"></div>
      <div class="pad" style="padding-bottom:0" id="cbar">${consBar(false)}</div>
      <div id="await"></div>
      <div class="herotabs">${team.map((c) => `<button data-act="combatcid" data-id="${c.id}" aria-pressed="${ui.combatCid === c.id}">${head(c)}${h(c.name)}</button>`).join("")}</div>
      <div class="pabar">PA <span class="pips" id="pips"></span><span style="margin-left:auto">Stratégie : <b id="stratName" style="color:var(--ink)">—</b> <button class="btn sm" data-act="gospells">Modifier</button></span></div>
      <div class="spells" id="spells"></div><div class="spnames" id="spnames"></div>
      <div class="log" id="flog"></div>
    </div>
    <div class="stack">
      <div class="panel"><div class="phead"><h2>Butin</h2><span class="small muted" id="fres"></span></div><div class="pad" id="floot"></div></div>
      <div class="panel"><div class="phead"><h2>Derniers combats</h2></div><div class="pad" id="fhist">${historyHtml(6)}</div></div>
    </div>
  </section>
`;
  ui.arena = null; updateCombat(true);
}
function spellTip(sp, lvl) { const g = E.spellGrade(sp, lvl || 200); return `${sp.name} · ${g.pa} PA${g.cd ? ` · relance ${g.cd} tour${g.cd > 1 ? "s" : ""}` : ""}${g.casts ? ` · ${g.casts} lancer${g.casts > 1 ? "s" : ""}/tour` : ""} — ${spellDesc(sp, lvl).replace(/<[^>]+>/g, "").trim()}`; }
const spEl = (sp) => (sp.el && sp.el !== "best" ? sp.el : sp.el === "best" ? "n" : "buff");
function spellBarFor(c, ent, F) {
  const N = E.spellSlots(c); const slots = c.spells.slice(0, N);
  const A = F && F.await && ent && F.ents[F.await.ei] === ent ? F.await : null;
  const lastCast = {};
  if (F && ent) { const idx = F.ents.indexOf(ent); F.fx.forEach((f) => { if (f.k === "cast" && f.s === idx) lastCast[f.sp] = f.seq; }); }
  const html = Array.from({ length: N }, (_, i) => {
    const x = slots[i]; if (!x) return `<div class="sp empty"></div>`;
    const sp = E.spellDef(c.cls, x.id); if (!sp) return `<div class="sp empty"></div>`; const g = E.spellGrade(sp, c.lvl); const cd = ent && ent.cd ? (ent.cd[sp.id] || 0) : 0;
    const cast = F && lastCast[sp.id] !== undefined && F.seq - lastCast[sp.id] <= 1;
    const can = A ? E.manualCanCast(S, sp) : false;
    return `<div class="sp ${cast ? "cast" : ""} ${A ? (can ? "can" : "no") : ""} ${A && ui.manualSpell === sp.id ? "sel" : ""}" style="--c:${elVar(spEl(sp))}" data-tip="${h(spellTip(sp, c.lvl))}" ${A && can ? `data-act="mspell" data-id="${sp.id}"` : ""}>${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : `<span class="glyph">✦</span>`}<span class="pa">${g.pa}</span>${cd > 1 ? `<span class="cd">${cd - 1}</span>` : ""}</div>`;
  }).join("");
  return { html, names: Array.from({ length: N }, (_, i) => `<div>${slots[i] && E.spellDef(c.cls, slots[i].id) ? h(E.spellDef(c.cls, slots[i].id).name) : ""}</div>`).join("") };
}
function buildArena(F) {
  const arena = $("#arena"); if (!arena) return;
  const deco = F && F.dungeon ? "dungeon" : subDeco(F ? F.sub : S.sub);
  ui.arena = { el: arena, fid: F ? F.id : null, nodes: [], lastSeq: 0, lastLog: -1, over: false, theme: isDark() };
  if (!F) {
    arena.innerHTML = sceneSVG(S.sub ? deco : "sky", 270, "arena" + (S.sub || "")) + `<div class="idle"><div>${S.hunting || S.dungeon ? "Recherche d'un groupe de monstres…" : `Votre équipe se repose.<br><button class="btn primary sm" data-tab="world" style="margin-top:8px">Choisir une zone</button>`}</div></div>`;
    return;
  }
  const side = (s) => F.ents.map((e, i) => [e, i]).filter(([e]) => e.side === s);
  const entHtml = ([e, i]) => {
    if (e.summon) return `<div class="ent hero summon" data-i="${i}" data-act="mtarget" data-tip="${h(e.name)} (invocation)"><div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div>${e.img ? im(`assets/m/${e.img}.png`, "sprite", e.name) : `<span class="medal">✦</span>`}</div>`;
    if (e.side === "c") { const c = char(e.cid) || { cls: e.cls, sex: "m", name: e.name };
      const cst = c.id ? E.charStats(S, c) : null; const rad = c.id ? E.radiantWorn(S, c) : 0;
      return `<div class="ent hero ${rad ? "radiant" : ""}" data-i="${i}" data-act="mtarget" style="--el:${cst ? elVar(E.domEl(cst)) : "transparent"}"><div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div><div class="medal" style="--cc:${CLASSES[e.cls].color}">${im(headImg(c), "", e.name)}</div></div>`; }
    return `<div class="ent ${e.archi ? "archi" : ""} ${e.boss ? "boss" : ""}" data-i="${i}" data-act="mtarget" data-tip="${h(e.name)} niv. ${e.lvl}"><div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div>${im(`assets/m/${e.img}.png`, "sprite", e.name)}</div>`;
  };
  arena.innerHTML = sceneSVG(deco, 270, F.dungeon ? "dg" + F.label : "arena" + F.sub) + `<div class="turn" id="turn">${h(F.label)}</div>
    <div class="side l">${side("c").map(entHtml).join("")}</div><div class="side r">${side("m").map(entHtml).join("")}</div><div class="result" id="fresult"></div>`;
  arena.querySelectorAll(".ent").forEach((n) => (ui.arena.nodes[+n.dataset.i] = n));
  ui.arena.entHtml = entHtml; ui.arena.nEnts = F.ents.length;
}
/* bandeau des challenges et mécaniques de boss */
function chalBarHtml(F) {
  const tog = `<label class="chaltog" data-tip="Si coché, l'IA évite les actions qui feraient échouer les challenges (un héros peut être exclu dans ses sorts)."><input type="checkbox" data-act="chalai" ${S.settings.chalAI ? "checked" : ""}> 🎯 Respecter</label>`;
  if (!F) return "";
  const ch = (F.chals || []).map((c) => { const C = E.CHALLENGES[c.id]; const done = F.over;
    const state = !c.ok ? "ko" : done && F.result === "win" ? "ok" : "run";
    const extra = c.id === "rapide" ? ` (${c.turns} tours)` : c.id === "elitiste" && F.ents[c.target] ? ` : ${F.ents[c.target].name}` : "";
    return `<span class="chal ${state}" data-tip="${h(C.desc + (c.why ? " — échoué : " + c.why : ""))}">${state === "ko" ? "✕" : state === "ok" ? "✓" : "🎯"} ${h(C.name)}${h(extra)} <b>+${c.bonus} %</b></span>`; }).join("");
  const boss = F.ents.find((e) => e.boss && e.mech); const mech = boss ? `<span class="mech" data-tip="${h(boss.mech.map((m) => E.BOSS_MECHS[m].name + " : " + E.BOSS_MECHS[m].desc).join(" · "))}">⚠ ${boss.mech.map((m) => h(E.BOSS_MECHS[m].name)).join(", ")}</span>` : "";
  const streak = S.chalStreak > 1 ? `<span class="xs muted">série ×${S.chalStreak}</span>` : "";
  return `${ch}${streak}${mech}<span style="margin-left:auto"></span>${tog}`;
}
function floatAt(node, txt, color, small) {
  const s = document.createElement("span"); s.className = "float" + (small ? " small" : ""); s.textContent = txt; s.style.setProperty("--c", color);
  node.appendChild(s); setTimeout(() => s.remove(), 1150);
}
function burst(node, el) {
  if (S.settings.reduced) return;
  const b = document.createElement("span"); b.className = "fxb " + el;
  const n = el === "t" ? 9 : 8;
  for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n + Math.random() * 0.6; const r = 26 + Math.random() * 22; const p = document.createElement("i");
    p.style.setProperty("--dx", Math.cos(a) * r + "px"); p.style.setProperty("--dy", (Math.sin(a) * r - (el === "f" ? 18 : 0)) + "px"); p.style.setProperty("--rot", Math.round(Math.random() * 360) + "deg"); p.style.animationDelay = Math.random() * 0.08 + "s"; b.appendChild(p); }
  const ring = document.createElement("span"); ring.className = "ring"; ring.style.setProperty("--c", el === "h" ? "#7ee06a" : elVar(el));
  node.appendChild(b); node.appendChild(ring); setTimeout(() => { b.remove(); ring.remove(); }, 800);
}
function pulse(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function updateCombat(force) {
  const F = S.fight; const arena = $("#arena"); if (!arena) return;
  if (!ui.arena || ui.arena.el !== arena || ui.arena.fid !== (F ? F.id : null) || ui.arena.theme !== isDark()) buildArena(F);
  const A = ui.arena;
  if (F && A.nEnts !== undefined && F.ents.length > A.nEnts) {
    for (let i = A.nEnts; i < F.ents.length; i++) { const e = F.ents[i]; const side = A.el.querySelector(e.side === "c" ? ".side.l" : ".side.r"); if (!side) continue;
      side.insertAdjacentHTML("beforeend", A.entHtml([e, i])); A.nodes[i] = side.lastElementChild; }
    A.nEnts = F.ents.length;
  }
  const cb = $("#chalbar"); if (cb) { const ch = chalBarHtml(F); if (cb.dataset.k !== ch) { cb.innerHTML = ch; cb.dataset.k = ch; } }
  if (F) {
    F.ents.forEach((e, i) => {
      const n = A.nodes[i]; if (!n) return;
      n.querySelector(".hpb i").style.width = pct(e.hp, e.hpMax) + "%";
      n.querySelector(".hpb b").style.transform = `scaleX(${Math.min(1, (e.shield || 0) / e.hpMax)})`;
      n.classList.toggle("dead", !e.alive);
    });
    // mode manuel : héros à qui c'est le tour, cibles possibles
    const AW = F.await && !F.over ? F.await : null; const aw = $("#await");
    if (AW) {
      const me = F.ents[AW.ei]; if (me && ui.combatCid !== me.cid) { ui.combatCid = me.cid; document.querySelectorAll(".herotabs button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.id === me.cid)); }
      const spd = ui.manualSpell ? E.spellDef(me.cls, ui.manualSpell) : null;
      const spk = spd ? E.spellKind(E.spellGrade(spd, me.lvl)) : null;
      const wantAlly = spk === "heal"; const wantFoe = ["dmg", "drain", "dot", "aoe"].includes(spk);
      F.ents.forEach((e, i) => { const n = A.nodes[i]; if (!n) return; n.classList.toggle("targetable", !!(e.alive && ((wantFoe && e.side === "m") || (wantAlly && e.side === "c")))); n.classList.toggle("turnnow", i === AW.ei); });
      const left = Math.max(0, Math.ceil(E.MANUAL_TIMEOUT - (F.dur - AW.t)));
      const html = `<div class="awaitbar">🎯 À vous : <b>${h(me.name)}</b> · ${AW.pa} PA · ${spd ? (wantFoe || wantAlly ? `choisissez ${wantAlly ? "un allié" : "un ennemi"} pour ${h(spd.name)}` : "") : "choisissez un sort"} <button class="btn sm" data-act="mend">Fin du tour</button><span class="cnt">auto dans ${left} s</span></div>`;
      if (aw && aw.dataset.k !== html) { aw.innerHTML = html; aw.dataset.k = html; }
    } else {
      if (aw && aw.innerHTML) { aw.innerHTML = ""; aw.dataset.k = ""; }
      if (ui.manualSpell) ui.manualSpell = null;
      A.nodes.forEach((n) => n && n.classList.remove("targetable", "turnnow"));
    }
    const fresh = F.fx.filter((f) => f.seq > A.lastSeq);
    if (fresh.length) {
      A.lastSeq = Math.max(...fresh.map((f) => f.seq));
      fresh.forEach((f) => {
        if (f.k === "cast") pulse(A.nodes[f.s], "act");
        else if (f.k === "hit") { const n = A.nodes[f.t]; if (n) { pulse(n, "hit"); floatAt(n, "-" + f.v, elVar(f.el)); burst(n, f.el || "n"); const e = F.ents[f.t]; if (e && (!e.alive || f.v > e.hpMax * 0.3)) pulse(A.el, "shake"); } }
        else if (f.k === "heal") { const n = A.nodes[f.t]; if (n) { floatAt(n, "+" + f.v, "#7ee06a"); burst(n, "h"); } }
        else if (f.k === "buff") { const n = A.nodes[f.t]; if (n) floatAt(n, f.txt, "var(--gold2)", true); }
      });
    }
    if (F.log.length !== A.lastLog || force) {
      A.lastLog = F.log.length;
      $("#flog").innerHTML = F.log.slice(-7).reverse().map((l) => `<div class="${l.cls}">${h(l.txt)}</div>`).join("");
      const last = F.log[F.log.length - 1]; const t = $("#turn"); if (t) t.textContent = `Tour ${F.round}${last ? " · " + last.txt : ""}`;
    }
    if (F.over && !A.over) {
      A.over = true; $("#fresult").innerHTML = `<span class="${F.result === "win" ? "" : "lose"}">${F.result === "win" ? "Victoire !" : "Défaite…"}</span>`;
      lootHtml(F); const fh = $("#fhist"); if (fh) fh.innerHTML = historyHtml(6);
    } else if (!F.over && force) { $("#floot").innerHTML = `<p class="note">Le butin apparaîtra à la fin du combat.</p>`; $("#fres").textContent = `Tour ${F.round}`; }
  } else if (force) { $("#flog").innerHTML = ""; $("#floot").innerHTML = `<p class="note">Aucun combat en cours.</p>`; }
  // barre de sorts du héros sélectionné
  const c = ui.combatCid ? char(ui.combatCid) : null;
  if (c) {
    const ent = F ? F.ents.find((e) => e.side === "c" && e.cid === c.id) : null;
    const bar = spellBarFor(c, ent, F); const sp = $("#spells");
    if (sp && sp.dataset.k !== bar.html) { sp.innerHTML = bar.html; sp.dataset.k = bar.html; $("#spnames").innerHTML = bar.names; const n = E.spellSlots(c); sp.style.gridTemplateColumns = $("#spnames").style.gridTemplateColumns = `repeat(${n},1fr)`; }
    const st = ent ? ent.st : E.charStats(S, c);
    let used = 0;
    if (F && ent) { const idx = F.ents.indexOf(ent); const casts = F.fx.filter((f) => f.k === "cast" && f.s === idx); const lastSeq = casts.length ? casts[casts.length - 1].seq : -1; casts.filter((f) => f.seq === lastSeq).forEach((f) => { const d = E.spellDef(c.cls, f.sp); if (d) used += E.spellGrade(d, c.lvl).pa; }); }
    const pips = $("#pips"); const ph = Array.from({ length: st.pa }, (_, i) => `<i class="${i < st.pa - used ? "" : "off"}"></i>`).join("");
    if (pips && pips.dataset.k !== ph) { pips.innerHTML = ph; pips.dataset.k = ph; }
    const sn = $("#stratName"); if (sn) sn.textContent = c.activePreset !== undefined && c.activePreset !== null && c.presets[c.activePreset] ? c.presets[c.activePreset].name : c.spellsManual ? "personnalisée" : "automatique";
  }
}
function lootHtml(F) {
  const el = $("#floot"); if (!el) return;
  if (F.result !== "win" || !F.rewards) { el.innerHTML = `<p class="note">Défaite. L'équipe se relève et repart.</p>`; $("#fres").textContent = "Défaite"; return; }
  const r = F.rewards; const res = Object.entries(r.res);
  $("#fres").textContent = "Victoire";
  el.innerHTML = `<div class="stack" style="gap:8px">
    <div class="small">${Object.entries(r.xp).map(([cid, x]) => `${h(char(+cid)?.name || "")} <b class="num">+${fmt(x)} XP</b>`).join(" · ")} · <span class="coin"></span> <b class="num">+${fmt(r.kamas)}</b></div>
    ${res.length ? `<div class="loot">${res.map(([n, q]) => `<div class="lcard">${im(resImg(n), "ico sm", n)}<div class="n">${h(n)} <span class="muted num">×${q}</span></div></div>`).join("")}</div>` : `<p class="note">Aucune ressource.</p>`}
    ${r.chal ? `<p class="small" style="color:var(--good);font-weight:700">🎯 Challenges : +${r.chal} % XP et butin</p>` : ""}
    ${r.lootPen ? `<p class="note xs">Monstres bien plus faibles que votre meilleur héros : butin réduit (×${Math.round(r.lootPen * 100) / 100}).</p>` : ""}
    ${r.auto ? `<p class="note">${r.auto} objet${r.auto > 1 ? "s" : ""} traité${r.auto > 1 ? "s" : ""} par les règles automatiques.</p>` : ""}
    ${r.cons ? `<p class="small" style="color:var(--archi);font-weight:800">🍬 Bonbon Sagesse obtenu !</p>` : ""}
    ${r.items.length ? `<div class="list">${r.items.filter((u) => S.items[u]).map((u) => `<div class="li ${S.items[u].radiant ? "radiant" : ""}">${itemIcon(S.items[u])}<span class="grow">${itemName(S.items[u])}</span></div>`).join("")}</div>` : ""}</div>`;
}

/* ---------- objets ---------- */
const itemIcon = (it) => `<span class="icobox ${it.radiant ? "radiant" : ""}">${im(itemImg(it.tpl), "", ITEMS[it.tpl].name)}</span>`;
function itemName(it) { return `<span class="iname ${it.radiant ? "radiant" : ""}">${h(ITEMS[it.tpl].name)}</span>${it.radiant ? ` <span class="tag" style="background:linear-gradient(90deg,#ffb347,#ff5fbf,#8a7dff);color:#fff">✦ +${it.radiant} %</span>` : ""}${it.locked ? ' <span title="Protégé">🔒</span>' : ""}`; }
function itemStatsHtml(it) {
  const T = ITEMS[it.tpl];
  return Object.keys(T.stats).map((k) => { const [a, b] = T.stats[k]; const v = it.stats[k]; const base = it.roll ? it.roll[k] : v;
    return `<span class="statl"${tipAttr(k)}>${sIco(k)}<span${base === b && a !== b ? ' style="color:var(--gold);font-weight:800"' : ""}>${statLine(k, v)}</span>${it.radiant && v !== base ? `<span class="bonus">(+${v - base})</span>` : ""} <span class="muted xs">${a === b ? "" : `(${a} à ${b})`}</span></span>`; }).join("");
}
function tplStatsHtml(T) { return Object.entries(T.stats).map(([k, [a, b]]) => `<span class="statl"${tipAttr(k)}>${sIco(k)}${a === b ? a : a + " à " + b} ${STATS[k].name.replace("% ", "")}</span>`).join(""); }
function deltaHtml(c, slot, uid) {
  const cur = E.charStats(S, c); const saved = Object.assign({}, c.equip); let nw;
  if (uid) {
    const other = E.equippedBy(S, uid); const otherSaved = other && other !== c ? Object.assign({}, other.equip) : null;
    if (otherSaved) for (const k in other.equip) if (other.equip[k] === uid) delete other.equip[k];
    for (const k in c.equip) if (c.equip[k] === uid) delete c.equip[k];
    c.equip[slot] = uid; nw = E.charStats(S, c);
    if (otherSaved) other.equip = otherSaved;
  } else { delete c.equip[slot]; nw = E.charStats(S, c); }
  c.equip = saved;
  const keys = STAT_ORDER.concat(["hpMax"]).filter((k) => k !== "ini" && (nw[k] || 0) !== (cur[k] || 0));
  if (!keys.length) return `<span class="muted xs">Aucun changement</span>`;
  return keys.map((k) => { const d = Math.round(nw[k] - cur[k]); const n = k === "hpMax" ? "PV" : STATS[k].short; return `<span class="${d > 0 ? "plus" : "minus"} xs num">${d > 0 ? "+" : ""}${d} ${n}</span>`; }).join(" ");
}

/* ---------- HÉROS ---------- */
function renderHeroes() {
  if (!ui.cid || !char(ui.cid)) ui.cid = S.chars[0].id;
  const c = char(ui.cid); const st = E.charStats(S, c); const need = E.xpNeed(c.lvl); const nextCost = E.recruitCost(S.chars.length + 1); const C = CLASSES[c.cls];
  $("#main").innerHTML = `
  <div class="pagehead"><h1>Héros</h1><span class="small muted">${E.team(S).length} dans l'équipe · Esprit Libre +${E.freeSpirit(S)} %</span></div>
  <section class="chips">${S.chars.map((x) => `<button class="${x.inTeam ? "" : "out"}" data-act="selchar" data-id="${x.id}" aria-pressed="${x.id === c.id}">${head(x)}<span>${h(x.name)} <span class="muted xs num">niv. ${x.lvl}</span></span></button>`).join("")}
    ${S.chars.length < 8 ? `<button data-act="recruitsheet"><span class="head" style="--cc:var(--panel3)">+</span><span>Recruter <span class="muted xs num">${nextCost ? fmt(nextCost) + " k" : "gratuit"}</span></span></button>` : ""}</section>
  <section class="panel" style="margin-bottom:12px"><div class="pad row" style="gap:18px;align-items:flex-start">
    <div style="padding:14px 0 10px">${heroCard(c, "big", { act: "noop" })}</div>
    <div class="grow stack" style="min-width:240px">
      <div><h2 style="font-size:24px">${h(c.name)}</h2><div class="small muted">${C.name} · niveau ${c.lvl} · cadre ${E.FRAMES[E.frameIdx(c.lvl)]}${c.lvl < 200 ? ` (prochain au niveau ${Math.min(200, (Math.floor(c.lvl / 20) + 1) * 20)})` : ""}</div></div>
      <div><div class="row between small"><span class="muted">Expérience</span><span class="num muted">${c.lvl >= E.MAX_LVL ? "Niveau maximum" : `${fmt(c.xp)} / ${fmt(need)}`}</span></div><div class="bar xp"><i style="width:${pct(c.xp, need)}%"></i></div></div>
      <div class="small" data-tip="${h(C.passive.desc)}"><span class="tag soft">Passif</span> <b>${h(C.passive.name)}</b> : ${h(C.passive.desc)}${(() => { const tm = E.team(S); const first = tm.find((x) => x.cls === c.cls); return c.inTeam && !c.job && first && first.id !== c.id ? ` <span class="tag warn">déjà actif via ${h(first.name)}</span>` : ""; })()}</div>
      <div class="row small"><span class="muted">Activité :</span>${c.job ? `<span class="tag good">⛏ ${h(D.GATHER_JOBS[c.job.job].name)} · ${h(c.job.res)}</span><button class="btn sm" data-act="unjob" data-id="${c.id}">Rappeler pour chasser</button>` : `<span class="tag soft">${c.inTeam ? "Chasse (dans l'équipe)" : "Au repos (hors équipe)"}</span><button class="btn sm" data-act="toggleteam" data-id="${c.id}">${c.inTeam ? "Retirer de l'équipe" : "Ajouter à l'équipe"}</button><button class="btn sm" data-act="gathersheet" data-cid="${c.id}">⛏ Envoyer récolter</button>`}</div>
      <div class="row small"><label class="row">Titre <select data-act="settitle" data-id="${c.id}"><option value="">Aucun</option>${E.titles(S).map((t) => `<option ${c.title === t ? "selected" : ""}>${h(t)}</option>`).join("")}</select></label>
        ${c.orn === "ailes" && ["or", "argent", "sombre"].some((w) => S.unlocks["wing_" + w]) ? `<label class="row">Ailes <select data-act="setwing" data-id="${c.id}"><option value="">Classiques</option>${["or", "argent", "sombre"].filter((w) => S.unlocks["wing_" + w]).map((w) => `<option value="${w}" ${c.wing === w ? "selected" : ""}>${{ or: "Dorées", argent: "Argentées", sombre: "Sombres" }[w]}</option>`).join("")}</select></label>` : ""}
        <label class="row">Ornement <select data-act="setorn" data-id="${c.id}"><option value="">Aucun</option>${Object.keys(E.ORN).map((o) => `<option value="${o}" ${c.orn === o ? "selected" : ""} ${E.ornUnlocked(S, o) ? "" : "disabled"}>${h(E.ORN[o].name(S))}${E.ornUnlocked(S, o) ? "" : " 🔒"}</option>`).join("")}</select></label></div>
      ${E.titles(S).length ? "" : `<p class="note xs" style="margin:0">Les titres et ornements se débloquent avec les succès (onglet Quêtes).</p>`}
    </div>
  </div></section>
  <nav class="subtabs">${[["equip", "Équipement"], ["stats", "Caractéristiques"], ["spells", "Sorts & stratégies"]].map(([id, n]) => `<button data-act="herotab" data-v="${id}" aria-pressed="${ui.hero === id}">${n}</button>`).join("")}</nav>
  <section>${ui.hero === "stats" ? charStatsView(c, st) : ui.hero === "equip" ? charEquipView(c, st) : charSpellsView(c)}</section>`;
}
function statCell(k, v) { return `<div class="s"${tipAttr(k)}><span>${sIco(k)}${k === "hpMax" ? "Points de vie" : STATS[k].name.replace("% ", "")}</span><b>${k === "hpMax" ? fmt(v) : fmtStatVal(k, v)}</b></div>`; }
const DOLL_L = ["coiffe", "amulette", "anneau1", "anneau2"], DOLL_R = ["cape", "ceinture", "bottes", "bouclier"];
const SCORE_W = { vit: 0.25, sa: 0.6, fo: 1, ine: 1, cha: 1, age: 1, pui: 1.2, do: 5, cri: 4, so: 3, pp: 0.6, ini: 0.05, pa: 60, rt: 3, rf: 3, re: 3, ra: 3, rn: 3, dcri: 2.5, dsort: 7, dt: 4, df: 4, de: 4, da: 4, dn: 1, xt: 2, xf: 2, xe: 2, xa: 2, xn: 2 };
const buildMain = (c) => (["fo", "ine", "cha", "age"].includes(c.autoStat) ? c.autoStat : CLASSES[c.cls].main);
function itemScore(c, it) { if (!it) return 0; const main = buildMain(c); const mdmg = ELEMENTS[STATS[main].el].dmg; let sc = 0;
  for (const k in it.stats) sc += it.stats[k] * (SCORE_W[k] || 1) * (["fo", "ine", "cha", "age"].includes(k) ? (k === main ? 1.4 : 0.5) : ["dt", "df", "de", "da"].includes(k) ? (k === mdmg ? 1 : 0.2) : 1);
  if (c.autoStat === "vit") sc += (it.stats.vit || 0) * 0.5; return sc; }
function slotUpgrade(c, s) {
  const want = s.startsWith("anneau") ? "anneau" : s.startsWith("dofus") ? "dofus" : s;
  const cur = S.items[c.equip[s]]; const curSc = itemScore(c, cur); let best = 0;
  for (const it of Object.values(S.items)) { const T = ITEMS[it.tpl]; if (T.slot !== want || T.lvl > c.lvl || E.equippedBy(S, it.uid)) continue; if ((want === "anneau" || want === "dofus") && Object.entries(c.equip).some(([sl, u]) => sl !== s && S.items[u] && S.items[u].tpl === it.tpl)) continue; const sc = itemScore(c, it); if (sc > curSc * 1.05 + 1 && sc > best) best = sc; }
  return best > 0;
}
function dollSlot(c, s) {
  const it = S.items[c.equip[s]]; const T = it && ITEMS[it.tpl];
  const hl = ui.hlSlot && (ui.hlSlot === s || (ui.hlSlot === "anneau" && s.startsWith("anneau")) || (ui.hlSlot === "dofus" && s.startsWith("dofus")));
  return `<button class="dslot ${it ? "filled" : ""} ${it && it.radiant ? "radiant" : ""} ${ui.slot === s ? "on" : ""} ${hl ? "hl" : !it || ui.slot !== s ? (slotUpgrade(c, s) ? "up" : "") : ""}" data-act="slot" data-slot="${s}" ${it ? `data-tipitem="${it.uid}"` : `data-tip="${h(SLOTS[s])} : vide"`}>
    ${it ? im(itemImg(it.tpl), "", T.name) : `<span class="dlabel">${h(SLOTS[s].split(" ")[0])}</span>`}</button>`;
}
/* Panoplie : paliers de bonus, ceux actifs en vert */
function setBlock(setId, worn) {
  const Z = SETS[setId]; if (!Z) return "";
  const tiers = Object.entries(Z.bonus).sort((a, b) => +a[0] - +b[0]);
  return `<div class="setbox"><b>${h(Z.name)}</b> <span class="muted">${worn !== undefined ? `${worn}/${Z.size || "?"} portée${worn > 1 ? "s" : ""}` : `${Z.size || "?"} pièces`}</span>
    ${tiers.map(([n, b]) => `<div class="st ${worn !== undefined && worn >= +n ? "on" : ""}"><b>${n} pièces</b><span>${Object.entries(b).map(([k, v]) => statLine(k, v)).join(", ")}</span></div>`).join("") || `<div class="muted">Aucun bonus.</div>`}</div>`;
}
function charStatsView(c, st) {
  return `<div class="grid2">
    <div class="panel"><div class="phead"><h2>Points à répartir</h2><b class="num" style="font-size:20px">${c.pts}</b></div>
      <div class="list">${BASE_STATS.map((k) => `<div class="li"${tipAttr(k)}>${sIco(k)}<span class="grow"><span class="name">${STATS[k].name}</span> <span class="muted xs">${k === "sa" ? "3 points = 1" : ""}</span></span>
          <span class="num" style="min-width:42px;text-align:right">${fmt(c.alloc[k])}</span>
          <button class="btn sm" data-act="alloc" data-k="${k}" data-n="1" ${c.pts < E.pointCost(k) ? "disabled" : ""}>+1</button><button class="btn sm" data-act="alloc" data-k="${k}" data-n="10" ${c.pts < E.pointCost(k) ? "disabled" : ""}>+10</button></div>`).join("")}</div>
      <div class="pad stack" style="padding-top:6px"><label class="row small"><span class="muted">Répartition automatique :</span>
        <select data-act="autostat" data-id="${c.id}"><option value="">Aucune</option>${BASE_STATS.map((k) => `<option value="${k}" ${c.autoStat === k ? "selected" : ""}>${STATS[k].name}</option>`).join("")}</select></label>
        <div><button class="btn sm" data-act="resetpts" data-id="${c.id}">Réinitialiser les points</button></div></div></div>
    <div class="panel"><div class="phead"><h2>Statistiques totales</h2><span class="xs muted">survolez ou touchez une stat pour son effet</span></div><div class="pad stack">
      <div class="statgrid num">${statCell("hpMax", st.hpMax)}${STAT_ORDER.map((k) => statCell(k, st[k])).join("")}</div>
      <p class="note">${E.isSolo(S) && c.inTeam ? "L'Emblème du Solitaire est actif. " : ""}${Object.keys(S.families || {}).length ? `Familles complétées : +${E.familyBonusVit(S)} PV.` : ""}</p></div></div></div>`;
}
function charEquipView(c, st) {
  const counts = E.setCounts(S, c);
  const sets = Object.entries(counts).filter(([id]) => SETS[id]).map(([id, n]) => setBlock(id, n)).join("");
  let pick = "";
  if (ui.slot) {
    const want = ui.slot.startsWith("anneau") ? "anneau" : ui.slot.startsWith("dofus") ? "dofus" : ui.slot;
    const cands = Object.values(S.items).filter((it) => ITEMS[it.tpl].slot === want && c.equip[ui.slot] !== it.uid).sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl || E.itemQuality(b) - E.itemQuality(a));
    pick = `<div class="panel"><div class="phead"><h2>${SLOTS[ui.slot]} : choisir</h2><span class="row">${c.equip[ui.slot] ? `<button class="btn sm" data-act="fmgo" data-uid="${c.equip[ui.slot]}">⚒ Forgemager</button><button class="btn sm" data-act="unequip" data-slot="${ui.slot}">Retirer</button>` : ""}<button class="btn sm" data-act="slot" data-slot="">Fermer</button></span></div>
      <div class="list">${cands.slice(0, 40).map((it) => { const T = ITEMS[it.tpl]; const by = E.equippedBy(S, it.uid);
        return `<div class="li ${it.radiant ? "radiant" : ""}">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="muted xs">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${by ? ` · porté par ${h(by.name)}` : ""}</span><br>${deltaHtml(c, ui.slot, it.uid)}</span>
          <button class="btn sm primary" data-act="equip" data-uid="${it.uid}" ${T.lvl > c.lvl ? "disabled" : ""}>${T.lvl > c.lvl ? "Niv. " + T.lvl : "Équiper"}</button></div>`; }).join("") || `<div class="empty">${want === "dofus" ? "Aucun trophée. Complétez les paliers de chasse d'une sous-zone pour en obtenir." : "Aucun objet de ce type. Fabriquez-en dans les Ateliers ou trouvez-en sur les monstres."}</div>`}</div></div>`;
  }
  const mainK = buildMain(c);
  return `<div class="stack">
    <div class="panel"><div class="pad">
      <div class="doll">
        <div class="dcol">${DOLL_L.map((s) => dollSlot(c, s)).join("")}</div>
        <div class="dcenter"><span class="medal big" style="--cc:${CLASSES[c.cls].color}">${headTag(c.cls, c.sex, c.name)}</span>
          <b>${h(c.name)}</b><span class="xs muted">${CLASSES[c.cls].name} niv. ${c.lvl}</span>
          <div class="dstats">${["hpMax", "pa", mainK, "pui", "pp", "sa"].map((k) => `<span${tipAttr(k)}>${sIco(k) || "❤"}<b class="num">${k === "hpMax" ? fmt(st.hpMax) : fmtStatVal(k, st[k])}</b></span>`).join("")}</div></div>
        <div class="dcol">${DOLL_R.map((s) => dollSlot(c, s)).join("")}</div>
        <div class="drow">${dollSlot(c, "arme")}<span class="dsep"></span>${D.DOFUS_SLOTS.map((s) => dollSlot(c, s)).join("")}</div>
      </div></div></div>
    ${pick}
    ${sets ? `<div class="panel"><div class="phead"><h2>Panoplies actives</h2></div><div class="pad">${sets}</div></div>` : ""}
    <p class="note xs">▲ en vert : un objet plus intéressant est disponible dans le sac pour cet emplacement.</p></div>`;
}
const CONTENT_MAX = 120; // niveau maximal du contenu actuel
const EL_NAME = (el) => (el === "best" ? "meilleur élément" : ELEMENTS[el || "n"].name.toLowerCase());
const tgtTxt = (n) => (n >= 9 ? "tous les ennemis" : n > 1 ? `${n} cibles` : "");
function fxLine(f) {
  const v = `${f.min}${f.max !== f.min ? "–" + f.max : ""}`; const el = f.el ? (f.el === "best" ? `<span class="eld" style="--c:var(--gold2)" title="Meilleur élément">★</span>` : eld(f.el)) : "";
  switch (f.k) {
    case "dmg": return `${el} ${v} ${EL_NAME(f.el)}${f.n > 1 ? ` (${tgtTxt(f.n)})` : ""}`;
    case "drain": return `${el} ${v} ${EL_NAME(f.el)}, vole la moitié en PV${f.n > 1 ? ` (${tgtTxt(f.n)})` : ""}`;
    case "dot": return `${el} poison ${v}/tour pendant ${f.t || 2} tours${f.n > 1 ? ` (${tgtTxt(f.n)})` : ""}`;
    case "heal": return `soigne ${v}${f.self ? " (lanceur)" : f.n > 1 ? " (équipe)" : ""}`;
    case "healpct": return `soigne ${f.v} % des PV`;
    case "shield": return `bouclier ${f.pct} % des PV${f.all ? " (équipe)" : ""}, ${f.t || 1} t.`;
    case "buff": return `+${f.v} ${(STATS[f.st] || {}).short || f.st}${f.all ? " (équipe)" : ""}${f.st !== "pa" ? `, ${f.t || 1} t.` : ""}`;
    case "apdrain": return `−${f.v} PA à la cible`;
    case "weaken": return `la cible frappe ${f.v} % moins fort`;
    case "vuln": return `la cible subit +${f.v} % de dégâts, ${f.t || 1} t.`;
    case "summon": { const m = (D.SUMMONS || {})[String(f.mid)]; return `invoque ${m ? h(m.name) : "une créature"}`; }
    case "leech": return `vol de vie ${f.v} %`;
  }
  return "";
}
function spellDesc(sp, lvl) { const g = E.spellGrade(sp, lvl || 200); return g.fx.map(fxLine).filter(Boolean).join(" · ") + (g.fx.some((f) => f.fb) ? ` <span class="muted">(effet simplifié)</span>` : g.fx.some((f) => f.adapt) ? ` <span class="muted" title="Effet de placement ou d'état du jeu original, adapté au combat automatique">(adapté)</span>` : ""); }
const spIcon = (sp) => `<span class="spicon" style="--c:${elVar(spEl(sp))}">${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : "✦"}</span>`;
function zoneOptions() {
  const opts = [];
  ZONES.forEach((z) => z.subs.forEach((s) => { if (E.subUnlocked(S, s.id)) opts.push([s.id, `${z.name} · ${s.name}`]); }));
  Object.entries(DUNGEONS).forEach(([id, d]) => { if (E.dungeonUnlocked(S, id)) opts.push(["dg:" + id, `Donjon · ${d.name}`]); });
  return opts;
}
function charSpellsView(c) {
  const eq = c.spells; const N = E.spellSlots(c); const known = E.knownSpells(c);
  const zopts = zoneOptions(); const zname = (k) => (zopts.find((o) => o[0] === k) || [k, k])[1];
  const presets = Array.from({ length: E.MAX_PRESETS }, (_, i) => {
    const p = c.presets[i]; const zones = Object.entries(c.zonePreset || {}).filter(([, v]) => v === i).map(([k]) => k);
    if (!p) return `<div class="preset"><span class="grow small muted">Emplacement ${i + 1} vide</span><button class="btn sm" data-act="psave" data-i="${i}">Enregistrer les sorts actuels</button></div>`;
    return `<div class="preset ${c.activePreset === i ? "on" : ""}" style="flex-wrap:wrap"><span class="grow"><b>${h(p.name)}</b> <span class="xs muted">${p.spells.length} sorts</span>
      <span class="row" style="gap:4px;margin-top:4px">${p.spells.map((x) => { const d = E.spellDef(c.cls, x.id); return d && spellImg(d.name) ? `<img src="${spellImg(d.name)}" alt="${h(d.name)}" title="${h(d.name)}" style="width:22px;height:22px;border-radius:5px">` : ""; }).join("")}</span>
      ${zones.length ? `<span class="row" style="gap:4px;margin-top:4px">${zones.map((z) => `<span class="tag soft">${h(zname(z))} <span data-act="pzonedel" data-z="${h(z)}" style="cursor:pointer">✕</span></span>`).join("")}</span>` : ""}</span>
      <span class="row" style="gap:4px"><button class="btn sm ${c.activePreset === i ? "" : "primary"}" data-act="pload" data-i="${i}">${c.activePreset === i ? "Active" : "Charger"}</button><button class="btn sm" data-act="psave" data-i="${i}" title="Remplacer par les sorts actuels">Écraser</button><button class="btn sm" data-act="pdel" data-i="${i}">✕</button>
      <select class="small" data-act="pzone" data-i="${i}" aria-label="Activer automatiquement dans une zone"><option value="">Auto. dans…</option>${zopts.map(([v, n]) => `<option value="${h(v)}">${h(n)}</option>`).join("")}</select></span></div>`;
  }).join("");
  const meta = (sp) => { const g = E.spellGrade(sp, c.lvl); return `${g.pa} PA${g.cd ? ` · relance ${g.cd} t.` : ""}${g.casts ? ` · ${g.casts}×/tour` : ""}`; };
  // paires sort / variante
  const pairs = {}; CLASSES[c.cls].spells.forEach((sp) => { (pairs[sp.pair] = pairs[sp.pair] || [])[sp.variant ? 1 : 0] = sp; });
  const eqIds = new Set(eq.map((x) => x.id));
  const pairHtml = Object.values(pairs).sort((a, b) => (a[0] || a[1]).lvl - (b[0] || b[1]).lvl).map((pr) => `<div class="sppair">${pr.map((sp) => { if (!sp) return `<div class="spcard empty"></div>`;
    if (sp.lvl > CONTENT_MAX) return `<div class="spcard later" data-tip="${h(sp.name)} : ${h(spellDesc(sp, sp.lvl).replace(/<[^>]+>/g, ""))}">${spIcon(sp)}<div class="grow" style="min-width:0"><div class="name">${h(sp.name)} <span class="tag soft">variante</span></div><div class="xs muted">niv. ${sp.lvl} · arrivera avec le contenu au-delà du niveau ${CONTENT_MAX}</div></div></div>`;
    const ok = sp.lvl <= c.lvl; const on = eqIds.has(sp.id);
    return `<div class="spcard ${on ? "on" : ""} ${ok ? "" : "locked"}">${spIcon(sp)}<div class="grow" style="min-width:0"><div class="name">${h(sp.name)} ${sp.variant ? `<span class="tag soft">variante</span>` : ""}</div><div class="xs muted">${ok ? meta(sp) : `niv. ${sp.lvl}`}</div><div class="xs">${spellDesc(sp, Math.max(c.lvl, sp.lvl))}</div></div>
      ${ok ? (on ? `<span class="tag">équipé</span>` : `<button class="btn sm" data-act="spadd" data-id="${sp.id}" ${eq.length >= N && !eq.some((x) => E.spellDef(c.cls, x.id).pair === sp.pair) ? "disabled" : ""}>Équiper</button>`) : ""}</div>`; }).join("")}</div>`).join("");
  // simulateur
  const res = ui.simRes || 0;
  const sim = eq.map((x) => { const sp = E.spellDef(c.cls, x.id); const k = E.spellKind(E.spellGrade(sp, c.lvl)); if (!["dmg", "aoe", "drain", "dot", "heal"].includes(k)) return "";
    const r = E.spellEstimate(S, c, sp, res);
    return `<tr><td>${spIcon(sp)} ${h(sp.name)}</td><td class="num">${k === "heal" ? `+${fmt(r.heal)}` : `${fmt(r.min)}–${fmt(r.max)}`}</td><td class="num">${k === "heal" ? "" : fmt(r.avg)}</td><td class="num">${k === "heal" ? "" : `${fmt(r.turn)} <span class="xs muted">(${r.casts}×${r.tgts > 1 ? `, ${r.tgts >= 9 ? "zone" : r.tgts + " cibles"}` : ""})</span>`}</td></tr>`; }).join("");
  const st = E.charStats(S, c); const rec = CLASSES[c.cls].elRec;
  return `<div class="stack">
  <div class="panel"><div class="phead"><h2>Profil de build</h2><span class="xs muted">${h(CLASSES[c.cls].signature || "")}</span></div><div class="pad stack" style="gap:8px">
    <label class="row small"><span class="muted">Élément principal :</span>
      <select data-act="autostat" data-id="${c.id}">${["fo", "ine", "cha", "age"].map((k) => `<option value="${k}" ${c.autoStat === k ? "selected" : ""}>${STATS[k].name} (${ELEMENTS[STATS[k].el].name})${k === rec ? " ★ conseillé" : ""}</option>`).join("")}<option value="vit" ${c.autoStat === "vit" ? "selected" : ""}>Vitalité (tank)</option><option value="" ${!c.autoStat ? "selected" : ""}>Manuel</option></select></label>
    <p class="xs muted">Les points de caractéristiques vont dans cet élément ; la sélection automatique des sorts et les flèches d'équipement le privilégient.</p>
    <label class="row small"><input type="checkbox" data-act="spauto" ${c.spellsManual ? "" : "checked"}> Choisir automatiquement les meilleurs sorts à chaque niveau</label>
    <label class="row small"><input type="checkbox" data-act="chaloff" ${c.chalOff ? "checked" : ""}> Ce héros ignore les challenges</label>
  </div></div>
  <div class="panel"><div class="phead"><h2>Stratégies</h2><span class="xs muted">préréglages de sorts, activables automatiquement par zone</span></div><div class="pad stack" style="gap:8px">${presets}</div></div>
  <div class="grid2">
    <div class="panel"><div class="phead"><h2>Sorts équipés</h2><span class="muted xs">${eq.length}/${N}${N < 8 ? ` · ${N === 6 ? "7e au niv. 50" : "8e au niv. 100"}` : ""}</span></div>
      <p class="note xs" style="margin:6px 12px 0">L'IA lance d'abord invocations, protections et soins (dans l'ordre de la liste, si leur condition est remplie), puis l'attaque qui fait le plus de dégâts par PA.</p>
      <div class="list">${eq.map((x, i) => { const sp = E.spellDef(c.cls, x.id); if (!sp) return "";
        return `<div class="li"><div class="spellrow"><div class="ord"><button class="btn sm" data-act="spup" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Monter">▲</button><button class="btn sm" data-act="spdown" data-i="${i}" ${i === eq.length - 1 ? "disabled" : ""} aria-label="Descendre">▼</button></div>
          ${spIcon(sp)}<div style="min-width:0"><div class="name">${h(sp.name)} <span class="muted xs">${meta(sp)}</span></div><div class="xs muted">${spellDesc(sp, c.lvl)}</div>
          <div class="row" style="gap:4px;flex-wrap:wrap;margin-top:3px"><select class="small" data-act="spcond" data-i="${i}" aria-label="Condition">${Object.entries(CONDITIONS).map(([k, n]) => `<option value="${k}" ${x.cond === k ? "selected" : ""}>${n}</option>`).join("")}</select>
          <select class="small" data-act="sptgt" data-i="${i}" aria-label="Cible">${Object.entries(D.TARGETS).map(([k, n]) => `<option value="${k}" ${(x.tgt || "low") === k ? "selected" : ""}>🎯 ${n}</option>`).join("")}</select></div></div>
          <button class="btn sm" data-act="sprem" data-i="${i}">Retirer</button></div></div>`; }).join("") || `<div class="empty">Aucun sort équipé : ce héros ne fera rien en combat.</div>`}</div></div>
    <div class="panel"><div class="phead"><h2>Simulateur de dégâts</h2><select class="small" data-act="simres" aria-label="Résistance de la cible">${[0, 10, 20, 30, 40].map((r) => `<option value="${r}" ${res === r ? "selected" : ""}>Cible ${r} % rés.</option>`).join("")}</select></div>
      <div class="pad"><table class="simtab"><thead><tr><th>Sort</th><th>Jet</th><th>Moy.*</th><th>Par tour</th></tr></thead><tbody>${sim || `<tr><td colspan="4" class="muted">Aucun sort offensif équipé.</td></tr>`}</tbody></table>
      <p class="xs muted">* moyenne avec ${Math.min(60, 5 + st.cri)} % de coups critiques. Estimation hors bonus de combat (buffs, marques, passifs).</p></div></div>
  </div>
  <div class="panel"><div class="phead"><h2>Sorts et variantes</h2><span class="xs muted">une seule des deux versions peut être équipée · variantes gratuites</span></div><div class="pad stack" style="gap:8px">${pairHtml}</div></div>
  </div>`;
}

/* ---------- INVENTAIRE ---------- */

function invGroups() {
  const q = (ui.invSearch || "").trim().toLowerCase(); const filt = ui.slotFilter;
  const groups = new Map();
  Object.values(S.items).forEach((it) => {
    const T = ITEMS[it.tpl];
    if (filt === "radiant" ? !it.radiant : filt !== "all" && T.slot !== filt) return;
    if (q && !T.name.toLowerCase().includes(q)) return;
    const g = groups.get(it.tpl) || { tpl: it.tpl, items: [] }; g.items.push(it); groups.set(it.tpl, g);
  });
  const arr = [...groups.values()];
  arr.forEach((g) => { g.best = Math.max(...g.items.map((x) => E.itemQuality(x))); g.rad = g.items.some((x) => x.radiant); g.lock = g.items.some((x) => x.locked); g.eq = g.items.some((x) => E.equippedBy(S, x.uid)); });
  const sort = ui.invSort || "lvl";
  arr.sort((a, b) => (b.rad - a.rad) || (sort === "lvl" ? ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl : sort === "jet" ? b.best - a.best : sort === "count" ? b.items.length - a.items.length : ITEMS[a.tpl].name.localeCompare(ITEMS[b.tpl].name, "fr")));
  return arr;
}
function invDetail(tpl) {
  const T = ITEMS[tpl]; if (!T) return "";
  const copies = Object.values(S.items).filter((x) => x.tpl === tpl).sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || E.itemQuality(b) - E.itemQuality(a));
  if (!copies.length) return "";
  return `<div class="panel invdetail"><div class="phead"><div class="row">${itemIcon(copies[0])}<div><h2>${h(T.name)}</h2><div class="xs muted">niv. ${T.lvl} · ${SLOTS[T.slot === "anneau" ? "anneau1" : T.slot === "dofus" ? "dofus1" : T.slot]}${T.set && SETS[T.set] ? ` · ${h(SETS[T.set].name)}` : ""}</div></div></div><button class="btn sm" data-act="invsel" data-tpl="">✕</button></div>
    <div class="pad xs">${tplStatsHtml(T)}${T.set ? setBlock(T.set, ui.cid && char(ui.cid) ? E.setCounts(S, char(ui.cid))[T.set] || 0 : undefined) : ""}
      ${ui.cid && char(ui.cid) && T.lvl <= char(ui.cid).lvl ? `<div class="row" style="margin-top:6px">${miniDoll(char(ui.cid), T.slot)}</div>` : ""}</div>
    <div class="list">${copies.map((it) => { const by = E.equippedBy(S, it.uid);
      return `<div class="li ${it.radiant ? "radiant" : ""}" style="align-items:flex-start"><span class="grow"><b class="num">Jet ${Math.round(E.itemQuality(it) * 100)} %</b>${it.radiant ? ` <span class="tag" style="background:linear-gradient(90deg,#ffb347,#ff5fbf,#8a7dff);color:#fff">✦ +${it.radiant} %</span>` : ""}${by ? ` <span class="tag good">${h(by.name)}</span>` : ""}<br><span class="small">${itemStatsHtml(it)}</span></span>
        <span class="row" style="gap:4px;justify-content:flex-end;max-width:170px"><button class="btn sm" data-act="givesheet" data-uid="${it.uid}">Équiper</button><button class="btn sm" data-act="fmgo" data-uid="${it.uid}" title="Forgemagie">⚒</button>
          <button class="btn sm" data-act="lock" data-uid="${it.uid}" title="${it.locked ? "Retirer le cadenas" : "Protéger de la vente et du brisage"}">${it.locked ? "🔒" : "🔓"}</button>
          ${by || it.locked ? "" : `<button class="btn sm" data-act="sellitem" data-uid="${it.uid}">Vendre</button><button class="btn sm" data-act="break" data-uid="${it.uid}">Briser</button>`}</span></div>`; }).join("")}</div></div>`;
}
/* mini-silhouette : emplacement de l'objet sélectionné en surbrillance */
function miniDoll(c, slot) {
  const want = slot === "anneau" ? ["anneau1", "anneau2"] : slot === "dofus" ? D.DOFUS_SLOTS : [slot];
  const all = ["coiffe", "amulette", "anneau1", "anneau2", "cape", "ceinture", "bottes", "bouclier", "arme"];
  return `<span class="xs muted">Pour ${h(c.name)} :</span><span class="row" style="gap:3px">${all.concat(slot === "dofus" ? D.DOFUS_SLOTS : []).map((s) => { const it = S.items[c.equip[s]]; const on = want.includes(s);
    return `<span class="dslot ${on ? "hl" : ""} ${it ? "filled" : ""}" style="width:30px;height:30px;border-radius:8px;cursor:default" data-tip="${h(SLOTS[s])}${it ? " : " + h(ITEMS[it.tpl].name) : " : vide"}">${it ? `<img src="${itemImg(it.tpl)}" style="width:24px;height:24px" alt="">` : ""}</span>`; }).join("")}</span>`;
}
/* ---------- Sac : ressources (v2.7) ---------- */
function resRarity(n) { const L = (resIndex().src[n] || []).filter((x) => x.m); if (!L.length) return n === E.RARE_COMPONENT ? "epique" : ""; const best = Math.max(...L.map((x) => (MONSTERS[x.m].boss || MONSTERS[x.m].archiOf ? 0 : x.p))); return best === 0 ? "epique" : best < 1 ? "epique" : best < 5 ? "rare" : ""; }
const RAR = { rare: ["Rare", "#5fbfff"], epique: ["Épique", "#c77dff"] };
function usefulNow() {
  const set = new Set(); const A = E.almanax(S); if (!A.done) set.add(A.res);
  for (const j in GATHER_JOBS) if (E.toolLvl(S, j) < E.TOOL_MAX) E.toolCost(S, j).ing.forEach(([r]) => set.add(r));
  S.shop.forEach((e) => shopIng(e).forEach(([r]) => set.add(r)));
  Object.entries(DUNGEONS).forEach(([id, d]) => { if (E.dungeonUnlocked(S, id) && SPECIAL_CRAFTS[d.key]) SPECIAL_CRAFTS[d.key].ing.forEach(([r]) => set.add(r)); });
  return set;
}
function resTabHtml() {
  const IX = resIndex(); const cats = D.RES_CATS; const all = Object.entries(S.res).filter(([, q]) => q > 0);
  if (!ui.newResDone) { ui.newRes = new Set(all.map(([n]) => n).filter((n) => !S.resSeen[n])); all.forEach(([n]) => (S.resSeen[n] = 1)); ui.newResDone = true; }
  const cnt = {}; all.forEach(([n]) => { const c = D.RES_CAT_OF(n); cnt[c] = (cnt[c] || 0) + 1; });
  const cat = ui.resCat || "all"; const q = (ui.resQ || "").trim().toLowerCase(); const f = ui.resF || "all"; const now = f === "now" ? usefulNow() : null;
  let list = all.filter(([n]) => (cat === "all" || D.RES_CAT_OF(n) === cat) && (!q || n.toLowerCase().includes(q)));
  if (f === "recipe") list = list.filter(([n]) => IX.use[n]);
  if (f === "now") list = list.filter(([n]) => now.has(n));
  if (f === "unused") list = list.filter(([n]) => !IX.use[n] && !E.isKey(n) && n !== E.RARE_COMPONENT);
  if (f === "new") list = list.filter(([n]) => ui.newRes.has(n));
  if (f === "fav") list = list.filter(([n]) => S.resFav[n]);
  const so = ui.resSort || "name"; const lv = (n) => (RES[n] && RES[n].lvl) || 0;
  list.sort((a, b) => (S.resFav[b[0]] ? 1 : 0) - (S.resFav[a[0]] ? 1 : 0) || (so === "qty" ? b[1] - a[1] : so === "lvl" ? lv(b[0]) - lv(a[0]) : so === "value" ? E.resPrice(b[0]) * b[1] - E.resPrice(a[0]) * a[1] : so === "recent" ? (S.resT[b[0]] || 0) - (S.resT[a[0]] || 0) : a[0].localeCompare(b[0], "fr")));
  const unused = all.filter(([n]) => !IX.use[n] && !E.isKey(n) && n !== E.RARE_COMPONENT && !S.resFav[n] && E.resPrice(n));
  const unusedVal = unused.reduce((a, [n, qq]) => a + E.resPrice(n) * qq, 0);
  const picked = ui.resPicked || new Set(); const pickVal = [...picked].reduce((a, n) => a + E.resPrice(n) * (S.res[n] || 0), 0);
  const detail = ui.resSel && S.res[ui.resSel] ? resDetail(ui.resSel) : "";
  const tile = ([n, qq]) => { const r = resRarity(n); const sel = picked.has(n);
    return ui.resView === "list"
      ? `<div class="li ${ui.resSel === n ? "selrow" : ""}">${ui.resPick ? `<input type="checkbox" data-act="respick" data-n="${h(n)}" ${sel ? "checked" : ""}>` : ""}${im(resImg(n), "ico", n)}<span class="grow"><span class="name">${S.resFav[n] ? "★ " : ""}${h(n)}</span> ${r ? `<span class="tag" style="background:${RAR[r][1]};color:#0e0b14">${RAR[r][0]}</span>` : ""}${ui.newRes.has(n) ? ` <span class="tag good">Nouveau</span>` : ""}<br><span class="xs muted">${h(cats.find((c) => c.id === D.RES_CAT_OF(n)).name)} · ${fmt(E.resPrice(n))} k l'unité</span></span><span class="num">${fmt(qq)}</span><button class="btn sm" data-act="ressel" data-n="${h(n)}">Détails</button></div>`
      : `<button class="itile rtile ${r} ${ui.resSel === n ? "on" : ""} ${sel ? "picked" : ""}" data-act="${ui.resPick ? "respick" : "ressel"}" data-n="${h(n)}" data-tip="${h(`${n} ×${fmt(qq)} · ${fmt(E.resPrice(n))} k l'unité${r ? " · " + RAR[r][0] : ""}`)}">${im(resImg(n), "", n)}<span class="icount">${qq >= 1000 ? Math.floor(qq / 1000) + "k" : qq}</span>${S.resFav[n] ? `<span class="ilock">★</span>` : ""}${ui.newRes.has(n) ? `<span class="inew">●</span>` : ""}</button>`; };
  return `<div class="row resbar">
      <div class="catchips"><button data-act="rescat" data-v="all" aria-pressed="${cat === "all"}">Tout <b>${all.length}</b></button>${cats.filter((c) => cnt[c.id]).map((c) => `<button data-act="rescat" data-v="${c.id}" aria-pressed="${cat === c.id}">${c.icon} ${h(c.name)} <b>${cnt[c.id]}</b></button>`).join("")}</div></div>
    <div class="row invbar"><input type="text" id="resSearch" data-act="ressearch" placeholder="Rechercher une ressource…" value="${h(ui.resQ || "")}">
      <select data-act="resf">${[["all", "Toutes"], ["recipe", "Utiles pour une recette"], ["now", "Utiles maintenant"], ["unused", "Inutilisées"], ["new", "Nouvelles"], ["fav", "Favorites"]].map(([v, n]) => `<option value="${v}" ${f === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-act="ressort">${[["name", "Nom"], ["qty", "Quantité"], ["lvl", "Niveau"], ["value", "Valeur totale"], ["recent", "Récentes"]].map(([v, n]) => `<option value="${v}" ${so === v ? "selected" : ""}>Tri : ${n}</option>`).join("")}</select>
      <span class="seg">${[["grid", "▦"], ["list", "☰"]].map(([v, n]) => `<button data-act="resview" data-v="${v}" aria-pressed="${(ui.resView || "grid") === v}" title="${v === "grid" ? "Grille" : "Liste"}">${n}</button>`).join("")}</span>
      <button class="btn sm ${ui.resPick ? "primary" : ""}" data-act="respickmode">${ui.resPick ? "Fin de la sélection" : "Sélection multiple"}</button></div>
    ${ui.resPick ? `<div class="awaitbar" style="margin:0">${picked.size} ressource${picked.size > 1 ? "s" : ""} sélectionnée${picked.size > 1 ? "s" : ""} <button class="btn sm danger" data-act="sellpicked" ${picked.size ? "" : "disabled"}>Vendre la sélection · ${fmt(pickVal)} k</button></div>` : ""}
    <div class="row small">${unused.length ? (ui.confirm === "sellunused" ? `<span>Vendre ${unused.length} ressources inutilisées (hors favorites) pour ${fmt(unusedVal)} kamas ?</span><button class="btn sm danger" data-act="sellunused">Confirmer</button><button class="btn sm" data-act="cancel">Annuler</button>` : `<button class="btn sm" data-act="asksellunused">Vendre les ressources inutilisées · ${fmt(unusedVal)} k</button>`) : ""}<span class="xs muted">Les ressources sont partagées entre tous vos héros.</span></div>
    <div class="invlayout ${detail ? "withdetail" : ""}">${detail}
      ${ui.resView === "list" ? `<section class="panel"><div class="list">${list.map(tile).join("") || `<div class="empty">Aucune ressource.</div>`}</div></section>` : `<div class="invgrid">${list.map(tile).join("") || `<div class="empty" style="grid-column:1/-1">Aucune ressource.</div>`}</div>`}</div>`;
}
function resDetail(n) {
  const IX = resIndex(); const qq = S.res[n] || 0; const r = resRarity(n); const src = IX.src[n] || []; const use = IX.use[n] || [];
  const A = E.almanax(S);
  const srcHtml = src.slice(0, 8).map((x) => x.job ? `<div class="li">${im(jobImg(x.job), "joblogo sm", GATHER_JOBS[x.job].name)}<span class="grow">${GATHER_JOBS[x.job].name} niv. ${x.lvl}</span><button class="btn sm" data-act="gathersheet" data-job="${x.job}">⛏ Récolter</button></div>`
    : (() => { const sb = subOfMon(x.m); const isSub = sb && typeof sb !== "string"; return `<div class="li">${im(imgM(x.m), "ico", MONSTERS[x.m].name)}<span class="grow">${S.bestiary[x.m] ? h(MONSTERS[x.m].name) : "???"} <span class="xs muted">${sb ? h(isSub ? sb.name : DUNGEONS[sb].name) : ""}</span></span><span class="pct">${E.resRate(x.p).toFixed(1).replace(".", ",")} %</span>${isSub ? `<button class="btn sm" data-act="zoneview" data-id="${sb.id}" data-gotab="world">Y aller</button>` : ""}</div>`; })()).join("");
  const useHtml = use.slice(0, 10).map((u) => u.tpl ? `<div class="li"><span class="icobox">${im(itemImg(u.tpl), "", ITEMS[u.tpl].name)}</span><span class="grow">${h(ITEMS[u.tpl].name)} <span class="xs muted">niv. ${ITEMS[u.tpl].lvl} · ${u.q} requis</span></span>${E.canCraft(S, ITEMS[u.tpl].craft) ? `<span class="tag good">fabricable</span>` : ""}</div>`
    : u.special ? `<div class="li"><span class="grow">🗝 ${h(u.special)} <span class="xs muted">${u.q} requis</span></span></div>` : `<div class="li"><span class="grow">🔨 ${h(E.TOOL_NAMES[u.tool])} ${u.L} <span class="xs muted">(${GATHER_JOBS[u.tool].name}) · ${u.q} requis</span></span></div>`).join("");
  return `<div class="panel invdetail"><div class="phead"><div class="row">${im(resImg(n), "ico lg", n)}<div><h2>${h(n)}</h2><div class="xs muted">${h(D.RES_CATS.find((c) => c.id === D.RES_CAT_OF(n)).name)} · ${fmt(qq)} en stock · ${fmt(E.resPrice(n))} k l'unité ${r ? `· <b style="color:${RAR[r][1]}">${RAR[r][0]}</b>` : ""}</div></div></div><button class="btn sm" data-act="ressel" data-n="">✕</button></div>
    <div class="pad stack" style="gap:8px">
      <div class="row">${E.resPrice(n) ? `<button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="1">Vendre 1</button><button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="10">Vendre 10</button><button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="${qq}">Tout · ${fmt(E.resPrice(n) * qq)} k</button>` : ""}<button class="btn sm" data-act="resfav" data-n="${h(n)}">${S.resFav[n] ? "★ Favori" : "☆ Épingler"}</button></div>
      ${E.resPrice(n) ? `<label class="row small">Garder au maximum <input type="number" min="0" step="10" data-act="rescap" data-n="${h(n)}" value="${S.resCap[n] !== undefined ? S.resCap[n] : ""}" placeholder="∞" style="width:90px"> <span class="xs muted">le surplus est vendu automatiquement</span></label>` : ""}
      ${A.res === n && !A.done ? `<div class="tag good">📅 Offrande de l'Almanax du jour (${A.qty})</div>` : ""}
      <h3 class="sec">D'où elle vient</h3><div class="list">${srcHtml || `<div class="empty">${n === E.RARE_COMPONENT ? "Trouvailles de récolte, coffres et boss." : "Source inconnue."}</div>`}</div>
      <h3 class="sec">À quoi elle sert</h3><div class="list">${useHtml || `<div class="empty">N'entre dans aucune recette du jeu : vous pouvez la vendre.</div>`}${use.length > 10 ? `<div class="empty">… et ${use.length - 10} autres recettes.</div>` : ""}</div>
    </div></div>`;
}
function autoRulesHtml() {
  const A = S.settings.auto;
  return `<details class="panel" ${ui.autoOpen ? "open" : ""}><summary class="pad" style="cursor:pointer;font-weight:800" data-act="autotoggle">⚙ Règles automatiques ${A.action !== "none" ? `<span class="tag good">${A.action === "sell" ? "Vente" : "Brisage"} si jet &lt; ${A.q} %</span>` : `<span class="tag soft">désactivées</span>`}</summary>
    <div class="pad stack" style="padding-top:0;gap:8px">
      <p class="note">S'applique aux objets lâchés par les monstres. Les objets Rayonnants, protégés par cadenas et équipés ne sont jamais touchés.</p>
      <div class="row"><label class="row small">Action <select data-act="autoaction"><option value="none" ${A.action === "none" ? "selected" : ""}>Aucune</option><option value="sell" ${A.action === "sell" ? "selected" : ""}>Vendre</option><option value="break" ${A.action === "break" ? "selected" : ""}>Briser (runes)</option></select></label>
        <label class="row small">si le jet est inférieur à <input type="number" min="0" max="100" step="5" data-act="autoq" value="${A.q}" style="width:70px"> %</label>
        <label class="row small"><input type="checkbox" data-act="autosets" ${A.keepSets ? "checked" : ""}> garder les objets de panoplie</label></div>
      <label class="row small">Doublons <select data-act="autorecycle"><option value="" ${!A.recycle ? "selected" : ""}>garder</option><option value="sell" ${A.recycle === "sell" ? "selected" : ""}>vendre si j'ai déjà mieux ou égal</option><option value="break" ${A.recycle === "break" ? "selected" : ""}>briser si j'ai déjà mieux ou égal</option></select></label>
      <div><button class="btn sm" data-act="autonow">Appliquer maintenant aux objets du sac</button></div></div></details>`;
}
function renderInventory() {
  const items = Object.values(S.items);
  const res = Object.entries(S.res).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const runes = Object.entries(S.runes).sort((a, b) => E.runeInfo(b[0]).weight - E.runeInfo(a[0]).weight);
  let body = "";
  if (ui.inv === "items") {
    const groups = invGroups();
    const detail = ui.invSel && S && Object.values(S.items).some((x) => x.tpl === ui.invSel) ? invDetail(ui.invSel) : "";
    body = `${autoRulesHtml()}
      <div class="row invbar"><input type="text" id="invSearch" data-act="invsearch" placeholder="Rechercher…" value="${h(ui.invSearch || "")}">
        <select data-act="slotfilter" aria-label="Filtrer">${[["all", "Tous"], ["radiant", "✦ Rayonnants"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"], ["bouclier", "Boucliers"], ["dofus", "Trophées"]].map(([v, n]) => `<option value="${v}" ${ui.slotFilter === v ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select data-act="invsort" aria-label="Trier">${[["lvl", "Niveau"], ["jet", "Meilleur jet"], ["count", "Quantité"], ["name", "Nom"]].map(([v, n]) => `<option value="${v}" ${(ui.invSort || "lvl") === v ? "selected" : ""}>Tri : ${n}</option>`).join("")}</select>
        <span class="muted small num">${items.length}/${E.itemCap(S)} objets · ${groups.length} types</span></div>
      <div class="invlayout ${detail ? "withdetail" : ""}">
        ${detail}
        <div class="invgrid">${groups.map((g) => { const T = ITEMS[g.tpl]; const best = g.items.slice().sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || E.itemQuality(b) - E.itemQuality(a))[0];
          return `<button class="itile ${g.rad ? "radiant" : ""} ${ui.invSel === g.tpl ? "on" : ""}" data-act="invsel" data-tpl="${g.tpl}" data-tipitem="${best.uid}">
            ${im(itemImg(g.tpl), "", T.name)}<span class="ilvl">${T.lvl}</span>${g.items.length > 1 ? `<span class="icount">×${g.items.length}</span>` : ""}${g.lock ? `<span class="ilock">🔒</span>` : ""}${g.eq ? `<span class="ieq"></span>` : ""}</button>`; }).join("") || `<div class="empty" style="grid-column:1/-1">Aucun objet. Les monstres en lâchent parfois, et les Ateliers permettent d'en fabriquer.</div>`}</div>
      </div>`;
  } else if (ui.inv === "res") {
    body = resTabHtml();
  } else if (ui.inv === "cons") {
    body = `<section class="panel"><div class="pad">${consHtml()}</div></section>`;
  } else {
    body = `<section class="panel"><div class="list">${runes.map(([k, q]) => { const i = E.runeInfo(k); return `<div class="li">${sIco(i.stat)}<span class="grow"><span class="name">${E.runeName(k)}</span> <span class="muted xs">+${i.pts} ${STATS[i.stat].name} · poids ${i.weight}</span></span><span class="num">${fmt(q)}</span></div>`; }).join("") || `<div class="empty">Aucune rune. Brisez des objets dans les Ateliers pour en obtenir.</div>`}</div></section>`;
  }
  const nc = Object.values(S.cons || {}).reduce((a, b) => a + b, 0);
  $("#main").innerHTML = `<div class="pagehead"><h1>Inventaire</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b> kamas</span></div>
    <nav class="subtabs">${[["items", "Équipements"], ["res", "Ressources"], ["cons", `Consommables${nc ? ` (${nc})` : ""}`], ["runes", "Runes"]].map(([id, n]) => `<button data-act="invtab" data-v="${id}" aria-pressed="${ui.inv === id}">${n}</button>`).join("")}</nav>
    <div class="stack">${body}</div>`;
}
/* ---------- infobulles ---------- */
function tipItemHtml(uid) {
  const it = S.items[uid]; if (!it) return "";
  const T = ITEMS[it.tpl]; const c = ui.cid ? char(ui.cid) : S.chars[0];
  let cmp = "";
  if (c && T.lvl <= c.lvl && !E.equippedBy(S, uid)) { const slot = E.slotFor(c, it); cmp = `<div class="tipcmp">Pour ${h(c.name)} : ${deltaHtml(c, slot, uid)}</div>`; }
  const worn = T.set && c ? E.setCounts(S, c)[T.set] || 0 : undefined;
  return `<b>${h(T.name)}</b> <span class="muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${it.fm ? ` · forgemagé ×${it.fm}` : ""}</span>${it.radiant ? ` <b style="color:var(--gold)">✦ +${it.radiant} %</b>` : ""}<div class="tipstats">${itemStatsHtml(it)}</div>${T.set ? setBlock(T.set, worn) : ""}${cmp}`;
}
let tipEl = null;
function showTip(target) {
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tooltip"; document.body.appendChild(tipEl); }
  const html = target.dataset.tipitem ? tipItemHtml(+target.dataset.tipitem) : h(target.dataset.tip);
  if (!html) return hideTip();
  tipEl.innerHTML = html; tipEl.style.display = "block";
  const r = target.getBoundingClientRect(); const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2; x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  let y = r.top - hh - 8; if (y < 8) y = r.bottom + 8;
  tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
}
function hideTip() { if (tipEl) tipEl.style.display = "none"; }
const canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
document.addEventListener("mouseover", (ev) => { if (!canHover || !S) return; const t = ev.target.closest("[data-tip],[data-tipitem]"); if (t) showTip(t); else hideTip(); });
document.addEventListener("scroll", hideTip, true);

/* ---------- ATELIERS ---------- */
function ingHtml(ing, mult = 1) {
  return `<div class="ing">${ing.map(([r, q]) => { const have = S.res[r] || 0; return `<span class="${have >= q * mult ? "ok" : "ko"}" title="${h(r)}">${im(resImg(r), "", r)}${h(r)} <b class="num">${fmt(have)}/${q * mult}</b></span>`; }).join("")}</div>`;
}
function craftHtml() {
  let body = "";
    const job = ui.craftJob; const J = S.crafts[job] || { lvl: 1, xp: 0 }; const q = ui.craftSearch.trim().toLowerCase();
    let recipes = job === "bricoleur"
      ? Object.entries(SPECIAL_CRAFTS).map(([n, R]) => ({ special: n, name: n, lvl: R.lvl, ing: R.ing, req: R.lvl }))
      : Object.entries(ITEMS).filter(([, T]) => T.craft && T.craft.job === job).map(([id, T]) => ({ tpl: id, name: T.name, lvl: T.lvl, ing: T.craft.ing, req: E.craftReq(id), T })).sort((a, b) => a.lvl - b.lvl);
    if (q) recipes = recipes.filter((r) => r.name.toLowerCase().includes(q));
    if (ui.craftOnly) recipes = recipes.filter((r) => E.canCraft(S, { ing: r.ing }) && J.lvl >= r.req);
    const total = recipes.length; recipes = recipes.slice(0, 80);
    body = `<nav class="subtabs" style="margin:0">${Object.entries(CRAFT_JOBS).map(([id, c]) => `<button data-act="craftjob" data-v="${id}" aria-pressed="${job === id}">${c.name} <span class="num xs">${(S.crafts[id] || {}).lvl || 1}</span></button>`).join("")}</nav>
      <div class="row"><div class="bar xp" style="width:200px"><i style="width:${pct(J.xp, E.jobXpNeed(J.lvl))}%"></i></div><input type="text" id="craftSearch" data-act="craftsearch" placeholder="Rechercher…" value="${h(ui.craftSearch)}" style="max-width:200px">
        <label class="row small"><input type="checkbox" data-act="craftonly" ${ui.craftOnly ? "checked" : ""}> Fabricables maintenant</label><span class="xs muted">${total} recette${total > 1 ? "s" : ""}</span></div>
      <section class="panel"><div class="list">${recipes.map((r) => { const ok = E.canCraft(S, { ing: r.ing }) && J.lvl >= r.req;
        const stats = r.T ? Object.entries(r.T.stats).map(([k, [a, b]]) => `${a === b ? a : a + " à " + b} ${STATS[k].short}`).join(", ") : (E.isKey(r.special) ? "Clé de donjon" : "Objet spécial");
        return `<div class="li" style="align-items:flex-start">${r.tpl ? `<span class="icobox">${im(itemImg(r.tpl), "", r.name)}</span>` : `<span class="icobox">${im(resImg(r.special), "", r.name)}</span>`}<span class="grow"><span class="name">${h(r.name)}</span> <span class="muted xs">${r.T ? `niv. ${r.lvl} · ` : ""}${stats}${r.T && r.T.set && SETS[r.T.set] ? ` · ${h(SETS[r.T.set].name)}` : ""}</span>${ingHtml(r.ing)}${J.lvl < r.req ? `<span class="xs minus">${CRAFT_JOBS[job].name} niveau ${r.req} requis</span>` : ""}</span>
          <span class="row" style="gap:4px"><button class="btn sm" data-act="shoppin" data-k="${r.tpl ? "tpl" : "special"}" data-id="${h(r.tpl || r.special)}" title="Ajouter à la liste de courses">${S.shop.some((e) => e.id === (r.tpl || r.special)) ? "🛒 ✓" : "🛒"}</button><button class="btn sm ${ok ? "primary" : ""}" data-act="craft" ${r.tpl ? `data-tpl="${r.tpl}"` : `data-special="${h(r.special)}"`} ${ok ? "" : "disabled"}>Fabriquer</button></span></div>`; }).join("") || `<div class="empty">Aucune recette.</div>`}${total > 80 ? `<div class="empty">… ${total - 80} autres recettes : affinez la recherche.</div>` : ""}</div></section>`;
  return body;
}
function brisageHtml() {
  let body = "";
    const items = Object.values(S.items).filter((it) => !E.equippedBy(S, it.uid)).sort((a, b) => ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl);
    const focusOpts = `<option value="">Aucun focus</option>${STAT_ORDER.filter((k) => k !== "pa").map((k) => `<option value="${k}" ${ui.focus === k ? "selected" : ""}>Focus ${STATS[k].name}</option>`).join("")}`;
    const breakable = items.filter((it) => !it.radiant);
    body = `<p class="note">Briser un objet le détruit et donne des runes selon ses statistiques et son niveau (×1,5 pour un objet Rayonnant). Le coefficient baisse de 3 % à chaque brisage d'un même objet et remonte de 1 % toutes les ${E.COEF_REGEN_MIN} minutes.</p>
      <div class="row"><select data-act="focus" aria-label="Focus">${focusOpts}</select>
        ${breakable.length ? (ui.confirm === "breakall" ? `<span class="small">Briser les ${breakable.length} objets non équipés (hors Rayonnants) ?</span><button class="btn sm danger" data-act="breakall">Confirmer</button><button class="btn sm" data-act="cancel">Annuler</button>` : `<button class="btn sm" data-act="askbreakall">Tout briser (hors Rayonnants)</button>`) : ""}</div>
      <section class="panel"><div class="list">${items.map((it) => { const p = E.breakPreview(S, it.uid, ui.focus || null);
        const est = Object.entries(p.weights).map(([k, w]) => `${STATS[k].short} ≈ ${(w / (STATS[k].w * STATS[k].pts)).toFixed(1)}`).join(", ");
        return `<div class="li ${it.radiant ? "radiant" : ""}">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="muted xs">niv. ${ITEMS[it.tpl].lvl} · coefficient <span class="${p.coef < 60 ? "minus" : ""}">${p.coef} %</span></span><br><span class="xs muted">Runes simples estimées : ${est || "aucune"}</span></span>
          <button class="btn sm" data-act="break" data-uid="${it.uid}">Briser</button></div>`; }).join("") || `<div class="empty">Aucun objet à briser. Les objets équipés sont protégés.</div>`}</div></section>`;
  return body;
}
function toolHtml(id) {
  const tl = E.toolLvl(S, id); if (tl >= E.TOOL_MAX) return `<div class="row small">🔨 <b>${h(E.TOOL_NAMES[id])} ${tl}</b> <span class="tag good">niveau max</span> <span class="xs muted">(+${tl * 8} % de vitesse)</span></div>`;
  const R = E.toolCost(S, id); const lvOk = S.jobs[id].lvl >= R.lvl; const ok = lvOk && S.kamas >= R.kamas && R.ing.every(([r, q]) => (S.res[r] || 0) >= q);
  const pinned = S.shop.some((e) => e.k === "tool" && e.id === id);
  return `<div class="toolbox"><div class="row between small"><span>🔨 Outil actuel : <b>${tl ? h(E.TOOL_NAMES[id]) + " " + tl : "aucun"}</b> <span class="xs muted">(+${tl * 8} % de vitesse)</span></span><span class="xs muted">prochain : <b>${h(R.name)}</b></span></div>
    ${ingHtml(R.ing)}<div class="row small" style="margin-top:4px"><span class="${lvOk ? "plus" : "minus"} xs">${GATHER_JOBS[id].name} niv. ${R.lvl} requis</span><span class="xs"><span class="coin"></span> ${fmt(R.kamas)}</span>
    <button class="btn sm ${ok ? "primary" : ""}" data-act="tool" data-job="${id}" ${ok ? "" : "disabled"}>Fabriquer</button><button class="btn sm" data-act="shoppin" data-k="tool" data-id="${id}" title="Liste de courses">${pinned ? "🛒 ✓" : "🛒"}</button></div></div>`;
}
function recolteHtml() {
  const workers = S.chars.filter((c) => c.job);
  const fil = S.filon && S.filon.until > Date.now() ? S.filon : null;
  const jobs = Object.entries(GATHER_JOBS).map(([id, J]) => { const s = S.jobs[id]; const ws = workers.filter((c) => c.job.job === id);
    const nextRes = J.items.find(([, l]) => l > s.lvl);
    return `<div class="panel"><div class="phead"><div class="row">${im(jobImg(id), "joblogo", J.name)}<div><h2>${J.name}</h2><span class="xs muted">${ws.length ? ws.map((c) => h(c.name)).join(", ") + " récolte" + (ws.length > 1 ? "nt" : "") : "personne ne récolte"}</span></div></div><span class="lvlpill">niv. ${s.lvl}</span></div>
      <div class="pad stack" style="gap:8px">
        <div><div class="row between xs muted"><span>Expérience</span><span class="num">${fmt(s.xp)} / ${fmt(E.jobXpNeed(s.lvl))}</span></div><div class="bar xp"><i style="width:${pct(s.xp, E.jobXpNeed(s.lvl))}%"></i></div></div>
        ${ws.map((c) => `<div class="row small">${head(c)}<span class="grow">${im(resImg(c.job.res), "ico sm", c.job.res)} ${h(c.job.res)} <span class="xs muted">· ${E.gatherPeriod(S, c).toFixed(1)} s</span>${E.filonOn(S, c.job.res) ? ` <span class="tag good">filon ×2</span>` : ""}</span><button class="btn sm" data-act="gathersheet" data-cid="${c.id}">Changer</button></div><div class="bar green" data-wprog="${c.id}"><i style="width:${pct(c.job.prog, E.gatherPeriod(S, c))}%"></i></div>`).join("")}
        <button class="btn sm" data-act="gathersheet" data-job="${id}" style="align-self:flex-start">⛏ Envoyer un héros</button>
        ${toolHtml(id)}
        <div class="xs muted">Ressources : ${J.items.map(([r, l]) => `<span style="${l > s.lvl ? "opacity:.5" : ""}">${h(r)} (${l})</span>`).join(" · ")}${nextRes ? ` — prochaine : ${h(nextRes[0])} au niveau ${nextRes[1]}` : ""}</div>
      </div></div>`; }).join("");
  return `<p class="note">Un héros fait une seule activité : chasser avec l'équipe ou récolter la ressource de son choix. 1 % de chances de trouvaille (×5, parfois un ${h(E.RARE_COMPONENT)}). De temps en temps, un filon rare double le rendement d'une ressource pendant 10 minutes.</p>
    ${fil ? `<div class="awaitbar" style="margin:0">✨ Filon de <b>${h(fil.res)}</b> : rendement ×2 encore ${dur((fil.until - Date.now()) / 1000)}</div>` : ""}
    <section class="panel"><div class="phead"><h2>Vos héros</h2></div><div class="list">${S.chars.map((c) => `<div class="li">${head(c)}<span class="grow"><span class="name">${h(c.name)}</span> <span class="xs muted">niv. ${c.lvl}</span><br><span class="xs">${c.job ? `⛏ ${h(GATHER_JOBS[c.job.job].name)} : ${h(c.job.res)}` : c.inTeam ? "⚔ Chasse avec l'équipe" : "Au repos"}</span></span>
      ${c.job ? `<button class="btn sm" data-act="gathersheet" data-cid="${c.id}">Changer</button><button class="btn sm" data-act="unjob" data-id="${c.id}">Rappeler</button>` : `<button class="btn sm primary" data-act="gathersheet" data-cid="${c.id}">⛏ Récolter</button>`}</div>`).join("")}</div></section>
    <div class="grid2">${jobs}</div>`;
}
function renderMetiers() {
  const tabs = [["recolte", "Récolte"], ["craft", "Artisanat"]];
  $("#main").innerHTML = `<div class="pagehead"><h1>Métiers</h1></div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="mettab" data-v="${id}" aria-pressed="${ui.met === id}">${n}</button>`).join("")}</nav>
    <section class="stack">${ui.met === "craft" ? craftHtml() : recolteHtml()}</section>`;
}
function fmHtml() {
  const F = ui.fmF || (ui.fmF = { q: "", slot: "all", sort: "lvl", cid: "", eq: false, runes: false, fav: false });
  const runeStats = new Set(Object.keys(S.runes).filter((k) => S.runes[k] > 0).map((k) => k.split(":")[1]));
  let items = Object.values(S.items).filter((x) => { const T = ITEMS[x.tpl]; const by = E.equippedBy(S, x.uid);
    if (F.q && !T.name.toLowerCase().includes(F.q.toLowerCase())) return false;
    if (F.slot !== "all" && T.slot !== F.slot) return false;
    if (F.cid && (!by || by.id !== +F.cid)) return false;
    if (F.eq && !by) return false; if (F.fav && !x.fav) return false;
    if (F.runes && !Object.keys(T.stats).some((k) => runeStats.has(k) && T.stats[k][1] > 0)) return false;
    return !T.trophy; });
  items.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (F.sort === "jet" ? E.itemQuality(b) - E.itemQuality(a) : F.sort === "fm" ? (b.fm || 0) - (a.fm || 0) : ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl || (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0)));
  const total = items.length; items = items.slice(0, 120);
  if (!ui.fmSel || !S.items[ui.fmSel]) ui.fmSel = null;
  const it = ui.fmSel ? S.items[ui.fmSel] : null;
  let detail = `<div class="empty">Choisissez un objet à forgemager.</div>`;
  if (it) {
    const T = ITEMS[it.tpl];
    detail = `<div class="row">${itemIcon(it)}<div><b>${itemName(it)}</b><div class="xs muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${it.fm ? ` · ${it.fm} forgemagie${it.fm > 1 ? "s" : ""}` : ""}</div></div></div>
      ${Object.keys(T.stats).map((k) => { const [mn, mx] = T.stats[k]; const cur = it.stats[k] || 0; const runes = Object.entries(S.runes).filter(([rk, q]) => q > 0 && rk.split(":")[1] === k);
        const cap = mx > 0 ? mx + Math.max(1, Math.ceil(mx * 0.25)) : mx;
        return `<div class="fmline"><div><span class="statl">${sIco(k)}<b class="${cur > mx ? "bonus" : ""}">${statLine(k, cur)}</b></span> <span class="xs muted">jet ${mn} à ${mx}${mx > 0 ? ` · exo jusqu'à ${cap}` : ""}</span>
          <div class="runes">${mx <= 0 ? `<span class="xs muted">Caractéristique négative</span>` : runes.map(([rk, q]) => { const f = E.fmInfo(S, it.uid, rk); return f.ok ? `<button class="btn sm" data-act="fm" data-k="${rk}" data-tip="${h(`${E.runeName(rk)} : +${f.add} → ${f.nv}${f.over ? " (au-delà du jet max)" : ""} · ${Math.round(f.chance * 100)} % de réussite · ${f.kamas} kamas. Échec : la rune est perdue et parfois une autre caractéristique baisse.`)}">${E.runeName(rk)} ×${q} · <b>${Math.round(f.chance * 100)} %</b> · ${fmt(f.kamas)} k</button>` : `<span class="xs muted" data-tip="${h(f.why)}">${E.runeName(rk)} ×${q} : ${h(f.why)}</span>`; }).join("") || `<span class="xs muted">Aucune rune de ${h(STATS[k].name)} — brisez des objets qui en ont.</span>`}</div></div></div>`; }).join("")}
      ${it.fmLog && it.fmLog.length ? `<h3 class="sec">Historique</h3><div class="list">${it.fmLog.map((l) => `<div class="li xs"><span class="${l.ok ? "plus" : "minus"}">${l.ok ? "✓" : "✗"}</span><span class="grow">${h(l.txt)}</span><span class="muted">${ago(l.t)}</span></div>`).join("")}</div>` : ""}`;
  }
  return `<p class="note">La forgemagie améliore les jets d'un objet avec des runes (obtenues au brisage) et des kamas. En dessous du jet maximum, la réussite est élevée ; au-delà (« exo »), c'est risqué. Un échec détruit la rune et peut faire baisser une autre caractéristique.</p>
    <div class="row invbar"><input type="text" id="fmSearch" data-act="fmsearch" placeholder="Rechercher un objet…" value="${h(F.q)}">
      <select data-act="fmslot">${[["all", "Tous"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"], ["bouclier", "Boucliers"]].map(([v, n]) => `<option value="${v}" ${F.slot === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-act="fmcid"><option value="">Tous les héros</option>${S.chars.map((c) => `<option value="${c.id}" ${+F.cid === c.id ? "selected" : ""}>Porté par ${h(c.name)}</option>`).join("")}</select>
      <select data-act="fmsort">${[["lvl", "Niveau"], ["jet", "Jet"], ["fm", "Forgemagies"]].map(([v, n]) => `<option value="${v}" ${F.sort === v ? "selected" : ""}>Tri : ${n}</option>`).join("")}</select></div>
    <div class="row small">${[["eq", "Équipés seulement"], ["runes", "Runes disponibles"], ["fav", "★ Favoris"]].map(([k, n]) => `<button class="btn sm ${F[k] ? "primary" : ""}" data-act="fmtoggle" data-k="${k}">${n}</button>`).join("")}<span class="xs muted">${total} objet${total > 1 ? "s" : ""}</span></div>
    <div class="grid2"><section class="panel"><div class="phead"><h2>Objets</h2><span class="xs muted">${total > 120 ? "120 premiers" : total}</span></div><div class="list" style="max-height:560px;overflow:auto">${items.map((x) => `<div class="li ${x.radiant ? "radiant" : ""}" style="${ui.fmSel === x.uid ? "box-shadow:inset 0 0 0 2px var(--gold)" : ""}"><button class="btn sm" data-act="fmfav" data-uid="${x.uid}" title="Favori">${x.fav ? "★" : "☆"}</button>${itemIcon(x)}<span class="grow">${itemName(x)} <span class="xs muted">niv. ${ITEMS[x.tpl].lvl} · jet ${Math.round(E.itemQuality(x) * 100)} %${x.fm ? ` · ⚒ ${x.fm}` : ""}${E.equippedBy(S, x.uid) ? " · porté par " + h(E.equippedBy(S, x.uid).name) : ""}</span></span><button class="btn sm ${ui.fmSel === x.uid ? "primary" : ""}" data-act="fmsel" data-uid="${x.uid}">Choisir</button></div>`).join("") || `<div class="empty">Aucun objet ne correspond.</div>`}</div></section>
    <section class="panel"><div class="phead"><h2>Établi du forgemage</h2><span class="small"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b></span></div><div class="pad stack" style="gap:8px">${detail}</div></section></div>`;
}
function renderForge() {
  const tabs = [["fm", "Forgemagie"], ["brisage", "Brisage"], ["embleme", "Emblème"]];
  $("#main").innerHTML = `<div class="pagehead"><h1>Forgemagie</h1></div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="fgtab" data-v="${id}" aria-pressed="${ui.fg === id}">${n}</button>`).join("")}</nav>
    <section class="stack">${ui.fg === "brisage" ? brisageHtml() : ui.fg === "embleme" ? emblemView() : fmHtml()}</section>`;
}
/* ---------- QUÊTES ---------- */
function mainQuestHtml() {
  const cur = S.quest.step; const qp = E.questProgress(S);
  return `<section class="panel"><div class="phead"><h2>Quête principale</h2><span class="small muted num">${Math.min(cur, E.MAIN_QUEST.length)}/${E.MAIN_QUEST.length}</span></div><div class="pad stack" style="gap:8px">
    ${E.MAIN_QUEST.map((q, i) => `<div class="qcard ${i < cur ? "done" : i === cur ? "cur" : ""}" ${i > cur + 2 ? 'style="opacity:.35"' : ""}><span class="qnum">${i < cur ? "✓" : i + 1}</span><div class="grow"><b>${i > cur + 2 ? "???" : h(q.title)}</b><div class="small muted">${i > cur + 2 ? "Terminez les étapes précédentes." : h(q.txt)}</div>
      ${i === cur && qp ? `<div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div>` : ""}
      ${i <= cur + 2 && E.questExtraText(i) ? `<div class="xs" style="margin-top:4px">🎁 <span class="muted">${i < cur ? "Reçu" : "Récompense"} :</span> ${h(E.questExtraText(i))}</div>` : ""}</div>${i === cur && q.sub ? `<button class="btn sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>`).join("")}</div></section>`;
}
function shopHtml(id) {
  const Sh = E.SHOPS[id]; const have = S.tokens[Sh.cur] || 0;
  return `<section class="panel"><div class="phead"><h2>${Sh.icon} ${h(Sh.name)}</h2><span class="small"><b class="num">${fmt(have)}</b> ${h(Sh.curName.toLowerCase())}</span></div>
    <div class="pad hvgrid">${Sh.items.map((it) => { const owned = E.shopOwned(S, it); const C = it.cons ? CONSUMABLES[it.cons] : null;
      return `<div class="hv"><div class="top"><span class="em">${C ? C.icon : it.wing ? "🪽" : it.furn ? "🪑" : it.orn ? "🖼" : "🏷"}</span><div class="grow"><b>${h(E.shopItemName(S, it))}</b><div class="xs muted">${C ? h(C.desc) : it.wing ? "Couleur des ailes d'alignement (Héros → Ornement)" : it.furn ? "Meuble pour le futur Havre-Sac" : it.orn ? "Ornement de carte de héros" : "Titre affiché sur la carte"}</div></div></div>
        <button class="btn sm ${!owned && have >= it.cost ? "primary" : ""}" data-act="buyshop" data-shop="${id}" data-id="${it.id}" ${owned || have < it.cost || (id === "cite" && !S.align) ? "disabled" : ""}>${owned ? "Obtenu" : `${Sh.icon} ${it.cost}`}</button></div>`; }).join("")}</div></section>`;
}
function bountiesHtml() {
  return `<p class="note">Trois avis de recherche adaptés à votre niveau. Ils se remplissent automatiquement en chassant (ou en battant le boss demandé) et rapportent kamas, expérience et points d'alignement. Un nouvel avis remplace aussitôt celui qui est rempli.</p>
    <div class="bgrid">${(S.bounties || []).map((b) => { const m = MONSTERS[b.key]; const where = b.dg ? DUNGEONS[b.dg].name : E.SUBS[b.sub] ? E.SUBS[b.sub].name : "";
      return `<div class="bounty"><span class="wanted">AVIS DE RECHERCHE</span>${im(imgM(b.key), "", m.name)}<b>${h(m.name)}</b><span class="xs">${b.dg ? "Boss · " : ""}${h(where)} · niv. ${m.lvl[0]}–${m.lvl[1]}</span>
        <div class="row" style="width:100%"><div class="bar grow"><i style="width:${pct(b.prog, b.n)}%"></i></div><span class="num small">${b.prog}/${b.n}</span></div>
        <span class="small">Prime : <span class="coin"></span> <b>${fmt(b.kamas)}</b> · XP${S.align ? ` · +${b.axp} alignement` : ""}</span>
        <div class="row">${b.sub ? `<button class="btn sm" data-act="zoneview" data-id="${b.sub}" data-gotab="world">Y aller</button>` : `<button class="btn sm" data-act="worldtab" data-v="dungeons" data-gotab="world">Donjons</button>`}<button class="btn sm" data-act="reroll" data-id="${b.id}" ${S.kamas < E.rerollCost(S) && !S.cons.parchemin_avis ? "disabled" : ""}>Changer · ${S.cons.parchemin_avis ? "📜 gratuit" : fmt(E.rerollCost(S)) + " k"}</button></div></div>`; }).join("") || `<div class="empty">Aucun avis disponible.</div>`}</div>
    <p class="small muted">Avis remplis : <b>${fmt(S.cnt.bounty || 0)}</b> · chaque avis rapporte 1 jeton de chasseur (2 pour un boss) et parfois un coffre.${S.cons.parchemin_avis ? ` · ${S.cons.parchemin_avis} Parchemin${S.cons.parchemin_avis > 1 ? "s" : ""} d'Avis : changement gratuit.` : ""}</p>
    ${shopHtml("prime")}`;
}
function alignHtml() {
  const top = Math.max(...S.chars.map((c) => c.lvl));
  if (!S.align) {
    const can = top >= E.ALIGN_MIN_LVL;
    return `<section class="panel"><div class="phead"><h2>Alignement</h2>${can ? "" : `<span class="tag soft">🔒 niveau ${E.ALIGN_MIN_LVL}</span>`}</div><div class="pad stack">
      <p class="small">Choisissez votre camp : Bonta, la cité blanche, ou Brâkmar, la cité sombre. Puis un ordre. Les missions d'alignement, les avis de recherche et les boss de donjon vous feront monter en rang : vos ailes grandissent et vos bonus augmentent.${can ? "" : ` Atteignez le niveau ${E.ALIGN_MIN_LVL} pour choisir (votre meilleur héros est niveau ${top}).`}</p>
      <div class="alignpick">${Object.entries(E.ALIGN).map(([sid, A]) => `<div class="alignside" style="--c:${A.color}"><img class="badge" src="assets/i/${A.badge}.png" alt=""><h2 style="text-align:center">${A.name}</h2>
        <div class="xs muted" style="text-align:center">Camp : +2 % de ${A.bonusName} par rang</div>
        ${Object.entries(A.orders).map(([oid, O]) => `<div class="row between"><span><b>${h(O.name)}</b><br><span class="xs muted">${h(E.ORDER_BONUS[oid].txt)}</span></span><button class="btn sm ${can ? "primary" : ""}" data-act="align" data-side="${sid}" data-order="${oid}" ${can ? "" : "disabled"}>Rejoindre</button></div>`).join("")}</div>`).join("")}</div></div></section>`;
  }
  const A = S.align; const side = E.ALIGN[A.side]; const O = side.orders[A.order]; const r = E.alignRankIdx(S); const q = S.alignQuest;
  return `<section class="panel"><div class="phead"><div class="row"><img src="assets/i/${side.badge}.png" alt="" style="width:48px;height:48px;object-fit:contain"><div><h2>${side.adj} · ${h(O.name)}</h2><div class="small muted">Rang : <b style="color:var(--gold2)">${h(E.alignRankName(S))}</b> · niveau d'alignement ${A.lvl}/100</div></div></div></div>
    <div class="pad stack" style="gap:10px">
      <div>${A.lvl < 100 ? `<div class="row between xs muted"><span>vers le niveau ${A.lvl + 1}</span><span class="num">${fmt(A.xp)} / ${fmt(E.alignNeed(A.lvl))}</span></div><div class="bar"><i style="width:${pct(A.xp, E.alignNeed(A.lvl))}%"></i></div>` : `<span class="tag good">Niveau maximum</span>`}</div>
      <div class="row small">${O.ranks.map((n, i) => `<span class="tag ${i < r ? "good" : "soft"}">${i + 1}. ${h(n)} (${(i + 1) * 20})</span>`).join("")}</div>
      <div class="small">Bonus actuels : <b class="plus">+${2 * r} % ${side.bonusName}</b> (camp) · <b class="plus">${h(E.ORDER_BONUS[A.order].txt.replace("par rang", ""))}× ${r}</b> (ordre)</div>
      ${q ? `<div class="qcard cur"><span class="qnum">⚔</span><div class="grow"><b>${h(q.title)}</b><div class="small muted">${h(q.txt)}</div><div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(q.prog, q.n)}%"></i></div><span class="num small">${q.prog}/${q.n}</span></div><div class="xs muted">Récompense : ${fmt(q.axp)} points d'alignement, ${fmt(q.kamas)} kamas</div></div>${q.sub ? `<button class="btn sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>` : ""}
      <div class="row small"><span class="muted">Changer d'ordre :</span>${Object.entries(side.orders).filter(([oid]) => oid !== A.order).map(([oid, O2]) => `<button class="btn sm" data-act="align" data-side="${A.side}" data-order="${oid}">${h(O2.name)}</button>`).join("")}
        <span class="xs muted">Insignes : <b>${fmt(S.tokens.insignes || 0)}</b> (3 par mission, 5 pour un boss)</span>
        ${ui.confirm === "traitre" ? `<button class="btn sm danger" data-act="align" data-side="${A.side === "bonta" ? "brakmar" : "bonta"}" data-order="coeur">Confirmer : rejoindre ${A.side === "bonta" ? "Brâkmar" : "Bonta"} (tout l'alignement est perdu)</button>` : `<button class="btn sm" data-act="asktraitre">Changer de camp…</button>`}</div>
    </div></section>${shopHtml("cite")}`;
}
function almanaxHtml() {
  const A = E.almanax(S); const d = new Date(); const have = S.res[A.res] || 0;
  return `<section class="panel"><div class="phead"><h2>📅 Almanax</h2><span class="small muted">offrandes : ${S.cnt.almanax || 0}</span></div><div class="pad stack">
    <div class="almanax"><div class="cal"><b>${d.getDate()}</b><span>${d.toLocaleDateString("fr-FR", { month: "short" })}</span></div>
      <div class="grow stack" style="gap:6px"><div>Offrande du jour : ${im(resImg(A.res), "ico sm", A.res)} <b>${A.qty} × ${h(A.res)}</b> <span class="small muted">(vous en avez ${fmt(have)})</span></div>
        <div>Bonus du jour : <b class="plus">${h(A.bonus.name)}</b> jusqu'à minuit, et <span class="coin"></span> ${fmt(A.kamas)} kamas</div>
        <div>${A.done ? `<span class="tag good">Offrande faite aujourd'hui ✓</span>` : `<button class="btn primary" data-act="almanax" ${have >= A.qty ? "" : "disabled"}>Faire l'offrande</button>`}</div></div></div>
    <div><b>Série : ${S.almStreak.n || 0} jour${(S.almStreak.n || 0) > 1 ? "s" : ""}</b> <span class="xs muted">(un jour manqué fait redescendre d'un palier)</span>
      <div class="row" style="margin-top:6px">${E.ALM_TIERS.map((t) => { const R = E.ALM_TIERS_R[t]; const txt = R.lot ? "lot de ressources" : R.cons ? CONSUMABLES[R.cons].name : R.furn ? `meuble « ${R.furn} »` : `titre « ${R.title} » + ornement`; return `<span class="tag ${(S.almStreak.n || 0) >= t ? "good" : "soft"}">${t} j : ${h(txt)}</span>`; }).join("")}<span class="tag soft">puis tous les 30 j : Coffre en or</span></div></div>
    <p class="note">L'offrande change chaque jour et dépend de votre niveau. Les ressources viennent des monstres ; consultez l'encyclopédie pour savoir qui les lâche.</p></div></section>`;
}
function achHtml() {
  const cats = [...new Set(E.ACH.map((a) => a.cat))]; const n = Object.keys(S.ach).length;
  const ICO = { Progression: "⭐", Combat: "⚔", Donjons: "🏰", Chasse: "🏹", Objets: "✦", Métiers: "⛏", Forgemagie: "⚒", Quêtes: "📜", Alignement: "🪽", "Havre-Sac": "🏠" };
  return `<section class="panel"><div class="phead"><h2>Ornements</h2><span class="xs muted">à équiper dans Héros (contour de la carte)</span></div><div class="pad achgrid">${Object.entries(E.ORN).map(([id, O]) => `<div class="ach ${E.ornUnlocked(S, id) ? "ok" : ""}"><span class="ic">${E.ornUnlocked(S, id) ? "✨" : "🔒"}</span><span><b>${h(O.name(S))}</b><br><span class="xs muted">${h(O.req)}</span></span></div>`).join("")}</div></section>
    <section class="panel"><div class="phead"><h2>Succès</h2><span class="small muted num">${n}/${E.ACH.length}</span></div><div class="pad stack">${cats.map((cat) => `<h3 class="sec">${ICO[cat] || "•"} ${h(cat)}</h3><div class="achgrid">${E.ACH.filter((a) => a.cat === cat).map((a) => `<div class="ach ${S.ach[a.id] ? "ok" : ""}"><span class="ic">${S.ach[a.id] ? "🏆" : "·"}</span><span><b>${h(a.name)}</b><br><span class="xs muted">${h(a.desc)} · ${fmt(a.kamas)} k${a.title ? ` · titre « ${h(a.title)} »` : ""}</span></span></div>`).join("")}</div>`).join("")}</div></section>`;
}
function renderQuests() {
  const tabs = [["main", "Quête principale"], ["bounty", "Avis de recherche"], ["align", "Alignement"], ["almanax", "Almanax"], ["ach", "Succès"]];
  const body = ui.qt === "bounty" ? bountiesHtml() : ui.qt === "align" ? alignHtml() : ui.qt === "almanax" ? almanaxHtml() : ui.qt === "ach" ? achHtml() : mainQuestHtml();
  $("#main").innerHTML = `<div class="pagehead"><h1>Quêtes</h1></div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="qtab" data-v="${id}" aria-pressed="${ui.qt === id}">${n}</button>`).join("")}</nav>
    <section class="stack">${body}</section>`;
}
function emblemView() {
  const em = S.emblem; const need = E.emblemXpNeed(em.lvl); const lines = E.emblemLines(em.lvl); const active = E.isSolo(S);
  const nextRank = EMBLEM.ranks.find(([l]) => l > em.lvl);
  const runes = Object.entries(S.runes).sort((a, b) => E.runeInfo(b[0]).weight - E.runeInfo(a[0]).weight); const used = Object.keys(em.stats);
  const perkBlock = Object.entries(EMBLEM.perks).map(([tier, opts]) => { const chosen = em.perks[tier];
    return `<div class="li"><span class="grow"><span class="name">Palier ${tier}</span><br>${chosen ? `<span class="small">${h(opts.find((o) => o.id === chosen).name)} : ${h(opts.find((o) => o.id === chosen).desc)}</span>` :
      em.lvl >= +tier ? `<span class="row" style="margin-top:4px">${opts.map((o) => `<button class="btn sm" data-act="perk" data-t="${tier}" data-id="${o.id}" title="${h(o.desc)}">${h(o.name)}</button>`).join("")}</span>` :
      `<span class="xs muted">Au choix : ${opts.map((o) => `${h(o.name)} (${h(o.desc)})`).join(" · ")}</span>`}</span></div>`; }).join("");
  return `<div class="panel"><div class="pad row" style="gap:16px;align-items:center">
      <div style="width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--gold2),var(--gold) 60%,#8a5d14);display:grid;place-items:center;border:3px solid var(--frame);flex:none;color:#2a1a08;text-align:center"><b class="num" style="font-size:24px;line-height:1">${em.lvl}</b></div>
      <div class="grow stack" style="gap:6px"><div class="row between"><h2>Emblème du Solitaire</h2><span class="tag ${active ? "good" : "soft"}">${active ? "Actif (solo)" : "Inactif : jouez seul"}</span></div>
        <div class="small muted">Rang ${E.emblemRank(em.lvl)}${nextRank ? ` · « ${nextRank[1]} » au niveau ${nextRank[0]}` : ""}</div>
        <div class="bar xp"><i style="width:${pct(em.xp, need)}%"></i></div><div class="xs muted num">${em.lvl >= EMBLEM.maxLvl ? "Niveau maximum" : `${fmt(em.xp)} / ${fmt(need)} poids de runes`} · ${lines} ligne${lines > 1 ? "s" : ""}</div></div></div></div>
  <div class="grid2">
    <div class="panel"><div class="phead"><h2>Lignes</h2><span class="muted xs">${used.length}/${lines}</span></div>
      <div class="list">${used.map((k) => { const cap = E.emblemCap(k, em.lvl); return `<div class="li"><span class="grow"><span class="name">${STATS[k].name}</span><div class="bar" style="margin-top:4px"><i style="width:${pct(em.stats[k], cap)}%"></i></div></span><span class="num">${fmt(em.stats[k])} / ${fmt(cap)}</span>
        ${ui.confirm === "line:" + k ? `<button class="btn sm danger" data-act="remline" data-k="${k}">Effacer</button>` : `<button class="btn sm" data-act="askline" data-k="${k}" title="Libère la ligne (la valeur est perdue)">×</button>`}</div>`; }).join("") || `<div class="empty">Nourrissez l'Emblème avec une rune pour ouvrir une ligne.</div>`}</div></div>
    <div class="panel"><div class="phead"><h2>Nourrir avec des runes</h2></div>
      <div class="list">${runes.map(([k, q]) => { const i = E.runeInfo(k); const blocked = !used.includes(i.stat) && used.length >= lines;
        return `<div class="li"><span class="grow"><span class="name">${E.runeName(k)}</span> <span class="xs muted num">×${fmt(q)} · +${i.pts} ${STATS[i.stat].short} · ${i.weight} XP</span>${blocked ? `<br><span class="xs muted">Plus de ligne libre : seule l'expérience sera gagnée.</span>` : ""}</span>
          <button class="btn sm" data-act="feed" data-k="${k}" data-q="1">×1</button><button class="btn sm" data-act="feed" data-k="${k}" data-q="${q}">Tout</button></div>`; }).join("") || `<div class="empty">Aucune rune. Brisez des objets pour en obtenir.</div>`}</div></div></div>
  <div class="panel"><div class="phead"><h2>Paliers</h2></div><div class="list">${perkBlock}
    <div class="li"><span class="grow xs muted">Niveau 100 : 3e ligne · 400 : 4e ligne · 700 : 5e ligne · 850 : plafonds ×1,5 · 1000 : +1 PA</span></div></div></div>`;
}

/* ---------- feuilles ---------- */
function openSheet(html) { $("#sheet").innerHTML = `<div class="sheet-bg" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; }
function closeSheet() { $("#sheet").innerHTML = ""; ui.giveTo = null; }
function recruitSheet() {
  const cost = E.recruitCost(S.chars.length + 1); const top = Math.max(...S.chars.map((c) => c.lvl)); const sex = ui.startSex || CLASSES[ui.startCls].sex;
  openSheet(`<h2>Recruter un héros</h2>
    <p class="small muted">Coût : <b>${cost ? fmt(cost) + " kamas" : "gratuit"}</b> (vous avez ${fmt(S.kamas)}). La recrue arrive au niveau ${Math.max(1, Math.floor(top / 2))}. Plus l'équipe est grande, plus le bonus Esprit Libre diminue.</p>
    ${classPick(ui.startCls, sex)}${classInfo(ui.startCls)}
    <div class="row"><span class="small muted">Apparence</span><span class="seg">${[["m", "Masculin"], ["f", "Féminin"]].map(([v, n]) => `<button data-act="startsex" data-v="${v}" aria-pressed="${sex === v}">${n}</button>`).join("")}</span></div>
    <label class="stack" style="gap:4px"><span class="small muted">Nom</span><input type="text" id="recName" maxlength="20" value="${h(ui.recName || D.NAMES[Math.floor(Math.random() * D.NAMES.length)])}"></label>
    <div class="row"><button class="btn primary" data-act="recruit" ${S.kamas < cost ? "disabled" : ""}>Recruter</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
}
function giveSheet(uid) {
  const it = S.items[uid]; const T = ITEMS[it.tpl]; ui.giveTo = uid;
  openSheet(`<div class="row">${itemIcon(it)}<h2>${itemName(it)}</h2></div><p class="small muted">Niveau ${T.lvl} requis<br>${itemStatsHtml(it)}</p>
    <div class="list">${S.chars.map((c) => { const slot = E.slotFor(c, it);
      return `<div class="li">${head(c)}<span class="grow"><span class="name">${h(c.name)}</span> <span class="muted xs">niv. ${c.lvl}</span><br>${deltaHtml(c, slot, uid)}</span><button class="btn sm primary" data-act="giveto" data-id="${c.id}" ${T.lvl > c.lvl ? "disabled" : ""}>${T.lvl > c.lvl ? "Niv. trop bas" : "Équiper"}</button></div>`; }).join("")}</div>
    <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function gatherSheet() {
  const g = ui.gs; const c = char(g.cid) || S.chars[0]; g.cid = c.id;
  if (!g.job) g.job = c.job ? c.job.job : "bucheron";
  const list = E.jobRes(g.job); const lv = S.jobs[g.job].lvl;
  if (!g.res || !list.find((x) => x[0] === g.res && x[1] <= lv)) g.res = (c.job && c.job.job === g.job ? c.job.res : null) || (list.filter((x) => x[1] <= lv).pop() || [])[0];
  const per = E.gatherTime(lv) / E.gatherSpeed(S, g.job, c);
  openSheet(`<h2>⛏ Envoyer récolter</h2>
    <p class="small muted">Le héros quitte l'équipe de chasse pendant qu'il récolte. Les niveaux de métier sont communs à tous vos héros.</p>
    <div class="stack" style="gap:8px">
      <label class="row small"><span style="min-width:90px">Héros</span><select data-act="gs" data-k="cid">${S.chars.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${h(x.name)} (niv. ${x.lvl})${x.job ? " — récolte déjà" : ""}</option>`).join("")}</select></label>
      <div class="row small"><span style="min-width:90px">Métier</span>${Object.keys(GATHER_JOBS).map((j) => `<button class="jobpick ${j === g.job ? "on" : ""}" data-act="gsjob" data-v="${j}" data-tip="${h(GATHER_JOBS[j].name)} niv. ${S.jobs[j].lvl}">${im(jobImg(j), "joblogo sm", GATHER_JOBS[j].name)}</button>`).join("")}</div>
      <div class="respick">${list.map(([r, l]) => `<button class="${r === g.res ? "on" : ""}" data-act="gsres" data-v="${h(r)}" ${l > lv ? "disabled" : ""} data-tip="${h(r)} · niveau ${l}${l > lv ? " (verrouillé)" : ""} · en stock : ${fmt(S.res[r] || 0)}">${im(resImg(r), "ico", r)}<span class="xs">${h(r)}</span>${l > lv ? `<i class="xs">niv. ${l}</i>` : ""}</button>`).join("")}</div>
      ${g.res ? `<div class="small muted">≈ ${per.toFixed(1)} s par récolte${E.filonOn(S, g.res) ? " · <b class='plus'>filon actif ×2 !</b>" : ""}${c.cls === "sadi" && (g.job === "bucheron" || g.job === "alchimiste") ? " · passif Sadida" : ""}${c.cls === "steam" && g.job === "pecheur" ? " · passif Steamer" : ""}</div>` : ""}
    </div>
    <div class="row"><button class="btn primary" data-act="gsgo" ${g.res ? "" : "disabled"}>Envoyer</button>${c.job ? `<button class="btn" data-act="unjob" data-id="${c.id}">Rappeler pour chasser</button>` : ""}<button class="btn" data-act="closesheet">Annuler</button></div>`);
}
function optionsSheet() {
  openSheet(`<h2>Options</h2>
    <div class="stack small">
      <div class="row"><span class="muted">Animations de combat</span><span class="seg">${[[false, "Complètes"], [true, "Réduites"]].map(([v, n]) => `<button data-act="setreduced" data-v="${v ? 1 : 0}" aria-pressed="${!!S.settings.reduced === v}">${n}</button>`).join("")}</span></div>
      <div><b>Sauvegarde</b><br><span class="muted">Automatique dans ce navigateur${lastSaveOk ? ` · dernière : ${new Date(lastSaveOk).toLocaleTimeString("fr-FR")}` : ""}. Pour changer d'appareil, exportez puis importez.</span></div>
      <div class="row"><button class="btn sm" data-act="savenow">Sauvegarder maintenant</button></div>
      <div><b>Exporter</b><textarea id="exp" readonly>${h(btoa(unescape(encodeURIComponent(E.serialize(S)))))}</textarea><button class="btn sm" data-act="copyexp">Copier</button></div>
      <div><b>Importer</b> <span class="muted">(remplace la partie actuelle ; les sauvegardes v1 sont converties)</span><textarea id="imp" placeholder="Collez la sauvegarde ici"></textarea><button class="btn sm" data-act="import">Importer</button> <span id="impmsg" class="minus"></span></div>
      <div><b>Nouvelle partie</b><br>${ui.confirm === "reset" ? `<span class="minus">Toute la progression sera effacée.</span> <button class="btn sm danger" data-act="reset">Effacer et recommencer</button> <button class="btn sm" data-act="cancelreset">Annuler</button>` : `<button class="btn sm danger" data-act="askreset">Recommencer depuis le début</button>`}</div>
      <div class="row"><a class="btn sm" href="${DISCORD}" target="_blank" rel="noopener">💬 Discord</a><button class="btn sm" data-act="reportbug">🐞 Signaler un bug</button></div>
      <div class="row"><button class="btn sm" data-act="changelog">Notes de mise à jour</button>${isStandalone() ? `<span class="tag good">Application installée</span>` : `<button class="btn sm primary" data-act="installgame">📲 Installer idlus</button>`}</div>
      <p class="note">Version ${GAME_VERSION} « ${h(CHANGELOG[0].name)} » · Données DOFUS via DofusDB (${h(D.META.built)}). Projet de fan non officiel, sans lien avec Ankama Games.</p>
    </div><div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function offlineSheet(r) {
  const res = Object.entries(r.res).sort((a, b) => b[1] - a[1]);
  openSheet(`<h2>Pendant votre absence</h2>
    <p class="small">Absent ${dur(r.seconds)}. ${r.fights ? `Votre équipe a continué à ${Math.round(E.OFFLINE_RATE * 100 + E.bonus(S, "offrate"))} % de son efficacité : <b>${fmt(r.wins)}</b> combats gagnés, <span class="coin"></span> <b>+${fmt(r.kamas)}</b> kamas${r.items ? `, ${r.items} objet${r.items > 1 ? "s" : ""}` : ""}.` : "Votre équipe ne chassait pas ; seuls les héros en récolte ont travaillé."}</p>
    ${r.fights ? `<p class="xs muted">${fmt(r.fights)} combats tentés · ${Math.round((r.winRate || 0) * 100)} % de victoires (d'après vos derniers combats) · ~${r.fightLen || "?"} s par combat.</p>` : ""}
    ${r.lvls.length ? `<p class="small">${r.lvls.map(([n, a, b]) => `⬆ ${h(n)} : niveau ${a} → <b>${b}</b>`).join("<br>")}</p>` : ""}
    ${r.archis && r.archis.length ? `<p class="small" style="color:var(--archi);font-weight:700">Archimonstres vaincus : ${r.archis.map((k) => h(MONSTERS[k] ? MONSTERS[k].name : k)).join(", ")}</p>` : ""}
    ${(r.newItems || []).filter((u) => S.items[u]).length ? `<h3 class="sec">Objets obtenus</h3><div class="list small" style="max-height:220px;overflow:auto">${r.newItems.filter((u) => S.items[u]).map((u) => { const it = S.items[u]; const T = ITEMS[it.tpl];
        const best = E.team(S).filter((c) => T.lvl <= c.lvl).map((c) => { const sl = T.slot === "anneau" ? (c.equip.anneau1 ? "anneau2" : "anneau1") : T.slot === "dofus" ? null : T.slot; const cur = sl ? S.items[c.equip[sl]] : null; return { c, gain: itemScore(c, it) - itemScore(c, cur) }; }).sort((a, b) => b.gain - a.gain)[0];
        return `<div class="li">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="xs muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %</span>${best && best.gain > 1 ? `<br><span class="xs" style="color:var(--good)">▲ mieux pour ${h(best.c.name)}</span>` : ""}</span>${best && best.gain > 1 ? `<button class="btn sm" data-act="offequip" data-uid="${u}" data-id="${best.c.id}">Équiper</button>` : ""}</div>`; }).join("")}</div>` : ""}
    ${res.length ? `<h3 class="sec">Ressources</h3><div class="list small" style="max-height:240px;overflow:auto">${res.map(([n, q]) => `<div class="li">${im(resImg(n), "ico sm", n)}<span class="grow">${h(n)}</span><span class="num">+${fmt(q)}</span></div>`).join("")}</div>` : ""}
    <div><button class="btn primary" data-act="closesheet">Continuer</button></div>`);
}
function migrationSheet(list) {
  openSheet(`<h2>Bienvenue dans la v3 !</h2><p class="small">Votre partie a été convertie : niveaux, kamas, ressources, métiers et Emblème sont conservés.</p>
    <ul class="small">${list.map((x) => `<li>${h(x)}</li>`).join("")}</ul>
    <p class="small muted">Nouveautés à découvrir : les vrais sorts de DOFUS et leurs variantes (Héros › Sorts), le profil de build et le simulateur de dégâts, les challenges (bouton 🎯 en combat), les mécaniques de boss et les nouvelles zones jusqu'au niveau 120.</p>
    <div><button class="btn primary" data-act="closesheet">C'est parti</button></div>`);
}

/* ---------- rendu ---------- */
/* ---------- Application installable (PWA) ---------- */
let installEvt = null;
const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; renderUpdBar(); });
window.addEventListener("appinstalled", () => { installEvt = null; if (S) { S.installed = true; dirty = true; } toast("idlus est installé ! Retrouvez-le sur votre écran d'accueil.", "rare"); renderUpdBar(); });
const canInstall = () => !isStandalone() && (installEvt || isIOS());
function installGame() {
  if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(() => { installEvt = null; renderUpdBar(); }); return; }
  openSheet(`<h2>📲 Installer idlus</h2>${isIOS() ? `<ol class="small" style="line-height:1.7;padding-left:20px">
      <li>Ouvrez cette page dans <b>Safari</b>.</li>
      <li>Touchez le bouton <b>Partager</b> <span style="font-size:18px">⎋</span> (le carré avec une flèche vers le haut).</li>
      <li>Choisissez <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li></ol>`
    : `<p class="small">Dans le menu de votre navigateur (⋮ ou ⋯), choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>`}
    <p class="xs muted">Votre partie est conservée : l'application utilise la même sauvegarde que le site.</p><div><button class="btn primary" data-act="closesheet">Compris</button></div>`);
}
function renderUpdBar() {
  const el = $("#updbar"); if (!el) return;
  let html = "";
  if (ui.newVersion) html += `<div class="updbar new"><span>🆕 La version <b>${h(ui.newVersion)}</b> est en ligne.</span><button class="btn sm primary" data-act="reloadgame">Recharger</button><button class="btn sm" data-act="hidenewv" aria-label="Plus tard">Plus tard</button></div>`;
  if (S && canInstall() && (S.sessions || 0) >= 3 && !S.installHide && S.seenVersion === GAME_VERSION) html += `<div class="updbar new"><span>📲 Jouez plus facilement : installez <b>idlus</b> sur votre ${isIOS() || /android/i.test(navigator.userAgent) ? "téléphone" : "ordinateur"}.</span><button class="btn sm primary" data-act="installgame">Installer</button><button class="btn sm" data-act="installhide">Non merci</button></div>`;
  if (S && S.seenVersion !== GAME_VERSION) {
    const missed = CHANGELOG.filter((c) => !S.seenVersion || vNum(c.v) > vNum(S.seenVersion)); const cur = CHANGELOG[0];
    html += `<div class="updbar"><div class="grow"><div><b>✨ Mise à jour ${h(cur.v)} « ${h(cur.name)} » appliquée</b>${missed.length > 1 ? ` <span class="xs muted">(+ ${missed.length - 1} version${missed.length > 2 ? "s" : ""} précédente${missed.length > 2 ? "s" : ""})</span>` : ""}</div>
      <ul>${cur.items.slice(0, 4).map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>
      <div class="col"><button class="btn sm" data-act="changelog">Tout voir</button><button class="btn sm primary" data-act="updseen">OK</button></div></div>`;
  }
  if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; }
}
function changelogSheet() {
  openSheet(`<h2>Notes de mise à jour</h2><div class="stack small">${CHANGELOG.map((c) => `<div><b>${h(c.v)} « ${h(c.name)} »</b><ul>${c.items.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>`).join("")}</div><div><button class="btn primary" data-act="closesheet">Fermer</button></div>`);
}
/* nouvelle version en ligne pendant que le jeu est ouvert */
function checkNewVersion() {
  try { fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j && j.v && vNum(j.v) > vNum(GAME_VERSION) && ui.newVersion !== j.v && ui.hiddenV !== j.v) { ui.newVersion = j.v; renderUpdBar(); }
  }).catch(() => {}); } catch (e) {}
}
function render() {
  if (!S) { renderUpdBar(); return renderStart(); }
  renderNav(); renderStatus(); renderUpdBar();
  if (ui.tab === "home") renderHome();
  else if (ui.tab === "world") renderWorld();
  else if (ui.tab === "combat") renderCombat();
  else if (ui.tab === "heroes") renderHeroes();
  else if (ui.tab === "inv") renderInventory();
  else if (ui.tab === "metiers") renderMetiers();
  else if (ui.tab === "forge") renderForge();
  else if (ui.tab === "quests") renderQuests();
  else { ui.tab = "home"; renderHome(); }
}
function toast(txt, kind) {
  const box = $("#toasts"); const d = document.createElement("div");
  d.className = "toast " + (kind === "rare" ? "rare" : kind === "radiant" ? "radiant" : ""); d.textContent = txt; box.prepend(d);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => d.remove(), kind === "rare" || kind === "radiant" ? 6500 : 3500);
}
const msg = (r) => { if (typeof r === "string") toast(r); };
function setTheme() { if (S) S.settings.theme = "dark"; document.documentElement.dataset.theme = "dark"; document.body.classList.toggle("reduced", !!(S && S.settings.reduced)); }

/* ---------- actions ---------- */
document.addEventListener("click", (ev) => {
  const tipT = ev.target.closest("[data-tip],[data-tipitem]");
  if (!canHover && tipT && !ev.target.closest("[data-tab],[data-act]")) { showTip(tipT); return; }
  hideTip();
  const t = ev.target.closest("[data-tab],[data-act]"); if (!t) return;
  if (t.dataset.gotab && S) { ui.tab = t.dataset.gotab; closeSheet(); }
  if (t.dataset.tab) { if (!S) return; ui.newResDone = false; ui.tab = t.dataset.tab; ui.slot = null; ui.confirm = null; if (ui.tab === "world" && t.closest("#nav")) ui.zoneView = null; closeSheet(); render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.act;
  if (a === "closesheet") { if (t.classList.contains("sheet-bg") && ev.target !== t) return; closeSheet(); if (S) render(); return; }
  if (t.tagName === "SELECT" || (t.tagName === "INPUT" && t.type !== "checkbox")) return;
  const d = t.dataset; const c = ui.cid && S ? char(ui.cid) : null;
  switch (a) {
    case "startcls": { const n = $("#startName") || $("#recName"); if (n) { if (S) ui.recName = n.value; else ui.startName = n.value; } ui.startCls = d.cls; ui.startSex = null; if (!S) renderStart(); else recruitSheet(); return; }
    case "startsex": { const n = $("#startName") || $("#recName"); if (n) { if (S) ui.recName = n.value; else ui.startName = n.value; } ui.startSex = d.v; if (!S) renderStart(); else recruitSheet(); return; }
    case "startgame": { const name = ($("#startName").value || "").trim() || "Aventurier"; S = E.newState(name.slice(0, 20), ui.startCls); S.seenVersion = GAME_VERSION; S.chars[0].sex = ui.startSex || CLASSES[ui.startCls].sex; setTheme(document.documentElement.dataset.theme || "dark"); ui.cid = S.chars[0].id; ui.tab = "world"; dirty = true; saveNow(); render(); toast("Choisissez une zone pour partir chasser !"); return; }
    case "setreduced": S.settings.reduced = d.v === "1"; setTheme(); optionsSheet(); render(); return;
    case "hometab": ui.home = d.v; break;
    case "havre": { const r = E.buyHavre(S, d.id); if (r) { toast(r); return; } toast(`${E.HAVRE.find((x) => x.id === d.id).name} amélioré !`); break; }
    case "mettab": ui.met = d.v; ui.confirm = null; break;
    case "fgtab": ui.fg = d.v; ui.confirm = null; break;
    case "qtab": ui.qt = d.v; ui.confirm = null; break;
    case "goquest": ui.tab = "quests"; ui.qt = d.v; break;
    case "gathersheet": ui.gs = { cid: d.cid ? +d.cid : (ui.cid || S.chars[0].id), job: d.job || null }; gatherSheet(); return;
    case "gsjob": ui.gs.job = d.v; ui.gs.res = null; gatherSheet(); return;
    case "gsres": ui.gs.res = d.v; gatherSheet(); return;
    case "gsgo": { const g = ui.gs; const r = E.setJob(S, g.cid, g.job, g.res); if (r) { toast(r); return; } closeSheet(); toast(`${char(g.cid).name} part récolter.`); break; }
    case "unjob": { E.setJob(S, +d.id, null); closeSheet(); break; }
    case "tool": msg(E.upgradeTool(S, d.job)); break;
    case "shoppin": { const i = S.shop.findIndex((e) => e.k === d.k && e.id === d.id); if (i >= 0) { S.shop.splice(i, 1); toast("Retiré de la liste de courses."); } else { S.shop.push({ k: d.k, id: d.id }); toast("Ajouté à la liste de courses (Accueil)."); } break; }
    case "shopdel": S.shop.splice(+d.i, 1); break;
    case "rescat": ui.resCat = d.v; break;
    case "resview": ui.resView = d.v; break;
    case "ressel": ui.resSel = d.n || null; break;
    case "resfav": if (S.resFav[d.n]) delete S.resFav[d.n]; else S.resFav[d.n] = 1; break;
    case "respickmode": ui.resPick = !ui.resPick; ui.resPicked = new Set(); break;
    case "respick": { ui.resPicked = ui.resPicked || new Set(); if (ui.resPicked.has(d.n)) ui.resPicked.delete(d.n); else ui.resPicked.add(d.n); break; }
    case "sellpicked": { let k = 0; (ui.resPicked || new Set()).forEach((n) => (k += E.sellRes(S, n, S.res[n] || 0))); ui.resPicked = new Set(); ui.resPick = false; toast(`Vendu pour ${fmt(k)} kamas.`); break; }
    case "asksellunused": ui.confirm = "sellunused"; break;
    case "sellunused": { const IX = resIndex(); let k = 0; Object.keys(S.res).forEach((n) => { if (!IX.use[n] && !E.isKey(n) && n !== E.RARE_COMPONENT && !S.resFav[n]) k += E.sellRes(S, n, S.res[n]); }); ui.confirm = null; toast(`Ressources inutilisées vendues : ${fmt(k)} kamas.`); break; }
    case "fmfav": { const it = S.items[+d.uid]; if (it) it.fav = !it.fav; break; }
    case "fmtoggle": ui.fmF[d.k] = !ui.fmF[d.k]; break;
    case "fmsel": ui.fmSel = +d.uid; break;
    case "fmgo": ui.tab = "forge"; ui.fg = "fm"; ui.fmSel = +d.uid; window.scrollTo(0, 0); break;
    case "fm": { const r = E.forgemage(S, ui.fmSel, d.k); if (r.err) { toast(r.err); return; } toast(r.txt, r.ok ? "rare" : ""); break; }
    case "reroll": msg(E.rerollBounty(S, +d.id)); break;
    case "buyshop": msg(E.buyShop(S, d.shop, d.id)); break;
    case "align": { const r = E.chooseAlign(S, d.side, d.order); ui.confirm = null; if (r) { toast(r); return; } break; }
    case "asktraitre": ui.confirm = "traitre"; break;
    case "almanax": { const r = E.almanaxOffer(S); if (r) { toast(r); return; } break; }
    case "manual": S.settings.manual = d.v === "1"; toast(S.settings.manual ? "Mode manuel : à chaque tour d'un héros, choisissez un sort puis une cible." : "Mode automatique."); break;
    case "mspell": { const F = S.fight; if (!F || !F.await) return; const me = F.ents[F.await.ei]; const sp = E.spellDef(me.cls, d.id);
      if (["dmg", "drain", "dot", "aoe", "heal"].includes(E.spellKind(E.spellGrade(sp, me.lvl)))) { ui.manualSpell = ui.manualSpell === sp.id ? null : sp.id; const bar = $("#spells"); if (bar) bar.dataset.k = ""; updateCombat(false); return; }
      const r = E.manualCast(S, sp.id, null); if (r) toast(r); ui.manualSpell = null; updateCombat(false); return; }
    case "mtarget": { const F = S.fight; if (!F || !F.await || !ui.manualSpell) return; const r = E.manualCast(S, ui.manualSpell, +t.dataset.i); if (r) { toast(r); return; } ui.manualSpell = null; const bar = $("#spells"); if (bar) bar.dataset.k = ""; updateCombat(false); return; }
    case "mend": E.manualEnd(S); ui.manualSpell = null; updateCombat(false); return;
    case "noop": return;
    case "installgame": installGame(); return;
    case "reportbug": { const txt = `🐞 Bug — idlus ${GAME_VERSION}\nAppareil : ${/android/i.test(navigator.userAgent) ? "Android" : isIOS() ? "iPhone/iPad" : "PC"}${isStandalone() ? " (application)" : " (navigateur)"}\nNavigateur : ${navigator.userAgent.slice(0, 120)}\nCe qui s'est passé :\nCe que j'attendais :\nÉtapes pour reproduire :`;
      const open = () => window.open(DISCORD, "_blank", "noopener");
      try { navigator.clipboard.writeText(txt).then(() => { toast("Modèle de rapport copié : collez-le dans #bugs."); open(); }, open); } catch (e) { open(); } return; }
    case "installhide": S.installHide = true; dirty = true; renderUpdBar(); return;
    case "updseen": S.seenVersion = GAME_VERSION; dirty = true; renderUpdBar(); return;
    case "changelog": S.seenVersion = GAME_VERSION; dirty = true; renderUpdBar(); changelogSheet(); return;
    case "reloadgame": saveNow(); location.reload(); return;
    case "hidenewv": ui.hiddenV = ui.newVersion; ui.newVersion = null; renderUpdBar(); return;
    case "offequip": { const r = E.equip(S, +d.id, +d.uid); if (r) { toast(r); return; } t.replaceWith(Object.assign(document.createElement("span"), { className: "tag good", textContent: "équipé" })); dirty = true; return; }
    case "usecons": { if (d.id === "potion_savoir") { openSheet(`<h2>📘 Potion de Savoir</h2><p class="small muted">Choisissez le métier qui reçoit l'expérience.</p><div class="list">${Object.entries(GATHER_JOBS).map(([j, J]) => `<div class="li">${im(jobImg(j), "joblogo sm", J.name)}<span class="grow"><b>${J.name}</b> <span class="xs muted">niv. ${S.jobs[j].lvl}</span></span><button class="btn sm primary" data-act="savoir" data-job="${j}">Choisir</button></div>`).join("")}</div><div><button class="btn" data-act="closesheet">Annuler</button></div>`); return; }
      const C = CONSUMABLES[d.id]; const r = E.useConsumable(S, d.id); if (r) { toast(r); return; } if (C.kind === "boost") toast(`${C.name} activé.`); break; }
    case "savoir": { const r = E.useConsumable(S, "potion_savoir", d.job); closeSheet(); if (r) { toast(r); return; } break; }
    case "invsel": ui.invSel = d.tpl || null; break;
    case "lock": { const it = S.items[+d.uid]; if (it) it.locked = !it.locked; break; }
    case "autotoggle": ui.autoOpen = !t.parentElement.open; return;
    case "autonow": { let n = 0; Object.values(S.items).forEach((it) => { if (!E.equippedBy(S, it.uid) && E.applyAuto(S, it)) n++; }); toast(n ? `${n} objet${n > 1 ? "s" : ""} traité${n > 1 ? "s" : ""}.` : "Aucun objet concerné."); break; }
    case "leavedg": E.leaveDungeon(S); break;
    case "stophunt": msg(E.stopHunt(S)); break;
    case "hunt": { const r = E.startHunt(S, d.id); if (r) { toast(r); return; } ui.tab = "combat"; ui.zoneView = null; window.scrollTo(0, 0); break; }
    case "zoneview": ui.zoneView = d.id; window.scrollTo(0, 0); break;
    case "zoneback": ui.zoneView = null; break;
    case "worldtab": ui.world = d.v; break;
    case "enczone": ui.encZone = d.v; break;
    case "enterdg": { const r = E.enterDungeon(S, d.id); if (r) { toast(r); return; } ui.tab = "combat"; ui.zoneView = null; break; }
    case "combatcid": ui.combatCid = +d.id; break;
    case "gospells": ui.tab = "heroes"; ui.hero = "spells"; ui.cid = ui.combatCid || ui.cid; break;
    case "options": ui.confirm = null; optionsSheet(); return;
    case "selchar": ui.cid = +d.id; ui.slot = null; break;
    case "herotab": ui.hero = d.v; ui.slot = null; break;
    case "toggleteam": msg(E.toggleTeam(S, +d.id)); break;
    case "alloc": E.allocate(S, c.id, d.k, +d.n); break;
    case "resetpts": E.resetPoints(S, +d.id); break;
    case "slot": ui.slot = d.slot || null; break;
    case "equip": msg(E.equip(S, c.id, +d.uid, ui.slot)); ui.slot = null; break;
    case "unequip": E.unequip(S, c.id, d.slot); ui.slot = null; break;
    case "spup": case "spdown": { const i = +d.i, j = a === "spup" ? i - 1 : i + 1; [c.spells[i], c.spells[j]] = [c.spells[j], c.spells[i]]; c.activePreset = null; c.spellsManual = true; break; }
    case "sprem": c.spells.splice(+d.i, 1); c.activePreset = null; c.spellsManual = true; break;
    case "spadd": { const r = E.equipSpell(S, c, d.id); if (r) { toast(r); return; } c.activePreset = null; break; }
    case "psave": { const old = c.presets[+d.i]; const name = old ? old.name : (prompt("Nom de la stratégie :", ["Farm", "Boss", "Solo", "Donjon"][+d.i] || "Stratégie") || "").trim(); if (!old && !name) return; E.savePreset(S, c.id, +d.i, name); toast("Stratégie enregistrée."); break; }
    case "pload": E.applyPreset(S, c.id, +d.i); toast(`Stratégie « ${c.presets[+d.i].name} » chargée.`); break;
    case "pdel": E.deletePreset(S, c.id, +d.i); break;
    case "pzonedel": E.setZonePreset(S, c.id, d.z, null); break;
    case "recruitsheet": recruitSheet(); return;
    case "recruit": { const r = E.recruit(S, ui.startCls, ($("#recName").value || "").trim().slice(0, 20)); if (r) { toast(r); return; } const nc = S.chars[S.chars.length - 1]; nc.sex = ui.startSex || CLASSES[ui.startCls].sex; ui.recName = ""; closeSheet(); ui.cid = nc.id; break; }
    case "invtab": ui.inv = d.v; ui.newResDone = false; break;
    case "givesheet": giveSheet(+d.uid); return;
    case "giveto": { const r = E.equip(S, +d.id, ui.giveTo); if (r) { toast(r); return; } closeSheet(); toast("Objet équipé."); break; }
    case "sellitem": { const p = E.sellItem(S, +d.uid); if (p) toast(`Vendu pour ${fmt(p)} kamas.`); break; }
    case "sellres": { const p = E.sellRes(S, d.n, +d.q); if (p) toast(`Vendu pour ${fmt(p)} kamas.`); break; }
    case "craftjob": ui.craftJob = d.v; break;
    case "craftonly": ui.craftOnly = t.checked; break;
    case "craft": { const r = d.tpl ? E.craftItem(S, d.tpl) : E.craftSpecial(S, d.special);
      if (typeof r === "string") toast(r); else if (r && r.uid) { if (!r.radiant) toast(`Fabriqué : ${ITEMS[r.tpl].name} (jet ${Math.round(E.itemQuality(r) * 100)} %)`); } else toast(`Fabriqué : ${d.special}`); break; }
    case "break": { const r = E.breakItem(S, +d.uid, ui.focus || null); if (typeof r === "string") toast(r); else toast("Runes : " + (Object.entries(r).map(([k, q]) => `${E.runeName(k)} ×${q}`).join(", ") || "aucune")); break; }
    case "askbreakall": ui.confirm = "breakall"; break;
    case "cancel": ui.confirm = null; break;
    case "breakall": { let n = 0; Object.values(S.items).forEach((it) => { if (!E.equippedBy(S, it.uid) && !it.radiant && !it.locked) { E.breakItem(S, it.uid, ui.focus || null); n++; } }); ui.confirm = null; toast(`${n} objets brisés.`); break; }
    case "feed": { const r = E.feedRune(S, d.k, +d.q); if (r) toast(`+${fmt(r.xp)} XP d'Emblème${r.gained ? `, +${r.gained} ${STATS[E.runeInfo(d.k).stat].short}` : ""}`); break; }
    case "askline": ui.confirm = "line:" + d.k; break;
    case "remline": E.removeEmblemLine(S, d.k); ui.confirm = null; break;
    case "perk": E.choosePerk(S, +d.t, d.id); break;
    case "savenow": saveNow(true); return;
    case "copyexp": { const ta = $("#exp"); try { navigator.clipboard.writeText(ta.value).then(() => toast("Sauvegarde copiée."), () => { ta.select(); toast("Sélectionnez puis copiez le texte."); }); } catch (e) { ta.select(); } return; }
    case "import": { try { const txt = decodeURIComponent(escape(atob($("#imp").value.trim()))); const N = E.deserialize(txt); S = N; ui.cid = S.chars[0].id; setTheme(S.settings.theme || "dark"); dirty = true; saveNow(); closeSheet(); ui.tab = "home"; render(); toast("Sauvegarde importée."); if (S.migration) { migrationSheet(S.migration); S.migration = null; } } catch (e) { const m = $("#impmsg"); if (m) m.textContent = "Ce texte n'est pas une sauvegarde valide."; } return; }
    case "askreset": ui.confirm = "reset"; optionsSheet(); return;
    case "cancelreset": ui.confirm = null; optionsSheet(); return;
    case "reset": S = null; ui.confirm = null; closeSheet(); try { localStorage.removeItem(LS_KEY); } catch (e) {} render(); return;
    default: return;
  }
  dirty = true; render();
});
document.addEventListener("change", (ev) => {
  const t = ev.target; const a = t.dataset.act; if (!a || !S) return;
  const c = ui.cid ? char(ui.cid) : null;
  if (a === "autostat") { const x = char(+t.dataset.id); x.autoStat = t.value || null; E.autoAllocate(S, x); if (!x.spellsManual) E.refreshSpells(x, E.charStats(S, x)); }
  else if (a === "spcond") { c.spells[+t.dataset.i].cond = t.value; c.activePreset = null; c.spellsManual = true; }
  else if (a === "sptgt") { c.spells[+t.dataset.i].tgt = t.value; c.activePreset = null; c.spellsManual = true; }
  else if (a === "spauto") { c.spellsManual = !t.checked; if (t.checked) { E.refreshSpells(c, E.charStats(S, c)); toast("Sorts réoptimisés."); } }
  else if (a === "chaloff") c.chalOff = t.checked;
  else if (a === "simres") ui.simRes = +t.value;
  else if (a === "chalai") { S.settings.chalAI = t.checked; toast(t.checked ? "L'IA respecte maintenant les challenges." : "L'IA ignore les challenges."); }
  else if (a === "autozone") { S.settings.autoZone = t.checked; toast(t.checked ? "Progression automatique : l'équipe change de zone selon son niveau." : "Progression automatique désactivée."); }
  else if (a === "slotfilter") ui.slotFilter = t.value;
  else if (a === "gs") { const k = t.dataset.k; ui.gs[k] = k === "cid" ? +t.value : t.value; gatherSheet(); return; }
  else if (a === "settitle") { E.setTitle(S, +t.dataset.id, t.value); }
  else if (a === "setorn") { msg(E.setOrn(S, +t.dataset.id, t.value)); }
  else if (a === "setwing") { E.setWing(S, +t.dataset.id, t.value); }
  else if (a === "focus") ui.focus = t.value;
  else if (a === "pzone") { if (!t.value) return; E.setZonePreset(S, c.id, t.value, +t.dataset.i); toast("Stratégie associée à la zone."); }
  else if (a === "craftonly") ui.craftOnly = t.checked;
  else if (a === "autoaction") { S.settings.auto.action = t.value; ui.autoOpen = true; }
  else if (a === "autoq") { S.settings.auto.q = Math.max(0, Math.min(100, +t.value || 0)); ui.autoOpen = true; }
  else if (a === "autosets") { S.settings.auto.keepSets = t.checked; ui.autoOpen = true; }
  else if (a === "autorecycle") { S.settings.auto.recycle = t.value || false; ui.autoOpen = true; }
  else if (a === "resf") ui.resF = t.value;
  else if (a === "ressort") ui.resSort = t.value;
  else if (a === "rescap") { const v = t.value === "" ? null : Math.max(0, +t.value || 0); if (v === null) delete S.resCap[t.dataset.n]; else S.resCap[t.dataset.n] = v; toast(v === null ? "Plus de limite." : `Surplus au-delà de ${v} vendu automatiquement.`); }
  else if (a === "fmslot") ui.fmF.slot = t.value;
  else if (a === "fmsort") ui.fmF.sort = t.value;
  else if (a === "fmcid") ui.fmF.cid = t.value;
  else if (a === "invsort") ui.invSort = t.value;
  else return;
  dirty = true; render();
});
document.addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.dataset.act === "ressearch") { ui.resQ = t.value; const pos = t.selectionStart; renderInventory(); const n = $("#resSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act === "fmsearch") { ui.fmF.q = t.value; const pos = t.selectionStart; renderForge(); const n = $("#fmSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act === "invsearch") { ui.invSearch = t.value; const pos = t.selectionStart; renderInventory(); const n = $("#invSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act !== "craftsearch") return;
  ui.craftSearch = t.value; const pos = t.selectionStart; renderMetiers(); const n = $("#craftSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
});

/* ---------- sauvegarde ---------- */
let dirty = false, lastSaveOk = 0;
function saveNow(manual) {
  if (!S) return; S.savedAt = Date.now(); S.lastTick = Date.now();
  try { localStorage.setItem(LS_KEY, E.serialize(S)); lastSaveOk = Date.now(); dirty = false; if (manual) toast("Partie sauvegardée."); }
  catch (e) { if (manual) toast("Impossible de sauvegarder dans ce navigateur."); }
}
function loadSave() {
  try { const t = localStorage.getItem(LS_KEY); if (t) return E.deserialize(t); } catch (e) {}
  return null;
}

/* ---------- boucle ---------- */
let last = performance.now(), sinceSave = 0, sinceView = 0, sinceRes = 0, lastRes = {};
const isEditing = () => { const a = document.activeElement; return a && (a.tagName === "SELECT" || a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
function loop() {
  const now = performance.now(); const dt = Math.min(now - last, 5000); last = now;
  if (S) {
    S.manualLive = document.visibilityState === "visible" && ui.tab === "combat";
    E.tick(S, dt); S.lastTick = Date.now();
    sinceSave += dt; sinceView += dt;
    if (E.events.length) { E.events.splice(0).forEach((ev) => { if (["rare", "up", "radiant"].includes(ev.kind) || (ev.kind === "loot" && /^Butin : Clef/.test(ev.txt))) toast(ev.txt, ev.kind); }); dirty = true; }
    const k = $("#stKamas"); if (k) k.textContent = fmt(S.kamas);
    const sb = $("#stBoost"); if (sb) { const ab = activeBoosts(); if (ab.length) sb.textContent = dur(Math.min(...ab.map((b) => b.left))); else renderStatus(); }
    const kl = $("#stKills"); if (kl) kl.textContent = fmt(Object.values(S.bestiary).reduce((a, b) => a + b, 0));
    if (ui.tab === "combat") updateCombat(false);
    else if (ui.tab === "metiers" && ui.met === "recolte") {
      document.querySelectorAll("[data-wprog]").forEach((b) => { const c = char(+b.dataset.wprog); if (c && c.job) b.firstElementChild.style.width = pct(c.job.prog, E.gatherPeriod(S, c)) + "%"; });
      if (sinceView > 4000 && !isEditing() && !$("#sheet").innerHTML) { sinceView = 0; renderMetiers(); }
    } else if (ui.tab === "home" && ui.home === "apercu" && sinceView > 3000 && !$("#sheet").innerHTML) { sinceView = 0; renderHome(); renderStatus(); }
    else if (ui.tab === "quests" && ui.qt !== "ach" && sinceView > 3000 && !$("#sheet").innerHTML && !isEditing()) { sinceView = 0; renderQuests(); renderNav(); }
    if (sinceSave > 15000) { sinceSave = 0; saveNow(); }
    // ressources récemment obtenues + liste de courses prête
    sinceRes += dt;
    if (sinceRes > 2500) { sinceRes = 0; const now = Date.now();
      for (const n in S.res) { if ((S.res[n] || 0) > (lastRes[n] || 0)) S.resT[n] = now; } lastRes = Object.assign({}, S.res);
      S.shop.forEach((e) => { const ing = shopIng(e); const ok = ing.length && ing.every(([r, q]) => (S.res[r] || 0) >= q); if (ok && !e.ok) toast(`🛒 Tout est réuni pour : ${shopName(e)} !`, "rare"); e.ok = !!ok; });
      const bl = document.querySelectorAll("[data-boostleft]"); bl.forEach((b) => (b.textContent = dur(E.boostLeft(S, b.dataset.boostleft))));
    }
  }
  setTimeout(loop, 120);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
  else if (S) { const gap = (Date.now() - (S.lastTick || Date.now())) / 1000; if (gap > 60) { const r = E.catchUp(S, gap); if (r && (r.wins || Object.keys(r.res).length)) offlineSheet(r); } last = performance.now(); }
});
window.addEventListener("pagehide", () => saveNow());

function start() {
  S = loadSave();
  if (S) {
    setTheme(S.settings.theme || "dark");
    ui.cid = S.chars[0].id;
    const gap = (Date.now() - (S.lastTick || Date.now())) / 1000;
    const r = gap > 60 ? E.catchUp(S, gap) : null;
    render();
    if (S.migration) { migrationSheet(S.migration); S.migration = null; }
    else if (r && (r.wins || Object.keys(r.res).length)) offlineSheet(r);
    S.sessions = (S.sessions || 0) + 1; dirty = true;
  } else render();
  loop();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  setTimeout(checkNewVersion, 20000); setInterval(checkNewVersion, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkNewVersion(); });
}
window.DX = { get S() { return S; }, ui, render, E };
start();
})();
