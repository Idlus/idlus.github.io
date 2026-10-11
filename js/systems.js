/* ============================================================================
   SYSTÈMES v2.6 — Idlus
   Havre-Sac, Forgemagie, Almanax, Alignement (Bonta / Brâkmar), Quêtes,
   Avis de recherche, Succès, Ornements, cadres de carte de héros.
   Logique pure (pas de DOM), branchée sur le moteur via E.bonus / E.emit.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const { STATS, MONSTERS, DUNGEONS, ITEMS, RES, CLASSES } = D;
  const SUBS = E.SUBS;
  const rnd = () => Math.random();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const topLvl = (S) => Math.max(...S.chars.map((c) => c.lvl));
  const note = (S, t, k) => E.note(S, t, k);
  const giveTeamXp = (S, pctOfLevel) => {
    const list = E.team(S).length ? E.team(S) : S.chars;
    list.forEach((c) => E.giveXp(S, c, Math.round(E.xpNeed(c.lvl) * pctOfLevel)));
  };

  /* ---------------- Havre-Sac : améliorations permanentes payées en kamas ---------------- */
  const HAVRE = [
    { id: "xp",      name: "Bibliothèque",          icon: "📚", per: 2,  max: 50, base: 300,  g: 1.5, unit: "% d'expérience" },
    { id: "drop",    name: "Salle des trophées",    icon: "🏺", per: 2,  max: 50, base: 400,  g: 1.5, unit: "% de butin" },
    { id: "kamas",   name: "Coffre-fort",           icon: "💰", per: 3,  max: 40, base: 250,  g: 1.5, unit: "% de kamas" },
    { id: "hp",      name: "Salle d'entraînement",  icon: "🥊", per: 1,  max: 30, base: 600,  g: 1.45, unit: "% de PV en combat" },
    { id: "gather",  name: "Jardin",                icon: "🌿", per: 4,  max: 30, base: 300,  g: 1.5, unit: "% de vitesse de récolte" },
    { id: "bag",     name: "Grenier",               icon: "🎒", per: 25, max: 20, base: 500,  g: 1.5,  unit: " places dans le sac" },
    { id: "offtime", name: "Lit douillet",          icon: "🛏", per: 1,  max: 8,  base: 2000, g: 1.9,  unit: " h de progression hors ligne (8 h de base)" },
    { id: "offrate", name: "Majordome",             icon: "🎩", per: 5,  max: 7,  base: 2500, g: 1.9,  unit: " % d'efficacité hors ligne (25 % de base)" },
  ];
  E.HAVRE = HAVRE;
  E.havreLvl = (S, id) => (S.havre && S.havre[id]) || 0;
  E.havreCost = (S, id) => { const H = HAVRE.find((x) => x.id === id); return Math.round(H.base * Math.pow(H.g, E.havreLvl(S, id))); };
  E.havreTotal = (S) => Object.values(S.havre || {}).reduce((a, b) => a + b, 0);
  E.buyHavre = (S, id) => {
    const H = HAVRE.find((x) => x.id === id); if (!H) return "Amélioration inconnue.";
    const l = E.havreLvl(S, id); if (l >= H.max) return "Niveau maximum atteint.";
    const cost = E.havreCost(S, id); if (S.kamas < cost) return `Il faut ${cost.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= cost; S.havre[id] = l + 1; E.emit(S, "havre", { id }); return null;
  };

  /* ---------------- Almanax : une offrande par jour, un bonus pour la journée ---------------- */
  const ALM_BONUS = [
    { kind: "xp", pct: 15, name: "+15 % d'expérience" },
    { kind: "drop", pct: 15, name: "+15 % de butin" },
    { kind: "kamas", pct: 20, name: "+20 % de kamas" },
    { kind: "gather", pct: 25, name: "+25 % de vitesse de récolte" },
  ];
  const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  E.dayKey = dayKey;
  const hashStr = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; };
  const ALM_POOL = (() => {
    const m = new Map();
    Object.values(MONSTERS).forEach((mo) => { if (mo.boss || mo.archiOf) return; mo.drops.forEach(([r, p]) => { if (p >= 5 && !E.isKey(r)) m.set(r, Math.min(m.get(r) || 999, mo.lvl[0])); }); });
    return [...m.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  })();
  E.almanax = (S, t = Date.now()) => {
    const day = dayKey(t); const top = topLvl(S);
    const pool = ALM_POOL.filter(([, l]) => l <= Math.max(8, top + 2));
    const h1 = hashStr("alm" + day), h2 = hashStr("bonus" + day);
    const [res, lvl] = pool[Math.floor(h1 * pool.length)] || ALM_POOL[0];
    const qty = 4 + Math.floor(hashStr("q" + day) * 6) + Math.floor(lvl / 10);
    const bonus = ALM_BONUS[Math.floor(h2 * ALM_BONUS.length)];
    const done = S.almanax && S.almanax.day === day;
    return { day, res, qty, bonus, done, kamas: 100 + top * 20 };
  };
  E.almanaxOffer = (S) => {
    const A = E.almanax(S); if (A.done) return "Offrande déjà faite aujourd'hui.";
    if ((S.res[A.res] || 0) < A.qty) return `Il faut ${A.qty} × ${A.res}.`;
    S.res[A.res] -= A.qty; if (!S.res[A.res]) delete S.res[A.res];
    S.almanax = { day: A.day, kind: A.bonus.kind, pct: A.bonus.pct };
    S.kamas += A.kamas; S.cnt.almanax = (S.cnt.almanax || 0) + 1;
    note(S, `Offrande à l'Almanax acceptée : ${A.bonus.name} jusqu'à minuit.`, "rare");
    // série de jours consécutifs (un jour manqué fait redescendre d'un palier)
    const st = S.almStreak; const yest = dayKey(Date.now() - 864e5);
    if (st.last === yest) st.n++;
    else if (!st.last) st.n = 1;
    else { const lower = E.ALM_TIERS.filter((x) => x < st.n).pop() || 0; st.n = lower + 1; }
    st.last = A.day;
    const R = E.ALM_TIERS_R[st.n] || (st.n > 30 && st.n % 30 === 0 ? { cons: "coffre_or" } : null);
    if (R) {
      let txt = "";
      if (R.lot) txt = resLot(S, 3, 5, 10).join(", ");
      if (R.cons) { E.addCons(S, R.cons); txt = D.CONSUMABLES[R.cons].name; }
      if (R.furn && !S.furniture.includes(R.furn)) { S.furniture.push(R.furn); txt = `meuble « ${R.furn} »`; }
      if (R.title) { if (!S.titlesExtra.includes(R.title)) S.titlesExtra.push(R.title); S.unlocks.almanax = 1; txt = `titre « ${R.title} » et ornement de l'Almanax`; }
      note(S, `Série d'Almanax : ${st.n} jours ! Récompense : ${txt}.`, "rare");
    }
    E.emit(S, "almanax", {}); return null;
  };
  E.ALM_TIERS = [3, 7, 14, 30];
  E.ALM_TIERS_R = { 3: { lot: 1 }, 7: { cons: "coffre_argent" }, 14: { furn: "Calendrier de l'Almanax" }, 30: { title: "Fidèle de l'Almanax" } };
  const almBonus = (S, kind) => (S.almanax && S.almanax.day === dayKey() && S.almanax.kind === kind ? S.almanax.pct : 0);

  /* ---------------- Alignement : Bonta ou Brâkmar ---------------- */
  const ALIGN = {
    bonta: { name: "Bonta", adj: "Bontarien", badge: 24049, color: "#4f8fe0", bonusName: "PV",
      orders: { coeur: { name: "Cœur Vaillant", ranks: ["Disciple de Menalt", "Écuyer", "Chevalier de l'Espoir", "Champion Merveilleux", "Héros Légendaire"] },
                esprit: { name: "Esprit Salvateur", ranks: ["Disciple de Jiva", "Apprenti Éclairé", "Adepte des Écrits", "Maître des Parchemins", "Gardien du Savoir"] },
                oeil: { name: "Œil Attentif", ranks: ["Disciple de Silvosse", "Espion Silencieux", "Chasseur de Renégats", "Assassin Suprême", "Maître des Illusions"] } } },
    brakmar: { name: "Brâkmar", adj: "Brâkmarien", badge: 24076, color: "#e0573a", bonusName: "dégâts",
      orders: { coeur: { name: "Cœur Saignant", ranks: ["Disciple de Djaul", "Surineur", "Chevalier du Désespoir", "Champion du Chaos", "Héros de l'Apocalypse"] },
                esprit: { name: "Esprit Malsain", ranks: ["Disciple d'Hécate", "Apprenti Sombre", "Adepte des Douleurs", "Maître des Sévices", "Gardien des Tortures"] },
                oeil: { name: "Œil Putride", ranks: ["Disciple de Brumaire", "Espion Sombre", "Chasseur d'Âmes", "Psychopathe", "Maître des Ombres"] } } },
  };
  const ORDER_BONUS = { coeur: { kind: "dmg", per: 1, txt: "+1 % de dégâts par rang" }, esprit: { kind: "xp", per: 3, txt: "+3 % d'expérience par rang" }, oeil: { kind: "drop", per: 3, txt: "+3 % de butin par rang" } };
  E.ALIGN = ALIGN; E.ORDER_BONUS = ORDER_BONUS;
  E.ALIGN_MIN_LVL = 30;
  E.alignNeed = (l) => 60 + 12 * l;
  E.alignLvl = (S) => (S.align ? S.align.lvl || 0 : 0);
  E.alignRankIdx = (S) => Math.min(5, Math.floor(E.alignLvl(S) / 20)); // 0 = Néophyte
  E.alignRankName = (S) => { const A = S.align; if (!A) return ""; const i = E.alignRankIdx(S); return i ? ALIGN[A.side].orders[A.order].ranks[i - 1] : "Néophyte"; };
  E.chooseAlign = (S, side, order) => {
    if (topLvl(S) < E.ALIGN_MIN_LVL) return `Niveau ${E.ALIGN_MIN_LVL} requis.`;
    if (!ALIGN[side] || !ALIGN[side].orders[order]) return "Choix invalide.";
    if (S.align && S.align.side === side) { S.align.order = order; note(S, `Vous rejoignez l'ordre ${ALIGN[side].orders[order].name}.`, "info"); return null; }
    const lost = S.align ? " (votre ancien alignement est perdu)" : "";
    S.align = { side, order, lvl: 0, xp: 0 }; S.alignQuest = null; newAlignQuest(S);
    note(S, `Vous êtes désormais ${ALIGN[side].adj}, ordre ${ALIGN[side].orders[order].name}${lost}.`, "rare");
    E.emit(S, "align", {}); return null;
  };
  E.giveAlignXp = (S, x) => {
    const A = S.align; if (!A) return; A.xp += x; const before = E.alignRankIdx(S);
    while (A.lvl < 100 && A.xp >= E.alignNeed(A.lvl)) { A.xp -= E.alignNeed(A.lvl); A.lvl++; }
    if (A.lvl >= 100) A.xp = 0;
    const after = E.alignRankIdx(S);
    if (after > before) { note(S, `Nouveau rang d'alignement : ${E.alignRankName(S)} !`, "rare"); E.emit(S, "alignrank", { rank: after }); }
  };
  const alignBonus = (S, kind) => {
    const A = S.align; if (!A) return 0; const r = E.alignRankIdx(S); let b = 0;
    if (kind === "hp" && A.side === "bonta") b += 2 * r;
    if (kind === "dmg" && A.side === "brakmar") b += 2 * r;
    const ob = ORDER_BONUS[A.order]; if (ob && ob.kind === kind) b += ob.per * r;
    return b;
  };

  /* ---------------- Bonus combinés ---------------- */
  E.bonus = (S, kind) => {
    let b = 0;
    const H = HAVRE.find((x) => x.id === kind); if (H) b += E.havreLvl(S, kind) * H.per;
    b += almBonus(S, kind) + alignBonus(S, kind);
    if (kind === "drop" || kind === "kamas" || kind === "gather") b += E.boostPct(S, kind);
    if (kind === "xp" || kind === "drop" || kind === "kamas") b += E.boostPct(S, "royal");
    return b;
  };

  /* ---------------- Consommables spéciaux (utilitaires et coffres) ---------------- */
  const resLot = (S, n, qmin, qmax) => {
    const top = topLvl(S); const pool = ALM_POOL.filter(([, l]) => l <= top + 3 && l >= top - 25); const P = pool.length ? pool : ALM_POOL.slice(0, 10);
    const got = [];
    for (let i = 0; i < n; i++) { const [r] = P[Math.floor(rnd() * P.length)]; const q = qmin + Math.floor(rnd() * (qmax - qmin + 1)); S.res[r] = (S.res[r] || 0) + q; got.push(`${q} × ${r}`); }
    return got;
  };
  E.resLot = resLot;
  E.useSpecial = (S, id, arg) => {
    const C = D.CONSUMABLES[id];
    const take = () => { S.cons[id]--; if (!S.cons[id]) delete S.cons[id]; };
    if (C.auto) return "Cet objet s'utilise automatiquement au bon moment.";
    if (C.kind === "scroll") {
      const c = S.chars.find((x) => x.id === arg); if (!c) return "Choisissez un héros.";
      const room = E.scrollRoom(c, C.stat); if (room <= 0) return `${c.name} a déjà +${E.SCROLL_MAX} ${D.STATS[C.stat].name} grâce aux parchemins.`;
      take(); c.scrolls = c.scrolls || {}; c.scrolls[C.stat] = (c.scrolls[C.stat] || 0) + Math.min(C.v, room);
      E.emit(S, "scroll", { cid: c.id, stat: C.stat });
      return null;
    }
    if (id === "potion_savoir") {
      const J = S.jobs[arg]; if (!J) return "Choisissez un métier.";
      take(); J.xp += Math.max(E.jobXpNeed(J.lvl), 0);
      while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; }
      note(S, `Potion de Savoir : ${D.GATHER_JOBS[arg].name} niveau ${J.lvl}.`, "up"); return null;
    }
    if (id === "cristal_fm") { if (S.fmShield) return "Un Cristal est déjà actif."; take(); S.fmShield = true; note(S, "Cristal de Forgemagie actif : la prochaine forgemagie ne peut rien faire baisser.", "info"); return null; }
    if (C.kind === "chest") {
      take(); const top = topLvl(S); const k = Math.round((40 + top * 12) * (1 + C.tier * 1.5)); S.kamas += k;
      const lot = resLot(S, 2 + C.tier, 3 + C.tier * 2, 6 + C.tier * 4);
      let extra = "";
      if (C.tier >= 1) { const pool = C.tier === 2 ? ["bonbon_royal", "fiole_resu", "cristal_fm", "bonbon_traqueur"] : ["bonbon_sagesse", "bonbon_prospecteur", "bonbon_dore", "bonbon_recolteur", "parchemin_avis"]; const g = pool[Math.floor(rnd() * pool.length)]; E.addCons(S, g); extra = `, ${D.CONSUMABLES[g].name}`; }
      if (C.tier === 2 && rnd() < 0.5) { S.res[E.RARE_COMPONENT] = (S.res[E.RARE_COMPONENT] || 0) + 2; extra += `, 2 × ${E.RARE_COMPONENT}`; }
      note(S, `${C.name} : ${k.toLocaleString("fr-FR")} kamas, ${lot.join(", ")}${extra}.`, "rare"); return null;
    }
    return "Inutilisable.";
  };

  /* ---------------- Comptoirs : Bureau des primes (jetons) et Comptoir de la cité (insignes) ---------------- */
  const SHOPS = {
    prime: { name: "Bureau des primes", cur: "jetons", curName: "Jetons de chasseur", icon: "🎟", items: [
      { id: "b1", cons: "bonbon_sagesse", cost: 4 }, { id: "b2", cons: "bonbon_prospecteur", cost: 4 }, { id: "b3", cons: "bonbon_dore", cost: 4 }, { id: "b4", cons: "bonbon_recolteur", cost: 4 },
      { id: "b5", cons: "parchemin_avis", cost: 2 }, { id: "b6", cons: "bonbon_traqueur", cost: 6 }, { id: "b7", cons: "fiole_resu", cost: 8 },
      { id: "t1", title: "Traqueur de primes", cost: 20 }, { id: "o1", orn: "avis", name: "Ornement « Avis de recherche »", cost: 30 }, { id: "t2", title: "Fléau des hors-la-loi", cost: 60 } ] },
    cite: { name: "Comptoir de la cité", cur: "insignes", curName: "Insignes de cité", icon: "🎖", items: [
      { id: "w1", wing: "or", name: "Ailes dorées", cost: 20 }, { id: "w2", wing: "argent", name: "Ailes argentées", cost: 20 }, { id: "w3", wing: "sombre", name: "Ailes sombres", cost: 30 },
      { id: "c1", cons: "bonbon_royal", cost: 12 }, { id: "f1", furn: "Bannière de la cité", cost: 15 }, { id: "f2", furn: "Statue de l'Ordre", cost: 40 },
      { id: "t3", titleSide: true, cost: 25 } ] },
  };
  E.SHOPS = SHOPS;
  E.shopItemName = (S, it) => it.cons ? D.CONSUMABLES[it.cons].name : it.title ? `Titre « ${it.title} »` : it.titleSide ? `Titre « Champion de ${S.align ? ALIGN[S.align.side].name : "la cité"} »` : it.furn ? `Meuble : ${it.furn}` : it.name;
  E.shopOwned = (S, it) => (it.title && S.titlesExtra.includes(it.title)) || (it.titleSide && S.align && S.titlesExtra.includes(`Champion de ${ALIGN[S.align.side].name}`)) || (it.orn && S.unlocks[it.orn]) || (it.wing && S.unlocks["wing_" + it.wing]) || (it.furn && S.furniture.includes(it.furn));
  E.buyShop = (S, shop, id) => {
    const Sh = SHOPS[shop]; const it = Sh && Sh.items.find((x) => x.id === id); if (!it) return "Article inconnu.";
    if (shop === "cite" && !S.align) return "Choisissez d'abord un alignement.";
    if (E.shopOwned(S, it)) return "Déjà obtenu.";
    if ((S.tokens[Sh.cur] || 0) < it.cost) return `Il faut ${it.cost} ${Sh.curName.toLowerCase()}.`;
    S.tokens[Sh.cur] -= it.cost;
    if (it.cons) E.addCons(S, it.cons);
    if (it.title) S.titlesExtra.push(it.title);
    if (it.titleSide) S.titlesExtra.push(`Champion de ${ALIGN[S.align.side].name}`);
    if (it.orn) S.unlocks[it.orn] = 1;
    if (it.wing) S.unlocks["wing_" + it.wing] = 1;
    if (it.furn) S.furniture.push(it.furn);
    note(S, `${Sh.name} : ${E.shopItemName(S, it)} obtenu.`, "up"); return null;
  };
  E.setWing = (S, cid, w) => { const c = S.chars.find((x) => x.id === cid); if (!c) return; c.wing = w && S.unlocks["wing_" + w] ? w : null; };

  /* ---------------- Forgemagie : améliorer les jets avec des runes et des kamas ---------------- */
  E.fmInfo = (S, uid, runeKey) => {
    const it = S.items[uid]; if (!it) return null; const T = ITEMS[it.tpl]; const ri = E.runeInfo(runeKey); const k = ri.stat;
    if (!T.stats[k]) return { ok: false, why: "Cette caractéristique n'existe pas sur l'objet." };
    const [, mx] = T.stats[k]; if (mx <= 0) return { ok: false, why: "Caractéristique négative : impossible." };
    const cur = it.stats[k] || 0; const add = ri.pts; const nv = cur + add;
    const cap = mx + Math.max(1, Math.ceil(mx * 0.25));
    if (nv > cap) return { ok: false, why: `Maximum atteint (${cap}).`, cur, cap, mx };
    const tierPen = ri.tier === "ra" ? 0.75 : ri.tier === "pa" ? 0.88 : 1;
    const chance = clamp((nv <= mx ? 0.85 : 0.5 - 0.35 * (nv - mx) / Math.max(1, cap - mx)) * tierPen, 0.08, 0.95);
    const kamas = Math.round(15 + T.lvl * 2.5 * (add / STATS[k].pts));
    return { ok: true, stat: k, cur, add, nv, mx, cap, chance, kamas, over: nv > mx };
  };
  const fmLog = (it, txt, ok) => { (it.fmLog = it.fmLog || []).unshift({ t: Date.now(), txt, ok }); if (it.fmLog.length > 6) it.fmLog.length = 6; };
  E.forgemage = (S, uid, runeKey) => {
    const it = S.items[uid]; if (!it) return { err: "Objet introuvable." };
    if (!(S.runes[runeKey] > 0)) return { err: "Vous n'avez pas cette rune." };
    const f = E.fmInfo(S, uid, runeKey); if (!f.ok) return { err: f.why };
    if (S.kamas < f.kamas) return { err: `Il faut ${f.kamas} kamas.` };
    S.kamas -= f.kamas; S.runes[runeKey]--; if (!S.runes[runeKey]) delete S.runes[runeKey];
    S.cnt.fm = (S.cnt.fm || 0) + 1; it.fm = (it.fm || 0) + 1;
    E.emit(S, "fm", {});
    if (rnd() < f.chance) {
      it.stats[f.stat] = f.nv; if (it.roll && it.roll[f.stat] !== undefined) it.roll[f.stat] = Math.min(f.mx, (it.roll[f.stat] || 0) + f.add);
      if (S.fmShield) S.fmShield = false;
      const txt = `Succès : +${f.add} ${STATS[f.stat].name}${f.over ? " (exo-jet !)" : ""}`; fmLog(it, txt, true);
      return { ok: true, txt };
    }
    let loss = "";
    if (S.fmShield) { S.fmShield = false; loss = " (le Cristal protège l'objet)"; }
    else if (rnd() < 0.35) {
      const T = ITEMS[it.tpl]; const others = Object.keys(it.stats).filter((k) => k !== f.stat && it.stats[k] > T.stats[k][0] && it.stats[k] > 0);
      if (others.length) { const k = others[Math.floor(rnd() * others.length)]; const d = Math.max(1, Math.round(STATS[k].pts * (k === "vit" ? 1 : 1))); it.stats[k] = Math.max(T.stats[k][0], it.stats[k] - d); loss = ` et perd ${d} ${STATS[k].name}`; }
    }
    const txt = `Échec : ${E.runeName(runeKey)} se brise${loss}.`; fmLog(it, txt, false);
    return { ok: false, txt };
  };

  /* ---------------- Ornements (contour de la carte de héros) ---------------- */
  const ORN = {
    heros:     { name: () => "Écharpe du Héros d'Amakna", req: "Terminer la quête principale", ok: (S) => S.quest && S.quest.step >= Q.length },
    avis:      { name: () => "Cadre « Avis de recherche »", req: "Bureau des primes (30 jetons)", ok: (S) => !!S.unlocks.avis },
    almanax:   { name: () => "Sceau de l'Almanax", req: "Série d'Almanax de 30 jours", ok: (S) => !!S.unlocks.almanax },
    ailes:     { name: (S) => (S.align ? `Ailes de ${ALIGN[S.align.side].name}` : "Ailes d'alignement"), req: "Choisir un alignement (Bonta ou Brâkmar) — elles grandissent avec le rang", ok: (S) => !!S.align },
    couronne:  { name: () => "Couronne du Maître des donjons", req: "Vaincre chaque boss de donjon au moins une fois", ok: (S) => Object.keys(DUNGEONS).every((d) => S.progress.bossKills[d]) },
    epines:    { name: () => "Épines d'Archimonstre", req: "Vaincre 25 archimonstres", ok: (S) => Object.values(S.archis).reduce((a, b) => a + b, 0) >= 25 },
    lauriers:  { name: () => "Lauriers", req: "Obtenir 20 succès", ok: (S) => Object.keys(S.ach || {}).length >= 20 },
    flammes:   { name: () => "Flammes Rayonnantes", req: "Porter 3 objets Rayonnants en même temps sur un héros", ok: (S) => !!(S.ornSeen && S.ornSeen.flammes) },
    solitaire: { name: () => "Aura du Solitaire", req: "Emblème du Solitaire niveau 100", ok: (S) => S.emblem.lvl >= 100 },
    stasis:    { name: () => "Sceau du Maître de la stasis", req: "Terminer un donjon en stasis 10", ok: (S) => !!S.unlocks.stasis10 },
  };
  E.ORN = ORN;
  E.ornUnlocked = (S, id) => !!ORN[id] && ORN[id].ok(S);
  E.setOrn = (S, cid, id) => { const c = S.chars.find((x) => x.id === cid); if (!c) return; if (id && !E.ornUnlocked(S, id)) return "Ornement verrouillé."; c.orn = id || null; return null; };

  /* ---------------- Carte de héros : cadres et élément dominant ---------------- */
  E.FRAMES = ["Bois", "Pierre", "Bronze", "Argent", "Or", "Émeraude", "Turquoise", "Pourpre", "Ocre", "Ébène et Ivoire", "Krosmoz"];
  E.frameIdx = (lvl) => (lvl >= 200 ? 10 : Math.min(9, Math.floor(lvl / 20)));
  E.domEl = (st) => { const m = [["t", st.fo], ["f", st.ine], ["e", st.cha], ["a", st.age]].sort((a, b) => b[1] - a[1]); return m[0][1] > 0 ? m[0][0] : "n"; };
  E.radiantWorn = (S, c) => Object.values(c.equip).filter((u) => S.items[u] && S.items[u].radiant).length;

  /* ---------------- Avis de recherche ---------------- */
  E.BOUNTY_SLOTS = 3;
  const makeBounty = (S) => {
    const top = topLvl(S);
    const subs = Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id) && s.lvl[0] <= top + 3 && s.lvl[1] >= top - 12);
    const pool = subs.length ? subs : Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id)).sort((a, b) => b.lvl[0] - a.lvl[0]).slice(0, 3);
    const dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= top + 6);
    const taken = new Set((S.bounties || []).map((b) => b.key));
    if (dgs.length && rnd() < 0.25) {
      const d = dgs[Math.floor(rnd() * dgs.length)]; const dg = DUNGEONS[d];
      if (!taken.has(dg.boss)) return { id: Date.now() + Math.floor(rnd() * 1e6), key: dg.boss, dg: d, n: 1, prog: 0, kamas: Math.round(dg.lvl * 60), xp: 0.25, axp: 120 };
    }
    for (let tries = 0; tries < 20; tries++) {
      const s = pool[Math.floor(rnd() * pool.length)]; const k = s.monsters[Math.floor(rnd() * s.monsters.length)];
      if (taken.has(k)) continue;
      const m = MONSTERS[k]; const n = 12 + Math.floor(rnd() * 4) * 6;
      return { id: Date.now() + Math.floor(rnd() * 1e6), key: k, sub: s.id, n, prog: 0, kamas: Math.round(n * (m.lvl[0] + 5) * 2.2), xp: 0.08 + n / 600, axp: 30 + n };
    }
    return null;
  };
  const fillBounties = (S) => { S.bounties = (S.bounties || []).filter(Boolean); while (S.bounties.length < E.BOUNTY_SLOTS) { const b = makeBounty(S); if (!b) break; S.bounties.push(b); } };
  E.fillBounties = fillBounties;
  E.rerollCost = (S) => 30 * topLvl(S);
  E.rerollBounty = (S, id) => {
    const i = S.bounties.findIndex((b) => b.id === id); if (i < 0) return "Avis introuvable.";
    if ((S.cons.parchemin_avis || 0) > 0) { S.cons.parchemin_avis--; if (!S.cons.parchemin_avis) delete S.cons.parchemin_avis; }
    else { const c = E.rerollCost(S); if (S.kamas < c) return `Il faut ${c} kamas.`; S.kamas -= c; }
    S.bounties.splice(i, 1); fillBounties(S); return null;
  };
  const completeBounty = (S, b) => {
    S.kamas += b.kamas; giveTeamXp(S, b.xp); if (S.align) E.giveAlignXp(S, b.axp);
    S.cnt.bounty = (S.cnt.bounty || 0) + 1;
    const tk = b.dg ? 2 : 1; S.tokens.jetons = (S.tokens.jetons || 0) + tk;
    let extra = ""; const r = rnd(); if (r < 0.05) { E.addCons(S, "coffre_argent"); extra = ", Coffre en argent"; } else if (r < 0.25) { E.addCons(S, "coffre_bois"); extra = ", Coffre en bois"; }
    note(S, `Avis de recherche rempli : ${MONSTERS[b.key].name} (+${b.kamas.toLocaleString("fr-FR")} kamas, +${tk} jeton${tk > 1 ? "s" : ""}${extra}).`, "rare");
    E.emit(S, "bounty", {});
  };

  /* ---------------- Quête principale ---------------- */
  const Q = [
    { title: "Premiers pas", txt: "Chassez sur la Route des âmes d'Incarnam.", t: "kill", sub: "inc_route", n: 10 },
    { title: "Un peu d'expérience", txt: "Atteignez le niveau 5.", t: "lvl", n: 5 },
    { title: "S'équiper", txt: "Équipez 2 objets sur un même héros (Héros → Équipement).", t: "equip", n: 2 },
    { title: "La forêt d'Incarnam", txt: "Chassez dans la Forêt d'Incarnam.", t: "kill", sub: "inc_foret", n: 20 },
    { title: "Mettre la main à la pâte", txt: "Récoltez 30 ressources (Métiers → Récolte : envoyez un héros récolter).", t: "harvest", n: 30 },
    { title: "La Crypte de Kardorim", txt: "Trouvez la clé au Cimetière d'Incarnam et vainquez Kardorim.", t: "boss", dg: "crypte_kardorim" },
    { title: "Bienvenue à Astrub", txt: "Chassez dans la Cité d'Astrub.", t: "kill", sub: "ast_cite", n: 20 },
    { title: "Apprenti artisan", txt: "Fabriquez un objet (Métiers → Artisanat).", t: "craft", n: 1 },
    { title: "Le Havre-Sac", txt: "Achetez 3 améliorations du Havre-Sac (Accueil → Havre-Sac).", t: "havre", n: 3 },
    { title: "Monter en puissance", txt: "Atteignez le niveau 15.", t: "lvl", n: 15 },
    { title: "Le Tournesol Affamé", txt: "Vainquez le boss de la Grange du Tournesol Affamé.", t: "boss", dg: "grange_tournesol" },
    { title: "Dévotion", txt: "Faites une offrande à l'Almanax (Quêtes → Almanax).", t: "almanax", n: 1 },
    { title: "Chasseur de primes", txt: "Remplissez 3 avis de recherche (Quêtes).", t: "bounty", n: 3 },
    { title: "Le Bouftou Royal", txt: "Vainquez le Bouftou Royal.", t: "boss", dg: "cour_bouftou_royal" },
    { title: "Les terres d'Amakna", txt: "Chassez dans la Forêt d'Amakna.", t: "kill", sub: "ama_foret", n: 30 },
    { title: "Le choix d'un camp", txt: `Atteignez le niveau ${30} et choisissez Bonta ou Brâkmar (Quêtes → Alignement).`, t: "align" },
    { title: "Forgemage débutant", txt: "Tentez une forgemagie sur un objet (Forgemagie).", t: "fm", n: 1 },
    { title: "Le Scarabosse Doré", txt: "Vainquez le Donjon des Scarafeuilles.", t: "boss", dg: "donjon_scarafeuilles" },
    { title: "Les plaines de Cania", txt: "Chassez dans la Plaine des Porkass.", t: "kill", sub: "can_porkass", n: 30 },
    { title: "La Bworkette", txt: "Vainquez le Donjon des Bworks.", t: "boss", dg: "donjon_bworks" },
    { title: "Niveau 50", txt: "Atteignez le niveau 50.", t: "lvl", n: 50 },
    { title: "Le Blop Coco Royal", txt: "Vainquez le Clos des Blops.", t: "boss", dg: "clos_blops" },
  ];
  E.MAIN_QUEST = Q;
  E.questStep = (S) => (S.quest && S.quest.step < Q.length ? Q[S.quest.step] : null);
  E.questProgress = (S) => {
    const q = E.questStep(S); if (!q) return null; const P = S.quest;
    switch (q.t) {
      case "kill": case "harvest": case "craft": case "fm": case "bounty": case "almanax": return [Math.min(P.prog, q.n), q.n];
      case "lvl": return [Math.min(topLvl(S), q.n), q.n];
      case "equip": return [Math.min(Math.max(...S.chars.map((c) => Object.keys(c.equip).length)), q.n), q.n];
      case "havre": return [Math.min(E.havreTotal(S), q.n), q.n];
      case "boss": return [S.progress.bossKills[q.dg] ? 1 : 0, 1];
      case "align": return [S.align ? 1 : 0, 1];
    }
    return [0, 1];
  };
  /* Récompenses à thème de la quête principale (en plus des kamas et de l'XP) */
  const QX = {
    0: { lot: "inc_route" }, 1: { cons: "bonbon_sagesse" }, 2: { item: "inc_paturages" }, 3: { lot: "inc_foret" }, 4: { cons: "potion_savoir" },
    5: { key: "grange_tournesol", cons: "bonbon_sagesse" }, 6: { item: "ast_cite" }, 7: { res: [["Bois de Frêne", 20], ["Fer", 20], ["Blé", 15]] }, 8: { cons: "coffre_bois" },
    9: { cons: "fiole_resu" }, 10: { key: "cour_bouftou_royal", furn: "Trophée du Tournesol Affamé", scrolls: true }, 11: { cons: "bonbon_recolteur" }, 12: { cons: "parchemin_avis", n: 2 },
    13: { item: "ast_tainela", furn: "Trophée du Bouftou Royal", cons: "bonbon_sagesse" }, 14: { cons: "coffre_argent" }, 15: { cons: "bonbon_royal" }, 16: { cons: "cristal_fm", n: 2 },
    17: { key: "donjon_bworks", furn: "Trophée du Scarabosse Doré" }, 18: { item: "can_porkass" }, 19: { cons: "fiole_resu", furn: "Trophée de la Bworkette" }, 20: { cons: "coffre_or" },
    21: { furn: "Trophée du Blop Coco Royal", orn: "heros" },
  };
  E.QUEST_EXTRA = QX;
  const rewardItem = (S, sid) => {
    const sub = SUBS[sid]; if (!sub || E.itemCount(S) >= E.itemCap(S)) return null; const top = topLvl(S);
    const pool = [...new Set(sub.monsters.flatMap((k) => (MONSTERS[k].items || []).map(([t]) => t)))].filter((t) => ITEMS[t] && ITEMS[t].lvl <= Math.max(top, 3));
    if (!pool.length) return null; const tpl = pool.sort((a, b) => ITEMS[b].lvl - ITEMS[a].lvl)[Math.floor(rnd() * Math.min(3, pool.length))];
    const it = E.rollItem(S, tpl, { radiant: false }); const T = ITEMS[tpl];
    for (const k in T.stats) { const [a, b] = T.stats[k]; it.stats[k] = Math.max(it.stats[k], Math.round(a + (b - a) * (0.8 + rnd() * 0.2))); }
    return T.name;
  };
  E.questExtraText = (i) => {
    const x = QX[i]; if (!x) return ""; const p = [];
    if (x.key) p.push(DUNGEONS[x.key].key); if (x.item) p.push(`un objet de ${SUBS[x.item] ? SUBS[x.item].name : "la zone"} (bon jet)`);
    if (x.lot) p.push(`ressources de ${SUBS[x.lot] ? SUBS[x.lot].name : "la zone"}`); if (x.res) p.push(x.res.map(([r, q]) => `${q} × ${r}`).join(", "));
    if (x.cons) p.push(`${x.n ? x.n + " × " : ""}${D.CONSUMABLES[x.cons].name}`); if (x.furn) p.push(`meuble « ${x.furn} »`); if (x.scrolls) p.push("un Petit parchemin de chaque caractéristique"); if (x.orn) p.push("un ornement exclusif");
    return p.join(", ");
  };
  const giveQuestExtra = (S, i) => {
    const x = QX[i]; if (!x) return "";
    if (x.key) S.res[DUNGEONS[x.key].key] = (S.res[DUNGEONS[x.key].key] || 0) + 1;
    if (x.item) rewardItem(S, x.item);
    if (x.lot) { const sub = SUBS[x.lot]; const drops = [...new Set(sub.monsters.flatMap((k) => MONSTERS[k].drops.map(([r]) => r)))].slice(0, 3); drops.forEach((r) => (S.res[r] = (S.res[r] || 0) + 6)); }
    if (x.res) x.res.forEach(([r, q]) => (S.res[r] = (S.res[r] || 0) + q));
    if (x.cons) E.addCons(S, x.cons, x.n || 1);
    if (x.furn && !S.furniture.includes(x.furn)) S.furniture.push(x.furn);
    if (x.scrolls) ["fo", "ine", "cha", "age", "vit", "sa"].forEach((k) => E.addCons(S, "parch_" + k + "_p", 1));
    return E.questExtraText(i);
  };
  const questReward = (i) => ({ kamas: 80 + i * 60, xp: 0.35 });
  const checkQuest = (S) => {
    let guard = 0;
    while (guard++ < 5) {
      const q = E.questStep(S); if (!q) return; const [a, b] = E.questProgress(S); if (a < b) return;
      const r = questReward(S.quest.step);
      S.quest = { step: S.quest.step + 1, prog: 0 };
      const ex = giveQuestExtra(S, S.quest.step - 1);
      note(S, `Quête terminée : ${q.title} (+${r.kamas} kamas${ex ? ", " + ex : ""})`, "rare");
      if (S.quest.step >= Q.length) note(S, "Quête principale achevée : vous êtes un Héros d'Amakna !", "rare");
      S.kamas += r.kamas; giveTeamXp(S, r.xp);
    }
  };

  /* ---------------- Quêtes d'alignement (missions renouvelables) ---------------- */
  const newAlignQuest = (S) => {
    if (!S.align) return;
    const top = topLvl(S); const side = ALIGN[S.align.side];
    const subs = Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id) && s.lvl[0] <= top + 2 && s.lvl[1] >= top - 15);
    const pool = subs.length ? subs : Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id));
    const r = rnd();
    const flav = S.align.side === "bonta"
      ? ["Patrouille bontarienne", "Ordre de la Milice", "Protéger les voyageurs", "Mission de l'Ordre"]
      : ["Raid brâkmarien", "Contrat de la Milice noire", "Semer la terreur", "Mission de l'Ordre"];
    const title = flav[Math.floor(rnd() * flav.length)];
    const dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= top + 4 && DUNGEONS[d].lvl >= top - 25);
    const axp = 420 + top * 9;
    if (dgs.length && r < 0.2) { const d = dgs[Math.floor(rnd() * dgs.length)]; S.alignQuest = { title, t: "boss", dg: d, n: 1, prog: 0, axp: axp * 1.5, kamas: 300 + top * 25, txt: `Vaincre ${MONSTERS[DUNGEONS[d].boss].name} (${DUNGEONS[d].name}) pour ${side.name}.` }; return; }
    const s = pool[Math.floor(rnd() * pool.length)]; const n = 25 + Math.floor(rnd() * 4) * 10;
    S.alignQuest = { title, t: "kill", sub: s.id, n, prog: 0, axp, kamas: 150 + top * 12, txt: `Éliminer ${n} monstres dans ${s.name} au nom de ${side.name}.` };
  };
  E.newAlignQuest = newAlignQuest;
  const completeAlignQuest = (S) => {
    const q = S.alignQuest; S.alignQuest = null; newAlignQuest(S);
    S.kamas += q.kamas; S.cnt.alignq = (S.cnt.alignq || 0) + 1;
    const ins = q.t === "boss" ? 5 : 3; S.tokens.insignes = (S.tokens.insignes || 0) + ins;
    let extra = ""; if (rnd() < 0.25) { E.addCons(S, "coffre_bois"); extra = ", Coffre en bois"; }
    note(S, `Mission d'alignement accomplie : ${q.title} (+${q.kamas} kamas, +${ins} insignes${extra}).`, "up");
    E.giveAlignXp(S, q.axp);
  };

  /* ---------------- Succès ---------------- */
  const ACH = [];
  const add = (id, cat, name, desc, test, kamas, extra = {}) => ACH.push(Object.assign({ id, cat, name, desc, test, kamas }, extra));
  [10, 20, 30, 40, 50, 60, 70].forEach((l) => add("lvl" + l, "Progression", `Niveau ${l}`, `Un héros atteint le niveau ${l}.`, (S) => topLvl(S) >= l, l * 40, l === 50 ? { title: "le Vétéran" } : {}));
  [[100, ""], [1000, ""], [10000, "Fléau des monstres"]].forEach(([n, t]) => add("win" + n, "Combat", `${n.toLocaleString("fr-FR")} victoires`, `Gagner ${n.toLocaleString("fr-FR")} combats.`, (S) => S.stats.wins >= n, Math.round(Math.sqrt(n) * 60), t ? { title: t } : {}));
  [[1, ""], [10, ""], [25, "Chasseur d'Archis"]].forEach(([n, t]) => add("archi" + n, "Combat", n === 1 ? "Premier archimonstre" : `${n} archimonstres`, `Vaincre ${n} archimonstre${n > 1 ? "s" : ""}.`, (S) => Object.values(S.archis).reduce((a, b) => a + b, 0) >= n, 300 * n, t ? { title: t } : {}));
  Object.entries(DUNGEONS).sort((a, b) => a[1].lvl - b[1].lvl).forEach(([id, d]) => add("dg_" + id, "Donjons", d.name, `Vaincre ${MONSTERS[d.boss].name}.`, (S) => !!S.progress.bossKills[id], d.lvl * 30));
  add("dg_all", "Donjons", "Maître des donjons", "Vaincre tous les boss de donjon.", (S) => Object.keys(DUNGEONS).every((d) => S.progress.bossKills[d]), 5000, { title: "Maître des donjons" });
  [1, 5, 10].forEach((n) => add("fam" + n, "Chasse", `${n} famille${n > 1 ? "s" : ""}`, `Compléter ${n} famille${n > 1 ? "s" : ""} de monstres (palier Traqueur).`, (S) => Object.keys(S.families).length >= n, 400 * n));
  [1, 10, 25].forEach((n) => add("tro" + n, "Chasse", `${n} trophée${n > 1 ? "s" : ""}`, `Obtenir ${n} trophée${n > 1 ? "s" : ""} de sous-zone.`, (S) => Object.keys(S.trophies).length >= n, 300 * n));
  [[1, ""], [5, "l'Étincelant"]].forEach(([n, t]) => add("rad" + n, "Objets", n === 1 ? "Premier Rayonnant" : `${n} Rayonnants`, `Obtenir ${n} objet${n > 1 ? "s" : ""} Rayonnant${n > 1 ? "s" : ""}.`, (S) => (S.radiants || 0) >= n, 500 * n, t ? { title: t } : {}));
  [[10, ""], [100, ""]].forEach(([n]) => add("craft" + n, "Métiers", `${n} fabrications`, `Fabriquer ${n} objets.`, (S) => (S.cnt.craft || 0) >= n, 20 * n));
  [[1000, ""], [10000, "Main verte"]].forEach(([n, t]) => add("harv" + n, "Métiers", `${n.toLocaleString("fr-FR")} récoltes`, `Récolter ${n.toLocaleString("fr-FR")} ressources.`, (S) => (S.cnt.harvest || 0) >= n, Math.round(n / 2), t ? { title: t } : {}));
  [[1, ""], [50, "Forgemage"]].forEach(([n, t]) => add("fm" + n, "Forgemagie", n === 1 ? "Première forgemagie" : `${n} forgemagies`, `Tenter ${n} forgemagie${n > 1 ? "s" : ""}.`, (S) => (S.cnt.fm || 0) >= n, 50 * n, t ? { title: t } : {}));
  add("emb100", "Forgemagie", "Solitaire aguerri", "Emblème du Solitaire niveau 100.", (S) => S.emblem.lvl >= 100, 3000, { title: "le Solitaire" });
  [[1, ""], [7, ""], [30, "Dévot d'Almanax"]].forEach(([n, t]) => add("alm" + n, "Quêtes", `${n} offrande${n > 1 ? "s" : ""}`, `Faire ${n} offrande${n > 1 ? "s" : ""} à l'Almanax.`, (S) => (S.cnt.almanax || 0) >= n, 150 * n, t ? { title: t } : {}));
  [[10, ""], [50, "Chasseur de primes"]].forEach(([n, t]) => add("bty" + n, "Quêtes", `${n} avis de recherche`, `Remplir ${n} avis de recherche.`, (S) => (S.cnt.bounty || 0) >= n, 80 * n, t ? { title: t } : {}));
  add("mainq", "Quêtes", "Héros d'Amakna", "Terminer la quête principale.", (S) => S.quest && S.quest.step >= Q.length, 8000, { title: "Héros d'Amakna" });
  add("align", "Alignement", "Le choix d'un camp", "Choisir Bonta ou Brâkmar.", (S) => !!S.align, 500);
  [1, 2, 3, 4, 5].forEach((r) => add("arank" + r, "Alignement", `Rang d'alignement ${r}`, `Atteindre le niveau d'alignement ${r * 20}.`, (S) => E.alignRankIdx(S) >= r, 600 * r, r === 5 ? { title: "Légende de la cité" } : {}));
  [[10, ""], [50, ""]].forEach(([n]) => add("havre" + n, "Havre-Sac", `Havre-Sac ×${n}`, `Acheter ${n} améliorations du Havre-Sac.`, (S) => E.havreTotal(S) >= n, 100 * n));
  [2, 4, 8].forEach((n) => add("team" + n, "Progression", `${n} héros`, `Avoir ${n} héros.`, (S) => S.chars.length >= n, 250 * n));
  E.ACH = ACH;
  const checkAch = (S) => {
    ACH.forEach((a) => {
      if (S.ach[a.id]) return;
      if (!a.test(S)) return;
      S.ach[a.id] = Date.now(); S.kamas += a.kamas;
      note(S, `Succès : ${a.name}${a.title ? ` — titre « ${a.title} »` : ""} (+${a.kamas.toLocaleString("fr-FR")} kamas)`, "rare");
    });
  };
  E.checkAch = checkAch;
  E.titles = (S) => ACH.filter((a) => a.title && S.ach[a.id]).map((a) => a.title).concat(S.titlesExtra || []);
  E.setTitle = (S, cid, t) => { const c = S.chars.find((x) => x.id === cid); if (!c) return; c.title = t && E.titles(S).includes(t) ? t : null; };

  /* ---------------- Branchements sur les événements du moteur ---------------- */
  const prevEmit = E.emit;
  let depth = 0;
  E.emit = (S, type, data) => {
    if (prevEmit) prevEmit(S, type, data);
    if (!S.cnt) return;
    if (depth > 3) return;
    depth++;
    try { onEvent(S, type, data); } finally { depth--; }
  };
  const onEvent = (S, type, data) => {
    const q = E.questStep(S);
    if (type === "win") {
      data.mons.forEach((m) => {
        if (q && q.t === "kill" && data.sub === q.sub) S.quest.prog++;
        (S.bounties || []).forEach((b) => { if (!b.dg && b.key === m.key && b.prog < b.n) b.prog++; });
        const aq = S.alignQuest; if (aq && aq.t === "kill" && data.sub === aq.sub && aq.prog < aq.n) aq.prog++;
      });
    }
    if (type === "dungeon") {
      const dg = DUNGEONS[data.id];
      (S.bounties || []).forEach((b) => { if (b.dg === data.id && b.prog < b.n) b.prog++; });
      const aq = S.alignQuest; if (aq && aq.t === "boss" && aq.dg === data.id) aq.prog = 1;
      if (S.align) E.giveAlignXp(S, Math.round(dg.lvl * 2));
    }
    if (type === "harvest") { S.cnt.harvest = (S.cnt.harvest || 0) + data.n; if (q && q.t === "harvest") S.quest.prog += data.n; }
    if (type === "craft") { S.cnt.craft = (S.cnt.craft || 0) + 1; if (q && q.t === "craft") S.quest.prog++; }
    if (type === "fm" && q && q.t === "fm") S.quest.prog++;
    if (type === "bounty" && q && q.t === "bounty") S.quest.prog++;
    if (type === "almanax" && q && q.t === "almanax") S.quest.prog++;
    // avis remplis
    if (S.bounties) { const done = S.bounties.filter((b) => b.prog >= b.n); if (done.length) { S.bounties = S.bounties.filter((b) => b.prog < b.n); done.forEach((b) => completeBounty(S, b)); fillBounties(S); } }
    if (S.alignQuest && S.alignQuest.prog >= S.alignQuest.n) completeAlignQuest(S);
    // ornement des flammes
    if (!S.ornSeen.flammes && S.chars.some((c) => E.radiantWorn(S, c) >= 3)) { S.ornSeen.flammes = 1; note(S, "Ornement débloqué : Flammes Rayonnantes !", "rare"); }
    // limites de stock : le surplus est vendu automatiquement
    if (type === "win" || type === "harvest") for (const n in S.resCap) { const ex = (S.res[n] || 0) - S.resCap[n]; if (ex > 0) E.sellRes(S, n, ex); }
    checkQuest(S);
    if (type !== "harvest" || (S._achT || 0) + 1500 < Date.now()) { S._achT = Date.now(); checkAch(S); }
  };
  E.refreshSystems = (S) => { initState(S); fillBounties(S); if (S.align && !S.alignQuest) newAlignQuest(S); checkQuest(S); checkAch(S); };

  /* ---------------- État ---------------- */
  const initState = (S) => {
    for (const k of ["havre", "ach", "cnt", "ornSeen", "almanax"]) if (!S[k] || typeof S[k] !== "object") S[k] = {};
    if (!S.quest) S.quest = { step: 0, prog: 0 };
    if (!Array.isArray(S.bounties)) S.bounties = [];
    if (S.align === undefined) S.align = null;
    if (S.alignQuest === undefined) S.alignQuest = null;
    if (!S.tools) S.tools = {};
    for (const k of ["tokens", "unlocks", "almStreak", "resCap", "resSeen", "resFav", "resT"]) if (!S[k] || typeof S[k] !== "object") S[k] = {};
    if (!S.almStreak.n) S.almStreak.n = 0;
    for (const k of ["titlesExtra", "furniture", "shop"]) if (!Array.isArray(S[k])) S[k] = [];
  };
  const baseNew = E.newState;
  E.newState = (name, cls) => { const S = baseNew(name, cls); initState(S); fillBounties(S); return S; };
  const baseDes = E.deserialize;
  E.deserialize = (txt) => {
    const raw = JSON.parse(txt); const oldV = raw.v || 1;
    const S = baseDes(txt);
    initState(S);
    if (oldV < 4) {
      S.settings.theme = "dark";
      S.chars.forEach((c) => { if (c.job === undefined) c.job = null; });
      // anciennes cibles de récolte par métier : abandonnées (la récolte se fait maintenant par héros)
      for (const j in S.jobs) { delete S.jobs[j].target; delete S.jobs[j].prog; }
      (S.migration = S.migration || []).push("v2.6 : thème Krosmoz, Havre-Sac, forgemagie, Almanax, quêtes, avis de recherche, succès, alignement, récolte par héros, combat manuel, Amakna et Cania (6 nouveaux donjons).");
      // succès déjà mérités : pas de pluie de kamas rétroactive
      ACH.forEach((a) => { if (a.test(S)) S.ach[a.id] = 1; });
    }
    if (oldV < 5) {
      S.chars.forEach((c) => { if (c.job && c.job.sub) delete c.job.sub; });
      if (S.settings.auto && S.settings.auto.recycle === undefined) S.settings.auto.recycle = false;
      (S.migration = S.migration || []).push("v2.7 : progression plus rapide jusqu'au niveau 60, objets et ressources plus rares, Synergie d'équipe, outils fabriqués, filons, nouveaux consommables et coffres, récompenses de quêtes, Bureau des primes, sac et forgemagie réorganisés.");
    }
    fillBounties(S); if (S.align && !S.alignQuest) newAlignQuest(S);
    return S;
  };

  root.SYSTEMS = true;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
