/* ============================================================================
   LE SONGE INFINI — Idlus (0.1.48), remplace l'Expédition sans fin (0.1.24)
   Comme les Songes infinis de DOFUS :
   - Une carte de 26 salles en 5 paliers, la même pour tous chaque semaine. On avance de salle en salle en
     choisissant le couloir : Combat, Combat redoutable (Champions), Archimonstre, Faveur onirique (un bonus
     gratuit, pas de combat), Fontaine onirique (salles 4, 10, 16 et 25 : des vœux achetés avec les points de
     rêve), Gobledore (rare : revenir en arrière, parier ou passer) et la Fin du rêve (salle 26 : des vagues,
     les PV ne remontent pas entre elles).
   - 8 intensités débloquées dans l'ordre : Rêve, Paradoxe 1 à 4, Cauchemar 1 à 3. Le songe est validé quand
     l'équipe tient 1 vague (Rêve), 3 (Paradoxe) ou 5 (Cauchemar) à la Fin du rêve ; on peut continuer ensuite.
   - Une défaite réveille l'équipe (le butin des combats est gardé). Un Sable de Draconiros fait rejouer le combat.
   - Les Bribes de rêve ne tombent qu'à la validation ; elles s'échangent au Marché onirique. Les points de
     rêve se gagnent pendant le songe et s'effacent au réveil, comme les bonus.
     1.0.30 : la moitié des Bribes de la validation tombe vague par vague (gardée même sans valider), le reste à la
     validation : un songe validé rapporte autant qu'avant. Marché onirique : 3 offres de plus chaque semaine.
     Classement de la semaine : intensité validée puis vagues, record vérifié par le serveur (E.sgReplay, fonction « record »).
   - Monstres au niveau de l'équipe, dès le niveau 10. Objets légendaires possibles à la validation (js/legendaires.js).
   Le moteur garde les noms de l'Expédition (S.exp, E.expFight, E.expWin…) : engine.js les appelle déjà.
   Pas de DOM ici : l'interface est dans js/songeui.js. Chargé aussi par les tests et le simulateur.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { DUNGEONS, MONSTERS, ITEMS, RES } = D;
  const rnd = () => E.rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const note = (S, t, k) => E.note(S, t, k);
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const seeded = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ---------- réglages ---------- */
  E.EXP_MIN_LVL = 10;          // niveau du meilleur héros pour entrer
  E.SG_ROOMS = 26;
  E.SG_FOUNTS = [4, 10, 16, 25];
  E.SG_PALIERS = [[1, 3, "Les Pensées oniriques"], [4, 9, "Les Balades fantastiques"], [10, 15, "Les Espaces imaginaires"], [16, 21, "Les Concepts brumeux"], [22, 26, "Les Abstractions chimériques"]];
  /* intensités : bonus de butin, vagues à tenir pour valider, difficulté de départ (stasis équivalente).
     Simulation 0.1.48 (npm run sim -- --songe) : sans équipement au plus le Rêve, bon équipement Paradoxe 1-3, équipe optimisée Paradoxe 4 - Cauchemar 3. */
  const I = (id, name, loot, waves, base, col) => ({ id, name, loot, waves, base, col });
  E.SG_INT = [
    I("reve", "Rêve", 0, 1, 1.5, "#5fd8d0"), I("p1", "Paradoxe 1", 20, 3, 4.5, "#b8a6ff"), I("p2", "Paradoxe 2", 60, 3, 5.5, "#a58bff"), I("p3", "Paradoxe 3", 110, 3, 6.5, "#8f6bff"),
    I("p4", "Paradoxe 4", 190, 3, 7.5, "#7a4dff"), I("c1", "Cauchemar 1", 250, 5, 8.5, "#ff8aa0"), I("c2", "Cauchemar 2", 320, 5, 9.5, "#ff6f86"), I("c3", "Cauchemar 3", 400, 5, 10.5, "#ff4a6a"),
  ];
  E.SG_STEP = 0.1;             // difficulté en plus par salle
  E.SG_WAVE = 0.35;            // et par vague de la Fin du rêve
  E.SG_HARD = 0.8; E.SG_ARCHI = 0.5;
  E.SG_PTS = { fight: 3, hard: 6, archi: 8, favor: 2, gob: 3 };
  E.SG_STORM = 6;              // Tempête astrale : relancer les vœux
  E.SG_BET = 10;               // mise du Gobledore
  E.EXP_AUTO_MS = 20000;       // choix automatique (faveur, fontaine, vague…) après ce délai
  E.EXP_DOOR_MS = 30000;       // choix automatique du couloir
  E.EXP_KO = 15;               // PV (%) d'un héros à terre à la salle suivante
  E.EXP_ZONE = 10;             // zones de niveau ± 10 autour de l'équipe
  E.SG_ROOM_REW = 0.02;        // XP : +2 % par salle
  /* titres (gardés de l'Expédition) : donnés à la validation d'une intensité */
  E.EXP_TITLES = [[2, "Éclaireur"], [4, "Pèlerin des Douze"], [5, "Fidèle des Douze"], [7, "Élu des Douze"]];
  E.SG_MODES = { prudent: "Prudent", equilibre: "Équilibré", gourmand: "Gourmand" };

  E.sgStasis = (ii, d, kind, wave) => E.SG_INT[ii].base + E.SG_STEP * (d - 1) + (kind === "hard" ? E.SG_HARD : kind === "archi" ? E.SG_ARCHI : 0) + (wave ? E.SG_WAVE * (wave - 1) : 0);
  E.expMonMult = (k) => ({ hp: 1 + 0.12 * (k - 1), dmg: Math.pow(1.2, k - 1) });
  E.expActive = (S) => !!(S && S.exp && S.exp.on);
  const X_ = (S) => (E.expActive(S) ? S.exp : null);
  const FIGHT = ["fight", "hard", "archi", "end"];
  E.sgNode = (X, i) => (X && i !== null && i !== undefined ? X.nodes[i] : null);
  /* un combat du songe est prêt à partir (salle de combat choisie, aucun choix en attente) */
  E.expBusy = (S) => { const X = S && S.exp; const n = X && X.on && !X.pend.length && E.sgNode(X, X.pick); return !!(n && FIGHT.includes(n.t)); };

  /* ---------- le modificateur de la semaine (à partir de Paradoxe 1) ---------- */
  E.EXP_REGNES = [
    { mod: "enrages", god: "Iop", cls: "iop" }, { mod: "blindes", god: "Féca", cls: "feca" }, { mod: "vampires", god: "Sram", cls: "sram" }, { mod: "nombreux", god: "Osamodas", cls: "osa" },
    { mod: "champions", god: "Ecaflip", cls: "eca" }, { mod: "ruse", god: "Sadida", cls: "sadi" }, { mod: "renforts", god: "Enutrof", cls: "enu" },
  ];
  E.sgRegne = (w) => E.EXP_REGNES[hash(`idlus|songe|regne|${w}`) % E.EXP_REGNES.length];

  /* ---------- bonus du songe : les 24 reliques, plus les petits bonus des salles de combat ---------- */
  /* fx en % sauf : po, pm, pa (points), pa1 (PA au 1er tour), first (joue en premier), revive, sable, mirror */
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
    oeuf:    R("oeuf", "l", "Œuf Doré", "Œuf de Larve Dorée", "+1 Sable de Draconiros (rejouer un combat perdu)", { sable: 1 }),
    pelle:   R("pelle", "l", "Pelle de Mansot", "Pied de Mansot", "butin et kamas ×2", { drop: 100, kamas: 100 }),
    dofus:   R("dofus", "l", "Dofus fêlé", "Œuf Chimérique", "+1 PA", { pa: 1 }),
    miroir:  R("miroir", "l", "Miroir d'Ilyzaelle", "Plume d'Ilyzaelle", "copie le bonus pris juste avant", { mirror: 1 }),
  };
  E.EXP_RARITY = { c: "Commun", r: "Rare", l: "Légendaire" };
  const relicsOf = (r) => Object.values(E.EXP_RELICS).filter((x) => x.r === r).map((x) => x.id);
  const PCT_FX = ["dmg", "hp", "cri", "dr", "heal", "kamas", "drop", "res", "boss", "mon", "poison", "shield1", "vamp", "hurt", "fresh", "dcri"];
  /* petits bonus gagnés en gagnant une salle de combat */
  E.SG_MINOR = { dmg: [3, "de dégâts"], hp: [4, "de PV"], cri: [2, "de critique"], res: [3, "de résistances"], heal: [5, "aux soins reçus"], drop: [6, "de butin"], kamas: [8, "de kamas"], dr: [2, "de dégâts subis en moins"] };

  /* ---------- progrès permanent : Bribes de rêve, Marché onirique ---------- */
  E.BRIBES = "Bribes de rêve";
  E.songe = (S) => {
    if (!S.songe || typeof S.songe !== "object") S.songe = { br: 0, tot: 0, ups: {}, unl: 0, best: null, wk: null, runs: 0 };
    const G = S.songe; if (!G.ups) G.ups = {}; if (G.unl === undefined) G.unl = 0;
    return G;
  };
  E.sgUp = (S, id) => !!(S.songe && S.songe.ups && S.songe.ups[id]);
  E.sgGive = (S, n) => { const G = E.songe(S); const v = Math.max(0, Math.round(n)); G.br += v; G.tot = (G.tot || 0) + v; const X = X_(S); if (X) X.bribes = (X.bribes || 0) + v; return v; };
  E.sgWeek = (S) => { const G = E.songe(S); const w = E.weekIdx(); if (!G.wk || G.wk.w !== w) G.wk = { w, ii: -1, waves: 0, runs: 0 }; return G.wk; };
  const better = (a, b) => !b || a.ii > b.ii || (a.ii === b.ii && a.waves > b.waves);
  /* le Marché onirique */
  const M = (id, kind, name, price, desc, extra) => Object.assign({ id, kind, name, price, desc }, extra || {});
  E.SG_SHOP = [
    M("coffre_or", "coffre", "Coffre en or", 600, "Contenu selon ton niveau", { cons: "coffre_or" }),
    M("coffre_obsidienne", "coffre", "Coffre d'obsidienne", 2000, "Le meilleur coffre du jeu", { cons: "coffre_obsidienne" }),
    M("poussiere", "coffre", "Poussière de stasis ×20", 350, "Pour la forgemagie", { dust: 20 }),
    M("draco", "look", "Draconiros miniature", 10000, "Familier exclusif du Songe (+70 Puissance, +5 % de critique)", { once: 1 }),
    M("brume", "look", "Brume onirique", 4000, "Ornement : une brume violette autour du héros", { once: 1 }),
    M("titre", "look", "« Songeur infini »", 6000, "Titre à afficher, dans le chat aussi", { once: 1 }),
    M("cadre", "look", "Cadre des Songes", 8000, "Cadre de héros animé, à mettre ou retirer ici", { once: 1 }),
    M("prevoyant", "up", "Songeur prévoyant", 1500, "Chaque songe commence avec 10 points de rêve", { once: 1 }),
    M("sablepoche", "up", "Sable en poche", 3000, "Un Sable de Draconiros offert à chaque songe", { once: 1 }),
    M("faveurs", "up", "Faveurs généreuses", 2500, "Les Faveurs proposent 4 choix au lieu de 3", { once: 1 }),
  ];
  E.SG_SHOP_KIND = { coffre: "Coffres", look: "Apparence", up: "Améliorations" };
  E.sgOwned = (S, id) => E.sgUp(S, id);
  E.sgBuy = (S, id) => {
    const o = E.SG_SHOP.find((x) => x.id === id); if (!o) return "Article inconnu.";
    const G = E.songe(S); if (o.once && G.ups[id]) return "Déjà échangé.";
    if (G.br < o.price) return `Il faut ${o.price.toLocaleString("fr-FR")} Bribes de rêve (tu en as ${G.br.toLocaleString("fr-FR")}).`;
    G.br -= o.price; if (o.once) G.ups[id] = E.now();
    if (o.cons) E.addCons(S, o.cons);
    if (o.dust) E.addRes(S, E.POUSSIERE, o.dust);
    if (id === "draco" && E.givePet) E.givePet(S, "draconiros_mini", "Marché onirique");
    if (id === "brume") { S.unlocks = S.unlocks || {}; S.unlocks.brume = 1; }
    if (id === "titre") { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes("Songeur infini")) S.titlesExtra.push("Songeur infini"); }
    if (id === "cadre") { S.unlocks = S.unlocks || {}; S.unlocks.cadreSonge = 1; S.settings.cadreSonge = true; }
    note(S, `Marché onirique : ${o.name} contre ${o.price.toLocaleString("fr-FR")} Bribes de rêve.`, "up");
    if (E.checkAch) E.checkAch(S);
    return null;
  };
  E.sgCadre = (S, on) => { if (!(S.unlocks && S.unlocks.cadreSonge)) return "Cadre des Songes : à échanger au Marché onirique."; S.settings.cadreSonge = !!on; return null; };
  /* 1.0.30 : le Marché onirique tournant. Chaque lundi, 3 offres de plus, les mêmes pour tous, en quantité limitée par semaine. */
  const W_ = (id, name, price, lim, extra) => Object.assign({ id, kind: "wk", name, price, lim }, extra || {});
  E.SG_WEEK_POOL = [
    W_("w_royal", "Bonbon Royal", 400, 3, { cons: "bonbon_royal" }),
    W_("w_traqueur", "Bonbon Traqueur", 300, 3, { cons: "bonbon_traqueur" }),
    W_("w_sagesse", "Bonbon Sagesse", 250, 3, { cons: "bonbon_sagesse" }),
    W_("w_cristal", "Cristal de Forgemagie", 800, 2, { cons: "cristal_fm" }),
    W_("w_fiole", "Fiole de Résurrection", 300, 3, { cons: "fiole_resu" }),
    W_("w_savoir", "Potion de Savoir", 400, 2, { cons: "potion_savoir" }),
    W_("w_argent", "Coffre en argent", 250, 5, { cons: "coffre_argent" }),
    W_("w_douze", "Coffre des Douze", 5000, 1, { cons: "coffre_douze" }),
    W_("w_dust", "Poussière de stasis ×50", 800, 3, { dust: 50, desc: "Pour la forgemagie" }),
    W_("w_trans", "Rune de transcendance", 3000, 1, { trans: 1 }),
    W_("w_parch", "Grand parchemin", 500, 5, { parch: 1 }),
  ];
  const PARCH = ["fo", "ine", "cha", "age", "vit", "sa"];
  E.sgWeekShop = (w) => {
    if (w === undefined) w = E.weekIdx();
    const rng = seeded(hash(`idlus|songe|marche|${w}`)); const pool = E.SG_WEEK_POOL.slice(); const out = [];
    while (out.length < 3 && pool.length) {
      const o = Object.assign({}, pool.splice(Math.floor(rng() * pool.length), 1)[0]); const r2 = rng();
      if (o.parch) { o.cons = `parch_${PARCH[Math.floor(r2 * PARCH.length)]}_g`; }
      if (o.trans) { const tk = Object.keys(E.TRANS || {}); if (!tk.length) continue; o.stat = tk[Math.floor(r2 * tk.length)]; o.name = E.runeName ? E.runeName(E.transKey(o.stat)) : o.name; o.desc = "Réussite garantie, puis l'objet ne se forgemage plus"; }
      const C = o.cons && D.CONSUMABLES[o.cons]; if (o.cons && !C) continue;
      if (C) { o.name = C.name; if (!o.desc) o.desc = C.desc; }
      out.push(o);
    }
    return out;
  };
  const mkWeek = (S) => { const G = E.songe(S); const w = E.weekIdx(); if (!G.mk || G.mk.w !== w) G.mk = { w, n: {} }; return G.mk; };
  E.sgWeekLeft = (S, id) => { const o = E.sgWeekShop().find((x) => x.id === id); return o ? Math.max(0, o.lim - (mkWeek(S).n[id] || 0)) : 0; };
  E.sgBuyWeek = (S, id) => {
    const o = E.sgWeekShop().find((x) => x.id === id); if (!o) return "Cette offre n'est plus au Marché cette semaine.";
    const G = E.songe(S); const mk = mkWeek(S);
    if ((mk.n[id] || 0) >= o.lim) return "Plus rien cette semaine : nouvelles offres lundi.";
    if (G.br < o.price) return `Il faut ${o.price.toLocaleString("fr-FR")} Bribes de rêve (tu en as ${G.br.toLocaleString("fr-FR")}).`;
    G.br -= o.price; mk.n[id] = (mk.n[id] || 0) + 1;
    if (o.cons) E.addCons(S, o.cons);
    if (o.dust) E.addRes(S, E.POUSSIERE, o.dust);
    if (o.trans && o.stat) { const rk = E.transKey(o.stat); S.runes[rk] = (S.runes[rk] || 0) + 1; }
    note(S, `Marché onirique : ${o.name} contre ${o.price.toLocaleString("fr-FR")} Bribes de rêve.`, "up");
    return null;
  };
  /* 0.1.48 : conversion de l'Expédition : Éclats ×5 en Bribes, 150 Bribes par amélioration du campement, record et titres gardés */
  E.sgConvert = (S) => {
    // 1.0.10.4 : le résultat d'une ancienne Expédition (sans intensité) faisait planter la page du Songe : on l'oublie
    if (S.expLast && !(S.expLast.ii >= 0 && E.SG_INT[S.expLast.ii])) S.expLast = null;
    const G = E.songe(S); if (G.conv) return null; G.conv = 1;
    const C = S.camp && typeof S.camp === "object" ? S.camp : null; const ec = C ? Math.max(0, Math.round(C.ec || 0)) : 0;
    const ups = C && C.ups ? Object.keys(C.ups).length : 0; const br = ec * 5 + ups * 150;
    if (S.exp && !S.exp.sg) S.exp = null; // une expédition en cours s'arrête (rien n'est perdu)
    if (!br && !(S.cnt && S.cnt.expBestAll)) return null;
    G.br += br; G.tot = (G.tot || 0) + br;
    G.from = { ec, ups, br, floor: (S.cnt && (S.cnt.expBestAll || S.cnt.expBest)) || 0 };
    if (C) { C.ec = 0; C.conv = 1; }
    return G.from;
  };

  /* ---------- la carte de la semaine : 26 salles, 3 couloirs ---------- */
  E.sgMap = (w) => {
    const rng = seeded(hash(`idlus|songe|carte|${w}`)); const N = [];
    for (let d = 1; d <= E.SG_ROOMS; d++) {
      const single = d <= 3 || E.SG_FOUNTS.includes(d) || d === E.SG_ROOMS;
      const lanes = single ? [1] : d % 3 === 0 ? [0, 2] : [0, 1, 2];
      for (const l of lanes) {
        let t = "fight";
        if (d === E.SG_ROOMS) t = "end"; else if (E.SG_FOUNTS.includes(d)) t = "fount";
        else if (d > 3) { const r = rng(); t = r < 0.16 ? "favor" : r < 0.29 ? "hard" : r < 0.35 ? "archi" : r < 0.38 ? "gob" : "fight"; }
        N.push({ i: N.length, d, l, t, pips: t === "fight" ? 1 + (rng() < 0.5 ? 1 : 0) : t === "hard" || t === "archi" ? 3 : 0, nx: [] });
      }
    }
    /* chaque salle touche les salles du rang suivant à un couloir d'écart (toutes, si l'un des deux rangs n'a qu'une salle) */
    N.forEach((n) => { const nx = N.filter((m) => m.d === n.d + 1); const one = nx.length === 1 || N.filter((k) => k.d === n.d).length === 1; nx.forEach((m) => { if (one || Math.abs(m.l - n.l) <= 1) n.nx.push(m.i); }); });
    /* au moins un couloir de combat simple en sortant de chaque salle : jamais forcé dans un combat redoutable */
    return N;
  };
  E.sgPalier = (d) => E.SG_PALIERS.findIndex(([a, b]) => d >= a && d <= b);
  /* salles où l'on peut aller maintenant */
  E.sgNext = (X) => { if (!X) return []; if (X.at === null) return X.nodes.filter((n) => n.d === 1).map((n) => n.i); return X.nodes[X.at].nx.slice(); };

  /* ---------- zones et donjons autour du niveau de l'équipe ---------- */
  const subsNear = (L) => {
    const all = Object.values(E.SUBS).filter((s) => !s.hidden && s.monsters && s.monsters.length);
    const near = all.filter((s) => s.lvl[1] >= L - E.EXP_ZONE && s.lvl[0] <= L + E.EXP_ZONE);
    if (near.length) return near;
    const dist = (s) => Math.min(Math.abs(s.lvl[0] - L), Math.abs(s.lvl[1] - L));
    return all.sort((a, b) => dist(a) - dist(b)).slice(0, 3);
  };
  const dgsNear = (L) => {
    const ids = Object.keys(DUNGEONS).sort().filter((d) => DUNGEONS[d].rooms && DUNGEONS[d].rooms.length && !DUNGEONS[d].gboss);
    const near = ids.filter((d) => DUNGEONS[d].lvl >= L - 15 && DUNGEONS[d].lvl <= L + 10);
    if (near.length) return near;
    return ids.sort((a, b) => Math.abs(DUNGEONS[a].lvl - L) - Math.abs(DUNGEONS[b].lvl - L)).slice(0, 2);
  };
  E.sgSubsNear = subsNear; E.sgDgsNear = dgsNear;
  /* le contenu d'une salle (monstres), tiré de la semaine, du niveau de l'équipe et de la salle : le même pour tous à niveau égal */
  E.sgRoom = (S, X, n) => {
    if (n.c && n.c.lvl === X.lvl && n.c.r === (X.retry || 0)) return n.c;
    const rng = seeded(hash(`idlus|songe|${X.w}|${X.lvl}|${n.i}|${X.retry || 0}`)); const team = Math.max(1, E.team(S).length);
    const c = { lvl: X.lvl, r: X.retry || 0 };
    if (n.t === "fight" || n.t === "hard" || n.t === "archi") {
      let subs = subsNear(X.lvl);
      if (n.t === "archi") { const ok = subs.filter((s) => s.monsters.some((m) => MONSTERS[m] && MONSTERS[m].archi)); if (ok.length) subs = ok; }
      const sub = subs[Math.floor(rng() * subs.length)];
      let k = clamp(Math.round((2 + Math.floor(rng() * 2) + (n.pips > 1 ? 1 : 0)) * (0.3 + team * 0.25)) + (X.regne && X.ii > 0 && X.regne.mod === "nombreux" ? 1 : 0), 1, 8);
      if (n.t === "hard") k = Math.max(1, k - 1);
      const mons = []; for (let i = 0; i < k; i++) mons.push({ id: sub.monsters[Math.floor(rng() * sub.monsters.length)], lvl: Math.max(1, X.lvl + Math.floor(rng() * 5) - 2) });
      if (n.t === "hard") { const nc = k >= 4 ? 2 : 1; const keys = Object.keys(E.CHAMP_POWERS); for (let i = 0; i < nc; i++) mons[i].champ = keys[Math.floor(rng() * keys.length)]; }
      if (n.t === "archi") { const j = mons.findIndex((m) => MONSTERS[m.id] && MONSTERS[m.id].archi); const a = j >= 0 ? j : 0; mons[a].archi = !!(MONSTERS[mons[a].id] && MONSTERS[mons[a].id].archi); if (a) mons.unshift(mons.splice(a, 1)[0]); }
      c.sub = sub.id; c.mons = mons;
      const mk = Object.keys(E.SG_MINOR); c.minor = mk[Math.floor(rng() * mk.length)];
    }
    if (n.t === "end") { const ids = dgsNear(X.lvl); c.dgs = [0, 1, 2, 3, 4, 5, 6, 7].map(() => ids[Math.floor(rng() * ids.length)]); }
    n.c = c; return c;
  };

  /* ---------- l'état du songe ---------- */
  E.expCanStart = (S, ii = 0) => {
    const team = E.team(S); if (!team.length) return "Il faut au moins un héros dans l'équipe.";
    if (Math.max(...team.map((c) => c.lvl)) < E.EXP_MIN_LVL) return `Le Songe infini s'ouvre au niveau ${E.EXP_MIN_LVL}.`;
    if (S.dungeon) return "Termine d'abord le donjon.";
    if (E.expActive(S)) return "Un songe est déjà en cours.";
    if (ii > E.songe(S).unl) return `Valide d'abord ${E.SG_INT[ii - 1].name}.`;
    return null;
  };
  const queue = (X, p) => { p.at = E.now(); p.id = (X.pseq = (X.pseq || 0) + 1); X.pend.push(p); };
  E.expStart = (S, ii) => {
    ii = clamp(Math.round(+ii || 0), 0, E.SG_INT.length - 1);
    const err = E.expCanStart(S, ii); if (err) return err;
    const team = E.team(S); const wasHunt = S.hunting && S.sub ? S.sub : null;
    S.hunting = false; S.fight = null; S.pause = E.PAUSE_MS; S.protector = null;
    const w = E.weekIdx();
    const X = S.exp = {
      on: true, sg: 1, w, ii, t0: E.now(), lvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length), nodes: E.sgMap(w), at: null, pick: null, path: [],
      relics: [], minor: {}, pts: E.sgUp(S, "prevoyant") ? 10 : 0, sable: E.sgUp(S, "sablepoche") ? 1 : 0, pend: [], hp: {}, log: [], gobUsed: false,
      rew: { kamas: 0, xp: 0, dust: 0, res: 0, items: 0 }, bribes: 0, fights: 0, wave: 0, waves: 0, valid: false, resume: wasHunt, retry: 0, regne: E.sgRegne(w),
    };
    const wk = E.sgWeek(S); wk.runs++; const G = E.songe(S); G.runs = (G.runs || 0) + 1; S.cnt = S.cnt || {}; S.cnt.expRuns = (S.cnt.expRuns || 0) + 1;
    note(S, `Le songe commence : ${E.SG_INT[ii].name}, équipe niveau ${X.lvl}.`, "info");
    return null;
  };
  const avgHp = (S, X) => { const t = E.team(S); return t.length ? t.reduce((a, c) => a + (X.hp[c.id] === undefined ? 100 : Math.max(0, X.hp[c.id])), 0) / t.length : 100; };
  E.sgAvgHp = (S) => (X_(S) ? Math.round(avgHp(S, S.exp)) : 100);
  const heal = (S, X, pct, revive) => E.team(S).forEach((c) => { const h = X.hp[c.id] === undefined ? 100 : X.hp[c.id]; if (h <= 0 && !revive) return; X.hp[c.id] = Math.min(100, Math.max(h, 0) + pct); });
  const takeRelic = (S, X, id) => {
    const r = E.EXP_RELICS[id]; if (!r || X.relics.includes(id)) return false;
    X.relics.push(id); S.cnt = S.cnt || {}; S.cnt.expRelics = (S.cnt.expRelics || 0) + 1;
    if (r.fx.sable) X.sable += r.fx.sable;
    note(S, `Bonus du songe : ${r.name} (${r.desc}).`, r.r === "l" ? "rare" : "up");
    return true;
  };
  const freeRelics = (X, r) => relicsOf(r).filter((id) => !X.relics.includes(id));
  /* les offres d'une Faveur onirique : un bonus (deux avec Faveurs généreuses), un soin, des points */
  const favorOffers = (S, X) => {
    const o = []; const pool = freeRelics(X, "c").concat(freeRelics(X, rnd() < 0.4 ? "r" : "c"));
    const nRel = E.sgUp(S, "faveurs") ? 2 : 1;
    for (let i = 0; i < nRel; i++) { const a = pool.filter((id) => !o.some((x) => x.id === id)); if (a.length) o.push({ k: "relic", id: pick(a) }); }
    o.push({ k: "heal", v: 40 }); o.push({ k: "pts", v: 8 });
    return o;
  };
  /* les cinq vœux d'une Fontaine onirique, payés en points de rêve */
  const fountOffers = (S, X) => {
    const o = []; const take = (r, price) => { const a = freeRelics(X, r).filter((id) => !o.some((x) => x.id === id)); if (!a.length) return false; o.push({ k: "relic", id: pick(a), price }); return true; };
    for (let i = 0; i < 2; i++) take("l", 25) || take("r", 18) || take("c", 12);
    take("r", 18) || take("c", 12);
    o.push({ k: "heal", v: 100, price: 12 }); o.push({ k: "sable", price: 12 });
    return o;
  };
  /* choisir la salle suivante : les combats partent au prochain pas de la boucle, le reste se résout tout de suite */
  E.expDoor = (S, i) => {
    const X = X_(S); if (!X) return "Aucun songe en cours.";
    if (X.pend.length) return "Fais d'abord ton choix.";
    if (X.pick !== null) return "La salle est déjà choisie.";
    i = +i; if (!E.sgNext(X).includes(i)) return "Cette salle n'est pas reliée à la tienne.";
    const n = X.nodes[i]; X.pick = i; X.pickAt = E.now(); X.retry = 0;
    if (FIGHT.includes(n.t)) { if (n.t === "end" && !X.wave) X.wave = 1; S.fight = null; S.pause = E.PAUSE_MS; return null; }
    if (n.t === "favor") { X.pts += E.SG_PTS.favor; queue(X, { t: "favor", opts: favorOffers(S, X) }); }
    if (n.t === "fount") queue(X, { t: "fount", opts: fountOffers(S, X) });
    if (n.t === "gob") { if (X.gobUsed) { X.pts += E.SG_PTS.gob; note(S, `Le Gobledore est déjà passé : +${E.SG_PTS.gob} points de rêve.`, "info"); } else { X.gobUsed = true; queue(X, { t: "gob", back: X.path.length >= 2 ? X.path[X.path.length - 2] : null }); } }
    if (!X.pend.length) arrive(S, X);
    return null;
  };
  /* l'équipe entre dans la salle choisie */
  const arrive = (S, X) => {
    const n = X.nodes[X.pick]; if (!n) return;
    X.at = n.i; X.path.push(n.i); X.pick = null; X.log.push({ d: n.d, t: n.t, w: 1 });
    S.cnt = S.cnt || {}; S.cnt.expFloors = (S.cnt.expFloors || 0) + 1;
    if (E.checkAch) E.checkAch(S);
  };

  /* ---------- choix en attente : faveur, fontaine, Gobledore, vague suivante, Sable ---------- */
  E.expPending = (S) => { const X = X_(S); return X && X.pend.length ? X.pend[0] : null; };
  const resolved = (S, X) => { const p = X.pend.shift(); if (!X.pend.length && X.pick !== null && p && ["favor", "fount", "gob"].includes(p.t)) arrive(S, X); };
  /* i : index de l'option, "no" pour partir (fontaine) ou se réveiller (vague, Sable), "storm" pour la Tempête astrale */
  E.expChoose = (S, i) => {
    const X = X_(S); const p = X && X.pend[0]; if (!p) return "Rien à choisir.";
    if ((p.t === "favor" || p.t === "fount") && i === "storm") {
      if (X.pts < E.SG_STORM) return `La Tempête astrale coûte ${E.SG_STORM} points de rêve.`;
      X.pts -= E.SG_STORM; p.opts = p.t === "favor" ? favorOffers(S, X) : fountOffers(S, X); p.storms = (p.storms || 0) + 1; return null;
    }
    if (p.t === "favor") {
      const o = p.opts[+i]; if (!o) return "Choix inconnu.";
      if (o.k === "relic") takeRelic(S, X, o.id); else if (o.k === "heal") { heal(S, X, o.v, false); note(S, `Faveur : l'équipe récupère ${o.v} % de ses PV.`, "info"); } else X.pts += o.v;
      resolved(S, X); return null;
    }
    if (p.t === "fount") { if (i === "no") { resolved(S, X); return null; } return E.expBuy(S, i); }
    if (p.t === "gob") {
      if (i === "back" || +i === 0) { if (p.back === null || p.back === undefined) return "Pas de salle où revenir."; X.pend.shift(); X.pick = null; X.at = p.back; X.path = X.path.slice(0, X.path.lastIndexOf(p.back) + 1); note(S, "Le Gobledore plie le songe : l'équipe revient deux salles en arrière.", "info"); return null; }
      if (i === "bet" || +i === 1) { if (X.pts < E.SG_BET) return `La mise est de ${E.SG_BET} points de rêve.`; const win = rnd() < 0.5; X.pts += win ? E.SG_BET : -E.SG_BET; S.cnt = S.cnt || {}; if (win) S.cnt.sgBets = (S.cnt.sgBets || 0) + 1; note(S, win ? `Pari gagné : +${E.SG_BET} points de rêve !` : `Pari perdu : −${E.SG_BET} points de rêve.`, win ? "rare" : "warn"); resolved(S, X); return null; }
      X.pts += E.SG_PTS.gob; resolved(S, X); return null;
    }
    if (p.t === "wave") { X.pend.shift(); if (i === "no") { endRun(S, X, "wake"); return null; } X.wave++; X.retry = 0; S.fight = null; S.pause = E.PAUSE_MS; return null; }
    if (p.t === "sable") {
      X.pend.shift();
      if (i === "no" || X.sable <= 0) { endRun(S, X, "fall"); return null; }
      X.sable--; X.retry = (X.retry || 0) + 1; X.sableUsed = (X.sableUsed || 0) + 1; heal(S, X, 50, true); note(S, "Sable de Draconiros : le temps se rembobine, l'équipe rejoue le combat (50 % de PV en plus).", "rare");
      S.fight = null; S.pause = E.PAUSE_MS; return null;
    }
    return "Choix inconnu.";
  };
  E.expBuy = (S, i) => {
    const X = X_(S); const p = X && X.pend[0]; if (!p || p.t !== "fount") return "Pas de Fontaine ici.";
    const o = p.opts[+i]; if (!o || o.sold) return "Déjà pris.";
    if (X.pts < o.price) return `Il faut ${o.price} points de rêve (tu en as ${X.pts}).`;
    X.pts -= o.price; o.sold = true;
    if (o.k === "relic") takeRelic(S, X, o.id);
    if (o.k === "heal") { heal(S, X, 100, true); note(S, "Source de vie : l'équipe récupère tous ses PV.", "info"); }
    if (o.k === "sable") { X.sable++; note(S, "Sable de Draconiros : un combat perdu pourra être rejoué.", "info"); }
    return null;
  };

  /* ---------- le combat d'une salle (appelé par E.startFight) ---------- */
  E.expFight = (S, team) => {
    const X = X_(S); if (!X || X.pend.length || X.pick === null) return null;
    const n = X.nodes[X.pick]; if (!n || !FIGHT.includes(n.t)) return null;
    const c = E.sgRoom(S, X, n); const ME = E.monsterEntity; const mod = X.ii > 0 && X.regne ? X.regne.mod : null;
    const k = E.sgStasis(X.ii, n.d, n.t, n.t === "end" ? X.wave : 0); const Mm = E.expMonMult(k);
    let mons = [];
    if (n.t === "end") {
      const did = c.dgs[(X.wave - 1) % c.dgs.length]; const dg = DUNGEONS[did]; const bm = MONSTERS[dg.boss];
      const boss = ME(dg.boss, Math.max(bm.lvl[0], X.lvl + 2));
      boss.hpMax = boss.hp = Math.round(boss.hpMax * (1 + team.length * 1.1) / 5);
      boss.mech = E.bossMechs(did).slice(); boss.mturn = 0;
      const pool = E.mechPool(dg.lvl); const more = (m) => { const keys = pool.filter((x) => !boss.mech.includes(x)); while (m-- > 0 && keys.length) boss.mech.push(keys.splice(Math.floor(rnd() * keys.length), 1)[0]); };
      if (mod === "ruse") more(1); if (X.ii >= 3) more(1); if (X.ii >= 5) boss.phase2 = true;
      mons = [boss];
      const extra = clamp(team.length - 1 + (mod === "renforts" ? 2 : 0), 0, 7);
      for (let i = 0; i < extra; i++) mons.push(ME(pick(dg.bossMobs), Math.max(1, X.lvl - Math.floor(rnd() * 3) - 1)));
    } else {
      mons = c.mons.map((m) => { const e = ME(m.id, m.lvl, { archi: !!m.archi }); if (m.champ) E.makeChampion(e, m.champ); return e; });
      if (mod === "champions" && !mons.some((m) => m.champ)) E.makeChampion(mons[mons.length - 1]);
    }
    const fx = E.expFx(S);
    mons.forEach((m) => {
      m.hpMax = m.hp = Math.round(m.hpMax * Mm.hp); m.dmg *= Mm.dmg * (1 - (fx.mon || 0) / 100);
      if (mod === "blindes") m.shield = Math.round(m.hpMax * 0.15);
      if (mod === "vampires") m.vamp = Math.max(m.vamp || 0, 0.15);
      if (mod === "enrages") m.enrageMod = true;
    });
    const sub = c.sub ? E.SUBS[c.sub] : null; const INT = E.SG_INT[X.ii];
    const label = n.t === "end" ? `Fin du rêve · vague ${X.wave} — ${MONSTERS[DUNGEONS[c.dgs[(X.wave - 1) % c.dgs.length]].boss].name}` : `Salle ${n.d} · ${n.t === "hard" ? "Combat redoutable" : n.t === "archi" ? "Archimonstre" : sub ? sub.name : "Combat"}`;
    const loot = (1 + INT.loot / 100) * (n.t === "archi" ? 2 : 1);
    const mult = { xp: 1 + E.SG_ROOM_REW * n.d, drop: loot * (1 + (fx.drop || 0) / 100), kamas: (1 + INT.loot / 200) * (1 + (fx.kamas || 0) / 100) };
    return { mons, label: `Songe infini · ${label}`, exp: { floor: n.d, t: n.t, mult, regne: X.regne ? X.regne.god : "", wave: X.wave, ii: X.ii }, fx };
  };
  /* effets cumulés : bonus du songe (reliques) + petits bonus des salles */
  E.expFx = (S) => {
    const X = S.exp; const fx = {}; if (!X) return fx;
    const add = (f) => { for (const k in f) fx[k] = (fx[k] || 0) + f[k]; };
    X.relics.forEach((id, i) => { const r = E.EXP_RELICS[id]; if (!r) return; if (r.fx.mirror) { const p = E.EXP_RELICS[X.relics[i - 1]]; if (p && !p.fx.mirror && !p.fx.sable) add(p.fx); } else if (!r.fx.sable) add(r.fx); });
    add(X.minor || {});
    return fx;
  };
  E.expFxTxt = (fx) => {
    const T = { dmg: "de dégâts", hp: "de PV", cri: "de critique", dr: "de dégâts subis en moins", heal: "aux soins reçus", kamas: "de kamas", drop: "de butin", res: "de résistances", boss: "de dégâts sur les boss", mon: "de dégâts des monstres en moins", dcri: "de dégâts critiques", fresh: "de dégâts sur les monstres en pleine forme", vamp: "de vol de vie", shield1: "de bouclier au 1er tour", hurt: "de protection du plus blessé" };
    const out = [];
    for (const k in T) if (fx[k]) out.push(`+${Math.round(fx[k])} % ${T[k]}`);
    if (fx.po) out.push(`+${fx.po} PO`); if (fx.pm) out.push(`+${fx.pm} PM`); if (fx.pa) out.push(`+${fx.pa} PA`); if (fx.pa1) out.push(`+${fx.pa1} PA au 1er tour`);
    if (fx.first) out.push("joue en premier"); if (fx.revive) out.push("un héros se relève par combat"); if (fx.poison) out.push("coups empoisonnés");
    return out;
  };
  /* les héros : PV emportés de salle en salle, bonus du songe (appelé par E.startFight après la création des combattants) */
  E.expHeroes = (S, ents, fx) => {
    const X = X_(S); if (!X) return;
    const heroes = ents.filter((e) => e.side === "c");
    heroes.forEach((e) => {
      if (fx.hp) e.hpMax = Math.round(e.hpMax * (1 + fx.hp / 100));
      const pct = X.hp[e.cid] === undefined ? 100 : X.hp[e.cid];
      e.hp = Math.max(1, Math.round(e.hpMax * (pct <= 0 ? E.EXP_KO : pct) / 100));
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

  /* ---------- victoire, défaite, validation ---------- */
  const keepHp = (X, F) => F.ents.filter((e) => e.side === "c" && !e.summon).forEach((e) => { X.hp[e.cid] = e.alive ? Math.round(100 * e.hp / e.hpMax) : 0; });
  const addRew = (X, F) => { const r = F.rewards || { xp: {}, kamas: 0, res: {}, items: [] }; X.rew.kamas += r.kamas || 0; X.rew.xp += Object.values(r.xp || {}).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(r.xp || {}).length); X.rew.res += Object.values(r.res || {}).reduce((a, b) => a + b, 0); X.rew.items += (r.items || []).length; };
  const bribesMult = (ii) => 1 + 0.5 * ii;
  E.sgBribesFor = (ii, waves) => Math.round((60 + 20 * waves) * bribesMult(ii));
  /* 1.0.30 : Bribes de chaque vague tenue avant la validation (la moitié du total, en parts égales), gardées même en cas de défaite */
  E.sgWaveBribes = (ii) => { const INT = E.SG_INT[ii] || E.SG_INT[0]; return Math.round(E.sgBribesFor(ii, INT.waves) / 2 / INT.waves); };
  E.expWin = (S, F) => {
    const X = X_(S); if (!X) return; const n = X.nodes[X.pick]; if (!n) return;
    X.fights++; addRew(X, F); keepHp(X, F);
    if (n.t !== "end") {
      const pts = E.SG_PTS[n.t] + (n.t === "fight" ? n.pips - 1 : 0); X.pts += pts;
      const c = n.c || {}; const mk = c.minor && E.SG_MINOR[c.minor]; const k = n.t === "hard" || n.t === "archi" ? 2 : 1;
      if (mk) X.minor[c.minor] = (X.minor[c.minor] || 0) + mk[0] * k;
      if (F.rewards) { F.rewards.sgPts = pts; if (mk) F.rewards.sgMinor = `+${mk[0] * k} % ${mk[1]}`; }
      if (n.t === "archi" || n.t === "hard") { const r = freeRelics(X, n.t === "archi" ? "r" : rnd() < 0.5 ? "r" : "c"); if (r.length) takeRelic(S, X, pick(r)); }
      if (n.t === "archi" && E.dofusQuestEvent) E.dofusQuestEvent(S, "songe", { k: "archi" }); // 1.1 : étape du Dofus Onirique
      arrive(S, X); return;
    }
    /* Fin du rêve : une vague de plus */
    X.waves = X.wave; const INT = E.SG_INT[X.ii];
    if (!X.valid) { const b = E.sgGive(S, E.sgWaveBribes(X.ii)); X.wBribes = (X.wBribes || 0) + b; if (F.rewards) F.rewards.bribes = b; } // 1.0.30 : Bribes à chaque vague
    if (!X.valid && X.waves >= INT.waves) validate(S, X);
    else if (X.valid) { const b = E.sgGive(S, 20 * bribesMult(X.ii)); if (F.rewards) F.rewards.bribes = b; }
    recordWeek(S, X);
    if (X.waves >= 50) { endRun(S, X, "wake"); return; }
    queue(X, { t: "wave", valid: X.valid });
  };
  const recordWeek = (S, X) => {
    const G = E.songe(S); const cur = { ii: X.ii, waves: X.waves };
    if (!X.valid) return;
    const wk = E.sgWeek(S); if (better(cur, wk.ii < 0 ? null : wk)) { wk.ii = cur.ii; wk.waves = cur.waves; }
    if (better(cur, G.best)) G.best = cur;
    S.cnt = S.cnt || {}; if (X.waves > (S.cnt.sgWaves || 0)) S.cnt.sgWaves = X.waves;
  };
  /* le songe est validé : Bribes, coffre, déblocage de l'intensité suivante, légendaire peut-être */
  const validate = (S, X) => {
    X.valid = true; const G = E.songe(S); const INT = E.SG_INT[X.ii];
    X.vBribes = E.sgGive(S, Math.max(0, E.sgBribesFor(X.ii, INT.waves) - (X.wBribes || 0))); // 1.0.30 : le reste, après les Bribes des vagues
    const L = X.lvl; const lm = 1 + INT.loot / 100;
    const kamas = Math.round(L * 150 * lm * (1 + E.bonus(S, "kamas") / 100));
    const xp = Math.round(E.monsterXp(L) * 8 * (1 + X.ii * 0.25) * E.PACE_REW * (1 + E.bonus(S, "xp") / 100));
    const dust = Math.round((12 + 4 * X.ii) * (1 + X.ii * 0.2));
    S.kamas += kamas; X.rew.kamas += kamas; E.team(S).forEach((c) => E.giveXp(S, c, Math.round(xp * E.renXpMult(c)))); X.rew.xp += xp;
    E.addRes(S, E.POUSSIERE, dust); X.rew.dust += dust;
    const got = []; const pool = new Set();
    dgsNear(L).forEach((did) => { const dg = DUNGEONS[did]; [dg.boss, ...dg.rooms.flatMap((r) => r.mobs)].forEach((m) => (MONSTERS[m].items || []).forEach(([t]) => { if (ITEMS[t] && !ITEMS[t].leg && ITEMS[t].lvl <= L + 5 && ITEMS[t].lvl >= L - 25) pool.add(t); })); });
    const arr = [...pool]; for (let j = 0; j < 1 + Math.floor(X.ii / 2) && arr.length; j++) { const t = pick(arr); E.rollItem(S, t, {}); X.rew.items++; got.push(ITEMS[t].name); }
    const tk = Object.keys(E.TRANS || {}); if (X.ii >= 2 && tk.length && rnd() < Math.min(0.8, 0.2 + 0.1 * X.ii)) { const rk = E.transKey(pick(tk)); S.runes[rk] = (S.runes[rk] || 0) + 1; got.push(E.runeName(rk)); }
    const cof = X.ii >= 7 ? "coffre_obsidienne" : X.ii >= 5 ? "coffre_or" : X.ii >= 3 ? "coffre_argent" : X.ii >= 1 ? "coffre_bois" : null;
    if (cof && D.CONSUMABLES[cof]) { E.addCons(S, cof); got.push(D.CONSUMABLES[cof].name); }
    const leg = E.legRoll ? E.legRoll(S, X.ii, Math.max(...E.team(S).map((c) => c.lvl)), `Fin du rêve, ${INT.name}`) : null;
    if (leg) { got.push(ITEMS[leg.tpl].name); X.leg = leg.tpl; }
    if (E.dofusSongeDrop) E.dofusSongeDrop(S, X.ii, got); // 1.1 (5A) : le Dofus Onirique peut tomber à la Fin du rêve
    X.chest = { kamas, xp, dust, got };
    const first = X.ii >= G.unl; if (first && X.ii < E.SG_INT.length - 1) G.unl = X.ii + 1;
    S.cnt = S.cnt || {}; S.cnt.sgValid = (S.cnt.sgValid || 0) + 1; if (X.ii > (S.cnt.sgBestIi === undefined ? -1 : S.cnt.sgBestIi)) S.cnt.sgBestIi = X.ii;
    if (E.dofusQuestEvent) E.dofusQuestEvent(S, "songe", { k: "valid", ii: X.ii }); // 1.1 : étapes du Dofus Onirique
    note(S, `Songe validé (${INT.name}) : +${X.vBribes} Bribes de rêve, ${kamas.toLocaleString("fr-FR")} kamas, ${xp.toLocaleString("fr-FR")} XP par héros${got.length ? ", " + got.join(", ") : ""}.${first && X.ii < E.SG_INT.length - 1 ? ` ${E.SG_INT[X.ii + 1].name} débloqué !` : ""}`, "rare");
    E.EXP_TITLES.forEach(([ii, t]) => { if (X.ii >= ii) { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) { S.titlesExtra.push(t); note(S, `${E.SG_INT[ii].name} validé : titre « ${t} » !`, "rare"); E.celebrate({ t: "exp", int: E.SG_INT[ii].name, title: t }); } } });
    if (X.ii >= 7) { S.unlocks = S.unlocks || {}; if (!S.unlocks.elu) { S.unlocks.elu = 1; note(S, "Ornement débloqué : Auréole des Douze !", "rare"); } }
    if (E.checkAch) E.checkAch(S);
  };
  /* défaite : un Sable de Draconiros fait rejouer le combat ; sinon l'équipe se réveille */
  E.expLose = (S, F) => {
    const X = X_(S); if (!X) return; const n = X.nodes[X.pick];
    X.fights++; addRew(X, F);
    const why = F.loss && F.loss.txt ? F.loss.txt : `${F.label} : l'équipe est tombée au tour ${F.round}.`;
    X.lastLoss = { d: n ? n.d : 0, t: n ? n.t : "fight", wave: X.wave, txt: why };
    X.log.push({ d: n ? n.d : 0, t: n ? n.t : "fight", w: 0 });
    keepHp(X, F);
    if (X.sable > 0) { queue(X, { t: "sable" }); return; }
    endRun(S, X, X.valid ? "wake" : "fall");
  };
  const endRun = (S, X, how) => {
    X.on = false; S.fight = null;
    if (X.valid) recordWeek(S, X);
    S.cnt = S.cnt || {};
    S.expLast = { t: E.now(), how, ii: X.ii, valid: X.valid, waves: X.waves, d: X.at !== null && X.nodes[X.at] ? X.nodes[X.at].d : 0, rew: X.rew, bribes: X.bribes || 0, fights: X.fights, relics: X.relics.slice(), loss: X.lastLoss || null, lvl: X.lvl, dur: E.now() - X.t0, chest: X.chest || null, leg: X.leg || null, path: X.path.map((i) => X.nodes[i].t) };
    note(S, X.valid ? `Réveil après ${X.waves} vague${X.waves > 1 ? "s" : ""} : songe validé, +${X.bribes || 0} Bribes de rêve.` : how === "quit" ? "Tu quittes le songe : le butin des combats est gardé." : `L'équipe se réveille salle ${S.expLast.d} : le butin des combats est gardé, mais le songe n'est pas validé.`, X.valid ? "rare" : "warn");
    if (X.resume && E.SUBS[X.resume]) { S.hunting = true; S.sub = X.resume; S.pause = E.PAUSE_MS; }
    E.events.push({ kind: "expend" });
    if (E.checkAch) E.checkAch(S);
  };
  E.expQuit = (S) => { const X = X_(S); if (!X) return "Aucun songe en cours."; endRun(S, X, X.valid ? "wake" : "quit"); return null; };
  E.expSetAuto = (S, on) => { S.settings.expAuto = !!on; return null; };
  E.expAutoOn = (S) => S.settings.expAuto !== false;
  E.sgSetMode = (S, m) => { if (!E.SG_MODES[m]) return "Mode inconnu."; S.settings.sgMode = m; return null; };
  E.sgMode = (S) => (E.SG_MODES[S.settings.sgMode] ? S.settings.sgMode : "equilibre");

  /* ---------- choix automatiques (joueur absent, simulateur) ---------- */
  E.expAutoDoor = (S) => {
    const X = X_(S); if (!X || X.pick !== null || X.pend.length) return null;
    const nx = E.sgNext(X); if (!nx.length) return null; const m = E.sgMode(S); const hp = avgHp(S, X);
    const order = m === "prudent" ? ["favor", "fount", "end", "fight", "gob", "archi", "hard"] : m === "gourmand" ? (hp < 35 ? ["favor", "fount", "end", "fight", "archi", "gob", "hard"] : ["archi", "hard", "fount", "end", "fight", "gob", "favor"]) : hp < 55 ? ["favor", "fount", "end", "fight", "gob", "archi", "hard"] : ["archi", "fight", "fount", "end", "favor", "gob", "hard"];
    const sc = (i) => { const n = X.nodes[i]; return order.indexOf(n.t) * 10 + (n.t === "fight" ? (m === "gourmand" ? 2 - n.pips : n.pips) : 0); };
    return nx.slice().sort((a, b) => sc(a) - sc(b))[0];
  };
  E.expAutoChoice = (S) => {
    const X = X_(S); const p = X && X.pend[0]; if (!p) return null; const m = E.sgMode(S); const hp = avgHp(S, X);
    if (p.t === "favor") { const ih = p.opts.findIndex((o) => o.k === "heal"); if (hp < 50 && ih >= 0) return [ih]; const ir = p.opts.findIndex((o) => o.k === "relic"); return [ir >= 0 ? ir : p.opts.findIndex((o) => o.k === "pts")]; }
    if (p.t === "fount") {
      const can = (o) => !o.sold && o.price <= X.pts;
      if (hp < 60) { const i = p.opts.findIndex((o) => o.k === "heal" && can(o)); if (i >= 0) return [i]; }
      const rank = { l: 3, r: 2, c: 1 }; let bi = -1;
      p.opts.forEach((o, i) => { if (o.k === "relic" && can(o) && (bi < 0 || rank[E.EXP_RELICS[o.id].r] > rank[E.EXP_RELICS[p.opts[bi].id].r])) bi = i; });
      if (bi >= 0) return [bi];
      const sa = p.opts.findIndex((o) => o.k === "sable" && can(o)); if (sa >= 0 && X.sable < 1) return [sa];
      return ["no"];
    }
    if (p.t === "gob") return [p.back !== null && p.back !== undefined && hp < 40 ? "back" : X.pts >= E.SG_BET && m === "gourmand" ? "bet" : "pass"];
    if (p.t === "wave") { if (!X.valid || X.max) return [0]; /* 1.0.30 : X.max = rejeu du serveur, le plus de vagues possible */ const lim = m === "prudent" ? 101 : m === "gourmand" ? 25 : 50; return [hp >= lim ? 0 : "no"]; }
    if (p.t === "sable") return [X.sable > 0 ? 0 : "no"];
    return null;
  };
  const autoDo = (S) => { const X = S.exp; const p = X.pend[0]; const a = E.expAutoChoice(S); if (a) E.expChoose(S, ...a); if (X.pend[0] === p && p.t === "fount") E.expChoose(S, "no"); else if (X.pend[0] === p) X.pend.shift(); };
  /* appelé par E.tick : le jeu choisit à la place du joueur après le délai (si le réglage le permet) */
  E.expTick = (S) => {
    if (!S.mono && (!S.songe || !S.songe.seen)) { const top = S.chars && S.chars.length ? Math.max(...S.chars.map((c) => c.lvl)) : 0; if (top >= E.EXP_MIN_LVL) { E.songe(S).seen = 1; E.celebrate({ t: "songe" }); } }
    const X = X_(S); if (!X || !E.expAutoOn(S)) return;
    const now = E.now();
    if (X.pend.length) { const p = X.pend[0]; if (now - p.at > E.EXP_AUTO_MS) { p.auto = true; autoDo(S); } return; }
    if (X.pick === null) { X.doorsAt = X.doorsAt || now; if (now - X.doorsAt > E.EXP_DOOR_MS) { X.doorsAt = 0; const i = E.expAutoDoor(S); if (i !== null && i !== undefined) E.expDoor(S, i); } }
    else X.doorsAt = 0;
  };
  /* joue le songe en cours d'un coup, avec les choix automatiques (tests et simulateur). Renvoie { ii, d, waves, valid }. */
  E.expAutoPlay = (S, maxFights = 400) => {
    let n = 0;
    while (E.expActive(S) && n < maxFights) {
      const X = S.exp;
      if (X.pend.length) { autoDo(S); continue; }
      if (X.pick === null) { const i = E.expAutoDoor(S); if (i === null || i === undefined) break; E.expDoor(S, i); continue; }
      const F = E.startFight(S); if (!F) break; n++;
      let g = 0; while (!F.over && g++ < 6000) E.step(S);
      if (!F.over) break;
    }
    const X = S.exp; return X ? { ii: X.ii, d: X.at !== null ? X.nodes[X.at].d : 0, waves: X.waves, valid: X.valid } : null;
  };
  /* 1.0.30 : rejeu du serveur pour le classement de la semaine (fonction « record », { songe: 1 }). Il rejoue un songe de
     l'intensité ii avec l'équipe de la sauvegarde, la carte de la semaine, les choix automatiques et un hasard choisi par le
     serveur, en tenant le plus de vagues possible. Renvoie { ok, ii, waves, err }. Le hasard et l'heure reviennent ensuite. */
  E.sgReplay = (txt, ii, seed, now) => {
    const t = now || Date.now();
    try {
      E.setRng(seeded(seed >>> 0)); E.setClock(() => t);
      const S = E.deserialize(txt);
      if (!(ii >= 0 && ii < E.SG_INT.length)) return { ok: false, err: "intensité inconnue" };
      S.exp = null; S.dungeon = null; S.fight = null; S.hunting = false; S.acc = 0; S.pause = 0;
      if (E.songe(S).unl < ii) return { ok: false, err: "intensité jamais débloquée dans cette partie" };
      S.settings.sgMode = "equilibre";
      const err = E.expStart(S, ii); if (err) return { ok: false, err };
      S.exp.max = 1; E.expAutoPlay(S, 160); if (E.expActive(S)) E.expQuit(S);
      const L = S.expLast || {};
      return L.valid ? { ok: true, ii, waves: L.waves } : { ok: false, ii, waves: 0, err: "l'équipe ne valide pas cette intensité" };
    } catch (e) { return { ok: false, err: "partie illisible" }; }
    finally { E.setRng(Math.random); E.setClock(null); if (E.events) E.events.splice(0); }
  };
  /* le record de la semaine compté par le serveur : jusqu'à un quart de vagues (au moins 2) au-dessus de son meilleur rejeu */
  E.sgOfficial = (claim, best) => Math.max(0, Math.min(claim, best + Math.max(2, Math.ceil(best * 0.25))));

  /* ---------- actions officielles ---------- */
  Object.assign(E.ACTIONS, { expStart: "entrer dans le Songe infini", expDoor: "choisir la salle suivante du songe", expChoose: "répondre à une faveur, une fontaine, un Gobledore ou une vague", expBuy: "acheter un vœu à la Fontaine", expQuit: "se réveiller", sgBuy: "échanger au Marché onirique", sgBuyWeek: "échanger une offre de la semaine au Marché onirique", expSetAuto: "choix automatique dans le songe", sgSetMode: "mode du choix automatique", sgCadre: "Cadre des Songes", legFuse: "fondre une copie de légendaire" });

  /* ---------- familier, ornement, succès, bulle de découverte ---------- */
  if (E.PETS && !E.PETS.draconiros_mini) E.PETS.draconiros_mini = { name: "Draconiros miniature", icon: 18048, stats: { pui: 70, cri: 5 }, kind: "zone", lvl: 100, food: "Viande Goûtue", songe: true };
  if (E.ACH) {
    const has = (id) => E.ACH.some((a) => a.id === id);
    const add = (o) => { if (!has(o.id)) E.ACH.push(o); };
    const old = (S) => (S.cnt && (S.cnt.expBestAll || S.cnt.expBest)) || 0; // record de l'ancienne Expédition
    const bi = (S) => (S.cnt && S.cnt.sgBestIi !== undefined ? S.cnt.sgBestIi : -1);
    const C = "Songe infini";
    add({ id: "exp5", cat: C, name: "Premier songe", desc: "Valider un songe en Rêve.", test: (S) => bi(S) >= 0 || old(S) >= 5, kamas: 1500 });
    add({ id: "exp10", cat: C, name: "Paradoxe", desc: "Valider un songe en Paradoxe 1.", test: (S) => bi(S) >= 1 || old(S) >= 10, kamas: 4000 });
    add({ id: "exp25", cat: C, name: "Éclaireur", desc: "Valider un songe en Paradoxe 2 (titre « Éclaireur »).", test: (S) => bi(S) >= 2 || old(S) >= 25, kamas: 10000 });
    add({ id: "exp50", cat: C, name: "Pèlerin des Douze", desc: "Valider un songe en Paradoxe 4 (titre « Pèlerin des Douze »).", test: (S) => bi(S) >= 4 || old(S) >= 50, kamas: 30000 });
    add({ id: "exp75", cat: C, name: "Fidèle des Douze", desc: "Valider un songe en Cauchemar 1 (titre « Fidèle des Douze »).", test: (S) => bi(S) >= 5 || old(S) >= 75, kamas: 60000 });
    add({ id: "exp100", cat: C, name: "Élu des Douze", desc: "Valider un songe en Cauchemar 3 (titre « Élu des Douze » et ornement « Auréole des Douze »).", test: (S) => bi(S) >= 7 || old(S) >= 100, kamas: 150000 });
    add({ id: "exprel100", cat: C, name: "Collectionneur de songes", desc: "Prendre 100 bonus dans le songe.", test: (S) => ((S.cnt && S.cnt.expRelics) || 0) >= 100, kamas: 20000 });
    add({ id: "expdbl10", cat: C, name: "Joueur d'Ecaflip", desc: "Gagner 10 paris contre le Gobledore.", test: (S) => ((S.cnt && S.cnt.sgBets) || 0) >= 10 || ((S.cnt && S.cnt.expDoubles) || 0) >= 10, kamas: 25000, title: "Joueur d'Ecaflip" });
    add({ id: "expcamp", cat: C, name: "Songeur équipé", desc: "Échanger les 3 améliorations du Marché onirique.", test: (S) => ["prevoyant", "sablepoche", "faveurs"].every((id) => E.sgUp(S, id)) || (S.camp && S.camp.ups && Object.keys(S.camp.ups).length >= 24), kamas: 50000, title: "Maître du campement" });
    add({ id: "sgw10", cat: C, name: "Le Grand Sommeil", desc: "Tenir 10 vagues à la Fin du rêve.", test: (S) => ((S.cnt && S.cnt.sgWaves) || 0) >= 10, kamas: 40000 });
  }
  if (E.ORN && !E.ORN.elu) E.ORN.elu = { name: () => "Auréole des Douze", req: "Valider un songe en Cauchemar 3", ok: (S) => !!(S.unlocks && S.unlocks.elu) };
  if (E.ORN && !E.ORN.brume) E.ORN.brume = { name: () => "Brume onirique", req: "À échanger au Marché onirique (Songe infini)", ok: (S) => !!(S.unlocks && S.unlocks.brume) };
  if (E.TIPS) { const i = E.TIPS.findIndex((t) => t.id === "expedition"); if (i >= 0) E.TIPS.splice(i, 1); }
  if (E.TIPS && !E.TIPS.some((t) => t.id === "songe")) E.TIPS.push({ id: "songe", name: "Le Songe infini", hint: "niveau 10", anchor: '#nav [data-nk="exp"], #nav [data-nk="menu"]',
    cond: (S) => S.chars.some((c) => c.lvl >= E.EXP_MIN_LVL),
    txt: "Aventure › Songe infini : une carte de 26 salles, la même pour tous chaque semaine. Choisis ton couloir, gagne des bonus et des points de rêve, puis tiens les vagues de la Fin du rêve pour valider le songe et gagner des Bribes de rêve." });

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
