/* ============================================================================
   Monocompte — les alignements du Classique branchés sur le Monocompte (étape 3 du plan directeur ;
   choix 4A du 19/10, recommandations P-A1 à P-A5 appliquées sur la demande de Mathis du 21/10).
   L'ancienne guerre codée du Monocompte (1 point par combat de chasse gagné, js/monopass.js) est remplacée par le
   système de la 2.1.31 (js/honneur.js) : régions de la carte, agressions contre des fantômes, honneur, 20 rangs,
   Serments et Arsenal de la cité. Ce qui change dans une partie Monocompte, et seulement là :
   - un camp par saison : choisi une fois, pas de changement de camp pendant la saison (libre dans l'Éternel,
     avec l'attente du Classique) ; l'honneur repart de 0 à chaque saison, puisque chaque saison est une nouvelle partie ;
   - P-A1 : une table des 20 rangs propre au Monocompte (M.align.step), réglée par tools/sim_honneur_mono.js pour un héros
     seul et 56 jours : rang 10 vers la mi-saison et rang 20 en fin de saison pour un joueur actif, rang 6 pour un
     occasionnel. Les gains d'honneur, la défaite à −20 et les prix de l'Arsenal sont ceux du Classique ;
   - agressions et défenses à un héros : les équipes fantômes n'ont qu'un héros (Kolizéum en 1 contre 1, avec le
     réglage par classe de js/mono.js) ;
   - P-A2 : le bonus de région reste +5 % d'XP et de butin (E.ALIGN_REG_BONUS). Les régions tenues viendront du
     serveur Monocompte (E.monoRegSet) ; celles du Classique ne comptent jamais ici (js/alignui.js) ;
   - P-A5 : les équipements de rang restent au héros dans l'Éternel, avec son rang (le bilan de saison le garde).
   La quête du Phénix (P-A3, js/monodofus.js) et les hauts faits « Camp » (P-A4, js/monopass.js) lisent l'honneur.
   Pas de DOM ici. Le Classique n'est jamais touché : chaque crochet vérifie E.isMono.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const M = E.MONO; if (!M || !E.honGive || !E.agrTargets) return;
  /* step : honneur pour passer du rang r-1 au rang r au Monocompte (P-A1, tools/sim_honneur_mono.js du 21/10) ; size : héros par équipe fantôme */
  const A = (M.align = { step: (r) => Math.round((1400 + 30 * (r - 1)) / 10) * 10, size: 1 });
  const mono = (S) => !!(E.isMono && E.isMono(S));
  const season = (S) => mono(S) && !E.monoEternal(S);

  /* ---------- un camp par saison ---------- */
  const choose0 = E.chooseAlign;
  E.chooseAlign = function (S, side) {
    if (season(S) && S.align && S.align.side && side !== S.align.side) return "Monocompte : un seul camp par saison. Tu pourras en changer à la saison suivante.";
    const had = S && S.align && S.align.side; const r = choose0.apply(this, arguments);
    if (!r && mono(S) && S.align && !had) S.align.cm = 1; // honneur compté sur la table du Monocompte
    return r;
  };
  E.monoCampLocked = (S) => season(S) && !!(S.align && S.align.side);

  /* ---------- table des rangs propre au Monocompte (P-A1) ----------
     Classique : 300 honneur pour le rang 1, puis +15 % par rang (30 750 pour le rang 20). Un héros seul gagne presque autant
     d'honneur par jour qu'une équipe (les agressions et les missions comptent par partie), et sa saison dure 56 jours :
     la table du Classique donnerait le rang 10 au jour 11 et le rang 20 au jour 44 (joueur actif). Au Monocompte, chaque
     rang demande 1 400 honneur, +30 par rang (33 700 pour le rang 20). Une partie par page : la table est posée au démarrage. */
  const CL = [0]; for (let r = 1; r <= E.HON_MAX; r++) CL[r] = CL[r - 1] + E.HON_STEP_CL(r);
  const MC = [0]; for (let r = 1; r <= E.HON_MAX; r++) MC[r] = MC[r - 1] + A.step(r);
  /* ancienne partie Monocompte (honneur sur la table du Classique) : même rang et même avancée dans le rang, rien d'autre ne change */
  E.monoHonConvert = (h) => {
    h = Math.max(0, +h || 0); let r = 0; while (r < E.HON_MAX && h >= CL[r + 1]) r++;
    if (r >= E.HON_MAX) return MC[E.HON_MAX] + (h - CL[E.HON_MAX]);
    return Math.round(MC[r] + ((h - CL[r]) / (CL[r + 1] - CL[r])) * (MC[r + 1] - MC[r]));
  };
  E.monoHonCurve = () => E.honCurve(A.step);

  /* ---------- agressions et défenses à un héros ---------- */
  const tg0 = E.agrTargets;
  E.agrTargets = function (S) {
    const L = tg0.apply(this, arguments); if (!mono(S)) return L;
    return L.map((T) => Object.assign(T, { n: Math.min(T.n, A.size) }));
  };
  const ds0 = E.honDefSize;
  E.honDefSize = (S) => (mono(S) ? A.size : ds0(S));
  /* ---------- régions : celles du serveur Monocompte seulement ---------- */
  E.monoRegSet = (o) => E.alignRegSet(o); // branché par le serveur Monocompte (lot 2) ; rien d'autre ne remplit les régions ici

  /* ---------- démarrage et Éternel ---------- */
  const boot0 = E.monoBoot;
  E.monoBoot = function (S) {
    const r = boot0.apply(this, arguments);
    if (!mono(S)) return r;
    E.monoHonCurve();
    if (S.align && S.align.side && !S.align.cm) { // migration : honneur d'une ancienne partie converti sur la table du Monocompte, rang gardé
      E.honInit(S); S.align.hon = E.monoHonConvert(S.align.hon); S.align.cm = 1; E.honInit(S);
    }
    // ancienne partie : un changement de camp en attente n'a plus cours pendant la saison (rien n'est perdu, le camp reste)
    if (season(S) && S.align && S.align.pend) delete S.align.pend;
    return r;
  };
  const et0 = E.monoToEternal;
  E.monoToEternal = function (S) {
    const al = S && S.align && S.align.side ? { s: S.align.side, r: E.alignRankIdx(S), h: Math.round(S.align.hon || 0) } : null;
    const r = et0.apply(this, arguments);
    if (r && al && S.mono.eternel) S.mono.eternel.al = al; // bilan de saison : camp, rang et honneur
    return r;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
