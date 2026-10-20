/* ============================================================================
   SUIVI — Idlus (lot Suivi)
   - Carnet de bord : XP, kamas, combats et niveaux heure par heure sur 7 jours, jour par jour sur 30 jours,
     les heures hors ligne repérées, le bilan des kamas (d'où ils viennent, où ils partent) et les grands
     moments (niveaux, renaissances, Dofus, stasis, mises à jour, records). Tout tient dans la partie (~6 Ko).
   - Chasse au trésor : un parchemin (trouvé sur les monstres ou offert chaque jour) donne 3 à 5 indices ;
     chacun nomme une sous-zone et un repère, trouvé après 6 victoires sur place. Au bout, le gardien du
     trésor (un monstre de la dernière zone, renforcé comme un boss) garde un coffre.
   Pas de DOM ici : l'interface est dans ui.js.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { MONSTERS, DUNGEONS } = D;
  const SUBS = E.SUBS;
  const HOUR = 3600000, DAY = 86400000;
  const NH = 168, ND = 30;
  const dayOf = (t) => (E.defiDay ? E.defiDay(t) : Math.floor(t / DAY));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const live = (S) => !!(S && Array.isArray(S.chars) && S.stats);

  /* ======================= CARNET DE BORD ======================= */
  /* 2.1.29.6 : nouvelles cases (Kolizéum, vente directe et marchand, coffres, Ascension, missions, Foire, élevage, guilde, Éclats, pluie) */
  E.CARNET_IN = { chasse: "Chasse", donjon: "Donjons", expedition: "Songe infini", vented: "Vente directe et marchand", hdv: "Hôtel de vente", vente: "Commandes du jour", defi: "Défi du jour", koli: "Kolizéum", ascension: "Ascension", quete: "Quêtes et succès", commande: "Commandes d'artisans", tresor: "Chasse au trésor", mission: "Missions", coffre: "Coffres", foire: "Foire du Trool", monture: "Élevage", guilde: "Guilde et Percepteurs", champion: "Champions et Éclats", pluie: "Pluie de kamas", autre: "Autres" };
  E.CARNET_OUT = { fm: "Forgemagie", havre: "Havre-Sac", craft: "Artisanat et clés", monture: "Montures", boutique: "Boutique", hdv: "Hôtel de vente", idole: "Idoles", donjon: "Donjons", expedition: "Songe infini", ascension: "Ascension", foire: "Foire du Trool", guilde: "Guilde et Percepteurs", mission: "Missions", champion: "Champions et Éclats", pluie: "Pluie de kamas", autre: "Autres" };
  const ACT_CAT = {
    gameBuySell: "vente", gameBuyAll: "vente",
    forgemage: "fm", transForge: "fm", signItem: "fm", fuseRunes: "fm", transmute: "fm", exoForge: "fm", exoCraft: "fm", startFmPlan: "fm",
    buyHavre: "havre", growRoom: "havre", buyFurn: "havre", placeFurn: "havre", buildAtelier: "havre", setAtelier: "havre",
    craftItem: "craft", craftSpecial: "craft", craftMany: "craft", craftScroll: "craft", upgradeTool: "craft", setJob: "craft",
    buildEnclos: "monture", startBreed: "monture", releaseMount: "monture", equipMount: "monture", setMountShare: "monture",
    buyShop: "boutique", buyNets: "boutique",
    enterDungeon: "donjon", leaveDungeon: "donjon", stopChain: "donjon", toggleIdol: "idole",
    almanaxOffer: "quete", redeemGift: "quete", togglePin: "quete", rerollBounty: "quete",
    defiPlay: "defi", tresorClaim: "tresor", tresorLegClaim: "tresor", tresorStart: "tresor", tresorFight: "tresor",
    expDoor: "expedition", expChoose: "expedition", expStart: "expedition", expQuit: "expedition", expBuy: "expedition", sgBuy: "expedition", sgBuyWeek: "expedition", legFuse: "expedition",
    koliFight: "koli", koliRefresh: "koli", useConsumable: "coffre", shardBuy: "champion", sealShard: "champion", sealFuse: "champion", sealEveil: "champion",
    ascStart: "ascension", ascReroll: "ascension", ascChoose: "ascension", ascQuit: "ascension", ascDrink: "ascension", ascUnlock: "ascension", ascBuy: "ascension", ascBrew: "ascension",
    misSend: "mission", misRecall: "mission", misBuildRoom: "mission",
  };
  const catOf = (cat, amount) => (amount > 0 ? (E.CARNET_IN[cat] ? cat : "autre") : (E.CARNET_OUT[cat] ? cat : "autre"));

  let depth = 0; // une action appelée par une autre (ou pendant le temps qui passe) n'est pas comptée deux fois
  const KEYS_H = ["xp", "k", "f", "w", "on", "off", "lv"];
  E.carnet = (S) => {
    if (!S.carnet) S.carnet = { h: { i0: null }, d: { i0: null }, L: { i0: null, days: [] }, mom: [], kLast: S.kamas, hop: (S.hdv && S.hdv.op) || 0, sk: {}, bestH: 0, ver: null };
    return S.carnet;
  };
  /* case d'un tableau glissant (heures ou jours) ; -1 si trop ancienne */
  const slot = (B, idx, N, keys) => {
    if (B.i0 == null || idx - (B.i0 + (B[keys[0]] || []).length - 1) > N) { B.i0 = idx; keys.forEach((k) => (B[k] = [0])); return 0; }
    let len = B[keys[0]].length;
    while (B.i0 + len - 1 < idx) { keys.forEach((k) => B[k].push(0)); len++; }
    while (len > N) { keys.forEach((k) => B[k].shift()); B.i0++; len--; }
    while (idx < B.i0 && len < N) { keys.forEach((k) => B[k].unshift(0)); B.i0--; len++; } // horloge revenue en arrière
    const p = idx - B.i0; return p >= 0 ? p : -1;
  };
  const teamLv = (S) => { const t = E.team(S); const a = t.length ? t : S.chars; return Math.round(a.reduce((s, c) => s + c.lvl, 0) / a.length); };
  const add = (S, t, v) => {
    const C = E.carnet(S);
    const hi = Math.floor(t / HOUR);
    const prevEnd = C.h.i0 == null ? null : C.h.i0 + C.h.xp.length - 1;
    if (prevEnd != null && hi > prevEnd) closeHour(S, C, prevEnd);
    const ph = slot(C.h, hi, NH, KEYS_H), pd = slot(C.d, dayOf(t), ND, KEYS_H);
    const lv = teamLv(S);
    [[C.h, ph], [C.d, pd]].forEach(([B, p]) => {
      if (p < 0) return;
      for (const k of ["xp", "k"]) if (v[k]) B[k][p] = Math.round(B[k][p] + v[k]);
      for (const k of ["f", "w", "on"]) if (v[k]) B[k][p] = Math.round((B[k][p] + v[k]) * 10) / 10;
      if (v.off) B.off[p] = 1;
      B.lv[p] = lv;
    });
  };
  /* une heure se termine : record d'XP en une heure de jeu en ligne */
  const closeHour = (S, C, idx) => {
    const p = idx - C.h.i0; if (p < 0 || p >= C.h.xp.length) return;
    const xp = C.h.xp[p];
    if (C.h.on[p] >= 3000 && !C.h.off[p] && xp > C.bestH) { if (C.bestH > 0) E.carnetMoment(S, "record", `Meilleure heure : ${fmtN(xp)} d'XP`, (idx + 1) * HOUR); C.bestH = xp; }
  };
  const fmtN = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : n >= 1e4 ? Math.round(n / 1e3) + " k" : String(Math.round(n)));
  const ledger = (S, t, amount, cat) => {
    if (!amount) return; const C = E.carnet(S);
    const p = slot(C.L, dayOf(t), ND, ["days"]); if (p < 0) return;
    if (!C.L.days[p] || typeof C.L.days[p] !== "object") C.L.days[p] = {};
    const key = (amount > 0 ? "+" : "-") + catOf(cat, amount);
    C.L.days[p][key] = (C.L.days[p][key] || 0) + Math.abs(Math.round(amount));
  };
  E.carnetMoment = (S, kind, txt, t = E.now()) => {
    const C = E.carnet(S);
    C.mom.unshift({ t, k: kind, txt }); if (C.mom.length > 40) C.mom.length = 40;
  };
  /* la version du jeu change : un moment « mise à jour » (appelé par l'interface au chargement) */
  E.carnetVersion = (S, v) => { const C = E.carnet(S); if (C.ver && C.ver !== v) E.carnetMoment(S, "maj", `Mise à jour ${v}`); C.ver = v; };
  /* kamas bougés hors des actions et du temps (Hôtel de vente, réglages de test…) */
  const pre = (S) => {
    const C = E.carnet(S); const op = (S.hdv && S.hdv.op) || 0;
    if (typeof C.kLast === "number" && S.kamas !== C.kLast) ledger(S, E.now(), S.kamas - C.kLast, op !== C.hop ? "hdv" : "autre");
    C.kLast = S.kamas; C.hop = op; C.tag = 0;
    return C;
  };
  /* gains marqués pendant le temps qui passe (coffre du trésor…) : pas comptés deux fois */
  const tag = (S, amount, cat) => { const C = E.carnet(S); ledger(S, E.now(), amount, cat); C.tag = (C.tag || 0) + amount; };
  /* 2.1.29.6 : un gain (ou une dépense) rangé dans sa case par le module qui le donne (Songe, Kolizéum, marchand, coffres…) ;
     pendant une action ou le temps qui passe, il n'est pas recompté ; ailleurs (réponses du serveur), la case est remplie tout de suite */
  E.carnetGain = (S, amount, cat) => {
    amount = Math.round(+amount || 0); if (!amount || !live(S)) return;
    const C = E.carnet(S); ledger(S, E.now(), amount, cat);
    if (depth) C.tag = (C.tag || 0) + amount; else if (typeof C.kLast === "number") C.kLast += amount;
  };
  /* opérations du serveur (js/market.js) : vente directe, guilde, Foire, pluie de kamas, classement de l'Ascension, sinon Hôtel de vente */
  E.carnetOpCat = (p, t) => (p.vd ? "vented" : p.rain ? "pluie" : p.jack || p.jt ? "foire" : /Percepteur|guilde|Guildalogemme/i.test(t || "") ? "guilde" : /Ascension/.test(t || "") ? "ascension" : "hdv");
  E.carnetOp = (S, p, t) => {
    if (!live(S) || !p) return;
    if (p.k) E.carnetGain(S, Number(p.k), E.carnetOpCat(p, t));
    E.carnet(S).hop = (S.hdv && S.hdv.op) || 0;
  };
  /* 0.1.23.2 : les autres modules (js/vie.js) ajoutent leurs actions au bilan des kamas */
  E.carnetCat = (o) => Object.assign(ACT_CAT, o);

  const tick0 = E.tick;
  E.tick = (S, dtMs, realMs) => {
    if (!live(S)) return tick0(S, dtMs, realMs);
    const C = pre(S); tresorPending(S);
    const h0 = S.history[0], k0 = S.kamas, inDg = !!S.dungeon, inSg = !!S.exp;
    let r; depth++; try { r = tick0(S, dtMs, realMs); } finally { depth--; }
    const now = E.now(); let fk = 0, dg = inDg, sg = inSg; const v = { on: (realMs == null ? dtMs : realMs) / 1000, xp: 0, k: 0, f: 0, w: 0 };
    for (let i = 0; i < S.history.length && S.history[i] !== h0 && i < 30; i++) {
      const h = S.history[i]; v.xp += h.xp || 0; v.f++; v.w += h.w ? 1 : 0; v.k += h.k || 0; fk += h.k || 0;
      const isDg = typeof h.z === "string" && h.z.startsWith("dg:"); if (isDg) dg = true;
      if (h.x) sg = true; // 2.1.29.6 : combats du Songe infini (avant, comptés dans la Chasse)
      ledger(S, now, h.k || 0, h.x ? "expedition" : isDg ? "donjon" : "chasse");
    }
    add(S, now, v);
    const rest = S.kamas - k0 - fk - (C.tag || 0);
    if (rest) ledger(S, now, rest, rest > 0 ? (sg ? "expedition" : dg ? "donjon" : "quete") : "fm");
    C.kLast = S.kamas; C.tag = 0; C.hop = (S.hdv && S.hdv.op) || 0;
    return r;
  };
  const totXp = (S) => S.chars.reduce((s, c) => { let x = c.xp || 0; for (let l = 1; l < c.lvl; l++) x += E.heroXpNeed(c, l); if (c.mt && E.mtNeed) x += (E.mtXpTot ? E.mtXpTot(c.mt.lvl) : (c.mt.lvl || 0) * E.mtNeed()) + (c.mt.xp || 0); return s + x; }, 0); /* 2.0.3 : l'XP de Maîtrise compte dans l'XP/h */
  const catch0 = E.catchUpGen;
  E.catchUpGen = function* (S, seconds) {
    if (!live(S)) return yield* catch0(S, seconds);
    const C = pre(S); const x0 = totXp(S), k0 = S.kamas, ren0 = S.chars.map((c) => c.ren || 0).join();
    /* 1.0.7.7 : hors ligne, l'équipe suit aussi les indices du trésor (avant, elle restait dans la zone du premier indice) */
    const tc = S.tresor && S.tresor.cur; const follow = !!(tc && tc.follow && S.hunting && !S.dungeon);
    const roamOn = S.settings.roam, roamF = E.roam, moved = [];
    if (follow) { S.settings.roam = true; E.roam = (S2, ...a) => { const c = S2.tresor && S2.tresor.cur; if (c && c.move) { const was = S2.sub; tresorPending(S2); if (S2.sub !== was) { moved.push(SUBS[S2.sub].name); return true; } } return roamOn ? roamF(S2, ...a) : null; }; }
    let r; depth++; try { r = yield* catch0(S, seconds); } finally { depth--; if (follow) { S.settings.roam = roamOn; E.roam = roamF; } }
    if (r && moved.length) { r.roamed = []; r.tresor = moved; }
    if (r) {
      const now = E.now(), span = Math.min(r.seconds, NH * 3600) * 1000;
      const xp = ren0 === S.chars.map((c) => c.ren || 0).join() ? Math.max(0, totXp(S) - x0) : 0;
      const n = Math.max(1, Math.ceil(span / HOUR));
      for (let i = 0; i < n; i++) {
        const t = now - span + (i + 0.5) * span / n;
        add(S, t, { xp: xp / n, k: Math.max(0, r.kamas) / n, f: r.fights / n, w: r.wins / n, off: 1 });
      }
      const dk = S.kamas - k0 - (C.tag || 0);
      if (dk) ledger(S, now, dk, dk > 0 ? "chasse" : "fm");
    }
    C.kLast = S.kamas; C.tag = 0; C.hop = (S.hdv && S.hdv.op) || 0;
    return r;
  };
  /* actions du joueur : les kamas gagnés ou dépensés vont dans la bonne case du bilan */
  const wrapActions = () => Object.keys(E.ACTIONS).forEach((name) => {
    const f = E[name]; if (typeof f !== "function" || f.__carnet) return;
    const w = function (S, ...a) {
      if (depth || !live(S)) return f.call(this, S, ...a);
      depth++; pre(S); const k0 = S.kamas; let r;
      try { r = f.call(this, S, ...a); } finally { depth--; }
      const C = E.carnet(S); const dk = S.kamas - k0 - (C.tag || 0);
      if (dk) ledger(S, E.now(), dk, ACT_CAT[name] || "autre");
      C.kLast = S.kamas; C.tag = 0;
      return r;
    };
    w.__carnet = true; E[name] = w;
  });

  /* résumés pour la page */
  E.carnetSeries = (S, days, key) => {
    const C = E.carnet(S); const B = days <= 7 ? C.h : C.d; const n = days <= 7 ? NH : ND;
    const last = days <= 7 ? Math.floor(E.now() / HOUR) : dayOf(E.now());
    const out = [];
    for (let idx = last - n + 1; idx <= last; idx++) {
      const p = B.i0 == null ? -1 : idx - B.i0; const ok = p >= 0 && p < (B.xp || []).length;
      out.push({ idx, v: ok ? B[key][p] || 0 : 0, on: ok ? B.on[p] || 0 : 0, off: ok ? !!B.off[p] : false, xp: ok ? B.xp[p] : 0, f: ok ? B.f[p] : 0, w: ok ? B.w[p] : 0, k: ok ? B.k[p] : 0, lv: ok ? B.lv[p] : 0, has: ok });
    }
    return out;
  };
  E.carnetTotals = (S, days) => {
    const P = E.carnetSeries(S, days, "xp"); const hrs = days <= 7 ? 1 : 24;
    const act = P.filter((p) => p.f > 0);
    const T = { xp: 0, k: 0, f: 0, w: 0, on: 0, offH: 0, actH: 0 };
    P.forEach((p) => { T.xp += p.xp; T.k += p.k; T.f += p.f; T.w += p.w; T.on += p.on; if (p.off) T.offH += hrs; });
    T.actH = act.length * hrs; // heures où l'équipe a combattu
    T.xph = T.actH ? T.xp / T.actH : 0; T.kh = T.actH ? T.k / T.actH : 0; T.win = T.f ? T.w / T.f : 0;
    // évolution : seconde moitié de la période contre la première
    const half = Math.floor(P.length / 2); const rate = (arr) => { const a = arr.filter((p) => p.f > 0); return a.length ? a.reduce((s, p) => s + p.xp, 0) / a.length : 0; };
    const r1 = rate(P.slice(0, half)), r2 = rate(P.slice(half)); T.trend = r1 > 0 && r2 > 0 ? r2 / r1 - 1 : null;
    const rk1 = P.slice(0, half).filter((p) => p.f > 0), rk2 = P.slice(half).filter((p) => p.f > 0);
    const kr1 = rk1.length ? rk1.reduce((s, p) => s + p.k, 0) / rk1.length : 0, kr2 = rk2.length ? rk2.reduce((s, p) => s + p.k, 0) / rk2.length : 0; T.ktrend = kr1 > 0 && kr2 > 0 ? kr2 / kr1 - 1 : null;
    return T;
  };
  E.carnetLedger = (S, days) => {
    const C = E.carnet(S); const today = dayOf(E.now()); const inn = {}, out = {};
    (C.L.days || []).forEach((o, p) => { if (!o || C.L.i0 + p <= today - days) return; for (const key in o) { const tgt = key[0] === "+" ? inn : out; const c = key.slice(1); tgt[c] = (tgt[c] || 0) + o[key]; } });
    const sort = (o, names) => Object.keys(o).map((k) => ({ k, name: names[k] || k, v: o[k] })).sort((a, b) => b.v - a.v);
    return { inn: sort(inn, E.CARNET_IN), out: sort(out, E.CARNET_OUT) };
  };
  /* meilleures zones (rendement mesuré par le jeu sur toutes les victoires) */
  E.carnetZones = (S, n = 5) => Object.keys(S.zoneStats || {}).map((z) => {
    const st = S.zoneStats[z]; if (!st || st.f < 10 || st.s <= 0) return null;
    const dg = z.startsWith("dg:"); const name = dg ? (DUNGEONS[z.slice(3)] || {}).name : (SUBS[z] || {}).name; if (!name) return null;
    return { z, name, dg, xph: st.xp / st.s * 3600, kh: st.k / st.s * 3600, win: st.w / st.f, f: st.f };
  }).filter(Boolean).sort((a, b) => b.xph - a.xph).slice(0, n);
  /* résumé de la semaine envoyé au serveur ou copié (petit, sans pseudo) */
  E.carnetSummary = (S) => {
    const T = E.carnetTotals(S, 7), L = E.carnetLedger(S, 7);
    const top = Math.max(...S.chars.map((c) => c.lvl));
    return {
      lvl: top, team: E.team(S).length, ren: S.chars.reduce((s, c) => s + (c.ren || 0), 0), mt: E.mtAcct ? E.mtAcct(S) : 0,
      xph: Math.round(T.xph), kh: Math.round(T.kh), f: Math.round(T.f), win: Math.round(T.win * 100), h: Math.round(T.actH), offH: T.offH,
      inn: L.inn.slice(0, 6).map((x) => [x.k, x.v]), out: L.out.slice(0, 6).map((x) => [x.k, x.v]),
      zones: E.carnetZones(S, 3).map((z) => [z.name, Math.round(z.xph), Math.round(z.kh), Math.round(z.win * 100)]),
    };
  };

  /* ======================= CHASSE AU TRÉSOR ======================= */
  E.TRESOR_DROP = 1 / 300;  // un parchemin environ toutes les 300 victoires en chasse
  E.TRESOR_STOCK = 3;       // parchemins gardés en réserve au plus
  E.TRESOR_NEED = 6;        // victoires dans la zone pour trouver un repère
  E.TRESOR_TITLE = "Chasseur de trésors";
  E.tresorSteps = (lvl) => (lvl < 60 ? 3 : lvl < 140 ? 4 : 5);
  const MARKS = {
    meadow: ["un épouvantail sans tête", "un rocher en forme de Bouftou", "un vieux puits couvert de lierre", "une charrette renversée", "un panneau indicateur effacé"],
    forest: ["un arbre creux marqué d'une croix", "une souche couverte de champignons", "une cabane de bûcheron abandonnée", "un nid de Tofus vide"],
    lake: ["une barque échouée", "un ponton vermoulu", "une bouteille à moitié enterrée"],
    beach: ["un coquillage géant à moitié enfoui", "une ancre rouillée", "un coffre de pirate vide"],
    grave: ["une pierre tombale fleurie", "une croix penchée", "un caveau entrouvert"],
    city: ["une fontaine tarie", "une statue de héros sans tête", "une enseigne de taverne tombée"],
    cave: ["une stalagmite brisée", "des runes gravées dans la roche", "une lanterne éteinte"],
    mine: ["un wagonnet renversé", "une pioche plantée dans la roche", "un filon doré à moitié creusé"],
    wheat: ["une meule de foin dorée", "un moulin à l'arrêt", "un épi trois fois plus grand que les autres"],
    spirit: ["une flamme qui ne brûle pas", "une plume qui flotte toute seule"],
    sky: ["un nuage en forme de Dofus", "une plume géante plantée au sol"],
    quarry: ["un bloc taillé en cube parfait", "un échafaudage écroulé"],
    sewer: ["une grille rouillée", "un rat sculpté dans la pierre"],
  };
  E.tresorState = (S) => { if (!S.tresor) S.tresor = { stock: [], day: null, n: 0, cur: null }; if (!Array.isArray(S.tresor.stock)) S.tresor.stock = []; return S.tresor; };
  /* 0.1.49 : trois tailles de chasse. Un parchemin est un niveau (normale) ou { l, k: "court" | "leg" } */
  E.TRESOR_SIZES = { court: { name: "Courte", steps: 3, mult: 0.6 }, norm: { name: "Normale", mult: 1 }, leg: { name: "Légendaire", steps: 8, mult: 3.2 } };
  E.tresorP = (x) => (x && typeof x === "object" ? { l: clamp(+x.l || 1, 1, 200), k: E.TRESOR_SIZES[x.k] ? x.k : "norm" } : { l: clamp(+x || 1, 1, 200), k: "norm" });
  E.tresorStepsOf = (p) => { p = E.tresorP(p); return E.TRESOR_SIZES[p.k].steps || E.tresorSteps(p.l); };
  E.tresorLegOk = (S) => E.tresorState(S).legW !== (E.weekOf ? E.weekOf() : 0);
  const subMid = (s) => Math.round((s.lvl[0] + s.lvl[1]) / 2);
  const pick = (arr) => arr[Math.floor(E.rnd() * arr.length)];
  const topLvl = (S) => { const t = E.team(S); return Math.max(...(t.length ? t : S.chars).map((c) => c.lvl)); };
  /* parchemin du jour, gratuit */
  E.tresorFreeOk = (S) => E.tresorState(S).day !== dayOf(E.now());
  E.tresorClaim = (S) => {
    const T = E.tresorState(S);
    if (!E.tresorFreeOk(S)) return "Le parchemin du jour est déjà pris. Reviens demain.";
    if (normCount(T) >= E.TRESOR_STOCK) return `Tu as déjà ${E.TRESOR_STOCK} parchemins en réserve.`;
    T.day = dayOf(E.now()); T.stock.push({ l: clamp(topLvl(S), 1, 200), k: "court" });
    return null;
  };
  /* parchemin légendaire : un par semaine, à partir du niveau 50 (il ne prend pas de place dans la réserve) */
  E.tresorLegClaim = (S) => {
    const T = E.tresorState(S);
    if (topLvl(S) < 50) return "Le parchemin légendaire s'ouvre au niveau 50.";
    if (!E.tresorLegOk(S)) return "Le parchemin légendaire de la semaine est déjà pris. Il revient lundi.";
    T.legW = E.weekOf ? E.weekOf() : 0; T.stock.push({ l: clamp(topLvl(S), 1, 200), k: "leg" });
    return null;
  };
  const normCount = (T) => T.stock.filter((x) => E.tresorP(x).k !== "leg").length;
  const candSubs = (S, lvl, lo, hi) => Object.values(SUBS).filter((s) => !s.hidden && E.subUnlocked(S, s.id) && s.lvl[1] >= lvl - lo && s.lvl[0] <= lvl + hi && (s.monsters || []).some((m) => MONSTERS[m] && !MONSTERS[m].boss));
  E.tresorStart = (S, which = 0) => {
    const T = E.tresorState(S);
    if (T.cur) return "Une chasse au trésor est déjà en cours.";
    if (!T.stock.length) return "Aucun parchemin de chasse.";
    if (!E.team(S).length) return "Votre équipe est vide.";
    const i = clamp(Math.floor(+which) || 0, 0, T.stock.length - 1);
    const P = E.tresorP(T.stock[i]);
    const lvl = Math.min(P.l, topLvl(S) + 10); // jamais une chasse hors de portée de l'équipe
    const n = E.TRESOR_SIZES[P.k].steps || E.tresorSteps(lvl);
    let pool = candSubs(S, lvl, 12, 5); if (pool.length < n) pool = candSubs(S, lvl, 30, 8); if (!pool.length) pool = candSubs(S, topLvl(S), 200, 0);
    if (!pool.length) return "Aucune zone disponible pour cette chasse.";
    const steps = []; let prev = S.sub;
    for (let k = 0; k < n; k++) {
      const fresh = pool.filter((s) => s.id !== prev && !steps.some((x) => x.sub === s.id));
      const s = pick(fresh.length ? fresh : pool.filter((x) => x.id !== prev).length ? pool.filter((x) => x.id !== prev) : pool);
      const all = MARKS[s.deco] || MARKS.meadow; const left = all.filter((m) => !steps.some((x) => x.mark === m));
      const st = { sub: s.id, mark: pick(left.length ? left : all), got: 0 };
      // 0.1.49 : nouveaux indices (le premier reste toujours un repère à trouver)
      const r = E.rnd(); const mons = (s.monsters || []).filter((m) => MONSTERS[m] && !MONSTERS[m].boss && !MONSTERS[m].archiOf);
      const drops = mons.flatMap((m) => (MONSTERS[m].drops || []).map((d) => d[0])).filter((x) => !E.isKey(x));
      if (k > 0 && r < 0.22 && mons.length) { st.t = "mon"; st.mon = pick(mons); st.n = 3; }
      else if (k > 0 && r < 0.38 && drops.length) { st.t = "res"; st.res = pick(drops); st.n = 5; st.have = 0; }
      else if (k > 0 && r < 0.52) { st.t = "enig"; }
      steps.push(st); prev = s.id;
    }
    if (P.k === "leg") { // un indice de donjon au milieu de la chasse légendaire
      const dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= lvl + 5 && DUNGEONS[d].lvl >= lvl - 30);
      if (dgs.length) steps.splice(4, 0, { t: "dg", dg: pick(dgs), sub: steps[3].sub, got: 0, mark: "une salle secrète au fond du donjon" });
    }
    T.stock.splice(i, 1);
    T.cur = { lvl, k: P.k, steps, i: 0, from: S.hunting && !S.dungeon ? S.sub : null, follow: true, ready: false, go: false, fighting: false, t: E.now(), move: true }; // 1.0.7.7 : lancée en donjon, l'équipe part vers l'indice à la sortie
    E.note(S, `Chasse au trésor${P.k === "leg" ? " légendaire" : ""} : premier indice vers ${SUBS[steps[0].sub].name}.`, "up");
    tresorPending(S);
    return null;
  };
  E.tresorStep = (S) => { const c = S.tresor && S.tresor.cur; return c && !c.ready ? c.steps[c.i] : null; };
  /* l'équipe va chasser là où mène l'indice (ou vers le gardien) */
  E.tresorGo = (S) => {
    const c = S.tresor && S.tresor.cur; if (!c) return "Aucune chasse au trésor.";
    if (S.dungeon) return "Quittez d'abord le donjon.";
    c.follow = true; c.move = true; if (c.ready) c.go = true;
    tresorPending(S); return null;
  };
  E.tresorFight = (S) => {
    const c = S.tresor && S.tresor.cur; if (!c || !c.ready) return "Le gardien n'est pas encore là.";
    if (S.dungeon) return "Quittez d'abord le donjon.";
    c.go = true; c.follow = true; c.move = true; tresorPending(S); return null;
  };
  E.tresorQuit = (S) => { const T = E.tresorState(S); if (!T.cur) return "Aucune chasse au trésor."; T.cur = null; E.note(S, "Chasse au trésor abandonnée.", "warn"); return null; };
  const targetSub = (c) => { const st = c.ready ? c.steps[c.steps.length - 1] : c.steps[c.i]; if (!c.ready && st.t === "dg") { const p = c.steps[c.i - 1] || c.steps[c.i + 1] || st; return p.sub; } return st.sub; };
  /* déplacement demandé (au prochain instant de jeu, jamais au milieu d'un combat) */
  function tresorPending(S) {
    const T = S.tresor; if (!T) return;
    if (T.back) { const b = T.back; T.back = null; if (!S.dungeon && SUBS[b] && E.subUnlocked(S, b) && S.sub !== b) E.startHunt(S, b); }
    const c = T.cur; if (!c) return;
    if (!c.ready && c.steps[c.i] && c.steps[c.i].t === "dg" && !S.dungeon) dgKey(S, c.steps[c.i]); // aussi pour les parties déjà bloquées, ou après un donjon perdu
    if (c.fighting && !(S.fight && S.fight.tresor && !S.fight.over)) { c.fighting = false; if (c.follow) c.go = true; } // combat interrompu : le gardien attend
    if (!c.move || S.dungeon) return;
    c.move = false;
    const sid = targetSub(c);
    if (S.sub !== sid || !S.hunting) { const err = E.startHunt(S, sid); if (err) E.note(S, `Chasse au trésor : ${err}`, "warn"); }
  }
  E.tresorPending = (S) => tresorPending(S);
  E.tresorHold = (S) => { const c = S.tresor && S.tresor.cur; return !!(c && c.follow && S.sub === targetSub(c)); };
  /* le gardien remplace le prochain groupe de la zone (même mécanique que les protecteurs) */
  const prot0 = E.protGroup;
  E.protGroup = (S, sub, team, monsterEntity) => {
    const c = S.tresor && S.tresor.cur;
    if (!(c && c.ready && c.go && !S.dungeon)) return prot0(S, sub, team, monsterEntity);
    const last = SUBS[targetSub(c)] || sub;
    const pool = (last.monsters || []).filter((m) => MONSTERS[m] && !MONSTERS[m].boss && !MONSTERS[m].archiOf); if (!pool.length) return prot0(S, sub, team, monsterEntity);
    const lvl = Math.round(clamp(c.lvl + 5, 1, 200)); // un boss du niveau du parchemin
    const g = monsterEntity(pick(pool), lvl); g.name = `${g.name} gardien du trésor`;
    const z = E.foeSize ? E.foeSize(team.length, lvl) : { hp: 1, dmg: 1 }; /* 1.0.1 : même difficulté seul ou en équipe */ g.hpMax = g.hp = Math.round(g.hpMax * (1.8 + team.length * 0.7) * z.hp); g.dmg *= (team.length > 1 ? 1.35 : 1.15) * z.dmg; g.attacks = team.length > 1 ? 2 : 1; g.ini += 80;
    if (c.k === "leg") { g.hpMax = g.hp = Math.round(g.hpMax * 1.6); g.dmg *= 1.25; g.name = g.name.replace("gardien du trésor", "gardien légendaire"); } // 0.1.49 : gardien d'élite
    const mons = [g].concat(E.makeGroup(S, last, team.length).slice(0, Math.max(0, team.length - 1)));
    c.go = false; c.fighting = true; c.need = true;
    return { mons, label: `Gardien du trésor · ${last.name}` };
  };
  const start0 = E.startFight;
  if (typeof start0 === "function") E.startFight = function (S, ...a) {
    const r = start0.call(this, S, ...a);
    const c = S && S.tresor && S.tresor.cur;
    if (c && c.need && S.fight) { S.fight.tresor = true; c.need = false; }
    return r;
  };
  /* fin de combat : le gardien est-il tombé ? (autoZone est appelé après chaque combat de chasse) */
  const az0 = E.autoZone;
  E.autoZone = (S, win) => {
    const c = S && S.tresor && S.tresor.cur;
    if (c && c.fighting && S.fight && S.fight.tresor) { c.fighting = false; guardEnd(S, win); }
    if (E.tresorHold(S)) return; // 10A : le trésor passe avant la chasse automatique
    return az0(S, win);
  };
  const roam0 = E.roam;
  E.roam = (S, ...a) => (E.tresorHold(S) ? null : roam0(S, ...a));
  E.tresorChest = (lvl, n, k) => { const m = (E.TRESOR_SIZES[k] || E.TRESOR_SIZES.norm).mult; const nn = k === "court" ? 4 : k === "leg" ? 4 : n; return { kamas: Math.round((lvl * 170 * (nn / 4) + 300) * m), dust: Math.round((2 + nn) * m), res: k === "leg" ? 4 : 2, key: true }; };
  function guardEnd(S, win) {
    const T = E.tresorState(S), c = T.cur;
    if (!win) { c.lost = (c.lost || 0) + 1; c.follow = false; E.note(S, "Le gardien du trésor l'emporte. Renforce l'équipe et réessaie depuis la page Trésor.", "warn"); return; }
    const lvl = c.lvl, n = c.steps.length, ch = E.tresorChest(lvl, n, c.k); const got = [];
    S.kamas += ch.kamas; tag(S, ch.kamas, "tresor"); got.push(`${ch.kamas} kamas`);
    E.addRes(S, "Poussière de stasis", ch.dust); got.push(`${ch.dust} poussière de stasis`);
    const drops = []; c.steps.forEach((st) => (SUBS[st.sub].monsters || []).forEach((m) => (MONSTERS[m] && MONSTERS[m].drops || []).forEach(([r]) => { if (!E.isKey(r)) drops.push(r); })));
    for (let i = 0; i < ch.res && drops.length; i++) { const r = pick(drops), q = 3 + Math.floor(E.rnd() * 4); E.addRes(S, r, q); got.push(`${q} ${r}`); }
    const dg = Object.keys(DUNGEONS).filter((d) => DUNGEONS[d].key && DUNGEONS[d].lvl <= lvl + 5 && E.dungeonUnlocked(S, d)).sort((a, b) => DUNGEONS[b].lvl - DUNGEONS[a].lvl)[0];
    if (dg) { E.addRes(S, DUNGEONS[dg].key, 1); got.push(DUNGEONS[dg].key); }
    { const cid = c.k === "leg" ? "coffre_or" : c.k === "court" ? "coffre_bois" : n >= 5 ? "coffre_argent" : "coffre_bois"; E.addCons(S, cid); got.push(D.CONSUMABLES[cid].name); } // 0.1.30
    if (E.rnd() < 0.1 && normCount(T) < E.TRESOR_STOCK) { T.stock.push(lvl); got.push("un nouveau parchemin de chasse"); }
    T.n = (T.n || 0) + 1; if (c.k === "leg") T.leg = (T.leg || 0) + 1; T.last = { t: E.now(), lvl, n, got, k: c.k || "norm" };
    if (E.wkTresor) E.wkTresor(S);
    if (T.n >= 50 && S.unlocks && !S.unlocks.boussole) S.unlocks.boussole = 1;
    E.note(S, `Trésor trouvé ! Coffre au trésor : ${got.join(", ")}.`, "rare");
    E.celebrate({ t: "tresor", got, n: T.n });
    E.carnetMoment(S, "tresor", `Trésor trouvé (parchemin niveau ${lvl})`);
    T.back = c.from && c.from !== S.sub ? c.from : null; // l'équipe retourne là où elle chassait
    T.cur = null;
    if (E.checkAch) E.checkAch(S);
  }

  /* ======================= événements du moteur ======================= */
  const NAME = (S, cid) => { const c = S.chars.find((x) => x.id === cid); return c ? c.name : "Un héros"; };
  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const emit0 = E.emit;
  E.emit = (S, type, data) => {
    if (emit0) emit0(S, type, data);
    if (!live(S) || !data) return;
    try { onEvent(S, type, data); } catch (e) { /* le carnet ne doit jamais casser une partie */ }
  };
  /* indices : repère (6 victoires), monstre précis (3), ressource à rapporter (5), énigme (la zone n'est pas nommée), salle de donjon */
  function clueHit(S, st, data) {
    if (st.t === "mon") { st.got += (data.mons || []).filter((m) => m.key === st.mon).length; return st.got >= st.n; }
    if (st.t === "res") { st.got++; if ((S.res[st.res] || 0) >= st.n) { S.res[st.res] -= st.n; if (!S.res[st.res]) delete S.res[st.res]; return true; } return st.got >= E.TRESOR_NEED * 3; }
    if (st.t === "dg") return false;
    return ++st.got >= E.TRESOR_NEED;
  }
  function clueDone(st) {
    if (st.t === "mon") return `Indice résolu : ${MONSTERS[st.mon].name} vaincu ${st.n} fois`;
    if (st.t === "res") return `Indice résolu : ${st.res} rapporté`;
    if (st.t === "dg") return "Indice résolu : la salle secrète du donjon est trouvée";
    if (st.t === "enig") return `Énigme résolue : ${st.mark}`;
    return `Repère trouvé : ${st.mark}`;
  }
  E.tresorClueTxt = (st) => {
    if (!st) return "";
    if (st.t === "mon") return `Vaincre ${st.n} × ${MONSTERS[st.mon].name} dans ${SUBS[st.sub].name}`;
    if (st.t === "res") return `Rapporter ${st.n} × ${st.res} (on en trouve dans ${SUBS[st.sub].name})`;
    if (st.t === "dg") return `Trouver la salle secrète de ${DUNGEONS[st.dg].name}`;
    if (st.t === "enig") { const z = (D.ZONES || []).find((x) => x.subs.some((y) => y.id === st.sub)); return `Énigme : « Cherche ${st.mark} quelque part en ${z ? z.name : "Monde des Douze"}… » (l'équipe suit la piste : ${SUBS[st.sub].name})`; }
    return `Trouver ${st.mark} dans ${SUBS[st.sub].name}`;
  };
  /* 1.0.7.7 : l'indice de donjon fournit sa clé tant qu'il n'est pas résolu (avant, sans clé, la chasse légendaire restait bloquée) */
  function dgKey(S, st) {
    const k = DUNGEONS[st.dg] && DUNGEONS[st.dg].key; if (!k || (S.res[k] || 0) >= 1) return;
    E.addRes(S, k, 1); E.note(S, `Le parchemin cachait une clé : ${k}.`, "rare");
  }
  function nextClue(S, c) {
    c.i++;
    if (c.i >= c.steps.length) { c.ready = true; E.note(S, "Le gardien du trésor t'attend !", "rare"); if (c.follow) { c.go = true; c.move = true; } }
    else { const n = c.steps[c.i]; E.note(S, n.t === "dg" ? `Indice suivant : ${DUNGEONS[n.dg].name} (termine ce donjon).` : `Indice suivant : ${SUBS[n.sub].name}.`, "up"); if (c.follow) c.move = true; if (n.t === "dg" && !S.dungeon) dgKey(S, n); }
  }
  function onEvent(S, type, data) {
    if (type === "win" && data.sub && !data.dungeon) {
      const T = E.tresorState(S), c = T.cur;
      if (c && !c.ready) {
        const st = c.steps[c.i];
        if (st && st.sub === data.sub && clueHit(S, st, data)) {
          E.note(S, `${clueDone(st)} (${SUBS[st.sub].name}).`, "up");
          nextClue(S, c);
        }
      }
      if (normCount(T) < E.TRESOR_STOCK && SUBS[data.sub] && E.rnd() < E.TRESOR_DROP) { T.stock.push(subMid(SUBS[data.sub])); E.note(S, `Parchemin de chasse trouvé (niveau ${subMid(SUBS[data.sub])}) !`, "rare"); }
      return;
    }
    if (type === "level" && (data.lvl % 10 === 0 || data.lvl === 200)) E.carnetMoment(S, "level", `${NAME(S, data.cid)} atteint le niveau ${data.lvl}`);
    else if (type === "ren") E.carnetMoment(S, "ren", `${NAME(S, data.cid)} renaît (Renaissance ${ROMAN[data.n] || data.n})`);
    else if (type === "dofus" && data.first) E.carnetMoment(S, "dofus", `${(E.DOFUS && E.DOFUS[data.id] || {}).name || "Dofus"} obtenu`);
    else if (type === "soul") E.carnetMoment(S, "soul", `Âme capturée : ${((E.ARCHIS && E.ARCHIS[data.key]) || MONSTERS[data.key] || {}).name || "archimonstre"}`);
    else if (type === "dungeon" && data.id && DUNGEONS[data.id]) {
      const tc = S.tresor && S.tresor.cur; const ts = tc && !tc.ready && tc.steps[tc.i];
      if (ts && ts.t === "dg" && ts.dg === data.id) { E.note(S, `${clueDone(ts)} (${DUNGEONS[data.id].name}).`, "up"); nextClue(S, tc); }
      const C = E.carnet(S); const k = data.stasis || 1;
      if (k > (C.sk[data.id] || 0)) { C.sk[data.id] = k; E.carnetMoment(S, "stasis", `${DUNGEONS[data.id].name} : stasis ${k} réussie`); }
    }
  }

  /* ======================= actions, succès, ornement ======================= */
  Object.assign(E.ACTIONS, { tresorClaim: "prendre le parchemin de chasse du jour", tresorStart: "ouvrir un parchemin de chasse", tresorGo: "suivre l'indice", tresorFight: "affronter le gardien du trésor", tresorQuit: "abandonner la chasse au trésor", tresorLegClaim: "prendre le parchemin légendaire de la semaine" });
  wrapActions();
  E.carnetWrap = wrapActions;
  if (E.ACH) {
    const has = (id) => E.ACH.some((a) => a.id === id);
    const addA = (o) => { if (!has(o.id)) E.ACH.push(o); };
    addA({ id: "tresor1", cat: "Exploration", name: "Premier trésor", desc: "Trouver un trésor au bout d'une chasse.", test: (S) => (S.tresor && S.tresor.n || 0) >= 1, kamas: 2000 });
    addA({ id: "tresor10", cat: "Exploration", name: "Chasseur de trésors", desc: "Trouver 10 trésors.", test: (S) => (S.tresor && S.tresor.n || 0) >= 10, kamas: 15000, title: E.TRESOR_TITLE });
    addA({ id: "tresor50", cat: "Exploration", name: "Boussole dorée", desc: "Trouver 50 trésors (ornement « Boussole dorée »).", test: (S) => (S.tresor && S.tresor.n || 0) >= 50, kamas: 60000 });
  }
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "carnet")) E.SEARCH_PAGES.push(["carnet", "Carnet de bord", "Journal › Carnet : courbes, kamas"], ["tresor", "Chasse au trésor", "Journal › Quêtes › Chasses › Trésor : parchemins courts, normaux, légendaires"]);
  if (E.ORN && !E.ORN.boussole) E.ORN.boussole = { name: () => "Boussole dorée", req: "Trouver 50 trésors", ok: (S) => !!(S.unlocks && S.unlocks.boussole) };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
