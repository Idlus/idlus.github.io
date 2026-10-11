/* ============================================================================
   DONNÉES DU JEU — DofousXen (v2)
   ----------------------------------------------------------------------------
   Ce fichier contient les règles propres au jeu (caractéristiques, classes,
   sorts, Emblème…). Le contenu tiré de DOFUS (zones, sous-zones, monstres,
   archimonstres, ressources, taux de drop, objets, panoplies, recettes, clés)
   est généré dans js/gamedata.js par tools/build_data.py depuis DofusDB.
   Projet de fan non commercial — DOFUS et son contenu © Ankama Games.
   ========================================================================== */
(function (root) {
  "use strict";
  const G = root.GAMEDATA || (typeof require !== "undefined" ? require("./gamedata.js") : null);

  /* ---------- Caractéristiques ----------
     w : poids de rune (forgemagie)   pts : points donnés par une rune simple */
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
  const STAT_ORDER = ["vit","sa","fo","ine","cha","age","pui","do","cri","so","pp","ini","pa","rt","rf","re","ra"];
  const BASE_STATS = ["vit","sa","fo","ine","cha","age"];

  const ELEMENTS = {
    n: { name: "Neutre", stat: "fo",  res: null },
    t: { name: "Terre",  stat: "fo",  res: "rt" },
    f: { name: "Feu",    stat: "ine", res: "rf" },
    e: { name: "Eau",    stat: "cha", res: "re" },
    a: { name: "Air",    stat: "age", res: "ra" },
  };

  const RUNE_TIERS = [
    { key: "",   label: "Rune",    mult: 1 },
    { key: "pa", label: "Pa Rune", mult: 3 },
    { key: "ra", label: "Ra Rune", mult: 10 },
  ];
  const RUNE_SIMPLE_ONLY = ["pa", "do", "cri", "so", "rt", "rf", "re", "ra"];

  /* ---------- Classes & sorts ----------
     Noms et icônes : sorts de DOFUS 3. Effets simplifiés pour le combat automatique.
     type : dmg (une cible), aoe (tous les ennemis), drain (vol de vie), heal (allié le plus blessé),
            healall, buff (Puissance / critique), shield (bouclier), poison (dégâts sur plusieurs tours) */
  const CLASSES = {
    iop: {
      name: "Iop", color: "#c0392b", main: "fo", sex: "m",
      desc: "Guerrier au corps-à-corps. Gros dégâts Terre, Feu et Air.",
      passive: { id: "colere", name: "Colère", desc: "+10 % de dégâts contre les boss." },
      spells: [
        { id: "pression",      name: "Pression",             lvl: 1,  pa: 3, type: "dmg",  el: "t", min: 9,  max: 13, cd: 0 },
        { id: "epee_divine",   name: "Épée Divine",          lvl: 1,  pa: 3, type: "dmg",  el: "a", min: 8,  max: 12, cd: 0 },
        { id: "intimidation",  name: "Intimidation",         lvl: 3,  pa: 2, type: "dmg",  el: "t", min: 5,  max: 8,  cd: 0 },
        { id: "tempete_pui",   name: "Tempête de Puissance", lvl: 6,  pa: 3, type: "dmg",  el: "f", min: 11, max: 15, cd: 0 },
        { id: "epee_destin",   name: "Épée du Destin",       lvl: 9,  pa: 4, type: "dmg",  el: "f", min: 18, max: 24, cd: 2 },
        { id: "concentration", name: "Concentration",        lvl: 11, pa: 2, type: "dmg",  el: "t", min: 9,  max: 12, cd: 1 },
        { id: "deferlement",   name: "Déferlement",          lvl: 13, pa: 3, type: "dmg",  el: "e", min: 12, max: 16, cd: 0 },
        { id: "puissance",     name: "Puissance",            lvl: 17, pa: 3, type: "buff", target: "allies", pui: 30, turns: 3, cd: 6 },
        { id: "vitalite",      name: "Vitalité",             lvl: 21, pa: 3, type: "shield", target: "self", pct: 25, cd: 5 },
        { id: "epee_celeste",  name: "Épée Céleste",         lvl: 26, pa: 4, type: "aoe",  el: "a", min: 11, max: 15, cd: 2 },
        { id: "endurance",     name: "Endurance",            lvl: 31, pa: 4, type: "dmg",  el: "e", min: 20, max: 25, cd: 1 },
        { id: "fureur",        name: "Fureur",               lvl: 36, pa: 7, type: "dmg",  el: "t", min: 48, max: 58, cd: 3 },
        { id: "epee_iop",      name: "Épée de Iop",          lvl: 41, pa: 4, type: "aoe",  el: "t", min: 16, max: 20, cd: 2 },
      ],
    },
    cra: {
      name: "Crâ", color: "#3c8b4a", main: "age", sex: "f",
      desc: "Archère à distance. Dégâts Air et Feu, quelques flèches Eau et Terre.",
      passive: { id: "lynx", name: "Œil de lynx", desc: "Agit toujours en premier au premier tour." },
      spells: [
        { id: "fl_recul",      name: "Flèche de Recul",        lvl: 1,  pa: 3, type: "dmg",  el: "a", min: 8,  max: 12, cd: 0 },
        { id: "fl_barrage",    name: "Flèche de Barrage",      lvl: 1,  pa: 3, type: "dmg",  el: "f", min: 8,  max: 12, cd: 0 },
        { id: "fl_glacee",     name: "Flèche Glacée",          lvl: 3,  pa: 3, type: "dmg",  el: "e", min: 6,  max: 9,  cd: 0, weaken: 20 },
        { id: "fl_detonante",  name: "Flèche Détonante",       lvl: 6,  pa: 3, type: "poison", el: "f", min: 5, max: 7, turns: 3, cd: 1 },
        { id: "fl_immo",       name: "Flèche d'Immobilisation",lvl: 6,  pa: 2, type: "dmg",  el: "e", min: 7,  max: 10, cd: 0 },
        { id: "fl_cinglante",  name: "Flèche Cinglante",       lvl: 9,  pa: 2, type: "dmg",  el: "a", min: 6,  max: 9,  cd: 0 },
        { id: "fl_explosive",  name: "Flèche Explosive",       lvl: 13, pa: 4, type: "aoe",  el: "f", min: 10, max: 13, cd: 1 },
        { id: "tirs_puissants",name: "Tirs Puissants",         lvl: 17, pa: 3, type: "buff", target: "self", pui: 50, turns: 3, cd: 5 },
        { id: "fl_punitive",   name: "Flèche Punitive",        lvl: 21, pa: 4, type: "dmg",  el: "t", min: 17, max: 22, cd: 1 },
        { id: "fl_devorante",  name: "Flèche Dévorante",       lvl: 26, pa: 4, type: "drain",el: "f", min: 13, max: 17, cd: 1 },
        { id: "acuite",        name: "Acuité Absolue",         lvl: 31, pa: 2, type: "buff", target: "self", cri: 20, turns: 3, cd: 6 },
        { id: "fl_vagabonde",  name: "Flèche Vagabonde",       lvl: 36, pa: 2, type: "dmg",  el: "t", min: 9,  max: 11, cd: 0, casts: 3 },
        { id: "fl_abolition",  name: "Flèche d'Abolition",     lvl: 41, pa: 5, type: "aoe",  el: "t", min: 20, max: 26, cd: 3 },
      ],
    },
    eni: {
      name: "Eniripsa", color: "#d4568f", main: "ine", sex: "f",
      desc: "Soigneuse. Soins puissants, dégâts Feu et Eau.",
      passive: { id: "altruisme", name: "Mots d'altruisme", desc: "+10 % de soins." },
      spells: [
        { id: "mot_turbulent", name: "Mot Turbulent",         lvl: 1,  pa: 3, type: "dmg",  el: "f", min: 7,  max: 11, cd: 0 },
        { id: "mot_jouvence",  name: "Mot de Jouvence",       lvl: 1,  pa: 3, type: "heal", min: 11, max: 15, cd: 0 },
        { id: "mot_interdit",  name: "Mot Interdit",          lvl: 3,  pa: 3, type: "dmg",  el: "e", min: 9,  max: 12, cd: 0 },
        { id: "mot_espiegle",  name: "Mot Espiègle",          lvl: 6,  pa: 3, type: "dmg",  el: "a", min: 9,  max: 12, cd: 0 },
        { id: "mot_vampirique",name: "Mot Vampirique",        lvl: 9,  pa: 3, type: "drain",el: "e", min: 8,  max: 11, cd: 1 },
        { id: "mot_stimulant", name: "Mot Stimulant",         lvl: 13, pa: 2, type: "buff", target: "allies", pui: 30, turns: 3, cd: 5 },
        { id: "mot_tapageur",  name: "Mot Tapageur",          lvl: 17, pa: 3, type: "healall", min: 6, max: 9, cd: 2 },
        { id: "mot_amitie",    name: "Mot d'Amitié",          lvl: 21, pa: 3, type: "shield", target: "allies", pct: 12, cd: 5 },
        { id: "lamentations",  name: "Lamentations",          lvl: 26, pa: 5, type: "healall", min: 14, max: 18, cd: 3 },
        { id: "chapardage",    name: "Chapardage",            lvl: 31, pa: 4, type: "drain",el: "f", min: 16, max: 20, cd: 1 },
        { id: "cryotherapie",  name: "Cryothérapie",          lvl: 36, pa: 4, type: "aoe",  el: "e", min: 13, max: 16, cd: 2 },
        { id: "mot_reconst",   name: "Mot de Reconstitution", lvl: 41, pa: 6, type: "heal", min: 45, max: 55, cd: 4 },
      ],
    },
  };

  /* Les 16 autres classes : kits simplifiés générés depuis les vrais sorts de DOFUS 3
     (noms, icônes, PA et relances réels ; effets ramenés aux types du combat automatique). */
  const EXTRA_CLASSES = {"feca": {"name": "Féca", "color": "#3f7fc4", "main": "fo", "sex": "f", "desc": "Protecteur : boucliers et glyphes, dégâts Feu, Terre et Eau.", "passive": {"id": "bouclier_feca", "name": "Armure du Féca", "desc": "L'équipe subit 5 % de dégâts en moins."}, "spells": [{"id": "retour_du_baton", "name": "Retour du Bâton", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "langueur", "name": "Langueur", "lvl": 1, "pa": 3, "type": "dmg", "el": "f", "min": 9, "max": 12, "cd": 0}, {"id": "nimbus", "name": "Nimbus", "lvl": 3, "pa": 3, "type": "aoe", "el": "e", "min": 7, "max": 9, "cd": 0}, {"id": "typhon", "name": "Typhon", "lvl": 6, "pa": 3, "type": "aoe", "el": "a", "min": 7, "max": 10, "cd": 0}, {"id": "barricade", "name": "Barricade", "lvl": 9, "pa": 2, "type": "shield", "target": "allies", "pct": 10, "cd": 4}, {"id": "rempart", "name": "Rempart", "lvl": 11, "pa": 2, "type": "aoe", "el": "t", "min": 9, "max": 13, "cd": 3}, {"id": "somnolence", "name": "Somnolence", "lvl": 13, "pa": 3, "type": "aoe", "el": "t", "min": 8, "max": 11, "cd": 0}, {"id": "bastion", "name": "Bastion", "lvl": 17, "pa": 2, "type": "shield", "target": "allies", "pct": 10, "cd": 4}, {"id": "lethargie", "name": "Léthargie", "lvl": 21, "pa": 3, "type": "dmg", "el": "f", "min": 13, "max": 17, "cd": 0}, {"id": "frisson", "name": "Frisson", "lvl": 26, "pa": 3, "type": "aoe", "el": "a", "min": 10, "max": 14, "cd": 0}, {"id": "bulle", "name": "Bulle", "lvl": 31, "pa": 2, "type": "dmg", "el": "e", "min": 10, "max": 13, "cd": 0}, {"id": "prairie", "name": "Prairie", "lvl": 36, "pa": 3, "type": "dmg", "el": "a", "min": 27, "max": 37, "cd": 3}]}, "osa": {"name": "Osamodas", "color": "#7a5ab8", "main": "fo", "sex": "m", "desc": "Dompteur : invocations qui frappent sur la durée, vol de vie.", "passive": {"id": "dompteur", "name": "Dompteur", "desc": "+5 % de PV pour toute l'équipe (familiers et montures +15 % d'XP en v3)."}, "spells": [{"id": "cri_du_corbac", "name": "Cri du Corbac", "lvl": 1, "pa": 2, "type": "drain", "el": "a", "min": 5, "max": 6, "cd": 0}, {"id": "pics_du_prespic", "name": "Pics du Prespic", "lvl": 1, "pa": 2, "type": "drain", "el": "f", "min": 5, "max": 6, "cd": 0}, {"id": "dents_du_piranya", "name": "Dents du Piranya", "lvl": 3, "pa": 3, "type": "drain", "el": "e", "min": 7, "max": 10, "cd": 0}, {"id": "cri_de_l_ours", "name": "Cri de l'Ours", "lvl": 6, "pa": 3, "type": "drain", "el": "t", "min": 8, "max": 11, "cd": 0}, {"id": "cortege_sauvage", "name": "Cortège Sauvage", "lvl": 9, "pa": 3, "type": "buff", "target": "self", "pui": 40, "turns": 3, "cd": 5}, {"id": "fouet", "name": "Fouet", "lvl": 11, "pa": 2, "type": "dmg", "el": "t", "min": 7, "max": 10, "cd": 0}, {"id": "tofu", "name": "Tofu", "lvl": 13, "pa": 3, "type": "poison", "el": "a", "turns": 3, "min": 6, "max": 8, "cd": 1}, {"id": "piqure_motivante", "name": "Piqûre Motivante", "lvl": 17, "pa": 2, "type": "buff", "target": "allies", "pui": 30, "turns": 3, "cd": 4}, {"id": "bouftou", "name": "Bouftou", "lvl": 21, "pa": 3, "type": "poison", "el": "t", "turns": 3, "min": 7, "max": 10, "cd": 1}, {"id": "dragoune", "name": "Dragoune", "lvl": 26, "pa": 3, "type": "poison", "el": "f", "turns": 3, "min": 8, "max": 10, "cd": 1}, {"id": "saute_granouille", "name": "Saute-granouille", "lvl": 31, "pa": 3, "type": "dmg", "el": "e", "min": 15, "max": 20, "cd": 0}, {"id": "souffle_draconique", "name": "Souffle Draconique", "lvl": 36, "pa": 3, "type": "aoe", "el": "f", "min": 12, "max": 16, "cd": 0}]}, "enu": {"name": "Enutrof", "color": "#b08a2e", "main": "cha", "sex": "m", "desc": "Chasseur de trésors : dégâts Eau et Terre, butin augmenté.", "passive": {"id": "tresor", "name": "Chercheur de trésors", "desc": "+20 % de butin et de kamas pour l'équipe."}, "spells": [{"id": "lancer_de_pieces", "name": "Lancer de Pièces", "lvl": 1, "pa": 2, "type": "dmg", "el": "e", "min": 6, "max": 8, "cd": 0}, {"id": "force_de_l_age", "name": "Force de l'Âge", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "roulage_de_pelle", "name": "Roulage de Pelle", "lvl": 3, "pa": 3, "type": "dmg", "el": "f", "min": 9, "max": 13, "cd": 0}, {"id": "opportunite", "name": "Opportunité", "lvl": 6, "pa": 2, "type": "dmg", "el": "a", "min": 7, "max": 9, "cd": 0}, {"id": "ruee_vers_l_or", "name": "Ruée vers l'Or", "lvl": 9, "pa": 2, "type": "heal", "min": 13, "max": 18, "cd": 3}, {"id": "remblai", "name": "Remblai", "lvl": 11, "pa": 3, "type": "aoe", "el": "t", "min": 8, "max": 11, "cd": 0}, {"id": "abattement", "name": "Abattement", "lvl": 13, "pa": 3, "type": "dmg", "el": "a", "min": 11, "max": 15, "cd": 0}, {"id": "boite_de_pandore", "name": "Boîte de Pandore", "lvl": 17, "pa": 2, "type": "healall", "min": 7, "max": 9, "cd": 2}, {"id": "pelle_aurifere", "name": "Pelle Aurifère", "lvl": 21, "pa": 4, "type": "dmg", "el": "e", "min": 17, "max": 23, "cd": 0}, {"id": "corruption", "name": "Corruption", "lvl": 26, "pa": 5, "type": "heal", "min": 56, "max": 76, "cd": 5}, {"id": "pelle_fantomatique", "name": "Pelle Fantomatique", "lvl": 31, "pa": 3, "type": "dmg", "el": "f", "min": 15, "max": 20, "cd": 0}, {"id": "banqueroute", "name": "Banqueroute", "lvl": 36, "pa": 4, "type": "dmg", "el": "a", "min": 21, "max": 28, "cd": 0}]}, "sram": {"name": "Sram", "color": "#5b5b6e", "main": "fo", "sex": "m", "desc": "Assassin : pièges et poisons, dégâts Air et Feu.", "passive": {"id": "larcin", "name": "Larcin", "desc": "10 % de chances de voler un butin supplémentaire à chaque victoire."}, "spells": [{"id": "truanderie", "name": "Truanderie", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "sournoiserie", "name": "Sournoiserie", "lvl": 1, "pa": 3, "type": "dmg", "el": "f", "min": 9, "max": 12, "cd": 0}, {"id": "cruaute", "name": "Cruauté", "lvl": 3, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 13, "cd": 0}, {"id": "piege_sournois", "name": "Piège Sournois", "lvl": 6, "pa": 2, "type": "poison", "el": "f", "turns": 3, "min": 3, "max": 4, "cd": 1}, {"id": "piege_fangeux", "name": "Piège Fangeux", "lvl": 9, "pa": 3, "type": "poison", "el": "e", "turns": 3, "min": 5, "max": 6, "cd": 1}, {"id": "piege_funeste", "name": "Piège Funeste", "lvl": 11, "pa": 3, "type": "poison", "el": "t", "turns": 3, "min": 5, "max": 7, "cd": 1}, {"id": "piege_repulsif", "name": "Piège Répulsif", "lvl": 13, "pa": 2, "type": "poison", "el": "a", "turns": 3, "min": 3, "max": 5, "cd": 1}, {"id": "piege_de_derive", "name": "Piège de Dérive", "lvl": 17, "pa": 2, "type": "poison", "el": "f", "turns": 3, "min": 4, "max": 5, "cd": 1}, {"id": "piege_scelerat", "name": "Piège Scélérat", "lvl": 21, "pa": 2, "type": "poison", "el": "e", "turns": 3, "min": 4, "max": 5, "cd": 1}, {"id": "concentration_de_cha", "name": "Concentration de Chakra", "lvl": 26, "pa": 3, "type": "drain", "el": "t", "min": 19, "max": 26, "cd": 3}, {"id": "piege_mortel", "name": "Piège Mortel", "lvl": 31, "pa": 3, "type": "poison", "el": "t", "turns": 3, "min": 7, "max": 9, "cd": 1}, {"id": "fourvoiement", "name": "Fourvoiement", "lvl": 36, "pa": 4, "type": "aoe", "el": "a", "min": 16, "max": 21, "cd": 0}]}, "xelor": {"name": "Xélor", "color": "#3e8fa8", "main": "age", "sex": "f", "desc": "Maître du temps : dégâts Feu et Eau, peut rejouer son tour.", "passive": {"id": "temps", "name": "Distorsion temporelle", "desc": "10 % de chances de rejouer son tour."}, "spells": [{"id": "perturbation", "name": "Perturbation", "lvl": 1, "pa": 3, "type": "drain", "el": "f", "min": 7, "max": 10, "cd": 0}, {"id": "gelure", "name": "Gelure", "lvl": 1, "pa": 2, "type": "dmg", "el": "e", "min": 6, "max": 8, "cd": 0}, {"id": "souvenir", "name": "Souvenir", "lvl": 3, "pa": 2, "type": "drain", "el": "a", "min": 5, "max": 7, "cd": 0}, {"id": "frappe_de_xelor", "name": "Frappe de Xélor", "lvl": 6, "pa": 3, "type": "dmg", "el": "t", "min": 10, "max": 13, "cd": 0}, {"id": "fletrissement", "name": "Flétrissement", "lvl": 9, "pa": 3, "type": "dmg", "el": "a", "min": 10, "max": 14, "cd": 0}, {"id": "engrenage", "name": "Engrenage", "lvl": 11, "pa": 3, "type": "aoe", "el": "t", "min": 8, "max": 11, "cd": 0}, {"id": "rayon_obscur", "name": "Rayon Obscur", "lvl": 13, "pa": 4, "type": "aoe", "el": "f", "min": 11, "max": 15, "cd": 0}, {"id": "ralentissement", "name": "Ralentissement", "lvl": 17, "pa": 2, "type": "dmg", "el": "e", "min": 8, "max": 11, "cd": 0}, {"id": "horloge", "name": "Horloge", "lvl": 21, "pa": 4, "type": "dmg", "el": "t", "min": 17, "max": 23, "cd": 0}, {"id": "refraction", "name": "Réfraction", "lvl": 26, "pa": 2, "type": "aoe", "el": "f", "min": 7, "max": 9, "cd": 0}, {"id": "petrification", "name": "Pétrification", "lvl": 31, "pa": 4, "type": "dmg", "el": "e", "min": 19, "max": 26, "cd": 0}, {"id": "distorsion", "name": "Distorsion", "lvl": 36, "pa": 4, "type": "aoe", "el": "a", "min": 16, "max": 21, "cd": 0}]}, "eca": {"name": "Ecaflip", "color": "#d17a2a", "main": "age", "sex": "m", "desc": "Joueur : dégâts aléatoires, attire la chance.", "passive": {"id": "chance_eca", "name": "Coup de chance", "desc": "Chances d'objet Rayonnant et d'archimonstre ×1,5 pour l'équipe."}, "spells": [{"id": "reflexes", "name": "Réflexes", "lvl": 1, "pa": 2, "type": "dmg", "el": "a", "min": 6, "max": 8, "cd": 0}, {"id": "yams", "name": "Yams", "lvl": 1, "pa": 2, "type": "dmg", "el": "e", "min": 6, "max": 8, "cd": 0}, {"id": "topkaj", "name": "Topkaj", "lvl": 3, "pa": 2, "type": "dmg", "el": "f", "min": 6, "max": 8, "cd": 0}, {"id": "pile_ou_face", "name": "Pile ou Face", "lvl": 6, "pa": 2, "type": "dmg", "el": "t", "min": 7, "max": 9, "cd": 0}, {"id": "perception", "name": "Perception", "lvl": 9, "pa": 2, "type": "heal", "min": 8, "max": 10, "cd": 0}, {"id": "jass", "name": "Jass", "lvl": 11, "pa": 3, "type": "dmg", "el": "a", "min": 11, "max": 15, "cd": 0}, {"id": "baraka", "name": "Baraka", "lvl": 13, "pa": 3, "type": "dmg", "el": "e", "min": 11, "max": 15, "cd": 0}, {"id": "chateau_de_cartes", "name": "Château de Cartes", "lvl": 17, "pa": 3, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "blakjak", "name": "Blakjak", "lvl": 21, "pa": 3, "type": "dmg", "el": "f", "min": 13, "max": 17, "cd": 0}, {"id": "belote", "name": "Belote", "lvl": 26, "pa": 3, "type": "dmg", "el": "t", "min": 14, "max": 18, "cd": 0}, {"id": "tromperie", "name": "Tromperie", "lvl": 31, "pa": 2, "type": "drain", "el": "a", "min": 8, "max": 11, "cd": 0}, {"id": "pelotage", "name": "Pelotage", "lvl": 36, "pa": 3, "type": "aoe", "el": "f", "min": 12, "max": 16, "cd": 0}]}, "sadi": {"name": "Sadida", "color": "#4f8f2f", "main": "fo", "sex": "f", "desc": "Druide : poupées et poisons, dégâts Terre et Eau.", "passive": {"id": "nature", "name": "Enfant de la nature", "desc": "Récolte de bois et de plantes 20 % plus rapide."}, "spells": [{"id": "ronce", "name": "Ronce", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "larme_de_sadida", "name": "Larme de Sadida", "lvl": 1, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 12, "cd": 0}, {"id": "buisson_ardent", "name": "Buisson Ardent", "lvl": 3, "pa": 3, "type": "dmg", "el": "f", "min": 9, "max": 13, "cd": 0}, {"id": "cigue", "name": "Cigüe", "lvl": 6, "pa": 3, "type": "dmg", "el": "a", "min": 10, "max": 13, "cd": 0}, {"id": "ronce_apaisante", "name": "Ronce Apaisante", "lvl": 9, "pa": 2, "type": "healall", "min": 8, "max": 10, "cd": 4}, {"id": "contagion", "name": "Contagion", "lvl": 11, "pa": 4, "type": "aoe", "el": "a", "min": 11, "max": 15, "cd": 0}, {"id": "ronces_agressives", "name": "Ronces Agressives", "lvl": 13, "pa": 4, "type": "dmg", "el": "t", "min": 15, "max": 20, "cd": 0}, {"id": "puissance_sylvestre", "name": "Puissance Sylvestre", "lvl": 17, "pa": 2, "type": "healall", "min": 8, "max": 10, "cd": 3}, {"id": "fleau", "name": "Fléau", "lvl": 21, "pa": 3, "type": "drain", "el": "e", "min": 10, "max": 14, "cd": 0}, {"id": "la_sacrifiee", "name": "La Sacrifiée", "lvl": 26, "pa": 2, "type": "aoe", "el": "e", "min": 10, "max": 14, "cd": 2}, {"id": "herbes_folles", "name": "Herbes Folles", "lvl": 31, "pa": 3, "type": "aoe", "el": "f", "min": 11, "max": 15, "cd": 0}, {"id": "sacrifice_vaudou", "name": "Sacrifice Vaudou", "lvl": 36, "pa": 3, "type": "aoe", "el": "e", "min": 12, "max": 16, "cd": 0}]}, "sacri": {"name": "Sacrieur", "color": "#a12a2a", "main": "fo", "sex": "m", "desc": "Berserker : plus il est blessé, plus il frappe fort.", "passive": {"id": "sang", "name": "Soif de sang", "desc": "Jusqu'à +30 % de dégâts quand ses PV sont bas."}, "spells": [{"id": "absorption", "name": "Absorption", "lvl": 1, "pa": 3, "type": "drain", "el": "f", "min": 7, "max": 10, "cd": 0}, {"id": "hemorragie", "name": "Hémorragie", "lvl": 1, "pa": 3, "type": "drain", "el": "a", "min": 7, "max": 10, "cd": 0}, {"id": "supplice", "name": "Supplice", "lvl": 3, "pa": 3, "type": "drain", "el": "t", "min": 7, "max": 10, "cd": 0}, {"id": "stase", "name": "Stase", "lvl": 6, "pa": 3, "type": "drain", "el": "e", "min": 8, "max": 11, "cd": 0}, {"id": "mutilation", "name": "Mutilation", "lvl": 9, "pa": 2, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "epee_vorace", "name": "Épée Vorace", "lvl": 11, "pa": 3, "type": "poison", "el": "n", "turns": 3, "min": 10, "max": 13, "cd": 4}, {"id": "ravage", "name": "Ravage", "lvl": 13, "pa": 3, "type": "dmg", "el": "t", "min": 11, "max": 15, "cd": 0}, {"id": "libation", "name": "Libation", "lvl": 17, "pa": 3, "type": "heal", "min": 23, "max": 31, "cd": 3}, {"id": "assaut", "name": "Assaut", "lvl": 21, "pa": 2, "type": "dmg", "el": "a", "min": 8, "max": 11, "cd": 0}, {"id": "condensation", "name": "Condensation", "lvl": 26, "pa": 3, "type": "aoe", "el": "e", "min": 10, "max": 14, "cd": 0}, {"id": "hostilite", "name": "Hostilité", "lvl": 31, "pa": 2, "type": "dmg", "el": "f", "min": 10, "max": 13, "cd": 0}, {"id": "couronne_d_epines", "name": "Couronne d'Épines", "lvl": 36, "pa": 2, "type": "aoe", "el": "t", "min": 14, "max": 18, "cd": 3}]}, "panda": {"name": "Pandawa", "color": "#6aa84f", "main": "age", "sex": "m", "desc": "Brasseur : dégâts Terre et Eau, soutien de l'équipe.", "passive": {"id": "brasseur", "name": "Maître brasseur", "desc": "Consommables 25 % plus longs."}, "spells": [{"id": "gueule_de_bois", "name": "Gueule de Bois", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "ethylo", "name": "Ethylo", "lvl": 1, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 12, "cd": 0}, {"id": "paume_explosive", "name": "Paume Explosive", "lvl": 3, "pa": 2, "type": "aoe", "el": "f", "min": 5, "max": 6, "cd": 0}, {"id": "schnaps", "name": "Schnaps", "lvl": 6, "pa": 3, "type": "aoe", "el": "a", "min": 7, "max": 10, "cd": 0}, {"id": "fermentation", "name": "Fermentation", "lvl": 9, "pa": 3, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "brancard", "name": "Brancard", "lvl": 11, "pa": 2, "type": "aoe", "el": "t", "min": 5, "max": 7, "cd": 0}, {"id": "pandikulation", "name": "Pandikulation", "lvl": 13, "pa": 2, "type": "aoe", "el": "f", "min": 6, "max": 8, "cd": 0}, {"id": "propulsion", "name": "Propulsion", "lvl": 17, "pa": 2, "type": "aoe", "el": "a", "min": 6, "max": 8, "cd": 0}, {"id": "eau_de_vie", "name": "Eau-de-vie", "lvl": 21, "pa": 2, "type": "aoe", "el": "e", "min": 6, "max": 9, "cd": 0}, {"id": "eviction", "name": "Éviction", "lvl": 26, "pa": 2, "type": "aoe", "el": "t", "min": 7, "max": 9, "cd": 0}, {"id": "flasque_explosive", "name": "Flasque Explosive", "lvl": 31, "pa": 2, "type": "aoe", "el": "f", "min": 7, "max": 10, "cd": 0}, {"id": "nausee", "name": "Nausée", "lvl": 36, "pa": 2, "type": "dmg", "el": "a", "min": 10, "max": 14, "cd": 0}]}, "roub": {"name": "Roublard", "color": "#8a4a2a", "main": "age", "sex": "m", "desc": "Artificier : bombes à retardement et explosions en zone.", "passive": {"id": "artificier", "name": "Artificier", "desc": "+15 % de dégâts contre les groupes de 4 monstres ou plus."}, "spells": [{"id": "recel", "name": "Recel", "lvl": 1, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 12, "cd": 0}, {"id": "extraction", "name": "Extraction", "lvl": 1, "pa": 3, "type": "drain", "el": "f", "min": 7, "max": 10, "cd": 0}, {"id": "explobombe", "name": "Explobombe", "lvl": 3, "pa": 2, "type": "poison", "el": "f", "turns": 3, "min": 3, "max": 4, "cd": 1}, {"id": "tornabombe", "name": "Tornabombe", "lvl": 6, "pa": 2, "type": "poison", "el": "a", "turns": 3, "min": 3, "max": 4, "cd": 1}, {"id": "bombe_a_eau", "name": "Bombe à Eau", "lvl": 9, "pa": 2, "type": "poison", "el": "e", "turns": 3, "min": 3, "max": 4, "cd": 1}, {"id": "sismobombe", "name": "Sismobombe", "lvl": 11, "pa": 2, "type": "poison", "el": "t", "turns": 3, "min": 3, "max": 4, "cd": 1}, {"id": "pulsar", "name": "Pulsar", "lvl": 13, "pa": 3, "type": "aoe", "el": "f", "min": 8, "max": 11, "cd": 0}, {"id": "espingole", "name": "Espingole", "lvl": 17, "pa": 3, "type": "aoe", "el": "a", "min": 9, "max": 12, "cd": 0}, {"id": "bombarde", "name": "Bombarde", "lvl": 21, "pa": 3, "type": "aoe", "el": "t", "min": 10, "max": 13, "cd": 0}, {"id": "dagues_boomerang", "name": "Dagues Boomerang", "lvl": 26, "pa": 4, "type": "aoe", "el": "a", "min": 14, "max": 18, "cd": 0}, {"id": "mousquet", "name": "Mousquet", "lvl": 31, "pa": 2, "type": "poison", "el": "t", "turns": 3, "min": 4, "max": 6, "cd": 1}, {"id": "resquille", "name": "Resquille", "lvl": 36, "pa": 4, "type": "poison", "el": "e", "turns": 3, "min": 9, "max": 13, "cd": 1}]}, "zobal": {"name": "Zobal", "color": "#b0567a", "main": "fo", "sex": "f", "desc": "Masqué : change de rôle à chaque combat.", "passive": {"id": "masques", "name": "Masques", "desc": "Un masque différent à chaque combat : attaque, défense ou soins."}, "spells": [{"id": "brincadeira", "name": "Brincadeira", "lvl": 1, "pa": 2, "type": "dmg", "el": "f", "min": 6, "max": 8, "cd": 0}, {"id": "catalepsie", "name": "Catalepsie", "lvl": 1, "pa": 3, "type": "drain", "el": "t", "min": 7, "max": 10, "cd": 0}, {"id": "parafuso", "name": "Parafuso", "lvl": 3, "pa": 3, "type": "drain", "el": "e", "min": 7, "max": 10, "cd": 0}, {"id": "cavalcade", "name": "Cavalcade", "lvl": 6, "pa": 4, "type": "dmg", "el": "a", "min": 13, "max": 18, "cd": 0}, {"id": "plastron", "name": "Plastron", "lvl": 9, "pa": 4, "type": "shield", "target": "allies", "pct": 10, "cd": 4}, {"id": "appui", "name": "Appui", "lvl": 11, "pa": 3, "type": "dmg", "el": "f", "min": 16, "max": 22, "cd": 2}, {"id": "ponteira", "name": "Ponteira", "lvl": 13, "pa": 3, "type": "dmg", "el": "e", "min": 11, "max": 15, "cd": 0}, {"id": "tortoruga", "name": "Tortoruga", "lvl": 17, "pa": 3, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "masque_du_psychopath", "name": "Masque du Psychopathe", "lvl": 21, "pa": 2, "type": "aoe", "el": "t", "min": 10, "max": 13, "cd": 2}, {"id": "transe", "name": "Transe", "lvl": 26, "pa": 3, "type": "shield", "target": "allies", "pct": 10, "cd": 4}, {"id": "furia", "name": "Furia", "lvl": 31, "pa": 3, "type": "dmg", "el": "t", "min": 15, "max": 20, "cd": 0}, {"id": "cabriole", "name": "Cabriole", "lvl": 36, "pa": 3, "type": "aoe", "el": "a", "min": 12, "max": 16, "cd": 0}]}, "steam": {"name": "Steamer", "color": "#2f6f8f", "main": "fo", "sex": "m", "desc": "Mécanicien : tourelles et dégâts Eau et Terre.", "passive": {"id": "marin", "name": "Loup de mer", "desc": "Pêche 25 % plus rapide."}, "spells": [{"id": "longue_vue", "name": "Longue-vue", "lvl": 1, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 12, "cd": 0}, {"id": "amarrage", "name": "Amarrage", "lvl": 1, "pa": 2, "type": "dmg", "el": "t", "min": 6, "max": 8, "cd": 0}, {"id": "torpille", "name": "Torpille", "lvl": 3, "pa": 3, "type": "dmg", "el": "a", "min": 9, "max": 13, "cd": 0}, {"id": "sabotage", "name": "Sabotage", "lvl": 6, "pa": 3, "type": "aoe", "el": "f", "min": 7, "max": 10, "cd": 0}, {"id": "evolution", "name": "Évolution", "lvl": 9, "pa": 2, "type": "heal", "min": 8, "max": 10, "cd": 0}, {"id": "harponneuse", "name": "Harponneuse", "lvl": 11, "pa": 2, "type": "drain", "el": "t", "min": 10, "max": 14, "cd": 3}, {"id": "maree", "name": "Marée", "lvl": 13, "pa": 3, "type": "dmg", "el": "e", "min": 11, "max": 15, "cd": 0}, {"id": "gardienne", "name": "Gardienne", "lvl": 17, "pa": 2, "type": "heal", "min": 15, "max": 21, "cd": 3}, {"id": "turbine", "name": "Turbine", "lvl": 21, "pa": 3, "type": "aoe", "el": "f", "min": 10, "max": 13, "cd": 0}, {"id": "scaphandre", "name": "Scaphandre", "lvl": 26, "pa": 3, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "foene", "name": "Foène", "lvl": 31, "pa": 3, "type": "aoe", "el": "a", "min": 11, "max": 15, "cd": 0}, {"id": "ressac", "name": "Ressac", "lvl": 36, "pa": 3, "type": "dmg", "el": "t", "min": 16, "max": 21, "cd": 0}]}, "elio": {"name": "Eliotrope", "color": "#5fb5b5", "main": "age", "sex": "f", "desc": "Voyageur des portails : dégâts en zone amplifiés.", "passive": {"id": "portails", "name": "Portails", "desc": "+15 % de dégâts avec les sorts de zone."}, "spells": [{"id": "audace", "name": "Audace", "lvl": 1, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 12, "cd": 0}, {"id": "portail", "name": "Portail", "lvl": 1, "pa": 2, "type": "dmg", "el": "a", "min": 6, "max": 8, "cd": 0}, {"id": "affront", "name": "Affront", "lvl": 3, "pa": 3, "type": "aoe", "el": "a", "min": 7, "max": 9, "cd": 0}, {"id": "commotion", "name": "Commotion", "lvl": 6, "pa": 3, "type": "aoe", "el": "t", "min": 7, "max": 10, "cd": 0}, {"id": "cicatrisation", "name": "Cicatrisation", "lvl": 9, "pa": 3, "type": "healall", "min": 6, "max": 8, "cd": 2}, {"id": "rayon_de_wakfu", "name": "Rayon de Wakfu", "lvl": 11, "pa": 3, "type": "aoe", "el": "f", "min": 8, "max": 11, "cd": 0}, {"id": "persiflage", "name": "Persiflage", "lvl": 13, "pa": 3, "type": "dmg", "el": "t", "min": 11, "max": 15, "cd": 0}, {"id": "cabale", "name": "Cabale", "lvl": 17, "pa": 2, "type": "buff", "target": "allies", "pui": 30, "turns": 3, "cd": 4}, {"id": "outrage", "name": "Outrage", "lvl": 21, "pa": 3, "type": "dmg", "el": "f", "min": 13, "max": 17, "cd": 0}, {"id": "entraide", "name": "Entraide", "lvl": 26, "pa": 2, "type": "healall", "min": 10, "max": 14, "cd": 4}, {"id": "insolence", "name": "Insolence", "lvl": 31, "pa": 3, "type": "dmg", "el": "e", "min": 15, "max": 20, "cd": 0}, {"id": "brimade", "name": "Brimade", "lvl": 36, "pa": 3, "type": "aoe", "el": "a", "min": 12, "max": 16, "cd": 0}]}, "hupper": {"name": "Huppermage", "color": "#6a5acd", "main": "age", "sex": "m", "desc": "Mage élémentaire : bonus quand il varie ses éléments.", "passive": {"id": "runes", "name": "Runes élémentaires", "desc": "+10 % de dégâts quand il change d'élément d'un sort à l'autre."}, "spells": [{"id": "ether", "name": "Éther", "lvl": 1, "pa": 3, "type": "dmg", "el": "a", "min": 9, "max": 12, "cd": 0}, {"id": "onde_sismique", "name": "Onde Sismique", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "lance_flamme", "name": "Lance-flamme", "lvl": 3, "pa": 3, "type": "dmg", "el": "f", "min": 9, "max": 13, "cd": 0}, {"id": "stalagmite", "name": "Stalagmite", "lvl": 6, "pa": 3, "type": "dmg", "el": "e", "min": 10, "max": 13, "cd": 0}, {"id": "runification", "name": "Runification", "lvl": 9, "pa": 2, "type": "heal", "min": 8, "max": 10, "cd": 0}, {"id": "meteore", "name": "Météore", "lvl": 11, "pa": 3, "type": "dmg", "el": "t", "min": 11, "max": 15, "cd": 0}, {"id": "lame_astrale", "name": "Lame Astrale", "lvl": 13, "pa": 3, "type": "dmg", "el": "a", "min": 11, "max": 15, "cd": 0}, {"id": "contribution", "name": "Contribution", "lvl": 17, "pa": 2, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "lance_solaire", "name": "Lance Solaire", "lvl": 21, "pa": 3, "type": "dmg", "el": "f", "min": 13, "max": 17, "cd": 0}, {"id": "bouclier_elementaire", "name": "Bouclier Élémentaire", "lvl": 26, "pa": 2, "type": "shield", "target": "self", "pct": 20, "cd": 4}, {"id": "deluge", "name": "Déluge", "lvl": 31, "pa": 3, "type": "dmg", "el": "e", "min": 15, "max": 20, "cd": 0}, {"id": "traversee", "name": "Traversée", "lvl": 36, "pa": 3, "type": "aoe", "el": "a", "min": 17, "max": 24, "cd": 2}]}, "ougi": {"name": "Ouginak", "color": "#8a6a3a", "main": "fo", "sex": "m", "desc": "Chasseur : s'acharne sur sa proie.", "passive": {"id": "proie", "name": "Proie", "desc": "+5 % de dégâts par coup sur la même cible (max +25 %), +20 % de viandes."}, "spells": [{"id": "molosse", "name": "Molosse", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 0}, {"id": "os_a_moelle", "name": "Os à Moelle", "lvl": 1, "pa": 3, "type": "dmg", "el": "e", "min": 9, "max": 12, "cd": 0}, {"id": "charogne", "name": "Charogne", "lvl": 3, "pa": 3, "type": "dmg", "el": "a", "min": 9, "max": 13, "cd": 0}, {"id": "traque", "name": "Traque", "lvl": 6, "pa": 3, "type": "dmg", "el": "f", "min": 10, "max": 13, "cd": 0}, {"id": "arcanin", "name": "Arcanin", "lvl": 9, "pa": 2, "type": "buff", "target": "self", "pui": 40, "turns": 3, "cd": 4}, {"id": "proie", "name": "Proie", "lvl": 11, "pa": 2, "type": "dmg", "el": "t", "min": 9, "max": 12, "cd": 1}, {"id": "lance_roquet", "name": "Lance-roquet", "lvl": 13, "pa": 3, "type": "poison", "el": "n", "turns": 3, "min": 10, "max": 14, "cd": 4}, {"id": "apaisement", "name": "Apaisement", "lvl": 17, "pa": 3, "type": "heal", "min": 20, "max": 27, "cd": 2}, {"id": "amarok", "name": "Amarok", "lvl": 21, "pa": 3, "type": "aoe", "el": "t", "min": 10, "max": 13, "cd": 0}, {"id": "cubitus", "name": "Cubitus", "lvl": 26, "pa": 2, "type": "drain", "el": "e", "min": 7, "max": 10, "cd": 0}, {"id": "rabattage", "name": "Rabattage", "lvl": 31, "pa": 3, "type": "drain", "el": "f", "min": 12, "max": 16, "cd": 0}, {"id": "carcasse", "name": "Carcasse", "lvl": 36, "pa": 2, "type": "dmg", "el": "a", "min": 10, "max": 14, "cd": 0}]}, "forge": {"name": "Forgelance", "color": "#9a7a4a", "main": "fo", "sex": "m", "desc": "Lancier : spécialiste des boss.", "passive": {"id": "perce", "name": "Perce-armure", "desc": "Ignore 50 % des résistances des boss."}, "spells": [{"id": "charge_heroique", "name": "Charge Héroïque", "lvl": 1, "pa": 3, "type": "dmg", "el": "t", "min": 13, "max": 18, "cd": 2}, {"id": "javeline_de_myr", "name": "Javeline de Myr", "lvl": 1, "pa": 3, "type": "dmg", "el": "a", "min": 9, "max": 12, "cd": 0}, {"id": "trident_de_la_mer", "name": "Trident de la Mer", "lvl": 3, "pa": 3, "type": "aoe", "el": "e", "min": 7, "max": 9, "cd": 0}, {"id": "effondrement", "name": "Effondrement", "lvl": 6, "pa": 3, "type": "aoe", "el": "t", "min": 7, "max": 10, "cd": 0}, {"id": "phalange", "name": "Phalange", "lvl": 9, "pa": 3, "type": "shield", "target": "allies", "pct": 10, "cd": 4}, {"id": "estoc_brulant", "name": "Estoc Brûlant", "lvl": 11, "pa": 3, "type": "aoe", "el": "f", "min": 8, "max": 11, "cd": 0}, {"id": "volee_d_airain", "name": "Volée d'Airain", "lvl": 13, "pa": 3, "type": "aoe", "el": "a", "min": 8, "max": 11, "cd": 0}, {"id": "chevalerie", "name": "Chevalerie", "lvl": 17, "pa": 2, "type": "healall", "min": 8, "max": 10, "cd": 3}, {"id": "lance_du_lac", "name": "Lance du Lac", "lvl": 21, "pa": 3, "type": "aoe", "el": "e", "min": 10, "max": 13, "cd": 0}, {"id": "eclipse", "name": "Éclipse", "lvl": 26, "pa": 5, "type": "shield", "target": "allies", "pct": 10, "cd": 4}, {"id": "lance_pierre", "name": "Lance-pierre", "lvl": 31, "pa": 3, "type": "aoe", "el": "t", "min": 11, "max": 15, "cd": 0}, {"id": "lance_a_incendie", "name": "Lance à Incendie", "lvl": 36, "pa": 3, "type": "aoe", "el": "f", "min": 12, "max": 16, "cd": 0}]}};
  Object.assign(CLASSES, EXTRA_CLASSES);
  // ajustements d'équilibrage des kits simplifiés (simulation sur 8 h)
  Object.entries({ panda: 1.22, forge: 1.22, roub: 1.14, zobal: 1.14, elio: 1.2, enu: 1.1, eni: 1.05 }).forEach(([k, v]) => (CLASSES[k].pow = v));
  const CLASS_ORDER = ["feca", "osa", "enu", "sram", "xelor", "eca", "eni", "iop", "cra", "sadi", "sacri", "panda", "roub", "zobal", "steam", "elio", "hupper", "ougi", "forge"];

  const CONDITIONS = {
    always:      "Toujours",
    first_turn:  "Au premier tour",
    ally_low:    "Si un allié < 60 % PV",
    self_low:    "Si mes PV < 50 %",
    enemy_many:  "Si 3 ennemis ou plus",
    enemy_one:   "S'il reste 1 seul ennemi",
    boss:        "Contre un boss",
  };

  /* ---------- Métiers ---------- */
  const GATHER_NAMES = { paysan: "Paysan", bucheron: "Bûcheron", mineur: "Mineur", alchimiste: "Alchimiste", pecheur: "Pêcheur" };
  const GATHER_JOBS = {};
  for (const j in G.GATHER_JOBS) GATHER_JOBS[j] = { name: GATHER_NAMES[j] || j, items: G.GATHER_JOBS[j] };
  const CRAFT_JOBS = {
    tailleur:   { name: "Tailleur",   slots: ["coiffe", "cape"] },
    bijoutier:  { name: "Bijoutier",  slots: ["amulette", "anneau"] },
    cordonnier: { name: "Cordonnier", slots: ["ceinture", "bottes"] },
    forgeron:   { name: "Forgeron",   slots: ["arme"] },
    sculpteur:  { name: "Sculpteur",  slots: ["arme"] },
    faconneur:  { name: "Façonneur",  slots: ["bouclier"] },
    bricoleur:  { name: "Bricoleur",  slots: ["cle"] },
  };

  const SLOTS = {
    coiffe: "Coiffe", cape: "Cape", amulette: "Amulette", anneau1: "Anneau", anneau2: "Anneau",
    ceinture: "Ceinture", bottes: "Bottes", arme: "Arme", bouclier: "Bouclier",
    dofus1: "Dofus / Trophée", dofus2: "Dofus / Trophée", dofus3: "Dofus / Trophée", dofus4: "Dofus / Trophée", dofus5: "Dofus / Trophée", dofus6: "Dofus / Trophée",
  };
  const DOFUS_SLOTS = ["dofus1", "dofus2", "dofus3", "dofus4", "dofus5", "dofus6"];

  /* ---------- Contenu DOFUS (généré) ---------- */
  const MONSTERS = G.MONSTERS;
  for (const k in MONSTERS) {
    const m = MONSTERS[k];
    if (m.dmg === undefined) m.dmg = 1;
    if (!m.items) m.items = [];
  }
  const ZONES = G.ZONES, DUNGEONS = G.DUNGEONS, ITEMS = G.ITEMS, SETS = G.SETS, SPECIAL_CRAFTS = G.SPECIAL_CRAFTS;
  const RES = G.RES, SPELL_IMG = G.SPELL_IMG, HEADS = G.HEADS, RACES = G.RACES || {}, HARVEST = G.HARVEST || {};

  /* nombre de pièces par panoplie */
  for (const k in ITEMS) { const sid = ITEMS[k].set; if (sid && SETS[sid]) SETS[sid].size = (SETS[sid].size || 0) + 1; }

  /* ---------- Trophées de sous-zone (paliers de chasse) ---------- */
  ZONES.forEach((z) => z.subs.forEach((s) => {
    const l = s.lvl[0];
    ITEMS["trophee_" + s.id] = { name: "Trophée : " + s.name, slot: "dofus", lvl: Math.max(1, l), trophy: s.id, mimg: MONSTERS[s.monsters[0]].img,
      stats: { vit: [10 + Math.round(l * 1.5), 10 + Math.round(l * 1.5)], sa: [2 + Math.round(l / 5), 2 + Math.round(l / 5)] } };
  }));

  /* ---------- Paliers de chasse ---------- */
  const HUNT_TIERS = [
    { id: "connaisseur", n: 50,   name: "Connaisseur", desc: "Butins et taux révélés dans l'encyclopédie" },
    { id: "traqueur",    n: 250,  name: "Traqueur",    desc: "+5 % de butin sur ce monstre" },
    { id: "expert",      n: 1000, name: "Expert",      desc: "+10 % de dégâts contre sa famille" },
    { id: "fleau",       n: 5000, name: "Fléau",       desc: "Chances de son archimonstre ×2" },
  ];

  /* ---------- Consommables ---------- */
  const CONSUMABLES = {
    bonbon_sagesse: { name: "Bonbon Sagesse", boost: "xp", pct: 10, dur: 3600, desc: "+10 % d'expérience pendant 1 h. Les durées s'additionnent (8 h maximum).", src: "2 % sur les boss de donjon" },
  };

  /* ---------- Emblème du Solitaire ---------- */
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

  const FREE_SPIRIT = { 1: 100, 2: 80, 3: 60, 4: 40, 5: 25, 6: 15, 7: 5, 8: 0 };
  const NAMES = ["Goultard", "Tristepin", "Évangelyne", "Amalia", "Ruel", "Kerubim", "Grougaloragran", "Lou", "Joris", "Atcham", "Yugo", "Bakara", "Otomaï", "Dally", "Simone", "Toross"];

  /* Explications des caractéristiques (infobulles) */
  const STAT_HELP = {
    vit: "+1 point de vie par point.",
    sa: "+1 % d'expérience gagnée par point.",
    fo: "+1 % de dégâts Terre et Neutre par point, +1 Initiative.",
    ine: "+1 % de dégâts Feu et +1 % de soins par point, +1 Initiative.",
    cha: "+1 % de dégâts Eau par point, +1 Initiative.",
    age: "+1 % de dégâts Air par point, +1 Initiative.",
    pui: "+1 % de dégâts dans tous les éléments et +1 % de soins par point.",
    do: "+1 dégât fixe ajouté à chaque attaque.",
    cri: "+1 % de chances de coup critique (base 5 %, maximum 60 %). Un critique inflige ×1,3 +3 dégâts.",
    so: "+1 soin fixe ajouté à chaque soin.",
    pp: "+1 % de chances de butin par point. La Prospection de toute l'équipe s'additionne.",
    ini: "Détermine l'ordre de jeu : le plus haut joue en premier.",
    pa: "Points d'action disponibles à chaque tour pour lancer des sorts (12 maximum).",
    rt: "Réduit les dégâts Terre reçus de 1 % par point (50 % maximum).",
    rf: "Réduit les dégâts Feu reçus de 1 % par point (50 % maximum).",
    re: "Réduit les dégâts Eau reçus de 1 % par point (50 % maximum).",
    ra: "Réduit les dégâts Air reçus de 1 % par point (50 % maximum).",
    hpMax: "Points de vie : 50 + 5 par niveau + Vitalité (+5 par famille de monstres complétée).",
  };

  const DATA = { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, RUNE_TIERS, RUNE_SIMPLE_ONLY, CLASSES, CLASS_ORDER, CONDITIONS, GATHER_JOBS, CRAFT_JOBS, SLOTS, DOFUS_SLOTS,
                 MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, RACES, HARVEST, SPELL_IMG, HEADS, EMBLEM, FREE_SPIRIT, NAMES, HUNT_TIERS, CONSUMABLES, STAT_HELP, META: G.META };
  root.DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof window !== "undefined" ? window : globalThis);
