/* ============================================================================
   Saison 1, lot 8 : le Tournoi des guildes (Mathis 11A, maquette « Modes de jeu et refonte globale » : « chaque guilde
   envoie 5 équipes, tableau automatique, finale le dimanche » ; Classique · Saison 1 et Éternel, pas en Monocompte).
   - Inscriptions du lundi au samedi midi (heure de Paris) : 5 membres par guilde au plus inscrivent leur équipe d'arène
     (celle du Kolizéum, copiée par le serveur à l'inscription). Il faut au moins 2 guildes.
   - Le samedi à midi, le tableau se fait tout seul : guildes rangées par force (niveau moyen des équipes), les plus fortes
     passent le premier tour s'il manque des guildes. Une rencontre = 5 combats 3 contre 3 (équipe 1 contre équipe 1…) :
     la guilde qui en gagne le plus passe (égalité : la mieux classée). Une équipe absente perd son combat.
   - Les tours se jouent le samedi après-midi ; la finale le dimanche à 20 h.
   - Le combat est celui du Kolizéum (E.koliSim), avec un hasard tiré de la semaine, du tour, de la rencontre et du combat :
     tout le monde peut rejouer le tableau et trouve le même résultat. Le serveur (fonction « record ») joue le tableau par
     morceaux (E.tourStep) et le garde (supabase/tournoi.sql).
   - Récompenses (une fois par semaine, pour les inscrits) : coffre selon le tour atteint ; titre « Champion du Tournoi »
     pour la guilde gagnante.
   Pas de DOM : le serveur charge ce fichier.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const DAY = 86400000, H = 3600000;
  const T = (E.TOUR = { TEAMS: 5, MIN: 2, INSCR_END: { dow: 5, h: 12 }, FINAL: { dow: 6, h: 20 }, TITLE: "Champion du Tournoi",
    CHEST: ["coffre_argent", "coffre_or", "coffre_obsidienne", "coffre_douze"] }); // participant, demi-finale, finale, vainqueur
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };

  /* le calendrier de la semaine (semaine du Kolizéum : lundi-dimanche, heure de Paris) */
  E.tourWeek = (t = E.now()) => (E.koliWeek ? E.koliWeek(t) : Math.floor((Math.floor(t / DAY) + 3) / 7));
  const dowOf = (t) => (E.defiDay(t) + 3) % 7; // lundi 0 … dimanche 6
  const hourOf = (t) => (DAY - E.defiLeft(t)) / H;
  const at = (t, P) => dowOf(t) > P.dow || (dowOf(t) === P.dow && hourOf(t) >= P.h);
  E.tourPhase = (t = E.now()) => (at(t, T.FINAL) ? "finale" : at(t, T.INSCR_END) ? "tours" : "inscr");
  /* temps avant un moment de la semaine (ms) */
  E.tourUntil = (P, t = E.now()) => { const d = P.dow - dowOf(t); return Math.max(0, d * DAY + (P.h - hourOf(t)) * H); };

  /* ---------- le tableau ----------
     guilds : [{ g, name, teams: [{ u, n, lvl, team, heads }] }] ; renvoie l'état du tournoi, à jouer avec E.tourStep */
  const pow = (G) => G.teams.reduce((a, x) => a + (x.lvl || 1), 0) / T.TEAMS;
  E.tourInit = (w, guilds) => {
    const L = guilds.filter((G) => G.teams && G.teams.length).map((G) => ({ g: G.g, name: G.name, ic: G.ic, col: G.col, pow: Math.round(pow(G) * 10) / 10, teams: G.teams.slice(0, T.TEAMS) }))
      .sort((a, b) => b.pow - a.pow || (a.g < b.g ? -1 : 1));
    const st = { w, seeds: L, rounds: [], champ: null, n: 0 };
    if (L.length < T.MIN) { st.void = true; return st; }
    let size = 1; while (size < L.length) size *= 2;
    // placement classique : 1 contre le dernier, les têtes de série loin l'une de l'autre
    let order = [0]; while (order.length < size) { const m = order.length * 2; order = order.flatMap((i) => [i, m - 1 - i]); }
    const R0 = []; for (let i = 0; i < size; i += 2) R0.push(mk(order[i] < L.length ? order[i] : -1, order[i + 1] < L.length ? order[i + 1] : -1));
    st.rounds.push(R0); settle(st); return st;
  };
  const mk = (a, b) => ({ a, b, d: [], win: a < 0 ? b : b < 0 ? a : null });
  const isFinal = (st, r) => st.rounds[r].length === 1;
  /* passe au tour suivant quand toutes les rencontres sont jouées */
  const settle = (st) => { for (;;) { const R = st.rounds[st.rounds.length - 1]; if (R.some((m) => m.win === null)) return;
      if (R.length === 1) { st.champ = R[0].win; return; }
      const N = []; for (let i = 0; i < R.length; i += 2) N.push(mk(R[i].win, R[i + 1].win)); st.rounds.push(N); } };
  E.tourSeed = (w, r, m, k) => hash(`idlus|tournoi|${w}|${r}|${m}|${k}`) | 0;
  /* joue au plus « budget » combats ; la finale attend dimanche 20 h. Renvoie le nombre de combats joués. */
  E.tourStep = (st, budget, t = E.now(), sim = E.koliSim) => {
    let n = 0; if (st.void || st.champ !== null) return 0;
    for (;;) {
      const r = st.rounds.length - 1, R = st.rounds[r];
      if (isFinal(st, r) && E.tourPhase(t) !== "finale") return n;
      const mi = R.findIndex((m) => m.win === null); if (mi < 0) { settle(st); if (st.champ !== null) return n; continue; }
      const m = R[mi], A = st.seeds[m.a], B = st.seeds[m.b];
      while (m.d.length < T.TEAMS) {
        if (n >= budget) return n;
        const k = m.d.length, x = A.teams[k], y = B.teams[k];
        if (!x && !y) m.d.push({ w: -1 }); else if (!y) m.d.push({ w: 0, f: 1 }); else if (!x) m.d.push({ w: 1, f: 1 });
        else { const res = sim(x.team, y.team, E.tourSeed(st.w, r, mi, k)); n++; st.n++; m.d.push({ w: res.win ? 0 : 1, r: res.rounds, ha: res.hpA, hb: res.hpB }); }
      }
      const wa = m.d.filter((d) => d.w === 0).length, wb = m.d.filter((d) => d.w === 1).length;
      m.win = wa > wb ? m.a : wb > wa ? m.b : Math.min(m.a, m.b); // égalité : la mieux classée
      settle(st);
      if (st.champ !== null) return n;
    }
  };
  /* le tour atteint par une guilde : 0 participant, 1 demi-finale, 2 finale, 3 vainqueur (selon la taille du tableau) */
  E.tourPlace = (st, gi) => {
    if (!st || st.void || gi < 0) return -1; if (st.champ === gi) return 3;
    const nR = Math.log2(st.rounds[0].length * 2); // nombre de tours
    let reached = 0; st.rounds.forEach((R, r) => { if (R.some((m) => m.a === gi || m.b === gi)) reached = r; });
    const fromEnd = nR - 1 - reached; // 0 finale, 1 demi-finale
    return fromEnd === 0 ? 2 : fromEnd === 1 ? 1 : 0;
  };
  E.tourRoundName = (st, r) => { const left = st.rounds[0].length * 2 / Math.pow(2, r); return left === 2 ? "Finale" : left === 4 ? "Demi-finales" : left === 8 ? "Quarts de finale" : `Tour ${r + 1}`; };

  /* ---------- récompenses dans la partie : une fois par semaine, pour un inscrit, quand le tournoi est fini ---------- */
  E.tourClaim = (S, st, uid) => {
    if (!st || st.void || st.champ === null) return "Le tournoi n'est pas fini.";
    if (S.mono) return "Pas de tournoi en Monocompte.";
    const gi = st.seeds.findIndex((G) => G.teams.some((x) => x.u === uid)); if (gi < 0) return "Tu n'étais pas inscrit à ce tournoi.";
    S.tour = S.tour || { got: {}, wins: 0, best: -1 }; if (S.tour.got[st.w]) return "Récompense déjà reçue.";
    const p = E.tourPlace(st, gi); S.tour.got[st.w] = p + 1; const ch = T.CHEST[Math.max(0, p)]; E.addCons(S, ch);
    S.tour.best = Math.max(S.tour.best, p); if (p === 3) S.tour.wins++;
    const keys = Object.keys(S.tour.got).map(Number).sort((a, b) => b - a); keys.slice(20).forEach((k) => delete S.tour.got[k]);
    E.emit(S, "tournoi", { w: st.w, place: p });
    return { place: p, chest: ch, title: p === 3 ? T.TITLE : null };
  };
  { const t0 = E.titles; if (t0) E.titles = (S) => { const t = t0(S); if (S.tour && S.tour.wins > 0 && !t.includes(T.TITLE)) t.push(T.TITLE); return t; }; }
  { const ACH = E.ACH || []; const add = (o) => { if (!ACH.some((a) => a.id === o.id)) ACH.push(Object.assign({ cat: "Kolizéum", grp: "Tournoi des guildes" }, o)); };
    const b = (S) => (S.tour ? S.tour.best : -1);
    add({ id: "tour1", name: "Pour la guilde !", desc: "Jouer un Tournoi des guildes.", test: (S) => b(S) >= 0, prog: (S) => [b(S) >= 0 ? 1 : 0, 1], kamas: 30000 });
    add({ id: "tour2", name: "Finaliste", desc: "Atteindre la finale du Tournoi des guildes.", test: (S) => b(S) >= 2, prog: (S) => [b(S) >= 2 ? 1 : 0, 1], kamas: 100000 });
    add({ id: "tour3", name: T.TITLE, desc: "Gagner le Tournoi des guildes.", test: (S) => b(S) >= 3, prog: (S) => [b(S) >= 3 ? 1 : 0, 1], kamas: 300000 }); }
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
