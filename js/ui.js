/* ============================================================================
   INTERFACE — DofousXen (v2)
   Rendu des pages (innerHTML) + combat animé (DOM à clés, mis à jour en place).
   ========================================================================== */
(function () {
"use strict";
const D = window.DATA, E = window.ENGINE;
const { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, CLASSES, CONDITIONS, GATHER_JOBS, CRAFT_JOBS, SLOTS, MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, SPELL_IMG, EMBLEM } = D;

let S = null;
const ui = {
  tab: "home", world: "map", zoneView: null, hero: "stats", cid: null, slot: null, inv: "items", slotFilter: "all", ate: "recolte",
  craftJob: "tailleur", craftOnly: false, craftSearch: "", focus: "", startCls: "iop", startSex: null, confirm: null, giveTo: null, combatCid: null, encZone: "incarnam",
};
const LS_KEY = "dofousxen-save";

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
const itemImg = (tpl) => (ITEMS[tpl] ? imgI(ITEMS[tpl].icon) : "");
const spellImg = (name) => (SPELL_IMG[name] ? `assets/s/${SPELL_IMG[name]}.png` : "");
const headImg = (c) => `assets/h/${c.cls}_${c.sex || CLASSES[c.cls].sex}.png`;
const logoImg = (cls) => `assets/h/${cls}_logo.png`;
const im = (src, cls = "ico", alt = "") => (src ? `<img class="${cls}" src="${src}" alt="${h(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : "");
const head = (c, lg) => `<span class="head ${lg ? "lg" : ""}" style="--cc:${CLASSES[c.cls].color}">${im(headImg(c), "", c.name)}</span>`;
const resChips = (res) => Object.entries(res || {}).filter(([, v]) => v).map(([k, v]) => `<span class="chip ${v < 0 ? "neg" : ""}" style="--c:var(--el-${k})" title="Résistance ${ELEMENTS[k].name}">${v > 0 ? "+" : ""}${v}%</span>`).join("");

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/></svg>',
  combat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20 14 10M14 4l6 6-3 1-3-3-1-3zM5 15l4 4M3 21l2-2"/></svg>',
  heroes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.6.2 4.3 2 4.8 4.6"/></svg>',
  inv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  ateliers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 21l8-8M14 4l6 6-4 4-6-6 4-4z"/><path d="M4 9h5M6.5 6.5v5"/></svg>',
};
const TABS = [["home", "Accueil"], ["world", "Monde"], ["combat", "Combat"], ["heroes", "Héros"], ["inv", "Inventaire"], ["ateliers", "Ateliers"]];

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
const isDark = () => document.documentElement.dataset.theme === "dark";
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
function lockReason(sid) {
  const s = E.SUBS[sid]; const z = ZONES.find((x) => x.id === s.zone);
  if (!E.zoneUnlocked(S, z.id)) return `Battez ${MONSTERS[DUNGEONS[z.requires.boss].boss].name} (${DUNGEONS[z.requires.boss].name})`;
  if (s.requiresItem) return `Il faut : ${s.requiresItem} (Bricoleur)`;
  let prev = z.subs[s.idx - 1]; if (prev && prev.hidden) prev = z.subs[s.idx - 2];
  return prev ? `${S.progress.wins[prev.id] || 0}/${E.WINS_TO_UNLOCK} victoires dans ${prev.name}` : "";
}

/* ---------- navigation & bandeau ---------- */
function renderNav() {
  $("#nav").innerHTML = S ? TABS.map(([id, n]) => `<button data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}>${ICONS[id]}<span>${n}</span></button>`).join("") : "";
}
function statusHtml() {
  if (!S) return "";
  const team = E.team(S);
  const where = S.dungeon ? DUNGEONS[S.dungeon.id].name : S.hunting && S.sub ? E.SUBS[S.sub].name : "Au repos";
  const kills = Object.values(S.bestiary).reduce((a, b) => a + b, 0);
  return `<button class="brand" data-tab="home">DofousXen</button>
    <span class="it"><span class="coin"></span><b class="num" id="stKamas">${fmt(S.kamas)}</b><span class="hide-sm">kamas</span></span>
    <span class="it"><span class="dot ${S.hunting || S.dungeon ? "" : "off"}"></span><b>${team.length}</b>/8 <span class="hide-sm">héros</span></span>
    <span class="it">📍 <span>${h(where)}</span></span>
    <span class="it hide-sm">⚔ <b class="num" id="stKills">${fmt(kills)}</b> tués</span>
    <button class="ic-btn" data-act="theme" title="Jour / Nuit" aria-label="Changer de thème">${isDark() ? "☀" : "☾"}</button>
    <button class="ic-btn" data-act="options" title="Options" aria-label="Options">⚙</button>`;
}
function renderStatus() { const el = $("#status"); el.innerHTML = statusHtml(); el.style.display = S ? "" : "none"; }

/* ---------- écran de départ ---------- */
function renderStart() {
  renderStatus(); renderNav();
  const sex = ui.startSex || CLASSES[ui.startCls].sex;
  $("#main").innerHTML = `
  <section class="start stack">
    <div class="logo">DofousXen</div>
    <p class="muted" style="text-align:center;margin:0">Un idle inspiré de DOFUS : vos héros combattent seuls, à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.</p>
    <div class="panel"><div class="pad stack">
      <h2>Choisissez votre premier héros</h2>
      <div class="classpick">${Object.entries(CLASSES).map(([id, c]) => `
        <button data-act="startcls" data-cls="${id}" aria-pressed="${ui.startCls === id}">
          <span class="row"><span class="emb" style="--cc:${c.color}">${im(logoImg(id), "", c.name)}</span><span class="head lg" style="--cc:${c.color}">${im(`assets/h/${id}_${ui.startCls === id ? sex : c.sex}.png`, "", "")}</span></span>
          <strong style="font-size:17px">${c.name}</strong><span class="small muted">${h(c.desc)}</span>
        </button>`).join("")}</div>
      <div class="row"><span class="small muted">Apparence</span><span class="seg">${[["m", "Masculin"], ["f", "Féminin"]].map(([v, n]) => `<button data-act="startsex" data-v="${v}" aria-pressed="${sex === v}">${n}</button>`).join("")}</span></div>
      <label class="stack" style="gap:4px"><span class="small muted">Nom du héros</span><input type="text" id="startName" maxlength="20" value="${h(D.NAMES[Math.floor(Math.random() * D.NAMES.length)])}"></label>
      <div><button class="btn primary" data-act="startgame">Commencer l'aventure</button></div>
    </div></div>
    <details class="panel"><summary class="pad" style="cursor:pointer;font-weight:800">Reprendre une partie (importer une sauvegarde, y compris de la v1)</summary>
      <div class="pad stack" style="padding-top:0"><textarea id="imp" placeholder="Collez ici le texte de votre sauvegarde exportée"></textarea>
      <div class="row"><button class="btn sm" data-act="import">Importer</button><span id="impmsg" class="minus small"></span></div></div></details>
  </section>`;
}

/* ---------- ACCUEIL ---------- */
function renderHome() {
  const team = E.team(S); const main = team[0] || S.chars[0];
  const deco = S.dungeon ? "dungeon" : S.sub ? subDeco(S.sub) : "sky";
  const act = S.dungeon ? `En donjon : <b>${h(DUNGEONS[S.dungeon.id].name)}</b> · salle ${Math.min(S.dungeon.room + 1, DUNGEONS[S.dungeon.id].rooms.length + 1)}/${DUNGEONS[S.dungeon.id].rooms.length + 1}`
    : S.hunting && S.sub ? `Chasse en cours : <b>${h(E.SUBS[S.sub].name)}</b>` : `Votre équipe se repose. Choisissez une zone pour partir chasser.`;
  const zkey = S.dungeon ? null : S.sub; const rate = zkey ? E.zoneRate(S, zkey) : null;
  const archis = Object.values(S.archis).reduce((a, b) => a + b, 0);
  $("#main").innerHTML = `
  <section class="hero-banner">
    <div class="scene">${sceneSVG(deco, 220, "home" + (S.sub || ""))}<div class="troupe" style="justify-content:flex-end;padding-right:5%">${team.map((c) => `<span class="ent hero" style="width:clamp(54px,10vw,80px)"><span class="medal" style="--cc:${CLASSES[c.cls].color}">${im(headImg(c), "", c.name)}</span></span>`).join("")}</div></div>
    <div class="inner">
      <div class="card"><h1>Bonjour ${h(main.name)} !</h1><div class="small" style="margin-top:4px">${act}</div></div>
      <div class="row">${S.hunting || S.dungeon ? `<button class="btn primary" data-tab="combat">⚔ Voir le combat</button>${S.dungeon ? "" : `<button class="btn" data-act="stophunt">Rentrer</button>`}` : `<button class="btn primary" data-tab="world">🗺 Choisir une zone</button>`}</div>
    </div>
  </section>
  <section class="kpis" style="margin:14px 0">
    <div class="kpi"><b class="num">${Math.max(...S.chars.map((c) => c.lvl))}</b><span>niveau max</span></div>
    <div class="kpi"><b class="num">${fmt(S.stats.wins)}</b><span>victoires</span></div>
    <div class="kpi"><b class="num">${E.freeSpirit(S)} %</b><span>Esprit Libre (${team.length} héros)</span></div>
    <div class="kpi"><b class="num" style="color:var(--archi)">${archis}</b><span>archimonstres vaincus</span></div>
    <div class="kpi"><b class="num" style="color:var(--gold)">${S.radiants || 0}</b><span>objets rayonnants</span></div>
    <div class="kpi"><b class="num">${dur(S.stats.playtime)}</b><span>de jeu</span></div>
  </section>
  <section class="grid2">
    <div class="panel"><div class="phead"><h2>Rendement${zkey ? " · " + h(E.SUBS[zkey].name) : ""}</h2></div><div class="pad">${rateHtml(rate)}</div></div>
    <div class="panel"><div class="phead"><h2>Derniers combats</h2></div><div class="pad">${historyHtml(8)}</div></div>
  </section>
  <section class="panel" style="margin-top:14px"><div class="phead"><h2>Journal</h2></div><div class="list journal">${S.journal.slice(0, 12).map((j) => `<div class="li k-${j.kind}"><span class="grow">${h(j.txt)}</span><span class="xs muted">${ago(j.t)}</span></div>`).join("") || `<div class="empty">Rien pour l'instant.</div>`}</div></section>`;
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
function zonePanel(z) {
  const zu = E.zoneUnlocked(S, z.id);
  return `<section class="panel"><div class="zonehead"><div><h2>${h(z.name)}</h2><div class="small muted">${h(z.desc)} · niveaux ${h(z.lvl)}</div></div>${zu ? "" : `<span class="tag soft">🔒 ${h(lockReason(z.subs[0].id))}</span>`}</div>
    <div class="subgrid">${z.subs.map((s) => {
      const un = E.subUnlocked(S, s.id); const here = S.hunting && S.sub === s.id && !S.dungeon;
      if (s.hidden && !un) return `<div class="subcard locked"><div class="scene">${sceneSVG("cave", 96, s.id)}</div><div class="body"><b>Lieu caché</b><span class="lockmsg">On raconte qu'un objet permet de rapetisser… (${h(s.requiresItem)}, Bricoleur)</span></div></div>`;
      const wins = S.progress.wins[s.id] || 0;
      return `<button class="subcard ${un ? "" : "locked"} ${here ? "here" : ""}" data-act="zoneview" data-id="${s.id}">
        <div class="scene">${sceneSVG(s.deco, 96, s.id)}<div class="troupe">${s.monsters.slice(0, 4).map((k) => im(imgM(k), "", MONSTERS[k].name)).join("")}</div></div>
        <div class="body"><div class="row between"><b>${h(s.name)}</b><span class="xs muted num">niv. ${s.lvl[0]}–${s.lvl[1]}</span></div>
          ${here ? `<span class="tag good" style="align-self:flex-start">Chasse en cours</span>` : un ? `<span class="xs muted">${wins} victoire${wins > 1 ? "s" : ""}${s.dungeon ? " · donjon" : ""}</span>` : `<span class="lockmsg">🔒 ${h(lockReason(s.id))}</span>`}</div>
      </button>`; }).join("")}</div></section>`;
}
function renderZoneView(sid) {
  const s = E.SUBS[sid]; const z = ZONES.find((x) => x.id === s.zone); const un = E.subUnlocked(S, sid);
  const here = S.hunting && S.sub === sid && !S.dungeon;
  const res = subResources(s); const its = subItems(s); const rate = E.zoneRate(S, sid);
  const dg = s.dungeon ? DUNGEONS[s.dungeon] : null;
  const nx = z.subs[s.idx + 1]; const wins = S.progress.wins[sid] || 0;
  $("#main").innerHTML = `
  <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="zoneback">← Carte</button></div>
  <section class="panel">
    <div class="scene" style="height:210px">${sceneSVG(s.deco, 210, s.id)}<div class="crumb">${h(z.name)}<span class="title">${h(s.name)}</span>niv. ${s.lvl[0]} – ${s.lvl[1]}</div>
      <div class="troupe">${s.monsters.map((k) => im(imgM(k), "", MONSTERS[k].name)).join("")}</div></div>
    <div class="pad stack">
      <div class="row">${!un ? `<span class="tag soft">🔒 ${h(lockReason(sid))}</span>` : here ? `<button class="btn" data-act="stophunt">Rentrer au repos</button><button class="btn primary" data-tab="combat">Voir le combat</button>` : `<button class="btn primary" data-act="hunt" data-id="${sid}" ${S.dungeon ? "disabled" : ""}>⚔ Partir chasser</button>`}
        <span class="small muted">${E.team(S).length} héros · Esprit Libre +${E.freeSpirit(S)} %</span></div>
      ${rate ? `<div>${rateHtml(rate)}</div>` : ""}
      ${nx && !nx.hidden && un && wins < E.WINS_TO_UNLOCK && !E.subUnlocked(S, nx.id) ? `<div><div class="row between small"><span>Déblocage de <b>${h(nx.name)}</b></span><span class="num">${wins}/${E.WINS_TO_UNLOCK} victoires</span></div><div class="bar"><i style="width:${pct(wins, E.WINS_TO_UNLOCK)}%"></i></div></div>` : ""}
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
  const total = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].archiOf).length; const met = Object.keys(S.bestiary).filter((k) => !MONSTERS[k]?.archiOf).length;
  const subs = z.subs.map((s) => `<h3 class="sec">${h(s.name)}</h3><div class="mons">${s.monsters.map((k) => encCard(k)).join("")}</div>`).join("");
  const dgs = Object.entries(DUNGEONS).filter(([id]) => E.SUBS[E.DUNGEON_SUB[id]]?.zone === z.id).map(([id, d]) => `<h3 class="sec">${h(d.name)}</h3><div class="mons">${encCard(d.boss)}</div>`).join("");
  return `<section class="panel"><div class="phead"><h2>Bestiaire</h2><span class="small muted num">${met}/${total} monstres rencontrés</span></div>
    <div class="pad"><div class="seg">${ZONES.map((x) => `<button data-act="enczone" data-v="${x.id}" aria-pressed="${x.id === z.id}">${h(x.name)}</button>`).join("")}</div>
    <p class="note" style="margin-top:8px">Les butins d'un monstre se dévoilent quand vous les obtenez pour la première fois.</p>${subs}${dgs}</div></section>`;
}
function encCard(k) {
  const m = MONSTERS[k]; const kills = S.bestiary[k] || 0; const seen = S.seenDrops[k] || {}; const a = m.archi;
  const drops = m.drops.map(([n, p]) => seen[n] ? `<span title="${h(n)} · ${p} %">${im(resImg(n), "ico sm", n)}</span>` : `<span class="icobox" style="width:26px;height:26px;font-size:12px;color:var(--muted)" title="Inconnu">?</span>`).join("");
  return `<div class="mcard ${kills ? "" : "unknown"}" style="align-items:flex-start">${im(imgM(k), "mimg", m.name)}
    <div style="min-width:0" class="stack"><div><div class="n">${kills ? h(m.name) : "???"}</div><div class="l">niv. ${m.lvl[0]}–${m.lvl[1]} · <span class="num">${fmt(kills)}</span> tués</div></div>
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
    <div class="row"><span class="small muted">Équipe de ${team.length}${fs ? ` · Esprit Libre <b style="color:var(--action)">+${fs} %</b>` : ""}</span>
      <span class="seg" aria-label="Vitesse">${[1, 2, 4].map((v) => `<button data-act="speed" data-v="${v}" aria-pressed="${S.settings.speed === v}">×${v}</button>`).join("")}</span>
      ${dg ? `<button class="btn sm danger" data-act="leavedg">Quitter le donjon</button>` : S.hunting ? `<button class="btn sm" data-act="stophunt">Rentrer</button>` : ""}</div></div>
  <section class="grid2 combatgrid">
    <div class="panel">
      <div class="arena" id="arena"></div>
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
  ${!dg && S.hunting && sub ? (() => { const z = ZONES.find((x) => x.id === sub.zone); const nx = z.subs[sub.idx + 1]; const w = S.progress.wins[sub.id] || 0; return nx && !nx.hidden && !E.subUnlocked(S, nx.id) ? `<p class="note" style="margin-top:10px">Victoires ici : <b class="num">${w}/${E.WINS_TO_UNLOCK}</b> pour débloquer ${h(nx.name)}.</p>` : ""; })() : ""}`;
  ui.arena = null; updateCombat(true);
}
function spellBarFor(c, ent, F) {
  const slots = c.spells.slice(0, 6);
  const lastCast = {};
  if (F && ent) { const idx = F.ents.indexOf(ent); F.fx.forEach((f) => { if (f.k === "cast" && f.s === idx) lastCast[f.sp] = f.seq; }); }
  const html = Array.from({ length: 6 }, (_, i) => {
    const x = slots[i]; if (!x) return `<div class="sp empty"></div>`;
    const sp = E.spellDef(c.cls, x.id); const cd = ent && ent.cd ? (ent.cd[sp.id] || 0) : 0;
    const cast = F && lastCast[sp.id] !== undefined && F.seq - lastCast[sp.id] <= 1;
    const el = sp.el || (sp.type.startsWith("heal") ? "a" : "buff");
    return `<div class="sp ${cast ? "cast" : ""}" style="--c:${elVar(el)}" title="${h(sp.name)} · ${sp.pa} PA">${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : `<span class="glyph">✦</span>`}<span class="pa">${sp.pa}</span>${cd > 1 ? `<span class="cd">${cd - 1}</span>` : ""}</div>`;
  }).join("");
  return { html, names: Array.from({ length: 6 }, (_, i) => `<div>${slots[i] ? h(E.spellDef(c.cls, slots[i].id).name) : ""}</div>`).join("") };
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
    if (e.side === "c") { const c = char(e.cid) || { cls: e.cls, sex: "m", name: e.name };
      return `<div class="ent hero" data-i="${i}"><div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div><div class="medal" style="--cc:${CLASSES[e.cls].color}">${im(headImg(c), "", e.name)}</div></div>`; }
    return `<div class="ent ${e.archi ? "archi" : ""} ${e.boss ? "boss" : ""}" data-i="${i}" title="${h(e.name)} niv. ${e.lvl}"><div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div>${im(`assets/m/${e.img}.png`, "sprite", e.name)}</div>`;
  };
  arena.innerHTML = sceneSVG(deco, 270, F.dungeon ? "dg" + F.label : "arena" + F.sub) + `<div class="turn" id="turn">${h(F.label)}</div>
    <div class="side l">${side("c").map(entHtml).join("")}</div><div class="side r">${side("m").map(entHtml).join("")}</div><div class="result" id="fresult"></div>`;
  arena.querySelectorAll(".ent").forEach((n) => (ui.arena.nodes[+n.dataset.i] = n));
}
function floatAt(node, txt, color, small) {
  const s = document.createElement("span"); s.className = "float" + (small ? " small" : ""); s.textContent = txt; s.style.setProperty("--c", color);
  node.appendChild(s); setTimeout(() => s.remove(), 1150);
}
function pulse(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function updateCombat(force) {
  const F = S.fight; const arena = $("#arena"); if (!arena) return;
  if (!ui.arena || ui.arena.el !== arena || ui.arena.fid !== (F ? F.id : null) || ui.arena.theme !== isDark()) buildArena(F);
  const A = ui.arena;
  if (F) {
    F.ents.forEach((e, i) => {
      const n = A.nodes[i]; if (!n) return;
      n.querySelector(".hpb i").style.width = pct(e.hp, e.hpMax) + "%";
      n.querySelector(".hpb b").style.transform = `scaleX(${Math.min(1, (e.shield || 0) / e.hpMax)})`;
      n.classList.toggle("dead", !e.alive);
    });
    const fresh = F.fx.filter((f) => f.seq > A.lastSeq);
    if (fresh.length) {
      A.lastSeq = Math.max(...fresh.map((f) => f.seq));
      fresh.forEach((f) => {
        if (f.k === "cast") pulse(A.nodes[f.s], "act");
        else if (f.k === "hit") { const n = A.nodes[f.t]; if (n) { pulse(n, "hit"); floatAt(n, "-" + f.v, elVar(f.el)); } }
        else if (f.k === "heal") { const n = A.nodes[f.t]; if (n) floatAt(n, "+" + f.v, "#7ee06a"); }
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
    if (sp && sp.dataset.k !== bar.html) { sp.innerHTML = bar.html; sp.dataset.k = bar.html; $("#spnames").innerHTML = bar.names; }
    const st = ent ? ent.st : E.charStats(S, c);
    let used = 0;
    if (F && ent) { const idx = F.ents.indexOf(ent); const casts = F.fx.filter((f) => f.k === "cast" && f.s === idx); const lastSeq = casts.length ? casts[casts.length - 1].seq : -1; casts.filter((f) => f.seq === lastSeq).forEach((f) => { const d = E.spellDef(c.cls, f.sp); if (d) used += d.pa; }); }
    const pips = $("#pips"); const ph = Array.from({ length: st.pa }, (_, i) => `<i class="${i < st.pa - used ? "" : "off"}"></i>`).join("");
    if (pips && pips.dataset.k !== ph) { pips.innerHTML = ph; pips.dataset.k = ph; }
    const sn = $("#stratName"); if (sn) sn.textContent = c.activePreset !== undefined && c.activePreset !== null && c.presets[c.activePreset] ? c.presets[c.activePreset].name : "personnalisée";
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
    ${r.items.length ? `<div class="list">${r.items.filter((u) => S.items[u]).map((u) => `<div class="li ${S.items[u].radiant ? "radiant" : ""}">${itemIcon(S.items[u])}<span class="grow">${itemName(S.items[u])}</span></div>`).join("")}</div>` : ""}</div>`;
}

/* ---------- objets ---------- */
const itemIcon = (it) => `<span class="icobox ${it.radiant ? "radiant" : ""}">${im(itemImg(it.tpl), "", ITEMS[it.tpl].name)}</span>`;
function itemName(it) { return `<span class="iname ${it.radiant ? "radiant" : ""}">${h(ITEMS[it.tpl].name)}</span>${it.radiant ? ` <span class="tag" style="background:linear-gradient(90deg,#ffb347,#ff5fbf,#8a7dff);color:#fff">✦ +${it.radiant} %</span>` : ""}`; }
function itemStatsHtml(it) {
  const T = ITEMS[it.tpl];
  return Object.keys(T.stats).map((k) => { const [a, b] = T.stats[k]; const v = it.stats[k]; const base = it.roll ? it.roll[k] : v;
    return `<span${base === b && a !== b ? ' style="color:var(--gold);font-weight:800"' : ""}>${statLine(k, v)}</span>${it.radiant && v !== base ? `<span class="bonus">(+${v - base})</span>` : ""} <span class="muted xs">${a === b ? "" : `(${a} à ${b})`}</span>`; }).join("<br>");
}
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
  const c = char(ui.cid); const st = E.charStats(S, c); const need = E.xpNeed(c.lvl); const nextCost = E.recruitCost(S.chars.length + 1);
  $("#main").innerHTML = `
  <div class="pagehead"><h1>Héros</h1><span class="small muted">${E.team(S).length} dans l'équipe · Esprit Libre +${E.freeSpirit(S)} %</span></div>
  <section class="chips">${S.chars.map((x) => `<button class="${x.inTeam ? "" : "out"}" data-act="selchar" data-id="${x.id}" aria-pressed="${x.id === c.id}">${head(x)}<span>${h(x.name)} <span class="muted xs num">niv. ${x.lvl}</span></span></button>`).join("")}
    ${S.chars.length < 8 ? `<button data-act="recruitsheet"><span class="head" style="--cc:var(--panel3)">+</span><span>Recruter <span class="muted xs num">${nextCost ? fmt(nextCost) + " k" : "gratuit"}</span></span></button>` : ""}</section>
  <section class="panel" style="margin-bottom:12px"><div class="pad stack">
    <div class="row between"><div class="row">${head(c, true)}<div><h2 style="font-size:24px">${h(c.name)}</h2><div class="small muted">${CLASSES[c.cls].name} · niveau ${c.lvl}</div></div></div>
      <div class="row"><span class="small muted num">${fmt(st.hpMax)} PV · ${st.pa} PA · Prospe ${fmt(st.pp)}</span><button class="btn sm" data-act="toggleteam" data-id="${c.id}">${c.inTeam ? "Retirer de l'équipe" : "Ajouter à l'équipe"}</button></div></div>
    <div><div class="row between small"><span class="muted">Expérience</span><span class="num muted">${c.lvl >= E.MAX_LVL ? "Niveau maximum" : `${fmt(c.xp)} / ${fmt(need)}`}</span></div><div class="bar xp"><i style="width:${pct(c.xp, need)}%"></i></div></div>
  </div></section>
  <nav class="subtabs">${[["stats", "Caractéristiques"], ["equip", "Équipement"], ["spells", "Sorts & stratégies"]].map(([id, n]) => `<button data-act="herotab" data-v="${id}" aria-pressed="${ui.hero === id}">${n}</button>`).join("")}</nav>
  <section>${ui.hero === "stats" ? charStatsView(c, st) : ui.hero === "equip" ? charEquipView(c) : charSpellsView(c)}</section>`;
}
function charStatsView(c, st) {
  return `<div class="grid2">
    <div class="panel"><div class="phead"><h2>Points à répartir</h2><b class="num" style="font-size:20px">${c.pts}</b></div>
      <div class="list">${BASE_STATS.map((k) => { const el = STATS[k].el;
        return `<div class="li">${el ? eld(el) : `<span class="eld" style="--c:var(--gold)">${k === "vit" ? "V" : "S"}</span>`}<span class="grow"><span class="name">${STATS[k].name}</span> <span class="muted xs">${k === "sa" ? "3 points = 1" : ""}</span></span>
          <span class="num" style="min-width:42px;text-align:right">${fmt(c.alloc[k])}</span>
          <button class="btn sm" data-act="alloc" data-k="${k}" data-n="1" ${c.pts < E.pointCost(k) ? "disabled" : ""}>+1</button><button class="btn sm" data-act="alloc" data-k="${k}" data-n="10" ${c.pts < E.pointCost(k) ? "disabled" : ""}>+10</button></div>`; }).join("")}</div>
      <div class="pad stack" style="padding-top:6px"><label class="row small"><span class="muted">Répartition automatique :</span>
        <select data-act="autostat" data-id="${c.id}"><option value="">Aucune</option>${BASE_STATS.map((k) => `<option value="${k}" ${c.autoStat === k ? "selected" : ""}>${STATS[k].name}</option>`).join("")}</select></label>
        <div><button class="btn sm" data-act="resetpts" data-id="${c.id}">Réinitialiser les points</button></div></div></div>
    <div class="panel"><div class="phead"><h2>Statistiques totales</h2></div><div class="pad stack">
      <div class="statgrid num"><div class="s"><span>Points de vie</span><b>${fmt(st.hpMax)}</b></div>${STAT_ORDER.map((k) => `<div class="s"><span>${STATS[k].name.replace("% ", "")}</span><b>${fmtStatVal(k, st[k])}</b></div>`).join("")}</div>
      <p class="note">Les dégâts d'un sort augmentent avec la caractéristique de son élément et la Puissance.${E.isSolo(S) && c.inTeam ? " L'Emblème du Solitaire est actif." : ""}</p></div></div></div>`;
}
function charEquipView(c) {
  const counts = E.setCounts(S, c);
  const sets = Object.entries(counts).map(([id, n]) => { const b = E.setBonus(id, n);
    return `<div class="li"><span class="grow"><span class="name">${h(SETS[id].name)}</span> <span class="muted xs">${n} pièce${n > 1 ? "s" : ""}</span></span><span class="small">${b ? Object.entries(b).map(([k, v]) => statLine(k, v)).join(", ") : "<span class='muted'>pas encore de bonus</span>"}</span></div>`; }).join("");
  let pick = "";
  if (ui.slot) {
    const want = ui.slot.startsWith("anneau") ? "anneau" : ui.slot;
    const cands = Object.values(S.items).filter((it) => ITEMS[it.tpl].slot === want && c.equip[ui.slot] !== it.uid).sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl);
    pick = `<div class="panel"><div class="phead"><h2>${SLOTS[ui.slot]} : choisir</h2><span class="row">${c.equip[ui.slot] ? `<button class="btn sm" data-act="unequip" data-slot="${ui.slot}">Retirer</button>` : ""}<button class="btn sm" data-act="slot" data-slot="">Fermer</button></span></div>
      <div class="list">${cands.map((it) => { const T = ITEMS[it.tpl]; const by = E.equippedBy(S, it.uid);
        return `<div class="li ${it.radiant ? "radiant" : ""}">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="muted xs">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${by ? ` · porté par ${h(by.name)}` : ""}</span><br>${deltaHtml(c, ui.slot, it.uid)}</span>
          <button class="btn sm primary" data-act="equip" data-uid="${it.uid}" ${T.lvl > c.lvl ? "disabled" : ""}>${T.lvl > c.lvl ? "Niv. " + T.lvl : "Équiper"}</button></div>`; }).join("") || `<div class="empty">Aucun objet de ce type. Fabriquez-en dans les Ateliers ou trouvez-en sur les monstres.</div>`}</div></div>`;
  }
  return `<div class="stack">
    <div class="slots">${Object.keys(SLOTS).map((s) => { const it = S.items[c.equip[s]];
      return `<button class="slot" data-act="slot" data-slot="${s}" aria-pressed="${ui.slot === s}">${it ? itemIcon(it) : `<span class="icobox" style="opacity:.5"></span>`}<span style="min-width:0"><span class="sl">${SLOTS[s]}</span><br>${it ? `<span class="small">${itemName(it)}</span>` : `<span class="small muted">Vide</span>`}</span></button>`; }).join("")}</div>
    ${pick}
    ${sets ? `<div class="panel"><div class="phead"><h2>Panoplies</h2></div><div class="list">${sets}</div></div>` : ""}</div>`;
}
function spellDesc(sp) {
  const el = sp.el ? eld(sp.el) + " " : "";
  switch (sp.type) {
    case "dmg": return `${el}${sp.min}–${sp.max} dégâts${sp.casts ? ` (×${sp.casts} par tour)` : ""}${sp.weaken ? `, la cible frappe ${sp.weaken} % moins fort` : ""}`;
    case "aoe": return `${el}${sp.min}–${sp.max} à tous les ennemis`;
    case "drain": return `${el}${sp.min}–${sp.max}, rend la moitié en PV`;
    case "poison": return `${el}${sp.min}–${sp.max} par tour pendant ${sp.turns} tours`;
    case "heal": return `Soigne ${sp.min}–${sp.max} l'allié le plus blessé`;
    case "healall": return `Soigne ${sp.min}–${sp.max} toute l'équipe`;
    case "buff": return `${sp.pui ? `+${sp.pui} Puissance` : `+${sp.cri} % critique`} pendant ${sp.turns} tours (${sp.target === "allies" ? "équipe" : "lanceur"})`;
    case "shield": return `Bouclier de ${sp.pct} % des PV (${sp.target === "allies" ? "équipe" : "lanceur"})`;
  }
  return "";
}
const spIcon = (sp) => `<span class="spicon" style="--c:${elVar(sp.el || (sp.type.startsWith("heal") ? "a" : "buff"))}">${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : "✦"}</span>`;
function zoneOptions() {
  const opts = [];
  ZONES.forEach((z) => z.subs.forEach((s) => { if (E.subUnlocked(S, s.id)) opts.push([s.id, `${z.name} · ${s.name}`]); }));
  Object.entries(DUNGEONS).forEach(([id, d]) => { if (E.dungeonUnlocked(S, id)) opts.push(["dg:" + id, `Donjon · ${d.name}`]); });
  return opts;
}
function charSpellsView(c) {
  const eq = c.spells; const known = E.knownSpells(c);
  const avail = known.filter((s) => !eq.find((x) => x.id === s.id)); const locked = CLASSES[c.cls].spells.filter((s) => s.lvl > c.lvl);
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
  return `<div class="stack">
  <div class="panel"><div class="phead"><h2>Stratégies</h2><span class="xs muted">préréglages de sorts, activables automatiquement par zone</span></div><div class="pad stack" style="gap:8px">${presets}</div></div>
  <div class="grid2">
    <div class="panel"><div class="phead"><h2>Sorts équipés</h2><span class="muted xs">${eq.length}/6 · lancés dans cet ordre</span></div>
      <div class="list">${eq.map((x, i) => { const sp = E.spellDef(c.cls, x.id);
        return `<div class="li"><div class="spellrow"><div class="ord"><button class="btn sm" data-act="spup" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Monter">▲</button><button class="btn sm" data-act="spdown" data-i="${i}" ${i === eq.length - 1 ? "disabled" : ""} aria-label="Descendre">▼</button></div>
          ${spIcon(sp)}<div style="min-width:0"><div class="name">${h(sp.name)} <span class="muted xs">${sp.pa} PA${sp.cd ? ` · relance ${sp.cd} t.` : ""}</span></div><div class="xs muted">${spellDesc(sp)}</div>
          <select class="small" data-act="spcond" data-i="${i}" aria-label="Condition">${Object.entries(CONDITIONS).map(([k, n]) => `<option value="${k}" ${x.cond === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
          <button class="btn sm" data-act="sprem" data-i="${i}">Retirer</button></div></div>`; }).join("") || `<div class="empty">Aucun sort équipé : ce héros ne fera rien en combat.</div>`}</div></div>
    <div class="panel"><div class="phead"><h2>Sorts disponibles</h2></div>
      <div class="list">${avail.map((sp) => `<div class="li">${spIcon(sp)}<span class="grow"><span class="name">${h(sp.name)}</span> <span class="muted xs">${sp.pa} PA</span><br><span class="xs muted">${spellDesc(sp)}</span></span><button class="btn sm" data-act="spadd" data-id="${sp.id}" ${eq.length >= 6 ? "disabled" : ""}>Équiper</button></div>`).join("")}
        ${locked.map((sp) => `<div class="li" style="opacity:.55">${spIcon(sp)}<span class="grow"><span class="name">${h(sp.name)}</span><br><span class="xs muted">${spellDesc(sp)}</span></span><span class="tag soft">niv. ${sp.lvl}</span></div>`).join("")}
        ${!avail.length && !locked.length ? `<div class="empty">Tous les sorts sont équipés.</div>` : ""}</div></div>
  </div></div>`;
}

/* ---------- INVENTAIRE ---------- */
function renderInventory() {
  const items = Object.values(S.items); const filt = ui.slotFilter;
  const shown = items.filter((it) => filt === "all" || (filt === "radiant" ? it.radiant : ITEMS[it.tpl].slot === filt))
    .sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl || a.tpl.localeCompare(b.tpl));
  const res = Object.entries(S.res).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const runes = Object.entries(S.runes).sort((a, b) => E.runeInfo(b[0]).weight - E.runeInfo(a[0]).weight);
  let body = "";
  if (ui.inv === "items") {
    body = `<div class="pad row" style="padding-bottom:6px"><select data-act="slotfilter" aria-label="Filtrer">${[["all", "Tous"], ["radiant", "✦ Rayonnants"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"]].map(([v, n]) => `<option value="${v}" ${filt === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <span class="muted small num">${items.length}/${E.ITEM_CAP} objets</span></div>
      <div class="list">${shown.map((it) => { const T = ITEMS[it.tpl]; const by = E.equippedBy(S, it.uid);
        return `<div class="li ${it.radiant ? "radiant" : ""}" style="align-items:flex-start">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="muted xs">niv. ${T.lvl} · ${SLOTS[T.slot === "anneau" ? "anneau1" : T.slot]} · jet ${Math.round(E.itemQuality(it) * 100)} %${T.set && SETS[T.set] ? ` · ${h(SETS[T.set].name)}` : ""}</span><br><span class="small">${itemStatsHtml(it)}</span></span>
          <span class="stack" style="gap:4px;align-items:flex-end">${by ? `<span class="tag good">${h(by.name)}</span>` : `<button class="btn sm" data-act="givesheet" data-uid="${it.uid}">Équiper</button><button class="btn sm" data-act="sellitem" data-uid="${it.uid}">Vendre</button>`}</span></div>`; }).join("") || `<div class="empty">Aucun objet. Les monstres en lâchent parfois, et les Ateliers permettent d'en fabriquer.</div>`}</div>`;
  } else if (ui.inv === "res") {
    body = `<p class="note pad" style="padding-bottom:0">Les ressources et objets sont partagés entre tous vos héros.</p><div class="list">${res.map(([n, q]) => `<div class="li">${im(resImg(n), "ico", n)}<span class="grow"><span class="name">${h(n)}</span>${E.isKey(n) ? ` <span class="tag">Clé</span>` : SPECIAL_CRAFTS[n] ? ` <span class="tag">Spécial</span>` : ""}</span><span class="num">${fmt(q)}</span>
      ${E.resPrice(n) ? `<button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="1">Vendre 1</button><button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="${q}">Tout (${fmt(E.resPrice(n) * q)} k)</button>` : ""}</div>`).join("") || `<div class="empty">Aucune ressource pour le moment.</div>`}</div>`;
  } else {
    body = `<div class="list">${runes.map(([k, q]) => { const i = E.runeInfo(k); return `<div class="li"><span class="eld" style="--c:var(--gold)">ᚱ</span><span class="grow"><span class="name">${E.runeName(k)}</span> <span class="muted xs">+${i.pts} ${STATS[i.stat].name} · poids ${i.weight}</span></span><span class="num">${fmt(q)}</span></div>`; }).join("") || `<div class="empty">Aucune rune. Brisez des objets dans les Ateliers pour en obtenir.</div>`}</div>`;
  }
  $("#main").innerHTML = `<div class="pagehead"><h1>Inventaire</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b> kamas</span></div>
    <nav class="subtabs">${[["items", "Équipements"], ["res", "Ressources"], ["runes", "Runes"]].map(([id, n]) => `<button data-act="invtab" data-v="${id}" aria-pressed="${ui.inv === id}">${n}</button>`).join("")}</nav>
    <section class="panel">${body}</section>`;
}

/* ---------- ATELIERS ---------- */
function ingHtml(ing, mult = 1) {
  return `<div class="ing">${ing.map(([r, q]) => { const have = S.res[r] || 0; return `<span class="${have >= q * mult ? "ok" : "ko"}" title="${h(r)}">${im(resImg(r), "", r)}${h(r)} <b class="num">${fmt(have)}/${q * mult}</b></span>`; }).join("")}</div>`;
}
function renderWorkshop() {
  let body = "";
  if (ui.ate === "recolte") {
    body = `<p class="note">Chaque métier récolte en continu, même pendant les combats et à 25 % hors-ligne. Les ressources plus rares se débloquent avec le niveau du métier.</p>
    <div class="grid2">${Object.entries(GATHER_JOBS).map(([id, J]) => { const s = S.jobs[id]; const t = E.gatherTime(s.lvl);
      return `<div class="panel"><div class="phead"><h2>${J.name}</h2><span class="num">niv. ${s.lvl}</span></div><div class="pad stack" style="gap:8px">
        <div class="bar xp"><i style="width:${pct(s.xp, E.jobXpNeed(s.lvl))}%"></i></div>
        <div class="row">${im(resImg(s.target), "ico", s.target)}<label class="row small grow"><span class="muted">Récolter</span><select data-act="gather" data-job="${id}">${J.items.map(([r, l]) => `<option value="${h(r)}" ${s.target === r ? "selected" : ""} ${l > s.lvl ? "disabled" : ""}>${h(r)}${l > s.lvl ? ` (niv. ${l})` : ""}</option>`).join("")}</select></label></div>
        <div class="bar green" data-gprog="${id}"><i style="width:${pct(s.prog, t)}%"></i></div>
        <div class="xs muted num">${t.toFixed(1)} s par récolte · stock : ${fmt(S.res[s.target] || 0)}</div></div></div>`; }).join("")}</div>`;
  } else if (ui.ate === "craft") {
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
          <button class="btn sm ${ok ? "primary" : ""}" data-act="craft" ${r.tpl ? `data-tpl="${r.tpl}"` : `data-special="${h(r.special)}"`} ${ok ? "" : "disabled"}>Fabriquer</button></div>`; }).join("") || `<div class="empty">Aucune recette.</div>`}${total > 80 ? `<div class="empty">… ${total - 80} autres recettes : affinez la recherche.</div>` : ""}</div></section>`;
  } else if (ui.ate === "brisage") {
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
  } else body = emblemView();
  $("#main").innerHTML = `<div class="pagehead"><h1>Ateliers</h1></div>
    <nav class="subtabs">${[["recolte", "Récolte"], ["craft", "Artisanat"], ["brisage", "Brisage"], ["embleme", "Emblème"]].map(([id, n]) => `<button data-act="atetab" data-v="${id}" aria-pressed="${ui.ate === id}">${n}</button>`).join("")}</nav>
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
    <div class="classpick">${Object.entries(CLASSES).map(([id, c]) => `<button data-act="startcls" data-cls="${id}" aria-pressed="${ui.startCls === id}"><span class="row"><span class="emb" style="--cc:${c.color};width:44px;height:44px">${im(logoImg(id), "", "")}</span><strong>${c.name}</strong></span><span class="xs muted">${h(c.desc)}</span></button>`).join("")}</div>
    <div class="row"><span class="small muted">Apparence</span><span class="seg">${[["m", "Masculin"], ["f", "Féminin"]].map(([v, n]) => `<button data-act="startsex" data-v="${v}" aria-pressed="${sex === v}">${n}</button>`).join("")}</span></div>
    <label class="stack" style="gap:4px"><span class="small muted">Nom</span><input type="text" id="recName" maxlength="20" value="${h(D.NAMES[Math.floor(Math.random() * D.NAMES.length)])}"></label>
    <div class="row"><button class="btn primary" data-act="recruit" ${S.kamas < cost ? "disabled" : ""}>Recruter</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
}
function giveSheet(uid) {
  const it = S.items[uid]; const T = ITEMS[it.tpl]; ui.giveTo = uid;
  openSheet(`<div class="row">${itemIcon(it)}<h2>${itemName(it)}</h2></div><p class="small muted">Niveau ${T.lvl} requis<br>${itemStatsHtml(it)}</p>
    <div class="list">${S.chars.map((c) => { const slot = E.slotFor(c, it);
      return `<div class="li">${head(c)}<span class="grow"><span class="name">${h(c.name)}</span> <span class="muted xs">niv. ${c.lvl}</span><br>${deltaHtml(c, slot, uid)}</span><button class="btn sm primary" data-act="giveto" data-id="${c.id}" ${T.lvl > c.lvl ? "disabled" : ""}>${T.lvl > c.lvl ? "Niv. trop bas" : "Équiper"}</button></div>`; }).join("")}</div>
    <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function optionsSheet() {
  openSheet(`<h2>Options</h2>
    <div class="stack small">
      <div class="row"><span class="muted">Thème</span><span class="seg">${[["dark", "Nuit"], ["light", "Jour"]].map(([v, n]) => `<button data-act="settheme" data-v="${v}" aria-pressed="${(S.settings.theme || "dark") === v}">${n}</button>`).join("")}</span></div>
      <div><b>Sauvegarde</b><br><span class="muted">Automatique dans ce navigateur${lastSaveOk ? ` · dernière : ${new Date(lastSaveOk).toLocaleTimeString("fr-FR")}` : ""}. Pour changer d'appareil, exportez puis importez.</span></div>
      <div class="row"><button class="btn sm" data-act="savenow">Sauvegarder maintenant</button></div>
      <div><b>Exporter</b><textarea id="exp" readonly>${h(btoa(unescape(encodeURIComponent(E.serialize(S)))))}</textarea><button class="btn sm" data-act="copyexp">Copier</button></div>
      <div><b>Importer</b> <span class="muted">(remplace la partie actuelle ; les sauvegardes v1 sont converties)</span><textarea id="imp" placeholder="Collez la sauvegarde ici"></textarea><button class="btn sm" data-act="import">Importer</button> <span id="impmsg" class="minus"></span></div>
      <div><b>Nouvelle partie</b><br>${ui.confirm === "reset" ? `<span class="minus">Toute la progression sera effacée.</span> <button class="btn sm danger" data-act="reset">Effacer et recommencer</button> <button class="btn sm" data-act="cancelreset">Annuler</button>` : `<button class="btn sm danger" data-act="askreset">Recommencer depuis le début</button>`}</div>
      <p class="note">Version 2.0 · Données DOFUS via DofusDB (${h(D.META.built)}). Projet de fan non officiel, sans lien avec Ankama Games.</p>
    </div><div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function offlineSheet(r) {
  const res = Object.entries(r.res).sort((a, b) => b[1] - a[1]);
  openSheet(`<h2>Pendant votre absence</h2>
    <p class="small">Absent ${dur(r.seconds)}. ${r.fights ? `Votre équipe a continué à 25 % de son efficacité : <b>${fmt(r.wins)}</b> combats gagnés, <span class="coin"></span> <b>+${fmt(r.kamas)}</b> kamas${r.items ? `, ${r.items} objet${r.items > 1 ? "s" : ""}` : ""}.` : "Votre équipe se reposait ; seuls les métiers de récolte ont travaillé."}</p>
    ${r.lvls.length ? `<p class="small">${r.lvls.map(([n, a, b]) => `${h(n)} : niveau ${a} → ${b}`).join("<br>")}</p>` : ""}
    ${res.length ? `<div class="list small" style="max-height:240px;overflow:auto">${res.map(([n, q]) => `<div class="li">${im(resImg(n), "ico sm", n)}<span class="grow">${h(n)}</span><span class="num">+${fmt(q)}</span></div>`).join("")}</div>` : ""}
    <div><button class="btn primary" data-act="closesheet">Continuer</button></div>`);
}
function migrationSheet(list) {
  openSheet(`<h2>Bienvenue dans la v2 !</h2><p class="small">Votre partie a été convertie : niveaux, kamas, ressources, métiers et Emblème sont conservés.</p>
    <ul class="small">${list.map((x) => `<li>${h(x)}</li>`).join("")}</ul>
    <p class="small muted">Les monstres, objets et sorts sont maintenant ceux de DOFUS. Pensez à rééquiper vos héros et à choisir leurs sorts.</p>
    <div><button class="btn primary" data-act="closesheet">C'est parti</button></div>`);
}

/* ---------- rendu ---------- */
function render() {
  if (!S) return renderStart();
  renderNav(); renderStatus();
  if (ui.tab === "home") renderHome();
  else if (ui.tab === "world") renderWorld();
  else if (ui.tab === "combat") renderCombat();
  else if (ui.tab === "heroes") renderHeroes();
  else if (ui.tab === "inv") renderInventory();
  else renderWorkshop();
}
function toast(txt, kind) {
  const box = $("#toasts"); const d = document.createElement("div");
  d.className = "toast " + (kind === "rare" ? "rare" : kind === "radiant" ? "radiant" : ""); d.textContent = txt; box.prepend(d);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => d.remove(), kind === "rare" || kind === "radiant" ? 6500 : 3500);
}
const msg = (r) => { if (typeof r === "string") toast(r); };
function setTheme(v) { S.settings.theme = v; document.documentElement.dataset.theme = v; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = v === "dark" ? "#120e0a" : "#efe3c4"; }

/* ---------- actions ---------- */
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-tab],[data-act]"); if (!t) return;
  if (t.dataset.tab) { if (!S) return; ui.tab = t.dataset.tab; ui.slot = null; ui.confirm = null; if (ui.tab === "world" && t.closest("#nav")) ui.zoneView = null; closeSheet(); render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.act;
  if (a === "closesheet") { if (t.classList.contains("sheet-bg") && ev.target !== t) return; closeSheet(); if (S) render(); return; }
  if (t.tagName === "SELECT" || (t.tagName === "INPUT" && t.type !== "checkbox")) return;
  const d = t.dataset; const c = ui.cid && S ? char(ui.cid) : null;
  switch (a) {
    case "startcls": ui.startCls = d.cls; ui.startSex = null; if (!S) renderStart(); else recruitSheet(); return;
    case "startsex": ui.startSex = d.v; if (!S) renderStart(); else recruitSheet(); return;
    case "startgame": { const name = ($("#startName").value || "").trim() || "Aventurier"; S = E.newState(name.slice(0, 20), ui.startCls); S.chars[0].sex = ui.startSex || CLASSES[ui.startCls].sex; setTheme(document.documentElement.dataset.theme || "dark"); ui.cid = S.chars[0].id; ui.tab = "world"; dirty = true; saveNow(); render(); toast("Choisissez une zone pour partir chasser !"); return; }
    case "theme": setTheme(isDark() ? "light" : "dark"); break;
    case "settheme": setTheme(d.v); optionsSheet(); render(); return;
    case "speed": S.settings.speed = +d.v; break;
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
    case "spup": case "spdown": { const i = +d.i, j = a === "spup" ? i - 1 : i + 1; [c.spells[i], c.spells[j]] = [c.spells[j], c.spells[i]]; c.activePreset = null; break; }
    case "sprem": c.spells.splice(+d.i, 1); c.activePreset = null; break;
    case "spadd": if (c.spells.length < 6) { const sp = E.spellDef(c.cls, d.id); c.spells.push({ id: d.id, cond: sp.type.startsWith("heal") ? "ally_low" : sp.type === "aoe" ? "enemy_many" : "always" }); c.activePreset = null; } break;
    case "psave": { const old = c.presets[+d.i]; const name = old ? old.name : (prompt("Nom de la stratégie :", ["Farm", "Boss", "Solo", "Donjon"][+d.i] || "Stratégie") || "").trim(); if (!old && !name) return; E.savePreset(S, c.id, +d.i, name); toast("Stratégie enregistrée."); break; }
    case "pload": E.applyPreset(S, c.id, +d.i); toast(`Stratégie « ${c.presets[+d.i].name} » chargée.`); break;
    case "pdel": E.deletePreset(S, c.id, +d.i); break;
    case "pzonedel": E.setZonePreset(S, c.id, d.z, null); break;
    case "recruitsheet": recruitSheet(); return;
    case "recruit": { const r = E.recruit(S, ui.startCls, ($("#recName").value || "").trim().slice(0, 20)); if (r) { toast(r); return; } const nc = S.chars[S.chars.length - 1]; nc.sex = ui.startSex || CLASSES[ui.startCls].sex; closeSheet(); ui.cid = nc.id; break; }
    case "invtab": ui.inv = d.v; break;
    case "givesheet": giveSheet(+d.uid); return;
    case "giveto": { const r = E.equip(S, +d.id, ui.giveTo); if (r) { toast(r); return; } closeSheet(); toast("Objet équipé."); break; }
    case "sellitem": { const p = E.sellItem(S, +d.uid); if (p) toast(`Vendu pour ${fmt(p)} kamas.`); break; }
    case "sellres": { const p = E.sellRes(S, d.n, +d.q); if (p) toast(`Vendu pour ${fmt(p)} kamas.`); break; }
    case "atetab": ui.ate = d.v; ui.confirm = null; break;
    case "craftjob": ui.craftJob = d.v; break;
    case "craftonly": ui.craftOnly = t.checked; break;
    case "craft": { const r = d.tpl ? E.craftItem(S, d.tpl) : E.craftSpecial(S, d.special);
      if (typeof r === "string") toast(r); else if (r && r.uid) { if (!r.radiant) toast(`Fabriqué : ${ITEMS[r.tpl].name} (jet ${Math.round(E.itemQuality(r) * 100)} %)`); } else toast(`Fabriqué : ${d.special}`); break; }
    case "break": { const r = E.breakItem(S, +d.uid, ui.focus || null); if (typeof r === "string") toast(r); else toast("Runes : " + (Object.entries(r).map(([k, q]) => `${E.runeName(k)} ×${q}`).join(", ") || "aucune")); break; }
    case "askbreakall": ui.confirm = "breakall"; break;
    case "cancel": ui.confirm = null; break;
    case "breakall": { let n = 0; Object.values(S.items).forEach((it) => { if (!E.equippedBy(S, it.uid) && !it.radiant) { E.breakItem(S, it.uid, ui.focus || null); n++; } }); ui.confirm = null; toast(`${n} objets brisés.`); break; }
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
  if (a === "autostat") { const x = char(+t.dataset.id); x.autoStat = t.value || null; E.autoAllocate(S, x); }
  else if (a === "spcond") { c.spells[+t.dataset.i].cond = t.value; c.activePreset = null; }
  else if (a === "slotfilter") ui.slotFilter = t.value;
  else if (a === "gather") { S.jobs[t.dataset.job].target = t.value; S.jobs[t.dataset.job].prog = 0; }
  else if (a === "focus") ui.focus = t.value;
  else if (a === "pzone") { if (!t.value) return; E.setZonePreset(S, c.id, t.value, +t.dataset.i); toast("Stratégie associée à la zone."); }
  else if (a === "craftonly") ui.craftOnly = t.checked;
  else return;
  dirty = true; render();
});
document.addEventListener("input", (ev) => {
  const t = ev.target; if (t.dataset.act !== "craftsearch") return;
  ui.craftSearch = t.value; const pos = t.selectionStart; renderWorkshop(); const n = $("#craftSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
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
let last = performance.now(), sinceSave = 0, sinceView = 0;
const isEditing = () => { const a = document.activeElement; return a && (a.tagName === "SELECT" || a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
function loop() {
  const now = performance.now(); const dt = Math.min(now - last, 5000); last = now;
  if (S) {
    E.tick(S, dt); S.lastTick = Date.now();
    sinceSave += dt; sinceView += dt;
    if (E.events.length) { E.events.splice(0).forEach((ev) => { if (["rare", "up", "radiant"].includes(ev.kind) || (ev.kind === "loot" && /^Butin : Clef/.test(ev.txt))) toast(ev.txt, ev.kind); }); dirty = true; }
    const k = $("#stKamas"); if (k) k.textContent = fmt(S.kamas);
    const kl = $("#stKills"); if (kl) kl.textContent = fmt(Object.values(S.bestiary).reduce((a, b) => a + b, 0));
    if (ui.tab === "combat") updateCombat(false);
    else if (ui.tab === "ateliers" && ui.ate === "recolte") {
      document.querySelectorAll("[data-gprog]").forEach((b) => { const s = S.jobs[b.dataset.gprog]; b.firstElementChild.style.width = pct(s.prog, E.gatherTime(s.lvl)) + "%"; });
      if (sinceView > 4000 && !isEditing()) { sinceView = 0; renderWorkshop(); }
    } else if (ui.tab === "home" && sinceView > 3000 && !$("#sheet").innerHTML) { sinceView = 0; renderHome(); renderStatus(); }
    if (sinceSave > 15000) { sinceSave = 0; saveNow(); }
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
  } else render();
  loop();
}
window.DX = { get S() { return S; }, ui, render, E };
start();
})();
