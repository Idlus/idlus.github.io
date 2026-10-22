/* ============================================================================
   LE PORTAIL INSTABLE — Idlus 2.1.38 (pool du 21/10, choix 3A 4A de Mathis)
   Chaque jour, une sous-zone niveau 200 des Dimensions divines ou des Dimensions des Cavaliers s'ouvre en version
   instable, la même pour tout le monde (tirée d'après la date). Ouvert de minuit à minuit, 30 victoires par compte :
   monstres +40 % de vie et de dégâts, butin ×2, 2 Fragments instables par victoire. Les Fragments s'échangent contre
   des cosmétiques (ornement, teinture, monture chromatique, titre). Pas d'HdV : liés au compte.
   S.portal = { d: jour, n: victoires du jour, on: entré aujourd'hui, fr: Fragments, tot: Fragments gagnés, own: {} }.
   Pas de DOM ici : l'affichage est dans js/portailui.js. Chargé aussi par les tests et le simulateur.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const SUBS = E.SUBS;

  E.PORTAL = { n: 30, hp: 1.4, dmg: 1.4, drop: 2, fr: 2, lvl: 200 };
  E.PORTAL_POOL = Object.keys(SUBS).filter((sid) => ["divines", "cavaliers"].includes(SUBS[sid].zone) && SUBS[sid].lvl[0] >= E.PORTAL.lvl).sort();
  const hashStr = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return x >>> 0; };
  /* la dimension du jour : jamais la même deux jours de suite */
  E.portalToday = (t = E.now()) => {
    const P = E.PORTAL_POOL; const day = E.dayKey(t); if (!P.length) return { day, sid: null };
    let i = hashStr("portail" + day) % P.length; const y = hashStr("portail" + E.dayKey(t - 864e5)) % P.length;
    if (i === y) i = (i + 1) % P.length;
    return { day, sid: P[i] };
  };
  E.portalSt = (S) => {
    const P = S.portal = S.portal || { d: null, n: 0, on: false, fr: 0, tot: 0, own: {} };
    const day = E.dayKey(); if (P.d !== day) { P.d = day; P.n = 0; P.on = false; }
    return P;
  };
  E.portalLeft = (S) => Math.max(0, E.PORTAL.n - E.portalSt(S).n);
  E.portalErr = (S) => {
    const T = E.portalToday(); if (!T.sid) return "Aucun portail aujourd'hui.";
    const top = Math.max(0, ...E.team(S).map((c) => c.lvl)); if (top < E.PORTAL.lvl) return `Le portail s'ouvre aux équipes niveau ${E.PORTAL.lvl}.`;
    if (!E.subUnlocked(S, T.sid)) return `Débloque d'abord ${SUBS[T.sid].name}.`;
    if (!E.portalLeft(S)) return "Plus de passage aujourd'hui : le portail revient à minuit.";
    return null;
  };
  /* visible dès qu'une équipe niveau 200 existe (même si la sous-zone n'est pas encore débloquée) */
  E.portalShown = (S) => !S.mono && Math.max(0, ...S.chars.map((c) => c.lvl)) >= E.PORTAL.lvl && !!E.portalToday().sid;
  E.portalEnter = (S) => {
    if (S.mono) return "Le portail instable n'est pas ouvert en Monocompte.";
    const err = E.portalErr(S); if (err) return err;
    const T = E.portalToday(); const P = E.portalSt(S);
    if (!(S.hunting && S.sub === T.sid && !S.dungeon)) { const r = E.startHunt(S, T.sid); if (r) return r; }
    P.on = true; E.note(S, `Portail instable : ${SUBS[T.sid].name}, encore ${E.portalLeft(S)} victoires aujourd'hui.`, "rare");
    return null;
  };
  E.portalActive = (S) => {
    if (S.mono || S.dungeon || !S.hunting || (E.expActive && E.expActive(S))) return false;
    const P = E.portalSt(S); return !!P.on && S.sub === E.portalToday().sid && P.n < E.PORTAL.n;
  };
  /* un combat de chasse dans la dimension du jour, une fois entré : monstres renforcés, butin ×2 (endFight lit F.portalDrop) */
  const sf0 = E.startFight;
  E.startFight = (S) => {
    const F = sf0(S);
    if (F && !F.exp && !F.dungeon && !F.prot && E.portalActive(S)) {
      F.portal = 1; F.portalDrop = E.PORTAL.drop; F.label = `Portail instable · ${F.label}`;
      F.ents.forEach((e) => { if (e.side !== "m") return; e.hpMax = e.hp = Math.round(e.hpMax * E.PORTAL.hp); e.dmg *= E.PORTAL.dmg; });
    }
    return F;
  };
  const emit0 = E.emit;
  E.emit = (S, type, data) => {
    const r = emit0(S, type, data);
    if (type === "win" && S && S.fight && S.fight.portal && !S.fight.portalDone) {
      const F = S.fight; F.portalDone = 1; const P = E.portalSt(S); P.n++; P.fr += E.PORTAL.fr; P.tot += E.PORTAL.fr;
      if (F.rewards) F.rewards.portal = { fr: E.PORTAL.fr, left: E.PORTAL.n - P.n };
      if (P.n >= E.PORTAL.n) { P.on = false; E.note(S, `Portail instable refermé pour aujourd'hui : ${E.PORTAL.n} victoires, ${E.PORTAL.n * E.PORTAL.fr} Fragments instables. La chasse continue normalement.`, "rare"); }
    }
    return r;
  };

  /* ---------- l'échoppe des Fragments instables ---------- */
  E.PORTAL_TEINT = { id: "instable", name: "Faille instable", c: [0x1b1030, 0x8a3ffc, 0x2fd3c7, 0xf2c75c] };
  const LK = root.LOOKS;
  if (LK && Array.isArray(LK.PALETTES) && !LK.PALETTES.some((p) => p.id === "t_instable")) LK.PALETTES.push({ id: "t_instable", name: E.PORTAL_TEINT.name, c: E.PORTAL_TEINT.c, lock: "teint_instable" });
  E.PORTAL_TITLE = "Arpenteur de failles"; E.PORTAL_TITLE2 = "Maître des failles";
  /* Mathis 22/10 : plus d'articles et plus chers (60 Fragments par jour au plus : tout l'unique ≈ 165 jours de portail) */
  E.PORTAL_SHOP = {
    orn:    { name: "Ornement « Faille instable »", cost: 400, once: true, txt: "Un ornement de carte de héros" },
    teint:  { name: "Teinture « Faille instable »", cost: 600, once: true, txt: "Une palette violet et turquoise pour tes héros (Héros › Apparence)" },
    cadre:  { name: "Cadre de la Faille", cost: 900, once: true, txt: "Un cadre de portrait pour tes héros (Héros › Apparence)" },
    mont:   { name: "Monture chromatique", cost: 1200, txt: "Une monture aux couleurs inversées et au halo doré, espèce et couleur au hasard" },
    titre:  { name: `Titre « ${E.PORTAL_TITLE} »`, cost: 2000, once: true, txt: "Un titre de compte" },
    titre2: { name: `Titre « ${E.PORTAL_TITLE2} »`, cost: 6000, once: true, txt: "Le titre des plus fidèles du portail" },
  };
  E.PORTAL_ORDER = ["orn", "teint", "cadre", "mont", "titre", "titre2"];
  if (E.ORN && !E.ORN.faille) E.ORN.faille = { name: () => "Faille instable", req: "Échoppe des Fragments instables (portail instable)", ok: (S) => !!(S.unlocks && S.unlocks.failleOrn) };
  if (E.SFRAMES && !E.SFRAMES.faille) E.SFRAMES.faille = { name: () => "Cadre de la Faille", req: "Échoppe des Fragments instables (portail instable)", ok: (S) => !!(S.unlocks && S.unlocks.frFaille) };
  const UNL = { orn: "failleOrn", teint: "teint_instable", cadre: "frFaille" };
  const TIT = { titre: E.PORTAL_TITLE, titre2: E.PORTAL_TITLE2 };
  E.portalOwned = (S, id) => (UNL[id] ? !!(S.unlocks && S.unlocks[UNL[id]]) : TIT[id] ? (S.titlesExtra || []).includes(TIT[id]) : false);
  E.portalBuy = (S, id) => {
    const it = E.PORTAL_SHOP[id]; if (!it) return "Article inconnu."; const P = E.portalSt(S);
    if (it.once && E.portalOwned(S, id)) return "Déjà obtenu.";
    if (P.fr < it.cost) return `Il faut ${it.cost} Fragments instables.`;
    if (id === "mont") {
      const M = E.MOUNTS; if (!M || !E.giveMount) return "Montures indisponibles.";
      const sps = Object.keys(M).filter((sp) => !E.stableFull || !E.stableFull(S, sp)); if (!sps.length) return "Tes écuries sont pleines : fais de la place d'abord.";
      const sp = sps[Math.floor(E.rnd() * sps.length)]; const cols = Object.keys(M[sp].cols); const c = cols[Math.floor(E.rnd() * cols.length)];
      if (!E.giveMount(S, sp, c, "Fragments instables", { chr: 1 })) return "Monture impossible à donner.";
    }
    else if (UNL[id]) (S.unlocks = S.unlocks || {})[UNL[id]] = 1;
    else if (TIT[id]) (S.titlesExtra = S.titlesExtra || []).push(TIT[id]);
    P.fr -= it.cost; P.own[id] = (P.own[id] || 0) + 1;
    if (id !== "mont") E.note(S, `Fragments instables : ${it.name} obtenu.`, "up");
    return null;
  };
  Object.assign(E.ACTIONS, { portalEnter: "entrer dans le portail instable", portalBuy: "acheter avec des Fragments instables" });

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
