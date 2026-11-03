/* ============================================================================
   Saison 1, lot 3 : la Garde-robe (partie moteur, sans DOM). Décisions de Mathis (maquette « Refonte des cosmétiques »,
   réponses du 02/11 : 1A 2A 3A 4A 5A 6A 7B 8A 9A 10A 11A 12A 13A) :
     1A une page Garde-robe (Héros) ; 2A une rareté par cosmétique (Commun, Rare, Épique, Légendaire, Saison) ;
     3A les ornements y sont ; 4A des auras au sol ; 5A des titres colorés par rareté ; 6A un effet de victoire ;
     7B pas de tenues enregistrées ; 8A la vitrine de saison (lot 4) ; 9A les exclusifs de l'Éternel suivent le compte
     dans la partie de saison ; 10A des boucliers d'apparat (js/boucliers.js) ; 11A un compagnon qui suit le héros ;
     12A un décor derrière le héros ; 13A une couleur de pseudo.
   + cosmétique réservé aux 10 meilleurs votants du mois (Mathis, 03/11) : l'aura et la couleur « Voix d'Idlus », liées au
     titre « Voix d'Idlus » que le serveur donne déjà aux 10 premiers votants du mois précédent (supabase/vote.sql).
   Rien ne touche aux caractéristiques ni aux combats : ces choix ne vivent que dans la sauvegarde (c.aura, c.vic, c.shield,
   c.comp, c.bg et S.pcol pour le pseudo).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const RAR = (E.GR_RAR = { c: "Commun", r: "Rare", e: "Épique", l: "Légendaire", s: "Saison" });
  const VOIX = "Voix d'Idlus";
  const pts = (S) => (E.achPoints ? E.achPoints(S) : 0);
  const nAch = (S) => (E.achCount ? E.achCount(S) : 0);
  const wins = (S) => (S.stats && S.stats.wins) || 0;
  const stMax = (S) => Math.max(0, ...Object.values(S.stasis || {}).map((x) => (x && x.max) || 0));
  const side = (S, s) => !!(S.align && S.align.side === s);
  const rank = (S) => (E.alignRankIdx ? E.alignRankIdx(S) : 0);
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));
  const excl = (S) => (s1(S) && S.s1c && S.s1c.xcos) || null; // 9A : exclusifs de l'Éternel, relus à chaque lancement
  const hasTitle = (S, t) => (S.titlesExtra || []).includes(t) || !!(excl(S) && excl(S).titles.includes(t));

  /* ---------------- auras au sol (4A) : de la lumière, rien de dessiné ---------------- */
  E.GR_AURAS = {
    braise: { n: "Braise", rar: "c", req: "Gagner 100 combats", ok: (S) => wins(S) >= 100 },
    sylve: { n: "Sylve", rar: "r", req: "Obtenir 50 succès", ok: (S) => nAch(S) >= 50 },
    givre: { n: "Givre", rar: "r", req: "Terminer un donjon en stasis 5", ok: (S) => stMax(S) >= 5 },
    bonta: { n: "Lumière de Bonta", rar: "e", req: "Rang 10 d'alignement à Bonta", ok: (S) => side(S, "bonta") && rank(S) >= 10 },
    brakmar: { n: "Ombre de Brâkmar", rar: "e", req: "Rang 10 d'alignement à Brâkmar", ok: (S) => side(S, "brakmar") && rank(S) >= 10 },
    eclat: { n: "Éclat stellaire", rar: "e", req: "Obtenir 150 succès", ok: (S) => nAch(S) >= 150 },
    dore: { n: "Halo doré", rar: "l", req: "Atteindre 3 500 points de succès", ok: (S) => pts(S) >= 3500 },
    sablier: { n: "Sablier du Temps", rar: "s", req: "Saison 1 : choisir 10 bénédictions", ok: (S) => s1(S) && E.s1cBoonGot(S).length >= 10 },
    fissure: { n: "Fissure du Temps", rar: "s", req: "Saison 1 : gagner 400 Fragments du Temps", ok: (S) => s1(S) && E.s1cFragAct(S) >= 400 },
    voix: { n: "Voix d'Idlus", rar: "l", req: "Être dans les 10 meilleurs votants du mois (titre « Voix d'Idlus »)", ok: (S) => hasTitle(S, VOIX) },
  };
  /* ---------------- effets de victoire (6A) ---------------- */
  E.GR_VIC = {
    confettis: { n: "Confettis", rar: "c", req: "Offert", ok: () => true },
    etincelles: { n: "Étincelles", rar: "r", req: "Gagner 500 combats", ok: (S) => wins(S) >= 500 },
    givre: { n: "Givre", rar: "r", req: "Terminer un donjon en stasis 5", ok: (S) => stMax(S) >= 5 },
    eclairs: { n: "Éclairs", rar: "e", req: "Obtenir 100 succès", ok: (S) => nAch(S) >= 100 },
    flammes: { n: "Flammes", rar: "e", req: "Terminer un donjon en stasis 10", ok: (S) => stMax(S) >= 10 },
    etoiles: { n: "Pluie d'étoiles", rar: "l", req: "Atteindre 3 500 points de succès", ok: (S) => pts(S) >= 3500 },
    sablier: { n: "Sable du Temps", rar: "s", req: "Saison 1 : atteindre la manche 2", ok: (S) => s1(S) && E.s1cManche(S) >= 2 },
  };
  /* ---------------- couleur du pseudo (13A), pour tout le compte ---------------- */
  E.GR_PCOL = {
    braise: { n: "Braise", rar: "r", req: "Gagner 1 000 combats", ok: (S) => wins(S) >= 1000 },
    sylve: { n: "Sylve", rar: "r", req: "Obtenir 100 succès", ok: (S) => nAch(S) >= 100 },
    givre: { n: "Givre", rar: "e", req: "Terminer un donjon en stasis 10", ok: (S) => stMax(S) >= 10 },
    or: { n: "Or", rar: "l", req: "Atteindre 5 000 points de succès", ok: (S) => pts(S) >= 5000 },
    temps: { n: "Temps", rar: "s", req: "Saison 1 : gagner 800 Fragments du Temps", ok: (S) => s1(S) && E.s1cFragAct(S) >= 800 },
    voix: { n: "Voix d'Idlus", rar: "l", req: "Être dans les 10 meilleurs votants du mois (titre « Voix d'Idlus »)", ok: (S) => hasTitle(S, VOIX) },
  };
  /* ---------------- boucliers d'apparat (10A) ---------------- */
  const BL = (root.BOUCLIERS || []).map(([id, n, lv, ic, w]) => ({ id: String(id), n, lv, ic, w }));
  E.GR_SHIELDS = BL;
  const shRar = (b) => (b.w.k === "base" ? "c" : b.w.k === "pts" ? "l" : b.w.k === "align" ? (b.w.r ? "e" : "r") : b.lv >= 190 ? "l" : b.lv >= 120 ? "e" : b.lv >= 50 ? "r" : "c");
  BL.forEach((b) => (b.rar = shRar(b)));
  const dgName = (id) => ((D.DUNGEONS || {})[id] || {}).name || id;
  E.grShieldReq = (b) => (b.w.k === "base" ? "Offert" : b.w.k === "dg" ? `Terminer ${dgName(b.w.v)} en stasis 5` : b.w.k === "align" ? `${b.w.v === "bonta" ? "Bonta" : "Brâkmar"}${b.w.r ? ` au rang ${b.w.r}` : ""} d'alignement` : `Atteindre ${b.w.v.toLocaleString("fr-FR")} points de succès`);
  E.grShieldOk = (S, b) => { if (!b) return false; const w = b.w;
    if (w.k === "base") return true;
    if (w.k === "dg") return (((S.stasis || {})[w.v] || {}).max || 0) >= 5;
    if (w.k === "align") return side(S, w.v) && rank(S) >= (w.r || 1);
    return pts(S) >= w.v; };
  E.grShield = (id) => BL.find((b) => b.id === String(id)) || null;

  /* ---------------- titres colorés (5A) : la rareté se lit sur le texte, pour tous les joueurs ---------------- */
  const T_LEG = /légende|pionnier|fondateur|gardien|souverain|champion|voix d'idlus|maître de l'arène|premier/i;
  let tMap = null;
  const titleMap = () => { if (tMap) return tMap; tMap = {};
    (E.ACH || []).forEach((a) => { if (!a.title) return; const p = E.achPts ? E.achPts(a) : 10; tMap[a.title] = a.s1 ? "s" : p >= 100 ? "l" : p >= 40 ? "e" : p >= 15 ? "r" : "c"; });
    (E.QUEST_CHAPTERS || []).forEach((c) => { if (c.title && !tMap[c.title]) tMap[c.title] = "r"; });
    return tMap; };
  E.titleRar = (t) => { if (!t) return ""; const m = titleMap()[t]; return m || (T_LEG.test(t) ? "l" : "e"); };

  /* ---------------- compagnons (11A) et décors (12A) ---------------- */
  E.grComps = (S) => { const P = E.PETS || {}; const seen = new Set(); return Object.values(S.pets || {}).filter((p) => P[p.id] && !seen.has(p.id) && seen.add(p.id)).map((p) => ({ id: p.id, n: P[p.id].name, ic: P[p.id].icon, rar: P[p.id].gold || P[p.id].fam === "l" ? "l" : P[p.id].kind === "monti" ? "e" : "r" })); };
  E.grCompOk = (S, id) => !!(S.pets && Object.values(S.pets).some((p) => p.id === id));
  // décor = salle du boss d'un donjon terminé (assets/asc), ou carte d'une zone ouverte (assets/z)
  E.grDecors = (S) => {
    const out = [];
    Object.entries(D.DUNGEONS || {}).sort((a, b) => a[1].lvl - b[1].lvl).forEach(([id, d]) => out.push({ id: "d:" + id, n: d.name, url: `assets/asc/${id}.webp`, rar: d.lvl >= 190 ? "l" : d.lvl >= 120 ? "e" : "r", req: `Vaincre ${d.name}`, ok: !!(S.ach && S.ach["dg_" + id]) || (((S.stasis || {})[id] || {}).max || 0) >= 1 }));
    const B = S.bestiary || {}, kills = (s) => (s.monsters || []).reduce((n, m) => n + (B[m] || 0), 0);
    Object.values(D.ZONES || {}).forEach((z) => (z.subs || []).forEach((s) => out.push({ id: "z:" + s.id, n: s.name, url: `assets/z/${s.id}.webp`, rar: "c", req: `Vaincre 100 monstres dans ${s.name}`, ok: kills(s) >= 100 })));
    return out; };
  E.grDecor = (S, id) => (id ? E.grDecors(S).find((x) => x.id === id) || null : null);

  /* ---------------- exclusifs de l'Éternel dans la saison (9A) ---------------- */
  // Exclusifs = ce qui ne s'obtient plus : titres donnés à part (classements, codes, votes), cadres et ornements offerts, Pionnier.
  E.grExclOf = (St) => { if (!St) return null; const u = St.unlocks || {};
    return { titles: (St.titlesExtra || []).slice(0, 80), frames: Object.keys(u).filter((k) => u[k] && /^gift_f_/.test(k)).map((k) => k.slice(7)).concat(u.pionnier ? ["pionnier"] : []),
      orn: Object.keys(u).filter((k) => u[k] && /^gift_o_/.test(k)).map((k) => k.slice(7)), wings: ["or", "argent", "sombre"].filter((w) => u["wing_" + w]) }; };
  E.grExcl = (S, eternel) => { if (!s1(S)) return; const x = E.grExclOf(eternel); if (x) S.s1c.xcos = x; };
  { const t0 = E.titles; if (t0 && !t0.gr) { E.titles = (S) => { const t = t0(S); const x = excl(S); if (x) x.titles.forEach((v) => { if (!t.includes(v)) t.push(v); }); return t; }; E.titles.gr = 1; } }
  { const f0 = E.sframeOk; if (f0) E.sframeOk = (S, id) => f0(S, id) || !!(excl(S) && excl(S).frames.includes(id)); }
  { const o0 = E.ornUnlocked; if (o0) E.ornUnlocked = (S, id) => o0(S, id) || !!(excl(S) && excl(S).orn.includes(id)); }

  /* ---------------- choix ---------------- */
  const hero = (S, cid) => S.chars.find((x) => x.id === cid);
  E.grSet = (S, cid, kind, id) => {
    if (kind === "pcol") { if (id && !(E.GR_PCOL[id] && E.GR_PCOL[id].ok(S))) return "Couleur pas encore débloquée."; S.pcol = id || null; return null; }
    const c = hero(S, cid); if (!c) return "Héros introuvable.";
    if (kind === "aura") { if (id && !(E.GR_AURAS[id] && E.GR_AURAS[id].ok(S))) return "Aura pas encore débloquée."; c.aura = id || null; return null; }
    if (kind === "vic") { if (id && !(E.GR_VIC[id] && E.GR_VIC[id].ok(S))) return "Effet pas encore débloqué."; c.vic = id || null; return null; }
    if (kind === "shield") { if (id && !E.grShieldOk(S, E.grShield(id))) return "Bouclier pas encore débloqué."; c.shield = id || null; return null; }
    if (kind === "comp") { if (id && !E.grCompOk(S, id)) return "Familier pas encore obtenu."; c.comp = id || null; return null; }
    if (kind === "bg") { const d = E.grDecor(S, id); if (id && !(d && d.ok)) return "Décor pas encore débloqué."; c.bg = id || null; return null; }
    return "Choix inconnu.";
  };
  // ce que montre le héros (un choix verrouillé entre-temps, par exemple en changeant de camp, ne se voit plus)
  E.grWorn = (S, c) => ({
    aura: c.aura && E.GR_AURAS[c.aura] && E.GR_AURAS[c.aura].ok(S) ? c.aura : null,
    vic: c.vic && E.GR_VIC[c.vic] && E.GR_VIC[c.vic].ok(S) ? c.vic : "confettis",
    shield: c.shield && E.grShieldOk(S, E.grShield(c.shield)) ? c.shield : null,
    comp: c.comp && E.grCompOk(S, c.comp) ? c.comp : null,
    bg: c.bg && (E.grDecor(S, c.bg) || {}).ok ? c.bg : null,
  });
  E.grPcol = (S) => (S.pcol && E.GR_PCOL[S.pcol] && E.GR_PCOL[S.pcol].ok(S) ? S.pcol : null);
  E.grCount = (S) => { const ok = (o) => Object.values(o).filter((x) => x.ok(S)).length;
    return { aura: [ok(E.GR_AURAS), Object.keys(E.GR_AURAS).length], vic: [ok(E.GR_VIC), Object.keys(E.GR_VIC).length], pcol: [ok(E.GR_PCOL), Object.keys(E.GR_PCOL).length],
      shield: [BL.filter((b) => E.grShieldOk(S, b)).length, BL.length], comp: [E.grComps(S).length, Object.keys(E.PETS || {}).length], bg: (() => { const d = E.grDecors(S); return [d.filter((x) => x.ok).length, d.length]; })() }; };
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
