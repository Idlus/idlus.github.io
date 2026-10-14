/* ============================================================================
   PANEL DE TEST — Idlus, version de test (/beta/) et partie de test du jeu public (1.0.8.1, bouton
   « Panel de test » du panel admin). Sur la vraie partie du jeu public, ce fichier ne fait rien.
   0.1.27.1 : réservé au compte admin (rôle vérifié par le serveur), et ouvert en local pour les essais.
   Il ne touche que la partie de test de ce navigateur.
   1.0.30 (choix 29A) : devient l'onglet Test du Panel Xener (js/panel.js) au lieu d'une fenêtre : départs rapides
   (nouveau joueur, milieu et fin de jeu, partie d'un joueur), un seul champ « Donner » pour tout, simulation de
   100 combats sur une copie de l'équipe, temps et absence, nouveautés à essayer, parties types. Toutes les
   actions d'avant sont gardées (boutons rapides de « Donner » et de « Progression »), et dans la recherche (Ctrl K).
   ========================================================================== */
(function () {
"use strict";
if (!window.DX || !window.DX.openSheet || !window.DX.testerOk) return; // 1.0.8.2 : DX.testerOk n'existe que sur la bêta et la partie de test du jeu public
const DX = window.DX, E = DX.E, D = window.DATA;
const { CLASSES, ZONES, DUNGEONS, ITEMS, RES, CONSUMABLES } = D;
const h = DX.h, fmt = DX.fmt;
const SNAP_KEY = DX.LS_KEY + "-tests", SNAP_MAX = 8;
const st = { dg: null, k: 1, lvl: 100, gear: "bon", who: "team", give: "", giveN: 1, rad: false, away: 3, sim: null, copy: "" };
const S = () => DX.S;
const PN = () => window.PANEL;

/* ---------- parties types enregistrées ---------- */
const readSnaps = () => { try { const a = JSON.parse(localStorage.getItem(SNAP_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const writeSnaps = (a) => { try { localStorage.setItem(SNAP_KEY, JSON.stringify(a.slice(0, SNAP_MAX))); return true; } catch (e) { DX.toast("Plus de place pour enregistrer cette partie."); return false; } };
const snapMeta = (s) => `${s.chars.length} héros, niveau ${Math.max(...s.chars.map((c) => c.lvl))} max`;

/* ---------- équipement automatique (même logique que le simulateur) ---------- */
const W = { vit: 0.25, sa: 2, pui: 1, pa: 60, cri: 3, dcri: 1.5, so: 1.5, ini: 0.05, dt: 3, dn: 3, df: 3, de: 3, da: 3 };
const score = (T, main) => { let s = 0; for (const k in T.stats) { const [a, b] = T.stats[k]; s += ((a + b) / 2) * (k === main ? 1 : W[k] || 0); } return s; };
const bestFor = (slot, lvl, main) => Object.keys(ITEMS).filter((id) => ITEMS[id].slot === slot && ITEMS[id].lvl <= lvl).sort((x, y) => score(ITEMS[y], main) - score(ITEMS[x], main));
function giveEquip(s, c, tpl, slot, perfect) {
  const it = E.rollItem(s, tpl, { radiant: false });
  for (const k in it.stats) { const [a, b] = ITEMS[tpl].stats[k]; it.stats[k] = perfect ? b : Math.round((a + b) / 2); }
  const old = c.equip[slot]; const r = E.equip(s, c.id, it.uid, slot); if (old && s.items[old] && !E.equippedBy(s, old)) delete s.items[old]; return r;
}
function gearUp(s, c, prof) {
  if (prof === "aucun") return;
  const main = CLASSES[c.cls].main, perfect = prof === "optimise";
  ["arme", "coiffe", "cape", "amulette", "ceinture", "bottes", "bouclier"].forEach((slot) => { const t = bestFor(slot, c.lvl, main)[0]; if (t) giveEquip(s, c, t, slot, perfect); });
  const rings = bestFor("anneau", c.lvl, main); if (rings[0]) giveEquip(s, c, rings[0], "anneau1", perfect); if (rings[1]) giveEquip(s, c, rings[1], "anneau2", perfect);
  if (perfect) { bestFor("dofus", c.lvl, main).slice(0, D.DOFUS_SLOTS.length).forEach((t, i) => giveEquip(s, c, t, D.DOFUS_SLOTS[i], true)); c.scrolls = { vit: 100, sa: 100, [main]: 100 }; }
  E.refreshSpells(c, E.charStats(s, c));
}
function setLevel(s, c, lvl) {
  c.lvl = Math.max(1, Math.min(E.MAX_LVL, lvl)); c.xp = 0;
  E.resetPoints(s, c.id); E.refreshSpells(c, E.charStats(s, c));
}
function unlockAll(s) {
  ZONES.forEach((z) => { if (z.requires && z.requires.boss) s.progress.bossKills[z.requires.boss] = s.progress.bossKills[z.requires.boss] || 1; });
  Object.values(E.SUBS).forEach((x) => { if (x.requiresItem && !(s.res[x.requiresItem] > 0)) E.addRes(s, x.requiresItem, 1); });
}
const targets = (s) => (st.who === "team" ? E.team(s) : s.chars);

/* ---------- un seul champ pour donner n'importe quoi (1.0.30) ---------- */
const MONEY = () => [["Kamas", "kamas"], ["Bribes de rêve", "bribes"]].concat(Object.values(E.SHOPS || {}).map((x) => [x.curName, "tok:" + x.cur]));
function findAny(n) {
  const q = String(n || "").trim(); if (!q) return null; const low = q.toLowerCase();
  const m = MONEY().find((x) => x[0].toLowerCase() === low); if (m) return { kind: "money", id: m[1], name: m[0] };
  const pick = (o, get) => { for (const id in o || {}) if (String(get(o[id], id)).toLowerCase() === low) return id; return null; };
  let id;
  if ((id = pick(E.DOFUS, (x) => x.name))) return { kind: "dofus", id, name: E.DOFUS[id].name };
  const L = (E.LEG_LIST || []).find((x) => x.name.toLowerCase() === low); if (L) return { kind: "leg", id: L.k, name: L.name };
  if ((id = pick(E.IDOLS, (x) => x.name))) return { kind: "idol", id, name: E.IDOLS[id].name };
  if ((id = pick(E.PETS, (x) => x.name))) return { kind: "pet", id, name: E.PETS[id].name };
  if ((id = pick(CONSUMABLES, (x) => x.name))) return { kind: "cons", id, name: CONSUMABLES[id].name };
  if ((id = pick(ITEMS, (x) => x.name))) return { kind: "item", id, name: ITEMS[id].name };
  if ((id = pick(RES, (x, k) => k))) return { kind: "res", id, name: id };
  return null;
}
function giveAny(n, q, rad) {
  const s = S(); if (!s) return; const f = findAny(n); q = Math.max(1, Math.round(+q || 1));
  if (!f) { DX.toast("Inconnu : choisis un nom dans la liste (ressource, objet, consommable, Dofus, idole, familier, légendaire, monnaie)."); return; }
  st.give = f.name; let txt = "";
  switch (f.kind) {
    case "money": if (f.id === "kamas") s.kamas += q; else if (f.id === "bribes") E.sgGive(s, q); else { const k = f.id.slice(4); s.tokens[k] = (s.tokens[k] || 0) + q; } txt = `+${fmt(q)} ${f.name}.`; break;
    case "dofus": if (!E.dofusOwned(s, f.id)) E.giveDofus(s, f.id, "panel de test"); txt = `${f.name} dans le sac.`; break;
    case "leg": for (let i = 0; i < Math.min(q, 20); i++) E.giveLeg(s, f.id, "panel de test"); txt = `${f.name} ×${Math.min(q, 20)} dans le sac.`; break;
    case "idol": if (!E.idolOwned(s, f.id)) E.giveIdol(s, f.id, "panel de test"); txt = `${f.name} dans la collection.`; break;
    case "pet": E.givePet(s, f.id, "panel de test"); txt = `${f.name} adopté.`; break;
    case "cons": E.addCons(s, f.id, q); txt = `+${fmt(q)} ${f.name}.`; break;
    case "item": for (let i = 0; i < Math.min(q, 20); i++) E.rollItem(s, f.id, { radiant: !!rad }); txt = `${f.name}${q > 1 ? ` ×${Math.min(q, 20)}` : ""} ajouté au sac.`; break;
    case "res": E.addRes(s, f.id, q); txt = `+${fmt(q)} ${f.name}.`; break;
  }
  E.events.length = 0; done(txt);
}
const giveList = () => {
  if (document.getElementById("admGiveL")) return "";
  const o = []; const add = (n, d) => o.push(`<option value="${h(n)}">${h(d)}</option>`);
  MONEY().forEach(([n]) => add(n, "monnaie"));
  (E.DOFUS_ORDER || Object.keys(E.DOFUS)).forEach((id) => E.DOFUS[id] && add(E.DOFUS[id].name, "Dofus"));
  (E.LEG_LIST || []).forEach((x) => add(x.name, "légendaire"));
  Object.values(E.IDOLS || {}).forEach((x) => add(x.name, "idole"));
  Object.values(E.PETS || {}).forEach((x) => add(x.name, "familier"));
  Object.values(CONSUMABLES).forEach((x) => add(x.name, "consommable"));
  Object.keys(ITEMS).sort((a, b) => ITEMS[a].lvl - ITEMS[b].lvl).forEach((t) => add(ITEMS[t].name, `objet niv. ${ITEMS[t].lvl}`));
  Object.keys(RES).sort().forEach((n) => add(n, "ressource"));
  const dl = document.createElement("datalist"); dl.id = "admGiveL"; dl.innerHTML = o.join(""); document.body.appendChild(dl); return "";
};

/* ---------- départs rapides (1.0.30) : remplacent la partie de test (copie de secours faite) ---------- */
function makeTeam(cls, L, prof) {
  const N = E.newState(cls[0][1], cls[0][0]); N.chars = [];
  cls.forEach(([k, n, sx]) => { const c = E.addChar(N, k, n, L, sx); c.inTeam = true; });
  N.chars.forEach((c) => gearUp(N, c, prof)); unlockAll(N); N.kamas = Math.max(N.kamas, L * 2000);
  return N;
}
function preset(k, cls0) {
  const s = S(); const cls = cls0 && cls0.length ? cls0 : s ? (E.team(s).length ? E.team(s) : s.chars).slice(0, 4).map((c) => [c.cls, c.name, c.sex]) : [["iop", "Testeur", "m"], ["eni", "Soigneuse", "f"], ["cra", "Archer", "m"], ["sacri", "Rempart", "m"]];
  if (k === "new") { const N = E.newState(cls[0][1], cls[0][0]); replaceGame(N, "Nouveau joueur : niveau 1, rien de débloqué."); return; }
  if (k === "mid") { const N = makeTeam(cls, 100, "bon"); N.kamas = Math.max(N.kamas, 1000000); replaceGame(N, "Milieu de jeu : équipe niveau 100, bon équipement."); return; }
  if (k === "end") { const N = makeTeam(cls, E.MAX_LVL, "optimise"); N.kamas = Math.max(N.kamas, 10000000); replaceGame(N, `Fin de jeu : équipe niveau ${E.MAX_LVL}, équipement optimisé.`); return; }
  if (k === "copy") { st.copyOpen = true; paint(); setTimeout(() => { const i = document.getElementById("admCopy"); if (i) i.focus(); }, 30); return; }
}
/* préparé sur la vraie partie (Panel Xener › Test), appliqué à l'ouverture de la partie de test */
function applyTodo() {
  const P = PN(); if (!P) return; let t = null;
  try { t = JSON.parse(localStorage.getItem(P.TODO_KEY) || "null"); localStorage.removeItem(P.TODO_KEY); } catch (e) { t = null; }
  if (!t || !(Date.now() - (t.at || 0) < 600000)) return;
  if (t.k === "preset") preset(t.v, t.cls);
  else if (t.k === "copy" && typeof t.txt === "string") { let N; try { N = E.deserialize(t.txt); } catch (e) { DX.toast("La partie copiée est illisible."); return; } replaceGame(N, `Partie de ${t.who || "ce joueur"} copiée dans ta partie de test.`); }
  if (PN()) setTimeout(() => PN().open("test"), 50);
}

/* ---------- simulation de 100 combats sur une copie de l'équipe (1.0.30) ---------- */
async function sim100() {
  const s = S(); if (!s || (st.sim && st.sim.run)) return;
  st.dg = val("admDg") || st.dg; st.k = +val("admK") || st.k; const did = st.dg, k = st.k, dg = DUNGEONS[did];
  if (!E.team(s).length) { DX.toast("Votre équipe est vide."); return; }
  const base = E.serialize(s); const N = 100; const sim = (st.sim = { run: true, n: 0, win: 0, t: 0, did, k });
  paint();
  const ev0 = E.events.length;
  for (let i = 0; i < N && sim.run; i++) {
    let C; try { C = E.deserialize(base); } catch (e) { break; }
    if (C.dungeon) E.leaveDungeon(C); if (C.hunting) E.stopHunt(C);
    unlockAll(C); const SI = E.stasisInfo(C, did); SI.max = Math.max(SI.max, k - 1); E.addRes(C, dg.key, 1);
    if (E.enterDungeon(C, did, k)) { sim.err = "Entrée impossible dans ce donjon."; break; }
    let t = 0; while (C.dungeon && t < 3600 * 1000) { E.tick(C, 1000); t += 1000; }
    if (E.stasisInfo(C, did).max >= k) { sim.win++; sim.t += t; }
    sim.n++; E.events.length = ev0;
    if (i % 4 === 3) { simPaint(); await new Promise((r) => setTimeout(r, 0)); }
  }
  sim.run = false; E.events.length = ev0; simPaint(); paint();
}
const simTxt = () => {
  const x = st.sim; if (!x) return `<span class="xs muted">Sur une copie de ton équipe : la vraie partie ne bouge pas.</span>`;
  const p = x.n ? Math.round((x.win / x.n) * 100) : 0; const avg = x.win ? x.t / x.win / 1000 : 0;
  return `<span class="small">${x.run ? `${x.n} / 100 · ` : ""}<b>${p} %</b> de victoires${x.win ? ` · ${Math.round(avg) < 60 ? `${Math.round(avg)} s` : `${Math.floor(Math.round(avg) / 60)} min ${String(Math.round(avg) % 60).padStart(2, "0")}`} en moyenne` : ""} <span class="xs muted">(${h(DUNGEONS[x.did].name)}, stasis ${x.k}${x.run ? "" : `, ${x.n} essais`})</span>${x.err ? ` <span class="minus">${h(x.err)}</span>` : ""}</span>`;
};
const simPaint = () => { const el = document.getElementById("admSim"); if (el) el.innerHTML = simTxt(); };

/* ---------- rendu : onglet Test du Panel Xener ---------- */
const btn = (act, label, extra = "", cls = "") => `<button class="btn sm ${cls}" data-adm="${act}" ${extra}>${label}</button>`;
const chip = (act, label, extra = "") => `<button class="px-chip" data-adm="${act}" ${extra}>${label}</button>`;
const box = (title, body, extra = "") => `<div class="box"><div class="row between"><h2>${title}</h2>${extra}</div>${body}</div>`;
const row = (body) => `<div class="row" style="flex-wrap:wrap;gap:6px;align-items:center">${body}</div>`;
const inp = (id, attrs) => `<input id="${id}" ${attrs} style="max-width:100%">`;
const lastCopy = () => { try { const a = window.SAVE ? window.SAVE.copies() : []; const t = Math.max(0, ...a.map((c) => c.t || 0)); return t ? new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""; } catch (e) { return ""; } };

function testHtml() {
  const s = S(); if (!s) return `<div class="box"><div class="empty">Commence une partie pour utiliser la partie de test.</div></div>`;
  const dgs = Object.keys(DUNGEONS).sort((a, b) => DUNGEONS[a].lvl - DUNGEONS[b].lvl || DUNGEONS[a].name.localeCompare(DUNGEONS[b].name));
  if (!st.dg || !DUNGEONS[st.dg]) st.dg = dgs[0];
  const snaps = readSnaps(); const P = PN(); const top = Math.max(...s.chars.map((c) => c.lvl));
  const s10 = Object.keys(DUNGEONS).every((d) => ((s.stasis || {})[d] || {}).max >= E.STASIS_MAX);
  const lc = lastCopy();
  const copyOk = !!(window.CHAT && window.CHAT.role === "admin" && window.ONLINE && window.ONLINE.rpc && !P.TESTMODE);
  const head = box("Ta partie de test", `<div class="small">${s.chars.length} héros niveau ${top} au plus · ${fmt(Math.floor(s.kamas))} kamas · vitesse ×${DX.speed} · stasis ${E.STASIS_MAX} partout : ${s10 ? "oui" : "non"}${lc ? ` · copie de secours faite à ${lc}` : ""}</div>
    <div class="px-pre">${(P.P.PRESETS || []).map(([k, n, d]) => `<button data-adm="preset" data-v="${k}" ${k === "copy" && !copyOk ? `disabled title="Depuis ta vraie partie : Panel Xener › Test › Comme un joueur"` : ""}><b>${n}</b><span>${k === "copy" && !copyOk ? "depuis ta vraie partie" : d}</span></button>`).join("")}</div>
    ${st.copyOpen && copyOk ? `<div class="srch"><input id="admCopy" value="${h(st.copy)}" placeholder="Pseudo du joueur à copier" autocomplete="off"><button class="btn primary" data-act="adm-pxcopy">Copier sa partie</button></div>` : ""}
    <span class="xs muted">Un départ rapide remplace cette partie (copie de secours faite) et reprend les classes de ton équipe (${E.team(s).map((c) => h(CLASSES[c.cls].name)).join(", ") || "aucune"}).</span>`, `<span class="tag soft">jamais le vrai jeu</span>`);
  const give = box("Donner", row(`${inp("admGive", `list="admGiveL" value="${h(st.give)}" placeholder="Ressource, objet, consommable, Dofus, idole, familier…" autocomplete="off" style="flex:1 1 220px;min-width:0"`)}${inp("admGiveN", `type="number" min="1" value="${st.giveN}" style="width:80px"`)}<label class="xs"><input type="checkbox" id="admRad" ${st.rad ? "checked" : ""}> Rayonnant</label>${btn("give", "Donner", "", "primary")}`)
    + `<div class="px-chips">${chip("kamas", "+100 000 kamas", `data-v="100000"`)}${chip("kamas", "+10 M kamas", `data-v="10000000"`)}${chip("keys", "5 clés de chaque donjon")}${chip("dofus", "Tous les Dofus")}${chip("idols", "Toutes les idoles")}${chip("pets", "Tous les familiers")}${chip("petgrow", "Familiers adultes")}${chip("mounts", "Montures (niv. 100)")}${chip("nets", "10 filets")}${chip("stones", "20 Pierres d'âme")}${chip("souls", "Toutes les âmes")}${chip("garunes", "Runes Ga ×5")}${chip("tarunes", "Runes de transcendance ×2")}${chip("fm100", "Forgemagie niveau 200")}${chip("births", "Naissances maintenant")}${chip("prot", "Un protecteur")}</div>
    <span class="xs muted">Les noms viennent des données du jeu : tout ce qui existe est dans la liste. Une monnaie (kamas, Bribes, insignes…) prend la quantité.</span>${giveList()}`);
  const fight = box("Combat", row(`<select id="admDg" data-adm-v="dg">${dgs.map((d) => `<option value="${d}" ${d === st.dg ? "selected" : ""}>Niv. ${DUNGEONS[d].lvl} · ${h(DUNGEONS[d].name)}</option>`).join("")}</select>
      <select id="admK" data-adm-v="k">${Array.from({ length: E.STASIS_MAX }, (_, i) => i + 1).map((k) => `<option value="${k}" ${k === st.k ? "selected" : ""}>Stasis ${k}</option>`).join("")}</select>${btn("fight", "Lancer", "", "primary")}`)
    + row(`${btn("sim", st.sim && st.sim.run ? "Arrêter" : "Simuler 100 combats", st.sim && st.sim.run ? `data-v="stop"` : "")}<span id="admSim">${simTxt()}</span>`)
    + `<span class="xs muted">« Lancer » entre dans le donjon avec une clé offerte et la stasis débloquée (détail dans l'onglet Combat).</span>`);
  const heroes = box("Héros", row(`<span class="seg">${[["team", "Équipe"], ["all", "Tous les héros"]].map(([v, n]) => `<button data-adm="who" data-v="${v}" aria-pressed="${st.who === v}">${n}</button>`).join("")}</span>`)
    + row(`<span class="muted small">Niveau</span>${inp("admLvl", `type="number" min="1" max="${E.MAX_LVL}" value="${st.lvl}" style="width:80px"`)}${btn("setlvl", "Appliquer")}`)
    + row(`<span class="muted small">Équiper</span>${btn("gear", "Bon équipement", `data-v="bon"`)}${btn("gear", "Optimisé", `data-v="optimise"`)}${btn("gear", "Tout retirer", `data-v="aucun"`)}`)
    + `<span class="xs muted">Bon : meilleurs objets du niveau, jets moyens. Optimisé : jets parfaits, Dofus et parchemins à 100 (comme le simulateur).</span>`);
  const time = box("Temps", row(`<span class="seg">${[1, 10, 100].map((v) => `<button data-adm="speed" data-v="${v}" aria-pressed="${DX.speed === v}">×${v}</button>`).join("")}</span><span class="xs muted">tant que la page reste ouverte</span>`)
    + row(`<span class="muted small">Absence :</span>${[1, 4, 8].map((n) => btn("away", `${n} h`, `data-v="${n}"`)).join("")}${inp("admAway", `type="number" min="1" max="48" value="${st.away}" style="width:64px"`)}<span class="xs">h</span>${btn("away", "Simuler", `data-v="input"`)}`)
    + `<span class="xs muted">Plafond du jeu : ${Math.round(E.OFFLINE_MAX_S / 3600 + E.bonus(s, "offtime"))} h d'absence.</span>`);
  const prog = box("Progression et Songe", `<div class="px-chips">${chip("unlock", "Débloquer toutes les zones")}${chip("stasis", `Stasis ${E.STASIS_MAX} dans tous les donjons`)}${chip("bribes", "+1 000 Bribes", `data-v="1000"`)}${chip("bribes", "+10 000 Bribes", `data-v="10000"`)}${chip("sgunl", "Toutes les intensités")}${chip("legone", "Un légendaire au hasard")}${chip("legall", "Tous les légendaires")}${chip("expend", "Réveiller l'équipe")}</div>`);
  const T = P.toggles.filter((x) => { try { return x.ok ? x.ok() : true; } catch (e) { return false; } });
  const news = box("Essayer une nouveauté", `<div class="stack" style="gap:8px">${[{ id: "hal", n: "Thème d'Halouine (cette page seulement)", on: () => !!window.HAL_FORCE }].concat(T).map((x) => `<button class="px-tog ${x.on() ? "" : "off"}" data-adm="tog" data-id="${h(x.id)}" aria-pressed="${!!x.on()}"><i></i>${h(x.n)}</button>`).join("")}</div><span class="xs muted">Rien de tout ça ne part en ligne : c'est pour voir les nouveautés avant les joueurs.</span>`);
  const forge = window.FORGEUI ? box("Forge (1.0.30)", `<span class="xs muted">Soft reset des jets : désactivé dans le jeu (E.SOFT_RESET_ON). L'aperçu ne change rien ; « Appliquer » le fait sur cette partie de test seulement.</span>` + row(`${btn("fxgive", "4 objets forgemagés à l'ancienne")}${btn("fxplan", "Soft reset : aperçu")}${btn("fxapply", "Soft reset : appliquer", "", "danger")}`)) : ""; // 1.0.30 « Forge » (js/forgeui.js)
  const snapBox = box("Parties types", row(`${inp("admSnapN", `placeholder="Nom (ex. équipe niveau 100)" style="width:220px"`)}${btn("snapsave", "Enregistrer la partie")}`)
    + (snaps.length ? snaps.map((x, i) => row(`<span class="grow"><b>${h(x.name)}</b> <span class="xs muted">${h(x.meta || "")}</span></span>${btn("snapload", "Charger", `data-i="${i}"`)}${btn("snapdel", "Supprimer", `data-i="${i}"`, "danger")}`)).join("") : `<span class="xs muted">Aucune partie enregistrée.</span>`)
    + row(`<span class="muted small">Nouvelle équipe :</span><span class="xs muted">niveau</span>${inp("admGenL", `type="number" min="1" max="${E.MAX_LVL}" value="${st.lvl}" style="width:70px"`)}
      <select id="admGenG"><option value="aucun">sans équipement</option><option value="bon" selected>bon équipement</option><option value="optimise">optimisée</option></select>${btn("gen", "Créer")}`)
    + `<span class="xs muted">Reprend les classes de votre équipe actuelle, zones débloquées. Remplace la partie (copie de secours faite).</span>`);
  return `${head}<div class="px-grid">${give}${fight}${heroes}${time}${prog}${news}${forge}${snapBox}</div>`;
}
const paint = () => { if (PN() && DX.ui.tab === "admin") PN().repaint(); };
const open = () => { if (PN()) PN().open("test"); };
/* 0.1.16 : une partie retouchée par le panel n'entre pas dans les classements (le serveur la met « en vérification »). */
const mark = (s) => { if (s && !s.panelUsed) { s.panelUsed = true; if (window.ONLINE && window.ONLINE.user) DX.toast("Partie retouchée par le panel : elle n'apparaîtra plus dans les classements."); } };
const done = (txt) => { mark(S()); DX.markDirty(); DX.saveNow(); if (DX.ui.tab === "admin") paint(); else DX.render(); DX.renderStatus(); if (txt) DX.toast(txt); };
const val = (id) => { const n = document.getElementById(id); return n ? n.value.trim() : ""; };

function replaceGame(N, txt) {
  const s = S(); if (s) { DX.pushCopy(E.serialize(s), "avant", s); N.seenVersion = s.seenVersion; N.settings.theme = s.settings.theme; }
  N.panelUsed = true; DX.S = N; DX.ui.cid = N.chars[0].id; E.events.length = 0; DX.setTheme(); DX.closeSheet(); DX.markDirty(); DX.saveNow();
  if (DX.ui.tab === "admin") paint(); else { DX.ui.tab = "home"; DX.render(); } DX.renderStatus(); DX.toast(txt);
}

/* ---------- actions ---------- */
document.addEventListener("change", (ev) => { const k = ev.target.dataset && ev.target.dataset.admV; if (k) st[k] = k === "k" ? +ev.target.value : ev.target.value; });
document.addEventListener("input", (ev) => { const id = ev.target && ev.target.id; if (id === "admGive") st.give = ev.target.value; else if (id === "admGiveN") st.giveN = Math.max(1, +ev.target.value || 1); else if (id === "admAway") st.away = Math.max(1, +ev.target.value || 1); else if (id === "admCopy") st.copy = ev.target.value; else if (id === "admRad") st.rad = ev.target.checked; });
document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "admRad") st.rad = ev.target.checked; });
document.addEventListener("keydown", (ev) => { if (ev.target && ev.target.id === "admGive" && ev.key === "Enter") { ev.preventDefault(); const b = document.querySelector('[data-adm="give"]'); if (b) b.click(); } });
function act(a, d) {
  const s = S();
  if (a === "open") { if (!s) { DX.toast("Commencez une partie pour utiliser le panel de test."); return; } open(); return; }
  if (!s) return;
  switch (a) {
    case "tog": {
      if (d.id === "hal") { window.HAL_FORCE = !window.HAL_FORCE; DX.setTheme(); paint(); DX.toast(window.HAL_FORCE ? "Thème d'Halouine forcé (cette page seulement)." : "Thème d'Halouine selon la date."); return; }
      const x = PN().toggles.find((y) => y.id === d.id); if (!x) return; try { x.set(!x.on()); } catch (e) { DX.toast(e.message); } paint(); DX.renderStatus(); return; }
    case "hal": window.HAL_FORCE = d.v === "1"; DX.setTheme(); paint(); DX.toast(window.HAL_FORCE ? "Thème d'Halouine forcé (cette page seulement)." : "Thème d'Halouine selon la date."); return;
    case "speed": if (+d.v > 1) mark(s); DX.speed = +d.v; paint(); DX.toast(DX.speed > 1 ? `Temps accéléré ×${DX.speed}.` : "Vitesse normale."); return;
    case "away": { mark(s); const hrs = d.v === "input" ? Math.max(1, Math.min(48, +val("admAway") || st.away)) : +d.v; const r = E.catchUp(s, hrs * 3600); DX.markDirty(); DX.saveNow(); paint();
      if (r && (r.wins || Object.keys(r.res).length)) DX.offlineSheet(r); else DX.toast("Rien à rapporter : personne ne chassait ni ne récoltait."); return; }
    case "fight": {
      st.dg = val("admDg") || st.dg; st.k = +val("admK") || st.k; const dg = DUNGEONS[st.dg];
      if (!E.team(s).length) { DX.toast("Votre équipe est vide."); return; }
      if (s.dungeon) E.leaveDungeon(s);
      if (!E.dungeonUnlocked(s, st.dg)) unlockAll(s);
      const SI = E.stasisInfo(s, st.dg); SI.max = Math.max(SI.max, st.k - 1); E.addRes(s, dg.key, 1);
      const err = E.enterDungeon(s, st.dg, st.k); if (err) { DX.toast(err); return; } mark(s);
      DX.ui.tab = "combat"; DX.closeSheet(); DX.markDirty(); DX.saveNow(); DX.render(); window.scrollTo(0, 0); DX.toast(`${dg.name} · stasis ${st.k}`); return; }
    case "sim": if (d.v === "stop") { if (st.sim) st.sim.run = false; return; } sim100(); return;
    case "who": st.who = d.v; paint(); return;
    case "preset": preset(d.v); return;
    case "give": giveAny(val("admGive"), val("admGiveN"), !!(document.getElementById("admRad") || {}).checked); return;
    case "setlvl": { const L = Math.round(+val("admLvl")); if (!(L >= 1)) return; st.lvl = Math.min(E.MAX_LVL, L); targets(s).forEach((c) => setLevel(s, c, st.lvl)); done(`Niveau ${st.lvl} appliqué.`); return; }
    case "gear": targets(s).forEach((c) => { if (d.v === "aucun") { Object.keys(c.equip).forEach((sl) => E.unequip(s, c.id, sl)); E.refreshSpells(c, E.charStats(s, c)); } else gearUp(s, c, d.v); }); done(d.v === "aucun" ? "Équipement retiré." : "Équipement donné."); return;
    case "kamas": s.kamas += +d.v; done(`+${fmt(+d.v)} kamas.`); return;
    case "pets": Object.keys(E.PETS || {}).forEach((id) => { if (!E.petOwned(s, id)) E.givePet(s, id, "panel de test"); }); E.events.length = 0; done("Tous les familiers et montiliers donnés."); return;
    case "petgrow": Object.values(s.pets || {}).forEach((P) => (P.g = 100)); done("Tous les familiers sont adultes."); return;
    case "mounts": { s.enclos.built = true; for (const sp in E.MOUNTS) for (const c in E.MOUNTS[sp].cols) { if (E.stableN(s) >= E.stableCap(s)) break; const M = E.giveMount(s, sp, c, "panel de test", { quiet: true }); if (M) M.lvl = 100; } E.events.length = 0; done("Montures données (écurie pleine au-delà de 20)."); return; }
    case "nets": E.addCons(s, "filet", 10); done("10 filets de capture."); return;
    case "stones": E.addCons(s, "pierre_ame", 20); E.addCons(s, "parfum_piste", 3); done("20 Pierres d'âme et 3 Parfums de pistage dans le sac."); return;
    case "souls": { E.addCons(s, "pierre_ame", E.ARCHI_TOTAL); Object.keys(E.ARCHIS).forEach((k) => { if (!E.hasSoul(s, k)) E.captureSoul(s, { key: k, name: E.ARCHIS[k].name }, { offline: true }); }); E.events.length = 0; done(`${E.soulCount(s)} âmes dans l'album.`); return; }
    case "dofus": E.DOFUS_ORDER.forEach((id) => { if (!E.dofusOwned(s, id)) E.giveDofus(s, id, "panel de test"); }); E.events.length = 0; done(`Les ${E.DOFUS_ORDER.length} Dofus sont dans le sac.`); return;
    case "idols": E.IDOL_ORDER.forEach((id) => { if (!E.idolOwned(s, id)) E.giveIdol(s, id, "panel de test"); }); E.events.length = 0; done(`Les ${E.IDOL_ORDER.length} idoles sont dans la collection.`); return;
    case "garunes": E.EXO_STATS.forEach((k) => { const key = E.exoKey(k); s.runes[key] = (s.runes[key] || 0) + 5; }); E.addRes(s, E.RARE_COMPONENT, 20); done("5 runes Ga de chaque sorte et 20 Éclats de trouvaille."); return;
    case "fm100": { const J = E.fmJobs(s); for (const j in E.FM_JOBS) { J[j].lvl = E.FM_MAX; J[j].xp = 0; } J.old = 1; done("Les 6 métiers de forgemagie sont niveau 200."); return; }
    case "tarunes": Object.keys(E.TRANS).forEach((k) => { const key = E.transKey(k); s.runes[key] = (s.runes[key] || 0) + 2; }); done("2 runes de transcendance de chaque sorte."); return;
    case "prot": { const c = s.chars.find((x) => x.job); if (!c) { DX.toast("Envoyez d'abord un héros récolter."); return; } s.protector = null; s.protCalm = 0; const r = Math.random; Math.random = () => 0; try { E.protSpawn(s, c, c.job); } finally { Math.random = r; } done(s.protector ? "Un protecteur attend l'équipe." : "Aucun protecteur pour cette ressource."); return; }
    case "births": E.enclosTick(s, 48 * 3600e3); done("Naissances faites."); return;
    case "keys": Object.values(DUNGEONS).forEach((dg) => E.addRes(s, dg.key, 5)); done("5 clés de chaque donjon ajoutées."); return;
    case "res": { const n = val("admRes"), q = Math.max(1, Math.round(+val("admResN") || 1)); if (!RES[n]) { DX.toast("Ressource inconnue : choisissez-la dans la liste."); return; } E.addRes(s, n, q); done(`+${fmt(q)} ${n}.`); return; }
    case "item": { const n = val("admItem"); const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].name === n); if (!tpl) { DX.toast("Objet inconnu : choisissez-le dans la liste."); return; }
      E.rollItem(s, tpl, { radiant: !!(document.getElementById("admRad") || {}).checked || false }); done(`${n} ajouté au sac.`); return; }
    case "unlock": unlockAll(s); done("Toutes les zones sont débloquées."); return;
    case "bribes": E.sgGive(s, +d.v); done(`+${fmt(+d.v)} Bribes de rêve.`); return;
    case "sgunl": E.songe(s).unl = E.SG_INT.length - 1; done("Toutes les intensités du Songe sont débloquées."); return;
    case "legone": { const x = E.LEG_LIST[Math.floor(Math.random() * E.LEG_LIST.length)]; E.giveLeg(s, x.k, "panel de test"); done(`${x.name} ajouté au sac.`); return; }
    case "legall": E.LEG_LIST.forEach((x) => E.giveLeg(s, x.k, "panel de test")); done(`Les ${E.LEG_LIST.length} légendaires sont dans le sac.`); return;
    case "expend": { if (!E.expActive(s)) { DX.toast("Aucun songe en cours."); return; } E.expQuit(s); done("L'équipe se réveille."); return; }
    case "fxgive": { const n = window.FORGEUI.softGive(); done(`${n} objets forgemagés à l'ancienne dans le sac.`); return; } // 1.0.30 « Forge » (js/forgeui.js)
    case "fxplan": window.FORGEUI.softTry(); return;
    case "fxapply": mark(s); window.FORGEUI.softTry("apply"); DX.saveNow(); return;
    case "stasis": Object.keys(DUNGEONS).forEach((did) => { const SI = E.stasisInfo(s, did); SI.max = Math.max(SI.max, E.STASIS_MAX); }); unlockAll(s); done(`Stasis ${E.STASIS_MAX} débloquée partout.`); return;
    case "snapsave": { const name = (val("admSnapN") || `Partie du ${new Date().toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`).slice(0, 40);
      const a = readSnaps().filter((x) => x.name !== name); if (a.length >= SNAP_MAX) { DX.toast(`${SNAP_MAX} parties au maximum : supprimez-en une.`); return; }
      if (writeSnaps([{ name, t: Date.now(), meta: snapMeta(s), txt: E.serialize(s) }, ...a])) { paint(); DX.toast(`Partie « ${name} » enregistrée.`); } return; }
    case "snapload": { const x = readSnaps()[+d.i]; if (!x) return; let N; try { N = E.deserialize(x.txt); } catch (e) { DX.toast("Cette partie est illisible."); return; } replaceGame(N, `Partie « ${x.name} » chargée.`); return; }
    case "snapdel": { const a = readSnaps(); a.splice(+d.i, 1); writeSnaps(a); paint(); return; }
    case "gen": {
      const L = Math.min(E.MAX_LVL, Math.max(1, Math.round(+val("admGenL") || 1))); const prof = val("admGenG") || "bon"; st.lvl = L;
      const cls = (E.team(s).length ? E.team(s) : s.chars).map((c) => [c.cls, c.name, c.sex]);
      replaceGame(makeTeam(cls, L, prof), `Nouvelle équipe niveau ${L} créée.`); return; }
  }
}
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-adm]"); if (!t) return;
  if (!DX.testerOk || !DX.testerOk()) { DX.closeSheet(); return; }
  act(t.dataset.adm, t.dataset);
});

