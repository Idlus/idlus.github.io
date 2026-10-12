/* ============================================================================
   DONNÉES DU JEU — Idlus (v2)
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
    rn:  { name: "% Rés. Neutre",   short: "Ré Neu",   w: 6, pts: 1 },
    dcri:{ name: "Dommages critiques", short: "Do Cri", w: 5, pts: 1 },
    dt:  { name: "Dommages Terre",  short: "Do Ter",   w: 5, pts: 1 },
    df:  { name: "Dommages Feu",    short: "Do Feu",   w: 5, pts: 1 },
    de:  { name: "Dommages Eau",    short: "Do Eau",   w: 5, pts: 1 },
    da:  { name: "Dommages Air",    short: "Do Air",   w: 5, pts: 1 },
    dn:  { name: "Dommages Neutre", short: "Do Neu",   w: 5, pts: 1 },
    xt:  { name: "Rés. Terre fixe", short: "Rf Ter",   w: 2, pts: 1 },
    xf:  { name: "Rés. Feu fixe",   short: "Rf Feu",   w: 2, pts: 1 },
    xe:  { name: "Rés. Eau fixe",   short: "Rf Eau",   w: 2, pts: 1 },
    xa:  { name: "Rés. Air fixe",   short: "Rf Air",   w: 2, pts: 1 },
    xn:  { name: "Rés. Neutre fixe",short: "Rf Neu",   w: 2, pts: 1 },
    dsort:{ name: "% Dommages aux sorts", short: "% Do Sorts", w: 15, pts: 1 },
    /* 0.1.8 : stats tactiques (familiers et montiliers) ; hors STAT_ORDER, affichées seulement quand on en a */
    tac: { name: "Tacle",      short: "Tacle", w: 2, pts: 1 },
    fui: { name: "Fuite",      short: "Fuite", w: 2, pts: 1 },
    pm:  { name: "PM",         short: "PM",    w: 60, pts: 1 },
    po:  { name: "Portée",     short: "Po",    w: 50, pts: 1 }, /* 0.1.9.1 : seulement par forgemagie exotique */
    rpa: { name: "Retrait PA", short: "Ret PA", w: 2, pts: 1 },
    rpm: { name: "Retrait PM", short: "Ret PM", w: 2, pts: 1 },
    epa: { name: "Esquive PA", short: "Esq PA", w: 2, pts: 1 },
    epm: { name: "Esquive PM", short: "Esq PM", w: 2, pts: 1 },
    inv: { name: "Invocation", short: "Invoc", w: 60, pts: 1 },
    pod: { name: "Pods",       short: "Pods",  w: 0.1, pts: 1 },
  };
  const TACT_ORDER = ["pm","po","tac","fui","rpa","rpm","epa","epm","inv","pod"];
  const STAT_ORDER = ["vit","sa","fo","ine","cha","age","pui","do","cri","dcri","dt","df","de","da","dn","dsort","so","pp","ini","pa","rt","rf","re","ra","rn","xt","xf","xe","xa","xn"];
  const BASE_STATS = ["vit","sa","fo","ine","cha","age"];

  const ELEMENTS = {
    n: { name: "Neutre", stat: "fo",  res: "rn", dmg: "dn", fix: "xn" },
    t: { name: "Terre",  stat: "fo",  res: "rt", dmg: "dt", fix: "xt" },
    f: { name: "Feu",    stat: "ine", res: "rf", dmg: "df", fix: "xf" },
    e: { name: "Eau",    stat: "cha", res: "re", dmg: "de", fix: "xe" },
    a: { name: "Air",    stat: "age", res: "ra", dmg: "da", fix: "xa" },
  };

  const RUNE_TIERS = [
    { key: "",   label: "Rune",    mult: 1 },
    { key: "pa", label: "Pa Rune", mult: 3 },
    { key: "ra", label: "Ra Rune", mult: 10 },
    { key: "ga", label: "Ga Rune", mult: 1 }, /* 0.1.9.1 : rune exotique (PA, PM, Portée), +1 sur un objet qui n'a pas la caractéristique */
  ];
  const RUNE_SIMPLE_ONLY = ["pa", "do", "cri", "so", "rt", "rf", "re", "ra", "rn", "dcri", "dt", "df", "de", "da", "dn", "xt", "xf", "xe", "xa", "xn", "dsort"];

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
  /* ---------- v3 : vrais kits de DOFUS 3 (22 paires sort / variante par classe, DofusDB) ----------
     Chaque sort a des grades (niveau requis, PA, relance, effets). Le joueur équipe l'un OU l'autre sort d'une paire. */
  const SIGNATURE = {
    iop: "Colère : chaque sort lancé ajoute 1 charge (max 6). À 6 charges, la prochaine attaque inflige +40 % de dégâts et vide la jauge. Vigueur : vole 8 % des dégâts infligés. +10 % de dégâts contre les boss.",
    cra: "Distance : +40 % de dégâts au tour 1, puis −10 % par tour (+30 % au tour 2, +20 % au tour 3, +10 % au tour 4, plus rien ensuite). Œil de lynx : joue en premier au tour 1, et ses attaques à cible unique marquent la cible (+10 % de dégâts subis pendant 2 tours).",
    eni: "Mots liés : un soin rend la prochaine attaque 15 % plus forte, une attaque rend le prochain soin 15 % plus fort. Soins +10 %.",
    feca: "Glyphes : au début de chacun de ses tours, pose un glyphe pour toute l'équipe jusqu'à son tour suivant, dans cet ordre : Protection (−10 % de dégâts subis), Renvoi (15 % des dégâts reçus renvoyés à l'attaquant), Soin (chaque allié récupère 3 % de ses PV max). Boucliers +25 %.",
    osa: "Dressage : jusqu'à 2 invocations à la fois, avec +30 % de PV ; elles gagnent la moitié de la Puissance et des Dommages de l'Osamodas. +5 % de PV pour toute l'équipe.",
    enu: "Pelle : ses attaques à cible unique ont 10 % de chances de retirer 1 PA (une fois par monstre et par tour). Trésors : chaque monstre qu'il achève a 15 % de chances de laisser une ressource en plus. Chercheur : +15 % de butin et de kamas pour l'équipe (ne se cumule pas entre plusieurs Enutrof).",
    sram: "Larcin : poisons et pièges +25 %, et 10 % de chances par monstre de tirer son butin une seconde fois.",
    xelor: "Horloge : chaque sort lancé avance l'horloge d'1 heure. À 12 heures, elle sonne : tous les alliés gagnent 1 PA à leur prochain tour et leurs sorts se rechargent 1 tour plus vite. L'horloge repart à zéro.",
    eca: "Roulette : au début de chaque combat, la roue tourne pour toute l'équipe : Pile (40 %) +20 % de dégâts, Face (40 %) +15 % de soins et de boucliers, Jackpot (10 %) butin ×2, Perdu (10 %) −5 % de dégâts. Chanceux : archimonstres et objets Rayonnants ×1,5.",
    sadi: "Ronces : ses poisons s'empilent jusqu'à 3 fois sur une même cible. Arbre : tant qu'une de ses invocations est en vie, elle attire 50 % des attaques des monstres.",
    sacri: "Souffrance : +2 % de dégâts par coup reçu pendant le combat (jusqu'à +30 %), et jusqu'à +30 % de dégâts quand ses PV baissent.",
    panda: "Ivresse : chaque sort ajoute 1 niveau d'ivresse (max 5). Chaque niveau donne +6 % de dégâts mais 3 % de chances de rater son attaque. À 5 niveaux, après son tour, le Pandawa cuve : il passe son tour suivant et l'ivresse retombe à 0. Consommables 25 % plus longs.",
    roub: "Artificier : sorts de zone et poisons +15 %, et +15 % de dégâts contre les groupes de 4 monstres ou plus.",
    zobal: "Masques : change de masque au début de son tour selon la situation : Psychopathe (+30 % de dégâts) par défaut, Pleutre (−20 % de dégâts subis) sous 45 % de PV, Hystérique (soigne toute l'équipe de 4 % par tour) quand un allié a moins de 50 % de PV.",
    steam: "Tourelles : ses invocations font +40 % de dégâts et les monstres les ciblent rarement.",
    elio: "Portails : +25 % de dégâts avec les sorts de zone ; le premier sort de zone de chaque tour donne un bouclier de 8 % de ses PV. Vole 10 % des dégâts infligés.",
    hupper: "Runes : +10 % de dégâts en changeant d'élément ; après avoir utilisé les 4 éléments, le sort suivant fait +30 %.",
    ougi: "Proie : +5 % de dégâts par coup porté à la même cible (max +25 %), remis à zéro en changeant de cible. +20 % de viandes récoltées.",
    forge: "Postures : au début de son tour, Lance si ses PV dépassent 50 % (+20 % de dégâts, ignore 50 % des résistances des boss), sinon Rempart (−25 % de dégâts subis, chaque attaque lui donne un bouclier de 5 % de ses PV).",
  };

  /* lignes identiques dans plusieurs éléments (ex. Huppermage, sorts « meilleur élément ») : une seule ligne dans le meilleur élément du lanceur */
  /* Nettoyage des lignes d'effets : DofusDB liste souvent des variantes (aléatoires ou conditionnelles) d'un même effet.
     - même valeur dans plusieurs éléments → une ligne « meilleur élément »
     - même élément (ou même stat) avec des valeurs différentes → une seule ligne moyenne */
  const collapseEl = (g) => {
    const out = []; const byVal = {}; const byKind = {};
    const avg = (a, b, w) => Math.round((a * w + b) / (w + 1));
    g.fx.forEach((f) => {
      if (["dmg", "drain", "dot"].includes(f.k) && f.el) {
        const kv = [f.k, f.min, f.max, f.n, f.t || 0].join("|");
        if (byVal[kv] && byVal[kv].el !== f.el) { byVal[kv].el = "best"; return; }
        const kk = f.k + "|" + f.el;
        if (byKind[kk]) { const c = byKind[kk]; c.min = avg(c.min, f.min, c._w); c.max = avg(c.max, f.max, c._w); c.n = Math.max(c.n || 1, f.n || 1); c._w++; return; }
        const c = Object.assign({}, f, { _w: 1 }); byVal[kv] = c; byKind[kk] = c; out.push(c); return;
      }
      if (["heal", "shield", "buff", "healpct", "vuln", "weaken", "apdrain"].includes(f.k)) {
        const kk = f.k + "|" + (f.st || "") + "|" + (f.self ? 1 : 0);
        if (byKind[kk]) { const c = byKind[kk]; ["min", "max", "pct", "v"].forEach((x) => { if (f[x] !== undefined && c[x] !== undefined) c[x] = avg(c[x], f[x], c._w); }); c._w++; return; }
        const c = Object.assign({}, f, { _w: 1 }); byKind[kk] = c; out.push(c); return;
      }
      out.push(f);
    });
    out.forEach((f) => delete f._w);
    // 3 éléments ou plus : élément aléatoire / au choix → une ligne « meilleur élément » moyenne
    ["dmg", "drain"].forEach((k) => {
      const ls = out.filter((f) => f.k === k && f.el && f.el !== "n");
      const els = new Set(ls.map((f) => f.el));
      if (!(els.size >= 3 || (els.has("best") && ls.length >= 2))) return;
      const m = Object.assign({}, ls[0], { el: "best", min: Math.round(ls.reduce((a, f) => a + f.min, 0) / ls.length), max: Math.round(ls.reduce((a, f) => a + f.max, 0) / ls.length), n: Math.max(...ls.map((f) => f.n || 1)) });
      const i = out.indexOf(ls[0]); ls.forEach((f) => out.splice(out.indexOf(f), 1)); out.splice(i, 0, m);
    });
    g.fx = out; return g;
  };
  /* 3.0.1 : effets « de repli » (placement, états…) remplacés par un effet adapté au rôle du sort, qui évolue avec son niveau */
  const ADAPT = {
    pui: ["Tirs Éloignés", "Neutral", "Transcendance", "Cycle Élémentaire", "Polarité", "Kyrja", "Vajra", "Crépuscule", "Étreinte de Valkyr", "Holmgang", "Masque de l'Hystérique", "Violence", "Vindicte", "Massacre", "Concentration de Chakra", "Poudre", "Pandanlku", "Harmonie", "Fluctuation", "Rituel de Jashin", "Folie Sanguinaire", "Courant Quadramental", "Tarot d'Ecaflip", "Mot de Solidarité", "Décadence", "Instabilité"],
    puiAll: ["Cortège Sauvage", "Appel de la Meute", "Communion Animale", "Boîte à Outils", "Liens du Sang", "Comédie"],
    do: ["Bond", "Déambulation", "Odyssée", "Sillage", "Résonance", "Propagation", "Téléportation", "Bond du Félin", "Entrechat", "Attirance", "Transposition", "Détonateur", "Étoupille", "Aimantation", "Kaboom", "Croisement", "Masque du Psychopathe", "Débandade", "Aspiration", "Plongée", "Piston", "Submersion", "Aiguillage", "Récursivité", "Berserk", "Pivot", "Exode", "Exil", "Gangrène", "Poursuite", "Acharnement", "Nouvelle Lune", "Prédation", "Coup pour Coup", "Duel", "Varappe", "Brassage", "Armadur", "Transfiguration", "Piège Magnétique", "Imposture", "Empreinte", "Convection", "Répulsion Runique", "Sentinelle", "Vendetta", "Fosse Commune", "Dérobade", "Excursion"],
    cri: ["Astrolabe", "Bonne Pioche", "Odorat", "Compas", "Boussole", "Convergence", "Pistage", "Flair", "Clef du Trésor", "Invisibilité", "Brume", "Tir Perçant", "Prémonition", "Espace-temps", "Faille"],
    pa: ["Précipitation", "Vingt-cinquième Heure", "Piqûre Motivante", "Picole", "Relais Spirituel"],
    shield: ["Pas Chassé", "Tir de Repli", "Mot d'Envol", "Rempart", "Fortification", "Renfort", "Bouclier Féca", "Masque du Pleutre", "Masque du Couard", "Karcham", "Chamrak", "Stabilisation", "Casemate", "Retraite Anticipée", "Bouclier Élémentaire", "Entourloupe", "Conservation", "Reuche", "Ataraxie", "Rémanence"],
    shieldAll: ["Vitalité", "Transhumance", "Bergerie", "Trêve", "Sacrifice", "Redistribution", "Laisse Spirituelle"],
    heal: ["Portail", "Errance", "Fougue", "Secourisme", "Perfusion", "Ronce Apaisante", "Proie", "Rémission", "Seconde Chance", "Fuite du Temps", "Rembobinage", "Bombance", "Lait de Bambou", "Prisme Runique", "Conjuration", "Prohibition", "Dernier Souffle"],
    healAll: ["Don Naturel", "Distribution", "Raulebaque"],
    weaken: ["Mot de Frayeur", "Peur", "Friction", "Épouvante", "Maladresse", "Panique", "Aboiement", "Momification", "Stupeur"],
    vuln: ["Gibier", "Souillure", "Flou Temporel"],
    apdrain: ["Emprise", "Interruption", "Paradoxe", "Désynchronisation", "Piège d'Immobilisation"],
  };
  const ADAPT_OF = {}; for (const k in ADAPT) ADAPT[k].forEach((n) => (ADAPT_OF[n] = k));
  const adaptFx = (kind, L) => {
    switch (kind) {
      case "pui": return [{ k: "buff", st: "pui", v: Math.round(25 + L * 0.6), t: 2 }];
      case "puiAll": return [{ k: "buff", st: "pui", v: Math.round(15 + L * 0.4), t: 2, all: true }];
      case "do": return [{ k: "buff", st: "do", v: Math.round(4 + L / 6), t: 2 }];
      case "cri": return [{ k: "buff", st: "cri", v: Math.round(8 + L / 15), t: 2 }];
      case "pa": return [{ k: "buff", st: "pa", v: L >= 60 ? 2 : 1 }];
      case "shield": return [{ k: "shield", pct: Math.round(10 + L / 12), t: 2 }];
      case "shieldAll": return [{ k: "shield", pct: Math.round(8 + L / 15), t: 2, all: true }];
      case "heal": return [{ k: "healpct", v: Math.round(8 + L / 15), n: 1 }];
      case "healAll": return [{ k: "healpct", v: Math.round(5 + L / 20), n: 9 }];
      case "weaken": return [{ k: "weaken", v: Math.round(15 + L / 10), t: 1, n: 1 }];
      case "vuln": return [{ k: "vuln", v: Math.round(10 + L / 12), t: 2, n: 1 }];
      case "apdrain": return [{ k: "apdrain", v: L >= 80 ? 2 : 1, n: 1 }];
    }
    return null;
  };
  const fixFallback = (sp) => {
    sp.grades.forEach((g) => {
      if (!g.fx.some((f) => f.fb)) return;
      const L = g.lvl; const kind = ADAPT_OF[sp.name];
      const dmgFb = g.fx.filter((f) => f.fb && ["dmg", "dot", "drain"].includes(f.k));
      if (dmgFb.length) { // dégâts « de repli » constants : mis à l'échelle du niveau
        dmgFb.forEach((f) => { const mn = Math.round((10 + L * 0.22) * (f.k === "dot" ? 0.6 : 1)); f.min = mn; f.max = mn + 4; delete f.fb; f.adapt = 1; });
      }
      if (kind) { const nf = adaptFx(kind, L); g.fx = g.fx.filter((f) => !f.fb).concat(nf.map((f) => Object.assign(f, { adapt: 1 }))); }
      else g.fx.forEach((f) => { if (f.fb && f.k === "buff" && f.st === "pui") { f.v = Math.round(20 + L * 0.5); f.t = 2; delete f.fb; f.adapt = 1; } else if (f.fb && f.k === "heal") { delete f.fb; f.k = "healpct"; f.v = Math.round(8 + L / 15); delete f.min; delete f.max; f.adapt = 1; } });
    });
  };
  const elOfGrade = (g) => { if (g.fx.some((x) => x.el === "best")) return "best"; const f = g.fx.find((x) => x.el && ["dmg", "drain", "dot"].includes(x.k)); return f ? f.el : null; };
  for (const cls in CLASSES) {
    const kit = (G.CLASS_KITS || {})[cls]; if (!kit) continue;
    const list = [];
    kit.forEach((pair, pi) => pair.forEach((sp, vi) => { if (!sp.grades.length) return; sp.grades.forEach(collapseEl); fixFallback(sp);
      list.push({ id: "s" + sp.id, name: sp.name, icon: sp.icon, desc: sp.desc, pair: pi, variant: vi === 1, lvl: sp.grades[0].lvl, grades: sp.grades, el: elOfGrade(sp.grades[sp.grades.length - 1]) }); }));
    // 3.0.2 : retouches de kits
    const tweak = (n, fn) => { const sp = list.find((x) => x.name === n); if (sp) fn(sp); };
    if (cls === "iop") tweak("Concentration", (sp) => sp.grades.forEach((g) => (g.casts = Math.min(g.casts || 2, 2))));
    if (cls === "cra") { tweak("Flèche Cinglante", (sp) => { sp.grades[0].lvl = 12; sp.lvl = 12; }); tweak("Flèche de Dispersion", (sp) => { sp.grades[0].lvl = 34; sp.lvl = 34; });
      // 0.1.12.4 : la Flèche Dévorante cumulait un vol de vie énorme et des dégâts de zone, bien au-dessus de tous les autres sorts
      [["Flèche Dévorante", 0.7]].forEach(([n, k]) => tweak(n, (sp) => sp.grades.forEach((g) => { g.fx = g.fx.filter((f) => f.k !== "drain"); g.fx.forEach((f) => { if (f.k === "dmg") { f.min = Math.round(f.min * k); f.max = Math.round(f.max * k); } }); }))); }
    // 0.1.12.4 : les pièges du Sram frappent dès qu'ils sont posés (avant : petit poison de repli, lent et faible)
    if (cls === "sram") list.forEach((sp) => sp.grades.forEach((g) => g.fx.forEach((f) => { if (f.k === "dot" && f.adapt) { f.k = "dmg"; f.min = Math.round(f.min / 0.6 * 0.8); f.max = f.min + 4; delete f.t; } })));
    CLASSES[cls].spells = list;
    // élément conseillé : celui dont les meilleurs sorts d'attaque (jusqu'au niveau 60) sont les plus forts
    const EL2ST = { t: "fo", f: "ine", e: "cha", a: "age" }; const sc = { t: [], f: [], e: [], a: [] };
    list.forEach((sp) => { if (sp.lvl > 60 || !sc[sp.el]) return; const g = sp.grades.filter((x) => x.lvl <= 60).pop() || sp.grades[0];
      const p = g.fx.reduce((s2, f) => s2 + (["dmg", "drain", "dot"].includes(f.k) ? ((f.min + f.max) / 2) * (f.n > 1 ? Math.min(f.n, 3) * 0.85 : 1) * (f.k === "dot" ? (f.t || 2) * 0.8 : 1) : 0), 0) / Math.max(1, g.pa);
      if (p > 0) sc[sp.el].push(p); });
    const val = (arr) => arr.sort((x, y) => y - x).slice(0, 3).reduce((s2, x, i) => s2 + x * (i < 3 ? 1 : 0), 0) + (arr.length >= 3 ? 0 : -5 * (3 - arr.length));
    const bestE = Object.keys(sc).sort((x, y) => val(sc[y]) - val(sc[x]))[0];
    CLASSES[cls].elRec = EL2ST[bestE];
    CLASSES[cls].signature = SIGNATURE[cls] || "";
    if (SIGNATURE[cls]) { const sig = SIGNATURE[cls]; const i = sig.indexOf(" : "); CLASSES[cls].passive = Object.assign({}, CLASSES[cls].passive, { name: sig.slice(0, i), desc: sig.charAt(i + 3).toUpperCase() + sig.slice(i + 4) }); }
  }
  const CLASS_ORDER = ["feca", "osa", "enu", "sram", "xelor", "eca", "eni", "iop", "cra", "sadi", "sacri", "panda", "roub", "zobal", "steam", "elio", "hupper", "ougi", "forge"];

  const CONDITIONS = {
    always:      "Toujours",
    first_turn:  "Au premier tour",
    ally_low:    "Si un allié < 60 % PV",
    self_low:    "Si mes PV < 50 %",
    enemy_many:  "Si 3 ennemis ou plus",
    enemy_one:   "S'il reste 1 seul ennemi",
    boss:        "Contre un boss",
    no_summon:   "Si je n'ai pas d'invocation",
    ally_shield: "Si un allié n'a pas de bouclier",
  };
  const TARGETS = { low: "PV les plus bas", high: "PV les plus hauts", boss: "Boss / le plus fort d'abord", mark: "Cible marquée ou vulnérable" };

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

  /* 3.0.1 : sous-zones de transition 68-86 (mêmes monstres, fenêtre de niveaux resserrée) */
  {
    const ADD = [
      ["koalaks", { id: "koa_bordure", name: "Bordure de Kaliptus", lvl: [68, 78], deco: "forest", monsters: ["m747", "m746", "m748"] }],
      ["koalaks", { id: "koa_pentes", name: "Pentes du Canyon", lvl: [76, 86], deco: "quarry", monsters: ["m746", "m751", "m752", "m785"] }],
      ["abraknyde", { id: "abr_oree", name: "Orée de la Forêt Sombre", lvl: [74, 82], deco: "forest", monsters: ["m254", "m253"] }],
    ];
    for (const [zid, sub] of ADD) {
      const z = G.ZONES.find((x) => x.id === zid || x.subs.some((s2) => s2.id === (zid === "abraknyde" ? "abr_sombre" : "koa_kaliptus")));
      if (!z || z.subs.some((s2) => s2.id === sub.id) || !sub.monsters.every((k) => G.MONSTERS[k])) continue;
      z.subs.push(sub); z.subs.sort((x, y) => x.lvl[0] - y.lvl[0] || x.lvl[1] - y.lvl[1]);
    }
  }
  /* récolte des sous-zones de transition : celle de la sous-zone d'origine */
  [["koa_bordure", "koa_kaliptus"], ["koa_pentes", "koa_canyon"], ["abr_oree", "abr_sombre"]].forEach(([n, o]) => { if (HARVEST[o] && !HARVEST[n]) HARVEST[n] = HARVEST[o]; });
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
  /* kind : boost (bonus temporaire) · util (effet immédiat ou automatique) · chest (coffre à ouvrir) */
  const CONSUMABLES = {
    bonbon_sagesse:    { name: "Bonbon Sagesse",     icon: "🍬", kind: "boost", boost: "xp",     pct: 10, dur: 3600, desc: "+10 % d'expérience pendant 1 h." },
    bonbon_prospecteur:{ name: "Bonbon Prospecteur", icon: "🍭", kind: "boost", boost: "drop",   pct: 10, dur: 3600, desc: "+10 % de butin pendant 1 h." },
    bonbon_dore:       { name: "Bonbon Doré",        icon: "🪙", kind: "boost", boost: "kamas",  pct: 15, dur: 3600, desc: "+15 % de kamas pendant 1 h." },
    bonbon_recolteur:  { name: "Bonbon Récolteur",   icon: "🌾", kind: "boost", boost: "gather", pct: 15, dur: 3600, desc: "+15 % de vitesse de récolte pendant 1 h." },
    bonbon_traqueur:   { name: "Bonbon Traqueur",    icon: "🎯", kind: "boost", boost: "archi",  pct: 50, dur: 1800, desc: "Chances d'archimonstre ×1,5 pendant 30 min." },
    bonbon_royal:      { name: "Bonbon Royal",       icon: "👑", kind: "boost", boost: "royal",  pct: 10, dur: 1800, desc: "+10 % d'expérience, de butin et de kamas pendant 30 min." },
    fiole_resu:        { name: "Fiole de Résurrection", icon: "🧪", kind: "util", auto: true, desc: "Automatique : en donjon, une défaite ne fait pas perdre la clé, l'équipe recommence la salle (une fois par donjon)." },
    potion_savoir:     { name: "Potion de Savoir",   icon: "📘", kind: "util", desc: "Donne environ un niveau d'expérience au métier de récolte de votre choix (au moins 25 % d'un niveau)." },
    parchemin_avis:    { name: "Parchemin d'Avis",   icon: "📜", kind: "util", auto: true, desc: "Utilisé automatiquement quand vous changez un avis de recherche : le changement est gratuit." },
    cristal_fm:        { name: "Cristal de Forgemagie", icon: "💎", kind: "util", desc: "La prochaine forgemagie ne peut pas faire baisser une autre caractéristique." },
    filet:             { name: "Filet de capture", icon: "🪢", kind: "util", auto: true, desc: "Automatique : en chassant dans une zone de montures sauvages, chaque victoire peut capturer une monture. Le filet n'est utilisé que si la capture réussit." },
    coffre_bois:       { name: "Coffre en bois",     icon: "📦", kind: "chest", tier: 0, desc: "Quelques ressources et des kamas." },
    coffre_argent:     { name: "Coffre en argent",   icon: "🎁", kind: "chest", tier: 1, desc: "Ressources, kamas et un consommable." },
    coffre_or:         { name: "Coffre en or",       icon: "💰", kind: "chest", tier: 2, desc: "Beaucoup de ressources, de kamas et un consommable rare." },
  };
  /* 3.1 : parchemins de caractéristiques (Petit +1, Grand +3), jusqu'à +100 par caractéristique et par héros */
  [["fo", "Force"], ["ine", "Intelligence"], ["cha", "Chance"], ["age", "Agilité"], ["vit", "Vitalité"], ["sa", "Sagesse"]].forEach(([k, n]) => {
    CONSUMABLES["parch_" + k + "_p"] = { name: "Petit parchemin de " + n, icon: "📜", kind: "scroll", stat: k, v: 1, desc: `+1 ${n} définitif pour un héros (jusqu'à +100 par parchemins). Ne compte pas dans les paliers de points.` };
    CONSUMABLES["parch_" + k + "_g"] = { name: "Grand parchemin de " + n, icon: "📜", kind: "scroll", stat: k, v: 3, desc: `+3 ${n} définitif pour un héros (jusqu'à +100 par parchemins). Ne compte pas dans les paliers de points.` };
  });
  /* Catégories du sac (types d'objets DOFUS) */
  const RES_CATS = [
    { id: "bois", name: "Bois", icon: "🪵", types: [38, 96, 98, 185, 95] },
    { id: "minerai", name: "Minerais", icon: "⛏", types: [39, 40, 50, 51, 152] },
    { id: "plante", name: "Plantes", icon: "🌿", types: [35, 36, 46, 58, 68, 108, 119] },
    { id: "cereale", name: "Céréales", icon: "🌾", types: [34, 52] },
    { id: "poisson", name: "Poissons", icon: "🐟", types: [41] },
    { id: "peau", name: "Peaux & cuirs", icon: "🟫", types: [59, 56] },
    { id: "laine", name: "Laines & poils", icon: "🧶", types: [57, 54, 55, 61, 53] },
    { id: "os", name: "Os & carapaces", icon: "🦴", types: [47, 107, 111] },
    { id: "viande", name: "Viandes", icon: "🍖", types: [63, 69] },
    { id: "corps", name: "Yeux, ailes, pattes…", icon: "👁", types: [109, 106, 103, 104, 65, 105] },
    { id: "essence", name: "Essences & liquides", icon: "🧪", types: [110, 48, 60, 70, 71, 66, 229, 228] },
    { id: "cle", name: "Clés", icon: "🗝", types: [84] },
    { id: "rare", name: "Composants rares", icon: "✨", types: [-2] },
    { id: "divers", name: "Divers", icon: "📦", types: [] },
  ];
  /* 0.1 : le niveau maximum est 200 (DofusDB donne des grades 220 aux boss et monstres des donjons de niveau 200) */
  {
    const cap = (v) => Math.min(200, v);
    // 0.1.12.5 : le Tynril Ahuri résistait à 50 % (plafond) au Feu, à l'Eau et à l'Air en plus de ses « Quatre humeurs » : seules les humeurs restent
    if (G.MONSTERS.m1087) G.MONSTERS.m1087.res = {};
    // 0.1.12.5 : Kankreblath frappait toute l'équipe à chaque tour (Blathération sans temps de recharge)
    if (G.MONSTERS.m3945) (G.MONSTERS.m3945.sp || []).forEach((sp) => { if (sp.n === "Blathération") sp.cd = Math.max(sp.cd || 0, 1); });
    for (const k in G.MONSTERS) { const m = G.MONSTERS[k]; if (m.lvl && m.lvl[1] > 200) m.lvl = [cap(m.lvl[0]), cap(m.lvl[1])]; }
    for (const k in G.DUNGEONS) { const d = G.DUNGEONS[k]; d.lvl = cap(d.lvl); (d.rooms || []).forEach((r) => { r.lvl = cap(r.lvl); }); }
    /* une sous-zone peut donner accès à plusieurs donjons (ex. Labyrinthe du Minotoror et Salle du Minotot) */
    G.ZONES.forEach((z) => z.subs.forEach((s) => { const ds = Object.keys(G.DUNGEONS).filter((d) => G.DUNGEONS[d].access === s.id).sort((a, b) => G.DUNGEONS[a].lvl - G.DUNGEONS[b].lvl);
      if (s.dungeon && !ds.includes(s.dungeon)) ds.unshift(s.dungeon); if (ds.length) { s.dungeons = ds; s.dungeon = ds[0]; } }));
    G.ZONES.forEach((z) => { z.subs.forEach((s) => { if (s.lvl[1] > 200) s.lvl = [cap(s.lvl[0]), 200]; }); if (typeof z.lvl === "string") z.lvl = z.lvl.replace(/\d+/g, (n) => cap(+n)); });
  }
  /* 3.0.1 : ingrédients de clés absents des données de drop → ajoutés aux monstres de la sous-zone du donjon */
  {
    const KEY_FIX = { "Mâchoire du Chafer Draugr": ["donjon_squelettes", 5], "Fragment de Pierre Polie": ["pitons_craqueleur", 5],
      "Première partie de la clef du labyrinthe du Dragon Cochon": ["antre_dragon_cochon", 4], "Deuxième partie de la clef du labyrinthe du Dragon Cochon": ["antre_dragon_cochon", 4],
      "Fragment de cerveau poli": ["goulet_rasboul", 5] };
    for (const [res, [did, rate]] of Object.entries(KEY_FIX)) {
      if (!G.DUNGEONS[did] || Object.values(G.MONSTERS).some((m) => m.drops.some(([r]) => r === res))) continue;
      G.ZONES.forEach((z) => z.subs.forEach((sub) => { if (sub.dungeon !== did) return; sub.monsters.forEach((k) => { const m = G.MONSTERS[k]; if (m && !m.drops.some(([r]) => r === res)) m.drops.push([res, rate]); }); }));
      if (!G.RES[res]) G.RES[res] = { id: 0, icon: 0, lvl: G.DUNGEONS[did].lvl, price: 20, type: 84 };
    }
  }
  /* 0.1.14.2 : la Clef du Château du Wa Wabbit demandait trois morceaux de clef introuvables → ressources des Wabbits de l'île */
  { const C = G.SPECIAL_CRAFTS["Clef du Château du Wa Wabbit"];
    if (C) C.ing = [["Patte de Wabbit", 3], ["Queue de Black Wabbit", 3], ["Moustaches de Tiwabbit", 3], ["Viande Ladre", 2], ["Carpe d'Iem", 2], ["Menthe Sauvage", 2], ["Houblon", 2]]; }
  { const gem = Object.values(G.RES).find((r) => r.type === 50) || Object.values(G.RES)[0];
    G.RES["Éclat de trouvaille"] = { id: 0, icon: gem.icon, lvl: 30, price: 60, type: -2 };
    G.RES["Poussière de stasis"] = { id: 0, icon: gem.icon, lvl: 1, price: 15, type: -2 }; }
  const RES_CAT_OF = (name) => {
    const r = G.RES[name]; if (!r) return name.startsWith("Clef") ? "cle" : "divers";
    if (r.type === -2) return "rare";
    const c = RES_CATS.find((x) => x.types.includes(r.type)); return c ? c.id : "divers";
  };

  /* ---------- Emblème du Solitaire ---------- */
  const FREE_SPIRIT = { 1: 100, 2: 80, 3: 60, 4: 40, 5: 25, 6: 15, 7: 5, 8: 0 };
  const NAMES = ["Goultard", "Tristepin", "Évangelyne", "Amalia", "Ruel", "Kerubim", "Grougaloragran", "Lou", "Joris", "Atcham", "Yugo", "Bakara", "Otomaï", "Dally", "Simone", "Toross"];

  /* Explications des caractéristiques (infobulles) */
  const STAT_HELP = {
    tac: "Première ligne : +1 % par point de bloquer un Rôdeur ou un Bondisseur qui vise l'arrière (le Tacle de toute la ligne s'additionne, 60 % au plus).",
    fui: "Arrière : +0,5 % par point d'éviter une attaque qui vise l'arrière (30 % au plus).",
    pm: "Tout héros a 3 PM. Chaque PM en plus : +3 % d'esquiver une attaque en première ligne (15 % au plus).",
    po: "Chaque point de Portée : +20 % de chances qu'un sort à une cible touche un ennemi de plus (60 % au plus). Seule une forgemagie exotique en donne.",
    rpa: "+0,4 % par point d'affaiblir le monstre touché : −20 % de dégâts à sa prochaine attaque (−10 % pour un boss), 20 % au plus.",
    rpm: "+0,5 % par point de faire jouer le monstre touché en dernier au tour suivant ; un Bondisseur ne peut plus sauter (25 % au plus).",
    epa: "+0,5 % par point de résister à la Glace, au Mutisme, à la Pétrification et aux retraits de PA (50 % au plus).",
    epm: "+0,5 % par point de résister à la Terreur et à l'Enracinement (50 % au plus).",
    inv: "Une invocation de plus en même temps (3 au plus).",
    pod: "+5 % de butin pendant l'absence par 100 Pods dans l'équipe (50 % au plus).",
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
    rn: "Réduit les dégâts Neutre reçus de 1 % par point (50 % maximum).",
    dcri: "+1 dégât ajouté à chaque coup critique.",
    dt: "+1 dégât fixe sur les sorts Terre.", df: "+1 dégât fixe sur les sorts Feu.", de: "+1 dégât fixe sur les sorts Eau.", da: "+1 dégât fixe sur les sorts Air.", dn: "+1 dégât fixe sur les sorts Neutre.",
    xt: "Retire 1 point de dégât à chaque attaque Terre reçue.", xf: "Retire 1 point de dégât à chaque attaque Feu reçue.", xe: "Retire 1 point de dégât à chaque attaque Eau reçue.", xa: "Retire 1 point de dégât à chaque attaque Air reçue.", xn: "Retire 1 point de dégât à chaque attaque Neutre reçue.",
    dsort: "+1 % de dégâts sur tous les sorts.",
    hpMax: "Points de vie : 50 + 5 par niveau + Vitalité (+5 par famille de monstres complétée).",
  };

  const SUMMONS = G.SUMMONS || {};
  const DATA = { STATS, STAT_ORDER, TACT_ORDER, BASE_STATS, ELEMENTS, RUNE_TIERS, RUNE_SIMPLE_ONLY, CLASSES, CLASS_ORDER, CONDITIONS, TARGETS, SUMMONS, GATHER_JOBS, CRAFT_JOBS, SLOTS, DOFUS_SLOTS,
                 MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, RACES, HARVEST, SPELL_IMG, HEADS, FREE_SPIRIT, NAMES, HUNT_TIERS, CONSUMABLES, RES_CATS, RES_CAT_OF, STAT_HELP, META: G.META };
  root.DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof window !== "undefined" ? window : globalThis);
