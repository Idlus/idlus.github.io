/* ============================================================================
   L'EXPÉDITION SANS FIN — Idlus (0.1.24)
   Le mode sans fin : des étages à l'infini, adaptés au niveau de l'équipe à l'entrée.
   - À chaque étage, 2 ou 3 portes (Combat, Élite, Trésor, Autel, Repos, Marchand) ; un boss tous
     les 5 étages, un palier tous les 10. Les portes sont les mêmes pour tous (tirées de la semaine
     et de l'étage), les monstres viennent des zones autour du niveau de l'équipe.
   - Difficulté sur la courbe des stasis (étage 10 ≈ stasis 4, 20 ≈ 7, 30 ≈ 10), puis sans limite ;
     un « règne » (modificateur de donjon) par tranche de 10 étages, dans un ordre tiré chaque semaine.
   - Reliques (24, en %) qui s'additionnent pendant l'expédition, bénédictions des Douze, 3 vies :
     une défaite coûte une vie et fait rejouer l'étage ; à zéro, l'expédition s'arrête, tout est gardé.
   - Coffre de palier : encaissé, ou mis en jeu (doublé au palier suivant, perdu avant).
   - Campement : 24 améliorations permanentes achetées avec les Éclats d'expédition, gagnés à chaque
     étage même en cas de chute.
   Lot 1 : hors ligne. Lot 2 (plus tard) : classement et coffre de la semaine (rejoués par le serveur).
   Pas de DOM ici : l'interface est dans js/expui.js. Chargé aussi par les tests et le simulateur.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { DUNGEONS, MONSTERS, ITEMS, RES } = D;
  const rnd = () => E.rnd();
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const note = (S, t, k) => E.note(S, t, k);
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };

  /* ---------- réglages ---------- */
  E.EXP_MIN_LVL = 10;        // niveau du meilleur héros pour partir
  E.EXP_LIVES = 3;           // vies de base (5 au plus avec le campement, +1 avec l'Œuf Doré)
  E.EXP_RELIC_MAX = 8;       // reliques portées au plus
  E.EXP_REFUSE = 15;         // Éclats gagnés en refusant une relique
  E.EXP_AUTO_MS = 20000;     // choix automatique (relique, bénédiction, pari) après ce délai
  E.EXP_DOOR_MS = 30000;     // choix automatique de la porte après ce délai
  E.EXP_BOSS_EVERY = 5; E.EXP_PALIER = 10;
  E.EXP_FLOOR_REW = 0.04;    // XP et butin : +4 % par étage (sous les plafonds du jeu)
  E.EXP_CURVE = { a: 0.3, b: 0.15 }; // stasis équivalente : 1 + a·étage jusqu'au 30, puis +b par étage
  E.EXP_KO = 15;             // PV (%) d'un héros à terre à l'étage suivant (40 avec le Phénix de poche)
  E.EXP_ZONE = 10;           // zones de niveau ± 10 autour de l'équipe
  E.EXP_TITLES = [[25, "Éclaireur"], [50, "Pèlerin des Douze"], [75, "Fidèle des Douze"], [100, "Élu des Douze"]];

  /* stasis équivalente d'un étage, puis multiplicateurs des monstres (mêmes formules que les stasis) */
  E.expStasis = (f) => (f <= 30 ? 1 + E.EXP_CURVE.a * f : 1 + E.EXP_CURVE.a * 30 + E.EXP_CURVE.b * (f - 30));
  E.expMonMult = (f) => { const k = E.expStasis(f); return { hp: 1 + 0.12 * (k - 1), dmg: Math.pow(1.2, k - 1) }; };
  E.expActive = (S) => !!(S && S.exp && S.exp.on);
  /* un combat d'expédition est prêt à partir (porte de combat choisie, aucun choix en attente) */
  E.expBusy = (S) => { const X = S && S.exp; return !!(X && X.on && X.door !== null && !X.pend.length && X.doors[X.door] && ["fight", "elite", "boss"].includes(X.doors[X.door].t)); };
  const X_ = (S) => (E.expActive(S) ? S.exp : null);

  /* ---------- les règnes des Douze : un modificateur par tranche de 10 étages, ordre tiré chaque semaine ---------- */
  E.EXP_REGNES = [
    { mod: "enrages", god: "Iop", cls: "iop" }, { mod: "blindes", god: "Féca", cls: "feca" }, { mod: "vampires", god: "Sram", cls: "sram" }, { mod: "nombreux", god: "Osamodas", cls: "osa" },
    { mod: "champions", god: "Ecaflip", cls: "eca" }, { mod: "ruse", god: "Sadida", cls: "sadi" }, { mod: "renforts", god: "Enutrof", cls: "enu" }, { mod: "veloces", god: "Xélor", cls: "xelor" },
  ];
  E.expRegneOrder = (w) => {
    const idx = E.EXP_REGNES.map((_, i) => i); const out = [];
    let x = hash(`idlus|exp|regnes|${w}`);
    while (idx.length) { x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; out.push(idx.splice(x % idx.length, 1)[0]); }
    const v = out.indexOf(7); if (v === 0) { out.splice(0, 1); out.splice(3, 0, 7); } // jamais « Véloces » dans les 10 premiers étages
    return out;
  };
  E.expRegne = (w, f) => E.EXP_REGNES[E.expRegneOrder(w)[Math.floor((f - 1) / 10) % E.EXP_REGNES.length]];

  /* ---------- reliques ---------- */
  /* fx en % sauf : po, pm, pa (points), pa1 (PA au 1er tour), first (joue en premier), revive, lives, mirror */
  const R = (id, r, name, res, desc, fx) => ({ id, r, name, res, desc, fx });
  E.EXP_RELICS = {
    plume:   R("plume", "c", "Plume de Piou", "Plume de Piou Rouge", "+8 % de dégâts", { dmg: 8 }),
    laine:   R("laine", "c", "Laine de Bouftou", "Laine de Bouftou", "+10 % de PV", { hp: 10 }),
    dent:    R("dent", "c", "Dent de Chafer", "Dent de Chafer", "+6 % de coups critiques", { cri: 6 }),
    os:      R("os", "c", "Os de Chafer", "Os de Chafer", "−6 % de dégâts subis", { dr: 6 }),
    bave:    R("bave", "c", "Bave de Bouftou", "Bave de Bouftou", "+10 % aux soins reçus", { heal: 10 }),
    aile:    R("aile", "c", "Aile de Moskito", "Ailes de Moskito", "+1 Portée", { po: 1 }),
    piece:   R("piece", "c", "Pièce d'Enutrof", "Pierre de Granit", "+15 % de kamas", { kamas: 15 }),
    fleur:   R("fleur", "c", "Fleur de Kaliptus", "Fleur de Kaliptus", "+10 % de butin", { drop: 10 }),
    carapace: R("carapace", "c", "Carapace de Scaratos", "Carapace de Scaratos", "+8 % de résistances", { res: 8 }),
    oeil:    R("oeil", "c", "Œil de Kanigrou", "Poils de Kanigroula", "+10 % de dégâts contre les boss", { boss: 10 }),
    poils:   R("poils", "c", "Poils d'Arakne", "Poils d'Arakne Malade", "les monstres font −5 % de dégâts", { mon: 5 }),
    venin:   R("venin", "c", "Venin de Serpentin", "Venin de Serpentin", "les coups des héros empoisonnent (3 % des PV, 2 tours)", { poison: 3 }),
    coeur:   R("coeur", "r", "Cœur de Craqueleur", "Cœur de Craqueleur", "bouclier de 12 % des PV au début de chaque combat", { shield1: 12 }),
    ecaille: R("ecaille", "r", "Écaille de Dragoss", "Écaille de Dragoss Charbon", "vol de vie : 8 % des dégâts infligés", { vamp: 8 }),
    larme:   R("larme", "r", "Larme de Frizz", "Larme de Missiz Frizz", "+1 PA pour toute l'équipe au premier tour", { pa1: 1 }),
    pierre:  R("pierre", "r", "Pierre du Craqueleur", "Pierre du Craqueleur", "−10 % de dégâts subis par le héros le plus blessé", { hurt: 10 }),
    corne:   R("corne", "r", "Corne de Boufton", "Corne de Boufton", "+20 % de dégâts contre les monstres au-dessus de 80 % de PV", { fresh: 20 }),
    sang:    R("sang", "r", "Sang de Bouftou", "Sang de Bouftou", "le premier héros à tomber se relève avec 25 % de PV (une fois par combat)", { revive: 1 }),
    queue:   R("queue", "r", "Queue du Mulou", "Queue du Mulou", "+1 PM", { pm: 1 }),
    griffes: R("griffes", "r", "Griffes de Kwak", "Griffes de Kwak", "+25 % de dégâts sur les coups critiques", { dcri: 25 }),
    oeuf:    R("oeuf", "l", "Œuf Doré", "Œuf de Larve Dorée", "+1 vie", { lives: 1 }),
    pelle:   R("pelle", "l", "Pelle de Mansot", "Pied de Mansot", "butin et kamas ×2", { drop: 100, kamas: 100 }),
    dofus:   R("dofus", "l", "Dofus fêlé", "Œuf Chimérique", "+1 PA", { pa: 1 }),
    miroir:  R("miroir", "l", "Miroir d'Ilyzaelle", "Plume d'Ilyzaelle", "copie la relique prise juste avant", { mirror: 1 }),
  };
  E.EXP_RARITY = { c: "Commune", r: "Rare", l: "Légendaire" };
  const relicsOf = (r) => Object.values(E.EXP_RELICS).filter((x) => x.r === r).map((x) => x.id);
  const PCT_FX = ["dmg", "hp", "cri", "dr", "heal", "kamas", "drop", "res", "boss", "mon", "poison", "shield1", "vamp", "hurt", "fresh", "dcri"];

  /* ---------- bénédictions des Douze (après chaque boss ou autel, gardées jusqu'à la chute) ---------- */
  const B = (id, cls, name, desc, fx) => ({ id, cls, name, desc, fx });
  E.EXP_BLESS = {
    iop:   B("iop", "iop", "Colère de Iop", "+12 % de dégâts", { dmg: 12 }),
    eni:   B("eni", "eni", "Souffle d'Eniripsa", "l'équipe récupère 10 % de ses PV après chaque étage", { floorHeal: 10 }),
    panda: B("panda", "panda", "Ivresse de Pandawa", "+1 PM et +10 % de résistances", { pm: 1, res: 10 }),
    xelor: B("xelor", "xelor", "Sablier de Xélor", "l'équipe joue en premier au tour 1", { first: 1 }),
    enu:   B("enu", "enu", "Pelle d'Enutrof", "+20 % de kamas et de ressources", { kamas: 20, drop: 20 }),
    eca:   B("eca", "eca", "Chance d'Ecaflip", "+15 % de butin", { drop: 15 }),
    feca:  B("feca", "feca", "Armure de Féca", "bouclier de 10 % des PV au début de chaque combat", { shield1: 10 }),
    sacri: B("sacri", "sacri", "Sang de Sacrieur", "+10 % de PV", { hp: 10 }),
    cra:   B("cra", "cra", "Œil du Crâ", "+8 % de coups critiques", { cri: 8 }),
    osa:   B("osa", "osa", "Appel d'Osamodas", "les héros à terre reviennent avec 40 % de PV à l'étage suivant", { ko: 40 }),
  };

  /* ---------- campement : 24 améliorations permanentes, 4 branches, dans l'ordre ---------- */
  const U = (id, br, cost, name, desc) => ({ id, br, cost, name, desc });
  E.EXP_BRANCHES = [["survie", "Survie", "sacri"], ["fortune", "Fortune", "enu"], ["puissance", "Puissance", "iop"], ["explo", "Exploration", "cra"]];
  E.EXP_CAMP = [
    U("vie1", "survie", 40, "Vie supplémentaire I", "4 vies"), U("repos", "survie", 100, "Repos amélioré", "le Repos soigne 100 % et ranime"), U("seconde", "survie", 260, "Seconde chance", "la première défaite de l'expédition ne coûte pas de vie"),
    U("vie2", "survie", 600, "Vie supplémentaire II", "5 vies"), U("trousse", "survie", 900, "Trousse de l'Eniripsa", "+15 % de PV après chaque boss"), U("phenix", "survie", 2000, "Phénix de poche", "les héros tombés reviennent avec 40 % de PV à l'étage suivant (15 % sinon)"),
    U("eclats10", "fortune", 40, "Éclats +10 %", ""), U("butin10", "fortune", 100, "Butin +10 %", "en expédition"), U("marchand", "fortune", 200, "Marchand ami", "reliques 25 % moins chères chez le Marchand"),
    U("eclats20", "fortune", 450, "Éclats +20 %", "en plus des +10 %"), U("coffres", "fortune", 1000, "Coffres de palier ×1,5", "kamas, XP et poussière"), U("pelle", "fortune", 1800, "Pelle d'Enutrof", "un deuxième objet dans chaque coffre de palier"),
    U("depart", "puissance", 40, "Relique de départ", "une relique commune au choix au départ"), U("oeil", "puissance", 100, "Œil d'Ecaflip", "3 reliques proposées au lieu de 2"), U("reliques10", "puissance", 300, "Reliques +10 %", "effets en % renforcés"),
    U("departrare", "puissance", 700, "Relique de départ rare", "une relique rare parmi celles du départ"), U("forge", "puissance", 1200, "Forge du Forgelance", "fusionner 2 reliques communes en 1 rare"), U("bless2", "puissance", 2500, "Bénédiction double", "2 bénédictions après chaque boss"),
    U("longuevue", "explo", 40, "Longue-vue", "voir les monstres derrière chaque porte"), U("boussole", "explo", 150, "Boussole", "une porte Trésor garantie tous les 10 étages"), U("rechercher", "explo", 350, "Rechercher", "relancer les portes une fois par étage"),
    U("raccourci", "explo", 800, "Raccourci", "repartir du palier 10 (une relique commune offerte par palier sauté)"), U("carte", "explo", 1300, "Carte détaillée", "voir les portes de l'étage suivant"), U("grandraccourci", "explo", 2200, "Grand raccourci", "repartir du dernier palier atteint cette semaine"),
  ];
  E.expCampTotal = E.EXP_CAMP.reduce((a, u) => a + u.cost, 0);
  E.camp = (S) => { if (!S.camp || typeof S.camp !== "object") S.camp = { ec: 0, ups: {}, tot: 0 }; if (!S.camp.ups) S.camp.ups = {}; return S.camp; };
  E.campHas = (S, id) => !!(S.camp && S.camp.ups && S.camp.ups[id]);
  /* prochaine amélioration d'une branche (elles s'achètent dans l'ordre) */
  E.campNext = (S, br) => E.EXP_CAMP.find((u) => u.br === br && !E.campHas(S, u.id)) || null;
  E.campCount = (S) => E.EXP_CAMP.filter((u) => E.campHas(S, u.id)).length;
  E.campBuy = (S, id) => {
    const u = E.EXP_CAMP.find((x) => x.id === id); if (!u) return "Amélioration inconnue.";
    const C = E.camp(S); if (C.ups[id]) return "Déjà achetée.";
    const nx = E.campNext(S, u.br); if (!nx || nx.id !== id) return `Achète d'abord « ${nx ? nx.name : "?"} ».`;
    if (C.ec < u.cost) return `Il faut ${u.cost} Éclats d'expédition (tu en as ${C.ec}).`;
    C.ec -= u.cost; C.ups[id] = E.now();
    const X = X_(S); if (X && (id === "vie1" || id === "vie2")) { X.livesMax++; X.lives++; }
    note(S, `Campement : ${u.name} acheté${u.desc ? ` (${u.desc})` : ""}.`, "up");
    if (E.checkAch) E.checkAch(S);
    return null;
  };
  const eclatsMult = (S) => 1 + (E.campHas(S, "eclats10") ? 0.1 : 0) + (E.campHas(S, "eclats20") ? 0.2 : 0);
  const giveEclats = (S, n) => { const C = E.camp(S); const v = Math.round(n * eclatsMult(S)); C.ec += v; C.tot = (C.tot || 0) + v; const X = X_(S); if (X) X.eclats += v; return v; };
  E.ECLATS = "Éclats d'expédition";

  /* ---------- effets cumulés (reliques × campement + bénédictions) ---------- */
  E.expFx = (S) => {
    const X = S.exp; const fx = {}; if (!X) return fx;
    const add = (f, m = 1) => { for (const k in f) fx[k] = (fx[k] || 0) + f[k] * (PCT_FX.includes(k) ? m : 1); };
    const m = E.campHas(S, "reliques10") ? 1.1 : 1;
    X.relics.forEach((id, i) => { const r = E.EXP_RELICS[id]; if (!r) return; if (r.fx.mirror) { const p = E.EXP_RELICS[X.relics[i - 1]]; if (p && !p.fx.mirror && !p.fx.lives) add(p.fx, m); } else add(r.fx, m); });
    (X.bless || []).forEach((id) => { const b = E.EXP_BLESS[id]; if (b) add(b.fx); });
    return fx;
  };
  E.expFxTxt = (fx) => {
    const T = { dmg: "dégâts", hp: "PV", cri: "critiques", dr: "dégâts subis en moins", heal: "soins reçus", kamas: "kamas", drop: "butin", res: "résistances", boss: "dégâts sur les boss", mon: "dégâts des monstres en moins", dcri: "dégâts critiques", fresh: "dégâts sur les monstres en pleine forme", vamp: "vol de vie", shield1: "bouclier au 1er tour", hurt: "protection du plus blessé" };
    const out = [];
    for (const k in T) if (fx[k]) out.push(`+${Math.round(fx[k])} % ${T[k]}`);
    if (fx.po) out.push(`+${fx.po} PO`); if (fx.pm) out.push(`+${fx.pm} PM`); if (fx.pa) out.push(`+${fx.pa} PA`); if (fx.pa1) out.push(`+${fx.pa1} PA au 1er tour`);
    if (fx.first) out.push("joue en premier"); if (fx.revive) out.push("un héros se relève par combat"); if (fx.poison) out.push("coups empoisonnés"); if (fx.lives) out.push(`+${fx.lives} vie`);
    if (fx.floorHeal) out.push(`${fx.floorHeal} % de PV par étage`);
    return out;
  };

  /* ---------- zones et donjons autour du niveau de l'équipe ---------- */
  const subsNear = (L) => {
    const all = Object.values(E.SUBS).filter((s) => !s.hidden && s.monsters && s.monsters.length);
    const near = all.filter((s) => s.lvl[1] >= L - E.EXP_ZONE && s.lvl[0] <= L + E.EXP_ZONE);
    if (near.length) return near;
    const dist = (s) => Math.min(Math.abs(s.lvl[0] - L), Math.abs(s.lvl[1] - L));
    return all.sort((a, b) => dist(a) - dist(b)).slice(0, 3);
  };
  const dgsNear = (L) => {
    const ids = Object.keys(DUNGEONS).sort().filter((d) => DUNGEONS[d].rooms && DUNGEONS[d].rooms.length);
    const near = ids.filter((d) => DUNGEONS[d].lvl >= L - 15 && DUNGEONS[d].lvl <= L + 10);
    if (near.length) return near;
    return ids.sort((a, b) => Math.abs(DUNGEONS[a].lvl - L) - Math.abs(DUNGEONS[b].lvl - L)).slice(0, 2);
  };
  /* un groupe de monstres pour une porte, tiré du hasard de la semaine et de l'étage (même porte pour tous) */
  const seeded = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const rollGroup = (X, rng, teamSize, elite) => {
    const subs = subsNear(X.lvl); const sub = subs[Math.floor(rng() * subs.length)];
    const nb = X.regne.mod === "nombreux" ? 1 : 0;
    let n = clamp(Math.round((2 + Math.floor(rng() * 2)) * (0.3 + teamSize * 0.25)) + nb, 1, 8);
    if (elite) n = Math.max(1, n - 1);
    const mons = []; for (let i = 0; i < n; i++) mons.push({ id: sub.monsters[Math.floor(rng() * sub.monsters.length)], lvl: Math.max(1, X.lvl + Math.floor(rng() * 5) - 2) });
    if (elite) { const nc = n >= 4 ? 2 : 1; const keys = Object.keys(E.CHAMP_POWERS); for (let i = 0; i < nc; i++) mons[i].champ = keys[Math.floor(rng() * keys.length)]; }
    return { sub: sub.id, mons };
  };

  /* ---------- les portes d'un étage ---------- */
  E.EXP_DOORS = {
    fight:    { name: "Combat",   desc: "Le combat normal de l'étage.", icon: "combat" },
    elite:    { name: "Élite",    desc: "Des Champions : PV ×2 et un pouvoir. Plus d'Éclats et une relique rare.", icon: "combat" },
    treasure: { name: "Trésor",   desc: "Pas de combat : kamas, ressources et une relique commune. Un piège blesse un héros (−20 % de PV).", icon: "coffre" },
    altar:    { name: "Autel",    desc: "Pas de combat : trois bénédictions proposées, une à garder jusqu'à la chute.", icon: "dofus" },
    rest:     { name: "Repos",    desc: "Pas de combat : l'équipe récupère 50 % de ses PV et les héros à terre se relèvent.", icon: "havre" },
    shop:     { name: "Marchand", desc: "Pas de combat : trois reliques à acheter avec tes Éclats.", icon: "bourse" },
    boss:     { name: "Boss",     desc: "Le boss d'un donjon de ton niveau, avec ses mécaniques. Une bénédiction et une relique à la clé.", icon: "couronne" },
  };
  const DOOR_W = [["elite", 1 / 3], ["treasure", 1 / 5], ["altar", 1 / 5], ["rest", 1 / 6], ["shop", 1 / 8]];
  E.expDoors = (S, X) => {
    const f = X.floor; const team = E.team(S).length || 1;
    const rngT = seeded(hash(`idlus|exp|${X.w}|${f}|${X.reroll || 0}`)); // les types de portes : les mêmes pour tous
    const rng = seeded(hash(`idlus|exp|${X.w}|${X.lvl}|${f}|${X.reroll || 0}`)); // leur contenu dépend du niveau de l'équipe
    X.regne = E.expRegne(X.w, f);
    const door = (t) => { const d = { t, i: 0 };
      if (t === "fight" || t === "elite") Object.assign(d, rollGroup(X, rng, team, t === "elite"));
      if (t === "boss") { const ids = dgsNear(X.lvl); d.did = ids[Math.floor(rng() * ids.length)]; }
      if (t === "altar") { const pool = Object.keys(E.EXP_BLESS).filter((b) => !X.bless.includes(b)); d.opts = []; while (d.opts.length < Math.min(3, pool.length)) d.opts.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); }
      if (t === "shop") { const price = (r) => Math.round((r === "c" ? 60 : r === "r" ? 140 : 320) * (E.campHas(S, "marchand") ? 0.75 : 1));
        const c = relicsOf("c").filter((x) => !X.relics.includes(x)), r = relicsOf("r").filter((x) => !X.relics.includes(x)), l = relicsOf("l").filter((x) => !X.relics.includes(x) && !X.legSeen.includes(x));
        d.opts = []; const take = (arr) => { if (!arr.length) return; const id = arr.splice(Math.floor(rng() * arr.length), 1)[0]; d.opts.push({ id, price: price(E.EXP_RELICS[id].r) }); };
        take(c); take(rng() < 0.6 ? r : c); take(l.length && rng() < 0.2 ? l : r.length ? r : c);
        d.opts.forEach((o) => { if (E.EXP_RELICS[o.id].r === "l") X.legSeen.push(o.id); }); }
      return d; };
    if (f % E.EXP_BOSS_EVERY === 0) return [door("boss")];
    const n = f % 2 === 1 ? 3 : 2;
    const out = [door("fight")];
    const last = X.log.length ? X.log[X.log.length - 1].t : null;
    if (E.campHas(S, "boussole") && f % 10 === 3) out.push(door("treasure"));
    const w = DOOR_W.map(([t, p]) => [t, t === "rest" && last === "rest" ? 0 : p]); const tot = w.reduce((a, [, p]) => a + p, 0);
    for (let g = 0; out.length < n && g < 30; g++) {
      let r = rngT() * tot, t = "fight"; for (const [k, p] of w) { if (r < p) { t = k; break; } r -= p; }
      if (t === "altar" && Object.keys(E.EXP_BLESS).every((b) => X.bless.includes(b))) continue;
      if (t === "shop" && X.relics.length >= E.EXP_RELIC_MAX) continue;
      if (!out.some((d) => d.t === t)) out.push(door(t));
    }
    while (out.length < n) out.push(door("fight"));
    out.forEach((d, i) => (d.i = i));
    return out;
  };

  /* ---------- l'état de l'expédition ---------- */
  E.expWeek = (S) => { const w = E.weekIdx(); if (!S.expWeek || S.expWeek.w !== w) S.expWeek = { w, best: 0, runs: 0 }; return S.expWeek; };
  E.expCanStart = (S) => {
    const team = E.team(S); if (!team.length) return "Il faut au moins un héros dans l'équipe.";
    if (Math.max(...team.map((c) => c.lvl)) < E.EXP_MIN_LVL) return `L'expédition s'ouvre au niveau ${E.EXP_MIN_LVL}.`;
    if (S.dungeon) return "Termine d'abord le donjon.";
    if (E.expActive(S)) return "Une expédition est déjà en cours.";
    return null;
  };
  /* paliers de départ possibles : 1, 11 (Raccourci, dès qu'un palier 10 a été atteint), dernier palier de la semaine (Grand raccourci) */
  E.expStarts = (S) => {
    const out = [1]; const best = (S.cnt && S.cnt.expBest) || 0; const wk = E.expWeek(S);
    if (E.campHas(S, "raccourci") && best >= 10) out.push(11);
    if (E.campHas(S, "grandraccourci")) { const p = Math.floor(wk.best / 10) * 10 + 1; if (p > 11) out.push(p); }
    return out;
  };
  const queue = (X, p) => { p.at = E.now(); p.id = (X.pseq = (X.pseq || 0) + 1); X.pend.push(p); };
  const offerRelics = (S, X, kind) => { // kind : "start" | "common" | "rare" | "boss"
    const n = E.campHas(S, "oeil") ? 3 : 2;
    const free = (r) => relicsOf(r).filter((id) => !X.relics.includes(id) && (r !== "l" || !X.legSeen.includes(id)));
    const opts = [];
    const take = (r) => { const a = free(r).filter((id) => !opts.includes(id)); if (!a.length) return false; opts.push(pick(a)); return true; };
    if (kind === "common") take("c") || take("r");
    else if (kind === "rare") { take("r") || take("c"); while (opts.length < n) if (!(rnd() < 0.3 ? take("r") || take("c") : take("c") || take("r"))) break; }
    else if (kind === "boss") { if (rnd() < 0.25) take("l"); take("r") || take("c"); while (opts.length < n) if (!(rnd() < 0.5 ? take("r") || take("c") : take("c") || take("r"))) break; }
    else { if (E.campHas(S, "departrare")) take("r"); while (opts.length < n) if (!take("c")) break; }
    if (!opts.length) return;
    opts.forEach((id) => { if (E.EXP_RELICS[id].r === "l") X.legSeen.push(id); }); // une légendaire n'est proposée qu'une fois par expédition
    queue(X, { t: "relic", opts, kind });
  };
  E.expStart = (S, from) => {
    const err = E.expCanStart(S); if (err) return err;
    const team = E.team(S); const starts = E.expStarts(S); const f0 = starts.includes(+from) ? +from : 1;
    const wasHunt = S.hunting && S.sub ? S.sub : null;
    S.hunting = false; S.fight = null; S.pause = E.PAUSE_MS; S.protector = null;
    const X = S.exp = {
      on: true, w: E.weekIdx(), t0: E.now(), floor: f0, lvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length),
      lives: E.EXP_LIVES + (E.campHas(S, "vie1") ? 1 : 0) + (E.campHas(S, "vie2") ? 1 : 0), relics: [], bless: [], legSeen: [], eclats: 0,
      doors: [], door: null, pend: [], pot: null, hp: {}, log: [], rew: { kamas: 0, xp: 0, dust: 0, res: 0, items: 0, chests: 0, dbl: 0 }, fights: 0, resume: wasHunt, reroll: 0, rerolled: false, best: f0 - 1,
    };
    X.livesMax = X.lives;
    X.doors = E.expDoors(S, X);
    if (f0 > 1) for (let i = 0; i < Math.floor((f0 - 1) / 10); i++) offerRelics(S, X, "common");
    if (E.campHas(S, "depart")) offerRelics(S, X, "start");
    const wk = E.expWeek(S); wk.runs++; S.cnt = S.cnt || {}; S.cnt.expRuns = (S.cnt.expRuns || 0) + 1;
    note(S, `L'expédition commence${f0 > 1 ? ` au palier ${f0 - 1}` : ""} : règne de ${X.regne.god}, équipe niveau ${X.lvl}.`, "info");
    return null;
  };
  /* la porte choisie : les combats partent au prochain pas de la boucle, les autres se résolvent tout de suite */
  E.expDoor = (S, i) => {
    const X = X_(S); if (!X) return "Aucune expédition en cours.";
    if (X.pend.length) return "Fais d'abord ton choix.";
    if (X.door !== null) return "La porte est déjà choisie.";
    const d = X.doors[+i]; if (!d) return "Porte inconnue.";
    X.door = +i; X.doorAt = E.now();
    if (d.t === "fight" || d.t === "elite" || d.t === "boss") { S.fight = null; S.pause = E.PAUSE_MS; return null; }
    const team = E.team(S); const heal = (pct, revive) => team.forEach((c) => { const h = X.hp[c.id] === undefined ? 100 : X.hp[c.id]; if (h <= 0 && !revive) return; X.hp[c.id] = Math.min(100, Math.max(h, 0) + pct); });
    if (d.t === "rest") { const full = E.campHas(S, "repos"); heal(full ? 100 : 50, true); note(S, `Repos : l'équipe récupère ${full ? "tous ses PV" : "50 % de ses PV"}.`, "info"); }
    if (d.t === "treasure") {
      const alive = team.filter((c) => (X.hp[c.id] === undefined ? 100 : X.hp[c.id]) > 0); const v = alive.length ? pick(alive) : null;
      if (v) X.hp[v.id] = Math.max(1, (X.hp[v.id] === undefined ? 100 : X.hp[v.id]) - 20);
      const k = Math.round(X.lvl * 40 * (1 + X.floor / 20) * (1 + E.bonus(S, "kamas") / 100)); S.kamas += k; X.rew.kamas += k;
      const subs = subsNear(X.lvl); const sub = pick(subs); const got = [];
      for (let j = 0; j < 2; j++) { const m = MONSTERS[pick(sub.monsters)]; const dr = (m.drops || []).filter(([r]) => RES[r] && !E.isKey(r)); if (!dr.length) continue; const [r] = pick(dr); const q = ri(3, 6); E.addRes(S, r, q); X.rew.res += q; got.push(`${q} ${r}`); }
      note(S, `Trésor : ${k.toLocaleString("fr-FR")} kamas${got.length ? ", " + got.join(", ") : ""}${v ? `. Un piège blesse ${v.name} (−20 % de PV)` : ""}.`, "rare");
      offerRelics(S, X, "common");
    }
    if (d.t === "altar" && d.opts.length) queue(X, { t: "bless", opts: d.opts.slice() });
    if (d.t === "shop" && d.opts.length) queue(X, { t: "shop", opts: d.opts.map((o) => Object.assign({}, o)) });
    X.log.push({ f: X.floor, t: d.t, w: 1 });
    if (!X.pend.length) nextFloor(S, X);
    return null;
  };
  /* relancer les portes (Rechercher, une fois par étage) */
  E.expReroll = (S) => {
    const X = X_(S); if (!X) return "Aucune expédition en cours.";
    if (!E.campHas(S, "rechercher")) return "Il faut « Rechercher » au campement.";
    if (X.rerolled) return "Une seule relance par étage."; if (X.door !== null) return "La porte est déjà choisie.";
    X.reroll++; X.rerolled = true; X.doors = E.expDoors(S, X); return null;
  };
  const nextFloor = (S, X) => {
    if (X.floor > X.best) X.best = X.floor;
    const fx = E.expFx(S);
    if (fx.floorHeal) E.team(S).forEach((c) => { const h = X.hp[c.id] === undefined ? 100 : X.hp[c.id]; if (h > 0) X.hp[c.id] = Math.min(100, h + fx.floorHeal); });
    X.floor++; X.door = null; X.rerolled = false; X.doors = E.expDoors(S, X);
    S.cnt = S.cnt || {}; S.cnt.expFloors = (S.cnt.expFloors || 0) + 1;
    const wk = E.expWeek(S); if (X.best > wk.best) wk.best = X.best;
    if (X.best > (S.cnt.expBest || 0)) { S.cnt.expBest = X.best; }
    E.EXP_TITLES.forEach(([f, t]) => { if (X.best >= f) { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) { S.titlesExtra.push(t); note(S, `Étage ${f} atteint : titre « ${t} » !`, "rare"); E.celebrate({ t: "exp", floor: f, title: t }); } } });
    if (X.best >= 100) { S.unlocks = S.unlocks || {}; if (!S.unlocks.elu) { S.unlocks.elu = 1; note(S, "Ornement débloqué : Auréole des Douze !", "rare"); } }
    if (E.checkAch) E.checkAch(S);
  };

  /* ---------- choix en attente : relique, bénédiction, pari, marchand ---------- */
  E.expPending = (S) => { const X = X_(S); return X && X.pend.length ? X.pend[0] : null; };
  const resolved = (S, X) => { X.pend.shift(); if (!X.pend.length && X.door !== null && X.doors[X.door] && !["fight", "elite", "boss"].includes(X.doors[X.door].t)) nextFloor(S, X); else if (!X.pend.length && X.door !== null && X.afterFight) { X.afterFight = false; nextFloor(S, X); } };
  const takeRelic = (S, X, id) => {
    const r = E.EXP_RELICS[id]; if (!r) return false;
    if (X.relics.length >= E.EXP_RELIC_MAX) return false;
    X.relics.push(id); S.cnt = S.cnt || {}; S.cnt.expRelics = (S.cnt.expRelics || 0) + 1;
    if (r.fx.lives) { X.lives++; X.livesMax++; }
    note(S, `Relique : ${r.name} (${r.desc}).`, r.r === "l" ? "rare" : "up");
    return true;
  };
  /* Action : répondre au choix en attente. i : index de l'option, ou "no" pour refuser (relique, +15 Éclats ; marchand : partir).
     Pour une relique quand les 8 places sont prises, drop = index de la relique à remplacer. */
  E.expChoose = (S, i, drop) => {
    const X = X_(S); const p = X && X.pend[0]; if (!p) return "Rien à choisir.";
    if (p.t === "relic") {
      if (i === "no") { const v = giveEclats(S, E.EXP_REFUSE); note(S, `Relique refusée : +${v} Éclats.`, "info"); resolved(S, X); return null; }
      const id = p.opts[+i]; if (!id) return "Choix inconnu.";
      if (X.relics.length >= E.EXP_RELIC_MAX) { if (drop === undefined || !X.relics[+drop]) return "Tes 8 places sont prises : choisis la relique à remplacer, ou refuse."; X.relics.splice(+drop, 1); }
      takeRelic(S, X, id); resolved(S, X); return null;
    }
    if (p.t === "bless") { if (i === "no" || !p.opts.length) { resolved(S, X); return null; } const id = p.opts[+i]; if (!id || !E.EXP_BLESS[id]) return "Choix inconnu."; X.bless.push(id); note(S, `Bénédiction : ${E.EXP_BLESS[id].name} (${E.EXP_BLESS[id].desc}).`, "up"); resolved(S, X); return null; }
    if (p.t === "pari") {
      if (+i === 1) { X.pot = p.chest; X.pot.from = X.floor; note(S, `Coffre du palier ${X.floor} mis en jeu : doublé au palier ${X.floor + E.EXP_PALIER}, perdu avant.`, "warn"); }
      else { applyChest(S, X, p.chest, 1); }
      resolved(S, X); return null;
    }
    if (p.t === "shop") { if (i === "no") { resolved(S, X); return null; } return E.expBuy(S, i); }
    return "Choix inconnu.";
  };
  E.expBuy = (S, i) => {
    const X = X_(S); const p = X && X.pend[0]; if (!p || p.t !== "shop") return "Pas de marchand ici.";
    const o = p.opts[+i]; if (!o || o.sold) return "Plus en vente.";
    const C = E.camp(S); if (C.ec < o.price) return `Il faut ${o.price} Éclats (tu en as ${C.ec}).`;
    if (X.relics.length >= E.EXP_RELIC_MAX) return "Tes 8 places de reliques sont prises.";
    C.ec -= o.price; o.sold = true; takeRelic(S, X, o.id); return null;
  };
  /* Forge du Forgelance : deux reliques communes deviennent une rare */
  E.expForge = (S, a, b) => {
    const X = X_(S); if (!X) return "Aucune expédition en cours.";
    if (!E.campHas(S, "forge")) return "Il faut la Forge du Forgelance au campement.";
    a = +a; b = +b; if (a === b || !X.relics[a] || !X.relics[b]) return "Choisis deux reliques différentes.";
    if (E.EXP_RELICS[X.relics[a]].r !== "c" || E.EXP_RELICS[X.relics[b]].r !== "c") return "Seules deux reliques communes se fusionnent.";
    const pool = relicsOf("r").filter((id) => !X.relics.includes(id)); if (!pool.length) return "Plus de relique rare à forger.";
    const [hi, lo] = a > b ? [a, b] : [b, a]; X.relics.splice(hi, 1); X.relics.splice(lo, 1);
    const id = pick(pool); X.relics.push(id); note(S, `Forge : ${E.EXP_RELICS[id].name} (${E.EXP_RELICS[id].desc}).`, "up"); return null;
  };

  /* ---------- coffres de palier ---------- */
  const makeChest = (S, X) => {
    const f = X.floor; const L = X.lvl; const k15 = E.campHas(S, "coffres") ? 1.5 : 1;
    const kamas = Math.round(L * 120 * (1 + f / 20) * k15 * (1 + E.bonus(S, "kamas") / 100));
    const xp = Math.round(E.monsterXp(L) * 6 * (1 + f / 20) * k15 * E.PACE_REW * (1 + E.bonus(S, "xp") / 100));
    const dust = Math.round((10 + f) * k15);
    const items = []; const ids = dgsNear(L); const pool = new Set();
    ids.forEach((did) => { const dg = DUNGEONS[did]; [dg.boss, ...dg.rooms.flatMap((r) => r.mobs)].forEach((m) => (MONSTERS[m].items || []).forEach(([t]) => { if (ITEMS[t] && ITEMS[t].lvl <= L + 5 && ITEMS[t].lvl >= L - 25) pool.add(t); })); });
    const arr = [...pool]; const nI = 1 + (E.campHas(S, "pelle") ? 1 : 0); for (let j = 0; j < nI && arr.length; j++) items.push(pick(arr));
    return { kamas, xp, dust, items, eclats: 60, palier: f };
  };
  const applyChest = (S, X, ch, mult) => {
    const team = E.team(S); S.kamas += ch.kamas * mult; X.rew.kamas += ch.kamas * mult; X.rew.chests++;
    team.forEach((c) => { E.giveXp(S, c, Math.round(ch.xp * mult * E.renXpMult(c))); }); X.rew.xp += ch.xp * mult;
    E.addRes(S, E.POUSSIERE, ch.dust * mult); X.rew.dust += ch.dust * mult;
    const got = [];
    for (let m = 0; m < mult; m++) ch.items.forEach((t) => { if (E.itemCount(S) < E.itemCap(S)) { E.rollItem(S, t, {}); X.rew.items++; got.push(ITEMS[t].name); } });
    note(S, `Coffre du palier ${ch.palier}${mult > 1 ? " doublé" : ""} : ${(ch.kamas * mult).toLocaleString("fr-FR")} kamas, ${(ch.xp * mult).toLocaleString("fr-FR")} XP par héros, ${ch.dust * mult} ${E.POUSSIERE}${got.length ? ", " + got.join(", ") : ""}.`, "rare");
  };

  /* ---------- le combat d'un étage (appelé par E.startFight) ---------- */
  E.expFight = (S, team) => {
    const X = X_(S); if (!X || X.pend.length || X.door === null) return null;
    const d = X.doors[X.door]; if (!d || !["fight", "elite", "boss"].includes(d.t)) return null;
    const M = E.expMonMult(X.floor); const mod = X.regne.mod; const ME = E.monsterEntity;
    let mons = [];
    if (d.t === "boss") {
      const dg = DUNGEONS[d.did]; const bm = MONSTERS[dg.boss];
      const boss = ME(dg.boss, Math.max(bm.lvl[0], X.lvl + 2));
      boss.hpMax = boss.hp = Math.round(boss.hpMax * (1 + team.length * 1.1) / 5);
      boss.mech = E.bossMechs(d.did).slice(); boss.mturn = 0;
      const pool = E.mechPool(dg.lvl); const more = (n) => { const keys = pool.filter((x) => !boss.mech.includes(x)); while (n-- > 0 && keys.length) boss.mech.push(keys.splice(Math.floor(rnd() * keys.length), 1)[0]); };
      if (mod === "ruse") more(1);
      if (X.floor >= 20) more(1);
      if (X.floor >= 40) boss.phase2 = true;
      if (X.floor >= 60) { boss.legend = true; boss.name += " Légendaire"; boss.hpMax = boss.hp = Math.round(boss.hpMax * 1.5); more(3 - boss.mech.length); }
      mons = [boss];
      const extra = clamp(team.length - 1 + (mod === "renforts" ? 2 : 0), 0, 7);
      for (let i = 0; i < extra; i++) mons.push(ME(pick(dg.bossMobs), Math.max(1, X.lvl - ri(1, 3))));
    } else {
      mons = d.mons.map((m) => { const e = ME(m.id, m.lvl); if (m.champ) E.makeChampion(e, m.champ); return e; });
      if (mod === "champions" && !mons.some((m) => m.champ)) E.makeChampion(mons[mons.length - 1]);
    }
    const fx = E.expFx(S);
    mons.forEach((m) => {
      m.hpMax = m.hp = Math.round(m.hpMax * M.hp); m.dmg *= M.dmg * (1 - (fx.mon || 0) / 100);
      if (mod === "blindes") m.shield = Math.round(m.hpMax * 0.15);
      if (mod === "veloces") m.ini += 1e6;
      if (mod === "vampires") m.vamp = Math.max(m.vamp || 0, 0.15);
      if (mod === "enrages") m.enrageMod = true;
    });
    const sub = d.sub ? E.SUBS[d.sub] : null;
    const label = `Expédition · étage ${X.floor} — ${d.t === "boss" ? MONSTERS[DUNGEONS[d.did].boss].name : d.t === "elite" ? "Élite" : sub ? sub.name : "Combat"}`;
    const mult = { xp: 1 + E.EXP_FLOOR_REW * X.floor, drop: (1 + E.EXP_FLOOR_REW * X.floor) * (1 + ((fx.drop || 0) + (E.campHas(S, "butin10") ? 10 : 0)) / 100), kamas: 1 + ((fx.kamas || 0)) / 100 };
    return { mons, label, exp: { floor: X.floor, t: d.t, mult, regne: X.regne.god }, fx };
  };
  /* les héros : PV emportés d'un étage à l'autre, reliques et bénédictions (appelé par E.startFight après la création des combattants) */
  E.expHeroes = (S, ents, fx) => {
    const X = X_(S); if (!X) return;
    const heroes = ents.filter((e) => e.side === "c");
    heroes.forEach((e) => {
      if (fx.hp) e.hpMax = Math.round(e.hpMax * (1 + fx.hp / 100));
      const pct = X.hp[e.cid] === undefined ? 100 : X.hp[e.cid];
      e.hp = Math.max(1, Math.round(e.hpMax * (pct <= 0 ? (fx.ko || (E.campHas(S, "phenix") ? 40 : E.EXP_KO)) : pct) / 100));
      if (fx.shield1) e.shield = Math.round(e.hpMax * fx.shield1 / 100);
      if (fx.pa1) e.paBonus = (e.paBonus || 0) + fx.pa1;
      if (fx.cri || fx.po || fx.pm || fx.pa || fx.dcri) e.st = Object.assign({}, e.st, { cri: e.st.cri + (fx.cri || 0), po: (e.st.po || 0) + (fx.po || 0), pm: (e.st.pm || 0) + (fx.pm || 0), pa: e.st.pa + (fx.pa || 0), dcri: (e.st.dcri || 0) + (fx.dcri || 0) });
      if (fx.dr) e.smallDr = (e.smallDr || 0) + fx.dr;
      if (fx.first) e.expFirst = true;
      if (fx.vamp) e.vamp = fx.vamp / 100;
      if (fx.heal) e.healIn = fx.heal;
      if (fx.poison) e.expPoison = fx.poison;
      if (fx.boss || fx.fresh) e.expVs = { boss: fx.boss || 0, fresh: fx.fresh || 0 };
    });
    if (fx.hurt && heroes.length) { const w = heroes.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; w.smallDr = (w.smallDr || 0) + fx.hurt; }
  };
  /* bonus de combat (après applyFightBonuses, qui remet dmgBonus/resBonus à zéro) */
  E.expBonuses = (S, F) => {
    const fx = E.expFx(S);
    F.ents.forEach((e) => { if (e.side !== "c" || e.summon) return; e.dmgBonus += fx.dmg || 0; e.resBonus += fx.res || 0; });
    if (fx.revive) F.expRevive = 1;
  };
  const eclatsFor = (X, t) => (t === "boss" ? 50 + X.floor * 2 : t === "elite" ? 25 + X.floor * 1.4 : 10 + X.floor * 0.7);
  /* victoire d'un étage (appelée par endFight) */
  E.expWin = (S, F) => {
    const X = X_(S); if (!X) return; const d = X.doors[X.door] || { t: "fight" };
    X.fights++;
    const r = F.rewards || { xp: {}, kamas: 0, res: {}, items: [] };
    X.rew.kamas += r.kamas || 0; X.rew.xp += Object.values(r.xp || {}).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(r.xp || {}).length); X.rew.res += Object.values(r.res || {}).reduce((a, b) => a + b, 0); X.rew.items += (r.items || []).length;
    const ec = giveEclats(S, eclatsFor(X, d.t)); if (r) r.eclats = ec;
    F.ents.filter((e) => e.side === "c" && !e.summon).forEach((e) => { X.hp[e.cid] = e.alive ? Math.round(100 * e.hp / e.hpMax) : 0; });
    X.log.push({ f: X.floor, t: d.t, w: 1 });
    if (d.t === "elite") offerRelics(S, X, "rare");
    if (d.t === "boss") {
      if (E.campHas(S, "trousse")) E.team(S).forEach((c) => { const h = X.hp[c.id] === undefined ? 100 : X.hp[c.id]; if (h > 0) X.hp[c.id] = Math.min(100, h + 15); });
      if (X.floor % E.EXP_PALIER === 0) {
        if (X.pot) { applyChest(S, X, X.pot, 2); X.rew.dbl++; S.cnt = S.cnt || {}; S.cnt.expDoubles = (S.cnt.expDoubles || 0) + 1; X.pot = null; }
        const ch = makeChest(S, X); giveEclats(S, ch.eclats); queue(X, { t: "pari", chest: ch });
        S.cnt = S.cnt || {}; const rec = S.cnt.expChestRec !== undefined ? S.cnt.expChestRec : Math.floor((S.cnt.expBestAll || 0) / E.EXP_PALIER) * E.EXP_PALIER;
        if (X.floor > rec) { S.cnt.expChestRec = X.floor; E.addCons(S, "coffre_argent"); note(S, `Nouveau record d'Expédition : palier ${X.floor} ! Coffre en argent offert.`, "rare"); } // 0.1.30
      }
      const pool = Object.keys(E.EXP_BLESS).filter((b) => !X.bless.includes(b));
      const nb = E.campHas(S, "bless2") ? 2 : 1;
      for (let j = 0; j < nb && pool.length > j; j++) { const opts = []; const p2 = pool.slice(); while (opts.length < Math.min(3, p2.length)) opts.push(p2.splice(Math.floor(rnd() * p2.length), 1)[0]); queue(X, { t: "bless", opts }); }
      offerRelics(S, X, "boss");
    }
    if (X.pend.length) X.afterFight = true; else nextFloor(S, X);
  };
  /* défaite : une vie de moins, l'étage se rejoue avec de nouvelles portes ; à zéro, l'expédition s'arrête */
  E.expLose = (S, F) => {
    const X = X_(S); if (!X) return;
    X.fights++;
    const why = F.loss && F.loss.txt ? F.loss.txt : `${F.label} : l'équipe est tombée au tour ${F.round}.`;
    X.lastLoss = { f: X.floor, txt: why, regne: X.regne.god, boss: X.doors[X.door] && X.doors[X.door].t === "boss" };
    if (E.campHas(S, "seconde") && !X.secondUsed) { X.secondUsed = true; note(S, "Seconde chance : cette défaite ne coûte pas de vie.", "rare"); }
    else X.lives--;
    X.log.push({ f: X.floor, t: X.doors[X.door] ? X.doors[X.door].t : "fight", w: 0 });
    if (X.lives <= 0) { endRun(S, X, "fall"); return; }
    X.hp = {}; X.door = null; X.reroll++; X.rerolled = false; X.doors = E.expDoors(S, X);
    note(S, `Défaite à l'étage ${X.floor} : ${X.lives} vie${X.lives > 1 ? "s" : ""} restante${X.lives > 1 ? "s" : ""}. L'équipe se relève et de nouvelles portes apparaissent.`, "warn");
  };
  const endRun = (S, X, how) => {
    X.on = false; S.fight = null;
    const best = X.best; const prev = (S.cnt && S.cnt.expBestAll) || 0;
    S.cnt = S.cnt || {}; if (best > prev) S.cnt.expBestAll = best;
    S.expLast = { t: E.now(), how, floor: X.floor, best, prev, record: best > prev, rew: X.rew, eclats: X.eclats, lives: X.lives, fights: X.fights, relics: X.relics.slice(), bless: X.bless.slice(), lost: X.pot ? X.pot : null, loss: X.lastLoss || null, lvl: X.lvl, dur: E.now() - X.t0 };
    if (X.pot) note(S, `Le coffre du palier ${X.pot.palier} mis en jeu est perdu.`, "warn");
    note(S, how === "fall" ? `Plus de vies : l'expédition s'arrête à l'étage ${X.floor}. Tu gardes tout (${X.eclats} Éclats).` : `Expédition abandonnée à l'étage ${X.floor} : tout est gardé.`, how === "fall" ? "warn" : "info");
    if (X.resume && E.SUBS[X.resume]) { S.hunting = true; S.sub = X.resume; S.pause = E.PAUSE_MS; }
    E.events.push({ kind: "expend" });
    if (E.checkAch) E.checkAch(S);
  };
  E.expQuit = (S) => { const X = X_(S); if (!X) return "Aucune expédition en cours."; endRun(S, X, "quit"); return null; };
  E.expSetAuto = (S, on) => { S.settings.expAuto = !!on; return null; };
  E.expAutoOn = (S) => S.settings.expAuto !== false;

  /* ---------- choix automatiques (joueur absent, simulateur) ---------- */
  E.expAutoDoor = (S) => {
    const X = X_(S); if (!X || X.door !== null || X.pend.length) return null;
    const team = E.team(S); const avg = team.length ? team.reduce((a, c) => a + (X.hp[c.id] === undefined ? 100 : X.hp[c.id]), 0) / team.length : 100;
    const ko = team.some((c) => X.hp[c.id] !== undefined && X.hp[c.id] <= 0);
    const order = (avg < 55 || ko ? ["rest"] : []).concat(["altar", "treasure", "shop", "fight", "elite", "rest", "boss"]);
    for (const t of order) { const d = X.doors.find((x) => x.t === t); if (d) return d.i; }
    return 0;
  };
  E.expAutoChoice = (S) => {
    const X = X_(S); const p = X && X.pend[0]; if (!p) return null;
    if (p.t === "relic") { if (X.relics.length >= E.EXP_RELIC_MAX) return ["no"]; const rank = { l: 3, r: 2, c: 1 }; let bi = 0; p.opts.forEach((id, i) => { if (rank[E.EXP_RELICS[id].r] > rank[E.EXP_RELICS[p.opts[bi]].r]) bi = i; }); return [bi]; }
    if (p.t === "bless") return [0];
    if (p.t === "pari") return [0];
    if (p.t === "shop") { const C = E.camp(S); const i = p.opts.findIndex((o) => !o.sold && o.price <= C.ec && X.relics.length < E.EXP_RELIC_MAX && E.EXP_RELICS[o.id].r !== "c"); return i >= 0 ? [i] : ["no"]; }
    return null;
  };
  /* appelé par E.tick : le jeu choisit à la place du joueur après le délai (si le réglage le permet) */
  E.expTick = (S) => {
    const X = X_(S); if (!X || !E.expAutoOn(S)) return;
    const now = E.now();
    if (X.pend.length) { const p = X.pend[0]; if (now - p.at > E.EXP_AUTO_MS) { const a = E.expAutoChoice(S); if (a) { p.auto = true; E.expChoose(S, ...a); if (X.pend[0] === p) E.expChoose(S, "no"); } } return; }
    if (X.door === null) { X.doorsAt = X.doorsAt || now; if (now - X.doorsAt > E.EXP_DOOR_MS) { X.doorsAt = 0; E.expDoor(S, E.expAutoDoor(S)); } }
    else X.doorsAt = 0;
  };
  /* joue l'expédition en cours d'un coup, avec les choix automatiques (tests et simulateur). Renvoie l'étage atteint. */
  E.expAutoPlay = (S, maxFights = 400) => {
    let n = 0;
    while (E.expActive(S) && n < maxFights) {
      const X = S.exp;
      if (X.pend.length) { const p = X.pend[0]; const a = E.expAutoChoice(S); E.expChoose(S, ...a); if (X.pend[0] === p) E.expChoose(S, "no"); if (X.pend[0] === p) X.pend.shift(); continue; }
      if (X.door === null) { E.expDoor(S, E.expAutoDoor(S)); continue; }
      const F = E.startFight(S); if (!F) { if (!E.expBusy(S)) { X.door = null; X.doors = E.expDoors(S, X); continue; } break; } n++;
      let g = 0; while (!F.over && g++ < 5000) E.step(S);
      if (!F.over) break;
    }
    return S.exp ? S.exp.best : 0;
  };

  /* ---------- actions officielles ---------- */
  Object.assign(E.ACTIONS, { expStart: "partir en expédition", expDoor: "choisir une porte de l'expédition", expChoose: "choisir une relique, une bénédiction ou le pari", expBuy: "acheter une relique au Marchand", expForge: "fusionner deux reliques", expReroll: "relancer les portes", expQuit: "abandonner l'expédition", campBuy: "améliorer le campement", expSetAuto: "choix automatique en expédition" });

  /* ---------- succès, titres, ornement, bulle de découverte ---------- */
  if (E.ACH) {
    const has = (id) => E.ACH.some((a) => a.id === id);
    const add = (o) => { if (!has(o.id)) E.ACH.push(o); };
    const best = (S) => (S.cnt && S.cnt.expBest) || 0;
    add({ id: "exp5", cat: "Expédition", name: "Premiers pas", desc: "Atteindre l'étage 5 de l'Expédition sans fin.", test: (S) => best(S) >= 5, kamas: 1500 });
    add({ id: "exp10", cat: "Expédition", name: "Premier palier", desc: "Atteindre l'étage 10.", test: (S) => best(S) >= 10, kamas: 4000 });
    add({ id: "exp25", cat: "Expédition", name: "Éclaireur", desc: "Atteindre l'étage 25 (titre « Éclaireur »).", test: (S) => best(S) >= 25, kamas: 10000 });
    add({ id: "exp50", cat: "Expédition", name: "Pèlerin des Douze", desc: "Atteindre l'étage 50 (titre « Pèlerin des Douze »).", test: (S) => best(S) >= 50, kamas: 30000 });
    add({ id: "exp75", cat: "Expédition", name: "Fidèle des Douze", desc: "Atteindre l'étage 75 (titre « Fidèle des Douze »).", test: (S) => best(S) >= 75, kamas: 60000 });
    add({ id: "exp100", cat: "Expédition", name: "Élu des Douze", desc: "Atteindre l'étage 100 (titre « Élu des Douze » et ornement « Auréole des Douze »).", test: (S) => best(S) >= 100, kamas: 150000 });
    add({ id: "exprel100", cat: "Expédition", name: "Collectionneur de reliques", desc: "Prendre 100 reliques en expédition.", test: (S) => ((S.cnt && S.cnt.expRelics) || 0) >= 100, kamas: 20000 });
    add({ id: "expdbl10", cat: "Expédition", name: "Joueur d'Ecaflip", desc: "Doubler 10 coffres de palier.", test: (S) => ((S.cnt && S.cnt.expDoubles) || 0) >= 10, kamas: 25000, title: "Joueur d'Ecaflip" });
    add({ id: "expcamp", cat: "Expédition", name: "Campement complet", desc: "Acheter les 24 améliorations du campement.", test: (S) => E.campCount(S) >= E.EXP_CAMP.length, kamas: 50000, title: "Maître du campement" });
  }
  if (E.ORN && !E.ORN.elu) E.ORN.elu = { name: () => "Auréole des Douze", req: "Atteindre l'étage 100 de l'Expédition sans fin", ok: (S) => !!(S.unlocks && S.unlocks.elu) };
  if (E.TIPS && !E.TIPS.some((t) => t.id === "expedition")) E.TIPS.push({ id: "expedition", name: "L'Expédition sans fin", hint: "niveau 10", anchor: '[data-fam="adv"]',
    cond: (S) => S.chars.some((c) => c.lvl >= E.EXP_MIN_LVL),
    txt: "Aventure › Expédition : des étages sans fin à ton niveau, une porte à choisir à chaque étage, des reliques qui s'additionnent et 3 vies. Quand tu tombes, tu gardes tout et tes Éclats améliorent le campement pour la prochaine fois." });

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