/* ---------- branchement au Panel Xener ---------- */
const P = PN();
if (P) {
  P.setTest({ html: testHtml, give: (n, q) => giveAny(n, q), preset: (k) => preset(k),
    load: (txt, who) => { let N; try { N = E.deserialize(txt); } catch (e) { DX.toast("Sa partie est illisible."); return; } replaceGame(N, `Partie de ${who || "ce joueur"} copiée dans ta partie de test.`); } });
  const run = (a, d) => () => { if (!DX.testerOk()) return; act(a, d || {}); };
  [["Donner tous les Dofus", "dofus", "donner dofus tous"], ["Donner toutes les idoles", "idols", "donner idoles"], ["Donner tous les familiers", "pets", "donner familiers montiliers"],
    ["Donner 10 M kamas", "kamas", "donner kamas argent", { v: "10000000" }], ["5 clés de chaque donjon", "keys", "donner cles donjon"], ["Toutes les âmes", "souls", "donner ames archimonstres"],
    [`Stasis ${E.STASIS_MAX} dans tous les donjons`, "stasis", "stasis 10 donjons debloquer"], ["Débloquer toutes les zones", "unlock", "zones debloquer carte"],
    ["Tous les légendaires", "legall", "donner legendaires songe"], ["+10 000 Bribes de rêve", "bribes", "donner bribes songe", { v: "10000" }], ["Toutes les intensités du Songe", "sgunl", "songe intensites"],
    ["Forgemagie niveau 200", "fm100", "metiers forgemagie fm"], ["Runes Ga ×5", "garunes", "donner runes ga exo"], ["Bon équipement pour l'équipe", "gear", "equiper equipement bon", { v: "bon" }],
    ["Équipement optimisé pour l'équipe", "gear", "equiper equipement optimise parfait", { v: "optimise" }], ["Absence de 8 h", "away", "temps absence hors ligne", { v: "8" }],
    ["Temps ×10", "speed", "temps vitesse accelerer", { v: "10" }], ["Vitesse normale", "speed", "temps vitesse normale", { v: "1" }], ["Simuler 100 combats", "sim", "simulation combats donjon stasis"]]
    .forEach(([n, a, k, d]) => P.register({ cmd: { n, k, test: true, run: run(a, d) } }));
  (P.P.PRESETS || []).forEach(([k, n, d]) => P.register({ cmd: { n: `Partie de test : ${n}`, k: `depart rapide ${d}`, test: true, run: () => preset(k) } }));
  if (P.TESTMODE || /\/beta\//.test(location.pathname)) setTimeout(applyTodo, 400);
}
})();
