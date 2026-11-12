/* ============================================================================
   Saison 1, lot 8 : le Duel de caisses de la Foire du Trool (Mathis 33A « case battle », 34B pas d'améliorateur,
   37B pas de roulette, 38A garde-fous : des kamas seulement, des limites par jour).
   - Le joueur choisit une caisse (bois, argent, dorée), 1 à 3 manches et 1 ou 3 adversaires du Trool (des personnages
     du jeu, jamais de vrais joueurs). Chacun ouvre les mêmes caisses ; celui dont les lots valent le plus gagne tout.
   - Mise : le prix des caisses du joueur. Les lots sont payés en kamas, à leur valeur (les raretés et parts de la mise
     des Caisses du Trool) : en moyenne 89,5 % de la mise revient, comme une caisse ouverte seule.
   - Égalité : le meilleur lot départage, puis le partage. Chaque manche compte comme une ouverture de caisse du jour
     (20 par jour en tout) ; 5 duels par jour au plus. Rien ne s'achète avec de l'argent réel.
   - Le tirage vient de la graine des Caisses du Trool (S.foire.seed) : recharger la page ne change rien.
   - Seulement dans la partie de saison.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; if (!E || !E.FOIRE || E.duelOpen) return;
  const F = E.FOIRE;
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));
  E.DUEL = { DAY: 5, ROUNDS: 3, FOES: [1, 3], TITLE: "Terreur de la Foire", WINS: 25,
    BOTS: [{ n: "Le Trool", m: 129 }, { n: "Bouftou Royal", m: 74 }, { n: "Mulou", m: 52 }, { n: "Kwak de Flamme", m: 36 }] };
  const DL = E.DUEL;
  const rngOf = (G) => () => { G.seed = (G.seed + 0x6d2b79f5) >>> 0; let t = G.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rarOf = (x) => { let y = x * 100; for (let i = 0; i < F.RAR.length; i++) { if (y < F.RAR[i].p) return i; y -= F.RAR[i].p; } return 0; };
  const today = () => (E.defiDay ? E.defiDay() : Math.floor(E.now() / 86400000));
  E.duelState = (S) => { const c = S.s1c; if (!c.duel || c.duel.d !== today()) c.duel = Object.assign({ wins: 0, n: 0, mise: 0, k: 0 }, c.duel || {}, { d: today(), day: 0 }); return c.duel; };
  E.duelLeft = (S) => (s1(S) && !E.s1cOver(S) ? Math.max(0, DL.DAY - E.duelState(S).day) : 0);
  /* vérifier un duel : null si c'est bon, sinon pourquoi */
  E.duelErr = (S, caisse, rounds, foes) => {
    if (!s1(S)) return "Le Duel de caisses se joue dans la partie de saison.";
    if (E.s1cOver(S)) return "La saison est finie.";
    const C = F.CAISSES.find((x) => x.id === caisse); if (!C) return "Caisse inconnue.";
    if (!(rounds >= 1 && rounds <= DL.ROUNDS)) return "De 1 à 3 manches.";
    if (!DL.FOES.includes(foes)) return "1 ou 3 adversaires.";
    if (!E.duelLeft(S)) return `Tu as joué tes ${DL.DAY} duels du jour : le Trool rouvre demain.`;
    if (E.foireLeft(S) < rounds) return `Il te reste ${E.foireLeft(S)} ouverture${E.foireLeft(S) > 1 ? "s" : ""} de caisse aujourd'hui (${F.DAY} par jour, duels compris).`;
    if (S.kamas < C.cost * rounds) return `Il faut ${(C.cost * rounds).toLocaleString("fr-FR")} kamas pour ce duel.`;
    return null;
  };
  /* jouer : renvoie un message d'erreur ou { seats: [{ n, m, me, lots: [r], v }], win: [index], gain, mise } */
  E.duelOpen = (S, caisse, rounds, foes) => {
    rounds = Math.floor(+rounds); foes = Math.floor(+foes);
    const err = E.duelErr(S, caisse, rounds, foes); if (err) return err;
    const C = F.CAISSES.find((x) => x.id === caisse), G = E.foireState(S), st = E.duelState(S), rng = rngOf(G);
    const mise = C.cost * rounds; S.kamas -= mise; G.n += rounds; st.day++;
    const bots = DL.BOTS.slice(); const seats = [{ n: "Toi", me: true, lots: [], v: 0 }];
    for (let i = 0; i < foes; i++) { const b = bots.splice(Math.floor(rng() * bots.length), 1)[0]; seats.push({ n: b.n, m: b.m, lots: [], v: 0 }); }
    for (let r = 0; r < rounds; r++) seats.forEach((x) => { const k = rarOf(rng()); x.lots.push(k); x.v += Math.round(C.cost * (F.DUEL_MULT ? F.DUEL_MULT[k] : F.RAR[k].mult)); });
    const top = Math.max(...seats.map((x) => x.v)); let win = seats.map((x, i) => (x.v === top ? i : -1)).filter((i) => i >= 0);
    if (win.length > 1) { const best = (i) => Math.max(...seats[i].lots); const b = Math.max(...win.map(best)); win = win.filter((i) => best(i) === b); }
    const pot = seats.reduce((a, x) => a + x.v, 0); const gain = win.includes(0) ? Math.floor(pot / win.length) : 0;
    if (gain) { S.kamas += gain; st.wins++; }
    st.n++; st.mise += mise; st.k += gain; G.tot.n += rounds; G.tot.mise += mise; G.tot.k += gain;
    E.note(S, `Duel de caisses (${C.name}, ${rounds} manche${rounds > 1 ? "s" : ""}) : ${gain ? `gagné, ${gain.toLocaleString("fr-FR")} kamas` : `perdu contre ${seats[win[0]].n}`}.`, "info");
    E.emit(S, "duel", { win: !!gain, gain, mise });
    return { seats, win, gain, mise, pot, caisse: C, rounds };
  };
  /* titre (de collection) et succès de la saison */
  { const t0 = E.titles; if (t0) E.titles = (S) => { const t = t0(S); if (S.s1c && S.s1c.duel && S.s1c.duel.wins >= DL.WINS && !t.includes(DL.TITLE)) t.push(DL.TITLE); return t; }; }
  { const ACH = E.ACH || []; const add = (o) => { if (!ACH.some((a) => a.id === o.id)) ACH.push(Object.assign({ s1: true, cat: "Saison 1", grp: "Duel de caisses" }, o)); };
    const w = (S) => (S.s1c && S.s1c.duel && S.s1c.duel.wins) || 0;
    [[1, "Premier duel gagné"], [DL.WINS, DL.TITLE]].forEach(([k, nm]) => add({ id: "s1duel" + k, name: nm, desc: `Gagner ${k} Duel${k > 1 ? "s" : ""} de caisses.`, test: (S) => E.isS1c(S) && w(S) >= k, prog: (S) => [Math.min(k, w(S)), k], kamas: k * 4000 })); }
})(typeof window !== "undefined" ? window : globalThis);
