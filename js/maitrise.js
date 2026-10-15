/* ============================================================================
   IDLUS 2.0 — LA MAÎTRISE (maquette jouable, branche maitrise, pas sur le jeu)
   - après le niveau 200, l'XP remplit des niveaux de Maîtrise sans fin : 1 point par niveau,
     coût constant (l'XP du niveau 199 → 200) ; gardée à la Renaissance, active seulement au niveau 200
   - un ciel (arbre en constellation) par classe : ~1 500 étoiles, cœur de classe (26 étoiles du passif),
     3 clés de voûte de classe, 6 domaines (les deux éléments forts de la classe en haut), joyaux,
     Nébuleuse cachée à 1 000 points ; 3 arbres enregistrés, recherche, chemin planifié, annuler,
     comparer avant de changer, partager ; Maîtrise du compte (+1 % d'XP par 100 points)
   - Maîtrise du Bestiaire : 20 paliers par famille, +0,5 % contre la famille par palier,
     récompenses aux paliers 5, 10, 15 et 20, famille du jour (progression doublée)
   Page Héros › Maîtrise (DX.pages.maitrise), actions « mt-… » relayées par ui.js.
   ========================================================================== */
(function () {
  "use strict";
  if (!window.DX) return;
  const E = window.DX.E; const D = window.DATA; const { CLASSES, MONSTERS } = D;
  const TAU = Math.PI * 2;
  const FORT = { iop: [0, 1], sacri: [0, 4], forge: [0, 3], ougi: [0, 2], roub: [1, 0], hupper: [1, 2], eni: [1, 5], enu: [2, 0], steam: [2, 1], osa: [2, 0], cra: [3, 1], sram: [3, 0], eca: [2, 3], panda: [0, 4], feca: [1, 4], sadi: [0, 2], xelor: [1, 5], elio: [1, 2], zobal: [3, 4] };
  /* trois clés de voûte propres à chaque classe */
  const KSC = {
    iop: [["Colère de Iop", "Tous les 3 tours, le prochain coup fait ×2 ; −10 % de PV."], ["Épée céleste", "Les coups touchent aussi la ligne arrière à 30 % ; −1 PM."], ["Vertu", "Bouclier de 15 % des PV au tour 1 ; −10 % de dégâts."]],
    sacri: [["Punition", "+1 % de dégâts par 2 % de PV perdus ; soins reçus −20 %."], ["Transposition", "Prend à sa place le premier coup visant un allié fragile ; −10 % de dégâts."], ["Sacrifice", "Les soins qu'il reçoit soignent aussi l'allié le plus bas à 30 %."]],
    forge: [["Fer de lance", "Le premier sort de chaque tour fait +35 % ; les suivants −10 %."], ["Forge ardente", "Chaque coup critique donne +5 % de dégâts cumulables (max 25 %)."], ["Hampe brisée", "Les coups retirent 1 PM ; −10 % de critique."]],
    ougi: [["Rage d'Ouginak", "Sous 50 % de PV, +30 % de dégâts ; −15 % de résistances."], ["Proie", "La cible marquée subit +20 % de toute l'équipe ; −10 % de dégâts sur les autres."], ["Molosse", "Invoque un chien au tour 1 ; −10 % de PV."]],
    roub: [["Explobombe", "Les bombes explosent deux fois à 60 % ; −1 PA au tour 1."], ["Mur de bombes", "Les bombes posées donnent 5 % de résistances aux alliés."], ["Roublabot", "Un Roublabot frappe à chaque tour ; −10 % de dégâts."]],
    hupper: [["Polarité", "Alterner deux éléments donne +25 % ; répéter le même −15 %."], ["Rune élémentaire", "Chaque rune posée donne +4 % de dégâts du même élément (max 20 %)."], ["Cristal", "Les sorts de zone font +20 % ; ceux à cible unique −10 %."]],
    eni: [["Mot de Régénération", "Les soins sur la durée sont +40 % ; soins directs −15 %."], ["Mot Stimulant", "Le soin le plus fort du tour donne +1 PA à la cible ; −15 % de soins."], ["Mot Interdit", "Les soins en trop deviennent des dégâts Feu ; −10 % de PV."]],
    enu: [["Pelle Fantomatique", "Chaque coup vole 2 % de kamas en plus du butin ; −10 % de dégâts."], ["Coffre animé", "Le coffre encaisse le premier sort de zone ennemi."], ["Fortune", "+40 % de Prospection ; −10 % de PV."]],
    steam: [["Tourelle Harponneuse", "Les tourelles frappent 2 fois ; elles ont −30 % de PV."], ["Scaphandre", "Bouclier de 20 % des PV tant qu'une tourelle tient debout."], ["Marée", "Les sorts d'Eau soignent l'allié le plus bas de 10 % des dégâts."]],
    osa: [["Dragonnet", "Les invocations héritent de 30 % de ses caractéristiques ; −15 % de PV."], ["Fouet", "Les invocations jouent avant les ennemis ; −1 PA."], ["Crapaud", "Quand une invocation meurt, soigne l'équipe de 5 %."]],
    cra: [["Flèche Punitive", "+6 % de dégâts par tour sans être frappé ; remis à zéro quand il est touché."], ["Œil de Taupe", "Ignore 20 % des résistances ; −10 % de PV."], ["Tir Éloigné", "Ligne arrière : +25 % de dégâts ; ligne avant : −25 %."]],
    sram: [["Piège Mortel", "Les pièges font +50 % ; −1 piège par combat."], ["Invisibilité", "Invisible au tour 1 ; −10 % de PV."], ["Double", "Un double copie 30 % de ses coups ; −10 % de dégâts."]],
    eca: [["Tout ou Rien", "Critiques ×1,8 ; coups non critiques −20 %."], ["Roue de la Fortune", "Chaque tour, un bonus au hasard parmi 6 ; jamais le même deux fois."], ["Bluff", "15 % de chances d'esquiver totalement un coup ; −10 % de résistances."]],
    panda: [["Karcham", "Porter un allié lui donne 20 % de résistances ; −1 PM."], ["Ivresse", "Ivre : +30 % de dégâts et −20 % d'esquive."], ["Lait de Bambou", "Soigne 4 % des PV de l'équipe à chaque tour ; −15 % de dégâts."]],
    feca: [["Glyphe Agressif", "Les glyphes font aussi des dégâts Feu ; ils durent 1 tour de moins."], ["Trêve", "Une fois par combat, annule tous les dégâts d'un tour ennemi."], ["Bouclier Féca", "Les boucliers donnés sont +30 % ; dégâts −15 %."]],
    sadi: [["La Folle", "Les poupées frappent 2 fois à 60 % ; −10 % de PV."], ["Arbre de vie", "Quand un allié tombe, un arbre le relève à 20 % une fois."], ["Ronces", "Les coups empoisonnent ; −10 % de dégâts directs."]],
    xelor: [["Momification", "Les retraits de PA sont +1 ; −15 % de dégâts."], ["Distorsion", "Rejoue un tour sur 4 ; −20 % de PV."], ["Sablier", "Les recharges de l'équipe −1 tour au tour 5 ; −10 % de dégâts."]],
    elio: [["Portail", "Chaque portail donne +8 % de dégâts au sort qui le traverse (max 3)."], ["Convergence", "Les sorts à travers 2 portails font ×1,5 ; −1 PM."], ["Audace", "+20 % de dégâts au contact ; −15 % à distance."]],
    zobal: [["Masque du Classique", "Change de masque chaque tour : +15 % dégâts, puis +15 % résistances."], ["Plastron", "Bouclier de 10 % des PV à chaque changement de masque."], ["Furie", "+5 % de dégâts par masque porté dans le combat (max 25 %)."]],
  };
  const DOM = [
    { n: "Terre", c: "#d39a5c", st: [["Force", 4, "fo"], ["% dégâts Terre", 1, "fo"], ["Puissance", 3, "pui"]],
      nt: ["Roc d'Amakna","Colosse","Séisme intérieur","Poigne de fer","Racines profondes","Muraille de granit","Éboulement","Cœur de pierre","Tellurique","Masse d'armes","Force tranquille","Coup de boutoir"],
      ks: [["Fureur du Colosse","+30 % de dégâts Terre ; −15 % de PV."],["Inébranlable","Impossible à repousser ou à entraver ; −1 PM."],["Briseur de boucliers","Les coups retirent 20 % du bouclier adverse ; −10 % de critique."]] },
    { n: "Feu", c: "#ff6b4a", st: [["Intelligence", 4, "ine"], ["% dégâts Feu", 1, "ine"], ["Puissance", 3, "pui"]],
      nt: ["Brasier","Flamme du Phénix","Cendres","Fournaise","Étincelle","Combustion","Lave vive","Feu sacré","Braises","Incandescence","Feu follet","Flambée"],
      ks: [["Bûcher","Les brûlures se cumulent sans limite ; les soins reçus −25 %."],["Phénix","Une fois par combat, revient à 30 % de PV ; −10 % de dégâts."],["Pyromane","Chaque sort de Feu laisse une brûlure ; les sorts de Feu coûtent +1 PA."]] },
    { n: "Eau", c: "#4aa8ff", st: [["Chance", 4, "cha"], ["% dégâts Eau", 1, "cha"], ["Prospection", 5, "pp"]],
      nt: ["Marée","Fortune","Source claire","Ressac","Abysses","Pluie d'or","Courant","Perle rare","Écume","Profondeurs","Bonne étoile","Trésor englouti"],
      ks: [["Pile ou Face","Une attaque sur deux fait +60 %, l'autre −30 %."],["Coffre d'Enutrof","+25 % de butin ; −10 % de dégâts."],["Raz-de-marée","Les sorts d'Eau touchent un ennemi de plus à 40 % ; −10 % de PV."]] },
    { n: "Air", c: "#7ddc6a", st: [["Agilité", 4, "age"], ["% dégâts Air", 1, "age"], ["Critique", 1, "cri"]],
      nt: ["Rafale","Œil de lynx","Vent arrière","Pas léger","Tourbillon","Zéphyr","Plume","Ouragan","Envolée","Souffle vif","Courant d'air","Lame du vent"],
      ks: [["Critique absolu","Chance de critique ×2 ; dégâts critiques −30 %."],["Insaisissable","+20 % d'esquive ; −20 % de PV."],["Premier coup","Joue toujours en premier au tour 1 ; −1 PA au tour 2."]] },
    { n: "Vitalité", c: "#ff7aa8", st: [["Vitalité", 20, "vit"], ["% PV", 1, "vit"], ["Résistance", 1, "re"]],
      nt: ["Cœur de Bouftou","Rempart","Sang chaud","Seconde peau","Endurance","Bastion","Régénération","Peau dure","Souffle long","Garde rapprochée","Robustesse","Armure vivante"],
      ks: [["Sang de Sacrieur","Plus il perd de PV, plus il frappe (jusqu'à +40 %) ; ne peut pas être soigné au-dessus de 80 %."],["Bouclier vivant","Encaisse 25 % des dégâts des alliés ; −15 % de dégâts."],["Immortel","Une fois par combat, survit à 1 PV ; les soins reçus −20 %."]] },
    { n: "Sagesse", c: "#c49bff", st: [["Sagesse", 4, "sa"], ["% soins", 1, "so"], ["Initiative", 30, "ini"]],
      nt: ["Sagesse des Anciens","Pendule","Almanax","Méditation","Clairvoyance","Mémoire","Horloge","Esprit vif","Érudit","Lumière","Patience","Calme intérieur"],
      ks: [["Maître du temps","Les recharges des sorts −1 tour ; −15 % de dégâts."],["Identité exaltée","Mécaniques des sorts +50 % ; −10 % de dégâts directs."],["Grand soigneur","Soins +40 % ; dégâts −25 %."]] },
  ];
  const SEC2 = [["Résistances", 1, "re"], ["Soins", 2, "so"], ["Initiative", 25, "ini"], ["Critique", 1, "cri"]];
  const ICO = { "Force": "fo", "% dégâts Terre": "fo", "Puissance": "pui", "Intelligence": "ine", "% dégâts Feu": "ine", "Chance": "cha", "% dégâts Eau": "cha", "Prospection": "pp", "Agilité": "age", "% dégâts Air": "age", "Critique": "cri", "Vitalité": "vit", "% PV": "vit", "Résistance": "re", "Résistances": "re", "Sagesse": "sa", "% soins": "so", "Soins": "so", "Initiative": "ini", "% dégâts": "pui" };

  /* ---------- moteur ---------- */
  E.MT_OPEN = 1000; E.MT_FREE = 50; E.MT_RESPEC = 20000; E.MT_UNDO = 10;
  E.mt = (c) => { if (!c.mt) c.mt = { lvl: 0, xp: 0, t: [[], [], []], lo: 0, j: {} }; return c.mt; };
  E.mtNeed = (c) => E.heroXpNeed(c, E.MAX_LVL - 1);
  E.mtOn = (c) => c.lvl >= E.MAX_LVL;
  const giveXp0 = E.giveXp;
  E.giveXp = (S, c, g) => { // au niveau 200, l'XP remplit la Maîtrise (gardée à la Renaissance, active seulement au niveau 200)
    if (c.lvl < E.MAX_LVL) return giveXp0(S, c, g);
    const M = E.mt(c); M.xp += g; let up = false; const need = E.mtNeed(c);
    while (M.xp >= need) { M.xp -= need; M.lvl++; up = true; }
    return up;
  };
  E.mtAcct = (S) => S.chars.reduce((a, c) => a + (c.mt ? c.mt.lvl : 0), 0);
  E.mtAcctPct = (S) => Math.floor(E.mtAcct(S) / 100);

  /* ---------- un ciel par classe ---------- */
  const TREES = {};
  const CLS_IDX = () => D.CLASS_ORDER || Object.keys(CLASSES);
  function build(cls) {
    if (TREES[cls]) return TREES[cls];
    const k = CLS_IDX().indexOf(cls);
    let seed = 101 + k * 7919; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const N = [], ED = [], SP = [], cks = []; const domTh = [];
    const add = (o) => { o.id = N.length; o.adj = []; N.push(o); return o.id; };
    const link = (a, b) => { if (a == null || b == null || a === b || N[a].adj.includes(b)) return; N[a].adj.push(b); N[b].adj.push(a); ED.push([a, b]); };
    const P = (o, th, r, lr = 0, lt = 0) => Object.assign(o, { th, r, lr, lt });
    const small = (d, i) => { const D0 = DOM[d]; const s = i % 6 === 5 ? SEC2[i % SEC2.length] : D0.st[i % 3]; return { t: "s", d, n: s[0], b: [[s[0], s[1]]], txt: `+${s[1]} ${s[0]}`, ic: ICO[s[0]] }; };
    const ntI = DOM.map((_, d) => (k * 5 + d) % 12);
    const notable = (d) => { const D0 = DOM[d]; const n = D0.nt[ntI[d]++ % D0.nt.length]; const b = [[D0.st[0][0], D0.st[0][1] * 5], [D0.st[1][0], D0.st[1][1] * 3]]; return { t: "nt", d, n, b, txt: b.map(([s, v]) => `+${v} ${s}`).join(" · "), ic: D0.st[0][2] }; };
    const C = CLASSES[cls], f = FORT[cls] || [0, 1], pas = (C.passive && C.passive.name) || "Passif";
    const rest = [0, 1, 2, 3, 4, 5].filter((d) => !f.includes(d));
    const order = [f[0], f[1], rest[0], rest[1], rest[2], rest[3]]; const slot = [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5];
    order.forEach((d, i) => (domTh[d] = TAU * slot[i] / 6));
    const start = add(P({ t: "start", d: f[0], n: C.name, txt: `Le cœur du ciel ${C.name}. Tout part d'ici.` }, 0, 0));
    const nm = (i) => `${pas} ${["I", "II", "III", "IV", "V", "VI"][i]}`;
    const core = (n, v, big) => ({ t: "cls", d: f[0], n, txt: `+${v} % d'effet du passif ${pas}.`, b: [[`Passif ${pas} (%)`, v]], big });
    const r1 = []; for (let i = 0; i < 8; i++) r1.push(add(P(core(nm(i % 3), 1), TAU * (i + 0.5) / 8, 64)));
    r1.forEach((id, i) => { link(start, id); link(id, r1[(i + 1) % 8]); });
    const r2 = []; for (let i = 0; i < 18; i++) r2.push(add(P(i % 6 === 0 ? core(`${pas} majeur`, 4, true) : core(nm(3 + (i % 3)), 1), TAU * i / 18, 150)));
    r2.forEach((id, i) => link(id, r2[(i + 1) % 18]));
    r1.forEach((id, i) => link(id, r2[Math.round((i + 0.5) * 18 / 8) % 18]));
    order.forEach((d) => [-0.3, 0, 0.3].forEach((o) => SP.push({ d, th: domTh[d] + o, lv: [] })));
    SP.sort((a, b) => ((a.th + TAU) % TAU) - ((b.th + TAU) % TAU));
    SP.forEach((S0, si) => {
      let r = 240, prev = null;
      for (let cc = 0; cc < 5; cc++) {
        const th = S0.th + (rnd() - 0.5) * 0.04;
        for (let i = 0; i < 4; i++) { const id = add(P(small(S0.d, si + cc + i), th + (rnd() - 0.5) * 0.02, r)); if (prev != null) link(prev, id); else S0.root = id; prev = id; r += 30; }
        r += 38;
        const ctr = add(P(notable(S0.d), th, r)); const ring = [];
        for (let j = 0; j < 8; j++) { const a = TAU * j / 8 + Math.PI; const o = small(S0.d, si * 3 + cc + j); if (j === 3 && cc % 2 === 0) Object.assign(o, { t: "joy", n: "Emplacement de joyau", txt: "Sertis un joyau trouvé sur les boss en stasis 10+.", b: [], ic: null }); ring.push(add(P(o, th, r, Math.cos(a) * 46, Math.sin(a) * 46))); }
        for (let j = 0; j < 8; j++) link(ring[j], ring[(j + 1) % 8]);
        link(prev, ring[0]); link(ctr, ring[2]); link(ctr, ring[6]); S0.lv.push(ring);
        if (cc === 1 || cc === 3) { const side = cc === 1 ? 1 : -1; let p2 = ring[side > 0 ? 2 : 6];
          for (let i = 0; i < 5; i++) { const id = add(P(small(S0.d, cc * 7 + i), th, r + 10 + i * 6, 0, side * (70 + i * 26))); link(p2, id); p2 = id; }
          link(p2, add(P(notable(S0.d), th, r + 44, 0, side * 190))); }
        prev = ring[4]; r += 76;
      }
      const kq = SP.filter((x) => x.d === S0.d).indexOf(S0); const kk = DOM[S0.d].ks[kq];
      S0.ks = add(P({ t: "ks", d: S0.d, n: kk[0], txt: kk[1], b: [], ic: null }, S0.th, r + 40)); link(prev, S0.ks);
      let best = 0, bd = 9; r2.forEach((id) => { const dd = Math.abs(((N[id].th - S0.th + TAU * 1.5) % TAU) - Math.PI); if (dd < bd) { bd = dd; best = id; } }); link(best, S0.root);
    });
    SP.forEach((S0, si) => { const T2 = SP[(si + 1) % SP.length]; link(S0.root, T2.root);
      S0.lv.forEach((ring, cc) => { if (cc === 0 || rnd() < 0.45) { const a = ring[2], b = T2.lv[cc][6]; let mt = (N[a].th + N[b].th) / 2; if (Math.abs(N[a].th - N[b].th) > Math.PI) mt += Math.PI; const m1 = add(P(small(S0.d, cc + si), mt, N[a].r)); link(a, m1); link(m1, b); } }); });
    (KSC[cls] || []).forEach((kk, i) => {
      const th = TAU * [2, 3, 4][i] / 6; let prev = r2[Math.round(th / TAU * 18) % 18];
      for (let j = 0; j < 4; j++) { const id = add(P({ t: "cls", d: f[0], n: `Voie : ${kk[0]}`, txt: `+1 % d'effet du passif ${pas} ; mène à ${kk[0]}.`, b: [[`Passif ${pas} (%)`, 1]] }, th, 190 + j * 34)); link(prev, id); prev = id; }
      const id = add(P({ t: "cks", d: f[0], n: kk[0], txt: kk[1], b: [] }, th, 350)); link(prev, id); cks.push(id);
    });
    { const NB = [["% dégâts", 1, "pui"], ["% PV", 1, "vit"], ["Résistances", 2, "re"], ["Critique", 1, "cri"]];
      const nb = (i) => { const s = NB[i % 4]; return { t: "s", neb: true, d: 5, n: s[0], b: [[s[0], s[1]]], txt: `+${s[1]} ${s[0]} (Nébuleuse)`, ic: s[2] }; };
      const near = (th) => SP.reduce((m, x) => (Math.abs(((x.th - th + TAU * 1.5) % TAU) - Math.PI) < Math.abs(((m.th - th + TAU * 1.5) % TAU) - Math.PI) ? x : m));
      const hub = add(P({ t: "nt", neb: true, d: 5, n: "Cœur de la Nébuleuse", b: [["% dégâts", 4], ["% PV", 4]], txt: "+4 % de dégâts · +4 % de PV", ic: "pui" }, Math.PI, 1800));
      [-1, 1].forEach((sd) => { const S0 = near(Math.PI + sd * 0.3); let prev = S0.lv[4][sd > 0 ? 2 : 6]; for (let i = 0; i < 4; i++) { const id = add(P(nb(i + (sd > 0 ? 2 : 0)), Math.PI + sd * (0.24 - i * 0.05), 1540 + i * 60)); link(prev, id); prev = id; } link(prev, hub); });
      const ringN = []; for (let j = 0; j < 12; j++) { const a = TAU * j / 12; ringN.push(add(P(nb(j), Math.PI, 1800, Math.cos(a) * 80, Math.sin(a) * 80))); }
      ringN.forEach((id, j) => { link(id, ringN[(j + 1) % 12]); if (j % 4 === 0) link(hub, id); });
      NKS.forEach((kk, i) => { const th = Math.PI + (i - 1) * 0.11; let prev = ringN[[5, 6, 7][i]]; for (let j = 0; j < 6; j++) { const id = add(P(nb(i + j), th, 1900 + j * 34)); link(prev, id); prev = id; } link(prev, add(P({ t: "ks", neb: true, d: 5, n: kk[0], txt: kk[1], b: [] }, th, 2130))); });
    }
    for (const n of N) { const X0 = Math.sin(n.th) * n.r, Y0 = -Math.cos(n.th) * n.r, psi = n.th - Math.PI / 2; n.X = X0 + Math.cos(psi) * n.lr - Math.sin(psi) * n.lt; n.Y = Y0 + Math.sin(psi) * n.lr + Math.cos(psi) * n.lt; }
    const coreIds = N.filter((n) => n.t === "cls" && n.r <= 150).map((n) => n.id);
    return (TREES[cls] = { cls, N, ED, SP, cks, start, domTh, coreIds, order, pas });
  }
  E.mtTree = build;
  const NKS = [["Œil de l'Éternel", "Voit le prochain sort ennemi : −30 % de dégâts reçus de ce sort ; −5 % de dégâts."], ["Larme d'Eliatrope", "+15 % à toutes les caractéristiques de la Maîtrise ; −1 PM."], ["Souffle d'Ogrest", "Le premier coup de chaque combat fait ×3 ; −15 % de PV."]];
  E.mtGot = (c, lo) => { const M = E.mt(c); const T = build(c.cls); return new Set([T.start, ...(M.t[lo === undefined ? M.lo : lo] || [])]); };
  E.mtStats = (S, c, set) => { const T = build(c.cls); const got = set || E.mtGot(c); const t = {}; const ks = [];
    got.forEach((id) => { const n = T.N[id]; if (!n) return; if (n.t === "ks" || n.t === "cks") ks.push(n); (n.b || []).forEach(([s, v]) => (t[s] = (t[s] || 0) + v)); });
    const sym = T.coreIds.every((id) => got.has(id)); if (sym) t[`Passif ${T.pas} (%)`] = (t[`Passif ${T.pas} (%)`] || 0) + 5;
    const M = E.mt(c); for (const id in M.j) if (got.has(+id)) { const J = (S.joy || []).find((x) => x.uid === M.j[id]); if (J && JOY[J.k]) { const [s, v] = JOY[J.k].b; t[s] = (t[s] || 0) + v; } }
    return { t, ks, sym }; };
  /* partager : un code par arbre (bits des étoiles prises) */
  E.mtCode = (c) => { const T = build(c.cls); const got = E.mtGot(c); const by = new Uint8Array(Math.ceil(T.N.length / 8)); got.forEach((id) => (by[id >> 3] |= 1 << (id & 7))); let s = ""; by.forEach((b) => (s += String.fromCharCode(b))); return `IDLUS-MT-${c.cls}-${btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`; };
  E.mtRead = (code) => { const m = /^IDLUS-MT-([a-z]+)-([A-Za-z0-9_-]+)$/.exec(String(code).trim()); if (!m || !CLASSES[m[1]]) return null; try { const s = atob(m[2].replace(/-/g, "+").replace(/_/g, "/")); const ids = []; for (let i = 0; i < s.length; i++) for (let b = 0; b < 8; b++) if (s.charCodeAt(i) & (1 << b)) ids.push(i * 8 + b); return { cls: m[1], ids }; } catch (e) { return null; } };

  /* ---------- joyaux (boss en stasis 10+) ---------- */
  const JOY = {
    ambre: { n: "Ambre du Tynril", c: "#d39a5c", b: ["% dégâts Terre", 4] }, rubis: { n: "Rubis d'Ogrest", c: "#ff6b4a", b: ["% dégâts Feu", 4] },
    saphir: { n: "Saphir des Abysses", c: "#4aa8ff", b: ["% dégâts Eau", 4] }, emeraude: { n: "Émeraude d'Ouranos", c: "#7ddc6a", b: ["% dégâts Air", 4] },
    perle: { n: "Perle de Vitalité", c: "#ff7aa8", b: ["% PV", 5] }, opale: { n: "Opale du Temps", c: "#c49bff", b: ["Initiative", 150] } };
  E.JOY = JOY;

  /* ---------- Maîtrise du Bestiaire ---------- */
  E.BT = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 20000, 35000, 60000, 100000];
  E.BT_REW = { 5: "Ornement de la famille", 10: "Trophée : +2 % de butin sur la famille", 15: "Titre « Fléau »", 20: "Aura de la famille dans la Scène" };
  E.btKills = (S, r) => (E.RACE_MONS[r] || []).reduce((a, k) => a + (S.bestiary[k] || 0), 0);
  E.btTier = (S, r) => { const n = E.btKills(S, r); let t = 0; E.BT.forEach((v, i) => { if (n >= v) t = i + 1; }); return t; };
  E.btDay = (S) => { const R = Object.keys(E.RACE_MONS).filter((r) => E.btKills(S, r) > 0).sort(); return R.length ? R[Math.floor(E.now() / 86400000) % R.length] : null; };
  E.btRank = (S) => Object.keys(E.RACE_MONS).reduce((a, r) => a + E.btTier(S, r), 0);

  /* ============================== affichage ============================== */
  const X = () => window.DX.social; const h = (s) => X().h(s); const IC = (n) => X().IC(n);
  const S = () => window.DX.S; const ui = () => window.DX.ui;
  const fmt = (n) => Math.floor(n).toLocaleString("fr-FR");
  const pctf = (a, b) => Math.max(0, Math.min(100, b ? (a / b) * 100 : 0));
  const sym = (cls) => `assets/h/${cls}_sym.png`;
  const st = { tab: "arbre", cid: null, view: null, z: 0, ox: 0, oy: 0, sel: null, hov: null, q: "", hist: [], cmp: null, share: false, fam: "all", key: "" };
  const IMG = {}; const img = (k, src) => { if (!IMG[k]) { const i = new Image(); i.onload = () => draw(); i.src = src; IMG[k] = i; } return IMG[k]; };
  const hero = () => { const s = S(); let c = s.chars.find((x) => x.id === st.cid); if (!c) { c = s.chars.slice().sort((a, b) => b.lvl - a.lvl || ((b.mt && b.mt.lvl) || 0) - ((a.mt && a.mt.lvl) || 0))[0]; st.cid = c ? c.id : null; } return c; };
  const treeCls = () => st.view || hero().cls;
  const canEdit = () => !st.view && E.mtOn(hero());
  let got = new Set();
  const loadGot = () => { const c = hero(); const T = build(treeCls()); got = st.view ? new Set([T.start]) : E.mtGot(c); };
  const pts = () => (st.view ? E.MT_OPEN + 200 : E.mt(hero()).lvl);
  const used = () => got.size - 1;
  const nebOpen = () => pts() >= E.MT_OPEN;
  const T = () => build(treeCls());
  const allowed = (id) => { const n = T().N[id]; return n.t !== "start" && !(n.neb && !nebOpen()); };
  const pathTo = (t) => { const N = T().N; if (got.has(t)) return []; if (!allowed(t)) return null;
    const prev = new Map(); const q = [...got]; q.forEach((x) => prev.set(x, -1)); let hd = 0;
    while (hd < q.length) { const x = q[hd++]; if (x === t) break; for (const y of N[x].adj) { if (!allowed(y) || prev.has(y)) continue; prev.set(y, x); q.push(y); } }
    if (!prev.has(t)) return null; const p = []; let x = t; while (!got.has(x)) { p.push(x); x = prev.get(x); } return p.reverse(); };
  const connectedWithout = (rm) => { const N = T().N, s0 = T().start; const seen = new Set([s0]); const q = [s0]; while (q.length) { const x = q.pop(); for (const y of N[x].adj) if (got.has(y) && y !== rm && !seen.has(y)) { seen.add(y); q.push(y); } } return seen.size === got.size - 1; };
  const save = () => { if (st.view) return; const M = E.mt(hero()); M.t[M.lo] = [...got].filter((x) => x !== T().start); };
  const domCol = (n) => (n.t === "start" || n.t === "cls" || n.t === "cks" ? CLASSES[treeCls()].color : DOM[n.d].c);

  /* ---------- dessin ---------- */
  let cv = null, g = null, W = 0, H = 0, dpr = 1;
  const toS = (n) => [W / 2 + (n.X + st.ox) * st.z, H / 2 + (n.Y + st.oy) * st.z];
  const BASE = { s: 8, cls: 8, joy: 8, nt: 15, ks: 24, cks: 26, start: 30 };
  const rad = (n) => BASE[n.t] * (n.big ? 1.5 : 1) * Math.max(0.45, Math.min(1.5, st.z));
  const hits = () => { const q = norm(st.q.trim()); return new Set(q.length < 2 ? [] : T().N.filter((n) => n.t !== "start" && !(n.neb && !nebOpen()) && norm(n.n + " " + n.txt).includes(q)).map((n) => n.id)); };
  const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function draw() {
    if (!g || !cv || !cv.isConnected) return; const Tr = T(), N = Tr.N, cc = CLASSES[Tr.cls].color, HIT = hits();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const path = st.hov != null && !got.has(st.hov) ? pathTo(st.hov) || [] : []; const ps = new Set(path);
    /* Nébuleuse */
    { const c0 = [W / 2 + st.ox * st.z, H / 2 + (1880 + st.oy) * st.z], R = 420 * st.z; const gr = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], R);
      gr.addColorStop(0, nebOpen() ? "rgba(196,155,255,.30)" : "rgba(160,150,200,.22)"); gr.addColorStop(1, "rgba(160,150,200,0)"); g.fillStyle = gr; g.beginPath(); g.arc(c0[0], c0[1], R, 0, TAU); g.fill();
      if (!nebOpen()) { g.save(); g.textAlign = "center"; g.fillStyle = "rgba(220,210,255,.8)"; g.font = `400 ${Math.max(13, 34 * st.z)}px Kavoon, Georgia, serif`; g.fillText("? ? ?", c0[0], c0[1]); g.font = `800 ${Math.max(11, 20 * st.z)}px Nunito, system-ui, sans-serif`; g.fillText(`Nébuleuse cachée · ${fmt(E.MT_OPEN)} points`, c0[0], c0[1] + Math.max(18, 40 * st.z)); g.restore(); } }
    /* symbole allumé */
    if (Tr.coreIds.every((id) => got.has(id))) { const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const [x, y] = toS(N[Tr.start]); const s = 330 * st.z; g.save(); g.globalAlpha = 0.34; g.shadowColor = cc; g.shadowBlur = 50; g.drawImage(im, x - s / 2, y - s / 2, s, s); g.restore(); } }
    /* liens */
    for (const [a, b] of Tr.ED) {
      if ((N[a].neb || N[b].neb) && !nebOpen()) continue;
      const A = toS(N[a]), B = toS(N[b]); if ((A[0] < -60 && B[0] < -60) || (A[0] > W + 60 && B[0] > W + 60) || (A[1] < -60 && B[1] < -60) || (A[1] > H + 60 && B[1] > H + 60)) continue;
      const on = got.has(a) && got.has(b), pp = (ps.has(a) || got.has(a)) && (ps.has(b) || got.has(b)) && (ps.has(a) || ps.has(b));
      const core = ["cls", "start", "cks"].includes(N[a].t) && ["cls", "start", "cks"].includes(N[b].t);
      g.strokeStyle = on ? "rgba(226,245,255,.95)" : pp ? "rgba(240,195,90,.9)" : core ? cc + "88" : "rgba(170,180,255,.16)"; g.lineWidth = Math.max(1, (on ? 2.6 : core ? 2 : 1.4) * st.z);
      if (on) { g.shadowColor = "#bfe2ff"; g.shadowBlur = 8; } g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); g.shadowBlur = 0;
    }
    /* domaines */
    if (st.z > 0.1) { g.save(); g.font = `400 ${Math.max(14, 30 * st.z)}px Kavoon, Georgia, serif`; g.textAlign = "center";
      DOM.forEach((D0, d) => { const R = 1680; const x = W / 2 + (Math.sin(Tr.domTh[d]) * R + st.ox) * st.z, y = H / 2 + (-Math.cos(Tr.domTh[d]) * R + st.oy) * st.z; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.7)"; g.strokeText(D0.n, x, y); g.fillStyle = D0.c; g.fillText(D0.n, x, y); }); g.restore(); }
    /* étoiles */
    const M = st.view ? { j: {} } : E.mt(hero());
    for (const n of N) {
      if (n.neb && !nebOpen()) continue;
      const [x, y] = toS(n); if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      const r = rad(n), on = got.has(n.id), pp = ps.has(n.id), dc = domCol(n);
      if (n.t === "start") { g.shadowColor = cc; g.shadowBlur = 26; g.fillStyle = cc; g.strokeStyle = "#e2f5ae"; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.shadowBlur = 0;
        const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const s = r * 1.7; g.drawImage(im, x - s / 2, y - s / 2, s, s); } continue; }
      if (!on && !pp && n.t === "s" && !HIT.has(n.id) && n.id !== st.sel) { g.fillStyle = "rgba(200,210,255,.75)"; g.beginPath(); g.arc(x, y, r * 0.42, 0, TAU); g.fill(); continue; }
      if (on) { g.shadowColor = n.t === "ks" ? "#ff9f5a" : n.t === "cks" || n.t === "cls" ? cc : "#cfe8ff"; g.shadowBlur = n.t === "s" ? 8 : 16; }
      if (n.t === "ks" || n.t === "cks") { g.beginPath(); for (let q = 0; q < 16; q++) { const a = q * Math.PI / 8 - Math.PI / 2; const rr = q % 2 ? r * 0.62 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath();
        g.fillStyle = on ? (n.t === "cks" ? cc : "#ff9f5a") : pp ? "rgba(255,159,90,.6)" : "#1d1530"; g.fill(); g.lineWidth = 3; g.strokeStyle = n.t === "cks" ? "#e2f5ae" : dc; g.stroke();
        if (n.t === "cks") { const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const s = r * 0.95; g.drawImage(im, x - s / 2, y - s / 2, s, s); } } }
      else if (n.t === "joy") { const J = M.j[n.id] && (S().joy || []).find((z) => z.uid === M.j[n.id]); const jc = J ? JOY[J.k].c : "#7fffd4";
        g.beginPath(); g.moveTo(x, y - r * 1.15); g.lineTo(x + r * 1.15, y); g.lineTo(x, y + r * 1.15); g.lineTo(x - r * 1.15, y); g.closePath(); g.fillStyle = J ? jc : on ? "#7fffd4" : pp ? "rgba(127,255,212,.5)" : "#14302a"; g.fill(); g.lineWidth = 2; g.strokeStyle = J ? "#fff" : "#7fffd4"; g.stroke(); }
      else if (n.t === "nt") { g.beginPath(); for (let q = 0; q < 6; q++) { const a = q * TAU / 6 + TAU / 12; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fillStyle = on ? "#f0c35a" : pp ? "rgba(240,195,90,.55)" : "#221c38"; g.fill(); g.lineWidth = 3; g.strokeStyle = on ? "#fff3c4" : "#c99a3a"; g.stroke(); }
      else { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = on ? dc : pp ? "rgba(240,195,90,.55)" : "#221c38"; g.fill(); g.lineWidth = n.t === "cls" ? 2.5 : 1.8; g.strokeStyle = n.t === "cls" ? "#e2f5ae" : dc; g.stroke(); }
      g.shadowBlur = 0;
      if (n.ic && r > 6) { const im = img("s_" + n.ic, `assets/c/${n.ic}.png`); if (im.naturalWidth) { const s = r * (n.t === "nt" ? 1.25 : 1.3); g.globalAlpha = on ? 1 : 0.7; g.drawImage(im, x - s / 2, y - s / 2, s, s); g.globalAlpha = 1; } }
      else if (n.t === "cls" && r > 6) { const im = img("c_" + Tr.cls, sym(Tr.cls)); if (im.naturalWidth) { const s = r * 1.4; g.globalAlpha = on ? 1 : 0.55; g.drawImage(im, x - s / 2, y - s / 2, s, s); g.globalAlpha = 1; } }
      if (HIT.has(n.id)) ring(x, y, r + 6); if (n.id === st.sel) ring(x, y, r + 4, "#fff");
      if (((n.t === "ks" || n.t === "cks") && st.z > 0.3) || (n.t === "nt" && st.z > 0.85)) { g.font = `800 ${n.t === "nt" ? 11.5 : 13}px Nunito, system-ui, sans-serif`; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(n.n, x, y - r - 7); g.fillStyle = n.t === "cks" ? "#e2f5ae" : n.t === "ks" ? "#ffd2b0" : "#f6e3b0"; g.fillText(n.n, x, y - r - 7); }
    }
    if (path.length) { const [x, y] = toS(N[st.hov]); const left = pts() - used(); const t = `${path.length} point${path.length > 1 ? "s" : ""}${path.length > left ? " · à planifier" : ""}`; g.font = "800 12px Nunito, system-ui, sans-serif"; g.textAlign = "left"; g.fillStyle = "rgba(13,16,11,.88)"; g.fillRect(x + 14, y + 6, g.measureText(t).width + 12, 20); g.fillStyle = path.length <= left ? "#e2f5ae" : "#ffb07a"; g.fillText(t, x + 20, y + 20); }
  }
  function ring(x, y, r, col = "#7fffd4") { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  const center = () => { st.z = Math.min(W, H) / 760; st.ox = 0; st.oy = 0; draw(); };
  const fitAll = () => { const N = T().N.filter((n) => !(n.neb && !nebOpen())); let a = 1e9, b = -1e9, c2 = 1e9, d = -1e9; N.forEach((n) => { a = Math.min(a, n.X); b = Math.max(b, n.X); c2 = Math.min(c2, n.Y); d = Math.max(d, n.Y); }); st.z = Math.min(W / (b - a + 160), H / (d - c2 + 160)); st.ox = -(a + b) / 2; st.oy = -(c2 + d) / 2; draw(); };
  const pick = (mx, my) => { let best = null, bd = 1e9; for (const n of T().N) { if (n.neb && !nebOpen()) continue; const [x, y] = toS(n); const dd = Math.hypot(x - mx, y - my); if (dd < rad(n) + 7 && dd < bd) { bd = dd; best = n.id; } } return best; };
  function mount() {
    const box = document.getElementById("mtCv"); if (!box) return; cv = box.querySelector("canvas"); g = cv.getContext("2d");
    const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; H = box.clientHeight; cv.width = W * dpr; cv.height = H * dpr; if (!st.z) center(); else draw(); };
    new ResizeObserver(resize).observe(box); resize();
    const ptrs = new Map(); let drag = null, moved = 0, pinch = null;
    box.addEventListener("pointerdown", (e) => { if (e.target.closest(".mt-zoom")) return; box.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]); moved = 0; drag = [e.offsetX, e.offsetY, st.ox, st.oy]; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = [Math.hypot(a[0] - b[0], a[1] - b[1]), st.z]; } });
    box.addEventListener("pointermove", (e) => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; st.z = Math.max(0.12, Math.min(3, pinch[1] * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch[0])); moved = 99; draw(); return; }
      if (drag && ptrs.size === 1) { const dx = e.offsetX - drag[0], dy = e.offsetY - drag[1]; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); if (moved > 4) { st.ox = drag[2] + dx / st.z; st.oy = drag[3] + dy / st.z; draw(); } return; }
      if (e.pointerType === "mouse") { const hv = pick(e.offsetX, e.offsetY); if (hv !== st.hov) { st.hov = hv; draw(); } } });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (drag && moved <= 4 && e.type === "pointerup" && !e.target.closest(".mt-zoom")) { const id = pick(e.offsetX, e.offsetY); if (id != null) clickNode(id); } if (!ptrs.size) drag = null; };
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    box.addEventListener("wheel", (e) => { e.preventDefault(); const nz = Math.max(0.12, Math.min(3, st.z * Math.exp(-e.deltaY * 0.0015))); const mx = (e.offsetX - W / 2) / st.z - st.ox, my = (e.offsetY - H / 2) / st.z - st.oy; st.z = nz; st.ox = (e.offsetX - W / 2) / st.z - mx; st.oy = (e.offsetY - H / 2) / st.z - my; draw(); }, { passive: false });
  }
  function clickNode(id) {
    const n = T().N[id]; st.sel = id; st.hov = id;
    if (canEdit() && allowed(id)) { const before = [...got];
      if (got.has(id)) { if (connectedWithout(id)) got.delete(id); } else { const p = pathTo(id); if (p) p.slice(0, Math.max(0, pts() - used())).forEach((x) => got.add(x)); }
      if (got.size !== before.length) { st.hist.push(before); if (st.hist.length > E.MT_UNDO) st.hist.shift(); save(); } }
    side(); draw();
  }

  /* ---------- panneaux ---------- */
  const TYP = { s: "Petite étoile", nt: "Notable", ks: "Clé de voûte", cks: "Clé de voûte de classe", start: "Cœur de classe", cls: "Cœur de classe", joy: "Emplacement de joyau" };
  function infoHtml() {
    if (st.sel == null) return `<span class="mt-ty muted">Étoile</span><b>Touche une étoile</b><span class="muted xs">Son effet s'affiche ici. Un clic sur une étoile lointaine prend le chemin le plus court.</span>`;
    const n = T().N[st.sel]; const p = got.has(n.id) ? null : pathTo(n.id); const left = pts() - used();
    const who = st.view ? "Arbre d'une autre classe : lecture seule." : !E.mtOn(hero()) ? "La Maîtrise s'ouvre au niveau 200." : got.has(n.id) ? "Prise." : p ? (p.length <= left ? `Coûte ${p.length} point${p.length > 1 ? "s" : ""} avec le chemin.` : `Chemin de ${p.length} points, planifié : il se prendra tout seul aux prochains niveaux.`) : n.t === "start" ? "" : n.neb ? `S'ouvre à ${fmt(E.MT_OPEN)} points.` : "Pas atteignable.";
    let joy = "";
    if (n.t === "joy" && got.has(n.id) && !st.view) { const M = E.mt(hero()); const cur = M.j[n.id]; const J = cur && (S().joy || []).find((z) => z.uid === cur);
      const free = (S().joy || []).filter((z) => !Object.values(M.j).includes(z.uid));
      joy = `<div class="mt-joyset">${J ? `<span class="mt-jw" style="--jc:${JOY[J.k].c}">◆ ${h(JOY[J.k].n)} · +${JOY[J.k].b[1]} ${h(JOY[J.k].b[0])}</span><button class="btn xs" data-act="mt-unsock">Retirer</button>` : free.length ? `<span class="xs muted">Sertir :</span>${free.slice(0, 6).map((z) => `<button class="btn xs mt-jw" style="--jc:${JOY[z.k].c}" data-act="mt-sock" data-v="${z.uid}">◆ ${h(JOY[z.k].n)}</button>`).join("")}` : `<span class="xs muted">Aucun joyau libre : ils tombent sur les boss en stasis 10 et plus.</span>`}</div>`; }
    return `<span class="mt-ty" style="color:${domCol(n)}">${TYP[n.t]}${["start", "cls", "cks"].includes(n.t) ? " · " + h(CLASSES[treeCls()].name) : n.neb ? " · Nébuleuse" : " · " + DOM[n.d].n}</span><b>${h(n.n)}</b><span class="small">${h(n.txt)}</span><span class="muted xs">${h(who)}</span>${joy}`;
  }
  function totHtml(set) {
    const c = hero(); const R = st.view ? (() => { const t = {}; const ks = []; set.forEach((id) => { const n = T().N[id]; if (n.t === "ks" || n.t === "cks") ks.push(n); (n.b || []).forEach(([s, v]) => (t[s] = (t[s] || 0) + v)); }); return { t, ks, sym: false }; })() : E.mtStats(S(), c, set);
    const rows = Object.entries(R.t).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<div><span>${h(s)}</span><b class="num">+${fmt(v)}</b></div>`).join("");
    return (R.sym ? `<div class="mt-cl"><span>✦ Symbole ${h(CLASSES[treeCls()].name)} allumé</span><b>+5 %</b></div>` : "") + R.ks.map((k) => `<div class="${k.t === "cks" ? "mt-cl" : "mt-kl"}"><span>✦ ${h(k.n)}</span></div>`).join("") + (rows || `<span class="muted xs">Aucun point placé.</span>`);
  }
  function cmpHtml() {
    if (st.cmp == null) return ""; const c = hero(); const A = E.mtStats(S(), c, got), B = E.mtStats(S(), c, E.mtGot(c, st.cmp));
    const keys = [...new Set([...Object.keys(A.t), ...Object.keys(B.t)])]; const rows = keys.map((k) => [k, (B.t[k] || 0) - (A.t[k] || 0)]).filter(([, d]) => d).sort((a, b) => b[1] - a[1]);
    const an = new Set(A.ks.map((k) => k.n)), bn = new Set(B.ks.map((k) => k.n)); const kin = [...bn].filter((k) => !an.has(k)), kout = [...an].filter((k) => !bn.has(k));
    return `<div class="mt-cmp"><b>Passer à « ${LO[st.cmp]} »</b>${kin.map((k) => `<div class="up"><span>✦ ${h(k)}</span><b>gagnée</b></div>`).join("")}${kout.map((k) => `<div class="dn"><span>✦ ${h(k)}</span><b>perdue</b></div>`).join("")}${rows.map(([k, d]) => `<div class="${d > 0 ? "up" : "dn"}"><span>${h(k)}</span><b class="num">${d > 0 ? "+" : ""}${fmt(d)}</b></div>`).join("") || (kin.length || kout.length ? "" : `<span class="muted xs">Aucune différence.</span>`)}<div class="mt-row"><button class="btn sm primary" data-act="mt-cgo">Changer</button><button class="btn sm" data-act="mt-cno">Garder</button></div></div>`;
  }
  const LO = ["Donjons", "Ascension", "Chasse"];
  function sideHtml() {
    const c = hero(); const M = E.mt(c); const lv = pts(), left = lv - used(), on = E.mtOn(c);
    const respec = Math.max(0, used() - E.MT_FREE) * E.MT_RESPEC;
    const lvCard = st.view ? `<div class="mt-card"><h3>Ciel ${h(CLASSES[st.view].name)}</h3><p class="xs muted">Tu regardes l'arbre d'une autre classe, sans y placer de points. Tes héros ${h(CLASSES[st.view].name)} l'ouvriront au niveau 200.</p><button class="btn sm" data-act="mt-view" data-v="">Revenir à ${h(c.name)}</button></div>`
      : `<div class="mt-card"><h3>Maîtrise de ${h(c.name)}</h3>${on ? `<div class="mt-pts"><b class="num">${fmt(lv)}</b><span class="muted">points · <b class="num">${fmt(left)}</b> à placer</span></div><div class="bar xp"><i style="width:${pctf(M.xp, E.mtNeed(c))}%"></i></div><span class="xs muted num">${fmt(M.xp)} / ${fmt(E.mtNeed(c))} XP vers le niveau ${fmt(lv + 1)}</span>` : `<p class="small">La Maîtrise s'ouvre au <b>niveau 200</b>. ${h(c.name)} est niveau ${c.lvl}${M.lvl ? ` ; ses ${fmt(M.lvl)} points l'attendent (gardés à la Renaissance)` : ""}.</p>`}
        ${on ? `<div class="mt-row"><button class="btn sm" data-act="mt-undo" ${st.hist.length ? "" : "disabled"}>Annuler${st.hist.length ? ` (${st.hist.length})` : ""}</button><button class="btn sm" data-act="mt-reset" ${used() ? "" : "disabled"}>Tout rendre${used() ? respec ? ` · ${fmt(respec)} kamas` : " · gratuit" : ""}</button><button class="btn sm" data-act="mt-share">Partager</button></div>
        <span class="xs muted">Annuler revient sur les ${E.MT_UNDO} derniers points. Tout rendre est gratuit jusqu'à ${E.MT_FREE} points placés.</span>` : ""}
        ${st.share && on ? `<div class="mt-share"><code>${h(E.mtCode(c))}</code><div class="mt-row"><button class="btn xs" data-act="mt-copy">Copier</button><input id="mtImp" placeholder="Coller le code d'un ami" aria-label="Code d'un arbre"><button class="btn xs" data-act="mt-imp">Charger</button></div></div>` : ""}</div>
      <div class="mt-card"><h3>Arbres enregistrés</h3><div class="seg">${LO.map((n, i) => `<button data-act="mt-lo" data-v="${i}" aria-pressed="${M.lo === i}">${n}</button>`).join("")}</div>${cmpHtml()}</div>`;
    const joys = (S().joy || []); const setJ = new Set(Object.values(M.j));
    return `${lvCard}
      <div class="mt-card"><h3>Chercher</h3><input id="mtQ" type="search" value="${h(st.q)}" placeholder="Critique, Phénix, joyau…" aria-label="Chercher une étoile"><span class="xs muted">${st.q.trim().length >= 2 ? `${hits().size} étoile${hits().size > 1 ? "s" : ""} allumée${hits().size > 1 ? "s" : ""}` : ""}</span></div>
      <div class="mt-card mt-info">${infoHtml()}</div>
      <div class="mt-card"><h3>Total des bonus</h3><div class="mt-tot">${totHtml(got)}</div></div>
      ${st.view ? "" : `<div class="mt-card"><h3>Joyaux <span class="xs muted">${joys.length}</span></h3>${joys.length ? `<div class="mt-joys">${joys.map((z) => `<span class="mt-jw ${setJ.has(z.uid) ? "on" : ""}" style="--jc:${JOY[z.k].c}" title="${h(JOY[z.k].n)} : +${JOY[z.k].b[1]} ${h(JOY[z.k].b[0])}">◆ ${h(JOY[z.k].n)}</span>`).join("")}</div><span class="xs muted">Touche un emplacement ◆ pris dans l'arbre pour sertir.</span>` : `<span class="xs muted">Les joyaux tombent sur les boss en stasis 10 et plus.</span>`}</div>`}
      <div class="mt-card"><h3>Maîtrise du compte</h3><div class="mt-tot">${S().chars.filter((x) => x.mt && x.mt.lvl).sort((a, b) => b.mt.lvl - a.mt.lvl).map((x) => `<div><span>${h(x.name)} <span class="xs muted">${h(CLASSES[x.cls].name)}</span></span><b class="num">${fmt(x.mt.lvl)}</b></div>`).join("")}<div class="mt-sum"><span>Total : ${fmt(E.mtAcct(S()))} points</span><b>+${E.mtAcctPct(S())} % d'XP</b></div></div><span class="xs muted">Chaque tranche de 100 points, tous héros confondus, donne +1 % d'XP au compte.</span></div>`;
  }
  function side() { const el = document.getElementById("mtSide"); if (el) el.innerHTML = sideHtml(); }

  function treeHtml() {
    const s = S(); const c = hero(); const Tc = treeCls(); const C = CLASSES[Tc]; const f = FORT[Tc] || [0, 1];
    const heroes = s.chars.slice().sort((a, b) => b.lvl - a.lvl || ((b.mt && b.mt.lvl) || 0) - ((a.mt && a.mt.lvl) || 0));
    return `<div class="mt-heroes" role="group" aria-label="Héros">${heroes.map((x) => `<button class="mt-hb ${E.mtOn(x) ? "" : "off"}" data-act="mt-hero" data-v="${x.id}" aria-pressed="${!st.view && x.id === c.id}" style="--cc:${CLASSES[x.cls].color}"><img src="${sym(x.cls)}" alt=""><span><b>${h(x.name)}</b><span class="xs">${E.mtOn(x) ? `Maîtrise ${fmt(E.mt(x).lvl)}` : `niv. ${x.lvl}`}</span></span></button>`).join("")}</div>
      <div class="mt-head" style="--cc:${C.color}"><img src="${sym(Tc)}" alt=""><div><h2>Ciel ${h(C.name)}</h2><div class="mt-chips">${f.map((d) => `<span class="mt-chip" style="color:${DOM[d].c}">${DOM[d].n}</span>`).join("")}<span class="mt-chip">Passif : ${h(build(Tc).pas)}</span><span class="mt-chip num">${fmt(build(Tc).N.length)} étoiles</span></div></div>
        <details class="mt-other" ${st.view ? "open" : ""}><summary>Voir une autre classe</summary><div class="mt-cls">${CLS_IDX().map((k) => `<button data-act="mt-view" data-v="${k}" aria-pressed="${Tc === k}" title="${h(CLASSES[k].name)}" aria-label="Ciel ${h(CLASSES[k].name)}"><img src="${sym(k)}" alt=""></button>`).join("")}</div></details></div>
      <div class="mt-grid"><div class="mt-cv" id="mtCv" style="--cc:${C.color}"><div class="mt-bg">${STARS}</div><canvas></canvas><span class="mt-hint">${st.view ? "Lecture seule" : E.mtOn(c) ? "Touche une étoile pour la prendre" : "La Maîtrise s'ouvre au niveau 200"}</span><div class="mt-zoom"><button class="btn sm" data-act="mt-z" data-v="in" aria-label="Zoomer">+</button><button class="btn sm" data-act="mt-z" data-v="out" aria-label="Dézoomer">−</button><button class="btn sm" data-act="mt-z" data-v="c">Centrer</button><button class="btn sm" data-act="mt-z" data-v="all">Tout voir</button></div></div>
      <aside class="mt-side" id="mtSide">${sideHtml()}</aside></div>`;
  }
  const STARS = (() => { let sd = 7; const r = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; }; let o = ""; for (let i = 0; i < 110; i++) o += `<i style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 100).toFixed(1)}%;animation-duration:${(2 + r() * 4).toFixed(1)}s;animation-delay:-${(r() * 6).toFixed(1)}s"></i>`; return o + "<b></b><b></b><b></b>"; })();

  /* ---------- Bestiaire ---------- */
  function bestHtml() {
    const s = S(); const R = Object.keys(E.RACE_MONS).filter((r) => (E.RACE_MONS[r] || []).some((k) => MONSTERS[k] && !MONSTERS[k].archiOf));
    const day = E.btDay(s); const rank = E.btRank(s), max = R.length * 20;
    const pic = (r) => { const k = (E.RACE_MONS[r] || []).find((x) => MONSTERS[x] && MONSTERS[x].img && !MONSTERS[x].archiOf); return k ? `<img src="assets/m/${MONSTERS[k].img}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ""; };
    const row = (r) => { const n = E.btKills(s, r), t = E.btTier(s, r); const nx = E.BT[t], pv = t ? E.BT[t - 1] : 0;
      return `<div class="bt-row ${t >= 20 ? "max" : ""} ${r === day ? "day" : ""}"><span class="bt-pic">${pic(r)}</span><div class="bt-mid"><div class="bt-top"><b>${h(D.RACES[r] || r)}</b><span class="bt-tier num">${t}/20</span></div><div class="bar"><i style="width:${t >= 20 ? 100 : pctf(n - pv, nx - pv)}%"></i></div>
        <div class="bt-sub"><span class="xs muted num">${fmt(n)}${t < 20 ? ` / ${fmt(nx)}` : ""} victoires</span><span class="xs">+${(t * 0.5).toLocaleString("fr-FR")} % contre la famille</span></div>
        <div class="bt-rew">${[5, 10, 15, 20].map((p) => `<span class="${t >= p ? "on" : ""}" title="${h(E.BT_REW[p])}">${p}</span>`).join("")}</div></div></div>`; };
    let L = R.slice(); if (st.fam === "near") L = L.filter((r) => { const t = E.btTier(s, r); return t < 20 && [5, 10, 15, 20].some((p) => p > t && p - t <= 2); }); if (st.fam === "done") L = L.filter((r) => E.btTier(s, r) >= 5);
    L.sort((a, b) => E.btTier(s, b) - E.btTier(s, a) || E.btKills(s, b) - E.btKills(s, a));
    return `<div class="bt-head"><div class="mt-card"><h3>Rang de Chasseur</h3><div class="mt-pts"><b class="num">${fmt(rank)}</b><span class="muted">paliers sur ${fmt(max)}</span></div><div class="bar xp"><i style="width:${pctf(rank, max)}%"></i></div><span class="xs muted">20 paliers par famille, de 10 à 100 000 victoires. Chaque palier : +0,5 % de dégâts contre la famille.</span></div>
      ${day ? `<div class="mt-card bt-daycard"><h3>Famille du jour</h3><div class="bt-dayin"><span class="bt-pic">${pic(day)}</span><div><b>${h(D.RACES[day] || day)}</b><span class="xs">Les victoires comptent double aujourd'hui.</span></div></div></div>` : ""}
      <div class="mt-card"><h3>Récompenses</h3>${[5, 10, 15, 20].map((p) => `<div class="mt-tot"><div><span><b class="num">Palier ${p}</b></span><span class="xs">${h(E.BT_REW[p])}</span></div></div>`).join("")}</div></div>
      <div class="mt-row"><span class="seg">${[["all", "Toutes"], ["near", "Récompense proche"], ["done", "Palier 5 et plus"]].map(([v, n]) => `<button data-act="mt-fam" data-v="${v}" aria-pressed="${st.fam === v}">${n}</button>`).join("")}</span><span class="xs muted">${L.length} famille${L.length > 1 ? "s" : ""}</span></div>
      <div class="bt-grid">${L.map(row).join("") || `<div class="empty">Aucune famille ici pour l'instant.</div>`}</div>`;
  }
  function rankHtml() {
    const s = S(); const L = s.chars.filter((c) => c.mt && c.mt.lvl).sort((a, b) => b.mt.lvl - a.mt.lvl);
    return `<p class="note">Le classement de la Maîtrise montrera tous les joueurs du serveur : le héros le plus maîtrisé de chaque classe, et le total du compte. Aperçu avec tes héros :</p>
      <div class="mt-rank">${L.map((c, i) => `<div class="mt-rk" style="--cc:${CLASSES[c.cls].color}"><b class="num">${i + 1}</b><img src="${sym(c.cls)}" alt=""><span class="grow"><b>${h(c.name)}</b> <span class="xs muted">${h(CLASSES[c.cls].name)}</span></span><span class="num">Maîtrise <b>${fmt(c.mt.lvl)}</b></span>${E.mtStats(s, c).ks.slice(0, 2).map((k) => `<span class="mt-chip">✦ ${h(k.n)}</span>`).join("")}</div>`).join("") || `<div class="empty">Aucun héros n'a encore de Maîtrise.</div>`}</div>
      <div class="mt-sum mt-card"><span>Maîtrise du compte : <b class="num">${fmt(E.mtAcct(s))}</b> points</span><b>+${E.mtAcctPct(s)} % d'XP</b></div>`;
  }

  function page(main) {
    const c = hero(); if (!c) { main.innerHTML = `<div class="empty">Recrute un héros d'abord.</div>`; return; }
    const key = `${st.cid}:${st.view}:${E.mt(c).lo}`; if (key !== st.key) { st.key = key; loadGot(); st.sel = null; st.hov = null; st.cmp = null; }
    main.innerHTML = `<section class="panel mt-page"><div class="phead"><h2>${IC("cristal")} Maîtrise</h2><span class="seg">${[["arbre", "Arbre"], ["best", "Bestiaire"], ["rank", "Classement"]].map(([v, n]) => `<button data-act="mt-tab" data-v="${v}" aria-pressed="${st.tab === v}">${n}</button>`).join("")}</span></div>
      ${st.tab === "best" ? bestHtml() : st.tab === "rank" ? rankHtml() : treeHtml()}</section>`;
    if (st.tab === "arbre") mount();
  }
  window.DX.pages.maitrise = page;

  function act(a, t) {
    const d = t.dataset; const c = hero(); const rer = () => window.DX.render();
    switch (a) {
      case "mt-tab": st.tab = d.v; rer(); return;
      case "mt-hero": st.cid = +d.v; st.view = null; st.hist = []; st.z = 0; rer(); return;
      case "mt-view": st.view = d.v && d.v !== hero().cls ? d.v : null; st.hist = []; st.z = 0; rer(); return;
      case "mt-z": if (d.v === "in") st.z = Math.min(3, st.z * 1.35); else if (d.v === "out") st.z = Math.max(0.12, st.z / 1.35); else if (d.v === "c") return center(); else return fitAll(); draw(); return;
      case "mt-undo": if (st.hist.length) { got = new Set(st.hist.pop()); save(); side(); draw(); } return;
      case "mt-reset": { const cost = Math.max(0, used() - E.MT_FREE) * E.MT_RESPEC; if (cost > S().kamas) { X().toast("Pas assez de kamas pour tout rendre.", "info"); return; } S().kamas -= cost; st.hist.push([...got]); got = new Set([T().start]); save(); side(); draw(); return; }
      case "mt-share": st.share = !st.share; side(); return;
      case "mt-copy": { const code = E.mtCode(c); try { navigator.clipboard.writeText(code).then(() => X().toast("Code de l'arbre copié.", "info"), () => {}); } catch (e) {} return; }
      case "mt-imp": { const v = document.getElementById("mtImp"); const R = v && E.mtRead(v.value); if (!R || R.cls !== c.cls) { X().toast(R ? "Ce code est pour une autre classe." : "Code illisible.", "info"); return; }
        const ids = R.ids.filter((id) => id !== T().start && T().N[id]); if (ids.length > pts()) { X().toast(`Cet arbre demande ${ids.length} points.`, "info"); return; } st.hist.push([...got]); got = new Set([T().start, ...ids]); save(); side(); draw(); return; }
      case "mt-lo": { const l = +d.v; if (l === E.mt(c).lo) return; st.cmp = l; side(); return; }
      case "mt-cno": st.cmp = null; side(); return;
      case "mt-cgo": E.mt(c).lo = st.cmp; st.cmp = null; st.hist = []; rer(); return;
      case "mt-sock": { if (st.sel == null) return; E.mt(c).j[st.sel] = +d.v; side(); draw(); return; }
      case "mt-unsock": { if (st.sel == null) return; delete E.mt(c).j[st.sel]; side(); draw(); return; }
      case "mt-fam": st.fam = d.v; rer(); return;
      case "mt-open": st.cid = +d.v; st.view = null; st.tab = "arbre"; window.DX.ui.tab = "maitrise"; rer(); window.scrollTo(0, 0); return;
    }
  }
  document.addEventListener("input", (ev) => { if (ev.target && ev.target.id === "mtQ") { st.q = ev.target.value; draw(); const sp = ev.target.nextElementSibling; if (sp) { const n = hits().size; sp.textContent = st.q.trim().length >= 2 ? `${n} étoile${n > 1 ? "s" : ""} allumée${n > 1 ? "s" : ""}` : ""; } } });

  /* fiche du héros : une ligne Maîtrise ; Scène : aura des clés de voûte */
  const heroLine = (c) => { if (!c || !E.mtOn(c)) return ""; const M = E.mt(c); return `<div class="mt-line"><span class="small">${IC("cristal")} Maîtrise <b class="num">${fmt(M.lvl)}</b></span><div class="bar xp"><i style="width:${pctf(M.xp, E.mtNeed(c))}%"></i></div><button class="btn xs" data-act="mt-open" data-v="${c.id}">Ouvrir l'arbre</button></div>`; };
  const auraHtml = (c) => { if (!c || !c.id || !E.mtOn(c) || !c.mt) return ""; const R = E.mtStats(S(), c); if (!R.ks.length) return ""; const k = R.ks[0]; const col = k.t === "cks" ? CLASSES[c.cls].color : DOM[k.d].c; return `<i class="mt-aura" style="--mt:${col}" title="${h(k.n)}"></i>`; };
  window.MAITUI = { act, heroLine, auraHtml, st, center, fitAll, clickNode, draw, get got() { return got; }, set got(v) { got = v; }, T, side, save };
})();
