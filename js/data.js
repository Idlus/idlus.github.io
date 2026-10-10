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
    bricoleur:  { name: "Bricoleur",  slots: ["cle"] },
  };

  const SLOTS = {
    coiffe: "Coiffe", cape: "Cape", amulette: "Amulette", anneau1: "Anneau", anneau2: "Anneau",
    ceinture: "Ceinture", bottes: "Bottes", arme: "Arme",
  };

  /* ---------- Contenu DOFUS (généré) ---------- */
  const MONSTERS = G.MONSTERS;
  for (const k in MONSTERS) {
    const m = MONSTERS[k];
    if (m.dmg === undefined) m.dmg = 1;
    if (!m.items) m.items = [];
  }
  const ZONES = G.ZONES, DUNGEONS = G.DUNGEONS, ITEMS = G.ITEMS, SETS = G.SETS, SPECIAL_CRAFTS = G.SPECIAL_CRAFTS;
  const RES = G.RES, SPELL_IMG = G.SPELL_IMG, HEADS = G.HEADS;

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

  const DATA = { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, RUNE_TIERS, RUNE_SIMPLE_ONLY, CLASSES, CONDITIONS, GATHER_JOBS, CRAFT_JOBS, SLOTS,
                 MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, SPELL_IMG, HEADS, EMBLEM, FREE_SPIRIT, NAMES, META: G.META };
  root.DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof window !== "undefined" ? window : globalThis);
