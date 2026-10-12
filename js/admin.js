/* ============================================================================
   PANEL DE TEST — Idlus, version de test (/beta/) uniquement.
   Sur le jeu public, ce fichier ne fait rien : le panel n'y existe pas.
   Rien n'est secret sur un site sans serveur : n'importe qui sur la béta peut l'ouvrir,
   mais il ne touche que la partie de test de ce navigateur.
   ========================================================================== */
(function () {
"use strict";
if (!/\/beta\//.test(location.pathname) || !window.DX || !window.DX.openSheet) return;
const DX = window.DX, E = DX.E, D = window.DATA;
const { CLASSES, ZONES, DUNGEONS, ITEMS, RES } = D;
const h = DX.h, fmt = DX.fmt;
const SNAP_KEY = DX.LS_KEY + "-tests", SNAP_MAX = 8;
const st = { dg: null, k: 1, lvl: 100, gear: "bon", who: "team" };
const S = () => DX.S;

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

/* ---------- rendu ---------- */
const btn = (act, label, extra = "", cls = "") => `<button class="btn sm ${cls}" data-adm="${act}" ${extra}>${label}</button>`;
const sec = (title, hint, body) => `<div class="stack" style="gap:6px"><h3 class="sec">${title}</h3>${hint ? `<span class="xs muted">${hint}</span>` : ""}${body}</div>`;
const row = (body) => `<div class="row" style="flex-wrap:wrap;gap:6px;align-items:center">${body}</div>`;
const inp = (id, attrs) => `<input id="${id}" ${attrs} style="max-width:100%">`;

function panelHtml() {
  const s = S(); const dgs = Object.keys(DUNGEONS).sort((a, b) => DUNGEONS[a].lvl - DUNGEONS[b].lvl || DUNGEONS[a].name.localeCompare(DUNGEONS[b].name));
  if (!st.dg || !DUNGEONS[st.dg]) st.dg = dgs[0];
  const snaps = readSnaps();
  return `<h2>${DX.G("bug")} Panel de test</h2>
  <p class="xs muted">Version de test uniquement. Ces outils modifient la partie de test de ce navigateur, jamais le jeu public. Une copie de secours est faite avant chaque remplacement de partie.</p>
  <div class="stack small">
  ${sec("Temps", "Accélère tout le jeu (combats, récolte, atelier) tant que cette page reste ouverte.", row(`<span class="seg">${[1, 10, 100].map((v) => `<button data-adm="speed" data-v="${v}" aria-pressed="${DX.speed === v}">×${v}</button>`).join("")}</span>`)
    + row(`<span class="muted">Simuler une absence :</span>${[1, 4, 8].map((n) => btn("away", `${n} h`, `data-v="${n}"`)).join("")}<span class="xs muted">(plafond du jeu : ${Math.round(E.OFFLINE_MAX_S / 3600 + E.bonus(s, "offtime"))} h)</span>`))}
  ${sec("Combat", "Entre dans le donjon choisi à la stasis choisie, avec une clé offerte et la stasis débloquée. Le détail du combat s'affiche dans l'onglet Combat.",
    row(`<select id="admDg" data-adm-v="dg">${dgs.map((d) => `<option value="${d}" ${d === st.dg ? "selected" : ""}>Niv. ${DUNGEONS[d].lvl} · ${h(DUNGEONS[d].name)}</option>`).join("")}</select>
      <select id="admK" data-adm-v="k">${Array.from({ length: E.STASIS_MAX }, (_, i) => i + 1).map((k) => `<option value="${k}" ${k === st.k ? "selected" : ""}>Stasis ${k}</option>`).join("")}</select>
      ${btn("fight", "Lancer", "", "primary")}`))}
  ${sec("Héros", "", row(`<span class="seg">${[["team", "Équipe"], ["all", "Tous les héros"]].map(([v, n]) => `<button data-adm="who" data-v="${v}" aria-pressed="${st.who === v}">${n}</button>`).join("")}</span>`)
    + row(`<span class="muted">Niveau</span>${inp("admLvl", `type="number" min="1" max="${E.MAX_LVL}" value="${st.lvl}" style="width:80px"`)}${btn("setlvl", "Appliquer")}`)
    + row(`<span class="muted">Équiper</span>${btn("gear", "Bon équipement", `data-v="bon"`)}${btn("gear", "Équipement optimisé", `data-v="optimise"`)}${btn("gear", "Tout retirer", `data-v="aucun"`)}`)
    + `<span class="xs muted">Bon : meilleurs objets du niveau, jets moyens. Optimisé : jets parfaits, Dofus et parchemins à 100 (comme le simulateur).</span>`)}
  ${sec("Donner", "", row(`<span class="coin"></span>${btn("kamas", "+100 000", `data-v="100000"`)}${btn("kamas", "+10 000 000", `data-v="10000000"`)}${btn("keys", "5 clés de chaque donjon")}${btn("pets", "Tous les familiers et montiliers")}${btn("petgrow", "Familiers adultes")}${btn("mounts", "Toutes les montures (niv. 100)")}${btn("nets", "10 filets de capture")}${btn("idols", "Les 36 idoles")}${btn("stones", "20 Pierres d'âme + 3 Parfums")}${btn("souls", "Toutes les âmes")}${btn("dofus", "Les 18 Dofus")}${btn("garunes", "Runes Ga ×5 + 20 Éclats")}${btn("fm100", "Forgemage niveau 100")}${btn("births", "Naissances maintenant")}${btn("prot", "Faire apparaître un protecteur")}`)
    + row(`${inp("admRes", `list="admResL" placeholder="Ressource" style="width:200px"`)}${inp("admResN", `type="number" min="1" value="100" style="width:80px"`)}${btn("res", "Donner")}`)
    + row(`${inp("admItem", `list="admItemL" placeholder="Objet" style="width:200px"`)}<label class="xs"><input type="checkbox" id="admRad"> Rayonnant</label>${btn("item", "Donner")}`)
    + `<datalist id="admResL">${Object.keys(RES).sort().map((n) => `<option value="${h(n)}">`).join("")}</datalist><datalist id="admItemL">${Object.keys(ITEMS).sort((a, b) => ITEMS[a].lvl - ITEMS[b].lvl).map((t) => `<option value="${h(ITEMS[t].name)}">niv. ${ITEMS[t].lvl}</option>`).join("")}</datalist>`)}
  ${sec("Progression", "", row(`${btn("unlock", "Débloquer toutes les zones")}${btn("stasis", "Stasis 10 dans tous les donjons")}`))}
  ${sec("Parties types", "Enregistrez la partie actuelle pour y revenir, ou créez une équipe toute prête.",
    row(`${inp("admSnapN", `placeholder="Nom (ex. équipe niveau 100)" style="width:220px"`)}${btn("snapsave", "Enregistrer la partie")}`)
    + (snaps.length ? snaps.map((x, i) => row(`<span class="grow"><b>${h(x.name)}</b> <span class="xs muted">${h(x.meta || "")}</span></span>${btn("snapload", "Charger", `data-i="${i}"`)}${btn("snapdel", "Supprimer", `data-i="${i}"`, "danger")}`)).join("") : `<span class="xs muted">Aucune partie enregistrée.</span>`)
    + row(`<span class="muted">Nouvelle équipe :</span><span class="xs muted">niveau</span>${inp("admGenL", `type="number" min="1" max="${E.MAX_LVL}" value="${st.lvl}" style="width:70px"`)}
      <select id="admGenG"><option value="aucun">sans équipement</option><option value="bon" selected>bon équipement</option><option value="optimise">optimisée</option></select>${btn("gen", "Créer")}`)
    + `<span class="xs muted">Reprend les classes de votre équipe actuelle (${E.team(s).map((c) => h(CLASSES[c.cls].name)).join(", ") || "aucune"}), zones débloquées. Remplace la partie (copie de secours faite).</span>`)}
  </div><div><button class="btn" data-act="closesheet">Fermer</button></div>`;
}
const open = () => DX.openSheet(panelHtml());
const done = (txt) => { DX.markDirty(); DX.saveNow(); DX.render(); open(); if (txt) DX.toast(txt); };
const val = (id) => { const n = document.getElementById(id); return n ? n.value.trim() : ""; };

function replaceGame(N, txt) {
  const s = S(); if (s) { DX.pushCopy(E.serialize(s), "avant", s); N.seenVersion = s.seenVersion; N.settings.theme = s.settings.theme; }
  DX.S = N; DX.ui.cid = N.chars[0].id; DX.ui.tab = "home"; DX.setTheme(); DX.closeSheet(); DX.markDirty(); DX.saveNow(); DX.render(); DX.renderStatus(); DX.toast(txt);
}

/* ---------- actions ---------- */
document.addEventListener("change", (ev) => { const k = ev.target.dataset && ev.target.dataset.admV; if (k) st[k] = k === "k" ? +ev.target.value : ev.target.value; });
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-adm]"); if (!t) return;
  const s = S(); const d = t.dataset;
  if (d.adm === "open") { if (!s) { DX.toast("Commencez une partie pour utiliser le panel de test."); return; } open(); return; }
  if (!s) return;
  switch (d.adm) {
    case "speed": DX.speed = +d.v; open(); DX.toast(DX.speed > 1 ? `Temps accéléré ×${DX.speed}.` : "Vitesse normale."); return;
    case "away": { DX.closeSheet(); const r = E.catchUp(s, +d.v * 3600); DX.markDirty(); DX.saveNow(); DX.render();
      if (r && (r.wins || Object.keys(r.res).length)) DX.offlineSheet(r); else DX.toast("Rien à rapporter : personne ne chassait ni ne récoltait."); return; }
    case "fight": {
      st.dg = val("admDg") || st.dg; st.k = +val("admK") || st.k; const dg = DUNGEONS[st.dg];
      if (!E.team(s).length) { DX.toast("Votre équipe est vide."); return; }
      if (s.dungeon) E.leaveDungeon(s);
      if (!E.dungeonUnlocked(s, st.dg)) unlockAll(s);
      const SI = E.stasisInfo(s, st.dg); SI.max = Math.max(SI.max, st.k - 1); E.addRes(s, dg.key, 1);
      const err = E.enterDungeon(s, st.dg, st.k); if (err) { DX.toast(err); return; }
      DX.ui.tab = "combat"; DX.closeSheet(); DX.markDirty(); DX.saveNow(); DX.render(); window.scrollTo(0, 0); DX.toast(`${dg.name} · stasis ${st.k}`); return; }
    case "who": st.who = d.v; open(); return;
    case "setlvl": { const L = Math.round(+val("admLvl")); if (!(L >= 1)) return; st.lvl = Math.min(E.MAX_LVL, L); targets(s).forEach((c) => setLevel(s, c, st.lvl)); done(`Niveau ${st.lvl} appliqué.`); return; }
    case "gear": targets(s).forEach((c) => { if (d.v === "aucun") { Object.keys(c.equip).forEach((sl) => E.unequip(s, c.id, sl)); E.refreshSpells(c, E.charStats(s, c)); } else gearUp(s, c, d.v); }); done(d.v === "aucun" ? "Équipement retiré." : "Équipement donné."); return;
    case "kamas": s.kamas += +d.v; done(`+${fmt(+d.v)} kamas.`); return;
    case "pets": Object.keys(E.PETS || {}).forEach((id) => { if (!E.petOwned(s, id)) E.givePet(s, id, "panel de test"); }); E.events.length = 0; done("Tous les familiers et montiliers donnés."); return;
    case "petgrow": Object.values(s.pets || {}).forEach((P) => (P.g = 100)); done("Tous les familiers sont adultes."); return;
    case "mounts": { s.enclos.built = true; for (const sp in E.MOUNTS) for (const c in E.MOUNTS[sp].cols) { if (E.stableN(s) >= E.stableCap(s)) break; const M = E.giveMount(s, sp, c, "panel de test", { quiet: true }); if (M) M.lvl = 100; } E.events.length = 0; done("Montures données (écurie pleine au-delà de 20)."); return; }
    case "nets": E.addCons(s, "filet", 10); done("10 filets de capture."); return;
    case "stones": E.addCons(s, "pierre_ame", 20); E.addCons(s, "parfum_piste", 3); done("20 Pierres d'âme et 3 Parfums de pistage dans le sac."); return;
    case "souls": { E.addCons(s, "pierre_ame", E.ARCHI_TOTAL); Object.keys(E.ARCHIS).forEach((k) => { if (!E.hasSoul(s, k)) E.captureSoul(s, { key: k, name: E.ARCHIS[k].name }, { offline: true }); }); E.events.length = 0; done(`${E.soulCount(s)} âmes dans l'album.`); return; }
    case "dofus": E.DOFUS_ORDER.forEach((id) => { if (!E.dofusOwned(s, id)) E.giveDofus(s, id, "panel de test"); }); E.events.length = 0; done("Les 18 Dofus sont dans le sac."); return;
    case "idols": E.IDOL_ORDER.forEach((id) => { if (!E.idolOwned(s, id)) E.giveIdol(s, id, "panel de test"); }); E.events.length = 0; done("Les 36 idoles sont dans la collection."); return;
    case "garunes": E.EXO_STATS.forEach((k) => { const key = E.exoKey(k); s.runes[key] = (s.runes[key] || 0) + 5; }); E.addRes(s, E.RARE_COMPONENT, 20); done("5 runes Ga de chaque sorte et 20 Éclats de trouvaille."); return;
    case "fm100": { const J = E.fmJob(s); J.lvl = E.FM_MAX; J.xp = 0; done("Forgemage niveau 100."); return; }
    case "prot": { const c = s.chars.find((x) => x.job); if (!c) { DX.toast("Envoyez d'abord un héros récolter."); return; } s.protector = null; s.protCalm = 0; const r = Math.random; Math.random = () => 0; try { E.protSpawn(s, c, c.job); } finally { Math.random = r; } done(s.protector ? "Un protecteur attend l'équipe." : "Aucun protecteur pour cette ressource."); return; }
    case "births": E.enclosTick(s, 48 * 3600e3); done("Naissances faites."); return;
    case "keys": Object.values(DUNGEONS).forEach((dg) => E.addRes(s, dg.key, 5)); done("5 clés de chaque donjon ajoutées."); return;
    case "res": { const n = val("admRes"), q = Math.max(1, Math.round(+val("admResN") || 1)); if (!RES[n]) { DX.toast("Ressource inconnue : choisissez-la dans la liste."); return; } E.addRes(s, n, q); done(`+${fmt(q)} ${n}.`); return; }
    case "item": { const n = val("admItem"); const tpl = Object.keys(ITEMS).find((k) => ITEMS[k].name === n); if (!tpl) { DX.toast("Objet inconnu : choisissez-le dans la liste."); return; }
      E.rollItem(s, tpl, { radiant: !!(document.getElementById("admRad") || {}).checked || false }); done(`${n} ajouté au sac.`); return; }
    case "unlock": unlockAll(s); done("Toutes les zones sont débloquées."); return;
    case "stasis": Object.keys(DUNGEONS).forEach((did) => { const SI = E.stasisInfo(s, did); SI.max = Math.max(SI.max, E.STASIS_MAX); }); unlockAll(s); done("Stasis 10 débloquée partout."); return;
    case "snapsave": { const name = (val("admSnapN") || `Partie du ${new Date().toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`).slice(0, 40);
      const a = readSnaps().filter((x) => x.name !== name); if (a.length >= SNAP_MAX) { DX.toast(`${SNAP_MAX} parties au maximum : supprimez-en une.`); return; }
      if (writeSnaps([{ name, t: Date.now(), meta: snapMeta(s), txt: E.serialize(s) }, ...a])) { open(); DX.toast(`Partie « ${name} » enregistrée.`); } return; }
    case "snapload": { const x = readSnaps()[+d.i]; if (!x) return; let N; try { N = E.deserialize(x.txt); } catch (e) { DX.toast("Cette partie est illisible."); return; } replaceGame(N, `Partie « ${x.name} » chargée.`); return; }
    case "snapdel": { const a = readSnaps(); a.splice(+d.i, 1); writeSnaps(a); open(); return; }
    case "gen": {
      const L = Math.min(E.MAX_LVL, Math.max(1, Math.round(+val("admGenL") || 1))); const prof = val("admGenG") || "bon"; st.lvl = L;
      const cls = (E.team(s).length ? E.team(s) : s.chars).map((c) => [c.cls, c.name, c.sex]);
      const N = E.newState(cls[0][1], cls[0][0]); N.chars = [];
      cls.forEach(([k, n, sx]) => { const c = E.addChar(N, k, n, L, sx); c.inTeam = true; });
      N.chars.forEach((c) => gearUp(N, c, prof)); unlockAll(N); N.kamas = Math.max(N.kamas, L * 2000);
      replaceGame(N, `Nouvelle équipe niveau ${L} créée.`); return; }
  }
});
})();
