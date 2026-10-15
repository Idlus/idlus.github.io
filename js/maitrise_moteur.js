/* ============================================================================
   IDLUS 2.0 — LA MAÎTRISE : le moteur (sans affichage, chargé aussi par le serveur et les tests)
   - au niveau 200, l'XP remplit des niveaux de Maîtrise sans fin (E.giveXp, js/engine.js) : 1 point par niveau,
     coût constant (l'XP du niveau 199 → 200) ; la Renaissance n'existe plus : ses vies passées sont converties
     (2 % de leur XP en niveaux, 2 points par Éveil et par sort appris ; migration E.VERSION 11)
   - un ciel (arbre en constellation) par classe : ~1 500 étoiles, cœur de classe (passif), 3 clés de voûte de classe,
     6 domaines (les deux éléments forts de la classe en haut), joyaux, Nébuleuse cachée à 1 000 points
   - E.mtFx : ce que l'arbre donne en combat (caractéristiques, % de dégâts, PV, résistances, clés de voûte)
   - Maîtrise du Bestiaire : 20 paliers par famille, +0,5 % de dégâts contre la famille par palier,
     ornement (5), +2 % de butin (10), titre (15), aura (20) ; la famille du jour compte double
   L'affichage est dans js/maitrise.js (page Héros › Maîtrise).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const { CLASSES } = D;
  const TAU = Math.PI * 2;
  const FORT = { iop: [0, 1], sacri: [0, 4], forge: [0, 3], ougi: [0, 2], roub: [1, 0], hupper: [1, 2], eni: [1, 5], enu: [2, 0], steam: [2, 1], osa: [2, 0], cra: [3, 1], sram: [3, 0], eca: [2, 3], panda: [0, 4], feca: [1, 4], sadi: [0, 2], xelor: [1, 5], elio: [1, 2], zobal: [3, 4] };
  /* trois clés de voûte propres à chaque classe */
  const KSC = { // 2.0 : effets réels en combat (fx, texte construit par E.mtFxTxt)
    iop: [["Colère de Iop", { d: 18, hp: -10 }], ["Épée céleste", { cx: 40, pm: -1 }], ["Vertu", { sh: 15, d: -8 }]],
    sacri: [["Punition", { low: 30, h: -20 }], ["Transposition", { hp: 15, res: 8, d: -10 }], ["Sacrifice", { h: 30, d: -8 }]],
    forge: [["Fer de lance", { t1: 40, d: -5 }], ["Forge ardente", { cx: 35, cri: -3 }], ["Hampe brisée", { d: 15, cri: -8 }]],
    ougi: [["Rage d'Ouginak", { low: 30, res: -10 }], ["Proie", { d: 15, hp: -8 }], ["Molosse", { pass: 30, hp: -10 }]],
    roub: [["Explobombe", { d: 18, t1: -30 }], ["Mur de bombes", { res: 10, d: -5 }], ["Roublabot", { pass: 30, d: -8 }]],
    hupper: [["Polarité", { d: 15, cri: -5 }], ["Rune élémentaire", { pass: 35, hp: -8 }], ["Cristal", { cx: 30, d: -5 }]],
    eni: [["Mot de Régénération", { h: 30, d: -10 }], ["Mot Stimulant", { h: 20, ini: 400, hp: -5 }], ["Mot Interdit", { d: 15, h: -15 }]],
    enu: [["Pelle Fantomatique", { pp: 100, d: -8 }], ["Coffre animé", { sh: 12, res: 5, d: -8 }], ["Fortune", { pp: 150, hp: -10 }]],
    steam: [["Tourelle Harponneuse", { pass: 35, hp: -8 }], ["Scaphandre", { sh: 20, d: -8 }], ["Marée", { h: 20, e: 10, hp: -8 }]],
    osa: [["Dragonnet", { pass: 35, hp: -12 }], ["Fouet", { pass: 20, ini: 600, d: -5 }], ["Crapaud", { h: 25, res: 5, d: -10 }]],
    cra: [["Flèche Punitive", { t1: 30, d: 5, hp: -8 }], ["Œil de Taupe", { d: 15, hp: -10 }], ["Tir Éloigné", { pass: 30, res: -8 }]],
    sram: [["Piège Mortel", { pass: 35, cri: -5 }], ["Invisibilité", { t1: 40, hp: -10 }], ["Double", { cx: 40, d: -5 }]],
    eca: [["Tout ou Rien", { cx: 60, d: -15 }], ["Roue de la Fortune", { pass: 30, res: -5 }], ["Bluff", { cri: 10, res: -10 }]],
    panda: [["Karcham", { res: 12, pm: -1 }], ["Ivresse", { pass: 35, res: -8 }], ["Lait de Bambou", { h: 25, hp: 10, d: -12 }]],
    feca: [["Glyphe Agressif", { d: 12, h: -10 }], ["Trêve", { sh: 25, d: -10 }], ["Bouclier Féca", { h: 30, d: -12 }]],
    sadi: [["La Folle", { pass: 35, hp: -10 }], ["Arbre de vie", { rev: 20, d: -8 }], ["Ronces", { pass: 25, d: -5 }]],
    xelor: [["Momification", { pass: 30, d: -10 }], ["Distorsion", { ini: 1500, d: 10, hp: -20 }], ["Sablier", { pass: 25, ini: 500, d: -8 }]],
    elio: [["Portail", { pass: 35, hp: -8 }], ["Convergence", { d: 20, pm: -1 }], ["Audace", { low: 20, t1: 20, res: -8 }]],
    zobal: [["Masque du Classique", { d: 10, res: 8, hp: -8 }], ["Plastron", { sh: 15, d: -6 }], ["Furie", { d: 18, res: -10 }]],
  };
  const DOM = [
    { n: "Terre", c: "#d39a5c", st: [["Force", 2, "fo"], ["% dégâts Terre", 0.5, "fo"], ["Puissance", 1, "pui"]],
      nt: ["Roc d'Amakna","Colosse","Séisme intérieur","Poigne de fer","Racines profondes","Muraille de granit","Éboulement","Cœur de pierre","Tellurique","Masse d'armes","Force tranquille","Coup de boutoir"],
      ks: [["Fureur du Colosse", { t: 30, hp: -15 }], ["Inébranlable", { res: 12, pm: -1 }], ["Briseur de boucliers", { d: 12, cri: -8 }]] },
    { n: "Feu", c: "#ff6b4a", st: [["Intelligence", 2, "ine"], ["% dégâts Feu", 0.5, "ine"], ["Puissance", 1, "pui"]],
      nt: ["Brasier","Flamme du Phénix","Cendres","Fournaise","Étincelle","Combustion","Lave vive","Feu sacré","Braises","Incandescence","Feu follet","Flambée"],
      ks: [["Bûcher", { f: 30, h: -25 }], ["Phénix", { rev: 30, d: -10 }], ["Pyromane", { f: 40, pa: -1 }]] },
    { n: "Eau", c: "#4aa8ff", st: [["Chance", 2, "cha"], ["% dégâts Eau", 0.5, "cha"], ["Prospection", 2, "pp"]],
      nt: ["Marée","Fortune","Source claire","Ressac","Abysses","Pluie d'or","Courant","Perle rare","Écume","Profondeurs","Bonne étoile","Trésor englouti"],
      ks: [["Pile ou Face", { e: 25, res: -8 }], ["Coffre d'Enutrof", { pp: 120, d: -10 }], ["Raz-de-marée", { e: 30, hp: -10 }]] },
    { n: "Air", c: "#7ddc6a", st: [["Agilité", 2, "age"], ["% dégâts Air", 0.5, "age"], ["Critique", 0.5, "cri"]],
      nt: ["Rafale","Œil de lynx","Vent arrière","Pas léger","Tourbillon","Zéphyr","Plume","Ouragan","Envolée","Souffle vif","Courant d'air","Lame du vent"],
      ks: [["Critique absolu", { cri: 15, cx: -30 }], ["Insaisissable", { a: 20, ini: 500, hp: -15 }], ["Premier coup", { t1: 50, ini: 1000, d: -8 }]] },
    { n: "Vitalité", c: "#ff7aa8", st: [["Vitalité", 8, "vit"], ["% PV", 0.5, "vit"], ["Résistance", 0.5, "re"]],
      nt: ["Cœur de Bouftou","Rempart","Sang chaud","Seconde peau","Endurance","Bastion","Régénération","Peau dure","Souffle long","Garde rapprochée","Robustesse","Armure vivante"],
      ks: [["Sang de Sacrieur", { low: 40, h: -20 }], ["Bouclier vivant", { hp: 20, res: 8, d: -15 }], ["Immortel", { rev: 20, h: -20 }]] },
    { n: "Sagesse", c: "#c49bff", st: [["Sagesse", 2, "sa"], ["% soins", 0.5, "so"], ["Initiative", 12, "ini"]],
      nt: ["Sagesse des Anciens","Pendule","Almanax","Méditation","Clairvoyance","Mémoire","Horloge","Esprit vif","Érudit","Lumière","Patience","Calme intérieur"],
      ks: [["Maître du temps", { ini: 1200, d: -10 }], ["Identité exaltée", { pass: 25, d: -8 }], ["Grand soigneur", { h: 40, d: -25 }]] },
  ];
  const SEC2 = [["Résistances", 0.5, "re"], ["Soins", 1, "so"], ["Initiative", 10, "ini"], ["Critique", 0.5, "cri"]]; // 2.0 : valeurs réglées par simulation (100 points ≈ +1 stasis)
  const ICO = { "Force": "fo", "% dégâts Terre": "fo", "Puissance": "pui", "Intelligence": "ine", "% dégâts Feu": "ine", "Chance": "cha", "% dégâts Eau": "cha", "Prospection": "pp", "Agilité": "age", "% dégâts Air": "age", "Critique": "cri", "Vitalité": "vit", "% PV": "vit", "Résistance": "re", "Résistances": "re", "Sagesse": "sa", "% soins": "so", "Soins": "so", "Initiative": "ini", "% dégâts": "pui" };

  /* ---------- moteur ---------- */
  E.MT_OPEN = 1000; E.MT_FREE = 50; E.MT_RESPEC = 20000; E.MT_UNDO = 10;
  E.mtOn = (c) => !!c && c.lvl >= E.MAX_LVL;
  E.mtAcct = (S) => S.chars.reduce((a, c) => a + E.mtPts(c), 0);
  E.mtAcctPct = (S) => Math.floor(E.mtAcct(S) / 100); // Maîtrise du compte : +1 % d'XP par 100 points
  E.mtAcctMult = (S) => 1 + E.mtAcctPct(S) / 100;
  /* effets en combat : libellé d'étoile → [st (caractéristique ajoutée) | fx (effet de combat), clé] */
  const LBL = { "Force": ["st", "fo"], "Intelligence": ["st", "ine"], "Chance": ["st", "cha"], "Agilité": ["st", "age"], "Vitalité": ["st", "vit"], "Sagesse": ["st", "sa"], "Puissance": ["st", "pui"],
    "Prospection": ["st", "pp"], "Initiative": ["st", "ini"], "Soins": ["st", "so"], "Critique": ["fx", "cri"], "% dégâts Terre": ["fx", "t"], "% dégâts Feu": ["fx", "f"], "% dégâts Eau": ["fx", "e"],
    "% dégâts Air": ["fx", "a"], "% dégâts": ["fx", "d"], "% PV": ["fx", "hp"], "Résistance": ["fx", "res"], "Résistances": ["fx", "res"], "% soins": ["fx", "h"] };
  const FXK = ["d", "t", "f", "e", "a", "hp", "res", "cri", "cx", "h", "t1", "low", "pa", "pm", "sh", "rev", "pass"];
  const FXT = { d: " % de dégâts", t: " % de dégâts Terre", f: " % de dégâts Feu", e: " % de dégâts Eau", a: " % de dégâts Air", hp: " % de PV", res: " % de résistances", cri: " % de coups critiques",
    cx: " % de dégâts critiques", h: " % de soins et de boucliers", t1: " % de dégâts au premier tour", low: " % de dégâts sous la moitié de ses PV", pa: " PA", pm: " PM", pp: " Prospection", ini: " Initiative", pass: " % d'effet du passif de classe" };
  const nf = (v) => String(Math.round(v * 10) / 10).replace(".", ","); E.mtNf = nf;
  const sg = (v) => (v > 0 ? `+${v}` : `−${-v}`);
  E.mtFxTxt = (fx) => { const t = mtFxTxt0(fx); return t.charAt(0).toUpperCase() + t.slice(1); };
  const mtFxTxt0 = (fx) => Object.keys(fx).sort((x, y) => (fx[y] > 0) - (fx[x] > 0)).map((k) => k === "sh" ? `bouclier de ${fx[k]} % des PV au début du combat` : k === "rev" ? `se relève une fois par combat à ${fx[k]} % des PV` : `${sg(fx[k])}${FXT[k]}`).join(" ; ") + ".";
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
    const small = (d, i) => { const D0 = DOM[d]; const s = i % 6 === 5 ? SEC2[i % SEC2.length] : D0.st[i % 3]; return { t: "s", d, n: s[0], b: [[s[0], s[1]]], txt: `+${nf(s[1])} ${s[0]}`, ic: ICO[s[0]] }; };
    const ntI = DOM.map((_, d) => (k * 5 + d) % 12);
    const notable = (d) => { const D0 = DOM[d]; const n = D0.nt[ntI[d]++ % D0.nt.length]; const b = [[D0.st[0][0], D0.st[0][1] * 5], [D0.st[1][0], D0.st[1][1] * 3]]; return { t: "nt", d, n, b, txt: b.map(([s, v]) => `+${nf(v)} ${s}`).join(" · "), ic: D0.st[0][2] }; };
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
      S0.ks = add(P({ t: "ks", d: S0.d, n: kk[0], fx: kk[1], txt: E.mtFxTxt(kk[1]), b: [], ic: null }, S0.th, r + 40)); link(prev, S0.ks);
      let best = 0, bd = 9; r2.forEach((id) => { const dd = Math.abs(((N[id].th - S0.th + TAU * 1.5) % TAU) - Math.PI); if (dd < bd) { bd = dd; best = id; } }); link(best, S0.root);
    });
    SP.forEach((S0, si) => { const T2 = SP[(si + 1) % SP.length]; link(S0.root, T2.root);
      S0.lv.forEach((ring, cc) => { if (cc === 0 || rnd() < 0.45) { const a = ring[2], b = T2.lv[cc][6]; let mt = (N[a].th + N[b].th) / 2; if (Math.abs(N[a].th - N[b].th) > Math.PI) mt += Math.PI; const m1 = add(P(small(S0.d, cc + si), mt, N[a].r)); link(a, m1); link(m1, b); } }); });
    (KSC[cls] || []).forEach((kk, i) => {
      const th = TAU * [2, 3, 4][i] / 6; let prev = r2[Math.round(th / TAU * 18) % 18];
      for (let j = 0; j < 4; j++) { const id = add(P({ t: "cls", d: f[0], n: `Voie : ${kk[0]}`, txt: `+1 % d'effet du passif ${pas} ; mène à ${kk[0]}.`, b: [[`Passif ${pas} (%)`, 1]] }, th, 190 + j * 34)); link(prev, id); prev = id; }
      const id = add(P({ t: "cks", d: f[0], n: kk[0], fx: kk[1], txt: E.mtFxTxt(kk[1]), b: [] }, th, 350)); link(prev, id); cks.push(id);
    });
    { const NB = [["% dégâts", 0.5, "pui"], ["% PV", 0.5, "vit"], ["Résistances", 1, "re"], ["Critique", 0.5, "cri"]];
      const nb = (i) => { const s = NB[i % 4]; return { t: "s", neb: true, d: 5, n: s[0], b: [[s[0], s[1]]], txt: `+${nf(s[1])} ${s[0]} (Nébuleuse)`, ic: s[2] }; };
      const near = (th) => SP.reduce((m, x) => (Math.abs(((x.th - th + TAU * 1.5) % TAU) - Math.PI) < Math.abs(((m.th - th + TAU * 1.5) % TAU) - Math.PI) ? x : m));
      const hub = add(P({ t: "nt", neb: true, d: 5, n: "Cœur de la Nébuleuse", b: [["% dégâts", 2], ["% PV", 2]], txt: "+2 % de dégâts · +2 % de PV", ic: "pui" }, Math.PI, 1800));
      [-1, 1].forEach((sd) => { const S0 = near(Math.PI + sd * 0.3); let prev = S0.lv[4][sd > 0 ? 2 : 6]; for (let i = 0; i < 4; i++) { const id = add(P(nb(i + (sd > 0 ? 2 : 0)), Math.PI + sd * (0.24 - i * 0.05), 1540 + i * 60)); link(prev, id); prev = id; } link(prev, hub); });
      const ringN = []; for (let j = 0; j < 12; j++) { const a = TAU * j / 12; ringN.push(add(P(nb(j), Math.PI, 1800, Math.cos(a) * 80, Math.sin(a) * 80))); }
      ringN.forEach((id, j) => { link(id, ringN[(j + 1) % 12]); if (j % 4 === 0) link(hub, id); });
      NKS.forEach((kk, i) => { const th = Math.PI + (i - 1) * 0.11; let prev = ringN[[5, 6, 7][i]]; for (let j = 0; j < 6; j++) { const id = add(P(nb(i + j), th, 1900 + j * 34)); link(prev, id); prev = id; } link(prev, add(P({ t: "ks", neb: true, d: 5, n: kk[0], fx: kk[1], txt: E.mtFxTxt(kk[1]), b: [] }, th, 2130))); });
    }
    for (const n of N) { const X0 = Math.sin(n.th) * n.r, Y0 = -Math.cos(n.th) * n.r, psi = n.th - Math.PI / 2; n.X = X0 + Math.cos(psi) * n.lr - Math.sin(psi) * n.lt; n.Y = Y0 + Math.sin(psi) * n.lr + Math.cos(psi) * n.lt; }
    const coreIds = N.filter((n) => n.t === "cls" && n.r <= 150).map((n) => n.id);
    return (TREES[cls] = { cls, N, ED, SP, cks, start, domTh, coreIds, order, pas });
  }
  E.mtTree = build;
  const NKS = [["Œil de l'Éternel", { res: 15, d: -5 }], ["Larme d'Eliatrope", { d: 10, hp: 10, pm: -1 }], ["Souffle d'Ogrest", { t1: 100, hp: -15 }]];
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
    ambre: { n: "Ambre du Tynril", c: "#d39a5c", b: ["% dégâts Terre", 2] }, rubis: { n: "Rubis d'Ogrest", c: "#ff6b4a", b: ["% dégâts Feu", 2] },
    saphir: { n: "Saphir des Abysses", c: "#4aa8ff", b: ["% dégâts Eau", 2] }, emeraude: { n: "Émeraude d'Ouranos", c: "#7ddc6a", b: ["% dégâts Air", 2] },
    perle: { n: "Perle de Vitalité", c: "#ff7aa8", b: ["% PV", 3] }, opale: { n: "Opale du Temps", c: "#c49bff", b: ["Initiative", 60] } };
  E.JOY = JOY;
  /* un boss de donjon en stasis 10 et plus : 8 % de chances d'un joyau (+2 % par stasis au-dessus de 10) */
  E.joyRate = (k) => 0.08 + 0.02 * Math.max(0, Math.min(15, k) - 10);
  E.joyDrop = (S, k, out) => { if (E.rnd() >= E.joyRate(k)) return null; const ks = Object.keys(JOY); const j = ks[Math.floor(E.rnd() * ks.length)];
    S.joy = S.joy || []; S.joyUid = (S.joyUid || 0) + 1; S.joy.push({ uid: S.joyUid, k: j }); if (out) out.joy = j;
    if (E.note) E.note(S, `Butin rare : ${JOY[j].n}, un joyau de Maîtrise !`, "rare"); return j; }; E.MT_DOM = DOM; E.MT_FORT = FORT;

  /* ---------- Maîtrise du Bestiaire ---------- */
  E.BT = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 20000, 35000, 60000, 100000];
  E.BT_REW = { 5: "Ornement de la famille", 10: "Trophée : +2 % de butin sur la famille", 15: "Titre « Fléau »", 20: "Aura de la famille dans la Scène" };
  E.btKills = (S, r) => (E.RACE_MONS[r] || []).reduce((a, k) => a + ((S.bestiary || {})[k] || 0), 0) + ((S.btx || {})[r] || 0); // btx : le double de la famille du jour
  E.btTier = (S, r) => { const n = E.btKills(S, r); let t = 0; E.BT.forEach((v, i) => { if (n >= v) t = i + 1; }); return t; };
  E.btDay = (S) => { const R = Object.keys(E.RACE_MONS).sort(); return R.length ? R[Math.floor(E.now() / 86400000) % R.length] : null; };
  E.btRank = (S) => Object.keys(E.RACE_MONS).reduce((a, r) => a + E.btTier(S, r), 0);
  const raceName = (r) => (D.RACES && D.RACES[r]) || "Monstres";
  const RACE_OF = {}; for (const r in E.RACE_MONS) E.RACE_MONS[r].forEach((k) => (RACE_OF[k] = r));
  E.btRaceOf = (k) => RACE_OF[k];
  /* une victoire : la famille du jour compte double ; récompenses des paliers 5 (ornement) et 15 (titre) */
  E.btKill = (S, m) => {
    const r = RACE_OF[m.base || m.key]; if (r === undefined) return; const t0 = E.btTier(S, r);
    if (r === E.btDay(S)) (S.btx = S.btx || {})[r] = (S.btx[r] || 0) + 1;
    const t1 = E.btTier(S, r); if (t1 === t0) return;
    if (t1 >= 5) E.btOrnSync(S);
    if (t1 >= 15) { const t = E.btTitle(r); S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); }
    if ([5, 10, 15, 20].includes(t1)) E.emit(S, "bestiaire", { r, t: t1 });
  };
  E.btTitle = (r) => `Fléau des ${raceName(r)}`;
  E.btOrnSync = (S) => { if (!E.ORN) return; for (const r in E.RACE_MONS) { const id = "bt_" + r; if (!E.ORN[id] && E.btTier(S, r) >= 5) E.ORN[id] = { name: () => `Sceau des ${raceName(r)}`, req: `Palier 5 du Bestiaire : ${raceName(r)}`, ok: (s) => E.btTier(s, r) >= 5, bt: r }; } };
  /* palier 10 : +2 % de butin sur la famille (en proportion des monstres du combat) */
  E.btLoot = (S, mons) => { if (!mons || !mons.length) return 1; let n = 0; mons.forEach((m) => { const r = RACE_OF[m.base || m.key]; if (r !== undefined && E.btTier(S, r) >= 10) n++; }); return 1 + 0.02 * n / mons.length; };
  /* +0,5 % de dégâts contre la famille par palier */
  E.btFx = (S) => { const o = {}; let any = false; for (const r in E.RACE_MONS) { const t = E.btTier(S, r); if (t) { o[r] = t * 0.5; any = true; } } return any ? o : null; };

  /* ---------- la Maîtrise en combat (active seulement au niveau 200) ---------- */
  const CACHE = new WeakMap();
  E.mtFx = (S, c) => {
    if (!E.mtOn(c) || !c.mt) return null; const M = c.mt; const ids = M.t[M.lo] || [];
    if (!ids.length) return null;
    const key = `${c.cls}|${M.lo}|${ids.join(",")}|${JSON.stringify(M.j || {})}|${(S.joy || []).length}`; const hit = CACHE.get(M); if (hit && hit.key === key) return hit.fx;
    const { t, ks } = E.mtStats(S, c); const fx = { st: {} }; FXK.forEach((k) => (fx[k] = 0));
    for (const lb in t) { if (lb.startsWith("Passif ")) { fx.pass += t[lb]; continue; } const m = LBL[lb]; if (!m) continue; if (m[0] === "st") fx.st[m[1]] = (fx.st[m[1]] || 0) + t[lb]; else fx[m[1]] += t[lb]; }
    ks.forEach((n) => { for (const k in n.fx || {}) { if (k === "pp" || k === "ini") fx.st[k] = (fx.st[k] || 0) + n.fx[k]; else if (k === "rev") fx.rev = Math.max(fx.rev, n.fx[k]); else fx[k] += n.fx[k]; } });
    fx.n = ids.length; CACHE.set(M, { key, fx }); return fx;
  };

  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
