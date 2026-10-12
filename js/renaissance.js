/* ============================================================================
   RENAISSANCE (0.1.12) — Idlus
   Un héros niveau 200 peut renaître à la Statue du Phénix : il repart au niveau 1 en gardant
   son apparence, ses titres et ornements, ses Dofus et trophées (toujours équipés), son familier,
   sa monture et ses parchemins. Son équipement est rangé dans le sac. Chaque renaissance donne
   +30 % d'XP à ce héros (hors plafond commun) et un Éveil : 8 Éveils communs en 3 rangs, ou
   l'Éveil de classe (renaissances V et X) qui renforce le passif de la classe. 10 renaissances au plus.
   Récompenses visibles : médaillon du Phénix, aura, titres aux renaissances I, V et X, ornement à X.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const { DOFUS_SLOTS, CLASSES } = D;

  const EVEILS = {
    fureur:  { name: "Fureur",             per: 4,  unit: "% de dégâts",              desc: (r) => `+${4 * r} % de dégâts` },
    robu:    { name: "Robustesse",         per: 5,  unit: "% de PV",                  desc: (r) => `+${5 * r} % de points de vie` },
    ecorce:  { name: "Écorce",             per: 3,  unit: "% de résistances",         desc: (r) => `+${3 * r} % à toutes les résistances` },
    lame:    { name: "Lame affûtée",       per: 3,  unit: "% de coups critiques",     desc: (r) => `+${3 * r} % de coups critiques` },
    main:    { name: "Main bienveillante", per: 6,  unit: "% de soins et boucliers",  desc: (r) => `+${6 * r} % de soins et de boucliers` },
    premier: { name: "Premier sang",       per: 8,  unit: "% de dégâts au tour 1",    desc: (r) => `+${8 * r} % de dégâts au premier tour` },
    pros:    { name: "Œil du chercheur",   per: 15, unit: " Prospection",             desc: (r) => `+${15 * r} Prospection` },
    meneur:  { name: "Meneur",             per: 1,  unit: "% de dégâts pour l'équipe", desc: (r) => `+${r} % de dégâts pour toute l'équipe` },
  };
  const EVEIL_ORDER = Object.keys(EVEILS);
  E.EVEIL_MAX = 3;
  /* Éveil de classe : ce qu'il renforce, par classe (rang I puis II) */
  const CLASS_EVEIL = {
    feca: "Glyphe de Soin : +4 % puis +5 % des PV (au lieu de 3 %)", osa: "Invocations : +45 % puis +60 % de PV (au lieu de 30 %)",
    enu: "Pelle : 15 % puis 20 % de chances de retirer 1 PA (au lieu de 10 %)", sram: "Poisons : +35 % puis +45 % (au lieu de 25 %)",
    xelor: "L'Horloge sonne à 11 h puis 10 h (au lieu de 12)", eca: "Pile : +25 % puis +30 % de dégâts pour l'équipe (au lieu de 20 %)",
    eni: "Soins +15 % puis +20 %, et Mots liés +20 % puis +25 % (au lieu de 10 % et 15 %)", iop: "La Colère éclate à 5 puis 4 charges (au lieu de 6)",
    cra: "Distance : +50 % puis +60 % au tour 1 (au lieu de 40 %), et un tour de plus avant d'être à zéro", sadi: "Ronces : 4 puis 5 poisons sur une même cible (au lieu de 3)",
    sacri: "Souffrance : jusqu'à +36 % puis +42 % de dégâts par PV perdus et par coup reçu (au lieu de 30 %)", panda: "Ivresse : +7,5 % puis +9 % de dégâts par niveau (au lieu de 6 %)",
    roub: "Artificier : +20 % puis +25 % contre les groupes de 4 monstres ou plus (au lieu de 15 %)", zobal: "Masque du Psychopathe : +40 % puis +50 % de dégâts (au lieu de 30 %)",
    steam: "Tourelles : +50 % puis +60 % de dégâts (au lieu de 40 %)", elio: "Portails : sorts de zone +35 % puis +45 % (au lieu de 25 %)",
    hupper: "Runes : +15 % puis +20 % en changeant d'élément, +40 % puis +50 % après les 4 éléments (au lieu de 10 % et 30 %)",
    ougi: "Proie : +6 % puis +7 % de dégâts par coup sur la même cible (au lieu de 5 %)", forge: "Posture Lance : +25 % puis +30 % de dégâts (au lieu de 20 %)",
  };
  E.EVEILS = EVEILS; E.EVEIL_ORDER = EVEIL_ORDER; E.CLASS_EVEIL = CLASS_EVEIL;
  E.classEveilRanks = (n) => (n >= 10 ? 2 : n >= 5 ? 1 : 0); // Éveil de classe aux renaissances V et X
  E.isClassRen = (n) => n === 5 || n === 10; // la n-ième renaissance donne l'Éveil de classe

  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  E.roman = (n) => ROMAN[n] || String(n);
  E.REN_AURAS = [["braise", 1], ["flamme", 4], ["brasier", 7], ["phenix", 10]];
  E.renAura = (c) => { let a = null; for (const [k, n] of E.REN_AURAS) if ((c.ren || 0) >= n) a = k; return a; };
  E.REN_TITLES = { 1: "Né des cendres", 5: "Flamme éternelle", 10: "Phénix d'Idlus" };

  E.eveilDesc = (c, id) => (id === "classe" ? `Éveil de classe · ${CLASS_EVEIL[c.cls] || "renforce le passif"}` : EVEILS[id] ? EVEILS[id].desc(E.eveil(c, id)) : "");
  E.eveilList = (c) => { const out = []; EVEIL_ORDER.forEach((id) => { const r = E.eveil(c, id); if (r) out.push([id, r]); }); const k = E.eveil(c, "classe"); if (k) out.push(["classe", k]); return out; };
  E.eveilSummary = (c) => E.eveilList(c).map(([id, r]) => `${id === "classe" ? "Éveil de classe" : EVEILS[id].name} ${E.roman(r)}`).join(", ");

  /* Peut-il renaître ? null si oui, sinon la raison */
  E.canRenaissance = (S, c) => {
    if (!c) return "Héros introuvable.";
    if (c.lvl < E.MAX_LVL) return `Niveau ${E.MAX_LVL} requis.`;
    if ((c.ren || 0) >= E.REN_MAX) return "Ce héros a atteint sa dixième renaissance.";
    if (c.job) return "Rappelez d'abord ce héros de sa récolte.";
    const inTeam = E.team(S).some((x) => x.id === c.id);
    if (inTeam && S.dungeon) return "Terminez ou quittez le donjon en cours.";
    if (inTeam && S.fight && !S.fight.over) return "Attendez la fin du combat.";
    return null;
  };
  /* Choix possibles pour la prochaine renaissance : [id, rang actuel] */
  E.renChoices = (c) => {
    const n = (c.ren || 0) + 1;
    if (E.isClassRen(n)) return [["classe", E.eveil(c, "classe")]];
    return EVEIL_ORDER.filter((id) => E.eveil(c, id) < E.EVEIL_MAX).map((id) => [id, E.eveil(c, id)]);
  };

  E.renaissance = (S, cid, eveilId) => {
    const c = S.chars.find((x) => x.id === cid);
    const err = E.canRenaissance(S, c); if (err) return err;
    if (!E.renChoices(c).some(([id]) => id === eveilId)) return "Choisissez un Éveil.";
    c.ren = (c.ren || 0) + 1; c.eveils = c.eveils || {}; c.eveils[eveilId] = (c.eveils[eveilId] || 0) + 1;
    // l'équipement retourne au sac, sauf les Dofus et trophées
    let stored = 0; for (const slot in c.equip) if (!DOFUS_SLOTS.includes(slot)) { delete c.equip[slot]; stored++; }
    c.lvl = 1; c.xp = 0; c.pts = 0; Object.keys(c.alloc).forEach((k) => (c.alloc[k] = 0));
    c.spells = []; c.presets = c.presets || []; E.refreshSpells(c, E.charStats(S, c));
    // récompenses
    S.titlesExtra = S.titlesExtra || []; S.unlocks = S.unlocks || {};
    const t = E.REN_TITLES[c.ren]; if (t && !S.titlesExtra.includes(t)) S.titlesExtra.push(t);
    if (c.ren >= E.REN_MAX) S.unlocks.phenix = 1;
    S.stats.ren = (S.stats.ren || 0) + 1;
    const evName = eveilId === "classe" ? "Éveil de classe" : EVEILS[eveilId].name;
    E.note(S, `${c.name} renaît (Renaissance ${E.roman(c.ren)}) : ${evName} ${E.roman(c.eveils[eveilId])}, +${Math.round(E.REN_XP * 100 * c.ren)} % d'XP.${stored ? ` ${stored} objet${stored > 1 ? "s rangés" : " rangé"} dans le sac.` : ""}`, "rare");
    E.celebrate({ t: "ren", cid: c.id, n: c.ren, eveil: evName, rank: c.eveils[eveilId], title: t || null });
    E.emit(S, "ren", { cid: c.id, n: c.ren });
    return null;
  };

  /* Bonus total d'un héros, pour l'affichage : [[libellé, valeur], ...] */
  E.renBonuses = (c) => {
    const out = []; if (c.ren) out.push(["XP du héros", `+${Math.round(E.REN_XP * 100 * c.ren)} %`]);
    E.eveilList(c).forEach(([id, r]) => out.push([id === "classe" ? "Éveil de classe" : EVEILS[id].name, id === "classe" ? `rang ${E.roman(r)}` : EVEILS[id].desc(r)]));
    return out;
  };

  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
