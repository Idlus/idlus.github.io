/* ============================================================================
   LES OBJETS LÉGENDAIRES — Idlus (0.1.48)
   38 objets : les 26 légendaires de DOFUS (niveau 200) et 12 inédits d'Idlus (niveaux 50, 100 et 150).
   - Ils ne tombent que dans le Songe infini, à la validation d'un songe (Paradoxe 2 et plus), très rarement,
     sans garantie, et seulement ceux du niveau de l'équipe ou en dessous (E.LEG_RATE).
   - Caractéristiques fixes : 80 à 90 % du meilleur objet du même emplacement et du même niveau (poids de
     forgemagie), calculées au chargement sur les objets du jeu. Les légendaires de DOFUS gardent leur profil,
     ramené entre 80 et 90 % ; les inédits sont à 85 %. Le passif unique fait la différence.
   - Un seul légendaire par héros. Les copies font monter l'Éveil (I à V : +1, +1, +2, +3 copies), qui renforce
     le passif. Ils se vendent à l'HdV avec leur Éveil. Pas de forgemagie. Passif actif partout.
   Pas de DOM ici : l'affichage est dans ui.js et js/songeui.js. Chargé aussi par les tests et le simulateur.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { ITEMS, STATS } = D;
  const rnd = () => E.rnd();

  /* ---------- réglages ---------- */
  E.LEG_RATIO = [0.8, 0.9];   // part du meilleur objet (même emplacement, même niveau)
  E.LEG_IDLUS = 0.85;         // les inédits d'Idlus
  E.LEG_COPIES = [1, 2, 3, 5, 8]; // copies au total pour l'Éveil I à V (+1, +1, +2, +3)
  E.LEG_ROMAN = ["I", "II", "III", "IV", "V"];
  /* chance par songe validé, selon l'intensité (0 Rêve, 1-4 Paradoxe, 5-7 Cauchemar) */
  E.LEG_RATE = [0, 0, 1 / 3000, 1 / 2000, 1 / 1200, 1 / 900, 1 / 650, 1 / 500];
  E.LEG_SPECIAL = ["pa", "pm", "po", "inv"]; // gardés tels quels, les autres caractéristiques suivent la règle des 80-90 %

  /* ---------- les 38 légendaires ----------
     [clé, nom, emplacement, niveau, icône, id DofusDB (0 : inédit), passif, valeurs de l'Éveil I à V, profil (inédits)] */
  const L = (k, name, slot, lvl, icon, db, p, v, prof) => ({ k, name, slot, lvl, icon, db, p, v, prof: prof || null });
  E.LEG_LIST = [
    L("voile", "Voile de Brume", "cape", 50, 17326, 0, "esquive", [1, 1, 1, 2, 2], { vit: 300, age: 60, sa: 40, fui: 20, ra: 8 }),
    L("songeur", "Couronne du Songeur", "coiffe", 50, 16396, 0, "bouclier", [15, 20, 25, 30, 35], { vit: 300, ine: 60, sa: 40, so: 10, re: 6 }),
    L("lune", "Pas de Lune", "bottes", 50, 11241, 0, "pm1", [2, 2, 3, 3, 4], { vit: 250, cha: 50, age: 30, sa: 30, fui: 15 }),
    L("neru", "Larme de Neru", "amulette", 50, 1233, 0, "butin", [12, 14, 16, 18, 20], { vit: 300, cha: 60, sa: 40, pp: 20, re: 6 }),
    L("reveil", "Boucle du Réveil", "anneau", 100, 9297, 0, "releve", [20, 25, 30, 35, 40], { vit: 350, ine: 50, sa: 20, so: 8, rf: 5, re: 5 }),
    L("marees", "Ceinture des Marées", "ceinture", 100, 10282, 0, "marees", [20, 25, 30, 35, 40], { vit: 300, ine: 50, cha: 30, so: 12, re: 7 }),
    L("paradoxe", "Lame Paradoxe", "arme", 100, 5087, 0, "echo", [50, 60, 70, 80, 90], { vit: 300, fo: 50, age: 50, cri: 6, do: 6, tac: 10 }),
    L("gardien", "Manteau du Gardien", "cape", 100, 17292, 0, "garde", [30, 35, 40, 45, 50], { vit: 400, fo: 40, sa: 20, rt: 7, rn: 7, tac: 15 }),
    L("oniros", "Pendentif d'Oniros", "amulette", 150, 1236, 0, "achevePa", [1, 1, 1, 1, 2], { vit: 350, fo: 60, ine: 60, cri: 5, do: 8, ini: 300 }),
    L("draconiros", "Anneau de Draconiros", "anneau", 150, 9289, 0, "frais", [25, 30, 35, 40, 45], { vit: 300, fo: 50, cha: 50, cri: 4, dcri: 8, rf: 5 }),
    L("nuits", "Bâton des Mille Nuits", "arme", 150, 3083, 0, "monte", [30, 35, 40, 45, 50], { vit: 350, ine: 70, sa: 40, cri: 5, df: 10, so: 6 }),
    L("egide", "Égide du Cauchemar", "bouclier", 150, 82181, 0, "renvoi", [20, 25, 30, 35, 40], { vit: 300, rt: 6, rf: 6, re: 6, ra: 6, rn: 6 }),
    L("crocobur", "Crocobur", "arme", 200, 6740, 20353, "saigne", [10, 13, 16, 19, 22]),
    L("ciseaux", "Ciseaux du Destin", "arme", 200, 5100, 20354, "acheve", [8, 9, 10, 11, 12]),
    L("brumaire", "Frisson de Brumaire", "arme", 200, 4135, 20355, "gel", [50, 60, 70, 85, 100]),
    L("buhorado", "Plume de Buhorado", "arme", 200, 2087, 20356, "kamas", [15, 18, 21, 24, 27]),
    L("fallanster", "Droiture de Fallanster", "bouclier", 200, 82212, 20357, "rempart", [10, 11, 12, 13, 15]),
    L("trompe", "Trompe-la-Mort", "bouclier", 200, 82211, 20358, "trompe", [100, 125, 150, 175, 200]),
    L("bram", "Couronne de Brâm Barbe-Monde", "coiffe", 200, 16555, 20359, "pavie", [50, 45, 40, 35, 30]),
    L("ganymede", "Diadème de Ganymède", "coiffe", 200, 16564, 20360, "xp", [10, 12, 14, 16, 18]),
    L("rykke", "Bravoure de Rykke Errel", "cape", 200, 17418, 20361, "boss", [30, 35, 40, 45, 50]),
    L("jahash", "Noblesse de Jahash Jurgen", "cape", 200, 17423, 20362, "partage", [30, 35, 40, 45, 50]),
    L("lieues", "Bottes de Mille Lieues", "bottes", 200, 11338, 20363, "premier", [10, 15, 20, 25, 30]),
    L("botte", "Bottes du Cul Botté", "bottes", 200, 11337, 20364, "etourdit", [20, 23, 26, 29, 32]),
    L("dodge", "Audace de Dodge", "ceinture", 200, 10335, 20365, "audace", [10, 15, 20, 25, 30]),
    L("jhessica", "Courage de Dame Jhessica", "ceinture", 200, 10336, 20366, "elements", [20, 25, 30, 35, 40]),
    L("hachebarde", "Hachebarde de Guerre", "arme", 200, 19081, 22368, "fauche", [40, 45, 50, 55, 60]),
    L("pestilence", "Pestilence de Corruption", "cape", 200, 17454, 22412, "poison", [3, 3.5, 4, 4.5, 5]),
    L("servitude", "Étreinte de Servitude", "ceinture", 200, 10343, 22429, "etreinte", [15, 18, 21, 24, 27]),
    L("misere", "Balance-Fléau de Misère", "arme", 200, 4138, 22444, "vol", [12, 14, 16, 18, 20]),
    L("oto", "Ardeur d'Oto Mustam", "coiffe", 200, 16869, 32114, "ardeur", [20, 25, 30, 35, 40]),
    L("miroir", "Bouclier Miroir", "bouclier", 200, 82553, 32115, "miroir", [50, 55, 60, 65, 70]),
    L("menalt", "Lance-Éclair de Menalt", "arme", 200, 183011, 32116, "eclair", [4, 5, 6, 7, 8]),
    L("thanatena", "Jugement de Thanatena", "arme", 200, 22014, 32117, "bourreau", [30, 35, 40, 45, 50]),
    L("helsephine", "Amour d'Helséphine", "amulette", 200, 1330, 32118, "amour", [5, 5.5, 6, 6.5, 7]),
    L("henual", "Ponctualité d'Henual", "anneau", 200, 9392, 32119, "relance", [1, 1, 1, 2, 2]),
    L("meriana", "Clairvoyance de Mériana", "bottes", 200, 11382, 32121, "clair", [10, 12, 14, 16, 18]),
    L("amayiro", "Ferveur d'Amayiro", "arme", 200, 6760, 32163, "ferveur", [30, 35, 40, 45, 50]),
  ];
  /* profils des légendaires de DOFUS (valeurs maximales de DofusDB, caractéristiques connues d'Idlus) */
  const PROF = {"20353":{"vit":500,"sa":40,"pui":100,"dn":20,"dt":20,"df":20,"de":20,"da":20,"tac":20},"20354":{"vit":450,"sa":50,"pui":120,"ini":400,"rn":10,"tac":20,"epm":20},"20355":{"vit":400,"cha":60,"sa":50,"pui":60,"do":10,"re":10,"fui":20,"rpa":10},"20356":{"vit":350,"age":60,"sa":60,"pui":60,"cri":10,"po":1,"do":10,"ra":10},"20357":{"vit":300,"sa":60,"pui":60,"rn":5,"tac":20},"20358":{"vit":300,"sa":40,"pui":50,"ini":300,"rn":10,"rt":10},"20359":{"vit":400,"sa":60,"pui":80,"cri":10,"dn":10,"dt":10,"df":10,"de":10,"da":10,"epm":20},"20360":{"vit":350,"sa":60,"pui":120,"pa":1,"rn":2,"rt":2,"rf":2,"re":2,"ra":2,"fui":20},"20361":{"vit":500,"sa":40,"pui":100,"ini":400,"rn":7,"rt":7,"rf":7,"tac":15,"epm":20},"20362":{"vit":400,"sa":60,"pui":120,"dsort":4},"20363":{"vit":300,"sa":40,"pui":80,"pm":1,"ini":600,"ra":10,"fui":20,"epm":20},"20364":{"vit":350,"sa":40,"pui":80,"pm":1,"rn":2,"rt":2,"rf":2,"re":2,"ra":2,"rpm":20},"20365":{"vit":400,"sa":40,"pui":80,"cri":7,"rf":7,"re":7,"ra":7,"epm":20,"dcri":12},"20366":{"vit":500,"sa":60,"pui":100,"dsort":2},"22368":{"vit":450,"ine":60,"sa":50,"pui":60,"cri":5,"do":10,"ini":500,"rf":10,"tac":20,"rpm":15},"22412":{"vit":400,"sa":50,"pui":70,"inv":2,"dn":20,"dt":20,"df":20,"de":20,"da":20,"rn":5,"rt":5,"re":5,"ra":5,"tac":20},"22429":{"vit":400,"sa":50,"pui":100,"inv":2,"dn":15,"dt":15,"df":15,"de":15,"da":15,"ini":500,"tac":20},"22444":{"vit":350,"sa":50,"pui":100,"cri":5,"rt":10,"epa":15,"epm":15,"dcri":10},"32114":{"vit":500,"sa":50,"pui":100,"cri":4,"ini":500,"rf":5,"re":5,"fui":15,"epm":15,"dcri":10},"32115":{"vit":300,"sa":50,"pui":50,"po":1},"32116":{"vit":500,"sa":50,"pui":100,"pm":1,"ini":500,"epa":20},"32117":{"sa":60,"pui":120,"cri":4,"do":12,"tac":20,"fui":20},"32118":{"vit":500,"sa":60,"pui":80,"pa":2,"so":30,"re":7,"ra":7},"32119":{"vit":300,"sa":60,"pui":60,"ini":600,"rt":6,"rf":6,"rpa":24,"epa":12},"32121":{"vit":200,"sa":60,"pui":80,"cri":10,"pa":1,"pm":1,"inv":1,"rt":4,"rf":4,"re":4,"ra":4,"fui":40,"dsort":4},"32163":{"vit":500,"sa":50,"pui":100,"cri":4,"ini":500,"rt":5,"ra":5,"tac":15,"epa":15}};

  /* ---------- les passifs : texte selon la valeur de l'Éveil ---------- */
  const P = {
    esquive:  (v) => (v > 1 ? `Les ${v} premières attaques reçues à chaque combat sont esquivées.` : "La première attaque reçue à chaque combat est esquivée."),
    bouclier: (v) => `Au début de chaque combat, bouclier de ${v} % des PV max.`,
    pm1:      (v) => `+${v} PM au premier tour (esquive en première ligne).`,
    butin:    (v) => `+${v} % de butin pour l'équipe (dans le plafond).`,
    releve:   (v) => `Une fois par combat, à 0 PV, se relève avec ${v} % de ses PV.`,
    marees:   (v) => `Soins +${v} % ; la moitié du surplus devient un bouclier.`,
    echo:     (v) => `Un coup sur quatre est rejoué à ${v} % sur un autre ennemi.`,
    garde:    (v) => `Encaisse ${v} % des dégâts subis par l'allié le plus blessé.`,
    achevePa: (v) => `Chaque ennemi achevé rend ${v} PA au tour suivant.`,
    frais:    (v) => `+${v} % de dégâts sur les ennemis au-dessus de 80 % de PV.`,
    monte:    (v) => `+3 % de dégâts par tour, jusqu'à +${v} %.`,
    renvoi:   (v) => `Renvoie ${v} % des dégâts reçus à l'attaquant.`,
    saigne:   (v) => `Les coups critiques font saigner : ${v} % des dégâts à nouveau au tour suivant.`,
    acheve:   (v) => `Achève un ennemi sous ${v} % de ses PV (sauf les boss).`,
    gel:      (v) => `Les ennemis touchés perdent 1 PM et jouent en dernier (${v} % de chance, une fois par tour).`,
    kamas:    (v) => `+${v} % de kamas pour l'équipe (dans le plafond).`,
    rempart:  (v) => `Les alliés de première ligne subissent ${v} % de dégâts en moins.`,
    trompe:   (v) => `Renvoie la première attaque mortelle à son auteur (${v} % des dégâts) et reste à 1 PV.`,
    pavie:    (v) => `+1 PA tant que le porteur a plus de ${v} % de ses PV.`,
    xp:       (v) => `+${v} % d'XP pour toute l'équipe (dans le plafond).`,
    boss:     (v) => `+${v} % de dégâts contre les boss.`,
    partage:  (v) => `Ses soins touchent aussi l'allié le plus blessé, à ${v} %.`,
    premier:  (v) => `+1 PM ; agit toujours en premier au premier tour, avec +${v} % de dégâts.`,
    etourdit: (v) => `${v} % de chance d'étourdir la cible (elle passe son tour), une fois par ennemi.`,
    audace:   (v) => `Après une attaque esquivée, le coup suivant est critique, avec +${v} % de dégâts.`,
    elements: (v) => `Chaque changement d'élément : +5 % de dégâts (jusqu'à +${v} %).`,
    fauche:   (v) => `Frappe aussi un autre ennemi à ${v} % des dégâts.`,
    poison:   (v) => `Empoisonne : ${String(v).replace(".", ",")} % des PV max de la cible par tour, 2 tours.`,
    etreinte: (v) => `L'ennemi le plus fort inflige ${v} % de dégâts en moins.`,
    vol:      (v) => `Vol de vie : ${v} % des dégâts infligés.`,
    ardeur:   (v) => `+4 % de dégâts par ennemi vaincu dans le combat (jusqu'à +${v} %).`,
    miroir:   (v) => `Tous les 3 tours, renvoie ${v} % de la prochaine attaque reçue (et l'évite d'autant).`,
    eclair:   (v) => `Tous les 3 tours, un éclair frappe tous les ennemis : ${v} % de leurs PV max (moitié sur les boss).`,
    bourreau: (v) => `+${v} % de dégâts sur les ennemis sous 25 % de PV.`,
    amour:    (v) => `Soigne l'équipe de ${String(v).replace(".", ",")} % de ses PV à chaque tour du porteur.`,
    relance:  (v) => `Ses sorts ont ${v} tour${v > 1 ? "s" : ""} de relance en moins.`,
    clair:    (v) => `Ses coups ne peuvent pas être esquivés ; +${v} % de critique.`,
    ferveur:  (v) => `Chaque attaque reçue : +3 % de dégâts (jusqu'à +${v} %).`,
  };
  E.LEG = {}; E.LEG_LIST.forEach((x) => { x.tpl = "leg_" + x.k; E.LEG[x.k] = x; });
  E.legByTpl = (tpl) => (ITEMS[tpl] && ITEMS[tpl].leg ? E.LEG[ITEMS[tpl].leg] : null);
  E.legVal = (x, ev) => x.v[Math.max(0, Math.min(4, (ev || 1) - 1))];
  E.legTxt = (x, ev) => P[x.p](E.legVal(x, ev));

  /* ---------- caractéristiques : 80-90 % du meilleur objet du même emplacement et du même niveau ---------- */
  const W = (st, k) => (STATS[k] ? STATS[k].w : 0) * st[k];
  const power = (st) => Object.keys(st).reduce((a, k) => a + W(st, k), 0);
  const maxRoll = (T) => { const o = {}; for (const k in T.stats) o[k] = Math.max(...[].concat(T.stats[k])); return o; };
  E.legBest = (slot, lvl) => {
    let best = null, bw = 0;
    for (const id in ITEMS) { const T = ITEMS[id]; if (T.slot !== slot || T.leg || T.trophy || T.lvl > lvl || T.lvl <= lvl - 15) continue; const w = power(maxRoll(T)); if (w > bw) { bw = w; best = id; } }
    return { id: best, w: bw };
  };
  E.legBuild = (x) => {
    const B = E.legBest(x.slot, x.lvl); const prof = x.prof || PROF[x.db] || { vit: 1 };
    const raw = power(prof); const ratio = x.db ? Math.max(E.LEG_RATIO[0], Math.min(E.LEG_RATIO[1], B.w ? raw / B.w : 0.85)) : E.LEG_IDLUS;
    const target = B.w * ratio; const st = {};
    const spec = Object.keys(prof).filter((k) => E.LEG_SPECIAL.includes(k)); const rest = Object.keys(prof).filter((k) => !E.LEG_SPECIAL.includes(k));
    let ws = spec.reduce((a, k) => a + W(prof, k), 0); if (ws > target * 0.6) { spec.length = 0; ws = 0; }
    spec.forEach((k) => (st[k] = prof[k]));
    const wr = rest.reduce((a, k) => a + W(prof, k), 0); const k = wr > 0 ? (target - ws) / wr : 0;
    rest.forEach((s) => { const v = Math.round(prof[s] * k); if (v) st[s] = v; });
    return { stats: st, ratio, best: B.id, target: Math.round(target), power: Math.round(power(st)) };
  };
  E.LEG_LIST.forEach((x) => {
    const b = E.legBuild(x); x.ratio = b.ratio; x.best = b.best;
    const stats = {}; for (const k in b.stats) stats[k] = [b.stats[k], b.stats[k]];
    ITEMS[x.tpl] = { name: x.name, slot: x.slot, lvl: x.lvl, icon: x.icon, stats, rarity: "legendaire", leg: x.k, src: "songe" };
  });

  /* ---------- Éveil : copies fondues ---------- */
  E.legRank = (n) => { let r = 1; E.LEG_COPIES.forEach((c, i) => { if (n >= c) r = i + 1; }); return r; };
  E.legCopies = (it) => Math.max(1, it.lgc || 1);
  E.legEv = (it) => E.legRank(E.legCopies(it));
  E.legNext = (it) => { const n = E.legCopies(it); const r = E.legRank(n); return r >= 5 ? 0 : E.LEG_COPIES[r] - n; };
  /* fondre une copie (n'importe quel Éveil) dans un légendaire : les copies s'additionnent, jusqu'à l'Éveil V */
  E.legFuse = (S, uid, uid2) => {
    const a = S.items[uid], b = S.items[uid2]; if (!a || !b || uid === uid2) return "Choisis deux exemplaires du même légendaire.";
    if (a.tpl !== b.tpl || !ITEMS[a.tpl].leg) return "Seul un exemplaire du même légendaire se fond.";
    if (E.legEv(a) >= 5) return "Éveil V atteint : il ne monte plus.";
    if (E.equippedBy(S, uid2)) return "Retire d'abord la copie du héros qui la porte.";
    if (E.inGear(S, uid2)) return "Cette copie est rangée dans une tenue : retire-la de la tenue d'abord.";
    const before = E.legEv(a); a.lgc = Math.min(E.LEG_COPIES[4], E.legCopies(a) + E.legCopies(b)); delete S.items[uid2];
    const x = E.legByTpl(a.tpl); const after = E.legEv(a);
    E.note(S, after > before ? `${x.name} passe à l'Éveil ${E.LEG_ROMAN[after - 1]} : ${E.legTxt(x, after)}` : `${x.name} : copie fondue (${E.legNext(a)} de plus pour l'Éveil ${E.LEG_ROMAN[after]}).`, after > before ? "rare" : "up");
    if (after > before) E.celebrate({ t: "leg", tpl: a.tpl, ev: after, up: true });
    return null;
  };
  /* donner un légendaire (butin du Songe, tests) */
  E.giveLeg = (S, k, why) => {
    const x = E.LEG[k]; if (!x) return null;
    const it = E.rollItem(S, x.tpl, { radiant: false }); it.lgc = 1; it.locked = true;
    S.cnt = S.cnt || {}; S.cnt.legs = (S.cnt.legs || 0) + 1; (S.legSeen = S.legSeen || {})[k] = 1;
    E.note(S, `★ Objet légendaire : ${x.name}${why ? ` (${why})` : ""} ! ${E.legTxt(x, 1)}`, "radiant");
    E.celebrate({ t: "leg", tpl: x.tpl, ev: 1, why });
    if (E.checkAch) E.checkAch(S);
    return it;
  };
  /* tirage à la validation d'un songe : intensité 0-7, niveau de l'équipe */
  E.legPool = (lvl) => E.LEG_LIST.filter((x) => x.lvl <= lvl);
  E.legRoll = (S, ii, lvl, why) => {
    const p = E.LEG_RATE[ii] || 0; if (!p || rnd() >= p * (E.legRateMult || 1)) return null;
    const pool = E.legPool(lvl); if (!pool.length) return null;
    return E.giveLeg(S, pool[Math.floor(rnd() * pool.length)].k, why);
  };

  /* ---------- un seul légendaire par héros, pas de forgemagie ---------- */
  E.legWorn = (S, c) => { for (const sl in c.equip) { const it = S.items[c.equip[sl]]; if (it && ITEMS[it.tpl] && ITEMS[it.tpl].leg) return { it, sl }; } return null; };
  const equip0 = E.equip;
  E.equip = (S, cid, uid, slotOverride) => {
    const c = S.chars.find((x) => x.id === cid); const it = S.items[uid];
    if (c && it && ITEMS[it.tpl] && ITEMS[it.tpl].leg) {
      const w = E.legWorn(S, c); const sl = slotOverride || E.slotFor(c, it);
      if (w && w.it.uid !== uid && w.sl !== sl) return `${c.name} porte déjà un légendaire (${ITEMS[w.it.tpl].name}) : un seul par héros.`;
    }
    return equip0(S, cid, uid, slotOverride);
  };
  /* le légendaire porté par un héros, pour le combat : { k, ev } */
  E.legOf = (S, c) => { const w = c && E.legWorn(S, c); return w ? { k: ITEMS[w.it.tpl].leg, ev: E.legEv(w.it) } : null; };
  /* bonus d'équipe (XP, butin, kamas), comptés dans les plafonds habituels */
  const BK = { xp: "xp", butin: "drop", kamas: "kamas" };
  E.legTeamBonus = (S, kind) => {
    let b = 0; if (!S || !S.chars || !E.team) return 0;
    E.team(S).forEach((c) => { const o = E.legOf(S, c); if (!o) return; const x = E.LEG[o.k]; if (BK[x.p] === kind) b += E.legVal(x, o.ev); });
    return b;
  };

  /* ---------- les passifs en combat (appelés par engine.js) ---------- */
  const A = () => E.fightApi;
  const foe = (F, a, b) => (F.pvp ? a.tm !== b.tm : a.side !== b.side);
  const foesOf = (F, e) => F.ents.filter((x) => x.alive && foe(F, e, x));
  const matesOf = (F, e) => F.ents.filter((x) => x.alive && !foe(F, e, x) && !x.summon && x.st);
  const LV = (e) => (e.lg ? E.legVal(E.LEG[e.lg.k], e.lg.ev) : 0);
  const has = (e, p) => !!(e && e.lg && E.LEG[e.lg.k] && E.LEG[e.lg.k].p === p);
  const say = (F, txt) => A().flog(F, txt, "buff");
  const pop = (F, e, txt) => F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(e), txt });
  /* début de combat : boucliers, vitesse, poison, vol de vie, auras d'équipe */
  E.legFight = (S, F) => {
    const hs = F.ents.filter((e) => e.lg && E.LEG[e.lg.k] && !e.summon);
    hs.forEach((e) => {
      const v = LV(e); const p = E.LEG[e.lg.k].p; e.lgS = {};
      if (p === "esquive") e.lgS.dodge = v;
      if (p === "bouclier") e.shield = Math.max(e.shield || 0, Math.round(e.hpMax * v / 100));
      if (p === "pm1") { e.st = Object.assign({}, e.st, { pm: (e.st.pm || 0) + v }); e.lgS.pm1 = v; }
      if (p === "releve") e.lgS.rise = 1;
      if (p === "trompe") e.lgS.trick = 1;
      if (p === "premier") { e.st = Object.assign({}, e.st, { pm: (e.st.pm || 0) + 1 }); e.expFirst = true; }
      if (p === "poison") e.expPoison = Math.max(e.expPoison || 0, v);
      if (p === "vol") e.vamp = Math.max(e.vamp || 0, v / 100);
      if (p === "clair") { e.st = Object.assign({}, e.st, { cri: (e.st.cri || 0) + v }); e.lgNoDodge = true; }
      if (p === "rempart") F.ents.forEach((m) => { if (m.alive && !foe(F, e, m) && m.st && (m.row || "f") === "f") m.lgDr = Math.max(m.lgDr || 0, v); });
      if (p === "etreinte") { const t = foesOf(F, e).sort((a, b) => (b.dmg || 0) * (b.attacks || 1) - (a.dmg || 0) * (a.attacks || 1) || b.hpMax - a.hpMax)[0]; if (t) { if (t.dmg) t.dmg *= 1 - v / 100; else t.lgWeak = v; } }
    });
  };
  /* multiplicateur de dégâts du porteur (charDamage) ; renvoie { v, crit } */
  E.legDmg = (F, e, tgt, el, crit, v) => {
    const x = E.LEG[e.lg.k]; if (!x) return { v, crit }; const p = x.p, val = LV(e); const S0 = e.lgS || (e.lgS = {});
    if (p === "audace" && S0.nextCrit && !crit) { S0.nextCrit = false; crit = true; v = v * 1.25 * (1 + val / 100) + 3 + (e.st.dcri || 0); }
    if (tgt) {
      if (p === "frais" && tgt.hp > tgt.hpMax * 0.8) v *= 1 + val / 100;
      if (p === "boss" && tgt.boss) v *= 1 + val / 100;
      if (p === "bourreau" && tgt.hp < tgt.hpMax * 0.25) v *= 1 + val / 100;
    }
    if (p === "monte") v *= 1 + Math.min(val, 3 * Math.max(0, (F.round || 1) - 1)) / 100;
    if (p === "premier" && F.round === 1) v *= 1 + val / 100;
    if (p === "ardeur") v *= 1 + Math.min(val, 4 * (S0.kills || 0)) / 100;
    if (p === "ferveur") v *= 1 + Math.min(val, 3 * (S0.hits || 0)) / 100;
    if (p === "elements") { if (S0.el && el && S0.el !== el) S0.chain = Math.min(val / 5, (S0.chain || 0) + 1); else if (S0.el === el) S0.chain = 0; S0.el = el; v *= 1 + 5 * (S0.chain || 0) / 100; }
    S0.crit = crit;
    return { v, crit };
  };
  /* avant les dégâts : esquive, garde, miroir, rempart (renvoie la valeur, 0 si évitée) */
  E.legPre = (F, src, tgt, v) => {
    if (!src || !foe(F, src, tgt)) return v;
    if (tgt.lgDr) v *= 1 - tgt.lgDr / 100;
    if (src.lgWeak) v *= 1 - src.lgWeak / 100;
    const T = tgt.lgS;
    if (T && T.dodge > 0) { T.dodge--; pop(F, tgt, "Voile de Brume"); A().flog(F, `${tgt.name} esquive l'attaque (Voile de Brume).`, "dim"); return 0; }
    if (T && T.mirror) { T.mirror = false; const r = Math.round(v * LV(tgt) / 100); v -= r; if (src.alive && r > 0) { src.hp -= r; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(src), s: F.ents.indexOf(tgt), v: r, el: "n" }); say(F, `Bouclier Miroir : ${src.name} reçoit −${r}.`); if (src.hp <= 0) { src.hp = 0; src.alive = false; A().killed(F, src); } } }
    /* Manteau du Gardien : un allié en meilleure forme encaisse une part des coups du plus blessé */
    if (tgt.st && !tgt.summon && !has(tgt, "garde") && !F.lgGuarding) {
      const g = matesOf(F, tgt).find((m) => m !== tgt && has(m, "garde") && m.hp / m.hpMax > tgt.hp / tgt.hpMax);
      if (g) { const low = matesOf(F, tgt).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (low === tgt) { const part = Math.round(v * LV(g) / 100); if (part > 0) { v -= part; g.hp = Math.max(1, g.hp - part); F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(g), s: F.ents.indexOf(src), v: part, el: "n" }); } } }
    }
    return v;
  };
  /* à 0 PV : Trompe-la-Mort, Boucle du Réveil */
  E.legSave = (F, src, tgt, v) => {
    const T = tgt.lgS; if (!T) return;
    if (T.trick && src && src.alive && foe(F, src, tgt)) { T.trick = 0; tgt.hp = 1; const r = Math.max(1, Math.round(v * LV(tgt) / 100)); src.hp -= r; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(src), s: F.ents.indexOf(tgt), v: r, el: "n" }); say(F, `Trompe-la-Mort : ${tgt.name} renvoie le coup fatal à ${src.name} (−${r}) !`); if (src.hp <= 0) { src.hp = 0; src.alive = false; A().killed(F, src); } return; }
    if (T.rise) { T.rise = 0; tgt.hp = Math.max(1, Math.round(tgt.hpMax * LV(tgt) / 100)); say(F, `${tgt.name} se relève (Boucle du Réveil) !`); F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); }
  };
  /* après un coup du porteur */
  E.legHit = (F, src, tgt, v, el) => {
    const x = E.LEG[src.lg.k]; if (!x || !foe(F, src, tgt)) return; const p = x.p, val = LV(src); const S0 = src.lgS || (src.lgS = {});
    if (!tgt.alive) { S0.kills = (S0.kills || 0) + 1; if (p === "achevePa") src.paBonus = Math.max(src.paBonus || 0, val); return; }
    if (p === "saigne" && S0.crit && !tgt.noDot) tgt.dots.push({ v: Math.max(1, Math.round(v * val / 100)), turns: 1, el: null, src: src.name });
    if (p === "acheve" && !tgt.boss && tgt.hp < tgt.hpMax * val / 100) { tgt.hp = 0; tgt.alive = false; A().killed(F, tgt); say(F, `Ciseaux du Destin : ${tgt.name} est achevé.`); S0.kills = (S0.kills || 0) + 1; return; }
    if (p === "gel" && tgt.slowR !== F.round + 1 && S0.gelR !== F.round && rnd() * 100 < val) { S0.gelR = F.round; tgt.slowR = F.round + 1; pop(F, tgt, "−1 PM"); }
    if (p === "etourdit" && !tgt.lgStun && !tgt.boss && rnd() * 100 < val) { tgt.lgStun = 1; tgt.stun = 1; pop(F, tgt, "Étourdi"); }
    if ((p === "fauche" || p === "echo") && !F.lgEcho) {
      if (p === "echo") { S0.n = (S0.n || 0) + 1; if (S0.n % 4) return; }
      const o = foesOf(F, src).filter((m) => m !== tgt && !m.fake); const t2 = o.length ? o[Math.floor(rnd() * o.length)] : p === "echo" ? tgt : null;
      if (t2 && t2.alive) { F.lgEcho = true; const d = A().dealDamage(F, src, t2, v * val / 100, el); F.lgEcho = false; A().flog(F, `${x.name} : ${t2.name} −${d}.`, "dim"); }
    }
  };
  /* après un coup reçu par le porteur */
  E.legHurt = (F, src, tgt, v) => {
    const x = E.LEG[tgt.lg.k]; if (!x || !src || !foe(F, src, tgt) || v <= 0) return; const p = x.p, val = LV(tgt); const S0 = tgt.lgS || (tgt.lgS = {});
    if (p === "ferveur") S0.hits = (S0.hits || 0) + 1;
    if (p === "renvoi" && src.alive && !F.lgEcho) { const r = Math.max(1, Math.round(v * val / 100)); src.hp -= r; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(src), s: F.ents.indexOf(tgt), v: r, el: "n" }); if (src.hp <= 0) { src.hp = 0; src.alive = false; A().killed(F, src); } }
  };
  /* le porteur esquive une attaque (Audace de Dodge) */
  E.legDodged = (F, t) => { if (has(t, "audace")) (t.lgS || (t.lgS = {})).nextCrit = true; };
  /* soins lancés par le porteur : multiplicateur et effets */
  E.legHealMult = (e) => (has(e, "marees") ? 1 + LV(e) / 100 : 1);
  E.legHealed = (F, e, t, wanted, got) => {
    if (has(e, "marees") && wanted > got) { const sh = Math.round((wanted - got) / 2); if (sh > 0) t.shield = Math.min(Math.round(t.hpMax * 0.3), (t.shield || 0) + sh); }
    if (has(e, "partage") && got > 0 && !F.lgShare) { const o = matesOf(F, e).filter((m) => m !== t && m.hp < m.hpMax).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (o) { F.lgShare = true; A().doHeal(o, wanted * LV(e) / 100, F); F.lgShare = false; } }
  };
  E.legCd = (e, cd) => (has(e, "relance") ? Math.max(1, cd - LV(e)) : cd);
  /* début du tour d'une entité : renvoie false si elle passe son tour (étourdie) */
  E.legTurn = (S, F, e) => {
    if (e.lgStun && e.stun > 0 && !e.st) { e.stun = 0; A().flog(F, `${e.name} est étourdi et passe son tour.`, "dim"); return false; }
    if (!e.lg || !e.alive) return true;
    const x = E.LEG[e.lg.k]; if (!x) return true; const p = x.p, val = LV(e); const S0 = e.lgS || (e.lgS = {});
    S0.turns = (S0.turns || 0) + 1;
    if (p === "pm1" && S0.pm1 && F.round > 1) { e.st = Object.assign({}, e.st, { pm: Math.max(0, (e.st.pm || 0) - S0.pm1) }); S0.pm1 = 0; }
    if (p === "pavie" && e.hp > e.hpMax * val / 100) e.paBonus = Math.max(e.paBonus || 0, 1);
    if (p === "amour") matesOf(F, e).forEach((m) => { if (m.hp < m.hpMax) A().doHeal(m, m.hpMax * val / 100, F); });
    if (p === "miroir" && S0.turns % 3 === 0) { S0.mirror = true; pop(F, e, "Miroir"); }
    if (p === "eclair" && S0.turns % 3 === 0) {
      const fs = foesOf(F, e).filter((m) => !m.fake); if (fs.length) { say(F, `Lance-Éclair de Menalt : un éclair frappe tous les ennemis !`);
        fs.forEach((m) => { F.lgEcho = true; A().dealDamage(F, e, m, m.hpMax * val / 100 * (m.boss || m.st ? 0.5 : 1), "a"); F.lgEcho = false; }); }
    }
    return true;
  };

  if (E.ACH) {
    const add = (o) => { if (!E.ACH.some((a) => a.id === o.id)) E.ACH.push(o); };
    add({ id: "leg1", cat: "Songe infini", name: "Légende vivante", desc: "Obtenir un objet légendaire.", test: (S) => ((S.cnt && S.cnt.legs) || 0) >= 1, kamas: 50000, title: "Légende vivante" });
    add({ id: "legev5", cat: "Songe infini", name: "Éveil complet", desc: "Porter un objet légendaire à l'Éveil V.", test: (S) => Object.values(S.items || {}).some((it) => ITEMS[it.tpl] && ITEMS[it.tpl].leg && E.legEv(it) >= 5), kamas: 200000, title: "Éveillé" });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
