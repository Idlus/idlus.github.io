/* ============================================================================
   Classique · Saison 1, lot 1 (partie moteur, sans DOM) : calendrier de saison, Fragments du Temps, Bénédictions, plafond
   de Maîtrise par manche. Décisions de Mathis (maquette « Refonte de la Saison 1 », 29/10) :
     2A une seule monnaie de saison, les Fragments du Temps, avec un plafond par semaine ;
     3A tous les 10 niveaux, on choisit 1 bénédiction parmi 3 ;
     4A une courbe de saison et un plafond de Maîtrise par manche (niveau 200 en deux semaines environ, c'est bon).
   Seule la partie Classique · Saison 1 (S.s1c, posé à sa création) est touchée : l'Éternel, les parties 2-3 et le Monocompte
   ne changent jamais (chaque crochet vérifie E.isS1c). Les bénédictions et les Fragments restent dans la saison.
   REGISTRE PROVISOIRE : comme le Monocompte avant son registre serveur, les Fragments vivent dans la partie (S.s1c.f.led) ;
   le sac (S.res) n'en montre qu'une copie. Le registre du serveur (espace s1) arrivera avec la vitrine de saison (lot 4).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const DAY = 86400000;
  const C = (E.S1C = {
    id: 1, nom: "Saison 1", titre: "Les Fragments du Temps",
    debut: null, // date d'ouverture donnée par le serveur ; sans elle, la date de création de la partie
    jours: 56, manche: 14,
    manches: ["La Fissure", "Échos du Passé", "La Rupture", "Dernier Sablier"],
    mtCap: [50, 100, 150, 250], // plafond de Maîtrise (points) par manche ; la dernière laisse finir la saison
    frag: { res: "Fragment du Temps", icon: 995001, quota: 100, cap: 800 },
  });
  // activités : borne par jour, puis quota de 100 par semaine (cumulable jusqu'à 800 sur la saison)
  C.ACT = {
    dj: { n: "Donjons (niveau de l'équipe − 20 ou plus)", gain: 1, max: 8 },
    arch: { n: "Archimonstres", gain: 2, max: 6 },
    job: { n: "Métiers (1 toutes les 50 actions)", gain: 1, max: 4, per: 50 },
    bounty: { n: "Avis de recherche", gain: 2, max: 4 },
    mt: { n: "XP au plafond de Maîtrise", gain: 1, max: 4 }, // équilibrage 2A (03/11)
  };
  C.DAYMAX = Object.values(C.ACT).reduce((a, x) => a + x.max, 0); // 22
  // bénédictions (3A) : petits bonus de saison, cumulables ; les mêmes 3 choix pour tous les joueurs à chaque palier
  C.BOONS = [
    { id: "xp", n: "Élan du Temps", k: "xp", v: 2, d: "+2 % d'XP" },
    { id: "kamas", n: "Bourse du Sablier", k: "kamas", v: 2, d: "+2 % de kamas" },
    { id: "drop", n: "Main de Xélor", k: "drop", v: 1.5, d: "+1,5 % de butin" },
    { id: "gather", n: "Récolte figée", k: "gather", v: 2, d: "+2 % de récolte" },
    { id: "hp", n: "Peau d'horloge", k: "hp", v: 1, d: "+1 % de PV" },
    { id: "dmg", n: "Lame des secondes", k: "dmg", v: 1, d: "+1 % de dégâts" },
    { id: "offrate", n: "Repos du voyageur", k: "offrate", v: 2, d: "+2 % d'efficacité hors ligne" },
  ];
  C.STEP = 10; // un choix tous les 10 niveaux du meilleur héros : 20 choix jusqu'au niveau 200
  if (D.RES && !D.RES[C.frag.res]) D.RES[C.frag.res] = { id: 0, icon: C.frag.icon, lvl: 1, price: 0, type: -2 };

  E.isS1c = (S) => !!(S && S.s1c && !S.mono);
  E.s1cStart = (S, at) => { S.s1c = { s: C.id, t0: at || E.now(), f: { led: [], act: {}, jobAcc: 0, seq: 0 }, b: { got: [] } }; return S.s1c; };
  /* ---------------- calendrier ---------------- */
  E.s1cT0 = (S) => C.debut || (S.s1c && S.s1c.t0) || E.now();
  E.s1cDay = (S) => Math.max(1, Math.floor((E.now() - E.s1cT0(S)) / DAY) + 1);
  E.s1cWeek = (S) => Math.ceil(Math.min(E.s1cDay(S), C.jours) / 7);
  E.s1cManche = (S) => Math.min(C.manches.length, Math.ceil(Math.min(E.s1cDay(S), C.jours) / C.manche));
  E.s1cOver = (S) => E.isS1c(S) && E.s1cDay(S) > C.jours;
  E.s1cLeft = (S) => Math.max(0, E.s1cT0(S) + C.jours * DAY - E.now()); // ms avant la fin
  E.s1cMancheLeft = (S) => Math.max(0, E.s1cT0(S) + E.s1cManche(S) * C.manche * DAY - E.now());
  const open = (S) => E.isS1c(S) && !E.s1cOver(S);

  /* ---------------- Fragments du Temps ---------------- */
  const F = (S) => { const s = S.s1c; s.f = s.f || { led: [], act: {}, jobAcc: 0, seq: 0 }; return s.f; };
  E.s1cFrag = (S) => (E.isS1c(S) ? F(S).led.reduce((a, l) => a + l.n, 0) : 0);
  E.s1cFragAct = (S) => (E.isS1c(S) ? F(S).led.reduce((a, l) => a + (l.o === "act" ? l.n : 0), 0) : 0);
  E.s1cQuota = (S) => Math.min(C.frag.cap, C.frag.quota * E.s1cWeek(S)); // déjà débloqué à cette date
  E.s1cSync = (S) => {
    if (!S || !S.res) return;
    if (!E.isS1c(S)) { if (S.res[C.frag.res] != null) delete S.res[C.frag.res]; return; } // jamais de Fragments hors de la saison
    const b = E.s1cFrag(S); if (b > 0) S.res[C.frag.res] = b; else delete S.res[C.frag.res];
  };
  const post = (S, n, o, src, why) => {
    const T = F(S); if (!n) return 0;
    if (src && T.led.some((l) => l.src === src)) return 0; // une source ne paie jamais deux fois
    T.seq++; T.led.push({ id: T.seq, n, o, src: src || `${o}:${T.seq}`, t: E.now(), why: why || "" });
    E.s1cSync(S); return n;
  };
  E.s1cPost = post;
  E.s1cActivity = (S, kind, n = 1) => {
    if (!open(S)) return 0; const A = C.ACT[kind]; if (!A) return 0; const T = F(S);
    const day = E.s1cDay(S); if (T.act.day !== day) T.act = { day };
    const room = Math.max(0, A.max - (T.act[kind] || 0));
    const q = Math.max(0, E.s1cQuota(S) - E.s1cFragAct(S));
    const g = Math.min(n * A.gain, room, q); if (g <= 0) return 0;
    T.act[kind] = (T.act[kind] || 0) + g;
    return post(S, g, "act", `act:${day}:${kind}:${T.act[kind]}`, A.n);
  };
  E.s1cDayLeft = (S) => { if (!open(S)) return 0; const T = F(S); const day = E.s1cDay(S); const a = T.act.day === day ? T.act : {}; return Object.keys(C.ACT).reduce((s, k) => s + Math.max(0, C.ACT[k].max - (a[k] || 0)), 0); };
  E.s1cSpend = (S, n, src, why) => { if (!open(S)) return "La saison est fermée."; if (E.s1cFrag(S) < n) return `Il faut ${n} Fragments du Temps.`; return post(S, -n, "achat", src, why) ? null : "Déjà acheté."; };

  /* ---------------- Bénédictions (3A) ---------------- */
  const topLvl = (S) => Math.max(1, ...S.chars.filter((c) => !c.merc).map((c) => c.lvl || 1));
  E.s1cBoonSteps = (S) => (E.isS1c(S) ? Math.floor(Math.min(E.MAX_LVL, topLvl(S)) / C.STEP) : 0); // paliers atteints
  E.s1cBoonGot = (S) => (E.isS1c(S) && S.s1c.b ? S.s1c.b.got : []);
  E.s1cBoonOffer = (S) => {
    if (!open(S)) return null; const got = E.s1cBoonGot(S); const step = got.length + 1;
    if (step > E.s1cBoonSteps(S)) return null;
    const n = C.BOONS.length, a = (step * 3) % n; // même offre pour tous à ce palier, jamais deux fois la même dans l'offre
    return { step, lvl: step * C.STEP, ids: [a, (a + 2) % n, (a + 4) % n].map((i) => C.BOONS[i].id) };
  };
  E.s1cBoonPick = (S, id) => {
    const o = E.s1cBoonOffer(S); if (!o) return "Aucune bénédiction à choisir.";
    if (!o.ids.includes(id)) return "Ce choix n'est pas proposé.";
    S.s1c.b.got.push(id); E.emit(S, "s1boon", { id, step: o.step }); return null;
  };
  E.s1cBoon = (S, kind) => { if (!E.isS1c(S)) return 0; let t = 0; E.s1cBoonGot(S).forEach((id) => { const B = C.BOONS.find((x) => x.id === id); if (B && B.k === kind) t += B.v; }); return t; };
  E.s1cBoonTxt = (S) => { const t = {}; E.s1cBoonGot(S).forEach((id) => { t[id] = (t[id] || 0) + 1; }); return C.BOONS.filter((B) => t[B.id]).map((B) => `${B.n} ×${t[B.id]}`); };
  // les bénédictions s'ajoutent aux bonus de la partie (au-delà du plafond commun : petits, et seulement pour la saison)
  const bonus0 = E.bonus;
  E.bonus = function (S, kind) { const b = bonus0.apply(this, arguments); return E.isS1c(S) ? b + E.s1cBoon(S, kind) : b; };

  /* ---------------- Maîtrise par manche (4A) ---------------- */
  E.s1cMtCap = (S) => (E.isS1c(S) ? C.mtCap[E.s1cManche(S) - 1] : Infinity);
  /* Équilibrage de la Saison 1 (Mathis 03/11, choix 2 = A + B) : au plafond de la manche, l'XP n'est plus perdue.
     A : elle donne d'abord des Fragments du Temps (1 par quart de point de Maîtrise, 4 par jour au plus, dans le quota de la semaine) ;
     B : le reste est gardé par héros et versé à l'ouverture de la manche suivante (à nouveau dans son plafond). */
  E.s1cBank = (S) => { const s = S.s1c; s.bank = s.bank || { m: E.s1cManche(S), x: {} }; return s.bank; };
  E.s1cBanked = (S, c) => (E.isS1c(S) && S.s1c.bank && c ? S.s1c.bank.x[c.id] || 0 : 0);
  C.fragXp = (S) => Math.max(1, Math.round(E.mtNeed(E.s1cMtCap(S)) / 4)); // XP au plafond pour 1 Fragment
  const give0 = E.giveXp;
  E.giveXp = function (S, c, g) {
    if (!E.isS1c(S) || !c || c.lvl < E.MAX_LVL || !(g > 0)) return give0.apply(this, arguments);
    const cap = E.s1cMtCap(S), M = E.mt(c);
    const room = M.lvl >= cap ? 0 : Math.max(0, E.mtXpTot(cap) - E.mtXpTot(M.lvl) - (M.xp || 0)); // XP qui manque jusqu'au plafond
    const inG = Math.min(g, room); let r = false;
    if (inG > 0) r = give0.call(this, S, c, inG);
    if (M.lvl >= cap) { M.lvl = cap; M.xp = 0; }
    let rest = g - inG; if (rest <= 0 || !open(S)) return r;
    const T = F(S), per = C.fragXp(S), acc = (T.mtAcc || 0) + rest, n = Math.floor(acc / per);
    const got = n > 0 ? E.s1cActivity(S, "mt", n) : 0;
    if (n > 0 && got < n) { T.mtAcc = 0; rest = acc - got * per; } else { T.mtAcc = acc - n * per; rest = 0; }
    if (rest > 0 && E.s1cManche(S) < C.manches.length) { const B = E.s1cBank(S); B.x[c.id] = (B.x[c.id] || 0) + Math.round(rest); }
    return r;
  };
  // ouverture d'une manche : l'XP gardée est versée (ce qui dépasse le nouveau plafond repart en Fragments puis en réserve)
  E.s1cBankPay = (S) => {
    if (!open(S) || !S.s1c.bank) return 0; const B = S.s1c.bank, m = E.s1cManche(S); if (B.m >= m) return 0;
    const L = B.x; B.m = m; B.x = {}; let pts = 0;
    Object.keys(L).forEach((id) => { const c = S.chars.find((h) => String(h.id) === id); if (!c || !(L[id] > 0)) return; const M = E.mt(c), l0 = M.lvl; E.giveXp(S, c, L[id]); pts += M.lvl - l0; });
    if (pts > 0) E.note(S, `Manche ${m} : l'XP gardée au plafond de Maîtrise est versée (+${pts} point${pts > 1 ? "s" : ""}).`, "rare");
    return pts;
  };

  /* Équilibrage de la Saison 1 (Mathis 03/11, choix 1B) : un week-end Double gain par manche, pour tout le monde (XP et butin ×2,
     sans la Maîtrise, comme les autres événements). Le 2e week-end de chaque manche : du vendredi 19 h au dimanche 23 h (Paris, heure
     d'hiver). La date vient de l'ouverture de la saison (Classique, sinon Monocompte) ; sans date, pas de week-end. Le week-end prend
     la place de E.EVENT quand aucun autre événement n'est prévu, donc toutes les pages qui montrent l'événement le montrent. */
  C.WE = { name: "Week-end du Temps", xp: 2, drop: 2, h0: 18, len: 52 * 3600000 };
  E.s1Weekends = () => {
    const t0 = C.debut || (E.monoSeasonDef && E.monoSeasonDef(1).debut) || null; if (!t0) return [];
    return C.manches.map((nm, m) => { const a = new Date(t0 + (m * C.manche + 7) * DAY); a.setUTCHours(C.WE.h0, 0, 0, 0);
      while (a.getUTCDay() !== 5 || a.getTime() < t0 + (m * C.manche + 7) * DAY) a.setTime(a.getTime() + DAY);
      const from = a.getTime(); return { name: `${C.WE.name} · manche ${m + 1}`, from, to: from + C.WE.len, xp: C.WE.xp, drop: C.WE.drop, s1: m + 1 }; });
  };
  E.s1EventSync = (t = E.now()) => {
    const cur = E.EVENT; if (cur && !cur.s1 && t < cur.to) return cur; // un événement prévu à la main passe toujours avant
    const nx = E.s1Weekends().find((w) => t < w.to);
    if (nx && (!cur || cur.from !== nx.from)) E.EVENT = nx; else if (!nx && cur && cur.s1) E.EVENT = null;
    return E.EVENT;
  };

  /* ---------------- Succès de la saison (lot 2, Mathis 19A et onglet Saison 1) ----------------
     Seulement dans la partie de saison (s1: true, cachés ailleurs par js/questui.js) : la stasis 5 de chaque donjon (avec
     « Vaincre » et « stasis 10 », trois défis par boss sur une ligne) et la famille « Saison 1 ». */
  const ACH = E.ACH || [];
  const has = (id) => ACH.some((a) => a.id === id);
  const add = (o) => { if (!has(o.id)) ACH.push(Object.assign({ s1: true }, o)); };
  const smax = (S, did) => ((S.stasis || {})[did] || {}).max || 0;
  Object.entries(D.DUNGEONS || {}).sort((a, b) => a[1].lvl - b[1].lvl).forEach(([id, d]) => add({ id: "s5_" + id, cat: "Donjons", grp: "Stasis 5", name: `${d.name} · stasis 5`, desc: `Terminer ${d.name} en stasis 5.`, test: (S) => E.isS1c(S) && smax(S, id) >= 5, prog: (S) => [smax(S, id), 5], kamas: Math.round(d.lvl * 40 + 1000) }));
  [[100, "Premiers Fragments"], [400, "Collectionneur du Temps"], [800, "Gardien des Fragments"]].forEach(([n, nm]) => add({ id: "s1f" + n, cat: "Saison 1", grp: "Fragments du Temps", name: nm, desc: `Gagner ${n} Fragments du Temps par les activités.`, test: (S) => E.isS1c(S) && E.s1cFragAct(S) >= n, prog: (S) => [Math.min(n, E.s1cFragAct(S)), n], kamas: n * 50 }));
  [[5, "Béni du Temps"], [10, "Élu du Sablier"], [20, "Maître des bénédictions"]].forEach(([n, nm]) => add({ id: "s1b" + n, cat: "Saison 1", grp: "Bénédictions", name: nm, desc: `Choisir ${n} bénédictions de saison.`, test: (S) => E.isS1c(S) && E.s1cBoonGot(S).length >= n, prog: (S) => [Math.min(n, E.s1cBoonGot(S).length), n], kamas: n * 2000 }));
  C.manches.slice(1).forEach((nm, i) => add({ id: "s1m" + (i + 2), cat: "Saison 1", grp: "Manches", name: `Manche ${i + 2} · ${nm}`, desc: `Jouer pendant la manche ${i + 2} de la saison.`, test: (S) => E.isS1c(S) && E.s1cManche(S) >= i + 2, kamas: 20000 * (i + 1) }));
  /* 2.2.7.3 : Monocompte (un seul héros, Élevage, Songe et Tournoi fermés) : on cache les succès qu'il est impossible d'y obtenir */
  E.ACH_MONO_NO = /^(team4|team8|sec_famille|sec_clones|sec_arcenciel|tour\d|exp\d+|exprel100|expdbl10|expcamp|sgw10|elv[a-z0-9]*)$/;
  E.achVisible = (S, a) => (!a.s1 || E.isS1c(S)) && !(E.isMono && E.isMono(S) && E.ACH_MONO_NO.test(a.id));

  /* ---------------- écoute du moteur ---------------- */
  const DL = (id) => (D.DUNGEONS[id] ? D.DUNGEONS[id].lvl || 0 : 0);
  const emit0 = E.emit;
  E.emit = function (S, t, d) {
    const r = emit0.apply(this, arguments);
    if (S && S.s1c && !S.mono && open(S)) try {
      d = d || {};
      if (t === "dungeon" && DL(d.id) >= topLvl(S) - 20) E.s1cActivity(S, "dj");
      if (t === "win") (d.mons || []).forEach((m) => { if (m.archi) E.s1cActivity(S, "arch"); });
      if (t === "bounty") E.s1cActivity(S, "bounty");
      if (t === "harvest" || t === "craft") {
        const T = F(S); T.jobAcc = (T.jobAcc || 0) + (t === "harvest" ? d.n || 0 : 1);
        const per = C.ACT.job.per; if (T.jobAcc >= per) { const n = Math.floor(T.jobAcc / per); T.jobAcc -= n * per; E.s1cActivity(S, "job", n); }
      }
    } catch (e) {}
    return r;
  };
  // Fragments du Temps : jamais vendus au jeu, ni ailleurs que dans la saison
  if (E.venteOk) { const v0 = E.venteOk; E.venteOk = function (n) { return n !== C.frag.res && v0.apply(this, arguments); }; }
  const tick0 = E.tick;
  E.tick = function (S) { try { E.s1EventSync(); } catch (e) {} const r = tick0.apply(this, arguments); if (S && S.s1c && !S.mono && S.s1c.bank) try { E.s1cBankPay(S); } catch (e) {} if (S && S.res && S.s1c) E.s1cSync(S); return r; };
  const des0 = E.deserialize;
  E.deserialize = function () { const S = des0.apply(this, arguments); try { if (S) E.s1cSync(S); } catch (e) {} return S; };
})(typeof window !== "undefined" ? window : globalThis);
