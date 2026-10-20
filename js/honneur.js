/* ============================================================================
   HONNEUR — refonte des alignements (choix de Mathis : 1A conflit réel, 2A régions de la carte, 3A points d'honneur
   et 20 rangs, 4A même système au Monocompte remis à zéro chaque saison ; maquette 1A 2A 3A 4A 5A ; talent 5 « Serment »).
   - Points d'honneur (S.align.hon, jamais dépensés : ils font le rang) et bourse d'honneur (S.align.pur, dépensée à
     l'Arsenal de la cité). 20 rangs : 300 points pour le rang 1, puis +15 % par rang.
     L'ancien niveau d'alignement (0 à 100, 5 rangs) devient de l'honneur : niveau 100 = rang 10 (migration E.VERSION 14).
   - 5 talents par ordre, un par rang de 1 à 5. Le 5e, « Serment de Menalt » (Bonta) ou « Serment de Djaul » (Brâkmar) :
     +10 % de points de guerre dans les régions tenues par ton camp, et d'honneur gagné en y chassant (hors agressions et défenses) ;
     l'honneur des agressions et des défenses n'est pas concerné, ni celui gagné hors d'une région tenue (étude PvP n° 2, choix 5A).
   - Arsenal de la cité : 5 équipements de rang niveau 200 (coiffe, cape, anneau, amulette, bottes), un par rang de 6 à 10,
     payés en honneur, liés au compte (ni HdV ni échange). Panoplie « Milice de Bonta » / « Milice de Brâkmar ».
   - Régions de la carte (remplacent la guerre de la semaine) : les points de guerre vont à la région où chassent tes héros
     (ou à ton front). Le serveur tient la jauge de chaque région ; à 70 % pour un camp sur la semaine, elle change de camp.
     Le camp qui tient une région y gagne +5 % d'XP et de butin.
   - Agressions contre des équipes fantômes du camp adverse (combat du Kolizéum) : victoire +40 à +120 honneur,
     défaite d'une agression lancée −20. Être agressé ne coûte jamais rien (défenses : +20 si tu gagnes).
   Pas de DOM ici (interface : js/alignui.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { ITEMS, SETS } = D;
  const note = (S, t, k) => E.note(S, t, k);
  const fmtK = (n) => Math.round(n).toLocaleString("fr-FR");

  /* ---------- rangs ---------- */
  E.HON_MAX = 20;
  E.honStep = (r) => Math.round((300 * Math.pow(1.15, r - 1)) / 10) * 10;  // honneur pour passer du rang r-1 au rang r
  const CUM = [0]; for (let r = 1; r <= E.HON_MAX; r++) CUM[r] = CUM[r - 1] + E.honStep(r);
  E.honCum = (r) => CUM[Math.max(0, Math.min(E.HON_MAX, r))];
  E.honRankOf = (h) => { let r = 0; while (r < E.HON_MAX && h >= CUM[r + 1]) r++; return r; };
  /* ancien niveau d'alignement (0-100) → honneur : un rang tous les 10 niveaux, le reste au prorata */
  E.honFromLvl = (l) => { l = Math.max(0, Math.min(100, +l || 0)); const r = Math.min(10, Math.floor(l / 10)); return r >= 10 ? CUM[10] : Math.round(CUM[r] + (l % 10) / 10 * E.honStep(r + 1)); };
  E.honInit = (S) => {
    const A = S && S.align; if (!A || typeof A !== "object") return null;
    if (!(A.hon >= 0)) { A.hon = E.honFromLvl(A.lvl); A.pur = Math.max(0, +A.pur || 0); }
    if (!(A.pur >= 0)) A.pur = 0;
    if (!A.ag || typeof A.ag !== "object" || A.ag.d !== E.dayIdx()) A.ag = { d: E.dayIdx(), n: 0, def: 0, reg: 0, last: (A.ag && A.ag.last) || null, defAt: (A.ag && A.ag.defAt) || 0 };
    if (!A.front || !E.ALIGN_REG[A.front]) A.front = "amakna";
    A.lvl = Math.min(100, E.honRankOf(A.hon) * 5); // pour le serveur et les anciens écrans : 5 niveaux par rang
    A.xp = 0;
    return A;
  };
  E.dayIdx = E.dayIdx || ((t) => Math.floor((t || E.now()) / 86400000));
  E.alignRankIdx = (S) => (S && S.align ? E.honRankOf(E.honInit(S).hon) : 0);
  const ROM = ["I", "II", "III", "IV"];
  E.honRankName = (side, ord, r) => {
    const A = E.ALIGN[side]; if (!A || !r) return "Néophyte"; const O = A.orders[ord] || A.orders.coeur;
    if (r >= 20) return `Héros de ${A.name}`;
    if (r >= 18) return `Grand Maître de ${A.name}`;
    if (r >= 16) return `Commandeur de ${A.name}`;
    return `${O.ranks[Math.min(4, Math.floor((r - 1) / 3))]} ${ROM[(r - 1) % 3]}`;
  };
  E.alignRankName = (S) => { const A = S.align; return A ? E.honRankName(A.side, A.order, E.alignRankIdx(S)) : ""; };
  E.HON_TITLES = { 16: (n) => `Commandeur de ${n}`, 18: (n) => `Grand Maître de ${n}`, 20: (n) => `Héros de ${n}` };

  /* ---------- talents d'ordre : un par rang de 1 à 5 ---------- */
  E.ALIGN_TAL = {
    coeur: [
      { n: { bonta: "Élan du Cœur", brakmar: "Sang bouillant" }, d: "+4 % de PV pour tes héros", k: "hp", v: 4 },
      { n: { bonta: "Riposte bénie", brakmar: "Lame impie" }, d: "+6 % de dégâts en agression", k: "agr", v: 6 },
      { n: { bonta: "Bannière de Bonta", brakmar: "Étendard de Brâkmar" }, d: "+5 % d'honneur gagné", k: "hon", v: 5 },
      { n: { bonta: "Rempart", brakmar: "Peau de Djaul" }, d: "−8 % de dégâts reçus en défense", k: "def", v: 8 },
      { n: { bonta: "Serment de Menalt", brakmar: "Serment de Djaul" }, d: "+10 % de points de guerre dans les régions tenues par ton camp, et d'honneur gagné en y chassant (hors agressions et défenses)", k: "oath", v: 10 } ],
    esprit: [
      { n: { bonta: "Sagesse de Jiva", brakmar: "Savoir d'Hécate" }, d: "+4 % d'expérience", k: "xp", v: 4 },
      { n: { bonta: "Parchemin de lumière", brakmar: "Grimoire des douleurs" }, d: "+6 % de dégâts en agression", k: "agr", v: 6 },
      { n: { bonta: "Bannière de Bonta", brakmar: "Étendard de Brâkmar" }, d: "+5 % d'honneur gagné", k: "hon", v: 5 },
      { n: { bonta: "Sceau protecteur", brakmar: "Sceau des tortures" }, d: "−8 % de dégâts reçus en défense", k: "def", v: 8 },
      { n: { bonta: "Serment de Menalt", brakmar: "Serment de Djaul" }, d: "+10 % de points de guerre dans les régions tenues par ton camp, et d'honneur gagné en y chassant (hors agressions et défenses)", k: "oath", v: 10 } ],
    oeil: [
      { n: { bonta: "Regard de Silvosse", brakmar: "Œil de Brumaire" }, d: "+4 % de butin", k: "drop", v: 4 },
      { n: { bonta: "Coup de l'ombre", brakmar: "Frappe sournoise" }, d: "+6 % de dégâts en agression", k: "agr", v: 6 },
      { n: { bonta: "Bannière de Bonta", brakmar: "Étendard de Brâkmar" }, d: "+5 % d'honneur gagné", k: "hon", v: 5 },
      { n: { bonta: "Leurre", brakmar: "Voile des ombres" }, d: "−8 % de dégâts reçus en défense", k: "def", v: 8 },
      { n: { bonta: "Serment de Menalt", brakmar: "Serment de Djaul" }, d: "+10 % de points de guerre dans les régions tenues par ton camp, et d'honneur gagné en y chassant (hors agressions et défenses)", k: "oath", v: 10 } ],
  };
  E.honTalents = (S) => { const A = S && S.align; if (!A) return []; const r = E.alignRankIdx(S); return (E.ALIGN_TAL[A.order] || E.ALIGN_TAL.coeur).slice(0, Math.min(5, r)); };
  E.honTal = (S, k) => E.honTalents(S).filter((t) => t.k === k).reduce((a, t) => a + t.v, 0);

  /* ---------- équipements de rang (Arsenal de la cité) ---------- */
  E.HON_GEAR_SLOTS = ["coiffe", "cape", "anneau", "amulette", "bottes"];
  E.HON_GEAR_COST = [1500, 2000, 2500, 3000, 4000];
  const WAR_LINE = { coiffe: { k: "hon", v: 3, d: "+3 % d'honneur gagné" }, cape: { k: "def", v: 2, d: "−2 % de dégâts reçus en défense" },
    anneau: { k: "agr", v: 2, d: "+2 % de dégâts en agression" }, amulette: { k: "agr", v: 2, d: "+2 % de dégâts en agression" }, bottes: { k: "def", v: 2, d: "−2 % de dégâts reçus en défense" } };
  // 3A : +2 % / −2 % par pièce, sans plafond (étude PvP n° 2)
  const GEAR = {
    bonta: { set: "milice_b", names: ["Heaume de la Milice de Bonta", "Cape de la Milice de Bonta", "Anneau de la Milice de Bonta", "Amulette de la Milice de Bonta", "Bottes de la Milice de Bonta"],
      icons: [16693, 17214, 9211, 1181, 11180],
      st: [{ vit: [281, 330], fo: [36, 50], ine: [36, 50], cha: [36, 50], age: [36, 50], sa: [26, 35], cri: [2, 3], re: [6, 8], ra: [6, 8], rn: [6, 8], pui: [8, 12], do: [2, 3] },
           { vit: [231, 280], fo: [31, 40], ine: [31, 40], cha: [31, 40], age: [31, 40], sa: [26, 35], cri: [2, 3], rt: [6, 8], rf: [6, 8], pui: [8, 12], do: [2, 3] },
           { vit: [181, 230], sa: [26, 35], pui: [8, 12], cri: [2, 3], so: [5, 7], rn: [5, 7], re: [5, 7], do: [2, 3] },
           { vit: [231, 280], fo: [26, 35], ine: [26, 35], cha: [26, 35], age: [26, 35], sa: [26, 35], pa: [1, 1], so: [5, 7], ra: [5, 7], pui: [8, 12], do: [2, 3] },
           { vit: [231, 280], fo: [26, 35], ine: [26, 35], cha: [26, 35], age: [26, 35], sa: [26, 35], pm: [1, 1], rt: [5, 7], rf: [5, 7], pui: [8, 12], do: [2, 3] }] },
    brakmar: { set: "milice_k", doMul: 0.75, // 2A, variante V5 : dommages des pièces ×0,75 (après le ×1,5)
      names: ["Heaume de la Milice de Brâkmar", "Cape de la Milice de Brâkmar", "Anneau de la Milice de Brâkmar", "Amulette de la Milice de Brâkmar", "Bottes de la Milice de Brâkmar"],
      icons: [16292, 17259, 9212, 1225, 11215],
      st: [{ vit: [251, 300], fo: [36, 50], ine: [36, 50], cha: [36, 50], age: [36, 50], sa: [26, 35], cri: [3, 4], dn: [6, 9], dt: [6, 9], df: [6, 9], de: [6, 9], da: [6, 9] },
           { vit: [201, 250], fo: [31, 40], ine: [31, 40], cha: [31, 40], age: [31, 40], sa: [26, 35], cri: [2, 3], do: [5, 7], pp: [8, 12] },
           { vit: [151, 200], sa: [26, 35], pui: [26, 35], cri: [3, 4], do: [6, 9] },
           { vit: [201, 250], fo: [26, 35], ine: [26, 35], cha: [26, 35], age: [26, 35], sa: [26, 35], pa: [1, 1], do: [5, 7] },
           { vit: [201, 250], fo: [26, 35], ine: [26, 35], cha: [26, 35], age: [26, 35], sa: [26, 35], pm: [1, 1], cri: [2, 3], do: [4, 6] }] },
  };
  E.HON_GEAR = {}; E.HON_GEAR_POW = 1.5;
  for (const side in GEAR) {
    const G = GEAR[side];
    SETS[G.set] = { name: side === "bonta" ? "Milice de Bonta" : "Milice de Brâkmar", bonus: side === "bonta" ? { 3: { vit: 200, ra: 5, pui: 30 }, 5: { vit: 400, pui: 40, do: 5, rn: 7, rt: 7, rf: 7, re: 7, ra: 7 } } : { 3: { pui: 30, cri: 3 }, 5: { pui: 50, do: 8, cri: 3 } }, size: 5 }; // 2A : V5
    E.HON_GEAR[side] = E.HON_GEAR_SLOTS.map((slot, i) => {
      const id = `hon_${side}_${slot}`;
      const st = {}; for (const k in G.st[i]) st[k] = k === "pa" || k === "pm" ? G.st[i][k] : G.st[i][k].map((v) => Math.round(v * E.HON_GEAR_POW));
      if (G.doMul && st.do) st.do = st.do.map((v) => Math.round(v * G.doMul)); // réglé par simulation : un peu sous le meilleur butin de donjon
      ITEMS[id] = { name: G.names[i], icon: G.icons[i], slot, lvl: 200, stats: st, set: G.set, hidden: true, noDrop: true, bound: true, rarity: "epique", war: WAR_LINE[slot], src: `Arsenal de ${E.ALIGN[side].name} (rang ${6 + i}, ${fmtK(E.HON_GEAR_COST[i])} honneur)` };
      return id;
    });
  }
  E.honGearRank = (i) => 6 + i;
  E.honGearOwned = (S, id) => !!(S.honGear && S.honGear[id]) || Object.values(S.items || {}).some((it) => it.tpl === id);
  E.honBuy = (S, slot) => {
    const A = E.honInit(S); if (!A) return "Choisis d'abord un camp.";
    const i = E.HON_GEAR_SLOTS.indexOf(slot); if (i < 0) return "Objet inconnu.";
    const id = E.HON_GEAR[A.side][i]; const need = E.honGearRank(i);
    if (A.pend) return "Pas d'achat pendant un changement de camp.";
    if (E.alignRankIdx(S) < need) return `Il faut le rang ${need}.`;
    if (E.honGearOwned(S, id)) return "Tu l'as déjà.";
    if (A.pur < E.HON_GEAR_COST[i]) return `Il faut ${fmtK(E.HON_GEAR_COST[i])} points d'honneur à dépenser.`;
    A.pur -= E.HON_GEAR_COST[i];
    const it = E.rollItem(S, id, { radiant: false }); it.locked = true; S.items[it.uid] = it;
    S.honGear = S.honGear || {}; S.honGear[id] = 1;
    note(S, `Arsenal de ${E.ALIGN[A.side].name} : ${ITEMS[id].name} obtenu (lié au compte).`, "rare");
    E.emit(S, "honbuy", { id }); return null;
  };
  /* lignes de guerre des pièces portées par l'équipe (une fois par type de pièce) et bonus de panoplie complète */
  E.honGearWar = (S, k) => {
    const seen = {}; let v = 0;
    (S.chars || []).filter((c) => c.inTeam !== false).forEach((c) => Object.values(c.equip || {}).forEach((uid) => { const it = S.items && S.items[uid]; const T = it && ITEMS[it.tpl];
      if (T && T.war && T.war.k === k && !seen[it.tpl]) { seen[it.tpl] = 1; v += T.war.v; } }));
    return v;
  };
  E.honFullSet = (S) => (S.chars || []).some((c) => { const n = Object.values(c.equip || {}).filter((uid) => { const T = S.items[uid] && ITEMS[S.items[uid].tpl]; return T && T.bound && T.set && /^milice_/.test(T.set); }).length; return n >= 5; });

  /* ---------- bonus (PV, XP, butin) : rang, talents ; ajoutés à l'alignement par systems.js ---------- */
  E.honBonus = (S, kind) => (kind === "hp" || kind === "xp" || kind === "drop" ? E.honTal(S, kind) : 0);

  /* ---------- régions de la carte ---------- */
  E.ALIGN_REG = { astrub: "Astrub", amakna: "Amakna", cania: "Plaines de Cania", wabbit: "Île des Wabbits", sidimote: "Landes de Sidimote", koalaks: "Montagne des Koalaks",
    albuera: "Albuera", abrak: "Bois d'Abrak", moon: "Île de Moon", dragoeufs: "Île des Dragœufs", otomai: "Île d'Otomaï", minotoror: "Île du Minotoror", pandala: "Pandala",
    frigost: "Frigost", saharach: "Saharach", asse: "Montagnes de l'Asse", grobe: "Grobe", sakai: "Île de Sakaï", valonia: "Valonia", nimotopia: "Nimotopia",
    possedes: "Possédés", vulkania: "Vulkania" };
  E.ALIGN_CITY = "bontabrak"; // Bonta et Brâkmar : les cités, non conquérables
  E.ALIGN_REG_FLIP = 70;      // % des points de la semaine pour faire changer une région de camp
  E.ALIGN_REG_BONUS = 5;      // +5 % d'XP et de butin dans une région tenue par ton camp
  E.ALIGN_WAR = Object.assign(E.ALIGN_WAR || {}, { agr: 20, def: 5 });
  E.ALIGN_HON = { mis: 15, step: 30, chap: 80, dg: 2, regDay: 25, agrMin: 40, agrMax: 120, agrLoss: 20, def: 20, agrDay: 5, defDay: 3, defEvery: 4 * 3600000 };
  const REG = { held: {}, gauge: {}, side: null, at: 0 };
  E.alignRegSet = (o) => { if (o && o.held) REG.held = o.held; if (o && o.gauge) REG.gauge = o.gauge; if (o && "side" in o) REG.side = o.side; REG.at = E.now(); };
  E.alignRegState = () => REG;
  E.regOfSub = (sub) => { const Z = sub && E.SUBS[sub] && E.SUBS[sub].zone; return Z && E.ALIGN_REG[Z] ? Z : null; };
  E.regHeldBy = (reg) => REG.held[reg] || null;
  E.regMine = (S, reg) => !!(S && S.align && reg && REG.held[reg] === S.align.side);
  /* la région où vont tes points : celle où chassent tes héros, sinon ton front */
  E.regNow = (S) => E.regOfSub(S && S.sub) || (S && S.align && S.align.front) || "amakna";
  E.alignSetFront = (S, reg) => { const A = E.honInit(S); if (!A) return "Choisis d'abord un camp."; if (!E.ALIGN_REG[reg]) return "Région inconnue."; A.front = reg; return null; };

  /* la guerre de la semaine devient la guerre des régions : mêmes points, rangés par région */
  E.alWarAdd = (S, n, reg) => {
    const A = E.alInit(S); if (!A || !(n > 0) || A.pend) return 0; E.honInit(S);
    reg = reg || E.regNow(S); if (E.regMine(S, reg)) n *= 1 + E.honTal(S, "oath") / 100;
    const v = Math.max(0, Math.min(E.ALIGN_WAR.cap - A.war.p, Math.round(n))); if (!v) return 0;
    A.war.p += v; A.war.rg = A.war.rg || {}; A.war.rg[reg] = (A.war.rg[reg] || 0) + v;
    if (E.regMine(S, reg) && A.ag.reg !== A.ag.d) { A.ag.reg = A.ag.d; E.honGive(S, E.ALIGN_HON.regDay, `région défendue (${E.ALIGN_REG[reg]})`, false, true); }
    return v;
  };
  E.alignWarOn = () => false; // l'ancien bonus de la semaine est remplacé par celui des régions
  let CUR = null; // sous-zone chassée (pour le bonus de région, lu par evMult)
  const ev0 = E.evMult;
  if (ev0 && !ev0.hon) { E.evMult = (kind, t) => ev0(kind, t) * ((kind === "xp" || kind === "drop") && CUR && REG.side && REG.held[CUR] === REG.side ? 1 + E.ALIGN_REG_BONUS / 100 : 1); E.evMult.hon = true; }
  E.regBonusOn = (S) => { const r = E.regOfSub(S && S.sub); return !!(r && S.align && REG.side === S.align.side && REG.held[r] === S.align.side); };

  /* ---------- donner ou retirer de l'honneur ---------- */
  /* terr : part (0 à 1, ou vrai/faux) de l'activité récompensée faite dans une région tenue par ton camp, au moment où elle
     a été faite (chaque monstre, donjon ou mission compte là où il a eu lieu, pas là où la récompense est reçue) : seul cas où le Serment compte */
  E.honMult = (S, terr) => 1 + (E.honTal(S, "hon") + E.honGearWar(S, "hon") + (E.honFullSet(S) ? 10 : 0) + Math.max(0, Math.min(1, +terr || 0)) * E.honTal(S, "oath")) / 100;
  E.honGive = (S, n, why, raw, terr) => {
    const A = E.honInit(S); if (!A || A.pend) return 0;
    const before = E.honRankOf(A.hon);
    let v = n > 0 && !raw ? Math.round(n * E.honMult(S, terr)) : Math.round(n);
    if (v < 0) v = -Math.min(A.hon - E.honCum(before), -v); // une défaite ne fait jamais perdre un rang
    A.hon += v; if (v > 0) A.pur += v; else A.pur = Math.max(0, A.pur + v);
    const after = E.honRankOf(A.hon); A.lvl = Math.min(100, after * 5);
    if (after > before) {
      const C = E.ALIGN[A.side].name;
      for (let r = before + 1; r <= after; r++) { const T = E.HON_TITLES[r]; if (T) { S.titlesExtra = S.titlesExtra || []; const t = T(C); if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); } }
      note(S, `Nouveau rang d'alignement : ${after} / 20, « ${E.alignRankName(S)} » !`, "rare"); E.emit(S, "alignrank", { rank: after });
    }
    return v;
  };
  /* l'ancienne XP d'alignement (missions, quêtes, donjons) devient de l'honneur : 1 point pour 100 (choix A2, étude de la conversion) */
  E.HON_XP_DIV = 100;
  E.honHeldSub = (S, sub) => (E.regMine(S, E.regOfSub(sub)) ? 1 : 0);             // sous-zone dans une région tenue par ton camp
  E.honHeldDg = (S, id) => E.honHeldSub(S, E.DUNGEON_SUB && E.DUNGEON_SUB[id]);    // donjon : la région de sa sous-zone
  /* terr : part faite en région tenue, notée par l'appelant au moment de l'activité (avis, missions, étapes, donjons) ; 0 sinon */
  E.giveAlignXp = (S, x, terr) => { if (S && S.align) E.honGive(S, Math.max(1, Math.round(x / E.HON_XP_DIV)), "alignement", false, terr || 0); };

  /* ---------- agressions ---------- */
  E.agrTeam = (S) => {
    const ids = (S.koli && S.koli.team && S.koli.team.length ? S.koli.team : S.chars.filter((c) => c.inTeam !== false).map((c) => c.id)).filter((id) => S.chars.some((c) => c.id === id));
    return ids.slice(0, E.KOLI ? E.KOLI.size : 3);
  };
  const teamLvl = (S) => { const ids = E.agrTeam(S); const L = ids.map((id) => S.chars.find((c) => c.id === id).lvl); return L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : 1; };
  const GH = ["Sombrelune", "Rubis", "Krâne-Noir", "Vespera", "Ombrage", "Lamebrune", "Aube-Claire", "Clairon", "Fiel", "Brasier", "Pâle-Lys", "Givrelame"];
  /* les cibles du jour : 5 équipes fantômes du camp adverse, niveau proche du tien */
  /* 1A, fantômes « modéré » : renfort m par cible (PV ×(1+m), dommages +100 m %, comme boosted() dans alliance.js) ;
     le renfort positif de la Difficile ne s'ajoute qu'au niveau 200, quand le décalage de niveau ne joue plus. Défenses : aucun. */
  E.AGR_BOOST = [-0.3, -0.2, -0.1, 0, 0.15];
  E.agrBoostOf = (i, lvl) => { const m = E.AGR_BOOST[i] || 0; return m > 0 && lvl < 200 ? 0 : m; };
  E.agrGhost = (T) => { const G = E.koliGhost(T.seed, T.lvl, T.n); const m = T.m || 0; if (!m) return G;
    return G.map((h) => { const st = Object.assign({}, h.st); st.hpMax = Math.round(st.hpMax * (1 + m)); st.dsort = (st.dsort || 0) + m * 100; return Object.assign({}, h, { st }); }); };
  E.agrTargets = (S) => {
    const A = E.honInit(S); if (!A) return []; const d = A.ag.d; const L = teamLvl(S); const foe = A.side === "bonta" ? "brakmar" : "bonta";
    return [[-6, 2, 0.6], [-2, 3, 0.8], [0, 3, 1], [3, 3, 1.2], [6, 3, 1.5]].map(([dl, n, m], i) => {
      const seed = (d * 97 + i * 13 + (A.side === "bonta" ? 1 : 2)) >>> 0;
      return { i, seed, lvl: Math.max(30, Math.min(200, L + dl)), n, m: E.agrBoostOf(i, L), side: foe, name: GH[(d + i * 5) % GH.length], rank: 1 + ((d + i * 7) % 19),
        hon: Math.round(E.ALIGN_HON.agrMin + (E.ALIGN_HON.agrMax - E.ALIGN_HON.agrMin) * (m - 0.6) / 0.9), diff: ["Facile", "Facile", "Serré", "Serré", "Difficile"][i] };
    });
  };
  /* bonus de talents et de pièces sur une équipe d'arène (dégâts en agression, dégâts reçus en défense) */
  const boost = (S2, tm, dmg, def) => { S2.fight.ents.filter((e) => e.tm === tm).forEach((e) => { if (dmg) e.dmgBonus = (e.dmgBonus || 0) + dmg; if (def) { e.hpMax = e.hp = e.hpBase = Math.round(e.hpBase / (1 - Math.min(40, def) / 100)); } }); };
  E.agrFight = (S, i, opts = {}) => {
    const A = E.honInit(S); if (!A) return { err: "Choisis d'abord un camp." };
    if (A.pend) return { err: "Pas d'agression pendant un changement de camp." };
    if (A.ag.n >= E.ALIGN_HON.agrDay) return { err: `Plus d'agression aujourd'hui (${E.ALIGN_HON.agrDay} par jour).` };
    const T = E.agrTargets(S)[i]; if (!T) return { err: "Cible inconnue." };
    if ((A.ag.done || []).includes(i) && A.ag.dd === A.ag.d) return { err: "Cette équipe a déjà été combattue aujourd'hui." };
    const ids = E.agrTeam(S); if (!ids.length) return { err: "Il te faut une équipe." };
    const me = E.koliSnap(S, ids); const foe = E.agrGhost(T);
    const dmg = E.honTal(S, "agr") + E.honGearWar(S, "agr");
    const seed = (T.seed * 31 + A.ag.n * 7 + 5) >>> 0;
    const W = E.koliWatch(me, foe, seed, { label: "Agression" }); boost(W.S2, 0, dmg, 0);
    if (opts.watch) return { watch: W, T };
    for (let g = 0; g < 20000 && !W.done; g++) E.koliWatchStep(W);
    return E.agrEnd(S, i, E.koliResult(W));
  };
  E.agrEnd = (S, i, res) => {
    const A = E.honInit(S); const T = E.agrTargets(S)[i]; A.ag.n++;
    if (A.ag.dd !== A.ag.d) { A.ag.dd = A.ag.d; A.ag.done = []; } A.ag.done.push(i);
    let hon, war = 0;
    if (res && res.win) { hon = E.honGive(S, T.hon, "agression"); war = E.alWarAdd(S, E.ALIGN_WAR.agr, A.front); }
    else hon = E.honGive(S, -E.ALIGN_HON.agrLoss, "agression perdue", true);
    S.cnt = S.cnt || {}; S.cnt.agr = (S.cnt.agr || 0) + 1; if (res && res.win) S.cnt.agrWin = (S.cnt.agrWin || 0) + 1;
    A.ag.last = { win: !!(res && res.win), name: T.name, hon, war, reg: A.front, at: E.now() };
    note(S, res && res.win ? `Agression gagnée contre ${T.name} : +${hon} honneur, +${war} points de guerre (${E.ALIGN_REG[A.front]}).` : `Agression perdue contre ${T.name} : ${hon} honneur.`, res && res.win ? "up" : "warn");
    E.emit(S, "agression", { win: !!(res && res.win) });
    return { win: !!(res && res.win), hon, war, T };
  };
  /* défenses : une équipe adverse attaque la tienne de temps en temps (3 par jour au plus) ; perdre ne coûte rien */
  E.honDefTick = (S) => {
    const A = S && S.align; if (!A || A.pend) return null; E.honInit(S);
    if (!A.ag.defAt) { A.ag.defAt = E.now() + E.ALIGN_HON.defEvery; return null; }
    if (E.now() < A.ag.defAt || A.ag.def >= E.ALIGN_HON.defDay) return null;
    A.ag.defAt = E.now() + E.ALIGN_HON.defEvery; A.ag.def++;
    const ids = E.agrTeam(S); if (!ids.length) return null;
    const L = teamLvl(S); const seed = (A.ag.d * 53 + A.ag.def * 11 + 3) >>> 0;
    const W = E.koliWatch(E.koliGhost(seed, L, 3), E.koliSnap(S, ids), seed, { label: "Défense" });
    boost(W.S2, 1, 0, E.honTal(S, "def") + E.honGearWar(S, "def"));
    for (let g = 0; g < 20000 && !W.done; g++) E.koliWatchStep(W);
    const won = !E.koliResult(W).win; const n = won ? E.honGive(S, E.ALIGN_HON.def, "défense") : 0;
    if (won) E.alWarAdd(S, E.ALIGN_WAR.def, A.front);
    note(S, won ? `Défense réussie contre une équipe de ${E.ALIGN[A.side === "bonta" ? "brakmar" : "bonta"].name} : +${n} honneur.` : "Ton équipe a perdu une défense : cela ne coûte rien.", won ? "up" : "info");
    return { won, n };
  };

  /* ---------- branchements ---------- */
  const tick0 = E.tick;
  E.tick = (S, dt, realMs) => { const r = tick0(S, dt, realMs); if (S) { CUR = E.regOfSub(S.sub); if (S.align) { try { E.honDefTick(S); } catch (e) {} } } return r; };
  const des0 = E.deserialize;
  E.deserialize = (txt) => { const S = des0(txt); try { if (S.align) E.honInit(S); } catch (e) {} return S; };
  E.honMigrate = (S) => { if (S && S.align && !(S.align.hon >= 0)) { const l = S.align.lvl || 0; E.honInit(S); return { from: l, rank: E.alignRankIdx(S) }; } return null; };
  /* honneur des missions, quêtes et donjons (à la place de l'XP d'alignement) */
  const emit0 = E.emit;
  E.emit = (S, type, data) => {
    if (emit0) emit0(S, type, data);
    if (!S || !S.align || type !== "dungeon" || !data || data.down) return;
    try { E.honGive(S, E.ALIGN_HON.dg, "donjon", false, E.honHeldDg(S, data.id)); } catch (e) {}
  };
  const choose0 = E.chooseAlign;
  E.chooseAlign = (S, side, order) => { const had = S.align; const r = choose0(S, side, order); if (!r && S.align && !had) { S.align.hon = 0; S.align.pur = 0; E.honInit(S); } return r; };
  const sw0 = E.alSwitchTick;
  E.alSwitchTick = (S) => { const A = S && S.align; const h = A ? A.hon : 0; const done = sw0(S); if (done) { S.align.hon = Math.min(h || 0, E.honCum(2)); S.align.pur = 0; E.honInit(S); } return done; };
  Object.assign(E.ACTIONS, { honBuy: "acheter un équipement de rang", alignSetFront: "choisir sa région de front" });

  /* ---------- résumé envoyé au serveur ---------- */
  const meta0 = E.alignMeta;
  E.alignMeta = (S) => { const m = meta0(S); if (!m) return m; const A = E.honInit(S); return Object.assign(m, { h: Math.max(0, Math.round(A.hon)), r: E.alignRankIdx(S), rg: Object.assign({}, A.war.rg || {}), f: A.front }); };

  /* ---------- succès ---------- */
  if (E.ACH) {
    const add = (o) => { if (!E.ACH.some((a) => a.id === o.id)) E.ACH.push(o); };
    add({ id: "hon5", cat: "Alignement", name: "Ailes déployées", desc: "Atteindre le rang 5 d'alignement.", test: (S) => E.alignRankIdx(S) >= 5, kamas: 20000 });
    add({ id: "hon10", cat: "Alignement", name: "Milicien", desc: "Atteindre le rang 10 d'alignement.", test: (S) => E.alignRankIdx(S) >= 10, kamas: 80000 });
    add({ id: "hon20", cat: "Alignement", name: "Héros de la cité", desc: "Atteindre le rang 20 d'alignement.", test: (S) => E.alignRankIdx(S) >= 20, kamas: 500000 });
    add({ id: "agr25", cat: "Alignement", name: "Agresseur", desc: "Gagner 25 agressions.", test: (S) => ((S.cnt || {}).agrWin || 0) >= 25, kamas: 30000 });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
