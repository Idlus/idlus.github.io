/* ============================================================================
   DONNÉES DU JEU — Idle d'Amakna (v1)
   ----------------------------------------------------------------------------
   Toutes les données modifiables du jeu sont ici : classes, sorts, zones,
   sous-zones, monstres, ressources, objets, panoplies, recettes, donjons.

   Sources : guides de la communauté (JeuxOnLine, Gamosaurus…) pour les noms
   de zones, sous-zones, monstres, ressources, boss et recettes de clés.
   Les lignes marquées  // ~  sont des approximations à vérifier sur DofusDB
   (noms incertains, recettes inventées, emplacements d'objets supposés).
   Les statistiques chiffrées (PV, dégâts, stats d'objets) sont propres à ce
   jeu et servent l'équilibrage : elles ne copient pas celles de Dofus.
   ========================================================================== */
(function (root) {
  "use strict";

  /* ---------- Caractéristiques ---------- */
  // key : nom affiché, poids de rune (forgemagie Dofus), points donnés par une rune simple
  const STATS = {
    vit: { name: "Vitalité",        short: "Vi",     w: 0.2, pts: 5 },
    sa:  { name: "Sagesse",         short: "Sa",     w: 3,   pts: 1 },
    fo:  { name: "Force",           short: "Fo",     w: 1,   pts: 1, el: "t" },
    ine: { name: "Intelligence",    short: "Ine",    w: 1,   pts: 1, el: "f" },
    cha: { name: "Chance",          short: "Cha",    w: 1,   pts: 1, el: "e" },
    age: { name: "Agilité",         short: "Age",    w: 1,   pts: 1, el: "a" },
    pui: { name: "Puissance",       short: "Pui",    w: 2,   pts: 1 },
    do:  { name: "Dommages",        short: "Do",     w: 20,  pts: 1 },
    cri: { name: "% Critique",      short: "Cri",    w: 10,  pts: 1 },
    so:  { name: "Soins",           short: "So",     w: 10,  pts: 1 },
    pp:  { name: "Prospection",     short: "Prospe", w: 3,   pts: 1 },
    ini: { name: "Initiative",      short: "Ini",    w: 0.1, pts: 10 },
    pa:  { name: "PA",              short: "PA",     w: 100, pts: 1 },
    rt:  { name: "% Rés. Terre",    short: "Ré Terre", w: 6, pts: 1 },
    rf:  { name: "% Rés. Feu",      short: "Ré Feu",   w: 6, pts: 1 },
    re:  { name: "% Rés. Eau",      short: "Ré Eau",   w: 6, pts: 1 },
    ra:  { name: "% Rés. Air",      short: "Ré Air",   w: 6, pts: 1 },
  };
  // Ordre d'affichage
  const STAT_ORDER = ["vit","sa","fo","ine","cha","age","pui","do","cri","so","pp","ini","pa","rt","rf","re","ra"];
  // Caractéristiques que l'on répartit avec les points de niveau (5 par niveau)
  const BASE_STATS = ["vit","sa","fo","ine","cha","age"];

  const ELEMENTS = {
    n: { name: "Neutre", stat: "fo",  res: null },
    t: { name: "Terre",  stat: "fo",  res: "rt" },
    f: { name: "Feu",    stat: "ine", res: "rf" },
    e: { name: "Eau",    stat: "cha", res: "re" },
    a: { name: "Air",    stat: "age", res: "ra" },
  };

  /* ---------- Runes (brisage) ----------
     Rune simple = poids w × pts ; Pa = ×3 ; Ra = ×10. Certaines n'existent qu'en simple. */
  const RUNE_TIERS = [
    { key: "",   label: "Rune",    mult: 1 },
    { key: "pa", label: "Pa Rune", mult: 3 },
    { key: "ra", label: "Ra Rune", mult: 10 },
  ];
  const RUNE_SIMPLE_ONLY = ["pa", "do", "cri", "so", "rt", "rf", "re", "ra"];

  /* ---------- Classes & sorts ----------
     type : dmg (une cible), aoe (tous les ennemis), drain (vol de vie), heal (allié le plus blessé),
            healall, buff (bonus de Puissance), shield (bouclier), poison (dégâts sur 3 tours)
     cible des buff/shield : self | allies
     Les éléments des sorts sont simplifiés pour le jeu.  // ~ à comparer aux sorts de Dofus 3 */
  const CLASSES = {
    iop: {
      name: "Iop", color: "#b5402f", main: "fo",
      desc: "Guerrier au corps-à-corps. Gros dégâts Terre, Feu et Air.",
      spells: [
        { id: "pression",    name: "Pression",            lvl: 1,  pa: 3, type: "dmg",  el: "t", min: 9,  max: 13, cd: 0 },
        { id: "epee_divine", name: "Épée Divine",         lvl: 1,  pa: 3, type: "dmg",  el: "a", min: 8,  max: 12, cd: 0 },
        { id: "intimidation",name: "Intimidation",        lvl: 3,  pa: 2, type: "dmg",  el: "t", min: 5,  max: 8,  cd: 0 },
        { id: "tempete_pui", name: "Tempête de Puissance",lvl: 6,  pa: 3, type: "dmg",  el: "f", min: 11, max: 15, cd: 0 },
        { id: "epee_destin", name: "Épée du Destin",      lvl: 9,  pa: 4, type: "dmg",  el: "f", min: 18, max: 24, cd: 2 },
        { id: "concentration",name:"Concentration",       lvl: 11, pa: 2, type: "dmg",  el: "t", min: 9,  max: 12, cd: 1 },
        { id: "compulsion",  name: "Compulsion",          lvl: 13, pa: 2, type: "buff", target: "self", pui: 40, turns: 3, cd: 5 },
        { id: "puissance",   name: "Puissance",           lvl: 17, pa: 3, type: "buff", target: "allies", pui: 30, turns: 3, cd: 6 },
        { id: "vitalite",    name: "Vitalité",            lvl: 21, pa: 3, type: "shield", target: "self", pct: 25, cd: 5 },
        { id: "epee_celeste",name: "Épée Céleste",        lvl: 26, pa: 4, type: "aoe",  el: "a", min: 11, max: 15, cd: 2 },
        { id: "fracture",    name: "Fracture",            lvl: 31, pa: 4, type: "dmg",  el: "a", min: 20, max: 25, cd: 1 },
        { id: "colere_iop",  name: "Colère de Iop",       lvl: 36, pa: 7, type: "dmg",  el: "t", min: 48, max: 58, cd: 3 },
        { id: "epee_iop",    name: "Épée de Iop",         lvl: 41, pa: 4, type: "aoe",  el: "t", min: 16, max: 20, cd: 2 },
      ],
    },
    cra: {
      name: "Crâ", color: "#4f7a33", main: "age",
      desc: "Archer à distance. Dégâts Air et Feu, quelques flèches Eau et Terre.",
      spells: [
        { id: "fl_magique",  name: "Flèche Magique",       lvl: 1,  pa: 3, type: "dmg",  el: "a", min: 8,  max: 12, cd: 0 },
        { id: "fl_ardente",  name: "Flèche Ardente",       lvl: 1,  pa: 3, type: "dmg",  el: "f", min: 8,  max: 12, cd: 0 },
        { id: "fl_glacee",   name: "Flèche Glacée",        lvl: 3,  pa: 3, type: "dmg",  el: "f", min: 6,  max: 9,  cd: 0, weaken: 20 },
        { id: "fl_empois",   name: "Flèche Empoisonnée",   lvl: 6,  pa: 3, type: "poison", el: "a", min: 5, max: 7, turns: 3, cd: 1 },
        { id: "fl_immo",     name: "Flèche d'Immobilisation", lvl: 6, pa: 2, type: "dmg", el: "e", min: 7, max: 10, cd: 0 },
        { id: "fl_recul",    name: "Flèche de Recul",      lvl: 9,  pa: 2, type: "dmg",  el: "a", min: 6,  max: 9,  cd: 0 },
        { id: "fl_explosive",name: "Flèche Explosive",     lvl: 13, pa: 4, type: "aoe",  el: "f", min: 10, max: 13, cd: 1 },
        { id: "tir_puissant",name: "Tir Puissant",         lvl: 17, pa: 3, type: "buff", target: "self", pui: 50, turns: 3, cd: 5 },
        { id: "fl_punitive", name: "Flèche Punitive",      lvl: 21, pa: 4, type: "dmg",  el: "t", min: 17, max: 22, cd: 1 },
        { id: "fl_absorb",   name: "Flèche Absorbante",    lvl: 26, pa: 4, type: "drain",el: "a", min: 13, max: 17, cd: 1 },
        { id: "tir_critique",name: "Tir Critique",         lvl: 31, pa: 2, type: "buff", target: "self", cri: 20, turns: 3, cd: 6 },
        { id: "fl_harcel",   name: "Flèche Harcelante",    lvl: 36, pa: 2, type: "dmg",  el: "a", min: 9,  max: 11, cd: 0 },
        { id: "pluie_fl",    name: "Pluie de Flèches",     lvl: 41, pa: 5, type: "aoe",  el: "f", min: 20, max: 26, cd: 3 },
      ],
    },
    eni: {
      name: "Eniripsa", color: "#c0729a", main: "ine",
      desc: "Soigneuse. Soins puissants, dégâts Feu et Eau.",
      spells: [
        { id: "mot_blessant",name: "Mot Blessant",         lvl: 1,  pa: 3, type: "dmg",  el: "f", min: 7,  max: 11, cd: 0 },
        { id: "mot_soignant",name: "Mot Soignant",         lvl: 1,  pa: 3, type: "heal", min: 11, max: 15, cd: 0 },
        { id: "mot_interdit",name: "Mot Interdit",         lvl: 3,  pa: 3, type: "dmg",  el: "f", min: 9,  max: 12, cd: 0 },
        { id: "mot_turbul",  name: "Mot Turbulent",        lvl: 6,  pa: 3, type: "dmg",  el: "a", min: 9,  max: 12, cd: 0 },
        { id: "mot_drainant",name: "Mot Drainant",         lvl: 9,  pa: 3, type: "drain",el: "e", min: 8,  max: 11, cd: 1 },
        { id: "mot_stimul",  name: "Mot Stimulant",        lvl: 13, pa: 2, type: "buff", target: "allies", pui: 30, turns: 3, cd: 5 },
        { id: "mot_regen",   name: "Mot de Régénération",  lvl: 17, pa: 3, type: "healall", min: 6, max: 9, cd: 2 },
        { id: "mot_prevent", name: "Mot de Prévention",    lvl: 21, pa: 3, type: "shield", target: "allies", pct: 12, cd: 5 },
        { id: "mot_revital", name: "Mot Revitalisant",     lvl: 26, pa: 5, type: "healall", min: 14, max: 18, cd: 3 },
        { id: "mot_vampir",  name: "Mot Vampirique",       lvl: 31, pa: 4, type: "drain",el: "e", min: 16, max: 20, cd: 1 },
        { id: "mot_tournoy", name: "Mot Tournoyant",       lvl: 36, pa: 4, type: "aoe",  el: "e", min: 13, max: 16, cd: 2 },
        { id: "mot_reconst", name: "Mot de Reconstitution",lvl: 41, pa: 6, type: "heal", min: 45, max: 55, cd: 4 },
      ],
    },
  };

  /* Conditions de lancement d'un sort (système de priorités) */
  const CONDITIONS = {
    always:      "Toujours",
    first_turn:  "Au premier tour",
    ally_low:    "Si un allié < 60 % PV",
    self_low:    "Si mes PV < 50 %",
    enemy_many:  "Si 3 ennemis ou plus",
    enemy_one:   "S'il reste 1 seul ennemi",
  };

  /* ---------- Ressources ----------
     cat : drop (monstre), recolte (métier), boss, special
     price : prix de revente au PNJ (kamas) */
  // (déclarées implicitement par leur usage ; prix par défaut calculé selon le niveau de la sous-zone)

  /* ---------- Métiers de récolte ----------
     lvl = niveau de métier requis (échelle 1-200 comme dans Dofus) */
  const GATHER_JOBS = {
    paysan:     { name: "Paysan",     items: [["Blé", 1], ["Orge", 20], ["Avoine", 40]] },
    bucheron:   { name: "Bûcheron",   items: [["Bois de Frêne", 1], ["Bois de Châtaignier", 20], ["Bois de Noyer", 40]] },
    mineur:     { name: "Mineur",     items: [["Fer", 1], ["Cuivre", 20], ["Bronze", 40]] },
    alchimiste: { name: "Alchimiste", items: [["Ortie", 1], ["Sauge", 20], ["Trèfle à 5 feuilles", 40]] },
  };
  /* ---------- Métiers d'artisanat ---------- */
  const CRAFT_JOBS = {
    tailleur:   { name: "Tailleur",   slots: ["coiffe", "cape"] },
    bijoutier:  { name: "Bijoutier",  slots: ["amulette", "anneau"] },
    cordonnier: { name: "Cordonnier", slots: ["ceinture", "bottes"] },
    forgeron:   { name: "Forgeron",   slots: ["arme"] },
    bricoleur:  { name: "Bricoleur",  slots: ["cle"] },
  };

  const SLOTS = {
    coiffe:   "Coiffe",
    cape:     "Cape",
    amulette: "Amulette",
    anneau1:  "Anneau",
    anneau2:  "Anneau",
    ceinture: "Ceinture",
    bottes:   "Bottes",
    arme:     "Arme",
  };

  /* ---------- Monstres ----------
     lvl : [min, max]   el : élément d'attaque   res : résistances % (t,f,e,a)
     hp / dmg : multiplicateurs (1 = normal)   atk : nom de l'attaque si connu
     drops : [ressource, taux %]   items : [id objet, taux %] */
  const M = (o) => Object.assign({ res: {}, hp: 1, dmg: 1, drops: [], items: [] }, o);
  const MONSTERS = {
    /* ===== INCARNAM ===== */
    // Champs
    pissenlit_miroitant: M({ name: "Pissenlit Miroitant", lvl: [1, 3], el: "a", res: { a: 10, f: -10 }, drops: [["Pétale Diaphane", 40], ["Poudre de Perlinpainpain", 25]] }),
    rose_vaporeuse:      M({ name: "Rose Vaporeuse",      lvl: [1, 3], el: "f", res: { f: 10, e: -10 }, drops: [["Pétale Diaphane", 40], ["Poudre de Perlinpainpain", 25]] }),
    tofu_chimerique:     M({ name: "Tofu chimérique",     lvl: [2, 4], el: "a", res: { a: 15, t: -10 }, hp: 0.8, drops: [["Plume Chimérique", 40], ["Chair intangible", 20], ["Œuf de Tofu", 15]] }),
    tournesol_nebuleux:  M({ name: "Tournesol Nébuleux",  lvl: [2, 4], el: "t", res: { t: 10, a: -10 }, drops: [["Pétale Diaphane", 40], ["Poudre de Perlinpainpain", 25]] }),
    // Lac
    petit_gloot:         M({ name: "Petit Gloot",         lvl: [3, 5], el: "e", res: { e: 15, f: -10 }, hp: 0.8, drops: [["Peau de Gloot", 40]] }),
    plikplok:            M({ name: "Plikplok",            lvl: [3, 6], el: "e", res: { e: 10, a: -5 }, drops: [["Peau de Gloot", 40]] }),
    grand_splatch:       M({ name: "Grand Splatch",       lvl: [4, 6], el: "e", res: { e: 20, t: -10 }, hp: 1.3, drops: [["Peau de Gloot", 60]] }),
    // Pâturages
    boufton_palichon:    M({ name: "Boufton Pâlichon",    lvl: [5, 7], el: "a", res: { t: 10, f: -5 }, drops: [["Laine Céleste", 40], ["Bave de Bouftou", 30], ["Chair intangible", 15]] }),
    boufton_orageux:     M({ name: "Boufton Orageux",     lvl: [5, 7], el: "a", res: { a: 15, e: -5 }, drops: [["Laine Céleste", 40], ["Bave de Bouftou", 30], ["Chair intangible", 15]] }),
    bouftou_nuageux:     M({ name: "Bouftou Nuageux",     lvl: [6, 8], el: "n", res: { t: 10, a: 10 }, hp: 1.2, drops: [["Laine Céleste", 45], ["Bave de Bouftou", 30], ["Chair intangible", 15]] }),
    bouftou_ethere:      M({ name: "Bouftou Éthéré",      lvl: [6, 8], el: "f", res: { f: 15, e: -10 }, hp: 1.2, drops: [["Laine Céleste", 45], ["Bave de Bouftou", 30], ["Chair intangible", 15]] }),
    // Forêt (Chapardams)
    ronronchon:          M({ name: "Ronronchon",          lvl: [7, 10], el: "t", res: { t: 15, f: -10 }, hp: 1.2, drops: [["Queue de Chapardam", 45]] }),
    tigrimas:            M({ name: "Tigrimas",            lvl: [7, 10], el: "f", res: { f: 15, e: -10 }, drops: [["Queue de Chapardam", 45]] }),
    chakrobat:           M({ name: "Chakrobat",           lvl: [7, 10], el: "a", res: { a: 15, t: -10 }, hp: 0.9, drops: [["Queue de Chapardam", 45]] }),
    // Route des Âmes
    feu_spirituel:       M({ name: "Feu Spirituel",       lvl: [8, 11], el: "f", res: { f: 25, e: -15 }, drops: [["Feu intérieur", 45], ["Cendre Éternelle", 35]] }), // ~ noms précis des Feux spirituels à vérifier
    // Mine
    aminite:             M({ name: "Aminite",             lvl: [9, 12], el: "t", res: { t: 20, a: -10 }, hp: 1.2, drops: [["Poudre d'Aminite", 42], ["Volve d'Aminite", 30]] }), // ~ noms précis des Aminites à vérifier
    // Cimetière
    chafer_debutant:     M({ name: "Chafer Débutant",     lvl: [10, 13], el: "t", res: { t: 10, f: -10 }, drops: [["Os de Chafer", 45], ["Relique d'Incarnam", 20]] }),
    chafer_furtif:       M({ name: "Chafer Furtif",       lvl: [10, 13], el: "a", res: { a: 15, e: -10 }, hp: 0.9, drops: [["Os de Chafer", 45], ["Relique d'Incarnam", 20]] }),
    chafer_eclaireur:    M({ name: "Chafer Éclaireur",    lvl: [11, 14], el: "f", res: { f: 10, t: -5 }, drops: [["Os de Chafer", 45], ["Relique d'Incarnam", 20]] }),
    chafer_piquier:      M({ name: "Chafer Piquier",      lvl: [11, 14], el: "t", res: { t: 15, a: -10 }, hp: 1.2, drops: [["Os de Chafer", 45], ["Relique d'Incarnam", 25]] }),
    kardorim:            M({ name: "Kardorim",            lvl: [15, 15], el: "t", res: { t: 20, f: 10, e: 10, a: 10 }, hp: 5, dmg: 1.25, boss: true,
                             drops: [["Relique d'Incarnam", 100], ["Cendre Éternelle", 100], ["Os de Chafer", 100]] }),

    /* ===== ASTRUB ===== */
    // Cité d'Astrub — Pious
    piou_rouge:   M({ name: "Piou Rouge",  lvl: [12, 16], el: "f", res: { f: 20, e: -10 }, hp: 0.8, drops: [["Plume de Piou Rouge", 45]] }),
    piou_bleu:    M({ name: "Piou Bleu",   lvl: [12, 16], el: "e", res: { e: 20, a: -10 }, hp: 0.8, drops: [["Plume de Piou Bleu", 45]] }),
    piou_jaune:   M({ name: "Piou Jaune",  lvl: [12, 16], el: "a", res: { a: 20, t: -10 }, hp: 0.8, drops: [["Plume de Piou Jaune", 45]] }),
    piou_vert:    M({ name: "Piou Vert",   lvl: [12, 16], el: "t", res: { t: 20, f: -10 }, hp: 0.8, drops: [["Plume de Piou Vert", 45]] }),
    piou_violet:  M({ name: "Piou Violet", lvl: [13, 16], el: "f", res: { f: 10, t: 10 }, hp: 0.8, drops: [["Plume de Piou Violet", 45]] }),
    piou_rose:    M({ name: "Piou Rose",   lvl: [13, 16], el: "e", res: { e: 10, a: 10 }, hp: 0.8, drops: [["Plume de Piou Rose", 45]] }),
    // Prairies d'Astrub — Larves
    larve_bleue:  M({ name: "Larve Bleue",  lvl: [14, 18], el: "e", res: { e: 20, f: -10 }, drops: [["Peau de Larve Bleue", 45], ["Œil de Larve Bleue", 10]], items: [["bob_paysan", 0.6]] }),
    larve_verte:  M({ name: "Larve Verte",  lvl: [14, 18], el: "a", res: { a: 20, t: -10 }, drops: [["Peau de Larve Verte", 45]], items: [["bottes_paysannes", 0.6]] }),
    larve_orange: M({ name: "Larve Orange", lvl: [15, 18], el: "f", res: { f: 20, e: -10 }, drops: [["Peau de Larve Orange", 45]] }),
    // Tainéla (le Berceau) — Bouftous
    boufton_blanc:   M({ name: "Boufton Blanc",   lvl: [15, 22], el: "a", atk: "Mordillement", res: { t: 5, f: 18, e: -7, a: -12 }, drops: [["Viande Frelatée", 44], ["Corne de Boufton", 44], ["Œil de Boufton", 4.4]], items: [["anneau_bouze", 0.8], ["marteau_bouftou", 0.8]] }),
    boufton_noir:    M({ name: "Boufton Noir",    lvl: [15, 22], el: "a", atk: "Mordillement", res: { t: 5, f: -12, e: 13, a: 18 }, drops: [["Viande Frelatée", 44], ["Laine de Boufton Noir", 44], ["Armée de Tiques", 4.4]], items: [["amulette_bouftou", 0.8]] }),
    bouftou:         M({ name: "Bouftou",         lvl: [16, 22], el: "n", atk: "Morsure du Bouftou", hp: 1.1, res: { t: 3, f: 13, e: -12, a: -7 }, drops: [["Laine de Bouftou", 44], ["Viande Frelatée", 44], ["Sang de Bouftou", 4.4]], items: [["ceinture_bouftou", 0.8], ["boufbottes", 0.8]] }),
    bouftou_noir:    M({ name: "Bouftou Noir",    lvl: [17, 22], el: "t", atk: "Secousses", hp: 1.15, res: { t: 3, f: -7, e: 18, a: 13 }, drops: [["Cuir de Bouftou Noir", 44], ["Viande Frelatée", 44], ["Cervelle de Bouftou Noir", 4.4]] }),
    chef_guerre_bouftou: M({ name: "Chef de Guerre Bouftou", lvl: [18, 22], el: "e", atk: "Morsure de Guerre", hp: 1.1, res: { t: 13, f: 0, e: 0, a: -7 }, drops: [["Laine du Chef de Guerre Bouftou", 44], ["Viande Frelatée", 44], ["Corne de Chef de Guerre Bouftou", 4.4]], items: [["cape_bouffante", 0.8], ["coiffe_bouftou", 0.8]] }),
    bouftou_royal:   M({ name: "Bouftou Royal",   lvl: [30, 30], el: "f", atk: "Morsure du Bouftou Royal", hp: 5, dmg: 1.25, boss: true, res: { t: 35, f: 20, e: 20, a: 25 },
                       drops: [["Cuir de Bouftou Royal", 66], ["Laine de Bouftou Royal", 6.6], ["Laine de Bouftou", 100]] }),
    // Champs d'Astrub — Plantes
    pissenlit_diabolique: M({ name: "Pissenlit Diabolique", lvl: [16, 22], el: "a", res: { a: 15, f: -10 }, drops: [["Fleur de Pissenlit Diabolique", 46], ["Viande Faisandée", 46], ["Engrais", 4.6]], items: [["anneau_champetre", 4.6], ["amulette_champs", 0.9]] }),
    tournesol_sauvage:    M({ name: "Tournesol Sauvage",    lvl: [16, 22], el: "t", res: { t: 15, a: -10 }, drops: [["Pétale de Tournesol Sauvage", 46], ["Viande Faisandée", 46], ["Feuille de Tournesol Sauvage", 4.6]], items: [["capouze_champs", 0.4], ["coiffe_champetre", 0.4]] }),
    rose_demoniaque:      M({ name: "Rose Démoniaque",      lvl: [17, 22], el: "f", res: { f: 15, e: -10 }, drops: [["Pétale de Rose Démoniaque", 46], ["Viande Faisandée", 30]], items: [["bottes_champetres", 0.6]] }), // ~ présence dans les Champs d'Astrub à vérifier
    tournesol_affame:     M({ name: "Tournesol Affamé",     lvl: [28, 28], el: "a", atk: "Protection des Champs", hp: 5, dmg: 1.25, boss: true, res: { t: 25, f: -5, e: 15, a: 25 },
                            drops: [["Pétale Magique du Tournesol Affamé", 100], ["Pétale de Tournesol Sauvage", 100]], items: [["bob_paysan", 6], ["bottes_paysannes", 6]] }),
    // Forêt d'Astrub
    prespic:      M({ name: "Prespic",     lvl: [18, 25], el: "t", res: { t: 15, a: 5, f: -10 }, drops: [["Poils Darits", 40]] }), // ~ ressource du Prespic à vérifier
    sanglier:     M({ name: "Sanglier",    lvl: [19, 25], el: "t", hp: 1.2, res: { t: 20, e: -10 }, drops: [["Étoffe du Sanglier", 35], ["Défense du Sanglier", 20]] }), // ~ Défense du Sanglier à vérifier
    milimulou:    M({ name: "Milimulou",   lvl: [20, 25], el: "e", res: { e: 15, f: -10 }, drops: [["Queue de Milimulou", 40]] }), // ~ ressource à vérifier
    ecurouille:   M({ name: "Écurouille",  lvl: [20, 25], el: "a", hp: 0.9, res: { a: 20, t: -10 }, drops: [["Queue d'Écurouille", 40]] }), // ~ ressource à vérifier
    // Calanques d'Astrub — Pichons
    pichon_blanc:  M({ name: "Pichon Blanc",  lvl: [20, 26], el: "e", res: { e: 15, a: 5 }, drops: [["Arête de Pichon", 40]] }), // ~ ressources des Pichons à vérifier
    pichon_bleu:   M({ name: "Pichon Bleu",   lvl: [20, 26], el: "e", res: { e: 20, f: -5 }, drops: [["Arête de Pichon", 40]] }),
    pichon_kloune: M({ name: "Pichon Kloune", lvl: [21, 26], el: "f", res: { f: 15, e: 5 }, drops: [["Arête de Pichon", 40]] }),
    pichon_orange: M({ name: "Pichon Orange", lvl: [21, 26], el: "f", res: { f: 20, a: -5 }, drops: [["Arête de Pichon", 40]] }),
    pichon_vert:   M({ name: "Pichon Vert",   lvl: [21, 26], el: "a", res: { a: 15, t: -5 }, drops: [["Arête de Pichon", 40]] }),
    mob_eponge:    M({ name: "Mob l'Éponge",  lvl: [24, 24], el: "e", hp: 5, dmg: 1.2, boss: true, res: { t: 15, f: 15, e: 30, a: 10 }, drops: [["Arête de Pichon", 100], ["Éponge de Mob l'Éponge", 100]] }), // ~ drop du boss à vérifier
    // Carrières d'Astrub — Sidoas
    pikdoa:   M({ name: "Pikdoa",  lvl: [24, 30], el: "t", res: { t: 20, f: -10 }, drops: [["Œil de Pikdoa", 40], ["Poils de Sidoa", 30]] }),
    sherpoa:  M({ name: "Sherpoa", lvl: [24, 30], el: "e", hp: 1.2, res: { e: 20, a: -10 }, drops: [["Gant de Sherpoa", 40], ["Poils de Sidoa", 30]] }),
    // Cimetière d'Astrub
    chafer:          M({ name: "Chafer",          lvl: [26, 32], el: "t", res: { t: 15, f: -10 }, drops: [["Os de Chafer", 45]] }), // ~ monstres du Cimetière d'Astrub à vérifier
    chafer_archer:   M({ name: "Chafer Archer",   lvl: [26, 32], el: "a", res: { a: 15, e: -10 }, drops: [["Os de Chafer", 45], ["Arc de Chafer", 10]] }), // ~
    chafer_fantassin:M({ name: "Chafer Fantassin",lvl: [27, 32], el: "t", hp: 1.2, res: { t: 20, a: -10 }, drops: [["Os de Chafer", 45], ["Casque de Chafer", 10]] }), // ~
    // Planque des Vilinsekts (zone cachée)
    cafarcher:   M({ name: "Cafarcher",   lvl: [32, 40], el: "f", atk: "Coup de cure-dent", res: { t: 13, f: -7 }, drops: [["Caissette de Babioles", 100], ["Viande Minérale", 42], ["Antennes de Vilinsekt", 42], ["Rondelle de Bois", 4.2]] }),
    mirgrillon:  M({ name: "Mirgrillon",  lvl: [32, 40], el: "t", atk: "Mini empalement", hp: 1.2, res: { f: 8, e: 6, a: -12 }, drops: [["Caissette de Babioles", 100], ["Antennes de Vilinsekt", 42], ["Viande Minérale", 42], ["Rondelle de Bois", 4.2]] }),
    pyrasite:    M({ name: "Pyrasite",    lvl: [32, 40], el: "f", atk: "Souffle brûlant", res: { t: -9, e: 16, a: -24 }, drops: [["Caissette de Babioles", 100], ["Antennes de Vilinsekt", 42], ["Viande Minérale", 42], ["Rondelle de Bois", 4.2]] }),
    sakarien:    M({ name: "Sakarien",    lvl: [32, 40], el: "t", atk: "Frappe circulaire", hp: 1.3, res: { f: 6, a: -12 }, drops: [["Caissette de Babioles", 100], ["Viande Minérale", 42], ["Antennes de Vilinsekt", 42], ["Rondelle de Bois", 4.2]] }),
    ceglumen:    M({ name: "Céglumen",    lvl: [32, 40], el: "t", atk: "Attrape coton-tige", hp: 1.1, res: { t: 14, a: -29 }, drops: [["Antennes de Vilinsekt", 42], ["Viande Minérale", 42], ["Rondelle de Bois", 4.2]] }),
    kankreblath: M({ name: "Kankreblath", lvl: [40, 40], el: "f", atk: "Blathération", hp: 5, dmg: 1.25, boss: true, res: { f: 34, e: 12, a: 26, t: 18 },
                    drops: [["Patte de Kankreblath", 42], ["Bouclier de Kankreblath", 100], ["Antennes de Vilinsekt", 100]] }),
  };

  /* ---------- Zones & sous-zones ----------
     Les sous-zones se débloquent dans l'ordre : 8 victoires dans la précédente.
     gather : ressources de récolte présentes (pour info) */
  const ZONES = [
    {
      id: "incarnam", name: "Incarnam", lvl: "1 – 15",
      desc: "L'île des âmes, flottant au-dessus d'Astrub.",
      subs: [
        { id: "inc_champs",    name: "Champs",         lvl: [1, 4],   monsters: ["pissenlit_miroitant", "rose_vaporeuse", "tofu_chimerique", "tournesol_nebuleux"] },
        { id: "inc_lac",       name: "Lac",            lvl: [3, 6],   monsters: ["petit_gloot", "plikplok", "grand_splatch"] },
        { id: "inc_paturages", name: "Pâturages",      lvl: [5, 8],   monsters: ["boufton_palichon", "boufton_orageux", "bouftou_nuageux", "bouftou_ethere"] },
        { id: "inc_foret",     name: "Forêt",          lvl: [7, 10],  monsters: ["ronronchon", "tigrimas", "chakrobat"] },
        { id: "inc_route",     name: "Route des Âmes", lvl: [8, 11],  monsters: ["feu_spirituel"] },
        { id: "inc_mine",      name: "Mine",           lvl: [9, 12],  monsters: ["aminite"] },
        { id: "inc_cimetiere", name: "Cimetière",      lvl: [10, 14], monsters: ["chafer_debutant", "chafer_furtif", "chafer_eclaireur", "chafer_piquier"], dungeon: "crypte_kardorim" },
      ],
    },
    {
      id: "astrub", name: "Astrub", lvl: "12 – 40",
      desc: "La cité mercenaire et ses alentours.",
      requires: { boss: "crypte_kardorim" },
      subs: [
        { id: "ast_cite",      name: "Cité d'Astrub",       lvl: [12, 16], monsters: ["piou_rouge", "piou_bleu", "piou_jaune", "piou_vert", "piou_violet", "piou_rose"] },
        { id: "ast_prairies",  name: "Prairies d'Astrub",   lvl: [14, 18], monsters: ["larve_bleue", "larve_verte", "larve_orange"] },
        { id: "ast_champs",    name: "Champs d'Astrub",     lvl: [16, 22], monsters: ["pissenlit_diabolique", "tournesol_sauvage", "rose_demoniaque"], dungeon: "grange_tournesol" },
        { id: "ast_tainela",   name: "Tainéla (le Berceau)",lvl: [15, 22], monsters: ["boufton_blanc", "boufton_noir", "bouftou", "bouftou_noir", "chef_guerre_bouftou"], dungeon: "cour_bouftou_royal" },
        { id: "ast_foret",     name: "Forêt d'Astrub",      lvl: [18, 25], monsters: ["prespic", "sanglier", "milimulou", "ecurouille"] },
        { id: "ast_calanques", name: "Calanques d'Astrub",  lvl: [20, 26], monsters: ["pichon_blanc", "pichon_bleu", "pichon_kloune", "pichon_orange", "pichon_vert"], dungeon: "chateau_ensable" },
        { id: "ast_carrieres", name: "Carrières d'Astrub",  lvl: [24, 30], monsters: ["pikdoa", "sherpoa"] },
        { id: "ast_cimetiere", name: "Cimetière d'Astrub",  lvl: [26, 32], monsters: ["chafer", "chafer_archer", "chafer_fantassin"] },
        { id: "ast_planque",   name: "Planque des Vilinsekts", lvl: [32, 40], monsters: ["cafarcher", "mirgrillon", "pyrasite", "sakarien"], dungeon: "cache_kankreblath", hidden: true, requiresItem: "Baguette Rikiki" },
      ],
    },
  ];

  /* ---------- Donjons ----------
     key : nom de la clé (ressource)   rooms : salles [monstres possibles, niveau]   boss en dernière salle
     keyDrop : la clé peut aussi tomber sur les monstres de la sous-zone (taux %) */
  const DUNGEONS = {
    crypte_kardorim: {
      name: "Crypte de Kardorim", boss: "kardorim", key: "Clef de la Crypte de Kardorim", keyDrop: 1.5, lvl: 15,
      rooms: [
        { mobs: ["chafer_debutant", "chafer_furtif"], lvl: 12, size: [2, 3] },
        { mobs: ["chafer_eclaireur", "chafer_piquier"], lvl: 13, size: [2, 3] },
        { mobs: ["chafer_piquier", "chafer_furtif", "chafer_eclaireur"], lvl: 14, size: [2, 4] },
      ],
      bossMobs: ["chafer_piquier", "chafer_eclaireur"],
    },
    grange_tournesol: {
      name: "La Grange du Tournesol Affamé", boss: "tournesol_affame", key: "Clef des Champs", keyDrop: 1, lvl: 28,
      rooms: [
        { mobs: ["pissenlit_diabolique", "tournesol_sauvage"], lvl: 22, size: [2, 4] },
        { mobs: ["tournesol_sauvage", "rose_demoniaque"], lvl: 24, size: [2, 4] },
        { mobs: ["pissenlit_diabolique", "rose_demoniaque", "tournesol_sauvage"], lvl: 26, size: [3, 5] },
      ],
      bossMobs: ["tournesol_sauvage", "pissenlit_diabolique"],
    },
    cour_bouftou_royal: {
      name: "Cour du Bouftou Royal", boss: "bouftou_royal", key: "Clef de la Cour du Bouftou Royal", keyDrop: 1, lvl: 30,
      rooms: [
        { mobs: ["boufton_blanc", "bouftou", "chef_guerre_bouftou", "boufton_noir"], lvl: 22, size: [3, 5] },
        { mobs: ["boufton_blanc", "chef_guerre_bouftou", "bouftou_noir", "boufton_noir"], lvl: 24, size: [3, 5] },
        { mobs: ["boufton_blanc", "bouftou", "bouftou_noir", "boufton_noir"], lvl: 26, size: [3, 5] },
        { mobs: ["boufton_blanc", "bouftou", "chef_guerre_bouftou", "boufton_noir"], lvl: 28, size: [3, 6] },
      ],
      bossMobs: ["bouftou_noir", "chef_guerre_bouftou", "bouftou"],
    },
    chateau_ensable: {
      name: "Le Château Ensablé", boss: "mob_eponge", key: "Clef du Château Ensablé", keyDrop: 1, lvl: 24,
      rooms: [
        { mobs: ["pichon_blanc", "pichon_bleu"], lvl: 20, size: [2, 4] },
        { mobs: ["pichon_kloune", "pichon_orange"], lvl: 22, size: [2, 4] },
        { mobs: ["pichon_vert", "pichon_blanc", "pichon_kloune"], lvl: 23, size: [3, 5] },
      ],
      bossMobs: ["pichon_bleu", "pichon_orange"],
    },
    cache_kankreblath: {
      name: "Cache de Kankreblath", boss: "kankreblath", key: "Clef de la Cache de Kankreblath", keyDrop: 0.8, lvl: 40,
      rooms: [
        { mobs: ["sakarien", "ceglumen", "cafarcher", "pyrasite", "mirgrillon"], lvl: 32, size: [3, 6] },
        { mobs: ["mirgrillon", "ceglumen", "sakarien", "cafarcher", "pyrasite"], lvl: 34, size: [3, 6] },
        { mobs: ["pyrasite", "mirgrillon", "ceglumen", "sakarien", "cafarcher"], lvl: 36, size: [4, 6] },
        { mobs: ["ceglumen", "pyrasite", "cafarcher", "sakarien", "mirgrillon"], lvl: 38, size: [4, 7] },
      ],
      bossMobs: ["cafarcher", "pyrasite", "mirgrillon", "ceglumen", "sakarien"],
    },
  };

  /* ---------- Objets d'équipement ----------
     stats : { stat: [min, max] }   set : panoplie   craft : { job, ing: [[ressource, qté]] }
     Les recettes d'équipement sont propres au jeu.  // ~ */
  const I = (o) => Object.assign({ stats: {}, set: null, craft: null }, o);
  const ITEMS = {
    /* Panoplie de l'Aventurier (niveau 1) */
    chapeau_aventurier: I({ name: "Chapeau de l'Aventurier", slot: "coiffe",   lvl: 1, set: "aventurier", stats: { vit: [5, 10], sa: [1, 3] },
      craft: { job: "tailleur", ing: [["Pétale Diaphane", 3], ["Blé", 3]] } }),
    cape_aventurier:    I({ name: "Cape de l'Aventurier",    slot: "cape",     lvl: 1, set: "aventurier", stats: { vit: [5, 10], pp: [2, 5] },
      craft: { job: "tailleur", ing: [["Plume Chimérique", 3], ["Ortie", 3]] } }),
    amulette_aventurier:I({ name: "Amulette de l'Aventurier",slot: "amulette", lvl: 2, set: "aventurier", stats: { vit: [5, 10], ine: [2, 5] },
      craft: { job: "bijoutier", ing: [["Poudre de Perlinpainpain", 3], ["Fer", 2]] } }),
    anneau_aventurier:  I({ name: "Anneau de l'Aventurier",  slot: "anneau",   lvl: 2, set: "aventurier", stats: { vit: [5, 10], fo: [2, 5] },
      craft: { job: "bijoutier", ing: [["Peau de Gloot", 3], ["Fer", 2]] } }),
    ceinture_aventurier:I({ name: "Ceinture de l'Aventurier",slot: "ceinture", lvl: 3, set: "aventurier", stats: { vit: [5, 10], age: [2, 5] },
      craft: { job: "cordonnier", ing: [["Peau de Gloot", 3], ["Ortie", 3]] } }),
    bottes_aventurier:  I({ name: "Bottes de l'Aventurier",  slot: "bottes",   lvl: 3, set: "aventurier", stats: { vit: [5, 10], cha: [2, 5] },
      craft: { job: "cordonnier", ing: [["Pétale Diaphane", 3], ["Bois de Frêne", 3]] } }),

    /* Panoplie du Boune (Incarnam) — recettes réelles d'après le guide des quêtes d'Incarnam ; emplacements supposés // ~ */
    plussain:   I({ name: "Le Plussain",   slot: "anneau",   lvl: 6, set: "boune", stats: { vit: [8, 14], fo: [4, 8], ine: [4, 8] },
      craft: { job: "bijoutier", ing: [["Fer", 5], ["Cendre Éternelle", 3]] } }),
    s_mesme:    I({ name: "Le S'Mesme",    slot: "amulette", lvl: 6, set: "boune", stats: { vit: [8, 14], cha: [4, 8], age: [4, 8] },
      craft: { job: "bijoutier", ing: [["Fer", 5], ["Feu intérieur", 3]] } }),
    incrustes:  I({ name: "Les Incrustes", slot: "bottes",   lvl: 7, set: "boune", stats: { vit: [8, 14], ini: [40, 80], pp: [3, 6] },
      craft: { job: "cordonnier", ing: [["Feu intérieur", 3], ["Poudre de Perlinpainpain", 5]] } }),
    spamette:   I({ name: "La Spamette",   slot: "coiffe",   lvl: 7, set: "boune", stats: { vit: [10, 16], sa: [3, 6] },
      craft: { job: "tailleur", ing: [["Bave de Bouftou", 5], ["Cendre Éternelle", 3]] } }),
    floude:     I({ name: "Le Floude",     slot: "ceinture", lvl: 8, set: "boune", stats: { vit: [10, 16], fo: [3, 6], age: [3, 6] },
      craft: { job: "cordonnier", ing: [["Ortie", 5], ["Cendre Éternelle", 3]] } }),
    cape_sloque:I({ name: "La Cape S'loque", slot: "cape",   lvl: 8, set: "boune", stats: { vit: [10, 16], ine: [3, 6], cha: [3, 6] },
      craft: { job: "tailleur", ing: [["Feu intérieur", 3], ["Ortie", 5]] } }),
    demi_baguette: I({ name: "Demi-Baguette", slot: "arme", lvl: 8, stats: { ine: [5, 10], so: [2, 4], pui: [3, 6] },
      craft: { job: "forgeron", ing: [["Bois de Frêne", 3], ["Queue de Chapardam", 3], ["Blé", 6]] } }),
    hachette_bucheron: I({ name: "Hachette de Bûcheron", slot: "arme", lvl: 8, stats: { fo: [6, 11], do: [1, 2] },
      craft: { job: "forgeron", ing: [["Fer", 5], ["Laine Céleste", 5]] } }),

    /* Objets d'Incarnam (Chapardams, Chafers) // ~ objets inventés pour combler les emplacements */
    arc_chapardam:  I({ name: "Arc du Chapardam", slot: "arme", lvl: 10, stats: { age: [7, 12], cri: [1, 2] },
      craft: { job: "forgeron", ing: [["Queue de Chapardam", 6], ["Bois de Frêne", 6]] } }), // ~
    anneau_reliques: I({ name: "Anneau des Reliques", slot: "anneau", lvl: 12, stats: { vit: [10, 18], pui: [4, 8], sa: [2, 4] },
      craft: { job: "bijoutier", ing: [["Relique d'Incarnam", 3], ["Os de Chafer", 6], ["Poudre d'Aminite", 4]] } }), // ~

    /* Panoplie du Bouftou (Tainéla) */
    coiffe_bouftou:   I({ name: "Coiffe du Bouftou",   slot: "coiffe",   lvl: 20, set: "bouftou", stats: { vit: [21, 30], fo: [11, 15], ine: [5, 10] },
      craft: { job: "tailleur", ing: [["Laine de Bouftou", 8], ["Laine du Chef de Guerre Bouftou", 3], ["Corne de Boufton", 3]] } }),
    cape_bouffante:   I({ name: "Cape Bouffante",      slot: "cape",     lvl: 20, set: "bouftou", stats: { vit: [21, 30], ine: [11, 15], fo: [5, 10] },
      craft: { job: "tailleur", ing: [["Laine de Bouftou", 8], ["Laine de Boufton Noir", 4], ["Bois de Châtaignier", 3]] } }),
    amulette_bouftou: I({ name: "Amulette du Bouftou", slot: "amulette", lvl: 18, set: "bouftou", stats: { vit: [16, 25], fo: [6, 10], ine: [6, 10] },
      craft: { job: "bijoutier", ing: [["Laine de Boufton Noir", 5], ["Corne de Boufton", 5], ["Cuivre", 3]] } }),
    ceinture_bouftou: I({ name: "Ceinture du Bouftou", slot: "ceinture", lvl: 18, set: "bouftou", stats: { vit: [16, 25], sa: [5, 10] },
      craft: { job: "cordonnier", ing: [["Cuir de Bouftou Noir", 5], ["Laine de Bouftou", 5]] } }),
    boufbottes:       I({ name: "Boufbottes",          slot: "bottes",   lvl: 19, set: "bouftou", stats: { vit: [16, 25], fo: [6, 10], pp: [5, 10] },
      craft: { job: "cordonnier", ing: [["Cuir de Bouftou Noir", 5], ["Viande Frelatée", 5], ["Laine de Bouftou", 3]] } }),
    marteau_bouftou:  I({ name: "Marteau du Bouftou",  slot: "arme",     lvl: 22, set: "bouftou", stats: { fo: [15, 25], ine: [10, 15], pui: [5, 10] },
      craft: { job: "forgeron", ing: [["Corne de Chef de Guerre Bouftou", 1], ["Laine de Bouftou", 10], ["Bronze", 2]] } }),
    anneau_bouze:     I({ name: "Anneau de Bouze le Clerc", slot: "anneau", lvl: 22, stats: { vit: [15, 25], sa: [6, 12], pp: [5, 10] } }),

    /* Panoplie Champêtre & des Champs (Champs d'Astrub) */
    coiffe_champetre:  I({ name: "Coiffe Champêtre",   slot: "coiffe",   lvl: 17, set: "champetre", stats: { vit: [15, 25], age: [8, 14], cha: [4, 8] } }),
    anneau_champetre:  I({ name: "Anneau Champêtre",   slot: "anneau",   lvl: 16, set: "champetre", stats: { vit: [10, 20], age: [6, 10], pp: [3, 6] },
      craft: { job: "bijoutier", ing: [["Fleur de Pissenlit Diabolique", 6], ["Cuivre", 2]] } }),
    bottes_champetres: I({ name: "Bottes Champêtres",  slot: "bottes",   lvl: 18, set: "champetre", stats: { vit: [15, 25], age: [8, 12], ini: [80, 150] },
      craft: { job: "cordonnier", ing: [["Pétale de Rose Démoniaque", 6], ["Pétale de Tournesol Sauvage", 6], ["Orge", 4]] } }),
    amulette_champs:   I({ name: "Amulette des Champs",slot: "amulette", lvl: 18, set: "champs", stats: { vit: [15, 25], cha: [8, 14], so: [2, 4] } }),
    capouze_champs:    I({ name: "Capouze des Champs", slot: "cape",     lvl: 18, set: "champs", stats: { vit: [15, 25], cha: [8, 14], ine: [4, 8] },
      craft: { job: "tailleur", ing: [["Feuille de Tournesol Sauvage", 2], ["Pétale de Tournesol Sauvage", 8], ["Orge", 4]] } }),

    /* Panoplie du Paysan (Tournesol Affamé, Larves) */
    bob_paysan:        I({ name: "Bob du Paysan",      slot: "coiffe",   lvl: 26, set: "paysan", stats: { vit: [25, 40], pp: [10, 15], sa: [6, 10] } }),
    bottes_paysannes:  I({ name: "Bottes Paysannes",   slot: "bottes",   lvl: 26, set: "paysan", stats: { vit: [25, 40], pp: [8, 12], cha: [8, 12] } }),

    /* Astrub divers // ~ objets inventés pour équilibrer la progression */
    cape_larves:   I({ name: "Cape des Larves",     slot: "cape",     lvl: 16, stats: { vit: [15, 22], cha: [6, 10], re: [2, 4] },
      craft: { job: "tailleur", ing: [["Peau de Larve Bleue", 5], ["Peau de Larve Verte", 5], ["Peau de Larve Orange", 5]] } }), // ~
    coiffe_piou:   I({ name: "Coiffe des Pious",    slot: "coiffe",   lvl: 14, stats: { vit: [12, 20], age: [5, 9], ine: [5, 9] },
      craft: { job: "tailleur", ing: [["Plume de Piou Rouge", 3], ["Plume de Piou Bleu", 3], ["Plume de Piou Jaune", 3], ["Plume de Piou Vert", 3]] } }), // ~
    ceinture_piou: I({ name: "Ceinture des Pious",  slot: "ceinture", lvl: 15, stats: { vit: [12, 20], cha: [5, 9], fo: [5, 9] },
      craft: { job: "cordonnier", ing: [["Plume de Piou Violet", 4], ["Plume de Piou Rose", 4], ["Ortie", 6]] } }), // ~
    epee_sanglier: I({ name: "Épée du Sanglier",    slot: "arme",     lvl: 24, stats: { fo: [16, 24], cri: [2, 3], vit: [10, 20] },
      craft: { job: "forgeron", ing: [["Étoffe du Sanglier", 6], ["Défense du Sanglier", 3], ["Cuivre", 4]] } }), // ~
    arc_ecurouille:I({ name: "Arc de l'Écurouille", slot: "arme",     lvl: 24, stats: { age: [16, 24], cri: [2, 3], ini: [60, 120] },
      craft: { job: "forgeron", ing: [["Queue d'Écurouille", 6], ["Poils Darits", 4], ["Bois de Châtaignier", 4]] } }), // ~
    baton_milimulou:I({ name: "Bâton du Milimulou", slot: "arme",     lvl: 24, stats: { ine: [14, 22], so: [4, 8], cha: [8, 12] },
      craft: { job: "forgeron", ing: [["Queue de Milimulou", 6], ["Bois de Châtaignier", 6]] } }), // ~
    amulette_pichon:I({ name: "Amulette des Calanques", slot: "amulette", lvl: 25, stats: { vit: [20, 30], cha: [10, 15], re: [3, 5] },
      craft: { job: "bijoutier", ing: [["Arête de Pichon", 8], ["Éponge de Mob l'Éponge", 1], ["Cuivre", 4]] } }), // ~
    anneau_sidoa:  I({ name: "Anneau des Sidoas",   slot: "anneau",   lvl: 28, stats: { vit: [20, 30], fo: [8, 12], cha: [8, 12] },
      craft: { job: "bijoutier", ing: [["Poils de Sidoa", 6], ["Œil de Pikdoa", 3], ["Bronze", 2]] } }), // ~
    gants_sherpoa: I({ name: "Ceinture du Sherpoa", slot: "ceinture", lvl: 28, stats: { vit: [25, 35], rt: [3, 5], re: [3, 5], pui: [5, 10] },
      craft: { job: "cordonnier", ing: [["Gant de Sherpoa", 4], ["Poils de Sidoa", 4], ["Bronze", 2]] } }), // ~
    coiffe_chafer: I({ name: "Casque du Chafer",    slot: "coiffe",   lvl: 30, stats: { vit: [30, 45], fo: [10, 15], rt: [3, 6] },
      craft: { job: "tailleur", ing: [["Casque de Chafer", 1], ["Os de Chafer", 10], ["Bronze", 3]] } }), // ~
    cape_vilinsekt:I({ name: "Cape Vilinsekte",     slot: "cape",     lvl: 36, stats: { vit: [35, 50], age: [12, 18], ine: [12, 18] },
      craft: { job: "tailleur", ing: [["Antennes de Vilinsekt", 10], ["Viande Minérale", 6], ["Bois de Noyer", 4]] } }), // ~
    bouclier_kankre:I({ name: "Bottes de Kankreblath", slot: "bottes", lvl: 40, stats: { vit: [40, 60], pui: [12, 20], rf: [4, 7] },
      craft: { job: "cordonnier", ing: [["Patte de Kankreblath", 2], ["Bouclier de Kankreblath", 1], ["Antennes de Vilinsekt", 8]] } }), // ~
  };

  /* ---------- Panoplies ----------
     bonus[n] = bonus quand n pièces sont portées */
  const SETS = {
    aventurier: { name: "Panoplie de l'Aventurier", bonus: { 2: { vit: 10 }, 4: { vit: 20, pp: 10 }, 6: { vit: 30, pp: 20, pui: 10 } } },
    boune:      { name: "Panoplie du Boune",        bonus: { 2: { pui: 5 }, 4: { pui: 15, sa: 5 }, 6: { pui: 25, sa: 10, pa: 1 } } },
    bouftou:    { name: "Panoplie du Bouftou",      bonus: { 2: { fo: 10 }, 3: { fo: 15, ine: 10 }, 4: { fo: 20, ine: 15, vit: 20 }, 6: { fo: 30, ine: 25, vit: 40, pa: 1 } } },
    champetre:  { name: "Panoplie Champêtre",       bonus: { 2: { age: 10 }, 3: { age: 20, pp: 10 } } },
    champs:     { name: "Panoplie des Champs",      bonus: { 2: { cha: 15, so: 5 } } },
    paysan:     { name: "Panoplie du Paysan",       bonus: { 2: { pp: 20, sa: 10 } } },
  };

  /* ---------- Objets spéciaux (craft du Bricoleur) ---------- */
  const SPECIAL_CRAFTS = {
    "Clef de la Crypte de Kardorim":   { job: "bricoleur", lvl: 1,  ing: [["Relique d'Incarnam", 3], ["Cendre Éternelle", 5]] },
    "Clef des Champs":                 { job: "bricoleur", lvl: 10, ing: [["Fleur de Pissenlit Diabolique", 5], ["Pétale de Tournesol Sauvage", 5], ["Blé", 10], ["Orge", 5]] }, // ~ recette à vérifier
    "Clef de la Cour du Bouftou Royal":{ job: "bricoleur", lvl: 10, ing: [["Corne de Boufton", 1], ["Laine de Bouftou", 1], ["Orge", 5], ["Sauge", 5], ["Cuivre", 5], ["Bois de Châtaignier", 5], ["Laine du Chef de Guerre Bouftou", 1], ["Laine de Boufton Noir", 1]] },
    "Clef du Château Ensablé":         { job: "bricoleur", lvl: 10, ing: [["Arête de Pichon", 6], ["Bois de Frêne", 5], ["Cuivre", 3]] }, // ~ recette à vérifier
    "Clef de la Cache de Kankreblath": { job: "bricoleur", lvl: 20, ing: [["Trèfle à 5 feuilles", 4], ["Bronze", 4], ["Bois de Noyer", 4], ["Avoine", 4], ["Antennes de Vilinsekt", 4]] },
    "Baguette Rikiki":                 { job: "bricoleur", lvl: 15, ing: [["Étoffe du Sanglier", 1], ["Poils Darits", 1], ["Cervelle de Bouftou Noir", 1], ["Pétale Magique du Tournesol Affamé", 1]], unique: true },
  };
  /* Pour la Cache de Kankreblath, la clé ne tombe que dans la Planque : la clé d'entrée « Antennes » vient de là. */

  /* ---------- Emblème du Solitaire ----------
     cap[stat] : plafond par niveau d'emblème */
  const EMBLEM = {
    maxLvl: 1000,
    lines: [[1, 2], [100, 3], [400, 4], [700, 5]],
    cap: { vit: 2, sa: 0.3, fo: 0.5, ine: 0.5, cha: 0.5, age: 0.5, pui: 0.3, do: 0.04, cri: 0.02, so: 0.05, pp: 0.25, ini: 3, rt: 0.02, rf: 0.02, re: 0.02, ra: 0.02 },
    ranks: [[1, "Novice"], [100, "Aguerri"], [250, "Vétéran"], [400, "Expert"], [500, "Maître"], [700, "Grand Maître"], [850, "Légendaire"], [1000, "Transcendé"]],
    perks: {
      250: [
        { id: "brisage", name: "Briseur d'âmes", desc: "+15 % de runes obtenues au brisage" },
        { id: "drop",    name: "Chasseur solitaire", desc: "+15 % de chances de butin en solo" },
        { id: "xp",      name: "Sage errant", desc: "+15 % d'expérience en solo" },
      ],
      500: [
        { id: "dmg",     name: "Dernier debout", desc: "+15 % de dégâts en solo" },
        { id: "res",     name: "Peau de Craqueleur", desc: "+8 % de résistance à tous les éléments en solo" },
        { id: "heal",    name: "Second souffle", desc: "Régénère 5 % des PV max à chaque tour en solo" },
      ],
    },
  };

  /* Bonus « Esprit Libre » selon le nombre de personnages dans l'équipe (en %) */
  const FREE_SPIRIT = { 1: 100, 2: 80, 3: 60, 4: 40, 5: 25, 6: 15, 7: 5, 8: 0 };

  /* Noms proposés pour les nouveaux personnages */
  const NAMES = ["Goultard", "Tristepin", "Évangelyne", "Amalia", "Ruel", "Kerubim", "Grougaloragran", "Lou", "Joris", "Atcham", "Yugo", "Bakara", "Otomaï", "Dally", "Simone", "Toross"];

  const DATA = { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, RUNE_TIERS, RUNE_SIMPLE_ONLY, CLASSES, CONDITIONS, GATHER_JOBS, CRAFT_JOBS, SLOTS,
                 MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, EMBLEM, FREE_SPIRIT, NAMES };
  root.DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof window !== "undefined" ? window : globalThis);
