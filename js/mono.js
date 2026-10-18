/* ============================================================================
   Monocompte — Idlus (deuxième serveur ; maquette finale validée par Mathis le 18/10/2026 : « 1A »)
   Un seul héros par saison, qui part du niveau 1 sans rien. Étape 1 :
   - une partie à part (sauvegarde « dofousxen-save-mono », choisie à l'écran des parties ou à la création du héros) ;
   - le héros unique : pas de recrutement, 3 Dofus portés au plus en Saison 1 ;
   - le bonus « Héros unique » (PV, dégâts subis, dégâts) réglé par simulation, classe par classe (tools/sim_mono.js) :
     optimisé seul vers la stasis 7, sans équipement vers la stasis 1 ;
   - le butin d'équipement ×4 jusqu'au niveau 100, ×1,5 au-delà (les ressources ne changent pas : un héros seul
     a déjà la même moyenne qu'une équipe) ; les gains hors ligne à 80 %.
   Les groupes en direct, le mercenaire, les saisons, le pass et le serveur à part viennent aux étapes suivantes.
   Crochets dans engine.js : E.monoSmall (PV et dégâts subis), E.monoDmg (dégâts), E.monoItem (butin d'équipement), E.MONO.off (hors ligne).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { ITEMS, DOFUS_SLOTS } = D;
  const M = (E.MONO = {
    saison: 1, nom: "Saison 1",
    /* donjon : % de PV, % de dégâts subis en moins, % de dégâts. Simulation du 18/10 (tools/sweep_mono.js, 8 donjons du niveau 30 au 200,
       4 essais ; comme tools/simulate.js, sans Dofus ni Maîtrise) : optimisé, stasis 7,07 en moyenne (6,75 à 7,38 selon la classe) ; bon équipement 6,1 ; sans équipement 1,2 */
    hp: 200, dr: 48, dmg: 60,
    huntHp: 120, huntDr: 50,        // chasse : comme un héros seul du serveur Classique
    /* retouche par classe (EQ1 : toutes les classes seules vers la stasis 7, à ± 0,5), en points de dégâts subis en moins */
    cls: { feca: { dr: 9 }, osa: { dr: -3 }, enu: { dr: 18 }, sram: { dr: -9 }, eni: { dr: 5 }, iop: { dr: 5 }, cra: { dr: 12 }, sadi: { dr: 15 }, sacri: { dr: -13 },
      panda: { dr: 22 }, roub: { dr: -40 }, zobal: { dr: -4 }, steam: { dr: -13 }, elio: { dr: -3 }, hupper: { dr: 7 }, ougi: { dr: 6 }, forge: { dr: -14 } },
    dofus: 3,                       // Dofus portés au plus (Saison 1)
    lootLow: 4, lootHigh: 1.5, lootLvl: 100,
    off: 0.8,
  });
  E.isMono = (S) => !!(S && S.mono);
  E.monoStart = (S) => { S.mono = { s: M.saison, t0: E.now() }; return S; };
  const adj = (cls) => M.cls[cls] || {};
  E.monoSmall = (S, team, dungeon) => {
    const k = adj(team[0] && team[0].cls);
    return dungeon ? { hp: M.hp + (k.hp || 0), dr: Math.min(80, M.dr + (k.dr || 0)), name: "Héros unique" } : { hp: M.huntHp, dr: M.huntDr, name: "Héros unique" };
  };
  E.monoDmg = (S, e) => M.dmg + (adj(e.cls).dmg || 0);
  E.monoItem = (S, T) => (T && T.lvl > M.lootLvl ? M.lootHigh : M.lootLow);

  /* dans le jeu (une partie par page) : la partie Monocompte limite l'équipe à 1 héros et les emplacements de Dofus à 3 */
  E.monoBoot = (S) => { if (!E.isMono(S)) return; E.HERO_MAX = 1; E.TEAM_MAX = 1; if (DOFUS_SLOTS.length > M.dofus) DOFUS_SLOTS.splice(M.dofus); };
  /* le héros unique : pas de recrutement */
  const recruit0 = E.recruit;
  E.recruit = function (S) { if (E.isMono(S)) return "Monocompte : un seul héros par saison."; return recruit0.apply(this, arguments); };
  /* 3 Dofus portés au plus */
  E.monoDofusSlots = (S) => (E.isMono(S) ? DOFUS_SLOTS.slice(0, M.dofus) : DOFUS_SLOTS);
  const equip0 = E.equip;
  E.equip = function (S, cid, uid, slot) {
    const it = E.isMono(S) && S.items[uid];
    if (it && ITEMS[it.tpl] && ITEMS[it.tpl].slot === "dofus") {
      const c = S.chars.find((x) => x.id === cid);
      const ok = E.monoDofusSlots(S);
      let o = slot && slot.startsWith("dofus") ? slot : c && E.slotFor(c, it);
      if (!ok.includes(o)) o = c && ok.find((s) => !c.equip[s]);
      if (!o) return `Monocompte, ${M.nom} : ${M.dofus} Dofus portés au plus. Retire-en un pour faire de la place.`;
      return equip0.call(this, S, cid, uid, o);
    }
    return equip0.apply(this, arguments);
  };
})(typeof window !== "undefined" ? window : globalThis);
